import { supabase } from '@/integrations/supabase/client';

let globalSizeRankMap = new Map<string, number>();
let globalMuniRankMap = new Map<string, number>();
let globalLevelRankMap = new Map<string, number>();

export function normalizeArabicText(txt?: string | null): string {
  return String(txt || '')
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .replace(/[\s\-_]/g, '');
}

const MUNI_ALIASES: Record<string, string> = {
  'قصر خيار': 'قصر الاخيار',
  'قصرخيار': 'قصر الاخيار',
  'طرابلس': 'طرابلس المركز',
  'القره بولى': 'القره بوللي',
  'القرهبولي': 'القره بوللي',
  'القرهبوللي': 'القره بوللي',
  'قره بوللي': 'القره بوللي',
  'قرهبولي': 'القره بوللي',
  'مسلاتة': 'امسلاتة',
  'مسلاته': 'امسلاتة',
  'إمسلاتة': 'امسلاتة',
  'امسلاته': 'امسلاتة',
};

export async function initSortRanks() {
  try {
    const [sizesRes, munisRes, levelsRes] = await Promise.all([
      supabase.from('sizes').select('name, sort_order').order('sort_order', { ascending: true }),
      supabase.from('municipalities').select('name, code, sort_order').order('sort_order', { ascending: true }),
      supabase.from('billboard_levels').select('level_code, level_name, sort_order').order('sort_order', { ascending: true }),
    ]);

    if (sizesRes.data) {
      const map = new Map<string, number>();
      sizesRes.data.forEach((s: any, idx: number) => {
        const name = String(s?.name ?? '').trim();
        if (!name) return;
        const rank = typeof s?.sort_order === 'number' && s.sort_order > 0 ? s.sort_order : idx + 1;
        map.set(name, rank);
        map.set(name.toLowerCase(), rank);
        map.set(name.toLowerCase().replace(/[×*]/g, 'x').replace(/\s+/g, ''), rank);
      });
      globalSizeRankMap = map;
    }

    if (munisRes.data) {
      const map = new Map<string, number>();
      munisRes.data.forEach((m: any, idx: number) => {
        const name = String(m?.name ?? '').trim();
        if (!name) return;
        const rank = typeof m?.sort_order === 'number' && m.sort_order > 0 ? m.sort_order : idx + 1;
        map.set(name, rank);
        map.set(name.toLowerCase(), rank);
        map.set(normalizeArabicText(name), rank);
        if (m.code) {
          map.set(String(m.code).trim().toUpperCase(), rank);
        }
      });

      Object.entries(MUNI_ALIASES).forEach(([alias, targetName]) => {
        const targetRank = map.get(targetName) ?? map.get(normalizeArabicText(targetName));
        if (targetRank !== undefined) {
          map.set(alias, targetRank);
          map.set(normalizeArabicText(alias), targetRank);
        }
      });

      globalMuniRankMap = map;
    }

    if (levelsRes.data) {
      const map = new Map<string, number>();
      levelsRes.data.forEach((l: any, idx: number) => {
        const code = String(l?.level_code ?? '').trim().toUpperCase();
        const name = String(l?.level_name ?? '').trim();
        const rank = typeof l?.sort_order === 'number' && l.sort_order > 0 ? l.sort_order : idx + 1;
        if (code) map.set(code, rank);
        if (name) {
          map.set(name, rank);
          map.set(normalizeArabicText(name), rank);
        }
      });
      globalLevelRankMap = map;
    }
  } catch (e) {
    console.warn('Failed to initSortRanks:', e);
  }
}

// Auto-init on module load
initSortRanks().catch(() => {});

export async function getBillboardsSortMaps(): Promise<{
  sizeOrderMap: Map<string, number>;
  municipalityOrderMap: Map<string, number>;
  levelOrderMap: Map<string, number>;
}> {
  if (globalSizeRankMap.size === 0 || globalMuniRankMap.size === 0 || globalLevelRankMap.size === 0) {
    await initSortRanks();
  }
  return {
    sizeOrderMap: globalSizeRankMap,
    municipalityOrderMap: globalMuniRankMap,
    levelOrderMap: globalLevelRankMap,
  };
}

