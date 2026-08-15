import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { getMergedInvoiceStylesAsync, hexToRgba } from '@/hooks/useInvoiceSettingsSync';
import { unifiedHeaderFooterCss, unifiedHeaderHtml, unifiedFooterHtml, formatDateForPrint } from '@/lib/unifiedInvoiceBase';
import { numberToArabicWords } from '@/lib/printUtils';
interface CustodyAccount {
  id: string;
  account_number: string;
  initial_amount: number;
  current_balance: number;
  assigned_date: string;
  notes: string | null;
  employee?: {
    name: string;
    position: string;
  };
}

interface CustodyReceiptPrintProps {
  account: CustodyAccount;
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

export function CustodyReceiptPrint({ account }: CustodyReceiptPrintProps) {
  const handlePrint = async () => {
    const baseUrl = window.location.origin;
    const html = await generateReceiptHTML(account, baseUrl);
    const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
    showPrintPreview(html, `إيصال عهدة ${account.account_number} - ${account.employee?.name || ''}`);
  };

  return (
    <Button onClick={handlePrint} variant="outline" size="sm" className="gap-1">
      <Printer className="h-4 w-4" />
      واصل استلام
    </Button>
  );
}

async function generateReceiptHTML(account: CustodyAccount, baseUrl: string): Promise<string> {
  const styles = await getMergedInvoiceStylesAsync('custody');
  const logoUrl = styles.logoPath || '/logofaresgold.svg';
  const fullLogoUrl = logoUrl.startsWith('http') ? logoUrl : `${baseUrl}${logoUrl}`;

  const date = formatDateForPrint(account.assigned_date, styles.showHijriDate);
  const receiptDate = formatDateForPrint(new Date().toISOString(), styles.showHijriDate);
  const receiptNumber = `CUS-${Date.now()}`;

  const custodyMetaHtml = `رقم الواصل: ${receiptNumber}<br/>التاريخ: ${receiptDate}<br/>العملة: دينار ليبي`;
  const custodyFooterText = `${styles.footerText || 'شكراً لتعاملكم معنا'}<br/>هذا إيصال إلكتروني ولا يحتاج إلى ختم أو توقيع إضافي`;
  const custodyStyles = { ...styles, footerText: custodyFooterText };

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>واصل استلام عهدة - ${account.account_number}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    html, body {
      width: 210mm;
      height: 297mm;
      font-family: ${styles.fontFamily || "'Noto Sans Arabic', Arial, sans-serif"};
      direction: rtl;
      text-align: right;
      background: white;
      color: ${styles.customerSectionTextColor};
      font-size: ${styles.bodyFontSize}px;
      line-height: 1.3;
      overflow: hidden;
    }
    
    .receipt-container {
      width: 210mm;
      height: 297mm;
      padding: ${styles.pageMarginTop}mm ${styles.pageMarginRight}mm ${styles.pageMarginBottom}mm ${styles.pageMarginLeft}mm;
      display: flex;
      flex-direction: column;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      border-bottom: 2px solid ${styles.primaryColor};
      padding-bottom: 15px;
    }

    ${unifiedHeaderFooterCss(custodyStyles)}
    .receipt-title { font-size: ${styles.titleFontSize}px; font-weight: bold; color: ${styles.primaryColor}; margin-bottom: 8px; }
    .receipt-details { font-size: ${styles.bodyFontSize}px; color: #666; line-height: 1.5; }
    
    .company-info { display: flex; flex-direction: column; align-items: flex-end; text-align: right; order: 1; }
    .company-logo { max-width: ${styles.logoSize}px; height: auto; object-fit: contain; margin-bottom: 5px; display: ${styles.showLogo ? 'block' : 'none'}; }
    .company-details { font-size: ${styles.contactInfoFontSize}px; color: #666; line-height: 1.6; text-align: ${styles.contactInfoAlignment}; display: ${styles.showContactInfo ? 'block' : 'none'}; }
    
    .employee-info {
      background: ${hexToRgba(styles.customerSectionBgColor, 50)};
      padding: 15px;
      margin-bottom: 18px;
      border-right: 4px solid ${styles.primaryColor};
      border: 1px solid ${styles.customerSectionBorderColor};
    }
    .employee-title { font-size: ${styles.headerFontSize}px; font-weight: bold; margin-bottom: 8px; color: ${styles.customerSectionTitleColor}; }
    .employee-details { font-size: ${styles.bodyFontSize}px; line-height: 1.5; }
    
    .custody-details {
      background: ${hexToRgba(styles.customerSectionBgColor, 30)};
      padding: 18px;
      border-radius: 8px;
      margin-bottom: 18px;
      border: 2px solid ${styles.primaryColor};
    }
    .custody-title { font-size: ${styles.headerFontSize}px; font-weight: bold; margin-bottom: 12px; color: ${styles.customerSectionTitleColor}; text-align: center; }
    .custody-info { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: ${styles.bodyFontSize}px; }
    .custody-info div { padding: 8px; background: white; border-radius: 4px; border: ${styles.tableBorderWidth || 1}px ${styles.tableBorderStyle || 'solid'} ${styles.tableBorderColor}; }
    .custody-info strong { color: ${styles.customerSectionTitleColor}; font-weight: bold; }
    
    .amount-section { margin-top: 18px; border-top: 2px solid ${styles.primaryColor}; padding-top: 15px; }
    .amount-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 20px;
      font-weight: bold;
      background: ${styles.totalBgColor};
      color: ${styles.totalTextColor};
      padding: 18px;
      margin-top: 12px;
    }
    .currency { font-weight: bold; color: #FFD700; text-shadow: 1px 1px 2px rgba(0,0,0,0.3); }
    .amount-words { margin-top: 12px; font-size: ${styles.bodyFontSize}px; color: #666; text-align: center; font-style: italic; }
    
    .acknowledgment {
      background: ${hexToRgba(styles.notesBgColor, 50)};
      padding: 15px;
      margin-top: 18px;
      border-right: 4px solid ${styles.primaryColor};
      font-size: ${styles.bodyFontSize}px;
      line-height: 1.6;
      color: ${styles.notesTextColor};
    }
    
    .signature-section { margin-top: 25px; display: flex; justify-content: space-between; align-items: flex-end; }
    .signature-box { text-align: center; border-top: 2px solid ${styles.primaryColor}; padding-top: 8px; min-width: 120px; }
    .signature-name { margin-top: 8px; font-size: ${styles.bodyFontSize}px; color: #666; }
    
    .footer { margin-top: auto; text-align: center; font-size: ${styles.bodyFontSize}px; color: ${styles.footerTextColor}; border-top: 1px solid ${styles.tableBorderColor}; padding-top: 15px; }
    
    @media print {
      html, body { width: 210mm !important; height: 297mm !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .receipt-container { width: 210mm !important; height: 297mm !important; padding: 12mm !important; }
      @page { size: A4 portrait; margin: 0 !important; }
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    ${unifiedHeaderHtml({
      styles: custodyStyles,
      fullLogoUrl,
      metaLinesHtml: custodyMetaHtml,
      titleEn: 'CUSTODY RECEIPT',
    })}
    
    <div class="employee-info">
      <div class="employee-title">بيانات الموظف</div>
      <div class="employee-details">
        <strong>اسم الموظف:</strong> ${account.employee?.name || '-'}<br>
        <strong>الوظيفة:</strong> ${account.employee?.position || '-'}
      </div>
    </div>
    
    <div class="custody-details">
      <div class="custody-title">تفاصيل العهدة</div>
      <div class="custody-info">
        <div><strong>رقم العهدة:</strong><br>${account.account_number}</div>
        <div><strong>تاريخ الاستلام:</strong><br>${date}</div>
        ${account.notes ? `<div style="grid-column: 1 / -1;"><strong>ملاحظات:</strong><br>${account.notes}</div>` : ''}
      </div>
    </div>
    
    <div class="amount-section">
      <div class="amount-row">
        <span>مبلغ العهدة المستلم:</span>
        <span class="currency">د.ل ${formatArabicNumber(account.initial_amount)}</span>
      </div>
      <div class="amount-words">المبلغ بالكلمات: ${numberToArabicWords(account.initial_amount)} دينار ليبي</div>
    </div>
    
    <div class="acknowledgment">
      <strong>إقرار:</strong> أقر أنا الموقع أدناه <strong>${account.employee?.name || '_______________'}</strong> بأنني استلمت المبلغ المذكور أعلاه كعهدة مالية، وأتعهد بحفظه والتصرف فيه وفقاً لسياسات الشركة وتعليمات الإدارة.
    </div>
    
    <div class="signature-section">
      <div class="signature-box">
        <div>توقيع المستلم</div>
        <div class="signature-name">${account.employee?.name || ''}</div>
      </div>
      <div class="signature-box">
        <div>توقيع المسلم</div>
        <div class="signature-name">${styles.companyName}</div>
      </div>
    </div>
    
    ${unifiedFooterHtml(custodyStyles)}
  </div>
  
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() { window.focus(); window.print(); }, 500);
    });
  </script>
</body>
</html>`;
}
