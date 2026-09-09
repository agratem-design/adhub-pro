import { money } from './contractEditMoney';

export interface FriendRentalSnapshot {
  category: string;
  source: string;
  catalogAmount: number;
  exchangeRate: number;
}

export interface FriendRentalBoard {
  id: string;
  size: string;
  sizeId?: number;
  level?: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  friendCompanyId: string;
  friendCompanyName?: string;
}

export interface FriendPricingRow {
  size?: string | null;
  size_id?: number | null;
  billboard_level?: string | null;
  customer_category?: string | null;
  one_month?: number | null;
  '2_months'?: number | null;
  '3_months'?: number | null;
  '6_months'?: number | null;
  full_year?: number | null;
  one_day?: number | null;
}

export interface FriendPricingPeriod {
  mode: string;
  months: number;
  days: number;
  exchangeRate: number;
}

const normalize = (value: string) => value.trim().toUpperCase();
const sizeKey = (value: string) => value.toLowerCase().replace(/[×*]/g, 'x').replace(/\s/g, '').split('x').sort().join('x');
const amount = (value: unknown): number | null => value == null || value === '' || !Number.isFinite(Number(value)) || Number(value) < 0 ? null : Number(value);

/** Match the chosen supplier category exactly; never substitute the customer's selling price. */
export function quoteFriendRental(rows: FriendPricingRow[], board: FriendRentalBoard, category: string, period: FriendPricingPeriod): { cost: number; snapshot: FriendRentalSnapshot } | null {
  if (!category || !Number.isFinite(period.exchangeRate) || period.exchangeRate <= 0) return null;
  const candidates = rows.filter(row => normalize(row.customer_category || '') === normalize(category)
    && normalize(row.billboard_level || '') === normalize(board.level || ''));
  const matches = candidates.filter(row => board.sizeId && Number(row.size_id) === board.sizeId);
  const matchingRows = matches.length ? matches : candidates.filter(row => !!board.size && sizeKey(row.size || '') === sizeKey(board.size));
  if (matchingRows.length !== 1) return null;
  const row = matchingRows[0];
  let days = period.days;
  const customDates = !!(board.startDate || board.endDate);
  if (customDates) {
    const start = Date.parse(`${board.startDate}T00:00:00Z`);
    const end = Date.parse(`${board.endDate}T00:00:00Z`);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
    days = (end - start) / 86400000 + 1;
  }
  let catalogAmount: number | null = null;
  let source = '';
  if (period.mode === 'months' && !customDates) {
    if (!Number.isFinite(period.months) || period.months <= 0) return null;
    const columns: Record<number, keyof FriendPricingRow> = { 1: 'one_month', 2: '2_months', 3: '3_months', 6: '6_months', 12: 'full_year' };
    const exact = columns[period.months];
    catalogAmount = exact ? amount(row[exact]) : null;
    source = `سعر ${period.months} شهر من الجدول`;
    if (catalogAmount === null) {
      const monthly = amount(row.one_month);
      if (monthly !== null) catalogAmount = monthly * period.months;
      source = `سعر الشهر × ${period.months}`;
    }
  } else {
    if (!Number.isFinite(days) || days <= 0) return null;
    const daily = amount(row.one_day);
    const monthly = amount(row.one_month);
    if (daily !== null) { catalogAmount = daily * days; source = `سعر اليوم × ${days}`; }
    else if (monthly !== null) { catalogAmount = monthly / 30 * days; source = `سعر الشهر ÷ 30 × ${days} يوم`; }
  }
  if (catalogAmount === null || !Number.isFinite(catalogAmount)) return null;
  return { cost: money(catalogAmount * period.exchangeRate), snapshot: { category, source, catalogAmount: money(catalogAmount), exchangeRate: period.exchangeRate } };
}
