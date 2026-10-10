import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowRight, CheckCircle2, Clock, Package, Users, FileText, Printer, Edit, Plus, RefreshCw,
  AlertCircle, Image as ImageIcon, XCircle, Calendar as CalendarIcon, Layers, Search, X, Palette,
  Sparkles, MoreHorizontal, ArrowLeftRight, Wrench, ExternalLink, History, Check,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { BillboardTaskCard } from '@/components/tasks/BillboardTaskCard';
import { TaskBoardCard } from './TaskBoardCard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { TaskTotalCostSummary } from '@/components/tasks/TaskTotalCostSummary';
import ImageLightbox from '@/components/Map/ImageLightbox';
import { cn } from '@/lib/utils';
import { sortBillboardsStandardSync } from '@/lib/billboardSorter';
import { buildTaskName, syncInstallationTaskContracts, type TaskContractInfo } from '@/services/installationTaskContracts';

interface Props {
  task: any;
  taskItems: any[];
  taskDesigns: any[];
  contract: any;
  team: any;
  billboardById: Record<number, any>;
  contractById?: Record<number, any>;
  installationPricingByBillboard: Record<number, number>;
  sizeOrderMap?: Record<string, number>;
  selectedItemsForCompletion: string[];
  selectedItemsForDate: string[];
  showCompletionDialog: boolean;
  selectedTaskIdForCompletion: string | null;
  derivedContractIds?: number[];
  onBack: () => void;
  onManageDesigns: () => void;
  onDistributeDesigns: () => void;
  onEditTaskType: () => void;
  onTransferBillboards: () => void;
  onPrintAll: () => void;
  onDelete: () => void;
  onCreatePrintTask: () => void;
  onCompleteBillboards: () => void;
  onSetInstallationDate: () => void;
  onAddBillboards: () => void;
  onCreateCompositeTask?: () => void;
  onUnmerge?: () => void;
  onDeletePrintTask?: () => void;
  onNavigateToPrint: () => void;
  onNavigateToCutout: () => void;
  onSelectionChange: (itemId: string, checked: boolean) => void;
  onUncomplete: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
  onAddInstalledImage: (item: any) => void;
  onPrintBillboard: (taskId: string) => void;
  onRefreshItems: () => void;
  isMergedTask: boolean;
  onDuplicateAsReinstallation?: () => void;
  onSwitchTask?: (taskId: string) => void;
}

const STATUS: Record<string, { label: string; tone: string }> = {
  completed: { label: 'مكتملة', tone: 'bg-emerald-500/15 text-emerald-500' },
  in_progress: { label: 'قيد التنفيذ', tone: 'bg-amber-500/15 text-amber-500' },
  pending: { label: 'جديدة', tone: 'bg-muted text-muted-foreground' },
  cancelled: { label: 'ملغاة', tone: 'bg-destructive/15 text-destructive' },
};

const statusOf = (items: any[]) => {
  if (!items.length) return 'pending';
  const done = items.filter(i => i.status === 'completed').length;
  return done === items.length ? 'completed' : done > 0 ? 'in_progress' : 'pending';
};

const money = (n: number) => Math.round(n || 0).toLocaleString('ar-LY');

