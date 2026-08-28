/**
 * Unified Contract Print - يستخدم نفس بنية المعاينة من ContractTermsSettings
 * الأبعاد: 2480x3508 (نفس viewBox) ثم يتم تصغيرها لـ A4
 * 
 * مهم: جميع الوحدات والحسابات يجب أن تتطابق مع المعاينة في ContractTermsSettings.tsx
 */

import { PageSectionSettings, DiscountDisplaySettings, FallbackSettings, DEFAULT_DISCOUNT_DISPLAY, DEFAULT_FALLBACK_SETTINGS } from '@/hooks/useContractTemplateSettings';
import { buildTableTermHtml } from '@/lib/contractTableTerm';
import { formatLongArabicDate } from '@/lib/utils';
import QRCode from 'qrcode';

// ===== DESIGN DIMENSIONS (same as preview) =====
const DESIGN_W = 2480;
const DESIGN_H = 3508;

// A4 في 96 DPI = 793.7px width
// لتحويل 2480px إلى عرض A4 الكامل (210mm)
// نستخدم scale أعلى لملء الصفحة بشكل صحيح عند الطباعة
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
// Scale لتحويل التصميم ليملأ A4 بالكامل
const PRINT_SCALE = 1; // سنستخدم transform مختلف للطباعة

// معامل تحويل mm إلى design px (نفس المعاينة: 1mm ≈ 3.779 design px)
// في تصميم 2480px عرض يساوي 210mm، إذاً: 2480 / 210 ≈ 11.81 ولكن المعاينة تستخدم 3.779
// لأن topPosition في الإعدادات هو بالـ mm ويتم ضربه في 3.779
const MM_TO_DESIGN_PX = 3.779;

// SVG data URI for solid color backgrounds - ensures colors print correctly
function solidFillDataUri(fill: string): string {
  const safeFill = (fill ?? "").toString().trim() || "#000000";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="100%" height="100%" fill="${safeFill}"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Rasterize an SVG (or any image) URL to a PNG data URL via an offscreen canvas.
 * html2canvas cannot render complex SVGs (especially those with embedded <image>),
 * so we pre-rasterize them to PNG which html2canvas handles perfectly.
 */
async function rasterizeSvgToDataUrl(
  url: string,
  width: number = DESIGN_W,
  height: number = DESIGN_H
): Promise<string> {
  const trimmedUrl = (url ?? '').trim();
  if (!trimmedUrl) return trimmedUrl;
  if (trimmedUrl.startsWith('data:image/png') || trimmedUrl.startsWith('data:image/jpeg')) return trimmedUrl;

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(trimmedUrl); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(trimmedUrl);
      }
    };
    img.onerror = () => resolve(trimmedUrl);
    // Handle relative URLs
    try {
      img.src = new URL(trimmedUrl, window.location.origin).toString();
    } catch {
      img.src = trimmedUrl;
    }
  });
}

async function embedAssetForPdf(url: string): Promise<string> {
  const trimmedUrl = (url ?? '').trim();
  if (!trimmedUrl || typeof window === 'undefined') return trimmedUrl;
  if (trimmedUrl.startsWith('data:') || trimmedUrl.startsWith('blob:')) return trimmedUrl;

  try {
    const absoluteUrl = new URL(trimmedUrl, window.location.origin).toString();
    const response = await fetch(absoluteUrl, {
      credentials: 'same-origin',
    });

    if (!response.ok) {
      return absoluteUrl;
    }

    return await blobToDataUrl(await response.blob());
  } catch (error) {
    console.warn('Failed to inline PDF asset:', trimmedUrl, error);
    return trimmedUrl;
  }
}

