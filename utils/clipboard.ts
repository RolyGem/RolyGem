/**
 * Enhanced clipboard utility that works on mobile devices
 * Uses modern Clipboard API with fallback to older methods
 */

/**
 * Copy text to clipboard with mobile support
 * @param text - The text to copy
 * @returns Promise<boolean> - True if successful, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // Method 1: Try modern Clipboard API (requires HTTPS)
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Method 2: Fallback for mobile/non-secure contexts
    return fallbackCopyToClipboard(text);
  } catch (error) {
    console.error('Clipboard copy failed:', error);
    // Try fallback method
    return fallbackCopyToClipboard(text);
  }
}

/**
 * Fallback method using older execCommand API
 * Works on most mobile browsers without HTTPS
 */
function fallbackCopyToClipboard(text: string): boolean {
  try {
    // Create temporary textarea element
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Make it invisible but accessible
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    textArea.style.opacity = '0';
    textArea.style.pointerEvents = 'none';
    
    // Add to DOM
    document.body.appendChild(textArea);
    
    // Handle iOS devices specifically
    if (navigator.userAgent.match(/ipad|iphone/i)) {
      const range = document.createRange();
      range.selectNodeContents(textArea);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      textArea.setSelectionRange(0, text.length);
    } else {
      // Select text for other devices
      textArea.focus();
      textArea.select();
    }
    
    // Execute copy command
    const successful = document.execCommand('copy');
    
    // Clean up
    document.body.removeChild(textArea);
    
    return successful;
  } catch (error) {
    console.error('Fallback clipboard copy failed:', error);
    return false;
  }
}

/**
 * Check if clipboard API is available
 */
export function isClipboardSupported(): boolean {
  return (
    (navigator.clipboard && window.isSecureContext) ||
    document.queryCommandSupported?.('copy') === true
  );
}

