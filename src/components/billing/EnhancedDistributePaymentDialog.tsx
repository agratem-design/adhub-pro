import { buildReceiptAllocations, savedAllocationAmount } from '@/lib/distributionPayload';
import { calculateOperatingFees, operatingPool } from '@/lib/operatingFees';
import { validateDistribution } from '@/lib/distributionValidation';
import { DistributionReview } from './distribute-payment/DistributionReview';
import { createRequestId } from '@/lib/requestId';
import '@/components/finance/finance.css';
import { useState, useEffect, memo, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, FileText, PrinterIcon, ShoppingCart, DollarSign, Sparkles, AlertCircle, Wallet, Plus, X, UserCheck, Wrench, CheckCircle, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Sub-components
import { DistributionSummaryBar } from './distribute-payment/DistributionSummaryBar';
import { PaymentInputSection } from './distribute-payment/PaymentInputSection';
import { IntermediarySection } from './distribute-payment/IntermediarySection';
import { EmployeeDistributionSection } from './distribute-payment/EmployeeDistributionSection';
import { CustodySection } from './distribute-payment/CustodySection';
import { ItemsTabsSection } from './distribute-payment/ItemsTabsSection';
import { ExpensePaymentSection, type ExpensePaymentRow } from './distribute-payment/ExpensePaymentSection';

import type { Employee, EmployeeBalance, CustodyDistribution, EmployeePaymentDistribution, DistributableItem } from './distribute-payment/types';
interface EnhancedDistributePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  onSuccess: () => void;
  purchaseInvoice?: {
    id: string;
    invoice_number: string;
    total_amount: number;
    used_as_payment: number;
  } | null;
  friendRental?: {
    id: string;
    billboard_id: number;
    friend_rental_cost: number;
    used_as_payment: number;
    billboards?: {
      Billboard_Name?: string;
      name?: string;
    };
    _groupRentals?: Array<{
      id: string;
      billboard_id: number;
      contract_number?: number;
      friend_rental_cost: number;
      used_as_payment: number;
    }>;
    contract_number?: number;
  } | null;
  editMode?: boolean;
  editingDistributedPaymentId?: string | null;
  editingPayments?: any[];
  preSelectedContractIds?: number[];
  preFilledAmount?: number | null;
  sourceAccountPaymentId?: string | null;
}


export function EnhancedDistributePaymentDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  onSuccess,
  purchaseInvoice = null,
  friendRental = null,
  editMode = false,
  editingDistributedPaymentId = null,
  editingPayments = [],
  preSelectedContractIds = [],
  preFilledAmount = null,
  sourceAccountPaymentId = null,
}: EnhancedDistributePaymentDialogProps) {
  const [items, setItems] = useState<DistributableItem[]>([]);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const savingRef = useRef(false);
  const requestId = useRef(createRequestId());
  const newGroupId = useRef('');
  const [editDataLoading, setEditDataLoading] = useState(false);
  const [editDataError, setEditDataError] = useState('');
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('نقدي');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // ✅ NEW: حقول التحويل البنكي
  const [sourceBank, setSourceBank] = useState<string>('');
  const [destinationBank, setDestinationBank] = useState<string>('');
  const [transferReference, setTransferReference] = useState<string>('');
  const [transferImageUrl, setTransferImageUrl] = useState<string>('');
  
  // ✅ NEW: عمولات الوسيط والتحويل
  const [collectedViaIntermediary, setCollectedViaIntermediary] = useState(false);
  const [intermediaryCommission, setIntermediaryCommission] = useState<string>('0');
  const [transferFee, setTransferFee] = useState<string>('0');
  const [commissionNotes, setCommissionNotes] = useState<string>('');
  
  // ✅ NEW: بيانات الوسيط الأساسية
  const [collectorName, setCollectorName] = useState<string>('');
  const [receiverName, setReceiverName] = useState<string>('');
  const [deliveryLocation, setDeliveryLocation] = useState<string>('');
  const [collectionDate, setCollectionDate] = useState<string>('');
  
  // ✅ NEW: خيار تحويل كعهدة
  const [convertToCustody, setConvertToCustody] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [custodyDistributions, setCustodyDistributions] = useState<CustodyDistribution[]>([{ employeeId: '', amount: 0 }]);
  
  // ✅ NEW: خيارات توزيع الدفعة
  const [enableEmployee, setEnableEmployee] = useState(false);
  const [enableCustodyOption, setEnableCustodyOption] = useState(false);
  const [custodyOptionAmount, setCustodyOptionAmount] = useState('');
  
  // ✅ NEW: توزيع الدفع على الموظفين مع رصيد الموظف
  const [employeePaymentDistributions, setEmployeePaymentDistributions] = useState<EmployeePaymentDistribution[]>([{ employeeId: '', amount: 0, paymentType: 'advance' }]);
  const [employeeBalances, setEmployeeBalances] = useState<EmployeeBalance[]>([]);

  // ✅ NEW: سداد مصروفات موظفين
  const [enableExpensePayment, setEnableExpensePayment] = useState(false);
  const [expensePayments, setExpensePayments] = useState<ExpensePaymentRow[]>([]);
  const totalExpensePayments = expensePayments.reduce((s, p) => s + Number(p.amount || 0), 0);

  // ✅ معرّفات مصروفات محمّلة من وضع التعديل (لإظهارها حتى لو مسددة بالكامل)
  const [editingExpenseIds, setEditingExpenseIds] = useState<string[]>([]);

  // ✅ موظف نشط مشترك بين الأقسام لربط الاختيار
  const [activeEmployeeId, setActiveEmployeeId] = useState<string>('');

  // ✅ حفظ المبلغ المتبقي كرصيد عميل غير موزع
  const [saveRemainderAsCredit, setSaveRemainderAsCredit] = useState(true);

  // ✅ تفعيل التوزيعات الإضافية (سلف/عهد/مصاريف)
  const [enableAdditionalDistributions, setEnableAdditionalDistributions] = useState(false);

  // ✅ فاتورة المشتريات المرتبطة النشطة (تُحمل ديناميكياً في التعديل)
  const [activePurchaseInvoice, setActivePurchaseInvoice] = useState<{
    id: string;
    invoice_number: string;
    total_amount: number;
    used_as_payment: number;
  } | null>(null);

  // ✅ تحميل بيانات فاتورة المشتريات المرتبطة النشطة في وضع الإضافة أو التعديل
  useEffect(() => {
    if (!open) {
      setActivePurchaseInvoice(null);
      return;
    }

    if (purchaseInvoice) {
      setActivePurchaseInvoice(purchaseInvoice);
    } else if (editMode && editingPayments && editingPayments.length > 0) {
      const linkedInvoiceId = editingPayments.find(p => p.purchase_invoice_id)?.purchase_invoice_id;
      if (linkedInvoiceId) {
        const fetchPurchaseInvoice = async () => {
          const { data, error } = await supabase
            .from('purchase_invoices')
            .select('id, invoice_number, total_amount, used_as_payment')
            .eq('id', linkedInvoiceId)
            .single();
          if (!error && data) {
            setActivePurchaseInvoice(data);
          }
        };
        fetchPurchaseInvoice();
      } else {
        setActivePurchaseInvoice(null);
      }
    } else {
      setActivePurchaseInvoice(null);
    }
  }, [open, purchaseInvoice, editMode, editingPayments]);

  // ✅ Fix: useRef to avoid infinite loop from editingPayments reference changes
  const editingPaymentsRef = useRef(editingPayments);
  editingPaymentsRef.current = editingPayments;
  const abortControllerRef = useRef<AbortController | null>(null);

  const rentalGrouped = friendRental
    ? (Array.isArray(friendRental._groupRentals) && friendRental._groupRentals.length > 0
      ? friendRental._groupRentals
      : [friendRental])
    : [];
  const isRentalGrouped = rentalGrouped.length > 1;
  const rentalTotalCost = rentalGrouped.reduce((s, r) => s + (Number(r.friend_rental_cost) || 0), 0);
  const rentalUsedAsPayment = rentalGrouped.reduce((s, r) => s + (Number(r.used_as_payment) || 0), 0);
  const rentalAvailableCredit = rentalTotalCost - rentalUsedAsPayment;
  
  const contractNum = friendRental?.contract_number;
  const adType = (friendRental as any)?._contractAdType || '';
  const adTypeSuffix = adType ? ` - ${adType}` : '';

  const billboardName = friendRental
    ? (isRentalGrouped
      ? `عقد ${contractNum || ''}${adTypeSuffix} (${rentalGrouped.length} لوحات)`
      : `عقد ${contractNum || ''}${adTypeSuffix} - ${friendRental.billboards?.Billboard_Name || friendRental.billboards?.name || `لوحة ${friendRental.billboard_id}`}`)
    : '';

  const currentDistributionTotalForPurchase = useMemo(() => {
    if (!editMode || !editingPayments || !activePurchaseInvoice) return 0;
    return editingPayments
      .filter(p => p.purchase_invoice_id === activePurchaseInvoice.id)
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [editMode, editingPayments, activePurchaseInvoice]);

  const availableCredit = activePurchaseInvoice 
    ? activePurchaseInvoice.total_amount - (activePurchaseInvoice.used_as_payment - currentDistributionTotalForPurchase)
    : (friendRental ? rentalAvailableCredit : 0);

  // تحميل بيانات الموظفين المرتبطة بالدفعة عند التعديل
  const loadEditModeEmployeeData = async (distributedPaymentId: string) => {
    setEditDataLoading(true);
    try {
      let distributions: EmployeePaymentDistribution[] = [];
      
      // 1. تحميل السلف المرتبطة
      const { data: advances, error: advancesError } = await supabase
        .from('employee_advances')
        .select('employee_id, amount')
        .eq('distributed_payment_id', distributedPaymentId);
      
      if (!advancesError && advances && advances.length > 0) {
        advances.forEach(a => {
          distributions.push({
            employeeId: a.employee_id,
            amount: Number(a.amount) || 0,
            paymentType: 'advance' as const
          });
        });
      }
      
      // 2. ✅ تحميل سحوبات الرصيد من expenses_withdrawals
      const { data: withdrawals, error: withdrawalsError } = await supabase
        .from('expenses_withdrawals')
        .select('receiver_name, amount')
        .eq('distributed_payment_id', distributedPaymentId);
      
      if (advancesError) throw advancesError;
      if (withdrawalsError) throw withdrawalsError;
      const { data: recipients, error: recipientsError } = await supabase.from('employees').select('id, name, installation_team_id, linked_to_operating_expenses');
      if (recipientsError) throw recipientsError;
      for (const withdrawal of withdrawals || []) {
        const candidates = (recipients || []).filter(employee => employee.linked_to_operating_expenses && !employee.installation_team_id && (!withdrawal.receiver_name || employee.name === withdrawal.receiver_name));
        if (candidates.length !== 1) throw new Error('تعذر تحديد مستلم سحب قديم؛ راجع اسم المستلم قبل تعديل الدفعة');
        distributions.push({ employeeId: candidates[0].id, amount: Number(withdrawal.amount), paymentType: 'from_balance' });
      }
      const { data: teamPayments, error: teamError } = await (supabase as any).from('installation_team_accounts').select('team_id, amount').eq('distributed_payment_id', distributedPaymentId);
      if (teamError) throw teamError;
      const teamAmounts = new Map<string, number>();
      for (const row of teamPayments || []) teamAmounts.set(row.team_id, (teamAmounts.get(row.team_id) || 0) + Number(row.amount));
      for (const [teamId, amount] of teamAmounts) {
        const candidates = (recipients || []).filter(employee => employee.installation_team_id === teamId);
        if (candidates.length !== 1) throw new Error('تعذر تحديد موظف الفريق المرتبط؛ راجع مستلم سداد الفريق');
        distributions.push({ employeeId: candidates[0].id, amount, paymentType: 'from_balance' });
      }

      if (distributions.length > 0) {
        setEnableEmployee(true);
        setEmployeePaymentDistributions(distributions);
      }
      
      // 3. تحميل العهد المرتبطة
      const { data: custodies, error: custodiesError } = await supabase
        .from('custody_accounts')
        .select('id, employee_id, initial_amount, created_at')
        .eq('source_payment_id', distributedPaymentId)
        .eq('source_type', 'distributed_payment')
        .order('created_at', { ascending: true });
      
      if (custodiesError) throw custodiesError;
      if (!custodiesError && custodies && custodies.length > 0) {
        setEnableCustodyOption(true);
        setConvertToCustody(true);
        // منع تكرار الموظفين في وضع التعديل إذا كانت هناك عهد مكررة لنفس الدفعة
        const seenEmployees = new Set<string>();
        const custodyDists: CustodyDistribution[] = [];
        for (const c of custodies) {
          if (!c.employee_id || seenEmployees.has(c.employee_id)) throw new Error('توجد عهد مكررة أو بلا مستلم؛ راجع العهد المرتبطة قبل التعديل');
          seenEmployees.add(c.employee_id);
          custodyDists.push({
            employeeId: c.employee_id,
            amount: Number(c.initial_amount) || 0,
          });
        }
        setCustodyDistributions(custodyDists);
        const totalCustody = custodyDists.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
        setCustodyOptionAmount(String(totalCustody));
      }

      // 4. ✅ تحميل سداد المصروفات المرتبطة بهذه الدفعة الموزعة
      const { data: expPays, error: expPaysError } = await supabase
        .from('expense_payments')
        .select('expense_id, amount')
        .eq('distributed_payment_id', distributedPaymentId);

      if (expPaysError) throw expPaysError;
      if (!expPaysError && expPays && expPays.length > 0) {
        const rows = expPays.map((p: any) => ({
          expense_id: p.expense_id,
          amount: Number(p.amount) || 0,
        }));
        setEnableExpensePayment(true);
        setExpensePayments(rows);
        setEditingExpenseIds(rows.map(r => r.expense_id));

        // محاولة تحديد الموظف النشط من المصروف الأول
        const firstExpId = rows[0]?.expense_id;
        if (firstExpId) {
          const { data: expRow } = await supabase
            .from('expenses')
            .select('employee_id')
            .eq('id', firstExpId)
            .maybeSingle();
          if (expRow?.employee_id) {
            setActiveEmployeeId(expRow.employee_id);
          }
        }
      }

      if (
        distributions.length > 0 ||
        (custodies && custodies.length > 0) ||
        (expPays && expPays.length > 0)
      ) {
        setEnableAdditionalDistributions(true);
      }
    } catch (error) {
      console.error('Error loading edit mode employee data:', error);
      setEditDataError(error instanceof Error ? error.message : 'تعذر تحميل كل التوزيعات السابقة؛ أعد فتح الدفعة');
    } finally {
      setEditDataLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      requestId.current = createRequestId();
      newGroupId.current = 'dist-' + createRequestId();
      setEditDataError('');
      setEnableAdditionalDistributions(false);
      setEnableEmployee(false); setEnableCustodyOption(false); setConvertToCustody(false); setEnableExpensePayment(false);
      setExpensePayments([]); setEditingExpenseIds([]); setCustodyOptionAmount('');
      setEmployeePaymentDistributions([{ employeeId: '', amount: 0, paymentType: 'advance' }]);
      setCustodyDistributions([{ employeeId: '', amount: 0 }]);
      setCollectedViaIntermediary(false); setIntermediaryCommission('0'); setTransferFee('0');
      setCollectorName(''); setReceiverName(''); setDeliveryLocation(''); setCollectionDate(''); setCommissionNotes('');
      setStep(1);
      setSaveRemainderAsCredit(true);
      // ✅ Fix: read from ref to avoid stale closure without causing infinite loop
      const currentEditingPayments = editingPaymentsRef.current;
      
      if (editMode && currentEditingPayments && currentEditingPayments.length > 0) {
        // تحميل بيانات التعديل
        const totalAmt = currentEditingPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
        setTotalAmount(String(totalAmt));
        setPaymentMethod(currentEditingPayments[0]?.method || 'نقدي');
        setCollectedViaIntermediary(!!currentEditingPayments[0]?.collected_via_intermediary);
        setIntermediaryCommission(String(Math.max(0, ...currentEditingPayments.map(p => Number(p.intermediary_commission) || 0))));
        setTransferFee(String(Math.max(0, ...currentEditingPayments.map(p => Number(p.transfer_fee) || 0))));
        setCollectorName(currentEditingPayments[0]?.collector_name || '');
        setReceiverName(currentEditingPayments[0]?.receiver_name || '');
        setDeliveryLocation(currentEditingPayments[0]?.delivery_location || '');
        setCollectionDate(currentEditingPayments[0]?.collection_date || '');
        setCommissionNotes(currentEditingPayments[0]?.commission_notes || '');
        setPaymentReference(currentEditingPayments[0]?.reference || '');
        setPaymentNotes(currentEditingPayments[0]?.notes || '');
        setPaymentDate(currentEditingPayments[0]?.paid_at ? new Date(currentEditingPayments[0].paid_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
        
        // ✅ تحميل بيانات التحويل البنكي
        setSourceBank(currentEditingPayments[0]?.source_bank || '');
        setDestinationBank(currentEditingPayments[0]?.destination_bank || '');
        setTransferReference(currentEditingPayments[0]?.transfer_reference || '');
        // ✅ تحميل صورة الإيصال
        const rawImgUrl = currentEditingPayments[0]?.transfer_image_url || '';
        setTransferImageUrl(rawImgUrl);
        
        // تحميل بيانات الموظفين المرتبطة
        const distPaymentId = currentEditingPayments[0]?.distributed_payment_id;
        if (distPaymentId) {
          loadEditModeEmployeeData(distPaymentId);
        }
      } else {
        setTotalAmount(
          purchaseInvoice 
            ? String(availableCredit) 
            : (friendRental 
              ? String(availableCredit) 
              : (preFilledAmount ? String(preFilledAmount) : ''))
        );
        setPaymentMethod((purchaseInvoice || friendRental) ? 'مقايضة' : 'نقدي');
        setPaymentReference('');
        setPaymentNotes(
          purchaseInvoice 
            ? `مقايضة من فاتورة مشتريات ${purchaseInvoice.invoice_number}` 
            : (friendRental 
              ? `مقايضة من إيجار لوحة: ${billboardName}` 
              : '')
        );
        setPaymentDate(new Date().toISOString().split('T')[0]);
        // Reset states only for new payment
        setEnableEmployee(false);
        setEnableCustodyOption(false);
        setCustodyOptionAmount('');
        setEmployeePaymentDistributions([{ employeeId: '', amount: 0, paymentType: 'advance' }]);
        setCustodyDistributions([{ employeeId: '', amount: 0 }]);
        setConvertToCustody(false);
        // Reset bank transfer fields only for new payments
        setSourceBank('');
        setDestinationBank('');
        setTransferReference('');
        setTransferImageUrl('');
        setEnableExpensePayment(false);
        setExpensePayments([]);
        setEditingExpenseIds([]);
        setActiveEmployeeId('');
        setEnableAdditionalDistributions(false);
      }
      setEmployeeBalances([]);
      
      // ✅ Fix: abort previous request to prevent race conditions
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      loadDistributableItems();
    } else {
      // Cleanup on close
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    }
    // ✅ Fix: removed editingPayments from deps (use ref instead) to prevent infinite loop
  }, [open, customerId, editMode, purchaseInvoice, friendRental, editingDistributedPaymentId]);




  // تحميل الموظفين عند تفعيل خيار العهدة أو الموظف
  useEffect(() => {
    if ((convertToCustody || enableEmployee)) {
      // دائماً أعد تحميل الأرصدة عند تفعيل الخيار
      loadEmployeesWithBalances();
    }
  }, [convertToCustody, enableEmployee]);

  // The custody envelope, not the entire receipt, controls its single allocation.
  useEffect(() => {
    if (enableCustodyOption && custodyDistributions.length === 1) {
      setCustodyDistributions(previous => [{ ...previous[0], amount: Number(custodyOptionAmount) || 0 }]);
    }
  }, [custodyOptionAmount, enableCustodyOption, custodyDistributions.length]);

  // ✅ ربط تفاعلي: عند تعيين موظف نشط من قسم آخر، املأ تلقائياً أول صف فارغ
  useEffect(() => {
    if (!activeEmployeeId) return;
    if (enableEmployee && employeePaymentDistributions.length > 0) {
      const idx = employeePaymentDistributions.findIndex(d => !d.employeeId);
      if (idx !== -1) {
        updateEmployeePaymentDistribution(idx, 'employeeId', activeEmployeeId);
      }
    }
    if ((convertToCustody || enableCustodyOption) && custodyDistributions.length > 0) {
      const idx = custodyDistributions.findIndex(d => !d.employeeId);
      if (idx !== -1) {
        updateCustodyDistribution(idx, 'employeeId', activeEmployeeId);
      }
    }
  }, [activeEmployeeId, enableEmployee, convertToCustody, enableCustodyOption]);

  const loadEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, position, installation_team_id')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error loading employees:', error);
      toast.error('فشل في تحميل قائمة الموظفين');
    } finally {
      setLoadingEmployees(false);
    }
  };

  // تحميل الموظفين مع أرصدتهم مع احتساب التسكيرات
  const loadEmployeesWithBalances = async () => {
    setLoadingEmployees(true);
    try {
      // تحميل الموظفين
      const { data: employeesData, error: empError } = await supabase
        .from('employees')
        .select('id, name, position, installation_team_id, linked_to_operating_expenses')
        .eq('status', 'active')
        .order('name');

      if (empError) throw empError;
      setEmployees(employeesData || []);

      // تحميل التسكيرات
      const { data: closures, error: closuresError } = await supabase
        .from('period_closures')
        .select('*');

      if (closuresError) {
        console.error('Error loading closures:', closuresError);
      }

      // تحميل السحوبات
      const { data: withdrawals, error: withdrawalsError } = await supabase
        .from('expenses_withdrawals')
        .select('*');

      if (withdrawalsError) {
        console.error('Error loading withdrawals:', withdrawalsError);
      }

      // تحميل العقود المستبعدة
      const { data: flagsData } = await supabase
        .from('expenses_flags')
        .select('contract_id, excluded');
      
      const excludedSet = new Set<string>();
      (flagsData || []).forEach((flag: any) => {
        if (flag.excluded && flag.contract_id != null) {
          excludedSet.add(String(flag.contract_id));
        }
      });

      // دالة للتحقق إذا كان العقد مغطى بالتسكير
      const isContractCoveredByClosure = (contractNumber: number) => {
        if (!closures || closures.length === 0) return false;
        return closures.some(closure => {
          if (closure.closure_type === 'contract_range' && closure.contract_start && closure.contract_end) {
            return contractNumber >= Number(closure.contract_start) && contractNumber <= Number(closure.contract_end);
          }
          return false;
        });
      };

      // حساب رصيد كل موظف مع التسكيرات
      const balances: EmployeeBalance[] = [];
      
      for (const emp of employeesData || []) {
      // للموظفين المرتبطين بمصروفات التشغيل (بدون فريق)
        if (emp.linked_to_operating_expenses && !emp.installation_team_id) {
          // جلب العقود مع نسبة التشغيل ونسب التركيب والطباعة
          const { data: contracts, error: contractsError } = await supabase
            .from('Contract')
            .select('*');

          if (contractsError) {
            console.error('Error loading contracts:', contractsError);
            continue;
          }

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

          const eligibleWithdrawals = (withdrawals || []).filter(w => !editMode || w.distributed_payment_id !== editingDistributedPaymentId);
          const pool = operatingPool(contracts || [], paymentsData || [], eligibleWithdrawals, closures || [], excludedSet);
          const pendingAmount = Math.max(0, pool.remaining);

          balances.push({
            employeeId: emp.id,
            teamId: null,
            teamName: 'مصروفات التشغيل',
            pendingAmount: pendingAmount
          });
        }
        else if (emp.installation_team_id) {
          const { data: accounts, error } = await (supabase as any).from('installation_team_accounts')
            .select('amount, status, distributed_payment_id, installation_teams(team_name)').eq('team_id', emp.installation_team_id);
          if (error) throw error;
          const pending = (accounts || []).filter(account => account.status === 'pending' || (editMode && account.distributed_payment_id === editingDistributedPaymentId))
            .reduce((sum, account) => sum + Number(account.amount), 0);
          balances.push({ employeeId: emp.id, teamId: emp.installation_team_id, teamName: accounts?.[0]?.installation_teams?.team_name || 'فريق التركيب', pendingAmount: pending });
        }
      }
      
      console.log('📊 جميع أرصدة الموظفين:', balances);
      setEmployeeBalances(balances);

    } catch (error) {
      console.error('Error loading employees with balances:', error);
      toast.error('فشل في تحميل قائمة الموظفين');
    } finally {
      setLoadingEmployees(false);
    }
  };

  // الحصول على رصيد موظف محدد
  const getEmployeeBalance = (employeeId: string): EmployeeBalance | undefined => {
    return employeeBalances.find(b => b.employeeId === employeeId);
  };

  const addCustodyDistribution = () => {
    setCustodyDistributions([...custodyDistributions, { employeeId: '', amount: 0 }]);
  };

  const removeCustodyDistribution = (index: number) => {
    if (custodyDistributions.length > 1) {
      setCustodyDistributions(custodyDistributions.filter((_, i) => i !== index));
    }
  };

  const updateCustodyDistribution = (index: number, field: 'employeeId' | 'amount', value: string | number) => {
    const updated = [...custodyDistributions];
    if (field === 'employeeId') {
      updated[index].employeeId = value as string;
    } else {
      // قسم العهد مستقل عن مبلغ دفعة العميل
      updated[index].amount = Number(value) || 0;
    }
    setCustodyDistributions(updated);
  };

  const generateCustodyAccountNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `CUS-${timestamp}-${random}`;
  };

  // دوال إدارة توزيع الدفع على الموظفين
  const addEmployeePaymentDistribution = () => {
    setEmployeePaymentDistributions([...employeePaymentDistributions, { employeeId: '', amount: 0, paymentType: 'advance' }]);
  };

  const removeEmployeePaymentDistribution = (index: number) => {
    if (employeePaymentDistributions.length > 1) {
      setEmployeePaymentDistributions(employeePaymentDistributions.filter((_, i) => i !== index));
    }
  };

  const updateEmployeePaymentDistribution = (index: number, field: 'employeeId' | 'amount' | 'paymentType', value: string | number) => {
    const updated = [...employeePaymentDistributions];
    if (field === 'employeeId') {
      updated[index].employeeId = value as string;
      // عند تغيير الموظف، تحقق من رصيده وحدد نوع الدفع تلقائياً
      const balance = employeeBalances.find(b => b.employeeId === value);
      if (balance && balance.pendingAmount > 0) {
        updated[index].paymentType = 'from_balance';
      } else {
        updated[index].paymentType = 'advance';
      }
    } else if (field === 'amount') {
      // قسم دفع الموظفين مستقل عن مبلغ دفعة العميل
      updated[index].amount = Number(value) || 0;
    } else if (field === 'paymentType') {
      updated[index].paymentType = value as 'from_balance' | 'advance';
    }
    setEmployeePaymentDistributions(updated);
  };

  const getTotalEmployeePaymentAmount = () => {
    return employeePaymentDistributions.reduce((sum, d) => sum + d.amount, 0);
  };

  const loadDistributableItems = async () => {
    setLoading(true);
    try {
      const allItems: DistributableItem[] = [];

      // في وضع التعديل، جمع IDs العقود التي تم دفعها من الدفعة الموزعة
      const editingContractNumbers = new Set<number>();
      const editingPrintedInvoiceIds = new Set<string>();
      const editingSalesInvoiceIds = new Set<string>();
      const editingCompositeTaskIds = new Set<string>();
      
      if (editMode && editingPayments && editingPayments.length > 0) {
        editingPayments.forEach(p => {
          if (p.contract_number) editingContractNumbers.add(Number(p.contract_number));
          if (p.printed_invoice_id) editingPrintedInvoiceIds.add(p.printed_invoice_id);
          if (p.sales_invoice_id) editingSalesInvoiceIds.add(p.sales_invoice_id);
          if (p.composite_task_id) editingCompositeTaskIds.add(p.composite_task_id);
        });
      }

      // جلب العقود مع المدفوعات الفعلية من customer_payments
      const { data: contracts, error: contractsError } = await supabase
        .from('Contract')
        .select('Contract_Number, Total, "Total Paid", "Customer Name", "Ad Type"')
        .eq('customer_id', customerId);

      if (contractsError) {
        console.error('Error fetching contracts:', contractsError);
      }

      if (contracts) {
        // حساب المبلغ المدفوع من جدول customer_payments لكل عقد
        const { data: contractPayments } = await supabase
          .from('customer_payments')
          .select('contract_number, amount, entry_type')
          .eq('customer_id', customerId)
          .in('entry_type', ['receipt', 'payment', 'account_payment']);

        const paymentsByContract = new Map<number, number>();
        if (contractPayments) {
          contractPayments.forEach(p => {
            const contractNum = Number(p.contract_number);
            if (contractNum && (p.entry_type === 'receipt' || p.entry_type === 'payment' || p.entry_type === 'account_payment')) {
              const current = paymentsByContract.get(contractNum) || 0;
              paymentsByContract.set(contractNum, current + (Number(p.amount) || 0));
            }
          });
        }

        contracts.forEach(contract => {
          const total = Number(contract.Total) || 0;
          const contractNum = Number(contract.Contract_Number);
          const paid = paymentsByContract.get(contractNum) || 0;
          
          // ✅ إظهار العقد إذا كان له مبلغ متبقي أو كان جزءاً من الدفعة الموزعة المُحررة
          const isPartOfEditingPayment = editingContractNumbers.has(contractNum);
          
          // ✅ في وضع التعديل، أضف المبلغ المُحرر للمتبقي حتى يمكن تعديله
          let editingAmount = 0;
          if (isPartOfEditingPayment && editingPayments) {
            editingAmount = savedAllocationAmount(editingPayments, 'contract', contractNum);
          }
          
          const remaining = Math.max(0, total - paid + editingAmount);
          
          if (remaining > 0.01 || isPartOfEditingPayment) {
            allItems.push({
              id: contractNum,
              type: 'contract',
              displayName: `عقد #${contractNum}${(remaining - editingAmount) <= 0.01 ? ' (مسدد بالكامل)' : ''}`,
              adType: contract['Ad Type'] || 'غير محدد',
              totalAmount: total,
              paidAmount: paid - editingAmount, // عرض المدفوع بدون المبلغ المُحرر
              remainingAmount: remaining,
              selected: false,
              allocatedAmount: 0
            });
          }
        });
      }

      // جلب فواتير الطباعة غير المقفلة فقط
      const { data: printedInvoices, error: printedError } = await supabase
        .from('printed_invoices')
        .select('id, invoice_number, total_amount, paid_amount, notes')
        .eq('customer_id', customerId)
        .eq('locked', false);

      if (printedError) {
        console.error('Error fetching printed invoices:', printedError);
      }

      // ✅ جلب المهام المجمعة لاستبعاد فواتير الطباعة المرتبطة بها
      const compositeLinkedInvoiceIds = new Set<string>();
      const { data: compositeTasksForFilter } = await supabase
        .from('composite_tasks')
        .select('print_task_id, combined_invoice_id')
        .eq('customer_id', customerId);

      if (compositeTasksForFilter) {
        // استبعاد الفواتير الموحدة للمهام المجمعة
        compositeTasksForFilter.forEach(ct => {
          if (ct.combined_invoice_id) compositeLinkedInvoiceIds.add(ct.combined_invoice_id);
        });

        // استبعاد فواتير الطباعة المرتبطة بمهام طباعة ضمن مهام مجمعة
        const printTaskIds = compositeTasksForFilter.map(ct => ct.print_task_id).filter(Boolean) as string[];
        if (printTaskIds.length > 0) {
          const { data: printTasks } = await supabase
            .from('print_tasks')
            .select('invoice_id')
            .in('id', printTaskIds);
          printTasks?.forEach(pt => {
            if (pt.invoice_id) compositeLinkedInvoiceIds.add(pt.invoice_id);
          });
        }
      }

      if (printedInvoices) {
        // حساب المبلغ المدفوع من جدول customer_payments لكل فاتورة طباعة
        const { data: printedPayments } = await supabase
          .from('customer_payments')
          .select('printed_invoice_id, amount, entry_type')
          .eq('customer_id', customerId)
          .not('printed_invoice_id', 'is', null);

        const paymentsByPrintedInvoice = new Map<string, number>();
        if (printedPayments) {
          printedPayments.forEach(p => {
            if (p.printed_invoice_id && (p.entry_type === 'receipt' || p.entry_type === 'payment' || p.entry_type === 'account_payment')) {
              const current = paymentsByPrintedInvoice.get(p.printed_invoice_id) || 0;
              paymentsByPrintedInvoice.set(p.printed_invoice_id, current + (Number(p.amount) || 0));
            }
          });
        }

        printedInvoices.forEach(invoice => {
          // ✅ استبعاد الفواتير المرتبطة بمهام مجمعة
          if (compositeLinkedInvoiceIds.has(invoice.id)) return;
          
          const total = Number(invoice.total_amount) || 0;
          const paid = paymentsByPrintedInvoice.get(invoice.id) || 0;
          
          const isPartOfEditingPayment = editingPrintedInvoiceIds.has(invoice.id);
          
          // ✅ في وضع التعديل، أضف المبلغ المُحرر للمتبقي
          let editingAmount = 0;
          if (isPartOfEditingPayment && editingPayments) {
            editingAmount = savedAllocationAmount(editingPayments, 'printed_invoice', invoice.id);
          }
          
          const remaining = Math.max(0, total - paid + editingAmount);
          
          if (remaining > 0.01 || isPartOfEditingPayment) {
            allItems.push({
              id: invoice.id,
              type: 'printed_invoice',
              displayName: `فاتورة طباعة #${invoice.invoice_number}${invoice.notes ? ' - ' + invoice.notes : ''}${(remaining - editingAmount) <= 0.01 ? ' (مسددة بالكامل)' : ''}`,
              totalAmount: total,
              paidAmount: paid - editingAmount,
              remainingAmount: remaining,
              selected: false,
              allocatedAmount: 0
            });
          }
        });
      }

      // جلب فواتير المبيعات
      const { data: salesInvoices, error: salesError } = await supabase
        .from('sales_invoices')
        .select('id, invoice_number, total_amount, paid_amount, invoice_name, notes')
        .eq('customer_id', customerId);

      if (salesError) {
        console.error('Error fetching sales invoices:', salesError);
      }

      if (salesInvoices) {
        // حساب المبلغ المدفوع من جدول customer_payments لكل فاتورة مبيعات
        const { data: salesPayments } = await supabase
          .from('customer_payments')
          .select('sales_invoice_id, amount, entry_type')
          .eq('customer_id', customerId)
          .not('sales_invoice_id', 'is', null);

        const paymentsBySalesInvoice = new Map<string, number>();
        if (salesPayments) {
          salesPayments.forEach(p => {
            if (p.sales_invoice_id && (p.entry_type === 'receipt' || p.entry_type === 'payment' || p.entry_type === 'account_payment')) {
              const current = paymentsBySalesInvoice.get(p.sales_invoice_id) || 0;
              paymentsBySalesInvoice.set(p.sales_invoice_id, current + (Number(p.amount) || 0));
            }
          });
        }

        salesInvoices.forEach(invoice => {
          const total = Number(invoice.total_amount) || 0;
          const paid = paymentsBySalesInvoice.get(invoice.id) || 0;
          
          const isPartOfEditingPayment = editingSalesInvoiceIds.has(invoice.id);
          
          // ✅ في وضع التعديل، أضف المبلغ المُحرر للمتبقي
          let editingAmount = 0;
          if (isPartOfEditingPayment && editingPayments) {
            editingAmount = savedAllocationAmount(editingPayments, 'sales_invoice', invoice.id);
          }
          
          const remaining = Math.max(0, total - paid + editingAmount);
          
          if (remaining > 0.01 || isPartOfEditingPayment) {
            allItems.push({
              id: invoice.id,
              type: 'sales_invoice',
              displayName: `فاتورة مبيعات #${invoice.invoice_number}${invoice.invoice_name ? ' - ' + invoice.invoice_name : (invoice.notes ? ' - ' + invoice.notes : '')}${(remaining - editingAmount) <= 0.01 ? ' (مسددة بالكامل)' : ''}`,
              totalAmount: total,
              paidAmount: paid - editingAmount,
              remainingAmount: remaining,
              selected: false,
              allocatedAmount: 0
            });
          }
        });
      }

      // جلب المهام المجمعة (تركيب + طباعة + قص)
      const { data: compositeTasks, error: compositeError } = await supabase
        .from('composite_tasks')
        .select('id, contract_id, customer_total, paid_amount, customer_name, task_type, customer_installation_cost, customer_print_cost, customer_cutout_cost')
        .eq('customer_id', customerId);

      if (compositeError) {
        console.error('Error fetching composite tasks:', compositeError);
      }

      if (compositeTasks) {
        // حساب المبلغ المدفوع من جدول customer_payments لكل مهمة مجمعة
        const { data: compositePayments } = await supabase
          .from('customer_payments')
          .select('composite_task_id, amount, entry_type')
          .eq('customer_id', customerId)
          .not('composite_task_id', 'is', null);

        const paymentsByCompositeTask = new Map<string, number>();
        if (compositePayments) {
          compositePayments.forEach(p => {
            if (p.composite_task_id && (p.entry_type === 'receipt' || p.entry_type === 'payment' || p.entry_type === 'account_payment')) {
              const current = paymentsByCompositeTask.get(p.composite_task_id) || 0;
              paymentsByCompositeTask.set(p.composite_task_id, current + (Number(p.amount) || 0));
            }
          });
        }

        compositeTasks.forEach(task => {
          const total = Number(task.customer_total) || 0;
          const paid = paymentsByCompositeTask.get(task.id) || Number(task.paid_amount) || 0;
          
          // وصف نوع المهمة
          const taskTypeLabel = task.task_type === 'reinstallation' ? 'إعادة تركيب' : 'تركيب جديد';
          const components = [];
          if (task.customer_installation_cost > 0) components.push('تركيب');
          if (task.customer_print_cost > 0) components.push('طباعة');
          if (task.customer_cutout_cost > 0) components.push('قص');
          
          const isPartOfEditingPayment = editingCompositeTaskIds.has(task.id);
          
          // ✅ في وضع التعديل، أضف المبلغ المُحرر للمتبقي
          let editingAmount = 0;
          if (isPartOfEditingPayment && editingPayments) {
            editingAmount = savedAllocationAmount(editingPayments, 'composite_task', task.id);
          }
          
          const remaining = Math.max(0, total - paid + editingAmount);
          
          if (remaining > 0.01 || isPartOfEditingPayment) {
            allItems.push({
              id: task.id,
              type: 'composite_task',
              displayName: `مهمة مجمعة #${task.contract_id} (${taskTypeLabel})${(remaining - editingAmount) <= 0.01 ? ' (مسددة بالكامل)' : ''}`,
              adType: components.join(' + '),
              totalAmount: total,
              paidAmount: paid - editingAmount,
              remainingAmount: remaining,
              selected: false,
              allocatedAmount: 0
            });
          }
        });
      }

      // ✅ ترتيب من الأصغر للأكبر حسب رقم العقد
      allItems.sort((a, b) => Number(a.id) - Number(b.id));
      
      // في حالة التعديل، تحديد العناصر المحددة مسبقاً
      if (editMode && editingPayments && editingPayments.length > 0) {
        allItems.forEach(item => {
          const existingAmount = savedAllocationAmount(editingPayments, item.type, item.id);
          if (existingAmount > 0) {
            item.selected = true;
            item.allocatedAmount = existingAmount;
          }
        });
      }

      // ✅ تطبيق العقود المحددة مسبقاً من صفحة حساب الزبون
      if (!editMode && preSelectedContractIds && preSelectedContractIds.length > 0) {
        const preSelectedSet = new Set(preSelectedContractIds);
        allItems.forEach(item => {
          if (item.type === 'contract' && preSelectedSet.has(Number(item.id))) {
            item.selected = true;
          }
        });
      }
      
      setItems(allItems);
    } catch (error) {
      console.error('Error loading items:', error);
      toast.error('فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItemById = (id: string | number, selected: boolean, type?: DistributableItem['type']) => {
    setItems(prev => prev.map(it => {
      if (it.id === id && (!type || it.type === type)) {
        return {
          ...it,
          selected,
          allocatedAmount: selected ? it.allocatedAmount : 0
        };
      }
      return it;
    }));
  };

  const handleAmountChangeById = (id: string | number, value: string, type?: DistributableItem['type']) => {
    // السماح بالنص الفارغ أو القيم الصالحة فقط
    if (value === '') {
      setItems(prev => prev.map(it => {
        if (it.id === id && (!type || it.type === type)) {
          return { ...it, allocatedAmount: 0 };
        }
        return it;
      }));
      return;
    }

    const amount = Number.parseFloat(value);
    if (!Number.isFinite(amount)) return;

    setItems(prev => prev.map(it => {
      if (it.id === id && (!type || it.type === type)) {
        // ✅ السقف يخص دفعة العميل فقط (مستقل تماماً عن الموظفين/العهدة/المصاريف)
        const customerOthersAllocated = prev.reduce(
          (s, x) => s + ((x.id !== id || (type && x.type !== type)) && x.selected ? x.allocatedAmount : 0),
          0,
        );
        const inputNum = parseFloat(totalAmount) || 0;
        const poolCap = Math.max(0, inputNum - customerOthersAllocated);
        const safeAmount = Math.min(Math.max(0, amount), it.remainingAmount, poolCap);
        return { ...it, allocatedAmount: safeAmount };
      }
      return it;
    }));
  };

  const handleAutoDistribute = () => {
    const inputAmount = parseFloat(totalAmount) || 0;
    if (inputAmount <= 0) {
      toast.error('الرجاء إدخال مبلغ صحيح');
      return;
    }

    const selectedItems = items.filter(item => item.selected);
    if (selectedItems.length === 0) {
      toast.error('الرجاء اختيار عنصر واحد على الأقل');
      return;
    }

    // ✅ التوزيع التلقائي على عناصر العميل فقط — مستقل عن الأقسام الجانبية
    let remainingToDistribute = inputAmount;
    const newItems = items.map(item => ({ ...item }));

    // توزيع تلقائي ذكي: يبدأ من الأصغر إلى الأكبر
    for (const item of [...newItems].sort((a, b) => a.type === 'contract' && b.type === 'contract' ? Number(a.id) - Number(b.id) : 0)) {
      if (item.selected && remainingToDistribute > 0) {
        const amountToAllocate = Math.min(item.remainingAmount, remainingToDistribute);
        item.allocatedAmount = amountToAllocate;
        remainingToDistribute -= amountToAllocate;
      } else if (item.selected) {
        item.allocatedAmount = 0;
      }
    }

    setItems(newItems);
    
    if (remainingToDistribute > 0) {
      toast.info(`تم توزيع ${inputAmount - remainingToDistribute} د.ل - يتبقى ${remainingToDistribute.toFixed(2)} د.ل`);
    } else {
      toast.success('تم التوزيع التلقائي بنجاح');
    }
  };

  // ✅ احتساب موحّد: يشمل العميل + الموظفين + العهدة + سداد المصاريف
  const customerAllocated = items.reduce((sum, item) => sum + (item.selected ? item.allocatedAmount : 0), 0);
  const employeesAllocated = enableAdditionalDistributions && enableEmployee
    ? employeePaymentDistributions.reduce((s, d) => s + (Number(d.amount) || 0), 0)
    : 0;
  const custodyAllocated = enableAdditionalDistributions && enableCustodyOption
    ? (parseFloat(custodyOptionAmount) || 0)
    : 0;
  const expensesAllocated = enableAdditionalDistributions && enableExpensePayment ? totalExpensePayments : 0;

  // ✅ المبلغ الكلي للدفعة يخص عناصر العميل فقط؛ الموظفين/العهد/المصاريف مستقلون
  const sideAllocated = employeesAllocated + custodyAllocated + expensesAllocated; // للعرض فقط
  const totalAllocated = customerAllocated; // مقياس "الموزع للعميل"
  const inputAmountNum = parseFloat(totalAmount) || 0;
  // ✅ المتبقي يخص قسم العميل فقط
  const customerPool = inputAmountNum;
  const remainingToAllocate = customerPool - customerAllocated;
  // بركة مشتركة للأقسام الثلاثة (موظفين/عهدة/مصاريف) مستقلة عن العميل
  const feesAllocated = collectedViaIntermediary ? (Number(intermediaryCommission) || 0) + (Number(transferFee) || 0) : 0;
  const sidePool = Math.max(0, inputAmountNum - feesAllocated);
  const sideRemaining = Math.max(0, sidePool - employeesAllocated - custodyAllocated - expensesAllocated);
  const hasCustomerItems = items.some(i => i.selected && i.allocatedAmount > 0);
  const hasExpensePayments = enableAdditionalDistributions && enableExpensePayment && expensePayments.some(p => Number(p.amount) > 0);
  const hasAnyAllocation = (customerAllocated + sideAllocated) > 0;
  const validationErrors = validateDistribution({
    amount: inputAmountNum, fees: feesAllocated, items, saveCredit: saveRemainderAsCredit,
    employees: enableAdditionalDistributions && enableEmployee ? employeePaymentDistributions : [],
    balances: employeeBalances,
    custody: enableAdditionalDistributions && enableCustodyOption ? custodyDistributions : [],
    custodyAmount: custodyAllocated,
    expenses: enableAdditionalDistributions && enableExpensePayment ? expensePayments : [],
  });

  const handleDistribute = async () => {
    if (savingRef.current) return;
    if (!paymentDate || !Number.isFinite(new Date(paymentDate).getTime())) { toast.error('حدد تاريخًا صحيحًا للدفعة'); return; }
    if (collectedViaIntermediary && [Number(intermediaryCommission), Number(transferFee)].some(value => !Number.isFinite(value) || value < 0)) { toast.error('العمولات والرسوم يجب أن تكون مبالغ صحيحة غير سالبة'); return; }
    if (editDataLoading || editDataError) { toast.error(editDataError || 'انتظر تحميل التوزيعات المرتبطة'); return; }
    if (validationErrors.length) { toast.error(validationErrors[0]); return; }
    const selectedItems = items.filter(i => i.selected && i.allocatedAmount > 0);

    if (selectedItems.length === 0 && !hasAnyAllocation && !saveRemainderAsCredit) {
      toast.error('الرجاء اختيار عنصر واحد على الأقل وتخصيص مبلغ له');
      return;
    }

    // التحقق من الحد الأقصى للمقايضة مع فاتورة مشتريات
    if (activePurchaseInvoice && inputAmountNum > availableCredit + 0.01) {
      toast.error(`لا يمكن توزيع مبلغ أكبر من الرصيد المتاح في فاتورة المشتريات المرتبطة (${availableCredit.toLocaleString('ar-LY')} د.ل). يرجى تعديل فاتورة المشتريات أولاً.`);
      return;
    }

    // التحقق من حقول الوسيط إذا كان مفعلاً
    if (collectedViaIntermediary) {
      if (!collectorName.trim() || !receiverName.trim() || !deliveryLocation.trim() || !collectionDate) {
        toast.error('يرجى ملء جميع حقول الوسيط المطلوبة');
        return;
      }
    }

    // التحقق من صحة توزيع العهدة إذا كان مفعلاً
    if (enableAdditionalDistributions && enableCustodyOption && convertToCustody) {
      const validDistributions = custodyDistributions.filter(d => d.employeeId && d.amount > 0);
      if (validDistributions.length === 0) {
        toast.error('يرجى اختيار موظف واحد على الأقل وتحديد مبلغ للعهدة');
        return;
      }
      
      // التحقق من عدم تكرار الموظفين
      const employeeIds = validDistributions.map(d => d.employeeId);
      const uniqueEmployeeIds = new Set(employeeIds);
      if (uniqueEmployeeIds.size !== employeeIds.length) {
        toast.error('لا يمكن تكرار نفس الموظف في أكثر من توزيع');
        return;
      }
    }

    savingRef.current = true;
    setDistributing(true);
    try {
      const payments = buildReceiptAllocations({ items, amount: inputAmountNum, saveCredit: saveRemainderAsCredit,
        commission: collectedViaIntermediary ? Number(intermediaryCommission) || 0 : 0,
        transferFee: collectedViaIntermediary ? Number(transferFee) || 0 : 0,
        common: {
          customer_name: customerName, paid_at: paymentDate, method: paymentMethod,
          reference: paymentMethod === 'تحويل بنكي' ? transferReference : paymentReference || null,
          notes: paymentNotes || null, collected_via_intermediary: collectedViaIntermediary,
          collector_name: collectedViaIntermediary ? collectorName : null,
          receiver_name: collectedViaIntermediary ? receiverName : null,
          delivery_location: collectedViaIntermediary ? deliveryLocation : null,
          collection_date: collectedViaIntermediary ? collectionDate : null,
          commission_notes: collectedViaIntermediary ? commissionNotes : null,
          source_bank: paymentMethod === 'تحويل بنكي' ? sourceBank : null,
          destination_bank: paymentMethod === 'تحويل بنكي' ? destinationBank : null,
          transfer_reference: paymentMethod === 'تحويل بنكي' ? transferReference : null,
          transfer_image_url: transferImageUrl || null,
        },
      });
      const { error } = await (supabase as any).rpc('save_payment_distribution', {
        p_request_id: requestId.current,
        p_payload: {
          group_id: editMode ? editingDistributedPaymentId : newGroupId.current,
          customer_id: customerId, customer_name: customerName, amount: inputAmountNum, fees: feesAllocated,
          date: paymentDate, method: paymentMethod, sender_name: receiverName || collectorName || null,
          expected_payment_ids: editMode ? editingPayments.map(payment => payment.id) : [],
          source_payment_id: sourceAccountPaymentId,
          purchase_invoice_id: activePurchaseInvoice?.id || null,
          payments,
          employees: enableAdditionalDistributions && enableEmployee ? employeePaymentDistributions : [],
          custody: enableAdditionalDistributions && enableCustodyOption ? custodyDistributions : [],
          expenses: enableAdditionalDistributions && enableExpensePayment ? expensePayments : [],
          rentals: friendRental ? rentalGrouped.map(rental => ({ id: rental.id })) : [],
        },
      });
      if (error) throw error;
      toast.success('تم حفظ الدفعة وتوزيعاتها بنجاح');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'تعذر حفظ التوزيع؛ أعد المحاولة بالبيانات نفسها');
    } finally {
      savingRef.current = false;
      setDistributing(false);
    }
  };

  const maxStep = enableAdditionalDistributions ? 3 : 2;

  return (
    <Dialog open={open} onOpenChange={value => { if (!distributing) onOpenChange(value); }}>
      <DialogContent dir="rtl" className="finance-dialog w-[calc(100vw_-_1rem)] max-w-6xl h-[92vh] h-[92dvh] max-h-[95vh] max-h-[95dvh] flex flex-col bg-card border-primary/20 shadow-2xl overflow-hidden p-0 [&_button]:cursor-pointer [&_button]:transition-all [&_button]:duration-200">
        {/* Header */}
        <DialogHeader className="border-b border-border/50 p-4 bg-gradient-to-l from-primary/5 to-transparent shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20">
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                توزيع دفعة متعددة العناصر
              </DialogTitle>
              <DialogDescription asChild className="mt-0.5 flex items-center gap-2">
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <span>العميل:</span>
                  <Badge variant="outline" className="font-semibold bg-primary/10 text-primary border-primary/30 text-xs">
                    {customerName}
                  </Badge>
                </div>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col justify-center items-center py-16 gap-4 flex-1">
            <div className="p-4 rounded-full bg-primary/10">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
            <p className="text-muted-foreground">جاري تحميل البيانات...</p>
          </div>
        ) : (
          <>
            <nav aria-label="خطوات توزيع الدفعة" className="grid grid-flow-col auto-cols-fr gap-1.5 sm:gap-2 border-b bg-muted/20 p-2 sm:p-3 shrink-0">
              {['حساب العميل', ...(enableAdditionalDistributions ? ['أوجه صرف الدفعة'] : []), 'المراجعة والحفظ'].map((label, index) => (
                <button type="button" key={label} disabled={distributing || index + 1 > step} onClick={() => setStep(index + 1)} aria-current={step === index + 1 ? 'step' : undefined}
                  className={'flex min-h-12 items-center justify-center gap-1.5 sm:gap-2 rounded-xl px-1.5 sm:px-2 py-2.5 text-[11px] sm:text-sm font-semibold leading-snug transition-all duration-200 ' + (step === index + 1 ? 'bg-card text-primary shadow-sm ring-1 ring-primary/30' : 'text-muted-foreground hover:bg-muted')}>
                  <span className={'flex h-6 w-6 shrink-0 items-center justify-center rounded-full ' + (step === index + 1 ? 'bg-primary text-primary-foreground' : 'bg-muted')}>{index + 1}</span>{label}
                </button>
              ))}
            </nav>
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              {/* Step 1: Payment Details & Customer Allocation */}
              {step === 1 && (
                <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden min-h-0">
                  {/* Left Side (wider): Items Tabs */}
                  <div className="flex-1 lg:overflow-y-auto p-4 sm:p-5 lg:min-h-0 shrink-0 order-2 lg:order-1 border-r border-border/10 bg-background/30">
                    <ItemsTabsSection
                      items={items}
                      setItems={setItems}
                      onSelect={handleSelectItemById}
                      onAmountChange={handleAmountChangeById}
                      remainingToAllocate={remainingToAllocate}
                    />
                  </div>

                  {/* Right Side (narrower): Payment Inputs and Summary */}
                  <div className="lg:w-[380px] shrink-0 p-5 space-y-4 bg-card border-l border-border/50 lg:overflow-y-auto order-1 lg:order-2 flex flex-col justify-between">
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-primary dark:text-white border-b pb-2 mb-3 flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-primary" />
                        بيانات وتوزيع دفعة العميل
                      </h3>

                      {activePurchaseInvoice && (
                        <div className="flex flex-col gap-1.5 p-3.5 bg-purple-500/10 border border-purple-500/30 rounded-xl mb-3">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400">
                            <ShoppingCart className="h-4 w-4 shrink-0" />
                            مربوطة بفاتورة مشتريات (مقايضة)
                          </div>
                          <div className="text-[11px] text-muted-foreground space-y-1 mt-1 font-medium text-right" dir="rtl">
                            <div>رقم الفاتورة: <span className="font-bold text-foreground">#{activePurchaseInvoice.invoice_number}</span></div>
                            <div>إجمالي قيمة المشتريات: <span className="font-bold text-foreground">{(activePurchaseInvoice.total_amount || 0).toLocaleString('ar-LY')} د.ل</span></div>
                            {editMode ? (
                              <>
                                <div>المستعمل سابقاً في هذا التوزيع: <span className="font-bold text-foreground">{currentDistributionTotalForPurchase.toLocaleString('ar-LY')} د.ل</span></div>
                                <div>الحد الأقصى المتاح للتوزيع: <span className="font-bold text-emerald-400">{availableCredit.toLocaleString('ar-LY')} د.ل</span></div>
                              </>
                            ) : (
                              <div>الرصيد المتاح للاستعمال: <span className="font-bold text-emerald-400">{availableCredit.toLocaleString('ar-LY')} د.ل</span></div>
                            )}
                          </div>
                        </div>
                      )}

                      <PaymentInputSection
                        totalAmount={totalAmount}
                        setTotalAmount={setTotalAmount}
                        paymentMethod={paymentMethod}
                        setPaymentMethod={setPaymentMethod}
                        paymentDate={paymentDate}
                        setPaymentDate={setPaymentDate}
                        paymentReference={paymentReference}
                        setPaymentReference={setPaymentReference}
                        paymentNotes={paymentNotes}
                        setPaymentNotes={setPaymentNotes}
                        sourceBank={sourceBank}
                        setSourceBank={setSourceBank}
                        destinationBank={destinationBank}
                        setDestinationBank={setDestinationBank}
                        transferReference={transferReference}
                        setTransferReference={setTransferReference}
                        transferImageUrl={transferImageUrl}
                        setTransferImageUrl={setTransferImageUrl}
                        customerName={customerName}
                        contractIds={[...new Set(items.filter(i => i.selected && i.type === 'contract').map(i => i.id))]}
                      />

                      {/* Collapsible Intermediary Details */}
                      <div className="border border-border/40 rounded-xl overflow-hidden bg-background/20">
                        <div className="p-3">
                          <IntermediarySection
                            collectedViaIntermediary={collectedViaIntermediary}
                            setCollectedViaIntermediary={setCollectedViaIntermediary}
                            collectorName={collectorName}
                            setCollectorName={setCollectorName}
                            receiverName={receiverName}
                            setReceiverName={setReceiverName}
                            deliveryLocation={deliveryLocation}
                            setDeliveryLocation={setDeliveryLocation}
                            collectionDate={collectionDate}
                            setCollectionDate={setCollectionDate}
                            intermediaryCommission={intermediaryCommission}
                            setIntermediaryCommission={setIntermediaryCommission}
                            transferFee={transferFee}
                            setTransferFee={setTransferFee}
                            commissionNotes={commissionNotes}
                            setCommissionNotes={setCommissionNotes}
                            inputAmountNum={inputAmountNum}
                          />
                        </div>
                      </div>

                      <div className="border-t border-border/30 pt-3 space-y-4">
                        <h4 className="text-xs font-bold text-muted-foreground">حالة توزيع الرصيد</h4>
                        <DistributionSummaryBar
                          inputAmountNum={inputAmountNum}
                          totalAllocated={customerAllocated}
                          remainingToAllocate={remainingToAllocate}
                          breakdown={{
                            customer: customerAllocated,
                            employees: employeesAllocated,
                            custody: custodyAllocated,
                            expenses: expensesAllocated,
                          }}
                        />

                        <div className="space-y-3 pt-2">
                          {inputAmountNum > 0 && remainingToAllocate > 0.01 && (
                            <div className="flex flex-col gap-2 p-3 bg-primary/10 border border-primary/20 rounded-xl">
                              <div className="flex items-center gap-2">
                                <Checkbox 
                                  id="saveRemainderAsCredit" 
                                  checked={saveRemainderAsCredit}
                                  onCheckedChange={(checked) => setSaveRemainderAsCredit(!!checked)}
                                />
                                <Label htmlFor="saveRemainderAsCredit" className="text-xs font-semibold cursor-pointer text-foreground">
                                  حفظ المتبقي كرصيد غير موزع للعميل
                                </Label>
                              </div>
                              <p className="text-[10px] text-muted-foreground mr-6">
                                قيمة الرصيد: {remainingToAllocate.toLocaleString('ar-LY')} د.ل
                              </p>
                            </div>
                          )}

                          <Button
                            type="button"
                            onClick={handleAutoDistribute}
                            className="w-full h-10 bg-gradient-to-r from-primary to-primary/80 hover:from-primary hover:to-primary/90 text-primary-foreground font-bold text-xs shadow-lg shadow-primary/10 transition-transform hover:scale-[1.01]"
                            disabled={!totalAmount || items.filter(i => i.selected).length === 0}
                            size="sm"
                          >
                            <Sparkles className="h-4 w-4 ml-1.5 animate-pulse" />
                            توزيع تلقائي على المحدد (العقود الأقدم أولًا)
                          </Button>

                          {items.filter(i => i.selected).length === 0 && (
                            <div className="flex items-center gap-2 text-[11px] text-amber-600 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl">
                              <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                              <span>يرجى اختيار العقود أو الفواتير من التبويبات وتحديد قيم سدادها.</span>
                            </div>
                          )}

                          {inputAmountNum > 0 && remainingToAllocate > 0.01 && !saveRemainderAsCredit && (
                            <div className="flex items-center gap-2 text-[11px] text-red-600 bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl">
                              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                              <span>يجب توزيع المبلغ بالكامل أو تفعيل خيار حفظ المتبقي كرصيد.</span>
                            </div>
                          )}

                          {/* Toggle for additional distributions */}
                          <div className="flex items-center gap-2 p-3 bg-muted/40 border border-border/30 rounded-xl mt-2">
                            <Checkbox 
                              id="enableAdditionalDistributions" 
                              checked={enableAdditionalDistributions}
                              onCheckedChange={(checked) => {
                                const val = !!checked;
                                setEnableAdditionalDistributions(val);
                                if (!val) {
                                  // Reset step 2 fields if toggled off
                                  setEnableEmployee(false);
                                  setEnableCustodyOption(false);
                                  setConvertToCustody(false);
                                  setEnableExpensePayment(false);
                                }
                              }}
                            />
                            <Label htmlFor="enableAdditionalDistributions" className="text-xs font-semibold cursor-pointer text-foreground">
                              إضافة توزيعات إضافية (سلف/عهدة/مصاريف موظفين)
                            </Label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Disbursements & Custody */}
              {step === 2 && enableAdditionalDistributions && (
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 overflow-y-auto p-3 sm:p-5 gap-4 sm:gap-5 min-h-0 bg-background/20">
                  {/* 1. Employee Distributions */}
                  <div className="bg-card p-4 sm:p-5 rounded-2xl border border-border shadow-sm flex flex-col overflow-y-auto">
                    <div className="flex items-center justify-between border-b pb-3 mb-4">
                      <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-emerald-500/10">
                          <UserCheck className="h-4 w-4 text-emerald-600" />
                        </div>
                        دفعات وسلف الموظفين
                      </h3>
                      {employeesAllocated > 0 && (
                        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                          {employeesAllocated.toLocaleString('ar-LY')} د.ل
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <EmployeeDistributionSection
                        enableEmployee={enableEmployee}
                        setEnableEmployee={setEnableEmployee}
                        employeePaymentDistributions={employeePaymentDistributions}
                        addEmployeePaymentDistribution={addEmployeePaymentDistribution}
                        removeEmployeePaymentDistribution={removeEmployeePaymentDistribution}
                        updateEmployeePaymentDistribution={updateEmployeePaymentDistribution}
                        getTotalEmployeePaymentAmount={getTotalEmployeePaymentAmount}
                        employees={employees}
                        employeeBalances={employeeBalances}
                        loadingEmployees={loadingEmployees}
                        totalAmount={totalAmount}
                        remainingToAllocate={sideRemaining}
                        sectionPool={Math.max(0, sidePool - custodyAllocated - expensesAllocated)}
                      />
                    </div>
                  </div>

                  {/* 2. Custody Section */}
                  <div className="bg-card p-4 sm:p-5 rounded-2xl border border-border shadow-sm flex flex-col overflow-y-auto">
                    <div className="flex items-center justify-between border-b pb-3 mb-4">
                      <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-amber-500/10">
                          <Wallet className="h-4 w-4 text-amber-600" />
                        </div>
                        توزيع وإصدار العهد المالية
                      </h3>
                      {custodyAllocated > 0 && (
                        <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                          {custodyAllocated.toLocaleString('ar-LY')} د.ل
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <CustodySection
                        enableCustodyOption={enableCustodyOption}
                        setEnableCustodyOption={setEnableCustodyOption}
                        convertToCustody={convertToCustody}
                        setConvertToCustody={setConvertToCustody}
                        custodyOptionAmount={custodyOptionAmount}
                        setCustodyOptionAmount={setCustodyOptionAmount}
                        custodyDistributions={custodyDistributions}
                        addCustodyDistribution={addCustodyDistribution}
                        removeCustodyDistribution={removeCustodyDistribution}
                        updateCustodyDistribution={updateCustodyDistribution}
                        employees={employees}
                        loadingEmployees={loadingEmployees}
                        remainingToAllocate={sideRemaining}
                        sectionPool={Math.max(0, sidePool - employeesAllocated - expensesAllocated)}
                      />
                    </div>
                  </div>

                  {/* 3. Expense Payment Section */}
                  <div className="bg-card p-4 sm:p-5 rounded-2xl border border-border shadow-sm flex flex-col overflow-y-auto md:col-span-2 xl:col-span-1">
                    <div className="flex items-center justify-between border-b pb-3 mb-4">
                      <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-rose-500/10">
                          <Wrench className="h-4 w-4 text-rose-600" />
                        </div>
                        تسوية وسداد مصروفات تشغيلية
                      </h3>
                      {expensesAllocated > 0 && (
                        <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                          {expensesAllocated.toLocaleString('ar-LY')} د.ل
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <ExpensePaymentSection
                        enabled={enableExpensePayment}
                        setEnabled={setEnableExpensePayment}
                        expensePayments={expensePayments}
                        setExpensePayments={setExpensePayments}
                        refreshKey={open ? 1 : 0}
                        includeExpenseIds={editingExpenseIds}
                        selectedEmployeeId={activeEmployeeId}
                        onSelectedEmployeeIdChange={setActiveEmployeeId}
                        remainingToAllocate={sideRemaining}
                        sectionPool={Math.max(0, sidePool - employeesAllocated - custodyAllocated)}
                      />
                    </div>
                  </div>
                </div>
              )}
              {step === maxStep && <DistributionReview amount={inputAmountNum} fees={feesAllocated} items={items} employees={employeesAllocated} custody={custodyAllocated} expenses={expensesAllocated} errors={[...validationErrors, ...(editDataError ? [editDataError] : []), ...(editDataLoading ? ['جارٍ تحميل التوزيعات السابقة'] : [])]} customerName={customerName} date={paymentDate} method={paymentMethod} />}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="border-t border-border/50 p-4 bg-accent/5 shrink-0 flex items-center justify-between">
          <div className="flex flex-wrap gap-2 w-full">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(step - 1)}
                disabled={distributing}
                className="h-10 px-4 font-bold text-xs flex-1 sm:flex-none"
              >
                السابق
              </Button>
            )}
            
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={distributing}
              className="h-10 px-4 font-bold text-xs flex-1 sm:flex-none"
            >
              إلغاء
            </Button>
            
            {step < maxStep ? (
              <Button
                type="button"
                onClick={() => {
                  if (step === 1) {
                    if (inputAmountNum <= 0) {
                      toast.error('الرجاء إدخال مبلغ صحيح للدفعة');
                      return;
                    }
                    if (collectedViaIntermediary) {
                      if (!collectorName.trim() || !receiverName.trim() || !deliveryLocation.trim() || !collectionDate) {
                        toast.error('يرجى ملء جميع حقول الوسيط المطلوبة');
                        return;
                      }
                    }
                  }
                  setStep(step + 1);
                }}
                className="w-full sm:w-auto sm:mr-auto h-10 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs"
              >
                    {step + 1 === maxStep ? 'مراجعة التوزيع' : 'متابعة إلى أوجه الصرف'}
              </Button>
            ) : null}

            {/* Submit Button - visible in the final step (step 1 if additional distributions disabled, step 2 if enabled) */}
            {step === maxStep && (
              <Button
                type="button"
                onClick={handleDistribute}
                disabled={
                  distributing ||
                  loadingEmployees || editDataLoading || !!editDataError || validationErrors.length > 0 ||
                  (!hasCustomerItems && !hasExpensePayments && !hasAnyAllocation && !saveRemainderAsCredit) ||
                  (hasCustomerItems && inputAmountNum > 0 && Math.abs(remainingToAllocate) > 0.01 && !saveRemainderAsCredit)
                }
                className="w-full sm:w-auto sm:mr-auto h-10 px-6 font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 active:scale-[0.98]"
              >
                {distributing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري حفظ التوزيع...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    تأكيد وحفظ التوزيع
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
