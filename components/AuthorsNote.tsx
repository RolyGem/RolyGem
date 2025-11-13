import React, { useState, useEffect, useCallback } from 'react';
import { InfoIcon } from './icons/InfoIcon';
import type { Character, Lorebook, Conversation, NarrativeDirective, ConversationFact, Settings, SmartSystemConfig, MicroPromptCard } from '../types';
import { BrainIcon } from './icons/BrainIcon';
import { SegmentedControl } from './settings/common/SettingsInputComponents';
import { generateUUID } from '../utils/uuid';
import { TrashIcon } from './icons/TrashIcon';
import { PlusIcon } from './icons/PlusIcon';
import { Icon } from './icons/Icon';
// @google/genai-codelab-user-troubleshooting: FIX: Correct import path for callGeminiWithRetry.
import { callGeminiWithRetry } from '../utils/apiHelpers';
import { SparklesIcon } from './icons/SparklesIcon';
// @google/genai-codelab-user-troubleshooting: FIX: Import LoaderIcon component.
import { LoaderIcon } from './icons/LoaderIcon';
import { KeyFactsIcon } from './icons/KeyFactsIcon';
import { extractFactFromContext } from '../services/aiService';
import { useNotifications } from '../contexts/NotificationContext';
interface AuthorsNoteProps {
  systemPrompt: string;
  globalSystemPrompt: string;
  allCharacters: Character[];
  allLorebooks: Lorebook[];
  conversationCharacterIds: string[];
  conversationLorebookIds: string[];
  onSave: (settings: Partial<Conversation>) => void;
  isStreaming: boolean;
  modelId: string;
  enableThinking: boolean;
  onOpenUpdateKnowledgeModal: () => void;
  // New: Add props for Conscious State Engine settings
  consciousStateSettings: Conversation['consciousStateSettings'];
  // New: Add prop for multi-character mode
  multiCharacterMode: Conversation['multiCharacterMode'];
  // New: Add prop for scenario
  scenario: Conversation['scenario'];
  // New: Add prop for narrative directives
  narrativeDirectives?: NarrativeDirective[];
  // New: Add props for Key Facts feature
  facts?: ConversationFact[];
  conversationMessages: any[]; // For fact extraction context
  settings: Settings; // For AI service access
  // New: Add smart system config to prefill conscious state advanced options
  smartSystemConfig?: SmartSystemConfig;
  // New: Micro prompt cards
  microPromptCards?: MicroPromptCard[];
  activeMicroCardIds?: string[];
}
// Fix: Add gemini-2.5-flash-lite to the list of models that support toggling the thinking configuration.
const GEMINI_MODELS_WITH_THINKING_TOGGLE = [
  'gemini-2.5-flash', 
  'gemini-2.5-flash-lite',
  'models/gemini-flash-latest',
  'models/gemini-flash-lite-latest'
];
export const AuthorsNote: React.FC<AuthorsNoteProps> = ({ 
    systemPrompt, globalSystemPrompt, onSave, isStreaming, allCharacters, 
    allLorebooks, conversationCharacterIds, conversationLorebookIds, modelId, 
    enableThinking, onOpenUpdateKnowledgeModal, consciousStateSettings, multiCharacterMode, scenario,
    narrativeDirectives, facts, conversationMessages, settings, smartSystemConfig,
    microPromptCards = [], activeMicroCardIds: activeIdsProp = []
}) => {
  const { addNotification } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState(systemPrompt);
  const [isThinkingEnabled, setIsThinkingEnabled] = useState(enableThinking);
  const [selectedCharIds, setSelectedCharIds] = useState(new Set(conversationCharacterIds));
  const [selectedLorebookIds, setSelectedLorebookIds] = useState(new Set(conversationLorebookIds));
  // New: State for state engine settings
  const [stateEngineEnabled, setStateEngineEnabled] = useState(consciousStateSettings?.enabled ?? false);
  const [updateFrequency, setUpdateFrequency] = useState(consciousStateSettings?.updateFrequency ?? 2);
  const [scanDepth, setScanDepth] = useState(consciousStateSettings?.scanDepth ?? 4);
  // New: Advanced Conscious State Engine controls
  const initialCS = smartSystemConfig?.consciousState;
  const [csMode, setCsMode] = useState<'frequency' | 'smart'>(initialCS?.mode ?? 'smart');
  const [csEngineVersion, setCsEngineVersion] = useState<'v1' | 'v2' | 'shadow'>(initialCS?.engineVersion ?? 'v1');
  const [csThreshold, setCsThreshold] = useState<number>(initialCS?.emotionalChangeThreshold ?? 50);
  const [csFrequencyValue, setCsFrequencyValue] = useState<number>(initialCS?.frequencyValue ?? updateFrequency);
  // New: State for multi-character mode
  const [mode, setMode] = useState(multiCharacterMode ?? 'director');
  // New: State for scenario
  const [scenarioText, setScenarioText] = useState(scenario ?? '');
  // New: State for Narrative Directives
  const [directives, setDirectives] = useState(narrativeDirectives || []);
  const [editingDirective, setEditingDirective] = useState<NarrativeDirective | null>(null);
  const [isEnhancingGoal, setIsEnhancingGoal] = useState<string | null>(null);
  // New: State for Key Facts
  const [conversationFacts, setConversationFacts] = useState<ConversationFact[]>(facts || []);
  const [newFactInput, setNewFactInput] = useState('');
  const [isExtractingFact, setIsExtractingFact] = useState(false);
  const [factCategory, setFactCategory] = useState<ConversationFact['category']>('event');
  // New: Micro Prompt Cards state
  const [microCards, setMicroCards] = useState<MicroPromptCard[]>([]);
  const [activeMicroCardIds, setActiveMicroCardIds] = useState<string[]>([]);
  
  const canToggleThinking = GEMINI_MODELS_WITH_THINKING_TOGGLE.includes(modelId);
  const showMultiCharacterModeControl = selectedCharIds.size > 1;
  useEffect(() => {
    if (!isOpen) return;
    setPrompt(systemPrompt);
    setSelectedCharIds(new Set(conversationCharacterIds));
    setSelectedLorebookIds(new Set(conversationLorebookIds));
    setIsThinkingEnabled(canToggleThinking ? enableThinking : true);
    setStateEngineEnabled(consciousStateSettings?.enabled ?? false);
    setUpdateFrequency(consciousStateSettings?.updateFrequency ?? 2);
    setScanDepth(consciousStateSettings?.scanDepth ?? 4);
    // Prefill advanced Conscious State Engine controls
    const cs = smartSystemConfig?.consciousState;
    setCsMode(cs?.mode ?? 'smart');
    setCsEngineVersion(cs?.engineVersion ?? 'v1');
    setCsThreshold(cs?.emotionalChangeThreshold ?? 50);
    setCsFrequencyValue(cs?.frequencyValue ?? (consciousStateSettings?.updateFrequency ?? 2));
    setMode(multiCharacterMode ?? 'director');
    setScenarioText(scenario ?? '');
    setDirectives(narrativeDirectives?.map(d => ({ ...d, hunger: d.hunger || 0 })) || []);
    setEditingDirective(null);
    setConversationFacts(facts || []);
    setNewFactInput('');
    setMicroCards(microPromptCards || []);
    setActiveMicroCardIds(activeIdsProp || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
  
  const handleSave = () => {
    onSave({ 
        systemPrompt: prompt, 
        characterIds: Array.from(selectedCharIds),
        lorebookIds: Array.from(selectedLorebookIds),
        enableThinking: canToggleThinking ? isThinkingEnabled : true,
        consciousStateSettings: {
            enabled: stateEngineEnabled,
            updateFrequency: updateFrequency,
            scanDepth: scanDepth,
        },
        smartSystemConfig: {
            ...(smartSystemConfig || {}),
            consciousState: {
                ...(smartSystemConfig?.consciousState || {}),
                mode: csMode,
                engineVersion: csEngineVersion,
                emotionalChangeThreshold: csMode === 'smart' ? csThreshold : (smartSystemConfig?.consciousState?.emotionalChangeThreshold),
                frequencyValue: csMode === 'frequency' ? csFrequencyValue : (smartSystemConfig?.consciousState?.frequencyValue),
            }
        },
        multiCharacterMode: mode,
        scenario: scenarioText,
        narrativeDirectives: directives,
        facts: conversationFacts,
        microPromptCards: microCards,
        activeMicroCardIds,
    });
    setIsOpen(false);
  };
  
  const originalCharIds = new Set(conversationCharacterIds);
  const currentCharIds = new Set(selectedCharIds);
  const charsHaveChanged = originalCharIds.size !== currentCharIds.size || !Array.from(originalCharIds).every(id => currentCharIds.has(id));
  const originalLorebookIds = new Set(conversationLorebookIds);
  const currentLorebookIds = new Set(selectedLorebookIds);
  const lorebooksHaveChanged = originalLorebookIds.size !== currentLorebookIds.size || !Array.from(originalLorebookIds).every(id => currentLorebookIds.has(id));
  const thinkingHasChanged = canToggleThinking && isThinkingEnabled !== enableThinking;
  const stateEngineSettingsChanged = (consciousStateSettings?.enabled ?? false) !== stateEngineEnabled ||
                                    (consciousStateSettings?.updateFrequency ?? 2) !== updateFrequency ||
                                    (consciousStateSettings?.scanDepth ?? 4) !== scanDepth;
  const origCS = smartSystemConfig?.consciousState;
  const stateEngineAdvancedChanged = (origCS?.mode ?? 'smart') !== csMode ||
                                     (origCS?.engineVersion ?? 'v1') !== csEngineVersion ||
                                     (origCS?.emotionalChangeThreshold ?? 50) !== csThreshold ||
                                     (origCS?.frequencyValue ?? (consciousStateSettings?.updateFrequency ?? 2)) !== csFrequencyValue;
  const multiCharModeChanged = mode !== (multiCharacterMode ?? 'director');
  const scenarioChanged = scenarioText !== (scenario ?? '');
  const directivesChanged = JSON.stringify(directives) !== JSON.stringify(narrativeDirectives || []);
  const factsChanged = JSON.stringify(conversationFacts) !== JSON.stringify(facts || []);
  const hasChanges = prompt !== systemPrompt || charsHaveChanged || lorebooksHaveChanged || thinkingHasChanged || stateEngineSettingsChanged || stateEngineAdvancedChanged || multiCharModeChanged || scenarioChanged || directivesChanged || factsChanged;
  const microCardsChanged = JSON.stringify(microCards) !== JSON.stringify(microPromptCards || []) || JSON.stringify(activeMicroCardIds) !== JSON.stringify(activeIdsProp || []);
  const hasAnyChanges = hasChanges || microCardsChanged;
  
  // Keyboard shortcuts: Escape to close, Ctrl+S to save
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    
    // Escape to close
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
    
    // Ctrl+S (or Cmd+S on Mac) to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (hasAnyChanges && !isStreaming) {
        handleSave();
      }
    }
  }, [isOpen, hasAnyChanges, isStreaming]);
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
  
  const handleCharacterToggle = (charId: string) => {
      setSelectedCharIds(prev => {
          const newSet = new Set(prev);
          if (newSet.has(charId)) {
              newSet.delete(charId);
          } else {
              newSet.add(charId);
          }
          return newSet;
      });
  };
  const handleLorebookToggle = (bookId: string) => {
      setSelectedLorebookIds(prev => {
          const newSet = new Set(prev);
          if (newSet.has(bookId)) {
              newSet.delete(bookId);
          } else {
              newSet.add(bookId);
          }
          return newSet;
      });
  };
  
  const handleDirectiveChange = (id: string, field: keyof NarrativeDirective, value: any) => {
      setDirectives(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
  };
  
  const handleAddDirective = () => {
    const newDirective: NarrativeDirective = {
      id: generateUUID(),
      targetCharacterId: null,
      targetCharacterName: '',
      goal: '',
      pacing: 'medium',
      subtlety: 'hint',
      priority: 'normal',
      progress: 0,
      isCompleted: false,
      contextTriggers: [],
      hunger: 0,
    };
    setDirectives(prev => [...prev, newDirective]);
    setEditingDirective(newDirective);
  };
  
  const handleDeleteDirective = (id: string) => {
    setDirectives(prev => prev.filter(d => d.id !== id));
    if (editingDirective?.id === id) {
      setEditingDirective(null);
    }
  };
  
  const enhanceDirectiveGoal = async (rawGoal: string, directiveId: string) => {
    if (!rawGoal.trim()) return;
    setIsEnhancingGoal(directiveId);
    try {
        const cleanSystemPrompt = `You are a goal refiner. Rewrite the user's raw goal into a clear, specific, measurable directive, in the SAME language as the input. Keep it concise (max 20 words). Do NOT add persona/style instructions or meta commentary. Output only the rewritten goal text.`;
        
        const fixedUserPrompt = `Raw goal: "${rawGoal}"`;
        const response = await callGeminiWithRetry({
            model: 'gemini-2.5-flash-lite',
            contents: fixedUserPrompt,
            config: {
                systemInstruction: cleanSystemPrompt,
                temperature: 0.8,
                thinkingConfig: { thinkingBudget: 0 },
            }
        });
        const enhancedGoal = response.text.trim();
        if (enhancedGoal) {
            handleDirectiveChange(directiveId, 'goal', enhancedGoal);
        }
    } catch (error) {
        console.error("Error enhancing directive goal:", error);
    } finally {
        setIsEnhancingGoal(null);
    }
};
  // Key Facts Management Functions
  const handleAddFactManually = () => {
    if (!newFactInput.trim()) return;
    
    const newFact: ConversationFact = {
      id: generateUUID(),
      content: newFactInput.trim(),
      addedAt: Date.now(),
      category: factCategory,
      isActive: true,
      injectMode: 'system' // Default to system prompt injection
    };
    
    setConversationFacts([...conversationFacts, newFact]);
    setNewFactInput('');
  };
  
  const handleExtractFactWithAI = async () => {
    if (!newFactInput.trim() || !conversationMessages || conversationMessages.length === 0) return;
    
    setIsExtractingFact(true);
    try {
      const extractedFactText = await extractFactFromContext(
        conversationMessages,
        newFactInput.trim(),
        settings
      );
      
      const newFact: ConversationFact = {
        id: generateUUID(),
        content: extractedFactText,
        addedAt: Date.now(),
        category: factCategory,
        isActive: true,
        injectMode: 'system' // Default to system prompt injection
      };
      
      setConversationFacts([...conversationFacts, newFact]);
      setNewFactInput('');
    } catch (error: any) {
      console.error("Error extracting fact:", error);
      addNotification({ 
        title: 'Fact Extraction Failed', 
        message: error.message || 'Unknown error occurred while extracting fact.', 
        type: 'error' 
      });
    } finally {
      setIsExtractingFact(false);
    }
  };
  
  const handleToggleFact = (factId: string) => {
    setConversationFacts(conversationFacts.map(f =>
      f.id === factId ? { ...f, isActive: !f.isActive } : f
    ));
  };
  
  const handleDeleteFact = (factId: string) => {
    setConversationFacts(conversationFacts.filter(f => f.id !== factId));
  };
  
  const handleToggleInjectMode = (factId: string) => {
    setConversationFacts(conversationFacts.map(f => {
      if (f.id === factId) {
        const currentMode = f.injectMode || 'system';
        return { ...f, injectMode: currentMode === 'system' ? 'message' : 'system' };
      }
      return f;
    }));
  };
  
  // Helper to get category display info
  const getCategoryDisplay = (category?: ConversationFact['category']) => {
    const categoryMap = {
      event: { icon: '📅', label: 'Event', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
      relationship: { icon: '💕', label: 'Relationship', color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400' },
      secret: { icon: '🤫', label: 'Secret', color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
      decision: { icon: '⚖️', label: 'Decision', color: 'bg-green-500/10 text-green-600 dark:text-green-400' },
      custom: { icon: '📌', label: 'Custom', color: 'bg-gray-500/10 text-gray-600 dark:text-gray-400' }
    };
    return category ? categoryMap[category] : null;
  };
  const activeCharacters = allCharacters.filter(c => conversationCharacterIds.includes(c.id));
  const activeLorebooks = allLorebooks.filter(lb => conversationLorebookIds.includes(lb.id));
  const isDisplayingActiveItems = !isOpen && (activeCharacters.length > 0 || activeLorebooks.length > 0);
  const showThinkingToggle = canToggleThinking;
  const paddingClass = isDisplayingActiveItems ? 'pb-2 sm:pb-3' : 'pb-1';
  return (
    <div className={`authors-note-bg px-3 border-b ${paddingClass}`}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between w-full text-sm font-medium text-text-secondary pt-2 sm:pt-3">
            <button onClick={() => setIsOpen(!isOpen)} className="flex-1 flex items-center gap-2 text-left">
                <span>Conversation Settings</span>
                <div className="group relative">
                    <InfoIcon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <div className="absolute bottom-full mb-2 w-64 p-2 text-xs text-left text-white bg-gray-900 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        Configure the AI's personality, response style, context memory, and available characters/lore for this conversation.
                        <br/><br/>
                        <strong>⌨️ Shortcuts:</strong> Press <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">Esc</kbd> to close • <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">Ctrl+S</kbd> to save
                    </div>
                </div>
                <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            <div className="flex items-center">
                 <button onClick={onOpenUpdateKnowledgeModal} disabled={isStreaming} className="p-1.5 rounded-full action-button transition-colors disabled:opacity-50" aria-label="Update Knowledge from History" title="Update Knowledge from History">
                    <div className="group relative">
                        <BrainIcon className="w-5 h-5" />
                        <div className="absolute bottom-full mb-2 right-0 w-48 p-2 text-xs text-center text-white bg-gray-900 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            Update characters and lore from recent chat history.
                        </div>
                    </div>
                 </button>
            </div>
        </div>
        
        {isDisplayingActiveItems && (
          <div className="mt-2 space-y-1 text-xs text-text-secondary">
            {activeCharacters.length > 0 && (
                <div>
                    <span className="font-semibold">Characters: </span>
                    <span className="text-text-primary">
                    {activeCharacters.map(c => c.name).join(', ')}
                    </span>
                </div>
            )}
            {activeLorebooks.length > 0 && (
                <div>
                    <span className="font-semibold">Lorebooks: </span>
                    <span className="text-text-primary">
                    {activeLorebooks.map(c => c.name).join(', ')}
                    </span>
                </div>
            )}
          </div>
        )}
        {isOpen && (
          <div className="mt-2 sm:mt-3 flex flex-col gap-3 sm:gap-4 max-h-[60vh] overflow-y-auto overflow-x-hidden pr-1 sm:pr-2">
             <div>
                <label htmlFor="system-prompt" className="block text-xs font-medium text-text-secondary mb-1">System Prompt (Author's Note)</label>
                <textarea
                  id="system-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={`Defaults to global prompt: "${globalSystemPrompt.substring(0, 80)}..."`}
                  className="w-full p-2 border rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm modal-input"
                  rows={3}
                  disabled={isStreaming}
                />
            </div>
            {/* Scenario Section */}
            <div>
                <label htmlFor="scenario" className="block text-xs font-medium text-text-secondary mb-1">
                  Scenario (Current Setting/Context)
                  <div className="group relative inline-block ml-1">
                    <InfoIcon className="w-3 h-3 inline" />
                    <div className="absolute bottom-full mb-2 w-64 p-2 text-xs text-left text-white bg-gray-900 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      Describe the current setting or situation (e.g., "At the cafe", "At school", "In the forest at night"). This will be included in the AI's context.
                    </div>
                  </div>
                </label>
                <input
                  id="scenario"
                  type="text"
                  value={scenarioText}
                  onChange={(e) => setScenarioText(e.target.value)}
                  placeholder="e.g., At the cafe, At school, On a trip..."
                  className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm modal-input"
                  disabled={isStreaming}
                />
            </div>
            {/* Enable Thinking Section */}
            {showThinkingToggle && (
                 <div>
                    <label className="flex items-center gap-2 text-xs font-medium text-text-secondary cursor-pointer">
                         <input 
                            type="checkbox" 
                            checked={isThinkingEnabled} 
                            onChange={(e) => setIsThinkingEnabled(e.target.checked)} 
                            disabled={isStreaming} 
                            className="h-4 w-4 rounded border-color text-accent-primary focus:ring-accent-primary disabled:opacity-50"
                         />
                         Enable Thinking
                         <div className="group relative">
                            <InfoIcon className="w-3 h-3" />
                            <div className="absolute bottom-full mb-2 w-64 p-2 text-xs text-left text-white bg-gray-900 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                When enabled (default), the model thinks before responding for higher quality. When disabled, it responds faster but may have lower quality.
                            </div>
                        </div>
                    </label>
                 </div>
            )}
            {/* Characters and Lorebooks Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Characters</label>
                    <div className="p-2 bg-tertiary-bg border border-color rounded-lg">
                        {allCharacters.length === 0 ? (
                            <p className="text-xs text-center text-text-secondary p-4">No characters created.</p>
                        ) : (
                            <div className="max-h-32 overflow-y-auto space-y-1">
                                {allCharacters.map(char => (
                                    <label key={char.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-tertiary-bg cursor-pointer">
                                        <input type="checkbox" checked={selectedCharIds.has(char.id)} onChange={() => handleCharacterToggle(char.id)} disabled={isStreaming} className="h-4 w-4 rounded border-color text-accent-primary focus:ring-accent-primary"/>
                                        <span className="text-sm">{char.name}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                 <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Lorebooks</label>
                    <div className="p-2 bg-tertiary-bg border border-color rounded-lg">
                        {allLorebooks.length === 0 ? (
                            <p className="text-xs text-center text-text-secondary p-4">No lorebooks created.</p>
                        ) : (
                            <div className="max-h-32 overflow-y-auto space-y-1">
                                {allLorebooks.map(book => (
                                    <label key={book.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-tertiary-bg cursor-pointer">
                                        <input type="checkbox" checked={selectedLorebookIds.has(book.id)} onChange={() => handleLorebookToggle(book.id)} disabled={isStreaming} className="h-4 w-4 rounded border-color text-accent-primary focus:ring-accent-primary"/>
                                        <span className="text-sm">{book.name}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {/* Multi-Character Mode Section */}
            {showMultiCharacterModeControl && (
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Multi-Character Mode</label>
                <SegmentedControl
                  name="multiCharacterMode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as 'director' | 'narrator')}
                  options={[
                    { label: 'Director Mode', value: 'director' },
                    { label: 'Narrator Mode', value: 'narrator' },
                  ]}
                />
                <p className="text-xs text-text-secondary mt-1">
                  'Director' is for direct dialogue (e.g., Character: "Hello"). 'Narrator' is for third-person storytelling.
                </p>
              </div>
            )}
            {/* Key Facts Section */}
            <div className="p-2 sm:p-3 border rounded-lg border-color bg-tertiary-bg/30 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium text-text-primary">
                        <KeyFactsIcon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                        <span className="whitespace-nowrap">Key Facts</span>
                        <div className="group relative">
                            <InfoIcon className="w-3 h-3 flex-shrink-0" />
                            <div className="absolute bottom-full mb-2 w-48 sm:w-64 p-2 text-xs text-left text-white bg-gray-900 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                Important confirmed events from the conversation. The AI will reference these for consistency and continuity. Mark facts as inactive to temporarily exclude them without deleting.
                                <br/><br/>
                                <strong>📝/💬 Icon:</strong> Click to switch injection mode (System Prompt vs Message).
                            </div>
                        </div>
                    </div>
                    {conversationFacts.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent-primary/20 text-accent-primary font-medium whitespace-nowrap">
                            {conversationFacts.filter(f => f.isActive).length} Active
                        </span>
                    )}
                </div>
                <p className="text-xs text-text-secondary">
                    Add confirmed facts manually or extract them from the conversation using AI. <span className="font-medium">📝/💬 = Switch injection mode</span>
                </p>
                
                {/* Facts List */}
                {conversationFacts.length > 0 && (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {conversationFacts.map(fact => (
                            <div key={fact.id} className="flex items-start gap-1.5 sm:gap-2 p-1.5 sm:p-2 bg-secondary-bg rounded-md border border-color/50 hover:border-color transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={fact.isActive}
                                    onChange={() => handleToggleFact(fact.id)}
                                    disabled={isStreaming}
                                    className="mt-0.5 sm:mt-1 h-3.5 w-3.5 sm:h-4 sm:w-4 rounded border-color text-accent-primary focus:ring-accent-primary disabled:opacity-50 flex-shrink-0"
                                    title={fact.isActive ? "Active (will be used by AI)" : "Inactive (ignored by AI)"}
                                    aria-label={fact.isActive ? "Deactivate fact" : "Activate fact"}
                                />
                                <div className="flex-1 min-w-0">
                                    <p className={`text-xs sm:text-sm break-words ${fact.isActive ? 'text-text-primary' : 'text-text-secondary line-through'}`}>
                                        {fact.content}
                                    </p>
                                    {fact.category && (() => {
                                        const categoryInfo = getCategoryDisplay(fact.category);
                                        return categoryInfo ? (
                                            <span className={`inline-flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full ${categoryInfo.color} mt-1`}>
                                                <span className="text-xs sm:text-sm">{categoryInfo.icon}</span>
                                                <span>{categoryInfo.label}</span>
                                            </span>
                                        ) : null;
                                    })()}
                                </div>
                                <button 
                                    onClick={() => handleToggleInjectMode(fact.id)}
                                    disabled={isStreaming}
                                    className="p-0.5 sm:p-1 rounded hover:bg-accent-primary/10 transition-colors disabled:opacity-50 flex-shrink-0"
                                    title={fact.injectMode === 'message' ? "💬 Message Mode (injected before each response)\nClick to switch to System mode" : "📝 System Mode (added to system prompt)\nClick to switch to Message mode"}
                                    aria-label={fact.injectMode === 'message' ? "Switch to system prompt mode" : "Switch to message injection mode"}
                                >
                                    <span className="text-sm sm:text-base">
                                        {fact.injectMode === 'message' ? '💬' : '📝'}
                                    </span>
                                </button>
                                <button 
                                    onClick={() => handleDeleteFact(fact.id)}
                                    disabled={isStreaming}
                                    className="p-0.5 sm:p-1 rounded hover:bg-red-500/10 transition-colors disabled:opacity-50 flex-shrink-0"
                                    title="Delete Fact"
                                    aria-label="Delete fact"
                                >
                                    <TrashIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-text-secondary hover:text-red-500"/>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                
                {/* Add New Fact Form */}
                <div className="space-y-2 pt-2 border-t border-color/30">
                    <div className="flex flex-col sm:flex-row gap-2">
                        <select
                            value={factCategory}
                            onChange={e => setFactCategory(e.target.value as ConversationFact['category'])}
                            disabled={isStreaming || isExtractingFact}
                            className="px-2 py-1 text-xs border rounded-md modal-input w-full sm:w-auto"
                            aria-label="Select fact category"
                        >
                            <option value="event">📅 Event</option>
                            <option value="relationship">💕 Relationship</option>
                            <option value="secret">🤫 Secret</option>
                            <option value="decision">⚖️ Decision</option>
                            <option value="custom">📌 Custom</option>
                        </select>
                        <input
                            type="text"
                            value={newFactInput}
                            onChange={e => setNewFactInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAddFactManually()}
                            placeholder="Describe a fact..."
                            disabled={isStreaming || isExtractingFact}
                            className="flex-1 px-2 py-1 text-sm border rounded-md modal-input min-w-0"
                            aria-label="Fact description"
                        />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <button 
                            onClick={handleAddFactManually}
                            disabled={isStreaming || isExtractingFact || !newFactInput.trim()}
                            className="flex-1 py-2 text-xs sm:text-sm font-medium rounded-md bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Add fact manually"
                        >
                            Add Manually
                        </button>
                        <button 
                            onClick={handleExtractFactWithAI}
                            disabled={isStreaming || isExtractingFact || !newFactInput.trim()}
                            className="flex-1 flex items-center justify-center gap-1 sm:gap-2 py-2 text-xs sm:text-sm font-medium rounded-md bg-accent-primary text-white hover:bg-accent-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label={isExtractingFact ? "Extracting fact with AI..." : "Extract fact with AI"}
                        >
                            {isExtractingFact ? (
                                <>
                                    <LoaderIcon className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                                    <span className="hidden sm:inline">Extracting...</span>
                                    <span className="sm:hidden">...</span>
                                </>
                            ) : (
                                <>
                                    <SparklesIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                                    <span className="hidden sm:inline">Extract with AI</span>
                                    <span className="sm:hidden">AI Extract</span>
                                </>
                            )}
                        </button>
                    </div>
                    <p className="text-xs text-text-secondary italic hidden sm:block">
                        💡 Tip: "Extract with AI" analyzes the last 20 messages to create a precise fact based on your description.
                    </p>
                </div>
            </div>
            <div className="p-3 border rounded-lg border-color bg-tertiary-bg/30">
                <label className="flex items-center gap-2 text-sm font-medium text-text-primary cursor-pointer">
                    <input type="checkbox" checked={stateEngineEnabled} onChange={(e) => setStateEngineEnabled(e.target.checked)} disabled={isStreaming} className="h-4 w-4 rounded border-color text-accent-primary focus:ring-accent-primary"/>
                    Enable Conscious State Engine
                </label>
                <p className="text-xs text-text-secondary mt-1 pl-6">Helps the AI remember key facts like location and mood. Requires extra API calls.</p>
                {stateEngineEnabled && (
                    <div className="pl-6 mt-3 space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-text-secondary mb-1">Update Frequency (every X messages)</label>
                            <input type="number" value={updateFrequency} onChange={e => setUpdateFrequency(Number(e.target.value))} min="1" max="10" className="w-24 p-1 border rounded-md modal-input text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-text-secondary mb-1">Scan Depth (last X messages)</label>
                            <input type="number" value={scanDepth} onChange={e => setScanDepth(Number(e.target.value))} min="2" max="10" className="w-24 p-1 border rounded-md modal-input text-sm" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-text-secondary mb-1">Engine Mode</label>
                                <select value={csMode} onChange={e => setCsMode(e.target.value as 'smart' | 'frequency')} className="w-40 p-1 border rounded-md modal-input text-sm">
                                    <option value="smart">Smart</option>
                                    <option value="frequency">Frequency</option>
                                </select>
                                <p className="text-[11px] text-text-secondary mt-1">Smart uses emotional dynamics; Frequency checks every N messages.</p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-text-secondary mb-1">Engine Version</label>
                                <select value={csEngineVersion} onChange={e => setCsEngineVersion(e.target.value as 'v1' | 'v2' | 'shadow')} className="w-40 p-1 border rounded-md modal-input text-sm">
                                    <option value="v1">V1 (Legacy)</option>
                                    <option value="v2">V2 (Delta + Merge)</option>
                                    <option value="shadow">Shadow (Test Only)</option>
                                </select>
                                <p className="text-[11px] text-text-secondary mt-1">Shadow logs V2 result without changing state.</p>
                            </div>
                        </div>
                        {csMode === 'smart' && (
                            <div>
                                <label className="block text-xs font-medium text-text-secondary mb-1">Emotional Change Threshold (0-100)</label>
                                <input type="number" value={csThreshold} onChange={e => setCsThreshold(Number(e.target.value))} min="0" max="100" className="w-24 p-1 border rounded-md modal-input text-sm" />
                            </div>
                        )}
                        {csMode === 'frequency' && (
                            <div>
                                <label className="block text-xs font-medium text-text-secondary mb-1">Override Frequency Value (optional)</label>
                                <input type="number" value={csFrequencyValue} onChange={e => setCsFrequencyValue(Number(e.target.value))} min="1" max="10" className="w-24 p-1 border rounded-md modal-input text-sm" />
                                <p className="text-[11px] text-text-secondary mt-1">If empty, falls back to Update Frequency above.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div className="p-3 border rounded-lg border-color bg-tertiary-bg/30 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                        <Icon className="w-5 h-5">
                            <circle cx="12" cy="12" r="10"></circle>
                            <circle cx="12" cy="12" r="6"></circle>
                            <circle cx="12" cy="12" r="2"></circle>
                        </Icon>
                        <span>Narrative Directives (Will Engine)</span>
                    </div>
                    {directives.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent-primary/20 text-accent-primary font-medium">
                            {directives.length} {directives.length === 1 ? 'Directive' : 'Directives'}
                        </span>
                    )}
                </div>
                <p className="text-xs text-text-secondary pl-7 -mt-2">
                    Set long-term goals for characters to guide their development over time. The AI will subtly work towards these goals during the conversation.
                </p>
                {directives.length === 0 ? (
                    <div className="pl-7 py-4 text-center">
                        <p className="text-sm text-text-secondary mb-3">No directives set. Add one to guide character development!</p>
                    </div>
                ) : (
                    directives.map(d => {
                        // Show empty state if no active characters in conversation
                        const activeCharsInConvo = allCharacters.filter(c => conversationCharacterIds.includes(c.id));
                        
                        return (
                        <div key={d.id} className="pl-7 space-y-3 border-t border-color pt-3">
                            <div className="flex justify-between items-start gap-2">
                                 {activeCharsInConvo.length > 0 ? (
                                    <select 
                                        value={d.targetCharacterName || ''} 
                                        onChange={e => handleDirectiveChange(d.id, 'targetCharacterName', e.target.value)}
                                        className="flex-1 p-2 border rounded-md modal-input text-sm font-semibold"
                                        disabled={isStreaming}
                                    >
                                        <option value="">Select Character...</option>
                                        {activeCharsInConvo.map(char => (
                                            <option key={char.id} value={char.name}>{char.name}</option>
                                        ))}
                                    </select>
                                 ) : (
                                    <div className="flex-1 p-2 border rounded-md bg-yellow-500/10 border-yellow-500/30 text-sm text-yellow-600 dark:text-yellow-400">
                                        ⚠️ No characters in conversation. Add characters first.
                                    </div>
                                 )}
                                 <button 
                                    onClick={() => handleDeleteDirective(d.id)}
                                    className="p-2 rounded hover:bg-red-500/10 transition-colors"
                                    disabled={isStreaming}
                                    title="Delete Directive"
                                 >
                                    <TrashIcon className="w-4 h-4 text-text-secondary hover:text-red-500"/>
                                 </button>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-xs font-medium text-text-secondary">Ultimate Goal / Destiny</label>
                                    <button onClick={() => enhanceDirectiveGoal(d.goal, d.id)} disabled={isEnhancingGoal === d.id || !d.goal} className="px-2 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20 disabled:opacity-50">
                                        {isEnhancingGoal === d.id ? <LoaderIcon className="w-3.5 h-3.5"/> : <SparklesIcon className="w-3.5 h-3.5"/>}
                                        {isEnhancingGoal === d.id ? 'Enhancing...' : 'Enhance'}
                                    </button>
                                </div>
                                <textarea 
                                    value={d.goal} 
                                    onChange={e => handleDirectiveChange(d.id, 'goal', e.target.value)} 
                                    placeholder="e.g., Discover their true identity, Fall in love with another character, Overcome their fear..."
                                    rows={3} 
                                    className="w-full p-2 border rounded-md modal-input text-sm resize-none"
                                    disabled={isStreaming || isEnhancingGoal === d.id}
                                />
                                <p className="text-xs text-text-secondary mt-1 italic">
                                    💡 Tip: Be specific but allow room for natural development.
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1">Priority</label>
                                    <select 
                                        value={d.priority || 'normal'} 
                                        onChange={e => handleDirectiveChange(d.id, 'priority', e.target.value)} 
                                        className="w-full p-2 border rounded-md modal-input text-sm"
                                        disabled={isStreaming}
                                    >
                                        <option value="low">🔵 Low Priority</option>
                                        <option value="normal">⚪ Normal</option>
                                        <option value="high">🟡 High Priority</option>
                                        <option value="urgent">🔴 Urgent</option>
                                    </select>
                                    <p className="text-xs text-text-secondary mt-1 italic">Higher priority = activates more often</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1">Approach</label>
                                    <select 
                                        value={d.subtlety} 
                                        onChange={e => handleDirectiveChange(d.id, 'subtlety', e.target.value)} 
                                        className="w-full p-2 border rounded-md modal-input text-sm"
                                        disabled={isStreaming}
                                    >
                                        <option value="hint">Subtle Hints</option>
                                        <option value="action">Small Actions</option>
                                        <option value="confrontation">Direct Events</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1">Pacing</label>
                                    <select 
                                        value={d.pacing} 
                                        onChange={e => handleDirectiveChange(d.id, 'pacing', e.target.value)} 
                                        className="w-full p-2 border rounded-md modal-input text-sm"
                                        disabled={isStreaming}
                                    >
                                        <option value="slow">Slow (Rarely)</option>
                                        <option value="medium">Medium (Balanced)</option>
                                        <option value="fast">Fast (Frequently)</option>
                                        <option value="aggressive">Aggressive (Forced)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1">Progress</label>
                                    <div className="relative">
                                        <div className="w-full h-8 bg-tertiary-bg border border-color rounded-md flex items-center px-2">
                                            <div className="flex-1 h-2 bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full transition-all ${
                                                        (d.progress || 0) >= 80 ? 'bg-green-500' :
                                                        (d.progress || 0) >= 50 ? 'bg-yellow-500' :
                                                        'bg-blue-500'
                                                    }`}
                                                    style={{ width: `${d.progress || 0}%` }}
                                                />
                                            </div>
                                            <span className="ml-2 text-xs font-medium text-text-primary">
                                                {d.progress || 0}%
                                            </span>
                                        </div>
                                        {d.isCompleted && (
                                            <span className="absolute -top-1 -right-1 text-lg" title="Goal Completed!">✅</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-text-secondary mt-1 italic">AI-evaluated automatically</p>
                                </div>
                            </div>
                        </div>
                        );
                    })
                )}
                 <button 
                    onClick={handleAddDirective} 
                    className="w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold text-accent-primary bg-accent-primary/10 rounded-lg hover:bg-accent-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isStreaming || (directives.length > 0 && directives.some(d => !d.targetCharacterName || !d.goal))}
                    title={directives.length > 0 && directives.some(d => !d.targetCharacterName || !d.goal) ? "Complete existing directives first" : "Add new directive"}
                    aria-label="Add narrative directive"
                 >
                    <PlusIcon className="w-4 h-4" /> Add Directive
                </button>
            </div>
            {/* Micro Prompt Cards Section */}
            <div className="p-2 sm:p-3 border rounded-lg border-color bg-tertiary-bg/30 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary">Prompt Cards (up to 3 active)</h3>
                <span className="text-xs text-text-secondary">{microCards.filter(c => activeMicroCardIds.includes(c.id)).length}/3 active</span>
              </div>
              <p className="text-xs text-text-secondary">
                Create cards with instant one-time instructions for your next response. Activate up to 3 cards to display above the input box.
              </p>
              {microCards.length === 0 && (
                <p className="text-xs text-text-secondary">No cards yet. Add quick one-time prompts you can trigger with a tap.</p>
              )}
              <div className="space-y-2">
                {microCards.map((card) => {
                  const activeSet = new Set(activeMicroCardIds);
                  const active = activeSet.has(card.id);
                  const effectiveActiveCount = microCards.filter(c => activeSet.has(c.id)).length;
                  const canToggleOn = active || effectiveActiveCount < 3;
                  return (
                    <div key={card.id} className="p-2 border rounded-md border-color bg-secondary-bg/40">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => {
                            setActiveMicroCardIds(prev => {
                              const set = new Set(prev);
                              if (set.has(card.id)) { set.delete(card.id); }
                              else if (canToggleOn) { set.add(card.id); }
                              // Clean any non-existent IDs
                              const cleaned = Array.from(set).filter(id => microCards.some(c => c.id === id));
                              return cleaned;
                            });
                          }}
                          disabled={!canToggleOn}
                          className="h-4 w-4 rounded border-color text-accent-primary focus:ring-accent-primary disabled:opacity-50"
                          title={active ? "Active" : (canToggleOn ? "Activate" : "Limit reached")}
                        />
                        <input
                          type="text"
                          value={card.title}
                          onChange={e => setMicroCards(prev => prev.map(c => c.id === card.id ? { ...c, title: e.target.value } : c))}
                          placeholder="Card title (e.g., Polite Response)"
                          className="flex-1 px-2 py-1 text-xs border rounded-md modal-input"
                        />
                        <input
                          type="text"
                          value={card.emoji || ''}
                          onChange={e => setMicroCards(prev => prev.map(c => c.id === card.id ? { ...c, emoji: e.target.value } : c))}
                          placeholder="🙂"
                          className="w-16 px-2 py-1 text-xs border rounded-md modal-input text-center"
                          maxLength={2}
                        />
                        <button
                          onClick={() => {
                            setMicroCards(prev => {
                              const next = prev.filter(c => c.id !== card.id);
                              setActiveMicroCardIds(ids => ids.filter(id => id !== card.id && next.some(c => c.id === id)));
                              return next;
                            });
                          }}
                          className="px-2 py-1 text-xs rounded-md btn-secondary"
                        >Delete</button>
                      </div>
                      <textarea
                        value={card.prompt}
                        onChange={e => setMicroCards(prev => prev.map(c => c.id === card.id ? { ...c, prompt: e.target.value } : c))}
                        placeholder="One-time instruction to inject for this card"
                        rows={2}
                        className="w-full mt-2 p-2 text-xs border rounded-md modal-input"
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between items-center pt-1 gap-2 flex-wrap">
                <button
                  onClick={() => {
                    const id = generateUUID();
                    const newCard: MicroPromptCard = { id, title: 'Polite Response', prompt: 'Please respond politely and warmly.', emoji: '🙂' };
                    const nextCards = [...microCards, newCard];
                    const nextActive = activeMicroCardIds.length < 3 ? [...activeMicroCardIds, id] : activeMicroCardIds;
                    setMicroCards(nextCards);
                    setActiveMicroCardIds(nextActive);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md btn-secondary"
                >Add Card</button>
                {!hasAnyChanges ? null : (
                  <span className="text-[11px] text-text-secondary">Unsaved changes</span>
                )}
              </div>
            </div>
            {/* Smart AI Systems Info - Read-only for now */}
            <div className="p-3 border rounded-lg border-color bg-tertiary-bg/30 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                    <Icon className="w-5 h-5">
                        <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                        <path d="M2 17l10 5 10-5M2 12l10 5 10-5"></path>
                    </Icon>
                    <span>Smart AI Systems Status</span>
                </div>
                <p className="text-xs text-text-secondary pl-7">
                    All AI systems (Will Engine, Director AI, Living Lore, Conscious State) are now using <strong>intelligent detection</strong> instead of fixed intervals. They activate only when needed, reducing API costs significantly.
                </p>
                <div className="pl-7 grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span className="text-text-secondary">Will Engine: Context-Aware</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span className="text-text-secondary">Director AI: Smart Intervention</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span className="text-text-secondary">Living Lore: Event Detection</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span className="text-text-secondary">Conscious State: Emotional Dynamics</span>
                    </div>
                </div>
            </div>
              <div className="flex justify-end">
              <button 
                onClick={handleSave} 
                className="px-3 py-1 text-sm font-medium new-chat-btn rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isStreaming || !hasAnyChanges}
                aria-label="Save conversation settings"
                title={!hasAnyChanges ? "No changes to save" : "Save settings (Ctrl+S)"}
              >
                Save
              </button>
              </div>
          </div>
        )}
      </div>
    </div>
  );
};
