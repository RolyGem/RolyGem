import type { Settings, Prompt } from '../types';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { getSettings } from '../services/db';
import { DEFAULT_PROMPTS } from '../constants';
import { log } from '../services/loggingService';

// --- API Key Penalty Box for Quota Management ---
const apiKeyPenaltyBox = new Map<string, number>();
const PENALTY_DURATION_MS = 60 * 1000; // 1 minute penalty

export const penalizeApiKey = (key: string) => {
    log('WARN', 'API_KEY_MANAGER', `Quota error on key ...${key.slice(-4)}. Adding to penalty box for ${PENALTY_DURATION_MS / 1000}s.`);
    apiKeyPenaltyBox.set(key, Date.now() + PENALTY_DURATION_MS);
};

export const getHealthyGeminiApiKeys = (settings: Settings): string[] => {
    const allKeys = getGeminiApiKeys(settings);
    const now = Date.now();

    const healthyKeys = allKeys.filter(key => {
        const expiry = apiKeyPenaltyBox.get(key);
        if (expiry && now < expiry) {
            log('WARN', 'API_KEY_MANAGER', `Key ending in ...${key.slice(-4)} is in penalty box. Skipping for ${Math.round((expiry - now) / 1000)}s.`);
            return false;
        }
        return true;
    });

    if (healthyKeys.length === 0 && allKeys.length > 0) {
        log('WARN', 'API_KEY_MANAGER', 'All keys are currently penalized. Using the full list as a fallback.');
        return allKeys;
    }
    
    return healthyKeys;
};
// --- END ---

/**
 * Helper function to get a prompt configuration from user settings, with fallback to defaults.
 * This ensures the user's customized prompts from the AI Prompts settings tab are always used.
 * @param promptId - The ID of the prompt to retrieve.
 * @param settings - Optional settings object. If not provided, will be fetched from the database.
 * @returns The prompt configuration (either user-customized or default).
 */
export const getPromptConfig = async (promptId: string, settings?: Settings): Promise<Prompt> => {
    const finalSettings = settings || await getSettings();
    
    // First, try to find the prompt in user's customized settings
    const userPrompt = finalSettings.prompts.find(p => p.id === promptId);
    if (userPrompt) {
        return userPrompt;
    }
    
    // Fallback to default if not found in user settings
    const defaultPrompt = DEFAULT_PROMPTS.find(p => p.id === promptId);
    if (!defaultPrompt) {
        throw new Error(`Prompt with ID "${promptId}" not found in user settings or defaults.`);
    }
    
    return defaultPrompt;
};

/**
 * Retrieves the list of Gemini API keys, prioritizing keys from the settings UI
 * and falling back to the process.env.API_KEY variable.
 * 
 * This centralized function ensures consistency across all services that need
 * access to Gemini API keys (AI service, embedding service, etc.)
 * 
 * @param settings The application settings.
 * @returns An array of API key strings.
 */
export const getGeminiApiKeys = (settings: Settings): string[] => {
    const uiKeys = settings.geminiApiKeys?.trim();
    if (uiKeys) {
        // Split by comma or newline, then trim and filter out empty strings.
        return uiKeys.split(/[\n,]+/).map(k => k.trim()).filter(Boolean);
    }
    const envKeys = process.env.API_KEY?.trim();
    if (envKeys) {
        return envKeys.split(/[\n,]+/).map(k => k.trim()).filter(Boolean);
    }
    return [];
};

/**
 * Adds a delay between API retry attempts to prevent rate limit exhaustion.
 * This implements a simple rate limiting mechanism.
 * 
 * @param ms Milliseconds to delay (default: 300ms)
 */
export const delayBetweenRetries = (ms: number = 300): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Wraps an async operation with a timeout to prevent indefinite waiting.
 * If the operation doesn't complete within the specified time, it throws an error.
 * 
 * @param promise The promise to wrap with timeout
 * @param timeoutMs Timeout in milliseconds (default: 120000ms = 2 minutes)
 * @param timeoutMessage Custom error message for timeout
 * @returns The result of the promise if it completes in time
 * @throws Error if the timeout is reached
 */
