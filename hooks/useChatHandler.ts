import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Conversation, Message, Model, Settings, Character, UserPersona, Lorebook, RagMemory, IdentityProfile, NarrativeDirective, SongGenerationData } from '../types';
import { 
    streamChatResponse, 
    streamDualChatResponse,
    transformToImagePrompt, 
    generateSceneBackgroundPrompt,
    getDirectorSuggestion, 
    getLivingLoreSuggestion, 
    getCustomDirectorSuggestion,
    streamAutopilotResponse,
    streamPromptPolish,
    summarizeMessageContent,
    generateConversationTitle,
    updateConversationState,
    updateConversationStateV2,
    streamForeshadowingMessages,
    impersonateScene,
    removeFiller,
    editMessageWithInstruction,
    verifyDirectiveProgress,
    analyzeDirectiveContext,
    analyzeDirectorNeed,
    analyzeLivingLoreSignificance,
    analyzeEmotionalDynamics,
    generateSongFromContext
} from '../services/aiService';
import { generateImage as generateComfyUIImage } from '../services/comfyuiService';
import { generateImage as generateSDImage } from '../services/sdwebuiService';
import { generateImage as generateHFImage } from '../services/huggingfaceService';
import { generateImage as generateXAIImage } from '../services/xaiImageService';
import { getRagMetadataForCollection, saveConversation } from '../services/db';
import { deleteMemories, addMessagesToCollection } from '../services/ragService';
import { generateUUID } from '../utils/uuid';
import { useNotifications } from '../contexts/NotificationContext';
import { DEFAULT_RESPONSE_CONTROLS } from '../constants';

/**
 * Interface for the temporary, per-response control settings.
 * Defined locally as it's only used within this hook and its child component.
 */
export interface ResponseControlSettings {
  temperature?: number;
  topP?: number;
  oneTimeInstruction?: string;
  isPinned?: boolean;
  // Advanced Instant Instructions fields
  tone?: string; // e.g., friendly, serious, playful
  writingStyle?: string; // e.g., poetic, noir, technical
  focus?: string; // focus areas/topics
  note?: string; // additional note
  answerLength?: 'short' | 'normal' | 'long'; // desired response length
  styleBalance?: 'more_narration' | 'balanced' | 'more_dialogue'; // narration vs dialogue balance
}

/**
 * Props for the useChatHandler hook.
 * This includes all dependencies needed from the parent component.
 */
interface ChatHandlerProps {
  conversation: Conversation | null;
  onConversationUpdate: (updatedConversation: Conversation) => void;
  models: Model[];
  allCharacters: Character[];
  allLorebooks: Lorebook[];
  allUserPersonas: UserPersona[];
  allIdentityProfiles: IdentityProfile[];
  selectedModel: Model;
  settings: Settings;
  onOpenLivingLoreModal: (character: Character, suggestedChange: string) => void;
  onSettingsUpdate: (updatedSettings: Settings) => void;
}

/**
 * useChatHandler Custom Hook
 *
 * This hook centralizes all the business logic for the chat interface. It manages state,
 * handles API calls, and processes user interactions like sending, editing, and deleting messages.
 * By extracting this logic from ChatView, we make the view component simpler, more readable,
 * and focused solely on rendering the UI.
 *
 * @param props - The dependencies required from the parent component.
 * @returns An object containing state values and handler functions for the ChatView.
 */
