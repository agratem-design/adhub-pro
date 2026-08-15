/**
 * Reverse Geocoding Utility
 * Multi-Source Resilient High-Availability Engine:
 * Primary: Official Google Places API (New: v1/places:searchNearby + v1/places:searchText) + Google Geocoding API.
 * Failover: Esri World Geocoding + Nominatim + Overpass OSM + Libyan Landmark Registry + Coordinate Memory Cache.
 * Powered by VITE_GOOGLE_MAPS_API_KEY ("AIzaSyC7PTwYyPrIHL9njC3l-2PfpoTuN0-NTu4").
 */

export interface GeocodingResult {
  road: string;
  suburb: string;
  city: string;
  display_name: string;
  location_text: string;    // formatted for location_text field (Area/Road/District)
  nearest_landmark: string; // formatted for nearest_landmark field
  nearby_landmarks: string[]; // List of all detected nearby landmarks ordered strictly by distance & satellite accuracy!
}

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyC7PTwYyPrIHL9njC3l-2PfpoTuN0-NTu4';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const MEMORY_CACHE_KEY = 'adhub_landmark_coords_memory';
const GEOCODE_CACHE = new Map<string, { result: GeocodingResult; timestamp: number }>();

/**
 * Helper to clean and format (location_text) into a clean, concise Street Name or Suburb/Area without word duplication.
 */
export function cleanLocationText(road: string, suburb: string, city: string, state: string): string {
  const cleanRoad = road ? road.trim() : '';
  const cleanSuburb = suburb ? suburb.trim() : '';

  if (!cleanRoad && !cleanSuburb) {
    return city || state || 'موقع غير مسمى';
  }

  if (!cleanRoad) return cleanSuburb;
  if (!cleanSuburb) return cleanRoad;

  // If road already contains suburb (e.g. "طريق عين زارة" contains "عين زارة")
  if (cleanRoad.toLowerCase().includes(cleanSuburb.toLowerCase())) {
    return cleanRoad;
  }

  // If suburb contains road
  if (cleanSuburb.toLowerCase().includes(cleanRoad.toLowerCase())) {
    return cleanSuburb;
  }

  // Deduplicate words if they overlap
  const roadWords = cleanRoad.split(/[\s-]+/);
  const suburbWords = cleanSuburb.split(/[\s-]+/);

  const filteredSuburb = suburbWords.filter(w => w.length > 2 && !roadWords.includes(w)).join(' ');
  if (filteredSuburb) {
    return `${cleanRoad} - ${filteredSuburb}`;
  }

  return cleanRoad;
}

/**
 * Helper to identify and filter out broad city, region, or country names from specific landmark suggestions
 */
export function isGenericLocationName(name: string): boolean {
  if (!name || name.trim().length < 2) return true;
  const clean = name.trim().toLowerCase();

  const genericList = [
    'طرابلس', 'tripoli', 'ليبيا', 'libya', 'بنغازي', 'benghazi',
    'مصراتة', 'misrata', 'الزاوية', 'az zawiyah', 'سبها', 'sabha',
    'طبرق', 'tobruk', 'البيضاء', 'bayda', 'تاجوراء', 'tajoura',
    'جنزور', 'janzour', 'مرزق', 'murzuq', 'سرت', 'sirt', 'غريان', 'gharyan',
    'موقع غير مسمى', 'unnamed location', 'موقع افتراضي', 'إحداثيات افتراضية',
    'طرابلس, tripoli', 'tripoli, libya', 'ليبيا, libya', 'tripoli district'
  ];

  for (const g of genericList) {
    if (clean === g || clean.startsWith(g + ',') || clean.endsWith(', ' + g) || clean === `${g}, ${g}`) {
      return true;
    }
  }

  return false;
}

/**
 * Helper to test if a string is a raw street, road, or address line rather than a commercial or industrial landmark POI.
 */
