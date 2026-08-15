/**
 * Utility functions for image URL processing
 */

/**
 * Converts Google Drive URLs to direct image URLs
 * 
 * Converts:
 * - https://drive.google.com/uc?id=XXXXX → https://lh3.googleusercontent.com/d/XXXXX
 * - https://drive.google.com/uc?export=view&id=XXXXX → https://lh3.googleusercontent.com/d/XXXXX
 * - https://drive.google.com/file/d/XXXXX/view → https://lh3.googleusercontent.com/d/XXXXX
 * - https://drive.google.com/open?id=XXXXX → https://lh3.googleusercontent.com/d/XXXXX
 * 
 * Non-Google-Drive URLs are returned unchanged.
 */
export function normalizeGoogleImageUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return url || '';
  
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Pattern 1: drive.google.com/uc?id=XXXXX or drive.google.com/uc?export=view&id=XXXXX
  const ucMatch = trimmed.match(/drive\.google\.com\/uc\?(?:.*&)?id=([a-zA-Z0-9_-]+)/);
  if (ucMatch) {
    return `https://lh3.googleusercontent.com/d/${ucMatch[1]}`;
  }

  // Pattern 2: drive.google.com/file/d/XXXXX/view
  const fileMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) {
    return `https://lh3.googleusercontent.com/d/${fileMatch[1]}`;
  }

  // Pattern 3: drive.google.com/open?id=XXXXX
  const openMatch = trimmed.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (openMatch) {
    return `https://lh3.googleusercontent.com/d/${openMatch[1]}`;
  }

  return trimmed;
}
