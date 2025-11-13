import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';
import { type RadioStation } from '../services/radioService';

interface RadioContextType {
    currentStation: RadioStation | null;
    isPlaying: boolean;
    isLoading: boolean;
    volume: number;
    isPlayerOpen: boolean;
    playStation: (station: RadioStation) => void;
    togglePlayPause: () => void;
    setVolume: (volume: number) => void;
    openPlayer: () => void;
    closePlayer: () => void;
}

const RadioContext = createContext<RadioContextType | undefined>(undefined);

export const useRadio = (): RadioContextType => {
    const context = useContext(RadioContext);
    if (!context) {
        throw new Error('useRadio must be used within a RadioProvider');
    }
    return context;
};

export const RadioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentStation, setCurrentStation] = useState<RadioStation | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [volume, setVolumeState] = useState(0.5);
    const [isPlayerOpen, setIsPlayerOpen] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    const playStation = useCallback((station: RadioStation) => {
        setCurrentStation(station);
        setIsLoading(true);
        if (audioRef.current) {
            audioRef.current.src = station.url_resolved;
            audioRef.current.volume = volume;
            audioRef.current.play().catch(e => {
                console.error("Playback error:", e);
                setIsLoading(false);
                setIsPlaying(false);
            });
        }
    }, [volume]);

    const togglePlayPause = useCallback(() => {
        if (!audioRef.current || !currentStation) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
    }, [isPlaying, currentStation]);

    const setVolume = useCallback((newVolume: number) => {
        setVolumeState(newVolume);
        if (audioRef.current) {
            audioRef.current.volume = newVolume;
        }
    }, []);

    const openPlayer = useCallback(() => setIsPlayerOpen(true), []);
    const closePlayer = useCallback(() => setIsPlayerOpen(false), []);
    
    return (
        <RadioContext.Provider value={{ currentStation, isPlaying, isLoading, volume, isPlayerOpen, playStation, togglePlayPause, setVolume, openPlayer, closePlayer }}>
            <audio
                ref={audioRef}
                onPlay={() => { setIsPlaying(true); setIsLoading(false); }}
                onPause={() => setIsPlaying(false)}
                onError={(e) => { 
                    setIsLoading(false); 
                    setIsPlaying(false); 
                    console.error("Audio playback error:", e); 
                    // Maybe add a notification to the user here
                }}
                onWaiting={() => setIsLoading(true)}
                onCanPlay={() => setIsLoading(false)}
            />
            {children}
        </RadioContext.Provider>
    );
};