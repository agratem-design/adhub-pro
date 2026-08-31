import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { usePersistedFilters } from '@/hooks/usePersistedFilters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  CheckCircle2, Clock, Package, Users,
  RefreshCw, Printer, FolderOpen,
  Trash2, ChevronDown,
  LayoutList, Layers, X,
  ChevronLeft, ChevronRight,
  AlertTriangle, CalendarDays, Megaphone,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RemovalTaskItemCard } from './RemovalTaskItemCard';
import { RemovalMobileTaskCard } from './RemovalMobileTaskCard';

interface Props {
  tasks: any[];
  allTaskItems: any[];
  billboardById: Record<number, any>;
  contractByNumber: Record<number, any>;
  teamById: Record<string, any>;
  teams: any[];
  isLoading: boolean;
  // stats
  totalTasks: number;
  pendingTasks: number;
  completedTasks: number;
  totalItems: number;
  completedItems: number;
  // pagination (lifted to parent to preserve across re-renders)
  page: number;
  onPageChange: (page: number) => void;
  // actions
  onRefresh: () => void;
  onAddTask: () => void;
  onDeleteTask: (taskId: string) => void;
  onPrintTask: (task: any, items: any[]) => void;
  onUndoRemoval: (itemId: string) => void;
  onCompleteAll?: (taskId: string) => void;
  onCompleteItem?: (itemId: string, taskId: string) => void;
  onPrintAllTeam?: (teamId: string) => void;
  onSyncMissingBillboards?: (contractId: number, taskIds: string[]) => void;
  onBulkComplete?: (taskIds: string[]) => void;
  onBulkPrint?: (taskIds: string[]) => void;
  onBulkDelete?: (taskIds: string[]) => void;
  onSendWhatsApp?: (task: any, items: any[]) => void;
  // item selection
  selectedItems: Set<string>;
  onToggleItem: (itemId: string, taskId: string) => void;
  onToggleSelectAll: (taskId: string) => void;
}

type SortField = 'client' | 'contract' | 'billboards' | 'status' | 'date' | 'team';
type SortDir = 'asc' | 'desc';

const getContractGroupKey = (task: { contract_id?: number | null; id: string }) =>
  task.contract_id != null ? `contract:${task.contract_id}` : `task:${task.id}`;

const STATUS_CONFIG = {
  completed: {
    label: 'مكتملة',
    color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    dot: 'bg-emerald-400',
    icon: CheckCircle2,
  },
  in_progress: {
    label: 'قيد الإزالة',
    color: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    dot: 'bg-amber-400',
    icon: Clock,
  },
  pending: {
    label: 'معلقة',
    color: 'bg-red-500/15 text-red-400 border-red-500/30',
    dot: 'bg-red-400',
    icon: AlertTriangle,
  },
  cancelled: {
    label: 'ملغاة',
    color: 'bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30',
    dot: 'bg-muted-foreground',
    icon: X,
  },
} as const;

function getDisplayStatus(items: any[]): keyof typeof STATUS_CONFIG {
  if (items.length === 0) return 'pending';
  const completed = items.filter(i => i.status === 'completed').length;
  if (completed === items.length) return 'completed';
  if (completed > 0) return 'in_progress';
  return 'pending';
}

/* ── Skeleton card ── */
const SkeletonCard = () => (
  <div className="rounded-2xl overflow-hidden border border-border/50 bg-card">
    <Skeleton className="w-full h-56" />
    <div className="p-4 flex flex-col gap-3">
      <Skeleton className="h-5 w-1/3 rounded-lg" />
      <Skeleton className="h-4 w-1/2 rounded" />
      <div className="flex gap-3 mt-1">
        <Skeleton className="h-3 w-16 rounded" />
        <Skeleton className="h-3 w-20 rounded" />
      </div>
      <Skeleton className="h-9 w-full rounded-xl mt-2" />
    </div>
  </div>
);

