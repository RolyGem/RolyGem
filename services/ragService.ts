// Fix: Use HnswlibModule type from 'hnswlib-wasm' as HnswlibWasm is not an exported member.
import type { HnswlibModule } from 'hnswlib-wasm';
import type { Message, RagMemory, Settings } from '../types';
import { generateUUID } from '../utils/uuid.js';
import { getRagMetadataForCollection, saveRagMetadataForCollection, deleteRagMetadataForCollection } from './db';
import { enrichSceneForRag } from './ai/knowledgeManager';
import { generateEmbedding } from './ai/embeddingService';
import { countTokens } from './ai/contextManager';

const indexCache = new Map<string, { index: any; metadata: Map<number, RagMemory>; dimensions?: number }>();

// --- Instruction filtering helpers -----------------------------------------------------------

const INSTRUCTION_BLOCK_REGEX = /(?:^|\n)\s*\[(?:[^\]]*?(?:Instruction|System Note)[^\]]*?)\]:[\s\S]*?(?=\n\s*\n|$)/gi;
const INSTANT_LINE_REGEX = /^\s*Instant\s+(?:Directives|Instructions).*?(?=\n|$)/gim;

function stripTransientInstructionContent(text: string): string {
  if (!text) return '';
  let cleaned = text.replace(INSTRUCTION_BLOCK_REGEX, '\n\n');
  cleaned = cleaned.replace(INSTANT_LINE_REGEX, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned;
}

function sanitizeMessageContentForRag(text: string): string {
  if (!text) return '';
  const cleaned = stripTransientInstructionContent(text);
  return cleaned.trim();
}

// --- Sanitization helpers for safe, compact RAG injection ---
// These helpers transform raw turn text into short, background-only facts that
// are safe to inject into a system prompt for Gemini 2.5 Flash/Pro without
// triggering early blocking or recitation safeguards.

/**
 * Removes chat speaker prefixes and obvious control headers to reduce recitation risk.
 */
function stripSpeakerPrefixes(text: string): string {
  const withoutInstructions = stripTransientInstructionContent(text);
  return withoutInstructions
    .replace(/^\s*User\s*:\s*/gmi, '')
    .replace(/^\s*Model\s*:\s*/gmi, '')
    .replace(/^\s*Assistant\s*:\s*/gmi, '')
    .replace(/^\s*System\s*:\s*/gmi, '')
    .replace(/[\r\t]+/g, ' ');
}

/**
 * Splits text into candidate sentences across Latin and Arabic punctuation.
 */
function splitIntoSentences(text: string): string[] {
  // Normalize whitespace and trim
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  // Split on common sentence terminators including Arabic question mark
  const parts = normalized.split(/(?<=[\.!؟!?])\s+/);
  return parts.map(s => s.trim()).filter(Boolean);
}

/**
 * Produces short, safe bullet-like facts (background only). Keeps each line concise.
 */
function buildSanitizedFacts(fullTurnText: string, enrichedSummary?: string): string[] {
  const MAX_FACTS = 8;
  const MIN_LEN = 12;
  const MAX_LEN = 180;

  const candidates: string[] = [];

  // 1) Prefer sentences from the enrichment summary if present
  if (enrichedSummary && enrichedSummary.trim()) {
    const cleanedSummary = stripTransientInstructionContent(enrichedSummary);
    splitIntoSentences(cleanedSummary).forEach(s => candidates.push(s));
  }

  // 2) Add a few sentences from the raw turn (after stripping speaker prefixes)
  const stripped = stripSpeakerPrefixes(stripTransientInstructionContent(fullTurnText));
  splitIntoSentences(stripped).forEach(s => candidates.push(s));

  // 3) Clean and filter
  const cleaned = candidates
    .map(s => s
      .replace(/^["'“”«»]+|["'“”«»]+$/g, '') // trim quotes
      .replace(/\s+/g, ' ') // compress whitespace
      .trim()
    )
    .filter(s => s.length >= MIN_LEN && s.length <= MAX_LEN)
    .filter(s => !/^\[.*\]$/.test(s)) // drop bracket-only lines
    .filter(s => !/^User\s*:|^Model\s*:|^Assistant\s*:|^System\s*:/i.test(s))
    .filter(s => !/Instant\s+(?:Directives|Instructions)/i.test(s))
    .filter(s => !/Instruction For This Turn Only/i.test(s))
    .filter(s => !/System Note for this turn/i.test(s));

  // 4) Deduplicate while preserving order
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const s of cleaned) {
    const key = s.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(s);
    }
    if (unique.length >= MAX_FACTS) break;
  }

  return unique;
}
// Normalize an embedding to unit L2 norm to improve cosine-like ranking stability
function normalizeEmbedding(vec: number[]): number[] {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (!isFinite(norm) || norm === 0) return vec.slice();
  const out = new Array(vec.length);
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] / norm;
  return out;
}
let hnswlib: HnswlibModule | null = null;

