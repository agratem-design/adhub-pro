/**
 * Image Interceptor (Online + Offline)
 * - Offline: replace external URLs with cached base64 when available.
 * - Online/Offline: when image fails, try local fallbacks from DB paths, /image and /DS, then placeholder.
 * - Auto-injects fallback script into ALL print windows (window.open + document.write).
 */
import { isOfflineMode, supabase } from '@/integrations/supabase/client';
import {
  memoryCache,
  getImageFallbackPath,
  getDSFallbackPath,
  getLocalFallbackPath,
  loadDSManifest,
  loadImageManifest,
} from '@/utils/imageResolver';
import { globalFallbackMap, fallbackMapReady } from '@/utils/preloadFallbackPaths';
import { getDSFallbackScript } from '@/utils/printDSFallbackScript';
import { normalizeUrlKey, normalizeFallbackPath } from '@/utils/imagePathNormalizer';

let cacheLoaded = false;

const observedImages = new WeakSet<HTMLImageElement>();
const internalSrcUpdates = new WeakSet<HTMLImageElement>();

function extractFileName(url: string): string | null {
  if (!url) return null;
  try {
    if (url.startsWith('http') || url.startsWith('blob:')) {
      const urlObj = new URL(url);
      const name = decodeURIComponent(urlObj.pathname.split('/').pop() || '');
      return name || null;
    }
    if (!url.startsWith('/')) {
      const name = decodeURIComponent(url.split('/').pop() || '');
      return name || null;
    }
  } catch {
    const name = decodeURIComponent(url.split('/').pop() || '');
    return name || null;
  }
  return null;
}

function lookupDbFallback(originalUrl: string): string | null {
  // Try exact match first
  const direct = globalFallbackMap.get(originalUrl);
  if (direct) return direct;
  
  // Try normalized key
  const normalizedKey = normalizeUrlKey(originalUrl);
  if (normalizedKey && normalizedKey !== originalUrl) {
    const normalized = globalFallbackMap.get(normalizedKey);
    if (normalized) return normalized;
  }
  
  return null;
}

function buildFallbackSources(originalUrl: string): string[] {
  if (!originalUrl) return ['/placeholder.svg'];

  const sources: string[] = [originalUrl];
  const addUnique = (src: string | null | undefined) => {
    if (src && !sources.includes(src)) sources.push(src);
  };

  // 1. DB fallback path (highest priority after original)
  const dbPath = lookupDbFallback(originalUrl);
  if (dbPath) addUnique(normalizeFallbackPath(dbPath));

  // 2. Manifest exact matches
  addUnique(getImageFallbackPath(originalUrl));
  addUnique(getDSFallbackPath(originalUrl));

  // 3. /image filename fallback
  const fileName = extractFileName(originalUrl);
  if (fileName) addUnique(`/image/${fileName}`);

  // 4. /DS filename fallback
  addUnique(getLocalFallbackPath(originalUrl));

  // Final fallback
  addUnique('/placeholder.svg');

  return sources;
}

function resolveCandidate(candidate: string): string {
  if (!isOfflineMode) return candidate;
  return memoryCache.get(candidate) || candidate;
}

function setImageSrc(img: HTMLImageElement, src: string) {
  internalSrcUpdates.add(img);
  img.dataset.fallbackCurrent = src;
  img.setAttribute('src', src);
}

function initializeFallbackState(img: HTMLImageElement, originalUrl: string) {
  const sources = buildFallbackSources(originalUrl);
  img.dataset.fallbackOriginal = originalUrl;
  img.dataset.fallbackSources = JSON.stringify(sources);
  img.dataset.fallbackIndex = '0';
  img.dataset.fallbackExhausted = '0';
}

function getFallbackState(img: HTMLImageElement): { original: string; sources: string[]; index: number } {
  const original = img.dataset.fallbackOriginal || img.getAttribute('src') || '';
  let sources: string[] = [];
  try {
    sources = JSON.parse(img.dataset.fallbackSources || '[]');
  } catch {
    sources = [];
  }
  if (!sources.length) {
    sources = buildFallbackSources(original);
    img.dataset.fallbackSources = JSON.stringify(sources);
  }
  const index = Number(img.dataset.fallbackIndex || '0');
  return { original, sources, index: Number.isFinite(index) ? index : 0 };
}

function handleImageError(img: HTMLImageElement) {
  if (img.dataset.fallbackExhausted === '1') return;

  const { sources, index } = getFallbackState(img);
  const nextIndex = index + 1;

  if (nextIndex >= sources.length) {
    img.dataset.fallbackExhausted = '1';
    return;
  }

  img.dataset.fallbackIndex = String(nextIndex);
  setImageSrc(img, resolveCandidate(sources[nextIndex]));
}

/**
 * Preload all cached images from image_cache table into memory.
 * Call this once on app startup in offline mode.
 */
