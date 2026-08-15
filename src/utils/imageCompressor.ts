import imageCompression from 'browser-image-compression';

/**
 * Lossless (or near-lossless) image compression for upload.
 *
 * Strategy:
 * 1. If file is already ≤ 3 MB → pass-through, no quality loss
 * 2. Otherwise compress at maxSizeMB=3, initialQuality=0.92 (very high)
 *    with preserveExifData=true so GPS coords are NEVER stripped.
 *    alwaysKeepResolution=true so pixel dimensions are never reduced.
 * 3. Uses a WebWorker → UI stays responsive during compression.
 *
 * ⚠️  preserveExifData is critical: without it, GPS data is lost
 *     and the automatic coordinate extraction will fail.
 */
export async function compressLossless(
  file: File,
  onProgress?: (pct: number) => void
): Promise<File> {
  const MAX_MB = 3;
  const MAX_BYTES = MAX_MB * 1024 * 1024;

  // Skip compression if already small enough
  if (file.size <= MAX_BYTES) return file;

  try {
    const options: Parameters<typeof imageCompression>[1] = {
      maxSizeMB: MAX_MB,
      maxWidthOrHeight: 9999,        // no downscaling
      useWebWorker: true,
      initialQuality: 0.92,          // near-lossless for JPEG
      alwaysKeepResolution: true,    // never reduce resolution
      preserveExifData: true,        // KEEP GPS / EXIF intact ← critical
      fileType: file.type || 'image/jpeg',
      onProgress: onProgress,
    };

    const compressed = await imageCompression(file, options);
    return compressed as File;
  } catch (err) {
    // If compression fails for any reason, return original file unchanged
    console.warn('[compressLossless] compression failed, using original:', err);
    return file;
  }
}

/**
 * Legacy lossy compressor kept for backward compatibility
 * (used in FieldPhotoUpload etc.)
 */
export async function compressImage(
  file: File,
  maxSizeBytes = 2 * 1024 * 1024,
  minResolution = 2000
): Promise<File> {
  // If already small enough and is JPEG, return as-is
  if (file.size <= maxSizeBytes && file.type === 'image/jpeg') {
    return file;
  }

  const img = await loadImage(file);
  let { width, height } = img;

  const maxDim = Math.max(width, height);
  if (maxDim > minResolution) {
    const scale = minResolution / maxDim;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.95;
  let blob: Blob | null = null;

  while (quality >= 0.4) {
    blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    if (blob.size <= maxSizeBytes) break;
    quality -= 0.05;
  }

  if (!blob || blob.size > maxSizeBytes) {
    blob = await canvasToBlob(canvas, 'image/jpeg', 0.4);
  }

  const compressedName = file.name.replace(/\.[^.]+$/, '.jpg');
  return new File([blob], compressedName, { type: 'image/jpeg' });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      type,
      quality
    );
  });
}
