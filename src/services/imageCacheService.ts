// @ts-nocheck
import { supabase, isOfflineMode } from '@/integrations/supabase/client';
import { memoryCache } from '@/utils/imageResolver';

export interface ImageCacheStats {
  totalCached: number;
  totalSizeMB: string;
  totalSizeKB: number;
  lastCachedAt: string | null;
}

export interface CacheProgress {
  total: number;
  processed: number;
  newlyCached: number;
  alreadyCached: number;
  failed: number;
  percent: number;
  currentUrl?: string;
  currentTableName?: string;
  totalSizeMB: string;
  stage: 'scanning' | 'downloading' | 'saving' | 'complete' | 'error' | 'idle';
  message: string;
}

const IMAGE_SOURCE_CONFIGS = [
  { table: 'billboards', fields: ['Image_URL', 'design_face_a', 'design_face_b'] },
  { table: 'installation_task_items', fields: ['installed_image_url', 'installed_image_face_a_url', 'installed_image_face_b_url', 'design_face_a', 'design_face_b'] },
  { table: 'field_photos', fields: ['bucket_url', 'file_path'] },
  { table: 'task_designs', fields: ['design_face_a', 'design_face_b'] },
  { table: 'printed_invoices', fields: ['design_face_a_path', 'design_face_b_path'] },
  { table: 'site_theme_settings', fields: ['logo_url', 'favicon_url'] },
  { table: 'contract_template_settings', fields: ['background_url'] },
  { table: 'print_backgrounds', fields: ['background_url'] },
];

/**
 * Get current statistics of cached images from image_cache table
 */
export async function getImageCacheStats(): Promise<ImageCacheStats> {
  try {
    const { count, error } = await (supabase as any)
      .from('image_cache')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    const { data: sizeData } = await (supabase as any)
      .from('image_cache')
      .select('file_size, created_at')
      .order('created_at', { ascending: false })
      .limit(1);

    const { data: sumData } = await (supabase as any)
      .from('image_cache')
      .select('file_size');

    let totalBytes = 0;
    if (sumData && Array.isArray(sumData)) {
      totalBytes = sumData.reduce((acc, row) => acc + (Number(row.file_size) || 0), 0);
    }

    const totalSizeKB = Math.round(totalBytes / 1024);
    const totalSizeMB = (totalBytes / (1024 * 1024)).toFixed(2);
    const lastCachedAt = sizeData && sizeData[0]?.created_at ? sizeData[0].created_at : null;

    return {
      totalCached: count || 0,
      totalSizeKB,
      totalSizeMB,
      lastCachedAt,
    };
  } catch (err) {
    console.warn('Failed to get image cache stats:', err);
    return {
      totalCached: memoryCache.size || 0,
      totalSizeKB: 0,
      totalSizeMB: '0.00',
      lastCachedAt: null,
    };
  }
}

/**
 * Collect all valid image URLs from known database tables
 */
export async function collectAllImageUrls(): Promise<{ url: string; table: string; field: string }[]> {
  const allEntries: { url: string; table: string; field: string }[] = [];
  const seenUrls = new Set<string>();

  for (const cfg of IMAGE_SOURCE_CONFIGS) {
    try {
      const { data, error } = await (supabase as any)
        .from(cfg.table)
        .select('*')
        .limit(2000);

      if (error || !data || !Array.isArray(data)) continue;

      for (const row of data) {
        for (const field of cfg.fields) {
          const val = row[field];
          if (val && typeof val === 'string') {
            const trimmed = val.trim();
            if (
              (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image')) &&
              !seenUrls.has(trimmed)
            ) {
              seenUrls.add(trimmed);
              allEntries.push({ url: trimmed, table: cfg.table, field });
            }
          }
        }
      }
    } catch (e) {
      console.warn(`Error scanning images in ${cfg.table}:`, e);
    }
  }

  return allEntries;
}

/**
 * Fetch a single image and convert to Base64
 */
async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string; size: number } | null> {
  if (url.startsWith('data:image')) {
    const mimeMatch = url.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    return {
      base64: url,
      mimeType,
      size: Math.round(url.length * 0.75),
    };
  }

  try {
    const response = await fetch(url, { mode: 'cors' });
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
          size: blob.size,
        });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    // Retry once with standard mode
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      const mimeType = blob.type || 'image/jpeg';
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({
            base64: reader.result as string,
            mimeType,
            size: blob.size,
          });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      return null;
    }
  }
}

/**
 * Main function: Download and cache all images into PostgreSQL image_cache & browser memory cache
 */
