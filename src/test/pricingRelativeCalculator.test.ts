import { describe, expect, it } from 'vitest';
import { computeRelativePricingPlan, PricingPeriod, PricingRow } from '@/utils/pricingRelativeCalculator';

const samplePeriods: PricingPeriod[] = [
  { key: 'month1', label: 'شهر واحد', dbColumn: 'one_month' },
  { key: 'month3', label: '3 أشهر', dbColumn: '3_months' },
  { key: 'year1', label: 'سنة كاملة', dbColumn: 'full_year' },
];

const sampleRecords: PricingRow[] = [
  // Company Level A
  { id: 1, size: '4X12', billboard_level: 'A', customer_category: 'شركات', one_month: 10000, '3_months': 27000, full_year: 90000 },
  { id: 2, size: '3X8', billboard_level: 'A', customer_category: 'شركات', one_month: 6000, '3_months': 16000, full_year: 54000 },
  // Company Level B (existing prices)
  { id: 3, size: '4X12', billboard_level: 'B', customer_category: 'شركات', one_month: 8500, '3_months': 23000, full_year: 75000 },
  // Other Category 'وكالات'
  { id: 4, size: '4X12', billboard_level: 'A', customer_category: 'وكالات', one_month: 9000, '3_months': 25000, full_year: 85000 },
];

