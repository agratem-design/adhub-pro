/**
 * Unified Invoice Base - القاعدة الموحدة لجميع الفواتير
 * يستخدم fetchPrintSettingsForInvoice كمصدر وحيد للإعدادات
 * المرجع: contractInvoiceGenerator.ts (فاتورة العقد)
 */

import { fetchPrintSettingsForInvoice } from '@/utils/invoicePrintSettingsBridge';
import { InvoiceTemplateType } from '@/types/invoice-templates';
import { hexToRgba } from '@/hooks/useInvoiceSettingsSync';

export interface ResolvedPrintStyles {
  // Colors
  primaryColor: string;
  secondaryColor: string;
  tableHeaderBg: string;
  tableHeaderText: string;
  tableBorder: string;
  tableBorderWidth: number;
  tableBorderStyle: string;
  tableBorderRadius: number;
  tableRowEven: string;
  tableRowOdd: string;
  tableText: string;
  tableRowOpacity: number;
  customerBg: string;
  customerBorder: string;
  customerTitle: string;
  customerText: string;
  subtotalBg: string;
  subtotalText: string;
  totalBg: string;
  totalText: string;
  totalBorderColor: string;
  notesBg: string;
  notesText: string;
  notesBorder: string;

  // Fonts
  fontFamily: string;
  titleFontSize: number;
  headerFontSize: number;
  bodyFontSize: number;

  // ✅ أحجام عناوين الفاتورة
  invoiceTitleArFontSize: number;
  invoiceTitleEnFontSize: number;
  customerNameFontSize: number;
  statValueFontSize: number;

  // Logo
  logoPath: string;
  logoSize: number;
  fullLogoUrl: string;

  // Layout
  headerMarginBottom: number;
  pageMarginTop: number;
  pageMarginBottom: number;
  pageMarginLeft: number;
  pageMarginRight: number;
  contentBottomSpacing: number;

  // Visibility
  showLogo: boolean;
  showHeader: boolean;
  showFooter: boolean;
  showPageNumber: boolean;
  showCompanyName: boolean;
  showCompanySubtitle: boolean;
  showCompanyAddress: boolean;
  showCompanyPhone: boolean;
  showTaxId: boolean;
  showEmail: boolean;
  showWebsite: boolean;
  showCompanyInfo: boolean;
  showContactInfo: boolean;
  showCustomerSection: boolean;
  headerSwap: boolean;
  showHijriDate: boolean;

  // Titles
  invoiceTitleAr: string;
  invoiceTitleEn: string;

  // Footer
  footerText: string;
  footerAlignment: string;
  footerTextColor: string;
  footerBgColor: string;
  footerPosition: number;

  // Background
  bgImageUrl: string;
  bgStyle: string;
  backgroundOpacity: number;

  // Company info
  companyName: string;
  companySubtitle: string;
  companyAddress: string;
  companyPhone: string;
  companyTaxId: string;
  companyEmail: string;
  companyWebsite: string;

  // Header alignment
  headerAlignment: string;
  contactInfoFontSize: number;

  // Header style
  headerStyle: string;
  headerBgColor: string;
  headerTextColor: string;

  // Notes
  notesAlignment: string;

  // Raw settings
  raw: Record<string, any>;
}

/**
 * Resolve all print settings for a given invoice type
 */
