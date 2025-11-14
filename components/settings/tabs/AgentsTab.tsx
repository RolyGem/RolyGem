import React from 'react';
import type { Settings } from '../../../types';
import { CheckboxInput, SliderInput, SegmentedControl } from '../common/SettingsInputComponents';
import { CollapsibleNotice } from '../../common/CollapsibleNotice';

interface AgentsTabProps {
  settings: Settings;
  onLiveUpdate: (newSettings: Settings) => void;
}

/**
 * Renders the "AI Agents" tab in the settings modal.
 * This component contains settings for autonomous agents like Director AI and Living Lore.
 */
const AgentsTab: React.FC<AgentsTabProps> = ({ settings, onLiveUpdate }) => {

  const handleAgentInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    const [agent, field] = name.split('.');

    const agentKey = agent as 'directorAI' | 'livingLore';
    const newAgentSettings = {
        ...settings[agentKey],
        [field]: type === 'checkbox' ? checked : parseInt(value, 10)
    };
    onLiveUpdate({ ...settings, [agentKey]: newAgentSettings });
  };
  
  return (
    <div className="p-6 overflow-y-auto space-y-6 flex-1">
        <h3 className="text-lg font-semibold">AI Agents</h3>
         <p className="text-sm text-text-secondary -mt-4">
             Enable autonomous AI agents to enhance your storytelling experience.
         </p>

        {/* Manual Usage Notice */}
        <CollapsibleNotice
            title="Manual Trigger Available"
            variant="green"
            icon="💡"
            defaultExpanded={false}
        >
            <p>
                You can manually trigger AI Agents at any time using the <strong>"Tools"</strong> menu in the chat input, even if automatic intervention is disabled.
            </p>
        </CollapsibleNotice>

        {/* Important Notice */}
        <CollapsibleNotice
            title="Smart AI Systems Active"
            variant="green"
            icon="✨"
            defaultExpanded={false}
        >
            <p>
                All AI agents now use <strong>intelligent detection</strong> instead of fixed intervals. 
                They activate only when needed based on conversation context, dramatically reducing API costs (70-85% savings!) while maintaining quality.
            </p>
            <p className="pt-2">
                <strong>Note:</strong> Smart mode is configured per-conversation in the Authors Note panel. 
                The settings below apply to the traditional frequency mode (if enabled per-conversation).
            </p>
        </CollapsibleNotice>

        <div className="space-y-4 p-4 border rounded-lg border-color">
            <CheckboxInput
                label="Enable Director AI"
                name="directorAI.enabled"
                checked={settings.directorAI.enabled}
                onChange={handleAgentInputChange}
                helpText="🎬 Injects dramatic events and plot twists. Smart mode detects stagnant conversations and intervenes only when drama is needed."
            />
             <div className={`space-y-4 pl-7 ${!settings.directorAI.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                <CheckboxInput
                    label="Enable Automatic Intervention"
                    name="directorAI.automatic"
                    checked={settings.directorAI.automatic}
                    onChange={handleAgentInputChange}
                    helpText="If disabled, the Director AI will only intervene when manually triggered."
                />
                <div className={`${!settings.directorAI.automatic ? 'opacity-50 pointer-events-none' : ''}`}>
                    <SliderInput 
                        label="Intervention Frequency (Fallback)" 
                        value={settings.directorAI.frequency} min={2} max={30} step={1} 
                        onChange={handleAgentInputChange} 
                        name="directorAI.frequency" 
                        helpText="⚙️ Used only if smart mode is disabled per-conversation. How many message pairs to wait before intervening." 
                        dataType="integer" 
                    />
                </div>
                <SliderInput 
                    label="Message Scan Depth" 
                    value={settings.directorAI.scanDepth} 
                    min={4} max={50} step={2} 
                    onChange={handleAgentInputChange} 
                    name="directorAI.scanDepth" 
                    helpText="How many recent messages to analyze for context (applies to both smart and frequency modes)." 
                    dataType="integer" 
                />
            </div>
        </div>
         <div className="space-y-4 p-4 border rounded-lg border-color">
            <CheckboxInput
                label="Enable Living Lore & Characters"
                name="livingLore.enabled"
                checked={settings.livingLore.enabled}
                onChange={handleAgentInputChange}
                helpText="📚 Detects significant events and suggests character sheet updates. Smart mode analyzes event importance before triggering."
            />
             <div className={`space-y-4 pl-7 ${!settings.livingLore.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                <CheckboxInput
                    label="Enable Automatic Suggestions"
                    name="livingLore.automatic"
                    checked={settings.livingLore.automatic}
                    onChange={handleAgentInputChange}
                    helpText="Automatically suggests character updates as the story progresses (smart mode: only for significant events)."
                />
                 <SliderInput 
                    label="Message Scan Depth" 
                    value={settings.livingLore.scanDepth} 
                    min={4} max={30} step={2} 
                    onChange={handleAgentInputChange} 
                    name="livingLore.scanDepth" 
                    helpText="How many recent messages to analyze (applies to both smart and frequency modes)." 
                    dataType="integer" 
                />
            </div>
        </div>
    </div>
  );
};

export default AgentsTab;
