/**
 * Unified Invoice Print System
 * نظام طباعة موحد لجميع الفواتير والكشوفات
 * 
 * يوفر:
 * - هيدر موحد (شعار، بيانات الشركة، عنوان الفاتورة)
 * - جدول موحد (أعمدة متناسقة، ألوان موحدة)
 * - مجاميع ملتصقة بالجدول
 * - فوتر موحد
 */

export interface UnifiedInvoiceStyles {
  // Company Info
  companyName: string;
  companySubtitle: string;
  companyAddress: string;
  companyPhone: string;
  logoPath: string;
  logoSize: number;
  
  // Colors
  primaryColor: string;
  secondaryColor: string;
  tableHeaderBgColor: string;
  tableHeaderTextColor: string;
  tableBorderColor: string;
  tableBorderWidth: number;
  tableBorderStyle: string;
  tableBorderRadius: number;
  tableRowEvenColor: string;
  tableRowOddColor: string;
  tableTextColor: string;
  tableRowOpacity: number;
  
  // Totals Colors
  subtotalBgColor: string;
  subtotalTextColor: string;
  discountTextColor: string;
  totalBgColor: string;
  totalTextColor: string;
  
  // Customer Section
  customerSectionBgColor: string;
  customerSectionBorderColor: string;
  customerSectionTitleColor: string;
  customerSectionTextColor: string;
  
  // Notes
  notesBgColor: string;
  notesBorderColor: string;
  notesTextColor: string;
  
  // Footer
  footerBgColor: string;
  footerTextColor: string;
  footerBorderColor: string;
  
  // Fonts
  fontFamily: string;
  headerFontSize: number;
  bodyFontSize: number;
  
  // Layout
  pageMarginTop: number;
  pageMarginRight: number;
  pageMarginBottom: number;
  pageMarginLeft: number;
  headerMarginBottom: number;
  footerPosition: number;
  
  // Background
  backgroundImage?: string;
  backgroundOpacity?: number;
  backgroundPosX?: number;
  backgroundPosY?: number;
  backgroundScale?: number;
}

// Default styles - empty company info to be filled from settings
export const DEFAULT_UNIFIED_STYLES: UnifiedInvoiceStyles = {
  companyName: '',
  companySubtitle: '',
  companyAddress: '',
  companyPhone: '',
  logoPath: '/logofaresgold.svg',
  logoSize: 70,
  
  primaryColor: '#D4AF37',
  secondaryColor: '#B8860B',
  tableHeaderBgColor: '#D4AF37',
  tableHeaderTextColor: '#ffffff',
  tableBorderColor: '#D4AF37',
  tableBorderWidth: 1,
  tableBorderStyle: 'solid',
  tableBorderRadius: 0,
  tableRowEvenColor: '#fefbf0',
  tableRowOddColor: '#ffffff',
  tableTextColor: '#333333',
  tableRowOpacity: 100,
  
  subtotalBgColor: '#fef9e7',
  subtotalTextColor: '#333333',
  discountTextColor: '#e74c3c',
  totalBgColor: '#D4AF37',
  totalTextColor: '#ffffff',
  
  customerSectionBgColor: '#fef9e7',
  customerSectionBorderColor: '#D4AF37',
  customerSectionTitleColor: '#D4AF37',
  customerSectionTextColor: '#333333',
  
  notesBgColor: '#f8f9fa',
  notesBorderColor: '#e9ecef',
  notesTextColor: '#333333',
  
  footerBgColor: 'transparent',
  footerTextColor: '#666666',
  footerBorderColor: '#D4AF37',
  
  fontFamily: 'Doran, Manrope, system-ui, sans-serif',
  headerFontSize: 14,
  bodyFontSize: 12,
  
  pageMarginTop: 15,
  pageMarginRight: 15,
  pageMarginBottom: 15,
  pageMarginLeft: 15,
  headerMarginBottom: 20,
  footerPosition: 15,
};

export function hexToRgba(hex: string, opacity: number): string {
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
}

export function formatArabicNumber(num: number): string {
  if (isNaN(num) || num === null || num === undefined) return '0';
  const numStr = num.toString();
  const parts = numStr.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (decimalPart) return `${formattedInteger}.${decimalPart}`;
  return formattedInteger;
}

export function formatArabicDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ar-LY-u-nu-latn', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Generate unified CSS for all invoices
 */
