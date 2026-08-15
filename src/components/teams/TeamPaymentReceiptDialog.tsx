import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import * as UIDialog from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Printer, X, Receipt } from 'lucide-react';
import { getMergedInvoiceStylesAsync } from '@/hooks/useInvoiceSettingsSync';
import { unifiedHeaderFooterCss, unifiedHeaderHtml, unifiedFooterHtml, formatDateForPrint } from '@/lib/unifiedInvoiceBase';
import { numberToArabicWords } from '@/lib/printUtils';

interface TeamPaymentReceiptDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  payment: {
    amount: number;
    paid_at: string;
    method?: string;
    notes?: string;
    billboards?: Array<{
      billboard_name: string;
      size: string;
      amount: number;
      contract_id: number;
    }>;
  };
  teamName: string;
}

// ✅ دالة تنسيق الأرقام العربية
const formatArabicNumber = (num: number): string => {
  if (isNaN(num) || num === null || num === undefined) return '0';
  
  const numStr = num.toString();
  const parts = numStr.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];
  
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  if (decimalPart) {
    return `${formattedInteger}.${decimalPart}`;
  }
  
  return formattedInteger;
};

export default function TeamPaymentReceiptDialog({ 
  open, 
  onOpenChange, 
  payment, 
  teamName 
}: TeamPaymentReceiptDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handlePrintReceipt = async () => {
    if (!payment) {
      toast.error('لا توجد بيانات دفعة للطباعة');
      return;
    }

    setIsGenerating(true);
    
    try {
      // جلب إعدادات القالب المحفوظة
      const styles = await getMergedInvoiceStylesAsync('receipt');
      const baseUrl = window.location.origin;
      const logoUrl = styles.logoPath || '/logofaresgold.svg';
      const fullLogoUrl = logoUrl.startsWith('http') ? logoUrl : `${baseUrl}${logoUrl}`;

      // No popup test needed

      const receiptDate = formatDateForPrint(new Date().toISOString(), styles.showHijriDate);
      const receiptNumber = `TEAM-${Date.now()}`;
      
      const paymentDate = payment.paid_at 
        ? formatDateForPrint(payment.paid_at, styles.showHijriDate)
        : receiptDate;

      const billboardsTable = payment.billboards && payment.billboards.length > 0 
        ? `
          <table class="billboards-table">
            <thead>
              <tr>
                <th>#</th>
                <th>اللوحة</th>
                <th>الحجم</th>
                <th>رقم العقد</th>
                <th>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              ${payment.billboards.map((b, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${b.billboard_name}</td>
                  <td>${b.size}</td>
                  <td>${b.contract_id}</td>
                  <td>${formatArabicNumber(b.amount)} د.ل</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `
        : '';

      const metaLinesHtml = `
        <div><strong>رقم الإيصال:</strong> ${receiptNumber}</div>
        <div><strong>التاريخ:</strong> ${receiptDate}</div>
        <div><strong>العملة:</strong> دينار ليبي</div>
      `;

      const headerHtml = unifiedHeaderHtml({
        styles,
        fullLogoUrl,
        metaLinesHtml,
        titleAr: 'إيصال فريق',
        titleEn: 'TEAM PAYMENT'
      });

      const footerHtml = unifiedFooterHtml(styles, 'صفحة 1 من 1');

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>إيصال سداد فرقة التركيب رقم ${receiptNumber}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
            @font-face { font-family: 'Manrope'; src: url('${baseUrl}/Manrope-Bold.otf') format('opentype'); font-weight: 700; }
            
            * { margin: 0; padding: 0; box-sizing: border-box; }
            
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
              min-height: 297mm;
              padding: 12mm;
              display: flex;
              flex-direction: column;
            }
            
            ${unifiedHeaderFooterCss(styles)}
            
            .team-info {
              background: ${styles.primaryColor}10;
              padding: 15px;
              margin-bottom: 18px;
              border-right: 4px solid ${styles.primaryColor};
            }
            
            .team-title {
              font-size: 14px;
              font-weight: bold;
              margin-bottom: 8px;
              color: ${styles.primaryColor};
            }
            
            .team-details {
              font-size: 14px;
              line-height: 1.5;
              font-weight: bold;
              color: ${styles.secondaryColor};
            }
            
            .payment-details {
              background: ${styles.primaryColor}08;
              padding: 18px;
              border-radius: 8px;
              margin-bottom: 18px;
              border: 2px solid ${styles.primaryColor};
            }
            
            .payment-title {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 12px;
              color: ${styles.primaryColor};
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
              border: ${styles.tableBorderWidth || 1}px ${styles.tableBorderStyle || 'solid'} ${styles.tableBorderColor};
            }
            
            .payment-info strong {
              color: ${styles.primaryColor};
              font-weight: bold;
            }
            
            .billboards-table {
              width: 100%;
              border-collapse: collapse;
              margin: 15px 0;
              font-size: 11px;
            }
            
            .billboards-table th, .billboards-table td {
              border: ${styles.tableBorderWidth || 1}px ${styles.tableBorderStyle || 'solid'} ${styles.tableBorderColor};
              padding: 8px;
              text-align: center;
            }
            
            .billboards-table th {
              background: ${styles.primaryColor}15;
              font-weight: bold;
              color: ${styles.primaryColor};
            }
            
            .billboards-table tr:nth-child(even) { background: #f9fafb; }
            
            .amount-section {
              margin-top: 18px;
              border-top: 2px solid ${styles.primaryColor};
              padding-top: 15px;
            }
            
            .amount-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 20px;
              font-weight: bold;
              background: ${styles.primaryColor};
              color: white;
              padding: 18px;
              margin-top: 12px;
            }
            
            .currency { font-weight: bold; color: #FFD700; text-shadow: 1px 1px 2px rgba(0,0,0,0.3); }
            
            .amount-words {
              margin-top: 12px;
              font-size: 12px;
              color: ${styles.customerSectionTextColor};
              text-align: center;
              font-style: italic;
            }
            
            .signature-section {
              margin-top: 25px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            
            .signature-box {
              text-align: center;
              border-top: 2px solid ${styles.primaryColor};
              padding-top: 8px;
              min-width: 120px;
            }
            
            .signature-name {
              margin-top: 8px;
              font-size: 12px;
              color: ${styles.customerSectionTextColor};
              font-weight: normal;
            }
            
            .content-area { flex: 1; }
            
            @media print {
              html, body { width: 210mm !important; height: 297mm !important; margin: 0 !important; padding: 0 !important; }
              @page { size: A4 portrait; margin: 0 !important; }
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            ${headerHtml}
            
            <div class="content-area">
              <div class="team-info">
                <div class="team-title">بيانات الفرقة</div>
                <div class="team-details">${teamName}</div>
              </div>
              
              <div class="payment-details">
                <div class="payment-title">تفاصيل السداد</div>
                <div class="payment-info">
                  <div>
                    <strong>تاريخ السداد:</strong><br>
                    ${paymentDate}
                  </div>
                  <div>
                    <strong>طريقة الدفع:</strong><br>
                    ${payment.method || 'نقدي'}
                  </div>
                  ${payment.notes ? `
                  <div style="grid-column: 1 / -1;">
                    <strong>ملاحظات:</strong><br>
                    ${payment.notes}
                  </div>
                  ` : ''}
                </div>
                
                ${billboardsTable}
              </div>
              
              <div class="amount-section">
                <div class="amount-row">
                  <span>المبلغ المدفوع:</span>
                  <span class="currency">د.ل ${formatArabicNumber(payment.amount || 0)}</span>
                </div>
                
                <div class="amount-words">
                  المبلغ بالكلمات: ${numberToArabicWords(payment.amount || 0)} دينار ليبي
                </div>
              </div>
              
              <div class="signature-section">
                <div class="signature-box">
                  <div>توقيع المستلم (الفرقة)</div>
                  <div class="signature-name">${teamName}</div>
                </div>
                <div class="signature-box">
                  <div>توقيع المسلم</div>
                  <div class="signature-name">${styles.companyName || ''}</div>
                </div>
              </div>
            </div>

            ${footerHtml}
          </div>
        </body>
        </html>
      `;

      const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
      showPrintPreview(htmlContent, `إيصال_سداد_${teamName}_${receiptNumber}`, 'billing-receipts');

      toast.success('تم فتح الإيصال للطباعة بنجاح!');
      onOpenChange(false);

    } catch (error) {
      console.error('Error in handlePrintReceipt:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
      toast.error(`حدث خطأ أثناء تحضير الإيصال للطباعة: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <UIDialog.Dialog open={open} onOpenChange={onOpenChange}>
      <UIDialog.DialogContent className="max-w-lg">
        <UIDialog.DialogHeader>
          <UIDialog.DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            طباعة إيصال السداد
          </UIDialog.DialogTitle>
          <UIDialog.DialogClose className="absolute left-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">إغلاق</span>
          </UIDialog.DialogClose>
        </UIDialog.DialogHeader>
        
        <div className="space-y-6">
          {isGenerating ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-lg font-semibold">جاري تحضير الإيصال للطباعة...</p>
            </div>
          ) : (
            <>
              {/* معاينة بيانات الإيصال */}
              <div className="bg-card/80 backdrop-blur-sm p-4 rounded-lg border border-primary/20">
                <h3 className="font-semibold mb-2 text-primary">معاينة بيانات الإيصال:</h3>
                <div className="text-sm space-y-1">
                  <p><strong>الفرقة:</strong> {teamName}</p>
                  <p><strong>المبلغ:</strong> {formatArabicNumber(payment?.amount || 0)} د.ل</p>
                  <p><strong>طريقة الدفع:</strong> {payment?.method || 'نقدي'}</p>
                  <p><strong>تاريخ السداد:</strong> {payment?.paid_at 
                    ? new Date(payment.paid_at).toLocaleDateString('ar-LY')
                    : new Date().toLocaleDateString('ar-LY')}</p>
                  {payment?.billboards && payment.billboards.length > 0 && (
                    <p><strong>عدد اللوحات:</strong> {payment.billboards.length} لوحة</p>
                  )}
                </div>
              </div>

              {/* أزرار العمليات */}
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  className="border-primary/30 hover:bg-primary/10"
                >
                  إغلاق
                </Button>
                <Button 
                  onClick={handlePrintReceipt}
                  className="bg-gradient-to-r from-primary to-primary-glow hover:from-primary-glow hover:to-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300"
                  disabled={isGenerating}
                >
                  <Printer className="h-4 w-4 ml-2" />
                  طباعة الإيصال
                </Button>
              </div>
            </>
          )}
        </div>
      </UIDialog.DialogContent>
    </UIDialog.Dialog>
  );
}
