import { applyPrintInkSaver } from '@/lib/printInkSaver';
// Reusable helper to generate a pixel-perfect PDF from an HTML string
// Renders content at A4 width (794px ≈ 210mm at 96dpi) then converts via browserPdf
import DOMPurify from 'dompurify';
import browserPdf from '@/lib/browserPdf';
import browserCanvas from '@/lib/browserCanvas';
import { jsPDF } from 'jspdf';

export interface SavePdfOptions {
  filename?: string;
  marginMm?: [number, number, number, number];
  rootSelector?: string;
  waitMs?: number;
}

export interface PdfBlobOptions {
  filename?: string;
  marginMm?: [number, number, number, number];
  landscape?: boolean;
  waitMs?: number;
}

// A4 dimensions in mm — we use mm units throughout to match the preview iframe
const A4_WIDTH_MM = '210mm';
const MAX_CANVAS_DIMENSION = 16384;
const MAX_CANVAS_AREA = 240_000_000;

function getSafeCanvasScale(elWidth: number, elHeight: number, desiredScale: number, minScale = 1.5): number {
  const safeWidth = Math.max(1, elWidth);
  const safeHeight = Math.max(1, elHeight);
  let scale = desiredScale;

  if (safeHeight * scale > MAX_CANVAS_DIMENSION) {
    scale = Math.min(scale, MAX_CANVAS_DIMENSION / safeHeight);
  }

  if (safeWidth * scale > MAX_CANVAS_DIMENSION) {
    scale = Math.min(scale, MAX_CANVAS_DIMENSION / safeWidth);
  }

  if (safeWidth * safeHeight * scale * scale > MAX_CANVAS_AREA) {
    scale = Math.min(scale, Math.sqrt(MAX_CANVAS_AREA / (safeWidth * safeHeight)));
  }

  return Math.max(minScale, Math.min(scale, desiredScale));
}

/**
 * CSS injected into the cloned DOM before browserCanvas captures it.
 * Forces print-like behavior: exact color rendering, and neutralized responsive breakpoints.
 * NOTE: We do NOT force table-layout:fixed here — it distorts RTL receipt tables.
 */
const PRINT_OVERRIDE_CSS = `
  /* Force print color rendering */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  /* Prevent page-break issues */
  tr, td, th, img, svg {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  /* Neutralize any responsive max-width constraints */
  .container, [class*="max-w-"] {
    max-width: none !important;
  }
  .print-page, .template-container {
    page-break-after: always !important;
    break-after: page !important;
  }
  /* ★ Anti-clipping: prevent text cut-off in table cells and their children */
  td, th, td > div:not(.u-invoice-title):not(.u-invoice-info), td > span, td > p, th > div, th > span {
    overflow: visible !important;
    word-break: normal !important;
    text-overflow: clip !important;
  }
  /* ★ Images: prevent stretching — exclude logo which has explicit dimensions */
  img:not(.u-logo) {
    max-width: 100% !important;
    object-fit: contain !important;
  }
  /* ★ Totals and summary: prevent page break in the middle */
  tfoot, tfoot tr, [data-no-break] {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
`;

/**
 * Core iframe-based renderer shared by both save and blob paths.
 * Writes the full HTML document into an offscreen iframe so that
 * html, body, @page rules, fonts, and RTL direction are all preserved.
 * Returns the iframe element and the target element for browserPdf.
 */
