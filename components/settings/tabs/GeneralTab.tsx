import React, { useState } from 'react';
import type { Settings } from '../../../types';
import { PROMPT_FORMATS } from '../../../constants';
import { SliderInput, SelectInput, NumberInput, CheckboxInput } from '../common/SettingsInputComponents';
import { PlusIcon } from '../../icons/PlusIcon';
import { TrashIcon } from '../../icons/TrashIcon';
import { EyeIcon } from '../../icons/EyeIcon';

interface GeneralTabProps {
  settings: Settings;
  onLiveUpdate: (newSettings: Settings) => void;
}

const GeneralTab: React.FC<GeneralTabProps> = ({ settings, onLiveUpdate }) => {
  const [showAllKeys, setShowAllKeys] = useState(false);
  const [activeApiTab, setActiveApiTab] = useState<'gemini' | 'openrouter' | 'xai'>('gemini');
  
  // Parse keys - keep empty strings to maintain UI state
  const getKeys = () => {
    if (!settings.geminiApiKeys) return [''];
    const keys = settings.geminiApiKeys.split('\n').map(k => k.trim());
    return keys.length > 0 ? keys : [''];
  };

  const keys = getKeys();

  // Add new key
  const addKey = () => {
    onLiveUpdate({ 
      ...settings, 
      geminiApiKeys: settings.geminiApiKeys ? `${settings.geminiApiKeys}\n` : '' 
    });
  };

  // Remove key
  const removeKey = (index: number) => {
    const newKeys = keys.filter((_, i) => i !== index);
    onLiveUpdate({ ...settings, geminiApiKeys: newKeys.join('\n') });
  };

  // Update key
  const updateKey = (index: number, value: string) => {
    const newKeys = [...keys];
    newKeys[index] = value;
    onLiveUpdate({ ...settings, geminiApiKeys: newKeys.join('\n') });
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const checked = isCheckbox ? (e.target as HTMLInputElement).checked : undefined;
    
    onLiveUpdate({ ...settings, [name]: isCheckbox ? checked : value });
  };
  
  const handleNumericSettingChange = (name: keyof Settings, value: string, isFloat: boolean) => {
    const parsedValue = isFloat ? parseFloat(value) : parseInt(value);
    if (!isNaN(parsedValue)) {
      onLiveUpdate({ ...settings, [name]: parsedValue as any });
    }
  };
  
  return (
    <div className="p-3 sm:p-4 md:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1">
        {/* API Keys Section with Tabs */}
        <div className="border border-color rounded-lg overflow-hidden">
            {/* Tabs Header */}
            <div className="flex border-b border-color bg-bg-secondary/30">
                <button
                    type="button"
                    onClick={() => setActiveApiTab('gemini')}
                    className={`flex-1 px-2 sm:px-4 py-2.5 sm:py-3 text-xs font-medium transition-colors ${
                        activeApiTab === 'gemini'
                            ? 'bg-primary text-white border-b-2 border-primary'
                            : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                    }`}
                >
                    <span className="flex items-center justify-center gap-1">
                        <span className="text-sm">🤖</span>
                        <span className="text-xs">Gemini</span>
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveApiTab('openrouter')}
                    className={`flex-1 px-2 sm:px-4 py-2.5 sm:py-3 text-xs font-medium transition-colors ${
                        activeApiTab === 'openrouter'
                            ? 'bg-primary text-white border-b-2 border-primary'
                            : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                    }`}
                >
                    <span className="flex items-center justify-center gap-1">
                        <span className="text-sm">🌐</span>
                        <span className="text-xs">OpenRouter</span>
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveApiTab('xai')}
                    className={`flex-1 px-2 sm:px-4 py-2.5 sm:py-3 text-xs font-medium transition-colors ${
                        activeApiTab === 'xai'
                            ? 'bg-primary text-white border-b-2 border-primary'
                            : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                    }`}
                >
                    <span className="flex items-center justify-center gap-1">
                        <span className="text-sm">⚡</span>
                        <span className="text-xs">XAI</span>
                    </span>
                </button>
            </div>

            {/* Tab Content */}
            <div className="p-4 sm:p-5">
                {/* Gemini Tab */}
                {activeApiTab === 'gemini' && (
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-medium">Gemini API Keys</h3>
                            <div className="flex gap-2">
                                {keys.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => setShowAllKeys(!showAllKeys)}
                                        className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-bg-secondary hover:bg-bg-tertiary transition-colors"
                                    >
                                        <EyeIcon className="w-3 h-3" />
                                        {showAllKeys ? 'Hide' : 'Show'} ({keys.length})
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={addKey}
                                    className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-primary hover:bg-primary-hover text-white transition-colors"
                                >
                                    <PlusIcon className="w-3 h-3" />
                                    Add Key
                                </button>
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            {keys.map((key, i) => (
                                <div
                                    key={i}
                                    className={`flex gap-2 transition-opacity ${!showAllKeys && i > 0 ? 'opacity-30 pointer-events-none' : ''}`}
                                >
                                    <input
                                        type="password"
                                        value={key}
                                        onChange={(e) => updateKey(i, e.target.value)}
                                        className="flex-1 px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 modal-input"
                                        placeholder={i === 0 ? "Primary Key" : `Key ${i + 1}`}
                                    />
                                    {keys.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeKey(i)}
                                            className="p-2 rounded-md hover:bg-red-500/10 text-red-500"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="mt-3 space-y-1.5">
                            <p className="text-xs text-text-secondary">
                                💡 Add multiple keys for automatic failover. When one key fails or exceeds quota, the app automatically tries the next key.
                            </p>
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                                🔗 Get your API keys at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">Google AI Studio</a>
                            </p>
                            <p className="text-xs text-text-secondary italic">
                                🔒 Keep your API key secure and never share it with anyone. It's your responsibility.
                            </p>
                        </div>
                    </div>
                )}

                {/* OpenRouter Tab */}
                {activeApiTab === 'openrouter' && (
                    <div>
                        <h3 className="text-sm font-medium mb-3">OpenRouter API Key</h3>
                        <input
                            type="password"
                            id="openRouterApiKey"
                            name="openRouterApiKey"
                            value={settings.openRouterApiKey}
                            onChange={handleInputChange}
                            className="block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 modal-input"
                            placeholder="Enter your OpenRouter API Key"
                        />
                        <div className="mt-3 space-y-1.5">
                            <p className="text-xs text-text-secondary">
                                Used for accessing models from OpenRouter's unified API.
                            </p>
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                                🔗 Get your API key at <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">OpenRouter Keys</a>
                            </p>
                            <p className="text-xs text-text-secondary italic">
                                🔒 Keep your API key secure and never share it with anyone. It's your responsibility.
                            </p>
                        </div>
                    </div>
                )}

                {/* XAI Tab */}
                {activeApiTab === 'xai' && (
                    <div>
                        <h3 className="text-sm font-medium mb-3">XAI API Key (Grok)</h3>
                        <input
                            type="password"
                            id="xaiApiKey"
                            name="xaiApiKey"
                            value={settings.xaiApiKey}
                            onChange={handleInputChange}
                            className="block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 modal-input"
                            placeholder="Enter your XAI API Key"
                        />
                        <div className="mt-3 space-y-1.5">
                            <p className="text-xs text-text-secondary">
                                Used for accessing Grok models (Grok 4, Grok 3, Grok 3 Mini, etc.) from XAI's API.
                            </p>
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                                🔗 Get your API key at <a href="https://console.x.ai" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">XAI Console</a>
                            </p>
                            <p className="text-xs text-text-secondary italic">
                                🔒 Keep your API key secure and never share it with anyone. It's your responsibility.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>

        <div className="border-t border-color pt-4 sm:pt-6 space-y-3 sm:space-y-4">
            <h3 className="text-base sm:text-lg font-semibold">Model Configuration</h3>
            <SliderInput label="Temperature" value={settings.temperature} min={0} max={2} step={0.05} onChange={(e) => handleNumericSettingChange('temperature', e.target.value, true)} name="temperature" helpText="Controls randomness. Lower is more deterministic." />
            <SliderInput label="Top-K" value={settings.topK} min={1} max={100} step={1} onChange={(e) => handleNumericSettingChange('topK', e.target.value, false)} name="topK" helpText="Filters to the K most likely next tokens." dataType="integer" />
            <SliderInput label="Top-P" value={settings.topP} min={0} max={1} step={0.05} onChange={(e) => handleNumericSettingChange('topP', e.target.value, true)} name="topP" helpText="Selects tokens with a cumulative probability of P." />
            <div className="space-y-2">
                 <NumberInput
                    label="Max Response Length (tokens)"
                    name="maxResponseTokens"
                    value={settings.maxResponseTokens ?? ''}
                    onChange={(e) => {
                        const value = e.target.value;
                        onLiveUpdate({ 
                            ...settings, 
                            maxResponseTokens: value ? parseInt(value, 10) : null 
                        });
                    }}
                    placeholder="No limit"
                />
                 <p className="text-xs text-text-secondary">
                    Limits the maximum number of tokens the AI can generate in a single response. Leave empty for no specific limit. (Mainly for OpenRouter)
                 </p>
            </div>
        </div>
         <div className="border-t border-color pt-4 sm:pt-6 space-y-3 sm:space-y-4">
            <h3 className="text-base sm:text-lg font-semibold">Prompt Engineering</h3>
             <div>
                <label htmlFor="systemPrompt" className="block text-sm font-medium">Global System Prompt</label>
                <textarea
                    id="systemPrompt"
                    name="systemPrompt"
                    value={settings.systemPrompt}
                    onChange={handleInputChange}
                    rows={4}
                    className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 modal-input"
                    placeholder="e.g., You are a helpful assistant..."
                />
                 <p className="text-xs text-text-secondary mt-1">{"Base instructions for the AI. This prompt is combined with the conversation-specific prompt. Note: Ignored in multi-character mode (when >1 character is active)."}</p>
                 <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                        💡 With 2+ characters, switch between Narrator/Director modes in <strong>Conversation Settings</strong>.
                    </p>
                 </div>
            </div>
            <div>
                <label htmlFor="jailbreakPrompt" className="block text-sm font-medium">Jailbreak Prompt</label>
                <textarea
                    id="jailbreakPrompt"
                    name="jailbreakPrompt"
                    value={settings.jailbreakPrompt}
                    onChange={handleInputChange}
                    rows={2}
                    className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 modal-input"
                    placeholder="e.g., This is a fictional story..."
                />
                 <p className="text-xs text-text-secondary mt-1">Optional instructions to bypass AI safety filters. Use with caution.</p>
            </div>
            <CheckboxInput
                label="Enable Strict Input Formatting (User Agency)"
                name="enableInputReformatting"
                checked={settings.enableInputReformatting}
                onChange={handleInputChange}
                helpText="Prevents the AI from controlling your character by wrapping your input with strict instructions. Highly recommended for role-playing."
            />
            <SelectInput label="Prompt Format" name="promptFormat" value={settings.promptFormat} onChange={handleInputChange} options={PROMPT_FORMATS} helpText="Choose the prompt structure. Primarily affects OpenRouter models." />
        </div>
         <div className="border-t border-color pt-4 sm:pt-6 space-y-3 sm:space-y-4">
            <h3 className="text-base sm:text-lg font-semibold">Role Play Settings</h3>
            <SliderInput label="Repetition Penalty" value={settings.repetitionPenalty} min={0} max={2} step={0.05} onChange={(e) => handleNumericSettingChange('repetitionPenalty', e.target.value, true)} name="repetitionPenalty" helpText="Penalizes repeating tokens. (Mainly for OpenRouter)" />
            <SliderInput label="Frequency Penalty" value={settings.frequencyPenalty} min={0} max={2} step={0.05} onChange={(e) => handleNumericSettingChange('frequencyPenalty', e.target.value, true)} name="frequencyPenalty" helpText="Penalizes tokens based on how often they appear. (OpenRouter)" />
            <SliderInput label="Presence Penalty" value={settings.presencePenalty} min={0} max={2} step={0.05} onChange={(e) => handleNumericSettingChange('presencePenalty', e.target.value, true)} name="presencePenalty" helpText="Penalizes tokens that have already appeared. (OpenRouter)" />
             <div>
                <label htmlFor="stopSequences" className="block text-sm font-medium">Stop Sequences</label>
                <textarea
                    id="stopSequences"
                    name="stopSequences"
                    value={settings.stopSequences}
                    onChange={handleInputChange}
                    rows={3}
                    className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 modal-input"
                    placeholder="e.g.&#10;{{user}}:&#10;{{char}}:"
                />
                 <p className="text-xs text-text-secondary mt-1">{"Stops generation if the AI produces these strings. Separate with new lines. `{{user}}` and `{{char}}` are replaced dynamically."}</p>
            </div>
        </div>
    </div>
  );
};

export default GeneralTab;