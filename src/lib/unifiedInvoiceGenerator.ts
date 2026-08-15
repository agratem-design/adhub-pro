/**
 * مولد الفواتير الموحد - يستخدم إعدادات تصميم الطباعة لتوليد HTML موحد لجميع أنواع الفواتير
 */

import { supabase } from '@/integrations/supabase/client';
import {
  InvoiceTemplateType,
  SharedInvoiceSettings,
  IndividualInvoiceSettings,
  DEFAULT_SHARED_SETTINGS,
  DEFAULT_INDIVIDUAL_SETTINGS,
  INVOICE_TITLES,
  AllInvoiceSettings
} from '@/types/invoice-templates';

const SETTINGS_KEY = 'unified_invoice_templates_settings';

// Cache للإعدادات
let cachedSettings: AllInvoiceSettings | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60000; // 1 minute

/**
 * جلب إعدادات القوالب من قاعدة البيانات
 */
export async function getInvoiceSettings(): Promise<AllInvoiceSettings> {
  // Check cache
  if (cachedSettings && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedSettings;
  }

  try {
    const { data } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', SETTINGS_KEY)
      .single();

    if (data?.setting_value) {
      cachedSettings = JSON.parse(data.setting_value) as AllInvoiceSettings;
      cacheTimestamp = Date.now();
      return cachedSettings;
    }
  } catch (error) {
    console.log('No saved invoice settings, using defaults');
  }

  // Return defaults
  const defaults: AllInvoiceSettings = {
    shared: DEFAULT_SHARED_SETTINGS,
    individual: {} as any
  };
  return defaults;
}

/**
 * مسح الكاش
 */
export function clearInvoiceGeneratorCache() {
  cachedSettings = null;
  cacheTimestamp = 0;
}

/**
 * دوال مساعدة
 */
const hexToRgba = (hex: string, opacity: number = 100): string => {
  if (!hex || hex === 'transparent') return 'transparent';
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
  } catch {
    return hex;
  }
};

const textAlign = (a?: 'left' | 'center' | 'right') => a || 'right';
const flexAlign = (a?: 'left' | 'center' | 'right') => 
  a === 'center' ? 'center' : a === 'left' ? 'flex-start' : 'flex-end';
const flexJustify = (a?: 'left' | 'center' | 'right') => 
  a === 'center' ? 'center' : a === 'left' ? 'flex-start' : 'flex-end';

export interface UnifiedInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  contractNumber?: string;
  customerName?: string;
  customerCompany?: string;
  customerPhone?: string;
  customerPeriod?: string;
  items?: Array<{
    description: string;
    size?: string;
    quantity: number;
    unitPrice: number;
    total: number;
    image?: string;
  }>;
  transactions?: Array<{
    date: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
    reference?: string;
  }>;
  billboards?: Array<{
    name: string;
    size: string;
    faces: number;
    location: string;
    price?: number;
  }>;
  subtotal?: number;
  discount?: number;
  total: number;
  notes?: string;
  currency?: { symbol: string; name: string };
  balanceSummary?: {
    totalDebit: number;
    totalCredit: number;
    remaining: number;
  };
  teamInfo?: {
    name: string;
    leader?: string;
    members?: number;
  };
  paymentInfo?: {
    amount: number;
    method: string;
    reference?: string;
    previousBalance?: number;
    newBalance?: number;
  };
}

/**
 * توليد CSS الموحد للفاتورة
 */