export const useChatHandler = (props: ChatHandlerProps) => {
  const {
    conversation, onConversationUpdate, models, allCharacters,
    allLorebooks, allUserPersonas, allIdentityProfiles, selectedModel, settings, onOpenLivingLoreModal, onSettingsUpdate
  } = props;

  // --- State Management ---
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isTransforming, setIsTransforming] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isSceneImpersonating, setIsSceneImpersonating] = useState(false);
  const [isImpersonatedInput, setIsImpersonatedInput] = useState(false);
  const [directorAICounter, setDirectorAICounter] = useState(0);
  // New: State for the Response Control Panel (default: pin enabled)
  const [responseControls, setResponseControls] = useState<ResponseControlSettings>(DEFAULT_RESPONSE_CONTROLS);
  // New: State for generation timer and abort controller.
  const [generationTime, setGenerationTime] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);
  const managedHistoryAppliedRef = useRef(false);
  const [attachedImage, setAttachedImage] = useState<{ dataUrl: string; mimeType: string } | null>(null);
  // New: State for song generation
  const [isGeneratingSong, setIsGeneratingSong] = useState(false);
  // New: State for scene background generation
  const [isGeneratingBackground, setIsGeneratingBackground] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { addNotification } = useNotifications();
  
  // Use a ref to hold the latest conversation state to avoid stale closures in async callbacks.
  const conversationRef = useRef(conversation);
  // Ref to track if Director AI is currently generating a suggestion (prevents duplicate calls)
  const isDirectorAIGenerating = useRef(false);
  
  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  // Persist Response Controls per-conversation (localStorage)
  useEffect(() => {
    const convId = conversation?.id;
    if (!convId) return;
    try {
      const raw = localStorage.getItem(`responseControls:${convId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as ResponseControlSettings;
        setResponseControls(parsed || DEFAULT_RESPONSE_CONTROLS);
      } else {
        setResponseControls(DEFAULT_RESPONSE_CONTROLS);
      }
    } catch (e) {
      // Fallback to defaults if parsing fails
      setResponseControls(DEFAULT_RESPONSE_CONTROLS);
    }
  }, [conversation?.id]);

  useEffect(() => {
    const convId = conversation?.id;
    if (!convId) return;
    try {
      localStorage.setItem(`responseControls:${convId}`,
        JSON.stringify(responseControls || {})
      );
    } catch {}
  }, [conversation?.id, responseControls]);
  
  // Auto-resize the text area as the user types.
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);
  
  const handleSetInput = (value: string) => {
    setInput(value);
    if (isImpersonatedInput) {
      setIsImpersonatedInput(false);
    }
  };

  // --- Core Logic Callbacks (memoized for performance) ---

  const runComfyUIImageGeneration = useCallback(async (prompt: string, currentConversation: Conversation) => {
    if (!settings.comfyUI.isConnected) {
        addNotification({ title: 'ComfyUI Not Connected', message: 'Please configure and connect to ComfyUI in the settings.', type: 'error' });
        return;
    }
    setIsStreaming(true);

    const modelMessage: Message = {
        id: generateUUID(), role: 'model', content: prompt, timestamp: Date.now(),
        isGeneratingImage: true, imageGenerationProgress: 'Starting...', imageGenerator: 'comfyui',
    };
    
    let updatedConversation = { ...currentConversation, messages: [...currentConversation.messages, modelMessage] };
    onConversationUpdate(updatedConversation);
    
    try {
        const { dataUrl } = await generateComfyUIImage(prompt, settings.comfyUI, (progress) => {
            onConversationUpdate({ 
                ...updatedConversation, 
                messages: updatedConversation.messages.map(m => m.id === modelMessage.id ? { ...m, imageGenerationProgress: progress } : m)
            });
        });
        
        const finalModelMessage: Message = { ...modelMessage, isGeneratingImage: false, imageUrl: dataUrl, imageGenerationProgress: 'Completed' };
        updatedConversation.messages[updatedConversation.messages.length - 1] = finalModelMessage;

    } catch (err: any) {
         addNotification({ title: 'ComfyUI Error', message: err.message, type: 'error' });
         const errorModelMessage: Message = { ...modelMessage, isGeneratingImage: false, content: `Sorry, I encountered an error generating the image. \n\n**Details:** ${err.message}` };
         updatedConversation.messages[updatedConversation.messages.length - 1] = errorModelMessage;
    } finally {
        onConversationUpdate(updatedConversation);
        setIsStreaming(false);
        await saveConversation(updatedConversation);
    }
  }, [settings.comfyUI, onConversationUpdate]);

  const runSDImageGeneration = useCallback(async (prompt: string, currentConversation: Conversation) => {
    if (!settings.stableDiffusion.isConnected) {
        addNotification({ title: 'Stable Diffusion Not Connected', message: 'Please configure and connect to Stable Diffusion WebUI in the settings.', type: 'error' });
        return;
    }
    setIsStreaming(true);

    const modelMessage: Message = {
        id: generateUUID(), role: 'model', content: prompt, timestamp: Date.now(),
        isGeneratingImage: true, imageGenerationProgress: 'Starting...', imageGenerator: 'sdwebui',
    };
    
    let updatedConversation = { ...currentConversation, messages: [...currentConversation.messages, modelMessage] };
    onConversationUpdate(updatedConversation);
    
    try {
        const imageUrl = await generateSDImage(prompt, settings.stableDiffusion, (progress) => {
            onConversationUpdate({ 
                ...updatedConversation, 
                messages: updatedConversation.messages.map(m => m.id === modelMessage.id ? { ...m, imageGenerationProgress: progress } : m)
            });
        });
        
        const finalModelMessage: Message = { ...modelMessage, isGeneratingImage: false, imageUrl: imageUrl, imageGenerationProgress: 'Completed' };
        updatedConversation.messages[updatedConversation.messages.length - 1] = finalModelMessage;

    } catch (err: any) {
         addNotification({ title: 'Stable Diffusion Error', message: err.message, type: 'error' });
         const errorModelMessage: Message = { ...modelMessage, isGeneratingImage: false, content: `Sorry, I encountered an error generating the image. \n\n**Details:** ${err.message}` };
         updatedConversation.messages[updatedConversation.messages.length - 1] = errorModelMessage;
    } finally {
        onConversationUpdate(updatedConversation);
        setIsStreaming(false);
        await saveConversation(updatedConversation);
    }
  }, [settings.stableDiffusion, onConversationUpdate]);
  
  const runHFImageGeneration = useCallback(async (prompt: string, currentConversation: Conversation) => {
    if (!settings.huggingFace.isConnected) {
        addNotification({ title: 'Hugging Face Not Connected', message: 'Please configure and connect to Hugging Face in the settings.', type: 'error' });
        return;
    }
    setIsStreaming(true);

    const modelMessage: Message = {
        id: generateUUID(), role: 'model', content: prompt, timestamp: Date.now(),
        isGeneratingImage: true, imageGenerationProgress: 'Starting...', imageGenerator: 'huggingface',
    };
    
    let updatedConversation = { ...currentConversation, messages: [...currentConversation.messages, modelMessage] };
    onConversationUpdate(updatedConversation);
    
    try {
        const imageUrl = await generateHFImage(prompt, settings.huggingFace, (progress) => {
            onConversationUpdate({ 
                ...updatedConversation, 
                messages: updatedConversation.messages.map(m => m.id === modelMessage.id ? { ...m, imageGenerationProgress: progress } : m)
            });
        });
        
        const finalModelMessage: Message = { ...modelMessage, isGeneratingImage: false, imageUrl: imageUrl, imageGenerationProgress: 'Completed' };
        updatedConversation.messages[updatedConversation.messages.length - 1] = finalModelMessage;

    } catch (err: any) {
         addNotification({ title: 'Hugging Face Error', message: err.message, type: 'error' });
         const errorModelMessage: Message = { ...modelMessage, isGeneratingImage: false, content: `Sorry, I encountered an error generating the image. \n\n**Details:** ${err.message}` };
         updatedConversation.messages[updatedConversation.messages.length - 1] = errorModelMessage;
    } finally {
        onConversationUpdate(updatedConversation);
        setIsStreaming(false);
        await saveConversation(updatedConversation);
    }
  }, [settings.huggingFace, onConversationUpdate]);

  const runXAIImageGeneration = useCallback(async (prompt: string, currentConversation: Conversation) => {
    if (!settings.xaiApiKey) {
        addNotification({ title: 'XAI API Key Missing', message: 'Please add your XAI API key in the settings to use Grok image generation.', type: 'error' });
        return;
    }
    setIsStreaming(true);

    const modelMessage: Message = {
        id: generateUUID(), role: 'model', content: prompt, timestamp: Date.now(),
        isGeneratingImage: true, imageGenerationProgress: 'Starting...', imageGenerator: 'xai',
    };
    
    let updatedConversation = { ...currentConversation, messages: [...currentConversation.messages, modelMessage] };
    onConversationUpdate(updatedConversation);
    
    try {
        const imageUrl = await generateXAIImage(prompt, settings, (progress) => {
            onConversationUpdate({ 
                ...updatedConversation, 
                messages: updatedConversation.messages.map(m => m.id === modelMessage.id ? { ...m, imageGenerationProgress: progress } : m)
            });
        });
        
        const finalModelMessage: Message = { ...modelMessage, isGeneratingImage: false, imageUrl: imageUrl, imageGenerationProgress: 'Completed' };
        updatedConversation.messages[updatedConversation.messages.length - 1] = finalModelMessage;

    } catch (err: any) {
         addNotification({ title: 'XAI Image Generation Error', message: err.message, type: 'error' });
         const errorModelMessage: Message = { ...modelMessage, isGeneratingImage: false, content: `Sorry, I encountered an error generating the image. \n\n**Details:** ${err.message}` };
         updatedConversation.messages[updatedConversation.messages.length - 1] = errorModelMessage;
    } finally {
        onConversationUpdate(updatedConversation);
        setIsStreaming(false);
        await saveConversation(updatedConversation);
    }
  }, [settings, onConversationUpdate]);

  const handleInjectMessage = useCallback((message: Message) => {
      const conv = conversationRef.current;
      if (!conv) return;
      onConversationUpdate({ ...conv, messages: [...conv.messages, message] });
  }, [onConversationUpdate]);

  const runStreamingResponse = useCallback(async (
    history: Message[], 
    currentConversation: Conversation,
    overrideSettings?: Partial<Pick<Settings, 'temperature' | 'topP'>>,
    oneTimeInstruction?: string
  ) => {
      const modelForThisConversation = selectedModel;
      const finalSettings = { ...settings, ...overrideSettings };

      if (!modelForThisConversation) {
          addNotification({ title: 'Model Not Found', message: `Could not find the selected model "${settings.defaultModelId}". Please select a valid model in settings.`, type: 'error' });
          setIsStreaming(false);
          return;
      }

      if (modelForThisConversation.provider === 'OpenRouter' && !settings.openRouterApiKey) {
          addNotification({ title: 'API Key Missing', message: 'API key for OpenRouter is not set. Please configure it in the settings.', type: 'error' });
          setIsStreaming(false);
          return;
      }

      if (modelForThisConversation.provider === 'XAI' && !settings.xaiApiKey) {
          addNotification({ title: 'API Key Missing', message: 'API key for XAI is not set. Please configure it in the settings.', type: 'error' });
          setIsStreaming(false);
          return;
      }
      
      let historyForAI = [...history];
      if (oneTimeInstruction && historyForAI.length > 0) {
          const lastUserMessageIndex = historyForAI.map(m => m.role).lastIndexOf('user');
          if (lastUserMessageIndex > -1) {
              const lastUserMessage = { ...historyForAI[lastUserMessageIndex] };
              lastUserMessage.content = `[Instruction For This Turn Only]: ${oneTimeInstruction}\n\n${lastUserMessage.content}`;
              historyForAI[lastUserMessageIndex] = lastUserMessage;
          }
      }

      setIsStreaming(true);
      setGenerationTime(0);
      abortControllerRef.current = new AbortController();
      timerRef.current = window.setInterval(() => setGenerationTime(t => t + 1), 1000);

      let updatedConversation = { ...currentConversation, messages: [...history] };
      
      const thinkingMessage: Message = {
          id: generateUUID(), role: 'model', content: '', timestamp: Date.now(),
          isThinking: true,
      };
      
      updatedConversation.messages.push(thinkingMessage);
      onConversationUpdate({ ...updatedConversation });

      const applyManagedHistory = (managedHistory: Message[]) => {
          if (!managedHistory || managedHistory.length === 0) return;
          const currentSnapshot = conversationRef.current;
          if (!currentSnapshot) return;
          const nextMessages = [...managedHistory];
          const thinkingInSnapshot = currentSnapshot.messages.find(m => m.id === thinkingMessage.id);
          if (thinkingInSnapshot && !nextMessages.some(m => m.id === thinkingInSnapshot.id)) {
              nextMessages.push(thinkingInSnapshot);
          }
          const mergedConversation = { ...currentSnapshot, messages: nextMessages };
          conversationRef.current = mergedConversation;
          onConversationUpdate(mergedConversation);
          return mergedConversation;
      };

      const foreshadowController = new AbortController();
      if (modelForThisConversation.id === 'gemini-2.5-pro' && finalSettings.geminiProThinkingMessages) {
          // Get active characters for context
          const conversationCharactersForForeshadow = allCharacters.filter(char => currentConversation.characterIds?.includes(char.id));
          
          streamForeshadowingMessages(
              historyForAI,
              (chunk) => {
                  const currentConv = conversationRef.current;
                  if (!currentConv) return;
                  const messages = [...currentConv.messages];
                  const lastMessage = messages[messages.length - 1];
                  if (lastMessage && lastMessage.id === thinkingMessage.id && lastMessage.isThinking) {
                      lastMessage.content += chunk;
                      onConversationUpdate({ ...currentConv, messages });
                  }
              },
              foreshadowController.signal,
              finalSettings,
              conversationCharactersForForeshadow
          ).catch(err => {
              if (err.name !== 'AbortError') console.warn("Foreshadowing stream failed:", err);
          });
      }

      const conversationCharacters = allCharacters.filter(char => currentConversation.characterIds?.includes(char.id));
      const activeUserPersona = allUserPersonas.find(p => p.id === settings.activeUserPersonaId) || null;
      const activeLorebooks = allLorebooks.filter(lb => currentConversation.lorebookIds?.includes(lb.id));
      
      const onStatusUpdate = (status: string) => {
          const conv = conversationRef.current;
          if (!conv) return;
          const updatedMessages = conv.messages.map(m => 
              m.id === thinkingMessage.id ? { ...m, retryStatus: status } : m
          );
          onConversationUpdate({ ...conv, messages: updatedMessages });
      };
      
      managedHistoryAppliedRef.current = false;

      try {
      await streamChatResponse(
          currentConversation, historyForAI, modelForThisConversation, finalSettings, conversationCharacters, activeLorebooks, activeUserPersona, allIdentityProfiles,
          (chunk, newHistory) => {
              if (!foreshadowController.signal.aborted) {
                  foreshadowController.abort();
              }
              const currentConv = conversationRef.current;
              if (!currentConv) return;

              if (newHistory && newHistory.length > 0 && !managedHistoryAppliedRef.current) {
                  const merged = applyManagedHistory(newHistory);
                  if (merged) {
                      managedHistoryAppliedRef.current = true;
                  }
              }
               
              const messages = [...currentConv.messages];
              const lastMessage = messages[messages.length - 1];

              if (lastMessage && lastMessage.id === thinkingMessage.id) {
                if (lastMessage.isThinking) {
                    lastMessage.isThinking = false;
                    lastMessage.content = chunk;
                } else {
                    lastMessage.content += chunk;
                }
                onConversationUpdate({ ...currentConv, messages });
              }
          },
          (err) => {
              if (!foreshadowController.signal.aborted) foreshadowController.abort();
              addNotification({ title: 'AI Error', message: err.message, type: 'error' });
              const currentConv = conversationRef.current;
              if (currentConv) {
                const messages = [...currentConv.messages];
                const lastMessage = messages[messages.length - 1];
                if(lastMessage && lastMessage.id === thinkingMessage.id) {
                    lastMessage.isThinking = false;
                    lastMessage.content = `Sorry, I encountered an error. Please try again. \n\n**Details:** ${err.message}`;
                    onConversationUpdate({ ...currentConv, messages });
                }
              }
          },
          async (totalTokens, fullResponseText, modelMessage, directivesToUpdate) => {
            if (timerRef.current) clearInterval(timerRef.current);
            
            const latestConversation = conversationRef.current;
            if (!latestConversation) return;

            const finalModelMessage: Message = { ...modelMessage, isThinking: false, content: fullResponseText.trim(), tokenCount: totalTokens };
            const finalMessages = latestConversation.messages.map(m => m.id === thinkingMessage.id ? finalModelMessage : m);

            let finalConversationState: Conversation = { ...latestConversation, messages: finalMessages };

            if (directivesToUpdate) {
                finalConversationState.narrativeDirectives = directivesToUpdate;
            }
            
            onConversationUpdate(finalConversationState);
            
            if (finalConversationState.messages.length === 2 && finalConversationState.title === 'New Conversation') {
                generateConversationTitle(
                    finalConversationState.messages[0].content,
                    finalConversationState.messages[1].content
                ).then(newTitle => {
                    const conversationForTitleUpdate = conversationRef.current;
                    if (conversationForTitleUpdate && conversationForTitleUpdate.id === finalConversationState.id) {
                         const updatedConvWithTitle = { ...conversationForTitleUpdate, title: newTitle };
                         onConversationUpdate(updatedConvWithTitle);
                         saveConversation(updatedConvWithTitle);
                    }
                });
            } else {
                 await saveConversation(finalConversationState);
            }
            
            // Await RAG memory creation to prevent race conditions before next action.
            if (settings.rag.enabled && finalConversationState.ragCollectionName && fullResponseText.trim()) {
                const lastUserMessage = historyForAI[historyForAI.length - 1];
                await addMessagesToCollection(
                    finalConversationState.ragCollectionName,
                    [lastUserMessage, finalModelMessage],
                    settings,
                    settings.rag.chunkSize
                ).catch(e => console.error("Failed to add messages to RAG store:", e));
            }
            
            // Set streaming to false only after all async operations are complete.
            setGenerationTime(0);
            setIsStreaming(false);

            // Conscious State - Smart or Frequency Mode (Engine v1/v2/shadow)
            const activeCharsForState = allCharacters.filter(char => finalConversationState.characterIds?.includes(char.id));
            if (finalConversationState.consciousStateSettings?.enabled && activeCharsForState.length > 0) {
                const { updateFrequency, scanDepth } = finalConversationState.consciousStateSettings;
                const smartConfig = finalConversationState.smartSystemConfig?.consciousState;
                const engineVersion = smartConfig?.engineVersion || 'v1';
                const useSmartMode = smartConfig?.mode === 'smart';
                
                let shouldUpdate = false;
                
                if (useSmartMode) {
                    // Smart Mode: Check emotional dynamics
                    const recentMessages = finalConversationState.messages.slice(-8);
                    try {
                        const analysis = await analyzeEmotionalDynamics(
                            recentMessages,
                            finalConversationState.consciousState,
                            activeCharsForState,
                            settings
                        );
                        
                        const threshold = smartConfig.emotionalChangeThreshold || 50;
                        shouldUpdate = analysis.changeScore >= threshold;
                        
                        if (analysis.shouldUpdate && analysis.reason) {
                            console.log(`[Conscious State] Emotional dynamics changed (score: ${analysis.changeScore}): ${analysis.reason}`);
                        }
                    } catch (err) {
                        console.error("Failed to analyze emotional dynamics:", err);
                    }
                } else {
                    // Frequency Mode: Traditional check every N messages
                    const freq = smartConfig?.frequencyValue || updateFrequency;
                    shouldUpdate = finalConversationState.messages.filter(m => m.role === 'user').length % freq === 0;
                }
                
                if (shouldUpdate) {
                    const recentMessages = finalConversationState.messages.slice(-scanDepth);

                    if (engineVersion === 'v2') {
                        // Use the new delta-based engine
                        updateConversationStateV2(finalConversationState.consciousState || null, recentMessages, activeCharsForState, settings).then(newState => {
                            const convToUpdate = conversationRef.current;
                            if (convToUpdate && convToUpdate.id === finalConversationState.id) {
                                const updatedConv = { ...convToUpdate, consciousState: newState };
                                onConversationUpdate(updatedConv);
                                saveConversation(updatedConv);
                            }
                        }).catch(err => {
                            console.error("Failed to update conscious state (v2):", err);
                        });
                    } else if (engineVersion === 'shadow') {
                        // Run V2 in shadow for logging only
                        updateConversationStateV2(finalConversationState.consciousState || null, recentMessages, activeCharsForState, settings)
                          .then(newStateV2 => {
                              console.log('[Conscious State][Shadow] V2 result:', newStateV2);
                          })
                          .catch(err => console.warn('Shadow V2 failed:', err));

                        // Commit V1 as the authoritative state
                        updateConversationState(finalConversationState.consciousState || null, recentMessages, activeCharsForState).then(newState => {
                            const convToUpdate = conversationRef.current;
                            if (convToUpdate && convToUpdate.id === finalConversationState.id) {
                                const updatedConv = { ...convToUpdate, consciousState: newState };
                                onConversationUpdate(updatedConv);
                                saveConversation(updatedConv);
                            }
                        }).catch(err => {
                            console.error("Failed to update conscious state (v1):", err);
                        });
                    } else {
                        // Default: legacy v1 behavior
                        updateConversationState(finalConversationState.consciousState || null, recentMessages, activeCharsForState).then(newState => {
                            const convToUpdate = conversationRef.current;
                            if (convToUpdate && convToUpdate.id === finalConversationState.id) {
                                const updatedConv = { ...convToUpdate, consciousState: newState };
                                onConversationUpdate(updatedConv);
                                saveConversation(updatedConv);
                            }
                        }).catch(err => {
                            console.error("Failed to update conscious state (v1):", err);
                        });
                    }
                }
            }
            
            // Living Lore - Smart or Frequency Mode
            if (settings.livingLore.enabled && settings.livingLore.automatic && finalModelMessage) {
                const activeChars = allCharacters.filter(char => finalConversationState.characterIds?.includes(char.id));
                console.log('[Living Lore] Active characters:', activeChars.length, activeChars.map(c => c.name));
                
                if (activeChars.length > 0) {
                    const smartConfig = finalConversationState.smartSystemConfig?.livingLore;
                    // FIX: Default to checking if smartConfig is not set (traditional behavior)
                    const useSmartMode = smartConfig?.mode === 'smart';
                    
                    console.log('[Living Lore] Mode:', useSmartMode ? 'Smart' : 'Always Check', 'SmartConfig:', smartConfig);
                    
                    let shouldCheck = false;
                    
                    if (useSmartMode) {
                        // Smart Mode: Intelligent event detection
                        const recentMessages = finalConversationState.messages.slice(-8);
                        try {
                            const analysis = await analyzeLivingLoreSignificance(
                                recentMessages,
                                activeChars,
                                settings
                            );
                            
                            const threshold = smartConfig.significanceThreshold || 60;
                            shouldCheck = analysis.score >= threshold && analysis.isSignificant;
                            
                            console.log(`[Living Lore] Analysis score: ${analysis.score}, threshold: ${threshold}, shouldCheck: ${shouldCheck}`);
                            
                            if (analysis.isSignificant && analysis.characterName) {
                                console.log(`[Living Lore] Significant event detected (score: ${analysis.score}): ${analysis.changeDescription}`);
                            }
                        } catch (err) {
                            console.error("Failed to analyze living lore significance:", err);
                        }
                    } else {
                        // Traditional mode: always check
                        shouldCheck = true;
                        console.log('[Living Lore] Traditional mode - always checking');
                    }
                    
                    if (shouldCheck) {
                        console.log('[Living Lore] Calling getLivingLoreSuggestion...');
                        const suggestion = await getLivingLoreSuggestion(finalConversationState.messages, activeChars, settings.livingLore.scanDepth);
                        console.log('[Living Lore] Suggestion received:', suggestion);
                        
                        if (suggestion?.updateSuggested && suggestion.targetId) {
                             // FIX: Handle 'all' targetId case - pick the first active character
                             let targetChar = activeChars.find(c => c.id === suggestion.targetId);
                             
                             if (!targetChar && suggestion.targetId === 'all' && activeChars.length > 0) {
                                 // If targetId is 'all', use the first active character
                                 targetChar = activeChars[0];
                                 console.log('[Living Lore] targetId is "all", using first character:', targetChar.name);
                             }
                             
                             if(targetChar) {
                                console.log('[Living Lore] Creating suggestion message for:', targetChar.name);
                                const suggestionMessage: Message = {
                                    id: generateUUID(), role: 'model', content: '', timestamp: Date.now(),
                                    suggestion: {
                                        type: 'livingLore', title: `Living Lore Suggestion for ${targetChar.name}`,
                                        text: `Detected a significant change: "${suggestion.summaryOfChange}". Would you like to update the character sheet?`,
                                        targetId: targetChar.id, // Use actual character ID, not 'all'
                                        targetName: targetChar.name, 
                                        summaryOfChange: suggestion.summaryOfChange,
                                    }
                                };
                                const updatedConvWithSuggestion = {...finalConversationState, messages: [...finalConversationState.messages, suggestionMessage]};
                                onConversationUpdate(updatedConvWithSuggestion);
                                await saveConversation(updatedConvWithSuggestion);
                             } else {
                                console.log('[Living Lore] Target character not found:', suggestion.targetId);
                             }
                        } else {
                            console.log('[Living Lore] No update suggested or targetId missing');
                        }
                    } else {
                        console.log('[Living Lore] Skipping check - shouldCheck is false');
                    }
                }
            }
            // New: Smart Will Engine - Verify and Update Directives
            if (finalConversationState.narrativeDirectives && finalConversationState.narrativeDirectives.length > 0) {
                const activeDirectives = finalConversationState.narrativeDirectives.filter(d => !d.isCompleted);
                if (activeDirectives.length > 0) {
                    const messageCount = finalConversationState.messageProgress || 0;
                    
                    // Run verification every 5 messages, or when directive should be checked
                    const shouldVerify = messageCount % 5 === 0;
                    
                    if (shouldVerify) {
                        const recentMessages = finalConversationState.messages.slice(-10);
                        const updatedDirectives = await Promise.all(
                            finalConversationState.narrativeDirectives.map(async (directive) => {
                                if (directive.isCompleted) return directive;
                                
                                // System 1: Smart Verification
                                const verification = await verifyDirectiveProgress(
                                    directive,
                                    recentMessages,
                                    settings
                                );
                                
                                // System 4: Context Analysis (every 3 messages)
                                let contextUpdate = { activationScore: (directive as any).activationScore, suggestedTriggers: directive.contextTriggers };
                                if (messageCount % 3 === 0) {
                                    const context = await analyzeDirectiveContext(
                                        directive,
                                        recentMessages,
                                        settings
                                    );
                                    (contextUpdate as any).activationScore = context.activationScore;
                                    // Merge suggested triggers with existing ones
                                    if (context.suggestedTriggers.length > 0) {
                                        const existingTriggers = new Set(directive.contextTriggers || []);
                                        context.suggestedTriggers.forEach(t => existingTriggers.add(t));
                                        contextUpdate.suggestedTriggers = Array.from(existingTriggers).slice(0, 10); // Max 10 triggers
                                    }
                                }
                                
                                return {
                                    ...directive,
                                    progress: verification.progress,
                                    isCompleted: verification.isCompleted,
                                    lastChecked: Date.now(),
                                    activationScore: (contextUpdate as any).activationScore,
                                    contextTriggers: contextUpdate.suggestedTriggers
                                };
                            })
                        );
                        
                        // Update conversation with new directive states
                        const convToUpdate = conversationRef.current;
                        if (convToUpdate && convToUpdate.id === finalConversationState.id) {
                            const updatedConv = { ...convToUpdate, narrativeDirectives: updatedDirectives };
                            onConversationUpdate(updatedConv);
                            await saveConversation(updatedConv);
                            
                            // Notify user of completed goals
                            const newlyCompleted = updatedDirectives.filter((d, i) => 
                                d.isCompleted && !finalConversationState.narrativeDirectives![i].isCompleted
                            );
                            newlyCompleted.forEach(d => {
                                addNotification({
                                    title: '🎯 Goal Achieved!',
                                    message: `"${d.goal}" for ${d.targetCharacterName} has been completed!`,
                                    type: 'success'
                                });
                            });
                        }
                    }
                }
            }
            
            // Director AI - Smart or Frequency Mode
            if (settings.directorAI.enabled && settings.directorAI.automatic) {
                const smartConfig = finalConversationState.smartSystemConfig?.directorAI;
                // FIX: Default to 'frequency' mode if smartConfig is not set
                const useSmartMode = smartConfig?.mode === 'smart';
                const useFrequencyMode = !useSmartMode; // If not smart mode, use frequency mode
                
                console.log('[Director AI] Mode:', useSmartMode ? 'Smart' : 'Frequency', 'SmartConfig:', smartConfig);
                
                setDirectorAICounter(prevCount => {
                    const newCount = prevCount + 1;
                    
                    let shouldIntervene = false;
                    
                    if (useSmartMode) {
                        // Smart Mode: Context-aware intervention
                        if (!isDirectorAIGenerating.current) {
                            // FIX: Set flag IMMEDIATELY to prevent duplicate calls
                            isDirectorAIGenerating.current = true;
                            
                            const recentMessages = finalConversationState.messages.slice(-10);
                            analyzeDirectorNeed(recentMessages, settings).then(async (analysis) => {
                                if (analysis.needsIntervention) {
                                    console.log(`[Director AI] Intervention needed (score: ${analysis.score}): ${analysis.reason}`);
                                    
                                    const suggestion = await getDirectorSuggestion(finalConversationState.messages, settings.directorAI.scanDepth);
                                    if (suggestion) {
                                        const suggestionMessage: Message = {
                                            id: generateUUID(), role: 'model', content: '', timestamp: Date.now(),
                                            suggestion: { type: 'directorAI', title: 'Director AI Intervention', text: `"${suggestion}"` }
                                        };
                                        const convWithSuggestion = conversationRef.current;
                                        if(convWithSuggestion) {
                                            const updatedConv = {...convWithSuggestion, messages: [...convWithSuggestion.messages, suggestionMessage]};
                                            onConversationUpdate(updatedConv);
                                            await saveConversation(updatedConv);
                                        }
                                    }
                                } else {
                                    console.log(`[Director AI] No intervention needed (score: ${analysis.score})`);
                                }
                                isDirectorAIGenerating.current = false;
                            }).catch(err => {
                                console.error("Failed to analyze director need:", err);
                                isDirectorAIGenerating.current = false;
                            });
                        }
                        return 0; // Reset counter in smart mode
                    } else {
                        // Frequency Mode: Traditional every X messages
                        const freq = smartConfig?.frequencyValue || settings.directorAI.frequency;
                        console.log('[Director AI - Frequency] Counter:', newCount, '/', freq, 'Generating:', isDirectorAIGenerating.current);
                        if (newCount >= freq && !isDirectorAIGenerating.current) {
                            console.log('[Director AI - Frequency] Triggering intervention!');
                            isDirectorAIGenerating.current = true;
                            getDirectorSuggestion(finalConversationState.messages, settings.directorAI.scanDepth).then(async (suggestion) => {
                                if (suggestion) {
                                    const suggestionMessage: Message = {
                                        id: generateUUID(), role: 'model', content: '', timestamp: Date.now(),
                                        suggestion: { type: 'directorAI', title: 'Director AI Intervention', text: `"${suggestion}"` }
                                    };
                                    const convWithSuggestion = conversationRef.current;
                                    if(convWithSuggestion) {
                                        const updatedConv = {...convWithSuggestion, messages: [...convWithSuggestion.messages, suggestionMessage]};
                                        onConversationUpdate(updatedConv);
                                        await saveConversation(updatedConv);
                                    }
                                }
                            }).finally(() => {
                                isDirectorAIGenerating.current = false;
                            });
                            return 0;
                        }
                        return newCount;
                    }
                });
            }
          }, // End of onComplete callback
          abortControllerRef.current.signal,
          onStatusUpdate
      );
      } finally {
        managedHistoryAppliedRef.current = false;
      }
    }, [models, settings, onConversationUpdate, allCharacters, allUserPersonas, allLorebooks, allIdentityProfiles, selectedModel, handleInjectMessage]);

    const handleDirectorAIIntervention = useCallback(async (baseConversation: Conversation, customPrompt?: string) => {
    try {
        const suggestion = customPrompt 
            ? await getCustomDirectorSuggestion(baseConversation.messages, customPrompt, settings.directorAI.scanDepth)
            : await getDirectorSuggestion(baseConversation.messages, settings.directorAI.scanDepth);
        
        if (suggestion) {
            const eventMessage: Message = {
                id: generateUUID(), role: 'user', content: suggestion, timestamp: Date.now(), type: 'event',
            };
            const updatedHistory = [...baseConversation.messages, eventMessage];
            const updatedConversationWithEvent = { ...baseConversation, messages: updatedHistory };
            
            onConversationUpdate(updatedConversationWithEvent);
            await runStreamingResponse(updatedHistory, updatedConversationWithEvent);
        }
    } catch (e: any) {
        addNotification({ title: 'Director AI Failed', message: e.message, type: 'error' });
    }
    }, [runStreamingResponse, onConversationUpdate, settings.directorAI.scanDepth]);

  // --- Dual Response Streaming ---
  
  const runDualStreamingResponse = useCallback(async (
    history: Message[],
    currentConversation: Conversation,
    overrideSettings?: Partial<Pick<Settings, 'temperature' | 'topP'>>,
    oneTimeInstruction?: string
  ) => {
      const finalSettings = { ...settings, ...overrideSettings };

      // Determine models based on dual response settings
      let primaryModel = selectedModel;
      let alternativeModel = selectedModel;

      if (settings.dualResponse.mode === 'different_models') {
          const primaryModelId = settings.dualResponse.primaryModel || settings.defaultModelId;
          const altModelId = settings.dualResponse.alternativeModel || settings.defaultModelId;
          
          primaryModel = models.find(m => m.id === primaryModelId) || selectedModel;
          alternativeModel = models.find(m => m.id === altModelId) || selectedModel;
      }

      if (!primaryModel || !alternativeModel) {
          addNotification({ title: 'Model Not Found', message: 'Could not find the selected models. Please check your dual response settings.', type: 'error' });
          setIsStreaming(false);
          return;
      }

      // Validate API keys
      if (primaryModel.provider === 'OpenRouter' && !settings.openRouterApiKey) {
          addNotification({ title: 'API Key Missing', message: 'API key for OpenRouter is not set.', type: 'error' });
          setIsStreaming(false);
          return;
      }

      if (primaryModel.provider === 'XAI' && !settings.xaiApiKey) {
          addNotification({ title: 'API Key Missing', message: 'API key for XAI is not set.', type: 'error' });
          setIsStreaming(false);
          return;
      }

      let historyForAI = [...history];
      if (oneTimeInstruction && historyForAI.length > 0) {
          const lastUserMessageIndex = historyForAI.map(m => m.role).lastIndexOf('user');
          if (lastUserMessageIndex > -1) {
              const lastUserMessage = { ...historyForAI[lastUserMessageIndex] };
              lastUserMessage.content = `[Instruction For This Turn Only]: ${oneTimeInstruction}\n\n${lastUserMessage.content}`;
              historyForAI[lastUserMessageIndex] = lastUserMessage;
          }
      }

      setIsStreaming(true);
      setGenerationTime(0);
      abortControllerRef.current = new AbortController();
      timerRef.current = window.setInterval(() => setGenerationTime(t => t + 1), 1000);

      let updatedConversation = { ...currentConversation, messages: [...history] };
      
      // Create two thinking messages - one for each response
      const primaryThinkingMessage: Message = {
          id: generateUUID(), 
          role: 'model', 
          content: '', 
          timestamp: Date.now(),
          isThinking: true,
          isDualResponse: true,
          selectedResponse: 'primary'
      };
      
      const alternativeThinkingMessage: Message = {
          id: generateUUID(), 
          role: 'model', 
          content: '', 
          timestamp: Date.now(),
          isThinking: true,
      };
      
      // Add primary thinking message to the conversation
      updatedConversation.messages.push(primaryThinkingMessage);
      onConversationUpdate({ ...updatedConversation });

      const conversationCharacters = allCharacters.filter(char => currentConversation.characterIds?.includes(char.id));
      const activeUserPersona = allUserPersonas.find(p => p.id === settings.activeUserPersonaId) || null;
      const activeLorebooks = allLorebooks.filter(lb => currentConversation.lorebookIds?.includes(lb.id));
      
      const onStatusUpdate = (status: string, source: 'primary' | 'alternative') => {
          const conv = conversationRef.current;
          if (!conv) return;
          const updatedMessages = conv.messages.map(m => {
              if (source === 'primary' && m.id === primaryThinkingMessage.id) {
                  return { ...m, retryStatus: status };
              }
              return m;
          });
          onConversationUpdate({ ...conv, messages: updatedMessages });
      };

      let primaryContent = '';
      let alternativeContent = '';
      
      // Smart delay: If using same Gemini model, add 500ms delay to second request
      // This prevents RPM (Requests Per Minute) rate limiting issues
      const useSameGeminiModel = primaryModel.provider === 'Google' && 
                                  alternativeModel.provider === 'Google' && 
                                  primaryModel.id === alternativeModel.id;
      
      await streamDualChatResponse(
          currentConversation, historyForAI, primaryModel, alternativeModel, finalSettings, conversationCharacters, activeLorebooks, activeUserPersona, allIdentityProfiles,
          (chunk, newHistory) => {
              primaryContent += chunk;
              const currentConv = conversationRef.current;
              if (!currentConv) return;
              
              const messages = [...currentConv.messages];
              const lastMessage = messages[messages.length - 1];

              if (lastMessage && lastMessage.id === primaryThinkingMessage.id) {
                if (lastMessage.isThinking) {
                    lastMessage.isThinking = false;
                    lastMessage.content = chunk;
                } else {
                    lastMessage.content += chunk;
                }
                onConversationUpdate({ ...currentConv, messages });
              }
          },
          (chunk) => {
              alternativeContent += chunk;
              const currentConv = conversationRef.current;
              if (!currentConv) return;
              
              const messages = [...currentConv.messages];
              const lastMessage = messages[messages.length - 1];

              if (lastMessage && lastMessage.id === primaryThinkingMessage.id) {
                  lastMessage.alternativeResponse = (lastMessage.alternativeResponse || '') + chunk;
                  onConversationUpdate({ ...currentConv, messages });
              }
          },
          (err, source) => {
              addNotification({ title: `AI Error (${source})`, message: err.message, type: 'error' });
          },
          async (primaryData, alternativeData) => {
            if (timerRef.current) clearInterval(timerRef.current);
            
            const latestConversation = conversationRef.current;
            if (!latestConversation) return;

            // Create final message with both responses
            const finalModelMessage: Message = { 
                ...primaryData.modelMessage, 
                isThinking: false, 
                content: primaryData.responseText.trim(), 
                tokenCount: primaryData.totalTokens,
                isDualResponse: true,
                alternativeResponse: alternativeData.responseText.trim(),
                alternativeModel: alternativeModel.id,
                selectedResponse: 'primary',
                ragSyncedResponse: undefined // Will be set to 'primary' after auto-sync
            };
            
            const finalMessages = latestConversation.messages.map(m => m.id === primaryThinkingMessage.id ? finalModelMessage : m);

            let finalConversationState: Conversation = { ...latestConversation, messages: finalMessages };

            if (primaryData.directivesToUpdate) {
                finalConversationState.narrativeDirectives = primaryData.directivesToUpdate;
            }
            
            // Auto-RAG: Automatically sync primary response (A) to RAG after completion
            // User can still switch to alternative (B) and confirm, which will replace this
            if (settings.rag.enabled && finalConversationState.ragCollectionName) {
              const userMessagePartner = finalConversationState.messages.length > 1 
                ? finalConversationState.messages[finalConversationState.messages.length - 2] 
                : null;
              
              if (userMessagePartner && userMessagePartner.role === 'user') {
                // Add primary response to RAG automatically
                await addMessagesToCollection(
                  finalConversationState.ragCollectionName,
                  [userMessagePartner, finalModelMessage],
                  settings,
                  settings.rag.chunkSize
                ).catch(e => console.error("Failed to auto-sync RAG:", e));
                
                // Mark primary as synced
                finalModelMessage.ragSyncedResponse = 'primary';
              }
            }
            
            onConversationUpdate(finalConversationState);
            
            if (finalConversationState.messages.length === 2 && finalConversationState.title === 'New Conversation') {
                generateConversationTitle(
                    finalConversationState.messages[0].content,
                    finalConversationState.messages[1].content
                ).then(newTitle => {
                    const conversationForTitleUpdate = conversationRef.current;
                    if (conversationForTitleUpdate && conversationForTitleUpdate.id === finalConversationState.id) {
                         const updatedConvWithTitle = { ...conversationForTitleUpdate, title: newTitle };
                         onConversationUpdate(updatedConvWithTitle);
                         saveConversation(updatedConvWithTitle);
                    }
                });
            } else {
                 await saveConversation(finalConversationState);
            }
            
            setGenerationTime(0);
            setIsStreaming(false);
          },
          abortControllerRef.current!.signal,
          onStatusUpdate
      );
  }, [settings, selectedModel, models, allCharacters, allUserPersonas, allLorebooks, allIdentityProfiles, onConversationUpdate, addNotification, conversationRef]);

  // --- UI Event Handlers ---

  const handleSend = useCallback(async (override?: string, oneTimeOverride?: string) => {
    const raw = (override !== undefined ? override : input);
    if (!raw.trim() || !conversation || isStreaming) return;
    const trimmedInput = raw.trim();
    
    // Auto-confirm last dual response if not confirmed yet
    if (conversation.messages.length > 0) {
      const lastMessage = conversation.messages[conversation.messages.length - 1];
      if (lastMessage.role === 'model' && lastMessage.isDualResponse && lastMessage.alternativeResponse && !lastMessage.ragSyncedResponse) {
        // Confirm the currently selected response to RAG before sending new message
        // Only do this if NOT already synced to avoid duplicate RAG operations
        if (settings.rag.enabled && conversation.ragCollectionName) {
          const userMessagePartner = conversation.messages.length > 1 ? conversation.messages[conversation.messages.length - 2] : null;
          if (userMessagePartner && userMessagePartner.role === 'user') {
            // Delete old RAG memories
            const memoriesToDelete = await (async () => {
              const memories = await getRagMetadataForCollection(conversation.ragCollectionName!);
              const sourceIdsSet = new Set([userMessagePartner.id, lastMessage.id]);
              return memories.filter(mem => 
                mem.sourceMessageIds?.length === 2 &&
                mem.sourceMessageIds.every(id => sourceIdsSet.has(id))
              );
            })();
            
            if (memoriesToDelete.length > 0) {
              await deleteMemories(conversation.ragCollectionName, memoriesToDelete.map(m => m.id)).catch(e => {
                console.error("Failed to delete old RAG memories on auto-confirm:", e);
              });
            }

            // Add new RAG memories with the selected response
            await addMessagesToCollection(
              conversation.ragCollectionName,
              [userMessagePartner, lastMessage],
              settings,
              settings.rag.chunkSize
            ).catch(e => console.error("Failed to add RAG memory on auto-confirm:", e));
            
            // Mark current selected response as synced
            lastMessage.ragSyncedResponse = lastMessage.selectedResponse || 'primary';
            const updatedMessages = conversation.messages.map(m => m.id === lastMessage.id ? lastMessage : m);
            const updatedConv = { ...conversation, messages: updatedMessages };
            onConversationUpdate(updatedConv);
            await saveConversation(updatedConv);
          }
        }
      }
    }
    
    const overrideSettings = {
      temperature: responseControls.temperature,
      topP: responseControls.topP,
    };
    
    const directives: string[] = [];
      if (responseControls.focus) directives.push(`Focus: ${responseControls.focus}`);
      if (responseControls.answerLength) {
          const mapLen = responseControls.answerLength === 'short' ? 'concise' : (responseControls.answerLength === 'long' ? 'detailed' : 'balanced');
          directives.push(`Length: ${mapLen}`);
      }
      if (responseControls.styleBalance) {
          const balance = responseControls.styleBalance === 'more_narration'
              ? 'prefer more narration than dialogue'
              : responseControls.styleBalance === 'more_dialogue'
                  ? 'prefer more dialogue than narration'
                  : 'balanced narration and dialogue';
          directives.push(`Balance: ${balance}`);
      }
      if (responseControls.note) directives.push(`Note: ${responseControls.note}`);

      // Compose one-time instruction for this turn only by merging:
      // - structured directives (tone, style, etc.)
      // - user's manual Instant Instructions
      // - optional card prompt override (oneTimeOverride)
      const parts: string[] = [];
      if (directives.length > 0) {
        parts.push(`Instant Directives: ${directives.join(' | ')}`);
      }
      if (responseControls.oneTimeInstruction) {
        parts.push(responseControls.oneTimeInstruction);
      }
      if (oneTimeOverride) {
        parts.push(oneTimeOverride);
      }
      // De-duplicate simple exact duplicates after trimming
      const seen = new Set<string>();
      const mergedParts = parts.filter(p => {
        const key = p.trim();
        if (!key) return false;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const baseOneTime = mergedParts.length > 0 ? mergedParts.join('\n\n') : undefined;
      let oneTimeInstruction = baseOneTime;
      if (isImpersonatedInput) {
          oneTimeInstruction = (oneTimeInstruction ? oneTimeInstruction + '\n\n' : '') + 
          "[System Note for this turn: The user's last message was an AI-assisted narrative scene describing events. Your response should continue the story from the characters' perspectives, reacting naturally to this scene as if it just happened.]";
      }

      setInput('');
      if (!responseControls.isPinned) {
        setResponseControls({});
      }
      setIsImpersonatedInput(false);

    if (trimmedInput.startsWith('/imagine ')) {
        await runComfyUIImageGeneration(trimmedInput.substring(9).trim(), conversation);
        return;
    }

    if (trimmedInput.startsWith('/hf ')) {
        await runHFImageGeneration(trimmedInput.substring(4).trim(), conversation);
        return;
    }

    if (trimmedInput.startsWith('/xai ')) {
        await runXAIImageGeneration(trimmedInput.substring(5).trim(), conversation);
        return;
    }

    if (trimmedInput.startsWith('/sd ')) {
      await runSDImageGeneration(trimmedInput.substring(4).trim(), conversation);
      return;
    }

    // Input reformatting handled elsewhere (if needed)

    const userMessage: Message = {
        id: generateUUID(),
        role: 'user',
        content: trimmedInput,
        timestamp: Date.now(),
        attachedImage: attachedImage || undefined
      };
      
      if (attachedImage) setAttachedImage(null);
      
      let updatedConversationWithMsg = { ...conversation, messages: [...conversation.messages, userMessage] };

      // Update message progress for Story Arcs and Narrative Directives (Will Engine)
      const currentProgress = (updatedConversationWithMsg.messageProgress || 0) + 1;
      
      if (updatedConversationWithMsg.storyArcsEnabled) {
          const currentLevel = updatedConversationWithMsg.currentLevel || 1;
          const levelDef = settings.storyArcs.levels.find(l => l.level === currentLevel);
          if (levelDef && currentProgress >= levelDef.messagesToNext) {
              updatedConversationWithMsg = { ...updatedConversationWithMsg, currentLevel: currentLevel + 1, messageProgress: 0 };
              addNotification({ title: `Story Arc Progressed!`, message: `You have reached Level ${currentLevel + 1}.`, type: 'info' });
          } else {
              updatedConversationWithMsg = { ...updatedConversationWithMsg, messageProgress: currentProgress };
          }
      } else {
          // Always update messageProgress even if Story Arcs is disabled (for Will Engine)
          updatedConversationWithMsg = { ...updatedConversationWithMsg, messageProgress: currentProgress };
      }

      onConversationUpdate(updatedConversationWithMsg);
      
      // Use dual response streaming if enabled
      if (settings.dualResponse.enabled) {
          await runDualStreamingResponse(updatedConversationWithMsg.messages, updatedConversationWithMsg, overrideSettings, oneTimeInstruction);
      } else {
          await runStreamingResponse(updatedConversationWithMsg.messages, updatedConversationWithMsg, overrideSettings, oneTimeInstruction);
      }
  }, [input, conversation, isStreaming, onConversationUpdate, runStreamingResponse, runDualStreamingResponse, runComfyUIImageGeneration, runSDImageGeneration, runHFImageGeneration, runXAIImageGeneration, settings, addNotification, responseControls, isImpersonatedInput, attachedImage]);

  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
  }, []);
  
  const findMemoriesForMessage = async (targetMessage: Message, allMessages: Message[], collectionName?: string): Promise<RagMemory[]> => {
      if (!settings.rag.enabled || !collectionName) return [];
      
      const messageIndex = allMessages.findIndex(m => m.id === targetMessage.id);
      if (messageIndex === -1) return [];
      
      let messagePairIds: string[] = [];

      if (targetMessage.role === 'user' && messageIndex < allMessages.length - 1) {
          const partner = allMessages[messageIndex + 1];
          if (partner?.role === 'model') {
              messagePairIds = [targetMessage.id, partner.id];
          }
      } else if (targetMessage.role === 'model' && messageIndex > 0) {
          const partner = allMessages[messageIndex - 1];
          if (partner?.role === 'user') {
              messagePairIds = [partner.id, targetMessage.id];
          }
      }

      if (messagePairIds.length === 2) {
          const memories = await getRagMetadataForCollection(collectionName);
          const sourceIdsSet = new Set(messagePairIds);
          return memories.filter(mem => 
              mem.sourceMessageIds?.length === 2 &&
              mem.sourceMessageIds.every(id => sourceIdsSet.has(id))
          );
      }
      
      return [];
  };

  const handleEditMessage = useCallback(async (messageId: string, newContent: string) => {
    const currentConversation = conversationRef.current;
    if (!currentConversation) return;
    
    const messageIndex = currentConversation.messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    const originalMessage = currentConversation.messages[messageIndex];
    if (originalMessage.isGeneratingImage || originalMessage.imageUrl) return;

    const memoriesToDelete = await findMemoriesForMessage(originalMessage, currentConversation.messages, currentConversation.ragCollectionName);
    if (memoriesToDelete.length > 0) {
        await deleteMemories(currentConversation.ragCollectionName!, memoriesToDelete.map(m => m.id)).catch(e => {
            console.error("Failed to delete all old RAG memories on edit:", e);
        });
    }

    if (originalMessage.role === 'user') {
        const updatedUserMessage: Message = { ...originalMessage, content: newContent, timestamp: Date.now() };
        const history = [...currentConversation.messages.slice(0, messageIndex), updatedUserMessage];
        onConversationUpdate({ ...currentConversation, messages: history });
        await runStreamingResponse(history, { ...currentConversation, messages: history });

    } else { // Role is 'model'
        const userMessagePartner = messageIndex > 0 ? currentConversation.messages[messageIndex - 1] : null;
        const updatedModelMessage: Message = { ...originalMessage, content: newContent, timestamp: Date.now() };
        const updatedMessages = currentConversation.messages.map(m => m.id === messageId ? updatedModelMessage : m);
        const updatedConversation = { ...currentConversation, messages: updatedMessages };
        
        onConversationUpdate(updatedConversation);

        if (settings.rag.enabled && updatedConversation.ragCollectionName && userMessagePartner && userMessagePartner.role === 'user') {
            await addMessagesToCollection(
                updatedConversation.ragCollectionName,
                [userMessagePartner, updatedModelMessage],
                settings,
                settings.rag.chunkSize
            ).catch(e => console.error("Failed to add new RAG memory after model edit:", e));
        }

        await saveConversation(updatedConversation);
    }
  }, [conversationRef, settings, onConversationUpdate, runStreamingResponse]);

  const handleRegenerateResponse = useCallback(async (messageId: string) => {
    const currentConversation = conversationRef.current;
    if (!currentConversation) return;

    const messageIndex = currentConversation.messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    const memoriesToDelete = await findMemoriesForMessage(currentConversation.messages[messageIndex], currentConversation.messages, currentConversation.ragCollectionName);
    if (memoriesToDelete.length > 0) {
        await deleteMemories(currentConversation.ragCollectionName!, memoriesToDelete.map(m => m.id)).catch(e => {
            console.error("Failed to delete all old RAG memories on regeneration:", e);
        });
    }

    const targetMessage = currentConversation.messages[messageIndex];
    let history = targetMessage.role === 'model' 
        ? currentConversation.messages.slice(0, messageIndex) 
        : currentConversation.messages.slice(0, messageIndex + 1);

    onConversationUpdate({ ...currentConversation, messages: history });
    
    // Check if dual response is enabled
    if (settings.dualResponse.enabled) {
      await runDualStreamingResponse(history, { ...currentConversation, messages: history });
    } else {
      await runStreamingResponse(history, { ...currentConversation, messages: history });
    }
  }, [onConversationUpdate, runStreamingResponse, runDualStreamingResponse, conversationRef, settings.rag.enabled, settings.dualResponse.enabled]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    const currentConversation = conversationRef.current;
    if (!currentConversation) return;
  
    const messageIndex = currentConversation.messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;
  
    const messageToDelete = currentConversation.messages[messageIndex];
    const idsToDelete = new Set([messageId]);
    
    // Find message pair and associated memories
    const memoriesToDelete = await findMemoriesForMessage(messageToDelete, currentConversation.messages, currentConversation.ragCollectionName);
    if (memoriesToDelete.length > 0) {
        await deleteMemories(currentConversation.ragCollectionName!, memoriesToDelete.map(m => m.id)).catch(e => {
            console.error("Failed to delete all corresponding RAG memories:", e);
        });
    }
    
    // Also delete the partner message if it's a user/model pair
    if (messageToDelete.role === 'user' && messageIndex + 1 < currentConversation.messages.length) {
        const partner = currentConversation.messages[messageIndex + 1];
        if (partner.role === 'model') idsToDelete.add(partner.id);
    } else if (messageToDelete.role === 'model' && messageIndex > 0) {
        const partner = currentConversation.messages[messageIndex - 1];
        if (partner.role === 'user') idsToDelete.add(partner.id);
    }

    const updatedMessages = currentConversation.messages.filter(msg => !idsToDelete.has(msg.id));
    const updatedConversation = { ...currentConversation, messages: updatedMessages };
    onConversationUpdate(updatedConversation);
    await saveConversation(updatedConversation);
  }, [onConversationUpdate, conversationRef, settings.rag.enabled]);
  
  const handleSaveConversationSettings = useCallback(async (newSettings: Partial<Conversation>) => {
    if (!conversation) return;
    const updatedConversation = { ...conversation, ...newSettings };
    onConversationUpdate(updatedConversation);
    await saveConversation(updatedConversation);
  }, [conversation, onConversationUpdate]);

  const handleTransformToPrompt = useCallback(async (messageId: string) => {
    if (isTransforming || isStreaming || !conversation) return;
    const message = conversation.messages.find(m => m.id === messageId);
    if (!message) return;

    setIsTransforming(true);
    setInput('✨ Generating professional prompt with Gemini 2.5 Flash...');

    try {
        const activeCharacters = allCharacters.filter(c => conversation.characterIds?.includes(c.id));
        const professionalPrompt = await transformToImagePrompt(message.content, conversation.messages, activeCharacters);
        
        setInput('');
        // Use the preferred image generator from settings
        const preferred = settings.preferredImageGenerator;
        let executed = false;
        
        // Try preferred generator first
        if (preferred === 'xai' && settings.xaiApiKey) {
            await runXAIImageGeneration(professionalPrompt, conversation);
            executed = true;
        } else if (preferred === 'sdwebui' && settings.stableDiffusion.isConnected) {
            await runSDImageGeneration(professionalPrompt, conversation);
            executed = true;
        } else if (preferred === 'comfyui' && settings.comfyUI.isConnected) {
            await runComfyUIImageGeneration(professionalPrompt, conversation);
            executed = true;
        } else if (preferred === 'huggingface' && settings.huggingFace.isConnected) {
            await runHFImageGeneration(professionalPrompt, conversation);
            executed = true;
        }
        
        // Fallback: if preferred wasn't available, try any other service
        if (!executed) {
            if (settings.xaiApiKey && preferred !== 'xai') {
                await runXAIImageGeneration(professionalPrompt, conversation);
            } else if (settings.stableDiffusion.isConnected && preferred !== 'sdwebui') {
                await runSDImageGeneration(professionalPrompt, conversation);
            } else if (settings.comfyUI.isConnected && preferred !== 'comfyui') {
                await runComfyUIImageGeneration(professionalPrompt, conversation);
            } else if (settings.huggingFace.isConnected && preferred !== 'huggingface') {
                await runHFImageGeneration(professionalPrompt, conversation);
            } else {
                // No service available, insert command for manual use
                setInput(`/imagine ${professionalPrompt}`);
            }
        }
        
    } catch (err: any) {
        addNotification({ title: 'Prompt Generation Failed', message: err.message || 'Failed to generate prompt.', type: 'error' });
        setInput('');
    } finally {
        setIsTransforming(false);
    }
  }, [isTransforming, isStreaming, conversation, settings, allCharacters, runSDImageGeneration, runComfyUIImageGeneration, runXAIImageGeneration, runHFImageGeneration]);

  const handleSuggestionResponse = useCallback(async (messageId: string, action: 'accept' | 'reject' | 'customize' | 'update' | 'ignore', customPrompt?: string) => {
    const currentConversation = conversationRef.current;
    if (!currentConversation) return;

    const suggestionMessage = currentConversation.messages.find(m => m.id === messageId);
    if (!suggestionMessage?.suggestion) return;

    const messagesWithoutSuggestion = currentConversation.messages.filter(m => m.id !== messageId);
    const updatedConv = { ...currentConversation, messages: messagesWithoutSuggestion };
    
    setDirectorAICounter(0);

    switch (suggestionMessage.suggestion.type) {
        case 'directorAI':
        case 'manualDirectorAI':
            if (action === 'accept' || (action === 'customize' && !customPrompt)) {
                await handleDirectorAIIntervention(updatedConv, suggestionMessage.suggestion.text.replace(/"/g, ''));
            } else if (action === 'customize' && customPrompt) {
                await handleDirectorAIIntervention(updatedConv, customPrompt);
            } else {
                onConversationUpdate(updatedConv);
                await saveConversation(updatedConv);
            }
            break;
        case 'livingLore':
            if (action === 'update') {
                // Validate we have required data
                if (!suggestionMessage.suggestion.targetId) {
                    console.error('Living Lore suggestion missing targetId');
                    addNotification({ title: 'Update Failed', message: 'Cannot update character: missing character ID', type: 'error' });
                    return; // Don't remove message if we can't process it
                }
                
                const targetChar = allCharacters.find(c => c.id === suggestionMessage.suggestion.targetId);
                if (!targetChar) {
                    console.error('Character not found:', suggestionMessage.suggestion.targetId);
                    addNotification({ title: 'Update Failed', message: 'Cannot update character: character not found', type: 'error' });
                    return; // Don't remove message if character not found
                }
                
                // Only remove message if we successfully open the modal
                onOpenLivingLoreModal(targetChar, suggestionMessage.suggestion.summaryOfChange || '');
            }
            
            // Remove suggestion message after processing (or ignore action)
            onConversationUpdate(updatedConv); 
            await saveConversation(updatedConv);
            break;
    }
  }, [allCharacters, onConversationUpdate, handleDirectorAIIntervention, onOpenLivingLoreModal, addNotification]);

  const handleManualDirectorAI = useCallback(() => {
    if (!conversation) return;
    const suggestionMessage: Message = {
        id: generateUUID(), role: 'model', content: '', timestamp: Date.now(),
        suggestion: { type: 'manualDirectorAI', title: 'Manual Intervention', text: 'What do you want to happen next?' }
    };
    onConversationUpdate({ ...conversation, messages: [...conversation.messages, suggestionMessage] });
    saveConversation({ ...conversation, messages: [...conversation.messages, suggestionMessage] });
  }, [conversation, onConversationUpdate]);

  const handleManualLoreScan = useCallback(async () => {
    const currentConversation = conversationRef.current;
    if (!currentConversation) return;
    
    const activeChars = allCharacters.filter(char => currentConversation.characterIds?.includes(char.id));
    if (activeChars.length === 0) {
        addNotification({ title: "Scan Info", message: "No active characters in this conversation to scan.", type: 'info' });
        return;
    }

    addNotification({ title: "Scan Started", message: `Analyzing last ${settings.livingLore.scanDepth} messages (manual scan)...` });
    
    const suggestions = await Promise.all(activeChars.map(char => 
        getLivingLoreSuggestion(currentConversation.messages, [char], settings.livingLore.scanDepth, settings, true)
    ));

    console.log('[Living Lore] Manual scan results:', {
        totalCharacters: activeChars.length,
        charactersScanned: activeChars.map(c => c.name),
        suggestionsReceived: suggestions.length,
        suggestionsDetail: suggestions.map(s => s ? { name: s.targetName, id: s.targetId, summary: s.summaryOfChange?.substring(0, 50) } : 'null')
    });

    const validSuggestions = suggestions.filter(s => s?.updateSuggested && s.targetId);
    
    console.log('[Living Lore] After validation:', {
        validCount: validSuggestions.length,
        validNames: validSuggestions.map(s => s.targetName)
    });
    
    if (validSuggestions.length > 0) {
        const suggestionMessages: Message[] = validSuggestions
            .filter(suggestion => {
                // Extra validation: ensure we have targetName
                if (!suggestion!.targetName) {
                    console.warn('Skipping suggestion without targetName:', suggestion);
                    return false;
                }
                return true;
            })
            .map(suggestion => ({
                id: generateUUID(), role: 'model', content: '', timestamp: Date.now(),
                suggestion: {
                    type: 'livingLore', title: `Living Lore Suggestion for ${suggestion!.targetName}`,
                    text: `Detected a significant change: "${suggestion!.summaryOfChange}". Would you like to update the character sheet?`,
                    targetId: suggestion!.targetId, targetName: suggestion!.targetName, summaryOfChange: suggestion!.summaryOfChange,
                }
            }));
        
        if (suggestionMessages.length > 0) {
            const updatedConv = { ...currentConversation, messages: [...currentConversation.messages, ...suggestionMessages] };
            onConversationUpdate(updatedConv);
            await saveConversation(updatedConv);
            addNotification({ title: "Scan Complete", message: `Found ${suggestionMessages.length} update(s) from manual scan.`, type: 'success' });
        } else {
            addNotification({ title: "Scan Complete", message: "No valid character updates found (missing character data).", type: 'error' });
        }
    } else {
        addNotification({ title: "Scan Complete", message: "No character events found in scanned messages.", type: 'info' });
    }
  }, [settings, allCharacters, onConversationUpdate, addNotification]);

  const activeUserPersona = allUserPersonas.find(p => p.id === settings.activeUserPersonaId) || null;

  const handleAutopilot = useCallback(async () => {
    const currentConversation = conversationRef.current;
    if (isStreaming || isEnhancing || !currentConversation) return;

    setIsEnhancing(true);
    setInput('Autopilot engaged... 🤖');
    
    let isFirstChunk = true;

    try {
        const modelMessages = currentConversation.messages.filter(m => m.role === 'model').slice(-10);
        if (modelMessages.length === 0) {
            throw new Error("No previous bot messages to respond to.");
        }
        const lastTenModelMessages = modelMessages.map(m => m.content).join('\n');
        const userName = activeUserPersona?.name || 'User';
        const characterNames = allCharacters
            .filter(c => currentConversation.characterIds?.includes(c.id))
            .map(c => c.name)
            .join(', ');

        await streamAutopilotResponse(lastTenModelMessages, userName, characterNames, (chunk) => {
            if (isFirstChunk) {
                setInput(chunk);
                isFirstChunk = false;
            } else {
                setInput(prev => prev + chunk);
            }
        });
    } catch (e: any) {
        addNotification({ title: 'Autopilot Failed', message: e.message, type: 'error' });
        setInput('');
    } finally {
        setIsEnhancing(false);
        textareaRef.current?.focus();
    }
  }, [isStreaming, isEnhancing, allCharacters, activeUserPersona, textareaRef]);

  const handlePolishPrompt = useCallback(async () => {
    const originalInput = input.trim();
    if (isStreaming || isEnhancing || !originalInput) return;

    setIsEnhancing(true);
    setInput('Enhancing text... ✨');
    
    let isFirstChunk = true;

    try {
        await streamPromptPolish(originalInput, (chunk) => {
            if (isFirstChunk) {
                setInput(chunk);
                isFirstChunk = false;
            } else {
                setInput(prev => prev + chunk);
            }
        });
    } catch(e: any) {
        addNotification({ title: 'Prompt Polish Failed', message: e.message, type: 'error' });
        setInput(originalInput); // Restore original on error
    } finally {
        setIsEnhancing(false);
        textareaRef.current?.focus();
    }
  }, [input, isStreaming, isEnhancing, textareaRef]);

  const handleSummarizeMessage = useCallback(async (messageId: string) => {
    const currentConversation = conversationRef.current;
    if (!currentConversation) return;

    const messageIndex = currentConversation.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    const messageToSummarize = currentConversation.messages[messageIndex];

    const messagesWithLoading = currentConversation.messages.map(m => 
      m.id === messageId ? { ...m, isSummarizing: true } : m
    );
    onConversationUpdate({ ...currentConversation, messages: messagesWithLoading });

    try {
      const summary = await summarizeMessageContent(messageToSummarize.content);
      const summarizedMessage = { ...messageToSummarize, summary, isSummarizing: false };
      
      const finalMessages = messagesWithLoading.map(m => 
        m.id === messageId ? summarizedMessage : m
      );
      
      const finalConversation = { ...currentConversation, messages: finalMessages };
      onConversationUpdate(finalConversation);
      await saveConversation(finalConversation);

    } catch (err: any) {
      addNotification({ title: 'Summarization Failed', message: err.message, type: 'error' });
      // Revert loading state on error
      onConversationUpdate(currentConversation);
    }
  }, [onConversationUpdate, conversationRef]);

  const handleGenerateSong = useCallback(async (messageId: string, customInstructions?: string) => {
    const currentConversation = conversationRef.current;
    if (!currentConversation || isGeneratingSong) return;

    const messageIndex = currentConversation.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    try {
      setIsGeneratingSong(true);

      // Get active characters for context
      const activeCharacters = currentConversation.characterIds
        ? allCharacters.filter(c => currentConversation.characterIds!.includes(c.id))
        : [];

      // Generate song from conversation context
      const songData = await generateSongFromContext(
        currentConversation.messages,
        messageId,
        settings,
        activeCharacters,
        20, // Analyze last 20 messages
        customInstructions
      );

      // Create GeneratedSong object and add to conversation.songs
      const generatedSong: import('../types').GeneratedSong = {
        id: generateUUID(),
        title: songData.title,
        lyrics: songData.lyrics,
        styles: songData.styles,
        sunoUrl: songData.sunoUrl,
        timestamp: Date.now(),
        conversationId: currentConversation.id,
        messageId: messageId,
        isWaitingForLink: !songData.sunoUrl
      };

      // Add song to conversation and save
      const updatedConversation: Conversation = {
        ...currentConversation,
        songs: [...(currentConversation.songs || []), generatedSong]
      };

      conversationRef.current = updatedConversation;
      onConversationUpdate(updatedConversation);
      await saveConversation(updatedConversation);

      addNotification({
        title: '✅ Song Created',
        message: `"${songData.title}" - Will appear in conversation stream`,
        type: 'success',
        duration: 4000
      });

    } catch (err: any) {
      addNotification({
        title: 'Song Generation Failed',
        message: err.message || 'An error occurred during song generation',
        type: 'error'
      });
    } finally {
      setIsGeneratingSong(false);
    }
  }, [conversationRef, allCharacters, settings, addNotification, isGeneratingSong]);

  const handleRegenerateSong = useCallback(async (customInstructions?: string) => {
    // Find the last message ID to regenerate from the same context
    const currentConversation = conversationRef.current;
    if (!currentConversation || currentConversation.messages.length === 0) return;
    
    const lastMessageId = currentConversation.messages[currentConversation.messages.length - 1].id;
    await handleGenerateSong(lastMessageId, customInstructions);
  }, [conversationRef, handleGenerateSong]);

  const handleCloseSong = useCallback(async (songId: string) => {
    const currentConversation = conversationRef.current;
    if (!currentConversation) return;

    // Remove song from conversation
    const updatedConversation: Conversation = {
      ...currentConversation,
      songs: (currentConversation.songs || []).filter(s => s.id !== songId)
    };

    conversationRef.current = updatedConversation;
    onConversationUpdate(updatedConversation);
    await saveConversation(updatedConversation);
  }, [conversationRef, onConversationUpdate]);

  const handleSongLinkDetected = useCallback(async (songId: string, sunoUrl: string) => {
    const currentConversation = conversationRef.current;
    if (!currentConversation) return;

    // Update song with Suno URL
    const updatedConversation: Conversation = {
      ...currentConversation,
      songs: (currentConversation.songs || []).map(song => 
        song.id === songId 
          ? { ...song, sunoUrl, isWaitingForLink: false }
          : song
      )
    };

    conversationRef.current = updatedConversation;
    onConversationUpdate(updatedConversation);
    await saveConversation(updatedConversation);
  }, [conversationRef, onConversationUpdate]);

  const handleGenerateSceneBackground = useCallback(async () => {
    const currentConversation = conversationRef.current;
    if (!currentConversation || isGeneratingBackground || isStreaming) return;

    try {
      setIsGeneratingBackground(true);
      
      addNotification({
        title: '🎨 Generating Scene Background',
        message: 'Analyzing conversation to create atmospheric background...',
        type: 'info',
        duration: 3000
      });

      // Get active characters and their states
      const activeCharacters = currentConversation.characterIds
        ? allCharacters.filter(c => currentConversation.characterIds!.includes(c.id))
        : [];

      // Character states may be available for additional context
      const characterStates = (currentConversation as any).characterStates as any[] | undefined;

      // Generate intelligent scene background prompt
      const scenePrompt = await generateSceneBackgroundPrompt(
        currentConversation.messages,
        activeCharacters,
        characterStates,
        settings
      );

      console.log('📝 Generated scene prompt:', scenePrompt);

      addNotification({
        title: '✨ Prompt Generated',
        message: 'Now generating image...',
        type: 'info',
        duration: 2000
      });

      // Determine which image generator to use based on availability
      let imageDataUrl: string | null = null;
      let generatorUsed = '';

      // Try ComfyUI first
      if (settings.comfyUI?.isConnected) {
        try {
          const result = await generateComfyUIImage(scenePrompt, settings.comfyUI, (progress) => {
            console.log(`ComfyUI progress: ${progress}`);
          });
          imageDataUrl = result.dataUrl;
          generatorUsed = 'ComfyUI';
        } catch (err) {
          console.warn('ComfyUI generation failed, trying next provider:', err);
        }
      }

      // Fallback to SD WebUI
      if (!imageDataUrl && settings.stableDiffusion?.isConnected) {
        try {
          imageDataUrl = await generateSDImage(scenePrompt, settings.stableDiffusion, (progress) => {
            console.log(`SD WebUI progress: ${progress}`);
          });
          generatorUsed = 'Stable Diffusion WebUI';
        } catch (err) {
          console.warn('SD WebUI generation failed, trying next provider:', err);
        }
      }

      // Fallback to Hugging Face
      if (!imageDataUrl && settings.huggingFace?.isConnected) {
        try {
          imageDataUrl = await generateHFImage(scenePrompt, settings.huggingFace, (progress) => {
            console.log(`Hugging Face progress: ${progress}`);
          });
          generatorUsed = 'Hugging Face';
        } catch (err) {
          console.warn('Hugging Face generation failed, trying next provider:', err);
        }
      }

      // Fallback to XAI
      if (!imageDataUrl && settings.xaiApiKey) {
        try {
          imageDataUrl = await generateXAIImage(scenePrompt, settings, (progress) => {
            console.log(`XAI progress: ${progress}`);
          });
          generatorUsed = 'XAI (Grok)';
        } catch (err) {
          console.warn('XAI generation failed:', err);
        }
      }

      if (!imageDataUrl) {
        throw new Error('No image generation service is available. Please configure at least one provider in settings.');
      }

      // Update settings with new background
      const updatedSettings: Settings = {
        ...settings,
        chatBackground: imageDataUrl
      };

      onSettingsUpdate(updatedSettings);

      addNotification({
        title: '✅ Background Generated',
        message: `Scene background created successfully using ${generatorUsed}!`,
        type: 'success',
        duration: 4000
      });

    } catch (err: any) {
      console.error('Scene background generation error:', err);
      addNotification({
        title: '❌ Background Generation Failed',
        message: err.message || 'An error occurred while generating the scene background',
        type: 'error',
        duration: 5000
      });
    } finally {
      setIsGeneratingBackground(false);
    }
  }, [conversationRef, allCharacters, settings, isGeneratingBackground, isStreaming, addNotification, onSettingsUpdate]);
  
  const handleImpersonateScene = useCallback(async () => {
    const currentConversation = conversationRef.current;
    if (isStreaming || isEnhancing || isTransforming || isSceneImpersonating || !currentConversation) return;

    setIsSceneImpersonating(true);
    const originalInput = input.trim();
    setInput('Writing scene...');
    
    try {
        const scene = await impersonateScene(originalInput, currentConversation.messages);
        setInput(scene);
        setIsImpersonatedInput(true);
    } catch (e: any) {
        addNotification({ title: 'Scene Impersonation Failed', message: e.message, type: 'error' });
        setInput(originalInput); // Restore on error
    } finally {
        setIsSceneImpersonating(false);
        textareaRef.current?.focus();
    }
}, [input, isStreaming, isEnhancing, isTransforming, isSceneImpersonating, textareaRef]);

const handleRemoveFiller = useCallback(async (messageId: string) => {
    const currentConversation = conversationRef.current;
    if (!currentConversation) return;

    const messageIndex = currentConversation.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    const messageToEdit = currentConversation.messages[messageIndex];

    const memoriesToDelete = await findMemoriesForMessage(messageToEdit, currentConversation.messages, currentConversation.ragCollectionName);
    if (memoriesToDelete.length > 0) {
        await deleteMemories(currentConversation.ragCollectionName!, memoriesToDelete.map(m => m.id)).catch(e => {
            console.error("Failed to delete old RAG memories before removing filler:", e);
        });
    }

    const messagesWithLoading = currentConversation.messages.map(m => 
        m.id === messageId ? { ...m, isSummarizing: true } : m
    );
    onConversationUpdate({ ...currentConversation, messages: messagesWithLoading });

    try {
        const editedContent = await removeFiller(messageToEdit.content);
        // Also clear summary as it's now outdated; store undo backup
        const editedMessage: Message = { 
          ...messageToEdit, 
          content: editedContent, 
          isSummarizing: false, 
          summary: undefined,
          lastEditedBackup: messageToEdit.content,
          lastEditedReason: 'remove_filler',
          lastEditedAt: Date.now(),
        };
        
        const finalMessages: Message[] = messagesWithLoading.map(m => 
          m.id === messageId ? editedMessage : m
        );
        
        const finalConversation = { ...currentConversation, messages: finalMessages };
        onConversationUpdate(finalConversation);

        const userMessagePartner = messageIndex > 0 ? finalConversation.messages[messageIndex - 1] : null;
        if (settings.rag.enabled && finalConversation.ragCollectionName && userMessagePartner && userMessagePartner.role === 'user') {
            await addMessagesToCollection(
                finalConversation.ragCollectionName,
                [userMessagePartner, editedMessage],
                settings,
                settings.rag.chunkSize
            ).catch(e => console.error("Failed to add new RAG memory after removing filler:", e));
        }

        await saveConversation(finalConversation);

    } catch (err: any) {
        addNotification({ title: "Error", message: `Failed to remove filler: ${err.message}`, type: 'error' });
        onConversationUpdate(currentConversation);
    }
}, [onConversationUpdate, addNotification, settings]);

  const handleApplyCustomEditInstructions = useCallback(async (messageId: string, instruction: string) => {
    const currentConversation = conversationRef.current;
    if (!currentConversation) return;
    const trimmed = instruction.trim();
    if (!trimmed) return;

    const messageIndex = currentConversation.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    const messagesWithLoading = currentConversation.messages.map(m =>
      m.id === messageId ? { ...m, isSummarizing: true } : m
    );
    onConversationUpdate({ ...currentConversation, messages: messagesWithLoading });

    try {
      const original = currentConversation.messages[messageIndex];

      // Delete RAG memories for this message pair if any
      const memoriesToDelete = await findMemoriesForMessage(original, currentConversation.messages, currentConversation.ragCollectionName);
      if (memoriesToDelete.length > 0) {
        await deleteMemories(currentConversation.ragCollectionName!, memoriesToDelete.map(m => m.id)).catch(e => {
          console.error('Failed to delete old RAG memories before custom edit:', e);
        });
      }

      const newContent = await editMessageWithInstruction(original.content, trimmed, settings);

      const finalMessages: Message[] = messagesWithLoading.map(m =>
        m.id === messageId 
          ? ({ ...m, content: newContent, summary: undefined, isSummarizing: false, lastEditedBackup: original.content, lastEditedReason: 'custom_edit', lastEditedAt: Date.now() } as Message)
          : m
      );

      const finalConversation = { ...currentConversation, messages: finalMessages };
      onConversationUpdate(finalConversation);

      // Re-add RAG memory for model message paired with its user
      if (settings.rag.enabled && finalConversation.ragCollectionName) {
        const m = finalConversation.messages[messageIndex];
        if (m.role === 'model' && messageIndex > 0) {
          const prev = finalConversation.messages[messageIndex - 1];
          if (prev.role === 'user') {
            await addMessagesToCollection(
              finalConversation.ragCollectionName,
              [prev, m],
              settings,
              settings.rag.chunkSize
            ).catch(e => console.error('Failed to add new RAG memory after custom edit:', e));
          }
        }
      }

      await saveConversation(finalConversation);

    } catch (err: any) {
      addNotification({ title: 'Error', message: `Failed to apply edits: ${err.message}` , type: 'error' });
      onConversationUpdate(currentConversation);
    }
  }, [onConversationUpdate, settings, addNotification]);

  const handleUndoLastEdit = useCallback(async (messageId: string) => {
    const currentConversation = conversationRef.current;
    if (!currentConversation) return;
    const idx = currentConversation.messages.findIndex(m => m.id === messageId);
    if (idx === -1) return;
    const original = currentConversation.messages[idx];
    if (!original.lastEditedBackup) return;

    // Allow undo for both remove_filler and custom_edit flows under Remove filler UI

    const messagesWithLoading = currentConversation.messages.map(m =>
      m.id === messageId ? { ...m, isSummarizing: true } : m
    );
    onConversationUpdate({ ...currentConversation, messages: messagesWithLoading });

    try {
      // Delete RAG for current content
      const memoriesToDelete = await findMemoriesForMessage(original, currentConversation.messages, currentConversation.ragCollectionName);
      if (memoriesToDelete.length > 0) {
        await deleteMemories(currentConversation.ragCollectionName!, memoriesToDelete.map(m => m.id)).catch(e => {
          console.error('Failed to delete RAG memories during undo:', e);
        });
      }

      // Restore backup and clear backup metadata
      const restored: Message = { ...original, content: original.lastEditedBackup!, lastEditedBackup: undefined, lastEditedReason: undefined, lastEditedAt: undefined, summary: undefined, isSummarizing: false };
      const finalMessages: Message[] = messagesWithLoading.map(m => m.id === messageId ? restored : m);
      const finalConversation = { ...currentConversation, messages: finalMessages };
      onConversationUpdate(finalConversation);

      // Recreate RAG memory for restored content (model + previous user)
      if (settings.rag.enabled && finalConversation.ragCollectionName) {
        const m = finalConversation.messages[idx];
        if (m.role === 'model' && idx > 0) {
          const prev = finalConversation.messages[idx - 1];
          if (prev.role === 'user') {
            await addMessagesToCollection(
              finalConversation.ragCollectionName,
              [prev, m],
              settings,
              settings.rag.chunkSize
            ).catch(e => console.error('Failed to add RAG memory after undo:', e));
          }
        }
      }

      await saveConversation(finalConversation);

    } catch (err: any) {
      addNotification({ title: 'Error', message: `Undo failed: ${err.message}`, type: 'error' });
      onConversationUpdate(currentConversation);
    }
  }, [onConversationUpdate, settings, addNotification]);

  const handleSwitchResponse = useCallback((messageId: string, targetResponse: 'primary' | 'alternative') => {
    const currentConversation = conversationRef.current;
    if (!currentConversation) return;
    
    const messageIndex = currentConversation.messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    const message = currentConversation.messages[messageIndex];
    if (!message.isDualResponse || !message.alternativeResponse) return;

    // If switching to alternative, swap the contents
    if (targetResponse === 'alternative' && message.selectedResponse === 'primary') {
      const tempContent = message.content;
      message.content = message.alternativeResponse;
      message.alternativeResponse = tempContent;
      message.selectedResponse = 'alternative';
    } else if (targetResponse === 'primary' && message.selectedResponse === 'alternative') {
      // Swap back
      const tempContent = message.content;
      message.content = message.alternativeResponse;
      message.alternativeResponse = tempContent;
      message.selectedResponse = 'primary';
    }

    const updatedMessages = currentConversation.messages.map(m => m.id === messageId ? message : m);
    const updatedConversation = { ...currentConversation, messages: updatedMessages };
    
    onConversationUpdate(updatedConversation);
  }, [conversationRef, onConversationUpdate]);

  const handleConfirmResponse = useCallback(async (messageId: string) => {
    const currentConversation = conversationRef.current;
    if (!currentConversation) return;
    
    const messageIndex = currentConversation.messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    const message = currentConversation.messages[messageIndex];
    if (!message.isDualResponse || !message.alternativeResponse) return;

    // Check if current selection is already synced
    if (message.ragSyncedResponse === message.selectedResponse) {
      addNotification({ 
        title: 'Already Confirmed', 
        message: 'This response has already been synced to RAG memory.', 
        type: 'info' 
      });
      return;
    }

    // Update RAG if enabled
    if (settings.rag.enabled && currentConversation.ragCollectionName) {
      const userMessagePartner = messageIndex > 0 ? currentConversation.messages[messageIndex - 1] : null;
      if (userMessagePartner && userMessagePartner.role === 'user') {
        // Delete old RAG memories for both responses
        const memoriesToDelete = await findMemoriesForMessage(message, currentConversation.messages, currentConversation.ragCollectionName);
        if (memoriesToDelete.length > 0) {
          await deleteMemories(currentConversation.ragCollectionName, memoriesToDelete.map(m => m.id)).catch(e => {
            console.error("Failed to delete old RAG memories:", e);
          });
        }

        // Add new RAG memories with the selected response only
        await addMessagesToCollection(
          currentConversation.ragCollectionName,
          [userMessagePartner, message],
          settings,
          settings.rag.chunkSize
        ).catch(e => console.error("Failed to add RAG memory:", e));
      }
    }
    
    // Mark current selection as synced and save
    message.ragSyncedResponse = message.selectedResponse || 'primary';
    const updatedMessages = currentConversation.messages.map(m => m.id === messageId ? message : m);
    const updatedConversation = { ...currentConversation, messages: updatedMessages };
    onConversationUpdate(updatedConversation);
    await saveConversation(updatedConversation);

    addNotification({ 
      title: 'Response Confirmed', 
      message: `${message.selectedResponse === 'primary' ? 'Primary' : 'Alternative'} response confirmed and saved to RAG.`, 
      type: 'success' 
    });
  }, [conversationRef, settings, findMemoriesForMessage, addNotification]);

  // --- Return Values ---
  // Expose state and handlers to the ChatView component.
  return {
    input,
    setInput: handleSetInput,
    isStreaming,
    isTransforming,
    isEnhancing,
    textareaRef,
    handleSend,
    handleEditMessage,
    handleRegenerateResponse,
    handleDeleteMessage,
    handleSaveConversationSettings,
    handleTransformToPrompt,
    handleSuggestionResponse,
    handleManualDirectorAI,
    handleManualLoreScan,
    handleAutopilot,
    handlePolishPrompt,
    handleSummarizeMessage,
    handleRemoveFiller,
    handleUndoLastEdit,
    handleApplyCustomEditInstructions,
    handleImpersonateScene,
    isSceneImpersonating,
    handleGenerateSong,
    // New: Song generation state
    isGeneratingSong,
    handleCloseSong,
    handleRegenerateSong,
    handleSongLinkDetected,
    // New: Scene background generation
    handleGenerateSceneBackground,
    isGeneratingBackground,
    // New: Expose response control state
    responseControls,
    setResponseControls,
    // New: Expose timer and stop handler
    generationTime,
    handleStopGeneration,
    attachedImage,
    setAttachedImage,
    // New: Dual Response feature
    handleSwitchResponse,
    handleConfirmResponse,
  };
};