async function renderInIframe(html: string, waitMs: number): Promise<{ iframe: HTMLIFrameElement; targetElement: HTMLElement }> {
  const sanitizedHtml = DOMPurify.sanitize(html, {
    ADD_TAGS: ['style', 'link', 'meta', 'title'],
    ADD_ATTR: ['target', 'rel', 'dir', 'lang', 'charset', 'content', 'http-equiv', 'media', 'type'],
    WHOLE_DOCUMENT: true,
    RETURN_DOM: false,
    FORCE_BODY: false,
  });

  const iframe = document.createElement('iframe');
  iframe.style.cssText = `position:absolute;left:-9999px;top:-9999px;width:${A4_WIDTH_MM};height:297mm;border:none;visibility:hidden;`;
  iframe.sandbox.add('allow-same-origin', 'allow-scripts');
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    throw new Error('Failed to create iframe');
  }

  iframeDoc.open();
  iframeDoc.write(sanitizedHtml);
  iframeDoc.close();

  // Inject override styles
  const overrideStyle = iframeDoc.createElement('style');
  overrideStyle.innerHTML = `
    body, html {
      margin: 0 !important;
      padding: 0 !important;
      width: ${A4_WIDTH_MM} !important;
      background-color: #ffffff !important;
    }
    ${PRINT_OVERRIDE_CSS}
  `;
  iframeDoc.head.appendChild(overrideStyle);

  // Wait for iframe to finish loading
  await new Promise<void>((resolve) => {
    let doneOnce = false;
    const done = () => {
      if (doneOnce) return;
      doneOnce = true;
      setTimeout(resolve, waitMs);
    };
    if (iframe.contentWindow && iframeDoc.readyState !== 'complete') {
      iframe.contentWindow.addEventListener('load', done, { once: true });
    }
    setTimeout(done, 3000);
  });

  // Wait for custom fonts
  try { await (iframeDoc as any).fonts?.ready; } catch { }

  // Convert SVG images to PNG for browserCanvas compatibility
  const svgImages = Array.from(iframeDoc.querySelectorAll('img'));
  await Promise.all(
    svgImages.map(async (img) => {
      const src = img.getAttribute('src') || '';
      if (!src.includes('.svg')) {
        // Just wait for non-svg images to load
        if (!img.complete) {
          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          });
        }
        return;
      }
      try {
        const resp = await fetch(src);
        const svgText = await resp.text();
        const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        const image = new Image();
        image.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = reject;
          image.src = url;
        });
        const w = img.clientWidth || img.naturalWidth || 200;
        const h = img.clientHeight || img.naturalHeight || 200;
        const scale = 3;
        const canvas = document.createElement('canvas');
        canvas.width = w * scale;
        canvas.height = h * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const fit = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
          const drawWidth = image.naturalWidth * fit;
          const drawHeight = image.naturalHeight * fit;
          ctx.drawImage(image, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);
          img.src = canvas.toDataURL('image/png');
        }
        URL.revokeObjectURL(url);
      } catch (e) {
        console.warn('SVG to PNG conversion failed for', src, e);
      }
    })
  );

  return { iframe, targetElement: iframeDoc.body };
}

/**
 * Build browserPdf options object for consistent rendering.
 */
function buildPdfOptions(opts: {
  filename: string;
  marginMm: [number, number, number, number];
  orientation: 'portrait' | 'landscape';
}) {
  return {
    margin: opts.marginMm,
    filename: opts.filename,
    image: { type: 'jpeg', quality: 0.98 },
    canvas: {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      foreignObjectRendering: false,
      onclone: (clonedDoc: Document) => {
        const style = clonedDoc.createElement('style');
        style.textContent = PRINT_OVERRIDE_CSS + `
          html, body { background-color: #ffffff !important; }
        `;
        clonedDoc.head.appendChild(style);
      },
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: opts.orientation },
    pagebreak: { mode: ['css', 'legacy'] },
  };
}

/**
 * Save HTML as a downloaded PDF file (legacy path — renders from raw HTML string).
 */
export async function saveHtmlAsPdf(html: string, filename: string, opts: SavePdfOptions = {}) {
  const { iframe, targetElement } = await renderInIframe(html, opts.waitMs ?? 1500);

  try {
    const target = opts.rootSelector
      ? (iframe.contentDocument!.querySelector(opts.rootSelector) as HTMLElement | null) || targetElement
      : targetElement;

    await browserPdf()
      .from(target)
      .set(buildPdfOptions({
        filename: opts.filename ?? filename,
        marginMm: opts.marginMm ?? [10, 0, 10, 0],
        orientation: 'portrait',
      }) as any)
      .save();
  } finally {
    document.body.removeChild(iframe);
  }
}

/**
 * ★ Capture PDF directly from a live iframe's DOM using browserCanvas + jsPDF.
 * This preserves all CSS from the iframe's <head>, unlike browserPdf which clones
 * subtrees and loses class-based styles.
 */
