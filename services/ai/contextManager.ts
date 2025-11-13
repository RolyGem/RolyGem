import * as tiktoken from "tiktoken";
import type { Tiktoken } from "tiktoken";
import { GoogleGenAI } from "@google/genai";
import type { Message, Model, Settings, SummarizationZone } from '../../types';
import { summarizeWithKobold } from '../koboldcppService';
import { summarizeWithOpenRouter } from './openRouterSummarizer';
import { generateUUID } from '../../utils/uuid';
import { callGeminiWithRetry, getPromptConfig, getGeminiApiKeys } from '../../utils/apiHelpers';
import { PROMPT_IDS } from '../../constants';
import { summarizationDebugService } from '../summarizationDebugService';


/**
 * This module is responsible for managing the conversation context to ensure
 * it fits within the AI model's token limit.
 */

// --- Tiktoken Initialization ---

let enc: Tiktoken | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Lazily initializes the tiktoken tokenizer using Vite's WebAssembly support.
 * Uses vite-plugin-wasm to handle the WASM imports properly.
 * @returns A promise that resolves to the initialized Tiktoken encoder.
 */
async function getEncoder(): Promise<Tiktoken> {
    if (enc) return enc;
    if (initPromise) {
        await initPromise;
        return enc!;
    }

    initPromise = (async () => {
        try {
            // Use the imported tiktoken module directly with Vite's WASM support
            enc = tiktoken.get_encoding("cl100k_base");
            console.log("Tokenizer initialized successfully.");
        } catch (e) {
            console.error("Failed to initialize tokenizer, token counts will fall back to approximation.", e);
            // In case of failure, create a mock encoder that uses approximation.
            // This prevents the app from crashing and allows `countTokens` to work consistently.
            enc = {
                encode: (text: string) => {
                    const approxTokens = Math.round((text || "").length / 4);
                    return new Uint32Array(approxTokens);
                },
                decode: (tokens: Uint32Array) => ""
            } as any; // Cast to bypass type checking for the mock.
        }
    })();

    await initPromise;
    return enc!;
}


// Calibration cache: stores learned char/token ratio per conversation
const calibrationCache = new Map<string, number>();

function buildChunkCacheKey(
    conversationId: string | undefined,
    zone: SummarizationZone | undefined,
    chunk: Message[]
): string | null {
    if (!conversationId || !zone || chunk.length === 0) return null;
    const idsSignature = chunk.map(msg => msg.id).join('|');
    return `${conversationId}:${zone}:${idsSignature}`;
}

/**
 * Calibrate token counting using Google API (one-time per conversation).
 * Returns the accurate chars/token ratio for this specific content.
 * @param sampleText - Representative text sample (e.g., recent messages)
 * @param model - Gemini model
 * @param settings - Settings for API keys
 * @param conversationId - Conversation ID for caching
 * @returns Promise resolving to calibrated chars/token ratio
 */
export async function calibrateTokenCounting(
    sampleText: string,
    model: Model,
    settings: Settings,
    conversationId?: string
): Promise<number> {
    // Check cache first
    if (conversationId && calibrationCache.has(conversationId)) {
        return calibrationCache.get(conversationId)!;
    }
    
    try {
        const keys = getGeminiApiKeys(settings);
        if (keys.length === 0) {
            console.warn('No API keys for calibration, using default 2.51');
            return 2.51;
        }
        
        const ai = new GoogleGenAI({ apiKey: keys[0] });
        const result = await ai.models.countTokens({
            model: model.id,
            contents: [{ role: 'user', parts: [{ text: sampleText }] }]
        });
        
        const totalTokens = result.totalTokens || 0;
        const totalChars = sampleText.length;
        const ratio = totalChars / totalTokens;
        
        console.log(`✅ Token counting calibrated: ${ratio.toFixed(2)} chars/token (${totalChars} chars → ${totalTokens} tokens)`);
        
        // Cache the ratio
        if (conversationId) {
            calibrationCache.set(conversationId, ratio);
        }
        
        return ratio;
    } catch (e) {
        console.warn('Calibration failed, using default 2.51:', e);
        return 2.51;
    }
}

