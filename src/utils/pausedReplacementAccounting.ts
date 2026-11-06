import { money } from './contractEditMoney';

/** A zero refund excludes a pure pause from the contract's financial totals. */
export function purePauseContribution(fullPrice: number, refund: number): number {
  return refund === 0 ? 0 : money(Math.max(0, fullPrice - refund));
}

/**
 * القاعدة: مستهلك الموقوفة + مخصص البديلة = السعر الكامل، فيُحسب مستهلك الموقوفة
 * في الإجمالي حتى لو لها بديلة. الاستثناء الوحيد صف بديلة يصرّح أن سعرها يشمل
 * المستهلك (remainingRental موجود، مثل تصحيح العقد #1320)، فلا يُحسب مرتين.
 * consumedCarryover وحده معلومة وصفية ولا يعني أن السعر يشمله.
 */
export function replacementPriceIncludesConsumed(row: Record<string, unknown> | null | undefined): boolean {
  if (!row) return false;
  const remaining = row.remainingRental;
  return remaining !== undefined && remaining !== null && remaining !== '' && Number.isFinite(Number(remaining));
}

/** معرّفات الإيقافات التي يشمل سعر بديلتها الجزء المستهلك */
export function pauseIdsWithConsumedInReplacement(priceRows: unknown): Set<string> {
  let rows: unknown = priceRows;
  try {
    while (typeof rows === 'string') rows = rows.trim() ? JSON.parse(rows) : [];
  } catch {
    rows = [];
  }
  const ids = new Set<string>();
  if (!Array.isArray(rows)) return ids;
  for (const row of rows as Record<string, unknown>[]) {
    const pauseId = row?._replacement_of;
    if (pauseId != null && pauseId !== '' && replacementPriceIncludesConsumed(row)) ids.add(String(pauseId));
  }
  return ids;
}

export function isRetainedPause(row: { lifecycle_state?: string | null }): boolean {
  return row.lifecycle_state !== 'cancelled';
}

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
  if ((row.price_snapshot as Record<string, unknown> | null)?.retainExecutedServices === true) {
    return money(Math.max(0, fullPrice - refund));
  }
  return purePauseContribution(fullPrice, refund);
}
