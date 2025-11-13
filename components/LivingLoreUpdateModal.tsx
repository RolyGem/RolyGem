import React, { useState, useEffect, useCallback } from 'react';
import type { Character, LivingLoreUpdate } from '../types';
import { getLiveCharacterUpdateAsJson } from '../services/aiService';
import { LoaderIcon } from './icons/LoaderIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { SaveIcon } from './icons/SaveIcon';
import { XIcon } from './icons/XIcon';
import { BotIcon } from './icons/BotIcon';

interface LivingLoreUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  character: Character;
  suggestedChange: string;
  onSave: (updatedCharacter: Character) => void;
}

const DiffView: React.FC<{ oldText: string, newText: string }> = React.memo(({ oldText, newText }) => {
    if (!newText || oldText === newText) {
        return <p className="text-sm whitespace-pre-wrap">{oldText}</p>;
    }
    return (
        <div className="space-y-1 text-sm">
            <p className="diff-del whitespace-pre-wrap">{oldText}</p>
            <p className="diff-ins whitespace-pre-wrap mt-2">{newText}</p>
        </div>
    );
});

interface FieldUpdateProps {
    title: string;
    oldText: string;
    newText: string;
    isAccepted: boolean;
    onToggle: () => void;
}

const FieldUpdate: React.FC<FieldUpdateProps> = ({ title, oldText, newText, isAccepted, onToggle }) => {
    const hasChanged = newText && oldText !== newText;

    return (
        <div className="pt-3 border-t border-dashed border-color">
            <div className="flex justify-between items-center mb-1">
                <h4 className="font-semibold text-sm text-text-secondary">{title}</h4>
                {hasChanged && (
                    <label className="flex items-center gap-2 text-xs cursor-pointer p-1 rounded hover:bg-tertiary-bg">
                        <span className={`font-semibold transition-colors ${isAccepted ? 'text-green-500' : 'text-text-secondary'}`}>
                            Accept
                        </span>
                        <div className={`w-10 h-5 flex items-center rounded-full p-1 transition-colors ${isAccepted ? 'bg-green-400' : 'bg-gray-300 dark:bg-gray-600'}`}>
                            <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition-transform ${isAccepted ? 'translate-x-5' : ''}`} />
                        </div>
                        <input type="checkbox" checked={isAccepted} onChange={onToggle} className="hidden" />
                    </label>
                )}
            </div>
            <div className={!hasChanged || isAccepted ? '' : 'opacity-50'}>
                <DiffView oldText={oldText} newText={newText} />
            </div>
        </div>
    );
};


export const LivingLoreUpdateModal: React.FC<LivingLoreUpdateModalProps> = ({ isOpen, onClose, character, suggestedChange, onSave }) => {
    const [update, setUpdate] = useState<LivingLoreUpdate | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [customPrompt, setCustomPrompt] = useState('');
    const [acceptedFields, setAcceptedFields] = useState({
        description: true,
        exampleDialogue: true,
        authorNote: true,
    });

    const generateUpdate = useCallback(async (prompt?: string) => {
        setIsGenerating(true);
        setError(null);
        setUpdate(null);
        setAcceptedFields({ description: true, exampleDialogue: true, authorNote: true }); // Reset on new generation

        try {
            const result = await getLiveCharacterUpdateAsJson(character, suggestedChange, prompt);
            setUpdate(result);
        } catch (e: any) {
            setError(e.message || 'An unknown error occurred.');
        } finally {
            setIsGenerating(false);
        }
    }, [character, suggestedChange]);
    
    useEffect(() => {
        if (isOpen) {
            setUpdate(null);
            setCustomPrompt('');
            setError(null);
            generateUpdate();
        }
    }, [isOpen, generateUpdate]);

    const handleSave = () => {
        if (!update) return;
        const updatedCharacter: Character = {
            ...character,
            description: acceptedFields.description ? update.description : character.description,
            exampleDialogue: acceptedFields.exampleDialogue ? update.exampleDialogue : character.exampleDialogue,
            authorNote: acceptedFields.authorNote ? update.authorNote : character.authorNote,
            events: `${character.events || ''}\n- [${new Date().toLocaleString()}] ${suggestedChange}`.trim(),
        };
        onSave(updatedCharacter);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center transition-opacity" onClick={onClose}>
            <div className="modal-panel rounded-2xl shadow-2xl w-full max-w-3xl m-4 flex flex-col transform transition-transform scale-95 max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-color modal-header-bg rounded-t-2xl">
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                        <SparklesIcon className="w-6 h-6 text-accent-primary" />
                        Living Lore Update
                    </h2>
                    <p className="text-sm text-text-secondary mt-1">AI is suggesting an update for <span className="font-semibold text-text-primary">{character.name}</span> based on recent events.</p>
                </div>

                <div className="p-6 flex-1 overflow-y-auto space-y-4">
                    <div className="p-3 bg-tertiary-bg/50 rounded-lg">
                        <p className="text-sm font-semibold">Detected Event:</p>
                        <p className="text-sm italic text-text-secondary">"{suggestedChange}"</p>
                    </div>

                    <div className="p-3 border rounded-lg border-color space-y-4">
                        <div className="flex items-center gap-4">
                            <h3 className="font-semibold">Updated Character Sheet:</h3>
                            <button onClick={() => setAcceptedFields({ description: true, exampleDialogue: true, authorNote: true })} className="px-2 py-0.5 text-xs font-medium rounded-md btn-secondary">Accept All</button>
                            <button onClick={() => setAcceptedFields({ description: false, exampleDialogue: false, authorNote: false })} className="px-2 py-0.5 text-xs font-medium rounded-md btn-secondary">Reject All</button>
                        </div>
                        {isGenerating && !update && (
                             <div className="flex items-center justify-center gap-2 text-text-secondary py-10">
                                <BotIcon className="w-6 h-6 animate-pulse"/>
                                <span className="text-lg">Gemini is rewriting...</span>
                            </div>
                        )}
                        {error && <p className="text-red-500 text-sm">{error}</p>}
                        
                        {update && (
                             <div className="space-y-2">
                                <FieldUpdate
                                    title="Description"
                                    oldText={character.description}
                                    newText={update.description}
                                    isAccepted={acceptedFields.description}
                                    onToggle={() => setAcceptedFields(p => ({ ...p, description: !p.description }))}
                                />
                                <FieldUpdate
                                    title="Example Dialogue"
                                    oldText={character.exampleDialogue}
                                    newText={update.exampleDialogue}
                                    isAccepted={acceptedFields.exampleDialogue}
                                    onToggle={() => setAcceptedFields(p => ({ ...p, exampleDialogue: !p.exampleDialogue }))}
                                />
                                 <FieldUpdate
                                    title="Author's Note (Private)"
                                    oldText={character.authorNote}
                                    newText={update.authorNote}
                                    isAccepted={acceptedFields.authorNote}
                                    onToggle={() => setAcceptedFields(p => ({ ...p, authorNote: !p.authorNote }))}
                                />
                            </div>
                        )}
                    </div>

                    <div>
                        <label htmlFor="custom-prompt" className="text-sm font-medium">Customize Update (Optional)</label>
                         <textarea 
                            id="custom-prompt"
                            value={customPrompt}
                            onChange={(e) => setCustomPrompt(e.target.value)}
                            placeholder="e.g., Make the description more somber."
                            rows={2}
                            className="w-full p-2 mt-1 border rounded-lg focus:outline-none focus:ring-2 text-sm modal-input"
                            disabled={isGenerating}
                        />
                        <button 
                            onClick={() => generateUpdate(customPrompt)}
                            disabled={isGenerating}
                            className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold btn-secondary rounded-lg disabled:opacity-50">
                            {isGenerating ? <LoaderIcon className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />}
                            Regenerate with Prompt
                        </button>
                    </div>

                </div>

                <div className="flex justify-end gap-4 p-4 mt-auto border-t border-color modal-footer-bg rounded-b-2xl">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg btn-secondary flex items-center gap-2">
                        <XIcon className="w-5 h-5" /> Cancel
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={isGenerating || !update}
                        className="px-4 py-2 text-sm font-medium new-chat-btn rounded-lg disabled:opacity-50 flex items-center gap-2">
                        <SaveIcon className="w-5 h-5" /> Accept & Save
                    </button>
                </div>
            </div>
        </div>
    );
};
// Fix: Add a default export to make the component compatible with React.lazy().
export default LivingLoreUpdateModal;
