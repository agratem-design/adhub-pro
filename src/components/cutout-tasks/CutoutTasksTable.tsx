import React, { useState, useMemo } from 'react';
import { TaskDesignPanel } from '@/components/shared/TaskDesignPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  CheckCircle2, Clock, Package, Scissors, Printer,
  Plus, RefreshCw, XCircle, FolderOpen,
  LayoutList, Layers, FileText,
  ChevronLeft, ChevronRight, ChevronDown, Building2,
  AlertTriangle, TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion } from 'framer-motion';

interface CutoutTask {
  id: string;
  contract_id?: number | null;
  customer_name: string | null;
  status: string;
  total_quantity: number;
  unit_cost: number;
  total_cost: number;
  customer_total_amount?: number;
  priority: string;
  created_at: string;
  printer_id?: string | null;
  printers?: { name: string } | null;
}

interface Props {
  tasks: CutoutTask[];
  isLoading: boolean;
  stats: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    noPrinter: number;
    totalQuantity: number;
    totalCost: number;
    totalRevenue: number;
  };
  onOpenTask: (task: CutoutTask) => void;
  onAddTask: () => void;
  onRefresh: () => void;
  isFetching?: boolean;
  onStatusChange?: (taskId: string, status: string) => void;
  onPrintInvoice?: (task: CutoutTask, type: 'customer' | 'cutout_vendor' | 'installation_team') => void;
}

