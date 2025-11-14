import type { SummarizationDebugLog, SummarizationSessionStats } from '../types';
import { generateUUID } from '../utils/uuid';

/**
 * Summarization Debug Service
 * Collects and manages debug logs for smart summarization system
 * Only active when debugMode is enabled in settings
 * ✅ Persists logs to localStorage to survive page reloads
 */

const STORAGE_KEY = 'summarization_debug_logs';
const MAX_STORAGE_AGE_DAYS = 7; // Keep logs for 7 days

class SummarizationDebugService {
    private logs: SummarizationDebugLog[] = [];
    private listeners: Set<(logs: SummarizationDebugLog[]) => void> = new Set();
    private maxLogs = 100; // Keep last 100 logs

    constructor() {
        // ✅ Load persisted logs from localStorage on initialization
        this.loadFromStorage();
        // Clean old logs (older than 7 days)
        this.cleanOldLogs();
    }

    /**
     * Load logs from localStorage
     */
    private loadFromStorage(): void {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as SummarizationDebugLog[];
                this.logs = parsed.slice(-this.maxLogs); // Keep only last maxLogs
                console.log(`📊 Loaded ${this.logs.length} summarization debug logs from storage`);
            }
        } catch (error) {
            console.error('Failed to load summarization debug logs from storage:', error);
            this.logs = [];
        }
    }

    /**
     * Save logs to localStorage
     */
    private saveToStorage(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs));
        } catch (error) {
            console.error('Failed to save summarization debug logs to storage:', error);
        }
    }

    /**
     * Clean logs older than MAX_STORAGE_AGE_DAYS
     */
    private cleanOldLogs(): void {
        const cutoffTime = Date.now() - (MAX_STORAGE_AGE_DAYS * 24 * 60 * 60 * 1000);
        const initialCount = this.logs.length;
        this.logs = this.logs.filter(log => log.timestamp > cutoffTime);
        const removedCount = initialCount - this.logs.length;
        if (removedCount > 0) {
            console.log(`🧹 Cleaned ${removedCount} old summarization debug logs`);
            this.saveToStorage();
        }
    }

    /**
     * Add a new debug log entry
     */
    addLog(log: Omit<SummarizationDebugLog, 'id'>): void {
        const newLog: SummarizationDebugLog = {
            id: generateUUID(),
            ...log
        };

        this.logs.push(newLog);

        // Keep only last maxLogs entries
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        // ✅ Persist to localStorage
        this.saveToStorage();

        // Notify listeners
        this.notifyListeners();
    }

    /**
     * Get all logs
     */
    getLogs(): SummarizationDebugLog[] {
        return [...this.logs];
    }

    /**
     * Get logs for a specific conversation
     */
    getConversationLogs(conversationId: string): SummarizationDebugLog[] {
        return this.logs.filter(log => log.conversationId === conversationId);
    }

    /**
     * Get statistics for a conversation
     */
    getConversationStats(conversationId: string): SummarizationSessionStats {
        const conversationLogs = this.getConversationLogs(conversationId);
        
        const stats: SummarizationSessionStats = {
            conversationId,
            totalSummarizations: conversationLogs.length,
            successCount: conversationLogs.filter(l => l.status === 'success').length,
            fallbackCount: conversationLogs.filter(l => l.status === 'fallback').length,
            errorCount: conversationLogs.filter(l => l.status === 'error').length,
            totalInputTokens: conversationLogs.reduce((sum, l) => sum + l.inputTokens, 0),
            totalOutputTokens: conversationLogs.reduce((sum, l) => sum + l.outputTokens, 0),
            averageDuration: conversationLogs.length > 0 
                ? conversationLogs.reduce((sum, l) => sum + l.duration, 0) / conversationLogs.length 
                : 0,
            lastSummarization: conversationLogs.length > 0 
                ? Math.max(...conversationLogs.map(l => l.timestamp)) 
                : undefined
        };

        return stats;
    }

    /**
     * Subscribe to log updates
     */
    subscribe(callback: (logs: SummarizationDebugLog[]) => void): () => void {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    /**
     * Notify all listeners
     */
    private notifyListeners(): void {
        this.listeners.forEach(callback => callback(this.getLogs()));
    }

    /**
     * Clear all logs
     */
    clearLogs(): void {
        this.logs = [];
        this.saveToStorage(); // ✅ Persist to localStorage
        this.notifyListeners();
    }

    /**
     * Clear logs for a specific conversation
     */
    clearConversationLogs(conversationId: string): void {
        this.logs = this.logs.filter(log => log.conversationId !== conversationId);
        this.saveToStorage(); // ✅ Persist to localStorage
        this.notifyListeners();
    }

    /**
     * Get performance insights
     */
    getInsights(conversationId: string): string[] {
        const stats = this.getConversationStats(conversationId);
        const insights: string[] = [];

        if (stats.totalSummarizations === 0) {
            return ['No summarization runs yet'];
        }

        // Success rate
        const successRate = (stats.successCount / stats.totalSummarizations) * 100;
        if (successRate < 80) {
            insights.push(`⚠️ Low success rate (${successRate.toFixed(1)}%). Check API keys or content quality.`);
        } else if (successRate === 100) {
            insights.push('✅ Perfect success rate (100%)!');
        }

        // Fallback rate
        const fallbackRate = (stats.fallbackCount / stats.totalSummarizations) * 100;
        if (fallbackRate > 20) {
            insights.push(`⚠️ High fallback rate (${fallbackRate.toFixed(1)}%). Safety filters might be triggering.`);
        }

        // Average duration
        if (stats.averageDuration > 15000) {
            insights.push(`⏱️ Average duration is high (${(stats.averageDuration / 1000).toFixed(1)}s). Reduce chunk sizes.`);
        } else if (stats.averageDuration < 3000) {
            insights.push(`⚡ Great performance! Average duration ${(stats.averageDuration / 1000).toFixed(1)}s.`);
        }

        // Compression ratio
        const compressionRatio = stats.totalInputTokens > 0 
            ? (stats.totalOutputTokens / stats.totalInputTokens) * 100 
            : 0;
        if (compressionRatio > 60) {
            insights.push(`📊 Compression ratio is low (${compressionRatio.toFixed(1)}%). Consider reducing compression levels.`);
        } else if (compressionRatio < 25) {
            insights.push(`📊 Compression ratio is high (${compressionRatio.toFixed(1)}%). Important details might be lost.`);
        }

        // Reminder about how summarization works
        insights.push('');
        insights.push('📖 **How summarization works:**');
        insights.push('• Summarization runs only when the context limit is exceeded.');
        insights.push('• Recent Zone (35K tokens) stays uncompressed.');
        insights.push('• Archive Zone: 20% retention (heavy compression).');
        insights.push('• Mid-term Zone: 40% retention (medium compression).');

        if (insights.length === 0) {
            insights.push('✅ Everything looks excellent!');
        }

        return insights;
    }
}

// Singleton instance
export const summarizationDebugService = new SummarizationDebugService();
