import React from 'react';
import type { Settings, CustomThemeColors } from '../../../types';
import { FONT_FAMILIES } from '../../../constants';
import { SliderInput, SelectInput, CheckboxInput, ThemePreview, ColorInput, LiveThemePreview, SegmentedControl } from '../common/SettingsInputComponents';

interface AppearanceTabProps {
  settings: Settings;
  onLiveUpdate: (newSettings: Settings) => void;
}

/**
 * Renders the "Appearance" tab in the settings modal.
 * This component manages all visual customization settings, including themes,
 * fonts, and layout options.
 */
const AppearanceTab: React.FC<AppearanceTabProps> = ({ settings, onLiveUpdate }) => {

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | { target: { name: string, value: string } }) => {
    const { name, value } = e.target;
    const isCheckbox = (e.target as HTMLInputElement).type === 'checkbox';
    const checked = (e.target as HTMLInputElement).checked;

    onLiveUpdate({ ...settings, [name]: isCheckbox ? checked : value });
  };
  
  const handleColorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onLiveUpdate({ ...settings, [name]: value });
  };

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onLiveUpdate({
        ...settings,
        customThemeColors: {
            ...settings.customThemeColors,
            [name]: value
        }
    });
  };
  
  const handleNumericSettingChange = (name: keyof Settings, value: string, isFloat: boolean) => {
    const parsedValue = isFloat ? parseFloat(value) : parseInt(value);
    if (!isNaN(parsedValue)) {
      onLiveUpdate({ ...settings, [name]: parsedValue as any });
    }
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        if (file.size > 2 * 1024 * 1024) { // 2MB limit
            alert("File is too large. Please select an image under 2MB.");
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            onLiveUpdate({ ...settings, chatBackground: reader.result as string });
        };
        reader.readAsDataURL(file);
    }
  };

  const handleRemoveBackground = () => {
      onLiveUpdate({ ...settings, chatBackground: null });
  };
  
  return (
    <div className="p-3 sm:p-4 md:p-6 overflow-y-auto space-y-4 sm:space-y-6 md:space-y-8 flex-1">
        <div>
            <h3 className="text-lg font-semibold">Theme</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <ThemePreview label="Light" style="bg-slate-100 text-slate-800" selected={settings.theme === 'light'} onClick={() => onLiveUpdate({ ...settings, theme: 'light' })} />
                <ThemePreview label="Dark" style="bg-gray-900 text-gray-200" selected={settings.theme === 'dark'} onClick={() => onLiveUpdate({ ...settings, theme: 'dark' })} />
                <ThemePreview label="Custom" style="bg-gradient-to-br from-blue-500 to-purple-600 text-white" selected={settings.theme === 'custom'} onClick={() => onLiveUpdate({ ...settings, theme: 'custom' })} />
            </div>
        </div>

        {settings.theme === 'custom' && (
            <div className="space-y-4 p-4 border rounded-lg bg-tertiary-bg/20 border-color">
                <h4 className="text-md font-semibold mb-4">Live Preview</h4>
                <LiveThemePreview colors={settings.customThemeColors} />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 pt-4">
                    <ColorInput label="Primary BG" name="primaryBg" value={settings.customThemeColors.primaryBg} onChange={handleCustomColorChange} />
                    <ColorInput label="Secondary BG" name="secondaryBg" value={settings.customThemeColors.secondaryBg} onChange={handleCustomColorChange} />
                    <ColorInput label="Tertiary BG" name="tertiaryBg" value={settings.customThemeColors.tertiaryBg} onChange={handleCustomColorChange} />
                    <ColorInput label="Primary Text" name="textColor" value={settings.customThemeColors.textColor} onChange={handleCustomColorChange} />
                    <ColorInput label="Secondary Text" name="textSecondary" value={settings.customThemeColors.textSecondary} onChange={handleCustomColorChange} />
                    <ColorInput label="Border" name="borderColor" value={settings.customThemeColors.borderColor} onChange={handleCustomColorChange} />
                    <ColorInput label="Accent" name="accentColor" value={settings.customThemeColors.accentColor} onChange={handleCustomColorChange} />
                    <ColorInput label="Accent Hover" name="accentPrimaryHover" value={settings.customThemeColors.accentPrimaryHover} onChange={handleCustomColorChange} />
                    <ColorInput label="Accent Text" name="accentText" value={settings.customThemeColors.accentText} onChange={handleCustomColorChange} />
                    <ColorInput label="Message Text" name="messageTextColor" value={settings.customThemeColors.messageTextColor} onChange={handleCustomColorChange} />
                    <ColorInput label="User Message BG" name="userMessageBg" value={settings.customThemeColors.userMessageBg} onChange={handleCustomColorChange} />
                    <ColorInput label="Model Message BG" name="modelMessageBg" value={settings.customThemeColors.modelMessageBg} onChange={handleCustomColorChange} />
                    <ColorInput label="List Hover BG" name="listItemHoverBg" value={settings.customThemeColors.listItemHoverBg} onChange={handleCustomColorChange} />
                    <ColorInput label="List Active BG" name="listItemActiveBg" value={settings.customThemeColors.listItemActiveBg} onChange={handleCustomColorChange} />
                    <ColorInput label="List Active Text" name="listItemActiveText" value={settings.customThemeColors.listItemActiveText} onChange={handleCustomColorChange} />
                    <ColorInput label="Segmented BG" name="segmentedControlBg" value={settings.customThemeColors.segmentedControlBg} onChange={handleCustomColorChange} />
                    <ColorInput label="Segmented Active BG" name="segmentedControlActiveBg" value={settings.customThemeColors.segmentedControlActiveBg} onChange={handleCustomColorChange} />
                    <ColorInput label="Segmented Active Text" name="segmentedControlActiveText" value={settings.customThemeColors.segmentedControlActiveText} onChange={handleCustomColorChange} />
                    <ColorInput label="Modal Header BG" name="modalHeaderBg" value={settings.customThemeColors.modalHeaderBg} onChange={handleCustomColorChange} />
                    <ColorInput label="Modal Footer BG" name="modalFooterBg" value={settings.customThemeColors.modalFooterBg} onChange={handleCustomColorChange} />
                    <ColorInput label="Input BG" name="inputBg" value={settings.customThemeColors.inputBg} onChange={handleCustomColorChange} />
                    <ColorInput label="Scrollbar Thumb" name="scrollbarThumbBg" value={settings.customThemeColors.scrollbarThumbBg} onChange={handleCustomColorChange} />
                    <ColorInput label="Scrollbar Track" name="scrollbarTrackBg" value={settings.customThemeColors.scrollbarTrackBg} onChange={handleCustomColorChange} />
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
                 <h3 className="text-lg font-semibold">Typography</h3>
                <SelectInput label="Font Family" name="fontFamily" value={settings.fontFamily} onChange={(e) => handleInputChange(e)} options={FONT_FAMILIES} />
                <SliderInput 
                    label="Font Size" value={settings.fontSize} min={12} max={18} step={1} 
                    onChange={(e) => handleNumericSettingChange('fontSize', e.target.value, false)} name="fontSize" 
                    helpText="Controls the base font size for UI and messages." dataType="integer" 
                />
                 <SliderInput 
                    label="Line Height" value={settings.lineHeight} min={1.4} max={1.9} step={0.1} 
                    onChange={(e) => handleNumericSettingChange('lineHeight', e.target.value, true)} name="lineHeight" 
                    helpText="Adjusts spacing between lines of text."
                />
            </div>
            <div className="space-y-6">
                <h3 className="text-lg font-semibold">Chat Interface</h3>
                 <div>
                    <label className="block text-sm font-medium mb-2">Message Style</label>
                    <SegmentedControl name="messageStyle" value={settings.messageStyle} onChange={(e) => handleInputChange(e)} options={[{label: 'Bubble', value: 'bubble'}, {label: 'Document', value: 'document'}]} />
                    <p className="text-xs text-text-secondary mt-1">'Bubble' uses classic chat bubbles. 'Document' shows text plainly for a book-like feel.</p>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-2">Message Bubble Corners</label>
                    <SegmentedControl name="messageBubbleStyle" value={settings.messageBubbleStyle} onChange={(e) => handleInputChange(e)} options={[{label: 'Sharp', value: 'sharp'}, {label: 'Soft', value: 'soft'}, {label: 'Rounded', value: 'rounded'}]} />
                </div>
                <div className="space-y-4 p-4 border rounded-lg border-color">
                    <h4 className="font-semibold text-md">Dialogue Highlighting</h4>
                    <p className="text-xs text-text-secondary -mt-2">Highlight dialogue ("...") only. Pick custom colors or use smart defaults.</p>
                    <CheckboxInput 
                        label={'Highlight dialogue ("...")'}
                        name="highlightDialogue"
                        checked={settings.highlightDialogue}
                        onChange={(e) => handleInputChange(e)}
                    />
                    <div className={`${settings.highlightDialogue ? '' : 'opacity-50 pointer-events-none'}`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <ColorInput label="Dialogue Color (Light)" name="dialogueColorLight" value={settings.dialogueColorLight || ''} onChange={handleColorInputChange} />
                            <ColorInput label="Dialogue Color (Dark)" name="dialogueColorDark" value={settings.dialogueColorDark || ''} onChange={handleColorInputChange} />
                        </div>
                        <p className="text-xs text-text-secondary">Leave blank to use recommended defaults.</p>
                    </div>
                </div>
                <SliderInput 
                    label="Message Spacing" value={settings.messageSpacing} min={0.5} max={1.5} step={0.1} 
                    onChange={(e) => handleNumericSettingChange('messageSpacing', e.target.value, true)} name="messageSpacing" 
                    helpText="Adjust the padding of message bubbles."
                />
                 <SliderInput 
                    label="Desktop Horizontal Padding (%)" value={settings.desktopPadding} min={0} max={25} step={1} 
                    onChange={(e) => handleNumericSettingChange('desktopPadding', e.target.value, false)} name="desktopPadding" 
                    helpText="Pushes chat content away from the screen edges on large screens." dataType="integer" 
                />
                 <CheckboxInput label="Show Sender Names" name="showSenderNames" checked={settings.showSenderNames} onChange={(e) => handleInputChange(e)} helpText="Display 'You' and 'Gemini' above each message in Bubble style."/>
                 <CheckboxInput label="Show 'View Context' Button" name="showFullContextButton" checked={settings.showFullContextButton} onChange={(e) => handleInputChange(e)} helpText="For debugging, show a button on AI messages to view the full context sent for generation."/>
                 <CheckboxInput 
                    label="Gemini 2.5 Pro Foreshadowing" 
                    name="geminiProThinkingMessages" 
                    checked={settings.geminiProThinkingMessages} 
                    onChange={handleInputChange} 
                    helpText="While waiting for Gemini 2.5 Pro, show speculative 'thoughts' from a faster model."
                />
            </div>
        </div>
        
        <div className="space-y-6">
             <h3 className="text-lg font-semibold">Background</h3>
             <div>
                <label className="block text-sm font-medium">Custom Background</label>
                <div className="mt-2 flex items-center gap-4">
                    <label className="flex-1 cursor-pointer px-4 py-2 text-sm text-center font-medium rounded-lg transition-colors new-chat-btn">
                        Upload Image
                        <input type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleBackgroundUpload}/>
                    </label>
                    {settings.chatBackground && (
                         <button onClick={handleRemoveBackground} className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900/80">
                            Remove
                         </button>
                    )}
                </div>
                 {settings.chatBackground && (
                    <div className="mt-4 p-2 border rounded-lg border-color">
                        <p className="text-xs text-text-secondary mb-2">Preview:</p>
                        <div className="w-full h-24 rounded bg-cover bg-center" style={{backgroundImage: `url(${settings.chatBackground})`}}></div>
                    </div>
                 )}
            </div>
        </div>
    </div>
  );
};

export default AppearanceTab;
