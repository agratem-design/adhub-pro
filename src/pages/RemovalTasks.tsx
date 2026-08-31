import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Users, 
  Package, 
  ChevronDown,
  ChevronUp,
  MapPin, 
  Navigation, 
  ZoomIn, 
  Printer, 
  CheckSquare,
  Square,
  X,
  Trash2,
  Camera,
  BarChart3,
  MessageCircle,
  RotateCcw,
  Merge,
  Wrench,
  ShieldAlert,
  RefreshCw
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BillboardBulkPrintDialog } from '@/components/billboards/BillboardBulkPrintDialog';
import { RemovalStatsDialog } from '@/components/reports/RemovalStatsDialog';
import { UnifiedPrintAllDialog, BillboardPrintItem } from '@/components/shared/printing/UnifiedPrintAllDialog';
import { ExpiredContractsAlert, AddRemovalTaskDialog, RemovalTaskCard, ManualRemovalTaskDialog, RemovalTaskItemCard } from '@/components/removal';
import { RemovalTasksBoard } from '@/components/removal/RemovalTasksBoard';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
import { SendTeamInstallationReportDialog } from '@/components/installation/SendTeamInstallationReportDialog';
import { findOptimalTeamForRemoval, sortTeamsByPriority } from '@/utils/teamAssignment';
import { 
  checkIsAvailableForAvailableExports, 
  checkIsAvailableOrUpcomingForExport, 
  resolveBillboardAvailability 
} from '@/services/billboardAvailabilityService';

interface RemovalTask {
  id: string;
  contract_id: number;
  contract_ids?: number[];
  team_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  Contract?: any;
  installation_teams?: any;
}

interface RemovalTaskItem {
  id: string;
  task_id: string;
  billboard_id: number;
  status: 'pending' | 'completed';
  completed_at: string | null;
  removal_date: string | null;
  notes: string | null;
  removed_image_url: string | null;
  installed_image_url?: string | null;
  design_face_a?: string | null;
  design_face_b?: string | null;
  billboards?: any;
}

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

function findCorrectTeamForRemoval(sortedTeams: any[], billboardSize: string | null, billboardCity: string | null, billboardCompanyId: string | null): any {
  return findOptimalTeamForRemoval(sortedTeams, billboardSize, billboardCity, billboardCompanyId);
}