export function parseSizeArea(rawSize: string): number {
  if (!rawSize) return 0;
  const cleaned = String(rawSize).toLowerCase().replace(/[×*]/g, 'x').trim();
  const match = cleaned.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/);
  if (match) {
    const w = parseFloat(match[1]);
    const h = parseFloat(match[2]);
    if (!isNaN(w) && !isNaN(h)) {
      return w * h;
    }
  }
  return 0;
}

export function getLevelRank(rawLevel: string | null | undefined, customMap?: Map<string, number>): number {
  if (!rawLevel) return 99;
  const map = (customMap && customMap.size > 0) ? customMap : globalLevelRankMap;
  const l = String(rawLevel).trim();
  const upper = l.toUpperCase();
  if (map.has(upper)) return map.get(upper)!;
  if (map.has(l)) return map.get(l)!;
  const norm = normalizeArabicText(l);
  if (map.has(norm)) return map.get(norm)!;

  if (upper.includes('S') || upper.includes('VIP') || norm.includes('مميز')) return 1;
  if (upper.includes('A') || upper.includes('أ') || norm.includes('اول') || upper === '1') return 2;
  if (upper.includes('B') || upper.includes('ب') || norm.includes('ثاني') || upper === '2') return 4;
  if (upper.includes('C') || upper.includes('ج') || norm.includes('عادي') || norm.includes('ثالث') || upper === '3') return 5;
  if (upper.includes('D') || upper.includes('د') || norm.includes('رابع') || upper === '4') return 6;
  return 99;
}

export function getSizeRankFromMap(raw: string, customMap?: Map<string, number>): number {
  const map = (customMap && customMap.size > 0) ? customMap : globalSizeRankMap;
  const s = String(raw || '').trim();
  if (!s) return 9999;
  if (map.has(s)) return map.get(s)!;
  const lower = s.toLowerCase();
  if (map.has(lower)) return map.get(lower)!;
  const norm = lower.replace(/[×*]/g, 'x');
  if (map.has(norm)) return map.get(norm)!;
  const compact = norm.replace(/\s+/g, '');
  if (map.has(compact)) return map.get(compact)!;
  const base = compact.split('-')[0];
  for (const [key, rank] of map.entries()) {
    const kNorm = key.toLowerCase().replace(/[×*]/g, 'x').replace(/\s+/g, '').split('-')[0];
    if (kNorm === base) return rank;
  }
  return 9999;
}

export function getMuniRankFromMap(raw: string, customMap?: Map<string, number>): number {
  const map = (customMap && customMap.size > 0) ? customMap : globalMuniRankMap;
  const m = String(raw || '').trim();
  if (!m) return 9999;
  if (map.has(m)) return map.get(m)!;
  const lower = m.toLowerCase();
  if (map.has(lower)) return map.get(lower)!;
  const norm = normalizeArabicText(m);
  if (map.has(norm)) return map.get(norm)!;
  return 9999;
}

/**
 * Strict Multi-Level Billboard Sorter:
 * 1. Size sort_order from Settings (رتبة المقاس من جدول المقاسات)
 * 2. Size Area DESCENDING as fallback (المساحة الأكبر أولاً)
 * 3. Municipality / City sort_order (من جدول البلديات)
 * 4. Billboard Level Rank (S > A > B > C > D من جدول المستويات)
 * 5. Billboard ID
 */
