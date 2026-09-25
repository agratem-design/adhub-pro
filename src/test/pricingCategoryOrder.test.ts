import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRIMARY_CUSTOMERS,
  resolveOrderedCategories,
} from '@/utils/pricingCategoryOrder';

describe('pricingCategoryOrder', () => {
  it('defaults to companies as the first category when no custom order exists', () => {
    const rawCategories = ['عادي', 'مسوق', 'المدينة', 'شركات', 'جوتن'];
    const result = resolveOrderedCategories(rawCategories, []);

    expect(result[0]).toBe('شركات');
    expect(result[1]).toBe('عادي');
    expect(result[2]).toBe('مسوق');
    expect(result).toContain('المدينة');
    expect(result).toContain('جوتن');
  });

  it('respects a custom order when provided', () => {
    const rawCategories = ['شركات', 'عادي', 'مسوق', 'المدينة', 'جوتن'];
    const customOrder = ['المدينة', 'شركات', 'جوتن', 'عادي'];
    const result = resolveOrderedCategories(rawCategories, customOrder);

    expect(result[0]).toBe('المدينة');
    expect(result[1]).toBe('شركات');
    expect(result[2]).toBe('جوتن');
    expect(result[3]).toBe('عادي');
    // 'مسوق' was not in customOrder, so it appends at the end
    expect(result[4]).toBe('مسوق');
  });

  it('safely handles categories deleted or renamed', () => {
    const rawCategories = ['شركات', 'عادي'];
    const customOrder = ['فئة_محذوفة', 'شركات', 'عادي'];
    const result = resolveOrderedCategories(rawCategories, customOrder);

    expect(result).toEqual(['شركات', 'عادي']);
    expect(result).not.toContain('فئة_محذوفة');
  });

  it('ensures DEFAULT_PRIMARY_CUSTOMERS starts with companies', () => {
    expect(DEFAULT_PRIMARY_CUSTOMERS[0]).toBe('شركات');
  });
});
