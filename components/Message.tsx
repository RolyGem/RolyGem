import React, { useState, useEffect, useRef } from 'react';
import type { Message, Settings, Model } from '../types';
import { UserIcon } from './icons/UserIcon';
import { BotIcon } from './icons/BotIcon';
import { MarkdownRenderer } from './MarkdownRenderer';
import { CopyIcon } from './icons/CopyIcon';
import { CheckIcon } from './icons/CheckIcon';
import { TrashIcon } from './icons/TrashIcon';
import { EditIcon } from './icons/EditIcon';
import { RegenerateIcon } from './icons/RegenerateIcon';
import { ImageIcon } from './icons/ImageIcon';
import { LoaderIcon } from './icons/LoaderIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { TokenIcon } from './icons/TokenIcon';
import { DramaIcon } from './icons/DramaIcon';
import { XIcon } from './icons/XIcon';
import { SummarizeIcon } from './icons/SummarizeIcon';
import { EyeIcon } from './icons/EyeIcon';
import { FileTextIcon } from './icons/FileTextIcon';
import { FeatherIcon } from './icons/FeatherIcon';
import { copyToClipboard } from '../utils/clipboard';
import { PulsingDots, PulsingWave, PulsingCircle } from './PulsingDots';


// Simple RTL detection function
const isRTL = (text: string): boolean => {
  const rtlChars = /[\u0590-\u083F]|[\u08A0-\u08FF]|[\uFB1D-\uFDFF]|[\uFE70-\uFEFF]/mg;
  return rtlChars.test(text);
};

/**
 * Wrap only dialogue segments ("...") in a span for highlighting,
 * leaving other text unchanged and Markdown-safe.
 */
const highlightSyntax = (text: string): string => {
    if (!text) return '';
    const parts = text.split(/(".*?")/g);
    return parts.map(part => (
        part.startsWith('"') && part.endsWith('"')
            ? `<span class="dialogue-highlight">${part}</span>`
            : part
    )).join('');
};

