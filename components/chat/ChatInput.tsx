import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { SendIcon } from '../icons/SendIcon';
import { DramaIcon } from '../icons/DramaIcon';
import { BrainIcon } from '../icons/BrainIcon';
import { Settings } from '../../types';
import { PlusIcon } from '../icons/PlusIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import { PaperAirplaneIcon } from '../icons/PaperAirplaneIcon';
import { SlidersIcon } from '../icons/SlidersIcon';
import { ResponseControlSettings } from '../../hooks/useChatHandler';
import { StopIcon } from '../icons/StopIcon';
import { BrainPlusIcon } from '../icons/BrainPlusIcon';
import { PinIcon } from '../icons/PinIcon';
import { ImageIcon } from '../icons/ImageIcon';
import { XIcon } from '../icons/XIcon';
import { TrendingUpIcon } from '../icons/TrendingUpIcon';
import { convertImageToWebP } from '../../services/imageUtils';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  handleSend: (override?: string, oneTimeOverride?: string) => void;
  handleManualDirectorAI: () => void;
  handleManualLoreScan: () => void;
  isStreaming: boolean;
  isTransforming: boolean;
  isEnhancing: boolean;
  isSceneImpersonating: boolean;
  handleImpersonateScene: () => void;
  onOpenAddToIdentityModal: () => void;
  settings: Settings;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  characterName: string;
  handleAutopilot: () => void;
  handlePolishPrompt: () => void;
  // New: Props for the Response Control Panel
  responseControls: ResponseControlSettings;
  setResponseControls: (settings: ResponseControlSettings | ((prev: ResponseControlSettings) => ResponseControlSettings)) => void;
  // New: Props for stop button and timer
  generationTime: number;
  handleStopGeneration: () => void;
  // New: Image attachment
  attachedImage: { dataUrl: string; mimeType: string } | null;
  setAttachedImage: (img: { dataUrl: string; mimeType: string } | null) => void;
  // New: Scene background generation
  handleGenerateSceneBackground: () => void;
  isGeneratingBackground: boolean;
  // New: Debug mode
  onOpenDebugger?: () => void;
}

const ControlSlider: React.FC<{ label: string; value: number; min: number; max: number; step: number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; helpText: string; }> = ({ label, value, min, max, step, onChange, helpText }) => (
  <div>
    <div className="flex justify-between items-center text-xs">
      <label className="font-medium text-text-secondary">{label}</label>
      <span className="font-mono text-text-primary">{value.toFixed(2)}</span>
    </div>
    <input
      type="range"
      min={min} max={max} step={step} value={value}
      onChange={onChange}
      className="w-full h-1.5 bg-tertiary-bg rounded-lg appearance-none cursor-pointer"
    />
    <p className="text-xs text-text-secondary/70 -mt-1">{helpText}</p>
  </div>
);

// New: Helper to format seconds into M:SS format.
const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
};


