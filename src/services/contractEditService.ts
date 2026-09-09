import { supabase } from '@/integrations/supabase/client';

type RpcError = { message?: string; code?: string };
type RpcResult = { data: unknown; error: RpcError | null };
type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => Promise<RpcResult> };
const rpcClient = supabase as unknown as RpcClient;
export type PauseAtomicResult = { success: boolean; pauseRefund: number; newBillboardIds: string[]; pauseId?: string };

/** No client-side fallback: a partial financial save is never a successful save. */
export async function saveContractEditAtomic(contractNumber: string, updates: Record<string, unknown>, revision: number, taskTypes: Record<string, boolean> = {}) {
  const { data, error } = await rpcClient.rpc('save_contract_edit_atomic', {
    p_contract_number: Number(contractNumber), p_updates: updates,
    p_expected_revision: revision, p_task_types: taskTypes,
  });
  if (error) {
    if (error.message?.includes('CONTRACT_VERSION_CONFLICT')) throw new Error('تغيّر العقد منذ فتح الصفحة. أعد تحميله قبل الحفظ.');
    if (error.code === 'PGRST202') throw new Error('يلزم تطبيق تحديث قاعدة البيانات الخاص بحفظ العقود قبل استخدام الحفظ الجديد.');
    throw new Error(error.message || error.code || 'فشل حفظ التعديلات');
  }
  return data;
}

export async function executePauseAtomic(contractNumber: number, billboardId: number, pauseDate: string, notes = '', refund: number | null = null, expectedRevision?: number): Promise<PauseAtomicResult> {
  const { data, error } = await rpcClient.rpc('pause_contract_billboard_atomic', {
    p_contract_number: contractNumber, p_billboard_id: billboardId,
    p_pause_date: pauseDate, p_notes: notes, p_manual_refund: refund, p_expected_revision: expectedRevision ?? null,
  });
  if (error) throw error;
  window.dispatchEvent(new CustomEvent('paused-billboards-changed', { detail: { contractNumber, billboardId, action: 'paused' } }));
  return data as PauseAtomicResult;
}
