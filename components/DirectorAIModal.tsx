import React, { useState } from 'react';
import { DramaIcon } from './icons/DramaIcon';
import { XIcon } from './icons/XIcon';
import { SparklesIcon } from './icons/SparklesIcon';

interface DirectorAIModalProps {
  isOpen: boolean;
  suggestion: string;
  onClose: () => void; // Corresponds to Reject
  onAccept: () => void;
  onCustomize: (customPrompt: string) => void;
}

export const DirectorAIModal: React.FC<DirectorAIModalProps> = ({
  isOpen,
  suggestion,
  onClose,
  onAccept,
  onCustomize
}) => {
  const [customPrompt, setCustomPrompt] = useState('');

  const handleCustomizeSubmit = () => {
    if (customPrompt.trim()) {
      onCustomize(customPrompt.trim());
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center transition-opacity" onClick={onClose}>
      <div className="modal-panel rounded-2xl shadow-2xl w-full max-w-lg m-4 flex flex-col transform transition-transform scale-95 max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-color modal-header-bg rounded-t-2xl">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <DramaIcon className="w-6 h-6 text-accent-primary" />
            Director AI Intervention
          </h2>
          <p className="text-sm text-text-secondary mt-1">The AI Director is suggesting a new event to spice up the story.</p>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          <div>
            <p className="text-sm font-semibold mb-2">AI Suggestion:</p>
            <blockquote className="p-4 bg-tertiary-bg/50 rounded-lg border-l-4 border-accent-primary italic text-text-primary">
              "{suggestion}"
            </blockquote>
          </div>
          <div>
            <label htmlFor="custom-director-prompt" className="text-sm font-medium">Customize Event (Optional)</label>
            <textarea
              id="custom-director-prompt"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g., A character from the past appears..."
              rows={2}
              className="w-full p-2 mt-1 border rounded-lg focus:outline-none focus:ring-2 text-sm modal-input"
            />
          </div>
        </div>

        <div className="flex justify-end gap-4 p-4 mt-auto border-t border-color modal-footer-bg rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg btn-secondary">
            Reject
          </button>
          <button onClick={handleCustomizeSubmit} disabled={!customPrompt.trim()} className="px-4 py-2 text-sm font-medium rounded-lg btn-secondary disabled:opacity-50 flex items-center gap-2">
            <SparklesIcon className="w-4 h-4" />
            Submit Custom
          </button>
          <button onClick={onAccept} className="px-4 py-2 text-sm font-medium new-chat-btn rounded-lg">
            Accept Suggestion
          </button>
        </div>
      </div>
    </div>
  );
};