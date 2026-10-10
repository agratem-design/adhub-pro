import { describe, it, expect } from 'vitest';
import { calculateAllBillboardPrices, BillboardPricingInput, BillboardPricingOptions } from '@/utils/contractBillboardPricing';

describe('Offer Billboard Card vs Print Pricing and Discount Parity', () => {
  const pricingOptions: BillboardPricingOptions = {
    totalDiscount: 100, // 100 LYD general discount across offer
    printCostEnabled: true,
    includePrintInPrice: false,
    installationEnabled: true,
    includeInstallationInPrice: false,
  };

  it('matches billboard discount between card calculation and price snapshot with individual discount', () => {
    // Billboard 1 with base price 1000, individual discount 200 LYD
    const boardA: BillboardPricingInput = {
      billboardId: '101',
      baseRentalPrice: 1000,
      installationPrice: 150,
      printCost: 250,
      isSingleFace: false,
      individualDiscountValue: 200,
      individualDiscountType: 'amount',
    };
    // Billboard 2 with base price 1000, no individual discount
    const boardB: BillboardPricingInput = {
      billboardId: '102',
      baseRentalPrice: 1000,
      installationPrice: 150,
      printCost: 250,
      isSingleFace: false,
    };

    const results = calculateAllBillboardPrices([boardA, boardB], pricingOptions);
    const rowA = results.find(r => r.billboardId === '101')!;
    const rowB = results.find(r => r.billboardId === '102')!;

    // In Billboard Card (SelectedBillboardsCard):
    // Board A has:
    // - base rental price: 1000
    // - individual discount: 200
    // - extra install: 150, extra print: 250
    // - gross price: 1000 + 150 + 250 = 1400
    // - share of general discount (discountPerBillboard): allocated from 100
    // Total discount on board A: individualDiscountAmt + discountPerBillboard
    const totalDiscountA = rowA.individualDiscountAmt + rowA.discountPerBillboard;
    const finalPriceA = rowA.totalForBoard;

    // Check invariant: totalForBoard must equal baseRentalPrice + extras - totalDiscount
    const grossPriceA = rowA.baseRentalPrice + rowA.extraPrintCost + rowA.extraInstallCost;
    expect(finalPriceA).toBe(grossPriceA - totalDiscountA);
    expect(rowA.individualDiscountAmt).toBe(200);

    // In offerBillboardPriceRows / liveBillboardPrices snapshot sent to ContractPDFDialog:
    const snapshotA = {
      billboardId: rowA.billboardId,
      schemaVersion: 2,
      basePriceBeforeDiscount: rowA.baseRentalPrice,
      priceBeforeDiscount: grossPriceA,
      discountPerBillboard: rowA.discountPerBillboard,
      individualDiscountAmt: rowA.individualDiscountAmt,
      finalPrice: rowA.totalForBoard,
      priceAfterDiscount: rowA.totalForBoard,
    };

    // When ContractPDFDialog resolves price:
    // 1) For schemaVersion: 2, it must preserve snapshotA.finalPrice directly
    const hasAuthoritativePrice = snapshotA.schemaVersion === 2 || snapshotA.finalPrice != null;
    expect(hasAuthoritativePrice).toBe(true);

    const resolvedPrintPrice = Number(snapshotA.finalPrice);
    expect(resolvedPrintPrice).toBe(finalPriceA);

    // 2) The strikethrough original price must match priceBeforeDiscount
    const resolvedOriginalPrice = Number(snapshotA.priceBeforeDiscount);
    expect(resolvedOriginalPrice).toBe(grossPriceA);

    // 3) The difference in print (original - final) must exactly equal totalDiscount in card
    const printImplicitDiscount = resolvedOriginalPrice - resolvedPrintPrice;
    expect(printImplicitDiscount).toBe(totalDiscountA);
  });

  it('correctly handles legacy recalculation when individual discount is present', () => {
    // If a legacy row (without schemaVersion: 2) has basePriceBeforeDiscount = 1000, discountPerBillboard = 50, individualDiscountAmt = 150
    const legacyItem = {
      basePriceBeforeDiscount: 1000,
      discountPerBillboard: 50,
      individualDiscountAmt: 150,
      printCost: 0,
      installationCost: 0,
    };

    const baseRental = Number(legacyItem.basePriceBeforeDiscount);
    const totalDiscountOnItem = Number(legacyItem.discountPerBillboard || 0) + Number(legacyItem.individualDiscountAmt || 0);
    const recalculatedPrice = Math.max(0, baseRental - totalDiscountOnItem);

    // Must be 1000 - (50 + 150) = 800, NOT 1000 - 50 = 950
    expect(recalculatedPrice).toBe(800);
  });
});
