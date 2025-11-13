import React from 'react';
import { useRadio } from '../contexts/RadioContext';
import { RadioIcon } from './icons/RadioIcon';

const Equalizer: React.FC = () => (
    <div className="flex items-end gap-0.5 h-3 w-3">
        <span className="equalizer-bar w-0.5 bg-accent-primary" style={{ height: '100%' }} />
        <span className="equalizer-bar w-0.5 bg-accent-primary" style={{ height: '60%' }} />
        <span className="equalizer-bar w-0.5 bg-accent-primary" style={{ height: '80%' }} />
        <span className="equalizer-bar w-0.5 bg-accent-primary" style={{ height: '40%' }} />
    </div>
);

export const RadioPill: React.FC = () => {
    const { openPlayer, isPlaying, currentStation } = useRadio();
    
    const content = isPlaying && currentStation ? (
        <>
            <Equalizer />
            <span className="truncate text-xs font-semibold text-text-primary">{currentStation.name}</span>
        </>
    ) : (
        <>
            <RadioIcon className="w-4 h-4" />
            <span className="text-xs font-semibold">Live Radio</span>
        </>
    );

    return (
        <button
            onClick={openPlayer}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full radio-pill transition-all duration-300 ease-in-out ${isPlaying && currentStation ? 'w-48' : 'w-28'}`}
        >
            {content}
        </button>
    );
};