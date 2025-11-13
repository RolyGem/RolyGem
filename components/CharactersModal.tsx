import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Character, CharacterArc, StoryArcLevel } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { XIcon } from './icons/XIcon';
import { LoaderIcon } from './icons/LoaderIcon';
import { UploadIcon } from './icons/UploadIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { ImageIcon } from './icons/ImageIcon';
import { generateCharacterSheet, generateCharacterStoryArcs, generateCharacterGroup } from '../services/aiService';
import { convertImageToWebP } from '../services/imageUtils';
import { generateUUID } from '../utils/uuid';
import { useNotifications } from '../contexts/NotificationContext';

interface CharactersModalProps {
  isOpen: boolean;
  onClose: () => void;
  characters: Character[];
  onSave: (character: Character) => void;
  onDelete: (id: string) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  onOpen: () => void;
  // New: Pass world levels to the modal for consistent AI generation.
  worldLevels: StoryArcLevel[];
}

const EMPTY_CHARACTER: Omit<Character, 'id' | 'createdAt' | 'events'> = {
  name: '',
  description: '',
  exampleDialogue: '',
  authorNote: '',
  visualPrompt: '',
  characterArcs: [],
};

const FormInput: React.FC<{ label: string; name: keyof Omit<Character, 'id' | 'createdAt' | 'events' | 'characterArcs'>; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void; placeholder?: string; isTextArea?: boolean; rows?: number }> = ({ label, name, value, onChange, placeholder, isTextArea, rows }) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium mb-1">{label}</label>
        {isTextArea ? (
            <textarea 
                id={name} 
                name={name} 
                value={value} 
                onChange={(e) => {
                    onChange(e);
                    e.target.style.height = 'auto';
                    const newHeight = Math.min(e.target.scrollHeight, 300);
                    e.target.style.height = newHeight + 'px';
                }} 
                onFocus={(e) => {
                    e.target.style.height = 'auto';
                    const newHeight = Math.min(e.target.scrollHeight, 300);
                    e.target.style.height = newHeight + 'px';
                }}
                ref={(el) => {
                    if (el) {
                        el.style.height = 'auto';
                        const newHeight = Math.min(el.scrollHeight, 300);
                        el.style.height = newHeight + 'px';
                    }
                }}
                placeholder={placeholder} 
                rows={rows} 
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 text-sm modal-input resize-none min-h-[80px] max-h-[300px] overflow-y-auto" 
            />
        ) : (
            <input type="text" id={name} name={name} value={value} onChange={onChange} placeholder={placeholder} className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 text-sm modal-input" />
        )}
    </div>
);


