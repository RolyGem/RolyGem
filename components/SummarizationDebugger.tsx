import React, { useState, useEffect } from 'react';
import { XIcon } from './icons/XIcon';
import { TrendingUpIcon } from './icons/TrendingUpIcon';
import { InfoIcon } from './icons/InfoIcon';
import { CheckIcon } from './icons/CheckIcon';
import { summarizationDebugService } from '../services/summarizationDebugService';
import type { SummarizationDebugLog, SummarizationSessionStats } from '../types';

interface SummarizationDebuggerProps {
    conversationId: string;
    isOpen: boolean;
    onClose: () => void;
}

export const SummarizationDebugger: React.FC<SummarizationDebuggerProps> = ({
    conversationId,
    isOpen,
    onClose
}) => {
    const [logs, setLogs] = useState<SummarizationDebugLog[]>([]);
    const [stats, setStats] = useState<SummarizationSessionStats | null>(null);
    const [insights, setInsights] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<'logs' | 'stats' | 'insights'>('logs');

    useEffect(() => {
        if (!isOpen) return;

        // Load initial data
        const conversationLogs = summarizationDebugService.getConversationLogs(conversationId);
        setLogs(conversationLogs);
        setStats(summarizationDebugService.getConversationStats(conversationId));
        setInsights(summarizationDebugService.getInsights(conversationId));

        // Subscribe to updates
        const unsubscribe = summarizationDebugService.subscribe((allLogs) => {
            const filtered = allLogs.filter(log => log.conversationId === conversationId);
            setLogs(filtered);
            setStats(summarizationDebugService.getConversationStats(conversationId));
            setInsights(summarizationDebugService.getInsights(conversationId));
        });

        return unsubscribe;
    }, [conversationId, isOpen]);

    if (!isOpen) return null;

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'success':
                return <CheckIcon className="w-4 h-4 text-green-500" />;
            case 'fallback':
                return <InfoIcon className="w-4 h-4 text-yellow-500" />;
            case 'error':
                return <XIcon className="w-4 h-4 text-red-500" />;
            default:
                return null;
        }
    };

    const getZoneColor = (zone: string) => {
        switch (zone) {
            case 'archive':
                return 'text-orange-600 dark:text-orange-400 bg-orange-500/10';
            case 'midTerm':
                return 'text-blue-600 dark:text-blue-400 bg-blue-500/10';
            case 'recent':
                return 'text-green-600 dark:text-green-400 bg-green-500/10';
            case 'basic':
                return 'text-purple-600 dark:text-purple-400 bg-purple-500/10';
            default:
                return 'text-gray-600 dark:text-gray-400 bg-gray-500/10';
        }
    };

    const getZoneLabel = (zone: string) => {
        switch (zone) {
            case 'archive':
                return 'Archive';
            case 'midTerm':
                return 'Mid-term';
            case 'recent':
                return 'Recent';
            case 'basic':
                return 'Basic';
            default:
                return zone;
        }
    };

    const formatDuration = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    };

    const formatNumber = (num: number) => {
        return num.toLocaleString('en-US');
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Drawer with modal-panel styling */}
            <div className="relative w-full max-w-2xl h-full modal-panel shadow-2xl flex flex-col border-l border-color">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-color modal-header-bg">
                    <div className="flex items-center gap-2">
                        <TrendingUpIcon className="w-5 h-5 text-accent-primary" />
                        <h2 className="text-lg font-semibold">Summarization Debug</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded hover:bg-secondary-bg transition-colors"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-color">
                    <button
                        onClick={() => setActiveTab('logs')}
                        className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                            activeTab === 'logs'
                                ? 'text-accent-primary border-b-2 border-accent-primary'
                                : 'text-text-secondary hover:text-text-primary'
                        }`}
                    >
                        Logs ({logs.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('stats')}
                        className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                            activeTab === 'stats'
                                ? 'text-accent-primary border-b-2 border-accent-primary'
                                : 'text-text-secondary hover:text-text-primary'
                        }`}
                    >
                        Statistics
                    </button>
                    <button
                        onClick={() => setActiveTab('insights')}
                        className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                            activeTab === 'insights'
                                ? 'text-accent-primary border-b-2 border-accent-primary'
                                : 'text-text-secondary hover:text-text-primary'
                        }`}
                    >
                        Insights
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-transparent to-secondary-bg/10">
                    {activeTab === 'logs' && (
                        <>
                            {logs.length === 0 ? (
                                <div className="text-center text-text-secondary py-12">
                                    <TrendingUpIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>No summarization logs yet</p>
                                </div>
                            ) : (
                                logs.slice().reverse().map((log) => (
                                    <div
                                        key={log.id}
                                        className="border border-color rounded-lg p-3 space-y-2 bg-tertiary-bg/50 backdrop-blur-sm hover:bg-tertiary-bg/70 transition-colors"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {getStatusIcon(log.status)}
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getZoneColor(log.zone)}`}>
                                                    {getZoneLabel(log.zone)}
                                                </span>
                                                {log.chunkIndex !== undefined && (
                                                    <span className="text-xs text-text-secondary">
                                                        Chunk {log.chunkIndex + 1}/{log.totalChunks}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-xs text-text-secondary">
                                                {new Date(log.timestamp).toLocaleTimeString('ar-IQ')}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div>
                                                <span className="text-text-secondary">Input:</span>
                                                <span className="font-mono ml-2">{formatNumber(log.inputTokens)} tokens</span>
                                            </div>
                                            <div>
                                                <span className="text-text-secondary">Output:</span>
                                                <span className="font-mono ml-2">{formatNumber(log.outputTokens)} tokens</span>
                                            </div>
                                            <div>
                                                <span className="text-text-secondary">Retention:</span>
                                                <span className="font-mono ml-2">{(log.retentionRate * 100).toFixed(0)}%</span>
                                            </div>
                                            <div>
                                                <span className="text-text-secondary">Duration:</span>
                                                <span className="font-mono ml-2">{formatDuration(log.duration)}</span>
                                            </div>
                                        </div>

                                        <div className="text-xs">
                                            <span className="text-text-secondary">Model:</span>
                                            <span className="font-mono ml-2 text-accent-primary">{log.model}</span>
                                        </div>

                                        {log.fallbackReason && (
                                            <div className="text-xs bg-yellow-500/10 border border-yellow-500/30 rounded px-2 py-1">
                                                <span className="text-yellow-600 dark:text-yellow-400">Fallback: {log.fallbackReason}</span>
                                            </div>
                                        )}

                                        {log.errorMessage && (
                                            <div className="text-xs bg-red-500/10 border border-red-500/30 rounded px-2 py-1">
                                                <span className="text-red-600 dark:text-red-400">Error: {log.errorMessage}</span>
                                            </div>
                                        )}

                                        {/* Show summaries if available */}
                                        {log.status === 'success' && log.inputPreview && log.outputSummary && (
                                            <details className="text-xs mt-2">
                                                <summary className="cursor-pointer text-accent-primary hover:text-accent-secondary font-medium">
                                                    📝 View Summary Details
                                                </summary>
                                                <div className="mt-2 space-y-2 p-2 bg-secondary-bg/50 rounded border border-color">
                                                    <div>
                                                        <div className="font-medium text-text-primary mb-1">Input Preview:</div>
                                                        <div className="text-text-secondary font-mono text-[11px] whitespace-pre-wrap break-words max-h-24 overflow-y-auto p-2 bg-tertiary-bg rounded">
                                                            {log.inputPreview}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-text-primary mb-1">Output Summary:</div>
                                                        <div className="text-text-secondary font-mono text-[11px] whitespace-pre-wrap break-words max-h-40 overflow-y-auto p-2 bg-tertiary-bg rounded">
                                                            {log.outputSummary}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 pt-1">
                                                        <button
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(log.outputSummary || '');
                                                            }}
                                                            className="px-2 py-1 text-[10px] rounded bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary"
                                                        >
                                                            Copy Summary
                                                        </button>
                                                    </div>
                                                </div>
                                            </details>
                                        )}
                                    </div>
                                ))
                            )}
                        </>
                    )}

                    {activeTab === 'stats' && stats && (
                        <div className="space-y-4">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                                    <div className="text-xs text-text-secondary mb-1">Success Rate</div>
                                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                        {stats.totalSummarizations > 0 
                                            ? ((stats.successCount / stats.totalSummarizations) * 100).toFixed(1)
                                            : 0}%
                                    </div>
                                    <div className="text-xs text-text-secondary mt-1">
                                        {stats.successCount}/{stats.totalSummarizations} successful
                                    </div>
                                </div>

                                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                                    <div className="text-xs text-text-secondary mb-1">Avg Duration</div>
                                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                        {(stats.averageDuration / 1000).toFixed(2)}s
                                    </div>
                                    <div className="text-xs text-text-secondary mt-1">
                                        per summarization
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Stats */}
                            <div className="space-y-2">
                                <div className="bg-tertiary-bg/50 border border-color rounded-lg p-3">
                                    <div className="text-sm font-medium mb-2">Token Usage</div>
                                    <div className="space-y-1 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-text-secondary">Total Input:</span>
                                            <span className="font-mono">{formatNumber(stats.totalInputTokens)} tokens</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-text-secondary">Total Output:</span>
                                            <span className="font-mono">{formatNumber(stats.totalOutputTokens)} tokens</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-text-secondary">Compression:</span>
                                            <span className="font-mono text-accent-primary">
                                                {stats.totalInputTokens > 0 
                                                    ? ((stats.totalOutputTokens / stats.totalInputTokens) * 100).toFixed(1)
                                                    : 0}%
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-tertiary-bg/50 border border-color rounded-lg p-3">
                                    <div className="text-sm font-medium mb-2">Status Breakdown</div>
                                    <div className="space-y-1 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-green-600 dark:text-green-400">✓ Success:</span>
                                            <span className="font-mono">{stats.successCount}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-yellow-600 dark:text-yellow-400">⚠ Fallback:</span>
                                            <span className="font-mono">{stats.fallbackCount}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-red-600 dark:text-red-400">✗ Error:</span>
                                            <span className="font-mono">{stats.errorCount}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'insights' && (
                        <div className="space-y-3">
                            {insights.map((insight, index) => (
                                <div
                                    key={index}
                                    className="flex items-start gap-3 p-3 bg-tertiary-bg/50 border border-color rounded-lg hover:bg-tertiary-bg/70 transition-colors"
                                >
                                    <InfoIcon className="w-5 h-5 text-accent-primary flex-shrink-0 mt-0.5" />
                                    <p className="text-sm">{insight}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-color modal-footer-bg p-4 flex justify-between items-center">
                    <span className="text-xs text-text-secondary flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Live Debug Active
                    </span>
                    <button
                        onClick={() => {
                            summarizationDebugService.clearConversationLogs(conversationId);
                        }}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                        Clear Logs
                    </button>
                </div>
            </div>
        </div>
    );
};
