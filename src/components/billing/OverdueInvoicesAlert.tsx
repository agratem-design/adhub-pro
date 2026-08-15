import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Clock, FileText, Receipt, MessageCircle, Loader2 } from 'lucide-react';
import { formatAmount } from '@/lib/formatUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useSendWhatsApp } from '@/hooks/useSendWhatsApp';
import { filterCompositeRelatedPrintedInvoices } from './BillingUtils';

interface OverdueInvoice {
  id: string;
  invoiceNumber: string;
  invoiceName: string | null;
  customerName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  invoiceDate: string;
  daysOverdue: number;
  type: 'sales' | 'print';
  notes?: string | null;
  invoiceType?: string | null;
  contractNumber?: number;
  contractNumbers?: string;
  adTypes?: string[];
}

export function OverdueInvoicesAlert() {
  const [overdueInvoices, setOverdueInvoices] = useState<OverdueInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const { sendMessage } = useSendWhatsApp();
  const [sendingFor, setSendingFor] = useState<string | null>(null);

  useEffect(() => {
    loadOverdueInvoices();
  }, []);

  const loadOverdueInvoices = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const overdue: OverdueInvoice[] = [];

      const { data: salesInvoices, error: salesErr } = await supabase
        .from('sales_invoices')
        .select('id, invoice_number, invoice_name, customer_name, total_amount, paid_amount, remaining_amount, invoice_date, paid, notes')
        .eq('paid', false);

      if (salesErr) {
        console.error('Error loading sales invoices:', salesErr);
      } else {
        for (const inv of salesInvoices || []) {
          const remaining = (inv.remaining_amount != null) 
            ? inv.remaining_amount 
            : (inv.total_amount - inv.paid_amount);
          if (remaining <= 0) continue;

          const invoiceDate = new Date(inv.invoice_date);
          const diffDays = Math.ceil((today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (diffDays > 15) {
            overdue.push({
              id: inv.id,
              invoiceNumber: inv.invoice_number,
              invoiceName: inv.invoice_name,
              customerName: inv.customer_name,
              totalAmount: inv.total_amount,
              paidAmount: inv.paid_amount,
              remainingAmount: remaining,
              invoiceDate: inv.invoice_date,
              daysOverdue: diffDays,
              type: 'sales',
              notes: inv.notes,
            });
          }
        }
      }

      const [printInvoicesRes, compositeTasksRes, printTasksRes, cutoutTasksRes] = await Promise.all([
        supabase
          .from('printed_invoices')
          .select('id, invoice_number, customer_name, total_amount, paid_amount, invoice_date, paid, printer_name, invoice_type, notes, contract_number, contract_numbers')
          .eq('paid', false),
        supabase
          .from('composite_tasks')
          .select('id, customer_id, customer_total, combined_invoice_id, print_task_id, discount_amount'),
        supabase
          .from('print_tasks')
          .select('id, customer_id, invoice_id, is_composite, installation_task_id, composite_task_id'),
        supabase
          .from('cutout_tasks')
          .select('id, customer_id, invoice_id, is_composite, installation_task_id')
      ]);

      if (printInvoicesRes.error) {
        console.error('Error loading print invoices:', printInvoicesRes.error);
      } else {
        const billablePrintedInvoices = filterCompositeRelatedPrintedInvoices(
          printInvoicesRes.data || [],
          compositeTasksRes.data || [],
          printTasksRes.data || [],
          cutoutTasksRes.data || []
        );

        // Fetch all unique contract numbers across print invoices to map their ad types
        const printContractNumbers = new Set<number>();
        for (const inv of billablePrintedInvoices) {
          if (inv.contract_number) printContractNumbers.add(inv.contract_number);
          if (inv.contract_numbers) {
            inv.contract_numbers.split(',').forEach((numStr: string) => {
              const num = Number(numStr.trim());
              if (num) printContractNumbers.add(num);
            });
          }
        }

        const adTypeMap = new Map<number, string>();
        if (printContractNumbers.size > 0) {
          const { data: contracts } = await supabase
            .from('Contract')
            .select('Contract_Number, "Ad Type"')
            .in('Contract_Number', Array.from(printContractNumbers));
          for (const c of contracts || []) {
            if (c['Ad Type']) adTypeMap.set(c.Contract_Number, c['Ad Type']);
          }
        }

        for (const inv of billablePrintedInvoices) {
          const total = Number(inv.total_amount) || 0;
          const paid = Number(inv.paid_amount) || 0;
          const remaining = total - paid;
          if (remaining <= 0) continue;

          const invoiceDate = new Date(inv.invoice_date);
          const diffDays = Math.ceil((today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (diffDays > 15) {
            const cNumbers = new Set<number>();
            if (inv.contract_number) cNumbers.add(inv.contract_number);
            if (inv.contract_numbers) {
              inv.contract_numbers.split(',').forEach((numStr: string) => {
                const num = Number(numStr.trim());
                if (num) cNumbers.add(num);
              });
            }
            const uniqueAdTypes = [...new Set(Array.from(cNumbers).map(num => adTypeMap.get(num)).filter(Boolean))];

            overdue.push({
              id: inv.id,
              invoiceNumber: inv.invoice_number,
              invoiceName: inv.printer_name ? `طباعة - ${inv.printer_name}` : null,
              customerName: inv.customer_name || 'غير معروف',
              totalAmount: total,
              paidAmount: paid,
              remainingAmount: remaining,
              invoiceDate: inv.invoice_date,
              daysOverdue: diffDays,
              type: 'print',
              notes: inv.notes,
              invoiceType: inv.invoice_type,
              contractNumber: inv.contract_number,
              contractNumbers: inv.contract_numbers,
              adTypes: uniqueAdTypes,
            });
          }
        }
      }

      overdue.sort((a, b) => b.remainingAmount - a.remainingAmount);
      setOverdueInvoices(overdue.slice(0, 10));
    } catch (error) {
      console.error('Error loading overdue invoices:', error);
      toast.error('خطأ في تحميل الفواتير المتأخرة');
    } finally {
      setLoading(false);
    }
  };

  const sendWhatsAppReminder = async (inv: OverdueInvoice) => {
    setSendingFor(inv.id);
    try {
      const { data: customer } = await supabase
        .from('customers')
        .select('phone')
        .eq('name', inv.customerName)
        .maybeSingle();
      
      if (!customer?.phone) {
        toast.error('لا يوجد رقم هاتف مسجل لهذا العميل');
        return;
      }

      const typeLabel = inv.type === 'sales' ? 'فاتورة مبيعات' : (
        inv.invoiceType === 'print_install' ? 'فاتورة طباعة وتركيب' :
        inv.invoiceType === 'print_only' ? 'فاتورة طباعة' :
        inv.invoiceType === 'install_only' ? 'فاتورة تركيب' :
        'فاتورة طباعة'
      );
      const contractText = inv.type === 'print' && (inv.contractNumbers || inv.contractNumber)
        ? `\nعقد/عقود رقم: ${inv.contractNumbers || inv.contractNumber}`
        : '';
      const adTypeText = inv.type === 'print' && inv.adTypes && inv.adTypes.length > 0
        ? `\nنوع الإعلان: ${inv.adTypes.join(' / ')}`
        : '';
      const nameText = inv.invoiceName ? `\nالبيان: ${inv.invoiceName}` : '';
      const notesText = inv.notes ? `\nملاحظات: ${inv.notes}` : '';

      const message = `مرحباً ${inv.customerName},\nنود تذكيركم بوجود ${typeLabel} متأخرة بمبلغ ${formatAmount(inv.remainingAmount)} د.ل (فاتورة #${inv.invoiceNumber}).${contractText}${adTypeText}${nameText}${notesText}\nعدد أيام التأخير: ${inv.daysOverdue} يوم.\nنرجو التواصل معنا لتسوية المبلغ.\nشكراً لتعاونكم.`;

      await sendMessage({ phone: customer.phone, message });
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
    } finally {
      setSendingFor(null);
    }
  };

  if (loading) {
    return (
      <Card className="border-orange-300 dark:border-orange-700">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-5 w-5 animate-spin" />
            <span>جاري تحميل الفواتير المتأخرة...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (overdueInvoices.length === 0) return null;

  return (
    <Card className="border-orange-400 dark:border-orange-600 bg-gradient-to-br from-orange-500/5 to-amber-500/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400 text-base">
          <Receipt className="h-5 w-5" />
          فواتير متأخرة ({overdueInvoices.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {overdueInvoices.map((inv) => (
            <Card
              key={inv.id}
              className="border-orange-300/40 dark:border-orange-700/40 bg-background hover:shadow-lg transition-all hover:-translate-y-1"
            >
              <CardContent className="p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <Badge className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-orange-300 dark:border-orange-700">
                      {inv.daysOverdue} يوم
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {inv.type === 'sales' ? 'مبيعات' : (
                        inv.invoiceType === 'print_install' ? 'طباعة وتركيب' :
                        inv.invoiceType === 'print_only' ? 'طباعة فقط' :
                        inv.invoiceType === 'install_only' ? 'تركيب فقط' :
                        'طباعة'
                      )}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="font-semibold text-foreground truncate" title={inv.customerName}>
                      {inv.customerName}
                    </div>
                    {inv.type === 'print' && (inv.contractNumbers || inv.contractNumber) && (
                      <div className="text-xs text-purple-600 dark:text-purple-400 font-semibold">
                        {inv.contractNumbers && inv.contractNumbers.length > 0 
                          ? `عقود #${inv.contractNumbers}` 
                          : `عقد #${inv.contractNumber}`}
                        {inv.adTypes && inv.adTypes.length > 0 && (
                          <span className="mr-1 text-purple-600 dark:text-purple-400"> ({inv.adTypes.join(' / ')})</span>
                        )}
                      </div>
                    )}
                    {inv.invoiceName && (
                      <div className="text-xs text-muted-foreground truncate" title={inv.invoiceName}>
                        {inv.invoiceName}
                      </div>
                    )}
                    {inv.notes && (
                      <div className="text-[11px] text-muted-foreground/80 line-clamp-2" title={inv.notes}>
                        {inv.notes}
                      </div>
                    )}
                    <div className="text-orange-600 dark:text-orange-400 font-bold text-lg">
                      {formatAmount(inv.remainingAmount)} د.ل
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      #{inv.invoiceNumber}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(inv.invoiceDate).toLocaleDateString('ar-LY')}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => sendWhatsAppReminder(inv)}
                    disabled={sendingFor === inv.id}
                    className="w-full text-xs border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                  >
                    {sendingFor === inv.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <MessageCircle className="h-3 w-3 ml-1" />
                    )}
                    تنبيه واتساب
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
