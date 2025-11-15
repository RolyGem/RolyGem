import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Conversation, Model, Story } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { SettingsIcon } from './icons/SettingsIcon';
import { UsersIcon } from './icons/UsersIcon';
import { BookIcon } from './icons/BookIcon';
import { BrainCircuitIcon } from './icons/BrainCircuitIcon';
import { ModelSelector } from './ModelSelector';
import { LoaderIcon } from './icons/LoaderIcon';
import { TrendingUpIcon } from './icons/TrendingUpIcon';
import { XIcon } from './icons/XIcon';
import { InboxIcon } from './icons/InboxIcon';
import { MoreVerticalIcon } from './icons/MoreVerticalIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { UploadIcon } from './icons/UploadIcon';
import { PencilLineIcon } from './icons/PencilLineIcon';


interface SidebarProps {
  // Common
  models: Model[];
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  isSidebarOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenCharacters: () => void;
  onOpenLorebooks: () => void;
  onOpenMemory: () => void;
  currentView: 'chat' | 'story';
  onSetView: (view: 'chat' | 'story') => void;
  onOpenBriefingRoom: () => void;
  unreadBriefingsCount: number;

  // Chat specific
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onExportConversation: (id: string) => void;
  onImportConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onLoadMoreConversations: () => void;
  hasMoreConversations: boolean;
  isLoadingConversations: boolean;
  onToggleStoryArcs: (id: string) => void;

  // Story specific
  stories: Story[];
  selectedStory: Story | null;
  onNewStory: () => void;
  onSelectStory: (id: string) => void;
  onDeleteStory: (id: string) => void;
  onLoadMoreStories: () => void;
  hasMoreStories: boolean;
  isLoadingStories: boolean;
}

const SidebarIconButton: React.FC<{ label: string; children: React.ReactNode; badge?: boolean; onClick?: () => void; disabled?: boolean; }> = ({ label, children, badge, ...props }) => (
  <button {...props} className="flex flex-col items-center gap-1 p-2 rounded-lg text-xs text-text-secondary hover:bg-tertiary-bg w-full disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors" title={label}>
    <div className="relative">
      {children}
      {badge && <span className="absolute -top-0.5 -right-0.5 block h-2 w-2 rounded-full bg-accent-primary ring-2 ring-secondary-bg"></span>}
    </div>
    <span className="truncate">{label}</span>
  </button>
);

