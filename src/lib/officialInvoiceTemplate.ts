import { DOCUMENT_TYPES } from '@/types/document-types';
import { DEFAULT_PRINT_SETTINGS, type PrintSettings } from '@/types/print-settings';

export const OFFICIAL_INVOICE_TEMPLATE = DOCUMENT_TYPES.PAYMENT_RECEIPT;

// The approved receipt is the source of the shared invoice stationery.
export const REFERENCE_INVOICE_STYLE: Partial<PrintSettings> = {
  primary_color: '#000000', secondary_color: '#333333', accent_color: '#f0f0f0',
  header_bg_color: '#fffdf8', header_text_color: '#000000', header_style: 'classic',
  header_swap: false, header_margin_bottom: 20,
  logo_path: '/logofares.svg', logo_size: 86, show_logo: true,
  show_company_name: false, show_company_subtitle: false,
  show_company_address: false, show_company_contact: false,
  font_family: 'Doran', body_font_size: 12,
  invoice_title_ar_font_size: 22, invoice_title_en_font_size: 12,
  customer_text_color: '#000000', customer_section_bg_color: '#ffffff',
  customer_section_border_color: '#000000',
  table_header_bg_color: '#000000', table_header_text_color: '#ffffff',
  table_border_color: '#e5e5e5', table_row_even_color: '#f0f0f0', table_row_odd_color: '#ffffff',
  table_text_color: '#000000', table_body_font_size: 11, table_header_font_size: 12,
  summary_bg_color: '#000000', summary_text_color: '#ffffff', summary_border_color: '#000000',
  totals_box_bg_color: '#ffffff', totals_box_text_color: '#000000', totals_box_border_color: '#e5e5e5',
  footer_text: 'شكراً لتعاملكم معنا', footer_text_color: '#666666', footer_alignment: 'center',
  show_footer: true, show_page_number: true,
  page_margin_top: 15, page_margin_bottom: 15, page_margin_left: 15, page_margin_right: 15,
};
export const OFFICIAL_TEMPLATE_FIELDS = Object.keys(DEFAULT_PRINT_SETTINGS).filter(key =>
  /^(company_|show_company_|header_|footer_|logo_|page_margin_|invoice_title_|table_|summary_|totals_box_|customer_section_(bg|border)_)/.test(key) ||
  ['show_logo', 'show_footer', 'show_page_number', 'show_tax_id', 'show_email', 'show_website',
    'font_family', 'title_font_size', 'header_font_size', 'body_font_size',
    'primary_color', 'secondary_color', 'accent_color', 'customer_text_color', 'background_image', 'background_opacity',
    'background_pos_x', 'background_pos_y', 'background_scale', 'content_bottom_spacing'].includes(key)
) as (keyof PrintSettings)[];

export function officialTemplateFields(settings: Partial<PrintSettings>): Partial<PrintSettings> {
  return Object.fromEntries(OFFICIAL_TEMPLATE_FIELDS
    .filter(key => settings[key] !== undefined && settings[key] !== null)
    .map(key => [key, settings[key]]));
}

export function applyOfficialInvoiceTemplate(
  document: Partial<PrintSettings>, official?: Partial<PrintSettings> | null,
): PrintSettings {
  const shared = officialTemplateFields(official || {});
  // Older receipt settings used black as the header sentinel; the approved print rendered ivory.
  if (shared.header_bg_color && /^#0{3,6}$/i.test(shared.header_bg_color)) shared.header_bg_color = '#fffdf8';
  return {
    ...DEFAULT_PRINT_SETTINGS,
    ...document,
    ...officialTemplateFields(REFERENCE_INVOICE_STYLE),
    ...shared,
    document_type: document.document_type || OFFICIAL_INVOICE_TEMPLATE,
  };
}
