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
import {
  getCompositeTaskOperationKey,
  getCurrentOperationInstallationCost,
  getOperationLabel,
  getTaskContractGroupKey,
  normalizeCompositeTaskType,
  sortTasksNewestFirst,
} from '@/lib/compositeTaskOperation';
import {
  filterTaskContractIdsByCustomer,
  normalizeContractId,
  resolveTaskContractAdTypes,
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
import { exportContractImagesToZip } from '@/utils/exportContractImagesToZip';
import { getContractWithBillboards } from '@/services/contractService';
import { EnhancedEditCompositeTaskCostsDialog } from './EnhancedEditCompositeTaskCostsDialog';
import { UnifiedTaskInvoice, InvoiceType } from './UnifiedTaskInvoice';
import { CompositeTaskWithDetails, UpdateCompositeTaskCostsInput } from '@/types/composite-task';
import { CreatePrintTaskFromInstallation } from '../tasks/CreatePrintTaskFromInstallation';
import { TaskDesignManager } from '../tasks/TaskDesignManager';
import { BulkDesignAssigner } from '../tasks/BulkDesignAssigner';
import { UnifiedPrintAllDialog, BillboardPrintItem } from '../shared/printing/UnifiedPrintAllDialog';
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

const isEnabledContractFlag = (value: unknown): boolean =>
  value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';

interface InstallationWorkflowData {
  primaryTaskId: string;
  taskIds: string[];
  items: any[];
  designs: any[];
  billboards: Record<number, any>;
  installationTasks: any[];
  teamNames?: Record<string, string>;
}

const fetchInstallationWorkflowData = async (
  primaryTaskId: string,
  relatedTaskIds: string[],
): Promise<InstallationWorkflowData> => {
  const taskIds = [...new Set([primaryTaskId, ...relatedTaskIds].filter(Boolean))];
  const [itemsResult, designsResult, tasksResult, teamsResult] = await Promise.all([
    supabase
      .from('installation_task_items')
      .select('*')
      .in('task_id', taskIds),
    supabase
      .from('task_designs')
      .select('*')
      .in('task_id', taskIds)
      .order('design_order', { ascending: true }),
    supabase
      .from('installation_tasks')
      .select('id, team_id, contract_id, task_type, reinstallation_number')
      .in('id', taskIds),
    supabase
      .from('installation_teams')
      .select('id, team_name'),
  ]);

  if (itemsResult.error) throw itemsResult.error;
  if (designsResult.error) throw designsResult.error;
  if (tasksResult.error) throw tasksResult.error;

  const teamNames: Record<string, string> = {};
  (teamsResult.data || []).forEach((tm: any) => {
    if (tm.id && tm.team_name) teamNames[tm.id] = tm.team_name;
  });

  const items = itemsResult.data || [];
  const billboardIds = [...new Set(items.map((item: any) => Number(item.billboard_id)).filter(Boolean))];
  const billboardResult = billboardIds.length > 0
    ? await supabase.from('billboards').select('*').in('ID', billboardIds)
    : { data: [], error: null };
  if (billboardResult.error) throw billboardResult.error;

  const billboards = Object.fromEntries(
    (billboardResult.data || []).map((billboard: any) => [Number(billboard.ID), billboard]),
  );
  const seenDesigns = new Set<string>();
  const designs = (designsResult.data || []).filter((design: any) => {
    const key = design.design_face_a_url || design.id;
    if (seenDesigns.has(key)) return false;
    seenDesigns.add(key);
    return true;
  });

  return {
    primaryTaskId,
    taskIds,
    items,
    designs,
    billboards,
    installationTasks: tasksResult.data || [],
    teamNames,
  };
};

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

/* ── Color Extraction Helper ── */
const extractDualPaletteFromImage = (url: string, callback: (colors: [string, string] | null) => void) => {
  if (!url) return callback(null);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return callback(null);
      canvas.width = 40;
      canvas.height = 40;
      ctx.drawImage(img, 0, 0, 40, 40);
      const data = ctx.getImageData(0, 0, 40, 40).data;
      
      const buckets: { r: number; g: number; b: number; count: number; sat: number }[] = [];
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
        if (a < 128) continue;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const br = (r + g + b) / 3;
        const sat = max === 0 ? 0 : (max - min) / max;
        // Ignore extreme blacks/whites
        if (br < 25 || br > 235) continue;
        
        let found = false;
        for (const bucket of buckets) {
          const dist = Math.abs(bucket.r - r) + Math.abs(bucket.g - g) + Math.abs(bucket.b - b);
          if (dist < 45) {
            bucket.r = Math.round((bucket.r * bucket.count + r) / (bucket.count + 1));
            bucket.g = Math.round((bucket.g * bucket.count + g) / (bucket.count + 1));
            bucket.b = Math.round((bucket.b * bucket.count + b) / (bucket.count + 1));
            bucket.count++;
            found = true;
            break;
          }
        }
        if (!found && buckets.length < 20) {
          buckets.push({ r, g, b, count: 1, sat });
        }
      }
      
      if (buckets.length === 0) return callback(null);
      
      // Sort by score (count * saturation)
      buckets.sort((a, b) => (b.count * (1 + b.sat * 2.5)) - (a.count * (1 + a.sat * 2.5)));
      
      const c1 = `${buckets[0].r}, ${buckets[0].g}, ${buckets[0].b}`;
      let c2: string;
      if (buckets.length > 1) {
        let secondBucket = buckets[1];
        for (let i = 1; i < buckets.length; i++) {
          const dist = Math.abs(buckets[0].r - buckets[i].r) + Math.abs(buckets[0].g - buckets[i].g) + Math.abs(buckets[0].b - buckets[i].b);
          if (dist > 55) {
            secondBucket = buckets[i];
            break;
          }
        }
        c2 = `${secondBucket.r}, ${secondBucket.g}, ${secondBucket.b}`;
      } else {
        const r2 = Math.min(255, Math.round(buckets[0].r * 0.7 + 40));
        const g2 = Math.min(255, Math.round(buckets[0].g * 0.8 + 30));
        const b2 = Math.min(255, Math.round(buckets[0].b * 1.2 + 20));
        c2 = `${r2}, ${g2}, ${b2}`;
      }
      
      callback([c1, c2]);
    } catch {
      callback(null);
    }
  };
  img.onerror = () => callback(null);
  img.src = url;
};

