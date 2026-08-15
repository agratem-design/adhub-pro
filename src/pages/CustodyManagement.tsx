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
import { Loader2, Wallet, Plus, DollarSign, FileText, TrendingDown, TrendingUp, Printer, Receipt, CheckCircle, Undo2, Trash2, CreditCard, Users, Pencil } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CustodyReceiptPrint } from '@/components/custody/CustodyReceiptPrint';
import { CustodyStatementPrint } from '@/components/custody/CustodyStatementPrint';
import { CustodySettlementDialog } from '@/components/custody/CustodySettlementDialog';
import { EmployeeCustodyStatementPrint } from '@/components/custody/EmployeeCustodyStatementPrint';

interface Employee {
  id: string;
  name: string;
  position: string;
}

interface CustodyAccount {
  id: string;
  employee_id: string;
  account_number: string;
  custody_name: string | null;
  initial_amount: number;
  current_balance: number;
  status: string;
  assigned_date: string;
  closed_date: string | null;
  notes: string | null;
  source_type: string | null;
  source_payment_id: string | null;
  employee?: Employee;
  // معلومات الزبون والعقد من الدفعة المرتبطة
  source_customer_name?: string | null;
  source_contract_number?: number | null;
  source_payment_date?: string | null;
}

interface CustodyTransaction {
  id: string;
  custody_account_id: string;
  transaction_type: string;
  amount: number;
  transaction_date: string;
  description: string | null;
  receipt_number: string | null;
  notes: string | null;
  receiver_name?: string | null;
}

interface CustodyExpense {
  id: string;
  custody_account_id: string;
  expense_category: string;
  amount: number;
  expense_date: string;
  description: string;
  receipt_number: string | null;
  vendor_name: string | null;
  notes: string | null;
  receipt_image_url?: string | null;
  receipt_image_path?: string | null;
}

// Helper to get account info for display
const getAccountInfo = (accountId: string, accounts: CustodyAccount[]) => {
  const account = accounts.find(a => a.id === accountId);
  return account ? `${account.account_number} - ${(account.employee as any)?.name || ''}` : '';
};