function generateUnifiedCSS(
  shared: SharedInvoiceSettings,
  individual: IndividualInvoiceSettings
): string {
  const pageMarginTop = shared.pageMarginTop || 15;
  const pageMarginBottom = shared.pageMarginBottom || 15;
  const pageMarginLeft = shared.pageMarginLeft || 15;
  const pageMarginRight = shared.pageMarginRight || 15;
  const headerMarginBottom = shared.headerMarginBottom || 20;
  const footerPosition = shared.footerPosition || 15;

  return `
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
    
    @font-face {
      font-family: 'Doran';
      src: url('/Doran-Regular.otf') format('opentype');
      font-weight: 400;
    }
    @font-face {
      font-family: 'Doran';
      src: url('/Doran-Bold.otf') format('opentype');
      font-weight: 700;
    }
    @font-face {
      font-family: 'Manrope';
      src: url('/Manrope-SemiBold.ttf') format('truetype');
      font-weight: 600;
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    html, body {
      width: 210mm;
      min-height: 297mm;
      font-family: '${shared.fontFamily || 'Doran'}', 'Noto Sans Arabic', Arial, sans-serif;
      direction: rtl;
      text-align: right;
      background: white;
      color: #000;
      font-size: ${individual.bodyFontSize || 12}px;
      line-height: 1.4;
    }
    
    @page {
      size: A4 portrait;
      margin: ${pageMarginTop}mm ${pageMarginRight}mm ${pageMarginBottom}mm ${pageMarginLeft}mm;
      @bottom-center {
        content: "صفحة " counter(page) " من " counter(pages);
        font-family: 'Cairo', 'Manrope', sans-serif;
        font-size: 10px;
        color: #666;
      }
    }

    @media print {
      .u-footer .u-inline-page-number { display: none !important; }
    }
    
    .invoice-container {
      width: 210mm;
      min-height: 297mm;
      padding: ${pageMarginTop}mm ${pageMarginRight}mm ${pageMarginBottom}mm ${pageMarginLeft}mm;
      position: relative;
      display: flex;
      flex-direction: column;
    }
    
    ${shared.backgroundImage ? `
    .invoice-background {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background-image: url('${shared.backgroundImage}');
      background-size: ${shared.backgroundScale || 100}%;
      background-position: ${shared.backgroundPosX || 50}% ${shared.backgroundPosY || 50}%;
      background-repeat: no-repeat;
      opacity: ${(shared.backgroundOpacity || 100) / 100};
      pointer-events: none;
      z-index: 0;
    }
    ` : ''}
    
    .content-wrapper {
      position: relative;
      z-index: 1;
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    
    /* Header Styles */
    .u-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: ${headerMarginBottom}px;
      padding-bottom: 15px;
      border-bottom: 2px solid ${individual.primaryColor || '#D4AF37'};
    }
    
    .u-header-left {
      flex: 1;
      text-align: ${textAlign(shared.invoiceTitleAlignment)};
      direction: ltr;
    }
    
    .u-title {
      font-size: ${shared.invoiceTitleFontSize || 28}px;
      font-weight: 700;
      margin: 0;
      font-family: 'Manrope', sans-serif;
      letter-spacing: 2px;
      color: ${individual.secondaryColor || '#1a1a2e'};
    }
    
    .u-meta {
      font-size: 11px;
      color: ${individual.customerSectionTextColor || '#333'};
      margin-top: 8px;
      line-height: 1.6;
    }
    
    .u-header-right {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: ${flexAlign(shared.logoPosition)};
      gap: 8px;
    }
    
    .u-logo {
      height: ${shared.logoSize || 60}px;
      object-fit: contain;
      flex-shrink: 0;
    }
    
    .u-contact {
      font-size: ${shared.contactInfoFontSize || 10}px;
      color: ${individual.customerSectionTextColor || '#333'};
      line-height: 1.6;
      text-align: ${textAlign(shared.contactInfoAlignment)};
    }
    
    .u-company {
      font-size: 11px;
      color: ${individual.customerSectionTextColor || '#333'};
      line-height: 1.8;
      text-align: ${textAlign(shared.logoPosition)};
    }
    
    .u-company-name {
      font-weight: 700;
      font-size: 14px;
      color: ${individual.primaryColor || '#D4AF37'};
      margin-bottom: 2px;
    }
    
    /* Customer Section */
    .customer-section {
      background: ${individual.customerSectionBgColor || '#faf8f3'};
      border-right: 4px solid ${individual.customerSectionBorderColor || '#D4AF37'};
      padding: 15px 20px;
      margin-bottom: 20px;
      text-align: ${textAlign(individual.customerSectionAlignment)};
    }
    
    .customer-title {
      font-size: ${individual.headerFontSize || 14}px;
      font-weight: bold;
      color: ${individual.customerSectionTitleColor || '#D4AF37'};
      margin-bottom: 10px;
    }
    
    .customer-details {
      font-size: ${individual.bodyFontSize || 12}px;
      color: ${individual.customerSectionTextColor || '#333'};
      line-height: 1.8;
    }
    
    /* Table Styles */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: ${individual.bodyFontSize || 12}px;
      ${(individual as any).tableBorderRadius ? `border-radius: ${(individual as any).tableBorderRadius}px; overflow: hidden;` : ''}
    }
    
    .items-table th {
      background: ${individual.tableHeaderBgColor || '#D4AF37'};
      color: ${individual.tableHeaderTextColor || '#fff'};
      padding: 12px 8px;
      text-align: center;
      border: ${(individual as any).tableBorderWidth || 1}px ${(individual as any).tableBorderStyle || 'solid'} ${individual.tableBorderColor || '#D4AF37'};
      font-weight: bold;
    }
    
    .items-table td {
      padding: 10px 8px;
      text-align: center;
      border: ${(individual as any).tableBorderWidth || 1}px ${(individual as any).tableBorderStyle || 'solid'} ${individual.tableBorderColor || '#D4AF37'};
      color: ${individual.tableTextColor || '#333'};
    }
    
    .items-table tbody tr:nth-child(even) {
      background: ${hexToRgba(individual.tableRowEvenColor || '#f8f9fa', individual.tableRowOpacity || 100)};
    }
    
    .items-table tbody tr:nth-child(odd) {
      background: ${hexToRgba(individual.tableRowOddColor || '#ffffff', individual.tableRowOpacity || 100)};
    }
    
    /* Totals Section */
    .totals-section {
      margin-top: auto;
      text-align: ${textAlign(individual.totalsAlignment)};
    }
    
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 15px;
      font-size: 14px;
    }
    
    .subtotal-row {
      background: ${individual.subtotalBgColor || 'transparent'};
      color: ${individual.subtotalTextColor || '#333'};
    }
    
    .discount-row {
      color: ${individual.discountTextColor || '#d9534f'};
    }
    
    .total-row {
      background: ${individual.totalBgColor || '#D4AF37'};
      color: ${individual.totalTextColor || '#fff'};
      font-weight: bold;
      font-size: 16px;
      border-radius: 4px;
      margin-top: 10px;
    }
    
    /* Notes Section */
    .notes-section {
      background: ${individual.notesBgColor || '#f9f9f9'};
      border: 1px solid ${individual.notesBorderColor || '#eee'};
      padding: 15px;
      margin-top: 20px;
      text-align: ${textAlign(individual.notesAlignment)};
      color: ${individual.notesTextColor || '#333'};
    }
    
    .notes-title {
      font-weight: bold;
      margin-bottom: 8px;
    }
    
    /* Balance Summary */
    .balance-summary {
      background: ${individual.balanceSummaryBgColor || '#f5f5f5'};
      border: 1px solid ${individual.balanceSummaryBorderColor || '#999'};
      padding: 20px;
      margin-top: 20px;
    }
    
    .balance-title {
      color: ${individual.balanceSummaryTitleColor || '#D4AF37'};
      font-weight: bold;
      margin-bottom: 15px;
      font-size: 16px;
    }
    
    .balance-positive { color: ${individual.balanceSummaryPositiveColor || '#4caf50'}; }
    .balance-negative { color: ${individual.balanceSummaryNegativeColor || '#f44336'}; }
    
    /* Footer */
    .u-footer {
      width: 100%;
      margin-top: auto;
      padding-top: 15px;
      border-top: 1px solid ${individual.tableBorderColor || '#D4AF37'};
      background: ${shared.footerBgColor || 'transparent'};
      color: ${shared.footerTextColor || '#666'};
      font-size: 10px;
      display: flex;
      align-items: center;
      justify-content: ${flexJustify(shared.footerAlignment)};
      gap: 20px;
      text-align: ${textAlign(shared.footerAlignment)};
    }
    
    /* Payment Section */
    .payment-section {
      background: ${individual.paymentSectionBgColor || '#e8f5e9'};
      border: 1px solid ${individual.paymentSectionBorderColor || '#4caf50'};
      border-right-width: 4px;
      padding: 15px 20px;
      margin-bottom: 20px;
    }
    
    .payment-title {
      color: ${individual.paymentSectionTitleColor || '#2e7d32'};
      font-weight: bold;
      margin-bottom: 10px;
    }
    
    .payment-details {
      color: ${individual.paymentSectionTextColor || '#333'};
    }
    
    @media print {
      html, body {
        width: 210mm !important;
        margin: 0 !important;
        padding: 0 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      .invoice-container {
        width: 210mm !important;
        padding: 10mm !important;
      }
    }
  `;
}