/* ── Design Panel ── */
const DesignPanel = ({
  urls, accent, label = 'التصميم', onColorExtracted, onDualColorExtracted,
}: { 
  urls: string[]; 
  accent: string; 
  label?: string;
  onColorExtracted?: (c: string | null) => void;
  onDualColorExtracted?: (palette: [string, string] | null) => void;
}) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const url = urls[currentIdx % urls.length] || '';

  useEffect(() => {
    if (!url) return;
    extractDualPaletteFromImage(url, (palette) => {
      if (palette) {
        onColorExtracted?.(palette[0]);
        onDualColorExtracted?.(palette);
      } else {
        onColorExtracted?.(null);
        onDualColorExtracted?.(null);
      }
    });
  }, [url]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIdx(prev => (prev - 1 + urls.length) % urls.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIdx(prev => (prev + 1) % urls.length);
  };

  return (
    <>
      <div
        className="relative flex-shrink-0 overflow-hidden h-full cursor-pointer group/design select-none"
        style={{ width: '100%', minHeight: '100%' }}
        onClick={() => url && setLightboxOpen(true)}
      >
        {url ? (
          <>
            <div className="absolute inset-0">
              <img src={url} alt="" className="w-full h-full object-cover scale-150 blur-xl opacity-40" aria-hidden="true" />
              <div className="absolute inset-0 bg-black/35 group-hover/design:bg-black/15 transition-colors duration-200" />
            </div>
            <img 
              src={url} 
              alt={label}
              className="relative w-full h-full object-contain z-10 p-2 transition-transform duration-300 group-hover/design:scale-105" 
              style={{ minHeight: '100%' }} 
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} 
            />

            {/* Quick Hover Action Bar */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/design:opacity-100 transition-all duration-200 z-20 flex flex-col items-center justify-center gap-2 p-2 pointer-events-none">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/95 text-black font-black text-xs shadow-xl backdrop-blur-md transform scale-95 group-hover/design:scale-100 transition-transform">
                <Maximize2 className="w-3.5 h-3.5" />
                <span>عرض وتكبير</span>
              </span>
            </div>

            {/* Carousel navigation buttons for multiple designs */}
            {urls.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrev}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 z-30 h-7 w-7 rounded-full bg-black/75 text-white flex items-center justify-center opacity-0 group-hover/design:opacity-100 transition-opacity hover:bg-black/90 cursor-pointer shadow-md"
                  aria-label="التصميم السابق"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="absolute left-1.5 top-1/2 -translate-y-1/2 z-30 h-7 w-7 rounded-full bg-black/75 text-white flex items-center justify-center opacity-0 group-hover/design:opacity-100 transition-opacity hover:bg-black/90 cursor-pointer shadow-md"
                  aria-label="التصميم التالي"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 flex gap-1.5 bg-black/60 px-2 py-1 rounded-full backdrop-blur-md">
                  {urls.map((_, i) => (
                    <button 
                      type="button"
                      key={i} 
                      onClick={(e) => { e.stopPropagation(); setCurrentIdx(i); }}
                      className="h-2 w-2 rounded-full transition-all cursor-pointer"
                      style={{
                        backgroundColor: i === currentIdx % urls.length ? '#d6ac40' : 'rgba(255,255,255,0.4)',
                        transform: i === currentIdx % urls.length ? 'scale(1.3)' : 'scale(1)',
                      }}
                      aria-label={`عرض التصميم ${i + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
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

      {/* Enhanced Lightbox Modal */}
      {lightboxOpen && url && createPortal(
        <div 
          className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-lg flex flex-col items-center justify-center p-4 animate-in fade-in duration-200" 
          onClick={() => setLightboxOpen(false)}
        >
          {/* Header Controls */}
          <div className="absolute top-4 inset-x-4 z-50 flex items-center justify-between pointer-events-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <span className="rounded-xl border border-white/15 bg-black/60 px-3.5 py-1.5 text-xs font-black text-amber-300 backdrop-blur-md">
                {urls.length > 1 ? `${label} ${((currentIdx % urls.length) + 1)} من ${urls.length}` : `معاينة ${label}`}
              </span>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/15 bg-black/60 px-3 text-xs font-bold text-white transition-all hover:bg-white/15 backdrop-blur-md"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>فتح بالحجم الكامل</span>
              </a>
            </div>
            <button 
              onClick={() => setLightboxOpen(false)} 
              className="h-10 w-10 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-full flex items-center justify-center text-white shadow-2xl border-2 border-white/30 transition-all hover:scale-110 cursor-pointer"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" strokeWidth={2.5} />
            </button>
          </div>

          {/* Navigation Controls in Lightbox */}
          {urls.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrev}
                className="absolute right-6 top-1/2 -translate-y-1/2 z-50 h-12 w-12 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-amber-500 hover:text-black transition-all cursor-pointer border border-white/20 shadow-2xl"
                aria-label="التصميم السابق"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="absolute left-6 top-1/2 -translate-y-1/2 z-50 h-12 w-12 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-amber-500 hover:text-black transition-all cursor-pointer border border-white/20 shadow-2xl"
                aria-label="التصميم التالي"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            </>
          )}

          {/* Main Image */}
          <img 
            src={url} 
            alt={`معاينة ${label}`}
            className="max-w-[92vw] max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10" 
            onClick={e => e.stopPropagation()} 
          />
        </div>, 
        document.body
      )}
    </>
  );
};


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
    {
      key: 'print-installation',
      label: 'طباعة مهمة التركيب',
      icon: Printer,
      onClick: () => onPrintInstallationTask(task),
      primary: false,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.02, ease: 'easeOut' }}
      className="group relative rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-lg bg-card/60"
      style={{ background: cardBg, border: cardBorder }}
    >
      {/* Desktop & Laptop layout */}
      <div className="hidden lg:grid grid-cols-[180px_minmax(230px,1.2fr)_195px_180px_210px] items-stretch min-h-[200px]">
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="col-span-2 inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border/40 bg-muted/40 px-2 text-[11px] font-black text-muted-foreground transition-all duration-200 hover:bg-muted/70 hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  aria-label="المزيد من الإجراءات"
                >
                  <MoreHorizontal className="h-4 w-4" />
                  المزيد
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 text-right font-tajawal rounded-xl border-border/40 shadow-xl" dir="rtl">
                {task.installation_task_id && (
                  <DropdownMenuItem onClick={() => onOpenInstallationTask(task)} className="gap-2 cursor-pointer text-xs font-bold">
                    <Wrench className="h-3.5 w-3.5 text-amber-400" />
                    <span>فتح وإدارة المهمة</span>
                  </DropdownMenuItem>
                )}
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
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
            {task.installation_task_id && (
              <button
                onClick={() => onOpenInvoice(task, 'installation_team')}
                className="flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-teal-500/20 bg-teal-500/10 px-3 text-xs font-black text-teal-400 transition-all duration-200 hover:bg-teal-500/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60"
              >
                <Users className="h-3.5 w-3.5" />
                <span>الفرقة</span>
              </button>
            )}
            <button
              onClick={() => onDelete(task)}
              className="flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 text-xs font-black text-rose-400 transition-all duration-200 hover:bg-rose-500/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60"
              aria-label="حذف"
            >
              <Trash2 className="h-3.5 w-3.5" />
              حذف
            </button>
        </div>
      </div>
    </motion.div>
  );
};

/* ── Contract Group Card Component with Dual-Color Dynamic Theme ── */
const ContractGroupCard = ({
  group,
  isCollapsed,
  toggleGroupCollapse,
  activeOperation,
  expandedOperations,
  toggleOperationExpansion,
  zipDownloadingGroup,
  handleDownloadGroupZip,
  handleCreatePrintTasksForGroup,
  discountPopoverGroup,
  setDiscountPopoverGroup,
  discountAmount,
  setDiscountAmount,
  discountReason,
  setDiscountReason,
  discountTarget,
  setDiscountTarget,
  discountSaving,
  handleSaveDiscount,
  setGroupInvoiceTasks,
  setGroupInvoiceOpen,
  setEditingOperationTasks,
  setEditingTask,
  setEditDialogOpen,
  setDeleteTask,
  setInvoiceTask,
  setInvoiceType,
  setInvoiceOpen,
  navigate,
  handleOpenCreatePrintTask,
  loadInstallationWorkflow,
  workflowLoadingTaskId,
}: any) => {
  const [groupPalette, setGroupPalette] = useState<[string, string] | null>(null);

  const c1 = groupPalette ? groupPalette[0] : null;
  const c2 = groupPalette ? groupPalette[1] : null;

  return (
    <div 
      key={group.key} 
      className="overflow-hidden rounded-3xl border transition-all duration-300 backdrop-blur-xl hover:shadow-2xl bg-card/60"
      style={{
        background: c1 && c2
          ? `linear-gradient(145deg, rgba(${c1}, 0.18) 0%, rgba(${c2}, 0.08) 50%, hsl(var(--card)/0.95) 100%)`
          : undefined,
        borderColor: c1
          ? `rgba(${c1}, 0.45)`
          : 'hsl(var(--primary)/0.25)',
        boxShadow: c1
          ? `0 14px 40px -10px rgba(${c1}, 0.28)`
          : '0 8px 30px rgba(0,0,0,0.12)',
      }}
    >
      {/* Top Accent Dual-Color Gradient Line */}
      <div 
        className="h-1.5 w-full transition-all duration-500" 
        style={{ 
          background: c1 && c2 
            ? `linear-gradient(to left, rgb(${c1}), rgb(${c2}))` 
            : 'linear-gradient(to left, hsl(var(--primary)), #d6ac40)' 
        }} 
      />

      {/* Executive Group Header */}
      <div
        className="grid cursor-pointer select-none grid-cols-1 gap-4 border-b p-4 transition-colors duration-200 sm:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)] lg:p-5"
        style={{
          borderBottomColor: c1 ? `rgba(${c1}, 0.25)` : 'hsl(var(--primary)/0.15)',
          background: c1 && c2
            ? `linear-gradient(to left, rgba(${c1}, 0.22) 0%, rgba(${c2}, 0.12) 50%, rgba(20, 20, 24, 0.85) 100%)`
            : 'linear-gradient(to left, hsl(var(--primary)/0.07), hsl(var(--card)/0.7), hsl(var(--card)/0.9))'
        }}
        onClick={() => toggleGroupCollapse(group.key)}
      >
        {/* Latest installation design — visual identifier for the contract */}
        <div 
          className="relative h-48 w-full overflow-hidden rounded-2xl border-2 shadow-md transition-all sm:h-full sm:min-h-[190px]" 
          style={{
            borderColor: c1 ? `rgba(${c1}, 0.65)` : 'rgba(214, 172, 64, 0.35)',
            boxShadow: c1 ? `0 8px 24px -4px rgba(${c1}, 0.35)` : undefined
          }}
          onClick={event => event.stopPropagation()}
        >
          <DesignPanel
            urls={group.latestInstallationUrls.length > 0 ? group.latestInstallationUrls : group.latestDesignUrls}
            accent="hsl(var(--primary))"
            label={group.latestInstallationUrls.length > 0 ? 'صورة التركيب' : 'تصميم التركيب'}
            onDualColorExtracted={setGroupPalette}
          />
          <span className="pointer-events-none absolute bottom-2 right-2 z-30 flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/75 px-2.5 py-1 text-[10px] font-black text-white shadow-md backdrop-blur-md">
            <ImageIcon className="h-3.5 w-3.5 text-amber-400" />
            {group.latestInstallationUrls.length > 0
              ? 'آخر صورة تركيب فعلية'
              : group.latestDesignUrls.length > 0
                ? 'آخر تصميم تركيب'
                : 'لا توجد صورة'}
          </span>
        </div>

        {/* Contract Details & Hero Financials */}
        <div className="min-w-0 space-y-4 text-right flex flex-col justify-between">
          {/* Top Row: Contract Label, Ad Type (Above Name), Customer & Company, Actions Toolbar */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/15 px-3 font-mono text-xs font-black text-primary">
                  <FolderOpen className="h-3.5 w-3.5" />
                  {group.label}
                </span>
                <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-400">
                  {group.operations.length} {group.operations.length === 1 ? 'عملية' : 'عمليات'}
                </span>
                {group.tasks.length > 1 && (
                  <span className="rounded-lg border border-border/40 bg-muted/50 px-2 py-1 text-[10px] font-black text-muted-foreground">{group.tasks.length} مهام</span>
                )}
              </div>

              {/* Prominent Ad Type above Customer Name */}
              <div className="flex min-w-0 items-center gap-2 pt-0.5">
                <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl border-2 border-amber-500/45 bg-amber-500/20 shadow-md">
                  <Megaphone className="h-4 w-4 shrink-0 text-amber-400" />
                  <span className="text-xs font-black text-amber-400/90">نوع الإعلان:</span>
                  <strong className="truncate text-base sm:text-lg font-black text-amber-300 tracking-tight">{group.adType || 'غير محدد'}</strong>
                </div>
              </div>

              {/* Customer & Company Name */}
              <div className="flex min-w-0 items-center gap-2 pt-0.5">
                <UserRound className="h-6 w-6 shrink-0 text-amber-400" />
                <h3 className="truncate text-2xl font-black leading-tight text-foreground sm:text-3xl tracking-tight">{group.customerName}</h3>
              </div>
              {group.companyName && (
                <div className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-muted-foreground">
                  <Building2 className="h-4 w-4 shrink-0 text-primary/80" />
                  <span className="truncate">{group.companyName}</span>
                </div>
              )}
            </div>

            {/* Top Left: Toolbar Action Buttons */}
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              {/* Costs are managed once from the contract cover, not repeated inside task rows. */}
              {activeOperation?.tasks?.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingOperationTasks(activeOperation.tasks);
                        setEditingTask(activeOperation.tasks[0]);
                        setEditDialogOpen(true);
                      }}
                      className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-primary/35 bg-primary/12 px-3 text-xs font-black text-primary transition-all duration-200 hover:bg-primary/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    >
                      <Edit className="h-4 w-4" />
                      <span className="hidden xl:inline">تعديل تكاليف العملية</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">تعديل موحد للعملية الأحدث</TooltipContent>
                </Tooltip>
              )}

              {/* ZIP Download */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    disabled={zipDownloadingGroup === group.key}
                    onClick={(e) => { e.stopPropagation(); handleDownloadGroupZip({ key: group.key, contractId: group.contractId, customerName: group.customerName }); }}
                    className="h-10 w-10 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all duration-200 cursor-pointer disabled:opacity-50 active:scale-95"
                    aria-label="تحميل ZIP"
                  >
                    {zipDownloadingGroup === group.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">تحميل صور وCSV العقد كملف ZIP</TooltipContent>
              </Tooltip>

              {/* Create Print Tasks for all group */}
              {(() => {
                const operationTasks = activeOperation?.tasks || [];
                const tasksToCreate = operationTasks.filter((t: any) => !t.print_task_id && t.installation_task_id);
                if (tasksToCreate.length === 0) return null;
                return (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleCreatePrintTasksForGroup(operationTasks)}
                        className="h-10 rounded-xl flex items-center gap-1.5 px-3 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all duration-200 text-xs font-bold cursor-pointer active:scale-95"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>إنشاء مهام طباعة ({tasksToCreate.length})</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">إنشاء مهام الطباعة للعملية الأحدث فقط</TooltipContent>
                  </Tooltip>
                );
              })()}

              {/* Discount Management Popover */}
              <Popover open={discountPopoverGroup === group.key} onOpenChange={(open) => {
                if (open) {
                  setDiscountPopoverGroup(group.key);
                  const operationTasks = activeOperation?.tasks || [];
                  const totalDiscount = operationTasks.reduce((s: number, t: any) => s + (t.discount_amount || 0), 0);
                  setDiscountAmount(totalDiscount);
                  setDiscountReason(operationTasks[0]?.discount_reason || '');
                  setDiscountTarget('all');
                } else {
                  setDiscountPopoverGroup(null);
                }
              }}>
                <PopoverTrigger asChild>
                  <button 
                    className="h-10 w-10 rounded-xl flex items-center justify-center bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all duration-200 cursor-pointer active:scale-95"
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
                        {activeOperation?.tasks.length || 0} مهمة في العملية الأحدث
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
                          {(activeOperation?.tasks || []).map((t: any, i: number) => (
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
                          {(activeOperation?.tasks || []).map((t: any, i: number) => (
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
                    <Button size="sm" className="w-full h-10 text-xs font-black mt-1 cursor-pointer" onClick={() => handleSaveDiscount(activeOperation?.tasks || [])} disabled={discountSaving}>
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
                      setGroupInvoiceTasks(activeOperation?.tasks || []);
                      setGroupInvoiceOpen(true);
                    }}
                    className="h-10 w-10 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all duration-200 cursor-pointer active:scale-95"
                    aria-label="فاتورة العملية الأحدث"
                  >
                    <FileOutput className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">فاتورة العملية الأحدث فقط، دون خلط سجل العقد</TooltipContent>
              </Tooltip>

              <button
                onClick={() => toggleGroupCollapse(group.key)}
                className="h-10 w-10 rounded-xl flex items-center justify-center hover:bg-muted/40 transition-all duration-200 text-muted-foreground cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                aria-label={isCollapsed ? 'فتح العقد وعملياته' : 'طي العقد وعملياته'}
              >
                {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Middle Row: HERO Financial & Payment Cards Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 py-1" onClick={e => e.stopPropagation()}>
            {/* 1. Contract Value */}
            <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/15 p-3.5 shadow-md hover:border-emerald-400 transition-colors flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1.5 text-xs font-black text-emerald-300">
                <span className="flex items-center gap-1.5">
                  <Coins className="h-4 w-4 text-emerald-400 shrink-0" />
                  إجمالي العقد
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md font-mono">الزبون</span>
              </div>
              <div className="font-mono text-xl sm:text-2xl font-black text-emerald-300 mt-2">
                {group.groupTotal.toLocaleString('ar-LY')} <span className="text-xs font-bold text-emerald-400/80">د.ل</span>
              </div>
            </div>

            {/* 2. Payment & Remaining Status Card */}
            <div className={cn(
              "rounded-2xl border-2 p-3.5 shadow-md transition-colors flex flex-col justify-between",
              group.groupTotal === 0
                ? "border-slate-500/30 bg-slate-500/10 text-slate-300"
                : group.groupPaid >= group.groupTotal
                ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-300"
                : group.groupPaid > 0
                ? "border-amber-500/40 bg-amber-950/30 text-amber-300"
                : "border-rose-500/40 bg-rose-950/30 text-rose-300"
            )}>
              <div className="flex items-center justify-between text-xs font-black">
                <span className="flex items-center gap-1.5">
                  <Wallet className="h-4 w-4 shrink-0" />
                  حالة السداد ({group.groupPaymentPercentage}%)
                </span>
                <span className={cn(
                  "text-[10px] font-black px-2 py-0.5 rounded-md border",
                  group.groupTotal === 0
                    ? "bg-slate-500/20 text-slate-300 border-slate-500/40"
                    : group.groupPaid >= group.groupTotal
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : group.groupPaid > 0
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                )}>
                  {group.groupTotal === 0 ? "مجانية" : group.groupPaid >= group.groupTotal ? "مسدد بالكامل" : group.groupPaid > 0 ? "مسدد جزئياً" : "غير مسدد"}
                </span>
              </div>
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-muted-foreground/80">المدفوع: {group.groupPaid.toLocaleString('ar-LY')} د.ل</span>
                  {group.groupTotal > 0 && group.groupRemaining > 0 && (
                    <span className="font-black text-rose-400 font-mono">متبقي {group.groupRemaining.toLocaleString('ar-LY')} د.ل</span>
                  )}
                </div>
                {group.groupTotal > 0 && (
                  <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        group.groupPaid >= group.groupTotal ? "bg-emerald-500" : group.groupPaid > 0 ? "bg-amber-500" : "bg-rose-500"
                      )}
                      style={{ width: `${group.groupPaymentPercentage}%` }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 3. Company Cost */}
            <div className="rounded-2xl border-2 border-amber-500/40 bg-amber-500/15 p-3.5 shadow-md hover:border-amber-400 transition-colors flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1.5 text-xs font-black text-amber-300">
                <span className="flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-amber-400 shrink-0" />
                  تكلفة التنفيذ
                </span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md font-mono">الشركة</span>
              </div>
              <div className="font-mono text-xl sm:text-2xl font-black text-amber-300 mt-2">
                {group.groupCost.toLocaleString('ar-LY')} <span className="text-xs font-bold text-amber-400/80">د.ل</span>
              </div>
            </div>

            {/* 4. Profit */}
            <div className={`rounded-2xl border-2 p-3.5 shadow-md transition-colors flex flex-col justify-between ${group.groupProfit >= 0 ? 'border-emerald-500/50 bg-emerald-500/20 hover:border-emerald-400' : 'border-rose-500/50 bg-rose-500/20 hover:border-rose-400'}`}>
              <div className={`flex items-center justify-between gap-1.5 text-xs font-black ${group.groupProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                <span className="flex items-center gap-1.5">
                  {group.groupProfit >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-400 shrink-0" /> : <TrendingDown className="h-4 w-4 text-rose-400 shrink-0" />}
                  صافي الربح
                </span>
                <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-md font-mono">
                  {group.groupTotal > 0 ? `${((group.groupProfit / group.groupTotal) * 100).toFixed(0)}%` : '0%'}
                </span>
              </div>
              <div className={`font-mono text-xl sm:text-2xl font-black mt-2 ${group.groupProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {group.groupProfit.toLocaleString('ar-LY')} <span className="text-xs font-bold opacity-80">د.ل</span>
              </div>
            </div>
          </div>

          {/* Bottom Row: Execution Teams & Date */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t" style={{ borderTopColor: c1 ? `rgba(${c1}, 0.2)` : 'hsl(var(--primary)/0.15)' }}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">فرق التنفيذ:</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {group.teamNames.map((teamName: string, teamIndex: number) => (
                <span key={teamIndex} className="inline-flex h-7 items-center gap-1 rounded-lg border border-blue-500/20 bg-blue-500/10 px-2 text-[10px] font-bold text-blue-400">
                  <Wrench className="h-3 w-3" />{teamName}
                </span>
              ))}
              {group.printerNames.map((printerName: string, printerIndex: number) => (
                <span key={printerIndex} className="inline-flex h-7 items-center gap-1 rounded-lg border border-violet-500/20 bg-violet-500/10 px-2 text-[10px] font-bold text-violet-400">
                  <Printer className="h-3 w-3" />{printerName}
                </span>
              ))}
              {group.latestActivity && (
                <span className="inline-flex h-7 items-center gap-1 text-[10px] font-bold text-muted-foreground">
                  <CalendarDays className="h-3 w-3" />آخر نشاط {format(new Date(group.latestActivity), 'dd/MM/yyyy', { locale: ar })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Group Tasks Cards Container */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-4 bg-muted/5 p-3">
              {group.operations.map((operation: any, operationIndex: number) => {
                const operationExpansionKey = `${group.key}::${operation.key}`;
                const isOperationExpanded = expandedOperations.has(operationExpansionKey);
                const operationCustomerTotal = operation.tasks.reduce((sum: number, operationTask: any) => sum + (operationTask.customer_total || 0), 0);
                const operationCompanyTotal = operation.tasks.reduce((sum: number, operationTask: any) => sum + (operationTask.company_total || 0), 0);
                const operationProfit = operationCustomerTotal - operationCompanyTotal;
                const operationInstallCost = operation.tasks.reduce((sum: number, operationTask: any) => sum + (operationTask.company_installation_cost || 0), 0);
                const operationPrintCost = operation.tasks.reduce((sum: number, operationTask: any) => sum + (operationTask.company_print_cost || 0), 0);
                const operationCutoutCost = operation.tasks.reduce((sum: number, operationTask: any) => sum + (operationTask.company_cutout_cost || 0), 0);
                const operationTeams = [...new Set(operation.tasks.map((operationTask: any) => operationTask.teamName).filter(Boolean))];

                return (
                <section key={operation.key} className="overflow-hidden rounded-2xl border border-border/35 bg-background/35 shadow-sm">
                  <div className="flex flex-col gap-3 border-b border-border/25 bg-amber-500/5 p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => toggleOperationExpansion(operationExpansionKey)}
                        className="flex min-h-10 min-w-0 flex-1 cursor-pointer flex-wrap items-center gap-2 rounded-xl px-1 text-right transition-colors hover:bg-amber-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                        aria-expanded={isOperationExpanded}
                        aria-label={`${isOperationExpanded ? 'طي' : 'فتح'} ${operation.label}`}
                      >
                        <span className="inline-flex h-8 items-center rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 text-xs font-black text-amber-300">
                          {operation.label}
                        </span>
                        {operationIndex === 0 && (
                          <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-400">
                            العملية الأحدث
                          </span>
                        )}
                        
                        {/* Prominent Operation Value in Bar */}
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border-2 border-emerald-400/60 bg-emerald-500/20 shadow-sm mr-1">
                          <Coins className="h-4 w-4 text-emerald-400 shrink-0" />
                          <span className="text-[11px] font-black text-emerald-200">قيمة العملية:</span>
                          <span className="font-mono text-sm sm:text-base font-black text-emerald-300">
                            {operationCustomerTotal.toLocaleString('ar-LY')} د.ل
                          </span>
                        </div>

                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          {operationTeams.length || operation.tasks.length} {operationTeams.length === 1 || (!operationTeams.length && operation.tasks.length === 1) ? 'فريق تنفيذ' : 'فرق تنفيذ'}
                        </span>
                        {operation.createdAt && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground/80">
                            <CalendarDays className="h-3 w-3" />
                            {format(new Date(operation.createdAt), 'dd/MM/yyyy', { locale: ar })}
                          </span>
                        )}
                        {isOperationExpanded ? <ChevronUp className="mr-auto h-4 w-4 text-amber-300" /> : <ChevronDown className="mr-auto h-4 w-4 text-amber-300" />}
                      </button>
                      <div className="flex items-center gap-2">
                        {/* فاتورة العملية */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => {
                                setGroupInvoiceTasks(operation.tasks);
                                setGroupInvoiceOpen(true);
                              }}
                              className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 text-[11px] font-black text-amber-300 transition-all duration-200 hover:bg-amber-500/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                              aria-label={`فاتورة ${operation.label}`}
                            >
                              <FileOutput className="h-3.5 w-3.5" />
                              فاتورة العملية
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">تشمل هذه العملية فقط ولا تضم عمليات العقد السابقة</TooltipContent>
                        </Tooltip>

                        {/* 3. طباعة مهمة التركيب لجميع الفرق مع فلترة الفرق */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => {
                                const allInstallTaskIds = operation.tasks
                                  .map((t: any) => t.installation_task_id)
                                  .filter(Boolean);
                                if (allInstallTaskIds.length === 0) {
                                  toast.error('لا توجد مهام تركيب مرتبطة بهذه العملية');
                                  return;
                                }
                                loadInstallationWorkflow(
                                  operation.tasks[0],
                                  allInstallTaskIds,
                                  'print'
                                );
                              }}
                              className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-blue-500/35 bg-blue-500/15 px-3.5 text-[11px] font-black text-blue-300 transition-all duration-200 hover:bg-blue-500/25 hover:border-blue-500/50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 shadow-xs"
                              aria-label={`طباعة مهمة التركيب لجميع فرق ${operation.label}`}
                            >
                              <Printer className="h-3.5 w-3.5 text-blue-400" />
                              <span>طباعة مهمة التركيب</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">طباعة شاملة لمهمة التركيب لجميع الفرق مع إمكانية اختيار الفرق كلها أو إلغاء</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
                      {/* HERO CARD: Operation Value (Max Prominence) */}
                      <div className="rounded-2xl border-2 border-emerald-400/70 bg-emerald-500/25 p-4 shadow-lg shadow-emerald-500/15 hover:border-emerald-300 transition-all text-right ring-2 ring-emerald-400/20">
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-emerald-200">
                          <Coins className="h-5 w-5 text-emerald-400 shrink-0" />
                          <span>قيمة العملية (الزبون)</span>
                        </div>
                        <div className="mt-1 font-mono text-2xl sm:text-3xl font-black text-emerald-300 tracking-tight drop-shadow-sm">
                          {operationCustomerTotal.toLocaleString('ar-LY')} <span className="text-sm font-bold text-emerald-300/80">د.ل</span>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-amber-500/35 bg-amber-500/15 p-3.5 shadow-sm hover:border-amber-500/50 transition-colors text-right">
                        <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
                          <DollarSign className="h-4 w-4 text-amber-400 shrink-0" />
                          <span>تكلفة التنفيذ</span>
                        </div>
                        <div className="mt-1 font-mono text-lg sm:text-xl font-black text-amber-300">
                          {operationCompanyTotal.toLocaleString('ar-LY')} <span className="text-xs font-bold text-amber-400/80">د.ل</span>
                        </div>
                      </div>

                      <div className={`rounded-2xl border p-3.5 shadow-sm transition-colors text-right ${operationProfit >= 0 ? 'border-emerald-500/40 bg-emerald-500/20 hover:border-emerald-500/60' : 'border-rose-500/40 bg-rose-500/20 hover:border-rose-500/60'}`}>
                        <div className={`flex items-center gap-1.5 text-xs font-black ${operationProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {operationProfit >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-400 shrink-0" /> : <TrendingDown className="h-4 w-4 text-rose-400 shrink-0" />}
                          <span>صافي الربح</span>
                        </div>
                        <div className={`mt-1 font-mono text-lg sm:text-xl font-black ${operationProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {operationProfit.toLocaleString('ar-LY')} <span className="text-xs font-bold opacity-80">د.ل</span>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-blue-500/30 bg-blue-500/12 p-3.5 shadow-sm hover:border-blue-500/45 transition-colors text-right">
                        <div className="flex items-center gap-1.5 text-xs font-black text-blue-300">
                          <Wrench className="h-4 w-4 text-blue-400 shrink-0" />
                          <span>تركيب</span>
                        </div>
                        <div className="mt-1 font-mono text-base sm:text-lg font-black text-blue-200">
                          {operationInstallCost.toLocaleString('ar-LY')} <span className="text-xs font-bold text-blue-400/80">د.ل</span>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-purple-500/30 bg-purple-500/12 p-3.5 shadow-sm hover:border-purple-500/45 transition-colors text-right">
                        <div className="flex items-center gap-1.5 text-xs font-black text-purple-300">
                          <Printer className="h-4 w-4 text-purple-400 shrink-0" />
                          <span>طباعة</span>
                        </div>
                        <div className="mt-1 font-mono text-base sm:text-lg font-black text-purple-200">
                          {operationPrintCost.toLocaleString('ar-LY')} <span className="text-xs font-bold text-purple-400/80">د.ل</span>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/12 p-3.5 shadow-sm hover:border-amber-500/45 transition-colors text-right">
                        <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
                          <Scissors className="h-4 w-4 text-amber-400 shrink-0" />
                          <span>قص</span>
                        </div>
                        <div className="mt-1 font-mono text-base sm:text-lg font-black text-amber-200">
                          {operationCutoutCost.toLocaleString('ar-LY')} <span className="text-xs font-bold text-amber-400/80">د.ل</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <AnimatePresence initial={false}>
                    {isOperationExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col gap-3 p-3">
                          {operation.tasks.map((task: any, idx: number) => (
                            <TaskCardRow
                              key={task.id}
                              task={task}
                              idx={idx}
                              operationInstallationTaskIds={operation.tasks
                                .map((operationTask: any) => operationTask.installation_task_id)
                                .filter(Boolean)}
                              onDelete={(t: any) => setDeleteTask(t)}
                              onOpenInvoice={(t: any, type: InvoiceType) => { setInvoiceTask(t); setInvoiceType(type); setInvoiceOpen(true); }}
                              onNavigateToPayment={(distId: string, custId: string, custName: string) => {
                                navigate(`/admin/customer-billing?id=${custId}&name=${encodeURIComponent(custName)}&highlight_payment=${distId}`);
                              }}
                              onCreatePrintTask={handleOpenCreatePrintTask}
                              onManageDesigns={(workflowTask: any, relatedTaskIds: string[]) => {
                                loadInstallationWorkflow(workflowTask, relatedTaskIds, 'designs');
                              }}
                              onDistributeDesigns={(workflowTask: any, relatedTaskIds: string[]) => {
                                loadInstallationWorkflow(workflowTask, relatedTaskIds, 'distribution');
                              }}
                              onPrintInstallationTask={(workflowTask: any) => {
                                loadInstallationWorkflow(workflowTask, [workflowTask.installation_task_id], 'print');
                              }}
                              onOpenInstallationTask={(workflowTask: any) => {
                                navigate(`/admin/installation-tasks?task=${encodeURIComponent(workflowTask.installation_task_id)}&from=hub`);
                              }}
                              workflowBusy={workflowLoadingTaskId === task.installation_task_id}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
    page: 1,
  });
  const [search, _setSearch] = useState(persistedFilters.search);
  const [filterStatus, _setFilterStatus] = useState(persistedFilters.filterStatus);
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'unpaid' | 'partial' | 'paid' | 'free'>('all');
  const [page, _setPage] = useState(persistedFilters.page as number);
  const setSearch = (v: string) => { _setSearch(v); setPersisted('search', v); };
  const setFilterStatus = (v: string) => { _setFilterStatus(v); setPersisted('filterStatus', v); };
  const setPage = (v: number) => { _setPage(v); setPersisted('page', v); };
  const [editingTask, setEditingTask] = useState<CompositeTaskWithDetails | null>(null);
  const [editingOperationTasks, setEditingOperationTasks] = useState<CompositeTaskWithDetails[] | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [invoiceTask, setInvoiceTask] = useState<any>(null);
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('customer');
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [deleteTask, setDeleteTask] = useState<any>(null);
  const [groupInvoiceTasks, setGroupInvoiceTasks] = useState<any[] | null>(null);
  const [groupInvoiceOpen, setGroupInvoiceOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [expandedOperations, setExpandedOperations] = useState<Set<string>>(new Set());
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
  const [installationWorkflowData, setInstallationWorkflowData] = useState<InstallationWorkflowData | null>(null);
  const [installationWorkflowTask, setInstallationWorkflowTask] = useState<any>(null);
  const [workflowLoadingTaskId, setWorkflowLoadingTaskId] = useState<string | null>(null);
  const [designManagerOpen, setDesignManagerOpen] = useState(false);
  const [designDistributionOpen, setDesignDistributionOpen] = useState(false);
  const [installationPrintOpen, setInstallationPrintOpen] = useState(false);

  const loadInstallationWorkflow = useCallback(async (
    task: any,
    relatedTaskIds: string[],
    action: 'designs' | 'distribution' | 'print',
  ) => {
    const primaryTaskId = task.installation_task_id as string | undefined;
    if (!primaryTaskId) {
      toast.error('لا توجد مهمة تركيب مرتبطة');
      return;
    }

    const taskIds = (relatedTaskIds && relatedTaskIds.length > 0)
      ? [...new Set([primaryTaskId, ...relatedTaskIds].filter(Boolean))]
      : [primaryTaskId];
    const queryKey = ['installation-workflow', ...taskIds.sort()];

    setWorkflowLoadingTaskId(primaryTaskId);
    try {
      const data = await queryClient.fetchQuery({
        queryKey,
        queryFn: () => fetchInstallationWorkflowData(primaryTaskId, taskIds),
        staleTime: 30_000,
      });
      setInstallationWorkflowData(data);
      setInstallationWorkflowTask(task);

      if (action === 'designs') {
        setDesignManagerOpen(true);
      } else if (action === 'distribution') {
        if (data.designs.length === 0) {
          toast.info('أضف تصميمًا أولًا ثم وزعه على اللوحات');
          setDesignManagerOpen(true);
        } else {
          setDesignDistributionOpen(true);
        }
      } else {
        if (data.items.length === 0) {
          toast.info('لا توجد لوحات داخل مهمة التركيب');
          return;
        }
        setInstallationPrintOpen(true);
      }
    } catch (error: any) {
      toast.error(error?.message || 'تعذر تحميل بيانات مهمة التركيب');
    } finally {
      setWorkflowLoadingTaskId(null);
    }
  }, [queryClient]);

  const refreshInstallationWorkflow = useCallback(async () => {
    if (!installationWorkflowData) return;
    const queryKey = ['installation-workflow', ...[...installationWorkflowData.taskIds].sort()];
    await queryClient.invalidateQueries({ queryKey });
    const refreshed = await queryClient.fetchQuery({
      queryKey,
      queryFn: () => fetchInstallationWorkflowData(
        installationWorkflowData.primaryTaskId,
        installationWorkflowData.taskIds,
      ),
    });
    setInstallationWorkflowData(refreshed);
    queryClient.invalidateQueries({ queryKey: ['composite-task-extras'] });
    queryClient.invalidateQueries({ queryKey: ['composite-tasks'] });
  }, [installationWorkflowData, queryClient]);

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

      // Fetch contract and reinstallation info strictly from installation tasks (not physical billboard records)
      const installationTaskIds = Array.from(
        new Set(tasks.map(t => t.installation_task_id).filter((id): id is string => Boolean(id)))
      );

      if (installationTaskIds.length > 0) {
        const { data: installTasksData } = await supabase
          .from('installation_tasks')
          .select('id, task_type, reinstallation_number, contract_id')
          .in('id', installationTaskIds);

        const reinstallInfoMap = new Map<string, { number: number | null; taskType: string; contractId: number | null }>();
        (installTasksData || []).forEach((it: any) => {
          reinstallInfoMap.set(it.id, { 
            number: it.reinstallation_number, 
            taskType: normalizeCompositeTaskType(it.task_type),
            contractId: normalizeContractId(it.contract_id)
          });
        });

        tasks.forEach((t: any) => {
          const reinstallInfo = t.installation_task_id ? reinstallInfoMap.get(t.installation_task_id) : undefined;
          const directContract = normalizeContractId(t.contract_id) || reinstallInfo?.contractId;
          const normalizedTaskType = normalizeCompositeTaskType(reinstallInfo?.taskType || t.task_type);
          
          t._contractIds = directContract ? [directContract] : [];
          t._reinstallationNumber = normalizedTaskType === 'reinstallation'
            ? (reinstallInfo?.number ?? null)
            : null;
          t._taskType = normalizedTaskType;
          if (!t.contract_id && directContract) {
            t.contract_id = directContract;
          }
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
        taskDesignCount: number;
        installationItemCount: number;
        assignedDesignCount: number;
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
          .select('task_id, design_face_a, design_face_b, selected_design_id, installed_image_face_a_url, installed_image_face_b_url')
            .in('task_id', installIds)
            .then(({ data }) => { installDesigns = data || []; })
        );
        promises.push(
          supabase.from('task_designs')
            .select('id, task_id, design_face_a_url, design_face_b_url')
            .in('task_id', installIds)
            .then(({ data }) => { taskDesignsData = data || []; })
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
          .select('"Contract_Number", "Ad Type", "Customer Name", customer_id, include_installation_in_price, include_print_in_billboard_price')
          .in('Contract_Number', finalUniqueContractIds);
        contracts = contractsData || [];
      }

      const contractCandidates: ContractAdTypeCandidate[] = contracts.map((contract: any) => ({
        contractNumber: contract.Contract_Number,
        adType: contract['Ad Type'] || contract.ad_type || '',
        customerId: contract.customer_id,
        customerName: contract['Customer Name'],
        includeInstallation: isEnabledContractFlag(contract.include_installation_in_price),
        includePrint: isEnabledContractFlag(contract.include_print_in_billboard_price),
      }));

      const contractInclusionMap = new Map<number, { includeInstall: boolean; includePrint: boolean }>();
      contracts.forEach((c: any) => {
        if (c.Contract_Number) {
          contractInclusionMap.set(Number(c.Contract_Number), {
            includeInstall: isEnabledContractFlag(c.include_installation_in_price),
            includePrint: isEnabledContractFlag(c.include_print_in_billboard_price),
          });
        }
      });

      const teamNameMap = new Map<string, string>();
      const reinstallMap = new Map<string, number | null>();
      const contractByInstallTaskId = new Map<string, number>();
      const taskTypeByInstallTaskId = new Map<string, string>();

      installTasks.forEach((t: any) => { 
        teamNameMap.set(t.id, t.team?.team_name || ''); 
        taskTypeByInstallTaskId.set(t.id, normalizeCompositeTaskType(t.task_type));
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
          const itemCost = getCurrentOperationInstallationCost(
            item,
            taskTypeByInstallTaskId.get(item.task_id),
          );
          
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

        // Resolve definitive contract ID for this task strictly without contaminating from unrelated contracts
        const directC = normalizeContractId(task.contract_id) || (task.installation_task_id ? contractByInstallTaskId.get(task.installation_task_id) : null);
        const candidateContractIds: number[] = directC ? [directC] : [];
        if (candidateContractIds.length === 0 && Array.isArray((task as any)._contractIds)) {
          (task as any)._contractIds.forEach((cid: unknown) => {
            const c = normalizeContractId(cid);
            if (c && !candidateContractIds.includes(c)) candidateContractIds.push(c);
          });
        }

        // Task designs are the authoritative visuals for installation work.
        if (task.installation_task_id) {
          taskDesignsData
            .filter((design: any) => design.task_id === task.installation_task_id)
            .forEach((design: any) => {
              if (design.design_face_a_url && !seen.has(design.design_face_a_url)) {
                seen.add(design.design_face_a_url);
                urls.push(design.design_face_a_url);
              }
              if (design.design_face_b_url && !seen.has(design.design_face_b_url)) {
                seen.add(design.design_face_b_url);
                urls.push(design.design_face_b_url);
              }
            });
        }

        // Contract designs are a fallback when the operation has no dedicated design yet.
        if (urls.length === 0) {
        candidateContractIds.forEach(cId => {
          const contractUrls = contractDesignMap.get(cId) || [];
          contractUrls.forEach(u => {
            if (!seen.has(u)) {
              seen.add(u);
              urls.push(u);
            }
          });
        });
        }

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

        const installationImages = task.installation_task_id
          ? installDesigns
              .filter((item: any) => item.task_id === task.installation_task_id)
              .flatMap((item: any) => [item.installed_image_face_a_url, item.installed_image_face_b_url])
              .filter((url: unknown): url is string => typeof url === 'string' && url.trim().length > 0)
          : [];

        extras[task.id] = {
          designUrls: urls.slice(0, 4),
          installationImages: [...new Set(installationImages)],
          contractIds: candidateContractIds,
          adTypes: taskAdTypes,
          adType: taskAdTypes.length > 0 ? taskAdTypes.join(' / ') : '',
          teamName: task.installation_task_id ? teamNameMap.get(task.installation_task_id) || '' : '',
          reinstallationNumber: task.installation_task_id ? reinstallMap.get(task.installation_task_id) ?? null : null,
          printerName: task.print_task_id ? printerNameMap.get(task.print_task_id) || '' : '',
          realInstallCost: task.installation_task_id
            ? (realInstallCostMap.get(task.installation_task_id) ?? Number(task.customer_installation_cost || 0))
            : Number(task.customer_installation_cost || 0),
          taskDesignCount: task.installation_task_id
            ? taskDesignsData.filter((design: any) => design.task_id === task.installation_task_id).length
            : 0,
          installationItemCount: task.installation_task_id
            ? installDesigns.filter((item: any) => item.task_id === task.installation_task_id).length
            : 0,
          assignedDesignCount: task.installation_task_id
            ? installDesigns.filter((item: any) => item.task_id === task.installation_task_id && (
                item.selected_design_id || item.design_face_a || item.design_face_b
              )).length
            : 0,
          contractInclusion: directC
            ? (contractInclusionMap.get(directC) || { includeInstall: false, includePrint: false })
            : { includeInstall: false, includePrint: false },
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
    const extra = taskExtras[task.id] || {
      designUrls: [], contractIds: [], adTypes: [], adType: '', teamName: '',
      reinstallationNumber: null, printerName: '', realInstallCost: 0,
      taskDesignCount: 0, installationItemCount: 0, assignedDesignCount: 0,
      installationImages: [], contractInclusion: { includeInstall: false, includePrint: false },
    };
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
    const normalizedTaskType = normalizeCompositeTaskType(task._taskType || task.task_type);

    return {
      ...task,
      task_type: normalizedTaskType,
      customer_installation_cost: realCustomerInstall,
      customer_total: customerTotal,
      company_total: companyTotal,
      net_profit: netProfit,
      designUrls: extra.designUrls,
      installationImages: extra.installationImages || [],
      contractInclusion: extra.contractInclusion || { includeInstall: false, includePrint: false },
      adTypes: extra.adTypes || (extra.adType ? [extra.adType] : []),
      adType: extra.adType || '',
      teamName: extra.teamName || '',
      printerName: extra.printerName || '',
      companyName: task.customer?.company || '',
      reinstallationNumber: normalizedTaskType === 'reinstallation'
        ? (task._reinstallationNumber ?? extra.reinstallationNumber ?? null)
        : null,
      taskDesignCount: extra.taskDesignCount || 0,
      installationItemCount: extra.installationItemCount || 0,
      assignedDesignCount: extra.assignedDesignCount || 0,
      accent,
      contractIds,
      _payments: payments,
      _totalPaid: totalPaid,
      _paymentPercentage: paymentPercentage,
    };
  }), [compositeTasks, taskExtras, taskPayments]);

  // Overall Stats & Payment Counts
  const stats = useMemo(() => {
    const totalRevenue = enriched.reduce((s, t) => s + (t.customer_total || 0), 0);
    const totalPaid = enriched.reduce((s, t) => s + (t._totalPaid || 0), 0);
    const totalRemaining = enriched.reduce((s, t) => s + Math.max(0, (t.customer_total || 0) - (t._totalPaid || 0)), 0);
    
    const unpaidTasks = enriched.filter(t => (t.customer_total || 0) > 0 && (t._totalPaid || 0) === 0);
    const partialTasks = enriched.filter(t => (t.customer_total || 0) > 0 && (t._totalPaid || 0) > 0 && (t._totalPaid || 0) < (t.customer_total || 0));
    const paidTasks = enriched.filter(t => (t.customer_total || 0) > 0 && (t._totalPaid || 0) >= (t.customer_total || 0));
    const freeTasks = enriched.filter(t => (t.customer_total || 0) === 0);

    return {
      total: enriched.length,
      pending: enriched.filter(t => t.status === 'pending' || t.status === 'in_progress').length,
      completed: enriched.filter(t => t.status === 'completed').length,
      totalRevenue,
      totalProfit: enriched.reduce((s, t) => s + (t.net_profit || 0), 0),
      totalPaid,
      totalRemaining,
      unpaidCount: unpaidTasks.length,
      partialCount: partialTasks.length,
      paidCount: paidTasks.length,
      freeCount: freeTasks.length,
    };
  }, [enriched]);

  // Filter by Status, Payment & Search
  const filtered = useMemo(() => {
    let r = enriched;
    if (filterStatus !== 'all') r = r.filter(t => t.status === filterStatus);
    
    if (paymentFilter === 'unpaid') {
      r = r.filter(t => (t.customer_total || 0) > 0 && (t._totalPaid || 0) === 0);
    } else if (paymentFilter === 'partial') {
      r = r.filter(t => (t.customer_total || 0) > 0 && (t._totalPaid || 0) > 0 && (t._totalPaid || 0) < (t.customer_total || 0));
    } else if (paymentFilter === 'paid') {
      r = r.filter(t => (t.customer_total || 0) > 0 && (t._totalPaid || 0) >= (t.customer_total || 0));
    } else if (paymentFilter === 'free') {
      r = r.filter(t => (t.customer_total || 0) === 0);
    }

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
  }, [enriched, filterStatus, paymentFilter, search]);

  // The comprehensive hub always follows the operational timeline: newest work first.
  const sorted = useMemo(() => sortTasksNewestFirst(filtered), [filtered]);

  // Contract is the visual cover; each installation/reinstallation is an isolated operation beneath it.
  const grouped = useMemo(() => {
    const groups: { 
      key: string; 
      label: string; 
      contractId: number; 
      contractIds: number[];
      customerName: string; 
      companyName: string;
      adTypes: string[];
      adType: string; 
      latestDesignUrls: string[];
      latestInstallationUrls: string[];
      teamNames: string[];
      printerNames: string[];
      tasks: typeof sorted;
      latestActivity: string | null;
      operations: {
        key: string;
        label: string;
        createdAt: string | null;
        tasks: typeof sorted;
      }[];
    }[] = [];
    
    const groupMap = new Map<string, typeof sorted>();
    
    sorted.forEach(task => {
      const groupKey = getTaskContractGroupKey(task);
      if (!groupMap.has(groupKey)) groupMap.set(groupKey, []);
      groupMap.get(groupKey)!.push(task);
    });

    groupMap.forEach((tasks, key) => {
      const orderedTasks = sortTasksNewestFirst(tasks);
      const first = orderedTasks[0];
      
      // Deduplicate contracts
      const allGroupContractIds = [...new Set(
        orderedTasks.flatMap((t: any) => t.contractIds || [t.contract_id]).map(normalizeContractId).filter((id): id is number => id !== null)
      )];

      const label = allGroupContractIds.length > 1
        ? `عقود #${allGroupContractIds.join(', #')}`
        : `عقد #${first.contract_id}`;
      const customerName = first.customer_name || 'غير محدد';
      const companyName = orderedTasks
        .map((task: any) => task.companyName)
        .find((name: string) => Boolean(name?.trim())) || '';
      const latestInstallationTask = orderedTasks.find((task: any) => task.installation_task_id);
      const latestDesignUrls = Array.isArray(latestInstallationTask?.designUrls)
        ? latestInstallationTask.designUrls.filter(Boolean)
        : [];
      const latestInstallationUrls = Array.isArray(latestInstallationTask?.installationImages)
        ? latestInstallationTask.installationImages.filter(Boolean)
        : [];

      // Deduplicate teams & printers
      const uniqueTeams = [...new Set(orderedTasks.map((t: any) => t.teamName).filter(Boolean))] as string[];
      const uniquePrinters = [...new Set(orderedTasks.map((t: any) => t.printerName).filter(Boolean))] as string[];

      // Deduplicate ad types
      const uniqueAdTypes = [...new Set(
        orderedTasks.flatMap((t: any) => t.adTypes || (t.adType ? [t.adType] : [])).filter((a: string) => a && a !== 'غير محدد')
      )] as string[];

      const operationMap = new Map<string, typeof sorted>();
      orderedTasks.forEach(task => {
        const operationKey = getCompositeTaskOperationKey(task);
        if (!operationMap.has(operationKey)) operationMap.set(operationKey, []);
        operationMap.get(operationKey)!.push(task);
      });
      const operations = [...operationMap.entries()]
        .map(([operationKey, operationTasks]) => {
          const orderedOperationTasks = sortTasksNewestFirst(operationTasks);
          return {
            key: operationKey,
            label: getOperationLabel(orderedOperationTasks[0]),
            createdAt: orderedOperationTasks[0]?.created_at || null,
            tasks: orderedOperationTasks,
          };
        })
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      groups.push({
        key,
        label,
        contractId: first.contract_id,
        contractIds: allGroupContractIds.length > 0 ? allGroupContractIds : [first.contract_id],
        customerName,
        companyName,
        adTypes: uniqueAdTypes,
        adType: uniqueAdTypes.join(' / ') || '',
        latestDesignUrls,
        latestInstallationUrls,
        teamNames: uniqueTeams,
        printerNames: uniquePrinters,
        tasks: orderedTasks,
        latestActivity: first.created_at || null,
        operations,
      });
    });

    return groups.sort((a, b) => new Date(b.latestActivity || 0).getTime() - new Date(a.latestActivity || 0).getTime());
  }, [sorted]);

  const totalPages = Math.ceil(grouped.length / PAGE_SIZE);
  
  const paginatedGroups = useMemo(() => {
    const sliced = grouped.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    return sliced.map(g => {
      const groupTotal = g.tasks.reduce((s: number, t: any) => s + (t.customer_total || 0), 0);
      const groupProfit = g.tasks.reduce((s: number, t: any) => s + (t.net_profit || 0), 0);
      const groupCost = g.tasks.reduce((s: number, t: any) => s + (t.company_total || 0), 0);
      const groupPaid = g.tasks.reduce((s: number, t: any) => s + (t._totalPaid || 0), 0);
      const groupRemaining = Math.max(0, groupTotal - groupPaid);
      const groupPaymentPercentage = groupTotal > 0 ? Math.min(100, Math.round((groupPaid / groupTotal) * 100)) : 0;
      return {
        ...g,
        groupTotal,
        groupProfit,
        groupCost,
        groupPaid,
        groupRemaining,
        groupPaymentPercentage,
      };
    });
  }, [grouped, page]);

  const toggleGroupCollapse = useCallback((key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleOperationExpansion = useCallback((key: string) => {
    setExpandedOperations(prev => {
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
      queryClient.invalidateQueries({ queryKey: ['composite-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['print-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['cutout-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['printer-accounts'] });
      setEditDialogOpen(false);
      setEditingTask(null);
    },
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

        {/* Quick Payment Status Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap pb-1">
          <button
            type="button"
            onClick={() => { setPaymentFilter('all'); setPage(1); }}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center gap-2",
              paymentFilter === 'all'
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm"
                : "bg-card/40 text-muted-foreground border-border/20 hover:bg-card/60"
            )}
          >
            <span>جميع الحالات المالية</span>
            <span className="font-mono bg-white/10 px-1.5 py-0.2 rounded-md text-[10px]">{stats.total}</span>
          </button>

          <button
            type="button"
            onClick={() => { setPaymentFilter('unpaid'); setPage(1); }}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center gap-2",
              paymentFilter === 'unpaid'
                ? "bg-rose-500/25 text-rose-300 border-rose-500/50 shadow-md ring-2 ring-rose-500/20"
                : "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
            )}
          >
            <AlertCircle className="h-3.5 w-3.5" />
            <span>غير مسددة</span>
            <span className="font-mono bg-rose-500/30 px-1.5 py-0.2 rounded-md text-[10px]">{stats.unpaidCount}</span>
          </button>

          <button
            type="button"
            onClick={() => { setPaymentFilter('partial'); setPage(1); }}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center gap-2",
              paymentFilter === 'partial'
                ? "bg-amber-500/25 text-amber-300 border-amber-500/50 shadow-md ring-2 ring-amber-500/20"
                : "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>مسددة جزئياً</span>
            <span className="font-mono bg-amber-500/30 px-1.5 py-0.2 rounded-md text-[10px]">{stats.partialCount}</span>
          </button>

          <button
            type="button"
            onClick={() => { setPaymentFilter('paid'); setPage(1); }}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center gap-2",
              paymentFilter === 'paid'
                ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50 shadow-md ring-2 ring-emerald-500/20"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>مسددة بالكامل</span>
            <span className="font-mono bg-emerald-500/30 px-1.5 py-0.2 rounded-md text-[10px]">{stats.paidCount}</span>
          </button>

          <button
            type="button"
            onClick={() => { setPaymentFilter('free'); setPage(1); }}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center gap-2",
              paymentFilter === 'free'
                ? "bg-slate-500/25 text-slate-300 border-slate-500/50 shadow-md"
                : "bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500/20"
            )}
          >
            <Gift className="h-3.5 w-3.5" />
            <span>مجانية (0 د.ل)</span>
            <span className="font-mono bg-slate-500/30 px-1.5 py-0.2 rounded-md text-[10px]">{stats.freeCount}</span>
          </button>
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

          <div className="hidden lg:flex items-center gap-2 bg-amber-500/8 border border-amber-500/20 rounded-xl px-3 h-10 shrink-0 text-[11px] font-bold text-amber-300">
            <CalendarDays className="h-3.5 w-3.5" />
            الأحدث أولًا تلقائيًا
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
              <span className="text-sm font-bold opacity-70">لا توجد مهام تركيب شاملة مطابقة لمعايير البحث</span>
            </div>
          ) : (
            paginatedGroups.map((group) => (
              <ContractGroupCard
                key={group.key}
                group={group}
                isCollapsed={collapsedGroups.has(group.key)}
                toggleGroupCollapse={toggleGroupCollapse}
                activeOperation={group.operations[0]}
                expandedOperations={expandedOperations}
                toggleOperationExpansion={toggleOperationExpansion}
                zipDownloadingGroup={zipDownloadingGroup}
                handleDownloadGroupZip={handleDownloadGroupZip}
                handleCreatePrintTasksForGroup={handleCreatePrintTasksForGroup}
                discountPopoverGroup={discountPopoverGroup}
                setDiscountPopoverGroup={setDiscountPopoverGroup}
                discountAmount={discountAmount}
                setDiscountAmount={setDiscountAmount}
                discountReason={discountReason}
                setDiscountReason={setDiscountReason}
                discountTarget={discountTarget}
                setDiscountTarget={setDiscountTarget}
                discountSaving={discountSaving}
                handleSaveDiscount={handleSaveDiscount}
                setGroupInvoiceTasks={setGroupInvoiceTasks}
                setGroupInvoiceOpen={setGroupInvoiceOpen}
                setEditingOperationTasks={setEditingOperationTasks}
                setEditingTask={setEditingTask}
                setEditDialogOpen={setEditDialogOpen}
                setDeleteTask={setDeleteTask}
                setInvoiceTask={setInvoiceTask}
                setInvoiceType={setInvoiceType}
                setInvoiceOpen={setInvoiceOpen}
                navigate={navigate}
                handleOpenCreatePrintTask={handleOpenCreatePrintTask}
                loadInstallationWorkflow={loadInstallationWorkflow}
                workflowLoadingTaskId={workflowLoadingTaskId}
              />
            ))
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
        tasks={editingOperationTasks || (editingTask ? [editingTask] : undefined)}
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setEditingOperationTasks(null);
          }
        }}
        onSave={(data) => updateCostsMutation.mutateAsync(data)}
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

      {installationWorkflowData && installationWorkflowTask && (
        <Dialog open={designManagerOpen} onOpenChange={setDesignManagerOpen}>
          <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto border-amber-500/20" dir="rtl">
            <DialogHeader className="text-right">
              <DialogTitle className="flex items-center gap-2 text-right">
                <ImagePlus className="h-5 w-5 text-amber-400" />
                إدارة تصاميم مهمة التركيب
              </DialogTitle>
            </DialogHeader>
            <TaskDesignManager
              taskId={installationWorkflowData.primaryTaskId}
              designs={installationWorkflowData.designs}
              replicateToTaskIds={installationWorkflowData.taskIds.filter(
                taskId => taskId !== installationWorkflowData.primaryTaskId,
              )}
              contractNumber={installationWorkflowTask.contract_id}
              customerName={installationWorkflowTask.customer_name || ''}
              adType={installationWorkflowTask.adType || ''}
              onDesignsUpdate={() => {
                refreshInstallationWorkflow().catch((error: any) => {
                  toast.error(error?.message || 'تعذر تحديث التصاميم');
                });
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {installationWorkflowData && (
        <BulkDesignAssigner
          open={designDistributionOpen}
          onOpenChange={setDesignDistributionOpen}
          taskItems={installationWorkflowData.items.map(item => ({
            ...item,
            billboards: installationWorkflowData.billboards[Number(item.billboard_id)],
          }))}
          taskDesigns={installationWorkflowData.designs}
          onSuccess={() => {
            refreshInstallationWorkflow().catch((error: any) => {
              toast.error(error?.message || 'تعذر تحديث توزيع التصاميم');
            });
            setDesignDistributionOpen(false);
          }}
        />
      )}

      {installationWorkflowData && installationWorkflowTask && (() => {
        const primaryItems = installationWorkflowData.items.filter(
          item => item.task_id === installationWorkflowData.primaryTaskId,
        );
        const printItems: BillboardPrintItem[] = primaryItems.map(item => ({
          id: item.id,
          billboard_id: Number(item.billboard_id),
          design_face_a: item.design_face_a,
          design_face_b: item.design_face_b,
          faces_to_install: item.faces_to_install,
          installed_image_face_a_url: item.installed_image_face_a_url,
          installed_image_face_b_url: item.installed_image_face_b_url,
          installation_date: item.installation_date,
          team_id: installationWorkflowData.installationTasks.find(
            installationTask => installationTask.id === item.task_id,
          )?.team_id,
          has_cutout: item.has_cutout,
          contract_number: installationWorkflowTask.contract_id,
          ad_type: installationWorkflowTask.adType || null,
          overlay_config: item.overlay_config
            || installationWorkflowData.billboards[Number(item.billboard_id)]?.overlay_config,
        }));
        const teams = Object.fromEntries(
          installationWorkflowData.installationTasks
            .filter(installationTask => installationTask.team_id)
            .map(installationTask => [
              installationTask.team_id,
              {
                id: installationTask.team_id,
                team_name: (installationWorkflowData as any).teamNames?.[installationTask.team_id]
                  || (installationTask.id === installationWorkflowData.primaryTaskId ? installationWorkflowTask.teamName : null)
                  || 'فريق التركيب',
              }
            ]),
        );

        return (
          <UnifiedPrintAllDialog
            open={installationPrintOpen}
            onOpenChange={setInstallationPrintOpen}
            contextType="installation"
            contextNumber={installationWorkflowTask.contract_id}
            customerName={installationWorkflowTask.customer_name || 'غير محدد'}
            companyName={installationWorkflowTask.companyName || ''}
            adType={installationWorkflowTask.adType || ''}
            items={printItems}
            billboards={installationWorkflowData.billboards}
            teams={teams}
            showTeamFilter={true}
            title={`طباعة مهمة التركيب (شامل لجميع الفرق) - عقد #${installationWorkflowTask.contract_id} (${printItems.length} لوحة)`}
          />
        );
      })()}
    </TooltipProvider>
  );
};

export default CompositeTasksListEnhanced;
