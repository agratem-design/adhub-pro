import { describe, expect, it } from 'vitest';
import { reorderMunicipalityItems } from '../utils/municipalityOrdering';

const items = Array.from({ length: 6 }, (_, index) => ({ sequence_number: index + 1, name: `board-${index + 1}`, size: '8x3x4' }));

describe('municipality numbering', () => {
  it('moves one board and shifts occupied positions without duplicates', () => {
    const result = reorderMunicipalityItems(items, [5], 2, 1);
    expect(result.map(item => item.name)).toEqual(['board-1', 'board-5', 'board-2', 'board-3', 'board-4', 'board-6']);
    expect(result.map(item => item.sequence_number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(items[4].sequence_number).toBe(5);
  });
  it('assigns descending clicks while retaining unclicked boards in order', () => {
    const result = reorderMunicipalityItems(items, [2, 6, 1], 5, -1);
    expect(result.map(item => item.name)).toEqual(['board-3', 'board-4', 'board-1', 'board-6', 'board-2', 'board-5']);
    expect(result.every(item => item.size === '8x3x4')).toBe(true);
  });
  it('rejects invalid ranges, duplicate clicks and comparison boards', () => {
    for (const [clicks, start, direction] of [
      [[1, 2], 6, 1], [[1, 2], 1, -1], [[1], 1.5, 1], [[1, 1], 1, 1], [[1000001], 1, 1],
    ] as [number[], number, 1 | -1][]) {
      expect(() => reorderMunicipalityItems(items, clicks, start, direction)).toThrow();
    }
  });
  it('preserves every board exactly once across all valid start positions and directions', () => {
    for (const direction of [1, -1] as const) {
      for (let start = 1; start <= items.length; start++) {
        const clicks = [6, 1, 4].slice(0, direction === 1 ? items.length - start + 1 : start);
        const result = reorderMunicipalityItems(items, clicks, start, direction);
        expect(result.map(item => item.sequence_number)).toEqual([1, 2, 3, 4, 5, 6]);
        expect(new Set(result.map(item => item.name)).size).toBe(items.length);
        clicks.forEach((seq, index) => expect(result[start + index * direction - 1].name).toBe(`board-${seq}`));
      }
    }
  });
  it('undo recomputes from the original order', () => {
    expect(reorderMunicipalityItems(items, [], 1, 1)).toEqual(items);
    expect(reorderMunicipalityItems(items, [4, 2].slice(0, -1), 1, 1)[0].name).toBe('board-4');
  });
});
