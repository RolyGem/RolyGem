import { db } from './db';
import type { LogEntry } from '../types';

// This queue holds logs in memory before they are written to the database.
const LOG_QUEUE: Omit<LogEntry, 'id'>[] = [];
let isProcessingQueue = false;
// How often to check the queue and write to the database (in milliseconds).
const BATCH_INTERVAL = 3000; // Write logs every 3 seconds

/**
 * Asynchronously processes the log queue, writing all pending logs to IndexedDB in a single batch.
 * This function is throttled by BATCH_INTERVAL to minimize I/O operations and performance impact.
 */
const processQueue = async () => {
  if (LOG_QUEUE.length === 0) {
    isProcessingQueue = false;
    return;
  }
  
  isProcessingQueue = true;
  
  // Take a snapshot of the queue and clear it immediately.
  const logsToWrite = [...LOG_QUEUE];
  LOG_QUEUE.length = 0;

  try {
    // Use Dexie's bulkAdd for high-performance batch insertion.
    await db.logs.bulkAdd(logsToWrite as LogEntry[]);
  } catch (error) {
    console.error('Failed to write logs to IndexedDB:', error);
    // If writing fails, push the logs back to the front of the queue to retry on the next cycle.
    LOG_QUEUE.unshift(...logsToWrite);
  }

  // If more logs were added while writing, schedule the next processing cycle.
  if (LOG_QUEUE.length > 0) {
    setTimeout(processQueue, BATCH_INTERVAL);
  } else {
    isProcessingQueue = false;
  }
};

/**
 * The main logging function. It's designed to be extremely fast and non-blocking.
 * It creates a structured log entry and pushes it to a memory queue.
 *
 * @param level The severity of the log ('INFO', 'WARN', 'ERROR', 'DEBUG').
 * @param category A high-level category for the log (e.g., 'API_CALL', 'DB_OPERATION').
 * @param message A human-readable message describing the event.
 * @param payload Optional structured data associated with the log entry.
 */
export const log = (
    level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG',
    category: string,
    message: string,
    payload?: any
) => {
  // Create a structured log entry.
  const entry: Omit<LogEntry, 'id'> = {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    // Sanitize the payload to ensure it's serializable and handle Error objects gracefully.
    payload: payload ? JSON.parse(JSON.stringify(payload, (key, value) => 
        value instanceof Error ? { message: value.message, stack: value.stack, name: value.name } : value
    )) : undefined,
  };
  
  // Also log to the console for immediate debugging during development.
  const consoleArgs = [
      `[${level}] [${category}] ${message}`,
      ...(payload ? [payload] : [])
  ];
  switch(level) {
      case 'INFO': console.log(...consoleArgs); break;
      case 'WARN': console.warn(...consoleArgs); break;
      case 'ERROR': console.error(...consoleArgs); break;
      case 'DEBUG': console.debug(...consoleArgs); break;
  }
  
  LOG_QUEUE.push(entry);

  // If the queue processing isn't already running, kick it off.
  if (!isProcessingQueue) {
    isProcessingQueue = true;
    setTimeout(processQueue, BATCH_INTERVAL);
  }
};

/**
 * Retrieves logs from the database with optional filtering.
 * @param filters Optional filters for level and category.
 * @param limit The maximum number of logs to retrieve.
 * @returns A promise that resolves to an array of log entries.
 */
export const getLogs = async (
  filters: { level?: string; category?: string, searchText?: string },
  limit: number = 200
): Promise<LogEntry[]> => {
  let query = db.logs.orderBy('timestamp').reverse();

  if (filters.level) {
    query = query.filter(log => log.level === filters.level);
  }
  if (filters.category) {
    query = query.filter(log => log.category === filters.category);
  }
  
  let logs = await query.limit(limit).toArray();

  if (filters.searchText) {
      const lowercasedSearch = filters.searchText.toLowerCase();
      logs = logs.filter(log => 
          log.message.toLowerCase().includes(lowercasedSearch) ||
          (log.payload && JSON.stringify(log.payload).toLowerCase().includes(lowercasedSearch))
      );
  }
  
  return logs;
};

/**
 * Clears all logs from the database.
 * @returns A promise that resolves when the logs are cleared.
 */
export const clearLogs = (): Promise<void> => {
  return db.logs.clear();
};

/**
 * Retrieves all unique categories from the logs for filtering.
 * @returns A promise that resolves to an array of unique category strings.
 */
export const getUniqueLogCategories = async (): Promise<string[]> => {
    const categories = await db.logs.orderBy('category').uniqueKeys();
    return categories as string[];
};

/**
 * Removes logs older than the specified number of days.
 * This helps prevent the logs table from growing indefinitely and consuming storage.
 * @param daysToKeep - Number of days of logs to keep (default: 30)
 * @returns A promise that resolves to the number of logs deleted.
 */
export const cleanupOldLogs = async (daysToKeep: number = 30): Promise<number> => {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        const cutoffTimestamp = cutoffDate.toISOString();

        const deleted = await db.logs
            .where('timestamp')
            .below(cutoffTimestamp)
            .delete();

        if (deleted > 0) {
            console.log(`[Logging] Cleaned up ${deleted} old logs (older than ${daysToKeep} days)`);
        }

        return deleted;
    } catch (error) {
        console.error('[Logging] Failed to cleanup old logs:', error);
        return 0;
    }
};

/**
 * Gets a summary of logs for a given time range.
 * Useful for generating reports and understanding system health.
 * @param hours - Number of hours to look back (default: 24)
 * @returns A promise that resolves to a log summary object.
 */
export const getLogSummary = async (hours: number = 24): Promise<{
    totalLogs: number;
    errorCount: number;
    warnCount: number;
    categories: Record<string, number>;
    recentErrors: LogEntry[];
}> => {
    try {
        const startDate = new Date();
        startDate.setHours(startDate.getHours() - hours);
        const startTimestamp = startDate.toISOString();

        const logs = await db.logs
            .where('timestamp')
            .above(startTimestamp)
            .toArray();

        const errorCount = logs.filter(l => l.level === 'ERROR').length;
        const warnCount = logs.filter(l => l.level === 'WARN').length;
        
        // Count logs by category
        const categories: Record<string, number> = {};
        logs.forEach(log => {
            categories[log.category] = (categories[log.category] || 0) + 1;
        });

        // Get recent errors (last 10)
        const recentErrors = logs
            .filter(l => l.level === 'ERROR')
            .slice(-10)
            .reverse();

        return {
            totalLogs: logs.length,
            errorCount,
            warnCount,
            categories,
            recentErrors,
        };
    } catch (error) {
        console.error('[Logging] Failed to generate log summary:', error);
        return {
            totalLogs: 0,
            errorCount: 0,
            warnCount: 0,
            categories: {},
            recentErrors: [],
        };
    }
};