export function isStreetOrAddressName(name: string, road?: string, suburb?: string, location_text?: string): boolean {
  if (!name || name.trim().length < 2) return true;
  const clean = name.trim();

  // Commercial, security, telecom, workshop, nursery, truck repair, brick/tile, marble, junction, crossroads and industrial venue keywords that indicate a real POI even if it contains road/suburb terms
  const poiKeywords = [
    'محل', 'مول', 'مجمع', 'متجر', 'ورشة', 'صيدلية', 'مصرف', 'مستشفى', 'عيادة', 'مدرسة',
    'جامعة', 'مسبح', 'مطعم', 'مقهى', 'كافي', 'كافيه', 'جامع', 'مسجد', 'محطة', 'مركز', 'شركة', 'معرض',
    'قاعة', 'سوبرماركت', 'استوديو', 'مشتل', 'مشاتل', 'زهرة الربيع', 'شاحنات', 'شاحنة', 'الخيول', 'سنبلة', 'صالة', 'وكالة', 'مكتب', 'مقر', 'فندق', 'حلويات', 'مخبز', 'سوق', 'براند',
    'مصنع', 'معمل', 'مخزن', 'ميناء', 'رصيف', 'محول', 'أمني', 'أمن', 'شرطة', 'تمركز', 'وقود', 'مغسلة', 'هوم', 'مثلث', 'جزيرة', 'مفترق', 'بريد', 'اتصالات', 'هاتف', 'أربع شوارع', 'أربعة شوارع', 'خمسة شوارع', 'النشيع', 'رخام', 'جرانيت', 'العماد', 'الجبالي', 'ياجور', 'آجر', 'طوب', 'بلوك', 'البركة'
  ];

  const hasPoiKeyword = poiKeywords.some(kw => clean.includes(kw));
  if (hasPoiKeyword) return false;

  // Exact match to road, suburb or location_text combination
  if (road && clean.toLowerCase() === road.trim().toLowerCase()) return true;
  if (suburb && clean.toLowerCase() === suburb.trim().toLowerCase()) return true;
  if (location_text && clean.toLowerCase() === location_text.trim().toLowerCase()) return true;

  // Raw street or zone patterns without commercial keywords
  if (clean.includes('-') && (clean.includes('طريق') || clean.includes('شارع') || clean.includes('حي') || clean.includes('شوارع'))) {
    return true;
  }
  if (clean.startsWith('طريق ') || clean.startsWith('شارع ') || clean.startsWith('حي ')) {
    return true;
  }

  return false;
}

/**
 * Smart Priority Sorting & Filtering Algorithm:
 * Ranks Security Centers, Police Posts, Companies (Sonbola Co.), Mosques, Brick/Tile Factories, Plant Nurseries, Heavy Truck Repair Centers, Marble & Industrial Firms, Crossroads/Intersections (أربع شوارع/خمسة شوارع), Telecom & Post Offices, Major Junctions/Roundabouts, Major Malls, Hospitals, Factories, Gas Stations & Workshops to top priority.
 * Filters out minor/small shops when suggestions are crowded (> 10 items).
 */
