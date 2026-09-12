import { compositeTaskLabel, compositeTaskGroupKey } from '@/lib/compositeTaskLabel';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Printer, FileText, Trash2, Edit, UserCheck, Wallet, AlertCircle, Wrench, Receipt, DollarSign } from "lucide-react";
import { showPrintPreview } from '@/components/print/PrintPreviewDialog';
import { PaymentRow } from "./BillingTypes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import IntermediaryReceiptPrintDialog from "./IntermediaryReceiptPrintDialog";
import { ConvertToCustodyDialog } from "./ConvertToCustodyDialog";
import { numberToArabicWords } from '@/lib/printUtils';
import { filterCompositeRelatedPrintedInvoices } from './BillingUtils';
import { useUnifiedReceiptPrint } from "./UnifiedReceiptPrint";

interface CustodyInfo {
  id: string;
  employee_name: string;
  account_number: string;
  initial_amount: number;
  current_balance: number;
  status: string;
}

interface EmployeeAdvanceInfo {
  id: string;
  employee_name: string;
  amount: number;
  reason: string;
  status: string;
  request_date: string;
}

interface WithdrawalInfo {
  id: number;
  receiver_name: string;
  amount: number;
  date: string;
  notes: string;
  method: string;
}

interface DistributedPaymentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupedPayments: PaymentRow[];
  totalAmount: number;
  onPrintCombined: () => void;
  onPrintIndividual: (payment: PaymentRow) => void;
  onDelete: () => void;
  onEdit?: () => void;
  customerName: string;
}

