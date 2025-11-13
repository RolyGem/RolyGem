import React from 'react';
import type { Briefing } from '../types';
import { XIcon } from './icons/XIcon';
import { TrashIcon } from './icons/TrashIcon';

interface BriefingRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  briefings: Briefing[];
  onSelectBriefing: (briefing: Briefing) => void;
  onDeleteBriefing: (id: string) => void;
}

const BriefingItem: React.FC<{ briefing: Briefing; onSelect: () => void; onDelete: () => void; }> = ({ briefing, onSelect, onDelete }) => {
  const preview = briefing.content.split('\n')[0].substring(0, 100) + '...';

  return (
    <div className="group relative p-4 border-b border-color last:border-b-0">
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onSelect}>
          <div className="flex items-center gap-3">
            {!briefing.isRead && <div className="w-2.5 h-2.5 bg-accent-primary rounded-full flex-shrink-0" title="Unread"></div>}
            <h3 className="text-lg font-semibold text-text-primary truncate">{briefing.jobName}</h3>
          </div>
          <p className="text-sm text-text-secondary mt-1">{new Date(briefing.createdAt).toLocaleString()}</p>
          <p className="text-sm text-text-secondary mt-2 truncate">{preview}</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-2 ml-2 rounded-full text-text-secondary hover:text-red-500 hover:bg-tertiary-bg opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Delete Briefing"
        >
          <TrashIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export const BriefingRoomModal: React.FC<BriefingRoomModalProps> = ({ isOpen, onClose, briefings, onSelectBriefing, onDeleteBriefing }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="modal-panel rounded-2xl shadow-2xl w-full max-w-2xl m-4 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-color flex justify-between items-center modal-header-bg rounded-t-2xl">
          <h2 className="text-2xl font-bold">Agent Briefing Room</h2>
          <button onClick={onClose} className="p-1 rounded-full text-text-secondary hover:bg-tertiary-bg">
            <XIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {briefings.length === 0 ? (
            <p className="p-8 text-center text-text-secondary">No briefings from the agent yet.</p>
          ) : (
            briefings.map(b => (
              <BriefingItem
                key={b.id}
                briefing={b}
                onSelect={() => onSelectBriefing(b)}
                onDelete={() => {
                    if (window.confirm("Are you sure you want to delete this briefing?")) {
                        onDeleteBriefing(b.id);
                    }
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default BriefingRoomModal;