export const withTimeout = async <T>(
    promise: Promise<T>,
    timeoutMs: number = 120000, // Default: 2 minutes
    timeoutMessage: string = 'Operation timed out'
): Promise<T> => {
    let timeoutHandle: NodeJS.Timeout;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
            reject(new Error(timeoutMessage));
        }, timeoutMs);
    });

    try {
        const result = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timeoutHandle!);
        return result;
    } catch (error) {
        clearTimeout(timeoutHandle!);
        throw error;
    }
};

/**
 * Wraps a streaming API call with timeout support.
 * Since streams can't be easily cancelled, this monitors the stream
 * and throws an error if no data is received for too long.
 * 
 * @param streamGenerator Function that performs the streaming operation
 * @param timeoutMs Timeout in milliseconds for no data received
 * @returns Promise that resolves when streaming completes
 */
export const withStreamTimeout = async (
    streamGenerator: () => Promise<void>,
    timeoutMs: number = 120000 // Default: 2 minutes
): Promise<void> => {
    let lastChunkTime = Date.now();
    let isCompleted = false;
    let streamError: Error | null = null;

    // Start the stream
    const streamPromise = streamGenerator().then(() => {
        isCompleted = true;
    }).catch(error => {
        streamError = error;
        isCompleted = true;
    });

    // Monitor for timeout
    const checkTimeout = () => {
        if (isCompleted) return;
        
        const timeSinceLastChunk = Date.now() - lastChunkTime;
        if (timeSinceLastChunk > timeoutMs) {
            throw new Error('Stream timeout: No data received for too long');
        }
        
        setTimeout(checkTimeout, 1000); // Check every second
    };

    // Start monitoring
    setTimeout(checkTimeout, 1000);

    // Wait for stream to complete
    await streamPromise;
    
    if (streamError) {
        throw streamError;
    }
};

/**
 * Updates the last chunk time for stream timeout monitoring.
 * Call this function whenever a new chunk is received.
 */
export const updateStreamActivity = (() => {
    let lastChunkTime = Date.now();
    
    return {
        update: () => { lastChunkTime = Date.now(); },
        getLastTime: () => lastChunkTime,
        reset: () => { lastChunkTime = Date.now(); }
    };
})();

// --- Centralized Gemini API Calling Functions ---

const GENAI_SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

/**
 * Configuration for non-streaming Gemini API calls
 */
export interface GeminiCallConfig {
    model: string;
    contents: any;
    config?: any;
}

/**
 * Centralized function to call Gemini API with automatic retry, timeout, and rate limiting.
 * This function prioritizes API keys from Settings UI, then falls back to environment variables.
 * 
 * **Benefits:**
 * - Automatic retry with multiple API keys
 * - Rate limiting between retries
 * - Timeout protection
 * - Consistent behavior across all AI functions
 * - Backward compatible: settings parameter is optional
 * 
 * @param callConfig The Gemini API call configuration
 * @param settings Application settings containing API keys (optional - will be fetched if not provided)
 * @param timeoutMs Timeout in milliseconds (default: 60000ms = 1 minute)
 * @returns The API response
 * @throws Error if all API keys fail or timeout is reached
 */
export const callGeminiWithRetry = async (
    callConfig: GeminiCallConfig,
    settings?: Settings,
    timeoutMs: number = 60000 // Default: 1 minute for non-streaming
): Promise<any> => {
    // If settings not provided, fetch from database
    const finalSettings = settings || await getSettings();
    const keys = getHealthyGeminiApiKeys(finalSettings);
    if (keys.length === 0) {
        if (getGeminiApiKeys(finalSettings).length === 0) {
            throw new Error("No Gemini API Key provided. Please add one in Settings.");
        } else {
            throw new Error("All available Gemini API keys are temporarily rate-limited. Please wait a moment and try again.");
        }
    }

    let lastError: Error | null = null;

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        
        try {
            // Rate Limiting: Add delay between retry attempts (except for first attempt)
            if (i > 0) {
                log('INFO', 'API_RETRY', `Retrying with API key ${i + 1}/${keys.length}...`);
                await delayBetweenRetries(300); // 300ms delay
            }
            
            const ai = new GoogleGenAI({ apiKey: key });
            
            // Timeout Wrapper: Prevent indefinite waiting
            const response = await withTimeout(
                ai.models.generateContent({
                    model: callConfig.model,
                    contents: callConfig.contents,
                    config: {
                        ...callConfig.config,
                        safetySettings: callConfig.config?.safetySettings || GENAI_SAFETY_SETTINGS,
                    }
                }),
                timeoutMs,
                `Gemini API request timed out after ${timeoutMs / 1000} seconds`
            );
            
            // Success! Return the response
            return response;
        } catch (error: any) {
            lastError = error;
            log('WARN', 'API_FAIL', `Gemini API call failed with key ending in ...${key.slice(-4)}.`, { error: error.message });
            
            const isQuotaError = error?.message?.includes('429') || 
                                 error?.message?.includes('quota') ||
                                 error?.message?.includes('RESOURCE_EXHAUSTED');
            
            if (isQuotaError) {
                penalizeApiKey(key);
            }
            
            if (i === keys.length - 1) {
                throw lastError;
            }
        }
    }

    // This should never be reached, but just in case
    throw lastError || new Error("All Gemini API calls failed without a specific error.");
};

