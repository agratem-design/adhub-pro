import { describe, expect, it } from 'vitest';
import { normalizePrintLevels, resolvePrintLevels } from '@/utils/pricingPrintLevels';

describe('price print level selection', () => {
  it('preserves legacy single-level and all-level preferences', () => {
    expect(normalizePrintLevels('B')).toEqual(['B']);
    expect(normalizePrintLevels('all')).toBe('all');
  });
  it('includes only chosen levels in catalog order, omitting stale codes', () => {
    expect(resolvePrintLevels(['B', 'S', 'removed'], ['S', 'A', 'B', 'C'])).toEqual(['S', 'B']);
  });
  it('preserves an empty selection instead of printing everything', () => {
    expect(resolvePrintLevels(normalizePrintLevels([]), ['A', 'B'])).toEqual([]);
  });
  it('deduplicates saved selections and resolves all against current levels', () => {
    expect(normalizePrintLevels(['A', 'A', null, 4])).toEqual(['A']);
    expect(resolvePrintLevels('all', ['S', 'A', 'B'])).toEqual(['S', 'A', 'B']);
  });
});