// Helper function to promisify the callback-based syncFS function
const syncFsPromise = (fsManager: any, read: boolean): Promise<void> => {
    return new Promise((resolve, reject) => {
        fsManager.syncFS(read, (err?: Error) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

// Avoid concurrent syncFS operations which produce noisy warnings in Emscripten FS
let syncLock: Promise<void> | null = null;
const syncFsSerialized = async (fsManager: any, read: boolean): Promise<void> => {
  if (syncLock) {
    try { await syncLock; } catch { /* ignore previous error */ }
  }
  const p = syncFsPromise(fsManager, read);
  syncLock = p.finally(() => { syncLock = null; });
  return p;
};

// Persist index dimensions to safely re-open existing indexes across sessions
const getIndexDimsKey = (collectionName: string) => `rag:indexDims:${collectionName}`;
const saveIndexDimensions = (collectionName: string, dims: number) => {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(getIndexDimsKey(collectionName), String(dims)); } catch {}
};
const loadIndexDimensions = (collectionName: string): number | undefined => {
  try {
    if (typeof localStorage === 'undefined') return undefined;
    const v = localStorage.getItem(getIndexDimsKey(collectionName));
    if (!v) return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  } catch {
    return undefined;
  }
};

async function getHnswlib(): Promise<HnswlibModule> {
  if (!hnswlib) {
    const { loadHnswlib } = await import('hnswlib-wasm');
    hnswlib = await loadHnswlib();
    // Initial sync on load
    try {
      await syncFsSerialized(hnswlib.EmscriptenFileSystemManager, true);
    } catch (e) {
      console.warn('Could not sync filesystem on init:', e);
    }
  }
  return hnswlib;
}

/**
 * SMART CHUNKING STRATEGY
 * 
 * This function implements an improved chunking strategy that:
 * 1. Respects sentence boundaries (doesn't cut in the middle of sentences)
 * 2. Adds overlap between chunks for better context retention
 * 3. Maintains semantic coherence
 * 
 * @param text - The full text to chunk
 * @param maxChunkSize - Maximum size of each chunk in characters
 * @param overlapSize - Number of characters to overlap between chunks (default: 100)
 * @returns Array of text chunks
 */
function smartChunking(text: string, maxChunkSize: number, overlapSize: number = 100): string[] {
  // If text is shorter than maxChunkSize, return it as a single chunk
  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  
  // Split by common sentence delimiters while preserving them
  // This regex splits on: . ! ? followed by space or newline
  const sentenceEnders = /([.!?]+[\s\n]+)/g;
  const parts = text.split(sentenceEnders);
  
  // Reconstruct sentences with their delimiters
  const sentences: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    if (parts[i]) {
      const sentence = parts[i] + (parts[i + 1] || '');
      sentences.push(sentence);
    }
  }
  
  // If we couldn't split into sentences (no sentence delimiters), fall back to paragraph splitting
  if (sentences.length === 0 || sentences.length === 1) {
    const paragraphs = text.split(/\n\n+/);
    if (paragraphs.length > 1) {
      // Use paragraphs as sentences
      sentences.push(...paragraphs.map(p => p + '\n\n'));
    } else {
      // Last resort: split by newlines
      sentences.push(...text.split(/\n+/).map(p => p + '\n'));
    }
  }

  let currentChunk = '';
  let previousChunkEnd = ''; // Store the end of the previous chunk for overlap

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    
    // Check if adding this sentence would exceed the max size
    if ((currentChunk + sentence).length > maxChunkSize && currentChunk.length > 0) {
      // Save the current chunk
      chunks.push(currentChunk.trim());
      
      // Store the last portion for overlap
      previousChunkEnd = currentChunk.slice(-Math.min(overlapSize, currentChunk.length));
      
      // Start new chunk with overlap from previous chunk
      currentChunk = previousChunkEnd + sentence;
    } else {
      // Add sentence to current chunk
      currentChunk += sentence;
    }
  }

  // Add the last chunk if it's not empty
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  // Log chunking statistics for debugging
  console.log(`📊 Smart Chunking Stats:
  - Original text length: ${text.length} chars
  - Chunks created: ${chunks.length}
  - Avg chunk size: ${Math.round(chunks.reduce((sum, c) => sum + c.length, 0) / chunks.length)} chars
  - Overlap size: ${overlapSize} chars`);

  return chunks;
}

/**
 * REMOVED: estimateTokenCount replaced with accurate countTokens from tiktoken.
 * This ensures accurate token counting, especially for Arabic and other non-Latin scripts.
 * The function now uses OpenAI's tiktoken library (cl100k_base encoding) for precise token counts.
 */

async function loadIndex(collectionName: string, dimensions: number) {
  if (indexCache.has(collectionName)) return indexCache.get(collectionName)!;

  const hnswlibInstance = await getHnswlib();
  const indexFilename = `${collectionName}.idx`;
  
  // Prefer saved dimensions if available (when reopening an existing on-disk index)
  const savedDims = loadIndexDimensions(collectionName) || dimensions;
  const index = new hnswlibInstance.HierarchicalNSW('l2', savedDims, '');

  const metadataRecords = await getRagMetadataForCollection(collectionName);
  const metadata = new Map<number, RagMemory>();
  const idToLabelMap = new Map<string, number>();

  // Sort records by timestamp to ensure chronological order for index building
  metadataRecords.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  metadataRecords.forEach((record, idx) => {
    metadata.set(idx, record);
    idToLabelMap.set(record.id, idx);
  });
  
  // Check if file exists in virtual FS and load it
  if (hnswlibInstance.EmscriptenFileSystemManager.checkFileExists(indexFilename)) {
    console.log(`Loading index ${indexFilename} from virtual FS...`);
    try {
      // The maxElements parameter here is just for initialization, the actual size is determined by the loaded file.
      index.readIndex(indexFilename, metadataRecords.length + 100);
      // Improve recall for larger indexes
      if (typeof (index as any).setEf === 'function') {
        (index as any).setEf(Math.max(100, Math.min(400, (metadataRecords.length / 50) | 0))); // heuristic
      }
    } catch (e) {
      console.warn(`Failed to load index ${indexFilename}, initializing new one:`, e);
      index.initIndex(metadataRecords.length + 100, 16, 200, 100);
      if (typeof (index as any).setEf === 'function') {
        (index as any).setEf(200);
      }
    }
  } else {
    console.log(`Initializing new index for ${collectionName}...`);
    index.initIndex(metadataRecords.length + 100, 16, 200, 100);
    if (typeof (index as any).setEf === 'function') {
      (index as any).setEf(200);
    }
  }

  const result = { index, metadata, dimensions: savedDims };
  indexCache.set(collectionName, result);
  saveIndexDimensions(collectionName, savedDims);
  return result;
}

async function saveIndex(collectionName: string): Promise<void> {
  if (!indexCache.has(collectionName)) return;
  
  const { index, metadata } = indexCache.get(collectionName)!;
  const hnswlibInstance = await getHnswlib();
  const indexFilename = `${collectionName}.idx`;

  try {
    index.writeIndex(indexFilename);
    await syncFsSerialized(hnswlibInstance.EmscriptenFileSystemManager, false);
    await saveRagMetadataForCollection(collectionName, Array.from(metadata.values()));
    console.log(`Index ${indexFilename} and metadata saved.`);
  } catch (e) {
    console.error(`Failed to save index ${indexFilename}:`, e);
    throw e;
  }
}

export async function searchRelevantMemories(
  collectionName: string,
  query: string,
  settings: Settings,
  historyForContext: Message[],
  k: number = 5,
  maxTokens: number = 4000 // Maximum tokens for RAG context (configurable)
): Promise<RagMemory[]> {
  try {
    let [queryEmbedding] = await generateEmbedding([query], settings, 'RETRIEVAL_QUERY');
    if (!queryEmbedding) throw new Error("Failed to generate query embedding.");
    // Normalize query embedding for cosine-like ranking stability
    queryEmbedding = normalizeEmbedding(queryEmbedding);
    
    const dimensions = queryEmbedding.length;
    // Early guard: if known saved dims mismatch, skip to avoid throwing inside search
    const savedDims = loadIndexDimensions(collectionName);
    if (typeof savedDims === 'number' && savedDims !== dimensions) {
      console.warn(`�s��,? Dimension mismatch! Collection has ${savedDims}D embeddings, but query uses ${dimensions}D.`);
      console.warn(`dY'� Current model: ${settings.rag.embeddingEngine}. Collection was built with a different embedding model.`);
      return [];
    }
    
    // Check if collection exists and has compatible dimensions
    const existingMemories = await getRagMetadataForCollection(collectionName);
    if (existingMemories.length > 0) {
      // Check if there's cached index to verify dimensions
      const cachedData = indexCache.get(collectionName);
      if (cachedData && typeof cachedData.dimensions === 'number') {
        const indexDimensions = cachedData.dimensions;
        if (indexDimensions !== dimensions) {
          console.warn(`⚠️ Dimension mismatch! Collection has ${indexDimensions}D embeddings, but query uses ${dimensions}D.`);
          console.warn(`💡 Current model: ${settings.rag.embeddingEngine}. Collection was built with a different embedding model.`);
          console.warn(`🔄 Please rebuild the collection or switch to the original embedding model.`);
          return [];
        }
      }
    }
    
    const { index, metadata } = await loadIndex(collectionName, dimensions);
    
    // Check if index is properly initialized before accessing
    let numItems = 0;
    try {
      numItems = index.getCurrentCount();
    } catch (e) {
      console.warn('[RAG] Index not properly initialized or empty, returning empty results:', e);
      return [];
    }
    
    if (numItems === 0) {
      return [];
    }
  
    // Fetch more items than needed (e.g., 3x) to have a larger pool for re-ranking.
    const numToFetch = Math.min(k * 10, Math.max(10, numItems));
    let results;
    try {
      results = index.searchKnn(queryEmbedding, numToFetch, undefined);
    } catch (e) {
      console.warn('[RAG] Error during search, index may be corrupted:', e);
      return [];
    }
    
    // Only consider the very recent window to avoid over-filtering
    const recentWindow = 8;
    const recentMessageIds = new Set(historyForContext.slice(-recentWindow).map(m => m.id));

    // Get the memory objects along with their original L2 distance.
    const candidateMemories = results.neighbors.map((label: number, idx: number) => ({
        memory: metadata.get(label),
        distance: results.distances[idx],
    }))
    .filter((item): item is { memory: RagMemory; distance: number } => {
        if (!item.memory) return false;
        // Filter out memories that are already present in the short-term history context.
        // This prevents the AI from seeing the same message twice.
        const isAlreadyInContext = item.memory.sourceMessageIds?.every(id => recentMessageIds.has(id));
        return !isAlreadyInContext;
    });

    console.log(`[RAG] Candidates fetched: ${results.neighbors.length}, after filter: ${candidateMemories.length}`);

    if (candidateMemories.length === 0) {
        console.log('[RAG] No candidates after filtering — likely due to duplicate-in-context or low recall.');
        return [];
    }
    
    // Find min/max timestamps within the candidate pool for recency normalization.
    const timestamps = candidateMemories.map(c => c.memory.timestamp || 0);
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);
    const timestampRange = maxTimestamp - minTimestamp;

    // Re-rank the candidates based on a combined score of relevance, importance, and recency.
    const rerankedMemories = candidateMemories.map(item => {
        const { memory, distance } = item;
        
        // 1. Relevance Score (higher is better): Convert L2 distance to similarity.
        const relevance = 1 / (1 + distance);
        
        // 2. Importance Score (higher is better): Normalize from 1-10 scale to 0-1. Default to a neutral 5.
        const importance = ((memory.importance || 5) - 1) / 9;
        
        // 3. Recency Score (higher is better): Normalize timestamp within the current result set.
        const recency = timestampRange > 0
            ? ((memory.timestamp || 0) - minTimestamp) / timestampRange
            : 0;
            
        // 4. Combined Score with weighting: Emphasize relevance, but factor in importance and recency.
        const finalScore = (relevance * 0.6) + (importance * 0.3) + (recency * 0.1);
        
        return { ...memory, finalScore };
    });

    // Sort by the new combined score (descending)
    const sortedMemories = rerankedMemories.sort((a, b) => b.finalScore - a.finalScore);

    // **CONTEXT WINDOW MANAGEMENT**
    // Select memories within the token limit to avoid exceeding context window
    const selectedMemories: RagMemory[] = [];
    let totalTokens = 0;
    
    for (const memory of sortedMemories) {
      // Use accurate tiktoken-based counting instead of estimation
      const memoryTokens = await countTokens(memory.fullText);
      
      // Check if adding this memory would exceed the limit
      if (totalTokens + memoryTokens <= maxTokens) {
        selectedMemories.push(memory);
        totalTokens += memoryTokens;
        
        // Stop if we've reached the requested number of memories
        if (selectedMemories.length >= k) {
          break;
        }
      } else if (selectedMemories.length === 0) {
        // If the first memory is too large, truncate it to fit
        // Calculate approximate characters based on actual token ratio
        const avgCharsPerToken = memory.fullText.length / memoryTokens;
        const truncatedText = memory.fullText.substring(0, Math.floor(maxTokens * avgCharsPerToken));
        selectedMemories.push({ ...memory, fullText: truncatedText + '...' });
        console.warn(`[RAG] Memory truncated to fit context window (${memoryTokens} -> <= ${maxTokens} tokens)`);
        break;
      } else {
        // We've reached the token limit
        break;
      }
    }
    
    console.log(`📊 RAG Context Stats:
  - Memories retrieved: ${selectedMemories.length}/${sortedMemories.length}
  - Total tokens: ${totalTokens}/${maxTokens}
  - Token usage: ${Math.round((totalTokens / maxTokens) * 100)}%`);

    return selectedMemories;

  } catch (e) {
    console.error('Failed to search memories:', e);
    return [];
  }
}