type SortField = 'client' | 'contract' | 'quantity' | 'cost' | 'status' | 'date' | 'printer';
type SortDir = 'asc' | 'desc';

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string; icon: any }> = {
  completed: { label: 'مكتملة', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400', icon: CheckCircle2 },
  in_progress: { label: 'قيد التنفيذ', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-400', icon: Clock },
  pending: { label: 'جديدة', color: 'bg-slate-500/15 text-slate-400 border-slate-500/30', dot: 'bg-slate-400', icon: Package },
  cancelled: { label: 'ملغاة', color: 'bg-red-500/15 text-red-400 border-red-500/30', dot: 'bg-red-400', icon: XCircle },
};

const ActionBtn = ({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: (e: React.MouseEvent) => void }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={(e) => { e.stopPropagation(); onClick(e); }}
        className="h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-150 border text-muted-foreground border-border/40 hover:bg-purple-500/12 hover:text-purple-400 hover:border-purple-500/30"
      >
        <Icon className="h-4 w-4" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" className="text-xs">{label}</TooltipContent>
  </Tooltip>
);

const SortIcon = ({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) =>
  sortField !== field
    ? <ArrowUpDown className="h-3 w-3 opacity-30" />
    : sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 text-purple-400" />
      : <ArrowDown className="h-3 w-3 text-purple-400" />;

const SkeletonCard = () => (
  <div className="flex rounded-2xl overflow-hidden border border-border/50 bg-card" style={{ minHeight: 100 }}>
    <div className="flex-1 p-5 flex flex-col gap-3">
      <Skeleton className="h-5 w-1/3 rounded-lg" />
      <Skeleton className="h-3.5 w-1/4 rounded" />
      <div className="flex gap-6 mt-2"><Skeleton className="h-3 w-20 rounded" /><Skeleton className="h-3 w-20 rounded" /></div>
    </div>
  </div>
);

/* ── Cutout Task Card with design panel and color tinting ── */
const CutoutTaskCardRow = ({ task, idx, onOpenTask, onStatusChange, onPrintInvoice }: {
  task: CutoutTask; idx: number; onOpenTask: (t: CutoutTask) => void;
  onStatusChange?: (taskId: string, status: string) => void;
  onPrintInvoice?: (task: CutoutTask, type: 'customer' | 'cutout_vendor' | 'installation_team') => void;
}) => {
  const [dominantColor, setDominantColor] = useState<string | null>(null);
  const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
  const designUrls = (task as any)._designImages || [];
  let h = 0;
  for (let i = 0; i < task.id.length; i++) h = task.id.charCodeAt(i) + ((h << 5) - h);
  const accent = `hsl(${Math.abs(h) % 360}, 55%, 58%)`;

  const cardBg = dominantColor
    ? `linear-gradient(to left, rgba(${dominantColor}, 0.22) 0%, rgba(${dominantColor}, 0.10) 35%, rgba(${dominantColor}, 0.03) 70%, hsl(var(--card)) 100%)`
    : `linear-gradient(to left, color-mix(in srgb, ${accent} 12%, transparent) 0%, color-mix(in srgb, ${accent} 4%, transparent) 35%, hsl(var(--card)) 100%)`;
  const cardBorder = dominantColor
    ? `1.5px solid rgba(${dominantColor}, 0.4)`
    : `1.5px solid color-mix(in srgb, ${accent} 20%, hsl(var(--border)/0.5))`;
  const cardShadow = dominantColor
    ? `0 4px 24px rgba(${dominantColor}, 0.25), 0 0 0 1px rgba(${dominantColor}, 0.1)`
    : '0 2px 16px rgba(0,0,0,0.18)';

  const priorityColors: Record<string, string> = {
    urgent: 'bg-red-500/10 text-red-400 border-red-500/20',
    high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    normal: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    low: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };
  const priorityLabels: Record<string, string> = { urgent: 'عاجل', high: 'عالية', normal: 'عادية', low: 'منخفضة' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.02, ease: 'easeOut' }}
      whileHover={{ y: -3, transition: { duration: 0.18 } }}
      onClick={() => onOpenTask(task)}
      className="group relative rounded-2xl overflow-hidden cursor-pointer"
      style={{ background: cardBg, border: cardBorder, boxShadow: cardShadow, minHeight: 140 }}
    >
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
        style={{ boxShadow: dominantColor
          ? `0 12px 40px rgba(${dominantColor}, 0.35), 0 0 0 2px rgba(${dominantColor}, 0.3)`
          : `0 8px 32px rgba(0,0,0,0.30), 0 0 0 1px ${accent}33`
        }}
      />
      <div className="hidden md:flex h-full items-stretch">
        {/* Design Panel */}
        <div className="w-[200px] shrink-0 overflow-hidden relative" onClick={e => e.stopPropagation()}>
          <TaskDesignPanel urls={designUrls} accent={accent} onColorExtracted={setDominantColor} />
          {designUrls && designUrls.length > 1 && (
            <div className="absolute bottom-2.5 right-2.5 z-30 bg-black/60 backdrop-blur-sm text-white px-2 py-0.5 rounded-lg text-[9px] font-bold border border-white/10">
              {designUrls.length} تصاميم
            </div>
          )}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0 px-6 py-5 flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap font-bold text-right">
              <span className="text-lg font-black text-foreground leading-tight">{task.customer_name || 'بدون اسم'}</span>
              {task.priority && task.priority !== 'normal' && (
                <span className={`${priorityColors[task.priority] || ''} font-extrabold text-[10px] h-5 px-2.5 py-0 rounded-full border flex items-center justify-center`}>
                  {priorityLabels[task.priority]}
                </span>
              )}
              {(task as any)._adType && (
                <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-extrabold text-[10px] h-5 px-2.5 py-0 rounded-full flex items-center justify-center">
                  {(task as any)._adType}
                </span>
              )}
              <span className={`font-extrabold text-[10px] h-5 px-2.5 py-0 rounded-full border flex items-center justify-center ${
                (task as any)._source === 'installation'
                  ? 'bg-green-500/10 text-green-400 border-green-500/20'
                  : (task as any)._source === 'contract'
                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                    : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
              }`}>
                {(task as any)._source === 'installation' ? 'عبر مهمة تركيب' : (task as any)._source === 'contract' ? 'من عقد مباشرة' : 'إضافة يدوية'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            {task.contract_id && (
              <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 font-extrabold px-2.5 py-1 rounded-xl font-mono">
                العقد: <span className="text-amber-400">#{task.contract_id}</span>
              </span>
            )}
            {task.printers?.name && (
              <span className="inline-flex items-center gap-1.5 bg-muted/40 border border-border/25 px-2.5 py-1 rounded-xl text-muted-foreground font-semibold">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                <span>{task.printers.name}</span>
              </span>
            )}
            <span className="font-mono text-[10px] text-muted-foreground/40 font-bold bg-muted/20 border border-border/15 px-2 py-0.5 rounded-lg">#{task.id.slice(0, 8)}</span>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-muted-foreground/50 group-hover:text-purple-400/85 transition-colors font-medium">
            <ChevronLeft className="h-3 w-3" />
            فتح التفاصيل
          </div>
        </div>

        {/* Quantity & cost */}
        <div className="w-[200px] shrink-0 px-6 py-5 flex flex-col justify-between border-r border-border/20">
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1">الكمية</div>
            <div className="text-2xl font-black text-foreground">{task.total_quantity} <span className="text-xs font-medium text-muted-foreground">قطع</span></div>
          </div>
          <div className={`mt-1.5 px-3 py-1.5 rounded-xl border ${(task.customer_total_amount || 0) > 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-muted/30 border-border/30'}`}>
            <div className="text-[9px] font-bold text-muted-foreground uppercase leading-none mb-1">المستحق</div>
            <div className={`text-base font-black flex items-baseline gap-1 ${(task.customer_total_amount || 0) > 0 ? 'text-emerald-400' : 'text-muted-foreground/50'}`}>
              {(task.customer_total_amount || 0) > 0 ? (
                <>
                  <span>{(task.customer_total_amount || 0).toLocaleString('ar-LY')}</span>
                  <span className="text-[10px] font-medium text-emerald-400/70">د.ل</span>
                </>
              ) : '—'}
            </div>
          </div>
        </div>

        {/* Status & Date */}
        <div className="w-[140px] shrink-0 px-5 py-5 flex flex-col justify-between items-center border-r border-border/20">
          <span className={`inline-flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-full border font-extrabold whitespace-nowrap shadow-sm ${cfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} shrink-0 animate-pulse`} />
            {cfg.label}
          </span>
          <span className="text-[10px] font-bold text-muted-foreground/60 select-none bg-muted/30 border border-border/20 px-2 py-0.5 rounded-lg font-mono">
            {format(new Date(task.created_at), 'dd MMM yyyy', { locale: ar })}
          </span>
        </div>

        {/* Actions - Status + Invoices */}
        <div className="shrink-0 flex flex-col items-center justify-center gap-2 px-4 py-5 border-r border-border/20" onClick={e => e.stopPropagation()}>
          {onStatusChange && (
            <Select
              value={task.status}
              onValueChange={(val) => onStatusChange(task.id, val)}
            >
              <SelectTrigger className="h-8.5 w-32 text-xs font-bold rounded-xl border-border/40 bg-background/50 hover:bg-muted/50 transition-colors">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">معلق</SelectItem>
                <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                <SelectItem value="completed">مكتمل</SelectItem>
                <SelectItem value="cancelled">ملغي</SelectItem>
              </SelectContent>
            </Select>
          )}
          {onPrintInvoice && (
            <div className="flex gap-1.5">
              <ActionBtn icon={Printer} label="فاتورة المطبعة" onClick={() => onPrintInvoice(task, 'cutout_vendor')} />
              <ActionBtn icon={FileText} label="فاتورة الزبون" onClick={() => onPrintInvoice(task, 'customer')} />
              <ActionBtn icon={Scissors} label="فاتورة الفرقة" onClick={() => onPrintInvoice(task, 'installation_team')} />
            </div>
          )}
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex flex-col md:hidden p-4 gap-3 bg-card/60 backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 text-right">
            <span className="text-base font-extrabold text-foreground leading-tight block">{task.customer_name || 'بدون اسم'}</span>
            <div className="flex flex-wrap gap-1.5">
              {task.contract_id && (
                <span className="text-[10px] font-mono font-bold text-amber-500/80 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">
                  #{task.contract_id}
                </span>
              )}
              {(task as any)._adType && (
                <span className="text-[10px] font-bold text-cyan-400/80 bg-cyan-500/5 px-2 py-0.5 rounded border border-cyan-500/10">
                  {(task as any)._adType}
                </span>
              )}
            </div>
          </div>
          <span className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full border font-extrabold whitespace-nowrap shrink-0 ${cfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 bg-background/40 p-2.5 rounded-xl border border-border/20 text-xs">
          <div>
            <span className="text-muted-foreground/60 block text-[10px] font-bold">الكمية</span>
            <span className="font-extrabold text-foreground">{task.total_quantity} قطعة</span>
          </div>
          <div>
            <span className="text-muted-foreground/60 block text-[10px] font-bold">المستحق</span>
            <span className={`font-extrabold ${(task.customer_total_amount || 0) > 0 ? 'text-emerald-400' : 'text-muted-foreground/50'}`}>
              {(task.customer_total_amount || 0) > 0 ? `${(task.customer_total_amount || 0).toLocaleString('ar-LY')} د.ل` : '—'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border/20 pt-3" onClick={e => e.stopPropagation()}>
          <div className="text-[10px] text-muted-foreground/50 font-bold">
            {format(new Date(task.created_at), 'dd MMM yyyy', { locale: ar })}
          </div>
          {onPrintInvoice && (
            <div className="flex gap-1">
              <ActionBtn icon={Printer} label="فاتورة المطبعة" onClick={() => onPrintInvoice(task, 'cutout_vendor')} />
              <ActionBtn icon={FileText} label="فاتورة الزبون" onClick={() => onPrintInvoice(task, 'customer')} />
              <ActionBtn icon={Scissors} label="فاتورة الفرقة" onClick={() => onPrintInvoice(task, 'installation_team')} />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export const CutoutTasksTable: React.FC<Props> = ({
  tasks, isLoading, stats, onOpenTask, onAddTask, onRefresh, isFetching, onStatusChange, onPrintInvoice,
}) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    setPage(1);
  };

  const filtered = useMemo(() => {
    let r = [...tasks];
    if (filterStatus !== 'all') r = r.filter(t => t.status === filterStatus);
    if (search) {
      const s = search.toLowerCase();
      r = r.filter(t =>
        t.customer_name?.toLowerCase().includes(s) ||
        String(t.contract_id).includes(s) ||
        t.printers?.name?.toLowerCase().includes(s)
      );
    }
    return r;
  }, [tasks, filterStatus, search]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let av: any, bv: any;
    switch (sortField) {
      case 'client': av = a.customer_name || ''; bv = b.customer_name || ''; break;
      case 'contract': av = a.contract_id || 0; bv = b.contract_id || 0; break;
      case 'quantity': av = a.total_quantity; bv = b.total_quantity; break;
      case 'cost': av = a.customer_total_amount || 0; bv = b.customer_total_amount || 0; break;
      case 'status': av = a.status; bv = b.status; break;
      case 'date': av = a.created_at; bv = b.created_at; break;
      case 'printer': av = a.printers?.name || ''; bv = b.printers?.name || ''; break;
      default: av = a.created_at; bv = b.created_at;
    }
    const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return sortDir === 'asc' ? cmp : -cmp;
  }), [filtered, sortField, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const SortPill = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 border ${
        sortField === field
          ? 'bg-purple-500/15 text-purple-400 border-purple-500/35 shadow-sm'
          : 'text-muted-foreground bg-background/25 border-border/25 hover:text-purple-400 hover:border-purple-500/30'
      }`}
    >
      {label}
      <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
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
          <Button variant="outline" size="sm" className="h-7 px-2 border-border/30 rounded-xl text-[10px] gap-1 font-bold text-muted-foreground/80 hover:text-foreground hover:bg-muted/50" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronRight className="h-3 w-3" />السابق
          </Button>
          {startPage > 1 && (<><Button size="sm" className="h-7 w-7 p-0 text-[10px] rounded-xl bg-transparent hover:bg-muted/50 text-muted-foreground border border-transparent" onClick={() => setPage(1)}>1</Button>{startPage > 2 && <span className="text-muted-foreground/40 px-1 text-[10px]">...</span>}</>)}
          {pageNumbers.map(p => (
            <Button key={p} size="sm" className={`h-7 w-7 p-0 text-[10px] rounded-xl transition-all ${p === page ? 'bg-primary hover:bg-primary/90 text-primary-foreground font-black shadow-md shadow-primary/10' : 'bg-transparent hover:bg-muted/50 text-muted-foreground border border-transparent'}`} onClick={() => setPage(p)}>{p}</Button>
          ))}
          {endPage < totalPages && (<>{endPage < totalPages - 1 && <span className="text-muted-foreground/40 px-1 text-[10px]">...</span>}<Button size="sm" className="h-7 w-7 p-0 text-[10px] rounded-xl bg-transparent hover:bg-muted/50 text-muted-foreground border border-transparent" onClick={() => setPage(totalPages)}>{totalPages}</Button></>)}
          <Button variant="outline" size="sm" className="h-7 px-2 border-border/30 rounded-xl text-[10px] gap-1 font-bold text-muted-foreground/80 hover:text-foreground hover:bg-muted/50" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            التالي<ChevronLeft className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-col h-full gap-4.5" dir="rtl">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4.5 shrink-0">
          {[
            { label: 'إجمالي المهام', value: stats.total, color: 'text-purple-400', icon: LayoutList, bg: 'bg-purple-500/10', border: 'border-purple-500/20', accent: 'bg-purple-500', pct: 100 },
            { label: 'معلقة', value: stats.pending, color: 'text-amber-400', icon: Clock, bg: 'bg-amber-500/10', border: 'border-amber-500/20', accent: 'bg-amber-500', pct: stats.total > 0 ? Math.round((stats.pending / stats.total) * 100) : 0 },
            { label: 'مكتملة', value: stats.completed, color: 'text-emerald-400', icon: CheckCircle2, bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', accent: 'bg-emerald-500', pct: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0 },
            { label: 'إجمالي القطع', value: stats.totalQuantity.toLocaleString(), color: 'text-pink-400', icon: Scissors, bg: 'bg-pink-500/10', border: 'border-pink-500/20', accent: 'bg-pink-500', pct: stats.total > 0 ? Math.min(100, Math.round((stats.totalQuantity / (stats.total * 5 || 1)) * 100)) : 0 },
            { label: 'الإيرادات', value: `${stats.totalRevenue.toLocaleString()} د.ل`, color: 'text-cyan-400', icon: TrendingUp, bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', accent: 'bg-cyan-500', pct: stats.totalRevenue > 0 ? 100 : 0 },
          ].map(({ label, value, color, icon: Icon, bg, border, accent, pct }) => (
            <div
              key={label}
              className={`bg-card/45 backdrop-blur-md border ${border} rounded-[22px] p-4.5 flex flex-col justify-between min-h-[135px] shadow-sm relative overflow-hidden group select-none transition-all duration-300 hover:shadow-md hover:scale-[1.01]`}
            >
              {/* Top Accent Line */}
              <div className={`absolute top-0 right-0 left-0 h-[3px] ${accent} opacity-70 group-hover:opacity-100 transition-opacity`} />
              
              <div className="flex items-start justify-between">
                <div className="text-right">
                  <p className="text-[11px] font-bold text-muted-foreground/80 leading-none mb-2">{label}</p>
                  <p className={`text-2xl font-black tracking-tight ${color}`}>{value}</p>
                </div>
                <div className={`p-2.5 rounded-xl ${bg} ${color} group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
              </div>

              {/* Progress Indicator */}
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between text-[9px] font-bold text-muted-foreground/60">
                  <span>نسبة الإنجاز</span>
                  <span className="font-mono">{pct}%</span>
                </div>
                <div className="h-1 w-full bg-muted/40 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${accent} rounded-full transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Warning */}
        {stats.noPrinter > 0 && (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 backdrop-blur-md rounded-2xl px-4 py-3 select-none">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
            <p className="text-xs font-semibold text-red-400/90">{stats.noPrinter} مهمة معلقة لم يتم تعيين مطبعة لها بعد.</p>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-3 shrink-0 bg-card/45 backdrop-blur-md border border-border/30 rounded-[22px] p-4 shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <Input 
              value={search} 
              onChange={e => { setSearch(e.target.value); setPage(1); }} 
              placeholder="بحث بالاسم أو رقم العقد أو المطبعة..." 
              className="pr-10 bg-background/50 border-border/30 rounded-xl h-10 text-xs text-foreground placeholder:text-muted-foreground/65 focus-visible:ring-purple-500/50" 
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-1.5 mr-auto">
            {(['all', 'pending', 'in_progress', 'completed'] as const).map(s => (
              <button 
                key={s} 
                onClick={() => { setFilterStatus(s); setPage(1); }}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                  filterStatus === s 
                    ? 'bg-purple-500/15 text-purple-400 border-purple-500/35 shadow-sm shadow-purple-500/5' 
                    : 'text-muted-foreground bg-background/40 border-border/30 hover:border-purple-500/20 hover:text-foreground'
                }`}
              >
                {s === 'all' ? 'الكل' : STATUS_CONFIG[s]?.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <PaginationBar />
          </div>
        </div>

        {/* Sort pills */}
        <div className="flex flex-wrap gap-1.5 items-center bg-muted/20 border border-border/20 rounded-xl p-2 shrink-0">
          <span className="text-[10px] font-bold text-muted-foreground/60 px-2 select-none">ترتيب حسب:</span>
          <SortPill field="client" label="الزبون" />
          <SortPill field="contract" label="العقد" />
          <SortPill field="quantity" label="الكمية" />
          <SortPill field="cost" label="الإيرادات" />
          <SortPill field="printer" label="المطبعة" />
          <SortPill field="date" label="التاريخ" />
        </div>

        {/* Task cards - grouped by contract */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}</div>
          ) : paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Scissors className="h-12 w-12 opacity-30" />
              <p className="text-lg font-medium">لا توجد مهام</p>
            </div>
          ) : (() => {
            const groups: Record<string, typeof paginated> = {};
            paginated.forEach(task => {
              const key = String(task.contract_id || 'no-contract');
              if (!groups[key]) groups[key] = [];
              groups[key].push(task);
            });
            const groupEntries = Object.entries(groups);
            if (groupEntries.every(([, g]) => g.length === 1)) {
              return (
                <div className="space-y-3.5">
                  {paginated.map((task, idx) => (
                    <CutoutTaskCardRow key={task.id} task={task} idx={idx} onOpenTask={onOpenTask} onStatusChange={onStatusChange} onPrintInvoice={onPrintInvoice} />
                  ))}
                </div>
              );
            }
            return (
              <div className="space-y-4">
                {groupEntries.map(([contractKey, groupTasks]) => {
                  const cid = contractKey !== 'no-contract' ? Number(contractKey) : null;
                  const customerName = groupTasks[0]?.customer_name || 'بدون اسم';
                  const totalQty = groupTasks.reduce((s, t) => s + t.total_quantity, 0);
                  const totalRevenue = groupTasks.reduce((s, t) => s + (t.customer_total_amount || 0), 0);
                  return groupTasks.length === 1 ? (
                    <CutoutTaskCardRow key={groupTasks[0].id} task={groupTasks[0]} idx={0} onOpenTask={onOpenTask} onStatusChange={onStatusChange} onPrintInvoice={onPrintInvoice} />
                  ) : (
                    <Collapsible key={contractKey} defaultOpen>
                      <CollapsibleTrigger className="w-full">
                        <div className="bg-card/45 backdrop-blur-md border border-border/30 rounded-2xl px-5 py-3.5 flex flex-wrap items-center gap-3 hover:bg-muted/30 transition-all duration-200 cursor-pointer shadow-sm">
                          <FolderOpen className="h-5 w-5 text-purple-500 shrink-0" />
                          {cid && <span className="font-extrabold text-foreground text-base">عقد #{cid}</span>}
                          <span className="text-sm font-bold text-muted-foreground">— {customerName}</span>
                          <div className="flex items-center gap-3 mr-auto">
                            <span className="text-xs font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-xl">
                              <Layers className="h-3 w-3 inline ml-1" />{groupTasks.length} مهمة
                            </span>
                            <span className="text-xs font-bold text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-xl">
                              {totalQty} قطعة
                            </span>
                            {totalRevenue > 0 && (
                              <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl">
                                {totalRevenue.toLocaleString()} د.ل
                              </span>
                            )}
                            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="flex flex-col gap-3.5 pr-4 pt-3.5 pb-1.5 border-r-2 border-purple-500/20 mr-4">
                          {groupTasks.map((task, idx) => (
                            <CutoutTaskCardRow key={task.id} task={task} idx={idx} onOpenTask={onOpenTask} onStatusChange={onStatusChange} onPrintInvoice={onPrintInvoice} />
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Bottom Pagination */}
        <div className="flex justify-center mt-2">
          <PaginationBar />
        </div>
      </div>
    </TooltipProvider>
  );
};
