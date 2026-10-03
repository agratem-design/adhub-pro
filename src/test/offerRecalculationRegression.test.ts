import { describe, expect, it } from 'vitest';
import { calculateAllBillboardPrices, BillboardPricingInput, BillboardPricingOptions } from '@/utils/contractBillboardPricing';

describe('Offer recalculation upon deleting or modifying billboards', () => {
  const defaultOptions: BillboardPricingOptions = {
    totalDiscount: 0,
    printCostEnabled: true,
    includePrintInPrice: false,
    installationEnabled: true,
    includeInstallationInPrice: false,
  };

  it('recalculates total immediately when a billboard is deleted from the offer', () => {
    const boardA: BillboardPricingInput = {
      billboardId: 'A',
      baseRentalPrice: 1000,
      installationPrice: 200,
      printCost: 300,
      isSingleFace: false,
    };
    const boardB: BillboardPricingInput = {
      billboardId: 'B',
      baseRentalPrice: 2000,
      installationPrice: 400,
      printCost: 600,
      isSingleFace: false,
    };

    // Both billboards selected:
    const initialRows = calculateAllBillboardPrices([boardA, boardB], defaultOptions);
    const initialTotal = initialRows.reduce((sum, r) => sum + r.totalForBoard, 0);
    // Board A: 1000 + 200 + 300 = 1500. Board B: 2000 + 400 + 600 = 3000. Total = 4500
    expect(initialTotal).toBe(4500);

    // Billboard A is deleted (only B remains):
    const updatedRows = calculateAllBillboardPrices([boardB], defaultOptions);
    const updatedTotal = updatedRows.reduce((sum, r) => sum + r.totalForBoard, 0);
    expect(updatedTotal).toBe(3000);
    expect(updatedTotal).toBeLessThan(initialTotal);
  });

  it('recalculates total when all billboards are removed to 0', () => {
    const updatedRows = calculateAllBillboardPrices([], defaultOptions);
    const updatedTotal = updatedRows.reduce((sum, r) => sum + r.totalForBoard, 0);
    expect(updatedTotal).toBe(0);
  });

  it('recalculates costs when a billboard is modified to single-face (وجه واحد)', () => {
    const boardDoubleFace: BillboardPricingInput = {
      billboardId: '1',
      baseRentalPrice: 1200,
      installationPrice: 400,
      printCost: 600,
      isSingleFace: false,
    };

    const doubleFaceResult = calculateAllBillboardPrices([boardDoubleFace], defaultOptions)[0];
    expect(doubleFaceResult.installationPrice).toBe(400);
    expect(doubleFaceResult.printCost).toBe(600);
    expect(doubleFaceResult.totalForBoard).toBe(1200 + 400 + 600); // 2200

    // Toggled to single face:
    const boardSingleFace: BillboardPricingInput = {
      ...boardDoubleFace,
      isSingleFace: true,
    };

    const singleFaceResult = calculateAllBillboardPrices([boardSingleFace], defaultOptions)[0];
    expect(singleFaceResult.installationPrice).toBe(200); // halved
    expect(singleFaceResult.printCost).toBe(300); // halved
    expect(singleFaceResult.totalForBoard).toBe(1200 + 200 + 300); // 1700
  });

  it('recalculates total when an individual discount is applied or modified on a billboard', () => {
    const board: BillboardPricingInput = {
      billboardId: '1',
      baseRentalPrice: 2000,
      installationPrice: 0,
      printCost: 0,
      isSingleFace: false,
    };

    // No individual discount
    const rowNoDiscount = calculateAllBillboardPrices([board], defaultOptions)[0];
    expect(rowNoDiscount.totalForBoard).toBe(2000);
    expect(rowNoDiscount.individualDiscountAmt).toBe(0);

    // Fixed amount discount: 250 LYD
    const rowAmountDiscount = calculateAllBillboardPrices([{
      ...board,
      individualDiscountValue: 250,
      individualDiscountType: 'amount',
    }], defaultOptions)[0];
    expect(rowAmountDiscount.individualDiscountAmt).toBe(250);
    expect(rowAmountDiscount.totalForBoard).toBe(1750);

    // Percentage discount: 20%
    const rowPercentDiscount = calculateAllBillboardPrices([{
      ...board,
      individualDiscountValue: 20,
      individualDiscountType: 'percent',
    }], defaultOptions)[0];
    expect(rowPercentDiscount.individualDiscountAmt).toBe(400);
    expect(rowPercentDiscount.totalForBoard).toBe(1600);
  });

  it('distributes general discount on top of individual billboard discounts seamlessly', () => {
    const boardA: BillboardPricingInput = {
      billboardId: 'A',
      baseRentalPrice: 1000,
      installationPrice: 0,
      printCost: 0,
      isSingleFace: false,
      individualDiscountValue: 200,
      individualDiscountType: 'amount',
    };
    const boardB: BillboardPricingInput = {
      billboardId: 'B',
      baseRentalPrice: 1000,
      installationPrice: 0,
      printCost: 0,
      isSingleFace: false,
    };

    // General discount of 200 LYD
    const rows = calculateAllBillboardPrices([boardA, boardB], {
      ...defaultOptions,
      totalDiscount: 200,
    });

    const rowA = rows.find(r => r.billboardId === 'A')!;
    const rowB = rows.find(r => r.billboardId === 'B')!;

    // Board A: individual discount 200 -> net before general = 800
    expect(rowA.individualDiscountAmt).toBe(200);
    // Board B: no individual discount -> net before general = 1000
    expect(rowB.individualDiscountAmt).toBe(0);

    // Total net before general = 1800
    // General discount 200 is allocated between 800 and 1000
    const sumTotal = rows.reduce((acc, r) => acc + r.totalForBoard, 0);
    expect(sumTotal).toBe(2000 - 200 - 200); // 1600
  });
});
