/**
 * Smart Route Optimizer - Nearest Neighbor TSP Algorithm
 * Optimizes the order of billboard visits to minimize travel distance
 */

interface RoutePoint {
  id: number | string;
  name: string;
  lat: number;
  lng: number;
  city?: string;
  /** For clustered points: original billboard IDs and names in this cluster */
  children?: { id: number | string; name: string; lat: number; lng: number }[];
  /** Number of billboards at this stop (1 if single, >1 if clustered) */
  billboardCount?: number;
}

// Haversine distance in meters
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Nearest Neighbor TSP - starts from startPoint (or first point), 
 * always visits the closest unvisited next, forming a loop.
 */
export function optimizeRoute(
  points: RoutePoint[],
  startPoint?: { lat: number; lng: number }
): RoutePoint[] {
  if (points.length <= 2) return [...points];

  const remaining = [...points];
  const result: RoutePoint[] = [];

  // Find starting point (closest to startPoint, or first)
  let currentLat: number;
  let currentLng: number;

  if (startPoint) {
    let minDist = Infinity;
    let startIdx = 0;
    remaining.forEach((p, i) => {
      const d = haversineDistance(startPoint.lat, startPoint.lng, p.lat, p.lng);
      if (d < minDist) { minDist = d; startIdx = i; }
    });
    const first = remaining.splice(startIdx, 1)[0];
    result.push(first);
    currentLat = first.lat;
    currentLng = first.lng;
  } else {
    const first = remaining.shift()!;
    result.push(first);
    currentLat = first.lat;
    currentLng = first.lng;
  }

  // Greedily pick nearest
  while (remaining.length > 0) {
    let minDist = Infinity;
    let nearestIdx = 0;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineDistance(currentLat, currentLng, remaining[i].lat, remaining[i].lng);
      if (d < minDist) { minDist = d; nearestIdx = i; }
    }
    const next = remaining.splice(nearestIdx, 1)[0];
    result.push(next);
    currentLat = next.lat;
    currentLng = next.lng;
  }

  return result;
}

/**
 * 2-opt improvement - tries swapping segments to find shorter routes
 */
export function improveRoute2Opt(points: RoutePoint[]): RoutePoint[] {
  if (points.length <= 3) return points;
  
  const route = [...points];
  let improved = true;
  let iterations = 0;
  const maxIterations = points.length * 10;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;
    for (let i = 0; i < route.length - 2; i++) {
      for (let j = i + 2; j < route.length; j++) {
        const d1 = haversineDistance(route[i].lat, route[i].lng, route[i + 1].lat, route[i + 1].lng) +
          haversineDistance(route[j].lat, route[j].lng, route[(j + 1) % route.length].lat, route[(j + 1) % route.length].lng);
        const d2 = haversineDistance(route[i].lat, route[i].lng, route[j].lat, route[j].lng) +
          haversineDistance(route[i + 1].lat, route[i + 1].lng, route[(j + 1) % route.length].lat, route[(j + 1) % route.length].lng);
        if (d2 < d1) {
          // Reverse segment between i+1 and j
          const segment = route.splice(i + 1, j - i);
          segment.reverse();
          route.splice(i + 1, 0, ...segment);
          improved = true;
        }
      }
    }
  }
  return route;
}

/**
 * Calculate total route distance in meters
 */
export function calculateRouteDistance(points: RoutePoint[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += haversineDistance(points[i].lat, points[i].lng, points[i + 1].lat, points[i + 1].lng);
  }
  return total;
}

/**
 * Estimate travel time in minutes based on average speed
 */
export function estimateTravelTime(distanceMeters: number, avgSpeedKmh: number = 40): number {
  return (distanceMeters / 1000) / avgSpeedKmh * 60;
}

/**
 * Generate Google Maps Directions URL using /maps/dir/ format.
 * This format supports more waypoints than the API format.
 * Returns a single URL (or array if too many points).
 */
export function generateGoogleMapsUrl(
  points: RoutePoint[],
  startPoint?: { lat: number; lng: number }
): string[] {
  if (points.length === 0) return [];

  // /maps/dir/ format supports ~25 points per URL
  const MAX_POINTS_PER_URL = 25;
  const urls: string[] = [];

  // Build all coordinates
  const allCoords: string[] = [];
  if (startPoint) {
    allCoords.push(`${startPoint.lat},${startPoint.lng}`);
  }
  points.forEach(p => {
    allCoords.push(`${p.lat},${p.lng}`);
  });

  // Split into chunks if needed
  for (let i = 0; i < allCoords.length; i += MAX_POINTS_PER_URL - 1) {
    const chunk = allCoords.slice(i, i + MAX_POINTS_PER_URL);
    if (chunk.length < 2 && i > 0) break;

    // Use /maps/dir/ format - cleaner and supports more waypoints
    const pathParts = chunk.join('/');
    const url = `https://www.google.com/maps/dir/${pathParts}`;
    urls.push(url);
  }

  return urls;
}

