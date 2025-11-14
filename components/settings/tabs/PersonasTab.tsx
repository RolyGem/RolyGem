import React, { useState, useRef, useEffect } from 'react';
import type { Settings, UserPersona } from '../../../types';
import { CollapsibleNotice } from '../../common/CollapsibleNotice';
import { generateUUID } from '../../../utils/uuid';
import { PlusIcon } from '../../icons/PlusIcon';
import { TrashIcon } from '../../icons/TrashIcon';
import { LoaderIcon } from '../../icons/LoaderIcon';

interface PersonasTabProps {
  settings: Settings;
  onLiveUpdate: (newSettings: Settings) => void;
  userPersonas: UserPersona[];
  onSaveUserPersona: (persona: UserPersona) => void;
  onDeleteUserPersona: (id: string) => void;
  hasMorePersonas: boolean;
  onLoadMorePersonas: () => void;
}

const EMPTY_PERSONA: Omit<UserPersona, 'id' | 'createdAt'> = { name: '', description: '' };

/**
 * Renders the "Personas" tab in the settings modal.
 * This component provides a two-panel layout for managing user personas,
 * allowing users to create, edit, delete, and set the active persona.
 */
const PersonasTab: React.FC<PersonasTabProps> = ({ 
  settings, 
  onLiveUpdate, 
  userPersonas, 
  onSaveUserPersona, 
  onDeleteUserPersona,
  hasMorePersonas,
  onLoadMorePersonas
}) => {
  const [personaForm, setPersonaForm] = useState(EMPTY_PERSONA);
  const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null);
  const personaLoaderRef = useRef<HTMLDivElement>(null);

  // Effect for infinite scrolling of personas list
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMorePersonas) {
          onLoadMorePersonas();
        }
      },
      { threshold: 1.0 }
    );
    const currentLoader = personaLoaderRef.current;
    if (currentLoader) observer.observe(currentLoader);
    return () => {
      if (currentLoader) observer.unobserve(currentLoader);
    };
  }, [hasMorePersonas, onLoadMorePersonas]);

  const handleNewPersona = () => {
    setEditingPersonaId(null);
    setPersonaForm(EMPTY_PERSONA);
  };

  const handleEditPersona = (persona: UserPersona) => {
    setEditingPersonaId(persona.id);
    setPersonaForm({ name: persona.name, description: persona.description });
  };
  
  const handleDeletePersona = (id: string) => {
    if (window.confirm("Are you sure you want to delete this persona?")) {
        onDeleteUserPersona(id);
        if (editingPersonaId === id) {
            handleNewPersona();
        }
    }
  };
  
  const handleSavePersonaForm = () => {
    if (!personaForm.name.trim()) {
        alert("Persona name cannot be empty.");
        return;
    }
    const personaData: UserPersona = {
        id: editingPersonaId || generateUUID(),
        createdAt: editingPersonaId ? userPersonas.find(p => p.id === editingPersonaId)!.createdAt : Date.now(),
        ...personaForm
    };
    onSaveUserPersona(personaData);
    if (!editingPersonaId) {
        setEditingPersonaId(personaData.id);
        handleSetActivePersona(personaData.id);
    }
  };
  
  const handleSetActivePersona = (id: string) => {
    onLiveUpdate({ ...settings, activeUserPersonaId: id });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
        {/* Roleplay Purpose Notice */}
        <div className="mx-6 mt-6 mb-2">
            <CollapsibleNotice
                title="Personas for Roleplay"
                variant="purple"
                icon="🎭"
                defaultExpanded={false}
            >
                <p>
                    This feature is specifically designed for roleplaying scenarios. Create different personas to define how the AI should interact with you in various roleplay contexts.
                </p>
            </CollapsibleNotice>
        </div>

        <div className="flex-1 flex min-h-0">
        <aside className="w-1/3 border-r border-color flex flex-col">
            <div className="p-3">
                <button onClick={handleNewPersona} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold new-chat-btn rounded-lg">
                    <PlusIcon className="w-4 h-4"/> New Persona
                </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                {userPersonas.map(p => (
                    <div key={p.id} className="group relative">
                        <button
                            onClick={() => handleEditPersona(p)}
                            className={`w-full text-left truncate pl-3 pr-8 py-2 text-sm rounded-lg transition-colors list-item ${editingPersonaId === p.id ? 'list-item-active' : ''}`}
                        >
                            {p.name}
                            {settings.activeUserPersonaId === p.id && <span className="text-xs text-accent-primary ml-2">(Active)</span>}
                        </button>
                         <button onClick={() => handleDeletePersona(p.id)} className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <TrashIcon className="w-4 h-4" />
                         </button>
                    </div>
                ))}
                <div ref={personaLoaderRef} className="h-5 flex justify-center items-center">
                    {hasMorePersonas && <LoaderIcon className="w-5 h-5" />}
                </div>
            </nav>
        </aside>
        <main className="w-2/3 p-6 overflow-y-auto space-y-4">
             <h3 className="text-xl font-bold">{editingPersonaId ? "Edit Persona" : "Create New Persona"}</h3>
             <div>
                <label className="block text-sm font-medium">Name</label>
                <input type="text" value={personaForm.name} onChange={e => setPersonaForm({...personaForm, name: e.target.value})} className="mt-1 block w-full px-3 py-2 border rounded-md modal-input" />
             </div>
             <div>
                <label className="block text-sm font-medium">Description</label>
                <textarea value={personaForm.description} onChange={e => setPersonaForm({...personaForm, description: e.target.value})} rows={5} className="mt-1 block w-full px-3 py-2 border rounded-md modal-input" placeholder="Describe this persona. The AI will use this as context for how to interact with you."/>
             </div>
             <div className="flex justify-between items-center pt-4">
                <button onClick={handleSavePersonaForm} disabled={!personaForm.name.trim()} className="px-4 py-2 text-sm font-medium new-chat-btn rounded-lg disabled:opacity-50">
                    Save Persona
                </button>
                {editingPersonaId && settings.activeUserPersonaId !== editingPersonaId && (
                    <button onClick={() => handleSetActivePersona(editingPersonaId!)} className="px-4 py-2 text-sm font-medium btn-secondary rounded-lg">
                        Set Active
                    </button>
                )}
             </div>
        </main>
        </div>
    </div>
  );
};

export default PersonasTab;
