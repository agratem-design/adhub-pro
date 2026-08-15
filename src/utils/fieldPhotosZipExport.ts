import JSZip from 'jszip';
import type { FieldPhoto } from '@/hooks/useFieldPhotos';

const CONCURRENCY = 5;

interface ZipProgress {
  done: number;
  total: number;
}

/**
 * Download field photos as a ZIP file with original file_name from DB.
 */
export async function exportFieldPhotosAsZip(
  photos: FieldPhoto[],
  onProgress?: (p: ZipProgress) => void
): Promise<void> {
  if (photos.length === 0) return;

  const zip = new JSZip();
  const total = photos.length;
  let done = 0;
  const usedNames = new Set<string>();

  const getUniqueName = (name: string): string => {
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
    const ext = name.includes('.') ? '.' + name.split('.').pop() : '';
    const base = name.replace(/\.[^.]+$/, '');
    let i = 2;
    while (usedNames.has(`${base}_${i}${ext}`)) i++;
    const unique = `${base}_${i}${ext}`;
    usedNames.add(unique);
    return unique;
  };

  // Process in batches with concurrency
  const queue = [...photos];
  const processOne = async (photo: FieldPhoto) => {
    const url = photo.bucket_url || photo.file_path;
    if (!url) { done++; onProgress?.({ done, total }); return; }

    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      
      let fileName = photo.file_name || `photo_${photo.id}`;
      if (!fileName.includes('.')) {
        const ext = blob.type?.split('/')[1] || 'jpg';
        fileName += `.${ext}`;
      }
      fileName = getUniqueName(fileName);
      zip.file(fileName, blob);
    } catch (err) {
      console.warn(`[ZIP] Failed to fetch ${photo.file_name}:`, err);
    }
    done++;
    onProgress?.({ done, total });
  };

  // Run with concurrency limit
  let i = 0;
  const runBatch = async () => {
    while (i < queue.length) {
      const batch = queue.slice(i, i + CONCURRENCY);
      i += CONCURRENCY;
      await Promise.all(batch.map(processOne));
    }
  };
  await runBatch();

  // Add manifest
  const manifest = photos.map(p => ({
    file_name: p.file_name,
    lat: p.lat,
    lng: p.lng,
    direction_degrees: p.direction_degrees,
    captured_at: p.captured_at,
    device_model: p.device_model,
    bucket_url: p.bucket_url,
  }));
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  // Generate and download
  const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(content);
  a.download = `field_photos_${new Date().toISOString().slice(0, 10)}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
}
