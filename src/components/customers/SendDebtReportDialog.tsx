// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, DollarSign, MessageCircle, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSendTextly } from '@/hooks/useSendTextly';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ManagementPhoneManager, fetchManagementPhones } from '@/components/shared/ManagementPhoneManager';
import type { ManagementPhone } from '@/components/shared/ManagementPhoneManager';
import { calculateTotalRemainingDebt, calculateDebtBreakdown } from '@/components/billing/BillingUtils';
import type { DebtSourceBreakdown } from '@/utils/messageTemplates';

interface SendDebtReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const openWhatsApp = (phone: string, message: string) => {
  const cleanPhone = phone.replace(/[^0-9+]/g, '').replace(/^\+/, '');
  window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
};

export function SendDebtReportDialog({ open, onOpenChange }: SendDebtReportDialogProps) {
  const { toast } = useToast();
  const textly = useSendTextly();

  const [phones, setPhones] = useState<ManagementPhone[]>([]);
  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
  const [sendMethod, setSendMethod] = useState<'textly' | 'whatsapp'>('whatsapp');
  const [reportType, setReportType] = useState<'debts' | 'overdue'>('debts');
  const [detailMode, setDetailMode] = useState<'summary' | 'detailed'>('summary');
  const [sending, setSending] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Debt data
  const [debtData, setDebtData] = useState<{ customerName: string; totalDebt: number; overdueCount: number; oldestDays: number; sourceBreakdown?: DebtSourceBreakdown }[]>([]);
  const [totalDebt, setTotalDebt] = useState(0);
  const [totalOverdueAmount, setTotalOverdueAmount] = useState(0);

  useEffect(() => {
    if (!open) return;
    fetchPhones();
    fetchDebtData();
  }, [open]);

  const fetchPhones = async () => {
    const data = await fetchManagementPhones();
    setPhones(data);
    setSelectedPhones(data.map(p => p.id));
  };

  const fetchDebtData = async () => {
    setLoading(true);
    try {
      const [
        cusRes, conRes, payRes,
        salesInvoicesRes, printedInvoicesRes, purchaseInvoicesRes,
        discountsRes, compositeTasksRes,
      ] = await Promise.all([
        supabase.from('customers').select('id, name, phone').limit(10000),
        supabase.from('Contract').select('customer_id, "Customer Name", Total, Contract_Number, friend_rental_data, installments_data').limit(10000),
        supabase.from('customer_payments').select('customer_id, customer_name, amount, contract_number, paid_at, entry_type, sales_invoice_id, printed_invoice_id, purchase_invoice_id').limit(10000),
        supabase.from('sales_invoices').select('customer_id, total_amount').limit(10000),
        supabase.from('printed_invoices').select('id, customer_id, total_amount, included_in_contract').limit(10000),
        supabase.from('purchase_invoices').select('customer_id, total_amount, used_as_payment').limit(10000),
        supabase.from('customer_general_discounts').select('customer_id, discount_value').eq('status', 'active').limit(10000),
        supabase.from('composite_tasks').select('customer_id, customer_total, combined_invoice_id').limit(10000),
      ]);

      const customers = cusRes.data || [];
      const contracts = conRes.data || [];
      const payments = payRes.data || [];
      const salesInvoices = salesInvoicesRes.data || [];
      const printedInvoices = printedInvoicesRes.data || [];
      const purchaseInvoices = purchaseInvoicesRes.data || [];
      const discounts = discountsRes.data || [];
      const compositeTasks = compositeTasksRes.data || [];

      const today = new Date();
      const customerDebts: { customerName: string; totalDebt: number; overdueCount: number; oldestDays: number; sourceBreakdown?: DebtSourceBreakdown }[] = [];
      let grandTotalDebt = 0;
      let grandTotalOverdue = 0;

      // تجميع IDs العملاء من كل المصادر
      const customerIds = new Set<string>();
      contracts.forEach(c => c.customer_id && customerIds.add(c.customer_id));
      payments.forEach(p => p.customer_id && customerIds.add(p.customer_id));
      salesInvoices.forEach(i => i.customer_id && customerIds.add(i.customer_id));

      const customerNameMap = new Map(customers.map(c => [c.id, c.name]));

      for (const custId of customerIds) {
        const custContracts = contracts.filter(c => c.customer_id === custId);
        const custPayments = payments.filter(p => p.customer_id === custId);
        const custSalesInvoices = salesInvoices.filter(i => i.customer_id === custId);
        const custPrintedInvoices = printedInvoices.filter(i => i.customer_id === custId);
        const custPurchaseInvoices = purchaseInvoices.filter(i => i.customer_id === custId);
        const custDiscounts = discounts.filter(d => d.customer_id === custId);
        const custCompositeTasks = compositeTasks.filter(t => t.customer_id === custId);

        const totalDiscounts = custDiscounts.reduce((s, d) => s + (Number(d.discount_value) || 0), 0);

        // ✅ حساب المتبقي الفعلي باستخدام الدالة الموحدة
        const remaining = calculateTotalRemainingDebt(
          custContracts as any[],
          custPayments as any[],
          custSalesInvoices,
          custPrintedInvoices,
          custPurchaseInvoices,
          totalDiscounts,
          custCompositeTasks,
          0
        );

        if (remaining <= 0) continue;

        // ✅ حساب تفصيل المصادر
        const sourceBreakdown = calculateDebtBreakdown(
          custContracts as any[],
          custPayments as any[],
          custSalesInvoices,
          custPrintedInvoices,
          custPurchaseInvoices,
          custCompositeTasks,
          0
        );

        // حساب الأقساط المتأخرة
        let overdueCount = 0;
        let oldestDays = 0;

        for (const contract of custContracts) {
          try {
            let installments: any[] = [];
            if (typeof contract.installments_data === 'string') {
              installments = JSON.parse(contract.installments_data);
            } else if (Array.isArray(contract.installments_data)) {
              installments = contract.installments_data;
            }

            const contractPayments = custPayments.filter(p => p.contract_number === contract.Contract_Number);
            const totalContractPaid = contractPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            let paymentsRemaining = totalContractPaid;

            const sorted = installments
              .filter((i: any) => i.dueDate)
              .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

            for (const inst of sorted) {
              const dueDate = new Date(inst.dueDate);
              const diffDays = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

              if (diffDays > 0) {
                const currentDue = Number(inst.amount) || 0;
                const allocated = Math.min(currentDue, Math.max(0, paymentsRemaining));
                const overdueAmount = Math.max(0, currentDue - allocated);
                paymentsRemaining = Math.max(0, paymentsRemaining - allocated);

                if (overdueAmount > 0) {
                  overdueCount++;
                  if (diffDays > oldestDays) oldestDays = diffDays;
                  grandTotalOverdue += overdueAmount;
                }
              }
            }
          } catch (e) {
            // skip
          }
        }

        customerDebts.push({
          customerName: customerNameMap.get(custId) || custContracts[0]?.["Customer Name"] || 'غير معروف',
          totalDebt: remaining,
          overdueCount,
          oldestDays,
          sourceBreakdown,
        });
        grandTotalDebt += remaining;
      }

      customerDebts.sort((a, b) => b.totalDebt - a.totalDebt);
      setDebtData(customerDebts);
      setTotalDebt(grandTotalDebt);
      setTotalOverdueAmount(grandTotalOverdue);
    } catch (error) {
      console.error('Error fetching debt data:', error);
    } finally {
      setLoading(false);
    }
  };

  const reportMessage = useMemo(() => {
    const today = format(new Date(), 'yyyy/MM/dd');
    const sep = '---------------';

    if (reportType === 'debts') {
      let msg = `*تقرير الديون المستحقة*\n`;
      msg += `تاريخ التقرير: ${today}\n`;
      msg += `${sep}\n\n`;
      msg += `*ملخص:*\n`;
      msg += `   - عدد العملاء المدينين: ${debtData.length}\n`;
      msg += `   - إجمالي الديون المستحقة: ${totalDebt.toLocaleString()} د.ل\n`;
      msg += `${sep}\n\n`;
      if (debtData.length > 0) {
        msg += `*جميع العملاء المدينين:*\n`;
        debtData.forEach((d, i) => {
          msg += `${i + 1}. ${d.customerName}: ${d.totalDebt.toLocaleString()} د.ل\n`;
          if (detailMode === 'detailed' && d.sourceBreakdown) {
            const s = d.sourceBreakdown;
            if (s.contractsDebt > 0) msg += `   - العقود: ${s.contractsDebt.toLocaleString()} د.ل\n`;
            if (s.salesInvoicesDebt > 0) msg += `   - مبيعات: ${s.salesInvoicesDebt.toLocaleString()} د.ل\n`;
            if (s.printedInvoicesDebt > 0) msg += `   - طباعة: ${s.printedInvoicesDebt.toLocaleString()} د.ل\n`;
            if (s.compositeTasksDebt > 0) msg += `   - مجمعة: ${s.compositeTasksDebt.toLocaleString()} د.ل\n`;
            if (s.purchaseInvoicesCredit > 0) msg += `   - خصم مشتريات: -${s.purchaseInvoicesCredit.toLocaleString()} د.ل\n`;
            if (s.otherDebts > 0) msg += `   - أخرى: ${s.otherDebts.toLocaleString()} د.ل\n`;
          }
        });
      }
      return msg;
    } else {
      const overdueCustomers = debtData.filter(d => d.overdueCount > 0).sort((a, b) => b.oldestDays - a.oldestDays);
      let msg = `*تقرير الدفعات المتأخرة*\n`;
      msg += `تاريخ التقرير: ${today}\n`;
      msg += `${sep}\n\n`;
      msg += `*ملخص:*\n`;
      msg += `   - عدد العملاء المتأخرين: ${overdueCustomers.length}\n`;
      msg += `   - إجمالي المبالغ المتأخرة: ${totalOverdueAmount.toLocaleString()} د.ل\n`;
      msg += `${sep}\n\n`;
      if (overdueCustomers.length > 0) {
        msg += `*الدفعات المتأخرة (أقدم أولاً):*\n`;
        overdueCustomers.forEach((d, i) => {
          msg += `${i + 1}. ${d.customerName}: متأخر ${d.oldestDays} يوم (${d.overdueCount} دفعة)\n`;
        });
      }
      return msg;
    }
  }, [debtData, totalDebt, totalOverdueAmount, reportType, detailMode]);

  const handleSend = async () => {
    const message = customMessage.trim() || reportMessage;

    if (selectedPhones.length === 0) {
      toast({ title: 'خطأ', description: 'اختر رقم واحد على الأقل', variant: 'destructive' });
      return;
    }

    if (sendMethod === 'whatsapp') {
      for (const phoneId of selectedPhones) {
        const phone = phones.find(p => p.id === phoneId);
        if (phone) openWhatsApp(phone.phone_number, message);
      }
      toast({ title: 'تم', description: 'تم فتح واتساب للأرقام المحددة' });
      onOpenChange(false);
      return;
    }

    setSending(true);
    let successCount = 0;
    for (const phoneId of selectedPhones) {
      const phone = phones.find(p => p.id === phoneId);
      if (!phone) continue;
      if (await textly.sendMessage({ phone: phone.phone_number, message })) successCount++;
    }
    setSending(false);

    if (successCount > 0) {
      toast({ title: 'تم الإرسال', description: `تم إرسال التقرير إلى ${successCount} رقم بنجاح` });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-primary" />
            إرسال تقرير الديون المستحقة للإدارة
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Report Type Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">نوع التقرير</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setReportType('debts'); setCustomMessage(''); }}
                className={`flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                  reportType === 'debts'
                    ? 'border-destructive bg-destructive/10 text-destructive shadow-sm'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <DollarSign className="h-4 w-4" />
 الديون المستحقة
              </button>
              <button
                onClick={() => { setReportType('overdue'); setCustomMessage(''); }}
                className={`flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                  reportType === 'overdue'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-sm'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                }`}
              >
 ️ الدفعات المتأخرة
              </button>
            </div>
          </div>

          {/* Detail Mode Toggle - only for debts */}
          {reportType === 'debts' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">مستوى التفصيل</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { setDetailMode('summary'); setCustomMessage(''); }}
                  className={`flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all ${
                    detailMode === 'summary'
                      ? 'border-primary bg-primary/10 text-primary shadow-sm'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                  }`}
                >
 إجمالي فقط
                </button>
                <button
                  onClick={() => { setDetailMode('detailed'); setCustomMessage(''); }}
                  className={`flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all ${
                    detailMode === 'detailed'
                      ? 'border-primary bg-primary/10 text-primary shadow-sm'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                  }`}
                >
 مفصل حسب المصدر
                </button>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : reportType === 'debts' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 text-center">
                <div className="text-2xl font-bold text-primary">{debtData.length}</div>
                <div className="text-xs text-muted-foreground mt-1">عملاء مدينين</div>
              </div>
              <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 p-4 text-center">
                <div className="text-2xl font-bold text-destructive">{totalDebt.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">إجمالي الديون (د.ل)</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-4 text-center">
                <div className="text-2xl font-bold text-amber-600">{debtData.filter(d => d.overdueCount > 0).length}</div>
                <div className="text-xs text-muted-foreground mt-1">عملاء متأخرين</div>
              </div>
              <div className="rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-4 text-center">
                <div className="text-2xl font-bold text-amber-600">{totalOverdueAmount.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">مبالغ متأخرة (د.ل)</div>
              </div>
            </div>
          )}

          {/* Outstanding Debts Section */}
          {reportType === 'debts' && debtData.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-destructive" />
 الديون المستحقة
                </span>
                <Badge variant="destructive">{debtData.length} عميل</Badge>
              </div>
              <ScrollArea className="max-h-36">
                <div className="space-y-1 text-xs">
                  {debtData.map((d, i) => (
                    <div key={i} className="flex justify-between items-center py-1.5 border-b border-border/30 last:border-0">
                      <span className="font-medium">{i + 1}. {d.customerName}</span>
                      <span className="font-bold text-destructive">{d.totalDebt.toLocaleString()} د.ل</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Overdue Payments Section */}
          {reportType === 'overdue' && debtData.filter(d => d.overdueCount > 0).length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-1.5">
 ️ الدفعات المتأخرة
                </span>
                <Badge className="bg-amber-500 text-white hover:bg-amber-600">
                  {debtData.filter(d => d.overdueCount > 0).length} عميل
                </Badge>
              </div>
              <ScrollArea className="max-h-36">
                <div className="space-y-1 text-xs">
                  {debtData
                    .filter(d => d.overdueCount > 0)
                    .sort((a, b) => b.oldestDays - a.oldestDays)
                    .map((d, i) => (
                      <div key={i} className="flex justify-between items-center py-1.5 border-b border-border/30 last:border-0">
                        <span className="font-medium">{i + 1}. {d.customerName}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600">{d.overdueCount} دفعة</Badge>
                          <span className="font-bold text-amber-600">متأخر {d.oldestDays} يوم</span>
                        </div>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Send Method */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">طريقة الإرسال</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSendMethod('whatsapp')}
                className={`flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                  sendMethod === 'whatsapp'
                    ? 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-400 shadow-sm'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </button>
              <button
                onClick={() => setSendMethod('textly')}
                className={`flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                  sendMethod === 'textly'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-400 shadow-sm'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <Send className="h-4 w-4" />
                Textly
              </button>
            </div>
          </div>

          {/* Phone Selection */}
          <ManagementPhoneManager
            phones={phones}
            onPhonesChange={(newPhones) => {
              setPhones(newPhones);
              setSelectedPhones(newPhones.map(p => p.id));
            }}
            selectedPhones={selectedPhones}
            onSelectedPhonesChange={setSelectedPhones}
            onWhatsAppClick={(p) => openWhatsApp(p.phone_number, customMessage.trim() || reportMessage)}
          />

          {/* Message Preview */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">نص التقرير (يمكنك التعديل)</Label>
            <Textarea
              value={customMessage || reportMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={7}
              className="text-xs font-mono"
              dir="rtl"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button
            onClick={handleSend}
            disabled={sending || loading || selectedPhones.length === 0}
            className={`gap-2 ${sendMethod === 'whatsapp' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : sendMethod === 'whatsapp' ? <MessageCircle className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            {sendMethod === 'whatsapp' ? 'فتح واتساب' : 'إرسال التقرير'}
            {sendMethod === 'whatsapp' && <ExternalLink className="h-3 w-3" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
