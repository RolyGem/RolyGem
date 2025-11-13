import React, { useState, useEffect } from 'react';

interface ContextSongPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (customInstructions?: string) => void;
}

const ContextSongPrompt: React.FC<ContextSongPromptProps> = ({ isOpen, onClose, onSubmit }) => {
  const [text, setText] = useState('');

  useEffect(() => {
    if (!isOpen) setText('');
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl shadow-2xl border modal-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%)',
          borderColor: 'rgba(139, 92, 246, 0.3)',
          borderWidth: '1px'
        }}
      >
        <div className="px-4 py-3 border-b modal-header-bg rounded-t-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-blue-500/10"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <h3 className="text-base font-bold">Complete the song instructions</h3>
            </div>
            <button 
              onClick={onClose} 
              className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
              aria-label="Close"
            >
              <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-4 space-y-2.5">
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Add a musical style, mood, or any extra details (optional)
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Example: Calm style with a light electronic touch, medium tempo..."
            className="w-full px-3 py-2.5 rounded-lg border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
            style={{ 
              background: 'var(--input-bg)', 
              color: 'var(--text-color)', 
              borderColor: 'rgba(139, 92, 246, 0.3)',
              minHeight: '90px'
            }}
            dir="rtl"
            autoFocus
          />
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t modal-footer-bg rounded-b-xl"
             style={{ borderColor: 'rgba(139, 92, 246, 0.2)' }}>
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105 active:scale-95"
            style={{ background: 'rgba(100,100,100,0.2)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(text.trim() || undefined)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
            style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
              color: 'white'
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            Generate
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContextSongPrompt;
