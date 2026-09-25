import { pricingPrintStyles } from './pricingPrintStyles';
import { toast } from 'sonner';

export interface SizeCatalogItem {
  id?: number;
  name: string;
  print_size?: string | null;
  sort_order?: number | null;
  show_in_catalog?: boolean | null;
}

export function escapePrintText(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
}

export function buildPrintSizeCatalog(sizes: SizeCatalogItem[], origin: string) {
  // Exclude sizes configured not to appear in catalog
  const catalogSizes = sizes.filter(s => s.show_in_catalog !== false);

  // 1. Sort strictly according to defined sort_order rank
  const sortedSizes = [...catalogSizes].sort((a, b) => {
    const orderA = a.sort_order ?? 999;
    const orderB = b.sort_order ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name, 'ar');
  });

  // Fit all sizes on one single page (up to 18 sizes per page with 2-column layout)
  const perPage = 18;
  const totalPages = Math.ceil(sortedSizes.length / perPage) || 1;
  const pages: string[] = [];

  for (let offset = 0; offset < sortedSizes.length || (sortedSizes.length === 0 && offset === 0); offset += perPage) {
    const pageSizes = sortedSizes.slice(offset, offset + perPage);
    const pageNum = pages.length + 1;

    pages.push(`
      <div class="page catalog-sheet" style="--catalog-rows: ${Math.max(5, Math.ceil(pageSizes.length / 2))}">
        <div class="page-content catalog-page-content">
          <div class="header">
            <div class="logo-area">
              <img src="/logofares.svg" class="logo" alt="الفارس الذهبي" />
            </div>
            <div class="title-area">
              <h1 class="main-title"><span>مقاسات الطباعة</span><br><span>للمساحات الإعلانية</span></h1>
              <div class="header-note">مقاس المساحة الإعلانية ومقاس الطباعة المقابل لها · بالمتر</div>
            </div>
          </div>

          <div class="sheet-meta">
            <span class="meta-level-title">دليل مقاسات الطباعة المعتمدة</span>
            <span class="meta-currency">إجمالي المقاسات: ${sortedSizes.length}</span>
          </div>

          <div class="catalog-grid" data-count="${pageSizes.length}">
            ${pageSizes.map((size, idx) => {
              const isLastOdd = (pageSizes.length % 2 !== 0) && (idx === pageSizes.length - 1);
              return `
              <section class="size-card catalog-card"${isLastOdd ? ' data-last-odd="true"' : ''}>
                <div class="catalog-card-top">
                  <span class="catalog-label-name">مقاس المساحة الإعلانية</span>
                  <bdi class="catalog-val-name" dir="ltr">${escapePrintText(size.name)}</bdi>
                </div>
                <div class="catalog-card-bottom">
                  <span class="catalog-label-print">مقاس الطباعة</span>
                  <bdi class="catalog-val-print" dir="ltr">${escapePrintText(size.print_size?.trim() || 'غير محدد')}</bdi>
                </div>
              </section>
              `;
            }).join('')}
          </div>

          <div class="footer">
            <div class="footer-left">يرجى مراجعة المقاس الفعلي قبل اعتماد الطباعة</div>
            <div class="footer-center">ورقة ${pageNum} من ${totalPages}</div>
          </div>
        </div>
      </div>
    `);
  }

  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><base href="${escapePrintText(origin)}/"><title>دليل مقاسات الطباعة</title><style>${pricingPrintStyles('light')}${catalogStyles}</style></head><body><nav class="preview-toolbar" aria-label="أدوات معاينة الطباعة"><button class="print-btn" onclick="window.print()">طباعة</button><button class="close-preview-btn" onclick="if(window.opener){window.opener.focus();window.close();}else{window.location.href='/admin/pricing';}">إغلاق والرجوع</button></nav>${pages.join('')}</body></html>`;
}

// Scoped to the size guide so price-list print layouts remain independent.
const catalogStyles = `
  .catalog-sheet .catalog-page-content {
    display: grid !important; height: 297mm; min-height: 297mm;
    padding: 10mm 10mm 12mm !important;
    grid-template-rows: 38mm 8mm minmax(0, 1fr) 9mm; gap: 3mm;
  }
  .catalog-sheet .header { padding-bottom: 3mm; }
  .catalog-sheet .logo-area { width: 40%; }
  .catalog-sheet .main-title { font-size: 20pt; }
  .catalog-sheet .header-note { white-space: normal; max-width: 90mm; color: #505050; font-size: 9pt; }
  .catalog-sheet .catalog-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: repeat(var(--catalog-rows), minmax(0, 1fr));
    gap: 3mm 5mm; margin: 0; min-height: 0; --val-w: 43mm;
  }
  .catalog-sheet .catalog-card {
    min-height: 0; border: .3mm solid #333; border-radius: 3mm 0 3mm 0;
    box-shadow: none; display: grid; grid-template-rows: 1fr 1fr;
    grid-template-columns: minmax(0, 1fr); justify-content: stretch;
    justify-items: stretch; align-items: stretch; padding: 0; gap: 0;
  }
  .catalog-sheet .catalog-card[data-last-odd="true"] {
    grid-column: 1 / -1; width: calc((100% - 5mm) / 2); justify-self: center;
  }
  .catalog-sheet .catalog-card-top, .catalog-sheet .catalog-card-bottom {
    height: auto; min-height: 0; width: 100%; margin: 0; padding: 0;
    align-self: stretch; justify-self: stretch;
    grid-template-columns: minmax(0, 1fr) 43mm !important;
  }
  .catalog-sheet .catalog-card-top { background: #f7f4eb; border-bottom: .25mm solid #d6c9a5; }
  .catalog-sheet .catalog-label-name, .catalog-sheet .catalog-label-print {
    white-space: normal; overflow: visible; padding: 1mm 2mm;
    font-size: 11pt; line-height: 1.25; font-weight: 700;
  }
  .catalog-sheet .catalog-val-name, .catalog-sheet .catalog-val-print {
    border-right: .25mm solid #d6c9a5; padding: 1mm;
    font-size: 15pt; letter-spacing: 0; font-weight: 700;
  }
  .catalog-sheet .catalog-val-print { font-size: 13pt; }
  .catalog-sheet .footer { margin: 0; font-size: 8pt; align-self: stretch; }
  .catalog-sheet::after { bottom: 5mm; left: 10mm; right: 10mm; height: 2.5mm; }
  @media screen and (max-width: 650px) {
    .catalog-sheet .catalog-page-content { height: auto; min-height: 0; display: flex !important; padding: 18px !important; }
    .catalog-sheet .catalog-grid { grid-template-columns: 1fr; grid-template-rows: none; grid-auto-rows: 100px; gap: 12px; }
    .catalog-sheet .catalog-card[data-last-odd="true"] { width: 100%; }
    .catalog-sheet .main-title { font-size: 17pt; }
    .catalog-sheet .footer { margin: 12px 0; }
    .catalog-sheet::after { bottom: 0; }
  }
`;

export function printSizeCatalog(sizes: SizeCatalogItem[]) {
  const visibleSizes = sizes.filter(s => s.show_in_catalog !== false);
  if (!visibleSizes.length) { toast.info('لا توجد مقاسات للطباعة'); return; }
  const preview = window.open('', '_blank');
  if (!preview) { toast.error('تعذر فتح المعاينة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.'); return; }
  preview.document.write(buildPrintSizeCatalog(visibleSizes, window.location.origin));
  preview.document.close();
  preview.focus();
}
