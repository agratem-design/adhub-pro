// @ts-nocheck
import { supabase } from '@/integrations/supabase/client';
import { isRetainedPause } from '@/utils/pausedReplacementAccounting';

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
  return ((data || []) as unknown as PausedBillboard[]).filter(isRetainedPause);
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
export interface ReconcileContractReplacementsInput {
  originalIds: string[];
  originalPrices: any[];
  pausedRows: Array<{ id?: string; billboard_id: number | string; lifecycle_state?: string | null }>;
  replRows: Array<{
    id?: string;
    paused_billboard_id: string;
    replacement_billboard_id: number | string;
    replacement_billboard_name?: string | null;
    allocated_amount?: number | null;
    start_date?: string | null;
    end_date?: string | null;
    created_at?: string | null;
  }>;
  swapLogs?: Array<{
    created_at?: string | null;
    details?: any;
  }>;
}

export interface ReconcileContractReplacementsResult {
  ids: string[];
  prices: any[];
  staleReplacementBillboardIds: string[];
  replacementUpdates: Array<{
    id?: string;
    paused_billboard_id: string;
    oldBillboardId: string;
    newBillboardId: string;
    newBillboardName?: string | null;
  }>;
}

const getPriceRowBoardId = (p: any): string =>
  String(p?.billboardId ?? p?.billboard_id ?? p?.ID ?? p?.id ?? '').trim();

/**
 * Pure reconciliation of contract billboard_ids + billboard_prices against
 * paused_billboards, paused_billboard_replacements, and chained instant swaps.
 * Ensures a paused slot never produces two active replacement boards (e.g. SJ1233).
 */
