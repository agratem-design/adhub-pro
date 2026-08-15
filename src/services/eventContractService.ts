// @ts-nocheck
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
  daily_price: number;
  total_price: number;
}

export async function listEventContracts() {
  const { data, error } = await supabase
    .from('event_contracts' as any)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as EventContract[];
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
  const { data: contract, error } = await supabase
    .from('event_contracts' as any)
    .insert({
      customer_id: payload.customer_id || null,
      customer_name: payload.customer_name,
      event_name: payload.event_name,
      event_type: payload.event_type || null,
      start_date: payload.start_date,
      end_date: payload.end_date,
      total_amount: payload.total_amount,
      discount_amount: payload.discount_amount || 0,
      notes: payload.notes || null,
    })
    .select()
    .single();
  if (error) throw error;

  const contractId = (contract as any).id;
  if (payload.billboards.length > 0) {
    const rows = payload.billboards.map(b => ({
      event_contract_id: contractId,
      billboard_id: b.billboard_id,
      billboard_name: b.billboard_name || null,
      daily_price: b.daily_price,
      total_price: b.total_price,
    }));
    const { error: bbErr } = await supabase.from('event_contract_billboards' as any).insert(rows);
    if (bbErr) throw bbErr;

    const reservations = payload.billboards.map(b => ({
      event_contract_id: contractId,
      billboard_id: b.billboard_id,
      start_date: payload.start_date,
      end_date: payload.end_date,
      status: 'active',
    }));
    await supabase.from('event_billboard_reservations' as any).insert(reservations);
  }

  return contract as unknown as EventContract;
}

export async function updateEventContract(id: string, patch: Partial<EventContract> & { billboards?: EventContractBillboard[] }) {
  const { billboards, ...rest } = patch as any;
  const { error } = await supabase.from('event_contracts' as any).update(rest).eq('id', id);
  if (error) throw error;

  if (billboards) {
    await supabase.from('event_contract_billboards' as any).delete().eq('event_contract_id', id);
    await supabase.from('event_billboard_reservations' as any).delete().eq('event_contract_id', id);

    if (billboards.length > 0) {
      const rows = billboards.map((b: EventContractBillboard) => ({
        event_contract_id: id,
        billboard_id: b.billboard_id,
        billboard_name: b.billboard_name || null,
        daily_price: b.daily_price,
        total_price: b.total_price,
      }));
      await supabase.from('event_contract_billboards' as any).insert(rows);

      const start = (rest as any).start_date;
      const end = (rest as any).end_date;
      if (start && end) {
        const reservations = billboards.map((b: EventContractBillboard) => ({
          event_contract_id: id,
          billboard_id: b.billboard_id,
          start_date: start,
          end_date: end,
          status: 'active',
        }));
        await supabase.from('event_billboard_reservations' as any).insert(reservations);
      }
    }
  }
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
