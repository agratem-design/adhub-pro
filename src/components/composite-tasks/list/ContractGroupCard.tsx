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
import { TaskCardRow } from './TaskCardRow';

export const ContractGroupCard = ({
  group,
  isCollapsed,
  toggleGroupCollapse,
  activeOperation,
  expandedOperations,
  toggleOperationExpansion,
  zipDownloadingGroup,
  handleDownloadGroupZip,
  handleCreatePrintTasksForGroup,
  handleCreateReinstallationForGroup,
  reinstallCreatingGroup,
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

  // ⚡ تصاميم العقد كاحتياط تُجلب فقط للبطاقة الظاهرة وعند غياب صور/تصاميم التشغيل
  const [contractFallbackUrls, setContractFallbackUrls] = useState<string[]>([]);
  const hasOwnVisuals = (group.latestInstallationUrls?.length || 0) > 0 || (group.latestDesignUrls?.length || 0) > 0;
  useEffect(() => {
    if (hasOwnVisuals) return;
    const cId = normalizeContractId(group.contractId);
    if (!cId) return;
    let cancelled = false;
    fetchContractDesignUrls(cId).then((urls) => {
      if (!cancelled && urls?.length) setContractFallbackUrls(urls.slice(0, 4));
    });
    return () => { cancelled = true; };
  }, [hasOwnVisuals, group.contractId]);
  const coverDesignUrls: string[] = (group.latestDesignUrls?.length || 0) > 0 ? group.latestDesignUrls : contractFallbackUrls;

  const coverUrl: string | undefined = group.latestInstallationUrls?.[0] || coverDesignUrls[0];
  const coverIsInstallPhoto = (group.latestInstallationUrls?.length || 0) > 0;
  const money = (n: number) => `${Number(n || 0).toLocaleString('ar-LY')} د.ل`;
  const paymentState = group.groupTotal === 0
    ? { label: 'مجانية', tone: 'text-muted-foreground bg-muted/50 border-border/60', bar: 'bg-muted-foreground/40' }
    : group.groupPaid >= group.groupTotal
      ? { label: 'مسدد بالكامل', tone: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', bar: 'bg-emerald-500' }
      : group.groupPaid > 0
        ? { label: 'مسدد جزئياً', tone: 'text-amber-400 bg-amber-500/10 border-amber-500/30', bar: 'bg-amber-500' }
        : { label: 'غير مسدد', tone: 'text-rose-400 bg-rose-500/10 border-rose-500/30', bar: 'bg-rose-500' };
  const progressDone = group.groupProgressPercentage === 100;
  const profitPct = group.groupTotal > 0 ? Math.round((group.groupProfit / group.groupTotal) * 100) : 0;

  return (
    <article
      key={group.key}
      className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm"
      aria-label={`${group.label} — ${group.customerName}`}
    >
      {/* رأس العقد: الهوية + الإجراءات */}
      <header className="grid grid-cols-1 gap-5 p-4 sm:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)] lg:p-5">
        {/* صورة التصميم/التركيب — كبيرة وتُكبَّر بالنقر */}
        <div className="relative h-56 overflow-hidden rounded-xl border border-border/60 bg-muted/30 sm:h-auto sm:min-h-[230px]" onClick={e => e.stopPropagation()}>
          <DesignPanel
            urls={coverIsInstallPhoto ? group.latestInstallationUrls : coverDesignUrls}
            accent="hsl(var(--primary))"
            label={coverIsInstallPhoto ? 'صورة التركيب' : 'تصميم التركيب'}
          />
          <span className="pointer-events-none absolute bottom-2 right-2 z-30 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">
            {coverIsInstallPhoto ? 'آخر صورة تركيب' : coverUrl ? 'آخر تصميم' : 'لا توجد صورة'}
          </span>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-start gap-4">

          {/* الهوية */}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-bold',
                group.isMultiContract ? 'bg-amber-500/10 text-amber-400' : 'bg-muted/60 text-foreground/80'
              )}>
                {group.isMultiContract ? <Layers className="h-3.5 w-3.5" /> : <FolderOpen className="h-3.5 w-3.5" />}
                {group.label}
              </span>
              {group.isMultiContract && (
                <span className="text-amber-400/90">مهمة مجمعة مستقلة</span>
              )}
              <span className="text-muted-foreground">
                {group.operations.length} {group.operations.length === 1 ? 'عملية' : 'عمليات'}
                {group.tasks.length > 1 ? ` / ${group.tasks.length} مهام` : ''}
              </span>
            </div>
            <h3 className="truncate text-lg font-bold leading-tight text-foreground sm:text-xl">{group.customerName}</h3>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Megaphone className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate font-semibold text-foreground/90">{group.adType || 'نوع الإعلان غير محدد'}</span>
              </span>
              {group.companyName && (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Building2 className="h-4 w-4 shrink-0" />
                  <span className="truncate">{group.companyName}</span>
                </span>
              )}
            </div>
          </div>

          {/* الإجراءات */}
          <div className="flex shrink-0 items-center gap-1.5" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              disabled={reinstallCreatingGroup === group.key}
              onClick={() => handleCreateReinstallationForGroup(group)}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              title="إنشاء مهمة إعادة تركيب جديدة ومنفصلة لهذا العقد"
            >
              {reinstallCreatingGroup === group.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="hidden md:inline">إعادة تركيب</span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  aria-label="إجراءات العقد"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 text-right font-tajawal">
                <DropdownMenuItem
                  onClick={() => window.open(`/design-studio?contract_id=${group.contractId}`, '_blank')}
                  className="gap-2 cursor-pointer"
                >
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>فتح العقد في استوديو التصميم</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={zipDownloadingGroup === group.key}
                  onClick={() => handleDownloadGroupZip({ key: group.key, contractId: group.contractId, customerName: group.customerName })}
                  className="gap-2 cursor-pointer"
                >
                  {zipDownloadingGroup === group.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  <span>تحميل صور وCSV العقد (ZIP)</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              onClick={() => toggleGroupCollapse(group.key)}
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? 'فتح العقد وعملياته' : 'طي العقد وعملياته'}
            >
              {isCollapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* الأرقام: صف واحد هادئ، الألوان للدلالة فقط */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl bg-muted/30 px-4 py-3 sm:grid-cols-4">
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">قيمة العقد</dt>
            <dd className="mt-0.5 text-lg font-bold tabular-nums text-foreground">{money(group.groupTotal)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="flex items-center gap-2 text-xs text-muted-foreground">
              السداد
              <span className={cn('rounded border px-1.5 py-px text-[11px] font-semibold', paymentState.tone)}>{paymentState.label}</span>
            </dt>
            <dd className="mt-0.5 text-sm tabular-nums">
              <span className="font-bold text-foreground">{money(group.groupPaid)}</span>
              {group.groupTotal > 0 && group.groupRemaining > 0 && (
                <span className="mr-2 text-rose-400">متبقي {money(group.groupRemaining)}</span>
              )}
            </dd>
            {group.groupTotal > 0 && (
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div className={cn('h-full rounded-full', paymentState.bar)} style={{ width: `${group.groupPaymentPercentage}%` }} />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">تكلفة التنفيذ</dt>
            <dd className="mt-0.5 text-lg font-bold tabular-nums text-foreground/90">{money(group.groupCost)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">صافي الربح</dt>
            <dd className={cn('mt-0.5 text-lg font-bold tabular-nums', group.groupProfit >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
              {money(group.groupProfit)}
              <span className="mr-1.5 text-xs font-medium text-muted-foreground">{profitPct}%</span>
            </dd>
          </div>
        </dl>

        {/* الإنجاز والفرق */}
        <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          {group.groupTotalBillboards > 0 ? (
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {progressDone ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /> : <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <span className="shrink-0 text-muted-foreground">
                التركيب <span className="font-semibold tabular-nums text-foreground">{group.groupCompletedBillboards} / {group.groupTotalBillboards}</span> لوحة
              </span>
              <div className="h-1.5 max-w-[220px] flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full', progressDone ? 'bg-emerald-500' : 'bg-primary')}
                  style={{ width: `${group.groupProgressPercentage}%` }}
                />
              </div>
              <span className="tabular-nums text-xs text-muted-foreground">{group.groupProgressPercentage}%</span>
            </div>
          ) : <span />}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {group.teamNames.map((teamName: string, teamIndex: number) => (
              <span key={`t${teamIndex}`} className="inline-flex items-center gap-1"><Wrench className="h-3.5 w-3.5" />{teamName}</span>
            ))}
            {group.printerNames.map((printerName: string, printerIndex: number) => (
              <span key={`p${printerIndex}`} className="inline-flex items-center gap-1"><Printer className="h-3.5 w-3.5" />{printerName}</span>
            ))}
            {group.latestActivity && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />آخر نشاط {format(new Date(group.latestActivity), 'dd/MM/yyyy', { locale: ar })}
              </span>
            )}
          </div>
        </div>
        </div>
      </header>

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
                const operationCompanyTotal = operation.tasks.reduce((sum: number, operationTask: any) => sum + (operationTask.operating_cost ?? (operationTask.company_total || 0)), 0);
                const operationIsFirstInstall = operation.tasks.every((operationTask: any) => operationTask.task_type === 'new_installation');
                const operationProfit = operationCustomerTotal - operationCompanyTotal;
                const operationInstallCost = operation.tasks.reduce((sum: number, operationTask: any) => sum + (operationTask.company_installation_cost || 0), 0);
                const operationPrintCost = operation.tasks.reduce((sum: number, operationTask: any) => sum + (operationTask.company_print_cost || 0), 0);
                const operationCutoutCost = operation.tasks.reduce((sum: number, operationTask: any) => sum + (operationTask.company_cutout_cost || 0), 0);
                const operationTeams = [...new Set(operation.tasks.map((operationTask: any) => operationTask.teamName).filter(Boolean))];

                return (
                <section key={operation.key} className="overflow-hidden rounded-xl border border-border/60 bg-background/40">
                  <div className="flex flex-col gap-3 p-3 sm:p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => toggleOperationExpansion(operationExpansionKey)}
                        className="flex min-h-10 min-w-0 flex-1 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-1 text-right transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        aria-expanded={isOperationExpanded}
                        aria-label={`${isOperationExpanded ? 'طي' : 'فتح'} ${operation.label}`}
                      >
                        {isOperationExpanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        <span className="text-sm font-bold text-foreground">{operation.label}</span>
                        {operationIndex === 0 && (
                          <span className="rounded bg-primary/15 px-1.5 py-px text-[11px] font-semibold text-primary">الأحدث</span>
                        )}
                        {operation.createdAt && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {format(new Date(operation.createdAt), 'dd/MM/yyyy', { locale: ar })}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          {operationTeams.length || operation.tasks.length} {operationTeams.length === 1 || (!operationTeams.length && operation.tasks.length === 1) ? 'فريق' : 'فرق'}
                        </span>
                        {operation.operationTotalBillboards > 0 && (
                          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="tabular-nums">{operation.operationCompletedBillboards} / {operation.operationTotalBillboards} لوحة</span>
                            <span className="h-1 w-14 overflow-hidden rounded-full bg-muted">
                              <span
                                className={`block h-full rounded-full ${operation.operationProgressPercentage === 100 ? 'bg-emerald-500' : 'bg-primary'}`}
                                style={{ width: `${operation.operationProgressPercentage}%` }}
                              />
                            </span>
                          </span>
                        )}
                      </button>
                      <div className="flex items-center gap-2">
                        {/* تعديل تكاليف هذه العملية */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingOperationTasks(operation.tasks);
                                setEditingTask(operation.tasks[0]);
                                setEditDialogOpen(true);
                              }}
                              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                              aria-label={`تعديل تكاليف ${operation.label}`}
                            >
                              <Edit className="h-3.5 w-3.5" />
                              <span>تعديل التكاليف</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">تعديل تكاليف وأسعار بنود هذه العملية فقط</TooltipContent>
                        </Tooltip>

                        {/* فاتورة العملية */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => {
                                setGroupInvoiceTasks(operation.tasks);
                                setGroupInvoiceOpen(true);
                              }}
                              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                              aria-label={`فاتورة ${operation.label}`}
                            >
                              <FileOutput className="h-3.5 w-3.5" />
                              فاتورة العملية
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">تشمل هذه العملية فقط ولا تضم عمليات العقد السابقة</TooltipContent>
                        </Tooltip>

                        {/* إجراءات العملية الأحدث فقط: إنشاء مهام الطباعة وإدارة الخصم */}
                        {operationIndex === 0 && (
                          <>
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
                            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
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
                        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border/60 bg-card text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        aria-label="إدارة الخصم"
                        title="إدارة خصم العملية الأحدث"
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
                          </>
                        )}

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
                              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                              aria-label={`طباعة مهمة التركيب لجميع فرق ${operation.label}`}
                            >
                              <Printer className="h-3.5 w-3.5" />
                              <span>طباعة مهمة التركيب</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">طباعة شاملة لمهمة التركيب لجميع الفرق مع إمكانية اختيار الفرق كلها أو إلغاء</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-border/50 pt-3 sm:flex-row sm:items-stretch">
                    {/* قيمة العملية — الرقم الأهم */}
                    <div className="flex shrink-0 flex-col justify-center rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 sm:min-w-[200px]">
                      <span className="text-xs font-semibold text-primary">قيمة العملية</span>
                      <span className="text-2xl font-extrabold leading-tight tabular-nums text-foreground sm:text-3xl">
                        {operationCustomerTotal.toLocaleString('ar-LY')}
                        <span className="mr-1.5 text-sm font-semibold text-muted-foreground">د.ل</span>
                      </span>
                    </div>
                    <dl className="grid flex-1 grid-cols-3 gap-x-4 gap-y-2 self-center text-sm sm:grid-cols-5">
                      <div>
                        <dt className="text-xs text-muted-foreground">تكلفة التنفيذ</dt>
                        <dd className="font-semibold tabular-nums text-foreground/90">{operationCompanyTotal.toLocaleString('ar-LY')} د.ل</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">صافي الربح</dt>
                        <dd className={`font-semibold tabular-nums ${operationProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{operationProfit.toLocaleString('ar-LY')} د.ل</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground" title={operationIsFirstInstall ? 'تكلفة التركيب الأول مغطاة بقيمة العقد ولا تُخصم من ربح العملية' : undefined}>
                          تركيب{operationIsFirstInstall ? ' (ضمن العقد)' : ''}
                        </dt>
                        <dd className="tabular-nums text-foreground/80">{operationInstallCost.toLocaleString('ar-LY')}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">طباعة</dt>
                        <dd className="tabular-nums text-foreground/80">{operationPrintCost.toLocaleString('ar-LY')}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">قص</dt>
                        <dd className="tabular-nums text-foreground/80">{operationCutoutCost.toLocaleString('ar-LY')}</dd>
                      </div>
                    </dl>
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
                                const opInstallTaskIds = operation.tasks
                                  .map((t: any) => t.installation_task_id)
                                  .filter(Boolean);
                                loadInstallationWorkflow(workflowTask, opInstallTaskIds, 'print');
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
    </article>
  );
};