export async function addMessagesToCollection(
  collectionName: string,
  messages: Message[],
  settings: Settings,
  chunkSize: number
): Promise<void> {
  if (messages.length === 0) return;

  try {
    const sanitizedTurns = messages
      .map(m => ({
        roleLabel: m.role === 'user' ? 'User' : 'Model',
        text: sanitizeMessageContentForRag(m.content || '')
      }))
      .filter(turn => turn.text.length > 0);

    if (sanitizedTurns.length === 0) {
        console.warn('Skipping RAG memory creation due to empty sanitized turn text.');
        return;
    }

    const fullTurnText = sanitizedTurns.map(turn => `${turn.roleLabel}: ${turn.text}`).join('\n\n');

    // 1. Enrich the entire turn's text once for consistent metadata across chunks.
    const enrichedData = await enrichSceneForRag(fullTurnText);
    const cleanSummary = enrichedData.summary ? sanitizeMessageContentForRag(enrichedData.summary) : '';
    if (!cleanSummary) {
        console.warn("Skipping RAG memory creation due to empty summary from enrichment.");
        return;
    }

    // Build compact, sanitized facts once for this scene. These will be attached to
    // each chunked memory for safe reuse during retrieval and prompt injection.
    const sceneFacts = buildSanitizedFacts(fullTurnText, cleanSummary);
    
    // 2. Split the full text into chunks using SMART CHUNKING strategy.
    // This preserves sentence boundaries and adds overlap for better context retention.
    const chunks: string[] = smartChunking(fullTurnText, chunkSize);

    if (chunks.length === 0) return;

    // 3. Get embeddings for each chunk of the *full text*.
    // This aligns the embedding content with the retrieval content.
    const embeddingsRaw = await generateEmbedding(chunks, settings, 'RETRIEVAL_DOCUMENT');
    const embeddings = embeddingsRaw.map(vec => normalizeEmbedding(vec));
    if (embeddings.length !== chunks.length) {
        throw new Error("Mismatch between chunks and generated embeddings.");
    }
    
    const dimensions = embeddings[0].length;
    const { index, metadata } = await loadIndex(collectionName, dimensions);
    
    const memoriesArray = Array.from(metadata.values());
    let lastMemory = memoriesArray.length > 0 ? memoriesArray.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0] : null;

    // 4. Create and add a separate, linked memory for each chunk.
    for (let i = 0; i < chunks.length; i++) {
        const chunkText = chunks[i];
        const embedding = embeddings[i];

        const newMemory: RagMemory = {
            id: generateUUID(),
            sourceMessageIds: messages.map(m => m.id),
            timestamp: messages[messages.length - 1].timestamp + i, // Increment to keep order
            fullText: chunkText, // The chunk IS the memory's primary text content
            summary: `Chunk ${i + 1}/${chunks.length} of a larger scene. Full scene summary: ${cleanSummary}`,
            // Precomputed, safe-to-inject facts (shared across chunks for this turn)
            sanitizedFacts: sceneFacts,
            tags: enrichedData.tags,
            importance: enrichedData.importance,
            relations: enrichedData.relations,
            mood: enrichedData.mood,
            previousMemoryId: lastMemory?.id,
        };

        const newLabel = index.getCurrentCount();
        if (newLabel >= index.getMaxElements()) {
            index.resizeIndex(index.getMaxElements() * 2);
        }
        index.addPoint(embedding, newLabel, false);
        metadata.set(newLabel, newMemory);

        // Link the previous chunk to this new one
        if (lastMemory) {
            const lastMemoryLabel = Array.from(metadata.entries()).find(([, mem]) => mem.id === lastMemory!.id)?.[0];
            if (lastMemoryLabel !== undefined) {
                const updatedLastMemory = { ...lastMemory, nextMemoryId: newMemory.id };
                metadata.set(lastMemoryLabel, updatedLastMemory);
            }
        }
        
        lastMemory = newMemory; // This chunk becomes the "last memory" for the next iteration
    }
    
    await saveIndex(collectionName);

  } catch (e) {
      console.error('Failed to add messages to RAG store:', e);
  }
}

