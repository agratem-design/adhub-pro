import { describe, expect, it } from 'vitest';
import { collectStatementRows, contractPrintArea, printEnabled, taskPrintAmounts } from '@/lib/printerStatement';

describe('printer statement accounting', () => {
  it('includes rows after the first server page when calculating balances', async () => {
    const records = Array.from({ length: 1001 }, (_, id) => ({ id }));
    const result = await collectStatementRows(async (from, to) => ({ data: records.slice(from, to + 1), error: null }));
    expect(result.data).toHaveLength(1001);
    expect(result.data[1000].id).toBe(1000);
  });
  it('keeps supplier and customer prices separate and preserves a free supplier charge', () => {
    expect(taskPrintAmounts({ total_area: 24, printer_cost_per_meter: 0, printer_total_cost: 0,
      price_per_meter: 13, total_cost: 312, customer_total_amount: 480 })).toEqual({
      cost: 0, costPerMeter: 0, customerCost: 480, customerRate: 20,
    });
  });
  it('reads legacy supplier prices and derives customer prices from their own total', () => {
    expect(taskPrintAmounts({ total_area: 24, price_per_meter: 13, total_cost: 312, customer_total_amount: 480 }))
      .toEqual({ cost: 312, costPerMeter: 13, customerCost: 480, customerRate: 20 });
  });
  it('uses the saved contract amount before current billboard dimensions', () => {
    expect(contractPrintArea({ print_price_per_meter: '20', print_cost: 960 }, [], [])).toBe(48);
  });
  it('respects print dimensions and single face overrides when no saved amount is available', () => {
    expect(contractPrintArea({ billboard_ids: '1,2', single_face_billboards: '2' },
      [{ ID: 1, Size: '3x4', Faces_Count: 2 }, { ID: 2, Size: '3x4', Faces_Count: 2 }],
      [{ name: '3x4', print_size: '3.2x4.2', width: 3, height: 4 }])).toBeCloseTo(40.32);
  });
  it('recognizes persisted boolean forms', () => {
    for (const value of [true, 'true', 1, '1']) expect(printEnabled(value)).toBe(true);
    for (const value of [false, 'false', 0, null]) expect(printEnabled(value)).toBe(false);
  });
});
