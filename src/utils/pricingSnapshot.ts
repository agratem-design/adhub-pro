import type { PricingDuration } from '@/utils/pricingDuration';
import { readDurationPrice } from '@/utils/pricingDuration';

/** نسخة من قائمة الأسعار وقت حفظ العقد/العرض لمعرفة السعر المعتمد آنذاك */
export interface PricingSnapshot {
  version: 1;
  captured_at: string;
  customer_category: string;
  rows: any[];
  durations: Array<Pick<PricingDuration, 'name' | 'months' | 'days' | 'db_column' | 'sort_order'>>;
}

const norm = (v: unknown) => String(v ?? '').trim().toUpperCase();

const KEEP = ['id', 'size_id', 'size', 'billboard_level', 'customer_category', 'one_day', 'one_month', '2_months', '3_months', '6_months', 'full_year', 'duration_prices'];

/** يحفظ صفوف الفئة المختارة + صفوف «عادي» (لأن البحث يرجع إليها عند غياب سعر الفئة) */
export function buildPricingSnapshot(pricingRows: any[], category: string, durations: PricingDuration[] = []): PricingSnapshot | null {
  if (!Array.isArray(pricingRows) || pricingRows.length === 0) return null;
  const cats = new Set([norm(category || 'عادي'), norm('عادي')]);
  const rows = pricingRows
    .filter(r => cats.has(norm(r.customer_category)))
    .map(r => Object.fromEntries(KEEP.filter(k => k in r).map(k => [k, r[k]])));
  if (rows.length === 0) return null;
  return {
    version: 1,
    captured_at: new Date().toISOString(),
    customer_category: category || 'عادي',
    rows,
    durations: (durations || []).filter(d => d.is_active !== false).map(d => ({ name: d.name, months: d.months, days: d.days, db_column: d.db_column, sort_order: d.sort_order })),
  };
}

export function parsePricingSnapshot(raw: unknown): PricingSnapshot | null {
  if (!raw) return null;
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return v && Array.isArray((v as any).rows) ? (v as PricingSnapshot) : null;
  } catch {
    return null;
  }
}

/** هل يجب التقاط نسخة جديدة؟ عند عدم وجود نسخة، أو تغيّر الفئة، أو إعادة التسعير من الجدول الحالي */
export function shouldRefreshSnapshot(existing: PricingSnapshot | null, category: string, usingStoredPrices: boolean): boolean {
  if (!existing) return true;
  if (norm(existing.customer_category) !== norm(category)) return true;
  return !usingStoredPrices;
}

export const snapshotColumns = (snap: PricingSnapshot) => {
  const base = [
    { key: 'one_day', label: 'يوم' },
    { key: 'one_month', label: 'شهر' },
    { key: '2_months', label: 'شهرين' },
    { key: '3_months', label: '3 أشهر' },
    { key: '6_months', label: '6 أشهر' },
    { key: 'full_year', label: 'سنة' },
  ];
  const custom = (snap.durations || [])
    .filter(d => !base.some(b => b.key === d.db_column))
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
    .map(d => ({ key: d.db_column, label: d.name }));
  const all = [...base, ...custom];
  return all.filter(c => snap.rows.some(r => readDurationPrice(r, c.key) != null));
};

export const findCurrentRow = (current: any[], row: any) =>
  current.find(c =>
    norm(c.customer_category) === norm(row.customer_category) &&
    norm(c.billboard_level) === norm(row.billboard_level) &&
    (row.size_id != null && c.size_id != null ? Number(c.size_id) === Number(row.size_id) : norm(c.size) === norm(row.size)),
  );
