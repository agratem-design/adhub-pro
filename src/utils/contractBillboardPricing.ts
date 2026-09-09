import { allocateMoney, money } from './contractEditMoney';

/**
 * Unified billboard pricing logic — Single Source of Truth
 * Used by both the UI cards (SelectedBillboardsCard) and the save path (ContractEdit).
 */

export interface BillboardPricingInput {
  billboardId: string;
  baseRentalPrice: number;       // from calculateBillboardPrice()
  installationPrice: number;     // from installationDetails
  printCost: number;             // from printCostDetails
  isSingleFace: boolean;
  /** When true, this billboard is a replacement for a paused one — its baseRentalPrice
   *  is fixed to `replacementAllocation`, and it is excluded from contract-discount
   *  distribution so that paused.consumed + replacement.allocated = original full price. */
  isReplacement?: boolean;
  replacementAllocation?: number;
  /** Retain an unchanged saved allocation when every row and the total still match. */
  savedDiscount?: number;
  individualDiscountValue?: number;
  individualDiscountType?: 'percent' | 'amount';
}

export interface BillboardPricingOptions {
  totalDiscount: number;
  roundingMode?: 'clean' | 'proportional';
  printCostEnabled: boolean;
  includePrintInPrice: boolean;
  installationEnabled: boolean;
  includeInstallationInPrice: boolean;
}

export interface BillboardPricingResult {
  billboardId: string;
  baseRentalPrice: number;
  installationPrice: number;       // adjusted for single face
  printCost: number;               // adjusted for single face
  includedPrintCost: number;
  includedInstallCost: number;
  netRentalBeforeDiscount: number;
  rawDiscountPerBillboard: number;
  discountPerBillboard: number;
  individualDiscountAmt: number;   // calculated individual discount amount
  netRentalAfterDiscount: number;
  extraPrintCost: number;
  extraInstallCost: number;
  roundingAdjustment: number;    // positive means more discount than the proportional share
  totalForBoard: number;           // final price shown on card
}

/**
 * Smart rounding to "clean" numbers — matches the card display logic exactly.
 * New logic: >5000 → nearest 500, >1000 → nearest 100, >100 → nearest 50, else → nearest 10
 */
export function roundToClean(value: number): number {
  if (value <= 0) return 0;
  if (value > 5000) return Math.round(value / 500) * 500;
  if (value > 1000) return Math.round(value / 100) * 100;
  if (value > 100) return Math.round(value / 50) * 50;
  return Math.round(value / 10) * 10;
}

/**
 * Calculate pricing for all billboards at once, with proper discount distribution
 * and rounding that matches the UI cards exactly.
 */
