import React, { useState } from 'react';
import type { Settings, StoryArcLevel } from '../../../types';
import { generateWorldStoryArcs } from '../../../services/aiService';
import { useNotifications } from '../../../contexts/NotificationContext';
import { generateUUID } from '../../../utils/uuid';
import { TrashIcon } from '../../icons/TrashIcon';
import { PlusIcon } from '../../icons/PlusIcon';
import { SparklesIcon } from '../../icons/SparklesIcon';
import { LoaderIcon } from '../../icons/LoaderIcon';

interface StoryArcsTabProps {
  settings: Settings;
  onLiveUpdate: (newSettings: Settings) => void;
}

/**
 * Renders the "Story Arcs" tab in the settings modal.
 * This component allows users to manually define or AI-generate a narrative
 * progression for their stories, split into different levels.
 */
const StoryArcsTab: React.FC<StoryArcsTabProps> = ({ settings, onLiveUpdate }) => {
  const [storyArcConcept, setStoryArcConcept] = useState('');
  const [storyArcLevels, setStoryArcLevels] = useState(5);
  const [isGeneratingArcs, setIsGeneratingArcs] = useState(false);
  const [arcGenerationError, setArcGenerationError] = useState<string | null>(null);
  const { addNotification } = useNotifications();
  
  const handleStoryArcChange = (id: string, field: keyof Omit<StoryArcLevel, 'id' | 'level'>, value: string | number) => {
    const updatedLevels = settings.storyArcs.levels.map(level => 
        level.id === id ? { ...level, [field]: value } : level
    );
    onLiveUpdate({ ...settings, storyArcs: { ...settings.storyArcs, levels: updatedLevels } });
  };

  const handleAddStoryArc = () => {
    const levels = settings.storyArcs.levels;
    const newLevel: StoryArcLevel = {
        id: generateUUID(),
        level: levels.length + 1,
        messagesToNext: 50,
        systemPrompt: `This is the system prompt for Level ${levels.length + 1}. The story takes a dramatic turn...`
    };
    onLiveUpdate({ ...settings, storyArcs: { levels: [...levels, newLevel] } });
  };

  const handleRemoveStoryArc = (id: string) => {
    let updatedLevels = settings.storyArcs.levels.filter(level => level.id !== id);
    // Re-number levels to maintain sequence
    updatedLevels = updatedLevels.map((level, index) => ({ ...level, level: index + 1 }));
    onLiveUpdate({ ...settings, storyArcs: { levels: updatedLevels } });
  };

  const handleGenerateStoryArcs = async () => {
    if (!storyArcConcept.trim()) return;
    setIsGeneratingArcs(true);
    setArcGenerationError(null);
    try {
        const generatedLevels = await generateWorldStoryArcs(storyArcConcept, storyArcLevels);
        onLiveUpdate({ ...settings, storyArcs: { levels: generatedLevels } });
        addNotification({ title: 'Success', message: 'Story Arcs generated successfully!', type: 'success', duration: 4000 });
    } catch (e: any) {
        setArcGenerationError(e.message || 'An unknown error occurred.');
        addNotification({ title: 'Error', message: e.message, type: 'error' });
    } finally {
        setIsGeneratingArcs(false);
    }
  };
  
  return (
    <div className="p-6 overflow-y-auto space-y-6 flex-1">
         <div className="flex justify-between items-center">
            <div>
                 <h3 className="text-lg font-semibold">Story Arcs</h3>
                 <p className="text-sm text-text-secondary">
                     Define a progression for your stories and characters over time.
                 </p>
            </div>
         </div>

         {/* Usage Instructions */}
         <div className="p-4 bg-accent-primary/5 border border-accent-primary/20 rounded-lg space-y-2">
            <p className="text-sm font-semibold text-accent-primary">📖 How to Use Story Arcs:</p>
            <ol className="text-xs text-text-secondary list-decimal list-inside space-y-1 pl-2">
                <li><strong>Option 1 - AI Generation:</strong> Describe your story concept below and let AI generate all levels automatically</li>
                <li><strong>Option 2 - Manual Creation:</strong> Click "Add Level" to manually create each story progression level</li>
                <li><strong>Configure Levels:</strong> Each level has a system prompt that defines the narrative at that stage</li>
                <li><strong>Set Transitions:</strong> "Messages to reach NEXT level" controls when the story advances</li>
                <li><strong>Apply:</strong> Story arcs automatically progress as your conversation grows, creating dynamic narrative evolution</li>
            </ol>
         </div>

        <div className="p-4 border border-accent-primary/20 rounded-lg bg-accent-primary/10 space-y-3">
            <h3 className="text-lg font-semibold text-accent-primary flex items-center gap-2">
                <SparklesIcon className="w-5 h-5" />
                Generate with AI
            </h3>
            <p className="text-sm text-text-secondary">
                Describe your story concept, and Gemini will create the entire progression for you. This will replace any existing levels.
            </p>
            <textarea 
                value={storyArcConcept}
                onChange={(e) => setStoryArcConcept(e.target.value)}
                placeholder="e.g., A 5-level sci-fi story about discovering an ancient alien ship, which turns into a conflict with its AI, and ends with uncovering a cosmic conspiracy."
                rows={3}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 text-sm modal-input"
                disabled={isGeneratingArcs}
            />
            <div className="flex items-center gap-4">
                <div className="flex-1">
                    <label className="block text-xs font-medium text-text-secondary mb-1">Number of Levels</label>
                    <input type="number" value={storyArcLevels} onChange={e => setStoryArcLevels(Math.max(2, Number(e.target.value)))} min="2" max="20" className="w-24 p-1 border rounded-md modal-input text-sm" disabled={isGeneratingArcs} />
                </div>
                <button 
                    onClick={handleGenerateStoryArcs} 
                    disabled={isGeneratingArcs || !storyArcConcept.trim()}
                    className="px-4 py-2 flex-shrink-0 text-sm font-semibold new-chat-btn rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                    {isGeneratingArcs ? <LoaderIcon className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />}
                    {isGeneratingArcs ? 'Generating...' : 'Generate Progression'}
                </button>
            </div>
             {arcGenerationError && <p className="text-sm text-red-500">{arcGenerationError}</p>}
        </div>
        
        <div className="space-y-4">
            {(settings.storyArcs.levels || []).map((level) => (
                <div key={level.id} className="p-4 border rounded-lg space-y-3 relative bg-secondary-bg border-color">
                    <button onClick={() => handleRemoveStoryArc(level.id)} className="absolute top-2 right-2 p-1 text-text-secondary hover:text-red-500"><TrashIcon className="w-4 h-4" /></button>
                    <h4 className="font-bold text-accent-primary">Level {level.level}</h4>
                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">Messages to reach NEXT level</label>
                        <input type="number" value={level.messagesToNext} onChange={e => handleStoryArcChange(level.id, 'messagesToNext', Number(e.target.value))} className="w-32 p-1 border rounded-md modal-input text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">System Prompt for this Level</label>
                        <textarea value={level.systemPrompt} onChange={e => handleStoryArcChange(level.id, 'systemPrompt', e.target.value)} rows={3} className="w-full p-2 border rounded-lg text-sm modal-input" placeholder="e.g., The world has grown darker..."/>
                    </div>
                </div>
            ))}
             <button onClick={handleAddStoryArc} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-accent-primary bg-accent-primary/10 rounded-lg hover:bg-accent-primary/20 transition-colors">
                <PlusIcon className="w-4 h-4" /> Add Level
            </button>
        </div>
    </div>
  );
};

export default StoryArcsTab;
