import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { computeOverdueData } from '@/utils/overdueCalculations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { 
  AlertTriangle, AlertCircle, Clock, DollarSign, FileText, 
  TrendingDown, User, CreditCard, Receipt, Printer, 
  MessageCircle, Send, Search, SlidersHorizontal, Loader2, 
  ChevronDown, X, Phone, ArrowUpRight, Scale, Check, Copy
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SearchInputWithHistory } from '@/components/ui/SearchInputWithHistory';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SendOverdueRemindersDialog } from '@/components/billing/SendOverdueRemindersDialog';
import { OverduePaymentsPrintDialog } from '@/components/billing/OverduePaymentsPrintDialog';
import { useSendWhatsApp } from '@/hooks/useSendWhatsApp';

interface OverdueInstallment {
  contractNumber: number;
  customerName: string;
  customerId: string | null;
  installmentAmount: number;
  dueDate: string;
  description: string;
  daysOverdue: number;
  installmentId?: string;
  adType?: string;
  originalAmount?: number;
  contractPaymentApplied?: number;
  accountCreditApplied?: number;
}

interface ContractSummary {
  contractNumber: number;
  contractTotal: number;
  totalPaid: number;
  contractRemaining: number;
  installmentsRemainingSum: number;
  diff: number;
  adType?: string;
  contractDate?: string;
  endDate?: string;
}

interface CustomerOverdue {
  customerId: string | null;
  customerName: string;
  totalOverdue: number;
  overdueCount: number;
  oldestDueDate: string;
  oldestDaysOverdue: number;
  installments: OverdueInstallment[];
  unpaidInvoices: any[]; 
  contractSummaries: ContractSummary[];
}

