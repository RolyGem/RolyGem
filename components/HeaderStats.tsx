import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Conversation, Settings, Model } from '../types';
import { BarChartIcon } from './icons/BarChartIcon';
import { TrendingUpIcon } from './icons/TrendingUpIcon';
import { TokenIcon } from './icons/TokenIcon';
import { countTokens } from '../services/ai/contextManager';

interface HeaderStatsProps {
    conversation: Conversation;
    settings: Settings;
    selectedModel: Model;
    isStreaming: boolean;
}

const HeaderStats: React.FC<HeaderStatsProps> = ({ conversation, settings, selectedModel, isStreaming }) => {
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [position, setPosition] = useState({ top: 0, right: 0 });
    
    const [tokenStats, setTokenStats] = useState({
        totalTokens: 0,
        maxTokens: 8192,
        tokenUsagePercentage: 0,
    });

    const calculateStats = useCallback(async () => {
        const tokensPromises = conversation.messages.map(msg => {
            const contentToCount = msg.summary || msg.content;
            return countTokens(contentToCount, selectedModel, settings);
        });
        const messageTokensArray = await Promise.all(tokensPromises);
        const messageTokens = messageTokensArray.reduce((acc, val) => acc + val, 0);

        const max = settings.contextManagement.maxContextTokens ?? selectedModel.contextLengthTokens ?? 8192;
        const percentage = max > 0 ? Math.min((messageTokens / max) * 100, 100) : 0;
        
        setTokenStats({
            totalTokens: messageTokens,
            maxTokens: max,
            tokenUsagePercentage: percentage
        });
    }, [conversation.messages, settings, selectedModel]);

    useEffect(() => {
        if (!isStreaming) {
            calculateStats();
        }
    }, [isStreaming, conversation.messages, calculateStats]);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (
                buttonRef.current && !buttonRef.current.contains(event.target as Node) &&
                popoverRef.current && !popoverRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);
    
    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + 8,
                right: window.innerWidth - rect.right,
            });
        }
    }, [isOpen]);

    const storyArcStats = useMemo(() => {
        if (!conversation.storyArcsEnabled) return null;
        const currentLevel = conversation.currentLevel || 1;
        const progress = conversation.messageProgress || 0;
        const levelDef = settings.storyArcs.levels.find(l => l.level === currentLevel);
        const messagesToNext = levelDef?.messagesToNext || 1;
        const percentage = Math.min((progress / messagesToNext) * 100, 100);
        return { currentLevel, progress, messagesToNext, percentage };
    }, [conversation.storyArcsEnabled, conversation.currentLevel, conversation.messageProgress, settings.storyArcs.levels]);

    const tokenBarColor = tokenStats.tokenUsagePercentage > 90 ? 'bg-red-500' : (tokenStats.tokenUsagePercentage > 70 ? 'bg-yellow-500' : 'bg-accent-primary');

    const popoverContent = (
        <div
            ref={popoverRef}
            className="fixed w-48 bg-secondary-bg/80 backdrop-blur-md border border-color/50 rounded-xl shadow-2xl z-[9999] p-3 space-y-3"
            style={{ 
                top: `${position.top}px`, 
                right: `${position.right}px`,
            }}
        >
            {storyArcStats && (
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm text-text-primary">
                        <div className="flex items-center gap-2 font-semibold">
                            <TrendingUpIcon className="w-4 h-4 text-accent-primary" />
                            <span>Level {storyArcStats.currentLevel}</span>
                        </div>
                        <span className="font-mono text-xs">{storyArcStats.progress}/{storyArcStats.messagesToNext}</span>
                    </div>
                    <div className="w-full bg-tertiary-bg rounded-full h-1.5">
                        <div className="bg-accent-primary h-1.5 rounded-full" style={{ width: `${storyArcStats.percentage}%` }}></div>
                    </div>
                </div>
            )}
            <div className="space-y-1.5">
                 <div className="flex items-center justify-between text-sm text-text-primary">
                     <div className="flex items-center gap-2 font-semibold">
                        <TokenIcon className="w-4 h-4 text-accent-primary" />
                        <span>Tokens</span>
                    </div>
                    <span className="font-mono text-xs">{tokenStats.totalTokens.toLocaleString()}/{tokenStats.maxTokens.toLocaleString()}</span>
                </div>
                 <div className="w-full bg-tertiary-bg rounded-full h-1.5">
                    <div className={`${tokenBarColor} h-1.5 rounded-full`} style={{ width: `${tokenStats.tokenUsagePercentage}%` }}></div>
                </div>
                <p className="text-[7px] text-text-secondary/45 leading-none mt-0.5">Estimate may vary - models differ</p>
            </div>
        </div>
    );

    return (
        <>
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(p => !p)}
                className="p-1.5 sm:p-2 rounded-full hover:bg-slate-200 dark:hover:bg-gray-800"
                aria-label="View conversation statistics"
                title="Conversation Statistics"
            >
                <BarChartIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            {isOpen && createPortal(popoverContent, document.body)}
        </>
    );
};

export default HeaderStats;