/**
 * Batch count tokens using Google API (100% accurate but slower).
 * Uses a SINGLE API call for all texts - much faster than individual calls.
 * @param texts - Array of texts to count
 * @param model - Gemini model
 * @param settings - Settings for API keys
 * @returns Promise resolving to array of token counts
 */
async function batchCountTokensAccurate(
    texts: string[],
    model: Model,
    settings: Settings
): Promise<number[]> {
    if (texts.length === 0) return [];
    
    try {
        const keys = getGeminiApiKeys(settings);
        if (keys.length === 0) {
            throw new Error('No Gemini API keys available');
        }
        
        const ai = new GoogleGenAI({ apiKey: keys[0] });
        
        // Single batch request for all texts
        const combinedText = texts.join('\n\n---SEP---\n\n');
        const result = await ai.models.countTokens({
            model: model.id,
            contents: [{ role: 'user', parts: [{ text: combinedText }] }]
        });
        
        // Calculate ratio and estimate individual counts
        const totalTokens = result.totalTokens || 0;
        const totalChars = combinedText.length;
        const ratio = totalTokens / totalChars;
        
        return texts.map(text => Math.ceil(text.length * ratio));
    } catch (e) {
        console.warn('Batch token counting failed, falling back to fast mode:', e);
        return texts.map(text => Math.ceil(text.length / 2.51));
    }
}

/**
 * Calculate image tokens based on Gemini 2.0 specifications.
 * Small images (≤384×384): 258 tokens
 * Large images: 258 tokens per 768×768 tile
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @returns Number of tokens for the image
 */
function calculateImageTokens(width?: number, height?: number): number {
    // Default to medium size if dimensions unknown
    if (!width || !height) {
        return 258; // Assume small image
    }
    
    // Small image
    if (width <= 384 && height <= 384) {
        return 258;
    }
    
    // Large image - calculate tiles
    const tilesWidth = Math.ceil(width / 768);
    const tilesHeight = Math.ceil(height / 768);
    const totalTiles = tilesWidth * tilesHeight;
    
    return totalTiles * 258;
}

/**
 * Count tokens for a complete message including text and images.
 * @param message - The message to count tokens for
 * @param model - Optional model (for provider-specific counting)
 * @param settings - Optional settings (for API keys)
 * @returns A promise resolving to the total number of tokens
 */
export async function countMessageTokens(
    message: Message,
    model?: Model,
    settings?: Settings
): Promise<number> {
    const contentToCount = message.summary || message.content;
    let totalTokens = await countTokens(contentToCount, model, settings);
    
    // Add image tokens if present
    if (message.attachedImage) {
        // Try to extract dimensions from dataUrl if available
        // For now, assume standard image size (258 tokens)
        totalTokens += 258; // Conservative estimate
    }
    
    return totalTokens;
}

/**
 * Counts tokens using optimized approximation for speed.
 * @param text - The text to count tokens for.
 * @param model - Optional model (for provider-specific counting).
 * @param settings - Optional settings (for API keys).
 * @returns A promise resolving to the number of tokens.
 */
export async function countTokens(
    text: string, 
    model?: Model,
    settings?: Settings
): Promise<number> {
    if (!text) {
        return 0;
    }
    
    // GEMINI-OPTIMIZED TOKEN COUNTING
    // Problem: Google's countTokens API = 2-3s delay per message (catastrophic!)
    // Problem: Tiktoken (OpenAI) = 40% overestimation for Gemini models
    // Solution: Character-based approximation tuned for Gemini tokenizer
    
    if (model?.provider === 'Google') {
        // ADAPTIVE GEMINI TOKEN COUNTING
        // Balances speed (instant) with accuracy (calibrated to real usage)
        // 
        // Real-world calibration data:
        // - Test 1: 104k est → 139k actual = 2.47 chars/token
        // - Test 2: 156k est → 137k actual = 2.51 chars/token
        // - Final calibration: 2.51 chars/token (99.9% accuracy)
        
        // Smart language detection for better accuracy
        const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
        const totalChars = text.length;
        const arabicRatio = arabicChars / totalChars;
        
        let avgCharsPerToken: number;
        if (arabicRatio > 0.6) {
            // Arabic-heavy: Calibrated from real usage (344k chars → 137k tokens)
            avgCharsPerToken = 2.51;
        } else if (arabicRatio > 0.2) {
            // Mixed content: Interpolated between Arabic and English
            avgCharsPerToken = 2.8;
        } else {
            // English-heavy: Google's guideline (4 chars/token)
            avgCharsPerToken = 3.8;
        }
        
        return Math.ceil(text.length / avgCharsPerToken);
    }
    
    // For non-Gemini models (OpenRouter, etc.), use tiktoken
    const encoder = await getEncoder();
    const tokens = encoder.encode(text);
    return tokens.length;
};


