/**
 * جسر بين نظام print_settings (صفحة تصميم الطباعة) ونظام invoice_templates (الفواتير)
 * يسمح لصفحة تصميم الطباعة بالتحكم الكامل في مظهر الفواتير
 */

import { supabase } from '@/integrations/supabase/client';
import { InvoiceTemplateType } from '@/types/invoice-templates';
import { DocumentType, DOCUMENT_TYPES } from '@/types/document-types';

// =====================================================
// خريطة الربط بين أنواع الفواتير وأنواع المستندات
// =====================================================

const INVOICE_TO_DOCUMENT_MAP: Record<InvoiceTemplateType, DocumentType> = {
  contract: DOCUMENT_TYPES.CONTRACT_INVOICE,
  receipt: DOCUMENT_TYPES.PAYMENT_RECEIPT,
  print_invoice: DOCUMENT_TYPES.PRINT_SERVICE_INVOICE,
  sales_invoice: DOCUMENT_TYPES.SALES_INVOICE,
  purchase_invoice: DOCUMENT_TYPES.PURCHASE_INVOICE,
  custody: DOCUMENT_TYPES.CUSTODY_STATEMENT,
  expenses: DOCUMENT_TYPES.EXPENSE_INVOICE,
  installation: DOCUMENT_TYPES.INSTALLATION_INVOICE,
  team_payment: DOCUMENT_TYPES.TEAM_PAYMENT_RECEIPT,
  offer: DOCUMENT_TYPES.QUOTATION,
  account_statement: DOCUMENT_TYPES.ACCOUNT_STATEMENT,
  overdue_notice: DOCUMENT_TYPES.LATE_NOTICE,
  friend_rental: DOCUMENT_TYPES.FRIEND_RENT_RECEIPT,
  print_task: DOCUMENT_TYPES.PRINT_TASK,
  cutout_task: DOCUMENT_TYPES.CUT_TASK,
  composite_task: DOCUMENT_TYPES.COMBINED_TASK,
  customer_invoice: DOCUMENT_TYPES.CUSTOMER_INVOICE,
  sizes_invoice: DOCUMENT_TYPES.MEASUREMENTS_INVOICE,
};

// Cache
let printSettingsCache: Record<string, any> = {};
let printSettingsCacheTime = 0;
const CACHE_TTL = 60000;

/**
 * جلب إعدادات print_settings لنوع فاتورة معين
 * وتحويلها إلى الصيغة المستخدمة في الفواتير
 */
export async function fetchPrintSettingsForInvoice(invoiceType: InvoiceTemplateType): Promise<Record<string, any> | null> {
  const documentType = INVOICE_TO_DOCUMENT_MAP[invoiceType];
  if (!documentType) return null;

  // Check cache
  if (printSettingsCache[documentType] && Date.now() - printSettingsCacheTime < CACHE_TTL) {
    return printSettingsCache[documentType];
  }

  try {
    const { data, error } = await supabase
      .from('print_settings')
      .select('*')
      .eq('document_type', documentType)
      .single();

    if (error || !data) return null;

    // تحويل أسماء الحقول من print_settings إلى صيغة الفواتير
    const mapped = mapPrintSettingsToInvoiceStyles(data);
    printSettingsCache[documentType] = mapped;
    printSettingsCacheTime = Date.now();
    return mapped;
  } catch {
    return null;
  }
}

/**
 * تحويل حقول print_settings إلى الصيغة المستخدمة في getMergedInvoiceStyles
 */
