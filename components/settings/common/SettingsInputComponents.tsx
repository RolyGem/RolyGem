import React from 'react';
import type { CustomThemeColors } from '../../../types';

/**
 * This file contains all the common, reusable UI components used throughout
 * the various tabs in the SettingsModal. This promotes consistency and
 * reduces code duplication.
 */

// --- Helper Components ---

export const getStatusIndicator = (status: 'idle' | 'loading' | 'success' | 'error', errorMsg?: string | null, successText?: string) => {
    switch (status) {
        case 'success': return <span className="text-sm text-green-500">{successText || 'Connected'}</span>;
        case 'loading': return <span className="text-sm text-yellow-500">Connecting...</span>;
        case 'error': return <span className="text-sm text-red-500">{errorMsg || 'Connection Failed'}</span>;
        default: return <span className="text-sm text-text-secondary">Not Connected</span>;
    }
};

// --- Input Components ---

export const SliderInput = ({ label, value, min, max, step, onChange, name, helpText, dataType = 'float' }: { label: string, value: number, min: number, max: number, step: number, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, name: string, helpText: string, dataType?: 'float' | 'integer' }) => (
    <div>
        <label className="block text-sm font-medium">{label}</label>
        <div className="flex items-center gap-4 mt-1">
            <input
                type="range"
                name={name}
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={onChange}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            />
            <span className="text-sm font-mono w-16 text-center text-text-secondary">{dataType === 'float' ? value.toFixed(2) : value}</span>
        </div>
         <p className="text-xs text-text-secondary mt-1">{helpText}</p>
    </div>
);

export const NumberInput = ({ label, name, value, onChange, placeholder }: { label: string, name: string, value: number | string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, placeholder?: string }) => (
     <div>
        <label htmlFor={name} className="block text-sm font-medium">{label}</label>
        <input
            type="number"
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 modal-input"
        />
    </div>
);

// FIX: Add optional helpText prop to TextInput component for consistency.
export const TextInput = ({ label, name, value, onChange, placeholder, helpText }: { label: string, name: string, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, placeholder?: string, helpText?: string }) => (
     <div>
        <label htmlFor={name} className="block text-sm font-medium">{label}</label>
        <input
            type="text"
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 modal-input"
        />
        {helpText && <p className="text-xs text-text-secondary mt-1">{helpText}</p>}
    </div>
);

export const TextareaInput = ({ label, name, value, onChange, rows = 3, placeholder, helpText }: { label: string, name: string, value: string, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void, rows?: number, placeholder?: string, helpText?: string }) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium">{label}</label>
        <textarea
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            rows={rows}
            placeholder={placeholder}
            className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 modal-input resize-none"
        />
        {helpText && <p className="text-xs text-text-secondary mt-1">{helpText}</p>}
    </div>
);

export const SelectInput = ({ label, name, value, onChange, options, disabled = false, helpText }: { label: string, name: string, value: string, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, options: string[] | { value: string; label: string }[], disabled?: boolean, helpText?: string }) => {
    const normalizedOptions: { value: string; label: string }[] = Array.isArray(options)
        ? options.map(opt => typeof opt === 'string' ? { value: opt, label: opt || 'None' } : opt)
        : [];
    return (
        <div>
            <label htmlFor={name} className="block text-sm font-medium">{label}</label>
            <select
                id={name}
                name={name}
                value={value}
                onChange={onChange}
                disabled={disabled}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border rounded-md focus:outline-none focus:ring-2 sm:text-sm disabled:opacity-50 modal-input"
            >
                {normalizedOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label || 'None'}</option>)}
            </select>
            {helpText && <p className="text-xs text-text-secondary mt-1">{helpText}</p>}
        </div>
    );
};

