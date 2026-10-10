import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Check, FileText, Image as ImageIcon, Loader2, MapPin, Plus, Search, X } from 'lucide-react';
import ImageLightbox from '@/components/Map/ImageLightbox';
import { cn } from '@/lib/utils';
import { sortBillboardsStandardSync } from '@/lib/billboardSorter';
import { parseContractBillboardIds } from '@/lib/compositeTaskContractIdentity';
import { assignBillboardsToContracts, syncInstallationTaskContracts } from '@/services/installationTaskContracts';

interface AddBillboardsToTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  contractId: number;
  contractIds?: number[];
  existingBillboardIds: number[];
  customerName?: string;
  onSuccess: () => void;
}

/** إضافة لوحات ناقصة لمهمة تركيب من أي عقد للزبون نفسه، مع تحديث عقود المهمة واسمها تلقائياً */
export function AddBillboardsToTaskDialog({
  open, onOpenChange, taskId, contractId, contractIds = [], existingBillboardIds, customerName, onSuccess,
}: AddBillboardsToTaskDialogProps) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [activeContract, setActiveContract] = useState<number | 'all'>('all');
  const [zoomed, setZoomed] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setSelectedIds([]); setSearch(''); setActiveContract('all'); }
  }, [open]);

  // عقود الزبون كلها (بالمعرّف، ثم بالاسم كاحتياط)
  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ['add-to-task-customer-contracts', contractId, customerName],
    enabled: open && !!(contractId || customerName),
    queryFn: async () => {
      const cols = 'Contract_Number, "Customer Name", "Ad Type", "Contract Date", "End Date", billboard_ids, customer_id';
      const { data: main } = contractId
        ? await supabase.from('Contract').select(cols).eq('Contract_Number', contractId).maybeSingle()
        : { data: null as any };
      const custId = (main as any)?.customer_id;
      const name = customerName || (main as any)?.['Customer Name'];
      const q = supabase.from('Contract').select(cols);
      const { data, error } = custId ? await q.eq('customer_id', custId) : await q.eq('Customer Name', name);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const contractNumbers = useMemo(() => contracts.map(c => Number(c.Contract_Number)), [contracts]);

  const { data: pausedRows = [] } = useQuery({
    queryKey: ['add-to-task-paused', contractNumbers.join(',')],
    enabled: open && contractNumbers.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('paused_billboards' as any).select('billboard_id, contract_number').in('contract_number', contractNumbers);
      return (data || []) as any[];
    },
  });

  // اللوحات المرشحة: لوحات العقود + الموقوفة، ناقص الموجودة في المهمة
  const candidateIds = useMemo(() => {
    const ids = new Set<number>();
    contracts.forEach(c => parseContractBillboardIds(c.billboard_ids).forEach(id => ids.add(id)));
    pausedRows.forEach(r => r.billboard_id && ids.add(Number(r.billboard_id)));
    existingBillboardIds.forEach(id => ids.delete(Number(id)));
    return [...ids];
  }, [contracts, pausedRows, existingBillboardIds]);
  const pausedSet = useMemo(() => new Set(pausedRows.map(r => Number(r.billboard_id))), [pausedRows]);

  const { data: billboards = [], isLoading: loadingBoards } = useQuery({
    queryKey: ['add-to-task-billboards', candidateIds.join(',')],
    enabled: open && candidateIds.length > 0,
    queryFn: async () => {
      const all: any[] = [];
      for (let i = 0; i < candidateIds.length; i += 100) {
        const { data, error } = await supabase
          .from('billboards')
          .select('ID, Billboard_Name, Size, Level, Faces_Count, District, Nearest_Landmark, Image_URL, design_face_a, design_face_b, Municipality')
          .in('ID', candidateIds.slice(i, i + 100));
        if (error) throw error;
        all.push(...(data || []));
      }
      return all;
    },
  });

  // كل لوحة تُنسب لعقد واحد (عقود المهمة أولاً، ثم الساري اليوم، ثم الأحدث)
  const taskContracts = useMemo(() => [...new Set([Number(contractId), ...contractIds.map(Number)].filter(Boolean))], [contractId, contractIds]);
  const contractOf = useMemo(() => {
    const pausedAsContracts = pausedRows.map(r => ({ Contract_Number: r.contract_number, billboard_ids: String(r.billboard_id) }));
    const { byContract } = assignBillboardsToContracts(
      billboards.map(b => Number(b.ID)),
      [...contracts, ...pausedAsContracts] as any,
      taskContracts,
      new Date().toISOString(),
    );
    const m = new Map<number, number>();
    byContract.forEach((ids, cid) => ids.forEach(id => m.set(id, cid)));
    return m;
  }, [billboards, contracts, pausedRows, taskContracts]);

  const groups = useMemo(() => {
    return contracts
      .map(c => {
        const cid = Number(c.Contract_Number);
        return {
          contractId: cid,
          adType: c['Ad Type'] || '',
          contractDate: String(c['Contract Date'] || '').slice(0, 10),
          isTaskContract: taskContracts.includes(cid),
          boards: sortBillboardsStandardSync(billboards.filter(b => contractOf.get(Number(b.ID)) === cid)),
        };
      })
      .filter(g => g.boards.length > 0)
      .sort((a, b) => Number(b.isTaskContract) - Number(a.isTaskContract) || b.contractId - a.contractId);
  }, [contracts, billboards, contractOf, taskContracts]);

  const q = search.trim().toLowerCase();
  const matches = (b: any) => !q || [b.Billboard_Name, b.ID, b.Nearest_Landmark, b.Municipality, b.District, b.Size].some(v => String(v ?? '').toLowerCase().includes(q));
  const visibleGroups = groups
    .filter(g => activeContract === 'all' || g.contractId === activeContract)
    .map(g => ({ ...g, boards: g.boards.filter(matches) }))
    .filter(g => g.boards.length > 0);

  const toggle = (id: number) => setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleGroup = (ids: number[]) => {
    const all = ids.every(id => selectedIds.includes(id));
    setSelectedIds(p => all ? p.filter(id => !ids.includes(id)) : [...new Set([...p, ...ids])]);
  };
  const selectedByContract = (cid: number) => selectedIds.filter(id => contractOf.get(id) === cid).length;
  const newContracts = [...new Set(selectedIds.map(id => contractOf.get(id)).filter((c): c is number => !!c && !taskContracts.includes(c)))];

  const addMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const faces = new Map(billboards.map(b => [Number(b.ID), Number(b.Faces_Count) || 2]));
      const { error } = await supabase.from('installation_task_items').insert(ids.map(id => ({
        task_id: taskId, billboard_id: id, status: 'pending', customer_installation_cost: 0, faces_to_install: faces.get(id) || 2,
      })));
      if (error) throw error;
      await syncInstallationTaskContracts(taskId);
    },
    onSuccess: (_d, ids) => {
      toast.success(`أُضيفت ${ids.length} لوحة للمهمة${newContracts.length ? ` — وأُضيف ${newContracts.length === 1 ? 'عقد' : 'عقود'} #${newContracts.join('، #')} للمهمة` : ''}`);
      queryClient.invalidateQueries({ queryKey: ['installation-task-items'] });
      queryClient.invalidateQueries({ queryKey: ['installation-tasks'] });
      setSelectedIds([]);
      onSuccess();
      onOpenChange(false);
    },
    onError: () => toast.error('فشل إضافة اللوحات'),
  });

  const loading = loadingContracts || loadingBoards;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[88vh] max-w-5xl flex-col gap-0 overflow-hidden p-0" dir="rtl">
          <DialogHeader className="border-b border-border px-5 py-4 text-right">
            <DialogTitle className="text-base">إضافة لوحات للمهمة</DialogTitle>
            <DialogDescription className="text-xs">
              {customerName || contracts[0]?.['Customer Name'] || ''} · اختر من أي عقد للزبون. اللوحات من عقد جديد تجعل المهمة مجمعة لعدة عقود.
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 md:grid-cols-[230px_minmax(0,1fr)]">
            {/* العقود */}
            <nav aria-label="عقود الزبون" className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-border p-3 md:flex-col md:overflow-y-auto md:border-b-0 md:border-l">
              <button type="button" onClick={() => setActiveContract('all')}
                className={cn('shrink-0 rounded-lg px-3 py-2 text-right text-sm', activeContract === 'all' ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-muted')}>
                كل العقود <span className="text-xs text-muted-foreground">({groups.reduce((s, g) => s + g.boards.length, 0)})</span>
              </button>
              {groups.map(g => {
                const sel = selectedByContract(g.contractId);
                return (
                  <button key={g.contractId} type="button" onClick={() => setActiveContract(g.contractId)}
                    className={cn('shrink-0 rounded-lg px-3 py-2 text-right md:w-full', activeContract === g.contractId ? 'bg-primary/10 ring-1 ring-primary/40' : 'hover:bg-muted')}>
                    <span className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-bold tabular-nums">#{g.contractId}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{sel ? <b className="text-primary">{sel}/</b> : null}{g.boards.length}</span>
                    </span>
                    <span className="block max-w-[180px] truncate text-xs text-muted-foreground">{g.adType || '—'}</span>
                    {g.isTaskContract && <span className="mt-1 inline-block rounded bg-primary/15 px-1.5 text-xs text-primary">في المهمة</span>}
                  </button>
                );
              })}
            </nav>

            {/* اللوحات */}
            <div className="flex min-h-0 flex-col">
              <div className="border-b border-border p-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الرقم أو الموقع..." className="h-10 pr-9" />
                  {search && <button type="button" onClick={() => setSearch('')} className="absolute left-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground" aria-label="مسح"><X className="h-3.5 w-3.5" /></button>}
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
                {loading ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />جارٍ التحميل...</div>
                ) : visibleGroups.length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">{q ? 'لا توجد نتائج مطابقة' : 'كل لوحات عقود الزبون موجودة في المهمة'}</p>
                ) : visibleGroups.map(g => {
                  const ids = g.boards.map((b: any) => Number(b.ID));
                  const allSel = ids.every(id => selectedIds.includes(id));
                  return (
                    <section key={g.contractId} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-bold">عقد #{g.contractId}</h3>
                        <span className="truncate text-xs text-muted-foreground">{g.adType}{g.contractDate ? ` · ${g.contractDate}` : ''}</span>
                        <Button variant="ghost" size="sm" className="mr-auto h-7 px-2 text-xs" onClick={() => toggleGroup(ids)}>{allSel ? 'إلغاء الكل' : 'تحديد الكل'}</Button>
                      </div>
                      <ul className="grid gap-2 lg:grid-cols-2">
                        {g.boards.map((b: any) => {
                          const id = Number(b.ID);
                          const on = selectedIds.includes(id);
                          const img = b.design_face_a || b.Image_URL;
                          return (
                            <li key={id}>
                              <div role="checkbox" aria-checked={on} tabIndex={0}
                                onClick={() => toggle(id)} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(id); } }}
                                className={cn('flex cursor-pointer items-center gap-3 rounded-lg border p-2 transition-colors', on ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40')}>
                                <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded border', on ? 'border-primary bg-primary text-primary-foreground' : 'border-input')}>
                                  {on && <Check className="h-3.5 w-3.5" />}
                                </span>
                                <button type="button" onClick={e => { e.stopPropagation(); img && setZoomed(img); }}
                                  className="h-12 w-16 shrink-0 overflow-hidden rounded-md bg-muted" aria-label="تكبير الصورة">
                                  {img ? <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" /> : <ImageIcon className="m-auto mt-3 h-5 w-5 text-muted-foreground/50" />}
                                </button>
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                                    <span className="truncate">{b.Billboard_Name || `#${id}`}</span>
                                    <span className="rounded bg-muted px-1.5 text-xs font-bold" dir="ltr">{b.Size}</span>
                                    {pausedSet.has(id) && <span className="rounded bg-amber-500/15 px-1.5 text-xs text-amber-500">موقوفة</span>}
                                  </span>
                                  <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                                    <MapPin className="h-3 w-3 shrink-0" />{[b.Nearest_Landmark, b.Municipality].filter(Boolean).join(' · ') || '—'}
                                  </span>
                                </span>
                                <span className="shrink-0 text-xs text-muted-foreground">{b.Faces_Count || 1} وجه</span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })}
              </div>
            </div>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-5 py-3">
            <div className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{selectedIds.length}</span> لوحة محددة
              {newContracts.length > 0 && <span className="mr-2 text-orange-500">· ستُضاف للمهمة عقود: #{newContracts.join('، #')}</span>}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>إلغاء</Button>
              <Button onClick={() => addMutation.mutate(selectedIds)} disabled={!selectedIds.length || addMutation.isPending} className="gap-1.5">
                {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                إضافة {selectedIds.length || ''} لوحة
              </Button>
            </div>
          </footer>
        </DialogContent>
      </Dialog>
      {zoomed && createPortal(<ImageLightbox imageUrl={zoomed} onClose={() => setZoomed(null)} />, document.body)}
    </>
  );
}
