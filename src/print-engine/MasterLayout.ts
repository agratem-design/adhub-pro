/**
 * MasterLayout - نظام التصميم الموحد للطباعة
 * 
 * ⚠️ يُستخدم لجميع أنواع المستندات (الفاتورة، كشف الحساب، الإيصال، إلخ)
 * ✅ جميع المستندات تستخدم نفس HTML/CSS
 */

import { PrintTheme, DocumentHeaderData, PartyData } from './types';
import { generatePrintCSS } from './generatePrintCSS';
import { generatePrintHeader } from './PrintHeader';
import { generatePrintFooter } from './PrintFooter';
import { generatePartySection } from './PrintPartySection';

// =====================================================
// أنواع البيانات
// =====================================================

export interface TableColumn {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export interface TableRow {
  [key: string]: string | number | null;
  _rowClass?: string;
}

export interface TotalsItem {
  label: string;
  value: string;
  isHighlighted?: boolean;
  className?: string;
}

export interface MasterLayoutOptions {
  theme: PrintTheme;
  title: string;
  headerData: DocumentHeaderData;
  logoDataUri: string;
  partyData?: PartyData;
  
  // ✅ بيانات الجدول الديناميكي
  tableColumns: TableColumn[];
  tableRows: TableRow[];
  
  // ✅ صفوف الإجماليات (أسفل الجدول)
  tableTotalsRows?: {
    label: string;
    colSpan: number;
    values: { value: string; className?: string }[];
    className?: string;
  }[];
  
  // ✅ صندوق الإجماليات الموحد
  totalsData: TotalsItem[];
  totalsTitle?: string;
  