// Format Arabic number
const formatArabicNumber = (num: number): string => {
  if (num === null || num === undefined || isNaN(num)) return '0';
  const rounded = Math.round(Number(num) * 10) / 10;
  const [integerPart, decimalPart = '0'] = rounded.toString().split('.');
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${formattedInteger}.${decimalPart}`;
};

// Text measurement cache
const __textMeasureCache = new Map<string, number>();
let __textMeasureCtx: CanvasRenderingContext2D | null = null;

function measureTextWidthPx(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: string | number = 400
): number {
  if (typeof document === 'undefined') return text.length * fontSize * 0.5;

  const key = `${fontFamily}|${fontWeight}|${fontSize}|${text}`;
  const cached = __textMeasureCache.get(key);
  if (cached != null) return cached;

  if (!__textMeasureCtx) {
    const canvas = document.createElement('canvas');
    __textMeasureCtx = canvas.getContext('2d');
  }

  if (!__textMeasureCtx) return text.length * fontSize * 0.5;

  __textMeasureCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const width = __textMeasureCtx.measureText(text).width;
  __textMeasureCache.set(key, width);
  return width;
}

export interface ContractData {
  contractNumber: string;
  yearlyCode?: string;
  year: string;
  startDate: string;
  endDate: string;
  rawStartDate?: string; // ISO date for Hijri conversion (e.g. "2025-07-20")
  duration: string;
  customerName: string;
  customerCompany?: string;
  customerPhone?: string;
  isOffer?: boolean;
  adType?: string;
  billboardsCount?: number;
  currencyName?: string;
}

export interface ContractTerm {
  id: string;
  term_title: string;
  term_content: string;
  term_order: number;
  is_active: boolean;
  font_size: number;
}

export interface BillboardPrintData {
  id: string;
  code?: string;
  billboardName?: string;
  image?: string;
  municipality?: string;
  district?: string;
  landmark?: string;
  size?: string;
  faces?: string | number;
  price?: string;
  originalPrice?: string; // السعر الأصلي قبل التخفيض
  hasDiscount?: boolean; // هل هناك تخفيض
  prePausePrice?: string; // للوحات الموقوفة: السعر بعد الخصم وقبل الإيقاف
  gpsLink?: string;
  rent_end_date?: string;
  duration_days?: string;
  isReplacement?: boolean;
  replacementStartDate?: string;
  replacedBillboardName?: string;
  isPaused?: boolean;
  pauseDate?: string;
  isEndDateCustom?: boolean;
  customStartDate?: string;
  customEndDate?: string;
  customStartDateReason?: string;
}

export interface UnifiedPrintOptions {
  settings: PageSectionSettings;
  contractData: ContractData;
  terms: ContractTerm[];
  billboards: BillboardPrintData[];
  templateBgUrl: string;
  noStampBgUrl?: string; // خلفية بدون ختم للصفحة الأولى
  tableBgUrl: string;
  noStampTableBgUrl?: string; // خلفية بدون ختم لجدول اللوحات
  currencyInfo: {
    symbol: string;
    writtenName: string;
  };
  contractDetails: {
    finalTotal: string;
    rentalCost: string;
    installationCost: string;
    duration: string;
    discount?: string;
    installationEnabled?: boolean;
    printCostEnabled?: boolean;
  };
  paymentsHtml: string;
  renderTarget?: 'preview' | 'pdf';
}

// Generate QR code data URL
async function generateQRDataUrl(url: string, fgColor: string, bgColor: string, size: number): Promise<string> {
  try {
    return await QRCode.toDataURL(url, {
      width: Math.max(50, Math.round(size)),
      margin: 0,
      color: { dark: fgColor, light: bgColor },
      errorCorrectionLevel: 'M',
    });
  } catch (e) {
    console.error('QR generation error:', e);
    return '';
  }
}

// Wrap text into lines using pixel-based measurement (matches preview in ContractTermsSettings)
function wrapText(text: string, maxWidthPx: number, fontSize: number = 42): string[] {
  const normalized = (text ?? '').toString().replace(/\r\n/g, '\n');
  const blocks = normalized.split('\n');
  const out: string[] = [];
  const fontFamily = 'Doran, sans-serif';

  blocks.forEach((block) => {
    const safeBlock = block.replace(/\s+/g, ' ').trim();
    if (!safeBlock) {
      out.push('');
      return;
    }

    const words = safeBlock.split(' ');
    let currentLine = '';

    words.forEach((word) => {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = measureTextWidthPx(candidate, fontSize, fontFamily, 'normal');
      
      if (testWidth > maxWidthPx && currentLine) {
        out.push(currentLine.trim());
        currentLine = word;
      } else {
        currentLine = candidate;
      }
    });

    if (currentLine) out.push(currentLine.trim());
  });

  // Remove leading/trailing empty lines (keep internal empties)
  while (out.length && !out[0]) out.shift();
  while (out.length && !out[out.length - 1]) out.pop();

  return out;
}

// IMPORTANT: We generate raw SVG markup as a string.
// Any user/db-provided text MUST be escaped, otherwise strings like "<br>" will break the SVG
// and the remaining content will render outside with no styles.
function escapeSvgText(input: string): string {
  return (input ?? '')
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHtmlText(input: string): string {
  return (input ?? '')
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Arabic Letter Mark helps keep numbers/dates at the start of an RTL line from jumping to the end.
const ALM = '\u061C';
const rtlSafe = (text: string) => `${ALM}${text ?? ''}`;

// Build SVG-safe mixed-direction text: Arabic stays normal, Latin runs are isolated in LTR tspans
function toMixedDirectionSvgSpans(text: string): string {
  const value = `${text ?? ''}`;
  const ltrRegex = /[A-Za-z0-9][A-Za-z0-9 .,&()_+\/-]*/g;
  const matches = Array.from(value.matchAll(ltrRegex));

  if (!matches.length) return escapeSvgText(value);

  let result = '';
  let lastIndex = 0;

  for (const match of matches) {
    const run = match[0] || '';
    const start = match.index ?? 0;

    if (start > lastIndex) {
      result += escapeSvgText(value.slice(lastIndex, start));
    }

    result += `<tspan direction="ltr" unicode-bidi="embed">${escapeSvgText(run)}</tspan>`;
    lastIndex = start + run.length;
  }

  if (lastIndex < value.length) {
    result += escapeSvgText(value.slice(lastIndex));
  }

  return result;
}

function buildTableTermInlineHtml(tableTerm: NonNullable<PageSectionSettings['tableTerm']>, renderTarget: 'preview' | 'pdf' = 'preview'): { html: string; height: number } {
  return buildTableTermHtml({
    tableTerm,
    title: escapeHtmlText(tableTerm.termTitle || 'البند الثامن:'),
    content: escapeHtmlText(tableTerm.termContent || 'المواقع المتفق عليها بين الطرفين'),
    renderTarget,
  });
}

function buildOriginalPriceInlineSvg(originalPrice: string, discountSettings: DiscountDisplaySettings): string {
  const text = originalPrice || '';
  const fontSize = discountSettings.originalPriceFontSize || 18;
  const strikeWidth = Math.max(Number(discountSettings.strikethroughWidth || 2), 1);
  const strikeColor = discountSettings.strikethroughColor || '#cc0000';
  const textColor = discountSettings.originalPriceColor || '#888888';

  // Use measureTextWidthPx for accurate width
  const measuredW = Math.ceil(measureTextWidthPx(text, fontSize, 'Doran, sans-serif', 400));
  const padX = 8;
  const textW = measuredW + padX * 2;
  const svgH = Math.ceil(fontSize * 1.4);
  const textY = Math.round(svgH * 0.65);
  const strikeY = Math.round(svgH / 2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${textW}" height="${svgH}" viewBox="0 0 ${textW} ${svgH}" style="display: inline-block; vertical-align: middle; overflow: visible;">
    <text x="${textW / 2}" y="${textY}" text-anchor="middle" font-family="Doran, sans-serif" font-size="${fontSize}" fill="${textColor}">${text}</text>
    <line x1="${padX - 2}" y1="${strikeY}" x2="${textW - padX + 2}" y2="${strikeY}" stroke="${strikeColor}" stroke-width="${strikeWidth}" />
  </svg>`;
}


