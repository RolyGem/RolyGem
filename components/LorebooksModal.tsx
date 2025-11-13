import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Lorebook, LorebookEntry } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { BookIcon } from './icons/BookIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { XIcon } from './icons/XIcon';
import { LoaderIcon } from './icons/LoaderIcon';
import { generateLorebook } from '../services/aiService';
import { generateUUID } from '../utils/uuid';

interface LorebooksModalProps {
  isOpen: boolean;
  onClose: () => void;
  lorebooks: Lorebook[];
  onSave: (lorebook: Lorebook) => void;
  onDelete: (id: string) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  onOpen: () => void;
}

const EMPTY_LOREBOOK: Omit<Lorebook, 'id' | 'createdAt'> = {
  name: '',
  description: '',
  entries: [],
};

const TagInput: React.FC<{
  keywords: string;
  onKeywordsChange: (newKeywords: string) => void;
}> = ({ keywords, onKeywordsChange }) => {
  const [inputValue, setInputValue] = useState('');
  const tags = keywords.split(',').map(k => k.trim()).filter(Boolean);

  const handleAddTag = () => {
    const newTag = inputValue.trim().replace(/,/g, ''); // Remove commas from input
    if (newTag && !tags.includes(newTag)) {
      onKeywordsChange([...tags, newTag].join(', '));
    }
    setInputValue('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onKeywordsChange(tags.filter(tag => tag !== tagToRemove).join(', '));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <div>
        <div className="flex flex-wrap items-center gap-2 p-2 border rounded-lg modal-input">
            {tags.map(tag => (
                <span key={tag} className="flex items-center gap-1.5 px-2 py-1 text-sm bg-tertiary-bg rounded">
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="text-text-secondary hover:text-text-primary">
                        <XIcon className="w-3 h-3" />
                    </button>
                </span>
            ))}
            <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleAddTag} // Add tag when input loses focus
                placeholder="Add a keyword..."
                className="flex-1 bg-transparent focus:outline-none min-w-[120px]"
            />
        </div>
    </div>
  );
};