export function sortBillboardsStandardSync<T extends Record<string, any>>(
  billboards: T[],
  sizeData?: any[],
  muniData?: any[],
  levelData?: any[]
): T[] {
  let sizeMap = globalSizeRankMap;
  if (sizeData && Array.isArray(sizeData) && sizeData.length > 0) {
    sizeMap = new Map<string, number>();
    sizeData.forEach((s: any, idx: number) => {
      const name = String(s?.name ?? '').trim();
      if (!name) return;
      const rank = typeof s?.sort_order === 'number' && s.sort_order > 0 ? s.sort_order : idx + 1;
      sizeMap.set(name, rank);
      sizeMap.set(name.toLowerCase(), rank);
      sizeMap.set(name.toLowerCase().replace(/[×*]/g, 'x').replace(/\s+/g, ''), rank);
    });
  }

  let muniMap = globalMuniRankMap;
  if (muniData && Array.isArray(muniData) && muniData.length > 0) {
    muniMap = new Map<string, number>();
    muniData.forEach((m: any, idx: number) => {
      const name = String(m?.name ?? '').trim();
      if (!name) return;
      const rank = typeof m?.sort_order === 'number' && m.sort_order > 0 ? m.sort_order : idx + 1;
      muniMap.set(name, rank);
      muniMap.set(name.toLowerCase(), rank);
      muniMap.set(normalizeArabicText(name), rank);
      if (m.code) {
        muniMap.set(String(m.code).trim().toUpperCase(), rank);
      }
    });
    Object.entries(MUNI_ALIASES).forEach(([alias, targetName]) => {
      const targetRank = muniMap.get(targetName) ?? muniMap.get(normalizeArabicText(targetName));
      if (targetRank !== undefined) {
        muniMap.set(alias, targetRank);
        muniMap.set(normalizeArabicText(alias), targetRank);
      }
    });
  }

  let levelMap = globalLevelRankMap;
  if (levelData && Array.isArray(levelData) && levelData.length > 0) {
    levelMap = new Map<string, number>();
    levelData.forEach((l: any, idx: number) => {
      const code = String(l?.level_code ?? '').trim().toUpperCase();
      const name = String(l?.level_name ?? '').trim();
      const rank = typeof l?.sort_order === 'number' && l.sort_order > 0 ? l.sort_order : idx + 1;
      if (code) levelMap.set(code, rank);
      if (name) {
        levelMap.set(name, rank);
        levelMap.set(normalizeArabicText(name), rank);
      }
    });
  }

  return [...billboards].sort((a, b) => {
    const sizeA = String((a as any).Size || (a as any).size || (a as any).Size_Name || '').trim();
    const sizeB = String((b as any).Size || (b as any).size || (b as any).Size_Name || '').trim();

    // 1. Size Table sort_order from Settings (رتبة المقاس من الإعدادات كأولوية أولى)
    const orderA = getSizeRankFromMap(sizeA, sizeMap);
    const orderB = getSizeRankFromMap(sizeB, sizeMap);
    if (orderA !== orderB) {
      return orderA - orderB;
    }

    // 2. Size Area DESCENDING (4x12 [48m²] > 4x10 [40m²] > 3x8 [24m²] > 3x6 [18m²] > 3x4 [12m²])
    const areaA = parseSizeArea(sizeA);
    const areaB = parseSizeArea(sizeB);
    if (areaA !== areaB && (areaA > 0 || areaB > 0)) {
      return areaB - areaA;
    }

    // 3. Municipality / City Rank (from DB municipalities table sort_order)
    const munA = String((a as any).Municipality || (a as any).municipality || (a as any).City || (a as any).city || '').trim();
    const munB = String((b as any).Municipality || (b as any).municipality || (b as any).City || (b as any).city || '').trim();
    const munOrderA = getMuniRankFromMap(munA, muniMap);
    const munOrderB = getMuniRankFromMap(munB, muniMap);
    if (munOrderA !== munOrderB) {
      return munOrderA - munOrderB;
    }

    // 4. Billboard Level (S = 1 > A = 2 > B = 4 > C = 5)
    const levelRankA = getLevelRank((a as any).Level ?? (a as any).level ?? (a as any).billboard_level, levelMap);
    const levelRankB = getLevelRank((b as any).Level ?? (b as any).level ?? (b as any).billboard_level, levelMap);
    if (levelRankA !== levelRankB) {
      return levelRankA - levelRankB;
    }

    // 5. Billboard ID
    const idA = Number((a as any).ID || (a as any).id || 0);
    const idB = Number((b as any).ID || (b as any).id || 0);
    if (idA !== idB && idA > 0 && idB > 0) {
      return idA - idB;
    }

    // 6. Billboard Name
    const nameA = String((a as any).Billboard_Name || (a as any).billboard_name || (a as any).name || '');
    const nameB = String((b as any).Billboard_Name || (b as any).billboard_name || (b as any).name || '');
    return nameA.localeCompare(nameB, 'ar');
  });
}

