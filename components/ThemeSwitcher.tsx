
import React from 'react';
import type { Theme } from '../types';

interface ThemeSwitcherProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const themes: { name: Theme; label: string; style: string }[] = [
  { name: 'light', label: 'Light', style: 'bg-white text-gray-800' },
  { name: 'dark', label: 'Dark', style: 'bg-gray-800 text-white' },
  // Fix: Changed 'colorful' theme to 'custom' to match the 'Theme' type definition. Also updated label for consistency.
  { name: 'custom', label: 'Custom', style: 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white' },
];

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ theme, setTheme }) => {
  return (
    <div className="flex items-center gap-2 p-2 bg-gray-200/50 dark:bg-gray-800/50 rounded-full">
      {themes.map((t) => (
        <button
          key={t.name}
          onClick={() => setTheme(t.name)}
          className={`w-8 h-8 rounded-full text-xs font-semibold transition-all duration-300
            ${t.style} 
            ${theme === t.name ? 'ring-2 ring-offset-2 ring-offset-gray-100 dark:ring-offset-gray-900 ring-indigo-500' : ''}
          `}
          aria-label={`Switch to ${t.label} theme`}
        >
          {t.label.charAt(0)}
        </button>
      ))}
    </div>
  );
};
