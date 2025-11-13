import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Model } from '../types';
import { ImageIcon } from './icons/ImageIcon';
import { SearchIcon } from './icons/SearchIcon';
import { StarIcon } from './icons/StarIcon';
import { MicIcon } from './icons/MicIcon';
import { SparklesIcon } from './icons/SparklesIcon';

interface ModelSelectorProps {
  models: Model[];
  selectedModel: string;
  setSelectedModel: (modelId: string) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ models, selectedModel, setSelectedModel }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pinnedModels, setPinnedModels] = useState<string[]>(() => {
    const saved = localStorage.getItem('pinnedModels');
    return saved ? JSON.parse(saved) : [];
  });
  const [collapsedProviders, setCollapsedProviders] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLUListElement>(null);

  const togglePin = (modelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newPinned = pinnedModels.includes(modelId)
      ? pinnedModels.filter(id => id !== modelId)
      : [...pinnedModels, modelId];
    setPinnedModels(newPinned);
    localStorage.setItem('pinnedModels', JSON.stringify(newPinned));
  };

  const toggleProvider = (provider: string) => {
    const newCollapsed = new Set(collapsedProviders);
    if (newCollapsed.has(provider)) {
      newCollapsed.delete(provider);
    } else {
      newCollapsed.add(provider);
    }
    setCollapsedProviders(newCollapsed);
  };

  const formatContextWindow = (tokens?: number): string => {
    if (!tokens) return '';
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(0)}M`;
    }
    return `${(tokens / 1000).toFixed(0)}k`;
  };

  const handleSelect = (modelId: string) => {
    setSelectedModel(modelId);
    setIsOpen(false);
  };

  const currentModel = models.find(m => m.id === selectedModel) || models[0];
  
  const modelsByProvider = useMemo(() => models.reduce((acc, model) => {
    (acc[model.provider] = acc[model.provider] || []).push(model);
    return acc;
  }, {} as Record<string, Model[]>), [models]);

  const pinModels = useMemo(() => {
    return models.filter(m => pinnedModels.includes(m.id));
  }, [models, pinnedModels]);

  const filteredModelsByProvider = useMemo(() => {
    if (!searchQuery.trim()) {
      return modelsByProvider;
    }

    const lowercasedQuery = searchQuery.toLowerCase();
    const filtered: Record<string, Model[]> = {};

    for (const provider in modelsByProvider) {
      const providerModels = modelsByProvider[provider].filter(
        model =>
          model.name.toLowerCase().includes(lowercasedQuery) ||
          model.id.toLowerCase().includes(lowercasedQuery)
      );
      if (providerModels.length > 0) {
        filtered[provider] = providerModels;
      }
    }
    return filtered;
  }, [searchQuery, modelsByProvider]);

  const filteredPinned = useMemo(() => {
    if (!searchQuery.trim()) return pinModels;
    const lowercasedQuery = searchQuery.toLowerCase();
    return pinModels.filter(m =>
      m.name.toLowerCase().includes(lowercasedQuery) ||
      m.id.toLowerCase().includes(lowercasedQuery)
    );
  }, [searchQuery, pinModels]);

  useEffect(() => {
    if (isOpen) {
      // Reset search on open to show all models initially
      setSearchQuery('');
      
      // Scroll to selected model after a short delay for the list to render
      const timer = setTimeout(() => {
        if (listRef.current) {
          const selectedElement = listRef.current.querySelector(`[data-model-id="${selectedModel}"]`);
          if (selectedElement) {
            selectedElement.scrollIntoView({ block: 'center', behavior: 'auto' });
          }
        }
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [isOpen, selectedModel]);


  return (
    <div className="relative w-full">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-left rounded-lg text-sm transition-colors model-selector-btn"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate">{currentModel?.name || 'Select a model'}</span>
        <svg className={`w-4 h-4 transition-transform flex-shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 w-full rounded-lg shadow-lg border border-color z-10 flex flex-col max-h-96 model-selector-panel bg-secondary-bg/80 backdrop-blur-md">
          <div className="p-2 border-b border-color relative">
            <SearchIcon className="w-4 h-4 absolute top-1/2 left-4 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              placeholder="Search for a model... (Ctrl+M)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2 py-1.5 text-sm rounded-md modal-input"
              autoFocus
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          <ul ref={listRef} className="py-1 flex-1 overflow-y-auto" role="listbox">
            {filteredPinned.length > 0 && (
              <React.Fragment>
                <li className="px-4 pt-2 pb-1 text-xs font-bold text-accent-primary uppercase tracking-wider flex items-center gap-1">
                  <span>⭐ Pinned</span>
                </li>
                {filteredPinned.map((model: Model) => (
                  <li key={`pin-${model.id}`} role="option" aria-selected={selectedModel === model.id}>
                    <button
                      onClick={() => handleSelect(model.id)}
                      data-model-id={model.id}
                      className={`w-full flex items-center gap-2 px-4 py-1.5 text-xs list-item group ${selectedModel === model.id ? 'list-item-active' : 'text-text-primary'}`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <button
                          onClick={(e) => togglePin(model.id, e)}
                          className="flex-shrink-0 hover:scale-110 transition-transform"
                          title="Unpin"
                        >
                          <StarIcon className="w-3 h-3 text-yellow-500" filled />
                        </button>
                        <span className="truncate font-medium flex-1 text-left">{model.name}</span>
                        {model.contextLengthTokens && (
                          <span className="text-[10px] text-text-secondary opacity-60 flex-shrink-0 min-w-[30px] text-right">
                            {formatContextWindow(model.contextLengthTokens)}
                          </span>
                        )}
                        {!model.name.toLowerCase().includes('free') && (
                          <span className="text-[10px] text-yellow-600 opacity-80 flex-shrink-0">$</span>
                        )}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {model.supportsImageInput && (
                            <ImageIcon className="w-3 h-3 text-blue-500 opacity-80" />
                          )}
                          {model.supportsAudio && (
                            <MicIcon className="w-3 h-3 text-purple-500 opacity-80" />
                          )}
                          {model.supportsThinking && (
                            <SparklesIcon className="w-3 h-3 text-amber-500 opacity-80" />
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </React.Fragment>
            )}
            {Object.keys(filteredModelsByProvider).length > 0 ? (
                Object.keys(filteredModelsByProvider).map((provider) => {
                    const providerModels = filteredModelsByProvider[provider];
                    const isCollapsed = collapsedProviders.has(provider);
                    return (
                        <React.Fragment key={provider}>
                            <li>
                              <button
                                onClick={() => toggleProvider(provider)}
                                className="w-full px-4 pt-2 pb-1 text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1 hover:text-text-primary transition-colors"
                              >
                                <span className="text-[10px]">{isCollapsed ? '▶' : '▼'}</span>
                                <span>{provider} ({providerModels.length})</span>
                              </button>
                            </li>
                            {!isCollapsed && providerModels.map((model: Model) => (
                                <li key={model.id} role="option" aria-selected={selectedModel === model.id}>
                                    <button
                                      onClick={() => handleSelect(model.id)}
                                      data-model-id={model.id}
                                      className={`w-full flex items-center gap-2 px-4 py-1.5 text-xs list-item group ${selectedModel === model.id ? 'list-item-active' : 'text-text-primary'}`}
                                    >
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <button
                                          onClick={(e) => togglePin(model.id, e)}
                                          className="flex-shrink-0 hover:scale-110 transition-transform"
                                          title={pinnedModels.includes(model.id) ? 'Unpin' : 'Pin'}
                                        >
                                          <StarIcon 
                                            className={`w-3 h-3 ${pinnedModels.includes(model.id) ? 'text-yellow-500' : 'text-text-secondary opacity-50'}`}
                                            filled={pinnedModels.includes(model.id)}
                                          />
                                        </button>
                                        <span className="truncate font-medium flex-1 text-left">{model.name}</span>
                                        {model.contextLengthTokens && (
                                          <span className="text-[10px] text-text-secondary opacity-60 flex-shrink-0 min-w-[30px] text-right">
                                            {formatContextWindow(model.contextLengthTokens)}
                                          </span>
                                        )}
                                        {!model.name.toLowerCase().includes('free') && (
                                          <span className="text-[10px] text-yellow-600 opacity-80 flex-shrink-0">$</span>
                                        )}
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                          {model.supportsImageInput && (
                                            <ImageIcon className="w-3 h-3 text-blue-500 opacity-80" />
                                          )}
                                          {model.supportsAudio && (
                                            <MicIcon className="w-3 h-3 text-purple-500 opacity-80" />
                                          )}
                                          {model.supportsThinking && (
                                            <SparklesIcon className="w-3 h-3 text-amber-500 opacity-80" />
                                          )}
                                        </div>
                                      </div>
                                    </button>
                                </li>
                            ))}
                        </React.Fragment>
                    );
                })
            ) : (
                <li className="px-4 py-3 text-sm text-center text-text-secondary">No models found.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
