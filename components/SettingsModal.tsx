import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Settings, UserPersona, Model, GetMeResponse, StoryArcLevel, IdentityProfile } from '../types';
import { verifyToken as verifyTelegramToken, sendMessage as sendTelegramMessage } from '../services/telegramService';
import { checkKoboldConnection, checkKoboldEmbeddingConnection } from '../services/koboldcppService';
import { fetchAvailableComfyUIModels } from '../services/comfyuiService';
import { fetchAvailableSDModels } from '../services/sdwebuiService';
import { fetchAvailableHFModels } from '../services/huggingfaceService';
import * as db from '../services/db';
import { useNotifications } from '../contexts/NotificationContext';
import { LoaderIcon } from './icons/LoaderIcon';
import { generateUUID } from '../utils/uuid';

// Import the new tab components
import GeneralTab from './settings/tabs/GeneralTab';
import AppearanceTab from './settings/tabs/AppearanceTab';
import PersonasTab from './settings/tabs/PersonasTab';
import ContextTab from './settings/tabs/ContextTab';
import MemoryTab from './settings/tabs/MemoryTab';
import AgentsTab from './settings/tabs/AgentsTab';
import StoryArcsTab from './settings/tabs/StoryArcsTab';
import ImageGenerationTab from './settings/tabs/ImageGenerationTab';
import TelegramTab from './settings/tabs/TelegramTab';
import PromptsTab from './settings/tabs/PromptsTab';
import WritingStyleTab from './settings/tabs/WritingStyleTab';
import ProactiveAgentTab from './settings/tabs/ProactiveAgentTab';
import DualResponseTab from './settings/tabs/DualResponseTab';
import LogsTab from './settings/tabs/LogsTab';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSave: (newSettings: Settings) => void;
  onLiveUpdate: (newSettings: Settings) => void;
  userPersonas: UserPersona[];
  onSaveUserPersona: (persona: UserPersona) => void;
  onDeleteUserPersona: (id: string) => void;
  identityProfiles: IdentityProfile[];
  onSaveIdentityProfile: (profile: IdentityProfile) => void;
  onDeleteIdentityProfile: (id: string) => void;
  selectedModel: Model;
  models?: Model[]; // Optional models list for dual response
  hasMorePersonas: boolean;
  onLoadMorePersonas: () => void;
  hasMoreIdentityProfiles: boolean;
  onLoadMoreIdentityProfiles: () => void;
  onOpen: () => void;
}

/**
 * Main Settings Modal Component
 * 
 * This component acts as a container and state manager for all settings.
 * It handles:
 * - The active tab state.
 * - The current settings state, allowing for live updates without saving.
 * - All handler functions for API connections, state changes, and saving.
 * - Rendering the correct tab component based on the active tab.
 * 
 * By centralizing logic here and delegating rendering to child components,
 * we achieve a clean separation of concerns.
 */
