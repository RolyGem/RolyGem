import React, { useRef, useEffect, useMemo, useCallback, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Conversation, Model, Settings, Character, UserPersona, Lorebook, IdentityProfile } from '../types';
import { useVirtualizer } from '@tanstack/react-virtual';
import MessageComponent from './Message';
import { BotIcon } from './icons/BotIcon';
import { MenuIcon } from './icons/MenuIcon';
import { AuthorsNote } from './AuthorsNote';
import { useChatHandler } from '../hooks/useChatHandler';
import ChatInput from './chat/ChatInput';
import { RadioPill } from './RadioPill';
import HeaderStats from './HeaderStats';
import { SongCard } from './SongCard';
import ContextSongPrompt from './ContextSongPrompt';
import { SummarizationDebugger } from './SummarizationDebugger';

interface ChatViewProps {
  conversation: Conversation | null;
  onConversationUpdate: (updatedConversation: Conversation) => void;
  models: Model[];
  allCharacters: Character[];
  allLorebooks: Lorebook[];
  allUserPersonas: UserPersona[];
  allIdentityProfiles: IdentityProfile[];
  selectedModel: Model;
  settings: Settings;
  onToggleSidebar: () => void;
  onOpenUpdateKnowledgeModal: () => void;
  onOpenLivingLoreModal: (character: Character, suggestedChange: string) => void;
  onOpenAddToIdentityModal: () => void;
  onSettingsUpdate: (updatedSettings: Settings) => void;
}

/**
 * The main ChatView component.
 * This component is now primarily responsible for rendering the UI.
 * All complex logic has been moved to the `useChatHandler` custom hook.
 */
