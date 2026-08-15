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
  Search, Printer, TrendingUp, TrendingDown, ChevronDown, ChevronUp,
  ArrowRight, Wallet, FileText, Scissors, Calendar, User,
  Clock, CheckCircle, Plus, Trash2, History, PrinterIcon,
  CreditCard, AlertCircle, X, Edit2
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Progress } from '@/components/ui/progress';

// ========== Types ==========
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

// ========== Sub-Components ==========

function StatsCards({ stats }: { stats: { totalPrinters: number; totalTasks: number; totalOwed: number; totalOwing: number } }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/15">
              <Printer className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">عدد المطابع</p>
              <p className="text-xl font-bold">{stats.totalPrinters}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="border-purple-500/20 bg-purple-500/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/15">
              <FileText className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">إجمالي المهام</p>
              <p className="text-xl font-bold">{stats.totalTasks}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="border-red-500/20 bg-red-500/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-500/15">
              <TrendingUp className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">مستحقات علينا</p>
              <p className="text-lg font-bold text-red-500">
                {stats.totalOwed.toLocaleString()} <span className="text-xs">د.ل</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/15">
              <TrendingDown className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">مدفوع للمطابع</p>
              <p className="text-lg font-bold text-emerald-500">
                {stats.totalOwing.toLocaleString()} <span className="text-xs">د.ل</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PrinterCard({ account, onClick }: { account: PrinterAccount; onClick: () => void }) {
  const paidPct = account.total_supplier_debt > 0 
    ? Math.round((account.total_payments_to_printer / account.total_supplier_debt) * 100) 
    : 0;
  return (
    <Card
      className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.01] hover:bg-muted/30"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10">
              <Printer className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-base">{account.printer_name}</CardTitle>
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
      <CardContent className="space-y-3 pt-0">
        {/* Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>نسبة السداد</span>
            <span>{Math.min(paidPct, 100)}%</span>
          </div>
          <Progress value={Math.min(paidPct, 100)} className="h-1.5" />
        </div>

        <div className="flex justify-between items-center p-2 rounded-lg bg-blue-500/5 border border-blue-500/10">
          <div className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-xs">طباعة ({account.print_tasks_count})</span>
          </div>
          <span className="text-sm font-bold text-blue-500">{account.total_print_costs.toLocaleString()} د.ل</span>
        </div>

        {account.cutout_tasks_count > 0 && (
          <div className="flex justify-between items-center p-2 rounded-lg bg-purple-500/5 border border-purple-500/10">
            <div className="flex items-center gap-1.5">
              <Scissors className="h-3.5 w-3.5 text-purple-500" />
              <span className="text-xs">قص ({account.cutout_tasks_count})</span>
            </div>
            <span className="text-sm font-bold text-purple-500">{account.total_cutout_costs.toLocaleString()} د.ل</span>
          </div>
        )}

        <div className="flex justify-between items-center p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
          <div className="flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs">المدفوعات</span>
          </div>
          <span className="text-sm font-bold text-emerald-500">{account.total_payments_to_printer.toLocaleString()} د.ل</span>
        </div>

        <div className="pt-2 border-t border-border/50">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-xs">الرصيد المستحق</span>
            <span className={`font-bold text-base ${
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
  );
}

function PrinterDetailHeader({ 
  printer, totalPayments, onBack, onFullStatement, onPrintPending, onAddPayment 
}: {
  printer: PrinterAccount;
  totalPayments: number;
  onBack: () => void;
  onFullStatement: () => void;
  onPrintPending: () => void;
  onAddPayment: () => void;
}) {
  return (
    <Card className="shadow-lg overflow-hidden">
      <CardHeader className="border-b bg-muted/30 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10">
                <Printer className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{printer.printer_name}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {printer.print_tasks_count} طباعة · {printer.cutout_tasks_count} قص
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onFullStatement}>
              <FileText className="h-3.5 w-3.5" />
              كشف كامل
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onPrintPending}>
              <PrinterIcon className="h-3.5 w-3.5" />
              طباعة المعلقة
            </Button>
            <Button size="sm" className="gap-1.5" onClick={onAddPayment}>
              <Plus className="h-3.5 w-3.5" />
              تسجيل دفعة
            </Button>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-2.5 text-center">
            <p className="text-xs text-muted-foreground">إجمالي الطباعة</p>
            <p className="text-sm font-bold text-blue-500">{printer.total_print_costs.toLocaleString()} د.ل</p>
          </div>
          <div className="bg-purple-500/5 border border-purple-500/10 rounded-lg p-2.5 text-center">
            <p className="text-xs text-muted-foreground">إجمالي القص</p>
            <p className="text-sm font-bold text-purple-500">{printer.total_cutout_costs.toLocaleString()} د.ل</p>
          </div>
          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2.5 text-center">
            <p className="text-xs text-muted-foreground">المدفوع</p>
            <p className="text-sm font-bold text-emerald-500">{totalPayments.toLocaleString()} د.ل</p>
          </div>
          <div className={`rounded-lg p-2.5 text-center ${
            printer.final_balance > 0 ? 'bg-red-500/5 border border-red-500/10' : 'bg-emerald-500/5 border border-emerald-500/10'
          }`}>
            <p className="text-xs text-muted-foreground">الرصيد المستحق</p>
            <p className={`text-sm font-bold ${
              printer.final_balance > 0 ? 'text-red-500' : 'text-emerald-500'
            }`}>
              {Math.abs(printer.final_balance).toLocaleString()} د.ل
            </p>
            {printer.final_balance > 0 && (
              <p className="text-[10px] text-red-500 flex items-center justify-center gap-1 mt-0.5">
                <AlertCircle className="h-2.5 w-2.5" />
                مستحق علينا
              </p>
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

// ========== Main Component ==========
export function PrinterAccountsEnhanced() {
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

  // ===== Data Fetching =====
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['printer-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('printer_accounts').select('*').order('printer_name');
      if (error) throw error;
      return (data || []) as PrinterAccount[];
    }
  });

  const { data: printTasks = [] } = useQuery({
    queryKey: ['printer-print-tasks', selectedPrinterId],
    queryFn: async () => {
      if (!selectedPrinterId) return [];
      const { data, error } = await supabase.from('print_tasks').select('*, installation_task_id').eq('printer_id', selectedPrinterId).order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as PrintTask[];
    },
    enabled: !!selectedPrinterId
  });

  const { data: cutoutTasks = [] } = useQuery({
    queryKey: ['printer-cutout-tasks', selectedPrinterId],
    queryFn: async () => {
      if (!selectedPrinterId) return [];
      const { data, error } = await supabase.from('cutout_tasks').select('*, installation_task_id').eq('printer_id', selectedPrinterId).order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as CutoutTask[];
    },
    enabled: !!selectedPrinterId
  });

  const { data: payments = [], refetch: refetchPayments } = useQuery({
    queryKey: ['printer-payments', selectedPrinterId],
    queryFn: async () => {
      if (!selectedPrinterId) return [];
      const { data, error } = await supabase.from('printer_payments').select('*').eq('printer_id', selectedPrinterId).order('payment_date', { ascending: false });
      if (error) throw error;
      return (data || []) as PrinterPayment[];
    },
    enabled: !!selectedPrinterId
  });

  // ===== Computed =====
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

  const totalPayments = payments.reduce((s, p) => s + p.amount, 0);

  // ===== Handlers =====
  const toggleContract = (contractId: number) => {
    const newExpanded = new Set(expandedContracts);
    if (newExpanded.has(contractId)) newExpanded.delete(contractId);
    else newExpanded.add(contractId);
    setExpandedContracts(newExpanded);
  };

  const buildMockCompositeTask = (task: PrintTask | CutoutTask, type: 'print' | 'cutout'): CompositeTaskWithDetails => {
    return {
      id: task.id, created_at: task.created_at, updated_at: task.created_at,
      contract_id: task.contract_id, customer_id: null, customer_name: task.customer_name,
      task_type: 'new_installation', installation_task_id: task.installation_task_id || '',
      print_task_id: type === 'print' ? task.id : null,
      cutout_task_id: type === 'cutout' ? task.id : null,
      installation_cost: 0,
      print_cost: type === 'print' ? (task.total_cost || 0) : 0,
      cutout_cost: type === 'cutout' ? (task.total_cost || 0) : 0,
      total_cost: task.total_cost || 0,
      customer_installation_cost: 0, company_installation_cost: 0,
      customer_print_cost: type === 'print' ? (task.total_cost || 0) : 0,
      company_print_cost: type === 'print' ? (task.total_cost || 0) : 0,
      customer_cutout_cost: type === 'cutout' ? (task.total_cost || 0) : 0,
      company_cutout_cost: type === 'cutout' ? (task.total_cost || 0) : 0,
      customer_total: task.total_cost || 0, company_total: task.total_cost || 0,
      net_profit: 0, profit_percentage: 0, discount_amount: 0, discount_reason: null,
      status: (task.status as any) || 'pending',
      combined_invoice_id: null, invoice_generated: false, invoice_date: null, notes: null,
    } as CompositeTaskWithDetails;
  };

  const handlePrintPrintTask = (task: PrintTask) => {
    setUnifiedInvoiceTask(buildMockCompositeTask(task, 'print'));
    setUnifiedInvoiceType('print_vendor');
    setUnifiedInvoiceOpen(true);
    setPendingQueue([]);
  };

  const handlePrintCutoutTask = (task: CutoutTask) => {
    setUnifiedInvoiceTask(buildMockCompositeTask(task, 'cutout'));
    setUnifiedInvoiceType('cutout_vendor');
    setUnifiedInvoiceOpen(true);
    setPendingQueue([]);
  };

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
    toast.info(`${queue.length} فاتورة معلقة`);
  };

  const handleCloseUnifiedInvoice = (open: boolean) => {
    if (!open) { setUnifiedInvoiceOpen(false); setUnifiedInvoiceTask(null); setPendingQueue([]); setPendingQueueIndex(0); }
  };

  const handleNextPendingInvoice = () => {
    const nextIdx = pendingQueueIndex + 1;
    if (nextIdx < pendingQueue.length) {
      setPendingQueueIndex(nextIdx);
      setUnifiedInvoiceTask(pendingQueue[nextIdx].task);
      setUnifiedInvoiceType(pendingQueue[nextIdx].type);
    } else {
      setUnifiedInvoiceOpen(false); setUnifiedInvoiceTask(null); setPendingQueue([]); setPendingQueueIndex(0);
      toast.success('تم طباعة جميع الفواتير');
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!await systemConfirm({ title: 'تأكيد الحذف', message: 'هل تريد حذف هذه الدفعة؟', variant: 'destructive', confirmText: 'حذف' })) return;
    const { error } = await supabase.from('printer_payments').delete().eq('id', paymentId);
    if (error) { toast.error('فشل حذف الدفعة'); return; }
    toast.success('تم حذف الدفعة');
    refetchPayments();
    queryClient.invalidateQueries({ queryKey: ['printer-accounts'] });
  };

  const handlePaymentAdded = () => {
    refetchPayments();
    queryClient.invalidateQueries({ queryKey: ['printer-accounts'] });
  };

  const handleUpdatePricePerMeter = async (taskId: string, newPrice: number) => {
    if (isNaN(newPrice) || newPrice <= 0) { toast.error('أدخل سعر صحيح'); return; }
    const task = printTasks.find(t => t.id === taskId);
    if (!task) return;
    const newTotalCost = Math.round(newPrice * (task.total_area || 0) * 100) / 100;
    const { error } = await supabase.from('print_tasks').update({ price_per_meter: newPrice, total_cost: newTotalCost, updated_at: new Date().toISOString() }).eq('id', taskId);
    if (error) { toast.error('فشل تحديث سعر المتر'); return; }
    const { data: linkedTasks } = await supabase.from('composite_tasks').select('id, company_installation_cost, company_cutout_cost').eq('print_task_id', taskId);
    if (linkedTasks && linkedTasks.length > 0) {
      for (const ct of linkedTasks) {
        const newCompanyTotal = (ct.company_installation_cost || 0) + newTotalCost + (ct.company_cutout_cost || 0);
        await supabase.from('composite_tasks').update({ company_print_cost: newTotalCost, company_total: newCompanyTotal, updated_at: new Date().toISOString() }).eq('id', ct.id);
      }
    }
    toast.success(`تم تحديث سعر المتر إلى ${newPrice} د.ل`);
    setEditingPriceTaskId(null);
    queryClient.invalidateQueries({ queryKey: ['printer-print-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['printer-accounts'] });
    queryClient.invalidateQueries({ queryKey: ['composite-tasks'] });
  };

  // Full statement handler - delegates to the original page's logic
  // This is kept as a pass-through; the actual implementation remains in PrinterAccounts.tsx
  // until we extract it to its own module
  const handlePrintFullStatement = async (_options: FullStatementOptions) => {
    toast.info('يرجى استخدام الكشف الكامل من الصفحة الأصلية حالياً');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs"><CheckCircle className="h-3 w-3 mr-1" />مكتمل</Badge>;
      case 'pending': return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 text-xs"><Clock className="h-3 w-3 mr-1" />معلق</Badge>;
      case 'in_progress': return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs">قيد التنفيذ</Badge>;
      default: return <Badge variant="secondary" className="text-xs">{status}</Badge>;
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

  // ===== Render =====
  return (
    <>
      <div className="space-y-5">
        {/* Stats */}
        <StatsCards stats={overallStats} />

        {/* Search (when no printer selected) */}
        {!selectedPrinterId && (
          <div className="relative max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث عن مطبعة..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
        )}

        {/* Printer Cards List */}
        {!selectedPrinterId && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              <div className="col-span-full text-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
                <p className="text-muted-foreground mt-4">جاري التحميل...</p>
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">لا توجد مطابع</div>
            ) : (
              filteredAccounts.map((account) => (
                <PrinterCard key={account.printer_id} account={account} onClick={() => setSelectedPrinterId(account.printer_id)} />
              ))
            )}
          </div>
        )}

        {/* Printer Detail View */}
        {selectedPrinterId && selectedPrinter && (
          <div className="space-y-4">
            <PrinterDetailHeader
              printer={selectedPrinter}
              totalPayments={totalPayments}
              onBack={() => { setSelectedPrinterId(null); setExpandedContracts(new Set()); setActiveTab('tasks'); }}
              onFullStatement={() => setFullStatementDialogOpen(true)}
              onPrintPending={handlePrintAllPending}
              onAddPayment={() => setPaymentDialogOpen(true)}
            />

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full">
                <TabsTrigger value="tasks" className="flex-1 gap-2">
                  <FileText className="h-4 w-4" />
                  المهام والفواتير
                </TabsTrigger>
                <TabsTrigger value="payments" className="flex-1 gap-2">
                  <CreditCard className="h-4 w-4" />
                  سجل المدفوعات
                  {payments.length > 0 && <Badge variant="secondary" className="mr-1 text-xs">{payments.length}</Badge>}
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
                      <Collapsible key={contractId} open={isExpanded} onOpenChange={() => toggleContract(contractId)}>
                        <Card className="overflow-hidden">
                          <CollapsibleTrigger className="w-full">
                            <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                              <div className="flex items-center gap-3">
                                {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-primary border-primary">عقد #{contractId || 'بدون عقد'}</Badge>
                                  <span className="text-sm font-medium flex items-center gap-1"><User className="h-3 w-3" />{customerName}</span>
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
                              {contractPrintTasks.length > 0 && (
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-sm flex items-center gap-2 text-blue-600"><FileText className="h-4 w-4" />مهام الطباعة ({contractPrintTasks.length})</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {contractPrintTasks.map((task) => (
                                      <Card key={task.id} className="p-3 border-blue-200 dark:border-blue-800">
                                        <div className="flex items-start justify-between">
                                          <div className="space-y-1">
                                            {getStatusBadge(task.status)}
                                            <p className="text-sm text-muted-foreground mt-1">المساحة: {task.total_area?.toFixed(2) || 0} م²</p>
                                            {editingPriceTaskId === task.id ? (
                                              <div className="flex items-center gap-1 mt-1">
                                                <Input type="number" value={editPriceValue} onChange={(e) => setEditPriceValue(e.target.value)} className="h-7 w-20 text-xs" autoFocus
                                                  onKeyDown={(e) => { if (e.key === 'Enter') handleUpdatePricePerMeter(task.id, parseFloat(editPriceValue)); if (e.key === 'Escape') setEditingPriceTaskId(null); }}
                                                />
                                                <span className="text-xs text-muted-foreground">د.ل/م²</span>
                                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleUpdatePricePerMeter(task.id, parseFloat(editPriceValue))}><CheckCircle className="h-3 w-3 text-green-600" /></Button>
                                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditingPriceTaskId(null)}><X className="h-3 w-3 text-red-500" /></Button>
                                              </div>
                                            ) : (
                                              <p className="text-sm text-muted-foreground flex items-center gap-1 cursor-pointer hover:text-primary"
                                                onClick={(e) => { e.stopPropagation(); setEditingPriceTaskId(task.id); setEditPriceValue(String(task.price_per_meter || (task.total_area > 0 ? (task.total_cost / task.total_area).toFixed(2) : 13))); }}
                                              >
                                                السعر/م: {task.price_per_meter || (task.total_area > 0 ? (task.total_cost / task.total_area).toFixed(2) : 0)} د.ل
                                                <Edit2 className="h-3 w-3 text-muted-foreground" />
                                              </p>
                                            )}
                                            {task.due_date && (
                                              <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(task.due_date), 'dd MMM yyyy', { locale: ar })}</p>
                                            )}
                                          </div>
                                          <div className="text-left space-y-2">
                                            <p className="font-bold text-blue-600 dark:text-blue-400">{(task.total_cost || 0).toLocaleString()} د.ل</p>
                                            <Button size="sm" variant="outline" className="gap-1 text-xs border-blue-300 hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); handlePrintPrintTask(task); }}>
                                              <Printer className="h-3 w-3" />فاتورة
                                            </Button>
                                          </div>
                                        </div>
                                      </Card>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {contractCutoutTasks.length > 0 && (
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-sm flex items-center gap-2 text-purple-600"><Scissors className="h-4 w-4" />مهام القص ({contractCutoutTasks.length})</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {contractCutoutTasks.map((task) => (
                                      <Card key={task.id} className="p-3 border-purple-200 dark:border-purple-800">
                                        <div className="flex items-start justify-between">
                                          <div className="space-y-1">
                                            {getStatusBadge(task.status)}
                                            <p className="text-sm text-muted-foreground mt-1">الكمية: {task.total_quantity || 0} قطعة</p>
                                            <p className="text-sm text-muted-foreground">السعر/قطعة: {task.unit_cost || 0} د.ل</p>
                                            {task.due_date && (
                                              <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(task.due_date), 'dd MMM yyyy', { locale: ar })}</p>
                                            )}
                                          </div>
                                          <div className="text-left space-y-2">
                                            <p className="font-bold text-purple-600 dark:text-purple-400">{(task.total_cost || 0).toLocaleString()} د.ل</p>
                                            <Button size="sm" variant="outline" className="gap-1 text-xs border-purple-300 hover:bg-purple-50" onClick={(e) => { e.stopPropagation(); handlePrintCutoutTask(task); }}>
                                              <Printer className="h-3 w-3" />فاتورة
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
                    <CardTitle className="text-base flex items-center gap-2"><History className="h-5 w-5 text-primary" />سجل المدفوعات</CardTitle>
                    <Button size="sm" className="gap-1.5" onClick={() => setPaymentDialogOpen(true)}><Plus className="h-3.5 w-3.5" />دفعة جديدة</Button>
                  </CardHeader>
                  <CardContent className="p-0">
                    {payments.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Wallet className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p>لا توجد مدفوعات مسجلة</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        <div className="p-4 bg-muted/30 flex justify-between items-center">
                          <span className="font-semibold text-sm">إجمالي المدفوعات ({payments.length})</span>
                          <span className="font-bold text-green-600 dark:text-green-400 text-lg">{totalPayments.toLocaleString()} د.ل</span>
                        </div>
                        {payments.map((payment) => (
                          <div key={payment.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-green-600 dark:text-green-400">{payment.amount.toLocaleString()} د.ل</span>
                                {getMethodBadge(payment.payment_method)}
                                {payment.reference && <span className="text-xs text-muted-foreground">#{payment.reference}</span>}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(payment.payment_date), 'dd MMM yyyy', { locale: ar })}</span>
                                {payment.notes && <span>· {payment.notes}</span>}
                              </div>
                            </div>
                            <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => handleDeletePayment(payment.id)}><Trash2 className="h-4 w-4" /></Button>
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

        {/* Dialogs */}
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

        {unifiedInvoiceTask && (
          <>
            <UnifiedTaskInvoice open={unifiedInvoiceOpen} onOpenChange={handleCloseUnifiedInvoice} task={unifiedInvoiceTask} invoiceType={unifiedInvoiceType} />
            {pendingQueue.length > 1 && unifiedInvoiceOpen && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 bg-background border rounded-full shadow-xl px-6 py-3">
                <span className="text-sm text-muted-foreground">فاتورة {pendingQueueIndex + 1} من {pendingQueue.length}</span>
 <Button size="sm" onClick={handleNextPendingInvoice}>{pendingQueueIndex + 1 < pendingQueue.length ? 'التالي ←' : 'إنهاء '}</Button>
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
