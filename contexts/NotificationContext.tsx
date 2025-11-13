import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { AppNotification } from '../types';
import { generateUUID } from '../utils/uuid';

interface NotificationContextType {
  notifications: AppNotification[];
  addNotification: (notification: Omit<AppNotification, 'id'>) => string;
  removeNotification: (id: string) => void;
  pauseNotification: (id: string) => void;
  resumeNotification: (id: string) => void;
}

interface NotificationTimer {
  timeoutId: NodeJS.Timeout | null;
  remainingTime: number;
  startTime: number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const timersRef = useRef<Map<string, NotificationTimer>>(new Map());

  const removeNotification = useCallback((id: string) => {
    // Clear timer if exists
    const timer = timersRef.current.get(id);
    if (timer?.timeoutId) {
      clearTimeout(timer.timeoutId);
    }
    timersRef.current.delete(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const pauseNotification = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (!timer?.timeoutId) return;
    
    // Calculate remaining time
    const elapsed = Date.now() - timer.startTime;
    const remaining = Math.max(0, timer.remainingTime - elapsed);
    
    // Clear timeout and update timer
    clearTimeout(timer.timeoutId);
    timersRef.current.set(id, {
      timeoutId: null,
      remainingTime: remaining,
      startTime: Date.now()
    });
  }, []);

  const resumeNotification = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (!timer || timer.timeoutId) return; // Already running or doesn't exist
    
    // Start new timeout with remaining time
    const timeoutId = setTimeout(() => {
      removeNotification(id);
    }, timer.remainingTime);
    
    timersRef.current.set(id, {
      timeoutId,
      remainingTime: timer.remainingTime,
      startTime: Date.now()
    });
  }, [removeNotification]);

  const addNotification = useCallback((notification: Omit<AppNotification, 'id'>) => {
    const id = generateUUID();
    const newNotification: AppNotification = { ...notification, id };
    setNotifications(prev => [...prev, newNotification]);

    // Auto-dismiss notification after duration (default: 4 seconds)
    // Duration can be set to 0 to disable auto-dismiss (for prompts or actions)
    const autoDismissDuration = notification.duration ?? (notification.showPrompt || notification.actions ? 0 : 4000);
    
    if (autoDismissDuration > 0) {
      const timeoutId = setTimeout(() => {
        removeNotification(id);
      }, autoDismissDuration);
      
      // Store timer info
      timersRef.current.set(id, {
        timeoutId,
        remainingTime: autoDismissDuration,
        startTime: Date.now()
      });
    }
    return id;
  }, [removeNotification]);

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification, pauseNotification, resumeNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
