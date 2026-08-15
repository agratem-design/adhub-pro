/**
 * Smart Styling Helper
 * Helper مركزي لتوحيد الأنماط في جميع مكونات الطباعة
 */

import { PrintSettings, DEFAULT_PRINT_SETTINGS, AlignmentType, DirectionType, HeaderStyleType, HeaderAlignmentType, LOGO_SIZES, LogoSizeType } from '@/types/print-settings';

// =====================================================
// واجهة التنسيق النهائي
// =====================================================

export interface PrintLayoutConfig {
  // الاتجاه
  direction: DirectionType;
  textDirection: 'rtl' | 'ltr';
  
  // ✅ نمط الهيدر الجديد
  headerStyle: HeaderStyleType;
  
  // Flex directions
  flexDirection: 'row' | 'row-reverse' | 'column';
  alignItems: 'flex-start' | 'center' | 'flex-end';
  justifyContent: 'flex-start' | 'center' | 'flex-end' | 'space-between';
  
  // Text alignment
  textAlign: 'right' | 'center' | 'left';
  headerTextAlign: 'right' | 'center' | 'left';
  footerTextAlign: 'right' | 'center' | 'left';
  
  // Colors
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  headerBgColor: string;
  headerTextColor: string;
  
  // Table colors
  tableHeaderBgColor: string;
  tableHeaderTextColor: string;
  tableBorderColor: string;
  tableRowEvenColor: string;
  tableRowOddColor: string;
  
  // Fonts
  fontFamily: string;
  titleFontSize: string;
  headerFontSize: string;
  bodyFontSize: string;
  
  // Logo
  showLogo: boolean;
  logoPath: string;
  logoSize: string;
  
  // Footer
  showFooter: boolean;
  footerText: string;
  showPageNumber: boolean;
  
  // Background
  backgroundImage: string;
  backgroundOpacity: number;
  
  // Margins
  pageMargins: {
    top: string;
    bottom: string;
    left: string;
    right: string;
  };
  
  // ✅ التحكم الدقيق في عناصر معلومات الشركة
  showCompanyName: boolean;
  showCompanySubtitle: boolean;
  showCompanyAddress: boolean;
  showCompanyContact: boolean;
  
  // Company info
  companyName: string;
  companySubtitle: string;
  companyAddress: string;
  companyPhone: string;
}

// =====================================================
// تحويل المحاذاة إلى Flex
// =====================================================

function alignmentToFlexAlign(alignment: AlignmentType, direction: DirectionType): 'flex-start' | 'center' | 'flex-end' {
  if (alignment === 'center') return 'center';
  
  if (direction === 'rtl') {
    return alignment === 'right' ? 'flex-start' : 'flex-end';
  } else {
    return alignment === 'left' ? 'flex-start' : 'flex-end';
  }
}

function alignmentToJustify(alignment: AlignmentType, direction: DirectionType): 'flex-start' | 'center' | 'flex-end' {
  if (alignment === 'center') return 'center';
  
  if (direction === 'rtl') {
    return alignment === 'right' ? 'flex-start' : 'flex-end';
  } else {
    return alignment === 'left' ? 'flex-start' : 'flex-end';
  }
}

// =====================================================
// الدالة الرئيسية
// =====================================================

