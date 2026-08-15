import JSZip from 'jszip';
import type { GalleryTask } from '@/hooks/useImageGallery';
import { createFileNameDeduplicator } from '@/utils/fileNameDedup';

export function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim();
}

/** Short ID suffix for uniqueness (first 8 chars of UUID) */
export function shortId(id: string | null): string {
  if (!id) return '';
  return id.replace(/-/g, '').slice(0, 8);
}

async function fetchImageAsBlob(url: string, retries = 2): Promise<Blob | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (attempt < retries) continue;
        return null;
      }
      return await response.blob();
    } catch {
      if (attempt < retries) {
        // Wait briefly before retry
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      return null;
    }
  }
  return null;
}

export function getExtension(url: string): string {
  const match = url.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?|$)/i);
  return match ? `.${match[1].toLowerCase()}` : '.jpg';
}

export interface ZipExportResult {
  blob: Blob;
  failedUrls: string[];
  totalImages: number;
  successCount: number;
}

/** Run promises with limited concurrency */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function exportTasksAsZip(
  tasks: GalleryTask[],
  mode?: 'all' | 'designs_only',
  onProgress?: (current: number, total: number) => void,
  allowedUrls?: Set<string>
): Promise<Blob>;
export async function exportTasksAsZip(
  tasks: GalleryTask[],
  mode: 'all' | 'designs_only',
  onProgress: ((current: number, total: number) => void) | undefined,
  allowedUrls: Set<string> | undefined,
  returnResult: true
): Promise<ZipExportResult>;
export async function exportTasksAsZip(
  tasks: GalleryTask[],
  mode: 'all' | 'designs_only' = 'all',
  onProgress?: (current: number, total: number) => void,
  allowedUrls?: Set<string>,
  returnResult?: boolean
): Promise<Blob | ZipExportResult> {
  const zip = new JSZip();
  let totalImages = 0;
  let processedImages = 0;
  const failedUrls: string[] = [];

  // Manifest: maps original URL → relative file path inside zip
  const manifest: Record<string, string> = {};

  const shouldInclude = (url: string | null) => url && (!allowedUrls || allowedUrls.has(url));

  // Count total
  for (const task of tasks) {
    if (mode === 'all' || mode === 'designs_only') {
      for (const design of task.designs) {
        if (shouldInclude(design.faceAUrl)) totalImages++;
        if (shouldInclude(design.faceBUrl)) totalImages++;
        if (shouldInclude(design.cutoutUrl)) totalImages++;
      }
    }
    if (mode === 'all') {
      for (const item of task.items) {
        if (shouldInclude(item.designFaceA)) totalImages++;
        if (shouldInclude(item.designFaceB)) totalImages++;
        if (shouldInclude(item.installedFaceA)) totalImages++;
        if (shouldInclude(item.installedFaceB)) totalImages++;
        for (const hp of (item.historyPhotos || [])) {
          if (shouldInclude(hp.installedFaceA)) totalImages++;
          if (shouldInclude(hp.installedFaceB)) totalImages++;
        }
      }
    }
  }

  // Collect all download jobs first, then run concurrently
  interface DownloadJob {
    folder: JSZip;
    folderPath: string;
    dedup: (base: string, ext: string) => string;
    url: string;
    baseName: string;
    ext: string;
  }

  const allJobs: DownloadJob[] = [];

  for (const task of tasks) {
    const folderName = sanitizeFileName(`${task.customerName} - ${task.adType} - عقد ${task.contractId}`);
    const taskFolder = zip.folder(folderName)!;
    const dedup = createFileNameDeduplicator();

    // Task designs
    if (task.designs.length > 0) {
      const designsFolder = taskFolder.folder('التصاميم')!;
      const designsFolderPath = `${folderName}/التصاميم`;
      for (const design of task.designs) {
        const designName = sanitizeFileName(design.designName);
        const sid = shortId(design.id);
        if (shouldInclude(design.faceAUrl)) {
          allJobs.push({ folder: designsFolder, folderPath: designsFolderPath, dedup, url: design.faceAUrl!, baseName: `${designName} - وجه أمامي - ${sid}`, ext: getExtension(design.faceAUrl!) });
        }
        if (shouldInclude(design.faceBUrl)) {
          allJobs.push({ folder: designsFolder, folderPath: designsFolderPath, dedup, url: design.faceBUrl!, baseName: `${designName} - وجه خلفي - ${sid}`, ext: getExtension(design.faceBUrl!) });
        }
        if (shouldInclude(design.cutoutUrl)) {
          allJobs.push({ folder: designsFolder, folderPath: designsFolderPath, dedup, url: design.cutoutUrl!, baseName: `${designName} - مجسم - ${sid}`, ext: getExtension(design.cutoutUrl!) });
        }
      }
    }

    if (mode === 'all') {
      for (const item of task.items) {
        const bbName = sanitizeFileName(item.billboardName);
        const sid = shortId(item.id);

        if (shouldInclude(item.designFaceA)) {
          allJobs.push({ folder: taskFolder, folderPath: folderName, dedup, url: item.designFaceA!, baseName: `${bbName} - تصميم وجه أمامي - ${task.adType} - ${sid}`, ext: getExtension(item.designFaceA!) });
        }
        if (shouldInclude(item.designFaceB)) {
          allJobs.push({ folder: taskFolder, folderPath: folderName, dedup, url: item.designFaceB!, baseName: `${bbName} - تصميم وجه خلفي - ${task.adType} - ${sid}`, ext: getExtension(item.designFaceB!) });
        }
        if (shouldInclude(item.installedFaceA)) {
          allJobs.push({ folder: taskFolder, folderPath: folderName, dedup, url: item.installedFaceA!, baseName: `${bbName} - تركيب وجه أمامي - ${task.adType} - ${sid}`, ext: getExtension(item.installedFaceA!) });
        }
        if (shouldInclude(item.installedFaceB)) {
          allJobs.push({ folder: taskFolder, folderPath: folderName, dedup, url: item.installedFaceB!, baseName: `${bbName} - تركيب وجه خلفي - ${task.adType} - ${sid}`, ext: getExtension(item.installedFaceB!) });
        }

        for (const hp of (item.historyPhotos || [])) {
          const hpSid = shortId(hp.id);
          if (shouldInclude(hp.installedFaceA)) {
            allJobs.push({ folder: taskFolder, folderPath: folderName, dedup, url: hp.installedFaceA!, baseName: `${bbName} - تركيب سابق ${hp.reinstallNumber} وجه أمامي - ${task.adType} - ${hpSid}`, ext: getExtension(hp.installedFaceA!) });
          }
          if (shouldInclude(hp.installedFaceB)) {
            allJobs.push({ folder: taskFolder, folderPath: folderName, dedup, url: hp.installedFaceB!, baseName: `${bbName} - تركيب سابق ${hp.reinstallNumber} وجه خلفي - ${task.adType} - ${hpSid}`, ext: getExtension(hp.installedFaceB!) });
          }
        }
      }
    }
  }

  // Pre-compute filenames (dedup must run sequentially per task, but we already built jobs in order)
  const jobsWithNames = allJobs.map(job => ({
    ...job,
    fileName: job.dedup(job.baseName, job.ext),
  }));

  // Run downloads with concurrency of 5
  const downloadTasks = jobsWithNames.map(job => async () => {
    const blob = await fetchImageAsBlob(job.url);
    if (blob) {
      job.folder.file(job.fileName, blob);
      manifest[job.url] = job.folderPath ? `${job.folderPath}/${job.fileName}` : job.fileName;
    } else {
      failedUrls.push(job.url);
    }
    processedImages++;
    onProgress?.(processedImages, totalImages);
  });

  await runWithConcurrency(downloadTasks, 5);

  // Add manifest.json to the zip root
  zip.file('manifest.json', JSON.stringify({ version: 1, entries: manifest }, null, 2));

  const blob = await zip.generateAsync({ type: 'blob' });

  if (returnResult) {
    return {
      blob,
      failedUrls,
      totalImages,
      successCount: totalImages - failedUrls.length,
    };
  }

  return blob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Extract all image URLs from tasks for server filtering */
export function getAllImageUrls(tasks: GalleryTask[], mode: 'all' | 'designs_only' = 'all'): string[] {
  const urls: string[] = [];
  for (const task of tasks) {
    for (const d of task.designs) {
      if (d.faceAUrl) urls.push(d.faceAUrl);
      if (d.faceBUrl) urls.push(d.faceBUrl);
      if (d.cutoutUrl) urls.push(d.cutoutUrl);
    }
    if (mode === 'all') {
      for (const item of task.items) {
        if (item.designFaceA) urls.push(item.designFaceA);
        if (item.designFaceB) urls.push(item.designFaceB);
        if (item.installedFaceA) urls.push(item.installedFaceA);
        if (item.installedFaceB) urls.push(item.installedFaceB);
        for (const hp of (item.historyPhotos || [])) {
          if (hp.installedFaceA) urls.push(hp.installedFaceA);
          if (hp.installedFaceB) urls.push(hp.installedFaceB);
        }
      }
    }
  }
  return urls;
}