export async function downloadAndCacheAllImages(options: {
  concurrency?: number;
  forceRefresh?: boolean;
  onProgress?: (progress: CacheProgress) => void;
  abortSignal?: AbortSignal;
} = {}): Promise<{ success: boolean; total: number; cached: number; failed: number }> {
  const {
    concurrency = 6,
    forceRefresh = false,
    onProgress = () => {},
    abortSignal,
  } = options;

  onProgress({
    total: 0,
    processed: 0,
    newlyCached: 0,
    alreadyCached: 0,
    failed: 0,
    percent: 5,
    stage: 'scanning',
    message: 'جاري فحص وحصر جميع روابط الصور في النظام...',
    totalSizeMB: '0.00',
  });

  const imageEntries = await collectAllImageUrls();
  const total = imageEntries.length;

  if (total === 0) {
    onProgress({
      total: 0,
      processed: 0,
      newlyCached: 0,
      alreadyCached: 0,
      failed: 0,
      percent: 100,
      stage: 'complete',
      message: 'لم يتم العثور على صور للتخزين.',
      totalSizeMB: '0.00',
    });
    return { success: true, total: 0, cached: 0, failed: 0 };
  }

  // Check existing URLs in image_cache table
  let existingUrlSet = new Set<string>();
  if (!forceRefresh) {
    try {
      const { data: existingRows } = await (supabase as any)
        .from('image_cache')
        .select('original_url');

      if (existingRows && Array.isArray(existingRows)) {
        existingUrlSet = new Set(existingRows.map((r: any) => r.original_url));
      }
    } catch (e) {
      console.warn('Could not query existing image_cache entries:', e);
    }
  }

  let processed = 0;
  let newlyCached = 0;
  let alreadyCached = 0;
  let failed = 0;
  let totalBytes = 0;

  const pendingDbUpserts: any[] = [];

  const flushUpserts = async () => {
    if (pendingDbUpserts.length === 0) return;
    const batch = pendingDbUpserts.splice(0, pendingDbUpserts.length);
    try {
      await (supabase as any)
        .from('image_cache')
        .upsert(batch, { onConflict: 'original_url' });
    } catch (err) {
      console.warn('Error batch upserting image_cache:', err);
    }
  };

  // Process images in concurrent batches
  for (let i = 0; i < total; i += concurrency) {
    if (abortSignal?.aborted) {
      break;
    }

    const chunk = imageEntries.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (entry) => {
        if (abortSignal?.aborted) return;

        const { url, table, field } = entry;

        // Skip if already in image_cache
        if (!forceRefresh && existingUrlSet.has(url)) {
          alreadyCached++;
          processed++;
          return;
        }

        try {
          const result = await fetchImageAsBase64(url);
          if (result && result.base64) {
            memoryCache.set(url, result.base64);
            totalBytes += result.size;
            newlyCached++;

            pendingDbUpserts.push({
              original_url: url,
              base64_data: result.base64,
              mime_type: result.mimeType,
              table_name: table,
              field_name: field,
              file_size: result.size,
            });

            if (pendingDbUpserts.length >= 10) {
              await flushUpserts();
            }
          } else {
            failed++;
          }
        } catch (e) {
          failed++;
        } finally {
          processed++;
        }
      })
    );

    const percent = Math.min(99, Math.round((processed / total) * 100));
    const totalSizeMB = (totalBytes / (1024 * 1024)).toFixed(2);

    onProgress({
      total,
      processed,
      newlyCached,
      alreadyCached,
      failed,
      percent,
      stage: 'downloading',
      message: `جاري تنزيل الصور وتخزينها في الكاش (${processed}/${total})...`,
      totalSizeMB,
      currentUrl: chunk[chunk.length - 1]?.url,
      currentTableName: chunk[chunk.length - 1]?.table,
    });
  }

  // Final flush of remaining database records
  await flushUpserts();

  const finalStats = await getImageCacheStats();

  onProgress({
    total,
    processed,
    newlyCached,
    alreadyCached,
    failed,
    percent: 100,
    stage: 'complete',
    message: `تم تنزيل وتخزين ${newlyCached} صورة جديدة في الكاش بنجاح (المجموع الكلي بالكاش: ${finalStats.totalCached} صورة - ${finalStats.totalSizeMB} MB) ✅`,
    totalSizeMB: finalStats.totalSizeMB,
  });

  return {
    success: true,
    total,
    cached: newlyCached + alreadyCached,
    failed,
  };
}

/**
 * Clear all cached images from image_cache table and memory
 */
export async function clearAllCachedImages(): Promise<boolean> {
  memoryCache.clear();
  try {
    const { error } = await (supabase as any)
      .from('image_cache')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    return !error;
  } catch (e) {
    console.error('Failed to clear image cache:', e);
    return false;
  }
}
