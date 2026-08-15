/**
 * Centralized path normalization for image URLs and fallback paths.
 * Ensures consistent forward slashes and proper /DS/ prefix.
 */

/**
 * Normalize a local fallback path:
 * - Convert backslashes to forward slashes
 * - Remove duplicate slashes
 * - Ensure /DS/ prefix
 */
export function normalizeFallbackPath(path: string | null | undefined): string | null {
  if (!path) return null;
  
  // Convert all backslashes to forward slashes
  let normalized = path.replace(/\\/g, '/');
  
  // Remove duplicate slashes (but preserve protocol://)
  normalized = normalized.replace(/([^:])\/\/+/g, '$1/');
  
  // Ensure starts with /DS/
  if (!normalized.startsWith('/DS/')) {
    if (normalized.startsWith('DS/')) {
      normalized = '/' + normalized;
    } else if (normalized.startsWith('/')) {
      normalized = '/DS' + normalized;
    } else {
      normalized = '/DS/' + normalized;
    }
  }
  
  return normalized;
}

/**
 * Normalize a URL for use as a map key.
 * Strips trailing slashes and normalizes backslashes.
 */
export function normalizeUrlKey(url: string | null | undefined): string | null {
  if (!url) return null;
  let normalized = url.replace(/\\/g, '/').trim();
  // Remove trailing slash
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}
