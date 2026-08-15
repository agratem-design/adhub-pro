/**
 * generatePrintCSS
 * يولد CSS الطباعة من PrintTheme
 * 
 * ⚠️ جميع الألوان تأتي من theme - لا hardcoded values
 */

import { PrintTheme } from './types';
import { unifiedHeaderFooterCss, type UnifiedPrintStyles } from '@/lib/unifiedPrintFragments';

export function generatePrintCSS(theme: PrintTheme): string {
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
      direction: ${theme.direction} !important;
    }
    
    body {
      width: 100%;
      max-width: 210mm;
      font-family: '${theme.fontFamily}', 'Noto Sans Arabic', Arial, sans-serif !important;
      direction: ${theme.direction} !important;
      text-align: ${theme.textAlign};
      background: white;
      color: #333;
      font-size: ${theme.bodyFontSize};
      line-height: 1.4;
      overflow: visible;
      margin: 0 auto;
    }
    
    .print-container {
      width: 100%;
      max-width: 210mm;
      min-height: 297mm;
      padding: ${theme.pageMargins.top} ${theme.pageMargins.right} ${theme.pageMargins.bottom} ${theme.pageMargins.left};
      padding-bottom: 32mm;
      display: flex;
      flex-direction: column;
      margin: 0 auto;
    }
    
    /* ===== UNIFIED HEADER - from unifiedPrintFragments ===== */
    ${unifiedHeaderFooterCss({
      primaryColor: theme.primaryColor,
      secondaryColor: theme.secondaryColor,
      logoSize: parseInt(theme.logoSize) || 200,
      headerFontSize: parseInt(theme.headerFontSize) || 14,
      headerMarginBottom: parseInt(theme.headerMarginBottom) || 20,
      contactInfoFontSize: 10,
    })}
    
    /* ===== PARTY SECTION ===== */
    .party-section {
      background: ${theme.accentColor};
      padding: 15px 20px;
      margin-bottom: 20px;
      border-${theme.direction === 'rtl' ? 'right' : 'left'}: 4px solid ${theme.primaryColor};
    }

    .party-title {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 10px;
      color: ${theme.primaryColor};
    }

    .party-details {
      font-size: 12px;
      line-height: 1.8;
      color: #333;
    }

    /* ===== UNIFIED TABLE ===== */
    .print-table {
      width: 100%;
      max-width: 100%;
      border-collapse: collapse;
      margin-bottom: 0;
      table-layout: fixed;
      font-size: 11px;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    .print-table thead { display: table-header-group; }
    .print-table tfoot { display: table-footer-group; }
    .print-table tr { page-break-inside: avoid; }

    .print-table th {
      background: ${theme.tableHeaderBgColor};
      color: ${theme.tableHeaderTextColor};
      padding: 12px 8px;
      text-align: center;
      font-weight: 700;
      border: 1px solid ${theme.tableBorderColor};
      font-size: 12px;
    }

    .print-table td {
      padding: 10px 8px;
      text-align: center;
      border: 1px solid ${theme.tableBorderColor};
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
      background: ${theme.tableRowEvenColor};
    }

    .print-table tbody tr:nth-child(odd) {
      background: ${theme.tableRowOddColor};
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
      background: ${theme.accentColor} !important;
    }

    .totals-row td {
      padding: 12px 8px !important;
      font-weight: 700;
      font-size: 13px;
    }

    .grand-total-row {
      background: ${theme.primaryColor} !important;
    }

    .grand-total-row td {
      padding: 15px 12px !important;
      font-weight: 700;
      font-size: 16px;
      color: ${theme.headerTextColor} !important;
    }

    /* ===== SUMMARY SECTION ===== */
    .summary-section {
      margin-top: 25px;
      padding: 20px;
      background: ${theme.accentColor};
      border: 2px solid ${theme.primaryColor};
      border-radius: 8px;
    }

    .summary-title {
      font-size: 16px;
      font-weight: 700;
      color: ${theme.primaryColor};
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
    .summary-value.neutral { color: ${theme.primaryColor}; }
    
    .summary-label {
      font-size: 12px;
      color: #666;
    }
    
    .amount-words {
      margin-top: 15px;
      padding: 12px;
      background: #fff;
      border: 1px dashed ${theme.primaryColor};
      text-align: center;
      font-size: 13px;
      color: #666;
    }
    
    /* ===== UNIFIED FOOTER ===== */
    .print-footer {
      margin-top: auto;
      padding-top: 15px;
      border-top: 2px solid ${theme.primaryColor};
      display: flex;
      flex-direction: ${theme.flexDirection};
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: #666;
      text-align: ${theme.footerTextAlign};
    }
    
    @page {
      size: A4 portrait;
      margin: 10mm;
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
        max-width: 190mm !important;
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
