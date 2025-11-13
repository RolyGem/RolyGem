import React, { useRef, useEffect, useState } from 'react';
import type { Story, Settings, Model } from '../types';
import { useStoryHandler } from '../hooks/useStoryHandler';
import { useNotifications } from '../contexts/NotificationContext';
import { MenuIcon } from './icons/MenuIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { SaveIcon } from './icons/SaveIcon';
import { PencilLineIcon } from './icons/PencilLineIcon';
import { LoaderIcon } from './icons/LoaderIcon';
import { FeatherIcon } from './icons/FeatherIcon';
import { RadioPill } from './RadioPill';

interface StoryViewProps {
  story: Story | null;
  onStoryUpdate: (updatedStory: Story) => void;
  settings: Settings;
  onToggleSidebar: () => void;
  selectedModel: Model; 
}

const StoryView: React.FC<StoryViewProps> = (props) => {
    const { story, onStoryUpdate, settings, onToggleSidebar, selectedModel } = props;

    const {
        isStreaming,
        isRewriting,
        error,
        handleGenerate,
        handleContentChange,
        handleSystemPromptChange,
        handleSave,
        handleRewriteSelection,
    } = useStoryHandler({ story, onStoryUpdate, settings, selectedModel });

    const [prompt, setPrompt] = useState('');
    const [selection, setSelection] = useState('');
    const { addNotification } = useNotifications();
    const contentRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll to the bottom of the content when streaming
    useEffect(() => {
        if ((isStreaming || isRewriting) && contentRef.current) {
            contentRef.current.scrollTop = contentRef.current.scrollHeight;
        }
    }, [story?.content, isStreaming, isRewriting]);

    const handleTextSelection = () => {
        if(contentRef.current) {
            const selectedText = contentRef.current.value.substring(contentRef.current.selectionStart, contentRef.current.selectionEnd);
            setSelection(selectedText.trim());
        }
    };

    const triggerRewrite = () => {
        if (!selection) return;

        addNotification({
            title: 'Rewrite Selection',
            message: 'Provide instructions for how to rewrite the selected text.',
            showPrompt: true,
            promptPlaceholder: "e.g., Make this more descriptive.",
            onPromptSubmit: (rewritePrompt) => {
                handleRewriteSelection(selection, rewritePrompt);
                setSelection(''); // Clear selection after initiating
            },
            actions: [
                { label: 'Cancel', onClick: () => {} }
            ]
        });
    };
    
    const handleGenerateClick = () => {
        handleGenerate(prompt);
        if (prompt) {
            setPrompt('');
        }
    };

    if (!story) {
        return (
          <main className="flex-1 flex flex-col h-full">
            <header className="flex items-center gap-4 p-3 border-b main-header">
                <button onClick={onToggleSidebar} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-gray-800">
                    <MenuIcon className="w-6 h-6" />
                </button>
                 <div className="flex-1" />
                <RadioPill />
            </header>
            <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 dark:text-gray-500 p-8">
                <PencilLineIcon className="w-16 h-16 mb-4 text-slate-300 dark:text-gray-700" />
                <h2 className="text-2xl font-semibold text-slate-600 dark:text-gray-400 mb-2">Story Mode</h2>
                <p>Select a story or create a new one to begin writing.</p>
            </div>
          </main>
        );
    }
    
    return (
        <main 
            className="flex-1 flex flex-col h-full chat-background-container"
            style={{ backgroundImage: settings.chatBackground ? `url(${settings.chatBackground})` : 'none' }}
            data-has-background={!!settings.chatBackground}
        >
           <header className="flex items-center gap-4 p-3 border-b main-header">
                <button onClick={onToggleSidebar} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-gray-800">
                    <MenuIcon className="w-6 h-6" />
                </button>
                <div className="flex-1 flex items-center min-w-0">
                    <input
                        type="text"
                        value={story.title}
                        onChange={(e) => onStoryUpdate({ ...story, title: e.target.value })}
                        onBlur={handleSave}
                        className="text-lg font-semibold truncate bg-transparent focus:outline-none focus:ring-0"
                    />
                </div>
                <RadioPill />
                <button onClick={handleSave} disabled={isStreaming || isRewriting} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-lg btn-secondary disabled:opacity-50">
                    <SaveIcon className="w-4 h-4"/>
                    Save
                </button>
            </header>

            <div className="flex-1 flex flex-col min-h-0 p-2 sm:p-4">
                <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
                    {/* System Prompt */}
                    <div className="mb-2 sm:mb-4">
                        <label className="text-xs sm:text-sm font-semibold text-text-secondary mb-1 block">Writer's Instructions</label>
                        <textarea
                            value={story.systemPrompt}
                            onChange={(e) => handleSystemPromptChange(e.target.value)}
                            className="w-full p-2 text-xs sm:text-sm border rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-accent-primary modal-input"
                            rows={2}
                            disabled={isStreaming || isRewriting}
                        />
                    </div>

                    {/* Story Content */}
                    <div className="flex-1 relative">
                        <textarea
                            ref={contentRef}
                            value={story.content}
                            onChange={(e) => handleContentChange(e.target.value)}
                            onSelect={handleTextSelection}
                            className="w-full h-full p-2 sm:p-4 text-sm sm:text-base border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-accent-primary modal-input story-content-area"
                            placeholder="Your story begins here..."
                            disabled={isStreaming || isRewriting}
                        />
                    </div>
                </div>
            </div>

            {/* Input Area */}
            <div className="p-2 sm:p-3 md:p-4 border-t flex-shrink-0 chat-input-area">
                {error && <p className="text-red-500 text-xs sm:text-sm mb-2 text-center">{error}</p>}
                <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-end gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-xl chat-input-capsule">
                    <div className="flex-1 order-1">
                        <input
                            type="text"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { handleGenerateClick(); } }}
                            placeholder="Optional: Guide the AI on what to write next..."
                            className="w-full px-2 py-2 sm:py-2.5 text-sm sm:text-base bg-transparent focus:outline-none text-text-primary placeholder-text-secondary transition-all disabled:opacity-50 resize-none"
                            disabled={isStreaming || isRewriting}
                        />
                    </div>
                    <div className="flex gap-1.5 sm:gap-2 order-2 sm:order-2 justify-end sm:justify-start flex-shrink-0">
                        <button 
                            onClick={triggerRewrite} 
                            disabled={isStreaming || isRewriting || !selection}
                            className="p-2 sm:p-3 rounded-full btn-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 flex-shrink-0"
                            aria-label="Rewrite Selection"
                            title="Rewrite Selection"
                        >
                            <PencilLineIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                        <button
                            onClick={handleGenerateClick}
                            disabled={isStreaming || isRewriting}
                            className="px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm font-semibold rounded-xl sm:rounded-2xl new-chat-btn disabled:opacity-50 flex items-center gap-1.5 sm:gap-2 transition-all hover:scale-105 active:scale-95 flex-shrink-0"
                            title={prompt.trim() ? "Guide & Continue" : "Complete Story"}
                        >
                            {isStreaming || isRewriting ? <LoaderIcon className="w-4 h-4 sm:w-5 sm:h-5"/> : (prompt.trim() ? <SparklesIcon className="w-4 h-4 sm:w-5 sm:h-5" /> : <FeatherIcon className="w-4 h-4 sm:w-5 sm:h-5" />)}
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default StoryView;