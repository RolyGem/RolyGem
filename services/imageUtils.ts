/**
 * Converts an image from a data URL (e.g., PNG, JPEG) to a WebP data URL.
 * @param {string} originalDataUrl - The original image data URL (e.g., "data:image/png;base64,...").
 * @param {number} [quality=0.95] - The quality for the WebP conversion (0.0 to 1.0).
 * @returns {Promise<string>} A promise that resolves with the WebP data URL.
 */
export const convertImageToWebP = (originalDataUrl: string, quality: number = 0.95): Promise<string> => {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                // Fallback to original if canvas fails
                console.warn('Could not get canvas context for WebP conversion, returning original image.');
                return resolve(originalDataUrl);
            }

            ctx.drawImage(image, 0, 0);
            try {
                const webpDataUrl = canvas.toDataURL('image/webp', quality);
                resolve(webpDataUrl);
            } catch (e) {
                console.warn('Canvas toDataURL failed for WebP, returning original image.', e);
                resolve(originalDataUrl);
            }
        };
        image.onerror = (error) => {
            console.error("Failed to load image for WebP conversion, returning original image:", error);
            // Fallback to original if image loading fails
            resolve(originalDataUrl);
        };
        image.src = originalDataUrl;
    });
};

/**
 * Re-encodes a data URL image to a specified MIME type (e.g., image/png, image/jpeg).
 * Useful for fallback when a provider doesn't accept WebP.
 */
export const convertImageToFormat = (
    originalDataUrl: string,
    targetMime: 'image/png' | 'image/jpeg',
    quality?: number
): Promise<string> => {
    return new Promise((resolve) => {
        const image = new Image();
        image.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = image.width;
                canvas.height = image.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return resolve(originalDataUrl);
                ctx.drawImage(image, 0, 0);
                const out = canvas.toDataURL(targetMime, quality);
                resolve(out);
            } catch (e) {
                console.warn('Failed to re-encode image, returning original', e);
                resolve(originalDataUrl);
            }
        };
        image.onerror = () => resolve(originalDataUrl);
        image.src = originalDataUrl;
    });
};

export const convertImageToPng = (originalDataUrl: string): Promise<string> => convertImageToFormat(originalDataUrl, 'image/png');
