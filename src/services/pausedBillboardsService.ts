// @ts-nocheck
import { supabase } from '@/integrations/supabase/client';
import { autoPauseBillboardFromActiveContract } from './billboardPauseService';

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
}

export async function listPausedBillboards(contractNumber: number): Promise<PausedBillboard[]> {
  const { data, error } = await supabase
    .from('paused_billboards' as any)
    .select('*')
    .eq('contract_number', contractNumber)
    .order('pause_date', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as PausedBillboard[];
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
export async function syncContractIdsWithPaused(contractNumber: number): Promise<string[]> {
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
  const { data: pausedRows } = await supabase
    .from('paused_billboards' as any)
    .select('id, billboard_id')
    .eq('contract_number', contractNumber);
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

  if (changed) {
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
  const { data: existing } = await supabase
    .from('paused_billboards' as any)
    .select('contract_number, billboard_id')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('paused_billboards' as any)
    .delete()
    .eq('id', id);
  if (error) throw error;

  if (existing) {
    const contractNumber = Number((existing as any).contract_number);
    const billboardId = String((existing as any).billboard_id);
    
    // Read contract
    const { data: contract } = await supabase
      .from('Contract')
      .select('billboard_ids')
      .eq('Contract_Number', contractNumber)
      .maybeSingle();
      
    if (contract) {
      const idsStr: string = (contract as any).billboard_ids || '';
      const ids = idsStr ? idsStr.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
      const updatedIds = ids.filter((x) => String(x) !== billboardId);
      
      await supabase
        .from('Contract')
        .update({
          billboard_ids: updatedIds.length > 0 ? updatedIds.join(',') : null
        })
        .eq('Contract_Number', contractNumber);
    }
  }

  try {
    if (typeof window !== 'undefined' && existing) {
      window.dispatchEvent(new CustomEvent('paused-billboards-changed', {
        detail: { contractNumber: Number((existing as any).contract_number), billboardId: Number((existing as any).billboard_id), action: 'removed' }
      }));
    }
  } catch {}
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
  const updatePayload: any = {};
  if (patch.consumed_amount !== undefined) updatePayload.consumed_amount = Number(patch.consumed_amount);
  if (patch.refund_amount !== undefined) updatePayload.refund_amount = Number(patch.refund_amount);
  if (patch.manual_refund !== undefined) {
    updatePayload.manual_refund = patch.manual_refund === null ? null : Number(patch.manual_refund);
  }
  if (patch.pause_date !== undefined) updatePayload.pause_date = patch.pause_date;
  if (patch.full_price !== undefined) updatePayload.full_price = Number(patch.full_price);
  if (patch.price_before_discount !== undefined) updatePayload.price_before_discount = Number(patch.price_before_discount);
  if (patch.net_after_discount !== undefined) updatePayload.net_after_discount = Number(patch.net_after_discount);
  if (patch.notes !== undefined) updatePayload.notes = patch.notes;

  const { data, error } = await supabase
    .from('paused_billboards' as any)
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  try {
    if (typeof window !== 'undefined' && data) {
      window.dispatchEvent(new CustomEvent('paused-billboards-changed', {
        detail: {
          contractNumber: Number((data as any).contract_number),
          billboardId: Number((data as any).billboard_id),
          action: 'updated',
        },
      }));
    }
  } catch {}

  return data as unknown as PausedBillboard;
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
export async function resumePausedBillboard(id: string): Promise<{ contractNumber: number; billboardId: number }> {
  // 1. Read paused record
  const { data: paused, error: pausedErr } = await supabase
    .from('paused_billboards' as any)
    .select('*')
    .eq('id', id)
    .single();
  if (pausedErr || !paused) throw pausedErr || new Error('Paused billboard not found');
  const contractNumber = Number((paused as any).contract_number);
  const billboardId = Number((paused as any).billboard_id);

  // 2. Read billboard + contract
  const { data: bb, error: bbErr } = await supabase
    .from('billboards')
    .select('*')
    .eq('ID', billboardId)
    .single();
  if (bbErr || !bb) throw bbErr || new Error('اللوحة غير موجودة');

  let status = String((bb as any).Status || '').trim();
  let otherContract = (bb as any).Contract_Number;
  if (otherContract && Number(otherContract) !== contractNumber) {
    const today = new Date().toISOString().split('T')[0];
    await autoPauseBillboardFromActiveContract(
      billboardId,
      Number(otherContract),
      today
    );
    // Refresh the billboard status to ensure it is updated
    const { data: updatedBb } = await supabase
      .from('billboards')
      .select('*')
      .eq('ID', billboardId)
      .single();
    if (updatedBb) {
      status = String((updatedBb as any).Status || '').trim();
      otherContract = (updatedBb as any).Contract_Number;
    }
  }
  if (otherContract && Number(otherContract) !== contractNumber) {
    throw new Error('اللوحة محجوزة حالياً في عقد آخر — لا يمكن استئنافها');
  }
  if (status && status !== 'متاح' && Number(otherContract) !== contractNumber) {
    throw new Error('اللوحة غير متاحة للاستئناف');
  }

  const { data: contract, error: cErr } = await supabase
    .from('Contract')
    .select('"Customer Name", "Ad Type", "Contract Date", "End Date", billboard_ids')
    .eq('Contract_Number', contractNumber)
    .single();
  if (cErr || !contract) throw cErr || new Error('العقد غير موجود');

  // 3. Re-attach billboard
  const { error: updBbErr } = await supabase
    .from('billboards')
    .update({
      Contract_Number: contractNumber,
      Customer_Name: (contract as any)['Customer Name'] || null,
      Ad_Type: (contract as any)['Ad Type'] || null,
      Rent_Start_Date: (contract as any)['Contract Date'] || null,
      Rent_End_Date: (contract as any)['End Date'] || null,
      Status: 'مؤجرة',
    })
    .eq('ID', billboardId);
  if (updBbErr) throw updBbErr;

  // 4. Update contract.billboard_ids (add if missing)
  const ids = (contract as any).billboard_ids
    ? String((contract as any).billboard_ids).split(',').map((s: string) => s.trim()).filter(Boolean)
    : [];
  if (!ids.map(String).includes(String(billboardId))) {
    ids.push(String(billboardId));
    await supabase
      .from('Contract')
      .update({ billboard_ids: ids.join(',') })
      .eq('Contract_Number', contractNumber);
  }

  // 5. Delete paused row
  const { error: delErr } = await supabase
    .from('paused_billboards' as any)
    .delete()
    .eq('id', id);
  if (delErr) throw delErr;

  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('paused-billboards-changed', {
        detail: { contractNumber, billboardId, action: 'resumed' },
      }));
    }
  } catch {}

  return { contractNumber, billboardId };
}
