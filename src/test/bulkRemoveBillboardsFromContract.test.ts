import { describe, it, expect } from 'vitest';
import { calculateRemainingBillboardValue, calculateDaysBetween } from '@/utils/contractBillboardCalculations';
import { readPrices } from '@/components/contracts/RentalCompensationAlert';

describe('Bulk Billboard Removal From Contract Suite', () => {
  it('correctly calculates remaining values for multiple selected billboards in a contract', () => {
    const prices = [
      { billboardId: '101', finalPrice: 6000, startDate: '2026-01-01', endDate: '2026-12-31' },
      { billboardId: '102', finalPrice: 3650, startDate: '2026-01-01', endDate: '2026-12-31' },
      { billboardId: '103', finalPrice: 12000, startDate: '2026-01-01', endDate: '2026-12-31' },
    ];

    const effectiveDate = '2026-07-01'; // roughly half year
    const selectedIds = ['101', '102'];

    let totalSuggested = 0;
    const itemDetails: Array<{ id: string; remaining: number }> = [];

    selectedIds.forEach(id => {
      const p = prices.find(x => x.billboardId === id)!;
      const rem = calculateRemainingBillboardValue({
        startDate: p.startDate,
        endDate: p.endDate,
        effectiveDate,
        contractedPrice: p.finalPrice,
        printCost: 0,
        installCost: 0,
      });
      totalSuggested += rem.remainingValue;
      itemDetails.push({ id, remaining: rem.remainingValue });
    });

    expect(itemDetails).toHaveLength(2);
    expect(itemDetails[0].remaining).toBeGreaterThan(0);
    expect(itemDetails[1].remaining).toBeGreaterThan(0);
    expect(totalSuggested).toBe(itemDetails[0].remaining + itemDetails[1].remaining);
  });

  it('correctly groups billboards by contract number for bulk removal', () => {
    const selectedBillboards = [
      { ID: 101, Billboard_Name: 'لوحة 1', Contract_Number: 105, Customer_Name: 'شركة الفارس' },
      { ID: 102, Billboard_Name: 'لوحة 2', Contract_Number: 105, Customer_Name: 'شركة الفارس' },
      { ID: 103, Billboard_Name: 'لوحة 3', Contract_Number: 200, Customer_Name: 'شركة الواحة' },
      { ID: 104, Billboard_Name: 'لوحة 4', Contract_Number: null, Customer_Name: null },
    ];

    const contractedOnly = selectedBillboards.filter(b => Boolean(b.Contract_Number && String(b.Contract_Number) !== '0'));
    expect(contractedOnly).toHaveLength(3);

    const map = new Map<string, { contractNumber: string; customerName: string; billboards: any[] }>();
    contractedOnly.forEach(b => {
      const cNum = String(b.Contract_Number);
      const cust = b.Customer_Name || 'غير محدد';
      if (!map.has(cNum)) {
        map.set(cNum, { contractNumber: cNum, customerName: cust, billboards: [] });
      }
      map.get(cNum)!.billboards.push(b);
    });

    const groups = Array.from(map.values());
    expect(groups).toHaveLength(2);
    expect(groups.find(g => g.contractNumber === '105')?.billboards).toHaveLength(2);
    expect(groups.find(g => g.contractNumber === '200')?.billboards).toHaveLength(1);
  });

  it('correctly handles prorating custom user adjustment among multiple billboards', () => {
    const itemDetails = [
      { id: '101', remainingValue: 1000 },
      { id: '102', remainingValue: 2000 },
    ];
    const totalSuggested = 3000;
    const userEnteredTotal = 1500; // user entered a custom discounted refund
    const ratio = userEnteredTotal / totalSuggested; // 0.5

    let accumulated = 0;
    const distributedAmounts: number[] = [];

    for (let i = 0; i < itemDetails.length; i++) {
      const isLast = i === itemDetails.length - 1;
      const amount = isLast
        ? Math.round((userEnteredTotal - accumulated) * 100) / 100
        : Math.round((itemDetails[i].remainingValue * ratio) * 100) / 100;
      accumulated += amount;
      distributedAmounts.push(amount);
    }

    expect(distributedAmounts[0]).toBe(500);
    expect(distributedAmounts[1]).toBe(1000);
    expect(accumulated).toBe(userEnteredTotal);
  });

  it('correctly handles multi-removal in contract state without side effects', () => {
    let selected = ['101', '102', '103', '104'];
    let friendCosts = [
      { billboardId: '101', cost: 500 },
      { billboardId: '103', cost: 700 }
    ];
    let singleFaces = new Set(['102', '104']);

    const idsToRemove = ['101', '102'];

    // Bulk remove logic
    selected = selected.filter(x => !idsToRemove.includes(x));
    friendCosts = friendCosts.filter(f => !idsToRemove.includes(f.billboardId));
    singleFaces = new Set(Array.from(singleFaces).filter(x => !idsToRemove.includes(x)));

    expect(selected).toEqual(['103', '104']);
    expect(friendCosts).toEqual([{ billboardId: '103', cost: 700 }]);
    expect(Array.from(singleFaces)).toEqual(['104']);
  });
});