export const LorebooksModal: React.FC<LorebooksModalProps> = ({ isOpen, onClose, lorebooks, onSave, onDelete, hasMore, onLoadMore, onOpen }) => {
  const [selectedLorebookId, setSelectedLorebookId] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_LOREBOOK);
  
  const [aiConcept, setAiConcept] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  
  const loaderRef = useRef<HTMLDivElement>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Fix: Simplified useEffect to call onOpen when the modal becomes visible.
  // The logic to prevent re-fetching is now in the memoized onOpen callback in App.tsx.
  useEffect(() => {
    if (isOpen) {
      onOpen();
    }
  }, [isOpen, onOpen]);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          onLoadMore();
        }
      },
      { threshold: 1.0 }
    );
    const currentLoader = loaderRef.current;
    if (currentLoader) observer.observe(currentLoader);
    return () => {
      if (currentLoader) observer.unobserve(currentLoader);
    };
  }, [hasMore, onLoadMore]);

  useEffect(() => {
    if (selectedLorebookId) {
        const book = lorebooks.find(lb => lb.id === selectedLorebookId);
        if (book) {
            setFormData({ 
              name: book.name, 
              description: book.description, 
              entries: book.entries,
            });
        }
    } else {
        setFormData(EMPTY_LOREBOOK);
    }
  }, [selectedLorebookId, lorebooks]);

  const handleSelectLorebook = (id: string) => {
    setSelectedLorebookId(id);
  };

  const handleNewLorebook = () => {
    setSelectedLorebookId(null);
    setFormData(EMPTY_LOREBOOK);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEntryChange = (entryId: string, field: 'keywords' | 'content', value: string) => {
    setFormData(prev => ({
        ...prev,
        entries: prev.entries.map(entry => 
            entry.id === entryId ? { ...entry, [field]: value } : entry
        )
    }));
  };

  const handleAddEntry = () => {
    const newEntry: LorebookEntry = {
        id: generateUUID(),
        keywords: '',
        content: '',
    };
    setFormData(prev => ({
        ...prev,
        entries: [...prev.entries, newEntry]
    }));
    return newEntry.id;
  };

  const handleRemoveEntry = (entryId: string) => {
    setFormData(prev => ({
        ...prev,
        entries: prev.entries.filter(entry => entry.id !== entryId)
    }));
  };
  
  const animateFormData = useCallback(async (data: Omit<Lorebook, 'id' | 'createdAt'>) => {
    const type = (setter: (updater: (prev: string) => string) => void, text: string): Promise<void> => {
        return new Promise(resolve => {
            let i = 0;
            const interval = setInterval(() => {
                if (i <= text.length) {
                    setter(() => text.substring(0, i));
                    i++;
                } else {
                    clearInterval(interval);
                    resolve();
                }
            }, 10);
        });
    };

    setFormData(EMPTY_LOREBOOK); // Clear form
    await new Promise(r => setTimeout(r, 50)); // Allow UI to update

    if (data.name) await type(val => setFormData(p => ({...p, name: val(p.name)})), data.name);
    if (data.description) await type(val => setFormData(p => ({...p, description: val(p.description)})), data.description);

    for (const entry of data.entries) {
        const newEntryId = handleAddEntry();
        await new Promise(r => setTimeout(r, 100)); // Wait for new entry UI
        if (entry.keywords) {
            await type(val => handleEntryChange(newEntryId, 'keywords', val('')), entry.keywords);
        }
        if (entry.content) {
            await type(val => handleEntryChange(newEntryId, 'content', val('')), entry.content);
        }
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!aiConcept.trim()) return;
    setIsGenerating(true);
    setGenerationError(null);
    handleNewLorebook(); // Set form to a new character state

    try {
        const lorebookData = await generateLorebook(aiConcept);
        await animateFormData(lorebookData);
    } catch (error: any) {
        setGenerationError(error.message || 'An unknown error occurred during generation.');
    } finally {
        setIsGenerating(false);
    }
  }, [aiConcept, animateFormData]);

  const handleSave = () => {
    if (!formData.name.trim()) {
        alert("Lorebook name cannot be empty.");
        return;
    }
    const lorebookData: Lorebook = {
        id: selectedLorebookId || generateUUID(),
        createdAt: selectedLorebookId ? lorebooks.find(lb => lb.id === selectedLorebookId)!.createdAt : Date.now(),
        ...formData,
    };
    onSave(lorebookData);
    if (!selectedLorebookId) {
        setSelectedLorebookId(lorebookData.id);
    }
  };

  const handleDelete = () => {
    if (selectedLorebookId && window.confirm("Are you sure you want to delete this lorebook? This will also remove it from any conversations it's active in.")) {
        onDelete(selectedLorebookId);
        setSelectedLorebookId(null);
        setFormData(EMPTY_LOREBOOK);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center transition-opacity"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lorebooks-title"
    >
      <div 
        className="modal-panel rounded-2xl shadow-2xl w-full max-w-5xl m-4 flex flex-col transform transition-transform scale-95 max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-3 sm:p-6 border-b border-color modal-header-bg rounded-t-2xl relative">
            {/* Close button - top right */}
            <button onClick={onClose} className="absolute top-3 right-3 sm:top-6 sm:right-6 p-1 rounded-full text-text-secondary hover:bg-tertiary-bg" title="Close">
              <XIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            
            <div className="flex flex-col gap-3 pr-10">
              <h2 id="lorebooks-title" className="text-lg sm:text-2xl font-bold">Lorebooks</h2>
              
              {/* Custom Dropdown for small screens */}
              <div className="md:hidden w-full relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full p-2 border rounded-lg modal-input text-sm flex items-center justify-between gap-2"
                >
                  {selectedLorebookId ? (
                    <div className="min-w-0 flex-1 text-left">
                      <div className="truncate font-medium">{lorebooks.find(b => b.id === selectedLorebookId)?.name || 'Untitled'}</div>
                      <div className="truncate text-xs text-text-secondary">{lorebooks.find(b => b.id === selectedLorebookId)?.description?.slice(0, 50) || 'No description'}</div>
                    </div>
                  ) : (
                    <span className="font-medium">+ New Lorebook</span>
                  )}
                  <svg className={`w-4 h-4 transition-transform flex-shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {isDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)}></div>
                    <div className="absolute top-full left-0 right-0 mt-1 bg-secondary-bg/95 backdrop-blur-md border border-color/50 rounded-lg shadow-2xl max-h-64 overflow-y-auto z-20">
                      <button
                        onClick={() => {
                          handleNewLorebook();
                          setIsDropdownOpen(false);
                        }}
                        className="w-full p-3 text-left hover:bg-tertiary-bg border-b border-color font-medium text-accent-primary"
                      >
                        + New Lorebook
                      </button>
                      {lorebooks.map(book => (
                        <button
                          key={book.id}
                          onClick={() => {
                            handleSelectLorebook(book.id);
                            setIsDropdownOpen(false);
                          }}
                          className={`w-full p-3 text-left hover:bg-tertiary-bg border-b border-color last:border-b-0 ${selectedLorebookId === book.id ? 'bg-tertiary-bg' : ''}`}
                        >
                          <div className="font-medium truncate">{book.name || 'Untitled Lorebook'}</div>
                          <div className="text-xs text-text-secondary line-clamp-2">{book.description || 'No description'}</div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
        </div>
        
        <div className="flex-1 flex min-h-0">
            {/* Sidebar - hidden on small screens */}
            <aside className="hidden md:flex w-1/3 border-r border-color flex-col">
                <div className="p-2 sm:p-3">
                    <button onClick={handleNewLorebook} className="w-full flex items-center justify-center gap-1.5 sm:gap-2 px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-semibold new-chat-btn rounded-lg transition-colors">
                        <PlusIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4"/>
                        New Lorebook
                    </button>
                </div>
                <nav className="flex-1 overflow-y-auto p-1 sm:p-3 space-y-1">
                    {lorebooks.map(book => (
                        <button 
                            key={book.id}
                            onClick={() => handleSelectLorebook(book.id)}
                            className={`block w-full text-left truncate px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm rounded-lg transition-colors list-item ${selectedLorebookId === book.id ? 'list-item-active' : ''}`}
                        >
                            {book.name || 'Untitled Lorebook'}
                        </button>
                    ))}
                    <div ref={loaderRef} className="h-5 flex justify-center items-center">
                        {hasMore && <LoaderIcon className="w-5 h-5" />}
                    </div>
                </nav>
            </aside>
            {/* Main content - full width on small screens */}
            <main className="flex-1 w-full md:w-2/3 p-3 sm:p-6 overflow-y-auto space-y-3 sm:space-y-6">
                <div className="p-3 sm:p-4 border border-accent-primary/20 rounded-lg bg-accent-primary/10 space-y-2 sm:space-y-3">
                    <h3 className="text-base sm:text-lg font-semibold text-accent-primary flex items-center gap-2">
                        <SparklesIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                        Create with AI
                    </h3>
                    <p className="text-xs sm:text-sm text-text-secondary">
                        Describe a world concept, and Gemini will write the full lorebook for you, including entries.
                    </p>
                    <textarea 
                        value={aiConcept}
                        onChange={(e) => setAiConcept(e.target.value)}
                        placeholder="e.g., An underwater kingdom ruled by giant squid mages."
                        rows={2}
                        className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 text-sm modal-input"
                        disabled={isGenerating}
                    />
                    {generationError && <p className="text-sm text-red-500">{generationError}</p>}
                    <button 
                        onClick={handleGenerate} 
                        disabled={isGenerating || !aiConcept.trim()}
                        className="w-full flex items-center justify-center gap-1.5 sm:gap-2 px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-semibold new-chat-btn rounded-lg transition-colors disabled:opacity-50"
                    >
                        <span className="hidden sm:inline">{isGenerating ? 'Generating...' : 'Generate Lorebook'}</span>
                        <span className="sm:hidden">{isGenerating ? 'Gen...' : 'Generate'}</span>
                    </button>
                 </div>
                 
                 <div className="border-t border-color my-2"></div>

                 <h3 className="text-lg sm:text-xl font-bold">{selectedLorebookId ? "Edit Lorebook" : "Create New Lorebook"}</h3>
                 
                 <>
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium mb-1">Lorebook Name</label>
                        <input type="text" id="name" name="name" value={formData.name} onChange={handleFormChange} placeholder="e.g., World of Eldoria" className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 text-sm modal-input" />
                    </div>
                     <div>
                        <label htmlFor="description" className="block text-sm font-medium mb-1">Description</label>
                        <textarea id="description" name="description" value={formData.description} onChange={handleFormChange} placeholder="Information about the main kingdoms, magic system, and key historical events." rows={2} className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 text-sm modal-input" />
                    </div>

                     <div className="space-y-3 sm:space-y-4">
                        <h4 className="text-base sm:text-lg font-semibold">Entries</h4>
                        {formData.entries.map((entry, index) => (
                            <div key={entry.id} className="p-3 sm:p-4 border border-color rounded-lg space-y-2 sm:space-y-3 relative">
                                <button onClick={() => handleRemoveEntry(entry.id)} className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500"><TrashIcon className="w-4 h-4" /></button>
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1">Keywords</label>
                                    <TagInput
                                      keywords={entry.keywords}
                                      onKeywordsChange={(newKeywords) => handleEntryChange(entry.id, 'keywords', newKeywords)}
                                    />
                                </div>
                                 <div>
                                    <label htmlFor={`content-${index}`} className="block text-xs font-medium text-text-secondary mb-1">Content</label>
                                    <textarea 
                                        id={`content-${index}`}
                                        value={entry.content}
                                        onChange={(e) => handleEntryChange(entry.id, 'content', e.target.value)}
                                        rows={4}
                                        placeholder="King Thror rules the kingdom under the mountain..."
                                        className="w-full p-2 border rounded-lg text-sm modal-input" />
                                </div>
                            </div>
                        ))}
                        <button onClick={handleAddEntry} className="w-full flex items-center justify-center gap-1.5 sm:gap-2 px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-semibold text-accent-primary bg-accent-primary/10 rounded-lg hover:bg-accent-primary/20 transition-colors">
                            <PlusIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Add Entry
                        </button>
                     </div>
                 </>
            </main>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-between items-stretch sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 mt-auto border-t border-color modal-footer-bg rounded-b-2xl">
          <div className="order-2 sm:order-1">
            {selectedLorebookId && (
                <button onClick={handleDelete} className="w-full sm:w-auto px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 flex items-center justify-center gap-2">
                    <TrashIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Delete
                </button>
            )}
          </div>
          <div className="flex gap-2 sm:gap-4 order-1 sm:order-2">
              <button onClick={onClose} className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg focus:outline-none btn-secondary">
                Close
              </button>
              <button onClick={handleSave} disabled={!formData.name.trim()} className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium new-chat-btn rounded-lg focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed">
                Save Lorebook
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};
// Fix: Add a default export to make the component compatible with React.lazy().
export default LorebooksModal;