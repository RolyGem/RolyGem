import React, { useState, useEffect, useCallback } from 'react';
import { getLogs, clearLogs, getUniqueLogCategories, getLogSummary, cleanupOldLogs } from '../../../services/loggingService';
import type { LogEntry } from '../../../types';
import { LoaderIcon } from '../../icons/LoaderIcon';
import { TrashIcon } from '../../icons/TrashIcon';
import { ArchiveIcon } from '../../icons/ArchiveIcon';
import { BarChartIcon } from '../../icons/BarChartIcon';
import { SearchIcon } from '../../icons/SearchIcon';

/**
 * LogLevelBadge Component
 * Displays a colored badge for the log level (INFO, WARN, ERROR, DEBUG)
 */
const LogLevelBadge: React.FC<{ level: LogEntry['level'] }> = ({ level }) => {
    const styles = {
        INFO: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        WARN: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
        ERROR: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
        DEBUG: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
    };
    
    return (
        <span className={`px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-md border ${styles[level]} flex-shrink-0`}>
            {level}
        </span>
    );
};

/**
 * LogRow Component
 * Renders a single log entry with expandable details
 */
const LogRow: React.FC<{ log: LogEntry }> = ({ log }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    // Format timestamp for mobile and desktop
    const formattedTime = new Date(log.timestamp).toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });

    // Short time for mobile
    const shortTime = new Date(log.timestamp).toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit'
    });

    return (
        <div className="border-b border-color last:border-b-0">
            <div 
                className="p-2 sm:p-3 md:p-4 hover:bg-tertiary-bg/30 cursor-pointer transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-start gap-2 sm:gap-3">
                    <LogLevelBadge level={log.level} />
                    
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-xs sm:text-sm font-medium text-text-primary break-words flex-1">
                                {log.message}
                            </p>
                            <span className="text-[10px] sm:text-xs font-mono text-text-secondary flex-shrink-0">
                                <span className="hidden sm:inline">{formattedTime}</span>
                                <span className="sm:hidden">{shortTime}</span>
                            </span>
                        </div>
                        
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-text-secondary">
                            <span className="px-1.5 sm:px-2 py-0.5 rounded bg-secondary-bg font-mono">
                                {log.category}
                            </span>
                            {log.payload && (
                                <span className="text-accent-primary text-[10px] sm:text-xs">
                                    {isExpanded ? '▼ Hide' : '▶ Show'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            {isExpanded && log.payload && (
                <div className="px-2 sm:px-3 md:px-4 pb-2 sm:pb-3 md:pb-4 bg-secondary-bg/50">
                    <div className="p-2 sm:p-3 rounded-lg bg-tertiary-bg border border-color">
                        <div className="text-[10px] sm:text-xs font-semibold text-text-secondary mb-1.5 sm:mb-2">
                            Payload Details:
                        </div>
                        <pre className="text-[10px] sm:text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words max-h-60 sm:max-h-96 overflow-y-auto text-text-primary">
                            {JSON.stringify(log.payload, null, 2)}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * SummaryModal Component
 * Displays statistics and summary of logs
 */
interface SummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    summary: any;
}

const SummaryModal: React.FC<SummaryModalProps> = ({ isOpen, onClose, summary }) => {
    if (!isOpen || !summary) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4"
            onClick={onClose}
        >
            <div 
                className="modal-panel rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-3 sm:p-4 md:p-6 border-b border-color flex items-center justify-between">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <BarChartIcon className="w-4 sm:w-5 md:w-6 h-4 sm:h-5 md:h-6 text-accent-primary flex-shrink-0" />
                        <h2 className="text-sm sm:text-lg md:text-xl font-bold">
                            <span className="hidden sm:inline">Log Summary (Last 24 Hours)</span>
                            <span className="sm:hidden">Summary (24h)</span>
                        </h2>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1 sm:p-2 hover:bg-tertiary-bg rounded-lg transition-colors"
                        aria-label="Close"
                    >
                        <span className="text-xl sm:text-2xl text-text-secondary hover:text-text-primary">×</span>
                    </button>
                </div>

                {/* Content */}
                <div className="p-3 sm:p-4 md:p-6 overflow-y-auto">
                    {/* Statistics Cards */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
                        <div className="p-2 sm:p-3 md:p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-600 dark:text-blue-400 mb-0.5 sm:mb-1">
                                {summary.totalLogs}
                            </div>
                            <div className="text-[10px] sm:text-xs md:text-sm font-medium text-blue-700 dark:text-blue-300">
                                Total Logs
                            </div>
                        </div>
                        
                        <div className="p-2 sm:p-3 md:p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-yellow-600 dark:text-yellow-400 mb-0.5 sm:mb-1">
                                {summary.warnCount}
                            </div>
                            <div className="text-[10px] sm:text-xs md:text-sm font-medium text-yellow-700 dark:text-yellow-300">
                                Warnings
                            </div>
                        </div>
                        
                        <div className="p-2 sm:p-3 md:p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-red-600 dark:text-red-400 mb-0.5 sm:mb-1">
                                {summary.errorCount}
                            </div>
                            <div className="text-[10px] sm:text-xs md:text-sm font-medium text-red-700 dark:text-red-300">
                                Errors
                            </div>
                        </div>
                    </div>

                    {/* Categories Breakdown */}
                    <div className="mb-4 sm:mb-6">
                        <h3 className="text-sm sm:text-base md:text-lg font-semibold mb-2 sm:mb-3">Categories Breakdown</h3>
                        <div className="space-y-1.5 sm:space-y-2">
                            {Object.entries(summary.categories).map(([cat, count]) => (
                                <div 
                                    key={cat} 
                                    className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-secondary-bg border border-color"
                                >
                                    <span className="font-mono text-xs sm:text-sm font-medium truncate">{cat}</span>
                                    <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-accent-primary/10 text-accent-primary font-semibold text-xs sm:text-sm flex-shrink-0 ml-2">
                                        {count as number}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recent Errors */}
                    {summary.recentErrors.length > 0 && (
                        <div>
                            <h3 className="text-sm sm:text-base md:text-lg font-semibold mb-2 sm:mb-3 text-red-600 dark:text-red-400">
                                Recent Errors
                            </h3>
                            <div className="space-y-1.5 sm:space-y-2">
                                {summary.recentErrors.map((err: LogEntry) => (
                                    <div 
                                        key={err.id} 
                                        className="p-2 sm:p-3 md:p-4 rounded-lg bg-red-500/10 border border-red-500/30"
                                    >
                                        <div className="font-semibold text-xs sm:text-sm mb-0.5 sm:mb-1">{err.message}</div>
                                        <div className="text-[10px] sm:text-xs text-text-secondary font-mono">
                                            {new Date(err.timestamp).toLocaleString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/**
 * LogsTab Component
 * Main component for displaying and managing application logs
 */
const LogsTab: React.FC = () => {
    // State Management
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [levelFilter, setLevelFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [searchText, setSearchText] = useState('');
    const [categories, setCategories] = useState<string[]>([]);
    const [showSummary, setShowSummary] = useState(false);
    const [summary, setSummary] = useState<any>(null);

    /**
     * Fetches logs from the database with current filters
     */
    const fetchAndSetLogs = useCallback(async () => {
        setIsLoading(true);
        try {
            const [fetchedLogs, fetchedCategories] = await Promise.all([
                getLogs({ level: levelFilter, category: categoryFilter, searchText }),
                getUniqueLogCategories()
            ]);
            setLogs(fetchedLogs);
            setCategories(fetchedCategories);
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        } finally {
            setIsLoading(false);
        }
    }, [levelFilter, categoryFilter, searchText]);

    // Fetch logs on mount and when filters change
    useEffect(() => {
        fetchAndSetLogs();
    }, [fetchAndSetLogs]);

    /**
     * Clears all logs after user confirmation
     */
    const handleClearLogs = async () => {
        if (window.confirm('Are you sure you want to delete all logs? This action cannot be undone.')) {
            await clearLogs();
            fetchAndSetLogs();
        }
    };
    
    /**
     * Exports logs as JSON file
     */
    const handleExportLogs = () => {
        const jsonString = JSON.stringify(logs, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logs-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    /**
     * Fetches and displays log summary
     */
    const handleShowSummary = async () => {
        const summaryData = await getLogSummary(24);
        setSummary(summaryData);
        setShowSummary(true);
    };

    /**
     * Cleans up old logs (30+ days)
     */
    const handleCleanupOldLogs = async () => {
        if (window.confirm('This will delete logs older than 30 days. Continue?')) {
            const deleted = await cleanupOldLogs(30);
            alert(`Successfully cleaned up ${deleted} old log${deleted !== 1 ? 's' : ''}.`);
            fetchAndSetLogs();
        }
    };

    return (
        <>
            {/* Summary Modal */}
            <SummaryModal 
                isOpen={showSummary} 
                onClose={() => setShowSummary(false)} 
                summary={summary} 
            />
            
            <div className="flex flex-col h-full overflow-hidden">

            {/* Filters & Controls Section */}
            <div className="p-3 sm:p-4 md:p-6 border-b border-color space-y-3 bg-secondary-bg/30">
                {/* Filter Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                    {/* Level Filter */}
                    <div>
                        <label className="block text-xs sm:text-sm font-medium mb-1.5">Log Level</label>
                        <select 
                            value={levelFilter} 
                            onChange={e => setLevelFilter(e.target.value)} 
                            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border rounded-lg text-xs sm:text-sm modal-input focus:ring-2 focus:ring-accent-primary"
                        >
                            <option value="">All Levels</option>
                            <option value="INFO">Info</option>
                            <option value="WARN">Warning</option>
                            <option value="ERROR">Error</option>
                            <option value="DEBUG">Debug</option>
                        </select>
                    </div>

                    {/* Category Filter */}
                    <div>
                        <label className="block text-xs sm:text-sm font-medium mb-1.5">Category</label>
                        <select 
                            value={categoryFilter} 
                            onChange={e => setCategoryFilter(e.target.value)} 
                            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border rounded-lg text-xs sm:text-sm modal-input focus:ring-2 focus:ring-accent-primary"
                        >
                            <option value="">All Categories</option>
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Search Input */}
                    <div className="sm:col-span-2 md:col-span-1">
                        <label className="block text-xs sm:text-sm font-medium mb-1.5">Search</label>
                        <div className="relative">
                            <SearchIcon className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-3.5 sm:w-4 h-3.5 sm:h-4 text-text-secondary" />
                            <input
                                type="text"
                                value={searchText}
                                onChange={e => setSearchText(e.target.value)}
                                placeholder="Search..."
                                className="w-full pl-8 sm:pl-10 pr-2 sm:pr-3 py-1.5 sm:py-2 border rounded-lg text-xs sm:text-sm modal-input focus:ring-2 focus:ring-accent-primary"
                            />
                        </div>
                    </div>
                </div>

                {/* Action Buttons & Stats */}
                <div className="flex items-center justify-between flex-wrap gap-2 sm:gap-3">
                    {/* Log Count */}
                    <div className="text-xs sm:text-sm font-medium">
                        <span className="text-text-secondary">Showing</span>
                        <span className="mx-1 sm:mx-1.5 px-1.5 sm:px-2 py-0.5 rounded bg-accent-primary/10 text-accent-primary font-bold">
                            {logs.length}
                        </span>
                        <span className="text-text-secondary hidden sm:inline">
                            log{logs.length !== 1 ? 's' : ''}
                        </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-1.5 sm:gap-2">
                        <button 
                            onClick={handleShowSummary} 
                            className="px-2 sm:px-3 py-1.5 sm:py-2 flex items-center gap-1.5 text-xs sm:text-sm font-medium rounded-lg btn-secondary hover:bg-accent-primary/10 transition-colors"
                            title="View Summary"
                        >
                            <BarChartIcon className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                            <span className="hidden md:inline">Summary</span>
                        </button>
                        
                        <button 
                            onClick={handleExportLogs} 
                            className="px-2 sm:px-3 py-1.5 sm:py-2 flex items-center gap-1.5 text-xs sm:text-sm font-medium rounded-lg btn-secondary hover:bg-accent-primary/10 transition-colors"
                            title="Export Logs"
                        >
                            <ArchiveIcon className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                            <span className="hidden md:inline">Export</span>
                        </button>
                        
                        <button 
                            onClick={handleCleanupOldLogs} 
                            className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg btn-secondary hover:bg-accent-primary/10 transition-colors"
                            title="Cleanup Old Logs (30+ days)"
                        >
                            🗑️
                        </button>
                        
                        <button 
                            onClick={handleClearLogs} 
                            className="px-2 sm:px-3 py-1.5 sm:py-2 flex items-center gap-1.5 text-xs sm:text-sm font-medium rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors"
                            title="Clear All Logs"
                        >
                            <TrashIcon className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                            <span className="hidden md:inline">Clear</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Logs List Section */}
            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <LoaderIcon className="w-6 sm:w-8 h-6 sm:h-8 text-accent-primary" />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full p-4 sm:p-6 md:p-8 text-center">
                        <div className="text-4xl sm:text-5xl md:text-6xl mb-2 sm:mb-3 md:mb-4">📋</div>
                        <p className="text-sm sm:text-base md:text-lg font-medium text-text-primary mb-1 sm:mb-2">
                            No logs found
                        </p>
                        <p className="text-xs sm:text-sm text-text-secondary max-w-md">
                            {levelFilter || categoryFilter || searchText 
                                ? 'Try adjusting your filters to see more results.'
                                : 'Logs will appear here as the application runs.'}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-color">
                        {logs.map((log) => (
                            <LogRow key={log.id} log={log} />
                        ))}
                    </div>
                )}
            </div>
            </div>
        </>
    );
};

export default LogsTab;
