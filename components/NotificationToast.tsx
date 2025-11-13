import React, { useState } from 'react';
import type { AppNotification } from '../types';
import { XIcon } from './icons/XIcon';
import { InfoIcon } from './icons/InfoIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { useNotifications } from '../contexts/NotificationContext';

interface NotificationToastProps {
  notification: AppNotification;
  onDismiss: (id: string) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({ notification, onDismiss }) => {
  const { id, title, message, type = 'info', actions, showPrompt, promptPlaceholder, onPromptSubmit, duration } = notification;
  const { pauseNotification, resumeNotification } = useNotifications();
  const [isExiting, setIsExiting] = useState(false);
  const [promptValue, setPromptValue] = useState('');
  const [isPaused, setIsPaused] = useState(false);

  // Calculate auto-dismiss duration (same logic as NotificationContext)
  const autoDismissDuration = duration ?? (showPrompt || actions ? 0 : 4000);
  const showProgressBar = autoDismissDuration > 0;

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(id), 300);
  };
  
  const handleMouseEnter = () => {
    if (showProgressBar) {
      setIsPaused(true);
      pauseNotification(id);
    }
  };
  
  const handleMouseLeave = () => {
    if (showProgressBar) {
      setIsPaused(false);
      resumeNotification(id);
    }
  };

  const handleActionClick = (action: () => void) => {
    action();
    handleDismiss();
  };
  
  const handlePromptKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (onPromptSubmit && promptValue.trim()) {
        onPromptSubmit(promptValue.trim());
        handleDismiss();
      }
    }
  };

  const IconComponent = type === 'suggestion' ? SparklesIcon : InfoIcon;
  const iconColor = {
    info: 'text-blue-400',
    success: 'text-green-400',
    error: 'text-red-400',
    suggestion: 'text-purple-400'
  }[type];
  
  const progressBarColor = {
    info: 'from-blue-500 to-cyan-500',
    success: 'from-green-500 to-emerald-500',
    error: 'from-red-500 to-orange-500',
    suggestion: 'from-purple-500 to-pink-500'
  }[type];
  
  return (
    <div
      className={`pointer-events-auto w-full max-w-md bg-secondary-bg/80 backdrop-blur-md text-text-primary rounded-xl shadow-2xl border border-color/50 transform transition-all duration-300 text-left overflow-hidden ${isExiting ? 'toast-exit' : 'toast-enter'} ${showProgressBar ? 'hover:shadow-[0_0_40px_rgba(99,102,241,0.3)] hover:scale-[1.02] cursor-default' : ''}`}
      role="alert"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      title={showProgressBar ? 'Hover to pause auto-dismiss' : undefined}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <IconComponent className={`w-6 h-6 ${iconColor}`} aria-hidden="true" />
          </div>
          <div className="ml-3 w-0 flex-1">
            <p className="text-base font-bold">{title}</p>
            <p className="mt-1 text-sm text-text-secondary">{message}</p>
            
            {showPrompt && (
              <div className="mt-3">
                <textarea
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  onKeyDown={handlePromptKeyDown}
                  placeholder={promptPlaceholder || 'Type and press Enter...'}
                  rows={2}
                  className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 text-sm modal-input"
                  autoFocus
                />
              </div>
            )}

            {actions && actions.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-3">
                {actions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => handleActionClick(action.onClick)}
                    className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${action.className || 'btn-secondary'}`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={(e) => {
                  e.stopPropagation();
                  handleDismiss();
              }}
              className="p-1 rounded-full inline-flex text-text-secondary hover:bg-tertiary-bg"
            >
              <span className="sr-only">Close</span>
              <XIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Auto-dismiss progress bar */}
      {showProgressBar && (
        <div className="h-1 bg-tertiary-bg/30">
          <div 
            className={`h-full bg-gradient-to-r ${progressBarColor} transition-all`}
            style={{
              animation: `shrink ${autoDismissDuration}ms linear forwards`,
              animationPlayState: isPaused ? 'paused' : 'running'
            }}
          />
        </div>
      )}
      
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

export const NotificationContainer: React.FC<{ notifications: AppNotification[]; onDismiss: (id: string) => void }> = ({ notifications, onDismiss }) => {
  return (
    <div className="fixed inset-0 flex flex-col items-end justify-start px-4 py-6 pointer-events-none sm:p-6 z-[100]">
      <div className="w-full max-w-md space-y-4">
        {notifications.map((notification) => (
          <NotificationToast
            key={notification.id}
            notification={notification}
            onDismiss={onDismiss}
          />
        ))}
      </div>
    </div>
  );
};