// Replace variables in term content
function replaceVariables(
  text: string, 
  contractData: ContractData,
  contractDetails: any,
  currencyInfo: any,
  billboardsCount: number,
  paymentsHtml: string
): string {
  // نص الخصم - إذا لم يكن موجوداً نتركه فارغاً
  const discountText = contractDetails.discount || '';
  
  // ✅ بناء نص شامل الطباعة والتركيب
  const installationEnabled = contractDetails.installationEnabled !== false;
  const printCostEnabled = contractDetails.printCostEnabled === true;
  
  const inclusionParts: string[] = [];
  if (installationEnabled) {
    inclusionParts.push('شامل التركيب');
  } else {
    inclusionParts.push('غير شامل التركيب');
  }
  if (printCostEnabled) {
    inclusionParts.push('شامل الطباعة');
  } else {
    inclusionParts.push('غير شامل الطباعة');
  }
  const inclusionText = inclusionParts.join(' و');
  
  return text
    .replace(/{duration}/g, contractData.duration)
    .replace(/{startDate}/g, contractData.startDate)
    .replace(/{endDate}/g, contractData.endDate)
    .replace(/{customerName}/g, contractData.customerName)
    .replace(/{contractNumber}/g, contractData.contractNumber)
    .replace(/{totalAmount}/g, contractDetails.finalTotal)
    .replace(/{currency}/g, currencyInfo.writtenName)
    .replace(/{billboardsCount}/g, String(billboardsCount))
    .replace(/{discount}/g, discountText)
 .replace(/{inclusionText}/g, inclusionText) // استبدال متغير شامل/غير شامل
    // NOTE: paymentsHtml may contain <br> etc. We keep it as-is for wrapping,
    // but it MUST be escaped at render time inside SVG text.
    .replace(/{payments}/g, paymentsHtml)
    .replace(/\s{2,}/g, ' ')
    .replace(/\.\s*\./g, '.')
    .trim();
}

