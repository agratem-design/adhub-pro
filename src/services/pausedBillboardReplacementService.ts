// @ts-nocheck
import { supabase } from '@/integrations/supabase/client';

export interface PausedBillboardReplacement {
  id: string;
  paused_billboard_id: string;
  contract_number: number;
  replacement_billboard_id: number;
  replacement_billboard_name: string | null;
  start_date: string;
  end_date: string;
  allocated_amount: number;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export async function getReplacementByPausedId(
  pausedBillboardId: string,
): Promise<PausedBillboardReplacement | null> {
  const { data, error } = await supabase
    .from('paused_billboard_replacements' as any)
    .select('*')
    .eq('paused_billboard_id', pausedBillboardId)
    .maybeSingle();
  if (error) throw error;
  return (data || null) as unknown as PausedBillboardReplacement | null;
}

export async function listReplacementsByContract(
  contractNumber: number,
): Promise<PausedBillboardReplacement[]> {
  const { data, error } = await supabase
    .from('paused_billboard_replacements' as any)
    .select('*')
    .eq('contract_number', contractNumber);
  if (error) throw error;
  return (data || []) as unknown as PausedBillboardReplacement[];
}

export interface CreateReplacementPayload {
  paused_billboard_id: string;
  contract_number: number;
  replacement_billboard_id: number;
  replacement_billboard_name?: string | null;
  start_date: string;
  end_date: string;
  allocated_amount: number;
  notes?: string | null;
  customerName?: string | null;
  adType?: string | null;
}

/**
 * Prepares `paused_billboard_replacements` and `billboards` before calling
 * `replace_paused_billboard_atomic` so that:
 * 1. If a replacement billboard was swapped again (B -> C) leaving `paused_billboard_replacements`
 *    pointing to B while C has `_replacement_of = pauseId`, both B and C are reconciled.
 * 2. The legacy `BILLBOARD_OWNERSHIP_CHANGED` check (`WHERE ID = old_repl.replacement_billboard_id AND Contract_Number = cn`)
 *    never fails when B was already released.
 */
async function preparePauseReplacementForAtomicRpc(pausedBillboardId: string): Promise<{
  contractNumber: number;
  removedBillboardIds: number[];
} | null> {
  if (!pausedBillboardId) return null;
  try {
    const { data: oldRepl } = await supabase
      .from('paused_billboard_replacements' as any)
      .select('id, paused_billboard_id, contract_number, replacement_billboard_id')
      .eq('paused_billboard_id', pausedBillboardId)
      .maybeSingle();
    if (!oldRepl) return null;

    const cn = Number((oldRepl as any).contract_number);
    let targetBoardId = Number((oldRepl as any).replacement_billboard_id);
    const removedIds = new Set<number>();
    if (Number.isFinite(targetBoardId) && targetBoardId > 0) {
      removedIds.add(targetBoardId);
    }

    // Check if Contract.billboard_prices has another board linked via _replacement_of = pausedBillboardId
    const { data: contract } = await supabase
      .from('Contract')
      .select('billboard_ids, billboard_prices')
      .eq('Contract_Number', cn)
      .maybeSingle();

    if (contract) {
      let prices: any[] = [];
      try {
        const raw = (contract as any).billboard_prices;
        if (raw) prices = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(prices)) prices = [];
      } catch {
        prices = [];
      }

      const extraBoardIds: number[] = [];
      for (const p of prices) {
        if (String(p?._replacement_of || '') === String(pausedBillboardId)) {
          const bId = Number(p?.billboardId ?? p?.billboard_id ?? p?.ID ?? p?.id);
          if (Number.isFinite(bId) && bId > 0) {
            removedIds.add(bId);
            if (bId !== targetBoardId) {
              extraBoardIds.push(bId);
            }
          }
        }
      }

      // If another board replaced targetBoardId via chained swap, remove any extra duplicate boards first
      if (extraBoardIds.length > 0) {
        const extraStrSet = new Set(extraBoardIds.map(String));
        const idsStr: string = (contract as any).billboard_ids || '';
        const cleanIds = idsStr
          .split(',')
          .map((s: string) => s.trim())
          .filter((id: string) => id && !extraStrSet.has(id));
        const cleanPrices = prices.filter((p: any) => {
          const bId = String(p?.billboardId ?? p?.billboard_id ?? p?.ID ?? p?.id ?? '').trim();
          return !extraStrSet.has(bId);
        });
        await supabase
          .from('Contract')
          .update({
            billboard_ids: cleanIds.length > 0 ? cleanIds.join(',') : null,
            billboards_count: cleanIds.length,
            billboard_prices: JSON.stringify(cleanPrices),
          } as any)
          .eq('Contract_Number', cn);

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
          .in('ID', extraBoardIds)
          .eq('Contract_Number', cn);
      }
    }

    // Ensure targetBoardId has Contract_Number = cn if it's currently NULL so replace_paused_billboard_atomic won't throw BILLBOARD_OWNERSHIP_CHANGED
    if (Number.isFinite(targetBoardId) && targetBoardId > 0) {
      const { data: bb } = await supabase
        .from('billboards')
        .select('ID, Contract_Number')
        .eq('ID', targetBoardId)
        .maybeSingle();
      if (bb && (bb as any).Contract_Number == null) {
        await supabase
          .from('billboards')
          .update({ Contract_Number: cn } as any)
          .eq('ID', targetBoardId)
          .is('Contract_Number', null);
      }
    }

    return { contractNumber: cn, removedBillboardIds: Array.from(removedIds) };
  } catch (e) {
    console.warn('preparePauseReplacementForAtomicRpc warning:', e);
    return null;
  }
}