describe('pricingRelativeCalculator', () => {
  it('calculates company Level B prices as a 20% discount from Level A for all durations', () => {
    const result = computeRelativePricingPlan({
      customer: 'شركات',
      targetLevel: 'B',
      referenceLevel: 'A',
      records: sampleRecords,
      periods: samplePeriods,
      scope: 'all',
      month: 'month1',
      mode: 'discount',
      rate: 20,
      valid: true,
    });

    // 4X12 and 3X8 evaluated across 3 periods = 6 items
    expect(result.plan.length).toBe(6);
    
    // Check 4X12 one_month: base 10000 - 20% = 8000 (before was 8500)
    const item4x12Month1 = result.plan.find(p => p.size === '4X12' && p.period.key === 'month1');
    expect(item4x12Month1).toBeDefined();
    expect(item4x12Month1?.base).toBe(10000);
    expect(item4x12Month1?.before).toBe(8500);
    expect(item4x12Month1?.after).toBe(8000);
    expect(item4x12Month1?.diff).toBe(-500);
    expect(item4x12Month1?.referenceLabel).toBe('المستوى A');

    // Check 3X8 one_month: base 6000 - 20% = 4800 (before was null)
    const item3x8Month1 = result.plan.find(p => p.size === '3X8' && p.period.key === 'month1');
    expect(item3x8Month1).toBeDefined();
    expect(item3x8Month1?.base).toBe(6000);
    expect(item3x8Month1?.before).toBeNull();
    expect(item3x8Month1?.after).toBe(4800);
  });

  it('calculates company Level S prices as a 30% increase from Level A for single duration', () => {
    const result = computeRelativePricingPlan({
      customer: 'شركات',
      targetLevel: 'S',
      referenceLevel: 'A',
      records: sampleRecords,
      periods: samplePeriods,
      scope: 'current',
      month: 'month1',
      mode: 'increase',
      rate: 30,
      valid: true,
    });

    // Only month1 evaluated for available sizes (4X12, 3X8)
    expect(result.plan.length).toBe(2);
    const item4x12 = result.plan.find(p => p.size === '4X12');
    expect(item4x12?.base).toBe(10000);
    expect(item4x12?.after).toBe(13000); // 10000 + 30% = 13000
  });

  it('calculates company Level B adjustments based on its own existing prices (__SAME__)', () => {
    const result = computeRelativePricingPlan({
      customer: 'شركات',
      targetLevel: 'B',
      referenceLevel: '__SAME__',
      records: sampleRecords,
      periods: samplePeriods,
      scope: 'current',
      month: 'month1',
      mode: 'increase',
      rate: 10,
      valid: true,
    });

    const item4x12 = result.plan.find(p => p.size === '4X12');
    expect(item4x12?.referenceLabel).toBe('السعر الحالي');
    expect(item4x12?.base).toBe(8500);
    expect(item4x12?.before).toBe(8500);
    expect(item4x12?.after).toBe(9350); // 8500 * 1.10 = 9350
    expect(item4x12?.diff).toBe(850);
  });

  it('handles targeting a single size for companies', () => {
    const result = computeRelativePricingPlan({
      customer: 'شركات',
      targetLevel: 'B',
      referenceLevel: 'A',
      records: sampleRecords,
      periods: samplePeriods,
      scope: 'single_current',
      month: 'month1',
      targetSize: '4X12',
      mode: 'discount',
      rate: 15,
      valid: true,
    });

    expect(result.plan.length).toBe(1);
    expect(result.plan[0].size).toBe('4X12');
    expect(result.plan[0].after).toBe(8500); // 10000 * 0.85 = 8500
  });

  it('supports zeroing prices for a level', () => {
    const result = computeRelativePricingPlan({
      customer: 'شركات',
      targetLevel: 'B',
      referenceLevel: 'A',
      records: sampleRecords,
      periods: samplePeriods,
      scope: 'current',
      month: 'month1',
      targetSize: '4X12',
      mode: 'zero',
      rate: 0,
      valid: true,
    });

    expect(result.plan[0].after).toBe(0);
    expect(result.changes.length).toBe(1);
  });

  it('supports non-company category calculations against companies benchmark', () => {
    const result = computeRelativePricingPlan({
      customer: 'وكالات',
      targetLevel: 'A',
      referenceLevel: '',
      records: sampleRecords,
      periods: samplePeriods,
      scope: 'current',
      month: 'month1',
      mode: 'discount',
      rate: 15,
      valid: true,
    });

    const item = result.plan.find(p => p.size === '4X12');
    expect(item).toBeDefined();
    expect(item?.referenceLabel).toBe('شركات');
    expect(item?.base).toBe(10000); // company price
    expect(item?.before).toBe(9000); // agency current price
    expect(item?.after).toBe(8500); // 10000 - 15%
    expect(item?.diff).toBe(-500); // 8500 - 9000
  });

  it('safely skips sizes without valid benchmark prices', () => {
    const recordsWithMissing: PricingRow[] = [
      { id: 10, size: '5X15', billboard_level: 'B', customer_category: 'شركات', one_month: 5000 },
      // 5X15 is missing in Level A
    ];

    const result = computeRelativePricingPlan({
      customer: 'شركات',
      targetLevel: 'B',
      referenceLevel: 'A',
      records: recordsWithMissing,
      periods: samplePeriods,
      scope: 'current',
      month: 'month1',
      mode: 'discount',
      rate: 10,
      valid: true,
    });

    expect(result.skipped).toBe(1);
    expect(result.changes.length).toBe(0);
    expect(result.plan[0].after).toBeNull();
  });

  it('strictly orders plan and changes according to size sort_order rank rather than alphabetical order', () => {
    // Sizes with custom ranks: 13X5 (rank 1), 12X4 (rank 2), 10X4 (rank 3), 4X12 (rank 4), 3X8 (rank 5)
    // Alphabetical order would be: 10X4, 12X4, 13X5, 3X8, 4X12 (WRONG!)
    const sizesWithOrder = [
      { id: 1, name: '13X5', sort_order: 1 },
      { id: 2, name: '12X4', sort_order: 2 },
      { id: 3, name: '10X4', sort_order: 3 },
      { id: 4, name: '4X12', sort_order: 4 },
      { id: 5, name: '3X8', sort_order: 5 },
    ];

    // Intentionally out-of-order records
    const multiRecords: PricingRow[] = [
      { id: 101, size: '3X8', billboard_level: 'A', customer_category: 'شركات', one_month: 3000 },
      { id: 102, size: '10X4', billboard_level: 'A', customer_category: 'شركات', one_month: 8000 },
      { id: 103, size: '13X5', billboard_level: 'A', customer_category: 'شركات', one_month: 12000 },
      { id: 104, size: '4X12', billboard_level: 'A', customer_category: 'شركات', one_month: 9000 },
      { id: 105, size: '12X4', billboard_level: 'A', customer_category: 'شركات', one_month: 10000 },
      // Target level B with existing different prices
      { id: 201, size: '3X8', billboard_level: 'B', customer_category: 'شركات', one_month: 3500 },
      { id: 202, size: '10X4', billboard_level: 'B', customer_category: 'شركات', one_month: 8500 },
      { id: 203, size: '13X5', billboard_level: 'B', customer_category: 'شركات', one_month: 13000 },
      { id: 204, size: '4X12', billboard_level: 'B', customer_category: 'شركات', one_month: 9500 },
      { id: 205, size: '12X4', billboard_level: 'B', customer_category: 'شركات', one_month: 10500 },
    ];

    const result = computeRelativePricingPlan({
      customer: 'شركات',
      targetLevel: 'B',
      referenceLevel: 'A',
      records: multiRecords,
      periods: samplePeriods.slice(0, 1), // month1
      scope: 'current',
      month: 'month1',
      mode: 'discount',
      rate: 10,
      valid: true,
      sizes: sizesWithOrder,
    });

    expect(result.changes.length).toBe(5);
    const orderedSizes = result.changes.map(c => c.size);
    // Must match defined sort_order rank: 13X5 -> 12X4 -> 10X4 -> 4X12 -> 3X8
    expect(orderedSizes).toEqual(['13X5', '12X4', '10X4', '4X12', '3X8']);
    expect(result.changes[0].sizeOrder).toBe(1);
    expect(result.changes[1].sizeOrder).toBe(2);
    expect(result.changes[2].sizeOrder).toBe(3);
    expect(result.changes[3].sizeOrder).toBe(4);
    expect(result.changes[4].sizeOrder).toBe(5);
  });
});

