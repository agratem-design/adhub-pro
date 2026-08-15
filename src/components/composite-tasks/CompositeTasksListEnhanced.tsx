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
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchContractDesignUrls } from '@/lib/contractDesignUtils';
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  CheckCircle2, Clock, Package, Users,
  RefreshCw, XCircle, Printer, Scissors,
  Trash2, Edit, ChevronDown, Image as ImageIcon,
  LayoutList, Layers, FileText, X, Wallet, Coins,
  ChevronLeft, ChevronRight, CalendarDays,
  DollarSign, TrendingUp, TrendingDown, Wrench,
  FileOutput, Loader2, AlertTriangle, ChevronUp, Percent,
  FolderOpen, Download
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
        className="relative flex-shrink-0 overflow-hidden h-full cursor-pointer"
        style={{ width: '100%', minHeight: '100%' }}
        onClick={() => url && setLightboxOpen(true)}
      >
        {url ? (
          <>
            <div className="absolute inset-0">
              <img src={url} alt="" className="w-full h-full object-cover scale-150 blur-xl opacity-50" aria-hidden="true" />
              <div className="absolute inset-0 bg-black/40" />
            </div>
            <img src={url} alt="تصميم" className="relative w-full h-full object-contain z-10 p-2" style={{ minHeight: '100%' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            {urls.length > 1 && (
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-30 flex gap-1">
                {urls.map((_, i) => (
                  <button key={i} onClick={(e) => { e.stopPropagation(); setCurrentIdx(i); }}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentIdx % urls.length ? 'bg-white scale-125' : 'bg-white/40'}`} />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ minHeight: '100%', background: `linear-gradient(135deg, hsl(var(--muted)/0.6), ${accent}18)` }}>
            <div className="flex flex-col items-center gap-2 opacity-40">
              <ImageIcon className="h-10 w-10" style={{ color: accent }} />
              <span className="text-[10px] text-muted-foreground">لا يوجد تصميم</span>
            </div>
          </div>
        )}
        <div className="absolute top-0 left-0 bottom-0 w-[4px]" style={{ background: accent, opacity: 0.85 }} />
      </div>
      {lightboxOpen && url && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-md flex items-center justify-center" onClick={() => setLightboxOpen(false)}>
          <button onClick={() => setLightboxOpen(false)} className="absolute top-4 right-4 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all border border-white/20">
            <X className="w-6 h-6 text-white" />
          </button>
          <img src={url} alt="معاينة" className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>, document.body
      )}
    </>
  );
};

/* ── Compact action button ── */
const ActionBtn = ({ icon: Icon, label, onClick, danger = false, className: cls = '' }: {
  icon: any; label: string; onClick: (e: React.MouseEvent) => void; danger?: boolean; className?: string;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button onClick={e => { e.stopPropagation(); onClick(e); }}
        className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-150 border
          ${danger
            ? 'text-red-400/70 border-red-500/15 hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/30'
            : 'text-muted-foreground border-border/40 hover:bg-indigo-500/12 hover:text-indigo-400 hover:border-indigo-500/30'
          } ${cls}`}>
        <Icon className="h-4 w-4" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" className="text-xs">{label}</TooltipContent>
  </Tooltip>
);

/* ── Profit indicator ── */
const ProfitIndicator = ({ profit, percentage }: { profit: number; percentage: number }) => {
  const isProfit = profit >= 0;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-baseline gap-1">
        {isProfit ? <TrendingUp className="h-3 w-3 text-emerald-400" /> : <TrendingDown className="h-3 w-3 text-red-400" />}
        <span className={`text-sm font-bold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
          {profit.toLocaleString('ar-LY')}
        </span>
      </div>
      <span className={`text-[10px] font-medium ${isProfit ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
        {percentage.toFixed(0)}%
      </span>
    </div>
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
  <div className="flex rounded-2xl overflow-hidden border border-border/50 bg-card" style={{ minHeight: 140 }}>
    <Skeleton className="w-40 shrink-0 rounded-none rounded-r-2xl" />
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
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [localDesignUrls, setLocalDesignUrls] = useState<string[]>(task.designUrls || []);

  useEffect(() => {
    if (task.designUrls && task.designUrls.length > 0) {
      setLocalDesignUrls(task.designUrls);
    } else if (task.contract_id) {
      const contractNo = Number(task.contract_id);
      if (Number.isFinite(contractNo)) {
        fetchContractDesignUrls(contractNo).then(urls => {
          if (urls && urls.length > 0) {
            setLocalDesignUrls(urls);
          }
        });
      }
    }
  }, [task.designUrls, task.contract_id]);

  const cfg = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  const hasCutouts = task.customer_cutout_cost > 0 || task.company_cutout_cost > 0;

  // ✅ تعديل تكلفة الشركة والربح للمهام الجديدة (التركيب مشمول بالعقد)
  const isNewInstallation = task.task_type === 'new_installation';
  const rawCompanyTotal = task.company_total || 0;
  const companyInstall = task.company_installation_cost || 0;
  const adjCompanyTotal = isNewInstallation ? rawCompanyTotal - companyInstall : rawCompanyTotal;
  const customerTotalVal = task.customer_total || 0;
  const adjNetProfit = customerTotalVal - adjCompanyTotal;
  const adjProfitPct = customerTotalVal > 0 ? (adjNetProfit / customerTotalVal) * 100 : 0;
  const discountAmt = task.discount_amount || 0;
  const showInstallExcluded = isNewInstallation && companyInstall > 0;

  const remainingDue = Math.max(0, (task.customer_total || 0) - (task._totalPaid || 0));
  const isFullyPaid = remainingDue <= 0.01 && (task.customer_total || 0) > 0;
  const containerBg = (task.customer_total || 0) > 0 
    ? (isFullyPaid ? 'bg-emerald-500/5' : 'bg-rose-500/5') 
    : 'bg-muted/10';

  const cardBg = dominantColor
    ? `linear-gradient(to left, rgba(${dominantColor}, 0.22) 0%, rgba(${dominantColor}, 0.10) 35%, rgba(${dominantColor}, 0.03) 70%, hsl(var(--card)) 100%)`
    : `linear-gradient(to left, color-mix(in srgb, ${task.accent || '#6366f1'} 12%, transparent) 0%, color-mix(in srgb, ${task.accent || '#6366f1'} 4%, transparent) 35%, hsl(var(--card)) 100%)`;
  const cardBorder = dominantColor
    ? `1.5px solid rgba(${dominantColor}, 0.4)`
    : `1.5px solid color-mix(in srgb, ${task.accent || '#6366f1'} 20%, hsl(var(--border)/0.5))`;
  const cardShadow = dominantColor
    ? `0 4px 24px rgba(${dominantColor}, 0.25), 0 0 0 1px rgba(${dominantColor}, 0.1)`
    : '0 2px 16px rgba(0,0,0,0.18)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.025, ease: 'easeOut' }}
      whileHover={{ y: -3, transition: { duration: 0.18 } }}
      className="group relative rounded-2xl overflow-hidden cursor-pointer"
      style={{ background: cardBg, border: cardBorder, boxShadow: cardShadow, minHeight: 140 }}
    >
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
        style={{ boxShadow: dominantColor
          ? `0 12px 40px rgba(${dominantColor}, 0.35), 0 0 0 2px rgba(${dominantColor}, 0.3)`
          : `0 8px 32px rgba(0,0,0,0.30), 0 0 0 1px ${task.accent}33`
        }} />

      {/* Desktop layout */}
      <div className="hidden md:flex h-full items-stretch">
        {/* Design panel */}
        <div className="w-[160px] lg:w-[180px] shrink-0 overflow-hidden relative" onClick={e => e.stopPropagation()}>
          <DesignPanel urls={localDesignUrls} accent={task.accent} onColorExtracted={setDominantColor} />
          {localDesignUrls && localDesignUrls.length > 1 && (
            <div className="absolute bottom-2.5 right-2.5 z-30 bg-black/60 backdrop-blur-sm text-white px-2 py-0.5 rounded-lg text-[9px] font-bold border border-white/10">
              {localDesignUrls.length} تصاميم
            </div>
          )}
        </div>

        <div className="flex flex-1 min-w-0 p-0 items-stretch">
          {/* Info block */}
          <div className="flex-1 min-w-0 px-4 lg:px-6 py-4 lg:py-5 flex flex-col justify-between gap-4">
            <div className="space-y-1.5 text-right">
              <div className="flex items-center gap-2 flex-wrap font-bold ">
                {task.task_number && (
                  <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full px-2 py-0.5 font-extrabold">
                    م#{task.task_number}
                  </span>
                )}
                <span className="text-base lg:text-lg font-black text-foreground leading-tight">{task.customer_name || 'غير محدد'}</span>
                <span className={`text-[10px] rounded-full px-2 py-0.5 font-extrabold border ${
                  task.task_type === 'new_installation'
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                }`}>
                  {task.task_type === 'new_installation' ? 'تركيب جديد' : `إعادة تركيب ${task.reinstallationNumber ? `(re${task.reinstallationNumber})` : ''}`}
                </span>
                {task.reinstallationNumber != null && (
                  <span className="text-[10px] font-mono bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-full px-2 py-0.5 font-extrabold">
                    re{task.reinstallationNumber}-{task.contract_id}
                  </span>
                )}
              </div>

              {task.adType && task.adType !== 'غير محدد' && (
                <p className="text-xs text-muted-foreground/85 font-medium">{task.adType}</p>
              )}

              {/* عناصر المهمة */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {task.installation_task_id && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Wrench className="h-3 w-3" /> تركيب{task.teamName ? ` - ${task.teamName}` : ''}
                  </span>
                )}
                {task.print_task_id && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <Printer className="h-3 w-3" /> طباعة{task.printerName ? ` - ${task.printerName}` : ''}
                  </span>
                )}
                {hasCutouts && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Scissors className="h-3 w-3" /> مجسمات
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-extrabold px-2.5 py-1 rounded-xl font-mono">
                العقد: {task.contractIds && task.contractIds.length > 1 ? (
                  <span className="flex items-center gap-1 flex-wrap text-indigo-400">
                    {task.contractIds.slice(0, 3).map((cId) => `#${cId}`).join(', ')}
                    {task.contractIds.length > 3 && ` +${task.contractIds.length - 3}`}
                  </span>
                ) : (
                  <span className="text-indigo-400">#{task.contract_id}</span>
                )}
              </span>
              <span className="flex items-center gap-1.5 bg-muted/40 border border-border/25 px-2.5 py-1 rounded-xl text-muted-foreground font-semibold">
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                <span>{format(new Date(task.created_at), 'dd MMM yyyy', { locale: ar })}</span>
              </span>
            </div>
          </div>

          {/* Customer Due */}
          <div className={`w-[175px] lg:w-[210px] shrink-0 px-5 py-4 flex flex-col justify-between gap-3 border-r border-border/20 ${containerBg}`} onClick={e => e.stopPropagation()}>
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-muted-foreground/60 leading-none text-right">الحالة المالية للزبون</div>
              
              <div className="space-y-1.5 text-right">
                <div className="flex items-center justify-between text-[10px] font-extrabold text-muted-foreground/77">
                  <span>إجمالي العقد:</span>
                  <span className="text-white text-[11px] font-black">{(task.customer_total || 0).toLocaleString('ar-LY')} د.ل</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-extrabold text-muted-foreground/77">
                  <span>المدفوع:</span>
                  <span className="text-emerald-400 text-[11px] font-black">{task._totalPaid.toLocaleString('ar-LY')} د.ل</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-extrabold border-t border-border/15 pt-1.5">
                  <span className="text-muted-foreground/80">المتبقي:</span>
                  {isFullyPaid ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black">
                      تم السداد
                    </span>
                  ) : (
                    <span className="text-rose-500 text-xs font-black">{remainingDue.toLocaleString('ar-LY')} د.ل</span>
                  )}
                </div>
              </div>
            </div>

            {/* نسبة السداد */}
            {(task.customer_total || 0) > 0 && (
              <div className="w-full space-y-1 text-right" dir="rtl">
                <div className="flex items-center justify-between text-[9px] font-extrabold">
                  <span className="text-muted-foreground/50">نسبة السداد</span>
                  <span className={task._paymentPercentage >= 100 ? 'text-emerald-400' : task._paymentPercentage >= 50 ? 'text-amber-400' : 'text-rose-400'}>
                    {task._paymentPercentage}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${task._paymentPercentage >= 100 ? 'bg-emerald-500' : task._paymentPercentage >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                    style={{ width: `${Math.min(100, task._paymentPercentage)}%` }}
                  />
                </div>

                {/* أرقام الدفعات */}
                {task._payments && task._payments.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 justify-end">
                    {task._payments.map((p, pIdx) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          if (p.distributed_payment_id) {
                            onNavigateToPayment(p.distributed_payment_id, task.customer_id || '', task.customer_name || '');
                          }
                        }}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[8px] font-extrabold transition-all cursor-pointer hover:scale-105 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                        title={`دفعة #${p.rowNumber || (pIdx + 1)} - ${p.amount.toLocaleString('ar-LY')} د.ل`}
                      >
                        #{p.rowNumber || (pIdx + 1)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Financial stats */}
          <div className="w-[160px] lg:w-[190px] shrink-0 px-5 lg:px-6 py-5 lg:py-6 flex flex-col justify-between gap-3 border-r border-border/20" onClick={e => e.stopPropagation()}>
            <div className="space-y-2.5 text-right">
              <div>
                <div className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wide mb-1">
                  التكلفة {showInstallExcluded && <span className="text-muted-foreground/50">(بدون تركيب)</span>}
                </div>
                <div className="text-base font-black text-orange-400">{adjCompanyTotal.toLocaleString('ar-LY')} <span className="text-[10px] font-medium text-orange-400/60">د.ل</span></div>
              </div>
              {discountAmt > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-red-400/80 uppercase tracking-wide mb-1">الخصم</div>
                  <div className="text-sm font-black text-red-400">−{discountAmt.toLocaleString('ar-LY')} <span className="text-[10px] font-medium text-red-400/60">د.ل</span></div>
                </div>
              )}
            </div>
            <div className="h-px bg-border/20 my-1" />
            <ProfitIndicator profit={adjNetProfit} percentage={adjProfitPct} />
          </div>

          {/* Status block */}
          <div className="w-[110px] lg:w-[125px] shrink-0 px-4 lg:px-5 py-5 lg:py-6 flex flex-col justify-center items-center gap-2 border-r border-border/20">
            <span className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-full border font-extrabold whitespace-nowrap shadow-sm ${cfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} shrink-0 animate-pulse`} />
              {cfg.label}
            </span>
            {task.invoice_generated && (
              <span className="text-[10px] font-bold text-indigo-400/80 bg-indigo-500/5 border border-indigo-500/15 px-2 py-0.5 rounded-lg flex items-center gap-1 select-none">
                <FileText className="h-3 w-3 text-indigo-500/70" /> فاتورة
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="w-[72px] lg:w-[82px] shrink-0 flex flex-col items-center justify-center gap-2 px-3 lg:px-4 py-5 border-r border-border/20" onClick={e => e.stopPropagation()}>
            {deleteConfirm ? (
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[9px] text-red-400 font-extrabold text-center leading-tight">تأكيد؟</span>
                <button onClick={() => { onDelete(task); setDeleteConfirm(false); }} className="w-full h-7 rounded-lg bg-red-500/20 text-red-400 text-[10px] font-extrabold hover:bg-red-500/35 transition-colors px-1">نعم</button>
                <button onClick={() => setDeleteConfirm(false)} className="w-full h-7 rounded-lg bg-muted/65 text-muted-foreground text-[10px] hover:bg-muted transition-colors px-1">لا</button>
              </div>
            ) : (
              <>
                <ActionBtn icon={FileText} label="فاتورة الزبون" onClick={() => onOpenInvoice(task, 'customer')} />
                {task.print_task_id ? (
                  <ActionBtn icon={Printer} label="فاتورة المطبعة" onClick={() => onOpenInvoice(task, 'print_vendor')} />
                ) : (
                  task.installation_task_id && (
                    <ActionBtn 
                      icon={Printer} 
                      label="إنشاء مهمة طباعة" 
                    onClick={() => onCreatePrintTask?.(task.installation_task_id)} 
                      color="text-cyan-400 hover:text-cyan-300"
                    />
                  )
                )}
                {task.installation_task_id && <ActionBtn icon={Users} label="فاتورة الفرقة" onClick={() => onOpenInvoice(task, 'installation_team')} />}
                <div className="w-6 h-px bg-border/40 my-0.5" />
                <ActionBtn icon={Edit} label="تعديل التكاليف" onClick={() => onEditCosts(task)} />
                <ActionBtn icon={Trash2} label="حذف" onClick={() => setDeleteConfirm(true)} danger />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex flex-col md:hidden px-4 py-5 gap-4 bg-card/60 backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 text-right">
            <div className="flex items-center gap-1.5 flex-wrap">
              {task.task_number && (
                <span className="text-[9px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded px-1 py-0.5 font-bold">
                  م#{task.task_number}
                </span>
              )}
              <span className="text-base font-extrabold text-foreground truncate">{task.customer_name || 'غير مححدد'}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className={`text-[9px] rounded-full px-2 py-0.5 font-extrabold border ${
                task.task_type === 'new_installation'
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
              }`}>
                {task.task_type === 'new_installation' ? 'جديد' : 'إعادة'}
              </span>
              {task.reinstallationNumber != null && (
                <span className="text-[9px] font-mono bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded px-1.5 py-0.5 font-bold">
                  re{task.reinstallationNumber}-{task.contract_id}
                </span>
              )}
            </div>
          </div>
          <span className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full border font-extrabold whitespace-nowrap shrink-0 ${cfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground text-right">
          <span className="flex items-center gap-1 bg-indigo-500/5 text-indigo-400 border border-indigo-500/10 px-2 py-0.5 rounded">
            <FileText className="h-3 w-3 text-indigo-500/70" />
            <span className="font-mono font-bold">#{task.contract_id}</span>
          </span>
          {task.adType && task.adType !== 'غير محدد' && (
            <span className="text-muted-foreground/80 truncate max-w-[120px] font-medium">{task.adType}</span>
          )}
          <span className="flex items-center gap-1 font-semibold">
            <CalendarDays className="h-3 w-3 text-muted-foreground/50" />
            {format(new Date(task.created_at), 'dd/MM/yyyy', { locale: ar })}
          </span>
        </div>

        {/* عناصر المهمة - موبايل */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-border/20">
          {task.installation_task_id && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/15">
              <Wrench className="h-3 w-3" /> تركيب
            </span>
          )}
          {task.print_task_id && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/15">
              <Printer className="h-3 w-3" /> طباعة
            </span>
          )}
          {hasCutouts && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/15">
              <Scissors className="h-3 w-3" /> مجسمات
            </span>
          )}
        </div>

        <div className="bg-background/40 p-3 rounded-xl border border-border/20 grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <div className="text-[10px] font-bold text-muted-foreground/60 mb-1">المالية للزبون</div>
            {(task.customer_total || 0) > 0 ? (
              <div className="text-[9px] text-right space-y-0.5 font-semibold text-muted-foreground/90 mx-auto w-fit" dir="rtl">
                <div>الإجمالي: <span className="font-bold text-white">{(task.customer_total || 0).toLocaleString('ar-LY')} د.ل</span></div>
                <div>المدفوع: <span className="font-bold text-emerald-400">{task._totalPaid.toLocaleString('ar-LY')} د.ل</span></div>
                <div>المتبقي: {isFullyPaid ? (
                  <span className="text-emerald-400 font-extrabold text-[8px] bg-emerald-500/10 px-1 rounded border border-emerald-500/15">مسدد</span>
                ) : (
                  <span className="font-black text-rose-400">{remainingDue.toLocaleString('ar-LY')} د.ل</span>
                )}</div>
              </div>
            ) : (
              <div className="text-[10px] font-bold text-muted-foreground/45">—</div>
            )}
          </div>
          <div>
            <div className="text-[10px] font-bold text-muted-foreground/60 mb-0.5">التكلفة</div>
            <div className="text-xs font-black text-orange-400">{adjCompanyTotal.toLocaleString('ar-LY')}</div>
            {discountAmt > 0 && (
              <div className="text-[9px] font-bold text-red-500 mt-0.5">خصم −{discountAmt.toLocaleString('ar-LY')}</div>
            )}
          </div>
          <div>
            <div className="text-[10px] font-bold text-muted-foreground/60 mb-0.5">الربح</div>
            <ProfitIndicator profit={adjNetProfit} percentage={adjProfitPct} />
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 mt-1 border-t border-border/20 gap-2" onClick={e => e.stopPropagation()}>
          <div className="flex gap-1.5">
            <ActionBtn icon={FileText} label="فاتورة الزبون" onClick={() => onOpenInvoice(task, 'customer')} />
            {task.print_task_id ? (
              <ActionBtn icon={Printer} label="فاتورة المطبعة" onClick={() => onOpenInvoice(task, 'print_vendor')} />
            ) : (
              task.installation_task_id && (
                <ActionBtn 
                  icon={Printer} 
                  label="مهمة طباعة" 
                  onClick={() => onCreatePrintTask?.(task.installation_task_id)} 
                  color="text-cyan-400"
                />
              )
            )}
            {task.installation_task_id && <ActionBtn icon={Users} label="فاتورة الفرقة" onClick={() => onOpenInvoice(task, 'installation_team')} />}
          </div>
          <div className="flex gap-1.5">
            <ActionBtn icon={Edit} label="تعديل" onClick={() => onEditCosts(task)} />
            <ActionBtn icon={Trash2} label="حذف" onClick={() => setDeleteConfirm(true)} danger />
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
    
    // Fetch items
    const { data } = await supabase
      .from('installation_task_items')
      .select('id, billboard_id, design_face_a, design_face_b, has_cutout, selected_design_id, faces_to_install')
      .eq('task_id', nextTaskId);
    
    if (data && data.length > 0) {
      setSelectedInstallTaskId(nextTaskId);
      setSelectedTaskItems(data);
      setCreatePrintDialogOpen(true);
    } else {
      // Skip this one and do next
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

  // Fetch composite tasks
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
        // Fetch contract IDs and reinstallation info in parallel
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
          const contractNo = row.billboard?.Contract_Number;
          if (!taskId || !contractNo) return;
          if (!map.has(taskId)) map.set(taskId, new Set());
          map.get(taskId)!.add(Number(contractNo));
        });

        // Map reinstallation info
        const reinstallInfoMap = new Map<string, { number: number | null; taskType: string }>();
        installTasksData.forEach((it: any) => {
          reinstallInfoMap.set(it.id, { 
            number: it.reinstallation_number, 
            taskType: it.task_type || 'installation' 
          });
        });

        tasks.forEach((t: any) => {
          const set = t.installation_task_id ? map.get(t.installation_task_id) : undefined;
          const derived = set ? Array.from(set) : [];
          t._contractIds = derived.length > 0 ? derived : [t.contract_id].filter(Boolean);
          
          // Set reinstallation info
          const reinstallInfo = t.installation_task_id ? reinstallInfoMap.get(t.installation_task_id) : undefined;
          t._reinstallationNumber = reinstallInfo?.number ?? null;
        });
      }

      tasks.forEach((t: any) => {
        if (!t._contractIds || !Array.isArray(t._contractIds) || t._contractIds.length === 0) {
          t._contractIds = [t.contract_id].filter(Boolean);
        }
      });

      return tasks;
    },
  });

  // Fetch design images and ad types for tasks
  const { data: taskExtras = {} } = useQuery({
    queryKey: ['composite-task-extras', compositeTasks.map(t => t.id).join(',')],
    enabled: compositeTasks.length > 0,
    queryFn: async () => {
      const extras: Record<string, { designUrls: string[]; adType: string; teamName: string; reinstallationNumber: number | null; printerName: string }> = {};

      // Batch fetch designs from installation tasks
      const installIds = compositeTasks.map(t => t.installation_task_id).filter(Boolean) as string[];
      const printIds = compositeTasks.map(t => t.print_task_id).filter(Boolean) as string[];
      const contractIds = [...new Set(compositeTasks.map(t => t.contract_id).filter(Boolean))];

      let installDesigns: any[] = [];
      let printDesigns: any[] = [];
      let billboardDesigns: any[] = [];
      let contracts: any[] = [];
      let installTasks: any[] = [];
      let taskDesignsData: any[] = [];
      let printTasksData: any[] = [];

      const promises: Promise<any>[] = [];

      // 1. PRIMARY: Fetch from task_designs table for all installation tasks under these contracts
      if (contractIds.length > 0 || installIds.length > 0) {
        promises.push(
          Promise.resolve(
            supabase
              .from('installation_tasks')
              .select('id, contract_id')
              .in('contract_id', contractIds.length > 0 ? contractIds : [-1])
          ).then(async ({ data: installTasksForContracts }) => {
            const allInstallTaskIds = [...new Set([
              ...installIds,
              ...(installTasksForContracts || []).map(t => t.id)
            ])];

            const taskToContractMap = new Map<string, number>();
            (installTasksForContracts || []).forEach(t => {
              if (t.id && t.contract_id) taskToContractMap.set(t.id, Number(t.contract_id));
            });

            if (allInstallTaskIds.length > 0) {
              const { data: designs } = await supabase
                .from('task_designs')
                .select('task_id, design_face_a_url, design_face_b_url, design_order')
                .in('task_id', allInstallTaskIds)
                .order('design_order', { ascending: true });

              taskDesignsData = (designs || []).map(d => ({
                ...d,
                contract_id: taskToContractMap.get(d.task_id) || null
              }));
            }
          })
        );
      }

      if (installIds.length > 0) {
        promises.push(
          Promise.resolve(supabase.from('installation_task_items')
            .select('task_id, design_face_a, design_face_b')
            .in('task_id', installIds))
            .then(({ data }) => { installDesigns = data || []; })
        );
        promises.push(
          Promise.resolve(supabase.from('installation_tasks')
            .select('id, task_type, reinstallation_number, contract_id, team:installation_teams!installation_tasks_team_id_fkey(team_name)')
            .in('id', installIds))
            .then(({ data }) => { installTasks = data || []; })
        );
      }

      if (printIds.length > 0) {
        promises.push(
          Promise.resolve(supabase.from('print_task_items')
            .select('task_id, design_face_a, design_face_b')
            .in('task_id', printIds))
            .then(({ data }) => { printDesigns = data || []; })
        );
        promises.push(
          Promise.resolve(supabase.from('print_tasks')
            .select('id, printer:printers!print_tasks_printer_id_fkey(name)')
            .in('id', printIds))
            .then(({ data }) => { printTasksData = data || []; })
        );
      }

      if (contractIds.length > 0) {
        promises.push(
          Promise.resolve(supabase.from('Contract')
            .select('"Contract_Number", "Ad Type"')
            .in('Contract_Number', contractIds))
            .then(({ data }) => { contracts = data || []; })
        );
      }

      await Promise.all(promises);

      // For tasks with no designs, fetch from billboard_history scoped to the SAME contract
      const taskIdsWithNoDesigns = new Set<string>();
      const fallbackItemsByTask = new Map<string, Array<{ billboard_id: number; installation_date: string | null }>>();
      const contractByInstallTaskId = new Map<string, number>();

      compositeTasks.forEach(task => {
        if (task.installation_task_id && task.contract_id) {
          contractByInstallTaskId.set(task.installation_task_id, Number(task.contract_id));
        }
      });

      installTasks.forEach((t: any) => {
        if (t.id && t.contract_id) {
          contractByInstallTaskId.set(t.id, Number(t.contract_id));
        }
      });

      compositeTasks.forEach(task => {
        if (!task.installation_task_id) return;
        const hasDesign = 
          taskDesignsData.some(d => (d.task_id === task.installation_task_id || Number(d.contract_id) === Number(task.contract_id)) && (d.design_face_a_url || d.design_face_b_url)) ||
          installDesigns.some(d => d.task_id === task.installation_task_id && (d.design_face_a || d.design_face_b));
        if (!hasDesign) taskIdsWithNoDesigns.add(task.installation_task_id);
      });

      let historyDesigns: any[] = [];
      const historyByBillboardAndContract = new Map<string, any[]>();

      if (taskIdsWithNoDesigns.size > 0) {
        const { data: itemsWithBillboards } = await supabase
          .from('installation_task_items')
          .select('task_id, billboard_id, installation_date')
          .in('task_id', Array.from(taskIdsWithNoDesigns));

        (itemsWithBillboards || []).forEach((item: any) => {
          if (!item.task_id || !item.billboard_id) return;
          if (!fallbackItemsByTask.has(item.task_id)) fallbackItemsByTask.set(item.task_id, []);
          fallbackItemsByTask.get(item.task_id)!.push({
            billboard_id: Number(item.billboard_id),
            installation_date: item.installation_date || null,
          });
        });

        const allBillboardIds = [...new Set((itemsWithBillboards || []).map((i: any) => i.billboard_id).filter(Boolean))];
        const fallbackContractIds = [...new Set(
          Array.from(taskIdsWithNoDesigns)
            .map(taskId => contractByInstallTaskId.get(taskId))
            .filter((contractId): contractId is number => Number.isFinite(contractId))
        )];

        if (allBillboardIds.length > 0 && fallbackContractIds.length > 0) {
          const { data: histData } = await supabase
            .from('billboard_history')
            .select('billboard_id, contract_number, design_face_a_url, design_face_b_url, installation_date')
            .in('billboard_id', allBillboardIds)
            .in('contract_number', fallbackContractIds)
            .order('installation_date', { ascending: false });

          historyDesigns = histData || [];

          historyDesigns.forEach((row: any) => {
            const key = `${row.billboard_id}:${row.contract_number}`;
            if (!historyByBillboardAndContract.has(key)) historyByBillboardAndContract.set(key, []);
            historyByBillboardAndContract.get(key)!.push(row);
          });
        }
      }

      const adTypeMap = new Map<number, string>();
      contracts.forEach((c: any) => { adTypeMap.set(c.Contract_Number, c['Ad Type'] || ''); });

      const teamNameMap = new Map<string, string>();
      const reinstallMap = new Map<string, number | null>();
      installTasks.forEach((t: any) => { 
        teamNameMap.set(t.id, t.team?.team_name || ''); 
        reinstallMap.set(t.id, t.task_type === 'reinstallation' ? (t.reinstallation_number || 1) : null);
      });

      const printerNameMap = new Map<string, string>();
      printTasksData.forEach((pt: any) => {
        printerNameMap.set(pt.id, pt.printer?.name || '');
      });

      const realInstallCostMap = new Map<string, number>();
      if (installTaskIds.length > 0) {
        const { data: realItems } = await supabase
          .from('installation_task_items')
          .select('task_id, customer_installation_cost, reinstall_count, customer_original_install_cost, customer_reinstall_cost')
          .in('task_id', installTaskIds);

        (realItems || []).forEach((item: any) => {
          const isReinstalled = (item.reinstall_count || 0) > 0;
          const itemCost = isReinstalled
            ? (Number(item.customer_original_install_cost) || 0) + (Number(item.customer_reinstall_cost) || Number(item.customer_installation_cost) || 0)
            : (Number(item.customer_installation_cost) || 0);
          
          const curr = realInstallCostMap.get(item.task_id) || 0;
          realInstallCostMap.set(item.task_id, curr + itemCost);
        });
      }

      // 1. PRIMARY: Fetch contract design URLs using the exact ContractCard algorithm
      const contractDesignMap = new Map<number, string[]>();
      await Promise.all(
        contractIds.map(async (cId) => {
          const urls = await fetchContractDesignUrls(Number(cId));
          if (urls && urls.length > 0) {
            contractDesignMap.set(Number(cId), urls);
          }
        })
      );

      compositeTasks.forEach(task => {
        const seen = new Set<string>();
        const urls: string[] = [];

        const contractUrls = contractDesignMap.get(Number(task.contract_id)) || [];
        contractUrls.forEach(u => {
          if (!seen.has(u)) {
            seen.add(u);
            urls.push(u);
          }
        });

        // PRIMARY: From task_designs table (main design source)
        if (urls.length === 0) {
          taskDesignsData
            .filter(d => (d.task_id && task.installation_task_id && String(d.task_id) === String(task.installation_task_id)) || (d.contract_id && task.contract_id && Number(d.contract_id) === Number(task.contract_id)))
            .forEach(d => {
              if (d.design_face_a_url && !seen.has(d.design_face_a_url)) { seen.add(d.design_face_a_url); urls.push(d.design_face_a_url); }
              if (d.design_face_b_url && !seen.has(d.design_face_b_url)) { seen.add(d.design_face_b_url); urls.push(d.design_face_b_url); }
            });
        }

        // From print task items
        if (urls.length === 0) {
          printDesigns.filter(d => d.task_id === task.print_task_id).forEach(d => {
            if (d.design_face_a && !seen.has(d.design_face_a)) { seen.add(d.design_face_a); urls.push(d.design_face_a); }
            if (d.design_face_b && !seen.has(d.design_face_b)) { seen.add(d.design_face_b); urls.push(d.design_face_b); }
          });
        }

        // From installation task items
        if (urls.length === 0) {
          installDesigns.filter(d => d.task_id === task.installation_task_id).forEach(d => {
            if (d.design_face_a && !seen.has(d.design_face_a)) { seen.add(d.design_face_a); urls.push(d.design_face_a); }
            if (d.design_face_b && !seen.has(d.design_face_b)) { seen.add(d.design_face_b); urls.push(d.design_face_b); }
          });
        }

        // Fallback: only from billboard_history of the SAME contract linked to this composite task
        if (urls.length === 0 && task.installation_task_id && task.contract_id) {
          const taskItems = fallbackItemsByTask.get(task.installation_task_id) || [];
          const contractNo = contractByInstallTaskId.get(task.installation_task_id) ?? Number(task.contract_id);
          const seenBillboards = new Set<number>();

          taskItems.forEach(item => {
            if (!item.billboard_id || seenBillboards.has(item.billboard_id)) return;
            seenBillboards.add(item.billboard_id);

            const historyKey = `${item.billboard_id}:${contractNo}`;
            const candidates = historyByBillboardAndContract.get(historyKey) || [];
            if (candidates.length === 0) return;

            const picked = item.installation_date
              ? candidates.find((h: any) => h.installation_date === item.installation_date) || candidates[0]
              : candidates[0];

            if (picked?.design_face_a_url && !seen.has(picked.design_face_a_url)) {
              seen.add(picked.design_face_a_url);
              urls.push(picked.design_face_a_url);
            }
            if (picked?.design_face_b_url && !seen.has(picked.design_face_b_url)) {
              seen.add(picked.design_face_b_url);
              urls.push(picked.design_face_b_url);
            }
          });
        }

        // NOTE: Removed billboards fallback - it shows current billboard designs
        // which may belong to newer/different contracts, not the composite task's contract

        extras[task.id] = {
          designUrls: urls.slice(0, 4),
          adType: adTypeMap.get(task.contract_id) || '',
          teamName: task.installation_task_id ? teamNameMap.get(task.installation_task_id) || '' : '',
          reinstallationNumber: task.installation_task_id ? reinstallMap.get(task.installation_task_id) ?? null : null,
          printerName: task.print_task_id ? printerNameMap.get(task.print_task_id) || '' : '',
          realInstallCost: task.installation_task_id ? (realInstallCostMap.get(task.installation_task_id) ?? Number(task.customer_installation_cost) ?? 0) : Number(task.customer_installation_cost) ?? 0,
        };
      });

      return extras;
    },
  });

  // Fetch payments distributed to composite tasks (via composite_task_id)
  const { data: taskPayments = {} } = useQuery({
    queryKey: ['composite-task-payments', compositeTasks.map(t => t.id).join(',')],
    enabled: compositeTasks.length > 0,
    queryFn: async () => {
      const taskIds = compositeTasks.map(t => t.id);
      if (taskIds.length === 0) return {};

      // جلب الدفعات المرتبطة بالمهام المجمعة
      const { data } = await supabase
        .from('customer_payments')
        .select('id, amount, distributed_payment_id, paid_at, composite_task_id, entry_type')
        .in('composite_task_id', taskIds)
        .in('entry_type', ['receipt', 'payment', 'account_payment']);

      // جلب رقم الصف الفعلي لكل دفعة في حساب الزبون
      const customerIds = [...new Set(compositeTasks.map(t => t.customer_id).filter(Boolean))];
      let allCustomerPayments: any[] = [];
      if (customerIds.length > 0) {
        const { data: allPayments } = await supabase
          .from('customer_payments')
          .select('id, customer_id')
          .in('customer_id', customerIds as string[])
          .order('paid_at', { ascending: true })
          .order('created_at', { ascending: true });
        allCustomerPayments = allPayments || [];
      }

      // بناء خريطة رقم الصف لكل دفعة حسب الزبون
      const paymentRowNumberMap = new Map<string, number>();
      const customerPaymentCounters = new Map<string, number>();
      allCustomerPayments.forEach((p: any) => {
        const counter = (customerPaymentCounters.get(p.customer_id) || 0) + 1;
        customerPaymentCounters.set(p.customer_id, counter);
        paymentRowNumberMap.set(p.id, counter);
      });

      const map: Record<string, Array<{ id: string; amount: number; distributed_payment_id: string | null; paid_at: string; rowNumber: number }>> = {};
      (data || []).forEach((p: any) => {
        const key = p.composite_task_id;
        if (!key) return;
        if (!map[key]) map[key] = [];
        map[key].push({
          id: p.id,
          amount: Number(p.amount || 0),
          distributed_payment_id: p.distributed_payment_id,
          paid_at: p.paid_at,
          rowNumber: paymentRowNumberMap.get(p.id) || 0,
        });
      });
      return map;
    },
  });

  // Enrich tasks
  const enriched = useMemo(() => compositeTasks.map((task: any) => {
    const extra = taskExtras[task.id] || { designUrls: [], adType: '', teamName: '', reinstallationNumber: null, printerName: '', realInstallCost: 0 };
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
    return {
      ...task,
      customer_installation_cost: realCustomerInstall,
      customer_total: customerTotal,
      company_total: companyTotal,
      net_profit: netProfit,
      designUrls: extra.designUrls,
      adType: extra.adType,
      teamName: extra.teamName,
      printerName: extra.printerName,
      reinstallationNumber: task._reinstallationNumber ?? extra.reinstallationNumber ?? null,
      accent,
      contractIds: task._contractIds || [task.contract_id],
      _payments: payments,
      _totalPaid: totalPaid,
      _paymentPercentage: paymentPercentage,
    };
  }), [compositeTasks, taskExtras, taskPayments]);

  // Stats
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
      const s = search.toLowerCase();
      r = r.filter(t =>
        (t.customer_name || '').toLowerCase().includes(s) ||
        String(t.contract_id).includes(s) ||
        (t.adType || '').toLowerCase().includes(s) ||
        ((t as any).task_name || '').toLowerCase().includes(s)
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

  // Group tasks by installation_task_id
  const grouped = useMemo(() => {
    const groups: { key: string; label: string; contractId: number; customerName: string; adType: string; teamName: string; printerName: string; reinstallationNumber: number | null; tasks: typeof sorted }[] = [];
    const groupMap = new Map<string, typeof sorted>();
    
    sorted.forEach(task => {
      const reinstallNum = task.reinstallationNumber;
      const groupKey = `${task.contract_id}-${task.task_type}-${reinstallNum ?? 'new'}`;
      if (!groupMap.has(groupKey)) groupMap.set(groupKey, []);
      groupMap.get(groupKey)!.push(task);
    });

    groupMap.forEach((tasks, key) => {
      const first = tasks[0];
      const reinstallNum = first.reinstallationNumber;
      const label = reinstallNum != null
        ? `إعادة تركيب re${reinstallNum}-${first.contract_id}`
        : `عقد #${first.contract_id}`;
      // جمع جميع أسماء الفرق والمطابع الفريدة من كل مهام المجموعة
      const uniqueTeams = [...new Set(tasks.map((t: any) => t.teamName).filter(Boolean))] as string[];
      const uniquePrinters = [...new Set(tasks.map((t: any) => t.printerName).filter(Boolean))] as string[];
      groups.push({
        key,
        label,
        contractId: first.contract_id,
        customerName: first.customer_name || 'غير محدد',
        adType: first.adType || '',
        teamName: uniqueTeams.join(' / ') || '',
        printerName: uniquePrinters.join(' / ') || '',
        reinstallationNumber: reinstallNum,
        tasks,
      });
    });

    return groups;
  }, [sorted]);

  const totalPages = Math.ceil(grouped.length / PAGE_SIZE);
  
  // Paginate on group level to avoid splitting a group across pages
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
        // Proportional distribution
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
        // Single task
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
        // Fetch total_area to calculate correct price_per_meter
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
        // تحديث الفاتورة الموحدة بجميع البيانات
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

        // مزامنة سجل الدين في حساب الزبون مع المبلغ الجديد
        const { data: compositeTask } = await supabase.from('composite_tasks')
          .select('customer_id, customer_name, contract_id')
          .eq('id', data.id).single();

        if (compositeTask) {
          // تحديث سجل الدين المرتبط بالفاتورة
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
    <button onClick={() => handleSort(field)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 border ${
        sortField === field
          ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
          : 'text-muted-foreground border-border/40 hover:text-indigo-400 hover:border-indigo-500/20'
      }`}>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-4 shrink-0">
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
              className={`bg-card/35 backdrop-blur-xl border ${border} rounded-[24px] p-4.5 sm:p-5 flex flex-col justify-between min-h-[145px] sm:min-h-[155px] shadow-card hover:shadow-luxury transition-all duration-300 ease-out hover:-translate-y-1 select-none relative overflow-hidden group`}
            >
              {/* Glowing Accent Top Border */}
              <div className={`absolute top-0 right-0 left-0 h-[3.5px] ${accent} opacity-70 group-hover:opacity-100 transition-opacity duration-300`} />

              {/* Ambient Glow Orb */}
              <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-current opacity-0 group-hover:opacity-[0.06] blur-xl transition-all duration-500 pointer-events-none ${color}`} />

              <div className="flex items-start justify-between relative z-10">
                <div className="text-right space-y-1.5">
                  <p className="text-[11px] sm:text-xs font-bold text-muted-foreground/75 tracking-wide leading-none">{label}</p>
                  <p className={`text-xl sm:text-2xl lg:text-[26px] font-black tracking-tight ${color}`}>{value}</p>
                </div>
                <div className={`p-2.5 rounded-[16px] ${bg} ${color} border border-white/5 shadow-inner group-hover:scale-110 transition-transform duration-300 shrink-0`}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
              </div>

              {/* Progress Indicator */}
              <div className="mt-4 sm:mt-5 space-y-1.5 relative z-10">
                <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold text-muted-foreground/50">
                  <span className="font-tajawal">{pctLabel}</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-1.5 w-full bg-muted/20 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${accent} rounded-full transition-all duration-500 ease-out`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar Control Center */}
        <div className="bg-card/45 backdrop-blur-md border border-border/30 rounded-[22px] p-4 flex flex-wrap gap-3 items-center shrink-0 shadow-sm">
          <div className="relative flex-1 min-w-[140px] sm:min-w-[200px]">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <Input 
              placeholder="بحث بالاسم، رقم العقد..." 
              value={search} 
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pr-10 bg-background/50 border-border/30 h-10 text-xs text-foreground placeholder:text-muted-foreground/65 focus-visible:ring-indigo-500/50 rounded-xl" 
            />
          </div>
          
          <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(1); }}>
            <SelectTrigger className="w-[145px] h-10 bg-background/50 border-border/30 text-xs font-bold rounded-xl">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
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
            className="h-10 gap-2 border-border/30 bg-background/50 hover:bg-muted/40 text-xs font-bold rounded-xl"
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

        {/* Card list - grouped by installation task */}
        <div className="flex flex-col gap-4 flex-1 overflow-y-auto pb-4 min-h-0">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 - i * 0.15 }} transition={{ delay: i * 0.06 }}>
                <SkeletonCard />
              </motion.div>
            ))
          ) : paginatedGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4 text-muted-foreground">
              <Package className="h-16 w-16 opacity-10" />
              <span className="text-sm opacity-60">لا توجد مهام مطابقة</span>
            </div>
          ) : (
            paginatedGroups.map((group) => {
              const isCollapsed = collapsedGroups.has(group.key);
              const isSingleTask = group.tasks.length === 1;

              return (
                <div key={group.key} className="rounded-3xl border border-border/20 overflow-hidden bg-gradient-to-br from-card/50 to-card/25 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.05)] hover:border-border/30 transition-all duration-300">
                  {/* Group header - always visible */}
                  <div
                    className={`flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-muted/10 border-b border-border/20 ${!isSingleTask ? 'cursor-pointer hover:bg-muted/20' : ''} transition-all duration-200`}
                    onClick={() => !isSingleTask && toggleGroupCollapse(group.key)}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap text-right">
                      <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm shrink-0">
                        <FolderOpen className="h-4.5 w-4.5" />
                      </div>
                      <span className="text-base font-black text-foreground tracking-tight">{group.customerName}</span>
                      <span className="text-xs font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded-lg font-extrabold ">
                        {group.label}
                      </span>
                      {group.reinstallationNumber != null && (
                        <span className="text-[10px] font-mono bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2.5 py-0.5 rounded-lg font-extrabold ">
                          re{group.reinstallationNumber}-{group.contractId}
                        </span>
                      )}
                      {group.adType && group.adType !== 'غير محدد' && (
                        <span className="text-xs font-bold text-muted-foreground/80">{group.adType}</span>
                      )}
                      {group.teamName && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-blue-400 bg-blue-500/10 border border-blue-500/15 px-2.5 py-1 rounded-xl shadow-sm">
                          <Users className="h-3.5 w-3.5" /> {group.teamName}
                        </span>
                      )}
                      {group.printerName && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-purple-400 bg-purple-500/10 border border-purple-500/15 px-2.5 py-1 rounded-xl shadow-sm">
                          <Printer className="h-3.5 w-3.5" /> {group.printerName}
                        </span>
                      )}
                      {!isSingleTask && (
                        <span className="text-[10px] font-black bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full px-2.5 py-0.5">
                          {group.tasks.length} مهام
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-2.5 py-1 rounded-xl shadow-sm">
                        <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
                        تكلفة الزبون: {group.groupTotal.toLocaleString('ar-LY')} د.ل
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap" onClick={e => e.stopPropagation()}>
                      <div className="hidden sm:flex items-center gap-3 text-xs">
                        <span className="text-emerald-400 font-black">إجمالي الزبون: {group.groupTotal.toLocaleString('ar-LY')} د.ل</span>
                        <span className={`font-black ${group.groupProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ربح: {group.groupProfit.toLocaleString('ar-LY')}
                        </span>
                      </div>

                      {/* ZIP Download */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            disabled={zipDownloadingGroup === group.key}
                            onClick={(e) => { e.stopPropagation(); handleDownloadGroupZip({ key: group.key, contractId: group.contractId, customerName: group.customerName }); }}
                            className="h-8.5 w-8.5 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all hover:scale-105 disabled:opacity-50"
                          >
                            {zipDownloadingGroup === group.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>تحميل صور وCSV العقد كملف ZIP</TooltipContent>
                      </Tooltip>

                      {/* إضافة مهمة طباعة لكل المهام */}
                      {(() => {
                        const tasksToCreate = group.tasks.filter((t: any) => !t.print_task_id && t.installation_task_id);
                        if (tasksToCreate.length === 0) return null;
                        return (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleCreatePrintTasksForGroup(group.tasks)}
                                className="h-8.5 rounded-xl flex items-center gap-1.5 px-3 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all hover:scale-105 text-xs font-bold"
                              >
                                <Printer className="h-3.5 w-3.5 animate-pulse" />
                                <span>إنشاء مهمة طباعة ({tasksToCreate.length})</span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">إنشاء مهمة طباعة للمهام غير المجهزة في التجميعة</TooltipContent>
                          </Tooltip>
                        );
                      })()}

                      {/* Discount Popover */}
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
                          <button className="h-8.5 w-8.5 rounded-xl flex items-center justify-center bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all hover:scale-105">
                            <Percent className="h-4 w-4" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[380px] p-5 rounded-2xl border-border/40 shadow-xl" side="bottom" align="end">
                          <div className="space-y-5" dir="rtl">
                            <div className="flex items-center justify-between">
                              <h4 className="text-base font-extrabold text-foreground">إدارة الخصم</h4>
                              <span className="text-[10px] font-bold text-muted-foreground bg-muted/40 px-2 py-1 rounded-md">
                                {group.tasks.length} مهمة
                              </span>
                            </div>
                            {/* Per-task breakdown */}
                            <div className="border border-border/50 rounded-xl overflow-hidden text-xs bg-card/40">
                              <table className="w-full">
                                <thead className="bg-muted/40">
                                  <tr>
                                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">المهمة</th>
                                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">الإجمالي</th>
                                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">الخصم</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30">
                                  {group.tasks.map((t, i) => (
                                    <tr key={t.id} className="hover:bg-muted/20">
                                      <td className="px-3 py-2 font-mono text-foreground/85">{t.teamName || `مهمة ${i + 1}`}</td>
                                      <td className="px-3 py-2 font-mono">{(t.customer_total || 0).toLocaleString('ar-LY')}</td>
                                      <td className="px-3 py-2 font-mono text-amber-400">{(t.discount_amount || 0).toLocaleString('ar-LY')}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot className="bg-muted/30 font-extrabold">
                                  <tr>
                                    <td className="px-3 py-2">الإجمالي</td>
                                    <td className="px-3 py-2 font-mono">{group.groupTotal.toLocaleString('ar-LY')}</td>
                                    <td className="px-3 py-2 font-mono text-amber-400">{group.tasks.reduce((s, t) => s + (t.discount_amount || 0), 0).toLocaleString('ar-LY')}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                            {/* Target selection */}
                            <div className="space-y-2">
                              <Label className="text-xs font-bold text-foreground/80">تطبيق على</Label>
                              <Select value={discountTarget} onValueChange={(v) => setDiscountTarget(v as any)}>
                                <SelectTrigger className="h-10 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">تقسيم على الجميع</SelectItem>
                                  {group.tasks.map((t, i) => (
                                    <SelectItem key={t.id} value={t.id}>{t.teamName || `مهمة ${i + 1}`}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {/* Amount & reason */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label className="text-xs font-bold text-foreground/80">مبلغ الخصم</Label>
                                <Input type="number" value={discountAmount} onChange={e => setDiscountAmount(Number(e.target.value))} className="h-10 text-sm" />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs font-bold text-foreground/80">السبب</Label>
                                <Input value={discountReason} onChange={e => setDiscountReason(e.target.value)} className="h-10 text-sm" placeholder="اختياري" />
                              </div>
                            </div>
                            <Button size="sm" className="w-full h-11 text-sm font-extrabold mt-1" onClick={() => handleSaveDiscount(group.tasks)} disabled={discountSaving}>
                              {discountSaving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                              حفظ الخصم
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                      
                      {/* Unified invoice button */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => {
                              const fullGroup = grouped.find(g => g.key === group.key);
                              setGroupInvoiceTasks(fullGroup?.tasks || group.tasks);
                              setGroupInvoiceOpen(true);
                            }}
                            className="h-8.5 w-8.5 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all hover:scale-105"
                          >
                            <FileOutput className="h-4.5 w-4.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">فاتورة موحدة للزبون</TooltipContent>
                      </Tooltip>

                      {/* Dynamic printer invoice buttons */}
                      {(() => {
                        const uniquePrinters = new Map();
                        group.tasks.forEach((t) => {
                          if (t.print_task_id) {
                            uniquePrinters.set(t.print_task_id, { taskId: t.print_task_id, name: t.printerName || 'المطبعة', task: t });
                          }
                        });
                        const printers = Array.from(uniquePrinters.values());
                        if (printers.length === 0) return null;
                        if (printers.length === 1) {
                          return (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => { setInvoiceTask(printers[0].task); setInvoiceType('print_vendor'); setInvoiceOpen(true); }}
                                  className="h-8.5 rounded-xl flex items-center gap-1.5 px-3 bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-all hover:scale-105 text-xs font-bold"
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">المطبعة</span>
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">فاتورة المطبعة: {printers[0].name}</TooltipContent>
                            </Tooltip>
                          );
                        }
                        return printers.map(p => (
                          <Tooltip key={p.taskId}>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => { setInvoiceTask(p.task); setInvoiceType('print_vendor'); setInvoiceOpen(true); }}
                                className="h-8.5 rounded-xl flex items-center gap-1.5 px-3 bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-all hover:scale-105 text-xs font-bold"
                              >
                                <Printer className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{p.name}</span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">فاتورة المطبعة: {p.name}</TooltipContent>
                          </Tooltip>
                        ));
                      })()}

                      {/* Dynamic team invoice buttons */}
                      {(() => {
                        const uniqueTeams = new Map();
                        group.tasks.forEach((t) => {
                          if (t.installation_task_id) {
                            uniqueTeams.set(t.installation_task_id, { id: t.installation_task_id, name: t.teamName || 'الفرقة', task: t });
                          }
                        });
                        const teams = Array.from(uniqueTeams.values());
                        if (teams.length === 0) return null;
                        if (teams.length === 1) {
                          return (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => { setInvoiceTask(teams[0].task); setInvoiceType('installation_team'); setInvoiceOpen(true); }}
                                  className="h-8.5 rounded-xl flex items-center gap-1.5 px-3 bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20 transition-all hover:scale-105 text-xs font-bold"
                                >
                                  <Users className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">{teams[0].name || 'الفرقة'}</span>
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">فاتورة الفرقة: {teams[0].name}</TooltipContent>
                            </Tooltip>
                          );
                        }
                        return teams.map(t => (
                          <Tooltip key={t.id}>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => { setInvoiceTask(t.task); setInvoiceType('installation_team'); setInvoiceOpen(true); }}
                                className="h-8.5 rounded-xl flex items-center gap-1.5 px-3 bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20 transition-all hover:scale-105 text-xs font-bold"
                              >
                                <Users className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{t.name}</span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">فاتورة الفرقة: {t.name}</TooltipContent>
                          </Tooltip>
                        ));
                      })()}

                      {!isSingleTask && (
                        <button onClick={() => toggleGroupCollapse(group.key)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted/40 transition-colors">
                          {isCollapsed ? <ChevronDown className="h-4.5 w-4.5 text-muted-foreground" /> : <ChevronUp className="h-4.5 w-4.5 text-muted-foreground" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Group tasks */}
                  <AnimatePresence initial={false}>
                    {(!isCollapsed || isSingleTask) && (
                      <motion.div
                        initial={isSingleTask ? false : { height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className={`flex flex-col ${isSingleTask ? '' : 'gap-0 divide-y divide-border/20'}`}>
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

      {/* Group Invoice Dialog - unified invoice for all tasks in a group */}
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              تأكيد حذف المهمة
            </AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف المهمة المجمعة والفواتير المرتبطة. هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTask && deleteMutation.mutate(deleteTask)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
              حذف المهمة
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
              // If there are more in the queue, process them after a short delay
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
            // Process next item in queue if any
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
