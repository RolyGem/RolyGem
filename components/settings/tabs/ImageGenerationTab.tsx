import React, { useState, useEffect } from 'react';
import type { Settings, ADetailerUnit, LoraConfig } from '../../../types';
import { SelectInput, NumberInput, CheckboxInput, SliderInput, TextInput, TextareaInput, getStatusIndicator } from '../common/SettingsInputComponents';
import { generateUUID } from '../../../utils/uuid';

interface ImageGenerationTabProps {
  settings: Settings;
  onLiveUpdate: (newSettings: Settings) => void;
  hostname: string;
  // ComfyUI props
  comfyConnectionStatus: 'idle' | 'loading' | 'success' | 'error';
  onConnectComfyUI: () => void;
  comfyCheckpoints: string[];
  comfySamplers: string[];
  comfySchedulers: string[];
  comfyUpscalers: string[];
  comfyLoras: string[];
  // SD WebUI props
  sdConnectionStatus: 'idle' | 'loading' | 'success' | 'error';
  onConnectSD: () => void;
  sdCheckpoints: string[];
  sdSamplers: string[];
  sdSchedulers: string[];
  sdUpscalers: string[];
  sdFaceRestorers: string[];
  sdAdModels: string[];
  sdVaes: string[];
  sdLoras: { name: string; alias?: string }[];
  // Hugging Face props
  hfConnectionStatus: 'idle' | 'loading' | 'success' | 'error';
  onConnectHF: () => void;
  hfModels: string[];
}

