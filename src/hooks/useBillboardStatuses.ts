import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type BillboardStatusType = 'torn_ad' | 'size_changed' | 'removed';

export interface BillboardStatus {
  id: string;
  billboard_id: number;
  contract_number: number | null;
  status_type: BillboardStatusType;
  note: string | null;
  old_size: string | null;
  new_size: string | null;
  is_resolved: boolean;
  created_at: string;
  updated_at: string;
}

export const STATUS_LABELS: Record<BillboardStatusType, string> = {
  torn_ad: 'إعلان ممزق',
  size_changed: 'تغيير المقاس',
  removed: 'تمت الإزالة',
};

const QK = (ids: (number | string)[]) => ['billboard-statuses', ids.slice().sort().join(',')];

export function useBillboardStatuses(billboardIds: (number | string)[], opts?: { includeResolved?: boolean }) {
  const qc = useQueryClient();
  const ids = (billboardIds || []).map((x) => Number(x)).filter((n) => !!n && !Number.isNaN(n));
  const includeResolved = !!opts?.includeResolved;

  const query = useQuery({
    queryKey: [...QK(ids), { includeResolved }],
    enabled: ids.length > 0,
    queryFn: async () => {
      let q = supabase
        .from('billboard_statuses' as any)
        .select('*')
        .in('billboard_id', ids)
        .order('created_at', { ascending: false });
      if (!includeResolved) q = q.eq('is_resolved', false);
      const { data, error } = await q;
      if (error) throw error;
      const map: Record<number, BillboardStatus[]> = {};
      (data as any as BillboardStatus[] || []).forEach((s) => {
        (map[s.billboard_id] ||= []).push(s);
      });
      return map;
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['billboard-statuses'] });

  const add = useMutation({
    mutationFn: async (payload: Partial<BillboardStatus> & { billboard_id: number; status_type: BillboardStatusType }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('billboard_statuses' as any)
        .insert({ ...payload, created_by: u.user?.id || null });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('تم تسجيل الحالة'); },
    onError: (e: any) => toast.error(e?.message || 'فشل حفظ الحالة'),
  });

  const update = useMutation({
    mutationFn: async (payload: { id: string; note?: string | null; is_resolved?: boolean }) => {
      const { id, ...rest } = payload;
      const { error } = await supabase.from('billboard_statuses' as any).update(rest).eq('id', id);
      if (error) throw error;
    },
    onMutate: async (payload) => {
      // Optimistic update: patch all matching caches without refetching
      const queries = qc.getQueriesData<Record<number, BillboardStatus[]>>({ queryKey: ['billboard-statuses'] });
      queries.forEach(([key, data]) => {
        if (!data) return;
        const next: Record<number, BillboardStatus[]> = {};
        let changed = false;
        for (const bid in data) {
          next[bid] = data[bid].map((s) => {
            if (s.id === payload.id) {
              changed = true;
              return { ...s, ...payload } as BillboardStatus;
            }
            return s;
          });
        }
        if (changed) qc.setQueryData(key, next);
      });
    },
    onError: (e: any) => toast.error(e?.message || 'فشل تحديث الحالة'),
  });

  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('billboard_statuses' as any)
        .update({ is_resolved: true, resolved_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('تم إنهاء الحالة'); },
    onError: (e: any) => toast.error(e?.message || 'فشل'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('billboard_statuses' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('تم حذف الحالة'); },
    onError: (e: any) => toast.error(e?.message || 'فشل الحذف'),
  });

  /** Resolve all active statuses of a given type for a list of billboard ids. */
  const resolveByType = async (billboardIds: number[], type: BillboardStatusType) => {
    if (!billboardIds.length) return;
    const { error } = await supabase
      .from('billboard_statuses' as any)
      .update({ is_resolved: true, resolved_at: new Date().toISOString() })
      .in('billboard_id', billboardIds)
      .eq('status_type', type)
      .eq('is_resolved', false);
    if (error) console.error(error);
    invalidate();
  };

  return {
    statusesByBillboard: query.data || {},
    isLoading: query.isLoading,
    refetch: query.refetch,
    add: add.mutateAsync,
    update: update.mutateAsync,
    resolve: resolve.mutateAsync,
    remove: remove.mutateAsync,
    resolveByType,
  };
}

/** Fetch ALL active (unresolved) billboard statuses across the system, mapped by billboard_id. */
export function useAllActiveBillboardStatuses() {
  const qc = useQueryClient();
  useEffect(() => {
    const handler = () => qc.invalidateQueries({ queryKey: ['billboard-statuses'] });
    window.addEventListener('billboard-statuses-changed', handler);
    return () => window.removeEventListener('billboard-statuses-changed', handler);
  }, [qc]);
  return useQuery({
    queryKey: ['billboard-statuses', 'all-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billboard_statuses' as any)
        .select('*')
        .eq('is_resolved', false);
      if (error) throw error;
      const map: Record<number, BillboardStatus[]> = {};
      ((data as any as BillboardStatus[]) || []).forEach((s) => {
        (map[s.billboard_id] ||= []).push(s);
      });
      return map;
    },
    staleTime: 60_000,
  });
}
