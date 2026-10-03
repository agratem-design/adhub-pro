import { describe, it, expect } from 'vitest';
import { prepareSizesInvoiceContracts, summarizeSizesInvoice, buildSizesInvoiceHTML } from '@/lib/sizesInvoice';
import { DEFAULT_PRINT_SETTINGS } from '@/types/print-settings';
import { REFERENCE_INVOICE_STYLE } from '@/lib/officialInvoiceTemplate';

describe('selected contract sizes invoices', () => {
  it('retains all selected contracts and customers and applies per-contract single faces', () => {
    const board = { ID: 10, Size: '4 × 3', Faces_Count: 2 };
    const data = prepareSizesInvoiceContracts([
      { Contract_Number: 1170, customer_name: 'الأول', single_face_billboards: '[10]', billboards: [board] },
      { Contract_Number: 1171, customer_name: 'الثاني', single_face_billboards: '', billboards: [board] },
      { Contract_Number: 1172, customer_name: 'الأول', single_face_billboards: '10,11', billboards: [board] },
    ]);
    expect(data.contractNumbers).toEqual(['1170', '1171', '1172']);
    expect(data.customerName).toBe('الأول، الثاني');
    expect(data.billboards.map(board => board.Faces_Count)).toEqual([1, 2, 1]);
    expect(board.Faces_Count).toBe(2);
    const summary = summarizeSizesInvoice(data.billboards, { '4 × 3': { width: 4, height: 3 } });
    expect(summary.totalBillboards).toBe(3);
    expect(summary.totalArea).toBe(48);
  });
  it('keeps underscore size names intact and uses stored dimensions', () => {
    const summary = summarizeSizesInvoice([{ Size: 'واجهة_كبيرة', Faces_Count: 2 }, { Size: 'واجهة_كبيرة', Faces_Count: 2 }], { 'واجهة_كبيرة': { width: 5, height: 3 } });
    expect(summary.items[0].sizeName).toBe('واجهة_كبيرة');
    expect(summary.items[0].quantity).toBe(2);
    expect(summary.totalArea).toBe(60);
  });
  it('groups equivalent labels and parses Arabic dimensions when missing from the size registry', () => {
    const summary = summarizeSizesInvoice([{ Size: '٤ × ٣', Faces_Count: 1 }, { Size: '4x3', Faces_Count: 1 }], {});
    expect(summary.items).toHaveLength(1);
    expect(summary.totalArea).toBe(24);
    expect(summary.missingSizes).toEqual([]);
  });
  it('reports missing dimensions without presenting them as zero measurements', async () => {
    const html = await buildSizesInvoiceHTML({ ...DEFAULT_PRINT_SETTINGS, ...REFERENCE_INVOICE_STYLE }, { billboards: [{ Size: 'غير معروف', Faces_Count: 2 }], dimensions: {}, customerName: 'عميل', contractNumbers: ['1170'], date: '2026-10-02' });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.body.textContent).toContain('إجمالي المساحة محسوب للمقاسات المعروفة فقط');
    expect(doc.querySelector('tbody')?.textContent).toContain('—');
    expect(doc.querySelector('tbody')?.textContent).not.toContain('0.00');
  });
  it('uses the shared header, saved palette and A4 margins for the actual print action', async () => {
    const html = await buildSizesInvoiceHTML({ ...DEFAULT_PRINT_SETTINGS, ...REFERENCE_INVOICE_STYLE, table_header_bg_color: '#262626', page_margin_right: 8 }, { billboards: [{ Size: '4 × 3', Faces_Count: 1 }, { Size: '4 × 3', Faces_Count: 2 }], dimensions: {}, customerName: 'عميل', contractNumbers: ['1170', '1171'], date: '2026-10-02' });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('.u-header')).not.toBeNull();
    expect(doc.querySelectorAll('table')).toHaveLength(2);
    expect(doc.body.textContent).toContain('1170، 1171');
    expect(doc.body.textContent).toContain('36.00');
    expect(html).toContain('#262626');
    expect(html).toContain('margin: 0;');
    expect(html).toContain('padding: 15mm 8mm 15mm 15mm');
    expect(html).not.toContain('window.print()');
  });
  it('corrects incomplete or account statement titles to كشف مقاسات الطباعة and uses المقاس for the first column header', async () => {
    // When title is empty or wrongly set to كشف الحساب
    const htmlWithWrongTitle = await buildSizesInvoiceHTML(
      { ...DEFAULT_PRINT_SETTINGS, ...REFERENCE_INVOICE_STYLE, document_title_ar: 'كشف الحساب' },
      { billboards: [{ Size: '4 × 3', Faces_Count: 1 }], dimensions: {}, customerName: 'عميل', contractNumbers: ['1313'], date: '2026-10-03' }
    );
    const doc = new DOMParser().parseFromString(htmlWithWrongTitle, 'text/html');
    expect(doc.querySelector('.u-invoice-title')?.textContent?.trim()).toBe('كشف مقاسات الطباعة');
    expect(doc.querySelector('.u-invoice-subtitle')?.textContent?.trim()).toBe('SIZES STATEMENT');
    expect(doc.body.textContent).toContain('أرقام العقود:');
    expect(doc.body.textContent).toContain('1313');
    // Ensure column header is المقاس
    const ths = Array.from(doc.querySelectorAll('th')).map(th => th.textContent?.trim());
    expect(ths).toContain('المقاس');
  });
  it('fetches width and height from print_size settings for each size, but calculates area on actual billboard size', () => {
    const summary = summarizeSizesInvoice(
      [
        { Size: '12x4', Faces_Count: 1 },
        { Size: '4x3', Faces_Count: 2, print_size: '4.20 × 3.20' },
        { Size: 'سوسيت', Faces_Count: 1 },
      ],
      {
        '12x4': { width: 12, height: 4, print_size: '12.20 × 4.20' },
        '4x3': { width: 4, height: 3, print_size: '4.10 × 3.10' },
        'سوسيت': { width: 1, height: 2, print_size: '1.10 × 2.10' },
      }
    );
    const item12x4 = summary.items.find(i => i.sizeName === '12x4')!;
    expect(item12x4.widthMeters).toBe(12.2);
    expect(item12x4.heightMeters).toBe(4.2);
    // الحساب على المقاس الفعلي 12 × 4 = 48 م²
    expect(item12x4.areaPerFace).toBe(48);
    expect(item12x4.totalArea).toBe(48);

    const item4x3 = summary.items.find(i => i.sizeName === '4x3')!;
    expect(item4x3.widthMeters).toBe(4.2);
    expect(item4x3.heightMeters).toBe(3.2);
    // الحساب على المقاس الفعلي 4 × 3 = 12 م² (وجهين = 24 م²)
    expect(item4x3.areaPerFace).toBe(12);
    expect(item4x3.totalArea).toBe(24);

    const itemSucette = summary.items.find(i => i.sizeName === 'سوسيت')!;
    expect(itemSucette.widthMeters).toBe(1.1);
    expect(itemSucette.heightMeters).toBe(2.1);
    // الحساب على المقاس الفعلي 1 × 2 = 2 م²
    expect(itemSucette.areaPerFace).toBe(2);
    expect(itemSucette.totalArea).toBe(2);
  });
  it('sorts sizes strictly according to their rank (sort_order) from settings', () => {
    const summary = summarizeSizesInvoice(
      [
        { Size: 'سوسيت', Faces_Count: 1 },
        { Size: '12x4', Faces_Count: 1 },
        { Size: '14x5', Faces_Count: 1 },
      ],
      {
        '14x5': { width: 14, height: 5, sort_order: 1 },
        '12x4': { width: 12, height: 4, sort_order: 2 },
        'سوسيت': { width: 1, height: 2, sort_order: 15 },
      }
    );
    expect(summary.items.map(i => i.sizeName)).toEqual(['14x5', '12x4', 'سوسيت']);
  });
});