/**
 * توليد HTML الهيدر الموحد
 */
function generateUnifiedHeader(
  shared: SharedInvoiceSettings,
  individual: IndividualInvoiceSettings,
  data: UnifiedInvoiceData,
  templateType: InvoiceTemplateType
): string {
  const titles = INVOICE_TITLES[templateType] || { ar: 'فاتورة', en: 'INVOICE' };
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const logoUrl = shared.logoPath?.startsWith('/') 
    ? `${baseUrl}${shared.logoPath}` 
    : shared.logoPath || `${baseUrl}/logofaresgold.svg`;

  if (!individual.showHeader) return '';

  return `
    <div class="u-header">
      ${shared.showInvoiceTitle !== false ? `
      <div class="u-header-left">
        <h1 class="u-title">${titles.en}</h1>
        <div class="u-meta">
          رقم الفاتورة: ${data.invoiceNumber}<br/>
          التاريخ: ${data.invoiceDate}
          ${data.contractNumber ? `<br/>رقم العقد: ${data.contractNumber}` : ''}
        </div>
      </div>
      ` : ''}
      
      <div class="u-header-right">
        ${shared.showLogo !== false ? `
          <img src="${logoUrl}" alt="Logo" class="u-logo" onerror="this.style.display='none'"/>
        ` : ''}
        
        ${shared.showContactInfo !== false ? `
        <div class="u-contact">
          ${shared.companyAddress ? `<div>${shared.companyAddress}</div>` : ''}
          ${shared.companyPhone ? `<div>هاتف: ${shared.companyPhone}</div>` : ''}
        </div>
        ` : ''}
        
        ${shared.showCompanyInfo !== false && (shared.showCompanyName !== false || shared.showCompanySubtitle !== false) ? `
        <div class="u-company">
          ${shared.showCompanyName !== false ? `<div class="u-company-name">${shared.companyName || ''}</div>` : ''}
          ${shared.showCompanySubtitle !== false && shared.companySubtitle ? `<div>${shared.companySubtitle}</div>` : ''}
        </div>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * توليد قسم العميل
 */
function generateCustomerSection(
  individual: IndividualInvoiceSettings,
  data: UnifiedInvoiceData
): string {
  if (!individual.showCustomerSection || !data.customerName) return '';

  return `
    <div class="customer-section">
      <div class="customer-title">بيانات العميل</div>
      <div class="customer-details">
        <div><strong>الاسم:</strong> ${data.customerName}</div>
        ${data.customerCompany ? `<div><strong>الشركة:</strong> ${data.customerCompany}</div>` : ''}
        ${data.customerPhone ? `<div><strong>الهاتف:</strong> ${data.customerPhone}</div>` : ''}
        ${data.customerPeriod ? `<div><strong>المدة:</strong> ${data.customerPeriod}</div>` : ''}
      </div>
    </div>
  `;
}

/**
 * توليد جدول العناصر
 */
function generateItemsTable(
  individual: IndividualInvoiceSettings,
  data: UnifiedInvoiceData
): string {
  if (!individual.showItemsSection || !data.items?.length) return '';

  const currency = data.currency?.symbol || 'د.ل';

  return `
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 40px;">م</th>
          <th>الوصف</th>
          ${data.items[0]?.size ? '<th>المقاس</th>' : ''}
          <th>الكمية</th>
          <th>السعر</th>
          <th>المجموع</th>
        </tr>
      </thead>
      <tbody>
        ${data.items.map((item, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${item.description}</td>
            ${item.size ? `<td>${item.size}</td>` : ''}
            <td>${item.quantity}</td>
            <td>${item.unitPrice.toLocaleString('en-US')} ${currency}</td>
            <td><strong>${item.total.toLocaleString('en-US')} ${currency}</strong></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

/**
 * توليد جدول الحركات المالية (لكشف الحساب)
 */
function generateTransactionsTable(
  individual: IndividualInvoiceSettings,
  data: UnifiedInvoiceData
): string {
  if (!individual.showTransactionsSection || !data.transactions?.length) return '';

  const currency = data.currency?.symbol || 'د.ل';

  return `
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 40px;">#</th>
          <th style="width: 80px;">التاريخ</th>
          <th>البيان</th>
          <th>المرجع</th>
          <th>مدين</th>
          <th>دائن</th>
          <th>الرصيد</th>
        </tr>
      </thead>
      <tbody>
        ${data.transactions.map((t, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${new Date(t.date).toLocaleDateString('ar-LY-u-nu-latn')}</td>
            <td style="text-align: right; padding-right: 10px;">${t.description}</td>
            <td>${t.reference || '—'}</td>
            <td style="color: #dc2626; font-weight: bold;">${t.debit > 0 ? `${currency} ${t.debit.toLocaleString('en-US')}` : '—'}</td>
            <td style="color: #16a34a; font-weight: bold;">${t.credit > 0 ? `${currency} ${t.credit.toLocaleString('en-US')}` : '—'}</td>
            <td><strong>${currency} ${t.balance.toLocaleString('en-US')}</strong></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

/**
 * توليد ملخص الرصيد
 */
function generateBalanceSummary(
  individual: IndividualInvoiceSettings,
  data: UnifiedInvoiceData
): string {
  if (!individual.showBalanceSummarySection || !data.balanceSummary) return '';

  const currency = data.currency?.symbol || 'د.ل';
  const { totalDebit, totalCredit, remaining } = data.balanceSummary;

  return `
    <div class="balance-summary">
      <div class="balance-title">ملخص الرصيد</div>
      <div class="totals-row" style="color: #dc2626;">
        <span>إجمالي المدين:</span>
        <span>${currency} ${totalDebit.toLocaleString('en-US')}</span>
      </div>
      <div class="totals-row" style="color: #16a34a;">
        <span>إجمالي الدائن:</span>
        <span>- ${currency} ${totalCredit.toLocaleString('en-US')}</span>
      </div>
      <div class="totals-row total-row">
        <span>الرصيد النهائي:</span>
        <span>${currency} ${Math.abs(remaining).toLocaleString('en-US')}${remaining < 0 ? ' (رصيد دائن)' : ''}</span>
      </div>
    </div>
  `;
}

/**
 * توليد قسم المجاميع
 */
function generateTotalsSection(
  individual: IndividualInvoiceSettings,
  data: UnifiedInvoiceData
): string {
  if (!individual.showTotalsSection) return '';

  const currency = data.currency?.symbol || 'د.ل';

  return `
    <div class="totals-section">
      ${data.subtotal !== undefined ? `
        <div class="totals-row subtotal-row">
          <span>المجموع الفرعي:</span>
          <span>${data.subtotal.toLocaleString('en-US')} ${currency}</span>
        </div>
      ` : ''}
      ${data.discount ? `
        <div class="totals-row discount-row">
          <span>الخصم:</span>
          <span>- ${data.discount.toLocaleString('en-US')} ${currency}</span>
        </div>
      ` : ''}
      <div class="totals-row total-row">
        <span>الإجمالي النهائي:</span>
        <span>${data.total.toLocaleString('en-US')} ${currency}</span>
      </div>
    </div>
  `;
}

/**
 * توليد قسم معلومات الدفع
 */
function generatePaymentSection(
  individual: IndividualInvoiceSettings,
  data: UnifiedInvoiceData
): string {
  if (!individual.showPaymentInfoSection || !data.paymentInfo) return '';

  const currency = data.currency?.symbol || 'د.ل';
  const { amount, method, reference, previousBalance, newBalance } = data.paymentInfo;

  return `
    <div class="payment-section">
      <div class="payment-title">معلومات الدفع</div>
      <div class="payment-details">
        <div><strong>المبلغ المدفوع:</strong> ${amount.toLocaleString('en-US')} ${currency}</div>
        <div><strong>طريقة الدفع:</strong> ${method}</div>
        ${reference ? `<div><strong>المرجع:</strong> ${reference}</div>` : ''}
        ${previousBalance !== undefined ? `<div><strong>الرصيد السابق:</strong> ${previousBalance.toLocaleString('en-US')} ${currency}</div>` : ''}
        ${newBalance !== undefined ? `<div><strong>الرصيد الجديد:</strong> ${newBalance.toLocaleString('en-US')} ${currency}</div>` : ''}
      </div>
    </div>
  `;
}

/**
 * توليد قسم الملاحظات
 */
function generateNotesSection(
  individual: IndividualInvoiceSettings,
  data: UnifiedInvoiceData
): string {
  if (!individual.showNotesSection || !data.notes) return '';

  return `
    <div class="notes-section">
      <div class="notes-title">ملاحظات:</div>
      <div>${data.notes}</div>
    </div>
  `;
}

/**
 * توليد الفوتر الموحد
 */
function generateUnifiedFooter(shared: SharedInvoiceSettings): string {
  if (shared.showFooter === false) return '';

  return `
    <div class="u-footer">
      <span>${shared.footerText || 'شكراً لتعاملكم معنا'}</span>
      ${shared.showPageNumber !== false ? `<span class="u-inline-page-number">صفحة 1 من 1</span>` : ''}
    </div>
  `;
}

/**
 * توليد HTML الفاتورة الموحدة الكاملة
 */
export async function generateUnifiedInvoiceHTML(
  templateType: InvoiceTemplateType,
  data: UnifiedInvoiceData
): Promise<string> {
  // جلب الإعدادات
  const settings = await getInvoiceSettings();
  const shared = { ...DEFAULT_SHARED_SETTINGS, ...settings.shared };
  const individual = { ...DEFAULT_INDIVIDUAL_SETTINGS, ...settings.individual?.[templateType] };

  const titles = INVOICE_TITLES[templateType] || { ar: 'فاتورة', en: 'INVOICE' };

  const css = generateUnifiedCSS(shared, individual);
  const header = generateUnifiedHeader(shared, individual, data, templateType);
  const customer = generateCustomerSection(individual, data);
  const items = generateItemsTable(individual, data);
  const transactions = generateTransactionsTable(individual, data);
  const balanceSummary = generateBalanceSummary(individual, data);
  const payment = generatePaymentSection(individual, data);
  const totals = generateTotalsSection(individual, data);
  const notes = generateNotesSection(individual, data);
  const footer = generateUnifiedFooter(shared);

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${titles.ar} - ${data.invoiceNumber}</title>
      <style>${css}</style>
    </head>
    <body onload="window.print();">
      <div class="invoice-container">
        ${shared.backgroundImage ? '<div class="invoice-background"></div>' : ''}
        <div class="content-wrapper">
          ${header}
          ${customer}
          ${payment}
          ${items}
          ${transactions}
          ${balanceSummary}
          ${totals}
          ${notes}
          ${footer}
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * طباعة فاتورة موحدة
 */
export async function printUnifiedInvoice(
  templateType: InvoiceTemplateType,
  data: UnifiedInvoiceData
): Promise<void> {
  const html = await generateUnifiedInvoiceHTML(templateType, data);
  
  const printWindow = window.open('', '_blank', 'width=1200,height=800');
  if (!printWindow) {
    alert('يرجى السماح بفتح النوافذ المنبثقة');
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();
}
