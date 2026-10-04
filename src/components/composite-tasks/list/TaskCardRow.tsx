import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { batchInQuery } from '@/utils/supabaseBatch';
import {
  getCompositeTaskOperationKey,
  getCurrentOperationInstallationCost,
  getOperationLabel,
  getTaskContractGroupKey,
  isReinstallationOperation,
  normalizeCompositeTaskType,
  sortTasksNewestFirst,
} from '@/lib/compositeTaskOperation';
import {
  filterTaskContractIdsByCustomer,
  matchContractIdsForTaskBillboards,
  normalizeContractId,
  resolveTaskContractAdTypes,
  resolveTaskContractCustomerInfo,
} from '@/lib/compositeTaskContractIdentity';
import {
  Search,
  CheckCircle2, Clock, Package, Users,
  RefreshCw, XCircle, Printer, Scissors,
  Trash2, Edit, ChevronDown, Image as ImageIcon,
  LayoutList, FileText, X, Wallet, Coins,
  ChevronLeft, ChevronRight, CalendarDays,
  DollarSign, TrendingUp, TrendingDown, Wrench,
  FileOutput, Loader2, AlertTriangle, AlertCircle, ChevronUp, Percent,
  FolderOpen, Download, Megaphone, MoreHorizontal, Eye,
  ImagePlus, Shuffle, ClipboardCheck, Building2, UserRound,
  Maximize2, ExternalLink, Gift, Check, CheckSquare, Sparkles, Layers
} from 'lucide-react';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { exportContractImagesToZip } from '@/utils/exportContractImagesToZip';
import { getContractWithBillboards } from '@/services/contractService';
import { EnhancedEditCompositeTaskCostsDialog } from '../EnhancedEditCompositeTaskCostsDialog';
import { UnifiedTaskInvoice, InvoiceType } from '../UnifiedTaskInvoice';
import { CompositeTaskWithDetails, UpdateCompositeTaskCostsInput } from '@/types/composite-task';
import { CreatePrintTaskFromInstallation } from '../../tasks/CreatePrintTaskFromInstallation';
import { TaskDesignManager } from '../../tasks/TaskDesignManager';
import { BulkDesignAssigner } from '../../tasks/BulkDesignAssigner';
import { UnifiedPrintAllDialog, BillboardPrintItem } from '../../shared/printing/UnifiedPrintAllDialog';
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

import { isEnabledContractFlag, normalizeForSearch, fetchInstallationWorkflowData, STATUS_CONFIG, extractDualPaletteFromImage, type InstallationWorkflowData } from './shared';
import { DesignPanel } from './DesignPanel';