const ChatView: React.FC<ChatViewProps> = (props) => {
  const { conversation, onConversationUpdate, allCharacters, allLorebooks, allUserPersonas, allIdentityProfiles, selectedModel, settings, onToggleSidebar, onOpenUpdateKnowledgeModal, onOpenAddToIdentityModal } = props;
  
  // The useChatHandler hook encapsulates all chat logic.
  const {
    input,
    setInput,
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
    isGeneratingSong,
    handleCloseSong,
    handleRegenerateSong,
    handleSongLinkDetected,
    responseControls,
    setResponseControls,
    generationTime,
    handleStopGeneration,
    attachedImage,
    setAttachedImage,
    handleSwitchResponse,
    handleConfirmResponse,
    handleGenerateSceneBackground,
    isGeneratingBackground,
  } = useChatHandler(props);
  
  const parentRef = useRef<HTMLDivElement>(null);
  const conversationRef = useRef(conversation);
  const userHasScrolledUp = useRef(false); // To track if user has manually scrolled away from the bottom
  const autoScrollLocked = useRef(false);
  const prevIsStreamingRef = useRef(isStreaming);
  const isProgrammaticScrollRef = useRef(false);
  const lockedScrollTopRef = useRef(0);
  const BOTTOM_THRESHOLD = 24;

  // Summarization Debugger state
  const [isDebuggerOpen, setIsDebuggerOpen] = useState(false);

  const visibleMessages = useMemo(() => conversation?.messages.filter(m => !m.isTemporary) || [], [conversation?.messages]);
  
  // Get active character names
  const activeCharacterNames = useMemo(() => {
    if (!conversation?.characterIds || conversation.characterIds.length === 0) {
      return [];
    }
    return conversation.characterIds
      .map(id => allCharacters.find(c => c.id === id)?.name)
      .filter((name): name is string => !!name);
  }, [conversation?.characterIds, allCharacters]);
  
  // Track playing song IDs for special handling
  const playingSongIds = useMemo(() => {
    const songs = conversation?.songs || [];
    return new Set(songs.filter(s => s.sunoUrl).map(s => s.id));
  }, [conversation?.songs]);
  
  // Merge messages and ALL songs into a single timeline
  type TimelineItem = 
    | { type: 'message'; data: typeof visibleMessages[0]; timestamp: number }
    | { type: 'song'; data: import('../types').GeneratedSong; timestamp: number };

  const timeline = useMemo(() => {
    const items: TimelineItem[] = [];
    
    // Add all messages
    visibleMessages.forEach(msg => {
      items.push({ type: 'message', data: msg, timestamp: msg.timestamp });
    });
    
    // Add ALL songs (both playing and non-playing)
    (conversation?.songs || []).forEach(song => {
      items.push({ type: 'song', data: song, timestamp: song.timestamp });
    });
    
    // Sort by timestamp
    return items.sort((a, b) => a.timestamp - b.timestamp);
  }, [visibleMessages, conversation?.songs]);

  const itemCount = timeline.length;

  // Global Full Context modal state
  const [contextPayload, setContextPayload] = useState<string | null>(null);
  const [contextCopied, setContextCopied] = useState(false);
  const handleCopyContext = useCallback(() => {
    if (!contextPayload) return;
    navigator.clipboard.writeText(contextPayload).then(() => {
      setContextCopied(true);
      setTimeout(() => setContextCopied(false), 1200);
    });
  }, [contextPayload]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (contextPayload) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [contextPayload]);
  
  // Song generation modal state
  const [songPromptState, setSongPromptState] = useState<{ isOpen: boolean; messageId: string | null }>({
    isOpen: false,
    messageId: null
  });
  
  const handleGenerateSongClick = useCallback((messageId: string) => {
    setSongPromptState({ isOpen: true, messageId });
  }, []);
  
  const handleSongPromptSubmit = useCallback((customInstructions?: string) => {
    if (songPromptState.messageId) {
      handleGenerateSong(songPromptState.messageId, customInstructions);
    }
    setSongPromptState({ isOpen: false, messageId: null });
  }, [songPromptState.messageId, handleGenerateSong]);
  
  
  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  const rowVirtualizer = useVirtualizer({
    count: itemCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // Increased from 120 to reduce layout shifts
    overscan: 3, // Reduced overscan for better performance
    getItemKey: (index) => {
      const item = timeline[index];
      if (!item) return index;
      return item.type === 'message' ? item.data.id : `song-${item.data.id}`;
    },
    // Enable dynamic measurement with better stability
    measureElement: typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
      ? (element) => element?.getBoundingClientRect().height
      : undefined,
  });

  // TanStack Virtual official solution: Prevent auto-scroll during streaming when user has manually scrolled
  // Source: https://github.com/TanStack/virtual/discussions/730
  rowVirtualizer.shouldAdjustScrollPositionOnItemSizeChange = (item, delta, instance) => {
    // Only allow scroll adjustment if:
    // 1. User hasn't manually scrolled (not locked)
    // 2. OR we're scrolling backward and the item is above current view
    return !autoScrollLocked.current || 
           (item.start < instance.scrollOffset && instance.scrollDirection === 'backward');
  };

  const handleScroll = () => {
    if (!parentRef.current) return;
    if (isProgrammaticScrollRef.current) { isProgrammaticScrollRef.current = false; return; }
    const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < BOTTOM_THRESHOLD;

    if (autoScrollLocked.current) {
      lockedScrollTopRef.current = scrollTop;
      if (isAtBottom && !userHasScrolledUp.current) {
        autoScrollLocked.current = false;
      }
      return;
    }

    userHasScrolledUp.current = !isAtBottom;
    autoScrollLocked.current = !isAtBottom;

    if (autoScrollLocked.current) {
      lockedScrollTopRef.current = scrollTop;
    } else {
      lockedScrollTopRef.current = scrollHeight - clientHeight;
    }
  };

  const handleUserInteract = useCallback(() => {
    if (!parentRef.current) return;
    autoScrollLocked.current = true;
    userHasScrolledUp.current = true;
    lockedScrollTopRef.current = parentRef.current.scrollTop;
  }, []);

  const lastMessageSignature = useMemo(() => {
    if (visibleMessages.length === 0) return '';
    const last = visibleMessages[visibleMessages.length - 1];
    if (!last) return '';
    return `${last.id ?? 'unknown'}:${last.content?.length ?? 0}:${last.timestamp ?? ''}:${last.imageUrl ?? ''}`;
  }, [visibleMessages]);

  // This layout effect handles auto-scrolling when a new message is added.
  // It only scrolls if the user has not manually scrolled up and auto-scroll is not locked.
  useLayoutEffect(() => {
    if (!autoScrollLocked.current && !userHasScrolledUp.current && itemCount > 0) {
      // Use requestAnimationFrame to ensure measurements are complete before scrolling
      requestAnimationFrame(() => {
        if (autoScrollLocked.current || userHasScrolledUp.current) return;
        isProgrammaticScrollRef.current = true;
        rowVirtualizer.scrollToIndex(itemCount - 1, { align: 'end', behavior: 'auto' });
        setTimeout(() => { isProgrammaticScrollRef.current = false; }, 0);
      });
    }
  }, [itemCount, rowVirtualizer]);

  useLayoutEffect(() => {
    if (!autoScrollLocked.current || !userHasScrolledUp.current) return;
    const container = parentRef.current;
    if (!container) return;
    const target = lockedScrollTopRef.current;
    isProgrammaticScrollRef.current = true;
    container.scrollTop = target;
    requestAnimationFrame(() => { isProgrammaticScrollRef.current = false; });
  }, [lastMessageSignature, itemCount, rowVirtualizer]);


  // This layout effect handles scrolling to the bottom when a new conversation is loaded.
  useLayoutEffect(() => {
    const conversationId = conversation?.id;
    if (conversationId) {
        // When conversation changes, reset the manual scroll lock to resume auto-scrolling.
        userHasScrolledUp.current = false;
        autoScrollLocked.current = false;
        // Use multiple animation frames to ensure all measurements are complete after conversation switch.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const currentItemCount = (conversationRef.current?.messages.filter(m => !m.isTemporary).length || 0) + (conversationRef.current?.songs?.length || 0);
            if (currentItemCount > 0) {
                isProgrammaticScrollRef.current = true;
                rowVirtualizer.scrollToIndex(currentItemCount - 1, { align: 'end', behavior: 'auto' });
                setTimeout(() => { isProgrammaticScrollRef.current = false; }, 0);
            }
          });
        });
    }
  }, [conversation?.id, rowVirtualizer]);

  useEffect(() => {
    if (isStreaming && !prevIsStreamingRef.current) {
      autoScrollLocked.current = false;
    }
    prevIsStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // Simplified streaming follow - only when unlocked and at bottom
  useEffect(() => {
    if (!isStreaming || autoScrollLocked.current) return;
    
    const followBottom = () => {
      if (autoScrollLocked.current) return;
      const el = parentRef.current;
      if (!el) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < BOTTOM_THRESHOLD;
      if (isAtBottom && itemCount > 0) {
        isProgrammaticScrollRef.current = true;
        rowVirtualizer.scrollToIndex(itemCount - 1, { align: 'end', behavior: 'auto' });
        setTimeout(() => { isProgrammaticScrollRef.current = false; }, 0);
      }
    };
    
    const id = setInterval(followBottom, 100);
    return () => clearInterval(id);
  }, [isStreaming, itemCount, rowVirtualizer]);


  // Determine the user's name from the active persona.
  const userName = useMemo(() => {
    const activeUserPersona = allUserPersonas.find(p => p.id === settings.activeUserPersonaId);
    return activeUserPersona?.name || 'You';
  }, [allUserPersonas, settings.activeUserPersonaId]);

  const characterName = useMemo(() => {
    if (!conversation?.characterIds) return 'Character';
    const names = allCharacters
        .filter(c => conversation.characterIds.includes(c.id))
        .map(c => c.name);
    if (names.length === 0) return 'Character';
    return names.join(' & ');
  }, [allCharacters, conversation?.characterIds]);

  // Find the last user message in the timeline (must be before early return)
  const lastUserMessageIndex = useMemo(() => {
    for (let i = timeline.length - 1; i >= 0; i--) {
      const item = timeline[i];
      if (item && item.type === 'message' && item.data.role === 'user') {
        return i;
      }
    }
    return -1;
  }, [timeline]);
  
  const isDocumentStyle = settings.messageStyle === 'document';

  // Display a welcome screen if no conversation is selected.
  if (!conversation) {
    return (
      <main className="flex-1 flex flex-col h-full">
        <header className="flex items-center gap-2 sm:gap-4 p-2 sm:p-3 border-b main-header">
            <button onClick={onToggleSidebar} className="p-1.5 sm:p-2 rounded-full hover:bg-slate-200 dark:hover:bg-gray-800">
                <MenuIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <div className="flex-1" />
            <RadioPill />
        </header>
        <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 dark:text-gray-500 p-8">
            <BotIcon className="w-16 h-16 mb-4 text-slate-300 dark:text-gray-700" />
            <h2 className="text-2xl font-semibold text-slate-600 dark:text-gray-400 mb-2">RolyGem</h2>
            <p>Select a conversation or create a new one to begin.</p>
            <p className="text-sm mt-4">Model for new chats: <span className="font-semibold text-indigo-400">{selectedModel.name}</span></p>
        </div>
      </main>
    );
  }

  return (
    <main 
        className="flex-1 flex flex-col h-full chat-background-container"
        style={{
            backgroundImage: settings.chatBackground ? `url(${settings.chatBackground})` : 'none',
        }}
        data-has-background={!!settings.chatBackground}
    >
       <header className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 border-b main-header">
            <button onClick={onToggleSidebar} className="p-1.5 sm:p-2 rounded-full hover:bg-slate-200 dark:hover:bg-gray-800">
                <MenuIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <div className="flex-1 flex items-center min-w-0">
                <h1 className="text-base sm:text-lg font-semibold truncate hidden md:block">{conversation.title}</h1>
            </div>
            <HeaderStats conversation={conversation} settings={settings} selectedModel={selectedModel} isStreaming={isStreaming} />
            <RadioPill />
        </header>

      <AuthorsNote 
        systemPrompt={conversation.systemPrompt || ''}
        globalSystemPrompt={settings.systemPrompt}
        allCharacters={allCharacters}
        allLorebooks={allLorebooks}
        conversationCharacterIds={conversation.characterIds || []}
        conversationLorebookIds={conversation.lorebookIds || []}
        onSave={handleSaveConversationSettings}
        isStreaming={isStreaming}
        modelId={selectedModel.id}
        enableThinking={conversation.enableThinking ?? true}
        onOpenUpdateKnowledgeModal={onOpenUpdateKnowledgeModal}
        consciousStateSettings={conversation.consciousStateSettings}
        smartSystemConfig={conversation.smartSystemConfig}
        multiCharacterMode={conversation.multiCharacterMode}
        scenario={conversation.scenario}
        narrativeDirectives={conversation.narrativeDirectives}
        facts={conversation.facts}
        conversationMessages={conversation.messages}
        settings={settings}
        microPromptCards={conversation.microPromptCards}
        activeMicroCardIds={conversation.activeMicroCardIds}
      />

      <div className="flex-1 flex flex-col min-h-0 chat-view-content-area">
        {/* Virtualized Message List */}
        <div
          ref={parentRef}
          className="flex-1 overflow-y-auto p-4"
          style={{ overflowAnchor: 'none' }}
          onScroll={handleScroll}
          onPointerDown={handleUserInteract}
          onPointerDownCapture={handleUserInteract}
          onWheel={handleUserInteract}
          onWheelCapture={handleUserInteract}
          onMouseDown={handleUserInteract}
          onTouchStart={handleUserInteract}
          onTouchStartCapture={handleUserInteract}
        >
          {itemCount > 0 && (
            <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
              {/* Render ALL items in timeline, but keep playing songs always visible */}
              {timeline.map((item, index) => {
                  const isPlaying = item.type === 'song' && playingSongIds.has(item.data.id);
                  const virtualItem = rowVirtualizer.getVirtualItems().find(v => v.index === index);
                  
                  // For playing songs: ALWAYS render (keep in DOM)
                  // For other items: only render if in virtual viewport
                  if (!isPlaying && !virtualItem) return null;
                  
                  // Calculate position: use virtualizer's position if available, otherwise calculate manually
                  // For playing songs not in viewport, we calculate their exact position
                  let position = 0;
                  if (virtualItem) {
                    position = virtualItem.start;
                  } else if (isPlaying) {
                    // Calculate exact position for playing songs outside viewport
                    // by summing up sizes of all previous items
                    position = 0;
                    for (let i = 0; i < index; i++) {
                      // Use measured size if available, otherwise use estimate
                      const measuredSize = rowVirtualizer.measurementsCache[i]?.size;
                      position += measuredSize || 200;
                    }
                  }

                  // Handle songs
                  if (item.type === 'song') {
                    return (
                      <div
                        key={`song-${item.data.id}`}
                        data-index={index}
                        ref={virtualItem ? rowVirtualizer.measureElement : undefined}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${position}px)`,
                          willChange: isPlaying ? 'auto' : 'transform',
                          zIndex: isPlaying ? 10 : 1, // Playing songs on top
                        }}
                        className="pb-4"
                      >
                        <div className="w-full flex">
                          <div className="w-full max-w-4xl mx-auto">
                            <SongCard 
                              song={{
                                lyrics: item.data.lyrics,
                                styles: item.data.styles,
                                title: item.data.title,
                                sunoUrl: item.data.sunoUrl
                              }}
                              onClose={() => handleCloseSong(item.data.id)}
                              onRegenerate={handleRegenerateSong}
                              onLinkDetected={(url) => handleSongLinkDetected(item.data.id, url)}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Handle messages
                  if (!virtualItem) return null; // Messages must be in viewport
                  
                  const msg = item.data;
                  const isUser = msg.role === 'user';
                  const isSpecialMessage = isDocumentStyle || msg.suggestion || msg.type === 'event' || msg.isGeneratingImage || msg.imageUrl;
                  const alignmentMargin = isSpecialMessage ? 'mx-auto' : (isUser ? 'ml-auto' : 'mr-auto');
                  const widthClass = isSpecialMessage ? 'w-full' : 'max-w-xl lg:max-w-3xl';
                  
                  return (
                      <div
                          key={virtualItem.key}
                          data-index={virtualItem.index}
                          ref={rowVirtualizer.measureElement}
                          style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              transform: `translateY(${virtualItem.start}px)`,
                              // Add will-change for better performance during scrolling
                              willChange: 'transform',
                          }}
                          // Add padding-bottom here to give the virtualizer a buffer zone, improving measurement stability for animating items.
                          className="pb-4"
                      >
                          <div className={`w-full flex`}>
                              <div className={`${widthClass} ${alignmentMargin}`}>
                                  <MessageComponent 
                                      message={msg}
                                      isStreaming={isStreaming && item.type === 'message' && index === itemCount - 1 && timeline[itemCount - 1]?.type === 'message'}
                                      isLastUserMessage={msg.role === 'user' && index === lastUserMessageIndex}
                                      onDelete={handleDeleteMessage}
                                      onRegenerate={handleRegenerateResponse}
                                      onEdit={handleEditMessage}
                                      onTransformToPrompt={handleTransformToPrompt}
                                      onSuggestionResponse={handleSuggestionResponse}
                                      onSummarize={handleSummarizeMessage}
                                      onRemoveFiller={handleRemoveFiller}
                                      onUndoLastEdit={handleUndoLastEdit}
                                      onApplyCustomEditInstructions={handleApplyCustomEditInstructions}
                                      onGenerateSong={handleGenerateSongClick}
                                      onSwitchResponse={handleSwitchResponse}
                                      onConfirmResponse={handleConfirmResponse}
                                      showSenderNames={settings.showSenderNames}
                                      messageStyle={settings.messageStyle}
                                      highlightDialogue={settings.highlightDialogue}
                                      showFullContextButton={settings.showFullContextButton}
                                      userName={userName}
                                      activeCharacterNames={activeCharacterNames}
                                      modelProvider={selectedModel.provider}
                                      modelId={selectedModel.id}
                                      onContentResize={() => rowVirtualizer.measure()}
                                      onOpenContext={(payload) => setContextPayload(payload)}
                                  />
                              </div>
                          </div>
                      </div>
                  );
              })}
            </div>
          )}
        </div>

        {/* Micro Prompt Cards (active up to 3) */}
        {(() => {
          const ids = new Set(conversation.activeMicroCardIds || []);
          const cards = (conversation.microPromptCards || []).filter(c => ids.has(c.id)).slice(0, 3);
          if (cards.length === 0) return null;
          const disabled = isStreaming || isTransforming || isEnhancing || isSceneImpersonating || !input.trim();
          return (
            <div className="w-full max-w-3xl mx-auto mb-2 px-3 sm:px-0">
              <div className="flex items-center gap-2 overflow-x-auto">
                {cards.map(card => (
                  <button
                    key={card.id}
                    disabled={disabled}
                    title={card.title}
                    onClick={() => {
                      handleSend(undefined, card.prompt);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full radio-pill whitespace-nowrap disabled:opacity-50"
                  >
                    <span className="text-base leading-none">{card.emoji || '✨'}</span>
                    <span className="text-xs font-semibold">{card.title}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Chat Input Area */}
        <ChatInput
          input={input}
          setInput={setInput}
          handleSend={handleSend}
          handleManualDirectorAI={handleManualDirectorAI}
          handleManualLoreScan={handleManualLoreScan}
          isStreaming={isStreaming}
          isTransforming={isTransforming}
          isEnhancing={isEnhancing}
          settings={settings}
          textareaRef={textareaRef}
          characterName={characterName}
          handleAutopilot={handleAutopilot}
          handlePolishPrompt={handlePolishPrompt}
          handleImpersonateScene={handleImpersonateScene}
          isSceneImpersonating={isSceneImpersonating}
          onOpenAddToIdentityModal={onOpenAddToIdentityModal}
          responseControls={responseControls}
          setResponseControls={setResponseControls}
          generationTime={generationTime}
          handleStopGeneration={handleStopGeneration}
          attachedImage={attachedImage}
          setAttachedImage={setAttachedImage}
          handleGenerateSceneBackground={handleGenerateSceneBackground}
          isGeneratingBackground={isGeneratingBackground}
          onOpenDebugger={() => setIsDebuggerOpen(true)}
        />
      </div>
      
      {/* Global Full Generation Context Modal via Portal to avoid stacking issues */}
      {contextPayload && createPortal(
        (
          <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center" onClick={() => setContextPayload(null)}>
            <div className="modal-panel rounded-2xl shadow-2xl w-full max-w-3xl m-4 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-color modal-header-bg rounded-t-2xl flex justify-between items-center">
                <h2 className="text-xl font-bold">Full Generation Context</h2>
                <button onClick={() => setContextPayload(null)} className="p-2 rounded-full text-text-secondary hover:bg-tertiary-bg transition-all hover:rotate-90">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 11-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" /></svg>
                </button>
              </div>
              <div className="p-4 flex-1 overflow-y-auto bg-primary-bg">
                <pre className="whitespace-pre-wrap break-words text-xs font-mono">
                  <code>{contextPayload}</code>
                </pre>
              </div>
              <div className="flex justify-end gap-3 p-4 border-t border-color modal-footer-bg rounded-b-2xl">
                <button onClick={handleCopyContext} className="px-4 py-2 text-sm font-medium rounded-lg btn-secondary transition-all hover:scale-105 active:scale-95">
                  {contextCopied ? 'Copied!' : 'Copy Context'}
                </button>
                <button onClick={() => setContextPayload(null)} className="px-4 py-2 text-sm font-medium rounded-lg message-button-primary">Close</button>
              </div>
            </div>
          </div>
        ),
        document.body
      )}
      
      {/* Global Song Generation Prompt Modal via Portal */}
      {songPromptState.isOpen && createPortal(
        <ContextSongPrompt
          isOpen={songPromptState.isOpen}
          onClose={() => setSongPromptState({ isOpen: false, messageId: null })}
          onSubmit={handleSongPromptSubmit}
        />,
        document.body
      )}

      {/* Summarization Debugger via Portal */}
      {conversation && createPortal(
        <SummarizationDebugger
          conversationId={conversation.id}
          isOpen={isDebuggerOpen}
          onClose={() => setIsDebuggerOpen(false)}
        />,
        document.body
      )}

    </main>
  );
};

export default React.memo(ChatView);