/**
 * Generate a single combined Google Maps URL string for copying
 */
export function generateSingleGoogleMapsUrl(
  points: RoutePoint[],
  startPoint?: { lat: number; lng: number }
): string {
  if (points.length === 0) return '';

  const allCoords: string[] = [];
  if (startPoint) {
    allCoords.push(`${startPoint.lat},${startPoint.lng}`);
  }
  points.forEach(p => {
    allCoords.push(`${p.lat},${p.lng}`);
  });

  return `https://www.google.com/maps/dir/${allCoords.join('/')}`;
}

/**
 * Copy route URL to clipboard with toast feedback
 */
export async function copyRouteToClipboard(
  points: RoutePoint[],
  startPoint?: { lat: number; lng: number }
): Promise<boolean> {
  const url = generateSingleGoogleMapsUrl(points, startPoint);
  if (!url) return false;
  
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Route stage - a chunk of the full route that fits in a single Google Maps URL
 */
export interface RouteStage {
  stageNumber: number;
  points: RoutePoint[];
  distance: number;
  googleMapsUrl: string;
}

/**
 * Split a route into stages of max `maxPerStage` points each.
 * Adjacent stages overlap by 1 point (last of stage N = first of stage N+1)
 * to ensure navigation continuity.
 */
export function splitRouteIntoStages(
  points: RoutePoint[],
  maxPerStage: number = 25,
  startPoint?: { lat: number; lng: number }
): RouteStage[] {
  if (points.length === 0) return [];
  if (points.length <= maxPerStage) {
    return [{
      stageNumber: 1,
      points: [...points],
      distance: calculateRouteDistance(points),
      googleMapsUrl: generateSingleGoogleMapsUrl(points, startPoint),
    }];
  }

  const stages: RouteStage[] = [];
  let i = 0;
  let stageNum = 1;

  while (i < points.length) {
    const end = Math.min(i + maxPerStage, points.length);
    const chunk = points.slice(i, end);
    const isFirstStage = stageNum === 1;

    stages.push({
      stageNumber: stageNum,
      points: chunk,
      distance: calculateRouteDistance(chunk),
      googleMapsUrl: generateSingleGoogleMapsUrl(chunk, isFirstStage ? startPoint : undefined),
    });

    // Move forward, but overlap by 1 point for continuity
    i = end - 1;
    if (i <= (stages.length > 1 ? stages[stages.length - 2].points.length + stages[stages.length - 1].points.length - 2 : 0)) {
      // Prevent infinite loop if maxPerStage <= 1
      i = end;
    }
    stageNum++;

    // Safety: if we only have 1 point left and it's already the last point of previous stage, stop
    if (i >= points.length - 1) break;
  }

  return stages;
}

/**
 * Cluster nearby points within a given radius (meters).
 * Points within the radius are merged into a single stop at the centroid.
 * This avoids treating billboards across the street as separate stops.
 */
export function clusterNearbyPoints(
  points: RoutePoint[],
  radiusMeters: number = 50
): RoutePoint[] {
  if (points.length <= 1) return [...points];

  const used = new Set<number>();
  const clusters: RoutePoint[] = [];

  for (let i = 0; i < points.length; i++) {
    if (used.has(i)) continue;

    const group: RoutePoint[] = [points[i]];
    used.add(i);

    // Find all nearby unvisited points
    for (let j = i + 1; j < points.length; j++) {
      if (used.has(j)) continue;
      const dist = haversineDistance(points[i].lat, points[i].lng, points[j].lat, points[j].lng);
      if (dist <= radiusMeters) {
        group.push(points[j]);
        used.add(j);
      }
    }

    if (group.length === 1) {
      clusters.push({ ...group[0], billboardCount: 1 });
    } else {
      // Compute centroid
      const centLat = group.reduce((s, p) => s + p.lat, 0) / group.length;
      const centLng = group.reduce((s, p) => s + p.lng, 0) / group.length;
      const names = group.map(p => p.name).join(' + ');
      const children = group.map(p => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng }));

      clusters.push({
        id: group[0].id,
        name: names,
        lat: centLat,
        lng: centLng,
        city: group[0].city,
        children,
        billboardCount: group.length,
      });
    }
  }

  return clusters;
}

export type { RoutePoint as SmartRoutePoint };