export const CheckboxInput = ({ label, name, checked, onChange, helpText }: { label: string, name: string, checked: boolean, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, helpText?: string }) => (
    <div>
        <label className="flex items-center gap-3 text-sm font-medium cursor-pointer">
            <input type="checkbox" name={name} checked={checked} onChange={onChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            <span>{label}</span>
        </label>
        {helpText && <p className="text-xs text-text-secondary mt-1 ml-7">{helpText}</p>}
    </div>
);

export const SegmentedControl: React.FC<{options: {label: string; value: string}[], value: string, onChange: (e: { target: {name: string, value: string}}) => void, name: string}> = ({ options, value, onChange, name }) => (
  <div className="flex w-full p-1 rounded-lg segmented-control">
    {options.map(opt => (
      <button
        key={opt.value}
        type="button"
        onClick={() => onChange({ target: { name, value: opt.value } })}
        className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors ${
          value === opt.value
            ? 'shadow segmented-control-btn-active'
            : 'text-text-secondary hover:opacity-80'
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

// --- Appearance Tab Components ---

export const ThemePreview: React.FC<{ label: string; style: string; selected: boolean; onClick: () => void; }> = ({ label, style, selected, onClick }) => (
    <div onClick={onClick} className={`cursor-pointer rounded-lg border-2 p-3 transition-all ${selected ? 'border-accent-primary ring-2 ring-accent-primary/50' : 'border-color hover:border-accent-primary/70'}`}>
        <div className={`w-full h-16 rounded-md flex items-center justify-center ${style}`}>
            <span className="font-semibold text-lg">{label}</span>
        </div>
        <p className="text-center text-sm font-medium mt-2">{label}</p>
    </div>
);

// FIX: Relax the 'name' prop type to 'string' to allow this component to be used for
// color settings outside of the CustomThemeColors object, like 'actionColor'.
export const ColorInput: React.FC<{ label: string; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }> = ({ label, name, value, onChange }) => (
    <div className="flex items-center justify-between">
        <label htmlFor={name} className="text-sm font-medium">{label}</label>
        <div className="flex items-center gap-2 p-1 border rounded-md border-color">
            <input type="color" id={name} name={name} value={value || '#000000'} onChange={onChange} className="w-6 h-6 border-none cursor-pointer bg-transparent" style={{'backgroundColor': 'transparent'}}/>
            <span className="font-mono text-sm">{value || 'Not set'}</span>
        </div>
    </div>
);

export const LiveThemePreview: React.FC<{ colors: CustomThemeColors }> = ({ colors }) => (
    <div className="p-4 rounded-lg border-2 grid grid-cols-2 gap-4" style={{ backgroundColor: colors.primaryBg, borderColor: colors.borderColor, color: colors.textColor }}>
      {/* Left Column */}
      <div className="space-y-3">
        <div className="p-2 rounded" style={{ backgroundColor: colors.secondaryBg }}>
          <h4 className="text-xs font-bold mb-1" style={{ color: colors.textColor }}>Sidebar</h4>
          <div className="p-1 text-xs rounded" style={{ backgroundColor: colors.listItemActiveBg, color: colors.listItemActiveText }}>Active Chat</div>
        </div>
        <div className="p-2 rounded" style={{ backgroundColor: colors.userMessageBg, color: colors.messageTextColor, fontSize: '0.75rem' }}>
            User message preview text.
        </div>
        <div className="p-2 rounded" style={{ backgroundColor: colors.modelMessageBg, color: colors.messageTextColor, fontSize: '0.75rem' }}>
            Model message preview text.
        </div>
      </div>
      {/* Right Column (Modal Preview) */}
      <div className="rounded-lg shadow-lg flex flex-col" style={{ backgroundColor: colors.modalBg, color: colors.modalTextColor, borderColor: colors.borderColor, borderWidth: '1px' }}>
        <div className="p-2 rounded-t-lg" style={{ backgroundColor: colors.modalHeaderBg }}>
            <h5 className="text-xs font-bold">Modal Header</h5>
        </div>
        <div className="p-2 flex-1">
             <input type="text" readOnly value="Input field" className="w-full p-1 text-xs rounded border" style={{ backgroundColor: colors.inputBg, borderColor: colors.borderColor, color: colors.modalTextColor }} />
        </div>
        <div className="p-2 flex justify-end gap-2 rounded-b-lg" style={{ backgroundColor: colors.modalFooterBg }}>
            <button className="px-2 py-0.5 text-xs rounded" style={{ backgroundColor: colors.buttonSecondaryBg, color: colors.buttonSecondaryTextColor }}>Cancel</button>
            <button className="px-2 py-0.5 text-xs rounded" style={{ backgroundColor: colors.accentColor, color: colors.accentText }}>Save</button>
        </div>
      </div>
    </div>
  );
