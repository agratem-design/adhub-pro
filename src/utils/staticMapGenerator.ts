/**
 * Static Map Image Generator
 * Generates satellite map images from Esri World Imagery tiles
 * No API key required - replaces unreliable live Google Maps in print
 */

// Convert lat/lng to tile coordinates
function latLngToTileCoords(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  
  // Pixel offset within the tile (0-255)
  const pixelX = Math.floor(((lng + 180) / 360 * n - x) * 256);
  const pixelY = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n - y) * 256);
  
  return { x, y, pixelX, pixelY };
}

// Load an image and return a promise
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load tile: ${url}`));
    img.src = url;
  });
}

export interface StaticMapOptions {
  lat: number;
  lng: number;
  zoom?: number;
  width?: number;  // output width in pixels
  height?: number; // output height in pixels
  mapType?: 'satellite' | 'hybrid';
}

/**
 * Generate a static satellite map image as a data URL
 * Uses Esri World Imagery tiles (free, no API key)
 */
export async function generateStaticMapDataUrl(options: StaticMapOptions): Promise<string> {
  const {
    lat,
    lng,
    zoom = 15,
    width = 800,
    height = 700,
    mapType = 'hybrid',
  } = options;

  const tileSize = 256;
  const { x: centerTileX, y: centerTileY, pixelX: offsetX, pixelY: offsetY } = latLngToTileCoords(lat, lng, zoom);

  // Calculate how many tiles we need in each direction
  const tilesX = Math.ceil(width / tileSize) + 2;
  const tilesY = Math.ceil(height / tileSize) + 2;
  const halfTilesX = Math.floor(tilesX / 2);
  const halfTilesY = Math.floor(tilesY / 2);

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot create canvas context');

  // Fill with a light gray background (fallback)
  ctx.fillStyle = '#e5e5e5';
  ctx.fillRect(0, 0, width, height);

  // Base tile URL (Esri World Imagery - satellite)
  const baseTileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile';
  // Labels overlay (CARTO)
  const labelsUrl = 'https://a.basemaps.cartocdn.com/light_only_labels';

  // Calculate the starting position
  const startPixelX = Math.floor(width / 2) - offsetX - (halfTilesX * tileSize);
  const startPixelY = Math.floor(height / 2) - offsetY - (halfTilesY * tileSize);

  // Load all satellite tiles
  const tilePromises: Promise<{ img: HTMLImageElement; dx: number; dy: number } | null>[] = [];

  for (let ty = -halfTilesY; ty <= halfTilesY + 1; ty++) {
    for (let tx = -halfTilesX; tx <= halfTilesX + 1; tx++) {
      const tileX = centerTileX + tx;
      const tileY = centerTileY + ty;
      const dx = startPixelX + (tx + halfTilesX) * tileSize;
      const dy = startPixelY + (ty + halfTilesY) * tileSize;

      const url = `${baseTileUrl}/${zoom}/${tileY}/${tileX}`;
      tilePromises.push(
        loadImage(url)
          .then(img => ({ img, dx, dy }))
          .catch(() => null)
      );
    }
  }

  const tiles = await Promise.all(tilePromises);
  
  // Draw satellite tiles
  for (const tile of tiles) {
    if (tile) {
      ctx.drawImage(tile.img, tile.dx, tile.dy, tileSize, tileSize);
    }
  }

  // If hybrid, overlay labels
  if (mapType === 'hybrid') {
    const labelPromises: Promise<{ img: HTMLImageElement; dx: number; dy: number } | null>[] = [];
    
    for (let ty = -halfTilesY; ty <= halfTilesY + 1; ty++) {
      for (let tx = -halfTilesX; tx <= halfTilesX + 1; tx++) {
        const tileX = centerTileX + tx;
        const tileY = centerTileY + ty;
        const dx = startPixelX + (tx + halfTilesX) * tileSize;
        const dy = startPixelY + (ty + halfTilesY) * tileSize;

        const url = `${labelsUrl}/${zoom}/${tileX}/${tileY}.png`;
        labelPromises.push(
          loadImage(url)
            .then(img => ({ img, dx, dy }))
            .catch(() => null)
        );
      }
    }

    const labels = await Promise.all(labelPromises);
    for (const label of labels) {
      if (label) {
        ctx.drawImage(label.img, label.dx, label.dy, tileSize, tileSize);
      }
    }
  }

  return canvas.toDataURL('image/jpeg', 0.92);
}

/**
 * Generate static map images for multiple coordinates
 * Returns a map of coordinate string -> data URL
 */
export async function generateBatchStaticMaps(
  items: { id: number | string; lat: number; lng: number }[],
  options?: Partial<StaticMapOptions>,
  onProgress?: (current: number, total: number) => void
): Promise<Map<string | number, string>> {
  const results = new Map<string | number, string>();
  const total = items.length;
  
  // Process in batches of 3 to avoid overwhelming the browser
  const batchSize = 3;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        try {
          const dataUrl = await generateStaticMapDataUrl({
            lat: item.lat,
            lng: item.lng,
            ...options,
          });
          return { id: item.id, dataUrl };
        } catch {
          return { id: item.id, dataUrl: '' };
        }
      })
    );
    
    for (const result of batchResults) {
      results.set(result.id, result.dataUrl);
    }
    
    onProgress?.(Math.min(i + batchSize, total), total);
  }
  
  return results;
}
