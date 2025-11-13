import React, { useState } from 'react';
import { proposeIdentityFact } from '../../services/aiService';
import { LoaderIcon } from '../icons/LoaderIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import { XIcon } from '../icons/XIcon';

interface AddToIdentityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddFact: (factContent: string) => void;
}

const AddToIdentityModal: React.FC<AddToIdentityModalProps> = ({ isOpen, onClose, onAddFact }) => {
  const [stage, setStage] = useState<'input' | 'proposing' | 'review'>('input');
  const [userInput, setUserInput] = useState('');
  const [proposedFact, setProposedFact] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    onClose();
    // Reset state after a delay for the animation
    setTimeout(() => {
      setStage('input');
      setUserInput('');
      setProposedFact('');
      setError(null);
    }, 300);
  };

  const handleProcess = async () => {
    if (!userInput.trim()) return;
    setStage('proposing');
    setError(null);
    try {
      const fact = await proposeIdentityFact(userInput);
      setProposedFact(fact);
      setStage('review');
    } catch (e: any) {
      setError(e.message || 'Failed to process your request.');
      setStage('input'); // Go back to input on error
    }
  };

  const handleApprove = () => {
    onAddFact(proposedFact);
    handleClose();
  };

  const handleRetry = () => {
    setStage('input');
    // Keep userInput for easy editing
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center transition-opacity" onClick={handleClose}>
      <div className="modal-panel rounded-2xl shadow-2xl w-full max-w-lg m-4 flex flex-col transform transition-transform scale-95 max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-color modal-header-bg rounded-t-2xl">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <SparklesIcon className="w-6 h-6 text-accent-primary" />
            Add to Identity
          </h2>
          <p className="text-sm text-text-secondary mt-1">Add a new fact or instruction to the AI's permanent memory.</p>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {stage === 'input' && (
            <>
              <label htmlFor="user-memory-input" className="text-sm font-medium">What should I remember?</label>
              <textarea
                id="user-memory-input"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="e.g., I prefer short answers, or, my favorite food is pizza"
                rows={4}
                className="w-full p-2 mt-1 border rounded-lg focus:outline-none focus:ring-2 text-base modal-input"
                autoFocus
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
            </>
          )}

          {stage === 'proposing' && (
            <div className="flex flex-col items-center justify-center h-32 gap-3 text-text-secondary">
              <LoaderIcon className="w-8 h-8 text-accent-primary" />
              <p>Processing with AI...</p>
            </div>
          )}

          {stage === 'review' && (
            <>
              <p className="text-sm font-medium">Is this what you mean?</p>
              <blockquote className="p-4 bg-tertiary-bg/50 rounded-lg border-l-4 border-accent-primary italic text-text-primary">
                "{proposedFact}"
              </blockquote>
            </>
          )}
        </div>

        <div className="flex justify-end gap-4 p-4 mt-auto border-t border-color modal-footer-bg rounded-b-2xl">
          {stage === 'input' && (
            <>
              <button onClick={handleClose} className="px-4 py-2 text-sm font-medium rounded-lg btn-secondary">Cancel</button>
              <button onClick={handleProcess} disabled={!userInput.trim()} className="px-4 py-2 text-sm font-medium new-chat-btn rounded-lg disabled:opacity-50">Process with AI</button>
            </>
          )}
          {stage === 'review' && (
            <>
              <button onClick={handleClose} className="px-4 py-2 text-sm font-medium rounded-lg btn-secondary">Reject</button>
              <button onClick={handleRetry} className="px-4 py-2 text-sm font-medium rounded-lg btn-secondary">Retry</button>
              <button onClick={handleApprove} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">Approve</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddToIdentityModal;