export async function deleteCollection(collectionName: string): Promise<void> {
  try {
    const hnswlibInstance = await getHnswlib();
    const indexFilename = `${collectionName}.idx`;
    
    if (hnswlibInstance.EmscriptenFileSystemManager.checkFileExists(indexFilename)) {
      // Fix: The HnswlibModule type definition from 'hnswlib-wasm' is incomplete and does not include
      // the 'FS' property from the Emscripten runtime. Casting to 'any' allows us to access it.
      (hnswlibInstance as any).FS.unlink(indexFilename);
      await syncFsSerialized(hnswlibInstance.EmscriptenFileSystemManager, false);
    }
    
    await deleteRagMetadataForCollection(collectionName);
    indexCache.delete(collectionName);
    console.log(`Collection ${collectionName} deleted.`);
  } catch (e) {
    console.error(`Failed to delete collection ${collectionName}:`, e);
    throw e;
  }
}

export async function getAllMemories(collectionName: string): Promise<RagMemory[]> {
  try {
    return await getRagMetadataForCollection(collectionName);
  } catch (e) {
    console.warn('Failed to get all memories:', e);
    return [];
  }
}

export async function deleteMemories(collectionName: string, memoryIds: string[]): Promise<void> {
    if (memoryIds.length === 0) return;
    try {
        const allMemories = await getRagMetadataForCollection(collectionName);
        if (allMemories.length === 0) return;

        const memoryMap = new Map(allMemories.map(m => [m.id, m]));
        const memoryIdsToDelete = new Set(memoryIds);

        // Find the boundaries of the block being deleted
        const memoriesToDelete = memoryIds.map(id => memoryMap.get(id)).filter(Boolean) as RagMemory[];
        if (memoriesToDelete.length === 0) return;

        // Sort by timestamp to find the actual head and tail of the contiguous block
        memoriesToDelete.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        
        const head = memoriesToDelete[0];
        const tail = memoriesToDelete[memoriesToDelete.length - 1];

        const memoryBeforeId = head.previousMemoryId;
        const memoryAfterId = tail.nextMemoryId;

        // Create the new list of memories by filtering out the deleted ones
        let updatedMemories = allMemories.filter(m => !memoryIdsToDelete.has(m.id));

        // Find the boundary memories in the new list and re-link them
        if (memoryBeforeId) {
            const memoryBefore = updatedMemories.find(m => m.id === memoryBeforeId);
            if (memoryBefore) {
                memoryBefore.nextMemoryId = memoryAfterId;
            }
        }
        if (memoryAfterId) {
            const memoryAfter = updatedMemories.find(m => m.id === memoryAfterId);
            if (memoryAfter) {
                memoryAfter.previousMemoryId = memoryBeforeId;
            }
        }

        // Invalidate the cache and save the updated metadata list.
        // The vector index will have "dead" vectors, but this is acceptable. Rebuilding is complex.
        indexCache.delete(collectionName);
        await saveRagMetadataForCollection(collectionName, updatedMemories);
        
        console.log(`${memoryIdsToDelete.size} memory metadata entries removed.`);

    } catch (e) {
        console.error('Failed to delete memories:', e);
        throw e;
    }
}


