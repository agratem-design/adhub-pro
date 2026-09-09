import { money } from './contractEditMoney';

/** Legacy replacements transferred a slice of the original budget, without
 * deducting a refund from the contract. Count only the budget left at each
 * historical node; the replacement is counted separately (and may itself pause).
 * New atomic pauses have a snapshot and an explicit refund: keep their consumed
 * amount, even when a replacement costs more or less than that refund.
 */
export function historicalPauseContribution(row: {
  price_snapshot?: unknown;
  deducted_from_contract?: boolean;
  refund_amount?: number | null;
  consumed_amount?: number | null;
}, fullPrice: number, refund: number, replacementAllocation?: number): number {
  if (replacementAllocation !== undefined) {
    const legacyBudgetTransfer = !row.price_snapshot && row.deducted_from_contract === false
      && Number(row.refund_amount ?? 0) === 0;
    return legacyBudgetTransfer
      ? money(Math.max(0, fullPrice - replacementAllocation))
      : money(Number(row.consumed_amount ?? 0));
  }
  return money(Math.max(0, fullPrice - refund));
}
