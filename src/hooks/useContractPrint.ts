/**
 * Hook for unified contract printing functionality
 * Uses the same approach as ContractTermsSettings.tsx for consistent output
 */

import { useCallback } from 'react';
import { toast } from 'sonner';
import { openPrintDirectly } from '@/utils/printWindowHelper';

interface PrintOptions {
  title?: string;
  designWidth?: number;
  designHeight?: number;
}

/**
 * Creates a print-safe HTML document from a preview element
 * Uses dir="ltr" with explicit RTL text handling to avoid SVG coordinate issues
 */
export function useContractPrint() {
  const openPrintDocument = useCallback((html: string, title: string = 'طباعة العقد'): boolean => {
    try {
      openPrintDirectly(html, {
        title,
        landscape: false,
        showDownloadPdf: true,
        showShare: true,
        autoPrint: true,
      });
      return true;
    } catch (e) {
      console.error('Failed to open print document:', e);
      toast.error('تعذر فتح نافذة الطباعة');
      return false;
    }
  }, []);

  const printElement = useCallback((
    elementSelector: string,
    options: PrintOptions = {}
  ) => {
    const {
      title = 'طباعة العقد',
      designWidth = 2480,
      designHeight = 3508,
    } = options;

    // Get the preview element
    const previewEl = document.querySelector(elementSelector) as HTMLElement | null;

    if (!previewEl) {
      toast.error('لم يتم العثور على المعاينة للطباعة');
      return false;
    }

    // Calculate print scale for A4 (fallback) + dynamic scale inside print window
    // 150% scale confirmed by user to fill page correctly
    const a4WidthPx = (210 / 25.4) * 96;
    const printScale = (a4WidthPx / designWidth) * 1.5;

    // Clone the element and reset transforms
    const clonedEl = previewEl.cloneNode(true) as HTMLElement;
    clonedEl.style.width = `${designWidth}px`;
    clonedEl.style.height = `${designHeight}px`;
    clonedEl.style.removeProperty('transform');
    clonedEl.style.removeProperty('transform-origin');

    // Get all styles from the current page
    const stylesHtml = Array.from(
      document.querySelectorAll('style, link[rel="stylesheet"]')
    )
      .map((n) => (n as HTMLElement).outerHTML)
      .join('\n');

    const origin = window.location.origin;

    const html = `
      <!DOCTYPE html>
      <html dir="ltr">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <base href="${origin}/" />
        <title>${title}</title>
        ${stylesHtml}
        <style>
          :root { --print-scale: ${printScale}; }

          @page { size: A4; margin: 0; }
          html, body { width: 210mm; height: 297mm; margin: 0; padding: 0; background: white; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }

          @font-face {
            font-family: 'Doran';
            src: url('/Doran-Regular.otf') format('opentype');
            font-weight: 400;
            font-style: normal;
            font-display: swap;
          }
          @font-face {
            font-family: 'Doran';
            src: url('/Doran-Bold.otf') format('opentype');
            font-weight: 700;
            font-style: normal;
            font-display: swap;
          }

          body { font-family: 'Doran', 'Tajawal', sans-serif; direction: ltr; }

          .print-page {
            width: 210mm;
            height: 297mm;
            position: relative;
            overflow: hidden;
            direction: ltr;
            page-break-after: always;
          }

          .print-page:last-child {
            page-break-after: avoid;
          }

          .print-page .contract-preview-container,
          .print-page .print-content {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            right: auto !important;
            width: ${designWidth}px !important;
            height: ${designHeight}px !important;
            /* مهم: zoom يغيّر حجم الـ layout ويمنع Chrome من عمل تصغير إضافي عند تعدد الصفحات */
            zoom: var(--print-scale) !important;
            transform: none !important;
            transform-origin: top left !important;
            margin: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            direction: ltr;
          }

          .contract-preview-container img,
          .print-content img { max-width: none !important; }

          .contract-preview-container,
          .contract-preview-container *,
          .print-content,
          .print-content * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          table, thead, tbody, tr, th, td {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          th, td {
            background-color: inherit !important;
          }
        </style>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
      </head>
      <body>
        <div class="print-page">
          ${clonedEl.outerHTML}
        </div>
        <script>
          function setDynamicPrintScale() {
            try {
              const probe = document.createElement('div');
              probe.style.width = '210mm';
              probe.style.height = '1mm';
              probe.style.position = 'absolute';
              probe.style.left = '-9999px';
              probe.style.top = '-9999px';
              probe.style.visibility = 'hidden';
              document.body.appendChild(probe);

              const measuredA4WidthPx = probe.getBoundingClientRect().width || probe.offsetWidth;
              document.body.removeChild(probe);

               if (measuredA4WidthPx && measuredA4WidthPx > 0) {
                 // Keep the same 150% multiplier used in the fallback scale
                 const dynamicScale = (measuredA4WidthPx / ${designWidth}) * 1.5;
                 document.documentElement.style.setProperty('--print-scale', String(dynamicScale));
               }
            } catch (e) {
              // ignore
            }
          }

          window.addEventListener('load', function () {
            setDynamicPrintScale();

            function waitForCss() {
              const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
              return Promise.all(links.map((l) => new Promise((res) => {
                try {
                  if (l.sheet) return res();
                  l.addEventListener('load', () => res(), { once: true });
                  l.addEventListener('error', () => res(), { once: true });
                  setTimeout(() => res(), 1200);
                } catch (e) {
                  res();
                }
              })));
            }

            const imgs = Array.from(document.images || []);
            const waitImgs = Promise.all(imgs.map((img) => img.complete ? Promise.resolve() : new Promise((res) => {
              img.onload = () => res();
              img.onerror = () => res();
            })));

            const waitFonts = (document.fonts && document.fonts.ready)
              ? document.fonts.ready.catch(function () { return; })
              : Promise.resolve();

            Promise.all([waitForCss(), waitImgs, waitFonts]).then(function () {
              setTimeout(function () { window.print(); }, 200);
            });
          });
        </script>
      </body>
      </html>
    `;

    return openPrintDocument(html, title);
  }, [openPrintDocument]);

  /**
   * Print multiple pages from an array of HTML strings
   */
  const printMultiplePages = useCallback((
    pagesHtml: string[],
    options: PrintOptions = {}
  ) => {
    const {
      title = 'طباعة العقد',
      designWidth = 2480,
      designHeight = 3508,
    } = options;

    if (pagesHtml.length === 0) {
      toast.error('لا توجد صفحات للطباعة');
      return false;
    }

    // Calculate print scale for A4
    const a4WidthPx = (210 / 25.4) * 96;
    const printScale = a4WidthPx / designWidth;

    // Get all styles from the current page
    const stylesHtml = Array.from(
      document.querySelectorAll('style, link[rel="stylesheet"]')
    )
      .map((n) => (n as HTMLElement).outerHTML)
      .join('\n');

    const origin = window.location.origin;

    // Generate pages HTML
    // إذا كان المحتوى يحتوي على contract-preview-container، نستخدمه مباشرة
    // وإلا نلفه في print-content
    const pagesContent = pagesHtml.map((pageHtml, idx) => {
      const hasContainer = pageHtml.includes('contract-preview-container');
      if (hasContainer) {
        return `
          <div class="print-page" data-page="${idx + 1}">
            ${pageHtml}
          </div>
        `;
      }
      return `
        <div class="print-page" data-page="${idx + 1}">
          <div class="print-content" style="width: ${designWidth}px; height: ${designHeight}px;">
            ${pageHtml}
          </div>
        </div>
      `;
    }).join('\n');

    const html = `
      <!DOCTYPE html>
      <html dir="ltr">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <base href="${origin}/" />
        <title>${title}</title>
        ${stylesHtml}
        <style>
          :root { --print-scale: ${printScale}; }

          @page { size: A4; margin: 0; }
          html, body { width: 210mm; margin: 0; padding: 0; background: white; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }

          @font-face {
            font-family: 'Doran';
            src: url('/Doran-Regular.otf') format('opentype');
            font-weight: 400;
            font-style: normal;
            font-display: swap;
          }
          @font-face {
            font-family: 'Doran';
            src: url('/Doran-Bold.otf') format('opentype');
            font-weight: 700;
            font-style: normal;
            font-display: swap;
          }

          body { font-family: 'Doran', 'Tajawal', sans-serif; direction: ltr; }

          .print-page {
            width: 210mm;
            height: 297mm;
            position: relative;
            overflow: hidden;
            direction: ltr;
            page-break-after: always;
          }

          .print-page:last-child {
            page-break-after: avoid;
          }

          .print-page .contract-preview-container,
          .print-page .print-content {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            right: auto !important;
            width: ${designWidth}px !important;
            height: ${designHeight}px !important;
            /* مهم: zoom يغيّر حجم الـ layout ويمنع Chrome من عمل تصغير إضافي عند تعدد الصفحات */
            zoom: var(--print-scale) !important;
            transform: none !important;
            transform-origin: top left !important;
            margin: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            direction: ltr;
          }

          .print-page .contract-preview-container img,
          .print-page .print-content img { max-width: none !important; }

          .print-page .contract-preview-container,
          .print-page .contract-preview-container *,
          .print-page .print-content,
          .print-page .print-content * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          table, thead, tbody, tr, th, td {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          th, td {
            background-color: inherit !important;
          }

          @media print {
            .print-page {
              page-break-inside: avoid;
            }
          }
        </style>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
      </head>
      <body>
        ${pagesContent}
        <script>
          function setDynamicPrintScale() {
            try {
              const probe = document.createElement('div');
              probe.style.width = '210mm';
              probe.style.height = '1mm';
              probe.style.position = 'absolute';
              probe.style.left = '-9999px';
              probe.style.top = '-9999px';
              probe.style.visibility = 'hidden';
              document.body.appendChild(probe);

              const measuredA4WidthPx = probe.getBoundingClientRect().width || probe.offsetWidth;
              document.body.removeChild(probe);

               if (measuredA4WidthPx && measuredA4WidthPx > 0) {
                 const dynamicScale = measuredA4WidthPx / ${designWidth};
                 document.documentElement.style.setProperty('--print-scale', String(dynamicScale));
               }
            } catch (e) {
              // ignore
            }
          }

          window.addEventListener('load', function () {
            setDynamicPrintScale();

            function waitForCss() {
              const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
              return Promise.all(links.map((l) => new Promise((res) => {
                try {
                  if (l.sheet) return res();
                  l.addEventListener('load', () => res(), { once: true });
                  l.addEventListener('error', () => res(), { once: true });
                  setTimeout(() => res(), 1200);
                } catch (e) {
                  res();
                }
              })));
            }

            const imgs = Array.from(document.images || []);
            const waitImgs = Promise.all(imgs.map((img) => img.complete ? Promise.resolve() : new Promise((res) => {
              img.onload = () => res();
              img.onerror = () => res();
            })));

            const waitFonts = (document.fonts && document.fonts.ready)
              ? document.fonts.ready.catch(function () { return; })
              : Promise.resolve();

            Promise.all([waitForCss(), waitImgs, waitFonts]).then(function () {
              setTimeout(function () { window.print(); }, 300);
            });
          });
        </script>

      </body>
      </html>
    `;

    return openPrintDocument(html, title);
  }, [openPrintDocument]);

  return {
    printElement,
    printMultiplePages,
  };
}

/**
 * Utility to generate SVG data URI for solid color backgrounds
 * Ensures colors print correctly without relying on browser print settings
 */
export function solidFillDataUri(fill: string): string {
  const safeFill = (fill ?? "").toString().trim() || "#000000";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="100%" height="100%" fill="${safeFill}"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