const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  handleSend,
  handleManualDirectorAI,
  handleManualLoreScan,
  isStreaming,
  isTransforming,
  isEnhancing,
  isSceneImpersonating,
  handleImpersonateScene,
  onOpenAddToIdentityModal,
  settings,
  textareaRef,
  characterName,
  handleAutopilot,
  handlePolishPrompt,
  responseControls,
  setResponseControls,
  generationTime,
  handleStopGeneration,
  attachedImage,
  setAttachedImage,
  handleGenerateSceneBackground,
  isGeneratingBackground,
  onOpenDebugger,
}) => {
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const [showControlsPanel, setShowControlsPanel] = useState(false);
  const [showInstantConfigModal, setShowInstantConfigModal] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement>(null);
  const toolsButtonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ left: number; bottom: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Local ref to manage autosize smoothly in case external ref is not present yet
  const internalTextareaRef = useRef<HTMLTextAreaElement>(null);

  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as Node;
    const clickedInsideMenu = toolsMenuRef.current?.contains(target);
    const clickedTrigger = toolsButtonRef.current?.contains(target);
    if (!clickedInsideMenu && !clickedTrigger) {
      setIsToolsMenuOpen(false);
      setShowControlsPanel(false);
    }
  };
  
  useEffect(() => {
    if (!isToolsMenuOpen) return;
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isToolsMenuOpen]);

  // Keep menu positioned relative to the trigger but outside the capsule
  useEffect(() => {
    if (!isToolsMenuOpen) return;
    const update = () => {
      const btn = toolsButtonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      setMenuPosition({
        left: Math.round(rect.left),
        bottom: Math.round(window.innerHeight - rect.top + 8), // 8px gap above the button
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [isToolsMenuOpen]);

  // All controls except the input area should be disabled while streaming
  const allDisabled = isStreaming || isTransforming || isEnhancing || isSceneImpersonating;
  const inputDisabled = isTransforming || isEnhancing || isSceneImpersonating; // keep input enabled during streaming

  // Detect if device is mobile
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // On Desktop: Enter sends, Shift+Enter = new line
    // On Mobile: Enter = new line always
    if (!isMobile && e.key === 'Enter' && !e.shiftKey) {
      // While streaming, do not send; allow the user to keep typing and wait for completion
      if (isStreaming) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      handleSend();
    }
  }, [isMobile, isStreaming, handleSend]);

  // Auto-grow textarea for a refined, non-scroll experience up to a cap
  const autoGrow = useCallback(() => {
    const ta = (textareaRef?.current ?? internalTextareaRef.current);
    if (!ta) return;
    ta.style.height = '0px';
    const maxPx = 200; // ~12 lines depending on font size
    const newHeight = Math.min(ta.scrollHeight, maxPx);
    ta.style.height = newHeight + 'px';
    ta.style.overflowY = ta.scrollHeight > maxPx ? 'auto' : 'hidden';
  }, [textareaRef]);

  useEffect(() => {
    autoGrow();
  }, [input, autoGrow]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const originalDataUrl = reader.result as string;
        // Convert to WebP at high quality to reduce size while keeping fidelity.
        const webpDataUrl = await convertImageToWebP(originalDataUrl, 0.85);
        setAttachedImage({ dataUrl: webpDataUrl, mimeType: 'image/webp' });
      } catch {
        // Fallback to original if conversion fails for any reason.
        setAttachedImage({ dataUrl: reader.result as string, mimeType: file.type });
      }
    };
    reader.readAsDataURL(file);
  };

  const menuActions = [
    { id: 'autopilot', label: 'Chat Autopilot', icon: PaperAirplaneIcon, action: handleAutopilot, disabled: allDisabled, visible: true },
    { id: 'polish', label: 'Instant Prompt Enhancer', icon: SparklesIcon, action: handlePolishPrompt, disabled: allDisabled || !input.trim(), visible: true },
    { id: 'impersonate', label: 'Scene Impersonation', icon: DramaIcon, action: handleImpersonateScene, disabled: allDisabled, visible: true },
    { id: 'sceneBackground', label: 'Generate Scene Background', icon: ImageIcon, action: handleGenerateSceneBackground, disabled: allDisabled || isGeneratingBackground, visible: true },
    { id: 'addToIdentity', label: 'Add to Identity', icon: BrainPlusIcon, action: onOpenAddToIdentityModal, disabled: allDisabled, visible: true },
    { id: 'director', label: 'Director Intervention (Manual)', icon: DramaIcon, action: handleManualDirectorAI, disabled: allDisabled, visible: settings.directorAI.enabled },
    { id: 'lore', label: 'Check Character Updates', icon: BrainIcon, action: handleManualLoreScan, disabled: allDisabled, visible: settings.livingLore.enabled },
    { id: 'debugger', label: 'Summarization Debug', icon: TrendingUpIcon, action: () => onOpenDebugger?.(), disabled: false, visible: settings.contextManagement.debugMode }
  ].filter(item => item.visible);

  return (
        <div className="w-full max-w-3xl mx-auto flex flex-col items-center mb-4 px-3 sm:px-4 pb-[env(safe-area-inset-bottom)]">
            {/* Image Preview */}
            {attachedImage && (
                <div className="w-full mb-2">
                    <div className="inline-flex items-center gap-2 relative rounded-lg overflow-hidden border border-color bg-tertiary-bg/30 p-1 pr-8">
                        <img src={attachedImage.dataUrl} alt="Attached"
                             className="max-h-24 object-contain rounded-md bg-primary-bg" />
                        <button
                          onClick={() => setAttachedImage(null)}
                          className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-black/70"
                          aria-label="Remove"
                        >
                            <XIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
            
            {/* The Floating Capsule */}
            <div className="w-full flex items-end gap-2 p-1.5 sm:p-2 rounded-2xl chat-input-capsule">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                
                {/* Unified Tools Dropdown */}
                <div className="relative">
                    <button
                        ref={toolsButtonRef}
                        onClick={() => setIsToolsMenuOpen(prev => !prev)}
                        disabled={allDisabled}
                        className="p-2.5 sm:p-3 rounded-full text-text-secondary hover:bg-tertiary-bg disabled:opacity-50 flex-shrink-0"
                        aria-label="Tools Menu"
                        title="Tools & Settings"
                    >
                        <SlidersIcon className={`w-5 h-5 ${isToolsMenuOpen ? 'text-accent-primary' : ''}`} />
                    </button>
                    {isToolsMenuOpen && menuPosition && createPortal(
                        <div
                          ref={toolsMenuRef}
                          className="fixed w-72 rounded-lg shadow-xl z-[100] glass-panel"
                          style={{ left: menuPosition.left, bottom: menuPosition.bottom }}
                        >
                            {!showControlsPanel ? (
                                <ul className="py-1">
                                    {/* Attach Image */}
                                    <li>
                                        <button
                                            onClick={() => { fileInputRef.current?.click(); setIsToolsMenuOpen(false); }}
                                            disabled={allDisabled}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left text-text-primary hover:bg-tertiary-bg disabled:opacity-50"
                                        >
                                            <ImageIcon className={`w-5 h-5 ${attachedImage ? 'text-accent-primary' : ''}`} />
                                            <span>Attach Image</span>
                                        </button>
                                    </li>
                                    <div className="border-t border-color/30 my-1"></div>
                                    {/* AI Tools */}
                                    {menuActions.map(item => (
                                        <li key={item.id}>
                                            <button
                                                onClick={() => { item.action(); setIsToolsMenuOpen(false); }}
                                                disabled={item.disabled}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left text-text-primary hover:bg-tertiary-bg disabled:opacity-50"
                                            >
                                                <item.icon className="w-5 h-5" />
                                                <span>{item.label}</span>
                                            </button>
                                        </li>
                                    ))}
                                    <div className="border-t border-color/30 my-1"></div>
                                    {/* Response Controls */}
                                    <li>
                                        <button
                                            onClick={() => setShowControlsPanel(true)}
                                            disabled={allDisabled}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left text-text-primary hover:bg-tertiary-bg disabled:opacity-50"
                                        >
                                            <SlidersIcon className="w-5 h-5" />
                                            <span>Response Controls</span>
                                        </button>
                                    </li>
                                </ul>
                            ) : (
                                <div className="p-4 space-y-3">
                                    <div className="flex justify-between items-center mb-2">
                                        <button onClick={() => setShowControlsPanel(false)} className="text-text-secondary hover:text-accent-primary">
                                            <span className="text-lg">←</span>
                                        </button>
                                        <h4 className="text-sm font-semibold text-text-primary">Response Controls</h4>
                                        <button
                                            onClick={() => setResponseControls(prev => ({ ...prev, isPinned: !prev.isPinned }))}
                                            className={`p-1.5 rounded-full transition-colors ${responseControls.isPinned ? 'bg-accent-primary/20 text-accent-primary' : 'text-text-secondary hover:bg-tertiary-bg'}`}
                                            title={responseControls.isPinned ? "Pinned" : "Pin settings"}
                                        >
                                            <PinIcon className="w-4 h-4" style={{ fill: responseControls.isPinned ? 'currentColor' : 'none' }} />
                                        </button>
                                    </div>
                                    <ControlSlider 
                                        label="Creativity (Temperature)"
                                        value={responseControls.temperature ?? settings.temperature}
                                        min={0} max={2} step={0.05}
                                        onChange={e => setResponseControls(prev => ({...prev, temperature: parseFloat(e.target.value)}))}
                                        helpText="Higher = more random"
                                    />
                                    <ControlSlider 
                                        label="Focus (Top-P)"
                                        value={responseControls.topP ?? settings.topP}
                                        min={0} max={1} step={0.05}
                                        onChange={e => setResponseControls(prev => ({...prev, topP: parseFloat(e.target.value)}))}
                                        helpText="Lower = more coherent"
                                    />
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <label className="block text-xs font-medium text-text-secondary">Instant Instructions</label>
                                            <button
                                              type="button"
                                              onClick={() => setShowInstantConfigModal(true)}
                                              className="text-[10px] px-2 py-0.5 rounded-full text-accent-primary hover:bg-accent-primary/10"
                                              title="Customize Instant Instructions"
                                            >
                                              Customize
                                            </button>
                                        </div>
                                        <textarea
                                            value={responseControls.oneTimeInstruction ?? ''}
                                            onChange={e => setResponseControls(prev => ({ ...prev, oneTimeInstruction: e.target.value }))}
                                            placeholder="e.g., Describe the surrounding environment in detail"
                                            rows={2}
                                            className="w-full mt-1 p-2 text-xs border rounded-md modal-input"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>, document.body)
                    }
                </div>
                
                {/* Textarea */}
                <textarea
                    ref={(el) => {
                      if (textareaRef && 'current' in textareaRef) {
                        // keep external ref updated
                        // @ts-ignore - React.RefObject is readonly but runtime is fine
                        (textareaRef as React.RefObject<HTMLTextAreaElement>).current = el as HTMLTextAreaElement | null;
                      }
                      internalTextareaRef.current = el as HTMLTextAreaElement | null;
                    }}
                    value={input}
                    onChange={(e) => { setInput(e.target.value); }}
                    onInput={autoGrow}
                    onKeyDown={handleKeyDown}
                    placeholder={`Type a message to ${characterName}...`}
                    rows={1}
                    dir="auto"
                    enterKeyHint="send"
                    inputMode="text"
                    spellCheck={true}
                    aria-label="Chat input"
                    className="w-full bg-transparent px-2 py-2.5 text-base text-text-primary resize-none focus:outline-none focus:ring-0 max-h-40 overflow-y-hidden placeholder:text-text-secondary/60 mobile-scrollable-input"
                    disabled={inputDisabled}
                />
                
                {/* Send/Stop Button Area */}
                <div className="flex-shrink-0">
                    {isStreaming ? (
                        <div className="flex items-center gap-2 p-1.5 rounded-full bg-tertiary-bg">
                             <button
                                onClick={handleStopGeneration}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                                aria-label="Stop generation"
                            >
                                <StopIcon className="w-4 h-4" />
                            </button>
                            <span className="text-sm font-mono text-text-secondary pr-2 tabular-nums">
                                {formatTime(generationTime)}
                            </span>
                        </div>
                    ) : (
                        <button
                            onClick={() => handleSend()}
                            disabled={allDisabled || !input.trim()}
                            className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-full new-chat-btn disabled:bg-slate-400 dark:disabled:bg-gray-600 touch-target"
                            aria-label="Send message"
                        >
                            <SendIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Advanced Instant Instructions Modal */}
            {showInstantConfigModal && createPortal(
                <div className="fixed inset-0 z-[200] flex items-center justify-center">
                  <div className="absolute inset-0 bg-black/40" onClick={() => setShowInstantConfigModal(false)} />
                  <div className="relative w-full max-w-lg mx-4 rounded-xl glass-panel p-4">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-text-primary">Instant Instructions — Customize</h3>
                        <button onClick={() => setShowInstantConfigModal(false)} className="p-1 rounded hover:bg-tertiary-bg" aria-label="Close">
                            <XIcon className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-1">
                            <label className="block text-xs font-medium text-text-secondary">Tone</label>
                            <input
                                type="text"
                                value={responseControls.tone ?? ''}
                                onChange={e => setResponseControls(prev => ({ ...prev, tone: e.target.value }))}
                                placeholder="e.g., friendly, serious, playful"
                                className="w-full mt-1 p-2 text-xs border rounded-md modal-input"
                            />
                        </div>
                        <div className="sm:col-span-1">
                            <label className="block text-xs font-medium text-text-secondary">Writing Style</label>
                            <input
                                type="text"
                                value={responseControls.writingStyle ?? ''}
                                onChange={e => setResponseControls(prev => ({ ...prev, writingStyle: e.target.value }))}
                                placeholder="e.g., poetic, noir, technical"
                                className="w-full mt-1 p-2 text-xs border rounded-md modal-input"
                            />
                        </div>
                        <div className="sm:col-span-1">
                            <label className="block text-xs font-medium text-text-secondary">Answer Length</label>
                            <select
                                value={responseControls.answerLength ?? 'normal'}
                                onChange={e => setResponseControls(prev => ({ ...prev, answerLength: e.target.value as any }))}
                                className="w-full mt-1 p-2 text-xs border rounded-md modal-input"
                            >
                                <option value="short">Short / Concise</option>
                                <option value="normal">Normal / Balanced</option>
                                <option value="long">Long / Detailed</option>
                            </select>
                        </div>
                        <div className="sm:col-span-1">
                            <label className="block text-xs font-medium text-text-secondary">Balance</label>
                            <select
                                value={responseControls.styleBalance ?? 'balanced'}
                                onChange={e => setResponseControls(prev => ({ ...prev, styleBalance: e.target.value as any }))}
                                className="w-full mt-1 p-2 text-xs border rounded-md modal-input"
                            >
                                <option value="more_narration">More Narration</option>
                                <option value="balanced">Balanced</option>
                                <option value="more_dialogue">More Dialogue</option>
                            </select>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-text-secondary">Focus</label>
                            <textarea
                                value={responseControls.focus ?? ''}
                                onChange={e => setResponseControls(prev => ({ ...prev, focus: e.target.value }))}
                                placeholder="What should the AI focus on this turn?"
                                rows={2}
                                className="w-full mt-1 p-2 text-xs border rounded-md modal-input"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-text-secondary">Note</label>
                            <textarea
                                value={responseControls.note ?? ''}
                                onChange={e => setResponseControls(prev => ({ ...prev, note: e.target.value }))}
                                placeholder="Any extra note or constraint for this response"
                                rows={2}
                                className="w-full mt-1 p-2 text-xs border rounded-md modal-input"
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                        <button
                            onClick={() => setResponseControls(prev => ({ ...prev,
                                tone: undefined,
                                writingStyle: undefined,
                                focus: undefined,
                                note: undefined,
                                answerLength: undefined,
                                styleBalance: undefined,
                            }))}
                            className="text-xs px-3 py-1.5 rounded-md text-text-secondary hover:bg-tertiary-bg"
                        >
                            Reset
                        </button>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowInstantConfigModal(false)}
                                className="text-xs px-3 py-1.5 rounded-md bg-accent-primary text-white hover:opacity-90"
                            >
                                Done
                            </button>
                        </div>
                  </div>
                </div>
                </div>,
                document.body)
            }
        </div>
  );
};

export default ChatInput;

// Modal for advanced Instant Instructions customization
// Placed after default export to keep file structure minimal.
