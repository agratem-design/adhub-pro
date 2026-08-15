import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import * as UIDialog from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Printer } from 'lucide-react';
import { PaymentRow } from './BillingTypes';
import { getMergedInvoiceStylesAsync, hexToRgba } from '@/hooks/useInvoiceSettingsSync';

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
      const baseUrl = window.location.origin;
      const logoUrl = styles.logoPath || '/logofaresgold.svg';
      const fullLogoUrl = logoUrl.startsWith('http') ? logoUrl : `${baseUrl}${logoUrl}`;

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

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>إيصال تسليم وسيط - ${receiptNumber}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            html, body {
              width: 210mm;
              height: 297mm;
              font-family: 'Noto Sans Arabic', Arial, sans-serif;
              direction: rtl;
              text-align: right;
              background: white;
              color: #000;
              font-size: 11px;
              line-height: 1.3;
              overflow: hidden;
            }
            
            .receipt-container {
              width: 210mm;
              height: 297mm;
              padding: 12mm;
              display: flex;
              flex-direction: column;
            }
            
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 20px;
              border-bottom: 2px solid #000;
              padding-bottom: 15px;
            }
            
            .receipt-info {
              text-align: left;
              direction: ltr;
              order: 2;
            }
            
            .receipt-title {
              font-size: 24px;
              font-weight: bold;
              color: #000;
              margin-bottom: 8px;
            }
            
            .receipt-subtitle {
              font-size: 13px;
              color: #666;
              font-weight: bold;
              margin-bottom: 8px;
            }
            
            .receipt-details {
              font-size: 11px;
              color: #666;
              line-height: 1.5;
            }
            
            .company-info {
              display: flex;
              flex-direction: column;
              align-items: flex-end;
              text-align: right;
              order: 1;
            }
            
            .company-logo {
              max-width: 400px;
              height: auto;
              object-fit: contain;
              margin-bottom: 5px;
            }
            
            .company-details {
              font-size: 12px;
              color: #666;
              line-height: 1.6;
            }
            
            .intermediary-section {
              background: #f8f9fa;
              padding: 18px;
              border-radius: 8px;
              margin-bottom: 18px;
              border: 2px solid #000;
            }
            
            .section-title {
              font-size: 16px;
              font-weight: bold;
              color: #000;
              margin-bottom: 12px;
              text-align: center;
            }
            
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
            }
            
            .info-box {
              background: white;
              padding: 8px;
              border-radius: 4px;
              border: 1px solid #ddd;
            }
            
            .info-label {
              font-size: 11px;
              color: #000;
              font-weight: bold;
              margin-bottom: 4px;
            }
            
            .info-value {
              font-size: 12px;
              color: #000;
            }
            
            .customer-info {
              background: #f8f9fa;
              padding: 15px;
              border-radius: 0;
              margin-bottom: 18px;
              border-right: 4px solid #000;
            }
            
            .customer-title {
              font-size: 14px;
              font-weight: bold;
              margin-bottom: 8px;
              color: #000;
            }
            
            .customer-details {
              font-size: 12px;
              line-height: 1.5;
            }
            
            .payment-details {
              background: #f8f9fa;
              padding: 18px;
              border-radius: 8px;
              margin-bottom: 18px;
              border: 2px solid #000;
            }
            
            .payment-title {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 12px;
              color: #000;
              text-align: center;
            }
            
            .payment-info {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
              font-size: 12px;
            }
            
            .payment-info div {
              padding: 8px;
              background: white;
              border-radius: 4px;
              border: 1px solid #ddd;
            }
            
            .payment-info strong {
              color: #000;
              font-weight: bold;
            }
            
            .contracts-table {
              margin: 20px 0;
              border: 2px solid #000;
              border-radius: 0;
              overflow: hidden;
            }
            
            .contracts-table table {
              width: 100%;
              border-collapse: collapse;
            }
            
            .contracts-table th {
              background: #000;
              color: white;
              padding: 12px;
              text-align: center;
              font-weight: bold;
            }
            
            .contracts-table td {
              padding: 10px;
              text-align: center;
              border-bottom: 1px solid #ddd;
            }
            
            .contracts-table tr:last-child td {
              border-bottom: none;
            }
            
            .amount-section {
              margin-top: 18px;
              border-top: 2px solid #000;
              padding-top: 15px;
            }
            
            .amount-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 12px 0;
              font-size: 18px;
              font-weight: bold;
              background: #f8f9fa;
              color: #000;
              padding: 15px;
              border-radius: 4px;
              margin-top: 8px;
              border: 1px solid #ddd;
            }
            
            .amount-row.total {
              background: #000;
              color: white;
              font-size: 20px;
              padding: 18px;
              border-radius: 0;
              margin-top: 12px;
              border: 2px solid #000;
            }
            
            .amount-row.deduction {
              background: #fff3cd;
              color: #856404;
              border: 1px solid #ffc107;
            }
            
            .amount-row.net {
              background: #d4edda;
              color: #155724;
              font-size: 20px;
              border: 2px solid #28a745;
            }
            
            .currency {
              font-weight: bold;
              color: #FFD700;
              text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
            }
            
            .signature-section {
              margin-top: 25px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            
            .signature-box {
              text-align: center;
              border-top: 2px solid #000;
              padding-top: 8px;
              min-width: 120px;
            }
            
            .signature-name {
              margin-top: 8px;
              font-size: 12px;
              color: #666;
              font-weight: normal;
            }
            
            .footer {
              margin-top: auto;
              text-align: center;
              font-size: 11px;
              color: #666;
              border-top: 1px solid #ddd;
              padding-top: 15px;
            }
            
            @media print {
              html, body {
                width: 210mm !important;
                height: 297mm !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                color-adjust: exact;
              }
              
              .receipt-container {
                width: 210mm !important;
                height: 297mm !important;
                padding: 12mm !important;
              }
              
              @page {
                size: A4 portrait;
                margin: 0 !important;
              }
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
                <div class="receipt-title">إيصال تسليم وسيط</div>
                <div class="receipt-details">
                  رقم الإيصال: ${receiptNumber}<br>
                  تاريخ القبض: ${firstPayment.collection_date ? new Date(firstPayment.collection_date).toLocaleDateString('ar-LY') : paymentDate}<br>
                  العملة: دينار ليبي
                </div>
              </div>
            </div>
            
            <div class="payment-details">
              <div class="payment-title">بيانات عملية التحصيل والتسليم</div>
              <div class="payment-info">
                <div>
                  <strong>المحصل (المستلم من الزبون):</strong><br>
                  ${collectorName}
                </div>
                <div>
                  <strong>المسلم له (المدير):</strong><br>
                  ${receiverName}
                </div>
                <div>
                  <strong>مكان التسليم:</strong><br>
                  ${deliveryLocation}
                </div>
                <div>
                  <strong>نوع الدفع:</strong><br>
                  ${paymentMethod}
                </div>
                ${paymentNotes ? `
                <div style="grid-column: 1 / -1;">
                  <strong>ملاحظات:</strong><br>
                  ${paymentNotes}
                </div>
                ` : ''}
              </div>
            </div>
            
            <div class="customer-info">
              <div class="customer-title">بيانات العميل</div>
              <div class="customer-details">
                <strong>الاسم:</strong> ${customerData.name}<br>
                ${customerData.company ? `<strong>الشركة:</strong> ${customerData.company}<br>` : ''}
                ${customerData.phone ? `<strong>الهاتف:</strong> ${customerData.phone}<br>` : ''}
              </div>
            </div>
            
            <div class="contracts-table">
              <table>
                <thead>
                  <tr>
                    <th>رقم العقد</th>
                    <th>المبلغ</th>
                    <th>ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  ${groupedPayments.map(payment => `
                    <tr>
                      <td><strong>عقد رقم ${payment.contract_number}</strong></td>
                      <td><strong>${(Number(payment.amount) || 0).toLocaleString('ar-LY')} د.ل</strong></td>
                      <td>${payment.notes || '—'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            
            <div class="amount-section">
              <div class="amount-row total">
                <span>المبلغ الإجمالي المقبوض من الزبون:</span>
                <span>${totalAmount.toLocaleString('ar-LY')} <span class="currency">د.ل</span></span>
              </div>
              
              ${hasCommissions ? `
                ${totalIntermediaryCommission > 0 ? `
                  <div class="amount-row deduction">
                    <span>عمولة الوسيط:</span>
                    <span>${totalIntermediaryCommission.toLocaleString('ar-LY')} د.ل</span>
                  </div>
                ` : ''}
                
                ${totalTransferFee > 0 ? `
                  <div class="amount-row deduction">
                    <span>عمولة التحويل:</span>
                    <span>${totalTransferFee.toLocaleString('ar-LY')} د.ل</span>
                  </div>
                ` : ''}
                
                <div class="amount-row net">
                  <span>الصافي المُسَلَّم للمدير:</span>
                  <span>${netAmount.toLocaleString('ar-LY')} <span class="currency">د.ل</span></span>
                </div>
              ` : `
                <div class="amount-row net">
                  <span>الصافي المُسَلَّم للمدير:</span>
                  <span>${totalAmount.toLocaleString('ar-LY')} <span class="currency">د.ل</span></span>
                </div>
              `}
            </div>
            
            <div class="signature-section">
              <div class="signature-box">
                <div class="signature-name">توقيع المحصل<br>${collectorName}</div>
              </div>
              <div class="signature-box">
                <div class="signature-name">توقيع المستلم (المدير)<br>${receiverName}</div>
              </div>
            </div>
            
            <div class="footer">
              <p>هذا الإيصال يثبت تسليم المبلغ من المحصل إلى المدير</p>
              <p>تم الإصدار بتاريخ: ${receiptDate}</p>
            </div>
          </div>
        </body>
        </html>
      `;

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