export function reconcileContractReplacements(
  input: ReconcileContractReplacementsInput,
): ReconcileContractReplacementsResult {
  const activePauses = (input.pausedRows || []).filter(
    (row) => !row.lifecycle_state || row.lifecycle_state === 'paused',
  );
  const activePauseIds = new Set<string>(
    activePauses.map((r) => String(r.id || '')).filter(Boolean),
  );
  const pausedIds = new Set<string>(
    activePauses.map((r) => String(r.billboard_id)).filter(Boolean),
  );

  // Deduplicate initial IDs while preserving order and removing paused boards
  const seenIds = new Set<string>();
  let ids: string[] = [];
  for (const rawId of input.originalIds || []) {
    const id = String(rawId).trim();
    if (!id || pausedIds.has(id) || seenIds.has(id)) continue;
    seenIds.add(id);
    ids.push(id);
  }

  let prices = (input.originalPrices || []).filter((p: any) => {
    const bId = getPriceRowBoardId(p);
    return bId && !pausedIds.has(bId);
  });

  // Parse swap logs chronologically (oldest -> newest)
  const parsedSwaps = [...(input.swapLogs || [])]
    .map((log) => {
      let details: any = {};
      try {
        details = typeof log?.details === 'string' ? JSON.parse(log.details) : log?.details || {};
      } catch {
        details = {};
      }
      const resObj = details?.result && typeof details.result === 'object' ? details.result : details;
      const origId = String(
        resObj?.original_billboard_id ??
          details?.original_billboard_id ??
          details?.old_billboard_id ??
          '',
      ).trim();
      const replId = String(
        resObj?.replacement_billboard_id ??
          details?.replacement_billboard_id ??
          details?.new_billboard_id ??
          '',
      ).trim();
      const replName =
        resObj?.replacement_billboard_name ?? details?.replacement_billboard_name ?? null;
      const ts = log?.created_at ? new Date(log.created_at).getTime() : 0;
      return { origId, replId, replName, ts: Number.isFinite(ts) ? ts : 0 };
    })
    .filter((s) => s.origId && s.replId && s.origId !== s.replId)
    .sort((a, b) => a.ts - b.ts);

  const staleSet = new Set<string>();
  const replacementUpdates: ReconcileContractReplacementsResult['replacementUpdates'] = [];

  for (const r of input.replRows || []) {
    const pauseId = String(r.paused_billboard_id || '').trim();
    const recordedReplId = String(r.replacement_billboard_id || '').trim();
    if (!pauseId || !recordedReplId) continue;

    // If the parent pause is no longer active, its replacement shouldn't be forced in
    if (activePauseIds.size > 0 && !activePauseIds.has(pauseId)) {
      continue;
    }

    let currentReplId = recordedReplId;
    let currentReplName: string | null | undefined = r.replacement_billboard_name;

    // 1) Follow any swap chain starting from recordedReplId (A -> B -> C)
    const visited = new Set<string>([currentReplId]);
    for (const swap of parsedSwaps) {
      if (swap.origId === currentReplId && !visited.has(swap.replId)) {
        staleSet.add(currentReplId);
        currentReplId = swap.replId;
        if (swap.replName) currentReplName = swap.replName;
        visited.add(currentReplId);
      }
    }

    // 2) Check price rows linked to this pauseId via _replacement_of
    const linkedPriceRows = prices.filter(
      (p: any) => String(p?._replacement_of || '') === pauseId,
    );
    if (currentReplId === recordedReplId && linkedPriceRows.length > 0) {
      // If recordedReplId is NOT in originalIds (was swapped out) or another row has richer swap metadata
      const otherRows = linkedPriceRows.filter(
        (p: any) => getPriceRowBoardId(p) !== recordedReplId && !pausedIds.has(getPriceRowBoardId(p)),
      );
      if (otherRows.length > 0) {
        const chosenOther =
          otherRows.find((p: any) => p?.consumedCarryover !== undefined || p?.carriedFromBillboardId !== undefined) ||
          otherRows[otherRows.length - 1];
        const otherId = getPriceRowBoardId(chosenOther);
        if (otherId) {
          staleSet.add(recordedReplId);
          currentReplId = otherId;
          currentReplName = undefined;
        }
      }
    }

    // Any other board claiming _replacement_of === pauseId is a duplicate and must be removed
    for (const p of linkedPriceRows) {
      const bId = getPriceRowBoardId(p);
      if (bId && bId !== currentReplId) {
        staleSet.add(bId);
      }
    }

    if (currentReplId !== recordedReplId && !pausedIds.has(currentReplId)) {
      replacementUpdates.push({
        id: r.id,
        paused_billboard_id: pauseId,
        oldBillboardId: recordedReplId,
        newBillboardId: currentReplId,
        newBillboardName: currentReplName,
      });
    }

    // Never re-add a board that is itself paused
    if (pausedIds.has(currentReplId)) {
      staleSet.add(currentReplId);
      continue;
    }

    if (!ids.includes(currentReplId)) {
      ids.push(currentReplId);
    }

    const amount = Number(r.allocated_amount) || 0;
    const idx = prices.findIndex((p: any) => getPriceRowBoardId(p) === currentReplId);
    const defaultEntry: any = {
      billboardId: currentReplId,
      basePriceBeforeDiscount: amount,
      priceBeforeDiscount: amount,
      discountPerBillboard: 0,
      priceAfterDiscount: amount,
      contractPrice: amount,
      finalPrice: amount,
      printCost: 0,
      installationCost: 0,
      totalBillboardPrice: amount,
      ...(r.start_date ? { startDate: r.start_date } : {}),
      ...(r.end_date ? { endDate: r.end_date } : {}),
      isContractualAllocation: true,
      _replacement_of: pauseId,
    };
    if (idx >= 0) {
      prices[idx] = {
        ...defaultEntry,
        ...prices[idx],
        billboardId: currentReplId,
        _replacement_of: pauseId,
      };
    } else {
      prices.push(defaultEntry);
    }
  }

  if (staleSet.size > 0) {
    ids = ids.filter((id) => !staleSet.has(String(id)));
    prices = prices.filter((p: any) => !staleSet.has(getPriceRowBoardId(p)));
  }

  // Deduplicate prices by billboardId (keep last/merged entry)
  const priceByBoard = new Map<string, any>();
  for (const p of prices) {
    const bId = getPriceRowBoardId(p);
    if (!bId) continue;
    priceByBoard.set(bId, p);
  }
  prices = Array.from(priceByBoard.values());

  return {
    ids,
    prices,
    staleReplacementBillboardIds: Array.from(staleSet),
    replacementUpdates,
  };
}

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

  let originalPrices: any[] = [];
  try {
    const raw = (contract as any).billboard_prices;
    if (raw) originalPrices = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(originalPrices)) originalPrices = [];
  } catch {
    originalPrices = [];
  }
  const originalPricesJson = JSON.stringify(originalPrices);

  const [pausedRows, replRes, swapLogsRes] = await Promise.all([
    listPausedBillboards(contractNumber),
    supabase
      .from('paused_billboard_replacements' as any)
      .select('id, paused_billboard_id, replacement_billboard_id, replacement_billboard_name, allocated_amount, start_date, end_date, created_at')
      .eq('contract_number', contractNumber),
    supabase
      .from('activity_log')
      .select('created_at, details, action')
      .in('action', ['instant_billboard_swap', 'installed_board_swap'])
      .eq('contract_number', contractNumber)
      .order('created_at', { ascending: true }),
  ]);

  const reconciled = reconcileContractReplacements({
    originalIds,
    originalPrices,
    pausedRows: pausedRows || [],
    replRows: (replRes.data || []) as any[],
    swapLogs: (swapLogsRes.data || []) as any[],
  });

  // Self-heal stale replacement pointers in paused_billboard_replacements (e.g. after chained swap B -> C)
  for (const upd of reconciled.replacementUpdates) {
    try {
      let replName = upd.newBillboardName;
      if (!replName) {
        const { data: bb } = await supabase
          .from('billboards')
          .select('Billboard_Name')
          .eq('ID', Number(upd.newBillboardId))
          .maybeSingle();
        replName = (bb as any)?.Billboard_Name || null;
      }
      const query = supabase
        .from('paused_billboard_replacements' as any)
        .update({
          replacement_billboard_id: Number(upd.newBillboardId),
          ...(replName ? { replacement_billboard_name: replName } : {}),
        });
      if (upd.id) {
        await query.eq('id', upd.id);
      } else {
        await query.eq('paused_billboard_id', upd.paused_billboard_id);
      }
    } catch (e) {
      console.warn('Failed to self-heal paused_billboard_replacements pointer:', e);
    }
  }

  // Release any stale duplicate replacement boards that are no longer in the contract
  if (reconciled.staleReplacementBillboardIds.length > 0) {
    const staleNums = reconciled.staleReplacementBillboardIds
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0);
    if (staleNums.length > 0) {
      try {
        await supabase
          .from('billboards')
          .update({
            Contract_Number: null,
            Customer_Name: null,
            Ad_Type: null,
            Rent_Start_Date: null,
            Rent_End_Date: null,
            Status: 'متاح',
          } as any)
          .in('ID', staleNums)
          .eq('Contract_Number', contractNumber);
      } catch (e) {
        console.warn('Failed to release stale replacement billboards:', e);
      }
    }
  }

  const { ids, prices } = reconciled;
  const changed =
    JSON.stringify(ids) !== JSON.stringify(originalIds) ||
    JSON.stringify(prices) !== originalPricesJson;

  // Always persist when we cleaned up stale duplicate replacements so DB stays consistent
  if (changed && (persist || reconciled.staleReplacementBillboardIds.length > 0 || reconciled.replacementUpdates.length > 0)) {
    await supabase
      .from('Contract')
      .update({
        billboard_ids: ids.length > 0 ? ids.join(',') : null,
        billboards_count: ids.length,
        billboard_prices: JSON.stringify(prices),
      } as any)
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
