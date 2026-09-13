import { it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { injectPrintActionBar } from '@/utils/printWindowHelper';
import { unifiedHeaderHtml, unifiedHeaderFooterCss } from '@/lib/unifiedInvoiceBase';

it('allows long invoices to flow within page margins while retaining fixed poster pages', () => {
  const styles = { primaryColor: '#000000', headerBgColor: '#fffdf8', headerSwap: false, logoSize: 86 };
  const header = unifiedHeaderHtml({ styles, fullLogoUrl: '/logofares.svg', titleAr: 'فاتورة طباعة وتركيب', metaLinesHtml: '<div>عقود #1158، #1178</div>' });
  const html = injectPrintActionBar(`<html dir="rtl"><head><meta charset="UTF-8"><style>
    @font-face { font-family:Doran; src:url('/Doran-Regular.otf'); }
    @page { size: A4; margin: 8mm 10mm; }
    * { box-sizing: border-box; } body { margin:0; font-family:Doran,sans-serif; }
    ${unifiedHeaderFooterCss(styles)}
    table { width:100%; table-layout:fixed; border-collapse:collapse; }
    td,th {border:1px solid #ddd; padding:6px; overflow-wrap:anywhere;}
    th {background:black;color:white;} tr {break-inside:avoid;}
  </style></head><body><div class="page" data-print-page data-invoice-print>${header}
  <table><thead><tr>${['#','اللوحة','الموقع','المقاس','العرض','الارتفاع','الوجه','التصميم','المساحة','الإجمالي'].map(t=>`<th>${t}</th>`).join('')}</tr></thead><tbody>
  ${Array.from({length:45},(_,i)=>`<tr><td>${i+1}</td><td>ZL-ZL0454</td><td>الإشارة الضوئية مدخل السبيعة</td><td>6×3</td><td>6</td><td>3</td><td>أمامي</td><td>تصميم الإعلان</td><td>18.00</td><td>1440 د.ل</td></tr>`).join('')}
  </tbody></table><div id="invoice-end">الإجمالي المستحق 2880 د.ل</div></div></body></html>`, { showShare:false });
  expect(html).toContain('body.print-portrait [data-invoice-print][data-print-page]');
  expect(html).toContain('max-height: none !important');
  if(process.env.INVOICE_OVERFLOW_PREVIEW) writeFileSync(process.env.INVOICE_OVERFLOW_PREVIEW,html);
});
