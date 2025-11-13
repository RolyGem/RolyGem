import React from 'react';

interface PulsingDotsProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'accent';
  message?: string;
}

/**
 * Modern pulsing dots animation for loading states
 * Adapts to light and dark themes automatically
 */
export const PulsingDots: React.FC<PulsingDotsProps> = ({ 
  size = 'md', 
  variant = 'primary',
  message 
}) => {
  const sizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5'
  };

  const variantClasses = {
    primary: 'bg-indigo-500 dark:bg-indigo-400',
    secondary: 'bg-purple-500 dark:bg-purple-400',
    accent: 'bg-blue-500 dark:bg-blue-400'
  };

  const dotClass = `${sizeClasses[size]} ${variantClasses[variant]} rounded-full`;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <div 
          className={`${dotClass} animate-pulse-dot`}
          style={{ animationDelay: '0ms' }}
        />
        <div 
          className={`${dotClass} animate-pulse-dot`}
          style={{ animationDelay: '150ms' }}
        />
        <div 
          className={`${dotClass} animate-pulse-dot`}
          style={{ animationDelay: '300ms' }}
        />
      </div>
      {message && (
        <span className="font-medium text-text-secondary text-sm">
          {message}
        </span>
      )}
    </div>
  );
};

/**
 * Wave-style pulsing animation
 * More subtle and elegant
 */
export const PulsingWave: React.FC<PulsingDotsProps> = ({ 
  size = 'md', 
  variant = 'primary',
  message 
}) => {
  const heightClasses = {
    sm: 'h-3',
    md: 'h-4',
    lg: 'h-5'
  };

  const variantClasses = {
    primary: 'bg-indigo-500/70 dark:bg-indigo-400/70',
    secondary: 'bg-purple-500/70 dark:bg-purple-400/70',
    accent: 'bg-blue-500/70 dark:bg-blue-400/70'
  };

  const barClass = `w-1 ${heightClasses[size]} ${variantClasses[variant]} rounded-full`;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1">
        <div 
          className={`${barClass} animate-wave`}
          style={{ animationDelay: '0ms' }}
        />
        <div 
          className={`${barClass} animate-wave`}
          style={{ animationDelay: '100ms' }}
        />
        <div 
          className={`${barClass} animate-wave`}
          style={{ animationDelay: '200ms' }}
        />
        <div 
          className={`${barClass} animate-wave`}
          style={{ animationDelay: '300ms' }}
        />
        <div 
          className={`${barClass} animate-wave`}
          style={{ animationDelay: '400ms' }}
        />
      </div>
      {message && (
        <span className="font-medium text-text-secondary text-sm">
          {message}
        </span>
      )}
    </div>
  );
};

/**
 * Breathing circle animation
 * Perfect for thinking states
 */
export const PulsingCircle: React.FC<PulsingDotsProps> = ({ 
  size = 'md', 
  variant = 'primary',
  message 
}) => {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  const variantClasses = {
    primary: 'bg-gradient-to-br from-indigo-500 to-indigo-600 dark:from-indigo-400 dark:to-indigo-500',
    secondary: 'bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-400 dark:to-purple-500',
    accent: 'bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500'
  };

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex items-center justify-center w-10 h-10">
        {/* Outer ring - larger and more visible */}
        <div className={`absolute w-10 h-10 rounded-full ${variantClasses[variant]} opacity-15 animate-ping`} />
        {/* Middle ring */}
        <div className={`absolute w-7 h-7 rounded-full ${variantClasses[variant]} opacity-30 animate-pulse-slow`} />
        {/* Inner circle */}
        <div className={`${sizeClasses[size]} rounded-full ${variantClasses[variant]} animate-pulse-slower shadow-lg`} />
      </div>
      {message && (
        <span className="font-medium text-text-secondary text-sm animate-pulse">
          {message}
        </span>
      )}
    </div>
  );
};
