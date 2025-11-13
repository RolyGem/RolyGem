import { log } from '../loggingService';
import type { Settings } from '../../types';

/**
 * OpenRouter Summarizer Service
 * Uses OpenRouter API for context summarization with various model options
 */

interface OpenRouterSummarizationRequest {
  text: string;
  retentionRate: number;
  model: Settings;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  error?: {
    message: string;
  };
}

/**
 * Summarize text using OpenRouter API
 * @param text - The text to summarize
 * @param retentionRate - Target retention rate (0.2 = 20%, 0.4 = 40%)
 * @param settings - Application settings containing API key
 * @returns Summarized text
 */
/**
 * Fetch available OpenRouter models
 */
export async function fetchOpenRouterModels(apiKey: string): Promise<any[]> {
  try {
    log('INFO', 'OPENROUTER', 'Fetching available models...');

    const response = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }

    const data = await response.json();
    log('INFO', 'OPENROUTER', `✓ Fetched ${data.data?.length || 0} models`);
    
    return data.data || [];
  } catch (error: any) {
    log('ERROR', 'OPENROUTER', `Failed to fetch models: ${error.message}`);
    throw error;
  }
}

export async function summarizeWithOpenRouter(
  text: string,
  retentionRate: number,
  settings: Settings
): Promise<string> {
  const apiKey = settings.openRouterApiKey;
  
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('OpenRouter API key not configured. Please add your API key in Settings.');
  }

  const modelId = settings.contextManagement.openRouterSummarizerModelId || 'google/gemini-flash-1.5';

  // Calculate target length
  const inputLength = text.length;
  const targetLength = Math.floor(inputLength * retentionRate);
  const targetTokens = Math.ceil(targetLength / 3); // Rough estimation: 1 token ≈ 3 chars

  // Build summarization prompt
  const systemPrompt = `You are a precise summarization assistant. Your task is to condense conversation history while preserving:
- Key plot points and story developments
- Character states, emotions, and relationships
- Important dialogue and interactions
- Scene settings and context
- Any significant events or decisions

Focus on factual content. Remove redundancy but keep essential narrative information.`;

  const userPrompt = `Summarize the following conversation to approximately ${Math.round(retentionRate * 100)}% of its original length (~${targetLength} characters).

Conversation:
${text}

Provide a comprehensive summary that captures all important information:`;

  try {
    log('INFO', 'OPENROUTER_SUMMARIZER', `Summarizing ${inputLength} chars to ~${targetLength} chars (${Math.round(retentionRate * 100)}%) using ${modelId}`);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://geminifutionchat.site',
        'X-Title': 'Gemini Fution Chat - Context Summarization'
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.3, // Low temperature for consistent, focused summaries
        max_tokens: Math.min(targetTokens, 4000), // Cap at 4000 tokens
        top_p: 0.9
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(errorData.error?.message || `OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    const data: OpenRouterResponse = await response.json();

    if (data.error) {
      throw new Error(`OpenRouter API error: ${data.error.message}`);
    }

    if (!data.choices || data.choices.length === 0) {
      throw new Error('OpenRouter returned no choices');
    }

    const summary = data.choices[0].message.content.trim();

    if (!summary || summary.length < 10) {
      throw new Error('OpenRouter returned empty or too short summary');
    }

    const compressionRatio = (summary.length / inputLength * 100).toFixed(1);
    log('INFO', 'OPENROUTER_SUMMARIZER', `✓ Summary: ${inputLength} → ${summary.length} chars (${compressionRatio}% compression)`);

    return summary;

  } catch (error: any) {
    log('ERROR', 'OPENROUTER_SUMMARIZER', `Summarization failed: ${error.message}`);
    throw error;
  }
}

/**
 * Test OpenRouter connection
 * @param apiKey - OpenRouter API key to test
 * @param modelId - Model ID to test with
 * @returns Success message or throws error
 */
export async function testOpenRouterConnection(apiKey: string, modelId?: string): Promise<string> {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('API key is required');
  }

  const testModel = modelId || 'google/gemini-flash-1.5';

  try {
    log('INFO', 'OPENROUTER_TEST', `Testing OpenRouter connection with ${testModel}...`);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://geminifutionchat.site',
      },
      body: JSON.stringify({
        model: testModel,
        messages: [
          {
            role: 'user',
            content: 'Respond with "OK" if you can read this.'
          }
        ],
        max_tokens: 10
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(errorData.error?.message || `Connection failed: ${response.status}`);
    }

    const data: OpenRouterResponse = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    log('INFO', 'OPENROUTER_TEST', '✓ OpenRouter connection successful');
    return 'Connected successfully to OpenRouter';

  } catch (error: any) {
    log('ERROR', 'OPENROUTER_TEST', `Connection test failed: ${error.message}`);
    throw error;
  }
}