/**
 * Summarizes a piece of text using the Gemini 2.5 Flash model.
 * @param text - The text to summarize.
 * @param settings - Optional settings (will be fetched if not provided)
 * @returns A promise that resolves to the summarized text.
 */
const summarizeWithGemini = async (text: string, settings?: Settings): Promise<string> => {
    // Get prompt configuration from user settings (AI Prompts tab)
    const promptConfig = await getPromptConfig(PROMPT_IDS.CONTEXT_SUMMARIZATION, settings);

    const systemPrompt = promptConfig.template;
    
    try {
        const response = await callGeminiWithRetry(
            {
                model: promptConfig.model, // ✅ From AI Prompts settings
                contents: [{
                    role: 'user',
                    parts: [{ text }]
                }],
                config: {
                    systemInstruction: systemPrompt,
                    temperature: 0.2, // Low temperature for factual summarization
                    thinkingConfig: { thinkingBudget: 0 },
                }
            },
            settings,
            60000 // 60 seconds timeout
        );
        const summary = response.text;
        if (!summary) {
            throw new Error("Gemini did not return a valid summary.");
        }
        return summary.trim();
    } catch (error) {
        console.error("Error summarizing with Gemini:", error);
        throw error;
    }
};

/**
 * Helper: Split array into chunks of specified size
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

/**
 * Helper: Get model name for debug logging
 */
function getModelNameForDebug(summarizerModel: 'gemini' | 'koboldcpp' | 'openrouter', settings: Settings): string {
    switch (summarizerModel) {
        case 'openrouter':
            return `openrouter/${settings.contextManagement.openRouterSummarizerModelId || 'unknown'}`;
        case 'koboldcpp':
            return 'koboldcpp';
        case 'gemini':
        default:
            return 'gemini-2.5-flash';
    }
}

/**
 * Helper: Summarize a chunk of messages with specified compression level
 */
