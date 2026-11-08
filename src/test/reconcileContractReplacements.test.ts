import { describe, expect, it } from 'vitest';
import { reconcileContractReplacements } from '@/services/pausedBillboardsService';

describe('reconcileContractReplacements (Chained Swap & Duplicate Replacement Prevention)', () => {
  const pauseA = 'pause-A-uuid';

  it('replaces intermediate replacement B with C when chained swap occurs (A -> B -> C)', () => {
    // Original pause of board 100 created replacement 200 (B = SJ1233)
    const result = reconcileContractReplacements({
      originalIds: ['200', '300'], // 200 was previous replacement, 300 is another board
      originalPrices: [
        { billboardId: '200', _replacement_of: pauseA, finalPrice: 5000 },
        { billboardId: '300', finalPrice: 4000 },
      ],
      pausedRows: [{ id: pauseA, billboard_id: '100', lifecycle_state: 'paused' }],
      replRows: [
        {
          id: 'repl-row-1',
          paused_billboard_id: pauseA,
          replacement_billboard_id: '200',
          allocated_amount: 5000,
        },
      ],
      swapLogs: [
        {
          created_at: '2026-11-08T10:00:00Z',
          details: {
            original_billboard_id: '200',
            replacement_billboard_id: '250',
            replacement_billboard_name: 'C-Billboard',
          },
        },
      ],
    });

    // Board 200 (B) must be removed and replaced by 250 (C)
    expect(result.ids).not.toContain('200');
    expect(result.ids).toContain('250');
    expect(result.ids).toContain('300');
    expect(result.staleReplacementBillboardIds).toContain('200');

    // Prices must only contain 250 for pauseA
    const pausePrices = result.prices.filter((p) => p._replacement_of === pauseA);
    expect(pausePrices).toHaveLength(1);
    expect(pausePrices[0].billboardId).toBe('250');

    // Replacement updates must notify to update pointer in paused_billboard_replacements
    expect(result.replacementUpdates).toHaveLength(1);
    expect(result.replacementUpdates[0]).toMatchObject({
      paused_billboard_id: pauseA,
      oldBillboardId: '200',
      newBillboardId: '250',
    });
  });

  it('resolves duplicate replacement boards stuck on the same contract (Regression #1303)', () => {
    // Both 200 (SJ1233) and 250 (new replacement) were somehow both in IDs and prices
    const result = reconcileContractReplacements({
      originalIds: ['200', '250', '300'],
      originalPrices: [
        { billboardId: '200', _replacement_of: pauseA, finalPrice: 5000 },
        { billboardId: '250', _replacement_of: pauseA, finalPrice: 5000, consumedCarryover: 1000 },
        { billboardId: '300', finalPrice: 4000 },
      ],
      pausedRows: [{ id: pauseA, billboard_id: '100', lifecycle_state: 'paused' }],
      replRows: [
        {
          id: 'repl-row-1',
          paused_billboard_id: pauseA,
          replacement_billboard_id: '200', // Still pointing to old board 200
          allocated_amount: 5000,
        },
      ],
    });

    // 200 must be marked stale, keeping only 250
    expect(result.ids).not.toContain('200');
    expect(result.ids).toContain('250');
    expect(result.ids).toContain('300');
    expect(result.ids).toHaveLength(2);

    expect(result.staleReplacementBillboardIds).toContain('200');
    expect(result.replacementUpdates[0].newBillboardId).toBe('250');
  });

  it('never re-adds a billboard that is currently paused', () => {
    const pauseB = 'pause-B-uuid';
    const result = reconcileContractReplacements({
      originalIds: ['100', '200', '300'],
      originalPrices: [
        { billboardId: '100', finalPrice: 5000 },
        { billboardId: '200', finalPrice: 5000 },
        { billboardId: '300', finalPrice: 5000 },
      ],
      pausedRows: [
        { id: pauseA, billboard_id: '100', lifecycle_state: 'paused' },
        { id: pauseB, billboard_id: '200', lifecycle_state: 'paused' },
      ],
      replRows: [],
    });

    expect(result.ids).toEqual(['300']);
  });
});