export function generateUnifiedCSS(styles: UnifiedInvoiceStyles, fontBaseUrl: string): string {
  const bgImageUrl = styles.backgroundImage ? 
    (styles.backgroundImage.startsWith('http') ? styles.backgroundImage : `${fontBaseUrl}${styles.backgroundImage}`) : '';
  
  return `
    @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap');
    @font-face { font-family: 'Doran'; src: url('${fontBaseUrl}/Doran-Bold.otf') format('opentype'); font-weight: 700; }
    @font-face { font-family: 'Doran'; src: url('${fontBaseUrl}/Doran-Regular.otf') format('opentype'); font-weight: 400; }
    @font-face { font-family: 'Doran'; src: url('${fontBaseUrl}/Doran-Medium.otf') format('opentype'); font-weight: 500; }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    html, body {
      height: 100%;
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: ${styles.tableTextColor};
      font-family: ${styles.fontFamily};
      direction: rtl;
    }
    
    .unified-paper {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: ${styles.pageMarginTop}mm ${styles.pageMarginRight}mm ${styles.pageMarginBottom}mm ${styles.pageMarginLeft}mm;
      background: #ffffff;
      position: relative;
      display: flex;
      flex-direction: column;
    }
    
    .unified-bg-layer {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      ${bgImageUrl ? `
        background-image: url('${bgImageUrl}');
        background-position: ${styles.backgroundPosX || 50}% ${styles.backgroundPosY || 50}%;
        background-repeat: no-repeat;
        background-size: ${styles.backgroundScale || 100}%;
        opacity: ${(styles.backgroundOpacity || 10) / 100};
      ` : ''}
      pointer-events: none;
      z-index: 0;
    }
    
    .unified-content {
      position: relative;
      z-index: 1;
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    
    /* ===== UNIFIED HEADER - RTL ===== */
    .unified-header {
      display: flex;
      flex-direction: row-reverse;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: ${styles.headerMarginBottom}px;
      padding-bottom: 15px;
      border-bottom: 3px solid ${styles.primaryColor};
      direction: rtl;
    }
    
    .unified-header-right {
      flex: 0 0 50%;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
      text-align: right;
    }
    
    .unified-logo {
      height: ${styles.logoSize}px;
      object-fit: contain;
    }
    
    .unified-company-info {
      text-align: right;
      line-height: 1.6;
    }
    
    .unified-company-name {
      font-size: 22px;
      font-weight: 700;
      color: ${styles.primaryColor};
      margin-bottom: 2px;
    }
    
    .unified-company-subtitle {
      font-size: 14px;
      color: ${styles.secondaryColor};
      margin-bottom: 6px;
    }
    
    
    .unified-contact-info {
      font-size: 10px;
      color: ${styles.customerSectionTextColor};
    }
    
    .unified-header-left {
      flex: 0 0 45%;
      text-align: left;
      direction: ltr;
    }
    
    .unified-invoice-title {
      font-size: 28px;
      font-weight: 700;
      margin: 0 0 5px 0;
      font-family: Manrope, sans-serif;
      letter-spacing: 2px;
      color: ${styles.secondaryColor};
      text-transform: uppercase;
    }
    
    .unified-invoice-subtitle {
      font-size: 16px;
      font-weight: 600;
      color: ${styles.primaryColor};
      margin-bottom: 10px;
    }
    
    .unified-invoice-meta {
      font-size: 12px;
      color: ${styles.customerSectionTextColor};
      line-height: 1.8;
      padding: 8px 0;
      direction: rtl;
      text-align: right;
    }
    
    .unified-invoice-meta-row {
      display: flex;
      flex-direction: row;
      justify-content: flex-start;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }
    
    .unified-invoice-meta-label {
      font-weight: 700;
      color: ${styles.primaryColor};
      min-width: auto;
    }
    
    .unified-invoice-meta-value {
      font-weight: 500;
      color: ${styles.secondaryColor};
    }
    
    /* ===== CUSTOMER SECTION ===== */
    .unified-customer-section {
      background: ${styles.customerSectionBgColor};
      border-right: 4px solid ${styles.customerSectionBorderColor};
      padding: 15px 20px;
      margin-bottom: 20px;
    }
    
    .unified-customer-title {
      font-size: ${styles.headerFontSize}px;
      font-weight: 700;
      color: ${styles.customerSectionTitleColor};
      margin-bottom: 10px;
    }
    
    .unified-customer-details {
      font-size: ${styles.bodyFontSize}px;
      color: ${styles.customerSectionTextColor};
      line-height: 1.8;
    }
    
    /* ===== UNIFIED TABLE ===== */
    .unified-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 0; /* المجاميع ملتصقة */
      font-size: ${styles.bodyFontSize}px;
      ${styles.tableBorderRadius ? `border-radius: ${styles.tableBorderRadius}px; overflow: hidden;` : ''}
    }
    
    .unified-table thead th {
      background: ${styles.tableHeaderBgColor};
      color: ${styles.tableHeaderTextColor};
      padding: 12px 8px;
      text-align: center;
      font-weight: 700;
      font-size: ${styles.headerFontSize}px;
      border: ${styles.tableBorderWidth || 1}px ${styles.tableBorderStyle || 'solid'} ${styles.tableBorderColor};
    }
    
    .unified-table tbody td {
      border: ${styles.tableBorderWidth || 1}px ${styles.tableBorderStyle || 'solid'} ${styles.tableBorderColor};
      padding: 10px 8px;
      text-align: center;
      vertical-align: middle;
      color: ${styles.tableTextColor};
    }
    
    .unified-table tbody tr:nth-child(even) {
      background: ${hexToRgba(styles.tableRowEvenColor, styles.tableRowOpacity)};
    }
    
    .unified-table tbody tr:nth-child(odd) {
      background: ${hexToRgba(styles.tableRowOddColor, styles.tableRowOpacity)};
    }
    
    .unified-table .text-right { text-align: right; }
    .unified-table .text-left { text-align: left; }
    .unified-table .text-bold { font-weight: 700; }
    
    /* ===== TOTALS INSIDE TABLE ===== */
    .unified-table .totals-row {
      background: ${styles.subtotalBgColor} !important;
    }
    
    .unified-table .totals-row td {
      padding: 12px 8px;
      font-weight: 600;
      color: ${styles.subtotalTextColor};
    }
    
    .unified-table .discount-row {
      background: #fff5f5 !important;
    }
    
    .unified-table .discount-row td {
      color: ${styles.discountTextColor};
    }
    
    .unified-table .grand-total-row {
      background: ${styles.totalBgColor} !important;
    }
    
    .unified-table .grand-total-row td {
      padding: 15px 12px;
      font-weight: 700;
      font-size: ${styles.headerFontSize + 2}px;
      color: ${styles.totalTextColor};
    }
    
    /* ===== BALANCE SUMMARY ===== */
    .unified-balance-summary {
      margin-top: 25px;
      padding: 20px;
      background: ${styles.customerSectionBgColor};
      border: 2px solid ${styles.primaryColor};
      border-radius: 8px;
    }
    
    .unified-balance-title {
      font-size: ${styles.headerFontSize + 2}px;
      font-weight: 700;
      color: ${styles.primaryColor};
      text-align: center;
      margin-bottom: 15px;
    }
    
    .unified-balance-grid {
      display: flex;
      justify-content: space-around;
      text-align: center;
    }
    
    .unified-balance-item {
      padding: 10px 20px;
    }
    
    .unified-balance-value {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 5px;
    }
    
    .unified-balance-value.positive { color: #27ae60; }
    .unified-balance-value.negative { color: #e74c3c; }
    .unified-balance-value.neutral { color: ${styles.primaryColor}; }
    
    .unified-balance-label {
      font-size: 12px;
      color: ${styles.customerSectionTextColor};
    }
    
    /* ===== NOTES SECTION ===== */
    .unified-notes {
      margin-top: 20px;
      padding: 15px;
      background: ${styles.notesBgColor};
      border: 1px solid ${styles.notesBorderColor};
      border-radius: 4px;
      font-size: ${styles.bodyFontSize}px;
      line-height: 1.8;
      color: ${styles.notesTextColor};
    }
    
    .unified-notes-title {
      font-weight: 700;
      color: ${styles.primaryColor};
      margin-bottom: 8px;
    }
    
    /* ===== UNIFIED FOOTER ===== */
    .unified-footer {
      margin-top: auto;
      padding-top: 15px;
      border-top: 2px solid ${styles.footerBorderColor};
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: ${styles.footerTextColor};
    }
    
    .unified-footer-text {
      flex: 1;
    }
    
    .unified-footer-page {
      text-align: left;
    }
    
    /* ===== SIGNATURES ===== */
    .unified-signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 40px;
      padding-top: 20px;
    }
    
    .unified-signature-box {
      text-align: center;
      width: 40%;
    }
    
    .unified-signature-line {
      border-top: 1px solid ${styles.tableBorderColor};
      padding-top: 10px;
      margin-top: 40px;
      font-size: 12px;
      color: ${styles.customerSectionTextColor};
    }
    
    @media print {
      html, body { background: white; }
      .unified-paper { 
        margin: 0; 
        border: none; 
        box-shadow: none;
        page-break-after: always;
      }
      @page { size: A4; margin: 0; }
    }
  `;
}

