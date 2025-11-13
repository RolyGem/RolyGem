import type { StableDiffusionSettings } from '../types';
import { convertImageToWebP } from './imageUtils';

const fetchApi = async (url: string, path: string, options: RequestInit = {}) => {
    try {
        const res = await fetch(`${url}${path}`, options);
        if (!res.ok) throw new Error(`API request to ${path} failed: ${res.statusText}`);
        return await res.json();
    } catch (e) {
        console.error(`Error fetching from SD WebUI API path ${path}:`, e);
        throw e;
    }
};

// Function to check ADetailer extension status
export const checkADetailerStatus = async (url: string) => {
    try {
        // Check if ADetailer extension is loaded by checking extensions endpoint
        const extensionsData = await fetchApi(url, '/sdapi/v1/extensions');
        const adetailerExtension = extensionsData?.find((ext: any) => 
            ext.name?.toLowerCase().includes('adetailer') || 
            ext.title?.toLowerCase().includes('adetailer')
        );
        
        if (adetailerExtension) {
            console.log('✅ ADetailer extension found:', adetailerExtension.name || adetailerExtension.title);
            return { installed: true, extension: adetailerExtension };
        } else {
            console.warn('❌ ADetailer extension not found in extensions list');
            return { installed: false, extension: null };
        }
    } catch (error) {
        console.warn('⚠️ Could not check extensions status:', error);
        return { installed: false, extension: null };
    }
};

export const fetchAvailableSDModels = async (url: string): Promise<{
    checkpoints: string[];
    samplers: string[];
    upscalers: string[];
    faceRestorers: string[];
    schedulers: string[];
    adModels: string[];
    vaes: string[];
    loras: { name: string; alias?: string }[];
}> => {
    // Check ADetailer extension status first
    const adetailerStatus = await checkADetailerStatus(url);
    
    // Fetch core models in parallel
    const [
        checkpointList,
        samplerList,
        upscalerList,
        faceRestorerList,
        schedulerData,
        vaeData,
        loraData
    ] = await Promise.all([
        fetchApi(url, '/sdapi/v1/sd-models').then(data => data.map((m: any) => m.title)),
        fetchApi(url, '/sdapi/v1/samplers').then(data => data.map((s: any) => s.name)),
        fetchApi(url, '/sdapi/v1/upscalers').then(data => data.map((u: any) => u.name)),
        fetchApi(url, '/sdapi/v1/face-restorers').then(data => data.map((f: any) => f.name)),
        fetchApi(url, '/sdapi/v1/schedulers').catch(() => null),
        fetchApi(url, '/sdapi/v1/sd-vae').catch(() => null),
        fetchApi(url, '/sdapi/v1/loras').catch(() => []),
    ]);
    const checkpoints: string[] = (checkpointList || []) as string[];
    const samplers: string[] = (samplerList || []) as string[];
    const upscalers: string[] = (upscalerList || []) as string[];
    const faceRestorers: string[] = (faceRestorerList || []) as string[];
    const schedulerDataAny = schedulerData as any;
    const schedulerList: string[] = (() => {
        const fallback = ['Automatic', 'Karras', 'Exponential', 'Polyexponential'];
        if (!schedulerDataAny) return fallback;
        const raw = Array.isArray(schedulerDataAny?.schedulers) ? schedulerDataAny.schedulers : Array.isArray(schedulerDataAny) ? schedulerDataAny : [];
        const names = raw
            .map((item: any) => {
                if (!item) return null;
                if (typeof item === 'string') return item;
                if (typeof item === 'object') return item.name || item.title || item.id;
                return null;
            })
            .filter((value: any): value is string => typeof value === 'string' && value.trim().length > 0);
        const combined = names.length > 0 ? names : fallback;
        if (!combined.includes('Automatic')) combined.unshift('Automatic');
        return Array.from(new Set(combined.map(name => name.trim())));
    })();

    const gatherVaeNames = new Set<string>();
    const addVaeCandidate = (entry: any) => {
        if (!entry) return;
        if (Array.isArray(entry)) {
            entry.forEach(addVaeCandidate);
            return;
        }
        if (typeof entry === 'string') {
            if (entry.trim()) gatherVaeNames.add(entry.trim());
            return;
        }
        if (typeof entry === 'object') {
            const possibleKeys = ['name', 'title', 'model_name'];
            possibleKeys.forEach(key => {
                const value = entry[key];
                if (typeof value === 'string' && value.trim()) {
                    gatherVaeNames.add(value.trim());
                }
            });
        }
    };

    if (vaeData) {
        addVaeCandidate((vaeData as any)?.vae_list);
        addVaeCandidate((vaeData as any)?.list);
        addVaeCandidate((vaeData as any)?.candidates);
        addVaeCandidate((vaeData as any)?.vaes);
        addVaeCandidate((vaeData as any)?.items);
    }

    const vaes: string[] = Array.from(new Set(['Automatic', 'None', ...Array.from(gatherVaeNames)]));

    const normalizeLora = (item: any): { name: string; alias: string } | null => {
        if (!item) return null;
        if (typeof item === 'string') {
            return { name: item, alias: '' };
        }
        const name = item?.name || item?.lora_name || item?.model_name || '';
        if (!name) return null;
        const alias = item?.alias || item?.nickname || item?.display_name || '';
        return { name, alias };
    };

    const rawLoraList = Array.isArray((loraData as any)?.loras) ? (loraData as any).loras
        : Array.isArray(loraData) ? loraData
        : [] as any[];
    const loras: { name: string; alias: string }[] = rawLoraList
        .map(normalizeLora)
        .filter((item): item is { name: string; alias: string } => !!item && !!item.name);
    
    // Attempt to fetch ADetailer models from multiple known endpoints
    let adModels: string[] = [];
    const adModelEndpoints = [
        '/adetailer/v1/ad_models',
        '/adetailer/v1/models', 
        '/sdapi/v1/adetailer/models',
        '/extensions/adetailer/models',
        '/api/v1/adetailer/models'
    ];

    for (const endpoint of adModelEndpoints) {
        try {
            const adModelData = await fetchApi(url, endpoint);
            // Check for multiple possible response structures
            let models = adModelData?.ad_model || adModelData?.models || adModelData?.adetailer_models;
            
            // Handle case where models might be nested deeper
            if (!models && adModelData?.data) {
                models = adModelData.data.models || adModelData.data;
            }
            
            // Handle direct array response
            if (!models && Array.isArray(adModelData)) {
                models = adModelData;
            }
            
            if (Array.isArray(models) && models.length > 0) {
                adModels = models;
                console.log(`✅ Successfully fetched ${models.length} ADetailer models from ${endpoint}`);
                break;
            }
        } catch (error) {
            console.warn(`❌ Attempt to fetch ADetailer models from ${endpoint} failed. Trying next...`);
        }
    }

    // If no models found, provide diagnostic information and fallback
    if (adModels.length === 0) {
        if (!adetailerStatus.installed) {
            console.error('❌ ADetailer extension is not installed or not loaded!');
            console.log('💡 To fix this issue:');
            console.log('   1. Install ADetailer extension from: https://github.com/Bing-su/adetailer');
            console.log('   2. Restart SD WebUI after installation');
            console.log('   3. Make sure SD WebUI is running with --api flag');
        } else {
            console.warn('⚠️ ADetailer extension is installed but models could not be fetched.');
            console.log('💡 This could mean:');
            console.log('   1. ADetailer extension version is incompatible');
            console.log('   2. API endpoints have changed in newer versions');
            console.log('   3. Models are not properly downloaded');
        }
        
        console.warn('📋 Using default fallback models list.');
        
        // Provide common default models as fallback
        adModels = [
            'None',
            'face_yolov8m.pt',
            'face_yolov8n.pt',
            'face_yolov8n_v2.pt',
            'face_yolov8s.pt',
            'face_yolov9c.pt',
            'hand_yolov8n.pt',
            'hand_yolov8s.pt',
            'hand_yolov9c.pt',
            'person_yolov8m-seg.pt',
            'person_yolov8n-seg.pt',
            'person_yolov8s-seg.pt'
        ];
    }


    return { checkpoints, samplers, upscalers, faceRestorers, schedulers: schedulerList, adModels, vaes, loras };
};

