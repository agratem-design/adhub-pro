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

export const DesignPanel = ({
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
  // ⚡ نسخة أصغر من Google Drive للعرض في البطاقة (الأصل يُعرض عند التكبير) — يقلل الحجم ورفض الطلبات (429)
  const displayUrl = /^https:\/\/lh3\.googleusercontent\.com\/d\/[^=?#]+$/.test(url) ? `${url}=w800` : url;
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imageFailed = failedUrl === displayUrl;

  useEffect(() => {
    if (!url) return;
    if (!onColorExtracted && !onDualColorExtracted) return; // لا حاجة لتحميل الصورة مرة إضافية
    extractDualPaletteFromImage(displayUrl, (palette) => {
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
              {!imageFailed && <img src={displayUrl} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover scale-150 blur-xl opacity-40" aria-hidden="true" />}
              <div className="absolute inset-0 bg-black/35 group-hover/design:bg-black/15 transition-colors duration-200" />
            </div>
            {imageFailed ? (
              <div className="relative z-10 flex h-full min-h-full w-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
                <ImageIcon className="h-7 w-7 opacity-60" />
                <span className="text-xs">تعذر تحميل الصورة — اضغط للمحاولة بالحجم الكامل</span>
              </div>
            ) : (
              <img
                key={displayUrl}
                src={displayUrl}
                alt={label}
                loading="lazy"
                decoding="async"
                className="relative w-full h-full object-contain z-10 p-2 transition-transform duration-300 group-hover/design:scale-105"
                style={{ minHeight: '100%' }}
                onError={() => setFailedUrl(displayUrl)}
              />
            )}

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

export const SkeletonCard = () => (
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
