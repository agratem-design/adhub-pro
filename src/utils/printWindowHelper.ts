/**
 * printWindowHelper.ts
 * وحدة معالجة موحدة وشاملة للطباعة متوافقة 100% مع الهواتف الذكية (iOS Safari, Android Chrome) والحواسيب.
 * 
 * الميزات:
 * 1. منع حظر النوافذ المنبثقة (Popup Blocker) عبر فتح نافذة متزامنة أولاً بشاشة تحميل أنيقة.
 * 2. حقن شريط أدوات عائم وثابت (Floating Action Bar) أعلى الصفحة يحتوي على:
 *    - 🖨️ طباعة فورية (Print) مع تمرير اسم الملف المقترح الدقيق لـ Windows Microsoft Print to PDF.
 *    - 📥 حفظ كـ PDF أصلي فائق النقاء بجودة Google Chrome عبر printToPDF أو html2pdf.
 *    - 📤 مشاركة (Share) عبر Web Share API (واتساب، بلوتوث، تطبيقات الطباعة).
 *    - ✕ إغلاق (Close).
 * 3. إزالة جميع أوامر الاستدعاء التلقائي المتسرعة لـ window.print() لمنع ظهور نافذة الطباعة فجأة قبل جاهزية المستخدم.
 * 4. تمكين التمرير الكامل بسلاسة بالماوس وعجلة الفأرة على كامل الشاشة.
 */

import { toast } from 'sonner';

export interface PrintWindowOptions {
  title?: string;
  landscape?: boolean;
  showDownloadPdf?: boolean;
  showShare?: boolean;
  autoPrint?: boolean;
}

/**
 * تنسيق عنوان نظيف ومقروء للمستند بدون تشويه أو شرطات سفلية مفرطة
 */
export function formatCleanDisplayTitle(rawTitle?: string): string {
  if (!rawTitle) return 'طباعة المستند';
  return rawTitle
    .replace(/\.pdf$/i, '')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*•\s*/g, ' • ')
    .replace(/^📄\s*/, '')
    .trim();
}

/**
 * تنسيق اسم ملف صالح 100% لنظام ويندوز ولطابعة Microsoft Print to PDF
 * يمنع الأحرف المحظورة في أسماء الملفات مثل : و * و ? و " و < و > و | و •
 */