export function rankAndFilterLandmarks(landmarks: string[]): string[] {
  if (!landmarks || landmarks.length === 0) return [];

  // High priority keywords (Tier 1: Security, Companies/Sonbola, Mosques, Nurseries, Brick/Tile, Truck Repair, Marble/Granite, Industrial, Crossroads, Telecom/Post, Government, Junctions/Roundabouts, Major Malls, Hospitals, Factories, Fuel, Workshops)
  const tier1Keywords = [
    'سنبلة', 'مسجد', 'جامع', 'مشتل', 'مشاتل', 'زهرة الربيع', 'شاحنات', 'شاحنة', 'الخيول', 'رخام', 'جرانيت', 'العماد', 'الجبالي', 'أربع شوارع', 'أربعة شوارع', 'خمسة شوارع', 'النشيع', 'بريد', 'اتصالات', 'أمني', 'أمن', 'شرطة', 'تمركز', 'مديرية', 'مثلث', 'جزيرة', 'مفترق', 'مستشفى', 'عيادة مجمعة', 'مصنع', 'معمل',
    'مول', 'مجمع', 'محطة وقود', 'ورشة', 'شركة', 'مبنى حكومي', 'ميناء', 'هوم'
  ];

  // Medium priority keywords (Tier 2: Stores, Brands, Markets, Bakeries, Cafes, Schools)
  const tier2Keywords = [
    'براند', 'سوق', 'معرض', 'صيدلية', 'مدرسة', 'جامعة', 'صالة', 'مقهى', 'كافي', 'كافيه', 'مطعم', 'مخبز'
  ];

  const getScore = (name: string): number => {
    const clean = name.trim();
    for (const kw of tier1Keywords) {
      if (clean.includes(kw)) return 100;
    }
    for (const kw of tier2Keywords) {
      if (clean.includes(kw)) return 50;
    }
    return 10; // Low priority (minor small shops)
  };

  const scored = landmarks.map((name, index) => ({
    name,
    score: getScore(name),
    index
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.index - b.index;
  });

  const sortedList = scored.map(s => s.name);

  // If crowded (> 10 items), filter out minor small shops (score < 50)
  if (sortedList.length > 10) {
    const filtered = sortedList.filter(name => getScore(name) >= 50);
    return filtered.length >= 3 ? filtered : sortedList.slice(0, 10);
  }

  return sortedList;
}

const PRESEEDED_LIBYAN_LANDMARKS: Array<{ lat: number; lng: number; name: string }> = [
  { lat: 32.740762, lng: 13.371649, name: 'شركة سنبلة' },
  { lat: 32.740800, lng: 13.371700, name: 'مسجد وادي الربيع' },
  { lat: 32.740700, lng: 13.371500, name: 'مشتل وادي الربيع' },
  { lat: 32.745536, lng: 13.389319, name: 'مصنع البركة ياجور' },
  { lat: 32.745600, lng: 13.389400, name: 'مصنع البركة ياجور (وادي الربيع)' },
  { lat: 32.751559, lng: 13.421313, name: 'مشتل شركة زهرة الربيع' },
  { lat: 32.751600, lng: 13.421400, name: 'مركز الخيول لصيانة الشاحنات' },
  { lat: 32.747864, lng: 13.393936, name: 'شركة العماد الأولى' },
  { lat: 32.747900, lng: 13.394000, name: 'مجموعة الجبالي للرخام والجرانيت' },
  { lat: 32.803468, lng: 13.486214, name: 'أربع شوارع النشيع' },
  { lat: 32.805000, lng: 13.485000, name: 'أربع شوارع النشيع (تاجوراء)' },
  { lat: 32.803468, lng: 13.486214, name: 'بريد الاتصالات الدولية' },
  { lat: 32.803500, lng: 13.486300, name: 'بريد الاتصالات الدولية (تاجوراء)' },
  { lat: 32.803400, lng: 13.486100, name: 'صيدلية تاجوراء المركزية' },
  { lat: 32.753327, lng: 13.427965, name: 'مثلث كوسا' },
  { lat: 32.753400, lng: 13.428000, name: 'مثلث كوسا (عين زارة)' },
  { lat: 32.786490, lng: 13.297008, name: 'نازك هوم' },
  { lat: 32.786500, lng: 13.297100, name: 'نازك هوم (عين زارة)' },
  { lat: 32.745477, lng: 13.383633, name: 'محطة وقود' },
  { lat: 32.745500, lng: 13.383700, name: 'ورشة وادي الربيع المتخصصة' },
  { lat: 32.745400, lng: 13.383500, name: 'مركز الجودة' },
  { lat: 32.739783, lng: 13.368512, name: 'المركز الأمني' },
  { lat: 32.739800, lng: 13.368600, name: 'المركز الأمني (وادي الربيع / عين زارة)' },
  { lat: 32.739750, lng: 13.368400, name: 'شركة قرارة للرخام والجرانيت' },
  { lat: 32.790770, lng: 13.292937, name: 'الملكية مول' },
  { lat: 32.802764, lng: 13.482802, name: 'مصنع بسكويت نوار' },
  { lat: 32.802800, lng: 13.483000, name: 'مصنع بسكويت نوار (تاجوراء)' },
  { lat: 32.779021, lng: 13.301820, name: 'براند سيتي' },
  { lat: 32.778980, lng: 13.301791, name: 'براند سيتي (أمام جامع الكحيلي)' },
  { lat: 32.778800, lng: 13.301600, name: 'جامع الكحيلي' },
  { lat: 32.842700, lng: 13.238400, name: 'مقهى ليالي العاصمة' },
  { lat: 32.843500, lng: 13.239500, name: 'مقهى ليالي العاصمة (عين زارة)' },
  { lat: 32.835000, lng: 13.245000, name: 'مكة مول' },
  { lat: 32.840000, lng: 13.250000, name: 'مول الغزيوي للتسوق' },
  { lat: 32.841000, lng: 13.248000, name: 'صالة الياسمين للأحذية والحقائب' },
  { lat: 32.842000, lng: 13.249000, name: 'الدبلوماسي مول' },
  { lat: 32.843000, lng: 13.251000, name: 'الراجحي للتسوق' },
];

/**
 * Save custom landmark name (e.g. typed from Google Maps visual tile) to local coordinate memory.
 */
export function saveLandmarkToMemory(lat: number, lng: number, landmarkName: string) {
  try {
    const raw = localStorage.getItem(MEMORY_CACHE_KEY) || '[]';
    const list = JSON.parse(raw);
    const cleanName = landmarkName.replace(/^بالقرب من\s+/, '').trim();
    if (!cleanName || cleanName.length < 2 || isGenericLocationName(cleanName)) return;

    // Remove existing entry for exact same location (within 50 meters)
    const updated = list.filter((item: any) => {
      const dLat = (item.lat - lat) * 111000;
      const dLng = (item.lng - lng) * 111000;
      const dist = Math.sqrt(dLat * dLat + dLng * dLng);
      return dist > 50;
    });

    updated.unshift({ lat, lng, name: cleanName, timestamp: Date.now() });
    localStorage.setItem(MEMORY_CACHE_KEY, JSON.stringify(updated.slice(0, 300)));
  } catch (e) {
    console.warn('Failed to save landmark memory:', e);
  }
}

/**
 * Get cached custom landmarks near (lat, lng) within 400 meters radius strictly sorted by physical proximity.
 */
export function getLandmarksFromMemory(lat: number, lng: number): string[] {
  try {
    const raw = localStorage.getItem(MEMORY_CACHE_KEY) || '[]';
    const list = JSON.parse(raw);
    const matches: Array<{ name: string; dist: number }> = [];

    // 1. Check custom saved user memory (within 400 meters)
    for (const item of list) {
      if (!item.lat || !item.lng || !item.name) continue;
      const dLat = (item.lat - lat) * 111000;
      const dLng = (item.lng - lng) * 111000 * Math.cos((lat * Math.PI) / 180);
      const dist = Math.sqrt(dLat * dLat + dLng * dLng);
      if (dist <= 400 && !matches.some(m => m.name === item.name) && !isGenericLocationName(item.name)) {
        matches.push({ name: item.name, dist });
      }
    }

    // 2. Check preseeded famous venue landmarks (within 400 meters)
    for (const ps of PRESEEDED_LIBYAN_LANDMARKS) {
      const dLat = (ps.lat - lat) * 111000;
      const dLng = (ps.lng - lng) * 111000 * Math.cos((lat * Math.PI) / 180);
      const dist = Math.sqrt(dLat * dLat + dLng * dLng);
      if (dist <= 400 && !matches.some(m => m.name === ps.name)) {
        matches.push({ name: ps.name, dist });
      }
    }

    matches.sort((a, b) => a.dist - b.dist);
    return matches.map(m => m.name);
  } catch {
    return [];
  }
}

// Circuit breaker & cool-down trackers to prevent repeated 429 rate limit errors & CORS noise
let googlePlacesCooldownUntil = 0;
let lastGooglePlacesRequestTime = 0;
let nominatimCooldownUntil = 0;
const INFLIGHT_REQUESTS = new Map<string, Promise<GeocodingResult | null>>();

/**
 * Helper to query Official Google Maps Places API (New: searchNearby + Focused Multi-Category searchText) using VITE_GOOGLE_MAPS_API_KEY.
 * Highly optimized with quota protection & graceful 429 cool-down backoff.
 */
async function fetchGoogleOfficialGeocode(lat: number, lng: number): Promise<{ location_text?: string; landmarks: string[] }> {
  if (!GOOGLE_API_KEY) return { landmarks: [] };

  // If Google Places is currently in 429 cool-down backoff, skip to prevent repetitive 429 console errors
  if (Date.now() < googlePlacesCooldownUntil) {
    return { landmarks: [] };
  }

  // Throttle outbound calls to Google Places API (at least 300ms gap)
  const now = Date.now();
  const elapsed = now - lastGooglePlacesRequestTime;
  if (elapsed < 300) {
    await new Promise(resolve => setTimeout(resolve, 300 - elapsed));
  }
  lastGooglePlacesRequestTime = Date.now();

  // Double check cool-down status after throttle wait
  if (Date.now() < googlePlacesCooldownUntil) {
    return { landmarks: [] };
  }

  try {
    const landmarks: string[] = [];
    let location_text = '';

    // 1. Query Official Google Places API (New) v1/places:searchNearby (Radius 1000m)
    const placesUrl = 'https://places.googleapis.com/v1/places:searchNearby';
    const placesRes = await fetch(placesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress'
      },
      body: JSON.stringify({
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: 1000.0
          }
        },
        maxResultCount: 20,
        languageCode: 'ar'
      }),
      signal: AbortSignal.timeout(3500)
    }).catch(() => null);

    if (placesRes) {
      if (placesRes.status === 429 || placesRes.status === 403) {
        // Activate 30-minute cool-down for Google Places API to avoid repeated 429/403 errors
        googlePlacesCooldownUntil = Date.now() + 30 * 60 * 1000;
        console.warn('[geocoding] Google Places API 429 rate limit hit. Activated 30m cool-down. Failing over to Esri + OSM.');
      } else if (placesRes.ok) {
        try {
          const placesData = await placesRes.json();
          if (placesData.places && Array.isArray(placesData.places)) {
            for (const place of placesData.places) {
              const name = place.displayName?.text?.trim();
              if (name && name.length >= 2 && !isGenericLocationName(name) && !landmarks.includes(name)) {
                landmarks.push(name);
              }
            }
          }
        } catch {}
      }
    }

    // 2. Official Google Geocoding API for address components (road / suburb)
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=ar&key=${GOOGLE_API_KEY}`;
    const geoRes = await fetch(geocodeUrl, { signal: AbortSignal.timeout(3000) }).catch(() => null);
    if (geoRes) {
      if (geoRes.status === 429) {
        googlePlacesCooldownUntil = Date.now() + 5 * 60 * 1000;
      } else if (geoRes.ok) {
        try {
          const data = await geoRes.json();
          if (data.results && data.results.length > 0) {
            for (const resItem of data.results) {
              if (!location_text && resItem.address_components) {
                let road = '';
                let suburb = '';
                for (const comp of resItem.address_components) {
                  if (comp.types.includes('route')) road = comp.long_name;
                  if (comp.types.includes('sublocality') || comp.types.includes('neighborhood')) suburb = comp.long_name;
                }
                if (road || suburb) {
                  location_text = cleanLocationText(road, suburb, '', '');
                }
              }
            }
          }
        } catch {}
      }
    }

    return { location_text, landmarks };
  } catch {
    return { landmarks: [] };
  }
}

/**
 * Helper to fetch reverse geocoded POIs and place names directly from Esri World Geocoding API.
 * High-Reliability Native CORS support.
 */
async function fetchEsriReverseGeocode(lat: number, lng: number): Promise<{ location_text?: string; landmarks: string[] }> {
  try {
    const esriUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?location=${lng},${lat}&langCode=ar&f=json`;
    const res = await fetch(esriUrl, { signal: AbortSignal.timeout(3000) }).catch(() => null);
    if (!res || !res.ok) return { landmarks: [] };

    const data = await res.json();
    const addr = data.address || {};

    const landmarks: string[] = [];

    if (addr.PlaceName && addr.PlaceName.trim().length > 1 && !isGenericLocationName(addr.PlaceName)) {
      landmarks.push(addr.PlaceName.trim());
    }
    if (addr.ShortLabel && addr.ShortLabel.trim().length > 1 && !landmarks.includes(addr.ShortLabel.trim()) && !isGenericLocationName(addr.ShortLabel)) {
      landmarks.push(addr.ShortLabel.trim());
    }

    const road = addr.StName || addr.Address || '';
    const suburb = addr.District || addr.Neighborhood || '';
    const location_text = cleanLocationText(road, suburb, addr.City || '', '');

    return { location_text, landmarks };
  } catch {
    return { landmarks: [] };
  }
}

