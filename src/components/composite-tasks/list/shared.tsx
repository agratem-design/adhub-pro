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


// أدوات وثوابت مشتركة لصفحة المهام المجمعة
export const isEnabledContractFlag = (value: unknown): boolean =>
  value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';

export const normalizeForSearch = (str?: string | null): string => {
  return String(str || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '') // remove Arabic tashkeel / diacritics
    .replace(/[#_\\/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export interface InstallationWorkflowData {
  primaryTaskId: string;
  taskIds: string[];
  items: any[];
  designs: any[];
  billboards: Record<number, any>;
  installationTasks: any[];
  teamNames?: Record<string, string>;
  allTeams?: Record<string, any>;
}

export const fetchInstallationWorkflowData = async (
  primaryTaskId: string,
  relatedTaskIds: string[],
  contractId?: number | null,
): Promise<InstallationWorkflowData> => {
  let taskIds = [...new Set([primaryTaskId, ...relatedTaskIds].filter(Boolean))];

  // إذا تم تمرير رقم العقد، نجمع جميع مهام التركيب التابعة لنفس العقد والعملية لتجميع كل الفرق
  if (contractId) {
    try {
      const { data: contractTasks } = await supabase
        .from('installation_tasks')
        .select('id, task_type, reinstallation_number')
        .eq('contract_id', contractId);
      if (contractTasks && contractTasks.length > 0) {
        const primaryTask = contractTasks.find(t => t.id === primaryTaskId);
        const targetType = primaryTask?.task_type || 'installation';
        const targetReinstall = primaryTask?.reinstallation_number ?? null;
        const matchingTasks = contractTasks.filter(t =>
          (t.task_type || 'installation') === targetType &&
          (t.reinstallation_number ?? null) === targetReinstall
        );
        taskIds = [...new Set([...taskIds, ...matchingTasks.map(t => t.id)])];
      }
    } catch (err) {
      console.warn('Could not expand contract installation tasks:', err);
    }
  }

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
      .select('id, team_name, cities, sizes'),
  ]);

  if (itemsResult.error) throw itemsResult.error;
  if (designsResult.error) throw designsResult.error;
  if (tasksResult.error) throw tasksResult.error;

  const teamNames: Record<string, string> = {};
  const allTeams: Record<string, any> = {};
  (teamsResult.data || []).forEach((tm: any) => {
    if (tm.id) {
      allTeams[tm.id] = tm;
      if (tm.team_name) teamNames[tm.id] = tm.team_name;
    }
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
    allTeams,
  };
};

export const STATUS_CONFIG = {
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
// ⚡ ذاكرة مؤقتة لألوان الصور: تمنع إعادة تحميل الصورة ومعالجتها في كل مرة تُعاد فيها البطاقة (مثلاً أثناء البحث)
const paletteCache = new Map<string, [string, string] | null>();
const palettePending = new Map<string, Array<(colors: [string, string] | null) => void>>();

export const extractDualPaletteFromImage = (url: string, callback: (colors: [string, string] | null) => void) => {
  if (!url) return callback(null);
  if (paletteCache.has(url)) return callback(paletteCache.get(url) ?? null);
  const waiting = palettePending.get(url);
  if (waiting) { waiting.push(callback); return; }
  palettePending.set(url, [callback]);
  computeDualPalette(url, (colors) => {
    paletteCache.set(url, colors);
    const cbs = palettePending.get(url) || [];
    palettePending.delete(url);
    cbs.forEach((cb) => cb(colors));
  });
};

const computeDualPalette = (url: string, callback: (colors: [string, string] | null) => void) => {
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
