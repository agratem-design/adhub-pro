import { OverdueWorkspace } from '@/components/billing/OverdueWorkspace';
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
  ChevronDown, X, Phone, ArrowUpRight, Scale, Check, Copy,
  Calendar
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
import { getCalendarConfig, generateGoogleCalendarWebUrl } from '@/services/googleCalendarService';

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
    <div dir="rtl">
      <OverdueWorkspace title="دفعات العقود المتأخرة" description="اختر الزبون لمراجعة الأقساط المستحقة، والتسديد أو فتح كشف الحساب." itemLabel="أقساط متأخرة" totalAmount={totalOverdue} totalItems={totalInstallments}
        search={searchTerm} onSearch={setSearchTerm} minDays={minDays} onMinDays={setMinDays} minAmount={minAmount} onMinAmount={setMinAmount} sort={sortBy} onSort={setSortBy} onRefresh={loadOverduePayments}
        headerAction={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin/google-calendar')}
              className="cursor-pointer gap-1.5 border-primary/40 text-primary hover:bg-primary/10 rounded-lg h-9"
            >
              <Calendar className="h-4 w-4" />
              تقويم جوجل والتنبيهات
            </Button>
            <SendOverdueRemindersDialog customerOverdues={customerOverdues}/>
          </div>
        }
        customers={filteredOverdues.map(customer=>({key:customer.customerId || customer.customerName,name:customer.customerName,amount:customer.totalOverdue,count:customer.overdueCount,days:customer.oldestDaysOverdue,phone:getCustomerPhone(customer),
          onAccount:()=>navigate(`/admin/customer-billing?${customer.customerId?`id=${customer.customerId}&`:''}name=${encodeURIComponent(customer.customerName)}`),
          onPrint:()=>{setSelectedCustomerForPrint(customer);setPrintDialogOpen(true);},
          onReminder:()=>setReminderDialog({open:true,customer}),reminderDisabled:!getCustomerPhone(customer),
          extra:customer.contractSummaries.length>0?<details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-xs font-semibold">أرصدة عقود الزبون</summary><div className="mt-3 grid gap-2 sm:grid-cols-2">{customer.contractSummaries.filter(summary=>customer.installments.some(i=>i.contractNumber===summary.contractNumber)).map(summary=><div key={summary.contractNumber} className="rounded-lg bg-muted/30 p-3 text-xs"><h4 className="mb-2 font-bold">عقد #{summary.contractNumber}</h4><dl className="space-y-1"><div className="flex justify-between gap-2"><dt>قيمة العقد</dt><dd>{summary.contractTotal.toLocaleString('ar-LY')} د.ل</dd></div><div className="flex justify-between gap-2"><dt>المدفوع</dt><dd>{summary.totalPaid.toLocaleString('ar-LY')} د.ل</dd></div><div className="flex justify-between gap-2"><dt>المتبقي في العقد</dt><dd>{summary.contractRemaining.toLocaleString('ar-LY')} د.ل</dd></div><div className="flex justify-between gap-2"><dt>متبقي جدول الأقساط</dt><dd>{summary.installmentsRemainingSum.toLocaleString('ar-LY')} د.ل</dd></div></dl>{Math.abs(summary.diff)>1&&<p className="mt-2 text-warning">يوجد فرق بين رصيد العقد وجدول الأقساط؛ راجع العقد.</p>}</div>)}</div></details>:undefined,
          items:customer.installments.map((installment,index)=>({key:installment.installmentId || `${installment.contractNumber}-${index}`,title:installment.description || 'قسط مستحق',subtitle:installment.adType,contract:`عقد #${installment.contractNumber}`,amount:installment.installmentAmount,date:installment.dueDate,dateLabel:'تاريخ الاستحقاق',days:installment.daysOverdue,
            onSettle:()=>openPaymentDialog(installment),onPrint:()=>printOverdueNotice(installment),onReminder:()=>setWhatsappChoiceDialog({open:true,installment}),reminderDisabled:!getCustomerPhone(installment),
            breakdown:installment.originalAmount&&installment.originalAmount!==installment.installmentAmount?<details className="mt-3 rounded-lg bg-muted/30 p-2 text-[11px]"><summary className="cursor-pointer text-muted-foreground">كيف حُسب المتبقي؟</summary><dl className="mt-2 space-y-1"><div className="flex justify-between gap-2"><dt>القسط الأصلي</dt><dd>{installment.originalAmount.toLocaleString('ar-LY')} د.ل</dd></div><div className="flex justify-between gap-2"><dt>المدفوع من العقد</dt><dd>{(installment.contractPaymentApplied||0).toLocaleString('ar-LY')} د.ل</dd></div><div className="flex justify-between gap-2"><dt>رصيد الحساب المطبق</dt><dd>{(installment.accountCreditApplied||0).toLocaleString('ar-LY')} د.ل</dd></div></dl></details>:undefined,
          })),
        }))}/>

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
                    <Button
                      type="button"
                      variant="outline"
                      className="h-16 flex items-center justify-start gap-4 border border-amber-500/30 hover:border-amber-500 bg-amber-500/[0.02] hover:bg-amber-500/[0.05] text-right px-4 rounded-xl cursor-pointer transition-all duration-200 shadow-sm"
                      onClick={async () => {
                        const cfg = await getCalendarConfig();
                        const gUrl = generateGoogleCalendarWebUrl(
                          {
                            title: `استحقاق دفعة: ${installment.customerName} (عقد #${installment.contractNumber})`,
                            description: messageText,
                            startDate: installment.dueDate,
                          },
                          cfg.emails
                        );
                        window.open(gUrl, '_blank');
                        setWhatsappChoiceDialog({ open: false, installment: null });
                      }}
                    >
                      <div className="p-2 bg-amber-500/15 rounded-lg shrink-0">
                        <Calendar className="h-6 w-6 text-amber-600" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-foreground">إضافة تذكير في تقويم Google</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 font-sans">فتح Google Calendar وإدراج القسط مع تنبيه الإيميلات المربوطة</div>
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