export function DistributedPaymentDetailsDialog({
  open,
  onOpenChange,
  groupedPayments,
  totalAmount,
  onPrintCombined,
  onPrintIndividual,
  onDelete,
  onEdit,
  customerName,
}: DistributedPaymentDetailsDialogProps) {
  const [viaIntermediary, setViaIntermediary] = useState(false);
  const [collectorName, setCollectorName] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('نقدي');
  const [notes, setNotes] = useState('');
  const [collectionDate, setCollectionDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [intermediaryPrintOpen, setIntermediaryPrintOpen] = useState(false);
  const [custodyDialogOpen, setCustodyDialogOpen] = useState(false);
  const [custodyInfo, setCustodyInfo] = useState<CustodyInfo[]>([]);

  const remainderPayment = groupedPayments.find(
    p => p.entry_type === 'payment' && !p.contract_number && !p.sales_invoice_id && !p.printed_invoice_id && !p.composite_task_id
  );
  const surplusAmount = remainderPayment ? Number(remainderPayment.amount) || 0 : 0;
  const [employeeAdvances, setEmployeeAdvances] = useState<EmployeeAdvanceInfo[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalInfo[]>([]);
  const [loadingCustody, setLoadingCustody] = useState(false);
  const [showIntermediaryInReceipt, setShowIntermediaryInReceipt] = useState(true);
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentsMeta, setPaymentsMeta] = useState<{
    compositeTasks: Record<string, any>;
    salesInvoices: Record<string, any>;
    printedInvoices: Record<string, any>;
    contracts: Record<number, any>;
  }>({
    compositeTasks: {},
    salesInvoices: {},
    printedInvoices: {},
    contracts: {},
  });

  const loadPaymentEntitiesMeta = async () => {
    if (!groupedPayments?.length) return;
    try {
      const compositeTaskIds = groupedPayments
        .filter(p => p.composite_task_id)
        .map(p => p.composite_task_id as string);

      const salesInvoiceIds = groupedPayments
        .filter(p => p.sales_invoice_id)
        .map(p => p.sales_invoice_id as string);

      const printedInvoiceIds = groupedPayments
        .filter(p => p.printed_invoice_id)
        .map(p => p.printed_invoice_id as string);

      let tasksData: any[] = [];
      const compositeTaskMap: Record<string, any> = {};
      if (compositeTaskIds.length > 0) {
        const { data } = await supabase
          .from('composite_tasks')
          .select('id, task_number, contract_id, task_type, customer_total, paid_amount, installation_task_id, print_task_id, cutout_task_id')
          .in('id', compositeTaskIds);
        tasksData = data || [];
      }

      const installTaskIds = tasksData
        .map((t: any) => t.installation_task_id)
        .filter(Boolean);

      const installTaskMap: Record<string, any> = {};
      if (installTaskIds.length > 0) {
        const { data: itData, error: itErr } = await supabase
          .from('installation_tasks')
          .select('id, contract_id, task_type, reinstallation_number, team_id, installation_teams(team_name)')
          .in('id', installTaskIds);
        if (itErr) {
          console.warn('Fallback loading installation_tasks without join:', itErr);
          const { data: fallbackData } = await supabase
            .from('installation_tasks')
            .select('id, contract_id, task_type, reinstallation_number, team_id')
            .in('id', installTaskIds);
          const teamIds = (fallbackData || []).map((it: any) => it.team_id).filter(Boolean);
          const teamsMap: Record<string, string> = {};
          if (teamIds.length > 0) {
            const { data: tData } = await supabase.from('installation_teams').select('id, team_name').in('id', teamIds);
            (tData || []).forEach((t: any) => { teamsMap[t.id] = t.team_name; });
          }
          (fallbackData || []).forEach((it: any) => {
            installTaskMap[it.id] = {
              ...it,
              installation_teams: it.team_id && teamsMap[it.team_id] ? { team_name: teamsMap[it.team_id] } : null,
            };
          });
        } else {
          (itData || []).forEach((it: any) => {
            installTaskMap[it.id] = it;
          });
        }
      }

      tasksData.forEach((t: any) => {
        const it = t.installation_task_id ? installTaskMap[t.installation_task_id] : null;
        const contractId = t.contract_id || it?.contract_id || null;
        const taskType = it?.task_type || t.task_type;
        const reinstallationNumber = it?.reinstallation_number ?? (taskType === 'reinstallation' ? 1 : null);
        const remaining = (Number(t.customer_total) || 0) - (Number(t.paid_amount) || 0);

        compositeTaskMap[t.id] = {
          ...t,
          contract_id: contractId,
          task_type: taskType,
          reinstallation_number: reinstallationNumber,
          team_name: it?.installation_teams?.team_name || null,
          calculatedRemaining: Math.max(0, remaining),
        };
      });

      const salesInvoiceMap: Record<string, any> = {};
      if (salesInvoiceIds.length > 0) {
        const { data: invoicesData } = await supabase
          .from('sales_invoices')
          .select('id, invoice_number, invoice_name, total_amount, paid_amount, notes')
          .in('id', salesInvoiceIds);
        (invoicesData || []).forEach((i: any) => {
          const total = Number(i.total_amount) || 0;
          const paid = Number(i.paid_amount) || 0;
          salesInvoiceMap[i.id] = {
            ...i,
            calculatedRemaining: Math.max(0, total - paid),
          };
        });
      }

      const printedInvoiceMap: Record<string, any> = {};
      if (printedInvoiceIds.length > 0) {
        const { data: invoicesData } = await supabase
          .from('printed_invoices')
          .select('id, invoice_number, total_amount, paid_amount, notes')
          .in('id', printedInvoiceIds);
        (invoicesData || []).forEach((i: any) => {
          const total = Number(i.total_amount) || 0;
          const paid = Number(i.paid_amount) || 0;
          printedInvoiceMap[i.id] = {
            ...i,
            calculatedRemaining: Math.max(0, total - paid),
          };
        });
      }

      const contractNumbers = Array.from(new Set([
        ...groupedPayments.map(p => p.contract_number),
        ...Object.values(compositeTaskMap).map((t: any) => t.contract_id),
      ].filter(Boolean).map(v => Number(v)).filter(n => !Number.isNaN(n))));

      const contractMap: Record<number, any> = {};
      if (contractNumbers.length > 0) {
        const { data: contractsData } = await supabase
          .from('Contract')
          .select('Contract_Number, "Ad Type", Total, "Total Paid"')
          .in('Contract_Number', contractNumbers);
        (contractsData || []).forEach((c: any) => {
          const total = Number(c.Total) || 0;
          const paid = Number(c['Total Paid']) || 0;
          contractMap[c.Contract_Number] = {
            ...c,
            calculatedPaid: paid,
            calculatedRemaining: Math.max(0, total - paid),
          };
        });
      }

      setPaymentsMeta({
        compositeTasks: compositeTaskMap,
        salesInvoices: salesInvoiceMap,
        printedInvoices: printedInvoiceMap,
        contracts: contractMap,
      });
    } catch (err) {
      console.error('Error loading payment entities meta:', err);
    }
  };

  useEffect(() => {
    if (open && groupedPayments?.length) {
      loadPaymentEntitiesMeta();
    }
  }, [open, groupedPayments]);

  // جلب رقم هاتف العميل
  useEffect(() => {
    if (!open || !groupedPayments?.length) return;
    const customerId = groupedPayments[0]?.customer_id;
    if (!customerId) { setCustomerPhone(''); return; }
    supabase.from('customers').select('phone').eq('id', customerId).single()
      .then(({ data }) => setCustomerPhone(data?.phone || ''));
  }, [open, groupedPayments]);

  // ✅ استخدام Hook الطباعة الموحد
  const { print: printReceipt, isPrinting } = useUnifiedReceiptPrint();

  // تحميل معلومات العهدة المرتبطة بالدفعة
  const loadCustodyInfo = async (distributedPaymentId: string) => {
    setLoadingCustody(true);
    try {
      const { data, error } = await supabase
        .from('custody_accounts')
        .select(`
          id,
          account_number,
          initial_amount,
          current_balance,
          status,
          employee:employees(name)
        `)
        .eq('source_payment_id', distributedPaymentId);

      if (error) throw error;
      
      setCustodyInfo((data || []).map((c: any) => ({
        id: c.id,
        employee_name: c.employee?.name || '-',
        account_number: c.account_number,
        initial_amount: c.initial_amount,
        current_balance: c.current_balance,
        status: c.status
      })));
    } catch (error) {
      console.error('Error loading custody info:', error);
      setCustodyInfo([]);
    } finally {
      setLoadingCustody(false);
    }
  };

  // تحميل معلومات السلف المرتبطة بالدفعة
  const loadEmployeeAdvances = async (distributedPaymentId: string) => {
    try {
      const { data, error } = await supabase
        .from('employee_advances')
        .select(`
          id,
          amount,
          reason,
          status,
          request_date,
          employee:employees(name)
        `)
        .eq('distributed_payment_id', distributedPaymentId);

      if (error) throw error;
      
      setEmployeeAdvances((data || []).map((a: any) => ({
        id: a.id,
        employee_name: a.employee?.name || '-',
        amount: a.amount,
        reason: a.reason,
        status: a.status,
        request_date: a.request_date
      })));
    } catch (error) {
      console.error('Error loading employee advances:', error);
      setEmployeeAdvances([]);
    }
  };

  // تحميل معلومات السحوبات من الرصيد
  const loadWithdrawals = async (distributedPaymentId: string) => {
    try {
      const { data, error } = await supabase
        .from('expenses_withdrawals')
        .select('id, receiver_name, amount, date, notes, method')
        .eq('distributed_payment_id', distributedPaymentId);

      if (error) throw error;
      
      setWithdrawals((data || []).map((w: any) => ({
        id: w.id,
        receiver_name: w.receiver_name || '-',
        amount: w.amount,
        date: w.date,
        notes: w.notes,
        method: w.method
      })));
    } catch (error) {
      console.error('Error loading withdrawals:', error);
      setWithdrawals([]);
    }
  };

  useEffect(() => {
    if (open && groupedPayments.length > 0) {
      const firstPayment = groupedPayments[0];
      setViaIntermediary(firstPayment.collected_via_intermediary || false);
      setCollectorName(firstPayment.collector_name || '');
      setReceiverName(firstPayment.receiver_name || '');
      setDeliveryLocation(firstPayment.delivery_location || '');
      setPaymentMethod(firstPayment.method || 'نقدي');
      setNotes(firstPayment.notes || '');
      setCollectionDate(firstPayment.collection_date || '');
      
      // تحميل معلومات العهدة والسلف والسحوبات
      if (firstPayment.distributed_payment_id) {
        loadCustodyInfo(firstPayment.distributed_payment_id);
        loadEmployeeAdvances(firstPayment.distributed_payment_id);
        loadWithdrawals(firstPayment.distributed_payment_id);
      }
    } else {
      setCustodyInfo([]);
      setEmployeeAdvances([]);
      setWithdrawals([]);
    }
  }, [open, groupedPayments]);

  if (groupedPayments.length === 0) return null;

  const firstPayment = groupedPayments[0];
  const paymentDate = firstPayment.paid_at 
    ? new Date(firstPayment.paid_at).toLocaleDateString('ar-LY') 
    : '—';

  const handleSaveIntermediaryData = async () => {
    setSaving(true);
    try {
      const distributedPaymentId = firstPayment.distributed_payment_id;
      if (!distributedPaymentId) {
        toast.error('معرف الدفعة غير موجود');
        setSaving(false);
        return;
      }

      if (!viaIntermediary) {
        // Clear intermediary data
        const { error } = await supabase
          .from('customer_payments')
          .update({
            collected_via_intermediary: false,
            collector_name: null,
            receiver_name: null,
            delivery_location: null,
            collection_date: null,
            intermediary_commission: null,
            commission_notes: null,
          })
          .eq('distributed_payment_id', distributedPaymentId);

        if (error) throw error;
        toast.success('تم إلغاء تفعيل الوسيط بنجاح');

        // Reload the data to reflect changes
        window.location.reload();
        return;
      }

      // Validate
      if (!collectorName.trim() || !receiverName.trim() || !deliveryLocation.trim() || !collectionDate) {
        toast.error('يرجى ملء جميع الحقول المطلوبة');
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('customer_payments')
        .update({
          collected_via_intermediary: true,
          collector_name: collectorName.trim(),
          receiver_name: receiverName.trim(),
          delivery_location: deliveryLocation.trim(),
          collection_date: collectionDate,
          method: paymentMethod,
          notes: notes.trim() || null
        })
        .eq('distributed_payment_id', distributedPaymentId);

      if (error) throw error;
      toast.success('تم حفظ بيانات الوسيط بنجاح');
      
      // Reload the data to reflect changes
      window.location.reload();
    } catch (error: any) {
      console.error('Error saving intermediary data:', error);
      toast.error('حدث خطأ أثناء حفظ البيانات: ' + (error.message || ''));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden" dir="rtl">
        <DialogHeader className="border-b pb-4 flex-shrink-0">
          <DialogTitle className="text-xl font-bold text-primary">
            تفاصيل الدفعة الموزعة
          </DialogTitle>
          <div className="text-sm text-muted-foreground mt-2 space-y-1">
            <div>
              المعرف: <span className="font-semibold text-foreground">{firstPayment.distributed_payment_id}</span>
            </div>
            <div>
              التاريخ: <span className="font-semibold text-foreground">{paymentDate}</span>
            </div>
            <div>
              طريقة الدفع: <span className="font-semibold text-foreground">{firstPayment.method}</span>
            </div>
            {firstPayment.reference && (
              <div>
                المرجع: <span className="font-semibold text-foreground">{firstPayment.reference}</span>
              </div>
            )}
            {firstPayment.source_bank && (
              <div>
                المصرف المحول منه: <span className="font-semibold text-foreground">{firstPayment.source_bank}</span>
              </div>
            )}
            {firstPayment.destination_bank && (
              <div>
                المصرف المحول إليه: <span className="font-semibold text-foreground">{firstPayment.destination_bank}</span>
              </div>
            )}
            {firstPayment.transfer_reference && (
              <div>
                رقم العملية التحويلية: <span className="font-semibold text-foreground">{firstPayment.transfer_reference}</span>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pt-4">
          {/* ملخص المبلغ والعمولات */}
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
              <div className="text-sm text-muted-foreground mb-1">المبلغ الإجمالي</div>
              <div className="text-3xl font-bold text-primary">
                {totalAmount.toLocaleString('ar-LY')} د.ل
              </div>
            </div>

            {surplusAmount > 0 && (
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="space-y-1 text-right" dir="rtl">
                  <h5 className="font-bold text-sm">تنبيه: يوجد فائض متبقي للزبون يحتاج إلى توزيع</h5>
                  <p className="text-xs leading-relaxed text-amber-700/90 dark:text-amber-400/90">
                    هناك مبلغ قدره <span className="font-bold">{surplusAmount.toLocaleString('ar-LY')} د.ل</span> لم يتم توزيعه بعد على أي عقد أو فاتورة، وهو مسجل حالياً كـ "رصيد في الحساب العام". يمكنك تعديل الدفعة الموزعة لتوزيعه.
                  </p>
                </div>
              </div>
            )}
            
            {/* عرض العمولات إذا كانت موجودة */}
            {firstPayment.collected_via_intermediary && (
              <div className="p-4 rounded-lg bg-muted/50 border border-muted space-y-2">
                <div className="font-semibold text-foreground mb-2">تفاصيل العمولات</div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">المبلغ الإجمالي:</span>
                    <span className="font-semibold">{totalAmount.toLocaleString('ar-LY')} د.ل</span>
                  </div>
                  {firstPayment.intermediary_commission > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>عمولة الوسيط:</span>
                      <span className="font-semibold">-{(Number(firstPayment.intermediary_commission) || 0).toLocaleString('ar-LY')} د.ل</span>
                    </div>
                  )}
                  {firstPayment.transfer_fee > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>عمولة التحويل:</span>
                      <span className="font-semibold">-{(Number(firstPayment.transfer_fee) || 0).toLocaleString('ar-LY')} د.ل</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-muted-foreground/20 text-base font-bold text-primary">
                    <span>الصافي:</span>
                    <span>
                      {(totalAmount - (Number(firstPayment.intermediary_commission) || 0) - (Number(firstPayment.transfer_fee) || 0)).toLocaleString('ar-LY')} د.ل
                    </span>
                  </div>
                  {firstPayment.commission_notes && (
                    <div className="pt-2 border-t border-muted-foreground/20 mt-2">
                      <span className="text-muted-foreground">ملاحظات العمولات: </span>
                      <span className="text-foreground">{firstPayment.commission_notes}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* عرض معلومات العهدة المرتبطة */}
          {custodyInfo.length > 0 && (
            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-400">
                <Wallet className="h-5 w-5" />
                هذه الدفعة محولة إلى عهدة مالية
              </div>
              <div className="space-y-2">
                {custodyInfo.map((custody) => (
                  <div key={custody.id} className="p-3 bg-white dark:bg-background rounded-lg border border-amber-200 dark:border-amber-700">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-semibold">{custody.employee_name}</span>
                        <span className="text-muted-foreground mx-2">|</span>
                        <span className="text-sm text-muted-foreground">{custody.account_number}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={custody.status === 'active' ? 'default' : 'secondary'}>
                          {custody.status === 'active' ? 'نشط' : 'مغلق'}
                        </Badge>
                        <span className="font-bold text-primary">
                          {custody.current_balance.toLocaleString('ar-LY')} د.ل
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-700">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const printContent = `
                            <!DOCTYPE html>
                            <html dir="rtl" lang="ar">
                            <head>
                              <meta charset="UTF-8">
                              <title>إيصال استلام عهدة</title>
                              <style>
                                @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
                                * { margin: 0; padding: 0; box-sizing: border-box; }
                                @page { size: A4 portrait; margin: 0; }
                                html, body { 
                                  width: 210mm; 
                                  height: 297mm;
                                  font-family: 'Noto Sans Arabic', Arial, sans-serif; 
                                  direction: rtl; 
                                  text-align: right;
                                  background: white; 
                                  color: #000; 
                                  font-size: 10px;
                                  line-height: 1.2;
                                  overflow: hidden;
                                }
                                .receipt-container {
                                  width: 210mm;
                                  height: 297mm;
                                  padding: 10mm;
                                  display: flex;
                                  flex-direction: column;
                                }
                                .header {
                                  display: flex;
                                  justify-content: space-between;
                                  align-items: flex-start;
                                  margin-bottom: 15px;
                                  border-bottom: 2px solid #000;
                                  padding-bottom: 12px;
                                }
                                .receipt-info { text-align: left; direction: ltr; order: 2; }
                                .receipt-title { font-size: 18px; font-weight: bold; color: #000; margin-bottom: 6px; }
                                .receipt-details { font-size: 10px; color: #666; line-height: 1.4; }
                                .company-info { display: flex; flex-direction: column; align-items: flex-end; text-align: right; order: 1; }
                                .company-logo { max-width: 300px; height: auto; object-fit: contain; margin-bottom: 4px; display: block; }
                                .company-details { font-size: 10px; color: #666; line-height: 1.4; }
                                .customer-info {
                                  background: #f8f9fa;
                                  padding: 10px;
                                  border-radius: 0;
                                  margin-bottom: 12px;
                                  border-right: 3px solid #000;
                                }
                                .customer-title { font-size: 11px; font-weight: bold; margin-bottom: 6px; color: #000; }
                                .customer-details { font-size: 10px; line-height: 1.4; }
                                .amount-section {
                                  margin-top: 12px;
                                  border-top: 2px solid #000;
                                  padding-top: 10px;
                                }
                                .amount-row {
                                  display: flex;
                                  justify-content: space-between;
                                  align-items: center;
                                  padding: 12px;
                                  font-size: 16px;
                                  font-weight: bold;
                                  background: #000;
                                  color: white;
                                  margin-top: 8px;
                                }
                                .currency { font-weight: bold; color: #FFD700; text-shadow: 1px 1px 2px rgba(0,0,0,0.3); }
                                .amount-words {
                                  margin-top: 8px;
                                  font-size: 10px;
                                  color: #666;
                                  text-align: center;
                                  font-style: italic;
                                }
                                .signature-section {
                                  margin-top: 15px;
                                  display: flex;
                                  justify-content: space-between;
                                  align-items: flex-end;
                                }
                                .signature-box {
                                  text-align: center;
                                  border-top: 1px solid #000;
                                  padding-top: 6px;
                                  min-width: 100px;
                                }
                                .signature-name { margin-top: 6px; font-size: 10px; color: #666; }
                                .footer {
                                  margin-top: auto;
                                  text-align: center;
                                  font-size: 9px;
                                  color: #666;
                                  border-top: 1px solid #ddd;
                                  padding-top: 10px;
                                }
                                @media print {
                                  html, body { 
                                    width: 210mm !important; 
                                    height: 297mm !important; 
                                    margin: 0 !important; 
                                    padding: 0 !important;
                                    -webkit-print-color-adjust: exact !important;
                                    print-color-adjust: exact !important;
                                    color-adjust: exact !important;
                                  }
                                  .receipt-container { 
                                    width: 210mm !important; 
                                    height: 297mm !important; 
                                    padding: 10mm !important;
                                  }
                                  .amount-row {
                                    background: #000 !important;
                                    color: white !important;
                                    -webkit-print-color-adjust: exact !important;
                                    print-color-adjust: exact !important;
                                  }
                                  .currency {
                                    color: #FFD700 !important;
                                    -webkit-print-color-adjust: exact !important;
                                    print-color-adjust: exact !important;
                                  }
                                  .customer-info {
                                    background: #f8f9fa !important;
                                    -webkit-print-color-adjust: exact !important;
                                    print-color-adjust: exact !important;
                                  }
                                  @page { size: A4 portrait; margin: 0 !important; }
                                }
                              </style>
                            </head>
                            <body>
                              <div class="receipt-container">
                                <div class="header">
                                  <div class="company-info">
                                    <img src="/logofaresgold.svg" alt="شعار الشركة" class="company-logo" onerror="this.style.display='none'">
                                  </div>
                                  <div class="receipt-info">
                                    <div class="receipt-title">إيصال استلام عهدة مالية</div>
                                    <div class="receipt-details">
                                      رقم الحساب: ${custody.account_number}<br>
                                      التاريخ: ${new Date().toLocaleDateString('ar-LY')}
                                    </div>
                                  </div>
                                </div>
                                
                                <div class="customer-info">
                                  <div class="customer-title">بيانات العميل</div>
                                  <div class="customer-details">
                                    <strong>الاسم:</strong> ${customerName}
                                  </div>
                                </div>
                                
                                <div class="customer-info">
                                  <div class="customer-title">المستلم</div>
                                  <div class="customer-details">
                                    <strong>اسم المستلم:</strong> ${custody.employee_name}<br>
                                    <strong>الحالة:</strong> ${custody.status === 'active' ? 'نشط' : 'مغلق'}
                                  </div>
                                </div>
                                
                                <div class="amount-section">
                                  <div class="amount-row">
                                    <span>المبلغ المستلم:</span>
                                    <span class="currency">د.ل ${custody.current_balance.toLocaleString('ar-LY')}</span>
                                  </div>
                                   <div class="amount-words">
                                     المبلغ بالكلمات: ${numberToArabicWords(custody.current_balance)} دينار ليبي
                                   </div>
                                </div>
                                
                                <div class="signature-section">
                                  <div class="signature-box">
                                    <div>توقيع الدافع</div>
                                    <div class="signature-name">${customerName}</div>
                                  </div>
                                  <div class="signature-box">
                                    <div>توقيع المستلم</div>
                                    <div class="signature-name">${custody.employee_name}</div>
                                  </div>
                                </div>
                                
                                <div class="footer">
                                  شكراً لتعاملكم معنا | Thank you for your business<br>
                                  هذا إيصال إلكتروني ولا يحتاج إلى ختم أو توقيع إضافي
                                </div>
                              </div>
                            </body>
                            </html>
                          `;
                          showPrintPreview(printContent, `إيصال عهدة: ${customerName} • ${custody.employee_name}`, 'billing-receipts', customerPhone);
                        }}
                        className="gap-2 text-amber-700 border-amber-400 hover:bg-amber-100"
                      >
                        <Printer className="h-4 w-4" />
                        طباعة إيصال استلام العهدة
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                يمكنك إدارة العهد من صفحة إدارة العهد المالية
              </p>
            </div>
          )}

          {/* عرض معلومات السلف المرتبطة بالموظفين */}
          {employeeAdvances.length > 0 && (
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-300 dark:border-green-800 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-green-700 dark:text-green-400">
                <UserCheck className="h-5 w-5" />
                تم تسليم جزء من الدفعة للموظفين
              </div>
              <div className="space-y-2">
                {employeeAdvances.map((advance) => (
                  <div key={advance.id} className="p-3 bg-white dark:bg-background rounded-lg border border-green-200 dark:border-green-700">
                    <div className="flex justify-between items-center">
                      <div className="space-y-1">
                        <span className="font-semibold text-lg">{advance.employee_name}</span>
                        <p className="text-sm text-muted-foreground">{advance.reason}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={advance.status === 'approved' ? 'default' : 'secondary'}>
                          {advance.status === 'approved' ? 'مُسلّم' : advance.status}
                        </Badge>
                        <span className="font-bold text-green-600 text-lg">
                          {Number(advance.amount).toLocaleString('ar-LY')} د.ل
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-green-200 dark:border-green-700">
                      <span className="text-xs text-muted-foreground">
                        تاريخ التسليم: {new Date(advance.request_date).toLocaleDateString('ar-LY')}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          // طباعة إيصال الموظف بنفس تنسيق العهدة
                          const printContent = `
                            <!DOCTYPE html>
                            <html dir="rtl" lang="ar">
                            <head>
                              <meta charset="UTF-8">
                              <title>إيصال تسليم مبلغ للموظف</title>
                              <style>
                                @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
                                * { margin: 0; padding: 0; box-sizing: border-box; }
                                @page { size: A4 portrait; margin: 0; }
                                html, body { 
                                  width: 210mm; 
                                  height: 297mm;
                                  font-family: 'Noto Sans Arabic', Arial, sans-serif; 
                                  direction: rtl; 
                                  text-align: right;
                                  background: white; 
                                  color: #000; 
                                  font-size: 10px;
                                  line-height: 1.2;
                                  overflow: hidden;
                                }
                                .receipt-container {
                                  width: 210mm;
                                  height: 297mm;
                                  padding: 10mm;
                                  display: flex;
                                  flex-direction: column;
                                }
                                .header {
                                  display: flex;
                                  justify-content: space-between;
                                  align-items: flex-start;
                                  margin-bottom: 15px;
                                  border-bottom: 2px solid #16a34a;
                                  padding-bottom: 12px;
                                }
                                .receipt-info { text-align: left; direction: ltr; order: 2; }
                                .receipt-title { font-size: 18px; font-weight: bold; color: #16a34a; margin-bottom: 6px; }
                                .receipt-details { font-size: 10px; color: #666; line-height: 1.4; }
                                .company-info { display: flex; flex-direction: column; align-items: flex-end; text-align: right; order: 1; }
                                .company-logo { max-width: 300px; height: auto; object-fit: contain; margin-bottom: 4px; display: block; }
                                .company-details { font-size: 10px; color: #666; line-height: 1.4; }
                                .customer-info {
                                  background: #f0fdf4;
                                  padding: 10px;
                                  border-radius: 0;
                                  margin-bottom: 12px;
                                  border-right: 3px solid #16a34a;
                                }
                                .customer-title { font-size: 11px; font-weight: bold; margin-bottom: 6px; color: #16a34a; }
                                .customer-details { font-size: 10px; line-height: 1.4; }
                                .amount-section {
                                  margin-top: 12px;
                                  border-top: 2px solid #16a34a;
                                  padding-top: 10px;
                                }
                                .amount-row {
                                  display: flex;
                                  justify-content: space-between;
                                  align-items: center;
                                  padding: 12px;
                                  font-size: 16px;
                                  font-weight: bold;
                                  background: #16a34a;
                                  color: white;
                                  margin-top: 8px;
                                }
                                .currency { font-weight: bold; color: #FFD700; text-shadow: 1px 1px 2px rgba(0,0,0,0.3); }
                                .amount-words {
                                  margin-top: 8px;
                                  font-size: 10px;
                                  color: #666;
                                  text-align: center;
                                  font-style: italic;
                                }
                                .signature-section {
                                  margin-top: 15px;
                                  display: flex;
                                  justify-content: space-between;
                                  align-items: flex-end;
                                }
                                .signature-box {
                                  text-align: center;
                                  border-top: 1px solid #000;
                                  padding-top: 6px;
                                  min-width: 100px;
                                }
                                .signature-name { margin-top: 6px; font-size: 10px; color: #666; }
                                .footer {
                                  margin-top: auto;
                                  text-align: center;
                                  font-size: 9px;
                                  color: #666;
                                  border-top: 1px solid #ddd;
                                  padding-top: 10px;
                                }
                                @media print {
                                  html, body { 
                                    width: 210mm !important; 
                                    height: 297mm !important; 
                                    margin: 0 !important; 
                                    padding: 0 !important;
                                    -webkit-print-color-adjust: exact !important;
                                    print-color-adjust: exact !important;
                                    color-adjust: exact !important;
                                  }
                                  .receipt-container { 
                                    width: 210mm !important; 
                                    height: 297mm !important; 
                                    padding: 10mm !important;
                                  }
                                  .amount-row {
                                    background: #16a34a !important;
                                    color: white !important;
                                    -webkit-print-color-adjust: exact !important;
                                    print-color-adjust: exact !important;
                                  }
                                  .currency {
                                    color: #FFD700 !important;
                                    -webkit-print-color-adjust: exact !important;
                                    print-color-adjust: exact !important;
                                  }
                                  .customer-info {
                                    background: #f0fdf4 !important;
                                    -webkit-print-color-adjust: exact !important;
                                    print-color-adjust: exact !important;
                                  }
                                  @page { size: A4 portrait; margin: 0 !important; }
                                }
                              </style>
                            </head>
                            <body>
                              <div class="receipt-container">
                                <div class="header">
                                  <div class="company-info">
                                    <img src="/logofaresgold.svg" alt="شعار الشركة" class="company-logo" onerror="this.style.display='none'">
                                  </div>
                                  <div class="receipt-info">
                                    <div class="receipt-title">إيصال تسليم مبلغ للموظف</div>
                                    <div class="receipt-details">
                                      التاريخ: ${new Date(advance.request_date).toLocaleDateString('ar-LY')}
                                    </div>
                                  </div>
                                </div>
                                
                                <div class="customer-info">
                                  <div class="customer-title">بيانات العميل</div>
                                  <div class="customer-details">
                                    <strong>الاسم:</strong> ${customerName}
                                  </div>
                                </div>
                                
                                <div class="customer-info">
                                  <div class="customer-title">المستلم</div>
                                  <div class="customer-details">
                                    <strong>اسم المستلم:</strong> ${advance.employee_name}<br>
                                    <strong>السبب:</strong> ${advance.reason || 'دفعة من الزبون'}<br>
                                    <strong>الحالة:</strong> ${advance.status === 'approved' ? 'مُسلّم' : advance.status}
                                  </div>
                                </div>
                                
                                <div class="amount-section">
                                  <div class="amount-row">
                                    <span>المبلغ المستلم:</span>
                                    <span class="currency">د.ل ${Number(advance.amount).toLocaleString('ar-LY')}</span>
                                  </div>
                                   <div class="amount-words">
                                     المبلغ بالكلمات: ${numberToArabicWords(Number(advance.amount))} دينار ليبي
                                   </div>
                                </div>
                                
                                <div class="signature-section">
                                  <div class="signature-box">
                                    <div>توقيع الدافع</div>
                                    <div class="signature-name">${customerName}</div>
                                  </div>
                                  <div class="signature-box">
                                    <div>توقيع المستلم</div>
                                    <div class="signature-name">${advance.employee_name}</div>
                                  </div>
                                </div>
                                
                                <div class="footer">
                                  شكراً لتعاملكم معنا | Thank you for your business<br>
                                  هذا إيصال إلكتروني ولا يحتاج إلى ختم أو توقيع إضافي
                                </div>
                              </div>
                            </body>
                            </html>
                          `;
                          showPrintPreview(printContent, `إيصال استلام: ${customerName} • ${advance.employee_name}`, 'billing-receipts', customerPhone);
                        }}
                        className="gap-1 text-green-600 border-green-300 hover:bg-green-100"
                      >
                        <Printer className="h-4 w-4" />
                        طباعة إيصال
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* عرض معلومات السحوبات من الرصيد */}
          {withdrawals.length > 0 && (
            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-300 dark:border-blue-800 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-blue-700 dark:text-blue-400">
                <Wallet className="h-5 w-5" />
                تم سحب جزء من الدفعة من رصيد الموظفين
              </div>
              <div className="space-y-2">
                {withdrawals.map((withdrawal) => (
                  <div key={withdrawal.id} className="p-3 bg-white dark:bg-background rounded-lg border border-blue-200 dark:border-blue-700">
                    <div className="flex justify-between items-center">
                      <div className="space-y-1">
                        <span className="font-semibold text-lg">{withdrawal.receiver_name}</span>
                        <p className="text-sm text-muted-foreground">{withdrawal.notes}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="default" className="bg-blue-600">
                          {withdrawal.method || 'نقدي'}
                        </Badge>
                        <span className="font-bold text-blue-600 text-lg">
                          {Number(withdrawal.amount).toLocaleString('ar-LY')} د.ل
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                      <span className="text-xs text-muted-foreground">
                        تاريخ السحب: {withdrawal.date ? new Date(withdrawal.date).toLocaleDateString('ar-LY') : '—'}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const printContent = `
                            <!DOCTYPE html>
                            <html dir="rtl" lang="ar">
                            <head>
                              <meta charset="UTF-8">
                              <title>إيصال سحب من رصيد الموظف</title>
                              <style>
                                @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
                                * { margin: 0; padding: 0; box-sizing: border-box; }
                                @page { size: A4 portrait; margin: 0; }
                                html, body { 
                                  width: 210mm; 
                                  height: 297mm;
                                  font-family: 'Noto Sans Arabic', Arial, sans-serif; 
                                  direction: rtl; 
                                  text-align: right;
                                  background: white; 
                                  color: #000; 
                                  font-size: 10px;
                                  line-height: 1.2;
                                  overflow: hidden;
                                }
                                .receipt-container {
                                  width: 210mm;
                                  height: 297mm;
                                  padding: 10mm;
                                  display: flex;
                                  flex-direction: column;
                                }
                                .header {
                                  display: flex;
                                  justify-content: space-between;
                                  align-items: flex-start;
                                  margin-bottom: 15px;
                                  border-bottom: 2px solid #2563eb;
                                  padding-bottom: 12px;
                                }
                                .receipt-info { text-align: left; direction: ltr; order: 2; }
                                .receipt-title { font-size: 18px; font-weight: bold; color: #2563eb; margin-bottom: 6px; }
                                .receipt-details { font-size: 10px; color: #666; line-height: 1.4; }
                                .company-info { display: flex; flex-direction: column; align-items: flex-end; text-align: right; order: 1; }
                                .company-logo { max-width: 300px; height: auto; object-fit: contain; margin-bottom: 4px; display: block; }
                                .company-details { font-size: 10px; color: #666; line-height: 1.4; }
                                .customer-info {
                                  background: #eff6ff;
                                  padding: 10px;
                                  border-radius: 0;
                                  margin-bottom: 12px;
                                  border-right: 3px solid #2563eb;
                                }
                                .customer-title { font-size: 11px; font-weight: bold; margin-bottom: 6px; color: #2563eb; }
                                .customer-details { font-size: 10px; line-height: 1.4; }
                                .amount-section {
                                  margin-top: 12px;
                                  border-top: 2px solid #2563eb;
                                  padding-top: 10px;
                                }
                                .amount-row {
                                  display: flex;
                                  justify-content: space-between;
                                  align-items: center;
                                  padding: 12px;
                                  font-size: 16px;
                                  font-weight: bold;
                                  background: #2563eb;
                                  color: white;
                                  margin-top: 8px;
                                }
                                .currency { font-weight: bold; color: #FFD700; text-shadow: 1px 1px 2px rgba(0,0,0,0.3); }
                                .amount-words {
                                  margin-top: 8px;
                                  font-size: 10px;
                                  color: #666;
                                  text-align: center;
                                  font-style: italic;
                                }
                                .signature-section {
                                  margin-top: 15px;
                                  display: flex;
                                  justify-content: space-between;
                                  align-items: flex-end;
                                }
                                .signature-box {
                                  text-align: center;
                                  border-top: 1px solid #000;
                                  padding-top: 6px;
                                  min-width: 100px;
                                }
                                .signature-name { margin-top: 6px; font-size: 10px; color: #666; }
                                .footer {
                                  margin-top: auto;
                                  text-align: center;
                                  font-size: 9px;
                                  color: #666;
                                  border-top: 1px solid #ddd;
                                  padding-top: 10px;
                                }
                                @media print {
                                  html, body { 
                                    width: 210mm !important; 
                                    height: 297mm !important; 
                                    margin: 0 !important; 
                                    padding: 0 !important;
                                    -webkit-print-color-adjust: exact !important;
                                    print-color-adjust: exact !important;
                                    color-adjust: exact !important;
                                  }
                                  .receipt-container { 
                                    width: 210mm !important; 
                                    height: 297mm !important; 
                                    padding: 10mm !important;
                                  }
                                  .amount-row {
                                    background: #2563eb !important;
                                    color: white !important;
                                    -webkit-print-color-adjust: exact !important;
                                    print-color-adjust: exact !important;
                                  }
                                  .currency {
                                    color: #FFD700 !important;
                                    -webkit-print-color-adjust: exact !important;
                                    print-color-adjust: exact !important;
                                  }
                                  .customer-info {
                                    background: #eff6ff !important;
                                    -webkit-print-color-adjust: exact !important;
                                    print-color-adjust: exact !important;
                                  }
                                  @page { size: A4 portrait; margin: 0 !important; }
                                }
                              </style>
                            </head>
                            <body>
                              <div class="receipt-container">
                                <div class="header">
                                  <div class="company-info">
                                    <img src="/logofaresgold.svg" alt="شعار الشركة" class="company-logo" onerror="this.style.display='none'">
                                  </div>
                                  <div class="receipt-info">
                                    <div class="receipt-title">إيصال سحب من رصيد الموظف</div>
                                    <div class="receipt-details">
                                      التاريخ: ${withdrawal.date ? new Date(withdrawal.date).toLocaleDateString('ar-LY') : new Date().toLocaleDateString('ar-LY')}
                                    </div>
                                  </div>
                                </div>
                                
                                <div class="customer-info">
                                  <div class="customer-title">بيانات العميل</div>
                                  <div class="customer-details">
                                    <strong>الاسم:</strong> ${customerName}
                                  </div>
                                </div>
                                
                                <div class="customer-info">
                                  <div class="customer-title">المستلم</div>
                                  <div class="customer-details">
                                    <strong>اسم المستلم:</strong> ${withdrawal.receiver_name}<br>
                                    <strong>طريقة الدفع:</strong> ${withdrawal.method || 'نقدي'}<br>
                                    <strong>ملاحظات:</strong> ${withdrawal.notes || '—'}
                                  </div>
                                </div>
                                
                                <div class="amount-section">
                                  <div class="amount-row">
                                    <span>المبلغ المستلم:</span>
                                    <span class="currency">د.ل ${Number(withdrawal.amount).toLocaleString('ar-LY')}</span>
                                  </div>
                                   <div class="amount-words">
                                     المبلغ بالكلمات: ${numberToArabicWords(Number(withdrawal.amount))} دينار ليبي
                                   </div>
                                </div>
                                
                                <div class="signature-section">
                                  <div class="signature-box">
                                    <div>توقيع الدافع</div>
                                    <div class="signature-name">${customerName}</div>
                                  </div>
                                  <div class="signature-box">
                                    <div>توقيع المستلم</div>
                                    <div class="signature-name">${withdrawal.receiver_name}</div>
                                  </div>
                                </div>
                                
                                <div class="footer">
                                  شكراً لتعاملكم معنا | Thank you for your business<br>
                                  هذا إيصال إلكتروني ولا يحتاج إلى ختم أو توقيع إضافي
                                </div>
                              </div>
                            </body>
                            </html>
                          `;
                          showPrintPreview(printContent, `إيصال استلام: ${customerName} • ${withdrawal.receiver_name}`, 'billing-receipts', customerPhone);
                        }}
                        className="gap-1 text-blue-600 border-blue-300 hover:bg-blue-100"
                      >
                        <Printer className="h-4 w-4" />
                        طباعة إيصال
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* جدول المدفوعات */}
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">المرجع</TableHead>
                  <TableHead className="text-right">البيان</TableHead>
                  <TableHead className="text-center">القيمة الإجمالية</TableHead>
                  <TableHead className="text-center">المبلغ المدفوع</TableHead>
                  <TableHead className="text-center">المتبقي</TableHead>
                  <TableHead className="text-center">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const rows: Array<{
                    id: string;
                    reference: string;
                    description: string;
                    Icon: any;
                    totalAmount: number | null;
                    amount: number;
                    remaining: number | null;
                    payment: PaymentRow;
                  }> = [];
                  const taskGroups = new Map<string, typeof rows[0] & { teamNames: Set<string>; countedTasks: Set<string>; baseDesc: string }>();

                  for (const payment of groupedPayments) {
                    if (payment.composite_task_id) {
                      const task = paymentsMeta.compositeTasks[payment.composite_task_id];
                      const contract = task?.contract_id ? paymentsMeta.contracts[Number(task.contract_id)] : null;
                      const rawAdType = contract?.['Ad Type'] || '';
                      const adTypeClean = rawAdType && rawAdType !== 'لوحة إعلانية' ? rawAdType.trim() : '';

                      const components: string[] = [];
                      if (task?.print_task_id) components.push('طباعة');
                      if (task?.cutout_task_id) components.push('قص');
                      if (task?.installation_task_id) components.push('تركيب');
                      const taskComponents = components.length > 0 ? components.join(' + ') : 'مهمة مجمعة';

                      let baseDesc = taskComponents;
                      if (adTypeClean) {
                        if (adTypeClean.includes('طباعة') || adTypeClean.includes('تركيب')) {
                          baseDesc = adTypeClean;
                        } else {
                          baseDesc = `${adTypeClean} (${taskComponents})`;
                        }
                      }

                      const taskIdentity = {
                        id: task?.id || payment.composite_task_id,
                        task_number: task?.task_number,
                        contract_id: task?.contract_id,
                        task_type: task?.task_type,
                        reinstallation_number: task?.reinstallation_number,
                        installation_task_id: task?.installation_task_id,
                        team_name: task?.team_name,
                        remaining: task?.calculatedRemaining,
                        total: task?.customer_total,
                      };

                      const groupKey = compositeTaskGroupKey(taskIdentity);
                      const existing = taskGroups.get(groupKey);

                      if (existing) {
                        existing.amount += Number(payment.amount) || 0;
                        if (task?.team_name) existing.teamNames.add(task.team_name);
                        if (!existing.countedTasks.has(payment.composite_task_id)) {
                          existing.countedTasks.add(payment.composite_task_id);
                          if (task?.customer_total != null) {
                            existing.totalAmount = (existing.totalAmount ?? 0) + Number(task.customer_total);
                          }
                          if (task?.calculatedRemaining != null) {
                            existing.remaining = (existing.remaining ?? 0) + Number(task.calculatedRemaining);
                          }
                        }
                        const teamsStr = Array.from(existing.teamNames).filter(Boolean).join(' + ');
                        existing.description = existing.baseDesc;
                        const isFullyPaid = existing.remaining !== null && Number(existing.remaining) <= 0.01 && existing.totalAmount !== null && Number(existing.totalAmount) > 0;
                        if (isFullyPaid && !existing.reference.includes('(مسددة بالكامل)')) {
                          existing.reference = `${existing.reference} (مسددة بالكامل)`;
                        } else if (!isFullyPaid && existing.reference.includes('(مسددة بالكامل)')) {
                          existing.reference = existing.reference.replace(' (مسددة بالكامل)', '');
                        }
                      } else {
                        const teamNames = new Set<string>();
                        if (task?.team_name) teamNames.add(task.team_name);
                        const countedTasks = new Set<string>([payment.composite_task_id]);
                        const totalAmount = task?.customer_total != null ? Number(task.customer_total) : null;
                        const remaining = task?.calculatedRemaining != null ? Number(task.calculatedRemaining) : null;
                        const description = baseDesc;
                        const reference = compositeTaskLabel(taskIdentity);

                        const newRow = {
                          id: payment.id,
                          reference,
                          description,
                          Icon: Wrench,
                          totalAmount,
                          amount: Number(payment.amount) || 0,
                          remaining,
                          payment,
                          teamNames,
                          countedTasks,
                          baseDesc,
                        };
                        rows.push(newRow);
                        taskGroups.set(groupKey, newRow);
                      }
                    } else if (payment.sales_invoice_id) {
                      const inv = paymentsMeta.salesInvoices[payment.sales_invoice_id];
                      const invTitle = inv?.invoice_name || (inv?.notes && !inv.notes.startsWith('توزيع على') ? inv.notes : '') || 'مبيعات';
                      rows.push({
                        id: payment.id,
                        reference: `فاتورة مبيعات${inv?.invoice_number ? ` #${inv.invoice_number}` : ''}`,
                        description: invTitle,
                        Icon: Receipt,
                        totalAmount: inv?.total_amount != null ? Number(inv.total_amount) : null,
                        amount: Number(payment.amount) || 0,
                        remaining: inv?.calculatedRemaining != null ? Number(inv.calculatedRemaining) : null,
                        payment,
                      });
                    } else if (payment.printed_invoice_id) {
                      const inv = paymentsMeta.printedInvoices[payment.printed_invoice_id];
                      rows.push({
                        id: payment.id,
                        reference: `فاتورة طباعة${inv?.invoice_number ? ` #${inv.invoice_number}` : ''}`,
                        description: inv?.notes || 'طباعة',
                        Icon: Printer,
                        totalAmount: inv?.total_amount != null ? Number(inv.total_amount) : null,
                        amount: Number(payment.amount) || 0,
                        remaining: inv?.calculatedRemaining != null ? Number(inv.calculatedRemaining) : null,
                        payment,
                      });
                    } else if (payment.entry_type === 'payment' && !payment.contract_number) {
                      rows.push({
                        id: payment.id,
                        reference: 'رصيد فائض (غير موزع)',
                        description: payment.notes?.replace(/^توزيع على.*?- /g, '') || 'فائض سداد متبقي في حساب العميل',
                        Icon: DollarSign,
                        totalAmount: null,
                        amount: Number(payment.amount) || 0,
                        remaining: null,
                        payment,
                      });
                    } else {
                      const cn = payment.contract_number ? Number(payment.contract_number) : null;
                      const c = cn ? paymentsMeta.contracts[cn] : null;
                      rows.push({
                        id: payment.id,
                        reference: `عقد رقم ${payment.contract_number}`,
                        description: c?.['Ad Type'] || 'لوحة إعلانية',
                        Icon: FileText,
                        totalAmount: c?.Total != null ? Number(c.Total) : null,
                        amount: Number(payment.amount) || 0,
                        remaining: c?.calculatedRemaining != null ? Number(c.calculatedRemaining) : null,
                        payment,
                      });
                    }
                  }

                  rows.sort((a, b) => {
                    const typeOrder = (row: typeof rows[0]) => {
                      if (row.payment.contract_number && !row.payment.composite_task_id) return 1;
                      if (row.payment.composite_task_id) return 2;
                      if (row.payment.sales_invoice_id) return 3;
                      if (row.payment.printed_invoice_id) return 4;
                      return 5; // surplus credit
                    };
                    const orderA = typeOrder(a);
                    const orderB = typeOrder(b);
                    if (orderA !== orderB) return orderA - orderB;

                    if (orderA === 1) {
                      return (Number(a.payment.contract_number) || 0) - (Number(b.payment.contract_number) || 0);
                    }
                    if (orderA === 2) {
                      const tA = paymentsMeta.compositeTasks[a.payment.composite_task_id!];
                      const tB = paymentsMeta.compositeTasks[b.payment.composite_task_id!];
                      const cA = Number(tA?.contract_id || 0);
                      const cB = Number(tB?.contract_id || 0);
                      if (cA !== cB) return cA - cB;
                      const rA = Number(tA?.reinstallation_number || 0);
                      const rB = Number(tB?.reinstallation_number || 0);
                      if (rA !== rB) return rA - rB;
                      return (Number(tA?.task_number) || 0) - (Number(tB?.task_number) || 0);
                    }
                    if (orderA === 3) {
                      const iA = paymentsMeta.salesInvoices[a.payment.sales_invoice_id!];
                      const iB = paymentsMeta.salesInvoices[b.payment.sales_invoice_id!];
                      return String(iA?.invoice_number || '').localeCompare(String(iB?.invoice_number || ''), undefined, { numeric: true });
                    }
                    if (orderA === 4) {
                      const iA = paymentsMeta.printedInvoices[a.payment.printed_invoice_id!];
                      const iB = paymentsMeta.printedInvoices[b.payment.printed_invoice_id!];
                      return String(iA?.invoice_number || '').localeCompare(String(iB?.invoice_number || ''), undefined, { numeric: true });
                    }
                    return 0;
                  });

                  return rows.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-semibold text-base">
                        <item.Icon className="w-4 h-4 inline-block ml-2 text-primary" />
                        {item.reference}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div>{item.description}</div>
                        {(item as any).teamNames && (item as any).teamNames.size > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Array.from((item as any).teamNames as Set<string>).map(t => (
                              <Badge key={t} variant="outline" className="text-[10px] text-muted-foreground border-dashed px-1 py-0 font-normal">
                                {t}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-foreground">
                        {item.totalAmount !== null && item.totalAmount !== undefined
                          ? `${Number(item.totalAmount).toLocaleString('ar-LY')} د.ل`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-center font-bold text-green-600 text-base">
                        {(Number(item.amount) || 0).toLocaleString('ar-LY')} د.ل
                      </TableCell>
                      <TableCell className="text-center font-semibold text-amber-600">
                        {item.remaining !== null && item.remaining !== undefined
                          ? `${Number(item.remaining).toLocaleString('ar-LY')} د.ل`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onPrintIndividual({ ...item.payment, amount: item.amount })}
                          className="gap-2"
                        >
                          <Printer className="h-4 w-4" />
                          طباعة إيصال
                        </Button>
                      </TableCell>
                    </TableRow>
                  ));
                })()}
              </TableBody>
            </Table>
          </div>

          {/* قسم الوسيط المحصل - يظهر فقط إذا كان مفعلاً في البيانات */}
          {firstPayment.collected_via_intermediary && (
            <div className="border rounded-lg p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10">
              <div className="flex items-center gap-2 mb-4">
                <UserCheck className="h-5 w-5 text-primary" />
                <span className="text-base font-bold text-primary">
                  القبض عن طريق وسيط
                </span>
              </div>

              <div className="space-y-3 text-sm">
                {firstPayment.collector_name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">المحصل (المستلم من الزبون):</span>
                    <span className="font-semibold">{firstPayment.collector_name}</span>
                  </div>
                )}
                {firstPayment.receiver_name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">المسلم له:</span>
                    <span className="font-semibold">{firstPayment.receiver_name}</span>
                  </div>
                )}
                {firstPayment.delivery_location && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">مكان التسليم:</span>
                    <span className="font-semibold">{firstPayment.delivery_location}</span>
                  </div>
                )}
                {firstPayment.collection_date && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">تاريخ القبض:</span>
                    <span className="font-semibold">{new Date(firstPayment.collection_date).toLocaleDateString('ar-LY')}</span>
                  </div>
                )}
                {firstPayment.notes && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ملاحظات:</span>
                    <span className="font-semibold">{firstPayment.notes}</span>
                  </div>
                )}
              </div>

              {/* زر طباعة إيصال الوسيط */}
              {firstPayment.collector_name && firstPayment.receiver_name && firstPayment.delivery_location && (
                <div className="mt-4 pt-3 border-t">
                  <Button
                    onClick={() => setIntermediaryPrintOpen(true)}
                    className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
                    size="sm"
                  >
                    <Printer className="h-4 w-4" />
                    طباعة إيصال الوسيط
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* لا يظهر أي شيء إذا لم يكن الوسيط مفعلاً - يمكن تفعيله من خلال وضع التعديل فقط */}

          {/* قسم تحويل إلى عهدة - منفصل */}
          {custodyInfo.length === 0 && (
            <div className="border rounded-lg p-4 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-amber-600" />
                  <span className="text-base font-bold text-amber-700 dark:text-amber-400">
                    تحويل إلى عهدة مالية
                  </span>
                </div>
                <Button
                  onClick={() => setCustodyDialogOpen(true)}
                  className="bg-amber-600 hover:bg-amber-700 gap-2"
                  size="sm"
                >
                  <Wallet className="h-4 w-4" />
                  تحويل لعهدة (اختيار موظفين)
                </Button>
              </div>
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                يمكنك تحويل هذه الدفعة إلى عهدة مالية وتوزيعها على موظف أو أكثر
              </p>
            </div>
          )}
        </div>

        {/* أزرار الطباعة والحذف والتعديل - ثابتة في الأسفل */}
        <div className="flex-shrink-0 space-y-4 pt-4 border-t bg-background">
            {/* خيار إظهار الوسيط في الإيصال */}
            {(custodyInfo.length > 0 || employeeAdvances.length > 0 || withdrawals.length > 0) && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <Checkbox
                  id="showIntermediaryInReceipt"
                  checked={showIntermediaryInReceipt}
                  onCheckedChange={(checked) => setShowIntermediaryInReceipt(checked as boolean)}
                />
                <Label htmlFor="showIntermediaryInReceipt" className="cursor-pointer flex items-center gap-2 text-sm font-medium">
                  <UserCheck className="h-4 w-4 text-primary" />
                  إظهار معلومات الوسيط (العهدة/الموظف) في الإيصال الموحد
                </Label>
              </div>
            )}
            
            <div className="flex gap-3">
              <Button
                onClick={async () => {
                  // ✅ استخدام نظام الطباعة الموحد الجديد (مثل كشف الحساب)
                  const firstPaymentData = groupedPayments[0];
                  
                  // جلب بيانات العميل
                  let customerData = { id: '', name: customerName, company: '', phone: '' };
                  if (firstPaymentData.customer_id) {
                    const { data } = await supabase
                      .from('customers')
                      .select('id, name, company, phone')
                      .eq('id', firstPaymentData.customer_id)
                      .single();
                    if (data) customerData = data;
                  }

                  // ✅ جلب بيانات المهام المجمعة وفواتير المبيعات أولاً لتحديد كافة أرقام العقود
                  const compositeTaskIds = groupedPayments
                    .filter(p => p.composite_task_id)
                    .map(p => p.composite_task_id as string);
                  
                  const salesInvoiceIds = groupedPayments
                    .filter(p => p.sales_invoice_id)
                    .map(p => p.sales_invoice_id as string);

                  const printedInvoiceIds = groupedPayments
                    .filter(p => p.printed_invoice_id)
                    .map(p => p.printed_invoice_id as string);

                  // جلب بيانات المهام المجمعة
                  const compositeTaskMap: Record<string, any> = {};
                  let tasksData: any[] = [];
                  if (compositeTaskIds.length > 0) {
                    const { data } = await supabase
                      .from('composite_tasks')
                      .select('id, task_number, contract_id, task_type, customer_total, paid_amount, installation_task_id, print_task_id, cutout_task_id')
                      .in('id', compositeTaskIds);
                    tasksData = data || [];
                  }

                  // جلب بيانات مهام التركيب المرتبطة لاستخراج رقم إعادة التركيب ونوع المهمة
                  const installTaskIds = tasksData
                    .map((t: any) => t.installation_task_id)
                    .filter(Boolean);

                  const installTaskMap: Record<string, any> = {};
                  if (installTaskIds.length > 0) {
                    const { data: itData, error: itErr } = await supabase
                      .from('installation_tasks')
                      .select('id, contract_id, task_type, reinstallation_number, team_id, installation_teams(team_name)')
                      .in('id', installTaskIds);
                    if (itErr) {
                      console.warn('Fallback loading installation_tasks in print without join:', itErr);
                      const { data: fallbackData } = await supabase
                        .from('installation_tasks')
                        .select('id, contract_id, task_type, reinstallation_number, team_id')
                        .in('id', installTaskIds);
                      (fallbackData || []).forEach((it: any) => {
                        installTaskMap[it.id] = it;
                      });
                    } else {
                      (itData || []).forEach((it: any) => {
                        installTaskMap[it.id] = it;
                      });
                    }
                  }

                  tasksData.forEach((t: any) => {
                    const it = t.installation_task_id ? installTaskMap[t.installation_task_id] : null;
                    const contractId = t.contract_id || it?.contract_id || null;
                    const taskType = it?.task_type || t.task_type;
                    const reinstallationNumber = it?.reinstallation_number ?? (taskType === 'reinstallation' ? 1 : null);
                    const remaining = (Number(t.customer_total) || 0) - (Number(t.paid_amount) || 0);

                    compositeTaskMap[t.id] = {
                      ...t,
                      contract_id: contractId,
                      task_type: taskType,
                      reinstallation_number: reinstallationNumber,
                      team_name: it?.installation_teams?.team_name || null,
                      calculatedRemaining: Math.max(0, remaining),
                    };
                  });

                  // جلب أرقام كافة العقود (سواء من الدفعات المباشرة أو المهام المجمعة)
                  const contractNumbers = Array.from(new Set([
                    ...groupedPayments.map(p => p.contract_number),
                    ...Object.values(compositeTaskMap).map((t: any) => t.contract_id),
                  ].filter(Boolean).map(v => Number(v)).filter(n => !Number.isNaN(n))));

                  const contractMap: Record<number, any> = {};
                  if (contractNumbers.length > 0) {
                    const { data: contractsData, error: contractsError } = await supabase
                      .from('Contract')
                      .select('Contract_Number, "Ad Type", Total, "Total Paid"')
                      .in('Contract_Number', contractNumbers);
                    if (contractsError) throw contractsError;
                    
                    // جلب المدفوعات لهذه العقود لحساب المتبقي الصحيح
                    const { data: allPayments } = await supabase
                      .from('customer_payments')
                      .select('contract_number, amount, entry_type')
                      .in('contract_number', contractNumbers);
                    
                    // حساب إجمالي المدفوع لكل عقد
                    const paidByContract: Record<number, number> = {};
                    (allPayments || []).forEach((p: any) => {
                      const cn = Number(p.contract_number);
                      if (!paidByContract[cn]) paidByContract[cn] = 0;
                      if (p.entry_type === 'receipt' || p.entry_type === 'payment' || p.entry_type === 'account_payment') {
                        paidByContract[cn] += Number(p.amount) || 0;
                      }
                    });
                    
                    (contractsData || []).forEach((c: any) => {
                      const cn = c.Contract_Number;
                      const total = Number(c.Total) || 0;
                      const paid = paidByContract[cn] || 0;
                      const remaining = Math.max(0, total - paid);
                      contractMap[cn] = { ...c, calculatedRemaining: remaining, calculatedPaid: paid };
                    });
                  }

                  // جلب بيانات فواتير المبيعات
                  const salesInvoiceMap: Record<string, any> = {};
                  if (salesInvoiceIds.length > 0) {
                    const { data: invoicesData } = await supabase
                      .from('sales_invoices')
                      .select('id, invoice_number, invoice_name, total_amount, paid_amount, notes')
                      .in('id', salesInvoiceIds);
                    (invoicesData || []).forEach((i: any) => {
                      const remaining = (Number(i.total_amount) || 0) - (Number(i.paid_amount) || 0);
                      salesInvoiceMap[i.id] = { ...i, calculatedRemaining: Math.max(0, remaining) };
                    });
                  }

                  // جلب بيانات فواتير الطباعة
                  const printedInvoiceMap: Record<string, any> = {};
                  if (printedInvoiceIds.length > 0) {
                    const { data: invoicesData } = await supabase
                      .from('printed_invoices')
                      .select('id, invoice_number, total_amount, paid_amount, notes')
                      .in('id', printedInvoiceIds);
                    (invoicesData || []).forEach((i: any) => {
                      const remaining = (Number(i.total_amount) || 0) - (Number(i.paid_amount) || 0);
                      printedInvoiceMap[i.id] = { ...i, calculatedRemaining: Math.max(0, remaining) };
                    });
                  }

                  const distributedContracts = groupedPayments.map((p) => {
                    // تحديد نوع الدفعة
                    if (p.composite_task_id) {
                      const task = compositeTaskMap[p.composite_task_id];
                      const contract = task?.contract_id ? contractMap[Number(task.contract_id)] : null;
                      const rawAdType = contract?.['Ad Type'] || '';
                      const adTypeClean = rawAdType && rawAdType !== 'لوحة إعلانية' ? rawAdType.trim() : '';

                      // بناء وصف مكونات المهمة بناءً على المكونات الفعلية
                      const components: string[] = [];
                      if (task?.print_task_id) components.push('طباعة');
                      if (task?.cutout_task_id) components.push('قص');
                      if (task?.installation_task_id) components.push('تركيب');
                      const taskComponents = components.length > 0 ? components.join(' + ') : 'مهمة مجمعة';

                      // وصف البيان: نوع الإعلان + مكونات الخدمة (بدون أسماء الفرق في الفاتورة للزبون)
                      let finalDescription = taskComponents;
                      if (adTypeClean) {
                        if (adTypeClean.includes('طباعة') || adTypeClean.includes('تركيب')) {
                          finalDescription = adTypeClean;
                        } else {
                          finalDescription = `${adTypeClean} (${taskComponents})`;
                        }
                      }

                      const taskIdentity = {
                        id: task?.id || p.composite_task_id,
                        task_number: task?.task_number,
                        contract_id: task?.contract_id,
                        task_type: task?.task_type,
                        reinstallation_number: task?.reinstallation_number,
                        installation_task_id: task?.installation_task_id,
                        team_name: task?.team_name,
                        remaining: task?.calculatedRemaining,
                        total: task?.customer_total,
                      };

                      const groupKey = compositeTaskGroupKey(taskIdentity);
                      const refLabel = compositeTaskLabel(taskIdentity);

                      return {
                        contractNumber: refLabel,
                        compositeTaskId: p.composite_task_id,
                        installationTaskId: task?.installation_task_id,
                        adType: finalDescription,
                        rawAdType: adTypeClean || undefined,
                        taskComponents,
                        teamName: task?.team_name || undefined,
                        contractId: task?.contract_id ? Number(task.contract_id) : undefined,
                        reinstallationNumber: task?.reinstallation_number ? Number(task.reinstallation_number) : undefined,
                        amount: Number(p.amount) || 0,
                        total: task?.customer_total ?? null,
                        totalPaid: task?.paid_amount ?? null,
                        remaining: task?.calculatedRemaining ?? null,
                        entityType: 'composite_task' as const,
                        compositeTaskType: finalDescription,
                        groupKey,
                      };
                    }
                    
                    if (p.sales_invoice_id) {
                      const invoice = salesInvoiceMap[p.sales_invoice_id];
                      return {
                        contractNumber: invoice?.invoice_number ? (String(invoice.invoice_number).startsWith('فاتورة') ? String(invoice.invoice_number) : `فاتورة مبيعات #${invoice.invoice_number}`) : 'فاتورة مبيعات',
                        adType: invoice?.invoice_name || invoice?.notes || 'مبيعات',
                        amount: Number(p.amount) || 0,
                        total: invoice?.total_amount ?? null,
                        totalPaid: invoice?.paid_amount ?? null,
                        remaining: invoice?.calculatedRemaining ?? null,
                        entityType: 'sales_invoice' as const,
                      };
                    }

                    if (p.printed_invoice_id) {
                      const invoice = printedInvoiceMap[p.printed_invoice_id];
                      return {
                        contractNumber: invoice?.invoice_number ? (String(invoice.invoice_number).startsWith('فاتورة') ? String(invoice.invoice_number) : `فاتورة طباعة #${invoice.invoice_number}`) : 'فاتورة طباعة',
                        adType: invoice?.notes || 'طباعة',
                        amount: Number(p.amount) || 0,
                        total: invoice?.total_amount ?? null,
                        totalPaid: invoice?.paid_amount ?? null,
                        remaining: invoice?.calculatedRemaining ?? null,
                        entityType: 'printed_invoice' as const,
                      };
                    }

                    // رصيد فائض (غير موزع)
                    if (!p.contract_number && !p.composite_task_id && !p.sales_invoice_id && !p.printed_invoice_id) {
                      return {
                        contractNumber: 'رصيد فائض (غير موزع)',
                        adType: p.notes?.replace(/^توزيع على.*?- /g, '') || 'فائض سداد متبقي في حساب العميل',
                        amount: Number(p.amount) || 0,
                        total: null,
                        totalPaid: null,
                        remaining: null,
                        entityType: 'general_credit' as const,
                      };
                    }
                    
                    // Default: عقد
                    const cn = p.contract_number ? Number(p.contract_number) : null;
                    const c = cn ? contractMap[cn] : null;
                    return {
                      contractNumber: String(p.contract_number || '—'),
                      contractId: cn || undefined,
                      adType: c?.['Ad Type'] || 'لوحة إعلانية',
                      amount: Number(p.amount) || 0,
                      total: c?.Total ?? null,
                      totalPaid: c?.calculatedPaid ?? null,
                      remaining: c?.calculatedRemaining ?? null,
                      entityType: 'contract' as const,
                    };
                  });

                  // ✅ حساب المتبقي الإجمالي للعميل بنفس منطق صفحة العميل (بدون فلترة تاريخية)
                  let remainingDebt: number | undefined = undefined;
                  
                  if (customerData.id) {
                    const { calculateCustomerFinancials } = await import('@/hooks/useCustomerFinancials');
                    
                    // جلب كل البيانات الحالية (مطابق لـ useCustomerFinancials)
                    const [contractsRes, paymentsRes, salesRes, printedRes, purchaseRes, discountsRes, compositeRes, printTasksRes, cutoutTasksRes, customerRes] = await Promise.all([
                      supabase.from('Contract').select('*').eq('customer_id', customerData.id),
                      supabase.from('customer_payments').select('*').eq('customer_id', customerData.id),
                      supabase.from('sales_invoices').select('*').eq('customer_id', customerData.id),
                      supabase.from('printed_invoices').select('*').eq('customer_id', customerData.id),
                      supabase.from('purchase_invoices').select('*').eq('customer_id', customerData.id),
                      supabase.from('customer_general_discounts').select('*').eq('customer_id', customerData.id).eq('status', 'active'),
                      supabase.from('composite_tasks').select('*').eq('customer_id', customerData.id),
                      supabase.from('print_tasks').select('id, invoice_id, is_composite, installation_task_id, composite_task_id').eq('customer_id', customerData.id),
                      supabase.from('cutout_tasks').select('id, invoice_id, is_composite, installation_task_id').eq('customer_id', customerData.id),
                      supabase.from('customers').select('linked_friend_company_id').eq('id', customerData.id).maybeSingle()
                    ]);
                    
                    const contracts = contractsRes.data || [];
                    
                    // حساب إيجارات الشركات الصديقة بنفس مفتاح useCustomerFinancials (فقط إذا كان العميل مرتبك بشركة صديقة)
                    let friendRentalTotal = 0;
                    if (customerRes.data?.linked_friend_company_id) {
                      for (const contract of contracts) {
                        const friendData = (contract as any).friend_rental_data;
                        if (friendData && typeof friendData === 'object') {
                          const entries = Array.isArray(friendData) ? friendData : Object.values(friendData);
                          for (const entry of entries as any[]) {
                            if (entry && typeof entry.rental_cost === 'number') {
                              friendRentalTotal += entry.rental_cost;
                            } else if (entry && typeof entry.friendRentalCost === 'number') {
                              friendRentalTotal += entry.friendRentalCost;
                            } else if (entry && typeof entry.friend_rental_cost === 'number') {
                              friendRentalTotal += entry.friend_rental_cost;
                            }
                          }
                        }
                      }
                    }
                    
                    const financials = calculateCustomerFinancials(
                      contracts,
                      paymentsRes.data || [],
                      salesRes.data || [],
                      filterCompositeRelatedPrintedInvoices(printedRes.data || [], compositeRes.data || [], printTasksRes.data || [], cutoutTasksRes?.data || []),
                      purchaseRes.data || [],
                      discountsRes.data || [],
                      compositeRes.data || [],
                      friendRentalTotal
                    );
                    
                    remainingDebt = financials.remainingDebt;
                  } else if (typeof firstPaymentData.remaining_debt === 'number') {
                    remainingDebt = firstPaymentData.remaining_debt;
                  }

                  // ✅ بناء "مصدر المقايضة": عنوان فاتورة المشتريات أو نوع إعلان العقد المُستخدم
                  let barterSource = '';
                  try {
                    const isBarter = (m?: string | null) =>
                      !!m && (m.includes('مقايضة') || m === 'barter');

                    // 1) فواتير المشتريات المستخدمة في المقايضة
                    const purchaseIds = Array.from(new Set(
                      groupedPayments
                        .filter(p => (p as any).purchase_invoice_id)
                        .map(p => String((p as any).purchase_invoice_id))
                    ));
                    const purchaseTitles: string[] = [];
                    if (purchaseIds.length > 0) {
                      const { data: piData } = await supabase
                        .from('purchase_invoices')
                        .select('id, invoice_number, invoice_name')
                        .in('id', purchaseIds);
                      (piData || []).forEach((pi: any) => {
                        const title = (pi.invoice_name && String(pi.invoice_name).trim())
                          || (pi.invoice_number ? `#${pi.invoice_number}` : '');
                        if (title) purchaseTitles.push(`فاتورة مشتريات: ${title}`);
                      });
                    }

                    // 2) لوحات عقد مستخدمة كمقايضة إيجار → نوع إعلان العقد المصدر
                    // المصدر يُحفظ ضمن الملاحظات بصيغة "مقايضة من إيجار لوحة: <الاسم>"
                    // نستخرج اسم اللوحة ونبحث عن نوع إعلان العقد المرتبط بها
                    const rentalPayments = groupedPayments.filter(
                      p => isBarter(p.method) && (p as any).purchase_invoice_id == null
                    );
                    const billboardNames = Array.from(new Set(
                      rentalPayments
                        .map(p => {
                          const m = (p.notes || '').match(/لوحة[:\s]+([^\n،,•]+)/);
                          return m ? m[1].trim() : '';
                        })
                        .filter(Boolean)
                    ));
                    const rentalSources: string[] = [];
                    if (billboardNames.length > 0) {
                      const { data: bbs } = await supabase
                        .from('billboards')
                        .select('Billboard_Name, Contract_Number')
                        .in('Billboard_Name', billboardNames);
                      const contractNums = Array.from(new Set(
                        (bbs || [])
                          .map((b: any) => Number(b.Contract_Number))
                          .filter((n: number) => !!n && !Number.isNaN(n))
                      ));
                      const adTypeByContract: Record<number, string> = {};
                      if (contractNums.length > 0) {
                        const { data: srcContracts } = await supabase
                          .from('Contract')
                          .select('Contract_Number, "Ad Type"')
                          .in('Contract_Number', contractNums);
                        (srcContracts || []).forEach((c: any) => {
                          adTypeByContract[Number(c.Contract_Number)] = c['Ad Type'] || '';
                        });
                      }
                      // اجمع لكل عقد مصدر: "عقد X - <نوع الإعلان>"
                      const labelSet = new Set<string>();
                      (bbs || []).forEach((b: any) => {
                        const cn = Number(b.Contract_Number);
                        if (!cn) return;
                        const adType = adTypeByContract[cn];
                        labelSet.add(
                          adType
                            ? `لوحات عقد ${cn} - ${adType}`
                            : `لوحات عقد ${cn}`
                        );
                      });
                      rentalSources.push(...labelSet);
                      // fallback إذا لم نتمكّن من الربط
                      if (rentalSources.length === 0) {
                        rentalSources.push(...billboardNames.map(n => `لوحة: ${n}`));
                      }
                    } else {
                      // لا توجد لوحات مُستخرجة، نستخدم الملاحظات كما هي
                      rentalSources.push(
                        ...Array.from(new Set(
                          rentalPayments.map(p => (p.notes || '').trim()).filter(Boolean)
                        ))
                      );
                    }

                    const parts = [...purchaseTitles, ...rentalSources];
                    barterSource = parts.join(' • ');
                  } catch (e) {
                    console.warn('barter_source build failed:', e);
                  }

                  await printReceipt({
                    payment: {
                      id: firstPaymentData.id,
                      amount: totalAmount,
                      paid_at: firstPaymentData.paid_at,
                      method: firstPaymentData.method || 'نقدي',
                      reference: firstPaymentData.reference || undefined,
                      notes: firstPaymentData.notes || undefined,
                      contract_number: null,
                      collector_name: firstPaymentData.collector_name || undefined,
                      receiver_name: firstPaymentData.receiver_name || undefined,
                      delivery_location: firstPaymentData.delivery_location || undefined,
                      source_bank: firstPaymentData.source_bank || undefined,
                      destination_bank: firstPaymentData.destination_bank || undefined,
                      transfer_reference: firstPaymentData.transfer_reference || undefined,
                      transfer_image_url: firstPaymentData.transfer_image_url || undefined,
                      distributed_payment_id: firstPaymentData.distributed_payment_id || undefined,
                      barter_source: barterSource || undefined,
                    },
                    customerData: {
                      id: customerData.id,
                      name: customerData.name,
                      company: customerData.company || undefined,
                      phone: customerData.phone || undefined,
                    },
                    currency: {
                      code: 'LYD',
                      symbol: 'د.ل',
                      name: 'دينار ليبي',
                      writtenName: 'دينار ليبي',
                    },
                    distributedContracts,
                    ...(typeof remainingDebt === 'number'
                      ? { balanceInfo: { remainingBalance: remainingDebt, totalPaid: 0 } }
                      : {}),
                  });
                }}
                className="flex-1 bg-primary hover:bg-primary/90 gap-2"
                size="lg"
              >
                <FileText className="h-5 w-5" />
                طباعة إيصال موحد
              </Button>
              {onEdit && (
                <Button
                  onClick={() => {
                    onEdit();
                    onOpenChange(false);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 gap-2"
                  size="lg"
                >
                  <Edit className="h-5 w-5" />
                  تعديل الدفعة
                </Button>
              )}
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm(`هل أنت متأكد من حذف هذه الدفعة الموزعة على ${groupedPayments.length} عقود؟`)) {
                    onDelete();
                    onOpenChange(false);
                  }
                }}
                className="gap-2"
                size="lg"
              >
                <Trash2 className="h-5 w-5" />
                حذف الدفعة
              </Button>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                size="lg"
              >
                إغلاق
              </Button>
            </div>
          </div>

        {/* Dialog for Intermediary Receipt */}
        <IntermediaryReceiptPrintDialog
          open={intermediaryPrintOpen}
          onOpenChange={setIntermediaryPrintOpen}
          groupedPayments={groupedPayments}
          totalAmount={totalAmount}
          customerName={customerName}
        />

        {/* Dialog for Converting to Custody */}
        <ConvertToCustodyDialog
          open={custodyDialogOpen}
          onOpenChange={setCustodyDialogOpen}
          groupedPayments={groupedPayments}
          totalAmount={totalAmount}
          distributedPaymentId={firstPayment.distributed_payment_id || ''}
          onSuccess={() => {
            toast.success('تم التحويل إلى عهدة بنجاح - يمكنك مراجعتها في صفحة العهد المالية');
            // إعادة تحميل معلومات العهدة
            if (firstPayment.distributed_payment_id) {
              loadCustodyInfo(firstPayment.distributed_payment_id);
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
