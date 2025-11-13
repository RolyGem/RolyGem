import React, { useState, useCallback } from 'react';
import type { Conversation, Character, Lorebook } from '../types';
import type { UpdateKnowledgeProgress } from '../services/aiService';
import { generateCharacterFromConversation, generateLorebookFromConversation } from '../services/aiService';
import { generateUUID } from '../utils/uuid';

interface UpdateKnowledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation | null;
  allCharacters: Character[];
  onUpdateComplete: (updatedCharacters: Character[], newLorebooks: Lorebook[]) => void;
}

type Stage = 'configuring' | 'generating' | 'reviewing' | 'error';

const DiffView: React.FC<{ oldText: string, newText: string }> = ({ oldText, newText }) => {
    if (oldText === newText) {
        return <p className="text-sm whitespace-pre-wrap">{newText}</p>;
    }
    return (
        <div className="space-y-1">
            <p className="text-xs text-red-500 font-semibold">OLD</p>
            <p className="text-sm diff-del">{oldText}</p>
            <p className="text-xs text-green-500 font-semibold mt-2">NEW</p>
            <p className="text-sm diff-ins">{newText}</p>
        </div>
    );
};

export const UpdateKnowledgeModal: React.FC<UpdateKnowledgeModalProps> = ({
  isOpen,
  onClose,
  conversation,
  allCharacters: _allCharacters,
  onUpdateComplete,
}) => {
  const [stage, setStage] = useState<Stage>('configuring');
  const [messageCount, setMessageCount] = useState(30);
  const [focus, setFocus] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [loreEntries, setLoreEntries] = useState(1);
  const [progress, setProgress] = useState<UpdateKnowledgeProgress>({ stage: 'idle', message: '' });
  const [errorMessage, setErrorMessage] = useState('');

  const [reviewKind, setReviewKind] = useState<null | 'character' | 'lore'>(null);
  const [previewCharacter, setPreviewCharacter] = useState<Omit<Character, 'id' | 'createdAt' | 'events' | 'characterArcs'> | null>(null);
  const [previewLorebook, setPreviewLorebook] = useState<Omit<Lorebook, 'id' | 'createdAt'> | null>(null);

  const resetState = useCallback(() => {
    setStage('configuring');
    setMessageCount(30);
    setFocus('');
    setCharacterName('');
    setLoreEntries(1);
    setProgress({ stage: 'idle', message: '' });
    setErrorMessage('');
    setReviewKind(null);
    setPreviewCharacter(null);
    setPreviewLorebook(null);
  }, []);
  
  React.useEffect(() => {
    if (isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);


  const handleGenerateCharacter = useCallback(async () => {
    if (!conversation || conversation.messages.length === 0) return;
    setErrorMessage('');
    setStage('generating');
    setProgress({ stage: 'creating_character', message: 'Generating character...' });
    try {
      const messages = conversation.messages.slice(-messageCount);
      const result = await generateCharacterFromConversation(messages, { targetName: characterName.trim() || undefined, focusInstructions: focus.trim() || undefined });
      setPreviewCharacter(result);
      setReviewKind('character');
      setStage('reviewing');
    } catch (e: any) {
      setErrorMessage(e.message || 'An unknown error occurred while generating the character.');
      setStage('error');
    }
  }, [conversation, messageCount, characterName, focus]);

  const handleGenerateLorebook = useCallback(async () => {
    if (!conversation || conversation.messages.length === 0) return;
    setErrorMessage('');
    setStage('generating');
    setProgress({ stage: 'creating_lore', message: 'Generating lorebook...' });
    try {
      const messages = conversation.messages.slice(-messageCount);
      const result = await generateLorebookFromConversation(messages, Math.max(1, loreEntries), focus.trim() || undefined);
      setPreviewLorebook(result);
      setReviewKind('lore');
      setStage('reviewing');
    } catch (e: any) {
      setErrorMessage(e.message || 'An unknown error occurred while generating the lorebook.');
      setStage('error');
    }
  }, [conversation, messageCount, loreEntries, focus]);

  const handleAccept = () => {
    const newChars: Character[] = [];
    const newBooks: Lorebook[] = [];
    if (previewCharacter) {
      newChars.push({
        id: generateUUID(),
        createdAt: Date.now(),
        name: previewCharacter.name,
        description: previewCharacter.description,
        exampleDialogue: previewCharacter.exampleDialogue,
        authorNote: previewCharacter.authorNote,
        visualPrompt: (previewCharacter as any).visualPrompt || '',
        events: '',
        characterArcs: [],
      } as Character);
    }
    if (previewLorebook) {
      newBooks.push({
        id: generateUUID(),
        createdAt: Date.now(),
        name: previewLorebook.name,
        description: previewLorebook.description,
        entries: previewLorebook.entries.map((e) => ({ ...e, id: generateUUID() })),
      } as Lorebook);
    }
    onUpdateComplete(newChars, newBooks);
    onClose();
  };

  const handleReject = () => {
    onClose();
  };

  const isProcessing = stage === 'generating';
  
  if (!isOpen) {
    return null;
  }

  const renderContent = () => {
    switch(stage) {
      case 'generating':
        return (
          <div className="p-8 text-center space-y-4">
            <h3 className="text-xl font-semibold">{progress.stage === 'creating_character' ? 'Generating Character' : 'Generating Lorebook'}...</h3>
            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${((progress.progress || 0) / (progress.total || 1)) * 100}%` }}></div>
            </div>
            <p className="text-sm text-gray-500">{progress.message}</p>
          </div>
        );

      case 'reviewing':
        return (
          <div className="space-y-6">
            {reviewKind === 'character' && previewCharacter && (
              <div className="space-y-3 p-4 border rounded-md border-color">
                <h3 className="text-lg font-semibold">New Character</h3>
                <p className="text-sm"><span className="font-semibold">Name:</span> {previewCharacter.name}</p>
                <div>
                  <h4 className="font-semibold text-sm">Description</h4>
                  <p className="text-sm whitespace-pre-wrap">{previewCharacter.description}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Example Dialogue</h4>
                  <p className="text-sm whitespace-pre-wrap">{previewCharacter.exampleDialogue}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Author's Note</h4>
                  <p className="text-sm whitespace-pre-wrap">{previewCharacter.authorNote}</p>
                </div>
              </div>
            )}
            {reviewKind === 'lore' && previewLorebook && (
              <div>
                <h3 className="text-lg font-semibold mb-2">New Lorebook</h3>
                <div className="p-3 border rounded-md space-y-2 border-color">
                  <h4 className="font-bold text-indigo-600 dark:text-indigo-400">{previewLorebook.name}</h4>
                  <p className="text-sm italic">{previewLorebook.description}</p>
                  {previewLorebook.entries.map((entry, idx) => (
                    <div key={idx} className="pt-2 border-t border-dashed border-color">
                      <p className="text-xs font-mono text-gray-500">Keywords: {entry.keywords}</p>
                      <p className="text-sm mt-1">{entry.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'error':
        return (
          <div className="p-8 text-center space-y-4">
            <h3 className="text-xl font-semibold text-red-500">An Error Occurred</h3>
            <p>{errorMessage}</p>
          </div>
        );

      case 'configuring':
      default:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium">
                Analyze Last {messageCount} Messages
              </label>
              <input
                type="range" min="10" max={Math.min(50, conversation?.messages.length || 10)} step="5" value={messageCount}
                onChange={e => setMessageCount(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 mt-2"
              />
            </div>
            <div>
              <label htmlFor="focus" className="block text-sm font-medium">
                Focus Instructions (Optional)
              </label>
              <textarea id="focus" value={focus} onChange={e => setFocus(e.target.value)}
                placeholder="e.g., Focus on the betrayal and the magic sword."
                rows={2} className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 modal-input"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 border rounded-md border-color">
                <h3 className="text-sm font-semibold mb-2">Generate Character From Chat</h3>
                <label className="block text-xs font-medium">Character Name (Optional)</label>
                <input type="text" value={characterName} onChange={e => setCharacterName(e.target.value)}
                  placeholder="e.g., Layla" className="mt-1 w-full px-3 py-2 border rounded-md modal-input text-sm" />
                <button onClick={handleGenerateCharacter} disabled={!conversation || (conversation?.messages.length || 0) === 0}
                  className="mt-3 w-full px-3 py-2 text-sm font-semibold new-chat-btn rounded-lg disabled:opacity-50">
                  Generate Character
                </button>
              </div>
              <div className="p-3 border rounded-md border-color">
                <h3 className="text-sm font-semibold mb-2">Generate Lorebook From Chat</h3>
                <label className="block text-xs font-medium">Entries Count</label>
                <input type="number" min={1} max={5} value={loreEntries} onChange={e => setLoreEntries(Math.max(1, Math.min(5, Number(e.target.value))))}
                  className="mt-1 w-full px-3 py-2 border rounded-md modal-input text-sm" />
                <button onClick={handleGenerateLorebook} disabled={!conversation || (conversation?.messages.length || 0) === 0}
                  className="mt-3 w-full px-3 py-2 text-sm font-semibold btn-secondary rounded-lg disabled:opacity-50">
                  Generate Lorebook
                </button>
              </div>
            </div>
          </div>
        );
    }
  };


  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center transition-opacity"
      onClick={isProcessing ? undefined : onClose} role="dialog" aria-modal="true"
    >
      <div
        className="modal-panel rounded-2xl shadow-2xl w-full max-w-2xl m-4 flex flex-col transform transition-transform scale-95 max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-color modal-header-bg rounded-t-2xl">
          <h2 className="text-2xl font-bold">Update Knowledge</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create new characters and lore directly from recent messages.
          </p>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
            {renderContent()}
        </div>

        <div className="flex justify-end gap-4 p-4 mt-auto border-t border-color modal-footer-bg rounded-b-2xl">
          {stage === 'configuring' && (
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg btn-secondary">Close</button>
          )}
           {stage === 'reviewing' && (
            <>
              <button onClick={handleReject} className="px-4 py-2 text-sm font-medium text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/40 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/60">
                Reject
              </button>
              <button onClick={resetState} className="px-4 py-2 text-sm font-medium rounded-lg btn-secondary">
                Retry
              </button>
              <button onClick={handleAccept} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
                Accept Changes
              </button>
            </>
          )}
           {stage === 'error' && (
            <>
               <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg btn-secondary">
                Close
              </button>
              <button onClick={resetState} className="px-4 py-2 text-sm font-medium new-chat-btn rounded-lg">
                Try Again
              </button>
            </>
          )}
          {isProcessing && (
             <button disabled className="px-4 py-2 text-sm font-medium rounded-lg opacity-50 btn-secondary">
                Processing...
              </button>
          )}
        </div>
      </div>
    </div>
  );
};
// Fix: Add a default export to make the component compatible with React.lazy().
export default UpdateKnowledgeModal;
