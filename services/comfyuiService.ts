import type { ComfyUISettings } from '../types';
import { convertImageToWebP } from './imageUtils';

// --- Helper Functions ---

const getObjectInfo = async (url: string) => {
    try {
        const res = await fetch(`${url}/object_info`);
        if (!res.ok) throw new Error(`Failed to fetch object info: ${res.statusText}`);
        return await res.json();
    } catch (e) {
        console.error("Could not fetch ComfyUI object info:", e);
        throw e;
    }
};

export const fetchAvailableComfyUIModels = async (url: string): Promise<{ checkpoints: string[], upscaleModels: string[], samplers: string[], schedulers: string[], loras: string[] }> => {
    const objectInfo = await getObjectInfo(url);

    const extractOptions = (input: any): string[] => {
        const result = new Set<string>();
        const traverse = (value: any) => {
            if (value == null) return;
            if (Array.isArray(value)) {
                value.forEach(traverse);
            } else if (typeof value === 'string') {
                const trimmed = value.trim();
                if (trimmed) result.add(trimmed);
            } else if (typeof value === 'object') {
                Object.values(value).forEach(traverse);
            }
        };
        traverse(input);
        return Array.from(result);
    };

    const checkpoints = extractOptions(objectInfo?.CheckpointLoaderSimple?.input?.required?.ckpt_name);
    const upscaleModels = extractOptions(objectInfo?.UpscaleModelLoader?.input?.required?.model_name);
    const samplers = extractOptions(objectInfo?.KSampler?.input?.required?.sampler_name);
    const schedulers = extractOptions(objectInfo?.KSampler?.input?.required?.scheduler);
    const loras = extractOptions(objectInfo?.LoraLoader?.input?.required?.lora_name);
    return { checkpoints, upscaleModels, samplers, schedulers, loras };
};


// --- Image Generation ---

const buildWorkflow = (prompt: string, settings: ComfyUISettings) => {
    const activeLoras = (settings.loras || []).filter(lora => lora && lora.enabled && lora.name);
    const triggerText = activeLoras
        .filter(lora => lora.includeTriggerInPrompt && lora.triggerPhrases)
        .map(lora => lora.triggerPhrases.trim())
        .filter(Boolean)
        .join(' ');
    const positivePrompt = [prompt, triggerText].filter(Boolean).join(' ').trim();
    const negativePrompt = settings.negativePrompt?.trim() || 'blurry, ugly, deformed';
    const seed = settings.seed === 0 ? Math.floor(Math.random() * 1_000_000_000) : settings.seed;

    const workflow: Record<string, any> = {
      "3": {
        "class_type": "KSampler",
        "inputs": {
          "seed": seed,
          "steps": settings.steps,
          "cfg": settings.cfg,
          "sampler_name": settings.sampler,
          "scheduler": settings.scheduler,
          "denoise": 1,
          "model": ["4", 0],
          "positive": ["6", 0],
          "negative": ["7", 0],
          "latent_image": ["5", 0]
        }
      },
      "4": {
        "class_type": "CheckpointLoaderSimple",
        "inputs": { "ckpt_name": settings.checkpoint }
      },
      "5": {
        "class_type": "EmptyLatentImage",
        "inputs": { "width": settings.width, "height": settings.height, "batch_size": 1 }
      },
      "6": {
        "class_type": "CLIPTextEncode",
        "inputs": { "text": positivePrompt, "clip": ["4", 1] }
      },
      "7": {
        "class_type": "CLIPTextEncode",
        "inputs": { "text": negativePrompt, "clip": ["4", 1] }
      },
      "8": {
        "class_type": "VAEDecode",
        "inputs": { "samples": ["3", 0], "vae": ["4", 2] }
      }
    };

    if (activeLoras.length > 0) {
        let modelNodeRef: [string, number] = ["4", 0];
        let clipNodeRef: [string, number] = ["4", 1];
        activeLoras.forEach((lora, index) => {
            const nodeId = `${20 + index}`;
            const modelStrength = Number.isFinite(lora.weight) ? Number(lora.weight) : 1;
            const clipStrength = Number.isFinite(lora.clipStrength) ? Number(lora.clipStrength) : modelStrength;
            workflow[nodeId] = {
                "class_type": "LoraLoader",
                "inputs": {
                    "model": modelNodeRef,
                    "clip": clipNodeRef,
                    "lora_name": lora.name,
                    "strength_model": Number(modelStrength),
                    "strength_clip": Number(clipStrength)
                }
            };
            modelNodeRef = [nodeId, 0];
            clipNodeRef = [nodeId, 1];
        });
        workflow["3"].inputs.model = modelNodeRef;
        workflow["6"].inputs.clip = clipNodeRef;
        workflow["7"].inputs.clip = clipNodeRef;
    }
    
    // Determine the image source node for saving
    const imageSourceNode = settings.enableUpscaler ? "11" : "8";
    
    if (settings.enableUpscaler) {
        workflow["10"] = {
            "class_type": "UpscaleModelLoader",
            "inputs": { "model_name": settings.upscaleModel }
        };
        workflow["11"] = {
            "class_type": "ImageUpscaleWithModel",
            "inputs": { "upscale_model": ["10", 0], "image": ["8", 0] }
        };
    }

    // Always save as PNG (WebP conversion happens in browser if needed)
    // ComfyUI WebP node option removed to avoid errors when node is not installed
    const saveNodeId = settings.enableUpscaler ? "12" : "9";
    const filenamePrefix = settings.enableUpscaler ? "GeminiFusion_Upscaled" : "GeminiFusion";
    
    workflow[saveNodeId] = {
        "class_type": "SaveImage",
        "inputs": { 
            "filename_prefix": filenamePrefix,
            "images": [imageSourceNode, 0]
        }
    };

    return workflow;
}


