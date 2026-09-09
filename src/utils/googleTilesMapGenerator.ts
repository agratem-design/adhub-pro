/**
 * Google Tiles Static Map Generator
 * Uses Google's tile servers directly to stitch satellite/hybrid images
 * No API key needed - same technique as Esri but with Google tiles
 */

// Convert continuous lat/lng to continuous tile coordinates
function latLngToContinuousCoords(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const Tx = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const Ty = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { Tx, Ty };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load tile: ${url}`));
    img.src = url;
  });
}

export interface GoogleTilesMapOptions {
  lat: number;
  lng: number;
  zoom?: number;
  width?: number;
  height?: number;
  mapType?: 'satellite' | 'hybrid' | 'roadmap';
  /** Scale factor for text labels (1 = normal, 1.5/2/etc. enlarges labels). */
  labelScale?: number;
}

/**
 * Google tile layer codes:
 * s = satellite only
 * y = hybrid (satellite + labels)
 * m = roadmap
 * h = labels overlay only (transparent)
 */
function getLayerCode(mapType: string): string {
  switch (mapType) {
    case 'satellite': return 's';
    case 'hybrid': return 'y';
    case 'roadmap': return 'm';
    default: return 'y';
  }
}

/**
 * Generate a static Google Map image using direct tile stitching with enlarged Arabic labels support
 */
export async function generateGoogleTilesMapDataUrl(options: GoogleTilesMapOptions): Promise<string> {
  const {
    lat,
    lng,
    zoom = 15,
    width = 600,
    height = 500,
    mapType = 'hybrid',
    labelScale = 1,
  } = options;

  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    throw new Error('Invalid coordinates');
  }

  const safeWidth = Math.max(100, Math.round(width));
  const safeHeight = Math.max(100, Math.round(height));
  const safeScale = Math.max(0.75, Math.min(3.5, Number(labelScale) || 1));

  // Determine layers and zoom levels
  // When safeScale > 1 in hybrid or roadmap mode:
  // Adjust the effective zoom so that tile labels are rendered at larger scale by Google,
  // while keeping the exact geographic bounding box and alignment 100% identical.
  const hasLabels = mapType !== 'satellite';
  const effectiveZoom = hasLabels && safeScale !== 1
    ? zoom - Math.log2(safeScale)
    : zoom;

  const baseZoom = Math.max(1, Math.min(21, Math.floor(effectiveZoom)));
  const zoomFrac = effectiveZoom - baseZoom;
  const zoomScale = Math.pow(2, zoomFrac); // 1.0 .. 2.0
  const displayTileSize = 256 * zoomScale * (hasLabels ? safeScale : 1);

  const { Tx, Ty } = latLngToContinuousCoords(lat, lng, baseZoom);

  const centerX = Math.floor(safeWidth / 2);
  const centerY = Math.floor(safeHeight / 2);

  const minX = Math.floor(Tx - centerX / displayTileSize);
  const maxX = Math.floor(Tx + (safeWidth - centerX) / displayTileSize);
  const minY = Math.floor(Ty - centerY / displayTileSize);
  const maxY = Math.floor(Ty + (safeHeight - centerY) / displayTileSize);

  const canvas = document.createElement('canvas');
  canvas.width = safeWidth;
  canvas.height = safeHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot create canvas context');

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, safeWidth, safeHeight);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Request High-DPI 512x512 tiles whenever the displayed tile size is large for extra crispness
  const scaleParam = displayTileSize >= 380 ? '&scale=2' : '';
  const langParam = '&hl=ar&gl=LY';
  const baseLyrs = getLayerCode(mapType);
  const servers = ['mt0', 'mt1', 'mt2', 'mt3'];

  const tilePromises: Promise<{ img: HTMLImageElement; dx: number; dy: number; dSize: number } | null>[] = [];
  let serverIdx = 0;
  const dSize = Math.round(displayTileSize);

  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      const dx = Math.round(centerX + (tx - Tx) * displayTileSize);
      const dy = Math.round(centerY + (ty - Ty) * displayTileSize);
      const server = servers[serverIdx % servers.length];
      serverIdx++;
      const url = `https://${server}.google.com/vt/lyrs=${baseLyrs}${langParam}&x=${tx}&y=${ty}&z=${baseZoom}${scaleParam}`;

      tilePromises.push(
        loadImage(url)
          .then(img => ({ img, dx, dy, dSize }))
          .catch(() => null)
      );
    }
  }

  const tiles = await Promise.all(tilePromises);

  for (const tile of tiles) {
    if (tile) {
      ctx.drawImage(tile.img, tile.dx, tile.dy, tile.dSize, tile.dSize);
    }
  }

  return canvas.toDataURL('image/jpeg', 0.92);
}

/**
 * Generate Google Maps tile images in batches
 */
export async function generateBatchGoogleTilesMaps(
  items: { seq: number; lat: number; lng: number }[],
  options?: Partial<GoogleTilesMapOptions>,
  onProgress?: (current: number, total: number) => void
): Promise<Map<number, string>> {
  const results = new Map<number, string>();
  const total = items.length;

  // Process in batches of 3
  const batchSize = 3;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        try {
          const dataUrl = await generateGoogleTilesMapDataUrl({
            lat: item.lat,
            lng: item.lng,
            ...options,
          });
          return { seq: item.seq, dataUrl };
        } catch {
          return { seq: item.seq, dataUrl: '' };
        }
      })
    );

    for (const result of batchResults) {
      results.set(result.seq, result.dataUrl);
    }

    onProgress?.(Math.min(i + batchSize, total), total);
  }

  return results;
}
