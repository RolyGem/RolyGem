import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { Sidebar } from './components/Sidebar';
import ChatView from './components/ChatView';
import { NotificationProvider, useNotifications } from './contexts/NotificationContext';
import { RadioProvider } from './contexts/RadioContext';
import { NotificationContainer } from './components/NotificationToast';
import { LoaderIcon } from './components/icons/LoaderIcon';

import * as db from './services/db';
import { log } from './services/loggingService';
import { fetchOpenRouterModels } from './services/openrouter';
import { streamChatResponse } from './services/aiService';
import * as botOrchestrator from './services/botOrchestrator';
import * as telegramService from './services/telegramService';
import * as proactiveAgentService from './services/proactiveAgentService';
import { generateImage as generateComfyUIImage } from './services/comfyuiService';
import { INITIAL_MODELS } from './constants';
import type { Conversation, Settings, Model, Character, Lorebook, UserPersona, CustomThemeColors, Message, Story, IdentityProfile, IdentityFact, Briefing } from './types';
import { generateUUID } from './utils/uuid';
import { deleteCollection } from './services/ragService';

// Lazy load modals and overlays to improve initial load performance
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const CharactersModal = lazy(() => import('./components/CharactersModal'));
const LorebooksModal = lazy(() => import('./components/LorebooksModal'));
const UpdateKnowledgeModal = lazy(() => import('./components/UpdateKnowledgeModal'));
const LivingLoreUpdateModal = lazy(() => import('./components/LivingLoreUpdateModal'));
const MemoryModal = lazy(() => import('./components/MemoryModal'));
const RadioOverlay = lazy(() => import('./components/RadioOverlay'));
const StoryView = lazy(() => import('./components/StoryView'));
const AddToIdentityModal = lazy(() => import('./components/modals/AddToIdentityModal'));
const BriefingRoomModal = lazy(() => import('./components/BriefingRoomModal'));


const CONVERSATION_PAGE_SIZE = 20;
const STORY_PAGE_SIZE = 20;
const DATA_PAGE_SIZE = 20; // For characters, lorebooks, personas

const applyTheme = (settings: Settings) => {
  const root = document.documentElement;
  
  // Apply font and layout styles FIRST (before clearing cssText)
  // Add sans-serif fallback if not already present
  const fontFamilyValue = settings.fontFamily.includes(',') 
    ? settings.fontFamily 
    : `${settings.fontFamily}, sans-serif`;
  root.style.setProperty('--font-family', fontFamilyValue);
  
  if (settings.theme === 'light') {
    root.classList.remove('dark');
    // Apply softer light theme colors for better readability
    root.style.setProperty('--primary-bg', '#f8fafc'); // Soft gray instead of pure white
    root.style.setProperty('--secondary-bg', '#f1f5f9');
    root.style.setProperty('--tertiary-bg', '#e2e8f0');
    root.style.setProperty('--text-color', '#1e293b'); // Dark slate for text
    root.style.setProperty('--text-secondary', '#64748b');
    root.style.setProperty('--border-color', '#cbd5e1');
  } else if (settings.theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.add('dark'); // Custom theme is based on dark
    const colors: CustomThemeColors = settings.customThemeColors;
    Object.entries(colors).forEach(([key, value]) => {
      // camelCase to kebab-case
      const cssVar = `--${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`;
      root.style.setProperty(cssVar, value);
    });
  }
  // Continue applying other font and layout styles
  root.style.setProperty('--font-size', `${settings.fontSize}px`);
  root.style.setProperty('--line-height', String(settings.lineHeight));
  root.style.setProperty('--desktop-padding', `${settings.desktopPadding}%`);
  root.style.setProperty('--message-spacing-multiplier', String(settings.messageSpacing));

  let borderRadius;
  switch (settings.messageBubbleStyle) {
      case 'sharp': borderRadius = '0.25rem'; break;
      case 'soft': borderRadius = '0.75rem'; break;
      case 'rounded': borderRadius = '1.5rem'; break;
  }
  root.style.setProperty('--bubble-radius', borderRadius);
  
  // New: Apply dialogue highlighting color only (theme-aware + custom)
  const dialogueColor = settings.highlightDialogue
    ? (
        settings.theme === 'light'
          ? (settings.dialogueColorLight || '#1d4ed8') // blue-700
          : (settings.dialogueColorDark || '#93c5fd')  // blue-300
      )
    : 'inherit';
  root.style.setProperty('--dialogue-color', dialogueColor);
};

const LoadingFallback = () => (
    <div className="fixed inset-0 bg-primary-bg/50 flex items-center justify-center z-[100]">
        <LoaderIcon className="w-10 h-10 text-accent-primary" />
    </div>
);


