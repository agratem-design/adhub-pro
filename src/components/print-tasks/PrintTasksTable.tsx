import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TaskDesignPanel } from '@/components/shared/TaskDesignPanel';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  CheckCircle2, Clock, Package, Printer,
  Plus, RefreshCw, XCircle, Trash2,
  LayoutList, Layers, FileText, FolderOpen,
  ChevronLeft, ChevronRight, ChevronDown, Building2,
  AlertTriangle, TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion } from 'framer-motion';

interface PrintTask {
  id: string;
  contract_id: number | null;
  customer_name: string | null;
  status: string;
  total_area: number;
  total_cost: number;
  customer_total_amount: number;
  priority: string;
  price_per_meter: number;
  created_at: string;
  printer_id: string | null;
  is_composite: boolean;
  printers?: { name: string } | null;
  printed_invoices?: { invoice_number: string } | null;
  _contractIds?: number[];
  _designImages?: string[];
}

interface Props {
  tasks: PrintTask[];
  isLoading: boolean;
  stats: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    noPrinter: number;
    totalArea: number;
    totalCost: number;
    totalRevenue: number;
  };
  onOpenTask: (task: PrintTask) => void;
  onAddTask: () => void;
  onRefresh: () => void;
  onDeleteDuplicates?: () => void;
  duplicateCount?: number;
  isFetching?: boolean;
  onStatusChange?: (taskId: string, status: string) => void;
  onPrintInvoice?: (task: PrintTask, type: 'customer' | 'print_vendor' | 'installation_team') => void;
  onChangePrinter?: (taskId: string, printerId: string) => void;
}

