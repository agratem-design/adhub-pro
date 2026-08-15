/**
 * Google Tiles Static Map Generator
 * Uses Google's tile servers directly to stitch satellite/hybrid images
 * No API key needed - same technique as Esri but with Google tiles
 */

// Convert lat/lng to tile coordinates
function latLngToTileCoords(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );

  const pixelX = Math.floor(((lng + 180) / 360 * n - x) * 256);
  const pixelY = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n - y) * 256);

  return { x, y, pixelX, pixelY };
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
  /** Scale factor for text labels (1 = normal, 1.5/2/etc. enlarges labels). Only applies when mapType === 'hybrid'. */
  labelScale?: number;
}

/**
 * Google tile layer codes:
 * s = satellite only
 * y = hybrid (satellite + labels)
 * m = roadmap
 * p = terrain
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
 * Generate a static Google Map image using direct tile stitching
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

  const tileSize = 256;
  // Support fractional zoom (e.g. 15.25, 15.5) by rendering at integer zoom
  // then scaling tiles to simulate the fractional level.
  const baseZoom = Math.floor(zoom);
  const zoomFrac = zoom - baseZoom;
  const zoomScale = Math.pow(2, zoomFrac); // 1.0 .. 2.0
  const effectiveTileSize = tileSize * zoomScale;
  const { x: centerTileX, y: centerTileY, pixelX: offsetXRaw, pixelY: offsetYRaw } = latLngToTileCoords(lat, lng, baseZoom);
  const offsetX = offsetXRaw * zoomScale;
  const offsetY = offsetYRaw * zoomScale;

  const tilesX = Math.ceil(width / effectiveTileSize) + 2;
  const tilesY = Math.ceil(height / effectiveTileSize) + 2;
  const halfTilesX = Math.floor(tilesX / 2);
  const halfTilesY = Math.floor(tilesY / 2);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot create canvas context');

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, width, height);

  // For hybrid with custom labelScale: render satellite base then labels on top.
  const useSeparateLabels = mapType === 'hybrid' && labelScale !== 1;
  const baseLyrs = useSeparateLabels ? 's' : getLayerCode(mapType);
  // Use multiple Google tile servers for parallel loading
  const servers = ['mt0', 'mt1', 'mt2', 'mt3'];

  const startPixelX = Math.floor(width / 2) - offsetX - (halfTilesX * effectiveTileSize);
  const startPixelY = Math.floor(height / 2) - offsetY - (halfTilesY * effectiveTileSize);

  const tilePromises: Promise<{ img: HTMLImageElement; dx: number; dy: number } | null>[] = [];
  let serverIdx = 0;

  for (let ty = -halfTilesY; ty <= halfTilesY + 1; ty++) {
    for (let tx = -halfTilesX; tx <= halfTilesX + 1; tx++) {
      const tileX = centerTileX + tx;
      const tileY = centerTileY + ty;
      const dx = startPixelX + (tx + halfTilesX) * effectiveTileSize;
      const dy = startPixelY + (ty + halfTilesY) * effectiveTileSize;

      const server = servers[serverIdx % servers.length];
      serverIdx++;
      const url = `https://${server}.google.com/vt/lyrs=${baseLyrs}&x=${tileX}&y=${tileY}&z=${baseZoom}`;

      tilePromises.push(
        loadImage(url)
          .then(img => ({ img, dx, dy }))
          .catch(() => null)
      );
    }
  }

  const tiles = await Promise.all(tilePromises);

  for (const tile of tiles) {
    if (tile) {
      ctx.drawImage(tile.img, tile.dx, tile.dy, effectiveTileSize, effectiveTileSize);
    }
  }

  // Overlay labels at scaled size when requested
  if (useSeparateLabels) {
    const labelTileSize = effectiveTileSize * labelScale;
    const labelStartPixelX = Math.floor(width / 2) - offsetX * labelScale - (halfTilesX * labelTileSize);
    const labelStartPixelY = Math.floor(height / 2) - offsetY * labelScale - (halfTilesY * labelTileSize);
    const labelTilesX = Math.ceil(width / labelTileSize) + 2;
    const labelTilesY = Math.ceil(height / labelTileSize) + 2;
    const halfLX = Math.floor(labelTilesX / 2);
    const halfLY = Math.floor(labelTilesY / 2);
    const labelPromises: Promise<{ img: HTMLImageElement; dx: number; dy: number } | null>[] = [];
    let lsIdx = 0;
    for (let ty = -halfLY; ty <= halfLY + 1; ty++) {
      for (let tx = -halfLX; tx <= halfLX + 1; tx++) {
        const tileX = centerTileX + tx;
        const tileY = centerTileY + ty;
        const dx = labelStartPixelX + (tx + halfLX) * labelTileSize;
        const dy = labelStartPixelY + (ty + halfLY) * labelTileSize;
        const server = servers[lsIdx % servers.length];
        lsIdx++;
        const url = `https://${server}.google.com/vt/lyrs=h&x=${tileX}&y=${tileY}&z=${baseZoom}`;
        labelPromises.push(loadImage(url).then(img => ({ img, dx, dy })).catch(() => null));
      }
    }
    const labelTiles = await Promise.all(labelPromises);
    for (const t of labelTiles) {
      if (t) ctx.drawImage(t.img, t.dx, t.dy, labelTileSize, labelTileSize);
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
