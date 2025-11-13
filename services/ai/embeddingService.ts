import { GoogleGenAI } from "@google/genai";
import type { Settings } from '../../types';
import { getGeminiApiKeys, getHealthyGeminiApiKeys, penalizeApiKey } from '../../utils/apiHelpers';
import { generateEmbedding as generateKoboldEmbedding } from '../koboldcppService';
import { generateOpenAIEmbedding, testOpenAIEmbeddingConnection } from './openaiEmbeddingService';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// **Embedding Cache System**
// Cache embeddings to avoid redundant API calls and reduce quota consumption
interface EmbeddingCacheEntry {
  embedding: number[];
  timestamp: number;
}

class EmbeddingCache {
  private cache: Map<string, EmbeddingCacheEntry> = new Map();
  private readonly maxAge = 24 * 60 * 60 * 1000; // 24 hours
  private readonly maxSize = 1000; // Maximum cached entries

  /**
   * Generate a cache key from text and task type
   */
  private getCacheKey(text: string, taskType: string): string {
    return `${taskType}:${text}`;
  }

  /**
   * Get embedding from cache if available and not expired
   */
  get(text: string, taskType: string): number[] | null {
    const key = this.getCacheKey(text, taskType);
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Check if entry is expired
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.embedding;
  }

  /**
   * Store embedding in cache
   */
  set(text: string, taskType: string, embedding: number[]): void {
    // Implement LRU-like behavior: if cache is full, remove oldest entries
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    const key = this.getCacheKey(text, taskType);
    this.cache.set(key, {
      embedding,
      timestamp: Date.now()
    });
  }

  /**
   * Clear all cached embeddings
   */
  clear(): void {
    this.cache.clear();
  }
}

// Global cache instance
const embeddingCache = new EmbeddingCache();

/**
 * Generate embeddings using Google Gemini API with caching and rate limiting
 * 
 * This function implements:
 * - Caching to avoid redundant API calls
 * - Rate limiting with configurable batch size and delays
 * - Sequential batch processing to respect API quotas
 * - Better error handling for quota exhaustion
 */
const generateGeminiEmbedding = async (
    texts: string[],
    settings: Settings,
    taskType: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' | 'SEMANTIC_SIMILARITY' | 'CLASSIFICATION' | 'CLUSTERING'
): Promise<number[][]> => {
    const keys = getHealthyGeminiApiKeys(settings);
    if (keys.length === 0) {
        if (getGeminiApiKeys(settings).length > 0) {
            throw new Error("All Gemini API keys are temporarily rate-limited. Switch to KoboldCpp in Settings > Memory, or wait for the penalty to expire.");
        }
        throw new Error("No Gemini API Key provided for embedding. Please add one in Settings.");
    }
    
    // **Step 1: Check cache for existing embeddings**
    const embeddings: (number[] | null)[] = texts.map(text => embeddingCache.get(text, taskType));
    const uncachedIndices: number[] = [];
    
    embeddings.forEach((emb, idx) => {
      if (emb === null) {
        uncachedIndices.push(idx);
      }
    });
    
    // If all embeddings are cached, return immediately
    if (uncachedIndices.length === 0) {
      console.log(`✓ All ${texts.length} embeddings retrieved from cache`);
      return embeddings as number[][];
    }
    
    console.log(`Cache: ${texts.length - uncachedIndices.length}/${texts.length} embeddings cached, fetching ${uncachedIndices.length} from API`);
    
    // **Step 2: Fetch uncached embeddings with rate limiting**
    const uncachedTexts = uncachedIndices.map(idx => texts[idx]);
    let lastError: Error | null = null;
    const MAX_RETRIES = 2; // Reduced retries to avoid quota exhaustion
    const BATCH_SIZE = 3; // Process 3 embeddings at a time to respect rate limits
    const BATCH_DELAY = 2000; // 2 seconds between batches

    console.log(`🔑 Using ${keys.length} API key(s) for embedding requests`);
    
    for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
        const key = keys[keyIndex];
        console.log(`🔄 Trying API key ${keyIndex + 1}/${keys.length} (...${key.slice(-4)})`);
        
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const ai = new GoogleGenAI({ apiKey: key });
                const fetchedEmbeddings: number[][] = [];
                
                // **Process in batches to avoid rate limiting**
                for (let i = 0; i < uncachedTexts.length; i += BATCH_SIZE) {
                    const batch = uncachedTexts.slice(i, i + BATCH_SIZE);
                    
                    // Add delay between batches (except for first batch)
                    if (i > 0) {
                        console.log(`⏳ Waiting ${BATCH_DELAY}ms before next batch...`);
                        await delay(BATCH_DELAY);
                    }
                    
                    console.log(`📤 Fetching batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(uncachedTexts.length / BATCH_SIZE)} (${batch.length} embeddings)`);
                    
                    // Process batch sequentially with small delays between each request
                    for (const text of batch) {
                        const response = await ai.models.embedContent({
                            model: 'embedding-001',
                            contents: { parts: [{ text }] },
                            config: {
                                taskType: taskType,
                            }
                        });
                        
                        const embedding = response.embeddings[0].values;
                        fetchedEmbeddings.push(embedding);
                        
                        // Small delay between individual requests (200ms)
                        if (batch.indexOf(text) < batch.length - 1) {
                            await delay(200);
                        }
                    }
                }

                if (fetchedEmbeddings.length !== uncachedTexts.length) {
                    throw new Error("API response did not contain the expected number of embeddings.");
                }

                // **Step 3: Store fetched embeddings in cache**
                uncachedIndices.forEach((originalIdx, fetchedIdx) => {
                    const embedding = fetchedEmbeddings[fetchedIdx];
                    embeddings[originalIdx] = embedding;
                    embeddingCache.set(texts[originalIdx], taskType, embedding);
                });

                console.log(`✓ Successfully fetched and cached ${fetchedEmbeddings.length} embeddings using API key ${keyIndex + 1}/${keys.length}`);
                return embeddings as number[][];
                
            } catch (error: any) {
                lastError = error;
                
                // Check if it's a quota error (429)
                const isQuotaError = error?.message?.includes('429') || 
                                   error?.message?.includes('quota') || 
                                   error?.message?.includes('RESOURCE_EXHAUSTED');
                
                if (isQuotaError) {
                    penalizeApiKey(key);
                    console.warn(`⚠️ API key ...${key.slice(-4)} has exceeded quota. Trying next key if available...`);
                    // Don't throw here - try the next API key instead
                    break; // Break from retry loop to try next key
                }
                
                console.warn(`(Attempt ${attempt}/${MAX_RETRIES}) Gemini embedding failed with key ...${key.slice(-4)}. Error:`, error.message);
                
                if (attempt < MAX_RETRIES) {
                    const backoffDelay = attempt * 2000; // 2s, 4s
                    console.log(`⏳ Retrying in ${backoffDelay}ms...`);
                    await delay(backoffDelay);
                }
            }
        }
    }
    
    // If we reach here, all keys and retries have failed
    if (lastError) {
        const isQuotaError = lastError?.message?.includes('429') || 
                           lastError?.message?.includes('quota') || 
                           lastError?.message?.includes('RESOURCE_EXHAUSTED');
        
        if (isQuotaError) {
            console.error(`❌ All API keys have exceeded quota. Consider:
1. Using KoboldCpp for local embeddings (set in Settings > Memory)
2. Waiting for quota reset (check: https://ai.google.dev/gemini-api/docs/rate-limits)
3. Upgrading to paid tier for higher limits
4. Adding more API keys in Settings`);
            throw new Error("All Gemini API keys exceeded quota. Switch to KoboldCpp in Settings > Memory, add more keys, or wait for quota reset.");
        }
        
        throw lastError;
    } else {
        throw new Error("All Gemini embedding API calls and retries failed.");
    }
};

