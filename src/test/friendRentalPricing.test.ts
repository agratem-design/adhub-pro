import { describe, it, expect } from 'vitest';
import { quoteFriendRental } from '@/utils/friendRentalPricing';
import { allocateMoney } from '@/utils/contractEditMoney';

const board = { id: '1', size: '8x3', level: 'A', friendCompanyId: 'supplier' };
const row = { size: '3×8', billboard_level: 'A', customer_category: 'شركة صديقة', one_month: 100, '3_months': 250, one_day: 4 };
const period = { mode: 'months', months: 3, days: 90, exchangeRate: 1 };
describe('supplier rental catalog', () => {
  it('uses the selected supplier category and exact period, independently of selling prices', () => {
    expect(quoteFriendRental([{ ...row, customer_category: 'عادي', '3_months': 900 }, row], board, 'شركة صديقة', period)?.cost).toBe(250);
  });
  it('does not substitute another category or level or an ambiguous row', () => {
    expect(quoteFriendRental([row], board, 'غير موجودة', period)).toBeNull();
    expect(quoteFriendRental([row], { ...board, level: 'B' }, 'شركة صديقة', period)).toBeNull();
    expect(quoteFriendRental([row, row], board, 'شركة صديقة', period)).toBeNull();
  });
  it('accepts a real zero price', () => {
    expect(quoteFriendRental([{ ...row, '3_months': 0 }], board, 'شركة صديقة', period)?.cost).toBe(0);
  });
  it('calculates nonstandard months with an explicit monthly basis', () => {
    const result = quoteFriendRental([row], board, 'شركة صديقة', { ...period, months: 4 });
    expect(result?.cost).toBe(400);
    expect(result?.snapshot.source).toBe('سعر الشهر × 4');
  });
  it('uses custom inclusive dates and converts once', () => {
    expect(quoteFriendRental([row], { ...board, startDate: '2026-01-01', endDate: '2026-01-10' }, 'شركة صديقة', { ...period, exchangeRate: 2 })?.cost).toBe(80);
  });
  it('uses the monthly / 30 fallback only when daily price is absent', () => {
    const result = quoteFriendRental([{ ...row, one_day: null }], board, 'شركة صديقة', { ...period, mode: 'days', days: 10 });
    expect(result?.cost).toBe(33.33);
    expect(result?.snapshot.source).toContain('÷ 30');
  });
  it('rejects invalid dates, durations and exchange rates', () => {
    expect(quoteFriendRental([row], { ...board, startDate: '2026-02-05', endDate: '2026-01-01' }, 'شركة صديقة', period)).toBeNull();
    expect(quoteFriendRental([row], board, 'شركة صديقة', { ...period, months: 0 })).toBeNull();
    expect(quoteFriendRental([row], board, 'شركة صديقة', { ...period, exchangeRate: 0 })).toBeNull();
  });
  it('preserves the agreed company total down to cents, including zero', () => {
    expect(allocateMoney(100, [1, 1, 1])).toEqual([33.34, 33.33, 33.33]);
    expect(allocateMoney(0, [100, 200])).toEqual([0, 0]);
  });
});
