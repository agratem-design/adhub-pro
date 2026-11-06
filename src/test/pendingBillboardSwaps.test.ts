import { describe, expect, it } from 'vitest';
import { upsertPendingSwap, validatePendingSwaps, type PendingBillboardSwap } from '@/lib/pendingBillboardSwaps';

const swap = (o: string, r: string): PendingBillboardSwap => ({
  originalBillboardId: o, originalBillboardName: `B${o}`,
  replacementBillboardId: r, replacementBillboardName: `B${r}`,
  reason: 'تمت إزالة اللوحة', requestId: `req-${o}-${r}`,
});

describe('pending billboard swaps (applied only on contract save)', () => {
  it('keeps one pending swap per original board', () => {
    const list = upsertPendingSwap(upsertPendingSwap([], swap('1', '9')), swap('1', '8'));
    expect(list).toHaveLength(1);
    expect(list[0].replacementBillboardId).toBe('8');
  });

  it('accepts valid swaps', () => {
    expect(validatePendingSwaps([swap('1', '9'), swap('2', '8')], ['1', '2', '3'])).toBeNull();
    expect(validatePendingSwaps([], [])).toBeNull();
  });

  it('rejects a swap whose original board was removed from the contract', () => {
    expect(validatePendingSwaps([swap('1', '9')], ['2'])).toContain('لم تعد في العقد');
  });

  it('rejects a replacement that is already in the contract', () => {
    expect(validatePendingSwaps([swap('1', '2')], ['1', '2'])).toContain('مضافة للعقد');
  });

  it('rejects the same replacement for two boards', () => {
    expect(validatePendingSwaps([swap('1', '9'), swap('2', '9')], ['1', '2'])).toContain('أكثر من لوحة');
  });
});
