import { describe, expect, it } from 'vitest';
import { buildDesignAssignmentPlan } from '@/lib/designAssignmentPlan';

describe('balanced design assignment', () => {
  const items = Array.from({ length: 10 }, (_, i) => `item-${i}`);
  it('balances uneven counts without leaving boards or designs out', () => {
    const plan = buildDesignAssignmentPlan(items, ['a', 'b', 'c'], true);
    expect(['a', 'b', 'c'].map(id => plan.filter(p => p.designId === id).length)).toEqual([4, 3, 3]);
    expect(plan.map(p => p.itemId)).toEqual(items);
  });
  it('uses every design when the count is divisible', () => {
    const plan = buildDesignAssignmentPlan(items.slice(0, 6), ['a', 'b', 'c'], true);
    expect(['a', 'b', 'c'].map(id => plan.filter(p => p.designId === id).length)).toEqual([2, 2, 2]);
  });
  it('assigns fewer boards than designs safely', () => {
    expect(buildDesignAssignmentPlan(['one', 'two'], ['a', 'b', 'c'], true)).toEqual([{ itemId: 'one', designId: 'a' }, { itemId: 'two', designId: 'b' }]);
  });
  it('applies a single chosen design in non-distribution modes', () => {
    expect(buildDesignAssignmentPlan(items, ['b', 'a'], false).every(p => p.designId === 'b')).toBe(true);
  });
  it('does not produce assignments without designs or boards', () => {
    expect(buildDesignAssignmentPlan(items, [], true)).toEqual([]);
    expect(buildDesignAssignmentPlan([], ['a'], true)).toEqual([]);
  });
  it('respects manually chosen quantities', () => {
    const plan = buildDesignAssignmentPlan(items, ['a', 'b', 'c'], true, { a: 7, b: 1, c: 2 });
    expect(['a', 'b', 'c'].map(id => plan.filter(p => p.designId === id).length)).toEqual([7, 1, 2]);
    expect(plan.map(p => p.itemId)).toEqual(items);
  });
  it('rejects incomplete, fractional, negative or mismatched quantities', () => {
    for (const quantities of [{ a: 4, b: 4 }, { a: 4.5, b: 5.5 }, { a: -1, b: 11 }, { a: 10 }]) {
      expect(() => buildDesignAssignmentPlan(items, ['a', 'b'], true, quantities)).toThrow();
    }
  });
});
