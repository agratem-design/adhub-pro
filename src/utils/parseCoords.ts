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
export function getJitteredCoords(b: any, allBillboards: any[]): { lat: number; lng: number } | null {
  const coords = parseCoords(b);
  if (!coords) return null;

  const id = String(b.ID || b.id || b.Id || '');
  if (!id || !allBillboards || !Array.isArray(allBillboards)) return coords;

  // Find all billboards in the list that resolve to the same coordinate (within 0.000001 deg)
  const duplicates = allBillboards.filter(other => {
    const otherId = String(other.ID || other.id || other.Id || '');
    if (!otherId || otherId === id) return false;
    const otherCoords = parseCoords(other);
    return otherCoords && 
           Math.abs(otherCoords.lat - coords.lat) < 0.000001 && 
           Math.abs(otherCoords.lng - coords.lng) < 0.000001;
  });

  if (duplicates.length === 0) {
    return coords;
  }

  // Sort by ID to ensure stable and consistent ordering
  const sortedGroup = [b, ...duplicates].sort((x, y) => {
    const idX = Number(x.ID || x.id || 0);
    const idY = Number(y.ID || y.id || 0);
    return idX - idY;
  });

  const index = sortedGroup.findIndex(x => String(x.ID || x.id || '') === id);
  if (index <= 0) {
    return coords; // Keep the first one exactly at the original position
  }

  // Calculate spiral offset (about 4-5 meters per step)
  const angle = index * (2 * Math.PI / sortedGroup.length);
  const radius = 0.000045 * Math.sqrt(index);

  return {
    lat: coords.lat + radius * Math.cos(angle),
    lng: coords.lng + radius * Math.sin(angle)
  };
}

