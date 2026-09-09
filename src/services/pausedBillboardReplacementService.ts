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
  const { data, error } = await (supabase as any).rpc('replace_paused_billboard_atomic', {
    p_pause_id: payload.paused_billboard_id, p_replacement_id: payload.replacement_billboard_id,
    p_start: payload.start_date, p_end: payload.end_date, p_amount: payload.allocated_amount,
  });
  if (error) throw error;
  window.dispatchEvent(new CustomEvent('paused-billboards-changed', { detail: { ...data, action: 'replacement-added' } }));
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

export async function removeReplacement(id: string) {
  const { data: row, error: readError } = await supabase.from('paused_billboard_replacements' as any).select('paused_billboard_id').eq('id',id).single();
  if (readError) throw readError;
  const { data, error } = await (supabase as any).rpc('replace_paused_billboard_atomic', {
    p_pause_id: (row as any).paused_billboard_id, p_replacement_id: null, p_start: null, p_end: null, p_amount: null,
  });
  if (error) throw error;
  window.dispatchEvent(new CustomEvent('paused-billboards-changed', { detail: { ...data, action: 'replacement-removed' } }));
}