// ===== BUILD FIRST PAGE SVG (Contract Terms) - متطابق تماماً مع المعاينة في ContractTermsSettings =====
function buildFirstPageSVG(options: UnifiedPrintOptions): { svg: string; svgHeight: number } {
  const { settings, contractData, terms, contractDetails, currencyInfo, billboards, paymentsHtml } = options;
  
  // نفس المعاينة بالضبط - المعاينة تستخدم textAnchor="end" دائماً للبنود
  const termsX = settings.termsStartX;
  const termsWidth = settings.termsWidth || 2000;
  const lineHeight = settings.termsLineHeight || 65; // نفس المعاينة
  const goldLineSettings = settings.termsGoldLine || { visible: true, heightPercent: 30, color: '#D4AF37' };
  
  let termsSvg = '';
  let currentY = settings.termsStartY;
  const activeTerms = terms.filter(t => t.is_active);

  activeTerms.forEach((term) => {
    const termY = currentY;
    const fontSize = term.font_size || 42;
    const titleText = `${term.term_title}:`;
    const contentText = replaceVariables(term.term_content, contractData, contractDetails, currencyInfo, billboards.length, paymentsHtml);
    const fullText = `${titleText} ${contentText}`;
    const contentLines = wrapText(fullText, termsWidth, fontSize);
    const termHeight = contentLines.length * lineHeight;
    
    // حساب موقع Y التالي بعد هذا البند مع التباعد - نفس المعاينة
    currentY = termY + termHeight + (settings.termsSpacing || 40);

    const goldColor = goldLineSettings.color || '#D4AF37';
    const titleWeight = settings.termsTitleWeight || 'bold';
    const contentWeight = settings.termsContentWeight || 'normal';

    const foX = termsX - termsWidth;

    // الخط الذهبي خلف العنوان فقط - نفس المعاينة بالضبط (بنسبة ارتفاع ديناميكية)
    const heightPercent = goldLineSettings.heightPercent || 30;
    const insetPercent = (100 - heightPercent) / 2;
    const goldHighlight = goldLineSettings.visible !== false 
      ? `<span style="position: absolute; inset: ${insetPercent}% 0 ${insetPercent}% 0; background-color: ${goldColor}; z-index: -1; border-radius: 2px; width: 100%;"></span>`
      : '';

    const titleSpan = `<span style="position: relative; display: inline-block; z-index: 1; margin-left: 6px;">
      ${goldHighlight}
      <span style="position: relative; z-index: 2; font-weight: ${titleWeight === 'bold' || titleWeight === '800' ? 800 : 700}; padding: 0 4px;">${escapeHtmlText(titleText)}</span>
    </span>`;

    // استخدام text-align: justify لضبط نهايات الأسطر وعلاج قفز علامات التنصيص والفواصل في الاتجاه الصحيح
    const htmlContent = `
      <div xmlns="http://www.w3.org/1999/xhtml" style="direction: rtl; text-align: justify; text-justify: inter-word; font-family: Doran, 'Noto Sans Arabic', sans-serif; font-size: ${fontSize}px; line-height: ${lineHeight}px; color: #000; font-weight: ${contentWeight === 'bold' ? 'bold' : 'normal'};">
        ${titleSpan}${escapeHtmlText(contentText)}
      </div>
    `;

    termsSvg += `<foreignObject x="${foX}" y="${termY}" width="${termsWidth}" height="${termHeight + 10}">
      ${htmlContent}
    </foreignObject>`;
  });
  
  // ✅ استخدام ارتفاع ثابت = DESIGN_H مثل المعاينة في ContractTermsSettings
  // المعاينة تستخدم viewBox="0 0 2480 3508" ثابت ولا تغيره
  const svgHeight = DESIGN_H;
  
  // SVG overlay - نفس بنية المعاينة تماماً بدون تغييرات ديناميكية
  const svg = `
    <svg 
      class="overlay-svg" 
      viewBox="0 0 ${DESIGN_W} ${DESIGN_H}" 
      preserveAspectRatio="xMidYMid slice" 
      xmlns="http://www.w3.org/2000/svg" 
      style="position: absolute; inset: 0; width: 100%; height: 100%; z-index: 10;"
    >
      <!-- العنوان الرئيسي - نفس المعاينة -->
      ${settings.header.visible ? `
        <text 
          x="${settings.header.x}" 
          y="${settings.header.y}" 
          font-family="Doran, sans-serif" 
          font-weight="bold" 
          font-size="${settings.header.fontSize}" 
          fill="#000" 
          text-anchor="${settings.header.textAlign || 'middle'}"
          dominant-baseline="middle"
        >${escapeSvgText(
          contractData.isOffer
            ? `عرض سعر رقم: ${contractData.contractNumber}${contractData.yearlyCode ? ` (${contractData.yearlyCode})` : ''} - صالح لمدة 24 ساعة`
            : `عقد إيجار مواقع إعلانية رقم: ${contractData.contractNumber}${contractData.yearlyCode ? ` (${contractData.yearlyCode})` : ''} سنة ${contractData.year}`
        )}</text>
      ` : ''}
      
      <!-- التاريخ - نفس المعاينة -->
      ${settings.date.visible ? `
        <text 
          x="${settings.date.x}" 
          y="${settings.date.y}" 
          font-family="Doran, sans-serif" 
          font-weight="bold" 
          font-size="${settings.date.fontSize}" 
          fill="#000" 
          text-anchor="middle"
          dominant-baseline="middle"
        >التاريخ: ${escapeSvgText(contractData.startDate)}</text>
        <text 
          x="${settings.date.x}" 
          y="${settings.date.y + (settings.date.fontSize || 42) * 1.3}" 
          font-family="Doran, sans-serif" 
          font-weight="bold" 
          font-size="${settings.date.fontSize}" 
          fill="#000" 
          text-anchor="middle"
          dominant-baseline="middle"
        >الموافق: ${(() => { try { const rawDate = contractData.rawStartDate || contractData.startDate; const d = rawDate ? new Date(rawDate) : new Date(); if (isNaN(d.getTime())) { const now = new Date(); const f = new Intl.DateTimeFormat('ar-SA-u-nu-latn', { calendar: 'islamic-umalqura', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Africa/Tripoli' }).format(now); return f.includes('هـ') ? f : f + ' هـ'; } const f = new Intl.DateTimeFormat('ar-SA-u-nu-latn', { calendar: 'islamic-umalqura', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Africa/Tripoli' }).format(d); return f.includes('هـ') ? f : f + ' هـ'; } catch { return ''; } })()}</text>
      ` : ''}
      
       <!-- نوع الإعلان - متطابق مع المعاينة في ContractTermsSettings -->
       ${settings.adType?.visible ? `
         <text 
           x="${settings.adType.x}" 
           y="${settings.adType.y}" 
           font-family="Doran, sans-serif" 
           font-weight="bold" 
           font-size="${settings.adType.fontSize}" 
           fill="#1a1a2e" 
           text-anchor="start"
           dominant-baseline="middle"
           direction="rtl"
           style="unicode-bidi: plaintext;"
         >${escapeSvgText(`نوع الإعلان: ${contractData.adType || 'غير محدد'}`)}</text>
       ` : ''}
       
       <!-- الطرف الأول - نفس المعاينة (fontSize + 4 للعنوان) -->
       ${settings.firstParty.visible ? `
         <g>
           <text 
             x="${settings.firstParty.x}" 
             y="${settings.firstParty.y}" 
             font-family="Doran, sans-serif" 
             font-weight="bold" 
             font-size="${settings.firstParty.fontSize + 4}" 
             fill="#000" 
             text-anchor="${settings.firstParty.textAlign || 'end'}"
             dominant-baseline="middle"
           >${escapeSvgText(`الطرف الأول: ${settings.firstPartyData.companyName}، ${settings.firstPartyData.address}`)}</text>
           <text 
             x="${settings.firstParty.x}" 
             y="${settings.firstParty.y + (settings.firstParty.lineSpacing || 50)}" 
             font-family="Doran, sans-serif" 
             font-size="${settings.firstParty.fontSize}" 
             fill="#000" 
             text-anchor="${settings.firstParty.textAlign || 'end'}"
             dominant-baseline="middle"
           >${escapeSvgText(settings.firstPartyData.representative)}</text>
         </g>
       ` : ''}
       
        <!-- الطرف الثاني - اسم الشركة -->
        ${settings.secondParty.visible ? `
          <g>
             <text 
               x="${settings.secondParty.x}" 
               y="${settings.secondParty.y}" 
               font-family="Doran, sans-serif" 
               font-weight="bold" 
               font-size="${settings.secondParty.fontSize}" 
               fill="#000" 
               text-anchor="start"
               dominant-baseline="middle"
               direction="rtl"
               style="unicode-bidi: plaintext;"
             >${escapeSvgText('الطرف الثاني، ')}${toMixedDirectionSvgSpans(rtlSafe(contractData.customerCompany || contractData.customerName))}</text>
           </g>
        ` : ''}
        
        <!-- الطرف الثاني - اسم الزبون والهاتف -->
        ${settings.secondPartyCustomer?.visible ? `
          <g>
            <text 
              x="${settings.secondPartyCustomer.x}" 
              y="${settings.secondPartyCustomer.y}" 
              font-family="Doran, sans-serif" 
              font-size="${settings.secondPartyCustomer.fontSize}" 
              fill="#000" 
              text-anchor="start"
              dominant-baseline="middle"
              direction="rtl"
              style="unicode-bidi: plaintext;"
            >${escapeSvgText('يمثلها السيد ')}${toMixedDirectionSvgSpans(rtlSafe(contractData.customerName))}${escapeSvgText(' - هاتف: ')}${toMixedDirectionSvgSpans(rtlSafe(contractData.customerPhone || 'غير محدد'))}${settings.secondPartyCustomer?.suffixText ? escapeSvgText(` ${settings.secondPartyCustomer.suffixText}`) : ''}</text>
          </g>
        ` : ''}
      
      <!-- البنود الديناميكية -->
      ${termsSvg}
    </svg>
  `;
  
  return { svg, svgHeight };
}

// ===== BUILD TABLE PAGE HTML (متطابق مع المعاينة في ContractTermsSettings) =====
function buildTablePageHTML(
  billboards: BillboardPrintData[],
  settings: PageSectionSettings,
  tableBgUrl: string,
  pageIndex: number,
  qrDataUrls: Map<string, string>,
  renderTarget: 'preview' | 'pdf' = 'preview'
): string {
  const tblSettings = settings.tableSettings;
  const tableTerm = settings.tableTerm;
  const visibleColumns = tblSettings.columns.filter(col => col.visible);
  const borderWidthPx = Math.max((tblSettings.borderWidth ?? 1) * 0.6, 0.5);
  
  // تحويل mm إلى design px - نفس المعاينة بالضبط (rowHeight * 3.779)
  const topPositionPx = tblSettings.topPosition * MM_TO_DESIGN_PX;
  const rowHeightPx = (tblSettings.rowHeight || 12) * MM_TO_DESIGN_PX;
  const headerRowHeightPx = (tblSettings.headerRowHeight || 14) * MM_TO_DESIGN_PX;
  const cellPaddingPx = tblSettings.cellPadding || 2;
  
  // Table term header (first page only)
  let tableTermHtml = '';
  if (pageIndex === 0 && tableTerm?.visible !== false) {
    const { html: tableTermMarkup, height: termWrapHeight } = buildTableTermInlineHtml(
      tableTerm as NonNullable<PageSectionSettings['tableTerm']>,
      renderTarget
    );
    
    tableTermHtml = `
      <div class="table-term-title-wrap" style="
        text-align: center;
        margin: 0 0 ${tableTerm?.marginBottom ?? 8}px 0;
        padding: 0;
        font-family: 'Doran', sans-serif;
        direction: rtl;
        position: relative;
        left: ${tableTerm?.positionX ?? 0}px;
        top: ${tableTerm?.positionY ?? 0}px;
        height: ${termWrapHeight}px;
        overflow: visible;
        line-height: normal;
        white-space: nowrap;
      ">
        ${tableTermMarkup}
      </div>
    `;
  }
  
  // Header row - نفس المعاينة بالضبط
  const headerCells = visibleColumns.map(col => {
    const isHighlighted = (tblSettings.highlightedColumns || ['index']).includes(col.key);
    const headerBg = isHighlighted ? (tblSettings.highlightedColumnBgColor || '#1a1a2e') : tblSettings.headerBgColor;
    const headerFg = isHighlighted ? (tblSettings.highlightedColumnTextColor || '#ffffff') : tblSettings.headerTextColor;
    
    // نفس المعاينة: fontSize بدون ضرب، استخدام solidFillDataUri لضمان طباعة الألوان
    return `
      <th style="
        width: ${col.width}%;
        padding: ${(col.padding ?? (cellPaddingPx || 2))}px;
        border: ${borderWidthPx}px solid ${tblSettings.borderColor};
        font-size: ${(col.headerFontSize || tblSettings.headerFontSize || 11)}px;
        font-weight: ${tblSettings.headerFontWeight || 'bold'};
        text-align: ${tblSettings.headerTextAlign || 'center'};
        vertical-align: middle;
        line-height: ${(col.lineHeight ?? 1.3)};
        overflow: hidden;
        position: relative;
        background-color: ${headerBg};
        color: ${headerFg};
      ">
        <img src="${solidFillDataUri(headerBg)}" alt="" aria-hidden="true" style="
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 0;
          pointer-events: none;
        " />
        <span style="position: relative; z-index: 1;">${col.label}</span>
      </th>
    `;
  }).join('');
  
  // Data rows - نفس المعاينة بالضبط
  // المعاينة تستخدم: idx % 2 === 1 ? alternateRowColor : white
  // أي الصف الأول (idx=0) أبيض، الصف الثاني (idx=1) متناوب...
  const dataRows = billboards.map((row, rowIndex) => {
    const globalIndex = pageIndex * (tblSettings.maxRows || 12) + rowIndex;
    const rowBgColor = rowIndex % 2 === 1 ? tblSettings.alternateRowColor : 'white';
    
    const cells = visibleColumns.map(col => {
      const isHighlighted = (tblSettings.highlightedColumns || ['index']).includes(col.key);
      // المعاينة: cellBg = isHighlighted ? highlightedColor : undefined (لا تضع backgroundColor للخلايا العادية)
      const cellBg = isHighlighted ? (tblSettings.highlightedColumnBgColor || '#1a1a2e') : undefined;
      const cellTextColor = isHighlighted ? (tblSettings.highlightedColumnTextColor || '#ffffff') : (tblSettings.cellTextColor || '#000000');
      
      // نفس المعاينة: rowHeightPx - 6 للصور
      const imgHeightPx = rowHeightPx - 6;
      const qrSizePx = rowHeightPx - 8;
      
      let cellContent = '';
      const noPadding = col.key === 'image' || col.key === 'location';
      
      switch (col.key) {
        case 'index':
          cellContent = String(globalIndex + 1);
          break;
        case 'code': {
          const codeVal = row.code || row.id || '';
          if (row.isReplacement) {
            cellContent = `
              <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; line-height:1.2;">
                <span style="display:inline-block; background:#1d4ed8; color:#ffffff; font-size:0.85em; font-weight:bold; padding:1px 5px; border-radius:3px;">بديلة</span>
                <span>${codeVal}</span>
              </div>
            `;
          } else if (row.isPaused) {
            cellContent = `
              <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; line-height:1.2;">
                <span style="display:inline-block; background:#dc2626; color:#ffffff; font-size:0.85em; font-weight:bold; padding:1px 5px; border-radius:3px;">موقوفة</span>
                <span style="text-decoration:line-through; opacity:0.85;">${codeVal}</span>
              </div>
            `;
          } else {
            cellContent = codeVal;
          }
          break;
        }
        case 'image':
          // استخدام الصورة الافتراضية إذا لم تكن هناك صورة
          const fallbackSettings: FallbackSettings = settings.fallbackSettings || DEFAULT_FALLBACK_SETTINGS;
          const imageToUse = row.image || (fallbackSettings.useDefaultImage ? fallbackSettings.defaultImageUrl : null);
          
          if (imageToUse) {
            cellContent = `<img src="${imageToUse}" alt="" onerror="this.style.display='none'" style="
              height: ${imgHeightPx}px;
              max-height: ${imgHeightPx}px;
              width: auto;
              object-fit: contain;
              display: block;
              margin: 0 auto;
            " />`;
          }
          break;
        case 'billboardName': {
          const nameVal = row.billboardName || '';
          if (row.isReplacement) {
            const replacedName = row.replacedBillboardName || '';
            cellContent = `
              <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; line-height:1.2;">
                <div style="display:flex; align-items:center; justify-content:center; gap:4px; font-size:0.9em; font-weight:bold;">
                  <span style="display:inline-block; background:#1d4ed8; color:#ffffff; font-size:0.85em; font-weight:bold; padding:1px 6px; border-radius:3px;">بديلة</span>
                  ${replacedName ? `<span>عن: ${replacedName}</span>` : ''}
                </div>
                <span>${nameVal}</span>
              </div>
            `;
          } else if (row.isPaused) {
            cellContent = `
              <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; line-height:1.2;">
                <span style="display:inline-block; background:#dc2626; color:#ffffff; font-size:0.85em; font-weight:bold; padding:1px 6px; border-radius:3px;">موقوفة</span>
                <span style="text-decoration:line-through; opacity:0.85;">${nameVal}</span>
              </div>
            `;
          } else {
            cellContent = nameVal;
          }
          break;
        }
        case 'municipality':
          cellContent = row.municipality || '';
          break;
        case 'district':
          cellContent = row.district || '';
          break;
        case 'name':
          cellContent = row.landmark || '';
          break;
        case 'size':
          cellContent = row.size || '';
          break;
        case 'faces':
          // Convert face count to Arabic text
          const getFaceCountText = (facesCount: any): string => {
            switch (String(facesCount)) {
              case '1': return 'وجه واحد';
              case '2': return 'وجهين';
              case '3': return 'ثلاثة أوجه';
              case '4': return 'أربعة أوجه';
              default: return facesCount || '';
            }
          };
          cellContent = getFaceCountText(row.faces);
          break;
        case 'price':
          // إعدادات عرض التخفيض
          const discountSettings: DiscountDisplaySettings = settings.discountDisplay || DEFAULT_DISCOUNT_DISPLAY;
          
          // ✅ FIX: إظهار الخصم إذا كان هناك خصم فعلي (hasDiscount && originalPrice)
          // حتى لو كان enabled=false في الإعدادات، نعرض الخصم إذا وجد
          const hasOriginal = !!(row.hasDiscount && row.originalPrice);
          const hasPrePause = !!(row.prePausePrice && row.prePausePrice !== row.price && row.prePausePrice !== row.originalPrice);
          if (hasOriginal || hasPrePause) {
            const originalPriceSvg = hasOriginal ? buildOriginalPriceInlineSvg(row.originalPrice!, discountSettings) : '';
            const prePausePriceSvg = hasPrePause ? buildOriginalPriceInlineSvg(row.prePausePrice!, discountSettings) : '';
            cellContent = `
              <div class="original-price-wrap" style="display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; gap: 0; padding: 0; margin: 0;">
                ${hasOriginal ? `<span style="display: block; line-height: 0; margin: 0; padding: 0;">${originalPriceSvg}</span>` : ''}
                ${hasPrePause ? `<span style="display: block; line-height: 0; margin: 0; padding: 0;">${prePausePriceSvg}</span>` : ''}
                <span style="
                  display: block;
                  text-align: center;
                  font-size: ${discountSettings.discountedPriceFontSize || 24}px;
                  color: ${discountSettings.discountedPriceColor || '#000000'};
                  font-weight: bold;
                  line-height: 1.05;
                  margin: 0;
                  padding: 0;
                ">${row.price || ''}</span>
              </div>
            `;
          } else {
            cellContent = row.price || '';
          }
          break;
        case 'endDate': {
          const formattedEndDate = formatLongArabicDate(row.rent_end_date || '');
          const formattedReplacementStartDate = formatLongArabicDate(row.replacementStartDate || '');
          if (row.isReplacement && row.replacementStartDate) {
            cellContent = `
              <div style="display:flex; flex-direction:column; align-items:center; gap:1px;">
                <span style="font-size:0.85em;">من ${formattedReplacementStartDate || row.replacementStartDate}</span>
                <span>إلى ${formattedEndDate || row.rent_end_date || ''}</span>
              </div>
            `;
          } else {
            cellContent = `
              <div style="font-weight: ${row.isEndDateCustom ? 'bold' : 'normal'};">
                ${formattedEndDate || row.rent_end_date || ''}
              </div>
              ${row.isEndDateCustom ? `
                <div style="
                  font-size: 16px;
                  color: #b8860b;
                  background: #fdfbf7;
                  border: 1px solid #e6d3a5;
                  padding: 2px 6px;
                  border-radius: 4px;
                  display: inline-block;
                  margin-top: 4px;
                  font-weight: bold;
                  font-family: 'Doran', 'Tajawal', sans-serif;
                  line-height: 1;
                  white-space: nowrap;
                ">
                  تاريخ مخصص
                </div>
              ` : ''}
            `;
          }
          break;
        }
        case 'durationDays':
          cellContent = row.duration_days || '';
          break;
        case 'location':
          // استخدام رابط قوقل ماب الافتراضي إذا لم يكن هناك رابط
          const fallbackSettingsQR: FallbackSettings = settings.fallbackSettings || DEFAULT_FALLBACK_SETTINGS;
          const gpsLinkToUse = row.gpsLink || (fallbackSettingsQR.useDefaultQR ? fallbackSettingsQR.defaultGoogleMapsUrl : null);
          
          if (gpsLinkToUse) {
            const qrUrl = qrDataUrls.get(gpsLinkToUse);
            if (qrUrl) {
              cellContent = `<a href="${gpsLinkToUse}" target="_blank" rel="noopener" style="display:block;">
                <img src="${qrUrl}" alt="QR" style="width:${qrSizePx}px; height:${qrSizePx}px; object-fit:contain; display:block; margin:0 auto;" />
              </a>`;
            }
          }
          break;
        default:
          cellContent = '';
      }
      
      // نفس المعاينة: استخدام solidFillDataUri للأعمدة المميزة فقط
      const bgImageHtml = isHighlighted && cellBg ? `
        <img src="${solidFillDataUri(cellBg)}" alt="" aria-hidden="true" style="
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 0;
          pointer-events: none;
        " />
      ` : '';
      
      const colPadding = col.padding ?? cellPaddingPx;
      const lineHeight = col.lineHeight ?? 1.3;

      return `
        <td style="
          border: ${borderWidthPx}px solid ${tblSettings.borderColor};
          padding: ${noPadding ? 0 : colPadding}px;
          text-align: ${col.textAlign || tblSettings.cellTextAlign || 'center'};
          font-size: ${(col.fontSize || tblSettings.fontSize || 10)}px;
          font-weight: ${tblSettings.fontWeight || 'normal'};
          ${cellBg ? `background-color: ${cellBg};` : ''}
          color: ${cellTextColor};
          vertical-align: middle;
          line-height: ${lineHeight};
          white-space: normal;
          word-break: break-word;
          overflow: hidden;
          ${cellBg ? 'position: relative;' : ''}
        ">
          ${bgImageHtml}
          <div style="position: relative; z-index: 1; line-height: ${lineHeight}; white-space: normal; word-break: break-word;">${cellContent}</div>
        </td>
      `;
    }).join('');
    
    return `<tr style="min-height: ${rowHeightPx}px; height: auto; background-color: ${rowBgColor};">${cells}</tr>`;
  }).join('');
  
  const tableLeftMargin = (100 - (tblSettings.tableWidth || 90)) / 2;
  
  return `
    <div class="contract-preview-container" style="
      position: relative;
      width: ${DESIGN_W}px;
      height: ${DESIGN_H}px;
      overflow: hidden;
      background: white;
    ">
      <img src="${tableBgUrl}" alt="خلفية جدول اللوحات" style="
        position: absolute;
        top: 0;
        left: 0;
        width: ${DESIGN_W}px;
        height: ${DESIGN_H}px;
        object-fit: cover;
        z-index: 1;
      " onerror="console.warn('Failed to load table background')" />
      
      <div style="
        position: absolute;
        top: ${topPositionPx}px;
        left: ${tableLeftMargin}%;
        width: ${tblSettings.tableWidth || 90}%;
        z-index: 20;
      ">
        ${tableTermHtml}
        
        <table dir="rtl" style="
          width: 100%;
          border-collapse: collapse;
          border-spacing: 0;
          font-size: ${tblSettings.fontSize}px;
          font-family: 'Doran', 'Noto Sans Arabic', Arial, sans-serif;
          table-layout: fixed;
        ">
          <colgroup>
            ${visibleColumns.map(col => `<col style="width: ${col.width}%;" />`).join('')}
          </colgroup>
          <thead>
            <tr style="height: ${headerRowHeightPx}px;">
              ${headerCells}
            </tr>
          </thead>
          <tbody>
            ${dataRows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ===== MAIN PRINT FUNCTION =====
export async function generateUnifiedPrintHTML(options: UnifiedPrintOptions): Promise<string> {
  const { settings, contractData, billboards, templateBgUrl, noStampBgUrl, tableBgUrl, noStampTableBgUrl, renderTarget = 'preview' } = options;
  const effectiveBgUrl = noStampBgUrl || templateBgUrl;
  const effectiveTableBgUrl = noStampTableBgUrl || tableBgUrl;
  const embeddedBgUrl = await rasterizeSvgToDataUrl(effectiveBgUrl);
  const embeddedTableBgUrl = await rasterizeSvgToDataUrl(effectiveTableBgUrl);
  const rowsPerPage = settings.tableSettings.maxRows || 12;
  
  // Generate QR codes for all billboards
  const qrDataUrls = new Map<string, string>();
  const qrFg = settings.tableSettings.qrForegroundColor || '#000000';
  const qrBg = settings.tableSettings.qrBackgroundColor || '#ffffff';
  const fallbackSettings: FallbackSettings = settings.fallbackSettings || DEFAULT_FALLBACK_SETTINGS;
  
  for (const billboard of billboards) {
    // استخدام رابط GPS الموجود أو الرابط الافتراضي
    const gpsLink = billboard.gpsLink || (fallbackSettings.useDefaultQR ? fallbackSettings.defaultGoogleMapsUrl : null);
    if (gpsLink && !qrDataUrls.has(gpsLink)) {
      const qrUrl = await generateQRDataUrl(gpsLink, qrFg, qrBg, 150);
      qrDataUrls.set(gpsLink, qrUrl);
    }
  }
  
  // Build first page
  const { svg: firstPageSVG } = buildFirstPageSVG(options);
  const firstPageHTML = `
    <div class="contract-preview-container" style="
      position: relative;
      width: ${DESIGN_W}px;
      height: ${DESIGN_H}px;
      overflow: hidden;
      background: white;
    ">
      <img src="${embeddedBgUrl}" alt="قالب العقد" crossorigin="anonymous" referrerpolicy="no-referrer" style="
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        z-index: 0;
        display: block;
      " />
      ${firstPageSVG}
    </div>
  `;
  
  // Split billboards into pages - only create pages if there are billboards
  const billboardPages: BillboardPrintData[][] = [];
  if (billboards.length > 0) {
    for (let i = 0; i < billboards.length; i += rowsPerPage) {
      billboardPages.push(billboards.slice(i, i + rowsPerPage));
    }
  }
  
  // Build table pages - filter out empty pages
  const tablePages = billboardPages
    .filter(pageBillboards => pageBillboards.length > 0)
    .map((pageBillboards, pageIndex) => 
      buildTablePageHTML(pageBillboards, settings, embeddedTableBgUrl, pageIndex, qrDataUrls, renderTarget)
    );
  
  // Collect styles from page
  const stylesHtml = typeof document !== 'undefined' 
    ? Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map((n) => (n as HTMLElement).outerHTML)
        .join('\n')
    : '';
  
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  
  // تحويل A4 إلى px - استخدام قيمة ثابتة مضروبة في 1.5 كما طلب المستخدم
  const a4WidthPx = (210 / 25.4) * 96;
  const printScale = a4WidthPx / DESIGN_W;
  
  // ✅ حساب عدد اللوحات لكل مقاس
  const sizeCounts: Record<string, number> = {};
  billboards.forEach(b => {
    const size = b.size || 'غير محدد';
    sizeCounts[size] = (sizeCounts[size] || 0) + 1;
  });
  // ✅ استبدال x بـ × (علامة الضرب العربية) لتجنب مشاكل اتجاه النص
  // واستخدام LRI/PDI لعزل الأرقام والمقاسات
  const LRI = '\u2066'; // Left-to-Right Isolate
  const PDI = '\u2069'; // Pop Directional Isolate
  const sizesSummary = Object.entries(sizeCounts)
    .map(([size, count]) => `${LRI}${count} ${size.replace(/x/gi, '×')}${PDI}`)
    .join(' + ');
  
  // ✅ بناء العنوان مع الكود السنوي وتفاصيل المقاسات
  const yearlyCodePart = contractData.yearlyCode ? ` ${LRI}(${contractData.yearlyCode})${PDI}` : '';
  const titleText = `${contractData.isOffer ? 'عرض سعر' : 'عقد'} ${LRI}#${contractData.contractNumber}${PDI}${yearlyCodePart} • ${contractData.adType || 'غير محدد'} • ${contractData.customerName} • ${sizesSummary || `${contractData.billboardsCount || 1} لوحة`} • ${contractData.currencyName || ''}`;
  
  return `
    <!DOCTYPE html>
    <html dir="ltr">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <base href="${origin}/" />
      <title>${titleText}</title>
      ${stylesHtml}
      <style>
        :root { --print-scale: ${printScale}; }

        /* ===== منع Chrome من إضافة --print-scale داخلي ===== */
        @page { 
          size: A4 portrait; 
          margin: 0 !important; 
        }
        
        html, body { 
          width: 210mm !important; 
          max-width: 210mm !important;
          height: auto !important; 
          margin: 0 !important; 
          padding: 0 !important; 
          background: white !important;
          overflow-x: hidden !important;
        }
        
        /* قفل صارم لجميع العناصر */
        *, *::before, *::after { 
          box-sizing: border-box !important;
          -webkit-print-color-adjust: exact !important; 
          print-color-adjust: exact !important; 
          color-adjust: exact !important; 
        }

        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&family=Noto+Sans+Arabic:wght@400;700;900&family=Manrope:wght@400;600;700&display=swap');

        @font-face {
          font-family: 'Doran';
          src: url('${origin}/Doran-Regular.otf') format('opentype');
          font-weight: 400;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'Doran';
          src: url('${origin}/Doran-Bold.otf') format('opentype');
          font-weight: 700;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'Manrope';
          src: url('${origin}/Manrope-Regular.otf') format('opentype');
          font-weight: 400;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'Manrope';
          src: url('${origin}/Manrope-Bold.otf') format('opentype');
          font-weight: 700;
          font-style: normal;
          font-display: swap;
        }

        body { font-family: 'Doran', 'Tajawal', sans-serif; direction: ltr; }

        /* صفحة طباعة A4 فعلية، لتفادي تجزئة العنصر إلى أكثر من صفحة */
        .print-page {
          width: 210mm !important;
          max-width: 210mm !important;
          min-width: 210mm !important;
          height: 297mm !important;
          max-height: 297mm !important;
          min-height: 297mm !important;
          position: relative;
          overflow: hidden !important;
          direction: ltr;
          page-break-after: always;
          page-break-inside: avoid;
          box-sizing: border-box !important;
          background: white;
        }

        .print-page:last-child {
          page-break-after: avoid !important;
        }
        
        /* منع أي overflow يسبب صفحة بيضاء إضافية */
        body::after {
          content: none !important;
          display: none !important;
        }

        /* نطبع نفس تصميم المعاينة (2480×3508) لكن نُصغّره ليلائم A4 */
        .print-page .contract-preview-container {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          right: auto !important;
          width: ${DESIGN_W}px !important;
          height: ${DESIGN_H}px !important;
          max-width: ${DESIGN_W}px !important;
          max-height: ${DESIGN_H}px !important;
          /* للشاشة نستخدم transform فقط */
          transform: scale(var(--print-scale)) !important;
          transform-origin: top left !important;
          margin: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          direction: ltr;
          overflow: visible !important;
        }

        /* منع تحجيم الصور بشكل غير متوقع */
        .contract-preview-container img { 
          max-width: none !important; 
          max-height: 100% !important;
        }
        
        /* قفل الجدول داخل contract-preview-container */
        .contract-preview-container table {
          width: 100% !important;
          max-width: 100% !important;
          table-layout: fixed !important;
          border-collapse: collapse !important;
        }
        
        .contract-preview-container td,
        .contract-preview-container th {
          overflow: hidden !important;
          word-break: break-word !important;
        }
        
        /* للشاشة فقط */
        @media screen {
          .print-page {
            transform-origin: top left;
            margin: 20px auto;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
          }
        }

        /* ضمان ظهور الألوان والخلفيات في الطباعة */
        .contract-preview-container,
        .contract-preview-container * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }

        /* ضمان ظهور خلفيات الجدول */
        table, thead, tbody, tr, th, td {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }

        th, td {
          background-color: inherit !important;
        }

        @media screen {
          body {
            background: #f0f0f0;
            padding: 20px;
          }
          .print-page {
            background: white;
            margin: 20px auto;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
          }
        }

        @media print {
          /* ===== قواعد الطباعة الأساسية ===== */
          html, body { 
            width: 210mm !important; 
            max-width: 210mm !important;
            min-width: 210mm !important;
            height: auto !important; 
            margin: 0 !important; 
            padding: 0 !important;
            background: white !important;
            overflow: visible !important;
          }
          
          .print-page {
            width: 210mm !important;
            max-width: 210mm !important;
            min-width: 210mm !important;
            height: 297mm !important;
            max-height: 297mm !important;
            min-height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            overflow: hidden !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
          }
          
          .print-page:last-child {
            page-break-after: avoid !important;
            margin-bottom: 0 !important;
            padding-bottom: 0 !important;
          }
          
          /* منع صفحة فارغة بعد آخر صفحة */
          body {
            height: auto !important;
          }
          
          body::after,
          html::after {
            content: none !important;
            display: none !important;
          }
          
          .print-page .contract-preview-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${DESIGN_W}px !important;
            height: ${DESIGN_H}px !important;
            max-width: none !important;
            max-height: none !important;
            /* مهم: zoom يغيّر حجم الـ layout ويمنع Chrome من عمل تصغير إضافي عند تعدد الصفحات */
            zoom: var(--print-scale) !important;
            transform: none !important;
            transform-origin: top left !important;
            overflow: visible !important;
          }
          
          /* ===== قفل الجدول لمنع overflow وهمي ===== */
          .contract-preview-container table {
            width: 100% !important;
            max-width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
          }
          
          .contract-preview-container col, 
          .contract-preview-container colgroup {
            max-width: 100% !important;
          }
          
          .contract-preview-container td,
          .contract-preview-container th {
            max-width: 100% !important;
            overflow: hidden !important;
            text-overflow: clip !important;
            word-break: break-word !important;
            overflow-wrap: anywhere !important;
          }
          
          /* ===== منع الصور من كسر الحدود ===== */
          .contract-preview-container td img, 
          .contract-preview-container td svg, 
          .contract-preview-container th img, 
          .contract-preview-container th svg {
            max-width: 100% !important;
            max-height: 100% !important;
            display: block !important;
          }
        }
      </style>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
    </head>
    <body>
      <div class="print-page">
        ${firstPageHTML}
      </div>
      ${tablePages.length > 0 ? tablePages.map((page, idx) => `<div class="print-page${idx === tablePages.length - 1 ? ' last-table-page' : ''}">${page}</div>`).join('') : ''}
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
              const dynamicScale = measuredA4WidthPx / ${DESIGN_W};
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
}

// ===== OPEN PRINT WINDOW =====
export async function openUnifiedPrintWindow(htmlContent: string, title?: string): Promise<void> {
  const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
  showPrintPreview(htmlContent, title || 'طباعة العقد');
}