export default function CustodyManagement() {
  const { canEdit: canEditAuth } = useAuth();
  const canEditSection = canEditAuth('custody');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [accounts, setAccounts] = useState<CustodyAccount[]>([]);
  const [transactions, setTransactions] = useState<CustodyTransaction[]>([]);
  const [expenses, setExpenses] = useState<CustodyExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  
  // Dialogs
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [settlementDialogOpen, setSettlementDialogOpen] = useState(false);
  const [selectedAccountForSettlement, setSelectedAccountForSettlement] = useState<CustodyAccount | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<CustodyTransaction | null>(null);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [selectedAccountForDeposit, setSelectedAccountForDeposit] = useState<CustodyAccount | null>(null);
  
  // Deposit form
  const [depositAmount, setDepositAmount] = useState('');
  const [depositDate, setDepositDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [depositDescription, setDepositDescription] = useState('');
  const [depositReceiptNumber, setDepositReceiptNumber] = useState('');
  
  // Account form
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const { confirm: systemConfirm } = useSystemDialog();
  const [custodyName, setCustodyName] = useState('');
  const [initialAmount, setInitialAmount] = useState('');
  const [accountNotes, setAccountNotes] = useState('');
  
  // Edit account state
  const [editingAccount, setEditingAccount] = useState<CustodyAccount | null>(null);
  const [editAccountDialogOpen, setEditAccountDialogOpen] = useState(false);
  const [editCustodyName, setEditCustodyName] = useState('');
  const [editCurrentBalance, setEditCurrentBalance] = useState('');
  
  // Add expense directly to account
  const [selectedAccountForExpense, setSelectedAccountForExpense] = useState<CustodyAccount | null>(null);
  
  // Editing expense state
  const [editingExpense, setEditingExpense] = useState<CustodyExpense | null>(null);
  
  // Transaction form
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [transactionType, setTransactionType] = useState('deposit');
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [transactionDescription, setTransactionDescription] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [receiverName, setReceiverName] = useState('');
  
  // Expense form
  const [expenseAccountId, setExpenseAccountId] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseReceiptNumber, setExpenseReceiptNumber] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');
  const [expenseReceiptImageUrl, setExpenseReceiptImageUrl] = useState<string>('');
  const [expenseReceiptImagePath, setExpenseReceiptImagePath] = useState<string>('');
  const [uploadingReceiptImage, setUploadingReceiptImage] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load employees
      const { data: employeesData } = await supabase
        .from('employees')
        .select('id, name, position')
        .eq('status', 'active')
        .order('name');
      
      if (employeesData) setEmployees(employeesData);
      
      // Load custody accounts with employee info
      const { data: accountsData } = await supabase
        .from('custody_accounts')
        .select(`
          *,
          employee:employees(id, name, position)
        `)
        .order('created_at', { ascending: false });
      
      if (accountsData) {
        // جلب معلومات الزبون والعقد من الدفعات المرتبطة
        const distributedPaymentIds = accountsData
          .filter(a => a.source_type === 'distributed_payment' && a.source_payment_id)
          .map(a => a.source_payment_id);
        
        let paymentInfoMap: Record<string, { customer_name: string | null; contract_number: number | null; paid_at: string | null }> = {};
        
        if (distributedPaymentIds.length > 0) {
          const { data: paymentsData } = await supabase
            .from('customer_payments')
            .select('distributed_payment_id, customer_name, contract_number, paid_at')
            .in('distributed_payment_id', distributedPaymentIds);
          
          if (paymentsData) {
            paymentsData.forEach(p => {
              if (p.distributed_payment_id && !paymentInfoMap[p.distributed_payment_id]) {
                paymentInfoMap[p.distributed_payment_id] = {
                  customer_name: p.customer_name,
                  contract_number: p.contract_number,
                  paid_at: p.paid_at
                };
              }
            });
          }
        }
        
        // دمج المعلومات مع العهد
        const enrichedAccounts = accountsData.map(account => {
          const paymentInfo = account.source_payment_id ? paymentInfoMap[account.source_payment_id] : null;
          return {
            ...account,
            source_customer_name: paymentInfo?.customer_name || null,
            source_contract_number: paymentInfo?.contract_number || null,
            source_payment_date: paymentInfo?.paid_at || null
          };
        });
        
        setAccounts(enrichedAccounts as any);
      }
      
      // Load recent transactions
      const { data: transactionsData } = await supabase
        .from('custody_transactions')
        .select('*')
        .order('transaction_date', { ascending: false })
        .limit(50);
      
      if (transactionsData) setTransactions(transactionsData as CustodyTransaction[]);
      
      // Load recent expenses
      const { data: expensesData } = await supabase
        .from('custody_expenses')
        .select('*')
        .order('expense_date', { ascending: false })
        .limit(50);
      
      if (expensesData) setExpenses(expensesData);
      
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const generateAccountNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    return `CUS-${timestamp}`;
  };

  const handleCreateAccount = async () => {
    if (creating) return; // منع النقر المتكرر
    
    if (!selectedEmployeeId || !initialAmount || parseFloat(initialAmount) <= 0) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    setCreating(true);
    try {
      const accNumber = accountNumber || generateAccountNumber();
      
      const { error } = await supabase
        .from('custody_accounts')
        .insert({
          employee_id: selectedEmployeeId,
          account_number: accNumber,
          custody_name: custodyName || null,
          initial_amount: parseFloat(initialAmount),
          current_balance: parseFloat(initialAmount),
          status: 'active',
          notes: accountNotes || null
        });

      if (error) throw error;

      toast.success('تم إنشاء العهدة بنجاح');
      setAccountDialogOpen(false);
      resetAccountForm();
      loadData();
    } catch (error) {
      console.error('Error creating custody account:', error);
      toast.error('فشل في إنشاء العهدة');
    } finally {
      setCreating(false);
    }
  };

  const handleAddTransaction = async () => {
    if (!selectedAccountId || !transactionAmount || parseFloat(transactionAmount) <= 0) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      if (editingTransaction) {
        // Update existing transaction
        const { error } = await supabase
          .from('custody_transactions')
          .update({
            transaction_type: transactionType,
            amount: parseFloat(transactionAmount),
            transaction_date: transactionDate,
            description: transactionDescription || null,
            receipt_number: receiptNumber || null,
            receiver_name: receiverName || null
          } as any)
          .eq('id', editingTransaction.id);

        if (error) throw error;
        toast.success('تم تعديل الحركة بنجاح');
      } else {
        // Insert new transaction
        const { error } = await supabase
          .from('custody_transactions')
          .insert({
            custody_account_id: selectedAccountId,
            transaction_type: transactionType,
            amount: parseFloat(transactionAmount),
            transaction_date: transactionDate,
            description: transactionDescription || null,
            receipt_number: receiptNumber || null,
            receiver_name: receiverName || null
          } as any);

        if (error) throw error;
        toast.success('تم إضافة الحركة بنجاح');
      }

      setTransactionDialogOpen(false);
      resetTransactionForm();
      loadData();
    } catch (error) {
      console.error('Error adding/updating transaction:', error);
      toast.error(editingTransaction ? 'فشل في تعديل الحركة' : 'فشل في إضافة الحركة');
    }
  };

  const handleAddExpense = async () => {
    if (!expenseAccountId || !expenseAmount || parseFloat(expenseAmount) <= 0 || !expenseDescription) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      if (editingExpense) {
        // Update existing expense
        const { error } = await supabase
          .from('custody_expenses')
          .update({
            expense_category: expenseCategory,
            amount: parseFloat(expenseAmount),
            expense_date: expenseDate,
            description: expenseDescription,
            receipt_number: expenseReceiptNumber || null,
            vendor_name: vendorName || null,
            notes: expenseNotes || null,
            receipt_image_url: expenseReceiptImageUrl || null,
            receipt_image_path: expenseReceiptImagePath || null,
          } as any)
          .eq('id', editingExpense.id);

        if (error) throw error;
        toast.success('تم تعديل المصروف بنجاح');
      } else {
        // Insert new expense
        const { error } = await supabase
          .from('custody_expenses')
          .insert({
            custody_account_id: expenseAccountId,
            expense_category: expenseCategory,
            amount: parseFloat(expenseAmount),
            expense_date: expenseDate,
            description: expenseDescription,
            receipt_number: expenseReceiptNumber || null,
            vendor_name: vendorName || null,
            notes: expenseNotes || null,
            receipt_image_url: expenseReceiptImageUrl || null,
            receipt_image_path: expenseReceiptImagePath || null,
          } as any);

        if (error) throw error;
        toast.success('تم إضافة المصروف بنجاح');
      }

      setExpenseDialogOpen(false);
      resetExpenseForm();
      loadData();
    } catch (error) {
      console.error('Error adding/updating expense:', error);
      toast.error(editingExpense ? 'فشل في تعديل المصروف' : 'فشل في إضافة المصروف');
    }
  };

  // Delete expense
  const handleDeleteExpense = async (expense: CustodyExpense) => {
    if (!await systemConfirm({ title: 'تأكيد حذف المصروف', message: `هل تريد حذف هذا المصروف؟\n${expense.description}\nالمبلغ: ${expense.amount.toLocaleString('ar-LY')} د.ل`, variant: 'destructive', confirmText: 'حذف' })) {
      return;
    }

    try {
      const { error } = await supabase
        .from('custody_expenses')
        .delete()
        .eq('id', expense.id);

      if (error) throw error;
      toast.success('تم حذف المصروف بنجاح');
      loadData();
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast.error('فشل في حذف المصروف');
    }
  };

  // Open edit expense dialog
  const handleEditExpense = (expense: CustodyExpense) => {
    setEditingExpense(expense);
    setExpenseAccountId(expense.custody_account_id);
    setExpenseCategory(expense.expense_category);
    setExpenseAmount(expense.amount.toString());
    setExpenseDate(expense.expense_date);
    setExpenseDescription(expense.description);
    setExpenseReceiptNumber(expense.receipt_number || '');
    setVendorName(expense.vendor_name || '');
    setExpenseNotes(expense.notes || '');
    setExpenseReceiptImageUrl((expense as any).receipt_image_url || '');
    setExpenseReceiptImagePath((expense as any).receipt_image_path || '');
    setExpenseDialogOpen(true);
  };

  // Delete transaction
  const handleDeleteTransaction = async (transaction: CustodyTransaction) => {
    if (!await systemConfirm({ title: 'تأكيد حذف الحركة', message: `هل تريد حذف هذه الحركة؟\n${transaction.description || transaction.transaction_type}\nالمبلغ: ${transaction.amount.toLocaleString('ar-LY')} د.ل`, variant: 'destructive', confirmText: 'حذف' })) {
      return;
    }

    try {
      const { error } = await supabase
        .from('custody_transactions')
        .delete()
        .eq('id', transaction.id);

      if (error) throw error;
      toast.success('تم حذف الحركة بنجاح');
      loadData();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast.error('فشل في حذف الحركة');
    }
  };

  // Open edit transaction dialog
  const handleEditTransaction = (transaction: CustodyTransaction) => {
    setEditingTransaction(transaction);
    setSelectedAccountId(transaction.custody_account_id);
    setTransactionType(transaction.transaction_type);
    setTransactionAmount(transaction.amount.toString());
    setTransactionDate(transaction.transaction_date);
    setTransactionDescription(transaction.description || '');
    setReceiptNumber(transaction.receipt_number || '');
    setReceiverName(transaction.receiver_name || '');
    setTransactionDialogOpen(true);
  };

  const resetAccountForm = () => {
    setSelectedEmployeeId('');
    setAccountNumber('');
    setCustodyName('');
    setInitialAmount('');
    setAccountNotes('');
  };
  
  // Handle edit account
  const handleOpenEditAccount = (account: CustodyAccount) => {
    setEditingAccount(account);
    setEditCustodyName(account.custody_name || '');
    setEditCurrentBalance(account.current_balance.toString());
    setEditAccountDialogOpen(true);
  };

  const handleSaveAccountEdit = async () => {
    if (!editingAccount) return;
    
    try {
      const newBalance = parseFloat(editCurrentBalance);
      if (isNaN(newBalance) || newBalance < 0) {
        toast.error('يرجى إدخال رصيد صحيح');
        return;
      }
      
      const { error } = await supabase
        .from('custody_accounts')
        .update({
          custody_name: editCustodyName || null,
          current_balance: newBalance
        })
        .eq('id', editingAccount.id);
      
      if (error) throw error;
      
      toast.success('تم تحديث العهدة بنجاح');
      setEditAccountDialogOpen(false);
      setEditingAccount(null);
      loadData();
    } catch (error) {
      console.error('Error updating custody:', error);
      toast.error('فشل في تحديث العهدة');
    }
  };
  
  // Open expense dialog for specific account
  const handleOpenExpenseForAccount = (account: CustodyAccount) => {
    setSelectedAccountForExpense(account);
    setExpenseAccountId(account.id);
    setExpenseDialogOpen(true);
  };

  const resetTransactionForm = () => {
    setSelectedAccountId('');
    setTransactionType('deposit');
    setTransactionAmount('');
    setTransactionDate(new Date().toISOString().slice(0, 10));
    setTransactionDescription('');
    setReceiptNumber('');
    setReceiverName('');
    setEditingTransaction(null);
  };

  const resetExpenseForm = () => {
    setExpenseAccountId('');
    setExpenseCategory('');
    setExpenseAmount('');
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setExpenseDescription('');
    setExpenseReceiptNumber('');
    setVendorName('');
    setExpenseNotes('');
    setExpenseReceiptImageUrl('');
    setExpenseReceiptImagePath('');
    setEditingExpense(null);
  };

  const resetDepositForm = () => {
    setDepositAmount('');
    setDepositDate(new Date().toISOString().slice(0, 10));
    setDepositDescription('');
    setDepositReceiptNumber('');
    setSelectedAccountForDeposit(null);
  };

  // إضافة رصيد للعهدة
  const handleAddDeposit = async () => {
    if (!selectedAccountForDeposit || !depositAmount || parseFloat(depositAmount) <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح');
      return;
    }

    try {
      const amount = parseFloat(depositAmount);
      
      // Insert deposit transaction - الـ trigger سيقوم بتحديث الرصيد تلقائياً
      const { error: txError } = await supabase
        .from('custody_transactions')
        .insert({
          custody_account_id: selectedAccountForDeposit.id,
          transaction_type: 'deposit',
          amount: amount,
          transaction_date: depositDate,
          description: depositDescription || 'إضافة رصيد',
          receipt_number: depositReceiptNumber || null
        });

      if (txError) throw txError;

      toast.success('تم إضافة الرصيد بنجاح');
      setDepositDialogOpen(false);
      resetDepositForm();
      loadData();
    } catch (error) {
      console.error('Error adding deposit:', error);
      toast.error('فشل في إضافة الرصيد');
    }
  };

  // ترجيع العهدة من الدفعة الموزعة
  const handleReturnCustody = async (account: CustodyAccount) => {
    if (!await systemConfirm({ title: 'ترجيع العهدة', message: `هل تريد ترجيع العهدة "${account.account_number}" للموظف "${(account.employee as any)?.name}"؟\n\nسيتم حذف العهدة وإرجاع المبلغ إلى الدفعة الموزعة.`, variant: 'destructive', confirmText: 'ترجيع' })) {
      return;
    }

    try {
      // حذف العهدة
      const { error } = await supabase
        .from('custody_accounts')
        .delete()
        .eq('id', account.id);

      if (error) throw error;

      toast.success('تم ترجيع العهدة بنجاح');
      loadData();
    } catch (error: any) {
      console.error('Error returning custody:', error);
      toast.error('فشل في ترجيع العهدة: ' + (error.message || ''));
    }
  };

  // حذف العهدة اليدوية
  const handleDeleteCustody = async (account: CustodyAccount) => {
    if (!await systemConfirm({ title: 'تأكيد حذف العهدة', message: `هل تريد حذف العهدة "${account.account_number}" للموظف "${(account.employee as any)?.name}"؟\n\nهذا الإجراء لا يمكن التراجع عنه.`, variant: 'destructive', confirmText: 'حذف' })) {
      return;
    }

    try {
      // حذف المعاملات والمصروفات المرتبطة أولاً
      await supabase.from('custody_transactions').delete().eq('custody_account_id', account.id);
      await supabase.from('custody_expenses').delete().eq('custody_account_id', account.id);

      // حذف العهدة
      const { error } = await supabase
        .from('custody_accounts')
        .delete()
        .eq('id', account.id);

      if (error) throw error;

      toast.success('تم حذف العهدة بنجاح');
      loadData();
    } catch (error: any) {
      console.error('Error deleting custody:', error);
      toast.error('فشل في حذف العهدة: ' + (error.message || ''));
    }
  };

  const totalCustodyBalance = accounts
    .filter(acc => acc.status === 'active')
    .reduce((sum, acc) => sum + acc.current_balance, 0);

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 space-y-6 max-w-7xl" dir="rtl">
      {/* Premium Glassmorphic Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/15 p-6 md:p-8 backdrop-blur-sm shadow-sm">
        <div className="absolute right-0 top-0 -z-10 h-32 w-32 rounded-full bg-primary/5 blur-3xl"></div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 text-white shrink-0">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">إدارة العهد المالية</h1>
              <p className="text-muted-foreground text-sm mt-1">تتبع كشوف العهد النشطة، المصروفات اليومية، وتوثيق تسويات العهد</p>
            </div>
          </div>
          {canEditSection && (
            <Button onClick={() => setAccountDialogOpen(true)} className="h-10 text-xs font-semibold gap-1.5 bg-primary hover:bg-primary/90 text-white shadow-sm w-full sm:w-auto">
              <Plus className="h-3.5 w-3.5" /> إنشاء عهدة جديدة
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-primary/20 bg-primary/[0.02] hover:bg-primary/[0.04] transition-all shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-primary"></div>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold text-primary flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5" /> إجمالي العهد النشطة
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl font-black font-numbers tracking-tight">
              {totalCustodyBalance.toLocaleString('en-US')} <span className="text-[10px] font-semibold text-muted-foreground">د.ل</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 bg-emerald-500/[0.02] hover:bg-emerald-500/[0.04] transition-all shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> عدد العهد النشطة
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl font-black font-numbers tracking-tight">
              {accounts.filter(acc => acc.status === 'active').length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/20 bg-amber-500/[0.02] hover:bg-amber-500/[0.04] transition-all shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-amber-500"></div>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> عدد الموظفين بعهد
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl font-black font-numbers tracking-tight">
              {new Set(accounts.filter(a => a.status === 'active').map(a => a.employee_id)).size}
            </div>
          </CardContent>
        </Card>

        <Card className="border-rose-500/20 bg-rose-500/[0.02] hover:bg-rose-500/[0.04] transition-all shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-rose-500"></div>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5" /> إجمالي المصروفات
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl font-black font-numbers tracking-tight">
              {totalExpenses.toLocaleString('en-US')} <span className="text-[10px] font-semibold text-muted-foreground">د.ل</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="by-employee" className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="by-employee" className="gap-2 text-xs sm:text-sm">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">حسب الموظف</span>
              <span className="sm:hidden">الموظفين</span>
            </TabsTrigger>
            <TabsTrigger value="accounts" className="gap-2 text-xs sm:text-sm">
              <Wallet className="h-4 w-4" />
              العهد
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-2 text-xs sm:text-sm">
              <DollarSign className="h-4 w-4" />
              الحركات
            </TabsTrigger>
          </TabsList>
        </div>

        {/* By Employee Tab */}
        <TabsContent value="by-employee">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                العهد المالية حسب الموظف
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                // Group accounts by employee
                const employeeGroups = accounts.reduce((groups, account) => {
                  const empId = account.employee_id;
                  if (!groups[empId]) {
                    groups[empId] = {
                      employee: account.employee,
                      accounts: []
                    };
                  }
                  groups[empId].accounts.push(account);
                  return groups;
                }, {} as Record<string, { employee: Employee | undefined; accounts: CustodyAccount[] }>);

                const groupedEmployees = Object.entries(employeeGroups);

                if (groupedEmployees.length === 0) {
                  return (
                    <div className="text-center text-muted-foreground py-8">
                      لا توجد عهد مالية
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {groupedEmployees.map(([empId, group]) => {
                      const totalInitial = group.accounts.reduce((sum, acc) => sum + acc.initial_amount, 0);
                      const totalBalance = group.accounts.reduce((sum, acc) => sum + acc.current_balance, 0);
                      const activeCount = group.accounts.filter(acc => acc.status === 'active').length;
                      
                      return (
                        <Card key={empId} className="border-2">
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <Users className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                  <CardTitle className="text-lg">{group.employee?.name || 'غير محدد'}</CardTitle>
                                  <p className="text-sm text-muted-foreground">{group.employee?.position || '-'}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-sm">
                                  {group.accounts.length} عهدة
                                </Badge>
                                {group.accounts.length > 0 && (
                                  <EmployeeCustodyStatementPrint
                                    employeeId={empId}
                                    employeeName={group.employee?.name || 'غير محدد'}
                                    employeePosition={group.employee?.position}
                                  />
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-4 gap-4 mb-4">
                              <div className="text-center p-3 bg-muted/50 rounded-lg">
                                <p className="text-xs text-muted-foreground">عدد العهد</p>
                                <p className="text-lg font-bold">{group.accounts.length}</p>
                              </div>
                              <div className="text-center p-3 bg-muted/50 rounded-lg">
                                <p className="text-xs text-muted-foreground">النشطة</p>
                                <p className="text-lg font-bold text-green-600">{activeCount}</p>
                              </div>
                              <div className="text-center p-3 bg-muted/50 rounded-lg">
                                <p className="text-xs text-muted-foreground">إجمالي المستلم</p>
                                <p className="text-lg font-bold">{totalInitial.toLocaleString('ar-LY')} د.ل</p>
                              </div>
                              <div className="text-center p-3 bg-muted/50 rounded-lg">
                                <p className="text-xs text-muted-foreground">الرصيد الحالي</p>
                                <p className={`text-lg font-bold ${totalBalance >= 0 ? 'text-primary' : 'text-red-600'}`}>
                                  {totalBalance.toLocaleString('ar-LY')} د.ل
                                </p>
                              </div>
                            </div>
                            
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-right">رقم العهدة</TableHead>
                                  <TableHead className="text-right">مسمى العهدة</TableHead>
                                  <TableHead className="text-right">المصدر</TableHead>
                                  <TableHead className="text-right">المبلغ الأولي</TableHead>
                                  <TableHead className="text-right">الإيداعات المضافة</TableHead>
                                  <TableHead className="text-right">الرصيد الحالي</TableHead>
                                  <TableHead className="text-right">تاريخ الاستلام</TableHead>
                                  <TableHead className="text-right">الحالة</TableHead>
                                  <TableHead className="text-right">الإجراءات</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {group.accounts.map(account => {
                                  // حساب إجمالي الإيداعات المضافة لهذه العهدة
                                  const accountDeposits = transactions
                                    .filter(t => t.custody_account_id === account.id && t.transaction_type === 'deposit')
                                    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
                                  
                                  return (
                                    <TableRow 
                                      key={account.id}
                                      className={account.source_type === 'distributed_payment' ? 'bg-amber-50 dark:bg-amber-950/20' : ''}
                                    >
                                      <TableCell className="font-medium">{account.account_number}</TableCell>
                                      <TableCell>
                                        {account.custody_name ? (
                                          <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                                            {account.custody_name}
                                          </Badge>
                                        ) : (
                                          <span className="text-muted-foreground">—</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="min-w-[200px]">
                                        {account.source_type === 'distributed_payment' ? (
                                          <div className="space-y-1.5 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-lg border border-amber-200 dark:border-amber-800">
                                            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                                              <CreditCard className="h-3 w-3 ml-1" />
                                              دفعة موزعة
                                            </Badge>
                                            {(account.source_customer_name || account.source_contract_number) && (
                                              <div className="text-sm space-y-0.5">
                                                {account.source_customer_name && (
                                                  <div className="flex items-center gap-1">
                                                    <span className="text-muted-foreground">الزبون:</span>
                                                    <span className="font-semibold text-foreground">{account.source_customer_name}</span>
                                                  </div>
                                                )}
                                                {account.source_contract_number && (
                                                  <div className="flex items-center gap-1">
                                                    <span className="text-muted-foreground">العقد:</span>
                                                    <span className="font-semibold font-manrope text-primary">#{account.source_contract_number}</span>
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                                            يدوي
                                          </Badge>
                                        )}
                                      </TableCell>
                                      <TableCell>{account.initial_amount.toLocaleString('ar-LY')} د.ل</TableCell>
                                      <TableCell>
                                        {accountDeposits > 0 ? (
                                          <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                                            <TrendingUp className="h-3 w-3 ml-1" />
                                            +{accountDeposits.toLocaleString('ar-LY')} د.ل
                                          </Badge>
                                        ) : (
                                          <span className="text-muted-foreground">—</span>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        {account.current_balance <= 0 ? (
                                          <Badge className="bg-green-600 text-white gap-1">
                                            <CheckCircle className="h-3 w-3" />
                                            مكتمل
                                          </Badge>
                                        ) : (
                                          <span className="font-bold font-manrope text-amber-600">
                                            {account.current_balance.toLocaleString('ar-LY')} د.ل
                                          </span>
                                        )}
                                      </TableCell>
                                    <TableCell>
                                      {(() => {
                                        const dateStr = account.source_type === 'distributed_payment' && account.source_payment_date 
                                          ? account.source_payment_date 
                                          : account.assigned_date;
                                        const date = new Date(dateStr);
                                        const day = date.getDate().toString().padStart(2, '0');
                                        const month = (date.getMonth() + 1).toString().padStart(2, '0');
                                        const year = date.getFullYear();
                                        return `${day}/${month}/${year}`;
                                      })()}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant={account.status === 'active' ? 'default' : 'secondary'}>
                                        {account.status === 'active' ? 'نشط' : 'مغلق'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex gap-1 flex-wrap">
                                        {account.status === 'active' && (
                                          <>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="gap-1 text-purple-600 border-purple-600 hover:bg-purple-50"
                                              onClick={() => handleOpenEditAccount(account)}
                                            >
                                              <Pencil className="h-3 w-3" />
                                              تعديل
                                            </Button>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="gap-1 text-red-600 border-red-600 hover:bg-red-50"
                                              onClick={() => {
                                                // ✅ منع إضافة مصروف إذا كان رصيد العهدة مكتمل/صفر
                                                if ((Number(account.current_balance) || 0) <= 0) {
                                                  toast.error('لا يمكن إضافة مصروف لعهدة رصيدها مكتمل/صفر');
                                                  return;
                                                }
                                                handleOpenExpenseForAccount(account);
                                              }}
                                            >
                                              <TrendingDown className="h-3 w-3" />
                                              مصروف
                                            </Button>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="gap-1 text-green-600 border-green-600 hover:bg-green-50"
                                              onClick={() => {
                                                setSelectedAccountForDeposit(account);
                                                setDepositDialogOpen(true);
                                              }}
                                            >
                                              <Plus className="h-3 w-3" />
                                              رصيد
                                            </Button>
                                          </>
                                        )}
                                        <CustodyReceiptPrint account={account} />
                                        <CustodyStatementPrint accountId={account.id} />
                                        {account.status === 'active' && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-1 text-blue-600 border-blue-600 hover:bg-blue-50"
                                            onClick={() => {
                                              setSelectedAccountForSettlement(account);
                                              setSettlementDialogOpen(true);
                                            }}
                                          >
                                            <CheckCircle className="h-3 w-3" />
                                            تسليم
                                          </Button>
                                        )}
                                        {account.source_type === 'distributed_payment' && account.status === 'active' && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-1 text-amber-600 border-amber-600 hover:bg-amber-50"
                                            onClick={() => handleReturnCustody(account)}
                                          >
                                            <Undo2 className="h-3 w-3" />
                                            ترجيع
                                          </Button>
                                        )}
                                        {account.source_type !== 'distributed_payment' && account.status === 'active' && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-1 text-red-600 border-red-600 hover:bg-red-50"
                                            onClick={() => handleDeleteCustody(account)}
                                          >
                                            <Trash2 className="h-3 w-3" />
                                            حذف
                                          </Button>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Accounts Tab */}
        <TabsContent value="accounts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                قائمة العهد المالية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">رقم العهدة</TableHead>
                    <TableHead className="text-right">الموظف</TableHead>
                    <TableHead className="text-right">المصدر</TableHead>
                    <TableHead className="text-right">الزبون / العقد</TableHead>
                    <TableHead className="text-right">المبلغ الأولي</TableHead>
                    <TableHead className="text-right">الرصيد الحالي</TableHead>
                    <TableHead className="text-right">تاريخ الاستلام</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        لا توجد عهد مالية
                      </TableCell>
                    </TableRow>
                  ) : (
                    accounts.map((account) => (
                      <TableRow 
                        key={account.id}
                        className={account.source_type === 'distributed_payment' ? 'bg-amber-50 dark:bg-amber-950/20' : ''}
                      >
                        <TableCell className="font-medium">{account.account_number}</TableCell>
                        <TableCell>{(account.employee as any)?.name || '-'}</TableCell>
                        <TableCell className="min-w-[180px]">
                          {account.source_type === 'distributed_payment' ? (
                            <div className="bg-amber-50 dark:bg-amber-950/30 p-2 rounded-lg border border-amber-200 dark:border-amber-800">
                              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 mb-1">
                                <CreditCard className="h-3 w-3 ml-1" />
                                دفعة موزعة
                              </Badge>
                            </div>
                          ) : (
                            <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                              يدوي
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="min-w-[160px]">
                          {account.source_type === 'distributed_payment' ? (
                            <div className="text-sm space-y-0.5">
                              <div className="font-semibold">{account.source_customer_name || '—'}</div>
                              {account.source_contract_number && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground">عقد </span>
                                  <span className="font-manrope font-bold text-primary">#{account.source_contract_number}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>{account.initial_amount.toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell>
                          {account.current_balance <= 0 ? (
                            <Badge className="bg-green-600 text-white gap-1">
                              <CheckCircle className="h-3 w-3" />
                              مكتمل
                            </Badge>
                          ) : (
                            <span className="font-bold font-manrope text-amber-600">
                              {account.current_balance.toLocaleString('ar-LY')} د.ل
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const dateStr = account.source_type === 'distributed_payment' && account.source_payment_date 
                              ? account.source_payment_date 
                              : account.assigned_date;
                            const date = new Date(dateStr);
                            const day = date.getDate().toString().padStart(2, '0');
                            const month = (date.getMonth() + 1).toString().padStart(2, '0');
                            const year = date.getFullYear();
                            return `${day}/${month}/${year}`;
                          })()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={account.status === 'active' ? 'default' : 'secondary'}>
                            {account.status === 'active' ? 'نشط' : 'مغلق'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2 flex-wrap">
                            <CustodyReceiptPrint account={account} />
                            <CustodyStatementPrint accountId={account.id} />
                            {account.status === 'active' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 text-green-600 border-green-600 hover:bg-green-50"
                                onClick={() => {
                                  setSelectedAccountForSettlement(account);
                                  setSettlementDialogOpen(true);
                                }}
                              >
                                <CheckCircle className="h-4 w-4" />
                                تسليم العهدة
                              </Button>
                            )}
                            {/* زر ترجيع العهدة للدفعات الموزعة */}
                            {account.source_type === 'distributed_payment' && account.status === 'active' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 text-amber-600 border-amber-600 hover:bg-amber-50"
                                onClick={() => handleReturnCustody(account)}
                              >
                                <Undo2 className="h-4 w-4" />
                                ترجيع
                              </Button>
                            )}
                            {/* زر حذف العهدة */}
                            {account.status === 'active' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 text-red-600 border-red-600 hover:bg-red-50"
                                onClick={() => handleDeleteCustody(account)}
                              >
                                <Trash2 className="h-4 w-4" />
                                حذف
                              </Button>
                            )}
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

        {/* Transactions Tab - Combined with Expenses, Grouped by Account */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                حركات العهدة
              </CardTitle>
              <div className="flex gap-2">
                <Button onClick={() => {
                  resetExpenseForm();
                  setExpenseDialogOpen(true);
                }} size="sm" className="gap-2" variant="destructive">
                  <Plus className="h-4 w-4" />
                  إضافة مصروف
                </Button>
                <Button onClick={() => setTransactionDialogOpen(true)} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  إضافة حركة
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                // دمج الحركات والمصروفات وتجميعها حسب العهدة
                type CombinedMovement = {
                  id: string;
                  date: string;
                  created_at: string;
                  type: 'transaction' | 'expense';
                  transactionType?: string;
                  amount: number;
                  description: string;
                  receipt_number: string | null;
                  custody_account_id: string;
                  expense_category?: string;
                  vendor_name?: string | null;
                  receiver_name?: string | null;
                  original: CustodyTransaction | CustodyExpense;
                };

                const allMovements: CombinedMovement[] = [
                  ...transactions.map(t => ({
                    id: t.id,
                    date: t.transaction_date,
                    created_at: t.transaction_date, // استخدام التاريخ كبديل
                    type: 'transaction' as const,
                    transactionType: t.transaction_type,
                    amount: t.amount,
                    description: t.description || '-',
                    receipt_number: t.receipt_number,
                    custody_account_id: t.custody_account_id,
                    receiver_name: t.receiver_name,
                    original: t
                  })),
                  ...expenses.map(e => ({
                    id: e.id,
                    date: e.expense_date,
                    created_at: e.expense_date,
                    type: 'expense' as const,
                    transactionType: 'expense',
                    amount: e.amount,
                    description: e.description,
                    receipt_number: e.receipt_number,
                    custody_account_id: e.custody_account_id,
                    expense_category: e.expense_category,
                    vendor_name: e.vendor_name,
                    original: e
                  }))
                ];

                // تجميع الحركات حسب العهدة
                const groupedByAccount = allMovements.reduce((groups, movement) => {
                  const accountId = movement.custody_account_id;
                  if (!groups[accountId]) {
                    groups[accountId] = [];
                  }
                  groups[accountId].push(movement);
                  return groups;
                }, {} as Record<string, CombinedMovement[]>);

                // ترتيب الحركات داخل كل مجموعة تنازلياً حسب التاريخ
                Object.keys(groupedByAccount).forEach(accountId => {
                  groupedByAccount[accountId].sort((a, b) => 
                    new Date(b.date).getTime() - new Date(a.date).getTime()
                  );
                });

                // ترتيب المجموعات حسب أحدث حركة
                const sortedAccountIds = Object.keys(groupedByAccount).sort((a, b) => {
                  const aLatest = groupedByAccount[a][0]?.date || '';
                  const bLatest = groupedByAccount[b][0]?.date || '';
                  return new Date(bLatest).getTime() - new Date(aLatest).getTime();
                });

                if (allMovements.length === 0) {
                  return (
                    <div className="text-center text-muted-foreground py-12">
                      <div className="flex flex-col items-center gap-2">
                        <DollarSign className="h-8 w-8 text-muted-foreground/50" />
                        <span>لا توجد حركات مسجلة</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="space-y-6">
                    {sortedAccountIds.map(accountId => {
                      const account = accounts.find(a => a.id === accountId);
                      const movements = groupedByAccount[accountId];
                      const totalDeposits = movements
                        .filter(m => m.transactionType === 'deposit')
                        .reduce((sum, m) => sum + m.amount, 0);
                      const totalWithdrawals = movements
                        .filter(m => m.transactionType === 'withdrawal' || m.type === 'expense')
                        .reduce((sum, m) => sum + m.amount, 0);

                      return (
                        <Card key={accountId} className="border-2">
                          <CardHeader className="pb-2 bg-muted/30">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <Wallet className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                  <CardTitle className="text-base">
                                    {account?.custody_name || account?.account_number || 'عهدة غير معروفة'}
                                  </CardTitle>
                                  <p className="text-sm text-muted-foreground">
                                    {account?.employee?.name || 'موظف غير محدد'} • {account?.account_number}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 text-sm">
                                <div className="text-center">
                                  <p className="text-xs text-muted-foreground">إجمالي الإيداعات</p>
                                  <p className="font-bold text-green-600 font-manrope">+{totalDeposits.toLocaleString('ar-LY')}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-xs text-muted-foreground">إجمالي السحب/المصروفات</p>
                                  <p className="font-bold text-red-600 font-manrope">-{totalWithdrawals.toLocaleString('ar-LY')}</p>
                                </div>
                                <Badge variant="outline">{movements.length} حركة</Badge>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-0">
                            <div className="rounded-lg overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-muted/50">
                                    <TableHead className="text-right font-semibold w-28">التاريخ</TableHead>
                                    <TableHead className="text-right font-semibold w-24">النوع</TableHead>
                                    <TableHead className="text-right font-semibold w-32">المبلغ</TableHead>
                                    <TableHead className="text-right font-semibold">الوصف</TableHead>
                                    <TableHead className="text-right font-semibold w-28">الفئة/المستلم</TableHead>
                                    <TableHead className="text-right font-semibold w-24">الإيصال</TableHead>
                                    <TableHead className="text-right font-semibold w-20">الإجراءات</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {movements.map((movement) => (
                                    <TableRow key={`${movement.type}-${movement.id}`} className="hover:bg-muted/30 transition-colors">
                                      <TableCell className="font-manrope text-sm">
                                        {movement.date.split('-').reverse().join('/')}
                                      </TableCell>
                                      <TableCell>
                                        {movement.type === 'expense' ? (
                                          <Badge variant="destructive" className="gap-1">
                                            <Receipt className="h-3 w-3" /> مصروف
                                          </Badge>
                                        ) : movement.transactionType === 'deposit' ? (
                                          <Badge className="bg-green-600 gap-1">
                                            <TrendingUp className="h-3 w-3" /> إيداع
                                          </Badge>
                                        ) : (
                                          <Badge variant="destructive" className="gap-1">
                                            <TrendingDown className="h-3 w-3" /> سحب
                                          </Badge>
                                        )}
                                      </TableCell>
                                      <TableCell className={`font-bold font-manrope ${
                                        movement.transactionType === 'deposit' ? 'text-green-600' : 'text-red-600'
                                      }`}>
                                        {movement.transactionType === 'deposit' ? '+' : '-'}
                                        {movement.amount.toLocaleString('ar-LY')} د.ل
                                      </TableCell>
                                      <TableCell className="max-w-[250px] truncate">{movement.description}</TableCell>
                                      <TableCell>
                                        {movement.type === 'expense' ? (
                                          <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                                            {movement.expense_category || 'عام'}
                                          </Badge>
                                        ) : (
                                          <span className="text-sm">{movement.receiver_name || '-'}</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="font-manrope text-xs">{movement.receipt_number || '-'}</TableCell>
                                      <TableCell>
                                        <div className="flex gap-1">
                                          <Button 
                                            variant="outline" 
                                            size="sm"
                                            className="gap-1 text-purple-600 border-purple-300 hover:bg-purple-50 h-7 w-7 p-0"
                                            onClick={() => {
                                              if (movement.type === 'expense') {
                                                handleEditExpense(movement.original as CustodyExpense);
                                              } else {
                                                handleEditTransaction(movement.original as CustodyTransaction);
                                              }
                                            }}
                                          >
                                            <Pencil className="h-3 w-3" />
                                          </Button>
                                          <Button 
                                            variant="outline" 
                                            size="sm"
                                            className="gap-1 text-red-600 border-red-300 hover:bg-red-50 h-7 w-7 p-0"
                                            onClick={() => {
                                              if (movement.type === 'expense') {
                                                handleDeleteExpense(movement.original as CustodyExpense);
                                              } else {
                                                handleDeleteTransaction(movement.original as CustodyTransaction);
                                              }
                                            }}
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Account Dialog */}
      <UIDialog.Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>إنشاء عهدة مالية جديدة</UIDialog.DialogTitle>
          </UIDialog.DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">الموظف *</label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الموظف" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name} - {emp.position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">مسمى العهدة (اختياري)</label>
              <Input
                value={custodyName}
                onChange={(e) => setCustodyName(e.target.value)}
                placeholder="مثال: عهدة المشتريات، عهدة الصيانة"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">رقم العهدة (اختياري)</label>
              <Input
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="سيتم التوليد تلقائياً"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">المبلغ الأولي *</label>
              <Input
                type="number"
                value={initialAmount}
                onChange={(e) => setInitialAmount(e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">ملاحظات</label>
              <Textarea
                value={accountNotes}
                onChange={(e) => setAccountNotes(e.target.value)}
                placeholder="ملاحظات إضافية"
                rows={3}
              />
            </div>
          </div>

          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={() => setAccountDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleCreateAccount} disabled={creating}>
              {creating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />جاري الإنشاء...</> : 'إنشاء العهدة'}
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* Add Transaction Dialog */}
      <UIDialog.Dialog open={transactionDialogOpen} onOpenChange={(open) => {
        setTransactionDialogOpen(open);
        if (!open) resetTransactionForm();
      }}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>{editingTransaction ? 'تعديل الحركة' : 'إضافة حركة جديدة'}</UIDialog.DialogTitle>
          </UIDialog.DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">العهدة *</label>
              <Select 
                value={selectedAccountId} 
                onValueChange={setSelectedAccountId}
                disabled={!!editingTransaction}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر العهدة" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.filter(acc => acc.status === 'active').map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.account_number} - {(acc.employee as any)?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">نوع الحركة *</label>
              <Select value={transactionType} onValueChange={setTransactionType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">إيداع</SelectItem>
                  <SelectItem value="withdrawal">سحب</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">المبلغ *</label>
              <Input
                type="number"
                value={transactionAmount}
                onChange={(e) => setTransactionAmount(e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">التاريخ *</label>
              <Input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">الوصف</label>
              <Input
                value={transactionDescription}
                onChange={(e) => setTransactionDescription(e.target.value)}
                placeholder="وصف الحركة"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">رقم الإيصال</label>
              <Input
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                placeholder="رقم الإيصال"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">اسم المستلم</label>
              <Input
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                placeholder="اسم المستلم"
              />
            </div>
          </div>

          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={() => {
              setTransactionDialogOpen(false);
              resetTransactionForm();
            }}>
              إلغاء
            </Button>
            <Button onClick={handleAddTransaction}>
              {editingTransaction ? 'حفظ التعديلات' : 'إضافة الحركة'}
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* Add/Edit Expense Dialog */}
      <UIDialog.Dialog open={expenseDialogOpen} onOpenChange={(open) => {
        setExpenseDialogOpen(open);
        if (!open) resetExpenseForm();
      }}>
        <UIDialog.DialogContent className="max-w-2xl">
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>
              {editingExpense ? 'تعديل المصروف' : 'إضافة مصروف جديد'}
            </UIDialog.DialogTitle>
            {editingExpense && (
              <p className="text-sm text-muted-foreground">
                العهدة: {getAccountInfo(editingExpense.custody_account_id, accounts)}
              </p>
            )}
          </UIDialog.DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">العهدة *</label>
              <Select 
                value={expenseAccountId} 
                onValueChange={setExpenseAccountId}
                disabled={!!editingExpense}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر العهدة" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.filter(acc => acc.status === 'active').map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.account_number} - {(acc.employee as any)?.name} 
                      {acc.current_balance <= 0 && <span className="text-red-500 mr-2">(رصيد: {acc.current_balance})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">الفئة *</label>
                <Input
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  placeholder="مثال: مصاريف تشغيل"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">المبلغ *</label>
                <Input
                  type="number"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">التاريخ *</label>
              <Input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">الوصف *</label>
              <Textarea
                value={expenseDescription}
                onChange={(e) => setExpenseDescription(e.target.value)}
                placeholder="وصف تفصيلي للمصروف"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">المورد</label>
                <Input
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="اسم المورد"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">رقم الإيصال</label>
                <Input
                  value={expenseReceiptNumber}
                  onChange={(e) => setExpenseReceiptNumber(e.target.value)}
                  placeholder="رقم الإيصال"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">ملاحظات</label>
              <Textarea
                value={expenseNotes}
                onChange={(e) => setExpenseNotes(e.target.value)}
                placeholder="ملاحظات إضافية"
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">صورة الفاتورة (اختياري)</label>
              {expenseReceiptImageUrl ? (
                <div className="flex items-start gap-3">
                  <img src={expenseReceiptImageUrl} alt="فاتورة المصروف" className="w-32 h-32 object-cover rounded-md border" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => { setExpenseReceiptImageUrl(''); setExpenseReceiptImagePath(''); }}
                  >
                    <Trash2 className="w-4 h-4 ml-1" /> إزالة الصورة
                  </Button>
                </div>
              ) : (
                <Input
                  type="file"
                  accept="image/*"
                  disabled={uploadingReceiptImage}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      setUploadingReceiptImage(true);
                      const { uploadImage } = await import('@/services/imageUploadService');
                      const url = await uploadImage(file, `expense-${Date.now()}-${file.name}`, 'custody-expenses');
                      setExpenseReceiptImageUrl(url);
                      setExpenseReceiptImagePath(`custody-expenses/${file.name}`);
                      toast.success('تم رفع صورة الفاتورة');
                    } catch (err: any) {
                      console.error(err);
                      toast.error('فشل رفع الصورة: ' + (err?.message || ''));
                    } finally {
                      setUploadingReceiptImage(false);
                      e.target.value = '';
                    }
                  }}
                />
              )}
              {uploadingReceiptImage && <span className="text-xs text-muted-foreground">جاري الرفع...</span>}
            </div>
          </div>

          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={() => {
              setExpenseDialogOpen(false);
              resetExpenseForm();
            }}>
              إلغاء
            </Button>
            <Button onClick={handleAddExpense} variant={editingExpense ? "default" : "destructive"}>
              {editingExpense ? 'حفظ التعديلات' : 'إضافة المصروف'}
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* Settlement Dialog */}
      {selectedAccountForSettlement && (
        <CustodySettlementDialog
          open={settlementDialogOpen}
          onOpenChange={(open) => {
            setSettlementDialogOpen(open);
            if (!open) setSelectedAccountForSettlement(null);
          }}
          account={selectedAccountForSettlement}
          onSuccess={loadData}
        />
      )}

      {/* Add Deposit Dialog */}
      <UIDialog.Dialog open={depositDialogOpen} onOpenChange={(open) => {
        setDepositDialogOpen(open);
        if (!open) resetDepositForm();
      }}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>إضافة رصيد للعهدة</UIDialog.DialogTitle>
            {selectedAccountForDeposit && (
              <p className="text-sm text-muted-foreground">
                العهدة: {selectedAccountForDeposit.account_number} - 
                الموظف: {(selectedAccountForDeposit.employee as any)?.name || '-'}
              </p>
            )}
          </UIDialog.DialogHeader>
          
          <div className="grid gap-4 py-4">
            {selectedAccountForDeposit && (
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">الرصيد الحالي</p>
                <p className="text-lg font-bold text-primary">
                  {selectedAccountForDeposit.current_balance.toLocaleString('ar-LY')} د.ل
                </p>
              </div>
            )}

            <div className="grid gap-2">
              <label className="text-sm font-medium">المبلغ *</label>
              <Input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">التاريخ *</label>
              <Input
                type="date"
                value={depositDate}
                onChange={(e) => setDepositDate(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">الوصف</label>
              <Input
                value={depositDescription}
                onChange={(e) => setDepositDescription(e.target.value)}
                placeholder="وصف الإضافة"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">رقم الإيصال</label>
              <Input
                value={depositReceiptNumber}
                onChange={(e) => setDepositReceiptNumber(e.target.value)}
                placeholder="رقم الإيصال"
              />
            </div>
          </div>

          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={() => setDepositDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleAddDeposit} className="bg-green-600 hover:bg-green-700">
              إضافة الرصيد
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* Edit Account Dialog */}
      <UIDialog.Dialog open={editAccountDialogOpen} onOpenChange={(open) => {
        setEditAccountDialogOpen(open);
        if (!open) setEditingAccount(null);
      }}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>تعديل العهدة</UIDialog.DialogTitle>
            {editingAccount && (
              <p className="text-sm text-muted-foreground">
                العهدة: {editingAccount.account_number} - 
                الموظف: {(editingAccount.employee as any)?.name || '-'}
              </p>
            )}
          </UIDialog.DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">مسمى العهدة</label>
              <Input
                value={editCustodyName}
                onChange={(e) => setEditCustodyName(e.target.value)}
                placeholder="مثال: عهدة المشتريات، عهدة الصيانة"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">الرصيد الحالي</label>
              <Input
                type="number"
                value={editCurrentBalance}
                onChange={(e) => setEditCurrentBalance(e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
              />
            </div>

            {editingAccount && (
              <div className="bg-muted/50 p-3 rounded-lg text-sm">
                <div className="flex justify-between">
                  <span>المبلغ الأولي:</span>
                  <span className="font-bold">{editingAccount.initial_amount.toLocaleString('ar-LY')} د.ل</span>
                </div>
              </div>
            )}
          </div>

          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={() => setEditAccountDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSaveAccountEdit} className="bg-purple-600 hover:bg-purple-700">
              حفظ التعديلات
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>
    </div>
  );
}