export function getPrintLayoutConfig(settings: Partial<PrintSettings> = {}): PrintLayoutConfig {
  // دمج الإعدادات مع الافتراضيات
  const merged = { ...DEFAULT_PRINT_SETTINGS, ...settings };
  
  const direction = merged.direction;
  const headerAlignment = merged.header_alignment;
  const footerAlignment = merged.footer_alignment;
  const headerStyle = merged.header_style || 'classic';
  
  // Convert header_alignment to AlignmentType for functions (handle 'split')
  const effectiveAlignment: AlignmentType = headerAlignment === 'split' ? 'right' : headerAlignment;
  
  // ✅ حساب flexDirection بناءً على نمط الهيدر
  let flexDirection: 'row' | 'row-reverse' | 'column' = direction === 'rtl' ? 'row-reverse' : 'row';
  let alignItems: 'flex-start' | 'center' | 'flex-end' = alignmentToFlexAlign(effectiveAlignment, direction);
  let justifyContent: 'flex-start' | 'center' | 'flex-end' | 'space-between' = 'space-between';
  
  switch (headerStyle) {
    case 'classic': // الشعار على اليمين
      flexDirection = 'row-reverse';
      alignItems = 'center';
      justifyContent = 'space-between';
      break;
    case 'modern': // الشعار على اليسار
      flexDirection = 'row';
      alignItems = 'center';
      justifyContent = 'space-between';
      break;
    case 'centered': // الكل في المنتصف
      flexDirection = 'column';
      alignItems = 'center';
      justifyContent = 'center';
      break;
    case 'simple': // بسيط - شعار ونص
      flexDirection = 'row-reverse';
      alignItems = 'center';
      justifyContent = 'center';
      break;
    case 'minimal': // مختصر - خط واحد
      flexDirection = 'row-reverse';
      alignItems = 'center';
      justifyContent = 'space-between';
      break;
  }
  
  return {
    // الاتجاه
    direction: direction,
    textDirection: direction,
    
    // ✅ نمط الهيدر
    headerStyle: headerStyle,
    
    // Flex directions
    flexDirection,
    alignItems,
    justifyContent,
    
    // Text alignment (handle 'split' for headerAlignment)
    textAlign: headerAlignment === 'split' ? 'right' : headerAlignment,
    headerTextAlign: headerStyle === 'centered' ? 'center' : (headerAlignment === 'split' ? 'right' : headerAlignment),
    footerTextAlign: footerAlignment,
    
    // Colors
    primaryColor: merged.primary_color,
    secondaryColor: merged.secondary_color,
    accentColor: merged.accent_color,
    headerBgColor: merged.header_bg_color,
    headerTextColor: merged.header_text_color,
    
    // ✅ Table colors
    tableHeaderBgColor: merged.table_header_bg_color,
    tableHeaderTextColor: merged.table_header_text_color,
    tableBorderColor: merged.table_border_color,
    tableRowEvenColor: merged.table_row_even_color,
    tableRowOddColor: merged.table_row_odd_color,
    
    // Fonts
    fontFamily: merged.font_family,
    titleFontSize: `${merged.title_font_size}px`,
    headerFontSize: `${merged.header_font_size}px`,
    bodyFontSize: `${merged.body_font_size}px`,
    
    // Logo
    showLogo: merged.show_logo,
    logoPath: merged.logo_path,
    logoSize: `${merged.logo_size}px`,
    
    // Footer
    showFooter: merged.show_footer,
    footerText: merged.footer_text,
    showPageNumber: merged.show_page_number,
    
    // Background
    backgroundImage: merged.background_image,
    backgroundOpacity: merged.background_opacity,
    
    // Margins
    pageMargins: {
      top: `${merged.page_margin_top}mm`,
      bottom: `${merged.page_margin_bottom}mm`,
      left: `${merged.page_margin_left}mm`,
      right: `${merged.page_margin_right}mm`,
    },
    
    // ✅ التحكم الدقيق في عناصر معلومات الشركة
    showCompanyName: merged.show_company_name ?? true,
    showCompanySubtitle: merged.show_company_subtitle ?? false,
    showCompanyAddress: merged.show_company_address ?? true,
    showCompanyContact: merged.show_company_contact ?? true,
    
    // Company info
    companyName: merged.company_name,
    companySubtitle: merged.company_subtitle,
    companyAddress: merged.company_address,
    companyPhone: merged.company_phone,
  };
}

// =====================================================
// دوال مساعدة للـ CSS
// =====================================================

export function getHeaderStyles(config: PrintLayoutConfig): React.CSSProperties {
  return {
    direction: config.direction,
    display: 'flex',
    flexDirection: config.flexDirection,
    alignItems: config.alignItems,
    justifyContent: config.justifyContent,
    backgroundColor: config.headerBgColor,
    color: config.headerTextColor,
    fontFamily: config.fontFamily,
    width: '100%',
  };
}

export function getBodyStyles(config: PrintLayoutConfig): React.CSSProperties {
  return {
    direction: config.direction,
    fontFamily: config.fontFamily,
    fontSize: config.bodyFontSize,
    textAlign: config.textAlign,
  };
}

export function getFooterStyles(config: PrintLayoutConfig): React.CSSProperties {
  return {
    direction: config.direction,
    textAlign: config.footerTextAlign,
    fontFamily: config.fontFamily,
  };
}

export function getPageStyles(config: PrintLayoutConfig): React.CSSProperties {
  return {
    direction: config.direction,
    fontFamily: config.fontFamily,
    paddingTop: config.pageMargins.top,
    paddingBottom: config.pageMargins.bottom,
    paddingLeft: config.pageMargins.left,
    paddingRight: config.pageMargins.right,
  };
}

// =====================================================
// CSS للطباعة
// =====================================================

export function generatePrintCSS(config: PrintLayoutConfig): string {
  return `
    @page {
      size: A4;
      margin: 0;
    }
    
    html, body {
      direction: ${config.direction};
      font-family: '${config.fontFamily}', sans-serif;
    }
    
    * {
      box-sizing: border-box;
    }
    
    /* print-header styles now come from unified system */
    
    .print-content {
      direction: ${config.direction};
      text-align: ${config.textAlign};
      font-size: ${config.bodyFontSize};
    }
    
    .print-footer {
      direction: ${config.direction};
      text-align: ${config.footerTextAlign};
    }
    
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    
    .flex-rtl {
      display: flex;
      flex-direction: row-reverse;
    }
    
    .flex-ltr {
      display: flex;
      flex-direction: row;
    }
  `;
}

// =====================================================
// دوال للعناصر المحددة
// =====================================================

export function getCompanyInfoStyles(config: PrintLayoutConfig): React.CSSProperties {
  return {
    textAlign: config.headerTextAlign,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: config.alignItems,
  };
}

export function getLogoContainerStyles(config: PrintLayoutConfig): React.CSSProperties {
  return {
    width: config.logoSize,
    height: config.logoSize,
  };
}

/**
 * دالة للحصول على alignment كـ CSS
 */
export function getAlignmentCSS(alignment: AlignmentType): string {
  return alignment;
}

/**
 * دالة للحصول على flex align-items من alignment
 */
export function getFlexAlignFromAlignment(alignment: AlignmentType, direction: DirectionType = 'rtl'): string {
  return alignmentToFlexAlign(alignment, direction);
}