const pollProgress = (url: string, onProgress: (progress: string) => void, signal: AbortSignal): Promise<void> => {
    return new Promise((resolve, reject) => {
        const interval = setInterval(async () => {
            if (signal.aborted) {
                clearInterval(interval);
                return reject(new DOMException('Aborted', 'AbortError'));
            }
            try {
                const progressData = await fetchApi(url, '/sdapi/v1/progress?skip_current_image=false');
                if (progressData.state.job_count === 0 && progressData.progress === 0) {
                     clearInterval(interval);
                     resolve();
                     return;
                }
                const progress = progressData.progress * 100;
                const eta = progressData.eta_relative.toFixed(1);
                let progressText = `Processing... ${progress.toFixed(0)}%`;
                if (eta > 0) {
                    progressText += ` (ETA: ${eta}s)`;
                }
                onProgress(progressText);

                if (progress >= 100 || (progressData.state.job_count === 0 && progress === 0)) {
                    clearInterval(interval);
                    resolve();
                }

            } catch (e) {
                // Ignore poll errors, the main request will handle it
            }
        }, 500);
    });
};

export const generateImage = async (
    prompt: string,
    settings: StableDiffusionSettings,
    onProgress: (progress: string) => void
): Promise<string> => {
    onProgress('Building payload...');
    const activeLoras = (settings.loras || []).filter(lora => lora && lora.enabled && lora.name);
    let finalPrompt = prompt?.trim() || '';

    const loraTriggerText = activeLoras
        .filter(lora => lora.includeTriggerInPrompt && lora.triggerPhrases)
        .map(lora => lora.triggerPhrases.trim())
        .filter(Boolean)
        .join(' ');

    if (loraTriggerText) {
        finalPrompt = `${finalPrompt} ${loraTriggerText}`.trim();
    }

    const loraTokens = activeLoras
        .map(lora => {
            const weight = Number.isFinite(lora.weight) ? Number(lora.weight).toFixed(2) : '1.00';
            return `<lora:${lora.name}:${weight}>`;
        })
        .join(' ');

    if (loraTokens) {
        finalPrompt = `${finalPrompt} ${loraTokens}`.trim();
    }

    const overrideSettings: Record<string, unknown> = {
        sd_model_checkpoint: settings.checkpoint,
    };

    const selectedVae = settings.vae?.trim();
    if (selectedVae && selectedVae !== 'Automatic') {
        overrideSettings.sd_vae = selectedVae === 'None' ? 'None' : selectedVae;
    }

    const negativePrompt = settings.negativePrompt?.trim() || 'blurry, ugly, deformed, worst quality, low quality';

    const payload: any = {
        prompt: finalPrompt,
        negative_prompt: negativePrompt,
        sampler_name: settings.sampler,
        steps: settings.steps,
        cfg_scale: settings.cfg,
        width: settings.width,
        height: settings.height,
        seed: settings.seed,
        override_settings: overrideSettings,
    };

    if (settings.scheduler && settings.scheduler.trim() && settings.scheduler !== 'Automatic') {
        payload.scheduler = settings.scheduler.trim();
    }

    if (settings.refiner && settings.refiner.trim()) {
        payload.refiner_checkpoint = settings.refiner.trim();
        if (typeof settings.refinerSwitchAt === 'number' && !Number.isNaN(settings.refinerSwitchAt)) {
            const clamped = Math.min(Math.max(settings.refinerSwitchAt, 0), 1);
            payload.refiner_switch_at = Number(clamped.toFixed(2));
        }
    }

    if (settings.faceRestoration) {
        payload.restore_faces = true;
        payload.override_settings.face_restoration_model = settings.faceRestoration;
    } else {
        payload.restore_faces = false;
    }

    if (settings.enableHiresFix) {
        payload.enable_hr = true;
        payload.hr_upscaler = settings.hiresUpscaler;
        payload.hr_second_pass_steps = settings.hiresSteps;
        payload.denoising_strength = settings.hiresDenoisingStrength;
        payload.hr_scale = settings.hiresUpscaleBy;
    }
    
    const enabledAdUnits = settings.adUnits.filter(unit => unit.enabled && unit.model && unit.model !== 'None');
    if (enabledAdUnits.length > 0) {
        const adetailerArgs = enabledAdUnits.map(unit => {
            const args: Record<string, unknown> = {
                ad_model: unit.model,
                ad_prompt: unit.prompt || '',
                ad_negative_prompt: unit.negativePrompt || '',
                ad_confidence: unit.confidence,
                ad_mask_min_ratio: unit.maskMinRatio,
                ad_mask_max_ratio: unit.maskMaxRatio,
                ad_dilate_erode: unit.dilateErode,
                ad_inpaint_only_masked: unit.inpaintOnlyMasked,
                ad_inpaint_only_masked_padding: unit.inpaintPadding,
                ad_inpaint_padding: unit.inpaintPadding,
                ad_use_separate_steps: unit.useSeparateSteps,
                ad_steps: unit.steps,
                ad_use_separate_cfg_scale: unit.useSeparateCfgScale,
                ad_cfg_scale: unit.cfgScale,
            };

            return args;
        });
        
        payload.alwayson_scripts = {
            "ADetailer": {
                "args": adetailerArgs
            }
        };
    }
    
    onProgress('Sending request to SD WebUI...');
    const controller = new AbortController();
    const progressPromise = pollProgress(settings.url, onProgress, controller.signal);

    try {
        const response = await fetchApi(settings.url, '/sdapi/v1/txt2img', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        controller.abort();
        await progressPromise.catch(() => {});

        if (!response.images || response.images.length === 0) {
            throw new Error('API did not return any images.');
        }

        const pngDataUrl = `data:image/png;base64,${response.images[0]}`;
        
        // Handle output format based on user preference
        if (settings.outputFormat === 'original') {
            // Return original PNG directly - fastest option
            onProgress('Done!');
            return pngDataUrl;
        } else if (settings.outputFormat === 'webp-browser') {
            // Display original immediately, convert in background
            onProgress('Converting to WebP...');
            const webpDataUrl = await convertImageToWebP(pngDataUrl, settings.webpQuality / 100);
            return webpDataUrl;
        }
        
        // Fallback to original
        return pngDataUrl;
    } catch (error) {
        controller.abort();
        await progressPromise.catch(() => {});
        console.error("SD WebUI generation error:", error);
        throw error;
    }
};