/**
 * Centralized function to stream from Gemini API with automatic retry, timeout, and rate limiting.
 * This function prioritizes API keys from Settings UI, then falls back to environment variables.
 * 
 * **Benefits:**
 * - Automatic retry with multiple API keys
 * - Rate limiting between retries
 * - Timeout protection
 * - Consistent behavior across all streaming AI functions
 * - Backward compatible: settings parameter is optional
 * 
 * @param callConfig The Gemini API call configuration
 * @param onChunk Callback function to handle each received chunk
 * @param settings Application settings containing API keys (optional - will be fetched if not provided)
 * @param timeoutMs Timeout in milliseconds (default: 60000ms = 1 minute)
 * @returns Promise that resolves when streaming completes
 * @throws Error if all API keys fail or timeout is reached
 */
export const streamGeminiWithRetry = async (
    callConfig: GeminiCallConfig,
    onChunk: (text: string) => void,
    settings?: Settings,
    timeoutMs: number = 60000 // Default: 1 minute for streaming
): Promise<void> => {
    // If settings not provided, fetch from database
    const finalSettings = settings || await getSettings();
    const keys = getHealthyGeminiApiKeys(finalSettings);
    if (keys.length === 0) {
        if (getGeminiApiKeys(finalSettings).length === 0) {
            throw new Error("No Gemini API Key provided. Please add one in Settings.");
        } else {
             throw new Error("All available Gemini API keys are temporarily rate-limited. Please wait a moment and try again.");
        }
    }

    let lastError: Error | null = null;

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        
        try {
            // Rate Limiting: Add delay between retry attempts (except for first attempt)
            if (i > 0) {
                log('INFO', 'API_RETRY', `Retrying stream with API key ${i + 1}/${keys.length}...`);
                await delayBetweenRetries(300); // 300ms delay
            }
            
            const ai = new GoogleGenAI({ apiKey: key });
            
            // Timeout Wrapper: Prevent indefinite waiting
            await withTimeout(
                (async () => {
                    const responseStream = await ai.models.generateContentStream({
                        model: callConfig.model,
                        contents: callConfig.contents,
                        config: {
                            ...callConfig.config,
                            safetySettings: callConfig.config?.safetySettings || GENAI_SAFETY_SETTINGS,
                        }
                    });

                    for await (const chunk of responseStream) {
                        if (chunk.text) {
                            onChunk(chunk.text);
                        }
                    }
                })(),
                timeoutMs,
                `Gemini streaming request timed out after ${timeoutMs / 1000} seconds`
            );
            
            // Success! Exit the retry loop
            return;
        } catch (error: any) {
            lastError = error;
            log('WARN', 'API_FAIL', `Gemini streaming failed with key ending in ...${key.slice(-4)}.`, { error: error.message });
            
            const isQuotaError = error?.message?.includes('429') || 
                                 error?.message?.includes('quota') ||
                                 error?.message?.includes('RESOURCE_EXHAUSTED');
            
            if (isQuotaError) {
                penalizeApiKey(key);
            }

            if (i === keys.length - 1) {
                throw lastError;
            }
        }
    }

    // This should never be reached, but just in case
    throw lastError || new Error("All Gemini streaming calls failed without a specific error.");
};