import React, { useState, useEffect, useRef } from 'react';
import type { SongGenerationData } from '../types';
import { SparklesIcon } from './icons/SparklesIcon';
import { CopyIcon } from './icons/CopyIcon';
import { CheckIcon } from './icons/CheckIcon';
import { XIcon } from './icons/XIcon';
import { RegenerateIcon } from './icons/RegenerateIcon';
import { useNotifications } from '../contexts/NotificationContext';

interface SongCardProps {
  song: SongGenerationData;
  onClose: () => void;
  onRegenerate: (customInstructions?: string) => void;
  onLinkDetected?: (sunoUrl: string) => void;
}

export const SongCard: React.FC<SongCardProps> = ({ song, onClose, onRegenerate, onLinkDetected }) => {
  const [copied, setCopied] = useState(false);
  const [showInstructionsBox, setShowInstructionsBox] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [detectedUrl, setDetectedUrl] = useState<string | null>(null);
  const [showLyrics, setShowLyrics] = useState(!song.sunoUrl); // Hide lyrics when linked
  const [isCompact, setIsCompact] = useState(!!song.sunoUrl); // Compact mode when linked
  const clipboardCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const lastClipboardContent = useRef<string>('');
  const { addNotification } = useNotifications();

  const handleCopy = async () => {
    const sunoPrompt = `${song.styles}\n\n${song.title}\n\n${song.lyrics}`;
    await navigator.clipboard.writeText(sunoPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenSuno = () => {
    window.open('https://suno.com/create', '_blank');
    // Activate smart listening mode
    startListeningForSunoLink();
  };

  // Smart Listening Mode: Monitor clipboard for Suno links
  const startListeningForSunoLink = async () => {
    console.log('[Smart Bridge] 🟢 Starting smart listening mode...');
    
    // Request clipboard permission first
    try {
      const permission = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName });
      
      console.log('[Smart Bridge] Clipboard permission state:', permission.state);
      
      if (permission.state === 'denied') {
        addNotification({
          title: 'Warning',
          message: 'Allow clipboard access to enable the smart bridge.',
          type: 'info',
          duration: 5000
        });
        return;
      }

      setIsListening(true);
      console.log('[Smart Bridge] ✅ Listening mode activated!');
      
      // Store current clipboard to avoid false positives
      try {
        const current = await navigator.clipboard.readText();
        lastClipboardContent.current = current;
      } catch (e) {
        // Ignore if can't read clipboard initially
      }

      // Start monitoring clipboard every 2 seconds
      clipboardCheckInterval.current = setInterval(async () => {
        try {
          const clipboardText = await navigator.clipboard.readText();
          
          console.log('[Smart Bridge] Checking clipboard...', clipboardText.substring(0, 50));
          
          // Check if clipboard changed and contains a Suno link
          if (clipboardText !== lastClipboardContent.current) {
            // Updated pattern to support both /song/ and /s/ formats
            // Examples:
            // - https://suno.com/song/abc123-def456
            // - https://suno.com/s/nMhv0nAiz5F0x1Ha
            const sunoLinkPattern = /https?:\/\/(www\.)?suno\.(com|ai)\/(song|s)\/[\w-]+/i;
            const match = clipboardText.match(sunoLinkPattern);
            
            console.log('[Smart Bridge] Pattern match result:', match);
            
            if (match) {
              const sunoUrl = match[0];
              console.log('[Smart Bridge] ✅ Suno link detected:', sunoUrl);
              
              setDetectedUrl(sunoUrl);
              stopListening();
              
              // Show confirmation notification
              addNotification({
                title: '🎵 Song link detected!',
                message: 'Would you like to attach this song to the context?',
                type: 'suggestion',
                duration: 0,
                actions: [
                  {
                    label: 'Yes, link it',
                    onClick: () => {
                      handleLinkConfirmation(sunoUrl);
                    },
                    className: 'message-button-primary'
                  },
                  {
                    label: 'No, ignore',
                    onClick: () => {
                      setDetectedUrl(null);
                    }
                  }
                ]
              });
            }
            
            lastClipboardContent.current = clipboardText;
          }
        } catch (e) {
          // Clipboard read failed, user might have switched tabs
          console.log('[Smart Bridge] Clipboard read error:', e);
        }
      }, 2000);

      // Auto-stop after 5 minutes
      setTimeout(() => {
        if (clipboardCheckInterval.current) {
          stopListening();
        }
      }, 5 * 60 * 1000);

    } catch (e) {
      console.error('Failed to start clipboard monitoring:', e);
    }
  };

  const stopListening = () => {
    console.log('[Smart Bridge] 🔴 Stopping listening mode');
    if (clipboardCheckInterval.current) {
      clearInterval(clipboardCheckInterval.current);
      clipboardCheckInterval.current = null;
    }
    setIsListening(false);
  };

  // Manual link detection for debugging
  const checkClipboardNow = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      console.log('[Smart Bridge] Manual check - Clipboard content:', clipboardText);
      
      const sunoLinkPattern = /https?:\/\/(www\.)?suno\.(com|ai)\/(song|s)\/[\w-]+/i;
      const match = clipboardText.match(sunoLinkPattern);
      
      if (match) {
        const sunoUrl = match[0];
        console.log('[Smart Bridge] ✅ Link found manually:', sunoUrl);
        handleLinkConfirmation(sunoUrl);
      } else {
        addNotification({
          title: 'No link detected',
          message: 'Please copy a Suno link (it must start with https://suno.com/s/).',
          type: 'info',
          duration: 4000
        });
      }
    } catch (e) {
      console.error('[Smart Bridge] Manual check failed:', e);
      addNotification({
        title: 'Clipboard read error',
        message: 'Make sure the browser is allowed to access the clipboard.',
        type: 'error',
        duration: 4000
      });
    }
  };

  const handleLinkConfirmation = (sunoUrl: string) => {
    if (onLinkDetected) {
      onLinkDetected(sunoUrl);
    }
    setDetectedUrl(null);
    
    // Switch to compact mode and hide lyrics
    setIsCompact(true);
    setShowLyrics(false);
    
    addNotification({
      title: '✅ Linked successfully',
      message: 'The song is ready to play.',
      type: 'success',
      duration: 3000
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    await onRegenerate(customInstructions.trim() || undefined);
    setIsRegenerating(false);
    setShowInstructionsBox(false);
    setCustomInstructions('');
  };

  // Compact mode: Show only player
  if (isCompact && song.sunoUrl) {
    return (
      <div className="w-full max-w-3xl mx-auto my-2 sm:my-4 rounded-lg sm:rounded-xl overflow-hidden shadow-lg sm:shadow-xl border"
           style={{
             background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)',
             borderColor: 'rgba(139, 92, 246, 0.3)'
           }}>
        
        {/* Compact Header */}
        <div className="px-3 py-2 sm:px-4 sm:py-3 flex items-center justify-between border-b"
             style={{ borderColor: 'rgba(139, 92, 246, 0.2)' }}>
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <div className="p-1 sm:p-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex-shrink-0">
              <SparklesIcon className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm sm:text-base font-bold truncate" style={{ color: 'var(--text-color)' }}>
                {song.title}
              </h4>
            </div>
            <button
              onClick={() => setIsCompact(false)}
              className="text-xs px-1.5 py-1 sm:px-2 rounded hover:bg-purple-500/10 transition-colors flex-shrink-0"
              style={{ color: 'var(--text-secondary)' }}
              title="Expand"
            >
              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-1 sm:p-1.5 rounded hover:bg-red-500/10 transition-colors flex-shrink-0"
              title="Close"
            >
              <XIcon className="w-3 h-3 sm:w-4 sm:h-4 text-red-400" />
            </button>
          </div>
        </div>

        {/* Embedded Player Only */}
        <div className="p-2 sm:p-4">
          <iframe
            src={(() => {
              const match = song.sunoUrl.match(/\/(song|s|embed)\/([\w-]+)/);
              const songId = match ? match[2] : null;
              return songId ? `https://suno.com/embed/${songId}` : song.sunoUrl;
            })()}
            width="100%"
            height="140"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            sandbox="allow-scripts allow-same-origin allow-popups"
            loading="lazy"
            title="Suno Audio Player"
            style={{ borderRadius: '6px' }}
          />
        </div>
      </div>
    );
  }

  // Full mode: Show everything
  return (
    <div className="w-full max-w-3xl mx-auto my-3 sm:my-6 rounded-lg sm:rounded-xl overflow-hidden shadow-lg sm:shadow-2xl border"
         style={{
           background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%)',
           borderColor: 'rgba(139, 92, 246, 0.3)'
         }}>
      
      {/* Header */}
      <div className="relative px-3 py-2 sm:px-6 sm:py-4 border-b"
           style={{
             background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)',
             borderColor: 'rgba(139, 92, 246, 0.2)'
           }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex-shrink-0">
              <SparklesIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-xl font-bold truncate" style={{ color: 'var(--text-color)' }}>
                {song.title}
              </h3>
              <p className="text-xs sm:text-sm opacity-60 hidden sm:block" style={{ color: 'var(--text-secondary)' }}>
                Song generated from the narrative context
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {song.sunoUrl && (
              <button
                onClick={() => setIsCompact(true)}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-purple-500/10 transition-colors"
                title="Compact mode"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: 'var(--text-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-red-500/10 transition-colors"
              title="Close"
            >
              <XIcon className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Smart Listening Mode Banner */}
      {isListening && (
        <div className="px-6 py-3 border-b animate-pulse"
             style={{
               background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)',
               borderColor: 'rgba(139, 92, 246, 0.3)'
             }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-ping absolute"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full relative"></div>
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-color)' }}>
                🎵 Waiting for your song link... it will be detected automatically.
              </p>
            </div>
            <button
              onClick={stopListening}
              className="text-xs px-3 py-1 rounded hover:bg-red-500/10"
              style={{ color: 'var(--text-secondary)' }}
            >
              Stop
            </button>
          </div>
        </div>
      )}

      {/* Suno Player (if link is available) */}
      {song.sunoUrl && (
        <div className="px-6 py-4 border-b" style={{ borderColor: 'rgba(139, 92, 246, 0.2)' }}>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-green-400">🎧 Live player</span>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' }}>
                  Connected
                </span>
                <button
                  onClick={() => setShowLyrics(!showLyrics)}
                  className="text-xs px-2 py-1 rounded hover:bg-purple-500/10 transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {showLyrics ? '📖 Hide lyrics' : '📖 Show lyrics'}
                </button>
              </div>
            </div>
            <div className="rounded-lg overflow-hidden shadow-lg" style={{ background: 'rgba(0, 0, 0, 0.4)' }}>
              <iframe
                src={(() => {
                  // Extract song ID from URL
                  // Supports: /song/xxx or /s/xxx or /embed/xxx
                  const match = song.sunoUrl.match(/\/(song|s|embed)\/([\w-]+)/);
                  const songId = match ? match[2] : null;
                  return songId ? `https://suno.com/embed/${songId}` : song.sunoUrl;
                })()}
                width="100%"
                height="160"
                frameBorder="0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                sandbox="allow-scripts allow-same-origin allow-popups"
                loading="lazy"
                title="Suno Audio Player"
                style={{ borderRadius: '8px' }}
              />
            </div>
            <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
              <a
                href={song.sunoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open in Suno
              </a>
              <span className="opacity-60">Live stream from Suno</span>
            </div>
          </div>
        </div>
      )}

      {/* Musical Style - Always visible */}
      {showLyrics && (
        <div className="px-3 py-2 sm:px-6 sm:py-4 border-b" style={{ borderColor: 'rgba(139, 92, 246, 0.2)' }}>
          <div className="flex flex-col gap-1.5 sm:gap-2">
            <span className="text-xs sm:text-sm font-semibold text-purple-400">🎼 Musical style:</span>
            <p className="text-xs sm:text-sm break-words" style={{ color: 'var(--text-secondary)', lineHeight: '1.5', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
              {song.styles}
            </p>
          </div>
        </div>
      )}

      {/* Lyrics - Conditional */}
      {showLyrics && (
        <div className="px-3 py-3 sm:px-6 sm:py-6 max-h-64 sm:max-h-96 overflow-y-auto custom-scrollbar">
          <pre className="whitespace-pre-wrap font-['Noto_Sans_Arabic'] text-sm sm:text-base leading-relaxed"
               style={{ 
                 color: 'var(--text-color)',
                 direction: 'rtl',
                 textAlign: 'right'
               }}>
            {song.lyrics}
          </pre>
        </div>
      )}

      {/* Actions */}
      <div className="px-3 py-2 sm:px-6 sm:py-4 border-t flex flex-wrap items-center gap-2 sm:gap-3"
           style={{ 
             borderColor: 'rgba(139, 92, 246, 0.2)',
             background: 'rgba(0, 0, 0, 0.2)'
           }}>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all hover:scale-105"
          style={{
            background: copied ? 'rgba(34, 197, 94, 0.2)' : 'rgba(139, 92, 246, 0.2)',
            color: copied ? '#22c55e' : '#a78bfa',
            border: copied ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(139, 92, 246, 0.4)'
          }}
        >
          {copied ? <CheckIcon className="w-3 h-3 sm:w-4 sm:h-4" /> : <CopyIcon className="w-3 h-3 sm:w-4 sm:h-4" />}
          <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy to clipboard'}</span>
          <span className="sm:hidden">{copied ? 'Done!' : 'Copy'}</span>
        </button>

        <button
          onClick={handleOpenSuno}
          className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
            color: 'white',
            border: '1px solid rgba(139, 92, 246, 0.6)'
          }}
        >
          <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          <span className="hidden sm:inline">Open Suno</span>
          <span className="sm:hidden">Suno</span>
        </button>

        {!song.sunoUrl && (
          <button
            onClick={checkClipboardNow}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all hover:scale-105"
            style={{
              background: 'rgba(34, 197, 94, 0.2)',
              color: '#22c55e',
              border: '1px solid rgba(34, 197, 94, 0.4)'
            }}
            title="Copy the Suno link then click here"
          >
            <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <span className="hidden sm:inline">Link song manually</span>
            <span className="sm:hidden">Link</span>
          </button>
        )}

        <button
          onClick={() => setShowInstructionsBox(!showInstructionsBox)}
          disabled={isRegenerating}
          className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all hover:scale-105"
          style={{
            background: 'rgba(59, 130, 246, 0.2)',
            color: '#60a5fa',
            border: '1px solid rgba(59, 130, 246, 0.4)'
          }}
        >
          <RegenerateIcon className={`w-3 h-3 sm:w-4 sm:h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Regenerate</span>
          <span className="sm:hidden">Redo</span>
        </button>
      </div>

      {/* Custom Instructions Box */}
      {showInstructionsBox && (
        <div className="px-3 py-2 sm:px-6 sm:py-4 border-t" style={{ borderColor: 'rgba(139, 92, 246, 0.2)' }}>
          <label className="block text-xs sm:text-sm font-medium mb-2" style={{ color: 'var(--text-color)' }}>
            Additional instructions (optional):
          </label>
          <textarea
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder="Example: make the song sadder, add more strings..."
            className="w-full px-2.5 py-2 sm:px-3 rounded-lg border resize-none text-xs sm:text-sm"
            style={{
              background: 'var(--input-bg)',
              color: 'var(--text-color)',
              borderColor: 'rgba(139, 92, 246, 0.3)',
              minHeight: '70px'
            }}
            dir="rtl"
          />
          <div className="flex gap-2 mt-2 sm:mt-3">
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
                color: 'white'
              }}
            >
              {isRegenerating ? 'Generating…' : 'Generate now'}
            </button>
            <button
              onClick={() => {
                setShowInstructionsBox(false);
                setCustomInstructions('');
              }}
              className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all"
              style={{
                background: 'rgba(100, 100, 100, 0.2)',
                color: 'var(--text-secondary)'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
