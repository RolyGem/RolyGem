import React, { useState, useEffect, useCallback } from 'react';
import { useRadio } from '../contexts/RadioContext';
import { getArabicStations, searchRadioStations, type RadioStation } from '../services/radioService';
import { PlayIcon } from './icons/PlayIcon';
import { PauseIcon } from './icons/PauseIcon';
import { XIcon } from './icons/XIcon';
import { LoaderIcon } from './icons/LoaderIcon';

const StationItem: React.FC<{ station: RadioStation, onPlay: (station: RadioStation) => void }> = ({ station, onPlay }) => (
    <button
        onClick={() => onPlay(station)}
        className="w-full text-left p-3 md:p-3.5 rounded-xl flex items-center gap-3 md:gap-4 transition-all duration-200 list-item hover:shadow-lg group border-2 border-transparent hover:border-accent-color/30"
    >
        <div className="relative flex-shrink-0">
            <img 
                src={station.favicon || 'https://via.placeholder.com/64'} 
                alt={`${station.name} favicon`} 
                className="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-tertiary-bg object-cover border-2 border-border-color group-hover:border-accent-color transition-all shadow-md"
                onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/64')}
            />
            <div className="absolute inset-0 rounded-xl bg-accent-color/0 group-hover:bg-accent-color/20 transition-colors flex items-center justify-center backdrop-blur-sm">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-accent-color/0 group-hover:bg-accent-color flex items-center justify-center transition-all scale-0 group-hover:scale-100">
                    <PlayIcon className="w-4 h-4 md:w-5 md:h-5 text-accent-text" />
                </div>
            </div>
        </div>
        <div className="flex-1 min-w-0">
            <p className="font-bold text-base md:text-lg truncate text-text-primary group-hover:text-accent-color transition-colors mb-0.5">{station.name}</p>
            <p className="text-xs md:text-sm text-text-secondary truncate font-medium">{station.country} • {station.tags || 'Music'}</p>
        </div>
        <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-8 h-8 rounded-full bg-accent-color/10 flex items-center justify-center">
                <span className="text-accent-color text-lg">▶</span>
            </div>
        </div>
    </button>
);

