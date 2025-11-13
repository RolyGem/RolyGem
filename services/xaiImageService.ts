import type { Settings } from '../types';

const XAI_IMAGE_API_URL = 'https://api.x.ai/v1/images/generations';

/**
 * Generate an image using XAI's Grok image generation API
 * Model: grok-2-image-1212
 * 
 * @param prompt - The text prompt describing the image to generate
 * @param settings - Application settings containing the XAI API key
 * @param onProgress - Callback function to report progress updates
 * @returns Promise<string> - Data URL of the generated image
 */
export const generateImage = async (
    prompt: string,
    settings: Settings,
    onProgress: (progress: string) => void
): Promise<string> => {
    if (!settings.xaiApiKey) {
        throw new Error("XAI API Key is not configured. Please add your API key in Settings.");
    }

    onProgress('Preparing request...');

    const payload = {
        model: 'grok-2-image-1212',
        prompt: prompt,
        n: 1, // Number of images to generate
        response_format: 'b64_json' // Request base64 encoded image
    };

    try {
        onProgress('Sending request to XAI...');

        const response = await fetch(XAI_IMAGE_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${settings.xaiApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `XAI Image API error (${response.status}): ${response.statusText}`;
            
            try {
                const errorJson = JSON.parse(errorText);
                const message = errorJson.error?.message || errorText;
                errorMessage = `XAI Image API error: ${message}`;
            } catch (e) {
                errorMessage = `XAI Image API error (${response.status}): ${errorText}`;
            }

            throw new Error(errorMessage);
        }

        onProgress('Processing image...');

        const data = await response.json();

        // XAI returns an array of images
        if (!data.data || data.data.length === 0) {
            throw new Error('No image data returned from XAI API');
        }

        const imageData = data.data[0];

        // Convert base64 to data URL
        if (imageData.b64_json) {
            onProgress('Image ready!');
            return `data:image/jpeg;base64,${imageData.b64_json}`;
        } else if (imageData.url) {
            // If URL is provided instead of base64, fetch and convert
            onProgress('Downloading image...');
            const imageResponse = await fetch(imageData.url);
            const blob = await imageResponse.blob();
            
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } else {
            throw new Error('Invalid image data format from XAI API');
        }

    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error(`Failed to generate image: ${String(error)}`);
    }
};
