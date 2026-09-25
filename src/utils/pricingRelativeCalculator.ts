import { readDurationPrice } from './pricingDuration';
import { relativeCompanyPrice } from './relativeCompanyPrice';

export type PricingRow = {
  id?: number;
  size: string;
  billboard_level: string;
  customer_category: string;
  duration_prices?: Record<string, any>;
  [key: string]: any;
};

export type PricingPeriod = {
  key: string;
  label: string;
  dbColumn: string;
};

export interface RelativePricingPlanItem {
  size: string;
  level: string;
  customer: string;
  period: PricingPeriod;
  current?: PricingRow;
  base: number | null;
  before: number | null;
  after: number | null;
  diff: number | null;
  referenceLabel: string;
  sizeOrder?: number;
}

export interface SizeSortItem {
  id?: number;
  name: string;
  sort_order?: number | null;
}

export interface ComputeRelativePricingParams {
  customer: string;
  targetLevel: string;
  referenceLevel: string; // other level code (e.g. 'A') or '__SAME__'
  records: PricingRow[];
  periods: PricingPeriod[];
  scope: string; // 'current' | 'all' | 'level' | 'single_current' | 'single_all' | 'level_all'
  month: string;
  targetSize?: string;
  mode: 'discount' | 'increase' | 'zero';
  rate: number;
  valid: boolean;
  sizes?: SizeSortItem[];
}

export interface RelativePricingResult {
  plan: RelativePricingPlanItem[];
  changes: RelativePricingPlanItem[];
  skipped: number;
}

/**
 * Calculates relative pricing plan for either:
 * 1. Company Level-to-Level pricing (customer === 'شركات'):
 *    Adjusting targetLevel from referenceLevel (or current prices of targetLevel)
 * 2. Category-to-Company pricing (customer !== 'شركات'):
 *    Adjusting category prices from the company category benchmark
 */