/**
 * Test Gemini embedding connection with a simple test
 * Uses caching so repeated tests don't consume quota
 */
export const testGeminiEmbeddingConnection = async (settings: Settings): Promise<boolean> => {
    try {
        // Use a simple test that will be cached
        const testText = "connection test";
        await generateGeminiEmbedding([testText], settings, 'RETRIEVAL_DOCUMENT');
        console.log("✓ Gemini embedding connection test successful");
        return true;
    } catch (error: any) {
        console.error("❌ Gemini embedding connection test failed:", error);
        throw error;
    }
};

/**
 * Clear the embedding cache
 * Useful for troubleshooting or when you want to force fresh embeddings
 */
export const clearEmbeddingCache = (): void => {
    embeddingCache.clear();
    console.log("✓ Embedding cache cleared");
};

/**
 * Test OpenAI embedding connection (re-exported from openaiEmbeddingService)
 */
export { testOpenAIEmbeddingConnection };

export const generateEmbedding = async (
    texts: string[],
    settings: Settings,
    taskType: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' | 'SEMANTIC_SIMILARITY' | 'CLASSIFICATION' | 'CLUSTERING' = 'RETRIEVAL_DOCUMENT'
): Promise<number[][]> => {
    const engine = settings.rag.embeddingEngine;
    
    if (engine === 'koboldcpp') {
        // Improve cross-encoder style performance (E5/Nomic) by adding task-specific prefixes
        const prefixed = texts.map(t => {
            if (taskType === 'RETRIEVAL_QUERY') return `search_query: ${t}`;
            if (taskType === 'RETRIEVAL_DOCUMENT') return `search_document: ${t}`;
            return t;
        });
        return generateKoboldEmbedding(prefixed, settings.rag.koboldcppUrl);
    } else if (engine === 'openai-small') {
        return generateOpenAIEmbedding(texts, settings, 'small');
    } else if (engine === 'openai-large') {
        return generateOpenAIEmbedding(texts, settings, 'large');
    } else { // 'gemini'
        return generateGeminiEmbedding(texts, settings, taskType);
    }
};