/** بطاقة قسم موحّدة لصفحة المهمة */
function Panel({ title, icon: Icon, actions, children, className }: {
  title: string; icon?: React.ComponentType<{ className?: string }>; actions?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={cn('rounded-xl border border-border bg-card', className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/20 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-bold">{Icon && <Icon className="h-4 w-4 text-primary" />}{title}</h3>
        {actions}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export const InstallationTaskDetail: React.FC<Props> = ({
  task, taskItems, taskDesigns, contract, team, billboardById, contractById = {}, installationPricingByBillboard,
  selectedItemsForCompletion, selectedItemsForDate, showCompletionDialog, derivedContractIds,
  onBack, onManageDesigns, onDistributeDesigns, onEditTaskType, onTransferBillboards, onPrintAll, onDelete,
  onCreatePrintTask, onCompleteBillboards, onSetInstallationDate, onAddBillboards, onCreateCompositeTask, onUnmerge,
  onNavigateToPrint,
  onSelectionChange, onUncomplete, onDeleteItem, onAddInstalledImage, onPrintBillboard, onRefreshItems,
  isMergedTask, onDuplicateAsReinstallation, onSwitchTask,
}) => {
  const queryClient = useQueryClient();
  const isReinstall = task.task_type === 'reinstallation';

  // ── عقود المهمة: تُحسب من اللوحات الفعلية وتُصحَّح في قاعدة البيانات عند الحاجة ──
  const fallbackIds: number[] = derivedContractIds && derivedContractIds.length > 0
    ? derivedContractIds
    : (task.contract_ids?.length ? task.contract_ids : [task.contract_id]).filter(Boolean);
  const [contractsInfo, setContractsInfo] = useState<TaskContractInfo[] | null>(null);
  const itemsKey = taskItems.map(i => i.billboard_id).sort().join(',');
  useEffect(() => {
    let cancelled = false;
    syncInstallationTaskContracts(task.id)
      .then(res => {
        if (cancelled) return;
        setContractsInfo(res.contracts);
        if (res.changed) queryClient.invalidateQueries({ queryKey: ['installation-tasks'] });
      })
      .catch(() => { if (!cancelled) setContractsInfo(null); });
    return () => { cancelled = true; };
  }, [task.id, itemsKey, queryClient]);

  const contracts: TaskContractInfo[] = useMemo(() => {
    if (contractsInfo && contractsInfo.length) return contractsInfo;
    return fallbackIds.map((id: number) => ({
      contractId: Number(id),
      adType: contractById[id]?.['Ad Type'] || '',
      customerName: contractById[id]?.['Customer Name'] || '',
      contractDate: null, endDate: null,
      billboardIds: [],
    }));
  }, [contractsInfo, fallbackIds.join(','), contractById]);
  const isMulti = contracts.length > 1;
  const contractOfBillboard = useMemo(() => {
    const m = new Map<number, number>();
    contracts.forEach(c => c.billboardIds.forEach(b => m.set(b, c.contractId)));
    return m;
  }, [contracts]);
  const customerName = contract?.['Customer Name'] || contracts[0]?.customerName || task.customer_name || 'غير محدد';

  // ── المؤشرات ──
  const completedCount = taskItems.filter(i => i.status === 'completed').length;
  const pct = taskItems.length ? Math.round((completedCount / taskItems.length) * 100) : 0;
  const st = STATUS[statusOf(taskItems)];
  const totalCost = taskItems.reduce((sum, item) => {
    const has = item.company_installation_cost !== null && item.company_installation_cost !== undefined;
    return sum + (has ? Number(item.company_installation_cost) : (installationPricingByBillboard[item.billboard_id] || 0));
  }, 0);
  const firstInstallDate = taskItems.find(i => i.installation_date)?.installation_date;
  const faceA = taskDesigns[0]?.design_face_a_url || taskItems.find(i => i.design_face_a)?.design_face_a;
  const faceB = taskDesigns[0]?.design_face_b_url || taskItems.find(i => i.design_face_b)?.design_face_b;
  const [lightbox, setLightbox] = useState<string | null>(null);

  // ── الاسم ──
  const autoName = buildTaskName({
    adTypes: contracts.map(c => c.adType),
    customerName,
    taskType: task.task_type,
    reinstallationNumber: task.reinstallation_number,
    contractIds: contracts.map(c => c.contractId),
  });
  const displayName = task.task_name || autoName || `مهمة #${String(task.id).slice(0, 8)}`;
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(task.task_name || '');
  useEffect(() => { setTempName(task.task_name || ''); }, [task.task_name]);
  const saveName = async () => {
    const { error } = await supabase.from('installation_tasks').update({ task_name: tempName.trim() || null }).eq('id', task.id);
    if (error) { toast.error('فشل حفظ الاسم'); return; }
    toast.success('تم حفظ اسم المهمة');
    setEditingName(false);
    queryClient.invalidateQueries({ queryKey: ['installation-tasks'] });
    onRefreshItems();
  };

  // ── لوحات مرتبطة بطباعة ──
  const [printBillboardIds, setPrintBillboardIds] = useState<Set<number>>(new Set());
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pt, ct] = await Promise.all([
          supabase.from('print_tasks').select('id').eq('installation_task_id', task.id),
          supabase.from('composite_tasks').select('print_task_id').eq('installation_task_id', task.id),
        ]);
        const ids = new Set<string>();
        if (task.print_task_id) ids.add(task.print_task_id);
        (pt.data || []).forEach((r: any) => ids.add(r.id));
        (ct.data || []).forEach((r: any) => r.print_task_id && ids.add(r.print_task_id));
        if (!ids.size) { if (!cancelled) setPrintBillboardIds(new Set()); return; }
        const { data } = await supabase.from('print_task_items').select('billboard_id').in('task_id', [...ids]);
        if (!cancelled) setPrintBillboardIds(new Set((data || []).map((r: any) => Number(r.billboard_id)).filter(Boolean)));
      } catch { if (!cancelled) setPrintBillboardIds(new Set()); }
    })();
    return () => { cancelled = true; };
  }, [task.id, task.print_task_id, itemsKey]);

  // ── الإيقاف والاستبدال (شارات على البطاقات) ──
  const [pausedMap, setPausedMap] = useState<Record<number, { pauseDate?: string }>>({});
  const [replacementMap, setReplacementMap] = useState<Record<number, { replacedName?: string; startDate?: string }>>({});
  const contractIdsKey = contracts.map(c => c.contractId).join(',');
  useEffect(() => {
    const ids = contracts.map(c => c.contractId).filter(Boolean);
    if (!ids.length) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ data: paused }, { data: reps }] = await Promise.all([
          supabase.from('paused_billboards' as any).select('id, billboard_id, billboard_name, pause_date').in('contract_number', ids),
          supabase.from('paused_billboard_replacements' as any).select('replacement_billboard_id, start_date, paused_billboard_id').in('contract_number', ids),
        ]);
        if (cancelled) return;
        const p: Record<number, { pauseDate?: string }> = {};
        const nameById: Record<string, string> = {};
        (paused || []).forEach((r: any) => {
          if (r.billboard_id != null) p[Number(r.billboard_id)] = { pauseDate: r.pause_date };
          nameById[String(r.id)] = r.billboard_name || `لوحة #${r.billboard_id}`;
        });
        const rp: Record<number, { replacedName?: string; startDate?: string }> = {};
        (reps || []).forEach((r: any) => {
          if (r.replacement_billboard_id != null) rp[Number(r.replacement_billboard_id)] = { replacedName: nameById[String(r.paused_billboard_id)], startDate: r.start_date };
        });
        setPausedMap(p);
        setReplacementMap(rp);
      } catch { /* الشارات اختيارية */ }
    })();
    return () => { cancelled = true; };
  }, [contractIdsKey]);

  // ── عمليات سابقة على نفس اللوحات ──
  const [history, setHistory] = useState<any[]>([]);
  useEffect(() => {
    const ids = contracts.map(c => c.contractId).filter(Boolean);
    if (!ids.length || !taskItems.length) { setHistory([]); return; }
    let cancelled = false;
    (async () => {
      const { data: tasks } = await supabase
        .from('installation_tasks')
        .select('id, task_type, task_name, contract_id, reinstallation_number, created_at, status, team_id')
        .in('contract_id', ids)
        .order('created_at', { ascending: false });
      if (cancelled || !tasks?.length) { setHistory([]); return; }
      const { data: its } = await supabase.from('installation_task_items').select('task_id, billboard_id').in('task_id', tasks.map(t => t.id));
      const mine = new Set(taskItems.map(i => Number(i.billboard_id)));
      const touching = new Set((its || []).filter((r: any) => mine.has(Number(r.billboard_id))).map((r: any) => r.task_id));
      const teamIds = [...new Set(tasks.map(t => t.team_id).filter(Boolean))];
      const { data: teams } = teamIds.length ? await supabase.from('installation_teams').select('id, team_name').in('id', teamIds) : { data: [] as any[] };
      const teamName = new Map((teams || []).map((t: any) => [t.id, t.team_name]));
      if (!cancelled) setHistory(tasks.filter(t => touching.has(t.id) || t.id === task.id).map(t => ({ ...t, teamName: teamName.get(t.team_id) })));
    })().catch(() => !cancelled && setHistory([]));
    return () => { cancelled = true; };
  }, [contractIdsKey, itemsKey, task.id]);

  // ── قائمة اللوحات: بحث، فلتر عقد، دورة تركيب، وترتيب موحد ──
  const [search, setSearch] = useState('');
  const [contractFilter, setContractFilter] = useState<number | 'all'>('all');
  const [iteration, setIteration] = useState<number | 'all'>('all');
  const iterations = useMemo(() => [...new Set(taskItems.map(i => i.reinstall_count || 0))].sort((a, b) => a - b), [taskItems]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = taskItems
      .map(item => ({ item, billboard: billboardById[item.billboard_id], price: installationPricingByBillboard[item.billboard_id] || 0 }))
      .filter(({ item, billboard }) => {
        if (iteration !== 'all' && (item.reinstall_count || 0) !== iteration) return false;
        if (contractFilter !== 'all' && contractOfBillboard.get(Number(item.billboard_id)) !== contractFilter) return false;
        if (!q) return true;
        return [billboard?.Billboard_Name, item.billboard_id, billboard?.City, billboard?.Municipality, billboard?.Nearest_Landmark, billboard?.Size]
          .some(v => String(v ?? '').toLowerCase().includes(q));
      })
      .map(r => ({ ...r, Size: r.billboard?.Size, Level: r.billboard?.Level, Municipality: r.billboard?.Municipality, ID: r.item.billboard_id }));
    return sortBillboardsStandardSync(list);
  }, [taskItems, billboardById, installationPricingByBillboard, search, iteration, contractFilter, contractOfBillboard]);
  const pendingRows = rows.filter(r => r.item.status !== 'completed');
  const doneRows = rows.filter(r => r.item.status === 'completed');

  const selectedCount = new Set([...selectedItemsForCompletion, ...selectedItemsForDate]).size;

  const applyFacesToAll = useCallback(async (faces: number) => {
    const ids = pendingRows.map(r => r.item.id);
    if (!ids.length) return;
    const { error } = await supabase.from('installation_task_items').update({ faces_to_install: faces } as any).in('id', ids);
    if (error) { toast.error('فشل تعميم الأوجه'); return; }
    toast.success(`تم التعميم على ${ids.length} لوحة`);
    onRefreshItems();
  }, [pendingRows, onRefreshItems]);

  const [workspaceTab, setWorkspaceTab] = useState('boards');
  const [boardStatus, setBoardStatus] = useState('all');
  const [managedItemId, setManagedItemId] = useState<string | null>(null);
  const [mediaRequest, setMediaRequest] = useState<{itemId:string; mode:'design'|'photos'; nonce:number} | null>(null);
  useEffect(() => { setWorkspaceTab('boards'); setManagedItemId(null); setMediaRequest(null); setSearch(''); setContractFilter('all'); setIteration('all'); setBoardStatus('all'); }, [task.id]);
  const visibleRows = rows.filter(r => boardStatus === 'all' || (boardStatus === 'completed' ? r.item.status === 'completed' : r.item.status !== 'completed'));
  const managedItem = taskItems.find(i => i.id === managedItemId);
  const typeLabel = isReinstall ? `إعادة تركيب${task.reinstallation_number ? ` ${task.reinstallation_number}` : ''}` : 'تركيب جديد';

  return (
    <div className="min-w-0 bg-background p-3 sm:p-5 [&_button]:cursor-pointer [&_button]:transition-colors [&_button]:duration-200" dir="rtl">
      <header className="mb-5 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 px-0"><ArrowRight className="h-4 w-4" />العودة إلى المهام</Button>
          <span className="inline-flex items-center gap-2"><span className={cn('rounded-md px-2 py-1 font-semibold', st.tone)}>{st.label}</span>{typeLabel}</span>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[12px] font-medium text-primary">مساحة إدارة المهمة</p>
            <h1 className="text-xl font-bold sm:text-2xl">{customerName}</h1>
            <p className="mt-2 line-clamp-2 text-[12px] text-muted-foreground" title={displayName}>{displayName}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground"><span className="inline-flex items-center gap-1"><Users className="h-4 w-4" />{team?.team_name || 'بدون فرقة'}</span><span>{taskItems.length} لوحة</span><span>{contracts.length} {contracts.length === 1 ? 'عقد' : 'عقود'}</span></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={onCompleteBillboards} className="h-10"><CheckCircle2 className="h-4 w-4" />إكمال التركيب</Button>
            <Button variant="outline" size="sm" onClick={onPrintAll} className="h-10"><Printer className="h-4 w-4" />طباعة المهمة</Button>
            <DropdownMenu dir="rtl">
              <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-10" aria-label="خيارات المهمة"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem onClick={onAddBillboards}><Plus className="ml-2 h-4 w-4" />إضافة لوحات</DropdownMenuItem>
                <DropdownMenuItem onClick={onSetInstallationDate}><CalendarIcon className="ml-2 h-4 w-4" />تحديد تاريخ التركيب</DropdownMenuItem>
                <DropdownMenuItem onClick={onTransferBillboards}><ArrowLeftRight className="ml-2 h-4 w-4" />نقل لوحات لفرقة أخرى</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setTempName(task.task_name || autoName); setEditingName(true); }}><Edit className="ml-2 h-4 w-4" />تعديل اسم المهمة</DropdownMenuItem>
                <DropdownMenuItem onClick={onEditTaskType}><Wrench className="ml-2 h-4 w-4" />تغيير نوع المهمة</DropdownMenuItem>
                {onCreateCompositeTask && <DropdownMenuItem onClick={onCreateCompositeTask}><Layers className="ml-2 h-4 w-4" />إنشاء مهمة مجمعة</DropdownMenuItem>}
                {onDuplicateAsReinstallation && <DropdownMenuItem onClick={onDuplicateAsReinstallation}><RefreshCw className="ml-2 h-4 w-4" />إعادة تركيب جديدة</DropdownMenuItem>}
                {isMergedTask && onUnmerge && <DropdownMenuItem onClick={onUnmerge}>فصل المهمة حسب العقود</DropdownMenuItem>}
                <DropdownMenuSeparator /><DropdownMenuItem onClick={onDelete} className="text-destructive">حذف المهمة</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {editingName && <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4"><Input value={tempName} onChange={e => setTempName(e.target.value)} className="min-w-0 flex-1" aria-label="اسم المهمة" /><Button size="sm" onClick={saveName}>حفظ الاسم</Button><Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>إلغاء</Button></div>}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4"><span className="text-[12px] text-muted-foreground">التنفيذ</span><Progress value={pct} className="h-2 min-w-20 max-w-xs flex-1" /><span className="text-[12px] font-semibold tabular-nums">{completedCount} / {taskItems.length}</span><span className="text-[12px] text-success">{pct}%</span></div>
      </header>

      <Tabs value={workspaceTab} onValueChange={setWorkspaceTab} dir="rtl">
        <TabsList className="mb-4 grid h-auto w-full grid-cols-2 gap-1 rounded-xl border border-border bg-card p-1 sm:grid-cols-4">
          <TabsTrigger value="boards" className="min-h-11 gap-2 rounded-lg text-[12px] data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><Package className="h-4 w-4" />اللوحات <span>{taskItems.length}</span></TabsTrigger>
          <TabsTrigger value="designs" className="min-h-11 gap-2 rounded-lg text-[12px] data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><Palette className="h-4 w-4" />التصاميم</TabsTrigger>
          <TabsTrigger value="accounts" className="min-h-11 gap-2 rounded-lg text-[12px] data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><FileText className="h-4 w-4" />العقود والتكاليف</TabsTrigger>
          <TabsTrigger value="history" className="min-h-11 gap-2 rounded-lg text-[12px] data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><History className="h-4 w-4" />العمليات السابقة</TabsTrigger>
        </TabsList>

        <TabsContent value="boards" className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-3 space-y-3">
            <div className="flex flex-wrap gap-2"><div className="relative min-w-[180px] flex-1"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث عن لوحة أو موقع..." className="h-10 pr-9" /></div>
              <div className="flex flex-wrap items-center gap-1" role="group" aria-label="حالة اللوحات">{[{id:'all',label:'الكل',count:taskItems.length},{id:'pending',label:'قيد التنفيذ',count:pendingRows.length},{id:'completed',label:'مكتملة',count:doneRows.length}].map(v => <Button key={v.id} variant={boardStatus === v.id ? 'default' : 'ghost'} size="sm" className="h-10 text-[12px]" onClick={() => setBoardStatus(v.id)} aria-pressed={boardStatus === v.id}>{v.label} {v.count}</Button>)}</div>
            </div>
            {isMulti && <div className="flex flex-wrap gap-2 border-t border-border pt-3" role="group" aria-label="تصفية حسب العقد"><Button size="sm" variant={contractFilter === 'all' ? 'secondary' : 'ghost'} onClick={() => setContractFilter('all')}>كل العقود</Button>{contracts.map(c => <Button size="sm" key={c.contractId} variant={contractFilter === c.contractId ? 'secondary' : 'ghost'} onClick={() => setContractFilter(c.contractId)}>#{c.contractId}</Button>)}</div>}
            {iterations.length > 1 && <div className="flex flex-wrap gap-1 border-t border-border pt-3" role="group" aria-label="دورة التركيب">{(['all',...iterations] as const).map(v => <Button key={v} size="sm" variant={iteration === v ? 'secondary' : 'ghost'} onClick={() => setIteration(v)}>{v === 'all' ? 'كل الدورات' : v === 0 ? 'التركيب الأول' : `إعادة ${v}`}</Button>)}</div>}
          </div>
          {selectedCount > 0 && <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-card p-3 shadow-sm"><span className="text-[12px] font-semibold">تم تحديد {selectedCount} لوحة</span><div className="flex gap-2"><Button size="sm" variant="outline" onClick={onSetInstallationDate}>تحديد التاريخ</Button><Button size="sm" onClick={onCompleteBillboards}>إكمال المحدد</Button></div></div>}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground"><span>{visibleRows.length} لوحة معروضة</span><Button variant="ghost" size="sm" onClick={onAddBillboards}><Plus className="h-4 w-4" />إضافة لوحات</Button></div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4">
            {visibleRows.map(({item,billboard}) => <TaskBoardCard key={item.id} item={item} billboard={billboard} taskType={task.task_type} contractId={contractOfBillboard.get(Number(item.billboard_id)) || (contracts.length === 1 ? contracts[0].contractId : undefined)} design={taskDesigns.find(d => d.id === item.selected_design_id)} selected={selectedItemsForCompletion.includes(item.id) || selectedItemsForDate.includes(item.id)} printActive={printBillboardIds.has(Number(item.billboard_id))} paused={!!pausedMap[Number(item.billboard_id)]} replacement={!!replacementMap[Number(item.billboard_id)]} onSelect={checked => onSelectionChange(item.id,checked)} onPhoto={() => onAddInstalledImage(item)} onManage={() => setManagedItemId(item.id)} onPreview={setLightbox} taskDesigns={taskDesigns} editRequest={mediaRequest?.itemId === item.id ? mediaRequest : undefined} adType={contracts.find(c => c.contractId === contractOfBillboard.get(Number(item.billboard_id)))?.adType || contract?.['Ad Type'] || ''} onRefresh={() => { onRefreshItems(); queryClient.invalidateQueries({queryKey:['task-designs']}); queryClient.invalidateQueries({queryKey:['print-task-items']}); queryClient.invalidateQueries({queryKey:['billboards-for-tasks']}); queryClient.invalidateQueries({queryKey:['composite-tasks']}); }} />)}
          </div>
          {!visibleRows.length && <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground"><Package className="mx-auto mb-3 h-8 w-8" /><p>لا توجد لوحات مطابقة</p><Button variant="outline" size="sm" className="mt-4" onClick={() => { setSearch('');setContractFilter('all');setBoardStatus('all');setIteration('all'); }}>عرض كل اللوحات</Button></div>}
        </TabsContent>

        <TabsContent value="designs" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"><div><h2 className="text-[15px] font-bold">تصاميم هذه المهمة</h2><p className="mt-1 text-[12px] text-muted-foreground">أضف التصاميم ثم وزعها على اللوحات.</p></div><div className="flex flex-wrap gap-2"><Button size="sm" onClick={onManageDesigns}><Palette className="h-4 w-4" />إدارة التصاميم</Button><Button size="sm" variant="outline" onClick={onDistributeDesigns}><Layers className="h-4 w-4" />توزيع التصاميم</Button><Button size="sm" variant="outline" onClick={task.print_task_id ? onNavigateToPrint : onCreatePrintTask}><Printer className="h-4 w-4" />{task.print_task_id ? 'متابعة الطباعة' : 'إنشاء طباعة'}</Button></div></div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-4">{taskDesigns.map(d => <article key={d.id} className="rounded-xl border border-border bg-card p-3"><h3 className="mb-3 text-[13px] font-bold">{d.design_name || 'تصميم بدون اسم'}</h3><div className="grid grid-cols-2 gap-2">{[d.design_face_a_url,d.design_face_b_url].map((url,index) => <button key={index} disabled={!url} onClick={() => url && setLightbox(url)} className="aspect-video overflow-hidden rounded-lg border border-border bg-muted cursor-pointer" aria-label={index === 0 ? 'عرض الوجه الأمامي' : 'عرض الوجه الخلفي'}>{url ? <img src={url} alt={index === 0 ? 'أمامي' : 'خلفي'} className="h-full w-full object-contain" /> : <ImageIcon className="mx-auto h-6 w-6 text-muted-foreground" />}</button>)}</div><p className="mt-3 text-[12px] text-muted-foreground">مطبق على {taskItems.filter(i => i.selected_design_id === d.id).length} لوحة</p></article>)}</div>
          {!taskDesigns.length && <p className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">لا توجد تصاميم مضافة. ابدأ من إدارة التصاميم.</p>}
        </TabsContent>

        <TabsContent value="accounts" className="space-y-4">
          <div className="grid grid-cols-2 gap-3"><Panel title="تكلفة الفرقة"><p className="text-xl font-bold tabular-nums">{money(totalCost)} د.ل</p></Panel><Panel title="تاريخ التركيب"><p className="text-[14px] font-semibold">{firstInstallDate ? format(new Date(firstInstallDate),'dd MMM yyyy',{locale:ar}) : 'لم يحدد بعد'}</p></Panel></div>
          <Panel title="عقود المهمة" icon={FileText}><div className="grid gap-3 sm:grid-cols-2">{contracts.map(c => <article key={c.contractId} className="rounded-lg border border-border p-3"><div className="flex items-center justify-between gap-2"><h3 className="text-[14px] font-bold">عقد #{c.contractId}</h3><a href={`/admin/contracts/edit?contract=${c.contractId}`} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1 text-[12px] text-primary cursor-pointer"><ExternalLink className="h-3.5 w-3.5" />فتح العقد</a></div><p className="mt-2 text-[12px] text-muted-foreground">{c.adType || 'نوع الإعلان غير محدد'}</p><Button size="sm" variant="ghost" className="mt-2" onClick={() => {setContractFilter(c.contractId);setWorkspaceTab('boards');}}>عرض لوحات العقد</Button></article>)}</div></Panel>
          <TaskTotalCostSummary taskId={task.id} taskItems={taskItems} billboards={billboardById} installationPrices={installationPricingByBillboard} onRefresh={onRefreshItems} taskType={task.task_type || 'installation'} disabled={false} />
        </TabsContent>

        <TabsContent value="history"><Panel title="العمليات السابقة على اللوحات" icon={History}>{history.length ? <div className="space-y-2">{history.map(t => <button key={t.id} disabled={t.id===task.id} onClick={() => onSwitchTask?.(t.id)} className={cn('flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-right',t.id===task.id?'border-primary bg-primary/5':'border-border hover:bg-muted')}><span className="text-[13px] font-semibold">{t.task_type==='reinstallation'?`إعادة تركيب ${t.reinstallation_number||''}`:'التركيب الأول'} · #{t.contract_id}</span><span className="text-[12px] text-muted-foreground">{t.teamName||'بدون فرقة'} · {t.created_at?format(new Date(t.created_at),'yyyy-MM-dd'):''}</span></button>)}</div> : <p className="text-[12px] text-muted-foreground">لا توجد عمليات سابقة.</p>}</Panel></TabsContent>
      </Tabs>

      <Sheet open={!!managedItem} onOpenChange={open => {if(!open)setManagedItemId(null);}}>
        <SheetContent side="right" className="w-full overflow-y-auto p-4 sm:max-w-xl" dir="rtl"><SheetHeader className="mb-4 border-b border-border pb-4 pl-8 text-right"><SheetTitle>إدارة {managedItem ? billboardById[managedItem.billboard_id]?.Billboard_Name || `لوحة #${managedItem.billboard_id}` : 'اللوحة'}</SheetTitle><SheetDescription>التاريخ والأوجه والتصميم والصور والتكاليف لهذه اللوحة.</SheetDescription></SheetHeader>
          {managedItem && (() => { const item=managedItem;const billboard=billboardById[item.billboard_id];const price=installationPricingByBillboard[item.billboard_id]||0;return (
                <BillboardTaskCard
                  item={item}
                  billboard={billboard}
                  installationPrice={price}
                  isSelected={selectedItemsForCompletion.includes(item.id) || selectedItemsForDate.includes(item.id)}
                  isCompleted={item.status === 'completed'}
                  isPrintActive={printBillboardIds.has(Number(item.billboard_id))}
                  printPricePerMeter={Number(task?.default_price_per_meter) || 0}
                  taskDesigns={taskDesigns}
                  allItems={taskItems}
                  onDelete={item.status === 'completed' ? undefined : () => onDeleteItem(item.id)}
                  onSelectionChange={checked => onSelectionChange(item.id, checked)}
                  onUncomplete={item.status === 'completed' ? () => onUncomplete(item.id) : undefined}
                  onEditDesign={() => { setManagedItemId(null); setMediaRequest({itemId:item.id,mode:'design',nonce:Date.now()}); }}
                  onPrint={() => onPrintBillboard(item.task_id)}
                  onAddInstalledImage={() => { setManagedItemId(null); setMediaRequest({itemId:item.id,mode:'photos',nonce:Date.now()}); }}
                  onRefresh={onRefreshItems}
                  onApplyFacesToAll={item.status === 'completed' ? undefined : applyFacesToAll}
                  pausedInfo={pausedMap[Number(item.billboard_id)]}
                  replacementInfo={replacementMap[Number(item.billboard_id)]}
                />
          );})()}
        </SheetContent>
      </Sheet>
      {lightbox && createPortal(<ImageLightbox imageUrl={lightbox} onClose={() => setLightbox(null)} />, document.body)}
    </div>
  );
};
