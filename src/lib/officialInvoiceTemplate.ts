import { DOCUMENT_TYPES } from '@/types/document-types';
import { DEFAULT_PRINT_SETTINGS, type PrintSettings } from '@/types/print-settings';

export const OFFICIAL_INVOICE_TEMPLATE = DOCUMENT_TYPES.COMBINED_TASK;

// The combined invoice owns the shared stationery. Document titles and contents stay local.
export const OFFICIAL_TEMPLATE_FIELDS = Object.keys(DEFAULT_PRINT_SETTINGS).filter(key =>
  /^(company_|show_company_|header_|footer_|logo_|page_margin_|invoice_title_)/.test(key) ||
  ['show_logo', 'show_footer', 'show_page_number', 'show_tax_id', 'show_email', 'show_website',
    'font_family', 'title_font_size', 'header_font_size', 'body_font_size',
    'primary_color', 'secondary_color', 'background_image', 'background_opacity',
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
  return {
    ...DEFAULT_PRINT_SETTINGS,
    ...document,
    ...officialTemplateFields(official || {}),
    document_type: document.document_type || OFFICIAL_INVOICE_TEMPLATE,
  };
}