async function captureIframeAsPdfBlob(
  iframeEl: HTMLIFrameElement | null,
  opts: { marginMm?: [number, number, number, number]; landscape?: boolean } = {}
): Promise<Blob> {
  const srcDoc = iframeEl?.contentDocument || iframeEl?.contentWindow?.document;
  if (!srcDoc || !srcDoc.body) {
    throw new Error('Iframe document not accessible');
  }

  // Clone the full HTML from the preview iframe
  const fullHtml = applyPrintInkSaver(srcDoc.documentElement.outerHTML);

  // Check if this document contains contract pages with 2480x3508 design coordinates
  const isContractDocument = Boolean(
    srcDoc.querySelector('.contract-preview-container') ||
    fullHtml.includes('contract-preview-container') ||
    fullHtml.includes('2480')
  );

  const DESIGN_W_PX = 2480;
  const DESIGN_H_PX = 3508;

  const offscreen = document.createElement('iframe');
  if (isContractDocument) {
    offscreen.style.cssText = `position:fixed;left:-9999px;top:0;width:${DESIGN_W_PX}px;height:auto;border:none;visibility:hidden;`;
  } else {
    offscreen.style.cssText = `position:absolute;left:-9999px;top:-9999px;width:${A4_WIDTH_MM};height:297mm;border:none;visibility:hidden;`;
  }
  document.body.appendChild(offscreen);

  const offDoc = offscreen.contentDocument || offscreen.contentWindow?.document;
  if (!offDoc) {
    document.body.removeChild(offscreen);
    throw new Error('Failed to create offscreen iframe');
  }

  offDoc.open();
  offDoc.write(fullHtml);
  offDoc.close();

  // Inject overrides
  const overrideStyle = offDoc.createElement('style');
  if (isContractDocument) {
    overrideStyle.textContent = `
      html {
        width: ${DESIGN_W_PX}px !important;
        max-width: ${DESIGN_W_PX}px !important;
        margin: 0 !important;
        padding: 0 !important;
        background-color: #ffffff !important;
        overflow: visible !important;
      }
      body {
        width: ${DESIGN_W_PX}px !important;
        max-width: ${DESIGN_W_PX}px !important;
        margin: 0 !important;
        padding: 0 !important;
        background-color: #ffffff !important;
        overflow: visible !important;
      }
      .print-page {
        width: ${DESIGN_W_PX}px !important;
        height: ${DESIGN_H_PX}px !important;
        max-width: none !important;
        max-height: none !important;
        overflow: hidden !important;
        display: block !important;
        page-break-after: always !important;
      }
      .print-page .contract-preview-container,
      .contract-preview-container {
        transform: none !important;
        zoom: 1 !important;
        -webkit-transform: none !important;
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        right: auto !important;
        width: ${DESIGN_W_PX}px !important;
        height: ${DESIGN_H_PX}px !important;
        max-width: none !important;
        max-height: none !important;
        overflow: visible !important;
        display: block !important;
      }
      .template-container, .print-page {
        display: block !important;
        page-break-after: always !important;
        break-after: page !important;
      }
    `;
  } else {
    overrideStyle.textContent = `
      html, body {
        width: ${A4_WIDTH_MM} !important;
        margin: 0 !important;
        padding: 0 !important;
        background-color: #ffffff !important;
        overflow: visible !important;
      }
      .measurements-container, .paper, .receipt-container, [data-pdf-root] {
        background-color: #ffffff !important;
        width: ${A4_WIDTH_MM} !important;
        max-width: ${A4_WIDTH_MM} !important;
      }
      ${PRINT_OVERRIDE_CSS}
    `;
  }
  offDoc.head.appendChild(overrideStyle);

  // Wait for load
  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; setTimeout(resolve, 500); } };
    if (offscreen.contentWindow && offDoc.readyState !== 'complete') {
      offscreen.contentWindow.addEventListener('load', finish, { once: true });
    }
    setTimeout(finish, 3000);
  });

  // Wait for fonts
  try { await (offDoc as any).fonts?.ready; } catch { }

  // Wait for images to load
  const imgs = Array.from(offDoc.querySelectorAll('img'));
  await Promise.all(imgs.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r(); });
  }));

  // Convert ALL images to data URLs via fetch+blob (CORS-safe)
  for (const img of imgs) {
    try {
      if (img.src.startsWith('data:')) continue;
      const resp = await fetch(img.src, { mode: 'cors' });
      const blob = await resp.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      img.src = dataUrl;
      await new Promise<void>(r => { if (img.complete) r(); else { img.onload = () => r(); img.onerror = () => r(); } });
    } catch (e) {
      console.warn('Image to data URL conversion failed (CORS):', e);
    }
  }

  try {
    // Find pages or root
    let pageElements = Array.from(offDoc.querySelectorAll('.print-page')) as HTMLElement[];
    if (pageElements.length === 0) {
      pageElements = Array.from(offDoc.querySelectorAll('.template-container, .page')) as HTMLElement[];
    }
    const root = pageElements.length > 0 ? null : (
      (offDoc.querySelector('.measurements-container') as HTMLElement) ||
      (offDoc.querySelector('.paper') as HTMLElement) ||
      (offDoc.querySelector('.receipt-container') as HTMLElement) ||
      (offDoc.querySelector('[data-pdf-root]') as HTMLElement) ||
      offDoc.body
    );

    const orientation = isContractDocument ? 'portrait' : (opts.landscape ? 'landscape' : 'portrait');
    const pdfWidthMm = orientation === 'landscape' ? 297 : 210;
    const pdfHeightMm = orientation === 'landscape' ? 210 : 297;
    const margin = opts.marginMm || [0, 0, 0, 0];

    const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4', compress: true });

    const elements = pageElements.length > 0 ? pageElements : [root!];

    for (let i = 0; i < elements.length; i++) {
      if (i > 0) pdf.addPage();

      const el = elements[i];
      const contractContainer = el.querySelector('.contract-preview-container') as HTMLElement | null;

      if (isContractDocument) {
        const renderTarget = contractContainer || el;
        renderTarget.style.width = `${DESIGN_W_PX}px`;
        renderTarget.style.height = `${DESIGN_H_PX}px`;
        renderTarget.style.overflow = 'visible';
        renderTarget.style.display = 'block';
        renderTarget.style.transform = 'none';
        renderTarget.style.zoom = '1';

        const canvas = await browserCanvas(renderTarget, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: DESIGN_W_PX,
          height: DESIGN_H_PX,
          windowWidth: DESIGN_W_PX,
          windowHeight: DESIGN_H_PX,
          foreignObjectRendering: false,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);

        // Clickable QR code links
        const qrLinks = renderTarget.querySelectorAll('a[href]');
        qrLinks.forEach((link) => {
          const href = link.getAttribute('href');
          if (!href) return;
          const rect = link.getBoundingClientRect();
          const containerRect = renderTarget.getBoundingClientRect();
          const xMm = ((rect.left - containerRect.left) / DESIGN_W_PX) * 210;
          const yMm = ((rect.top - containerRect.top) / DESIGN_H_PX) * 297;
          const wMm = (rect.width / DESIGN_W_PX) * 210;
          const hMm = (rect.height / DESIGN_H_PX) * 297;
          if (wMm > 0 && hMm > 0) {
            pdf.link(xMm, yMm, wMm, hMm, { url: href });
          }
        });
      } else {
        const rect = el.getBoundingClientRect();
        const elWidth = rect.width || el.scrollWidth || 794;
        const elHeight = rect.height || el.scrollHeight || 1123;
        const canvasScale = getSafeCanvasScale(elWidth, elHeight, 2.5);

        const canvas = await browserCanvas(el, {
          scale: canvasScale,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: elWidth,
          windowWidth: elWidth,
          foreignObjectRendering: false,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        {
          const contentWidthMm = pdfWidthMm - margin[1] - margin[3];
          const imgAspect = canvas.height / canvas.width;
          const drawW = Math.min(contentWidthMm, (pdfHeightMm - margin[0] - margin[2]) / imgAspect);
          const drawH = drawW * imgAspect;
          pdf.addImage(imgData, 'JPEG', margin[3], margin[0], drawW, drawH);
        }
      }
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(offscreen);
  }
}

export async function saveIframeAsPdf(
  iframeEl: HTMLIFrameElement | null,
  filename: string,
  opts: SavePdfOptions = {}
) {
  const blob = await captureIframeAsPdfBlob(iframeEl, {
    marginMm: opts.marginMm,
  });

  // Trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = opts.filename ?? filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function iframeToPdfBlob(
  iframeEl: HTMLIFrameElement | null,
  filename: string,
  opts: PdfBlobOptions = {}
): Promise<Blob> {
  if (window.desktopAPI?.renderPdf) {
    const doc = iframeEl?.contentDocument;
    if (!doc) throw new Error('مستند المعاينة غير جاهز');
    return htmlToPdfBlob(doc.documentElement.outerHTML, filename, opts);
  }
  return captureIframeAsPdfBlob(iframeEl, {
    marginMm: opts.marginMm,
    landscape: opts.landscape,
  });
}

/**
 * Rasterize all SVG <img> elements in a document to PNG data URLs.
 * This ensures browserCanvas can render them properly without foreignObjectRendering.
 */
async function rasterizeSvgImages(doc: Document): Promise<void> {
  const imgs = Array.from(doc.querySelectorAll('img'));
  for (const img of imgs) {
    try {
      const src = img.getAttribute('src') || img.src || '';
      if (!src || src.startsWith('data:')) continue;

      // Fetch as blob (CORS-safe)
      const resp = await fetch(src, { mode: 'cors' });
      const blob = await resp.blob();

      // If it's SVG, rasterize via canvas at high res
      if (blob.type.includes('svg') || src.includes('.svg')) {
        const svgText = await blob.text();
        const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        const image = new Image();
        image.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = reject;
          image.src = url;
        });
        const w = img.clientWidth || img.naturalWidth || 200;
        const h = img.clientHeight || img.naturalHeight || 200;
        const scale = 3;
        const canvas = document.createElement('canvas');
        canvas.width = w * scale;
        canvas.height = h * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const fit = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
          const drawWidth = image.naturalWidth * fit;
          const drawHeight = image.naturalHeight * fit;
          ctx.drawImage(image, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);
          img.src = canvas.toDataURL('image/png');
        }
        URL.revokeObjectURL(url);
      } else {
        // Non-SVG: convert to data URL via FileReader
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        img.src = dataUrl;
      }
      // Wait for image to reload with new src
      await new Promise<void>(r => {
        if (img.complete) r();
        else { img.onload = () => r(); img.onerror = () => r(); }
      });
    } catch (e) {
      console.warn('Image conversion failed for', img.src, e);
    }
  }
}

