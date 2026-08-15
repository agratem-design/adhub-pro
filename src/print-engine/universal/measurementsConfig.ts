/**
 * Measurements Style Configuration
 * تكوين نمط المقاسات - يقرأ من الإعدادات المحفوظة
 */

import { PrintConfig, createDefaultPrintConfig } from './types';
import { PrintSettings, DEFAULT_PRINT_SETTINGS } from '@/types/print-settings';

export interface MeasurementsThemeSettings {
  primaryColor?: string;
  secondaryColor?: string;
  tableBorderColor?: string;
}

/**
 * Create measurements config from PrintSettings (stored in DB)
 * يحول إعدادات print_settings إلى PrintConfig
 */
export const createMeasurementsConfigFromSettings = (settings: Partial<PrintSettings>): PrintConfig => {
  const config = createDefaultPrintConfig();

  // Colors from saved settings
  const primaryColor = settings.primary_color || '#000000';
  const secondaryColor = settings.secondary_color || '#333333';
  const borderColor = settings.table_border_color || '#000000';
  const fontFamily = settings.font_family || 'Doran';
  const logoPath = settings.logo_path || '/logofaresgold.svg';
  const logoSize = settings.logo_size || 101;
  const footerText = settings.footer_text || '';
  const showFooter = settings.show_footer !== false;
  const showLogo = settings.show_logo !== false;
  const showPageNumber = settings.show_page_number !== false;

  // Page settings
  config.page.direction = settings.direction || 'rtl';
  config.page.width = '210mm';
  config.page.minHeight = '297mm';
  config.page.padding = {
    top: `${settings.page_margin_top ?? 10}mm`,
    right: `${settings.page_margin_right ?? 10}mm`,
    bottom: `${settings.page_margin_bottom ?? 10}mm`,
    left: `${settings.page_margin_left ?? 10}mm`,
  };
  config.page.backgroundColor = '#ffffff';
  config.page.fontFamily = `${fontFamily}, 'Noto Sans Arabic', Cairo, Tajawal, sans-serif`;
  config.page.fontSize = `${settings.body_font_size || 10}px`;
  config.page.lineHeight = '1.4';

  // Header
  config.header.enabled = true;
  config.header.height = '150px';
  config.header.backgroundColor = 'transparent';
  config.header.padding = '0';
  config.header.marginBottom = `${settings.header_margin_bottom ?? 12}px`;
  config.header.borderBottom = `2px solid ${primaryColor}`;

  // Logo
  config.header.logo.enabled = showLogo;
  config.header.logo.url = logoPath;
  config.header.logo.width = 'auto';
  config.header.logo.height = `${logoSize}px`;
  config.header.logo.positionX = '0';
  config.header.logo.positionY = '50%';
  config.header.logo.objectFit = 'contain';

  // Title
  config.header.title.enabled = true;
  config.header.title.text = settings.document_title_ar || 'كشف حساب';
  config.header.title.fontSize = `${settings.title_font_size || 22}px`;
  config.header.title.fontWeight = 'bold';
  config.header.title.color = primaryColor;
  config.header.title.alignment = 'left';
  config.header.title.positionX = '0';
  config.header.title.positionY = '50%';

  // Subtitle
  config.header.subtitle.enabled = false;

  // Document Info
  config.header.documentInfo.enabled = true;
  config.header.documentInfo.alignment = 'left';
  config.header.documentInfo.fontSize = '10px';
  config.header.documentInfo.color = secondaryColor;

  // Company Info
  const hasCompanyInfo = !!(settings.company_name || settings.company_address || settings.company_phone);
  config.companyInfo.enabled = hasCompanyInfo && (settings.show_company_name !== false);
  config.companyInfo.name = settings.company_name || '';
  config.companyInfo.subtitle = settings.company_subtitle || '';
  config.companyInfo.address = settings.company_address || '';
  config.companyInfo.phone = settings.company_phone || '';
  config.companyInfo.fontSize = '10px';
  config.companyInfo.color = secondaryColor;

  // Party Info (Customer)
  config.partyInfo.enabled = settings.show_customer_section !== false;
  config.partyInfo.backgroundColor = settings.customer_section_bg_color || '#f5f5f5';
  config.partyInfo.borderColor = settings.customer_section_border_color || secondaryColor;
  config.partyInfo.borderRadius = `${settings.border_radius ?? 8}px`;
  config.partyInfo.padding = '12px';
  config.partyInfo.marginBottom = '15px';
  config.partyInfo.titleFontSize = '11px';
  config.partyInfo.titleColor = primaryColor;
  config.partyInfo.contentFontSize = '10px';
  config.partyInfo.contentColor = secondaryColor;

  // Table
  config.table.width = '100%';
  config.table.borderCollapse = 'collapse';
  config.table.borderSpacing = '0';
  config.table.marginBottom = '0';

  config.table.border.width = `${settings.table_border_width ?? settings.border_width ?? 1}px`;
  config.table.border.style = (settings.table_border_style || 'solid') as 'solid' | 'dashed' | 'dotted' | 'none';
  config.table.border.color = borderColor;

  config.table.header.backgroundColor = settings.table_header_bg_color || '#f0f0f0';
  config.table.header.textColor = settings.table_header_text_color || '#000000';
  config.table.header.fontSize = `${settings.table_header_font_size || 10}px`;
  config.table.header.fontWeight = settings.table_header_font_weight || 'bold';
  config.table.header.padding = settings.table_header_padding || '4px 8px';
  config.table.header.borderColor = borderColor;
  config.table.header.textAlign = 'center';

  config.table.body.fontSize = `${settings.table_body_font_size || 10}px`;
  config.table.body.padding = settings.table_body_padding || '4px';
  config.table.body.borderColor = borderColor;
  config.table.body.oddRowBackground = settings.table_row_odd_color || '#ffffff';
  config.table.body.evenRowBackground = settings.table_row_even_color || '#f5f5f5';
  config.table.body.textColor = settings.table_text_color || '#000000';
  
  // Line height for table
  (config.table as any).lineHeight = settings.table_line_height || '1.4';
  (config.table as any).headerHeight = settings.table_header_height || 0;
  (config.table as any).bodyRowHeight = settings.table_body_row_height || 0;

  // Totals
  config.totals.enabled = true;
  config.totals.backgroundColor = settings.summary_bg_color || '#1a1a1a';
  config.totals.textColor = settings.summary_text_color || settings.table_header_text_color || '#ffffff';
  config.totals.borderColor = settings.summary_border_color || borderColor;
  config.totals.borderRadius = '0';
  config.totals.padding = '6px 4px';
  config.totals.titleFontSize = `${settings.totals_title_font_size || 11}px`;
  config.totals.titleFontWeight = 'bold';
  config.totals.valueFontSize = `${settings.totals_value_font_size || 11}px`;
  config.totals.valueFontWeight = 'bold';
  config.totals.alignment = 'center';

  // Footer
  config.footer.enabled = showFooter;
  config.footer.text = footerText;
  config.footer.fontSize = '9px';
  config.footer.color = settings.footer_text_color || '#666666';
  config.footer.alignment = (settings.footer_alignment as any) || 'center';
  config.footer.borderTop = `1px solid ${borderColor}`;
  config.footer.padding = '8px 0';
  config.footer.marginTop = '12px';
  config.footer.showPageNumber = showPageNumber;
  config.footer.pageNumberFormat = 'صفحة {page}';

  // Notes
  config.notes.enabled = true;
  config.notes.title = 'ملاحظات';
  config.notes.fontSize = '9px';
  config.notes.color = '#333333';
  config.notes.backgroundColor = '#f5f5f5';
  config.notes.borderColor = '#cccccc';
  config.notes.padding = '8px';
  config.notes.marginTop = '10px';

  return config;
};

/**
 * Legacy: Create hardcoded measurements config (fallback)
 */
export const createMeasurementsConfig = (settings: MeasurementsThemeSettings = {}): PrintConfig => {
  return createMeasurementsConfigFromSettings({
    primary_color: '#000000',
    secondary_color: '#333333',
    table_border_color: '#000000',
    table_header_bg_color: '#f0f0f0',
    table_header_text_color: '#000000',
    summary_bg_color: '#1a1a1a',
    logo_path: '/logofaresgold.svg',
    logo_size: 101,
    font_family: 'Doran',
  });
};

/**
 * Map PrintSettings (from print_settings table) to PrintConfig
 * NOW USES SAVED SETTINGS instead of ignoring them
 */
export const mapPrintThemeToMeasurementsConfig = (settings: any): PrintConfig => {
  // If it's a full PrintSettings object, use it directly
  if (settings && (settings.primary_color || settings.logo_path || settings.font_family)) {
    return createMeasurementsConfigFromSettings(settings);
  }
  // Fallback to hardcoded defaults
  return createMeasurementsConfig();
};

export default createMeasurementsConfig;
