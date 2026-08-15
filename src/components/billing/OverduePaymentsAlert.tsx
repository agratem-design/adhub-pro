import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { computeOverdueData } from '@/utils/overdueCalculations';
import { AlertCircle, Clock, DollarSign, FileText, MessageCircle, Loader2 } from 'lucide-react';
import { formatAmount } from '@/lib/formatUtils';
import { showPrintPreview } from '@/components/print/PrintPreviewDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useSendWhatsApp } from '@/hooks/useSendWhatsApp';

interface OverdueInstallment {
  contractNumber: number;
  customerName: string;
  customerId: string | null;
  installmentAmount: number;
  dueDate: string;
  description: string;
  daysOverdue: number;
}

export function OverduePaymentsAlert() {
  const [overduePayments, setOverduePayments] = useState<OverdueInstallment[]>([]);
  const [loading, setLoading] = useState(true);
  const { sendMessage } = useSendWhatsApp();
  const [sendingFor, setSendingFor] = useState<number | null>(null);

  useEffect(() => {
    loadOverduePayments();
  }, []);

  const loadOverduePayments = async () => {
    try {
      setLoading(true);
      
      const { data: contracts, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", customer_id, installments_data, "Total", "Contract Date"');

      if (error) {
        console.error('Error loading contracts:', error);
        return;
      }

      // Fetch all customer payments
      const { data: paymentsData } = await supabase
        .from('customer_payments')
        .select('contract_number, customer_id, customer_name, amount, paid_at, entry_type, sales_invoice_id, printed_invoice_id, composite_task_id')
        .in('entry_type', ['payment', 'receipt', 'account_payment']);

      const payments = paymentsData || [];
      const allPayments = payments.filter((p: any) => p.contract_number !== null);
      const accountPayments = payments.filter((p: any) => 
        p.contract_number === null && 
        p.sales_invoice_id === null && 
        p.printed_invoice_id === null && 
        p.composite_task_id === null
      );

      // Compute using unified utility
      const { overdueInstallments } = computeOverdueData(
        contracts || [],
        allPayments,
        accountPayments
      );

      overdueInstallments.sort((a, b) => b.installmentAmount - a.installmentAmount);
      setOverduePayments(overdueInstallments.slice(0, 10));
    } catch (error) {
      console.error('Error loading overdue payments:', error);
      toast.error('خطأ في تحميل الدفعات المتأخرة');
    } finally {
      setLoading(false);
    }
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
    showPrintPreview(html, `إشعار تأخير - عقد ${payment.contractNumber}`, 'billing-overdue');
  };

  const sendWhatsAppReminder = async (payment: OverdueInstallment) => {
    setSendingFor(payment.contractNumber);
    try {
      let phone = '';
      if (payment.customerId) {
        const { data: customer } = await supabase
          .from('customers')
          .select('phone')
          .eq('id', payment.customerId)
          .maybeSingle();
        phone = customer?.phone || '';
      }
      if (!phone) {
        const { data: customer } = await supabase
          .from('customers')
          .select('phone')
          .eq('name', payment.customerName)
          .maybeSingle();
        phone = customer?.phone || '';
      }
      if (!phone) {
        toast.error('لا يوجد رقم هاتف مسجل لهذا العميل');
        return;
      }

      const message = `مرحباً ${payment.customerName},\nنود تذكيركم بوجود دفعة متأخرة بمبلغ ${formatAmount(payment.installmentAmount)} د.ل على عقد رقم #${payment.contractNumber}.\nعدد أيام التأخير: ${payment.daysOverdue} يوم.\nنرجو التواصل معنا لتسوية المبلغ.\nشكراً لتعاونكم.`;

      await sendMessage({ phone, message });
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
    } finally {
      setSendingFor(null);
    }
  };

  if (loading) {
    return (
      <Card className="border-warning">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-5 w-5 animate-spin" />
            <span>جاري تحميل الدفعات المتأخرة...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (overduePayments.length === 0) {
    return (
      <Card className="border-success">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-green-600">
            <DollarSign className="h-5 w-5" />
            <span className="font-medium">لا توجد دفعات متأخرة! جميع الدفعات محدثة.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-destructive bg-gradient-to-br from-destructive/5 to-destructive/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-6 w-6" />
          دفعات متأخرة ({overduePayments.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {overduePayments.map((payment, index) => (
            <Card
              key={`${payment.contractNumber}-${index}`}
              className="border-destructive/30 bg-background hover:shadow-lg transition-all hover:-translate-y-1"
            >
              <CardContent className="p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="destructive" className="text-xs">
                      {payment.daysOverdue} يوم
                    </Badge>
                    <span className="font-bold text-foreground">#{payment.contractNumber}</span>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="font-semibold text-foreground truncate" title={payment.customerName}>
                      {payment.customerName}
                    </div>
                    <div className="text-destructive font-bold text-lg">
                      {formatAmount(payment.installmentAmount)} د.ل
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(payment.dueDate).toLocaleDateString('ar-LY')}
                    </div>
                    <div className="text-xs text-muted-foreground truncate" title={payment.description}>
                      {payment.description}
                    </div>
                  </div>
                  
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => printOverdueNotice(payment)}
                      className="flex-1 text-xs"
                    >
                      <FileText className="h-3 w-3 ml-1" />
                      طباعة
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => sendWhatsAppReminder(payment)}
                      disabled={sendingFor === payment.contractNumber}
                      className="flex-1 text-xs border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                    >
                      {sendingFor === payment.contractNumber ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <MessageCircle className="h-3 w-3 ml-1" />
                      )}
                      واتساب
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
