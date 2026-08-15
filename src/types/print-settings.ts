/**
 * إعدادات الطباعة الموحدة
 * تستخدم مع جدول print_settings في Supabase
 */

import { DocumentType } from './document-types';

// =====================================================
// أنواع المحاذاة
// =====================================================

export type AlignmentType = 'right' | 'center' | 'left';
export type DirectionType = 'rtl' | 'ltr';
export type HeaderAlignmentType = 'left' | 'center' | 'right' | 'split';
export type HeaderDirectionType = 'row' | 'column';

// =====================================================
// أنماط الهيدر الجديدة
// =====================================================

export type HeaderStyleType = 'classic' | 'modern' | 'centered' | 'simple' | 'minimal';

export const HEADER_STYLES: Record<HeaderStyleType, { label: string; description: string }> = {
  classic: { label: 'كلاسيكي', description: 'الشعار على اليمين، المعلومات على اليسار' },
  modern: { label: 'عصري', description: 'الشعار على اليسار، المعلومات على اليمين' },
  centered: { label: 'متمركز', description: 'الشعار والمعلومات في المنتصف' },
  simple: { label: 'بسيط', description: 'الشعار فقط مع اسم الشركة' },
  minimal: { label: 'مختصر', description: 'خط واحد مع الشعار الصغير' },
};

// =====================================================
// أحجام الشعار
// =====================================================

export type LogoSizeType = 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge';

export const LOGO_SIZES: Record<LogoSizeType, { label: string; value: number }> = {
  small: { label: 'صغير', value: 40 },
  medium: { label: 'متوسط', value: 60 },
  large: { label: 'كبير', value: 80 },
  xlarge: { label: 'كبير جداً', value: 120 },
  xxlarge: { label: 'ضخم', value: 160 },
};

// =====================================================
// إعدادات الطباعة لكل مستند
// =====================================================

export interface PrintSettings {
  // المعرف
  document_type: DocumentType;
  
  // معلومات الشركة
  company_name: string;
  company_subtitle: string;
  company_address: string;
  company_phone: string;
  company_tax_id?: string;
  company_email?: string;
  company_website?: string;
  
  // الاتجاه والمحاذاة
  direction: DirectionType;
  header_alignment: HeaderAlignmentType;
  header_direction: HeaderDirectionType;
 header_swap: boolean; // تبديل نصفي الهيدر (يمين يسار)
  logo_position_order: number;
  footer_alignment: AlignmentType;
  
  // ✅ نمط الهيدر الجديد
  header_style: HeaderStyleType;
  
  // ✅ حجم الشعار المصنف
  logo_size_preset: LogoSizeType;
  
  // الألوان الأساسية
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  header_bg_color: string;
  header_text_color: string;
  
  // ✅ ألوان جديدة دقيقة
  company_subtitle_color: string;
  customer_text_color: string;
  table_text_color: string;
  footer_text_color: string;
  
  // الخطوط
  font_family: string;
  title_font_size: number;
  header_font_size: number;
  body_font_size: number;
  
  // ✅ أحجام عناوين الفاتورة
  invoice_title_ar_font_size: number;
  invoice_title_en_font_size: number;
  customer_name_font_size: number;
  stat_value_font_size: number;
  
  // الشعار
  show_logo: boolean;
  logo_path: string;
  logo_size: number;
  logo_position: AlignmentType;
  
  // الفوتر
  show_footer: boolean;
  footer_text: string;
  show_page_number: boolean;
  
  // الخلفية
  background_image: string;
  background_opacity: number;
  
  // المسافات
  page_margin_top: number;
  page_margin_bottom: number;
  page_margin_left: number;
  page_margin_right: number;
  
  // ✅ مسافات جديدة
  header_margin_bottom: number;
  document_title_margin_top: number;
  document_title_alignment: AlignmentType;

  // =====================================================
  // الحقول الجديدة - عناصر المستند
  // =====================================================

  // عنوان المستند
  document_title_ar: string;
  document_title_en: string;
  
  // إظهار عناصر المستند
  show_document_number: boolean;
  show_document_date: boolean;
  show_hijri_date: boolean;
  date_format: string;
  
  // ✅ خيارات إظهار بيانات الشركة في الهيدر
  show_tax_id: boolean;
  show_email: boolean;
  show_website: boolean;
  
  // ✅ التحكم الدقيق في عناصر معلومات الشركة
  show_company_name: boolean;
  show_company_address: boolean;
  show_company_contact: boolean;
  show_company_subtitle: boolean;
  
  // ✅ إعدادات قسم معلومات المستند (الرقم + التاريخ)
  document_info_text_color: string;
  document_info_bg_color: string;
  document_info_alignment: AlignmentType;
  document_info_margin_top: number;
  
  // قسم العميل/الطرف
  show_customer_section: boolean;
  customer_section_title: string;
  customer_section_bg_color: string;
  customer_section_border_color: string;
  
  // ألوان الجدول
  table_header_bg_color: string;
  table_header_text_color: string;
  table_border_color: string;
  table_row_even_color: string;
  table_row_odd_color: string;
  
  // ✅ خصائص الجدول
  table_header_font_size: number;
  table_header_padding: string;
  table_body_font_size: number;
  table_body_padding: string;
  table_header_font_weight: string;
  table_line_height: string;
  table_border_width: number;
  table_border_style: string;
  table_border_radius: number;
  table_header_height: number;
  table_body_row_height: number;
  