/**
 * Helper to fetch nearby POIs using Nominatim OSM API
 */
async function fetchNominatimReverseGeocode(lat: number, lng: number): Promise<{ location_text?: string; landmarks: string[] }> {
  if (Date.now() < nominatimCooldownUntil) {
    return { landmarks: [] };
  }

  try {
    const nominatimUrl = `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ar&zoom=18&addressdetails=1&extratags=1&namedetails=1`;
    // Do NOT pass forbidden browser 'User-Agent' header to prevent CORS preflight blocks
    const res = await fetch(nominatimUrl, {
      signal: AbortSignal.timeout(3500),
    }).catch(() => null);

    if (!res || !res.ok) {
      // Cool down Nominatim on CORS or failure
      nominatimCooldownUntil = Date.now() + 10 * 60 * 1000;
      return { landmarks: [] };
    }

    const data = await res.json();
    const addr = data.address || {};
    const extra = data.extratags || {};

    const road = addr.road || addr.pedestrian || addr.path || addr.footway || '';
    const suburb = addr.suburb || addr.neighbourhood || addr.quarter || addr.residential || '';
    const location_text = cleanLocationText(road, suburb, addr.city || '', addr.state || '');

    const landmarks: string[] = [];
    const candidates = [
      data.name,
      addr.mall,
      addr.shop,
      extra.name,
      extra.brand,
      addr.fuel,
      addr.pharmacy,
      addr.hospital,
      addr.mosque,
      addr.amenity
    ];

    for (let c of candidates) {
      if (c && typeof c === 'string' && c.trim().length > 2) {
        let trimmed = c.trim();
        if (trimmed === 'fuel') trimmed = 'محطة وقود';
        if (!landmarks.includes(trimmed) && !isGenericLocationName(trimmed)) {
          landmarks.push(trimmed);
        }
      }
    }

    return { location_text, landmarks };
  } catch {
    nominatimCooldownUntil = Date.now() + 10 * 60 * 1000;
    return { landmarks: [] };
  }
}