const ImageGenerationTab: React.FC<ImageGenerationTabProps> = ({
  settings,
  onLiveUpdate,
  hostname,
  comfyConnectionStatus, onConnectComfyUI, comfyCheckpoints, comfySamplers, comfySchedulers, comfyUpscalers, comfyLoras,
  sdConnectionStatus, onConnectSD, sdCheckpoints, sdSamplers, sdSchedulers, sdUpscalers, sdFaceRestorers, sdAdModels, sdVaes, sdLoras,
  hfConnectionStatus, onConnectHF, hfModels
}) => {
    const [activeGenerator, setActiveGenerator] = useState<'comfyui' | 'sdwebui' | 'huggingface' | 'xai'>(settings.preferredImageGenerator || 'comfyui');
    
    // Sync activeGenerator with settings when they change externally
    useEffect(() => {
        setActiveGenerator(settings.preferredImageGenerator || 'comfyui');
    }, [settings.preferredImageGenerator]);
    
    const handleComfyInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value, type } = e.target;
      const isCheckbox = type === 'checkbox';
      const isChecked = isCheckbox ? (e.target as HTMLInputElement).checked : undefined;

      const newComfySettings = {
        ...settings.comfyUI,
        [name]: isCheckbox ? isChecked : (type === 'number' ? parseFloat(value) || 0 : value)
      };
      const newSettings = { ...settings, comfyUI: newComfySettings };
      onLiveUpdate(newSettings);

      if (name === 'url') {
           onLiveUpdate({ ...newSettings, comfyUI: { ...newComfySettings, isConnected: false } });
      }
    };

    const handleSDInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const isCheckbox = type === 'checkbox';
        const isChecked = isCheckbox ? (e.target as HTMLInputElement).checked : undefined;
        const isNumeric = ['number', 'range'].includes(type);

        const newSdSettings = {
            ...settings.stableDiffusion,
            [name]: isCheckbox ? isChecked : (isNumeric ? Number(value) : value)
        };
        const newSettings = { ...settings, stableDiffusion: newSdSettings };
        onLiveUpdate(newSettings);

        if (name === 'url') {
             onLiveUpdate({ ...newSettings, stableDiffusion: { ...newSdSettings, isConnected: false } });
        }
    };

    const handleHFInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value, type } = e.target;
      const isCheckbox = type === 'checkbox';
      const isChecked = isCheckbox ? (e.target as HTMLInputElement).checked : undefined;
      const isNumeric = ['number', 'range'].includes(type);

      const newHfSettings = {
        ...settings.huggingFace,
        [name]: isCheckbox ? isChecked : (isNumeric ? Number(value) : value)
      };
      const newSettings = { ...settings, huggingFace: newHfSettings };
      onLiveUpdate(newSettings);

      if (name === 'apiKey') {
           onLiveUpdate({ ...newSettings, huggingFace: { ...newHfSettings, isConnected: false } });
      }
    };

    const handleADetailerChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const isCheckbox = type === 'checkbox';
        const isChecked = isCheckbox ? (e.target as HTMLInputElement).checked : undefined;
        const isNumeric = ['number', 'range'].includes(type);

        const newUnits = [...settings.stableDiffusion.adUnits];
        const unitToUpdate = { ...newUnits[index] };
        
        type ADetailerKey = keyof ADetailerUnit;
        const key = name as ADetailerKey;

        (unitToUpdate[key] as any) = isCheckbox ? isChecked : isNumeric ? Number(value) : value;

        newUnits[index] = unitToUpdate;
        
        onLiveUpdate({
            ...settings,
            stableDiffusion: {
                ...settings.stableDiffusion,
                adUnits: newUnits
            }
        });
    };

    const createEmptyLoraConfig = (): LoraConfig => ({
        id: generateUUID(),
        name: '',
        displayName: '',
        weight: 1,
        clipStrength: 1,
        triggerPhrases: '',
        includeTriggerInPrompt: true,
        enabled: true,
    });

    const updateLoraList = (scope: 'comfyUI' | 'stableDiffusion', updater: (prev: LoraConfig[]) => LoraConfig[]) => {
        if (scope === 'comfyUI') {
            const updated = updater(settings.comfyUI.loras || []);
            onLiveUpdate({
                ...settings,
                comfyUI: {
                    ...settings.comfyUI,
                    loras: updated,
                },
            });
        } else {
            const updated = updater(settings.stableDiffusion.loras || []);
            onLiveUpdate({
                ...settings,
                stableDiffusion: {
                    ...settings.stableDiffusion,
                    loras: updated,
                },
            });
        }
    };

    const handleAddLora = (scope: 'comfyUI' | 'stableDiffusion') => {
        updateLoraList(scope, (prev) => [...prev, createEmptyLoraConfig()]);
    };

    const handleRemoveLora = (scope: 'comfyUI' | 'stableDiffusion', id: string) => {
        updateLoraList(scope, (prev) => prev.filter((item) => item.id !== id));
    };

    const handleLoraFieldChange = (scope: 'comfyUI' | 'stableDiffusion', index: number, field: keyof LoraConfig, value: any) => {
        updateLoraList(scope, (prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
    };

    const handleLoraModelChange = (scope: 'comfyUI' | 'stableDiffusion', index: number, option: { value: string; label: string }) => {
        updateLoraList(scope, (prev) => prev.map((item, i) => (
            i === index
                ? {
                    ...item,
                    name: option.value,
                    displayName: option.label,
                }
                : item
        )));
    };

    const comfyLoraOptions = comfyLoras.map(name => ({
        value: name,
        label: name,
    }));
    const sdRefinerOptions = ['', ...sdCheckpoints];
    const sdLoraOptions = sdLoras.map(({ name, alias }) => ({
        value: name,
        label: alias && alias !== name ? `${alias} (${name})` : name,
    }));

    const renderLoraList = (scope: 'comfyUI' | 'stableDiffusion', options: { value: string; label: string }[], allowClipStrength: boolean) => {
        const list = scope === 'comfyUI' ? settings.comfyUI.loras : settings.stableDiffusion.loras;

        const showLibraryHint = options.length === 0;

        if (!list || list.length === 0) {
            return (
                <div className="space-y-2">
                    <p className="text-xs text-text-secondary">
                        No LoRA layers added yet. Click &quot;Add LoRA&quot; to blend an additional style or character model.
                    </p>
                    {showLibraryHint && (
                        <p className="text-xs text-yellow-600 dark:text-yellow-400">
                            No LoRA library was reported by the server. Install or refresh your LoRA models, then reconnect.
                        </p>
                    )}
                </div>
            );
        }

        return (
            <div className="space-y-4">
                {showLibraryHint && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">
                        No LoRA library was reported by the server. Existing entries will still send their trigger tokens if you populate the name manually.
                    </p>
                )}
                {list.map((lora, index) => (
                    <div key={lora.id} className="border border-color rounded-lg p-4 space-y-3 bg-tertiary-bg/20">
                        <div className="flex flex-wrap items-center gap-3 justify-between">
                            <div className="flex items-center gap-3">
                                <CheckboxInput
                                    label="Enabled"
                                    name="enabled"
                                    checked={lora.enabled}
                                    onChange={(e) => handleLoraFieldChange(scope, index, 'enabled', (e.target as HTMLInputElement).checked)}
                                />
                                <CheckboxInput
                                    label="Auto-append trigger"
                                    name="includeTriggerInPrompt"
                                    checked={lora.includeTriggerInPrompt}
                                    onChange={(e) => handleLoraFieldChange(scope, index, 'includeTriggerInPrompt', (e.target as HTMLInputElement).checked)}
                                    helpText="Adds the trigger phrases to your prompt automatically."
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => handleRemoveLora(scope, lora.id)}
                                className="text-xs text-red-500 hover:text-red-400"
                            >
                                Remove
                            </button>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">LoRA Model</label>
                            <select
                                className="block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 modal-input"
                                value={lora.name}
                                onChange={(e) => {
                                    const selectedValue = e.target.value;
                                    const option = options.find(opt => opt.value === selectedValue);
                                    handleLoraModelChange(scope, index, {
                                        value: selectedValue,
                                        label: option?.label || selectedValue,
                                    });
                                }}
                            >
                                <option value="">Select a LoRA</option>
                                {options.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <SliderInput
                                label="Model Strength"
                                name="weight"
                                value={lora.weight}
                                min={-1}
                                max={2}
                                step={0.05}
                                onChange={(e) => handleLoraFieldChange(scope, index, 'weight', Number(e.target.value))}
                                helpText="Controls how strongly the LoRA influences the final image."
                            />
                            {allowClipStrength && (
                                <SliderInput
                                    label="CLIP Strength"
                                    name="clipStrength"
                                    value={lora.clipStrength}
                                    min={-1}
                                    max={2}
                                    step={0.05}
                                    onChange={(e) => handleLoraFieldChange(scope, index, 'clipStrength', Number(e.target.value))}
                                    helpText="Adjusts the influence on text encoding. Leave at 1.0 for balanced results."
                                />
                            )}
                        </div>
                        <TextareaInput
                            label="Trigger Phrases"
                            name="triggerPhrases"
                            value={lora.triggerPhrases}
                            rows={3}
                            placeholder="Example: solo, detailed face, cinematic lighting"
                            onChange={(e) => handleLoraFieldChange(scope, index, 'triggerPhrases', e.target.value)}
                            helpText="These phrases are appended when auto-trigger is enabled. Use commas or new lines between cues."
                        />
                    </div>
                ))}
            </div>
        );
    };

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const ipHint = hostname && hostname !== 'localhost' ? hostname : 'your-local-ip-address';
    const suggestedCorsOrigin = 'http://localhost:5173';
    const displayedCorsOrigin = origin || suggestedCorsOrigin;

    return (
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
            <h3 className="text-lg font-semibold">Image Generation</h3>
            <p className="text-sm text-text-secondary -mt-4">
                Connect to local image generation services like ComfyUI or Stable Diffusion WebUI.
            </p>

            {/* Usage Instructions */}
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg space-y-2">
                <p className="text-sm font-semibold text-purple-800 dark:text-purple-200">🎨 How to Generate Images:</p>
                <ol className="text-xs text-purple-700 dark:text-purple-300 list-decimal list-inside space-y-1 pl-2">
                    <li><strong>Setup:</strong> Select your preferred generator below and connect to the service</li>
                    <li><strong>Configure:</strong> Adjust generation settings (model, resolution, steps, etc.)</li>
                    <li><strong>Generate:</strong> Use one of these methods:
                        <ul className="list-disc list-inside pl-6 mt-1 space-y-0.5">
                            <li>Click the <strong>"Transform to Image"</strong> button on any AI message</li>
                            <li><code className="bg-purple-200 dark:bg-purple-800/50 px-1 py-0.5 rounded">/img [prompt]</code> - Uses your preferred generator</li>
                            <li><code className="bg-purple-200 dark:bg-purple-800/50 px-1 py-0.5 rounded">/sd [prompt]</code> - Forces Stable Diffusion WebUI</li>
                            <li><code className="bg-purple-200 dark:bg-purple-800/50 px-1 py-0.5 rounded">/hf [prompt]</code> - Forces Hugging Face</li>
                            <li><code className="bg-purple-200 dark:bg-purple-800/50 px-1 py-0.5 rounded">/xai [prompt]</code> - Forces XAI Grok</li>
                            <li><code className="bg-purple-200 dark:bg-purple-800/50 px-1 py-0.5 rounded">/imagine [prompt]</code> - Uses preferred generator</li>
                        </ul>
                    </li>
                    <li><strong>Result:</strong> Generated images appear directly in the chat and are saved to your gallery</li>
                </ol>
            </div>
            <div className="space-y-2">
                <label htmlFor="preferred-generator" className="block text-sm font-medium">Preferred Image Generator</label>
                <select
                    id="preferred-generator"
                    value={activeGenerator}
                    onChange={(e) => {
                        const newGenerator = e.target.value as 'comfyui' | 'sdwebui' | 'huggingface' | 'xai';
                        setActiveGenerator(newGenerator);
                        onLiveUpdate({ ...settings, preferredImageGenerator: newGenerator });
                    }}
                    className="block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 modal-input"
                >
                    <option value="comfyui">ComfyUI</option>
                    <option value="sdwebui">Stable Diffusion WebUI</option>
                    <option value="huggingface">Hugging Face</option>
                    <option value="xai">XAI (Grok Image Generation)</option>
                </select>
                <p className="text-xs text-text-secondary">This will be used when you click "Transform to Image" on a message.</p>
            </div>
            
            {activeGenerator === 'comfyui' && (
                <div className="space-y-6">
                    <div>
                        <h4 className="text-md font-semibold mb-4">ComfyUI Settings</h4>
                        <div className="space-y-4 p-4 border rounded-lg border-color">
                             <label htmlFor="comfy-url" className="block text-sm font-medium">Server URL</label>
                             <div className="flex items-center gap-2">
                                <input
                                    id="comfy-url"
                                    name="url"
                                    value={settings.comfyUI.url}
                                    onChange={handleComfyInputChange}
                                    className="block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 modal-input"
                                    placeholder="http://127.0.0.1:8188"
                                />
                                <button onClick={onConnectComfyUI} disabled={comfyConnectionStatus === 'loading'} className="px-4 py-2 text-sm font-medium new-chat-btn rounded-lg disabled:opacity-50">
                                    {comfyConnectionStatus === 'loading' ? '...' : 'Connect'}
                                </button>
                             </div>
                             <div className="h-4">{getStatusIndicator(comfyConnectionStatus)}</div>
                             <div className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 p-2 rounded-md">
                                <strong>Network Tip:</strong> For access from other devices, replace `127.0.0.1` with your machine's local IP: <code className="text-xs bg-gray-200 dark:bg-gray-700 p-1 rounded select-all">{hostname}</code>
                            </div>
                        </div>
                    </div>
                    {settings.comfyUI.isConnected && (
                         <div className="space-y-4">
                            <SelectInput label="Checkpoint Model" name="checkpoint" value={settings.comfyUI.checkpoint} onChange={handleComfyInputChange} options={comfyCheckpoints} />
                            <SelectInput label="Sampler" name="sampler" value={settings.comfyUI.sampler} onChange={handleComfyInputChange} options={comfySamplers} />
                            <SelectInput label="Scheduler" name="scheduler" value={settings.comfyUI.scheduler} onChange={handleComfyInputChange} options={comfySchedulers} />
                            <div className="grid grid-cols-2 gap-4">
                                <NumberInput label="Width" name="width" value={settings.comfyUI.width} onChange={handleComfyInputChange} />
                                <NumberInput label="Height" name="height" value={settings.comfyUI.height} onChange={handleComfyInputChange} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <NumberInput label="Steps" name="steps" value={settings.comfyUI.steps} onChange={handleComfyInputChange} />
                                <NumberInput label="CFG Scale" name="cfg" value={settings.comfyUI.cfg} onChange={handleComfyInputChange} />
                            </div>
                             <NumberInput label="Seed (0 for random)" name="seed" value={settings.comfyUI.seed} onChange={handleComfyInputChange} />
                             <TextareaInput
                                label="Negative Prompt"
                                name="negativePrompt"
                                value={settings.comfyUI.negativePrompt}
                                onChange={handleComfyInputChange}
                                rows={3}
                                helpText="Fallback safety tags appended to every ComfyUI request. Leave blank to rely on the default."
                             />
                            
                             <div className="pt-4 border-t border-color">
                                <CheckboxInput label="Enable Upscaler" name="enableUpscaler" checked={settings.comfyUI.enableUpscaler} onChange={handleComfyInputChange} />
                                 {settings.comfyUI.enableUpscaler && (
                                     <div className="mt-4 pl-6">
                                         <SelectInput label="Upscale Model" name="upscaleModel" value={settings.comfyUI.upscaleModel} onChange={handleComfyInputChange} options={comfyUpscalers} />
                                     </div>
                                 )}
                             </div>
                             <div className="pt-4 border-t border-color space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-semibold text-sm">LoRA Blending</h4>
                                    <button
                                        type="button"
                                        onClick={() => handleAddLora('comfyUI')}
                                        className="text-xs font-semibold text-accent-primary hover:underline"
                                    >
                                        Add LoRA
                                    </button>
                                </div>
                                <p className="text-xs text-text-secondary">
                                    Stack lightweight LoRA adapters to layer additional styles, characters, or details. Trigger phrases are appended automatically when enabled.
                                </p>
                                {renderLoraList('comfyUI', comfyLoraOptions, true)}
                             </div>
                             
                             <div className="pt-4 border-t border-color space-y-4">
                                <h4 className="font-semibold text-sm">Output Format</h4>
                                <div>
                                    <label htmlFor="comfy-outputFormat" className="block text-sm font-medium">Image Format</label>
                                    <select
                                        id="comfy-outputFormat"
                                        name="outputFormat"
                                        value={settings.comfyUI.outputFormat}
                                        onChange={handleComfyInputChange}
                                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border rounded-md focus:outline-none focus:ring-2 sm:text-sm modal-input"
                                    >
                                        <option value="original">Original PNG (Fastest - No Compression)</option>
                                        <option value="webp-browser">WebP (Compressed - Recommended)</option>
                                    </select>
                                    <p className="text-xs text-text-secondary mt-1">
                                        <strong>Original PNG:</strong> No compression, displays immediately after generation (~18s).<br/>
                                        <strong>WebP:</strong> Compresses image after generation, may add 3-5 seconds but reduces file size by 60-70%.
                                    </p>
                                </div>
                                {settings.comfyUI.outputFormat === 'webp-browser' && (
                                    <div className="pl-6">
                                        <SliderInput 
                                            label="WebP Quality" 
                                            name="webpQuality" 
                                            value={settings.comfyUI.webpQuality} 
                                            min={1} 
                                            max={100} 
                                            step={1} 
                                            onChange={handleComfyInputChange}
                                            helpText="Higher quality = larger file size. 90 is recommended for good balance."
                                        />
                                    </div>
                                )}
                             </div>
                        </div>
                    )}
                </div>
            )}
            
            {activeGenerator === 'sdwebui' && (
                <div className="space-y-6">
                    <div>
                        <h4 className="text-md font-semibold mb-4">Stable Diffusion WebUI Settings</h4>
                        <div className="space-y-4 p-4 border rounded-lg border-color">
                             <label htmlFor="sd-url" className="block text-sm font-medium">Server URL</label>
                             <div className="flex items-center gap-2">
                                <input id="sd-url" name="url" value={settings.stableDiffusion.url} onChange={handleSDInputChange} className="block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 modal-input" placeholder="http://127.0.0.1:7860" />
                                <button onClick={onConnectSD} disabled={sdConnectionStatus === 'loading'} className="px-4 py-2 text-sm font-medium new-chat-btn rounded-lg disabled:opacity-50">
                                    {sdConnectionStatus === 'loading' ? '...' : 'Connect'}
                                </button>
                             </div>
                             <div className="h-4">{getStatusIndicator(sdConnectionStatus)}</div>
                             <div className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 p-3 rounded-lg space-y-2">
                                <p className="font-semibold">Connection Guide</p>
                                <ol className="list-decimal list-inside space-y-1 pl-2">
                                    <li>
                                        Replace <code className="font-mono bg-yellow-200 dark:bg-yellow-800/50 p-1 rounded">127.0.0.1</code> in the URL above with your computer's LAN IP (for example: <code className="font-mono bg-yellow-200 dark:bg-yellow-800/50 p-1 rounded">{ipHint}</code>).
                                    </li>
                                    <li>
                                        Open <code className="font-mono bg-yellow-200 dark:bg-yellow-800/50 p-1 rounded">webui-user.bat</code> (or <code className="font-mono">webui-user.sh</code>) and locate the line that starts with <code className="font-mono">COMMANDLINE_ARGS=</code>.
                                    </li>
                                    <li>
                                        Append the following flags:
                                        <div className="pl-4 space-y-1 mt-1">
                                            <code className="font-mono bg-yellow-200 dark:bg-yellow-800/50 p-1 rounded">--listen</code>
                                            <br />
                                            <code className="font-mono bg-yellow-200 dark:bg-yellow-800/50 p-1 rounded">{`--cors-allow-origins=${suggestedCorsOrigin}`}</code>
                                        </div>
                                        <p className="mt-2 text-[11px] text-yellow-700 dark:text-yellow-300">
                                            If Gemini Fusion runs on a different port, replace <code className="font-mono">http://localhost:5173</code> with your actual origin (current: <code className="font-mono">{displayedCorsOrigin}</code>).
                                        </p>
                                    </li>
                                </ol>
                                <p className="font-semibold pt-1">Example</p>
                                <code className="block text-xs bg-gray-200 dark:bg-gray-700 p-2 rounded select-all w-full">
                                    set COMMANDLINE_ARGS=--api --listen --cors-allow-origins={suggestedCorsOrigin}
                                </code>
                            </div>
                        </div>
                    </div>
                    {settings.stableDiffusion.isConnected && (
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <h4 className="font-semibold">Base Settings</h4>
                                <SelectInput label="Checkpoint Model" name="checkpoint" value={settings.stableDiffusion.checkpoint} onChange={handleSDInputChange} options={sdCheckpoints} />
                                <SelectInput label="Sampling Method" name="sampler" value={settings.stableDiffusion.sampler} onChange={handleSDInputChange} options={sdSamplers} helpText="Core sampler algorithm (e.g., Euler a, DPM++ 2M, etc.)." />
                                <SelectInput label="Schedule Type" name="scheduler" value={settings.stableDiffusion.scheduler} onChange={handleSDInputChange} options={sdSchedulers} helpText="Noise schedule curve. Use Automatic unless you specifically need Karras or another schedule." />
                                <div className="grid grid-cols-2 gap-4">
                                    <NumberInput label="Width" name="width" value={settings.stableDiffusion.width} onChange={handleSDInputChange} />
                                    <NumberInput label="Height" name="height" value={settings.stableDiffusion.height} onChange={handleSDInputChange} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <NumberInput label="Steps" name="steps" value={settings.stableDiffusion.steps} onChange={handleSDInputChange} />
                                    <SliderInput label="CFG Scale" value={settings.stableDiffusion.cfg} min={1} max={30} step={0.5} onChange={(e) => handleSDInputChange(e)} name="cfg" helpText="How strongly the prompt influences the image." />
                                </div>
                                <NumberInput label="Seed (-1 for random)" name="seed" value={settings.stableDiffusion.seed} onChange={handleSDInputChange} />
                                <SelectInput label="VAE" name="vae" value={settings.stableDiffusion.vae} onChange={handleSDInputChange} options={sdVaes} helpText="Choose which Variational Autoencoder to decode with. 'Automatic' uses the model default, 'None' skips loading a VAE." />
                                <SelectInput label="Refiner Checkpoint (Optional)" name="refiner" value={settings.stableDiffusion.refiner} onChange={handleSDInputChange} options={sdRefinerOptions} helpText="SDXL users can provide an additional refiner model. Leave as 'None' for single-pass checkpoints." />
                                <TextareaInput
                                    label="Negative Prompt"
                                    name="negativePrompt"
                                    value={settings.stableDiffusion.negativePrompt}
                                    onChange={handleSDInputChange}
                                    rows={3}
                                    helpText="Default safety tags applied to every SD WebUI generation."
                                />
                            {settings.stableDiffusion.refiner && (
                                <SliderInput
                                    label="Refiner Switch Point"
                                    name="refinerSwitchAt"
                                        value={settings.stableDiffusion.refinerSwitchAt}
                                        min={0}
                                        max={1}
                                        step={0.05}
                                        onChange={(e) => handleSDInputChange(e)}
                                        helpText="Percentage of denoising steps where SD WebUI switches from the base model to the refiner."
                                    />
                                )}
                            </div>

                            <div className="space-y-4 pt-4 border-t border-color">
                                <h4 className="font-semibold">High-Resolution Fix</h4>
                                <CheckboxInput label="Enable Hires. Fix" name="enableHiresFix" checked={settings.stableDiffusion.enableHiresFix} onChange={handleSDInputChange} />
                                {settings.stableDiffusion.enableHiresFix && (
                                    <div className="pl-6 space-y-4">
                                        <SelectInput label="Upscaler" name="hiresUpscaler" value={settings.stableDiffusion.hiresUpscaler} onChange={handleSDInputChange} options={sdUpscalers} />
                                        <SliderInput label="Upscale By" value={settings.stableDiffusion.hiresUpscaleBy} min={1} max={4} step={0.1} onChange={(e) => handleSDInputChange(e)} name="hiresUpscaleBy" helpText="Factor to upscale the image by." />
                                        <NumberInput label="Hires Steps" name="hiresSteps" value={settings.stableDiffusion.hiresSteps} onChange={handleSDInputChange} />
                                        <SliderInput label="Denoising Strength" value={settings.stableDiffusion.hiresDenoisingStrength} min={0} max={1} step={0.05} onChange={(e) => handleSDInputChange(e)} name="hiresDenoisingStrength" helpText="How much the upscaled image should change." />
                                    </div>
                                )}
                            </div>
                            <div className="space-y-4 pt-4 border-t border-color">
                                <h4 className="font-semibold">Face Restoration</h4>
                                <SelectInput 
                                    label="Model (e.g., CodeFormer, GFPGAN)" 
                                    name="faceRestoration" 
                                    value={settings.stableDiffusion.faceRestoration} 
                                    onChange={handleSDInputChange} 
                                    options={sdFaceRestorers}
                                    helpText="This feature requires the model files (e.g., GFPGANv1.4.pth) to be in the correct 'models' folder of your SD WebUI installation."
                                />
                            </div>
                            <div className="space-y-4 pt-4 border-t border-color">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-semibold">LoRA Blending</h4>
                                    <button
                                        type="button"
                                        onClick={() => handleAddLora('stableDiffusion')}
                                        className="text-xs font-semibold text-accent-primary hover:underline"
                                    >
                                        Add LoRA
                                    </button>
                                </div>
                                <p className="text-xs text-text-secondary">
                                    Each enabled LoRA injects a lightweight style or character model. Strength controls the weight of its influence in the prompt.
                                </p>
                                {renderLoraList('stableDiffusion', sdLoraOptions, false)}
                            </div>
                            <div className="space-y-4 pt-4 border-t border-color">
                                <h4 className="font-semibold">Output Format</h4>
                                <div>
                                    <label htmlFor="sd-outputFormat" className="block text-sm font-medium">Image Format</label>
                                    <select
                                        id="sd-outputFormat"
                                        name="outputFormat"
                                        value={settings.stableDiffusion.outputFormat}
                                        onChange={handleSDInputChange}
                                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border rounded-md focus:outline-none focus:ring-2 sm:text-sm modal-input"
                                    >
                                        <option value="original">Original PNG (Fastest)</option>
                                        <option value="webp-browser">WebP (Browser Conversion)</option>
                                    </select>
                                    <p className="text-xs text-text-secondary mt-1">
                                        Original PNG is fastest. Browser conversion compresses the image to save bandwidth and storage.
                                    </p>
                                </div>
                                {settings.stableDiffusion.outputFormat === 'webp-browser' && (
                                    <div className="pl-6">
                                        <SliderInput 
                                            label="WebP Quality" 
                                            name="webpQuality" 
                                            value={settings.stableDiffusion.webpQuality} 
                                            min={1} 
                                            max={100} 
                                            step={1} 
                                            onChange={handleSDInputChange}
                                            helpText="Higher quality = larger file size. 90 is recommended for good balance."
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="space-y-4 pt-4 border-t border-color">
                                <h4 className="font-semibold">ADetailer</h4>
                                {settings.stableDiffusion.adUnits.map((unit, index) => {
                                    const ordinals = ['1st', '2nd', '3rd', '4th'];
                                    return (
                                        <div key={index} className="space-y-4 pt-4 border-t border-dashed border-gray-300 dark:border-gray-600">
                                            <h5 className="font-semibold text-indigo-600 dark:text-indigo-400">{ordinals[index]} Unit</h5>
                                            <CheckboxInput 
                                                label={`Enable ${ordinals[index]} ADetailer Unit`} 
                                                name="enabled" 
                                                checked={unit.enabled} 
                                                onChange={(e) => handleADetailerChange(index, e)} 
                                            />
                                            {unit.enabled && (
                                                <div className="pl-6 space-y-4">
                                                    <SelectInput 
                                                        label="ADetailer Model" 
                                                        name="model" 
                                                        value={unit.model} 
                                                        onChange={(e) => handleADetailerChange(index, e)} 
                                                        options={sdAdModels} 
                                                        helpText="Models loaded from your ADetailer extension. If this list is empty, please ensure the ADetailer extension is installed and up-to-date in your SD WebUI."
                                                    />
                                                    <TextInput label="ADetailer Prompt" name="prompt" value={unit.prompt} onChange={(e) => handleADetailerChange(index, e)} placeholder="e.g., beautiful face" />
                                                    <TextInput label="ADetailer Negative Prompt" name="negativePrompt" value={unit.negativePrompt} onChange={(e) => handleADetailerChange(index, e)} />
                                                    <SliderInput label="Detection Confidence Threshold" name="confidence" value={unit.confidence} min={0} max={1} step={0.05} onChange={(e) => handleADetailerChange(index, e)} helpText="Lower values detect more." />
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <NumberInput label="Mask Erode/Dilate" name="dilateErode" value={unit.dilateErode} onChange={(e) => handleADetailerChange(index, e)} />
                                                        <NumberInput label="Inpaint Padding" name="inpaintPadding" value={unit.inpaintPadding} onChange={(e) => handleADetailerChange(index, e)} />
                                                    </div>
                                                    <CheckboxInput label="Inpaint only masked" name="inpaintOnlyMasked" checked={unit.inpaintOnlyMasked} onChange={(e) => handleADetailerChange(index, e)} />
                                                    <div className="grid grid-cols-2 gap-4 items-center">
                                                        <CheckboxInput label="Use Separate Steps" name="useSeparateSteps" checked={unit.useSeparateSteps} onChange={(e) => handleADetailerChange(index, e)} />
                                                        {unit.useSeparateSteps && <NumberInput label="ADetailer Steps" name="steps" value={unit.steps} onChange={(e) => handleADetailerChange(index, e)} />}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4 items-center">
                                                        <CheckboxInput label="Use Separate CFG Scale" name="useSeparateCfgScale" checked={unit.useSeparateCfgScale} onChange={(e) => handleADetailerChange(index, e)} />
                                                        {unit.useSeparateCfgScale && <NumberInput label="ADetailer CFG" name="cfgScale" value={unit.cfgScale} onChange={(e) => handleADetailerChange(index, e)} />}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {activeGenerator === 'huggingface' && (
                <div className="space-y-6">
                    <div>
                        <h4 className="text-md font-semibold mb-4">Hugging Face Settings</h4>
                        <div className="space-y-4 p-4 border rounded-lg border-color">
                             <label htmlFor="hf-apiKey" className="block text-sm font-medium">API Key (with write access)</label>
                             <div className="flex items-center gap-2">
                                <input
                                    type="password"
                                    id="hf-apiKey"
                                    name="apiKey"
                                    value={settings.huggingFace.apiKey}
                                    onChange={handleHFInputChange}
                                    className="block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 modal-input"
                                    placeholder="hf_..."
                                />
                                <button onClick={onConnectHF} disabled={hfConnectionStatus === 'loading' || !settings.huggingFace.apiKey} className="px-4 py-2 text-sm font-medium new-chat-btn rounded-lg disabled:opacity-50">
                                    {hfConnectionStatus === 'loading' ? '...' : 'Connect'}
                                </button>
                             </div>
                             <div className="h-4">{getStatusIndicator(hfConnectionStatus)}</div>
                        </div>
                    </div>
                    {settings.huggingFace.isConnected && (
                        <div className="space-y-4">
                            <SelectInput label="Model" name="model" value={settings.huggingFace.model} onChange={handleHFInputChange} options={hfModels} helpText="Top 100 text-to-image models from Hugging Face Hub, sorted by likes." />
                            <TextInput label="Negative Prompt" name="negativePrompt" value={settings.huggingFace.negativePrompt} onChange={handleHFInputChange} />
                            <div className="grid grid-cols-2 gap-4">
                                <NumberInput label="Inference Steps" name="steps" value={settings.huggingFace.steps} onChange={handleHFInputChange} />
                                <SliderInput label="Guidance Scale (CFG)" name="guidanceScale" value={settings.huggingFace.guidanceScale} min={1} max={20} step={0.5} onChange={(e) => handleHFInputChange(e)} helpText="How much the prompt guides generation." />
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {activeGenerator === 'xai' && (
                <div className="space-y-6">
                    <div>
                        <h4 className="text-md font-semibold mb-4">XAI Grok Image Generation</h4>
                        <div className="space-y-4 p-4 border rounded-lg border-color">
                            <p className="text-sm text-text-secondary">
                                Grok Image Generation uses the <code className="text-xs bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded">grok-2-image-1212</code> model to generate high-quality images from text prompts.
                            </p>
                            <div className="space-y-2">
                                <p className="text-sm font-medium">Requirements:</p>
                                <ul className="text-xs text-text-secondary list-disc list-inside space-y-1">
                                    <li>XAI API Key must be configured in General Settings</li>
                                    <li>Cost: $0.07 per image generated</li>
                                    <li>Format: JPEG output</li>
                                    <li>Generation time: ~5-10 seconds</li>
                                </ul>
                            </div>
                            {settings.xaiApiKey ? (
                                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                                    <p className="text-sm text-green-700 dark:text-green-300">✓ XAI API Key is configured</p>
                                </div>
                            ) : (
                                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                                    <p className="text-sm text-yellow-700 dark:text-yellow-300">⚠ Please add your XAI API Key in General Settings to use this feature</p>
                                </div>
                            )}
                            <div className="pt-3 border-t border-color">
                                <h5 className="text-sm font-semibold mb-2">Usage Commands:</h5>
                                <ul className="text-xs text-text-secondary space-y-1">
                                    <li><code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded">/xai [prompt]</code> - Generate image directly</li>
                                    <li>Or click "Transform to Image" on any message</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImageGenerationTab;
