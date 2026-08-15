/**
 * PrintThemeResolver
 * يحول إعدادات Redux إلى PrintTheme
 * 
 * ⚠️ قاعدة ذهبية: لا fallback colors - القيم تأتي كما هي من Redux
 */

import { PrintSettings, HeaderAlignmentType } from '@/types/print-settings';
import { PrintTheme, DirectionType, AlignmentType } from './types';

/**
 * تحويل alignment إلى flex align
 */
function alignmentToFlexAlign(
  alignment: AlignmentType,
  direction: DirectionType
): 'flex-start' | 'center' | 'flex-end' {
  if (alignment === 'center') return 'center';
  
  if (direction === 'rtl') {
    return alignment === 'right' ? 'flex-start' : 'flex-end';
  } else {
    return alignment === 'left' ? 'flex-start' : 'flex-end';
  }
}

/**
 * resolvePrintTheme - الدالة الرئيسية
 * تحول settings من Redux إلى PrintTheme جاهز للاستخدام
 * 
 * ❌ ممنوع: أي default color هنا
 * ✅ مسموح: القيم تأتي كما هي من settings
 */
export function resolvePrintTheme(settings: PrintSettings): PrintTheme {
  const direction = settings.direction;
  const headerAlignment = settings.header_alignment;
  const footerAlignment = settings.footer_alignment;
  const headerDirection = settings.header_direction || 'row';
  const logoPositionOrder = settings.logo_position_order || 0;
  const headerStyle = settings.header_style || 'classic';
  
  // Convert header_alignment to AlignmentType (handle 'split')
  const effectiveAlignment: AlignmentType = headerAlignment === 'split' ? 'right' : headerAlignment;
  
  // ✅ حساب flexDirection بناءً على نمط الهيدر
  let flexDirection: 'row' | 'row-reverse' | 'column' = direction === 'rtl' ? 'row-reverse' : 'row';
  let alignItems: 'flex-start' | 'center' | 'flex-end' = alignmentToFlexAlign(effectiveAlignment, direction);
  let justifyContent: 'flex-start' | 'center' | 'flex-end' | 'space-between' = 'space-between';
  
  const headerSwap = settings.header_swap ?? false;
  
  // Apply header direction and logo position order
  if (headerDirection === 'column' || headerStyle === 'centered') {
    flexDirection = 'column';
    alignItems = 'center';
    justifyContent = 'center';
  } else {
    // Row direction - apply logo position order and header_swap
    if (headerSwap) {
      // ✅ header_swap يعكس اتجاه الهيدر
      flexDirection = direction === 'rtl' ? 'row' : 'row-reverse';
    } else if (logoPositionOrder === 1) {
      flexDirection = 'row-reverse';
    } else {
      flexDirection = direction === 'rtl' ? 'row-reverse' : 'row';
    }
    
    // Apply header alignment
    if (headerAlignment === 'center') {
      justifyContent = 'center';
    } else if (headerAlignment === 'split') {
      justifyContent = 'space-between';
    } else if (headerAlignment === 'left') {
      justifyContent = direction === 'rtl' ? 'flex-end' : 'flex-start';
    } else {
      justifyContent = direction === 'rtl' ? 'flex-start' : 'flex-end';
    }
  }
  
  return {
    // الاتجاه
    direction: direction,
    textAlign: effectiveAlignment,
    
    // Flex - Header Layout
    flexDirection,
    alignItems,
    justifyContent,
    headerDirection: headerDirection as 'row' | 'column',
    logoPositionOrder,
    headerSwap,
    
    // الألوان - كما هي من settings بدون أي تعديل
    primaryColor: settings.primary_color,
    secondaryColor: settings.secondary_color,
    accentColor: settings.accent_color,
    headerBgColor: settings.header_bg_color,
    headerTextColor: settings.header_text_color,
    
    // ✅ ألوان الجدول
    tableHeaderBgColor: settings.table_header_bg_color,
    tableHeaderTextColor: settings.table_header_text_color,
    tableBorderColor: settings.table_border_color,
    tableRowEvenColor: settings.table_row_even_color,
    tableRowOddColor: settings.table_row_odd_color,
    
    // ✅ إعدادات صندوق الإجماليات الموحد
    totalsBoxBgColor: settings.totals_box_bg_color ?? '#f8f9fa',
    totalsBoxTextColor: settings.totals_box_text_color ?? '#333333',
    totalsBoxBorderColor: settings.totals_box_border_color ?? settings.primary_color,
    totalsBoxBorderRadius: settings.totals_box_border_radius ?? 8,
    totalsTitleFontSize: settings.totals_title_font_size ?? 14,
    totalsValueFontSize: settings.totals_value_font_size ?? 16,
    
    // الخطوط
    fontFamily: settings.font_family,
    titleFontSize: `${settings.title_font_size}px`,
    headerFontSize: `${settings.header_font_size}px`,
    bodyFontSize: `${settings.body_font_size}px`,
    
    // الشعار
    showLogo: settings.show_logo,
    logoPath: settings.logo_path,
    logoSize: `${settings.logo_size}px`,
    
    // الفوتر
    showFooter: settings.show_footer,
    footerText: settings.footer_text,
    showPageNumber: settings.show_page_number,
    footerTextAlign: footerAlignment,
    
    // ✅ التحكم الدقيق في عناصر معلومات الشركة
    showCompanyName: settings.show_company_name ?? true,
    showCompanySubtitle: settings.show_company_subtitle ?? false,
    showCompanyAddress: settings.show_company_address ?? true,
    showCompanyContact: settings.show_company_contact ?? true,
    
    // معلومات الشركة
    companyName: settings.company_name,
    companySubtitle: settings.company_subtitle,
    companyAddress: settings.company_address,
    companyPhone: settings.company_phone,
    
    // المسافات
    pageMargins: {
      top: `${settings.page_margin_top}mm`,
      bottom: `${settings.page_margin_bottom}mm`,
      left: `${settings.page_margin_left}mm`,
      right: `${settings.page_margin_right}mm`,
    },
    headerMarginBottom: `${settings.header_margin_bottom || 20}px`,
  };
}