  // ألوان الملخص
  summary_bg_color: string;
  summary_text_color: string;
  summary_border_color: string;
  
  // ✅ إعدادات صندوق الإجماليات الموحد
  totals_box_bg_color: string;
  totals_box_text_color: string;
  totals_box_border_color: string;
  totals_box_border_radius: number;
  totals_title_font_size: number;
  totals_value_font_size: number;
  
  // الحدود
  border_radius: number;
  border_width: number;
  
  // metadata
  created_at?: string;
  updated_at?: string;
}

// =====================================================
// الإعدادات الافتراضية
// =====================================================

export const DEFAULT_PRINT_SETTINGS: Omit<PrintSettings, 'document_type'> = {
  // معلومات الشركة
  company_name: '',
  company_subtitle: '',
  company_address: '',
  company_phone: '',
  company_tax_id: '',
  company_email: '',
  company_website: '',
  
  // الاتجاه والمحاذاة
  direction: 'rtl',
  header_alignment: 'split',
  header_direction: 'row',
  header_swap: false,
  logo_position_order: 0,
  footer_alignment: 'center',
  
  // ✅ نمط الهيدر الجديد
  header_style: 'classic',
  
  // ✅ حجم الشعار المصنف
  logo_size_preset: 'medium',
  
  // الألوان
  primary_color: '#D4AF37',
  secondary_color: '#1a1a2e',
  accent_color: '#f0e6d2',
  header_bg_color: '#D4AF37',
  header_text_color: '#ffffff',
  
  // ✅ ألوان جديدة دقيقة
  company_subtitle_color: '#666666',
  customer_text_color: '#333333',
  table_text_color: '#000000',
  footer_text_color: '#666666',
  
  // الخطوط
  font_family: 'Doran',
  title_font_size: 24,
  header_font_size: 14,
  body_font_size: 12,
  
  // ✅ أحجام عناوين الفاتورة
  invoice_title_ar_font_size: 18,
  invoice_title_en_font_size: 22,
  customer_name_font_size: 20,
  stat_value_font_size: 28,
  
  // الشعار
  show_logo: true,
  logo_path: '/logofaresgold.svg',
  logo_size: 60,
  logo_position: 'right',
  
  // الفوتر
  show_footer: true,
  footer_text: 'شكراً لتعاملكم معنا',
  show_page_number: true,
  
  // الخلفية
  background_image: '',
  background_opacity: 100,
  
  // المسافات
  page_margin_top: 15,
  page_margin_bottom: 15,
  page_margin_left: 15,
  page_margin_right: 15,
  
  // ✅ مسافات جديدة
  header_margin_bottom: 20,
  document_title_margin_top: 10,
  document_title_alignment: 'center',

  // عنوان المستند
  document_title_ar: '',
  document_title_en: '',
  
  // إظهار عناصر المستند
  show_document_number: true,
  show_document_date: true,
  show_hijri_date: false,
  date_format: 'ar-LY',
  
  // ✅ خيارات إظهار بيانات الشركة
  show_tax_id: false,
  show_email: false,
  show_website: false,
  
  // ✅ التحكم الدقيق في عناصر معلومات الشركة
  show_company_name: true,
  show_company_address: true,
  show_company_contact: true,
  show_company_subtitle: false,
  
  // ✅ إعدادات قسم معلومات المستند
  document_info_text_color: '#000000',
  document_info_bg_color: 'transparent',
  document_info_alignment: 'left',
  document_info_margin_top: 0,
  
  // قسم العميل
  show_customer_section: true,
  customer_section_title: 'بيانات العميل',
  customer_section_bg_color: '#f8f9fa',
  customer_section_border_color: '#D4AF37',
  
  // ألوان الجدول
  table_header_bg_color: '#D4AF37',
  table_header_text_color: '#ffffff',
  table_border_color: '#e5e5e5',
  table_row_even_color: '#f8f9fa',
  table_row_odd_color: '#ffffff',
  
  // ✅ خصائص الجدول
  table_header_font_size: 10,
  table_header_padding: '4px 8px',
  table_body_font_size: 10,
  table_body_padding: '4px',
  table_header_font_weight: 'bold',
  table_line_height: '1.4',
  table_border_width: 1,
  table_border_style: 'solid',
  table_border_radius: 0,
  table_header_height: 0,
  table_body_row_height: 0,
  
  // ألوان الملخص
  summary_bg_color: '#f0e6d2',
  summary_text_color: '#ffffff',
  summary_border_color: '#D4AF37',
  
  // ✅ إعدادات صندوق الإجماليات الموحد
  totals_box_bg_color: '#f8f9fa',
  totals_box_text_color: '#333333',
  totals_box_border_color: '#D4AF37',
  totals_box_border_radius: 8,
  totals_title_font_size: 14,
  totals_value_font_size: 16,
  
  // الحدود
  border_radius: 8,
  border_width: 1,
};

// =====================================================
// واجهة الإعدادات في Redux
// =====================================================

export interface PrintSettingsState {
  sharedDefaults: Omit<PrintSettings, 'document_type'>;
  byDocumentType: Partial<Record<DocumentType, PrintSettings>>;
  isLoading: boolean;
  lastFetched: number | null;
}
