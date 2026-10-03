import { describe, expect, it, vi } from 'vitest';
import browserCanvas from '@/lib/browserCanvas';
import { toCanvas } from 'html-to-image';
vi.mock('html-to-image', () => ({ toCanvas: vi.fn(async () => document.createElement('canvas')) }));

describe('browser Canvas 2D export', () => {
  it('preserves document dimensions and limits bitmap size', async () => {
    const node = document.createElement('div');
    await browserCanvas(node, { width: 794, height: 1123, scale: 3 });
    expect(toCanvas).toHaveBeenLastCalledWith(node, expect.objectContaining({ width: 794, height: 1123, pixelRatio: 3 }));
    await browserCanvas(node, { width: 794, height: 20000, scale: 13 });
    const calls = vi.mocked(toCanvas).mock.calls;
    const options = calls[calls.length - 1][1]!;
    expect(Number(options.pixelRatio) * 20000).toBeLessThanOrEqual(16384);
  });
  it('rejects empty documents rather than exporting blank pages', async () => {
    await expect(browserCanvas(document.createElement('div'))).rejects.toThrow('لا توجد مساحة');
  });
});