export async function preloadImageCache(force: boolean = false): Promise<void> {
  if (cacheLoaded && !force) return;

  try {
    let allData: any[] = [];
    let from = 0;
    const PAGE_SIZE = 500;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await (supabase as any)
        .from('image_cache')
        .select('original_url, base64_data')
        .range(from, from + PAGE_SIZE - 1);

      if (error || !data || data.length === 0) break;
      allData = allData.concat(data);
      hasMore = data.length === PAGE_SIZE;
      from += PAGE_SIZE;
    }

    for (const row of allData) {
      if (row.original_url && row.base64_data) {
        memoryCache.set(row.original_url, row.base64_data);
      }
    }

    cacheLoaded = true;
    console.log(`[Cache] Loaded ${memoryCache.size} cached images into memory`);
  } catch (e) {
    console.warn('[Cache] Failed to preload image cache:', e);
  }
}

/**
 * Inject fallback script into print HTML.
 * Inserts before </head> if present, otherwise prepends to HTML.
 */
function injectFallbackScriptIntoHtml(html: string): string {
  const script = getDSFallbackScript();
  if (html.includes('</head>')) {
    return html.replace('</head>', script + '</head>');
  }
  if (html.includes('<head>')) {
    return html.replace('<head>', '<head>' + script);
  }
  // No <head> tag — prepend script
  return script + html;
}

/**
 * Install image interceptor for all <img> tags.
 * - Intercepts window.open to auto-inject fallback script into ALL print windows
 * - Offline: swap known external URLs to base64 cache
 * - Online/Offline: auto-fallback to local sources when loading fails
 */
export function installImageInterceptor(): (() => void) | undefined {
  // Ensure manifests start loading for fallback lookups
  loadDSManifest();
  loadImageManifest();

  // Intercept window.open for ALL modes (online + offline)
  // This auto-injects the fallback script into every print window
  const originalWindowOpen = window.open.bind(window);
  window.open = function (...args: any[]) {
    const newWindow = originalWindowOpen(...args);
    if (newWindow) {
      const originalWrite = newWindow.document.write.bind(newWindow.document);
      newWindow.document.write = function (html: string) {
        let processed = html;
        
        // Offline: replace URLs with cached base64
        if (isOfflineMode) {
          processed = replaceImageUrlsInHtml(processed);
        }
        
        // Inject fallback script for image error handling
        processed = injectFallbackScriptIntoHtml(processed);
        
        return originalWrite(processed);
      };
    }
    return newWindow;
  } as typeof window.open;

  const processImg = (img: HTMLImageElement) => {
    const src = img.getAttribute('src');
    if (!src) return;

    // Skip internal update reactions to avoid resetting fallback chain
    if (internalSrcUpdates.has(img)) {
      internalSrcUpdates.delete(img);
      return;
    }

    // Ensure error handler is attached once
    if (!observedImages.has(img)) {
      img.addEventListener('error', () => handleImageError(img));
      observedImages.add(img);
    }

    const currentOriginal = img.dataset.fallbackOriginal;

    // External src changed (new image) -> reset fallback chain
    if (!currentOriginal || currentOriginal !== src) {
      initializeFallbackState(img, src);

      // Offline fast-path: replace original external URL with cached base64 immediately
      if (isOfflineMode && !src.startsWith('data:')) {
        const cached = memoryCache.get(src);
        if (cached && cached !== src) {
          setImageSrc(img, cached);
        }
      }
    }
  };

  // Process existing images
  document.querySelectorAll('img').forEach(processImg);

  // Watch for new images and src changes
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLImageElement) processImg(node);
        if (node instanceof HTMLElement) node.querySelectorAll('img').forEach(processImg);
      }

      if (
        mutation.type === 'attributes' &&
        mutation.attributeName === 'src' &&
        mutation.target instanceof HTMLImageElement
      ) {
        processImg(mutation.target);
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  });

  // When fallback map finishes loading, re-process all visible images
  // that may have been initialized before the map was ready
  fallbackMapReady.then(() => {
    if (globalFallbackMap.size > 0) {
      document.querySelectorAll('img').forEach((img) => {
        const original = img.dataset.fallbackOriginal;
        if (original && img.dataset.fallbackExhausted !== '1') {
          // Check if DB path is now available but wasn't in initial sources
          const dbPath = lookupDbFallback(original);
          if (dbPath) {
            const currentSources = img.dataset.fallbackSources || '[]';
            const normalizedDbPath = normalizeFallbackPath(dbPath);
            if (normalizedDbPath && !currentSources.includes(normalizedDbPath)) {
              // Re-initialize with updated sources
              initializeFallbackState(img, original);
            }
          }
        }
      });
    }
  });

  return () => observer.disconnect();
}

/**
 * Process HTML string to replace image URLs with cached base64.
 * Use this for print windows and generated HTML.
 */
export function replaceImageUrlsInHtml(html: string): string {
  if (!isOfflineMode || memoryCache.size === 0) return html;

  let result = html;
  for (const [originalUrl, base64Data] of memoryCache) {
    if (result.includes(originalUrl)) {
      result = result.split(originalUrl).join(base64Data);
    }
  }
  return result;
}
