/**
 * Preload fallback paths from database tables into a global in-memory map.
 * Maps original image URLs → local /DS/ paths for instant fallback resolution.
 * 
 * Sources:
 * - installation_task_items: design_face_a/b, installed_image_face_a_url/b_url
 * - task_designs: design_face_a_url/b_url
 * - billboards: Image_URL
 * - billboard_history: design/installed URLs
 */
import { supabase } from '@/integrations/supabase/client';
import { normalizeFallbackPath, normalizeUrlKey } from '@/utils/imagePathNormalizer';

/** Global map: original URL → local fallback path (e.g. "/DS/folder/file.jpg") */
export const globalFallbackMap = new Map<string, string>();

let loaded = false;
let loadingPromise: Promise<void> | null = null;
let resolveReady: (() => void) | null = null;

/** Promise that resolves when preloading is complete */
export const fallbackMapReady = new Promise<void>((resolve) => {
  resolveReady = resolve;
});

function addMapping(url: string | null | undefined, fallbackPath: string | null | undefined) {
  const normalizedUrl = normalizeUrlKey(url);
  const normalizedPath = normalizeFallbackPath(fallbackPath);
  if (!normalizedUrl || !normalizedPath) return;
  globalFallbackMap.set(normalizedUrl, normalizedPath);
}

async function fetchPage(table: string, columns: string, from: number, pageSize: number) {
  const { data, error } = await (supabase as any)
    .from(table)
    .select(columns)
    .range(from, from + pageSize - 1);
  if (error) {
    console.warn(`[FallbackPaths] Error fetching ${table} (offset ${from}):`, error.message);
    return [];
  }
  return data || [];
}

async function fetchAll(table: string, columns: string): Promise<any[]> {
  const PAGE_SIZE = 500;
  let all: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const page = await fetchPage(table, columns, from, PAGE_SIZE);
    all = all.concat(page);
    hasMore = page.length === PAGE_SIZE;
    from += PAGE_SIZE;
  }
  return all;
}

async function loadFromInstallationTaskItems() {
  try {
    // Correct column names: installed_image_face_a_url, installed_image_face_b_url
    const rows = await fetchAll(
      'installation_task_items',
      'design_face_a,design_face_b,installed_image_face_a_url,installed_image_face_b_url,fallback_path_design_a,fallback_path_design_b,fallback_path_installed_a,fallback_path_installed_b'
    );
    for (const r of rows) {
      addMapping(r.design_face_a, r.fallback_path_design_a);
      addMapping(r.design_face_b, r.fallback_path_design_b);
      addMapping(r.installed_image_face_a_url, r.fallback_path_installed_a);
      addMapping(r.installed_image_face_b_url, r.fallback_path_installed_b);
    }
    console.log(`[FallbackPaths] installation_task_items: ${rows.length} rows`);
  } catch (e) {
    console.warn('[FallbackPaths] Failed to load installation_task_items:', e);
  }
}

async function loadFromTaskDesigns() {
  try {
    const rows = await fetchAll(
      'task_designs',
      'design_face_a_url,design_face_b_url,fallback_path_face_a,fallback_path_face_b'
    );
    for (const r of rows) {
      addMapping(r.design_face_a_url, r.fallback_path_face_a);
      addMapping(r.design_face_b_url, r.fallback_path_face_b);
    }
    console.log(`[FallbackPaths] task_designs: ${rows.length} rows`);
  } catch (e) {
    console.warn('[FallbackPaths] Failed to load task_designs:', e);
  }
}

async function loadFromBillboards() {
  try {
    const rows = await fetchAll(
      'billboards',
      'Image_URL,fallback_path_image'
    );
    for (const r of rows) {
      addMapping(r.Image_URL, r.fallback_path_image);
    }
    console.log(`[FallbackPaths] billboards: ${rows.length} rows`);
  } catch (e) {
    console.warn('[FallbackPaths] Failed to load billboards:', e);
  }
}

async function loadFromBillboardHistory() {
  try {
    const rows = await fetchAll(
      'billboard_history',
      'design_face_a_url,design_face_b_url,installed_image_face_a_url,installed_image_face_b_url,fallback_path_design_a,fallback_path_design_b,fallback_path_installed_a,fallback_path_installed_b'
    );
    for (const r of rows) {
      addMapping(r.design_face_a_url, r.fallback_path_design_a);
      addMapping(r.design_face_b_url, r.fallback_path_design_b);
      addMapping(r.installed_image_face_a_url, r.fallback_path_installed_a);
      addMapping(r.installed_image_face_b_url, r.fallback_path_installed_b);
    }
    console.log(`[FallbackPaths] billboard_history: ${rows.length} rows`);
  } catch (e) {
    console.warn('[FallbackPaths] Failed to load billboard_history:', e);
  }
}

/**
 * Preload all fallback paths from DB into globalFallbackMap.
 * Call once on app startup. Non-blocking, errors are swallowed.
 */
export function preloadFallbackPaths(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      await Promise.all([
        loadFromInstallationTaskItems(),
        loadFromTaskDesigns(),
        loadFromBillboards(),
        loadFromBillboardHistory(),
      ]);
      loaded = true;
      console.log(`[FallbackPaths] ✅ Loaded ${globalFallbackMap.size} URL→path mappings`);
    } catch (e) {
      console.warn('[FallbackPaths] Error during preload:', e);
    } finally {
      // Signal that map is ready (even if partially loaded)
      if (resolveReady) resolveReady();
    }
  })();

  return loadingPromise;
}

/**
 * Get a serializable snapshot of the global fallback map.
 * Used to inject into print windows as inline JSON.
 */
export function getGlobalFallbackMapSnapshot(): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [key, value] of globalFallbackMap) {
    obj[key] = value;
  }
  return obj;
}
