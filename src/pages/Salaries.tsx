import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import * as UIDialog from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Wallet, Plus, Edit, Trash2, DollarSign, Calendar, User, Users, FileText, CheckCircle, XCircle, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  employee?: Employee;
}

interface InstallationTeam {
  id: string;
  team_name: string;
}

interface PayrollRun {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  paid_at: string | null;
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
  employee?: Employee;
}

// Helper: format date as dd/MM/yyyy Gregorian
function fmtDate(d: string | null | undefined): string {
  if (!d) return '-';
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch { return d; }
}

export default function Salaries() {
  const { canEdit: canEditAuth } = useAuth();
  const canEditSection = canEditAuth('salaries');
  const navigate = useNavigate();
  const { confirm: systemConfirm } = useSystemDialog();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [payrollItems, setPayrollItems] = useState<PayrollItem[]>([]);
  const [installationTeams, setInstallationTeams] = useState<InstallationTeam[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [manualTasks, setManualTasks] = useState<ManualTask[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Operating expenses data for linked employee
  const [operatingExpenses, setOperatingExpenses] = useState<any[]>([]);
  const [operatingWithdrawals, setOperatingWithdrawals] = useState<any[]>([]);
  const [operatingStats, setOperatingStats] = useState({
    totalExpenses: 0,
    totalWithdrawals: 0,
    totalRevenue: 0,
    remainingBalance: 0
  });
  // Installation team earnings per team_id
  const [teamEarnings, setTeamEarnings] = useState<Record<string, number>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payrollDialogOpen, setPayrollDialogOpen] = useState(false);
  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [baseSalary, setBaseSalary] = useState('');
  const [hireDate, setHireDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState('active');
  const [salaryType, setSalaryType] = useState('monthly');
  const [installationTeamId, setInstallationTeamId] = useState<string>('none');
  const [linkedToOperatingExpenses, setLinkedToOperatingExpenses] = useState(false);
  
  // Manual task states
  const [selectedEmployeeForTask, setSelectedEmployeeForTask] = useState<string>('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDate, setTaskDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [operatingCost, setOperatingCost] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  
  // Payroll states
  const [periodStart, setPeriodStart] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().slice(0, 10);
  });
  const [periodEnd, setPeriodEnd] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    date.setDate(0);
    return date.toISOString().slice(0, 10);
  });

  // Advance states
  const [selectedEmployeeForAdvance, setSelectedEmployeeForAdvance] = useState<string>('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceReason, setAdvanceReason] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadOperatingExpensesData = async () => {
    try {
      // Load withdrawals
      const { data: withdrawalsData, error: wError } = await supabase
        .from('expenses_withdrawals')
        .select('*')
        .order('date', { ascending: false });

      if (!wError && withdrawalsData) {
        setOperatingWithdrawals(withdrawalsData);
      }

      // Calculate total withdrawals
      const totalWithdrawals = (withdrawalsData || [])
        .reduce((sum, w) => sum + (Number(w.amount) || 0), 0);

      // Load closures
      const { data: closuresData } = await supabase
        .from('period_closures')
        .select('*')
        .order('closure_date', { ascending: false });

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

      // دالة للتحقق إذا كان العقد مغطى بتسكير
      const isContractCoveredByClosure = (contractNumber: number): boolean => {
        if (!closuresData || closuresData.length === 0) return false;
        return closuresData.some((closure: any) => {
          if (closure.closure_type === 'contract_range') {
            const start = Number(closure.contract_start) || 0;
            const end = Number(closure.contract_end) || 0;
            return contractNumber >= start && contractNumber <= end;
          }
          return false;
        });
      };

      // Get contracts with operating fee
      const { data: contractsData } = await supabase
        .from('Contract')
        .select('Contract_Number, "Total Rent", installation_cost, print_cost, operating_fee_rate');

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

      // فلترة العقود غير المغطاة بالتسكير وغير المستبعدة
      const uncoveredContracts = (contractsData || []).filter(c => {
        const contractNum = c.Contract_Number;
        const isExcluded = excludedSet.has(String(contractNum));
        const isClosed = isContractCoveredByClosure(contractNum);
        return !isExcluded && !isClosed;
      });

      // ✅ حساب النسبة المتحصلة فعلياً من سعر الإيجار فقط
      const totalOperatingFees = uncoveredContracts.reduce((sum, c) => {
        const feeRate = Number(c.operating_fee_rate) || 0;
        const rentCost = Number(c['Total Rent']) || 0;
        const installCost = Number(c.installation_cost) || 0;
        const printCost = Number(c.print_cost) || 0;
        const totalAmount = rentCost + installCost + printCost;
        const totalPaid = paidByContract[String(c.Contract_Number)] || 0;
        const rentPaidEstimate = totalAmount > 0 ? totalPaid * (rentCost / totalAmount) : 0;
        const collectedFeeAmount = Math.round(rentPaidEstimate * (feeRate / 100));
        return sum + collectedFeeAmount;
      }, 0);

      const contractsCount = uncoveredContracts.length;

      // Calculate remaining balance
      const remainingBalance = totalOperatingFees - totalWithdrawals;

      setOperatingStats({
        totalExpenses: 0,
        totalWithdrawals,
        totalRevenue: totalOperatingFees,
        remainingBalance
      });
      
      // Store contracts count for display
      setOperatingExpenses([{ count: contractsCount }] as any);
    } catch (error) {
      console.error('Error loading operating expenses data:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load employees
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false });

      if (employeesError) {
        console.error('خطأ في تحميل الموظفين:', employeesError);
        toast.error('فشل في تحميل الموظفين');
      } else {
        setEmployees(employeesData || []);
      }
      
      // Load operating expenses data
      await loadOperatingExpensesData();

      // Load installation teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('installation_teams')
        .select('*')
        .order('team_name', { ascending: true });

      if (!teamsError && teamsData) {
        setInstallationTeams(teamsData);
      }

      // Load installation team account totals
      const { data: teamAccountsData } = await supabase
        .from('installation_team_accounts')
        .select('team_id, amount');
      
      if (teamAccountsData) {
        const earningsMap: Record<string, number> = {};
        teamAccountsData.forEach((row: any) => {
          const tid = row.team_id;
          earningsMap[tid] = (earningsMap[tid] || 0) + (Number(row.amount) || 0);
        });
        setTeamEarnings(earningsMap);
      }

      // Load payroll runs
      const { data: payrollData, error: payrollError } = await supabase
        .from('payroll_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!payrollError && payrollData) {
        setPayrollRuns(payrollData);
      }

      // Load recent payroll items with employee info
      const { data: itemsData, error: itemsError } = await supabase
        .from('payroll_items')
        .select(`
          *,
          employee:employees(name, position)
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!itemsError && itemsData) {
        setPayrollItems(itemsData as any);
      }

      // Load advances
      const { data: advancesData, error: advancesError } = await supabase
        .from('employee_advances')
        .select(`
          *,
          employee:employees(name)
        `)
        .order('request_date', { ascending: false })
        .limit(20);

      if (!advancesError && advancesData) {
        setAdvances(advancesData);
      }

      // Load manual tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('employee_manual_tasks')
        .select(`
          *,
          employee:employees(name)
        `)
        .order('task_date', { ascending: false })
        .limit(50);

      if (!tasksError && tasksData) {
        setManualTasks(tasksData as any);
      }

    } catch (error) {
      console.error('خطأ غير متوقع:', error);
      toast.error('حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setPosition('');
    setEmail('');
    setPhone('');
    setBaseSalary('');
    setHireDate(new Date().toISOString().slice(0, 10));
    setStatus('active');
    setSalaryType('monthly');
    setInstallationTeamId('none');
    setLinkedToOperatingExpenses(false);
    setEditingEmployee(null);
  };

  const handleOpenDialog = (employee?: Employee) => {
    if (employee) {
      setEditingEmployee(employee);
      setName(employee.name);
      setPosition(employee.position || '');
      setEmail(employee.email || '');
      setPhone(employee.phone || '');
      setBaseSalary(employee.base_salary?.toString() || '0');
      setHireDate(employee.hire_date || new Date().toISOString().slice(0, 10));
      setStatus(employee.status || 'active');
      setSalaryType(employee.salary_type || 'monthly');
      setInstallationTeamId(employee.installation_team_id || 'none');
      setLinkedToOperatingExpenses(employee.linked_to_operating_expenses || false);
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    resetForm();
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('يرجى إدخال اسم الموظف');
      return;
    }

    // التحقق من الراتب فقط للموظفين بنظام الراتب الشهري
    if (salaryType === 'monthly' && (!baseSalary || parseFloat(baseSalary) <= 0)) {
      toast.error('يرجى إدخال راتب صحيح');
      return;
    }

    try {
      // Check if installation team is already assigned to another employee
      if (installationTeamId && installationTeamId !== 'none') {
        let teamQuery = supabase
          .from('employees')
          .select('id, name')
          .eq('installation_team_id', installationTeamId);

        if (editingEmployee) {
          teamQuery = teamQuery.neq('id', editingEmployee.id);
        }

        const { data: existingEmployee } = await teamQuery.maybeSingle();

        if (existingEmployee) {
          toast.error(`هذه الفرقة مرتبطة بالفعل بالموظف: ${existingEmployee.name}`);
          return;
        }
      }

      // Check if operating expenses is already linked to another employee
      if (linkedToOperatingExpenses) {
        let expensesQuery = supabase
          .from('employees')
          .select('id, name')
          .eq('linked_to_operating_expenses', true);

        if (editingEmployee) {
          expensesQuery = expensesQuery.neq('id', editingEmployee.id);
        }

        const { data: existingExpenseEmployee } = await expensesQuery.maybeSingle();

        if (existingExpenseEmployee) {
          toast.error(`مستحقات التشغيل مرتبطة بالفعل بالموظف: ${existingExpenseEmployee.name}`);
          return;
        }
      }

      const employeeData = {
        name: name.trim(),
        position: position.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        base_salary: salaryType === 'monthly' ? parseFloat(baseSalary) : 0,
        salary_type: salaryType,
        hire_date: hireDate,
        status: status,
        installation_team_id: (installationTeamId && installationTeamId !== 'none') ? installationTeamId : null,
        linked_to_operating_expenses: linkedToOperatingExpenses,
        updated_at: new Date().toISOString(),
      };

      if (editingEmployee) {
        const { error } = await supabase
          .from('employees')
          .update(employeeData)
          .eq('id', editingEmployee.id);

        if (error) {
          console.error('خطأ في تحديث الموظف:', error);
          if (error.code === '23505') {
            toast.error('هذه الفرقة مرتبطة بموظف آخر');
          } else {
            toast.error('فشل في تحديث الموظف');
          }
        } else {
          toast.success('تم تحديث الموظف بنجاح');
          handleCloseDialog();
          await loadData();
          await loadOperatingExpensesData();
        }
      } else {
        const { error } = await supabase
          .from('employees')
          .insert([employeeData]);

        if (error) {
          console.error('خطأ في إضافة الموظف:', error);
          if (error.code === '23505') {
            toast.error('هذه الفرقة مرتبطة بموظف آخر');
          } else {
            toast.error('فشل في إضافة الموظف');
          }
        } else {
          toast.success('تم إضافة الموظف بنجاح');
          handleCloseDialog();
          await loadData();
          await loadOperatingExpensesData();
        }
      }
    } catch (error) {
      console.error('خطأ غير متوقع:', error);
      toast.error('حدث خطأ غير متوقع');
    }
  };

  const handleDelete = async (id: string) => {
    if (!await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذا الموظف؟', variant: 'destructive', confirmText: 'حذف' })) {
      return;
    }

    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('خطأ في حذف الموظف:', error);
        toast.error('فشل في حذف الموظف');
      } else {
        toast.success('تم حذف الموظف بنجاح');
        loadData();
      }
    } catch (error) {
      console.error('خطأ غير متوقع:', error);
      toast.error('حدث خطأ غير متوقع');
    }
  };

  const totalSalaries = employees
    .filter(e => e.status === 'active')
    .reduce((sum, e) => sum + (e.base_salary || 0), 0);

  const activeEmployees = employees.filter(e => e.status === 'active').length;

  const totalPaidPayroll = payrollItems
    .filter(item => item.paid)
    .reduce((sum, item) => sum + (item.net_salary || 0), 0);

  const totalAdvances = advances
    .filter(a => a.status === 'approved')
    .reduce((sum, a) => sum + (a.remaining || 0), 0);

  const handleCreatePayroll = async () => {
    try {
      // Create payroll run
      const { data: payrollRun, error: runError } = await supabase
        .from('payroll_runs')
        .insert({
          period_start: periodStart,
          period_end: periodEnd,
          status: 'draft'
        })
        .select()
        .single();

      if (runError) throw runError;

      // Create payroll items for all active employees
      const activeEmployees = employees.filter(e => e.status === 'active');
      
      for (const employee of activeEmployees) {
        // Calculate deductions (advances for this period)
        const { data: employeeAdvances } = await supabase
          .from('employee_advances')
          .select('remaining')
          .eq('employee_id', employee.id)
          .eq('status', 'approved');

        const totalDeductions = employeeAdvances?.reduce((sum, a) => sum + a.remaining, 0) || 0;

        await supabase.from('payroll_items').insert({
          payroll_id: payrollRun.id,
          employee_id: employee.id,
          basic_salary: employee.base_salary,
          allowances: 0,
          overtime_amount: 0,
          deductions: totalDeductions,
          net_salary: employee.base_salary - totalDeductions,
          paid: false
        });
      }

      toast.success('تم إنشاء دورة الرواتب بنجاح');
      setPayrollDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error creating payroll:', error);
      toast.error('فشل في إنشاء دورة الرواتب');
    }
  };

  const handleMarkPayrollPaid = async (payrollId: string) => {
    try {
      await supabase
        .from('payroll_runs')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', payrollId);

      await supabase
        .from('payroll_items')
        .update({ paid: true })
        .eq('payroll_id', payrollId);

      toast.success('تم تسجيل الرواتب كمدفوعة');
      loadData();
    } catch (error) {
      console.error('Error marking payroll as paid:', error);
      toast.error('فشل في تحديث حالة الرواتب');
    }
  };

  const handleAddAdvance = async () => {
    if (!selectedEmployeeForAdvance || !advanceAmount || parseFloat(advanceAmount) <= 0) {
      toast.error('يرجى ملء جميع الحقول بشكل صحيح');
      return;
    }

    try {
      await supabase.from('employee_advances').insert({
        employee_id: selectedEmployeeForAdvance,
        amount: parseFloat(advanceAmount),
        remaining: parseFloat(advanceAmount),
        reason: advanceReason.trim() || null,
        status: 'approved'
      });

      toast.success('تم إضافة السلفة بنجاح');
      setAdvanceDialogOpen(false);
      setSelectedEmployeeForAdvance('');
      setAdvanceAmount('');
      setAdvanceReason('');
      loadData();
    } catch (error) {
      console.error('Error adding advance:', error);
      toast.error('فشل في إضافة السلفة');
    }
  };

  const handleAddManualTask = async () => {
    if (!selectedEmployeeForTask || !taskDescription.trim() || !operatingCost || parseFloat(operatingCost) <= 0) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      await supabase.from('employee_manual_tasks').insert({
        employee_id: selectedEmployeeForTask,
        task_description: taskDescription.trim(),
        task_date: taskDate,
        operating_cost: parseFloat(operatingCost),
        notes: taskNotes.trim() || null,
        status: 'pending'
      });

      toast.success('تم إضافة العمل اليدوي بنجاح');
      setTaskDialogOpen(false);
      setSelectedEmployeeForTask('');
      setTaskDescription('');
      setTaskDate(new Date().toISOString().slice(0, 10));
      setOperatingCost('');
      setTaskNotes('');
      loadData();
    } catch (error) {
      console.error('Error adding manual task:', error);
      toast.error('فشل في إضافة العمل اليدوي');
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
      loadData();
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
      loadData();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('فشل في حذف العمل');
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 space-y-6 max-w-7xl animate-fade-in" dir="rtl">
      {/* Premium Glassmorphic Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/15 p-6 backdrop-blur-sm shadow-sm">
        <div className="absolute right-0 top-0 -z-10 h-32 w-32 rounded-full bg-primary/5 blur-3xl"></div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 text-white shrink-0">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">إدارة الرواتب والموظفين</h1>
              <p className="text-muted-foreground text-sm mt-1">تتبع كادر العمل، دورات الرواتب، السلف، والأعمال اليدوية</p>
            </div>
          </div>
          {canEditSection && (
            <Button onClick={() => handleOpenDialog()} className="h-10 text-xs font-bold gap-1.5 bg-primary hover:bg-primary/95 text-primary-foreground shadow-lg shadow-primary/10 w-full sm:w-auto">
              <Plus className="h-4 w-4" /> إضافة موظف جديد
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="border-primary/20 bg-primary/[0.02] hover:bg-primary/[0.04] hover:shadow-md hover:scale-[1.01] transition-all duration-300 shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-primary"></div>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold text-primary flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" /> إجمالي الرواتب الشهرية
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl md:text-2xl font-black font-numbers tracking-tight">
              {totalSalaries.toLocaleString('en-US')} <span className="text-[10px] font-semibold text-muted-foreground">د.ل</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 bg-emerald-500/[0.02] hover:bg-emerald-500/[0.04] hover:shadow-md hover:scale-[1.01] transition-all duration-300 shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> الموظفين النشطين
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl md:text-2xl font-black font-numbers tracking-tight">
              {activeEmployees}
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-blue-500/[0.02] hover:bg-blue-500/[0.04] hover:shadow-md hover:scale-[1.01] transition-all duration-300 shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-blue-500"></div>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5" /> إجمالي المدفوع
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl md:text-2xl font-black font-numbers tracking-tight">
              {totalPaidPayroll.toLocaleString('en-US')} <span className="text-[10px] font-semibold text-muted-foreground">د.ل</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-500/20 bg-purple-500/[0.02] hover:bg-purple-500/[0.04] hover:shadow-md hover:scale-[1.01] transition-all duration-300 shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-purple-500"></div>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> دورات الرواتب
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl md:text-2xl font-black font-numbers tracking-tight">
              {payrollRuns.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="employees" className="space-y-4">
        <TabsList className="bg-muted/50 p-1 w-full md:w-auto flex flex-wrap gap-1 rounded-xl border border-border/40">
          <TabsTrigger value="employees" className="font-bold text-xs px-4 py-2 rounded-lg">الموظفين</TabsTrigger>
          <TabsTrigger value="manual-tasks" className="font-bold text-xs px-4 py-2 rounded-lg">الأعمال اليدوية</TabsTrigger>
          <TabsTrigger value="payroll" className="font-bold text-xs px-4 py-2 rounded-lg">دورات الرواتب</TabsTrigger>
          <TabsTrigger value="payments" className="font-bold text-xs px-4 py-2 rounded-lg">المدفوعات</TabsTrigger>
          <TabsTrigger value="advances" className="font-bold text-xs px-4 py-2 rounded-lg">السلف</TabsTrigger>
        </TabsList>

        {/* Employees Tab */}
        <TabsContent value="employees" className="space-y-4">
          <Card className="border-primary/10 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/10 border-b pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                قائمة الموظفين ودليل العمل
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="text-right text-xs font-bold">الاسم</TableHead>
                      <TableHead className="text-right text-xs font-bold">الوظيفة</TableHead>
                      <TableHead className="text-right text-xs font-bold">نوع الراتب</TableHead>
                      <TableHead className="text-right text-xs font-bold">فرقة التركيب</TableHead>
                      <TableHead className="text-right text-xs font-bold">مستحقات التشغيل</TableHead>
                      <TableHead className="text-right text-xs font-bold">الراتب / المستحقات</TableHead>
                      <TableHead className="text-right text-xs font-bold">تاريخ التعيين</TableHead>
                      <TableHead className="text-right text-xs font-bold">الحالة</TableHead>
                      <TableHead className="text-right text-xs font-bold">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8 text-sm">
                          لا يوجد موظفين مسجلين في النظام.
                        </TableCell>
                      </TableRow>
                    ) : (
                      employees.map((employee) => {
                        const team = installationTeams.find(t => t.id === employee.installation_team_id);
                        return (
                          <TableRow key={employee.id} className="hover:bg-muted/30 transition-colors border-b">
                            <TableCell className="font-semibold text-sm">{employee.name}</TableCell>
                            <TableCell className="text-sm">{employee.position || '-'}</TableCell>
                            <TableCell>
                              <Badge variant={employee.salary_type === 'monthly' ? 'default' : 'secondary'} className="text-xs">
                                {employee.salary_type === 'monthly' ? 'راتب شهري' : employee.salary_type === 'hourly' ? 'بالعمل' : employee.salary_type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {team ? (
                                <Badge variant="outline" className="border-blue-500/20 text-blue-600 bg-blue-500/[0.02] text-xs">{team.team_name}</Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {employee.linked_to_operating_expenses ? (
                                <Badge className="bg-orange-500 text-white text-xs hover:bg-orange-600">مرتبط بالتشغيل</Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell className="font-semibold font-manrope text-sm">
                              {employee.salary_type === 'monthly' 
                                ? `${(employee.base_salary || 0).toLocaleString('en-US')} د.ل`
                                : employee.installation_team_id && teamEarnings[employee.installation_team_id] != null
                                  ? <span className="text-blue-600 dark:text-blue-400 font-bold">{Math.round(teamEarnings[employee.installation_team_id]).toLocaleString('en-US')} د.ل</span>
                                  : employee.linked_to_operating_expenses
                                    ? <span className="text-orange-600 dark:text-orange-400 font-bold">{Math.round(operatingStats.totalRevenue).toLocaleString('en-US')} د.ل</span>
                                    : <span className="text-muted-foreground text-xs">بالعمل</span>
                              }
                            </TableCell>
                            <TableCell className="font-manrope text-xs text-muted-foreground">{fmtDate(employee.hire_date)}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={employee.status === 'active' ? 'default' : 'secondary'}
                                className={`text-xs ${employee.status === 'active' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                              >
                                {employee.status === 'active' ? 'نشط' : 'غير نشط'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                                  onClick={() => navigate(`/admin/employees/${employee.id}`)}
                                  title="الملف الشخصي"
                                >
                                  <User className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 rounded-lg hover:bg-blue-500/10 hover:text-blue-600 transition-colors"
                                  onClick={() => handleOpenDialog(employee)}
                                  title="تعديل"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 rounded-lg hover:bg-rose-500/10 hover:text-rose-600 transition-colors"
                                  onClick={() => handleDelete(employee.id)}
                                  title="حذف"
                                >
                                  <Trash2 className="h-4 w-4 text-rose-600" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manual Tasks Tab */}
        <TabsContent value="manual-tasks" className="space-y-4">
          <Card className="border-primary/10 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/10 border-b pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                سجل الأعمال اليدوية
              </CardTitle>
              <Button onClick={() => setTaskDialogOpen(true)} className="gap-2 h-9 text-xs font-bold bg-primary hover:bg-primary/95">
                <Plus className="h-3.5 w-3.5" />
                إضافة عمل يدوي
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-4 bg-primary/[0.02] border-b flex justify-between items-center">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">إجمالي مستحقات التشغيل للأعمال المكتملة</p>
                  <p className="text-xl font-black text-primary font-manrope">
                    {manualTasks
                      .filter(t => t.status === 'completed')
                      .reduce((sum, t) => sum + (t.operating_cost || 0), 0)
                      .toLocaleString('en-US')} <span className="text-xs font-semibold">د.ل</span>
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="text-right text-xs font-bold">الموظف</TableHead>
                      <TableHead className="text-right text-xs font-bold">الوصف</TableHead>
                      <TableHead className="text-right text-xs font-bold">التاريخ</TableHead>
                      <TableHead className="text-right text-xs font-bold">تكلفة التشغيل</TableHead>
                      <TableHead className="text-right text-xs font-bold">الحالة</TableHead>
                      <TableHead className="text-right text-xs font-bold">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {manualTasks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-sm">
                          لا توجد أعمال يدوية مسجلة.
                        </TableCell>
                      </TableRow>
                    ) : (
                      manualTasks.map((task) => (
                        <TableRow key={task.id} className="hover:bg-muted/30 transition-colors border-b">
                          <TableCell className="font-semibold text-sm">
                            {(task.employee as any)?.name || '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            <span className="font-medium text-foreground">{task.task_description}</span>
                            {task.notes && (
                              <p className="text-xs text-muted-foreground mt-0.5">{task.notes}</p>
                            )}
                          </TableCell>
                          <TableCell className="font-manrope text-xs text-muted-foreground">{fmtDate(task.task_date)}</TableCell>
                          <TableCell className="font-bold font-manrope text-sm">
                            {(task.operating_cost || 0).toLocaleString('en-US')} د.ل
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={task.status === 'completed' ? 'default' : 'secondary'}
                              className={`text-xs ${task.status === 'completed' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                            >
                              {task.status === 'completed' ? 'مكتمل' : 'معلق'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {task.status !== 'completed' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-600 transition-colors"
                                  onClick={() => handleMarkTaskComplete(task.id)}
                                  title="تسجيل كمكتمل"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 rounded-lg hover:bg-rose-500/10 hover:text-rose-600 transition-colors"
                                onClick={() => handleDeleteTask(task.id)}
                                title="حذف"
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

        {/* Payroll Runs Tab */}
        <TabsContent value="payroll" className="space-y-4">
          <Card className="border-primary/10 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/10 border-b pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                دورات وجداول الرواتب
              </CardTitle>
              <Button onClick={() => setPayrollDialogOpen(true)} className="gap-2 h-9 text-xs font-bold bg-primary hover:bg-primary/90">
                <Plus className="h-3.5 w-3.5" />
                إنشاء دورة رواتب جديدة
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="text-right text-xs font-bold">الفترة</TableHead>
                      <TableHead className="text-right text-xs font-bold">الحالة</TableHead>
                      <TableHead className="text-right text-xs font-bold">تاريخ الإنشاء</TableHead>
                      <TableHead className="text-right text-xs font-bold">تاريخ الاعتماد</TableHead>
                      <TableHead className="text-right text-xs font-bold">تاريخ الدفع</TableHead>
                      <TableHead className="text-right text-xs font-bold">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollRuns.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-sm">
                          لا توجد دورات رواتب مسجلة في النظام.
                        </TableCell>
                      </TableRow>
                    ) : (
                      payrollRuns.map((run) => (
                        <TableRow key={run.id} className="hover:bg-muted/30 transition-colors border-b">
                          <TableCell className="font-semibold text-sm">
                            {fmtDate(run.period_start)} - {fmtDate(run.period_end)}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                run.status === 'paid' ? 'default' : 
                                run.status === 'approved' ? 'secondary' : 
                                'outline'
                              }
                              className={`text-xs ${
                                run.status === 'paid' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 
                                run.status === 'approved' ? 'bg-blue-500 text-white' : 'border-amber-500/30 text-amber-600 bg-amber-500/[0.02]'
                              }`}
                            >
                              {run.status === 'paid' ? 'مدفوع' : run.status === 'approved' ? 'معتمد' : 'مسودة'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-manrope text-xs text-muted-foreground">{fmtDate(run.created_at)}</TableCell>
                          <TableCell className="font-manrope text-xs text-muted-foreground">{fmtDate(run.approved_at)}</TableCell>
                          <TableCell className="font-manrope text-xs text-muted-foreground">{fmtDate(run.paid_at)}</TableCell>
                          <TableCell>
                            {run.status !== 'paid' && (
                              <Button
                                size="sm"
                                onClick={() => handleMarkPayrollPaid(run.id)}
                                className="gap-1 h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                تسجيل كمدفوع
                              </Button>
                            )}
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

        {/* Payments Tab */}
        <TabsContent value="payments" className="space-y-4">
          <Card className="border-primary/10 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/10 border-b pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                سجل تفاصيل مدفوعات الرواتب
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="text-right text-xs font-bold">الموظف</TableHead>
                      <TableHead className="text-right text-xs font-bold">الوظيفة</TableHead>
                      <TableHead className="text-right text-xs font-bold">الراتب الأساسي</TableHead>
                      <TableHead className="text-right text-xs font-bold">البدلات</TableHead>
                      <TableHead className="text-right text-xs font-bold">الخصومات</TableHead>
                      <TableHead className="text-right text-xs font-bold">صافي الراتب</TableHead>
                      <TableHead className="text-right text-xs font-bold">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-sm">
                          لا توجد مدفوعات مسجلة.
                        </TableCell>
                      </TableRow>
                    ) : (
                      payrollItems.map((item) => (
                        <TableRow key={item.id} className="hover:bg-muted/30 transition-colors border-b">
                          <TableCell className="font-semibold text-sm">
                            {(item.employee as any)?.name || '-'}
                          </TableCell>
                          <TableCell className="text-sm">{(item.employee as any)?.position || '-'}</TableCell>
                          <TableCell className="font-manrope text-sm font-medium">{(item.basic_salary || 0).toLocaleString('en-US')} د.ل</TableCell>
                          <TableCell className="font-manrope text-sm text-green-600 font-medium">+{(item.allowances || 0).toLocaleString('en-US')} د.ل</TableCell>
                          <TableCell className="font-manrope text-sm text-red-600 font-medium">-{(item.deductions || 0).toLocaleString('en-US')} د.ل</TableCell>
                          <TableCell className="font-manrope text-sm font-bold text-foreground">{(item.net_salary || 0).toLocaleString('en-US')} د.ل</TableCell>
                          <TableCell>
                            <Badge 
                              variant={item.paid ? 'default' : 'secondary'}
                              className={`text-xs ${item.paid ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                            >
                              {item.paid ? 'مدفوع' : 'معلق'}
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

        {/* Advances Tab */}
        <TabsContent value="advances" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Advances Card */}
            <Card className="border-primary/10 shadow-sm overflow-hidden flex flex-col">
              <CardHeader className="bg-muted/10 border-b pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-rose-500 animate-pulse" />
                  تفاصيل السلف النشطة
                </CardTitle>
                <Button onClick={() => setAdvanceDialogOpen(true)} size="sm" className="gap-2 h-8 text-xs font-bold bg-primary hover:bg-primary/90">
                  <Plus className="h-3.5 w-3.5" />
                  إضافة سلفة
                </Button>
              </CardHeader>
              <CardContent className="p-4 flex-1 flex flex-col gap-4">
                <div className="p-4 bg-rose-500/[0.02] border border-rose-500/10 rounded-xl">
                  <p className="text-xs text-muted-foreground mb-0.5">إجمالي السلف النشطة المتبقية</p>
                  <p className="text-2xl font-black text-rose-600 font-manrope">{totalAdvances.toLocaleString('en-US')} <span className="text-xs font-semibold">د.ل</span></p>
                </div>
                
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {advances.filter(a => a.status === 'approved' && a.remaining > 0).length === 0 ? (
                    <p className="text-center text-muted-foreground py-8 text-sm">لا توجد سلف معلقة مستحقة.</p>
                  ) : (
                    advances
                      .filter(a => a.status === 'approved' && a.remaining > 0)
                      .map((advance) => (
                        <div key={advance.id} className="p-3 border rounded-xl bg-muted/20 hover:bg-muted/30 transition-colors flex justify-between items-start gap-4">
                          <div className="space-y-1">
                            <p className="font-semibold text-sm text-foreground">{(advance.employee as any)?.name}</p>
                            <p className="text-[10px] text-muted-foreground font-manrope">
                              {fmtDate(advance.request_date)}
                            </p>
                            {advance.reason && (
                              <p className="text-xs text-muted-foreground">{advance.reason}</p>
                            )}
                          </div>
                          <Badge variant="outline" className="border-rose-500/20 text-rose-600 bg-rose-500/[0.01] font-manrope text-sm font-semibold">
                            {advance.remaining.toLocaleString('en-US')} د.ل
                          </Badge>
                        </div>
                      ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Summary Card */}
            <Card className="border-primary/10 shadow-sm overflow-hidden flex flex-col">
              <CardHeader className="bg-muted/10 border-b pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  ملخص كشف السلف والخصومات
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4 flex-1">
                <div className="grid grid-cols-1 gap-3">
                  <div className="p-4 bg-muted/30 border border-border/40 rounded-xl flex justify-between items-center">
                    <span className="text-xs font-semibold text-muted-foreground">إجمالي السلف الممنوحة</span>
                    <span className="text-lg font-bold font-manrope">
                      {advances
                        .filter(a => a.status === 'approved')
                        .reduce((sum, a) => sum + a.amount, 0)
                        .toLocaleString('en-US')} د.ل
                    </span>
                  </div>
                  
                  <div className="p-4 bg-rose-500/[0.01] border border-rose-500/10 rounded-xl flex justify-between items-center">
                    <span className="text-xs font-semibold text-rose-600">المتبقي المطلوب سداده</span>
                    <span className="text-lg font-bold text-rose-600 font-manrope">
                      {totalAdvances.toLocaleString('en-US')} د.ل
                    </span>
                  </div>

                  <div className="p-4 bg-emerald-500/[0.01] border border-emerald-500/10 rounded-xl flex justify-between items-center">
                    <span className="text-xs font-semibold text-emerald-600">المسدد والخصومات المستقطعة</span>
                    <span className="text-lg font-bold text-emerald-600 font-manrope">
                      {(advances
                        .filter(a => a.status === 'approved')
                        .reduce((sum, a) => sum + a.amount, 0) - totalAdvances)
                        .toLocaleString('en-US')} د.ل
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Employee Dialog */}
      <UIDialog.Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <UIDialog.DialogContent className="max-w-2xl p-6">
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle className="text-xl font-bold flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              {editingEmployee ? 'تعديل ملف موظف' : 'إضافة موظف جديد'}
            </UIDialog.DialogTitle>
          </UIDialog.DialogHeader>

          <div className="grid gap-4 py-4 text-right">
            <div className="grid gap-2">
              <label className="text-xs font-bold text-muted-foreground">اسم الموظف *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="أدخل اسم الموظف ثلاثي"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-bold text-muted-foreground">الوظيفة</label>
              <Input
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="أدخل المسمى الوظيفي"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-xs font-bold text-muted-foreground">البريد الإلكتروني</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="font-manrope"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-bold text-muted-foreground">رقم الهاتف</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09xxxxxxxx"
                  className="font-manrope"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {salaryType === 'monthly' && (
                <div className="grid gap-2">
                  <label className="text-xs font-bold text-muted-foreground">الراتب الأساسي *</label>
                  <Input
                    type="number"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                    className="font-manrope"
                  />
                </div>
              )}

              <div className={`grid gap-2 ${salaryType === 'hourly' ? 'col-span-2' : ''}`}>
                <label className="text-xs font-bold text-muted-foreground">تاريخ التعيين *</label>
                <Input
                  type="date"
                  value={hireDate}
                  onChange={(e) => setHireDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-xs font-bold text-muted-foreground">الحالة</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="inactive">غير نشط</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-bold text-muted-foreground">نوع الراتب</label>
                <Select value={salaryType} onValueChange={setSalaryType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">راتب شهري</SelectItem>
                    <SelectItem value="hourly">بالعمل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-bold text-muted-foreground">فريق التركيب</label>
              <Select value={installationTeamId} onValueChange={setInstallationTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر فريق التركيب" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون فريق (مستقل)</SelectItem>
                  {installationTeams.map((team) => {
                    const assignedEmployee = employees.find(e => e.installation_team_id === team.id && e.id !== editingEmployee?.id);
                    return (
                      <SelectItem 
                        key={team.id} 
                        value={team.id}
                        disabled={!!assignedEmployee}
                      >
                        {team.team_name}
                        {assignedEmployee && ` (مرتبط بـ ${assignedEmployee.name})`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 bg-muted/40 rounded-xl border space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground cursor-pointer" htmlFor="operating-expenses">ربط بمستحقات التشغيل</label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="operating-expenses"
                    checked={linkedToOperatingExpenses}
                    onChange={(e) => setLinkedToOperatingExpenses(e.target.checked)}
                    disabled={(() => {
                      const linkedEmployee = employees.find(emp => 
                        emp.linked_to_operating_expenses && 
                        emp.id !== editingEmployee?.id
                      );
                      return !!linkedEmployee;
                    })()}
                    className="w-4 h-4 cursor-pointer"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-normal">
                {(() => {
                  const linkedEmployee = employees.find(emp => 
                    emp.linked_to_operating_expenses && 
                    emp.id !== editingEmployee?.id
                  );
                  if (linkedEmployee) {
                    return `(مرتبط حالياً بالموظف: ${linkedEmployee.name})`;
                  }
                  return 'عند التفعيل، سيتم ربط هذا الموظف بحساب مستحقات وسحوبات التشغيل (يمكن ربط موظف واحد فقط في النظام).';
                })()}
              </p>
            </div>
          </div>

          <UIDialog.DialogFooter className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={handleCloseDialog}>
              إلغاء
            </Button>
            <Button onClick={handleSubmit} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
              {editingEmployee ? 'تحديث البيانات' : 'إضافة الموظف'}
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* Payroll Creation Dialog */}
      <UIDialog.Dialog open={payrollDialogOpen} onOpenChange={setPayrollDialogOpen}>
        <UIDialog.DialogContent className="max-w-md p-6">
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle className="text-xl font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              إنشاء دورة رواتب جديدة
            </UIDialog.DialogTitle>
          </UIDialog.DialogHeader>

          <div className="grid gap-4 py-4 text-right">
            <div className="grid gap-2">
              <label className="text-xs font-bold text-muted-foreground">بداية الفترة</label>
              <Input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-bold text-muted-foreground">نهاية الفترة</label>
              <Input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>

            <div className="p-4 bg-primary/[0.02] border border-primary/10 rounded-xl space-y-2">
              <p className="text-xs text-muted-foreground">ملخص الدورة المستهدفة:</p>
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-foreground">عدد الموظفين المستهدفين:</span>
                <span className="font-bold text-primary">{activeEmployees} موظف نشط</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-foreground">إجمالي رواتب الأساسية:</span>
                <span className="font-bold font-manrope">{totalSalaries.toLocaleString('en-US')} د.ل</span>
              </div>
            </div>
          </div>

          <UIDialog.DialogFooter className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setPayrollDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleCreatePayroll} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
              إنشاء الدورة واعتمادها
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* Advance Dialog */}
      <UIDialog.Dialog open={advanceDialogOpen} onOpenChange={setAdvanceDialogOpen}>
        <UIDialog.DialogContent className="max-w-md p-6">
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle className="text-xl font-bold flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-rose-500" />
              إضافة سلفة جديدة
            </UIDialog.DialogTitle>
          </UIDialog.DialogHeader>

          <div className="grid gap-4 py-4 text-right">
            <div className="grid gap-2">
              <label className="text-xs font-bold text-muted-foreground">الموظف *</label>
              <Select value={selectedEmployeeForAdvance} onValueChange={setSelectedEmployeeForAdvance}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر موظف" />
                </SelectTrigger>
                <SelectContent>
                  {employees
                    .filter(e => e.status === 'active')
                    .map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name} - {employee.position || 'بدون وظيفة'}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-bold text-muted-foreground">المبلغ (د.ل) *</label>
              <Input
                type="number"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
                className="font-manrope"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-bold text-muted-foreground">السبب والبيان</label>
              <Textarea
                value={advanceReason}
                onChange={(e) => setAdvanceReason(e.target.value)}
                placeholder="أدخل سبب السلفة أو تفاصيل (اختياري)"
                rows={3}
              />
            </div>
          </div>

          <UIDialog.DialogFooter className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setAdvanceDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleAddAdvance} className="bg-rose-600 hover:bg-rose-700 text-white font-bold">
              إضافة السلفة
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* Manual Task Dialog */}
      <UIDialog.Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <UIDialog.DialogContent className="max-w-md p-6">
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle className="text-xl font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              تسجيل عمل يدوي جديد
            </UIDialog.DialogTitle>
          </UIDialog.DialogHeader>

          <div className="grid gap-4 py-4 text-right">
            <div className="grid gap-2">
              <label className="text-xs font-bold text-muted-foreground">الموظف (بنظام العمل) *</label>
              <Select value={selectedEmployeeForTask} onValueChange={setSelectedEmployeeForTask}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر موظف" />
                </SelectTrigger>
                <SelectContent>
                  {employees
                    .filter(e => e.status === 'active' && e.salary_type === 'per_job')
                    .map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name} - {employee.position || 'بدون وظيفة'}
                      </SelectItem>
                     ))}
                  {employees.filter(e => e.status === 'active' && e.salary_type === 'per_job').length === 0 && (
                    <SelectItem value="no-employees" disabled>
                      لا يوجد موظفين بنظام العمل
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

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
            <Button onClick={handleAddManualTask}>
              إضافة العمل
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>
    </div>
  );
}
