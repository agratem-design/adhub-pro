// @ts-nocheck
import { supabase } from '@/integrations/supabase/client';

/**
 * Paused billboards service.
 *
 * NOTE: This service no longer mutates `Contract."Total Rent"` directly.
 * The contract total is computed in the UI (CostSummaryCard) from a single
 * source of truth: selected billboards + paused billboards' consumed amounts.
 * It is then persisted once when the user saves the contract.
 */

export interface PausedBillboard {
  id: string;
  contract_number: number;
  billboard_id: number;
  billboard_name: string | null;
  pause_date: string;
  original_price: number;
  net_rent: number;
  /** Snapshot of the full price at the moment the billboard was paused (preferred). */
  full_price?: number | null;
  consumed_amount: number;
  refund_amount: number;
  /** Manual override for refund. When null, refund is computed from pause_date. */
  manual_refund?: number | null;
  /** Original contract dates at pause time, used to recompute consumed/refund. */
  original_start_date?: string | null;
  original_end_date?: string | null;
  deducted_from_contract: boolean;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
  size?: string;
  lifecycle_state?: "paused" | "resumed" | "cancelled";
  resumed_at?: string;
  price_snapshot?: Record<string, any>;
}

export async function listPausedBillboards(contractNumber: number): Promise<PausedBillboard[]> {
  const { data, error } = await supabase
    .from('paused_billboards' as any)
    .select('*')
    .eq('contract_number', contractNumber)
    .order('pause_date', { ascending: false });
  // SELECT * works before and after the migration. Filter the optional lifecycle
  // in memory so legacy databases do not receive a failing query on every read.
  if (error) throw error;
  return ((data || []) as unknown as PausedBillboard[]).filter(row => row.lifecycle_state !== 'cancelled');
}

/**
 * Reconcile Contract.billboard_ids and billboard_prices with paused_billboards
 * and paused_billboard_replacements. Self-heals legacy contracts where the
 * paused billboard was not removed from billboard_ids or where the
 * replacement was not registered.
 *
 * - Removes every paused billboard_id from Contract.billboard_ids.
 * - Ensures each replacement_billboard_id is present in Contract.billboard_ids.
 * - Ensures billboard_prices contains a row for each replacement with its
 *   allocated_amount as fixed price.
 * - Only writes when something actually changed.
 */
export async function syncContractIdsWithPaused(contractNumber: number, persist = true): Promise<string[]> {
  if (!contractNumber) return [];
  const { data: contract } = await supabase
    .from('Contract')
    .select('billboard_ids, billboard_prices')
    .eq('Contract_Number', contractNumber)
    .maybeSingle();
  if (!contract) return [];

  const idsStr: string = (contract as any).billboard_ids || '';
  const originalIds = idsStr ? idsStr.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
  let ids = [...originalIds];

  let prices: any[] = [];
  try {
    const raw = (contract as any).billboard_prices;
    if (raw) prices = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(prices)) prices = [];
  } catch {
    prices = [];
  }
  const originalPricesJson = JSON.stringify(prices);

  // 1. Remove every paused billboard_id from billboard_ids
  const pausedRows = (await listPausedBillboards(contractNumber))
    .filter(row => !row.lifecycle_state || row.lifecycle_state === 'paused');
  const pausedIds = new Set<string>(
    (pausedRows || []).map((r: any) => String(r.billboard_id)),
  );
  if (pausedIds.size > 0) {
    ids = ids.filter((x) => !pausedIds.has(String(x)));
    prices = prices.filter(
      (p: any) => !pausedIds.has(String(p.billboardId ?? p.billboard_id ?? p.ID ?? p.id ?? '')),
    );
  }

  // 2. Ensure each replacement is registered in billboard_ids and billboard_prices
  const { data: replRows } = await supabase
    .from('paused_billboard_replacements' as any)
    .select('paused_billboard_id, replacement_billboard_id, allocated_amount')
    .eq('contract_number', contractNumber);
  for (const r of (replRows || []) as any[]) {
    const replId = String(r.replacement_billboard_id);
    if (!ids.includes(replId)) ids.push(replId);
    const amount = Number(r.allocated_amount) || 0;
    const idx = prices.findIndex(
      (p: any) => String(p.billboardId ?? p.billboard_id ?? p.ID ?? p.id ?? '') === replId,
    );
    const entry: any = {
      billboardId: replId,
      basePriceBeforeDiscount: amount,
      priceBeforeDiscount: amount,
      discountPerBillboard: 0,
      priceAfterDiscount: amount,
      contractPrice: amount,
      finalPrice: amount,
      printCost: 0,
      installationCost: 0,
      totalBillboardPrice: amount,
      _replacement_of: r.paused_billboard_id,
    };
    if (idx >= 0) prices[idx] = { ...prices[idx], ...entry };
    else prices.push(entry);
  }

  const changed =
    JSON.stringify(ids) !== JSON.stringify(originalIds) ||
    JSON.stringify(prices) !== originalPricesJson;

  if (changed && persist) {
    await supabase
      .from('Contract')
      .update({
        billboard_ids: ids.length > 0 ? ids.join(',') : null,
        billboard_prices: JSON.stringify(prices),
      })
      .eq('Contract_Number', contractNumber);
  }

  return ids;
}

