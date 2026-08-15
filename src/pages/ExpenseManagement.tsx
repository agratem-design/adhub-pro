// @ts-nocheck
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchInputWithHistory } from '@/components/ui/SearchInputWithHistory';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { 
  TrendingDown, 
  Users, 
  Calendar,
  Plus,
  Edit,
  Trash2,
  DollarSign,
  RefreshCw,
  Download,
  Wallet,
  TrendingUp,
  Printer,
  ArrowRight,
  CheckCircle,
  Clock,
  AlertTriangle,
  UserCheck,
  FileText,
  RotateCcw,
  Search,
  X as XIcon
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import ExpenseReceiptPrintDialog from '@/components/billing/ExpenseReceiptPrintDialog';
import { DirectExpensePaymentDialog } from '@/components/expenses/DirectExpensePaymentDialog';
import { ExpensePaymentsLogTable } from '@/components/expenses/ExpensePaymentsLogTable';
import {
  generateMeasurementsHTML,
  createMeasurementsConfigFromSettings,
} from '@/print-engine/universal';
import { usePrintSettingsByType } from '@/store/printSettingsStore';
import { DOCUMENT_TYPES } from '@/types/document-types';

interface ExpenseStats {
  totalExpenses: number;
  monthlyExpenses: number;
  totalSalaries: number;
  activeEmployees: number;
  totalWithdrawals: number;
  remainingBalance: number;
  unpaidExpenses: number;
  employeeDues: number;
}

interface Employee {
  id: string;
  name: string;
  position: string;
  base_salary: number;
  hire_date: string;
  status: string;
  phone?: string;
  email?: string;
  created_at?: string;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  expense_date: string;
  payment_method: string;
  payment_status: string;
  paid_date?: string;
  employee_id?: string;
  notes?: string;
  receiver_name?: string;
  sender_name?: string;
  created_at?: string;
}

interface ExpenseCategory {
  id: number;
  name: string;
  code?: string;
}

interface EmployeeCreditEntry {
  id: string;
  employee_id: string;
  expense_id?: string;
  entry_type: string;
  amount: number;
  balance_after: number;
  description: string;
  payment_method?: string;
  reference_number?: string;
  entry_date: string;
  notes?: string;
}

interface EmployeeDue {
  employee_id: string;
  employee_name: string;
  position: string;
  total_credit: number;
  total_debit: number;
  balance: number;
}

interface Withdrawal {
  id: number;
  amount: number;
  date: string;
  method: string;
  note?: string;
  notes?: string;
  type?: string;
  contract_id?: number;
  user_id?: string;
  created_at?: string;
}

interface PeriodClosure {
  id: number;
  closure_date: string;
  period_start?: string;
  period_end?: string;
  closure_type?: string;
  total_amount?: number;
  total_withdrawn?: number;
  remaining_balance?: number;
  total_contracts?: number;
  notes?: string;
  created_at?: string;
  contract_start?: number;
  contract_end?: number;
}

const paymentMethods = [
  'نقدي',
  'تحويل بنكي',
  'شيك',
  'بطاقة ائتمان',
  'عهدة موظف'
];

export default function ExpenseManagement() {
  const navigate = useNavigate();
  const { settings: expensePrintSettings } = usePrintSettingsByType(DOCUMENT_TYPES.EXPENSE_INVOICE);


  
  const [stats, setStats] = useState<ExpenseStats>({
    totalExpenses: 0,
    monthlyExpenses: 0,
    totalSalaries: 0,
    activeEmployees: 0,
    totalWithdrawals: 0,
    remainingBalance: 0,
    unpaidExpenses: 0,
    employeeDues: 0
  });

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [closures, setClosures] = useState<PeriodClosure[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [employeeDues, setEmployeeDues] = useState<EmployeeDue[]>([]);
  const [creditEntries, setCreditEntries] = useState<EmployeeCreditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  // Quick-add employee (from expense form)
  const [showQuickEmployeeDialog, setShowQuickEmployeeDialog] = useState(false);
  const [quickEmployeeName, setQuickEmployeeName] = useState('');
  const [quickEmployeePosition, setQuickEmployeePosition] = useState('');
  const [quickEmployeeSalary, setQuickEmployeeSalary] = useState<string>('');
  const [quickEmployeeSaving, setQuickEmployeeSaving] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [showWithdrawalDialog, setShowWithdrawalDialog] = useState(false);
  const [showClosureDialog, setShowClosureDialog] = useState(false);
  const [showExpenseReceiptDialog, setShowExpenseReceiptDialog] = useState(false);
  const [showPayEmployeeDialog, setShowPayEmployeeDialog] = useState(false);
  const [selectedExpenseForReceipt, setSelectedExpenseForReceipt] = useState<Expense | null>(null);
  const [directPaymentExpense, setDirectPaymentExpense] = useState<any>(null);
  const [showDirectPaymentDialog, setShowDirectPaymentDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingWithdrawal, setEditingWithdrawal] = useState<Withdrawal | null>(null);
  const [editingClosure, setEditingClosure] = useState<PeriodClosure | null>(null);
  
  // Filters
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterSearch, setFilterSearch] = useState('');

  // ✅ مصدر السداد لكل مصروف (من أي عميل/عهدة/سداد مباشر)
  const [paymentSourceMap, setPaymentSourceMap] = useState<Record<string, string>>({});
  // ✅ معرّفات المصروفات المسددة يدوياً (لا يوجد لها صف في expense_payments)
  const [manuallyPaidIds, setManuallyPaidIds] = useState<Set<string>>(new Set());
  // ✅ معرّفات المصروفات المسددة عبر "سداد مباشر" فقط (لا تشمل دفعات الزبائن)
  const [directPaidIds, setDirectPaidIds] = useState<Set<string>>(new Set());

  // ✅ زر إعادة فتح/تعديل حالة السداد للمصروفات المسددة يدوياً
  const [reopenExpense, setReopenExpense] = useState<Expense | null>(null);
  const [reopenSaving, setReopenSaving] = useState(false);

  // ✅ حسابات العهدة النشطة (لاختيار مصدر السداد من عهدة موظف)
  const [custodyAccounts, setCustodyAccounts] = useState<Array<{
    id: string;
    account_number: string;
    employee_id: string;
    current_balance: number;
    employee_name?: string;
  }>>([]);
  // العهدة المختارة عند إضافة/تعديل مصروف "عهدة موظف"
  const [selectedCustodyAccountId, setSelectedCustodyAccountId] = useState<string>('');

  // ✅ تحميل مصدر السداد لكل مصروف مسدّد + تحديد المسددة يدوياً
  const loadPaymentSourcesAndManual = async (expensesData: any[]) => {
    try {
      const paidIds = (expensesData || [])
        .filter((e) => e.payment_status === 'paid' || e.payment_status === 'partial')
        .map((e) => e.id);
      if (paidIds.length === 0) {
        setPaymentSourceMap({});
        setManuallyPaidIds(new Set());
        setDirectPaidIds(new Set());
        return;
      }
      const { data: payRows } = await supabase
        .from('expense_payments')
        .select('expense_id, paid_at, paid_via, payment_source, distributed_payment_id')
        .in('expense_id', paidIds)
        .order('paid_at', { ascending: true });
      const distIds = Array.from(
        new Set((payRows || []).map((p: any) => p.distributed_payment_id).filter(Boolean)),
      );
      const cpMap: Record<string, any> = {};
      if (distIds.length) {
        const { data: cp } = await supabase
          .from('customer_payments')
          .select('distributed_payment_id, customer_name, amount, paid_at')
          .in('distributed_payment_id', distIds as string[]);
        for (const r of cp || []) {
          const k = (r as any).distributed_payment_id as string;
          if (k && !cpMap[k]) cpMap[k] = r;
        }
      }
      // ✅ جمع معرّفات حسابات العهدة المرتبطة بأي سداد (payment_source: custody:<uuid>)
      const custodyIds = Array.from(
        new Set(
          (payRows || [])
            .map((p: any) => {
              const src: string = p?.payment_source || '';
              const m = src.match(/^custody:([0-9a-f-]{8,})/i);
              return m ? m[1] : null;
            })
            .filter(Boolean) as string[],
        ),
      );
      const custodyInfoMap: Record<string, { account_number: string; employee_name: string }> = {};
      if (custodyIds.length) {
        const { data: caRows } = await supabase
          .from('custody_accounts')
          .select('id, account_number, employee_id')
          .in('id', custodyIds);
        const empIds = Array.from(new Set((caRows || []).map((c: any) => c.employee_id).filter(Boolean)));
        const empNameMap: Record<string, string> = {};
        if (empIds.length) {
          const { data: empRows } = await supabase
            .from('employees')
            .select('id, name')
            .in('id', empIds as string[]);
          for (const e of empRows || []) empNameMap[(e as any).id] = (e as any).name;
        }
        for (const c of caRows || []) {
          custodyInfoMap[(c as any).id] = {
            account_number: (c as any).account_number,
            employee_name: empNameMap[(c as any).employee_id] || '',
          };
        }
      }
      const grouped: Record<string, string[]> = {};
      const linkedIds = new Set<string>();
      for (const p of payRows || []) {
        const eid = (p as any).expense_id as string;
        linkedIds.add(eid);
        let label = '';
        const cp = (p as any).distributed_payment_id ? cpMap[(p as any).distributed_payment_id] : null;
        const src: string = (p as any).payment_source || '';
        const custodyMatch = src.match(/^custody:([0-9a-f-]{8,})/i);
        if (cp) {
          const d = cp.paid_at ? format(new Date(cp.paid_at), 'dd/MM/yyyy') : '';
          label = `${cp.customer_name || 'زبون'}${d ? ` · ${d}` : ''}`;
        } else if (custodyMatch && custodyInfoMap[custodyMatch[1]]) {
          const info = custodyInfoMap[custodyMatch[1]];
          label = `عهدة موظف — ${info.employee_name || ''} — حساب ${info.account_number}`;
        } else if (
          ((p as any).payment_source || '').includes('custody') ||
          ((p as any).paid_via || '').includes('عهدة')
        ) {
          label = 'عهدة موظف';
        } else {
          const pv = (p as any).paid_via || '';
          const ps = (p as any).payment_source || '';
          // ترجمة paid_via الإنجليزية إلى تسمية عربية واضحة وإضافة وسيلة الدفع إن وُجدت
          const base = pv === 'direct' || !pv ? 'سداد مباشر' : pv;
          // تجاهل القيم التقنية مثل custody:<uuid> أو distributed_payment:...
          const extra = ps && !/^(custody:|distributed_payment:)/i.test(ps) ? ps : '';
          label = extra ? `${base} — ${extra}` : base;
        }
        (grouped[eid] = grouped[eid] || []).push(label);
      }
      const map: Record<string, string> = {};
      for (const k of Object.keys(grouped)) {
        map[k] = Array.from(new Set(grouped[k])).join(' / ');
      }
      setPaymentSourceMap(map);
      // مسدد يدوياً = مسدد ولا يوجد له صف في expense_payments
      const manual = new Set<string>();
      for (const id of paidIds) {
        if (!linkedIds.has(id)) manual.add(id);
      }
      setManuallyPaidIds(manual);
      // مسدد مباشر = جميع صفوف expense_payments له بـ paid_via='direct' وبدون distributed_payment_id
      const byExpense: Record<string, any[]> = {};
      for (const p of payRows || []) {
        const eid = (p as any).expense_id as string;
        (byExpense[eid] = byExpense[eid] || []).push(p);
      }
      const direct = new Set<string>();
      for (const [eid, rows] of Object.entries(byExpense)) {
        const allDirect = rows.every((p: any) =>
          !p.distributed_payment_id && (p.paid_via || '') === 'direct'
        );
        if (allDirect) direct.add(eid);
      }
      setDirectPaidIds(direct);
    } catch (err) {
      console.warn('Failed to load payment sources:', err);
    }
  };
  
  // Pay employee form
  const [payEmployeeId, setPayEmployeeId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('نقدي');
  const [payReference, setPayReference] = useState('');
  const [payNotes, setPayNotes] = useState('');

  const [newEmployee, setNewEmployee] = useState<Partial<Employee>>({
    name: '',
    position: '',
    base_salary: 0,
    hire_date: new Date().toISOString().split('T')[0],
    status: 'active',
    phone: '',
    email: ''
  });

  const [newExpense, setNewExpense] = useState<Partial<Expense>>({
    description: '',
    amount: 0,
    category: '',
    expense_date: new Date().toISOString().split('T')[0],
    payment_method: '',
    payment_status: 'unpaid',
    employee_id: '',
    notes: '',
    receiver_name: '',
    sender_name: ''
  });

  const [newWithdrawal, setNewWithdrawal] = useState<Partial<Withdrawal>>({
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    method: 'نقدي',
    note: '',
    type: 'individual'
  });

  const [newClosure, setNewClosure] = useState<Partial<PeriodClosure>>({
    closure_date: new Date().toISOString().split('T')[0],
    period_start: '',
    period_end: '',
    closure_type: 'contract_range',
    notes: '',
    contract_start: undefined,
    contract_end: undefined
  });

  const loadData = async () => {
    try {
      setLoading(true);

      // Load employees
      const { data: employeesData, error: empError } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false });

      if (empError) {
        console.error('Error loading employees:', empError);
      } else if (employeesData) {
        setEmployees(employeesData);
      }

      // Load expenses
      const { data: expensesData, error: expError } = await supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false });

      if (expError) {
        console.error('Error loading expenses:', expError);
      } else if (expensesData) {
        setExpenses(expensesData);
        // ✅ تحميل مصدر السداد + معرّفات المسددة يدوياً
        await loadPaymentSourcesAndManual(expensesData);
      }

      // ✅ تحميل حسابات العهدة النشطة (لاستخدامها في نموذج المصروف)
      const { data: custodyData } = await supabase
        .from('custody_accounts')
        .select('id, account_number, employee_id, current_balance, status')
        .eq('status', 'active')
        .order('account_number', { ascending: true });
      if (custodyData) {
        setCustodyAccounts(
          custodyData.map((c: any) => ({
            id: c.id,
            account_number: c.account_number,
            employee_id: c.employee_id,
            current_balance: Number(c.current_balance) || 0,
          })),
        );
      }

      // Load expense categories
      const { data: categoriesData, error: catError } = await supabase
        .from('expense_categories')
        .select('*');

      if (!catError && categoriesData) {
        setCategories(categoriesData);
      }

      // Load withdrawals
      const { data: withdrawalsData, error: wError } = await supabase
        .from('expenses_withdrawals')
        .select('*')
        .order('date', { ascending: false });

      if (wError) {
        console.error('Error loading withdrawals:', wError);
      } else if (withdrawalsData) {
        setWithdrawals(withdrawalsData);
      }

      // Load period closures
      const { data: closuresData, error: cError } = await supabase
        .from('period_closures')
        .select('*')
        .order('created_at', { ascending: false });

      if (cError) {
        console.error('Error loading closures:', cError);
      } else if (closuresData) {
        setClosures(closuresData);
      }

      // Load employee credit entries
      const { data: creditData } = await supabase
        .from('employee_credit_entries')
        .select('*')
        .order('entry_date', { ascending: false });
      
      if (creditData) {
        setCreditEntries(creditData);
      }

      // Calculate employee dues
      const duesMap: Record<string, EmployeeDue> = {};
      (creditData || []).forEach((entry: any) => {
        if (!duesMap[entry.employee_id]) {
          const emp = (employeesData || []).find(e => e.id === entry.employee_id);
          duesMap[entry.employee_id] = {
            employee_id: entry.employee_id,
            employee_name: emp?.name || 'غير معروف',
            position: emp?.position || '',
            total_credit: 0,
            total_debit: 0,
            balance: 0
          };
        }
        if (entry.entry_type === 'credit') {
          duesMap[entry.employee_id].total_credit += Number(entry.amount) || 0;
        } else {
          duesMap[entry.employee_id].total_debit += Number(entry.amount) || 0;
        }
      });
      Object.values(duesMap).forEach(d => { d.balance = d.total_credit - d.total_debit; });
      setEmployeeDues(Object.values(duesMap).filter(d => d.balance !== 0 || d.total_credit > 0));

      // Calculate stats
      const totalExpenses = (expensesData || [])
        .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);

      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const monthlyExpenses = (expensesData || [])
        .filter(expense => {
          const expenseDate = new Date(expense.expense_date);
          return expenseDate.getMonth() === currentMonth && 
                 expenseDate.getFullYear() === currentYear;
        })
        .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);

      const totalSalaries = (employeesData || [])
        .filter(emp => emp.status === 'active')
        .reduce((sum, emp) => sum + (Number(emp.base_salary) || 0), 0);

      const activeEmployees = (employeesData || [])
        .filter(emp => emp.status === 'active').length;

      const totalWithdrawals = (withdrawalsData || [])
        .reduce((sum, w) => sum + (Number(w.amount) || 0), 0);

      const unpaidExpenses = (expensesData || [])
        .filter(e => e.payment_status !== 'paid')
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      const totalEmployeeDues = Object.values(duesMap)
        .reduce((sum, d) => sum + Math.max(0, d.balance), 0);

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

      const { data: contractsData } = await supabase
        .from('Contract')
        .select('Contract_Number, "Total Rent", operating_fee_rate');
      
      const { data: paymentsData } = await supabase
        .from('customer_payments')
        .select('contract_number, amount, entry_type')
        .order('created_at', { ascending: true });

      const paidByContract: Record<string, number> = {};
      (paymentsData || []).forEach((p: any) => {
        const type = String(p.entry_type || '');
        if (type === 'receipt' || type === 'account_payment' || type === 'payment') {
          const key = String(p.contract_number || '');
          if (!key) return;
          paidByContract[key] = (paidByContract[key] || 0) + (Number(p.amount) || 0);
        }
      });
      
      const uncoveredContracts = (contractsData || []).filter(c => {
        const contractNum = c.Contract_Number;
        const isExcluded = excludedSet.has(String(contractNum));
        const isClosed = isContractCoveredByClosure(contractNum);
        return !isExcluded && !isClosed;
      });

      const totalOperatingDues = uncoveredContracts.reduce((sum, c) => {
        const feeRate = Number(c.operating_fee_rate) || 0;
        const totalPaid = paidByContract[String(c.Contract_Number)] || 0;
        const collectedFeeAmount = Math.round(totalPaid * (feeRate / 100));
        return sum + collectedFeeAmount;
      }, 0);

      const remainingBalance = totalOperatingDues - totalWithdrawals;

      setStats({
        totalExpenses,
        monthlyExpenses,
        totalSalaries,
        activeEmployees,
        totalWithdrawals,
        remainingBalance,
        unpaidExpenses,
        employeeDues: totalEmployeeDues
      });

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveEmployee = async () => {
    try {
      const employeeData = editingEmployee || newEmployee;
      
      if (!employeeData.name || !employeeData.position || !employeeData.base_salary) {
        toast.error('يرجى ملء جميع الحقول المطلوبة');
        return;
      }

      if (editingEmployee) {
        const { error } = await supabase
          .from('employees')
          .update(employeeData)
          .eq('id', editingEmployee.id);
        
        if (error) throw error;
        toast.success('تم تحديث بيانات الموظف');
      } else {
        const { error } = await supabase
          .from('employees')
          .insert([employeeData]);
        
        if (error) throw error;
        toast.success('تم إضافة الموظف بنجاح');
      }

      setShowEmployeeDialog(false);
      setEditingEmployee(null);
      setNewEmployee({
        name: '',
        position: '',
        base_salary: 0,
        hire_date: new Date().toISOString().split('T')[0],
        status: 'active',
        phone: '',
        email: ''
      });
      
      loadData();
    } catch (error) {
      console.error('Error saving employee:', error);
      toast.error('فشل في حفظ بيانات الموظف');
    }
  };

  const saveExpense = async () => {
    try {
      const expenseData = editingExpense || newExpense;
      
      if (!expenseData.description || !expenseData.amount || !expenseData.category) {
        toast.error('يرجى ملء جميع الحقول المطلوبة');
        return;
      }

      // ✅ التحقق من سداد المصروف من عهدة موظف (للإضافة الجديدة فقط)
      const isCustodyMode = expenseData.payment_method === 'عهدة موظف';
      const isNew = !editingExpense;
      let custodyAcc: typeof custodyAccounts[number] | undefined;
      if (isCustodyMode && isNew) {
        if (!selectedCustodyAccountId) {
          toast.error('يرجى اختيار حساب العهدة');
          return;
        }
        custodyAcc = custodyAccounts.find(c => c.id === selectedCustodyAccountId);
        if (!custodyAcc) {
          toast.error('حساب العهدة غير صالح');
          return;
        }
        if (Number(expenseData.amount) > custodyAcc.current_balance) {
          toast.error('المبلغ يتجاوز الرصيد المتاح في العهدة');
          return;
        }
      }

      // Clean up empty employee_id
      const status = expenseData.payment_status || 'unpaid';
      const dataToSave: any = {
        ...expenseData,
        employee_id: expenseData.employee_id || null,
        payment_status: status,
        paid_date: status === 'paid' ? (expenseData.paid_date || new Date().toISOString().split('T')[0]) : null,
      };
      // Force-reset paid_amount when user manually sets to unpaid (DB trigger also enforces this)
      if (status === 'unpaid') {
        dataToSave.paid_amount = 0;
      } else if (status === 'paid') {
        dataToSave.paid_amount = Number(expenseData.amount) || 0;
      }

      if (editingExpense) {
        const { error } = await supabase
          .from('expenses')
          .update(dataToSave)
          .eq('id', editingExpense.id);
        
        if (error) throw error;
        toast.success('تم تحديث المصروف');
      } else {
        const { data: insertedData, error } = await supabase
          .from('expenses')
          .insert([dataToSave])
          .select()
          .single();
        
        if (error) throw error;

        // ✅ سداد من عهدة موظف: إنشاء سجل في expense_payments + custody_expenses
        if (insertedData && isCustodyMode && custodyAcc) {
          const employeeName = employees.find(e => e.id === custodyAcc.employee_id)?.name || '';
          const [payRes, custodyExpRes] = await Promise.all([
            supabase.from('expense_payments').insert({
              expense_id: insertedData.id,
              amount: Number(dataToSave.amount),
              paid_via: 'direct',
              payment_source: `custody:${custodyAcc.id}`,
              notes: `سداد من عهدة ${employeeName} - حساب ${custodyAcc.account_number}`,
            }),
            supabase.from('custody_expenses').insert({
              custody_account_id: custodyAcc.id,
              expense_category: dataToSave.category,
              amount: Number(dataToSave.amount),
              expense_date: dataToSave.expense_date,
              description: dataToSave.description,
              vendor_name: dataToSave.receiver_name || null,
              notes: `مرتبط بمصروف #${insertedData.id}`,
            }),
          ]);
          if (payRes.error || custodyExpRes.error) {
            console.error('Custody linkage error:', payRes.error || custodyExpRes.error);
            toast.warning('تم حفظ المصروف لكن فشل ربطه بالعهدة بشكل كامل');
          } else {
            toast.success(`تم خصم ${Number(dataToSave.amount).toLocaleString('en-US')} د.ل من عهدة ${employeeName}`);
          }
        } else if (insertedData && dataToSave.employee_id) {
          // ✅ قيد محاسبي آلي: إذا تم تحديد موظف (غير عهدة)، أضف رصيد دائن
          // Get current balance for this employee
          const { data: lastEntry } = await supabase
            .from('employee_credit_entries')
            .select('balance_after')
            .eq('employee_id', dataToSave.employee_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          const currentBalance = lastEntry?.balance_after || 0;
          const newBalance = currentBalance + Number(dataToSave.amount);

          await supabase.from('employee_credit_entries').insert({
            employee_id: dataToSave.employee_id,
            expense_id: insertedData.id,
            entry_type: 'credit',
            amount: Number(dataToSave.amount),
            balance_after: newBalance,
            description: `مصروف: ${dataToSave.description}`,
            entry_date: dataToSave.expense_date,
            notes: `تم إضافة رصيد تلقائي - صرف الموظف من حسابه الخاص`
          });
          
          toast.success('تم إضافة رصيد دائن للموظف تلقائياً');
        }
        
        toast.success('تم إضافة المصروف بنجاح');
      }

      setShowExpenseDialog(false);
      setEditingExpense(null);
      setSelectedCustodyAccountId('');
      setNewExpense({
        description: '',
        amount: 0,
        category: categoryOptions.includes('أخرى') ? 'أخرى' : (categoryOptions[0] || ''),
        expense_date: new Date().toISOString().split('T')[0],
        payment_method: '',
        payment_status: 'unpaid',
        employee_id: '',
        notes: '',
        receiver_name: '',
        sender_name: ''
      });
      
      loadData();
    } catch (error) {
      console.error('Error saving expense:', error);
      toast.error('فشل في حفظ المصروف');
    }
  };

  // ✅ تسكير المصروف (Mark as Paid)
  const markExpenseAsPaid = async (expense: Expense, method: string = 'نقدي') => {
    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          payment_status: 'paid',
          paid_date: new Date().toISOString().split('T')[0],
          payment_method: method
        })
        .eq('id', expense.id);
      
      if (error) throw error;
      toast.success('تم تسكير المصروف بنجاح');
      loadData();
    } catch (error) {
      console.error('Error marking expense as paid:', error);
      toast.error('فشل في تسكير المصروف');
    }
  };

  // ✅ سداد مستحقات موظف
  const payEmployeeDue = async () => {
    if (!payEmployeeId || !payAmount || Number(payAmount) <= 0) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      const { data: lastEntry } = await supabase
        .from('employee_credit_entries')
        .select('balance_after')
        .eq('employee_id', payEmployeeId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const currentBalance = lastEntry?.balance_after || 0;
      const newBalance = currentBalance - Number(payAmount);

      const { error } = await supabase.from('employee_credit_entries').insert({
        employee_id: payEmployeeId,
        entry_type: 'debit',
        amount: Number(payAmount),
        balance_after: newBalance,
        description: 'سداد مستحقات للموظف',
        payment_method: payMethod,
        reference_number: payReference || null,
        entry_date: new Date().toISOString().split('T')[0],
        notes: payNotes || null
      });

      if (error) throw error;
      toast.success('تم سداد المستحقات بنجاح');
      setShowPayEmployeeDialog(false);
      setPayEmployeeId('');
      setPayAmount('');
      setPayMethod('نقدي');
      setPayReference('');
      setPayNotes('');
      loadData();
    } catch (error) {
      console.error('Error paying employee:', error);
      toast.error('فشل في سداد المستحقات');
    }
  };

  // ✅ إنشاء موظف سريع من نموذج المصروف وربطه فوراً
  const saveQuickEmployee = async () => {
    const name = quickEmployeeName.trim();
    if (!name) {
      toast.error('الرجاء إدخال اسم الموظف');
      return;
    }
    setQuickEmployeeSaving(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .insert({
          name,
          position: quickEmployeePosition.trim() || 'موظف',
          base_salary: Number(quickEmployeeSalary) || 0,
          hire_date: new Date().toISOString().split('T')[0],
          status: 'active',
        })
        .select()
        .single();
      if (error) throw error;
      toast.success('تم إنشاء الموظف وربطه بالمصروف');
      // Reload employees & link
      await loadData();
      const newId = (data as any)?.id as string;
      if (newId) {
        if (editingExpense) {
          setEditingExpense({ ...editingExpense, employee_id: newId, sender_name: name });
        } else {
          setNewExpense({ ...newExpense, employee_id: newId, sender_name: name });
        }
      }
      setShowQuickEmployeeDialog(false);
    } catch (err: any) {
      console.error('Quick employee create failed', err);
      toast.error(`فشل إنشاء الموظف: ${err?.message || 'خطأ'}`);
    } finally {
      setQuickEmployeeSaving(false);
    }
  };

  // ✅ طباعة كشف المصروفات

  const printExpenseStatement = async () => {
    const filtered = filteredExpenses;
    if (filtered.length === 0) {
      toast.error('لا توجد مصروفات للطباعة');
      return;
    }

    const totalAmount = filtered.reduce((sum, e) => sum + Number(e.amount), 0);
    const paidAmount = filtered.reduce((sum, e) => sum + Number(e.paid_amount || (e.payment_status === 'paid' ? e.amount : 0)), 0);
    const unpaidAmount = Math.max(0, totalAmount - paidAmount);

    // ✅ نستخدم خريطة مصدر السداد المحملة في loadData (يوحّدها مع الجدول)
    const sourceByExpenseId = paymentSourceMap;

    // ✅ يستخدم نفس الشعار من إعدادات الطباعة (مثل بقية التقارير)
    const config = createMeasurementsConfigFromSettings({
      ...(expensePrintSettings || {}),
      document_title_ar: 'كشف المصروفات',
    } as any);

    const additionalInfo: { label: string; value: string }[] = [];
    if (filterDateFrom) additionalInfo.push({ label: 'من', value: filterDateFrom });
    if (filterDateTo) additionalInfo.push({ label: 'إلى', value: filterDateTo });
    if (filterCategory !== 'all') additionalInfo.push({ label: 'الصنف', value: filterCategory });
    if (filterStatus !== 'all') additionalInfo.push({ label: 'الحالة', value: filterStatus === 'paid' ? 'مسدد' : 'غير مسدد' });
    if (filterEmployee !== 'all') {
      additionalInfo.push({ label: 'الموظف', value: employees.find(e => e.id === filterEmployee)?.name || '-' });
    }
    additionalInfo.push({ label: 'عدد المصروفات', value: String(filtered.length) });

    const columns = [
      { key: 'idx', header: '#', width: '5%', align: 'center' as const },
      { key: 'date', header: 'التاريخ', width: '10%', align: 'center' as const },
      { key: 'description', header: 'الوصف', align: 'right' as const },
      { key: 'category', header: 'الصنف', width: '10%', align: 'center' as const },
      { key: 'employee', header: 'الموظف', width: '12%', align: 'center' as const },
      { key: 'status', header: 'الحالة', width: '9%', align: 'center' as const },
      { key: 'source', header: 'مصدر السداد', width: '18%', align: 'center' as const },
      { key: 'amount', header: 'المبلغ', width: '11%', align: 'center' as const },
    ];

    const rows = filtered.map((e, i) => ({
      idx: i + 1,
      date: format(new Date(e.expense_date), 'dd/MM/yyyy'),
      description: e.description || '-',
      category: e.category || '-',
      employee: e.employee_id ? (employees.find(emp => emp.id === e.employee_id)?.name || '-') : '-',
 status: e.payment_status === 'paid' ? ' مسدد' : ' غير مسدد',
      source: e.payment_status !== 'unpaid' ? (sourceByExpenseId[e.id] || e.payment_method || '-') : '-',
      amount: `${Number(e.amount).toLocaleString('en-US')} د.ل`,
    }));

    const totals = [
      { label: 'إجمالي المصروفات', value: `${totalAmount.toLocaleString('en-US')} د.ل`, bold: true },
      { label: 'المسدد', value: `${paidAmount.toLocaleString('en-US')} د.ل` },
      { label: 'غير المسدد', value: `${unpaidAmount.toLocaleString('en-US')} د.ل`, bold: true, highlight: true },
    ];

    const html = generateMeasurementsHTML({
      config,
      documentData: {
        title: 'كشف المصروفات',
        date: format(new Date(), 'dd/MM/yyyy', { locale: ar }),
        additionalInfo,
      },
      columns,
      rows,
      totals,
      totalsTitle: 'الإجمالي',
    });

    const w = window.open('', '_blank', 'width=1000,height=800');
    if (!w) {
      toast.error('فشل فتح نافذة الطباعة - تأكد من السماح للنوافذ المنبثقة');
      return;
    }
    w.document.write(html);
    w.document.close();
    w.onload = () => setTimeout(() => { w.focus(); w.print(); }, 500);
  };



  // ✅ المصروفات المفلترة
  const filteredExpenses = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    return expenses.filter(e => {
      if (filterCategory !== 'all' && e.category !== filterCategory) return false;
      if (filterStatus !== 'all' && e.payment_status !== filterStatus) return false;
      if (filterEmployee !== 'all' && e.employee_id !== filterEmployee) return false;
      if (filterDateFrom && e.expense_date < filterDateFrom) return false;
      if (filterDateTo && e.expense_date > filterDateTo) return false;
      if (q) {
        const hay = `${e.description || ''} ${e.receiver_name || ''} ${e.sender_name || ''} ${e.notes || ''} ${e.category || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      const da = a.expense_date || (a as any).created_at || '';
      const db = b.expense_date || (b as any).created_at || '';
      if (db !== da) return db.localeCompare(da);
      return ((b as any).created_at || '').localeCompare((a as any).created_at || '');
    });
  }, [expenses, filterCategory, filterStatus, filterEmployee, filterDateFrom, filterDateTo, filterSearch]);

  // ✅ ملخّصات تبويب المصروفات (مبنية على المصروفات المفلترة)
  const expensesSummary = useMemo(() => {
    const total = filteredExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const paid = filteredExpenses.reduce(
      (s, e) => s + Number((e as any).paid_amount || (e.payment_status === 'paid' ? e.amount : 0)),
      0,
    );
    const unpaid = Math.max(0, total - paid);
    return { total, paid, unpaid, count: filteredExpenses.length };
  }, [filteredExpenses]);

  // ✅ إعادة فتح/تعديل حالة سداد مصروف مسدّد يدوياً
  const reopenManualExpense = async () => {
    if (!reopenExpense) return;
    setReopenSaving(true);
    try {
      // إذا كان المصروف مسدداً عبر "سداد مباشر"، نحذف صفوف expense_payments المباشرة ونعيد رصيد العهدة عند اللزوم
      const { data: directRows } = await supabase
        .from('expense_payments')
        .select('id, amount, payment_source')
        .eq('expense_id', reopenExpense.id)
        .eq('paid_via', 'direct')
        .is('distributed_payment_id', null);

      for (const row of (directRows || []) as any[]) {
        const src: string = row.payment_source || '';
        const m = src.match(/^custody:([0-9a-f-]{8,})/i);
        if (m) {
          const custodyId = m[1];
          // حذف صف custody_expenses المرتبط
          await supabase
            .from('custody_expenses')
            .delete()
            .eq('custody_account_id', custodyId)
            .eq('expense_category', 'expense_payment')
            .like('notes', `%expense_id=${reopenExpense.id}%`);
          // إعادة المبلغ لرصيد العهدة
          const { data: acc } = await supabase
            .from('custody_accounts')
            .select('current_balance')
            .eq('id', custodyId)
            .maybeSingle();
          if (acc) {
            await supabase
              .from('custody_accounts')
              .update({ current_balance: Number((acc as any).current_balance || 0) + Number(row.amount || 0) })
              .eq('id', custodyId);
          }
        }
      }

      if ((directRows || []).length > 0) {
        await supabase
          .from('expense_payments')
          .delete()
          .eq('expense_id', reopenExpense.id)
          .eq('paid_via', 'direct')
          .is('distributed_payment_id', null);
      }

      const { error } = await supabase
        .from('expenses')
        .update({
          payment_status: 'unpaid',
          paid_amount: 0,
          paid_date: null,
        })
        .eq('id', reopenExpense.id);
      if (error) throw error;
      toast.success('تم إلغاء السداد وإعادة فتح المصروف بنجاح');
      setReopenExpense(null);
      loadData();
    } catch (err: any) {
      console.error(err);
      toast.error('فشل في إعادة فتح المصروف: ' + (err?.message || 'خطأ'));
    } finally {
      setReopenSaving(false);
    }
  };

  const deleteEmployee = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الموظف؟')) return;
    
    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('تم حذف الموظف');
      loadData();
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast.error('فشل في حذف الموظف');
    }
  };

  const deleteExpense = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;
    
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('تم حذف المصروف');
      loadData();
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast.error('فشل في حذف المصروف');
    }
  };

  const saveWithdrawal = async () => {
    try {
      const withdrawalData = editingWithdrawal || newWithdrawal;
      
      if (!withdrawalData.amount || withdrawalData.amount <= 0) {
        toast.error('يرجى إدخال مبلغ صحيح');
        return;
      }

      if (editingWithdrawal) {
        const { error } = await supabase
          .from('expenses_withdrawals')
          .update(withdrawalData)
          .eq('id', editingWithdrawal.id);
        
        if (error) throw error;
        toast.success('تم تحديث السحب');
      } else {
        const { error } = await supabase
          .from('expenses_withdrawals')
          .insert([withdrawalData]);
        
        if (error) throw error;
        toast.success('تم إضافة السحب بنجاح');
      }

      setShowWithdrawalDialog(false);
      setEditingWithdrawal(null);
      setNewWithdrawal({
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        method: 'نقدي',
        note: '',
        type: 'individual'
      });
      
      loadData();
    } catch (error) {
      console.error('Error saving withdrawal:', error);
      toast.error('فشل في إضافة السحب: ' + (error as Error).message);
    }
  };

  const deleteWithdrawal = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا السحب؟')) return;
    
    try {
      const { error } = await supabase
        .from('expenses_withdrawals')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('تم حذف السحب');
      loadData();
    } catch (error) {
      console.error('Error deleting withdrawal:', error);
      toast.error('فشل في حذف السحب');
    }
  };

  const saveClosure = async () => {
    try {
      const closureData = editingClosure || newClosure;
      
      // التحقق حسب نوع التسكير
      if (!closureData.closure_date) {
        toast.error('يرجى تحديد تاريخ التسكير');
        return;
      }
      
      if (closureData.closure_type === 'contract_range') {
        if (!closureData.contract_start || !closureData.contract_end) {
          toast.error('يرجى تحديد نطاق العقود (من - إلى)');
          return;
        }
      } else {
        if (!closureData.period_start || !closureData.period_end) {
          toast.error('يرجى تحديد الفترة الزمنية (من - إلى)');
          return;
        }
      }

      if (editingClosure) {
        const { error } = await supabase
          .from('period_closures')
          .update(closureData)
          .eq('id', editingClosure.id);
        
        if (error) throw error;
        toast.success('تم تحديث التسكير');
      } else {
        const { error } = await supabase
          .from('period_closures')
          .insert([closureData]);
        
        if (error) throw error;
        toast.success('تم إضافة التسكير بنجاح');
      }

      setShowClosureDialog(false);
      setEditingClosure(null);
      setNewClosure({
        closure_date: new Date().toISOString().split('T')[0],
        period_start: '',
        period_end: '',
        closure_type: 'contract_range',
        notes: '',
        contract_start: undefined,
        contract_end: undefined
      });
      
      loadData();
    } catch (error) {
      console.error('Error saving closure:', error);
      toast.error('فشل في حفظ التسكير: ' + (error as Error).message);
    }
  };

  const deleteClosure = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا التسكير؟')) return;
    
    try {
      const { error } = await supabase
        .from('period_closures')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('تم حذف التسكير');
      loadData();
    } catch (error) {
      console.error('Error deleting closure:', error);
      toast.error('فشل في حذف التسكير');
    }
  };

  const exportData = () => {
    if (expenses.length === 0) {
      toast.error('لا توجد بيانات للتصدير');
      return;
    }

    const csvData = expenses.map(expense => ({
      'التاريخ': format(new Date(expense.expense_date), 'dd/MM/yyyy', { locale: ar }),
      'الوصف': expense.description,
      'المبلغ': expense.amount,
      'الفئة': expense.category,
      'طريقة الدفع': expense.payment_method,
      'ملاحظات': expense.notes || ''
    }));
    
    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const categoryOptions = useMemo(() => {
    if (categories.length > 0) {
      return categories.map(c => c.name);
    }
    // Default categories if none in database
    return [
      'مرتبات',
      'إيجارات',
      'كهرباء وماء',
      'صيانة',
      'وقود ومواصلات',
      'مواد خام',
      'تسويق وإعلان',
      'مصاريف إدارية',
      'أخرى'
    ];
  }, [categories]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Premium Header Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/15 p-6 md:p-8 backdrop-blur-sm shadow-sm">
          <div className="absolute right-0 top-0 -z-10 h-32 w-32 rounded-full bg-primary/5 blur-3xl"></div>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                onClick={() => navigate(-1)}
                className="shrink-0 rounded-xl border border-border bg-card h-10 w-10 p-0"
              >
                <ArrowRight className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">إدارة المصروفات والمرتبات</h1>
                <p className="text-muted-foreground text-sm mt-1">
                  تتبع هيكل النفقات، مرتبات الموظفين، العهد، والتسويات المالية
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
              <Button variant="outline" onClick={() => navigate('/admin/expenses-report')} className="h-10 text-xs font-semibold gap-1.5 flex-1 sm:flex-none">
                <FileText className="h-3.5 w-3.5 text-primary" /> كشف المصروفات التفصيلي
              </Button>
              <Button variant="outline" onClick={exportData} className="h-10 text-xs font-semibold gap-1.5 flex-1 sm:flex-none">
                <Download className="h-3.5 w-3.5 text-primary" /> تصدير التقرير
              </Button>
              <Button variant="outline" onClick={loadData} disabled={loading} className="h-10 text-xs font-semibold gap-1.5 flex-1 sm:flex-none">
                <RefreshCw className={`h-3.5 w-3.5 text-primary ${loading ? 'animate-spin' : ''}`} /> تحديث
              </Button>
            </div>
          </div>
        </div>

        {/* Styled Executive Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <Card className="border-red-500/20 bg-red-500/[0.02] hover:bg-red-500/[0.04] transition-all shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-bold text-red-600 dark:text-red-400">إجمالي المصروفات</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-lg font-black text-red-700 dark:text-red-300 font-numbers truncate">
                {stats.totalExpenses.toLocaleString('en-US')} <span className="text-[10px] font-semibold text-muted-foreground">د.ل</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-500/20 bg-amber-500/[0.02] hover:bg-amber-500/[0.04] transition-all shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-bold text-amber-600 dark:text-amber-400">إجمالي المسحوبات</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-lg font-black text-amber-700 dark:text-amber-300 font-numbers truncate">
                {stats.totalWithdrawals.toLocaleString('en-US')} <span className="text-[10px] font-semibold text-muted-foreground">د.ل</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-500/20 bg-emerald-500/[0.02] hover:bg-emerald-500/[0.04] transition-all shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-bold text-emerald-600 dark:text-emerald-400">الرصيد المتبقي</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-lg font-black text-emerald-700 dark:text-emerald-300 font-numbers truncate">
                {stats.remainingBalance.toLocaleString('en-US')} <span className="text-[10px] font-semibold text-muted-foreground">د.ل</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-500/20 bg-blue-500/[0.02] hover:bg-blue-500/[0.04] transition-all shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-bold text-blue-600 dark:text-blue-400">مصروفات الشهر</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-lg font-black text-blue-700 dark:text-blue-300 font-numbers truncate">
                {stats.monthlyExpenses.toLocaleString('en-US')} <span className="text-[10px] font-semibold text-muted-foreground">د.ل</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-500/20 bg-purple-500/[0.02] hover:bg-purple-500/[0.04] transition-all shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-bold text-purple-600 dark:text-purple-400">إجمالي المرتبات</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-lg font-black text-purple-700 dark:text-purple-300 font-numbers truncate">
                {stats.totalSalaries.toLocaleString('en-US')} <span className="text-[10px] font-semibold text-muted-foreground">د.ل</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-cyan-500/20 bg-cyan-500/[0.02] hover:bg-cyan-500/[0.04] transition-all shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-bold text-cyan-600 dark:text-cyan-400">الموظفين النشطين</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-lg font-black text-cyan-700 dark:text-cyan-300 font-numbers truncate">
                {stats.activeEmployees}
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-500/20 bg-orange-500/[0.02] hover:bg-orange-500/[0.04] transition-all shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-bold text-orange-600 dark:text-orange-400">غير مسددة</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-lg font-black text-orange-700 dark:text-orange-300 font-numbers truncate">
                {stats.unpaidExpenses.toLocaleString('en-US')} <span className="text-[10px] font-semibold text-muted-foreground">د.ل</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-rose-500/20 bg-rose-500/[0.02] hover:bg-rose-500/[0.04] transition-all shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-bold text-rose-600 dark:text-rose-400">مستحقات موظفين</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-lg font-black text-rose-700 dark:text-rose-300 font-numbers truncate">
                {stats.employeeDues.toLocaleString('en-US')} <span className="text-[10px] font-semibold text-muted-foreground">د.ل</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="expenses" className="space-y-4">
          <TabsList className="bg-muted/50 p-1 w-full overflow-x-auto flex flex-nowrap justify-start h-auto gap-1">
            <TabsTrigger value="expenses" className="font-bold text-xs shrink-0 py-2">المصروفات</TabsTrigger>
            <TabsTrigger value="payments-log" className="font-bold text-xs shrink-0 py-2">سجل التسديدات</TabsTrigger>
            <TabsTrigger value="employee-dues" className="font-bold text-xs shrink-0 py-2">مستحقات الموظفين</TabsTrigger>
            <TabsTrigger value="withdrawals" className="font-bold text-xs shrink-0 py-2">سجل المسحوبات</TabsTrigger>
            <TabsTrigger value="closures" className="font-bold text-xs shrink-0 py-2">سجل التسكيرات</TabsTrigger>
            <TabsTrigger value="employees" className="font-bold text-xs shrink-0 py-2">الموظفين</TabsTrigger>
          </TabsList>

          {/* Expense Payments Log Tab */}
          <TabsContent value="payments-log">
            <Card>
              <CardHeader>
                <CardTitle>سجل تسديدات المصاريف</CardTitle>
              </CardHeader>
              <CardContent>
                <ExpensePaymentsLogTable employees={employees.map(e => ({ id: e.id, name: e.name }))} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Withdrawals Tab */}
          <TabsContent value="withdrawals">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>المسحوبات والسحوبات</CardTitle>
                <Dialog open={showWithdrawalDialog} onOpenChange={setShowWithdrawalDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setEditingWithdrawal(null);
                      setNewWithdrawal({
                        amount: 0,
                        date: new Date().toISOString().split('T')[0],
                        method: 'نقدي',
                        note: '',
                        type: 'individual'
                      });
                    }}>
                      <Plus className="h-4 w-4 ml-2" />
                      إضافة سحب
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>
                        {editingWithdrawal ? 'تعديل السحب' : 'إضافة سحب جديد'}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>المبلغ</Label>
                        <Input
                          type="number"
                          value={editingWithdrawal ? editingWithdrawal.amount : newWithdrawal.amount}
                          onChange={(e) => {
                            if (editingWithdrawal) {
                              setEditingWithdrawal({ ...editingWithdrawal, amount: Number(e.target.value) });
                            } else {
                              setNewWithdrawal({ ...newWithdrawal, amount: Number(e.target.value) });
                            }
                          }}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label>التاريخ</Label>
                        <Input
                          type="date"
                          value={editingWithdrawal ? editingWithdrawal.date : newWithdrawal.date}
                          onChange={(e) => {
                            if (editingWithdrawal) {
                              setEditingWithdrawal({ ...editingWithdrawal, date: e.target.value });
                            } else {
                              setNewWithdrawal({ ...newWithdrawal, date: e.target.value });
                            }
                          }}
                        />
                      </div>
                      <div>
                        <Label>طريقة الدفع</Label>
                        <Select
                          value={editingWithdrawal ? editingWithdrawal.method : newWithdrawal.method}
                          onValueChange={(value) => {
                            if (editingWithdrawal) {
                              setEditingWithdrawal({ ...editingWithdrawal, method: value });
                            } else {
                              setNewWithdrawal({ ...newWithdrawal, method: value });
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {paymentMethods.map(method => (
                              <SelectItem key={method} value={method}>{method}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>ملاحظات</Label>
                        <Textarea
                          value={editingWithdrawal ? (editingWithdrawal.note || editingWithdrawal.notes) : (newWithdrawal.note || '')}
                          onChange={(e) => {
                            if (editingWithdrawal) {
                              setEditingWithdrawal({ ...editingWithdrawal, note: e.target.value, notes: e.target.value });
                            } else {
                              setNewWithdrawal({ ...newWithdrawal, note: e.target.value, notes: e.target.value });
                            }
                          }}
                          placeholder="ملاحظات إضافية"
                        />
                      </div>
                      <Button onClick={saveWithdrawal} className="w-full">
                        حفظ
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>المبلغ</TableHead>
                      <TableHead>الطريقة</TableHead>
                      <TableHead>ملاحظات</TableHead>
                      <TableHead>إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          لا توجد مسحوبات مسجلة
                        </TableCell>
                      </TableRow>
                    ) : (
                      withdrawals.map((withdrawal) => (
                        <TableRow key={withdrawal.id}>
                          <TableCell>
                            {format(new Date(withdrawal.date), 'dd/MM/yyyy', { locale: ar })}
                          </TableCell>
                          <TableCell className="font-bold text-destructive">
                            {Number(withdrawal.amount).toLocaleString('en-US')} د.ل
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{withdrawal.method}</Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {withdrawal.note || withdrawal.notes || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingWithdrawal(withdrawal);
                                  setShowWithdrawalDialog(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteWithdrawal(withdrawal.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Closures Tab */}
          <TabsContent value="closures">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>سجل تسكير الفترات</CardTitle>
                <Dialog open={showClosureDialog} onOpenChange={setShowClosureDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setEditingClosure(null);
                      setNewClosure({
                        closure_date: new Date().toISOString().split('T')[0],
                        period_start: '',
                        period_end: '',
                        closure_type: 'contract_range',
                        notes: '',
                        contract_start: undefined,
                        contract_end: undefined
                      });
                    }}>
                      <Plus className="h-4 w-4 ml-2" />
                      إضافة تسكير
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>
                        {editingClosure ? 'تعديل التسكير' : 'إضافة تسكير جديد'}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>تاريخ التسكير</Label>
                          <Input
                            type="date"
                            value={editingClosure ? editingClosure.closure_date : newClosure.closure_date}
                            onChange={(e) => {
                              if (editingClosure) {
                                setEditingClosure({ ...editingClosure, closure_date: e.target.value });
                              } else {
                                setNewClosure({ ...newClosure, closure_date: e.target.value });
                              }
                            }}
                          />
                        </div>
                        <div>
                          <Label>نوع التسكير</Label>
                          <Select
                            value={editingClosure ? editingClosure.closure_type : newClosure.closure_type}
                            onValueChange={(value) => {
                              if (editingClosure) {
                                setEditingClosure({ ...editingClosure, closure_type: value });
                              } else {
                                setNewClosure({ ...newClosure, closure_type: value });
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="contract_range">نطاق عقود</SelectItem>
                              <SelectItem value="period">فترة زمنية</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* حقول نطاق العقود */}
                      {(editingClosure?.closure_type === 'contract_range' || (!editingClosure && newClosure.closure_type === 'contract_range')) && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>من عقد رقم</Label>
                            <Input
                              type="number"
                              value={editingClosure ? (editingClosure.contract_start || '') : (newClosure.contract_start || '')}
                              onChange={(e) => {
                                const value = e.target.value ? Number(e.target.value) : undefined;
                                if (editingClosure) {
                                  setEditingClosure({ ...editingClosure, contract_start: value });
                                } else {
                                  setNewClosure({ ...newClosure, contract_start: value });
                                }
                              }}
                              placeholder="مثال: 1000"
                            />
                          </div>
                          <div>
                            <Label>إلى عقد رقم</Label>
                            <Input
                              type="number"
                              value={editingClosure ? (editingClosure.contract_end || '') : (newClosure.contract_end || '')}
                              onChange={(e) => {
                                const value = e.target.value ? Number(e.target.value) : undefined;
                                if (editingClosure) {
                                  setEditingClosure({ ...editingClosure, contract_end: value });
                                } else {
                                  setNewClosure({ ...newClosure, contract_end: value });
                                }
                              }}
                              placeholder="مثال: 1100"
                            />
                          </div>
                        </div>
                      )}

                      {/* حقول الفترة الزمنية */}
                      {(editingClosure?.closure_type === 'period' || (!editingClosure && newClosure.closure_type === 'period')) && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>من تاريخ</Label>
                            <Input
                              type="date"
                              value={editingClosure ? editingClosure.period_start : newClosure.period_start}
                              onChange={(e) => {
                                if (editingClosure) {
                                  setEditingClosure({ ...editingClosure, period_start: e.target.value });
                                } else {
                                  setNewClosure({ ...newClosure, period_start: e.target.value });
                                }
                              }}
                            />
                          </div>
                          <div>
                            <Label>إلى تاريخ</Label>
                            <Input
                              type="date"
                              value={editingClosure ? editingClosure.period_end : newClosure.period_end}
                              onChange={(e) => {
                                if (editingClosure) {
                                  setEditingClosure({ ...editingClosure, period_end: e.target.value });
                                } else {
                                  setNewClosure({ ...newClosure, period_end: e.target.value });
                                }
                              }}
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <Label>ملاحظات</Label>
                        <Textarea
                          value={editingClosure ? editingClosure.notes : newClosure.notes}
                          onChange={(e) => {
                            if (editingClosure) {
                              setEditingClosure({ ...editingClosure, notes: e.target.value });
                            } else {
                              setNewClosure({ ...newClosure, notes: e.target.value });
                            }
                          }}
                          placeholder="ملاحظات إضافية عن التسكير"
                          rows={3}
                        />
                      </div>

                      <Button onClick={saveClosure} className="w-full">
                        حفظ التسكير
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>تاريخ التسكير</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>النطاق</TableHead>
                      <TableHead>ملاحظات</TableHead>
                      <TableHead>إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {closures.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          لا توجد تسكيرات مسجلة
                        </TableCell>
                      </TableRow>
                    ) : (
                      closures.map((closure) => (
                        <TableRow key={closure.id}>
                          <TableCell>
                            {format(new Date(closure.closure_date), 'dd/MM/yyyy', { locale: ar })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {closure.closure_type === 'period' ? 'فترة زمنية' :
                               closure.closure_type === 'contract_range' ? 'نطاق عقود' :
                               closure.closure_type === 'monthly' ? 'شهري' :
                               closure.closure_type === 'yearly' ? 'سنوي' : closure.closure_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {closure.closure_type === 'contract_range' && closure.contract_start && closure.contract_end ? (
                              <span className="font-medium">
                                عقود {closure.contract_start} - {closure.contract_end}
                              </span>
                            ) : closure.period_start && closure.period_end ? (
                              <div className="flex flex-col gap-1">
                                <span className="text-sm">
                                  من: {format(new Date(closure.period_start), 'dd/MM/yyyy', { locale: ar })}
                                </span>
                                <span className="text-sm">
                                  إلى: {format(new Date(closure.period_end), 'dd/MM/yyyy', { locale: ar })}
                                </span>
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {closure.notes || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingClosure(closure);
                                  setShowClosureDialog(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteClosure(closure.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Expenses Tab */}
          <TabsContent value="expenses">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>المصروفات والنفقات ({filteredExpenses.length})</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={printExpenseStatement}>
                    <FileText className="h-4 w-4 ml-2" />
                    طباعة الكشف
                  </Button>
                  <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
                    <DialogTrigger asChild>
                      <Button onClick={() => {
                        setEditingExpense(null);
                        setSelectedCustodyAccountId('');
                        setNewExpense({
                          description: '', amount: 0, 
                          category: categoryOptions.includes('أخرى') ? 'أخرى' : (categoryOptions[0] || ''),
                          expense_date: new Date().toISOString().split('T')[0],
                          payment_method: '', payment_status: 'unpaid', employee_id: '',
                          notes: '', receiver_name: '', sender_name: ''
                        });
                      }}>
                        <Plus className="h-4 w-4 ml-2" />
                        إضافة مصروف
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{editingExpense ? 'تعديل المصروف' : 'إضافة مصروف جديد'}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>الوصف *</Label>
                          <Input value={editingExpense ? editingExpense.description : newExpense.description}
                            onChange={(e) => editingExpense ? setEditingExpense({...editingExpense, description: e.target.value}) : setNewExpense({...newExpense, description: e.target.value})}
                            placeholder="وصف المصروف" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>المبلغ *</Label>
                            <Input type="number" value={editingExpense ? editingExpense.amount : newExpense.amount}
                              onChange={(e) => editingExpense ? setEditingExpense({...editingExpense, amount: Number(e.target.value)}) : setNewExpense({...newExpense, amount: Number(e.target.value)})}
                              placeholder="0" />
                          </div>
                          <div>
                            <Label>التاريخ</Label>
                            <Input type="date" value={editingExpense ? editingExpense.expense_date : newExpense.expense_date}
                              onChange={(e) => editingExpense ? setEditingExpense({...editingExpense, expense_date: e.target.value}) : setNewExpense({...newExpense, expense_date: e.target.value})} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>الفئة *</Label>
                            <Select value={editingExpense ? editingExpense.category : newExpense.category}
                              onValueChange={(v) => editingExpense ? setEditingExpense({...editingExpense, category: v}) : setNewExpense({...newExpense, category: v})}>
                              <SelectTrigger><SelectValue placeholder="اختر الفئة" /></SelectTrigger>
                              <SelectContent>{categoryOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>حالة السداد</Label>
                            {(() => {
                              const isExisting = !!editingExpense;
                              const isLinked = isExisting && editingExpense && (editingExpense.payment_status === 'paid' || editingExpense.payment_status === 'partial') && !manuallyPaidIds.has(editingExpense.id);
                              return (
                                <>
                                  <Select
                                    value={editingExpense ? editingExpense.payment_status : newExpense.payment_status}
                                    onValueChange={(v) => editingExpense ? setEditingExpense({...editingExpense, payment_status: v}) : setNewExpense({...newExpense, payment_status: v})}
                                    disabled={isLinked}
                                  >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="unpaid">غير مسدد</SelectItem>
                                      <SelectItem value="paid">مسدد</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {isLinked && (
                                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                                      ⓘ مرتبط بدفعة عميل/عهدة — لإلغاء السداد عدّل الدفعة من شاشة الدفعات.
                                    </p>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>طريقة الدفع</Label>
                            <Select value={editingExpense ? editingExpense.payment_method : newExpense.payment_method}
                              onValueChange={(v) => {
                                if (v !== 'عهدة موظف') setSelectedCustodyAccountId('');
                                if (editingExpense) {
                                  setEditingExpense({ ...editingExpense, payment_method: v });
                                } else {
                                  setNewExpense({ ...newExpense, payment_method: v });
                                }
                              }}>
                              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                              <SelectContent>{paymentMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div>
                            {(() => {
                              const currentMethod = (editingExpense ? editingExpense.payment_method : newExpense.payment_method) || '';
                              const isCustodyMode = currentMethod === 'عهدة موظف';
                              return (
                                <>
                                  <Label>{isCustodyMode ? 'الموظف صاحب العهدة' : 'الموظف الذي صرف من حسابه'}</Label>
                                  <Select value={editingExpense ? (editingExpense.employee_id || '') : (newExpense.employee_id || '')}
                              disabled={isCustodyMode || !!editingExpense}
                              onValueChange={(v) => {
                                const empId = v === 'none' ? '' : v;
                                const empName = empId ? (employees.find(e => e.id === empId)?.name || '') : '';
                                if (editingExpense) {
                                  // For editing: only auto-fill sender if it was empty or matched a known employee name
                                  const prevName = editingExpense.employee_id ? (employees.find(e => e.id === editingExpense.employee_id)?.name || '') : '';
                                  const shouldOverwrite = !editingExpense.sender_name || editingExpense.sender_name === prevName;
                                  setEditingExpense({
                                    ...editingExpense,
                                    employee_id: empId,
                                    ...(shouldOverwrite ? { sender_name: empName } : {}),
                                  });
                                } else {
                                  const prevName = newExpense.employee_id ? (employees.find(e => e.id === newExpense.employee_id)?.name || '') : '';
                                  const shouldOverwrite = !newExpense.sender_name || newExpense.sender_name === prevName;
                                  setNewExpense({
                                    ...newExpense,
                                    employee_id: empId,
                                    ...(shouldOverwrite ? { sender_name: empName } : {}),
                                  });
                                }
                              }}>
                              <SelectTrigger><SelectValue placeholder="اختياري" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">-- بدون --</SelectItem>
                                {employees.filter(e => e.status === 'active').map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {isCustodyMode
                                      ? 'يتم تحديده تلقائيًا من العهدة المختارة أدناه'
                                      : 'إذا صرف الموظف من جيبه، سيُضاف له رصيد دائن تلقائياً'}
                                  </p>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                        {((editingExpense ? editingExpense.payment_method : newExpense.payment_method) === 'عهدة موظف') && (
                          <div>
                            <Label>اختر العهدة *</Label>
                            <Select
                              value={selectedCustodyAccountId}
                              onValueChange={(v) => {
                                setSelectedCustodyAccountId(v);
                                const acc = custodyAccounts.find(c => c.id === v);
                                if (!acc) return;
                                const empName = employees.find(e => e.id === acc.employee_id)?.name || '';
                                if (editingExpense) {
                                  setEditingExpense({
                                    ...editingExpense,
                                    employee_id: acc.employee_id,
                                    sender_name: empName || editingExpense.sender_name,
                                    payment_status: 'paid',
                                  });
                                } else {
                                  setNewExpense({
                                    ...newExpense,
                                    employee_id: acc.employee_id,
                                    sender_name: empName || newExpense.sender_name,
                                    payment_status: 'paid',
                                  });
                                }
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="اختر حساب عهدة نشط" />
                              </SelectTrigger>
                              <SelectContent>
                                {custodyAccounts.length === 0 && (
                                  <div className="p-2 text-xs text-muted-foreground">لا توجد حسابات عهدة نشطة</div>
                                )}
                                {custodyAccounts.map(c => {
                                  const empName = employees.find(e => e.id === c.employee_id)?.name || '—';
                                  return (
                                    <SelectItem key={c.id} value={c.id}>
                                      {empName} — حساب {c.account_number} — الرصيد {c.current_balance.toLocaleString('en-US')} د.ل
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                            {(() => {
                              const acc = custodyAccounts.find(c => c.id === selectedCustodyAccountId);
                              const amt = Number(editingExpense ? editingExpense.amount : newExpense.amount) || 0;
                              if (!acc) return (
                                <p className="text-[11px] text-muted-foreground mt-1">سيتم خصم المبلغ من رصيد العهدة المختارة تلقائيًا.</p>
                              );
                              if (amt > acc.current_balance) {
                                return (
                                  <p className="text-[11px] text-destructive mt-1">
                                    المبلغ ({amt.toLocaleString('en-US')} د.ل) يتجاوز الرصيد المتاح في العهدة ({acc.current_balance.toLocaleString('en-US')} د.ل).
                                  </p>
                                );
                              }
                              return (
                                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                                  الرصيد المتبقي بعد السداد: {(acc.current_balance - amt).toLocaleString('en-US')} د.ل
                                </p>
                              );
                            })()}
                          </div>
                        )}
                        <div>
                            <Label>اسم المستلم</Label>
                            <Input value={editingExpense ? editingExpense.receiver_name : newExpense.receiver_name}
                              onChange={(e) => editingExpense ? setEditingExpense({...editingExpense, receiver_name: e.target.value}) : setNewExpense({...newExpense, receiver_name: e.target.value})}
                              placeholder="اسم المستلم" />
                        </div>

                        <div>
                          <Label>ملاحظات</Label>
                          <Textarea value={editingExpense ? editingExpense.notes : newExpense.notes}
                            onChange={(e) => editingExpense ? setEditingExpense({...editingExpense, notes: e.target.value}) : setNewExpense({...newExpense, notes: e.target.value})}
                            placeholder="ملاحظات إضافية" rows={2} />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" onClick={() => setShowExpenseDialog(false)}>إلغاء</Button>
                          <Button onClick={saveExpense}>{editingExpense ? 'تحديث' : 'إضافة'}</Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
 {/* بطاقات ملخّص سريع */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="p-3 rounded-lg border bg-card">
                    <div className="text-[11px] text-muted-foreground">عدد المصروفات</div>
                    <div className="text-lg font-bold">{expensesSummary.count.toLocaleString('en-US')}</div>
                  </div>
                  <div className="p-3 rounded-lg border bg-card">
                    <div className="text-[11px] text-muted-foreground">إجمالي المبلغ</div>
                    <div className="text-lg font-bold">{expensesSummary.total.toLocaleString('en-US')} د.ل</div>
                  </div>
                  <div className="p-3 rounded-lg border bg-green-500/10 border-green-500/30">
                    <div className="text-[11px] text-green-700 dark:text-green-400">المسدد</div>
                    <div className="text-lg font-bold text-green-700 dark:text-green-400">{expensesSummary.paid.toLocaleString('en-US')} د.ل</div>
                  </div>
                  <div className="p-3 rounded-lg border bg-red-500/10 border-red-500/30">
                    <div className="text-[11px] text-red-700 dark:text-red-400">غير المسدد</div>
                    <div className="text-lg font-bold text-red-700 dark:text-red-400">{expensesSummary.unpaid.toLocaleString('en-US')} د.ل</div>
                  </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4 p-3 bg-muted/50 rounded-lg">
                  <div className="md:col-span-2">
                    <Label className="text-xs">بحث</Label>
                    <div className="relative">
                      <Search className="h-3.5 w-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <SearchInputWithHistory
                        historyKey="expenses"
                        value={filterSearch}
                        onChange={(e) => setFilterSearch(e.target.value)}
                        placeholder="وصف / مستلم / مسلّم / ملاحظات"
                        className="h-8 text-sm pr-7"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">من تاريخ</Label>
                    <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">إلى تاريخ</Label>
                    <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">الصنف</Label>
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">الكل</SelectItem>
                        {categoryOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">الحالة</Label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">الكل</SelectItem>
                        <SelectItem value="paid">مسدد</SelectItem>
                        <SelectItem value="unpaid">غير مسدد</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">الموظف</Label>
                    <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">الكل</SelectItem>
                        {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-6 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setFilterSearch(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterCategory('all'); setFilterStatus('all'); setFilterEmployee('all'); }}
                      className="h-7 text-xs gap-1"
                    >
                      <XIcon className="h-3 w-3" /> تصفير الفلاتر
                    </Button>
                  </div>
                </div>

                <Table dir="rtl">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">الوصف</TableHead>
                      <TableHead className="text-right">الفئة</TableHead>
                      <TableHead className="text-right">المبلغ</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">مصدر السداد</TableHead>
                      <TableHead className="text-right">الموظف</TableHead>
                      <TableHead className="text-right">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          لا توجد مصروفات مطابقة للفلاتر
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredExpenses.map((expense) => (
                        <TableRow key={expense.id} className="hover:bg-accent/30">
                          <TableCell>{format(new Date(expense.expense_date), 'dd/MM/yyyy', { locale: ar })}</TableCell>
                          <TableCell className="font-medium max-w-xs truncate">{expense.description}</TableCell>
                          <TableCell><Badge variant="outline">{expense.category}</Badge></TableCell>
                          <TableCell className="font-bold">{expense.amount.toLocaleString('en-US')} د.ل</TableCell>
                          <TableCell>
                            {expense.payment_status === 'paid' ? (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <CheckCircle className="h-3 w-3 ml-1" /> مسدد
                              </Badge>
                            ) : expense.payment_status === 'partial' ? (
                              <Badge className="bg-amber-100 text-amber-700 cursor-pointer" onClick={() => { setDirectPaymentExpense(expense); setShowDirectPaymentDialog(true); }}>
                                <Clock className="h-3 w-3 ml-1" /> جزئي ({Number((expense as any).paid_amount || 0).toLocaleString('ar-LY')}/{Number(expense.amount).toLocaleString('ar-LY')})
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="cursor-pointer" onClick={() => { setDirectPaymentExpense(expense); setShowDirectPaymentDialog(true); }}>
                                <Clock className="h-3 w-3 ml-1" /> غير مسدد
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate" title={paymentSourceMap[expense.id] || ''}>
                            {expense.payment_status === 'unpaid' ? '—' : (paymentSourceMap[expense.id] || (manuallyPaidIds.has(expense.id) ? `سداد مباشر${expense.payment_method ? ` (${expense.payment_method})` : ''}` : '—'))}
                          </TableCell>
                          <TableCell className="text-sm">
                            {expense.employee_id ? (employees.find(e => e.id === expense.employee_id)?.name || '-') : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => { setSelectedExpenseForReceipt(expense); setShowExpenseReceiptDialog(true); }} title="طباعة">
                                <Printer className="h-4 w-4" />
                              </Button>
                              {expense.payment_status !== 'paid' && (
                                <Button size="sm" variant="ghost" onClick={() => { setDirectPaymentExpense(expense); setShowDirectPaymentDialog(true); }} title="سداد مباشر">
                                  <DollarSign className="h-4 w-4 text-green-600" />
                                </Button>
                              )}
                              {(expense.payment_status === 'paid' || expense.payment_status === 'partial') && (manuallyPaidIds.has(expense.id) || directPaidIds.has(expense.id)) && (
                                <Button size="sm" variant="ghost" onClick={() => setReopenExpense(expense)} title="إلغاء السداد / إعادة فتح">
                                  <RotateCcw className="h-4 w-4 text-amber-600" />
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => { setEditingExpense(expense); setSelectedCustodyAccountId(''); setShowExpenseDialog(true); }} title="تعديل">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => deleteExpense(expense.id)} title="حذف">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Employee Dues Tab */}
          <TabsContent value="employee-dues">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>مستحقات الموظفين</CardTitle>
                <Dialog open={showPayEmployeeDialog} onOpenChange={setShowPayEmployeeDialog}>
                  <DialogTrigger asChild>
                    <Button><DollarSign className="h-4 w-4 ml-2" />سداد مستحقات</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>سداد مستحقات لموظف</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>الموظف</Label>
                        <Select value={payEmployeeId} onValueChange={setPayEmployeeId}>
                          <SelectTrigger><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                          <SelectContent>
                            {employeeDues.filter(d => d.balance > 0).map(d => (
                              <SelectItem key={d.employee_id} value={d.employee_id}>
                                {d.employee_name} (مستحق: {d.balance.toLocaleString('en-US')} د.ل)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>المبلغ</Label>
                        <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0" />
                      </div>
                      <div>
                        <Label>طريقة الدفع</Label>
                        <Select value={payMethod} onValueChange={setPayMethod}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{paymentMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>رقم المرجع</Label>
                        <Input value={payReference} onChange={(e) => setPayReference(e.target.value)} placeholder="اختياري" />
                      </div>
                      <div>
                        <Label>ملاحظات</Label>
                        <Textarea value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="ملاحظات" rows={2} />
                      </div>
                      <Button onClick={payEmployeeDue} className="w-full">سداد</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {employeeDues.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">لا توجد مستحقات للموظفين</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">الموظف</TableHead>
                        <TableHead className="text-right">الوظيفة</TableHead>
                        <TableHead className="text-right">إجمالي الدائن</TableHead>
                        <TableHead className="text-right">إجمالي المسدد</TableHead>
                        <TableHead className="text-right">الرصيد المستحق</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employeeDues.map(d => (
                        <TableRow key={d.employee_id}>
                          <TableCell className="font-medium">{d.employee_name}</TableCell>
                          <TableCell>{d.position || '-'}</TableCell>
                          <TableCell>{d.total_credit.toLocaleString('en-US')} د.ل</TableCell>
                          <TableCell>{d.total_debit.toLocaleString('en-US')} د.ل</TableCell>
                          <TableCell className="font-bold">
                            <span className={d.balance > 0 ? 'text-destructive' : 'text-green-600'}>
                              {d.balance.toLocaleString('en-US')} د.ل
                            </span>
                          </TableCell>
                          <TableCell>
                            {d.balance > 0 ? (
                              <Badge variant="destructive">مستحق</Badge>
                            ) : d.balance === 0 ? (
                              <Badge className="bg-green-100 text-green-700">مسدد</Badge>
                            ) : (
                              <Badge variant="secondary">دائن</Badge>
                            )}
                            {d.balance > 5000 && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-destructive">
                                <AlertTriangle className="h-3 w-3" /> تنبيه: تراكم مستحقات
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="employees">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>إدارة الموظفين</CardTitle>
                <Dialog open={showEmployeeDialog} onOpenChange={setShowEmployeeDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setEditingEmployee(null);
                      setNewEmployee({
                        name: '',
                        position: '',
                        base_salary: 0,
                        hire_date: new Date().toISOString().split('T')[0],
                        status: 'active',
                        phone: '',
                        email: ''
                      });
                    }}>
                      <Plus className="h-4 w-4 ml-2" />
                      إضافة موظف
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>
                        {editingEmployee ? 'تعديل الموظف' : 'إضافة موظف جديد'}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>الاسم</Label>
                        <Input
                          value={editingEmployee ? editingEmployee.name : newEmployee.name}
                          onChange={(e) => {
                            if (editingEmployee) {
                              setEditingEmployee({ ...editingEmployee, name: e.target.value });
                            } else {
                              setNewEmployee({ ...newEmployee, name: e.target.value });
                            }
                          }}
                          placeholder="اسم الموظف"
                        />
                      </div>
                      <div>
                        <Label>الوظيفة</Label>
                        <Input
                          value={editingEmployee ? editingEmployee.position : newEmployee.position}
                          onChange={(e) => {
                            if (editingEmployee) {
                              setEditingEmployee({ ...editingEmployee, position: e.target.value });
                            } else {
                              setNewEmployee({ ...newEmployee, position: e.target.value });
                            }
                          }}
                          placeholder="الوظيفة"
                        />
                      </div>
                      <div>
                        <Label>الراتب الأساسي</Label>
                        <Input
                          type="number"
                          value={editingEmployee ? editingEmployee.base_salary : newEmployee.base_salary}
                          onChange={(e) => {
                            if (editingEmployee) {
                              setEditingEmployee({ ...editingEmployee, base_salary: Number(e.target.value) });
                            } else {
                              setNewEmployee({ ...newEmployee, base_salary: Number(e.target.value) });
                            }
                          }}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label>تاريخ التعيين</Label>
                        <Input
                          type="date"
                          value={editingEmployee ? editingEmployee.hire_date : newEmployee.hire_date}
                          onChange={(e) => {
                            if (editingEmployee) {
                              setEditingEmployee({ ...editingEmployee, hire_date: e.target.value });
                            } else {
                              setNewEmployee({ ...newEmployee, hire_date: e.target.value });
                            }
                          }}
                        />
                      </div>
                      <div>
                        <Label>رقم الهاتف</Label>
                        <Input
                          value={editingEmployee ? editingEmployee.phone : newEmployee.phone}
                          onChange={(e) => {
                            if (editingEmployee) {
                              setEditingEmployee({ ...editingEmployee, phone: e.target.value });
                            } else {
                              setNewEmployee({ ...newEmployee, phone: e.target.value });
                            }
                          }}
                          placeholder="09xxxxxxxx"
                        />
                      </div>
                      <div>
                        <Label>البريد الإلكتروني</Label>
                        <Input
                          type="email"
                          value={editingEmployee ? editingEmployee.email : newEmployee.email}
                          onChange={(e) => {
                            if (editingEmployee) {
                              setEditingEmployee({ ...editingEmployee, email: e.target.value });
                            } else {
                              setNewEmployee({ ...newEmployee, email: e.target.value });
                            }
                          }}
                          placeholder="example@email.com"
                        />
                      </div>
                      <div>
                        <Label>الحالة</Label>
                        <Select
                          value={editingEmployee ? editingEmployee.status : newEmployee.status}
                          onValueChange={(value) => {
                            if (editingEmployee) {
                              setEditingEmployee({ ...editingEmployee, status: value });
                            } else {
                              setNewEmployee({ ...newEmployee, status: value });
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">نشط</SelectItem>
                            <SelectItem value="inactive">غير نشط</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2 justify-end pt-4">
                        <Button variant="outline" onClick={() => setShowEmployeeDialog(false)}>
                          إلغاء
                        </Button>
                        <Button onClick={saveEmployee}>
                          {editingEmployee ? 'تحديث' : 'إضافة'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الاسم</TableHead>
                      <TableHead className="text-right">الوظيفة</TableHead>
                      <TableHead className="text-right">الراتب الأساسي</TableHead>
                      <TableHead className="text-right">تاريخ التعيين</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          لا يوجد موظفين مسجلين
                        </TableCell>
                      </TableRow>
                    ) : (
                      employees.map((employee) => (
                        <TableRow key={employee.id}>
                          <TableCell className="font-medium">{employee.name}</TableCell>
                          <TableCell>{employee.position || '-'}</TableCell>
                          <TableCell className="font-bold">
                            {(employee.base_salary || 0).toLocaleString('en-US')} د.ل
                          </TableCell>
                          <TableCell>
                            {employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('ar-LY') : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={employee.status === 'active' ? 'default' : 'secondary'}>
                              {employee.status === 'active' ? 'نشط' : 'غير نشط'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingEmployee(employee);
                                  setShowEmployeeDialog(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteEmployee(employee.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Receipt Print Dialog */}
      {selectedExpenseForReceipt && (
        <ExpenseReceiptPrintDialog
          open={showExpenseReceiptDialog}
          onOpenChange={setShowExpenseReceiptDialog}
          expense={{ ...selectedExpenseForReceipt, payment_source: paymentSourceMap[selectedExpenseForReceipt.id] || '' }}
        />
      )}

      {/* Reopen Manual Expense Dialog */}
      <Dialog open={!!reopenExpense} onOpenChange={(v) => !v && setReopenExpense(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>إعادة فتح المصروف</DialogTitle>
          </DialogHeader>
          {reopenExpense && (
            <div className="space-y-3 text-sm">
              <div className="p-3 rounded-lg bg-muted/50 border">
                <div><strong>الوصف:</strong> {reopenExpense.description}</div>
                <div><strong>المبلغ:</strong> {Number(reopenExpense.amount).toLocaleString('en-US')} د.ل</div>
                <div><strong>الحالة الحالية:</strong> {reopenExpense.payment_status === 'paid' ? 'مسدد' : 'جزئي'}</div>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                سيتم تحويل المصروف إلى "غير مسدد" وتصفير المبلغ المسدد والتاريخ. وإذا كان السداد عبر "سداد مباشر" سيتم حذف سجلات الدفع وإعادة المبلغ لرصيد العهدة إن وُجد. لا يؤثر هذا الإجراء على المصروفات المربوطة بدفعات الزبائن.
              </p>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setReopenExpense(null)} disabled={reopenSaving}>إلغاء</Button>
                <Button onClick={reopenManualExpense} disabled={reopenSaving} className="gap-1">
                  <RotateCcw className="h-4 w-4" />
                  {reopenSaving ? 'جاري...' : 'إعادة فتح'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Direct Payment Dialog */}
      <DirectExpensePaymentDialog
        open={showDirectPaymentDialog}
        onOpenChange={setShowDirectPaymentDialog}
        expense={directPaymentExpense}
        onSuccess={() => loadData()}
      />

      {/* Quick Add Employee (from expense form) */}
      <Dialog open={showQuickEmployeeDialog} onOpenChange={setShowQuickEmployeeDialog}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة موظف جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>الاسم *</Label>
              <Input value={quickEmployeeName} onChange={(e) => setQuickEmployeeName(e.target.value)} />
            </div>
            <div>
              <Label>الوظيفة</Label>
              <Input value={quickEmployeePosition} onChange={(e) => setQuickEmployeePosition(e.target.value)} placeholder="موظف" />
            </div>
            <div>
              <Label>الراتب الأساسي (اختياري)</Label>
              <Input type="number" value={quickEmployeeSalary} onChange={(e) => setQuickEmployeeSalary(e.target.value)} placeholder="0" />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowQuickEmployeeDialog(false)} disabled={quickEmployeeSaving}>إلغاء</Button>
              <Button onClick={saveQuickEmployee} disabled={quickEmployeeSaving}>
                {quickEmployeeSaving ? 'جارٍ الحفظ...' : 'إنشاء وربط'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

