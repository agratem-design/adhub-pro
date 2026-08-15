import { useState, useEffect } from 'react';
import { supabase, isOfflineMode } from '@/integrations/supabase/client';

// In-memory cache to avoid repeated DB queries (shared with offlineImageInterceptor)
export const memoryCache = new Map<string, string>();

// ---- Generic Manifest System ----
interface ManifestState {
  data: Record<string, string> | null;
  loading: Promise<void> | null;
}

const manifests: Record<string, ManifestState> = {
  DS: { data: null, loading: null },
  image: { data: null, loading: null },
};

/**
 * Generic manifest loader. Loads /{folder}/manifest.json once and caches it.
 */
async function loadManifest(folder: string): Promise<void> {
  const state = manifests[folder];
  if (!state) return;
  if (state.data !== null) return;
  if (state.loading) return state.loading;

  state.loading = (async () => {
    try {
      const res = await fetch(`/${folder}/manifest.json`);
      if (res.ok) {
        const json = await res.json();
        state.data = json?.entries ?? {};
        console.log(`[${folder} Manifest] Loaded ${Object.keys(state.data!).length} entries`);
      } else {
        state.data = {};
      }
    } catch {
      state.data = {};
    }
  })();
  return state.loading;
}

/** Load /DS/manifest.json once and cache it in memory. */
export async function loadDSManifest(): Promise<void> {
  return loadManifest('DS');
}

/** Load /image/manifest.json once and cache it in memory. */
export async function loadImageManifest(): Promise<void> {
  return loadManifest('image');
}

/**
 * Get the local /DS/ fallback path for a URL using the manifest.
 */
export function getDSFallbackPath(url: string | null | undefined): string | null {
  if (!url || !manifests.DS.data) return null;
  const relativePath = manifests.DS.data[url];
  if (relativePath) return `/DS/${relativePath}`;
  return null;
}

/**
 * Get the local /image/ fallback path for a URL using the manifest.
 */
export function getImageFallbackPath(url: string | null | undefined): string | null {
  if (!url || !manifests.image.data) return null;
  const relativePath = manifests.image.data[url];
  if (relativePath) return `/image/${relativePath}`;
  return null;
}

/**
 * Extract a local fallback path from a URL, pointing to /DS/{filename}
 * Falls back to filename extraction if manifest has no entry.
 */
export function getLocalFallbackPath(url: string): string | null {
  if (!url) return null;

  // Try manifest first (exact match)
  const manifestPath = getDSFallbackPath(url);
  if (manifestPath) return manifestPath;

  try {
    // If it's already a local path, skip
    if (url.startsWith('/DS/')) return null;
    
    let fileName: string | undefined;
    if (url.startsWith('http') || url.startsWith('blob:')) {
      const urlObj = new URL(url);
      fileName = decodeURIComponent(urlObj.pathname.split('/').pop() || '');
    } else {
      // Plain filename
      fileName = url.split('/').pop();
    }
    if (fileName) return `/DS/${fileName}`;
  } catch {
    // fallback: try to extract last segment
    const lastSegment = url.split('/').pop();
    if (lastSegment) return `/DS/${decodeURIComponent(lastSegment)}`;
  }
  return null;
}

/**
 * Resolves an image URL - returns original URL in online mode,
 * or base64 from memory cache / image_cache table in offline mode
 */
export async function resolveImageUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  
  // In online mode, return the URL as-is
  if (!isOfflineMode) return url;
  
  // Check memory cache first
  if (memoryCache.has(url)) {
    return memoryCache.get(url)!;
  }
  
  try {
    const { data, error } = await (supabase as any)
      .from('image_cache')
      .select('base64_data')
      .eq('original_url', url)
      .single();
    
    if (data && !error) {
      memoryCache.set(url, data.base64_data);
      return data.base64_data;
    }
  } catch (e) {
    console.warn('Failed to resolve image from cache:', url);
  }
  
  // Fallback to original URL
  return url;
}

/**
 * Resolve multiple image URLs at once (for print HTML generation)
 */
export async function resolveImageUrls(urls: (string | null | undefined)[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!isOfflineMode) {
    urls.forEach(u => { if (u) result.set(u, u); });
    return result;
  }
  
  const promises = urls.filter(Boolean).map(async (url) => {
    const resolved = await resolveImageUrl(url!);
    if (resolved) result.set(url!, resolved);
  });
  await Promise.all(promises);
  return result;
}

/**
 * React hook that resolves an image URL for offline mode.
 * Also provides a local fallback path from /DS/ folder.
 */
export function useResolvedImage(url: string | null | undefined): { src: string | null; isLoading: boolean; localFallback: string | null } {
  const [src, setSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Compute local fallback path
  const localFallback = url ? getLocalFallbackPath(url) : null;

  useEffect(() => {
    if (!url) {
      setSrc(null);
      return;
    }

    // Online mode: use URL directly
    if (!isOfflineMode) {
      setSrc(url);
      return;
    }

    // Check memory cache
    if (memoryCache.has(url)) {
      setSrc(memoryCache.get(url)!);
      return;
    }

    setIsLoading(true);
    resolveImageUrl(url).then(resolved => {
      setSrc(resolved);
      setIsLoading(false);
    });
  }, [url]);

  return { src, isLoading, localFallback };
}

/**
 * Compress and convert an image to base64
 */
export async function imageToBase64(imageUrl: string): Promise<{ base64: string; mimeType: string; size: number } | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    
    const blob = await response.blob();
    const mimeType = blob.type || 'image/jpeg';
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve({
          base64,
          mimeType,
          size: blob.size
        });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Clear the in-memory cache
 */
export function clearImageCache() {
  memoryCache.clear();
}