async function cancelPendingTasksForRemovedBoards(contractNumber: number, billboardIds: number[]) {
  if (!contractNumber || !billboardIds.length) return;
  try {
    const { data: tasks } = await supabase
      .from('installation_tasks')
      .select('id, task_type, status')
      .eq('contract_id', contractNumber)
      .neq('status', 'completed');
    const taskIds = (tasks || []).map((t: any) => t.id).filter(Boolean);
    if (taskIds.length > 0) {
      await supabase
        .from('installation_task_items')
        .delete()
        .in('task_id', taskIds)
        .in('billboard_id', billboardIds)
        .neq('status', 'completed');
    }
  } catch (e) {
    console.warn('cancelPendingTasksForRemovedBoards warning:', e);
  }
}

export async function createReplacement(payload: CreateReplacementPayload) {
  const prep = await preparePauseReplacementForAtomicRpc(payload.paused_billboard_id);
  const { data, error } = await (supabase as any).rpc('replace_paused_billboard_atomic', {
    p_pause_id: payload.paused_billboard_id, p_replacement_id: payload.replacement_billboard_id,
    p_start: payload.start_date, p_end: payload.end_date, p_amount: payload.allocated_amount,
  });
  if (error) throw error;
  if (prep && prep.removedBillboardIds.length > 0) {
    const oldOnly = prep.removedBillboardIds.filter((id) => id !== Number(payload.replacement_billboard_id));
    await cancelPendingTasksForRemovedBoards(prep.contractNumber, oldOnly);
  }
  window.dispatchEvent(new CustomEvent('paused-billboards-changed', { detail: { ...data, contractNumber: payload.contract_number, action: 'replacement-added' } }));
  return data as PausedBillboardReplacement;
}

/**
 * Add or remove a replacement billboard from Contract.billboard_ids and
 * upsert/remove its entry in Contract.billboard_prices. Uses allocated_amount
 * as the fixed price so totals match the remaining value of the paused board.
 */
export async function syncContractForReplacement(
  contractNumber: number,
  opts: {
    addId?: number;
    removeId?: number;
    allocated_amount?: number;
    replacement_of_paused_id?: string;
  },
) {
  const { data: contract } = await supabase
    .from('Contract')
    .select('billboard_ids, billboard_prices')
    .eq('Contract_Number', contractNumber)
    .single();
  if (!contract) return;

  const idsStr: string = (contract as any).billboard_ids || '';
  let ids = idsStr ? idsStr.split(',').map((s: string) => s.trim()).filter(Boolean) : [];

  let prices: any[] = [];
  try {
    const raw = (contract as any).billboard_prices;
    if (raw) prices = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(prices)) prices = [];
  } catch {
    prices = [];
  }

  if (opts.addId) {
    const idStr = String(opts.addId);
    if (!ids.includes(idStr)) ids.push(idStr);
    const amount = Number(opts.allocated_amount) || 0;
    const idx = prices.findIndex(
      (p: any) => String(p.billboardId ?? p.billboard_id ?? p.ID ?? p.id ?? '') === idStr,
    );
    const entry: any = {
      billboardId: idStr,
      basePriceBeforeDiscount: amount,
      priceBeforeDiscount: amount,
      discountPerBillboard: 0,
      priceAfterDiscount: amount,
      contractPrice: amount,
      finalPrice: amount,
      printCost: 0,
      installationCost: 0,
      totalBillboardPrice: amount,
      _replacement_of: opts.replacement_of_paused_id || null,
    };
    if (idx >= 0) prices[idx] = { ...prices[idx], ...entry };
    else prices.push(entry);
  }

  if (opts.removeId) {
    const idStr = String(opts.removeId);
    ids = ids.filter((x: string) => x !== idStr);
    prices = prices.filter(
      (p: any) => String(p.billboardId ?? p.billboard_id ?? p.ID ?? p.id ?? '') !== idStr,
    );
  }

  await supabase
    .from('Contract')
    .update({
      billboard_ids: ids.length > 0 ? ids.join(',') : null,
      billboard_prices: JSON.stringify(prices),
    })
    .eq('Contract_Number', contractNumber);
}

export async function removeReplacementByPauseId(pausedBillboardId: string) {
  const prep = await preparePauseReplacementForAtomicRpc(pausedBillboardId);
  const { data, error } = await (supabase as any).rpc('replace_paused_billboard_atomic', {
    p_pause_id: pausedBillboardId, p_replacement_id: null, p_start: null, p_end: null, p_amount: null,
  });
  if (error) throw error;
  if (prep && prep.removedBillboardIds.length > 0) {
    await cancelPendingTasksForRemovedBoards(prep.contractNumber, prep.removedBillboardIds);
  }
  window.dispatchEvent(new CustomEvent('paused-billboards-changed', {
    detail: { ...data, contractNumber: prep?.contractNumber ?? data?.contractNumber, action: 'replacement-removed' },
  }));
  return data;
}

export async function removeReplacement(id: string) {
  const { data: row, error: readError } = await supabase
    .from('paused_billboard_replacements' as any)
    .select('paused_billboard_id')
    .eq('id', id)
    .single();
  if (readError) throw readError;
  return removeReplacementByPauseId(String((row as any).paused_billboard_id));
}