  // ✅ محتوى إضافي (مثل المبلغ بالكلمات)
  additionalContent?: string;
}

// =====================================================
// توليد CSS للإجماليات الموحدة
// =====================================================

function generateTotalsBoxCSS(theme: PrintTheme): string {
  return `
    /* ===== INTEGRATED TFOOT TOTALS ===== */
    .print-table tfoot {
      display: table-footer-group;
    }
    
    .print-table tfoot tr.tfoot-totals-row {
      background: ${theme.totalsBoxBgColor || theme.accentColor} !important;
      page-break-inside: avoid;
    }
    
    .print-table tfoot tr.tfoot-totals-row td {
      border: 1px solid ${theme.totalsBoxBorderColor || theme.primaryColor};
      padding: 0 !important;
    }
    
    .print-table tfoot tr.tfoot-totals-row td.no-border {
      border: none !important;
      background: transparent !important;
    }
    
    .tfoot-totals-container {
      padding: 15px;
      background: ${theme.totalsBoxBgColor || '#f8f9fa'};
    }
    
    .tfoot-totals-title {
      font-size: ${theme.totalsTitleFontSize || 14}px;
      font-weight: 700;
      color: ${theme.primaryColor};
      text-align: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid ${theme.totalsBoxBorderColor || theme.primaryColor};
    }
    
    .tfoot-totals-grid {
      display: flex;
      justify-content: space-around;
      text-align: center;
      flex-wrap: wrap;
      gap: 10px;
    }
    
    .tfoot-totals-item {
      padding: 8px 15px;
      min-width: 100px;
    }
    
    .tfoot-totals-value {
      font-size: ${theme.totalsValueFontSize || 16}px;
      font-weight: 700;
      margin-bottom: 4px;
      color: ${theme.totalsBoxTextColor || '#333333'};
    }
    
    .tfoot-totals-value.positive { color: #27ae60; }
    .tfoot-totals-value.negative { color: #e74c3c; }
    .tfoot-totals-value.neutral { color: ${theme.primaryColor}; }
    .tfoot-totals-value.highlighted { 
      color: ${theme.primaryColor}; 
      font-size: ${(theme.totalsValueFontSize || 16) + 2}px;
    }
    
    .tfoot-totals-label {
      font-size: 11px;
      color: #666;
    }
    
    .tfoot-additional-content {
      margin-top: 10px;
      padding: 10px;
      background: #fff;
      border: 1px dashed ${theme.primaryColor};
      text-align: center;
      font-size: 12px;
      color: #666;
    }
  `;
}

// =====================================================
// توليد الجدول الديناميكي
// =====================================================

function generateDynamicTable(
  theme: PrintTheme,
  columns: TableColumn[],
  rows: TableRow[],
  totalsRows?: MasterLayoutOptions['tableTotalsRows'],
  totalsData?: TotalsItem[],
  totalsTitle?: string,
  additionalContent?: string
): string {
  const totalColumns = columns.length;
  
  // توليد الهيدر
  const headerCells = columns.map(col => `
    <th style="width: ${col.width || 'auto'}; text-align: ${col.align || 'center'};">
      ${col.label}
    </th>
  `).join('');

  // توليد الصفوف
  const bodyCells = rows.map((row, index) => {
    const rowClass = row._rowClass || (index % 2 === 0 ? 'even-row' : 'odd-row');
    const cells = columns.map(col => {
      const value = row[col.key] ?? '';
      const cellClass = col.className || '';
      return `<td class="${cellClass}" style="text-align: ${col.align || 'center'};">${value}</td>`;
    }).join('');
    return `<tr class="${rowClass}">${cells}</tr>`;
  }).join('');

  // توليد صفوف الإجماليات في tbody (إن وجدت)
  let totalsRowsHtml = '';
  if (totalsRows && totalsRows.length > 0) {
    totalsRowsHtml = totalsRows.map(row => {
      const labelCell = `<td colspan="${row.colSpan}" style="text-align: ${theme.direction === 'rtl' ? 'left' : 'right'}; font-weight: 700;">${row.label}</td>`;
      const valueCells = row.values.map(v => `<td class="${v.className || ''}">${v.value}</td>`).join('');
      return `<tr class="${row.className || 'totals-row'}">${labelCell}${valueCells}</tr>`;
    }).join('');
  }

  // ✅ توليد صندوق الإجماليات داخل tfoot (متصل بالجدول)
  let tfootHtml = '';
  if (totalsData && totalsData.length > 0) {
    const itemsHtml = totalsData.map(item => `
      <div class="tfoot-totals-item">
        <div class="tfoot-totals-value ${item.className || ''} ${item.isHighlighted ? 'highlighted' : ''}">${item.value}</div>
        <div class="tfoot-totals-label">${item.label}</div>
      </div>
    `).join('');

    tfootHtml = `
      <tfoot>
        <tr class="tfoot-totals-row">
          <td colspan="${totalColumns}" class="totals-cell">
            <div class="tfoot-totals-container">
              ${totalsTitle ? `<div class="tfoot-totals-title">${totalsTitle}</div>` : ''}
              <div class="tfoot-totals-grid">
                ${itemsHtml}
              </div>
              ${additionalContent ? `<div class="tfoot-additional-content">${additionalContent}</div>` : ''}
            </div>
          </td>
        </tr>
      </tfoot>
    `;
  }

  return `
    <table class="print-table">
      <thead>
        <tr>${headerCells}</tr>
      </thead>
      <tbody>
        ${bodyCells}
        ${totalsRowsHtml}
      </tbody>
      ${tfootHtml}
    </table>
  `;
}

// =====================================================
// الدالة الرئيسية: generateMasterLayout
// =====================================================

export function generateMasterLayout(options: MasterLayoutOptions): string {
  const {
    theme,
    title,
    headerData,
    logoDataUri,
    partyData,
    tableColumns,
    tableRows,
    tableTotalsRows,
    totalsData,
    totalsTitle,
    additionalContent,
  } = options;

  // توليد CSS الموحد
  const baseCss = generatePrintCSS(theme);
  const totalsBoxCss = generateTotalsBoxCSS(theme);

  // توليد المحتوى
  const headerHtml = generatePrintHeader(theme, headerData, logoDataUri);
  const partyHtml = partyData ? generatePartySection(partyData) : '';
  
  // ✅ الجدول يتضمن الآن صندوق الإجماليات داخل tfoot
  const tableHtml = generateDynamicTable(
    theme, 
    tableColumns, 
    tableRows, 
    tableTotalsRows,
    totalsData,
    totalsTitle,
    additionalContent
  );
  const footerHtml = generatePrintFooter(theme);

  return `
    <!DOCTYPE html>
    <html dir="${theme.direction}" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        ${baseCss}
        ${totalsBoxCss}
      </style>
    </head>
    <body dir="${theme.direction}" style="font-family: '${theme.fontFamily}', 'Noto Sans Arabic', sans-serif;">
      <div class="print-container">
        ${headerHtml}
        ${partyHtml}
        ${tableHtml}
        ${footerHtml}
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
}

// =====================================================
// فتح نافذة الطباعة
// =====================================================

export async function openMasterPrintWindow(htmlContent: string, filename: string): Promise<void> {
  const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
  showPrintPreview(htmlContent, filename, 'documents');
}