/**
 * Generate unified header HTML
 */
export function generateUnifiedHeader(opts: {
  styles: UnifiedInvoiceStyles;
  titleEn: string;
  titleAr?: string;
  invoiceNumber: string;
  date: string;
  additionalMeta?: Array<{ label: string; value: string }>;
  fontBaseUrl: string;
  showHijriDate?: boolean;
}): string {
  const { styles, titleEn, titleAr, invoiceNumber, date, additionalMeta, fontBaseUrl, showHijriDate } = opts;
  const fullLogoUrl = styles.logoPath.startsWith('http') ? styles.logoPath : `${fontBaseUrl}${styles.logoPath}`;
  
  let dateDisplay = formatArabicDate(date);
  if (showHijriDate) {
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      const hijri = new Intl.DateTimeFormat('ar-u-ca-islamic-umalqura-nu-latn', {
        day: 'numeric', month: 'long', year: 'numeric'
      }).format(d) + ' هـ';
      dateDisplay = `${dateDisplay} — ${hijri}`;
    } catch { /* ignore */ }
  }

  const metaRows = [
    { label: 'رقم الفاتورة', value: invoiceNumber },
    { label: 'التاريخ', value: dateDisplay },
    ...(additionalMeta || [])
  ];
  
  return `
    <div class="unified-header">
      <div class="unified-header-right">
        <img src="${fullLogoUrl}" alt="Logo" class="unified-logo" onerror="this.style.display='none'"/>
        <div class="unified-company-info">
          ${styles.companyName ? `<div class="unified-company-name">${styles.companyName}</div>` : ''}
          ${styles.companySubtitle ? `<div class="unified-company-subtitle">${styles.companySubtitle}</div>` : ''}
          <div class="unified-contact-info">
            ${styles.companyAddress ? `<div>${styles.companyAddress}</div>` : ''}
            ${styles.companyPhone ? `<div>هاتف: ${styles.companyPhone}</div>` : ''}
          </div>
        </div>
      </div>
      
      <div class="unified-header-left">
        <h1 class="unified-invoice-title">${titleEn}</h1>
        ${titleAr ? `<div class="unified-invoice-subtitle">${titleAr}</div>` : ''}
        <div class="unified-invoice-meta">
          ${metaRows.map(row => `
            <div class="unified-invoice-meta-row">
              <span class="unified-invoice-meta-label">${row.label}:</span>
              <span class="unified-invoice-meta-value">${row.value}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

