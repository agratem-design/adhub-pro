import { describe, it, expect } from 'vitest';
import { buildPrintSizeCatalog, escapePrintText } from '@/utils/printSizeCatalog';

describe('print size catalog', () => {
  it('uses saved production dimensions and marks absent dimensions without guessing', () => {
    const html = buildPrintSizeCatalog([{ name: '4x3', print_size: '4.20 × 3.20' }, { name: '6x3' }], 'http://localhost');
    expect(html).toContain('4.20 × 3.20');
    expect(html).toContain('غير محدد');
    expect(html.match(/class="size-card catalog-card"/g)).toHaveLength(2);
    expect(html).toContain('pricing-knight-watermark.svg');
  });

  it('fits normal catalog sizes (up to 18) on one single page strictly without extra text and without numbering', () => {
    const sampleSizes = [
      { name: '13x5', print_size: '13.20 × 4.70', sort_order: 1 },
      { name: '12x4', print_size: '12.10 × 4.10', sort_order: 2 },
      { name: '10x4', print_size: '10.10 × 4.10', sort_order: 3 },
      { name: '8X3-T', print_size: '8.10 × 3.10', sort_order: 4 },
      { name: '8x3', print_size: '8 × 3', sort_order: 5 },
      { name: '6x3', print_size: '6 × 3', sort_order: 6 },
      { name: '4x3', print_size: '4 × 3', sort_order: 7 },
      { name: '6X3 -4F', print_size: '6.20 × 3.20', sort_order: 8 },
      { name: '4X2.5', print_size: '4.20 × 2.70', sort_order: 9 },
      { name: '5x3', print_size: '5.20 × 3.20', sort_order: 14 },
      { name: 'سوسيت', print_size: '1.10 × 2.10', sort_order: 15 },
    ];
    const html = buildPrintSizeCatalog(sampleSizes, 'http://localhost');
    expect(html.match(/<div class="page">/g)).toHaveLength(1);
    expect(html).toContain('ورقة 1 من 1');
    expect(html).not.toContain('المقاسات الافتراضية للمساحات الإعلانية');
    expect(html).toContain('دليل مقاسات الطباعة المعتمدة');
    expect(html.match(/class="size-card catalog-card"/g)).toHaveLength(11);
    // Asserts numbering badge is removed from DOM elements
    expect(html).not.toContain('catalog-badge');
    expect(html).not.toContain('>#1<');
    expect(html).not.toContain('>#11<');
    // Asserts 11th (last odd) card has data-last-odd="true"
    expect(html.match(/<section[^>]*data-last-odd="true"/g)).toHaveLength(1);
  });

  it('filters out sizes marked with show_in_catalog: false', () => {
    const sizes = [
      { name: '13x5', print_size: '13.20 × 4.70', show_in_catalog: true },
      { name: '4X2.5', print_size: '4.20 × 2.70', show_in_catalog: false },
      { name: '12x4', print_size: '12.10 × 4.10' },
    ];
    const html = buildPrintSizeCatalog(sizes, 'http://localhost');
    expect(html).not.toContain('4X2.5');
    expect(html).toContain('13x5');
    expect(html).toContain('12x4');
    expect(html.match(/class="size-card catalog-card"/g)).toHaveLength(2);
  });

  it('centers the last card only when total count on page is odd', () => {
    const oddHtml = buildPrintSizeCatalog([{ name: '13x5' }, { name: '12x4' }, { name: '10x4' }], 'http://localhost');
    expect(oddHtml.match(/<section[^>]*data-last-odd="true"/g)).toHaveLength(1);

    const evenHtml = buildPrintSizeCatalog([{ name: '13x5' }, { name: '12x4' }, { name: '10x4' }, { name: '8x3' }], 'http://localhost');
    expect(evenHtml.match(/<section[^>]*data-last-odd="true"/g)).toBeNull();
  });

  it('paginates when exceeding single page capacity (e.g. 25 sizes)', () => {
    const html = buildPrintSizeCatalog(Array.from({ length: 25 }, (_, i) => ({ name: String(i) })), 'http://localhost');
    expect(html.match(/<div class="page">/g)).toHaveLength(2);
    expect(html).toContain('ورقة 2 من 2');
  });

  it('escapes user-entered dimensions before inserting them in a print document', () => {
    const html = buildPrintSizeCatalog([{ name: '<img src=x>', print_size: '<script>alert(1)</script>' }], 'http://localhost');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(escapePrintText('" &')).toBe('&quot; &amp;');
  });

  it('sets data-count on catalog grid according to available sizes', () => {
    const html3 = buildPrintSizeCatalog([{ name: '13x5' }, { name: '12x4' }, { name: '10x4' }], 'http://localhost');
    expect(html3).toContain('data-count="3"');

    const html5 = buildPrintSizeCatalog(Array.from({ length: 5 }, (_, i) => ({ name: `size-${i}` })), 'http://localhost');
    expect(html5).toContain('data-count="5"');
  });
});