export function calculateAllBillboardPrices(
  inputs: BillboardPricingInput[],
  options: BillboardPricingOptions
): BillboardPricingResult[] {
  const nonnegative = (value: number) => money(Number.isFinite(value) ? Math.max(0, value) : 0);
  const rows = inputs.map(input => {
    const installationPrice = options.installationEnabled ? nonnegative(input.installationPrice / (input.isSingleFace ? 2 : 1)) : 0;
    const printCost = options.printCostEnabled ? nonnegative(input.printCost / (input.isSingleFace ? 2 : 1)) : 0;
    const includedPrintCost = options.includePrintInPrice ? printCost : 0;
    const includedInstallCost = options.includeInstallationInPrice ? installationPrice : 0;
    const baseRentalPrice = nonnegative(input.isReplacement ? input.replacementAllocation ?? input.baseRentalPrice : input.baseRentalPrice);
    const availableRental = nonnegative(baseRentalPrice - includedPrintCost - includedInstallCost);
    const requestedIndividual = input.individualDiscountType === 'percent'
      ? availableRental * nonnegative(input.individualDiscountValue ?? 0) / 100
      : nonnegative(input.individualDiscountValue ?? 0);
    const individualDiscountAmt = input.isReplacement ? 0 : Math.min(availableRental, nonnegative(requestedIndividual));
    return { input, billboardId: input.billboardId, baseRentalPrice, installationPrice, printCost,
      includedPrintCost, includedInstallCost, individualDiscountAmt,
      netRentalBeforeDiscount: nonnegative(availableRental - individualDiscountAmt),
      extraPrintCost: options.includePrintInPrice || input.isReplacement ? 0 : printCost,
      extraInstallCost: options.includeInstallationInPrice || input.isReplacement ? 0 : installationPrice };
  });
  // Stable identity resolves one-cent ties, so sorting the page never changes prices.
  const eligible = rows.filter(row => !row.input.isReplacement).sort((a,b) =>
    a.billboardId < b.billboardId ? -1 : a.billboardId > b.billboardId ? 1 : 0);
  const capacity = money(eligible.reduce((sum,row) => sum + row.netRentalBeforeDiscount, 0));
  const discount = Math.min(capacity, nonnegative(options.totalDiscount));
  const canKeepSaved = eligible.every(row => Number.isFinite(row.input.savedDiscount) &&
    row.input.savedDiscount! >= 0 && row.input.savedDiscount! <= row.netRentalBeforeDiscount) &&
    money(eligible.reduce((sum,row) => sum + money(row.input.savedDiscount ?? 0), 0)) === discount;
  const shares = canKeepSaved ? eligible.map(row => money(row.input.savedDiscount!))
    : allocateMoney(discount, eligible.map(row => row.netRentalBeforeDiscount));
  if (!canKeepSaved && discount > 0 && options.roundingMode !== 'proportional') {
    const candidates = eligible.map((row,index) => {
      const ceiling = Math.round(money(row.baseRentalPrice - row.individualDiscountAmt + row.extraPrintCost + row.extraInstallCost) * 100);
      const floor = ceiling - Math.round(row.netRentalBeforeDiscount * 100);
      const ideal = ceiling - Math.round(shares[index] * 100);
      const value = ideal / 100;
      const step = (value > 5000 ? 500 : value > 1000 ? 100 : value > 100 ? 50 : 10) * 100;
      return { index, ceiling, floor, ideal, step, final: Math.max(floor, Math.floor(ideal / step) * step) };
    });
    const target = candidates.reduce((sum,row) => sum + row.ideal, 0);
    let remaining = target - candidates.reduce((sum,row) => sum + row.final, 0);
    // Largest fractional remainders get the next clean price first. No combination search.
    const order = [...candidates].sort((a,b) =>
      (b.ideal-b.final)/b.step - (a.ideal-a.final)/a.step || a.index-b.index);
    for (const row of order) {
      const next = (Math.floor(row.final / row.step) + 1) * row.step;
      const increment = next-row.final;
      if (next <= row.ceiling && increment <= remaining) { row.final=next; remaining-=increment; }
    }
    // If the exact total cannot be expressed using clean values, settle the residual
    // on as few rows as possible, preferring the smallest deviation from the ideal.
    while (remaining > 0) {
      const available = candidates.filter(row => row.final < row.ceiling);
      available.sort((a,b) => {
        const fitsA = a.ceiling-a.final >= remaining ? 1 : 0;
        const fitsB = b.ceiling-b.final >= remaining ? 1 : 0;
        return fitsB-fitsA ||
          Math.abs(a.final+Math.min(remaining,a.ceiling-a.final)-a.ideal) -
          Math.abs(b.final+Math.min(remaining,b.ceiling-b.final)-b.ideal) || a.index-b.index;
      });
      const row = available[0];
      if (!row) break;
      const increment = Math.min(remaining,row.ceiling-row.final);
      row.final += increment; remaining -= increment;
    }
    candidates.forEach(row => { shares[row.index]=(row.ceiling-row.final)/100; });
  }
  const discounts = new Map(eligible.map((row,index) => [row.billboardId,shares[index]]));
  return rows.map(({input,...row}) => {
    const discountPerBillboard = discounts.get(row.billboardId) ?? 0;
    return { ...row, discountPerBillboard,
      roundingAdjustment: money(discountPerBillboard - (input.isReplacement || capacity === 0 ? 0 : discount * row.netRentalBeforeDiscount / capacity)),
      rawDiscountPerBillboard: input.isReplacement || capacity === 0 ? 0 : discount * row.netRentalBeforeDiscount / capacity,
      netRentalAfterDiscount: nonnegative(row.netRentalBeforeDiscount - discountPerBillboard),
      totalForBoard: money(row.baseRentalPrice - row.individualDiscountAmt - discountPerBillboard + row.extraPrintCost + row.extraInstallCost) };
  });
}