const queuePrompt = async (url: string, clientId: string, workflow: object): Promise<string> => {
    const body = { prompt: workflow, client_id: clientId };
    const res = await fetch(`${url}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Failed to queue prompt: ${await res.text()}`);
    const data = await res.json();
    if (data.error) throw new Error(`Error in prompt queue: ${JSON.stringify(data)}`);
    return data.prompt_id;
};

const getImageAsDataURL = async (url: string, filename: string): Promise<string> => {
    const res = await fetch(`${url}/view?filename=${encodeURIComponent(filename)}`);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export const generateImage = (
    prompt: string,
    settings: ComfyUISettings,
    onProgress: (progress: string) => void
): Promise<{ filename: string; dataUrl: string; }> => {
    return new Promise((resolve, reject) => {
        const workflow = buildWorkflow(prompt, settings);

        const socket = new WebSocket(`${settings.url.replace('http', 'ws')}/ws?clientId=${settings.clientId}`);
        
        socket.onopen = async () => {
            try {
                await queuePrompt(settings.url, settings.clientId, workflow);
            } catch (e) {
                reject(e);
                socket.close();
            }
        };

        socket.onmessage = async (event) => {
            const msg = JSON.parse(event.data);
            switch (msg.type) {
                case 'progress':
                    const { value, max } = msg.data;
                    const progressText = `Processing... ${Math.round((value / max) * 100)}%`;
                    onProgress(progressText);
                    break;
                case 'executed':
                    // Process the final SaveImage node
                    const nodeId = msg.data.node;
                    const isFinalNode = nodeId === "9" || nodeId === "12";
                    
                    if (isFinalNode) {
                        try {
                            const outputs = msg.data.output;
                            if (!outputs || !outputs.images || outputs.images.length === 0) {
                                throw new Error("Generation complete, but no image output was found in the final node.");
                            }
                            
                            const finalImage = outputs.images[0];
                            
                            // Fetch the image from ComfyUI
                            onProgress('Fetching image...');
                            const imageDataUrl = await getImageAsDataURL(settings.url, finalImage.filename);
                            
                            // Handle output format based on user preference
                            if (settings.outputFormat === 'original') {
                                // Return original PNG directly - fastest option
                                resolve({ filename: finalImage.filename, dataUrl: imageDataUrl });
                            } else if (settings.outputFormat === 'webp-browser' || settings.outputFormat === 'webp-comfyui') {
                                // Convert to WebP in browser
                                // Note: webp-comfyui now also uses browser conversion since the node is often not available
                                onProgress('Converting to WebP...');
                                try {
                                    const webpDataUrl = await convertImageToWebP(imageDataUrl, settings.webpQuality / 100);
                                    resolve({ filename: finalImage.filename, dataUrl: webpDataUrl });
                                } catch (err) {
                                    console.warn('WebP conversion failed, using original:', err);
                                    resolve({ filename: finalImage.filename, dataUrl: imageDataUrl });
                                }
                            } else {
                                // Fallback to original
                                resolve({ filename: finalImage.filename, dataUrl: imageDataUrl });
                            }
                        } catch (e) {
                            reject(e);
                        } finally {
                            socket.close();
                        }
                    }
                    break;
                case 'status':
                    onProgress(`Status: ${msg.data.status.exec_info.queue_remaining} remaining in queue.`);
                    break;
                 case 'executing':
                    if (msg.data.node) {
                        const nodeInfo = workflow[msg.data.node];
                        if (nodeInfo) {
                           onProgress(`Executing: ${nodeInfo.class_type}`);
                        }
                    }
                    break;
            }
        };

        socket.onerror = (err) => {
            console.error('WebSocket error:', err);
            reject(new Error('WebSocket connection failed. Ensure ComfyUI is running and the URL is correct.'));
            socket.close();
        };
    });
};