type SortField = 'client' | 'contract' | 'area' | 'cost' | 'status' | 'date' | 'printer';
type SortDir = 'asc' | 'desc';

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string; icon: any }> = {
  completed: { label: 'مكتملة', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400', icon: CheckCircle2 },
  in_progress: { label: 'قيد التنفيذ', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-400', icon: Clock },
  pending: { label: 'جديدة', color: 'bg-slate-500/15 text-slate-400 border-slate-500/30', dot: 'bg-slate-400', icon: Package },
  cancelled: { label: 'ملغاة', color: 'bg-red-500/15 text-red-400 border-red-500/30', dot: 'bg-red-400', icon: XCircle },
};

const ActionBtn = ({ icon: Icon, label, onClick, danger = false }: { icon: any; label: string; onClick: (e: React.MouseEvent) => void; danger?: boolean }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={(e) => { e.stopPropagation(); onClick(e); }}
        className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-150 border ${
          danger
            ? 'text-red-400/70 border-red-500/15 hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/30'
            : 'text-muted-foreground border-border/40 hover:bg-blue-500/12 hover:text-blue-400 hover:border-blue-500/30'
        }`}
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
      ? <ArrowUp className="h-3 w-3 text-blue-400" />
      : <ArrowDown className="h-3 w-3 text-blue-400" />;

const SkeletonCard = () => (
  <div className="flex rounded-2xl overflow-hidden border border-border/50 bg-card" style={{ minHeight: 100 }}>
    <div className="flex-1 p-5 flex flex-col gap-3">
      <Skeleton className="h-5 w-1/3 rounded-lg" />
      <Skeleton className="h-3.5 w-1/4 rounded" />
      <div className="flex gap-6 mt-2"><Skeleton className="h-3 w-20 rounded" /><Skeleton className="h-3 w-20 rounded" /></div>
    </div>
  </div>
);
/* ── Print Task Card with design panel and color tinting ── */
const PrintTaskCardRow = ({ task, idx, onOpenTask, priorityColors, priorityLabels, onStatusChange, onPrintInvoice }: {
  task: PrintTask; idx: number; onOpenTask: (t: PrintTask) => void;
  priorityColors: Record<string, string>; priorityLabels: Record<string, string>;
  onStatusChange?: (taskId: string, status: string) => void;
  onPrintInvoice?: (task: PrintTask, type: 'customer' | 'print_vendor' | 'installation_team') => void;
}) => {
  const [dominantColor, setDominantColor] = useState<string | null>(null);
  const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
  const contractIds = (task as any)._contractIds || [task.contract_id].filter(Boolean);
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
        <div className="w-[200px] shrink-0 overflow-hidden relative" onClick={e => e.stopPropagation()}>
          <TaskDesignPanel urls={designUrls} accent={accent} onColorExtracted={setDominantColor} />
          {designUrls && designUrls.length > 1 && (
            <div className="absolute bottom-2.5 right-2.5 z-30 bg-black/60 backdrop-blur-sm text-white px-2 py-0.5 rounded-lg text-[9px] font-bold border border-white/10">
              {designUrls.length} تصاميم
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 px-6 py-5 flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap font-bold text-right">
              <span className="text-lg font-black text-foreground leading-tight">{task.customer_name || 'بدون اسم'}</span>
              {task.is_composite && (
                <Badge className="bg-purple-500/10 text-purple-400 border border-purple-500/20 font-extrabold text-[10px] h-5 px-2.5 py-0 rounded-full">مجمعة</Badge>
              )}
              {task.priority && task.priority !== 'normal' && (
                <Badge className={`${priorityColors[task.priority] || ''} font-extrabold text-[10px] h-5 px-2.5 py-0 rounded-full`}>
                  {priorityLabels[task.priority]}
                </Badge>
              )}
              {(task as any)._adType && (
                <Badge className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-extrabold text-[10px] h-5 px-2.5 py-0 rounded-full">
                  {(task as any)._adType}
                </Badge>
              )}
              <Badge className={`font-extrabold text-[10px] h-5 px-2.5 py-0 rounded-full ${
                (task as any)._source === 'installation'
                  ? 'bg-green-500/10 text-green-400 border-green-500/20'
                  : (task as any)._source === 'contract'
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
              }`}>
                {(task as any)._source === 'installation' ? 'عبر مهمة تركيب' : (task as any)._source === 'contract' ? 'من عقد مباشرة' : 'إضافة يدوية'}
              </Badge>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 font-extrabold px-2.5 py-1 rounded-xl font-mono">
              العقد: {contractIds.length > 1 ? (
                <span className="flex items-center gap-1 text-amber-400">
                  {contractIds.slice(0, 3).map((cId: number) => `#${cId}`).join(', ')}
                  {contractIds.length > 3 && ` +${contractIds.length - 3}`}
                </span>
              ) : (
                <span className="text-amber-400">#{task.contract_id || '—'}</span>
              )}
            </span>
            {task.printers?.name && (
              <span className="inline-flex items-center gap-1.5 bg-muted/40 border border-border/25 px-2.5 py-1 rounded-xl text-muted-foreground font-semibold">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                <span>{task.printers.name}</span>
              </span>
            )}
            <span className="font-mono text-[10px] text-muted-foreground/40">#{task.id.slice(0, 8)}</span>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-muted-foreground/50 group-hover:text-blue-400/80 transition-colors font-medium">
            <ChevronLeft className="h-3 w-3" />
            فتح التفاصيل
          </div>
        </div>

        <div className="w-[180px] shrink-0 px-6 py-5 flex flex-col justify-between border-r border-border/20">
           <div className="text-2xl font-black text-foreground">{task.total_area.toFixed(0)} <span className="text-xs font-medium text-muted-foreground">م²</span></div>
           <div className={`mt-1.5 px-3 py-1.5 rounded-xl border ${task.customer_total_amount > 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-muted/30 border-border/30'}`}>
             <div className="text-[9px] font-bold text-muted-foreground uppercase">المستحق</div>
             <div className={`text-base font-black ${task.customer_total_amount > 0 ? 'text-emerald-400' : 'text-muted-foreground/50'}`}>
                {task.customer_total_amount > 0 ? task.customer_total_amount.toLocaleString('ar-LY') : '—'}
             </div>
           </div>
        </div>

        <div className="w-[120px] shrink-0 px-4 py-5 flex flex-col justify-center items-center gap-2 border-r border-border/20">
          <span className={`inline-flex items-center gap-1.5 text-[10px] px-3 py-1 rounded-full border font-bold ${cfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
          <span className="text-[10px] text-muted-foreground font-medium">
            {format(new Date(task.created_at), 'dd MMM yyyy', { locale: ar })}
          </span>
        </div>

        <div className="shrink-0 flex flex-col items-center justify-center gap-2 px-3 py-3" onClick={e => e.stopPropagation()}>
          {onStatusChange && (
            <Select value={task.status} onValueChange={(val) => onStatusChange(task.id, val)}>
              <SelectTrigger className="h-8 w-28 text-[10px] rounded-xl border-border/30">
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
            <div className="flex gap-1">
              <ActionBtn icon={Printer} label="فاتورة المطبعة" onClick={() => onPrintInvoice(task, 'print_vendor')} />
              <ActionBtn icon={FileText} label="فاتورة الزبون" onClick={() => onPrintInvoice(task, 'customer')} />
              <ActionBtn icon={Layers} label="فاتورة الفرقة" onClick={() => onPrintInvoice(task, 'installation_team')} />
            </div>
          )}
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex flex-col md:hidden p-3 gap-2">
        <div className="flex items-center justify-between border-b border-border/20 pb-2">
          <span className="text-base font-bold text-foreground truncate">{task.customer_name || 'بدون اسم'}</span>
          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border font-semibold ${cfg.color} shrink-0`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3 text-blue-500/70" />
            <span className="font-mono text-blue-400 font-semibold">#{task.contract_id || '—'}</span>
          </span>
          <span>{task.total_area.toFixed(0)} م²</span>
          <span className={task.customer_total_amount > 0 ? 'text-emerald-400 font-semibold' : 'text-muted-foreground/50'}>
            {task.customer_total_amount > 0 ? `${task.customer_total_amount.toLocaleString('ar-LY')} د.ل` : 'لا يوجد استحقاق'}
          </span>
        </div>
        {onPrintInvoice && (
          <div className="flex gap-1.5 mt-1" onClick={e => e.stopPropagation()}>
            <ActionBtn icon={Printer} label="فاتورة المطبعة" onClick={() => onPrintInvoice(task, 'print_vendor')} />
            <ActionBtn icon={FileText} label="فاتورة الزبون" onClick={() => onPrintInvoice(task, 'customer')} />
            <ActionBtn icon={Layers} label="فاتورة الفرقة" onClick={() => onPrintInvoice(task, 'installation_team')} />
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const PrintTasksTable: React.FC<Props> = ({
  tasks, isLoading, stats, onOpenTask, onAddTask, onRefresh,
  onDeleteDuplicates, duplicateCount = 0, isFetching, onStatusChange, onPrintInvoice, onChangePrinter,
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
      case 'area': av = a.total_area; bv = b.total_area; break;
      case 'cost': av = a.customer_total_amount; bv = b.customer_total_amount; break;
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
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 border ${
        sortField === field
          ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
          : 'text-muted-foreground border-border/40 hover:text-blue-400 hover:border-blue-500/20'
      }`}
    >
      {label}
      <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
    </button>
  );

  const priorityColors: Record<string, string> = {
    urgent: 'bg-red-500/15 text-red-400 border-red-500/30',
    high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    normal: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    low: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  };
  const priorityLabels: Record<string, string> = { urgent: 'عاجل', high: 'عالية', normal: 'عادية', low: 'منخفضة' };

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
            { label: 'إجمالي المهام', value: stats.total, color: 'text-blue-400', icon: LayoutList, bg: 'bg-blue-500/10', border: 'border-blue-500/20', accent: 'bg-blue-500', pct: 100 },
            { label: 'معلقة', value: stats.pending, color: 'text-amber-400', icon: Clock, bg: 'bg-amber-500/10', border: 'border-amber-500/20', accent: 'bg-amber-500', pct: stats.total > 0 ? Math.round((stats.pending / stats.total) * 100) : 0 },
            { label: 'مكتملة', value: stats.completed, color: 'text-emerald-400', icon: CheckCircle2, bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', accent: 'bg-emerald-500', pct: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0 },
            { label: 'المساحة الكلية', value: `${stats.totalArea.toFixed(0)} م²`, color: 'text-indigo-400', icon: Layers, bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', accent: 'bg-indigo-500', pct: 100 },
            { label: 'الإيرادات', value: `${stats.totalRevenue.toLocaleString()} د.ل`, color: 'text-emerald-400', icon: TrendingUp, bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', accent: 'bg-emerald-500', pct: 100 },
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

        {/* Warning */}
        {stats.noPrinter > 0 && (
          <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/25 rounded-2xl px-4 py-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
            <p className="text-sm text-amber-300">{stats.noPrinter} مهمة بدون مطبعة</p>
          </div>
        )}

        {/* Toolbar & Filter Control Center */}
        <div className="bg-card/55 backdrop-blur-lg border border-border/30 rounded-[22px] p-4 flex flex-col md:flex-row gap-4.5 items-center justify-between shrink-0 shadow-lg">
          <div className="relative w-full md:flex-1">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
            <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="بحث بالاسم أو رقم العقد أو المطبعة..." className="pr-10 bg-background border-border/50 rounded-xl h-10 text-sm" />
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-1.5">
              {(['all', 'pending', 'in_progress', 'completed'] as const).map(s => (
                <button key={s} onClick={() => { setFilterStatus(s); setPage(1); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    filterStatus === s ? 'bg-blue-500/15 text-blue-400 border-blue-500/30 shadow-sm' : 'text-muted-foreground border-border/40 hover:text-blue-400 hover:border-blue-500/20'
                  }`}
                >
                  {s === 'all' ? 'الكل' : STATUS_CONFIG[s]?.label}
                </button>
              ))}
            </div>
            <div className="h-4 w-px bg-border/40 hidden sm:block" />
            <PaginationBar />
          </div>
        </div>

        {/* Sort pills */}
        <div className="flex flex-wrap gap-2 shrink-0">
          <SortPill field="client" label="الزبون" />
          <SortPill field="contract" label="العقد" />
          <SortPill field="area" label="المساحة" />
          <SortPill field="cost" label="الإيرادات" />
          <SortPill field="printer" label="المطبعة" />
          <SortPill field="date" label="التاريخ" />
        </div>

        {/* Task cards */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}</div>
          ) : paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Printer className="h-12 w-12 opacity-30" />
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
                <div className="space-y-3">
                  {paginated.map((task, idx) => (
                    <PrintTaskCardRow key={task.id} task={task} idx={idx} onOpenTask={onOpenTask} priorityColors={priorityColors} priorityLabels={priorityLabels} onStatusChange={onStatusChange} onPrintInvoice={onPrintInvoice} />
                  ))}
                </div>
              );
            }
            return (
              <div className="space-y-4">
                {groupEntries.map(([contractKey, groupTasks]) => {
                  const cid = contractKey !== 'no-contract' ? Number(contractKey) : null;
                  const customerName = groupTasks[0]?.customer_name || 'بدون اسم';
                  const totalArea = groupTasks.reduce((s, t) => s + t.total_area, 0);
                  const totalRevenue = groupTasks.reduce((s, t) => s + (t.customer_total_amount || 0), 0);
                  return groupTasks.length === 1 ? (
                    <PrintTaskCardRow key={groupTasks[0].id} task={groupTasks[0]} idx={0} onOpenTask={onOpenTask} priorityColors={priorityColors} priorityLabels={priorityLabels} onStatusChange={onStatusChange} onPrintInvoice={onPrintInvoice} />
                  ) : (
                    <Collapsible key={contractKey} defaultOpen>
                      <CollapsibleTrigger asChild className="w-full">
                        <div className="bg-card border border-border rounded-2xl px-5 py-3 flex flex-wrap items-center gap-3 hover:bg-muted/30 transition-colors cursor-pointer">
                          <FolderOpen className="h-5 w-5 text-blue-500 shrink-0" />
                          {cid && <span className="font-bold text-foreground text-base">عقد #{cid}</span>}
                          <span className="text-sm text-muted-foreground">— {customerName}</span>
                          <div className="flex items-center gap-3 mr-auto">
                            <span className="text-xs text-muted-foreground bg-muted/60 px-2 py-1 rounded-lg">
                              <Layers className="h-3 w-3 inline ml-1" />{groupTasks.length} مهمة
                            </span>
                            <span className="text-xs text-muted-foreground bg-muted/60 px-2 py-1 rounded-lg">
                              {totalArea.toFixed(0)} م²
                            </span>
                            {totalRevenue > 0 && (
                              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">
                                {totalRevenue.toLocaleString()} د.ل
                              </span>
                            )}
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1 hover:bg-blue-500/10 hover:text-blue-400" onClick={() => onOpenTask(groupTasks[0])}>
                                <FileText className="h-3.5 w-3.5" />
                                طباعة الكل
                              </Button>
                            </div>
                            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="flex flex-col gap-3 pr-4 pt-2 pb-1 border-r-2 border-blue-500/20 mr-4">
                          {groupTasks.map((task, idx) => (
                            <PrintTaskCardRow key={task.id} task={task} idx={idx} onOpenTask={onOpenTask} priorityColors={priorityColors} priorityLabels={priorityLabels} onStatusChange={onStatusChange} onPrintInvoice={onPrintInvoice} />
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
        <div className="flex justify-center mt-2 shrink-0">
          <PaginationBar />
        </div>
      </div>
    </TooltipProvider>
  );
};
