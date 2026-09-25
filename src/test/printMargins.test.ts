import { describe, it, expect } from 'vitest';
import { parseDimensionsString, calculatePrintMargins, resolveDisplayDimensions } from '@/utils/printMargins';

describe('printMargins calculation', () => {
  it('parses dimension strings in various standard Arabic and Latin formats', () => {
    expect(parseDimensionsString('12.20 × 4.20')).toEqual({ width: 12.2, height: 4.2 });
    expect(parseDimensionsString('12.20x4.20')).toEqual({ width: 12.2, height: 4.2 });
    expect(parseDimensionsString('12.20 X 4.20')).toEqual({ width: 12.2, height: 4.2 });
    expect(parseDimensionsString('1.10 * 2.10')).toEqual({ width: 1.1, height: 2.1 });
    expect(parseDimensionsString('12 4')).toEqual({ width: 12, height: 4 });
    expect(parseDimensionsString('invalid')).toBeNull();
    expect(parseDimensionsString('')).toBeNull();
    expect(parseDimensionsString(null)).toBeNull();
  });

  it('resolves display dimensions for standard billboard names including سوسيت', () => {
    expect(resolveDisplayDimensions('12x4')).toEqual({ width: 12, height: 4 });
    expect(resolveDisplayDimensions('سوسيت')).toEqual({ width: 1, height: 2 });
    expect(resolveDisplayDimensions('لوحة سوسيت وسط المدينة')).toEqual({ width: 1, height: 2 });
    expect(resolveDisplayDimensions('custom', 6, 3)).toEqual({ width: 6, height: 3 });
  });

  it('calculates exact margins in centimeters and per side correctly (12x4 with 12.20x4.20)', () => {
    const res = calculatePrintMargins('12.20 × 4.20', '12x4', 12, 4);
    expect(res.hasValidPrintSize).toBe(true);
    expect(res.printWidth).toBe(12.2);
    expect(res.printHeight).toBe(4.2);
    expect(res.marginWidthMeters).toBe(0.2);
    expect(res.marginHeightMeters).toBe(0.2);
    expect(res.marginWidthCm).toBe(20);
    expect(res.marginHeightCm).toBe(20);
    expect(res.marginPerSideWidthCm).toBe(10);
    expect(res.marginPerSideHeightCm).toBe(10);
    expect(res.isPositiveMargin).toBe(true);
    expect(res.summaryText).toContain('العرض: +20 سم (+10 سم لكل جانب)');
    expect(res.summaryText).toContain('الارتفاع: +20 سم (+10 سم لكل جانب)');
  });

  it('calculates exact margins for سوسيت with 1.10x2.10', () => {
    const res = calculatePrintMargins('1.10 × 2.10', 'سوسيت');
    expect(res.hasValidPrintSize).toBe(true);
    expect(res.billboardWidth).toBe(1);
    expect(res.billboardHeight).toBe(2);
    expect(res.marginWidthCm).toBe(10);
    expect(res.marginHeightCm).toBe(10);
    expect(res.marginPerSideWidthCm).toBe(5);
    expect(res.marginPerSideHeightCm).toBe(5);
  });

  it('handles exact match without margins', () => {
    const res = calculatePrintMargins('12.00 × 4.00', '12x4', 12, 4);
    expect(res.hasValidPrintSize).toBe(true);
    expect(res.marginWidthCm).toBe(0);
    expect(res.marginHeightCm).toBe(0);
    expect(res.shortSummary).toContain('بدون هوامش');
  });

  it('handles missing print size gracefully', () => {
    const res = calculatePrintMargins('', '12x4', 12, 4);
    expect(res.hasValidPrintSize).toBe(false);
    expect(res.shortSummary).toBe('مقاس الطباعة غير محدد');
  });
});
