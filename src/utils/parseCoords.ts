/**
 * Shared coordinate parser supporting:
 * - Decimal string: "32.123, 13.456"
 * - Object: { lat: 32, lng: 13 }
 * - DMS: 32°54'01.3"N 13°12'22.3"E
 */

function parseDMS(dmsStr: string): number | null {
  // Match patterns like: 32°54'01.3"N or 13°12'22.3"E
  const regex = /(\d+)[°]\s*(\d+)[''′]\s*([\d.]+)[""″]?\s*([NSEW])/i;
  const match = dmsStr.match(regex);
  if (!match) return null;
  
  const degrees = parseFloat(match[1]);
  const minutes = parseFloat(match[2]);
  const seconds = parseFloat(match[3]);
  const direction = match[4].toUpperCase();
  
  let decimal = degrees + minutes / 60 + seconds / 3600;
  if (direction === 'S' || direction === 'W') {
    decimal = -decimal;
  }
  return decimal;
}

export function parseCoords(b: any): { lat: number; lng: number } | null {
  const coords = b?.GPS_Coordinates || b?.coordinates;
  if (!coords || coords === '0') return null;

  if (typeof coords === 'object' && coords !== null) {
    const lat = coords.lat ?? coords.latitude;
    const lng = coords.lng ?? coords.longitude;
    if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng };
  }

  if (typeof coords === 'string') {
    // Try simple decimal "lat,lng"
    const parts = coords.split(',').map((c: string) => parseFloat(c.trim()));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      if (Math.abs(parts[0]) <= 90 && Math.abs(parts[1]) <= 180) {
        return { lat: parts[0], lng: parts[1] };
      }
    }

    // Try DMS format: 32°54'01.3"N 13°12'22.3"E
    const dmsRegex = /(\d+[°]\s*\d+[''′]\s*[\d.]+[""″]?\s*[NSEW])/gi;
    const dmsMatches = coords.match(dmsRegex);
    if (dmsMatches && dmsMatches.length >= 2) {
      const first = parseDMS(dmsMatches[0]);
      const second = parseDMS(dmsMatches[1]);
      if (first !== null && second !== null) {
        // Determine which is lat (N/S) and which is lng (E/W)
        const firstDir = dmsMatches[0].match(/[NSEW]/i)?.[0]?.toUpperCase();
        const secondDir = dmsMatches[1].match(/[NSEW]/i)?.[0]?.toUpperCase();
        
        let lat: number, lng: number;
        if (firstDir === 'N' || firstDir === 'S') {
          lat = first;
          lng = second;
        } else {
          lat = second;
          lng = first;
        }
        
        if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
          return { lat, lng };
        }
      }
    }
  }

  return null;
}

/**
 * Resolves overlapping/duplicate coordinates by adding a tiny spiral offset.
 * This ensures markers that share identical coordinates don't hide each other on the map.
 */
const jitterIndexCache = new WeakMap<any[], Map<string, string[]>>();
const coordKey = (c: { lat: number; lng: number }) => `${c.lat.toFixed(6)},${c.lng.toFixed(6)}`;

function buildJitterIndex(allBillboards: any[]): Map<string, string[]> {
  const groups = new Map<string, { id: string; n: number }[]>();
  for (const other of allBillboards) {
    const otherId = String(other?.ID || other?.id || other?.Id || '');
    if (!otherId) continue;
    const c = parseCoords(other);
    if (!c) continue;
    const k = coordKey(c);
    const g = groups.get(k);
    const entry = { id: otherId, n: Number(other?.ID || other?.id || 0) };
    if (g) g.push(entry); else groups.set(k, [entry]);
  }
  const index = new Map<string, string[]>();
  groups.forEach((g, k) => {
    if (g.length > 1) index.set(k, g.sort((x, y) => x.n - y.n).map(e => e.id));
  });
  return index;
}

export function getJitteredCoords(b: any, allBillboards: any[]): { lat: number; lng: number } | null {
  const coords = parseCoords(b);
  if (!coords) return null;

  const id = String(b.ID || b.id || b.Id || '');
  if (!id || !allBillboards || !Array.isArray(allBillboards)) return coords;

  // فهرس اللوحات المتطابقة الإحداثيات يُبنى مرة واحدة لكل قائمة
  let index = jitterIndexCache.get(allBillboards);
  if (!index) { index = buildJitterIndex(allBillboards); jitterIndexCache.set(allBillboards, index); }
  const group = index.get(coordKey(coords));
  if (!group) return coords;
  const position = group.indexOf(id);
  if (position <= 0) return coords;

  const angle = position * (2 * Math.PI / group.length);
  const radius = 0.000045 * Math.sqrt(position);
  return { lat: coords.lat + radius * Math.cos(angle), lng: coords.lng + radius * Math.sin(angle) };
}