export async function resolveInvoiceStyles(
  invoiceType: InvoiceTemplateType,
  defaults?: { titleAr?: string; titleEn?: string }
): Promise<ResolvedPrintStyles> {
  const s = await fetchPrintSettingsForInvoice(invoiceType) || {};
  const fontBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const primaryColor = s.primaryColor || '#000000';
  const secondaryColor = s.secondaryColor || '#333333';
  const logoPath = s.logoPath || '/logofares.svg';
  const fullLogoUrl = logoPath.startsWith('http') ? logoPath : `${fontBaseUrl}${logoPath}`;

  const bgImagePath = s.backgroundImage;
  const bgImageUrl = bgImagePath ? (bgImagePath.startsWith('http') ? bgImagePath : `${fontBaseUrl}${bgImagePath}`) : '';
  const bgStyle = bgImageUrl ? `
    background-image: url('${bgImageUrl}');
    background-position: ${s.backgroundPosX ?? 50}% ${s.backgroundPosY ?? 50}%;
    background-repeat: no-repeat;
    background-size: ${s.backgroundScale ?? 100}%;
  ` : '';

  return {
    primaryColor,
    secondaryColor,
    tableHeaderBg: s.tableHeaderBgColor || primaryColor,
    tableHeaderText: s.tableHeaderTextColor || '#ffffff',
    tableBorder: s.tableBorderColor || primaryColor,
    tableBorderWidth: s.tableBorderWidth ?? 1,
    tableBorderStyle: s.tableBorderStyle || 'solid',
    tableBorderRadius: s.tableBorderRadius ?? 0,
    tableRowEven: s.tableRowEvenColor || '#f8f9fa',
    tableRowOdd: s.tableRowOddColor || '#ffffff',
    tableText: s.tableTextColor || '#333333',
    tableRowOpacity: s.tableRowOpacity ?? 100,
    customerBg: s.customerSectionBgColor || '#f8f9fa',
    customerBorder: s.customerSectionBorderColor || primaryColor,
    customerTitle: s.customerSectionTitleColor || primaryColor,
    customerText: s.customerSectionTextColor || '#333333',
    subtotalBg: s.subtotalBgColor || '#f0f0f0',
    subtotalText: s.subtotalTextColor || '#333333',
    totalBg: s.totalBgColor || primaryColor,
    totalText: s.totalTextColor || '#ffffff',
    totalBorderColor: s.totalBorderColor || primaryColor,
    notesBg: s.notesBgColor || '#fffbeb',
    notesText: s.notesTextColor || '#92400e',
    notesBorder: s.notesBorderColor || '#fbbf24',

    fontFamily: s.fontFamily || 'Doran',
    titleFontSize: s.titleFontSize || 24,
    headerFontSize: s.headerFontSize || 14,
    bodyFontSize: s.bodyFontSize || 12,

    // ✅ أحجام عناوين الفاتورة
    invoiceTitleArFontSize: s.invoiceTitleArFontSize || 18,
    invoiceTitleEnFontSize: s.invoiceTitleEnFontSize || 22,
    customerNameFontSize: s.customerNameFontSize || 20,
    statValueFontSize: s.statValueFontSize || 28,

    logoPath,
    logoSize: s.logoSize || 60,
    fullLogoUrl,

    headerMarginBottom: s.headerMarginBottom || 20,
    pageMarginTop: s.pageMarginTop || 15,
    pageMarginBottom: s.pageMarginBottom || 15,
    pageMarginLeft: s.pageMarginLeft || 15,
    pageMarginRight: s.pageMarginRight || 15,
    contentBottomSpacing: s.contentBottomSpacing || 25,

    showLogo: s.showLogo !== false,
    showHeader: s.showHeader !== false,
    showFooter: s.showFooter !== false,
    showPageNumber: s.showPageNumber !== false,
    showCompanyName: s.showCompanyName === true,
    showCompanySubtitle: s.showCompanySubtitle === true,
    showCompanyAddress: s.showCompanyAddress === true,
    showCompanyPhone: s.showCompanyPhone === true,
    showTaxId: s.showTaxId === true,
    showEmail: s.showEmail === true,
    showWebsite: s.showWebsite === true,
    showCompanyInfo: s.showCompanyInfo === true,
    showContactInfo: s.showContactInfo === true,
    showCustomerSection: s.showCustomerSection !== false,
    headerSwap: s.headerSwap === true,
    showHijriDate: s.showHijriDate === true,

    invoiceTitleAr: s.invoiceTitle || defaults?.titleAr || '',
    invoiceTitleEn: s.invoiceTitleEn || defaults?.titleEn || '',

    footerText: s.footerText || 'شكراً لتعاملكم معنا',
    footerAlignment: s.footerAlignment || 'center',
    footerTextColor: s.footerTextColor || '#666666',
    footerBgColor: s.footerBgColor || 'transparent',
    footerPosition: s.footerPosition ?? 15,

    bgImageUrl,
    bgStyle,
    backgroundOpacity: s.backgroundOpacity || 10,

    companyName: s.companyName || '',
    companySubtitle: s.companySubtitle || '',
    companyAddress: s.companyAddress || '',
    companyPhone: s.companyPhone || '',
    companyTaxId: s.companyTaxId || '',
    companyEmail: s.companyEmail || '',
    companyWebsite: s.companyWebsite || '',

    headerAlignment: s.headerAlignment || 'right',
    contactInfoFontSize: s.contactInfoFontSize || 10,

    headerStyle: s.headerStyle || 'classic',
    headerBgColor: s.headerBgColor || 'transparent',
    headerTextColor: s.headerTextColor || 'inherit',

    notesAlignment: s.notesAlignment || 'right',

    raw: s,
  };
}

/**
 * Format date with optional Hijri calendar
 */
export function formatDateForPrint(dateStr: string, showHijri: boolean = false): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    const gregorian = d.toLocaleDateString('ar-LY-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });
    if (!showHijri) return gregorian;
    const hijri = new Intl.DateTimeFormat('ar-u-ca-islamic-umalqura-nu-latn', {
      day: 'numeric', month: 'long', year: 'numeric'
    }).format(d) + ' هـ';
    return `${gregorian} — ${hijri}`;
  } catch {
    return dateStr;
  }
}

/**
 * Format number with thousands separator
 */
