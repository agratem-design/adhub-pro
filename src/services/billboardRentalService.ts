import { supabase } from '@/integrations/supabase/client';

export async function rentalRpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await (supabase as any).rpc(name, args);
  if (error) {
    if (error.code === 'PGRST202') throw new Error('يلزم تطبيق تحديث قاعدة البيانات للتمديد وإدارة اللوحات أولاً.');
    throw new Error(error.message);
  }
  window.dispatchEvent(new CustomEvent('billboard-rental-changed'));
  return data;
}

export function extendBillboardRental(billboardId: number, contractNumber: number, days: number, reason: string, type: string, notes: string, expectedEnd: string) {
  return rentalRpc('extend_billboard_rental_atomic', {
    p_billboard_id: billboardId, p_contract_number: contractNumber, p_days: days,
    p_reason: reason, p_type: type, p_notes: notes, p_expected_end: expectedEnd,
  });
}