export default function OverduePayments() {
  const navigate = useNavigate();
  const [customerOverdues, setCustomerOverdues] = useState<CustomerOverdue[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentDialog, setPaymentDialog] = useState<{
    open: boolean;
    installment: OverdueInstallment | null;
  }>({ open: false, installment: null });
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [selectedCustomerForPrint, setSelectedCustomerForPrint] = useState<CustomerOverdue | null>(null);
  const [phoneMap, setPhoneMap] = useState<Map<string, string>>(new Map());
  const [reminderDialog, setReminderDialog] = useState<{ open: boolean; customer: CustomerOverdue | null }>({ open: false, customer: null });
  const [whatsappChoiceDialog, setWhatsappChoiceDialog] = useState<{
    open: boolean;
    installment: OverdueInstallment | null;
  }>({ open: false, installment: null });
  const [copied, setCopied] = useState(false);
  const { sendMessage: sendWhatsApp } = useSendWhatsApp();

  const formatPhone = (phone: string): string => {
    // Keep only numeric digits (strips spaces, hyphens, and invisible directional isolate characters)
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('09') && cleaned.length === 10) {
      cleaned = '218' + cleaned.substring(1);
    } else if (cleaned.startsWith('9') && cleaned.length === 9) {
      cleaned = '218' + cleaned;
    }
    return cleaned;
  };

  const generateWhatsAppLink = (phone: string, message: string): string => {
    return `https://wa.me/${formatPhone(phone)}?text=${encodeURIComponent(message)}`;
  };

  // Search & Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [minDays, setMinDays] = useState<number>(0);
  const [minAmount, setMinAmount] = useState<string>('');
  const [sortBy, setSortBy] = useState<'oldest' | 'newest'>('oldest');

  const filteredOverdues = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const minAmt = parseFloat(minAmount || '0');
    const minAmtSafe = isNaN(minAmt) ? 0 : minAmt;
    const items = customerOverdues.filter(c =>
      (!term || c.customerName.toLowerCase().includes(term)) &&
      c.oldestDaysOverdue >= minDays &&
      c.totalOverdue >= minAmtSafe
    );
    return [...items].sort((a, b) => {
      if (sortBy === 'oldest') {
        return b.oldestDaysOverdue - a.oldestDaysOverdue;
      } else {
        return a.oldestDaysOverdue - b.oldestDaysOverdue;
      }
    });
  }, [customerOverdues, searchTerm, minDays, minAmount, sortBy]);

  useEffect(() => {
    loadOverduePayments();
  }, []);

  const loadOverduePayments = async () => {
    try {
      setLoading(true);

      const [contractsResult, paymentsResult] = await Promise.all([
        supabase
          .from('Contract')
          .select('Contract_Number, "Customer Name", customer_id, installments_data, Total, "Ad Type", "Contract Date", "End Date"')
          .not('installments_data', 'is', null),
        supabase
          .from('customer_payments')
          .select('contract_number, customer_id, customer_name, amount, paid_at, entry_type, sales_invoice_id, printed_invoice_id, composite_task_id')
          .in('entry_type', ['payment', 'receipt', 'account_payment']),
      ]);

      if (contractsResult.error) {
        console.error('Error loading contracts:', contractsResult.error);
        toast.error('خطأ في تحميل البيانات');
        return;
      }

      const contracts = contractsResult.data || [];
      const paymentsData = paymentsResult.data || [];

      // Split into contract-specific payments and general customer account payments
      const allPayments = paymentsData.filter((p: any) => p.contract_number !== null);
      const accountPayments = paymentsData.filter((p: any) => 
        p.contract_number === null && 
        p.sales_invoice_id === null && 
        p.printed_invoice_id === null && 
        p.composite_task_id === null
      );

      // Compute using unified utility
      const { customerOverdues: computedCustomers } = computeOverdueData(
        contracts,
        allPayments,
        accountPayments
      );

      // Now we populate contractSummaries for each customer
      const contractSummariesByCustomer = new Map<string, ContractSummary[]>();
      
      const paymentsByContract = new Map<number, number>();
      allPayments.forEach((p: any) => {
        const cNum = Number(p.contract_number);
        paymentsByContract.set(cNum, (paymentsByContract.get(cNum) || 0) + Number(p.amount));
      });

      for (const contract of contracts) {
        try {
          let installments = [] as any[];
          if (typeof contract.installments_data === 'string') {
            installments = JSON.parse(contract.installments_data);
          } else if (Array.isArray(contract.installments_data)) {
            installments = contract.installments_data as any[];
          }

          const contractNumber = Number(contract.Contract_Number);
          const totalPaid = paymentsByContract.get(contractNumber) || 0;
          const contractTotal = Number(contract['Total']) || 0;
          const contractRemaining = Math.max(0, contractTotal - totalPaid);

          const installmentsSorted = [...installments]
            .filter((i: any) => i.dueDate)
            .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

          let runningPaid = totalPaid;
          let installmentsRemainingSum = 0;
          for (const inst of installmentsSorted) {
            const due = Number(inst.amount) || 0;
            const allocated = Math.min(due, Math.max(0, runningPaid));
            runningPaid -= allocated;
            installmentsRemainingSum += Math.max(0, due - allocated);
          }

          const customerKey = contract.customer_id || `name:${contract['Customer Name']}`;
          if (contractTotal > 0 || installmentsRemainingSum > 0) {
            if (!contractSummariesByCustomer.has(customerKey)) contractSummariesByCustomer.set(customerKey, []);
            contractSummariesByCustomer.get(customerKey)!.push({
              contractNumber: contract.Contract_Number,
              contractTotal,
              totalPaid,
              contractRemaining,
              installmentsRemainingSum,
              diff: installmentsRemainingSum - contractRemaining,
              adType: (contract as any)['Ad Type'] || '',
              contractDate: (contract as any)['Contract Date'] || '',
              endDate: (contract as any)['End Date'] || '',
            });
          }
        } catch (e) {
          console.error(e);
        }
      }

      // Map computed customers and attach contractSummaries and unpaidInvoices
      const result = computedCustomers.map((c: any) => {
        const customerKeyForSummaries = c.customerId || `name:${c.customerName}`;
        return {
          ...c,
          unpaidInvoices: [],
          contractSummaries: contractSummariesByCustomer.get(customerKeyForSummaries) || []
        };
      });

      setCustomerOverdues(result);

      const customerIds = result.map(r => r.customerId).filter((x): x is string => !!x);
      const customerNames = result.filter(r => !r.customerId).map(r => r.customerName);
      const pm = new Map<string, string>();
      if (customerIds.length) {
        const { data: cs } = await supabase.from('customers').select('id, phone').in('id', customerIds);
        (cs || []).forEach((c: any) => { if (c.phone) pm.set(c.id, c.phone); });
      }
      if (customerNames.length) {
        const { data: cs } = await supabase.from('customers').select('name, phone').in('name', customerNames);
        (cs || []).forEach((c: any) => { if (c.phone) pm.set(c.name, c.phone); });
      }
      setPhoneMap(pm);
    } catch (error) {
      console.error('Error loading overdue payments:', error);
      toast.error('خطأ في تحميل الدفعات المتأخرة');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!paymentDialog.installment) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) { toast.error('الرجاء إدخال مبلغ صحيح'); return; }
    if (amount > paymentDialog.installment.installmentAmount) { toast.error('المبلغ المدخل أكبر من المبلغ المستحق'); return; }
    try {
      setProcessingPayment(true);
      const { error } = await supabase.from('customer_payments').insert({
        customer_id: paymentDialog.installment.customerId,
        customer_name: paymentDialog.installment.customerName,
        contract_number: paymentDialog.installment.contractNumber,
        amount,
        paid_at: new Date().toISOString().split('T')[0],
        method: 'نقدي',
        notes: paymentNotes || `تسديد دفعة متأخرة - ${paymentDialog.installment.description}`,
        entry_type: 'payment',
      });
      if (error) throw error;
      toast.success('تم تسجيل الدفعة بنجاح');
      setPaymentDialog({ open: false, installment: null });
      setPaymentAmount('');
      setPaymentNotes('');
      await loadOverduePayments();
    } catch (error: any) {
      console.error('Error recording payment:', error);
      toast.error(error?.message || 'حدث خطأ أثناء تسجيل الدفعة');
    } finally {
      setProcessingPayment(false);
    }
  };

  const openPaymentDialog = (installment: OverdueInstallment) => {
    setPaymentDialog({ open: true, installment });
    setPaymentAmount(installment.installmentAmount.toString());
    setPaymentNotes('');
  };

  const printOverdueNotice = async (payment: OverdueInstallment) => {
    const { generateOverdueNoticeHTML } = await import('@/lib/overdueNoticeGenerator');
    const html = await generateOverdueNoticeHTML({
      customerName: payment.customerName,
      contractNumber: payment.contractNumber,
      installmentNumber: 1,
      dueDate: payment.dueDate,
      amount: payment.installmentAmount,
      overdueDays: payment.daysOverdue,
      notes: payment.description,
    });
    const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
    showPrintPreview(html, 'إشعار تأخير', 'billing-overdue');
  };

  const getCustomerPhone = (customer: { customerId: string | null; customerName: string }) =>
    (customer.customerId && phoneMap.get(customer.customerId)) || phoneMap.get(customer.customerName) || '';

  const sendInstallmentWhatsApp = async (installment: OverdueInstallment) => {
    const phone = getCustomerPhone(installment);
    if (!phone) { toast.error('لا يوجد رقم هاتف مسجل لهذا الزبون'); return; }
    const dueDateStr = new Date(installment.dueDate).toLocaleDateString('ar-LY');
    const message = `السلام عليكم ورحمة الله وبركاته\n\nالسيد/ ${installment.customerName} المحترم،\n\nنود تذكيركم بدفعة متأخرة:\n- العقد: #${installment.contractNumber}\n- الوصف: ${installment.description}\n- تاريخ الاستحقاق: ${dueDateStr}\n- أيام التأخير: ${installment.daysOverdue} يوم\n- المبلغ المستحق: ${installment.installmentAmount.toLocaleString('en-US')} د.ل\n\nنرجو المبادرة بالسداد في أقرب وقت ممكن.\n\nمع فائق التقدير،`;
    await sendWhatsApp({ phone, message });
  };

  const handleManualWhatsApp = (installment: OverdueInstallment) => {
    const phone = getCustomerPhone(installment);
    if (!phone) { toast.error('لا يوجد رقم هاتف مسجل لهذا الزبون'); return; }
    const dueDateStr = new Date(installment.dueDate).toLocaleDateString('ar-LY');
    const message = `السلام عليكم ورحمة الله وبركاته\n\nالسيد/ ${installment.customerName} المحترم،\n\nنود تذكيركم بدفعة متأخرة:\n- العقد: #${installment.contractNumber}\n- الوصف: ${installment.description}\n- تاريخ الاستحقاق: ${dueDateStr}\n- أيام التأخير: ${installment.daysOverdue} يوم\n- المبلغ المستحق: ${installment.installmentAmount.toLocaleString('en-US')} د.ل\n\nنرجو المبادرة بالسداد في أقرب وقت ممكن.\n\nمع فائق التقدير،`;
    window.open(generateWhatsAppLink(phone, message), "_blank");
    setWhatsappChoiceDialog({ open: false, installment: null });
  };

  const handleApiWhatsApp = async (installment: OverdueInstallment) => {
    setWhatsappChoiceDialog({ open: false, installment: null });
    await sendInstallmentWhatsApp(installment);
  };

  const totalOverdue = filteredOverdues.reduce((sum, c) => sum + c.totalOverdue, 0);
  const totalInstallments = filteredOverdues.reduce((sum, c) => sum + c.overdueCount, 0);

  // Helper function to return visual urgency theme based on overdue days
  const getUrgencyTheme = (days: number) => {
    if (days >= 90) return {
      badge: 'bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400',
      border: 'border-red-500/25',
      background: 'bg-red-500/[0.02] dark:bg-red-500/[0.01]',
      text: 'text-red-600 dark:text-red-400',
      label: 'تأخير حرج (90+ يوم)'
    };
    if (days >= 30) return {
      badge: 'bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-400',
      border: 'border-orange-500/25',
      background: 'bg-orange-500/[0.02] dark:bg-orange-500/[0.01]',
      text: 'text-orange-600 dark:text-orange-400',
      label: 'تأخير متوسط (30+ يوم)'
    };
    if (days >= 7) return {
      badge: 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400',
      border: 'border-amber-500/25',
      background: 'bg-amber-500/[0.02] dark:bg-amber-500/[0.01]',
      text: 'text-amber-600 dark:text-amber-400',
      label: 'تأخير خفيف (7+ أيام)'
    };
    return {
      badge: 'bg-slate-500/10 text-slate-700 border-slate-500/20 dark:text-slate-400',
      border: 'border-slate-300 dark:border-slate-800',
      background: 'bg-card',
      text: 'text-slate-600 dark:text-slate-400',
      label: 'تأخير بسيط'
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6" dir="rtl">
      {/* Premium Executive Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-destructive/10 via-destructive/5 to-transparent border border-destructive/10 p-6 md:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-destructive/15 rounded-2xl flex items-center justify-center border border-destructive/20 shrink-0">
              <AlertCircle className="h-6 w-6 md:h-7 md:w-7 text-destructive" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">دفعات العقود المتأخرة</h1>
              <p className="text-muted-foreground text-sm mt-1 max-w-lg">
                لوحة المراقبة المالية والمتابعة المباشرة لأقساط العقود المتأخرة، وإرسال التنبيهات الموحدة.
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center">
            <SendOverdueRemindersDialog customerOverdues={customerOverdues} />
          </div>
        </div>
      </div>

      {/* Styled Filters Panel */}
      <Card className="border-muted shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="search-term" className="text-xs font-semibold">بحث بالاسم</Label>
              <div className="relative">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <SearchInputWithHistory 
                  id="search-term" 
                  historyKey="overdue_payments"
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value.slice(0, 100))} 
                  placeholder="ابحث باسم الزبون..." 
                  maxLength={100}
                  className="pr-9 h-9 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">الحد الأدنى لأيام التأخير</Label>
              <Select value={String(minDays)} onValueChange={(v) => setMinDays(parseInt(v, 10) || 0)}>
                <SelectTrigger className="w-full h-9 text-xs bg-background">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 opacity-60 text-primary" />
                    <SelectValue placeholder="كل التأخيرات" />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">كل التأخيرات</SelectItem>
                  <SelectItem value="7">7+ أيام</SelectItem>
                  <SelectItem value="30">30+ يوم</SelectItem>
                  <SelectItem value="60">60+ يوم</SelectItem>
                  <SelectItem value="90">90+ يوم</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="min-amount" className="text-xs font-semibold">الحد الأدنى للمبلغ (د.ل)</Label>
              <div className="relative">
                <DollarSign className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="min-amount" 
                  type="number" 
                  inputMode="decimal" 
                  value={minAmount} 
                  onChange={(e) => setMinAmount(e.target.value.slice(0, 12))} 
                  placeholder="مثال: 1000..." 
                  className="pr-9 h-9 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ترتيب متأخرات التأخير</Label>
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="w-full h-9 text-xs bg-background">
                  <span className="flex items-center gap-1.5">
                    <SlidersHorizontal className="h-3.5 w-3.5 opacity-60 text-primary" />
                    <SelectValue />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="oldest">التأخير الأطول أولاً (الأقدم)</SelectItem>
                  <SelectItem value="newest">التأخير الأقل أولاً (الأحدث)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1 h-9 text-xs gap-1.5" 
                onClick={() => { setSearchTerm(''); setMinDays(0); setMinAmount(''); setSortBy('oldest'); }}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
                إعادة تعيين
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Styled Performance Metrics Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card className="border-destructive/20 shadow-sm hover:shadow transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-destructive/5 rounded-full translate-x-8 -translate-y-8 transition-transform group-hover:scale-110" />
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="text-xs font-bold text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4 text-destructive" /> عدد الزبائن المتأخرين
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-destructive tracking-tight">{filteredOverdues.length}</div>
            <span className="text-[10px] text-muted-foreground mt-1 block">زبون لديه أقساط مستحقة غير مدفوعة</span>
          </CardContent>
        </Card>
        
        <Card className="border-destructive/20 shadow-sm hover:shadow transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-destructive/5 rounded-full translate-x-8 -translate-y-8 transition-transform group-hover:scale-110" />
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="text-xs font-bold text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-destructive" /> إجمالي الدفعات المتأخرة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-destructive tracking-tight">{totalInstallments}</div>
            <span className="text-[10px] text-muted-foreground mt-1 block">قسط مستحق السداد حالياً</span>
          </CardContent>
        </Card>
        
        <Card className="border-destructive/30 shadow-luxury relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-destructive/10 rounded-full translate-x-8 -translate-y-8 transition-transform group-hover:scale-110" />
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="text-xs font-bold text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-destructive animate-pulse" /> مجموع المبالغ المتأخرة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-destructive tracking-tight">
              {totalOverdue.toLocaleString('en-US')} <span className="text-base font-normal">د.ل</span>
            </div>
            <span className="text-[10px] text-muted-foreground mt-1 block">مجموع المديونية المتأخرة للأقساط</span>
          </CardContent>
        </Card>
      </div>

      {/* Overdue list */}
      {filteredOverdues.length === 0 ? (
        <Card className="border-green-500/30 bg-green-500/[0.02] py-10 text-center">
          <CardContent className="space-y-3">
            <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <Check className="h-7 w-7 text-green-600" />
            </div>
            <p className="text-lg font-bold text-green-700">لا توجد دفعات عقود متأخرة!</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">جميع أقساط العقود مسددة بالكامل أو محدثة لتاريخ اليوم.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-muted shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-destructive" />
              قائمة العملاء المتأخرين في السداد
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            <Accordion type="multiple" className="space-y-4 px-4 pb-4">
              {filteredOverdues.map((customer, index) => {
                const overdueContractNumbers = new Set(customer.installments.map(i => i.contractNumber));
                const relevantSummaries = customer.contractSummaries.filter(s => overdueContractNumbers.has(s.contractNumber));
                const urgency = getUrgencyTheme(customer.oldestDaysOverdue);

                // Compute overall payment progress percentage for active contracts
                const totalContractVal = customer.contractSummaries.reduce((sum, s) => sum + s.contractTotal, 0);
                const totalPaidVal = customer.contractSummaries.reduce((sum, s) => sum + s.totalPaid, 0);
                const paidPercentage = totalContractVal > 0 ? Math.round((totalPaidVal / totalContractVal) * 100) : 0;

                return (
                  <AccordionItem
                    key={`${customer.customerId || customer.customerName}-${index}`}
                    value={`customer-${index}`}
                    className={`border rounded-xl transition-all overflow-hidden ${urgency.border} ${urgency.background}`}
                  >
                    <div className="flex flex-col">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 border-b bg-card">
                        {/* Customer overview info */}
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <div className="w-10 h-10 shrink-0 bg-primary/10 rounded-full flex items-center justify-center font-bold text-primary text-sm shadow-sm">
                            {customer.customerName.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-extrabold text-base truncate">{customer.customerName}</span>
                              <Badge className={`text-[9px] font-bold py-0.5 border ${urgency.badge}`}>
                                {urgency.label}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground/60" /> 
                                أقدم تأخير: {customer.oldestDaysOverdue} يوم
                              </span>
                              <span className="flex items-center gap-1">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground/60" /> 
                                {customer.overdueCount} قسط متأخر
                              </span>
                              {getCustomerPhone(customer) && (
                                <span className="flex items-center gap-1 font-mono text-[11px]">
                                  <Phone className="h-3 w-3 text-muted-foreground/60" />
                                  {getCustomerPhone(customer)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Customer actions and progress bar */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                          {/* Payment progress */}
                          {totalContractVal > 0 && (
                            <div className="w-full sm:w-36 space-y-1 px-1 shrink-0">
                              <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span>المدفوع الكلي</span>
                                <span className="font-bold text-primary">{paidPercentage}%</span>
                              </div>
                              <Progress value={paidPercentage} className="h-1.5" />
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 text-xs gap-1 border-muted hover:border-primary/30"
                              onClick={(e) => { 
                                e.preventDefault(); 
                                e.stopPropagation(); 
                                setSelectedCustomerForPrint(customer); 
                                setPrintDialogOpen(true); 
                              }}
                            >
                              <Printer className="h-3.5 w-3.5 text-muted-foreground" /> 
                              كشف شامل
                            </Button>
                            
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 text-xs gap-1 border-muted hover:border-green-600 hover:text-green-600"
                              disabled={!getCustomerPhone(customer)}
                              onClick={(e) => {
                                e.preventDefault(); 
                                e.stopPropagation();
                                if (!getCustomerPhone(customer)) { toast.error('لا يوجد رقم هاتف مسجل لهذا الزبون'); return; }
                                setReminderDialog({ open: true, customer });
                              }}
                            >
                              <MessageCircle className="h-3.5 w-3.5 text-green-600" /> 
                              تنبيه واتساب
                            </Button>
                            
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 text-xs gap-1 border-muted hover:border-primary"
                              onClick={(e) => {
                                e.preventDefault(); 
                                e.stopPropagation();
                                const name = encodeURIComponent(customer.customerName || '');
                                if (customer.customerId) navigate(`/admin/customer-billing?id=${customer.customerId}&name=${name}`);
                                else navigate(`/admin/customer-billing?name=${name}`);
                              }}
                            >
                              <Receipt className="h-3.5 w-3.5 text-primary" /> 
                              الفواتير
                            </Button>

                            <Badge variant="destructive" className="text-sm font-bold px-3 py-1 bg-red-500 text-white rounded-lg shadow-sm">
                              {customer.totalOverdue.toLocaleString('en-US')} د.ل
                            </Badge>
                          </div>
                        </div>
                      </div>
                      
                      <AccordionTrigger className="px-4 py-2 hover:no-underline flex justify-center text-xs font-semibold text-muted-foreground gap-1 hover:text-foreground border-b border-dashed border-muted/40 bg-muted/10">
                        عرض التفاصيل وجدول الأقساط
                      </AccordionTrigger>
                    </div>

                    <AccordionContent className="p-4 bg-card space-y-4">
                      {/* Comparison table: Contract summary mismatch checks */}
                      {relevantSummaries.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Scale className="h-3.5 w-3.5 text-primary" />
                            مطابقة أرصدة العقود الإجمالية
                          </h4>
                          <div className="rounded-xl border overflow-x-auto bg-muted/10">
                            <table className="w-full text-right border-collapse text-xs min-w-[700px]">
                              <thead>
                                <tr className="bg-muted/40 border-b">
                                  <th className="p-2 font-bold text-muted-foreground">رقم العقد</th>
                                  <th className="p-2 font-bold text-muted-foreground">نوع الإعلان</th>
                                  <th className="p-2 font-bold text-muted-foreground">تاريخ البداية</th>
                                  <th className="p-2 font-bold text-muted-foreground">تاريخ النهاية</th>
                                  <th className="p-2 font-bold text-muted-foreground">قيمة العقد</th>
                                  <th className="p-2 font-bold text-muted-foreground">المدفوع منه</th>
                                  <th className="p-2 font-bold text-muted-foreground">المتبقي التعاقدي</th>
                                  <th className="p-2 font-bold text-muted-foreground">الأقساط المتبقية</th>
                                  <th className="p-2 font-bold text-muted-foreground">حالة التطابق</th>
                                </tr>
                              </thead>
                              <tbody>
                                {relevantSummaries.map((s) => {
                                  const mismatch = Math.abs(s.diff) > 0.5;
                                  return (
                                    <tr key={s.contractNumber} className="border-b hover:bg-muted/10">
                                      <td className="p-2 font-semibold">#{s.contractNumber}</td>
                                      <td className="p-2">{s.adType || '—'}</td>
                                      <td className="p-2 font-mono text-[10px]">{s.contractDate ? new Date(s.contractDate).toLocaleDateString('ar-LY') : '—'}</td>
                                      <td className="p-2 font-mono text-[10px]">{s.endDate ? new Date(s.endDate).toLocaleDateString('ar-LY') : '—'}</td>
                                      <td className="p-2 font-mono">{s.contractTotal.toLocaleString('en-US')} د.ل</td>
                                      <td className="p-2 text-green-600 font-mono">{s.totalPaid.toLocaleString('en-US')} د.ل</td>
                                      <td className="p-2 font-bold font-mono">{s.contractRemaining.toLocaleString('en-US')} د.ل</td>
                                      <td className="p-2 font-bold font-mono text-destructive">{s.installmentsRemainingSum.toLocaleString('en-US')} د.ل</td>
                                      <td className="p-2">
                                        {mismatch ? (
                                          <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20 text-[10px]">
                                            فرق: {s.diff > 0 ? `+${s.diff.toLocaleString('en-US')}` : s.diff.toLocaleString('en-US')} د.ل
                                          </Badge>
                                        ) : (
                                          <Badge className="bg-green-500/10 text-green-700 border-green-500/20 text-[10px]">
 مطابق
                                          </Badge>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            {relevantSummaries.some(s => Math.abs(s.diff) > 0.5) && (
                              <div className="px-3 py-2 text-[10px] text-amber-700 bg-amber-500/5 border-t border-amber-500/10 flex items-center gap-1.5">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                                تنبيه: يوجد تباين بين الرصيد المتبقي الإجمالي للعقد وجدول الأقساط. يرجى مراجعة تفاصيل العقد.
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Detailed overdue installments list */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-destructive flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          الدفعات والأقساط المستحقة المتأخرة
                        </h4>
                        
                        <div className="grid grid-cols-1 gap-3">
                          {customer.installments.map((installment, idx) => {
                            const instUrgency = getUrgencyTheme(installment.daysOverdue);
                            return (
                              <div 
                                key={idx} 
                                className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border rounded-xl bg-muted/10 hover:bg-muted/20 transition-all border-muted/50"
                              >
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline" className="text-[10px] font-bold">عقد #{installment.contractNumber}</Badge>
                                    {installment.adType && <Badge variant="secondary" className="text-[10px]">{installment.adType}</Badge>}
                                    <Badge className={`text-[10px] border font-bold ${instUrgency.badge}`}>{installment.daysOverdue} يوم تأخير</Badge>
                                  </div>
                                  
                                  <div className="text-xs text-muted-foreground space-y-1">
                                    <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                                      <span>قيمة القسط المتأخر:</span>
                                      <span className="text-destructive font-bold font-mono">{installment.installmentAmount.toLocaleString('en-US')} د.ل</span>
                                    </div>
                                    
                                    {((installment.originalAmount || 0) > 0 && installment.originalAmount !== installment.installmentAmount) && (
                                      <div className="text-[10px] bg-background/50 rounded-lg p-2 border border-muted/40 space-y-0.5 max-w-sm mt-1.5 font-mono">
                                        <div className="flex justify-between"><span>القسط الأصلي:</span><span>{(installment.originalAmount || 0).toLocaleString('en-US')} د.ل</span></div>
                                        {(installment.contractPaymentApplied || 0) > 0 && (
                                          <div className="flex justify-between text-blue-600"><span>المدفوع من العقد:</span><span>−{(installment.contractPaymentApplied || 0).toLocaleString('en-US')} د.ل</span></div>
                                        )}
                                        {(installment.accountCreditApplied || 0) > 0 && (
                                          <div className="flex justify-between text-amber-600"><span>رصيد الحساب المطبق:</span><span>−{(installment.accountCreditApplied || 0).toLocaleString('en-US')} د.ل</span></div>
                                        )}
                                        <div className="flex justify-between font-bold text-destructive border-t pt-0.5 mt-0.5"><span>المتبقي المستحق:</span><span>{installment.installmentAmount.toLocaleString('en-US')} د.ل</span></div>
                                      </div>
                                    )}
                                    
                                    <div className="flex flex-wrap gap-x-4 pt-1">
                                      <span><strong>تاريخ الاستحقاق:</strong> {new Date(installment.dueDate).toLocaleDateString('ar-LY')}</span>
                                      <span><strong>البيان:</strong> {installment.description}</span>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Installment quick actions */}
                                <div className="flex flex-wrap gap-2 shrink-0 md:self-center">
                                  <Button 
                                    size="sm" 
                                    className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-1"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); openPaymentDialog(installment); }}
                                  >
                                    <CreditCard className="h-3.5 w-3.5" />
                                    تسديد
                                  </Button>
                                  
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    className="h-8 text-xs gap-1 border-muted hover:border-destructive hover:text-destructive rounded-lg bg-card"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); printOverdueNotice(installment); }}
                                  >
                                    <Printer className="h-3.5 w-3.5" />
                                    طباعة إشعار
                                  </Button>
                                  
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    className="h-8 text-xs gap-1 border-muted hover:border-green-600 hover:text-green-600 rounded-lg bg-card"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setWhatsappChoiceDialog({ open: true, installment }); }}
                                  >
                                    <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                                    تذكير واتساب
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Settle Installment Payment Dialog */}
      <Dialog open={paymentDialog.open} onOpenChange={(open) => !processingPayment && setPaymentDialog({ open, installment: paymentDialog.installment })}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <CreditCard className="h-6 w-6 text-green-600" />
              تسديد دفعة متأخرة
            </DialogTitle>
          </DialogHeader>
          {paymentDialog.installment && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-xl border space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">رقم العقد:</span><span className="font-bold text-foreground">#{paymentDialog.installment.contractNumber}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">العميل:</span><span className="font-bold text-foreground">{paymentDialog.installment.customerName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">المبلغ المستحق:</span><span className="font-bold text-destructive font-mono">{paymentDialog.installment.installmentAmount.toLocaleString('en-US')} د.ل</span></div>
                <div className="flex justify-between items-center"><span className="text-muted-foreground">أيام التأخير:</span><Badge variant="destructive" className="h-5 text-[10px] font-bold">{paymentDialog.installment.daysOverdue} يوم</Badge></div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="payment-amount" className="text-xs font-semibold">مبلغ السداد المستلم *</Label>
                <Input 
                  id="payment-amount" 
                  type="number" 
                  step="0.01" 
                  value={paymentAmount} 
                  onChange={(e) => setPaymentAmount(e.target.value)} 
                  placeholder="أدخل المبلغ المستلم..." 
                  disabled={processingPayment} 
                  className="h-10 text-sm font-mono text-center font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-notes" className="text-xs font-semibold">ملاحظات (اختياري)</Label>
                <Input 
                  id="payment-notes" 
                  value={paymentNotes} 
                  onChange={(e) => setPaymentNotes(e.target.value)} 
                  placeholder="أدخل أي ملاحظات للتسديد..." 
                  disabled={processingPayment} 
                  className="h-10 text-xs"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setPaymentDialog({ open: false, installment: null })} disabled={processingPayment} className="rounded-lg">إلغاء</Button>
            <Button onClick={handlePayment} disabled={processingPayment} className="bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-gold">
              {processingPayment ? (
                <>
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                  جاري تسجيل الدفعة...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 ml-2" />
                  تأكيد تسجيل الدفعة
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Print & Reminders dialog integrations */}
      {selectedCustomerForPrint && (
        <OverduePaymentsPrintDialog
          open={printDialogOpen}
          onOpenChange={(open) => { setPrintDialogOpen(open); if (!open) setSelectedCustomerForPrint(null); }}
          customerOverdue={selectedCustomerForPrint}
        />
      )}

      {reminderDialog.customer && (
        <SendOverdueRemindersDialog
          customerOverdues={[reminderDialog.customer]}
          open={reminderDialog.open}
          onOpenChange={(open) => setReminderDialog({ open, customer: open ? reminderDialog.customer : null })}
        />
      )}

      {/* WhatsApp Choice Dialog */}
      <Dialog open={whatsappChoiceDialog.open} onOpenChange={(open) => {
        setWhatsappChoiceDialog({ open, installment: open ? whatsappChoiceDialog.installment : null });
        setCopied(false);
      }}>
        <DialogContent className="sm:max-w-md border-0 shadow-2xl rounded-2xl overflow-hidden p-0 bg-background" dir="rtl">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-500 p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform translate-x-8 -translate-y-8" />
            <DialogHeader className="space-y-1 relative z-10">
              <DialogTitle className="text-2xl font-bold flex items-center gap-3 text-white">
                <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                  <MessageCircle className="h-6 w-6 text-white animate-pulse" />
                </div>
                تنبيه الدفعة المتأخرة
              </DialogTitle>
              <p className="text-white/80 text-xs font-medium">إرسال إشعار تذكيري للزبون بمتأخرات عقد إيجار لوحات</p>
            </DialogHeader>
          </div>
          
          <div className="p-6 space-y-5">
            {whatsappChoiceDialog.installment && (() => {
              const installment = whatsappChoiceDialog.installment;
              const phone = getCustomerPhone(installment);
              const dueDateStr = new Date(installment.dueDate).toLocaleDateString('ar-LY');
              const messageText = `السلام عليكم ورحمة الله وبركاته\n\nالسيد/ ${installment.customerName} المحترم،\n\nنود تذكيركم بدفعة متأخرة:\n- العقد: #${installment.contractNumber}\n- الوصف: ${installment.description}\n- تاريخ الاستحقاق: ${dueDateStr}\n- أيام التأخير: ${installment.daysOverdue} يوم\n- المبلغ المستحق: ${installment.installmentAmount.toLocaleString('en-US')} د.ل\n\nنرجو المبادرة بالسداد في أقرب وقت ممكن.\n\nمع فائق التقدير،`;
              const waLink = phone ? generateWhatsAppLink(phone, messageText) : '#';

              const handleManualClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
                if (!phone) {
                  e.preventDefault();
                  toast.error('لا يوجد رقم هاتف مسجل لهذا الزبون');
                  return;
                }
                setWhatsappChoiceDialog({ open: false, installment: null });
              };

              const handleApiWhatsApp = async () => {
                setWhatsappChoiceDialog({ open: false, installment: null });
                await sendInstallmentWhatsApp(installment);
              };

              const handleCopyText = () => {
                navigator.clipboard.writeText(messageText);
                setCopied(true);
                toast.success('تم نسخ نص الرسالة بنجاح');
                setTimeout(() => setCopied(false), 2000);
              };

              return (
                <>
                  <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-muted/40 border border-border/50 text-xs">
                    <div>
                      <span className="text-muted-foreground block mb-0.5">الزبون المستهدف</span>
                      <strong className="text-foreground text-sm block">{installment.customerName}</strong>
                    </div>
                    <div className="text-left">
                      <span className="text-muted-foreground block mb-0.5">رقم الهاتف</span>
                      <strong className="text-foreground text-sm block">{phone || '—'}</strong>
                    </div>
                  </div>

                  <div className="space-y-2 relative">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-muted-foreground">معاينة نص الرسالة التذكيرية:</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs gap-1.5 px-2 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer rounded-lg border border-border/50"
                        onClick={handleCopyText}
                      >
                        {copied ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-emerald-600 font-semibold">تم النسخ</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>نسخ النص</span>
                          </>
                        )}
                      </Button>
                    </div>
                    <textarea
                      readOnly
                      value={messageText}
                      className="w-full min-h-[160px] text-xs p-4 rounded-xl border bg-muted/20 resize-none leading-relaxed focus-visible:outline-none focus:border-emerald-500 focus:bg-background transition-all duration-200 font-sans shadow-inner"
                      dir="rtl"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 pt-2">
                    <Button
                      asChild
                      variant="outline"
                      className="h-16 flex items-center justify-start gap-4 border border-emerald-500/20 hover:border-emerald-500 bg-emerald-500/[0.01] hover:bg-emerald-500/[0.04] text-right px-4 cursor-pointer rounded-xl transition-all duration-200 shadow-sm"
                    >
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={handleManualClick}
                      >
                        <div className="p-2 bg-emerald-500/10 rounded-lg shrink-0">
                          <MessageCircle className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-foreground">إرسال يدوي (واتساب ويب / تطبيق)</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 font-sans">فتح محادثة مباشرة وتجهيز نص الرسالة للنسخ والتعديل قبل الإرسال</div>
                        </div>
                      </a>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-16 flex items-center justify-start gap-4 border border-blue-500/20 hover:border-blue-500 bg-blue-500/[0.01] hover:bg-blue-500/[0.04] text-right px-4 rounded-xl cursor-pointer transition-all duration-200 shadow-sm"
                      onClick={handleApiWhatsApp}
                    >
                      <div className="p-2 bg-blue-500/10 rounded-lg shrink-0">
                        <Send className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-foreground">إرسال تلقائي (عبر منصة الربط API)</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 font-sans">إرسال الرسالة تلقائياً في الخلفية باستخدام منصة الربط المدمجة</div>
                      </div>
                    </Button>
                  </div>
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
