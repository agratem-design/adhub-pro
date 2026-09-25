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
      <div class="page">
        <div class="page-content catalog-page-content">
          <div class="header">
            <div class="logo-area">
              <img src="/logofares.svg" class="logo" alt="الفارس الذهبي" />
            </div>
            <div class="title-area">
              <h1 class="main-title"><span>مقاسات الطباعة</span><br><span>للمساحات الإعلانية</span></h1>
              <div class="header-note">جميع المقاسات بالمتر · شاملة الهوامش الفنية للتركيب</div>
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

  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><base href="${escapePrintText(origin)}/"><title>دليل مقاسات الطباعة</title><style>${pricingPrintStyles('light')}</style></head><body><nav class="preview-toolbar" aria-label="أدوات معاينة الطباعة"><button class="print-btn" onclick="window.print()">طباعة</button><button class="close-preview-btn" onclick="if(window.opener){window.opener.focus();window.close();}else{window.location.href='/admin/pricing';}">إغلاق والرجوع</button></nav>${pages.join('')}</body></html>`;
}

export function printSizeCatalog(sizes: SizeCatalogItem[]) {
  const visibleSizes = sizes.filter(s => s.show_in_catalog !== false);
  if (!visibleSizes.length) { toast.info('لا توجد مقاسات للطباعة'); return; }
  const preview = window.open('', '_blank');
  if (!preview) { toast.error('تعذر فتح المعاينة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.'); return; }
  preview.document.write(buildPrintSizeCatalog(visibleSizes, window.location.origin));
  preview.document.close();
  preview.focus();
}
