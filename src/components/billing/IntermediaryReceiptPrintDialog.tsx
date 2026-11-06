import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import * as UIDialog from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Printer } from 'lucide-react';
import { PaymentRow } from './BillingTypes';
import { getMergedInvoiceStylesAsync } from '@/hooks/useInvoiceSettingsSync';
import { renderUnifiedDocument, escHtml, docMoney, docDate } from '@/lib/unifiedDocument';

interface IntermediaryReceiptPrintDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupedPayments: PaymentRow[];
  totalAmount: number;
  customerName: string;
}

export default function IntermediaryReceiptPrintDialog({
  open,
  onOpenChange,
  groupedPayments,
  totalAmount,
  customerName
}: IntermediaryReceiptPrintDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [customerData, setCustomerData] = useState<{
    name: string;
    company: string | null;
    phone: string | null;
  } | null>(null);

  useEffect(() => {
    if (open && groupedPayments.length > 0) {
      loadCustomerData();
    }
  }, [open, groupedPayments]);

  const loadCustomerData = async () => {
    try {
      const customerId = groupedPayments[0]?.customer_id;
      
      if (customerId) {
        const { data, error } = await supabase
          .from('customers')
          .select('name, company, phone')
          .eq('id', customerId)
          .single();
        
        if (!error && data) {
          setCustomerData({
            name: data.name || customerName,
            company: data.company,
            phone: data.phone
          });
          return;
        }
      }
      
      setCustomerData({
        name: customerName,
        company: null,
        phone: null
      });
      
    } catch (error) {
      console.error('Error loading customer data:', error);
      setCustomerData({
        name: customerName,
        company: null,
        phone: null
      });
    }
  };

  const handlePrintReceipt = async () => {
    if (!groupedPayments.length || !customerData) {
      toast.error('لا توجد بيانات للطباعة');
      return;
    }

    setIsGenerating(true);
    
    try {
      // ✅ جلب إعدادات القالب الموحدة
      const styles = await getMergedInvoiceStylesAsync('receipt');

      const testWindow = window.open('', '_blank', 'width=1,height=1');
      if (!testWindow || testWindow.closed || typeof testWindow.closed === 'undefined') {
        toast.error('يرجى السماح بالنوافذ المنبثقة في المتصفح لتمكين الطباعة');
        setIsGenerating(false);
        return;
      }
      testWindow.close();

      const firstPayment = groupedPayments[0];
      const receiptDate = new Date().toLocaleDateString('ar-LY');
      const receiptNumber = `INT-${Date.now()}`;
      
      const paymentDate = firstPayment.paid_at 
        ? new Date(firstPayment.paid_at).toLocaleDateString('ar-LY')
        : receiptDate;

      const collectorName = firstPayment.collector_name || 'غير محدد';
      const receiverName = firstPayment.receiver_name || 'غير محدد';
      const deliveryLocation = firstPayment.delivery_location || 'غير محدد';
      const paymentMethod = firstPayment.method || 'نقدي';
      const paymentNotes = firstPayment.notes || '';

      // حساب العمولات
      const totalIntermediaryCommission = groupedPayments.reduce((sum, p) => 
        sum + (Number(p.intermediary_commission) || 0), 0
      );
      const totalTransferFee = groupedPayments.reduce((sum, p) => 
        sum + (Number(p.transfer_fee) || 0), 0
      );
      const netAmount = totalAmount - totalIntermediaryCommission - totalTransferFee;
      const hasCommissions = totalIntermediaryCommission > 0 || totalTransferFee > 0;

      // ✅ المستند الموحد — نفس قالب كل الإيصالات، والألوان من إعدادات الطباعة (إيصال الدفع)
      const collectionDate = firstPayment.collection_date ? docDate(firstPayment.collection_date) : paymentDate;
      const htmlContent = renderUnifiedDocument(styles, {
        title: 'إيصال تسليم وسيط',
        subtitle: 'بيان عملية التحصيل عبر وسيط وتسليمها',
        pageTitle: `إيصال وسيط ${receiptNumber} - ${customerName}`,
        info: [
          { label: 'العميل', value: `${escHtml(customerData.name)}${customerData.company || customerData.phone ? `<div class="os-muted">${escHtml([customerData.company, customerData.phone].filter(Boolean).join(' · '))}</div>` : ''}` },
          { label: 'رقم الإيصال', value: `<bdi>${receiptNumber}</bdi>` },
          { label: 'تاريخ القبض', value: collectionDate },
          { label: 'المحصل (المستلم من الزبون)', value: escHtml(collectorName) },
          { label: 'المسلم له', value: escHtml(receiverName) },
          { label: 'مكان التسليم', value: escHtml(deliveryLocation) },
          { label: 'نوع الدفع', value: escHtml(paymentMethod) },
        ],
        total: { label: hasCommissions ? 'الصافي المسلم' : 'المبلغ المقبوض من الزبون', value: docMoney(hasCommissions ? netAmount : totalAmount) },
        sections: [{
          title: `تفاصيل الدفعة (${groupedPayments.length})`,
          aside: docMoney(totalAmount),
          columns: [
            { key: 'ref', header: 'المرجع', width: '25%' },
            { key: 'amount', header: 'المبلغ', width: '20%' },
            { key: 'notes', header: 'ملاحظات', align: 'right' },
          ],
          rows: groupedPayments.map(p => ({
            ref: p.contract_number ? `عقد #${p.contract_number}` : '—',
            amount: `<span class="os-amt">${docMoney(Number(p.amount) || 0)}</span>`,
            notes: escHtml(p.notes || '—'),
          })),
        }],
        summary: hasCommissions ? [
          { label: 'المبلغ المقبوض من الزبون', value: docMoney(totalAmount) },
          ...(totalIntermediaryCommission > 0 ? [{ label: 'عمولة الوسيط', value: `− ${docMoney(totalIntermediaryCommission)}` }] : []),
          ...(totalTransferFee > 0 ? [{ label: 'عمولة التحويل', value: `− ${docMoney(totalTransferFee)}` }] : []),
          { label: 'الصافي المسلم', value: docMoney(netAmount) },
        ] : undefined,
        notes: paymentNotes,
        signatures: [{ label: 'توقيع المحصل', value: collectorName }, { label: 'توقيع المستلم', value: receiverName }, { label: 'الختم' }],
      });

      const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
      showPrintPreview(htmlContent, `إيصال وسيط ${receiptNumber} - ${customerName}`, 'billing-receipts');

      setIsGenerating(false);
      toast.success('تم فتح نافذة الطباعة');
      onOpenChange(false);

    } catch (error: any) {
      console.error('Error printing receipt:', error);
      toast.error('حدث خطأ أثناء الطباعة');
      setIsGenerating(false);
    }
  };

  if (groupedPayments.length === 0) return null;

  return (
    <UIDialog.Dialog open={open} onOpenChange={onOpenChange}>
      <UIDialog.DialogContent className="max-w-md" dir="rtl">
        <UIDialog.DialogHeader>
          <UIDialog.DialogTitle className="text-xl font-bold text-primary">
            طباعة إيصال الوسيط المحصل
          </UIDialog.DialogTitle>
        </UIDialog.DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
            <div className="text-sm text-muted-foreground mb-1">المبلغ الإجمالي</div>
            <div className="text-3xl font-bold text-primary">
              {totalAmount.toLocaleString('ar-LY')} د.ل
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            عدد العقود: {groupedPayments.length}
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button
              onClick={handlePrintReceipt}
              disabled={isGenerating}
              className="flex-1 bg-primary hover:bg-primary/90 gap-2"
              size="lg"
            >
              <Printer className="h-5 w-5" />
              {isGenerating ? 'جاري الإعداد...' : 'طباعة الإيصال'}
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
      </UIDialog.DialogContent>
    </UIDialog.Dialog>
  );
}
