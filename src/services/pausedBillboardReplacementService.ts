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

export async function createReplacement(payload: CreateReplacementPayload) {
  // Upsert: if a replacement exists for this paused row, replace it (free old billboard first).
  const existing = await getReplacementByPausedId(payload.paused_billboard_id);
  if (existing) {
    await removeReplacement(existing.id);
  }

  const { data, error } = await supabase
    .from('paused_billboard_replacements' as any)
    .insert({
      paused_billboard_id: payload.paused_billboard_id,
      contract_number: payload.contract_number,
      replacement_billboard_id: payload.replacement_billboard_id,
      replacement_billboard_name: payload.replacement_billboard_name || null,
      start_date: payload.start_date,
      end_date: payload.end_date,
      allocated_amount: Number(payload.allocated_amount) || 0,
    });
  if (error) throw error;

  // Mark the paused billboard row as having 0 refund because it has been replaced
  try {
    await supabase
      .from('paused_billboards' as any)
      .update({
        refund_amount: 0,
        deducted_from_contract: false,
      })
      .eq('id', payload.paused_billboard_id);
  } catch (e) {
    console.warn('Failed to update paused_billboard refund_amount:', e);
  }

  // Attach replacement billboard to the contract (status only — kept separate from main billboard_ids).
  try {
    await supabase
      .from('billboards')
      .update({
        Contract_Number: payload.contract_number,
        Customer_Name: payload.customerName || null,
        Ad_Type: payload.adType || null,
        Rent_Start_Date: payload.start_date,
        Rent_End_Date: payload.end_date,
        Status: 'مؤجرة',
      })
      .eq('ID', payload.replacement_billboard_id);
  } catch (e) {
    console.warn('Failed to update replacement billboard status:', e);
  }

  // Sync Contract.billboard_ids + billboard_prices so the replacement
  // appears in "Selected Billboards" with its allocated amount as price.
  try {
    await syncContractForReplacement(payload.contract_number, {
      addId: payload.replacement_billboard_id,
      allocated_amount: Number(payload.allocated_amount) || 0,
      replacement_of_paused_id: payload.paused_billboard_id,
    });
  } catch (e) {
    console.warn('Failed to sync contract for replacement:', e);
  }

  try {
    window.dispatchEvent(
      new CustomEvent('paused-billboards-changed', {
        detail: { contractNumber: payload.contract_number, action: 'replacement-added' },
      }),
    );
  } catch {}

  return data as unknown as PausedBillboardReplacement;
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

export async function removeReplacement(id: string) {
  // Free the billboard
  const { data: row } = await supabase
    .from('paused_billboard_replacements' as any)
    .select('replacement_billboard_id, contract_number')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('paused_billboard_replacements' as any)
    .delete()
    .eq('id', id);
  if (error) throw error;

  if (row?.replacement_billboard_id) {
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
        })
        .eq('ID', row.replacement_billboard_id);
    } catch (e) {
      console.warn('Failed to free replacement billboard:', e);
    }

    // Remove from Contract.billboard_ids + billboard_prices
    try {
      if (row.contract_number) {
        await syncContractForReplacement(Number(row.contract_number), {
          removeId: Number(row.replacement_billboard_id),
        });
      }
    } catch (e) {
      console.warn('Failed to sync contract for replacement removal:', e);
    }
  }

  try {
    window.dispatchEvent(
      new CustomEvent('paused-billboards-changed', {
        detail: { contractNumber: Number(row?.contract_number || 0), action: 'replacement-removed' },
      }),
    );
  } catch {}
}
