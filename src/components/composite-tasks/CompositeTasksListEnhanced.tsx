import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { usePersistedFilters } from '@/hooks/usePersistedFilters';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchContractDesignUrls } from '@/lib/contractDesignUtils';
import { getOperationalWeekKey, getOperationalWeekRange } from '@/utils/operationalWeek';
import {
  filterTaskContractIdsByCustomer,
  normalizeContractId,
  resolveTaskContractAdTypes,
} from '@/lib/compositeTaskContractIdentity';
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  CheckCircle2, Clock, Package, Users,
  RefreshCw, XCircle, Printer, Scissors,
  Trash2, Edit, ChevronDown, Image as ImageIcon,
  LayoutList, FileText, X, Wallet, Coins,
  ChevronLeft, ChevronRight, CalendarDays,
  DollarSign, TrendingUp, TrendingDown, Wrench,
  FileOutput, Loader2, AlertTriangle, ChevronUp, Percent,
  FolderOpen, Download, Megaphone, MoreHorizontal, Eye
} from 'lucide-react';
import { exportContractImagesToZip } from '@/utils/exportContractImagesToZip';
import { getContractWithBillboards } from '@/services/contractService';
import { EnhancedEditCompositeTaskCostsDialog } from './EnhancedEditCompositeTaskCostsDialog';
import { UnifiedTaskInvoice, InvoiceType } from './UnifiedTaskInvoice';
import { CompositeTaskWithDetails, UpdateCompositeTaskCostsInput } from '@/types/composite-task';
import { CreatePrintTaskFromInstallation } from '../tasks/CreatePrintTaskFromInstallation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface CompositeTasksListEnhancedProps {
  customerId?: string;
  filter?: 'all' | 'pending' | 'completed';
}

type SortField = 'client' | 'contract' | 'revenue' | 'cost' | 'profit' | 'date' | 'status';
type SortDir = 'asc' | 'desc';

const STATUS_CONFIG = {
  completed: {
    label: 'مكتمل',
    color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    dot: 'bg-emerald-400',
    icon: CheckCircle2,
  },
  in_progress: {
    label: 'قيد التنفيذ',
    color: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    dot: 'bg-amber-400',
    icon: Clock,
  },
  pending: {
    label: 'معلقة',
    color: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    dot: 'bg-slate-400',
    icon: Clock,
  },
  cancelled: {
    label: 'ملغاة',
    color: 'bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30',
    dot: 'bg-muted-foreground',
    icon: XCircle,
  },
} as const;