export const formatNum = (num: number): string => {
  if (num === null || num === undefined || isNaN(num)) return '0';
  const rounded = Math.round(Number(num) * 10) / 10;
  const [integerPart, decimalPart = '0'] = rounded.toString().split('.');
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${formattedInteger}.${decimalPart}`;
};

const flexJustify = (a: string) => a === 'center' ? 'center' : a === 'left' ? 'flex-start' : 'flex-end';

/**
 * Generate base CSS used by all invoices
 */
export function generateBaseCSS(t: ResolvedPrintStyles): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap');
    @font-face { font-family: 'Doran'; src: url('${typeof window !== 'undefined' ? window.location.origin : ''}/Doran-Bold.otf') format('opentype'); font-weight: 700; }
    @font-face { font-family: 'Doran'; src: url('${typeof window !== 'undefined' ? window.location.origin : ''}/Doran-Regular.otf') format('opentype'); font-weight: 400; }

    * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
    
    html, body {
      font-family: '${t.fontFamily}', 'Noto Sans Arabic', Arial, sans-serif;
      direction: rtl; background: #fff; color: ${t.tableText}; font-size: ${t.bodyFontSize}px; line-height: 1.4;
    }

    .paper {
      width: 210mm; min-height: 297mm; margin: 0 auto;
      padding: ${t.pageMarginTop}mm ${t.pageMarginRight}mm ${t.pageMarginBottom}mm ${t.pageMarginLeft}mm;
      background: #fff; position: relative; display: flex; flex-direction: column;
    }

    .bg-layer {
      position:absolute; top:0;left:0;right:0;bottom:0;
      ${t.bgStyle}
      opacity: ${t.backgroundOpacity / 100};
      pointer-events: none; z-index: 0;
    }

    .content { position:relative; z-index:1; flex:1; display:flex; flex-direction:column; }
    .main-content { flex:1; padding-bottom:${t.contentBottomSpacing}mm; }

    /* ===== Header Layout ===== */
    .header {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      margin-bottom: ${t.headerMarginBottom}px;
      padding-bottom: 18px;
      border-bottom: 3px solid ${t.primaryColor};
      gap: 20px;
      background-color: ${t.headerBgColor && t.headerBgColor !== t.primaryColor ? t.headerBgColor : 'transparent'};
      color: ${t.headerTextColor || 'inherit'};
    }

    /* Left side: Logo + Company info */
    .header-company-side {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 8px;
      flex-shrink: 0;
      flex: ${(t as any).logoContainerWidth ? `0 0 ${(t as any).logoContainerWidth}` : '1'};
    }

    .logo { line-height: 0; }
    .logo img { height: ${t.logoSize}px; max-height: ${t.logoSize}px; object-fit: contain; max-width: ${Math.min(240, Math.max(120, t.logoSize * 2))}px; }

    .company-info-block {}

    .company-name {
      font-weight: bold; font-size: ${t.headerFontSize + 1}px; color: ${t.primaryColor}; margin-bottom: 2px;
      font-family: 'Doran', 'Noto Sans Arabic', 'Cairo', 'Tajawal', sans-serif;
    }
    .company-subtitle {
      font-size: 10px; color: ${t.secondaryColor}; opacity: 0.85;
    }

    .contact-info {
      font-size: ${t.contactInfoFontSize}px;
      color: ${t.customerText}; line-height: 1.7;
      opacity: 0.8;
    }

    /* Title side - alignment set dynamically via inline style */
    .header-title-side {
      display: flex;
      flex-direction: column;
      justify-content: center;
      flex-shrink: 0;
      min-width: 0;
      flex: ${(t as any).titleContainerWidth ? `0 0 ${(t as any).titleContainerWidth}` : '1'};
    }

    /* Ensure all children inherit text-align from their parent side */
    .header-title-side *, .header-company-side * {
      text-align: inherit;
    }

    .invoice-title-ar {
      font-size: ${t.invoiceTitleArFontSize + 4}px; font-weight: bold; color: ${t.primaryColor};
      margin-bottom: 6px;
      font-family: 'Doran', 'Noto Sans Arabic', 'Cairo', 'Tajawal', sans-serif;
    }

    .invoice-title-en {
      font-size: ${t.invoiceTitleArFontSize}px; font-weight: bold; font-family: Manrope, sans-serif;
      letter-spacing: 2px; color: ${t.secondaryColor}; margin: 0; opacity: 0.75;
    }

    .invoice-meta {
      font-size: 11px; color: ${t.customerText}; margin-top: 10px; line-height: 1.8;
      opacity: 0.85;
    }

    .customer-section {
      background: linear-gradient(135deg, ${t.customerBg}, #ffffff);
      padding: 20px; margin-bottom: 28px;
      border-right: 5px solid ${t.customerBorder};
      border-radius: 8px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      display: flex; justify-content: space-between; align-items: center;
    }

    .customer-label {
      font-size: ${t.bodyFontSize}px; color: ${t.customerText}; opacity: 0.7; margin-bottom: 4px;
    }

    .customer-name-text {
      font-size: ${t.customerNameFontSize}px; font-weight: bold; color: ${t.customerTitle};
      font-family: 'Doran', 'Noto Sans Arabic', 'Cairo', 'Tajawal', sans-serif;
      margin-bottom: 8px;
    }

    .customer-detail {
      font-size: ${t.bodyFontSize - 1}px; color: ${t.customerText}; opacity: 0.8;
    }

    .stats-cards { display: flex; gap: 24px; }
    .stat-card { text-align: center; }
    .stat-value { font-size: ${t.statValueFontSize}px; font-weight: bold; color: ${t.primaryColor}; font-family: 'Manrope', sans-serif; }
    .stat-label { font-size: ${t.bodyFontSize}px; color: ${t.customerText}; opacity: 0.7; }

    /* Table */
    .items-table { width: 100%; border-collapse: collapse; font-size: ${t.bodyFontSize}px; margin-bottom: 20px; ${t.tableBorderRadius ? `border-radius: ${t.tableBorderRadius}px; overflow: hidden;` : ''} }
    .items-table th {
      background-color: ${t.tableHeaderBg} !important;
      padding: 12px 8px; color: ${t.tableHeaderText};
      border: ${t.tableBorderWidth}px ${t.tableBorderStyle} ${t.tableBorder}; text-align: center; font-weight: bold;
    }
    .items-table td {
      padding: 10px 8px; border: ${t.tableBorderWidth}px ${t.tableBorderStyle} ${t.tableBorder};
      text-align: center; color: ${t.tableText};
    }
    .items-table .even-row { background-color: ${hexToRgba(t.tableRowEven, t.tableRowOpacity)}; }
    .items-table .odd-row { background-color: ${hexToRgba(t.tableRowOdd, t.tableRowOpacity)}; }

    .subtotal-row { background-color: ${t.subtotalBg} !important; }
    .subtotal-row td { font-weight: bold; color: ${t.subtotalText}; }

    .grand-total-row { background-color: ${t.totalBg} !important; }
    .grand-total-row td { color: ${t.totalText}; font-weight: bold; padding: 14px 12px; }
    .grand-total-row .totals-label { text-align: right; font-size: ${t.headerFontSize}px; }
    .grand-total-row .totals-value { text-align: center; font-size: ${t.headerFontSize + 2}px; font-family: 'Manrope', sans-serif; }

    .notes-section {
      margin-top: 15px; padding: 12px 16px;
      background-color: ${t.notesBg}; border: 1px solid ${t.notesBorder};
      border-radius: 8px; color: ${t.notesText}; font-size: ${t.bodyFontSize - 1}px;
      text-align: ${t.notesAlignment};
    }

    /* Signatures & Stamp */
    .signature-stamp-section {
      margin-top: 40px; padding-top: 20px;
      border-top: 2px dashed #ccc;
    }
    .signature-stamp-row {
      display: flex; justify-content: space-between; align-items: flex-start;
    }
    .signature-block {
      flex: 1; text-align: center;
    }
    .signature-block-title {
      font-size: 14px; font-weight: bold; color: #333; margin-bottom: 60px;
    }
    .signature-line {
      border-top: 2px solid #333; width: 120px; margin: 0 auto;
    }

    /* Footer */
    .footer {
      width: 100%; margin-bottom: ${t.footerPosition}mm; padding-top: 10px;
      border-top: 2px solid ${t.primaryColor};
      background: ${t.footerBgColor !== 'transparent' ? t.footerBgColor : 'transparent'};
      color: ${t.footerTextColor}; font-size: 10px;
      display: flex; align-items: center;
      justify-content: ${flexJustify(t.footerAlignment)}; gap: 20px;
    }
    .page-number { margin-${t.footerAlignment === 'right' ? 'right' : 'left'}: auto; }

    .num { font-family: 'Manrope', sans-serif; font-variant-numeric: tabular-nums; font-weight: 700; }

    @media print {
      @page {
        size: A4;
        margin: 0;
        @bottom-center {
          content: "صفحة " counter(page) " من " counter(pages);
          font-family: 'Cairo', 'Manrope', sans-serif;
          font-size: 10px;
          color: #666;
        }
      }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      html, body { background: #fff !important; }
      .paper { margin: 0; padding: ${t.pageMarginTop}mm ${t.pageMarginRight}mm ${t.pageMarginBottom}mm ${t.pageMarginLeft}mm; border: none; box-shadow: none; }
      .items-table th { background-color: ${t.tableHeaderBg} !important; }
      .grand-total-row { background-color: ${t.totalBg} !important; }
      .page-number, .u-page-number { display: none !important; }
    }
  `;
}

