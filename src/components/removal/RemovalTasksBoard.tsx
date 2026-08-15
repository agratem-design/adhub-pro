import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
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
  AlertTriangle,
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
      ? <ArrowUp className="h-3 w-3 text-red-400" />
      : <ArrowDown className="h-3 w-3 text-red-400" />;

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
  const PAGE_SIZE = 15;

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    onPageChange(1);
  };

  const itemsByTask = useMemo(() => {
    const m: Record<string, any[]> = {};
    allTaskItems.forEach(i => { if (!m[i.task_id]) m[i.task_id] = []; m[i.task_id].push(i); });
    return m;
  }, [allTaskItems]);

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
  }), [tasks, allTaskItems, contractByNumber, teamById, itemsByTask]);

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

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const allOnPageSel = paginated.length > 0 && paginated.every(t => selected.has(t.id));
  const toggleAll = () => {
    const next = new Set(selected);
    allOnPageSel ? paginated.forEach(t => next.delete(t.id)) : paginated.forEach(t => next.add(t.id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const SortPill = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 border ${
        sortField === field
          ? 'bg-red-500/15 text-red-400 border-red-500/30'
          : 'text-muted-foreground border-border/40 hover:text-red-400 hover:border-red-500/20'
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
          <span>{sorted.length > 0 ? `عرض ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, sorted.length)} من ${sorted.length} مهمة` : 'لا توجد نتائج'}</span>
          <span className="text-[10px] text-muted-foreground/35 font-normal">|</span>
          <span className="text-[10px] text-muted-foreground/50 font-normal">الصفحة {page} من {totalPages}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 px-2 border-border/30 rounded-xl text-[10px] gap-1 font-bold text-muted-foreground/80 hover:text-foreground hover:bg-muted/50" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronRight className="h-3 w-3" />السابق
          </Button>
          {startPage > 1 && (<><Button size="sm" className="h-7 w-7 p-0 text-[10px] rounded-xl bg-transparent hover:bg-muted/50 text-muted-foreground border border-transparent" onClick={() => onPageChange(1)}>1</Button>{startPage > 2 && <span className="text-muted-foreground/40 px-1 text-[10px]">...</span>}</>)}
          {pageNumbers.map(p => (
            <Button key={p} size="sm" className={`h-7 w-7 p-0 text-[10px] rounded-xl transition-all ${p === page ? 'bg-primary hover:bg-primary/90 text-primary-foreground font-black shadow-md shadow-primary/10' : 'bg-transparent hover:bg-muted/50 text-muted-foreground border border-transparent'}`} onClick={() => onPageChange(p)}>{p}</Button>
          ))}
          {endPage < totalPages && (<>{endPage < totalPages - 1 && <span className="text-muted-foreground/40 px-1 text-[10px]">...</span>}<Button size="sm" className="h-7 w-7 p-0 text-[10px] rounded-xl bg-transparent hover:bg-muted/50 text-muted-foreground border border-transparent" onClick={() => onPageChange(totalPages)}>{totalPages}</Button></>)}
          <Button variant="outline" size="sm" className="h-7 px-2 border-border/30 rounded-xl text-[10px] gap-1 font-bold text-muted-foreground/80 hover:text-foreground hover:bg-muted/50" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            التالي<ChevronLeft className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="flex flex-col h-full gap-4.5" dir="rtl">

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4.5 shrink-0">
          {[
            { label: 'إجمالي المهام', value: totalTasks, color: 'text-red-400', icon: LayoutList, bg: 'bg-red-500/10', border: 'border-red-500/20', accent: 'bg-red-500', pct: 100 },
            { label: 'معلقة', value: pendingTasks, color: 'text-amber-400', icon: Clock, bg: 'bg-amber-500/10', border: 'border-amber-500/20', accent: 'bg-amber-500', pct: totalTasks > 0 ? Math.round((pendingTasks / totalTasks) * 100) : 0 },
            { label: 'مكتملة', value: completedTasks, color: 'text-emerald-400', icon: CheckCircle2, bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', accent: 'bg-emerald-500', pct: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0 },
            { label: 'إجمالي اللوحات', value: totalItems, color: 'text-blue-400', icon: Layers, bg: 'bg-blue-500/10', border: 'border-blue-500/20', accent: 'bg-blue-500', pct: 100 },
            { label: 'لوحات مُزالة', value: completedItems, color: 'text-emerald-400', icon: CheckCircle2, bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', accent: 'bg-emerald-500', pct: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0 },
          ].map(({ label, value, color, icon: Icon, bg, border, accent, pct }) => (
            <div key={label} className={`relative bg-card/45 backdrop-blur-lg border ${border} rounded-2xl p-5 flex flex-col justify-between min-h-[135px] transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20 group overflow-hidden text-right`} style={{ background: `linear-gradient(135deg, hsl(var(--card)/0.8) 0%, hsl(var(--card)/0.45) 100%)` }}>
              <div className={`absolute top-0 left-0 right-0 h-[3px] ${accent} opacity-70 group-hover:opacity-100 transition-opacity`} />
              <div className="flex items-start justify-between">
                <div className="space-y-1.5 text-right flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-muted-foreground/80 tracking-wide uppercase truncate">{label}</p>
                  <p className="text-2xl font-black tracking-tight text-foreground leading-none">{value}</p>
                </div>
                <div className={`p-2.5 rounded-xl ${bg} border border-white/5 transition-all duration-300 group-hover:scale-105 shrink-0 mr-3`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
              </div>
              <div className="space-y-2 mt-2 text-right">
                <div className="flex items-center justify-between text-[10px] font-extrabold text-muted-foreground/60">
                  <span>النسبة:</span>
                  <span className={color}>{pct}%</span>
                </div>
                <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden border border-white/5">
                  <div className={`h-full rounded-full ${accent} transition-all duration-500`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs: معلقة / مكتملة */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => { setActiveTab('active'); onPageChange(1); }}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
              activeTab === 'active'
                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                : 'bg-card text-muted-foreground border-border hover:border-red-500/20'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5 inline ml-1.5" />
            معلقة / قيد التنفيذ ({activeCount})
          </button>
          <button
            onClick={() => { setActiveTab('completed'); onPageChange(1); }}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
              activeTab === 'completed'
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-card text-muted-foreground border-border hover:border-emerald-500/20'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5 inline ml-1.5" />
            مكتملة ({completedCount})
          </button>
        </div>

        {/* Toolbar & Filter Control Center */}
        <div className="bg-card/55 backdrop-blur-lg border border-border/30 rounded-[22px] p-4 flex flex-col lg:flex-row gap-4.5 items-center justify-between shrink-0 shadow-lg">
          <div className="flex flex-wrap items-center gap-3 flex-1 w-full lg:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <Input
                placeholder="بحث برقم العقد، الزبون، الفريق..."
                value={search}
                onChange={e => { setSearch(e.target.value); onPageChange(1); }}
                className="pr-10 bg-background border-border/50 rounded-xl h-10 text-sm"
              />
            </div>
            
            {/* Status Select */}
            <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); onPageChange(1); }}>
              <SelectTrigger className="w-[145px] h-10 bg-background border-border/50 text-sm rounded-xl">
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
              <SelectTrigger className="w-[155px] h-10 bg-background border-border/50 text-sm rounded-xl">
                <SelectValue placeholder="الفريق" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفرق</SelectItem>
                {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.team_name}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* Print all for team - improved UI */}
            {onPrintAllTeam && (
              <div className="flex items-center gap-2">
                {/* Print ALL pending button */}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10 px-3 gap-2 rounded-xl border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/60 font-bold text-xs transition-all"
                  onClick={() => {
                    // Print first team that has pending items
                    const firstTeam = teams.find(t => enriched.some(task => task.team_id === t.id && task.items?.some((i: any) => i.status !== 'completed')));
                    if (firstTeam) onPrintAllTeam(firstTeam.id);
                  }}
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">طباعة</span>
                </Button>

                {/* Per-team dropdown */}
                <Select onValueChange={(teamId) => onPrintAllTeam(teamId)}>
                  <SelectTrigger className="h-10 bg-amber-500/8 border-amber-500/25 text-amber-500 rounded-xl w-auto px-3 gap-1.5 hover:bg-amber-500/15 transition-all text-xs font-bold">
                    <span>فرقة</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wide">طباعة مهام الفرقة</div>
                    {teams
                      .filter(t => enriched.some(task => task.team_id === t.id && task.items?.some((i: any) => i.status !== 'completed')))
                      .map(t => (
                        <SelectItem key={t.id} value={t.id} className="gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-400" />
                            <span>{t.team_name}</span>
                          </div>
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Sort pills */}
            <div className="hidden lg:flex items-center gap-2">
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
              className="bg-[#d6ac40]/10 border border-[#d6ac40]/30 rounded-2xl px-5 py-3 flex flex-wrap gap-2.5 items-center shrink-0 shadow-md shadow-[#d6ac40]/5"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#d6ac40] animate-pulse" />
                <span className="text-[#b8860b] font-bold text-sm">{selected.size} مهمة محددة</span>
              </div>
              <div className="w-px h-5 bg-red-500/25 mx-1" />
              {onBulkComplete && (
                <Button size="sm" variant="ghost" className="h-8 px-3 text-xs gap-1.5 text-emerald-400 hover:bg-emerald-500/15 rounded-xl"
                  onClick={() => { onBulkComplete(Array.from(selected)); }}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> إكمال المحدد
                </Button>
              )}
              {onBulkPrint && (
                <Button size="sm" variant="ghost" className="h-8 px-3 text-xs gap-1.5 text-amber-400 hover:bg-amber-500/15 rounded-xl"
                  onClick={() => { onBulkPrint(Array.from(selected)); }}>
                  <Printer className="h-3.5 w-3.5" /> طباعة المحدد
                </Button>
              )}
              {onBulkDelete && (
                <Button size="sm" variant="ghost" className="h-8 px-3 text-xs gap-1.5 text-red-400 hover:bg-red-500/15 mr-auto rounded-xl"
                  onClick={() => { onBulkDelete(Array.from(selected)); setSelected(new Set()); }}>
                  <Trash2 className="h-3.5 w-3.5" /> حذف المحدد
                </Button>
              )}
              <button
                onClick={() => setSelected(new Set())}
                className="h-8 w-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
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
                const key = String(task.contract_id || 'no-contract');
                if (!groups[key]) groups[key] = [];
                groups[key].push(task);
              });
              const groupEntries = Object.entries(groups);
              const allSingle = groupEntries.every(([, g]) => g.length === 1);

              const renderTask = (task: any, idx: number) => {
                const isSelected = selected.has(task.id);

                const installedImg = task.items.map((i: any) => i.installed_image_url).find(Boolean);
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
                      <div className="px-4 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                        <div className="mx-4 mb-4 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                          <span className="text-sm text-red-400 font-medium flex-1">تأكيد حذف المهمة؟</span>
                          <button
                            onClick={() => { onDeleteTask(task.id); setDeleteConfirmId(null); }}
                            className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/35 transition-colors"
                          >نعم</button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-3 py-1.5 rounded-lg bg-muted/60 text-muted-foreground text-xs hover:bg-muted transition-colors"
                          >لا</button>
                        </div>
                      )}
                    </RemovalMobileTaskCard>
                  </motion.div>
                );
              };

              if (allSingle) {
                return paginated.map((task, idx) => renderTask(task, idx));
              }

              return groupEntries.map(([contractKey, groupTasks]) => {
                const cid = contractKey !== 'no-contract' ? Number(contractKey) : null;
                const customerName = groupTasks[0]?.customerName || 'غير محدد';
                const totalBillboards = groupTasks.reduce((s, t) => s + t.totalItems, 0);
                const completedBillboards = groupTasks.reduce((s, t) => s + t.completed, 0);
                const pct = totalBillboards > 0 ? Math.round((completedBillboards / totalBillboards) * 100) : 0;
                const uniqueTeams = [...new Set(groupTasks.map(t => t.team?.team_name).filter(Boolean))];

                if (groupTasks.length === 1) return renderTask(groupTasks[0], 0);

                return (
                  <Collapsible key={contractKey} defaultOpen>
                    <CollapsibleTrigger asChild className="w-full">
                      <div className="bg-card border border-border rounded-2xl px-5 py-3 flex flex-wrap items-center gap-3 hover:bg-muted/30 transition-colors cursor-pointer">
                        <FolderOpen className="h-5 w-5 text-red-500 shrink-0" />
                        {cid && <span className="font-bold text-foreground text-base">عقد #{cid}</span>}
                        <span className="text-sm text-muted-foreground">— {customerName}</span>
                        <div className="flex items-center gap-3 mr-auto">
                          <span className="text-xs text-muted-foreground bg-muted/60 px-2 py-1 rounded-lg">
                            <Users className="h-3 w-3 inline ml-1" />{groupTasks.length} فريق
                          </span>
                          <span className="text-xs text-muted-foreground bg-muted/60 px-2 py-1 rounded-lg">
                            <Layers className="h-3 w-3 inline ml-1" />{completedBillboards}/{totalBillboards} لوحة
                          </span>
                          <span className={`text-xs font-bold px-2 py-1 rounded-lg ${pct === 100 ? 'bg-emerald-500/15 text-emerald-400' : pct > 0 ? 'bg-amber-500/15 text-amber-400' : 'bg-muted/60 text-muted-foreground'}`}>
                            {pct}%
                          </span>
                          {uniqueTeams.length > 0 && (
                            <span className="text-[10px] text-muted-foreground/70 truncate max-w-[200px]">{uniqueTeams.join(' • ')}</span>
                          )}
                          {onSyncMissingBillboards && cid && (
                            <span onClick={e => e.stopPropagation()}>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs gap-1 hover:bg-emerald-500/10 hover:text-emerald-500"
                                onClick={() => onSyncMissingBillboards(cid, groupTasks.map(t => t.id))}
                              >
                                <Package className="h-3.5 w-3.5" />
                                إضافة الناقصة
                              </Button>
                            </span>
                          )}
                          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="flex flex-col gap-3 pr-4 pt-2 pb-1 border-r-2 border-red-500/20 mr-4">
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