const AppContent: React.FC = () => {
    // Global State
    const [settings, setSettings] = useState<Settings | null>(null);
    const [models, setModels] = useState<Model[]>(INITIAL_MODELS);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [currentView, setCurrentView] = useState<'chat' | 'story'>('chat');
    
    // Chat State
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [hasMoreConversations, setHasMoreConversations] = useState(true);
    const [conversationPage, setConversationPage] = useState(0);
    const [isLoadingConversations, setIsLoadingConversations] = useState(false);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

    // Story State
    const [stories, setStories] = useState<Story[]>([]);
    const [hasMoreStories, setHasMoreStories] = useState(true);
    const [storyPage, setStoryPage] = useState(0);
    const [isLoadingStories, setIsLoadingStories] = useState(false);
    const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);

    // Modals
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isCharactersOpen, setIsCharactersOpen] = useState(false);
    const [isLorebooksOpen, setIsLorebooksOpen] = useState(false);
    const [isMemoryOpen, setIsMemoryOpen] = useState(false);
    const [isAddToIdentityModalOpen, setIsAddToIdentityModalOpen] = useState(false);
    const [isUpdateKnowledgeOpen, setIsUpdateKnowledgeOpen] = useState(false);
    const [isBriefingRoomOpen, setIsBriefingRoomOpen] = useState(false);
    const [livingLoreModalData, setLivingLoreModalData] = useState<{ character: Character, suggestedChange: string } | null>(null);

    // Data Management States
    const [characters, setCharacters] = useState<Character[]>([]);
    const [hasMoreCharacters, setHasMoreCharacters] = useState(true);
    const [characterPage, setCharacterPage] = useState(0);

    const [lorebooks, setLorebooks] = useState<Lorebook[]>([]);
    const [hasMoreLorebooks, setHasMoreLorebooks] = useState(true);
    const [lorebookPage, setLorebookPage] = useState(0);

    const [userPersonas, setUserPersonas] = useState<UserPersona[]>([]);
    const [hasMorePersonas, setHasMorePersonas] = useState(true);
    const [personaPage, setPersonaPage] = useState(0);

    const [identityProfiles, setIdentityProfiles] = useState<IdentityProfile[]>([]);
    const [hasMoreIdentityProfiles, setHasMoreIdentityProfiles] = useState(true);
    const [identityProfilePage, setIdentityProfilePage] = useState(0);

    const [briefings, setBriefings] = useState<Briefing[]>([]);
    const [unreadBriefingCount, setUnreadBriefingCount] = useState(0);

    const { addNotification } = useNotifications();

    const settingsRef = useRef<Settings | null>(null);
    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    // Save last active view/ID to localStorage - important for mobile
    useEffect(() => {
        if (selectedConversationId || selectedStoryId) {
            const lastState = {
                view: currentView,
                chatId: selectedConversationId,
                storyId: selectedStoryId,
            };
            localStorage.setItem('geminiFusionLastState', JSON.stringify(lastState));
        }
    }, [currentView, selectedConversationId, selectedStoryId]);

    // Persist state when the app is backgrounded on mobile devices
    useEffect(() => {
        const saveStateBeforeHide = () => {
            if (selectedConversationId || selectedStoryId) {
                const lastState = {
                    view: currentView,
                    chatId: selectedConversationId,
                    storyId: selectedStoryId,
                    timestamp: Date.now()
                };
                localStorage.setItem('geminiFusionLastState', JSON.stringify(lastState));
                sessionStorage.setItem('appWasActive', 'true');
            }
        };

        // Persist immediately when the page is hidden (mobile)
        document.addEventListener('visibilitychange', saveStateBeforeHide);
        document.addEventListener('pagehide', saveStateBeforeHide);
        window.addEventListener('beforeunload', saveStateBeforeHide);

        return () => {
            document.removeEventListener('visibilitychange', saveStateBeforeHide);
            document.removeEventListener('pagehide', saveStateBeforeHide);
            window.removeEventListener('beforeunload', saveStateBeforeHide);
        };
    }, [currentView, selectedConversationId, selectedStoryId]);

    const loadMoreCharacters = useCallback(async (page: number) => {
        const newChars = await db.getAllCharacters(DATA_PAGE_SIZE, page * DATA_PAGE_SIZE);
        setCharacters(prev => page === 0 ? newChars : [...prev, ...newChars]);
        setHasMoreCharacters(newChars.length === DATA_PAGE_SIZE);
        setCharacterPage(page + 1);
    }, []);

    const loadMoreLorebooks = useCallback(async (page: number) => {
        const newBooks = await db.getAllLorebooks(DATA_PAGE_SIZE, page * DATA_PAGE_SIZE);
        setLorebooks(prev => page === 0 ? newBooks : [...prev, ...newBooks]);
        setHasMoreLorebooks(newBooks.length === DATA_PAGE_SIZE);
        setLorebookPage(page + 1);
    }, []);

    const loadMorePersonas = useCallback(async (page: number) => {
        const newPersonas = await db.getAllUserPersonas(DATA_PAGE_SIZE, page * DATA_PAGE_SIZE);
        setUserPersonas(prev => page === 0 ? newPersonas : [...prev, ...newPersonas]);
        setHasMorePersonas(newPersonas.length === DATA_PAGE_SIZE);
        setPersonaPage(page + 1);
    }, []);

    const loadMoreIdentityProfiles = useCallback(async (page: number) => {
        const newProfiles = await db.getAllIdentityProfiles(DATA_PAGE_SIZE, page * DATA_PAGE_SIZE);
        setIdentityProfiles(prev => page === 0 ? newProfiles : [...prev, ...newProfiles]);
        setHasMoreIdentityProfiles(newProfiles.length === DATA_PAGE_SIZE);
        setIdentityProfilePage(page + 1);
    }, []);

    const loadBriefings = useCallback(async () => {
        const [all, unreadCount] = await Promise.all([
            db.getAllBriefings(),
            db.getUnreadBriefingCount()
        ]);
        setBriefings(all);
        setUnreadBriefingCount(unreadCount);
    }, []);

    // Data loading
    useEffect(() => {
        const loadInitialData = async () => {
            log('INFO', 'APP_LIFECYCLE', 'Application initializing...');
            
            // Auto-cleanup old logs (older than 30 days) to prevent storage bloat
            // This runs in the background and doesn't block app initialization
            import('./services/loggingService').then(({ cleanupOldLogs }) => {
                cleanupOldLogs(30).catch(err => 
                    console.warn('[App] Failed to cleanup old logs:', err)
                );
            });
            
            const savedSettings = await db.getSettings();
            setSettings(savedSettings);
            applyTheme(savedSettings);

            fetchOpenRouterModels().then(orModels => {
                setModels(prev => [...INITIAL_MODELS, ...orModels]);
            });
            
            // Restore last state from localStorage
            const lastStateJSON = localStorage.getItem('geminiFusionLastState');
            if (lastStateJSON) {
                try {
                    const lastState = JSON.parse(lastStateJSON);
                    let restored = false;
                    if (lastState.view === 'chat' && lastState.chatId) {
                        const lastConvo = await db.getConversation(lastState.chatId);
                        if (lastConvo) {
                            setConversations([lastConvo]);
                            setSelectedConversationId(lastState.chatId);
                            setCurrentView('chat');
                            restored = true;
                        }
                    } else if (lastState.view === 'story' && lastState.storyId) {
                        const lastStory = await db.getStory(lastState.storyId);
                        if (lastStory) {
                            setStories([lastStory]);
                            setSelectedStoryId(lastState.storyId);
                            setCurrentView('story');
                            restored = true;
                        }
                    }

                    if (restored) {
                        log('INFO', 'APP_LIFECYCLE', 'Restored previous session', { view: lastState.view, id: lastState.chatId || lastState.storyId });
                    } else {
                        localStorage.removeItem('geminiFusionLastState');
                    }
                } catch (e) {
                    log('WARN', 'APP_LIFECYCLE', 'Failed to restore last session state', { error: e });
                    localStorage.removeItem('geminiFusionLastState');
                }
            }


            loadMoreConversations(0);
            loadMoreStories(0);
            loadMoreCharacters(0);
            loadMoreLorebooks(0);
            loadMorePersonas(0);
            loadMoreIdentityProfiles(0);
            loadBriefings();
        };
        loadInitialData();
    }, []);

    const loadMoreConversations = useCallback(async (page: number) => {
        if (isLoadingConversations) return;
        setIsLoadingConversations(true);
        const newConvos = await db.getAllConversations(CONVERSATION_PAGE_SIZE, page * CONVERSATION_PAGE_SIZE);
        setConversations(prev => {
            const existingIds = new Set(prev.map(c => c.id));
            const filteredNewConvos = newConvos.filter(c => !existingIds.has(c.id));
            const allConvos = page === 0 ? [...prev, ...filteredNewConvos] : [...prev, ...filteredNewConvos];
            allConvos.sort((a, b) => b.createdAt - a.createdAt);
            return allConvos;
        });
        setHasMoreConversations(newConvos.length === CONVERSATION_PAGE_SIZE);
        setConversationPage(page + 1);
        setIsLoadingConversations(false);
    }, [isLoadingConversations]);

    const loadMoreStories = useCallback(async (page: number) => {
        if (isLoadingStories) return;
        setIsLoadingStories(true);
        const newStories = await db.getAllStories(STORY_PAGE_SIZE, page * STORY_PAGE_SIZE);
        setStories(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const filteredNewStories = newStories.filter(s => !existingIds.has(s.id));
            const allStories = page === 0 ? [...prev, ...filteredNewStories] : [...prev, ...filteredNewStories];
            allStories.sort((a, b) => b.createdAt - a.createdAt);
            return allStories;
        });
        setHasMoreStories(newStories.length === STORY_PAGE_SIZE);
        setStoryPage(page + 1);
        setIsLoadingStories(false);
    }, [isLoadingStories]);
    
    const onCharactersModalOpen = useCallback(() => {
        if (characters.length === 0) {
            loadMoreCharacters(0);
        }
    }, [characters.length, loadMoreCharacters]);

    const onLorebooksModalOpen = useCallback(() => {
        if (lorebooks.length === 0) {
            loadMoreLorebooks(0);
        }
    }, [lorebooks.length, loadMoreLorebooks]);

    const onSettingsModalOpen = useCallback(() => {
        if (userPersonas.length === 0) {
            loadMorePersonas(0);
        }
        if (identityProfiles.length === 0) {
            loadMoreIdentityProfiles(0);
        }
    }, [userPersonas.length, loadMorePersonas, identityProfiles.length, loadMoreIdentityProfiles]);


    const handleSelectConversation = useCallback((id: string) => {
        setSelectedConversationId(id);
        setCurrentView('chat');
        setIsSidebarOpen(false);
    }, []);

    const handleSelectStory = useCallback((id: string) => {
        setSelectedStoryId(id);
        setCurrentView('story');
        setIsSidebarOpen(false);
    }, []);

    const selectedConversation = useMemo(() => {
        return conversations.find(c => c.id === selectedConversationId) || null;
    }, [selectedConversationId, conversations]);

    const selectedStory = useMemo(() => {
        return stories.find(s => s.id === selectedStoryId) || null;
    }, [selectedStoryId, stories]);

    const handleConversationUpdate = useCallback((updatedConversation: Conversation) => {
        setConversations(prev => {
            const index = prev.findIndex(c => c.id === updatedConversation.id);
            if (index > -1) {
                const newConvos = [...prev];
                newConvos[index] = updatedConversation;
                return newConvos.sort((a, b) => b.createdAt - a.createdAt); // Keep sorted
            }
            return [updatedConversation, ...prev].sort((a, b) => b.createdAt - a.createdAt);
        });
    }, []);

    const handleStoryUpdate = useCallback((updatedStory: Story) => {
        setStories(prev => {
            const index = prev.findIndex(s => s.id === updatedStory.id);
            if (index > -1) {
                const newStories = [...prev];
                newStories[index] = updatedStory;
                return newStories; // Keep sort order by created date
            }
            return [updatedStory, ...prev];
        });
    }, []);
    
    const handleNewConversation = useCallback(() => {
        if (!settings) return;
        const newId = generateUUID();
        const newConversation: Conversation = {
            id: newId,
            title: 'New Conversation',
            messages: [],
            createdAt: Date.now(),
            systemPrompt: '',
            enableThinking: true,
            ragCollectionName: `rag_${newId.replace(/-/g, '')}`,
            // New: Initialize Story Arcs properties
            storyArcsEnabled: false,
            currentLevel: 1,
            messageProgress: 0,
            // New: Initialize Conscious State Engine properties
            consciousState: null,
            consciousStateSettings: {
                enabled: false,
                updateFrequency: 2,
                scanDepth: 4,
            },
            multiCharacterMode: 'director',
            // New: Initialize scenario field
            scenario: '',
            narrativeDirectives: [],
            // New: Initialize smart AI systems configuration
            smartSystemConfig: {
                willEngine: {
                    enabled: true,
                    verificationFrequency: 5,
                    contextAnalysisFrequency: 3,
                    maxActiveDirectives: 5
                },
                directorAI: {
                    mode: 'smart', // 'smart' or 'frequency'
                    frequencyValue: 3,
                    stagnationThreshold: 50
                },
                livingLore: {
                    mode: 'smart', // 'smart' or 'frequency'
                    frequencyValue: 1,
                    significanceThreshold: 60
                },
                consciousState: {
                    mode: 'smart', // 'smart' or 'frequency'
                    frequencyValue: 2,
                    emotionalChangeThreshold: 50
                }
            }
        };
        log('INFO', 'CONVERSATION', 'New conversation created', { id: newId });
        setConversations(prev => [newConversation, ...prev]);
        setSelectedConversationId(newId);
        setCurrentView('chat');
        setIsSidebarOpen(false);
        db.saveConversation(newConversation);
    }, [settings]);

    const handleNewStory = useCallback(() => {
        const newId = generateUUID();
        const newStory: Story = {
            id: newId,
            title: 'New Story',
            content: '',
            systemPrompt: 'You are a master storyteller. Write a compelling story.',
            createdAt: Date.now()
        };
        log('INFO', 'STORY', 'New story created', { id: newId });
        setStories(prev => [newStory, ...prev]);
        setSelectedStoryId(newId);
        setCurrentView('story');
        setIsSidebarOpen(false);
        db.saveStory(newStory);
    }, []);

    const handleDeleteConversation = useCallback(async (id: string) => {
        log('INFO', 'CONVERSATION', 'Deleting conversation', { id });
        const convoToDelete = conversations.find(c => c.id === id);
        if (convoToDelete?.ragCollectionName) {
            await deleteCollection(convoToDelete.ragCollectionName);
            log('INFO', 'RAG', 'Deleted RAG collection for conversation', { collectionName: convoToDelete.ragCollectionName });
        }
        await db.deleteConversation(id);
        setConversations(prev => prev.filter(c => c.id !== id));
        if (selectedConversationId === id) {
            setSelectedConversationId(null);
        }
    }, [selectedConversationId, conversations]);

    const handleRenameConversation = useCallback(async (id: string, newTitle: string) => {
        log('INFO', 'CONVERSATION', 'Renaming conversation', { id, newTitle });
        const convo = conversations.find(c => c.id === id);
        if (!convo) return;

        const updatedConvo: Conversation = {
            ...convo,
            title: newTitle,
        };

        await db.saveConversation(updatedConvo);
        handleConversationUpdate(updatedConvo);
        
        log('INFO', 'CONVERSATION', 'Conversation renamed', { id, newTitle });
        addNotification({
            title: 'Renamed Successfully',
            message: `Conversation renamed to "${newTitle}".`,
            type: 'success',
            duration: 3000
        });
    }, [conversations, handleConversationUpdate, addNotification]);

    const handleDeleteStory = useCallback(async (id: string) => {
        log('INFO', 'STORY', 'Deleting story', { id });
        await db.deleteStory(id);
        setStories(prev => prev.filter(s => s.id !== id));
        if (selectedStoryId === id) {
            setSelectedStoryId(null);
        }
    }, [selectedStoryId]);

    const handleToggleStoryArcs = useCallback(async (id: string) => {
        const convo = conversations.find(c => c.id === id);
        if (!convo) return;

        const isEnabling = !convo.storyArcsEnabled;
        const updatedConvo: Conversation = {
            ...convo,
            storyArcsEnabled: isEnabling,
            // Initialize level and progress if enabling for the first time
            currentLevel: convo.currentLevel || 1,
            messageProgress: convo.messageProgress || 0,
        };

        handleConversationUpdate(updatedConvo);
        await db.saveConversation(updatedConvo);
        addNotification({
            title: 'Story Arcs',
            message: `Story Arcs mode has been ${isEnabling ? 'activated' : 'deactivated'} for this conversation.`,
            type: 'info',
            duration: 4000
        });
    }, [conversations, handleConversationUpdate, addNotification]);

    const handleExportConversation = useCallback(async (id: string) => {
        const convo = conversations.find(c => c.id === id);
        if (!convo) return;

        try {
            const exportData = JSON.stringify(convo, null, 2);
            const blob = new Blob([exportData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${convo.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            log('INFO', 'CONVERSATION', 'Conversation exported', { id, title: convo.title });
            addNotification({
                title: 'Exported Successfully',
                message: `"${convo.title}" has been exported.`,
                type: 'success',
                duration: 3000
            });
        } catch (error) {
            log('ERROR', 'CONVERSATION', 'Failed to export conversation', { id, error });
            addNotification({
                title: 'Export Failed',
                message: 'An error occurred while exporting the conversation.',
                type: 'error',
                duration: 5000
            });
        }
    }, [conversations, addNotification]);

    const handleImportConversation = useCallback(async (id: string) => {
        const convo = conversations.find(c => c.id === id);
        if (!convo || convo.messages.length > 0) {
            addNotification({
                title: 'Import Failed',
                message: 'Can only import into empty conversations.',
                type: 'error',
                duration: 4000
            });
            return;
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        
        input.onchange = async (e: Event) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            try {
                const text = await file.text();
                const importedData = JSON.parse(text) as Conversation;

                if (!importedData.messages || !Array.isArray(importedData.messages)) {
                    throw new Error('Invalid conversation format');
                }

                const updatedConvo: Conversation = {
                    ...convo,
                    title: importedData.title || convo.title,
                    messages: importedData.messages,
                    systemPrompt: importedData.systemPrompt || convo.systemPrompt,
                    characterIds: importedData.characterIds || convo.characterIds,
                    lorebookIds: importedData.lorebookIds || convo.lorebookIds,
                    enableThinking: importedData.enableThinking ?? convo.enableThinking,
                    storyArcsEnabled: importedData.storyArcsEnabled ?? convo.storyArcsEnabled,
                    currentLevel: importedData.currentLevel ?? convo.currentLevel,
                    messageProgress: importedData.messageProgress ?? convo.messageProgress,
                    consciousState: importedData.consciousState ?? convo.consciousState,
                    consciousStateSettings: importedData.consciousStateSettings ?? convo.consciousStateSettings,
                    multiCharacterMode: importedData.multiCharacterMode ?? convo.multiCharacterMode,
                    scenario: importedData.scenario ?? convo.scenario,
                    narrativeDirectives: importedData.narrativeDirectives ?? convo.narrativeDirectives,
                    smartSystemConfig: importedData.smartSystemConfig ?? convo.smartSystemConfig,
                };

                await db.saveConversation(updatedConvo);
                handleConversationUpdate(updatedConvo);

                log('INFO', 'CONVERSATION', 'Conversation imported', { id, title: updatedConvo.title });
                addNotification({
                    title: 'Imported Successfully',
                    message: `"${updatedConvo.title}" has been imported.`,
                    type: 'success',
                    duration: 3000
                });
            } catch (error) {
                log('ERROR', 'CONVERSATION', 'Failed to import conversation', { id, error });
                addNotification({
                    title: 'Import Failed',
                    message: 'The file format is invalid or corrupted.',
                    type: 'error',
                    duration: 5000
                });
            }
        };

        input.click();
    }, [conversations, handleConversationUpdate, addNotification]);
    
    const handleLiveUpdateSettings = useCallback((newSettings: Settings) => {
        setSettings(newSettings);
        applyTheme(newSettings);
    }, []);

    const getAIResponseForBot = useCallback(async (conversation: Conversation): Promise<string> => {
        const currentSettings = settingsRef.current;
        if (!currentSettings) {
            throw new Error("Settings not available.");
        }

        return new Promise((resolve, reject) => {
            const model = models.find(m => m.id === currentSettings.defaultModelId) || models.find(m => m.id === 'gemini-2.5-flash') || models[0];
            const charactersForBot = characters.filter(c => conversation.characterIds?.includes(c.id));
            const lorebooksForBot = lorebooks.filter(lb => conversation.lorebookIds?.includes(lb.id));
            const personaForBot = userPersonas.find(p => p.id === currentSettings.activeUserPersonaId) || null;

            streamChatResponse(
                conversation,
                conversation.messages,
                model,
                currentSettings,
                charactersForBot,
                lorebooksForBot,
                personaForBot,
                // @google/genai-codelab-user-troubleshooting: FIX: Added missing identityProfiles argument.
                identityProfiles,
                () => {}, // onChunk is handled by onComplete
                (error) => reject(error),
                async (totalTokens, responseText, modelMessage) => {
                    const latestConversation = await db.getConversationByTelegramChatId(conversation.telegramChatId!);
                    if (!latestConversation) {
                        reject(new Error(`Conversation for chat ID ${conversation.telegramChatId} not found.`));
                        return;
                    }

                    const finalModelMessage = { ...modelMessage, content: responseText, tokenCount: totalTokens };
                    const updatedConversation = {
                        ...latestConversation,
                        messages: [...latestConversation.messages, finalModelMessage]
                    };
                    await db.saveConversation(updatedConversation);
                    handleConversationUpdate(updatedConversation);
                    resolve(responseText);
                },
                // Fix: Add the missing 'signal' argument to the streamChatResponse call to align with its definition.
                new AbortController().signal,
                // @google/genai-codelab-user-troubleshooting: FIX: Add missing onStatusUpdate argument to match the function signature.
                () => {}
            );
        });
    }, [models, characters, lorebooks, userPersonas, identityProfiles, handleConversationUpdate]);

    const findOrCreateConversationForBot = useCallback(async (chatId: number): Promise<Conversation> => {
        const existingConvo = await db.getConversationByTelegramChatId(chatId);
        if (existingConvo) {
            return existingConvo;
        }
        
        const currentSettings = settingsRef.current;
        if (!currentSettings) throw new Error("Settings not loaded.");
        
        const newId = generateUUID();
        const newConversation: Conversation = {
            id: newId,
            title: `Telegram Chat: ${chatId}`,
            messages: [],
            createdAt: Date.now(),
            systemPrompt: currentSettings.systemPrompt,
            enableThinking: true,
            ragCollectionName: `rag_${newId.replace(/-/g, '')}`,
            telegramChatId: chatId,
            consciousState: null,
            consciousStateSettings: {
                enabled: false,
                updateFrequency: 2,
                scanDepth: 4,
            },
            multiCharacterMode: 'director',
            scenario: '',
            narrativeDirectives: [],
        };
        await db.saveConversation(newConversation);
        setConversations(prev => [newConversation, ...prev]);
        return newConversation;
    }, []);

    const handleNewConversationForBot = useCallback(async (chatId: number): Promise<Conversation> => {
        const currentConvo = await db.getConversationByTelegramChatId(chatId);
        
        if (currentConvo) {
            const archivedConvo: Conversation = {
                ...currentConvo,
                title: `[Archived] ${currentConvo.title}`,
                telegramChatId: undefined // Unlink from bot
            };
            await db.saveConversation(archivedConvo);
            handleConversationUpdate(archivedConvo); // Update UI
        }
        
        const newConversation = await findOrCreateConversationForBot(chatId);
        handleConversationUpdate(newConversation);
        return newConversation;
    }, [findOrCreateConversationForBot, handleConversationUpdate]);

    const handleImageGenerationForBot = useCallback(async (generator: 'comfyui' | 'sdwebui', prompt: string, chatId: number) => {
        const currentSettings = settingsRef.current;
        if (!currentSettings) return;

        const token = currentSettings.telegram.botToken;

        if (generator === 'comfyui') {
            if (!currentSettings.comfyUI.isConnected) {
                await telegramService.sendMessage(token, chatId, "ComfyUI is not connected in the main app settings.");
                return;
            }
            try {
                await telegramService.sendMessage(token, chatId, `🎨 Generating image for: "${prompt}"...`);
                await telegramService.sendChatAction(token, chatId, 'upload_photo');
                
                const { filename } = await generateComfyUIImage(prompt, currentSettings.comfyUI, (progress) => {});
                
                const imageUrl = `${currentSettings.comfyUI.url}/view?filename=${encodeURIComponent(filename)}`;
                await telegramService.sendPhoto(token, chatId, imageUrl, `*Prompt:* \`${prompt}\``);

            } catch (e: any) {
                await telegramService.sendMessage(token, chatId, `😥 Error generating image: ${e.message}`);
            }
        }
    }, []);


    const handleSaveSettings = useCallback(async (newSettings: Settings) => {
        log('INFO', 'SETTINGS', 'Settings saved');
        await db.saveSettings(newSettings);
        setSettings(newSettings);
        applyTheme(newSettings);
        addNotification({ title: "Settings Saved", message: "Your new settings have been applied.", type: 'success', duration: 3000 });
        
        botOrchestrator.stop();
        if (newSettings.telegram.enabled && newSettings.telegram.isConnected) {
            botOrchestrator.start(
                newSettings,
                models,
                characters,
                findOrCreateConversationForBot, 
                handleNewConversationForBot,
                db.saveConversation,
                handleConversationUpdate,
                getAIResponseForBot,
                handleImageGenerationForBot
            );
        }
    }, [addNotification, models, characters, findOrCreateConversationForBot, getAIResponseForBot, handleNewConversationForBot, handleConversationUpdate, handleImageGenerationForBot]);

    const handleSelectModel = useCallback(async (modelId: string) => {
        if (settings) {
            const newSettings = { ...settings, defaultModelId: modelId };
            await handleSaveSettings(newSettings);
        }
    }, [settings, handleSaveSettings]);

    const handleSaveCharacter = useCallback(async (character: Character) => {
        await db.saveCharacter(character);
        setCharacterPage(0);
        await loadMoreCharacters(0);
    }, [loadMoreCharacters]);
    
    const handleDeleteCharacter = useCallback(async (id: string) => {
        await db.deleteCharacter(id);
        setCharacterPage(0);
        await loadMoreCharacters(0);
    }, [loadMoreCharacters]);

    const handleSaveLorebook = useCallback(async (lorebook: Lorebook) => {
        await db.saveLorebook(lorebook);
        setLorebookPage(0);
        await loadMoreLorebooks(0);
    }, [loadMoreLorebooks]);

    const handleDeleteLorebook = useCallback(async (id: string) => {
        await db.deleteLorebook(id);
        setLorebookPage(0);
        await loadMoreLorebooks(0);
    }, [loadMoreLorebooks]);

    const handleSaveUserPersona = useCallback(async (persona: UserPersona) => {
        await db.saveUserPersona(persona);
        setPersonaPage(0);
        await loadMorePersonas(0);
    }, [loadMorePersonas]);

    const handleDeleteUserPersona = useCallback(async (id: string) => {
        await db.deleteUserPersona(id);
        setPersonaPage(0);
        await loadMorePersonas(0);
    }, [loadMorePersonas]);
    
    const handleSaveIdentityProfile = useCallback(async (profile: IdentityProfile) => {
        await db.saveIdentityProfile(profile);
        setIdentityProfilePage(0);
        await loadMoreIdentityProfiles(0);
    }, [loadMoreIdentityProfiles]);

    const handleDeleteIdentityProfile = useCallback(async (id: string) => {
        await db.deleteIdentityProfile(id);
        setIdentityProfilePage(0);
        await loadMoreIdentityProfiles(0);
    }, [loadMoreIdentityProfiles]);

    const handleUpdateKnowledgeComplete = useCallback(async (updatedCharacters: Character[], newLorebooks: Lorebook[]) => {
        try {
            for (const char of updatedCharacters) {
                await db.saveCharacter(char);
            }
            for (const book of newLorebooks) {
                await db.saveLorebook(book);
            }
            setCharacterPage(0);
            await loadMoreCharacters(0);
            setLorebookPage(0);
            await loadMoreLorebooks(0);
            
            addNotification({ title: "Knowledge Updated", message: "Characters and lorebooks have been successfully updated.", type: 'success', duration: 4000 });
        } catch (error) {
            addNotification({ title: "Update Error", message: "Failed to save all updates to the database.", type: 'error', duration: 5000 });
        }
    }, [loadMoreCharacters, loadMoreLorebooks, addNotification]);
    
    const handleSaveLivingLoreUpdate = useCallback(async (updatedCharacter: Character) => {
        await db.saveCharacter(updatedCharacter);
        setCharacters(prev => prev.map(c => c.id === updatedCharacter.id ? updatedCharacter : c));
        addNotification({ title: 'Character Updated', message: `${updatedCharacter.name} has been updated with new information.`, type: 'success', duration: 4000 });
    }, [addNotification]);
    
    const handleOpenAddToIdentityModal = () => setIsAddToIdentityModalOpen(true);

    const handleAddIdentityFact = async (factContent: string) => {
        if (!settings?.activeIdentityProfileId) {
            addNotification({
                title: "No Active Profile",
                message: "Please set an active identity profile in Settings > Memory before adding facts.",
                type: 'error',
                duration: 5000
            });
            return;
        }

        const activeProfile = identityProfiles.find(p => p.id === settings.activeIdentityProfileId);
        if (!activeProfile) {
            addNotification({ title: "Error", message: "Could not find the active identity profile.", type: 'error' });
            return;
        }

        const newFact: IdentityFact = {
            id: generateUUID(),
            content: factContent,
        };

        const updatedProfile: IdentityProfile = {
            ...activeProfile,
            content: [...(activeProfile.content || []), newFact]
        };

        await handleSaveIdentityProfile(updatedProfile);
        addNotification({ title: "Memory Updated", message: "A new fact has been added to your active identity profile.", type: 'success', duration: 3000 });
    };

    const handleCreateConversationFromBriefing = useCallback(async (briefing: Briefing) => {
        if (!settings) return;

        const newId = generateUUID();
        const newConversation: Conversation = {
            id: newId,
            title: `Briefing: ${briefing.jobName}`,
            messages: [{
                id: generateUUID(),
                role: 'model',
                content: briefing.content,
                timestamp: Date.now(),
            }],
            createdAt: Date.now(),
            systemPrompt: settings.systemPrompt || '', // Use global default
            ragCollectionName: `rag_${newId.replace(/-/g, '')}`,
            enableThinking: true,
            storyArcsEnabled: false,
            currentLevel: 1,
            messageProgress: 0,
            consciousState: null,
            consciousStateSettings: { enabled: false, updateFrequency: 2, scanDepth: 4 },
            multiCharacterMode: 'director',
            scenario: '',
            narrativeDirectives: [],
        };
        
        setConversations(prev => [newConversation, ...prev]);
        setSelectedConversationId(newId);
        setCurrentView('chat');

        if (!briefing.isRead) {
            await db.saveBriefing({ ...briefing, isRead: true });
            await loadBriefings();
        }
        
        await db.saveConversation(newConversation);
        setIsBriefingRoomOpen(false);
    }, [settings, loadBriefings]);

    const handleDeleteBriefing = useCallback(async (id: string) => {
        await db.deleteBriefing(id);
        await loadBriefings();
    }, [loadBriefings]);

    useEffect(() => {
        if (settings) {
            if (settings.telegram.enabled && settings.telegram.isConnected) {
                botOrchestrator.start(
                    settings, 
                    models, 
                    characters, 
                    findOrCreateConversationForBot,
                    handleNewConversationForBot,
                    db.saveConversation,
                    handleConversationUpdate,
                    getAIResponseForBot,
                    handleImageGenerationForBot
                );
            } else {
                botOrchestrator.stop();
            }
        }
        return () => botOrchestrator.stop();
    }, [settings, models, characters, findOrCreateConversationForBot, getAIResponseForBot, handleNewConversationForBot, handleConversationUpdate, handleImageGenerationForBot]);
    
    useEffect(() => {
        if (settings) {
             if (settings.proactiveAgent.enabled) {
                proactiveAgentService.start({
                    getSettings: () => settingsRef.current!,
                    getIdentityProfiles: () => identityProfiles,
                    saveBriefing: async (briefingData) => {
                        const newBriefing: Briefing = {
                            ...briefingData,
                            id: generateUUID(),
                            createdAt: Date.now(),
                            isRead: false,
                        };
                        await db.saveBriefing(newBriefing);
                        await loadBriefings();
                    },
                    saveSettings: db.saveSettings,
                });
            } else {
                proactiveAgentService.stop();
            }
        }
        return () => proactiveAgentService.stop();
    }, [settings, identityProfiles, loadBriefings]);


    if (!settings) {
        return <div className="flex items-center justify-center h-screen w-screen bg-primary-bg">Loading...</div>;
    }

    const selectedModel = models.find(m => m.id === settings.defaultModelId) || models.find(m => m.id === 'gemini-2.5-flash') || models[0];

    const renderCurrentView = () => {
        if (currentView === 'story') {
            return (
                <Suspense fallback={<LoadingFallback />}>
                    <StoryView
                        story={selectedStory}
                        onStoryUpdate={handleStoryUpdate}
                        settings={settings}
                        onToggleSidebar={() => setIsSidebarOpen(p => !p)}
                        selectedModel={selectedModel}
                    />
                </Suspense>
            );
        }
        return (
            <ChatView
              conversation={selectedConversation}
              onConversationUpdate={handleConversationUpdate}
              models={models}
              allCharacters={characters}
              allLorebooks={lorebooks}
              allUserPersonas={userPersonas}
              allIdentityProfiles={identityProfiles}
              selectedModel={selectedModel}
              settings={settings}
              onToggleSidebar={() => setIsSidebarOpen(p => !p)}
              onOpenUpdateKnowledgeModal={() => setIsUpdateKnowledgeOpen(true)}
              onOpenLivingLoreModal={(character, suggestedChange) => setLivingLoreModalData({ character, suggestedChange })}
              onOpenAddToIdentityModal={handleOpenAddToIdentityModal}
              onSettingsUpdate={handleSaveSettings}
            />
        );
    }

    return (
      <div className="flex h-full w-full bg-primary-bg text-text-primary font-sans overflow-hidden">
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
        <Sidebar
          // Common
          models={models}
          selectedModelId={settings.defaultModelId}
          onSelectModel={handleSelectModel}
          isSidebarOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenCharacters={() => setIsCharactersOpen(true)}
          onOpenLorebooks={() => setIsLorebooksOpen(true)}
          onOpenMemory={() => setIsMemoryOpen(true)}
          currentView={currentView}
          onSetView={setCurrentView}
          onOpenBriefingRoom={() => setIsBriefingRoomOpen(true)}
          unreadBriefingsCount={unreadBriefingCount}
          // Chat
          conversations={conversations}
          selectedConversation={selectedConversation}
          onNewConversation={handleNewConversation}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          onExportConversation={handleExportConversation}
          onImportConversation={handleImportConversation}
          onRenameConversation={handleRenameConversation}
          onLoadMoreConversations={() => loadMoreConversations(conversationPage)}
          hasMoreConversations={hasMoreConversations}
          isLoadingConversations={isLoadingConversations}
          onToggleStoryArcs={handleToggleStoryArcs}
          // Story
          stories={stories}
          selectedStory={selectedStory}
          onNewStory={handleNewStory}
          onSelectStory={handleSelectStory}
          onDeleteStory={handleDeleteStory}
          onLoadMoreStories={() => loadMoreStories(storyPage)}
          hasMoreStories={hasMoreStories}
          isLoadingStories={isLoadingStories}
        />

        {renderCurrentView()}
        
        <Suspense fallback={<LoadingFallback />}>
            {isSettingsOpen && (
                <SettingsModal
                  isOpen={isSettingsOpen}
                  onClose={() => setIsSettingsOpen(false)}
                  settings={settings}
                  onSave={handleSaveSettings}
                  onLiveUpdate={handleLiveUpdateSettings}
                  userPersonas={userPersonas}
                  onSaveUserPersona={handleSaveUserPersona}
                  onDeleteUserPersona={handleDeleteUserPersona}
                  identityProfiles={identityProfiles}
                  onSaveIdentityProfile={handleSaveIdentityProfile}
                  onDeleteIdentityProfile={handleDeleteIdentityProfile}
                  selectedModel={selectedModel}
                  models={models}
                  hasMorePersonas={hasMorePersonas}
                  onLoadMorePersonas={() => loadMorePersonas(personaPage)}
                  hasMoreIdentityProfiles={hasMoreIdentityProfiles}
                  onLoadMoreIdentityProfiles={() => loadMoreIdentityProfiles(identityProfilePage)}
                  onOpen={onSettingsModalOpen}
                />
            )}
            
            {isCharactersOpen && (
                <CharactersModal
                  isOpen={isCharactersOpen}
                  onClose={() => setIsCharactersOpen(false)}
                  characters={characters}
                  onSave={handleSaveCharacter}
                  onDelete={handleDeleteCharacter}
                  hasMore={hasMoreCharacters}
                  onLoadMore={() => loadMoreCharacters(characterPage)}
                  onOpen={onCharactersModalOpen}
                  worldLevels={settings.storyArcs.levels}
                />
            )}
            
            {isLorebooksOpen && (
                <LorebooksModal
                  isOpen={isLorebooksOpen}
                  onClose={() => setIsLorebooksOpen(false)}
                  lorebooks={lorebooks}
                  onSave={handleSaveLorebook}
                  onDelete={handleDeleteLorebook}
                  hasMore={hasMoreLorebooks}
                  onLoadMore={() => loadMoreLorebooks(lorebookPage)}
                  onOpen={onLorebooksModalOpen}
                />
            )}

            {isMemoryOpen && (
                 <MemoryModal
                    isOpen={isMemoryOpen}
                    onClose={() => setIsMemoryOpen(false)}
                    conversation={selectedConversation}
                    settings={settings}
                    onConversationUpdate={handleConversationUpdate}
                />
            )}

            {isUpdateKnowledgeOpen && (
                <UpdateKnowledgeModal
                    isOpen={isUpdateKnowledgeOpen}
                    onClose={() => setIsUpdateKnowledgeOpen(false)}
                    conversation={selectedConversation}
                    allCharacters={characters}
                    onUpdateComplete={handleUpdateKnowledgeComplete}
                />
            )}
            
            {livingLoreModalData && (
              <LivingLoreUpdateModal
                isOpen={!!livingLoreModalData}
                onClose={() => setLivingLoreModalData(null)}
                character={livingLoreModalData.character}
                suggestedChange={livingLoreModalData.suggestedChange}
                onSave={handleSaveLivingLoreUpdate}
              />
            )}

            {isAddToIdentityModalOpen && (
                <AddToIdentityModal
                    isOpen={isAddToIdentityModalOpen}
                    onClose={() => setIsAddToIdentityModalOpen(false)}
                    onAddFact={handleAddIdentityFact}
                />
            )}

            {isBriefingRoomOpen && (
                <BriefingRoomModal
                    isOpen={isBriefingRoomOpen}
                    onClose={() => setIsBriefingRoomOpen(false)}
                    briefings={briefings}
                    onSelectBriefing={handleCreateConversationFromBriefing}
                    onDeleteBriefing={handleDeleteBriefing}
                />
            )}

            <RadioOverlay />
        </Suspense>
      </div>
    );
}


const App: React.FC = () => {
    const { notifications, removeNotification } = useNotifications();
    return (
        <>
            <AppContent />
            <NotificationContainer notifications={notifications} onDismiss={removeNotification} />
        </>
    );
};

const AppWrapper: React.FC = () => (
    <NotificationProvider>
        <RadioProvider>
            <App />
        </RadioProvider>
    </NotificationProvider>
);

export default AppWrapper;
