import { expect, it } from 'vitest';
import { printablePricing } from '@/utils/printablePricing';

it('excludes zero-only sizes and periods while retaining partially priced rows', () => {
  const prices = { large: { month: 100, half: 0, year: 900 }, small: { month: 0, half: 0, year: 0 }, medium: { year: 400 } };
  const result = printablePricing(['large', 'small', 'medium'], ['month', 'half', 'year'], (size, period) => prices[size]?.[period] ?? null);
  expect(result.rows).toEqual(['large', 'medium']);
  expect(result.columns).toEqual(['month', 'year']);
});

it('returns no rows or columns for a category without positive prices', () => {
  expect(printablePricing(['large'], ['month'], () => 0)).toEqual({ rows: [], columns: [] });
  expect(printablePricing(['large'], ['custom'], () => null)).toEqual({ rows: [], columns: [] });
});
