import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { usePersistedFilters } from '@/hooks/usePersistedFilters';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { UnifiedPrintAllDialog } from '@/components/shared/printing/UnifiedPrintAllDialog';
import type { BillboardPrintItem } from '@/components/shared/printing/UnifiedPrintAllDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SlidersHorizontal, MoreVertical,

  CheckCircle2, Clock, Package, Users,
  Plus, RefreshCw, XCircle, Printer, Palette,
  Trash2, Edit, ChevronDown, ChevronUp, Image as ImageIcon,
  LayoutList, Layers, FileText, X,
  ChevronLeft, ChevronRight, Building2, CalendarDays,
  Banknote, FolderOpen, MessageCircle, ExternalLink, Download, Search,
  ArrowUpDown, ArrowUp, ArrowDown, Merge
} from 'lucide-react';
import { exportInstallationTaskImagesToZip } from '@/utils/exportInstallationTaskImagesToZip';
import { toast } from 'sonner';
import { SendTeamInstallationReportDialog } from '@/components/installation/SendTeamInstallationReportDialog';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { useResolvedImage } from '@/utils/imageResolver';

interface InstallationTask {
  id: string;
  contract_id: number;
  contract_ids?: number[];
  team_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  task_type?: 'installation' | 'reinstallation';
  created_at: string;
}

interface Props {
  tasks: InstallationTask[];
  allTaskItems: any[];
  billboardById: Record<number, any>;
  contractById: Record<number, any>;
  teamById: Record<string, any>;
  teams: any[];
  designsByTask: Record<string, any[]>;
  installationPricingByBillboard: Record<number, number>;
  derivedContractIdsByTaskId?: Map<string, number[]>;
  isLoading: boolean;
  stats: {
    totalTasks: number;
    pendingTasks: number;
    completedTasks: number;
    totalBillboards: number;
    completedBillboards: number;
  };
  // pagination (lifted to parent to preserve across re-renders)
  page: number;
  onPageChange: (page: number) => void;
  onOpenTask: (taskId: string) => void;
  onAddTask: () => void;
  onRefresh: () => void;
  onPrintTask: (taskId: string) => void;
  onPrintAll: (taskId: string | string[]) => void;
  onSendWhatsApp?: (taskId: string) => void;
  onDistributeDesigns: (taskId: string) => void;
  onManageDesigns: (taskId: string) => void;
  onManageDesignsGroup?: (taskIds: string[]) => void;
  onDistributeDesignsGroup?: (taskIds: string[]) => void;
  onAddBillboard: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onEditTask: (taskId: string) => void;
  onCompleteAllBillboards?: (taskId: string) => void;
  onPrintInvoice?: (taskId: string, type: 'customer' | 'installation_team' | 'print_vendor') => void;
  onCreatePrintTask?: (taskId: string) => void;
  onSyncMissingBillboards?: (contractId: number, taskIds: string[]) => void;
  onDuplicateAsReinstallation?: (taskId: string) => void;
  onDuplicateAsReinstallationGroup?: (taskIds: string[]) => void;
  onMergeTasks?: (taskIds: string[]) => void;
}

type SortField = 'id' | 'client' | 'contract' | 'billboards' | 'status' | 'date' | 'team' | 'cost';
type SortDir = 'asc' | 'desc';

const STATUS_CONFIG = {
  completed: {
    label: 'مكتملة',
    color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    dot: 'bg-emerald-400',
    glow: 'rgba(16,185,129,0.15)',
    icon: CheckCircle2,
  },
  in_progress: {
    label: 'قيد التنفيذ',
    color: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    dot: 'bg-amber-400',
    glow: 'rgba(245,158,11,0.15)',
    icon: Clock,
  },
  pending: {
    label: 'جديدة',
    color: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    dot: 'bg-slate-400',
    glow: 'rgba(148,163,184,0.10)',
    icon: Package,
  },
  cancelled: {
    label: 'ملغاة',
    color: 'bg-red-500/15 text-red-400 border-red-500/30',
    dot: 'bg-red-400',
    glow: 'rgba(239,68,68,0.12)',
    icon: XCircle,
  },
};

const PRINT_STATUS_LABELS: Record<string, string> = {
  pending: 'جديدة',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتملة',
  cancelled: 'ملغاة',
};

const PRINT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  in_progress: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
};

function getDisplayStatus(items: any[]): keyof typeof STATUS_CONFIG {
  if (items.length === 0) return 'pending';
  const completed = items.filter(i => i.status === 'completed').length;
  if (completed === items.length) return 'completed';
  if (completed > 0) return 'in_progress';
  return 'pending';
}

/* ── Progress bar with animated fill ── */
const ProgressBar = ({ value, total, completed }: { value: number; total: number; completed: number }) => {
  const barColor =
    value === 0 ? 'bg-muted-foreground/20'
    : value < 71 ? 'bg-amber-500'
    : value < 100 ? 'bg-blue-500'
    : 'bg-emerald-500';

  const textColor =
    value === 100 ? 'text-emerald-400'
    : value >= 71 ? 'text-blue-400'
    : value > 0 ? 'text-amber-400'
    : 'text-muted-foreground/50';

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-muted-foreground text-xs">اللوحات</span>
        <span className="text-xs font-semibold text-foreground/80">
          {completed}/{total}
        </span>
      </div>
      <div className="relative h-2.5 w-full rounded-full bg-muted/60 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>
      <span className={`text-xs font-bold ${textColor}`}>{value}%</span>
    </div>
  );
};

