import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import type { Conversation, RagMemory, RagMemoryTag, ConversationState, CharacterState, WorldState, Settings, Character } from '../types';
import { getAllMemories, deleteMemories, addMemory } from '../services/ragService';
import { generateEmbedding } from '../services/koboldcppService';
import { XIcon } from './icons/XIcon';
import { TrashIcon } from './icons/TrashIcon';
import { PlusIcon } from './icons/PlusIcon';
import { LoaderIcon } from './icons/LoaderIcon';
import { SaveIcon } from './icons/SaveIcon';
import { SegmentedControl } from './settings/common/SettingsInputComponents';
import { getAllCharacters } from '../services/db';
const MemoryGraphView = lazy(() => import('./MemoryGraphView'));


interface MemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation | null;
  settings: Settings;
  onConversationUpdate: (updatedConversation: Conversation) => void;
}

const TagPill: React.FC<{ tag: RagMemoryTag }> = ({ tag }) => {
  const colors: Record<string, string> = {
    character: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    location: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    event: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
    theme: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${colors[tag.type]}`}>
      {tag.value}
    </span>
  );
};

const MoodPill: React.FC<{ mood: string }> = ({ mood }) => (
    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
      {mood}
    </span>
);

export const MemoryModal: React.FC<MemoryModalProps> = ({
  isOpen,
  onClose,
  conversation,
  settings,
  onConversationUpdate
}) => {
  const [activeTab, setActiveTab] = useState<'rag' | 'state'>('rag');
  const [ragView, setRagView] = useState<'list' | 'graph'>('list');
  const [memories, setMemories] = useState<RagMemory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newMemoryText, setNewMemoryText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [expandedMemories, setExpandedMemories] = useState<Set<string>>(new Set());
  
  // State for editable conscious state
  const [editableState, setEditableState] = useState<ConversationState | null>(null);
  // Characters for display of IDs and names
  const [allCharacters, setAllCharacters] = useState<Character[]>([]);

  useEffect(() => {
    if (isOpen) {
        setEditableState(conversation?.consciousState ?? null);
    }
  }, [isOpen, conversation?.consciousState]);

  // Load characters for name lookups when modal opens
  useEffect(() => {
    if (!isOpen) return;
    getAllCharacters().then(setAllCharacters).catch(() => setAllCharacters([]));
  }, [isOpen]);

  const getCharName = useCallback((id?: string) => {
    if (!id) return '';
    const found = allCharacters.find(c => c.id === id);
    return found ? found.name : id;
  }, [allCharacters]);

  const fetchMemories = useCallback(async () => {
    if (!conversation?.ragCollectionName) {
      setMemories([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const fetchedMemories = await getAllMemories(conversation.ragCollectionName);
      // Graph view needs chronological, list needs reverse-chrono
      const sortedMemories = fetchedMemories.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      setMemories(sortedMemories);
    } catch (e: any) {
      setError(`Failed to load memories: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [conversation?.ragCollectionName]);

  useEffect(() => {
    if (isOpen && activeTab === 'rag') {
      setActiveFilters(new Set()); // Reset filters on open
      fetchMemories();
    }
  }, [isOpen, activeTab, fetchMemories]);

  const uniqueTagsAndMoods = useMemo(() => {
    const tagsByType: Record<string, Set<string>> = {
      character: new Set(),
      location: new Set(),
      event: new Set(),
      theme: new Set(),
    };
    const moods = new Set<string>();
    memories.forEach(memory => {
      (memory.tags || []).forEach(tag => {
        tagsByType[tag.type]?.add(tag.value);
      });
      if (memory.mood) {
        moods.add(memory.mood);
      }
    });
    return {
      characters: Array.from(tagsByType.character).sort(),
      locations: Array.from(tagsByType.location).sort(),
      events: Array.from(tagsByType.event).sort(),
      themes: Array.from(tagsByType.theme).sort(),
      moods: Array.from(moods).sort(),
    };
  }, [memories]);

  const filteredMemories = useMemo(() => {
    if (activeFilters.size === 0) return memories.slice().reverse(); // List view expects reverse-chrono
    const filtered = memories.filter(memory => {
      const memoryTags = new Set((memory.tags || []).map(t => `tag:${t.type}:${t.value}`));
      if(memory.mood) {
        memoryTags.add(`mood:${memory.mood}`);
      }
      return Array.from(activeFilters).every(filter => memoryTags.has(filter));
    });
    return filtered.slice().reverse(); // Reverse for display
  }, [memories, activeFilters]);

  // Deduplicate by grouping chunked memories (same sourceMessageIds)
  const dedupedMemories = useMemo(() => {
    const groups = new Map<string, RagMemory[]>();
    for (const mem of filteredMemories) {
      const key = (mem.sourceMessageIds && mem.sourceMessageIds.length > 0)
        ? `grp:${mem.sourceMessageIds.join('|')}`
        : `solo:${mem.id}`;
      const arr = groups.get(key);
      if (arr) arr.push(mem); else groups.set(key, [mem]);
    }
    const reps: RagMemory[] = [];
    groups.forEach(arr => {
      arr.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      reps.push(arr[0]);
    });
    return reps;
  }, [filteredMemories]);

  // Precompute group sizes to annotate UI with chunk counts
  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const mem of filteredMemories) {
      const key = (mem.sourceMessageIds && mem.sourceMessageIds.length > 0)
        ? `grp:${mem.sourceMessageIds.join('|')}`
        : `solo:${mem.id}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [filteredMemories]);

  const handleFilterToggle = (type: string, value: string, category: 'tag' | 'mood') => {
    const filterKey = `${category}:${type}:${value}`;
    setActiveFilters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(filterKey)) {
        newSet.delete(filterKey);
      } else {
        newSet.add(filterKey);
      }
      return newSet;
    });
  };

  const handleDeleteMemory = async (id: string) => {
    if (!conversation?.ragCollectionName || !window.confirm("Are you sure you want to delete this memory and all its related parts? This is irreversible.")) return;

    const clickedMemory = memories.find(mem => mem.id === id);
    let idsToDelete: string[] = [id]; // Default to deleting just the one

    // If the memory is part of a group, find all its siblings
    if (clickedMemory?.sourceMessageIds && clickedMemory.sourceMessageIds.length > 0) {
        const sourceIds = clickedMemory.sourceMessageIds;
        const siblingIds = memories
            .filter(mem => 
                mem.sourceMessageIds?.length === sourceIds.length &&
                mem.sourceMessageIds.every(sid => sourceIds.includes(sid))
            )
            .map(mem => mem.id);
        
        if (siblingIds.length > 0) {
            idsToDelete = siblingIds;
        }
    }

    try {
      await deleteMemories(conversation.ragCollectionName, idsToDelete);
      const idsToDeleteSet = new Set(idsToDelete);
      setMemories(prev => prev.filter(mem => !idsToDeleteSet.has(mem.id)));
    } catch (e: any) {
      setError(`Failed to delete memory group: ${e.message}`);
    }
  };

  const handleAddMemory = async () => {
    if (!newMemoryText.trim() || !conversation?.ragCollectionName || !settings.rag.isConnected) return;
    setIsAdding(true);
    setError(null);
    try {
      // @google/genai-codelab-user-troubleshooting: FIX: Pass the full `settings` object instead of an embedding function.
      await addMemory(
        conversation.ragCollectionName,
        newMemoryText.trim(),
        settings
      );
      setNewMemoryText('');
      await fetchMemories();
    } catch (e: any) {
      setError(`Failed to add memory: ${e.message}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleStateChange = (field: keyof ConversationState, value: any) => {
    setEditableState(prev => prev ? { ...prev, [field]: value } : null);
  };
  
  const handleCharacterStateChange = (charId: string, field: keyof Omit<CharacterState, 'characterId' | 'characterName'>, value: any) => {
      setEditableState(prev => {
          if (!prev) return null;
          return {
              ...prev,
              character_states: prev.character_states.map(charState => 
                  charState.characterId === charId ? { ...charState, [field]: value } : charState
              )
          };
      });
  };
  
  const handleWorldStateChange = (field: keyof WorldState, value: any) => {
      setEditableState(prev => {
          if (!prev) return null;
          return {
              ...prev,
              world_state: {
                  ...prev.world_state,
                  [field]: value
              }
          };
      });
  };

  const handleSaveState = () => {
    if (conversation) {
        onConversationUpdate({ ...conversation, consciousState: editableState });
        onClose(); // Close after saving to prevent stale data display
    }
  };

  const renderFilterSection = (title: string, type: string, tags: string[], category: 'tag' | 'mood') => {
    if (tags.length === 0) return null;
    return (
      <div>
        <h4 className="text-sm font-semibold mb-2">{title}</h4>
        <div className="flex flex-wrap gap-2">
          {tags.map(tag => {
            const filterKey = `${category}:${type}:${tag}`;
            const isActive = activeFilters.has(filterKey);
            return (
              <button
                key={filterKey}
                onClick={() => handleFilterToggle(type, tag, category)}
                className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${isActive ? 'bg-accent-primary text-accent-text' : 'bg-tertiary-bg hover:bg-tertiary-bg/70'}`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  const renderRagList = () => (
     <div className="flex-1 flex min-h-0">
        <aside className="w-1/3 border-r border-color p-4 overflow-y-auto space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Filters</h3>
                {activeFilters.size > 0 && (
                    <button onClick={() => setActiveFilters(new Set())} className="text-xs text-accent-primary hover:underline">Clear</button>
                )}
            </div>
            {renderFilterSection('Moods', 'mood', uniqueTagsAndMoods.moods, 'mood')}
            {renderFilterSection('Characters', 'character', uniqueTagsAndMoods.characters, 'tag')}
            {renderFilterSection('Locations', 'location', uniqueTagsAndMoods.locations, 'tag')}
            {renderFilterSection('Events', 'event', uniqueTagsAndMoods.events, 'tag')}
            {renderFilterSection('Themes', 'theme', uniqueTagsAndMoods.themes, 'tag')}
        </aside>
        <main className="w-2/3 p-6 overflow-y-auto flex-1">
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <LoaderIcon className="w-8 h-8 text-accent-primary" />
            </div>
          ) : dedupedMemories.length > 0 ? (
            <div className="space-y-3">
              {dedupedMemories.map((memory) => {
                const isExpanded = expandedMemories.has(memory.id);
                const hasDetails = memory.fullText && memory.fullText.length > 200;
                
                // Display sanitized facts if available, otherwise show summary
                const displayText = memory.sanitizedFacts && memory.sanitizedFacts.length > 0
                  ? memory.sanitizedFacts.join(' • ')
                  : (memory.summary || memory.fullText);
                const groupKey = (memory.sourceMessageIds && memory.sourceMessageIds.length > 0)
                  ? `grp:${memory.sourceMessageIds.join('|')}`
                  : `solo:${memory.id}`;
                const groupSize = groupCounts.get(groupKey) || 1;
                
                return (
                  <div key={memory.id} className="group p-3 bg-secondary-bg/50 rounded-lg space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {isExpanded ? memory.fullText : displayText}
                        </p>
                        {groupSize > 1 && (
                          <p className="mt-1 text-xs text-text-secondary">{groupSize} chunks</p>
                        )}
                        {hasDetails && (
                          <button
                            onClick={() => setExpandedMemories(prev => {
                              const newSet = new Set(prev);
                              if (newSet.has(memory.id)) {
                                newSet.delete(memory.id);
                              } else {
                                newSet.add(memory.id);
                              }
                              return newSet;
                            })}
                            className="text-xs text-accent-primary hover:underline mt-2"
                          >
                            {isExpanded ? 'Show summary' : 'Show full details'}
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteMemory(memory.id)}
                        className="p-1.5 text-text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Delete memory"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-dashed border-color">
                       {memory.mood && <MoodPill mood={memory.mood} />}
                       {(memory.tags || []).map(tag => <TagPill key={`${tag.type}:${tag.value}`} tag={tag} />)}
                  </div>
                   {memory.relations && memory.relations.length > 0 && (
                    <div className="pt-2 border-t border-dashed border-color">
                       <h5 className="text-xs font-semibold text-text-secondary mb-1">Relations:</h5>
                       <ul className="list-disc list-inside text-xs space-y-1">
                        {memory.relations.map((rel, index) => (
                            <li key={index}>
                                <span className="font-semibold">{rel.subject}</span> {rel.predicate} <span className="font-semibold">{rel.object}</span>
                            </li>
                        ))}
                       </ul>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 text-text-secondary">
              <p>{activeFilters.size > 0 ? 'No memories match your selected filters.' : 'No memories found for this conversation yet.'}</p>
              <p className="text-xs mt-1">Memories are added automatically as you chat when RAG is enabled.</p>
            </div>
          )}
        </main>
      </div>
  );

  const renderRagTab = () => (
    <>
      <div className="p-3 border-b border-color">
        <SegmentedControl
            name="ragView"
            value={ragView}
            onChange={(e) => setRagView(e.target.value as 'list' | 'graph')}
            options={[
                { label: 'List', value: 'list' },
                { label: 'Graph', value: 'graph' },
            ]}
        />
      </div>
      {ragView === 'list' ? (
        renderRagList()
      ) : (
         <div className="flex-1 min-h-0">
          <Suspense fallback={<div className="flex items-center justify-center h-full"><LoaderIcon className="w-8 h-8"/></div>}>
              <MemoryGraphView memories={memories} />
          </Suspense>
         </div>
      )}

      <div className="p-4 border-t border-color modal-footer-bg">
        <div className="flex items-start gap-3">
          <textarea
            value={newMemoryText}
            onChange={(e) => setNewMemoryText(e.target.value)}
            placeholder={settings.rag.isConnected ? "Add a new memory manually..." : "Connect to RAG in settings to add memories."}
            rows={2}
            className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 text-sm disabled:opacity-50 modal-input"
            disabled={!settings.rag.isConnected || isAdding}
          />
          <button
            onClick={handleAddMemory}
            disabled={!newMemoryText.trim() || !settings.rag.isConnected || isAdding}
            className="px-4 py-2 text-sm font-medium new-chat-btn rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 h-auto"
            style={{ minHeight: '4.5rem' }}
          >
            {isAdding ? <LoaderIcon className="w-5 h-5" /> : <><PlusIcon className="w-5 h-5" /> Add</>}
          </button>
        </div>
      </div>
    </>
  );

  const renderStateTab = () => (
    <>
      <div className="p-6 overflow-y-auto flex-1 space-y-4">
        {!conversation?.consciousStateSettings?.enabled ? (
             <div className="text-center py-10 text-text-secondary">
                <p>The Conscious State Engine is disabled for this conversation.</p>
                <p className="text-xs mt-1">You can enable it in Conversation Settings.</p>
            </div>
        ) : !editableState ? (
            <div className="text-center py-10 text-text-secondary">
                <p>No state has been generated yet.</p>
                <p className="text-xs mt-1">Send a message to initialize the world state.</p>
            </div>
        ) : (
            <>
                <div className="p-3 border rounded-lg border-color bg-secondary-bg">
                    <h3 className="text-lg font-semibold mb-2">World State</h3>
                    <div className="space-y-2">
                         <div>
                            <label className="block text-xs font-medium text-text-secondary mb-1">Scene Atmosphere</label>
                            <input type="text" value={editableState.world_state.scene_atmosphere} onChange={(e) => handleWorldStateChange('scene_atmosphere', e.target.value)} className="w-full p-2 border rounded-lg text-sm modal-input" />
                         </div>
                         <div>
                            <label className="block text-xs font-medium text-text-secondary mb-1">External Environment</label>
                            <input type="text" value={editableState.world_state.external_environment} onChange={(e) => handleWorldStateChange('external_environment', e.target.value)} className="w-full p-2 border rounded-lg text-sm modal-input" />
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-text-secondary mb-1">Time of Day</label>
                                <input type="text" value={editableState.world_state.timeOfDay || ''} onChange={(e) => handleWorldStateChange('timeOfDay' as keyof WorldState, e.target.value)} className="w-full p-2 border rounded-lg text-sm modal-input" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-text-secondary mb-1">Weather</label>
                                <input type="text" value={editableState.world_state.weather || ''} onChange={(e) => handleWorldStateChange('weather' as keyof WorldState, e.target.value)} className="w-full p-2 border rounded-lg text-sm modal-input" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-text-secondary mb-1">Scene Tension (0–1)</label>
                                <input type="number" min={0} max={1} step={0.05} value={typeof editableState.world_state.sceneTension === 'number' ? editableState.world_state.sceneTension : 0} onChange={(e) => handleWorldStateChange('sceneTension' as keyof WorldState, Math.max(0, Math.min(1, Number(e.target.value))))} className="w-28 p-1 border rounded-lg text-sm modal-input" />
                            </div>
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-text-secondary mb-1">Location Hints (comma-separated)</label>
                                <input type="text" value={(editableState.world_state.locationHints || []).join(', ')} onChange={(e) => handleWorldStateChange('locationHints' as keyof WorldState, e.target.value.split(',').map(s => s.trim()).filter(Boolean))} className="w-full p-2 border rounded-lg text-sm modal-input" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-text-secondary mb-1">Salient Entities (comma-separated)</label>
                                <input type="text" value={(editableState.world_state.salientEntities || []).join(', ')} onChange={(e) => handleWorldStateChange('salientEntities' as keyof WorldState, e.target.value.split(',').map(s => s.trim()).filter(Boolean))} className="w-full p-2 border rounded-lg text-sm modal-input" />
                            </div>
                         </div>
                    </div>
                </div>
                <div>
                    <h3 className="text-lg font-semibold mb-2">Character States</h3>
                    <div className="space-y-3">
                    {editableState.character_states.map(charState => (
                        <div key={charState.characterId} className="p-3 border rounded-lg border-color bg-secondary-bg">
                            <h4 className="font-bold text-accent-primary">{charState.characterName}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1">Location</label>
                                    <input type="text" value={charState.current_location} onChange={(e) => handleCharacterStateChange(charState.characterId, 'current_location', e.target.value)} className="w-full p-2 border rounded-lg text-sm modal-input" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1">Emotion</label>
                                    <input type="text" value={charState.emotional_state} onChange={(e) => handleCharacterStateChange(charState.characterId, 'emotional_state', e.target.value)} className="w-full p-2 border rounded-lg text-sm modal-input" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1">Last Interaction</label>
                                    <input type="text" value={charState.last_interaction_with} onChange={(e) => handleCharacterStateChange(charState.characterId, 'last_interaction_with', e.target.value)} className="w-full p-2 border rounded-lg text-sm modal-input" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1">Mood</label>
                                    <input type="text" value={charState.mood || ''} onChange={(e) => handleCharacterStateChange(charState.characterId, 'mood', e.target.value)} className="w-full p-2 border rounded-lg text-sm modal-input" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1">Dominant Emotions (label:intensity)</label>
                                    <input
                                      type="text"
                                      value={(charState.dominant_emotions || []).map((x: any) => `${x.label}:${typeof x.intensity === 'number' ? x.intensity : ''}`).join(', ')}
                                      onChange={(e) => {
                                        const parts = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                        const arr = parts.map(p => {
                                          const [label, val] = p.split(':').map(s => s?.trim());
                                          const intensity = Math.max(0, Math.min(1, Number(val)));
                                          return label ? { label, intensity: isFinite(intensity) ? intensity : 0 } : null;
                                        }).filter(Boolean) as {label: string; intensity: number}[];
                                        handleCharacterStateChange(charState.characterId, 'dominant_emotions', arr);
                                      }}
                                      placeholder="happy:0.7, anxious:0.3"
                                      className="w-full p-2 border rounded-lg text-sm modal-input"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1">Last Interaction (Character)</label>
                                    <select
                                      value={charState.lastInteractionCharacterId || ''}
                                      onChange={(e) => handleCharacterStateChange(charState.characterId, 'lastInteractionCharacterId', e.target.value || undefined)}
                                      className="w-full p-2 border rounded-lg text-sm modal-input"
                                    >
                                      <option value="">—</option>
                                      {allCharacters.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                      ))}
                                    </select>
                                    {charState.lastInteractionCharacterId && (
                                      <p className="text-[11px] text-text-secondary mt-1">Selected: {getCharName(charState.lastInteractionCharacterId)}</p>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                                <div>
                                  <label className="block text-xs font-medium text-text-secondary mb-1">Confidence</label>
                                  <input type="number" min={0} max={1} step={0.05} value={typeof charState.confidence === 'number' ? charState.confidence : 0} onChange={(e) => handleCharacterStateChange(charState.characterId, 'confidence', Math.max(0, Math.min(1, Number(e.target.value))))} className="w-28 p-1 border rounded-lg text-sm modal-input" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-text-secondary mb-1">Evidence Msg IDs</label>
                                  <input type="text" readOnly value={(charState.evidenceMessageIds || []).join(', ')} className="w-full p-2 border rounded-lg text-sm modal-input bg-tertiary-bg/30" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-text-secondary mb-1">Relationships (read-only)</label>
                                  <div className="p-2 border rounded-lg text-xs modal-input bg-tertiary-bg/30 max-h-24 overflow-auto">
                                    {(charState.relationships || []).length === 0 ? (
                                      <span className="text-text-secondary">None</span>
                                    ) : (
                                      <ul className="list-disc pl-4 space-y-1">
                                        {(charState.relationships || []).map((r, idx) => (
                                          <li key={idx}>
                                            To {getCharName(r.targetCharacterId)}
                                            {r.metrics ? (
                                              <>
                                                {' '}[trust: {r.metrics.trust ?? '-'}, affinity: {r.metrics.affinity ?? '-'}, forgiveness: {r.metrics.forgiveness ?? '-'}]
                                              </>
                                            ) : null}
                                            {r.tags && r.tags.length > 0 ? <> — tags: {r.tags.join(', ')}</> : null}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    </div>
                </div>
            </>
        )}
      </div>
      <div className="p-4 border-t border-color modal-footer-bg">
        <button onClick={handleSaveState} disabled={!editableState} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold new-chat-btn rounded-lg disabled:opacity-50">
          <SaveIcon className="w-5 h-5" /> Save State Overrides
        </button>
      </div>
    </>
  );

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center transition-opacity"
      onClick={onClose} role="dialog" aria-modal="true"
    >
      <div
        className="modal-panel rounded-2xl shadow-2xl w-full max-w-5xl m-4 flex flex-col transform transition-transform scale-95 max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-color flex justify-between items-center modal-header-bg rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold">Conversation Intel</h2>
            <p className="text-sm text-text-secondary mt-1 truncate max-w-md">
              Managing memories for: {conversation?.title || '...'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-text-secondary hover:bg-tertiary-bg">
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="border-b border-color flex modal-header-bg">
            <button onClick={() => setActiveTab('rag')} className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${activeTab === 'rag' ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-text-secondary hover:text-text-primary'}`}>RAG Memories</button>
            <button onClick={() => setActiveTab('state')} className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${activeTab === 'state' ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-text-secondary hover:text-text-primary'}`}>Current State</button>
        </div>

        {activeTab === 'rag' ? renderRagTab() : renderStateTab()}

      </div>
    </div>
  );
};

export default MemoryModal;
