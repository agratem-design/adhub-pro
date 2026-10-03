import { describe, expect, it } from 'vitest';
import { historicalPauseContribution, purePauseContribution, isRetainedPause } from '@/utils/pausedReplacementAccounting';

describe('historical replacement budget accounting', () => {
  const legacy = { deducted_from_contract: false, refund_amount: 0, price_snapshot: null };
  it('preserves contract 1158 through both generations of replacements', () => {
    const nodes = [
      { full: 6000, allocated: 2450, consumed: 3300 },
      { full: 2450, allocated: 1100, consumed: 1982 },
      { full: 6000, allocated: 2450, consumed: 3350 },
      { full: 2450, allocated: 2450, consumed: 2450 },
      { full: 6000, allocated: 2400, consumed: 3600 },
    ];
    const history = nodes.reduce((sum, node) => sum + historicalPauseContribution({ ...legacy, consumed_amount: node.consumed }, node.full, 0, node.allocated), 0);
    expect(history).toBe(12050);
    expect(history + 1100 + 2450 + 2400).toBe(18000);
    expect(202000 + history + 1100 + 2450 + 2400).toBe(220000);
    expect(nodes.reduce((sum, node) => sum + node.consumed, 0) - history).toBe(2632);
  });
  it('keeps the explicit consumed amount for new snapshot-based replacements', () => {
    expect(historicalPauseContribution({ ...legacy, price_snapshot: {}, consumed_amount: 3500 }, 6000, 2500, 1100)).toBe(3500);
  });
  it('preserves legacy pauses that actually deducted a refund', () => {
    expect(historicalPauseContribution({ deducted_from_contract: true, refund_amount: 2500, consumed_amount: 3500 }, 6000, 2500, 1100)).toBe(3500);
  });
  it('handles an explicit zero allocation and pure pauses', () => {
    expect(historicalPauseContribution(legacy, 6000, 0, 0)).toBe(6000);
    expect(historicalPauseContribution(legacy, 18000, 12000)).toBe(6000);
  });
  it('excludes pure pauses with zero refund, including old stored consumed amounts', () => {
    expect(historicalPauseContribution({ consumed_amount: 6000 }, 6000, 0)).toBe(0);
    expect(purePauseContribution(6500, 0)).toBe(0);
    expect(purePauseContribution(6500, 2500)).toBe(4000);
  });
  it('excludes deleted pauses while retaining legacy and resumed history', () => {
    expect([{ lifecycle_state: 'cancelled' }, { lifecycle_state: 'paused' }, { lifecycle_state: 'resumed' }, {}].filter(isRetainedPause)).toHaveLength(3);
  });
});