/**
 * Generate customer section HTML
 */
export function generateCustomerSection(opts: {
  styles: UnifiedInvoiceStyles;
  title?: string;
  fields: Array<{ label: string; value: string }>;
}): string {
  const { styles, title = 'بيانات العميل', fields } = opts;
  
  return `
    <div class="unified-customer-section">
      <h3 class="unified-customer-title">${title}</h3>
      <div class="unified-customer-details">
        ${fields.map(f => `<div><strong>${f.label}:</strong> ${f.value}</div>`).join('')}
      </div>
    </div>
  `;
}

/**
 * Generate table with integrated totals
 */
export function generateUnifiedTable(opts: {
  styles: UnifiedInvoiceStyles;
  headers: string[];
  rows: Array<Array<string | number>>;
  totals?: {
    subtotal?: number;
    discount?: number;
    discountLabel?: string;
    total: number;
    currency?: string;
  };
  colSpan?: number;
}): string {
  const { styles, headers, rows, totals, colSpan } = opts;
  const currency = totals?.currency || 'د.ل';
  const totalColSpan = colSpan || headers.length - 1;
  
  return `
    <table class="unified-table">
      <thead>
        <tr>
          ${headers.map(h => `<th>${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row, idx) => `
          <tr>
            ${row.map((cell, cellIdx) => `
              <td class="${cellIdx === row.length - 1 ? 'text-bold' : ''}">${cell}</td>
            `).join('')}
          </tr>
        `).join('')}
        
        ${totals ? `
          <tr class="totals-row">
            <td colspan="${totalColSpan}" style="text-align:left;font-weight:700;">المجموع الفرعي</td>
            <td style="font-weight:700;">${formatArabicNumber(totals.subtotal || totals.total)} ${currency}</td>
          </tr>
          ${totals.discount && totals.discount > 0 ? `
            <tr class="discount-row">
              <td colspan="${totalColSpan}" style="text-align:left;">${totals.discountLabel || 'خصم'}</td>
              <td>- ${formatArabicNumber(totals.discount)} ${currency}</td>
            </tr>
          ` : ''}
          <tr class="grand-total-row">
            <td colspan="${totalColSpan}" style="text-align:left;">المجموع الإجمالي</td>
            <td>${formatArabicNumber(totals.total)} ${currency}</td>
          </tr>
        ` : ''}
      </tbody>
    </table>
  `;
}

/**
 * Generate balance summary section
 */
export function generateBalanceSummary(opts: {
  items: Array<{
    value: number;
    label: string;
    type: 'positive' | 'negative' | 'neutral';
  }>;
  title?: string;
  currency?: string;
}): string {
  const { items, title = 'ملخص الرصيد', currency = 'د.ل' } = opts;
  
  return `
    <div class="unified-balance-summary">
      <h3 class="unified-balance-title">${title}</h3>
      <div class="unified-balance-grid">
        ${items.map(item => `
          <div class="unified-balance-item">
            <div class="unified-balance-value ${item.type}">${formatArabicNumber(item.value)} ${currency}</div>
            <div class="unified-balance-label">${item.label}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Generate notes section
 */
export function generateNotesSection(notes: string, title = 'ملاحظات'): string {
  if (!notes) return '';
  return `
    <div class="unified-notes">
      <div class="unified-notes-title">${title}</div>
      <div>${notes}</div>
    </div>
  `;
}

/**
 * Generate unified footer
 */
export function generateUnifiedFooter(opts: {
  text?: string;
  pageNumber?: string;
}): string {
  const { text = 'شكراً لتعاملكم معنا', pageNumber = 'صفحة 1 من 1' } = opts;
  
  return `
    <div class="unified-footer">
      <div class="unified-footer-text">${text}</div>
      <div class="unified-footer-page">${pageNumber}</div>
    </div>
  `;
}

/**
 * Generate signatures section
 */
export function generateSignatures(labels: [string, string] = ['توقيع المستلم', 'توقيع المسؤول']): string {
  return `
    <div class="unified-signatures">
      <div class="unified-signature-box">
        <div class="unified-signature-line">${labels[0]}</div>
      </div>
      <div class="unified-signature-box">
        <div class="unified-signature-line">${labels[1]}</div>
      </div>
    </div>
  `;
}

/**
 * Generate complete invoice HTML
 */
export function generateCompleteInvoice(opts: {
  styles: UnifiedInvoiceStyles;
  titleEn: string;
  titleAr?: string;
  invoiceNumber: string;
  date: string;
  additionalMeta?: Array<{ label: string; value: string }>;
  customerFields: Array<{ label: string; value: string }>;
  tableHeaders: string[];
  tableRows: Array<Array<string | number>>;
  totals?: {
    subtotal?: number;
    discount?: number;
    discountLabel?: string;
    total: number;
    currency?: string;
  };
  balanceSummary?: {
    items: Array<{ value: number; label: string; type: 'positive' | 'negative' | 'neutral' }>;
    title?: string;
  };
  notes?: string;
  showSignatures?: boolean;
  footerText?: string;
  showHijriDate?: boolean;
}): string {
  const fontBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${opts.titleAr || opts.titleEn}</title>
  <style>${generateUnifiedCSS(opts.styles, fontBaseUrl)}</style>
</head>
<body>
  <div class="unified-paper">
    ${opts.styles.backgroundImage ? '<div class="unified-bg-layer"></div>' : ''}
    <div class="unified-content">
      ${generateUnifiedHeader({
        styles: opts.styles,
        titleEn: opts.titleEn,
        titleAr: opts.titleAr,
        invoiceNumber: opts.invoiceNumber,
        date: opts.date,
        additionalMeta: opts.additionalMeta,
        fontBaseUrl,
        showHijriDate: opts.showHijriDate
      })}
      
      ${generateCustomerSection({
        styles: opts.styles,
        fields: opts.customerFields
      })}
      
      ${generateUnifiedTable({
        styles: opts.styles,
        headers: opts.tableHeaders,
        rows: opts.tableRows,
        totals: opts.totals
      })}
      
      ${opts.balanceSummary ? generateBalanceSummary({
        items: opts.balanceSummary.items,
        title: opts.balanceSummary.title,
        currency: opts.totals?.currency
      }) : ''}
      
      ${opts.notes ? generateNotesSection(opts.notes) : ''}
      
      ${opts.showSignatures ? generateSignatures() : ''}
      
      ${generateUnifiedFooter({ text: opts.footerText })}
    </div>
  </div>
</body>
</html>`;
}