export function formatWindowsSafeFileName(title?: string): string {
  if (!title) return 'مستند';
  return title
    .replace(/\.pdf$/i, '')
    .replace(/[\\/:*?"<>|•–—]/g, '-')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim() || 'مستند';
}

/**
 * فتح نافذة/تبويب جديد فوراً أثناء نقرة المستخدم (Synchronously) قبل أي عمليات async
 * لمنع حظر النوافذ المنبثقة من قبل متصفح الهاتف أو الديسكتوب
 */
export function preparePrintWindow(title: string = 'جاري تحضير الطباعة...'): Window | null {
  try {
    const win = window.open('', '_blank');
    if (win) {
      try {
        const cleanTitle = formatCleanDisplayTitle(title);
        const safeFileName = formatWindowsSafeFileName(title);
        win.document.open();
        win.document.write(`
          <!DOCTYPE html>
          <html dir="rtl" lang="ar">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${safeFileName}</title>
            <style>
              * { box-sizing: border-box; margin: 0; padding: 0; }
              body {
                background: #12141a;
                color: #e8cc64;
                font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                padding: 20px;
                text-align: center;
              }
              .loader-card {
                background: #1a1d26;
                border: 1px solid rgba(232, 204, 100, 0.25);
                border-radius: 16px;
                padding: 32px 24px;
                max-width: 360px;
                width: 100%;
                box-shadow: 0 12px 32px rgba(0,0,0,0.5);
                display: flex;
                flex-direction: column;
                align-items: center;
              }
              .spinner {
                width: 44px;
                height: 44px;
                border: 4px solid rgba(232, 204, 100, 0.2);
                border-top-color: #e8cc64;
                border-radius: 50%;
                animation: spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                margin-bottom: 20px;
              }
              @keyframes spin { to { transform: rotate(360deg); } }
              h2 {
                color: #ffffff;
                font-size: 18px;
                font-weight: 700;
                margin-bottom: 8px;
              }
              p {
                color: #9ca3af;
                font-size: 13px;
                line-height: 1.5;
              }
            </style>
          </head>
          <body>
            <div class="loader-card">
              <div class="spinner"></div>
              <h2>جاري تجهيز المستند للطباعة...</h2>
              <p>يرجى الانتظار ثوانٍ معدودة لتحميل البيانات والخطوط</p>
            </div>
          </body>
          </html>
        `);
        win.document.close();
        win.document.title = safeFileName;
      } catch (e) {
        console.warn('Could not write placeholder to print window:', e);
      }
      return win;
    }
  } catch (err) {
    console.error('Failed to prepare print window:', err);
  }
  return null;
}

/**
 * حقن شريط الأدوات العائم والتنسيقات المتوافقة مع الهواتف والحواسيب داخل كود HTML
 */
export function injectPrintActionBar(
  html: string,
  options: PrintWindowOptions = {}
): string {
  const {
    title = 'طباعة المستند',
    landscape = false,
    showDownloadPdf = true,
    showShare = true,
  } = options;

  const displayTitle = formatCleanDisplayTitle(title);
  const safeFileName = formatWindowsSafeFileName(title);
  const escapedTitle = displayTitle.replace(/"/g, '&quot;').replace(/'/g, "\\'");
  const escapedSafeFileName = safeFileName.replace(/"/g, '&quot;').replace(/'/g, "\\'");

  const actionToolbarHtml = `
    <!-- Floating Action Toolbar for Mobile & Desktop -->
    <div id="print-action-toolbar" class="print-mobile-action-bar no-print" dir="rtl">
      <div class="bar-content">
        <div class="bar-title-section" title="${escapedTitle}">
          <span class="doc-icon">📄</span>
          <span class="doc-title">${displayTitle}</span>
        </div>
        <div class="bar-buttons">
          <button type="button" class="btn btn-print" onclick="window.__triggerNativePrint()" ontouchstart="window.__triggerNativePrint()">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
            <span>طباعة</span>
          </button>
          
          ${showDownloadPdf ? `
          <button type="button" class="btn btn-pdf" id="btn-download-pdf" onclick="window.__triggerDownloadPdf()" ontouchstart="window.__triggerDownloadPdf()">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            <span>تحميل PDF</span>
          </button>
          ` : ''}

          ${showShare ? `
          <button type="button" class="btn btn-share" id="btn-share-doc" onclick="window.__triggerShare()" ontouchstart="window.__triggerShare()">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            <span>مشاركة</span>
          </button>
          ` : ''}

          <button type="button" class="btn btn-close" onclick="window.close()" ontouchstart="window.close()">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            <span>إغلاق</span>
          </button>
        </div>
      </div>
      <div id="pdf-progress-indicator" class="pdf-progress-bar" style="display: none;">
        <div class="spinner-small"></div>
        <span>جاري إنشاء وتنزيل ملف PDF... يرجى الانتظار</span>
      </div>
    </div>
  `;

  const injectedStyles = `
    <style id="mobile-print-enhanced-styles">
      /* --- Mobile & Screen View Styling --- */
      @media screen {
        html {
          background: #181b22 !important;
          width: 100% !important;
          height: auto !important;
          min-height: 100vh !important;
          overflow-x: auto !important;
          overflow-y: auto !important;
          scroll-behavior: smooth;
        }
        body {
          background: #181b22 !important;
          color: #000;
          padding-top: 66px !important;
          padding-bottom: 40px !important;
          margin: 0 !important;
          min-height: 100vh !important;
          width: 100% !important;
          height: auto !important;
          overflow-x: auto !important;
          overflow-y: visible !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
        }
        
        /* Floating Action Bar */
        .print-mobile-action-bar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 999999;
          background: rgba(22, 25, 33, 0.96);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(232, 204, 100, 0.25);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
          padding: 8px 14px;
          direction: rtl;
          font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Tajawal', sans-serif;
        }
        .bar-content {
          max-width: 1300px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .bar-title-section {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #ffffff;
          font-weight: 700;
          font-size: 13px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: min(650px, calc(100vw - 360px));
          background: rgba(255, 255, 255, 0.06);
          padding: 5px 12px;
          border-radius: 8px;
          border: 1px solid rgba(232, 204, 100, 0.2);
        }
        .bar-title-section .doc-title {
          color: #e8cc64;
          font-size: 12.5px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .bar-buttons {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .print-mobile-action-bar .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          transition: all 0.15s ease;
          font-family: inherit;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
          touch-action: manipulation;
        }
        .btn-print {
          background: #e8cc64;
          color: #000000;
          box-shadow: 0 2px 8px rgba(232, 204, 100, 0.35);
        }
        .btn-print:active, .btn-print:hover {
          background: #f0d678;
          transform: translateY(-1px);
        }
        .btn-pdf {
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
          border: 1px solid rgba(52, 211, 153, 0.4) !important;
        }
        .btn-pdf:active, .btn-pdf:hover {
          background: rgba(16, 185, 129, 0.25);
        }
        .btn-share {
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
          border: 1px solid rgba(96, 165, 250, 0.4) !important;
        }
        .btn-share:active, .btn-share:hover {
          background: rgba(59, 130, 246, 0.25);
        }
        .btn-close {
          background: rgba(255, 255, 255, 0.08);
          color: #e5e7eb;
        }
        .btn-close:active, .btn-close:hover {
          background: rgba(239, 68, 68, 0.2);
          color: #f87171;
        }

        .pdf-progress-bar {
          margin-top: 6px;
          padding: 6px 10px;
          background: rgba(16, 185, 129, 0.2);
          border-radius: 6px;
          color: #34d399;
          font-size: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .spinner-small {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(52, 211, 153, 0.3);
          border-top-color: #34d399;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        /* Screen Preview Fixed A4 Card Layout - EXACT Same Dimensions as Print */
        body.print-portrait .page,
        body.print-portrait [data-print-page] {
          width: 210mm !important;
          min-width: 210mm !important;
          max-width: 210mm !important;
          height: 297mm !important;
          min-height: 297mm !important;
          max-height: 297mm !important;
          margin: 0 !important;
          background: #ffffff !important;
          box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45) !important;
          border-radius: 4px;
          position: relative !important;
          overflow: hidden !important;
          box-sizing: border-box !important;
          flex-shrink: 0 !important;
        }

        body.print-landscape .page,
        body.print-landscape [data-print-page] {
          width: 297mm !important;
          min-width: 297mm !important;
          max-width: 297mm !important;
          height: 210mm !important;
          min-height: 210mm !important;
          max-height: 210mm !important;
          margin: 0 !important;
          background: #ffffff !important;
          box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45) !important;
          border-radius: 4px;
          position: relative !important;
          overflow: hidden !important;
          box-sizing: border-box !important;
          flex-shrink: 0 !important;
        }

        /* Two-Tier Wrapper for Mobile Scaling without mutating .page */
        .page-scale-wrapper {
          display: flex;
          justify-content: center;
          align-items: flex-start;
          overflow: hidden;
          margin: 16px auto;
          position: relative;
        }

        .page-scaler {
          display: block;
          transform-origin: top center;
        }

        /* Mobile specific screen adjustments */
        @media (max-width: 768px) {
          body {
            padding-top: 60px !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
          }
          .bar-content {
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            gap: 6px;
          }
          .bar-title-section {
            display: none;
          }
          .bar-buttons {
            width: 100%;
            display: flex;
            justify-content: space-between;
            gap: 4px;
          }
          .print-mobile-action-bar .btn {
            padding: 8px 6px;
            font-size: 11.5px;
            flex: 1;
            min-height: 38px;
            justify-content: center;
          }
        }
      }

      /* --- Print Layout Styling (@media print) --- */
      @media print {
        @page {
          margin: 0;
          size: ${landscape ? 'A4 landscape' : 'A4 portrait'};
        }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        .print-mobile-action-bar, .no-print, .controls, .print-btn, .save-btn {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
          height: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        html, body {
          background: #ffffff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        .page-scale-wrapper, .page-scaler {
          display: block !important;
          width: auto !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          transform: none !important;
          overflow: visible !important;
          position: static !important;
        }
        body.print-portrait .page,
        body.print-portrait [data-print-page] {
          width: 210mm !important;
          height: 297mm !important;
          box-shadow: none !important;
          margin: 0 !important;
          border-radius: 0 !important;
          transform: none !important;
          page-break-after: always !important;
          page-break-inside: avoid !important;
          overflow: hidden !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body.print-landscape .page,
        body.print-landscape [data-print-page] {
          width: 297mm !important;
          height: 210mm !important;
          box-shadow: none !important;
          margin: 0 !important;
          border-radius: 0 !important;
          transform: none !important;
          page-break-after: always !important;
          page-break-inside: avoid !important;
          overflow: hidden !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .page:last-child, [data-print-page]:last-child {
          page-break-after: auto !important;
        }
        .background {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .background img {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        img {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    </style>
  `;

  const injectedScript = `
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
    <script>
      (function() {
        var docTitle = "${escapedTitle}";
        var safeFileName = "${escapedSafeFileName}";
        var isLandscape = ${landscape ? 'true' : 'false'};
        document.title = safeFileName;

        // Helper: Official Page Contract (Prevents selecting nested containers)
        function getPrintPages() {
          var rawCandidates = Array.from(document.querySelectorAll('[data-print-page], .page'));
          return rawCandidates.filter(function(el) {
            var parent = el.parentElement;
            while (parent && parent !== document.body) {
              if (parent.hasAttribute('data-print-page') || parent.classList.contains('page')) {
                return false;
              }
              parent = parent.parentElement;
            }
            return true;
          });
        }

        // Mobile Scaling on External Wrappers Only (Keeps .page untouched at native dimensions)
        function applyMobileScale() {
          var isLandscapeDoc = document.body.classList.contains('print-landscape') || isLandscape;
          var pageMmW = isLandscapeDoc ? 297 : 210;
          var pageMmH = isLandscapeDoc ? 210 : 297;
          var pagePxW = pageMmW * 3.779528;
          var pagePxH = pageMmH * 3.779528;
          var screenW = window.innerWidth;
          var previewPadding = 16;
          var availW = screenW - previewPadding;

          var pages = getPrintPages();
          pages.forEach(function(page) {
            var scaler = page.parentElement;
            var wrapper = scaler ? scaler.parentElement : null;

            if (!scaler || !scaler.classList.contains('page-scaler')) {
              wrapper = document.createElement('div');
              wrapper.className = 'page-scale-wrapper';
              scaler = document.createElement('div');
              scaler.className = 'page-scaler';

              page.parentNode.insertBefore(wrapper, page);
              scaler.appendChild(page);
              wrapper.appendChild(scaler);
            }

            var scale = availW < pagePxW ? (availW / pagePxW) : 1;

            if (scale < 1) {
              var scaledW = Math.round(pagePxW * scale);
              var scaledH = Math.round(pagePxH * scale);

              wrapper.style.width = scaledW + 'px';
              wrapper.style.height = scaledH + 'px';
              wrapper.style.margin = '12px auto';

              scaler.style.width = Math.round(pagePxW) + 'px';
              scaler.style.height = Math.round(pagePxH) + 'px';
              scaler.style.transform = 'scale(' + scale + ')';
              scaler.style.transformOrigin = 'top center';
            } else {
              wrapper.style.width = '';
              wrapper.style.height = '';
              wrapper.style.margin = '16px auto';

              scaler.style.width = '';
              scaler.style.height = '';
              scaler.style.transform = '';
              scaler.style.transformOrigin = '';
            }
          });
        }

        window.addEventListener('resize', applyMobileScale);
        window.addEventListener('DOMContentLoaded', applyMobileScale);
        window.addEventListener('load', applyMobileScale);
        setTimeout(applyMobileScale, 60);
        setTimeout(applyMobileScale, 300);
        
        // 1. Native Print Trigger with suggested document title for Windows Microsoft Print to PDF
        window.__triggerNativePrint = function() {
          try {
            document.title = safeFileName;
            window.focus();
            setTimeout(function() {
              document.title = safeFileName;
              window.print();
            }, 80);
          } catch(e) {
            console.error('Trigger print failed:', e);
          }
        };

        // 2. DOM rasterization through html2canvas using its Canvas renderer (foreignObjectRendering disabled)
        window.__triggerDownloadPdf = async function() {
          var progress = document.getElementById('pdf-progress-indicator');
          var btnPdf = document.getElementById('btn-download-pdf');
          var bar = document.getElementById('print-action-toolbar');

          // Desktop App: Use Chromium Native Vector PDF Engine
          var desktop = window.desktopAPI || (window.opener && window.opener.desktopAPI);
          if (desktop && desktop.saveAsPDF) {
            if (bar) bar.style.display = 'none';
            if (progress) progress.style.display = 'flex';
            if (btnPdf) btnPdf.disabled = true;

            desktop.saveAsPDF({
              title: safeFileName,
              landscape: isLandscape,
              pageSize: 'A4'
            }).then(function(res) {
              if (progress) progress.style.display = 'none';
              if (bar) bar.style.display = '';
              if (btnPdf) btnPdf.disabled = false;
            }).catch(function(err) {
              console.error('desktop saveAsPDF error:', err);
              if (progress) progress.style.display = 'none';
              if (bar) bar.style.display = '';
              if (btnPdf) btnPdf.disabled = false;
            });
            return;
          }

          if (progress) progress.style.display = 'flex';
          if (btnPdf) btnPdf.disabled = true;

          try {
            // Wait for fonts to load with timeout tracking
            if (document.fonts) {
              var fontTimeoutId;
              var fontTimeoutPromise = new Promise(function(resolve) {
                fontTimeoutId = setTimeout(function() {
                  if (document.fonts.status !== 'loaded') {
                    console.warn('[Print PDF] Fonts took longer than expected to load. Current status:', document.fonts.status);
                  }
                  resolve();
                }, 3000);
              });
              await Promise.race([
                document.fonts.ready.then(function() { clearTimeout(fontTimeoutId); }),
                fontTimeoutPromise
              ]);
              await new Promise(function(r) { setTimeout(r, 100); });
            }

            // Wait for all images to complete loading with decode verification
            var imgs = Array.from(document.querySelectorAll('img'));
            await Promise.all(imgs.map(function(img) {
              if (img.complete && img.naturalWidth > 0) {
                if (typeof img.decode === 'function') {
                  return img.decode().catch(function() { return Promise.resolve(); });
                }
                return Promise.resolve();
              }
              return new Promise(function(resolve) {
                var done = function() { resolve(); };
                img.addEventListener('load', done, { once: true });
                img.addEventListener('error', function() {
                  console.warn('[Print PDF] Image failed to load:', img.src);
                  resolve();
                }, { once: true });
              });
            }));

            // Execute 3D cutout overlay calculations if present
            if (typeof adjustOverlayPositions === 'function') {
              adjustOverlayPositions();
            }

            var pages = getPrintPages();
            if (pages.length === 0) {
              throw new Error('لا توجد صفحات للتصدير');
            }

            var jsPDFClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
            var html2canvasFunc = window.html2canvas;

            if (!jsPDFClass || !html2canvasFunc) {
              throw new Error('مكتبات Canvas 2D غير محملة');
            }

            var orientation = isLandscape ? 'landscape' : 'portrait';
            var a4W = isLandscape ? 297 : 210;
            var a4H = isLandscape ? 210 : 297;

            var pdf = new jsPDFClass({ unit: 'mm', format: 'a4', orientation: orientation, compress: true });

            for (var i = 0; i < pages.length; i++) {
              var pageEl = pages[i];

              // html2canvas CanvasRenderer path (foreignObjectRendering disabled)
              var canvas = await html2canvasFunc(pageEl, {
                scale: 2.5,
                useCORS: true,
                allowTaint: false,
                logging: false,
                backgroundColor: '#ffffff',
                foreignObjectRendering: false, // html2canvas CanvasRenderer path
                imageTimeout: 15000,
                scrollX: 0,
                scrollY: 0,
              });

              var imgData = canvas.toDataURL('image/jpeg', 0.96);
              if (i > 0) pdf.addPage('a4', orientation);
              pdf.addImage(imgData, 'JPEG', 0, 0, a4W, a4H, undefined, 'FAST');

              // Free memory immediately
              canvas.width = 1;
              canvas.height = 1;
            }

            pdf.save(safeFileName + '.pdf');
          } catch (err) {
            console.error('Canvas 2D PDF export error:', err);
            alert('حدث خطأ أثناء تصدير PDF، سيتم فتح نافذة الطباعة المباشرة.');
            window.__triggerNativePrint();
          } finally {
            if (progress) progress.style.display = 'none';
            if (btnPdf) btnPdf.disabled = false;
          }
        };

        // 3. Web Share Trigger
        window.__triggerShare = function() {
          if (navigator.share) {
            navigator.share({
              title: safeFileName,
              text: 'مستند: ' + safeFileName,
              url: window.location.href
            }).catch(function() {});
          } else {
            window.__triggerDownloadPdf();
          }
        };
      })();
    </script>
  `;

  // 1. Strip all auto-print calls from incoming raw HTML
  let processedHtml = html
    .replace(/<script[^>]*>[\s\S]*?window\.print\(\)[\s\S]*?<\/script>/gi, '')
    .replace(/onload\s*=\s*["'][^"']*window\.print\(\)[^"']*["']/gi, '')
    .replace(/setTimeout\s*\([^)]*window\.print\(\)[^)]*\);?/gi, '');

  // 2. Ensure viewport meta is present
  if (!processedHtml.includes('name="viewport"')) {
    if (processedHtml.includes('<head>')) {
      processedHtml = processedHtml.replace(
        '<head>',
        '<head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">'
      );
    } else {
      processedHtml = '<meta name="viewport" content="width=device-width, initial-scale=1.0">' + processedHtml;
    }
  }

  // 3. Ensure base href and title are present in <head>
  const currentOrigin = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : '';
  const baseTag = currentOrigin ? `<base href="${currentOrigin}/">` : '';

  if (processedHtml.includes('<head>')) {
    processedHtml = processedHtml.replace(
      '<head>',
      `<head>\n<title>${escapedSafeFileName}</title>\n${baseTag}`
    );
  }

  // 4. Inject styles in <head>
  if (processedHtml.includes('</head>')) {
    processedHtml = processedHtml.replace('</head>', `${injectedStyles}</head>`);
  } else {
    processedHtml = `${injectedStyles}${processedHtml}`;
  }

  // 5. Inject Orientation classes and Action Toolbar on <body>
  const orientationClass = landscape ? 'print-landscape' : 'print-portrait';
  const orientationAttr = landscape ? 'landscape' : 'portrait';

  if (processedHtml.includes('<body')) {
    processedHtml = processedHtml.replace(
      /<body([^>]*)>/i,
      (match, p1) => {
        let attrs = p1 || '';
        if (attrs.includes('class="')) {
          attrs = attrs.replace('class="', `class="${orientationClass} `);
        } else if (attrs.includes("class='")) {
          attrs = attrs.replace("class='", `class='${orientationClass} `);
        } else {
          attrs += ` class="${orientationClass}"`;
        }
        attrs += ` data-orientation="${orientationAttr}"`;
        return `<body${attrs}>\n${actionToolbarHtml}\n`;
      }
    );
  } else {
    processedHtml = `<body class="${orientationClass}" data-orientation="${orientationAttr}">\n${actionToolbarHtml}\n${processedHtml}</body>`;
  }

  // 6. Inject script before </body>
  if (processedHtml.includes('</body>')) {
    processedHtml = processedHtml.replace('</body>', `${injectedScript}</body>`);
  } else {
    processedHtml = `${processedHtml}${injectedScript}`;
  }

  return processedHtml;
}

export function writePrintWindow(
  targetWindow: Window | null,
  rawHtml: string,
  options: PrintWindowOptions = {}
): void {
  const { title = 'طباعة المستند', landscape = false } = options;
  const safeFileName = formatWindowsSafeFileName(title);
  const processedHtml = injectPrintActionBar(rawHtml, { ...options, title: safeFileName, landscape });

  try {
    let win = targetWindow && !targetWindow.closed ? targetWindow : window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(processedHtml);
      win.document.close();
      win.document.title = safeFileName;
    } else {
      toast.error('يرجى السماح بفتح النوافذ المنبثقة للطباعة');
    }
  } catch (err) {
    console.error('Error in writePrintWindow:', err);
    try {
      const blob = new Blob([processedHtml], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      if (targetWindow && !targetWindow.closed) {
        targetWindow.location.href = blobUrl;
      } else {
        window.open(blobUrl, '_blank');
      }
    } catch (fallbackErr) {
      console.error('Fallback error in writePrintWindow:', fallbackErr);
      toast.error('فشل في تحضير صفحة الطباعة');
    }
  }
}

/**
 * دالة مساعدة لطباعة أو فتح مستند HTML مباشرة بنقرة واحدة
 */
export function openPrintDirectly(
  rawHtml: string,
  options: PrintWindowOptions = {}
): void {
  const safeFileName = formatWindowsSafeFileName(options.title);
  const win = preparePrintWindow(safeFileName);
  writePrintWindow(win, rawHtml, { ...options, title: safeFileName });
}
