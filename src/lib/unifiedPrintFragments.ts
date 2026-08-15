/**
 * Unified Print Fragments
 * هيدر وفوتر موحد لجميع الفواتير
 * 
 * ✅ المرجع: فاتورة المهمة المجمعة (CompositeTaskInvoicePrint)
 * - العنوان العربي كبير + العنوان الإنجليزي تحته
 * - تفاصيل المستند (التاريخ، الرقم) تحت العناوين
 * - الشعار على الجانب المقابل
 * - خط سفلي بلون primaryColor
 */

export type AlignmentOption = 'left' | 'center' | 'right';

export interface UnifiedPrintStyles {
  // Company info
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

  // Header alignment
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

  // Layout
  headerMarginBottom?: number;
  footerPosition?: number;
  footerAlignment?: AlignmentOption;
  footerText?: string;
  footerTextColor?: string;
  footerBgColor?: string;
  showFooter?: boolean;
  showPageNumber?: boolean;

  // Colors
  primaryColor?: string;
  secondaryColor?: string;
  customerSectionTextColor?: string;
  tableBorderColor?: string;

  // Invoice title
  invoiceTitle?: string;
  invoiceTitleEn?: string;
  invoiceTitleAlignment?: AlignmentOption;

  // Header swap (swap logo/title sides)
  headerSwap?: boolean;

  // Font
  fontFamily?: string;
  headerFontSize?: number;
  bodyFontSize?: number;
  titleFontSize?: number;
}

const flexJustify = (a?: AlignmentOption) => (a === 'center' ? 'center' : a === 'left' ? 'flex-start' : 'flex-end');

export function unifiedHeaderFooterCss(styles: UnifiedPrintStyles) {
  const headerMarginBottom = styles.headerMarginBottom ?? 15;
  const footerPosition = styles.footerPosition ?? 15;
  const pc = styles.primaryColor || '#D4AF37';
  const sc = styles.secondaryColor || '#1a1a2e';
  const logoSize = styles.logoSize ?? 200;
  const headerFontSize = styles.headerFontSize ?? 14;

  return `
  /* ===== UNIFIED HEADER - Composite Task Reference Style ===== */
  .u-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: ${headerMarginBottom}px;
    border-bottom: 2px solid ${pc};
    padding-bottom: 12px;
    direction: rtl;
  }
  
  /* قسم معلومات الفاتورة - يمين (RTL) */
  .u-invoice-info {
    text-align: right;
    direction: rtl;
    flex: 1;
  }
  
  .u-invoice-title {
    font-size: clamp(14px, 22px, 22px);
    font-weight: bold;
    color: ${pc};
    margin-bottom: 6px;
    direction: rtl;
    word-wrap: break-word;
    overflow-wrap: break-word;
    white-space: normal;
    max-width: 100%;
    line-height: 1.3;
  }
  
  .u-invoice-subtitle {
    font-size: 12px;
    color: #666;
    font-weight: bold;
    margin-bottom: 6px;
    direction: ltr;
    text-align: left;
    font-family: Manrope, sans-serif;
    letter-spacing: 1px;
  }
  
  .u-invoice-details {
    font-size: 10px;
    color: #666;
    line-height: 1.4;
  }
  
  .u-invoice-details strong {
    color: ${pc};
  }
  
  /* قسم الشعار ومعلومات الشركة - يسار */
  .u-company-side {
    text-align: right;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
  }
  
  .u-logo {
    max-width: ${logoSize}px;
    height: auto;
    object-fit: contain;
  }
  
  .u-company-name {
    font-weight: 700;
    font-size: ${headerFontSize}px;
    color: ${pc};
    margin-bottom: 2px;
  }
  
  .u-company-subtitle {
    font-size: 11px;
    color: ${sc};
  }
  
  .u-contact-info {
    font-size: ${styles.contactInfoFontSize ?? 10}px;
    color: #666;
    line-height: 1.6;
    text-align: right;
  }

  /* ===== UNIFIED FOOTER ===== */
  .u-footer {
    width: 100%;
    margin-bottom: ${footerPosition}mm;
    padding-top: 10px;
    border-top: 2px solid ${pc};
    background: ${styles.footerBgColor && styles.footerBgColor !== 'transparent' ? styles.footerBgColor : 'transparent'};
    color: ${styles.footerTextColor || '#666'};
    font-size: 10px;
    display: flex;
    align-items: center;
    justify-content: ${flexJustify(styles.footerAlignment)};
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

  const titleEn = opts.titleEn || styles.invoiceTitleEn || 'INVOICE';
  const titleAr = opts.titleAr || styles.invoiceTitle || '';
  const showLogo = styles.showLogo !== false;
  const swap = styles.headerSwap === true;

  // بناء قسم معلومات الشركة
  const contactParts: string[] = [];
  if (styles.showCompanyAddress !== false && styles.showCompanyAddress && styles.companyAddress) contactParts.push(`<div>${styles.companyAddress}</div>`);
  if (styles.showCompanyPhone !== false && styles.showCompanyPhone && styles.companyPhone) contactParts.push(`<div>هاتف: ${styles.companyPhone}</div>`);
  if (styles.showTaxId && styles.companyTaxId) contactParts.push(`<div>الرقم الضريبي: ${styles.companyTaxId}</div>`);
  if (styles.showEmail && styles.companyEmail) contactParts.push(`<div>${styles.companyEmail}</div>`);
  if (styles.showWebsite && styles.companyWebsite) contactParts.push(`<div>${styles.companyWebsite}</div>`);

  // قسم العنوان والتفاصيل
  const invoiceInfoBlock = `
    <div class="u-invoice-info">
      ${titleAr ? `<div class="u-invoice-title">${titleAr}</div>` : ''}
      <div class="u-invoice-subtitle">${titleEn}</div>
      <div class="u-invoice-details">
        ${metaLinesHtml}
      </div>
    </div>
  `;

  // قسم الشعار ومعلومات الشركة
  const companySideBlock = `
    <div class="u-company-side">
      ${showLogo ? `<img src="${fullLogoUrl}" alt="شعار الشركة" class="u-logo" onerror="this.style.display='none'"/>` : ''}
      
      ${styles.showCompanyInfo !== false && styles.showCompanyName !== false && styles.showCompanyName && styles.companyName ? `<div class="u-company-name">${styles.companyName}</div>` : ''}
      ${styles.showCompanyInfo !== false && styles.showCompanySubtitle !== false && styles.showCompanySubtitle && styles.companySubtitle ? `<div class="u-company-subtitle">${styles.companySubtitle}</div>` : ''}
      
      ${contactParts.length > 0 ? `<div class="u-contact-info">${contactParts.join('')}</div>` : ''}
    </div>
  `;

  // RTL: في الوضع الافتراضي، الشعار يمين والعنوان يسار
  return `
  <div class="u-header">
    ${swap ? invoiceInfoBlock : companySideBlock}
    ${swap ? companySideBlock : invoiceInfoBlock}
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
