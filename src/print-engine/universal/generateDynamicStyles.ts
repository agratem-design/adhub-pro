/**
 * Dynamic CSS Generator for Universal Print System
 * مولد CSS الديناميكي لنظام الطباعة الموحد
 */

import { PrintConfig } from './types';

/**
 * Generates complete CSS styles from PrintConfig
 * Uses CSS Variables for maximum flexibility
 */
export const generateDynamicStyles = (config: PrintConfig): string => {
  return `
    /* === CSS Variables from Config === */
    :root {
      /* Page */
      --print-direction: ${config.page.direction};
      --print-page-width: ${config.page.width};
      --print-page-min-height: ${config.page.minHeight};
      --print-page-bg: ${config.page.backgroundColor};
      --print-font-family: ${config.page.fontFamily};
      --print-font-size: ${config.page.fontSize};
      --print-line-height: ${config.page.lineHeight};
      --print-padding-top: ${config.page.padding.top};
      --print-padding-right: ${config.page.padding.right};
      --print-padding-bottom: ${config.page.padding.bottom};
      --print-padding-left: ${config.page.padding.left};
      
      /* Header */
      --header-height: ${config.header.height};
      --header-bg: ${config.header.backgroundColor};
      --header-padding: ${config.header.padding};
      --header-margin-bottom: ${config.header.marginBottom};
      --header-border-bottom: ${config.header.borderBottom};
      
      /* Logo positioning */
      --logo-width: ${config.header.logo.width};
      --logo-height: ${config.header.logo.height};
      --logo-x: ${config.header.logo.positionX};
      --logo-y: ${config.header.logo.positionY};
      --logo-object-fit: ${config.header.logo.objectFit};
      
      /* Title positioning */
      --title-font-size: ${config.header.title.fontSize};
      --title-font-weight: ${config.header.title.fontWeight};
      --title-color: ${config.header.title.color};
      --title-x: ${config.header.title.positionX};
      --title-y: ${config.header.title.positionY};
      
      /* Table Header */
      --table-header-bg: ${config.table.header.backgroundColor};
      --table-header-text: ${config.table.header.textColor};
      --table-header-font-size: ${config.table.header.fontSize};
      --table-header-padding: ${config.table.header.padding};
      
      /* Table Body */
      --table-body-font-size: ${config.table.body.fontSize};
      --table-body-padding: ${config.table.body.padding};
      --table-odd-row-bg: ${config.table.body.oddRowBackground};
      --table-even-row-bg: ${config.table.body.evenRowBackground};
      --table-text-color: ${config.table.body.textColor};
      
      /* Table Border */
      --table-border-width: ${config.table.border.width};
      --table-border-style: ${config.table.border.style};
      --table-border-color: ${config.table.border.color};
      
      /* Totals */
      --totals-bg: ${config.totals.backgroundColor};
      --totals-text: ${config.totals.textColor};
      --totals-border: ${config.totals.borderColor};
      --totals-padding: ${config.totals.padding};
      --totals-title-size: ${config.totals.titleFontSize};
      --totals-value-size: ${config.totals.valueFontSize};
      
      /* Footer */
      --footer-font-size: ${config.footer.fontSize};
      --footer-color: ${config.footer.color};
      --footer-border-top: ${config.footer.borderTop};
      --footer-padding: ${config.footer.padding};
      --footer-margin-top: ${config.footer.marginTop};
    }

    /* === Print Page Container === */
    .universal-print-page {
      direction: var(--print-direction);
      width: var(--print-page-width);
      min-height: var(--print-page-min-height);
      margin: 0 auto;
      padding: var(--print-padding-top) var(--print-padding-right) var(--print-padding-bottom) var(--print-padding-left);
      background-color: var(--print-page-bg);
      font-family: var(--print-font-family);
      font-size: var(--print-font-size);
      line-height: var(--print-line-height);
      color: #1f2937;
      box-sizing: border-box;
    }

    /* === Header Section === */
    .universal-print-header {
      position: relative;
      height: var(--header-height);
      background: var(--header-bg);
      padding: var(--header-padding);
      margin-bottom: var(--header-margin-bottom);
      border-bottom: var(--header-border-bottom);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    /* Logo with absolute positioning control */
    .universal-print-logo {
      position: absolute;
      left: var(--logo-x);
      top: var(--logo-y);
      transform: translateY(-50%);
    }

    .universal-print-logo img {
      width: var(--logo-width);
      height: var(--logo-height);
      object-fit: var(--logo-object-fit);
    }

    /* Title with absolute positioning control */
    .universal-print-title {
      position: absolute;
      left: var(--title-x);
      top: var(--title-y);
      transform: translate(-50%, -50%);
      font-size: var(--title-font-size);
      font-weight: var(--title-font-weight);
      color: var(--title-color);
      white-space: nowrap;
    }

    /* Document info section */
    .universal-print-doc-info {
      margin-${config.header.documentInfo.alignment === 'left' ? 'right' : 'left'}: auto;
      text-align: ${config.header.documentInfo.alignment};
      font-size: ${config.header.documentInfo.fontSize};
      color: ${config.header.documentInfo.color};
    }

    .universal-print-doc-info-item {
      margin-bottom: 4px;
    }

    .universal-print-doc-info-label {
      font-weight: 500;
      margin-left: 8px;
    }

    /* === Company Info === */
    .universal-print-company {
      text-align: ${config.companyInfo.alignment};
      font-size: ${config.companyInfo.fontSize};
      color: ${config.companyInfo.color};
      margin-bottom: 15px;
    }

    .universal-print-company-name {
      font-weight: bold;
      font-size: calc(${config.companyInfo.fontSize} + 2px);
      margin-bottom: 4px;
    }

    /* === Party Info Box === */
    .universal-print-party {
      background: ${config.partyInfo.backgroundColor};
      border: 1px solid ${config.partyInfo.borderColor};
      border-radius: ${config.partyInfo.borderRadius};
      padding: ${config.partyInfo.padding};
      margin-bottom: ${config.partyInfo.marginBottom};
    }

    .universal-print-party-title {
      font-size: ${config.partyInfo.titleFontSize};
      font-weight: bold;
      color: ${config.partyInfo.titleColor};
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid ${config.partyInfo.borderColor};
    }

    .universal-print-party-content {
      font-size: ${config.partyInfo.contentFontSize};
      color: ${config.partyInfo.contentColor};
    }

    .universal-print-party-row {
      display: flex;
      gap: 8px;
      margin-bottom: 4px;
    }

    .universal-print-party-label {
      font-weight: 500;
      min-width: 60px;
    }

    /* === Table Styles === */
    .universal-print-table {
      width: ${config.table.width};
      border-collapse: ${config.table.borderCollapse};
      border-spacing: ${config.table.borderSpacing};
      margin-bottom: ${config.table.marginBottom};
      border: var(--table-border-width) var(--table-border-style) var(--table-border-color);
    }

    .universal-print-table thead th {
      background-color: var(--table-header-bg);
      color: var(--table-header-text);
      font-size: var(--table-header-font-size);
      font-weight: ${config.table.header.fontWeight};
      padding: var(--table-header-padding);
      text-align: ${config.table.header.textAlign};
      border: var(--table-border-width) var(--table-border-style) ${config.table.header.borderColor};
    }

    .universal-print-table tbody td {
      font-size: var(--table-body-font-size);
      padding: var(--table-body-padding);
      color: var(--table-text-color);
      border: var(--table-border-width) var(--table-border-style) var(--table-border-color);
      text-align: center;
    }

    .universal-print-table tbody tr:nth-child(odd) {
      background-color: var(--table-odd-row-bg);
    }

    .universal-print-table tbody tr:nth-child(even) {
      background-color: var(--table-even-row-bg);
    }

    /* Column alignment classes */
    .universal-print-table td.align-right,
    .universal-print-table th.align-right {
      text-align: right;
    }

    .universal-print-table td.align-left,
    .universal-print-table th.align-left {
      text-align: left;
    }

    .universal-print-table td.align-center,
    .universal-print-table th.align-center {
      text-align: center;
    }

    /* === Totals Section (inside tfoot) === */
    .universal-print-table tfoot {
      background-color: var(--totals-bg);
    }

    .universal-print-table tfoot td {
      border: var(--table-border-width) var(--table-border-style) var(--totals-border);
      padding: 0;
    }

    .universal-print-table tfoot td.empty-cell {
      background: transparent;
      border: none;
    }

    .universal-print-totals-box {
      padding: var(--totals-padding);
      color: var(--totals-text);
    }

    .universal-print-totals-title {
      font-size: var(--totals-title-size);
      font-weight: ${config.totals.titleFontWeight};
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--totals-border);
    }

    .universal-print-totals-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
    }

    .universal-print-totals-label {
      font-size: var(--totals-title-size);
    }

    .universal-print-totals-value {
      font-size: var(--totals-value-size);
      font-weight: ${config.totals.valueFontWeight};
    }

    .universal-print-totals-row.highlight {
      background: rgba(0,0,0,0.05);
      padding: 6px 8px;
      margin: 4px -8px;
      border-radius: 4px;
    }

    /* === Notes Section === */
    .universal-print-notes {
      background: ${config.notes.backgroundColor};
      border: 1px solid ${config.notes.borderColor};
      padding: ${config.notes.padding};
      margin-top: ${config.notes.marginTop};
      font-size: ${config.notes.fontSize};
      color: ${config.notes.color};
      border-radius: 6px;
    }

    .universal-print-notes-title {
      font-weight: bold;
      margin-bottom: 6px;
    }

    /* === Footer === */
    .universal-print-footer {
      border-top: var(--footer-border-top);
      padding: var(--footer-padding);
      margin-top: var(--footer-margin-top);
      font-size: var(--footer-font-size);
      color: var(--footer-color);
      text-align: ${config.footer.alignment};
    }

    .universal-print-page-number {
      margin-top: 4px;
    }

    /* === Print Media Queries === */
    @media print {
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      body {
        background: white !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      .universal-print-page {
        width: 100% !important;
        min-height: auto !important;
        margin: 0 !important;
        padding: var(--print-padding-top) var(--print-padding-right) var(--print-padding-bottom) var(--print-padding-left) !important;
        box-shadow: none !important;
        background: white !important;
      }

      .universal-print-table {
        page-break-inside: auto;
      }

      .universal-print-table tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }

      .universal-print-table thead {
        display: table-header-group;
      }

      .universal-print-table tfoot {
        display: table-footer-group;
      }

      .universal-print-footer {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
      }

      .no-print {
        display: none !important;
      }
    }

    /* === Page Size Presets === */
    @page {
      size: A4;
      margin: 10mm;
    }
  `;
};

/**
 * Injects styles into document head
 */
export const injectPrintStyles = (config: PrintConfig, styleId: string = 'universal-print-styles'): void => {
  // Remove existing style if present
  const existingStyle = document.getElementById(styleId);
  if (existingStyle) {
    existingStyle.remove();
  }

  // Create and inject new style
  const styleElement = document.createElement('style');
  styleElement.id = styleId;
  styleElement.textContent = generateDynamicStyles(config);
  document.head.appendChild(styleElement);
};

/**
 * Removes injected print styles
 */
export const removePrintStyles = (styleId: string = 'universal-print-styles'): void => {
  const styleElement = document.getElementById(styleId);
  if (styleElement) {
    styleElement.remove();
  }
};