export async function addMemory(
  collectionName: string,
  text: string,
  settings: Settings,
): Promise<void> {
  try {
    const sanitizedText = sanitizeMessageContentForRag(text);
    if (!sanitizedText) {
      console.warn('Skipping manual memory addition due to empty sanitized text.');
      return;
    }

    const enrichedData = await enrichSceneForRag(sanitizedText);
    const { summary, tags, importance, relations, mood } = enrichedData;
    const cleanSummary = summary ? sanitizeMessageContentForRag(summary) : undefined;
    const sceneFacts = buildSanitizedFacts(sanitizedText, cleanSummary);

    let [embedding] = await generateEmbedding([cleanSummary || sanitizedText], settings, 'RETRIEVAL_DOCUMENT');
    if (embedding) embedding = normalizeEmbedding(embedding);
    if (!embedding) throw new Error('Failed to generate embedding for new memory.');

    const dimensions = embedding.length;
    const { index, metadata } = await loadIndex(collectionName, dimensions);
    
    const memoriesArray = Array.from(metadata.values());
    const lastMemory = memoriesArray.length > 0 ? memoriesArray.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0] : null;

    const newMemory: RagMemory = {
        id: generateUUID(),
        timestamp: Date.now(),
        fullText: sanitizedText,
        summary: cleanSummary,
        sanitizedFacts: sceneFacts,
        tags,
        importance,
        relations,
        mood,
        previousMemoryId: lastMemory?.id,
    };
    
    const newLabel = index.getCurrentCount();
    if (newLabel >= index.getMaxElements()) {
        index.resizeIndex(index.getMaxElements() * 2);
    }
    index.addPoint(embedding, newLabel, false);
    metadata.set(newLabel, newMemory);

    if (lastMemory) {
        const lastMemoryLabel = Array.from(metadata.entries()).find(([, mem]) => mem.id === lastMemory.id)?.[0];
        if (lastMemoryLabel !== undefined) {
            lastMemory.nextMemoryId = newMemory.id;
            metadata.set(lastMemoryLabel, lastMemory);
        }
    }
    
    await saveIndex(collectionName);
  } catch (e) {
    console.error('Failed to add memory:', e);
    throw e;
  }
}

