/**
 * مولد HTML للطباعة الموحد
 * يُنشئ HTML كامل للطباعة مع دعم الإعدادات الديناميكية
 */

import { PrintSettings } from '@/types/print-settings';
import { getPrintLayoutConfig, PrintLayoutConfig } from './printLayoutHelper';
import { unifiedHeaderFooterCss, unifiedHeaderHtml, type UnifiedPrintStyles } from '@/lib/unifiedInvoiceBase';

// =====================================================
// الأنماط الأساسية المشتركة
// =====================================================

export function generateBasePrintCSS(config: PrintLayoutConfig): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
    
    @font-face { 
      font-family: 'Doran'; 
      src: url('/Doran-Bold.otf') format('opentype'); 
      font-weight: 700; 
    }
    @font-face { 
      font-family: 'Doran'; 
      src: url('/Doran-Regular.otf') format('opentype'); 
      font-weight: 400; 
    }
    @font-face { 
      font-family: 'Manrope'; 
      src: url('/Manrope-Bold.otf') format('opentype'); 
      font-weight: 700; 
    }
    @font-face { 
      font-family: 'Manrope'; 
      src: url('/Manrope-Regular.otf') format('opentype'); 
      font-weight: 400; 
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    html {
      direction: ${config.direction} !important;
    }
    
    body {
      width: 210mm;
      font-family: '${config.fontFamily}', 'Noto Sans Arabic', Arial, sans-serif !important;
      direction: ${config.direction} !important;
      text-align: ${config.textAlign};
      background: white;
      color: #333;
      font-size: ${config.bodyFontSize};
      line-height: 1.4;
      overflow: visible;
    }
    
    .print-container {
      width: 210mm;
      min-height: 297mm;
      padding: ${config.pageMargins.top} ${config.pageMargins.right} ${config.pageMargins.bottom} ${config.pageMargins.left};
      padding-bottom: 32mm;
      display: flex;
      flex-direction: column;
      margin: 0 auto;
    }
    
    /* ===== UNIFIED HEADER - from unifiedPrintFragments ===== */
    ${unifiedHeaderFooterCss({
      primaryColor: config.primaryColor,
      secondaryColor: config.secondaryColor,
      logoSize: parseInt(config.logoSize) || 200,
      headerFontSize: parseInt(config.headerFontSize) || 14,
      contactInfoFontSize: 10,
    })}
    
    /* ===== CUSTOMER/PARTY SECTION ===== */
    .party-section {
      background: ${config.accentColor};
      padding: 15px 20px;
      margin-bottom: 20px;
      border-${config.direction === 'rtl' ? 'right' : 'left'}: 4px solid ${config.primaryColor};
    }

    .party-title {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 10px;
      color: ${config.primaryColor};
    }

    .party-details {
      font-size: 12px;
      line-height: 1.8;
      color: #333;
    }

    /* ===== UNIFIED TABLE ===== */
    .print-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 0;
      table-layout: fixed;
      font-size: 11px;
    }

    .print-table thead { display: table-header-group; }
    .print-table tfoot { display: table-footer-group; }
    .print-table tr { page-break-inside: avoid; }

    .print-table th {
      background: ${config.tableHeaderBgColor};
      color: ${config.tableHeaderTextColor};
      padding: 12px 8px;
      text-align: center;
      font-weight: 700;
      border: ${(config as any).tableBorderWidth || 1}px ${(config as any).tableBorderStyle || 'solid'} ${config.tableBorderColor};
      font-size: 12px;
    }

    .print-table td {
      padding: 10px 8px;
      text-align: center;
      border: ${(config as any).tableBorderWidth || 1}px ${(config as any).tableBorderStyle || 'solid'} ${config.tableBorderColor};
      vertical-align: middle;
      color: #333;
    }

    .print-table td.text-right {
      text-align: right;
      padding-right: 8px;
    }

    .print-table td.text-left {
      text-align: left;
      padding-left: 8px;
    }

    .print-table tbody tr:nth-child(even) {
      background: ${config.tableRowEvenColor};
    }

    .print-table tbody tr:nth-child(odd) {
      background: ${config.tableRowOddColor};
    }

    .debit-cell {
      color: #dc2626;
      font-weight: 700;
    }

    .credit-cell {
      color: #16a34a;
      font-weight: 700;
    }

    .balance-cell {
      font-weight: 700;
      color: #333;
    }

    /* ===== TOTALS ROWS ===== */
    .totals-row {
      background: ${config.accentColor} !important;
    }

    .totals-row td {
      padding: 12px 8px !important;
      font-weight: 700;
      font-size: 13px;
    }

    .grand-total-row {
      background: ${config.primaryColor} !important;
    }

    .grand-total-row td {
      padding: 15px 12px !important;
      font-weight: 700;
      font-size: 16px;
      color: ${config.headerTextColor} !important;
    }

    /* ===== SUMMARY SECTION ===== */
    .summary-section {
      margin-top: 25px;
      padding: 20px;
      background: ${config.accentColor};
      border: 2px solid ${config.primaryColor};
      border-radius: 8px;
    }

    .summary-title {
      font-size: 16px;
      font-weight: 700;
      color: ${config.primaryColor};
      text-align: center;
      margin-bottom: 15px;
    }
    
    .summary-grid {
      display: flex;
      justify-content: space-around;
      text-align: center;
    }
    
    .summary-item {
      padding: 10px 20px;
    }
    
    .summary-value {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 5px;
    }
    
    .summary-value.positive { color: #27ae60; }
    .summary-value.negative { color: #e74c3c; }
    .summary-value.neutral { color: ${config.primaryColor}; }
    
    .summary-label {
      font-size: 12px;
      color: #666;
    }
    
    .amount-words {
      margin-top: 15px;
      padding: 12px;
      background: #fff;
      border: 1px dashed ${config.primaryColor};
      text-align: center;
      font-size: 13px;
      color: #666;
    }
    
    /* ===== UNIFIED FOOTER ===== */
    .print-footer {
      margin-top: auto;
      padding-top: 15px;
      border-top: 2px solid ${config.primaryColor};
      display: flex;
      flex-direction: ${config.flexDirection};
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: #666;
      text-align: ${config.footerTextAlign};
    }
    
    @page {
      size: A4 portrait;
      margin: 15mm;
    }
    
    /* ===== DARK MODE OVERRIDE ===== */
    html, body, .dark, [data-theme="dark"] {
      background-color: #ffffff !important;
      color: #333333 !important;
      color-scheme: light !important;
    }
    
    @media print {
      html, body {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background-color: #ffffff !important;
        color: #333333 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        color-scheme: light !important;
      }
      
      /* Force light mode for all elements */
      *, *::before, *::after {
        color-scheme: light !important;
      }
      
      .dark, [data-theme="dark"], [class*="dark"] {
        background-color: #ffffff !important;
        color: #333333 !important;
      }

      .print-container {
        width: 100% !important;
        max-width: 180mm !important;
        padding: 0 !important;
        margin-left: auto !important;
        margin-right: auto !important;
        background-color: #ffffff !important;
      }

      .print-table thead {
        display: table-header-group !important;
      }

      .print-table tr {
        page-break-inside: avoid !important;
      }

      .summary-section {
        page-break-inside: avoid !important;
      }
    }
  `;
}

// =====================================================
// توليد Header الموحد
// =====================================================

export interface DocumentHeaderData {
  titleEn: string;
  titleAr: string;
  documentNumber: string;
  date: string;
  additionalDetails?: { label: string; value: string }[];
}

export function generateDocumentHeader(
  config: PrintLayoutConfig,
  headerData: DocumentHeaderData,
  logoDataUri: string
): string {
  const detailsHtml = headerData.additionalDetails
    ?.map(detail => `<div><strong>${detail.label}:</strong> ${detail.value}</div>`)
    .join('') || '';

  const styles: UnifiedPrintStyles = {
    primaryColor: config.primaryColor,
    secondaryColor: config.secondaryColor,
    logoSize: parseInt(config.logoSize) || 200,
    headerFontSize: parseInt(config.headerFontSize) || 14,
    showLogo: config.showLogo,
    showCompanyName: config.showCompanyName,
    showCompanySubtitle: config.showCompanySubtitle,
    showCompanyAddress: config.showCompanyAddress,
    showCompanyPhone: config.showCompanyContact,
    companyName: config.companyName,
    companySubtitle: config.companySubtitle,
    companyAddress: config.companyAddress,
    companyPhone: config.companyPhone,
  };

  return unifiedHeaderHtml({
    styles,
    fullLogoUrl: logoDataUri,
    metaLinesHtml: `
      <div><strong>الرقم:</strong> ${headerData.documentNumber}</div>
      <div><strong>التاريخ:</strong> ${headerData.date}</div>
      ${detailsHtml}
    `,
    titleAr: headerData.titleAr,
    titleEn: headerData.titleEn,
  });
}

// =====================================================
// توليد قسم الطرف (عميل/مورد)
// =====================================================

export interface PartyData {
  title: string;
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  id?: string;
  additionalFields?: { label: string; value: string }[];
}

export function generatePartySection(partyData: PartyData): string {
  const additionalFieldsHtml = partyData.additionalFields
    ?.map(field => `<strong>${field.label}:</strong> ${field.value}<br>`)
    .join('') || '';

  return `
    <div class="party-section">
      <div class="party-title">${partyData.title}</div>
      <div class="party-details">
        <strong>الاسم:</strong> ${partyData.name}<br>
        ${partyData.company ? `<strong>الشركة:</strong> ${partyData.company}<br>` : ''}
        ${partyData.phone ? `<strong>الهاتف:</strong> ${partyData.phone}<br>` : ''}
        ${partyData.email ? `<strong>البريد الإلكتروني:</strong> ${partyData.email}<br>` : ''}
        ${additionalFieldsHtml}
        ${partyData.id ? `<strong>رقم العميل:</strong> ${partyData.id}` : ''}
      </div>
    </div>
  `;
}

// =====================================================
// توليد Footer الموحد
// =====================================================

export function generateDocumentFooter(config: PrintLayoutConfig): string {
  if (!config.showFooter) return '';
  
  return `
    <div class="print-footer">
      <div>${config.footerText || 'شكراً لتعاملكم معنا | Thank you for your business'}</div>
      <div>هذا مستند إلكتروني ولا يحتاج إلى ختم أو توقيع</div>
    </div>
  `;
}

// =====================================================
// توليد HTML الكامل للطباعة
// =====================================================

export interface PrintDocumentData {
  title: string;
  headerData: DocumentHeaderData;
  partyData?: PartyData;
  bodyContent: string;
  footerContent?: string;
  customCSS?: string;
}

export function generatePrintHTML(
  settings: Partial<PrintSettings>,
  documentData: PrintDocumentData,
  logoDataUri: string
): string {
  const config = getPrintLayoutConfig(settings);
  
  return `
    <!DOCTYPE html>
    <html dir="${config.direction}" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${documentData.title}</title>
      <style>
        ${generateBasePrintCSS(config)}
        ${documentData.customCSS || ''}
      </style>
    </head>
    <body dir="${config.direction}" style="font-family: '${config.fontFamily}', 'Noto Sans Arabic', sans-serif;">
      <div class="print-container">
        ${generateDocumentHeader(config, documentData.headerData, logoDataUri)}
        ${documentData.partyData ? generatePartySection(documentData.partyData) : ''}
        ${documentData.bodyContent}
        ${documentData.footerContent || generateDocumentFooter(config)}
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
// دوال مساعدة للتنسيق
// =====================================================

export function formatArabicNumber(num: number): string {
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
}

export function formatDate(date: string | Date | null, locale: string = 'ar-LY'): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString(locale);
}

// =====================================================
// فتح نافذة الطباعة
// =====================================================

export async function openPrintWindow(htmlContent: string, documentTitle: string): Promise<null> {
  const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
  showPrintPreview(htmlContent, documentTitle);
  return null;
}