export function computeRelativePricingPlan({
  customer,
  targetLevel,
  referenceLevel,
  records,
  periods,
  scope,
  month,
  targetSize,
  mode,
  rate,
  valid,
  sizes,
}: ComputeRelativePricingParams): RelativePricingResult {
  const isCompany = customer === 'شركات';

  // 1. Determine selected periods
  const isSinglePeriod = scope === 'current' || scope === 'single_current' || (!!targetSize && scope !== 'all' && scope !== 'single_all' && scope !== 'level_all');
  const selectedPeriods = isSinglePeriod
    ? periods.filter(p => p.key === month)
    : periods;
  const periodsToUse = selectedPeriods.length > 0 ? selectedPeriods : periods.slice(0, 1);

  // 2. Build size order map for sorting according to size rank (sort_order)
  const sizeOrderMap = new Map<string, number>();
  if (sizes && sizes.length > 0) {
    sizes.forEach((s, idx) => {
      if (s && s.name) {
        const order = (s.sort_order != null && Number.isFinite(s.sort_order))
          ? Number(s.sort_order)
          : (idx + 1);
        const nameTrimmed = s.name.trim();
        sizeOrderMap.set(nameTrimmed, order);
        sizeOrderMap.set(nameTrimmed.toLowerCase(), order);
      }
    });
  }

  const getSizeOrder = (sizeName: string): number => {
    const trimmed = (sizeName || '').trim();
    if (sizeOrderMap.has(trimmed)) return sizeOrderMap.get(trimmed)!;
    if (sizeOrderMap.has(trimmed.toLowerCase())) return sizeOrderMap.get(trimmed.toLowerCase())!;
    return 999;
  };

  const compareSizes = (a: string, b: string): number => {
    const orderA = getSizeOrder(a);
    const orderB = getSizeOrder(b);
    if (orderA !== orderB) return orderA - orderB;
    return a.localeCompare(b, 'ar');
  };

  const plan: RelativePricingPlanItem[] = [];

  if (isCompany) {
    // Determine sizes to include, sorted by defined size rank
    let sizesToInclude: string[] = [];
    if (targetSize && scope !== 'level_all' && scope !== 'all') {
      sizesToInclude = [targetSize];
    } else {
      const sizeSet = new Set<string>();
      records
        .filter(r => r.customer_category === 'شركات' && (
          r.billboard_level === targetLevel ||
          (referenceLevel !== '__SAME__' && r.billboard_level === referenceLevel)
        ))
        .forEach(r => sizeSet.add(r.size));
      if (targetSize) sizeSet.add(targetSize);
      sizesToInclude = Array.from(sizeSet).sort(compareSizes);
    }

    const refBenchmarkLevel = referenceLevel === '__SAME__' ? targetLevel : referenceLevel;
    const refLabel = referenceLevel === '__SAME__' ? 'السعر الحالي' : `المستوى ${referenceLevel}`;

    for (const size of sizesToInclude) {
      const benchmarkRow = records.find(
        r => r.customer_category === 'شركات' && r.billboard_level === refBenchmarkLevel && r.size === size
      );
      const currentRow = records.find(
        r => r.customer_category === 'شركات' && r.billboard_level === targetLevel && r.size === size
      );

      for (const period of periodsToUse) {
        const base = readDurationPrice(benchmarkRow, period.dbColumn);
        const before = readDurationPrice(currentRow, period.dbColumn);
        const after = valid ? relativeCompanyPrice(base, mode, rate) : null;
        const diff = (after != null && before != null) ? (after - before) : null;

        plan.push({
          size,
          level: targetLevel,
          customer: 'شركات',
          period,
          current: currentRow,
          base,
          before,
          after,
          diff,
          referenceLabel: refLabel,
          sizeOrder: getSizeOrder(size),
        });
      }
    }
  } else {
    // Non-company category: comparing to company benchmark for same level and size
    const isSingleSize = !!targetSize && scope !== 'all';
    const isAllLevels = scope === 'all' && !targetSize;

    const candidateRows = records.filter(r =>
      (r.customer_category === 'شركات' || r.customer_category === customer) &&
      (isAllLevels || r.billboard_level === targetLevel) &&
      (!isSingleSize || r.size === targetSize)
    );

    const pairMap = new Map<string, { size: string; level: string }>();
    candidateRows.forEach(r => {
      const key = `${r.size}:::${r.billboard_level}`;
      if (!pairMap.has(key)) {
        pairMap.set(key, { size: r.size, level: r.billboard_level });
      }
    });

    const pairs = Array.from(pairMap.values()).sort((a, b) => {
      const sizeCmp = compareSizes(a.size, b.size);
      if (sizeCmp !== 0) return sizeCmp;
      return a.level.localeCompare(b.level);
    });

    for (const pair of pairs) {
      const benchmarkRow = records.find(
        r => r.size === pair.size && r.billboard_level === pair.level && r.customer_category === 'شركات'
      );
      const currentRow = records.find(
        r => r.size === pair.size && r.billboard_level === pair.level && r.customer_category === customer
      );

      for (const period of periodsToUse) {
        const base = readDurationPrice(benchmarkRow, period.dbColumn);
        const before = readDurationPrice(currentRow, period.dbColumn);
        const after = valid ? relativeCompanyPrice(base, mode, rate) : null;
        const diff = (after != null && before != null) ? (after - before) : null;

        plan.push({
          size: pair.size,
          level: pair.level,
          customer,
          period,
          current: currentRow,
          base,
          before,
          after,
          diff,
          referenceLabel: 'شركات',
          sizeOrder: getSizeOrder(pair.size),
        });
      }
    }
  }

  // Ensure deterministic strict ordering by size rank -> billboard level -> period
  const periodOrderMap = new Map<string, number>();
  periods.forEach((p, idx) => {
    periodOrderMap.set(p.key, idx);
  });

  plan.sort((a, b) => {
    const sizeCmp = compareSizes(a.size, b.size);
    if (sizeCmp !== 0) return sizeCmp;
    const levelCmp = a.level.localeCompare(b.level);
    if (levelCmp !== 0) return levelCmp;
    const pA = periodOrderMap.get(a.period.key) ?? 999;
    const pB = periodOrderMap.get(b.period.key) ?? 999;
    return pA - pB;
  });

  const changes = plan.filter(p => p.after !== null && p.after !== p.before);
  const skipped = plan.filter(p => p.after === null).length;

  return { plan, changes, skipped };
}