export const CharactersModal: React.FC<CharactersModalProps> = ({ isOpen, onClose, characters, onSave, onDelete, hasMore, onLoadMore, onOpen, worldLevels }) => {
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_CHARACTER);
  
  const [aiConcept, setAiConcept] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  
  // New states for Character Arc AI generation
  const [arcConcept, setArcConcept] = useState('');
  const [isGeneratingArcs, setIsGeneratingArcs] = useState(false);
  const [arcGenerationError, setArcGenerationError] = useState<string | null>(null);

  // New states for Group Generation
  const [groupConcept, setGroupConcept] = useState('');
  const [numCharacters, setNumCharacters] = useState(3);
  const [isGeneratingGroup, setIsGeneratingGroup] = useState(false);
  const [groupGenerationError, setGroupGenerationError] = useState<string | null>(null);
  const { addNotification } = useNotifications();


  const loaderRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Local-only avatar store (UI only; does not affect injection logic)
  const AVATAR_STORAGE_KEY = 'characterAvatars';
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  
  // Temporary avatar preview (before save)
  const [tempAvatar, setTempAvatar] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  
  // Memoized selected character to avoid repeated find() calls
  const selectedCharacter = useMemo(() => {
    return selectedCharacterId ? characters.find(c => c.id === selectedCharacterId) : null;
  }, [selectedCharacterId, characters]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(AVATAR_STORAGE_KEY);
      if (stored) setAvatars(JSON.parse(stored));
    } catch (e) {
      // ignore malformed data
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(avatars));
    } catch (e) {
      // ignore storage errors
    }
  }, [avatars]);

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
    if (selectedCharacterId) {
        const char = characters.find(c => c.id === selectedCharacterId);
        if (char) {
            setFormData({ 
              name: char.name, 
              description: char.description, 
              exampleDialogue: char.exampleDialogue,
              authorNote: char.authorNote,
              visualPrompt: char.visualPrompt || '',
              characterArcs: char.characterArcs || [],
            });
            // Reset arc concept when switching characters
            setArcConcept('');
        }
    } else {
        setFormData(EMPTY_CHARACTER);
    }
  }, [selectedCharacterId, characters]);

  const handleTriggerImport = () => {
    importInputRef.current?.click();
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      // Basic validation
      if (!json || typeof json !== 'object' || typeof json.name !== 'string') {
        throw new Error('Invalid character JSON: missing required name field.');
      }

      const newCharacter: Character = {
        id: generateUUID(),
        createdAt: Date.now(),
        name: json.name || '',
        description: json.description || '',
        exampleDialogue: json.exampleDialogue || '',
        authorNote: json.authorNote || '',
        visualPrompt: json.visualPrompt || '',
        characterArcs: Array.isArray(json.characterArcs) ? json.characterArcs : [],
        events: '',
        imageUrl: typeof json.imageUrl === 'string' ? json.imageUrl : undefined,
      };

      await onSave(newCharacter);
      setSelectedCharacterId(newCharacter.id);

      if (json.imageUrl && typeof json.imageUrl === 'string') {
        setAvatars(prev => ({ ...prev, [newCharacter.id]: json.imageUrl }));
      }

      addNotification({ title: 'Imported', message: `Character "${newCharacter.name || 'Untitled'}" imported successfully.`, type: 'success' });
    } catch (err: any) {
      addNotification({ title: 'Import Failed', message: err?.message || 'Could not import character JSON.', type: 'error' });
    } finally {
      // reset input value so same file can be selected again
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const handleExportSelected = () => {
    if (!selectedCharacterId) return;
    const char = characters.find(c => c.id === selectedCharacterId);
    if (!char) return;

    const exportData = {
      name: char.name,
      description: char.description,
      exampleDialogue: char.exampleDialogue,
      authorNote: char.authorNote,
      visualPrompt: char.visualPrompt || '',
      characterArcs: char.characterArcs || [],
      imageUrl: char.imageUrl || avatars[char.id] || '',
    };

    try {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = (char.name || 'character').replace(/[^\p{L}\p{N}_\- ]/gu, '').trim() || 'character';
      a.href = url;
      a.download = `character_${safeName}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      addNotification({ title: 'Export Failed', message: 'Could not export character JSON.', type: 'error' });
    }
  };

  const handleTriggerAvatar = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploadingAvatar(true);
    
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const dataUrl = reader.result as string;
          // Compress to WebP for compact storage
          const webp = await convertImageToWebP(dataUrl, 0.85);
          
          if (selectedCharacterId) {
            // Character already exists, save immediately
            setAvatars(prev => ({ ...prev, [selectedCharacterId]: webp }));
            
            if (selectedCharacter) {
              const updated: Character = { ...selectedCharacter, imageUrl: webp };
              await onSave(updated);
            }
            
            addNotification({ title: 'Updated', message: 'Character picture updated.', type: 'success' });
          } else {
            // New character, store temporarily
            setTempAvatar(webp);
            addNotification({ title: 'Preview Ready', message: 'Picture will be saved when you save the character.', type: 'info' });
          }
        } finally {
          setIsUploadingAvatar(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (e) {
      addNotification({ title: 'Image Failed', message: 'Could not load image file.', type: 'error' });
      setIsUploadingAvatar(false);
    } finally {
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleAvatarRemove = () => {
    if (selectedCharacterId) {
      setAvatars(prev => {
        const copy = { ...prev };
        delete copy[selectedCharacterId];
        return copy;
      });
      if (selectedCharacter && selectedCharacter.imageUrl) {
        const updated: Character = { ...selectedCharacter };
        delete (updated as any).imageUrl;
        onSave(updated);
      }
    } else {
      // Remove temp avatar for new character
      setTempAvatar(null);
    }
  };

  const handleSelectCharacter = (id: string) => {
    setSelectedCharacterId(id);
  };

  const handleNewCharacter = () => {
    setSelectedCharacterId(null);
    setFormData(EMPTY_CHARACTER);
    setTempAvatar(null);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const animateFormData = useCallback(async (data: Omit<Character, 'id' | 'createdAt' | 'events' | 'characterArcs'>) => {
    const fields: (keyof typeof data)[] = ['name', 'description', 'exampleDialogue', 'authorNote', 'visualPrompt'];
    
    setFormData(EMPTY_CHARACTER);
    
    const type = (field: keyof typeof data, text: string): Promise<void> => {
        return new Promise(resolve => {
            let i = 0;
            const interval = setInterval(() => {
                if (i <= text.length) {
                    setFormData(prev => ({ ...prev, [field]: text.substring(0, i) }));
                    i++;
                } else {
                    clearInterval(interval);
                    resolve();
                }
            }, 10);
        });
    };

    for (const field of fields) {
        if (data[field]) {
            await type(field, data[field]);
        }
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!aiConcept.trim()) return;
    setIsGenerating(true);
    setGenerationError(null);
    handleNewCharacter();

    try {
        const characterData = await generateCharacterSheet(aiConcept);
        await animateFormData(characterData);
    } catch (error: any) {
        setGenerationError(error.message || 'An unknown error occurred during generation.');
    } finally {
        setIsGenerating(false);
    }
  }, [aiConcept, animateFormData]);

    const handleGenerateArcs = useCallback(async () => {
        if (!arcConcept.trim() || !selectedCharacterId) return;
        const character = characters.find(c => c.id === selectedCharacterId);
        if (!character) return;

        setIsGeneratingArcs(true);
        setArcGenerationError(null);

        try {
            const generatedArcs = await generateCharacterStoryArcs(character, worldLevels, arcConcept);
            setFormData(prev => ({ ...prev, characterArcs: generatedArcs }));
        } catch (error: any) {
            setArcGenerationError(error.message || 'An unknown error occurred.');
        } finally {
            setIsGeneratingArcs(false);
        }
    }, [arcConcept, selectedCharacterId, characters, worldLevels]);

  const handleGenerateGroup = useCallback(async () => {
    if (!groupConcept.trim()) return;
    setIsGeneratingGroup(true);
    setGroupGenerationError(null);
    addNotification({ title: "Group Generation Started", message: `Generating ${numCharacters} interconnected characters...`, type: 'info' });

    try {
        const charactersData = await generateCharacterGroup(groupConcept, numCharacters);
        if (!charactersData || charactersData.length === 0) {
            throw new Error("AI did not return any character data.");
        }
        
        const newCharacterIds: string[] = [];
        for (const charData of charactersData) {
            const newCharacter: Character = {
                id: generateUUID(),
                createdAt: Date.now(),
                ...charData,
                events: '', // Initialize events
            };
            await onSave(newCharacter);
            newCharacterIds.push(newCharacter.id);
        }

        addNotification({ title: "Success", message: `${charactersData.length} characters created!`, type: 'success' });

        if (newCharacterIds.length > 0) {
            setSelectedCharacterId(newCharacterIds[0]);
        }

    } catch (error: any) {
        const errorMessage = error.message || 'An unknown error occurred during group generation.';
        setGroupGenerationError(errorMessage);
        addNotification({ title: "Generation Failed", message: errorMessage, type: 'error' });
    } finally {
        setIsGeneratingGroup(false);
    }
  }, [groupConcept, numCharacters, onSave, addNotification]);

  const handleSave = () => {
    if (!formData.name.trim()) {
        alert("Character name cannot be empty.");
        return;
    }
    const characterId = selectedCharacterId || generateUUID();
    const characterData: Character = {
        id: characterId,
        createdAt: selectedCharacter?.createdAt || Date.now(),
        events: selectedCharacter?.events || '',
        imageUrl: selectedCharacterId 
          ? (avatars[selectedCharacterId] || selectedCharacter?.imageUrl) 
          : (tempAvatar || undefined),
        ...formData,
    };
    onSave(characterData);
    if (!selectedCharacterId) {
        setSelectedCharacterId(characterId);
        // Save temp avatar to permanent storage
        if (tempAvatar) {
          setAvatars(prev => ({ ...prev, [characterId]: tempAvatar }));
          setTempAvatar(null);
        }
    }
  };

  const handleDelete = () => {
    if (selectedCharacterId && window.confirm("Are you sure you want to delete this character? This will also remove them from any conversations they're in.")) {
        onDelete(selectedCharacterId);
        setSelectedCharacterId(null);
        setFormData(EMPTY_CHARACTER);
    }
  };
  
  const handleArcChange = (arcId: string, field: keyof Omit<CharacterArc, 'id'>, value: string | number) => {
    setFormData(prev => ({
        ...prev,
        characterArcs: (prev.characterArcs || []).map(arc => 
            arc.id === arcId ? { ...arc, [field]: value } : arc
        )
    }));
  };

  const handleAddArc = () => {
    const newArc: CharacterArc = {
        id: generateUUID(),
        startsAtLevel: (formData.characterArcs?.length || 0) > 0 ? Math.max(...formData.characterArcs!.map(a => a.startsAtLevel)) + 1 : 1,
        description: '',
        exampleDialogue: '',
        authorNote: '',
    };
    setFormData(prev => ({
        ...prev,
        characterArcs: [...(prev.characterArcs || []), newArc]
    }));
  };

  const handleRemoveArc = (arcId: string) => {
    setFormData(prev => ({
        ...prev,
        characterArcs: (prev.characterArcs || []).filter(arc => arc.id !== arcId)
    }));
  };

  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center transition-opacity"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="characters-title"
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
              <h2 id="characters-title" className="text-lg sm:text-2xl font-bold">Character Room</h2>
              
              {/* Import/Export buttons - always visible with text */}
              <div className="flex items-center gap-2 flex-wrap">
                <input ref={importInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFileChange} aria-label="Import character file" />
                <button onClick={handleTriggerImport} className="px-3 py-2 text-sm font-medium rounded-md btn-secondary flex items-center gap-2" aria-label="Import character from JSON">
                  <UploadIcon className="w-4 h-4" />
                  <span>Import</span>
                </button>
                <button onClick={handleExportSelected} disabled={!selectedCharacterId} className="px-3 py-2 text-sm font-medium rounded-md new-chat-btn disabled:opacity-50 flex items-center gap-2" aria-label="Export selected character">
                  <DownloadIcon className="w-4 h-4" />
                  <span>Export</span>
                </button>
              </div>
              
              {/* Custom Dropdown for small screens */}
              <div className="md:hidden w-full relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape' && isDropdownOpen) {
                      setIsDropdownOpen(false);
                    }
                  }}
                  className="w-full p-2 border rounded-lg modal-input text-sm flex items-center justify-between gap-2"
                  aria-label="Select character"
                  aria-expanded={isDropdownOpen}
                  aria-haspopup="listbox"
                >
                  {selectedCharacter ? (
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-tertiary-bg flex items-center justify-center flex-shrink-0">
                        {avatars[selectedCharacter.id] || selectedCharacter.imageUrl ? (
                          <img src={avatars[selectedCharacter.id] || selectedCharacter.imageUrl} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs text-text-secondary font-medium">
                            {(selectedCharacter.name || 'U').trim().slice(0,1).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <div className="truncate font-medium">{selectedCharacter.name || 'Untitled'}</div>
                        <div className="truncate text-xs text-text-secondary">{selectedCharacter.description?.slice(0, 40) || ''}</div>
                      </div>
                    </div>
                  ) : (
                    <span className="font-medium">+ New Character</span>
                  )}
                  <svg className={`w-4 h-4 transition-transform flex-shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {isDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setIsDropdownOpen(false)}
                      onKeyDown={(e) => e.key === 'Escape' && setIsDropdownOpen(false)}
                      tabIndex={-1}
                      aria-hidden="true"
                    ></div>
                    <div 
                      className="absolute top-full left-0 right-0 mt-1 bg-secondary-bg/95 backdrop-blur-md border border-color/50 rounded-lg shadow-2xl max-h-64 overflow-y-auto z-20"
                      role="listbox"
                      aria-label="Character list"
                    >
                      <button
                        onClick={() => {
                          handleNewCharacter();
                          setIsDropdownOpen(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleNewCharacter();
                            setIsDropdownOpen(false);
                          }
                        }}
                        className="w-full p-3 text-left hover:bg-tertiary-bg border-b border-color font-medium text-accent-primary"
                        role="option"
                        aria-selected={!selectedCharacterId}
                      >
                        + New Character
                      </button>
                      {characters.map(char => (
                        <button
                          key={char.id}
                          onClick={() => {
                            handleSelectCharacter(char.id);
                            setIsDropdownOpen(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleSelectCharacter(char.id);
                              setIsDropdownOpen(false);
                            }
                          }}
                          className={`w-full p-3 text-left hover:bg-tertiary-bg border-b border-color last:border-b-0 ${selectedCharacterId === char.id ? 'bg-tertiary-bg' : ''}`}
                          role="option"
                          aria-selected={selectedCharacterId === char.id}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-tertiary-bg flex items-center justify-center flex-shrink-0">
                              {avatars[char.id] || char.imageUrl ? (
                                <img src={avatars[char.id] || char.imageUrl} alt={char.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-xs text-text-secondary font-medium">
                                  {(char.name || 'U').trim().slice(0,1).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium truncate">{char.name || 'Untitled Character'}</div>
                              <div className="text-xs text-text-secondary line-clamp-2">{char.description || char.visualPrompt || 'No description'}</div>
                            </div>
                          </div>
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
                    <button onClick={handleNewCharacter} className="w-full flex items-center justify-center gap-1.5 sm:gap-2 px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-semibold new-chat-btn rounded-lg transition-colors">
                        <PlusIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4"/>
                        <span className="hidden sm:inline">New Character</span>
                        <span className="sm:hidden">New</span>
                    </button>
                </div>
                <nav className="flex-1 overflow-y-auto p-1 sm:p-3 space-y-1">
                    {characters.map(char => (
                        <button 
                            key={char.id}
                            onClick={() => handleSelectCharacter(char.id)}
                            className={`block w-full text-left px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg transition-colors list-item ${selectedCharacterId === char.id ? 'list-item-active' : ''}`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-tertiary-bg flex items-center justify-center flex-shrink-0">
                              {avatars[char.id] || char.imageUrl ? (
                                <img src={avatars[char.id] || char.imageUrl} alt={char.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[11px] text-text-secondary font-medium">
                                  {(char.name || 'U').trim().slice(0,1).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs sm:text-sm font-medium">{char.name || 'Untitled Character'}</div>
                              <div className="truncate text-[11px] text-text-secondary">{char.description || char.visualPrompt || ''}</div>
                            </div>
                          </div>
                        </button>
                    ))}
                    <div ref={loaderRef} className="h-5 flex justify-center items-center">
                        {hasMore && <LoaderIcon className="w-5 h-5" />}
                    </div>
                </nav>
            </aside>
            {/* Main content - full width on small screens */}
            <main className="flex-1 w-full md:w-2/3 p-3 sm:p-6 overflow-y-auto space-y-3 sm:space-y-4">
                 <div className="p-3 sm:p-4 border border-accent-primary/20 rounded-lg bg-accent-primary/10 space-y-2 sm:space-y-3">
                    <h3 className="text-base sm:text-lg font-semibold text-accent-primary flex items-center gap-2">
                        <SparklesIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                        Create with AI
                    </h3>
                    <p className="text-xs sm:text-sm text-text-secondary">
                        Describe a character concept, and Gemini will write the full character sheet for you.
                    </p>
                    <textarea 
                        value={aiConcept}
                        onChange={(e) => setAiConcept(e.target.value)}
                        placeholder="e.g., A grumpy dwarf inventor who only speaks in rhymes and loves cabbages."
                        rows={2}
                        className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 text-sm modal-input"
                        disabled={isGenerating || isGeneratingGroup}
                    />
                    {generationError && <p className="text-sm text-red-500">{generationError}</p>}
                    <button 
                        onClick={handleGenerate} 
                        disabled={isGenerating || isGeneratingGroup || !aiConcept.trim()}
                        className="w-full flex items-center justify-center gap-1.5 sm:gap-2 px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-semibold new-chat-btn rounded-lg transition-colors disabled:opacity-50"
                        aria-label="Generate character with AI"
                    >
                        <span className="hidden sm:inline">{isGenerating ? 'Generating...' : 'Generate Character'}</span>
                        <span className="sm:hidden">{isGenerating ? 'Gen...' : 'Generate'}</span>
                    </button>
                 </div>
                 
                 <div className="p-3 sm:p-4 border border-accent-primary/20 rounded-lg bg-accent-primary/10 space-y-2 sm:space-y-3">
                    <h3 className="text-base sm:text-lg font-semibold text-accent-primary flex items-center gap-2">
                        <SparklesIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                        Create Group with AI
                    </h3>
                    <p className="text-xs sm:text-sm text-text-secondary">
                        Describe a group of interconnected characters. Gemini will generate all of them at once.
                    </p>
                    <textarea 
                        value={groupConcept}
                        onChange={(e) => setGroupConcept(e.target.value)}
                        placeholder="e.g., A family of three: a stoic father who is a retired soldier, a cheerful mother who is a botanist, and their rebellious teenage daughter who has secret magic powers."
                        rows={3}
                        className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 text-sm modal-input"
                        disabled={isGenerating || isGeneratingGroup}
                    />
                    <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-4">
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-text-secondary mb-1">Number of Characters</label>
                            <input type="number" value={numCharacters} onChange={e => setNumCharacters(Math.max(2, Number(e.target.value)))} min="2" max="10" className="w-full sm:w-24 p-2 border rounded-md modal-input text-sm" disabled={isGenerating || isGeneratingGroup} />
                        </div>
                        <button 
                            onClick={handleGenerateGroup} 
                            disabled={isGenerating || isGeneratingGroup || !groupConcept.trim()}
                            className="w-full sm:w-auto px-3 py-2 sm:px-4 sm:py-2 flex-shrink-0 text-xs sm:text-sm font-semibold new-chat-btn rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 sm:gap-2"
                            aria-label="Generate character group with AI"
                        >
                            {isGeneratingGroup ? <LoaderIcon className="w-4 h-4 sm:w-5 sm:h-5"/> : <SparklesIcon className="w-4 h-4 sm:w-5 sm:h-5" />}
                            {isGeneratingGroup ? 'Generating...' : 'Generate Group'}
                        </button>
                    </div>
                    {groupGenerationError && <p className="text-sm text-red-500">{groupGenerationError}</p>}
                </div>

                 <div className="border-t border-color my-6"></div>

                 <h3 className="text-lg sm:text-xl font-bold">{selectedCharacterId ? "Edit Character" : "New Character"}</h3>
                 
                 {/* Character Name */}
                 <FormInput label="Name" name="name" value={formData.name} onChange={handleFormChange} placeholder="e.g., Captain Jack" />
                 
                 {/* Character Picture Section */}
                 <div className="flex items-start gap-4 p-3 sm:p-4 border rounded-lg border-color bg-secondary-bg">
                   <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-tertiary-bg flex items-center justify-center flex-shrink-0 relative">
                     {isUploadingAvatar ? (
                       <LoaderIcon className="w-8 h-8 text-accent-primary animate-spin" />
                     ) : (selectedCharacterId && (avatars[selectedCharacterId] || selectedCharacter?.imageUrl)) || tempAvatar ? (
                       <img src={tempAvatar || avatars[selectedCharacterId!] || selectedCharacter!.imageUrl} alt="Character avatar" className="w-full h-full object-cover" />
                     ) : (
                       <ImageIcon className="w-8 h-8 text-text-secondary" />
                     )}
                   </div>
                   <div className="flex-1 flex flex-col gap-2">
                     <p className="text-sm text-text-secondary">Character Picture</p>
                     <div className="flex flex-wrap gap-2">
                       <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} aria-label="Upload character picture" />
                       <button 
                         onClick={handleTriggerAvatar} 
                         disabled={isUploadingAvatar}
                         className="px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md btn-secondary disabled:opacity-50 flex items-center gap-1.5"
                         aria-label="Set character picture"
                       >
                         {isUploadingAvatar ? <LoaderIcon className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                         <span>{isUploadingAvatar ? 'Uploading...' : 'Set Picture'}</span>
                       </button>
                       {((selectedCharacterId && (avatars[selectedCharacterId] || selectedCharacter?.imageUrl)) || tempAvatar) && (
                         <button 
                           onClick={handleAvatarRemove} 
                           className="px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 flex items-center gap-1.5"
                           aria-label="Remove character picture"
                         >
                           <TrashIcon className="w-4 h-4" />
                           <span>Remove</span>
                         </button>
                       )}
                     </div>
                     {tempAvatar && !selectedCharacterId && <p className="text-xs text-amber-600 dark:text-amber-400">Preview ready - save character to keep this picture</p>}
                   </div>
                 </div>
                 
                 <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 border rounded-lg border-color bg-secondary-bg">
                    <h4 className="text-sm sm:text-base font-semibold">Base Definition (Normal Mode)</h4>
                    <FormInput label="Description" name="description" value={formData.description} onChange={handleFormChange} placeholder="A witty and resourceful pirate captain..." isTextArea rows={4} />
                    <FormInput label="Example Dialogue" name="exampleDialogue" value={formData.exampleDialogue} onChange={handleFormChange} placeholder={'<START>\n{{user}}: "What are you doing?"\n{{char}}: "Looking for adventure."\n<END>'} isTextArea rows={6} />
                    <FormInput label="Author's Note (Private)" name="authorNote" value={formData.authorNote} onChange={handleFormChange} placeholder="Always portray him as charming but untrustworthy..." isTextArea rows={2} />
                 </div>

                 <FormInput label="Visual Prompt (Image Generation)" name="visualPrompt" value={formData.visualPrompt || ''} onChange={handleFormChange} placeholder="masterpiece, best quality, 1girl, solo, Mira..." isTextArea rows={4} />

                <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 border rounded-lg border-color bg-secondary-bg">
                    <h4 className="text-sm sm:text-base font-semibold">Character Arcs (Story Mode)</h4>
                    <p className="text-xs text-text-secondary -mt-3">Define how this character evolves as the story progresses through levels.</p>
                    
                     <div className="p-3 border border-accent-primary/20 rounded-lg bg-accent-primary/10 space-y-2">
                        <h3 className="text-md font-semibold text-accent-primary flex items-center gap-2">
                            <SparklesIcon className="w-4 h-4" />
                            Generate Arcs with AI
                        </h3>
                         <textarea 
                            value={arcConcept}
                            onChange={(e) => setArcConcept(e.target.value)}
                            placeholder="e.g., She starts as a naive farm girl, but after the events of level 3, she becomes a cynical and hardened warrior."
                            rows={2}
                            className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 text-sm modal-input"
                            disabled={isGeneratingArcs || !selectedCharacterId}
                        />
                         {arcGenerationError && <p className="text-sm text-red-500">{arcGenerationError}</p>}
                        <button 
                            onClick={handleGenerateArcs} 
                            disabled={isGeneratingArcs || !arcConcept.trim() || !selectedCharacterId || worldLevels.length === 0}
                            className="w-full flex items-center justify-center gap-1.5 sm:gap-2 px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-semibold new-chat-btn rounded-lg transition-colors disabled:opacity-50"
                            aria-label="Generate character arcs with AI"
                        >
                            {isGeneratingArcs ? <LoaderIcon className="w-4 h-4 sm:w-5 sm:h-5"/> : <SparklesIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4"/>}
                            <span className="hidden sm:inline">{isGeneratingArcs ? 'Generating...' : 'Generate Character Arcs'}</span>
                            <span className="sm:hidden">{isGeneratingArcs ? 'Gen...' : 'Gen Arcs'}</span>
                        </button>
                         {!selectedCharacterId && <p className="text-xs text-text-secondary text-center">Save the character first to enable AI arc generation.</p>}
                         {selectedCharacterId && worldLevels.length === 0 && <p className="text-xs text-text-secondary text-center">Define world levels in Settings &gt; Story Arcs first.</p>}
                     </div>

                    {(formData.characterArcs || []).map((arc) => (
                        <div key={arc.id} className="p-3 border border-color rounded-md space-y-2 relative bg-primary-bg">
                             <button onClick={() => handleRemoveArc(arc.id)} className="absolute top-2 right-2 p-1 text-text-secondary hover:text-red-500" aria-label="Remove arc"><TrashIcon className="w-4 h-4" /></button>
                             <div>
                                <label className="block text-xs font-medium text-text-secondary mb-1">Starts at Level</label>
                                <input type="number" value={arc.startsAtLevel} onChange={e => handleArcChange(arc.id, 'startsAtLevel', Number(e.target.value))} className="w-24 p-1 border rounded-md modal-input text-sm" />
                             </div>
                             <textarea value={arc.description} onChange={e => handleArcChange(arc.id, 'description', e.target.value)} placeholder="Description for this arc..." rows={3} className="w-full p-2 border rounded-lg text-sm modal-input" />
                             <textarea value={arc.exampleDialogue} onChange={e => handleArcChange(arc.id, 'exampleDialogue', e.target.value)} placeholder="Example dialogue for this arc..." rows={3} className="w-full p-2 border rounded-lg text-sm modal-input" />
                             <textarea value={arc.authorNote} onChange={e => handleArcChange(arc.id, 'authorNote', e.target.value)} placeholder="Author's Note for this arc..." rows={2} className="w-full p-2 border rounded-lg text-sm modal-input" />
                        </div>
                    ))}
                    <button onClick={handleAddArc} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-accent-primary bg-accent-primary/10 rounded-lg hover:bg-accent-primary/20 transition-colors" aria-label="Add character arc">
                        <PlusIcon className="w-4 h-4" /> Add Character Arc
                    </button>
                </div>


                 {selectedCharacter && (
                    <div className="border-t border-color pt-4">
                        <label htmlFor="events" className="block text-sm font-medium mb-1">Event Log</label>
                        <textarea id="events" name="events" value={selectedCharacter.events || 'No events logged.'} readOnly rows={5} className="w-full p-2 border rounded-lg focus:outline-none text-xs modal-input bg-tertiary-bg/30 text-text-secondary whitespace-pre-wrap" />
                    </div>
                 )}
            </main>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-between items-stretch sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 mt-auto border-t border-color modal-footer-bg rounded-b-2xl">
          <div className="order-2 sm:order-1">
            {selectedCharacterId && (
                <button onClick={handleDelete} className="w-full sm:w-auto px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 flex items-center justify-center gap-2" aria-label="Delete character">
                    <TrashIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Delete
                </button>
            )}
          </div>
          <div className="flex gap-2 sm:gap-4 order-1 sm:order-2">
              <button onClick={onClose} className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg focus:outline-none btn-secondary" aria-label="Close character editor">
                Close
              </button>
              <button onClick={handleSave} disabled={!formData.name.trim()} className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium new-chat-btn rounded-lg focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Save character">
                Save Character
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CharactersModal;