/* ── Design Panel ── */
const DesignPanel = ({
  urls, accent, onColorExtracted,
}: { urls: string[]; accent: string; onColorExtracted?: (c: string | null) => void }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const url = urls[currentIdx % urls.length] || '';

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
    img.src = url;
  }, [url]);

  return (
    <>
      <div
        className="relative flex-shrink-0 overflow-hidden h-full cursor-pointer group/design"
        style={{ width: '100%', minHeight: '100%' }}
        onClick={() => url && setLightboxOpen(true)}
      >
        {url ? (
          <>
            <div className="absolute inset-0">
              <img src={url} alt="" className="w-full h-full object-cover scale-150 blur-xl opacity-50" aria-hidden="true" />
              <div className="absolute inset-0 bg-black/40 group-hover/design:bg-black/25 transition-colors" />
            </div>
            <img 
              src={url} 
              alt="تصميم الإعلان" 
              className="relative w-full h-full object-contain z-10 p-2 transition-transform duration-200 group-hover/design:scale-105" 
              style={{ minHeight: '100%' }} 
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} 
            />
            {urls.length > 1 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 flex gap-1 bg-black/50 px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                {urls.map((_, i) => (
                  <button 
                    key={i} 
                    onClick={(e) => { e.stopPropagation(); setCurrentIdx(i); }}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentIdx % urls.length ? 'bg-white scale-125' : 'bg-white/40 hover:bg-white/70'}`} 
                  />
                ))}
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/design:opacity-100 transition-opacity z-20 flex items-center justify-center pointer-events-none">
              <Eye className="w-5 h-5 text-white/90 drop-shadow" />
            </div>
          </>
        ) : (
          <div 
            className="w-full h-full flex items-center justify-center"
            style={{ minHeight: '100%', background: `linear-gradient(135deg, hsl(var(--muted)/0.4), ${accent}15)` }}
          >
            <div className="flex flex-col items-center gap-1.5 opacity-40">
              <ImageIcon className="h-8 w-8" style={{ color: accent }} />
              <span className="text-[10px] font-medium text-muted-foreground">لا يوجد تصميم</span>
            </div>
          </div>
        )}
        <div className="absolute top-0 right-0 bottom-0 w-[3px]" style={{ background: accent, opacity: 0.85 }} />
      </div>
      {lightboxOpen && url && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setLightboxOpen(false)}>
          <button 
            onClick={() => setLightboxOpen(false)} 
            className="absolute top-4 right-4 z-50 h-10 w-10 bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-full flex items-center justify-center text-white shadow-2xl border-2 border-white/30 transition-all hover:scale-110 cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" strokeWidth={2.5} />
          </button>
          <img src={url} alt="معاينة التصميم" className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>, document.body
      )}
    </>
  );
};

/* ── Sort icon ── */
const SortIcon = ({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) =>
  sortField !== field
    ? <ArrowUpDown className="h-3 w-3 opacity-30" />
    : sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 text-indigo-400" />
      : <ArrowDown className="h-3 w-3 text-indigo-400" />;

/* ── Skeleton ── */
const SkeletonCard = () => (
  <div className="flex rounded-2xl overflow-hidden border border-border/40 bg-card/60" style={{ minHeight: 140 }}>
    <Skeleton className="w-40 shrink-0 rounded-none" />
    <div className="flex-1 p-5 flex flex-col gap-3">
      <Skeleton className="h-5 w-1/3 rounded-lg" />
      <Skeleton className="h-3.5 w-1/4 rounded" />
      <div className="flex gap-6 mt-2">
        <Skeleton className="h-3 w-20 rounded" />
        <Skeleton className="h-3 w-20 rounded" />
      </div>
    </div>
  </div>
);

/* ── Task Card Row ── */
const TaskCardRow = ({
  task, idx, onEditCosts, onDelete, onOpenInvoice, onNavigateToPayment, onCreatePrintTask,
}: {
  task: any; idx: number;
  onEditCosts: (task: any) => void;
  onDelete: (task: any) => void;
  onOpenInvoice: (task: any, type: InvoiceType) => void;
  onNavigateToPayment: (distributedPaymentId: string, customerId: string, customerName: string) => void;
  onCreatePrintTask?: (installationTaskId: string) => void;
}) => {
  const [dominantColor, setDominantColor] = useState<string | null>(null);
  const [localDesignUrls, setLocalDesignUrls] = useState<string[]>(task.designUrls || []);

  useEffect(() => {
    if (task.designUrls && task.designUrls.length > 0) {
      setLocalDesignUrls(task.designUrls);
    } else if (task.contract_id) {
      const contractNo = normalizeContractId(task.contract_id);
      if (contractNo) {
        fetchContractDesignUrls(contractNo).then(urls => {
          if (urls && urls.length > 0) {
            setLocalDesignUrls(urls);
          }
        });
      }
    }
  }, [task.designUrls, task.contract_id]);

  const cfg = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  const hasCutouts = (task.customer_cutout_cost || 0) > 0 || (task.company_cutout_cost || 0) > 0;

  // الحسابات المالية الدقيقة
  const isNewInstallation = task.task_type === 'new_installation';
  const rawCompanyTotal = task.company_total || 0;
  const companyInstall = task.company_installation_cost || 0;
  const adjCompanyTotal = isNewInstallation ? Math.max(0, rawCompanyTotal - companyInstall) : rawCompanyTotal;
  const customerTotalVal = task.customer_total || 0;
  const adjNetProfit = customerTotalVal - adjCompanyTotal;
  const adjProfitPct = customerTotalVal > 0 ? (adjNetProfit / customerTotalVal) * 100 : 0;
  const discountAmt = task.discount_amount || 0;
  const showInstallExcluded = isNewInstallation && companyInstall > 0;

  const remainingDue = Math.max(0, customerTotalVal - (task._totalPaid || 0));
  const isFullyPaid = remainingDue <= 0.01 && customerTotalVal > 0;

  const cardBg = dominantColor
    ? `linear-gradient(to left, rgba(${dominantColor}, 0.15) 0%, rgba(${dominantColor}, 0.06) 35%, rgba(${dominantColor}, 0.02) 70%, hsl(var(--card)) 100%)`
    : `linear-gradient(to left, color-mix(in srgb, ${task.accent || '#6366f1'} 8%, transparent) 0%, color-mix(in srgb, ${task.accent || '#6366f1'} 2%, transparent) 35%, hsl(var(--card)) 100%)`;
  const cardBorder = dominantColor
    ? `1px solid rgba(${dominantColor}, 0.35)`
    : `1px solid color-mix(in srgb, ${task.accent || '#6366f1'} 15%, hsl(var(--border)/0.4))`;

  // تجهيز نص نوع الإعلان
  const adTypeDisplay = task.adType && task.adType.trim().length > 0 && task.adType !== 'غير محدد'
    ? task.adType.trim()
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.02, ease: 'easeOut' }}
      className="group relative rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-lg bg-card/60"
      style={{ background: cardBg, border: cardBorder }}
    >
      {/* Desktop & Laptop layout */}
      <div className="hidden lg:grid grid-cols-[160px_minmax(260px,1.2fr)_215px_195px_170px] items-stretch min-h-[145px]">
        {/* 1. Design Panel (Right in RTL) */}
        <div className="shrink-0 overflow-hidden relative" onClick={e => e.stopPropagation()}>
          <DesignPanel urls={localDesignUrls} accent={task.accent} onColorExtracted={setDominantColor} />
          {localDesignUrls && localDesignUrls.length > 1 && (
            <div className="absolute bottom-2 right-2 z-30 bg-black/70 backdrop-blur-md text-white px-2 py-0.5 rounded-md text-[9px] font-bold border border-white/10 shadow">
              {localDesignUrls.length} تصاميم
            </div>
          )}
        </div>

        {/* 2. Task Identity Section */}
        <div className="p-4 flex flex-col justify-between gap-2.5 text-right border-l border-border/20">
          <div className="space-y-2">
            {/* Header: Customer & Task Number */}
            <div className="flex items-center gap-2 flex-wrap">
              {task.task_number && (
                <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 rounded-md px-2 py-0.5 font-black">
                  م#{task.task_number}
                </span>
              )}
              <span className="text-base font-black text-foreground tracking-tight hover:text-primary transition-colors">
                {task.customer_name || 'غير محدد'}
              </span>
            </div>

            {/* Badges: Task Type & Ad Type */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[10px] rounded-md px-2 py-0.5 font-extrabold border ${
                task.task_type === 'new_installation'
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
              }`}>
                {task.task_type === 'new_installation' ? 'تركيب جديد (شامل)' : `إعادة تركيب ${task.reinstallationNumber ? `(re${task.reinstallationNumber})` : ''}`}
              </span>

              {/* Prominent Golden Ad Type Badge */}
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-black border transition-all ${
                adTypeDisplay 
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 shadow-sm' 
                  : 'bg-muted/40 text-muted-foreground/60 border-border/30'
              }`}>
                <Megaphone className={`h-3 w-3 shrink-0 ${adTypeDisplay ? 'text-amber-400' : 'text-muted-foreground/50'}`} />
                <span>{adTypeDisplay ? `نوع الإعلان: ${adTypeDisplay}` : 'نوع الإعلان غير محدد'}</span>
              </span>
            </div>

            {/* Components: Team / Printer / Cutouts */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {task.installation_task_id && (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Wrench className="h-3 w-3" /> تركيب {task.teamName ? `· ${task.teamName}` : ''}
                </span>
              )}
              {task.print_task_id && (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Printer className="h-3 w-3" /> طباعة {task.printerName ? `· ${task.printerName}` : ''}
                </span>
              )}
              {hasCutouts && (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Scissors className="h-3 w-3" /> مجسمات
                </span>
              )}
            </div>
          </div>

          {/* Footer: Contract & Date */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap pt-1 border-t border-border/15">
            <span className="inline-flex items-center gap-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-extrabold px-2 py-0.5 rounded-md font-mono text-[11px]">
              <FileText className="h-3 w-3 text-indigo-400" />
              <span>العقد: #{task.contractIds && task.contractIds.length > 0 ? task.contractIds.join(', #') : task.contract_id}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-muted-foreground/75 text-[11px] font-semibold">
              <CalendarDays className="h-3 w-3 text-muted-foreground/50" />
              <span>{format(new Date(task.created_at), 'dd MMM yyyy', { locale: ar })}</span>
            </span>
          </div>
        </div>

        {/* 3. Financial Status Widget */}
        <div className="p-3.5 flex flex-col justify-between gap-2 border-l border-border/20 bg-muted/10 text-right" onClick={e => e.stopPropagation()}>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground/80 pb-1 border-b border-border/15">
              <span className="flex items-center gap-1">
                <Wallet className="h-3.5 w-3.5 text-muted-foreground/60" />
                الحالة المالية للزبون
              </span>
            </div>

            <div className="space-y-1 text-[11px]">
              <div className="flex items-center justify-between font-bold">
                <span className="text-muted-foreground/70">الإجمالي:</span>
                <span className="font-black text-foreground">{customerTotalVal.toLocaleString('ar-LY')} د.ل</span>
              </div>
              <div className="flex items-center justify-between font-bold">
                <span className="text-muted-foreground/70">المدفوع:</span>
                <span className="font-black text-emerald-400">{task._totalPaid.toLocaleString('ar-LY')} د.ل</span>
              </div>
              <div className="flex items-center justify-between font-bold pt-1 border-t border-border/10">
                <span className="text-muted-foreground/70">المتبقي:</span>
                {isFullyPaid ? (
                  <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                    مسدد بالكامل
                  </span>
                ) : (
                  <span className="font-black text-rose-400">{remainingDue.toLocaleString('ar-LY')} د.ل</span>
                )}
              </div>
            </div>
          </div>

          {/* Progress Bar & Payments */}
          {customerTotalVal > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-border/15">
              <div className="flex items-center justify-between text-[9px] font-bold text-muted-foreground/60">
                <span>نسبة السداد</span>
                <span className={task._paymentPercentage >= 100 ? 'text-emerald-400' : task._paymentPercentage >= 50 ? 'text-amber-400' : 'text-rose-400'}>
                  {task._paymentPercentage}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${task._paymentPercentage >= 100 ? 'bg-emerald-500' : task._paymentPercentage >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                  style={{ width: `${Math.min(100, Math.max(0, task._paymentPercentage))}%` }}
                />
              </div>

              {/* Payment Chips */}
              {task._payments && task._payments.length > 0 && (
                <div className="flex flex-wrap gap-1 justify-end pt-0.5">
                  {task._payments.slice(0, 3).map((p: any, pIdx: number) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        if (p.distributed_payment_id) {
                          onNavigateToPayment(p.distributed_payment_id, task.customer_id || '', task.customer_name || '');
                        }
                      }}
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all cursor-pointer"
                      title={`دفعة #${p.rowNumber || (pIdx + 1)} - ${p.amount.toLocaleString('ar-LY')} د.ل`}
                    >
                      #{p.rowNumber || (pIdx + 1)}
                    </button>
                  ))}
                  {task._payments.length > 3 && (
                    <span className="text-[8px] text-muted-foreground/60 font-bold self-center">
                      +{task._payments.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4. Cost & Profit Widget */}
        <div className="p-3.5 flex flex-col justify-between gap-2 border-l border-border/20 text-right" onClick={e => e.stopPropagation()}>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground/80 pb-1 border-b border-border/15">
              <span className="flex items-center gap-1">
                <Coins className="h-3.5 w-3.5 text-muted-foreground/60" />
                التكلفة والأرباح
              </span>
            </div>

            <div className="space-y-1 text-[11px]">
              <div className="flex items-center justify-between font-bold">
                <span className="text-muted-foreground/70">التكلفة:</span>
                <span className="font-black text-orange-400">
                  {adjCompanyTotal.toLocaleString('ar-LY')} <span className="text-[9px] font-normal text-muted-foreground">د.ل</span>
                </span>
              </div>
              {showInstallExcluded && (
                <div className="text-[9px] text-muted-foreground/60 text-left font-medium">
                  (شامل التركيب)
                </div>
              )}
              {discountAmt > 0 && (
                <div className="flex items-center justify-between font-bold text-rose-400 text-[10px]">
                  <span>الخصم:</span>
                  <span>−{discountAmt.toLocaleString('ar-LY')} د.ل</span>
                </div>
              )}
            </div>
          </div>

          {/* Profit Indicator */}
          <div className="p-2 rounded-xl bg-card/60 border border-border/25 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {adjNetProfit >= 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <TrendingDown className="h-4 w-4 text-rose-400 shrink-0" />
              )}
              <span className={`text-xs font-black ${adjNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {adjNetProfit.toLocaleString('ar-LY')} <span className="text-[9px] font-normal">د.ل</span>
              </span>
            </div>
            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
              adjNetProfit >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}>
              {customerTotalVal > 0 ? adjProfitPct.toFixed(0) : 0}%
            </span>
          </div>
        </div>

        {/* 5. Status & Smart Actions Panel (Left in RTL) */}
        <div className="p-3.5 flex flex-col justify-between items-center gap-2 text-center" onClick={e => e.stopPropagation()}>
          <div className="space-y-1.5 flex flex-col items-center">
            <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-black whitespace-nowrap shadow-sm ${cfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} shrink-0 animate-pulse`} />
              {cfg.label}
            </span>
            {task.invoice_generated && (
              <span className="text-[9px] font-bold text-indigo-400/80 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md flex items-center gap-1 select-none">
                <FileText className="h-2.5 w-2.5 text-indigo-400" /> فاتورة صادرة
              </span>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5">
            {/* Primary Action: Customer Invoice */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onOpenInvoice(task, 'customer')}
                  className="h-8.5 w-8.5 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/25 transition-all cursor-pointer"
                  aria-label="فاتورة الزبون"
                >
                  <FileOutput className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">فاتورة الزبون</TooltipContent>
            </Tooltip>

            {/* Secondary Action: Print or Team */}
            {task.print_task_id ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onOpenInvoice(task, 'print_vendor')}
                    className="h-8.5 w-8.5 rounded-xl flex items-center justify-center bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/25 transition-all cursor-pointer"
                    aria-label="فاتورة المطبعة"
                  >
                    <Printer className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">فاتورة المطبعة</TooltipContent>
              </Tooltip>
            ) : (
              task.installation_task_id && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onCreatePrintTask?.(task.installation_task_id)}
                      className="h-8.5 w-8.5 rounded-xl flex items-center justify-center bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/25 transition-all cursor-pointer"
                      aria-label="إنشاء مهمة طباعة"
                    >
                      <Printer className="h-4 w-4 animate-pulse" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">إنشاء مهمة طباعة</TooltipContent>
                </Tooltip>
              )
            )}

            {/* Prominent & Clear Edit Costs Action */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onEditCosts(task)}
                  className="h-8.5 w-8.5 rounded-xl flex items-center justify-center bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-all shadow-sm cursor-pointer"
                  aria-label="تعديل التكاليف"
                >
                  <Edit className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs font-bold">تعديل التكاليف</TooltipContent>
            </Tooltip>

            {/* More Menu Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="h-8.5 w-8.5 rounded-xl flex items-center justify-center bg-muted/40 text-muted-foreground border border-border/40 hover:bg-muted/70 hover:text-foreground transition-all cursor-pointer"
                  aria-label="المزيد من الإجراءات"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 text-right font-tajawal rounded-xl border-border/40 shadow-xl" dir="rtl">
                <DropdownMenuItem onClick={() => onOpenInvoice(task, 'customer')} className="gap-2 cursor-pointer text-xs">
                  <FileOutput className="h-3.5 w-3.5 text-indigo-400" />
                  <span>فاتورة الزبون</span>
                </DropdownMenuItem>
                {task.print_task_id && (
                  <DropdownMenuItem onClick={() => onOpenInvoice(task, 'print_vendor')} className="gap-2 cursor-pointer text-xs">
                    <Printer className="h-3.5 w-3.5 text-violet-400" />
                    <span>فاتورة المطبعة</span>
                  </DropdownMenuItem>
                )}
                {task.installation_task_id && (
                  <DropdownMenuItem onClick={() => onOpenInvoice(task, 'installation_team')} className="gap-2 cursor-pointer text-xs">
                    <Users className="h-3.5 w-3.5 text-teal-400" />
                    <span>فاتورة الفرقة</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onEditCosts(task)} className="gap-2 cursor-pointer text-xs">
                  <Edit className="h-3.5 w-3.5 text-amber-400" />
                  <span>تعديل التكاليف</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => onDelete(task)} 
                  className="gap-2 cursor-pointer text-xs text-rose-400 focus:text-rose-400 focus:bg-rose-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>حذف المهمة</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Mobile & Tablet layout */}
      <div className="flex flex-col lg:hidden p-4 gap-3 bg-card/60 backdrop-blur-md text-right">
        {/* Header: Customer & Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {task.task_number && (
                <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded px-1.5 py-0.5 font-bold">
                  م#{task.task_number}
                </span>
              )}
              <span className="text-base font-black text-foreground">{task.customer_name || 'غير محدد'}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className={`text-[10px] rounded-md px-2 py-0.5 font-extrabold border ${
                task.task_type === 'new_installation'
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
              }`}>
                {task.task_type === 'new_installation' ? 'جديد (شامل)' : 'إعادة تركيب'}
              </span>

              {/* Mobile Ad Type Badge */}
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black border ${
                adTypeDisplay 
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' 
                  : 'bg-muted/40 text-muted-foreground/60 border-border/30'
              }`}>
                <Megaphone className="h-3 w-3 text-amber-400 shrink-0" />
                <span>{adTypeDisplay ? adTypeDisplay : 'نوع الإعلان غير محدد'}</span>
              </span>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full border font-black whitespace-nowrap shrink-0 ${cfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>

        {/* Contract & Operations components */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border/15">
          <span className="flex items-center gap-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-md font-mono text-[11px] font-bold">
            <FileText className="h-3 w-3" /> #{task.contract_id}
          </span>
          {task.teamName && (
            <span className="flex items-center gap-1 text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md text-[10px] font-bold">
              <Wrench className="h-3 w-3" /> {task.teamName}
            </span>
          )}
          {task.printerName && (
            <span className="flex items-center gap-1 text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md text-[10px] font-bold">
              <Printer className="h-3 w-3" /> {task.printerName}
            </span>
          )}
          <span className="flex items-center gap-1 font-semibold text-[11px] mr-auto">
            <CalendarDays className="h-3 w-3 text-muted-foreground/50" />
            {format(new Date(task.created_at), 'dd/MM/yyyy', { locale: ar })}
          </span>
        </div>

        {/* Mobile Financial Summary Box */}
        <div className="bg-background/40 p-3 rounded-xl border border-border/20 grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <div className="text-[10px] font-bold text-muted-foreground/60 mb-0.5">الزبون</div>
            <div className="text-xs font-black text-foreground">{(task.customer_total || 0).toLocaleString('ar-LY')}</div>
            <div className="text-[9px] text-emerald-400 font-bold">مدفوع: {task._totalPaid.toLocaleString('ar-LY')}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-muted-foreground/60 mb-0.5">التكلفة</div>
            <div className="text-xs font-black text-orange-400">{adjCompanyTotal.toLocaleString('ar-LY')}</div>
            {discountAmt > 0 && (
              <div className="text-[9px] font-bold text-rose-400">خصم: −{discountAmt.toLocaleString('ar-LY')}</div>
            )}
          </div>
          <div>
            <div className="text-[10px] font-bold text-muted-foreground/60 mb-0.5">الربح</div>
            <div className={`text-xs font-black ${adjNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {adjNetProfit.toLocaleString('ar-LY')}
            </div>
            <div className={`text-[9px] font-bold ${adjNetProfit >= 0 ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>
              {customerTotalVal > 0 ? adjProfitPct.toFixed(0) : 0}%
            </div>
          </div>
        </div>

        {/* Mobile Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-border/20 gap-2" onClick={e => e.stopPropagation()}>
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => onOpenInvoice(task, 'customer')}
              className="h-8 px-2.5 rounded-lg flex items-center gap-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-bold"
            >
              <FileOutput className="h-3.5 w-3.5" />
              <span>فاتورة</span>
            </button>
            {task.print_task_id ? (
              <button
                onClick={() => onOpenInvoice(task, 'print_vendor')}
                className="h-8 px-2.5 rounded-lg flex items-center gap-1 bg-violet-500/10 text-violet-400 border border-violet-500/20 text-xs font-bold"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>المطبعة</span>
              </button>
            ) : (
              task.installation_task_id && (
                <button
                  onClick={() => onCreatePrintTask?.(task.installation_task_id)}
                  className="h-8 px-2.5 rounded-lg flex items-center gap-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-bold"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>إنشاء طباعة</span>
                </button>
              )
            )}
            {task.installation_task_id && (
              <button
                onClick={() => onOpenInvoice(task, 'installation_team')}
                className="h-8 px-2.5 rounded-lg flex items-center gap-1 bg-teal-500/10 text-teal-400 border border-teal-500/20 text-xs font-bold"
              >
                <Users className="h-3.5 w-3.5" />
                <span>الفرقة</span>
              </button>
            )}
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => onEditCosts(task)}
              className="h-8 px-3 rounded-lg flex items-center gap-1 bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-bold hover:bg-amber-500/25"
              aria-label="تعديل التكاليف"
            >
              <Edit className="h-3.5 w-3.5" />
              <span>تعديل</span>
            </button>
            <button
              onClick={() => onDelete(task)}
              className="h-8 w-8 rounded-lg flex items-center justify-center bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20"
              aria-label="حذف"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const CompositeTasksListEnhanced: React.FC<CompositeTasksListEnhancedProps> = ({
  customerId,
  filter = 'all'
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { filters: persistedFilters, setFilter: setPersisted } = usePersistedFilters('composite-tasks', {
    search: '',
    filterStatus: 'all',
    sortField: 'date' as SortField,
    sortDir: 'desc' as SortDir,
    page: 1,
  });
  const [search, _setSearch] = useState(persistedFilters.search);
  const [filterStatus, _setFilterStatus] = useState(persistedFilters.filterStatus);
  const [sortField, _setSortField] = useState<SortField>(persistedFilters.sortField as SortField);
  const [sortDir, _setSortDir] = useState<SortDir>(persistedFilters.sortDir as SortDir);
  const [page, _setPage] = useState(persistedFilters.page as number);
  const setSearch = (v: string) => { _setSearch(v); setPersisted('search', v); };
  const setFilterStatus = (v: string) => { _setFilterStatus(v); setPersisted('filterStatus', v); };
  const setSortField = (v: SortField) => { _setSortField(v); setPersisted('sortField', v); };
  const setSortDir = (v: SortDir) => { _setSortDir(v); setPersisted('sortDir', v); };
  const setPage = (v: number) => { _setPage(v); setPersisted('page', v); };
  const [editingTask, setEditingTask] = useState<CompositeTaskWithDetails | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [invoiceTask, setInvoiceTask] = useState<any>(null);
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('customer');
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [deleteTask, setDeleteTask] = useState<any>(null);
  const [groupInvoiceTasks, setGroupInvoiceTasks] = useState<any[] | null>(null);
  const [groupInvoiceOpen, setGroupInvoiceOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [discountPopoverGroup, setDiscountPopoverGroup] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState('');
  const [discountTarget, setDiscountTarget] = useState<'all' | string>('all');
  const [discountSaving, setDiscountSaving] = useState(false);
  const [zipDownloadingGroup, setZipDownloadingGroup] = useState<string | null>(null);

  // State for Print Task Creation Dialog
  const [createPrintDialogOpen, setCreatePrintDialogOpen] = useState(false);
  const [selectedInstallTaskId, setSelectedInstallTaskId] = useState<string | null>(null);
  const [selectedTaskItems, setSelectedTaskItems] = useState<any[]>([]);
  const [fetchingItems, setFetchingItems] = useState(false);
  const [printQueue, setPrintQueue] = useState<string[]>([]);

  const handleOpenCreatePrintTask = async (installationTaskId: string) => {
    setFetchingItems(true);
    const tId = toast.loading('جاري تحميل بنود المهمة...');
    try {
      const { data, error } = await supabase
        .from('installation_task_items')
        .select('id, billboard_id, design_face_a, design_face_b, has_cutout, selected_design_id, faces_to_install')
        .eq('task_id', installationTaskId);
      
      if (!error && data) {
        setSelectedInstallTaskId(installationTaskId);
        setSelectedTaskItems(data);
        setCreatePrintDialogOpen(true);
        toast.dismiss(tId);
      } else {
        toast.dismiss(tId);
        toast.error('فشل في تحميل بنود مهمة التركيب');
      }
    } catch (err) {
      console.error('Error fetching installation task items:', err);
      toast.dismiss(tId);
      toast.error('حدث خطأ أثناء تحميل البنود');
    } finally {
      setFetchingItems(false);
    }
  };

  const processNextInPrintQueue = useCallback(async (currentQueue: string[]) => {
    if (currentQueue.length === 0) {
      setPrintQueue([]);
      setSelectedInstallTaskId(null);
      setSelectedTaskItems([]);
      return;
    }
    const nextTaskId = currentQueue[0];
    setPrintQueue(currentQueue.slice(1));
    
    const { data } = await supabase
      .from('installation_task_items')
      .select('id, billboard_id, design_face_a, design_face_b, has_cutout, selected_design_id, faces_to_install')
      .eq('task_id', nextTaskId);
    
    if (data && data.length > 0) {
      setSelectedInstallTaskId(nextTaskId);
      setSelectedTaskItems(data);
      setCreatePrintDialogOpen(true);
    } else {
      processNextInPrintQueue(currentQueue.slice(1));
    }
  }, []);

  const handleCreatePrintTasksForGroup = useCallback((tasks: any[]) => {
    const tasksToCreate = tasks.filter(t => !t.print_task_id && t.installation_task_id);
    if (tasksToCreate.length === 0) {
      toast.info('جميع المهام في هذه التجميعة تحتوي بالفعل على مهام طباعة.');
      return;
    }
    const queue = tasksToCreate.map(t => t.installation_task_id);
    toast.info(`سيتم البدء في إنشاء مهام الطباعة لـ ${queue.length} مهمة...`);
    processNextInPrintQueue(queue);
  }, [processNextInPrintQueue]);

  const handleDownloadGroupZip = useCallback(async (group: { key: string; contractId: number; customerName: string }) => {
    if (zipDownloadingGroup) return;
    setZipDownloadingGroup(group.key);
    const tId = toast.loading('جاري تحضير ملف ZIP للعقد...');
    try {
      const contractWithBillboards: any = await getContractWithBillboards(String(group.contractId));
      const billboardsData = contractWithBillboards?.billboards || [];
      if (billboardsData.length === 0) {
        toast.dismiss(tId);
        toast.info('لا توجد لوحات لهذا العقد');
        return;
      }
      const { added, failed } = await exportContractImagesToZip({
        contractNumber: group.contractId,
        billboards: billboardsData,
        customerName: group.customerName || '',
      });
      toast.dismiss(tId);
      toast.success(`تم تنزيل ${added} صورة${failed ? ` (تعذّر ${failed})` : ''}`);
    } catch (err: any) {
      toast.dismiss(tId);
      toast.error(err?.message || 'فشل تنزيل ملف ZIP');
    } finally {
      setZipDownloadingGroup(null);
    }
  }, [zipDownloadingGroup]);

  const PAGE_SIZE = 15;

  // 1. Fetch composite tasks
  const { data: compositeTasks = [], isLoading, refetch } = useQuery({
    queryKey: ['composite-tasks', customerId, filter],
    queryFn: async () => {
      let query = supabase
        .from('composite_tasks')
        .select(`*, customer:customers(id, name, company, phone)`)
        .order('created_at', { ascending: false });

      if (customerId) query = query.eq('customer_id', customerId);
      if (filter === 'pending') query = query.in('status', ['pending', 'in_progress']);
      else if (filter === 'completed') query = query.eq('status', 'completed');

      const { data, error } = await query;
      if (error) throw error;

      const tasks = (data || []) as CompositeTaskWithDetails[];

      // Fetch contract IDs from installation task items
      const installationTaskIds = Array.from(
        new Set(tasks.map(t => t.installation_task_id).filter((id): id is string => Boolean(id)))
      );

      if (installationTaskIds.length > 0) {
        const [installItemsRes, installTasksRes] = await Promise.all([
          supabase
            .from('installation_task_items')
            .select('task_id, billboard:billboards!installation_task_items_billboard_id_fkey(Contract_Number)')
            .in('task_id', installationTaskIds),
          supabase
            .from('installation_tasks')
            .select('id, task_type, reinstallation_number, contract_id')
            .in('id', installationTaskIds)
        ]);

        const installItems = installItemsRes.data || [];
        const installTasksData = installTasksRes.data || [];

        const map = new Map<string, Set<number>>();
        installItems.forEach((row: any) => {
          const taskId = row.task_id as string;
          const contractNo = normalizeContractId(row.billboard?.Contract_Number);
          if (!taskId || !contractNo) return;
          if (!map.has(taskId)) map.set(taskId, new Set());
          map.get(taskId)!.add(contractNo);
        });

        const reinstallInfoMap = new Map<string, { number: number | null; taskType: string; contractId: number | null }>();
        installTasksData.forEach((it: any) => {
          reinstallInfoMap.set(it.id, { 
            number: it.reinstallation_number, 
            taskType: it.task_type || 'installation',
            contractId: normalizeContractId(it.contract_id)
          });
        });

        tasks.forEach((t: any) => {
          const set = t.installation_task_id ? map.get(t.installation_task_id) : undefined;
          const derived = set ? Array.from(set) : [];
          const reinstallInfo = t.installation_task_id ? reinstallInfoMap.get(t.installation_task_id) : undefined;
          
          const directContract = normalizeContractId(t.contract_id) || reinstallInfo?.contractId;
          const allCids = [...new Set([...derived, ...(directContract ? [directContract] : [])])];
          
          t._contractIds = allCids.length > 0 ? allCids : (directContract ? [directContract] : []);
          t._reinstallationNumber = reinstallInfo?.number ?? null;
        });
      }

      tasks.forEach((t: any) => {
        if (!t._contractIds || !Array.isArray(t._contractIds) || t._contractIds.length === 0) {
          const c = normalizeContractId(t.contract_id);
          t._contractIds = c ? [c] : [];
        }
      });

      return tasks;
    },
  });

  // 2. Fetch design images, ad types, and operations data with strict normalization
  const { data: taskExtras = {} } = useQuery({
    queryKey: ['composite-task-extras', compositeTasks.map(t => t.id).join(',')],
    enabled: compositeTasks.length > 0,
    queryFn: async () => {
      const extras: Record<string, { 
        designUrls: string[]; 
        contractIds: number[];
        adTypes: string[];
        adType: string; 
        teamName: string; 
        reinstallationNumber: number | null; 
        printerName: string;
        realInstallCost: number;
      }> = {};

      const installIds = compositeTasks.map(t => t.installation_task_id).filter(Boolean) as string[];
      const printIds = compositeTasks.map(t => t.print_task_id).filter(Boolean) as string[];
      
      // Collect ALL unique normalized contract IDs from composite_tasks and related structures
      const allContractIdsSet = new Set<number>();
      compositeTasks.forEach((t: any) => {
        const c1 = normalizeContractId(t.contract_id);
        if (c1) allContractIdsSet.add(c1);
        if (Array.isArray(t._contractIds)) {
          t._contractIds.forEach((cid: unknown) => {
            const c = normalizeContractId(cid);
            if (c) allContractIdsSet.add(c);
          });
        }
      });

      let installDesigns: any[] = [];
      let printDesigns: any[] = [];
      let contracts: any[] = [];
      let installTasks: any[] = [];
      let taskDesignsData: any[] = [];
      let printTasksData: any[] = [];

      const promises: Promise<any>[] = [];

      // Fetch installation tasks to ensure contract links
      if (installIds.length > 0) {
        promises.push(
          supabase.from('installation_tasks')
            .select('id, task_type, reinstallation_number, contract_id, team:installation_teams!installation_tasks_team_id_fkey(team_name)')
            .in('id', installIds)
            .then(({ data }) => {
              installTasks = data || [];
              (installTasks || []).forEach(it => {
                const c = normalizeContractId(it.contract_id);
                if (c) allContractIdsSet.add(c);
              });
            })
        );
        promises.push(
          supabase.from('installation_task_items')
            .select('task_id, design_face_a, design_face_b')
            .in('task_id', installIds)
            .then(({ data }) => { installDesigns = data || []; })
        );
      }

      if (printIds.length > 0) {
        promises.push(
          supabase.from('print_task_items')
            .select('task_id, design_face_a, design_face_b')
            .in('task_id', printIds)
            .then(({ data }) => { printDesigns = data || []; })
        );
        promises.push(
          supabase.from('print_tasks')
            .select('id, printer:printers!print_tasks_printer_id_fkey(name)')
            .in('id', printIds)
            .then(({ data }) => { printTasksData = data || []; })
        );
      }

      await Promise.all(promises);

      // Now query Contract table for ALL gathered contract numbers
      const finalUniqueContractIds = Array.from(allContractIdsSet);
      if (finalUniqueContractIds.length > 0) {
        const { data: contractsData } = await supabase
          .from('Contract')
          .select('"Contract_Number", "Ad Type", "Customer Name", customer_id')
          .in('Contract_Number', finalUniqueContractIds);
        contracts = contractsData || [];
      }

      const contractCandidates: ContractAdTypeCandidate[] = contracts.map((contract: any) => ({
        contractNumber: contract.Contract_Number,
        adType: contract['Ad Type'] || contract.ad_type || '',
        customerId: contract.customer_id,
        customerName: contract['Customer Name'],
      }));

      const teamNameMap = new Map<string, string>();
      const reinstallMap = new Map<string, number | null>();
      const contractByInstallTaskId = new Map<string, number>();

      installTasks.forEach((t: any) => { 
        teamNameMap.set(t.id, t.team?.team_name || ''); 
        reinstallMap.set(t.id, t.task_type === 'reinstallation' ? (t.reinstallation_number || 1) : null);
        const c = normalizeContractId(t.contract_id);
        if (c) contractByInstallTaskId.set(t.id, c);
      });

      const printerNameMap = new Map<string, string>();
      printTasksData.forEach((pt: any) => {
        printerNameMap.set(pt.id, pt.printer?.name || '');
      });

      // Real installation costs
      const realInstallCostMap = new Map<string, number>();
      if (installIds.length > 0) {
        const { data: realItems } = await supabase
          .from('installation_task_items')
          .select('task_id, customer_installation_cost, reinstall_count, customer_original_install_cost, customer_reinstall_cost')
          .in('task_id', installIds);

        (realItems || []).forEach((item: any) => {
          const isReinstalled = (item.reinstall_count || 0) > 0;
          const itemCost = isReinstalled
            ? (Number(item.customer_original_install_cost) || 0) + (Number(item.customer_reinstall_cost) || Number(item.customer_installation_cost) || 0)
            : (Number(item.customer_installation_cost) || 0);
          
          const curr = realInstallCostMap.get(item.task_id) || 0;
          realInstallCostMap.set(item.task_id, curr + itemCost);
        });
      }

      // Fetch designs
      const contractDesignMap = new Map<number, string[]>();
      await Promise.all(
        finalUniqueContractIds.map(async (cId) => {
          const urls = await fetchContractDesignUrls(cId);
          if (urls && urls.length > 0) {
            contractDesignMap.set(cId, urls);
          }
        })
      );

      compositeTasks.forEach(task => {
        const seen = new Set<string>();
        const urls: string[] = [];

        // Resolve candidate contract IDs for this task
        const rawCandidateContractIds: number[] = [];
        const directC = normalizeContractId(task.contract_id);
        if (directC) rawCandidateContractIds.push(directC);
        if (Array.isArray((task as any)._contractIds)) {
          (task as any)._contractIds.forEach((cid: unknown) => {
            const c = normalizeContractId(cid);
            if (c && !rawCandidateContractIds.includes(c)) rawCandidateContractIds.push(c);
          });
        }
        if (task.installation_task_id) {
          const c = contractByInstallTaskId.get(task.installation_task_id);
          if (c && !rawCandidateContractIds.includes(c)) rawCandidateContractIds.push(c);
        }

        const candidateContractIds = filterTaskContractIdsByCustomer({
          candidateContractIds: rawCandidateContractIds,
          directContractId: task.contract_id,
          taskCustomerId: task.customer_id,
          taskCustomerName: task.customer_name,
          contracts: contractCandidates,
        });

        // Gather design images
        candidateContractIds.forEach(cId => {
          const contractUrls = contractDesignMap.get(cId) || [];
          contractUrls.forEach(u => {
            if (!seen.has(u)) {
              seen.add(u);
              urls.push(u);
            }
          });
        });

        // Fallback designs from print items
        if (urls.length === 0 && task.print_task_id) {
          printDesigns.filter(d => d.task_id === task.print_task_id).forEach(d => {
            if (d.design_face_a && !seen.has(d.design_face_a)) { seen.add(d.design_face_a); urls.push(d.design_face_a); }
            if (d.design_face_b && !seen.has(d.design_face_b)) { seen.add(d.design_face_b); urls.push(d.design_face_b); }
          });
        }

        // Fallback designs from install items
        if (urls.length === 0 && task.installation_task_id) {
          installDesigns.filter(d => d.task_id === task.installation_task_id).forEach(d => {
            if (d.design_face_a && !seen.has(d.design_face_a)) { seen.add(d.design_face_a); urls.push(d.design_face_a); }
            if (d.design_face_b && !seen.has(d.design_face_b)) { seen.add(d.design_face_b); urls.push(d.design_face_b); }
          });
        }

        // Resolve ad types only from contracts owned by this task's customer.
        const taskAdTypes = resolveTaskContractAdTypes({
          candidateContractIds,
          directContractId: task.contract_id,
          taskCustomerId: task.customer_id,
          taskCustomerName: task.customer_name,
          contracts: contractCandidates,
        });

        extras[task.id] = {
          designUrls: urls.slice(0, 4),
          contractIds: candidateContractIds,
          adTypes: taskAdTypes,
          adType: taskAdTypes.length > 0 ? taskAdTypes.join(' / ') : '',
          teamName: task.installation_task_id ? teamNameMap.get(task.installation_task_id) || '' : '',
          reinstallationNumber: task.installation_task_id ? reinstallMap.get(task.installation_task_id) ?? null : null,
          printerName: task.print_task_id ? printerNameMap.get(task.print_task_id) || '' : '',
          realInstallCost: task.installation_task_id ? (realInstallCostMap.get(task.installation_task_id) ?? Number(task.customer_installation_cost) ?? 0) : Number(task.customer_installation_cost) ?? 0,
        };
      });

      return extras;
    },
  });

  // 3. Fetch payments distributed to composite tasks
  const { data: taskPayments = {} } = useQuery({
    queryKey: ['composite-task-payments', compositeTasks.map(t => t.id).join(',')],
    enabled: compositeTasks.length > 0,
    queryFn: async () => {
      const taskIds = compositeTasks.map(t => t.id);
      if (taskIds.length === 0) return {};

      const { data } = await supabase
        .from('customer_payments')
        .select('id, amount, payment_date, entry_type, notes, composite_task_id, distributed_payment_id')
        .in('composite_task_id', taskIds)
        .eq('entry_type', 'payment')
        .order('payment_date', { ascending: true });

      const map: Record<string, any[]> = {};
      (data || []).forEach((p: any) => {
        if (!map[p.composite_task_id]) map[p.composite_task_id] = [];
        map[p.composite_task_id].push(p);
      });
      return map;
    },
  });

  // 4. Enrich tasks with full relational properties
  const enriched = useMemo(() => compositeTasks.map((task: any) => {
    const extra = taskExtras[task.id] || { designUrls: [], contractIds: [], adTypes: [], adType: '', teamName: '', reinstallationNumber: null, printerName: '', realInstallCost: 0 };
    const payments = taskPayments[task.id] || [];
    const totalPaid = payments.length > 0 
      ? payments.reduce((s: number, p: any) => s + p.amount, 0) 
      : (task.paid_amount || 0);

    const realCustomerInstall = extra.realInstallCost > 0 ? extra.realInstallCost : (Number(task.customer_installation_cost) || 0);
    const customerTotal = realCustomerInstall + (Number(task.customer_print_cost) || 0) + (Number(task.customer_cutout_cost) || 0) - (Number(task.discount_amount) || 0);
    const companyTotal = (Number(task.company_installation_cost) || 0) + (Number(task.company_print_cost) || 0) + (Number(task.company_cutout_cost) || 0);
    const netProfit = customerTotal - companyTotal;
    const paymentPercentage = customerTotal > 0 ? Math.min(Math.round((totalPaid / customerTotal) * 100), 100) : 0;
    
    let h = 0;
    for (let i = 0; i < task.id.length; i++) h = task.id.charCodeAt(i) + ((h << 5) - h);
    const accent = `hsl(${Math.abs(h) % 360}, 55%, 58%)`;

    const contractIds = extra.contractIds.length > 0
      ? extra.contractIds
      : [normalizeContractId(task.contract_id)].filter((id): id is number => id !== null);

    return {
      ...task,
      customer_installation_cost: realCustomerInstall,
      customer_total: customerTotal,
      company_total: companyTotal,
      net_profit: netProfit,
      designUrls: extra.designUrls,
      adTypes: extra.adTypes || (extra.adType ? [extra.adType] : []),
      adType: extra.adType || '',
      teamName: extra.teamName || '',
      printerName: extra.printerName || '',
      reinstallationNumber: task._reinstallationNumber ?? extra.reinstallationNumber ?? null,
      accent,
      contractIds,
      _payments: payments,
      _totalPaid: totalPaid,
      _paymentPercentage: paymentPercentage,
    };
  }), [compositeTasks, taskExtras, taskPayments]);

  // Overall Stats
  const stats = useMemo(() => {
    const totalRevenue = enriched.reduce((s, t) => s + (t.customer_total || 0), 0);
    const totalPaid = enriched.reduce((s, t) => s + (t._totalPaid || 0), 0);
    const totalRemaining = enriched.reduce((s, t) => s + Math.max(0, (t.customer_total || 0) - (t._totalPaid || 0)), 0);
    return {
      total: enriched.length,
      pending: enriched.filter(t => t.status === 'pending' || t.status === 'in_progress').length,
      completed: enriched.filter(t => t.status === 'completed').length,
      totalRevenue,
      totalProfit: enriched.reduce((s, t) => s + (t.net_profit || 0), 0),
      totalPaid,
      totalRemaining,
    };
  }, [enriched]);

  // Filter
  const filtered = useMemo(() => {
    let r = enriched;
    if (filterStatus !== 'all') r = r.filter(t => t.status === filterStatus);
    if (search) {
      const s = search.toLowerCase().trim();
      r = r.filter(t =>
        (t.customer_name || '').toLowerCase().includes(s) ||
        String(t.contract_id).includes(s) ||
        (t.adType || '').toLowerCase().includes(s) ||
        (t.teamName || '').toLowerCase().includes(s) ||
        (t.printerName || '').toLowerCase().includes(s) ||
        ((t as any).task_name || '').toLowerCase().includes(s) ||
        (t.contractIds || []).some((c: any) => String(c).includes(s))
      );
    }
    return r;
  }, [enriched, filterStatus, search]);

  // Sort
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let av: any, bv: any;
    switch (sortField) {
      case 'client': av = a.customer_name; bv = b.customer_name; break;
      case 'contract': av = a.contract_id; bv = b.contract_id; break;
      case 'revenue': av = a.customer_total; bv = b.customer_total; break;
      case 'cost': av = a.company_total; bv = b.company_total; break;
      case 'profit': av = a.net_profit; bv = b.net_profit; break;
      case 'status': av = a.status; bv = b.status; break;
      case 'date': default: av = a.created_at; bv = b.created_at;
    }
    const cmp = typeof av === 'number' ? av - bv : String(av || '').localeCompare(String(bv || ''));
    return sortDir === 'asc' ? cmp : -cmp;
  }), [filtered, sortField, sortDir]);

  // Group tasks: reinstallation tasks by issuance week (Saturday to Friday), other tasks by contract
  const grouped = useMemo(() => {
    const groups: { 
      key: string; 
      label: string; 
      contractId: number; 
      contractIds: number[];
      customerName: string; 
      adTypes: string[];
      adType: string; 
      teamNames: string[];
      printerNames: string[];
      reinstallationNumber: number | null; 
      tasks: typeof sorted;
    }[] = [];
    
    const groupMap = new Map<string, typeof sorted>();
    
    sorted.forEach(task => {
      let groupKey: string;
      if (task.task_type === 'reinstallation') {
        groupKey = getOperationalWeekKey(task.created_at);
      } else {
        const reinstallNum = task.reinstallationNumber;
        groupKey = `${task.contract_id}-${task.task_type}-${reinstallNum ?? 'new'}`;
      }

      if (!groupMap.has(groupKey)) groupMap.set(groupKey, []);
      groupMap.get(groupKey)!.push(task);
    });

    groupMap.forEach((tasks, key) => {
      const first = tasks[0];
      const isReinstallWeek = key.startsWith('reinstall-week-');
      
      // Deduplicate contracts
      const allGroupContractIds = [...new Set(
        tasks.flatMap((t: any) => t.contractIds || [t.contract_id]).map(normalizeContractId).filter((id): id is number => id !== null)
      )];

      let label: string;
      let customerName: string;

      if (isReinstallWeek) {
        const weekInfo = getOperationalWeekRange(first.created_at);
        label = weekInfo.label;
        customerName = `${tasks.length} ${tasks.length === 1 ? 'مهمة إعادة تركيب' : 'مهام إعادة تركيب'}`;
      } else {
        const reinstallNum = first.reinstallationNumber;
        label = reinstallNum != null
          ? `إعادة تركيب re${reinstallNum}-${first.contract_id}`
          : allGroupContractIds.length > 1
            ? `عقود #${allGroupContractIds.join(', #')}`
            : `عقد #${first.contract_id}`;
        customerName = first.customer_name || 'غير محدد';
      }

      // Deduplicate teams & printers
      const uniqueTeams = [...new Set(tasks.map((t: any) => t.teamName).filter(Boolean))] as string[];
      const uniquePrinters = [...new Set(tasks.map((t: any) => t.printerName).filter(Boolean))] as string[];

      // Deduplicate ad types
      const uniqueAdTypes = [...new Set(
        tasks.flatMap((t: any) => t.adTypes || (t.adType ? [t.adType] : [])).filter((a: string) => a && a !== 'غير محدد')
      )] as string[];

      groups.push({
        key,
        label,
        contractId: first.contract_id,
        contractIds: allGroupContractIds.length > 0 ? allGroupContractIds : [first.contract_id],
        customerName,
        adTypes: uniqueAdTypes,
        adType: uniqueAdTypes.join(' / ') || '',
        teamNames: uniqueTeams,
        printerNames: uniquePrinters,
        reinstallationNumber: isReinstallWeek ? null : first.reinstallationNumber,
        tasks,
      });
    });

    return groups;
  }, [sorted]);

  const totalPages = Math.ceil(grouped.length / PAGE_SIZE);
  
  const paginatedGroups = useMemo(() => {
    const sliced = grouped.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    return sliced.map(g => ({
      ...g,
      groupTotal: g.tasks.reduce((s: number, t: any) => s + (t.customer_total || 0), 0),
      groupProfit: g.tasks.reduce((s: number, t: any) => s + (t.net_profit || 0), 0),
      groupCost: g.tasks.reduce((s: number, t: any) => s + (t.company_total || 0), 0),
    }));
  }, [grouped, page]);

  const toggleGroupCollapse = useCallback((key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Save discount handler
  const handleSaveDiscount = useCallback(async (groupTasks: any[]) => {
    try {
      setDiscountSaving(true);
      if (discountTarget === 'all') {
        const totalGroupCost = groupTasks.reduce((s: number, t: any) => s + (t.customer_total || 0), 0);
        for (const task of groupTasks) {
          const ratio = totalGroupCost > 0 ? ((task.customer_total || 0) / totalGroupCost) : (1 / groupTasks.length);
          const taskDiscount = Math.round(discountAmount * ratio * 100) / 100;
          await supabase.from('composite_tasks').update({
            discount_amount: taskDiscount,
            discount_reason: discountReason || null,
            updated_at: new Date().toISOString(),
          }).eq('id', task.id);
        }
      } else {
        await supabase.from('composite_tasks').update({
          discount_amount: discountAmount,
          discount_reason: discountReason || null,
          updated_at: new Date().toISOString(),
        }).eq('id', discountTarget);
      }
      toast.success('تم حفظ الخصم بنجاح');
      queryClient.invalidateQueries({ queryKey: ['composite-tasks'] });
      setDiscountPopoverGroup(null);
      setDiscountAmount(0);
      setDiscountReason('');
      setDiscountTarget('all');
    } catch (err: any) {
      toast.error(err.message || 'فشل حفظ الخصم');
    } finally {
      setDiscountSaving(false);
    }
  }, [discountAmount, discountReason, discountTarget, queryClient]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    setPage(1);
  };

  // Update costs mutation
  const updateCostsMutation = useMutation({
    mutationFn: async (data: UpdateCompositeTaskCostsInput) => {
      const customerInstall = data.customer_installation_cost ?? 0;
      const companyInstall = data.company_installation_cost ?? 0;
      const customerPrint = data.customer_print_cost ?? 0;
      const companyPrint = data.company_print_cost ?? 0;
      const customerCutout = data.customer_cutout_cost ?? 0;
      const companyCutout = data.company_cutout_cost ?? 0;
      const discountAmount = data.discount_amount ?? 0;
      const customerSubtotal = customerInstall + customerPrint + customerCutout;
      const customerTotal = customerSubtotal - discountAmount;
      const companyTotal = companyInstall + companyPrint + companyCutout;
      const netProfit = customerTotal - companyTotal;
      const profitPercentage = customerTotal > 0 ? (netProfit / customerTotal) * 100 : 0;

      const { error } = await supabase.from('composite_tasks').update({
        customer_installation_cost: customerInstall, company_installation_cost: companyInstall,
        customer_print_cost: customerPrint, company_print_cost: companyPrint,
        customer_cutout_cost: customerCutout, company_cutout_cost: companyCutout,
        discount_amount: discountAmount, discount_reason: data.discount_reason || null,
        customer_total: customerTotal, company_total: companyTotal,
        net_profit: netProfit, profit_percentage: profitPercentage,
        notes: data.notes, updated_at: new Date().toISOString(),
        cost_allocation: data.cost_allocation || null,
        print_discount: data.print_discount || 0,
        print_discount_reason: data.print_discount_reason || null,
        cutout_discount: data.cutout_discount || 0,
        cutout_discount_reason: data.cutout_discount_reason || null,
        installation_discount: data.installation_discount || 0,
        installation_discount_reason: data.installation_discount_reason || null,
      }).eq('id', data.id);
      if (error) throw error;

      // Sync related tables
      const { data: taskData } = await supabase.from('composite_tasks')
        .select('print_task_id, cutout_task_id, combined_invoice_id')
        .eq('id', data.id).single();

      if (taskData?.print_task_id) {
        const { data: printTask } = await supabase.from('print_tasks')
          .select('total_area')
          .eq('id', taskData.print_task_id).single();
        const totalArea = printTask?.total_area || 0;
        const newPricePerMeter = totalArea > 0 ? companyPrint / totalArea : 0;
        await supabase.from('print_tasks').update({
          total_cost: companyPrint, customer_total_amount: customerPrint, 
          price_per_meter: Math.round(newPricePerMeter * 100) / 100,
          updated_at: new Date().toISOString()
        }).eq('id', taskData.print_task_id);
      }
      if (taskData?.cutout_task_id) {
        await supabase.from('cutout_tasks').update({
          total_cost: companyCutout, customer_total_amount: customerCutout, updated_at: new Date().toISOString()
        }).eq('id', taskData.cutout_task_id);
      }
      if (taskData?.combined_invoice_id) {
        await supabase.from('printed_invoices').update({
          print_cost: companyPrint + companyCutout,
          total_amount: customerTotal,
          notes: `فاتورة موحدة للمهمة المجمعة\n` +
                 `تركيب: ${customerInstall.toLocaleString()} د.ل\n` +
                 (customerPrint > 0 ? `طباعة: ${customerPrint.toLocaleString()} د.ل\n` : '') +
                 (customerCutout > 0 ? `قص: ${customerCutout.toLocaleString()} د.ل\n` : '') +
                 (discountAmount > 0 ? `خصم: ${discountAmount.toLocaleString()} د.ل\n` : '') +
                 (data.notes ? `\nملاحظات: ${data.notes}` : ''),
          updated_at: new Date().toISOString()
        } as any).eq('id', taskData.combined_invoice_id);

        const { data: compositeTask } = await supabase.from('composite_tasks')
          .select('customer_id, customer_name, contract_id')
          .eq('id', data.id).single();

        if (compositeTask) {
          await supabase.from('customer_payments')
            .update({
              amount: -customerTotal,
              notes: `مهمة مجمعة - عقد #${compositeTask.contract_id}`
            })
            .eq('printed_invoice_id', taskData.combined_invoice_id)
            .eq('entry_type', 'invoice');
        }
      }
    },
    onSuccess: () => {
      toast.success('تم تحديث التكاليف بنجاح');
      queryClient.invalidateQueries({ queryKey: ['composite-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['print-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['cutout-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['printer-accounts'] });
      setEditDialogOpen(false);
      setEditingTask(null);
    },
    onError: (err: any) => toast.error(err.message || 'فشل التحديث'),
  });

  // Delete task mutation
  const deleteMutation = useMutation({
    mutationFn: async (task: any) => {
      if (task.combined_invoice_id) {
        await supabase.from('customer_payments').delete().eq('printed_invoice_id', task.combined_invoice_id);
        await supabase.from('printed_invoices').delete().eq('id', task.combined_invoice_id);
      }
      await supabase.from('composite_tasks').update({
        installation_task_id: null, print_task_id: null, cutout_task_id: null, combined_invoice_id: null
      }).eq('id', task.id);
      const { error } = await supabase.from('composite_tasks').delete().eq('id', task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم حذف المهمة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['composite-tasks'] });
      setDeleteTask(null);
    },
    onError: (err: any) => toast.error(err.message || 'فشل الحذف'),
  });

  const SortPill = ({ field, label }: { field: SortField; label: string }) => (
    <button 
      onClick={() => handleSort(field)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-150 border cursor-pointer ${
        sortField === field
          ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
          : 'text-muted-foreground border-border/40 hover:text-indigo-400 hover:border-indigo-500/20'
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3.5 shrink-0">
          {[
            {
              label: 'إجمالي المهام',
              value: stats.total,
              color: 'text-violet-400',
              icon: LayoutList,
              bg: 'bg-violet-500/10',
              border: 'border-violet-500/20 hover:border-violet-500/40',
              accent: 'bg-violet-500',
              pct: 100,
              pctLabel: 'المهام المسجلة'
            },
            {
              label: 'قيد التنفيذ',
              value: stats.pending,
              color: 'text-amber-400',
              icon: Clock,
              bg: 'bg-amber-500/10',
              border: 'border-amber-500/20 hover:border-amber-500/40',
              accent: 'bg-amber-500',
              pct: stats.total > 0 ? Math.round((stats.pending / stats.total) * 100) : 0,
              pctLabel: 'قيد المتابعة والتنفيذ'
            },
            {
              label: 'مكتملة',
              value: stats.completed,
              color: 'text-emerald-400',
              icon: CheckCircle2,
              bg: 'bg-emerald-500/10',
              border: 'border-emerald-500/20 hover:border-emerald-500/40',
              accent: 'bg-emerald-500',
              pct: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
              pctLabel: 'نسبة الإنجاز الفعلي'
            },
            {
              label: 'الإيرادات',
              value: `${stats.totalRevenue.toLocaleString('ar-LY')} د.ل`,
              color: 'text-primary',
              icon: DollarSign,
              bg: 'bg-primary/10',
              border: 'border-primary/20 hover:border-primary/40',
              accent: 'bg-primary',
              pct: stats.totalRevenue > 0 ? 100 : 0,
              pctLabel: 'إجمالي القيمة التعاقدية'
            },
            {
              label: 'المبالغ المدفوعة',
              value: `${stats.totalPaid.toLocaleString('ar-LY')} د.ل`,
              color: 'text-teal-400',
              icon: Coins,
              bg: 'bg-teal-500/10',
              border: 'border-teal-500/20 hover:border-teal-500/40',
              accent: 'bg-teal-500',
              pct: stats.totalRevenue > 0 ? Math.min(100, Math.round((stats.totalPaid / stats.totalRevenue) * 100)) : 0,
              pctLabel: 'نسبة التحصيل والمدفوع'
            },
            {
              label: 'المبالغ المتبقية',
              value: `${stats.totalRemaining.toLocaleString('ar-LY')} د.ل`,
              color: 'text-rose-400',
              icon: Wallet,
              bg: 'bg-rose-500/10',
              border: 'border-rose-500/20 hover:border-rose-500/40',
              accent: 'bg-rose-500',
              pct: stats.totalRevenue > 0 ? Math.round((stats.totalRemaining / stats.totalRevenue) * 100) : 0,
              pctLabel: 'المتبقي غير المحصل'
            },
            {
              label: 'صافي الربح',
              value: `${stats.totalProfit.toLocaleString('ar-LY')} د.ل`,
              color: stats.totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400',
              icon: stats.totalProfit >= 0 ? TrendingUp : TrendingDown,
              bg: stats.totalProfit >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10',
              border: stats.totalProfit >= 0 ? 'border-emerald-500/20 hover:border-emerald-500/40' : 'border-rose-500/20 hover:border-rose-500/40',
              accent: stats.totalProfit >= 0 ? 'bg-emerald-500' : 'bg-rose-500',
              pct: stats.totalRevenue > 0 ? Math.max(0, Math.min(100, Math.round((stats.totalProfit / stats.totalRevenue) * 100))) : 0,
              pctLabel: 'هامش الربح الإجمالي'
            },
          ].map(({ label, value, color, icon: Icon, bg, border, accent, pct, pctLabel }) => (
            <div
              key={label}
              className={`bg-card/40 backdrop-blur-xl border ${border} rounded-[22px] p-4 flex flex-col justify-between min-h-[140px] shadow-sm hover:shadow-md transition-all duration-200 select-none relative overflow-hidden group`}
            >
              <div className={`absolute top-0 right-0 left-0 h-[3px] ${accent} opacity-70 group-hover:opacity-100 transition-opacity duration-300`} />
              <div className="flex items-start justify-between relative z-10">
                <div className="text-right space-y-1">
                  <p className="text-[11px] font-bold text-muted-foreground/75 leading-none">{label}</p>
                  <p className={`text-lg sm:text-xl font-black tracking-tight ${color}`}>{value}</p>
                </div>
                <div className={`p-2 rounded-xl ${bg} ${color} border border-white/5 shadow-inner shrink-0`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 space-y-1 relative z-10">
                <div className="flex items-center justify-between text-[9px] font-bold text-muted-foreground/50">
                  <span>{pctLabel}</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-1.5 w-full bg-muted/20 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${accent} rounded-full transition-all duration-300`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar Control Center */}
        <div className="bg-card/45 backdrop-blur-md border border-border/30 rounded-[22px] p-3.5 flex flex-wrap gap-3 items-center shrink-0 shadow-sm">
          <div className="relative flex-1 min-w-[140px] sm:min-w-[220px]">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <Input 
              placeholder="بحث بالاسم، رقم العقد، نوع الإعلان..." 
              value={search} 
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pr-10 bg-background/50 border-border/30 h-10 text-xs text-foreground placeholder:text-muted-foreground/65 focus-visible:ring-indigo-500/50 rounded-xl" 
            />
          </div>
          
          <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(1); }}>
            <SelectTrigger className="w-[145px] h-10 bg-background/50 border-border/30 text-xs font-bold rounded-xl">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent className="font-tajawal">
              <SelectItem value="all">جميع الحالات</SelectItem>
              <SelectItem value="pending">معلقة</SelectItem>
              <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
              <SelectItem value="completed">مكتملة</SelectItem>
              <SelectItem value="cancelled">ملغاة</SelectItem>
            </SelectContent>
          </Select>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()} 
            className="h-10 gap-2 border-border/30 bg-background/50 hover:bg-muted/40 text-xs font-bold rounded-xl cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5 text-indigo-500" />
            تحديث البيانات
          </Button>

          <div className="hidden lg:flex items-center gap-1.5 bg-muted/20 border border-border/20 rounded-xl p-1 shrink-0">
            <span className="text-[10px] font-bold text-muted-foreground/65 px-2 select-none">ترتيب:</span>
            <SortPill field="date" label="التاريخ" />
            <SortPill field="client" label="العميل" />
            <SortPill field="revenue" label="الإيراد" />
            <SortPill field="profit" label="الربح" />
          </div>

          <div className="flex items-center gap-2 mr-auto">
            <PaginationBar />
          </div>
        </div>

        {/* Card list - grouped by contract */}
        <div className="flex flex-col gap-3.5 flex-1 overflow-y-auto pb-4 min-h-0">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 - i * 0.15 }} transition={{ delay: i * 0.05 }}>
                <SkeletonCard />
              </motion.div>
            ))
          ) : paginatedGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-28 gap-3 text-muted-foreground bg-card/20 rounded-3xl border border-border/20">
              <Package className="h-14 w-14 opacity-20" />
              <span className="text-sm font-bold opacity-70">لا توجد مهام مجمعة مطابقة لمعايير البحث</span>
            </div>
          ) : (
            paginatedGroups.map((group) => {
              const isCollapsed = collapsedGroups.has(group.key);
              const isSingleTask = group.tasks.length === 1;

              return (
                <div key={group.key} className="rounded-2xl border border-border/30 overflow-hidden bg-card/40 backdrop-blur-xl shadow-sm hover:border-border/50 transition-all duration-200">
                  {/* Executive Group Header */}
                  <div
                    className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-muted/15 border-b border-border/20 ${!isSingleTask ? 'cursor-pointer hover:bg-muted/25' : ''} transition-colors select-none`}
                    onClick={() => !isSingleTask && toggleGroupCollapse(group.key)}
                  >
                    {/* Right: Client & Scope Info */}
                    <div className="flex items-center gap-2 flex-wrap text-right min-w-0">
                      <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm shrink-0">
                        <FolderOpen className="h-4 w-4" />
                      </div>
                      <span className="text-base font-black text-foreground tracking-tight">{group.customerName}</span>
                      
                      <span className="text-xs font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded-md font-black">
                        {group.label}
                      </span>
                      
                      {group.reinstallationNumber != null && (
                        <span className="text-[10px] font-mono bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-md font-black">
                          re${group.reinstallationNumber}-${group.contractId}
                        </span>
                      )}

                      {/* Prominent Group Ad Type Badge */}
                      {group.adType && group.adType !== 'غير محدد' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-black bg-amber-500/10 text-amber-300 border border-amber-500/30 shadow-sm">
                          <Megaphone className="h-3 w-3 text-amber-400 shrink-0" />
                          <span>نوع الإعلان: {group.adType}</span>
                        </span>
                      )}

                      {/* Deduplicated Teams */}
                      {group.teamNames && group.teamNames.length > 0 && group.teamNames.map((tName, tIdx) => (
                        <span key={tIdx} className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">
                          <Wrench className="h-3 w-3" /> {tName}
                        </span>
                      ))}

                      {/* Deduplicated Printers */}
                      {group.printerNames && group.printerNames.length > 0 && group.printerNames.map((pName, pIdx) => (
                        <span key={pIdx} className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md">
                          <Printer className="h-3 w-3" /> {pName}
                        </span>
                      ))}

                      {!isSingleTask && (
                        <span className="text-[10px] font-black bg-muted/60 text-muted-foreground border border-border/40 rounded-md px-2 py-0.5">
                          {group.tasks.length} مهام
                        </span>
                      )}
                    </div>

                    {/* Middle & Left: Executive Financials & Actions */}
                    <div className="flex items-center gap-2.5 shrink-0 flex-wrap" onClick={e => e.stopPropagation()}>
                      {/* Financial Executive Summary */}
                      <div className="hidden sm:flex items-center gap-2 text-xs">
                        <div className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black">
                          الإيراد: {group.groupTotal.toLocaleString('ar-LY')} د.ل
                        </div>
                        <div className="px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 font-bold">
                          التكلفة: {group.groupCost.toLocaleString('ar-LY')} د.ل
                        </div>
                        <div className={`px-2.5 py-1 rounded-lg border font-black ${group.groupProfit >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                          الربح: {group.groupProfit.toLocaleString('ar-LY')} د.ل
                        </div>
                      </div>

                      {/* Actions Toolbar */}
                      <div className="flex items-center gap-1.5">
                        {/* ZIP Download */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              disabled={zipDownloadingGroup === group.key}
                              onClick={(e) => { e.stopPropagation(); handleDownloadGroupZip({ key: group.key, contractId: group.contractId, customerName: group.customerName }); }}
                              className="h-8.5 w-8.5 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all cursor-pointer disabled:opacity-50"
                              aria-label="تحميل ZIP"
                            >
                              {zipDownloadingGroup === group.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">تحميل صور وCSV العقد كملف ZIP</TooltipContent>
                        </Tooltip>

                        {/* Create Print Tasks for all group */}
                        {(() => {
                          const tasksToCreate = group.tasks.filter((t: any) => !t.print_task_id && t.installation_task_id);
                          if (tasksToCreate.length === 0) return null;
                          return (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => handleCreatePrintTasksForGroup(group.tasks)}
                                  className="h-8.5 rounded-xl flex items-center gap-1.5 px-2.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all text-xs font-bold cursor-pointer"
                                >
                                  <Printer className="h-3.5 w-3.5 animate-pulse" />
                                  <span>إنشاء مهام طباعة ({tasksToCreate.length})</span>
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">إنشاء مهمة طباعة للمهام المتبقية</TooltipContent>
                            </Tooltip>
                          );
                        })()}

                        {/* Discount Management Popover */}
                        <Popover open={discountPopoverGroup === group.key} onOpenChange={(open) => {
                          if (open) {
                            setDiscountPopoverGroup(group.key);
                            const totalDiscount = group.tasks.reduce((s, t) => s + (t.discount_amount || 0), 0);
                            setDiscountAmount(totalDiscount);
                            setDiscountReason(group.tasks[0]?.discount_reason || '');
                            setDiscountTarget('all');
                          } else {
                            setDiscountPopoverGroup(null);
                          }
                        }}>
                          <PopoverTrigger asChild>
                            <button 
                              className="h-8.5 w-8.5 rounded-xl flex items-center justify-center bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all cursor-pointer"
                              aria-label="إدارة الخصم"
                            >
                              <Percent className="h-4 w-4" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[380px] p-5 rounded-2xl border-border/40 shadow-xl" side="bottom" align="end">
                            <div className="space-y-4 text-right" dir="rtl">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-black text-foreground">إدارة الخصم للتجميعة</h4>
                                <span className="text-[10px] font-bold text-muted-foreground bg-muted/40 px-2 py-0.5 rounded">
                                  {group.tasks.length} مهمة
                                </span>
                              </div>
                              <div className="border border-border/40 rounded-xl overflow-hidden text-xs bg-card/40">
                                <table className="w-full">
                                  <thead className="bg-muted/40">
                                    <tr>
                                      <th className="text-right px-3 py-2 font-bold text-muted-foreground">المهمة</th>
                                      <th className="text-right px-3 py-2 font-bold text-muted-foreground">الإجمالي</th>
                                      <th className="text-right px-3 py-2 font-bold text-muted-foreground">الخصم</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border/30 font-medium">
                                    {group.tasks.map((t, i) => (
                                      <tr key={t.id} className="hover:bg-muted/20">
                                        <td className="px-3 py-1.5 font-mono">{t.teamName || `مهمة ${i + 1}`}</td>
                                        <td className="px-3 py-1.5 font-mono">{(t.customer_total || 0).toLocaleString('ar-LY')}</td>
                                        <td className="px-3 py-1.5 font-mono text-amber-400">{(t.discount_amount || 0).toLocaleString('ar-LY')}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-foreground/80">تطبيق على</Label>
                                <Select value={discountTarget} onValueChange={(v) => setDiscountTarget(v as any)}>
                                  <SelectTrigger className="h-9 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="font-tajawal">
                                    <SelectItem value="all">تقسيم نسبي على الجميع</SelectItem>
                                    {group.tasks.map((t, i) => (
                                      <SelectItem key={t.id} value={t.id}>{t.teamName || `مهمة ${i + 1}`}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="grid grid-cols-2 gap-2.5">
                                <div className="space-y-1.5">
                                  <Label className="text-xs font-bold text-foreground/80">مبلغ الخصم</Label>
                                  <Input type="number" value={discountAmount} onChange={e => setDiscountAmount(Number(e.target.value))} className="h-9 text-sm" />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs font-bold text-foreground/80">السبب</Label>
                                  <Input value={discountReason} onChange={e => setDiscountReason(e.target.value)} className="h-9 text-sm" placeholder="اختياري" />
                                </div>
                              </div>
                              <Button size="sm" className="w-full h-10 text-xs font-black mt-1 cursor-pointer" onClick={() => handleSaveDiscount(group.tasks)} disabled={discountSaving}>
                                {discountSaving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                                حفظ الخصم
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>

                        {/* Unified Invoice Button */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => {
                                const fullGroup = grouped.find(g => g.key === group.key);
                                setGroupInvoiceTasks(fullGroup?.tasks || group.tasks);
                                setGroupInvoiceOpen(true);
                              }}
                              className="h-8.5 w-8.5 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all cursor-pointer"
                              aria-label="فاتورة موحدة"
                            >
                              <FileOutput className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">فاتورة موحدة للزبون</TooltipContent>
                        </Tooltip>

                        {!isSingleTask && (
                          <button 
                            onClick={() => toggleGroupCollapse(group.key)} 
                            className="h-8.5 w-8.5 rounded-xl flex items-center justify-center hover:bg-muted/40 transition-colors text-muted-foreground cursor-pointer"
                            aria-label="طي أو توسيع المجموعة"
                          >
                            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Group Tasks Cards Container */}
                  <AnimatePresence initial={false}>
                    {(!isCollapsed || isSingleTask) && (
                      <motion.div
                        initial={isSingleTask ? false : { height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        <div className={`flex flex-col p-3 gap-3 ${isSingleTask ? '' : 'bg-muted/5'}`}>
                          {group.tasks.map((task, idx) => (
                            <TaskCardRow
                              key={task.id}
                              task={task}
                              idx={idx}
                              onEditCosts={(t) => { setEditingTask(t); setEditDialogOpen(true); }}
                              onDelete={(t) => setDeleteTask(t)}
                              onOpenInvoice={(t, type) => { setInvoiceTask(t); setInvoiceType(type); setInvoiceOpen(true); }}
                              onNavigateToPayment={(distId, custId, custName) => {
                                navigate(`/admin/customer-billing?id=${custId}&name=${encodeURIComponent(custName)}&highlight_payment=${distId}`);
                              }}
                              onCreatePrintTask={handleOpenCreatePrintTask}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Pagination */}
        <div className="flex justify-center mt-2 shrink-0">
          <PaginationBar />
        </div>
      </div>

      {/* Edit Costs Dialog */}
      <EnhancedEditCompositeTaskCostsDialog
        task={editingTask}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={(data) => updateCostsMutation.mutate(data)}
        isSaving={updateCostsMutation.isPending}
      />

      {/* Invoice Dialog */}
      {invoiceTask && (
        <UnifiedTaskInvoice
          open={invoiceOpen}
          onOpenChange={setInvoiceOpen}
          task={invoiceTask}
          invoiceType={invoiceType}
        />
      )}

      {/* Group Invoice Dialog */}
      {groupInvoiceTasks && groupInvoiceTasks.length > 0 && (
        <UnifiedTaskInvoice
          open={groupInvoiceOpen}
          onOpenChange={(open) => { setGroupInvoiceOpen(open); if (!open) setGroupInvoiceTasks(null); }}
          task={groupInvoiceTasks[0]}
          tasks={groupInvoiceTasks}
          invoiceType="customer"
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteTask !== null} onOpenChange={() => setDeleteTask(null)}>
        <AlertDialogContent className="font-tajawal text-right" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              تأكيد حذف المهمة المجمعة
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              سيتم حذف هذه المهمة المجمعة وجميع الفواتير المرتبطة بها نهائياً. هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 justify-end">
            <AlertDialogCancel className="cursor-pointer">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
              onClick={() => deleteTask && deleteMutation.mutate(deleteTask)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
              تأكيد الحذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Print Task Dialog */}
      {selectedInstallTaskId && (
        <CreatePrintTaskFromInstallation
          open={createPrintDialogOpen}
          onOpenChange={(open) => {
            setCreatePrintDialogOpen(open);
            if (!open) {
              if (printQueue.length > 0) {
                setTimeout(() => processNextInPrintQueue(printQueue), 500);
              } else {
                setSelectedInstallTaskId(null);
                setSelectedTaskItems([]);
              }
            }
          }}
          installationTaskId={selectedInstallTaskId}
          taskItems={selectedTaskItems}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['composite-tasks'] });
            queryClient.invalidateQueries({ queryKey: ['composite-task-extras'] });
            queryClient.invalidateQueries({ queryKey: ['composite-task-payments'] });
            if (printQueue.length > 0) {
              setTimeout(() => processNextInPrintQueue(printQueue), 500);
            }
          }}
        />
      )}
    </TooltipProvider>
  );
};

export default CompositeTasksListEnhanced;