const ConversationItemMenu: React.FC<{
  conversation: Conversation;
  onExport: () => void;
  onImport: () => void;
  onDelete: () => void;
  onRename: () => void;
}> = ({ conversation, onExport, onImport, onDelete, onRename }) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);
  
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 160;
      let left = rect.right - menuWidth;
      
      // Keep the menu within the viewport
      if (left < 8) left = 8;
      if (left + menuWidth > window.innerWidth - 8) {
        left = window.innerWidth - menuWidth - 8;
      }
      
      setPosition({
        top: rect.bottom + 4,
        left: left,
      });
    }
  }, [isOpen]);
  
  const hasMessages = conversation.messages.length > 0;
  const isEmpty = conversation.messages.length === 0;
  
  const menuContent = isOpen ? (
    <div 
      ref={menuRef}
      className="fixed w-40 bg-secondary-bg/80 backdrop-blur-md border border-color/50 rounded-xl shadow-2xl z-[9999] py-1.5 px-1.5"
      style={{ 
        top: `${position.top}px`, 
        left: `${position.left}px`,
        direction: 'ltr',
      }}
      onMouseDown={(e) => { e.stopPropagation(); }}
      onTouchStart={(e) => { e.stopPropagation(); }}
      onClick={(e) => { e.stopPropagation(); }}
    >
      <div className="space-y-0.5">
        <button
          onClick={(e) => { e.stopPropagation(); setIsOpen(false); onRename(); }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-text-primary hover:bg-tertiary-bg/50 transition-colors rounded-lg"
        >
          <PencilLineIcon className="w-4 h-4" />
          <span>Rename</span>
        </button>
        {hasMessages && (
          <button
            onClick={(e) => { e.stopPropagation(); setIsOpen(false); onExport(); }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-text-primary hover:bg-tertiary-bg/50 transition-colors rounded-lg"
          >
            <DownloadIcon className="w-4 h-4" />
            <span>Export</span>
          </button>
        )}
        {isEmpty && (
          <button
            onClick={(e) => { e.stopPropagation(); setIsOpen(false); onImport(); }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-text-primary hover:bg-tertiary-bg/50 transition-colors rounded-lg"
          >
            <UploadIcon className="w-4 h-4" />
            <span>Import</span>
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); setIsOpen(false); if (window.confirm('Are you sure you want to delete this conversation?')) onDelete(); }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors rounded-lg"
        >
          <TrashIcon className="w-4 h-4" />
          <span>Delete</span>
        </button>
      </div>
    </div>
  ) : null;
  
  return (
    <>
      <button
        ref={buttonRef}
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className={`p-1.5 text-gray-400 hover:text-text-primary hover:bg-tertiary-bg/50 transition-all rounded-lg ${isOpen ? 'opacity-100' : 'opacity-100'}`}
        aria-label="Options"
      >
        <MoreVerticalIcon className="w-4 h-4" />
      </button>
      {isOpen && createPortal(
        <div 
          className="fixed inset-0 z-[9998]" 
          onClick={() => setIsOpen(false)}
          onTouchStart={() => setIsOpen(false)}
        />, 
        document.body
      )}
      {menuContent && createPortal(menuContent, document.body)}
    </>
  );
};


const SidebarComponent: React.FC<SidebarProps> = (props) => {
  const {
    models, selectedModelId, onSelectModel, isSidebarOpen, onClose, onOpenSettings,
    onOpenCharacters, onOpenLorebooks, onOpenMemory, currentView, onSetView,
    onOpenBriefingRoom, unreadBriefingsCount,
    conversations, selectedConversation, onNewConversation, onSelectConversation, onDeleteConversation,
    onExportConversation, onImportConversation, onRenameConversation,
    onLoadMoreConversations, hasMoreConversations, isLoadingConversations, onToggleStoryArcs,
    stories, selectedStory, onNewStory, onSelectStory, onDeleteStory,
    onLoadMoreStories, hasMoreStories, isLoadingStories,
  } = props;
  
  const loaderRef = useRef<HTMLDivElement>(null);
  
  const selectedId = currentView === 'chat' ? selectedConversation?.id : selectedStory?.id;

  const handleNew = () => {
    if (currentView === 'chat') {
      onNewConversation();
    } else {
      onNewStory();
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
            if (currentView === 'chat' && hasMoreConversations && !isLoadingConversations) {
                onLoadMoreConversations();
            } else if (currentView === 'story' && hasMoreStories && !isLoadingStories) {
                onLoadMoreStories();
            }
        }
      },
      { threshold: 1.0 }
    );

    const currentLoader = loaderRef.current;
    if (currentLoader) {
      observer.observe(currentLoader);
    }

    return () => {
      if (currentLoader) {
        observer.unobserve(currentLoader);
      }
    };
  }, [currentView, hasMoreConversations, isLoadingConversations, onLoadMoreConversations, hasMoreStories, isLoadingStories, onLoadMoreStories]);

  const renderList = () => {
    if (currentView === 'chat') {
        return conversations.map((convo) => (
            <div key={convo.id} className="group relative flex items-center">
                <button
                onClick={() => onSelectConversation(convo.id)}
                className={`flex-1 text-left truncate pl-3 pr-10 py-2 text-sm rounded-lg transition-colors list-item ${selectedId === convo.id ? 'list-item-active' : 'text-text-primary'}`}
                >
                {convo.title}
                </button>
                <div className="absolute right-1 top-1/2 -translate-y-1/2">
                  <ConversationItemMenu
                    conversation={convo}
                    onExport={() => onExportConversation(convo.id)}
                    onImport={() => onImportConversation(convo.id)}
                    onDelete={() => onDeleteConversation(convo.id)}
                    onRename={() => {
                      const newTitle = prompt('Enter new conversation title:', convo.title);
                      if (newTitle && newTitle.trim() !== '' && newTitle !== convo.title) {
                        onRenameConversation(convo.id, newTitle.trim());
                      }
                    }}
                  />
                </div>
            </div>
        ));
    } else {
        return stories.map((story) => (
             <div key={story.id} className="group relative">
                <button
                onClick={() => onSelectStory(story.id)}
                className={`block w-full text-left truncate pl-3 pr-8 py-2 text-sm rounded-lg transition-colors list-item ${selectedId === story.id ? 'list-item-active' : 'text-text-primary'}`}
                >
                {story.title}
                </button>
                <button
                onClick={(e) => { e.stopPropagation(); if (window.confirm('Are you sure you want to delete this story?')) { onDeleteStory(story.id) }}}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                <TrashIcon className="w-4 h-4" />
                </button>
            </div>
        ));
    }
  };

  return (
    <aside className={`absolute md:static z-40 inset-y-0 left-0 flex flex-col sidebar-container transform md:transform-none transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className={`flex flex-col flex-shrink-0 w-72 h-full transition-all duration-300 overflow-hidden ${isSidebarOpen ? 'md:w-72' : 'md:w-0'}`}>
        <div className="p-3 flex items-center justify-between border-b border-color md:border-b-0">
          <button
            onClick={handleNew}
            className="flex-grow flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold new-chat-btn rounded-lg transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            {currentView === 'chat' ? 'New Chat' : 'New Story'}
          </button>
           <button
            onClick={onClose}
            className="p-2 ml-2 rounded-full text-text-secondary hover:bg-tertiary-bg md:hidden"
            aria-label="Close sidebar"
           >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="px-3 pb-2">
              <div className="flex w-full p-1 rounded-lg segmented-control">
                  <button onClick={() => onSetView('chat')} className={`flex-1 py-1 text-sm font-semibold rounded-md transition-colors ${currentView === 'chat' ? 'shadow segmented-control-btn-active' : 'text-text-secondary'}`}>Chats</button>
                  <button onClick={() => onSetView('story')} className={`flex-1 py-1 text-sm font-semibold rounded-md transition-colors ${currentView === 'story' ? 'shadow segmented-control-btn-active' : 'text-text-secondary'}`}>Stories</button>
              </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 space-y-1">
          {renderList()}
          <div ref={loaderRef} className="flex justify-center items-center h-10">
            {currentView === 'chat' && hasMoreConversations && isLoadingConversations && <LoaderIcon className="w-5 h-5" />}
            {currentView === 'story' && hasMoreStories && isLoadingStories && <LoaderIcon className="w-5 h-5" />}
          </div>
        </nav>

        <div className="p-3 border-t border-color space-y-3">
          <ModelSelector
            models={models}
            selectedModel={selectedModelId}
            setSelectedModel={onSelectModel}
          />
          <div className="grid grid-cols-3 gap-2">
              <SidebarIconButton label="Briefings" onClick={onOpenBriefingRoom} badge={unreadBriefingsCount > 0}>
                  <InboxIcon className="w-5 h-5"/>
              </SidebarIconButton>
              <SidebarIconButton label="Characters" onClick={onOpenCharacters}>
                  <UsersIcon className="w-5 h-5"/>
              </SidebarIconButton>
              <SidebarIconButton label="Lorebooks" onClick={onOpenLorebooks}>
                  <BookIcon className="w-5 h-5"/>
              </SidebarIconButton>
              <SidebarIconButton label="Memory" onClick={onOpenMemory}>
                  <BrainCircuitIcon className="w-5 h-5"/>
              </SidebarIconButton>
               <SidebarIconButton 
                  label="Story Arcs" 
                  onClick={() => selectedConversation?.id && onToggleStoryArcs(selectedConversation.id)} 
                  disabled={!selectedConversation?.id || currentView !== 'chat'}
                  badge={selectedConversation?.storyArcsEnabled}
                >
                  <TrendingUpIcon className="w-5 h-5" />
              </SidebarIconButton>
              <SidebarIconButton label="Settings" onClick={onOpenSettings}>
                  <SettingsIcon className="w-5 h-5"/>
              </SidebarIconButton>
          </div>
        </div>
      </div>
    </aside>
  );
};

export const Sidebar = React.memo(SidebarComponent);