// New: dialogue-only highlighter that preserves quotes (", “ ”, « »)
const highlightDialoguePreserveQuotes = (text: string): string => {
  if (!text) return '';
  const parts = text.split(/(\".*?\"|“.*?”|«.*?»)/g);
  const pairs: Record<string, string> = { '"': '"', '“': '”', '«': '»' };
  return parts.map(part => {
    if (!part) return part;
    const start = part.charAt(0);
    const end = part.charAt(part.length - 1);
    if (pairs[start] && pairs[start] === end) {
      // Keep the quotes visible
      return `<span class=\"dialogue-highlight\">${part}</span>`;
    }
    return part;
  }).join('');
};

interface MessageProps {
  message: Message;
  isStreaming: boolean;
  isLastUserMessage: boolean;
  showSenderNames: boolean;
  messageStyle: Settings['messageStyle'];
  highlightDialogue: boolean;
  showFullContextButton: boolean;
  userName: string;
  activeCharacterNames?: string[];
  onDelete: (messageId: string) => void;
  onRegenerate: (messageId: string) => void;
  onEdit: (messageId: string, newContent: string) => void;
  onTransformToPrompt: (messageId: string) => void;
  onSummarize: (messageId: string) => void;
  onRemoveFiller: (messageId: string) => void;
  onApplyCustomEditInstructions?: (messageId: string, instruction: string) => void;
  onUndoLastEdit?: (messageId: string) => void;
  onGenerateSong?: (messageId: string) => void;
  onSuggestionResponse?: (messageId: string, action: 'accept' | 'reject' | 'customize' | 'update' | 'ignore', customPrompt?: string) => void;
  onSwitchResponse?: (messageId: string, targetResponse: 'primary' | 'alternative') => void;
  onConfirmResponse?: (messageId: string) => void;
  modelProvider: Model['provider'];
  modelId?: string;
  onContentResize?: (index: number) => void;
  messageIndex?: number;
  // New: open Full Context in a global modal (outside the message component)
  onOpenContext?: (payload: string) => void;
}

const MessageComponent: React.FC<MessageProps> = ({ message, isStreaming, isLastUserMessage, showSenderNames, messageStyle, highlightDialogue, showFullContextButton, userName, activeCharacterNames = [], onDelete, onRegenerate, onEdit, onTransformToPrompt, onSummarize, onRemoveFiller, onApplyCustomEditInstructions, onUndoLastEdit, onSuggestionResponse, onSwitchResponse, onConfirmResponse, modelProvider, modelId, onContentResize, messageIndex, onOpenContext, onGenerateSong }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const [copied, setCopied] = useState(false);
  const [contextCopied, setContextCopied] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showOriginal, setShowOriginal] = useState(false);
  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const [customEditInstruction, setCustomEditInstruction] = useState('');

  // Keep local editedContent in sync with message content when not actively editing
  useEffect(() => {
    if (!isEditing) {
      setEditedContent(message.content);
    }
  }, [message.content, isEditing]);
  // Random message that changes less frequently (every 3 seconds)
  const [randomMessageIndex] = useState(() => Math.floor(Math.random() * 100));


  const isUser = message.role === 'user';
  const isEvent = message.type === 'event';
  
  // Determine sender name for bot messages based on active characters
  const getSenderName = () => {
    if (isUser) return userName;
    
    // If no characters, return empty string
    if (!activeCharacterNames || activeCharacterNames.length === 0) {
      return '';
    }
    
    // If one character, return its name
    if (activeCharacterNames.length === 1) {
      return activeCharacterNames[0];
    }
    
    // If multiple characters, return first two names separated by /
    return activeCharacterNames.slice(0, 2).join('/');
  };
  
  const senderName = getSenderName();
  
  const contentToDisplay = showOriginal ? message.content : (message.summary || message.content);
  const contentIsRTL = isRTL(contentToDisplay);
  
  const isDocumentStyle = messageStyle === 'document';
  
  const ActionButton: React.FC<{ onClick: () => void; children: React.ReactNode; label: string, disabled?: boolean }> = ({ onClick, children, label, disabled }) => (
    <button
      onClick={onClick}
      disabled={isStreaming || message.isGeneratingImage || disabled}
      aria-label={label}
      title={label}
      className="p-1.5 rounded-lg action-button disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );

  if (message.suggestion && onSuggestionResponse) {
    const { suggestion } = message;
    const isManual = suggestion.type === 'manualDirectorAI';
    const isLivingLore = suggestion.type === 'livingLore';

  const handleReject = () => onSuggestionResponse(message.id, isLivingLore ? 'ignore' : 'reject');

    const handleCustomPromptKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (customPrompt.trim()) {
          onSuggestionResponse(message.id, 'customize', customPrompt);
        }
      }
    };

    return (
      <div className="group relative w-full flex justify-center my-3">
        <div className="w-full max-w-2xl text-left px-5 py-4 bg-tertiary-bg/50 rounded-xl border border-dashed border-color backdrop-blur-sm transition-all hover:bg-tertiary-bg/70 hover:shadow-lg">
          <div className="flex items-center justify-between gap-2 text-sm font-bold text-text-primary mb-3">
            <div className="flex items-center gap-2.5">
              <SparklesIcon className="w-5 h-5 text-indigo-400 animate-pulse" />
              <span>{suggestion.title}</span>
            </div>
            <button onClick={handleReject} className="p-1.5 rounded-full hover:bg-tertiary-bg transition-all hover:rotate-90">
              <XIcon className="w-4 h-4" />
            </button>
          </div>
          <p className="text-text-primary text-base leading-relaxed">{suggestion.text}</p>
          
          {(suggestion.type === 'directorAI' || isManual) && (
            <div className="mt-3 space-y-2">
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onKeyDown={handleCustomPromptKeyDown}
                placeholder={isManual ? suggestion.text : "Optional: Customize the event..."}
                rows={2}
                className="w-full p-3 border-2 rounded-lg text-sm modal-input transition-all focus:scale-[1.01]"
              />
              <div className="flex justify-end gap-2">
                {!isManual && <button onClick={() => onSuggestionResponse(message.id, 'reject')} className="px-4 py-2 text-sm font-medium rounded-lg btn-secondary transition-all hover:scale-105 active:scale-95">Reject</button>}
                <button onClick={() => onSuggestionResponse(message.id, 'customize', customPrompt)} disabled={!customPrompt.trim()} className="px-4 py-2 text-sm font-medium rounded-lg btn-secondary disabled:opacity-50 transition-all hover:scale-105 active:scale-95">{isManual ? 'Submit' : 'Customize'}</button>
                {!isManual && <button onClick={() => onSuggestionResponse(message.id, 'accept')} className="px-4 py-2 text-sm font-medium rounded-lg message-button-primary">Accept</button>}
              </div>
            </div>
          )}
          
          {isLivingLore && (
            <div className="mt-3 flex justify-end gap-2">
                <button onClick={() => onSuggestionResponse(message.id, 'ignore')} className="px-4 py-2 text-sm font-medium rounded-lg btn-secondary transition-all hover:scale-105 active:scale-95">Ignore</button>
                <button onClick={() => onSuggestionResponse(message.id, 'update')} className="px-4 py-2 text-sm font-medium rounded-lg message-button-primary">Update Character</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isEvent) {
    return (
        <div className="group relative w-full flex justify-center my-3">
            <div className="w-full max-w-2xl text-center px-5 py-4 bg-tertiary-bg/50 rounded-xl border border-dashed border-color backdrop-blur-sm transition-all hover:bg-tertiary-bg/70 hover:shadow-lg">
                <div className="flex items-center justify-center gap-2.5 text-sm font-bold text-text-primary mb-3">
                    <DramaIcon className="w-5 h-5 text-purple-500"/>
                    <span>Story Event</span>
                </div>
                <p className="italic text-text-primary text-base leading-relaxed">{message.content}</p>
                 <div className="absolute top-2 right-2 flex items-center gap-0.5 rounded-lg p-1 opacity-0 group-hover:opacity-100 transition-all duration-200 action-buttons-container">
                    <ActionButton onClick={() => onDelete(message.id)} label="Delete event">
                        <TrashIcon className="w-4 h-4" />
                    </ActionButton>
                 </div>
            </div>
        </div>
    );
  }

  const bgClass = isDocumentStyle ? '' : (isUser ? 'user-message-bg' : 'model-message-bg');
  // When editing in bubble mode, keep the bubble styling but expand layout
  const showDocumentLayout = isDocumentStyle || (isEditing && !isDocumentStyle);
  const containerClassName = `group relative flex items-start gap-4 ${contentIsRTL ? 'rtl' : ''} ${bgClass} ${!isDocumentStyle ? 'message-bubble' : 'message-document-mode'}`;

  const handleCopy = async () => {
    const success = await copyToClipboard(contentToDisplay);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyContext = async () => {
    if (!message.contextPayload) return;
    const success = await copyToClipboard(message.contextPayload);
    if (success) {
      setContextCopied(true);
      setTimeout(() => setContextCopied(false), 2000);
    }
  };

  const handleSaveEdit = () => {
    if (editedContent.trim() && editedContent.trim() !== message.content) {
      onEdit(message.id, editedContent.trim());
    }
    setIsEditing(false);
  };

  
  const ImageGenerationContent: React.FC = () => {
    const generatorName = message.imageGenerator === 'sdwebui' 
      ? 'Stable Diffusion' 
      : message.imageGenerator === 'huggingface'
      ? 'Hugging Face'
      : 'ComfyUI';
    
    // Handler to notify virtualizer when image loads and changes layout
    // Using double RAF for better stability with virtual scroll
    const handleImageLoad = () => {
      if (onContentResize && messageIndex !== undefined) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            onContentResize(messageIndex);
          });
        });
      }
    };
    
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 text-text-primary">
                <ImageIcon className="w-5 h-5 flex-shrink-0 text-purple-500" />
                <p className="font-semibold">Generating image via {generatorName} for:</p>
            </div>
            
            <p className="pl-4 border-l-4 border-purple-400/50 dark:border-purple-600/50 italic text-text-primary break-words bg-purple-50/30 dark:bg-purple-900/10 py-2 rounded-r-lg">
                {message.content}
            </p>
            
            {message.isGeneratingImage && (
                 <div className="flex items-center gap-3 text-indigo-500 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20 px-4 py-3 rounded-lg">
                    <LoaderIcon className="w-5 h-5 flex-shrink-0 animate-spin" />
                    <p className="text-sm font-mono font-medium">{message.imageGenerationProgress || 'Initializing...'}</p>
                </div>
            )}

            {message.imageUrl && (
                <div className="relative group/image">
                    <div className="rounded-xl overflow-hidden border-2 border-color shadow-lg hover:shadow-2xl transition-shadow duration-300">
                        <img 
                          src={message.imageUrl} 
                          alt={message.content} 
                          className="block w-full h-auto"
                          onLoad={handleImageLoad} 
                        />
                    </div>
                </div>
            )}
        </div>
    );
  };

  const avatarSize = isDocumentStyle ? 'w-9 h-9' : 'w-8 h-8';
  const iconSize = isDocumentStyle ? 'w-5 h-5' : 'w-4.5 h-4.5';
  
  const avatarHoverEffects = isDocumentStyle ? '' : 'hover:scale-110 hover:rotate-6';
  
  const avatar = isUser ? (
    <div className={`${avatarSize} rounded-full flex items-center justify-center message-avatar-user text-slate-600 dark:text-gray-300 flex-shrink-0 transition-all duration-200 ${avatarHoverEffects}`}>
      <UserIcon className={iconSize} />
    </div>
  ) : (
    <div className={`${avatarSize} rounded-full flex items-center justify-center message-avatar-bot text-indigo-600 dark:text-indigo-400 flex-shrink-0 transition-all duration-200 ${avatarHoverEffects}`}>
      <BotIcon className={iconSize} />
    </div>
  );
  
  const highlightedContent = highlightDialogue ? highlightDialoguePreserveQuotes(contentToDisplay) : contentToDisplay;


  return (
    <>
      <div className={containerClassName}>
        {!showDocumentLayout && !isEditing && avatar}
        <div className="flex-1 min-w-0 message-content">
          <div className={`flex items-center gap-2 ${showDocumentLayout ? 'mb-3' : ''}`}>
            {showDocumentLayout && !isEditing && avatar}
            {(showDocumentLayout || showSenderNames) && !isEditing && senderName && (
              <p className={`${showDocumentLayout ? 'text-base' : 'text-xs'} font-bold text-text-primary ${!showDocumentLayout ? 'mb-1' : ''}`}>
                  {senderName}
              </p>
            )}
            {!isUser && message.summary && !isEditing && (
                <div title="This message is summarized for context" className="flex items-center gap-1.5 text-xs font-medium text-accent-primary bg-accent-primary/10 px-2 py-1 rounded-full message-badge">
                    <SummarizeIcon className="w-3.5 h-3.5" />
                    <span>Summarized</span>
                </div>
            )}
          </div>
          
          {isEditing ? (
             <div className="message-edit-area">
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveEdit();
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setIsEditing(false);
                    setEditedContent(message.content);
                  }
                }}
                className="w-full message-edit-textarea"
                rows={Math.max(3, message.content.split('\n').length + 1)}
                autoFocus
                placeholder="Edit your message..."
              />
              <div className="message-edit-actions">
                <button 
                  onClick={() => { 
                    setIsEditing(false); 
                    setEditedContent(message.content); 
                  }} 
                  className="px-4 py-2 text-sm font-medium rounded-lg transition-all btn-secondary hover:scale-105 active:scale-95"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveEdit} 
                  className="px-4 py-2 text-sm font-medium rounded-lg transition-all hover:scale-105 active:scale-95 message-button-primary"
                >
                  Save & Submit
                </button>
              </div>
            </div>
          ) : message.isGeneratingImage || message.imageUrl ? (
              <ImageGenerationContent />
          ) : message.isThinking ? (
            <div className="flex items-center gap-3 text-text-primary bg-indigo-50/50 dark:bg-indigo-900/20 px-4 py-3 rounded-lg">
              {message.content && modelId === 'gemini-2.5-pro' ? (
                // Gemini 2.5 Pro shows thinking content (when Foreshadowing is enabled and working)
                <>
                  <div className="w-5 h-5">
                    <SparklesIcon className="w-full h-full animate-pulse text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <MarkdownRenderer content={message.content} />
                  </div>
                </>
              ) : (
                // All models (including Pro when Foreshadowing is off/failed) show modern pulsing animation
                <div className="flex items-center gap-3 w-full">
                    <PulsingCircle 
                      size="md" 
                      variant="primary" 
                      message={message.retryStatus || ([
                          'Thinking...',
                          'Preparing a reply...',
                          'Processing your request...',
                          'Drafting the response...',
                          'Piecing the thoughts together...',
                          'Creativity engine warming up...',
                          'One moment please...',
                          'Fine-tuning the wording...',
                          'A little patience... my brain is loading 🧠',
                          'Let me think for a second 🤔',
                          'Hold on, juggling thoughts 😅',
                          'Ideas are lining up... just a sec 💭',
                          'Quality takes a beat 😎',
                          'Downloading wisdom... please wait 📚',
                          'Hunting for the perfect phrase 🔍',
                          'CPU in overdrive 🚀',
                          'Let me focus for a bit 🎯',
                          'Creativity needs a moment ✨',
                          'Hold on... doing the math 🤓',
                          'Wait... what was I saying again? 🙃',
                          'Checking the Wi-Fi of inspiration 📶',
                          'Almost remembered that idea 🤨',
                          'Cooking up something great 🌟',
                          'Handcrafting a special reply 🎨',
                          'Best answers deserve a little wait 💎',
                          'Hang tight... you will like this 🎁',
                          'Charging up the perfect moment ⚡',
                          'Trust me... the reply will be fire 🔥',
                          'Loading brilliance... 99% ✨',
                          'Easy there... I am not a robot (well, kind of) 🤖',
                          'Give me three more seconds 😌',
                          'I am not slow... you are eager 🐌',
                          'Stay cool, the answer is on the way 😎',
                          'Need a quick joke while you wait? Why did the computer visit the doctor? It had a virus! 😂',
                          'Uh oh... I forgot what I was about to say 🤦',
                          'Be right back, dreaming of being a robot 🤖',
                          'Almost wrote a novel there 📖',
                          'Why is the ocean salty? Because the fish forgot dinner! 🐟',
                          'Hold on... a joke was on the tip of my tongue 😅',
                          'Once someone asked an AI for help... the AI said, “give me a sec” 😂',
                          'Short story: once upon a time... wait, I forgot 📖',
                          'Researching the vault of knowledge 🗄️',
                          'Calling in inspiration 💫',
                          'Words are lining up nicely 📝',
                          'Downloading ideas from the cloud ☁️',
                          'Consulting the subconscious 🧘',
                          'Careful... a great idea is coming 💡',
                          'Creativity refuses to be rushed 🎪',
                          'Patience unlocks excellence 🔑',
                          'Guessing your secret number 🎰',
                          'Just closing TikTok 📱',
                          'Cat walked on the keyboard djkshfks 🐱',
                          'Debating philosophy... or dinner 🍕',
                          'Boosting charisma levels 💫',
                          'Calling the satellites 🛰️',
                          'Organizing thoughts on the shelf 📚',
                          'Asking Google for a second opinion 🔍',
                          'My brain hamster needs a nap 🐹',
                          'Counting down... 1... 2... wait, forgot ⏱️',
                          'Rare ideas need to simmer 🍷',
                          'Typing one letter at a time ⌨️',
                          'If creativity were instant, everyone would be Picasso 🎨',
                          'Finishing my coffee ☕',
                          'Good things grow slowly 🌸',
                          'Skimming between the lines 🔎',
                          'Processor is thinking... or daydreaming 💭',
                          'Loading a pinch of magic 🪄',
                          'Consulting the council of wisdom 🧙‍♂️',
                          'Creative spark in progress 🎭',
                          'Letting thoughts ferment a bit 🍺',
                          'Preparing a surprise 🎁',
                          'Deep thinking activated 🧠',
                          'Browsing the digital Library of Alexandria 📚',
                          'Stick with me... good things ahead 😉'
                        ][Math.floor(Math.random() * 70)])
                      } 
                    />
                </div>
              )}
            </div>
          ) : message.isSummarizing ? (
            <div className="flex items-center gap-3 text-text-primary bg-purple-50/50 dark:bg-purple-900/20 px-4 py-3 rounded-lg">
               <div className="w-5 h-5">
                  <SummarizeIcon className="w-full h-full animate-pulse text-purple-500" />
               </div>
              <span className="font-medium text-text-secondary">Processing...</span>
            </div>
          ) : (
            <>
              {showCustomEditor && (
                <div className="mb-3 rounded-lg border-2 border-color bg-tertiary-bg/50 p-3">
                  <div className="text-sm font-medium text-text-primary mb-2">Edit message</div>
                  <textarea
                    value={customEditInstruction}
                    onChange={(e) => setCustomEditInstruction(e.target.value)}
                    placeholder="Describe the change. Example: remove narration and keep only dialogue, replace this sentence with..., or adjust the emojis."
                    rows={3}
                    className="w-full p-3 border-2 rounded-lg text-sm modal-input"
                  />
                  <div className="mt-2 flex items-center gap-2 justify-end">
                    <button onClick={() => setShowCustomEditor(false)} className="px-3 py-1.5 text-sm rounded-lg btn-secondary">Cancel</button>
                    <button
                      onClick={() => {
                        if (onApplyCustomEditInstructions && customEditInstruction.trim()) {
                          onApplyCustomEditInstructions(message.id, customEditInstruction.trim());
                          setShowCustomEditor(false);
                          setCustomEditInstruction('');
                        }
                      }}
                      disabled={!onApplyCustomEditInstructions || !customEditInstruction.trim() || message.isSummarizing}
                      className="px-3 py-1.5 text-sm rounded-lg message-button-primary disabled:opacity-50"
                    >Apply changes</button>
                    <button
                      onClick={() => { setShowCustomEditor(false); onRemoveFiller(message.id); }}
                      disabled={message.isSummarizing}
                      className="px-3 py-1.5 text-sm rounded-lg btn-secondary"
                    >Remove filler (fast)</button>
                  </div>
                </div>
              )}

              {/* Inline, always-visible undo banner for Remove Filler edits */}
              {!isUser && !message.imageUrl && message.lastEditedBackup && (
                <div className="mt-2 mb-2 px-3 py-2 rounded-lg border-2 border-color bg-tertiary-bg/60 flex items-center justify-between gap-3">
                  <span className="text-xs text-text-secondary">{message.lastEditedReason === 'remove_filler' ? 'Remove filler was applied to this message.' : 'This message was edited.'}</span>
                  <button
                    onClick={() => onUndoLastEdit && onUndoLastEdit(message.id)}
                    className="px-3 py-1 text-xs font-medium rounded-lg message-button-primary"
                    disabled={message.isSummarizing}
                  >Undo</button>
                </div>
              )}

              {message.attachedImage && (
                <div className="mb-3 rounded-lg overflow-hidden border-2 border-color">
                  <img src={message.attachedImage.dataUrl} alt="Attached" className="max-w-full h-auto max-h-96 object-contain" />
                </div>
              )}
              <MarkdownRenderer content={highlightedContent} />
              
              {/* Dual Response Toggle - shown when message has alternative response */}
              {message.isDualResponse && message.alternativeResponse && onSwitchResponse && (
                <div className="mt-3 pt-2.5 border-t border-color/50">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    {/* Header */}
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <SparklesIcon className="w-3 h-3 text-purple-500" />
                      <span className="font-medium">Dual</span>
                    </div>
                    
                    {/* Response Toggles with individual RAG indicators */}
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-0.5 bg-tertiary-bg rounded-md p-0.5">
                        {/* Response A with RAG indicator */}
                        <button
                          onClick={() => message.selectedResponse === 'alternative' && onSwitchResponse(message.id, 'primary')}
                          className={`px-2 py-1 text-[11px] font-medium rounded transition-all relative ${
                            message.selectedResponse === 'primary'
                              ? 'bg-accent-primary text-accent-text shadow-sm'
                              : 'text-text-secondary hover:text-text-primary hover:bg-tertiary-bg/50'
                          }`}
                        >
                          A
                          {/* RAG dot for A */}
                          <span className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                            message.ragSyncedResponse === 'primary' ? 'bg-green-500' : 'bg-yellow-500'
                          }`} title={message.ragSyncedResponse === 'primary' ? 'A is in RAG' : 'A not in RAG'}></span>
                        </button>
                        
                        {/* Response B with RAG indicator */}
                        <button
                          onClick={() => message.selectedResponse === 'primary' && onSwitchResponse(message.id, 'alternative')}
                          className={`px-2 py-1 text-[11px] font-medium rounded transition-all relative ${
                            message.selectedResponse === 'alternative'
                              ? 'bg-accent-primary text-accent-text shadow-sm'
                              : 'text-text-secondary hover:text-text-primary hover:bg-tertiary-bg/50'
                          }`}
                        >
                          B
                          {/* RAG dot for B */}
                          <span className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                            message.ragSyncedResponse === 'alternative' ? 'bg-green-500' : 'bg-yellow-500'
                          }`} title={message.ragSyncedResponse === 'alternative' ? 'B is in RAG' : 'B not in RAG'}></span>
                        </button>
                      </div>
                      
                      {/* Confirm button - only show if current selection is NOT the synced one */}
                      {onConfirmResponse && message.ragSyncedResponse !== message.selectedResponse && (
                        <button
                          onClick={() => onConfirmResponse(message.id)}
                          className="px-2 py-1 text-[11px] font-medium rounded bg-green-500 hover:bg-green-600 text-white transition-all"
                          title="Sync to RAG"
                        >
                          ✓
                        </button>
                      )}
                    </div>
                  </div>
                  {message.alternativeModel && (
                    <div className="text-[10px] text-text-secondary mt-1.5 opacity-60">
                      {modelId} • {message.alternativeModel}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 mt-3">
                  {message.summary && (
                    <button onClick={() => setShowOriginal(p => !p)} className="flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-accent-primary transition-all hover:scale-105 active:scale-95 px-2 py-1 rounded-md hover:bg-tertiary-bg/50">
                      <EyeIcon className="w-3.5 h-3.5" />
                      {showOriginal ? 'Show Summary' : 'Show Original'}
                    </button>
                  )}
                   {showFullContextButton && message.contextPayload && (
                    <button onClick={() => onOpenContext && onOpenContext(message.contextPayload!)} className="flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-accent-primary transition-all hover:scale-105 active:scale-95 px-2 py-1 rounded-md hover:bg-tertiary-bg/50">
                      <FileTextIcon className="w-3.5 h-3.5" />
                      View Full Context
                    </button>
                  )}
              </div>
            </>
          )}
        </div>

        <div className="absolute top-2 right-3 group-[.rtl]:left-3 group-[.rtl]:right-auto flex items-center gap-0.5 rounded-lg p-1 opacity-0 group-hover:opacity-100 transition-all duration-200 action-buttons-container">
          {onGenerateSong && !message.imageUrl && !message.isGeneratingImage && (
              <ActionButton onClick={() => onGenerateSong(message.id)} label="Generate Song">
                <SparklesIcon className="w-4 h-4 text-purple-500" />
              </ActionButton>
          )}
          {!isUser && !message.imageUrl && (
              <ActionButton onClick={() => setShowCustomEditor(v => !v)} label="Remove filler" disabled={message.isSummarizing}>
                <FeatherIcon className="w-4 h-4" />
              </ActionButton>
          )}
          {!isUser && !message.imageUrl && (
              <ActionButton onClick={() => onSummarize(message.id)} label="Summarize message" disabled={!!message.summary || message.isSummarizing}>
                <SummarizeIcon className="w-4 h-4" />
              </ActionButton>
          )}
          {!message.imageUrl && !message.isGeneratingImage && (
              <ActionButton onClick={() => onTransformToPrompt(message.id)} label="Generate image prompt">
                <SparklesIcon className="w-4 h-4" />
              </ActionButton>
          )}
          {(isLastUserMessage || !isUser) && !message.isGeneratingImage && (
              <ActionButton 
                  onClick={() => message.imageUrl ? onTransformToPrompt(message.id) : onRegenerate(message.id)} 
                  label={message.imageUrl ? "Regenerate image" : "Regenerate response"}
              >
                  <RegenerateIcon className="w-4 h-4" />
              </ActionButton>
          )}
          {!message.isGeneratingImage && !message.imageUrl && (
              <ActionButton onClick={() => setIsEditing(true)} label="Edit message">
                <EditIcon className="w-4 h-4" />
              </ActionButton>
          )}
          {!isUser && !message.imageUrl && (
            <ActionButton onClick={handleCopy} label="Copy content">
              {copied ? <CheckIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
            </ActionButton>
          )}
          <ActionButton onClick={() => onDelete(message.id)} label="Delete message">
            <TrashIcon className="w-4 h-4" />
          </ActionButton>
        </div>
      </div>
      
      {/* Full Context modal moved to ChatView (global) */}
    </>
  );
};

export default React.memo(MessageComponent);
