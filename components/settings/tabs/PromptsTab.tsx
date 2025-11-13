import React, { useState, useMemo } from 'react';
import type { Settings, Prompt } from '../../../types';
import { DEFAULT_PROMPTS } from '../../../constants';
import { SegmentedControl } from '../common/SettingsInputComponents';

interface PromptsTabProps {
  settings: Settings;
  onLiveUpdate: (newSettings: Settings) => void;
}

const PromptsTab: React.FC<PromptsTabProps> = ({ settings, onLiveUpdate }) => {
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(settings.prompts[0]?.id || null);

  const selectedPrompt = useMemo(() => {
    return settings.prompts.find(p => p.id === selectedPromptId);
  }, [selectedPromptId, settings.prompts]);

  const handlePromptChange = (field: keyof Omit<Prompt, 'id' | 'name' | 'description'>, value: string) => {
    if (!selectedPromptId) return;
    const updatedPrompts = settings.prompts.map(p => 
      p.id === selectedPromptId ? { ...p, [field]: value } : p
    );
    onLiveUpdate({ ...settings, prompts: updatedPrompts });
  };

  const handleResetPrompt = () => {
    if (!selectedPromptId || !window.confirm("Are you sure you want to reset this prompt to its default?")) return;
    const defaultPrompt = DEFAULT_PROMPTS.find(p => p.id === selectedPromptId);
    if (defaultPrompt) {
      const updatedPrompts = settings.prompts.map(p => 
        p.id === selectedPromptId ? defaultPrompt : p
      );
      onLiveUpdate({ ...settings, prompts: updatedPrompts });
    }
  };

  return (
    <div className="flex-1 flex min-h-0">
      <aside className="w-1/3 border-r border-color flex flex-col">
        <div className="p-3 border-b border-color">
          <h3 className="text-lg font-semibold">AI Prompts</h3>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {settings.prompts.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedPromptId(p.id)}
              className={`w-full text-left truncate px-3 py-2 text-sm rounded-lg transition-colors list-item ${selectedPromptId === p.id ? 'list-item-active' : ''}`}
            >
              {p.name}
            </button>
          ))}
        </nav>
      </aside>
      <main className="w-2/3 p-6 overflow-y-auto space-y-4">
        {selectedPrompt ? (
          <>
            <h3 className="text-xl font-bold">{selectedPrompt.name}</h3>
            <p className="text-sm text-text-secondary -mt-2">{selectedPrompt.description}</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Model</label>
                <SegmentedControl 
                    name="model"
                    value={selectedPrompt.model}
                    options={[
                        { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
                        { value: 'gemini-2.5-flash-lite', label: 'Flash Lite' }
                    ]}
                    onChange={(e) => handlePromptChange('model', e.target.value)}
                />
                 <p className="text-xs text-text-secondary mt-1">
                    'Flash' provides higher quality, while 'Flash Lite' is faster and cheaper.
                 </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Template</label>
                <textarea 
                  value={selectedPrompt.template} 
                  onChange={e => handlePromptChange('template', e.target.value)}
                  rows={15} 
                  className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 text-sm modal-input font-mono"
                  spellCheck="false"
                />
              </div>
              <div>
                <button onClick={handleResetPrompt} className="px-3 py-1.5 text-sm font-medium rounded-lg btn-secondary">
                  Reset to Default
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-text-secondary">
            <p>Select a prompt to view or edit it.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default PromptsTab;