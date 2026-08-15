/**
 * Redux-like Store لإعدادات الطباعة
 * يستخدم React Context + useReducer لإدارة الحالة
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DocumentType, DOCUMENT_TYPES } from '@/types/document-types';
import { PrintSettings, PrintSettingsState, DEFAULT_PRINT_SETTINGS, AlignmentType, DirectionType, HeaderAlignmentType, HeaderDirectionType } from '@/types/print-settings';
// Legacy import removed - print_settings is the single source of truth

// =====================================================
// Actions
// =====================================================

type PrintSettingsAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SHARED_DEFAULTS'; payload: Omit<PrintSettings, 'document_type'> }
  | { type: 'SET_DOCUMENT_SETTINGS'; payload: { documentType: DocumentType; settings: PrintSettings } }
  | { type: 'SET_ALL_SETTINGS'; payload: Partial<Record<DocumentType, PrintSettings>> }
  | { type: 'RESET_TO_DEFAULTS' };

// =====================================================
// Initial State
// =====================================================

const initialState: PrintSettingsState = {
  sharedDefaults: DEFAULT_PRINT_SETTINGS,
  byDocumentType: {},
  isLoading: true,
  lastFetched: null,
};

// =====================================================
// Reducer
// =====================================================

function printSettingsReducer(state: PrintSettingsState, action: PrintSettingsAction): PrintSettingsState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
      
    case 'SET_SHARED_DEFAULTS':
      return { ...state, sharedDefaults: action.payload };
      
    case 'SET_DOCUMENT_SETTINGS':
      return {
        ...state,
        byDocumentType: {
          ...state.byDocumentType,
          [action.payload.documentType]: action.payload.settings,
        },
      };
      
    case 'SET_ALL_SETTINGS':
      return {
        ...state,
        byDocumentType: action.payload,
        lastFetched: Date.now(),
      };
      
    case 'RESET_TO_DEFAULTS':
      return {
        ...initialState,
        isLoading: false,
      };
      
    default:
      return state;
  }
}

// =====================================================
// Context
// =====================================================

interface PrintSettingsContextValue {
  state: PrintSettingsState;
  dispatch: React.Dispatch<PrintSettingsAction>;
  selectPrintSettingsByType: (documentType: DocumentType) => PrintSettings;
  fetchSettings: () => Promise<void>;
  saveSettings: (documentType: DocumentType, settings: Partial<PrintSettings>) => Promise<boolean>;
  saveSharedDefaults: (settings: Omit<PrintSettings, 'document_type'>) => Promise<boolean>;
  saveGlobalToAll: (globalFields: Partial<PrintSettings>) => Promise<boolean>;
}

const PrintSettingsContext = createContext<PrintSettingsContextValue | null>(null);

// =====================================================
// Provider Component
// =====================================================

interface PrintSettingsProviderProps {
  children: ReactNode;
}

export function PrintSettingsProvider({ children }: PrintSettingsProviderProps) {
  const [state, dispatch] = useReducer(printSettingsReducer, initialState);

  // ==========================================
  // Selector: الحصول على إعدادات نوع مستند
  // ==========================================
  const selectPrintSettingsByType = useCallback((documentType: DocumentType): PrintSettings => {
    const documentSettings = state.byDocumentType[documentType];
    
    if (documentSettings) {
      // ✅ دمج الإعدادات المشتركة مع إعدادات المستند - القيم الفارغة تستخدم المشتركة
      return {
        ...documentSettings,
        company_name: documentSettings.company_name || state.sharedDefaults.company_name || '',
        company_subtitle: documentSettings.company_subtitle || state.sharedDefaults.company_subtitle || '',
        company_address: documentSettings.company_address || state.sharedDefaults.company_address || '',
        company_phone: documentSettings.company_phone || state.sharedDefaults.company_phone || '',
        logo_path: documentSettings.logo_path || state.sharedDefaults.logo_path || '/logofaresgold.svg',
        logo_size: documentSettings.logo_size || state.sharedDefaults.logo_size || 60,
        footer_text: documentSettings.footer_text || state.sharedDefaults.footer_text || '',
      };
    }
    
    // إذا لم توجد إعدادات خاصة، استخدم الافتراضي
    return {
      document_type: documentType,
      ...state.sharedDefaults,
    };
  }, [state.byDocumentType, state.sharedDefaults]);

  // ==========================================
  // جلب الإعدادات من Supabase
  // ==========================================
  const fetchSettings = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      // محاولة جلب الإعدادات من الجدول الجديد أولاً
      const { data: newSettings, error: newError } = await supabase
        .from('print_settings')
        .select('*');
      
      if (!newError && newSettings && newSettings.length > 0) {
        // استخدام الإعدادات من الجدول الجديد
        const convertedSettings: Partial<Record<DocumentType, PrintSettings>> = {};
        
        newSettings.forEach((row: any) => {
          const docType = row.document_type as DocumentType;
          convertedSettings[docType] = {
            document_type: docType,
            company_name: row.company_name ?? '',
            company_subtitle: row.company_subtitle ?? '',
            company_address: row.company_address ?? '',
            company_phone: row.company_phone ?? '',
            direction: (row.direction ?? 'rtl') as DirectionType,
            header_alignment: (row.header_alignment ?? 'split') as HeaderAlignmentType,
            header_direction: (row.header_direction ?? 'row') as HeaderDirectionType,
            header_swap: row.header_swap ?? false,
            logo_position_order: row.logo_position_order ?? 0,
            footer_alignment: (row.footer_alignment ?? 'center') as AlignmentType,
            primary_color: row.primary_color ?? '#D4AF37',
            secondary_color: row.secondary_color ?? '#1a1a2e',
            accent_color: row.accent_color ?? '#f0e6d2',
            header_bg_color: row.header_bg_color ?? '#D4AF37',
            header_text_color: row.header_text_color ?? '#ffffff',
            font_family: row.font_family ?? 'Doran',
            title_font_size: row.title_font_size ?? 24,
            header_font_size: row.header_font_size ?? 14,
            body_font_size: row.body_font_size ?? 12,
            // ✅ أحجام عناوين الفاتورة
            invoice_title_ar_font_size: row.invoice_title_ar_font_size ?? 18,
            invoice_title_en_font_size: row.invoice_title_en_font_size ?? 22,
            customer_name_font_size: row.customer_name_font_size ?? 20,
            stat_value_font_size: row.stat_value_font_size ?? 28,
            show_logo: row.show_logo ?? true,
            logo_path: row.logo_path ?? '/logofaresgold.svg',
            logo_size: row.logo_size ?? 60,
            logo_position: (row.logo_position ?? 'right') as AlignmentType,
            show_footer: row.show_footer ?? true,
            footer_text: row.footer_text ?? 'شكراً لتعاملكم معنا',
            show_page_number: row.show_page_number ?? true,
            background_image: row.background_image ?? '',
            background_opacity: row.background_opacity ?? 100,
            page_margin_top: row.page_margin_top ?? 15,
            page_margin_bottom: row.page_margin_bottom ?? 15,
            page_margin_left: row.page_margin_left ?? 15,
            page_margin_right: row.page_margin_right ?? 15,
            // الحقول الجديدة
            document_title_ar: row.document_title_ar ?? '',
            document_title_en: row.document_title_en ?? '',
            show_document_number: row.show_document_number ?? true,
            show_document_date: row.show_document_date ?? true,
            show_hijri_date: row.show_hijri_date ?? false,
            date_format: row.date_format ?? 'ar-LY',
            show_customer_section: row.show_customer_section ?? true,
            customer_section_title: row.customer_section_title ?? 'بيانات العميل',
            customer_section_bg_color: row.customer_section_bg_color ?? '#f8f9fa',
            customer_section_border_color: row.customer_section_border_color ?? '#D4AF37',
            table_header_bg_color: row.table_header_bg_color ?? '#D4AF37',
            table_header_text_color: row.table_header_text_color ?? '#ffffff',
            table_border_color: row.table_border_color ?? '#e5e5e5',
            table_row_even_color: row.table_row_even_color ?? '#f8f9fa',
            table_row_odd_color: row.table_row_odd_color ?? '#ffffff',
            summary_bg_color: row.summary_bg_color ?? '#f0e6d2',
            summary_text_color: (row as any).summary_text_color ?? '#ffffff',
            summary_border_color: row.summary_border_color ?? '#D4AF37',
            border_radius: row.border_radius ?? 8,
            border_width: row.border_width ?? 1,
            // ✅ الحقول الجديدة للتصميم
            header_style: row.header_style ?? 'classic',
            logo_size_preset: row.logo_size_preset ?? 'medium',
            company_tax_id: row.company_tax_id ?? '',
            company_email: row.company_email ?? '',
            company_website: row.company_website ?? '',
            // ✅ ألوان جديدة دقيقة
            company_subtitle_color: row.company_subtitle_color ?? '#666666',
            customer_text_color: row.customer_text_color ?? '#333333',
            table_text_color: row.table_text_color ?? '#000000',
            footer_text_color: row.footer_text_color ?? '#666666',
            // ✅ مسافات جديدة
            header_margin_bottom: row.header_margin_bottom ?? 20,
            document_title_margin_top: row.document_title_margin_top ?? 10,
            document_title_alignment: (row.document_title_alignment ?? 'center') as AlignmentType,
            // ✅ خيارات إظهار بيانات الشركة
            show_tax_id: row.show_tax_id ?? false,
            show_email: row.show_email ?? false,
            show_website: row.show_website ?? false,
            // ✅ التحكم الدقيق في عناصر معلومات الشركة
            show_company_name: row.show_company_name ?? true,
            show_company_address: row.show_company_address ?? true,
            show_company_contact: row.show_company_contact ?? true,
            show_company_subtitle: row.show_company_subtitle ?? false,
            // ✅ إعدادات قسم معلومات المستند
            document_info_text_color: row.document_info_text_color ?? '#000000',
            document_info_bg_color: row.document_info_bg_color ?? 'transparent',
            document_info_alignment: (row.document_info_alignment ?? 'left') as AlignmentType,
            document_info_margin_top: row.document_info_margin_top ?? 0,
            // ✅ إعدادات صندوق الإجماليات الموحد
            totals_box_bg_color: row.totals_box_bg_color ?? '#f8f9fa',
            totals_box_text_color: row.totals_box_text_color ?? '#333333',
            totals_box_border_color: row.totals_box_border_color ?? '#D4AF37',
            totals_box_border_radius: row.totals_box_border_radius ?? 8,
            totals_title_font_size: row.totals_title_font_size ?? 14,
            totals_value_font_size: row.totals_value_font_size ?? 16,
            // ✅ خصائص الجدول
            table_header_font_size: row.table_header_font_size ?? 10,
            table_header_padding: row.table_header_padding ?? '4px 8px',
            table_body_font_size: row.table_body_font_size ?? 10,
            table_body_padding: row.table_body_padding ?? '4px',
            table_header_font_weight: row.table_header_font_weight ?? 'bold',
            table_line_height: row.table_line_height ?? '1.4',
            table_border_width: row.table_border_width ?? 1,
            table_border_style: row.table_border_style ?? 'solid',
            table_border_radius: row.table_border_radius ?? 0,
            table_header_height: row.table_header_height ?? 0,
            table_body_row_height: row.table_body_row_height ?? 0,
          };
        });
        
        // print_settings is the single source of truth - no legacy fallback
        let invoiceShared: any = null;

        // تحديث الإعدادات المشتركة من أول سجل (مع دمج بيانات الفواتير)
        if (newSettings.length > 0) {
          const first = newSettings[0];
          dispatch({
            type: 'SET_SHARED_DEFAULTS',
            payload: {
              company_name: first.company_name || invoiceShared?.companyName || '',
              company_subtitle: first.company_subtitle || invoiceShared?.companySubtitle || '',
              company_address: first.company_address || invoiceShared?.companyAddress || '',
              company_phone: first.company_phone || invoiceShared?.companyPhone || '',
              direction: (first.direction ?? 'rtl') as DirectionType,
              header_alignment: (first.header_alignment ?? 'split') as HeaderAlignmentType,
              header_direction: ((first as any).header_direction ?? 'row') as HeaderDirectionType,
              header_swap: (first as any).header_swap ?? false,
              logo_position_order: (first as any).logo_position_order ?? 0,
              footer_alignment: (first.footer_alignment ?? 'center') as AlignmentType,
              primary_color: first.primary_color ?? '#D4AF37',
              secondary_color: first.secondary_color ?? '#1a1a2e',
              accent_color: first.accent_color ?? '#f0e6d2',
              header_bg_color: first.header_bg_color ?? '#D4AF37',
              header_text_color: first.header_text_color ?? '#ffffff',
              font_family: first.font_family ?? 'Doran',
              title_font_size: first.title_font_size ?? 24,
              header_font_size: first.header_font_size ?? 14,
              body_font_size: first.body_font_size ?? 12,
              // ✅ أحجام عناوين الفاتورة
              invoice_title_ar_font_size: (first as any).invoice_title_ar_font_size ?? 18,
              invoice_title_en_font_size: (first as any).invoice_title_en_font_size ?? 22,
              customer_name_font_size: (first as any).customer_name_font_size ?? 20,
              stat_value_font_size: (first as any).stat_value_font_size ?? 28,
              show_logo: first.show_logo ?? true,
              logo_path: first.logo_path || invoiceShared?.logoPath || '/logofaresgold.svg',
              logo_size: first.logo_size || invoiceShared?.logoSize || 60,
              logo_position: (first.logo_position || invoiceShared?.logoPosition || 'right') as AlignmentType,
              show_footer: first.show_footer ?? true,
              footer_text: first.footer_text ?? 'شكراً لتعاملكم معنا',
              show_page_number: first.show_page_number ?? true,
              background_image: first.background_image ?? '',
              background_opacity: first.background_opacity ?? 100,
              page_margin_top: first.page_margin_top ?? 15,
              page_margin_bottom: first.page_margin_bottom ?? 15,
              page_margin_left: first.page_margin_left ?? 15,
              page_margin_right: first.page_margin_right ?? 15,
              // الحقول الجديدة
              document_title_ar: first.document_title_ar ?? '',
              document_title_en: first.document_title_en ?? '',
              show_document_number: first.show_document_number ?? true,
              show_document_date: first.show_document_date ?? true,
              show_hijri_date: first.show_hijri_date ?? false,
              date_format: first.date_format ?? 'ar-LY',
              show_customer_section: first.show_customer_section ?? true,
              customer_section_title: first.customer_section_title ?? 'بيانات العميل',
              customer_section_bg_color: first.customer_section_bg_color ?? '#f8f9fa',
              customer_section_border_color: first.customer_section_border_color ?? '#D4AF37',
              table_header_bg_color: first.table_header_bg_color ?? '#D4AF37',
              table_header_text_color: first.table_header_text_color ?? '#ffffff',
              table_border_color: first.table_border_color ?? '#e5e5e5',
              table_row_even_color: first.table_row_even_color ?? '#f8f9fa',
              table_row_odd_color: first.table_row_odd_color ?? '#ffffff',
              summary_bg_color: first.summary_bg_color ?? '#f0e6d2',
              summary_text_color: (first as any).summary_text_color ?? '#ffffff',
              summary_border_color: first.summary_border_color ?? '#D4AF37',
              border_radius: first.border_radius ?? 8,
              border_width: first.border_width ?? 1,
              // ✅ الحقول الجديدة (قد لا تكون موجودة في DB بعد)
              header_style: (first as any).header_style ?? 'classic',
              logo_size_preset: (first as any).logo_size_preset ?? 'medium',
              company_tax_id: (first as any).company_tax_id ?? '',
              company_email: (first as any).company_email ?? '',
              company_website: (first as any).company_website ?? '',
              // ✅ ألوان جديدة دقيقة
              company_subtitle_color: (first as any).company_subtitle_color ?? '#666666',
              customer_text_color: (first as any).customer_text_color ?? '#333333',
              table_text_color: (first as any).table_text_color ?? '#000000',
              footer_text_color: (first as any).footer_text_color ?? '#666666',
              // ✅ مسافات جديدة
              header_margin_bottom: (first as any).header_margin_bottom ?? 20,
              document_title_margin_top: (first as any).document_title_margin_top ?? 10,
              document_title_alignment: ((first as any).document_title_alignment ?? 'center') as AlignmentType,
              // ✅ خيارات إظهار بيانات الشركة
              show_tax_id: (first as any).show_tax_id ?? false,
              show_email: (first as any).show_email ?? false,
              show_website: (first as any).show_website ?? false,
              // ✅ التحكم الدقيق في عناصر معلومات الشركة
              show_company_name: (first as any).show_company_name ?? true,
              show_company_address: (first as any).show_company_address ?? true,
              show_company_contact: (first as any).show_company_contact ?? true,
              show_company_subtitle: (first as any).show_company_subtitle ?? false,
              // ✅ إعدادات قسم معلومات المستند
              document_info_text_color: (first as any).document_info_text_color ?? '#000000',
              document_info_bg_color: (first as any).document_info_bg_color ?? 'transparent',
              document_info_alignment: ((first as any).document_info_alignment ?? 'left') as AlignmentType,
              document_info_margin_top: (first as any).document_info_margin_top ?? 0,
              // ✅ إعدادات صندوق الإجماليات الموحد
              totals_box_bg_color: (first as any).totals_box_bg_color ?? '#f8f9fa',
              totals_box_text_color: (first as any).totals_box_text_color ?? '#333333',
              totals_box_border_color: (first as any).totals_box_border_color ?? '#D4AF37',
              totals_box_border_radius: (first as any).totals_box_border_radius ?? 8,
              totals_title_font_size: (first as any).totals_title_font_size ?? 14,
              totals_value_font_size: (first as any).totals_value_font_size ?? 16,
              // ✅ خصائص الجدول
              table_header_font_size: (first as any).table_header_font_size ?? 10,
              table_header_padding: (first as any).table_header_padding ?? '4px 8px',
              table_body_font_size: (first as any).table_body_font_size ?? 10,
              table_body_padding: (first as any).table_body_padding ?? '4px',
              table_header_font_weight: (first as any).table_header_font_weight ?? 'bold',
              table_line_height: (first as any).table_line_height ?? '1.4',
              table_border_width: (first as any).table_border_width ?? 1,
              table_border_style: (first as any).table_border_style ?? 'solid',
              table_border_radius: (first as any).table_border_radius ?? 0,
              table_header_height: (first as any).table_header_height ?? 0,
              table_body_row_height: (first as any).table_body_row_height ?? 0,
            },
          });
        }
        
        dispatch({ type: 'SET_ALL_SETTINGS', payload: convertedSettings });
      }
    } catch (error) {
      console.log('No saved print settings found, using defaults');
    }
    
    dispatch({ type: 'SET_LOADING', payload: false });
  }, []);

  // ==========================================
  // حفظ إعدادات نوع مستند معين
  // ==========================================
  const saveSettings = useCallback(async (documentType: DocumentType, settings: Partial<PrintSettings>): Promise<boolean> => {
    try {
      const fullSettings: PrintSettings = {
        document_type: documentType,
        ...state.sharedDefaults,
        ...state.byDocumentType[documentType],
        ...settings,
      };
      
      dispatch({
        type: 'SET_DOCUMENT_SETTINGS',
        payload: { documentType, settings: fullSettings },
      });
      
      // حفظ في جدول print_settings - جميع الحقول ديناميكياً
      // نأخذ كل الحقول من fullSettings ونزيل الحقول غير الموجودة في الجدول
      const { created_at: _ca, updated_at: _ua, ...dbFields } = fullSettings as any;
      
      const { error } = await supabase
        .from('print_settings')
        .upsert(dbFields, { onConflict: 'document_type' });
      
      if (error) throw error;
      
      // مسح كاش الجسر
      try {
        const { clearPrintSettingsBridgeCache } = await import('@/utils/invoicePrintSettingsBridge');
        clearPrintSettingsBridgeCache();
      } catch { /* ignore */ }
      
      return true;
    } catch (error) {
      console.error('Failed to save settings:', error);
      return false;
    }
  }, [state]);

  // ==========================================
  // حفظ الإعدادات الافتراضية المشتركة (تطبيق على جميع المستندات)
  // ==========================================
  const saveSharedDefaults = useCallback(async (settings: Omit<PrintSettings, 'document_type'>): Promise<boolean> => {
    try {
      dispatch({ type: 'SET_SHARED_DEFAULTS', payload: settings });
      
      // تحديث جميع السجلات في جدول print_settings ديناميكياً
      const allTypes = Object.values(DOCUMENT_TYPES);
      const { created_at: _ca, updated_at: _ua, document_type: _dt, ...cleanSettings } = settings as any;
      
      for (const docType of allTypes) {
        await supabase
          .from('print_settings')
          .upsert({
            document_type: docType,
            ...cleanSettings,
          }, { onConflict: 'document_type' });
      }
      
      return true;
    } catch (error) {
      console.error('Failed to save shared defaults:', error);
      return false;
    }
  }, []);

  // ==========================================
  // حفظ الإعدادات العامة على جميع المستندات دفعة واحدة
  // ==========================================
  const saveGlobalToAll = useCallback(async (globalFields: Partial<PrintSettings>): Promise<boolean> => {
    try {
      // Remove per-document-only fields
      const { document_type: _dt, document_title_ar: _ta, document_title_en: _te, customer_section_title: _ct, ...fieldsToApply } = globalFields as any;
      
      const allTypes = Object.values(DOCUMENT_TYPES);
      
      // Update local state for all types
      for (const docType of allTypes) {
        const existing = state.byDocumentType[docType] || { document_type: docType, ...state.sharedDefaults };
        const merged = { ...existing, ...fieldsToApply, document_type: docType };
        dispatch({
          type: 'SET_DOCUMENT_SETTINGS',
          payload: { documentType: docType, settings: merged as PrintSettings },
        });
      }
      
      // Update shared defaults
      dispatch({ type: 'SET_SHARED_DEFAULTS', payload: { ...state.sharedDefaults, ...fieldsToApply } });
      
      // Batch upsert to DB
      const upsertPromises = allTypes.map(docType => {
        const existing = state.byDocumentType[docType];
        const merged = { ...state.sharedDefaults, ...existing, ...fieldsToApply, document_type: docType };
        // ✅ إرسال جميع الحقول ديناميكياً بدلاً من القائمة اليدوية
        const { created_at: _ca2, updated_at: _ua2, ...dbFields } = merged as any;
        return supabase
          .from('print_settings')
          .upsert(dbFields, { onConflict: 'document_type' });
      });
      
      await Promise.all(upsertPromises);
      
      // Clear caches
      try {
        const { clearPrintSettingsBridgeCache } = await import('@/utils/invoicePrintSettingsBridge');
        clearPrintSettingsBridgeCache();
      } catch { /* ignore */ }
      try {
        const { clearInvoiceSettingsCache } = await import('@/hooks/useInvoiceSettingsSync');
        clearInvoiceSettingsCache();
      } catch { /* ignore */ }
      
      return true;
    } catch (error) {
      console.error('Failed to save global settings:', error);
      return false;
    }
  }, [state]);

  // ==========================================
  // جلب الإعدادات عند التحميل
  // ==========================================
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const value: PrintSettingsContextValue = {
    state,
    dispatch,
    selectPrintSettingsByType,
    fetchSettings,
    saveSettings,
    saveSharedDefaults,
    saveGlobalToAll,
  };

  return React.createElement(PrintSettingsContext.Provider, { value }, children);
}

// =====================================================
// Hook للاستخدام
// =====================================================

export function usePrintSettings() {
  const context = useContext(PrintSettingsContext);
  if (!context) {
    throw new Error('usePrintSettings must be used within a PrintSettingsProvider');
  }
  return context;
}

// =====================================================
// Selector Hook
// =====================================================

export function usePrintSettingsByType(documentType: DocumentType) {
  const { selectPrintSettingsByType, state } = usePrintSettings();
  return {
    settings: selectPrintSettingsByType(documentType),
    isLoading: state.isLoading,
  };
}
