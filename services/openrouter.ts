import type { Model } from '../types';

interface OpenRouterModel {
  id: string;
  name: string;
  context_length?: number;
  architecture?: {
    modality?: string; // e.g., "text+image->text"
    input_modalities?: string[]; // e.g., ["text", "image"]
    output_modalities?: string[];
  }
}

// CONVERTED: contextLength is now in tokens.
const FALLBACK_MODELS: Model[] = [
    { id: 'google/gemini-pro', name: 'Gemini Pro (Fallback)', provider: 'OpenRouter', contextLengthTokens: 32768, supportsImageInput: false },
    { id: 'google/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite (Fallback)', provider: 'OpenRouter', contextLengthTokens: 32768, supportsImageInput: false },
    { id: 'anthropic/claude-3-haiku-20240307', name: 'Claude 3 Haiku (Fallback)', provider: 'OpenRouter', contextLengthTokens: 200000, supportsImageInput: false },
    { id: 'mistralai/mistral-7b-instruct-v0.2', name: 'Mistral 7B (Fallback)', provider: 'OpenRouter', contextLengthTokens: 32768, supportsImageInput: false },
];

export const fetchOpenRouterModels = async (): Promise<Model[]> => {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        "HTTP-Referer": "https://app.geminifutionchat.site/",
        "X-Title": "RolyGem",
      }
    });
    if (!response.ok) {
      console.error(`Failed to fetch OpenRouter models: ${response.statusText}`);
      return FALLBACK_MODELS;
    }
    const data: { data: OpenRouterModel[] } = await response.json();
    
    // Sort models alphabetically by name
    const sortedModels = data.data.sort((a, b) => a.name.localeCompare(b.name));

    return sortedModels.map(model => {
      const modalities = model.architecture?.input_modalities || [];
      const outputModalities = model.architecture?.output_modalities || [];
      const modalityString = model.architecture?.modality || '';
      const modelName = model.name.toLowerCase();
      const modelId = model.id.toLowerCase();
      
      const supportsImageInput = modalities.includes('image') || /image/.test(modalityString);
      const supportsAudio = modalities.includes('audio') || outputModalities.includes('audio') || /audio/.test(modalityString);
      
      // Detect thinking/reasoning models (o1, o3, deep-think, reasoning models, etc.)
      const supportsThinking = /\b(o1|o3|reasoning|think|deep-think|pro-thinking)\b/i.test(modelName) || 
                               /\b(o1|o3|reasoning|think)\b/i.test(modelId);
      
      return {
        id: model.id,
        name: model.name,
        provider: 'OpenRouter',
        contextLengthTokens: model.context_length,
        supportsImageInput,
        supportsAudio,
        supportsThinking,
      } as Model;
    });
  } catch (error) {
    console.error("Error fetching or parsing OpenRouter models:", error);
    return FALLBACK_MODELS;
  }
};