/* ── Full-height design panel with multi-design navigation ── */
const DesignPanel = ({ urls, accent, onColorExtracted }: { urls: string[]; accent: string; onColorExtracted?: (color: string | null) => void }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const url = urls.length > 0 ? urls[currentIdx % urls.length] : undefined;
  const { src: resolvedUrl } = useResolvedImage(url);
  const displayUrl = resolvedUrl || url;

  useEffect(() => {
    if (!url || !onColorExtracted) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = 50; canvas.height = 50;
        ctx.drawImage(img, 0, 0, 50, 50);
        const data = ctx.getImageData(0, 0, 50, 50).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const br = (data[i] + data[i+1] + data[i+2]) / 3;
          if (br > 30 && br < 225) { r += data[i]; g += data[i+1]; b += data[i+2]; count++; }
        }
        if (count > 0) onColorExtracted(`${Math.round(r/count)}, ${Math.round(g/count)}, ${Math.round(b/count)}`);
      } catch { onColorExtracted(null); }
    };
    img.onerror = () => onColorExtracted?.(null);
    img.src = displayUrl || url;
  }, [url, displayUrl, onColorExtracted]);

  const goNext = (e: React.MouseEvent) => { e.stopPropagation(); setCurrentIdx(i => (i + 1) % urls.length); };
  const goPrev = (e: React.MouseEvent) => { e.stopPropagation(); setCurrentIdx(i => (i - 1 + urls.length) % urls.length); };

  return (
    <>
      <div
        className="relative flex-shrink-0 overflow-hidden h-full cursor-pointer"
        style={{ width: '100%', minHeight: '100%' }}
        onClick={() => url && setLightboxOpen(true)}
      >
        {displayUrl ? (
          <>
            {/* Blurred background */}
            <div className="absolute inset-0">
              <img src={displayUrl} alt="" className="w-full h-full object-cover scale-150 blur-xl opacity-50" aria-hidden="true" />
              <div className="absolute inset-0 bg-black/40" />
            </div>
            {/* Main image */}
            <img
              src={displayUrl}
              alt="تصميم"
              className="relative w-full h-full object-contain z-10 p-2"
              style={{ minHeight: '100%' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            {/* Navigation arrows for multiple designs */}
            {urls.length > 1 && (
              <>
                <button
                  onClick={goPrev}
                  className="absolute right-1 top-1/2 -translate-y-1/2 z-30 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={goNext}
                  className="absolute left-1 top-1/2 -translate-y-1/2 z-30 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {/* Dots indicator */}
                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-30 flex gap-1">
                  {urls.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); setCurrentIdx(i); }}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentIdx % urls.length ? 'bg-white scale-125' : 'bg-white/40'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ minHeight: '100%', background: `linear-gradient(135deg, hsl(var(--muted)/0.6), ${accent}18)` }}
          >
            <div className="flex flex-col items-center gap-2 opacity-40">
              <ImageIcon className="h-10 w-10" style={{ color: accent }} />
              <span className="text-[10px] text-muted-foreground">لا يوجد تصميم</span>
            </div>
          </div>
        )}

        {/* Accent vertical bar */}
        <div className="absolute top-0 left-0 bottom-0 w-[4px]" style={{ background: accent, opacity: 0.85 }} />
      </div>

      {/* Lightbox via Portal */}
      {lightboxOpen && url && createPortal(
        <div
          className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-md flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all border border-white/20"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          {urls.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setCurrentIdx(i => (i - 1 + urls.length) % urls.length); }}
                className="absolute right-6 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/20"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setCurrentIdx(i => (i + 1) % urls.length); }}
                className="absolute left-6 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/20"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2">
                {urls.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setCurrentIdx(i); }}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${i === currentIdx % urls.length ? 'bg-white scale-125' : 'bg-white/40'}`}
                  />
                ))}
              </div>
            </>
          )}
          <img
            src={displayUrl}
            alt="معاينة التصميم"
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>,
        document.body
      )}
    </>
  );
};

/* ── Larger labeled action button (icon + text) ── */
const ActionBtn = ({
  icon: Icon, label, onClick, danger = false, color = 'text-foreground',
}: { icon: any; label: string; onClick: (e: React.MouseEvent) => void; danger?: boolean; color?: string }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick(e); }}
    title={label}
    className={`
      h-15 w-full rounded-xl flex flex-col items-center justify-center gap-1.5 px-2 py-2.5
      transition-all duration-200 border text-[10px] font-semibold leading-tight text-center hover:scale-[1.03]
      ${danger
        ? 'text-red-400 border-red-500/25 bg-red-500/5 hover:bg-red-500/15 hover:border-red-500/40 hover:shadow-lg hover:shadow-red-500/10'
        : 'border-border/40 bg-card/45 hover:bg-primary/5 hover:border-primary/30 hover:shadow-sm'
      }
    `}
  >
    <Icon className={`h-4.5 w-4.5 transition-transform duration-200 group-hover:scale-110 ${danger ? '' : color}`} />
    <span className="truncate w-full text-foreground/80">{label}</span>
  </button>
);

/* ── Task Card Row with dominant color ── */
const TaskCardRowInner = ({
  task, idx, cfg, isSelected, deleteConfirmId,
  onOpenTask, onToggle, onPrintTask, onPrintAll, onSendWhatsApp, onDistributeDesigns, onManageDesigns,
  onAddBillboard, onDeleteTask, setDeleteConfirmId, onEditTask, onCompleteAllBillboards, onPrintInvoice,
  onCreatePrintTask, onGroupColorExtracted, onDuplicateAsReinstallation,
  isSelectionDisabled,
}: any) => {
  const [dominantColor, setDominantColor] = useState<string | null>(null);

  const handleColorExtracted = useCallback((color: string | null) => {
    setDominantColor(color);
    if (color && onGroupColorExtracted) {
      onGroupColorExtracted(color);
    }
  }, [onGroupColorExtracted]);

  const cardBg = dominantColor
    ? `linear-gradient(to left, rgba(${dominantColor}, 0.22) 0%, rgba(${dominantColor}, 0.10) 35%, rgba(${dominantColor}, 0.03) 70%, hsl(var(--card)) 100%)`
    : `linear-gradient(to left, color-mix(in srgb, ${task.accent} 12%, transparent) 0%, color-mix(in srgb, ${task.accent} 4%, transparent) 35%, hsl(var(--card)) 100%)`;

  const cardBorder = dominantColor
    ? `1.5px solid rgba(${dominantColor}, 0.4)`
    : isSelected
      ? `1.5px solid ${task.accent}`
      : `1.5px solid color-mix(in srgb, ${task.accent} 20%, hsl(var(--border)/0.5))`;

  const cardShadow = dominantColor
    ? `0 4px 24px rgba(${dominantColor}, 0.25), 0 0 0 1px rgba(${dominantColor}, 0.1)`
    : `0 2px 16px rgba(0,0,0,0.18)`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.025, ease: 'easeOut' }}
      whileHover={{ y: -3, transition: { duration: 0.18 } }}
      onClick={() => onOpenTask(task.id)}
      className="group relative rounded-2xl overflow-hidden cursor-pointer"
      style={{ background: cardBg, border: cardBorder, boxShadow: cardShadow, minHeight: 160 }}
    >
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
        style={{ boxShadow: dominantColor
          ? `0 12px 40px rgba(${dominantColor}, 0.35), 0 0 0 2px rgba(${dominantColor}, 0.3)`
          : `0 8px 32px rgba(0,0,0,0.30), 0 0 0 1px ${task.accent}33`
        }}
      />
      {/* Desktop layout */}
      <div className="hidden md:flex h-full items-stretch">
        {/* Design Panel */}
        <div className="w-[200px] shrink-0 overflow-hidden relative" onClick={e => e.stopPropagation()}>
          <DesignPanel urls={task.allDesignUrls || (task.designThumb ? [task.designThumb] : [])} accent={task.accent} onColorExtracted={handleColorExtracted} />
          
          {/* Circular Selection Checkbox Overlay */}
          <div className="absolute top-2.5 right-2.5 z-30">
            <Checkbox
              checked={isSelected}
              disabled={isSelectionDisabled}
              onCheckedChange={onToggle}
              className="h-5 w-5 rounded-full border-2 border-white/45 bg-black/40 backdrop-blur-sm data-[state=checked]:!bg-primary data-[state=checked]:!border-primary cursor-pointer transition-all [&_svg]:!text-white [&_svg]:stroke-[3.5px] [&_svg]:h-3.5 [&_svg]:w-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Design count overlay */}
          {task.allDesignUrls && task.allDesignUrls.length > 1 && (
            <div className="absolute bottom-2.5 right-2.5 z-30 bg-black/60 backdrop-blur-sm text-white px-2 py-0.5 rounded-lg text-[9px] font-bold border border-white/10">
              {task.allDesignUrls.length} تصاميم
            </div>
          )}
        </div>
        
        {/* Details & Info */}
        <div className="flex-1 min-w-0 px-6 py-5 flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-lg font-black text-foreground leading-tight">{task.customerName}</span>
              {task.task_type === 'reinstallation' ? (
                <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 font-extrabold text-[10px] h-5 px-2.5 py-0 rounded-full">
                  إعادة تركيب رقم {task.reinstallation_number || 1}
                </Badge>
              ) : (
                <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-extrabold text-[10px] h-5 px-2.5 py-0 rounded-full">
                  تركيب جديد
                </Badge>
              )}
              {task.isMerged && (
                <Badge className="bg-orange-500/10 text-orange-500 border border-orange-500/20 font-extrabold text-[10px] h-5 px-2.5 py-0 rounded-full animate-pulse">
                  مدمجة
                </Badge>
              )}
              {task.print_tasks ? (
                <Badge className={`font-extrabold text-[10px] h-5 px-2.5 py-0 rounded-full border ${PRINT_STATUS_COLORS[task.print_tasks.status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                  <Printer className="h-3 w-3 ml-1" />
                  مهمة الطباعة: {PRINT_STATUS_LABELS[task.print_tasks.status] || task.print_tasks.status}
                </Badge>
              ) : (
                <Badge className="bg-rose-500/15 text-rose-500 dark:text-rose-400 border border-rose-500/25 font-extrabold text-[10px] h-5 px-2.5 py-0 rounded-full">
                  <Printer className="h-3 w-3 ml-1" />
                  لم يتم إنشاء مهمة طباعة
                </Badge>
              )}
            </div>
            {task.designName && task.designName !== '—' && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80 font-medium truncate">
                <Palette className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                <span>{task.designName}</span>
              </div>
            )}
          </div>

          {/* Metadata Grid */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 font-extrabold px-2.5 py-1 rounded-xl font-mono">
              العقد: {task.isMerged ? (
                <span className="flex items-center gap-1 text-amber-400">
                  {task.effectiveContractIds.slice(0, 3).map((cId: number) => `#${cId}`).join(', ')}
                  {task.effectiveContractIds.length > 3 && ` +${task.effectiveContractIds.length - 3}`}
                </span>
              ) : (
                <span className="text-amber-400">#{task.contractNumber}</span>
              )}
            </span>
            {task.installDate && (
              <span className="inline-flex items-center gap-1.5 bg-muted/40 border border-border/25 px-2.5 py-1 rounded-xl text-muted-foreground font-semibold">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                <span>{format(new Date(task.installDate), 'dd/MM/yyyy', { locale: ar })}</span>
              </span>
            )}
            {task.team && (
              <span className="inline-flex items-center gap-1.5 bg-muted/40 border border-border/25 px-2.5 py-1 rounded-xl text-muted-foreground font-semibold">
                <Users className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                <span className="truncate max-w-[150px]">{task.team.team_name}</span>
              </span>
            )}
            {task.totalCost > 0 && (
              <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-xl font-extrabold text-emerald-500 dark:text-emerald-400">
                <Banknote className="h-3.5 w-3.5 text-emerald-500/80" />
                تكلفة التركيب: {task.totalCost.toLocaleString('en-US')} د.ل
              </span>
            )}
          </div>

          {/* Progress bar (Sleek Inline Design) */}
          <div className="space-y-1.5 max-w-md">
            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground/80">
              <span>إنجاز التركيب:</span>
              <span>{task.completed} من {task.totalItems} لوحة ({task.completionPct}%)</span>
            </div>
            <div className="relative h-2 w-full rounded-full bg-muted/40 overflow-hidden border border-border/10">
              <motion.div
                className={`h-full rounded-full ${task.completionPct === 100 ? 'bg-emerald-500' : 'bg-primary'}`}
                initial={{ width: 0 }}
                animate={{ width: `${task.completionPct}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </div>

        {/* Cost & Status Panel merged into Actions column */}
        <div className="w-[220px] shrink-0 p-5 flex flex-col justify-between items-stretch border-r border-border/30" onClick={e => e.stopPropagation()}>
          {/* Status Badge centered at the top */}
          <div className="flex justify-center">
            <span className={`inline-flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-full border font-extrabold shadow-sm whitespace-nowrap ${cfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} shrink-0`} />
              {cfg.label}
            </span>
          </div>

          {/* Action buttons stacked at bottom */}
          {deleteConfirmId === task.id ? (
            <div className="flex flex-col items-center gap-2 p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 shadow-md">
              <span className="text-xs text-destructive font-black">حذف المهمة نهائياً؟</span>
              <div className="flex gap-2 w-full">
                <button 
                  onClick={() => { onDeleteTask(task.id); setDeleteConfirmId(null); }} 
                  className="flex-1 h-8 rounded-lg bg-destructive text-destructive-foreground text-xs font-bold hover:bg-destructive/90 transition-all shadow-sm"
                >
                  حذف
                </button>
                <button 
                  onClick={() => setDeleteConfirmId(null)} 
                  className="flex-1 h-8 rounded-lg bg-muted border border-border/80 text-muted-foreground text-xs font-bold hover:bg-muted/80 transition-all"
                >
                  إلغاء
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 w-full mt-auto">
              <Button
                onClick={() => onOpenTask(task.id)}
                className="w-full h-9 rounded-xl font-bold text-xs gap-1.5 shadow-sm bg-primary text-primary-foreground hover:bg-primary/95 transition-all"
              >
                <FolderOpen className="h-4 w-4" />
                تفاصيل واللوحات
              </Button>
              
              <div className="flex gap-1.5 w-full items-center justify-between mt-1">
                {/* Complete All */}
                {onCompleteAllBillboards && task.completed < task.totalItems ? (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onCompleteAllBillboards(task.id)}
                    className="h-9 w-9 shrink-0 rounded-xl border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500/50 shadow-sm animate-pulse"
                    title="إكمال جميع اللوحات"
                  >
                    <CheckCircle2 className="h-4.5 w-4.5" />
                  </Button>
                ) : null}

                {/* Manage Designs */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onManageDesigns(task.id)}
                  className="h-9 w-9 shrink-0 rounded-xl border-violet-500/20 text-violet-500 hover:bg-violet-500/10 hover:border-violet-500/50 shadow-sm"
                  title="إدارة التصاميم"
                >
                  <Palette className="h-4.5 w-4.5" />
                </Button>

                {/* Print All */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onPrintAll(task.id)}
                  className="h-9 w-9 shrink-0 rounded-xl border-blue-500/20 text-blue-500 hover:bg-blue-500/10 hover:border-blue-500/50 shadow-sm"
                  title="تحضير وطباعة الكل"
                >
                  <Printer className="h-4.5 w-4.5" />
                </Button>

                {/* Add Billboard */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onAddBillboard(task.id)}
                  className="h-9 w-9 shrink-0 rounded-xl border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500/50 shadow-sm"
                  title="إضافة لوحة جديدة"
                >
                  <Plus className="h-4.5 w-4.5" />
                </Button>

                {/* Send WhatsApp */}
                {onSendWhatsApp && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onSendWhatsApp(task.id)}
                    className="h-9 w-9 shrink-0 rounded-xl border-emerald-600/20 text-emerald-600 hover:bg-emerald-600/10 hover:border-emerald-600/50 shadow-sm"
                    title="إرسال إشعار عبر واتساب"
                  >
                    <MessageCircle className="h-4.5 w-4.5" />
                  </Button>
                )}

                {/* More / Actions Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 rounded-xl border-border/80 hover:bg-muted text-muted-foreground"
                      title="المزيد من الإجراءات"
                    >
                      <MoreVertical className="h-4.5 w-4.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 bg-popover rounded-2xl shadow-xl border-border/60" align="end">
                    <DropdownMenuItem onClick={() => onDistributeDesigns(task.id)} className="gap-2">
                      <Layers className="h-4 w-4 text-violet-500" />
                      تعديل وتوزيع التصاميم
                    </DropdownMenuItem>
                    {onCreatePrintTask && (
                      <DropdownMenuItem onClick={() => onCreatePrintTask(task.id)} className="gap-2">
                        <Printer className="h-4 w-4 text-cyan-500" />
                        إنشاء مهمة طباعة
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => onEditTask(task.id)} className="gap-2">
                      <Edit className="h-4 w-4 text-amber-500" />
                      تعديل نوع المهمة
                    </DropdownMenuItem>
                    {onDuplicateAsReinstallation && (
                      <DropdownMenuItem onClick={() => onDuplicateAsReinstallation(task.id)} className="gap-2">
                        <RefreshCw className="h-4 w-4 text-amber-600" />
                        تكرار كإعادة تركيب
                      </DropdownMenuItem>
                    )}

                    {onPrintInvoice && (
                      <>
                        <DropdownMenuSeparator className="bg-border/60" />
                        <DropdownMenuItem onClick={() => onPrintInvoice(task.id, 'customer')} className="gap-2">
                          <FileText className="h-4 w-4 text-sky-500" />
                          فاتورة إنجاز العميل
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onPrintInvoice(task.id, 'installation_team')} className="gap-2">
                          <Layers className="h-4 w-4 text-indigo-500" />
                          كشف حساب الفرقة
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onPrintInvoice(task.id, 'print_vendor')} className="gap-2">
                          <Printer className="h-4 w-4 text-pink-500" />
                          حساب خدمات المطبعة
                        </DropdownMenuItem>
                      </>
                    )}

                    <DropdownMenuSeparator className="bg-border/60" />
                    <DropdownMenuItem 
                      onClick={() => setDeleteConfirmId(task.id)} 
                      className="gap-2 text-destructive focus:text-destructive font-bold focus:bg-destructive/5"
                    >
                      <Trash2 className="h-4 w-4" />
                      حذف المهمة نهائياً
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {onPrintInvoice && (
                <div className="flex gap-1.5 w-full items-center justify-between mt-1.5 pt-1.5 border-t border-border/10">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onPrintInvoice(task.id, 'customer')}
                    className="h-9 w-9 shrink-0 rounded-xl border-sky-500/20 text-sky-500 hover:bg-sky-500/10 hover:border-sky-500/50 shadow-sm"
                    title="فاتورة إنجاز العميل"
                  >
                    <FileText className="h-4.5 w-4.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onPrintInvoice(task.id, 'installation_team')}
                    className="h-9 w-9 shrink-0 rounded-xl border-indigo-500/20 text-indigo-500 hover:bg-indigo-500/10 hover:border-indigo-500/50 shadow-sm"
                    title="كشف حساب الفرقة"
                  >
                    <Layers className="h-4.5 w-4.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onPrintInvoice(task.id, 'print_vendor')}
                    className="h-9 w-9 shrink-0 rounded-xl border-pink-500/20 text-pink-500 hover:bg-pink-500/10 hover:border-pink-500/50 shadow-sm"
                    title="حساب خدمات المطبعة"
                  >
                    <Printer className="h-4.5 w-4.5" />
                  </Button>
                  {onCreatePrintTask && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onCreatePrintTask(task.id)}
                      className="h-9 w-9 shrink-0 rounded-xl border-cyan-500/20 text-cyan-500 hover:bg-cyan-500/10 hover:border-cyan-500/50 shadow-sm"
                      title="إنشاء مهمة طباعة"
                    >
                      <Printer className="h-4.5 w-4.5" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex flex-col md:hidden">
        {/* Header row: status + customer + checkbox */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-border/20">

          <Checkbox
            checked={isSelected}
            disabled={isSelectionDisabled}
            onCheckedChange={onToggle}
            onClick={e => e.stopPropagation()}
            className="border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary shrink-0 [&_svg]:!text-white [&_svg]:stroke-[3.5px] [&_svg]:h-3 [&_svg]:w-3 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold text-foreground truncate">{task.customerName}</span>
              {task.task_type === 'reinstallation' && (
                <span className="text-[9px] bg-blue-500/15 text-blue-400 border border-blue-500/25 rounded-full px-1.5 py-0.5 font-semibold">
                  re{task.reinstallation_number || 1}-{task.contract_id}
                </span>
              )}
            </div>
            {task.designName && task.designName !== '—' && (
              <span className="text-xs text-muted-foreground/70 truncate block">{task.designName}</span>
            )}
          </div>
          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border font-semibold whitespace-nowrap ${cfg.color} shrink-0`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3 text-amber-500/70" />
            <span className="font-mono text-amber-400 font-semibold">#{task.isMerged ? task.effectiveContractIds[0] : task.contractNumber}</span>
            {task.isMerged && <span className="text-[9px] bg-orange-500/15 text-orange-400 rounded px-1">+{task.effectiveContractIds.length - 1}</span>}
          </span>
          {task.team && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3 text-muted-foreground/50" />
              <span className="truncate max-w-[100px]">{task.team.team_name}</span>
            </span>
          )}
          {task.installDate && (
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3 text-muted-foreground/50" />
              {format(new Date(task.installDate), 'dd/MM/yyyy', { locale: ar })}
            </span>
          )}
          {task.designDate && (
            <span className="flex items-center gap-1 text-violet-400">
              <Palette className="h-3 w-3 text-violet-500/70" />
              تصميم: {format(new Date(task.designDate), 'dd/MM', { locale: ar })}
            </span>
          )}
        </div>
        {/* مؤشرات الصور - موبايل */}
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 border-t border-border/20">
          <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border font-semibold ${
            task.hasAllInstallPhotos ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
              : task.itemsWithInstallPhotos > 0 ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
              : 'bg-red-500/10 text-red-400 border-red-500/25'
          }`}>
            <ImageIcon className="h-2.5 w-2.5" />
            صور التركيب: {task.itemsWithInstallPhotos}/{task.totalItems}
          </span>
          <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border font-semibold ${
            task.hasAllDesigns ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
              : task.itemsWithDesigns > 0 ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
              : 'bg-red-500/10 text-red-400 border-red-500/25'
          }`}>
            <Palette className="h-2.5 w-2.5" />
            التصاميم: {task.itemsWithDesigns}/{task.totalItems}
          </span>
          {task.print_tasks ? (
            <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border font-semibold ${
              task.print_tasks.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                : task.print_tasks.status === 'in_progress' ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                : 'bg-slate-500/10 text-slate-400 border-slate-500/25'
            }`}>
              <Printer className="h-2.5 w-2.5" />
              الطباعة: {PRINT_STATUS_LABELS[task.print_tasks.status] || task.print_tasks.status}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border border-rose-500/25 bg-rose-500/10 text-rose-400 font-semibold">
              <Printer className="h-2.5 w-2.5" />
              لم يتم إنشاء مهمة طباعة
            </span>
          )}
        </div>

        {/* Progress row */}
        <div className="px-3 py-2 border-t border-border/20" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-bold text-foreground">{task.totalItems}</span>
            <span className="text-xs text-muted-foreground">لوحة</span>
            {task.totalCost > 0 && (
              <span className="mr-auto text-xs font-semibold text-foreground">{task.totalCost.toLocaleString('ar-LY')} <span className="text-[10px] text-muted-foreground/60">د.ل</span></span>
            )}
          </div>
          <ProgressBar value={task.completionPct} total={task.totalItems} completed={task.completed} />
        </div>

        {/* Actions row */}
        <div className="px-3 py-2 border-t border-border/20" onClick={e => e.stopPropagation()}>
          {deleteConfirmId === task.id ? (
            <div className="flex items-center gap-2 w-full p-2 rounded-xl bg-red-500/10 border border-red-500/30">
              <span className="text-xs text-red-400 font-bold flex-1">تأكيد الحذف؟</span>
              <button onClick={() => { onDeleteTask(task.id); setDeleteConfirmId(null); }} className="h-7 px-3 rounded-lg bg-red-500/25 text-red-400 text-xs font-bold hover:bg-red-500/40 transition-colors">نعم</button>
              <button onClick={() => setDeleteConfirmId(null)} className="h-7 px-3 rounded-lg bg-muted/60 text-muted-foreground text-xs hover:bg-muted transition-colors">إلغاء</button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              <ActionBtn icon={FileText} label="فتح" onClick={() => onOpenTask(task.id)} color="text-amber-400" />
              {onCompleteAllBillboards && task.completed < task.totalItems && (
                <ActionBtn icon={CheckCircle2} label="إكمال الكل" onClick={() => onCompleteAllBillboards(task.id)} color="text-emerald-400" />
              )}
              <ActionBtn icon={ImageIcon} label="تعديل التصاميم" onClick={() => onDistributeDesigns(task.id)} color="text-violet-400" />
              <ActionBtn icon={Palette} label="إدارة التصاميم" onClick={() => onManageDesigns(task.id)} color="text-purple-400" />
              <ActionBtn icon={Layers} label="طباعة الكل" onClick={() => onPrintAll(task.id)} color="text-blue-400" />
              {onSendWhatsApp && (
                <ActionBtn icon={MessageCircle} label="واتساب" onClick={() => onSendWhatsApp(task.id)} color="text-emerald-400" />
              )}
              {onCreatePrintTask && (
                <ActionBtn icon={Printer} label="مهمة طباعة" onClick={() => onCreatePrintTask(task.id)} color="text-cyan-400" />
              )}
              {onDuplicateAsReinstallation && (
                <ActionBtn icon={RefreshCw} label="تكرار كإعادة تركيب" onClick={() => onDuplicateAsReinstallation(task.id)} color="text-amber-600" />
              )}
              <ActionBtn icon={Plus} label="إضافة لوحة" onClick={() => onAddBillboard(task.id)} color="text-emerald-400" />
              <ActionBtn icon={Edit} label="تعديل" onClick={() => onEditTask(task.id)} color="text-amber-400" />
              {onPrintInvoice && (
                <>
                  <ActionBtn icon={FileText} label="فاتورة الزبون" onClick={() => onPrintInvoice(task.id, 'customer')} color="text-sky-400" />
                  <ActionBtn icon={Layers} label="فاتورة الفرقة" onClick={() => onPrintInvoice(task.id, 'installation_team')} color="text-indigo-400" />
                  <ActionBtn icon={Printer} label="فاتورة المطبعة" onClick={() => onPrintInvoice(task.id, 'print_vendor')} color="text-pink-400" />
                </>
              )}
              <ActionBtn icon={Trash2} label="حذف المهمة" onClick={() => setDeleteConfirmId(task.id)} danger />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

/* ── Skeleton card ── */
const SkeletonCard = () => (
  <div className="flex rounded-2xl overflow-hidden border border-border/50 bg-card" style={{ minHeight: 160 }}>
    <Skeleton className="w-40 shrink-0 rounded-none rounded-r-2xl" />
    <div className="flex-1 p-5 flex flex-col gap-3">
      <Skeleton className="h-5 w-1/3 rounded-lg" />
      <Skeleton className="h-3.5 w-1/4 rounded" />
      <div className="flex gap-6 mt-2">
        <Skeleton className="h-3 w-20 rounded" />
        <Skeleton className="h-3 w-20 rounded" />
        <Skeleton className="h-3 w-20 rounded" />
      </div>
      <Skeleton className="h-2.5 w-full rounded-full mt-2" />
    </div>
  </div>
);

/* ── Sort icon helper ── */
const SortIcon = ({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) =>
  sortField !== field
    ? <ArrowUpDown className="h-3.5 w-3.5 opacity-30" />
    : sortDir === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5 text-primary" />
      : <ArrowDown className="h-3.5 w-3.5 text-primary" />;

export const InstallationTasksTable: React.FC<Props> = ({
  tasks, allTaskItems, billboardById, contractById, teamById,
  teams, designsByTask, installationPricingByBillboard,
  derivedContractIdsByTaskId,
  isLoading, stats,
  page, onPageChange,
  onOpenTask, onAddTask, onRefresh,
  onPrintTask, onPrintAll, onSendWhatsApp, onDistributeDesigns, onManageDesigns,
  onManageDesignsGroup, onDistributeDesignsGroup,
  onAddBillboard, onDeleteTask, onEditTask, onCompleteAllBillboards, onPrintInvoice, onCreatePrintTask, onSyncMissingBillboards,
  onDuplicateAsReinstallation, onDuplicateAsReinstallationGroup, onMergeTasks,
}) => {
  const { filters, setFilter } = usePersistedFilters('installation-tasks', {
    search: '',
    filterStatus: 'all',
    filterTeam: 'all',
    filterPhotos: 'all',
    sortField: 'date' as SortField,
    sortDir: 'desc' as SortDir,
  });
  const search = filters.search;
  const filterStatus = filters.filterStatus;
  const filterTeam = filters.filterTeam;
  const filterPhotos = filters.filterPhotos;
  const sortField = filters.sortField as SortField;
  const sortDir = filters.sortDir as SortDir;
  const setSearch = (v: string) => setFilter('search', v);
  const setFilterStatus = (v: string) => setFilter('filterStatus', v);
  const setFilterTeam = (v: string) => setFilter('filterTeam', v);
  const setFilterPhotos = (v: string) => setFilter('filterPhotos', v);
  const setSortField = (v: SortField) => setFilter('sortField', v);
  const setSortDir = (v: SortDir) => setFilter('sortDir', v);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [bulkPrintOpen, setBulkPrintOpen] = useState(false);
  const [sendTeamDialogOpen, setSendTeamDialogOpen] = useState(false);
  const [groupByContract, setGroupByContract] = useState(true);
  const [groupColors, setGroupColors] = useState<Record<string, string>>({});
  const registerGroupColor = useCallback((groupKey: string, color: string) => {
    setGroupColors(prev => {
      if (prev[groupKey] === color) return prev;
      return { ...prev, [groupKey]: color };
    });
  }, []);
  const PAGE_SIZE = 15;

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    onPageChange(1);
  };

  const enriched = useMemo(() => tasks.map(task => {
    const items = allTaskItems.filter(i => i.task_id === task.id);
    const effectiveContractIds = derivedContractIdsByTaskId?.get(task.id) 
      || (task.contract_ids && task.contract_ids.length > 0 ? task.contract_ids : [task.contract_id]);
    const isMerged = effectiveContractIds.length > 1;
    const contract = contractById[task.contract_id];
    const team = teamById[task.team_id];
    const completed = items.filter(i => i.status === 'completed').length;
    const totalCost = items.reduce((s, i) => {
      const hasCost = i.company_installation_cost !== null && i.company_installation_cost !== undefined;
      const cost = hasCost ? i.company_installation_cost : (installationPricingByBillboard[i.billboard_id] || 0);
      return s + cost;
    }, 0);
    const totalCustomerCost = items.reduce((s, i) => {
      return s + ((i.reinstall_count || 0) > 0 
        ? ((Number(i.customer_original_install_cost) || Number(i.customer_installation_cost) || 0) + (Number(i.customer_reinstall_cost) || Number(i.customer_installation_cost) || 0))
        : (Number(i.customer_installation_cost) || 0));
    }, 0);
    const displayStatus = getDisplayStatus(items);
    const installDate = items.find(i => i.installation_date)?.installation_date;
    // مشاركة التصاميم بين جميع الفرق في نفس المجموعة (نفس العقد + نوع المهمة + رقم إعادة التركيب)
    const taskGroupKey = `${task.contract_id}-${task.task_type || 'installation'}-${(task as any).reinstallation_number ?? 'new'}`;
    const siblingTaskIds = tasks
      .filter(t => `${t.contract_id}-${t.task_type || 'installation'}-${(t as any).reinstallation_number ?? 'new'}` === taskGroupKey)
      .map(t => t.id);
    const designs = siblingTaskIds
      .flatMap(id => designsByTask[id] || [])
      .filter((d: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.id === d.id) === i);

    // 1. التصاميم من جدول task_designs (الوجهين الأول والثاني)
    const taskDesignUrls = designs.flatMap((d: any) => [d.design_face_a_url, d.design_face_b_url].filter(Boolean));

    // 2. التصاميم من عناصر المهمة واللوحات (الوجهين الأول والثاني)
    const itemDesignUrls = items.flatMap((i: any) => [
      i.design_face_a,
      i.design_face_b,
      billboardById[i.billboard_id]?.design_face_a,
      billboardById[i.billboard_id]?.design_face_b
    ].filter(Boolean));

    // دمج كافة روابط التصاميم المتاحة دون تكرار
    const combinedDesignUrls = [...taskDesignUrls, ...itemDesignUrls]
      .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);

    const designThumb = combinedDesignUrls[0] || null;
    const allDesignUrls = combinedDesignUrls;
    let h = 0;
    for (let i = 0; i < taskGroupKey.length; i++) h = taskGroupKey.charCodeAt(i) + ((h << 5) - h);
    const accent = `hsl(${Math.abs(h) % 360}, 55%, 58%)`;
    const pct = items.length > 0 ? Math.round((completed / items.length) * 100) : 0;
    // نوع الإعلان: إذا مدمجة نجمع الأنواع الفريدة
    const adTypes = isMerged
      ? [...new Set(effectiveContractIds.map((cId: number) => contractById[cId]?.['Ad Type']).filter(Boolean))].join(' / ')
      : contract?.['Ad Type'];
    // حساب عدد صور التركيب والتصاميم المدخلة
    const itemsWithInstallPhotos = items.filter(i => i.installed_image_face_a_url || i.installed_image_face_b_url).length;
    const itemsWithDesigns = items.filter(i => 
      i.design_face_a || i.design_face_b || 
      billboardById[i.billboard_id]?.design_face_a || billboardById[i.billboard_id]?.design_face_b ||
      combinedDesignUrls.length > 0
    ).length;
    const hasAllInstallPhotos = items.length > 0 && itemsWithInstallPhotos === items.length;
    const hasAllDesigns = items.length > 0 && itemsWithDesigns === items.length;

    return {
      ...task, items, contract, team, completed,
      totalItems: items.length, totalCost, totalCustomerCost, displayStatus,
      installDate, designThumb, allDesignUrls, accent, completionPct: pct,
      customerName: contract?.['Customer Name'] || 'غير محدد',
      designName: adTypes || '—',
      contractNumber: task.contract_id,
      effectiveContractIds,
      isMerged,
      itemsWithInstallPhotos,
      itemsWithDesigns,
      hasAllInstallPhotos,
      hasAllDesigns,
      designDate: designs[0]?.created_at || null,
    };
  }), [tasks, allTaskItems, contractById, teamById, installationPricingByBillboard, designsByTask, derivedContractIdsByTaskId, billboardById]);

  const filtered = useMemo(() => {
    let r = enriched;
    if (filterStatus !== 'all') r = r.filter(t => t.displayStatus === filterStatus);
    if (filterTeam !== 'all') r = r.filter(t => t.team_id === filterTeam);
    if (filterPhotos === 'no_install_photos') r = r.filter(t => !t.hasAllInstallPhotos);
    if (filterPhotos === 'no_designs') r = r.filter(t => !t.hasAllDesigns);
    if (filterPhotos === 'no_any') r = r.filter(t => !t.hasAllInstallPhotos || !t.hasAllDesigns);
    if (search) {
      const s = search.toLowerCase();
      r = r.filter(t =>
        t.customerName.toLowerCase().includes(s) ||
        String(t.contract_id).includes(s) ||
        t.designName.toLowerCase().includes(s) ||
        t.team?.team_name?.toLowerCase().includes(s) ||
        t.id.toLowerCase().includes(s) ||
        ((t as any).task_name || '').toLowerCase().includes(s)
      );
    }
    return r;
  }, [enriched, filterStatus, filterTeam, filterPhotos, search]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let av: any, bv: any;
    switch (sortField) {
      case 'client': av = a.customerName; bv = b.customerName; break;
      case 'contract': av = a.contract_id; bv = b.contract_id; break;
      case 'billboards': av = a.totalItems; bv = b.totalItems; break;
      case 'status': av = a.displayStatus; bv = b.displayStatus; break;
      case 'date': av = a.created_at; bv = b.created_at; break;
      case 'team': av = a.team?.team_name || ''; bv = b.team?.team_name || ''; break;
      case 'cost': av = a.totalCost; bv = b.totalCost; break;
      default: av = a.created_at; bv = b.created_at;
    }
    const cmp = typeof av === 'number' ? av - bv : String(av || '').localeCompare(String(bv || ''));
    return sortDir === 'asc' ? cmp : -cmp;
  }), [filtered, sortField, sortDir]);

  // ── عند تفعيل التجميع: نبني المجموعات أولاً ثم نرقّم على مستوى المجموعة ──
  const contractGroups = useMemo(() => {
    if (!groupByContract) return null;
    const groups: Record<string, typeof sorted> = {};
    sorted.forEach(task => {
      const groupKey = `${task.contract_id}-${task.task_type || 'installation'}-${(task as any).reinstallation_number ?? 'new'}`;
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(task);
    });
    return Object.entries(groups);
  }, [sorted, groupByContract]);

  const totalPages = groupByContract && contractGroups
    ? Math.ceil(contractGroups.length / PAGE_SIZE)
    : Math.ceil(sorted.length / PAGE_SIZE);

  const paginated = groupByContract ? sorted : sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const paginatedGroups = groupByContract && contractGroups
    ? contractGroups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : null;
  const totalCount = groupByContract && contractGroups ? contractGroups.length : sorted.length;

  const allOnPageSel = paginated.length > 0 && paginated.every(t => selected.has(t.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allOnPageSel) {
      paginated.forEach(t => next.delete(t.id));
    } else {
      let allowedType: string | null = null;
      if (selected.size > 0) {
        const firstId = Array.from(selected)[0];
        const firstTask = enriched.find(t => t.id === firstId);
        allowedType = firstTask?.task_type || 'installation';
      } else if (paginated.length > 0) {
        allowedType = paginated[0].task_type || 'installation';
      }

      let hasWarning = false;
      paginated.forEach(t => {
        const tType = t.task_type || 'installation';
        if (allowedType && tType === allowedType) {
          next.add(t.id);
        } else {
          hasWarning = true;
        }
      });

      if (hasWarning) {
        toast.warning('تم تحديد المهام من نفس النوع فقط لتجنب التداخل بين التركيب الجديد وإعادة التركيب.');
      }
    }
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const task = enriched.find(t => t.id === id);
    if (!task) return;

    const isReinstallation = task.task_type === 'reinstallation';

    if (!selected.has(id)) {
      const hasDifferentType = Array.from(selected).some(selectedId => {
        const selTask = enriched.find(t => t.id === selectedId);
        const isSelReinstallation = selTask?.task_type === 'reinstallation';
        return isSelReinstallation !== isReinstallation;
      });

      if (hasDifferentType) {
        toast.error('لا يمكن تحديد مهام تركيب جديدة مع مهام إعادة تركيب في نفس الوقت.');
        return;
      }
    }

    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  /* ── Sort pill button ── */
  const SortPill = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 border hover:scale-[1.03] ${
        sortField === field
          ? 'bg-primary/10 text-primary border-primary/30 shadow-sm'
          : 'text-muted-foreground border-border/40 hover:text-primary hover:border-primary/20'
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
      <div className="bg-card/45 backdrop-blur-md border border-border/25 px-4.5 py-2 flex items-center gap-4 text-xs text-muted-foreground rounded-2xl shrink-0 shadow-sm">
        <div className="flex items-center gap-2 font-bold text-muted-foreground/80 select-none">
          <span>
            {totalCount > 0
              ? `عرض ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalCount)} من ${totalCount} ${groupByContract ? 'مجموعة' : 'مهمة'}`
              : 'لا توجد نتائج'}
          </span>
          <span className="text-[10px] text-muted-foreground/35 font-normal">|</span>
          <span className="text-[10px] text-muted-foreground/50 font-normal">الصفحة {page} من {totalPages}</span>
        </div>
        
        <div className="flex items-center gap-1.5">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 px-2 border-border/30 rounded-xl text-xs gap-1 font-bold text-muted-foreground/80 hover:text-foreground hover:bg-muted/50" 
            disabled={page <= 1} 
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronRight className="h-3.5 w-3.5" />
            السابق
          </Button>
          
          {startPage > 1 && (
            <>
              <Button 
                size="sm"
                className="h-8 w-8 p-0 text-xs rounded-xl bg-transparent hover:bg-muted/50 text-muted-foreground border border-transparent"
                onClick={() => onPageChange(1)}
              >
                1
              </Button>
              {startPage > 2 && <span className="text-muted-foreground/40 px-1 text-[10px]">...</span>}
            </>
          )}

          {pageNumbers.map(p => (
            <Button 
              key={p} 
              size="sm"
              className={`h-8 w-8 p-0 text-xs rounded-xl transition-all ${
                p === page 
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground font-black shadow-md shadow-primary/10' 
                  : 'bg-transparent hover:bg-muted/50 text-muted-foreground border border-transparent'
              }`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </Button>
          ))}

          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && <span className="text-muted-foreground/40 px-1 text-[10px]">...</span>}
              <Button 
                size="sm"
                className="h-8 w-8 p-0 text-xs rounded-xl bg-transparent hover:bg-muted/50 text-muted-foreground border border-transparent"
                onClick={() => onPageChange(totalPages)}
              >
                {totalPages}
              </Button>
            </>
          )}
          
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 px-2 border-border/30 rounded-xl text-xs gap-1 font-bold text-muted-foreground/80 hover:text-foreground hover:bg-muted/50" 
            disabled={page >= totalPages} 
            onClick={() => onPageChange(page + 1)}
          >
            التالي
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-col h-full gap-4" dir="rtl">

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4.5 shrink-0">
          {[
            { 
              label: 'إجمالي المهام', 
              value: stats.totalTasks, 
              color: 'text-indigo-400', 
              icon: LayoutList, 
              bg: 'bg-indigo-500/10', 
              border: 'border-indigo-500/20', 
              accent: 'bg-indigo-500',
              pct: 100 
            },
            { 
              label: 'جديدة / معلقة', 
              value: stats.pendingTasks, 
              color: 'text-amber-400', 
              icon: Clock, 
              bg: 'bg-amber-500/10', 
              border: 'border-amber-500/20', 
              accent: 'bg-amber-500',
              pct: stats.totalTasks > 0 ? Math.round((stats.pendingTasks / stats.totalTasks) * 100) : 0
            },
            { 
              label: 'مكتملة', 
              value: stats.completedTasks, 
              color: 'text-emerald-400', 
              icon: CheckCircle2, 
              bg: 'bg-emerald-500/10', 
              border: 'border-emerald-500/20', 
              accent: 'bg-emerald-500',
              pct: stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0
            },
            { 
              label: 'إجمالي اللوحات', 
              value: stats.totalBillboards, 
              color: 'text-blue-400', 
              icon: Layers, 
              bg: 'bg-blue-500/10', 
              border: 'border-blue-500/20', 
              accent: 'bg-blue-500',
              pct: 100 
            },
            { 
              label: 'لوحات مركبة', 
              value: stats.completedBillboards, 
              color: 'text-primary', 
              icon: CheckCircle2, 
              bg: 'bg-primary/10', 
              border: 'border-primary/20', 
              accent: 'bg-primary',
              pct: stats.totalBillboards > 0 ? Math.round((stats.completedBillboards / stats.totalBillboards) * 100) : 0
            },
          ].map(({ label, value, color, icon: Icon, bg, border, accent, pct }) => (
            <div 
              key={label} 
              className={`relative bg-card/45 backdrop-blur-lg border ${border} rounded-2xl p-5 flex flex-col justify-between min-h-[135px] transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20 group overflow-hidden`}
              style={{
                background: `linear-gradient(135deg, hsl(var(--card)/0.8) 0%, hsl(var(--card)/0.45) 100%)`
              }}
            >
              {/* Top accent glow line */}
              <div className={`absolute top-0 left-0 right-0 h-[3px] ${accent} opacity-70 group-hover:opacity-100 transition-opacity`} />
              
              <div className="flex items-start justify-between">
                <div className="space-y-1.5 text-right flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-muted-foreground/80 tracking-wide uppercase truncate">{label}</p>
                  <p className="text-3xl font-black tracking-tight text-foreground leading-none">{value}</p>
                </div>
                <div className={`p-2.5 rounded-xl ${bg} border border-white/5 transition-all duration-300 group-hover:scale-105 shrink-0 mr-3`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
              </div>
              
              {/* Bottom mini-progress bar */}
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

        {/* ── Toolbar / Control Center ── */}
        <div className="bg-card/55 backdrop-blur-lg border border-border/30 rounded-[22px] p-4.5 flex flex-wrap gap-3.5 items-center justify-between shrink-0 shadow-lg">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <Input
                placeholder="بحث بالاسم، رقم العقد، نوع الإعلان..."
                value={search}
                onChange={e => { setSearch(e.target.value); onPageChange(1); }}
                className="pr-10 bg-background/45 border-border/30 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 h-10 text-xs font-semibold rounded-xl"
              />
            </div>
            
            {/* Status Select */}
            <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); onPageChange(1); }}>
              <SelectTrigger className="w-[135px] h-10 bg-background/45 border-border/30 text-xs font-bold rounded-xl">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent className="border-border/30 bg-popover/95 backdrop-blur-md">
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="pending">جديدة</SelectItem>
                <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                <SelectItem value="completed">مكتملة</SelectItem>
                <SelectItem value="cancelled">ملغاة</SelectItem>
              </SelectContent>
            </Select>

            {/* Team Select */}
            <Select value={filterTeam} onValueChange={v => { setFilterTeam(v); onPageChange(1); }}>
              <SelectTrigger className="w-[145px] h-10 bg-background/45 border-border/30 text-xs font-bold rounded-xl">
                <SelectValue placeholder="الفريق" />
              </SelectTrigger>
              <SelectContent className="border-border/30 bg-popover/95 backdrop-blur-md">
                <SelectItem value="all">جميع الفرق</SelectItem>
                {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.team_name}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* Photos Select */}
            <Select value={filterPhotos} onValueChange={v => { setFilterPhotos(v); onPageChange(1); }}>
              <SelectTrigger className="w-[155px] h-10 bg-background/45 border-border/30 text-xs font-bold rounded-xl">
                <SelectValue placeholder="حالة الصور" />
              </SelectTrigger>
              <SelectContent className="border-border/30 bg-popover/95 backdrop-blur-md">
                <SelectItem value="all">جميع المهام</SelectItem>
                <SelectItem value="no_install_photos">بدون صور تركيب</SelectItem>
                <SelectItem value="no_designs">بدون تصاميم</SelectItem>
                <SelectItem value="no_any">ناقصة الصور</SelectItem>
              </SelectContent>
            </Select>

            {/* Refresh button */}
            <Button variant="outline" size="icon" onClick={onRefresh} className="h-10 w-10 border-border/30 hover:border-primary/30 hover:bg-primary/5 rounded-xl transition-all" title="تحديث البيانات">
              <RefreshCw className="h-4 w-4 text-primary" />
            </Button>
          </div>

          <div className="flex items-center gap-4.5 flex-wrap">
            {/* Sort pills */}
            <div className="hidden xl:flex items-center gap-2">
              <span className="text-[11px] font-bold text-muted-foreground/60 shrink-0">ترتيب:</span>
              <SortPill field="date" label="التاريخ" />
              <SortPill field="client" label="العميل" />
              <SortPill field="cost" label="التكلفة" />
              <SortPill field="billboards" label="اللوحات" />
            </div>

            <div className="flex items-center gap-3">
              {/* Select All */}
              <div className="flex items-center gap-2 bg-muted/30 border border-border/25 px-3 py-2 rounded-xl text-xs font-bold shrink-0 select-none">
                <Checkbox
                  checked={allOnPageSel}
                  onCheckedChange={toggleAll}
                  className="border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary [&_svg]:!text-white [&_svg]:stroke-[3.5px] [&_svg]:h-3 w-3"
                />
                <span className="text-muted-foreground/80">تحديد الكل</span>
              </div>
              
              {/* Add Task Button */}
              <Button 
                onClick={onAddTask} 
                className="h-10 gap-1.5 px-4 bg-primary hover:bg-primary/95 text-primary-foreground font-black shadow-md shadow-primary/10 transition-all hover:scale-[1.02] rounded-xl text-xs"
              >
                <Plus className="h-4 w-4 stroke-[3px]" />
                مهمة جديدة
              </Button>
            </div>
          </div>
        </div>

        {/* ── Bulk Actions Bar ── */}
        <AnimatePresence>
          {selected.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              className="bg-amber-500/8 border border-amber-500/20 rounded-2xl px-5 py-3 flex flex-wrap gap-2.5 items-center shrink-0"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-amber-400 font-bold text-sm">{selected.size} مهمة محددة</span>
              </div>
              <div className="w-px h-5 bg-amber-500/25 mx-1" />
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-3 text-xs gap-1.5 text-amber-400 hover:bg-amber-500/15 rounded-xl"
                onClick={() => setBulkPrintOpen(true)}
              >
                <Printer className="h-3.5 w-3.5" /> طباعة المحدد ({enriched.filter(t => selected.has(t.id)).reduce((s, t) => s + t.totalItems, 0)} لوحة)
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-3 text-xs gap-1.5 text-green-400 hover:bg-green-500/15 rounded-xl"
                onClick={() => setSendTeamDialogOpen(true)}
              >
                <MessageCircle className="h-3.5 w-3.5" /> إرسال للفرق
              </Button>
              {onMergeTasks && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-3 text-xs gap-1.5 text-indigo-400 hover:bg-indigo-500/15 rounded-xl"
                  onClick={() => onMergeTasks(Array.from(selected))}
                >
                  <Merge className="h-3.5 w-3.5" /> دمج المهام
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-8 px-3 text-xs gap-1.5 text-blue-400 hover:bg-blue-500/15 rounded-xl">
                <ChevronDown className="h-3.5 w-3.5" /> تغيير الحالة
              </Button>
              <Button size="sm" variant="ghost" className="h-8 px-3 text-xs gap-1.5 text-slate-400 hover:bg-slate-500/15 rounded-xl">
                <Users className="h-3.5 w-3.5" /> تعيين فريق
              </Button>
              <Button size="sm" variant="ghost" className="h-8 px-3 text-xs gap-1.5 text-red-400 hover:bg-red-500/15 mr-auto rounded-xl">
                <Trash2 className="h-3.5 w-3.5" /> حذف المحدد
              </Button>
              <button
                onClick={() => setSelected(new Set())}
                className="h-8 w-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── View mode toggle & Top Pagination ── */}
        <div className="flex items-center justify-between gap-3 shrink-0 flex-wrap md:flex-nowrap">
          <Button
            size="sm"
            variant={groupByContract ? 'default' : 'outline'}
            className={`h-8 px-3 text-xs gap-1.5 rounded-xl ${groupByContract ? 'bg-amber-500 hover:bg-amber-600 text-black' : ''}`}
            onClick={() => setGroupByContract(!groupByContract)}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            {groupByContract ? 'عرض مسطح' : 'تجميع بالعقد'}
          </Button>

          <PaginationBar />
        </div>

        {/* ── Card list ── */}
        <div className="flex flex-col gap-4 flex-1 overflow-y-auto pb-4 min-h-0">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 - i * 0.15 }}
                transition={{ delay: i * 0.06 }}
              >
                <SkeletonCard />
              </motion.div>
            ))
          ) : paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4 text-muted-foreground">
              <Package className="h-16 w-16 opacity-10" />
              <span className="text-sm opacity-60">لا توجد مهام مطابقة</span>
            </div>
          ) : groupByContract && paginatedGroups ? (
            // ── Contract Grouped View (paginated by group) ──
            paginatedGroups.map(([groupKey, groupTasks]) => {
                const firstTask = groupTasks[0];
                const cid = firstTask.contract_id;
                const contract = contractById[cid];
                const customerName = contract?.['Customer Name'] || 'غير محدد';
                const totalBillboards = groupTasks.reduce((s, t) => s + t.totalItems, 0);
                const completedBillboards = groupTasks.reduce((s, t) => s + t.completed, 0);
                const pct = totalBillboards > 0 ? Math.round((completedBillboards / totalBillboards) * 100) : 0;
                const groupTotalCustomerCost = groupTasks.reduce((s, t) => s + (t.totalCustomerCost || 0), 0);
                const uniqueTeams = [...new Set(groupTasks.map(t => t.team?.team_name).filter(Boolean))];
                const isReinstallation = firstTask.task_type === 'reinstallation';

                const allGroupSelected = groupTasks.every(t => selected.has(t.id));
                const someGroupSelected = groupTasks.some(t => selected.has(t.id));
                const toggleGroup = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  const next = new Set(selected);
                  if (allGroupSelected) {
                    groupTasks.forEach(t => next.delete(t.id));
                  } else {
                    let allowedType: string | null = null;
                    if (selected.size > 0) {
                      const firstId = Array.from(selected)[0];
                      const firstSel = enriched.find(t => t.id === firstId);
                      allowedType = firstSel?.task_type || 'installation';
                    }

                    if (allowedType && isReinstallation !== (allowedType === 'reinstallation')) {
                      toast.error('لا يمكن تحديد هذه المجموعة لأنها تحتوي على نوع مهام مختلف عن التحديد الحالي.');
                      return;
                    }
                    groupTasks.forEach(t => next.add(t.id));
                  }
                  setSelected(next);
                };

                const groupColor = groupColors[groupKey] || null;
                const accentColor = groupColor ? `rgb(${groupColor})` : firstTask.accent;
                const groupBg = groupColor
                  ? `linear-gradient(to left, rgba(${groupColor}, 0.15) 0%, rgba(${groupColor}, 0.04) 35%, rgba(${groupColor}, 0.01) 70%, hsl(var(--card)/0.75) 100%)`
                  : `linear-gradient(to left, color-mix(in srgb, ${accentColor} 10%, transparent) 0%, color-mix(in srgb, ${accentColor} 2%, transparent) 35%, hsl(var(--card)/0.75) 100%)`;
                const groupBorderColor = groupColor
                  ? `rgba(${groupColor}, 0.25)`
                  : `color-mix(in srgb, ${accentColor} 20%, hsl(var(--border)/0.4))`;
                const iconBgColor = groupColor ? `rgba(${groupColor}, 0.12)` : `color-mix(in srgb, ${accentColor} 12%, transparent)`;
                const iconTextColor = groupColor ? `rgb(${groupColor})` : accentColor;

                return (
                  <Collapsible key={groupKey} defaultOpen>
                    <CollapsibleTrigger asChild>
                      <div 
                        className="bg-card/75 backdrop-blur-md border border-border/40 hover:border-primary/25 rounded-2xl px-5 py-3.5 flex flex-wrap items-center gap-4 hover:bg-card/90 transition-all duration-300 cursor-pointer shadow-sm"
                        style={{
                          borderRight: `4px solid ${accentColor}`,
                          background: groupBg,
                          borderColor: groupBorderColor,
                          boxShadow: groupColor 
                            ? `0 4px 20px rgba(${groupColor}, 0.12), inset 0 0 12px rgba(${groupColor}, 0.03)` 
                            : undefined
                        }}
                        role="button" 
                        tabIndex={0}
                      >
                        <div onClick={toggleGroup} className="shrink-0">
                          <Checkbox
                            checked={allGroupSelected}
                            {...(someGroupSelected && !allGroupSelected ? { 'data-state': 'indeterminate' as const } : {})}
                            className="h-4.5 w-4.5 rounded-full border-muted-foreground/35 data-[state=checked]:bg-primary data-[state=checked]:border-primary [&_svg]:!text-white [&_svg]:stroke-[3.5px] [&_svg]:h-3.5 [&_svg]:w-3.5"
                          />
                        </div>
                        <div className={`p-2 rounded-xl shrink-0`} style={{ backgroundColor: iconBgColor, color: iconTextColor }}>
                          <FolderOpen className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-foreground text-base tracking-tight">عقد #{cid}</span>
                            {firstTask.designName && firstTask.designName !== '—' && (
                              <span 
                                className="text-[10px] border rounded-xl px-2.5 py-0.5 font-bold shrink-0 transition-colors"
                                style={{
                                  backgroundColor: iconBgColor,
                                  color: iconTextColor,
                                  borderColor: groupColor ? `rgba(${groupColor}, 0.3)` : 'rgba(var(--primary), 0.2)'
                                }}
                              >
                                {firstTask.designName}
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-bold text-muted-foreground truncate max-w-[200px]" title={customerName}>{customerName}</span>
                        </div>
                        
                        {isReinstallation && (
                          <span className="text-[10px] bg-blue-500/15 text-blue-400 border border-blue-500/25 rounded-full px-2.5 py-0.5 font-semibold shrink-0">
                            إعادة تركيب {(firstTask as any).reinstallation_number || 1}
                          </span>
                        )}

                        <div className="flex flex-wrap items-center gap-2 md:gap-3 mr-auto" onClick={e => e.stopPropagation()}>
                          {/* Stats Pills */}
                          <span className="inline-flex items-center gap-1 bg-muted/40 border border-border/25 px-2.5 py-1 rounded-xl text-[11px] text-muted-foreground font-semibold">
                            <Users className="h-3 w-3" />
                            {groupTasks.length} {groupTasks.length === 1 ? 'فريق' : 'فرق'}
                          </span>
                          <span className="inline-flex items-center gap-1 bg-muted/40 border border-border/25 px-2.5 py-1 rounded-xl text-[11px] text-muted-foreground font-semibold">
                            <Layers className="h-3 w-3" />
                            {completedBillboards}/{totalBillboards} لوحة
                          </span>
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border ${
                            pct === 100 ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/15'
                            : pct > 0 ? 'bg-amber-500/5 text-amber-400 border-amber-500/15'
                            : 'bg-muted/40 text-muted-foreground border-border/25'
                          }`}>
                            {pct}%
                          </span>
                          <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl text-[11px] text-emerald-400 font-extrabold shadow-sm">
                            <Banknote className="h-3.5 w-3.5 text-emerald-400" />
                            تكلفة الزبون: {groupTotalCustomerCost.toLocaleString('ar-LY')} د.ل
                          </span>

                          {uniqueTeams.length > 0 && (
                            <span className="text-[10px] text-muted-foreground/75 truncate max-w-[150px] hidden lg:inline">
                              {uniqueTeams.join(' • ')}
                            </span>
                          )}

                          {/* Action Buttons */}
                          <div className="flex flex-wrap items-center gap-1.5" onClick={e => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2.5 rounded-xl text-[11px] font-semibold gap-1 bg-muted/30 border-border/30 text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-all"
                              onClick={() => onPrintAll(groupTasks.map(t => t.id))}
                            >
                              <FileText className="h-3.5 w-3.5" />
                              طباعة الكل
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2.5 rounded-xl text-[11px] font-semibold gap-1 bg-muted/30 border-border/30 text-muted-foreground hover:bg-purple-500/10 hover:text-purple-500 hover:border-purple-500/20 transition-all"
                              onClick={() => onManageDesignsGroup ? onManageDesignsGroup(groupTasks.map(t => t.id)) : onManageDesigns(firstTask.id)}
                            >
                              <Palette className="h-3.5 w-3.5" />
                              تصميم
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2.5 rounded-xl text-[11px] font-semibold gap-1 bg-muted/30 border-border/30 text-muted-foreground hover:bg-violet-500/10 hover:text-violet-500 hover:border-violet-500/20 transition-all"
                              onClick={() => onDistributeDesignsGroup ? onDistributeDesignsGroup(groupTasks.map(t => t.id)) : onDistributeDesigns(firstTask.id)}
                            >
                              <ImageIcon className="h-3.5 w-3.5" />
                              توزيع
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2.5 rounded-xl text-[11px] font-semibold gap-1 bg-muted/30 border-border/30 text-muted-foreground hover:bg-blue-500/10 hover:text-blue-500 hover:border-blue-500/20 transition-all"
                              onClick={async () => {
                                try {
                                  const allItems = groupTasks.flatMap((t: any) => t.items || []);
                                  if (allItems.length === 0) {
                                    toast.error('لا توجد لوحات في هذه المهمة');
                                    return;
                                  }
                                  const customerName = contract?.['Customer Name'] || '';
                                  const contractAdType = contract?.['Ad Type'] || '';
                                  toast.info('جاري تحضير ملف ZIP...');
                                  const { added, failed } = await exportInstallationTaskImagesToZip({
                                    contractNumber: cid ?? '',
                                    customerName,
                                    contractAdType,
                                    taskItems: allItems,
                                    billboardById,
                                  });
                                  toast.success(`تم تنزيل ${added} صورة${failed > 0 ? ` (فشل ${failed})` : ''}`);
                                } catch (err: any) {
                                  toast.error(err?.message || 'فشل تنزيل صور المهمة');
                                }
                              }}
                            >
                              <Download className="h-3.5 w-3.5" />
                              تنزيل الصور
                            </Button>
                          </div>

                          <ChevronDown className="h-4 w-4 text-muted-foreground/85 transition-transform [[data-state=open]_&]:rotate-180 shrink-0 mr-1" />
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div 
                        className="flex flex-col gap-3 pr-4 pt-2 pb-1 border-r-2 mr-4"
                        style={{
                          borderColor: groupColor ? `rgba(${groupColor}, 0.25)` : `color-mix(in srgb, ${accentColor} 20%, transparent)`
                        }}
                      >
                        {groupTasks.map((task, idx) => {
                          const cfg = STATUS_CONFIG[task.displayStatus];
                          const isSelected = selected.has(task.id);
                          return (
                            <TaskCardRowInner
                              key={task.id}
                              task={task}
                              idx={idx}
                              cfg={cfg}
                              isSelected={isSelected}
                              deleteConfirmId={deleteConfirmId}
                              onOpenTask={onOpenTask}
                              onToggle={() => toggleOne(task.id)}
                              onPrintTask={onPrintTask}
                              onPrintAll={onPrintAll}
                              onSendWhatsApp={onSendWhatsApp}
                              onDistributeDesigns={onDistributeDesigns}
                              onManageDesigns={onManageDesigns}
                              onAddBillboard={onAddBillboard}
                              onDeleteTask={onDeleteTask}
                              setDeleteConfirmId={setDeleteConfirmId}
                              onEditTask={onEditTask}
                              onCompleteAllBillboards={onCompleteAllBillboards}
                              onPrintInvoice={onPrintInvoice}
                              onCreatePrintTask={onCreatePrintTask}
                              onGroupColorExtracted={(color: string) => registerGroupColor(groupKey, color)}
                              onDuplicateAsReinstallation={onDuplicateAsReinstallation}
                            />
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })
          ) : (
            paginated.map((task, idx) => {
              const cfg = STATUS_CONFIG[task.displayStatus];
              const isSelected = selected.has(task.id);

              return (
                <TaskCardRowInner
                  key={task.id}
                  task={task}
                  idx={idx}
                  cfg={cfg}
                  isSelected={isSelected}
                  deleteConfirmId={deleteConfirmId}
                  onOpenTask={onOpenTask}
                  onToggle={() => toggleOne(task.id)}
                  onPrintTask={onPrintTask}
                  onPrintAll={onPrintAll}
                  onSendWhatsApp={onSendWhatsApp}
                  onDistributeDesigns={onDistributeDesigns}
                  onManageDesigns={onManageDesigns}
                  onAddBillboard={onAddBillboard}
                  onDeleteTask={onDeleteTask}
                  setDeleteConfirmId={setDeleteConfirmId}
                  onEditTask={onEditTask}
                  onCompleteAllBillboards={onCompleteAllBillboards}
                  onPrintInvoice={onPrintInvoice}
                  onCreatePrintTask={onCreatePrintTask}
                  onDuplicateAsReinstallation={onDuplicateAsReinstallation}
                />
              );
            })
          )}
        </div>

        {/* ── Pagination ── */}
        <PaginationBar />

        {/* ── Bulk Print Dialog ── */}
        {bulkPrintOpen && (() => {
          const selectedTasks = enriched.filter(t => selected.has(t.id));
          const bulkItems: BillboardPrintItem[] = selectedTasks.flatMap(t => {
            return t.items.map((item: any) => ({
              id: item.id,
              billboard_id: item.billboard_id,
              design_face_a: item.design_face_a,
              design_face_b: item.design_face_b,
              installed_image_face_a_url: item.installed_image_face_a_url,
              installed_image_face_b_url: item.installed_image_face_b_url,
              installation_date: item.installation_date,
              team_id: t.team_id,
              has_cutout: item.has_cutout,
              contract_number: t.contract_id,
              ad_type: t.designName,
            }));
          });
          const firstContract = selectedTasks[0];
          return (
            <UnifiedPrintAllDialog
              open={bulkPrintOpen}
              onOpenChange={setBulkPrintOpen}
              contextType="installation"
              contextNumber={firstContract?.contract_id || 0}
              customerName={selectedTasks.length === 1 ? firstContract?.customerName : `${selectedTasks.length} مهام محددة`}
              adType={selectedTasks.length === 1 ? firstContract?.designName : ''}
              items={bulkItems}
              billboards={billboardById}
              teams={teamById}
              showTeamFilter={true}
              title={`طباعة ${selected.size} مهمة (${bulkItems.length} لوحة)`}
            />
          );
        })()}

        <SendTeamInstallationReportDialog
          open={sendTeamDialogOpen}
          onOpenChange={setSendTeamDialogOpen}
          tasks={tasks.filter(t => selected.has(t.id))}
          allTaskItems={allTaskItems}
          billboardById={billboardById}
          teamById={teamById}
          contractById={contractById}
          designsByTask={designsByTask}
          teams={teams}
        />
      </div>
    </TooltipProvider>
  );
};
