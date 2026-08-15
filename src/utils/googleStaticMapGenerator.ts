/**
 * Google Maps Static Image Generator
 * Renders an offscreen Google Map, waits for tiles, then captures to canvas via html2canvas
 */

import { loadGoogleMapsKeyless } from '@/lib/loadExternalScript';
import html2canvas from 'html2canvas';

export interface GoogleStaticMapOptions {
  lat: number;
  lng: number;
  zoom?: number;
  width?: number;
  height?: number;
  mapType?: 'satellite' | 'hybrid' | 'roadmap';
}

let googleMapsLoaded = false;

async function ensureGoogleMaps() {
  if (googleMapsLoaded && window.google?.maps) return;
  await loadGoogleMapsKeyless();
  googleMapsLoaded = true;
}

/**
 * Generate a static Google Map image as a data URL
 */
export async function generateGoogleStaticMapDataUrl(options: GoogleStaticMapOptions): Promise<string> {
  const {
    lat,
    lng,
    zoom = 15,
    width = 900,
    height = 750,
    mapType = 'hybrid',
  } = options;

  await ensureGoogleMaps();

  return new Promise((resolve, reject) => {
    // Create offscreen container
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed; top: -9999px; left: -9999px;
      width: ${width}px; height: ${height}px;
      visibility: hidden; z-index: -9999;
    `;
    document.body.appendChild(container);

    try {
      const mapTypeId = mapType === 'satellite' 
        ? google.maps.MapTypeId.SATELLITE 
        : mapType === 'hybrid' 
          ? google.maps.MapTypeId.HYBRID 
          : google.maps.MapTypeId.ROADMAP;

      const map = new google.maps.Map(container, {
        center: { lat, lng },
        zoom,
        mapTypeId,
        disableDefaultUI: true,
        gestureHandling: 'none',
        keyboardShortcuts: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: false,
      });

      // Capture IMMEDIATELY when tiles load - no delay to prevent gray-out
      let captured = false;
      const captureMap = async () => {
        if (captured) return;
        captured = true;
        try {
          const canvas = await html2canvas(container, {
            useCORS: true,
            allowTaint: true,
            width,
            height,
            scale: 1,
            logging: false,
            backgroundColor: null,
          });
          const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
          document.body.removeChild(container);
          resolve(dataUrl);
        } catch (err) {
          document.body.removeChild(container);
          reject(err);
        }
      };

      google.maps.event.addListenerOnce(map, 'tilesloaded', () => {
        // Capture immediately - zero delay to beat the gray-out
        captureMap();
      });

      // Fallback timeout
      setTimeout(() => {
        if (!captured && container.parentNode) {
          captureMap();
        }
      }, 6000);
    } catch (err) {
      if (container.parentNode) document.body.removeChild(container);
      reject(err);
    }
  });
}

/**
 * Generate Google Maps static images in batches
 */
export async function generateBatchGoogleStaticMaps(
  items: { seq: number; lat: number; lng: number }[],
  options?: Partial<GoogleStaticMapOptions>,
  onProgress?: (current: number, total: number) => void
): Promise<Map<number, string>> {
  const results = new Map<number, string>();
  
  // Ensure Google Maps is loaded once
  await ensureGoogleMaps();
  
  const total = items.length;
  
  // Process one at a time to avoid overwhelming (Google Maps instances are heavy)
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const dataUrl = await generateGoogleStaticMapDataUrl({
        lat: item.lat,
        lng: item.lng,
        ...options,
      });
      results.set(item.seq, dataUrl);
    } catch {
      results.set(item.seq, '');
    }
    onProgress?.(i + 1, total);
  }
  
  return results;
}