/**
 * ★ Save a full HTML document string as a downloaded PDF using browserCanvas + jsPDF.
 * This is the unified path for invoice PDF downloads — it renders in an offscreen
 * iframe at exact A4 width, rasterizes all images (including SVG), captures via
 * browserCanvas WITHOUT foreignObjectRendering, and produces a multi-page PDF with
 * proper margins matching the print preview.
 */
export async function saveHtmlDocAsPdf(
  html: string,
  filename: string,
  opts: { marginMm?: [number, number, number, number]; waitMs?: number } = {}
): Promise<void> {
  const blob = await _htmlToHighQualityPdfBlob(html, {
    marginMm: opts.marginMm || [5, 5, 5, 5],
    waitMs: opts.waitMs ?? 1200,
    landscape: false,
  });

  // Trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * ★ Shared high-quality PDF engine used by both saveHtmlDocAsPdf and htmlToPdfBlob.
 * Renders in an offscreen iframe at exact A4 width, rasterizes all images (including SVG),
 * captures via browserCanvas and produces a multi-page PDF.
 */
async function _htmlToHighQualityPdfBlob(
  html: string,
  opts: { marginMm: [number, number, number, number]; waitMs: number; landscape: boolean }
): Promise<Blob> {
  html = applyPrintInkSaver(html);
  if (window.desktopAPI?.renderPdf) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const base = doc.createElement('base');
    base.href = document.baseURI;
    doc.head.prepend(base);
    const result = await window.desktopAPI.renderPdf({ html: '<!DOCTYPE html>' + doc.documentElement.outerHTML, landscape: opts.landscape });
    const binary = atob(result.base64);
    return new Blob([Uint8Array.from(binary, char => char.charCodeAt(0))], { type: 'application/pdf' });
  }
  const margin = opts.marginMm;
  const waitMs = opts.waitMs;
  const isLandscape = opts.landscape;
  const isContractDocument = Boolean(
    html.includes('contract-preview-container') ||
    html.includes('2480')
  );

  const DESIGN_W_PX = 2480;
  const DESIGN_H_PX = 3508;

  // Create offscreen iframe
  const iframe = document.createElement('iframe');
  if (isContractDocument) {
    iframe.style.cssText = `position:fixed;left:-9999px;top:0;width:${DESIGN_W_PX}px;height:auto;border:none;visibility:hidden;`;
  } else {
    iframe.style.cssText = `position:absolute;left:-9999px;top:-9999px;width:${A4_WIDTH_MM};height:297mm;border:none;visibility:hidden;`;
  }
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    throw new Error('Failed to create iframe');
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // Inject PDF overrides
  const overrideStyle = iframeDoc.createElement('style');
  if (isContractDocument) {
    overrideStyle.textContent = `
      html {
        width: ${DESIGN_W_PX}px !important;
        max-width: ${DESIGN_W_PX}px !important;
        margin: 0 !important;
        padding: 0 !important;
        background-color: #ffffff !important;
        overflow: visible !important;
      }
      body {
        width: ${DESIGN_W_PX}px !important;
        max-width: ${DESIGN_W_PX}px !important;
        margin: 0 !important;
        padding: 0 !important;
        background-color: #ffffff !important;
        overflow: visible !important;
      }
      .print-page {
        width: ${DESIGN_W_PX}px !important;
        height: ${DESIGN_H_PX}px !important;
        max-width: none !important;
        max-height: none !important;
        overflow: hidden !important;
        display: block !important;
        page-break-after: always !important;
      }
      .print-page .contract-preview-container,
      .contract-preview-container {
        transform: none !important;
        zoom: 1 !important;
        -webkit-transform: none !important;
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        right: auto !important;
        width: ${DESIGN_W_PX}px !important;
        height: ${DESIGN_H_PX}px !important;
        max-width: none !important;
        max-height: none !important;
        overflow: visible !important;
        display: block !important;
      }
      .template-container, .print-page {
        display: block !important;
        page-break-after: always !important;
        break-after: page !important;
      }
    `;
  } else {
    overrideStyle.textContent = `
      html, body {
        width: ${A4_WIDTH_MM} !important;
        margin: 0 !important;
        padding: 0 !important;
        background-color: #ffffff !important;
        overflow: visible !important;
      }
      ${PRINT_OVERRIDE_CSS}
    `;
  }
  iframeDoc.head.appendChild(overrideStyle);

  // Wait for load
  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; setTimeout(resolve, waitMs); } };
    if (iframe.contentWindow && iframeDoc.readyState !== 'complete') {
      iframe.contentWindow.addEventListener('load', finish, { once: true });
    }
    setTimeout(finish, 4000);
  });

  // Wait for fonts
  try { await (iframeDoc as any).fonts?.ready; } catch {}

  // Wait for all images to load, then rasterize (SVG → PNG, others → data URL)
  const imgs = Array.from(iframeDoc.querySelectorAll('img'));
  await Promise.all(imgs.map(img =>
    img.complete ? Promise.resolve() : new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r(); })
  ));
  await rasterizeSvgImages(iframeDoc);

  // Convert external images to data URLs (needed for foreignObjectRendering)
  for (const img of imgs) {
    if (img.src.startsWith('data:')) continue;
    try {
      const resp = await fetch(img.src, { mode: 'cors' });
      const blob = await resp.blob();
      const dataUrl: string = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      img.src = dataUrl;
      await new Promise<void>(r => { if (img.complete) r(); else img.onload = () => r(); });
    } catch { /* skip if CORS fails */ }
  }

  // Small extra wait for re-rendered images
  await new Promise(r => setTimeout(r, 300));

  try {
    if (isContractDocument) {
      let pageElements = Array.from(iframeDoc.querySelectorAll('.print-page')) as HTMLElement[];
      if (pageElements.length === 0) {
        pageElements = Array.from(iframeDoc.querySelectorAll('.template-container, .page')) as HTMLElement[];
      }
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      for (let i = 0; i < pageElements.length; i++) {
        if (i > 0) pdf.addPage();
        const page = pageElements[i];
        const renderTarget = (page.querySelector('.contract-preview-container') as HTMLElement | null) || page;
        renderTarget.style.width = `${DESIGN_W_PX}px`;
        renderTarget.style.height = `${DESIGN_H_PX}px`;
        renderTarget.style.overflow = 'visible';
        renderTarget.style.display = 'block';
        renderTarget.style.transform = 'none';
        renderTarget.style.zoom = '1';

        const canvas = await browserCanvas(renderTarget, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: DESIGN_W_PX,
          height: DESIGN_H_PX,
          windowWidth: DESIGN_W_PX,
          windowHeight: DESIGN_H_PX,
          foreignObjectRendering: false,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);

        // Clickable QR code links
        const qrLinks = renderTarget.querySelectorAll('a[href]');
        qrLinks.forEach((link) => {
          const href = link.getAttribute('href');
          if (!href) return;
          const rect = link.getBoundingClientRect();
          const containerRect = renderTarget.getBoundingClientRect();
          const xMm = ((rect.left - containerRect.left) / DESIGN_W_PX) * 210;
          const yMm = ((rect.top - containerRect.top) / DESIGN_H_PX) * 297;
          const wMm = (rect.width / DESIGN_W_PX) * 210;
          const hMm = (rect.height / DESIGN_H_PX) * 297;
          if (wMm > 0 && hMm > 0) {
            pdf.link(xMm, yMm, wMm, hMm, { url: href });
          }
        });
      }
      return pdf.output('blob');
    }

    const target = (iframeDoc.querySelector('.print-container') || iframeDoc.querySelector('[data-invoice-print]') || iframeDoc.body) as HTMLElement;
    const elWidth = target.getBoundingClientRect().width || target.scrollWidth || 794;

    // Collect no-break element positions BEFORE canvas capture (in DOM pixel coords relative to target)
    const targetRect = target.getBoundingClientRect();
    const canvasScale = getSafeCanvasScale(elWidth, targetRect.height || target.scrollHeight || 1123, 13.0);
    const noBreakZones: { top: number; bottom: number }[] = [];
    // Include [data-no-break], tfoot, and tfoot tr
    const footerSource = target.querySelector<HTMLElement>('.u-footer');
    const repeatedFooter = footerSource?.cloneNode(true) as HTMLElement | undefined;
    if (footerSource) footerSource.style.display = 'none';
    const pageNumberNodes = Array.from(target.querySelectorAll<HTMLElement>('.u-page-number, .page-number'));
    pageNumberNodes.forEach(node => { node.style.display = 'none'; });
    // Freeze the computed logo box before the DOM is cloned for export.
    target.querySelectorAll<HTMLElement>('.u-logo').forEach(logo => {
      const box = logo.getBoundingClientRect();
      logo.style.width = box.width + 'px';
      logo.style.height = box.height + 'px';
      logo.style.flex = 'none';
      logo.style.objectFit = 'contain';
    });
    const noBreakEls = target.querySelectorAll('[data-no-break], tfoot, tfoot tr, .receipt-attachments, .receipt-attachment-grid img');
    noBreakEls.forEach(el => {
      const r = (el as HTMLElement).getBoundingClientRect();
      noBreakZones.push({
        top: (r.top - targetRect.top) * canvasScale,
        bottom: (r.bottom - targetRect.top) * canvasScale,
      });
    });

    // Capture the full content as one tall canvas at high resolution
    const canvas = await browserCanvas(target, {
      scale: canvasScale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: elWidth,
      windowWidth: elWidth,
      foreignObjectRendering: false,
    });
    const actualScale = canvas.width / elWidth;
    noBreakZones.forEach(zone => {
      zone.top *= actualScale / canvasScale;
      zone.bottom *= actualScale / canvasScale;
    });

    // Build multi-page PDF by slicing the canvas
    const orientation = isLandscape ? 'landscape' : 'portrait';
    const pdfWidthMm = isLandscape ? 297 : 210;
    const pdfHeightMm = isLandscape ? 210 : 297;
    const contentWidthMm = pdfWidthMm - margin[1] - margin[3];
    const footerSpace = repeatedFooter ? 24 : (pageNumberNodes.length ? 8 : 0);
    const contentHeightMm = pdfHeightMm - margin[0] - margin[2] - footerSpace;
    const sourceHeader = target.querySelector<HTMLElement>('.u-header, .measurements-header');
    let repeatedHeader: HTMLCanvasElement | null = null;
    let repeatedHeaderMm = 0;
    if (sourceHeader) {
      const compact = sourceHeader.cloneNode(true) as HTMLElement;
      compact.style.cssText += ';width:' + elWidth + 'px;margin:0;padding:18px 12px 14px;min-height:88px;box-sizing:border-box;background:white';
      compact.querySelectorAll('.u-company-name, .u-company-subtitle, .u-contact-info').forEach(el => el.remove());
      compact.querySelectorAll<HTMLElement>('.u-logo').forEach(logo => { logo.style.height = '72px'; logo.style.width = 'auto'; });
      iframeDoc.body.appendChild(compact);
      repeatedHeader = await browserCanvas(compact, { width: elWidth, scale: 2 });
      repeatedHeaderMm = repeatedHeader.height / repeatedHeader.width * contentWidthMm + 3;
      compact.remove();
    }

    // Calculate how many pixels of the canvas fit per page
    const mmPerPx = contentWidthMm / canvas.width;
    const pageHeightPx = contentHeightMm / mmPerPx;

    // Smart page breaking: compute page break points respecting data-no-break zones
    const pageBreaks: number[] = [0];
    let currentY = 0;
    while (currentY < canvas.height) {
      const capacity = pageBreaks.length === 1 ? pageHeightPx : (contentHeightMm - repeatedHeaderMm) / mmPerPx;
      if (currentY + capacity >= canvas.height) break;
      let breakAt = currentY + capacity;
      const originalBreak = breakAt;
      // Check if this break cuts through a no-break zone
      for (const zone of noBreakZones) {
        if (breakAt > zone.top && breakAt < zone.bottom) {
          breakAt = zone.top;
          break;
        }
      }
      // Safety: if moving the break would create a nearly-empty page (< 100px), revert
      if (breakAt - currentY < 100) {
        breakAt = originalBreak;
      }
      pageBreaks.push(breakAt);
      currentY = breakAt;
    }

    // Keep the last page: absorbing it would exceed the printable height.

    const totalPages = pageBreaks.length;
    const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4', compress: true });

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) pdf.addPage();

      const srcY = pageBreaks[page];
      const nextY = page + 1 < totalPages ? pageBreaks[page + 1] : canvas.height;
      const srcH = nextY - srcY;

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = Math.ceil(srcH);
      const ctx = pageCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
      }

      const imgData = pageCanvas.toDataURL('image/jpeg', 0.95);
      const drawW = contentWidthMm;
      const drawH = srcH * mmPerPx;

      const headerOffset = page > 0 ? repeatedHeaderMm : 0;
      if (page > 0 && repeatedHeader) {
        pdf.addImage(repeatedHeader.toDataURL('image/png'), 'PNG', margin[3], margin[0], contentWidthMm, repeatedHeaderMm - 3);
      }
      pdf.addImage(imgData, 'JPEG', margin[3], margin[0] + headerOffset, drawW, drawH);
      if (repeatedFooter) {
        const footer = repeatedFooter.cloneNode(true) as HTMLElement;
        footer.style.cssText += ';display:flex;width:' + elWidth + 'px;margin:0;padding-top:8px;';
        const number = footer.querySelector('.u-page-number-text, .page-number');
        if (number) number.textContent = `صفحة ${page + 1} من ${totalPages}`;
        footer.querySelectorAll<HTMLElement>('.u-page-number').forEach(el => { el.style.display = 'inline-block'; });
        iframeDoc.body.appendChild(footer);
        const footerCanvas = await browserCanvas(footer, { width: elWidth, scale: 2 });
        const height = Math.min(footerSpace - 2, footerCanvas.height / footerCanvas.width * contentWidthMm);
        pdf.addImage(footerCanvas.toDataURL('image/png'), 'PNG', margin[3], pdfHeightMm - margin[2] - height - 3, contentWidthMm, height);
        footer.remove();
      } else if (pageNumberNodes.length) {
        const label = iframeDoc.createElement('div');
        label.textContent = `صفحة ${page + 1} من ${totalPages}`;
        label.style.cssText = 'width:240px;height:24px;font:12px Doran,Arial;direction:rtl;text-align:center;color:#666;background:white';
        iframeDoc.body.appendChild(label);
        const labelCanvas = await browserCanvas(label, { width: 240, height: 24, scale: 2 });
        pdf.addImage(labelCanvas.toDataURL('image/png'), 'PNG', (pdfWidthMm - 60) / 2, pdfHeightMm - 7, 60, 6);
        label.remove();
      }
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(iframe);
  }
}

