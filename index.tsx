import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { db, saveConversation } from './services/db';
import { generateUUID } from './utils/uuid';
import { log } from './services/loggingService';

// --- Global Error Handling ---
// Catch all uncaught synchronous errors
window.onerror = (message, source, lineno, colno, error) => {
  log('ERROR', 'GLOBAL_EXCEPTION', 'An uncaught error occurred.', {
    message: message.toString(),
    source,
    lineno,
    colno,
    stack: error?.stack,
  });
  // Prevent the browser's default error handling (e.g., printing to console)
  return true;
};

// Catch all unhandled promise rejections
window.onunhandledrejection = (event) => {
  log('ERROR', 'UNHANDLED_REJECTION', 'An unhandled promise rejection occurred.', {
    reason: event.reason?.message || event.reason,
    stack: event.reason?.stack,
  });
  // Prevent the browser's default error handling
  event.preventDefault();
};


// Expose utilities to the window for debugging and testing purposes.
// This allows running scripts like `createTestConversation()` from the console.
(window as any).db = db;
(window as any).saveConversation = saveConversation;
(window as any).generateUUID = generateUUID;

// --- Mobile Keyboard Detection for Better Scroll Behavior ---
// Detect when virtual keyboard opens/closes on mobile devices
let lastHeight = window.visualViewport?.height || window.innerHeight;

const handleViewportResize = () => {
  const currentHeight = window.visualViewport?.height || window.innerHeight;
  const heightDifference = lastHeight - currentHeight;
  
  // If viewport height decreased significantly (>150px), keyboard is likely open
  if (heightDifference > 150) {
    document.body.classList.add('keyboard-open');
  } 
  // If viewport height increased significantly, keyboard is likely closed
  else if (heightDifference < -150) {
    document.body.classList.remove('keyboard-open');
  }
  
  lastHeight = currentHeight;
};

// Listen to viewport changes (works on modern mobile browsers)
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', handleViewportResize);
}

// Fallback for older browsers
window.addEventListener('resize', handleViewportResize);

// Also detect focus/blur on input elements
document.addEventListener('focusin', (e) => {
  const target = e.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
    // Small delay to ensure keyboard is shown
    setTimeout(() => {
      const currentHeight = window.visualViewport?.height || window.innerHeight;
      if (lastHeight - currentHeight > 150) {
        document.body.classList.add('keyboard-open');
      }
    }, 300);
  }
});

document.addEventListener('focusout', () => {
  // Small delay before removing class
  setTimeout(() => {
    const currentHeight = window.visualViewport?.height || window.innerHeight;
    if (Math.abs(lastHeight - currentHeight) < 150) {
      document.body.classList.remove('keyboard-open');
    }
  }, 300);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register the service worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('[PWA] ServiceWorker registration successful with scope: ', registration.scope);
        
        // Check for updates every hour
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] New version available! Refresh to update.');
                // Optionally show a notification to the user
              }
            });
          }
        });
      })
      .catch(err => {
        console.error('[PWA] ServiceWorker registration failed: ', err);
      });
  });

  // Handle service worker messages
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SW_UPDATED') {
      console.log('[PWA] Service Worker updated');
    }
  });
}