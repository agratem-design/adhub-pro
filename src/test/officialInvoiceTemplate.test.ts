import { describe, expect, it, vi, beforeEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import { applyOfficialInvoiceTemplate, REFERENCE_INVOICE_STYLE } from '@/lib/officialInvoiceTemplate';
import { DEFAULT_PRINT_SETTINGS } from '@/types/print-settings';
import { DOCUMENT_TYPES } from '@/types/document-types';

const { settingsRows } = vi.hoisted(() => ({ settingsRows: [] as any[] }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({ select: () => ({ in: async () => ({ data: settingsRows, error: null }) }) }) },
}));
import { fetchPrintSettingsForInvoice, clearPrintSettingsBridgeCache, mapPrintSettingsToInvoiceStyles } from '@/utils/invoicePrintSettingsBridge';
import { generateHeaderHTML, generateBaseCSS, generateFooterHTML, resolveInvoiceStyles, unifiedHeaderHtml, unifiedHeaderFooterCss } from '@/lib/unifiedInvoiceBase';
import { createMeasurementsConfigFromSettings } from '@/lib/printMeasurementsConfig';
import { generateMeasurementsHTML } from '@/lib/printMeasurementsHTML';

const official = {
  ...DEFAULT_PRINT_SETTINGS, ...REFERENCE_INVOICE_STYLE, document_type: DOCUMENT_TYPES.PAYMENT_RECEIPT,
  company_name: 'الفارس الذهبي للدعاية والإعلان', company_phone: '091 000 0000',
  show_company_name: false, header_bg_color: '#fffdf8', header_text_color: '#000000',
  primary_color: '#000000', logo_size: 86, invoice_title_ar_font_size: 22,
  invoice_title_en_font_size: 12, footer_text: 'شكراً لتعاملكم معنا',
  document_title_ar: 'إيصال استلام',
};

describe('official reference invoice stationery', () => {
  it('uses the explicit shared header position over stale logo placement', () => {
    expect(mapPrintSettingsToInvoiceStyles({ header_swap: false, logo_position: 'left' }).headerSwap).toBe(false);
    expect(mapPrintSettingsToInvoiceStyles({ header_swap: true, logo_position: 'right' }).headerSwap).toBe(true);
  });
  beforeEach(() => { settingsRows.splice(0); clearPrintSettingsBridgeCache(); });

  it('inherits stationery while keeping the invoice title and explicit hidden or empty values', () => {
    const result = applyOfficialInvoiceTemplate({ document_type: DOCUMENT_TYPES.SALES_INVOICE, document_title_ar: 'فاتورة مبيعات', company_name: 'قديم' }, { ...official, show_footer: false, footer_text: '', header_margin_bottom: 0 });
    expect(result.document_title_ar).toBe('فاتورة مبيعات');
    expect(result.company_name).toBe(official.company_name);
    expect(result.show_footer).toBe(false);
    expect(result.footer_text).toBe('');
    expect(result.header_margin_bottom).toBe(0);
  });

  it('loads the official template for existing and newly introduced invoice settings', async () => {
    settingsRows.push(official, { document_type: DOCUMENT_TYPES.SALES_INVOICE, document_title_ar: 'فاتورة مبيعات', logo_size: 20 });
    for (const type of ['sales_invoice', 'purchase_invoice', 'contract', 'print_invoice', 'receipt', 'composite_task'] as const) {
      const result = await fetchPrintSettingsForInvoice(type);
      expect(result?.logoSize).toBe(86);
      expect(result?.companyName).toBe(official.company_name);
    }
    expect((await fetchPrintSettingsForInvoice('sales_invoice'))?.invoiceTitle).toBe('فاتورة مبيعات');
  });

  it('uses the same header and footer renderer in base invoices and measurements previews', async () => {
    settingsRows.push(official);
    const styles = await resolveInvoiceStyles('sales_invoice', { titleAr: 'فاتورة مبيعات', titleEn: 'SALES INVOICE' });
    const header = generateHeaderHTML(styles, '<div>INV-1024</div>');
    expect(header).toContain('u-header');
    expect(header).toContain('INV-1024');
    expect(header).toContain('فاتورة مبيعات');
    expect(generateBaseCSS(styles)).toContain('.u-header');
    expect(generateFooterHTML(styles)).toContain('u-footer');

    const config = createMeasurementsConfigFromSettings(official);
    const html = generateMeasurementsHTML({ config,
      documentData: { title: 'فاتورة طباعة وتركيب', documentNumber: 'INV-1024', date: '12/09/2026' },
      partyData: { title: 'بيانات العميل', name: 'شركة النور للدعاية', phone: '091 123 4567' },
      columns: [{ key: 'description', header: 'البيان' }, { key: 'amount', header: 'القيمة', align: 'center' }],
      rows: [{ description: 'طباعة وتركيب لوحات إعلانية — عقد #1244', amount: '2,500 د.ل' }, { description: 'قص وتجهيز مجسمات', amount: '750 د.ل' }],
      totals: [{ label: 'الإجمالي', value: '3,250 د.ل' }],
    });
    expect(html).toContain('u-header');
    expect(html).toContain('u-footer');
    expect(html).toContain('INV-1024');
    if (process.env.PRINT_PREVIEW_PATH) writeFileSync(process.env.PRINT_PREVIEW_PATH, html);
  });

  it('honors size and page numbering controls and retains references in compact headers', () => {
    const css = unifiedHeaderFooterCss({ logoSize: 120, invoiceTitleArFontSize: 26, invoiceTitleEnFontSize: 13, showPageNumber: false });
    expect(css).toContain('height: 120px');
    expect(css).toContain('font-size: 26px');
    expect(css).toContain('font-size: 13px');
    expect(css).toContain('content: none');
    for (const headerStyle of ['classic', 'modern', 'centered', 'simple', 'minimal']) {
      expect(unifiedHeaderHtml({ styles: { headerStyle }, fullLogoUrl: '', titleAr: 'فاتورة', metaLinesHtml: 'INV-42' })).toContain('INV-42');
    }
  });
});