/**
 * Convert HTML to a PDF Blob (for uploading to Drive, sending via WhatsApp, etc.)
 * ★ Uses the same high-quality browserCanvas + jsPDF engine as saveHtmlDocAsPdf
 *   to ensure identical rendering quality across all PDF paths.
 */
export async function htmlToPdfBlob(html: string, filename: string, opts: PdfBlobOptions = {}): Promise<Blob> {
  return _htmlToHighQualityPdfBlob(html, {
    marginMm: opts.marginMm || [5, 5, 5, 5],
    waitMs: opts.waitMs ?? 1200,
    landscape: opts.landscape ?? false,
  });
}

/**
 * الاحتفاظ بالتوافق مع الاستدعاءات القديمة، لكن بنفس محرك PDF عالي الجودة
 * حتى يكون ملف الرفع/واتساب مطابقاً تماماً لملف زر التحميل.
 */
export async function htmlToPdfBlobOptimized(html: string, filename: string, opts: PdfBlobOptions = {}): Promise<Blob> {
  return htmlToPdfBlob(html, filename, opts);
}

/**
 * الاحتفاظ بالتوافق مع الاستدعاءات القديمة، لكن بنفس محرك المعاينة/التحميل
 * لضمان تطابق الرفع والإرسال مع ملف زر التحميل.
 */
export async function iframeToPdfBlobOptimized(
  iframeEl: HTMLIFrameElement | null,
  filename: string,
  opts: PdfBlobOptions = {}
): Promise<Blob> {
  const previewDoc = iframeEl?.contentDocument || iframeEl?.contentWindow?.document;
  if (!previewDoc?.body) throw new Error('مستند المعاينة غير جاهز للتصدير');
  await previewDoc.fonts?.ready;
  return htmlToPdfBlob(previewDoc.documentElement.outerHTML, filename, opts);
}
