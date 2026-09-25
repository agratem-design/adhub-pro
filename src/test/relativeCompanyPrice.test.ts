import { describe, expect, it } from 'vitest';
import { relativeCompanyPrice } from '@/utils/relativeCompanyPrice';
describe('company-relative prices', () => {
  it('calculates discount and increase from the benchmark, not the current price', () => {
    expect(relativeCompanyPrice(1000, 'discount', 20)).toBe(800);
    expect(relativeCompanyPrice(1000, 'increase', 20)).toBe(1200);
  });
  it('distinguishes 0 percent from zeroing a price', () => {
    expect(relativeCompanyPrice(1000, 'discount', 0)).toBe(1000);
    expect(relativeCompanyPrice(null, 'zero', 0)).toBe(0);
    expect(relativeCompanyPrice(1000, 'discount', 100)).toBe(0);
  });
  it('rejects missing benchmarks, invalid percentages and unsafe results', () => {
    expect(relativeCompanyPrice(null, 'increase', 20)).toBeNull();
    expect(relativeCompanyPrice(0, 'discount', 20)).toBeNull();
    expect(relativeCompanyPrice(1000, 'discount', 101)).toBeNull();
    expect(relativeCompanyPrice(1000, 'increase', -1)).toBeNull();
    expect(relativeCompanyPrice(1000, 'increase', Infinity)).toBeNull();
  });
});
