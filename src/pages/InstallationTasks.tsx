import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePersistedFilters } from '@/hooks/usePersistedFilters';
import { generateFallbackPath } from '@/utils/fallbackPathGenerator';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { smartArabicMatch } from '@/lib/arabicSearch';
import { uploadToImgbb } from '@/services/imgbbService';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Plus,
  ChevronDown,
  CheckCircle2,
  Clock,
  Users,
  Package,
  Printer,
  PaintBucket,
  Search,
  Filter,
  CalendarIcon,
  Trash2,
  Merge,
  RotateCcw,
  Edit,
  ArrowRight,
  FileText,
  Layers,
  Camera,
  Link2,
  Sparkles,
  X,
  Upload,
  Loader2,
  AlertTriangle,
  Link as LinkIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ar } from 'date-fns/locale';
import { format } from 'date-fns';
import { BillboardTaskCard } from '@/components/tasks/BillboardTaskCard';
import { TaskDesignManager } from '@/components/tasks/TaskDesignManager';
import { BulkDesignAssigner } from '@/components/tasks/BulkDesignAssigner';
import { TaskCompletionDialog } from '@/components/tasks/TaskCompletionDialog';
import { BillboardBulkPrintDialog } from '@/components/billboards/BillboardBulkPrintDialog';
import { CreatePrintTaskFromInstallation } from '@/components/tasks/CreatePrintTaskFromInstallation';
import { TaskTotalCostSummary } from '@/components/tasks/TaskTotalCostSummary';
import { MergeTeamTasksDialog } from '@/components/tasks/MergeTeamTasksDialog';
import { EditTaskTypeDialog } from '@/components/tasks/EditTaskTypeDialog';
import { findOptimalTeamForInstallation, sortTeamsByPriority } from '@/utils/teamAssignment';
import { TransferBillboardsDialog } from '@/components/tasks/TransferBillboardsDialog';
import { UnifiedPrintAllDialog, BillboardPrintItem } from '@/components/shared/printing/UnifiedPrintAllDialog';
import BillboardPrintSettingsDialog from '@/components/billboards/BillboardPrintSettingsDialog';
import { TaskCardWrapper } from '@/components/tasks/TaskCardWrapper';
import { EnhancedAddInstallationTaskDialog } from '@/components/installation/EnhancedAddInstallationTaskDialog';
import { MobileTaskCard } from '@/components/installation/MobileTaskCard';
import { AddBillboardsToTaskDialog } from '@/components/installation/AddBillboardsToTaskDialog';
import { InstallationTasksTable } from '@/components/installation/InstallationTasksTable';
import { InstallationTaskDetail } from '@/components/installation/InstallationTaskDetail';
import { SendInstallationReportDialog } from '@/components/installation/SendInstallationReportDialog';
import { SendTeamInstallationReportDialog } from '@/components/installation/SendTeamInstallationReportDialog';
import { UnifiedTaskInvoice, InvoiceType } from '@/components/composite-tasks/UnifiedTaskInvoice';
import { SyncMissingBillboardsDialog } from '@/components/installation/SyncMissingBillboardsDialog';
import { DuplicatesReviewDialog } from '@/components/installation/DuplicatesReviewDialog';
import { CompositeTaskWithDetails } from '@/types/composite-task';

interface InstallationTask {
  id: string;
  contract_id: number;
  contract_ids?: number[];
  team_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  task_type?: 'installation' | 'reinstallation';
  created_at: string;
  print_task_id?: string | null;
  cutout_task_id?: string | null;
  print_tasks?: { id: string; status: string } | null;
  cutout_tasks?: { id: string; status: string } | null;
  installation_teams?: { team_name: string };
}

interface InstallationTaskItem {
  id: string;
  task_id: string;
  billboard_id: number;
  status: 'pending' | 'completed';
  installation_date: string | null;
  design_face_a: string | null;
  design_face_b: string | null;
  installed_image_url: string | null;
  installed_image_face_a_url: string | null;
  installed_image_face_b_url: string | null;
  selected_design_id: string | null;
  has_cutout: boolean | null;
  faces_to_install: number | null;
  customer_installation_cost: number;
  additional_cost?: number;
  additional_cost_notes?: string | null;
}

interface TaskDesign {
  id: string;
  task_id: string;
  design_name: string;
  design_face_a_url: string;
  design_face_b_url?: string;
  design_order: number;
}

/**
 * دالة موحدة لاختيار الفريق الصحيح للوحة
 * الأولوية: مقاس + مدينة + شركة مالكة (الفرق المرتبطة بالشركة أولاً)
 */
function normalizeString(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ');
}

function findCorrectTeam(sortedTeams: any[], billboardSize: string | null, billboardCity: string | null, billboardCompanyId: string | null): any {
  return findOptimalTeamForInstallation(sortedTeams, billboardSize, billboardCity, billboardCompanyId);
}

