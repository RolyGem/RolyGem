import type { Settings } from '../../types';

/**
 * OpenAI Embedding Service via OpenRouter
 * Supports text-embedding-3-small (1536 dims) and text-embedding-3-large (3072 dims)
 */

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface OpenAIEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Generate embeddings using OpenAI models via OpenRouter
 * @param texts - Array of text strings to embed
 * @param settings - Application settings containing API keys
 * @param modelType - 'small' for text-embedding-3-small or 'large' for text-embedding-3-large
 */
export const generateOpenAIEmbedding = async (
  texts: string[],
  settings: Settings,
  modelType: 'small' | 'large' = 'small'
): Promise<number[][]> => {
  if (!texts || texts.length === 0) {
    throw new Error("No texts provided for embedding");
  }

  // Get OpenRouter API key
  const apiKey = settings.openRouterApiKey;
  if (!apiKey) {
    throw new Error("OpenRouter API key not configured. Please add it in Settings > API Keys.");
  }

  // Determine which model to use
  const modelName = modelType === 'large' 
    ? 'openai/text-embedding-3-large'
    : 'openai/text-embedding-3-small';
  
  const expectedDimensions = modelType === 'large' ? 3072 : 1536;

  console.log(`📤 Requesting ${texts.length} embeddings from ${modelName} via OpenRouter`);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'RolyGem'

      },
      body: JSON.stringify({
        model: modelName,
        input: texts
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }

    const data: OpenAIEmbeddingResponse = await response.json();

    // Validate response
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error("Invalid response format from OpenRouter");
    }

    if (data.data.length !== texts.length) {
      throw new Error(`Expected ${texts.length} embeddings but got ${data.data.length}`);
    }

    // Sort by index and extract embeddings
    const embeddings = data.data
      .sort((a, b) => a.index - b.index)
      .map(item => item.embedding);

    // Validate dimensions
    if (embeddings[0] && embeddings[0].length !== expectedDimensions) {
      console.warn(`⚠️ Expected ${expectedDimensions} dimensions but got ${embeddings[0].length}`);
    }

    console.log(`✓ Successfully generated ${embeddings.length} embeddings (${embeddings[0]?.length || 0} dimensions)`);
    
    return embeddings;
  } catch (error: any) {
    console.error(`❌ OpenAI embedding generation failed:`, error);
    throw error;
  }
};

/**
 * Test OpenAI embedding connection
 */
export const testOpenAIEmbeddingConnection = async (
  settings: Settings,
  modelType: 'small' | 'large' = 'small'
): Promise<boolean> => {
  try {
    const testText = ["connection test"];
    await generateOpenAIEmbedding(testText, settings, modelType);
    console.log(`✓ OpenAI ${modelType} embedding connection test successful`);
    return true;
  } catch (error: any) {
    console.error(`❌ OpenAI ${modelType} embedding connection test failed:`, error);
    throw error;
  }
};
