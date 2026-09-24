import { describe, it, expect } from 'vitest';
import {
  durationPrice,
  durationEnd,
  durationName,
  readDurationPrice,
  getContractDurationName,
  getDurationDays,
  replaceDurationVariable,
  type PricingDuration
} from '@/utils/pricingDuration';

const durations: PricingDuration[] = [
  { id: 'one', name: 'شهر واحد', label: 'شهرياً', months: 1, days: 30, db_column: 'one_month', sort_order: 1, is_active: true },
  { id: 'half', name: 'شهر ونصف', label: 'شهر ونصف', months: 1.5, days: 45, db_column: 'duration_half', sort_order: 2, is_active: true },
  { id: 'two', name: 'سنتان', label: 'سنتان', months: 24, days: 730, db_column: 'duration_two', sort_order: 3, is_active: true },
];

describe('named rental durations', () => {
  it('reads the exact configured tariff, including zero, without a monthly multiplier', () => {
    const row = { one_month: 100, duration_prices: { duration_half: 135, duration_two: 0 } };
    expect(durationPrice(row, 1.5, durations)).toBe(135);
    expect(durationPrice(row, 24, durations)).toBe(0);
    expect(durationPrice(row, 1, durations)).toBe(100);
    expect(durationPrice(row, 4, durations)).toBeNull();
    expect(readDurationPrice(row, 'duration_missing')).toBeNull();
  });

  it('keeps prices distinct across level/category rows', () => {
    expect(durationPrice({ duration_prices: { duration_half: 200 } }, 1.5, durations)).toBe(200);
    expect(durationPrice({ duration_prices: { duration_half: 320 } }, 1.5, durations)).toBe(320);
  });

  it('uses configured days for fractional and multi-year durations', () => {
    expect(durationEnd('2026-01-01', 1.5, true, durations).toISOString().slice(0, 10)).toBe('2026-02-15');
    expect(durationEnd('2026-01-01', 24, false, durations).toISOString().slice(0, 10)).toBe('2028-01-01');
    expect(durationName(1.5, durations)).toBe('شهر ونصف');
  });

  it('retains existing calendar and 30-day modes', () => {
    expect(durationEnd('2026-01-01', 1, true, durations).toISOString().slice(0, 10)).toBe('2026-01-31');
    expect(durationEnd('2026-01-01', 1, false, durations).toISOString().slice(0, 10)).toBe('2026-02-01');
  });

  it('retains lookup for archived durations in existing contracts', () => {
    const archived = durations.map(d => ({ ...d, is_active: false }));
    expect(durationName(24, archived)).toBe('سنتان');
    expect(durationPrice({ duration_prices: { duration_two: 900 } }, 24, archived)).toBe(900);
  });
});

describe('contract duration naming and placeholder replacement', () => {
  it('resolves official duration name from duration_months = 1.5 (Contract 1308)', () => {
    const contract = {
      Contract_Number: 1308,
      duration_months: 1.5,
      Duration: '45 يوم',
      start_date: '2026-09-22',
      end_date: '2026-11-06'
    };
    expect(getContractDurationName(contract, durations)).toBe('شهر ونصف');
  });

  it('resolves official duration name when Duration text contains days matching a duration', () => {
    const contract = {
      Contract_Number: 100,
      Duration: '45 يوم',
    };
    expect(getContractDurationName(contract, durations)).toBe('شهر ونصف');
  });

  it('resolves official duration name from date span of 45 days', () => {
    const contract = {
      'Contract Date': '2026-01-01',
      'End Date': '2026-02-15',
    };
    expect(getContractDurationName(contract, durations)).toBe('شهر ونصف');
  });

  it('replaces {duration} with named duration without parentheses and days count in parentheses', () => {
    const term = 'تبلغ مدة هذا العقد ({duration}) يوماً، تبدأ من 01/01/2026 وتنتهي في 15/02/2026';
    const result = replaceDurationVariable(term, 'شهر ونصف', 45);
    expect(result).toBe('تبلغ مدة هذا العقد شهر ونصف (45) يوماً، تبدأ من 01/01/2026 وتنتهي في 15/02/2026');
  });

  it('auto-resolves days from standard mapping when days not explicitly passed', () => {
    const term = 'تبلغ مدة هذا العقد ({duration}) يوماً، تبدأ من 01/01/2026 وتنتهي في 15/02/2026';
    const result = replaceDurationVariable(term, 'شهر ونصف');
    expect(result).toBe('تبلغ مدة هذا العقد شهر ونصف (45) يوماً، تبدأ من 01/01/2026 وتنتهي في 15/02/2026');
  });

  it('replaces {duration} without parenthesis in template cleanly', () => {
    const term = 'تبلغ مدة هذا العقد {duration} يوماً تبدأ من التاريخ المذكور';
    const result = replaceDurationVariable(term, 'شهر ونصف');
    expect(result).toBe('تبلغ مدة هذا العقد شهر ونصف (45) يوماً تبدأ من التاريخ المذكور');
  });

  it('formats سنة كاملة with 365 days cleanly', () => {
    const term = 'تبلغ مدة هذا العقد ({duration}) يوماً، تبدأ من 01/01/2026';
    const result = replaceDurationVariable(term, 'سنة كاملة');
    expect(result).toBe('تبلغ مدة هذا العقد سنة كاملة (365) يوماً، تبدأ من 01/01/2026');
  });

  it('formats template without trailing days word cleanly', () => {
    const term = 'تبلغ مدة هذا العقد ({duration}) تبدأ من 01/01/2026';
    const result = replaceDurationVariable(term, 'شهر ونصف');
    expect(result).toBe('تبلغ مدة هذا العقد شهر ونصف (45 يوماً) تبدأ من 01/01/2026');
  });

  it('preserves days word when duration is a pure number', () => {
    const term = 'تبلغ مدة هذا العقد ({duration}) يوماً، تبدأ من 01/01/2026';
    const result = replaceDurationVariable(term, '17');
    expect(result).toBe('تبلغ مدة هذا العقد (17) يوماً، تبدأ من 01/01/2026');
  });

  it('getDurationDays resolves correctly from various formats', () => {
    expect(getDurationDays('شهر ونصف')).toBe(45);
    expect(getDurationDays('سنة كاملة')).toBe(365);
    expect(getDurationDays('6 أشهر')).toBe(180);
    expect(getDurationDays('شهر ونصف (45)')).toBe(45);
    expect(getDurationDays('20 يوم')).toBe(20);
    expect(getDurationDays('custom', undefined, 42)).toBe(42);
  });
});
