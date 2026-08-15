import { useAuth } from '@/contexts/AuthContext';
import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UnifiedTaskInvoice, InvoiceType } from '@/components/composite-tasks/UnifiedTaskInvoice';
import { FullStatementOptionsDialog, FullStatementOptions } from '@/components/billing/FullStatementOptionsDialog';
import { CompositeTaskWithDetails } from '@/types/composite-task';
import { PrinterPaymentDialog } from '@/components/printers/PrinterPaymentDialog';
import { toast } from 'sonner';
import { 
  Search, 
  Printer, 
  TrendingUp, 
  TrendingDown,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Wallet,
  FileText,
  Scissors,
  Calendar,
  User,
  DollarSign,
  Clock,
  CheckCircle,
  Plus,
  Trash2,
  History,
  PrinterIcon,
  CreditCard,
  AlertCircle,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Edit2 } from 'lucide-react';

interface PrinterAccount {
  printer_id: string;
  printer_name: string;
  customer_id: string | null;
  customer_name: string | null;
  total_print_costs: number;
  total_cutout_costs: number;
  total_supplier_debt: number;
  total_payments_to_printer: number;
  total_customer_debt: number;
  total_customer_payments: number;
  final_balance: number;
  print_tasks_count: number;
  cutout_tasks_count: number;
}

interface PrintTask {
  id: string;
  contract_id: number;
  customer_name: string | null;
  status: string;
  total_area: number;
  total_cost: number;
  price_per_meter: number;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  installation_task_id: string | null;
}

interface CutoutTask {
  id: string;
  contract_id: number;
  customer_name: string | null;
  status: string;
  total_quantity: number;
  unit_cost: number;
  total_cost: number;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  installation_task_id: string | null;
}

