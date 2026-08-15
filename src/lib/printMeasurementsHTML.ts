/**
 * Generate Measurements-Style HTML for Print
 * توليد HTML بنمط المقاسات للطباعة
 * 
 * Replicates the exact structure of SizesInvoicePrintDialog
 */

import { PrintConfig, PrintColumn, PrintTotalsItem, PrintPartyData, PrintDocumentData } from './printMeasurementsTypes';

export interface MeasurementsHTMLOptions {
  config: PrintConfig;
  documentData: PrintDocumentData;
  partyData?: PrintPartyData;
  columns: PrintColumn[];
  rows: Record<string, any>[];
  totals?: PrintTotalsItem[];
  totalsTitle?: string;
  notes?: string;
  statisticsCards?: { label: string; value: string | number; unit?: string }[];
  paymentDetailsTable?: { label: string; value: string }[];
  customHeaderHtml?: string; // Custom HTML to show at the top before table
  additionalContent?: string; // Custom HTML to append after table
 headerSwap?: boolean; // تبديل نصفي الهيدر (يمين يسار)
}

/**
 * Generate header HTML matching SizesInvoicePrintDialog
 */
const generateHeader = (config: PrintConfig, documentData: PrintDocumentData, headerSwap?: boolean): string => {
  if (!config.header.enabled) return '';

  const { header, companyInfo } = config;
  const headerStyle = (header as any).headerStyle || 'classic';
  
  const titleSide = `
    <div class="measurements-header-title">
      <h1 class="measurements-title">${documentData.title || header.title.text}</h1>
      <div class="measurements-title-info">
        ${documentData.date ? `التاريخ: <span class="en-text">${documentData.date}</span><br/>` : ''}
        ${documentData.documentNumber ? `${documentData.documentNumberLabel ?? 'رقم المستند'}: <span class="en-text">${documentData.documentNumber}</span>` : ''}
        ${documentData.additionalInfo?.map(info => 
          `<br/>${info.label}: <span class="en-text">${info.value}</span>`
        ).join('') || ''}
      </div>
    </div>
  `;

  const companySide = `
    <div class="measurements-header-company">
      ${header.logo.enabled && header.logo.url ? `
        <img src="${header.logo.url}" alt="Logo" class="measurements-logo" onerror="this.style.display='none'" />
      ` : ''}
      
      ${companyInfo.enabled ? `
        <div class="measurements-company-info">
          ${companyInfo.name ? `<div class="measurements-company-name">${companyInfo.name}</div>` : ''}
          ${companyInfo.subtitle ? `<div>${companyInfo.subtitle}</div>` : ''}
          ${companyInfo.address ? `<div>${companyInfo.address}</div>` : ''}
          ${companyInfo.phone ? `<div>هاتف: <span class="en-text" style="direction: ltr; display: inline-block;">${companyInfo.phone}</span></div>` : ''}
        </div>
      ` : ''}
    </div>
  `;

  // ✅ Apply header_style layout class + swap logic
  const styleClass = `measurements-header measurements-header-${headerStyle}${headerSwap ? ' measurements-header-swapped' : ''}`;

  // For 'centered' and 'simple' styles, render vertically
  if (headerStyle === 'centered') {
    return `
      <div class="${styleClass}">
        ${header.logo.enabled && header.logo.url ? `<img src="${header.logo.url}" alt="Logo" class="measurements-logo" onerror="this.style.display='none'" />` : ''}
        ${companyInfo.enabled && companyInfo.name ? `<div class="measurements-company-name" style="text-align:center;">${companyInfo.name}</div>` : ''}
        <h1 class="measurements-title" style="text-align:center;">${documentData.title || header.title.text}</h1>
        <div class="measurements-title-info" style="text-align:center;">
          ${documentData.date ? `التاريخ: <span class="en-text">${documentData.date}</span> | ` : ''}
          ${documentData.documentNumber ? `${documentData.documentNumberLabel ?? 'رقم المستند'}: <span class="en-text">${documentData.documentNumber}</span>` : ''}
        </div>
      </div>
    `;
  }

  if (headerStyle === 'simple') {
    return `
      <div class="${styleClass}">
        ${header.logo.enabled && header.logo.url ? `<img src="${header.logo.url}" alt="Logo" class="measurements-logo" style="height:${parseInt(header.logo.height) * 0.7}px;" onerror="this.style.display='none'" />` : ''}
        ${companyInfo.enabled && companyInfo.name ? `<div class="measurements-company-name" style="text-align:center;">${companyInfo.name}</div>` : ''}
      </div>
    `;
  }

  if (headerStyle === 'minimal') {
    return `
      <div class="${styleClass}">
        ${header.logo.enabled && header.logo.url ? `<img src="${header.logo.url}" alt="Logo" class="measurements-logo" style="height:24px;" onerror="this.style.display='none'" />` : ''}
        ${companyInfo.enabled && companyInfo.name ? `<span class="measurements-company-name" style="font-size:12px;margin:0;">${companyInfo.name}</span>` : ''}
        <span style="flex:1;"></span>
        <span style="font-size:10px;color:#666;">
          ${documentData.title || header.title.text}
          ${documentData.documentNumber ? ` — ${documentData.documentNumber}` : ''}
        </span>
      </div>
    `;
  }

  // 'classic' and 'modern' use the two-column layout
  // Swap is handled by reordering DOM children (not CSS flex-direction, which conflicts with RTL)
  // Default RTL: first child = RIGHT, second child = LEFT
  // headerSwap=true: company/logo on RIGHT, title on LEFT → swap DOM order

  if (headerSwap) {
    // Swapped: company on RIGHT (first in RTL), title on LEFT (second in RTL)
    return `
      <div class="${styleClass}">
        <div style="flex:1; text-align:right; display:flex; flex-direction:column; align-items:flex-start;">
          ${companySide}
        </div>
        <div style="flex:1; text-align:left; display:flex; flex-direction:column; align-items:flex-end;">
          ${titleSide}
        </div>
      </div>
    `;
  }

  // Default: title on RIGHT (first in RTL), company on LEFT (second in RTL)
  return `
    <div class="${styleClass}">
      ${titleSide}
      ${companySide}
    </div>
  `;
};

