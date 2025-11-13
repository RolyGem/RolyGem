import type { HuggingFaceSettings } from '../types';

const HUB_API_URL = 'https://huggingface.co/api/models';
const INFERENCE_API_URL = 'https://api-inference.huggingface.co/models';

interface HFModel {
    id: string;
}

// Function to add delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * List of verified working models on Hugging Face Inference API
 * Updated: October 2025
 * Note: Some popular models like SD3 and Flux have disabled free Inference API
 */
const VERIFIED_WORKING_MODELS = [
    'stabilityai/stable-diffusion-xl-base-1.0',
    'runwayml/stable-diffusion-v1-5',
    'prompthero/openjourney',
    'prompthero/openjourney-v4',
    'CompVis/stable-diffusion-v1-4',
    'stabilityai/stable-diffusion-2-1',
    'dreamlike-art/dreamlike-photoreal-2.0',
    'dreamlike-art/dreamlike-diffusion-1.0',
    'wavymulder/Analog-Diffusion',
    'Fictiverse/Stable_Diffusion_PaperCut_Model',
    'nitrosocke/Nitro-Diffusion',
    'gsdf/Counterfeit-V2.5',
    'Lykon/DreamShaper',
    'SG161222/Realistic_Vision_V2.0',
    'digiplay/AbsoluteReality_v1.8.1'
];

export const fetchAvailableHFModels = async (apiKey: string): Promise<string[]> => {
    if (!apiKey) {
        throw new Error("Hugging Face API Key is required.");
    }
    try {
        const response = await fetch(`${HUB_API_URL}?pipeline_tag=text-to-image&sort=likes&direction=-1&limit=100`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch Hugging Face models: ${response.statusText}`);
        }
        const data: HFModel[] = await response.json();
        const fetchedModels = data.map(model => model.id);
        
        // Merge verified models with fetched models, prioritizing verified ones
        const uniqueModels = [...new Set([...VERIFIED_WORKING_MODELS, ...fetchedModels])];
        return uniqueModels;
    } catch (error) {
        console.error("Error fetching Hugging Face models:", error);
        // Return verified working models as fallback
        return VERIFIED_WORKING_MODELS;
    }
};

export const generateImage = async (
    prompt: string,
    settings: HuggingFaceSettings,
    onProgress: (progress: string) => void
): Promise<string> => {
    onProgress('Preparing request...');
    const payload = {
        inputs: prompt,
        parameters: {
            negative_prompt: settings.negativePrompt,
            num_inference_steps: settings.steps,
            guidance_scale: settings.guidanceScale
        }
    };

    const modelUrl = `${INFERENCE_API_URL}/${settings.model}`;
    
    const makeRequest = async () => {
        return fetch(modelUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${settings.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
    };

    let response = await makeRequest();

    // Handle 404 - Model not found or API disabled
    if (response.status === 404) {
        throw new Error(
            `❌ Model "${settings.model}" is not available.\n\n` +
            `Possible reasons:\n` +
            `• The model's Inference API has been disabled (common for SD3, Flux, etc.)\n` +
            `• The model has been moved or deleted\n` +
            `• The model requires special access/permissions\n\n` +
            `✅ Solution: Please select a different model from the verified working list.`
        );
    }

    // Handle 403 - Access forbidden (gated models)
    if (response.status === 403) {
        throw new Error(
            `🔒 Access denied to model "${settings.model}".\n\n` +
            `This is a gated model that requires:\n` +
            `• Accepting the model's license agreement on Hugging Face\n` +
            `• Using an API key with proper permissions\n\n` +
            `Visit: https://huggingface.co/${settings.model}`
        );
    }

    // Handle model loading state (503 error)
    if (response.status === 503) {
        const errorData = await response.json();
        const estimatedTime = errorData.estimated_time || 30; // Default wait time
        onProgress(`Model is loading... (ETA: ${Math.round(estimatedTime)}s)`);

        let waitTime = estimatedTime;
        while (waitTime > 0) {
            await delay(5000); // Poll every 5 seconds
            waitTime -= 5;
            onProgress(`Model is loading... (ETA: ${Math.round(waitTime)}s)`);
            response = await makeRequest();
            if (response.ok) break; // Model is ready
            if (response.status === 404) {
                throw new Error(
                    `❌ Model "${settings.model}" became unavailable during loading.\n` +
                    `Please select a different model from the verified working list.`
                );
            }
            if (response.status !== 503) { // Another error occurred
                 throw new Error(`Hugging Face API error: ${response.statusText} - ${await response.text()}`);
            }
        }
    }
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
            `Hugging Face API error (${response.status}): ${response.statusText}\n` +
            `Model: ${settings.model}\n` +
            `Details: ${errorText}`
        );
    }

    onProgress('Downloading image...');
    const blob = await response.blob();
    
    // Convert blob to data URL
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};
