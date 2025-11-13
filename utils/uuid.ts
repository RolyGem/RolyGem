// A robust UUID generator that falls back to a custom implementation
// in non-secure contexts (like accessing from a mobile device on the network)
// where crypto.randomUUID is not available.

export const generateUUID = (): string => {
  if (crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for non-secure contexts or older browsers.
  // This is a standard and widely-used polyfill for UUID v4.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};