export const RadioOverlay: React.FC = () => {
    const {
        isPlayerOpen,
        closePlayer,
        currentStation,
        isPlaying,
        isLoading,
        volume,
        playStation,
        togglePlayPause,
        setVolume
    } = useRadio();

    const [stations, setStations] = useState<RadioStation[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchDefaultStations = useCallback(async () => {
        setIsSearching(true);
        const results = await getArabicStations();
        setStations(results);
        setIsSearching(false);
    }, []);

    useEffect(() => {
        if (isPlayerOpen && stations.length === 0 && !searchTerm) {
            fetchDefaultStations();
        }
    }, [isPlayerOpen, stations.length, searchTerm, fetchDefaultStations]);

    const handleSearch = async () => {
        if (!searchTerm.trim()) {
            fetchDefaultStations();
            return;
        }
        setIsSearching(true);
        const results = await searchRadioStations(searchTerm);
        setStations(results);
        setIsSearching(false);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setVolume(parseFloat(e.target.value));
    };

    if (!isPlayerOpen) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-primary-bg/95 backdrop-blur-md transition-opacity duration-300 p-2 md:p-4"
            onClick={closePlayer}
        >
            <div
                className="w-full max-w-6xl h-full max-h-[90vh] bg-secondary-bg border-2 border-border-color rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 md:px-6 py-4 border-b-2 border-border-color flex justify-between items-center flex-shrink-0 bg-secondary-bg">
                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-accent-color animate-pulse shadow-lg shadow-accent-color/50"></div>
                        <h2 className="text-xl md:text-2xl font-bold text-text-primary">Live Radio</h2>
                    </div>
                    <button 
                        onClick={closePlayer} 
                        className="p-2.5 rounded-lg hover:bg-list-item-hover-bg transition-colors border border-transparent hover:border-border-color"
                        aria-label="Close radio player"
                    >
                        <XIcon className="w-5 h-5 md:w-6 md:h-6 text-text-secondary hover:text-text-primary" />
                    </button>
                </div>
                
                <div className="flex-1 flex flex-col md:flex-row min-h-0">
                    {/* Now Playing */}
                    <aside className="w-full md:w-[40%] border-b-2 md:border-b-0 md:border-r-2 border-border-color flex flex-col items-center justify-center p-6 md:p-10 text-center bg-tertiary-bg">
                        {currentStation ? (
                            <>
                                <div className="relative group mb-6">
                                    <div className="absolute -inset-1 bg-gradient-to-r from-accent-color to-accent-primary-hover rounded-2xl opacity-20 group-hover:opacity-30 blur transition-opacity"></div>
                                    <img
                                        src={currentStation.favicon || 'https://via.placeholder.com/200'}
                                        alt="station art"
                                        className="relative w-40 h-40 md:w-48 md:h-48 lg:w-56 lg:h-56 rounded-2xl shadow-2xl bg-secondary-bg object-cover border-2 border-border-color"
                                        onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/200')}
                                    />
                                    {isPlaying && (
                                        <div className="absolute top-3 right-3 px-3 py-1.5 bg-accent-color text-accent-text text-xs font-bold rounded-full shadow-lg border border-accent-primary-hover backdrop-blur-sm animate-pulse">
                                            ● LIVE
                                        </div>
                                    )}
                                </div>
                                <h3 className="text-xl md:text-2xl font-bold text-text-primary line-clamp-2 mb-2">{currentStation.name}</h3>
                                <p className="text-sm md:text-base text-text-secondary">{currentStation.country}</p>
                                <div className="mt-8 flex items-center gap-4">
                                    <button 
                                        onClick={togglePlayPause} 
                                        className="p-4 md:p-5 rounded-full new-chat-btn shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110 border-2 border-accent-primary-hover"
                                        aria-label={isPlaying ? 'Pause' : 'Play'}
                                    >
                                        {isLoading ? <LoaderIcon className="w-7 h-7 md:w-9 md:h-9"/> : isPlaying ? <PauseIcon className="w-7 h-7 md:w-9 md:h-9" /> : <PlayIcon className="w-7 h-7 md:w-9 md:h-9" />}
                                    </button>
                                </div>
                                <div className="w-full mt-8 px-4">
                                    <div className="flex items-center gap-3 text-sm text-text-secondary mb-3 font-medium">
                                        <span className="text-base">🔈</span>
                                        <span className="flex-1 text-center text-accent-color font-bold">{Math.round(volume * 100)}%</span>
                                        <span className="text-base">🔊</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0" max="1" step="0.01"
                                        value={volume}
                                        onChange={handleVolumeChange}
                                        className="w-full volume-slider"
                                        aria-label="Volume control"
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="text-text-secondary flex flex-col items-center gap-4">
                                <div className="w-28 h-28 md:w-32 md:h-32 rounded-2xl bg-secondary-bg border-2 border-border-color flex items-center justify-center shadow-lg">
                                    <span className="text-5xl md:text-6xl">📻</span>
                                </div>
                                <p className="text-base md:text-lg font-medium text-text-primary">Select a station</p>
                                <p className="text-sm text-text-secondary">Choose from the list to start listening</p>
                            </div>
                        )}
                    </aside>

                    {/* Station List */}
                    <main className="flex-1 flex flex-col min-h-0 bg-secondary-bg">
                        <div className="p-4 md:p-5 border-b-2 border-border-color">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="Search stations by name, country, or genre..."
                                className="w-full p-3 md:p-3.5 border-2 border-border-color rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-color focus:border-accent-color text-sm md:text-base modal-input transition-all"
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2">
                            {isSearching ? (
                                <div className="flex flex-col justify-center items-center h-full gap-3">
                                    <LoaderIcon className="w-10 h-10 text-accent-color" />
                                    <p className="text-text-secondary text-sm">Loading stations...</p>
                                </div>
                            ) : stations.length > 0 ? (
                                stations.map(station => <StationItem key={station.stationuuid} station={station} onPlay={playStation} />)
                            ) : (
                                <div className="text-center py-16 text-text-secondary">
                                    <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-tertiary-bg border-2 border-border-color flex items-center justify-center">
                                        <span className="text-4xl">🔍</span>
                                    </div>
                                    <p className="font-semibold text-lg text-text-primary mb-1">No stations found</p>
                                    <p className="text-sm">Try a different search term</p>
                                </div>
                            )}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
};
// Fix: Add a default export to make the component compatible with React.lazy().
export default RadioOverlay;