interface PrinterPayment {
  id: string;
  printer_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

export default function PrinterAccounts() {
  const { canEdit: canEditAuth } = useAuth();
  const canEditSection = canEditAuth('printer_accounts');
  const queryClient = useQueryClient();
  const { confirm: systemConfirm } = useSystemDialog();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(null);
  const [expandedContracts, setExpandedContracts] = useState<Set<number>>(new Set());
  const [unifiedInvoiceOpen, setUnifiedInvoiceOpen] = useState(false);
  const [unifiedInvoiceTask, setUnifiedInvoiceTask] = useState<CompositeTaskWithDetails | null>(null);
  const [unifiedInvoiceType, setUnifiedInvoiceType] = useState<InvoiceType>('print_vendor');
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('tasks');
  const [pendingQueue, setPendingQueue] = useState<{ task: CompositeTaskWithDetails; type: InvoiceType }[]>([]);
  const [pendingQueueIndex, setPendingQueueIndex] = useState(0);
  const [fullStatementDialogOpen, setFullStatementDialogOpen] = useState(false);
  const [editingPriceTaskId, setEditingPriceTaskId] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState('');

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['printer-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('printer_accounts')
        .select('*')
        .order('printer_name');
      if (error) throw error;
      return (data || []) as PrinterAccount[];
    }
  });

  const { data: printTasks = [] } = useQuery({
    queryKey: ['printer-print-tasks', selectedPrinterId],
    queryFn: async () => {
      if (!selectedPrinterId) return [];
      const { data, error } = await supabase
        .from('print_tasks')
        .select('*, installation_task_id')
        .eq('printer_id', selectedPrinterId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as PrintTask[];
    },
    enabled: !!selectedPrinterId
  });

  const { data: cutoutTasks = [] } = useQuery({
    queryKey: ['printer-cutout-tasks', selectedPrinterId],
    queryFn: async () => {
      if (!selectedPrinterId) return [];
      const { data, error } = await supabase
        .from('cutout_tasks')
        .select('*, installation_task_id')
        .eq('printer_id', selectedPrinterId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as CutoutTask[];
    },
    enabled: !!selectedPrinterId
  });

  const { data: payments = [], refetch: refetchPayments } = useQuery({
    queryKey: ['printer-payments', selectedPrinterId],
    queryFn: async () => {
      if (!selectedPrinterId) return [];
      const { data, error } = await supabase
        .from('printer_payments')
        .select('*')
        .eq('printer_id', selectedPrinterId)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return (data || []) as PrinterPayment[];
    },
    enabled: !!selectedPrinterId
  });

  const filteredAccounts = accounts.filter(account =>
    account.printer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const overallStats = useMemo(() => {
    return accounts.reduce((acc, a) => ({
      totalPrinters: acc.totalPrinters + 1,
      totalTasks: acc.totalTasks + a.print_tasks_count + a.cutout_tasks_count,
      totalOwed: acc.totalOwed + (a.final_balance > 0 ? a.final_balance : 0),
      totalOwing: acc.totalOwing + (a.final_balance < 0 ? Math.abs(a.final_balance) : 0),
    }), { totalPrinters: 0, totalTasks: 0, totalOwed: 0, totalOwing: 0 });
  }, [accounts]);

  const selectedPrinter = accounts.find(a => a.printer_id === selectedPrinterId);

  const groupedPrintTasks = printTasks.reduce((groups, task) => {
    const contractId = task.contract_id || 0;
    if (!groups[contractId]) groups[contractId] = [];
    groups[contractId].push(task);
    return groups;
  }, {} as Record<number, PrintTask[]>);

  const groupedCutoutTasks = cutoutTasks.reduce((groups, task) => {
    const contractId = task.contract_id || 0;
    if (!groups[contractId]) groups[contractId] = [];
    groups[contractId].push(task);
    return groups;
  }, {} as Record<number, CutoutTask[]>);

  const allContractIds = [...new Set([
    ...Object.keys(groupedPrintTasks).map(Number),
    ...Object.keys(groupedCutoutTasks).map(Number)
  ])].sort((a, b) => b - a);

  const toggleContract = (contractId: number) => {
    const newExpanded = new Set(expandedContracts);
    if (newExpanded.has(contractId)) {
      newExpanded.delete(contractId);
    } else {
      newExpanded.add(contractId);
    }
    setExpandedContracts(newExpanded);
  };

  const buildMockCompositeTask = (task: PrintTask | CutoutTask, type: 'print' | 'cutout'): CompositeTaskWithDetails => {
    const installationTaskId = task.installation_task_id || '';
    return {
      id: task.id,
      created_at: task.created_at,
      updated_at: task.created_at,
      contract_id: task.contract_id,
      customer_id: null,
      customer_name: task.customer_name,
      task_type: 'new_installation',
      installation_task_id: installationTaskId,
      print_task_id: type === 'print' ? task.id : null,
      cutout_task_id: type === 'cutout' ? task.id : null,
      installation_cost: 0,
      print_cost: type === 'print' ? (task.total_cost || 0) : 0,
      cutout_cost: type === 'cutout' ? (task.total_cost || 0) : 0,
      total_cost: task.total_cost || 0,
      customer_installation_cost: 0,
      company_installation_cost: 0,
      customer_print_cost: type === 'print' ? (task.total_cost || 0) : 0,
      company_print_cost: type === 'print' ? (task.total_cost || 0) : 0,
      customer_cutout_cost: type === 'cutout' ? (task.total_cost || 0) : 0,
      company_cutout_cost: type === 'cutout' ? (task.total_cost || 0) : 0,
      customer_total: task.total_cost || 0,
      company_total: task.total_cost || 0,
      net_profit: 0,
      profit_percentage: 0,
      discount_amount: 0,
      discount_reason: null,
      status: (task.status as any) || 'pending',
      combined_invoice_id: null,
      invoice_generated: false,
      invoice_date: null,
      notes: null,
    } as CompositeTaskWithDetails;
  };

  // طباعة جميع الفواتير المعلقة (واحدة واحدة)
  const handlePrintAllPending = () => {
    const pendingPrint = printTasks.filter(t => t.status !== 'paid');
    const pendingCutout = cutoutTasks.filter(t => t.status !== 'paid');
    if (pendingPrint.length === 0 && pendingCutout.length === 0) {
      toast.info('لا توجد فواتير معلقة للطباعة');
      return;
    }
    const queue = [
      ...pendingPrint.map(t => ({ task: buildMockCompositeTask(t, 'print' as const), type: 'print_vendor' as InvoiceType })),
      ...pendingCutout.map(t => ({ task: buildMockCompositeTask(t, 'cutout' as const), type: 'cutout_vendor' as InvoiceType })),
    ];
    setPendingQueue(queue);
    setPendingQueueIndex(0);
    setUnifiedInvoiceTask(queue[0].task);
    setUnifiedInvoiceType(queue[0].type);
    setUnifiedInvoiceOpen(true);
    toast.info(`${queue.length} فاتورة معلقة - استخدم "التالي" للتنقل`);
  };

  // طباعة كشف كامل لجميع الفواتير في صفحة واحدة - بنفس تصميم الفواتير المعلقة
  const handlePrintFullStatement = async (options: FullStatementOptions) => {
    if (printTasks.length === 0 && cutoutTasks.length === 0) {
      toast.info('لا توجد مهام لهذه المطبعة');
      return;
    }

    toast.info('جاري تجهيز الكشف التفصيلي...');

    // Load shared settings from print_settings (single source of truth)
    let logoPath = '';
    let fontFamily = 'Doran';
    let footerText = 'شكراً لتعاملكم معنا';
    try {
      const { getMergedInvoiceStylesAsync } = await import('@/hooks/useInvoiceSettingsSync');
      const styles = await getMergedInvoiceStylesAsync('composite_task');
      if (styles) {
        logoPath = styles.showLogo !== false ? (styles.logoPath || '') : '';
        fontFamily = styles.fontFamily || 'Doran';
        footerText = styles.footerText || footerText;
      }
    } catch (_) { /* use defaults */ }

    // Load sizes map
    const { data: sizesData } = await supabase.from('sizes').select('name, width, height, sort_order');
    const sizesMap: Record<string, { width: number; height: number; sortOrder: number }> = {};
    (sizesData || []).forEach((s: any) => {
      sizesMap[s.name] = { width: s.width || 0, height: s.height || 0, sortOrder: s.sort_order ?? 999 };
    });

    // Fetch all task IDs and their installation_task_ids
    const printTaskIds = printTasks.map(t => t.id);
    const cutoutTaskIds = cutoutTasks.map(t => t.id);

    // Fetch installation_task_items with full billboard data (like UnifiedTaskInvoice)
    const allInstallTaskIds = new Set<string>();
    printTasks.forEach(t => { if (t.installation_task_id) allInstallTaskIds.add(t.installation_task_id); });
    cutoutTasks.forEach(t => { if (t.installation_task_id) allInstallTaskIds.add(t.installation_task_id); });

    let installItemsMap: Record<string, any[]> = {};
    let installTaskTypeMap: Record<string, string> = {};
    if (allInstallTaskIds.size > 0) {
      const [installItemsRes, installTasksRes] = await Promise.all([
        supabase
          .from('installation_task_items')
          .select('*, billboard:billboards!installation_task_items_billboard_id_fkey(ID, Billboard_Name, Size, Faces_Count, design_face_a, design_face_b, has_cutout, Image_URL, Nearest_Landmark, District, City, billboard_type)')
          .in('task_id', Array.from(allInstallTaskIds)),
        supabase
          .from('installation_tasks')
          .select('id, task_type')
          .in('id', Array.from(allInstallTaskIds)),
      ]);
      (installItemsRes.data || []).forEach((item: any) => {
        if (!installItemsMap[item.task_id]) installItemsMap[item.task_id] = [];
        installItemsMap[item.task_id].push(item);
      });
      (installTasksRes.data || []).forEach((t: any) => {
        installTaskTypeMap[t.id] = t.task_type || 'installation';
      });
    }

    // Fetch design images from print_task_items - keyed by task_id + billboard_id for unique designs per task
    let designImagesMap: Record<string, { face_a?: string; face_b?: string }> = {};
    if (printTaskIds.length > 0) {
      const { data: printItems } = await supabase
        .from('print_task_items')
        .select('task_id, billboard_id, design_face_a, design_face_b')
        .in('task_id', printTaskIds);
      (printItems || []).forEach((item: any) => {
        if (item.billboard_id) {
          // Key by task_id + billboard_id for task-specific designs
          const taskKey = `${item.task_id}__${item.billboard_id}`;
          designImagesMap[taskKey] = { face_a: item.design_face_a, face_b: item.design_face_b };
          // Also store by billboard_id only as fallback
          const bbKey = `__${item.billboard_id}`;
          if (!designImagesMap[bbKey]) {
            designImagesMap[bbKey] = { face_a: item.design_face_a, face_b: item.design_face_b };
          }
        }
      });
    }

    // Fetch print_task_items and cutout_task_items for cost data
    let printItemsMap: Record<string, any[]> = {};
    let cutoutItemsMap: Record<string, any[]> = {};

    if (printTaskIds.length > 0) {
      const { data: items } = await supabase
        .from('print_task_items')
        .select('*, billboard:billboards!print_task_items_billboard_id_fkey(Billboard_Name, Size, Faces_Count, Image_URL)')
        .in('task_id', printTaskIds);
      (items || []).forEach((item: any) => {
        if (!printItemsMap[item.task_id]) printItemsMap[item.task_id] = [];
        printItemsMap[item.task_id].push(item);
      });
    }

    if (cutoutTaskIds.length > 0) {
      const { data: items } = await supabase
        .from('cutout_task_items')
        .select('*, billboard:billboards!cutout_task_items_billboard_id_fkey(Billboard_Name, Size, Faces_Count, Image_URL)')
        .in('task_id', cutoutTaskIds);
      (items || []).forEach((item: any) => {
        if (!cutoutItemsMap[item.task_id]) cutoutItemsMap[item.task_id] = [];
        cutoutItemsMap[item.task_id].push(item);
      });
    }

    // Fetch contract info
    const allContractIdsSet = new Set<number>();
    printTasks.forEach(t => t.contract_id && allContractIdsSet.add(t.contract_id));
    cutoutTasks.forEach(t => t.contract_id && allContractIdsSet.add(t.contract_id));
    const contractIdsList = Array.from(allContractIdsSet);

    let contractInfoMap: Record<number, { customerName: string; adType: string; renewalStatus: string }> = {};
    if (contractIdsList.length > 0) {
      const { data: contracts } = await supabase
        .from('Contract')
        .select('"Contract_Number", "Customer Name", "Ad Type", "Renewal Status"')
        .in('Contract_Number', contractIdsList);
      (contracts || []).forEach((c: any) => {
        contractInfoMap[c.Contract_Number] = {
          customerName: c['Customer Name'] || '',
          adType: c['Ad Type'] || '',
          renewalStatus: c['Renewal Status'] || '',
        };
      });
    }

    const totalPrint = printTasks.reduce((s, t) => s + (t.total_cost || 0), 0);
    const totalCutout = cutoutTasks.reduce((s, t) => s + (t.total_cost || 0), 0);
    const totalAll = totalPrint + totalCutout;
    const balance = selectedPrinter?.final_balance || 0;

    // Group tasks by contract + installation_task_id to separate different tasks for same contract
    interface TaskGroup {
      contractId: number;
      installTaskId: string | null;
      printTasks: PrintTask[];
      cutoutTasks: CutoutTask[];
    }
    const tasksByGroupKey: Record<string, TaskGroup> = {};
    const makeGroupKey = (contractId: number, installTaskId: string | null) => `${contractId}__${installTaskId || 'none'}`;
    
    printTasks.forEach(t => {
      const key = makeGroupKey(t.contract_id || 0, t.installation_task_id);
      if (!tasksByGroupKey[key]) tasksByGroupKey[key] = { contractId: t.contract_id || 0, installTaskId: t.installation_task_id, printTasks: [], cutoutTasks: [] };
      tasksByGroupKey[key].printTasks.push(t);
    });
    cutoutTasks.forEach(t => {
      const key = makeGroupKey(t.contract_id || 0, t.installation_task_id);
      if (!tasksByGroupKey[key]) tasksByGroupKey[key] = { contractId: t.contract_id || 0, installTaskId: t.installation_task_id, printTasks: [], cutoutTasks: [] };
      tasksByGroupKey[key].cutoutTasks.push(t);
    });

    // Sort groups: newest first (by first task created_at)
    const sortedGroupKeys = Object.keys(tasksByGroupKey).sort((a, b) => {
      const ga = tasksByGroupKey[a];
      const gb = tasksByGroupKey[b];
      const dateA = ga.printTasks[0]?.created_at || ga.cutoutTasks[0]?.created_at || '';
      const dateB = gb.printTasks[0]?.created_at || gb.cutoutTasks[0]?.created_at || '';
      return dateB.localeCompare(dateA);
    });

    // Helper: get size dimensions
    const getSizeDimensions = (sizeName: string) => {
      let info = sizesMap[sizeName];
      if (info) return info;
      const match = sizeName?.match(/(\d+(?:\.\d+)?)[x×](\d+(?:\.\d+)?)/i);
      if (match) return { width: parseFloat(match[1]), height: parseFloat(match[2]), sortOrder: 999 };
      return { width: 0, height: 0, sortOrder: 999 };
    };

    // Build detailed sections per group (contract + installation task)
    const contractSections = sortedGroupKeys.map((groupKey, cIdx) => {
      const group = tasksByGroupKey[groupKey];
      const contractId = group.contractId;
      const info = contractInfoMap[contractId] || { customerName: '', adType: '', renewalStatus: '' };
      const contractPrintTotal = group.printTasks.reduce((s, t) => s + (t.total_cost || 0), 0);
      const contractCutoutTotal = group.cutoutTasks.reduce((s, t) => s + (t.total_cost || 0), 0);
      const contractTotal = contractPrintTotal + contractCutoutTotal;

      // Contract has print and/or cutout tasks

      // Build invoice-style items from installation_task_items
      interface StatementItem {
        billboardImage: string;
        billboardName: string;
        billboardId: number;
        groupKey: string; // unique key for rowspan grouping (billboardId + taskId)
        sizeName: string;
        face: 'a' | 'b';
        designImage: string;
        area: number;
        pricePerMeter: number;
        printCost: number;
        cutoutCost: number;
        totalCost: number;
        facesCount: number;
        billboardType: string;
        status: string;
      }

      const items: StatementItem[] = [];

      // Use the group's installation_task_id directly
      const installItems: any[] = group.installTaskId ? (installItemsMap[group.installTaskId] || []) : [];
      
      // Determine task type from installation_tasks.task_type
      const installTaskType = group.installTaskId ? (installTaskTypeMap[group.installTaskId] || '') : '';
      const isRenewal = installTaskType === 'reinstallation' || (!installItems.length && (info.renewalStatus === 'renewed' || info.renewalStatus === 'إعادة تركيب'));
      const contractTypeLabel = isRenewal ? 'إعادة تركيب' : 'تركيب جديد';

      if (installItems.length > 0) {
        // Get actual price_per_meter from the group's print task
        const groupPrintTask = group.printTasks[0];
        const actualPricePerMeter = groupPrintTask?.price_per_meter || 13;

        // Get the print task IDs for this group to find task-specific designs
        const groupPrintTaskIds = group.printTasks.map(t => t.id);

        // Get cutout billboard IDs
        const cutoutBillboardIds = new Set<number>();
        group.cutoutTasks.forEach(ct => {
          (cutoutItemsMap[ct.id] || []).forEach((ci: any) => {
            if (ci?.billboard_id) cutoutBillboardIds.add(Number(ci.billboard_id));
          });
        });
        if (cutoutBillboardIds.size === 0) {
          installItems.forEach((item: any) => {
            if (item.billboard?.has_cutout) cutoutBillboardIds.add(Number(item.billboard?.ID || item.billboard_id));
          });
        }
        const cutoutCostPerBillboard = cutoutBillboardIds.size > 0 ? contractCutoutTotal / cutoutBillboardIds.size : 0;

        // Determine overall task status
        const allTasks = [...group.printTasks, ...group.cutoutTasks];
        const taskStatus = allTasks.every(t => t.status === 'paid') ? 'مدفوع' 
          : allTasks.every(t => t.status === 'completed' || t.status === 'paid') ? 'مكتمل' : 'معلق';

        installItems.forEach((item: any, itemIdx: number) => {
          const billboardId = item.billboard?.ID || item.billboard_id;
          const taskId = item.task_id || '';
          const gKey = `${billboardId}-${taskId}-${itemIdx}`;
          const billboardSize = item.billboard?.Size || '';
          const dims = getSizeDimensions(billboardSize);

          // Look up designs: first try task-specific, then fallback to billboard-only
          let designs: { face_a?: string; face_b?: string } = {};
          for (const ptId of groupPrintTaskIds) {
            const taskDesign = designImagesMap[`${ptId}__${billboardId}`];
            if (taskDesign) { designs = taskDesign; break; }
          }
          if (!designs.face_a && !designs.face_b) {
            designs = designImagesMap[`__${billboardId}`] || {};
          }

          const faceAImage = item.design_face_a || designs.face_a || item.billboard?.design_face_a || '';
          // Use faces_to_install from installation task item - this is the actual number chosen during task creation
          const actualFacesCount = item.faces_to_install ?? item.billboard?.Faces_Count ?? 1;
          const hasBackFace = actualFacesCount >= 2;
          const faceBImageRaw = item.design_face_b || designs.face_b || item.billboard?.design_face_b || '';
          const faceBImage = hasBackFace ? faceBImageRaw : '';
          const areaPerFace = dims.width * dims.height;
          const hasCutoutFlag = cutoutBillboardIds.has(Number(billboardId)) || item.billboard?.has_cutout;
          const facesCountForBillboard = hasBackFace ? 2 : 1;
          const printCostPerFace = areaPerFace * actualPricePerMeter;
          const cutoutCostPerFace = hasCutoutFlag ? (cutoutCostPerBillboard / facesCountForBillboard) : 0;
          const displaySizeName = hasCutoutFlag ? `${billboardSize} (مجسم)` : billboardSize;

          // Front face
          items.push({
            billboardImage: item.billboard?.Image_URL || '',
            billboardName: item.billboard?.Billboard_Name || `لوحة #${billboardId}`,
            billboardId,
            groupKey: gKey,
            sizeName: displaySizeName,
            face: 'a',
            designImage: faceAImage,
            area: areaPerFace,
            pricePerMeter: actualPricePerMeter,
            printCost: printCostPerFace,
            cutoutCost: cutoutCostPerFace,
            totalCost: printCostPerFace + cutoutCostPerFace,
            facesCount: actualFacesCount,
            billboardType: item.billboard?.billboard_type || '',
            status: taskStatus,
          });

          // Back face - only if faces_to_install >= 2
          if (hasBackFace) {
            items.push({
              billboardImage: item.billboard?.Image_URL || '',
              billboardName: item.billboard?.Billboard_Name || `لوحة #${billboardId}`,
              billboardId,
              groupKey: gKey,
              sizeName: displaySizeName,
              face: 'b',
              designImage: faceBImage,
              area: areaPerFace,
              pricePerMeter: actualPricePerMeter,
              printCost: printCostPerFace,
              cutoutCost: cutoutCostPerFace,
              totalCost: printCostPerFace + cutoutCostPerFace,
              facesCount: actualFacesCount,
              billboardType: item.billboard?.billboard_type || '',
              status: taskStatus,
            });
          }
        });
      } else {
        // Fallback: from print_task_items / cutout_task_items (e.g. renewal/re-installation contracts)
        const fallbackPricePerMeter = 13;

        let fallbackIdx = 0;
        group.printTasks.forEach(task => {
          const pItems = printItemsMap[task.id] || [];
          const taskPricePerMeter = task.price_per_meter || fallbackPricePerMeter;
          if (pItems.length === 0) {
            items.push({
              billboardImage: '', billboardName: '—', billboardId: 0,
              groupKey: `fb-p-${task.id}-${fallbackIdx++}`,
              sizeName: '—', face: 'a', designImage: '',
              area: task.total_area || 0, pricePerMeter: taskPricePerMeter, printCost: task.total_cost || 0, cutoutCost: 0,
              totalCost: task.total_cost || 0, facesCount: 1, billboardType: '',
              status: task.status === 'completed' ? 'مكتمل' : task.status === 'paid' ? 'مدفوع' : 'معلق',
            });
          } else {
            pItems.forEach((pi: any) => {
              const dims = getSizeDimensions(pi.billboard?.Size || '');
              const itemArea = pi.area || (dims.width * dims.height) || 0;
              const itemPricePerMeter = taskPricePerMeter;
              const faceLabel: 'a' | 'b' = (pi.description || '').includes('خلفي') ? 'b' : 'a';
              items.push({
                billboardImage: pi.billboard?.Image_URL || '',
                billboardName: pi.billboard?.Billboard_Name || '—',
                billboardId: pi.billboard_id || 0,
                groupKey: `fb-p-${task.id}-${fallbackIdx++}`,
                sizeName: pi.billboard?.Size || '—',
                face: faceLabel, designImage: pi.design_face_a || pi.design_face_b || '',
                area: itemArea,
                pricePerMeter: itemPricePerMeter,
                printCost: pi.total_cost || 0, cutoutCost: 0,
                totalCost: pi.total_cost || 0,
                facesCount: pi.billboard?.Faces_Count || 1,
                billboardType: '',
                status: task.status === 'completed' ? 'مكتمل' : task.status === 'paid' ? 'مدفوع' : 'معلق',
              });
            });
          }
        });
        group.cutoutTasks.forEach(task => {
          const cItems = cutoutItemsMap[task.id] || [];
          if (cItems.length === 0) {
            items.push({
              billboardImage: '', billboardName: '—', billboardId: 0,
              groupKey: `fb-c-${task.id}-${fallbackIdx++}`,
              sizeName: '—', face: 'a', designImage: '',
              area: 0, pricePerMeter: 0, printCost: 0, cutoutCost: task.total_cost || 0,
              totalCost: task.total_cost || 0, facesCount: 1, billboardType: '',
              status: task.status === 'completed' ? 'مكتمل' : task.status === 'paid' ? 'مدفوع' : 'معلق',
            });
          } else {
            cItems.forEach((ci: any) => {
              items.push({
                billboardImage: ci.billboard?.Image_URL || '',
                billboardName: ci.billboard?.Billboard_Name || '—',
                billboardId: ci.billboard_id || 0,
                groupKey: `fb-c-${task.id}-${fallbackIdx++}`,
                sizeName: ci.billboard?.Size || '—',
                face: 'a', designImage: '',
                area: 0, pricePerMeter: 0, printCost: 0, cutoutCost: ci.total_cost || 0,
                totalCost: ci.total_cost || 0, facesCount: 1, billboardType: '',
                status: task.status === 'completed' ? 'مكتمل' : task.status === 'paid' ? 'مدفوع' : 'معلق',
              });
            });
          }
        });
      }

      // Helper: is first in group (using groupKey instead of billboardId)
      const isFirstInGroup = (item: StatementItem, idx: number): boolean => {
        for (let i = 0; i < idx; i++) {
          if (items[i].groupKey === item.groupKey) return false;
        }
        return true;
      };
      const getFaceCount = (groupKey: string): number => {
        return items.filter(i => i.groupKey === groupKey).length;
      };

      // Build table rows HTML (matching invoice table exactly)
      let billboardCounter = 0;
      const seenGroups = new Set<string>();

      const tableRowsHtml = items.map((item, idx) => {
        const isFirst = isFirstInGroup(item, idx);
        const faceCount = getFaceCount(item.groupKey);

        if (!seenGroups.has(item.groupKey)) {
          billboardCounter++;
          seenGroups.add(item.groupKey);
        }

        return `
          <tr style="background-color:${idx % 2 === 0 ? '#f5f5f5' : '#ffffff'};">
            ${isFirst ? `<td rowspan="${faceCount}" style="padding:6px 4px;border:1px solid #ccc;text-align:center;vertical-align:middle;">${billboardCounter}</td>` : ''}
            ${isFirst ? `
              <td rowspan="${faceCount}" style="padding:4px;border:1px solid #ccc;text-align:center;vertical-align:middle;">
                ${item.billboardImage ? `<img src="${item.billboardImage}" alt="صورة اللوحة" style="width:100%;max-height:${faceCount > 1 ? '90px' : '60px'};object-fit:contain;border-radius:4px;" onerror="this.style.display='none'" />` : '<span style="color:#999;font-size:8px;">—</span>'}
              </td>
            ` : ''}
            ${isFirst ? `
              <td rowspan="${faceCount}" style="padding:6px 4px;border:1px solid #ccc;text-align:center;font-weight:bold;font-size:9px;vertical-align:middle;">
                ${item.billboardName || '—'}
              </td>
            ` : ''}
            ${isFirst ? `
              <td rowspan="${faceCount}" style="padding:6px 4px;border:1px solid #ccc;text-align:center;vertical-align:middle;">
                <div style="font-weight:bold;font-size:9px;">${item.sizeName || '—'}</div>
                ${item.billboardType ? `<div style="font-size:8px;color:#555;margin-top:2px;"><span style="background:${item.billboardType === 'تيبول' ? '#fff8e1' : '#f3e5f5'};padding:1px 4px;border-radius:3px;color:${item.billboardType === 'تيبول' ? '#f57c00' : '#7b1fa2'};">${item.billboardType}</span></div>` : ''}
                <div style="font-size:8px;color:#666;margin-top:2px;">
                  <span style="background:#e3f2fd;padding:1px 4px;border-radius:3px;color:#1565c0;font-weight:bold;">${faceCount === 1 ? 'وجه واحد' : faceCount === 2 ? 'وجهين' : faceCount + ' أوجه'}</span>
                </div>
              </td>
            ` : ''}
            <td style="padding:6px 4px;border:1px solid #ccc;text-align:center;font-size:8px;">
              ${item.face === 'a' ? '<span style="background:#e8f5e9;padding:2px 6px;border-radius:3px;color:#2e7d32;">أمامي</span>' : '<span style="background:#fff3e0;padding:2px 6px;border-radius:3px;color:#ef6c00;">خلفي</span>'}
            </td>
            <td style="padding:2px;border:1px solid #ccc;text-align:center;">
              ${item.designImage ? `<img src="${item.designImage}" alt="تصميم" style="width:100%;height:45px;object-fit:contain;" onerror="this.style.display='none'" />` : '<span style="color:#999;font-size:8px;">—</span>'}
            </td>
            <td style="padding:6px 4px;border:1px solid #ccc;text-align:center;font-family:Manrope;font-size:9px;">
              ${item.area > 0 ? item.area.toFixed(2) + ' م²' : '—'}
            </td>
            ${options.showCost ? `<td style="padding:6px 4px;border:1px solid #ccc;text-align:center;font-family:Manrope;font-size:9px;color:#1565c0;font-weight:bold;">
              ${item.pricePerMeter > 0 ? item.pricePerMeter.toFixed(2) : '—'}
            </td>
            <td style="padding:6px 4px;border:1px solid #ccc;text-align:center;font-family:Manrope;font-weight:bold;font-size:9px;background-color:#e5e5e5;">
              ${item.totalCost > 0 ? item.totalCost.toFixed(0) + ' د.ل' : '—'}
            </td>` : ''}
            <td style="padding:6px 4px;border:1px solid #ccc;text-align:center;font-size:9px;">
              <span style="background:${item.status === 'مكتمل' ? '#dcfce7' : item.status === 'مدفوع' ? '#d1fae5' : '#fef3c7'};color:${item.status === 'مكتمل' ? '#166534' : item.status === 'مدفوع' ? '#065f46' : '#92400e'};padding:2px 8px;border-radius:4px;">
                ${item.status}
              </span>
            </td>
          </tr>
        `;
      }).join('');

      return `
        <!-- فاصل بين العقود -->
        ${cIdx > 0 ? '<div style="margin:20px 0;border-top:3px dashed #ccc;"></div>' : ''}
        
        <!-- عنوان العقد -->
        <div style="background:linear-gradient(135deg, #f5f5f5, #ffffff);padding:12px 16px;margin-bottom:12px;border-radius:8px;border-right:5px solid ${isRenewal ? '#f59e0b' : '#1a1a1a'};display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:16px;font-weight:bold;color:#1a1a1a;">
              عقد #${contractId}
              <span style="font-size:11px;margin-right:8px;padding:2px 8px;border-radius:4px;background:${isRenewal ? '#fef3c7' : '#dcfce7'};color:${isRenewal ? '#92400e' : '#166534'};">${contractTypeLabel}</span>
            </div>
            <div style="font-size:12px;color:#666;margin-top:2px;">
              ${info.customerName ? `<span style="margin-left:12px;">العميل: <strong>${info.customerName}</strong></span>` : ''}
              ${info.adType ? `<span>نوع الإعلان: <strong>${info.adType}</strong></span>` : ''}
            </div>
          </div>
          ${options.showCost ? `<div style="text-align:center;">
            <div style="font-size:18px;font-weight:bold;color:#D4AF37;font-family:Manrope;">${contractTotal.toLocaleString()}</div>
            <div style="font-size:10px;color:#666;">د.ل</div>
          </div>` : ''}
        </div>

        ${options.detailed ? `
        <!-- جدول تفصيلي للعقد - بنفس تصميم الفواتير -->
        <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:16px;">
          <thead>
            <tr style="background-color:#1a1a1a;">
              <th style="padding:8px 4px;color:#fff;border:1px solid #333;text-align:center;width:4%;">#</th>
              <th style="padding:8px 4px;color:#fff;border:1px solid #333;text-align:center;width:10%;">صورة اللوحة</th>
              <th style="padding:8px 4px;color:#fff;border:1px solid #333;text-align:center;">اللوحة</th>
              <th style="padding:8px 4px;color:#fff;border:1px solid #333;text-align:center;">المقاس</th>
              <th style="padding:8px 4px;color:#fff;border:1px solid #333;text-align:center;">الوجه</th>
              <th style="padding:8px 4px;color:#fff;border:1px solid #333;text-align:center;width:12%;">التصميم</th>
              <th style="padding:8px 4px;color:#fff;border:1px solid #333;text-align:center;">المساحة</th>
              ${options.showCost ? `<th style="padding:8px 4px;color:#fff;border:1px solid #333;text-align:center;">سعر المتر</th>
              <th style="padding:8px 4px;color:#fff;border:1px solid #333;text-align:center;background-color:#1a1a1a;">الإجمالي</th>` : ''}
              <th style="padding:8px 4px;color:#fff;border:1px solid #333;text-align:center;">الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
          <tfoot>
            ${options.showCost ? `<tr style="background-color:#1a1a1a;font-weight:bold;">
              <td colspan="8" style="padding:10px 6px;border:1px solid #333;text-align:center;color:#fff;font-size:11px;">إجمالي العقد #${contractId}</td>
              <td style="padding:10px 6px;border:1px solid #333;text-align:center;font-family:Manrope;font-weight:bold;color:#fff;background-color:#000;font-size:11px;">${contractTotal.toLocaleString()} د.ل</td>
              <td style="border:1px solid #333;background-color:#1a1a1a;"></td>
            </tr>` : ''}
          </tfoot>
        </table>
        ` : `
        <div style="font-size:12px;color:#666;margin-bottom:12px;padding:8px;background:#f9f9f9;border-radius:6px;">
          عدد اللوحات: <strong>${items.length}</strong>
          ${options.showCost ? ` · الإجمالي: <strong style="font-family:Manrope;">${contractTotal.toLocaleString()} د.ل</strong>` : ''}
        </div>
        `}
      `;
    }).join('');

    // Payment rows
    const paymentRows = payments.map((p, i) => `
      <tr style="background-color: ${i % 2 === 0 ? '#f5f5f5' : '#ffffff'};">
        <td style="padding:6px 4px;border:1px solid #ccc;text-align:center;font-size:10px;">${i + 1}</td>
        <td style="padding:6px 4px;border:1px solid #ccc;text-align:center;font-size:10px;">${new Date(p.payment_date).toLocaleDateString('ar-LY')}</td>
        <td style="padding:6px 4px;border:1px solid #ccc;text-align:center;font-family:Manrope;font-weight:bold;color:#059669;font-size:10px;">${p.amount.toLocaleString()} د.ل</td>
        <td style="padding:6px 4px;border:1px solid #ccc;text-align:center;font-size:10px;">${p.payment_method}</td>
        <td style="padding:6px 4px;border:1px solid #ccc;text-align:center;font-size:10px;">${p.reference || '—'}</td>
        <td style="padding:6px 4px;border:1px solid #ccc;text-align:center;font-size:10px;">${p.notes || '—'}</td>
      </tr>
    `).join('');

    const today = new Date();
    const dateStr = today.toLocaleDateString('ar-LY', { year: 'numeric', month: 'long', day: 'numeric' });

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>كشف حساب - ${selectedPrinter?.printer_name}</title>
        <style>
          @font-face { font-family: 'Doran'; src: url('/Doran-Regular.otf') format('opentype'); font-weight: 400; }
          @font-face { font-family: 'Doran'; src: url('/Doran-Bold.otf') format('opentype'); font-weight: 700; }
          @font-face { font-family: 'Manrope'; src: url('/Manrope-Regular.otf') format('opentype'); font-weight: 400; }
          @font-face { font-family: 'Manrope'; src: url('/Manrope-Bold.otf') format('opentype'); font-weight: 700; }
          * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html, body { font-family: '${fontFamily}', 'Noto Sans Arabic', Arial, sans-serif; direction: rtl; background: #fff; }
          .print-container { width: 210mm; min-height: 297mm; padding: 15mm; background: #fff; margin: 0 auto; }
          @media print {
            @page { size: A4; margin: 15mm; }
            .print-container { width: 100%; min-height: auto; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="print-container">
          <!-- Header -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:15px;border-bottom:3px solid #1a1a1a;">
            <div style="flex:1;">
              <h1 style="font-size:32px;font-weight:bold;color:#1a1a1a;margin-bottom:8px;">كشف حساب تفصيلي</h1>
              <div style="font-size:12px;color:#666;line-height:1.8;">
                <div>التاريخ: ${dateStr}</div>
                <div>عدد المجموعات: ${sortedGroupKeys.length} · عدد المهام: ${printTasks.length + cutoutTasks.length}</div>
              </div>
            </div>
            ${logoPath ? `<img src="${logoPath}" alt="Logo" style="height:100px;object-fit:contain;" onerror="this.style.display='none'" />` : ''}
          </div>

          <!-- Recipient Info -->
          <div style="background:linear-gradient(135deg, #f5f5f5, #ffffff);padding:20px;margin-bottom:24px;border-radius:12px;border-right:5px solid #1a1a1a;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-size:14px;color:#666;margin-bottom:4px;">المطبعة</div>
                <div style="font-size:28px;font-weight:bold;color:#1a1a1a;">${selectedPrinter?.printer_name || ''}</div>
              </div>
              <div style="display:flex;gap:24px;">
                <div style="text-align:center;">
                  <div style="font-size:24px;font-weight:bold;color:#D4AF37;font-family:Manrope;">${sortedGroupKeys.length}</div>
                  <div style="font-size:12px;color:#666;">مجموعة</div>
                </div>
                <div style="text-align:center;">
                  <div style="font-size:24px;font-weight:bold;color:#D4AF37;font-family:Manrope;">${printTasks.length + cutoutTasks.length}</div>
                  <div style="font-size:12px;color:#666;">مهمة</div>
                </div>
                <div style="text-align:center;">
                  <div style="font-size:24px;font-weight:bold;color:#D4AF37;font-family:Manrope;">${payments.length}</div>
                  <div style="font-size:12px;color:#666;">دفعة</div>
                </div>
              </div>
            </div>
          </div>

          ${options.showCost ? `
          <!-- ملخص مالي -->
          <div style="background:#f8f9fa;padding:12px 16px;margin-bottom:20px;border-radius:8px;border:1px solid #e9ecef;">
            <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
              <span style="font-size:12px;font-weight:bold;color:#495057;">ملخص:</span>
              <span style="background:#fff;padding:4px 8px;border-radius:6px;font-size:11px;color:#333;border:1px solid #dee2e6;">
                إجمالي الطباعة: <strong style="font-family:Manrope;">${totalPrint.toLocaleString()}</strong> د.ل
              </span>
              ${totalCutout > 0 ? `<span style="background:#fff;padding:4px 8px;border-radius:6px;font-size:11px;color:#333;border:1px solid #dee2e6;">
                إجمالي القص: <strong style="font-family:Manrope;">${totalCutout.toLocaleString()}</strong> د.ل
              </span>` : ''}
              <span style="background:#fff;padding:4px 8px;border-radius:6px;font-size:11px;color:#333;border:1px solid #dee2e6;">
                المدفوع: <strong style="font-family:Manrope;color:#059669;">${totalPayments.toLocaleString()}</strong> د.ل
              </span>
              <span style="background:${balance > 0 ? '#fef2f2' : '#f0fdf4'};padding:4px 8px;border-radius:6px;font-size:11px;color:${balance > 0 ? '#dc2626' : '#059669'};border:1px solid ${balance > 0 ? '#fecaca' : '#bbf7d0'};font-weight:bold;">
                الرصيد: <strong style="font-family:Manrope;">${Math.abs(balance).toLocaleString()}</strong> د.ل ${balance > 0 ? '(علينا)' : balance < 0 ? '(لصالحنا)' : ''}
              </span>
            </div>
          </div>
          ` : ''}

          <!-- تفاصيل العقود -->
          ${contractSections}

          ${options.showCost ? `
          <!-- الإجمالي الكلي -->
          <div style="margin-top:8px;margin-bottom:24px;">
            <table style="width:100%;border-collapse:collapse;font-size:10px;">
              <tfoot>
                <tr style="background-color:#1a1a1a;font-weight:bold;">
                  <td colspan="7" style="padding:12px 6px;border:1px solid #333;text-align:center;color:#fff;font-size:13px;">الإجمالي الكلي لجميع العقود</td>
                  <td style="padding:12px 6px;border:1px solid #333;text-align:center;font-family:Manrope;font-weight:bold;color:#fff;background-color:#000;font-size:13px;">${totalAll.toLocaleString()} د.ل</td>
                  <td style="border:1px solid #333;background-color:#1a1a1a;"></td>
                </tr>
              </tfoot>
            </table>
          </div>
          ` : ''}

          ${options.showCost && payments.length > 0 ? `
            <!-- جدول المدفوعات -->
            <div style="font-size:14px;font-weight:bold;color:#1a1a1a;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #1a1a1a;">سجل المدفوعات (${payments.length})</div>
            <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:24px;">
              <thead>
                <tr style="background-color:#1a1a1a;">
                  <th style="padding:8px 4px;color:#fff;border:1px solid #333;text-align:center;width:4%;">#</th>
                  <th style="padding:8px 4px;color:#fff;border:1px solid #333;text-align:center;">التاريخ</th>
                  <th style="padding:8px 4px;color:#fff;border:1px solid #333;text-align:center;">المبلغ</th>
                  <th style="padding:8px 4px;color:#fff;border:1px solid #333;text-align:center;">طريقة الدفع</th>
                  <th style="padding:8px 4px;color:#fff;border:1px solid #333;text-align:center;">المرجع</th>
                  <th style="padding:8px 4px;color:#fff;border:1px solid #333;text-align:center;">ملاحظات</th>
                </tr>
              </thead>
              <tbody>${paymentRows}</tbody>
              <tfoot>
                <tr style="background-color:#1a1a1a;font-weight:bold;">
                  <td colspan="2" style="padding:10px 6px;border:1px solid #333;text-align:center;color:#fff;font-size:11px;">المجموع</td>
                  <td style="padding:10px 6px;border:1px solid #333;text-align:center;font-family:Manrope;font-weight:bold;color:#fff;background-color:#000;font-size:11px;">${totalPayments.toLocaleString()} د.ل</td>
                  <td colspan="3" style="border:1px solid #333;background-color:#1a1a1a;"></td>
                </tr>
              </tfoot>
            </table>
          ` : ''}

          ${options.showCost ? `
          <!-- Total Section -->
          <div style="background:linear-gradient(135deg, #1a1a1a, #000);padding:20px;text-align:center;border-radius:8px;">
            <div style="font-size:14px;color:#fff;opacity:0.9;margin-bottom:6px;">الرصيد المستحق</div>
            <div style="font-size:28px;font-weight:bold;color:${balance > 0 ? '#ef4444' : '#4ade80'};font-family:Manrope;">
              ${Math.abs(balance).toLocaleString()}
              <span style="font-size:16px;margin-right:8px;">دينار ليبي</span>
            </div>
            ${balance > 0 ? '<div style="font-size:12px;color:#fca5a5;margin-top:4px;">مستحق للمطبعة</div>' : balance < 0 ? '<div style="font-size:12px;color:#86efac;margin-top:4px;">لصالح الشركة</div>' : '<div style="font-size:12px;color:#86efac;margin-top:4px;">الحساب مسوّى</div>'}
          </div>
          ` : ''}

          ${options.showStampSignature ? `
          <!-- Signature Section -->
          <div style="margin-top:40px;padding-top:20px;border-top:2px dashed #ccc;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
              <div style="flex:1;text-align:center;padding-left:20px;">
                <div style="font-size:14px;font-weight:bold;color:#333;margin-bottom:60px;">الختم</div>
                <div style="border-top:2px solid #333;width:120px;margin:0 auto;"></div>
              </div>
              <div style="flex:1;text-align:center;padding-right:20px;">
                <div style="font-size:14px;font-weight:bold;color:#333;margin-bottom:60px;">التوقيع</div>
                <div style="border-top:2px solid #333;width:120px;margin:0 auto;"></div>
              </div>
            </div>
          </div>
          ` : ''}

          <!-- Footer -->
          <div style="margin-top:30px;padding-top:15px;border-top:1px solid #D4AF37;text-align:center;font-size:10px;color:#666;">
            ${footerText}
          </div>
        </div>
      </body>
      </html>
    `;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => { w.focus(); w.print(); }, 800);
    }
  };

  const handleNextPendingInvoice = () => {
    const nextIndex = pendingQueueIndex + 1;
    if (nextIndex < pendingQueue.length) {
      setPendingQueueIndex(nextIndex);
      setUnifiedInvoiceTask(pendingQueue[nextIndex].task);
      setUnifiedInvoiceType(pendingQueue[nextIndex].type);
    } else {
      toast.success('تم عرض جميع الفواتير المعلقة');
      setPendingQueue([]);
      setPendingQueueIndex(0);
      setUnifiedInvoiceOpen(false);
    }
  };

  const handleCloseUnifiedInvoice = (open: boolean) => {
    if (!open && pendingQueue.length > 0) {
      setPendingQueue([]);
      setPendingQueueIndex(0);
    }
    setUnifiedInvoiceOpen(open);
  };

  const handlePrintCutoutTask = (task: CutoutTask) => {
    setUnifiedInvoiceTask(buildMockCompositeTask(task, 'cutout'));
    setUnifiedInvoiceType('cutout_vendor');
    setUnifiedInvoiceOpen(true);
  };

  const handlePrintPrintTask = (task: PrintTask) => {
    setUnifiedInvoiceTask(buildMockCompositeTask(task, 'print'));
    setUnifiedInvoiceType('print_vendor');
    setUnifiedInvoiceOpen(true);
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذه الدفعة؟', variant: 'destructive', confirmText: 'حذف' })) return;
    const { error } = await supabase.from('printer_payments').delete().eq('id', paymentId);
    if (error) {
      toast.error('فشل حذف الدفعة');
    } else {
      toast.success('تم حذف الدفعة');
      refetchPayments();
      queryClient.invalidateQueries({ queryKey: ['printer-accounts'] });
    }
  };

  const handlePaymentAdded = () => {
    refetchPayments();
    queryClient.invalidateQueries({ queryKey: ['printer-accounts'] });
  };

  const handleUpdatePricePerMeter = async (taskId: string, newPrice: number) => {
    if (isNaN(newPrice) || newPrice <= 0) {
      toast.error('أدخل سعر صحيح');
      return;
    }
    const task = printTasks.find(t => t.id === taskId);
    if (!task) return;
    const newTotalCost = Math.round(newPrice * (task.total_area || 0) * 100) / 100;
    
    // 1. Update print_tasks
    const { error } = await supabase
      .from('print_tasks')
      .update({ price_per_meter: newPrice, total_cost: newTotalCost, updated_at: new Date().toISOString() })
      .eq('id', taskId);
    
    if (error) {
      toast.error('فشل تحديث سعر المتر');
      return;
    }

    // 2. Update linked composite_tasks (company_print_cost & company_total)
    const { data: linkedTasks } = await supabase
      .from('composite_tasks')
      .select('id, company_installation_cost, company_cutout_cost')
      .eq('print_task_id', taskId);
    
    if (linkedTasks && linkedTasks.length > 0) {
      for (const ct of linkedTasks) {
        const newCompanyTotal = (ct.company_installation_cost || 0) + newTotalCost + (ct.company_cutout_cost || 0);
        await supabase
          .from('composite_tasks')
          .update({ 
            company_print_cost: newTotalCost, 
            company_total: newCompanyTotal,
            updated_at: new Date().toISOString() 
          })
          .eq('id', ct.id);
      }
    }

    toast.success(`تم تحديث سعر المتر إلى ${newPrice} د.ل - التكلفة الجديدة: ${newTotalCost.toLocaleString()} د.ل`);
    setEditingPriceTaskId(null);
    queryClient.invalidateQueries({ queryKey: ['printer-print-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['printer-accounts'] });
    queryClient.invalidateQueries({ queryKey: ['composite-tasks'] });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs"><CheckCircle className="h-3 w-3 mr-1" />مكتمل</Badge>;
      case 'pending':
        return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 text-xs"><Clock className="h-3 w-3 mr-1" />معلق</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs">قيد التنفيذ</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">{status}</Badge>;
    }
  };

  const getMethodBadge = (method: string) => {
    const styles: Record<string, string> = {
      'نقدي': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'تحويل بنكي': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'شيك': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    };
    return <Badge className={`text-xs ${styles[method] || ''}`}>{method}</Badge>;
  };

  const totalPayments = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <>
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">حسابات المطابع</h1>
          <p className="text-muted-foreground">إدارة ومتابعة حسابات شركات الطباعة والقص</p>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-blue-500/20">
                <Printer className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">عدد المطابع</p>
                <p className="text-2xl font-bold">{overallStats.totalPrinters}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200 dark:border-purple-800">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-purple-500/20">
                <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المهام</p>
                <p className="text-2xl font-bold">{overallStats.totalTasks}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-200 dark:border-red-800">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-red-500/20">
                <TrendingUp className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">مستحقات علينا</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {overallStats.totalOwed.toLocaleString()} <span className="text-sm">د.ل</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200 dark:border-green-800">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-green-500/20">
                <TrendingDown className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">مدفوع للمطابع</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {overallStats.totalOwing.toLocaleString()} <span className="text-sm">د.ل</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث عن مطبعة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>
      </Card>

      {/* Printer Summary Cards */}
      {!selectedPrinterId && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <Card className="col-span-full p-8 text-center text-muted-foreground">جاري التحميل...</Card>
          ) : filteredAccounts.length === 0 ? (
            <Card className="col-span-full p-8 text-center text-muted-foreground">لا توجد مطابع</Card>
          ) : (
            filteredAccounts.map((account) => (
              <Card
                key={account.printer_id}
                className="cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.02] hover:bg-muted/30"
                onClick={() => setSelectedPrinterId(account.printer_id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-primary/10">
                        <Printer className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle className="text-lg">{account.printer_name}</CardTitle>
                    </div>
                    <Badge
                      variant="secondary"
                      className={account.final_balance > 0
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        : account.final_balance < 0
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : ''
                      }
                    >
                      {account.final_balance > 0 ? 'علينا' : account.final_balance < 0 ? 'دفعنا زيادة' : 'متعادل'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">مهام الطباعة</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400">
                        {account.print_tasks_count}
                      </Badge>
                      <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                        {account.total_print_costs.toLocaleString()} د.ل
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Scissors className="h-4 w-4 text-purple-500" />
                      <span className="text-sm">مهام القص</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400">
                        {account.cutout_tasks_count}
                      </Badge>
                      <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                        {account.total_cutout_costs.toLocaleString()} د.ل
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-green-500" />
                      <span className="text-sm">المدفوعات</span>
                    </div>
                    <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                      {account.total_payments_to_printer.toLocaleString()} د.ل
                    </span>
                  </div>
                  <div className="pt-3 border-t">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm">الرصيد المستحق</span>
                      <span className={`font-bold text-lg ${
                        account.final_balance > 0
                          ? 'text-red-600 dark:text-red-400'
                          : account.final_balance < 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-primary'
                      }`}>
                        {Math.abs(account.final_balance).toLocaleString()} د.ل
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Printer Details */}
      {selectedPrinterId && selectedPrinter && (
        <div className="space-y-4">
          {/* Header Bar */}
          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/30">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setSelectedPrinterId(null); setExpandedContracts(new Set()); setActiveTab('tasks'); }}
                  className="hover:bg-muted"
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Printer className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>{selectedPrinter.printer_name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {printTasks.length} طباعة · {cutoutTasks.length} قص · {payments.length} دفعة
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => setFullStatementDialogOpen(true)}
                >
                  <FileText className="h-4 w-4" />
                  كشف كامل
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={handlePrintAllPending}
                >
                  <PrinterIcon className="h-4 w-4" />
                  طباعة الفواتير المعلقة
                </Button>
                <Button
                  size="sm"
                  className="gap-2 bg-primary text-primary-foreground"
                  onClick={() => setPaymentDialogOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  تسجيل دفعة
                </Button>
              </div>
            </CardHeader>

            {/* Financial Summary */}
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">إجمالي الطباعة</p>
                  <p className="font-bold text-blue-600 dark:text-blue-400">
                    {selectedPrinter.total_print_costs.toLocaleString()} د.ل
                  </p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">إجمالي القص</p>
                  <p className="font-bold text-purple-600 dark:text-purple-400">
                    {selectedPrinter.total_cutout_costs.toLocaleString()} د.ل
                  </p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">المدفوع</p>
                  <p className="font-bold text-green-600 dark:text-green-400">
                    {totalPayments.toLocaleString()} د.ل
                  </p>
                </div>
                <div className={`rounded-lg p-3 text-center ${
                  selectedPrinter.final_balance > 0
                    ? 'bg-red-50 dark:bg-red-950/30'
                    : 'bg-green-50 dark:bg-green-950/30'
                }`}>
                  <p className="text-xs text-muted-foreground mb-1">الرصيد المستحق</p>
                  <p className={`font-bold text-lg ${
                    selectedPrinter.final_balance > 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}>
                    {Math.abs(selectedPrinter.final_balance).toLocaleString()} د.ل
                  </p>
                  {selectedPrinter.final_balance > 0 && (
                    <p className="text-xs text-red-500 flex items-center justify-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />
                      مستحق علينا
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="tasks" className="flex-1 gap-2">
                <FileText className="h-4 w-4" />
                المهام والفواتير
              </TabsTrigger>
              <TabsTrigger value="payments" className="flex-1 gap-2">
                <CreditCard className="h-4 w-4" />
                سجل المدفوعات
                {payments.length > 0 && (
                  <Badge variant="secondary" className="mr-1 text-xs">{payments.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Tasks Tab */}
            <TabsContent value="tasks" className="mt-4 space-y-4">
              {allContractIds.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground">لا توجد مهام لهذه المطبعة</Card>
              ) : (
                allContractIds.map((contractId) => {
                  const contractPrintTasks = groupedPrintTasks[contractId] || [];
                  const contractCutoutTasks = groupedCutoutTasks[contractId] || [];
                  const isExpanded = expandedContracts.has(contractId);
                  const customerName = contractPrintTasks[0]?.customer_name || contractCutoutTasks[0]?.customer_name || 'غير محدد';
                  const totalPrintCost = contractPrintTasks.reduce((sum, t) => sum + (t.total_cost || 0), 0);
                  const totalCutoutCost = contractCutoutTasks.reduce((sum, t) => sum + (t.total_cost || 0), 0);

                  return (
                    <Collapsible
                      key={contractId}
                      open={isExpanded}
                      onOpenChange={() => toggleContract(contractId)}
                    >
                      <Card className="overflow-hidden">
                        <CollapsibleTrigger className="w-full">
                          <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-3">
                              {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-primary border-primary">
                                  عقد #{contractId || 'بدون عقد'}
                                </Badge>
                                <span className="text-sm font-medium flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {customerName}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              {totalPrintCost > 0 && (
                                <div className="flex items-center gap-1 text-sm">
                                  <FileText className="h-4 w-4 text-blue-500" />
                                  <span className="text-blue-600 font-medium">{totalPrintCost.toLocaleString()} د.ل</span>
                                </div>
                              )}
                              {totalCutoutCost > 0 && (
                                <div className="flex items-center gap-1 text-sm">
                                  <Scissors className="h-4 w-4 text-purple-500" />
                                  <span className="text-purple-600 font-medium">{totalCutoutCost.toLocaleString()} د.ل</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <div className="border-t p-4 space-y-4 bg-muted/20">
                            {/* Print Tasks */}
                            {contractPrintTasks.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm flex items-center gap-2 text-blue-600">
                                  <FileText className="h-4 w-4" />
                                  مهام الطباعة ({contractPrintTasks.length})
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {contractPrintTasks.map((task) => (
                                    <Card key={task.id} className="p-3 border-blue-200 dark:border-blue-800">
                                      <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                          {getStatusBadge(task.status)}
                                          <p className="text-sm text-muted-foreground mt-1">المساحة: {task.total_area?.toFixed(2) || 0} م²</p>
                                          {editingPriceTaskId === task.id ? (
                                            <div className="flex items-center gap-1 mt-1">
                                              <Input
                                                type="number"
                                                value={editPriceValue}
                                                onChange={(e) => setEditPriceValue(e.target.value)}
                                                className="h-7 w-20 text-xs"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') handleUpdatePricePerMeter(task.id, parseFloat(editPriceValue));
                                                  if (e.key === 'Escape') setEditingPriceTaskId(null);
                                                }}
                                              />
                                              <span className="text-xs text-muted-foreground">د.ل/م²</span>
                                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleUpdatePricePerMeter(task.id, parseFloat(editPriceValue))}>
                                                <CheckCircle className="h-3 w-3 text-green-600" />
                                              </Button>
                                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditingPriceTaskId(null)}>
                                                <X className="h-3 w-3 text-red-500" />
                                              </Button>
                                            </div>
                                          ) : (
                                            <p className="text-sm text-muted-foreground flex items-center gap-1 cursor-pointer hover:text-primary"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingPriceTaskId(task.id);
                                                setEditPriceValue(String(task.price_per_meter || (task.total_area > 0 ? (task.total_cost / task.total_area).toFixed(2) : 13)));
                                              }}
                                            >
                                              السعر/م: {task.price_per_meter || (task.total_area > 0 ? (task.total_cost / task.total_area).toFixed(2) : 0)} د.ل
                                              <Edit2 className="h-3 w-3 text-muted-foreground" />
                                            </p>
                                          )}
                                          {task.due_date && (
                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                              <Calendar className="h-3 w-3" />
                                              {format(new Date(task.due_date), 'dd MMM yyyy', { locale: ar })}
                                            </p>
                                          )}
                                        </div>
                                        <div className="text-left space-y-2">
                                          <p className="font-bold text-blue-600 dark:text-blue-400">
                                            {(task.total_cost || 0).toLocaleString()} د.ل
                                          </p>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="gap-1 text-xs border-blue-300 hover:bg-blue-50"
                                            onClick={(e) => { e.stopPropagation(); handlePrintPrintTask(task); }}
                                          >
                                            <Printer className="h-3 w-3" />
                                            فاتورة المطبعة
                                          </Button>
                                        </div>
                                      </div>
                                    </Card>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Cutout Tasks */}
                            {contractCutoutTasks.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm flex items-center gap-2 text-purple-600">
                                  <Scissors className="h-4 w-4" />
                                  مهام القص ({contractCutoutTasks.length})
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {contractCutoutTasks.map((task) => (
                                    <Card key={task.id} className="p-3 border-purple-200 dark:border-purple-800">
                                      <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                          {getStatusBadge(task.status)}
                                          <p className="text-sm text-muted-foreground mt-1">الكمية: {task.total_quantity || 0} قطعة</p>
                                          <p className="text-sm text-muted-foreground">السعر/قطعة: {task.unit_cost || 0} د.ل</p>
                                          {task.due_date && (
                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                              <Calendar className="h-3 w-3" />
                                              {format(new Date(task.due_date), 'dd MMM yyyy', { locale: ar })}
                                            </p>
                                          )}
                                        </div>
                                        <div className="text-left space-y-2">
                                          <p className="font-bold text-purple-600 dark:text-purple-400">
                                            {(task.total_cost || 0).toLocaleString()} د.ل
                                          </p>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="gap-1 text-xs border-purple-300 hover:bg-purple-50"
                                            onClick={(e) => { e.stopPropagation(); handlePrintCutoutTask(task); }}
                                          >
                                            <Printer className="h-3 w-3" />
                                            فاتورة المطبعة
                                          </Button>
                                        </div>
                                      </div>
                                    </Card>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  );
                })
              )}
            </TabsContent>

            {/* Payments Tab */}
            <TabsContent value="payments" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    سجل المدفوعات للمطبعة
                  </CardTitle>
                  <Button
                    size="sm"
                    className="gap-2 bg-primary text-primary-foreground"
                    onClick={() => setPaymentDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                    دفعة جديدة
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {payments.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Wallet className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>لا توجد مدفوعات مسجلة</p>
                      <p className="text-sm">اضغط "دفعة جديدة" لإضافة دفعة</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {/* Summary Row */}
                      <div className="p-4 bg-muted/30 flex justify-between items-center">
                        <span className="font-semibold text-sm">إجمالي المدفوعات ({payments.length})</span>
                        <span className="font-bold text-green-600 dark:text-green-400 text-lg">
                          {totalPayments.toLocaleString()} د.ل
                        </span>
                      </div>
                      {payments.map((payment) => (
                        <div key={payment.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-green-600 dark:text-green-400">
                                {payment.amount.toLocaleString()} د.ل
                              </span>
                              {getMethodBadge(payment.payment_method)}
                              {payment.reference && (
                                <span className="text-xs text-muted-foreground">#{payment.reference}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(payment.payment_date), 'dd MMM yyyy', { locale: ar })}
                              </span>
                              {payment.notes && <span>· {payment.notes}</span>}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleDeletePayment(payment.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Payment Dialog */}
      {selectedPrinterId && selectedPrinter && (
        <PrinterPaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          printerId={selectedPrinterId}
          printerName={selectedPrinter.printer_name}
          totalDebt={selectedPrinter.total_supplier_debt}
          totalPaid={totalPayments}
          onPaymentAdded={handlePaymentAdded}
        />
      )}

      {/* Unified Invoice Dialog */}
      {unifiedInvoiceTask && (
        <>
          <UnifiedTaskInvoice
            open={unifiedInvoiceOpen}
            onOpenChange={handleCloseUnifiedInvoice}
            task={unifiedInvoiceTask}
            invoiceType={unifiedInvoiceType}
          />
          {/* Queue navigation for batch printing */}
          {pendingQueue.length > 1 && unifiedInvoiceOpen && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 bg-background border rounded-full shadow-xl px-6 py-3">
              <span className="text-sm text-muted-foreground">
                فاتورة {pendingQueueIndex + 1} من {pendingQueue.length}
              </span>
              <Button size="sm" onClick={handleNextPendingInvoice} className="gap-2">
 {pendingQueueIndex + 1 < pendingQueue.length ? 'التالي ←' : 'إنهاء '}
              </Button>
            </div>
          )}
        </>
      )}
    </div>

    <FullStatementOptionsDialog
      open={fullStatementDialogOpen}
      onOpenChange={setFullStatementDialogOpen}
      onConfirm={handlePrintFullStatement}
      printerName={selectedPrinter?.printer_name}
    />
    </>
  );
}