async function getLatestInstallationSnapshot(contractIds: number[], billboardId: number) {
  const normalizedContractIds = [...new Set(contractIds.map(Number).filter(Number.isFinite))];
  if (normalizedContractIds.length === 0) return null;

  const { data: installationTasks, error: tasksError } = await supabase
    .from('installation_tasks')
    .select('id')
    .in('contract_id', normalizedContractIds);
  if (tasksError) throw tasksError;

  const taskIds = (installationTasks || []).map((task: any) => task.id).filter(Boolean);
  if (taskIds.length === 0) return null;

  const { data, error } = await supabase
    .from('installation_task_items')
    .select('design_face_a, design_face_b, installed_image_url, installed_image_face_a_url, installed_image_face_b_url')
    .eq('billboard_id', billboardId)
    .in('task_id', taskIds)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export default function RemovalTasks() {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [removalDate, setRemovalDate] = useState<Date | undefined>(new Date());
  const [notes, setNotes] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [selectedContractNumbers, setSelectedContractNumbers] = useState<string[]>([]);
  const [contractSearchTerm, setContractSearchTerm] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedBillboards, setSelectedBillboards] = useState<number[]>([]);
  const [availableBillboards, setAvailableBillboards] = useState<any[]>([]);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printTaskId, setPrintTaskId] = useState<string | null>(null);
  const [printType, setPrintType] = useState<'individual' | 'table'>('individual');
  const [billboardPrintData, setBillboardPrintData] = useState<{
    contractNumber: string | number;
    customerName: string;
    billboards: any[];
  } | null>(null);
  const [billboardPrintOpen, setBillboardPrintOpen] = useState(false);
  const [selectedPrintTeam, setSelectedPrintTeam] = useState<string>('all');
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  
  // Print all options (Unified)
  const [unifiedPrintDialogOpen, setUnifiedPrintDialogOpen] = useState(false);
  const [unifiedPrintData, setUnifiedPrintData] = useState<{
    teamId: string;
    teamName: string;
    items: BillboardPrintItem[];
    billboards: Record<number, any>;
    teams: Record<string, any>;
    customerPhone?: string;
  } | null>(null);
  
  // Legacy print all options
  const [printAllDialogOpen, setPrintAllDialogOpen] = useState(false);
  const [printAllTeamId, setPrintAllTeamId] = useState<string | null>(null);
  const [printImageType, setPrintImageType] = useState<'default' | 'installed'>('default');
  const [includeDesigns, setIncludeDesigns] = useState(true);
  const [printOptionsDialogOpen, setPrintOptionsDialogOpen] = useState(false);
  
  // Collapsible teams
  const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
  
  // Multi-task selection for bulk printing
  const [selectedTasksForPrint, setSelectedTasksForPrint] = useState<Set<string>>(new Set());
  const [multiTaskPrintDialogOpen, setMultiTaskPrintDialogOpen] = useState(false);
  
  // Board pagination - lifted to preserve page on re-render
  const [boardPage, setBoardPage] = useState(1);
  const [sendTeamDialogOpen, setSendTeamDialogOpen] = useState(false);
  
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['removal-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('removal_tasks')
        .select(`*`)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as RemovalTask[];
    },
  });

  // جلب جميع العقود المنتهية تلقائياً
  const { data: expiredContracts = [] } = useQuery({
    queryKey: ['expired-contracts-auto'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", billboard_ids, "Ad Type", "Contract Date", "End Date", design_data')
        .lte('End Date', new Date().toISOString())
        .gte('End Date', '2025-10-01')
        .order('Contract_Number', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['installation-teams'],
    queryFn: async () => {
      const { data, error } = await supabase.from('installation_teams').select('id, team_name, sizes, cities, priority, phone_number');
      if (error) throw error;
      return data as any[];
    },
  });

  // ✅ إنشاء مهام تلقائية للعقود المنتهية مع منع التكرار - باستخدام ref لمنع التنفيذ المتكرر
  const autoTasksCreatedRef = useState<Set<number>>(() => new Set())[0];
  const isCreatingTasksRef = useState<boolean>(false);
  
  useEffect(() => {
    const createAutoRemovalTasks = async () => {
      // منع التنفيذ المتزامن
      if (isCreatingTasksRef) return;
      if (!expiredContracts || expiredContracts.length === 0 || !tasks || !teams || teams.length === 0) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      // جمع جميع أرقام العقود التي لها مهام موجودة (معلقة أو قيد التنفيذ)
      const existingTaskContractIds = new Set(
        tasks
          .filter(t => t.status === 'pending' || t.status === 'in_progress')
          .flatMap(t => t.contract_ids || [t.contract_id])
      );

      // جمع جميع اللوحات الموجودة في المهام المعلقة أو قيد التنفيذ
      const { data: existingTaskItems } = await supabase
        .from('removal_task_items')
        .select('billboard_id, removal_tasks!inner(status)')
        .in('removal_tasks.status', ['pending', 'in_progress']);
      
      const billboardsInPendingTasks = new Set(existingTaskItems?.map(item => item.billboard_id) || []);
      
      // ✅ جلب جميع العقود النشطة للتحقق من اللوحات المؤجرة حالياً (مع استثناء المفعلة في المتاح)
      const { data: activeContracts } = await supabase
        .from('Contract')
        .select('Contract_Number, billboard_ids, is_visible_in_available')
        .gt('"End Date"', todayStr);
      
      const billboardsInActiveContracts = new Set<number>();
      (activeContracts || []).forEach((contract: any) => {
        if (contract.is_visible_in_available !== true && contract.billboard_ids) {
          const ids = contract.billboard_ids.split(',').map((id: string) => parseInt(id.trim())).filter(Boolean);
          ids.forEach((id: number) => billboardsInActiveContracts.add(id));
        }
      });

      let tasksCreated = false;

      for (const contract of expiredContracts) {
        // ✅ تخطي العقد إذا تم معالجته مسبقاً في هذه الجلسة
        if (autoTasksCreatedRef.has(contract.Contract_Number)) continue;
        
        // ✅ تخطي العقد إذا كانت له مهمة موجودة بالفعل
        if (existingTaskContractIds.has(contract.Contract_Number)) {
          autoTasksCreatedRef.add(contract.Contract_Number);
          continue;
        }

        // ✅ التحقق من أن العقد منتهي فعلاً (ليس ساري)
        if (contract['End Date']) {
          const endDate = new Date(contract['End Date']);
          endDate.setHours(0, 0, 0, 0);
          if (endDate > today) {
            // العقد لا يزال ساري، تخطيه
            autoTasksCreatedRef.add(contract.Contract_Number);
            continue;
          }
        }

        // استخرج اللوحات من العقد
        if (!contract.billboard_ids) {
          autoTasksCreatedRef.add(contract.Contract_Number);
          continue;
        }
        
        const billboardIds = contract.billboard_ids.split(',').map((id: string) => parseInt(id.trim())).filter(Boolean);
        if (billboardIds.length === 0) {
          autoTasksCreatedRef.add(contract.Contract_Number);
          continue;
        }

        // جلب اللوحات من العقد المنتهي فقط
        const { data: contractBillboards, error: billError } = await supabase
          .from('billboards')
          .select('*')
          .in('ID', billboardIds);

        if (billError || !contractBillboards || contractBillboards.length === 0) {
          autoTasksCreatedRef.add(contract.Contract_Number);
          continue;
        }

        // ✅ تصفية اللوحات: فقط غير الموجودة في مهام معلقة وغير المؤجرة حالياً لعقد ساري آخر
        const availableBillboards = contractBillboards.filter(billboard => {
          // استبعاد اللوحات الموجودة بالفعل في مهام معلقة
          if (billboardsInPendingTasks.has(billboard.ID)) return false;
          
          // ✅ استبعاد اللوحات المؤجرة في عقود نشطة أخرى
          if (billboardsInActiveContracts.has(billboard.ID)) return false;
          
          return true;
        });

        // ضع علامة على أنه تم معالجة هذا العقد
        autoTasksCreatedRef.add(contract.Contract_Number);

        if (availableBillboards.length === 0) continue;

        // تجميع اللوحات حسب الفريق المناسب (مقاس + مدينة مثل trigger قاعدة البيانات)
        const teamsByTeamId: Record<string, { teamId: string; billboards: number[] }> = {};

        for (const billboard of availableBillboards) {
          const size = billboard.Size;
          const city = billboard.City;
          
          // ابحث عن الفريق المناسب حسب الرتبة والأولوية وتخصص الفرقة والشركة الصديقة
          const suitableTeam = findOptimalTeamForRemoval(teams, billboard.Size, billboard.City, billboard.friend_company_id);

          // إذا لم يوجد فريق مناسب بالمدينة والمقاس، لا نُسند اللوحة
          if (!suitableTeam) continue;

          const teamId = suitableTeam.id;
          if (!teamsByTeamId[teamId]) {
            teamsByTeamId[teamId] = { teamId, billboards: [] };
          }
          teamsByTeamId[teamId].billboards.push(billboard.ID);
        }

        // إنشاء مهمة لكل فريق
        for (const teamData of Object.values(teamsByTeamId) as { teamId: string; billboards: number[] }[]) {
          const { data: newTask, error: insertError } = await supabase
            .from('removal_tasks')
            .insert({
              contract_id: contract.Contract_Number,
              contract_ids: [contract.Contract_Number],
              team_id: teamData.teamId,
              status: 'pending',
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (insertError) {
            console.error('Failed to create auto task:', insertError);
            continue;
          }

          tasksCreated = true;
          const taskId = newTask.id;

          // إضافة اللوحات للمهمة مع نسخ التصاميم وصور التركيب
          for (const billboardId of teamData.billboards) {
            const installationItems = await getLatestInstallationSnapshot(
              [Number(contract.Contract_Number)],
              billboardId,
            );

            let designFaceA = installationItems?.design_face_a || null;
            let designFaceB = installationItems?.design_face_b || null;

            // جلب التصاميم من العقد كـ fallback إذا لم تتوفر في مهام التركيب
            if ((!designFaceA || !designFaceB) && contract.design_data) {
              try {
                const dd = typeof contract.design_data === 'string'
                  ? JSON.parse(contract.design_data) : contract.design_data;
                const arr = typeof dd === 'string' ? JSON.parse(dd) : dd;
                if (Array.isArray(arr)) {
                  const match = arr.find((d: any) => String(d.billboardId) === String(billboardId));
                  if (match) {
                    if (!designFaceA) designFaceA = match.designFaceA || match.design_face_a_url || null;
                    if (!designFaceB) designFaceB = match.designFaceB || match.design_face_b_url || null;
                  }
                }
              } catch (e) {
                console.error("Error parsing contract design_data for auto removal:", e);
              }
            }

            await supabase
              .from('removal_task_items')
              .insert({
                task_id: taskId,
                billboard_id: billboardId,
                status: 'pending',
                design_face_a: designFaceA,
                design_face_b: designFaceB,
                installed_image_url: installationItems?.installed_image_url || null
              });
          }
        }
      }

      // إعادة تحميل المهام بعد الإنشاء فقط إذا تم إنشاء مهام جديدة
      if (tasksCreated) {
        queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
      }
      
      // ✅ تنظيف اللوحات المؤجرة حالياً من مهام الإزالة المعلقة
      await cleanupRentedBillboardsFromRemovalTasks();
    };
    
    // وظيفة تنظيف اللوحات المؤجرة من مهام الإزالة (باستخدام المنطق المركزي الموحد لتصدير المتاح)
    const cleanupRentedBillboardsFromRemovalTasks = async () => {
      try {
        // جلب جميع عناصر الإزالة المعلقة مع معلومات المهمة
        const { data: pendingItems } = await supabase
          .from('removal_task_items')
          .select('id, billboard_id, task_id')
          .eq('status', 'pending');
        
        if (!pendingItems || pendingItems.length === 0) return;
        
        // جلب المهام المعلقة أو قيد التنفيذ فقط
        const taskIds = [...new Set(pendingItems.map(item => item.task_id))];
        const { data: activeTasks } = await supabase
          .from('removal_tasks')
          .select('id, status')
          .in('id', taskIds)
          .in('status', ['pending', 'in_progress']);
        
        if (!activeTasks || activeTasks.length === 0) return;
        
        const activeTaskIds = activeTasks.map(t => t.id);
        const activeItems = pendingItems.filter(item => activeTaskIds.includes(item.task_id));
        
        if (activeItems.length === 0) return;
        
        // جلب جميع العقود للتأكد من حالة الإتاحة المركزية (نفس منطق تصدير المتاح)
        const { data: allContracts } = await supabase
          .from('Contract')
          .select('*')
          .order('Contract_Number', { ascending: false });

        // جلب بيانات اللوحات المعنية للتحقق
        const billboardIds = [...new Set(activeItems.map(item => item.billboard_id))];
        const { data: billboardsData } = await supabase
          .from('billboards')
          .select('*')
          .in('ID', billboardIds);

        const billboardMap = new Map<number, any>();
        (billboardsData || []).forEach(b => billboardMap.set(b.ID, b));

        // فحص كل لوحة بنظام تصدير المتاحة والقادمة الموحد
        const itemsToDelete: string[] = [];
        for (const item of activeItems) {
          const billboard = billboardMap.get(item.billboard_id);
          if (!billboard) continue;
          
          const isAvailableOrUpcoming = checkIsAvailableOrUpcomingForExport(billboard, allContracts || [], 4);
          // إذا لم تكن اللوحة متاحة أو قادمة (أي مؤجرة في عقد نشط طويل الأجل غير مفعل في المتاح أو محجوبة بعقد نشط آخر) يتم حذفها من مهام الإزالة
          if (!isAvailableOrUpcoming) {
            itemsToDelete.push(item.id);
          }
        }
        
        if (itemsToDelete.length > 0) {
          await supabase
            .from('removal_task_items')
            .delete()
            .in('id', itemsToDelete);
          
          console.log(`✅ تم حذف ${itemsToDelete.length} لوحة مؤجرة من مهام الإزالة`);
        }

        // تنظيف المهام الفارغة (التي لا تحتوي على أي لوحات) تلقائياً
        const { data: allTasks } = await supabase
          .from('removal_tasks')
          .select('id');
        const { data: allItems } = await supabase
          .from('removal_task_items')
          .select('task_id');
        const tasksWithItems = new Set(allItems?.map(i => i.task_id).filter(Boolean) || []);
        const emptyTaskIds = (allTasks || []).map(t => t.id).filter(id => !tasksWithItems.has(id));
        
        if (emptyTaskIds.length > 0) {
          await supabase
            .from('removal_tasks')
            .delete()
            .in('id', emptyTaskIds);
          console.log(`🧹 تم تنظيف ${emptyTaskIds.length} مهمة إزالة فارغة`);
        }

        queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
        queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
      } catch (error) {
        console.error('خطأ في تنظيف اللوحات المؤجرة:', error);
      }
    };

    createAutoRemovalTasks();
  }, [expiredContracts?.length, teams?.length]);

  // تنظيف المهام الفارغة (التي لا تحتوي على أي لوحات) تلقائياً عند تحميل الصفحة
  useEffect(() => {
    const cleanupEmptyTasks = async () => {
      try {
        const { data: allTasks } = await supabase
          .from('removal_tasks')
          .select('id');
        
        const { data: allItems } = await supabase
          .from('removal_task_items')
          .select('task_id');
        
        if (!allTasks) return;
        
        const tasksWithItems = new Set(allItems?.map(i => i.task_id).filter(Boolean) || []);
        const emptyTaskIds = allTasks.map(t => t.id).filter(id => !tasksWithItems.has(id));
        
        if (emptyTaskIds.length > 0) {
          const { error } = await supabase
            .from('removal_tasks')
            .delete()
            .in('id', emptyTaskIds);
            
          if (!error) {
            console.log(`🧹 تم تنظيف ${emptyTaskIds.length} مهمة إزالة فارغة من الصفحة`);
            queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
            queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
          }
        }
      } catch (error) {
        console.error('خطأ أثناء تنظيف المهام الفارغة:', error);
      }
    };
    
    cleanupEmptyTasks();
  }, []);

  // جلب العقود المنتهية من شهر 10/2025
  // جلب العقود المنتهية وإنشاء مهام تلقائية
  const { data: contracts = [], isLoading: contractsLoading } = useQuery({
    queryKey: ['expired-contracts-for-removal', manualOpen],
    enabled: manualOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", billboard_ids, "Ad Type", "Contract Date", "End Date"')
        .lte('End Date', new Date().toISOString())
        .gte('End Date', '2025-10-01')
        .order('Contract_Number', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const filteredContracts = useMemo(() => {
    if (!contractSearchTerm) return contracts;
    
    const searchLower = contractSearchTerm.toLowerCase();
    return contracts.filter((c: any) => 
      String(c.Contract_Number).includes(searchLower) ||
      c['Customer Name']?.toLowerCase().includes(searchLower) ||
      c['Ad Type']?.toLowerCase().includes(searchLower)
    );
  }, [contracts, contractSearchTerm]);

  const handleContractsChange = async (contractNums: string[]) => {
    setSelectedContractNumbers(contractNums);
    setSelectedBillboards([]);
    
    if (contractNums.length === 0) {
      setAvailableBillboards([]);
      return;
    }

    const allBillboardIds: number[] = [];
    for (const contractNum of contractNums) {
      const contract = contracts.find((c: any) => String(c.Contract_Number) === contractNum);
      if (contract?.billboard_ids) {
        const ids = contract.billboard_ids.split(',').map((id: string) => parseInt(id.trim())).filter(Boolean);
        allBillboardIds.push(...ids);
      }
    }

    if (allBillboardIds.length > 0) {
      // جلب جميع اللوحات المرتبطة بالعقود المحددة
      const { data: billboards, error } = await supabase
        .from('billboards')
        .select('*')
        .in('ID', allBillboardIds);
      
      if (!error && billboards) {
        // ✅ تصفية اللوحات: فقط المنتهي عقدها وغير المؤجرة حالياً
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const filteredBillboards = billboards.filter(billboard => {
          const currentContractNumber = billboard.Contract_Number;
          const rentEndDate = billboard.Rent_End_Date;
          const billboardStatus = (billboard.Status || '').toString().trim();
          
          // ✅ استبعاد اللوحات المؤجرة بالفعل (حالة مؤجر أو محجوز مع عقد نشط)
          if (billboardStatus === 'مؤجر' || billboardStatus === 'rented' || billboardStatus === 'Rented' || billboardStatus === 'محجوز') {
            // تحقق من أن العقد لا يزال نشطاً
            if (rentEndDate) {
              const endDate = new Date(rentEndDate);
              endDate.setHours(0, 0, 0, 0);
              if (endDate > today) {
                // العقد لا يزال نشطاً، استبعد هذه اللوحة
                return false;
              }
            }
          }
          
          // ✅ إذا كانت اللوحة مؤجرة لعقد آخر نشط، استبعدها تماماً
          if (currentContractNumber && !contractNums.includes(String(currentContractNumber))) {
            // تحقق من أن العقد الآخر منتهي
            if (rentEndDate) {
              const endDate = new Date(rentEndDate);
              if (endDate > today) {
                // العقد الآخر لا يزال نشطاً، استبعد هذه اللوحة
                return false;
              }
            }
          }
          
          // ✅ إذا كانت مرتبطة بأحد العقود المحددة، تحقق من الانتهاء
          if (contractNums.includes(String(currentContractNumber))) {
            if (!rentEndDate) return false; // لا يوجد تاريخ = لا تضمها
            const endDate = new Date(rentEndDate);
            return endDate <= today; // فقط إذا انتهى العقد فعلاً (اليوم أو قبله)
          }
          
          // ✅ إذا لم يكن هناك عقد حالي، لا تضمها (قد تكون متاحة لكن ليست من العقود المحددة)
          return false;
        });
        
        setAvailableBillboards(filteredBillboards);
      }
    }
  };

  const { data: rawTaskItems = [] } = useQuery({
    queryKey: ['all-removal-task-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('removal_task_items')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const uniqueItems = data?.filter((item, index, self) =>
        index === self.findIndex(t => 
          t.task_id === item.task_id && 
          t.billboard_id === item.billboard_id &&
          t.status === item.status
        )
      ) || [];
      
      return uniqueItems as RemovalTaskItem[];
    },
  });

  // جلب التصاميم من مهام التركيب مع حفظ هوية العقد لمنع ظهور تصميم عقد سابق على نفس اللوحة.
  const itemBillboardIds = rawTaskItems.map((i) => i.billboard_id).filter(Boolean);
  
  // بناء خريطة task_id -> contract_id من مهام الإزالة (لا تزال مطلوبة للـ queryKey)
  const removalTaskContractMap = useMemo(() => {
    const m = new Map<string, number>();
    (tasks || []).forEach((t: any) => {
      m.set(t.id, t.contract_id);
    });
    return m;
  }, [tasks]);

  const removalContractSignature = useMemo(() => rawTaskItems
    .map(item => `${item.task_id}:${removalTaskContractMap.get(item.task_id) || ''}`)
    .join('|'), [rawTaskItems, removalTaskContractMap]);

  const { data: installationDesigns = [] } = useQuery({
    queryKey: ['installation-designs-for-removal-v3', itemBillboardIds.join(','), removalContractSignature],
    enabled: itemBillboardIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('installation_task_items')
        .select('billboard_id, design_face_a, design_face_b, installed_image_face_a_url, installed_image_face_b_url, task_id, created_at')
        .in('billboard_id', itemBillboardIds)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const taskIds = [...new Set((data || []).map((item: any) => item.task_id).filter(Boolean))];
      if (taskIds.length === 0) return [];

      const { data: installationTasks, error: tasksError } = await supabase
        .from('installation_tasks')
        .select('id, contract_id')
        .in('id', taskIds);
      if (tasksError) throw tasksError;

      const contractByTask = new Map((installationTasks || []).map((task: any) => [task.id, Number(task.contract_id)]));
      return (data || []).map((item: any) => ({
        ...item,
        contract_id: contractByTask.get(item.task_id) || null,
      }));
    },
  });

  // دمج التصاميم بمفتاح العقد + اللوحة، وليس باللوحة وحدها.
  const allTaskItems = useMemo(() => {
    if (!installationDesigns.length) return rawTaskItems;
    
    const designMap = new Map<string, any>();
    installationDesigns.forEach((d: any) => {
      if (!d.design_face_a && !d.design_face_b) return;
      const key = `${Number(d.contract_id)}:${Number(d.billboard_id)}`;
      if (!designMap.has(key)) {
        designMap.set(key, d);
      }
    });
    
    return rawTaskItems.map(item => {
      if (item.design_face_a || item.design_face_b) return item;
      const contractId = removalTaskContractMap.get(item.task_id);
      const installDesign = designMap.get(`${Number(contractId)}:${Number(item.billboard_id)}`);
      if (!installDesign) return item;
      return {
        ...item,
        design_face_a: installDesign.design_face_a || item.design_face_a,
        design_face_b: installDesign.design_face_b || item.design_face_b,
        installed_image_url: item.installed_image_url || installDesign.installed_image_face_a_url || null,
        installed_image_face_a_url: (item as any).installed_image_face_a_url || installDesign.installed_image_face_a_url || null,
        installed_image_face_b_url: (item as any).installed_image_face_b_url || installDesign.installed_image_face_b_url || null,
      } as any;
    });
  }, [rawTaskItems, installationDesigns, removalTaskContractMap]);


  const billboardIds = allTaskItems.map((i) => i.billboard_id).filter(Boolean);
  const { data: billboardsDetails = [] } = useQuery({
    queryKey: ['billboards-for-removal-task', billboardIds.join(',')],
    enabled: billboardIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billboards')
        .select('*')
        .in('ID', billboardIds);
      if (error) throw error;
      return data as any[];
    },
  });

  const billboardById = useMemo(() => {
    const m: Record<number, any> = {};
    (billboardsDetails || []).forEach((b: any) => {
      m[b.ID] = b;
    });
    return m;
  }, [billboardsDetails]);

  const teamById = useMemo(() => {
    const m: Record<string, any> = {};
    (teams || []).forEach((t: any) => {
      m[t.id] = t;
    });
    return m;
  }, [teams]);

  const contractIds = tasks.map((t) => t.contract_id).filter(Boolean);
  const { data: taskContracts = [] } = useQuery({
    queryKey: ['contracts-by-number', contractIds.join(',')],
    enabled: contractIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type", "Contract Date", "End Date"')
        .in('Contract_Number', contractIds as number[]);
      if (error) throw error;
      return data as any[];
    },
  });

  const contractByNumber = useMemo(() => {
    const m: Record<number, any> = {};
    (taskContracts || []).forEach((c: any) => {
      m[c.Contract_Number] = c;
    });
    return m;
  }, [taskContracts]);

  // Map task_id to task for quick lookup
  const taskById = useMemo(() => {
    const m: Record<string, any> = {};
    (tasks || []).forEach((t: any) => {
      m[t.id] = t;
    });
    return m;
  }, [tasks]);

  const createManualTasksMutation = useMutation({
    mutationFn: async () => {
      if (selectedContractNumbers.length === 0 || selectedBillboards.length === 0) {
        throw new Error('يرجى اختيار العقود واللوحات');
      }

        // ✅ تحقق من عدم وجود مهام معلقة لنفس اللوحات
        const { data: existingTasks } = await supabase
        .from('removal_task_items')
        .select('billboard_id, task_id, removal_tasks!inner(status)')
        .in('billboard_id', selectedBillboards)
        .in('removal_tasks.status', ['pending', 'in_progress']);

      if (existingTasks && existingTasks.length > 0) {
        const existingBillboards = existingTasks.map(t => t.billboard_id);
        const duplicates = selectedBillboards.filter(id => existingBillboards.includes(id));
        
        if (duplicates.length > 0) {
          throw new Error(`توجد مهام إزالة معلقة بالفعل لهذه اللوحات: ${duplicates.join(', ')}`);
        }
      }

      const billboardsData = availableBillboards.filter(b => selectedBillboards.includes(b.ID));
      const teamsBySize: Record<string, { teamId: string; billboards: number[] }> = {};

      for (const billboard of billboardsData) {
        const suitableTeam = findOptimalTeamForRemoval(teams, billboard.Size, billboard.City, billboard.friend_company_id);
        const teamId = suitableTeam?.id || teams[0]?.id;
        if (!teamId) continue;
        
        if (!teamsBySize[teamId]) {
          teamsBySize[teamId] = { teamId, billboards: [] };
        }
        teamsBySize[teamId].billboards.push(billboard.ID);
      }

      for (const teamData of Object.values(teamsBySize)) {
        const contractIdsArray = selectedContractNumbers.map(n => Number(n));
        
        const { data: newTask, error: insertError } = await supabase
          .from('removal_tasks')
          .insert({
            contract_id: contractIdsArray[0],
            contract_ids: contractIdsArray,
            team_id: teamData.teamId,
            status: 'pending',
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (insertError) throw insertError;
        const taskId = newTask.id;

        for (const billboardId of teamData.billboards) {
          const installationItems = await getLatestInstallationSnapshot(contractIdsArray, billboardId);

          const { error: itemError } = await supabase
            .from('removal_task_items')
            .insert({
              task_id: taskId,
              billboard_id: billboardId,
              status: 'pending',
              design_face_a: installationItems?.design_face_a || null,
              design_face_b: installationItems?.design_face_b || null,
              installed_image_url: installationItems?.installed_image_url || null
            });

          if (itemError) throw itemError;
        }
      }
    },
    onSuccess: async () => {
      toast.success('تم إنشاء مهام الإزالة بنجاح');
      
      await queryClient.refetchQueries({ queryKey: ['removal-tasks'] });
      await queryClient.refetchQueries({ queryKey: ['all-removal-task-items'] });
      
      setManualOpen(false);
      setSelectedContractNumbers([]);
      setContractSearchTerm('');
      setSelectedBillboards([]);
      setAvailableBillboards([]);
    },
    onError: (error) => {
      toast.error('فشل إنشاء المهام: ' + error.message);
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error: itemsError } = await supabase
        .from('removal_task_items')
        .delete()
        .eq('task_id', taskId);
      
      if (itemsError) throw itemsError;

      const { error: taskError } = await supabase
        .from('removal_tasks')
        .delete()
        .eq('id', taskId);
      
      if (taskError) throw taskError;
    },
    onSuccess: () => {
      toast.success('تم حذف المهمة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
    },
    onError: (error) => {
      toast.error('خطأ في حذف المهمة: ' + error.message);
    },
  });

  // حذف اللوحات المكررة (على مستوى billboard_id) - الاحتفاظ بالفرقة ذات الأولوية الأعلى
  const cleanupDuplicatesMutation = useMutation({
    mutationFn: async () => {
      // جلب جميع عناصر الإزالة غير المكتملة
      const { data: pendingItems } = await supabase
        .from('removal_task_items')
        .select('id, billboard_id, task_id, status')
        .eq('status', 'pending');
      
      if (!pendingItems || pendingItems.length === 0) throw new Error('لا توجد عناصر معلقة');
      
      // تجميع حسب billboard_id
      const byBillboard: Record<number, typeof pendingItems> = {};
      pendingItems.forEach(item => {
        if (!byBillboard[item.billboard_id]) byBillboard[item.billboard_id] = [];
        byBillboard[item.billboard_id].push(item);
      });
      
      // بناء خريطة task_id -> team_id -> priority
      const taskTeamMap: Record<string, string> = {};
      tasks.forEach(t => { taskTeamMap[t.id] = t.team_id; });
      const teamPriorityMap: Record<string, number> = {};
      teams.forEach(t => { teamPriorityMap[t.id] = t.priority || 0; });
      
      const itemsToDelete: string[] = [];
      
      for (const [, items] of Object.entries(byBillboard)) {
        if (items.length <= 1) continue;
        
        // ترتيب: الأعلى أولوية أولاً
        items.sort((a, b) => {
          const prioA = teamPriorityMap[taskTeamMap[a.task_id] || ''] || 0;
          const prioB = teamPriorityMap[taskTeamMap[b.task_id] || ''] || 0;
          return prioB - prioA;
        });
        
        // حذف الكل ما عدا الأول (الأعلى أولوية)
        for (let i = 1; i < items.length; i++) {
          itemsToDelete.push(items[i].id);
        }
      }
      
      if (itemsToDelete.length === 0) throw new Error('لا توجد لوحات مكررة');
      
      // حذف العناصر المكررة
      const { error } = await supabase
        .from('removal_task_items')
        .delete()
        .in('id', itemsToDelete);
      if (error) throw error;
      
      // حذف المهام الفارغة
      const affectedTaskIds = [...new Set(pendingItems.filter(i => itemsToDelete.includes(i.id)).map(i => i.task_id))];
      for (const taskId of affectedTaskIds) {
        const { data: remaining } = await supabase
          .from('removal_task_items')
          .select('id')
          .eq('task_id', taskId)
          .limit(1);
        if (!remaining || remaining.length === 0) {
          await supabase.from('removal_tasks').delete().eq('id', taskId);
        }
      }
      
      return itemsToDelete.length;
    },
    onSuccess: (count) => {
      toast.success(`تم حذف ${count} لوحة مكررة`);
      queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل في حذف اللوحات المكررة');
    },
  });

  // تنظيف اللوحات المؤجرة من مهام الإزالة (باستخدام المنطق المركزي الموحد لتصدير المتاح)
  const cleanupRentedMutation = useMutation({
    mutationFn: async () => {
      // جلب جميع عناصر الإزالة المعلقة
      const { data: pendingItems } = await supabase
        .from('removal_task_items')
        .select('id, billboard_id, task_id')
        .eq('status', 'pending');
      
      if (!pendingItems || pendingItems.length === 0) {
        throw new Error('لا توجد عناصر إزالة معلقة');
      }
      
      // جلب المهام المعلقة أو قيد التنفيذ
      const taskIds = [...new Set(pendingItems.map(item => item.task_id))];
      const { data: activeTasks } = await supabase
        .from('removal_tasks')
        .select('id, status')
        .in('id', taskIds)
        .in('status', ['pending', 'in_progress']);
      
      if (!activeTasks || activeTasks.length === 0) {
        throw new Error('لا توجد مهام نشطة');
      }
      
      const activeTaskIds = activeTasks.map(t => t.id);
      const activeItems = pendingItems.filter(item => activeTaskIds.includes(item.task_id));
      
      if (activeItems.length === 0) {
        throw new Error('لا توجد عناصر في مهام نشطة');
      }
      
      // جلب جميع العقود للتأكد من حالة الإتاحة المركزية (نفس منطق تصدير المتاح)
      const { data: allContracts } = await supabase
        .from('Contract')
        .select('*')
        .order('Contract_Number', { ascending: false });

      // جلب بيانات اللوحات المعنية للتحقق
      const billboardIds = [...new Set(activeItems.map(item => item.billboard_id))];
      const { data: billboardsData } = await supabase
        .from('billboards')
        .select('*')
        .in('ID', billboardIds);

      const billboardMap = new Map<number, any>();
      (billboardsData || []).forEach(b => billboardMap.set(b.ID, b));

      // فحص كل لوحة بنظام تصدير المتاحة والقادمة الموحد
      const itemsToDelete: string[] = [];
      for (const item of activeItems) {
        const billboard = billboardMap.get(item.billboard_id);
        if (!billboard) continue;
        
        const isAvailableOrUpcoming = checkIsAvailableOrUpcomingForExport(billboard, allContracts || [], 4);
        // إذا لم تكن اللوحة متاحة أو قادمة (أي مؤجرة في عقد نشط طويل الأجل غير مفعل في المتاح أو محجوبة بعقد نشط آخر) يتم حذفها من مهام الإزالة
        if (!isAvailableOrUpcoming) {
          itemsToDelete.push(item.id);
        }
      }
      
      if (itemsToDelete.length > 0) {
        const { error } = await supabase
          .from('removal_task_items')
          .delete()
          .in('id', itemsToDelete);
        
        if (error) throw error;
      }

      // تنظيف المهام الفارغة (التي لا تحتوي على أي لوحات)
      const { data: allTasks } = await supabase
        .from('removal_tasks')
        .select('id');
      const { data: allItems } = await supabase
        .from('removal_task_items')
        .select('task_id');
      const tasksWithItems = new Set(allItems?.map(i => i.task_id).filter(Boolean) || []);
      const emptyTaskIds = (allTasks || []).map(t => t.id).filter(id => !tasksWithItems.has(id));
      
      if (emptyTaskIds.length > 0) {
        await supabase
          .from('removal_tasks')
          .delete()
          .in('id', emptyTaskIds);
      }
      
      return itemsToDelete.length;
    },
    onSuccess: (count) => {
      if (count > 0) {
        toast.success(`تم حذف ${count} لوحة مؤجرة من مهام الإزالة`);
      } else {
        toast.info('جميع لوحات مهام الإزالة مطابقة للمتاحة والقادمة (لا توجد لوحات مؤجرة لحذفها)');
      }
      queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل في تنظيف اللوحات المؤجرة');
    },
  });

  // التراجع عن إزالة لوحة
  const undoRemovalMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('removal_task_items')
        .update({
          status: 'pending',
          completed_at: null,
          removal_date: null,
          notes: null,
          removed_image_url: null
        })
        .eq('id', itemId);
      
      if (error) throw error;
      
      // تحديث حالة المهمة إذا لزم الأمر
      const item = allTaskItems.find(i => i.id === itemId);
      if (item) {
        await supabase
          .from('removal_tasks')
          .update({ status: 'pending' })
          .eq('id', item.task_id);
      }
    },
    onSuccess: () => {
      toast.success('تم التراجع عن الإزالة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
    },
    onError: (error: any) => {
      toast.error('فشل التراجع: ' + error.message);
    },
  });

  // حساب عدد اللوحات المكررة (على مستوى billboard_id في العناصر المعلقة)
  const duplicateTasksCount = useMemo(() => {
    const billboardCount: Record<number, number> = {};
    let count = 0;
    
    for (const item of allTaskItems) {
      if (item.status === 'completed') continue;
      billboardCount[item.billboard_id] = (billboardCount[item.billboard_id] || 0) + 1;
    }
    
    for (const c of Object.values(billboardCount)) {
      if (c > 1) count += c - 1;
    }
    
    return count;
  }, [allTaskItems]);

  // ── مزامنة اللوحات الناقصة (الإزالة) ──
  const syncMissingRemovalMutation = useMutation({
    mutationFn: async ({ contractId, taskIds }: { contractId: number; taskIds: string[] }) => {
      const { data: contract } = await supabase
        .from('Contract')
        .select('billboard_ids, design_data')
        .eq('Contract_Number', contractId)
        .single();
      
      if (!contract?.billboard_ids) throw new Error('لا يوجد لوحات في هذا العقد');
      
      const contractBillboardIds = contract.billboard_ids
        .split(',')
        .map((id: string) => Number(id.trim()))
        .filter((id: number) => !isNaN(id) && id > 0);
      
      if (contractBillboardIds.length === 0) throw new Error('لا يوجد لوحات في هذا العقد');
      
      const existingBillboardIds = new Set(
        allTaskItems
          .filter(item => taskIds.includes(item.task_id))
          .map(item => item.billboard_id)
      );
      
      const missingIds = contractBillboardIds.filter((id: number) => !existingBillboardIds.has(id));
      
      if (missingIds.length === 0) throw new Error('جميع اللوحات موجودة بالفعل في المهام');
      
      const { data: missingBillboards } = await supabase
        .from('billboards')
        .select('ID, Size, City, Faces_Count, friend_company_id')
        .in('ID', missingIds);
      
      if (!missingBillboards?.length) throw new Error('لم يتم العثور على اللوحات الناقصة');
      
      const { data: teamsData } = await (supabase as any)
        .from('installation_teams')
        .select('id, team_name, sizes, cities, priority, friend_company_id, friend_company_ids');
      
      if (!teamsData?.length) throw new Error('لا توجد فرق');
      
      const sortedTeams = [...teamsData].sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0));
      
      const createdTasksMap = new Map<string, string>();
      let addedCount = 0;
      
      for (const bb of missingBillboards) {
        const team = findCorrectTeamForRemoval(sortedTeams, bb.Size, bb.City, bb.friend_company_id);
        
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
            .from('removal_tasks')
            .insert({ contract_id: contractId, team_id: team.id, status: 'pending' })
            .select('id')
            .single();
          if (error || !newTask) continue;
          targetTaskId = newTask.id;
          createdTasksMap.set(mapKey, targetTaskId);
        }
        
        const installationItems = await getLatestInstallationSnapshot([contractId], bb.ID);

        let designFaceA = installationItems?.design_face_a || null;
        let designFaceB = installationItems?.design_face_b || null;

        // جلب التصاميم من العقد كـ fallback إذا لم تتوفر في مهام التركيب
        if ((!designFaceA || !designFaceB) && contract?.design_data) {
          try {
            const dd = typeof contract.design_data === 'string'
              ? JSON.parse(contract.design_data) : contract.design_data;
            const arr = typeof dd === 'string' ? JSON.parse(dd) : dd;
            if (Array.isArray(arr)) {
              const match = arr.find((d: any) => String(d.billboardId) === String(bb.ID));
              if (match) {
                if (!designFaceA) designFaceA = match.designFaceA || match.design_face_a_url || null;
                if (!designFaceB) designFaceB = match.designFaceB || match.design_face_b_url || null;
              }
            }
          } catch (e) {
            console.error("Error parsing contract design_data for sync:", e);
          }
        }

        const { error: insertError } = await supabase
          .from('removal_task_items')
          .insert({
            task_id: targetTaskId,
            billboard_id: bb.ID,
            status: 'pending',
            design_face_a: designFaceA,
            design_face_b: designFaceB,
            installed_image_url: installationItems?.installed_image_url || null
          });
        
        if (!insertError) addedCount++;
      }
      
      return addedCount;
    },
    onSuccess: (count) => {
      toast.success(`تم إضافة ${count} لوحة ناقصة إلى مهام الإزالة`);
      queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل في إضافة اللوحات الناقصة');
    },
  });

  // ── تجميع المهام المتفرقة (الإزالة) ──
  const mergeRemovalTasksMutation = useMutation({
    mutationFn: async () => {
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
        
        const keepTask = groupTasks[0];
        const tasksToRemove = groupTasks.slice(1);
        const removeIds = tasksToRemove.map((t: any) => t.id);
        
        await supabase
          .from('removal_task_items')
          .update({ task_id: keepTask.id })
          .in('task_id', removeIds);
        
        await supabase
          .from('removal_tasks')
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
      queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل في تجميع المهام');
    },
  });

  // ── إعادة التوزيع الذكي (الإزالة) ──
  const redistributeRemovalMutation = useMutation({
    mutationFn: async () => {
      const pendingItems = allTaskItems.filter(i => i.status !== 'completed');
      if (pendingItems.length === 0) throw new Error('لا توجد عناصر معلقة لإعادة التوزيع');
      
      const { data: teamsData } = await supabase.from('installation_teams').select('*');
      if (!teamsData?.length) throw new Error('لا توجد فرق');
      
      const sortedTeams = [...teamsData].sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0));
      
      const taskTeamMap: Record<string, string> = {};
      tasks.forEach((t: any) => { taskTeamMap[t.id] = t.team_id; });
      
      let movedCount = 0;
      const byBillboard: Record<number, any[]> = {};
      pendingItems.forEach(item => {
        if (!byBillboard[item.billboard_id]) byBillboard[item.billboard_id] = [];
        byBillboard[item.billboard_id].push(item);
      });
      
      const itemsToDelete: string[] = [];
      const itemsToMove: { id: string; newTaskId: string }[] = [];
      
      for (const [billboardIdStr, items] of Object.entries(byBillboard)) {
        const billboardId = Number(billboardIdStr);
        const billboard = billboardById[billboardId];
        if (!billboard) continue;
        
        const correctTeam = findCorrectTeamForRemoval(sortedTeams, billboard.Size, billboard.City, billboard.friend_company_id);
        
        if (!correctTeam) {
          items.forEach(item => itemsToDelete.push(item.id));
          continue;
        }
        
        if (items.length > 1) {
          for (let i = 1; i < items.length; i++) {
            itemsToDelete.push(items[i].id);
          }
        }
        
        const currentTeamId = taskTeamMap[items[0].task_id];
        if (currentTeamId !== correctTeam.id) {
          const contractId = tasks.find((t: any) => t.id === items[0].task_id)?.contract_id;
          if (contractId) {
            let targetTask = tasks.find((t: any) => t.team_id === correctTeam.id && t.contract_id === contractId);
            
            if (!targetTask) {
              const { data: newTask } = await supabase
                .from('removal_tasks')
                .insert({ contract_id: contractId, team_id: correctTeam.id, status: 'pending' })
                .select()
                .single();
              if (newTask) targetTask = newTask as any;
            }
            
            if (targetTask) {
              itemsToMove.push({ id: items[0].id, newTaskId: targetTask.id });
              movedCount++;
            }
          }
        }
      }
      
      if (itemsToDelete.length > 0) {
        await supabase.from('removal_task_items').delete().in('id', itemsToDelete);
      }
      
      for (const move of itemsToMove) {
        await supabase.from('removal_task_items').update({ task_id: move.newTaskId }).eq('id', move.id);
      }
      
      // حذف المهام الفارغة
      for (const task of tasks) {
        const { data: remaining } = await supabase.from('removal_task_items').select('id').eq('task_id', task.id).limit(1);
        if (!remaining || remaining.length === 0) {
          await supabase.from('removal_tasks').delete().eq('id', task.id);
        }
      }
      
      return { deleted: itemsToDelete.length, moved: movedCount };
    },
    onSuccess: (result) => {
      toast.success(`تم إعادة التوزيع: ${result.deleted} مكررة محذوفة، ${result.moved} لوحة منقولة`);
      queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل في إعادة التوزيع');
    },
  });

  const completeItemsMutation = useMutation({
    mutationFn: async () => {
      if (!removalDate || selectedItems.size === 0) {
        throw new Error('يرجى اختيار التاريخ واللوحات');
      }

      const updates = Array.from(selectedItems).map(itemId => {
        const item = allTaskItems.find(i => i.id === itemId);
        return {
          id: itemId,
          task_id: item?.task_id || selectedTeamId || '',
          billboard_id: item?.billboard_id || 0,
          status: 'completed' as const,
          completed_at: new Date().toISOString(),
          removal_date: format(removalDate, 'yyyy-MM-dd'),
          notes: notes || null,
        };
      });

      const { error } = await supabase
        .from('removal_task_items')
        .upsert(updates);
      
      if (error) throw error;

      if (selectedTeamId) {
        const taskItemsForTeam = itemsByTask[selectedTeamId] || [];
        const remainingItems = taskItemsForTeam.filter(
          item => !selectedItems.has(item.id) && item.status !== 'completed'
        );
        
        if (remainingItems.length === 0) {
          const { error: taskError } = await supabase
            .from('removal_tasks')
            .update({ status: 'completed' })
            .eq('id', selectedTeamId);
          
          if (taskError) throw taskError;
        }
      }

      // تحديث حالة اللوحات إلى available بعد الإزالة
      const billboardIds = Array.from(selectedItems).map(itemId => {
        const item = allTaskItems.find(i => i.id === itemId);
        return item?.billboard_id;
      }).filter(Boolean);

      if (billboardIds.length > 0) {
        await supabase
          .from('billboards')
          .update({ 
            Status: 'available',
            Contract_Number: null,
            Customer_Name: null,
            Ad_Type: null,
            Rent_Start_Date: null,
            Rent_End_Date: null
          })
          .in('ID', billboardIds);
      }
    },
    onSuccess: () => {
      toast.success('تم تحديث حالة الإزالة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
      queryClient.invalidateQueries({ queryKey: ['billboards'] });
      setSelectedItems(new Set());
      setNotes('');
      setSelectedTeamId('');
    },
    onError: (error) => {
      toast.error('خطأ في تحديث حالة الإزالة: ' + error.message);
    },
  });

  const handlePrintTask = async (taskId: string) => {
    setPrintTaskId(taskId);
    setPrintDialogOpen(true);
  };

  const executePrint = async () => {
    if (!printTaskId) return;
    
    const taskItems = itemsByTask[printTaskId] || [];
    const taskBillboards = taskItems.map(item => billboardById[item.billboard_id]).filter(Boolean);
    
    if (taskBillboards.length === 0) {
      toast.error('لا توجد لوحات للطباعة');
      return;
    }

    const task = tasks.find(t => t.id === printTaskId);
    const contract = task ? contractByNumber[task.contract_id] : null;

    if (printType === 'individual') {
      setBillboardPrintData({
        contractNumber: contract?.Contract_Number || task.contract_id,
        customerName: contract?.['Customer Name'] || '',
        billboards: taskBillboards.map(b => ({
          ...b,
          design_face_a: taskItems.find(ti => ti.billboard_id === b.ID)?.design_face_a,
          design_face_b: taskItems.find(ti => ti.billboard_id === b.ID)?.design_face_b,
          installed_image_url: taskItems.find(ti => ti.billboard_id === b.ID)?.installed_image_url
        }))
      });
      setBillboardPrintOpen(true);
      setPrintDialogOpen(false);
    } else {
      await printTableRemoval(taskBillboards, contract, task);
    }
  };

  const printTableRemoval = async (billboards: any[], contract: any, task: any) => {
    try {
      const team = teamById[task.team_id || ''];
      const teamName = team?.team_name || 'فريق غير محدد';
      
      // جلب بيانات المهمة
      const taskItems = itemsByTask[task.id] || [];

      // جمع أنواع الدعاية من اللوحات
      const adTypes = new Set(taskItems.map(item => {
        const b = billboardById[item.billboard_id];
        return b?.Ad_Type || 'غير محدد';
      }).filter(Boolean));
      const adTypesStr = Array.from(adTypes).join(' - ');

      const norm = (b: any, itemData?: any) => {
        const id = String(b.ID || '');
        const name = String(b.Billboard_Name || id);
        const image = String(b.Image_URL || '');
        const municipality = String(b.Municipality || '');
        const district = String(b.District || '');
        const landmark = String(b.Nearest_Landmark || '');
        const size = String(b.Size || '');
        const level = String(b.Level || '');
        const faces = String(b.Faces_Count || '');
        const coords = String(b.GPS_Coordinates || '');
        const mapLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : '';
        
        // إضافة التصميم والصورة المركبة إذا كانت موجودة
        const designFaceA = itemData?.design_face_a || b.design_face_a || '';
        const designFaceB = itemData?.design_face_b || b.design_face_b || '';
        const installedImage = itemData?.installed_image_url || '';
        const removedImage = itemData?.removed_image_url || '';
        
        return { id, name, image, municipality, district, landmark, size, level, faces, mapLink, designFaceA, designFaceB, installedImage, removedImage };
      };

      // جلب بيانات الترتيب من الجداول
      const [sizesRes, municipalitiesRes, levelsRes] = await Promise.all([
        supabase.from('sizes').select('name, sort_order').order('sort_order', { ascending: true }),
        supabase.from('municipalities').select('name, sort_order').order('sort_order', { ascending: true }),
        supabase.from('billboard_levels').select('level_code, sort_order').order('sort_order', { ascending: true })
      ]);
      
      const sizeOrderMap = new Map<string, number>();
      (sizesRes.data || []).forEach((s: any) => sizeOrderMap.set(s.name, s.sort_order ?? 999));
      
      const municipalityOrderMap = new Map<string, number>();
      (municipalitiesRes.data || []).forEach((m: any) => municipalityOrderMap.set(m.name, m.sort_order ?? 999));
      
      const levelOrderMap = new Map<string, number>();
      (levelsRes.data || []).forEach((l: any) => levelOrderMap.set(l.level_code, l.sort_order ?? 999));

      const normalized = billboards.map((b) => {
        const itemData = taskItems.find(ti => ti.billboard_id === b.ID);
        return norm(b, itemData);
      }).sort((a, b) => {
        // ترتيب حسب المقاس ثم البلدية ثم المستوى
        const sizeOrderA = sizeOrderMap.get(a.size) ?? 999;
        const sizeOrderB = sizeOrderMap.get(b.size) ?? 999;
        if (sizeOrderA !== sizeOrderB) return sizeOrderA - sizeOrderB;
        
        const municipalityOrderA = municipalityOrderMap.get(a.municipality) ?? 999;
        const municipalityOrderB = municipalityOrderMap.get(b.municipality) ?? 999;
        if (municipalityOrderA !== municipalityOrderB) return municipalityOrderA - municipalityOrderB;
        
        const levelOrderA = levelOrderMap.get(a.level) ?? 999;
        const levelOrderB = levelOrderMap.get(b.level) ?? 999;
        return levelOrderA - levelOrderB;
      });
      
      const ROWS_PER_PAGE = 8; // تقليل عدد الصفوف لإضافة التصاميم

      const tablePagesHtml = normalized.length
        ? normalized
            .reduce((acc: any[][], r, i) => { const p = Math.floor(i / ROWS_PER_PAGE); (acc[p] ||= []).push(r); return acc; }, [])
            .map((pageRows) => `
              <div class="template-container page">
                <img src="/in1.svg" alt="خلفية جدول اللوحات" class="template-image" onerror="console.warn('Failed to load in1.svg')" />
                <div class="contract-header">
                  <p style="font-size: 14px; font-weight: 700; color: #dc2626; margin-bottom: 12px; text-decoration: underline;">إزالة دعاية - ${teamName}</p>
                  <p style="font-size: 12px; font-weight: 700; color: #dc2626; margin-bottom: 8px;"><strong>أرقام العقود:</strong> ${contractNumbers}</p>
                  <p><strong>أنواع الدعاية:</strong> ${adTypesStr}</p>
                  <p><strong>اسم الزبون:</strong> ${contract?.['Customer Name'] || 'غير محدد'}</p>
                </div>
                <div class="table-area">
                  <table class="btable" dir="rtl">
                    <colgroup>
                      <col style="width:16mm" />
                      <col style="width:16mm" />
                      <col style="width:16mm" />
                      <col style="width:16mm" />
                      <col style="width:28mm" />
                      <col style="width:14mm" />
                      <col style="width:14mm" />
                      <col style="width:16mm" />
                      <col style="width:16mm" />
                      <col style="width:16mm" />
                      <col style="width:14mm" />
                    </colgroup>
                    <tbody>
                      ${pageRows
                        .map(
                          (r) => `
                          <tr>
                            <td class="c-name">${r.name || r.id}</td>
                            <td class="c-img">${r.image ? `<img src="${r.image}" alt="صورة" onerror="this.style.display='none'" />` : ''}</td>
                            <td>${r.municipality}</td>
                            <td>${r.district}</td>
                            <td>${r.landmark}</td>
                            <td>${r.size}</td>
                            <td>${r.faces}</td>
                            <td class="c-img">${r.designFaceA ? `<img src="${r.designFaceA}" alt="تصميم أ" onerror="this.style.display='none'" />` : ''}</td>
                            <td class="c-img">${r.designFaceB ? `<img src="${r.designFaceB}" alt="تصميم ب" onerror="this.style.display='none'" />` : ''}</td>
                            <td class="c-img">${r.installedImage ? `<img src="${r.installedImage}" alt="صورة تركيب" onerror="this.style.display='none'" />` : ''}</td>
                            <td>${r.mapLink ? `<a href="${r.mapLink}" target="_blank" rel="noopener">خريطة</a>` : ''}</td>
                          </tr>`
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            `)
            .join('')
        : '';

      // جمع أرقام العقود وأنواع الدعاية
      const contractIds = task.contract_ids || [task.contract_id];
      const contractNumbers = contractIds.map(id => `#${id}`).join(' - ');

      const html = `<!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>إزالة دعاية - ${teamName} - عقود ${contractNumbers} - ${adTypesStr}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
            @font-face { font-family: 'Doran'; src: url('/Doran-Regular.otf') format('opentype'); font-weight: 400; font-style: normal; font-display: swap; }
            @font-face { font-family: 'Doran'; src: url('/Doran-Bold.otf') format('opentype'); font-weight: 700; font-style: normal; font-display: swap; }
            * { margin: 0 !important; padding: 0 !important; box-sizing: border-box; }
            html, body { width: 100% !important; height: 100% !important; overflow: hidden; font-family: 'Noto Sans Arabic','Doran','Arial Unicode MS',Arial,sans-serif; direction: rtl; text-align: right; background: #fff; color: #000; }
            .template-container { position: relative; width: 100vw; height: 100vh; overflow: hidden; display: block; }
            .template-image { position: absolute; inset: 0; width: 100% !important; height: 100% !important; object-fit: cover; object-position: center; z-index: 1; display: block; }
            .page { page-break-after: always; page-break-inside: avoid; }
            .contract-header { position: absolute; top: 33mm; right: 13mm; z-index: 30; font-family: 'Doran', 'Noto Sans Arabic', sans-serif; font-size: 10px; text-align: right; }
            .contract-header p { margin: 0; padding: 1px 0; }
            .table-area { position: absolute; top: 63.53mm; left: 12.8765mm; right: 12.8765mm; z-index: 20; }
            .btable { width: 100%; border-collapse: collapse; border-spacing: 0; font-size: 7px; font-family: 'Doran','Noto Sans Arabic','Arial Unicode MS',Arial,sans-serif; table-layout: fixed; border: 0.2mm solid #000; }
            .btable tr { height: 22mm; max-height: 22mm; }
            .btable td { border: 0.2mm solid #000; padding: 0 0.5mm; vertical-align: middle; text-align: center; background: transparent; color: #000; white-space: normal; word-break: break-word; overflow: hidden; height: 22mm; }
            .c-img { height: 100%; padding: 0.5mm !important; }
            .c-img img { width: 100%; height: 100%; max-height: 21mm; object-fit: contain; object-position: center; display: block; }
            @media print { html, body { width: 210mm !important; min-height: 297mm !important; height: auto !important; margin:0 !important; padding:0 !important; overflow: visible !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .template-container { width: 210mm !important; height: 297mm !important; position: relative !important; }
              .template-image { width: 210mm !important; height: 297mm !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @page { size: A4; margin: 0 !important; padding: 0 !important; } .controls{display:none!important}
            }
            .controls{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:99}
            .controls button{padding:8px 14px;border:0;border-radius:6px;background:#dc2626;color:#fff;cursor:pointer}
          </style>
        </head>
        <body>
          ${tablePagesHtml}
          <div class="controls"><button onclick="window.print()">طباعة</button></div>
        </body>
        </html>`;

      const w = window.open('', '_blank');
      if (!w) { toast.error('فشل فتح نافذة الطباعة'); return; }
      w.document.write(html); 
      w.document.close(); 
      w.focus(); 
      setTimeout(() => w.print(), 600);
      setPrintDialogOpen(false);
      toast.success(`تم تحضير ${billboards.length} لوحة للطباعة`);
    } catch (e) {
      console.error(e);
      toast.error('فشل طباعة الإزالة');
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      pending: { variant: 'secondary', label: 'معلق', icon: Clock },
      in_progress: { variant: 'default', label: 'قيد الإزالة', icon: Clock },
      completed: { variant: 'default', label: 'مكتمل', icon: CheckCircle2 },
      cancelled: { variant: 'destructive', label: 'ملغي', icon: XCircle },
    };
    const config = variants[status] || variants.pending;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const itemsByTask = useMemo(() => {
    const grouped: Record<string, RemovalTaskItem[]> = {};
    allTaskItems.forEach(item => {
      if (!grouped[item.task_id]) {
        grouped[item.task_id] = [];
      }
      grouped[item.task_id].push(item);
    });
    return grouped;
  }, [allTaskItems]);

  // تجميع المهام حسب الفريق مباشرةً من tasks الخام (يُستخدم في نوافذ الطباعة والواتساب)
  const tasksByTeamForPrint = useMemo(() => {
    const grouped: Record<string, RemovalTask[]> = {};
    tasks.forEach(task => {
      const teamId = task.team_id || 'unknown';
      if (!grouped[teamId]) {
        grouped[teamId] = [];
      }
      grouped[teamId].push(task);
    });
    return grouped;
  }, [tasks]);

  const toggleSelectAll = (taskId: string) => {
    const taskItems = itemsByTask[taskId] || [];
    const pendingItems = taskItems.filter(i => i.status === 'pending');
    
    const allSelected = pendingItems.every(item => selectedItems.has(item.id));
    
    const newSet = new Set(selectedItems);
    if (allSelected) {
      pendingItems.forEach(item => newSet.delete(item.id));
    } else {
      pendingItems.forEach(item => newSet.add(item.id));
      setSelectedTeamId(taskId);
    }
    setSelectedItems(newSet);
  };

  const toggleTaskSelection = (taskId: string) => {
    const newSet = new Set(selectedTasks);
    if (newSet.has(taskId)) {
      newSet.delete(taskId);
    } else {
      newSet.add(taskId);
    }
    setSelectedTasks(newSet);
  };

  // حساب IDs العقود الموجودة في مهام نشطة (معلقة أو قيد التنفيذ)
  const existingTaskContractIds = useMemo(() => {
    return new Set(
      tasks
        .filter(t => t.status === 'pending' || t.status === 'in_progress')
        .flatMap(t => t.contract_ids || [t.contract_id])
    );
  }, [tasks]);

  const existingTaskBillboardIds = useMemo(() => {
    return new Set(
      allTaskItems
        .filter(item => {
          const task = taskById[item.task_id];
          return task && (task.status === 'pending' || task.status === 'in_progress');
        })
        .map(item => item.billboard_id)
    );
  }, [allTaskItems, taskById]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-[1800px] space-y-4 p-3 pb-24 sm:p-4 md:space-y-5 md:p-6" dir="rtl">
      <div className="flex flex-col gap-4 rounded-2xl border border-primary/20 bg-card/70 p-4 shadow-sm backdrop-blur-md md:flex-row md:items-center md:justify-between md:p-5">
        <div className="flex items-center gap-3 text-right">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-black tracking-tight text-foreground md:text-3xl">
              مهام إزالة الدعاية
            </h1>
            <p className="text-xs font-medium leading-relaxed text-muted-foreground md:text-sm">
              متابعة العقود المنتهية، توزيع اللوحات على الفرق وتوثيق الإزالة
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:mr-auto" onClick={e => e.stopPropagation()}>
          <div className="hidden items-center gap-2 rounded-xl border border-border/40 bg-background/50 px-3 py-2 lg:flex">
            <span className="text-[10px] font-bold text-muted-foreground">مهام نشطة</span>
            <span className="font-mono text-sm font-black text-foreground">
              {tasks.filter(task => (itemsByTask[task.id] || []).some(item => item.status !== 'completed')).length}
            </span>
          </div>
          <div className="hidden items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2 lg:flex">
            <span className="text-[10px] font-bold text-muted-foreground">لوحات بانتظار الإزالة</span>
            <span className="font-mono text-sm font-black text-rose-400">
              {allTaskItems.filter(item => item.status !== 'completed').length}
            </span>
          </div>

          {/* إجراء سياقي: يظهر فقط عند تحديد مهام */}
          {selectedTasks.size > 0 && (
            <>
              <Button
                onClick={async () => {
                  if (!confirm(`هل تريد دمج ${selectedTasks.size} مهام مختارة؟`)) return;
                  try {
                    const selectedTasksList = Array.from(selectedTasks);
                    const tasksToMerge = tasks.filter(t => selectedTasksList.includes(t.id));
                    if (tasksToMerge.length < 2) {
                      toast.error('يجب اختيار مهمتين على الأقل للدمج');
                      return;
                    }
                    const firstTeamId = tasksToMerge[0].team_id;
                    if (!tasksToMerge.every(t => t.team_id === firstTeamId)) {
                      toast.error('يجب أن تكون جميع المهام لنفس الفريق');
                      return;
                    }
                    const allContractIds = new Set<number>();
                    tasksToMerge.forEach(task => {
                      if (task.contract_ids && Array.isArray(task.contract_ids)) {
                        task.contract_ids.forEach(id => allContractIds.add(id));
                      } else {
                        allContractIds.add(task.contract_id);
                      }
                    });
                    const { data: mergedTask, error: mergeError } = await supabase
                      .from('removal_tasks')
                      .insert({
                        contract_id: Array.from(allContractIds)[0],
                        contract_ids: Array.from(allContractIds),
                        team_id: firstTeamId,
                        status: 'pending',
                        created_at: new Date().toISOString()
                      })
                      .select()
                      .single();
                    if (mergeError) throw mergeError;
                    for (const task of tasksToMerge) {
                      const taskItems = itemsByTask[task.id] || [];
                      for (const item of taskItems) {
                        await supabase
                          .from('removal_task_items')
                          .update({ task_id: mergedTask.id })
                          .eq('id', item.id);
                      }
                      await supabase
                        .from('removal_tasks')
                        .delete()
                        .eq('id', task.id);
                    }
                    toast.success(`تم دمج ${selectedTasks.size} مهام بنجاح`);
                    setSelectedTasks(new Set());
                    queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
                    queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
                  } catch (error: any) {
                    toast.error('فشل دمج المهام: ' + error.message);
                  }
                }}
                size="sm"
                className="h-10 cursor-pointer gap-2 rounded-xl border border-primary/35 bg-primary/10 px-4 text-xs font-bold text-primary transition-all duration-200 hover:bg-primary/15 active:scale-95"
              >
                <Merge className="h-3.5 w-3.5" />
                دمج {selectedTasks.size} مهام
              </Button>

              <Button
                onClick={() => setSendTeamDialogOpen(true)}
                size="sm"
                className="h-10 cursor-pointer gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 text-xs font-bold text-emerald-500 transition-all duration-200 hover:bg-emerald-500/15 active:scale-95"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                إرسال للفرق
              </Button>

              <div className="w-px h-7 bg-border/40 mx-0.5" aria-hidden="true" />
            </>
          )}

          {/* إجراء ثانوي: تقرير الإحصائيات */}
          <Button
            onClick={() => setStatsDialogOpen(true)}
            variant="outline"
            size="sm"
            className="h-10 cursor-pointer gap-2 rounded-xl border-border/40 bg-background/50 px-4 text-xs font-bold text-muted-foreground transition-all duration-200 hover:border-primary/30 hover:bg-muted/40 hover:text-foreground active:scale-95"
          >
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
            تقرير الإحصائيات
          </Button>

          {/* قائمة أدوات الصيانة: تجميع الإجراءات الثانوية */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-10 cursor-pointer gap-2 rounded-xl border-border/40 bg-background/50 px-4 text-xs font-bold text-muted-foreground transition-all duration-200 hover:border-primary/30 hover:bg-muted/40 hover:text-foreground active:scale-95"
              >
                <Wrench className="h-3.5 w-3.5 text-primary" />
                أدوات الصيانة
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60 rounded-xl">
              <DropdownMenuLabel className="text-xs text-muted-foreground">أدوات تنظيم وصيانة المهام</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => cleanupRentedMutation.mutate()}
                disabled={cleanupRentedMutation.isPending}
                className="gap-2.5 cursor-pointer rounded-lg focus:bg-[#d6ac40]/10"
              >
                <Trash2 className="h-4 w-4 text-rose-500" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold">تنظيف المؤجرة</span>
                  <span className="text-[10px] text-muted-foreground">حذف مهام اللوحات المؤجرة</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => redistributeRemovalMutation.mutate()}
                disabled={redistributeRemovalMutation.isPending}
                className="gap-2.5 cursor-pointer rounded-lg focus:bg-[#d6ac40]/10"
              >
                <RotateCcw className="h-4 w-4 text-amber-500" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold">إعادة التوزيع</span>
                  <span className="text-[10px] text-muted-foreground">توزيع المهام على الفرق</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => mergeRemovalTasksMutation.mutate()}
                disabled={mergeRemovalTasksMutation.isPending}
                className="gap-2.5 cursor-pointer rounded-lg focus:bg-[#d6ac40]/10"
              >
                <Merge className="h-4 w-4 text-indigo-500" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold">تجميع المهام</span>
                  <span className="text-[10px] text-muted-foreground">دمج مهام الفريق الواحد</span>
                </div>
              </DropdownMenuItem>
              {duplicateTasksCount > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => cleanupDuplicatesMutation.mutate()}
                    disabled={cleanupDuplicatesMutation.isPending}
                    className="gap-2.5 cursor-pointer rounded-lg focus:bg-red-500/10"
                  >
                    <ShieldAlert className="h-4 w-4 text-red-500 animate-pulse" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-red-500">حذف {duplicateTasksCount} مهمة مكررة</span>
                      <span className="text-[10px] text-muted-foreground">تنظيف تلقائي للمكررات</span>
                    </div>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
              queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
            }}
            variant="outline"
            size="icon"
            className="h-10 w-10 cursor-pointer rounded-xl border-border/40 bg-background/50 text-muted-foreground transition-all duration-200 hover:border-primary/30 hover:bg-primary/10 hover:text-primary active:scale-95"
            aria-label="تحديث مهام الإزالة"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          {/* إجراء أساسي: إزالة يدوية */}
          <Button
            onClick={() => setManualOpen(true)}
            size="sm"
            className="h-10 cursor-pointer gap-2 rounded-xl bg-primary px-5 text-xs font-black text-primary-foreground shadow-md shadow-primary/15 transition-all duration-200 hover:bg-primary/90 active:scale-95"
          >
            <Package className="h-3.5 w-3.5" />
            إزالة يدوية
          </Button>
        </div>
      </div>

      {/* تنبيه العقود المنتهية */}
      <ExpiredContractsAlert
        teams={teams}
        existingTaskContractIds={existingTaskContractIds}
        onTaskCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
          queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
        }}
      />

      {/* ── Hybrid Visual Board ── */}
      <RemovalTasksBoard
        tasks={tasks}
        allTaskItems={allTaskItems}
        billboardById={billboardById}
        contractByNumber={contractByNumber}
        teamById={teamById}
        teams={teams}
        isLoading={isLoading}
        page={boardPage}
        onPageChange={setBoardPage}
        totalTasks={tasks.length}
        pendingTasks={tasks.filter(task => {
          const taskItemsList = itemsByTask[task.id] || [];
          return taskItemsList.some(i => i.status === 'pending');
        }).length}
        completedTasks={tasks.filter(task => {
          const taskItemsList = itemsByTask[task.id] || [];
          return taskItemsList.length > 0 && taskItemsList.every(i => i.status === 'completed');
        }).length}
        totalItems={allTaskItems.length}
        completedItems={allTaskItems.filter(i => i.status === 'completed').length}
        onRefresh={() => {
          queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
          queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
        }}
        onAddTask={() => setManualOpen(true)}
        onDeleteTask={(taskId) => deleteTaskMutation.mutate(taskId)}
        onPrintTask={(task, items) => {
          const contract = contractByNumber[task.contract_id];
          const team = teamById[task.team_id];
          const printItems: BillboardPrintItem[] = items.map((item: any) => ({
            id: item.id,
            billboard_id: item.billboard_id,
            design_face_a: item.design_face_a || null,
            design_face_b: item.design_face_b || null,
            installed_image_face_a_url: item.installed_image_face_a_url || item.installed_image_url || null,
            installed_image_face_b_url: item.installed_image_face_b_url || null,
            team_id: task.team_id,
            contract_number: task.contract_id,
            ad_type: contract?.['Ad Type'] || null,
          }));
          setUnifiedPrintData({
            teamId: task.team_id,
            teamName: team?.team_name || 'فريق غير محدد',
            items: printItems,
            billboards: billboardById,
            teams: teamById,
          });
          setUnifiedPrintDialogOpen(true);
        }}
        onUndoRemoval={(itemId) => undoRemovalMutation.mutate(itemId)}
        onCompleteAll={(taskId) => {
          const taskItems = (itemsByTask[taskId] || []).filter((i: any) => i.status !== 'completed');
          if (taskItems.length === 0) {
            toast.info('جميع اللوحات مكتملة بالفعل');
            return;
          }
          const newSet = new Set<string>();
          taskItems.forEach((i: any) => newSet.add(i.id));
          setSelectedItems(newSet);
          setSelectedTeamId(taskId);
          setRemovalDate(new Date());
        }}
        selectedItems={selectedItems}
        onToggleItem={(itemId, taskId) => {
          const newSet = new Set(selectedItems);
          if (newSet.has(itemId)) {
            newSet.delete(itemId);
          } else {
            newSet.add(itemId);
            setSelectedTeamId(taskId);
          }
          setSelectedItems(newSet);
        }}
        onToggleSelectAll={(taskId) => toggleSelectAll(taskId)}
        onPrintAllTeam={(teamId) => {
          const team = teamById[teamId];
          const teamName = team?.team_name || 'فريق غير محدد';
          const teamTasks = tasks.filter(t => t.team_id === teamId);
          const teamTaskIds = teamTasks.map(t => t.id);
          const teamItems = allTaskItems.filter(item => teamTaskIds.includes(item.task_id) && item.status !== 'completed');
          
          if (teamItems.length === 0) {
            toast.error(`لا توجد لوحات معلقة للطباعة لفرقة "${teamName}"`);
            return;
          }

          const printItems: BillboardPrintItem[] = teamItems.map((item: any) => {
            const task = tasks.find(t => t.id === item.task_id);
            const contract = task ? contractByNumber[task.contract_id] : null;
            return {
              id: item.id,
              billboard_id: item.billboard_id,
              design_face_a: item.design_face_a || null,
              design_face_b: item.design_face_b || null,
              installed_image_face_a_url: item.installed_image_face_a_url || item.installed_image_url || null,
              installed_image_face_b_url: item.installed_image_face_b_url || null,
              team_id: teamId,
              contract_number: task?.contract_id,
              ad_type: contract?.['Ad Type'] || null,
            };
          });

          setUnifiedPrintData({
            teamId,
            teamName,
            items: printItems,
            billboards: billboardById,
            teams: teamById,
          });
          setUnifiedPrintDialogOpen(true);
        }}
        onSyncMissingBillboards={(contractId, taskIds) => syncMissingRemovalMutation.mutate({ contractId, taskIds })}
        onSendWhatsApp={(task, items) => {
          const contract = contractByNumber[task.contract_id];
          const team = teamById[task.team_id];
          const teamPhone = team?.phone || team?.phone_number;
          const teamName = team?.team_name || 'فريق غير محدد';
          const customerName = contract?.['Customer Name'] || 'غير محدد';
          const adType = contract?.['Ad Type'] || '';
          const billboardDetails = items.map((item: any) => {
            const bb = billboardById[item.billboard_id];
            const gps = bb?.GPS_Coordinates ? `\n  إحداثيات: ${bb.GPS_Coordinates}` : '';
            return `• ${bb?.Billboard_Name || `لوحة #${item.billboard_id}`} - ${bb?.City || ''} ${bb?.District || ''}${gps}`;
          }).join('\n');
          const message = `مهمة إزالة\n\nالزبون: ${customerName}\nنوع الإعلان: ${adType}\nعقد رقم: #${task.contract_id}\nعدد اللوحات: ${items.length}\nالفرقة: ${teamName}\n\nاللوحات المطلوب إزالتها:\n${billboardDetails}`;
          if (teamPhone) {
            const cleanPhone = teamPhone.replace(/[^0-9+]/g, '').replace(/^\+/, '');
            window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
          } else {
            window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
          }
        }}
        onCompleteItem={(itemId, taskId) => {
          const newSet = new Set<string>();
          newSet.add(itemId);
          setSelectedItems(newSet);
          setSelectedTeamId(taskId);
          setRemovalDate(new Date());
        }}
        onBulkComplete={(taskIds) => {
          const newSet = new Set<string>();
          taskIds.forEach(taskId => {
            const items = (itemsByTask[taskId] || []).filter((i: any) => i.status !== 'completed');
            items.forEach((i: any) => newSet.add(i.id));
          });
          if (newSet.size === 0) {
            toast.info('جميع اللوحات مكتملة بالفعل');
            return;
          }
          setSelectedItems(newSet);
          setSelectedTeamId(taskIds[0] || '');
          setRemovalDate(new Date());
        }}
        onBulkPrint={(taskIds) => {
          const allItems: any[] = [];
          taskIds.forEach(taskId => {
            const task = tasks.find(t => t.id === taskId);
            if (!task) return;
            const items = itemsByTask[taskId] || [];
            items.forEach((item: any) => {
              allItems.push({
                id: item.id,
                billboard_id: item.billboard_id,
                design_face_a: item.design_face_a || null,
                design_face_b: item.design_face_b || null,
                installed_image_face_a_url: item.installed_image_face_a_url || item.installed_image_url || null,
                installed_image_face_b_url: item.installed_image_face_b_url || null,
                team_id: task.team_id,
                contract_number: task.contract_id,
                ad_type: contractByNumber[task.contract_id]?.['Ad Type'] || null,
              });
            });
          });
          if (allItems.length === 0) {
            toast.error('لا توجد لوحات للطباعة');
            return;
          }
          const firstTask = tasks.find(t => t.id === taskIds[0]);
          setUnifiedPrintData({
            teamId: firstTask?.team_id || '',
            teamName: teamById[firstTask?.team_id]?.team_name || 'فريق',
            items: allItems,
            billboards: billboardById,
            teams: teamById,
          });
          setUnifiedPrintDialogOpen(true);
        }}
        onBulkDelete={(taskIds) => {
          taskIds.forEach(taskId => deleteTaskMutation.mutate(taskId));
        }}
      />

      {/* Floating Selection Bar for Removal Completion */}
      <AnimatePresence>
        {selectedItems.size > 0 && (
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-3xl -translate-x-1/2">
            <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-card/95 p-3 text-foreground shadow-2xl shadow-black/30 backdrop-blur-xl sm:justify-start">
              <Badge variant="secondary" className="h-10 rounded-xl border border-primary/20 bg-primary/10 px-4 text-sm font-black text-primary">
                {selectedItems.size} لوحة محددة
              </Badge>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-10 cursor-pointer gap-2 rounded-xl border-border/50 bg-background/60 text-xs font-bold transition-all duration-200 hover:border-primary/30 hover:bg-primary/10 active:scale-95">
                    <CalendarIcon className="h-4 w-4" />
                    {removalDate ? format(removalDate, 'dd MMM yyyy', { locale: ar }) : 'تاريخ الإزالة'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                  <Calendar mode="single" selected={removalDate} onSelect={setRemovalDate} locale={ar} className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Button
                onClick={() => completeItemsMutation.mutate()}
                disabled={!removalDate || completeItemsMutation.isPending}
                className="h-10 cursor-pointer gap-2 rounded-xl bg-primary px-5 text-xs font-black text-primary-foreground shadow-md shadow-primary/15 transition-all duration-200 hover:bg-primary/90 active:scale-95 sm:mr-auto"
              >
                <CheckCircle2 className="h-4 w-4" />
                {completeItemsMutation.isPending ? 'جاري...' : 'تأكيد الإزالة'}
              </Button>
              <Button variant="ghost" size="icon" className="h-10 w-10 cursor-pointer rounded-xl text-muted-foreground transition-all duration-200 hover:bg-muted/60 hover:text-foreground active:scale-95" onClick={() => { setSelectedItems(new Set()); setSelectedTeamId(''); }} aria-label="إلغاء تحديد اللوحات">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Print Dialog */}
      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen} modal={true}>
        <DialogContent className="overflow-hidden rounded-2xl border-primary/20 bg-card p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-border/35 bg-primary/[0.05] p-5 text-right">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <Printer className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-black">خيارات طباعة مهمة الإزالة</DialogTitle>
                <p className="mt-1 text-[11px] text-muted-foreground">حدد شكل التقرير والصور التي تريد إظهارها</p>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 p-5">
            <div className="rounded-xl border border-border/40 bg-background/40 p-3">
              <Label className="text-xs font-bold">نوع الطباعة</Label>
              <Select value={printType} onValueChange={(v: any) => setPrintType(v)}>
                <SelectTrigger className="mt-2 h-10 rounded-xl border-border/45 bg-background/70">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={5}>
                  <SelectItem value="individual">لوحات منفصلة</SelectItem>
                  <SelectItem value="table">جدول شامل</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl border border-border/40 bg-background/40 p-3">
              <Label className="text-xs font-bold">نوع الصور</Label>
              <Select value={printImageType} onValueChange={(v: any) => setPrintImageType(v)}>
                <SelectTrigger className="mt-2 h-10 rounded-xl border-border/45 bg-background/70">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={5}>
                  <SelectItem value="default">الصور الافتراضية</SelectItem>
                  <SelectItem value="installed">صور التركيب</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex min-h-11 items-center gap-3 rounded-xl border border-border/40 bg-background/40 px-3">
              <Checkbox
                id="include-designs"
                checked={includeDesigns}
                onCheckedChange={(checked) => setIncludeDesigns(!!checked)}
              />
              <Label htmlFor="include-designs" className="cursor-pointer">
                تضمين التصميمات
              </Label>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-border/30 pt-4">
              <Button variant="outline" onClick={() => setPrintDialogOpen(false)} className="h-10 cursor-pointer rounded-xl px-5 text-xs font-bold active:scale-95">
                إلغاء
              </Button>
              <Button onClick={executePrint} className="h-10 cursor-pointer gap-2 rounded-xl bg-primary px-5 text-xs font-black text-primary-foreground active:scale-95">
                <Printer className="h-4 w-4" />
                تجهيز الطباعة
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print All Team Billboards Dialog */}
      <Dialog open={printAllDialogOpen} onOpenChange={setPrintAllDialogOpen} modal={true}>
        <DialogContent className="overflow-hidden rounded-2xl border-primary/20 bg-card p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-border/35 bg-primary/[0.05] p-5 text-right">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Printer className="h-5 w-5" /></div>
              <div>
                <DialogTitle className="text-base font-black">طباعة لوحات فريق الإزالة</DialogTitle>
                <p className="mt-1 text-[11px] text-muted-foreground">سيتم تجهيز اللوحات المعلقة فقط للفريق المحدد</p>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 p-5">
            <div className="rounded-xl border border-border/40 bg-background/40 p-3">
              <Label className="text-xs font-bold">نوع الصور</Label>
              <Select value={printImageType} onValueChange={(v: any) => setPrintImageType(v)}>
                <SelectTrigger className="mt-2 h-10 rounded-xl border-border/45 bg-background/70">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={5}>
                  <SelectItem value="default">الصور الافتراضية للوحات</SelectItem>
                  <SelectItem value="installed">صور التركيب</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex min-h-11 items-center gap-3 rounded-xl border border-border/40 bg-background/40 px-3">
              <Checkbox
                id="include-designs-all"
                checked={includeDesigns}
                onCheckedChange={(checked) => setIncludeDesigns(!!checked)}
              />
              <Label htmlFor="include-designs-all" className="cursor-pointer">
                تضمين التصميمات
              </Label>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-border/30 pt-4">
              <Button variant="outline" onClick={() => setPrintAllDialogOpen(false)} className="h-10 cursor-pointer rounded-xl px-5 text-xs font-bold active:scale-95">
                إلغاء
              </Button>
              {printAllTeamId && (() => {
                const team = teamById[printAllTeamId];
                const phone = team?.phone_number;
                if (!phone) return null;
                
                const handleSendWhatsApp = () => {
                  const teamName = team?.team_name || 'غير محدد';
                  const teamTasks = tasksByTeamForPrint[printAllTeamId] || [];
                  const teamTaskIds = teamTasks.map((t: any) => t.id);
                  const teamItems = allTaskItems.filter((item: any) => 
                    teamTaskIds.includes(item.task_id) && item.status === 'pending'
                  );
                  
                  let msg = `*مهام الإزالة - فريق ${teamName}*\n\n`;
                  
                  const itemsByCity: Record<string, any[]> = {};
                  teamItems.forEach((item: any) => {
                    const bb = billboardById[item.billboard_id];
                    const city = bb?.City || 'غير محدد';
                    if (!itemsByCity[city]) itemsByCity[city] = [];
                    itemsByCity[city].push(bb);
                  });
                  
                  Object.entries(itemsByCity).sort().forEach(([city, bbs]) => {
                    msg += `*المدينة: ${city}*\n`;
                    bbs.forEach((bb: any, i: number) => {
                      const name = bb?.Billboard_Name || `لوحة #${bb?.ID}`;
                      const size = bb?.Size || '';
                      msg += `  ${i + 1}. ${name}`;
                      if (size) msg += ` (${size})`;
                      msg += '\n';
                      const gpsLink = (bb?.GPS_Link && !bb.GPS_Link.endsWith('q=0') && bb.GPS_Link !== '')
                        ? bb.GPS_Link
                        : (bb?.GPS_Coordinates && bb.GPS_Coordinates !== '0' && bb.GPS_Coordinates !== '')
                          ? `https://www.google.com/maps?q=${bb.GPS_Coordinates}`
                          : '';
                      if (gpsLink) msg += `     الموقع: ${gpsLink}\n`;
                    });
                    msg += '\n';
                  });
                  
                  msg += `━━━━━━━━━━━━━━━━━\n`;
                  msg += `*الإجمالي: ${teamItems.length} لوحة*`;
                  
                  const cleanPhone = phone.replace(/[^0-9+]/g, '').replace(/^\+/, '');
                  window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                };
                
                return (
                  <Button
                    onClick={handleSendWhatsApp}
                    variant="outline"
                    className="h-10 cursor-pointer gap-2 rounded-xl border-emerald-500/30 px-4 text-xs font-bold text-emerald-500 transition-all duration-200 hover:bg-emerald-500/10 active:scale-95"
                  >
                    <MessageCircle className="h-4 w-4" />
                    واتساب
                  </Button>
                );
              })()}
              <Button className="h-10 cursor-pointer gap-2 rounded-xl bg-primary px-5 text-xs font-black text-primary-foreground transition-all duration-200 hover:bg-primary/90 active:scale-95" onClick={() => {
                if (printAllTeamId) {
                  // Get all pending items for this team
                  const teamTasks = tasksByTeamForPrint[printAllTeamId] || [];
                  const teamTaskIds = teamTasks.map(t => t.id);
                  const teamItems = allTaskItems.filter(item => 
                    teamTaskIds.includes(item.task_id) && item.status === 'pending'
                  );
                  
                  if (teamItems.length === 0) {
                    toast.error('لا توجد لوحات معلقة للطباعة');
                    return;
                  }

                  const billboardsForPrint = teamItems.map(item => {
                    const billboard = billboardById[item.billboard_id];
                    return {
                      ...billboard,
                      ...(printImageType === 'installed' && item.installed_image_url ? {
                        Image_URL: item.installed_image_url
                      } : {}),
                      design_face_a: includeDesigns ? item.design_face_a : null,
                      design_face_b: includeDesigns ? item.design_face_b : null
                    };
                  }).filter(Boolean);

                  setBillboardPrintData({
                    contractNumber: 'إزالة - جميع اللوحات',
                    customerName: '',
                    billboards: billboardsForPrint
                  });
                  setBillboardPrintOpen(true);
                  setPrintAllDialogOpen(false);
                  toast.success(`تم تجهيز ${billboardsForPrint.length} لوحة للطباعة`);
                }
              }}>
                <Printer className="h-4 w-4" />
                طباعة الكل
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Billboard Bulk Print Dialog */}
      {billboardPrintData && (
        <BillboardBulkPrintDialog
          open={billboardPrintOpen}
          onOpenChange={(open) => {
            setBillboardPrintOpen(open);
            if (!open) setBillboardPrintData(null);
          }}
          billboards={billboardPrintData.billboards}
          contractInfo={{
            number: Number(billboardPrintData.contractNumber) || 0,
            customerName: billboardPrintData.customerName || 'إزالة'
          }}
        />
      )}

      {/* Removal Stats Dialog */}
      <RemovalStatsDialog
        open={statsDialogOpen}
        onOpenChange={setStatsDialogOpen}
      />

      {/* Unified Print All Dialog */}
      {unifiedPrintData && (
        <UnifiedPrintAllDialog
          open={unifiedPrintDialogOpen}
          onOpenChange={(open) => {
            setUnifiedPrintDialogOpen(open);
            if (!open) setUnifiedPrintData(null);
          }}
          contextType="removal"
          contextNumber={unifiedPrintData.teamName}
          customerName={unifiedPrintData.teamName}
          items={unifiedPrintData.items}
          billboards={unifiedPrintData.billboards}
          teams={unifiedPrintData.teams}
          showTeamFilter={true}
          customerPhone={unifiedPrintData.customerPhone}
          title={`طباعة لوحات الإزالة - ${unifiedPrintData.teamName}`}
        />
      )}

      {/* Manual Removal Task Dialog */}
      <ManualRemovalTaskDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        teams={teams}
        existingTaskBillboardIds={existingTaskBillboardIds}
      />

      <SendTeamInstallationReportDialog
        open={sendTeamDialogOpen}
        onOpenChange={setSendTeamDialogOpen}
        tasks={tasks.filter(t => selectedTasks.has(t.id))}
        allTaskItems={allTaskItems}
        billboardById={billboardById}
        teamById={teamById}
        contractById={contractByNumber}
        designsByTask={{}}
        teams={teams}
      />
    </div>
  );
}
