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

import { isEnabledContractFlag, normalizeForSearch, fetchInstallationWorkflowData, STATUS_CONFIG, extractDualPaletteFromImage, type InstallationWorkflowData } from './list/shared';
import { DesignPanel, SkeletonCard } from './list/DesignPanel';
import { TaskCardRow } from './list/TaskCardRow';
import { ContractGroupCard } from './list/ContractGroupCard';

interface CompositeTasksListEnhancedProps {
  customerId?: string;
  filter?: 'all' | 'pending' | 'completed';
}

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
  const [searchInput, setSearchInput] = useState(persistedFilters.search || '');
  const [search, _setSearch] = useState(persistedFilters.search || '');
  const [isSearching, setIsSearching] = useState(false);
  const [filterStatus, _setFilterStatus] = useState(persistedFilters.filterStatus);
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'unpaid' | 'partial' | 'paid' | 'free'>('all');
  const [page, _setPage] = useState(persistedFilters.page as number);

  // تحديث البحث بتأخير زمني لتفادي تجميد الواجهة أثناء الكتابة (Smooth instant typing)
  useEffect(() => {
    if (searchInput === search) {
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(() => {
      _setSearch(searchInput);
      setPersisted('search', searchInput);
      _setPage(1);
      setPersisted('page', 1);
      setIsSearching(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchInput, search, setPersisted]);

  const handleImmediateSearch = useCallback((value: string) => {
    setSearchInput(value);
    _setSearch(value);
    setPersisted('search', value);
    _setPage(1);
    setPersisted('page', 1);
    setIsSearching(false);
  }, [setPersisted]);

  const setSearch = useCallback((v: string) => {
    setSearchInput(v);
  }, []);
  const setFilterStatus = (v: string) => { _setFilterStatus(v); setPersisted('filterStatus', v); };
  const setPage = (v: number) => { _setPage(v); setPersisted('page', v); };
  const { confirm: systemConfirm } = useSystemDialog();
  const [editingTask, setEditingTask] = useState<CompositeTaskWithDetails | null>(null);
  const [editingOperationTasks, setEditingOperationTasks] = useState<CompositeTaskWithDetails[] | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [reinstallCreatingGroup, setReinstallCreatingGroup] = useState<string | null>(null);

  const handleCreateReinstallationForGroup = async (group: any) => {
    try {
      const activeOp = group.operations?.[0];
      const targetTasks = activeOp?.tasks || group.tasks || [];
      const installTasks = targetTasks.filter((t: any) => t.installation_task_id);

      const confirmed = await systemConfirm({
        title: 'إنشاء مهمة إعادة تركيب',
        message: `هل ترغب في إنشاء مهمة إعادة تركيب جديدة لعقد #${group.contractId || (group.contractIds ? group.contractIds.join(', #') : '')} (${group.customerName})؟ سيتم إنشاء دورة إعادة تركيب كاملة لجميع الفرق مع تصفير حالة إكمال اللوحات وجاهزية إدخال التكاليف.`,
        confirmText: 'إنشاء إعادة تركيب',
        variant: 'default',
      });

      if (!confirmed) return;

      setReinstallCreatingGroup(group.key);

      if (installTasks.length > 0) {
        const contractId = group.contractId || installTasks[0].contract_id;

        // حساب رقم الدورة التالي بالاعتماد على عدد دورات إعادة التركيب الموجودة حالياً في العقد (تصفير العداد بعد الحذف)
        const existingReinstallOps = (group.operations || []).filter((op: any) => 
          op.tasks?.some((t: any) => isReinstallationOperation(t))
        );
        const nextNumber = existingReinstallOps.length + 1;

        for (const installTask of installTasks) {
          const origInstallTaskId = installTask.installation_task_id;

          const { data: origTask } = await supabase
            .from('installation_tasks')
            .select('*')
            .eq('id', origInstallTaskId)
            .single();

          const { data: newTask, error: taskError } = await supabase
            .from('installation_tasks')
            .insert({
              contract_id: contractId,
              contract_ids: group.contractIds && group.contractIds.length > 0 ? group.contractIds : origTask?.contract_ids,
              team_id: origTask?.team_id || null,
              status: 'pending',
              task_type: 'reinstallation',
              reinstallation_number: nextNumber,
            })
            .select()
            .single();

          if (taskError) throw taskError;

          const newTaskId = newTask.id;

          const { data: origDesigns } = await supabase
            .from('task_designs')
            .select('*')
            .eq('task_id', origInstallTaskId);

          const designIdMap: Record<string, string> = {};
          if (origDesigns && origDesigns.length > 0) {
            const designsToInsert = origDesigns.map(({ id, created_at, updated_at, task_id, ...rest }) => ({
              ...rest,
              task_id: newTaskId,
            }));

            const { data: newDesigns } = await supabase
              .from('task_designs')
              .insert(designsToInsert)
              .select();

            if (newDesigns) {
              origDesigns.forEach(od => {
                const nd = newDesigns.find(n => n.design_name === od.design_name && n.design_order === od.design_order && n.billboard_id === od.billboard_id);
                if (nd) designIdMap[od.id] = nd.id;
              });
            }
          }

          const { data: origItems } = await supabase
            .from('installation_task_items')
            .select('*')
            .eq('task_id', origInstallTaskId);

          if (origItems && origItems.length > 0) {
            const itemsToInsert = origItems.map(({ id, created_at, updated_at, task_id, ...rest }) => ({
              ...rest,
              task_id: newTaskId,
              status: 'pending',
              installation_date: null,
              installed_image_face_a_url: null,
              installed_image_face_b_url: null,
              reinstall_count: nextNumber,
              selected_design_id: rest.selected_design_id && designIdMap[rest.selected_design_id] ? designIdMap[rest.selected_design_id] : rest.selected_design_id,
            }));

            await supabase.from('installation_task_items').insert(itemsToInsert);
          }

          // ✅ الـ trigger التلقائي auto_create_composite_task ينشئ المهمة المجمعة تلقائياً في قاعدة البيانات
          // نقوم فقط بتحديث التكاليف واسم الزبون عليها لمنع أي تضارب فريد (unique constraint)
          await supabase
            .from('composite_tasks')
            .update({
              customer_name: group.customerName || 'غير محدد',
              customer_installation_cost: installTask.customer_installation_cost || 0,
              company_installation_cost: installTask.company_installation_cost || 0,
            })
            .eq('installation_task_id', newTaskId);
        }

        toast.success(`تم إنشاء مهمة إعادة التركيب (المرة ${nextNumber}) لجميع الفرق بنجاح`);
        queryClient.invalidateQueries({ queryKey: ['composite-tasks'] });
        queryClient.invalidateQueries({ queryKey: ['composite-task-extras'] });
        queryClient.invalidateQueries({ queryKey: ['installation-tasks'] });
      } else {
        navigate(`/admin/installation-tasks?create=1&type=reinstallation&contractId=${group.contractId}&from=hub`);
      }
    } catch (err: any) {
      console.error('Error creating reinstallation task:', err);
      toast.error(err.message || 'فشل في إنشاء مهمة إعادة التركيب');
    } finally {
      setReinstallCreatingGroup(null);
    }
  };
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
    const contractId = normalizeContractId(task.contract_id);
    const queryKey = ['installation-workflow', ...taskIds.sort(), contractId || 'none'];

    setWorkflowLoadingTaskId(primaryTaskId);
    try {
      const data = await queryClient.fetchQuery({
        queryKey,
        queryFn: () => fetchInstallationWorkflowData(primaryTaskId, taskIds, contractId),
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
    const contractId = installationWorkflowTask?.contract_id ? normalizeContractId(installationWorkflowTask.contract_id) : null;
    const queryKey = ['installation-workflow', ...[...installationWorkflowData.taskIds].sort(), contractId || 'none'];
    await queryClient.invalidateQueries({ queryKey });
    const refreshed = await queryClient.fetchQuery({
      queryKey,
      queryFn: () => fetchInstallationWorkflowData(
        installationWorkflowData.primaryTaskId,
        installationWorkflowData.taskIds,
        contractId,
      ),
    });
    setInstallationWorkflowData(refreshed);
    queryClient.invalidateQueries({ queryKey: ['composite-task-extras'] });
    queryClient.invalidateQueries({ queryKey: ['composite-tasks'] });
  }, [installationWorkflowData, installationWorkflowTask, queryClient]);

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
        const installTasksData = await batchInQuery(
          installationTaskIds,
          35,
          (chunk) =>
            supabase
              .from('installation_tasks')
              .select('id, task_type, reinstallation_number, contract_id, contract_ids')
              .in('id', chunk)
        );

        const reinstallInfoMap = new Map<string, { number: number | null; taskType: string; contractId: number | null; contractIds: number[] }>();
        (installTasksData || []).forEach((it: any) => {
          const cIds = (it.contract_ids || []).map(normalizeContractId).filter((id): id is number => id !== null);
          const directC = normalizeContractId(it.contract_id);
          if (directC && !cIds.includes(directC)) cIds.push(directC);

          reinstallInfoMap.set(it.id, { 
            number: it.reinstallation_number, 
            taskType: normalizeCompositeTaskType(it.task_type),
            contractId: directC,
            contractIds: cIds,
          });
        });

        tasks.forEach((t: any) => {
          const reinstallInfo = t.installation_task_id ? reinstallInfoMap.get(t.installation_task_id) : undefined;
          const directContract = normalizeContractId(t.contract_id) || reinstallInfo?.contractId;
          const normalizedTaskType = normalizeCompositeTaskType(reinstallInfo?.taskType || t.task_type);
          
          const rawIds = (t.contract_ids && Array.isArray(t.contract_ids) && t.contract_ids.length > 0)
            ? t.contract_ids
            : (reinstallInfo?.contractIds && reinstallInfo.contractIds.length > 0)
              ? reinstallInfo.contractIds
              : (directContract ? [directContract] : []);

          t._contractIds = [...new Set(rawIds.map(normalizeContractId).filter((id): id is number => id !== null))];
          t.contractIds = t._contractIds;
          t.contract_ids = t._contractIds;
          t._reinstallationNumber = normalizedTaskType === 'reinstallation'
            ? ((reinstallInfo?.number as number) || 1)
            : null;
          t.reinstallationNumber = t._reinstallationNumber;
          t._taskType = normalizedTaskType;
          if (!t.contract_id && directContract) {
            t.contract_id = directContract;
          }
        });
      }

      tasks.forEach((t: any) => {
        if (!t._contractIds || !Array.isArray(t._contractIds) || t._contractIds.length === 0) {
          const rawIds = (t.contract_ids && Array.isArray(t.contract_ids) && t.contract_ids.length > 0)
            ? t.contract_ids
            : (t.contract_id ? [t.contract_id] : []);
          t._contractIds = [...new Set(rawIds.map(normalizeContractId).filter((id): id is number => id !== null))];
          t.contractIds = t._contractIds;
          t.contract_ids = t._contractIds;
        }
      });

      return tasks;
    },
  });

  // 2. Fetch design images, ad types, and operations data with strict normalization
  const { data: taskExtras = {} } = useQuery({
    queryKey: ['composite-task-extras', compositeTasks.map(t => t.id)],
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
      const teamNameById = new Map<string, string>();

      const promises: Promise<any>[] = [
        supabase
          .from('installation_teams')
          .select('id, team_name')
          .then(({ data }) => {
            (data || []).forEach((tm: any) => {
              if (tm.id && tm.team_name) teamNameById.set(tm.id, tm.team_name);
            });
          }),
      ];

      // Fetch installation tasks to ensure contract links and items resolution
      const allContractIdsArray = Array.from(allContractIdsSet);
      if (installIds.length > 0 || allContractIdsArray.length > 0) {
        promises.push(
          (async () => {
            try {
              let fetchedTasks: any[] = [];
              if (installIds.length > 0) {
                const byId = await batchInQuery(
                  installIds,
                  35,
                  (chunk) =>
                    supabase
                      .from('installation_tasks')
                      .select('id, task_type, reinstallation_number, contract_id, status, team_id')
                      .in('id', chunk)
                );
                fetchedTasks.push(...byId);
              }
              if (allContractIdsArray.length > 0) {
                const byContract = await batchInQuery(
                  allContractIdsArray,
                  35,
                  (chunk) =>
                    supabase
                      .from('installation_tasks')
                      .select('id, task_type, reinstallation_number, contract_id, status, team_id')
                      .in('contract_id', chunk)
                );
                fetchedTasks.push(...byContract);
              }

              const seenIds = new Set<string>();
              installTasks = fetchedTasks.filter(it => {
                if (!it?.id || seenIds.has(it.id)) return false;
                seenIds.add(it.id);
                return true;
              });

              (installTasks || []).forEach(it => {
                const c = normalizeContractId(it.contract_id);
                if (c) allContractIdsSet.add(c);
              });

              const allFetchedInstallIds = Array.from(new Set([
                ...installIds,
                ...installTasks.map(it => it.id)
              ]));

              if (allFetchedInstallIds.length > 0) {
                const [itemsData, designsData] = await Promise.all([
                  batchInQuery(
                    allFetchedInstallIds,
                    35,
                    (chunk) =>
                      supabase
                        .from('installation_task_items')
                        .select('id, task_id, billboard_id, status, installation_date, installed_image_face_a_url, installed_image_face_b_url, design_face_a, design_face_b, selected_design_id')
                        .in('task_id', chunk)
                  ),
                  batchInQuery(
                    allFetchedInstallIds,
                    35,
                    (chunk) =>
                      supabase
                        .from('task_designs')
                        .select('id, task_id, design_face_a_url, design_face_b_url')
                        .in('task_id', chunk)
                  )
                ]);
                installDesigns = itemsData || [];
                taskDesignsData = designsData || [];
              }
            } catch (err) {
              console.error('Error fetching installation data:', err);
            }
          })()
        );
      }

      if (printIds.length > 0) {
        promises.push(
          batchInQuery(
            printIds,
            35,
            (chunk) =>
              supabase.from('print_task_items')
                .select('task_id, design_face_a, design_face_b')
                .in('task_id', chunk)
          ).then(data => { printDesigns = data || []; })
        );
        promises.push(
          batchInQuery(
            printIds,
            35,
            (chunk) =>
              supabase.from('print_tasks')
                .select('id, printer:printers!print_tasks_printer_id_fkey(name)')
                .in('id', chunk)
          ).then(data => { printTasksData = data || []; })
        );
      }

      await Promise.all(promises);

      // Fetch all customer contracts with billboard_ids to support multi-contract tasks
      const customerIds = [...new Set(compositeTasks.map(t => t.customer_id).filter(Boolean))] as string[];
      const customerNames = [...new Set(compositeTasks.map(t => t.customer_name).filter(Boolean))] as string[];

      let customerContracts: any[] = [];
      if (customerIds.length > 0 || customerNames.length > 0) {
        if (customerIds.length > 0) {
          customerContracts = await batchInQuery(
            customerIds,
            35,
            (chunk) =>
              supabase
                .from('Contract')
                .select('"Contract_Number", "Ad Type", "Customer Name", customer_id, billboard_ids, "Contract Date", "End Date", include_installation_in_price, include_print_in_billboard_price, "Company"')
                .in('customer_id', chunk)
          );
        } else {
          customerContracts = await batchInQuery(
            customerNames,
            35,
            (chunk) =>
              supabase
                .from('Contract')
                .select('"Contract_Number", "Ad Type", "Customer Name", customer_id, billboard_ids, "Contract Date", "End Date", include_installation_in_price, include_print_in_billboard_price, "Company"')
                .in('Customer Name', chunk)
          );
        }
      }

      // Now query Contract table for ALL gathered contract numbers
      const finalUniqueContractIds = Array.from(allContractIdsSet);
      if (finalUniqueContractIds.length > 0) {
        const contractsData = await batchInQuery(
          finalUniqueContractIds,
          35,
          (chunk) =>
            supabase
              .from('Contract')
              .select('"Contract_Number", "Ad Type", "Customer Name", customer_id, billboard_ids, "Contract Date", "End Date", include_installation_in_price, include_print_in_billboard_price, "Company"')
              .in('Contract_Number', chunk)
        );
        const combinedContracts = [...(contractsData || []), ...customerContracts];
        const seenC = new Set<number>();
        contracts = combinedContracts.filter((c: any) => {
          const num = Number(c.Contract_Number);
          if (!num || seenC.has(num)) return false;
          seenC.add(num);
          return true;
        });
      } else {
        contracts = customerContracts;
      }

      const contractCandidates: ContractAdTypeCandidate[] = contracts.map((contract: any) => ({
        contractNumber: contract.Contract_Number,
        adType: contract['Ad Type'] || contract.ad_type || '',
        customerId: contract.customer_id,
        customerName: contract['Customer Name'],
        company: contract['Company'] || contract.Company || '',
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
        teamNameMap.set(t.id, (t.team_id && teamNameById.get(t.team_id)) || t.team?.team_name || ''); 
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
        const realItems = await batchInQuery(
          installIds,
          35,
          (chunk) =>
            supabase
              .from('installation_task_items')
              .select('task_id, customer_installation_cost, reinstall_count, customer_original_install_cost, customer_reinstall_cost')
              .in('task_id', chunk)
        );

        (realItems || []).forEach((item: any) => {
          const itemCost = getCurrentOperationInstallationCost(
            item,
            taskTypeByInstallTaskId.get(item.task_id),
          );
          
          const curr = realInstallCostMap.get(item.task_id) || 0;
          realInstallCostMap.set(item.task_id, curr + itemCost);
        });
      }

      // ⚡ تصاميم العقود (احتياطية فقط) لم تعد تُجلب لكل العقود دفعة واحدة — كانت تولّد آلاف الطلبات.
      // تُجلب عند الحاجة فقط للبطاقات الظاهرة (ContractGroupCard / TaskCardRow).
      const contractDesignMap = new Map<number, string[]>();

      compositeTasks.forEach(task => {
        const seen = new Set<string>();
        const urls: string[] = [];

        // Resolve definitive contract IDs for this task (extracting from task, installation_task, and task item billboards)
        const taskOwnedContractIds: number[] = [];
        if (Array.isArray((task as any)._contractIds) && (task as any)._contractIds.length > 0) {
          (task as any)._contractIds.forEach((cid: unknown) => {
            const c = normalizeContractId(cid);
            if (c && !taskOwnedContractIds.includes(c)) taskOwnedContractIds.push(c);
          });
        }
        if (Array.isArray((task as any).contract_ids) && (task as any).contract_ids.length > 0) {
          (task as any).contract_ids.forEach((cid: unknown) => {
            const c = normalizeContractId(cid);
            if (c && !taskOwnedContractIds.includes(c)) taskOwnedContractIds.push(c);
          });
        }
        // مطابقة اللوحات الفعلية للمهمة مع عقود العميل لكشف المهام المجمعة لعدة عقود
        if (
          task.installation_task_id
          && taskOwnedContractIds.length <= 1
          && normalizeCompositeTaskType(task.task_type) === 'reinstallation'
        ) {
          const taskBbIds = installDesigns
            .filter((item: any) => item.task_id === task.installation_task_id)
            .map((item: any) => Number(item.billboard_id))
            .filter(Boolean);

          if (taskBbIds.length > 0) {
            const matchedIds = matchContractIdsForTaskBillboards({
              taskBillboardIds: taskBbIds,
              contracts,
              taskCustomerId: task.customer_id,
              taskCustomerName: task.customer_name,
              fallbackContractId: task.contract_id,
              taskDate: task.created_at,
            });
            matchedIds.forEach(cid => {
              if (!taskOwnedContractIds.includes(cid)) {
                taskOwnedContractIds.push(cid);
              }
            });
          }
        }

        if (taskOwnedContractIds.length === 0) {
          const directC = normalizeContractId(task.contract_id) || (task.installation_task_id ? contractByInstallTaskId.get(task.installation_task_id) : null);
          if (directC) taskOwnedContractIds.push(directC);
        }

        const candidateContractIds: number[] = taskOwnedContractIds;
        const directC = candidateContractIds.length === 1 ? candidateContractIds[0] : (normalizeContractId(task.contract_id) || null);

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

        const customerInfo = resolveTaskContractCustomerInfo({
          directContractId: task.contract_id || directC,
          taskCustomerId: task.customer_id,
          taskCustomerName: task.customer_name,
          taskCompanyName: task.customer?.company || (task as any).companyName,
          contracts,
        });

        if (
          task.id &&
          task.contract_id &&
          customerInfo.customerName &&
          task.customer_name !== customerInfo.customerName
        ) {
          supabase
            .from('composite_tasks')
            .update({
              customer_name: customerInfo.customerName,
              customer_id: customerInfo.customerId || task.customer_id,
            })
            .eq('id', task.id)
            .then(({ error }) => {
              if (error) console.warn('[composite-tasks] Self-heal customer failed:', error);
            });
        }

        const installationImages = task.installation_task_id
          ? installDesigns
              .filter((item: any) => item.task_id === task.installation_task_id)
              .flatMap((item: any) => [item.installed_image_face_a_url, item.installed_image_face_b_url])
              .filter((url: unknown): url is string => typeof url === 'string' && url.trim().length > 0)
          : [];

        extras[task.id] = {
          customerName: customerInfo.customerName,
          companyName: customerInfo.companyName,
          customerId: customerInfo.customerId,
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
          completedItemCount: task.installation_task_id
            ? installDesigns.filter((item: any) => item.task_id === task.installation_task_id && item.status === 'completed').length
            : 0,
          installationProgressPercentage: (() => {
            if (!task.installation_task_id) return 0;
            const items = installDesigns.filter((item: any) => item.task_id === task.installation_task_id);
            const total = items.length;
            const completed = items.filter((item: any) => item.status === 'completed').length;
            return total > 0 ? Math.round((completed / total) * 100) : 0;
          })(),
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
    queryKey: ['composite-task-payments', compositeTasks.map(t => t.id)],
    enabled: compositeTasks.length > 0,
    queryFn: async () => {
      const taskIds = compositeTasks.map(t => t.id);
      if (taskIds.length === 0) return {};

      const data = await batchInQuery(
        taskIds,
        35,
          (chunk) =>
            supabase
              .from('customer_payments')
            .select('id, amount, paid_at, entry_type, notes, composite_task_id, distributed_payment_id')
            .in('composite_task_id', chunk)
            .eq('entry_type', 'payment')
            .order('paid_at', { ascending: true })
      );

      const map: Record<string, any[]> = {};
      (data || []).forEach((p: any) => {
        if (!map[p.composite_task_id]) map[p.composite_task_id] = [];
        p.payment_date = p.paid_at;
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
      customerName: '', companyName: '', customerId: '',
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
    const resolvedCustomerName = extra.customerName || task.customer_name || 'غير محدد';
    const resolvedCompanyName = extra.companyName || task.customer?.company || (task as any).companyName || '';
    const resolvedCustomerId = extra.customerId || task.customer_id || '';

    return {
      ...task,
      customer_name: resolvedCustomerName,
      customer_id: resolvedCustomerId,
      task_type: normalizedTaskType,
      customer_installation_cost: realCustomerInstall,
      customer_total: customerTotal,
      company_total: companyTotal,
      net_profit: netProfit,
      // ⚖️ التكلفة/الربح التشغيلي: في التركيب الأول تكلفة التركيب مغطاة بقيمة العقد (إيرادها داخل العقد وليس في المهمة)
      // — نفس القاعدة المستخدمة في صف المهمة. net_profit يبقى كما هو لبقية النظام.
      operating_cost: normalizedTaskType === 'new_installation'
        ? Math.max(0, companyTotal - (Number(task.company_installation_cost) || 0))
        : companyTotal,
      operating_profit: customerTotal - (normalizedTaskType === 'new_installation'
        ? Math.max(0, companyTotal - (Number(task.company_installation_cost) || 0))
        : companyTotal),
      installationItemCount: extra.installationItemCount || 0,
      completedItemCount: extra.completedItemCount || 0,
      installationProgressPercentage: extra.installationProgressPercentage || 0,
      designUrls: extra.designUrls,
      installationImages: extra.installationImages || [],
      contractInclusion: extra.contractInclusion || { includeInstall: false, includePrint: false },
      adTypes: extra.adTypes || (extra.adType ? [extra.adType] : []),
      adType: extra.adType || '',
      teamName: extra.teamName || '',
      printerName: extra.printerName || '',
      companyName: resolvedCompanyName,
      reinstallationNumber: normalizedTaskType === 'reinstallation'
        ? (task._reinstallationNumber ?? task.reinstallationNumber ?? extra.reinstallationNumber ?? 1)
        : null,
      taskDesignCount: extra.taskDesignCount || 0,
      assignedDesignCount: extra.assignedDesignCount || 0,
      accent,
      contractIds,
      contract_ids: contractIds,
      _contractIds: contractIds,
      _payments: payments,
      _totalPaid: totalPaid,
      _paymentPercentage: paymentPercentage,
      _searchableText: normalizeForSearch([
        resolvedCustomerName,
        task.customer_name,
        resolvedCompanyName,
        task.customer?.company,
        (extra as any).companyName,
        task.customer?.name,
        task.customer?.phone,
        task.contract_id ? `عقد ${task.contract_id} ${task.contract_id}` : '',
        ...(contractIds || []).map((cid: any) => `عقد ${cid} ${cid}`),
        extra.adType,
        ...(extra.adTypes || []),
        extra.teamName,
        extra.printerName,
        (task as any).task_name,
        (task as any).task_number,
        task.notes,
        normalizedTaskType === 'reinstallation' ? 'اعادة تركيب اعادة دورة' : 'تركيب اول اولي',
        task.id,
        task.installation_task_id,
        task.print_task_id,
      ].filter(Boolean).join(' ')),
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
      totalProfit: enriched.reduce((s, t) => s + ((t as any).operating_profit ?? (t.net_profit || 0)), 0),
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

    if (search && search.trim()) {
      const normalizedQuery = normalizeForSearch(search);
      const rawTokens = normalizedQuery.split(' ').filter(Boolean);
      // إذا كتب المستخدم كلمات متعددة تتضمن كلمة "عقد" (مثل "عقد 1178")، نستثني كلمة "عقد" لأن الأرقام والأسماء هي المحددة
      const tokens = rawTokens.length > 1 ? rawTokens.filter(tok => tok !== 'عقد') : rawTokens;

      r = r.filter(t => {
        const text = (t as any)._searchableText || '';
        return tokens.every(tok => text.includes(tok));
      });
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
        orderedTasks.flatMap((t: any) => t.contractIds || t.contract_ids || t._contractIds || (t.contract_id ? [t.contract_id] : [])).map(normalizeContractId).filter((id): id is number => id !== null)
      )];

      const isMultiContract = allGroupContractIds.length > 1;

      const label = isMultiContract
        ? `مهمة مجمعة لعدة عقود (عقود #${allGroupContractIds.join('، #')})`
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
      const rawOperations = [...operationMap.entries()]
        .map(([operationKey, operationTasks]) => {
          const orderedOperationTasks = sortTasksNewestFirst(operationTasks);
          const opInstallTaskIds = new Set(orderedOperationTasks.map((t: any) => t.installation_task_id).filter(Boolean));
          const opTasksWithItems = orderedOperationTasks.filter((t: any) => t.installationItemCount > 0);
          
          let operationTotalBillboards = 0;
          let operationCompletedBillboards = 0;
          
          if (opTasksWithItems.length > 0) {
            // Sum only tasks that have distinct installation task IDs
            const seenTaskIds = new Set<string>();
            opTasksWithItems.forEach((t: any) => {
              const tid = t.installation_task_id || t.id;
              if (!seenTaskIds.has(tid)) {
                seenTaskIds.add(tid);
                operationTotalBillboards += (t.installationItemCount || 0);
                operationCompletedBillboards += (t.completedItemCount || 0);
              }
            });
          } else {
            operationTotalBillboards = orderedOperationTasks.reduce((sum: number, t: any) => sum + (t.installationItemCount || 0), 0);
            operationCompletedBillboards = orderedOperationTasks.reduce((sum: number, t: any) => sum + (t.completedItemCount || 0), 0);
          }
          
          const operationProgressPercentage = operationTotalBillboards > 0 ? Math.round((operationCompletedBillboards / operationTotalBillboards) * 100) : 0;
          const isReinstall = orderedOperationTasks.some(t => isReinstallationOperation(t));

          return {
            key: operationKey,
            isReinstall,
            createdAt: orderedOperationTasks[0]?.created_at || null,
            tasks: orderedOperationTasks,
            operationTotalBillboards,
            operationCompletedBillboards,
            operationProgressPercentage,
          };
        });

      // ترتيب زمني تصاعدي لترقيم الدورات بالتسلسل الصحيح (إعادة تركيب 1، 2، 3...) بناءً على العمليات الموجودة حالياً
      const chronological = [...rawOperations].sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      
      let reinstallCounter = 0;
      const sequencedOperations = chronological.map(op => {
        if (!op.isReinstall) {
          return {
            ...op,
            label: isMultiContract ? 'مهمة تركيب مجمعة لعدة عقود' : 'التركيب الأول',
          };
        }
        reinstallCounter++;
        return {
          ...op,
          label: isMultiContract ? `إعادة تركيب مجمعة (${reinstallCounter})` : `إعادة تركيب ${reinstallCounter}`,
        };
      });

      // عرض الأحدث أولاً
      const operations = sequencedOperations.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      groups.push({
        key,
        label,
        isMultiContract,
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
      const groupProfit = g.tasks.reduce((s: number, t: any) => s + (t.operating_profit ?? (t.net_profit || 0)), 0);
      const groupCost = g.tasks.reduce((s: number, t: any) => s + (t.operating_cost ?? (t.company_total || 0)), 0);
      const groupPaid = g.tasks.reduce((s: number, t: any) => s + (t._totalPaid || 0), 0);
      const groupRemaining = Math.max(0, groupTotal - groupPaid);
      const groupPaymentPercentage = groupTotal > 0 ? Math.min(100, Math.round((groupPaid / groupTotal) * 100)) : 0;
      // Deduplicate installation tasks in the active/first operation or across unique install tasks
      const activeOp = g.operations[0];
      const groupTotalBillboards = activeOp ? activeOp.operationTotalBillboards : g.tasks.reduce((s: number, t: any) => s + (t.installationItemCount || 0), 0);
      const groupCompletedBillboards = activeOp ? activeOp.operationCompletedBillboards : g.tasks.reduce((s: number, t: any) => s + (t.completedItemCount || 0), 0);
      const groupProgressPercentage = groupTotalBillboards > 0 ? Math.round((groupCompletedBillboards / groupTotalBillboards) * 100) : 0;
      return {
        ...g,
        groupTotal,
        groupProfit,
        groupCost,
        groupPaid,
        groupRemaining,
        groupPaymentPercentage,
        groupTotalBillboards,
        groupCompletedBillboards,
        groupProgressPercentage,
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
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
            <Input 
              placeholder="بحث بالاسم، الشركة، رقم العقد، نوع الإعلان، الفريق..." 
              value={searchInput} 
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleImmediateSearch(searchInput);
                }
              }}
              className="pr-10 pl-9 bg-background/50 border-border/30 h-10 text-xs text-foreground placeholder:text-muted-foreground/65 focus-visible:ring-indigo-500/50 rounded-xl" 
            />
            {isSearching ? (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
              </div>
            ) : searchInput ? (
              <button
                type="button"
                onClick={() => handleImmediateSearch('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground p-1 rounded-md cursor-pointer transition-colors"
                title="مسح البحث"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
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
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground bg-card/20 rounded-3xl border border-border/20 text-center px-4">
              <Package className="h-14 w-14 opacity-20" />
              <span className="text-sm font-bold opacity-70">
                {search ? `لا توجد نتائج مطابقة للبحث عن «${search}»` : 'لا توجد مهام تركيب شاملة مطابقة لمعايير التصفية'}
              </span>
              {search && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleImmediateSearch('')}
                  className="mt-2 h-8 text-xs gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 cursor-pointer rounded-xl"
                >
                  <X className="h-3.5 w-3.5" />
                  إلغاء البحث وعرض كل المهام
                </Button>
              )}
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
                handleCreateReinstallationForGroup={handleCreateReinstallationForGroup}
                reinstallCreatingGroup={reinstallCreatingGroup}
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
        // تجميع كافة بنود اللوحات لجميع الفرق والمهام التابعة لنفس العقد والعملية
        const printItems: BillboardPrintItem[] = installationWorkflowData.items.map(item => {
          const itemTask = installationWorkflowData.installationTasks.find(
            installationTask => installationTask.id === item.task_id,
          );
          let itemTeamId = itemTask?.team_id || (item as any).team_id;

          // إذا لم يكن حقل الفرقة معيناً في المهمة، نحاول مطابقة الفرقة تلقائياً بمدينة ومقاس اللوحة
          if (!itemTeamId && installationWorkflowData.allTeams) {
            const bb = installationWorkflowData.billboards[Number(item.billboard_id)];
            if (bb?.City) {
              const matchedTeam = Object.values(installationWorkflowData.allTeams).find(
                (t: any) => Array.isArray(t.cities) && t.cities.includes(bb.City)
              );
              if (matchedTeam) {
                itemTeamId = (matchedTeam as any).id;
              }
            }
          }

          return {
            id: item.id,
            billboard_id: Number(item.billboard_id),
            design_face_a: item.design_face_a,
            design_face_b: item.design_face_b,
            faces_to_install: item.faces_to_install,
            installed_image_face_a_url: item.installed_image_face_a_url,
            installed_image_face_b_url: item.installed_image_face_b_url,
            installation_date: item.installation_date,
            team_id: itemTeamId,
            has_cutout: item.has_cutout,
            contract_number: itemTask?.contract_id || installationWorkflowTask.contract_id,
            ad_type: installationWorkflowTask.adType || null,
            overlay_config: item.overlay_config
              || installationWorkflowData.billboards[Number(item.billboard_id)]?.overlay_config,
          };
        });

        // تمرير جميع الفرق المتاحة مع مدنها ومقاساتها لتمكين الفلترة الكاملة
        const teams = (installationWorkflowData.allTeams && Object.keys(installationWorkflowData.allTeams).length > 0)
          ? installationWorkflowData.allTeams
          : Object.fromEntries(
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
            taskId={installationWorkflowTask.installation_task_id || installationWorkflowData.primaryTaskId || undefined}
            taskType={installationWorkflowTask.task_type || 'installation'}
            reinstallationNumber={installationWorkflowTask.reinstallation_number ?? null}
          />
        );
      })()}
    </TooltipProvider>
  );
};

export default CompositeTasksListEnhanced;
