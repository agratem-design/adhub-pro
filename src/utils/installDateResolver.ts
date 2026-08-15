// @ts-nocheck
import { supabase } from '@/integrations/supabase/client';

/**
 * Returns a map of billboard_id (string) -> latest installation date (YYYY-MM-DD)
 * for the given contract, sourced from installation_task_items in current contract.
 *
 * Picks the most recent installation_date when present, otherwise completed_at.
 * Billboards without any task item are omitted from the map.
 */
export async function resolveInstallDatesForContract(
  contractNumber: number | string | null | undefined
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const cn = Number(contractNumber);
  if (!cn || isNaN(cn)) return map;
  try {
    const { data: tasks } = await supabase
      .from('installation_tasks')
      .select('id')
      .eq('contract_id', cn);
    const taskIds = (tasks || []).map((t: any) => t.id);
    if (taskIds.length === 0) return map;
    const { data: items } = await supabase
      .from('installation_task_items')
      .select('billboard_id, installation_date, completed_at')
      .in('task_id', taskIds);
    (items || []).forEach((it: any) => {
      const key = String(it.billboard_id);
      const dateRaw = it.installation_date || it.completed_at;
      if (!dateRaw) return;
      const d = new Date(dateRaw);
      if (isNaN(d.getTime())) return;
      const iso = d.toISOString().split('T')[0];
      const existing = map.get(key);
      if (!existing || iso > existing) map.set(key, iso);
    });
  } catch (e) {
    console.warn('resolveInstallDatesForContract failed:', e);
  }
  return map;
}
