import { isCustomDuration, readDurationPrice } from './pricingDuration';

export interface PricingRules {
  enabled: boolean;
  baseLevel: string;
  rates: Record<string, number>;
  sizeAliases: Record<string, string>;
  position: 'top' | 'bottom';
  baseOnly: boolean;
  hiddenPrintLevels?: string[];
}

export const defaultPricingRules: PricingRules = { enabled: false, baseLevel: 'A', rates: {}, sizeAliases: {}, position: 'bottom', baseOnly: true };

/** مجموعة مقاسات بنفس السعر: المقاس الممثل (source) وبقية الأعضاء يأخذون سعره */
export interface SizeGroup { source: string; members: string[] }

export function sizeGroupsOf(sizeAliases: Record<string, string>): SizeGroup[] {
  const bySource = new Map<string, string[]>();
  Object.entries(sizeAliases).forEach(([size, source]) => bySource.set(source, [...(bySource.get(source) || []), size]));
  return [...bySource].map(([source, members]) => ({ source, members: members.sort((a, b) => a.localeCompare(b)) }));
}

export function linkSizeGroup(sizeAliases: Record<string, string>, source: string, sizes: string[]): Record<string, string> {
  const next = { ...sizeAliases };
  sizes.filter(size => size !== source).forEach(size => { next[size] = source; });
  return next;
}

export function unlinkSizeGroup(sizeAliases: Record<string, string>, source: string): Record<string, string> {
  return Object.fromEntries(Object.entries(sizeAliases).filter(([, value]) => value !== source));
}

export function applyPricingRules<T extends { size: string; billboard_level: string; customer_category: string; [key: string]: any }>(rows: T[], rules: PricingRules, columns: string[]): T[] {
  if (!rules.enabled) return rows;
  return rows.map(row => {
    const sourceSize = rules.sizeAliases[row.size] || row.size;
    const rate = row.billboard_level === rules.baseLevel ? 0 : rules.rates[row.billboard_level];
    const sourceLevel = rate === undefined ? row.billboard_level : rules.baseLevel;
    const source = rows.find(item => item.size === sourceSize && item.billboard_level === sourceLevel && item.customer_category === row.customer_category);
    if (!source) return row;
    const result = { ...row, duration_prices: { ...row.duration_prices } };
    for (const column of columns) {
      const price = readDurationPrice(source, column);
      const value = price == null ? null : Math.round(price * (1 + (rate ?? 0) / 100));
      if (isCustomDuration(column)) result.duration_prices[column] = value;
      else (result as Record<string, any>)[column] = value;
    }
    return result;
  });
}