/**
 * Build contact info HTML
 */
function buildContactInfo(t: ResolvedPrintStyles): string {
  if (!t.showContactInfo) return '';
  const parts: string[] = [];
  if (t.showCompanyAddress && t.companyAddress) parts.push(`<div>${t.companyAddress}</div>`);
  if (t.showCompanyPhone && t.companyPhone) parts.push(`<div>هاتف: ${t.companyPhone}</div>`);
  if (t.showTaxId && t.companyTaxId) parts.push(`<div>السجل التجاري: ${t.companyTaxId}</div>`);
  if (t.showEmail && t.companyEmail) parts.push(`<div>${t.companyEmail}</div>`);
  if (t.showWebsite && t.companyWebsite) parts.push(`<div>${t.companyWebsite}</div>`);
  if (parts.length === 0) return '';
  return `<div class="contact-info">${parts.join('')}</div>`;
}

/**
 * Build company info HTML
 */
function buildCompanyInfo(t: ResolvedPrintStyles): string {
  if (!t.showCompanyInfo) return '';
  const parts: string[] = [];
  if (t.showCompanyName && t.companyName) parts.push(`<div class="company-name">${t.companyName}</div>`);
  if (t.showCompanySubtitle && t.companySubtitle) parts.push(`<div class="company-subtitle">${t.companySubtitle}</div>`);
  if (parts.length === 0) return '';
  return `<div class="company-info-block">${parts.join('')}</div>`;
}

/**
 * Generate header HTML
 */
