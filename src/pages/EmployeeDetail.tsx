import { useEffect, useState } from 'react';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import * as UIDialog from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  Loader2, ArrowRight, Plus, DollarSign, Calendar, 
  FileText, CheckCircle, TrendingUp, Wallet, Edit, Trash2,
  BarChart3, PieChart, Activity, Printer, Wrench, Users
} from 'lucide-react';
import ExpenseReceiptPrintDialog from '@/components/billing/ExpenseReceiptPrintDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart, Bar, LineChart, Line, PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface Employee {
  id: string;
  name: string;
  position: string;
  email: string;
  phone: string;
  status: string;
  hire_date: string;
  base_salary: number;
  salary_type: string;
  installation_team_id?: string | null;
  linked_to_operating_expenses?: boolean;
  created_at: string;
}

interface ManualTask {
  id: string;
  employee_id: string;
  task_description: string;
  task_date: string;
  operating_cost: number;
  notes: string | null;
  status: string;
  completed_at: string | null;
  created_at: string;
}

interface PayrollItem {
  id: string;
  employee_id: string;
  payroll_id: string;
  basic_salary: number;
  allowances: number;
  overtime_amount: number;
  deductions: number;
  net_salary: number;
  paid: boolean;
  created_at: string;
}

interface Advance {
  id: string;
  employee_id: string;
  amount: number;
  remaining: number;
  reason: string | null;
  status: string;
  request_date: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-950/95 dark:bg-slate-900/95 border border-white/10 dark:border-blue-500/30 p-3 rounded-xl shadow-xl text-right dir-rtl font-numbers">
        <p className="text-xs font-bold text-muted-foreground mb-1.5">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-xs font-bold" style={{ color: entry.stroke || entry.color }}>
            {entry.name}: {Number(entry.value).toLocaleString('ar-LY')} د.ل
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goToExpenses = () => navigate('/admin/expenses');
  
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [manualTasks, setManualTasks] = useState<ManualTask[]>([]);
  const [payrollItems, setPayrollItems] = useState<PayrollItem[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [installationTeam, setInstallationTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const { confirm: systemConfirm } = useSystemDialog();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any>(null);
  const [withdrawalDialogOpen, setWithdrawalDialogOpen] = useState(false);
  const [editingWithdrawal, setEditingWithdrawal] = useState<any>(null);
  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState<any>(null);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceReason, setAdvanceReason] = useState('');
  
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDate, setTaskDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [operatingCost, setOperatingCost] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [senderName, setSenderName] = useState('');
  
  // Operating expenses data
  const [operatingStats, setOperatingStats] = useState({
    totalContracts: 0,
    totalOperatingFees: 0,
    totalWithdrawals: 0,
    remainingBalance: 0,
    withdrawalsCount: 0
  });
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [closures, setClosures] = useState<any[]>([]);
  const [editingClosure, setEditingClosure] = useState<any>(null);
  const [closureDialogOpen, setClosureDialogOpen] = useState(false);

  // Team accounts data
  const [teamAccounts, setTeamAccounts] = useState<any[]>([]);
  const [teamAccountsStats, setTeamAccountsStats] = useState({ pending: 0, paid: 0, total: 0 });

  useEffect(() => {
    if (id) {
      loadEmployeeData();
    }
  }, [id]);

  const loadOperatingExpensesData = async (empData: any) => {
    try {
      // Load withdrawals
      const { data: withdrawalsData } = await supabase
        .from('expenses_withdrawals')
        .select('*')
        .order('date', { ascending: false });

      // Load closures - جميع التساكير (مثل صفحة مستحقات التشغيل Expenses.tsx)
      const { data: closuresData } = await supabase
        .from('period_closures')
        .select('*')
        .order('created_at', { ascending: false });
      
      setClosures(closuresData || []);

      // Load excluded contracts
      const { data: flagsData } = await supabase
        .from('expenses_flags')
        .select('contract_id, excluded');
      
      const excludedSet = new Set<string>();
      (flagsData || []).forEach((flag: any) => {
        if (flag.excluded && flag.contract_id != null) {
          excludedSet.add(String(flag.contract_id));
        }
      });

      // دالة للتحقق إذا كان العقد مغطى بتسكير تدعم التاريخ ونطاق العقود
      const isContractCoveredByClosure = (contractNum: number, startDateStr: string): boolean => {
        if (!closuresData || closuresData.length === 0) return false;
        return closuresData.some((closure: any) => {
          if (closure.closure_type === 'contract_range') {
            const start = Number(closure.contract_start) || 0;
            const end = Number(closure.contract_end) || 0;
            return contractNum >= start && contractNum <= end;
          } else if (closure.closure_type === 'period' && closure.period_start && closure.period_end) {
            if (!startDateStr) return false;
            const contractDate = new Date(startDateStr);
            const closureStart = new Date(closure.period_start);
            const closureEnd = new Date(closure.period_end);
            return contractDate >= closureStart && contractDate <= closureEnd;
          }
          return false;
        });
      };

      // Get operating fees from contracts with all required fields
      const { data: contractsData } = await supabase
        .from('Contract')
        .select(`
          Contract_Number, 
          "Total Rent", 
          Total,
          installation_cost, 
          print_cost, 
          operating_fee_rate, 
          operating_fee_rate_installation, 
          operating_fee_rate_print, 
          include_operating_in_installation, 
          include_operating_in_print,
          friend_rental_operating_fee_enabled,
          friend_rental_operating_fee_rate,
          friend_rental_data,
          partnership_operating_data,
          "Contract Date"
        `);
      
      // جلب المدفوعات الفعلية لكل عقد
      const { data: paymentsData } = await supabase
        .from('customer_payments')
        .select('contract_number, amount, entry_type')
        .order('created_at', { ascending: true });

      // حساب المدفوع لكل عقد
      const paidByContract: Record<string, number> = {};
      (paymentsData || []).forEach((p: any) => {
        const type = String(p.entry_type || '');
        if (type === 'receipt' || type === 'account_payment' || type === 'payment') {
          const key = String(p.contract_number || '');
          if (!key) return;
          paidByContract[key] = (paidByContract[key] || 0) + (Number(p.amount) || 0);
        }
      });
      
      // حساب النسبة والتفاصيل لكل عقد بنسبة مطابقة تماماً لـ Expenses.tsx
      const allContracts = (contractsData || []).map((c: any) => {
        const contractNum = Number(c.Contract_Number) || 0;
        const rentCost = Number(c['Total Rent']) || 0;
        const installationCost = Number(c.installation_cost) || 0;
        const printCost = Number(c.print_cost) || 0;
        
        const includeInstallation = c.include_operating_in_installation === true;
        const includePrint = c.include_operating_in_print === true;
        
        const totalAmount = Number(c.Total ?? (rentCost + installationCost + printCost));
        const totalPaid = paidByContract[String(c.Contract_Number)] || 0;
        
        const feePercent = Number(c.operating_fee_rate) || 0;
        const feePercentInstallation = Number(c.operating_fee_rate_installation ?? feePercent) || 0;
        const feePercentPrint = Number(c.operating_fee_rate_print ?? feePercent) || 0;
        
        // Friend rentals
        const friendOpEnabled = c.friend_rental_operating_fee_enabled === true;
        const friendOpRate = Number(c.friend_rental_operating_fee_rate) || 0;
        let friendCostsTotal = 0;
        const rawFriendData = c.friend_rental_data;
        if (rawFriendData) {
          try {
            const data = typeof rawFriendData === 'string' ? JSON.parse(rawFriendData) : rawFriendData;
            if (Array.isArray(data)) {
              friendCostsTotal = data.reduce((sum: number, item: any) => sum + (Number(item.friendRentalCost ?? item.friend_rental_cost) || 0), 0);
            }
          } catch (e) {
            console.warn('Failed to parse friend_rental_data:', e);
          }
        }
        const friendFeeFull = friendOpEnabled ? Math.round(friendCostsTotal * (friendOpRate / 100)) : 0;
        
        // Partnership
        let partnershipFeeFull = 0;
        const rawPartnership = c.partnership_operating_data;
        if (rawPartnership) {
          try {
            const data = typeof rawPartnership === 'string' ? JSON.parse(rawPartnership) : rawPartnership;
            if (Array.isArray(data)) {
              partnershipFeeFull = data.reduce((sum: number, item: any) => sum + (Number(item.operating_fee_amount) || 0), 0);
            }
          } catch (e) {}
        }
        
        // Ratio capped at 1
        const paymentRatio = totalAmount > 0 ? Math.min(1, totalPaid / totalAmount) : 0;
        
        const regularRentalBase = Math.max(0, rentCost - friendCostsTotal);
        let collectedFee = Math.round(regularRentalBase * paymentRatio * (feePercent / 100));
        if (includeInstallation) collectedFee += Math.round(installationCost * paymentRatio * (feePercentInstallation / 100));
        if (includePrint) collectedFee += Math.round(printCost * paymentRatio * (feePercentPrint / 100));
        collectedFee += Math.round((friendFeeFull + partnershipFeeFull) * paymentRatio);
        
        const startDate = c['Contract Date'] ?? c.start_date ?? '';
        
        return {
          contractNumber: contractNum,
          collectedFeeAmount: collectedFee,
          startDate,
          isExcluded: excludedSet.has(String(contractNum))
        };
      });

      // فلترة العقود غير المغطاة بالتسكير وغير المستبعدة وتحديد بداية النسبة لعقود >= 1086
      const uncoveredContracts = allContracts.filter(c => {
        if (c.contractNumber < 1086) return false;
        if (c.isExcluded) return false;
        
        const isClosed = isContractCoveredByClosure(c.contractNumber, c.startDate);
        return !isClosed;
      });

      const totalOperatingDues = uncoveredContracts.reduce((sum, c) => sum + c.collectedFeeAmount, 0);

      // فلترة السحوبات الخاصة بالموظف الحالي
      const filteredWithdrawals = (withdrawalsData || []).filter((w: any) => {
        if (w.receiver_name === empData.name) return true;
        if (!w.receiver_name) return true; // السحوبات القديمة غير محددة الاسم تتبع له كمدير تشغيل وحيد
        return false;
      });

      // حساب إجمالي السحوبات
      const totalWithdrawals = filteredWithdrawals.reduce((sum, w) => sum + (Number(w.amount) || 0), 0);

      const contractsCount = uncoveredContracts.length;
      const remainingBalance = totalOperatingDues - totalWithdrawals;

      setOperatingStats({
        totalContracts: contractsCount,
        totalOperatingFees: totalOperatingDues,
        totalWithdrawals: totalWithdrawals,
        remainingBalance: remainingBalance,
        withdrawalsCount: filteredWithdrawals.length
      });

      setWithdrawals(filteredWithdrawals);
    } catch (error) {
      console.error('Error loading operating expenses:', error);
    }
  };

  const loadEmployeeData = async () => {
    try {
      setLoading(true);
      
      // Load employee
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('*')
        .eq('id', id)
        .single();

      if (employeeError) throw employeeError;
      setEmployee(employeeData);
      
      // Load operating expenses data if linked
      if (employeeData.linked_to_operating_expenses) {
        await loadOperatingExpensesData(employeeData);
      }

      // Load installation team if exists
      if (employeeData.installation_team_id) {
        const { data: teamData } = await supabase
          .from('installation_teams')
          .select('*')
          .eq('id', employeeData.installation_team_id)
          .single();
        
        if (teamData) setInstallationTeam(teamData);

        // Load team accounts
        const { data: accountsData } = await supabase
          .from('installation_team_accounts')
          .select('*, billboard:billboards!installation_team_accounts_billboard_id_fkey(Billboard_Name, Size)')
          .eq('team_id', employeeData.installation_team_id)
          .order('installation_date', { ascending: false });
        
        const accounts = accountsData || [];
        setTeamAccounts(accounts);
        const pending = accounts.filter((a: any) => a.status === 'pending').reduce((s: number, a: any) => s + (Number(a.amount) || 0), 0);
        const paid = accounts.filter((a: any) => a.status === 'paid').reduce((s: number, a: any) => s + (Number(a.amount) || 0), 0);
        setTeamAccountsStats({ pending, paid, total: pending + paid });
      }

      // Load manual tasks
      const { data: tasksData } = await supabase
        .from('employee_manual_tasks')
        .select('*')
        .eq('employee_id', id)
        .order('task_date', { ascending: false });
      
      if (tasksData) setManualTasks(tasksData);

      // Load payroll items
      const { data: payrollData } = await supabase
        .from('payroll_items')
        .select('*')
        .eq('employee_id', id)
        .order('created_at', { ascending: false });
      
      if (payrollData) setPayrollItems(payrollData);

      // Load advances
      const { data: advancesData } = await supabase
        .from('employee_advances')
        .select('*')
        .eq('employee_id', id)
        .order('request_date', { ascending: false });
      
      if (advancesData) setAdvances(advancesData);

    } catch (error) {
      console.error('خطأ في تحميل بيانات الموظف:', error);
      toast.error('فشل في تحميل بيانات الموظف');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async () => {
    if (!taskDescription.trim() || !operatingCost || parseFloat(operatingCost) <= 0) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      await supabase.from('employee_manual_tasks').insert({
        employee_id: id,
        task_description: taskDescription.trim(),
        task_date: taskDate,
        operating_cost: parseFloat(operatingCost),
        notes: taskNotes.trim() || null,
        status: 'pending'
      });

      toast.success('تم إضافة العمل اليدوي بنجاح');
      setTaskDialogOpen(false);
      setTaskDescription('');
      setTaskDate(new Date().toISOString().slice(0, 10));
      setOperatingCost('');
      setTaskNotes('');
      loadEmployeeData();
    } catch (error) {
      console.error('Error adding task:', error);
      toast.error('فشل في إضافة العمل اليدوي');
    }
  };

  const handlePayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح');
      return;
    }

    const amount = parseFloat(paymentAmount);
    
    // التحقق من عدم تجاوز الرصيد المتاح
    const isTeam = !!employee?.installation_team_id;
    const isOperating = employee?.linked_to_operating_expenses === true;
    
    let availableBalance = 0;
    if (isOperating) {
      availableBalance = operatingStats.remainingBalance;
    } else if (isTeam) {
      const pendingAdvances = advances
        .filter(a => a.status === 'approved')
        .reduce((sum, a) => sum + (a.remaining || 0), 0);
      availableBalance = teamAccountsStats.pending - pendingAdvances;
    }
    
    if ((isTeam || isOperating) && amount > availableBalance) {
      toast.error(`لا يمكن السحب أكثر من الرصيد المتاح (${Math.round(availableBalance).toLocaleString('ar-LY')} د.ل)`);
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      
      if (isOperating) {
        // سحب من مستحقات التشغيل
        const { error } = await supabase
          .from('expenses_withdrawals')
          .insert({
            amount,
            date: paymentDate,
            method: paymentMethod || null,
            note: paymentNotes || null,
            notes: paymentNotes || null,
            receiver_name: receiverName || employee?.name || null,
            sender_name: senderName || null,
            user_id: userData?.user?.id || null
          });
        if (error) throw error;
      } else if (isTeam) {
        // سحب من مستحقات فرقة التركيب - تسجيل كسلفة/سحب
        const { error } = await supabase
          .from('employee_advances')
          .insert({
            employee_id: id,
            amount,
            remaining: 0, // مدفوعة بالكامل (سحب وليس سلفة)
            reason: `سحب من مستحقات الفرقة${paymentNotes ? ' - ' + paymentNotes : ''}`,
            status: 'approved',
            request_date: paymentDate
          });
        if (error) throw error;

        // تحديث حالة حسابات الفرقة المعلقة إلى مدفوع بمقدار المبلغ المسحوب
        let remainingToMark = amount;
        const pendingAccounts = teamAccounts
          .filter((a: any) => a.status === 'pending')
          .sort((a: any, b: any) => new Date(a.installation_date).getTime() - new Date(b.installation_date).getTime());
        
        for (const account of pendingAccounts) {
          if (remainingToMark <= 0) break;
          const accountAmount = Number(account.amount) || 0;
          if (accountAmount <= remainingToMark) {
            await supabase
              .from('installation_team_accounts')
              .update({ status: 'paid' })
              .eq('id', account.id);
            remainingToMark -= accountAmount;
          } else {
            break;
          }
        }
      }

      toast.success('تم تسجيل السحب بنجاح');
      setPaymentDialogOpen(false);
      setPaymentAmount('');
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setPaymentMethod('');
      setPaymentNotes('');
      setReceiverName('');
      setSenderName('');
      loadEmployeeData();
    } catch (error) {
      console.error('Error adding withdrawal:', error);
      toast.error('فشل في تسجيل السحب');
    }
  };

