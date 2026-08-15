// Reusable helper to generate a pixel-perfect PDF from an HTML string
// Renders content at A4 width (794px ≈ 210mm at 96dpi) then converts via html2pdf
import DOMPurify from 'dompurify';
import html2pdf from 'html2pdf.js';
import html2canvas from 'html2canvas';
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
 * CSS injected into the cloned DOM before html2canvas captures it.
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
    word-break: break-word !important;
    text-overflow: clip !important;
  }
  /* ★ Images: prevent stretching — exclude logo which has explicit dimensions */
  img:not(.u-logo) {
    max-width: 100% !important;
    height: auto !important;
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
 * Returns the iframe element and the target element for html2pdf.
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

  // Convert SVG images to PNG for html2canvas compatibility
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
          ctx.drawImage(image, 0, 0, w * scale, h * scale);
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
 * Build html2pdf options object for consistent rendering.
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
    html2canvas: {
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

    await html2pdf()
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
 * ★ Capture PDF directly from a live iframe's DOM using html2canvas + jsPDF.
 * This preserves all CSS from the iframe's <head>, unlike html2pdf which clones
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
  const fullHtml = srcDoc.documentElement.outerHTML;

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

        const canvas = await html2canvas(renderTarget, {
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

        const canvas = await html2canvas(el, {
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
        if (margin[0] === 0 && margin[1] === 0 && margin[2] === 0 && margin[3] === 0) {
          pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidthMm, pdfHeightMm);
        } else {
          const contentWidthMm = pdfWidthMm - margin[1] - margin[3];
          const imgAspect = canvas.height / canvas.width;
          const drawW = contentWidthMm;
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
  return captureIframeAsPdfBlob(iframeEl, {
    marginMm: opts.marginMm,
    landscape: opts.landscape,
  });
}

/**
 * Rasterize all SVG <img> elements in a document to PNG data URLs.
 * This ensures html2canvas can render them properly without foreignObjectRendering.
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
          ctx.drawImage(image, 0, 0, w * scale, h * scale);
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
 * ★ Save a full HTML document string as a downloaded PDF using html2canvas + jsPDF.
 * This is the unified path for invoice PDF downloads — it renders in an offscreen
 * iframe at exact A4 width, rasterizes all images (including SVG), captures via
 * html2canvas WITHOUT foreignObjectRendering, and produces a multi-page PDF with
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
 * captures via html2canvas and produces a multi-page PDF.
 */
async function _htmlToHighQualityPdfBlob(
  html: string,
  opts: { marginMm: [number, number, number, number]; waitMs: number; landscape: boolean }
): Promise<Blob> {
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

        const canvas = await html2canvas(renderTarget, {
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
    const noBreakEls = target.querySelectorAll('[data-no-break], tfoot, tfoot tr');
    noBreakEls.forEach(el => {
      const r = (el as HTMLElement).getBoundingClientRect();
      noBreakZones.push({
        top: (r.top - targetRect.top) * canvasScale,
        bottom: (r.bottom - targetRect.top) * canvasScale,
      });
    });

    // Capture the full content as one tall canvas at high resolution
    const canvas = await html2canvas(target, {
      scale: canvasScale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: elWidth,
      windowWidth: elWidth,
      foreignObjectRendering: false,
    });

    // Build multi-page PDF by slicing the canvas
    const orientation = isLandscape ? 'landscape' : 'portrait';
    const pdfWidthMm = isLandscape ? 297 : 210;
    const pdfHeightMm = isLandscape ? 210 : 297;
    const contentWidthMm = pdfWidthMm - margin[1] - margin[3];
    const contentHeightMm = pdfHeightMm - margin[0] - margin[2];

    // Calculate how many pixels of the canvas fit per page
    const mmPerPx = contentWidthMm / canvas.width;
    const pageHeightPx = contentHeightMm / mmPerPx;

    // Smart page breaking: compute page break points respecting data-no-break zones
    const pageBreaks: number[] = [0];
    let currentY = 0;
    while (currentY + pageHeightPx < canvas.height) {
      let breakAt = currentY + pageHeightPx;
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

    // Merge tiny last page: if remaining content is < 15% of page height, merge with previous
    const remainingPx = canvas.height - pageBreaks[pageBreaks.length - 1];
    if (pageBreaks.length > 1 && remainingPx > 0 && remainingPx < pageHeightPx * 0.15) {
      pageBreaks.pop(); // remove last break, previous page will absorb it
    }

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

      pdf.addImage(imgData, 'JPEG', margin[3], margin[0], drawW, drawH);
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(iframe);
  }
}

/**
 * Convert HTML to a PDF Blob (for uploading to Drive, sending via WhatsApp, etc.)
 * ★ Uses the same high-quality html2canvas + jsPDF engine as saveHtmlDocAsPdf
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
  return iframeToPdfBlob(iframeEl, filename, opts);
}
