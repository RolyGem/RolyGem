import React, { useState } from 'react';

interface CollapsibleNoticeProps {
    title: string;
    children: React.ReactNode;
    variant?: 'yellow' | 'blue' | 'green' | 'red' | 'purple';
    icon?: string;
    defaultExpanded?: boolean;
}

/**
 * Collapsible Notice Component
 * - On mobile: Shows collapsed by default with expand button
 * - On desktop (md+): Always expanded, no collapse button
 */
export const CollapsibleNotice: React.FC<CollapsibleNoticeProps> = ({
    title,
    children,
    variant = 'blue',
    icon = '💡',
    defaultExpanded = false
}) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const variantClasses = {
        yellow: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200',
        blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200',
        green: 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200',
        red: 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200',
        purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700 text-purple-800 dark:text-purple-200'
    };

    const contentVariantClasses = {
        yellow: 'text-yellow-700 dark:text-yellow-300',
        blue: 'text-blue-700 dark:text-blue-300',
        green: 'text-green-700 dark:text-green-300',
        red: 'text-red-700 dark:text-red-300',
        purple: 'text-purple-700 dark:text-purple-300'
    };

    return (
        <div className={`border rounded-lg ${variantClasses[variant]}`}>
            {/* Header - Clickable on mobile only */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-2 md:p-3 flex items-center justify-between md:cursor-default"
            >
                <span className="text-sm md:text-sm font-semibold flex items-center gap-1.5">
                    <span>{icon}</span>
                    <span>{title}</span>
                </span>
                {/* Chevron - visible on mobile only */}
                <span className="md:hidden text-lg">
                    {isExpanded ? '▲' : '▼'}
                </span>
            </button>

            {/* Content - Collapsible on mobile, always visible on desktop */}
            <div className={`
                overflow-hidden transition-all duration-200
                ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}
                md:max-h-none md:opacity-100
            `}>
                <div className={`px-2 pb-2 md:px-3 md:pb-3 text-xs space-y-1 ${contentVariantClasses[variant]}`}>
                    {children}
                </div>
            </div>
        </div>
    );
};
