import { REFERENCE_INVOICE_STYLE } from '@/lib/officialInvoiceTemplate';
import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import { buildPrintTemplatePreview } from '@/lib/printTemplatePreview';
import { DOCUMENT_TYPES, DOCUMENT_TYPE_INFO } from '@/types/document-types';
import { DEFAULT_PRINT_SETTINGS } from '@/types/print-settings';

const databaseRead = vi.hoisted(() => vi.fn(() => { throw new Error('Preview must not read production data'); }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: databaseRead } }));
vi.mock('@/lib/printLogo', () => ({ loadPrintLogo: async () => '/logofares.svg' }));

describe('real print template previews', () => {
  it.each(Object.values(DOCUMENT_TYPES))('renders body content for %s with unsaved settings', async type => {
    const html = await buildPrintTemplatePreview({ ...DEFAULT_PRINT_SETTINGS, ...REFERENCE_INVOICE_STYLE, document_title_ar: DOCUMENT_TYPE_INFO[type].nameAr, table_header_bg_color: '#123456', primary_color: '#123456' }, type);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.body.textContent?.trim().length).toBeGreaterThan(150);
    expect(doc.querySelector('table, .items-grid, .amount-section')).not.toBeNull();
    expect(html).toContain('#123456');
    expect(html).toContain('Shared interior: restrained sections');
    expect(html).toContain('.u-invoice-details > div { display: block !important;');
    expect(html).toContain('white-space: nowrap; overflow-wrap: normal;');
    expect(html).not.toContain('window.print()');
    expect(html).not.toContain('LIVE');
    expect(databaseRead).not.toHaveBeenCalled();
    expect(doc.body.textContent).not.toContain('undefined');
    expect(doc.body.textContent).not.toContain('NaN');
    if (process.env.INVOICE_DESIGN_PREVIEW_DIR) {
      mkdirSync(process.env.INVOICE_DESIGN_PREVIEW_DIR, { recursive: true });
      const local = html.split('src="/').join('src="file:///E:/adhub-pro-main%20(4)/adhub-pro-main/public/').split('#123456').join('#262626').split('http://localhost:3000/').join('file:///E:/adhub-pro-main%20(4)/adhub-pro-main/public/').split("url('/").join("url('file:///E:/adhub-pro-main%20(4)/adhub-pro-main/public/");
      writeFileSync(process.env.INVOICE_DESIGN_PREVIEW_DIR + '/' + type + '.html', local);
    }
  });
});

it('uses a real operational table while preserving item images and costs', async () => {
  const { renderOperationalTaskTable } = await import('@/lib/unifiedInvoiceBody');
  const html = renderOperationalTaskTable([{ billboard_name: 'لوحة اختبار', quantity: 2, unit_cost: 300, total_cost: 600, cutout_image_url: 'https://example.com/cut.png', design_face_a: 'https://example.com/design.png' }], 'cut');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  expect(doc.querySelectorAll('tbody tr')).toHaveLength(1);
  expect(doc.querySelectorAll('img')).toHaveLength(2);
  expect(doc.body.textContent).toContain('600');
  expect(doc.body.textContent).toContain('لوحة اختبار');
});
