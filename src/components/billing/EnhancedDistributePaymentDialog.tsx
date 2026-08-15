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
      
      if (!withdrawalsError && withdrawals && withdrawals.length > 0) {
        // جلب الموظف المرتبط بمصروفات التشغيل
        const { data: operatingEmployee } = await supabase
          .from('employees')
          .select('id, name')
          .eq('linked_to_operating_expenses', true)
          .single();
        
        if (operatingEmployee) {
          withdrawals.forEach(w => {
            distributions.push({
              employeeId: operatingEmployee.id,
              amount: Number(w.amount) || 0,
              paymentType: 'from_balance' as const
            });
          });
        }
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
      
      if (!custodiesError && custodies && custodies.length > 0) {
        setEnableCustodyOption(true);
        setConvertToCustody(true);
        // منع تكرار الموظفين في وضع التعديل إذا كانت هناك عهد مكررة لنفس الدفعة
        const seenEmployees = new Set<string>();
        const custodyDists: CustodyDistribution[] = [];
        for (const c of custodies) {
          if (!c.employee_id || seenEmployees.has(c.employee_id)) continue;
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
    }
  };

  useEffect(() => {
    if (open) {
      setStep(1);
      setSaveRemainderAsCredit(true);
      // ✅ Fix: read from ref to avoid stale closure without causing infinite loop
      const currentEditingPayments = editingPaymentsRef.current;
      
      if (editMode && currentEditingPayments && currentEditingPayments.length > 0) {
        // تحميل بيانات التعديل
        const totalAmt = currentEditingPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
        setTotalAmount(String(totalAmt));
        setPaymentMethod(currentEditingPayments[0]?.method || 'نقدي');
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

  // تحديث مبلغ العهدة عند تغيير المبلغ الكلي
  useEffect(() => {
    if (convertToCustody && custodyDistributions.length === 1) {
      const netAmount = inputAmountNum - (parseFloat(intermediaryCommission) || 0) - (parseFloat(transferFee) || 0);
      setCustodyDistributions([{ ...custodyDistributions[0], amount: netAmount }]);
    }
  }, [totalAmount, intermediaryCommission, transferFee, convertToCustody]);

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
            .select('Contract_Number, "Total Rent", Total, installation_cost, print_cost, operating_fee_rate, operating_fee_rate_installation, operating_fee_rate_print, include_operating_in_installation, include_operating_in_print, "Total Paid"');

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

          // فلترة العقود غير المغطاة بالتسكير وغير المستبعدة
          const uncoveredContracts = (contracts || []).filter(c => {
            const isExcluded = excludedSet.has(String(c.Contract_Number));
            const isClosed = isContractCoveredByClosure(c.Contract_Number);
            return !isExcluded && !isClosed;
          });

          // حساب النسبة المتحصلة فعلياً (نفس منطق صفحة مستحقات التشغيل Expenses.tsx)
          const totalOperatingDues = uncoveredContracts.reduce((sum, c) => {
            const rentCost = Number(c['Total Rent']) || 0;
            const installationCost = Number(c.installation_cost) || 0;
            const printCost = Number(c.print_cost) || 0;
            const feeRate = Number(c.operating_fee_rate) || 0;
            const feeRateInstallation = Number(c.operating_fee_rate_installation || feeRate) || 0;
            const feeRatePrint = Number(c.operating_fee_rate_print || feeRate) || 0;
            const includeInstallation = c.include_operating_in_installation === true;
            const includePrint = c.include_operating_in_print === true;

            const totalAmount = rentCost + installationCost + printCost;
            const totalPaid = paidByContract[String(c.Contract_Number)] || 0;
            const paymentRatio = totalAmount > 0 ? Math.min(1, totalPaid / totalAmount) : 0;

            let collectedFeeAmount = Math.round(rentCost * paymentRatio * (feeRate / 100));
            if (includeInstallation) collectedFeeAmount += Math.round(installationCost * paymentRatio * (feeRateInstallation / 100));
            if (includePrint) collectedFeeAmount += Math.round(printCost * paymentRatio * (feeRatePrint / 100));

            return sum + collectedFeeAmount;
          }, 0);

          // حساب إجمالي السحوبات - نفس منطق صفحة الموظف
          // للموظف المرتبط بمصروفات التشغيل بدون فريق، نحتسب جميع السحوبات
          // (السحوبات القديمة قد لا تحتوي على receiver_name)
          const employeeWithdrawals = (withdrawals || [])
            .reduce((sum, w) => sum + (Number(w.amount) || 0), 0);

          const pendingAmount = Math.max(0, totalOperatingDues - employeeWithdrawals);

          console.log(`📊 حساب رصيد ${emp.name}:`, {
            totalOperatingDues,
            employeeWithdrawals,
            pendingAmount,
            uncoveredContractsCount: uncoveredContracts.length,
            withdrawalsCount: (withdrawals || []).filter(w => w.receiver_name === emp.name).length
          });

          balances.push({
            employeeId: emp.id,
            teamId: null,
            teamName: 'مصروفات التشغيل',
            pendingAmount: pendingAmount
          });
        }
        // للموظفين المرتبطين بمصروفات التشغيل مع فريق
        else if (emp.linked_to_operating_expenses && emp.installation_team_id) {
          // جلب حسابات الفريق
          const { data: teamAccounts, error: teamAccountsError } = await supabase
            .from('installation_team_accounts')
            .select('*, installation_teams(team_name)')
            .eq('team_id', emp.installation_team_id);

          if (teamAccountsError) {
            console.error('Error loading team accounts:', teamAccountsError);
            continue;
          }

          // فلترة العقود غير المغطاة بالتسكير
          const uncoveredAccounts = (teamAccounts || []).filter(account => 
            !isContractCoveredByClosure(account.contract_id)
          );

          // حساب إجمالي المستحقات من العقود غير المغطاة
          const totalPending = uncoveredAccounts
            .filter(a => a.status === 'pending')
            .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

          // حساب إجمالي السحوبات لهذا الموظف فقط
          const totalWithdrawalsForTeam = (withdrawals || [])
            .filter(w => w.receiver_name === emp.name)
            .reduce((sum, w) => sum + (Number(w.amount) || 0), 0);

          const teamName = teamAccounts?.[0]?.installation_teams?.team_name || 'الفريق';
          const pendingAmount = Math.max(0, totalPending - totalWithdrawalsForTeam);

          balances.push({
            employeeId: emp.id,
            teamId: emp.installation_team_id,
            teamName: teamName,
            pendingAmount: pendingAmount
          });
        }
        // للموظفين العاديين مع فريق
        else if (emp.installation_team_id) {
          // استخدام team_accounts_summary
          const { data: teamSummary, error: summaryError } = await supabase
            .from('team_accounts_summary')
            .select('*')
            .eq('team_id', emp.installation_team_id)
            .single();

          if (!summaryError && teamSummary) {
            balances.push({
              employeeId: emp.id,
              teamId: emp.installation_team_id,
              teamName: teamSummary.team_name,
              pendingAmount: Number(teamSummary.pending_amount) || 0
            });
          }
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
            const existingPayment = editingPayments.find(p => Number(p.contract_number) === contractNum);
            editingAmount = existingPayment ? (Number(existingPayment.amount) || 0) : 0;
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
            const existingPayment = editingPayments.find(p => p.printed_invoice_id === invoice.id);
            editingAmount = existingPayment ? (Number(existingPayment.amount) || 0) : 0;
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
            const existingPayment = editingPayments.find(p => p.sales_invoice_id === invoice.id);
            editingAmount = existingPayment ? (Number(existingPayment.amount) || 0) : 0;
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
            const existingPayment = editingPayments.find(p => p.composite_task_id === task.id);
            editingAmount = existingPayment ? (Number(existingPayment.amount) || 0) : 0;
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
          const existingPayment = editingPayments.find(p => {
            if (item.type === 'contract') return Number(p.contract_number) === Number(item.id);
            if (item.type === 'printed_invoice') return p.printed_invoice_id === item.id;
            if (item.type === 'sales_invoice') return p.sales_invoice_id === item.id;
            if (item.type === 'composite_task') return p.composite_task_id === item.id;
            return false;
          });
          if (existingPayment) {
            item.selected = true;
            item.allocatedAmount = Number(existingPayment.amount) || 0;
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

  const handleSelectItemById = (id: string | number, selected: boolean) => {
    setItems(prev => prev.map(it => {
      if (it.id === id) {
        return {
          ...it,
          selected,
          allocatedAmount: selected ? it.allocatedAmount : 0
        };
      }
      return it;
    }));
  };

  const handleAmountChangeById = (id: string | number, value: string) => {
    // السماح بالنص الفارغ أو القيم الصالحة فقط
    if (value === '') {
      setItems(prev => prev.map(it => {
        if (it.id === id) {
          return { ...it, allocatedAmount: 0 };
        }
        return it;
      }));
      return;
    }

    const amount = Number.parseFloat(value);
    if (!Number.isFinite(amount)) return;

    setItems(prev => prev.map(it => {
      if (it.id === id) {
        // ✅ السقف يخص دفعة العميل فقط (مستقل تماماً عن الموظفين/العهدة/المصاريف)
        const customerOthersAllocated = prev.reduce(
          (s, x) => s + (x.id !== id && x.selected ? x.allocatedAmount : 0),
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
    const newItems = [...items];

    // توزيع تلقائي ذكي: يبدأ من الأصغر إلى الأكبر
    for (const item of newItems) {
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
  const employeesAllocated = enableEmployee
    ? employeePaymentDistributions.reduce((s, d) => s + (Number(d.amount) || 0), 0)
    : 0;
  const custodyAllocated = enableCustodyOption
    ? (parseFloat(custodyOptionAmount) || 0)
    : 0;
  const expensesAllocated = enableExpensePayment ? totalExpensePayments : 0;

  // ✅ المبلغ الكلي للدفعة يخص عناصر العميل فقط؛ الموظفين/العهد/المصاريف مستقلون
  const sideAllocated = employeesAllocated + custodyAllocated + expensesAllocated; // للعرض فقط
  const totalAllocated = customerAllocated; // مقياس "الموزع للعميل"
  const inputAmountNum = parseFloat(totalAmount) || 0;
  // ✅ المتبقي يخص قسم العميل فقط
  const customerPool = inputAmountNum;
  const remainingToAllocate = customerPool - customerAllocated;
  // بركة مشتركة للأقسام الثلاثة (موظفين/عهدة/مصاريف) مستقلة عن العميل
  const sidePool = inputAmountNum;
  const sideRemaining = Math.max(0, sidePool - employeesAllocated - custodyAllocated - expensesAllocated);
  const hasCustomerItems = items.some(i => i.selected && i.allocatedAmount > 0);
  const hasExpensePayments = expensePayments.some(p => Number(p.amount) > 0);
  const hasAnyAllocation = (customerAllocated + sideAllocated) > 0;

  const handleDistribute = async () => {
    const selectedItems = items.filter(i => i.selected && i.allocatedAmount > 0);

    if (selectedItems.length === 0 && !hasExpensePayments) {
      toast.error('الرجاء اختيار عنصر واحد على الأقل وتخصيص مبلغ له');
      return;
    }

    // التحقق من الحد الأقصى للمقايضة مع فاتورة مشتريات
    if (activePurchaseInvoice && inputAmountNum > availableCredit + 0.01) {
      toast.error(`لا يمكن توزيع مبلغ أكبر من الرصيد المتاح في فاتورة المشتريات المرتبطة (${availableCredit.toLocaleString('ar-LY')} د.ل). يرجى تعديل فاتورة المشتريات أولاً.`);
      return;
    }

    // ✅ التحقق على عناصر العميل فقط (الأقسام الأخرى مستقلة)
    if (hasCustomerItems) {
      if (inputAmountNum <= 0) {
        toast.error('الرجاء إدخال مبلغ صحيح');
        return;
      }
      if (customerAllocated > inputAmountNum + 0.01) {
        toast.error(`تجاوزت المبلغ الكلي بـ ${(customerAllocated - inputAmountNum).toFixed(2)} د.ل`);
        return;
      }
      if (inputAmountNum - customerAllocated > 0.01) {
        if (!saveRemainderAsCredit) {
          toast.error(`متبقي ${(inputAmountNum - customerAllocated).toFixed(2)} د.ل غير موزّع على عناصر العميل`);
          return;
        }
      }
    }

    // التحقق من حقول الوسيط إذا كان مفعلاً
    if (collectedViaIntermediary) {
      if (!collectorName.trim() || !receiverName.trim() || !deliveryLocation.trim() || !collectionDate) {
        toast.error('يرجى ملء جميع حقول الوسيط المطلوبة');
        return;
      }
    }

    // التحقق من صحة توزيع العهدة إذا كان مفعلاً
    if (convertToCustody) {
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

    setDistributing(true);
    
    try {
      // في حالة التعديل
      if (editMode && editingDistributedPaymentId) {
        // حذف الدفعات القديمة
        const { error: deleteError } = await supabase
          .from('customer_payments')
          .delete()
          .eq('distributed_payment_id', editingDistributedPaymentId);

        if (deleteError) {
          console.error('Error deleting old payments:', deleteError);
          throw deleteError;
        }
        
        // ✅ حذف السلف القديمة المرتبطة
        const { error: deleteAdvancesError } = await supabase
          .from('employee_advances')
          .delete()
          .eq('distributed_payment_id', editingDistributedPaymentId);
        
        if (deleteAdvancesError) {
          console.error('Error deleting old advances:', deleteAdvancesError);
        }
        
        // ✅ حذف السحوبات القديمة المرتبطة
        const { error: deleteWithdrawalsError } = await supabase
          .from('expenses_withdrawals')
          .delete()
          .eq('distributed_payment_id', editingDistributedPaymentId);
        
        if (deleteWithdrawalsError) {
          console.error('Error deleting old withdrawals:', deleteWithdrawalsError);
        }

        // ✅ حذف سداد المصروفات القديمة المرتبطة بهذه الدفعة
        const { error: deleteExpPaysError } = await supabase
          .from('expense_payments')
          .delete()
          .eq('distributed_payment_id', editingDistributedPaymentId);

        if (deleteExpPaysError) {
          console.error('Error deleting old expense payments:', deleteExpPaysError);
        }
      }

      const distributedPaymentId = editMode && editingDistributedPaymentId ? editingDistributedPaymentId : `dist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const currentDate = paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString();
      const paymentInserts = [];
      const errors = [];

      // تجهيز/تنظيف العهد الحالية للدفعة (مهم جداً لمنع تكرار العهد عند تعديل الدفعة)
      let existingCustodyAccounts: Array<{ id: string; employee_id: string; account_number: string; created_at: string | null }> = [];
      const movementCountByCustodyId: Record<string, number> = {};
      if (convertToCustody) {
        const { data: existingCustody, error: existingCustodyError } = await supabase
          .from('custody_accounts')
          .select('id, employee_id, account_number, created_at')
          .eq('source_payment_id', distributedPaymentId)
          .eq('source_type', 'distributed_payment');

        if (existingCustodyError) {
          console.error('Error fetching existing custody accounts:', existingCustodyError);
        } else if (existingCustody && existingCustody.length > 0) {
          existingCustodyAccounts = existingCustody as any;

          const custodyIds = existingCustodyAccounts.map(c => c.id);
          custodyIds.forEach(id => {
            movementCountByCustodyId[id] = 0;
          });

          // حساب عدد الحركات/المصروفات لكل عهدة
          const [{ data: txData }, { data: expData }] = await Promise.all([
            supabase.from('custody_transactions').select('id, custody_account_id').in('custody_account_id', custodyIds),
            supabase.from('custody_expenses').select('id, custody_account_id').in('custody_account_id', custodyIds),
          ]);

          (txData || []).forEach(t => {
            movementCountByCustodyId[t.custody_account_id] = (movementCountByCustodyId[t.custody_account_id] || 0) + 1;
          });
          (expData || []).forEach(e => {
            movementCountByCustodyId[e.custody_account_id] = (movementCountByCustodyId[e.custody_account_id] || 0) + 1;
          });

          // تنظيف العهد المكررة لنفس الموظف (نحذف فقط العهد بدون حركات)
          const byEmployee: Record<string, Array<{ id: string; employee_id: string; account_number: string; created_at: string | null }>> = {};
          existingCustodyAccounts.forEach(c => {
            if (!c.employee_id) return;
            if (!byEmployee[c.employee_id]) byEmployee[c.employee_id] = [];
            byEmployee[c.employee_id].push(c);
          });

          const idsToDelete: string[] = [];
          Object.values(byEmployee).forEach(list => {
            if (list.length <= 1) return;

            const withMovements = list.filter(c => (movementCountByCustodyId[c.id] || 0) > 0);
            // إذا كانت هناك أكثر من عهدة عليها حركات لنفس الموظف، لا نحذف تلقائياً لتجنب فقد البيانات
            if (withMovements.length > 1) return;

            const keep = withMovements.length === 1
              ? withMovements[0]
              : [...list].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())[0];

            list.forEach(c => {
              if (c.id === keep.id) return;
              if ((movementCountByCustodyId[c.id] || 0) === 0) idsToDelete.push(c.id);
            });
          });

          if (idsToDelete.length > 0) {
            await supabase.from('custody_transactions').delete().in('custody_account_id', idsToDelete);
            await supabase.from('custody_expenses').delete().in('custody_account_id', idsToDelete);
            const { error: deleteDupCustodyError } = await supabase
              .from('custody_accounts')
              .delete()
              .in('id', idsToDelete);
            if (deleteDupCustodyError) {
              console.error('Error deleting duplicate custody accounts:', deleteDupCustodyError);
            } else {
              existingCustodyAccounts = existingCustodyAccounts.filter(c => !idsToDelete.includes(c.id));
            }
          }
        }
      }

      console.log('🔄 بدء توزيع الدفعة:', {
        totalAmount: inputAmountNum,
        selectedItems: selectedItems.length,
        distributedPaymentId
      });

      // حساب الصافي بعد العمولات
      const commissionAmount = (parseFloat(intermediaryCommission) || 0) + (parseFloat(transferFee) || 0);
      const netAmount = inputAmountNum - commissionAmount;

      // إدخال جميع الدفعات
      for (const item of selectedItems) {
        // الملاحظات بدون معلومات البنك (لأنها مخزنة في حقول منفصلة)
        let fullNotes = paymentNotes || `توزيع على ${item.displayName} من دفعة بمبلغ ${inputAmountNum.toFixed(2)} د.ل`;

        const paymentData: any = {
          customer_id: customerId,
          customer_name: customerName,
          amount: item.allocatedAmount,
          paid_at: currentDate,
          method: paymentMethod || 'نقدي',
          reference: paymentMethod === 'تحويل بنكي' ? transferReference : (paymentReference || null),
          entry_type: 'payment',
          distributed_payment_id: distributedPaymentId,
          notes: fullNotes,
          collected_via_intermediary: collectedViaIntermediary,
          intermediary_commission: collectedViaIntermediary ? (parseFloat(intermediaryCommission) || 0) : 0,
          transfer_fee: collectedViaIntermediary ? (parseFloat(transferFee) || 0) : 0,
          net_amount: item.allocatedAmount,
          commission_notes: collectedViaIntermediary ? commissionNotes : null,
          collector_name: collectedViaIntermediary ? collectorName : null,
          receiver_name: collectedViaIntermediary ? receiverName : null,
          delivery_location: collectedViaIntermediary ? deliveryLocation : null,
          collection_date: collectedViaIntermediary ? collectionDate : null,
          source_bank: paymentMethod === 'تحويل بنكي' ? sourceBank : null,
          destination_bank: paymentMethod === 'تحويل بنكي' ? destinationBank : null,
          transfer_reference: paymentMethod === 'تحويل بنكي' ? transferReference : null,
          transfer_image_url: transferImageUrl || null
        };

        // إضافة purchase_invoice_id في حالة المقايضة
        if (purchaseInvoice) {
          paymentData.purchase_invoice_id = purchaseInvoice.id;
        }

        if (item.type === 'contract') {
          paymentData.contract_number = Number(item.id);
        } else if (item.type === 'printed_invoice') {
          paymentData.printed_invoice_id = String(item.id);
        } else if (item.type === 'sales_invoice') {
          paymentData.sales_invoice_id = String(item.id);
        } else if (item.type === 'composite_task') {
          paymentData.composite_task_id = String(item.id);
        }

        console.log(`💳 إضافة دفعة لـ ${item.displayName}:`, paymentData);

        const { error: paymentError, data: paymentResult } = await supabase
          .from('customer_payments')
          .insert(paymentData)
          .select();

        if (paymentError) {
          console.error(`❌ خطأ في إضافة دفعة ${item.displayName}:`, paymentError);
          errors.push(`فشل حفظ الدفعة لـ ${item.displayName}: ${paymentError.message}`);
          continue;
        }

        console.log(`✅ تم إضافة الدفعة لـ ${item.displayName}:`, paymentResult);
        paymentInserts.push({ item, paymentResult });
      }

      if (errors.length > 0) {
        toast.error(`حدثت أخطاء:\n${errors.join('\n')}`);
        setDistributing(false);
        return;
      }

      // ✅ حفظ الرصيد المتبقي غير الموزع كدفعة حساب للزبون
      if (saveRemainderAsCredit && remainingToAllocate > 0.01) {
        const creditNotes = paymentNotes 
          ? `${paymentNotes} - (رصيد متبقي غير موزع)` 
          : `رصيد متبقي غير موزع من دفعة بمبلغ ${inputAmountNum.toFixed(2)} د.ل`;
          
        const creditPaymentData: any = {
          customer_id: customerId,
          customer_name: customerName,
          amount: remainingToAllocate,
          paid_at: currentDate,
          method: paymentMethod || 'نقدي',
          reference: paymentMethod === 'تحويل بنكي' ? transferReference : (paymentReference || null),
          entry_type: 'payment',
          distributed_payment_id: distributedPaymentId,
          notes: creditNotes,
          collected_via_intermediary: collectedViaIntermediary,
          intermediary_commission: collectedViaIntermediary ? (parseFloat(intermediaryCommission) || 0) : 0,
          transfer_fee: collectedViaIntermediary ? (parseFloat(transferFee) || 0) : 0,
          net_amount: remainingToAllocate,
          commission_notes: collectedViaIntermediary ? commissionNotes : null,
          collector_name: collectedViaIntermediary ? collectorName : null,
          receiver_name: collectedViaIntermediary ? receiverName : null,
          delivery_location: collectedViaIntermediary ? deliveryLocation : null,
          collection_date: collectedViaIntermediary ? collectionDate : null,
          source_bank: paymentMethod === 'تحويل بنكي' ? sourceBank : null,
          destination_bank: paymentMethod === 'تحويل بنكي' ? destinationBank : null,
          transfer_reference: paymentMethod === 'تحويل بنكي' ? transferReference : null,
          transfer_image_url: transferImageUrl || null
        };
        
        if (purchaseInvoice) {
          creditPaymentData.purchase_invoice_id = purchaseInvoice.id;
        }

        console.log('💳 إضافة رصيد متبقي غير موزع:', creditPaymentData);
        
        const { error: creditError } = await supabase
          .from('customer_payments')
          .insert(creditPaymentData);
          
        if (creditError) {
          console.error('❌ خطأ في إضافة الرصيد المتبقي:', creditError);
          errors.push(`فشل حفظ الرصيد المتبقي للعميل: ${creditError.message}`);
        } else {
          console.log('✅ تم إضافة الرصيد المتبقي بنجاح');
        }
      }

      // تحديث المبالغ المدفوعة
      for (const { item } of paymentInserts) {
        try {
          if (item.type === 'contract') {
            const newPaidAmount = item.paidAmount + item.allocatedAmount;
            
            console.log(`📝 تحديث عقد #${item.id}:`, {
              oldPaid: item.paidAmount,
              allocated: item.allocatedAmount,
              newPaid: newPaidAmount
            });

            const { error: updateError } = await supabase
              .from('Contract')
              .update({
                'Total Paid': String(newPaidAmount)
              })
              .eq('Contract_Number', Number(item.id));
            
            if (updateError) {
              console.error(`❌ خطأ في تحديث العقد #${item.id}:`, updateError);
              errors.push(`فشل تحديث العقد #${item.id}: ${updateError.message}`);
            } else {
              console.log(`✅ تم تحديث العقد #${item.id} بنجاح`);
            }
          } else if (item.type === 'printed_invoice') {
            const newPaid = item.paidAmount + item.allocatedAmount;
            const isPaid = newPaid >= item.totalAmount;
            
            console.log(`📄 تحديث فاتورة طباعة ${item.id}:`, {
              newPaid,
              isPaid
            });

            const { error: updateError } = await supabase
              .from('printed_invoices')
              .update({
                paid_amount: newPaid,
                paid: isPaid
              })
              .eq('id', String(item.id));
            
            if (updateError) {
              console.error(`❌ خطأ في تحديث فاتورة طباعة:`, updateError);
              errors.push(`فشل تحديث الفاتورة: ${updateError.message}`);
            } else {
              console.log(`✅ تم تحديث فاتورة الطباعة بنجاح`);
            }
          } else if (item.type === 'sales_invoice') {
            const newPaid = item.paidAmount + item.allocatedAmount;
            
            console.log(`🛒 تحديث فاتورة مبيعات ${item.id}:`, { newPaid });

            const { error: updateError } = await supabase
              .from('sales_invoices')
              .update({
                paid_amount: newPaid
              })
              .eq('id', String(item.id));
            
            if (updateError) {
              console.error(`❌ خطأ في تحديث فاتورة مبيعات:`, updateError);
              errors.push(`فشل تحديث الفاتورة: ${updateError.message}`);
            } else {
              console.log(`✅ تم تحديث فاتورة المبيعات بنجاح`);
            }
          } else if (item.type === 'composite_task') {
            const newPaid = item.paidAmount + item.allocatedAmount;
            
            console.log(`🔧 تحديث مهمة مجمعة ${item.id}:`, { newPaid });

            const { error: updateError } = await supabase
              .from('composite_tasks')
              .update({
                paid_amount: newPaid
              })
              .eq('id', String(item.id));
            
            if (updateError) {
              console.error(`❌ خطأ في تحديث مهمة مجمعة:`, updateError);
              errors.push(`فشل تحديث المهمة المجمعة: ${updateError.message}`);
            } else {
              console.log(`✅ تم تحديث المهمة المجمعة بنجاح`);
            }
          }
        } catch (err) {
          console.error(`❌ خطأ غير متوقع في تحديث ${item.displayName}:`, err);
          errors.push(`خطأ غير متوقع: ${err.message}`);
        }
      }

      if (errors.length > 0) {
        toast.info(`تم توزيع الدفعة مع بعض التحذيرات:\n${errors.join('\n')}`);
      } else {
        console.log('✅ تم توزيع الدفعة بنجاح بالكامل');
        toast.success(`تم توزيع ${inputAmountNum.toFixed(2)} د.ل على ${selectedItems.length} عناصر بنجاح`);
      }
      
      // تحديث فاتورة المشتريات في حالة المقايضة
      if (activePurchaseInvoice) {
        const newUsedAsPayment = activePurchaseInvoice.used_as_payment - currentDistributionTotalForPurchase + totalAllocated;
        const { error: purchaseUpdateError } = await supabase
          .from('purchase_invoices')
          .update({
            used_as_payment: Math.max(0, newUsedAsPayment)
          })
          .eq('id', activePurchaseInvoice.id);

        if (purchaseUpdateError) {
          console.error('Error updating purchase invoice:', purchaseUpdateError);
          toast.info('تم توزيع الدفعة ولكن فشل تحديث فاتورة المشتريات');
        }
      }

      // تحديث إيجارات لوحات الأصدقاء في حالة المقايضة
      if (friendRental) {
        let remaining = totalAllocated;
        for (const gr of rentalGrouped) {
          if (remaining <= 0) break;
          const grRemaining = Math.max(0, (Number(gr.friend_rental_cost) || 0) - (Number(gr.used_as_payment) || 0));
          if (grRemaining <= 0) continue;
          const amount = Math.min(grRemaining, remaining);
          
          const { error: err } = await supabase
            .from('friend_billboard_rentals')
            .update({ used_as_payment: (Number(gr.used_as_payment) || 0) + amount })
            .eq('id', gr.id);
            
          if (err) {
            console.error('Error updating friend_billboard_rentals:', err);
            toast.info('تم توزيع الدفعة ولكن فشل تحديث إيجار اللوحة');
          }
          remaining -= amount;
        }
      }
      
      // إنشاء سلفات الموظفين أو سحب من الرصيد إذا كان الخيار مفعلاً
      if (enableEmployee) {
        const validEmployeeDistributions = employeePaymentDistributions.filter(d => d.employeeId && d.amount > 0);
        
        if (validEmployeeDistributions.length > 0) {
          for (const distribution of validEmployeeDistributions) {
            const employee = employees.find(e => e.id === distribution.employeeId);
            const balance = getEmployeeBalance(distribution.employeeId);
            
            // التحقق من نوع الدفع والرصيد
            if (distribution.paymentType === 'from_balance' && balance && balance.pendingAmount > 0) {
              // معرفة نوع الموظف
              const isOperatingExpenseEmployee = balance.teamName === 'مصروفات التشغيل' && !balance.teamId;
              
              if (isOperatingExpenseEmployee) {
                // سحب من مصروفات التشغيل - تسجيل في expenses_withdrawals
                const { error: withdrawalError } = await supabase
                  .from('expenses_withdrawals')
                  .insert({
                    amount: distribution.amount,
                    date: paymentDate,
                    type: 'individual',
                    method: paymentMethod,
                    notes: `سحب من رصيد مستحقات التشغيل - دفعة ${customerName}`,
                    receiver_name: employee?.name,
                    distributed_payment_id: distributedPaymentId
                  });
                
                if (withdrawalError) {
                  console.error('Error creating withdrawal:', withdrawalError);
                  toast.info(`فشل في تسجيل السحب لـ ${employee?.name}`);
                } else {
                  toast.success(`تم سحب ${distribution.amount.toFixed(2)} د.ل من رصيد ${employee?.name}`);
                }
              } else if (balance.teamId) {
                // سحب من مستحقات التركيب - تحديث حالة السجلات إلى "مدفوع"
                let remainingToWithdraw = distribution.amount;
                
                // جلب السجلات المعلقة للفريق
                const { data: pendingAccounts, error: fetchError } = await supabase
                  .from('installation_team_accounts')
                  .select('*')
                  .eq('team_id', balance.teamId)
                  .eq('status', 'pending')
                  .order('installation_date', { ascending: true });
                
                if (fetchError) {
                  console.error('Error fetching pending accounts:', fetchError);
                  toast.info(`فشل في سحب المستحقات لـ ${employee?.name}`);
                  continue;
                }
                
                if (pendingAccounts) {
                  for (const account of pendingAccounts) {
                    if (remainingToWithdraw <= 0) break;
                    
                    const accountAmount = Number(account.amount) || 0;
                    
                    if (accountAmount <= remainingToWithdraw) {
                      // سحب كامل المبلغ من هذا السجل
                      const { error: updateError } = await supabase
                        .from('installation_team_accounts')
                        .update({ 
                          status: 'paid',
                          notes: `${account.notes || ''}\nتم السحب بتاريخ ${paymentDate} من دفعة ${customerName}`
                        })
                        .eq('id', account.id);
                      
                      if (updateError) {
                        console.error('Error updating account:', updateError);
                      }
                      remainingToWithdraw -= accountAmount;
                    } else {
                      // سحب جزئي - نحتاج لإنشاء سجل جديد للباقي
                      // تحديث السجل الحالي ليعكس المبلغ المسحوب
                      const { error: updateError } = await supabase
                        .from('installation_team_accounts')
                        .update({ 
                          status: 'paid',
                          amount: remainingToWithdraw,
                          notes: `${account.notes || ''}\nسحب جزئي ${remainingToWithdraw} من ${accountAmount} بتاريخ ${paymentDate}`
                        })
                        .eq('id', account.id);
                      
                      // إنشاء سجل جديد للباقي
                      if (!updateError) {
                        await supabase
                          .from('installation_team_accounts')
                          .insert({
                            team_id: account.team_id,
                            task_item_id: account.task_item_id,
                            billboard_id: account.billboard_id,
                            contract_id: account.contract_id,
                            installation_date: account.installation_date,
                            amount: accountAmount - remainingToWithdraw,
                            status: 'pending',
                            notes: `متبقي من سحب جزئي`
                          });
                      }
                      remainingToWithdraw = 0;
                    }
                  }
                }
                
                toast.success(`تم سحب ${distribution.amount.toFixed(2)} د.ل من مستحقات ${employee?.name}`);
              }
            } else {
              // إنشاء سلفة جديدة
              const { error: advanceError } = await supabase
                .from('employee_advances')
                .insert({
                  employee_id: distribution.employeeId,
                  amount: distribution.amount,
                  remaining: distribution.amount,
                  reason: `سلفة من دفعة موزعة - ${customerName}`,
                  status: 'approved',
                  request_date: paymentDate,
                  distributed_payment_id: distributedPaymentId
                });

              if (advanceError) {
                console.error('Error creating employee advance:', advanceError);
                toast.info(`تم التوزيع ولكن فشل إنشاء سلفة لـ ${employee?.name}`);
              } else {
                toast.success(`تم إنشاء سلفة بقيمة ${distribution.amount.toFixed(2)} د.ل لـ ${employee?.name}`);
              }
            }
          }
        }
      }
      
      // إنشاء العهد إذا كان الخيار مفعلاً
      if (convertToCustody) {
        const validDistributions = custodyDistributions.filter(d => d.employeeId && d.amount > 0);
        
        if (validDistributions.length > 0) {
          for (const distribution of validDistributions) {
            const employee = employees.find(e => e.id === distribution.employeeId);

            // إذا كانت هناك عهدة موجودة بالفعل لنفس الدفعة ونفس الموظف: حدّثها (بدلاً من إنشاء عهدة جديدة مكررة)
            const existingForEmployee = existingCustodyAccounts.find(c => c.employee_id === distribution.employeeId);
            if (existingForEmployee) {
              const movementsCount = movementCountByCustodyId[existingForEmployee.id] || 0;
              
              // جلب البيانات الحالية للعهدة لحساب الفرق
              const { data: currentCustodyData } = await supabase
                .from('custody_accounts')
                .select('initial_amount, current_balance')
                .eq('id', existingForEmployee.id)
                .single();
              
              if (currentCustodyData) {
                const oldInitialAmount = Number(currentCustodyData.initial_amount) || 0;
                const oldCurrentBalance = Number(currentCustodyData.current_balance) || 0;
                const newAmount = Number(distribution.amount) || 0;
                
                // حساب الفرق بين المبلغ الجديد والقديم
                const amountDifference = newAmount - oldInitialAmount;
                
                // الرصيد الجديد = الرصيد الحالي + الفرق
                const newCurrentBalance = oldCurrentBalance + amountDifference;
                
                const { error: updateCustodyError } = await supabase
                  .from('custody_accounts')
                  .update({
                    initial_amount: newAmount,
                    current_balance: newCurrentBalance,
                  })
                  .eq('id', existingForEmployee.id);

                if (updateCustodyError) {
                  console.error('Error updating existing custody:', updateCustodyError);
                  toast.info(`تم التوزيع لكن فشل تحديث عهدة ${employee?.name || ''}`);
                } else if (amountDifference !== 0) {
                  console.log(`✅ تم تحديث عهدة ${employee?.name}: المبلغ الأولي من ${oldInitialAmount} إلى ${newAmount}، الرصيد الحالي من ${oldCurrentBalance} إلى ${newCurrentBalance}`);
                }
              }
              continue;
            }

            const accountNumber = generateCustodyAccountNumber();
            
            const { error: custodyError } = await supabase
              .from('custody_accounts')
              .insert({
                employee_id: distribution.employeeId,
                account_number: accountNumber,
                initial_amount: distribution.amount,
                current_balance: distribution.amount,
                status: 'active',
                source_payment_id: distributedPaymentId,
                source_type: 'distributed_payment',
                notes: `عهدة من دفعة موزعة - ${customerName} - ${employee?.name || ''}`
              });

            if (custodyError) {
              console.error('Error creating custody:', custodyError);
              toast.info(`تم التوزيع ولكن فشل إنشاء عهدة لـ ${employee?.name}`);
            }
          }
          toast.success(`تم إنشاء ${validDistributions.length} عهدة بنجاح`);
        }
      }
      
      // ✅ سداد المصروفات المختارة
      if (expensePayments.length > 0) {
        const rows = expensePayments
          .filter(p => p.amount > 0)
          .map(p => ({
            expense_id: p.expense_id,
            amount: Number(p.amount),
            paid_via: 'distributed_payment',
            payment_source: `distributed_payment:${distributedPaymentId}`,
            distributed_payment_id: distributedPaymentId,
            notes: `سداد من دفعة موزعة - ${customerName}`,
          }));
        if (rows.length > 0) {
          const { error: expErr } = await supabase.from('expense_payments').insert(rows);
          if (expErr) {
            console.error('Error inserting expense payments:', expErr);
            toast.warning('تم التوزيع لكن فشل تسجيل سداد بعض المصروفات');
          } else {
            toast.success(`تم سداد ${rows.length} مصروف`);
          }
        }
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('❌ خطأ عام في توزيع الدفعة:', error);
      toast.error(`فشل في توزيع الدفعة: ${error.message || 'خطأ غير معروف'}`);
    } finally {
      setDistributing(false);
    }
  };

  const maxStep = enableAdditionalDistributions ? 2 : 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] flex flex-col bg-card border-border/50 shadow-2xl overflow-hidden p-0">
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
            {/* Step Indicator */}
            {enableAdditionalDistributions && (
              <div className="flex items-center justify-center gap-2 py-3 border-b border-border/20 bg-muted/10 shrink-0">
                <button 
                  type="button"
                  onClick={() => step > 1 && setStep(1)} 
                  className="flex items-center gap-2 focus:outline-none hover:opacity-85 transition-opacity"
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step === 1 
                      ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' 
                      : 'bg-primary/20 text-primary'
                  }`}>
                    {step > 1 ? <CheckCircle className="h-4 w-4 text-primary" /> : '1'}
                  </div>
                  <span className={`text-xs font-bold ${step === 1 ? 'text-primary' : 'text-muted-foreground'}`}>تفاصيل وتوزيع الدفعة</span>
                </button>
                
                <div className="w-12 h-0.5 bg-muted"></div>
                
                <button 
                  type="button"
                  disabled={step < 2}
                  className="flex items-center gap-2 focus:outline-none disabled:cursor-not-allowed"
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step === 2 
                      ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' 
                      : 'bg-muted text-muted-foreground'
                  }`}>2</div>
                  <span className={`text-xs font-bold ${step === 2 ? 'text-primary' : 'text-muted-foreground'}`}>التوزيعات الإضافية (موظفين ومصروفات)</span>
                </button>
              </div>
            )}

            <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-background/50">
              {/* Step 1: Payment Details & Customer Allocation */}
              {step === 1 && (
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
                  {/* Left Side (wider): Items Tabs */}
                  <div className="flex-1 overflow-y-auto p-5 min-h-0 order-2 lg:order-1 border-r border-border/10 bg-background/30">
                    <ItemsTabsSection
                      items={items}
                      setItems={setItems}
                      onSelect={handleSelectItemById}
                      onAmountChange={handleAmountChangeById}
                      remainingToAllocate={remainingToAllocate}
                    />
                  </div>

                  {/* Right Side (narrower): Payment Inputs and Summary */}
                  <div className="lg:w-[380px] shrink-0 p-5 space-y-4 bg-card border-l border-border/50 overflow-y-auto order-1 lg:order-2 flex flex-col justify-between">
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
                            توزيع تلقائي ذكي (حسب الأقدمية)
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
              {step === 2 && (
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 overflow-y-auto p-5 gap-5 min-h-0 bg-background/20">
                  {/* 1. Employee Distributions */}
                  <div className="bg-card p-5 rounded-2xl border border-border/40 shadow-sm flex flex-col min-h-[420px] overflow-y-auto">
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
                  <div className="bg-card p-5 rounded-2xl border border-border/40 shadow-sm flex flex-col min-h-[420px] overflow-y-auto">
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
                  <div className="bg-card p-5 rounded-2xl border border-border/40 shadow-sm flex flex-col min-h-[420px] overflow-y-auto">
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
            </div>
          </>
        )}

        {/* Footer */}
        <div className="border-t border-border/50 p-4 bg-accent/5 shrink-0 flex items-center justify-between">
          <div className="flex gap-2 w-full">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(step - 1)}
                className="h-10 px-4 font-bold text-xs"
              >
                السابق
              </Button>
            )}
            
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={distributing}
              className="h-10 px-4 font-bold text-xs"
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
                className="mr-auto h-10 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs"
              >
                التالي
              </Button>
            ) : null}

            {/* Submit Button - visible in the final step (step 1 if additional distributions disabled, step 2 if enabled) */}
            {step === maxStep && (
              <Button
                type="button"
                onClick={handleDistribute}
                disabled={
                  distributing ||
                  (!hasCustomerItems && !hasExpensePayments && !hasAnyAllocation) ||
                  (hasCustomerItems && inputAmountNum > 0 && Math.abs(remainingToAllocate) > 0.01 && !saveRemainderAsCredit)
                }
                className="mr-auto h-10 px-6 font-bold text-xs bg-gradient-to-r from-primary to-primary/80 hover:from-primary hover:to-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
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
