import React from 'react';
import type { Settings } from '../../../types';
import { CheckboxInput, SegmentedControl } from '../common/SettingsInputComponents';
import { DEFAULT_SETTINGS } from '../../../constants';

interface WritingStyleTabProps {
  settings: Settings;
  onLiveUpdate: (newSettings: Settings) => void;
}

/**
 * Renders the "Writing Style" tab in the settings modal.
 * This new component provides user controls for AI response behavior.
 */
const WritingStyleTab: React.FC<WritingStyleTabProps> = ({ settings, onLiveUpdate }) => {

  const handleWritingStyleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { target: { name: string, value: string } }) => {
    const { name, value } = e.target;
    
    const newWritingStyleSettings = {
      ...settings.writingStyle,
      [name]: value
    };
    onLiveUpdate({ ...settings, writingStyle: newWritingStyleSettings });
  };
  
  const handleUserAgencyChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value, type } = e.target;
      const checked = (e.target as HTMLInputElement).checked;

      const newAgencySettings = {
          ...settings.writingStyle.userAgency,
          [name]: type === 'checkbox' ? checked : value
      };
      
      onLiveUpdate({
          ...settings,
          writingStyle: {
              ...settings.writingStyle,
              userAgency: newAgencySettings
          }
      });
  };
  
  const handlePresetChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      const newPresets = {
          ...settings.writingStyle.presets,
          [name]: value
      };
      onLiveUpdate({
          ...settings,
          writingStyle: {
              ...settings.writingStyle,
              presets: newPresets
          }
      });
  };

  const handleResetUserAgency = () => {
      handleUserAgencyChange({ target: { name: 'prompt', value: DEFAULT_SETTINGS.writingStyle.userAgency.prompt, type: 'textarea' } } as any);
  };
  
  const handleResetPreset = () => {
      // FIX: The type assertion was incorrect, as stylePreference can be 'none' which is not a key of presets.
      // Removing the assertion allows TypeScript to correctly infer the type and handle the comparison.
      const key = settings.writingStyle.stylePreference;
      if (key === 'custom' || key === 'none') return;
      
      const newPresets = {
          ...settings.writingStyle.presets,
          [key]: DEFAULT_SETTINGS.writingStyle.presets[key]
      };
       onLiveUpdate({
          ...settings,
          writingStyle: {
              ...settings.writingStyle,
              presets: newPresets
          }
      });
  };
  
  // FIX: The type assertion was incorrect, as stylePreference can be 'none' which is not a key of presets.
  // Removing the assertion allows TypeScript to correctly infer the type and handle the comparison.
  const selectedStyleKey = settings.writingStyle.stylePreference;
  const canResetPreset = ['dialogueHeavy', 'balanced', 'descriptionHeavy'].includes(selectedStyleKey);
  const showPresetEditor = selectedStyleKey !== 'none';
  
  const selectedStyleKeyForEditor = selectedStyleKey as keyof typeof settings.writingStyle.presets;
  
  return (
    <div className="p-3 sm:p-4 md:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1">
        <h3 className="text-base sm:text-lg font-semibold">Writing Style & Control</h3>
        <p className="text-xs sm:text-sm text-text-secondary -mt-2 sm:-mt-4">
            Configure the core rules for how the AI generates responses, balancing between narrative description and interactive dialogue.
        </p>

        <div className="space-y-4 p-4 border rounded-lg border-color">
            <CheckboxInput
                label="Enforce User Agency (Recommended)"
                name="enabled"
                checked={settings.writingStyle.userAgency.enabled}
                onChange={handleUserAgencyChange}
                helpText="Strictly prevents the AI from controlling your character's actions, thoughts, or feelings."
            />
            {settings.writingStyle.userAgency.enabled && (
                 <div className="pl-7 space-y-2">
                    <textarea 
                        name="prompt"
                        value={settings.writingStyle.userAgency.prompt}
                        onChange={handleUserAgencyChange}
                        rows={5}
                        className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 text-sm modal-input font-mono"
                        spellCheck="false"
                    />
                     <button onClick={handleResetUserAgency} className="btn-settings-sm btn-secondary">
                        Reset to Default
                    </button>
                 </div>
            )}
        </div>

        <div className="space-y-4 p-4 border rounded-lg border-color">
            <label className="block text-sm font-medium">Writing Style Preference</label>
            <SegmentedControl
                name="stylePreference"
                value={settings.writingStyle.stylePreference}
                onChange={handleWritingStyleChange}
                options={[
                    { label: 'Dialogue Heavy', value: 'dialogueHeavy' },
                    { label: 'Balanced', value: 'balanced' },
                    { label: 'Desc. Heavy', value: 'descriptionHeavy' },
                    { label: 'Custom', value: 'custom' },
                    { label: 'None', value: 'none' }
                ]}
            />
             {showPresetEditor ? (
                 <div className="space-y-2">
                    <textarea
                        name={selectedStyleKeyForEditor}
                        value={settings.writingStyle.presets[selectedStyleKeyForEditor]}
                        onChange={handlePresetChange}
                        rows={8}
                        className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 text-sm modal-input font-mono"
                        spellCheck="false"
                    />
                    {canResetPreset && (
                        <button onClick={handleResetPreset} className="btn-settings-sm btn-secondary">
                            Reset to Default
                        </button>
                    )}
                </div>
             ) : (
                <p className="text-xs text-text-secondary mt-1">
                    No specific writing style will be enforced. The AI will have full creative freedom.
                </p>
             )}
        </div>
    </div>
  );
};

export default WritingStyleTab;