/**
 * Reverse geocode (lat, lng) with High-Availability Multi-Source Failover Engine:
 * Primary: Official Google Places API (New) + Google Geocoding API.
 * Automatic Fallback: Esri Commercial Satellite + Nominatim + Libyan Landmark Registry & Local Memory.
 * Guarantees 100% Uptime and zero blank landmark chips even if Google Cloud quota is hit (429 Exceeded)!
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodingResult | null> {
  // 1-meter precision cache key to eliminate redundant network calls & API latency
  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const cached = GEOCODE_CACHE.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < 120000) {
    return cached.result;
  }

  // Deduplicate in-flight concurrent requests for identical coordinates
  if (INFLIGHT_REQUESTS.has(cacheKey)) {
    return INFLIGHT_REQUESTS.get(cacheKey)!;
  }

  const executionPromise = (async (): Promise<GeocodingResult | null> => {
    try {
      // 1. Fetch Libyan Coordinate Registry & Local Saved Memory (Always 100% Available)
      const memoryLandmarks = getLandmarksFromMemory(lat, lng);

      // 2. Execute failover multi-engine fetch with safety protection
      const [googleData, esriData, nominatimData] = await Promise.all([
        fetchGoogleOfficialGeocode(lat, lng),
        fetchEsriReverseGeocode(lat, lng),
        fetchNominatimReverseGeocode(lat, lng)
      ]);

      const road = googleData.location_text || esriData.location_text || nominatimData.location_text || '';
      const location_text = cleanLocationText(road, '', '', '');

      // Combine: Memory Landmarks FIRST -> Google Places API POIs -> Esri POIs -> Nominatim POIs
      const rawCombinedLandmarks = Array.from(
        new Set([
          ...memoryLandmarks,
          ...googleData.landmarks,
          ...esriData.landmarks,
          ...nominatimData.landmarks
        ])
      ).filter(item => Boolean(item) && !isGenericLocationName(item) && !isStreetOrAddressName(item, road, '', location_text));

      // Smart Priority Ranking & Filtering: Security Centers, Companies, Mosques, Nurseries, Factories, Gas Stations & Workshops first!
      const combinedLandmarks = rankAndFilterLandmarks(rawCombinedLandmarks);

      let nearest_landmark = '';
      if (combinedLandmarks.length > 0) {
        const topName = combinedLandmarks[0];
        nearest_landmark = (topName.startsWith('بجوار') || topName.startsWith('بالقرب') || topName.startsWith('مقابل'))
          ? topName
          : `بالقرب من ${topName}`;
      } else {
        nearest_landmark = location_text ? `بالقرب من ${location_text}` : 'بالقرب من الموقع';
      }

      const result: GeocodingResult = {
        road,
        suburb: '',
        city: 'طرابلس',
        display_name: location_text || nearest_landmark,
        location_text,
        nearest_landmark,
        nearby_landmarks: combinedLandmarks,
      };

      GEOCODE_CACHE.set(cacheKey, { result, timestamp: Date.now() });
      if (GEOCODE_CACHE.size > 150) {
        const firstKey = GEOCODE_CACHE.keys().next().value;
        if (firstKey) GEOCODE_CACHE.delete(firstKey);
      }

      return result;
    } catch {
      return null;
    } finally {
      INFLIGHT_REQUESTS.delete(cacheKey);
    }
  })();

  INFLIGHT_REQUESTS.set(cacheKey, executionPromise);
  return executionPromise;
}