  const handleEditWithdrawal = async () => {
    if (!editingWithdrawal || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح');
      return;
    }

    try {
      const { error } = await supabase
        .from('expenses_withdrawals')
        .update({
          amount: parseFloat(paymentAmount),
          date: paymentDate,
          method: paymentMethod || null,
          note: paymentNotes || null,
          receiver_name: receiverName || null,
          sender_name: senderName || null
        })
        .eq('id', editingWithdrawal.id);

      if (error) throw error;

      toast.success('تم تعديل السحب بنجاح');
      setWithdrawalDialogOpen(false);
      setEditingWithdrawal(null);
      setPaymentAmount('');
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setPaymentMethod('');
      setPaymentNotes('');
      setReceiverName('');
      setSenderName('');
      loadEmployeeData();
    } catch (error) {
      console.error('Error editing withdrawal:', error);
      toast.error('فشل في تعديل السحب');
    }
  };

  const handleMarkTaskComplete = async (taskId: string) => {
    try {
      await supabase
        .from('employee_manual_tasks')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', taskId);

      toast.success('تم تسجيل العمل كمكتمل');
      loadEmployeeData();
    } catch (error) {
      console.error('Error completing task:', error);
      toast.error('فشل في تحديث حالة العمل');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذا العمل؟', variant: 'destructive', confirmText: 'حذف' })) return;

    try {
      await supabase
        .from('employee_manual_tasks')
        .delete()
        .eq('id', taskId);

      toast.success('تم حذف العمل بنجاح');
      loadEmployeeData();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('فشل في حذف العمل');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-xl text-muted-foreground">الموظف غير موجود</p>
          <Button onClick={() => navigate('/admin/salaries')} className="mt-4">
            العودة للقائمة
          </Button>
        </div>
      </div>
    );
  }

  // Calculate statistics - للموظف المرتبط بمستحقات التشغيل استخدم القيم مباشرة
  const isLinkedToOperating = employee.linked_to_operating_expenses === true;
  const isLinkedToTeam = !!employee.installation_team_id;

  // إجمالي المستحقات
  const totalDue = isLinkedToOperating 
    ? operatingStats.totalOperatingFees
    : isLinkedToTeam
      ? teamAccountsStats.total
      : employee.salary_type === 'monthly' 
        ? employee.base_salary 
        : manualTasks.filter(t => t.status === 'completed').reduce((sum, t) => sum + (t.operating_cost || 0), 0);

  // المدفوع - للفرقة: المبالغ المدفوعة من حساب الفرقة + السلف
  const totalPaid = isLinkedToOperating
    ? operatingStats.totalWithdrawals
    : isLinkedToTeam
      ? teamAccountsStats.paid + advances.filter(a => a.status === 'approved').reduce((sum, a) => sum + ((a.amount || 0) - (a.remaining || 0)), 0)
      : payrollItems.filter(p => p.paid).reduce((sum, p) => sum + (p.net_salary || 0), 0);

  // السلف
  const totalAdvances = advances
    .filter(a => a.status === 'approved')
    .reduce((sum, a) => sum + (a.remaining || 0), 0);

  // الرصيد الصافي
  const netBalance = isLinkedToOperating 
    ? operatingStats.remainingBalance 
    : isLinkedToTeam
      ? teamAccountsStats.pending - totalAdvances
      : totalDue - totalPaid - totalAdvances;

  // Prepare chart data
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - i));
    const month = date.toLocaleString('ar-LY', { month: 'short' });
    
    const tasksInMonth = manualTasks.filter(t => {
      const taskMonth = new Date(t.task_date).getMonth();
      const taskYear = new Date(t.task_date).getFullYear();
      return taskMonth === date.getMonth() && taskYear === date.getFullYear() && t.status === 'completed';
    });
    
    const paymentsInMonth = payrollItems.filter(p => {
      const payMonth = new Date(p.created_at).getMonth();
      const payYear = new Date(p.created_at).getFullYear();
      return payMonth === date.getMonth() && payYear === date.getFullYear() && p.paid;
    });

    return {
      month,
      earned: tasksInMonth.reduce((sum, t) => sum + t.operating_cost, 0),
      paid: paymentsInMonth.reduce((sum, p) => sum + p.net_salary, 0)
    };
  });

  const statusData = [
    { name: 'مكتمل', value: manualTasks.filter(t => t.status === 'completed').length, color: '#10b981' },
    { name: 'معلق', value: manualTasks.filter(t => t.status === 'pending').length, color: '#f59e0b' }
  ];

  const COLORS = ['#10b981', '#f59e0b'];

  return (
    <div className="container mx-auto p-6 space-y-6 text-right" dir="rtl" style={{ fontFamily: "'Tajawal', sans-serif" }}>
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#d6ac40]/12 via-[#f4c25a]/5 to-transparent border border-[#d6ac40]/25 p-6 backdrop-blur-md shadow-sm flex flex-col lg:flex-row items-center justify-between gap-6 transition-all duration-300">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-[#d6ac40]/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-6 -ml-6 w-32 h-32 bg-[#f4c25a]/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/admin/salaries')}
            className="h-10 w-10 rounded-full border border-[#d6ac40]/20 bg-background/50 text-[#b8860b] dark:text-[#f4c25a] hover:bg-[#d6ac40]/15 transition-all duration-200 cursor-pointer shrink-0"
          >
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div className="text-center sm:text-right">
            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">{employee.name}</h1>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
              <Badge className="bg-[#d6ac40]/10 text-[#b8860b] dark:text-[#f4c25a] border border-[#d6ac40]/25 px-3 py-0.5 text-xs font-bold rounded-full">
                {employee.position || 'موظف'}
              </Badge>
              <Badge className={`px-3 py-0.5 text-xs font-bold rounded-full border ${
                employee.status === 'active' 
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25' 
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25'
              }`}>
                {employee.status === 'active' ? 'نشط' : 'غير نشط'}
              </Badge>
              <Badge className={`px-3 py-0.5 text-xs font-bold rounded-full border ${
                employee.salary_type === 'monthly' 
                  ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25' 
                  : 'bg-[#d6ac40]/10 text-[#b8860b] dark:text-[#f4c25a] border-[#d6ac40]/25'
              }`}>
                {employee.salary_type === 'monthly' ? 'راتب شهري' : 'بنظام العمل'}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5 w-full sm:w-auto justify-center lg:justify-end">
          <Button 
            onClick={() => setTaskDialogOpen(true)} 
            className="bg-gradient-to-r from-[#b8860b] to-[#d6ac40] hover:from-[#d6ac40] hover:to-[#f4c25a] text-white hover:shadow-lg hover:shadow-yellow-500/10 rounded-xl transition-all duration-200 cursor-pointer font-bold gap-2"
          >
            <Plus className="h-4 w-4" />
            إضافة عمل يدوي
          </Button>
          {(isLinkedToOperating || isLinkedToTeam) && (
            <Button 
              onClick={() => {
                setPaymentAmount('');
                setPaymentDate(new Date().toISOString().slice(0, 10));
                setPaymentMethod('');
                setPaymentNotes('');
                setReceiverName(employee.name);
                setSenderName('');
                setPaymentDialogOpen(true);
              }} 
              className="bg-[#d6ac40]/10 text-[#b8860b] dark:text-[#f4c25a] hover:bg-[#d6ac40]/20 rounded-xl border border-[#d6ac40]/25 font-bold gap-2 cursor-pointer transition-all duration-200"
            >
              <Wallet className="h-4 w-4" />
              سحب من الحساب
            </Button>
          )}
          <Button 
            onClick={() => {
              setEditingAdvance(null);
              setAdvanceAmount('');
              setAdvanceReason('');
              setAdvanceDialogOpen(true);
            }} 
            variant="outline" 
            className="border-[#d6ac40]/20 hover:bg-[#d6ac40]/5 text-foreground font-bold gap-2 rounded-xl cursor-pointer transition-all duration-200"
          >
            <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            إضافة سلفة
          </Button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative overflow-hidden rounded-2xl border border-[#d6ac40]/15 bg-gradient-to-br from-[#d6ac40]/[0.02] to-[#f4c25a]/[0.01] p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#d6ac40]/10 text-[#b8860b] dark:text-[#f4c25a]">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-bold">نوع الراتب والاحتساب</p>
              <p className="text-sm font-extrabold mt-1 text-foreground">
                {employee.salary_type === 'monthly' ? 'راتب شهري أساسي' : 'نظام إنتاج بالعمل المكتمل'}
              </p>
            </div>
          </div>
        </div>

        {employee.installation_team_id && installationTeam ? (
          <div className="relative overflow-hidden rounded-2xl border border-teal-500/15 bg-gradient-to-br from-teal-500/[0.02] to-emerald-500/[0.02] p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-bold">فرقة التركيب التابعة</p>
                <p className="text-sm font-extrabold mt-1 text-foreground">
                  {installationTeam.team_name}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl border border-border bg-muted/20 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-muted text-muted-foreground">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-bold">فرقة التركيب</p>
                <p className="text-sm font-bold mt-1 text-muted-foreground">غير مرتبطة بفرقة تركيب</p>
              </div>
            </div>
          </div>
        )}

        {employee.linked_to_operating_expenses ? (
          <div className="relative overflow-hidden rounded-2xl border border-[#d6ac40]/20 bg-gradient-to-br from-[#d6ac40]/[0.02] to-[#b8860b]/[0.02] p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#d6ac40]/15 text-[#b8860b] dark:text-[#f4c25a]">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-bold">مستحقات التشغيل</p>
                <p className="text-sm font-extrabold text-[#b8860b] dark:text-[#f4c25a] mt-1">
                  مرتبط بحساب نسبة عقود التشغيل
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl border border-border bg-muted/20 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-muted text-muted-foreground">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-bold">مستحقات التشغيل</p>
                <p className="text-sm font-bold mt-1 text-muted-foreground">غير مرتبط بمصروفات التشغيل</p>
              </div>
            </div>
          </div>
        )}

        <div className="relative overflow-hidden rounded-2xl border border-[#d6ac40]/15 bg-gradient-to-br from-[#d6ac40]/[0.02] to-[#f4c25a]/[0.01] p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#d6ac40]/10 text-[#b8860b] dark:text-[#f4c25a]">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-bold">تاريخ التعيين والتعاقد</p>
              <p className="text-sm font-extrabold mt-1 text-foreground">
                {employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('ar-LY') : '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-[#d6ac40]/25 bg-gradient-to-br from-[#d6ac40]/[0.02] to-[#f4c25a]/[0.01] hover:bg-[#d6ac40]/[0.04] hover:shadow-md hover:scale-[1.01] transition-all duration-300 shadow-sm relative overflow-hidden rounded-2xl">
          <div className="absolute top-0 left-0 w-24 h-24 bg-[#d6ac40]/5 rounded-full blur-xl pointer-events-none -mt-4 -ml-4" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-[#b8860b] dark:text-[#f4c25a]">إجمالي المستحقات</CardTitle>
            <div className="p-1.5 rounded-lg bg-[#d6ac40]/15 text-[#b8860b] dark:text-[#f4c25a]">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-2xl font-black text-[#b8860b] dark:text-[#f4c25a] font-manrope">
              {totalDue.toLocaleString('ar-LY')} <span className="text-xs font-bold">د.ل</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {isLinkedToOperating 
                ? `عن طريق ${operatingStats.totalContracts} عقد تشغيل غير مغلق`
                : isLinkedToTeam
                  ? `عن طريق ${teamAccounts.length} عملية تركيب`
                  : employee.salary_type === 'monthly' ? 'الراتب الشهري الحالي' : 'من الأعمال المنجزة والمكتملة'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.02] to-teal-500/[0.01] hover:bg-emerald-500/[0.04] hover:shadow-md hover:scale-[1.01] transition-all duration-300 shadow-sm relative overflow-hidden rounded-2xl">
          <div className="absolute top-0 left-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none -mt-4 -ml-4" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-emerald-600 dark:text-emerald-400">المدفوع الفعلي</CardTitle>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Wallet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-manrope">
              {totalPaid.toLocaleString('ar-LY')} <span className="text-xs font-bold">د.ل</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {isLinkedToOperating 
                ? `من خلال ${operatingStats.withdrawalsCount} عملية سحب`
                : isLinkedToTeam
                  ? `${teamAccounts.filter((a: any) => a.status === 'paid').length} تركيبة مدفوعة بالكامل`
                  : `من خلال ${payrollItems.filter(p => p.paid).length} دفعة راتب مستلمة`
              }
            </p>
          </CardContent>
        </Card>

        <Card className="border-rose-500/20 bg-gradient-to-br from-rose-500/[0.02] to-red-500/[0.01] hover:bg-rose-500/[0.04] hover:shadow-md hover:scale-[1.01] transition-all duration-300 shadow-sm relative overflow-hidden rounded-2xl">
          <div className="absolute top-0 left-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl pointer-events-none -mt-4 -ml-4" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-rose-600 dark:text-rose-400">السلف المتبقية</CardTitle>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-manrope">
              {totalAdvances.toLocaleString('ar-LY')} <span className="text-xs font-bold">د.ل</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {advances.filter(a => a.status === 'approved' && a.remaining > 0).length} سلفة نشطة قيد التحصيل
            </p>
          </CardContent>
        </Card>

        <Card className="border-[#d6ac40]/30 bg-gradient-to-br from-[#d6ac40]/[0.03] to-[#b8860b]/[0.01] hover:bg-[#d6ac40]/[0.05] hover:shadow-md hover:scale-[1.01] transition-all duration-300 shadow-sm relative overflow-hidden rounded-2xl">
          <div className="absolute top-0 left-0 w-24 h-24 bg-[#d6ac40]/5 rounded-full blur-xl pointer-events-none -mt-4 -ml-4" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-[#b8860b] dark:text-[#f4c25a]">الرصيد الصافي المتبقي</CardTitle>
            <div className="p-1.5 rounded-lg bg-[#d6ac40]/15 text-[#b8860b] dark:text-[#f4c25a]">
              <Activity className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className={`text-2xl font-black font-manrope ${netBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {netBalance.toLocaleString('ar-LY')} <span className="text-xs font-bold">د.ل</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {netBalance >= 0 ? 'مستحقات صافية للموظف في ذمة الشركة' : 'دين مستحق على الموظف لصالح الشركة'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Operating Expenses Section - Show only if linked */}
      {employee.linked_to_operating_expenses && (
        <Card className="relative overflow-hidden border border-[#d6ac40]/25 bg-gradient-to-br from-[#d6ac40]/[0.02] via-transparent to-transparent shadow-sm">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#d6ac40]/5 rounded-full blur-3xl pointer-events-none" />
          <CardHeader className="border-b border-[#d6ac40]/15 pb-4">
            <CardTitle className="flex items-center gap-2.5 text-[#b8860b] dark:text-[#f4c25a] font-bold">
              <div className="p-1.5 rounded-lg bg-[#d6ac40]/15">
                <Wallet className="h-5 w-5" />
              </div>
              إدارة مستحقات التشغيل وعقود المعاملات
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground leading-relaxed">
                هذا الموظف مرتبط بنظام مصروفات التشغيل للشركة. أدناه ملخص سريع لحالة الحساب، ويمكنك إدارة تفاصيل العقود والسحوبات الكاملة وإجراء تسكير الفترة من لوحة التحكم المخصصة.
              </p>
              
              {/* Operating Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#d6ac40]/[0.01] dark:bg-black/20 rounded-xl p-4 border border-[#d6ac40]/15">
                  <p className="text-xs text-muted-foreground font-bold mb-1">إجمالي العقود النشطة</p>
                  <p className="text-2xl font-black text-foreground font-manrope">
                    {operatingStats.totalContracts} <span className="text-xs text-muted-foreground font-normal">عقود</span>
                  </p>
                </div>
                
                <div className="bg-[#d6ac40]/[0.01] dark:bg-black/20 rounded-xl p-4 border border-[#d6ac40]/15">
                  <p className="text-xs text-muted-foreground font-bold mb-1">المجموع العام للنسبة</p>
                  <p className="text-2xl font-black text-[#b8860b] dark:text-[#f4c25a] font-manrope">
                    {operatingStats.totalOperatingFees.toLocaleString('ar-LY')} <span className="text-xs text-muted-foreground font-normal">د.ل</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">المتحصلة من إيجار العقود</p>
                </div>
                
                <div className="bg-[#d6ac40]/[0.01] dark:bg-black/20 rounded-xl p-4 border border-[#d6ac40]/15">
                  <p className="text-xs text-muted-foreground font-bold mb-1">المسحوبات الفعلية</p>
                  <p className="text-2xl font-black text-foreground font-manrope">
                    {operatingStats.totalWithdrawals.toLocaleString('ar-LY')} <span className="text-xs text-muted-foreground font-normal">د.ل</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    خلال {operatingStats.withdrawalsCount} حركة سحب
                  </p>
                </div>
                
                <div className="bg-[#d6ac40]/[0.01] dark:bg-black/20 rounded-xl p-4 border border-[#d6ac40]/15">
                  <p className="text-xs text-muted-foreground font-bold mb-1">الرصيد المتبقي المتاح</p>
                  <p className={`text-2xl font-black font-manrope ${operatingStats.remainingBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {operatingStats.remainingBalance.toLocaleString('ar-LY')} <span className="text-xs font-bold">د.ل</span>
                  </p>
                </div>
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="p-4 rounded-xl bg-[#d6ac40]/[0.01] dark:bg-black/10 border border-[#d6ac40]/10 hover:border-[#d6ac40]/25 hover:bg-[#d6ac40]/[0.03] transition-all cursor-pointer">
                  <div className="flex items-center gap-2 mb-1.5">
                    <FileText className="h-4 w-4 text-[#b8860b] dark:text-[#f4c25a]" />
                    <p className="text-xs font-bold text-foreground">إدارة وتتبع العقود</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">مراجعة وتحليل نسب التشغيل التفصيلية لكل عقد على حدة.</p>
                </div>
                
                <div className="p-4 rounded-xl bg-[#d6ac40]/[0.01] dark:bg-black/10 border border-[#d6ac40]/10 hover:border-[#d6ac40]/25 hover:bg-[#d6ac40]/[0.03] transition-all cursor-pointer">
                  <div className="flex items-center gap-2 mb-1.5">
                    <DollarSign className="h-4 w-4 text-[#b8860b] dark:text-[#f4c25a]" />
                    <p className="text-xs font-bold text-foreground">سجل حركات السحب</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">تسجيل وإدارة عمليات سحب المبالغ النقدية وطباعة الإيصالات.</p>
                </div>
                
                <div className="p-4 rounded-xl bg-[#d6ac40]/[0.01] dark:bg-black/10 border border-[#d6ac40]/10 hover:border-[#d6ac40]/25 hover:bg-[#d6ac40]/[0.03] transition-all cursor-pointer">
                  <div className="flex items-center gap-2 mb-1.5">
                    <CheckCircle className="h-4 w-4 text-[#b8860b] dark:text-[#f4c25a]" />
                    <p className="text-xs font-bold text-foreground">إغلاق الفترة المالي</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">تسكير الحسابات الدورية واعتماد حركات التسكير وحفظ الأرشيف.</p>
                  {closures.length > 0 && closures[0].closure_type === 'contract_range' && (
                    <div className="mt-2.5 p-2 bg-[#d6ac40]/5 dark:bg-[#d6ac40]/10 rounded-lg text-[10px] border border-[#d6ac40]/20">
                      <p className="font-bold text-[#b8860b] dark:text-[#f4c25a]">آخر تسكير عقود:</p>
                      <p className="text-muted-foreground mt-0.5">
                        النطاق: {closures[0].contract_start} - {closures[0].contract_end}
                      </p>
                      <p className="text-[#b8860b] dark:text-[#f4c25a] font-bold mt-0.5">
                        بتاريخ: {new Date(closures[0].closure_date).toLocaleDateString('ar-LY')}
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="p-4 rounded-xl bg-[#d6ac40]/[0.01] dark:bg-black/10 border border-[#d6ac40]/10 hover:border-[#d6ac40]/25 hover:bg-[#d6ac40]/[0.03] transition-all cursor-pointer">
                  <div className="flex items-center gap-2 mb-1.5">
                    <FileText className="h-4 w-4 text-[#b8860b] dark:text-[#f4c25a]" />
                    <p className="text-xs font-bold text-foreground">التقارير والمطابقات</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">استخراج وتصدير كشوفات الحساب المالية وعمل المطابقات الدورية.</p>
                </div>
              </div>
              
              <Button 
                onClick={() => navigate('/admin/expenses')}
                className="w-full bg-gradient-to-r from-[#b8860b] to-[#d6ac40] hover:from-[#d6ac40] hover:to-[#f4c25a] text-white font-bold gap-2 shadow-lg shadow-yellow-500/10 rounded-xl py-6 cursor-pointer transition-all duration-200"
                size="lg"
              >
                <Wallet className="h-5 w-5" />
                فتح صفحة مصروفات التشغيل الكاملة
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Installations & Accounts Section */}
      {employee.installation_team_id && installationTeam && (
        <Card className="relative overflow-hidden border border-blue-500/20 bg-gradient-to-br from-blue-500/[0.02] via-transparent to-transparent shadow-sm">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
          <CardHeader className="border-b border-blue-500/10 pb-4">
            <CardTitle className="flex items-center gap-2.5 text-blue-700 dark:text-blue-400 font-bold">
              <div className="p-1.5 rounded-lg bg-blue-500/10">
                <Wrench className="h-5 w-5" />
              </div>
              حسابات وإيرادات فرقة التركيب - {installationTeam.team_name}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {/* Team Account Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-500/[0.01] dark:bg-black/20 rounded-xl p-4 border border-blue-500/10">
                  <p className="text-xs text-muted-foreground font-semibold mb-1">إجمالي مستحقات التركيبات</p>
                  <p className="text-2xl font-black text-foreground font-manrope">
                    {teamAccountsStats.total.toLocaleString('ar-LY')} <span className="text-xs text-muted-foreground font-normal">د.ل</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">عن عدد {teamAccounts.length} لوحة تركيب مضافة</p>
                </div>
                
                <div className="bg-amber-500/[0.01] dark:bg-black/20 rounded-xl p-4 border border-amber-500/10">
                  <p className="text-xs text-muted-foreground font-semibold mb-1">المعلق قيد الدفع</p>
                  <p className="text-2xl font-black text-amber-600 dark:text-amber-400 font-manrope">
                    {teamAccountsStats.pending.toLocaleString('ar-LY')} <span className="text-xs text-muted-foreground font-normal">د.ل</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    عدد {teamAccounts.filter(a => a.status === 'pending').length} تركيبات لم تسوّ بعد
                  </p>
                </div>
                
                <div className="bg-emerald-500/[0.01] dark:bg-black/20 rounded-xl p-4 border border-emerald-500/10">
                  <p className="text-xs text-muted-foreground font-semibold mb-1">المدفوع الفعلي للفرقة</p>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-manrope">
                    {teamAccountsStats.paid.toLocaleString('ar-LY')} <span className="text-xs text-muted-foreground font-normal">د.ل</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1 font-semibold text-emerald-600/80">
                    عدد {teamAccounts.filter(a => a.status === 'paid').length} تركيبات مدفوعة
                  </p>
                </div>
              </div>

              {/* Combined Report: Earnings vs Withdrawals */}
              <div className="bg-blue-500/5 dark:bg-blue-500/10 rounded-xl p-5 border border-blue-500/20 backdrop-blur-sm">
                <h4 className="text-sm font-bold text-blue-700 dark:text-blue-400 mb-4 flex items-center gap-2">
                  <Activity className="h-4 w-4 animate-pulse" />
                  التقرير المالي المشترك للفرقة
                </h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-semibold">إيرادات الفرقة</p>
                    <p className="text-lg font-black text-blue-600 dark:text-blue-400 font-manrope">
                      {teamAccountsStats.total.toLocaleString('ar-LY')} <span className="text-[10px] font-normal text-muted-foreground">د.ل</span>
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-semibold">السحوبات + السلف</p>
                    <p className="text-lg font-black text-rose-600 dark:text-rose-400 font-manrope">
                      {(totalPaid + totalAdvances).toLocaleString('ar-LY')} <span className="text-[10px] font-normal text-muted-foreground">د.ل</span>
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-semibold">الصافي المتبقي</p>
                    <p className={`text-lg font-black font-manrope ${(teamAccountsStats.pending - totalAdvances) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {(teamAccountsStats.pending - totalAdvances).toLocaleString('ar-LY')} <span className="text-[10px] font-normal text-muted-foreground">د.ل</span>
                    </p>
                  </div>
                </div>
              </div>

              <Button 
                onClick={() => navigate('/admin/installation-team-accounts')}
                className="w-full bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white font-bold gap-2 shadow-lg shadow-blue-500/10 rounded-xl py-5"
                size="lg"
              >
                <Wrench className="h-5 w-5" />
                فتح صفحة حسابات فرق التركيب
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-border/50 bg-card shadow-sm">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              الأرباح والمستحقات المكتسبة مقابل المدفوعات (آخر 6 أشهر)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEarned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.85}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.15}/>
                  </linearGradient>
                  <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.85}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.15}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/40" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} 
                  axisLine={false} 
                  tickLine={false} 
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} 
                  axisLine={false} 
                  tickLine={false} 
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="earned" name="المكتسب" fill="url(#colorEarned)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="paid" name="المدفوع" fill="url(#colorPaid)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card shadow-sm">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
              <PieChart className="h-4 w-4 text-blue-500" />
              توزيع ونسب حالة الأعمال اليدوية
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 flex items-center justify-center">
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={90}
                  innerRadius={60}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="stroke-background" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </RechartsPieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={employee.installation_team_id ? "team_accounts" : "tasks"} className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1.5 bg-muted/65 p-1 rounded-xl border border-border/50">
          <TabsTrigger 
            value="tasks" 
            className="rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm px-4 py-2 text-xs font-bold transition-all"
          >
            الأعمال اليدوية
          </TabsTrigger>
          <TabsTrigger 
            value="advances" 
            className="rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm px-4 py-2 text-xs font-bold transition-all"
          >
            السلف والخصومات
          </TabsTrigger>
          <TabsTrigger 
            value="payments" 
            className="rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm px-4 py-2 text-xs font-bold transition-all"
          >
            سجل مدفوعات الرواتب
          </TabsTrigger>
          {isLinkedToOperating && (
            <>
              <TabsTrigger 
                value="withdrawals" 
                className="rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm px-4 py-2 text-xs font-bold transition-all"
              >
                سحوبات التشغيل
              </TabsTrigger>
              <TabsTrigger 
                value="closures" 
                className="rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm px-4 py-2 text-xs font-bold transition-all"
              >
                سجل التسكيرات
              </TabsTrigger>
            </>
          )}
          {employee.installation_team_id && (
            <TabsTrigger 
              value="team_accounts" 
              className="rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm px-4 py-2 text-xs font-bold transition-all"
            >
              تركيبات الفرقة
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="tasks" className="mt-4 focus-visible:outline-none">
          <Card className="border-border/50 bg-card shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
                <div className="p-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <FileText className="h-4 w-4" />
                </div>
                سجل الأعمال المنجزة واليدوية
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="hover:bg-transparent border-b border-border/50">
                      <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">الوصف والبيان</TableHead>
                      <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">تاريخ الإنجاز</TableHead>
                      <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">تكلفة التشغيل</TableHead>
                      <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">حالة الاعتماد</TableHead>
                      <TableHead className="text-left text-xs font-bold text-muted-foreground/80 py-3 pl-6">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {manualTasks.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-10 text-xs">
                          لا توجد أعمال يدوية مسجلة لهذا الموظف
                        </TableCell>
                      </TableRow>
                    ) : (
                      manualTasks.map((task) => (
                        <TableRow key={task.id} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                          <TableCell className="font-medium text-xs py-3.5">
                            <span className="text-foreground font-semibold">{task.task_description}</span>
                            {task.notes && (
                              <p className="text-[10px] text-muted-foreground mt-1 bg-muted/40 p-1.5 rounded-md inline-block">{task.notes}</p>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground py-3.5">
                            {new Date(task.task_date).toLocaleDateString('ar-LY')}
                          </TableCell>
                          <TableCell className="font-bold text-xs py-3.5 font-manrope">
                            {task.operating_cost.toLocaleString('ar-LY')} د.ل
                          </TableCell>
                          <TableCell className="py-3.5">
                            <Badge className={`px-2.5 py-0.5 text-[10px] font-semibold rounded-full border ${
                              task.status === 'completed' 
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25' 
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                            }`}>
                              {task.status === 'completed' ? 'مكتمل ومعتمد' : 'معلق'}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3.5 pl-6">
                            <div className="flex items-center gap-1">
                              {task.status !== 'completed' && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                  onClick={() => handleMarkTaskComplete(task.id)}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 rounded-lg transition-colors"
                                onClick={() => handleDeleteTask(task.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdrawals" className="mt-4 focus-visible:outline-none">
          <Card className="border-border/50 bg-card shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
                <div className="p-1 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
                  <DollarSign className="h-4 w-4" />
                </div>
                سجل حركات سحوبات التشغيل
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="hover:bg-transparent border-b border-border/50">
                      <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">تاريخ الحركة</TableHead>
                      <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">المبلغ المسحوب</TableHead>
                      <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">طريقة السحب</TableHead>
                      <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">البيان / الملاحظة</TableHead>
                      <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">المستلم / المسلم</TableHead>
                      <TableHead className="text-left text-xs font-bold text-muted-foreground/80 py-3 pl-6">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-10 text-xs">
                          لا توجد مسحوبات مسجلة لهذا الحساب
                        </TableCell>
                      </TableRow>
                    ) : (
                      withdrawals.map((withdrawal) => (
                        <TableRow key={withdrawal.id} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                          <TableCell className="text-xs font-medium py-3.5">
                            {new Date(withdrawal.date).toLocaleDateString('ar-LY')}
                          </TableCell>
                          <TableCell className="font-bold text-xs py-3.5 text-foreground font-manrope">
                            {withdrawal.amount.toLocaleString('ar-LY')} د.ل
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground py-3.5">
                            <Badge variant="outline" className="px-2 py-0.5 rounded-md text-[10px] bg-slate-50 dark:bg-slate-900 border-slate-200">
                              {withdrawal.method || 'نقدي'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-foreground py-3.5 max-w-[200px] truncate">
                            {withdrawal.note || '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground py-3.5">
                            {withdrawal.receiver_name && withdrawal.sender_name
                              ? `${withdrawal.receiver_name} / ${withdrawal.sender_name}`
                              : withdrawal.receiver_name 
                                ? withdrawal.receiver_name 
                                : withdrawal.sender_name 
                                  ? `— / ${withdrawal.sender_name}` 
                                  : 'سحب غير محدد الاسم (محتسب)'
                            }
                          </TableCell>
                          <TableCell className="py-3.5 pl-6">
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-500/10 rounded-lg transition-colors"
                                onClick={() => {
                                  setEditingWithdrawal(withdrawal);
                                  setPaymentAmount(withdrawal.amount.toString());
                                  setPaymentDate(withdrawal.date);
                                  setPaymentMethod(withdrawal.method || '');
                                  setPaymentNotes(withdrawal.note || '');
                                  setReceiverName(withdrawal.receiver_name || '');
                                  setSenderName(withdrawal.sender_name || '');
                                  setWithdrawalDialogOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-500/10 rounded-lg transition-colors"
                                onClick={() => {
                                  setSelectedWithdrawal(withdrawal);
                                  setReceiptDialogOpen(true);
                                }}
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 rounded-lg transition-colors"
                                onClick={async () => {
                                  if (!await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذا السحب؟', variant: 'destructive', confirmText: 'حذف' })) return;
                                  try {
                                    await supabase
                                      .from('expenses_withdrawals')
                                      .delete()
                                      .eq('id', withdrawal.id);
                                    toast.success('تم حذف السحب بنجاح');
                                    loadEmployeeData();
                                  } catch (error) {
                                    toast.error('فشل في حذف السحب');
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="closures" className="mt-4 focus-visible:outline-none">
          <Card className="border-border/50 bg-card shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
                <div className="p-1 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
                  <Calendar className="h-4 w-4" />
                </div>
                سجل إغلاقات وتسكيرات الفترات
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="hover:bg-transparent border-b border-border/50">
                      <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">تاريخ التسكير</TableHead>
                      <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">نوع التسكير</TableHead>
                      <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">نطاق التسكير</TableHead>
                      <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">عدد العقود</TableHead>
                      <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">إجمالي المبلغ</TableHead>
                      <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">المسحوب</TableHead>
                      <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">المتبقي</TableHead>
                      <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">الملاحظات</TableHead>
                      <TableHead className="text-left text-xs font-bold text-muted-foreground/80 py-3 pl-6">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {closures.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-10 text-xs">
                          لا توجد تسكيرات مسجلة حالياً
                        </TableCell>
                      </TableRow>
                    ) : (
                      closures.map((closure) => (
                        <TableRow key={closure.id} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                          <TableCell className="text-xs font-medium py-3.5">
                            {new Date(closure.closure_date).toLocaleDateString('ar-LY')}
                          </TableCell>
                          <TableCell className="py-3.5">
                            <Badge className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
                              closure.closure_type === 'period' 
                                ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' 
                                : 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20'
                            }`}>
                              {closure.closure_type === 'period' ? 'فترة زمنية' : 'نطاق عقود'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground py-3.5 font-manrope">
                            {closure.closure_type === 'period' && closure.period_start && closure.period_end ? 
                              `${new Date(closure.period_start).toLocaleDateString('ar-LY')} - ${new Date(closure.period_end).toLocaleDateString('ar-LY')}` :
                              closure.closure_type === 'contract_range' && closure.contract_start && closure.contract_end ?
                              `العقود: ${closure.contract_start} - ${closure.contract_end}` :
                              '—'
                            }
                          </TableCell>
                          <TableCell className="text-xs text-foreground py-3.5 font-manrope">{closure.total_contracts}</TableCell>
                          <TableCell className="text-xs font-bold text-foreground py-3.5 font-manrope">{closure.total_amount.toLocaleString('ar-LY')} د.ل</TableCell>
                          <TableCell className="text-xs text-muted-foreground py-3.5 font-manrope">{closure.total_withdrawn.toLocaleString('ar-LY')} د.ل</TableCell>
                          <TableCell className="text-xs font-bold text-emerald-600 dark:text-emerald-400 py-3.5 font-manrope">{closure.remaining_balance.toLocaleString('ar-LY')} د.ل</TableCell>
                          <TableCell className="text-xs text-muted-foreground py-3.5 max-w-[150px] truncate">{closure.notes || '—'}</TableCell>
                          <TableCell className="py-3.5 pl-6">
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-500/10 rounded-lg transition-colors"
                                onClick={() => {
                                  setEditingClosure(closure);
                                  setClosureDialogOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 rounded-lg transition-colors"
                                onClick={async () => {
                                  if (!await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذا التسكير؟', variant: 'destructive', confirmText: 'حذف' })) return;
                                  try {
                                    await supabase
                                      .from('period_closures')
                                      .delete()
                                      .eq('id', closure.id);
                                    toast.success('تم حذف التسكير بنجاح');
                                    loadEmployeeData();
                                  } catch (error) {
                                    toast.error('فشل في حذف التسكير');
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-4 focus-visible:outline-none">
          <Card className="border-border/50 bg-card shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
                <div className="p-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Wallet className="h-4 w-4" />
                </div>
                سجل عمليات سداد الرواتب
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="hover:bg-transparent border-b border-border/50">
                      <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">تاريخ الاستحقاق</TableHead>
                      <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">الراتب الأساسي</TableHead>
                      <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">البدلات المضافة</TableHead>
                      <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">الخصومات والسلف</TableHead>
                      <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">صافي الراتب المستلم</TableHead>
                      <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollItems.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-10 text-xs">
                          لا توجد عمليات سداد رواتب مسجلة
                        </TableCell>
                      </TableRow>
                    ) : (
                      payrollItems.map((item) => (
                        <TableRow key={item.id} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                          <TableCell className="text-xs font-medium py-3.5">
                            {new Date(item.created_at).toLocaleDateString('ar-LY')}
                          </TableCell>
                          <TableCell className="text-xs font-medium py-3.5 font-manrope">{item.basic_salary.toLocaleString('ar-LY')} د.ل</TableCell>
                          <TableCell className="text-xs text-emerald-600 py-3.5 font-manrope">+{item.allowances.toLocaleString('ar-LY')} د.ل</TableCell>
                          <TableCell className="text-xs text-rose-600 py-3.5 font-manrope">-{item.deductions.toLocaleString('ar-LY')} د.ل</TableCell>
                          <TableCell className="font-bold text-xs py-3.5 text-foreground font-manrope">
                            {item.net_salary.toLocaleString('ar-LY')} د.ل
                          </TableCell>
                          <TableCell className="py-3.5">
                            <Badge className={`px-2.5 py-0.5 text-[10px] font-semibold rounded-full border ${
                              item.paid 
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25' 
                                : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/25'
                            }`}>
                              {item.paid ? 'تم الدفع والاستلام' : 'معلق'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advances" className="mt-4 focus-visible:outline-none">
          <Card className="border-border/50 bg-card shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-border/50 pb-4 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
                <div className="p-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <DollarSign className="h-4 w-4" />
                </div>
                سجل السلف المالية والخصومات والذمم
              </CardTitle>
              <div className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-3 py-1 rounded-full text-xs font-bold font-manrope">
                إجمالي السلف المتبقية: {totalAdvances.toLocaleString('ar-LY')} د.ل
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="hover:bg-transparent border-b border-border/50">
                      <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">تاريخ الطلب</TableHead>
                      <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">مبلغ السلفة</TableHead>
                      <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">المتبقي المطلوب</TableHead>
                      <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">السبب والبيان</TableHead>
                      <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">حالة السلفة</TableHead>
                      <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">مصدر التسجيل</TableHead>
                      <TableHead className="text-left text-xs font-bold text-muted-foreground/80 py-3 pl-6">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {advances.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-10 text-xs">
                          لا توجد سلف مسجلة على هذا الموظف
                        </TableCell>
                      </TableRow>
                    ) : (
                      advances.map((advance: any) => (
                        <TableRow key={advance.id} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                          <TableCell className="text-xs font-medium py-3.5">
                            {new Date(advance.request_date).toLocaleDateString('ar-LY')}
                          </TableCell>
                          <TableCell className="text-xs font-bold text-foreground py-3.5 font-manrope">{advance.amount.toLocaleString('ar-LY')} د.ل</TableCell>
                          <TableCell className={`text-xs font-bold py-3.5 font-manrope ${advance.remaining > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {advance.remaining.toLocaleString('ar-LY')} د.ل
                          </TableCell>
                          <TableCell className="text-xs text-foreground py-3.5 max-w-[180px] truncate">{advance.reason || '-'}</TableCell>
                          <TableCell className="py-3.5">
                            <Badge className={`px-2.5 py-0.5 text-[10px] font-semibold rounded-full border ${
                              advance.status === 'approved' 
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25' 
                                : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/25'
                            }`}>
                              {advance.status === 'approved' ? 'معتمد ومقبول' : advance.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3.5 text-right">
                            <Badge className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border ${
                              advance.distributed_payment_id 
                                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25' 
                                : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/25'
                            }`}>
                              {advance.distributed_payment_id ? 'دفعة موزعة تلقائية' : 'تسجيل يدوي'}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3.5 pl-6">
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-500/10 rounded-lg transition-colors"
                                onClick={() => {
                                  setEditingAdvance(advance);
                                  setAdvanceAmount(advance.amount.toString());
                                  setAdvanceReason(advance.reason || '');
                                  setAdvanceDialogOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 rounded-lg transition-colors"
                                onClick={async () => {
                                  if (!await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذه السلفة؟', variant: 'destructive', confirmText: 'حذف' })) return;
                                  try {
                                    await supabase
                                      .from('employee_advances')
                                      .delete()
                                      .eq('id', advance.id);
                                    toast.success('تم حذف السلفة بنجاح');
                                    loadEmployeeData();
                                  } catch (error) {
                                    toast.error('فشل في حذف السلفة');
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {employee.installation_team_id && (
          <TabsContent value="team_accounts" className="mt-4 focus-visible:outline-none">
            <Card className="border-border/50 bg-card shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-border/50 pb-4">
                <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <div className="p-1 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
                    <Wrench className="h-4 w-4" />
                  </div>
                  تركيبات اللوحات للفرقة ({teamAccounts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow className="hover:bg-transparent border-b border-border/50">
                        <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">اسم اللوحة</TableHead>
                        <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">المقاس</TableHead>
                        <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">عقد التركيب</TableHead>
                        <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">تاريخ التركيب الفعلي</TableHead>
                        <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">مبلغ عمولة التركيب</TableHead>
                        <TableHead className="text-right text-xs font-bold text-muted-foreground/80 py-3">حالة السداد</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamAccounts.length === 0 ? (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-10 text-xs">
                            لا توجد تركيبات مسجلة للفرقة حالياً
                          </TableCell>
                        </TableRow>
                      ) : (
                        teamAccounts.map((account: any) => (
                          <TableRow key={account.id} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                            <TableCell className="font-semibold text-xs py-3.5">
                              {account.billboard?.Billboard_Name || `لوحة #${account.billboard_id}`}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground py-3.5 font-manrope">{account.billboard?.Size || '-'}</TableCell>
                            <TableCell className="font-bold text-xs py-3.5 text-blue-600 dark:text-blue-400 font-manrope">#{account.contract_id}</TableCell>
                            <TableCell className="text-xs text-muted-foreground py-3.5">
                              {account.installation_date
                                ? new Date(account.installation_date).toLocaleDateString('ar-LY')
                                : '-'}
                            </TableCell>
                            <TableCell className="font-bold text-xs py-3.5 text-foreground font-manrope">
                              {(Number(account.amount) || 0).toLocaleString('ar-LY')} د.ل
                            </TableCell>
                            <TableCell className="py-3.5">
                              <Badge className={`px-2.5 py-0.5 text-[10px] font-semibold rounded-full border ${
                                account.status === 'paid' 
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25' 
                                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                              }`}>
                                {account.status === 'paid' ? 'مدفوع' : 'معلق'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Add Task Dialog */}
      <UIDialog.Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>إضافة عمل يدوي</UIDialog.DialogTitle>
          </UIDialog.DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">وصف العمل *</label>
              <Textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="أدخل وصف العمل"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">التاريخ *</label>
                <Input
                  type="date"
                  value={taskDate}
                  onChange={(e) => setTaskDate(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">تكلفة التشغيل *</label>
                <Input
                  type="number"
                  value={operatingCost}
                  onChange={(e) => setOperatingCost(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">ملاحظات</label>
              <Textarea
                value={taskNotes}
                onChange={(e) => setTaskNotes(e.target.value)}
                placeholder="أدخل ملاحظات إضافية (اختياري)"
                rows={2}
              />
            </div>
          </div>

          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleAddTask}>
              إضافة العمل
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* Payment Dialog */}
      <UIDialog.Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>
              {employee?.installation_team_id ? 'سحب من مستحقات الفرقة' : employee?.linked_to_operating_expenses ? 'تسجيل سحب جديد' : 'دفع للموظف'}
            </UIDialog.DialogTitle>
          </UIDialog.DialogHeader>

          <div className="grid gap-4 py-4">
            {/* عرض الرصيد المتاح */}
            {(employee?.linked_to_operating_expenses || employee?.installation_team_id) && (
              <div className="rounded-lg border p-3 bg-muted/50">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">الرصيد المتاح للسحب:</span>
                  <span className={`font-bold text-lg ${netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {Math.round(netBalance).toLocaleString('ar-LY')} د.ل
                  </span>
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <label className="text-sm font-medium">المبلغ (د.ل) *</label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                max={netBalance > 0 ? netBalance : undefined}
              />
              {paymentAmount && parseFloat(paymentAmount) > netBalance && netBalance > 0 && (
                <p className="text-xs text-destructive">المبلغ يتجاوز الرصيد المتاح</p>
              )}
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">التاريخ *</label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            {(employee?.linked_to_operating_expenses || employee?.installation_team_id) && (
              <>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">طريقة السحب</label>
                  <Input
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    placeholder="نقدي، تحويل بنكي، شيك..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">اسم المستلم</label>
                    <Input
                      value={receiverName}
                      onChange={(e) => setReceiverName(e.target.value)}
                      placeholder="اسم المستلم"
                    />
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium">اسم المسلم</label>
                    <Input
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="اسم المسلم"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="grid gap-2">
              <label className="text-sm font-medium">ملاحظات</label>
              <Textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="أدخل أي ملاحظات إضافية"
                rows={3}
              />
            </div>
          </div>

          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handlePayment}>
              حفظ السحب
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* Receipt Print Dialog */}
      {selectedWithdrawal && (
        <ExpenseReceiptPrintDialog
          open={receiptDialogOpen}
          onOpenChange={setReceiptDialogOpen}
          expense={{
            ...selectedWithdrawal,
            description: 'سحب من مستحقات نسبة العقود',
            expense_date: selectedWithdrawal.date,
            category: 'مستحقات نسبة العقود',
            payment_method: selectedWithdrawal.method || '',
            notes: selectedWithdrawal.note || '',
            receipt_number: `W-${selectedWithdrawal.id.toString().substring(0, 8)}`
          }}
        />
      )}

      {/* Edit Withdrawal Dialog */}
      <UIDialog.Dialog open={withdrawalDialogOpen} onOpenChange={(open) => {
        setWithdrawalDialogOpen(open);
        if (!open) {
          setEditingWithdrawal(null);
          setPaymentAmount('');
          setPaymentDate(new Date().toISOString().slice(0, 10));
          setPaymentMethod('');
          setPaymentNotes('');
          setReceiverName('');
          setSenderName('');
        }
      }}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>تعديل السحب</UIDialog.DialogTitle>
          </UIDialog.DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">المبلغ (د.ل) *</label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">التاريخ *</label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">طريقة السحب</label>
              <Input
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                placeholder="نقدي، تحويل بنكي، شيك..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">اسم المستلم</label>
                <Input
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  placeholder="اسم المستلم"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">اسم المسلم</label>
                <Input
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="اسم المسلم"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">ملاحظات</label>
              <Textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="أدخل أي ملاحظات إضافية"
                rows={3}
              />
            </div>
          </div>

          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={() => {
              setWithdrawalDialogOpen(false);
              setEditingWithdrawal(null);
            }}>
              إلغاء
            </Button>
            <Button onClick={handleEditWithdrawal}>
              حفظ التعديلات
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* Add/Edit Advance Dialog */}
      <UIDialog.Dialog open={advanceDialogOpen} onOpenChange={(open) => {
        setAdvanceDialogOpen(open);
        if (!open) {
          setEditingAdvance(null);
          setAdvanceAmount('');
          setAdvanceReason('');
        }
      }}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>{editingAdvance ? 'تعديل السلفة' : 'إضافة سلفة جديدة'}</UIDialog.DialogTitle>
          </UIDialog.DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">المبلغ (د.ل) *</label>
              <Input
                type="number"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">السبب</label>
              <Textarea
                value={advanceReason}
                onChange={(e) => setAdvanceReason(e.target.value)}
                placeholder="سبب السلفة"
                rows={2}
              />
            </div>
          </div>

          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={() => {
              setAdvanceDialogOpen(false);
              setEditingAdvance(null);
            }}>
              إلغاء
            </Button>
            <Button onClick={async () => {
              if (!advanceAmount || parseFloat(advanceAmount) <= 0) {
                toast.error('يرجى إدخال مبلغ صحيح');
                return;
              }
              try {
                const newAmount = parseFloat(advanceAmount);
                if (editingAdvance) {
                  const diff = newAmount - editingAdvance.amount;
                  const newRemaining = Math.max(0, editingAdvance.remaining + diff);
                  await supabase
                    .from('employee_advances')
                    .update({
                      amount: newAmount,
                      remaining: newRemaining,
                      reason: advanceReason || null
                    })
                    .eq('id', editingAdvance.id);
                  toast.success('تم تعديل السلفة بنجاح');
                } else {
                  await supabase
                    .from('employee_advances')
                    .insert({
                      employee_id: id,
                      amount: newAmount,
                      remaining: newAmount,
                      reason: advanceReason || null,
                      status: 'approved',
                      request_date: new Date().toISOString().slice(0, 10)
                    });
                  toast.success('تم إضافة السلفة بنجاح');
                }
                setAdvanceDialogOpen(false);
                setEditingAdvance(null);
                setAdvanceAmount('');
                setAdvanceReason('');
                loadEmployeeData();
              } catch (error) {
                toast.error('فشل في حفظ السلفة');
              }
            }}>
              {editingAdvance ? 'حفظ التعديلات' : 'إضافة السلفة'}
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* Edit Closure Dialog */}
      <UIDialog.Dialog open={closureDialogOpen} onOpenChange={(open) => {
        setClosureDialogOpen(open);
        if (!open) setEditingClosure(null);
      }}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>تعديل التسكير</UIDialog.DialogTitle>
          </UIDialog.DialogHeader>

          {editingClosure && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">تاريخ التسكير</label>
                <Input
                  type="date"
                  value={editingClosure.closure_date}
                  onChange={(e) => setEditingClosure({ ...editingClosure, closure_date: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">نوع التسكير</label>
                <Badge variant="secondary">
                  {editingClosure.closure_type === 'contract_range' ? 'نطاق عقود' : 'فترة زمنية'}
                </Badge>
              </div>

              {editingClosure.closure_type === 'contract_range' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">من عقد رقم</label>
                    <Input
                      type="number"
                      value={editingClosure.contract_start || ''}
                      onChange={(e) => setEditingClosure({ ...editingClosure, contract_start: Number(e.target.value) })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">إلى عقد رقم</label>
                    <Input
                      type="number"
                      value={editingClosure.contract_end || ''}
                      onChange={(e) => setEditingClosure({ ...editingClosure, contract_end: Number(e.target.value) })}
                    />
                  </div>
                </div>
              )}

              {editingClosure.closure_type === 'period' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">من تاريخ</label>
                    <Input
                      type="date"
                      value={editingClosure.period_start || ''}
                      onChange={(e) => setEditingClosure({ ...editingClosure, period_start: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">إلى تاريخ</label>
                    <Input
                      type="date"
                      value={editingClosure.period_end || ''}
                      onChange={(e) => setEditingClosure({ ...editingClosure, period_end: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <div className="grid gap-2">
                <label className="text-sm font-medium">ملاحظات</label>
                <Textarea
                  value={editingClosure.notes || ''}
                  onChange={(e) => setEditingClosure({ ...editingClosure, notes: e.target.value })}
                  placeholder="ملاحظات إضافية"
                  rows={3}
                />
              </div>
            </div>
          )}

          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={() => {
              setClosureDialogOpen(false);
              setEditingClosure(null);
            }}>
              إلغاء
            </Button>
            <Button onClick={async () => {
              if (!editingClosure) return;
              try {
                const { error } = await supabase
                  .from('period_closures')
                  .update({
                    closure_date: editingClosure.closure_date,
                    contract_start: editingClosure.contract_start,
                    contract_end: editingClosure.contract_end,
                    period_start: editingClosure.period_start,
                    period_end: editingClosure.period_end,
                    notes: editingClosure.notes
                  })
                  .eq('id', editingClosure.id);
                
                if (error) throw error;
                toast.success('تم تعديل التسكير بنجاح');
                setClosureDialogOpen(false);
                setEditingClosure(null);
                loadEmployeeData();
              } catch (error) {
                toast.error('فشل في تعديل التسكير');
              }
            }}>
              حفظ التعديلات
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>
    </div>
  );
}
