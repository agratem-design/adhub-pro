import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BillboardLoan {
  id: string;
  source_contract_number: number;
  target_contract_number: number;
  billboard_id: number;
  loan_days: number;
  compensation_days: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'returned' | 'expired' | 'cancelled';
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

/** Fetch all active loans (cached). */
export function useActiveBillboardLoans() {
  return useQuery({
    queryKey: ['billboard-loans', 'active'],
    queryFn: async (): Promise<BillboardLoan[]> => {
      const { data, error } = await supabase
        .from('billboard_loans' as any)
        .select('*')
        .eq('status', 'active');
      if (error) throw error;
      return (data || []) as any;
    },
    staleTime: 60_000,
  });
}

/** Map billboardId(string) -> active loan (if any). */
export function useActiveLoansByBillboard() {
  const q = useActiveBillboardLoans();
  const map = new Map<string, BillboardLoan>();
  (q.data || []).forEach((l) => map.set(String(l.billboard_id), l));
  return { ...q, map };
}

export async function createBillboardLoan(payload: {
  source_contract_number: number;
  target_contract_number: number;
  billboard_id: number;
  loan_days: number;
  start_date: string;
  end_date: string;
  notes?: string;
}) {
  // 1. Insert loan record
  const { data: loan, error } = await supabase
    .from('billboard_loans' as any)
    .insert([{ ...payload, compensation_days: payload.loan_days, status: 'active' }])
    .select()
    .single();
  if (error) throw error;

  // 2. Extend billboard's Rent_End_Date by loan_days (compensation to source contract)
  const { data: bb, error: bbErr } = await supabase
    .from('billboards')
    .select('Rent_End_Date')
    .eq('ID', payload.billboard_id)
    .single();
  if (bbErr) throw bbErr;

  const currentEnd = bb?.Rent_End_Date ? new Date(bb.Rent_End_Date as any) : new Date(payload.end_date);
  currentEnd.setDate(currentEnd.getDate() + payload.loan_days);
  const newEnd = currentEnd.toISOString().slice(0, 10);

  const { error: updErr } = await supabase
    .from('billboards')
    .update({ Rent_End_Date: newEnd } as any)
    .eq('ID', payload.billboard_id);
  if (updErr) throw updErr;

  return loan;
}