export function generateHeaderHTML(t: ResolvedPrintStyles, metaHtml: string): string {
  if (!t.showHeader) return '';

  const logoBlock = t.showLogo ? `<div class="logo"><img src="${t.fullLogoUrl}" alt="Logo" onerror="this.style.display='none'"/></div>` : '';
  const companyBlock = `
    ${logoBlock}
    ${buildCompanyInfo(t)}
    ${buildContactInfo(t)}
  `;
  
  const titleBlock = `
    ${t.invoiceTitleAr ? `<div class="invoice-title-ar">${t.invoiceTitleAr}</div>` : ''}
    <h1 class="invoice-title-en">${t.invoiceTitleEn}</h1>
    <div class="invoice-meta">${metaHtml}</div>
  `;

  // ✅ Handle different header_style layouts
  if (t.headerStyle === 'centered') {
    return `
    <div class="header" style="flex-direction:column;align-items:center;text-align:center;">
      ${logoBlock}
      ${buildCompanyInfo(t)}
      ${t.invoiceTitleAr ? `<div class="invoice-title-ar" style="text-align:center;">${t.invoiceTitleAr}</div>` : ''}
      <h1 class="invoice-title-en" style="text-align:center;">${t.invoiceTitleEn}</h1>
      <div class="invoice-meta" style="text-align:center;">${metaHtml}</div>
      ${buildContactInfo(t)}
    </div>
    `;
  }

  if (t.headerStyle === 'simple') {
    return `
    <div class="header" style="flex-direction:column;align-items:center;text-align:center;gap:6px;">
      ${logoBlock}
      ${t.showCompanyInfo && t.companyName ? `<div class="company-name" style="text-align:center;">${t.companyName}</div>` : ''}
    </div>
    `;
  }

  if (t.headerStyle === 'minimal') {
    return `
    <div class="header" style="flex-direction:row;align-items:center;gap:10px;padding-bottom:8px;">
      ${t.showLogo ? `<div class="logo"><img src="${t.fullLogoUrl}" alt="Logo" style="height:24px;" onerror="this.style.display='none'"/></div>` : ''}
      ${t.showCompanyInfo && t.companyName ? `<span class="company-name" style="font-size:12px;margin:0;">${t.companyName}</span>` : ''}
      <span style="flex:1;"></span>
      <span style="font-size:10px;color:#666;">
        ${t.invoiceTitleAr || t.invoiceTitleEn}
      </span>
    </div>
    `;
  }

  // 'classic' and 'modern' use the two-column layout
  // 'modern' reverses the default order (logo left, title right)
  const isModern = t.headerStyle === 'modern';
  const effectiveSwap = isModern ? !t.headerSwap : t.headerSwap;

  // RTL: first child in flex-row appears on the RIGHT visually.
  // Default (swap=false): company/logo on RIGHT (first in RTL), title on LEFT
  // Swapped (swap=true): title on RIGHT, company/logo on LEFT
  const firstContent = effectiveSwap ? titleBlock : companyBlock;
  const secondContent = effectiveSwap ? companyBlock : titleBlock;
  const firstClass = effectiveSwap ? 'header-title-side' : 'header-company-side';
  const secondClass = effectiveSwap ? 'header-company-side' : 'header-title-side';

  // Title alignment
  const titleOnRight = effectiveSwap;
  const titleStyle = titleOnRight
    ? 'align-items:flex-start;text-align:right;'
    : 'align-items:flex-end;text-align:left;';

  // Company side alignment: opposite of title
  const companyStyle = titleOnRight
    ? 'align-items:flex-end;text-align:left;'
    : 'align-items:flex-start;text-align:right;';

  return `
  <div class="header">
    <div class="${firstClass}" style="${firstClass === 'header-title-side' ? titleStyle : companyStyle}">
      ${firstContent}
    </div>
    <div class="${secondClass}" style="${secondClass === 'header-title-side' ? titleStyle : companyStyle}">
      ${secondContent}
    </div>
  </div>
  `;
}

/**
 * Generate customer section HTML
 */
export function generateCustomerHTML(t: ResolvedPrintStyles, opts: {
  label?: string;
  name: string;
  company?: string;
  phone?: string;
  extraInfo?: string;
  statsCards?: string;
}): string {
  if (!t.showCustomerSection) return '';

  return `
  <div class="customer-section">
    <div>
      <div class="customer-label">${opts.label || 'العميل'}</div>
      <div class="customer-name-text">${opts.name}</div>
      ${opts.company ? `<div class="customer-detail">${opts.company}</div>` : ''}
      ${opts.phone ? `<div class="customer-detail">هاتف: ${opts.phone}</div>` : ''}
      ${opts.extraInfo || ''}
    </div>
    ${opts.statsCards ? `<div class="stats-cards">${opts.statsCards}</div>` : ''}
  </div>
  `;
}

/**
 * Generate footer HTML
 */
export function generateFooterHTML(t: ResolvedPrintStyles): string {
  if (!t.showFooter) return '';
  return `
  <div class="footer">
    <span>${t.footerText}</span>
    ${t.showPageNumber ? '<span class="page-number">صفحة 1 من 1</span>' : ''}
  </div>
  `;
}

/**
 * Generate signature and stamp section HTML
 */
