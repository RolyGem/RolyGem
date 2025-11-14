import React, { useState, useEffect } from 'react';
import { CollapsibleNotice } from '../../common/CollapsibleNotice';
import type { Settings, Model } from '../../../types';
import { NumberInput, SegmentedControl, CheckboxInput, getStatusIndicator, SelectInput } from '../common/SettingsInputComponents';
import { testOpenRouterConnection, fetchOpenRouterModels } from '../../../services/ai/openRouterSummarizer';

interface ContextTabProps {
  settings: Settings;
  onLiveUpdate: (newSettings: Settings) => void;
  selectedModel: Model;
  connectionStatus: 'idle' | 'loading' | 'success' | 'error';
  onConnect: () => void;
  hostname: string;
}

/**
 * Renders the "Context" tab in the settings modal.
 * This component manages settings related to conversation history length,
 * context management strategies (trimming vs. summarizing), and the summarizer engine.
 */
const ContextTab: React.FC<ContextTabProps> = ({ 
  settings, 
  onLiveUpdate, 
  selectedModel, 
  connectionStatus, 
  onConnect,
  hostname,
}) => {

  const [openRouterTestStatus, setOpenRouterTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [openRouterTestMessage, setOpenRouterTestMessage] = useState<string>('');
  const [openRouterModels, setOpenRouterModels] = useState<any[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // Fetch OpenRouter models when OpenRouter is selected
  useEffect(() => {
    if (settings.contextManagement.summarizerModel === 'openrouter' && settings.openRouterApiKey && openRouterModels.length === 0) {
      loadOpenRouterModels();
    }
  }, [settings.contextManagement.summarizerModel, settings.openRouterApiKey]);

  const loadOpenRouterModels = async () => {
    if (!settings.openRouterApiKey) return;
    
    setIsLoadingModels(true);
    try {
      const models = await fetchOpenRouterModels(settings.openRouterApiKey);
      setOpenRouterModels(models);
    } catch (error: any) {
      console.error('Failed to fetch OpenRouter models:', error);
      setOpenRouterModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleTestOpenRouter = async () => {
    setOpenRouterTestStatus('loading');
    setOpenRouterTestMessage('');
    
    try {
      const result = await testOpenRouterConnection(
        settings.openRouterApiKey,
        settings.contextManagement.openRouterSummarizerModelId
      );
      setOpenRouterTestStatus('success');
      setOpenRouterTestMessage(result);
    } catch (error: any) {
      setOpenRouterTestStatus('error');
      setOpenRouterTestMessage(error.message || 'Connection failed');
    }
  };

  const handleOpenRouterModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSettings = {
      ...settings,
      contextManagement: {
        ...settings.contextManagement,
        openRouterSummarizerModelId: e.target.value
      }
    };
    onLiveUpdate(newSettings);
  };

  const handleContextInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: {name: string, value: string}}) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type, checked } = target;
    const isNumberInput = type === 'number';
    const isCheckbox = type === 'checkbox';

    let newContextSettings = { ...settings.contextManagement };
    
    // Handle nested compressionLevels
    if (name === 'compressionLevels') {
      newContextSettings.compressionLevels = JSON.parse(value);
    } else {
      newContextSettings = {
        ...newContextSettings,
        [name]: isCheckbox ? checked : (isNumberInput ? (value ? parseInt(value, 10) : null) : value),
      };
    }
    
    const newSettings = { ...settings, contextManagement: newContextSettings };
    onLiveUpdate(newSettings);
    
    // If URL changes, connection status should be reset (handled by parent).
    // This component only cares about showing the current status.
  };
  
  const modelDefaultTokens = selectedModel.contextLengthTokens;
  const userOverrideTokens = settings.contextManagement.maxContextTokens;
  const effectiveMaxTokens = userOverrideTokens ?? modelDefaultTokens;
  
  return (
    <div className="p-6 overflow-y-auto space-y-6 flex-1">
         <h3 className="text-lg font-semibold">Context Management</h3>
         
         {/* Status Update - Smart Summarization Coming Soon */}
         <CollapsibleNotice
            title="Summarization Status Update"
            variant="yellow"
            icon="✨"
            defaultExpanded={false}
         >
            <p>✅ <strong>Summarize Oldest</strong> is now fully operational and working perfectly! Use it for reliable context management.</p>
            <p className="pt-1">🚧 <strong>Smart Summarization</strong> is currently under development with exciting improvements:</p>
            <ul className="list-disc list-inside pl-3 space-y-0.5 text-xs">
                <li>Hierarchical compression with Archive & Mid-term zones for better context retention</li>
                <li>Dynamic Recent Zone that adapts to conversation flow</li>
                <li>Intelligent summary reuse to prevent redundant processing</li>
                <li>Advanced chunk-based processing for large conversations</li>
            </ul>
            <p className="pt-1">🎯 Smart Summarization will be available soon with significantly improved accuracy and performance!</p>
         </CollapsibleNotice>

         <div className="p-4 bg-secondary-bg rounded-lg space-y-2">
            <p className="text-sm">Current Model: <span className="font-semibold text-accent-primary">{selectedModel.name}</span></p>
            <p className="text-sm text-text-secondary">
                Model's Default (from API): 
                <span className="font-mono ml-2 font-semibold">{modelDefaultTokens ? `${modelDefaultTokens.toLocaleString()} tokens` : 'N/A'}</span>
                 {modelDefaultTokens && <span className="text-xs"> (~{(modelDefaultTokens * 4).toLocaleString()} chars)</span>}
            </p>
            <p className="text-sm">
                Effective Limit (used in chat): 
                <span className="font-mono ml-2 font-bold">{effectiveMaxTokens ? effectiveMaxTokens.toLocaleString() : 'N/A'} tokens</span>
            </p>
         </div>
         <div className="space-y-4">
             <NumberInput
                label="Override Max Context (tokens)"
                name="maxContextTokens"
                value={settings.contextManagement.maxContextTokens ?? ''}
                onChange={handleContextInputChange}
                placeholder={`${modelDefaultTokens?.toLocaleString() ?? 'Model default'}`}
             />
             <p className="text-xs text-text-secondary -mt-2">
               Set a custom token limit. Leave empty to use the model's default.
             </p>
         </div>
         <div className="space-y-4">
            <label className="block text-sm font-medium">When context is full...</label>
            <SegmentedControl 
                name="strategy"
                value={settings.contextManagement.strategy}
                options={[
                    { value: 'trim', label: 'Trim Oldest' },
                    { value: 'summarize', label: 'Summarize Oldest' },
                    { value: 'smart_summarize', label: 'Smart Summarization' }
                ]}
                onChange={(e) => handleContextInputChange(e as any)}
            />
            <p className="text-xs text-text-secondary mt-1">
                'Trim' is fastest. 'Summarize' preserves basic memory. 'Smart Summarization' uses advanced techniques for optimal long-term memory (recommended for 100K+ token conversations).
            </p>
         </div>

         {settings.contextManagement.strategy === 'summarize' && (
            <div className="p-4 border rounded-lg space-y-4 border-color">
                <label className="block text-sm font-medium">Summarizer Engine</label>
                <SegmentedControl 
                    name="summarizerModel"
                    value={settings.contextManagement.summarizerModel}
                    options={[
                        { value: 'gemini', label: 'Gemini 2.5 Flash' },
                        { value: 'openrouter', label: 'OpenRouter' },
                        { value: 'koboldcpp', label: 'KoboldCPP (Local)' }
                    ]}
                    onChange={(e) => handleContextInputChange(e as any)}
                />

                {settings.contextManagement.summarizerModel === 'openrouter' && (
                    <>
                        {!settings.openRouterApiKey ? (
                            <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                                    ⚠️ Please add your OpenRouter API key in General settings first
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Model Selector */}
                                <div className="mt-3">
                                    <SelectInput
                                        label="OpenRouter Model"
                                        name="openRouterSummarizerModelId"
                                        value={settings.contextManagement.openRouterSummarizerModelId}
                                        onChange={handleOpenRouterModelChange}
                                        disabled={isLoadingModels}
                                        options={
                                            isLoadingModels
                                                ? [{ value: '', label: 'Loading models...' }]
                                                : openRouterModels.length > 0
                                                ? openRouterModels.map(model => ({
                                                    value: model.id,
                                                    label: `${model.name || model.id}${model.pricing?.prompt ? ` ($${model.pricing.prompt}/1M tokens)` : ''}`
                                                  }))
                                                : [{ value: settings.contextManagement.openRouterSummarizerModelId, label: settings.contextManagement.openRouterSummarizerModelId }]
                                        }
                                        helpText={isLoadingModels ? 'Fetching available models...' : `Selected: ${settings.contextManagement.openRouterSummarizerModelId}`}
                                    />
                                    {openRouterModels.length === 0 && !isLoadingModels && (
                                        <button
                                            onClick={loadOpenRouterModels}
                                            className="mt-2 px-3 py-1 text-xs font-medium new-chat-btn rounded"
                                        >
                                            Refresh Models
                                        </button>
                                    )}
                                </div>

                                {/* Test Connection */}
                                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">Test Connection:</span>
                                        <button
                                            onClick={handleTestOpenRouter}
                                            disabled={openRouterTestStatus === 'loading'}
                                            className="px-3 py-1 text-xs font-medium new-chat-btn rounded disabled:opacity-50"
                                        >
                                            {openRouterTestStatus === 'loading' ? 'Testing...' : 'Test Model'}
                                        </button>
                                    </div>
                                    {openRouterTestStatus !== 'idle' && (
                                        <div className="text-xs">
                                            {getStatusIndicator(openRouterTestStatus, openRouterTestMessage, openRouterTestMessage)}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </>
                )}

                {settings.contextManagement.summarizerModel === 'koboldcpp' && (
                    <div>
                        <label htmlFor="koboldcppUrl" className="block text-sm font-medium">KoboldCPP URL</label>
                        <div className="flex items-center gap-2 mt-1">
                            <input
                                type="text"
                                id="koboldcppUrl"
                                name="koboldcppUrl"
                                value={settings.contextManagement.koboldcppUrl}
                                onChange={handleContextInputChange}
                                className="block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 modal-input"
                                placeholder="http://127.0.0.1:5001"
                            />
                            <button onClick={onConnect} disabled={connectionStatus === 'loading'} className="px-4 py-2 text-sm font-medium new-chat-btn rounded-lg disabled:opacity-50">
                                {connectionStatus === 'loading' ? '...' : 'Connect'}
                            </button>
                        </div>
                        <div className="h-4 mt-1">{getStatusIndicator(connectionStatus)}</div>
                        <div className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 p-2 rounded-md mt-2">
                           <strong>Network Tip:</strong> For access from other devices, replace `127.0.0.1` with your machine's local IP: <code className="text-xs bg-gray-200 dark:bg-gray-700 p-1 rounded select-all">{hostname}</code>
                       </div>
                    </div>
                )}
            </div>
         )}

         {settings.contextManagement.strategy === 'smart_summarize' && (
            <div className="p-4 border rounded-lg space-y-4 border-color bg-accent-primary/5">
                <h4 className="font-semibold text-accent-primary">Smart Summarization Settings</h4>
                
                {/* Info Box with Advantages & Considerations */}
                <div className="bg-secondary-bg p-3 rounded-lg space-y-3 text-sm">
                    <div>
                        <h5 className="font-semibold text-green-600 dark:text-green-400 mb-1">✅ Advantages:</h5>
                        <ul className="list-disc list-inside space-y-1 text-xs">
                            <li>Preserves last N tokens completely (dynamic recent zone)</li>
                            <li>Hierarchical compression (archive, mid-term, recent)</li>
                            <li>Better long-term memory retention</li>
                            <li>Significantly reduces hallucination in long conversations</li>
                            <li>Adapts to your message length automatically</li>
                        </ul>
                    </div>
                    <div>
                        <h5 className="font-semibold text-yellow-600 dark:text-yellow-400 mb-1">⚠️ Considerations:</h5>
                        <ul className="list-disc list-inside space-y-1 text-xs">
                            <li>Slightly slower (hierarchical summarization takes time)</li>
                            <li>Uses extra API calls for chunked processing</li>
                            <li>Best for long conversations (100K+ tokens)</li>
                            <li>May increase cost by ~15-25% due to extra processing</li>
                        </ul>
                    </div>
                </div>

                {/* Recent Zone Tokens Setting */}
                <div className="space-y-2">
                    <NumberInput
                        label="Recent Zone Protection (tokens)"
                        name="recentZoneTokens"
                        value={settings.contextManagement.recentZoneTokens}
                        onChange={handleContextInputChange}
                        placeholder="35000"
                    />
                    <p className="text-xs text-text-secondary">
                        Number of tokens to protect from summarization (recent messages are kept in full). 
                        35K ≈ 35-50 messages in Arabic. Adjust based on your conversation style.
                    </p>
                </div>

                {/* Compression Levels - Simplified Explanation */}
                <div className="space-y-3">
                    <label className="block text-sm font-medium">How to Summarize Old Messages</label>
                    
                    {/* Visual Explanation */}
                    <div className="bg-secondary-bg p-3 rounded-lg space-y-2 text-xs">
                        <div className="flex items-center gap-2">
                            <div className="w-16 text-right font-medium text-green-600 dark:text-green-400">Recent:</div>
                            <div className="flex-1 bg-green-500/20 h-6 rounded flex items-center px-2">
                                <span className="text-xs font-medium">Protected (No Summary)</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-16 text-right font-medium text-blue-600 dark:text-blue-400">Mid-term:</div>
                            <div className="flex-1 bg-blue-500/20 h-6 rounded flex items-center px-2">
                                <span className="text-xs">Medium summary ({Math.round(settings.contextManagement.compressionLevels.midTerm * 100)}% kept)</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-16 text-right font-medium text-orange-600 dark:text-orange-400">Archive:</div>
                            <div className="flex-1 bg-orange-500/20 h-6 rounded flex items-center px-2">
                                <span className="text-xs">Heavy summary ({Math.round(settings.contextManagement.compressionLevels.archive * 100)}% kept)</span>
                            </div>
                        </div>
                    </div>

                    <p className="text-xs text-text-secondary italic">
                        💡 Example: If you have 200 messages → Recent (last 40) = full, Mid-term (next 80) = medium compression (40%), Archive (oldest 80) = heavy compression (20%).
                    </p>

                    {/* Settings */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <div>
                            <label className="text-xs font-medium text-blue-600 dark:text-blue-400">Mid-term Retention</label>
                            <div className="flex items-center gap-2 mt-1">
                                <input
                                    type="range"
                                    name="compressionLevels.midTerm"
                                    value={settings.contextManagement.compressionLevels.midTerm}
                                    onChange={(e) => {
                                        const newLevels = {
                                            ...settings.contextManagement.compressionLevels,
                                            midTerm: parseFloat(e.target.value)
                                        };
                                        handleContextInputChange({
                                            target: { 
                                                name: 'compressionLevels', 
                                                value: JSON.stringify(newLevels)
                                            }
                                        } as any);
                                    }}
                                    step="0.1"
                                    min="0.3"
                                    max="0.7"
                                    className="flex-1"
                                />
                                <span className="text-xs font-mono w-10 text-right">{Math.round(settings.contextManagement.compressionLevels.midTerm * 100)}%</span>
                            </div>
                            <p className="text-xs text-text-secondary mt-1">Higher = keep more details</p>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-orange-600 dark:text-orange-400">Archive Retention</label>
                            <div className="flex items-center gap-2 mt-1">
                                <input
                                    type="range"
                                    name="compressionLevels.archive"
                                    value={settings.contextManagement.compressionLevels.archive}
                                    onChange={(e) => {
                                        const newLevels = {
                                            ...settings.contextManagement.compressionLevels,
                                            archive: parseFloat(e.target.value)
                                        };
                                        handleContextInputChange({
                                            target: { 
                                                name: 'compressionLevels', 
                                                value: JSON.stringify(newLevels)
                                            }
                                        } as any);
                                    }}
                                    step="0.1"
                                    min="0.1"
                                    max="0.4"
                                    className="flex-1"
                                />
                                <span className="text-xs font-mono w-10 text-right">{Math.round(settings.contextManagement.compressionLevels.archive * 100)}%</span>
                            </div>
                            <p className="text-xs text-text-secondary mt-1">Lower = more compression</p>
                        </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded text-xs">
                        <strong>💡 Tip:</strong> Leave at default (40% mid-term, 20% archive) for balanced performance. Increase if you notice forgetting important events.
                    </div>
                </div>

                {/* Summarizer Engine (also used for smart summarization) */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium">Summarizer Engine</label>
                    <SegmentedControl 
                        name="summarizerModel"
                        value={settings.contextManagement.summarizerModel}
                        options={[
                            { value: 'gemini', label: 'Gemini 2.5 Flash' },
                            { value: 'openrouter', label: 'OpenRouter' },
                            { value: 'koboldcpp', label: 'KoboldCPP (Local)' }
                        ]}
                        onChange={(e) => handleContextInputChange(e as any)}
                    />
                    {settings.contextManagement.summarizerModel === 'openrouter' && (
                        <>
                            {!settings.openRouterApiKey ? (
                                <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                    <p className="text-xs text-yellow-600 dark:text-yellow-400">
                                        ⚠️ Please add your OpenRouter API key in General settings first
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* Model Selector */}
                                    <div className="mt-3">
                                        <SelectInput
                                            label="OpenRouter Model"
                                            name="openRouterSummarizerModelId"
                                            value={settings.contextManagement.openRouterSummarizerModelId}
                                            onChange={handleOpenRouterModelChange}
                                            disabled={isLoadingModels}
                                            options={
                                                isLoadingModels
                                                    ? [{ value: '', label: 'Loading models...' }]
                                                    : openRouterModels.length > 0
                                                    ? openRouterModels.map(model => ({
                                                        value: model.id,
                                                        label: `${model.name || model.id}${model.pricing?.prompt ? ` ($${model.pricing.prompt}/1M tokens)` : ''}`
                                                      }))
                                                    : [{ value: settings.contextManagement.openRouterSummarizerModelId, label: settings.contextManagement.openRouterSummarizerModelId }]
                                            }
                                            helpText={isLoadingModels ? 'Fetching available models...' : `Selected: ${settings.contextManagement.openRouterSummarizerModelId}`}
                                        />
                                        {openRouterModels.length === 0 && !isLoadingModels && (
                                            <button
                                                onClick={loadOpenRouterModels}
                                                className="mt-2 px-3 py-1 text-xs font-medium new-chat-btn rounded"
                                            >
                                                Refresh Models
                                            </button>
                                        )}
                                    </div>

                                    {/* Test Connection */}
                                    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium">Test Connection:</span>
                                            <button
                                                onClick={handleTestOpenRouter}
                                                disabled={openRouterTestStatus === 'loading'}
                                                className="px-3 py-1 text-xs font-medium new-chat-btn rounded disabled:opacity-50"
                                            >
                                                {openRouterTestStatus === 'loading' ? 'Testing...' : 'Test Model'}
                                            </button>
                                        </div>
                                        {openRouterTestStatus !== 'idle' && (
                                            <div className="text-xs">
                                                {getStatusIndicator(openRouterTestStatus, openRouterTestMessage, openRouterTestMessage)}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* Debug Mode */}
                <div className="space-y-2">
                    <CheckboxInput 
                        name="debugMode"
                        checked={!!settings.contextManagement.debugMode}
                        onChange={handleContextInputChange}
                        label="Debug Mode"
                        helpText="Show detailed summarization logs in UI with performance insights (for testing and optimization)"
                    />
                </div>

                {settings.contextManagement.summarizerModel === 'koboldcpp' && (
                    <div>
                        <label htmlFor="koboldcppUrl-smart" className="block text-sm font-medium">KoboldCPP URL</label>
                        <div className="flex items-center gap-2 mt-1">
                            <input
                                type="text"
                                id="koboldcppUrl-smart"
                                name="koboldcppUrl"
                                value={settings.contextManagement.koboldcppUrl}
                                onChange={handleContextInputChange}
                                className="block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 modal-input"
                                placeholder="http://127.0.0.1:5001"
                            />
                            <button onClick={onConnect} disabled={connectionStatus === 'loading'} className="px-4 py-2 text-sm font-medium new-chat-btn rounded-lg disabled:opacity-50">
                                {connectionStatus === 'loading' ? '...' : 'Connect'}
                            </button>
                        </div>
                        <div className="h-4 mt-1">{getStatusIndicator(connectionStatus)}</div>
                    </div>
                )}
            </div>
         )}
    </div>
  );
};

export default ContextTab;