export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  settings, 
  onSave, 
  onLiveUpdate, 
  userPersonas, 
  onSaveUserPersona, 
  onDeleteUserPersona,
  identityProfiles,
  onSaveIdentityProfile,
  onDeleteIdentityProfile,
  selectedModel,
  models = [],
  hasMorePersonas, 
  onLoadMorePersonas,
  hasMoreIdentityProfiles,
  onLoadMoreIdentityProfiles,
  onOpen 
}) => {
  const [currentSettings, setCurrentSettings] = useState<Settings>(settings);
  const [activeTab, setActiveTab] = useState<string>('general');
  const [hostname, setHostname] = useState('');
  
  // Connection statuses for various services
  const [comfyConnectionStatus, setComfyConnectionStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [sdConnectionStatus, setSdConnectionStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [koboldConnectionStatus, setKoboldConnectionStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [telegramConnectionStatus, setTelegramConnectionStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [telegramConnectionError, setTelegramConnectionError] = useState<string | null>(null);
  const [hfConnectionStatus, setHfConnectionStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // Model lists fetched from services
  const [comfyCheckpoints, setComfyCheckpoints] = useState<string[]>([]);
  const [comfyUpscalers, setComfyUpscalers] = useState<string[]>([]);
  const [comfySamplers, setComfySamplers] = useState<string[]>([]);
  const [comfySchedulers, setComfySchedulers] = useState<string[]>([]);
  const [comfyLoras, setComfyLoras] = useState<string[]>([]);
  const [sdCheckpoints, setSdCheckpoints] = useState<string[]>([]);
  const [sdSamplers, setSdSamplers] = useState<string[]>([]);
  const [sdSchedulers, setSdSchedulers] = useState<string[]>(['Automatic', 'Karras', 'Exponential', 'Polyexponential']);
  const [sdUpscalers, setSdUpscalers] = useState<string[]>([]);
  const [sdFaceRestorers, setSdFaceRestorers] = useState<string[]>([]);
  const [sdAdModels, setSdAdModels] = useState<string[]>([]);
  const [sdVaes, setSdVaes] = useState<string[]>(['Automatic', 'None']);
  const [sdLoras, setSdLoras] = useState<{ name: string; alias?: string }[]>([]);
  const [hfModels, setHfModels] = useState<string[]>([]);

  const { addNotification } = useNotifications();
  
  // Effect to call onOpen when the modal becomes visible, used for pre-loading data.
  useEffect(() => {
    if (isOpen) {
      onOpen();
    }
  }, [isOpen, onOpen]);

  // Effect to synchronize the internal state with external settings prop when it changes.
  // Also resets connection statuses on modal open.
  useEffect(() => {
    setCurrentSettings(settings);
    setComfyConnectionStatus(settings.comfyUI.isConnected ? 'success' : 'idle');
    setSdConnectionStatus(settings.stableDiffusion.isConnected ? 'success' : 'idle');
    setTelegramConnectionStatus(settings.telegram.isConnected ? 'success' : 'idle');
    setHfConnectionStatus(settings.huggingFace.isConnected ? 'success' : 'idle');
    setKoboldConnectionStatus('idle'); // Reset on open
    if (typeof window !== 'undefined') {
        setHostname(window.location.hostname);
    }
  }, [settings, isOpen]);

  // Propagate settings changes up for live preview in the main app.
  const handleLiveUpdate = (newSettings: Settings) => {
    setCurrentSettings(newSettings);
    onLiveUpdate(newSettings);
  };

  // Final save action.
  const handleSave = () => {
    onSave(currentSettings);
    onClose();
  };

  // --- Connection Handlers ---

  const handleConnectKobold = useCallback(async () => {
    setKoboldConnectionStatus('loading');
    const isConnected = await checkKoboldConnection(currentSettings.contextManagement.koboldcppUrl);
    setKoboldConnectionStatus(isConnected ? 'success' : 'error');
  }, [currentSettings.contextManagement.koboldcppUrl]);

  const handleConnectComfyUI = useCallback(async () => {
    setComfyConnectionStatus('loading');
    try {
        const { checkpoints, upscaleModels, samplers, schedulers, loras } = await fetchAvailableComfyUIModels(currentSettings.comfyUI.url);
        setComfyCheckpoints(checkpoints);
        setComfyUpscalers(upscaleModels);
        setComfySamplers(samplers);
        setComfySchedulers(schedulers);
        setComfyLoras(loras || []);

        handleLiveUpdate({
            ...currentSettings,
            comfyUI: {
                ...currentSettings.comfyUI,
                isConnected: true,
                checkpoint: checkpoints.includes(currentSettings.comfyUI.checkpoint) ? currentSettings.comfyUI.checkpoint : checkpoints[0] || '',
                upscaleModel: upscaleModels.includes(currentSettings.comfyUI.upscaleModel) ? currentSettings.comfyUI.upscaleModel : upscaleModels[0] || '',
                sampler: samplers.includes(currentSettings.comfyUI.sampler) ? currentSettings.comfyUI.sampler : samplers[0] || '',
                scheduler: schedulers.includes(currentSettings.comfyUI.scheduler) ? currentSettings.comfyUI.scheduler : schedulers[0] || '',
            }
        });
        setComfyConnectionStatus('success');
    } catch (error) {
        console.error("Failed to connect to ComfyUI", error);
        handleLiveUpdate({ ...currentSettings, comfyUI: { ...currentSettings.comfyUI, isConnected: false } });
        setComfyConnectionStatus('error');
    }
  }, [currentSettings]);

  const handleConnectSD = useCallback(async () => {
    setSdConnectionStatus('loading');
    try {
        const { checkpoints, samplers, upscalers, faceRestorers, schedulers, adModels, vaes, loras } = await fetchAvailableSDModels(currentSettings.stableDiffusion.url);
        setSdCheckpoints(checkpoints);
        setSdSamplers(samplers);
        setSdUpscalers(upscalers);
        setSdFaceRestorers(['', ...faceRestorers]); // Add empty option for 'None'
        const schedulerOptions = schedulers.length > 0 ? schedulers : ['Automatic', 'Karras', 'Exponential', 'Polyexponential'];
        setSdSchedulers(schedulerOptions);
        setSdAdModels(adModels);
        setSdVaes((vaes && vaes.length > 0) ? vaes : ['Automatic', 'None']);
        setSdLoras(loras || []);

        const vaeOptions = (vaes && vaes.length > 0) ? vaes : ['Automatic', 'None'];
        const normalizedVae = vaeOptions.includes(currentSettings.stableDiffusion.vae) ? currentSettings.stableDiffusion.vae : vaeOptions[0];
        const refinerOptions = ['', ...checkpoints];
        const normalizedRefiner = refinerOptions.includes(currentSettings.stableDiffusion.refiner) ? currentSettings.stableDiffusion.refiner : '';
        const normalizedScheduler = schedulerOptions.includes(currentSettings.stableDiffusion.scheduler)
            ? currentSettings.stableDiffusion.scheduler
            : schedulerOptions[0] || 'Automatic';

        handleLiveUpdate({
            ...currentSettings,
            stableDiffusion: {
                ...currentSettings.stableDiffusion,
                isConnected: true,
                checkpoint: checkpoints.includes(currentSettings.stableDiffusion.checkpoint) ? currentSettings.stableDiffusion.checkpoint : checkpoints[0] || '',
                sampler: samplers.includes(currentSettings.stableDiffusion.sampler) ? currentSettings.stableDiffusion.sampler : samplers[0] || '',
                scheduler: normalizedScheduler,
                hiresUpscaler: upscalers.includes(currentSettings.stableDiffusion.hiresUpscaler) ? currentSettings.stableDiffusion.hiresUpscaler : upscalers[0] || '',
                faceRestoration: faceRestorers.includes(currentSettings.stableDiffusion.faceRestoration) ? currentSettings.stableDiffusion.faceRestoration : '',
                vae: normalizedVae || 'Automatic',
                refiner: normalizedRefiner,
            }
        });
        setSdConnectionStatus('success');
    } catch (error) {
        console.error("Failed to connect to Stable Diffusion WebUI", error);
        handleLiveUpdate({ ...currentSettings, stableDiffusion: { ...currentSettings.stableDiffusion, isConnected: false } });
        setSdConnectionStatus('error');
    }
  }, [currentSettings]);

  const handleConnectHF = useCallback(async () => {
    setHfConnectionStatus('loading');
    try {
        const models = await fetchAvailableHFModels(currentSettings.huggingFace.apiKey);
        setHfModels(models);

        handleLiveUpdate({
            ...currentSettings,
            huggingFace: {
                ...currentSettings.huggingFace,
                isConnected: true,
                model: models.includes(currentSettings.huggingFace.model) ? currentSettings.huggingFace.model : models[0] || '',
            }
        });
        setHfConnectionStatus('success');
    } catch (error) {
        console.error("Failed to connect to Hugging Face", error);
        handleLiveUpdate({ ...currentSettings, huggingFace: { ...currentSettings.huggingFace, isConnected: false } });
        setHfConnectionStatus('error');
    }
  }, [currentSettings]);

  const handleConnectTelegram = useCallback(async () => {
    setTelegramConnectionStatus('loading');
    setTelegramConnectionError(null);
    try {
        const response = await verifyTelegramToken(currentSettings.telegram.botToken);
        if (response.ok === false) {
            setTelegramConnectionError(response.description);
            handleLiveUpdate({ ...currentSettings, telegram: { ...currentSettings.telegram, isConnected: false, botUsername: '' } });
            setTelegramConnectionStatus('error');
        } else {
            handleLiveUpdate({
                ...currentSettings,
                telegram: {
                    ...currentSettings.telegram,
                    isConnected: true,
                    botUsername: response.result.username,
                }
            });
            setTelegramConnectionStatus('success');
        }
    } catch (error: any) {
        setTelegramConnectionError(error.message || 'A network error occurred.');
        handleLiveUpdate({ ...currentSettings, telegram: { ...currentSettings.telegram, isConnected: false, botUsername: '' } });
        setTelegramConnectionStatus('error');
    }
  }, [currentSettings]);

  if (!isOpen) return null;

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'writingStyle', label: 'Writing Style' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'personas', label: 'Personas' },
    { id: 'memory', label: 'Memory' },
    { id: 'proactive', label: 'Proactive Agent' },
    { id: 'prompts', label: 'Prompts' },
    { id: 'context', label: 'Context' },
    { id: 'agents', label: 'AI Agents' },
    { id: 'dualResponse', label: 'Dual Response' },
    { id: 'storyarcs', label: 'Story Arcs' },
    { id: 'imageGeneration', label: 'Image Generation' },
    { id: 'telegram', label: 'Telegram' },
    { id: 'logs', label: 'Logs' },
  ];
  
  const renderActiveTab = () => {
    const props = {
      settings: currentSettings,
      onLiveUpdate: handleLiveUpdate,
    };
    switch (activeTab) {
      case 'general':
        return <GeneralTab {...props} />;
      case 'writingStyle':
        return <WritingStyleTab {...props} />;
      case 'appearance':
        return <AppearanceTab {...props} />;
      case 'personas':
        return <PersonasTab 
                  {...props} 
                  userPersonas={userPersonas}
                  onSaveUserPersona={onSaveUserPersona}
                  onDeleteUserPersona={onDeleteUserPersona}
                  hasMorePersonas={hasMorePersonas}
                  onLoadMorePersonas={onLoadMorePersonas}
                />;
      case 'memory':
        return <MemoryTab 
                  {...props}
                  hostname={hostname}
                  identityProfiles={identityProfiles}
                  onSaveIdentityProfile={onSaveIdentityProfile}
                  onDeleteIdentityProfile={onDeleteIdentityProfile}
                  hasMoreIdentityProfiles={hasMoreIdentityProfiles}
                  onLoadMoreIdentityProfiles={onLoadMoreIdentityProfiles}
                />;
      case 'proactive':
        return <ProactiveAgentTab {...props} />;
      case 'prompts':
        return <PromptsTab {...props} />;
      case 'context':
        return <ContextTab 
                  {...props} 
                  selectedModel={selectedModel} 
                  connectionStatus={koboldConnectionStatus} 
                  onConnect={handleConnectKobold}
                  hostname={hostname}
                />;
      case 'agents':
        return <AgentsTab {...props} />;
      case 'dualResponse':
        return <DualResponseTab {...props} models={models.length > 0 ? models : [selectedModel]} />;
      case 'storyarcs':
        return <StoryArcsTab {...props} />;
      case 'imageGeneration':
        return <ImageGenerationTab 
                  {...props}
                  hostname={hostname}
                  comfyConnectionStatus={comfyConnectionStatus}
                  onConnectComfyUI={handleConnectComfyUI}
                  comfyCheckpoints={comfyCheckpoints}
                  comfySamplers={comfySamplers}
                  comfySchedulers={comfySchedulers}
                  comfyUpscalers={comfyUpscalers}
                  comfyLoras={comfyLoras}
                  sdConnectionStatus={sdConnectionStatus}
                  onConnectSD={handleConnectSD}
                  sdCheckpoints={sdCheckpoints}
                  sdSamplers={sdSamplers}
                  sdSchedulers={sdSchedulers}
                  sdUpscalers={sdUpscalers}
                  sdFaceRestorers={sdFaceRestorers}
                  sdAdModels={sdAdModels}
                  sdVaes={sdVaes}
                  sdLoras={sdLoras}
                  hfConnectionStatus={hfConnectionStatus}
                  onConnectHF={handleConnectHF}
                  hfModels={hfModels}
                />;
      case 'telegram':
        return <TelegramTab 
                  {...props}
                  connectionStatus={telegramConnectionStatus}
                  connectionError={telegramConnectionError}
                  onConnect={handleConnectTelegram}
                  addNotification={addNotification}
                />;
      case 'logs':
        return <LogsTab />;
      default:
        return null;
    }
  };

  return (
    <div 
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center transition-opacity"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
    >
      <div 
        className="modal-panel rounded-2xl shadow-2xl w-full max-w-5xl m-4 flex flex-col transform transition-transform scale-95 max-h-[90vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header - always visible */}
        <div className="flex-shrink-0 p-6 border-b border-color modal-header-bg rounded-t-2xl">
            <h2 id="settings-title" className="text-2xl font-bold">Settings</h2>
        </div>
        
        {/* Tabs bar - always visible at top with horizontal scroll */}
        <div className="flex-shrink-0 flex border-b border-color overflow-x-auto modal-header-bg shadow-sm scrollbar-thin">
          {tabs.map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)} 
              className={`px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === tab.id ? 'text-accent-primary border-b-2 border-accent-primary bg-accent-primary/5' : 'text-text-secondary hover:text-text-primary hover:bg-tertiary-bg/30'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content area - scrollable, takes remaining space */}
        <div className="flex-1 min-h-0 flex flex-col">
          {renderActiveTab()}
        </div>

        {/* Footer - always visible */}
        <div className="flex-shrink-0 flex justify-end gap-4 p-4 border-t border-color modal-footer-bg rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg focus:outline-none focus:ring-gray-500 btn-secondary">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 new-chat-btn">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
export default SettingsModal;