export function generateSignatureHTML(show: boolean = true): string {
  if (!show) return '';
  return `
  <div class="signature-stamp-section">
    <div class="signature-stamp-row">
      <div class="signature-block" style="padding-left:20px;">
        <div class="signature-block-title">الختم</div>
        <div class="signature-line"></div>
      </div>
      <div class="signature-block" style="padding-right:20px;">
        <div class="signature-block-title">التوقيع</div>
        <div class="signature-line"></div>
      </div>
    </div>
  </div>
  `;
}

/**
 * Wrap body content in full HTML document
 */
export function wrapInDocument(t: ResolvedPrintStyles, opts: {
  title: string;
  headerMetaHtml: string;
  customerHtml: string;
  bodyContent: string;
  extraCSS?: string;
  autoPrint?: boolean;
  showSignature?: boolean;
}): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${opts.title}</title>
  <style>
    ${generateBaseCSS(t)}
    ${opts.extraCSS || ''}
  </style>
</head>
<body>
  <div class="paper">
    ${t.bgImageUrl ? '<div class="bg-layer"></div>' : ''}
    <div class="content">
      <div class="main-content">
        ${generateHeaderHTML(t, opts.headerMetaHtml)}
        ${opts.customerHtml}
        ${opts.bodyContent}
        ${generateSignatureHTML(opts.showSignature === true)}
      </div>
      ${generateFooterHTML(t)}
    </div>
  </div>
  ${opts.autoPrint ? '<script>window.onload=function(){window.print();}</script>' : ''}
