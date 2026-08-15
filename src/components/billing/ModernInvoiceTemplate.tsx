/**
 * ModernInvoiceTemplate - فاتورة المبيعات باستخدام Print Engine الموحد
 * 
 * ✅ تستخدم print-engine حصرياً - جميع الألوان والإعدادات من قاعدة البيانات
 * ✅ يدعم العناوين الديناميكية (invoiceName) - ممنوع أي hardcoded title
 * ✅ يتعامل مع الحقول الفارغة بمرونة (Fallback Design)
 */

import {
  generatePrintDocument,
  openPrintWindow,
  loadLogoAsDataUri,
  formatArabicNumber,
  formatDate,
  DocumentHeaderData,
  PartyData,
  PrintTheme
} from '@/print-engine';

// =====================================================
// الأنواع
// =====================================================

export interface ModernInvoiceData {
  invoiceNumber: string;
  date: string;
  customerName: string;
 invoiceName?: string; // عنوان ديناميكي - يُحدد حسب نوع العملية
 invoiceTitleEn?: string; // العنوان الإنجليزي الديناميكي
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  totalAmount: number;
  totalInWords: string;
  notes?: string;
}

// =====================================================
// توليد جدول الأصناف - يستخدم print-engine CSS classes
// =====================================================

function generateModernItemsTable(
  theme: PrintTheme,
  data: ModernInvoiceData
): string {
  const itemRows = data.items.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td class="text-${theme.direction === 'rtl' ? 'right' : 'left'}">${item.description || ''}</td>
      <td>${item.quantity || 0}</td>
      <td>${formatArabicNumber(item.unitPrice)} د.ل</td>
      <td>${formatArabicNumber(item.total)} د.ل</td>
    </tr>
  `).join('');

  return `
    <table class="print-table">
      <thead>
        <tr>
          <th style="width: 8%">#</th>
          <th style="width: 37%">البيان</th>
          <th style="width: 15%">الكمية</th>
          <th style="width: 20%">سعر الوحدة</th>
          <th style="width: 20%">الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
        <tr class="grand-total-row">
          <td colspan="4" style="text-align: ${theme.direction === 'rtl' ? 'left' : 'right'};">الإجمالي النهائي</td>
          <td style="font-size: 18px;">${formatArabicNumber(data.totalAmount)} د.ل</td>
        </tr>
      </tbody>
    </table>
  `;
}

// =====================================================
// توليد HTML - يستخدم print-engine الموحد
// =====================================================

export const generateModernInvoiceHTML = (data: ModernInvoiceData, theme?: PrintTheme): string => {
  // ✅ إذا تم تمرير theme من print-engine → نستخدم النظام الموحد
  if (theme) {
    return generateModernInvoiceWithTheme(data, theme);
  }
  
  // ⚠️ Fallback للتوافق مع الكود القديم - يولد HTML بسيط
  return generateModernInvoiceFallback(data);
};

// =====================================================
// الدالة الموحدة مع print-engine
// =====================================================

async function generateModernInvoiceWithThemeAsync(
  data: ModernInvoiceData,
  theme: PrintTheme
): Promise<string> {
  const logoDataUri = theme.showLogo ? await loadLogoAsDataUri(theme.logoPath) : '';

  // ✅ عنوان ديناميكي - يُقرأ من data.invoiceName
  const headerData: DocumentHeaderData = {
    titleEn: data.invoiceTitleEn || 'SALES INVOICE',
 titleAr: data.invoiceName || 'فاتورة مبيعات', // ديناميكي
    documentNumber: data.invoiceNumber,
    date: formatDate(data.date),
  };

  // ✅ بيانات العميل - تتعامل مع الحقول الفارغة
  const partyData: PartyData = {
    title: 'بيانات العميل',
    name: data.customerName || 'غير محدد',
  };

  // توليد المحتوى
  let bodyContent = generateModernItemsTable(theme, data);

  // المبلغ بالكلمات
  if (data.totalInWords) {
    bodyContent += `
      <div class="summary-section" style="margin-top: 15px;">
        <div style="text-align: center; font-size: 13px; color: #666; font-style: italic;">
          المبلغ بالكلمات: ${data.totalInWords} دينار ليبي
        </div>
      </div>
    `;
  }

  // الملاحظات
  if (data.notes) {
    bodyContent += `
      <div class="summary-section" style="margin-top: 15px;">
        <div class="summary-title">ملاحظات</div>
        <div style="text-align: ${theme.direction === 'rtl' ? 'right' : 'left'}; font-size: 12px;">${data.notes}</div>
      </div>
    `;
  }

  // قسم التوقيعات
  bodyContent += `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 40px; padding-top: 25px; border-top: 3px solid ${theme.primaryColor};">
      <div style="text-align: center; padding: 25px; border: 2px solid ${theme.primaryColor}; border-radius: 10px;">
        <div style="font-weight: 700; font-size: 14px; color: ${theme.primaryColor}; margin-bottom: 50px;">توقيع العميل</div>
        <div style="border-top: 2px solid ${theme.primaryColor}; padding-top: 10px; font-size: 12px; color: #666;">التوقيع</div>
      </div>
      <div style="text-align: center; padding: 25px; border: 2px solid ${theme.primaryColor}; border-radius: 10px;">
        <div style="font-weight: 700; font-size: 14px; color: ${theme.primaryColor}; margin-bottom: 50px;">الختم</div>
        <div style="border-top: 2px solid ${theme.primaryColor}; padding-top: 10px; font-size: 12px; color: #666;">ختم الشركة</div>
      </div>
    </div>
  `;

  return generatePrintDocument({
    theme,
    title: `${data.invoiceName || 'فاتورة مبيعات'} - ${data.customerName}`,
    headerData,
    logoDataUri,
    partyData,
    bodyContent
  });
}

function generateModernInvoiceWithTheme(data: ModernInvoiceData, theme: PrintTheme): string {
  // Synchronous version using theme colors
  const bodyContent = generateModernItemsTable(theme, data);
  
  // Use generatePrintDocument synchronously (without logo loading)
  return generatePrintDocument({
    theme,
    title: `${data.invoiceName || 'فاتورة مبيعات'} - ${data.customerName}`,
    headerData: {
      titleEn: data.invoiceTitleEn || 'SALES INVOICE',
      titleAr: data.invoiceName || 'فاتورة مبيعات',
      documentNumber: data.invoiceNumber,
      date: formatDate(data.date),
    },
    logoDataUri: '',
    partyData: {
      title: 'بيانات العميل',
      name: data.customerName || 'غير محدد',
    },
    bodyContent: bodyContent + (data.totalInWords ? `
      <div class="summary-section" style="margin-top: 15px;">
        <div style="text-align: center; font-size: 13px; color: #666; font-style: italic;">
          المبلغ بالكلمات: ${data.totalInWords} دينار ليبي
        </div>
      </div>
    ` : '') + (data.notes ? `
      <div class="summary-section" style="margin-top: 15px;">
        <div class="summary-title">ملاحظات</div>
        <div style="text-align: ${theme.direction === 'rtl' ? 'right' : 'left'}; font-size: 12px;">${data.notes}</div>
      </div>
    ` : '') + `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 40px; padding-top: 25px; border-top: 3px solid ${theme.primaryColor};">
        <div style="text-align: center; padding: 25px; border: 2px solid ${theme.primaryColor}; border-radius: 10px;">
          <div style="font-weight: 700; font-size: 14px; color: ${theme.primaryColor}; margin-bottom: 50px;">توقيع العميل</div>
          <div style="border-top: 2px solid ${theme.primaryColor}; padding-top: 10px; font-size: 12px; color: #666;">التوقيع</div>
        </div>
        <div style="text-align: center; padding: 25px; border: 2px solid ${theme.primaryColor}; border-radius: 10px;">
          <div style="font-weight: 700; font-size: 14px; color: ${theme.primaryColor}; margin-bottom: 50px;">الختم</div>
          <div style="border-top: 2px solid ${theme.primaryColor}; padding-top: 10px; font-size: 12px; color: #666;">ختم الشركة</div>
        </div>
      </div>
    `
  });
}

// =====================================================
// Fallback للتوافق مع الاستدعاءات القديمة (بدون theme)
// =====================================================

function generateModernInvoiceFallback(data: ModernInvoiceData): string {
  const itemRows = data.items.map(item => `
    <tr class="item-row">
      <td class="item-desc">${item.description || ''}</td>
      <td class="item-qty">${item.quantity || 0}</td>
      <td class="item-price">${(item.unitPrice || 0).toLocaleString('ar-LY')} د.ل</td>
      <td class="item-total">${(item.total || 0).toLocaleString('ar-LY')} د.ل</td>
    </tr>
  `).join('');

  // ✅ العنوان الديناميكي - يُقرأ من data.invoiceName
  const dynamicTitle = data.invoiceName || 'فاتورة مبيعات';
  const dynamicTitleEn = data.invoiceTitleEn || 'SALES INVOICE';

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${dynamicTitle} - ${data.invoiceNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
    @font-face { font-family: 'Doran'; src: url('/Doran-Bold.otf') format('opentype'); font-weight: 700; }
    @font-face { font-family: 'Doran'; src: url('/Doran-Regular.otf') format('opentype'); font-weight: 400; }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Cairo', 'Doran', 'Tajawal', Arial, sans-serif;
      background: white;
      min-height: 100vh;
      padding: 20px;
      color: #181616;
      line-height: 1.6;
    }
    
    .invoice-container {
      max-width: 210mm;
      margin: 0 auto;
      background: #ffffff;
      padding: 30px;
    }
    
    .header {
      display: flex;
      flex-direction: row-reverse;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 15px;
      border-bottom: 3px solid var(--primary, #1e40af);
      margin-bottom: 20px;
    }

    .invoice-title {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 2px;
      font-family: 'Cairo', sans-serif;
    }

    .invoice-meta {
      font-size: 11px;
      color: #666;
      margin-top: 8px;
      line-height: 1.8;
    }

    .party-section {
      padding: 15px 20px;
      margin-bottom: 20px;
      border-right: 4px solid var(--primary, #1e40af);
      background: #f8f9fa;
    }

    .party-title {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 10px;
    }
    
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    
    .items-table th {
      padding: 12px 8px;
      text-align: center;
      font-weight: 700;
      font-size: 12px;
      border: 1px solid #ddd;
      background: #333;
      color: white;
    }

    .item-row td {
      padding: 12px 8px;
      text-align: center;
      font-size: 12px;
      border: 1px solid #ddd;
      vertical-align: middle;
    }

    .item-row:nth-child(even) { background: #f8f9fa; }
    .item-desc { text-align: right !important; font-weight: 600; }
    .item-qty, .item-price, .item-total { font-weight: 700; }
    
    .total-section {
      background: #333;
      padding: 25px;
      border-radius: 8px;
      text-align: center;
      margin: 25px 0;
      color: white;
    }

    .total-label { font-size: 18px; margin-bottom: 8px; font-weight: 600; }
    .total-value { font-size: 36px; font-weight: 800; margin-bottom: 8px; }
    .currency-label { font-size: 16px; font-weight: 600; margin-bottom: 10px; }
    .total-words { font-size: 14px; font-style: italic; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.2); }
    
    .signature-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-top: 40px;
      padding-top: 25px;
      border-top: 3px solid #333;
    }

    .signature-box {
      text-align: center;
      padding: 25px;
      border: 2px solid #ddd;
      border-radius: 10px;
    }

    .signature-label {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 50px;
    }

    .signature-line {
      border-top: 2px solid #ddd;
      margin-top: 50px;
      padding-top: 10px;
      font-size: 14px;
      color: #666;
    }
    
    .footer {
      padding: 20px;
      text-align: center;
      border-top: 3px solid #333;
      margin-top: 30px;
      font-size: 12px;
      color: #666;
    }

    .notes-section {
      margin-top: 15px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 6px;
      border: 1px solid #ddd;
    }

    .notes-title {
      font-weight: 700;
      font-size: 13px;
      margin-bottom: 8px;
    }
    
    @media print {
      body { background: white; padding: 0; }
      .invoice-container { box-shadow: none; border: none; }
      @page { size: A4; margin: 10mm; }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div style="flex: 1; text-align: right;">
 <!-- الشعار ومعلومات الشركة تأتي من الإعدادات المحفوظة -->
      </div>
      <div style="flex: 1; text-align: left;">
        <div class="invoice-title">${dynamicTitleEn}</div>
        <div style="font-size: 18px; font-weight: 700; margin-top: 5px;">${dynamicTitle}</div>
        <div class="invoice-meta">
          <div>رقم الفاتورة: ${data.invoiceNumber}</div>
          <div>التاريخ: ${data.date}</div>
        </div>
      </div>
    </div>

    <div class="party-section">
      <div class="party-title">بيانات العميل</div>
      <div><strong>الاسم:</strong> ${data.customerName || 'غير محدد'}</div>
    </div>
    
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 40%;">البيان</th>
          <th style="width: 15%;">الكمية</th>
          <th style="width: 20%;">سعر الوحدة</th>
          <th style="width: 25%;">الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>
    
    <div class="total-section">
      <div class="total-label">الإجمالي النهائي</div>
      <div class="total-value">${(data.totalAmount || 0).toLocaleString('ar-LY')} د.ل</div>
      <div class="currency-label">دينار ليبي</div>
      ${data.totalInWords ? `<div class="total-words">${data.totalInWords}</div>` : ''}
    </div>
    
    ${data.notes ? `
    <div class="notes-section">
      <div class="notes-title">ملاحظات</div>
      <div style="font-size: 12px; line-height: 1.6;">${data.notes}</div>
    </div>
    ` : ''}
    
    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-label">توقيع العميل</div>
        <div class="signature-line">التوقيع</div>
      </div>
      <div class="signature-box">
        <div class="signature-label">الختم</div>
        <div class="signature-line">ختم الشركة</div>
      </div>
    </div>
    
    <div class="footer">
      شكراً لتعاملكم معنا | تاريخ الطباعة: ${new Date().toLocaleString('ar-LY-u-nu-latn')}
    </div>
  </div>
  
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;
}

// =====================================================
// دالة الطباعة باستخدام print-engine (async مع شعار)
// =====================================================

export async function printModernInvoice(
  theme: PrintTheme,
  data: ModernInvoiceData
): Promise<void> {
  const htmlContent = await generateModernInvoiceWithThemeAsync(data, theme);
  openPrintWindow(htmlContent, `${data.invoiceName || 'فاتورة_مبيعات'}_${data.invoiceNumber}`);
}