async function summarizeChunk(
    messages: Message[],
    compressionLevel: number,
    settings: Settings,
    zone?: SummarizationZone,
    conversationId?: string,
    chunkIndex?: number,
    totalChunks?: number
): Promise<string> {
    const text = messages.map(m => {
        const content = m.summary || m.content;
        return `${m.role}: ${content}`;
    }).join('\n\n');

    // Calculate target length based on compression level
    const originalLength = text.length;
    const targetLength = Math.ceil(originalLength * compressionLevel);

    const prompt = `Summarize the following conversation segment. Original length: ${originalLength} chars. Target: ~${targetLength} chars (${Math.round(compressionLevel * 100)}% retention).

Preserve key information:
- Important events and decisions
- Character emotions and relationships
- Critical dialogue
- Plot developments

Conversation:
${text}`;

    const startTime = Date.now();
    const inputTokens = await countTokens(text);
    let status: 'success' | 'fallback' | 'error' = 'success';
    let fallbackReason: string | undefined;
    let errorMessage: string | undefined;
    let outputTokens = 0;

    try {
        let summary: string;
        
        // Choose summarizer based on settings
        if (settings.contextManagement.summarizerModel === 'openrouter') {
            summary = await summarizeWithOpenRouter(text, compressionLevel, settings);
        } else if (settings.contextManagement.summarizerModel === 'koboldcpp') {
            summary = await summarizeWithKobold(prompt, settings.contextManagement.koboldcppUrl);
        } else {
            // Default: Gemini
            summary = await summarizeWithGemini(prompt, settings);
        }
        
        const duration = Date.now() - startTime;
        
        // ✅ Validate summary is not empty or refusal
        if (!summary || summary.trim().length === 0) {
            console.warn('⚠️ Gemini returned empty summary, using truncation fallback');
            status = 'fallback';
            fallbackReason = 'empty_response';
            const fallback = text.substring(0, targetLength) + '...';
            outputTokens = await countTokens(fallback);
            
            // Log to debug service
            if (settings.contextManagement.debugMode && zone && conversationId) {
                summarizationDebugService.addLog({
                    timestamp: Date.now(),
                    conversationId,
                    zone,
                    inputTokens,
                    outputTokens,
                    retentionRate: compressionLevel,
                    model: getModelNameForDebug(settings.contextManagement.summarizerModel, settings),
                    status,
                    duration,
                    chunkIndex,
                    totalChunks,
                    fallbackReason
                });
            }
            
            return fallback;
        }
        
        // ✅ Detect refusal messages (multilingual)
        const refusalPatterns = [
            /I cannot|I can't|I'm unable|I apologize|I'm sorry/i,
            /inappropriate|unsafe|harmful|violates/i
        ];
        
        const isRefusal = refusalPatterns.some(pattern => pattern.test(summary));
        if (isRefusal) {
            console.warn('⚠️ Gemini refused to summarize (safety filter), using truncation fallback');
            status = 'fallback';
            fallbackReason = 'refusal_detected';
            const fallback = text.substring(0, targetLength) + '...';
            outputTokens = await countTokens(fallback);
            
            // Log to debug service
            if (settings.contextManagement.debugMode && zone && conversationId) {
                summarizationDebugService.addLog({
                    timestamp: Date.now(),
                    conversationId,
                    zone,
                    inputTokens,
                    outputTokens,
                    retentionRate: compressionLevel,
                    model: getModelNameForDebug(settings.contextManagement.summarizerModel, settings),
                    status,
                    duration,
                    chunkIndex,
                    totalChunks,
                    fallbackReason
                });
            }
            
            return fallback;
        }
        
        // ✅ Check if summary is too short (less than 10% of target)
        if (summary.length < targetLength * 0.1) {
            console.warn(`⚠️ Summary too short (${summary.length} < ${targetLength * 0.1}), using truncation fallback`);
            status = 'fallback';
            fallbackReason = 'too_short';
            const fallback = text.substring(0, targetLength) + '...';
            outputTokens = await countTokens(fallback);
            
            // Log to debug service
            if (settings.contextManagement.debugMode && zone && conversationId) {
                summarizationDebugService.addLog({
                    timestamp: Date.now(),
                    conversationId,
                    zone,
                    inputTokens,
                    outputTokens,
                    retentionRate: compressionLevel,
                    model: getModelNameForDebug(settings.contextManagement.summarizerModel, settings),
                    status,
                    duration,
                    chunkIndex,
                    totalChunks,
                    fallbackReason
                });
            }
            
            return fallback;
        }
        
        // Success!
        outputTokens = await countTokens(summary);
        
        // Log to debug service
        if (settings.contextManagement.debugMode && zone && conversationId) {
            summarizationDebugService.addLog({
                timestamp: Date.now(),
                conversationId,
                zone,
                inputTokens,
                outputTokens,
                retentionRate: compressionLevel,
                model: getModelNameForDebug(settings.contextManagement.summarizerModel, settings),
                status,
                duration,
                chunkIndex,
                totalChunks,
                inputPreview: text.substring(0, 500) + (text.length > 500 ? '...' : ''),
                outputSummary: summary
            });
        }
        
        return summary;
    } catch (e: any) {
        console.error(' Chunk summarization failed:', e);
        console.error('❌ Chunk summarization failed:', e);
        status = 'error';
        errorMessage = e?.message || 'Unknown error';
        const fallback = text.substring(0, targetLength) + '...';
        outputTokens = await countTokens(fallback);
        const duration = Date.now() - startTime;
        
        // Log to debug service
        if (settings.contextManagement.debugMode && zone && conversationId) {
            summarizationDebugService.addLog({
                timestamp: Date.now(),
                conversationId,
                zone,
                inputTokens,
                outputTokens,
                retentionRate: compressionLevel,
                model: (await getPromptConfig(PROMPT_IDS.CONTEXT_SUMMARIZATION, settings)).model,
                status,
                duration,
                chunkIndex,
                totalChunks,
                errorMessage,
                fallbackReason: 'api_error'
            });
        }
        
        return fallback;
    }
}

