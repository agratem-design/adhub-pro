/**
 * Smart Billboard Inspection Route Optimizer Utility (مسار التفتيش والمعاينة الذكي للوحات)
 * Computes shortest-path optimized routes for visiting billboards across a city
 * using Nearest Neighbor TSP (Traveling Salesperson Problem) + 2-Opt Refinement.
 */

import type { Billboard } from '@/types';
import { parseCoords } from '@/utils/parseCoords';

export interface RouteWaypoint {
  order: number;
  billboard: Billboard;
  lat: number;
  lng: number;
  legDistanceKm: number;
  legTimeMins: number;
}

export interface RouteOptimizationResult {
  waypoints: RouteWaypoint[];
  totalDistanceKm: number;
  totalTimeMins: number;
  googleMapsUrl: string;
}

/**
 * Distance in kilometers using Haversine formula
 */
function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 2-Opt refinement algorithm to eliminate intersecting loops in 2D space
 */
function twoOpt(points: Array<{ lat: number; lng: number; billboard: Billboard }>): Array<{ lat: number; lng: number; billboard: Billboard }> {
  let improved = true;
  let route = [...points];

  while (improved) {
    improved = false;
    for (let i = 1; i < route.length - 2; i++) {
      for (let j = i + 1; j < route.length - 1; j++) {
        const d1 = haversineDistanceKm(route[i - 1].lat, route[i - 1].lng, route[i].lat, route[i].lng) +
                   haversineDistanceKm(route[j].lat, route[j].lng, route[j + 1].lat, route[j + 1].lng);
        const d2 = haversineDistanceKm(route[i - 1].lat, route[i - 1].lng, route[j].lat, route[j].lng) +
                   haversineDistanceKm(route[i].lat, route[i].lng, route[j + 1].lat, route[j + 1].lng);

        if (d2 < d1) {
          // Reverse slice between i and j
          const newRoute = route.slice(0, i).concat(route.slice(i, j + 1).reverse()).concat(route.slice(j + 1));
          route = newRoute;
          improved = true;
        }
      }
    }
  }

  return route;
}

/**
 * Compute optimized billboard inspection trip route
 */
export function computeOptimizedRoute(
  billboards: Billboard[],
  startCoords?: { lat: number; lng: number }
): RouteOptimizationResult | null {
  // Filter valid billboard coordinates
  const validItems: Array<{ lat: number; lng: number; billboard: Billboard }> = [];

  for (const b of billboards) {
    const parsed = parseCoords(b.coordinates);
    if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
      validItems.push({ lat: parsed.lat, lng: parsed.lng, billboard: b });
    }
  }

  if (validItems.length === 0) return null;

  // 1. Determine Starting Node
  let currentLat = startCoords?.lat ?? validItems[0].lat;
  let currentLng = startCoords?.lng ?? validItems[0].lng;

  const unvisited = [...validItems];
  const routeNodes: Array<{ lat: number; lng: number; billboard: Billboard }> = [];

  // 2. Nearest Neighbor Greedy Insertion
  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minDist = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const d = haversineDistanceKm(currentLat, currentLng, unvisited[i].lat, unvisited[i].lng);
      if (d < minDist) {
        minDist = d;
        nearestIdx = i;
      }
    }

    const nextNode = unvisited.splice(nearestIdx, 1)[0];
    routeNodes.push(nextNode);
    currentLat = nextNode.lat;
    currentLng = nextNode.lng;
  }

  // 3. Apply 2-Opt Optimization Refinement
  const optimizedNodes = routeNodes.length > 3 ? twoOpt(routeNodes) : routeNodes;

  // 4. Calculate Leg Distances, Driving Times & Total Stats
  // City driving factor = ~1.25x straight line distance, average speed = 35 km/h (0.58 km/min)
  // + 3 minutes per billboard inspection stop
  let totalDistanceKm = 0;
  let totalTimeMins = 0;

  const waypoints: RouteWaypoint[] = optimizedNodes.map((node, idx) => {
    let legDist = 0;
    let legTime = 3; // 3 mins inspection stop time

    if (idx > 0) {
      const prev = optimizedNodes[idx - 1];
      const straightDist = haversineDistanceKm(prev.lat, prev.lng, node.lat, node.lng);
      legDist = Number((straightDist * 1.25).toFixed(2));
      const drivingTime = Math.ceil(legDist / 0.58);
      legTime = drivingTime + 3;
    }

    totalDistanceKm += legDist;
    totalTimeMins += legTime;

    return {
      order: idx + 1,
      billboard: node.billboard,
      lat: node.lat,
      lng: node.lng,
      legDistanceKm: legDist,
      legTimeMins: legTime,
    };
  });

  // 5. Generate Google Maps Directions URL (max 10 waypoints in URL)
  const gMapsWaypoints = waypoints.slice(0, 10).map(w => `${w.lat},${w.lng}`).join('|');
  const origin = `${waypoints[0].lat},${waypoints[0].lng}`;
  const dest = `${waypoints[waypoints.length - 1].lat},${waypoints[waypoints.length - 1].lng}`;
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&waypoints=${encodeURIComponent(gMapsWaypoints)}&travelmode=driving`;

  return {
    waypoints,
    totalDistanceKm: Number(totalDistanceKm.toFixed(1)),
    totalTimeMins,
    googleMapsUrl,
  };
}
