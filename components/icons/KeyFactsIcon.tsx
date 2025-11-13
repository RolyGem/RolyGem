import React from 'react';

export const KeyFactsIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    {/* Document outline */}
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    {/* Folded corner */}
    <polyline points="14 2 14 8 20 8" />
    {/* Checkmarks for facts */}
    <polyline points="9 13 11 15 15 11" />
  </svg>
);