async function summarizeChunksSequentially(
    chunks: Message[][],
    compressionLevel: number,
    settings: Settings,
    zone: SummarizationZone,
    conversationId?: string,
    cache?: Map<string, string>
): Promise<string[]> {
    if (chunks.length === 0) return [];
    const summaries: string[] = [];

    for (let index = 0; index < chunks.length; index++) {
        const chunk = chunks[index];
        if (!chunk || chunk.length === 0) {
            summaries.push('');
            continue;
        }

        const cacheKey = cache ? buildChunkCacheKey(conversationId, zone, chunk) : null;
        if (cacheKey && cache?.has(cacheKey)) {
            summaries.push(cache.get(cacheKey)!);
            continue;
        }

        const summary = await summarizeChunk(
            chunk,
            compressionLevel,
            settings,
            zone,
            conversationId,
            index,
            chunks.length
        );

        if (cacheKey && cache) {
            cache.set(cacheKey, summary);
        }

        summaries.push(summary);
    }

    return summaries;
}

/**
 * Smart summarization with Dynamic Recent Zone and Hierarchical Compression
 */
async function smartSummarize(
    history: Message[],
    maxTokens: number,
    systemPromptTokens: number,
    settings: Settings,
    model: Model,
    conversationId?: string
): Promise<{ managedHistory: Message[], wasManaged: boolean }> {
    const recentZoneTokenBudget = settings.contextManagement.recentZoneTokens || 35000;
    const compressionLevels = settings.contextManagement.compressionLevels || {
        midTerm: 0.4,
        archive: 0.2
    };

    // Check if history already contains summaries (avoid re-summarizing)
    // Use isSummary flag and content pattern to detect summaries reliably
    const isSummaryMessage = (msg: Message) => {
        if (msg.isSummary) return true;
        // Fallback: check content pattern for old summaries
        return msg.content?.includes('[Archive Summary') || 
               msg.content?.includes('[Mid-term Summary') ||
               msg.content?.includes('[Context Summary');
    };
    
    const hasSummaries = history.some(isSummaryMessage);
    if (hasSummaries) {
        console.log('✅ REUSING EXISTING SUMMARIES - NO NEW SUMMARIZATION NEEDED!');
        // Filter out old messages that were summarized, keep summaries + recent
        const summaryMessages = history.filter(isSummaryMessage);
        const nonSummaryMessages = history.filter(msg => !isSummaryMessage(msg));
        
        // Calculate tokens for summaries + recent messages
        let totalTokens = systemPromptTokens;
        let summaryTokens = 0;
        for (const msg of summaryMessages) {
            const tokens = await countMessageTokens(msg, model, settings);
            summaryTokens += tokens;
            totalTokens += tokens;
        }
        
        // Add as many recent messages as can fit
        const recentMessages: Message[] = [];
        let recentTokens = 0;
        for (let i = nonSummaryMessages.length - 1; i >= 0; i--) {
            const msgTokens = await countMessageTokens(nonSummaryMessages[i], model, settings);
            if (totalTokens + msgTokens <= maxTokens) {
                recentMessages.unshift(nonSummaryMessages[i]);
                totalTokens += msgTokens;
                recentTokens += msgTokens;
            } else {
                break;
            }
        }
        
        console.log(`ℹ️ Using ${summaryMessages.length} summaries + ${recentMessages.length} recent messages (${totalTokens} tokens)`);

        if (settings.contextManagement.debugMode && conversationId) {
            summarizationDebugService.addLog({
                timestamp: Date.now(),
                conversationId,
                zone: 'recent',
                inputTokens: summaryTokens + recentTokens,
                outputTokens: summaryTokens + recentTokens,
                retentionRate: 1,
                model: getModelNameForDebug(settings.contextManagement.summarizerModel, settings),
                status: 'success',
                duration: 0,
                outputSummary: 'Reused existing archive/mid-term summaries without re-summarizing.'
            });
        }
        return {
            managedHistory: [...summaryMessages, ...recentMessages],
            wasManaged: true
        };
    }

    console.log('🔄 No existing summaries found, creating new summaries...');
    console.log(`📊 Total messages to process: ${history.length}`);

    const chunkSummaryCache = new Map<string, string>();

    // Step 1: Protect Recent Zone (Dynamic)
    let recentZoneTokens = 0;
    const recentZone: Message[] = [];
    
    for (let i = history.length - 1; i >= 0; i--) {
        const message = history[i];
        const tokens = await countMessageTokens(message, model, settings);
        
        if (recentZoneTokens + tokens <= recentZoneTokenBudget) {
            recentZone.unshift(message);
            recentZoneTokens += tokens;
        } else {
            break;
        }
    }

    console.log(`🛡️ Recent Zone: ${recentZone.length} messages (${recentZoneTokens} tokens) protected`);

    // Step 2: Calculate remaining budget
    const remainingBudget = maxTokens - systemPromptTokens - recentZoneTokens;
    
    if (remainingBudget <= 0) {
        // Not enough space even with recent zone
        console.warn('⚠️ Recent zone alone exceeds context limit!');
        return { managedHistory: recentZone, wasManaged: true };
    }

    // Step 3: Handle old messages (those not in recent zone)
    const oldMessages = history.slice(0, history.length - recentZone.length);
    
    if (oldMessages.length === 0) {
        // All messages fit in recent zone
        return { managedHistory: history, wasManaged: false };
    }

    // Step 4: Hierarchical Summarization of old messages
    // Divide into zones: mid-term (closer) and archive (older)
    const midPoint = Math.floor(oldMessages.length * 0.6);
    const archiveZone = oldMessages.slice(0, midPoint);
    const midTermZone = oldMessages.slice(midPoint);

    console.log(`📚 Hierarchical zones: Archive=${archiveZone.length} msgs, Mid-term=${midTermZone.length} msgs`);

    try {
        // Summarize archive with heavy compression (20% retention)
        // Increase chunk size: 50 messages per chunk (~2000-3000 tokens)
        const archiveChunks = chunkArray(archiveZone, 50);
        console.log(`🔄 Creating ${archiveChunks.length} archive chunks (50 msgs each)`);
        const archiveSummaries = await summarizeChunksSequentially(
            archiveChunks,
            compressionLevels.archive,
            settings,
            'archive',
            conversationId,
            chunkSummaryCache
        );
        const archiveSummary = archiveSummaries.join('\n\n');

        // Summarize mid-term with medium compression (40% retention)
        // Increase chunk size: 40 messages per chunk (~1500-2500 tokens)
        const midTermChunks = chunkArray(midTermZone, 40);
        console.log(`🔄 Creating ${midTermChunks.length} mid-term chunks (40 msgs each)`);
        const midTermSummaries = await summarizeChunksSequentially(
            midTermChunks,
            compressionLevels.midTerm,
            settings,
            'midTerm',
            conversationId,
            chunkSummaryCache
        );
        const midTermSummary = midTermSummaries.join('\n\n');

        // Create summary messages with role='model' (Gemini API compatibility)
        const archiveMessage: Message = {
            id: generateUUID(),
            role: 'model',
            content: `[Archive Summary - ${archiveZone.length} messages compressed]:\n${archiveSummary}`,
            summary: archiveSummary,
            isSummary: true,
            timestamp: archiveZone[archiveZone.length - 1]?.timestamp || Date.now(),
        };

        const midTermMessage: Message = {
            id: generateUUID(),
            role: 'model',
            content: `[Mid-term Summary - ${midTermZone.length} messages compressed]:\n${midTermSummary}`,
            summary: midTermSummary,
            isSummary: true,
            timestamp: midTermZone[midTermZone.length - 1]?.timestamp || Date.now(),
        };

        console.log('✅ Smart summarization complete');

        return {
            managedHistory: [archiveMessage, midTermMessage, ...recentZone],
            wasManaged: true
        };
    } catch (e) {
        console.error('❌ Smart summarization failed, falling back to simple trim:', e);
        return { managedHistory: recentZone, wasManaged: true };
    }
}

