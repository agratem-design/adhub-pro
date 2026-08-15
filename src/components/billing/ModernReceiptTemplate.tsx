/**
 * ModernReceiptTemplate - قالب الإيصال الموحد
 * ✅ يستخدم نظام الطباعة الموحد (Unified Print Engine)
 */

import { getPrintLayoutConfig } from '@/lib/printLayoutHelper';
import {
  generateBasePrintCSS,
  generateDocumentHeader,
  generatePartySection,
  generateDocumentFooter,
  formatArabicNumber,
  openPrintWindow,
  type DocumentHeaderData,
  type PartyData,
} from '@/lib/printHtmlGenerator';

export interface ModernReceiptData {
  receiptNumber: string;
  date: string;
  customerName: string;
  amount: number;
  amountInWords: string;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
  contractNumber?: string;
  remainingBalance?: number;
  currencySymbol?: string;
  currencyName?: string;
}

/**
 * توليد HTML الإيصال باستخدام النظام الموحد
 */
export const generateModernReceiptHTML = async (
  data: ModernReceiptData,
  printSettings?: any
): Promise<string> => {
  // الحصول على الإعدادات من النظام الموحد
  const config = getPrintLayoutConfig(printSettings || {});
  
  // تحميل الشعار
  let logoDataUri = '';
  if (config.showLogo && config.logoPath) {
    try {
      const response = await fetch(config.logoPath);
      const blob = await response.blob();
      logoDataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error loading logo:', error);
    }
  }

  const currencySymbol = data.currencySymbol || 'د.ل';
  const currencyName = data.currencyName || 'دينار ليبي';

  // بيانات الهيدر
  const headerData: DocumentHeaderData = {
    titleEn: 'RECEIPT',
    titleAr: 'إيصال قبض',
    documentNumber: data.receiptNumber,
    date: data.date,
    additionalDetails: data.paymentMethod ? [
      { label: 'طريقة الدفع', value: data.paymentMethod }
    ] : [],
  };

  // بيانات العميل
  const partyData: PartyData = {
    title: 'بيانات المُستلم منه',
    name: data.customerName,
    additionalFields: [
      ...(data.contractNumber ? [{ label: 'رقم العقد', value: data.contractNumber }] : []),
      ...(data.reference ? [{ label: 'المرجع', value: data.reference }] : []),
    ],
  };

  // قسم المبلغ المخصص
  const amountSectionHtml = `
    <div class="amount-highlight-section">
      <div class="amount-label">المبلغ المُستلم</div>
      <div class="amount-value">${formatArabicNumber(data.amount)} ${currencySymbol}</div>
      <div class="amount-words">${data.amountInWords} ${currencyName} فقط لا غير</div>
    </div>
  `;

  // قسم الرصيد المتبقي (إن وجد)
  const balanceSectionHtml = data.remainingBalance !== undefined ? `
    <div class="balance-section">
      <div class="balance-row">
        <span class="balance-label">الرصيد المتبقي:</span>
        <span class="balance-value ${data.remainingBalance > 0 ? 'negative' : 'positive'}">${formatArabicNumber(data.remainingBalance)} ${currencySymbol}</span>
      </div>
    </div>
  ` : '';

  // قسم الملاحظات (إن وجد)
  const notesSectionHtml = data.notes ? `
    <div class="notes-section">
      <div class="notes-title">ملاحظات:</div>
      <div class="notes-content">${data.notes}</div>
    </div>
  ` : '';

  // قسم التوقيعات
  const signaturesSectionHtml = `
    <div class="signatures-section">
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">توقيع المُستلم</div>
      </div>
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">ختم الشركة</div>
      </div>
    </div>
  `;

  // CSS إضافي خاص بالإيصال
  const receiptCustomCSS = `
    .amount-highlight-section {
      background: linear-gradient(135deg, ${config.primaryColor}15, ${config.primaryColor}25);
      border: 3px solid ${config.primaryColor};
      border-radius: 12px;
      padding: 30px;
      text-align: center;
      margin: 25px 0;
    }
    
    .amount-label {
      font-size: 16px;
      font-weight: 600;
      color: ${config.primaryColor};
      margin-bottom: 15px;
    }
    
    .amount-value {
      font-size: 36px;
      font-weight: 800;
      color: ${config.primaryColor};
      margin-bottom: 15px;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
    }
    
    .amount-words {
      font-size: 14px;
      color: #666;
      font-style: italic;
      padding: 10px 15px;
      background: rgba(255,255,255,0.5);
      border-radius: 6px;
      display: inline-block;
    }
    
    .balance-section {
      background: ${config.accentColor};
      padding: 15px 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    
    .balance-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 16px;
    }
    
    .balance-label {
      font-weight: 600;
      color: #333;
    }
    
    .balance-value {
      font-weight: 700;
      font-size: 18px;
    }
    
    .balance-value.positive { color: #16a34a; }
    .balance-value.negative { color: #dc2626; }
    
    .notes-section {
      background: #f9fafb;
      padding: 15px 20px;
      border-radius: 8px;
      margin: 20px 0;
      border-${config.direction === 'rtl' ? 'right' : 'left'}: 4px solid ${config.secondaryColor};
    }
    
    .notes-title {
      font-weight: 700;
      color: ${config.secondaryColor};
      margin-bottom: 8px;
      font-size: 14px;
    }
    
    .notes-content {
      font-size: 13px;
      color: #555;
      line-height: 1.6;
    }
    
    .signatures-section {
      display: flex;
      justify-content: space-around;
      margin-top: 50px;
      padding-top: 30px;
      border-top: 2px solid ${config.primaryColor};
    }
    
    .signature-box {
      text-align: center;
      min-width: 150px;
    }
    
    .signature-line {
      width: 100%;
      height: 60px;
      border-bottom: 2px dashed ${config.primaryColor};
      margin-bottom: 10px;
    }
    
    .signature-label {
      font-size: 14px;
      font-weight: 600;
      color: ${config.primaryColor};
    }
  `;

  // توليد HTML الكامل
  const htmlContent = `
    <!DOCTYPE html>
    <html dir="${config.direction}" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>إيصال قبض - ${data.receiptNumber}</title>
      <style>
        ${generateBasePrintCSS(config)}
        ${receiptCustomCSS}
      </style>
    </head>
    <body>
      <div class="print-container">
        ${generateDocumentHeader(config, headerData, logoDataUri)}
        ${generatePartySection(partyData)}
        ${amountSectionHtml}
        ${balanceSectionHtml}
        ${notesSectionHtml}
        ${signaturesSectionHtml}
        ${generateDocumentFooter(config)}
      </div>
      
      <script>
        window.addEventListener('load', function() {
          setTimeout(function() {
            window.focus();
            window.print();
          }, 500);
        });
      </script>
    </body>
    </html>
  `;

  return htmlContent;
};

