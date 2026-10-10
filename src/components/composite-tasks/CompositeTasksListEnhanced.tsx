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
  parseContractBillboardIds,
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
import { HubContractRow } from './list/HubContractRow';
import { HubContractDetail } from './list/HubContractDetail';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

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
  const [typeFilter, setTypeFilter] = useState<'all' | 'new' | 'reinstall' | 'multi'>('all');
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [isWide, setIsWide] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const onChange = () => setIsWide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

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
        printEnabledContractIds: number[];
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
                .select('"Contract_Number", "Ad Type", "Customer Name", customer_id, billboard_ids, "Contract Date", "End Date", include_installation_in_price, include_print_in_billboard_price, print_cost_enabled, "Company"')
                .in('customer_id', chunk)
          );
        } else {
          customerContracts = await batchInQuery(
            customerNames,
            35,
            (chunk) =>
              supabase
                .from('Contract')
                .select('"Contract_Number", "Ad Type", "Customer Name", customer_id, billboard_ids, "Contract Date", "End Date", include_installation_in_price, include_print_in_billboard_price, print_cost_enabled, "Company"')
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
              .select('"Contract_Number", "Ad Type", "Customer Name", customer_id, billboard_ids, "Contract Date", "End Date", include_installation_in_price, include_print_in_billboard_price, print_cost_enabled, "Company"')
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

        // توزيع لوحات المهمة على العقود عندما تجمع أكثر من عقد لنفس الزبون
        const breakdownBillboardIds: number[] = task.installation_task_id
          ? installDesigns.filter((i: any) => i.task_id === task.installation_task_id).map((i: any) => Number(i.billboard_id)).filter(Boolean)
          : [];
        let contractBreakdown: { contractId: number; count: number; adType?: string }[] = [];
        let unmatchedBillboards = 0;
        if (candidateContractIds.length > 1 && breakdownBillboardIds.length > 0) {
          const claimed = new Set<number>();
          // العقد الأحدث يأخذ اللوحة أولاً عند تكرارها في أكثر من عقد
          contractBreakdown = [...candidateContractIds].sort((a, b) => b - a).map(cid => {
            const c: any = contracts.find((x: any) => Number(x.Contract_Number) === cid);
            const ids = new Set(parseContractBillboardIds(c?.billboard_ids));
            const mine = breakdownBillboardIds.filter(b => ids.has(b) && !claimed.has(b));
            mine.forEach(b => claimed.add(b));
            return { contractId: cid, count: mine.length, adType: c?.['Ad Type'] || '' };
          }).sort((a, b) => a.contractId - b.contractId);
          unmatchedBillboards = breakdownBillboardIds.filter(b => !claimed.has(b)).length;
        }

        extras[task.id] = {
          contractBreakdown,
          unmatchedBillboards,
          customerName: customerInfo.customerName,
          companyName: customerInfo.companyName,
          customerId: customerInfo.customerId,
          designUrls: urls.slice(0, 4),
          installationImages: [...new Set(installationImages)],
          contractIds: candidateContractIds,
          printEnabledContractIds: candidateContractIds.filter(id => contracts.some((c: any) =>
            Number(c.Contract_Number) === id && isEnabledContractFlag(c.print_cost_enabled))),
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
      designUrls: [], contractIds: [], printEnabledContractIds: [], adTypes: [], adType: '', teamName: '',
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
      contractBreakdown: (extra as any).contractBreakdown || [],
      unmatchedBillboards: (extra as any).unmatchedBillboards || 0,
      contractInclusion: extra.contractInclusion || { includeInstall: false, includePrint: false },
      printEnabledContractIds: extra.printEnabledContractIds || [],
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
          const opContractIds = [...new Set(orderedOperationTasks.flatMap((t: any) => t.contractIds || []).map(Number).filter(Boolean))].sort((a, b) => a - b);

          return {
            key: operationKey,
            isReinstall,
            contractIds: opContractIds,
            isMultiContract: opContractIds.length > 1,
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

      const breakdownMap = new Map<number, { contractId: number; count: number; adType?: string }>();
      let unmatchedBillboards = 0;
      const seenBreakdownTasks = new Set<string>();
      ((operations[0]?.tasks || []) as any[]).forEach((t: any) => {
        const tid = t.installation_task_id || t.id;
        if (seenBreakdownTasks.has(tid)) return;
        seenBreakdownTasks.add(tid);
        (t.contractBreakdown || []).forEach((b: any) => {
          const cur = breakdownMap.get(b.contractId) || { contractId: b.contractId, count: 0, adType: b.adType };
          cur.count += b.count;
          breakdownMap.set(b.contractId, cur);
        });
        unmatchedBillboards += t.unmatchedBillboards || 0;
      });
      const hasReinstall = operations.some((op: any) => op.isReinstall);

      (groups as any[]).push({
        key,
        label,
        isMultiContract,
        contractBreakdown: [...breakdownMap.values()].sort((a, b) => a.contractId - b.contractId),
        unmatchedBillboards,
        hasReinstall,
        contractId: first.contract_id,
        contractIds: allGroupContractIds.length > 0 ? allGroupContractIds : [first.contract_id],
        printEnabledContractIds: [...new Set(orderedTasks.flatMap((t: any) => t.printEnabledContractIds || []))],
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

  const typeCounts = useMemo(() => ({
    all: grouped.length,
    new: grouped.filter((g: any) => !g.hasReinstall).length,
    reinstall: grouped.filter((g: any) => g.hasReinstall).length,
    multi: grouped.filter((g: any) => g.isMultiContract).length,
  }), [grouped]);
  const visibleGroups = useMemo(() => grouped.filter((g: any) => (
    typeFilter === 'all' ? true
      : typeFilter === 'new' ? !g.hasReinstall
        : typeFilter === 'reinstall' ? g.hasReinstall
          : g.isMultiContract
  )), [grouped, typeFilter]);
  const totalPages = Math.ceil(visibleGroups.length / PAGE_SIZE);
  
  const paginatedGroups = useMemo(() => {
    const sliced = visibleGroups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    return sliced.map((g: any) => {
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
  }, [visibleGroups, page]);

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
      <div className="bg-card/45 backdrop-blur-md border border-border/25 px-4 py-1.5 flex items-center gap-4 text-xs text-muted-foreground rounded-2xl shrink-0 shadow-sm w-fit mr-auto">
        <div className="flex items-center gap-2 font-bold text-muted-foreground/80 select-none">
          <span>{sorted.length > 0 ? `عرض ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, sorted.length)} من ${sorted.length} مهمة` : 'لا توجد نتائج'}</span>
          <span className="text-xs text-muted-foreground/35 font-normal">|</span>
          <span className="text-xs text-muted-foreground/50 font-normal">الصفحة {page} من {totalPages}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 px-2 border-border/30 rounded-xl text-xs gap-1 font-bold text-muted-foreground/80 hover:text-foreground hover:bg-muted/50" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronRight className="h-3 w-3" />السابق
          </Button>
          {startPage > 1 && (<><Button size="sm" className="h-7 w-7 p-0 text-xs rounded-xl bg-transparent hover:bg-muted/50 text-muted-foreground border border-transparent" onClick={() => setPage(1)}>1</Button>{startPage > 2 && <span className="text-muted-foreground/40 px-1 text-xs">...</span>}</>)}
          {pageNumbers.map(p => (
            <Button key={p} size="sm" className={`h-7 w-7 p-0 text-xs rounded-xl transition-all ${p === page ? 'bg-primary hover:bg-primary/90 text-primary-foreground font-black shadow-md shadow-primary/10' : 'bg-transparent hover:bg-muted/50 text-muted-foreground border border-transparent'}`} onClick={() => setPage(p)}>{p}</Button>
          ))}
          {endPage < totalPages && (<>{endPage < totalPages - 1 && <span className="text-muted-foreground/40 px-1 text-xs">...</span>}<Button size="sm" className="h-7 w-7 p-0 text-xs rounded-xl bg-transparent hover:bg-muted/50 text-muted-foreground border border-transparent" onClick={() => setPage(totalPages)}>{totalPages}</Button></>)}
          <Button variant="outline" size="sm" className="h-7 px-2 border-border/30 rounded-xl text-xs gap-1 font-bold text-muted-foreground/80 hover:text-foreground hover:bg-muted/50" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            التالي<ChevronLeft className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  };

  const groupActionProps = {
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
  };

  const selectedGroup = paginatedGroups.find(g => g.key === selectedGroupKey) || (isWide ? paginatedGroups[0] : undefined);

  const statTiles = [
    { label: 'العقود والمهام', value: `${grouped.length} / ${stats.total}`, tone: 'text-foreground' },
    { label: 'قيد التنفيذ', value: stats.pending, tone: 'text-warning' },
    { label: 'مكتملة', value: stats.completed, tone: 'text-success' },
    { label: 'الإيرادات', value: `${stats.totalRevenue.toLocaleString('ar-LY')}`, tone: 'text-foreground' },
    { label: 'المحصل', value: `${stats.totalPaid.toLocaleString('ar-LY')}`, tone: 'text-success' },
    { label: 'المتبقي', value: `${stats.totalRemaining.toLocaleString('ar-LY')}`, tone: 'text-destructive' },
    { label: 'صافي الربح', value: `${stats.totalProfit.toLocaleString('ar-LY')}`, tone: stats.totalProfit >= 0 ? 'text-success' : 'text-destructive' },
  ];

  const typeOptions: { key: typeof typeFilter; label: string; count: number }[] = [
    { key: 'all', label: 'الكل', count: typeCounts.all },
    { key: 'new', label: 'تركيب أول', count: typeCounts.new },
    { key: 'reinstall', label: 'إعادة تركيب', count: typeCounts.reinstall },
    { key: 'multi', label: 'من عدة عقود', count: typeCounts.multi },
  ];

  const paymentOptions: { key: typeof paymentFilter; label: string; count: number; tone: string }[] = [
    { key: 'all', label: 'كل الحالات المالية', count: stats.total, tone: 'data-[on=true]:bg-foreground/10 data-[on=true]:text-foreground' },
    { key: 'unpaid', label: 'غير مسددة', count: stats.unpaidCount, tone: 'data-[on=true]:bg-rose-500/20 data-[on=true]:text-rose-300' },
    { key: 'partial', label: 'جزئياً', count: stats.partialCount, tone: 'data-[on=true]:bg-amber-500/20 data-[on=true]:text-amber-300' },
    { key: 'paid', label: 'مسددة', count: stats.paidCount, tone: 'data-[on=true]:bg-emerald-500/20 data-[on=true]:text-emerald-300' },
    { key: 'free', label: 'مجانية', count: stats.freeCount, tone: 'data-[on=true]:bg-slate-500/20 data-[on=true]:text-slate-300' },
  ];

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-full flex-col gap-3" dir="rtl">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="grid grid-cols-3 gap-3">
            {statTiles.slice(0, 3).map(s => (
              <div key={s.label} className="rounded-xl border border-border bg-card px-3 py-3 sm:px-4">
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
                <p className={cn('mt-1 text-xl font-bold tabular-nums', s.tone)}>{s.value}</p>
              </div>
            ))}
          </div>
          <details className="self-start rounded-xl border border-border bg-card lg:min-w-64">
            <summary className="min-h-12 cursor-pointer px-4 py-3 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground">ملخص الأداء المالي</summary>
            <div className="grid grid-cols-2 gap-4 border-t border-border p-4">
              {statTiles.slice(3).map(s => <div key={s.label}><p className="text-[11px] text-muted-foreground">{s.label}</p><p className={cn('mt-1 text-[14px] font-bold tabular-nums',s.tone)}>{s.value} د.ل</p></div>)}
            </div>
          </details>
        </div>

        {/* أدوات البحث والتصفية */}
        <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                placeholder="بحث بالزبون، الشركة، رقم العقد، نوع الإعلان، الفريق..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleImmediateSearch(searchInput); }}
                className="h-10 rounded-lg pl-9 pr-9 text-xs"
              />
              {isSearching ? (
                <Loader2 className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-primary" />
              ) : searchInput ? (
                <button type="button" onClick={() => handleImmediateSearch('')} className="absolute left-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground" title="مسح البحث">
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(1); }}>
              <SelectTrigger className="h-10 w-[130px] rounded-lg text-xs"><SelectValue placeholder="الحالة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="pending">معلقة</SelectItem>
                <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                <SelectItem value="completed">مكتملة</SelectItem>
                <SelectItem value="cancelled">ملغاة</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="h-10 gap-1.5 rounded-lg text-xs">
              <RefreshCw className="h-3.5 w-3.5" />تحديث
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted/40 p-0.5" role="group" aria-label="نوع العملية">
              {typeOptions.map(o => (
                <button
                  key={o.key}
                  type="button"
                  data-on={typeFilter === o.key}
                  onClick={() => { setTypeFilter(o.key); setPage(1); }}
                  className={cn(
                    'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground',
                    'data-[on=true]:bg-card data-[on=true]:text-foreground data-[on=true]:shadow-sm',
                    o.key === 'multi' && 'data-[on=true]:text-primary',
                  )}
                >
                  {o.key === 'multi' && <Layers className="h-3 w-3" />}
                  {o.label}<span className="tabular-nums opacity-60">{o.count}</span>
                </button>
              ))}
            </div>
            <Select value={paymentFilter} onValueChange={v => { setPaymentFilter(v as typeof paymentFilter); setPage(1); }}>
              <SelectTrigger className="h-10 w-full rounded-lg text-xs sm:w-52" aria-label="حالة السداد"><SelectValue /></SelectTrigger>
              <SelectContent>{paymentOptions.map(o => <SelectItem key={o.key} value={o.key}>{o.label} ({o.count})</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {/* قائمة + تفاصيل */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">العقود ({visibleGroups.length})</span>
              {totalPages > 1 && (
                <span className="flex items-center gap-1">
                  <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="cursor-pointer rounded p-1 hover:bg-muted disabled:opacity-40" aria-label="السابق"><ChevronRight className="h-4 w-4" /></button>
                  <span className="tabular-nums">{page} / {totalPages}</span>
                  <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="cursor-pointer rounded p-1 hover:bg-muted disabled:opacity-40" aria-label="التالي"><ChevronLeft className="h-4 w-4" /></button>
                </span>
              )}
            </div>
            <div className="flex flex-col gap-3 xl:max-h-[calc(100vh-300px)] xl:overflow-y-auto xl:pl-1">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[90px] rounded-xl" />)
              ) : paginatedGroups.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/60 py-16 text-center text-muted-foreground">
                  <Package className="h-10 w-10 opacity-30" />
                  <span className="text-sm">{search ? `لا نتائج لـ «${search}»` : 'لا توجد مهام مطابقة للتصفية'}</span>
                  {search && <Button variant="outline" size="sm" onClick={() => handleImmediateSearch('')} className="h-8 text-xs">إلغاء البحث</Button>}
                </div>
              ) : (
                paginatedGroups.map(group => (
                  <HubContractRow
                    key={group.key}
                    group={group}
                    selected={selectedGroup?.key === group.key}
                    onSelect={() => setSelectedGroupKey(group.key)}
                    onOpenTask={() => {
                      const task = group.operations?.[0]?.tasks.find((t: any) => t.installation_task_id);
                      if (task) navigate(`/admin/installation-tasks?task=${encodeURIComponent(task.installation_task_id)}&from=hub`);
                    }}
                  />
                ))
              )}
            </div>
          </div>

          {isWide && (
            <div className="min-w-0 xl:max-h-[calc(100vh-270px)] xl:overflow-y-auto xl:pl-1">
              {selectedGroup ? (
                <HubContractDetail group={selectedGroup} {...groupActionProps} />
              ) : !isLoading ? (
                <div className="flex h-full min-h-[300px] items-center justify-center rounded-xl border border-dashed border-border/60 text-sm text-muted-foreground">
                  اختر عقداً من القائمة لعرض عملياته
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* الشاشات الصغيرة: التفاصيل في لوحة جانبية */}
      {!isWide && (
        <Sheet open={Boolean(selectedGroupKey && selectedGroup)} onOpenChange={(open) => { if (!open) setSelectedGroupKey(null); }}>
          <SheetContent side="right" className="w-full overflow-y-auto p-4 sm:max-w-2xl" dir="rtl">
            <SheetHeader className="mb-4 border-b border-border pb-3 pl-10 text-right"><SheetTitle>تفاصيل العقد</SheetTitle></SheetHeader>
            {selectedGroup && <HubContractDetail group={selectedGroup} {...groupActionProps} />}
          </SheetContent>
        </Sheet>
      )}

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
                <ImagePlus className="h-5 w-5 text-warning" />
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