const SortIconEl = ({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) =>
  sortField !== field
    ? <ArrowUpDown className="h-3 w-3 opacity-30" />
    : sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 text-primary" />
      : <ArrowDown className="h-3 w-3 text-primary" />;

export const RemovalTasksBoard: React.FC<Props> = ({
  tasks, allTaskItems, billboardById, contractByNumber, teamById, teams,
  isLoading, totalTasks, pendingTasks, completedTasks, totalItems, completedItems,
  page, onPageChange,
  onRefresh, onAddTask, onDeleteTask, onPrintTask, onUndoRemoval, onCompleteAll, onCompleteItem, onPrintAllTeam, onSyncMissingBillboards,
  onBulkComplete, onBulkPrint, onBulkDelete, onSendWhatsApp,
  selectedItems, onToggleItem, onToggleSelectAll,
}) => {
  const { filters: persistedFilters, setFilter: setPersisted } = usePersistedFilters('removal-tasks', {
    search: '',
    filterStatus: 'all',
    filterTeam: 'all',
    sortField: 'date' as SortField,
    sortDir: 'desc' as SortDir,
  });
  const [search, _setSearch] = useState(persistedFilters.search);
  const [filterStatus, _setFilterStatus] = useState(persistedFilters.filterStatus);
  const [filterTeam, _setFilterTeam] = useState(persistedFilters.filterTeam);
  const [sortField, _setSortField] = useState<SortField>(persistedFilters.sortField as SortField);
  const [sortDir, _setSortDir] = useState<SortDir>(persistedFilters.sortDir as SortDir);
  const setSearch = (v: string) => { _setSearch(v); setPersisted('search', v); };
  const setFilterStatus = (v: string) => { _setFilterStatus(v); setPersisted('filterStatus', v); };
  const setFilterTeam = (v: string) => { _setFilterTeam(v); setPersisted('filterTeam', v); };
  const setSortField = (v: SortField) => { _setSortField(v); setPersisted('sortField', v); };
  const setSortDir = (v: SortDir) => { _setSortDir(v); setPersisted('sortDir', v); };
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const GROUPS_PER_PAGE = 15;

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    onPageChange(1);
  };

  // جلب أحجام اللوحات لترتيب لوحات كل مهمة حسب رتبة المقاس من الإعدادات
  const { data: sizes = [] } = useQuery({
    queryKey: ['sizes-order-for-removal-board'],
    queryFn: async () => {
      const { data } = await supabase.from('sizes').select('*').order('sort_order', { ascending: true });
      return data || [];
    }
  });

  const sizeOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    sizes.forEach((s: any, idx: number) => {
      const name = String(s.name || '').trim();
      const rank = typeof s.sort_order === 'number' && s.sort_order > 0 ? s.sort_order : idx + 1;
      map.set(name, rank);
      map.set(name.toLowerCase(), rank);
      map.set(name.replace(/[×*]/g, 'x').toLowerCase(), rank);
    });
    return map;
  }, [sizes]);

  const itemsByTask = useMemo(() => {
    const m: Record<string, any[]> = {};
    allTaskItems.forEach(i => {
      if (!m[i.task_id]) m[i.task_id] = [];
      m[i.task_id].push(i);
    });

    // ترتيب لوحات كل مهمة حسب رتبة المقاس من الإعدادات
    Object.values(m).forEach(items => {
      items.sort((a, b) => {
        const bA = billboardById[a.billboard_id];
        const bB = billboardById[b.billboard_id];
        const sizeA = String(bA?.Size || bA?.size || '').trim();
        const sizeB = String(bB?.Size || bB?.size || '').trim();
        const rankA = sizeOrderMap.get(sizeA) ?? sizeOrderMap.get(sizeA.toLowerCase()) ?? sizeOrderMap.get(sizeA.replace(/[×*]/g, 'x').toLowerCase()) ?? 9999;
        const rankB = sizeOrderMap.get(sizeB) ?? sizeOrderMap.get(sizeB.toLowerCase()) ?? sizeOrderMap.get(sizeB.replace(/[×*]/g, 'x').toLowerCase()) ?? 9999;
        if (rankA !== rankB) return rankA - rankB;
        return Number(a.billboard_id || 0) - Number(b.billboard_id || 0);
      });
    });

    return m;
  }, [allTaskItems, billboardById, sizeOrderMap]);

  const enriched = useMemo(() => tasks.map(task => {
    const items = itemsByTask[task.id] || [];
    const contract = contractByNumber[task.contract_id];
    const team = teamById[task.team_id];
    const completed = items.filter(i => i.status === 'completed').length;
    const displayStatus = getDisplayStatus(items);
    const removalDate = items.find(i => i.removal_date)?.removal_date;

    // design image: take first design_face_a available from items
    const designThumb = items.map(i => i.design_face_a || i.design_face_b).find(Boolean) || null;

    // consistent accent color from task id
    let h = 0;
    for (let i = 0; i < task.id.length; i++) h = task.id.charCodeAt(i) + ((h << 5) - h);
    // Use red-ish hues for removal tasks (0-30 or 340-360 degrees)
    const hue = 0 + (Math.abs(h) % 30);
    const accent = `hsl(${hue}, 65%, 55%)`;

    const pct = items.length > 0 ? Math.round((completed / items.length) * 100) : 0;
    return {
      ...task, items, contract, team, completed,
      totalItems: items.length, displayStatus,
      removalDate, designThumb, accent, completionPct: pct,
      customerName: contract?.['Customer Name'] || 'غير محدد',
      adType: contract?.['Ad Type'] || '—',
      contractEndDate: contract?.['End Date'] || null,
    };
  }), [tasks, contractByNumber, teamById, itemsByTask]);

  const filtered = useMemo(() => {
    let r = enriched;
    // Tab filter
    if (activeTab === 'active') {
      r = r.filter(t => t.displayStatus !== 'completed');
    } else {
      r = r.filter(t => t.displayStatus === 'completed');
    }
    if (filterStatus !== 'all') r = r.filter(t => t.displayStatus === filterStatus);
    if (filterTeam !== 'all') r = r.filter(t => t.team_id === filterTeam);
    if (search) {
      const s = search.toLowerCase();
      r = r.filter(t =>
        t.customerName.toLowerCase().includes(s) ||
        String(t.contract_id).includes(s) ||
        t.adType.toLowerCase().includes(s) ||
        t.team?.team_name?.toLowerCase().includes(s) ||
        t.id.toLowerCase().includes(s)
      );
    }
    return r;
  }, [enriched, filterStatus, filterTeam, search, activeTab]);

  // Count for tabs
  const activeCount = useMemo(() => enriched.filter(t => t.displayStatus !== 'completed').length, [enriched]);
  const completedCount = useMemo(() => enriched.filter(t => t.displayStatus === 'completed').length, [enriched]);
  const pendingItemsCount = Math.max(0, totalItems - completedItems);
  const overallCompletionPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const hasActiveFilters = Boolean(search || filterStatus !== 'all' || filterTeam !== 'all');

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let av: any, bv: any;
    switch (sortField) {
      case 'client': av = a.customerName; bv = b.customerName; break;
      case 'contract': av = a.contract_id; bv = b.contract_id; break;
      case 'billboards': av = a.totalItems; bv = b.totalItems; break;
      case 'status': av = a.displayStatus; bv = b.displayStatus; break;
      case 'date': av = a.removalDate || a.created_at; bv = b.removalDate || b.created_at; break;
      case 'team': av = a.team?.team_name || ''; bv = b.team?.team_name || ''; break;
      default: av = a.created_at; bv = b.created_at;
    }
    const cmp = typeof av === 'number' ? av - bv : String(av || '').localeCompare(String(bv || ''));
    return sortDir === 'asc' ? cmp : -cmp;
  }), [filtered, sortField, sortDir]);

  // ترقيم الصفحات يكون حسب العقود حتى لا تنقسم فرق العقد نفسه بين صفحتين.
  const sortedContractGroups = useMemo(() => {
    const groups = new Map<string, typeof sorted>();
    sorted.forEach(task => {
      const key = getContractGroupKey(task);
      const current = groups.get(key) || [];
      current.push(task);
      groups.set(key, current);
    });
    return Array.from(groups.values());
  }, [sorted]);
  const totalPages = Math.ceil(sortedContractGroups.length / GROUPS_PER_PAGE);
  const paginatedGroups = sortedContractGroups.slice((page - 1) * GROUPS_PER_PAGE, page * GROUPS_PER_PAGE);
  const paginated = paginatedGroups.flat();

  const allOnPageSel = paginated.length > 0 && paginated.every(t => selected.has(t.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allOnPageSel) paginated.forEach(t => next.delete(t.id));
    else paginated.forEach(t => next.add(t.id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const SortPill = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className={`flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-all duration-200 active:scale-95 ${
        sortField === field
          ? 'border-primary/30 bg-primary/15 text-primary'
          : 'border-border/40 text-muted-foreground hover:border-primary/20 hover:text-primary'
      }`}
    >
      {label}
      <SortIconEl field={field} sortField={sortField} sortDir={sortDir} />
    </button>
  );

  const PaginationBar = () => {
    if (totalPages <= 1) return null;
    const visiblePages = 5;
    const startPage = Math.max(1, page - Math.floor(visiblePages / 2));
    const endPage = Math.min(totalPages, startPage + visiblePages - 1);
    const pageNumbers = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
    return (
      <div className="bg-card/45 backdrop-blur-md border border-border/25 px-4 py-1.5 flex items-center gap-4 text-[11px] text-muted-foreground rounded-2xl shrink-0 shadow-sm w-fit mr-auto">
        <div className="flex items-center gap-2 font-bold text-muted-foreground/80 select-none">
          <span>{sortedContractGroups.length > 0 ? `عرض ${(page - 1) * GROUPS_PER_PAGE + 1}–${Math.min(page * GROUPS_PER_PAGE, sortedContractGroups.length)} من ${sortedContractGroups.length} عقد/مجموعة` : 'لا توجد نتائج'}</span>
          <span className="text-[10px] text-muted-foreground/35 font-normal">|</span>
          <span className="text-[10px] text-muted-foreground/50 font-normal">الصفحة {page} من {totalPages}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-9 cursor-pointer gap-1 rounded-xl border-border/30 px-3 text-[10px] font-bold text-muted-foreground/80 transition-all duration-200 hover:bg-muted/50 hover:text-foreground" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronRight className="h-3 w-3" />السابق
          </Button>
          {startPage > 1 && (<><Button size="sm" className="h-9 w-9 cursor-pointer rounded-xl border border-transparent bg-transparent p-0 text-[10px] text-muted-foreground transition-all duration-200 hover:bg-muted/50" onClick={() => onPageChange(1)}>1</Button>{startPage > 2 && <span className="text-muted-foreground/40 px-1 text-[10px]">...</span>}</>)}
          {pageNumbers.map(p => (
            <Button key={p} size="sm" className={`h-9 w-9 cursor-pointer rounded-xl p-0 text-[10px] transition-all duration-200 ${p === page ? 'bg-primary text-primary-foreground font-black shadow-md shadow-primary/10 hover:bg-primary/90' : 'bg-transparent hover:bg-muted/50 text-muted-foreground border border-transparent'}`} onClick={() => onPageChange(p)}>{p}</Button>
          ))}
          {endPage < totalPages && (<>{endPage < totalPages - 1 && <span className="text-muted-foreground/40 px-1 text-[10px]">...</span>}<Button size="sm" className="h-9 w-9 cursor-pointer rounded-xl border border-transparent bg-transparent p-0 text-[10px] text-muted-foreground transition-all duration-200 hover:bg-muted/50" onClick={() => onPageChange(totalPages)}>{totalPages}</Button></>)}
          <Button variant="outline" size="sm" className="h-9 cursor-pointer gap-1 rounded-xl border-border/30 px-3 text-[10px] font-bold text-muted-foreground/80 transition-all duration-200 hover:bg-muted/50 hover:text-foreground" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            التالي<ChevronLeft className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="flex h-full flex-col gap-4" dir="rtl">

        {/* Stats Grid */}
        <div className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { label: 'إجمالي المهام', value: totalTasks, color: 'text-primary', icon: LayoutList, bg: 'bg-primary/10', border: 'border-primary/20', accent: 'bg-primary', pct: 100 },
            { label: 'مهام نشطة', value: activeCount, color: 'text-amber-400', icon: Clock, bg: 'bg-amber-500/10', border: 'border-amber-500/20', accent: 'bg-amber-500', pct: totalTasks > 0 ? Math.round((activeCount / totalTasks) * 100) : 0 },
            { label: 'لوحات بانتظار الإزالة', value: pendingItemsCount, color: 'text-rose-400', icon: AlertTriangle, bg: 'bg-rose-500/10', border: 'border-rose-500/20', accent: 'bg-rose-500', pct: totalItems > 0 ? Math.round((pendingItemsCount / totalItems) * 100) : 0 },
            { label: 'لوحات تمت إزالتها', value: completedItems, color: 'text-emerald-400', icon: CheckCircle2, bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', accent: 'bg-emerald-500', pct: overallCompletionPct },
            { label: 'نسبة الإنجاز', value: `${overallCompletionPct}%`, color: 'text-blue-400', icon: Layers, bg: 'bg-blue-500/10', border: 'border-blue-500/20', accent: 'bg-blue-500', pct: overallCompletionPct },
          ].map(({ label, value, color, icon: Icon, bg, border, accent, pct }) => (
            <div key={label} className={`group relative flex min-h-[104px] flex-col justify-between overflow-hidden rounded-2xl border ${border} bg-card/60 p-4 text-right shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`}>
              <div className={`absolute inset-x-0 top-0 h-0.5 ${accent} opacity-80`} />
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1 space-y-1 text-right">
                  <p className="truncate text-[10px] font-bold text-muted-foreground">{label}</p>
                  <p className="font-mono text-2xl font-black leading-none tracking-tight text-foreground">{value}</p>
                </div>
                <div className={`mr-3 shrink-0 rounded-xl border border-border/20 p-2 ${bg}`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
              </div>
              <div className="mt-2 space-y-1.5 text-right">
                <div className="flex items-center justify-between text-[9px] font-bold text-muted-foreground/70">
                  <span>من الإجمالي</span>
                  <span className={color}>{pct}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
                  <div className={`h-full rounded-full ${accent} motion-safe:transition-all motion-safe:duration-300`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs: معلقة / مكتملة */}
        <div className="flex w-full shrink-0 items-center gap-1 rounded-xl border border-border/30 bg-card/50 p-1 sm:w-fit">
          <button
            onClick={() => { setActiveTab('active'); onPageChange(1); }}
            className={`h-10 flex-1 cursor-pointer rounded-lg px-4 text-xs font-bold transition-all duration-200 sm:flex-none ${
              activeTab === 'active'
                ? 'bg-rose-500/15 text-rose-400 shadow-sm'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5 inline ml-1.5" />
            معلقة / قيد التنفيذ ({activeCount})
          </button>
          <button
            onClick={() => { setActiveTab('completed'); onPageChange(1); }}
            className={`h-10 flex-1 cursor-pointer rounded-lg px-4 text-xs font-bold transition-all duration-200 sm:flex-none ${
              activeTab === 'completed'
                ? 'bg-emerald-500/15 text-emerald-400 shadow-sm'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5 inline ml-1.5" />
            مكتملة ({completedCount})
          </button>
        </div>

        {/* Toolbar & Filter Control Center */}
        <div className="flex shrink-0 flex-col items-center justify-between gap-3 rounded-2xl border border-border/30 bg-card/55 p-3 shadow-sm backdrop-blur-lg xl:flex-row">
          <div className="flex w-full flex-1 flex-wrap items-center gap-2 xl:w-auto">
            {/* Search Input */}
            <div className="relative min-w-[220px] flex-1 xl:max-w-md">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <Input
                placeholder="بحث برقم العقد، الزبون، الفريق..."
                value={search}
                onChange={e => { setSearch(e.target.value); onPageChange(1); }}
                className="h-10 rounded-xl border-border/40 bg-background/70 pr-10 text-xs focus-visible:ring-primary/40"
              />
            </div>
            
            {/* Status Select */}
            <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); onPageChange(1); }}>
              <SelectTrigger className="h-10 w-[145px] rounded-xl border-border/40 bg-background/70 text-xs">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="pending">معلقة</SelectItem>
                <SelectItem value="in_progress">قيد الإزالة</SelectItem>
                <SelectItem value="completed">مكتملة</SelectItem>
                <SelectItem value="cancelled">ملغاة</SelectItem>
              </SelectContent>
            </Select>

            {/* Team Select */}
            <Select value={filterTeam} onValueChange={v => { setFilterTeam(v); onPageChange(1); }}>
              <SelectTrigger className="h-10 w-[155px] rounded-xl border-border/40 bg-background/70 text-xs">
                <SelectValue placeholder="الفريق" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفرق</SelectItem>
                {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.team_name}</SelectItem>)}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setFilterStatus('all');
                  setFilterTeam('all');
                  onPageChange(1);
                }}
                className="h-10 cursor-pointer gap-1.5 rounded-xl px-3 text-xs text-muted-foreground transition-all duration-200 hover:bg-muted/50 hover:text-foreground active:scale-95"
              >
                <X className="h-3.5 w-3.5" />
                مسح الفلاتر
              </Button>
            )}

            {onPrintAllTeam && (
              <Select onValueChange={(teamId) => onPrintAllTeam(teamId)}>
                  <SelectTrigger className="h-10 w-auto cursor-pointer gap-1.5 rounded-xl border-primary/25 bg-primary/5 px-3 text-xs font-bold text-primary transition-all duration-200 hover:bg-primary/10">
                    <Printer className="h-3.5 w-3.5" />
                    <span>طباعة حسب الفريق</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wide">طباعة مهام الفرقة</div>
                    {teams
                      .filter(t => enriched.some(task => task.team_id === t.id && task.items?.some((i: any) => i.status !== 'completed')))
                      .map(t => (
                        <SelectItem key={t.id} value={t.id} className="gap-2">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-primary" />
                            <span>{t.team_name}</span>
                          </div>
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
              </Select>
            )}

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onRefresh}
              className="h-10 w-10 cursor-pointer rounded-xl border-border/40 bg-background/70 text-muted-foreground transition-all duration-200 hover:border-primary/30 hover:bg-primary/10 hover:text-primary active:scale-95"
              aria-label="تحديث البيانات"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={onAddTask}
              className="h-10 cursor-pointer gap-2 rounded-xl border-primary/25 bg-primary/5 px-3 text-xs font-bold text-primary transition-all duration-200 hover:bg-primary/10 active:scale-95 xl:hidden"
            >
              <Package className="h-4 w-4" />
              مهمة يدوية
            </Button>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Sort pills */}
            <div className="hidden xl:flex items-center gap-2">
              <span className="text-xs text-muted-foreground/50 shrink-0">ترتيب:</span>
              <SortPill field="date" label="التاريخ" />
              <SortPill field="client" label="العميل" />
              <SortPill field="billboards" label="اللوحات" />
              <SortPill field="status" label="الحالة" />
            </div>
            
            <div className="h-4 w-px bg-border/40 hidden lg:block" />

            <div className="flex items-center gap-2 mr-auto lg:mr-0">
              {selected.size > 0 && (
                <span className="text-xs text-[#b8860b] font-semibold bg-[#d6ac40]/10 px-3 py-1.5 rounded-full border border-[#d6ac40]/25">
                  {selected.size} محدد
                </span>
              )}
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allOnPageSel}
                  onCheckedChange={toggleAll}
                  className="border-muted-foreground/30 data-[state=checked]:bg-[#d6ac40] data-[state=checked]:border-[#d6ac40] data-[state=checked]:text-[#0a0a14] rounded-md h-5 w-5 cursor-pointer"
                />
                <span className="text-xs font-bold text-muted-foreground select-none">تحديد الكل</span>
              </div>
            </div>
            
            <div className="h-4 w-px bg-border/40 hidden sm:block" />
            <PaginationBar />
          </div>
        </div>

        {/* Bulk Actions Bar */}
        <AnimatePresence>
          {selected.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              className="flex shrink-0 flex-wrap items-center gap-2.5 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 shadow-md shadow-primary/5"
            >
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-sm font-bold text-primary">{selected.size} مهمة محددة</span>
              </div>
              <div className="mx-1 hidden h-5 w-px bg-primary/25 sm:block" />
              {onBulkComplete && (
                <Button size="sm" variant="ghost" className="h-10 cursor-pointer gap-1.5 rounded-xl px-3 text-xs text-emerald-400 transition-all duration-200 hover:bg-emerald-500/15 active:scale-95"
                  onClick={() => { onBulkComplete(Array.from(selected)); }}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> إكمال المحدد
                </Button>
              )}
              {onBulkPrint && (
                <Button size="sm" variant="ghost" className="h-10 cursor-pointer gap-1.5 rounded-xl px-3 text-xs text-primary transition-all duration-200 hover:bg-primary/15 active:scale-95"
                  onClick={() => { onBulkPrint(Array.from(selected)); }}>
                  <Printer className="h-3.5 w-3.5" /> طباعة المحدد
                </Button>
              )}
              {onBulkDelete && (
                <Button size="sm" variant="ghost" className="mr-auto h-10 cursor-pointer gap-1.5 rounded-xl px-3 text-xs text-rose-400 transition-all duration-200 hover:bg-rose-500/15 active:scale-95"
                  onClick={() => { onBulkDelete(Array.from(selected)); setSelected(new Set()); }}>
                  <Trash2 className="h-3.5 w-3.5" /> حذف المحدد
                </Button>
              )}
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 hover:bg-muted/50 hover:text-foreground active:scale-95"
                aria-label="إلغاء تحديد المهام"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Card list */}
        <div className="flex flex-col gap-4 flex-1 overflow-y-auto pb-4 min-h-0">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 - i * 0.15 }} transition={{ delay: i * 0.06 }}>
                <SkeletonCard />
              </motion.div>
            ))
          ) : paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4 text-muted-foreground">
              <Package className="h-16 w-16 opacity-10" />
              <span className="text-sm opacity-60">لا توجد مهام مطابقة</span>
            </div>
          ) : (
            (() => {
              const groups: Record<string, typeof paginated> = {};
              paginated.forEach(task => {
                const key = getContractGroupKey(task);
                if (!groups[key]) groups[key] = [];
                groups[key].push(task);
              });
              const groupEntries = Object.entries(groups);
              const renderTask = (task: any, idx: number) => {
                const isSelected = selected.has(task.id);

                const installedImg = task.items
                  .map((i: any) => i.installed_image_face_a_url || i.installed_image_url || i.installed_image_face_b_url)
                  .find(Boolean);
                const lastCompleted = task.items.filter((i: any) => i.status === 'completed').slice(-1)[0];

                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.025, ease: 'easeOut' }}
                  >
                    <RemovalMobileTaskCard
                      task={task}
                      billboardById={billboardById}
                      isSelected={isSelected}
                      onToggleSelect={() => toggleOne(task.id)}
                      onCompleteAll={onCompleteAll ? () => onCompleteAll(task.id) : undefined}
                      onPrintPending={() => onPrintTask(task, task.items.filter((i: any) => i.status !== 'completed'))}
                      onPrintCompleted={() => onPrintTask(task, task.items.filter((i: any) => i.status === 'completed'))}
                      onUndoLast={lastCompleted && onUndoRemoval ? () => onUndoRemoval(lastCompleted.id) : undefined}
                      onDelete={() => setDeleteConfirmId(task.id)}
                      onSendWhatsApp={onSendWhatsApp ? () => onSendWhatsApp(task, task.items) : undefined}
                      hasInstalledPhoto={!!installedImg}
                      onViewInstalledPhoto={installedImg ? () => setPreviewImage(installedImg) : undefined}
                      onSyncMissing={onSyncMissingBillboards && task.contract_id ? () => onSyncMissingBillboards(task.contract_id, [task.id]) : undefined}
                    >
                      {/* لوحات المهمة */}
                      <div className="grid grid-cols-1 gap-3 px-3 py-3 md:grid-cols-2 2xl:grid-cols-3">
                        {task.items.map((item: any) => {
                          const billboard = billboardById[item.billboard_id];
                          return (
                            <RemovalTaskItemCard
                              key={item.id}
                              item={item}
                              billboard={billboard || {}}
                              isSelected={selectedItems.has(item.id)}
                              onSelectChange={() => onToggleItem(item.id, task.id)}
                              onComplete={onCompleteItem ? () => onCompleteItem(item.id, task.id) : undefined}
                            />
                          );
                        })}
                      </div>
                      {/* تأكيد حذف المهمة داخل المحتوى */}
                      {deleteConfirmId === task.id && (
                        <div className="mx-3 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
                          <span className="min-w-[160px] flex-1 text-sm font-medium text-rose-400">هل تريد حذف هذه المهمة؟</span>
                          <button
                            type="button"
                            onClick={() => { onDeleteTask(task.id); setDeleteConfirmId(null); }}
                            className="h-10 cursor-pointer rounded-xl bg-rose-500/20 px-4 text-xs font-bold text-rose-400 transition-all duration-200 hover:bg-rose-500/30 active:scale-95"
                          >تأكيد الحذف</button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="h-10 cursor-pointer rounded-xl bg-muted/60 px-4 text-xs text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground active:scale-95"
                          >إلغاء</button>
                        </div>
                      )}
                    </RemovalMobileTaskCard>
                  </motion.div>
                );
              };

              return groupEntries.map(([contractKey, groupTasks]) => {
                const cid = contractKey.startsWith('contract:') ? Number(contractKey.replace('contract:', '')) : null;
                const customerName = groupTasks[0]?.customerName || 'غير محدد';
                const totalBillboards = groupTasks.reduce((s, t) => s + t.totalItems, 0);
                const completedBillboards = groupTasks.reduce((s, t) => s + t.completed, 0);
                const pct = totalBillboards > 0 ? Math.round((completedBillboards / totalBillboards) * 100) : 0;
                const uniqueTeams = [...new Set(groupTasks.map(t => t.team?.team_name).filter(Boolean))];
                const uniqueAdTypes = [...new Set(groupTasks.map(t => t.adType).filter((v: string) => v && v !== '—'))];
                const contractEndDate = groupTasks[0]?.contractEndDate;
                const pendingGroupTasks = groupTasks.filter(t => t.displayStatus !== 'completed');

                return (
                  <Collapsible key={contractKey} defaultOpen className="group/contract overflow-hidden rounded-2xl border border-primary/20 bg-card/45 shadow-sm">
                    <CollapsibleTrigger asChild className="w-full">
                      <div className="relative flex w-full cursor-pointer flex-col gap-3 bg-card/75 p-4 text-right transition-colors duration-200 hover:bg-primary/[0.04] sm:p-5">
                        <div className="absolute inset-y-0 right-0 w-1 bg-primary" />
                        <div className="flex flex-wrap items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                            <FolderOpen className="h-5 w-5" />
                          </div>
                          <div className="min-w-[220px] flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-base font-black text-foreground">{cid ? `عقد #${cid}` : 'مهمة بدون عقد'}</span>
                              <span className={`rounded-lg px-2 py-1 text-[10px] font-black ${pct === 100 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-primary/10 text-primary'}`}>
                                {pct === 100 ? 'مكتمل' : `${pct}% منجز`}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-sm font-bold text-foreground/90">{customerName}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
                              {uniqueAdTypes.length > 0 && (
                                <span className="flex items-center gap-1.5"><Megaphone className="h-3.5 w-3.5 text-primary/80" />{uniqueAdTypes.join('، ')}</span>
                              )}
                              {contractEndDate && (
                                <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-primary/80" />انتهى {new Date(contractEndDate).toLocaleDateString('ar-LY')}</span>
                              )}
                              <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-primary/80" />{uniqueTeams.length || groupTasks.length} {uniqueTeams.length === 1 ? 'فريق' : 'فرق'}</span>
                            </div>
                          </div>

                          <div className="flex min-w-[210px] flex-1 flex-col gap-2 sm:max-w-sm">
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span className="text-muted-foreground">إنجاز لوحات العقد</span>
                              <span className="text-foreground">{completedBillboards} / {totalBillboards}</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-muted/60">
                              <div className={`h-full rounded-full transition-all duration-300 ${pct === 100 ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                            </div>
                            {uniqueTeams.length > 0 && <p className="truncate text-[10px] text-muted-foreground/80">{uniqueTeams.join(' • ')}</p>}
                          </div>

                          <div className="flex items-center gap-1" onClick={event => event.stopPropagation()}>
                            {onBulkPrint && pendingGroupTasks.length > 0 && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-10 cursor-pointer gap-1.5 rounded-xl border-primary/25 bg-primary/5 px-3 text-xs font-bold text-primary transition-all duration-200 hover:bg-primary/10 active:scale-95"
                                onClick={() => onBulkPrint(groupTasks.map(task => task.id))}
                              >
                                <Printer className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">طباعة العقد</span>
                              </Button>
                            )}
                            {onBulkComplete && pendingGroupTasks.length > 0 && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-10 cursor-pointer gap-1.5 rounded-xl border-emerald-500/25 bg-emerald-500/5 px-3 text-xs font-bold text-emerald-400 transition-all duration-200 hover:bg-emerald-500/10 active:scale-95"
                                onClick={() => onBulkComplete(pendingGroupTasks.map(task => task.id))}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span className="hidden lg:inline">إكمال المتبقي</span>
                              </Button>
                            )}
                            {onSyncMissingBillboards && cid && (
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-10 w-10 cursor-pointer rounded-xl text-muted-foreground transition-all duration-200 hover:bg-primary/10 hover:text-primary active:scale-95"
                                onClick={() => onSyncMissingBillboards(cid, groupTasks.map(t => t.id))}
                                aria-label="مزامنة لوحات العقد الناقصة"
                                title="مزامنة اللوحات الناقصة"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          <ChevronDown className="mt-3 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/contract:rotate-180" />
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mr-3 flex flex-col gap-3 border-r border-primary/20 bg-background/25 p-3 pr-4 sm:mr-5 sm:p-4 sm:pr-5">
                        {groupTasks.map((task, idx) => renderTask(task, idx))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              });
            })()
          )}
        </div>

        {/* Bottom Pagination */}
        <div className="flex justify-center mt-2 shrink-0">
          <PaginationBar />
        </div>
      </div>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-0">
          <div className="relative">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 left-4 z-10 rounded-full bg-white/10 hover:bg-white/20 text-white h-10 w-10 flex items-center justify-center transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            {previewImage && (
              <img
                src={previewImage}
                alt="معاينة"
                className="w-full h-auto max-h-[85vh] object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