</body>
</html>`;
}

// =====================================================
// Legacy Fragment API (migrated from unifiedPrintFragments.ts)
// These provide backward compatibility for files still using the old API.
// New code should use resolveInvoiceStyles() + generateBaseCSS/generateHeaderHTML/wrapInDocument.
// =====================================================

export type AlignmentOption = 'left' | 'center' | 'right';

export interface UnifiedPrintStyles {
  companyName?: string;
  companySubtitle?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyTaxId?: string;
  companyEmail?: string;
  companyWebsite?: string;
  logoPath?: string;
  logoSize?: number;
  logoPosition?: AlignmentOption;
  headerAlignment?: AlignmentOption;
  showLogo?: boolean;
  showContactInfo?: boolean;
  contactInfoFontSize?: number;
  contactInfoAlignment?: AlignmentOption;
  showCompanyInfo?: boolean;
  showCompanyName?: boolean;
  showCompanySubtitle?: boolean;
  showCompanyAddress?: boolean;
  showCompanyPhone?: boolean;
  showTaxId?: boolean;
  showEmail?: boolean;
  showWebsite?: boolean;
  headerMarginBottom?: number;
  footerPosition?: number;
  footerAlignment?: AlignmentOption;
  footerText?: string;
  footerTextColor?: string;
  footerBgColor?: string;
  showFooter?: boolean;
  showPageNumber?: boolean;
  primaryColor?: string;
  secondaryColor?: string;
  customerSectionTextColor?: string;
  tableBorderColor?: string;
  invoiceTitle?: string;
  invoiceTitleEn?: string;
  invoiceTitleAlignment?: AlignmentOption;
  headerSwap?: boolean;
  fontFamily?: string;
  headerFontSize?: number;
  bodyFontSize?: number;
  titleFontSize?: number;
  // ✅ New unified properties
  headerBgColor?: string;
  headerTextColor?: string;
  headerStyle?: string;
  invoiceTitleArFontSize?: number;
  invoiceTitleEnFontSize?: number;
  logoContainerWidth?: string;
  titleContainerWidth?: string;
}

const legacyFlexJustify = (a?: AlignmentOption) => (a === 'center' ? 'center' : a === 'left' ? 'flex-start' : 'flex-end');

export function unifiedHeaderFooterCss(styles: UnifiedPrintStyles) {
  const headerMarginBottom = styles.headerMarginBottom ?? 15;
  const footerPosition = styles.footerPosition ?? 15;
  const pc = styles.primaryColor || '#D4AF37';
  const sc = styles.secondaryColor || '#1a1a2e';
  const logoSize = styles.logoSize ?? 200;
  const headerFontSize = styles.headerFontSize ?? 14;
  const titleArFontSize = styles.invoiceTitleArFontSize ?? 22;
  const titleEnFontSize = styles.invoiceTitleEnFontSize ?? 12;
  let headerBgColor = styles.headerBgColor || 'transparent';
  // Normalize legacy invalid black default to transparent (prevents black header background bug)
  if (typeof headerBgColor === 'string' && /^#0{3,6}$/i.test(headerBgColor.trim())) {
    headerBgColor = 'transparent';
  }
  const rawHeaderTextColor = styles.headerTextColor || 'inherit';
  // Prevent white text on transparent/white background (contrast fix)
  const headerTextColor = (headerBgColor === 'transparent' || headerBgColor === '#ffffff' || headerBgColor === '#fff')
    && rawHeaderTextColor && /^#f[0-9a-f]{5}$/i.test(rawHeaderTextColor)
    ? pc
    : rawHeaderTextColor;
  const logoContainerFlex = styles.logoContainerWidth ? `flex: 0 0 ${styles.logoContainerWidth};` : 'flex: 1;';
  const titleContainerFlex = styles.titleContainerWidth ? `flex: 0 0 ${styles.titleContainerWidth};` : 'flex: 1;';
  const resolvedHeaderBg = headerBgColor === 'transparent' ? '#fffdf8' : headerBgColor;
  const resolvedLogoHeight = Math.min(86, Math.max(64, logoSize));

  return `
  .u-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: ${headerMarginBottom}px;
    border: 1px solid #e8dfcc;
    border-top: 4px solid ${pc};
    border-radius: 12px;
    padding: 12px 14px;
    direction: rtl;
    gap: 16px;
    background-color: ${resolvedHeaderBg} !important;
    background: ${resolvedHeaderBg} !important;
    color: ${headerTextColor};
    box-shadow: 0 3px 12px rgba(66, 51, 16, 0.06);
  }
  .u-invoice-info {
    direction: rtl;
    ${titleContainerFlex}
    min-width: 0;
  }
  .u-invoice-title {
    font-size: ${Math.min(24, Math.max(18, titleArFontSize + 1))}px;
    font-weight: bold;
    color: ${headerTextColor !== 'inherit' ? headerTextColor : pc};
    margin-bottom: 7px;
    direction: rtl;
    word-wrap: break-word;
    overflow-wrap: break-word;
    white-space: normal;
    max-width: 100%;
    line-height: 1.3;
  }
  .u-invoice-subtitle {
    font-size: ${titleArFontSize}px;
    color: ${sc};
    font-weight: bold;
    margin-bottom: 6px;
    direction: ltr;
    text-align: left;
    font-family: Manrope, sans-serif;
    letter-spacing: 2px;
    opacity: 0.75;
  }
  .u-invoice-details {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 3px 12px;
    font-size: 9.5px;
    color: #5f5b52;
    line-height: 1.45;
    margin-top: 4px;
    opacity: 1;
  }
  .u-invoice-details > div {
    min-width: 0;
    padding-bottom: 2px;
    border-bottom: 1px solid #eee7d8;
  }
  .u-invoice-details > div > span {
    display: block;
    color: #8a806d;
    font-size: 8px;
    margin-bottom: 1px;
  }
  .u-invoice-details strong {
    color: #211d15;
    display: block;
    font-size: 9.5px;
    font-weight: 700;
  }
  .u-company-side {
    display: flex;
    flex-direction: column;
    gap: 8px;
    ${logoContainerFlex}
    flex-shrink: 0;
  }
  .u-logo {
    height: ${resolvedLogoHeight}px;
    width: auto;
    max-width: 230px;
    object-fit: contain;
    overflow: visible;
    padding: 0;
  }
  .u-company-name {
    font-weight: 700;
    font-size: ${headerFontSize}px;
    color: ${headerTextColor !== 'inherit' ? headerTextColor : pc};
    margin-bottom: 2px;
  }
  .u-company-subtitle {
    font-size: 10px;
    color: ${sc};
    opacity: 0.85;
  }
  .u-contact-info {
    font-size: ${styles.contactInfoFontSize ?? 10}px;
    color: #666;
    line-height: 1.7;
    opacity: 0.8;
  }
  .u-footer {
    width: 100%;
    margin-bottom: ${footerPosition}mm;
    padding-top: 8px;
    border-top: 1px solid ${pc};
    background: ${styles.footerBgColor && styles.footerBgColor !== 'transparent' ? styles.footerBgColor : 'transparent'};
    color: ${styles.footerTextColor || '#666'};
    font-size: 10px;
    display: flex;
    align-items: center;
    justify-content: ${legacyFlexJustify(styles.footerAlignment)};
    gap: 20px;
  }
  .u-page-number {
    ${styles.footerAlignment === 'right' ? 'margin-right:auto' : styles.footerAlignment === 'left' ? 'margin-left:auto' : ''}
  }
  @media print {
    @page {
      @bottom-center {
        content: "صفحة " counter(page) " من " counter(pages);
        font-family: 'Cairo', 'Manrope', sans-serif;
        font-size: 10px;
        color: #666;
      }
    }
    .u-page-number { display: none !important; }
    .u-header { box-shadow: none !important; }
  }
  `;
}

export function unifiedHeaderHtml(opts: {
  styles: UnifiedPrintStyles;
  fullLogoUrl: string;
  metaLinesHtml: string;
  titleAr?: string;
  titleEn?: string;
}) {
  const { styles, fullLogoUrl, metaLinesHtml } = opts;
  const titleEn = opts.titleEn || styles.invoiceTitleEn || '';
  const titleAr = opts.titleAr || styles.invoiceTitle || '';
  const showLogo = styles.showLogo !== false;
  const headerStyle = styles.headerStyle || 'classic';
  const showContactInfo = styles.showContactInfo !== false;

  const contactParts: string[] = [];
  if (showContactInfo) {
    if (styles.showCompanyAddress && styles.companyAddress) contactParts.push(`<div>${styles.companyAddress}</div>`);
    if (styles.showCompanyPhone && styles.companyPhone) contactParts.push(`<div>هاتف: ${styles.companyPhone}</div>`);
    if (styles.showTaxId && styles.companyTaxId) contactParts.push(`<div>السجل التجاري: ${styles.companyTaxId}</div>`);
    if (styles.showEmail && styles.companyEmail) contactParts.push(`<div>${styles.companyEmail}</div>`);
    if (styles.showWebsite && styles.companyWebsite) contactParts.push(`<div>${styles.companyWebsite}</div>`);
  }

  const logoBlock = showLogo ? `<img src="${fullLogoUrl}" alt="شعار الشركة" class="u-logo" onerror="this.style.display='none'"/>` : '';

  // ===== headerStyle: centered =====
  if (headerStyle === 'centered') {
    return `
    <div class="u-header" style="flex-direction:column;align-items:center;text-align:center;">
      ${logoBlock}
      ${styles.showCompanyInfo !== false && styles.showCompanyName && styles.companyName ? `<div class="u-company-name" style="text-align:center;">${styles.companyName}</div>` : ''}
      ${titleAr ? `<div class="u-invoice-title" style="text-align:center;">${titleAr}</div>` : ''}
      ${titleEn ? `<div class="u-invoice-subtitle" style="text-align:center;">${titleEn}</div>` : ''}
      <div class="u-invoice-details" style="text-align:center;">${metaLinesHtml}</div>
      ${contactParts.length > 0 ? `<div class="u-contact-info" style="text-align:center;">${contactParts.join('')}</div>` : ''}
    </div>
    `;
  }

  // ===== headerStyle: simple =====
  if (headerStyle === 'simple') {
    return `
    <div class="u-header" style="flex-direction:column;align-items:center;text-align:center;gap:6px;">
      ${logoBlock}
      ${styles.showCompanyInfo !== false && styles.showCompanyName && styles.companyName ? `<div class="u-company-name" style="text-align:center;">${styles.companyName}</div>` : ''}
    </div>
    `;
  }

  // ===== headerStyle: minimal =====
  if (headerStyle === 'minimal') {
    return `
    <div class="u-header" style="flex-direction:row;align-items:center;gap:10px;padding-bottom:8px;">
      ${showLogo ? `<img src="${fullLogoUrl}" alt="Logo" class="u-logo" style="height:24px;max-width:none;" onerror="this.style.display='none'"/>` : ''}
      ${styles.showCompanyInfo !== false && styles.showCompanyName && styles.companyName ? `<span class="u-company-name" style="font-size:12px;margin:0;">${styles.companyName}</span>` : ''}
      <span style="flex:1;"></span>
      <span style="font-size:10px;color:#666;">${titleAr || titleEn || ''}</span>
    </div>
    `;
  }

  // ===== 'classic' and 'modern' use two-column layout =====
  const isModern = headerStyle === 'modern';
  const swap = isModern ? !(styles.headerSwap === true) : (styles.headerSwap === true);

  const invoiceInfoBlock = `
    <div class="u-invoice-info">
      ${titleAr ? `<div class="u-invoice-title">${titleAr}</div>` : ''}
      ${titleEn ? `<div class="u-invoice-subtitle">${titleEn}</div>` : ''}
      <div class="u-invoice-details">${metaLinesHtml}</div>
    </div>
  `;

  // Determine company-side alignment based on swap
  // swap=false (default): company on RIGHT in RTL → align-items:flex-end
  // swap=true: company on LEFT in RTL → align-items:flex-start
  const companyFlexAlign = swap ? 'align-items:flex-start;' : 'align-items:flex-end;';

  const companySideBlock = `
    <div class="u-company-side" style="${companyFlexAlign}">
      ${logoBlock}
      ${styles.showCompanyInfo !== false && styles.showCompanyName && styles.companyName ? `<div class="u-company-name">${styles.companyName}</div>` : ''}
      ${styles.showCompanyInfo !== false && styles.showCompanySubtitle && styles.companySubtitle ? `<div class="u-company-subtitle">${styles.companySubtitle}</div>` : ''}
      ${contactParts.length > 0 ? `<div class="u-contact-info">${contactParts.join('')}</div>` : ''}
    </div>
  `;

  // RTL: first child = RIGHT visually
  // Default (swap=false): company/logo RIGHT, title LEFT
  // Swapped (swap=true): title RIGHT, company/logo LEFT
  const firstContent = swap ? invoiceInfoBlock : companySideBlock;
  const secondContent = swap ? companySideBlock : invoiceInfoBlock;

  // Alignment for text
  const titleOnRight = swap;
  const titleAlign = titleOnRight ? 'text-align:right;' : 'text-align:left;';
  const companyTextAlign = titleOnRight ? 'text-align:left;' : 'text-align:right;';

  const firstIsTitle = swap;
  const firstStyle = firstIsTitle ? titleAlign : companyTextAlign;
  const secondStyle = firstIsTitle ? companyTextAlign : titleAlign;

  return `
  <div class="u-header">
    <div style="${firstStyle}">${firstContent}</div>
    <div style="${secondStyle}">${secondContent}</div>
  </div>
  `;
}

export function unifiedFooterHtml(styles: UnifiedPrintStyles, pageText = 'صفحة 1 من 1') {
  if (styles.showFooter === false) return '';
  return `
  <div class="u-footer">
    <span>${styles.footerText || ''}</span>
    ${styles.showPageNumber !== false ? `<span class="u-page-number">${pageText}</span>` : ''}
  </div>
  `;
}