/**
 * Generate customer/party section matching SizesInvoicePrintDialog
 */
const generatePartySection = (
  config: PrintConfig, 
  partyData?: PrintPartyData,
  statisticsCards?: { label: string; value: string | number; unit?: string }[]
): string => {
  if (!config.partyInfo.enabled || !partyData) return '';

  return `
    <div class="measurements-customer-section">
      <div class="measurements-customer-info">
        <div class="measurements-customer-label">العميل</div>
        <div class="measurements-customer-name">${partyData.name}</div>
        ${partyData.company ? `<div class="measurements-customer-company">${partyData.company}</div>` : ''}
      </div>
      
      ${statisticsCards && statisticsCards.length > 0 ? `
        <div class="measurements-stats-cards">
          ${statisticsCards.map(card => `
            <div class="measurements-stat-card">
              <div class="measurements-stat-value">${card.value}</div>
              <div class="measurements-stat-label">${card.label}${card.unit ? ` ${card.unit}` : ''}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
};

/**
 * Generate table with full grid borders - the "Measurements" look
 */
const generateTable = (
  config: PrintConfig,
  columns: PrintColumn[],
  rows: Record<string, any>[],
  totals?: PrintTotalsItem[],
  totalsTitle?: string
): string => {
  const colCount = columns.length;
  
  // Generate header cells
  const headerCells = columns.map(col => `
    <th style="width: ${col.width || 'auto'}; text-align: ${col.align || 'center'};">
      ${col.header}
    </th>
  `).join('');

  // Generate body rows
  const bodyRows = rows.map((row, idx) => {
    const cells = columns.map(col => {
      const value = row[col.key];
      const displayValue = col.format ? col.format(value) : (value ?? '');
      return `<td style="text-align: ${col.align || 'center'};">${displayValue}</td>`;
    }).join('');
    
    return `<tr class="${idx % 2 === 0 ? 'even-row' : 'odd-row'}">${cells}</tr>`;
  }).join('');

  // Generate totals rows (inside tbody, after data rows)
  let totalsHTML = '';
  if (config.totals.enabled && totals && totals.length > 0) {
    // Use 2 columns for value to give it more space when there are many columns
    const valueColSpan = colCount > 8 ? 3 : 1;
    const labelColSpan = colCount - valueColSpan;
    
    totalsHTML = totals.map((item, idx) => {
      const isLast = idx === totals.length - 1;
      const rowClass = isLast ? 'grand-total-row' : 'subtotal-row';
      
      return `
        <tr class="${rowClass}">
          <td colspan="${labelColSpan}" class="totals-label">${item.label}</td>
          <td colspan="${valueColSpan}" class="totals-value">${typeof item.value === 'number' ? item.value.toLocaleString('ar-SA') : item.value}</td>
        </tr>
      `;
    }).join('');
  }

  return `
    <table class="measurements-table">
      <thead>
        <tr>${headerCells}</tr>
      </thead>
      <tbody>
        ${bodyRows}
        ${totalsHTML}
      </tbody>
    </table>
  `;
};

/**
 * Generate notes section
 */
const generateNotes = (config: PrintConfig, notes?: string): string => {
  const content = notes || config.notes.content;
  if (!config.notes.enabled || !content) return '';

  return `
    <div class="measurements-notes">
      <div class="measurements-notes-title">${config.notes.title}</div>
      <div class="measurements-notes-content">${content}</div>
    </div>
  `;
};

/**
 * Generate footer
 */
const generateFooter = (config: PrintConfig): string => {
  if (!config.footer.enabled) return '';

  return `
    <div class="measurements-footer">
      ${config.footer.text ? `<div>${config.footer.text}</div>` : ''}
      ${config.footer.showPageNumber ? `<div class="measurements-page-number">${config.footer.pageNumberFormat.replace('{page}', '1')}</div>` : ''}
    </div>
  `;
};

/**
 * Generate CSS matching SizesInvoicePrintDialog exactly
 */
export const generateMeasurementsCSS = (config: PrintConfig): string => {
  const { page, header, companyInfo, partyInfo, table, totals, footer, notes } = config;
  
  return `
    @font-face { font-family: 'Doran'; src: url('/Doran-Regular.otf') format('opentype'); font-weight: 400; }
    @font-face { font-family: 'Doran'; src: url('/Doran-Bold.otf') format('opentype'); font-weight: 700; }
    @font-face { font-family: 'Manrope'; src: url('/Manrope-Regular.otf') format('opentype'); font-weight: 400; }
    @font-face { font-family: 'Manrope'; src: url('/Manrope-Bold.otf') format('opentype'); font-weight: 700; }
    
    * { 
      margin: 0; 
      padding: 0; 
      box-sizing: border-box !important; 
      -webkit-print-color-adjust: exact !important; 
      print-color-adjust: exact !important; 
      color-adjust: exact !important; 
    }
    
    html, body { 
      font-family: ${page.fontFamily};
      direction: ${page.direction};
      background: #ffffff !important;
      color: ${table.body.textColor};
      font-size: ${page.fontSize};
      line-height: ${page.lineHeight};
    }
    
    .measurements-container {
      width: ${page.width};
      max-width: ${page.width};
      min-height: ${page.minHeight};
      padding: ${page.padding.top} ${page.padding.right} ${page.padding.bottom} ${page.padding.left};
      background: #ffffff;
      position: relative;
      box-sizing: border-box;
      overflow: hidden;
    }
    
    /* Header Styles - Base */
    .measurements-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: ${header.borderBottom};
      gap: 16px;
    }
    
    /* Header Style Variants */
    .measurements-header-centered {
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 8px;
    }
    
    .measurements-header-simple {
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 6px;
      padding-bottom: 10px;
    }
    
    .measurements-header-minimal {
      flex-direction: row;
      align-items: center;
      gap: 10px;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    
    .measurements-header-title {
      flex: 1;
      text-align: right;
      direction: rtl;
    }
    
    .measurements-title {
      font-size: ${header.title.fontSize};
      font-weight: ${header.title.fontWeight};
      color: ${header.title.color};
      font-family: 'Doran', 'Noto Sans Arabic', 'Cairo', 'Tajawal', sans-serif;
      letter-spacing: 1px;
      margin: 0;
      text-align: right;
    }
    
    .measurements-title-info {
      font-size: 11px;
      color: #333333;
      margin-top: 8px;
      line-height: 1.8;
      direction: rtl;
      text-align: right;
      white-space: nowrap;
    }
    
    .measurements-header-company {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
    }
    
    .measurements-logo {
      height: ${header.logo.height};
      object-fit: contain;
      max-width: ${Math.max(240, parseInt(header.logo.height) * 2.5)}px;
      flex-shrink: 0;
    }
    
    .measurements-company-info {
      font-size: ${companyInfo.fontSize};
      color: ${companyInfo.color};
      line-height: 1.6;
      text-align: right;
    }
    
    .measurements-company-name {
      font-weight: bold;
      font-size: 14px;
      color: ${table.header.backgroundColor};
      margin-bottom: 2px;
    }
    
    /* Customer Section */
    .measurements-customer-section {
      background: linear-gradient(135deg, ${partyInfo.backgroundColor}, #ffffff);
      padding: ${partyInfo.padding};
      margin-bottom: ${partyInfo.marginBottom};
      border-radius: ${partyInfo.borderRadius};
      border-right: 5px solid ${partyInfo.borderColor};
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .measurements-customer-label {
      font-size: ${partyInfo.contentFontSize};
      color: ${partyInfo.contentColor};
      opacity: 0.7;
      margin-bottom: 4px;
    }
    
    .measurements-customer-name {
      font-size: calc(${header.title.fontSize} - 4px);
      font-weight: bold;
      color: ${partyInfo.titleColor};
      font-family: 'Doran', 'Noto Sans Arabic', 'Cairo', 'Tajawal', sans-serif;
    }
    
    .measurements-stats-cards {
      display: flex;
      gap: 20px;
      flex-wrap: nowrap;
    }
    
    .measurements-stat-card {
      text-align: center;
      white-space: nowrap;
    }
    
    .measurements-stat-value {
      font-size: ${header.title.fontSize};
      font-weight: bold;
      color: #000000;
      font-family: 'Manrope', sans-serif;
      white-space: nowrap;
    }
    
    .measurements-stat-label {
      font-size: 10px;
      color: ${partyInfo.contentColor};
      opacity: 0.7;
    }
    
    /* Table Styles - Full Grid Borders */
    .measurements-table {
      width: ${table.width};
      max-width: 100%;
      border-collapse: ${table.borderCollapse};
      font-size: ${table.body.fontSize};
      line-height: ${(table as any).lineHeight || '1.4'};
      page-break-inside: auto;
      table-layout: fixed;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    
    .measurements-table thead tr {
      background-color: ${table.header.backgroundColor} !important;
      ${(table as any).headerHeight ? `height: ${(table as any).headerHeight}px;` : ''}
    }
    
    .measurements-table th {
      padding: ${table.header.padding};
      color: ${table.header.textColor};
      border: ${table.border.width} ${table.border.style} ${table.border.color};
      text-align: ${table.header.textAlign};
      font-weight: ${table.header.fontWeight};
      font-size: ${table.header.fontSize};
      white-space: pre-line;
      line-height: 1.3;
    }
    
    .measurements-table td {
      padding: ${table.body.padding};
      border: ${table.border.width} ${table.border.style} ${table.border.color};
      color: ${table.body.textColor};
    }
    
    .measurements-table tbody tr {
      ${(table as any).bodyRowHeight ? `height: ${(table as any).bodyRowHeight}px;` : ''}
    }
    
    .measurements-table .even-row {
      background-color: ${table.body.evenRowBackground};
    }
    
    .measurements-table .odd-row {
      background-color: ${table.body.oddRowBackground};
    }
    
    .measurements-table tr:hover {
      background-color: rgba(0,0,0,0.02);
    }
    
    /* Subtotal Row */
    .measurements-table .subtotal-row {
      background-color: ${partyInfo.backgroundColor} !important;
    }
    
    .measurements-table .subtotal-row td {
      font-weight: bold;
    }
    
    /* Grand Total Row */
    .measurements-table .grand-total-row {
      background-color: ${totals.backgroundColor} !important;
    }
    
    .measurements-table .grand-total-row td {
      color: ${totals.textColor};
      font-weight: ${totals.valueFontWeight};
      padding: ${totals.padding};
    }
    
    .measurements-table .grand-total-row .totals-label {
      text-align: left;
      font-size: ${totals.titleFontSize};
      white-space: nowrap;
    }
    
    .measurements-table .grand-total-row .totals-value {
      text-align: center;
      font-size: ${totals.valueFontSize};
      font-family: 'Manrope', sans-serif;
      white-space: nowrap;
    }
    
    /* Notes Section */
    .measurements-notes {
      margin-top: ${notes.marginTop};
      padding: ${notes.padding};
      background-color: ${notes.backgroundColor};
      border: 1px solid ${notes.borderColor};
      border-radius: 8px;
    }
    
    .measurements-notes-title {
      font-weight: bold;
      margin-bottom: 8px;
      color: ${notes.color};
    }
    
    .measurements-notes-content {
      font-size: ${notes.fontSize};
      color: ${notes.color};
      line-height: 1.6;
    }
    
    /* Footer */
    .measurements-footer {
      margin-top: ${footer.marginTop};
      padding: ${footer.padding};
      border-top: ${footer.borderTop};
      text-align: ${footer.alignment};
      font-size: ${footer.fontSize};
      color: ${footer.color};
    }
    
    /* Swapped header - force all children to inherit parent alignment */
    .measurements-header-swapped .measurements-header-title,
    .measurements-header-swapped .measurements-header-title .measurements-title,
    .measurements-header-swapped .measurements-header-title .measurements-title-info {
      text-align: left !important;
    }
    .measurements-header-swapped .measurements-header-company,
    .measurements-header-swapped .measurements-company-info,
    .measurements-header-swapped .measurements-company-name {
      text-align: right !important;
      align-items: flex-start !important;
    }
    
    /* Modern style class */
    .measurements-header-modern .measurements-header-company {
      order: -1;
    }
    
    /* Utility Classes */
    .en-text {
      font-family: 'Manrope', sans-serif;
      direction: ltr;
      unicode-bidi: isolate;
      display: inline-block;
      white-space: nowrap;
    }
    
    /* Print Media */
    @media print {
      @page { 
        size: A4; 
        margin: 10mm;
      }
      
      * { 
        -webkit-print-color-adjust: exact !important; 
        print-color-adjust: exact !important; 
        color-adjust: exact !important; 
      }
      
      html, body { 
        background: #ffffff !important; 
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
      }
      
      .measurements-container {
        width: 100%;
        min-height: auto;
        padding: 5mm;
        box-sizing: border-box;
      }
      
      .measurements-table thead tr {
        background-color: ${table.header.backgroundColor} !important;
      }
      
      .measurements-table .grand-total-row {
        background-color: ${totals.backgroundColor} !important;
      }
      
      /* Prevent page breaks in important sections */
      .measurements-customer-section,
      .measurements-notes,
      .measurements-footer {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      
      .measurements-table tr {
        page-break-inside: avoid;
      }
    }
  `;
};

/**
 * Generate payment details table HTML
 */
const generatePaymentDetailsTable = (
  config: PrintConfig,
  paymentDetails?: { label: string; value: string }[]
): string => {
  if (!paymentDetails || paymentDetails.length === 0) return '';

  const rows = paymentDetails.map((item, idx) => `
    <tr class="${idx % 2 === 0 ? 'even-row' : 'odd-row'}">
      <td style="text-align: right; font-weight: 600; width: 35%;">${item.label}</td>
      <td style="text-align: center;">${item.value}</td>
    </tr>
  `).join('');

  return `
    <div class="payment-details-section" style="margin-bottom: 15px;">
      <div style="font-size: 14px; font-weight: bold; margin-bottom: 8px; color: #333;">تفاصيل السداد</div>
      <table class="measurements-table" style="width: 100%;">
        <thead>
          <tr>
            <th style="width: 35%; text-align: right;">البيان</th>
            <th style="width: 65%; text-align: center;">القيمة</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
};

/**
 * Generate complete HTML document for measurements-style print
 */
export const generateMeasurementsHTML = (options: MeasurementsHTMLOptions): string => {
  const { config, documentData, partyData, columns, rows, totals, totalsTitle, notes, statisticsCards, paymentDetailsTable, customHeaderHtml, additionalContent, headerSwap } = options;

  const css = generateMeasurementsCSS(config);
  const headerHTML = generateHeader(config, documentData, headerSwap);
  const partyHTML = generatePartySection(config, partyData, statisticsCards);
  const paymentDetailsHTML = generatePaymentDetailsTable(config, paymentDetailsTable);
  const tableHTML = generateTable(config, columns, rows, totals, totalsTitle);
  const notesHTML = generateNotes(config, notes);
  const footerHTML = generateFooter(config);

  return `
    <!DOCTYPE html>
    <html dir="${config.page.direction}" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>${documentData.title || 'طباعة'}</title>
      <style>${css}</style>
    </head>
    <body>
      <div class="measurements-container">
        ${headerHTML}
        ${partyHTML}
        ${customHeaderHtml || ''}
        ${paymentDetailsHTML}
        ${tableHTML}
        ${additionalContent || ''}
        ${notesHTML}
        ${footerHTML}
      </div>
    </body>
    </html>
  `;
};

/**
 * Open measurements-style print preview in dialog
 */
export const openMeasurementsPrintWindow = async (
  options: MeasurementsHTMLOptions,
  title?: string,
  driveFolder?: string,
  phone?: string
): Promise<null> => {
  const html = generateMeasurementsHTML(options);
  const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
  showPrintPreview(html, title || 'معاينة الطباعة', driveFolder, phone);
  return null;
};
export default generateMeasurementsHTML;