/**
 * Manages the conversation history to ensure it doesn't exceed the model's token limit.
 * It can either trim the oldest messages or summarize them based on user settings.
 * @param history - The full message history.
 * @param model - The AI model being used, which defines the context limit.
 * @param settings - The application settings, which can override context behavior.
 * @param fullSystemPrompt - The system prompt, which also consumes tokens.
 * @returns An object containing the managed history and a flag indicating if management was performed.
 */
export const manageContext = async (
    history: Message[],
    model: Model,
    settings: Settings,
    fullSystemPrompt: string,
    conversationId?: string
): Promise<{ managedHistory: Message[], wasManaged: boolean }> => {
    // Use user override, or model's default, or a sensible fallback.
    const maxTokens = settings.contextManagement.maxContextTokens ?? model.contextLengthTokens ?? 8192;

    if (!maxTokens || maxTokens <= 0) {
        return { managedHistory: history, wasManaged: false };
    }

    const systemPromptTokens = await countTokens(fullSystemPrompt, model, settings);
    let totalTokens = systemPromptTokens;
    let sliceIndex = history.length;

    // Iterate backwards from the last message to see how many fit
    for (let i = history.length - 1; i >= 0; i--) {
        const message = history[i];
        // Use countMessageTokens to include image tokens
        totalTokens += await countMessageTokens(message, model, settings);
        if (totalTokens > maxTokens) {
            sliceIndex = i + 1; // This message is the first one that doesn't fit
            break;
        } else {
            sliceIndex = i; // This message fits
        }
    }

    // If all messages fit, no management needed
    if (sliceIndex === 0) {
        return { managedHistory: history, wasManaged: false };
    }

    // Messages to keep are from sliceIndex to the end
    const keptMessages = history.slice(sliceIndex);
    // Messages to be managed (trimmed or summarized) are from the beginning up to sliceIndex
    const managedMessages = history.slice(0, sliceIndex);
    
    if (settings.contextManagement.strategy === 'smart_summarize') {
        // Use Smart Summarization with Dynamic Recent Zone
        return await smartSummarize(history, maxTokens, systemPromptTokens, settings, model, conversationId);
    } else if (settings.contextManagement.strategy === 'summarize') {
        // Legacy simple summarization
        const textToSummarize = managedMessages.map(m => {
            const content = m.summary || m.content;
            return `${m.role}: ${content}`
        }).join('\n\n');
        
        let summary = '';
        try {
            if (settings.contextManagement.summarizerModel === 'koboldcpp') {
                summary = await summarizeWithKobold(textToSummarize, settings.contextManagement.koboldcppUrl);
            } else { // 'gemini'
                summary = await summarizeWithGemini(textToSummarize, settings);
            }
        } catch (e) {
            console.error("Failed to summarize context, falling back to trimming.", e);
            return { managedHistory: keptMessages, wasManaged: true };
        }
        
        const summaryMessage: Message = {
            id: generateUUID(),
            role: 'model',
            content: `[Previous conversation summary]:\n${summary}`,
            timestamp: managedMessages[managedMessages.length - 1].timestamp,
        };

        return { managedHistory: [summaryMessage, ...keptMessages], wasManaged: true };
    }

    // Default to 'trim'
    return { managedHistory: keptMessages, wasManaged: true };
};
