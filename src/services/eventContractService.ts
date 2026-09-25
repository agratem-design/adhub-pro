// @ts-nocheck
import { rentalRpc } from '@/services/billboardRentalService';
import { supabase } from '@/integrations/supabase/client';

export interface EventContract {
  id: string;
  event_contract_number: string;
  customer_id?: string | null;
  customer_name: string;
  event_name: string;
  event_type?: string | null;
  start_date: string;
  end_date: string;
  total_amount: number;
  paid_amount: number;
  discount_amount: number;
  notes?: string | null;
  status: 'active' | 'completed' | 'cancelled';
  created_at?: string;
}

export interface EventContractBillboard {
  id?: string;
  event_contract_id?: string;
  billboard_id: string;
  billboard_name?: string | null;
  compensate_original?: boolean;
  daily_price: number;
  total_price: number;
}

export async function listEventContracts() {
  const { data, error } = await supabase
    .from('event_contracts' as any)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const contracts = (data || []) as unknown as EventContract[];
  if (!contracts.length) return contracts;
  const { data: rows } = await supabase
    .from('event_contract_billboards' as any)
    .select('event_contract_id')
    .in('event_contract_id', contracts.map((c) => c.id));
  const counts = new Map<string, number>();
  (rows || []).forEach((row: any) => counts.set(row.event_contract_id, (counts.get(row.event_contract_id) || 0) + 1));
  return contracts.map((contract: any) => ({ ...contract, billboard_count: counts.get(contract.id) || 0 }));
}

export async function getEventContract(id: string) {
  const { data: contract, error } = await supabase
    .from('event_contracts' as any)
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  const { data: bbs } = await supabase
    .from('event_contract_billboards' as any)
    .select('*')
    .eq('event_contract_id', id);
  return { contract: contract as unknown as EventContract, billboards: (bbs || []) as unknown as EventContractBillboard[] };
}

export async function createEventContract(payload: {
  customer_id?: string | null;
  customer_name: string;
  event_name: string;
  event_type?: string;
  start_date: string;
  end_date: string;
  total_amount: number;
  discount_amount?: number;
  notes?: string;
  billboards: EventContractBillboard[];
}) {
  return rentalRpc('save_event_rental_atomic', { p_id: null, p_payload: payload }) as Promise<EventContract>;
}

export async function updateEventContract(id: string, patch: Partial<EventContract> & { billboards?: EventContractBillboard[] }) {
  if (patch.billboards) {
    return rentalRpc('save_event_rental_atomic', { p_id: id, p_payload: patch });
  }
  const { error } = await supabase.from('event_contracts' as any).update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteEventContract(id: string) {
  const { error } = await supabase.from('event_contracts' as any).delete().eq('id', id);
  if (error) throw error;
}

/**
 * Returns the set of billboard_ids reserved (in event system only) overlapping the given date range.
 * Independent from regular Contract occupancy.
 */
export async function getReservedEventBillboardIds(startDate: string, endDate: string, excludeContractId?: string) {
  let query = supabase
    .from('event_billboard_reservations' as any)
    .select('billboard_id, event_contract_id, start_date, end_date, status')
    .eq('status', 'active')
    .lte('start_date', endDate)
    .gte('end_date', startDate);
  const { data, error } = await query;
  if (error) throw error;
  const ids = new Set<string>();
  (data || []).forEach((r: any) => {
    if (excludeContractId && r.event_contract_id === excludeContractId) return;
    ids.add(String(r.billboard_id));
  });
  return ids;
}