function mapPrintSettingsToInvoiceStyles(ps: any): Record<string, any> {
  const result: Record<string, any> = {};

  // بيانات الشركة - دائماً تُنسخ (حتى لو فارغة)
  result.companyName = ps.company_name ?? '';
  result.companySubtitle = ps.company_subtitle ?? '';
  result.companyAddress = ps.company_address ?? '';
  result.companyPhone = ps.company_phone ?? '';
  result.companyTaxId = ps.company_tax_id ?? '';
  result.companyEmail = ps.company_email ?? '';
  result.companyWebsite = ps.company_website ?? '';

  // الشعار
  result.logoPath = ps.logo_path || '/logofaresgold.svg';
  result.logoSize = ps.logo_size || 60;
  result.logoPosition = ps.logo_position || 'right';

  // إظهار/إخفاء
  result.showLogo = ps.show_logo ?? true;
  result.showFooter = ps.show_footer ?? true;
  result.showPageNumber = ps.show_page_number ?? true;
  result.showCompanyName = ps.show_company_name ?? true;
  result.showCompanySubtitle = ps.show_company_subtitle ?? false;
  result.showCompanyAddress = ps.show_company_address ?? true;
  result.showCompanyPhone = ps.show_company_contact ?? true;
  result.showCustomerSection = ps.show_customer_section ?? true;
  result.showTaxId = ps.show_tax_id ?? false;
  result.showEmail = ps.show_email ?? false;
  result.showWebsite = ps.show_website ?? false;

  // ألوان
  result.primaryColor = ps.primary_color || '#D4AF37';
  result.secondaryColor = ps.secondary_color || '#1a1a2e';
  result.accentColor = ps.accent_color || '#f0e6d2';
  result.headerBgColor = ps.header_bg_color || '#D4AF37';
  result.headerTextColor = ps.header_text_color || '#ffffff';

  // ألوان الجدول
  result.tableBorderColor = ps.table_border_color || '#e5e5e5';
  result.tableHeaderBgColor = ps.table_header_bg_color || '#D4AF37';
  result.tableHeaderTextColor = ps.table_header_text_color || '#ffffff';
  result.tableRowEvenColor = ps.table_row_even_color || '#f8f9fa';
  result.tableRowOddColor = ps.table_row_odd_color || '#ffffff';
  result.tableTextColor = ps.table_text_color || '#000000';
  result.tableRowOpacity = ps.table_row_opacity ?? 100;

  // حدود الجدول
  result.tableBorderWidth = ps.table_border_width ?? 1;
  result.tableBorderStyle = ps.table_border_style || 'solid';
  result.tableBorderRadius = ps.table_border_radius ?? 0;

  // خصائص الجدول
  if (ps.table_header_font_size) result.tableHeaderFontSize = ps.table_header_font_size;
  if (ps.table_header_padding) result.tableHeaderPadding = ps.table_header_padding;
  if (ps.table_header_font_weight) result.tableHeaderFontWeight = ps.table_header_font_weight;
  if (ps.table_body_font_size) result.tableBodyFontSize = ps.table_body_font_size;
  if (ps.table_body_padding) result.tableBodyPadding = ps.table_body_padding;

  // ألوان قسم العميل
  result.customerSectionBgColor = ps.customer_section_bg_color || '#f8f9fa';
  result.customerSectionBorderColor = ps.customer_section_border_color || ps.primary_color || '#D4AF37';
  result.customerSectionTextColor = ps.customer_text_color || '#333333';
  result.customerSectionTitleColor = ps.primary_color || '#D4AF37';

  // ألوان الإجماليات
  result.totalBgColor = ps.summary_bg_color || ps.primary_color || '#D4AF37';
  result.totalTextColor = ps.summary_text_color || '#ffffff';
  result.subtotalBgColor = ps.totals_box_bg_color || '#f8f9fa';
  result.subtotalTextColor = ps.totals_box_text_color || '#333333';
  result.totalBorderColor = ps.totals_box_border_color || ps.primary_color || '#D4AF37';

  // خطوط
  result.fontFamily = ps.font_family || 'Doran';
  result.titleFontSize = ps.title_font_size || 24;
  result.headerFontSize = ps.header_font_size || 14;
  result.bodyFontSize = ps.body_font_size || 12;

  // ✅ أحجام عناوين الفاتورة
  result.invoiceTitleArFontSize = ps.invoice_title_ar_font_size || 18;
  result.invoiceTitleEnFontSize = ps.invoice_title_en_font_size || 22;
  result.customerNameFontSize = ps.customer_name_font_size || 20;
  result.statValueFontSize = ps.stat_value_font_size || 28;

  // الفوتر
  result.footerText = ps.footer_text || 'شكراً لتعاملكم معنا';
  result.footerAlignment = ps.footer_alignment || 'center';
  result.footerTextColor = ps.footer_text_color || '#666666';
  result.footerBgColor = ps.footer_bg_color || 'transparent';
  result.footerPosition = ps.footer_position ?? 15;

  // الخلفية
  if (ps.background_image) result.backgroundImage = ps.background_image;
  result.backgroundOpacity = ps.background_opacity ?? 100;
  result.backgroundPosX = ps.background_pos_x ?? 50;
  result.backgroundPosY = ps.background_pos_y ?? 50;
  result.backgroundScale = ps.background_scale ?? 100;

  // المسافات
  result.headerMarginBottom = ps.header_margin_bottom || 20;
  result.pageMarginTop = ps.page_margin_top || 15;
  result.pageMarginBottom = ps.page_margin_bottom || 15;
  result.pageMarginLeft = ps.page_margin_left || 15;
  result.pageMarginRight = ps.page_margin_right || 15;
  result.contentBottomSpacing = ps.content_bottom_spacing ?? 25;

  // عنوان المستند
  if (ps.document_title_ar) result.invoiceTitle = ps.document_title_ar;
  if (ps.document_title_en) result.invoiceTitleEn = ps.document_title_en;
  if (ps.document_title_alignment) result.invoiceTitleAlignment = ps.document_title_alignment;
  if (ps.header_alignment) result.headerAlignment = ps.header_alignment;

  // ✅ تبديل نصفي الهيدر - يعتمد على header_swap أو logo_position
  if (ps.header_swap !== null && ps.header_swap !== undefined) {
    result.headerSwap = ps.header_swap;
  } else if (ps.logo_position === 'left') {
    // logo_position=left في RTL يعني الشعار يسار والعنوان يمين = headerSwap=true
    result.headerSwap = true;
  }
  // ✅ دعم logo_position كمرادف لـ header_swap
  if (ps.logo_position === 'left' && !ps.header_swap) {
    result.headerSwap = true;
  }

  // ✅ نمط الهيدر (header_style)
  result.headerStyle = ps.header_style || 'classic';

  // ✅ عرض المنطقتين في الهيدر
  if (ps.logo_container_width) result.logoContainerWidth = ps.logo_container_width;
  if (ps.title_container_width) result.titleContainerWidth = ps.title_container_width;

  // ✅ ملاحظات
  result.notesBgColor = ps.notes_bg_color || '#f8f9fa';
  result.notesTextColor = ps.notes_text_color || '#333333';
  result.notesBorderColor = ps.notes_border_color || '#e5e5e5';
  result.notesAlignment = ps.notes_alignment || 'right';

  // ✅ معلومات الاتصال - تعتمد على الحقول الفردية
  result.showContactInfo = !!(ps.show_company_address || ps.show_company_contact || ps.show_tax_id || ps.show_email || ps.show_website);
  result.contactInfoFontSize = ps.header_font_size || 10;

  // ✅ إظهار/إخفاء العنوان ومعلومات الشركة - كل واحد مستقل
  result.showInvoiceTitle = true;
  result.showCompanyInfo = !!(ps.show_company_name || ps.show_company_subtitle);
  result.showHeader = true;

  // ✅ التاريخ الهجري
  result.showHijriDate = ps.show_hijri_date ?? false;

  return result;
}

/**
 * توليد نص border CSS من إعدادات الطباعة
 * يُستخدم في جميع المكونات التي تبني HTML خاص
 */
export function getTableBorderCSS(styles: Record<string, any>): string {
  const width = styles.tableBorderWidth ?? 1;
  const style = styles.tableBorderStyle || 'solid';
  const color = styles.tableBorderColor || styles.primaryColor || '#D4AF37';
  return `${width}px ${style} ${color}`;
}

/**
 * توليد border-radius CSS للجدول
 */
export function getTableBorderRadiusCSS(styles: Record<string, any>): string {
  const radius = styles.tableBorderRadius ?? 0;
  return radius ? `border-radius: ${radius}px; overflow: hidden;` : '';
}

/**
 * مسح الكاش
 */
export function clearPrintSettingsBridgeCache() {
  printSettingsCache = {};
  printSettingsCacheTime = 0;
}