export const TaskCardRow = ({
  task, idx, operationInstallationTaskIds, onDelete, onOpenInvoice,
  onNavigateToPayment, onCreatePrintTask, onManageDesigns, onDistributeDesigns,
  onPrintInstallationTask, onOpenInstallationTask, workflowBusy,
}: {
  task: any; idx: number;
  operationInstallationTaskIds: string[];
  onDelete: (task: any) => void;
  onOpenInvoice: (task: any, type: InvoiceType) => void;
  onNavigateToPayment: (distributedPaymentId: string, customerId: string, customerName: string) => void;
  onCreatePrintTask?: (installationTaskId: string) => void;
  onManageDesigns: (task: any, relatedTaskIds: string[]) => void;
  onDistributeDesigns: (task: any, relatedTaskIds: string[]) => void;
  onPrintInstallationTask: (task: any) => void;
  onOpenInstallationTask: (task: any) => void;
  workflowBusy?: boolean;
}) => {
  const [dominantColor, setDominantColor] = useState<string | null>(null);
  const [cardPalette, setCardPalette] = useState<[string, string] | null>(null);
  const [localDesignUrls, setLocalDesignUrls] = useState<string[]>(task.designUrls || []);
  const installationImages = Array.isArray(task.installationImages) ? task.installationImages.filter(Boolean) : [];
  const cardImages = installationImages.length > 0 ? installationImages : localDesignUrls;

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
  const hasPrintTask = Boolean(task.print_task_id);
  const hasCustomerInvoice = Boolean(task.combined_invoice_id || task.invoice_generated);

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
  const installationItemCount = Number(task.installationItemCount) || 0;
  const assignedDesignCount = Number(task.assignedDesignCount) || 0;
  const taskDesignCount = Number(task.taskDesignCount) || 0;
  const distributionPct = installationItemCount > 0
    ? Math.round((assignedDesignCount / installationItemCount) * 100)
    : 0;

  const cardBg = cardPalette
    ? `linear-gradient(135deg, rgba(${cardPalette[0]}, 0.16) 0%, rgba(${cardPalette[1]}, 0.08) 45%, hsl(var(--card)/0.95) 100%)`
    : dominantColor
    ? `linear-gradient(to left, rgba(${dominantColor}, 0.15) 0%, rgba(${dominantColor}, 0.06) 35%, rgba(${dominantColor}, 0.02) 70%, hsl(var(--card)) 100%)`
    : `linear-gradient(to left, color-mix(in srgb, ${task.accent || '#6366f1'} 8%, transparent) 0%, color-mix(in srgb, ${task.accent || '#6366f1'} 2%, transparent) 35%, hsl(var(--card)) 100%)`;
  const cardBorder = cardPalette
    ? `1.5px solid rgba(${cardPalette[0]}, 0.4)`
    : dominantColor
    ? `1px solid rgba(${dominantColor}, 0.35)`
    : `1px solid color-mix(in srgb, ${task.accent || '#6366f1'} 15%, hsl(var(--border)/0.4))`;

  // تجهيز نص نوع الإعلان
  const adTypeDisplay = task.adType && task.adType.trim().length > 0 && task.adType !== 'غير محدد'
    ? task.adType.trim()
    : null;
  const workflowActions = [
    {
      key: 'open-task',
      label: 'فتح وإدارة المهمة',
      icon: Wrench,
      onClick: () => onOpenInstallationTask(task),
      primary: true,
    },
    {
      key: 'designs',
      label: taskDesignCount > 0 ? 'إدارة التصاميم' : 'إضافة تصميم',
      icon: ImagePlus,
      onClick: () => onManageDesigns(task, operationInstallationTaskIds),
      primary: false,
    },
    {
      key: 'distribution',
      label: 'توزيع التصاميم',
      icon: Shuffle,
      onClick: () => onDistributeDesigns(task, operationInstallationTaskIds),
      primary: false,
    },
  ];

  // ⋯ قائمة الإجراءات الثانوية (موحدة بين الحاسوب والجوال)
  const moreMenu = (triggerClass: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={triggerClass} aria-label="المزيد من الإجراءات">
          <MoreHorizontal className="h-4 w-4" />
          المزيد
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 text-right font-tajawal rounded-xl border-border/40 shadow-xl">
        <DropdownMenuItem
          onClick={() => window.open(`/design-studio?composite_task_id=${task.id}`, '_blank')}
          className="gap-2 cursor-pointer text-xs font-bold text-amber-400 focus:text-amber-300 focus:bg-amber-500/10"
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          <span>فتح في استوديو التصميم</span>
        </DropdownMenuItem>
        {task.installation_task_id && (
          <DropdownMenuItem onClick={() => onOpenInvoice(task, 'installation_team')} className="gap-2 cursor-pointer text-xs">
            <Users className="h-3.5 w-3.5 text-teal-400" />
            <span>فاتورة الفرقة</span>
          </DropdownMenuItem>
        )}
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
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.02, ease: 'easeOut' }}
      className="group relative rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-lg bg-card/60"
      style={{ background: cardBg, border: cardBorder }}
    >
      {/* Desktop & Laptop layout */}
      <div className="hidden lg:grid grid-cols-[260px_minmax(230px,1.2fr)_195px_180px_210px] items-stretch min-h-[240px]">
        {/* 1. Design Panel (Right in RTL) */}
        <div className="shrink-0 overflow-hidden relative" onClick={e => e.stopPropagation()}>
          <DesignPanel
            urls={cardImages}
            accent={task.accent}
            label={installationImages.length > 0 ? 'صورة التركيب' : 'تصميم الإعلان'}
            onColorExtracted={setDominantColor}
            onDualColorExtracted={setCardPalette}
          />
          <span className="absolute right-2 top-2 z-30 inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/75 px-2 py-1 text-[10px] font-black text-white shadow backdrop-blur-md">
            <ImageIcon className="h-3.5 w-3.5 text-primary" />
            {installationImages.length > 0 ? 'صورة التركيب الفعلية' : 'تصميم المهمة'}
          </span>
          {cardImages.length > 1 && (
            <div className="absolute bottom-2 right-2 z-30 bg-black/70 backdrop-blur-md text-white px-2 py-0.5 rounded-md text-[9px] font-bold border border-white/10 shadow">
              {cardImages.length} صور
            </div>
          )}
        </div>

        {/* 2. Task Identity Section */}
        <div className="p-4 flex flex-col justify-between gap-2.5 text-right border-l border-border/20">
          <div className="space-y-2">
            {/* Header: Ad Type First (Above Name), then Customer & Task Number */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black border transition-all ${
                  adTypeDisplay 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm' 
                    : 'bg-muted/40 text-muted-foreground/60 border-border/30'
                }`}>
                  <Megaphone className={`h-3.5 w-3.5 shrink-0 ${adTypeDisplay ? 'text-amber-400' : 'text-muted-foreground/50'}`} />
                  <span>{adTypeDisplay ? `نوع الإعلان: ${adTypeDisplay}` : 'نوع الإعلان غير محدد'}</span>
                </span>
                {(() => {
                  if (task.task_type === 'new_installation') {
                    const incInstall = Boolean(task.contractInclusion?.includeInstall);
                    const incPrint = Boolean(task.contractInclusion?.includePrint);

                    if (incInstall && incPrint) {
                      return (
                        <span className="inline-flex items-center gap-1 text-[10px] rounded-md px-2 py-0.5 font-black border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                          <Gift className="h-3 w-3" /> جديد (شامل طباعة وتركيب)
                        </span>
                      );
                    } else if (incInstall) {
                      return (
                        <span className="inline-flex items-center gap-1 text-[10px] rounded-md px-2 py-0.5 font-black border bg-blue-500/15 text-blue-400 border-blue-500/30">
                          <Gift className="h-3 w-3" /> جديد (شامل تركيب فقط)
                        </span>
                      );
                    } else if (incPrint) {
                      return (
                        <span className="inline-flex items-center gap-1 text-[10px] rounded-md px-2 py-0.5 font-black border bg-sky-500/15 text-sky-400 border-sky-500/30">
                          <Gift className="h-3 w-3" /> جديد (شامل طباعة فقط)
                        </span>
                      );
                    } else {
                      return (
                        <span className="text-[10px] rounded-md px-2 py-0.5 font-extrabold border bg-muted/50 text-muted-foreground border-border/30">
                          تركيب جديد
                        </span>
                      );
                    }
                  } else {
                    return (
                      <span className="text-[10px] rounded-md px-2 py-0.5 font-extrabold border bg-orange-500/10 text-orange-400 border-orange-500/20">
                        {`إعادة تركيب ${task.reinstallationNumber ? `(re${task.reinstallationNumber})` : ''}`}
                      </span>
                    );
                  }
                })()}
              </div>

              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                {task.task_number && (
                  <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 rounded-md px-2 py-0.5 font-black">
                    م#{task.task_number}
                  </span>
                )}
                <span className="text-base font-black text-foreground tracking-tight hover:text-primary transition-colors">
                  {task.customer_name || 'غير محدد'}
                </span>
              </div>
            </div>

            {/* Components: Team / Printer / Cutouts */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {task.installation_task_id && (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Wrench className="h-3 w-3" /> تركيب {task.teamName ? `· ${task.teamName}` : ''}
                </span>
              )}
              <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-extrabold ${
                hasPrintTask
                  ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
                  : 'border-amber-500/25 bg-amber-500/10 text-amber-300'
              }`}>
                {hasPrintTask ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {hasPrintTask ? `الطباعة مفعّلة${task.printerName ? ` · ${task.printerName}` : ''}` : 'الطباعة غير منشأة'}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-extrabold ${
                hasCustomerInvoice
                  ? 'border-blue-500/25 bg-blue-500/10 text-blue-400'
                  : 'border-border/35 bg-muted/30 text-muted-foreground'
              }`}>
                <FileText className="h-3 w-3" />
                {hasCustomerInvoice ? 'الفاتورة صادرة' : 'الفاتورة غير صادرة'}
              </span>
              {hasCutouts && (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Scissors className="h-3 w-3" /> مجسمات
                </span>
              )}
            </div>
          </div>

          {/* Footer: Contract & Date */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap pt-1 border-t border-border/15">
            <span className={cn(
              "inline-flex items-center gap-1 font-extrabold px-2 py-0.5 rounded-md font-mono text-[11px]",
              (task.contractIds && task.contractIds.length > 1)
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
            )}>
              {(task.contractIds && task.contractIds.length > 1) ? (
                <>
                  <Layers className="h-3 w-3 text-amber-400" />
                  <span>عقود مجمعة: #{task.contractIds.join('، #')}</span>
                </>
              ) : (
                <>
                  <FileText className="h-3 w-3 text-indigo-400" />
                  <span>العقد: #{task.contractIds && task.contractIds.length === 1 ? task.contractIds[0] : (task.contract_id || 'غير محدد')}</span>
                </>
              )}
            </span>
            <span className="inline-flex items-center gap-1 text-muted-foreground/75 text-[11px] font-semibold">
              <CalendarDays className="h-3 w-3 text-muted-foreground/50" />
              <span>{format(new Date(task.created_at), 'dd MMM yyyy', { locale: ar })}</span>
            </span>
          </div>
        </div>

        {/* 3. Financial & Payment Status Widget */}
        <div className="p-3.5 flex flex-col justify-between gap-2 border-l border-border/20 bg-muted/10 text-right" onClick={e => e.stopPropagation()}>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground/80 pb-1 border-b border-border/15">
              <span className="flex items-center gap-1">
                <Wallet className="h-3.5 w-3.5 text-muted-foreground/60" />
                الحالة المالية
              </span>
              <span className={cn(
                "text-[9px] font-black px-2 py-0.5 rounded-md border",
                customerTotalVal === 0
                  ? "bg-slate-500/20 text-slate-300 border-slate-500/30"
                  : isFullyPaid
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  : task._totalPaid > 0
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-rose-500/20 text-rose-300 border-rose-500/40"
              )}>
                {customerTotalVal === 0 ? "مجانية (0 د.ل)" : isFullyPaid ? "مسددة بالكامل" : task._totalPaid > 0 ? `مسددة (${task._paymentPercentage}%)` : "غير مسددة (0%)"}
              </span>
            </div>

            <div className="space-y-1 text-[11px]">
              <div className="flex items-center justify-between font-bold">
                <span className="text-muted-foreground/70">الإجمالي:</span>
                <span className="font-mono text-sm font-black text-foreground">{customerTotalVal.toLocaleString('ar-LY')} د.ل</span>
              </div>
              <div className="flex items-center justify-between font-bold">
                <span className="text-muted-foreground/70">المدفوع:</span>
                <span className="font-mono text-sm font-black text-emerald-400">{task._totalPaid.toLocaleString('ar-LY')} د.ل</span>
              </div>
              <div className="flex items-center justify-between font-bold pt-1 border-t border-border/10">
                <span className="text-muted-foreground/70">المتبقي:</span>
                {customerTotalVal === 0 ? (
                  <span className="text-[9px] font-black text-slate-400">0 د.ل</span>
                ) : isFullyPaid ? (
                  <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                    مسدد بالكامل
                  </span>
                ) : (
                  <span className="font-mono text-sm font-black text-rose-400">{remainingDue.toLocaleString('ar-LY')} د.ل</span>
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
                <span className="font-mono text-sm font-black text-amber-300">
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
              <span className={`font-mono text-sm font-black ${adjNetProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
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
        <div className="flex flex-col justify-between gap-2.5 p-3 text-center" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between gap-2">
            <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-black whitespace-nowrap shadow-sm ${cfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} shrink-0`} />
              {cfg.label}
            </span>
            {customerTotalVal <= 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex h-7 items-center gap-1 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 text-[9px] font-black text-amber-300">
                    <AlertTriangle className="h-3 w-3" /> التكلفة صفر
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">راجع التكاليف قبل اعتماد الفاتورة</TooltipContent>
              </Tooltip>
            )}
          </div>

          <div className="grid w-full grid-cols-2 gap-1.5 text-right">
            <div className={`rounded-xl border p-2 ${hasPrintTask ? 'border-emerald-500/20 bg-emerald-500/8' : 'border-amber-500/20 bg-amber-500/8'}`}>
              <div className="text-[9px] font-bold text-muted-foreground">حالة الطباعة</div>
              <div className={`mt-0.5 flex items-center gap-1 text-[10px] font-black ${hasPrintTask ? 'text-emerald-400' : 'text-amber-300'}`}>
                {hasPrintTask ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {hasPrintTask ? 'مفعّلة' : 'غير منشأة'}
              </div>
            </div>
            <div className={`rounded-xl border p-2 ${hasCustomerInvoice ? 'border-blue-500/20 bg-blue-500/8' : 'border-border/30 bg-muted/20'}`}>
              <div className="text-[9px] font-bold text-muted-foreground">حالة الفاتورة</div>
              <div className={`mt-0.5 flex items-center gap-1 text-[10px] font-black ${hasCustomerInvoice ? 'text-blue-400' : 'text-muted-foreground'}`}>
                <FileText className="h-3 w-3" />
                {hasCustomerInvoice ? 'صادرة' : 'غير صادرة'}
              </div>
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-1.5">
            <button
              onClick={() => onOpenInvoice(task, 'customer')}
              className="col-span-2 inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary px-3 text-[11px] font-black text-primary-foreground transition-all duration-200 hover:bg-primary/90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <FileOutput className="h-4 w-4" />
              {hasCustomerInvoice ? 'عرض فاتورة الزبون' : 'معاينة وإصدار الفاتورة'}
            </button>
            {hasPrintTask ? (
              <button
                onClick={() => onOpenInvoice(task, 'print_vendor')}
                className="col-span-2 inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-violet-500/25 bg-violet-500/10 px-3 text-[11px] font-black text-violet-400 transition-all duration-200 hover:bg-violet-500/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
              >
                <Printer className="h-4 w-4" /> فاتورة المطبعة
              </button>
            ) : task.installation_task_id ? (
              <button
                onClick={() => onCreatePrintTask?.(task.installation_task_id)}
                className="col-span-2 inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 text-[11px] font-black text-cyan-400 transition-all duration-200 hover:bg-cyan-500/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
              >
                <Printer className="h-4 w-4" /> إنشاء مهمة الطباعة
              </button>
            ) : null}
            {moreMenu("col-span-2 inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border/40 bg-muted/40 px-2 text-[11px] font-black text-muted-foreground transition-all duration-200 hover:bg-muted/60 hover:text-foreground")}
          </div>
        </div>
      </div>

      {task.installation_task_id && (
        <div className="hidden lg:flex items-center justify-between gap-4 border-t border-amber-500/20 bg-background/35 px-4 py-3" onClick={e => e.stopPropagation()}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-400">
              <ClipboardCheck className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black text-foreground">تجهيز مهمة التركيب</span>
                <span className="rounded-md border border-border/35 bg-muted/30 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                  {taskDesignCount} {taskDesignCount === 1 ? 'تصميم' : 'تصاميم'}
                </span>
                <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${
                  distributionPct >= 100
                    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
                    : 'border-amber-500/25 bg-amber-500/10 text-amber-300'
                }`}>
                  التوزيع {assignedDesignCount}/{installationItemCount}
                </span>
              </div>
              <div className="h-1.5 w-52 overflow-hidden rounded-full bg-muted/40">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${distributionPct >= 100 ? 'bg-emerald-500' : 'bg-primary'}`}
                  style={{ width: `${Math.min(100, distributionPct)}%` }}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {workflowActions.map(({ key, label, icon: Icon, onClick, primary }) => (
              <button
                key={key}
                type="button"
                onClick={onClick}
                disabled={workflowBusy}
                className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border px-3.5 text-xs font-black transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-wait disabled:opacity-60 ${
                  primary
                    ? 'border-primary/45 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
                    : 'border-border/45 bg-card/70 text-foreground hover:border-primary/35 hover:bg-primary/8'
                }`}
              >
                {workflowBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className={`h-4 w-4 ${primary ? '' : 'text-amber-400'}`} />}
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mobile & Tablet layout */}
      <div className="flex flex-col lg:hidden p-4 gap-3 bg-card/60 backdrop-blur-md text-right">
        {/* صورة التصميم على الجوال/التابلت */}
        <div className="relative h-52 overflow-hidden rounded-xl border border-border/50 sm:h-64" onClick={e => e.stopPropagation()}>
          <DesignPanel
            urls={cardImages}
            accent={task.accent}
            label={installationImages.length > 0 ? 'صورة التركيب' : 'تصميم الإعلان'}
          />
        </div>
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

        <div className="grid grid-cols-2 gap-2">
          <div className={`rounded-xl border p-2.5 ${hasPrintTask ? 'border-emerald-500/20 bg-emerald-500/8' : 'border-amber-500/20 bg-amber-500/8'}`}>
            <div className="text-[10px] font-bold text-muted-foreground">حالة الطباعة</div>
            <div className={`mt-1 flex items-center gap-1.5 text-xs font-black ${hasPrintTask ? 'text-emerald-400' : 'text-amber-300'}`}>
              {hasPrintTask ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
              {hasPrintTask ? 'مفعّلة' : 'غير منشأة'}
            </div>
          </div>
          <div className={`rounded-xl border p-2.5 ${hasCustomerInvoice ? 'border-blue-500/20 bg-blue-500/8' : 'border-border/30 bg-muted/20'}`}>
            <div className="text-[10px] font-bold text-muted-foreground">حالة الفاتورة</div>
            <div className={`mt-1 flex items-center gap-1.5 text-xs font-black ${hasCustomerInvoice ? 'text-blue-400' : 'text-muted-foreground'}`}>
              <FileText className="h-3.5 w-3.5" />
              {hasCustomerInvoice ? 'صادرة' : 'غير صادرة'}
            </div>
          </div>
        </div>

        {task.installation_task_id && (
          <div className="space-y-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-black text-foreground">تجهيز مهمة التركيب</span>
              </div>
              <span className="text-[10px] font-black text-muted-foreground">
                {assignedDesignCount}/{installationItemCount} موزع
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted/40">
              <div
                className={`h-full rounded-full transition-all duration-200 ${distributionPct >= 100 ? 'bg-emerald-500' : 'bg-primary'}`}
                style={{ width: `${Math.min(100, distributionPct)}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {workflowActions.map(({ key, label, icon: Icon, onClick, primary }) => (
                <button
                  key={key}
                  type="button"
                  onClick={onClick}
                  disabled={workflowBusy}
                  className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 text-[11px] font-black transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-wait disabled:opacity-60 ${
                    primary
                      ? 'border-primary/45 bg-primary text-primary-foreground'
                      : 'border-border/45 bg-card/75 text-foreground hover:border-primary/35 hover:bg-primary/8'
                  }`}
                >
                  {workflowBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className={`h-4 w-4 ${primary ? '' : 'text-amber-400'}`} />}
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mobile Financial Summary Box */}
        <div className="bg-background/40 p-3 rounded-xl border border-border/20 grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <div className="text-[10px] font-bold text-muted-foreground/80 mb-0.5">الزبون</div>
            <div className="font-mono text-sm font-black text-foreground">{(task.customer_total || 0).toLocaleString('ar-LY')}</div>
            <div className="text-[10px] text-emerald-400 font-bold">مدفوع: {task._totalPaid.toLocaleString('ar-LY')}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-muted-foreground/80 mb-0.5">التكلفة</div>
            <div className="font-mono text-sm font-black text-amber-300">{adjCompanyTotal.toLocaleString('ar-LY')}</div>
            {discountAmt > 0 && (
              <div className="text-[10px] font-bold text-rose-400">خصم: −{discountAmt.toLocaleString('ar-LY')}</div>
            )}
          </div>
          <div>
            <div className="text-[10px] font-bold text-muted-foreground/80 mb-0.5">الربح</div>
            <div className={`font-mono text-sm font-black ${adjNetProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {adjNetProfit.toLocaleString('ar-LY')}
            </div>
            <div className={`text-[10px] font-bold ${adjNetProfit >= 0 ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>
              {customerTotalVal > 0 ? adjProfitPct.toFixed(0) : 0}%
            </div>
          </div>
        </div>

        {/* Mobile Action Buttons */}
        <div className="grid grid-cols-2 gap-2 border-t border-border/20 pt-2 sm:grid-cols-3" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => onOpenInvoice(task, 'customer')}
              className="col-span-2 flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-primary/40 bg-primary px-3 text-xs font-black text-primary-foreground transition-all duration-200 hover:bg-primary/90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:col-span-1"
            >
              <FileOutput className="h-3.5 w-3.5" />
              <span>{hasCustomerInvoice ? 'عرض الفاتورة' : 'إصدار الفاتورة'}</span>
            </button>
            {hasPrintTask ? (
              <button
                onClick={() => onOpenInvoice(task, 'print_vendor')}
                className="flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 text-xs font-black text-violet-400 transition-all duration-200 hover:bg-violet-500/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>فاتورة المطبعة</span>
              </button>
            ) : (
              task.installation_task_id && (
                <button
                  onClick={() => onCreatePrintTask?.(task.installation_task_id)}
                  className="flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 text-xs font-black text-cyan-400 transition-all duration-200 hover:bg-cyan-500/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                  title="إنشاء مهمة طباعة لهذه المهمة"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>إنشاء الطباعة</span>
                </button>
              )
            )}
            {moreMenu("flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border/40 bg-muted/40 px-3 text-xs font-black text-muted-foreground transition-all duration-200 hover:bg-muted/60")}
        </div>
      </div>
    </motion.div>
  );
};

/* ── Contract Group Card Component with Dual-Color Dynamic Theme ── */