export default function InstallationTasks() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { confirm: systemConfirm } = useSystemDialog();
  const [addTaskDialogOpen, setAddTaskDialogOpen] = useState(false);
  const [selectedContractIds, setSelectedContractIds] = useState<number[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [taskType, setTaskType] = useState<'installation' | 'reinstallation'>('installation');

  useEffect(() => {
    if (searchParams.get('create') !== '1') return;
    setAddTaskDialogOpen(true);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('create');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);
  const { filters: pageFilters, setFilter: setPageFilter } = usePersistedFilters('installation-page', {
    searchTerm: '',
    filterStatus: 'all',
    filterTeam: 'all',
    boardPage: 1,
  });
  const [searchTerm, _setSearchTerm] = useState(pageFilters.searchTerm);
  const [filterStatus, _setFilterStatus] = useState<string>(pageFilters.filterStatus);
  const [filterTeam, _setFilterTeam] = useState<string>(pageFilters.filterTeam);
  const setSearchTerm = (v: string) => { _setSearchTerm(v); setPageFilter('searchTerm', v); };
  const setFilterStatus = (v: string) => { _setFilterStatus(v); setPageFilter('filterStatus', v); };
  const setFilterTeam = (v: string) => { _setFilterTeam(v); setPageFilter('filterTeam', v); };
  const [designDialogOpen, setDesignDialogOpen] = useState(false);
  const [selectedTaskForDesign, setSelectedTaskForDesign] = useState<string | null>(null);
  const [selectedGroupTaskIds, setSelectedGroupTaskIds] = useState<string[] | null>(null);
  const [bulkDesignDialogOpen, setBulkDesignDialogOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printTaskId, setPrintTaskId] = useState<string | null>(null);
  const [createPrintTaskDialogOpen, setCreatePrintTaskDialogOpen] = useState(false);
  const [selectedTaskForPrint, setSelectedTaskForPrint] = useState<string | null>(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [selectedItemForImage, setSelectedItemForImage] = useState<InstallationTaskItem | null>(null);
  const [installedImageUrl, setInstalledImageUrl] = useState<string>('');
  const [installedImageFaceAUrl, setInstalledImageFaceAUrl] = useState<string>('');
  const [installedImageFaceBUrl, setInstalledImageFaceBUrl] = useState<string>('');
  const [uploadingInstalledA, setUploadingInstalledA] = useState(false);
  const [uploadingInstalledB, setUploadingInstalledB] = useState(false);
  const [installedUploadMethodA, setInstalledUploadMethodA] = useState<'url' | 'file'>('file');
  const [installedUploadMethodB, setInstalledUploadMethodB] = useState<'url' | 'file'>('file');
  const [pasteTargetFace, setPasteTargetFace] = useState<'A' | 'B'>('A');
  // Bulk completion
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [showTaskCompletionDialog, setShowTaskCompletionDialog] = useState(false);
  const [selectedItemsForCompletion, setSelectedItemsForCompletion] = useState<string[]>([]);
  const [selectedTaskIdForCompletion, setSelectedTaskIdForCompletion] = useState<string | null>(null);
  
  // Merge tasks dialog
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [selectedTeamForMerge, setSelectedTeamForMerge] = useState<{ id: string; name: string } | null>(null);
  const [selectedCustomerForMerge, setSelectedCustomerForMerge] = useState<string | null>(null);
  const [tasksToMerge, setTasksToMerge] = useState<any[]>([]);
  
  // Edit task type dialog
  const [editTaskTypeDialogOpen, setEditTaskTypeDialogOpen] = useState(false);
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<{ id: string; taskType: 'installation' | 'reinstallation' } | null>(null);
  
  // Transfer billboards dialog
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [selectedTaskForTransfer, setSelectedTaskForTransfer] = useState<{ taskId: string; teamId: string; teamName: string; contractId: number } | null>(null);
  
  // Print all contract billboards dialog
  const [printAllDialogOpen, setPrintAllDialogOpen] = useState(false);
  const [selectedContractForPrint, setSelectedContractForPrint] = useState<{
    contractNumber: number;
    customerName: string;
    adType?: string;
    taskId?: string;
    taskIds?: string[];
    taskType?: string;
    reinstallationNumber?: number | null;
  } | null>(null);
  
  // Print settings dialog state
  const [printSettingsDialogTaskId, setPrintSettingsDialogTaskId] = useState<string | null>(null);
  
  // Create composite task for installation only
  const [createCompositeDialogOpen, setCreateCompositeDialogOpen] = useState(false);
  const [selectedTaskForComposite, setSelectedTaskForComposite] = useState<{ taskId: string; contractId: number; customerName: string; customerId: string | null } | null>(null);
  
  // Bulk date assignment
  const [selectedItemsForDate, setSelectedItemsForDate] = useState<string[]>([]);
  const [selectedTaskIdForBulk, setSelectedTaskIdForBulk] = useState<string | null>(null);
  
  // Multi-task selection for bulk printing
  const [selectedTasksForPrint, setSelectedTasksForPrint] = useState<Set<string>>(new Set());
  const [multiTaskPrintDialogOpen, setMultiTaskPrintDialogOpen] = useState(false);
  
  // Board pagination - lifted to preserve page on re-render
  const [boardPage, _setBoardPage] = useState(pageFilters.boardPage as number);
  const setBoardPage = (v: number) => { _setBoardPage(v); setPageFilter('boardPage', v); };
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [teamReportDialogOpen, setTeamReportDialogOpen] = useState(false);
  
  // Floating selection bar date
  const [floatingInstallationDate, setFloatingInstallationDate] = useState<Date | undefined>(undefined);
  
  // Sync missing billboards dialog
  const [syncMissingDialogOpen, setSyncMissingDialogOpen] = useState(false);
  const [syncMissingContractId, setSyncMissingContractId] = useState<number>(0);
  const [syncMissingTaskIds, setSyncMissingTaskIds] = useState<string[]>([]);
  const [completionInstallationDate, setCompletionInstallationDate] = useState<Date | undefined>(new Date());
  
  // Add billboards to task dialog
  const [addBillboardsDialogOpen, setAddBillboardsDialogOpen] = useState(false);
  const [selectedTaskForAddBillboards, setSelectedTaskForAddBillboards] = useState<{
    taskId: string;
    contractId: number;
    contractIds?: number[];
    existingBillboardIds: number[];
    customerName?: string;
  } | null>(null);
  
  // Invoice dialog
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('customer');
  const [invoiceCompositeTask, setInvoiceCompositeTask] = useState<CompositeTaskWithDetails | null>(null);
  
  // Invoice handler
  const handlePrintInvoice = async (taskId: string, type: InvoiceType) => {
    const { data } = await supabase
      .from('composite_tasks')
      .select('*')
      .eq('installation_task_id', taskId)
      .maybeSingle();
    if (!data) {
      toast.error('لا توجد مهمة مجمعة مرتبطة بمهمة التركيب هذه');
      return;
    }

    // جلب contract_ids من installation_tasks لإثراء المهمة في الفاتورة
    const { data: installTaskData } = await supabase
      .from('installation_tasks')
      .select('contract_id, contract_ids')
      .eq('id', taskId)
      .maybeSingle();

    const installContractIds = installTaskData?.contract_ids?.length
      ? installTaskData.contract_ids
      : (installTaskData?.contract_id ? [installTaskData.contract_id] : []);

    const enrichedTask: CompositeTaskWithDetails = {
      ...(data as CompositeTaskWithDetails),
      contractIds: (data as any).contract_ids?.length ? (data as any).contract_ids : (installContractIds.length > 0 ? installContractIds : undefined),
      _contractIds: (data as any).contract_ids?.length ? (data as any).contract_ids : (installContractIds.length > 0 ? installContractIds : undefined),
    };

    setInvoiceCompositeTask(enrichedTask);
    setInvoiceType(type);
    setInvoiceDialogOpen(true);
  };

  // ✅ Helper: عند إكمال جميع عناصر مهمة التركيب، يتم تلقائياً تحديث حالة مهام الطباعة والقص المرتبطة
  const autoCompleteLinkedTasks = async (taskId: string) => {
    try {
      // تحقق من أن جميع العناصر في مهمة التركيب مكتملة
      const { data: items } = await supabase
        .from('installation_task_items')
        .select('status')
        .eq('task_id', taskId);
      
      if (!items || items.length === 0) return;
      const allCompleted = items.every(i => i.status === 'completed');
      if (!allCompleted) return;

      // البحث عن المهمة المجمعة المرتبطة
      const { data: composites } = await supabase
        .from('composite_tasks')
        .select('id, print_task_id, cutout_task_id')
        .eq('installation_task_id', taskId);

      if (!composites || composites.length === 0) {
        // بحث بديل: من installation_tasks مباشرة
        const { data: installTask } = await supabase
          .from('installation_tasks')
          .select('print_task_id, cutout_task_id')
          .eq('id', taskId)
          .single();
        
        if (installTask) {
          if (installTask.print_task_id) {
            await supabase.from('print_tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', installTask.print_task_id);
          }
          if (installTask.cutout_task_id) {
            await supabase.from('cutout_tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', installTask.cutout_task_id);
          }
        }
        return;
      }

      for (const ct of composites) {
        if (ct.print_task_id) {
          await supabase.from('print_tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', ct.print_task_id);
        }
        if (ct.cutout_task_id) {
          await supabase.from('cutout_tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', ct.cutout_task_id);
        }
        // تحديث حالة المهمة المجمعة أيضاً
        await supabase.from('composite_tasks').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', ct.id);
      }

      // تحديث حالة مهمة التركيب نفسها
      await supabase.from('installation_tasks').update({ status: 'completed' }).eq('id', taskId);

      console.log(`✅ Auto-completed linked tasks for installation ${taskId}`);
    } catch (error) {
      console.error('Error auto-completing linked tasks:', error);
    }
  };

  // Handle completion of multiple billboards
  const handleCompleteMultiple = async (result: 'completed' | 'not_completed', notes: string, reason?: string, installationDate?: string) => {
    if (selectedItemsForCompletion.length === 0) {
      toast.error('لم يتم تحديد أي لوحات');
      return;
    }

    try {
      // تحضير الملاحظات (دمج الملاحظات مع السبب إذا كان غير مكتمل)
      const finalNotes = result === 'not_completed' && reason 
        ? `${notes}\nسبب عدم الإنجاز: ${reason}` 
        : notes;

      // ✅ FIX: تحديث حالة العناصر أولاً
      const updateData: any = {
        status: result === 'completed' ? 'completed' : 'pending',
        notes: finalNotes || null,
        completed_at: result === 'completed' ? new Date().toISOString() : null,
      };

      // ✅ FIX: إضافة تاريخ التركيب فقط إذا كان موجوداً وصالحاً
      if (result === 'completed' && installationDate && installationDate.trim() !== '') {
        updateData.installation_date = installationDate;
      }

      const { error: updateError } = await supabase
        .from('installation_task_items')
        .update(updateData)
        .in('id', selectedItemsForCompletion);

      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }

      // ✅ حفظ السجل في billboard_history يتم تلقائياً عبر trigger قاعدة البيانات
      // (save_billboard_history_on_item_completion) — لا حاجة لكتابة يدوية هنا

      // ✅ تحقق من إكمال جميع العناصر وتحديث مهام الطباعة/القص تلقائياً
      if (result === 'completed' && selectedTaskIdForCompletion) {
        await autoCompleteLinkedTasks(selectedTaskIdForCompletion);
      }

      toast.success(`تم ${result === 'completed' ? 'إكمال' : 'تحديث'} ${selectedItemsForCompletion.length} لوحة`);
      setShowCompletionDialog(false);
      setSelectedItemsForCompletion([]);
      setSelectedTaskIdForCompletion(null);
      // إبطال الكاش لضمان تحديث البيانات فوراً
      queryClient.invalidateQueries({ queryKey: ['installation-task-items'] });
      queryClient.invalidateQueries({ queryKey: ['billboards-for-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['printer-print-tasks'] });
      refetchTaskItems();
    } catch (error) {
      console.error('Error completing tasks:', error);
      toast.error(`فشل في تحديث اللوحات: ${error.message || 'خطأ غير معروف'}`);
    }
  };
  
  // Fetch installation tasks (from Oct 2025 onwards)
  const { data: tasks = [], isLoading, refetch: refetchTasks } = useQuery({
    queryKey: ['installation-tasks'],
    queryFn: async () => {
      const oct2025 = new Date('2025-10-01');
      
      const { data: allTasks, error } = await supabase
        .from('installation_tasks')
        .select(`
          *,
          print_tasks:print_tasks!print_tasks_installation_task_id_fkey(id, status),
          cutout_tasks:cutout_tasks!cutout_tasks_installation_task_id_fkey(id, status)
        `)
        .gte('created_at', oct2025.toISOString())
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Map arrays returned by PostgREST one-to-many relationship back to single objects
      const mapped = (allTasks || []).map((t: any) => ({
        ...t,
        print_tasks: t.print_tasks && t.print_tasks.length > 0 ? t.print_tasks[0] : null,
        cutout_tasks: t.cutout_tasks && t.cutout_tasks.length > 0 ? t.cutout_tasks[0] : null,
      }));
      
      console.log(`📋 Loaded ${mapped.length || 0} installation tasks`);
      
      return mapped;
    },
  });

  // Fetch task items
  const taskIds = useMemo(() => tasks.map(t => t.id), [tasks]);
  const { data: allTaskItems = [], refetch: refetchTaskItems } = useQuery({
    queryKey: ['installation-task-items', taskIds.join(',')],
    enabled: taskIds.length > 0,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('installation_task_items')
        .select('*')
        .in('task_id', taskIds)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as InstallationTaskItem[];
    },
  });

  // Fetch billboards
  const billboardIds = useMemo(() => 
    [...new Set(allTaskItems.map(i => i.billboard_id))],
    [allTaskItems]
  );
  const { data: billboards = [], isLoading: billboardsLoading } = useQuery({
    queryKey: ['billboards-for-tasks', billboardIds.length, billboardIds.join(',')],
    enabled: billboardIds.length > 0,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      // جلب اللوحات على دفعات لتجنب مشاكل الحد الأقصى
      const batchSize = 100;
      const allBillboards: any[] = [];
      
      for (let i = 0; i < billboardIds.length; i += batchSize) {
        const batch = billboardIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('billboards')
          .select('*, friend_companies:friend_company_id(name)')
          .in('ID', batch);
        
        if (error) throw error;
        if (data) allBillboards.push(...data);
      }
      
      console.log(`📋 Loaded ${allBillboards.length} billboards for ${billboardIds.length} IDs`);
      return allBillboards;
    },
  });

  const billboardById = useMemo(() => {
    const map: Record<number, any> = {};
    billboards.forEach(b => { map[b.ID] = b; });
    return map;
  }, [billboards]);

  // ✅ استخراج العقود الفعلية لكل مهمة من العقد الأساسي + contract_ids المخزنة في المهمة
  const derivedContractIdsByTaskId = useMemo(() => {
    const map = new Map<string, number[]>();

    tasks.forEach((task: any) => {
      const ids = new Set<number>();
      if (task.contract_id) ids.add(Number(task.contract_id));
      if (task.contract_ids && Array.isArray(task.contract_ids)) {
        task.contract_ids.forEach((id: any) => {
          const numId = Number(id);
          if (numId) ids.add(numId);
        });
      }
      map.set(task.id, [...ids].filter(Boolean).sort((a, b) => a - b));
    });

    return map;
  }, [tasks]);

  // Fetch teams
  const { data: teams = [] } = useQuery({
    queryKey: ['installation-teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('installation_teams')
        .select('*');
      
      if (error) throw error;
      return data;
    },
  });

  const teamById = useMemo(() => {
    const map: Record<string, any> = {};
    teams.forEach(t => { map[t.id] = t; });
    return map;
  }, [teams]);

  // Fetch contracts - include derived contract ids from billboards
  const contractIds = useMemo(() => {
    const ids = new Set<number>();

    tasks.forEach((t: any) => {
      if (t.contract_id) ids.add(t.contract_id);
      if (t.contract_ids && Array.isArray(t.contract_ids)) {
        t.contract_ids.forEach((id: number) => ids.add(id));
      }
      const derived = derivedContractIdsByTaskId.get(t.id);
      derived?.forEach((id) => ids.add(id));
    });

    return [...ids];
  }, [tasks, derivedContractIdsByTaskId]);
  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts-for-tasks', ...contractIds],
    enabled: contractIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type", billboard_ids, customer_id')
        .in('Contract_Number', contractIds);
      
      if (error) throw error;
      return data;
    },
  });

  const contractById = useMemo(() => {
    const map: Record<number, any> = {};
    contracts.forEach(c => { map[c.Contract_Number] = c; });
    return map;
  }, [contracts]);

  // جلب أرقام هواتف العملاء من جدول customers
  const customerIds = useMemo(() => {
    const ids = new Set<string>();
    contracts.forEach(c => { if (c.customer_id) ids.add(c.customer_id); });
    return [...ids];
  }, [contracts]);

  const { data: customerPhones = {} } = useQuery({
    queryKey: ['customer-phones', ...customerIds],
    enabled: customerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, phone')
        .in('id', customerIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((c: any) => { if (c.phone) map[c.id] = c.phone; });
      return map;
    },
  });

  // Fetch all task designs
  const { data: allTaskDesigns = [], refetch: refetchDesigns } = useQuery({
    queryKey: ['task-designs', taskIds.length],
    enabled: taskIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_designs')
        .select('*')
        .in('task_id', taskIds)
        .order('design_order', { ascending: true });
      
      if (error) throw error;
      return data as TaskDesign[];
    },
  });

  const designsByTask = useMemo(() => {
    const map: Record<string, TaskDesign[]> = {};
    allTaskDesigns.forEach(d => {
      if (!map[d.task_id]) map[d.task_id] = [];
      map[d.task_id].push(d);
    });
    return map;
  }, [allTaskDesigns]);

  // Fetch installation pricing from both sizes table (primary) and installation_print_pricing (fallback)
  const { data: installationPricing = [], data: sizesRawData } = useQuery({
    queryKey: ['installation-pricing-combined'],
    queryFn: async () => {
      // ✅ Primary: Fetch from sizes table (has installation_price column + sort_order)
      const { data: sizesData, error: sizesError } = await supabase
        .from('sizes')
        .select('name, installation_price, sort_order')
        .order('sort_order', { ascending: true });
      
      if (!sizesError && sizesData && sizesData.length > 0) {
        return sizesData.map((s: any) => ({
          size: s.name,
          install_price: s.installation_price,
          sort_order: s.sort_order ?? 999,
        }));
      }
      
      // ✅ Fallback: Fetch from installation_print_pricing table
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('installation_print_pricing')
        .select('size, install_price');
      
      if (fallbackError) throw fallbackError;
      return (fallbackData || []).map((s: any) => ({ ...s, sort_order: 999 }));
    },
  });

  // Create map of size -> installation price (supports multiple formats)
  const installationPriceBySize = useMemo(() => {
    const map: Record<string, number> = {};
    installationPricing.forEach((pricing: any) => {
      const price = pricing.install_price || pricing.installation_price || 0;
      map[pricing.size] = price;
      // ✅ Also add reversed format (8x3 -> 3x8)
      const parts = pricing.size?.split('x');
      if (parts?.length === 2) {
        map[`${parts[1]}x${parts[0]}`] = price;
      }
    });
    return map;
  }, [installationPricing]);

  // Create map of size -> sort_order from sizes table
  const sizeOrderMap = useMemo(() => {
    const map: Record<string, number> = {};
    installationPricing.forEach((pricing: any) => {
      const order = pricing.sort_order ?? 999;
      map[pricing.size] = order;
      const parts = pricing.size?.split('x');
      if (parts?.length === 2) {
        map[`${parts[1]}x${parts[0]}`] = order;
      }
    });
    return map;
  }, [installationPricing]);

  // Create map of billboard ID -> installation price (based on billboard size and faces)
  // ✅ السعر الأساسي في جدول sizes هو لوجهين (2 faces)
  // - وجه واحد = السعر / 2
  // - وجهين = السعر الأساسي
  // - 3 أوجه أو أكثر = السعر * (عدد الأوجه / 2)
  const installationPricingByBillboard = useMemo(() => {
    const map: Record<number, number> = {};
    billboards.forEach((b: any) => {
      // ✅ Try exact match first, then reversed format
      let basePrice = installationPriceBySize[b.Size] || 0;
      if (basePrice === 0 && b.Size) {
        const parts = b.Size.split('x');
        if (parts.length === 2) {
          basePrice = installationPriceBySize[`${parts[1]}x${parts[0]}`] || 0;
        }
      }
      // ✅ حساب السعر حسب عدد الأوجه الفعلي
      // السعر الأساسي هو لوجهين (2 faces)
      const faces = b.Faces_Count || 2;
      let finalPrice: number;
      if (faces === 1) {
        // وجه واحد = نصف السعر
        finalPrice = Math.round(basePrice / 2);
      } else if (faces === 2) {
        // وجهين = السعر الأساسي
        finalPrice = basePrice;
      } else {
        // أكثر من وجهين = السعر * (عدد الأوجه / 2)
        finalPrice = Math.round(basePrice * (faces / 2));
      }
      map[b.ID] = finalPrice;
    });
    return map;
  }, [billboards, installationPriceBySize]);

  // Available contracts for manual task creation
  const [contractSearchTerm, setContractSearchTerm] = useState('');
  const [selectedBillboardIds, setSelectedBillboardIds] = useState<number[]>([]);
  
  const { data: availableContracts = [] } = useQuery({
    queryKey: ['available-contracts', taskType],
    enabled: addTaskDialogOpen,
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      let query = supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type", "End Date", "Contract Date", billboard_ids');
      
      if (taskType === 'reinstallation') {
        query = query.gte('End Date', today);
      }
      
      const { data, error } = await query.order('Contract_Number', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Get billboards for selected contract
  const selectedContract = useMemo(() => {
    if (selectedContractIds.length === 0) return null;
    return availableContracts.find(c => c.Contract_Number === selectedContractIds[0]);
  }, [selectedContractIds, availableContracts]);

  const { data: contractBillboards = [] } = useQuery({
    queryKey: ['contract-billboards', selectedContract?.billboard_ids, selectedContract?.Contract_Number],
    enabled: !!selectedContract?.billboard_ids,
    queryFn: async () => {
      if (!selectedContract?.billboard_ids) return [];
      const ids = selectedContract.billboard_ids.split(',').map((id: string) => parseInt(id.trim())).filter(Boolean);
      if (ids.length === 0) return [];

      // 🚫 Exclude paused billboards
      const { data: pausedRows } = await supabase
        .from('paused_billboards' as any)
        .select('billboard_id')
        .eq('contract_number', Number(selectedContract.Contract_Number));
      const pausedSet = new Set<number>((pausedRows || []).map((p: any) => Number(p.billboard_id)));
      const filteredIds = ids.filter((id: number) => !pausedSet.has(id));
      if (filteredIds.length === 0) return [];

      const { data, error } = await supabase
        .from('billboards')
        .select('*')
        .in('ID', filteredIds);

      if (error) throw error;
      return data || [];
    },
  });


  // Auto-select all billboards when contract changes
  useEffect(() => {
    if (contractBillboards.length > 0) {
      setSelectedBillboardIds(contractBillboards.map((b: any) => b.ID));
    } else {
      setSelectedBillboardIds([]);
    }
  }, [contractBillboards.length, selectedContract?.billboard_ids]);

  // Filter contracts by search term
  const filteredContracts = useMemo(() => {
    if (!contractSearchTerm) return availableContracts;
    return availableContracts.filter((c) =>
      smartArabicMatch(
        [c.Contract_Number, c['Customer Name'], c['Ad Type']],
        contractSearchTerm
      )
    );
  }, [availableContracts, contractSearchTerm]);

  // Group tasks by team for display
  const tasksByTeam = useMemo(() => {
    const map: Record<string, InstallationTask[]> = {};
    
    let filteredTasks = tasks;
    
    // Apply filters based on actual completion of items, not task.status
    if (filterStatus !== 'all' && allTaskItems.length > 0) {
      filteredTasks = filteredTasks.filter(t => {
        const taskItems = allTaskItems.filter(item => item.task_id === t.id);
        
        // إذا لم يكن هناك عناصر للمهمة، اعتبرها غير مكتملة
        if (taskItems.length === 0) {
          return filterStatus === 'pending';
        }
        
        const completedItems = taskItems.filter(item => item.status === 'completed').length;
        const isFullyCompleted = completedItems === taskItems.length;
        
        if (filterStatus === 'completed') {
          return isFullyCompleted;
        } else if (filterStatus === 'pending') {
          return !isFullyCompleted;
        }
        return true;
      });
    }
    if (filterTeam !== 'all') {
      filteredTasks = filteredTasks.filter(t => t.team_id === filterTeam);
    }
    if (searchTerm) {
      filteredTasks = filteredTasks.filter((t) => {
        const contract = contractById[t.contract_id];
        const taskBillboards = allTaskItems
          .filter((item) => item.task_id === t.id)
          .map((item) => billboardById[item.billboard_id])
          .filter(Boolean);

        const billboardFields = taskBillboards.flatMap((b) => [
          b?.Billboard_Name,
          b?.Municipality,
          b?.District,
          b?.ID,
          b?.City,
          b?.Location,
        ]);

        return smartArabicMatch(
          [
            t.contract_id,
            t.task_name,
            t.notes,
            contract?.['Customer Name'],
            contract?.['Ad Type'],
            ...billboardFields,
          ],
          searchTerm
        );
      });
    }

    filteredTasks.forEach(task => {
      const teamId = task.team_id || 'no-team';
      if (!map[teamId]) map[teamId] = [];
      map[teamId].push(task);
    });

    return map;
  }, [tasks, filterStatus, filterTeam, searchTerm, contractById, allTaskItems, billboardById]);

  // Create manual task or re-trigger auto-creation
  const createTaskMutation = useMutation({
    mutationFn: async (vars: {
      contractId: number;
      contractIds?: number[];
      billboardIds: number[];
      teamId: string | null;
      taskType: 'installation' | 'reinstallation';
      task_name?: string;
    }) => {
      const { contractId, teamId, taskType, task_name } = vars;
      const contractIds = [...new Set((vars.contractIds?.length ? vars.contractIds : [contractId]).map(Number).filter(Boolean))];
      const isMultiContract = contractIds.length > 1;
      let { billboardIds } = vars;

      if (!contractId) throw new Error('يرجى اختيار عقد');
      if (!billboardIds || billboardIds.length === 0) throw new Error('يرجى اختيار لوحة واحدة على الأقل');

      // 🚫 Safety net: never add paused billboards to a new task
      try {
        const { data: pausedRows } = await supabase
          .from('paused_billboards' as any)
          .select('billboard_id')
          .in('contract_number', contractIds);
        const pausedSet = new Set<number>((pausedRows || []).map((p: any) => Number(p.billboard_id)));
        if (pausedSet.size > 0) {
          billboardIds = billboardIds.filter((id) => !pausedSet.has(Number(id)));
        }
        if (billboardIds.length === 0) throw new Error('جميع اللوحات المختارة موقوفة في هذا العقد');
      } catch (e: any) {
        if (e?.message?.startsWith?.('جميع اللوحات')) throw e;
        console.warn('Failed to filter paused billboards:', e);
      }


      // If team is selected, create manual task for specific team
      if (teamId) {
        let taskId: string | undefined;

        // For reinstallation: always create a new task (allow multiple per contract)
        if (taskType === 'reinstallation') {
          // Get next reinstallation number for this contract
          const { data: existingReinstalls } = await supabase
            .from('installation_tasks')
            .select('reinstallation_number')
            .eq('contract_id', contractId)
            .eq('task_type', 'reinstallation')
            .order('reinstallation_number', { ascending: false })
            .limit(1);
          
          const nextNumber = ((existingReinstalls?.[0]?.reinstallation_number as number) || 0) + 1;

          const { data: newTask, error: taskError } = await supabase
            .from('installation_tasks')
            .insert({
              contract_id: contractId,
              contract_ids: contractIds,
              team_id: teamId,
              status: 'pending',
              task_type: 'reinstallation',
              reinstallation_number: nextNumber,
              task_name: task_name,
            })
            .select()
            .single();

          if (taskError) throw taskError;
          taskId = newTask.id;
        } else {
          // For normal installation: reuse existing task if found
          const { data: existingTask } = !isMultiContract ? await supabase
            .from('installation_tasks')
            .select('id')
            .eq('contract_id', contractId)
            .eq('team_id', teamId)
            .eq('task_type', 'installation')
            .maybeSingle() : { data: null };

          taskId = existingTask?.id;

          if (!taskId) {
            const { data: newTask, error: taskError } = await supabase
              .from('installation_tasks')
              .insert({
                contract_id: contractId,
                contract_ids: contractIds,
                team_id: teamId,
                status: 'pending',
                task_type: 'installation',
                task_name: task_name,
              })
              .select()
              .single();

            if (taskError) throw taskError;
            taskId = newTask.id;
          }
        }

        // Fetch Faces_Count for selected billboards to set default faces_to_install
        const { data: bbFacesData } = await supabase
          .from('billboards')
          .select('ID, Faces_Count')
          .in('ID', billboardIds);
        const facesMap: Record<number, number> = {};
        (bbFacesData || []).forEach((b: any) => { facesMap[b.ID] = b.Faces_Count || 2; });

        // Add task items for selected billboards only
        for (const billboardId of billboardIds) {
          const { data: existing } = await supabase
            .from('installation_task_items')
            .select('id')
            .eq('task_id', taskId)
            .eq('billboard_id', billboardId)
            .maybeSingle();

          if (!existing) {
            const { error: itemError } = await supabase
              .from('installation_task_items')
              .insert({
                task_id: taskId,
                billboard_id: billboardId,
                status: 'pending',
                faces_to_install: facesMap[billboardId] || 2,
              });
            if (itemError) throw itemError;
          }
        }

        return;
      }

      // No team selected = auto-distribute selected billboards to teams based on sizes
      const { data: teamsData, error: teamsError } = await supabase
        .from('installation_teams')
        .select('*');
      if (teamsError) throw teamsError;
      if (!teamsData || teamsData.length === 0) throw new Error('لا توجد فرق تركيب متاحة');

      const { data: billboardsData, error: bbError } = await supabase
        .from('billboards')
        .select('ID, Size, City, Faces_Count')
        .in('ID', billboardIds);
      if (bbError) throw bbError;
      const autoFacesMap: Record<number, number> = {};
      (billboardsData || []).forEach((b: any) => { autoFacesMap[b.ID] = b.Faces_Count || 2; });

      // Group billboards by team based on size AND city
      const billboardsByTeam: Record<string, number[]> = {};
      for (const bb of billboardsData || []) {
        const size = (bb as any).Size as string | null;
        const city = (bb as any).City as string | null;
        const id = (bb as any).ID as number;
        if (!size) continue;

        // Find team that matches BOTH size AND city (if team has cities defined)
        // Use priority to pick the best team
        const sortedTeams = [...teamsData].sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0));
        const team = sortedTeams.find((t: any) => {
          const sizeMatch = Array.isArray(t.sizes) && t.sizes.includes(size);
          if (!sizeMatch) return false;
          
          // If team has cities defined, check if billboard's city is in team's cities
          if (Array.isArray(t.cities) && t.cities.length > 0 && city) {
            return t.cities.includes(city);
          }
          // If team has no cities defined, it accepts all cities
          return true;
        });
        if (!team) continue; // لوحة بلا تطابق لا تُسند

        if (!billboardsByTeam[team.id]) billboardsByTeam[team.id] = [];
        billboardsByTeam[team.id].push(id);
      }

      // Create tasks for each team
      // Get next reinstallation number if needed
      let nextReinstallNumber = 0;
      if (taskType === 'reinstallation') {
        const { data: existingReinstalls } = await supabase
          .from('installation_tasks')
          .select('reinstallation_number')
          .eq('contract_id', contractId)
          .eq('task_type', 'reinstallation')
          .order('reinstallation_number', { ascending: false })
          .limit(1);
        nextReinstallNumber = ((existingReinstalls?.[0]?.reinstallation_number as number) || 0) + 1;
      }

      for (const [autoTeamId, autoBillboardIds] of Object.entries(billboardsByTeam)) {
        let taskId: string | undefined;

        if (taskType === 'reinstallation') {
          // Always create new task for reinstallation
          const { data: newTask, error: taskError } = await supabase
            .from('installation_tasks')
            .insert({
              contract_id: contractId,
              contract_ids: contractIds,
              team_id: autoTeamId,
              status: 'pending',
              task_type: 'reinstallation',
              reinstallation_number: nextReinstallNumber,
              task_name: task_name,
            })
            .select()
            .single();

          if (taskError) throw taskError;
          taskId = newTask.id;
        } else {
          const { data: existingTask } = !isMultiContract ? await supabase
            .from('installation_tasks')
            .select('id')
            .eq('contract_id', contractId)
            .eq('team_id', autoTeamId)
            .eq('task_type', 'installation')
            .maybeSingle() : { data: null };

          taskId = existingTask?.id;

          if (!taskId) {
            const { data: newTask, error: taskError } = await supabase
              .from('installation_tasks')
              .insert({
                contract_id: contractId,
                contract_ids: contractIds,
                team_id: autoTeamId,
                status: 'pending',
                task_type: 'installation',
                task_name: task_name,
              })
              .select()
              .single();

            if (taskError) throw taskError;
            taskId = newTask.id;
          }
        }

        for (const billboardId of autoBillboardIds) {
          const { data: existing } = await supabase
            .from('installation_task_items')
            .select('id')
            .eq('task_id', taskId)
            .eq('billboard_id', billboardId)
            .maybeSingle();

          if (!existing) {
            const { error: itemError } = await supabase
              .from('installation_task_items')
              .insert({
                task_id: taskId,
                billboard_id: billboardId,
                status: 'pending',
                faces_to_install: autoFacesMap[billboardId] || 2,
              });
            if (itemError) throw itemError;
          }
        }
      }
    },
    onSuccess: (_data, vars) => {
      toast.success(vars.teamId ? 'تم إضافة المهمة بنجاح' : 'تم توزيع المهام على الفرق تلقائياً');
      setAddTaskDialogOpen(false);
      setSelectedContractIds([]);
      setSelectedTeamId('');
      setContractSearchTerm('');
      setSelectedBillboardIds([]);
      refetchTasks();
      refetchTaskItems();
      if (searchParams.get('from') === 'hub') {
        navigate('/admin/composite-tasks', { replace: true });
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل في إضافة المهمة');
    },
  });

  // Complete task item
  const completeItemMutation = useMutation({
    mutationFn: async ({ itemId, date, notes, taskId }: { itemId: string; date: string; notes?: string; taskId?: string }) => {
      const { error } = await supabase
        .from('installation_task_items')
        .update({
          status: 'completed',
          installation_date: date,
          notes: notes || null
        })
        .eq('id', itemId);

      if (error) throw error;
      
      // ✅ تحقق من إكمال جميع العناصر وتحديث مهام الطباعة/القص تلقائياً
      if (taskId) {
        await autoCompleteLinkedTasks(taskId);
      }
    },
    onSuccess: () => {
      toast.success('تم إكمال اللوحة');
      refetchTaskItems();
      queryClient.invalidateQueries({ queryKey: ['printer-print-tasks'] });
    },
  });

  // Uncomplete task item (التراجع عن إكمال لوحة)
  const uncompleteItemMutation = useMutation({
    mutationFn: async ({ itemId, taskId }: { itemId: string; taskId: string }) => {
      // Update the item to pending
      const { error: itemError } = await supabase
        .from('installation_task_items')
        .update({ 
          status: 'pending',
          installation_date: null 
        })
        .eq('id', itemId);

      if (itemError) throw itemError;

      // Check if any items are still pending
      const { data: items } = await supabase
        .from('installation_task_items')
        .select('status')
        .eq('task_id', taskId);

      const hasPending = items?.some(i => i.status === 'pending');

      // Update task status if needed
      if (hasPending) {
        await supabase
          .from('installation_tasks')
          .update({ status: 'in_progress' })
          .eq('id', taskId);
      }
    },
    onSuccess: () => {
      toast.success('تم التراجع عن إكمال اللوحة');
      refetchTaskItems();
    },
  });

  // Create composite task for installation only (for reinstallation tasks)
  const createCompositeTaskMutation = useMutation({
    mutationFn: async ({ taskId, contractId, customerName, customerId }: { taskId: string; contractId: number; customerName: string; customerId: string | null }) => {
      // Check if composite task already exists for this installation task OR contract
      const { data: existingByTask } = await supabase
        .from('composite_tasks')
        .select('id')
        .eq('installation_task_id', taskId)
        .maybeSingle();

      if (existingByTask) {
        throw new Error('توجد مهمة مجمعة مرتبطة بهذه المهمة بالفعل');
      }

      // Get contract data
      const { data: contract } = await supabase
        .from('Contract')
        .select('installation_cost, customer_id, "Customer Name"')
        .eq('Contract_Number', contractId)
        .single();

      // Get task items with customer_installation_cost already set
      const { data: taskItemsData } = await supabase
        .from('installation_task_items')
        .select('billboard_id, customer_installation_cost')
        .eq('task_id', taskId);

      // Calculate customer installation cost from task items (this is the value set by TaskTotalCostSummary)
      let customerInstallationCost = 0;
      if (taskItemsData) {
        customerInstallationCost = taskItemsData.reduce((sum, item) => 
          sum + (item.customer_installation_cost || 0), 0
        );
      }

      // Company cost is from contract
      const companyInstallationCost = contract?.installation_cost || 0;
      const finalCustomerId = customerId || contract?.customer_id;
      const finalCustomerName = customerName || contract?.['Customer Name'] || 'غير محدد';

      // Get installation task to extract contract_ids
      const { data: installTask } = await supabase
        .from('installation_tasks')
        .select('contract_id, contract_ids')
        .eq('id', taskId)
        .maybeSingle();

      const taskContractIds = installTask?.contract_ids?.length
        ? installTask.contract_ids
        : (contractId ? [contractId] : []);

      const compositeData: any = {
        contract_id: taskContractIds.length === 1 ? taskContractIds[0] : (contractId || null),
        contract_ids: taskContractIds.length > 0 ? taskContractIds : (contractId ? [contractId] : []),
        customer_id: finalCustomerId,
        customer_name: finalCustomerName,
        task_type: 'reinstallation',
        installation_task_id: taskId,
        print_task_id: null,
        cutout_task_id: null,
        customer_installation_cost: customerInstallationCost,
        company_installation_cost: companyInstallationCost,
        customer_print_cost: 0,
        company_print_cost: 0,
        customer_cutout_cost: 0,
        company_cutout_cost: 0,
        status: 'pending'
      };

      // Check if there's an existing composite task for this contract that can be updated
      const { data: existingByContract } = await supabase
        .from('composite_tasks')
        .select('id')
        .eq('contract_id', contractId)
        .eq('task_type', 'reinstallation')
        .is('installation_task_id', null)
        .maybeSingle();

      if (existingByContract) {
        // Update existing composite task with installation task
        const { data: compositeTask, error } = await supabase
          .from('composite_tasks')
          .update(compositeData)
          .eq('id', existingByContract.id)
          .select()
          .single();

        if (error) throw error;
        return compositeTask;
      }

      // Create new composite task
      const { data: compositeTask, error } = await supabase
        .from('composite_tasks')
        .insert(compositeData)
        .select()
        .single();

      if (error) throw error;
      return compositeTask;
    },
    onSuccess: () => {
      toast.success('تم إنشاء المهمة المجمعة للتركيب بنجاح');
      setCreateCompositeDialogOpen(false);
      setSelectedTaskForComposite(null);
      queryClient.invalidateQueries({ queryKey: ['composite-tasks'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل في إنشاء المهمة المجمعة');
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      // Delete task items first
      const { error: itemsError } = await supabase
        .from('installation_task_items')
        .delete()
        .eq('task_id', taskId);
      
      if (itemsError) throw itemsError;

      // Delete task
      const { error: taskError } = await supabase
        .from('installation_tasks')
        .delete()
        .eq('id', taskId);
      
      if (taskError) throw taskError;
    },
    onSuccess: () => {
      toast.success('تم حذف المهمة');
      refetchTasks();
      refetchTaskItems();
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل في حذف المهمة');
    },
  });

  // Duplicate task as reinstallation mutation
  const duplicateAsReinstallationMutation = useMutation({
    mutationFn: async (originalTaskId: string) => {
      // 1. Fetch original task details
      const originalTask = tasks.find(t => t.id === originalTaskId);
      if (!originalTask) throw new Error('لم يتم العثور على المهمة الأصلية');

      const contractId = originalTask.contract_id;
      const teamId = originalTask.team_id;

      // 2. Calculate the next reinstallation number for this contract
      const { data: existingReinstalls, error: countError } = await supabase
        .from('installation_tasks')
        .select('reinstallation_number')
        .eq('contract_id', contractId)
        .eq('task_type', 'reinstallation')
        .order('reinstallation_number', { ascending: false })
        .limit(1);

      if (countError) throw countError;

      const nextNumber = ((existingReinstalls?.[0]?.reinstallation_number as number) || 0) + 1;

      // 3. Create the new task record
      const { data: newTask, error: taskError } = await supabase
        .from('installation_tasks')
        .insert({
          contract_id: contractId,
          team_id: teamId,
          status: 'pending',
          task_type: 'reinstallation',
          reinstallation_number: nextNumber,
          contract_ids: originalTask.contract_ids,
        })
        .select()
        .single();

      if (taskError) throw taskError;
      if (!newTask) throw new Error('فشل في إنشاء مهمة إعادة التركيب الجديدة');

      const newTaskId = newTask.id;

      // 4. Fetch the designs associated with the original task
      const { data: originalDesigns, error: designsFetchError } = await supabase
        .from('task_designs')
        .select('*')
        .eq('task_id', originalTaskId);

      if (designsFetchError) throw designsFetchError;

      const designIdMap: Record<string, string> = {};

      if (originalDesigns && originalDesigns.length > 0) {
        // Prepare new designs to insert
        const designsToInsert = originalDesigns.map(({ id, created_at, updated_at, task_id, ...rest }) => ({
          ...rest,
          task_id: newTaskId,
        }));

        // Insert new designs
        const { data: newDesigns, error: designsInsertError } = await supabase
          .from('task_designs')
          .insert(designsToInsert)
          .select();

        if (designsInsertError) throw designsInsertError;

        // Map original design IDs to new design IDs
        if (newDesigns) {
          originalDesigns.forEach((od) => {
            const nd = newDesigns.find(
              n => n.design_name === od.design_name &&
                   n.design_order === od.design_order &&
                   n.billboard_id === od.billboard_id
            );
            if (nd) {
              designIdMap[od.id] = nd.id;
            }
          });
        }
      }

      // 5. Fetch the original task items
      const { data: originalItems, error: itemsFetchError } = await supabase
        .from('installation_task_items')
        .select('*')
        .eq('task_id', originalTaskId);

      if (itemsFetchError) throw itemsFetchError;

      if (originalItems && originalItems.length > 0) {
        const itemsToInsert = originalItems.map(({
          id,
          created_at,
          updated_at,
          task_id,
          status,
          installation_date,
          installed_image_face_a_url,
          installed_image_face_b_url,
          installed_image_url,
          selected_design_id,
          reinstall_count,
          replacement_status,
          ...rest
        }) => {
          // Determine the new selected_design_id
          const newSelectedDesignId = selected_design_id ? (designIdMap[selected_design_id] || null) : null;

          return {
            ...rest,
            task_id: newTaskId,
            status: 'pending',
            installation_date: null,
            installed_image_face_a_url: null,
            installed_image_face_b_url: null,
            installed_image_url: null,
            selected_design_id: newSelectedDesignId,
            reinstall_count: (reinstall_count || 0) + 1,
            replacement_status: 'reinstalled',
          };
        });

        // Insert the items into the new task
        const { error: itemsInsertError } = await supabase
          .from('installation_task_items')
          .insert(itemsToInsert);

        if (itemsInsertError) throw itemsInsertError;
      }

      return newTaskId;
    },
    onSuccess: (newTaskId) => {
      toast.success('تم تكرار المهمة بنجاح كمهمة إعادة تركيب');
      refetchTasks();
      refetchTaskItems();
      refetchDesigns();
      setSelectedTaskId(newTaskId);
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل في تكرار المهمة');
    },
  });

  // Duplicate multiple tasks as reinstallation group mutation
  const duplicateAsReinstallationGroupMutation = useMutation({
    mutationFn: async (taskIds: string[]) => {
      const newTaskIdList: string[] = [];

      for (const originalTaskId of taskIds) {
        // 1. Fetch original task details
        const originalTask = tasks.find(t => t.id === originalTaskId);
        if (!originalTask) continue;

        const contractId = originalTask.contract_id;
        const teamId = originalTask.team_id;

        // 2. Calculate the next reinstallation number for this contract
        const { data: existingReinstalls, error: countError } = await supabase
          .from('installation_tasks')
          .select('reinstallation_number')
          .eq('contract_id', contractId)
          .eq('task_type', 'reinstallation')
          .order('reinstallation_number', { ascending: false })
          .limit(1);

        if (countError) throw countError;

        const nextNumber = ((existingReinstalls?.[0]?.reinstallation_number as number) || 0) + 1;

        // 3. Create the new task record
        const { data: newTask, error: taskError } = await supabase
          .from('installation_tasks')
          .insert({
            contract_id: contractId,
            team_id: teamId,
            status: 'pending',
            task_type: 'reinstallation',
            reinstallation_number: nextNumber,
            contract_ids: originalTask.contract_ids,
          })
          .select()
          .single();

        if (taskError) throw taskError;
        if (!newTask) continue;

        const newTaskId = newTask.id;
        newTaskIdList.push(newTaskId);

        // 4. Fetch the designs associated with the original task
        const { data: originalDesigns, error: designsFetchError } = await supabase
          .from('task_designs')
          .select('*')
          .eq('task_id', originalTaskId);

        if (designsFetchError) throw designsFetchError;

        const designIdMap: Record<string, string> = {};

        if (originalDesigns && originalDesigns.length > 0) {
          const designsToInsert = originalDesigns.map(({ id, created_at, updated_at, task_id, ...rest }) => ({
            ...rest,
            task_id: newTaskId,
          }));

          const { data: newDesigns, error: designsInsertError } = await supabase
            .from('task_designs')
            .insert(designsToInsert)
            .select();

          if (designsInsertError) throw designsInsertError;

          if (newDesigns) {
            originalDesigns.forEach((od) => {
              const nd = newDesigns.find(
                n => n.design_name === od.design_name &&
                     n.design_order === od.design_order &&
                     n.billboard_id === od.billboard_id
              );
              if (nd) {
                designIdMap[od.id] = nd.id;
              }
            });
          }
        }

        // 5. Fetch the original task items
        const { data: originalItems, error: itemsFetchError } = await supabase
          .from('installation_task_items')
          .select('*')
          .eq('task_id', originalTaskId);

        if (itemsFetchError) throw itemsFetchError;

        if (originalItems && originalItems.length > 0) {
          const itemsToInsert = originalItems.map(({
            id,
            created_at,
            updated_at,
            task_id,
            status,
            installation_date,
            installed_image_face_a_url,
            installed_image_face_b_url,
            installed_image_url,
            selected_design_id,
            reinstall_count,
            replacement_status,
            ...rest
          }) => {
            const newSelectedDesignId = selected_design_id ? (designIdMap[selected_design_id] || null) : null;

            return {
              ...rest,
              task_id: newTaskId,
              status: 'pending',
              installation_date: null,
              installed_image_face_a_url: null,
              installed_image_face_b_url: null,
              installed_image_url: null,
              selected_design_id: newSelectedDesignId,
              reinstall_count: (reinstall_count || 0) + 1,
              replacement_status: 'reinstalled',
            };
          });

          const { error: itemsInsertError } = await supabase
            .from('installation_task_items')
            .insert(itemsToInsert);

          if (itemsInsertError) throw itemsInsertError;
        }
      }

      return newTaskIdList;
    },
    onSuccess: (newTaskIdList) => {
      toast.success(`تم تكرار ${newTaskIdList.length} مهام بنجاح كمهام إعادة تركيب للفرق`);
      refetchTasks();
      refetchTaskItems();
      refetchDesigns();
      if (newTaskIdList.length === 1) {
        setSelectedTaskId(newTaskIdList[0]);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل في تكرار المهام للفرق');
    },
  });

  // ── تنظيف اللوحات المكررة (التركيب) — يستثني مهام إعادة التركيب ──
  const taskTypeById = useMemo(() => {
    const m: Record<string, string> = {};
    tasks.forEach((t: any) => { m[t.id] = t.task_type || 'installation'; });
    return m;
  }, [tasks]);

  const duplicateRows = useMemo(() => {
    // اعتبر فقط عناصر مهام التركيب (installation) غير المكتملة
    const eligible = allTaskItems.filter(i =>
      i.status !== 'completed' && (taskTypeById[i.task_id] || 'installation') === 'installation'
    );
    
    const taskTeamMap: Record<string, string> = {};
    const taskContractMap: Record<string, any> = {};
    tasks.forEach((t: any) => { taskTeamMap[t.id] = t.team_id; taskContractMap[t.id] = t.contract_id; });

    // تجميع حسب contract_id + billboard_id
    const byContractAndBillboard: Record<string, any[]> = {};
    eligible.forEach(item => {
      const contractId = taskContractMap[item.task_id] || 'no_contract';
      const key = `${contractId}_${item.billboard_id}`;
      if (!byContractAndBillboard[key]) byContractAndBillboard[key] = [];
      byContractAndBillboard[key].push(item);
    });

    const teamPriorityMap: Record<string, number> = {};
    const teamNameMap: Record<string, string> = {};
    teams.forEach((t: any) => { teamPriorityMap[t.id] = t.priority || 0; teamNameMap[t.id] = t.team_name || ''; });

    const getPriorityWeight = (priority: any) => {
      const val = Number(priority);
      if (isNaN(val) || val <= 0) return 999999;
      return val;
    };

    const rows: any[] = [];
    for (const [key, items] of Object.entries(byContractAndBillboard)) {
      if (items.length <= 1) continue;
      const [contractIdStr, bbIdStr] = key.split('_');
      const bbId = Number(bbIdStr);
      
      const sorted = [...items].sort((a, b) => {
        const pa = getPriorityWeight(teamPriorityMap[taskTeamMap[a.task_id] || '']);
        const pb = getPriorityWeight(teamPriorityMap[taskTeamMap[b.task_id] || '']);
        return pa - pb;
      });

      const highestPriorityTeamId = taskTeamMap[sorted[0].task_id] || '';
      const highestPriorityTeamName = teamNameMap[highestPriorityTeamId] || 'غير محدد';

      sorted.forEach((it, idx) => {
        const teamId = taskTeamMap[it.task_id] || '';
        const contractId = taskContractMap[it.task_id];
        const contract = contractById[contractId];
        const billboard = billboardById[bbId];
        rows.push({
          itemId: it.id,
          billboardId: bbId,
          billboardName: billboard?.Billboard_Name || `لوحة ${bbId}`,
          size: billboard?.Size || '',
          city: billboard?.City || '',
          imageUrl: billboard?.Image_URL || '',
          nearestLandmark: billboard?.Nearest_Landmark || '',
          taskId: it.task_id,
          taskShortId: String(it.task_id).slice(-6),
          teamName: teamNameMap[teamId] || 'غير محدد',
          contractName: contract?.['Customer Name'] || `عقد ${contractId}`,
          priority: teamPriorityMap[teamId] || 0,
          willKeep: idx === 0,
          reason: idx === 0 
            ? 'أعلى أولوية للفرقة' 
            : `يوجد فرقة أعلى أولوية (${highestPriorityTeamName})`,
        });
      });
    }
    return rows;
  }, [allTaskItems, tasks, teams, billboardById, contractById, taskTypeById]);

  const duplicateInstallationCount = useMemo(
    () => duplicateRows.filter(r => !r.willKeep).length,
    [duplicateRows]
  );

  const [duplicatesReviewOpen, setDuplicatesReviewOpen] = useState(false);

  const cleanupDuplicatesMutation = useMutation({
    mutationFn: async (itemsToDelete: string[]) => {
      if (!itemsToDelete || itemsToDelete.length === 0) throw new Error('لا توجد عناصر محددة للحذف');

      const { error } = await supabase
        .from('installation_task_items')
        .delete()
        .in('id', itemsToDelete);
      if (error) throw error;

      // حذف المهام الفارغة بالتحقق الفعلي من قاعدة البيانات
      const affectedTaskIds = [...new Set(
        allTaskItems.filter(i => itemsToDelete.includes(i.id)).map(i => i.task_id)
      )];
      for (const taskId of affectedTaskIds) {
        const { data: remaining, error: checkError } = await supabase
          .from('installation_task_items')
          .select('id')
          .eq('task_id', taskId)
          .limit(1);

        if (checkError) {
          console.error(`Error checking remaining items for task ${taskId}:`, checkError);
          continue;
        }

        if (!remaining || remaining.length === 0) {
          await supabase.from('installation_tasks').delete().eq('id', taskId);
        }
      }

      return itemsToDelete.length;
    },
    onSuccess: (count) => {
      toast.success(`تم حذف ${count} لوحة مكررة من مهام التركيب`);
      setDuplicatesReviewOpen(false);
      refetchTasks();
      refetchTaskItems();
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل في تنظيف المكررات');
    },
  });

  // ── إعادة التوزيع الذكي (التركيب) ──
  const redistributeMutation = useMutation({
    mutationFn: async () => {
      const pendingItems = allTaskItems.filter(i => i.status !== 'completed');
      if (pendingItems.length === 0) throw new Error('لا توجد عناصر معلقة لإعادة التوزيع');
      
      const { data: teamsData } = await supabase.from('installation_teams').select('*');
      if (!teamsData?.length) throw new Error('لا توجد فرق');
      
      const sortedTeams = [...teamsData].sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0));
      
      // بناء خريطة task_id -> task data
      const taskDataMap: Record<string, any> = {};
      tasks.forEach((t: any) => { taskDataMap[t.id] = t; });
      
      // ✅ خريطة محلية للمهام المُنشأة حديثاً أثناء هذه العملية
      const createdTasksMap: Record<string, any> = {};
      
      let movedCount = 0;
      let mergedCount = 0;
      
      // تجميع حسب contract_id + billboard_id - حذف المكررات أولاً
      const byContractAndBillboard: Record<string, typeof pendingItems> = {};
      pendingItems.forEach(item => {
        const taskObj = taskDataMap[item.task_id];
        const contractId = taskObj?.contract_id || 'no_contract';
        const key = `${contractId}_${item.billboard_id}`;
        if (!byContractAndBillboard[key]) byContractAndBillboard[key] = [];
        byContractAndBillboard[key].push(item);
      });
      
      const itemsToDelete: string[] = [];
      const itemsToMove: { id: string; newTaskId: string }[] = [];
      
      for (const [key, items] of Object.entries(byContractAndBillboard)) {
        const [contractId, billboardIdStr] = key.split('_');
        const billboardId = Number(billboardIdStr);
        const billboard = billboardById[billboardId];
        if (!billboard) continue;
        
        // حدد الفريق الصحيح (مقاس + مدينة + شركة مالكة) - أولوية للفرق المرتبطة بالشركة
        const correctTeam = findCorrectTeam(sortedTeams, billboard.Size, billboard.City, billboard.friend_company_id);
        
        if (!correctTeam) {
          items.forEach(item => itemsToDelete.push(item.id));
          continue;
        }
        
        // حذف المكررات - الاحتفاظ بأول نسخة للمركز/العقد نفسه
        if (items.length > 1) {
          for (let i = 1; i < items.length; i++) {
            itemsToDelete.push(items[i].id);
          }
        }
        
        // التحقق إذا كانت اللوحة في الفريق الصحيح
        const currentTask = taskDataMap[items[0].task_id];
        const currentTeamId = currentTask?.team_id;
        if (currentTeamId !== correctTeam.id) {
          const contractId = currentTask?.contract_id;
          if (contractId) {
            const mapKey = `${correctTeam.id}_${contractId}`;
            
            // ✅ البحث أولاً في الخريطة المحلية، ثم في المهام الموجودة
            let targetTask = createdTasksMap[mapKey] 
              || tasks.find((t: any) => t.team_id === correctTeam.id && t.contract_id === contractId && t.task_type === 'installation');
            
            if (!targetTask) {
              const { data: newTask } = await supabase
                .from('installation_tasks')
                .insert({ contract_id: contractId, team_id: correctTeam.id, status: 'pending', task_type: 'installation' })
                .select()
                .single();
              if (newTask) {
                targetTask = newTask;
                // ✅ تخزين المهمة الجديدة في الخريطة المحلية
                createdTasksMap[mapKey] = newTask;
              }
            }
            
            if (targetTask) {
              itemsToMove.push({ id: items[0].id, newTaskId: targetTask.id });
              movedCount++;
            }
          }
        }
      }
      
      // تنفيذ الحذف
      if (itemsToDelete.length > 0) {
        await supabase.from('installation_task_items').delete().in('id', itemsToDelete);
      }
      
      // تنفيذ النقل
      for (const move of itemsToMove) {
        await supabase.from('installation_task_items').update({ task_id: move.newTaskId }).eq('id', move.id);
      }
      
      // ✅ دمج المهام المكررة لنفس team_id + contract_id + task_type=installation
      const { data: allInstallTasks } = await supabase
        .from('installation_tasks')
        .select('id, team_id, contract_id, task_type, status')
        .eq('task_type', 'installation');
      
      if (allInstallTasks) {
        // تجميع حسب team_id + contract_id
        const taskGroups: Record<string, any[]> = {};
        allInstallTasks.forEach(t => {
          const key = `${t.team_id}_${t.contract_id}`;
          if (!taskGroups[key]) taskGroups[key] = [];
          taskGroups[key].push(t);
        });
        
        for (const [, groupTasks] of Object.entries(taskGroups)) {
          if (groupTasks.length <= 1) continue;
          
          // المهمة الأساسية = الأقدم (أول واحدة)
          const primaryTask = groupTasks[0];
          const duplicateTasks = groupTasks.slice(1);
          
          for (const dupTask of duplicateTasks) {
            // نقل جميع العناصر من المهمة المكررة إلى الأساسية
            const { data: dupItems } = await supabase
              .from('installation_task_items')
              .select('id, billboard_id')
              .eq('task_id', dupTask.id);
            
            if (dupItems?.length) {
              // تحقق من عدم تكرار billboard_id في المهمة الأساسية
              const { data: primaryItems } = await supabase
                .from('installation_task_items')
                .select('billboard_id')
                .eq('task_id', primaryTask.id);
              
              const primaryBillboardIds = new Set((primaryItems || []).map(i => i.billboard_id));
              
              for (const dupItem of dupItems) {
                if (primaryBillboardIds.has(dupItem.billboard_id)) {
                  // مكرر - حذفه
                  await supabase.from('installation_task_items').delete().eq('id', dupItem.id);
                } else {
                  // نقله للمهمة الأساسية
                  await supabase.from('installation_task_items').update({ task_id: primaryTask.id }).eq('id', dupItem.id);
                  primaryBillboardIds.add(dupItem.billboard_id);
                }
              }
            }
            
            // حذف المهمة المكررة
            await supabase.from('installation_tasks').delete().eq('id', dupTask.id);
            mergedCount++;
          }
        }
      }
      
      // حذف المهام الفارغة المتبقية
      const { data: remainingTasks } = await supabase
        .from('installation_tasks')
        .select('id')
        .eq('task_type', 'installation');
      
      if (remainingTasks) {
        for (const task of remainingTasks) {
          const { data: remaining } = await supabase.from('installation_task_items').select('id').eq('task_id', task.id).limit(1);
          if (!remaining || remaining.length === 0) {
            await supabase.from('installation_tasks').delete().eq('id', task.id);
          }
        }
      }
      
      return { deleted: itemsToDelete.length, moved: movedCount, merged: mergedCount };
    },
    onSuccess: (result) => {
      const parts = [];
      if (result.deleted > 0) parts.push(`${result.deleted} مكررة محذوفة`);
      if (result.moved > 0) parts.push(`${result.moved} لوحة منقولة`);
      if (result.merged > 0) parts.push(`${result.merged} مهمة مدمجة`);
      toast.success(`تم إعادة التوزيع: ${parts.join('، ') || 'لا تغييرات'}`);
      refetchTasks();
      refetchTaskItems();
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل في إعادة التوزيع');
    },
  });

  // ── مزامنة اللوحات الناقصة (التركيب) ──
  const syncMissingBillboardsMutation = useMutation({
    mutationFn: async ({ contractId, selectedBillboards: inputBillboards }: { contractId: number; selectedBillboards: { ID: number; Size: string | null; City: string | null; Faces_Count: number | null; friend_company_id: string | null }[] }) => {
      if (inputBillboards.length === 0) throw new Error('لم يتم اختيار أي لوحة');

      // 🚫 Filter paused billboards out
      const { data: pausedRows } = await supabase
        .from('paused_billboards' as any)
        .select('billboard_id')
        .eq('contract_number', contractId);
      const pausedSet = new Set<number>((pausedRows || []).map((p: any) => Number(p.billboard_id)));
      const selectedBillboards = inputBillboards.filter((b) => !pausedSet.has(Number(b.ID)));
      if (selectedBillboards.length === 0) throw new Error('جميع اللوحات المختارة موقوفة');


      const { data: teamsData } = await supabase
        .from('installation_teams')
        .select('id, team_name, sizes, cities, priority, friend_company_ids');
      
      if (!teamsData?.length) throw new Error('لا توجد فرق');
      
      const sortedTeams = [...teamsData].sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0));
      
      const createdTasksMap = new Map<string, string>();
      let addedCount = 0;

      
      for (const bb of selectedBillboards) {
        const team = findCorrectTeam(sortedTeams, bb.Size, bb.City, bb.friend_company_id);
        
        if (!team) continue;
        
        const mapKey = `${team.id}_${contractId}`;
        let existingTask = tasks.find((t: any) => t.team_id === team.id && t.contract_id === contractId);
        let targetTaskId: string;
        
        if (existingTask) {
          targetTaskId = existingTask.id;
        } else if (createdTasksMap.has(mapKey)) {
          targetTaskId = createdTasksMap.get(mapKey)!;
        } else {
          const { data: newTask, error } = await supabase
            .from('installation_tasks')
            .insert({ contract_id: contractId, team_id: team.id, status: 'pending' })
            .select('id')
            .single();
          if (error || !newTask) continue;
          targetTaskId = newTask.id;
          createdTasksMap.set(mapKey, targetTaskId);
        }
        
        const { error: insertError } = await supabase
          .from('installation_task_items')
          .insert({
            task_id: targetTaskId,
            billboard_id: bb.ID,
            status: 'pending',
            faces_to_install: bb.Faces_Count || 2,
          });
        
        if (!insertError) addedCount++;
      }
      
      return addedCount;
    },
    onSuccess: (count) => {
      toast.success(`تم إضافة ${count} لوحة ناقصة إلى مهام التركيب`);
      setSyncMissingDialogOpen(false);
      refetchTasks();
      refetchTaskItems();
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل في إضافة اللوحات الناقصة');
    },
  });

  // ── تجميع المهام المتفرقة (التركيب) ──
  const mergeTasksMutation = useMutation({
    mutationFn: async () => {
      // تجميع المهام حسب team_id + contract_id
      const groupKey = (t: any) => `${t.team_id}_${t.contract_id}`;
      const groups: Record<string, any[]> = {};
      tasks.forEach((t: any) => {
        const key = groupKey(t);
        if (!groups[key]) groups[key] = [];
        groups[key].push(t);
      });
      
      let mergedCount = 0;
      
      for (const [, groupTasks] of Object.entries(groups)) {
        if (groupTasks.length <= 1) continue;
        
        // الإبقاء على المهمة الأولى ونقل العناصر من الباقي
        const keepTask = groupTasks[0];
        const tasksToRemove = groupTasks.slice(1);
        const removeIds = tasksToRemove.map((t: any) => t.id);
        
        // نقل العناصر
        await supabase
          .from('installation_task_items')
          .update({ task_id: keepTask.id })
          .in('task_id', removeIds);
        
        // حذف المهام الفارغة
        await supabase
          .from('installation_tasks')
          .delete()
          .in('id', removeIds);
        
        mergedCount += removeIds.length;
      }
      
      return mergedCount;
    },
    onSuccess: (count) => {
      if (count === 0) {
        toast.info('لا توجد مهام متفرقة تحتاج تجميع');
      } else {
        toast.success(`تم تجميع ${count} مهمة متفرقة`);
      }
      refetchTasks();
      refetchTaskItems();
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل في تجميع المهام');
    },
  });

  const handleRefreshAll = () => {
    refetchTasks();
    refetchTaskItems();
    refetchDesigns();
  };

  // Stats - count tasks as completed if ALL their items are completed
  const stats = useMemo(() => {
    const totalTasks = tasks.length;
    const totalBillboards = allTaskItems.length;
    const completedBillboards = allTaskItems.filter(i => i.status === 'completed').length;
    
    // Count tasks where ALL items are completed as completed tasks
    const completedTasks = tasks.filter(task => {
      const taskItemsList = allTaskItems.filter(i => i.task_id === task.id);
      return taskItemsList.length > 0 && taskItemsList.every(i => i.status === 'completed');
    }).length;
    
    // Pending tasks are those that have at least one pending item or task status is pending
    const pendingTasks = tasks.filter(task => {
      const taskItemsList = allTaskItems.filter(i => i.task_id === task.id);
      return taskItemsList.some(i => i.status === 'pending') || task.status === 'pending';
    }).length;

    return { totalTasks, pendingTasks, completedTasks, totalBillboards, completedBillboards };
  }, [tasks, allTaskItems]);

  // ── New UI state ──
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(() => searchParams.get('task'));

  const selectedTaskObj = useMemo(() => selectedTaskId ? tasks.find(t => t.id === selectedTaskId) : null, [selectedTaskId, tasks]);
  const selectedTaskItemsList = useMemo(() => selectedTaskId ? allTaskItems.filter(i => i.task_id === selectedTaskId) : [], [selectedTaskId, allTaskItems]);
  // ضمّ تصاميم المهام الشقيقة التي تشترك في نفس (العقد + نوع المهمة + رقم إعادة التركيب)
  // فقط — لمنع تسرّب تصاميم مهمة التركيب الأصلية إلى مهمة إعادة التركيب، مع السماح
  // بمشاركة التصاميم بين فرق متعددة لنفس المجموعة (وهو السلوك الذي تعرضه شريط الفريق).
  const selectedTaskDesigns = useMemo(() => {
    if (!selectedTaskId || !selectedTaskObj) return [];
    const key = `${selectedTaskObj.contract_id}-${selectedTaskObj.task_type || 'installation'}-${(selectedTaskObj as any).reinstallation_number ?? 'new'}`;
    const siblingIds = tasks
      .filter(t => {
        const isSameKey = `${t.contract_id}-${t.task_type || 'installation'}-${(t as any).reinstallation_number ?? 'new'}` === key;
        if (!isSameKey) return false;

        // التحقق من أن المهمة الشقيقة تم إنشاؤها في نفس الفترة الزمنية (خلال 24 ساعة)
        // لتجنب جلب تصاميم من مهام تركيب قديمة جداً لنفس العقد
        if (t.created_at && selectedTaskObj.created_at) {
          const diffMs = Math.abs(new Date(t.created_at).getTime() - new Date(selectedTaskObj.created_at).getTime());
          const diffHours = diffMs / (1000 * 60 * 60);
          if (diffHours > 24) return false;
        }

        return true;
      })
      .map(t => t.id);
    const merged = siblingIds.flatMap(id => designsByTask[id] || []);
    // ✅ إزالة التصاميم المكررة حسب رابط التصميم (وليس فقط id) لتجنب التكرار عند توزيع التصاميم على مهمتين شقيقتين
    const seen = new Set<string>();
    return merged.filter((d: any) => {
      const key = d.design_face_a_url || d.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [selectedTaskId, selectedTaskObj, tasks, designsByTask]);
  const selectedTaskContract = useMemo(() => selectedTaskObj ? contractById[selectedTaskObj.contract_id] : null, [selectedTaskObj, contractById]);
  const selectedTeam = useMemo(() => selectedTaskObj ? teamById[selectedTaskObj.team_id] : null, [selectedTaskObj, teamById]);
  const selectedDerivedContractIds = useMemo(() => {
    if (!selectedTaskObj) return [];
    return derivedContractIdsByTaskId.get(selectedTaskObj.id) || (selectedTaskObj.contract_ids || []);
  }, [selectedTaskObj, derivedContractIdsByTaskId]);
  const selectedIsMergedTask = selectedDerivedContractIds.length > 1;

  return (
    <div className="flex flex-col min-h-full">
      <AnimatePresence mode="wait">
        {/* ── DETAIL VIEW ── */}
        {selectedTaskId && selectedTaskObj ? (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="flex flex-col min-h-full"
          >
            <InstallationTaskDetail
              task={selectedTaskObj}
              taskItems={selectedTaskItemsList}
              taskDesigns={selectedTaskDesigns}
              contract={selectedTaskContract}
              team={selectedTeam}
              billboardById={billboardById}
              contractById={contractById}
              installationPricingByBillboard={installationPricingByBillboard}
              sizeOrderMap={sizeOrderMap}
              selectedItemsForCompletion={selectedItemsForCompletion}
              selectedItemsForDate={selectedItemsForDate}
              showCompletionDialog={showCompletionDialog}
              selectedTaskIdForCompletion={selectedTaskIdForCompletion}
              isMergedTask={selectedIsMergedTask}
              derivedContractIds={selectedDerivedContractIds}
              onBack={() => {
                if (searchParams.get('from') === 'hub') {
                  navigate('/admin/composite-tasks', { replace: true });
                  return;
                }
                setSelectedTaskId(null);
                const nextParams = new URLSearchParams(searchParams);
                nextParams.delete('task');
                setSearchParams(nextParams, { replace: true });
              }}
              onSwitchTask={setSelectedTaskId}
              onManageDesigns={() => {
                setSelectedTaskForDesign(selectedTaskId);
                setSelectedGroupTaskIds(null);
                setDesignDialogOpen(true);
              }}
              onDistributeDesigns={() => {
                if (selectedTaskDesigns.length === 0) {
                  toast.info('يرجى إضافة تصاميم أولاً');
                  setSelectedTaskForDesign(selectedTaskId);
                  setSelectedGroupTaskIds(null);
                  setDesignDialogOpen(true);
                  return;
                }
                setSelectedTaskForDesign(selectedTaskId);
                setSelectedGroupTaskIds([selectedTaskId]);
                setBulkDesignDialogOpen(true);
              }}
              onEditTaskType={() => { setSelectedTaskForEdit({ id: selectedTaskId, taskType: selectedTaskObj.task_type || 'installation' }); setEditTaskTypeDialogOpen(true); }}
              onTransferBillboards={() => {
                setSelectedTaskForTransfer({
                  taskId: selectedTaskId,
                  teamId: selectedTaskObj.team_id,
                  teamName: selectedTeam?.team_name || 'غير محدد',
                  contractId: selectedTaskObj.contract_id,
                });
                setTransferDialogOpen(true);
              }}
              onPrintAll={() => {
                setSelectedContractForPrint({
                  contractNumber: selectedTaskObj.contract_id,
                  customerName: selectedTaskContract?.['Customer Name'] || 'غير محدد',
                  adType: selectedTaskContract?.['Ad Type'] || '',
                  taskId: selectedTaskObj.id,
                  taskIds: [selectedTaskObj.id],
                  taskType: selectedTaskObj.task_type || 'installation',
                  reinstallationNumber: (selectedTaskObj as any).reinstallation_number ?? null,
                });
                setPrintAllDialogOpen(true);
              }}
              onDelete={async () => { if (await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف مهمة التركيب؟', variant: 'destructive', confirmText: 'حذف' })) { deleteTaskMutation.mutate(selectedTaskId); setSelectedTaskId(null); } }}
              onDuplicateAsReinstallation={async () => {
                if (await systemConfirm({
                  title: 'تأكيد التكرار كإعادة تركيب',
                  message: 'هل أنت متأكد من تكرار هذه المهمة كمهمة إعادة تركيب؟ سيتم نسخ جميع التفاصيل وتوزيعات التصاميم، وإعادة تعيين اللوحات كمعلقة.',
                  confirmText: 'تكرار كإعادة تركيب'
                })) {
                  duplicateAsReinstallationMutation.mutate(selectedTaskId);
                }
              }}
              onCreatePrintTask={() => { setSelectedTaskForPrint(selectedTaskId); setCreatePrintTaskDialogOpen(true); }}
              onCompleteBillboards={() => {
                setSelectedTaskIdForCompletion(selectedTaskId);
                const pendingItems = selectedTaskItemsList.filter(i => i.status !== 'completed');
                const defaultSelection = pendingItems.length > 0 ? pendingItems.map(i => i.id) : selectedTaskItemsList.map(i => i.id);
                setSelectedItemsForCompletion(prev => {
                  if (selectedItemsForDate.length > 0) return [...selectedItemsForDate];
                  if (prev.length > 0) return prev;
                  return defaultSelection;
                });
                setSelectedItemsForDate([]);
                setSelectedTaskIdForBulk(null);
                setShowCompletionDialog(true);
              }}
              onSetInstallationDate={() => { setSelectedTaskIdForBulk(selectedTaskId); setSelectedItemsForDate(selectedTaskItemsList.map(i => i.id)); }}
              onAddBillboards={() => { setSelectedTaskForAddBillboards({ taskId: selectedTaskId, contractId: selectedTaskObj.contract_id, contractIds: selectedDerivedContractIds, existingBillboardIds: selectedTaskItemsList.map(i => i.billboard_id), customerName: selectedTaskContract?.['Customer Name'] || '' }); setAddBillboardsDialogOpen(true); }}
              onCreateCompositeTask={selectedTaskObj.task_type === 'reinstallation' ? () => { setSelectedTaskForComposite({ taskId: selectedTaskId, contractId: selectedTaskObj.contract_id, customerName: selectedTaskContract?.['Customer Name'] || 'غير محدد', customerId: (selectedTaskContract as any)?.customer_id || null }); setCreateCompositeDialogOpen(true); } : undefined}
              onUnmerge={selectedIsMergedTask ? async () => {
                if (!await systemConfirm({ title: 'تأكيد', message: 'هل تريد التراجع عن دمج هذه المهمة؟', confirmText: 'تراجع' })) return;
                try {
                  const { data: items } = await supabase.from('installation_task_items').select('*').eq('task_id', selectedTaskId);
                  const itemsByContract: Record<number, any[]> = {};
                  items?.forEach(item => { const contractNo = billboardById[item.billboard_id]?.Contract_Number; if (contractNo) { if (!itemsByContract[contractNo]) itemsByContract[contractNo] = []; itemsByContract[contractNo].push(item); } });
                  await supabase.from('installation_task_items').delete().eq('task_id', selectedTaskId);
                  await supabase.from('installation_tasks').delete().eq('id', selectedTaskId);
                  for (const [cId, cItems] of Object.entries(itemsByContract)) {
                    const { data: newTask } = await supabase.from('installation_tasks').insert({ contract_id: Number(cId), team_id: selectedTaskObj.team_id, status: 'pending', task_type: selectedTaskObj.task_type }).select().single();
                    if (newTask) await supabase.from('installation_task_items').insert(cItems.map(({ id, created_at, ...rest }) => ({ ...rest, task_id: newTask.id })));
                  }
                  toast.success('تم التراجع عن الدمج'); setSelectedTaskId(null); handleRefreshAll();
                } catch (err: any) { toast.error('فشل في التراجع عن الدمج: ' + err.message); }
              } : undefined}
              onDeletePrintTask={selectedTaskObj.print_task_id ? async () => {
                if (!await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف مهمة الطباعة؟', variant: 'destructive', confirmText: 'حذف' })) return;
                try {
                  await supabase.from('print_task_items').delete().eq('task_id', selectedTaskObj.print_task_id);
                  await supabase.from('print_tasks').delete().eq('id', selectedTaskObj.print_task_id);
                  await supabase.from('installation_tasks').update({ print_task_id: null }).eq('id', selectedTaskId);
                  toast.success('تم حذف مهمة الطباعة'); queryClient.invalidateQueries({ queryKey: ['installation-tasks'] });
                } catch { toast.error('فشل في حذف مهمة الطباعة'); }
              } : undefined}
              onNavigateToPrint={() => window.location.href = '/admin/print-tasks'}
              onNavigateToCutout={() => window.location.href = '/admin/cutout-tasks'}
              onSelectionChange={(itemId, checked) => {
                if (showCompletionDialog && selectedTaskIdForCompletion === selectedTaskId) {
                  if (checked) setSelectedItemsForCompletion(prev => [...prev, itemId]);
                  else setSelectedItemsForCompletion(prev => prev.filter(id => id !== itemId));
                  return;
                }

                // وضع تحديد تاريخ التركيب فقط عند تفعيله صراحة من زر "تحديد تاريخ التركيب"
                if (selectedTaskIdForBulk === selectedTaskId) {
                  if (checked) setSelectedItemsForDate(prev => [...prev, itemId]);
                  else setSelectedItemsForDate(prev => prev.filter(id => id !== itemId));
                  return;
                }

                // الوضع الافتراضي عند تحديد اللوحات: استخدام نفس تدفق الإكمال المعتمد (الشريط الأخضر)
                setSelectedTaskIdForCompletion(selectedTaskId);
                setShowCompletionDialog(true);
                if (checked) setSelectedItemsForCompletion(prev => [...prev, itemId]);
                else setSelectedItemsForCompletion(prev => prev.filter(id => id !== itemId));
              }}
              onUncomplete={(itemId) => uncompleteItemMutation.mutate({ itemId, taskId: selectedTaskId })}
              onDeleteItem={async (itemId) => {
                try { await supabase.from('installation_task_items').delete().eq('id', itemId); toast.success('تم حذف اللوحة من المهمة'); refetchTaskItems(); }
                catch (err: any) { toast.error('فشل في حذف اللوحة: ' + err.message); }
              }}
              onAddInstalledImage={(item) => { 
                setSelectedItemForImage(item); 
                setInstalledImageUrl(item.installed_image_url || ''); 
                const isReinstalled = item.replacement_status === 'reinstalled';
                const reinstalledFaces = item.reinstalled_faces || 'both';
                
                if (isReinstalled) {
                  // ذكي: تصفير فقط الوجه المعاد تركيبه والإبقاء على الآخر
                  if (reinstalledFaces === 'face_a') {
                    setInstalledImageFaceAUrl(''); // الوجه الأمامي يحتاج صورة جديدة
                    setInstalledImageFaceBUrl(item.installed_image_face_b_url || ''); // الخلفي يبقى
                  } else if (reinstalledFaces === 'face_b') {
                    setInstalledImageFaceAUrl(item.installed_image_face_a_url || ''); // الأمامي يبقى
                    setInstalledImageFaceBUrl(''); // الخلفي يحتاج صورة جديدة
                  } else {
                    setInstalledImageFaceAUrl('');
                    setInstalledImageFaceBUrl('');
                  }
                } else {
                  setInstalledImageFaceAUrl(item.installed_image_face_a_url || '');
                  setInstalledImageFaceBUrl(item.installed_image_face_b_url || '');
                }
                setImageDialogOpen(true); 
              }}
              onPrintBillboard={(taskId) => { setPrintTaskId(taskId); setPrintDialogOpen(true); }}
              onRefreshItems={refetchTaskItems}
            />

            {/* Floating Selection Bar for Completion */}
            <AnimatePresence>
              {showCompletionDialog && selectedTaskIdForCompletion === selectedTaskId && (() => {
                const pendingItems = selectedTaskItemsList.filter(i => i.status !== 'completed');
                const allSelected = pendingItems.length > 0 && pendingItems.every(i => selectedItemsForCompletion.includes(i.id));
                return (
                <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
                  className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
                  <div className="bg-emerald-600 text-white px-6 py-4 shadow-2xl rounded-2xl flex items-center gap-4 flex-wrap justify-center">
                    <Badge variant="secondary" className="bg-white text-emerald-700 text-lg px-4 py-2">{selectedItemsForCompletion.length} / {pendingItems.length}</Badge>
                    <Button 
                      variant="ghost" 
                      className="text-white hover:bg-white/20 gap-2 text-sm"
                      onClick={() => {
                        if (allSelected) {
                          setSelectedItemsForCompletion([]);
                        } else {
                          setSelectedItemsForCompletion(pendingItems.map(i => i.id));
                        }
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {allSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                    </Button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="secondary" className="gap-2 bg-white/20 hover:bg-white/30 text-white border-0">
                          <CalendarIcon className="h-4 w-4 text-white" />
                          {completionInstallationDate ? format(completionInstallationDate, 'dd MMM yyyy', { locale: ar }) : 'تاريخ التركيب'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="center">
                        <Calendar mode="single" selected={completionInstallationDate} onSelect={setCompletionInstallationDate} locale={ar} className="pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                    <Button 
                      onClick={() => {
                        if (selectedItemsForCompletion.length === 0) {
                          toast.error('يرجى تحديد لوحة واحدة على الأقل');
                          return;
                        }
                        const dateStr = completionInstallationDate ? format(completionInstallationDate, 'yyyy-MM-dd') : new Date().toISOString().split('T')[0];
                        handleCompleteMultiple('completed', '', undefined, dateStr);
                      }} 
                      disabled={selectedItemsForCompletion.length === 0} 
                      className="gap-2 bg-white text-emerald-700 hover:bg-white/90"
                    >
                      <CheckCircle2 className="h-4 w-4" />إكمال اللوحات
                    </Button>
                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => { setShowCompletionDialog(false); setSelectedItemsForCompletion([]); setSelectedTaskIdForCompletion(null); setCompletionInstallationDate(new Date()); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
                );
              })()}
            </AnimatePresence>

            {/* Floating Selection Bar for Installation Date */}
            <AnimatePresence>
              {selectedItemsForDate.length > 0 && (
                <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
                  className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
                  <div className="bg-primary text-primary-foreground px-6 py-4 shadow-2xl rounded-2xl flex items-center gap-4 flex-wrap justify-center">
                    <Badge variant="secondary" className="bg-white text-primary text-lg px-4 py-2">{selectedItemsForDate.length} لوحة محددة</Badge>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="secondary" className="gap-2 bg-white/20 hover:bg-white/30 text-white border-0">
                          <CalendarIcon className="h-4 w-4 text-white" />
                          {floatingInstallationDate ? format(floatingInstallationDate, 'dd MMM yyyy', { locale: ar }) : 'تاريخ التركيب'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="center"><Calendar mode="single" selected={floatingInstallationDate} onSelect={setFloatingInstallationDate} locale={ar} /></PopoverContent>
                    </Popover>
                    <Button onClick={async () => {
                      if (!floatingInstallationDate || selectedItemsForDate.length === 0) { toast.error('يرجى تحديد التاريخ واللوحات'); return; }
                      try {
                        const { error } = await supabase.from('installation_task_items').update({ installation_date: format(floatingInstallationDate, 'yyyy-MM-dd') }).in('id', selectedItemsForDate);
                        if (error) throw error;
                        // ✅ تحقق من إكمال جميع العناصر وتحديث مهام الطباعة/القص تلقائياً
                        if (selectedTaskIdForBulk) await autoCompleteLinkedTasks(selectedTaskIdForBulk);
                        toast.success(`تم تحديد تاريخ التركيب لـ ${selectedItemsForDate.length} لوحة`);
                        setSelectedItemsForDate([]); setFloatingInstallationDate(undefined); setSelectedTaskIdForBulk(null); refetchTaskItems();
                        queryClient.invalidateQueries({ queryKey: ['printer-print-tasks'] });
                      } catch { toast.error('فشل في تحديد تاريخ التركيب'); }
                    }} disabled={!floatingInstallationDate} className="gap-2 bg-white text-primary hover:bg-white/90">
                      <CheckCircle2 className="h-4 w-4" />تأكيد التركيب
                    </Button>
                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => { setSelectedItemsForDate([]); setFloatingInstallationDate(undefined); setSelectedTaskIdForBulk(null); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          /* ── TABLE VIEW ── */
          <motion.div
            key="list"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="flex-1 overflow-auto p-6"
          >
          <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-card/45 backdrop-blur-md border border-border/30 rounded-[22px] p-5 shadow-lg select-none">
            <div className="space-y-1 text-right">
              <h1 className="text-3xl font-black tracking-tight text-foreground bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                مهام التركيب
              </h1>
              <p className="text-xs font-medium text-muted-foreground/80">
                إدارة ومتابعة مهام تركيب وتوزيع اللوحات الإعلانية للفرق الفنية
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 mr-auto" onClick={e => e.stopPropagation()}>
              {duplicateInstallationCount > 0 && (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="gap-2 rounded-xl px-4 h-10 text-xs font-black bg-red-500/10 text-red-400 border border-red-500/25 hover:bg-red-500/20 hover:border-red-500/40 transition-all hover:scale-[1.02]" 
                  onClick={() => setDuplicatesReviewOpen(true)} 
                  disabled={cleanupDuplicatesMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5 animate-pulse" />
                  حذف {duplicateInstallationCount} مكررة
                </Button>
              )}
              
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 rounded-xl px-4 h-10 text-xs font-bold bg-background/50 border-border/30 text-muted-foreground hover:text-foreground hover:bg-muted/40 hover:border-primary/30 transition-all hover:scale-[1.02]" 
                onClick={() => redistributeMutation.mutate()} 
                disabled={redistributeMutation.isPending}
              >
                <RotateCcw className="h-3.5 w-3.5 text-amber-500" />
                {redistributeMutation.isPending ? 'جاري...' : 'إعادة توزيع'}
              </Button>

              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 rounded-xl px-4 h-10 text-xs font-bold bg-background/50 border-border/30 text-muted-foreground hover:text-foreground hover:bg-muted/40 hover:border-primary/30 transition-all hover:scale-[1.02]" 
                onClick={() => mergeTasksMutation.mutate()} 
                disabled={mergeTasksMutation.isPending}
              >
                <Merge className="h-3.5 w-3.5 text-indigo-500" />
                {mergeTasksMutation.isPending ? 'جاري...' : 'تجميع المهام'}
              </Button>

              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 rounded-xl px-4 h-10 text-xs font-bold bg-background/50 border-border/30 text-muted-foreground hover:text-foreground hover:bg-muted/40 hover:border-primary/30 transition-all hover:scale-[1.02]" 
                onClick={() => setTeamReportDialogOpen(true)}
              >
                <Users className="h-3.5 w-3.5 text-emerald-500" />
                إرسال للفرق
              </Button>

              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 rounded-xl px-4 h-10 text-xs font-bold bg-background/50 border-border/30 text-muted-foreground hover:text-foreground hover:bg-muted/40 hover:border-primary/30 transition-all hover:scale-[1.02]" 
                onClick={() => setReportDialogOpen(true)}
              >
                <FileText className="h-3.5 w-3.5 text-blue-500" />
                إرسال تقرير
              </Button>
            </div>
          </div>
          <InstallationTasksTable
            tasks={tasks}
            allTaskItems={allTaskItems}
            billboardById={billboardById}
            contractById={contractById}
            teamById={teamById}
            teams={teams}
            designsByTask={designsByTask}
            installationPricingByBillboard={installationPricingByBillboard}
            derivedContractIdsByTaskId={derivedContractIdsByTaskId}
            isLoading={isLoading}
            stats={stats}
            page={boardPage}
            onPageChange={setBoardPage}
            onOpenTask={(taskId) => setSelectedTaskId(taskId)}
            onDuplicateAsReinstallation={async (taskId) => {
              if (await systemConfirm({
                title: 'تأكيد التكرار كإعادة تركيب',
                message: 'هل أنت متأكد من تكرار هذه المهمة كمهمة إعادة تركيب؟ سيتم نسخ جميع التفاصيل وتوزيعات التصاميم، وإعادة تعيين اللوحات كمعلقة.',
                confirmText: 'تكرار كإعادة تركيب'
              })) {
                duplicateAsReinstallationMutation.mutate(taskId);
              }
            }}
            onDuplicateAsReinstallationGroup={async (taskIds) => {
              if (await systemConfirm({
                title: 'تأكيد التكرار كإعادة تركيب للفرق',
                message: 'هل أنت متأكد من تكرار كافة مهام هذه المجموعة كمهام إعادة تركيب؟ سيتم تكرارها لجميع الفرق المحددة مع المحافظة على توزيع اللوحات والتصاميم.',
                confirmText: 'تكرار كإعادة تركيب للجميع'
              })) {
                duplicateAsReinstallationGroupMutation.mutate(taskIds);
              }
            }}
            onMergeTasks={(selectedTaskIds) => {
              const selectedTasksList = tasks.filter(t => selectedTaskIds.includes(t.id));
              if (selectedTasksList.length < 2) {
                toast.error('يجب اختيار مهمتين على الأقل للدمج');
                return;
              }

              // Check if all selected tasks belong to the same team
              const firstTeamId = selectedTasksList[0].team_id;
              const sameTeam = selectedTasksList.every(t => t.team_id === firstTeamId);
              if (!sameTeam) {
                toast.error('يجب أن تكون جميع المهام المحددة مسندة لنفس الفريق لدمجها.');
                return;
              }

              // Check if all selected tasks belong to the same customer
              const firstContract = contractById[selectedTasksList[0].contract_id];
              const firstCustomerId = firstContract?.customer_id;
              const sameCustomer = selectedTasksList.every(t => {
                const contract = contractById[t.contract_id];
                return contract?.customer_id === firstCustomerId;
              });

              if (!sameCustomer) {
                toast.error('يجب أن تكون جميع المهام المحددة لزبون واحد فقط لدمجها.');
                return;
              }

              // Open MergeTeamTasksDialog
              const team = teamById[firstTeamId];
              setSelectedTeamForMerge({ id: firstTeamId, name: team?.team_name || 'الفريق' });
              setSelectedCustomerForMerge(firstCustomerId || null);
              setTasksToMerge(selectedTasksList.map(t => ({
                id: t.id,
                contract_id: t.contract_id,
                contract_name: contractById[t.contract_id]?.['Customer Name'] || 'غير محدد',
                customer_name: contractById[t.contract_id]?.['Customer Name'] || 'غير محدد',
                billboard_count: allTaskItems.filter(item => item.task_id === t.id).length,
                task_type: t.task_type,
                ad_type: contractById[t.contract_id]?.['Ad Type']
              })));
              setMergeDialogOpen(true);
            }}
            onAddTask={() => setAddTaskDialogOpen(true)}
            onRefresh={handleRefreshAll}
            onPrintAll={(taskParam) => {
              const taskIds = Array.isArray(taskParam) ? taskParam : [taskParam];
              const firstTaskId = taskIds[0];
              const t = tasks.find(x => x.id === firstTaskId);
              if (!t) return;
              const contract = contractById[t.contract_id];
              setSelectedContractForPrint({
                contractNumber: t.contract_id,
                customerName: contract?.['Customer Name'] || 'غير محدد',
                adType: contract?.['Ad Type'] || '',
                taskId: taskIds.length === 1 ? firstTaskId : undefined,
                taskIds: taskIds,
                taskType: t.task_type || 'installation',
                reinstallationNumber: (t as any).reinstallation_number ?? null,
              });
              setPrintAllDialogOpen(true);
            }}
            onSendWhatsApp={(taskId) => {
              const t = tasks.find(x => x.id === taskId);
              if (!t) return;
              const contract = contractById[t.contract_id];
              const phone = contract?.Phone;
              const customerName = contract?.['Customer Name'] || 'غير محدد';
              const adType = contract?.['Ad Type'] || '';
              const taskItemsList = allTaskItems.filter(i => i.task_id === taskId);
              const billboardNames = taskItemsList.map(item => {
                const bb = billboardById[item.billboard_id];
                return bb ? `• ${bb.Billboard_Name || `لوحة #${bb.ID}`} - ${bb.City || ''} ${bb.District || ''}` : `• لوحة #${item.billboard_id}`;
              }).join('\n');
              const message = `مرحباً ${customerName}\n\nتفاصيل مهمة التركيب:\nنوع الإعلان: ${adType}\nعدد اللوحات: ${taskItemsList.length}\n\n${billboardNames}\n\nشكراً لتعاملكم معنا`;
              if (phone) {
                const cleanPhone = phone.replace(/[^0-9+]/g, '').replace(/^\+/, '');
                window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
              } else {
                window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
              }
            }}
            onDistributeDesigns={(taskId) => {
              if (!designsByTask[taskId]?.length) { setSelectedTaskForDesign(taskId); setSelectedGroupTaskIds(null); setDesignDialogOpen(true); return; }
              setSelectedTaskForDesign(taskId); setSelectedGroupTaskIds(null); setBulkDesignDialogOpen(true);
            }}
            onManageDesigns={(taskId) => {
              setSelectedTaskForDesign(taskId);
              setSelectedGroupTaskIds(null);
              setDesignDialogOpen(true);
            }}
            onManageDesignsGroup={(taskIds) => {
              setSelectedGroupTaskIds(taskIds);
              setSelectedTaskForDesign(taskIds[0]);
              setDesignDialogOpen(true);
            }}
            onDistributeDesignsGroup={(taskIds) => {
              const hasDesigns = taskIds.some(id => designsByTask[id]?.length > 0);
              if (!hasDesigns) {
                setSelectedGroupTaskIds(taskIds);
                setSelectedTaskForDesign(taskIds[0]);
                setDesignDialogOpen(true);
                return;
              }
              setSelectedGroupTaskIds(taskIds);
              setSelectedTaskForDesign(taskIds[0]);
              setBulkDesignDialogOpen(true);
            }}
            onAddBillboard={(taskId) => {
              const t = tasks.find(x => x.id === taskId);
              if (!t) return;
              const derivedIds = derivedContractIdsByTaskId.get(taskId) || t.contract_ids || [];
              const contract = contractById[t.contract_id];
              setSelectedTaskForAddBillboards({ taskId, contractId: t.contract_id, contractIds: derivedIds, existingBillboardIds: allTaskItems.filter(i => i.task_id === taskId).map(i => i.billboard_id), customerName: contract?.['Customer Name'] || '' });
              setAddBillboardsDialogOpen(true);
            }}
            onDeleteTask={(taskId) => { deleteTaskMutation.mutate(taskId); }}
            onEditTask={(taskId) => {
              const t = tasks.find(x => x.id === taskId);
              if (!t) return;
              setSelectedTaskForEdit({ id: taskId, taskType: t.task_type || 'installation' });
              setEditTaskTypeDialogOpen(true);
            }}
            onCompleteAllBillboards={(taskId) => {
              const taskItems = allTaskItems.filter(i => i.task_id === taskId && i.status !== 'completed');
              if (taskItems.length === 0) {
                toast.info('جميع اللوحات مكتملة بالفعل');
                return;
              }
              setSelectedTaskId(taskId);
              setSelectedTaskIdForCompletion(taskId);
              setSelectedItemsForCompletion(taskItems.map(i => i.id));
              setShowCompletionDialog(true);
              setCompletionInstallationDate(new Date());
            }}
            onPrintInvoice={handlePrintInvoice}
            onCreatePrintTask={(taskId) => { setSelectedTaskForPrint(taskId); setCreatePrintTaskDialogOpen(true); }}
            onSyncMissingBillboards={(contractId, taskIds) => {
              setSyncMissingContractId(contractId);
              setSyncMissingTaskIds(taskIds);
              setSyncMissingDialogOpen(true);
            }}
          />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── DIALOGS (shared) ── */}

      {/* Add Task Dialog - Enhanced Version */}
      <EnhancedAddInstallationTaskDialog
        open={addTaskDialogOpen}
        onOpenChange={(open) => {
          setAddTaskDialogOpen(open);
          if (!open && searchParams.get('from') === 'hub') {
            navigate('/admin/composite-tasks', { replace: true });
          }
        }}
        taskType={taskType}
        onTaskTypeChange={setTaskType}
        teams={teams as any}
        isSubmitting={createTaskMutation.isPending}
        onSubmit={({ contractIds, customerId, billboardIds, teamAssignments, task_name }) => {
          // إذا كان هناك تعيينات للفرق، ننشئ مهمة لكل فرقة
          if (teamAssignments.length > 0) {
            teamAssignments.forEach(assignment => {
              createTaskMutation.mutate({
                contractId: contractIds[0],
                contractIds,
                billboardIds: assignment.billboardIds,
                teamId: assignment.teamId,
                taskType,
                task_name,
              });
            });
          } else {
            // بدون تعيينات - توزيع تلقائي
            createTaskMutation.mutate({
              contractId: contractIds[0],
              contractIds,
              billboardIds,
              teamId: null,
              taskType,
              task_name,
            });
          }
        }}
      />

      {/* Design Manager Dialog */}
      {selectedTaskForDesign && (
        <Dialog open={designDialogOpen} onOpenChange={setDesignDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>إدارة التصاميم</DialogTitle>
            </DialogHeader>
            <TaskDesignManager
              taskId={selectedTaskForDesign}
              designs={designsByTask[selectedTaskForDesign] || []}
              replicateToTaskIds={(selectedGroupTaskIds || []).filter(id => id && id !== selectedTaskForDesign)}
              onDesignsUpdate={() => {
                refetchDesigns();
                refetchTaskItems();
              }}
              contractNumber={(() => {
                const t = tasks.find(x => x.id === selectedTaskForDesign);
                return t?.contract_id;
              })()}
              customerName={(() => {
                const t = tasks.find(x => x.id === selectedTaskForDesign);
                return t ? (contractById[t.contract_id]?.['Customer Name'] || t.customer_name || '') : '';
              })()}
              adType={(() => {
                const t = tasks.find(x => x.id === selectedTaskForDesign);
                return t ? (contractById[t.contract_id]?.['Ad Type'] || '') : '';
              })()}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Bulk Design Assigner Dialog */}
      {selectedTaskForDesign && (
        <BulkDesignAssigner
          open={bulkDesignDialogOpen}
          onOpenChange={setBulkDesignDialogOpen}
          taskItems={(() => {
            const targetIds = (selectedGroupTaskIds && selectedGroupTaskIds.length > 0) ? selectedGroupTaskIds : [selectedTaskForDesign];
            return allTaskItems
              .filter(i => targetIds.includes(i.task_id))
              .map(item => ({
                ...item,
                billboards: billboardById[item.billboard_id]
              }));
          })()}
          taskDesigns={(() => {
            const targetIds = (selectedGroupTaskIds && selectedGroupTaskIds.length > 0) ? selectedGroupTaskIds : [selectedTaskForDesign];
            const all = targetIds.flatMap(id => designsByTask[id] || []);
            // ✅ إزالة التصاميم المكررة حسب رابط التصميم
            const seen = new Set<string>();
            return all.filter((d) => {
              const key = d.design_face_a_url || d.id;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          })()}
          onSuccess={() => {
            refetchTaskItems();
            setBulkDesignDialogOpen(false);
          }}
        />
      )}

      {/* Print Dialog */}
      {printTaskId && (() => {
        const currentTask = tasks.find(t => t.id === printTaskId);
        const taskBillboards = allTaskItems
          .filter(i => i.task_id === printTaskId)
          .map(i => billboardById[i.billboard_id])
          .filter(Boolean);
        // ✅ استخدام contract_id المخزن في المهمة مباشرة (وليس من بيانات اللوحة القديمة)
        const taskContractId = currentTask?.contract_id;
        const contract = taskContractId ? contractById[taskContractId] : null;
        const customerName = contract?.['Customer Name'] || currentTask?.customer_name || '';
        const adType = contract?.['Ad Type'] || '';
        const teamName = teamById[currentTask?.team_id || '']?.team_name || '';
        
        return (
          <BillboardBulkPrintDialog
            open={printDialogOpen}
            onOpenChange={setPrintDialogOpen}
            billboards={taskBillboards.map(b => {
              let item = allTaskItems.find(i => i.billboard_id === b.ID && i.task_id === printTaskId);
              
              // ✅ إذا لم يكن هناك تصميم محدد في المهمة الحالية، ابحث في المهام الشقيقة لنفس اللوحة
              if (item && !item.selected_design_id && (!item.design_face_a || item.design_face_a === b.design_face_a)) {
                const currentTask = tasks.find(t => t.id === printTaskId);
                if (currentTask) {
                  const currentType = currentTask.task_type || 'installation';
                  const currentReinstallNum = currentTask.reinstallation_number ?? null;
                  
                  const siblingItem = allTaskItems.find(i => {
                    if (i.billboard_id !== b.ID || i.task_id === printTaskId) return false;
                    const t = tasks.find(x => x.id === i.task_id);
                    if (!t) return false;
                    if (t.contract_id !== currentTask.contract_id) return false;
                    if ((t.task_type || 'installation') !== currentType) return false;
                    if (currentType === 'reinstallation') {
                      if ((t.reinstallation_number ?? null) !== currentReinstallNum) return false;
                    }
                    
                    // التحقق من تاريخ الإنشاء (خلال 24 ساعة)
                    if (t.created_at && currentTask.created_at) {
                      const diffMs = Math.abs(new Date(t.created_at).getTime() - new Date(currentTask.created_at).getTime());
                      if (diffMs / (1000 * 60 * 60) > 24) return false;
                    }
                    return true;
                  });
                  
                  if (siblingItem && siblingItem.selected_design_id) {
                    item = siblingItem; // استخدام عنصر المهمة الشقيقة لأنه يحتوي على التصميم المختار
                  }
                }
              }

              // ✅ حل تصميم اللوحة بشكل ذكي بناءً على selected_design_id والمهام الشقيقة والعقد لتجنب إظهار تصاميم قديمة أو خاطئة
              let resolvedDesignA = item?.design_face_a || b.design_face_a;
              let resolvedDesignB = item?.design_face_b || b.design_face_b;
              
              if (item) {
                const currentTask = tasks.find(t => t.id === item.task_id);
                const siblingTasks = currentTask ? tasks.filter(t => {
                  if (t.contract_id !== currentTask.contract_id) return false;
                  const tType = t.task_type || 'installation';
                  const itemType = currentTask.task_type || 'installation';
                  if (tType !== itemType) return false;
                  if (itemType === 'reinstallation') {
                    if ((t.reinstallation_number ?? null) !== (currentTask.reinstallation_number ?? null)) return false;
                  }
                  
                  // التحقق من تاريخ الإنشاء (خلال 24 ساعة)
                  if (t.created_at && currentTask.created_at) {
                    const diffMs = Math.abs(new Date(t.created_at).getTime() - new Date(currentTask.created_at).getTime());
                    if (diffMs / (1000 * 60 * 60) > 24) return false;
                  }
                  return true;
                }) : [];

                const localDesigns = siblingTasks.flatMap(t => designsByTask[t.id] || []);
                const uniqueLocalDesigns = localDesigns.filter((d: any, i: number, arr: any[]) => 
                  arr.findIndex((x: any) => x.design_face_a_url === d.design_face_a_url) === i
                );

                const allContractDesigns = tasks
                  .filter(t => t.contract_id === currentTask?.contract_id || (t.contract_ids && t.contract_ids.includes(currentTask?.contract_id || 0)))
                  .flatMap(t => designsByTask[t.id] || []);
                const uniqueContractDesigns = allContractDesigns.filter((d: any, i: number, arr: any[]) => 
                  arr.findIndex((x: any) => x.design_face_a_url === d.design_face_a_url) === i
                );

                let matched = null;
                if (item.selected_design_id) {
                  matched = uniqueLocalDesigns.find((d: any) => d.id === item.selected_design_id);
                  if (!matched) {
                    matched = uniqueContractDesigns.find((d: any) => d.id === item.selected_design_id);
                  }
                }

                if (!matched && (item.design_face_a || item.design_face_b)) {
                  matched = uniqueLocalDesigns.find((d: any) =>
                    (item.design_face_a && d.design_face_a_url === item.design_face_a) ||
                    (item.design_face_b && d.design_face_b_url === item.design_face_b)
                  );
                  if (!matched) {
                    matched = uniqueContractDesigns.find((d: any) =>
                      (item.design_face_a && d.design_face_a_url === item.design_face_a) ||
                      (item.design_face_b && d.design_face_b_url === item.design_face_b)
                    );
                  }
                }

                // الفولباك الذكي
                if (!matched && uniqueLocalDesigns.length === 1) {
                  matched = uniqueLocalDesigns[0];
                }

                if (matched) {
                  resolvedDesignA = matched.design_face_a_url || resolvedDesignA;
                  resolvedDesignB = matched.design_face_b_url || resolvedDesignB;
                }
              }

              return {
                ...b,
                design_face_a: resolvedDesignA,
                design_face_b: resolvedDesignB,
                installed_image_face_a_url: item?.installed_image_face_a_url,
                installed_image_face_b_url: item?.installed_image_face_b_url,
                installed_image_url: item?.installed_image_url
              };
            })}
            contractInfo={{
              number: currentTask?.contract_id || 0,
              customerName: customerName,
              adType: adType
            }}
          />
        );
      })()}

      {/* Create Print Task Dialog */}
      {selectedTaskForPrint && (
        <CreatePrintTaskFromInstallation
          open={createPrintTaskDialogOpen}
          onOpenChange={setCreatePrintTaskDialogOpen}
          installationTaskId={selectedTaskForPrint}
          taskItems={allTaskItems.filter(i => i.task_id === selectedTaskForPrint)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['print-tasks'] });
            toast.success('تم إنشاء مهمة الطباعة بنجاح');
          }}
        />
      )}

      {/* Add Installed Image Dialog - with imgbb upload */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              إضافة صور التركيب
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              ارفع صور التركيب أو أدخل الروابط مباشرة
            </p>
          </DialogHeader>
          {(() => {
            // Build folder path and image name for installed photos
            const getUploadContext = (face: 'A' | 'B') => {
              const nameParts: string[] = [];
              let folderPath = 'installation-photos';
              
              if (selectedItemForImage) {
                const taskItem = allTaskItems.find(i => i.id === selectedItemForImage.id);
                const taskId = taskItem?.task_id || '';
                const taskCode = `re${taskId.substring(0, 6)}`;
                const taskObj = tasks.find(t => t.id === taskId);
                const contract = taskObj ? contractById[taskObj.contract_id] : null;
                const billboard = billboardById[selectedItemForImage.billboard_id];
                const contractNum = taskObj?.contract_id ? `C${taskObj.contract_id}` : '';
                const customerName = contract?.['Customer Name'] || '';
                
                // Folder: installation-photos/{contractNum}_{taskCode}_{customerName}
                const folderName = [contractNum, taskCode, customerName].filter(Boolean).join('_').replace(/\s+/g, '-').replace(/[^\w\u0600-\u06FF_-]/g, '-');
                folderPath = `installation-photos/${folderName}`;
                
                // Image name: {billboardName}_{contractNum}_{taskCode}_face-{A/B}
                if (billboard?.Billboard_Name) nameParts.push(billboard.Billboard_Name);
                if (contractNum) nameParts.push(contractNum);
                nameParts.push(taskCode);
              }
              nameParts.push(`face-${face}`);
              const uniqueSalt = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
              nameParts.push(uniqueSalt);
              const imageName = nameParts.join('_').replace(/\s+/g, '-').replace(/[^\w\u0600-\u06FF_-]/g, '-') + '.jpg';
              return { imageName, folderPath };
            };

            // Keep backward compat
            const buildInstalledImageName = (face: 'A' | 'B') => getUploadContext(face).imageName;

            const handleInstalledFileUpload = async (file: File, face: 'A' | 'B') => {
              if (!file) return;
              const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
              if (!validTypes.includes(file.type)) {
                toast.error('يرجى اختيار ملف صورة صحيح');
                return;
              }
              if (file.size > 25 * 1024 * 1024) {
                toast.error('حجم الملف يجب أن لا يتجاوز 25MB');
                return;
              }
              const setUploading = face === 'A' ? setUploadingInstalledA : setUploadingInstalledB;
              setUploading(true);
              const { createUploadProgressTracker } = await import('@/hooks/useUploadProgress');
              const progress = createUploadProgressTracker();
              const fileSizeKB = Math.round(file.size / 1024);
              const { imageName, folderPath } = getUploadContext(face);
              progress.start(imageName, fileSizeKB);

              let pct = 5;
              const interval = setInterval(() => {
                if (pct < 30) pct += 5;
                else if (pct < 70) pct += 3;
                else if (pct < 90) pct += 1;
                progress.update(pct);
              }, 250);

              try {
                const { uploadImageWithFallback } = await import('@/services/imageUploadService');
                const imageUrl = await uploadImageWithFallback(file, imageName, folderPath);
                clearInterval(interval);
                progress.update(100);
                if (face === 'A') setInstalledImageFaceAUrl(imageUrl);
                else setInstalledImageFaceBUrl(imageUrl);
                progress.complete(true, `تم رفع صورة الوجه ${face === 'A' ? 'الأمامي' : 'الخلفي'} بنجاح`);
              } catch (error: any) {
                clearInterval(interval);
                console.error('Upload error:', error);
                progress.complete(false, error.message || 'فشل رفع الصورة. يرجى إعادة المحاولة.');
              } finally {
                setUploading(false);
              }
            };

            const handlePasteFromClipboard = async (targetFace: 'A' | 'B') => {
              try {
                if (!navigator.clipboard || !navigator.clipboard.read) {
                  toast.error('المتصفح لا يدعم الوصول للحافظة أو يتطلب اتصالاً آمناً (HTTPS)');
                  return;
                }
                const clipboardItems = await navigator.clipboard.read();
                let imageFile: File | null = null;
                
                for (const item of clipboardItems) {
                  const imageType = item.types.find(t => t.startsWith('image/'));
                  if (imageType) {
                    const blob = await item.getType(imageType);
                    imageFile = new File([blob], `pasted-image.${imageType.split('/')[1]}`, { type: imageType });
                    break;
                  }
                }

                if (imageFile) {
                  await handleInstalledFileUpload(imageFile, targetFace);
                } else {
                  // Try text (URL)
                  const text = await navigator.clipboard.readText();
                  if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
                    if (targetFace === 'A') setInstalledImageFaceAUrl(text);
                    else setInstalledImageFaceBUrl(text);
                    toast.success(`تم لصق رابط في الوجه ${targetFace === 'A' ? 'الأمامي' : 'الخلفي'}`);
                  } else {
                    toast.error('لا توجد صورة أو رابط في الحافظة');
                  }
                }
              } catch (err) {
                // Fallback to text only
                try {
                  const text = await navigator.clipboard.readText();
                  if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
                    if (targetFace === 'A') setInstalledImageFaceAUrl(text);
                    else setInstalledImageFaceBUrl(text);
                    toast.success(`تم لصق رابط في الوجه ${targetFace === 'A' ? 'الأمامي' : 'الخلفي'}`);
                  } else {
                    toast.error('لا توجد صورة أو رابط في الحافظة');
                  }
                } catch {
                  toast.error('لا يمكن الوصول إلى الحافظة');
                }
              }
            };

            const renderInstalledFaceInput = (face: 'A' | 'B') => {
              const url = face === 'A' ? installedImageFaceAUrl : installedImageFaceBUrl;
              const setUrl = face === 'A' ? setInstalledImageFaceAUrl : setInstalledImageFaceBUrl;
              const uploading = face === 'A' ? uploadingInstalledA : uploadingInstalledB;
              const uploadMethod = face === 'A' ? installedUploadMethodA : installedUploadMethodB;
              const setUploadMethod = face === 'A' ? setInstalledUploadMethodA : setInstalledUploadMethodB;
              const label = face === 'A' ? 'الوجه الأمامي' : 'الوجه الخلفي (اختياري)';
              const colorClass = face === 'A' ? 'border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/20' : 'border-blue-500/30 bg-blue-50/30 dark:bg-blue-950/20';
              const dotColor = face === 'A' ? 'bg-emerald-500' : 'bg-blue-500';
              const badgeColor = face === 'A' ? 'bg-emerald-600' : 'bg-blue-600';
              const isActive = pasteTargetFace === face;

              return (
                <div 
                  className={`p-4 rounded-xl border-2 transition-all ${isActive ? 'border-primary ring-2 ring-primary/20' : `border-dashed ${colorClass}`} space-y-3 cursor-pointer`}
                  onClick={() => setPasteTargetFace(face)}
                  onPaste={async (e) => {
                    e.preventDefault();
                    const items = e.clipboardData?.items;
                    if (!items) return;
                    
                    for (const item of Array.from(items)) {
                      if (item.type.startsWith('image/')) {
                        const file = item.getAsFile();
                        if (file) {
                          await handleInstalledFileUpload(file, face);
                          return;
                        }
                      }
                    }
                    // Fallback: check for URL text
                    const text = e.clipboardData?.getData('text');
                    if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
                      setUrl(text);
                      toast.success(`تم لصق رابط في ${label}`);
                    }
                  }}
                  tabIndex={0}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${dotColor}`} />
                      <Label className="font-bold cursor-pointer">{label}</Label>
                      {isActive && <Badge variant="outline" className="text-[10px] h-5 border-primary text-primary font-bold">هدف اللصق النشط</Badge>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handlePasteFromClipboard(face); }} className="text-xs h-7 px-2.5 font-bold" title="لصق من الحافظة">
                        لصق (Ctrl+V)
                      </Button>
                      <Button size="sm" variant={uploadMethod === 'file' ? 'default' : 'outline'} onClick={(e) => { e.stopPropagation(); setUploadMethod('file'); }} className="text-xs h-7 px-2 font-bold">
                        <Upload className="h-3 w-3 ml-1" />
                        رفع ملف
                      </Button>
                      <Button size="sm" variant={uploadMethod === 'url' ? 'default' : 'outline'} onClick={(e) => { e.stopPropagation(); setUploadMethod('url'); }} className="text-xs h-7 px-2 font-bold">
                        <LinkIcon className="h-3 w-3 ml-1" />
                        رابط
                      </Button>
                    </div>
                  </div>

                  {uploadMethod === 'url' ? (
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex-1 relative">
                        <Link2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          placeholder="الصق رابط الصورة هنا..."
                          dir="ltr"
                          className="pr-10 font-mono text-sm rounded-xl"
                          onFocus={() => setPasteTargetFace(face)}
                        />
                      </div>
                      {url && (
                        <Button variant="ghost" size="icon" onClick={() => setUrl('')} className="text-destructive hover:text-destructive rounded-xl">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div onClick={(e) => e.stopPropagation()}>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id={`installed-file-${face}`}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleInstalledFileUpload(file, face);
                          e.target.value = '';
                        }}
                      />
                      <div
                        onClick={() => !uploading && document.getElementById(`installed-file-${face}`)?.click()}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const file = e.dataTransfer.files?.[0];
                          if (file && !uploading) handleInstalledFileUpload(file, face);
                        }}
                        className="flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-xl cursor-pointer hover:bg-accent/50 transition-colors"
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="h-6 w-6 animate-spin text-primary mb-1" />
                            <span className="text-xs text-muted-foreground font-bold">جاري الرفع إلى التخزين...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                            <span className="text-xs text-muted-foreground font-semibold">اسحب الصورة هنا أو انقر للاختيار أو الصق مباشرة</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {url && (
                    <div className="relative aspect-video max-h-[180px] rounded-xl overflow-hidden border bg-background shadow-inner">
                      <img src={url} alt={`معاينة ${label}`} className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
                      <Badge className={`absolute top-2 right-2 ${badgeColor}`}>{label}</Badge>
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute top-2 left-2 h-7 w-7 rounded-lg opacity-80 hover:opacity-100 shadow-md"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUrl('');
                        }}
                        title="حذف الصورة"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            };

            return (
              <div className="space-y-4">
                {renderInstalledFaceInput('A')}
                {renderInstalledFaceInput('B')}

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={async () => {
                      if (!selectedItemForImage) return;
                       try {
                        // حساب المسارات الاحتياطية
                        const billboard = billboardById[selectedItemForImage.billboard_id];
                        const taskItem = allTaskItems.find(i => i.id === selectedItemForImage.id);
                        const taskObj = taskItem ? tasks.find(t => t.id === taskItem.task_id) : null;
                        const contract = taskObj ? contractById[taskObj.contract_id] : null;
                        const bbName = billboard?.Billboard_Name || `لوحة ${selectedItemForImage.billboard_id}`;
                        const adType = contract?.['Ad Type'] || '';
                        
                        const updateData: Record<string, any> = {
                          installed_image_url: installedImageUrl || null,
                          installed_image_face_a_url: installedImageFaceAUrl || null,
                          installed_image_face_b_url: installedImageFaceBUrl || null,
                        };
                        
                        // إنشاء المسارات الاحتياطية تلقائياً
                        if (installedImageFaceAUrl) {
                          updateData.fallback_path_installed_a = generateFallbackPath(bbName, 'installed', 'face_a', adType, selectedItemForImage.id, installedImageFaceAUrl);
                        }
                        if (installedImageFaceBUrl) {
                          updateData.fallback_path_installed_b = generateFallbackPath(bbName, 'installed', 'face_b', adType, selectedItemForImage.id, installedImageFaceBUrl);
                        }
                        
                        const { error } = await supabase
                          .from('installation_task_items')
                          .update(updateData as any)
                          .eq('id', selectedItemForImage.id);
                        if (error) throw error;
                        toast.success('تم حفظ صور التركيب بنجاح');
                        setImageDialogOpen(false);
                        setSelectedItemForImage(null);
                        setInstalledImageUrl('');
                        setInstalledImageFaceAUrl('');
                        setInstalledImageFaceBUrl('');
                        refetchTaskItems();
                      } catch (error) {
                        console.error('Error saving images:', error);
                        toast.error('فشل في حفظ صور التركيب');
                      }
                    }}
                    className="flex-1 gap-2"
                    disabled={(!installedImageFaceAUrl && !installedImageFaceBUrl) || uploadingInstalledA || uploadingInstalledB}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    حفظ الصور
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setImageDialogOpen(false);
                      setSelectedItemForImage(null);
                      setInstalledImageUrl('');
                      setInstalledImageFaceAUrl('');
                      setInstalledImageFaceBUrl('');
                    }}
                  >
                    إلغاء
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Merge Tasks Dialog */}
      {selectedTeamForMerge && (
        <MergeTeamTasksDialog
          open={mergeDialogOpen}
          onOpenChange={setMergeDialogOpen}
          teamId={selectedTeamForMerge.id}
          teamName={selectedTeamForMerge.name}
          customerId={selectedCustomerForMerge || ''}
          tasks={tasksToMerge}
          onSuccess={() => {
            handleRefreshAll();
            setMergeDialogOpen(false);
            setSelectedTeamForMerge(null);
            setSelectedCustomerForMerge(null);
            setTasksToMerge([]);
          }}
        />
      )}

      {/* Edit Task Type Dialog */}
      {selectedTaskForEdit && (
        <EditTaskTypeDialog
          open={editTaskTypeDialogOpen}
          onOpenChange={setEditTaskTypeDialogOpen}
          taskId={selectedTaskForEdit.id}
          currentTaskType={selectedTaskForEdit.taskType}
          onSuccess={() => {
            handleRefreshAll();
            setSelectedTaskForEdit(null);
          }}
        />
      )}

      {/* Transfer Billboards Dialog */}
      {selectedTaskForTransfer && (
        <TransferBillboardsDialog
          open={transferDialogOpen}
          onOpenChange={setTransferDialogOpen}
          sourceTaskId={selectedTaskForTransfer.taskId}
          sourceTeamId={selectedTaskForTransfer.teamId}
          sourceTeamName={selectedTaskForTransfer.teamName}
          taskItems={allTaskItems.filter(i => i.task_id === selectedTaskForTransfer.taskId)}
          billboards={billboardById}
          teams={teams}
          contractId={selectedTaskForTransfer.contractId}
          onSuccess={() => {
            handleRefreshAll();
            setSelectedTaskForTransfer(null);
          }}
        />
      )}

      {/* Print All Contract Billboards Dialog */}
      {selectedContractForPrint && (() => {
        const targetTaskIds = selectedContractForPrint.taskIds && selectedContractForPrint.taskIds.length > 0
          ? new Set(selectedContractForPrint.taskIds)
          : selectedContractForPrint.taskId
            ? new Set([selectedContractForPrint.taskId])
            : null;

        const contractTaskItems = allTaskItems.filter(item => {
          if (targetTaskIds) {
            return targetTaskIds.has(item.task_id);
          }
          const itemTask = tasks.find(t => t.id === item.task_id);
          if (!itemTask) return false;
          const matchContract = itemTask.contract_id === selectedContractForPrint.contractNumber || 
                 (itemTask.contract_ids && itemTask.contract_ids.includes(selectedContractForPrint.contractNumber));
          if (!matchContract) return false;
          if (selectedContractForPrint.taskType) {
            const itemTaskType = itemTask.task_type || 'installation';
            if (itemTaskType !== selectedContractForPrint.taskType) return false;
            if (itemTaskType === 'reinstallation') {
              return (itemTask.reinstallation_number ?? null) === (selectedContractForPrint.reinstallationNumber ?? null);
            }
          }
          return true;
        });

        const bulkPrintItems: BillboardPrintItem[] = contractTaskItems.map(item => {
          const itemTask = tasks.find(t => t.id === item.task_id);
          const taskDesigns = item.task_id ? designsByTask[item.task_id] : null;
          const matchedDesign = item.selected_design_id ? taskDesigns?.find((d: any) => d.id === item.selected_design_id) : null;
          const designA = item.design_face_a || matchedDesign?.design_face_a_url || matchedDesign?.design_face_a || (taskDesigns && (taskDesigns[0]?.design_face_a_url || taskDesigns[0]?.design_face_a));
          const designB = item.design_face_b || matchedDesign?.design_face_b_url || matchedDesign?.design_face_b || (taskDesigns && (taskDesigns[0]?.design_face_b_url || taskDesigns[0]?.design_face_b));
          return {
            id: item.id,
            billboard_id: item.billboard_id,
            design_face_a: designA,
            design_face_b: designB,
            installed_image_face_a_url: item.installed_image_face_a_url,
            installed_image_face_b_url: item.installed_image_face_b_url,
            installation_date: item.installation_date,
            team_id: itemTask?.team_id,
            has_cutout: item.has_cutout,
            contract_number: itemTask?.contract_id,
            ad_type: selectedContractForPrint.adType,
            overlay_config: (item as any).overlay_config || billboardById[item.billboard_id]?.overlay_config,
          };
        });
        const contractObj = contractById[selectedContractForPrint.contractNumber];
        const custPhone = contractObj?.customer_id ? (customerPhones as Record<string, string>)[contractObj.customer_id] || '' : '';

        const isReinstallation = selectedContractForPrint.taskType === 'reinstallation';
        const reinstallNum = selectedContractForPrint.reinstallationNumber;
        const dialogTitle = isReinstallation
          ? `طباعة إعادة تركيب${reinstallNum ? ` (${reinstallNum})` : ''} - عقد #${selectedContractForPrint.contractNumber} (${bulkPrintItems.length} لوحة)`
          : undefined;

        return (
          <UnifiedPrintAllDialog
            open={printAllDialogOpen}
            onOpenChange={setPrintAllDialogOpen}
            contextType="installation"
            contextNumber={selectedContractForPrint.contractNumber}
            customerName={selectedContractForPrint.customerName}
            adType={selectedContractForPrint.adType}
            items={bulkPrintItems}
            billboards={billboardById}
            teams={teamById}
            showTeamFilter={true}
            customerPhone={custPhone}
            title={dialogTitle}
          />
        );
      })()}

      {/* Create Composite Task Dialog for Installation Only */}
      <Dialog open={createCompositeDialogOpen} onOpenChange={setCreateCompositeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>إنشاء مهمة مجمعة للتركيب</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedTaskForComposite && (
              <>
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">رقم العقد:</span>
                    <span className="font-bold">#{selectedTaskForComposite.contractId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الزبون:</span>
                    <span className="font-bold">{selectedTaskForComposite.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">نوع المهمة:</span>
                    <Badge className="bg-amber-600 text-white">إعادة تركيب</Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  سيتم إنشاء مهمة مجمعة تحتوي على تكلفة التركيب فقط. يمكنك لاحقاً إضافة مهام الطباعة والقص من صفحة المهام المجمعة.
                </p>
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCreateCompositeDialogOpen(false);
                      setSelectedTaskForComposite(null);
                    }}
                  >
                    إلغاء
                  </Button>
                  <Button
                    onClick={() => {
                      if (selectedTaskForComposite) {
                        createCompositeTaskMutation.mutate({
                          taskId: selectedTaskForComposite.taskId,
                          contractId: selectedTaskForComposite.contractId,
                          customerName: selectedTaskForComposite.customerName,
                          customerId: selectedTaskForComposite.customerId
                        });
                      }
                    }}
                    disabled={createCompositeTaskMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    {createCompositeTaskMutation.isPending ? 'جاري الإنشاء...' : 'إنشاء المهمة المجمعة'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Multi-Task Print Dialog - طباعة المهام المحددة */}
      {multiTaskPrintDialogOpen && selectedTasksForPrint.size > 0 && (() => {
        const selectedTasks = tasks.filter(t => selectedTasksForPrint.has(t.id));
        const selectedItems = allTaskItems.filter(item => 
          selectedTasks.some(t => t.id === item.task_id)
        );
        const firstTask = selectedTasks[0];
        const customerNames = [...new Set(
          selectedTasks.map(t => contractById[t.contract_id]?.['Customer Name'] || 'غير محدد')
        )].join(' - ');
        
        const multiPrintItems: BillboardPrintItem[] = selectedItems.map(item => {
          const itemTask = tasks.find(t => t.id === item.task_id);
          const taskDesigns = item.task_id ? designsByTask[item.task_id] : null;
          const designA = item.design_face_a || (taskDesigns && taskDesigns[0]?.design_face_a);
          const designB = item.design_face_b || (taskDesigns && taskDesigns[0]?.design_face_b);
          return {
            id: item.id,
            billboard_id: item.billboard_id,
            design_face_a: designA,
            design_face_b: designB,
            installed_image_face_a_url: item.installed_image_face_a_url,
            installed_image_face_b_url: item.installed_image_face_b_url,
            installation_date: item.installation_date,
            team_id: itemTask?.team_id,
            has_cutout: item.has_cutout,
            contract_number: itemTask?.contract_id,
            overlay_config: (item as any).overlay_config || billboardById[item.billboard_id]?.overlay_config,
          };
        });
        const contractObj = contractById[firstTask?.contract_id];
        const custPhone = contractObj?.customer_id ? (customerPhones as Record<string, string>)[contractObj.customer_id] || '' : '';

        return (
          <UnifiedPrintAllDialog
            open={multiTaskPrintDialogOpen}
            onOpenChange={(open) => {
              setMultiTaskPrintDialogOpen(open);
              if (!open) {
                setSelectedTasksForPrint(new Set());
              }
            }}
            contextType="installation"
            contextNumber={firstTask?.contract_id || 0}
            customerName={customerNames}
            items={multiPrintItems}
            billboards={billboardById}
            teams={teamById}
            showTeamFilter={true}
            customerPhone={custPhone}
            title={`طباعة ${selectedTasksForPrint.size} مهمة (${multiPrintItems.length} لوحة)`}
          />
        );
      })()}

      {/* Add Billboards to Task Dialog */}
      {selectedTaskForAddBillboards && (
        <AddBillboardsToTaskDialog
          open={addBillboardsDialogOpen}
          onOpenChange={setAddBillboardsDialogOpen}
          taskId={selectedTaskForAddBillboards.taskId}
          contractId={selectedTaskForAddBillboards.contractId}
          contractIds={selectedTaskForAddBillboards.contractIds}
          existingBillboardIds={selectedTaskForAddBillboards.existingBillboardIds}
          customerName={selectedTaskForAddBillboards.customerName}
          onSuccess={() => {
            refetchTaskItems();
            setSelectedTaskForAddBillboards(null);
          }}
        />
      )}

      {/* Task Completion Dialog for bulk billboard completion */}
      <TaskCompletionDialog
        open={showTaskCompletionDialog}
        onOpenChange={(open) => {
          setShowTaskCompletionDialog(open);
          if (!open) {
            // Don't close the selection bar, just the dialog
          }
        }}
        selectedCount={selectedItemsForCompletion.length}
        onComplete={(result, notes, reason, installationDate) => {
          setShowTaskCompletionDialog(false);
          handleCompleteMultiple(result, notes, reason, installationDate);
        }}
      />

      <SendInstallationReportDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        tasks={tasks}
        allTaskItems={allTaskItems}
        billboardById={billboardById}
        teamById={teamById}
        contractById={contractById}
        designsByTask={designsByTask}
      />

      <SendTeamInstallationReportDialog
        open={teamReportDialogOpen}
        onOpenChange={setTeamReportDialogOpen}
        tasks={tasks}
        allTaskItems={allTaskItems}
        billboardById={billboardById}
        teamById={teamById}
        contractById={contractById}
        designsByTask={designsByTask}
        teams={teams}
      />

      {/* Sync Missing Billboards Dialog */}
      <SyncMissingBillboardsDialog
        open={syncMissingDialogOpen}
        onOpenChange={setSyncMissingDialogOpen}
        contractId={syncMissingContractId}
        taskIds={syncMissingTaskIds}
        existingBillboardIds={new Set(
          allTaskItems
            .filter(item => syncMissingTaskIds.includes(item.task_id))
            .map(item => item.billboard_id)
        )}
        billboardById={billboardById}
        onConfirm={(selectedBillboards) => {
          syncMissingBillboardsMutation.mutate({
            contractId: syncMissingContractId,
            selectedBillboards: selectedBillboards.map(b => ({
              ID: b.ID,
              Size: b.Size,
              City: b.City,
              Faces_Count: b.Faces_Count,
              friend_company_id: b.friend_company_id,
            })),
          });
        }}
        isAdding={syncMissingBillboardsMutation.isPending}
      />

      {invoiceCompositeTask && (
        <UnifiedTaskInvoice
          open={invoiceDialogOpen}
          onOpenChange={setInvoiceDialogOpen}
          task={invoiceCompositeTask}
          invoiceType={invoiceType}
        />
      )}

      <DuplicatesReviewDialog
        open={duplicatesReviewOpen}
        onOpenChange={setDuplicatesReviewOpen}
        rows={duplicateRows}
        onConfirm={(ids) => cleanupDuplicatesMutation.mutate(ids)}
        isPending={cleanupDuplicatesMutation.isPending}
      />
    </div>
  );
}
