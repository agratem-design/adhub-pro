import { supabase } from '@/integrations/supabase/client';

let globalSizeRankMap = new Map<string, number>();
let globalMuniRankMap = new Map<string, number>();

export async function initSortRanks() {
  try {
    const [sizesRes, munisRes] = await Promise.all([
      supabase.from('sizes').select('name, sort_order').order('sort_order', { ascending: true }),
      supabase.from('municipalities').select('name, sort_order').order('sort_order', { ascending: true })
    ]);

    if (sizesRes.data) {
      const map = new Map<string, number>();
      sizesRes.data.forEach((s: any, idx: number) => {
        const name = String(s?.name ?? '').trim();
        if (!name) return;
        const rank = typeof s?.sort_order === 'number' && s.sort_order > 0 ? s.sort_order : idx + 1;
        map.set(name, rank);
        map.set(name.toLowerCase(), rank);
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
      });
      globalMuniRankMap = map;
    }
  } catch (e) {
    console.warn('Failed to initSortRanks:', e);
  }
}

// Auto-init on module load
initSortRanks().catch(() => {});

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

export function getLevelRank(rawLevel: string | null | undefined): number {
  if (!rawLevel) return 99;
  const l = String(rawLevel).trim().toUpperCase();
  if (l.includes('A') || l.includes('أ') || l.includes('VIP') || l === '1') return 1;
  if (l.includes('B') || l.includes('ب') || l === '2') return 2;
  if (l.includes('C') || l.includes('ج') || l === '3') return 3;
  if (l.includes('D') || l.includes('د') || l === '4') return 4;
  return 5;
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
  const base = norm.split('-')[0];
  for (const [key, rank] of map.entries()) {
    const kNorm = key.toLowerCase().replace(/[×*]/g, 'x').split('-')[0];
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
  return 9999;
}

/**
 * Strict Multi-Level Billboard Sorter:
 * 1. Size Area DESCENDING (4x12 = 48m² > 4x10 = 40m² > 3x8 = 24m² > 3x6 = 18m² > 3x4 = 12m²)
 * 2. Billboard Level Rank (Level A/VIP = 1 > B = 2 > C = 3 > D = 4)
 * 3. Municipality sort_order (from DB municipalities table)
 * 4. Size Table sort_order (if set in DB sizes table)
 * 5. Billboard ID
 */
export function sortBillboardsStandardSync<T extends Record<string, any>>(
  billboards: T[],
  sizeData?: any[],
  muniData?: any[]
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

    // 3. Billboard Level (A/VIP = 1 > B = 2 > C = 3 > D = 4)
    const levelRankA = getLevelRank((a as any).Level ?? (a as any).level ?? (a as any).billboard_level);
    const levelRankB = getLevelRank((b as any).Level ?? (b as any).level ?? (b as any).billboard_level);
    if (levelRankA !== levelRankB) {
      return levelRankA - levelRankB;
    }

    // 4. Municipality Rank (from DB municipalities table sort_order)
    const munA = String((a as any).Municipality || (a as any).municipality || (a as any).City || (a as any).city || '').trim();
    const munB = String((b as any).Municipality || (b as any).municipality || (b as any).City || (b as any).city || '').trim();
    const munOrderA = getMuniRankFromMap(munA, muniMap);
    const munOrderB = getMuniRankFromMap(munB, muniMap);
    if (munOrderA !== munOrderB) {
      return munOrderA - munOrderB;
    }

    // 5. Billboard ID
    const idA = Number((a as any).ID || (a as any).id || 0);
    const idB = Number((b as any).ID || (b as any).id || 0);
    return idA - idB;
  });
}