// دالة مساعدة لتحويل الأرقام للكلمات العربية
export const numberToArabicWords = (num: number): string => {
  if (num === null || num === undefined || isNaN(num)) return '';
  
  num = Math.round(Math.abs(num));
  
  if (num === 0) return 'صفر';
  
  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  
  const convertHundreds = (n: number): string => {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) {
      const ten = Math.floor(n / 10);
      const one = n % 10;
      return ones[one] + (one > 0 ? ' و' : '') + tens[ten];
    }
    const hundred = Math.floor(n / 100);
    const remainder = n % 100;
    let result = '';
    if (hundred === 1) result = 'مائة';
    else if (hundred === 2) result = 'مائتان';
    else result = ones[hundred] + ' مائة';
    if (remainder > 0) result += ' و' + convertHundreds(remainder);
    return result;
  };

  if (num < 1000) return convertHundreds(num);
  
  if (num < 1000000) {
    const thousands = Math.floor(num / 1000);
    const remainder = num % 1000;
    let result = '';
    if (thousands === 1) result = 'ألف';
    else if (thousands === 2) result = 'ألفان';
    else if (thousands >= 3 && thousands <= 10) result = convertHundreds(thousands) + ' آلاف';
    else result = convertHundreds(thousands) + ' ألف';
    if (remainder > 0) result += ' و' + convertHundreds(remainder);
    return result;
  }
  
  if (num < 1000000000) {
    const millions = Math.floor(num / 1000000);
    const remainder = num % 1000000;
    let result = '';
    if (millions === 1) result = 'مليون';
    else if (millions === 2) result = 'مليونان';
    else if (millions >= 3 && millions <= 10) result = convertHundreds(millions) + ' ملايين';
    else result = convertHundreds(millions) + ' مليون';
    if (remainder > 0) result += ' و' + numberToArabicWords(remainder);
    return result;
  }
  
  return num.toLocaleString('en-US');
};
