import { describe, it, expect } from 'vitest';
import { getBillboardDimensions } from '../lib/billboardDimensions';

describe('getBillboardDimensions', () => {
  it('handles textual size سوسيت with default 1x2m (2m² area)', () => {
    const dims = getBillboardDimensions('سوسيت');
    expect(dims.width).toBe(1);
    expect(dims.height).toBe(2);
    expect(dims.area).toBe(2);
  });

  it('handles billboard object with Size: "سوسيت" and size_id: 34', () => {
    const bb = { ID: 1090, Size: 'سوسيت', size_id: 34, Faces_Count: 2 };
    const dims = getBillboardDimensions(bb);
    expect(dims.width).toBe(1);
    expect(dims.height).toBe(2);
    expect(dims.area).toBe(2);
  });

  it('handles variations like soussette or societ', () => {
    expect(getBillboardDimensions('soussette').area).toBe(2);
    expect(getBillboardDimensions('societ').area).toBe(2);
    expect(getBillboardDimensions('سوسيت مضاءة').area).toBe(2);
  });

  it('handles numeric dimensions correctly: 12x4, 2.5x4, 3X8-T', () => {
    const dims12 = getBillboardDimensions('12x4');
    expect(dims12.width).toBe(12);
    expect(dims12.height).toBe(4);
    expect(dims12.area).toBe(48);

    const dims25 = getBillboardDimensions('2.5x4');
    expect(dims25.width).toBe(2.5);
    expect(dims25.height).toBe(4);
    expect(dims25.area).toBe(10);

    const dimsSuffix = getBillboardDimensions('3X8-T');
    expect(dimsSuffix.width).toBe(3);
    expect(dimsSuffix.height).toBe(8);
    expect(dimsSuffix.area).toBe(24);
  });

  it('prioritizes sizeDimensionsMap when available', () => {
    const map = new Map<string | number, { width: number; height: number }>();
    map.set(34, { width: 1.2, height: 1.8 });
    const bb = { ID: 1090, Size: 'سوسيت', size_id: '34' };
    const dims = getBillboardDimensions(bb, map);
    expect(dims.width).toBe(1.2);
    expect(dims.height).toBe(1.8);
    expect(dims.area).toBeCloseTo(2.16);
  });

  it('prioritizes actual_width and actual_height on the billboard object', () => {
    const bb = { ID: 1, Size: 'سوسيت', actual_width: 1.5, actual_height: 2.2 };
    const dims = getBillboardDimensions(bb);
    expect(dims.width).toBe(1.5);
    expect(dims.height).toBe(2.2);
    expect(dims.area).toBeCloseTo(3.3);
  });
});