export async function addPausedBillboard(payload: Omit<PausedBillboard, 'id' | 'created_at' | 'updated_at'>) {
  // Ensure full_price is populated even for legacy callers
  const fullPrice = Number(
    (payload as any).full_price ?? payload.net_rent ?? payload.original_price ?? 0
  );

  // Default pause_date to original_start_date (or fetch contract start) when missing
  let pauseDate = payload.pause_date;
  if (!pauseDate) {
    pauseDate = (payload as any).original_start_date || '';
    if (!pauseDate && payload.contract_number) {
      try {
        const { data: c } = await supabase
          .from('Contract')
          .select('"Contract Date"')
          .eq('Contract_Number', Number(payload.contract_number))
          .single();
        pauseDate = (c as any)?.['Contract Date'] || '';
      } catch {}
    }
  }

  const insertPayload: any = {
    ...payload,
    pause_date: pauseDate || payload.pause_date,
    full_price: fullPrice,
  };

  const { data, error } = await supabase
    .from('paused_billboards' as any)
    .insert(insertPayload)
    .select()
    .single();
  if (error) throw error;

  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('paused-billboards-changed', {
        detail: { contractNumber: Number(payload.contract_number), billboardId: Number(payload.billboard_id), action: 'added' }
      }));
    }
  } catch {}

  return data as unknown as PausedBillboard;
}

export async function deletePausedBillboard(id: string) {
  const { data, error } = await (supabase as any).rpc('edit_paused_billboard_atomic', { p_pause_id: id, p_patch: {}, p_delete: true });
  if (error) throw error;
  window.dispatchEvent(new CustomEvent('paused-billboards-changed', { detail: { ...data, action: 'removed' } }));
}

export interface UpdatePausedPatch {
  consumed_amount?: number;
  refund_amount?: number;
  manual_refund?: number | null;
  pause_date?: string;
  full_price?: number;
  /** Catalog price BEFORE any contract discount (for print three-tier display). */
  price_before_discount?: number;
  /** Net price AFTER contract discount and BEFORE pause (middle strikethrough). */
  net_after_discount?: number;
  notes?: string | null;
}

export async function updatePausedBillboard(id: string, patch: UpdatePausedPatch) {
  const { data, error } = await (supabase as any).rpc('edit_paused_billboard_atomic', { p_pause_id: id, p_patch: patch, p_delete: false });
  if (error) throw error;
  window.dispatchEvent(new CustomEvent('paused-billboards-changed', { detail: { ...data, action: 'updated' } }));
  return data;
}

/**
 * Read history of removed billboards for a given contract from billboard_history.
 * Returns rows usable to suggest re-adding billboards as paused.
 */
export async function listRemovedBillboardsHistory(contractNumber: number) {
  const { data, error } = await supabase
    .from('billboard_history')
    .select('billboard_id, end_date, notes, individual_billboard_data')
    .eq('contract_number', contractNumber)
    .order('end_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Resume a paused billboard back into its original contract (if the billboard is
 * still available and not booked elsewhere). Re-attaches the billboard to the
 * contract, restores its rental status, and removes the paused row.
 */
export async function resumePausedBillboard(id: string, resumeDate: string, cancel = false): Promise<{ contractNumber: number; billboardId: number }> {
  const { data, error } = await (supabase as any).rpc('resume_contract_billboard_atomic', {
    p_pause_id: id, p_resume_date: resumeDate, p_cancel: cancel,
  });
  if (error) throw error;
  window.dispatchEvent(new CustomEvent('paused-billboards-changed', { detail: { ...data, action: cancel ? 'cancelled' : 'resumed' } }));
  return data;
}
