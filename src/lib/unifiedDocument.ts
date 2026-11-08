import { readablePrintColor } from './printColorContrast';
import { unifiedHeaderHtml, unifiedHeaderFooterCss } from './unifiedInvoiceBase';

/**
 * المستند الموحد — نمط طباعة واحد لكل الفواتير والإيصالات والكشوفات
 * ------------------------------------------------------------------
 * مأخوذ من "كشف المستحقات المتأخرة" في تنبيهات الزبائن:
 * رأس (العنوان + الشعار) ← شبكة بيانات ← شريط الإجمالي ← جداول الأقسام ← ملخص ← ملاحظة ← تذييل.
 *
 * كل الألوان تُقرأ من إعدادات الطباعة (صفحة "تصميم الطباعة") لنوع المستند:
 *   primaryColor            → العنوان، خط الرأس، عناوين الأقسام
 *   tableHeaderBg/TextColor → رأس الجداول
 *   tableBorderColor        → الحدود والبطاقات
 *   tableRowEven/OddColor   → تظليل الصفوف
 *   totalBg/TextColor       → شريط الإجمالي
 *   customerSection*        → بطاقات البيانات
 *   subtotalBg/TextColor    → صفوف المجاميع والملخص
 *   notesBg/Text/Border     → الملاحظة
 *   footerTextColor         → التذييل
 *
 * لا يبني أي مستند تصميمه بنفسه: يمرّر العنوان والبيانات فقط.
 */

export type DocStyles = Record<string, any>;
export type DocAlign = 'right' | 'center' | 'left';

export interface DocInfoItem { label: string; value: string | number }
export interface DocColumn { key: string; header: string; width?: string; align?: DocAlign; format?: (v: any) => string }
export interface DocTableSection {
  kind?: 'table';
  title?: string;
  /** نص صغير بجانب عنوان القسم (مثل مجموع القسم) */
  aside?: string;
  columns: DocColumn[];
  rows: Record<string, any>[];
  /** صف مجموع اختياري أسفل الجدول (مفاتيح الأعمدة أو خلية ممتدة) */
  footer?: { label: string; value: string; labelSpan?: number }[];
  empty?: string;
  /** صنف إضافي لغلاف القسم (تستخدمه مفاتيح نافذة المعاينة) */
  className?: string;
  tableClass?: string;
}
export interface DocHtmlSection { kind: 'html'; title?: string; aside?: string; html: string; className?: string }
export type DocSection = DocTableSection | DocHtmlSection;

export interface UnifiedDoc {
  /** العنوان — الشيء الوحيد الذي يختلف بين المستندات */
  title: string;
  subtitle?: string;
  /** عنوان نافذة المتصفح / اسم الملف */
  pageTitle?: string;
  /** بيانات المستند تحت العنوان في الرأس (الرقم، التاريخ...). إن لم تُحدد تُستخرج من info تلقائياً */
  meta?: DocInfoItem[];
  info?: DocInfoItem[];
  total?: { label: string; value: string };
  sections?: DocSection[];
  /** صندوق المطابقة: آخر سطر يُبرز */
  summary?: { label: string; value: string }[];
  amountWords?: string;
  notes?: string | string[];
  signatures?: { label: string; value?: string }[];
  /** محتوى حر يضاف قبل الملاحظات (صور الحوالات، الحسابات المصرفية...) */
  html?: string;
}

export const escHtml = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export const docMoney = (n: number, currency = 'د.ل') =>
  `${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;

export const docDate = (d?: string | Date | null) => {
  if (!d) return '—';
  const x = d instanceof Date ? d : new Date(d);
  return isNaN(x.getTime()) ? String(d) : x.toLocaleDateString('ar-LY-u-nu-latn');
};

const color = (...vals: unknown[]): string => {
  for (const v of vals) if (typeof v === 'string' && v.trim() && v !== 'transparent' && v !== 'inherit') return v;
  return '';
};

/** يحوّل أي صيغة إعدادات (camelCase من الجسر، ResolvedPrintStyles، صف print_settings) إلى لوحة ألوان واحدة */
export function docPalette(s: DocStyles = {}) {
  const primary = color(s.primaryColor, s.primary_color, '#1f2937');
  const headBg = color(s.tableHeaderBgColor, s.tableHeaderBg, s.table_header_bg_color, '#f3f4f6');
  const totalBg = color(s.totalBgColor, s.totalBg, s.summary_bg_color, primary);
  const subtotalBg = color(s.subtotalBgColor, s.subtotalBg, s.totals_box_bg_color, '#f9fafb');
  const infoBg = color(s.customerSectionBgColor, s.customerBg, s.customer_section_bg_color, '#ffffff');
  const notesBg = color(s.notesBgColor, s.notesBg, s.notes_bg_color, '#fffbeb');
  return {
    primary,
    headBg,
    headText: readablePrintColor(headBg, color(s.tableHeaderTextColor, s.tableHeaderText, s.table_header_text_color, '#374151')),
    border: color(s.tableBorderColor, s.tableBorder, s.table_border_color, '#e5e7eb'),
    rowEven: color(s.tableRowEvenColor, s.tableRowEven, s.table_row_even_color, '#fafafa'),
    rowOdd: color(s.tableRowOddColor, s.tableRowOdd, s.table_row_odd_color, '#ffffff'),
    text: color(s.tableTextColor, s.tableText, s.table_text_color, '#1f2937'),
    totalBg,
    totalText: readablePrintColor(totalBg, color(s.totalTextColor, s.totalText, s.summary_text_color, '#ffffff')),
    subtotalBg,
    subtotalText: readablePrintColor(subtotalBg, color(s.subtotalTextColor, s.subtotalText, s.totals_box_text_color, '#111827')),
    infoBg,
    infoBorder: color(s.customerSectionBorderColor && s.customerSectionBorderColor !== primary ? s.customerSectionBorderColor : '', s.tableBorderColor, s.tableBorder, '#e5e7eb'),
    infoText: readablePrintColor(infoBg, color(s.customerSectionTextColor, s.customerText, s.customer_text_color, '#111827')),
    notesBg,
    notesText: readablePrintColor(notesBg, color(s.notesTextColor, s.notesText, s.notes_text_color, '#78350f')),
    notesBorder: color(s.notesBorderColor, s.notesBorder, s.notes_border_color, '#f59e0b'),
    footerText: color(s.footerTextColor, s.footer_text_color, '#9ca3af'),
    font: color(s.fontFamily, s.font_family, 'Doran'),
    bodySize: Number(s.bodyFontSize || s.body_font_size) || 12,
  };
}

const origin = () => (typeof window !== 'undefined' ? window.location.origin : '');

export function docLogoUrl(s: DocStyles = {}): string {
  if (s.showLogo === false || s.show_logo === false) return '';
  const path = s.fullLogoUrl || s.logoUrl || s.logoPath || s.logo_path || '/logofaresgold.svg';
  return /^(https?:|data:)/.test(path) ? path : `${origin()}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** CSS النمط الموحد. يغطي أيضاً الأصناف القديمة (items-table, customer-section...) حتى تتطابق المستندات القديمة */
export function unifiedDocumentCss(s: DocStyles = {}): string {
  const p = docPalette(s);
  const o = origin();
  const logoSize = Math.min(Math.max(Number(s.logoSize || s.logo_size) || 160, 60), 200);
  // كل مستند يحمل رأس os-head يُعامل بنفس النمط حتى لو بنى <body> بنفسه
  const D = 'body:has(.os-mark)';
  const TABLES = ':is(.os-t, .items-table, .billboards-table, .movements-table, .rental-table, .measurements-table)';
  return `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700;900&display=swap');
  @font-face { font-family: 'Doran'; src: url('${o}/Doran-Regular.otf') format('opentype'); font-weight: 400; }
  @font-face { font-family: 'Doran'; src: url('${o}/Doran-Bold.otf') format('opentype'); font-weight: 700; }
  @page { size: A4 portrait; margin: 10mm; }
  ${D} * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
  ${D} { font-family: '${p.font}', 'Noto Sans Arabic', Arial, sans-serif !important; direction: rtl; color: ${p.text}; background: #fff; line-height: 1.55; font-size: ${p.bodySize}px; margin: 0; }
  .os-root { max-width: 210mm; margin: 0 auto; padding: 28px; background: #fff; }
  .os-root { min-height: 297mm; display: flex; flex-direction: column; }
  .os-root > .u-footer { margin-top: auto !important; padding-top: 14px !important; }
  @media print { .os-root { padding: 0; max-width: none; min-height: 0; display: block; } }

  .os-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 3px solid ${p.primary}; padding-bottom: 14px; margin-bottom: 18px; break-inside: avoid; }
  .os-head.swap { flex-direction: row-reverse; }
  .os-head img { max-width: ${logoSize}px; max-height: ${Math.round(logoSize * 0.6)}px; height: auto; object-fit: contain; }
  .os-title { font-size: 24px; font-weight: 900; color: ${p.primary}; margin: 0; line-height: 1.35; }
  .os-sub { font-size: 12px; color: #6b7280; margin-top: 2px; }
  .os-company { font-size: 11px; color: #6b7280; margin-top: 4px; }

  .os-info { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin-bottom: 16px; break-inside: avoid; }
  .os-info > div { border: 1px solid ${p.infoBorder}; background: ${p.infoBg}; border-radius: 8px; padding: 8px 10px; min-width: 0; }
  .os-info span { display: block; font-size: 10px; color: #6b7280; font-weight: 700; }
  .os-info b { display: block; font-size: 14px; font-weight: 900; color: ${p.infoText}; overflow-wrap: anywhere; }

  .os-total { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: ${p.totalBg}; color: ${p.totalText}; border-radius: 10px; padding: 14px 18px; margin-bottom: 18px; break-inside: avoid; }
  .os-total .lbl { font-size: 14px; font-weight: 700; opacity: .9; }
  .os-total .amt { font-size: 28px; font-weight: 900; white-space: nowrap; }

  .os-section { font-size: 15px; font-weight: 900; color: ${p.primary}; margin: 18px 0 8px; display: flex; justify-content: space-between; align-items: baseline; gap: 8px; break-after: avoid; }
  .os-section small { font-size: 12px; color: #6b7280; font-weight: 700; }

  ${TABLES} { width: 100% !important; border-collapse: collapse !important; font-size: ${p.bodySize}px !important; margin: 0 0 10px !important; border-radius: 0 !important; overflow: visible !important; }
  ${TABLES} thead { display: table-header-group; }
  ${TABLES} tr { break-inside: avoid; }
  ${D} ${TABLES} th { background: ${p.headBg} !important; color: ${p.headText} !important; font-weight: 800; padding: 8px 6px !important; border: 1px solid ${p.border} !important; text-align: center; }
  ${D} ${TABLES} td { padding: 7px 6px !important; border: 1px solid ${p.border} !important; text-align: center; vertical-align: middle; color: ${p.text}; overflow-wrap: anywhere; }
  ${D} ${TABLES} tbody tr:nth-child(odd) { background: ${p.rowOdd} !important; }
  ${D} ${TABLES} tbody tr:nth-child(even) { background: ${p.rowEven} !important; }
  ${D} ${TABLES} :is(tfoot td, tr.subtotal-row td) { font-weight: 900; background: ${p.subtotalBg} !important; color: ${p.subtotalText} !important; }
  ${D} ${TABLES} tr.grand-total-row td { font-weight: 900; background: ${p.totalBg} !important; color: ${p.totalText} !important; }
  ${D} ${TABLES} tr.payment-group td { font-weight: 800; }
  .os-t td.r, .os-t th.r { text-align: right; }
  .os-t td.l, .os-t th.l { text-align: left; }
  .os-amt { font-weight: 900; color: ${p.primary}; white-space: nowrap; }
  .os-due { font-weight: 900; color: #b91c1c; white-space: nowrap; }
  .os-days { display: inline-block; padding: 2px 8px; border-radius: 999px; font-weight: 800; font-size: 11px; background: #fee2e2; color: #991b1b; }
  .os-tag { display: inline-block; padding: 2px 8px; border-radius: 6px; font-weight: 800; font-size: 11px; background: #f3f4f6; color: #374151; }
  .os-tag.sales { background: #dcfce7; color: #166534; }
  .os-tag.printed { background: #e0e7ff; color: #3730a3; }
  .os-tag.composite { background: #fef3c7; color: #92400e; }
  .os-muted { color: #6b7280; font-size: 11px; }
  .os-empty { text-align: center; color: #6b7280; padding: 24px 0; }

  .os-recon { margin: -8px auto 18px 0; width: 48%; min-width: 260px; border: 1px solid ${p.border}; border-radius: 8px; overflow: hidden; font-size: 12px; break-inside: avoid; }
  .os-recon div { display: flex; justify-content: space-between; gap: 12px; padding: 6px 12px; border-bottom: 1px solid ${p.border}; }
  .os-recon div:last-child { border-bottom: 0; background: ${p.subtotalBg}; color: ${p.subtotalText}; font-weight: 900; }

  .os-words { margin-top: 12px; font-size: 12px; color: ${p.text}; }
  .os-words b { font-weight: 800; }
  .os-note { margin-top: 18px; border: 1px solid ${p.notesBorder}; background: ${p.notesBg}; color: ${p.notesText}; border-radius: 8px; padding: 10px 14px; font-size: 12px; font-weight: 600; white-space: pre-line; break-inside: avoid; }
  .os-sign { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 28px; margin: 30px 0 10px; text-align: center; break-inside: avoid; }
  .os-sign > div { flex: 1; }
  .os-sign span { font-size: 12px; color: #4b5563; font-weight: 700; }
  .os-sign b { display: block; min-height: 44px; padding-top: 14px; border-bottom: 1px solid #9ca3af; font-size: 12px; font-weight: 600; }
  .os-foot { margin-top: 22px; padding-top: 10px; border-top: 1px solid ${p.border}; display: flex; justify-content: space-between; font-size: 10px; color: #9ca3af; break-inside: avoid; }

  /* ===== أصناف المستندات القديمة: نفس النمط ===== */
  ${D} :is(.customer-section, .customer-info, .info-section, .team-info, .payment-info) { background: ${p.infoBg} !important; color: ${p.infoText} !important; border: 1px solid ${p.infoBorder} !important; border-radius: 8px !important; box-shadow: none !important; padding: 10px 14px !important; margin-bottom: 16px !important; }
  ${D} :is(.customer-label, .info-label, .summary-label, .cost-label) { font-size: 10px !important; color: #6b7280 !important; font-weight: 700 !important; opacity: 1 !important; }
  ${D} .customer-name-text { font-size: 16px !important; font-weight: 900 !important; color: ${p.infoText} !important; }
  ${D} :is(.section-title, .payment-title, .team-title) { color: ${p.primary} !important; font-size: 15px !important; font-weight: 900 !important; background: transparent !important; border: 0 !important; padding: 0 !important; margin: 18px 0 8px !important; }
  ${D} :is(.total-amount, .total-section, .amount-section, .final-balance, .invoice-summary-total) { background: ${p.totalBg} !important; color: ${p.totalText} !important; border: 0 !important; border-radius: 10px !important; box-shadow: none !important; }
  ${D} :is(.total-amount, .total-section, .amount-section, .final-balance, .invoice-summary-total) * { color: ${p.totalText} !important; }
  ${D} :is(.summary-section, .cost-section) { background: #fff !important; border: 1px solid ${p.border} !important; border-radius: 8px !important; box-shadow: none !important; }
  ${D} :is(.notes-section, .notes) { background: ${p.notesBg} !important; color: ${p.notesText} !important; border: 1px solid ${p.notesBorder} !important; border-radius: 8px !important; }
  ${D} .invoice-customer-heading { display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px 14px; }
  ${D} .invoice-customer-details { display: flex; flex-wrap: wrap; gap: 4px 18px; margin-top: 6px; font-size: 11px; }
  ${D} .invoice-customer-details .stats-cards { margin-inline-start: auto; display: flex; gap: 12px; }
  ${D} .invoice-customer-details :is(.stat-card, .stat-value, .stat-label) { display: inline; font-size: 11px !important; border: 0 !important; padding: 0 !important; }
  /* ===== التذييل الموحد: أيقونات داخل دوائر بلون الإعدادات + رقم الصفحة في إطار ===== */
  .u-closing-message { text-align: center !important; font-size: 11px !important; font-weight: 600; color: #4b5563 !important; margin: 18px 0 8px !important; padding: 0 !important; break-inside: avoid; page-break-inside: avoid; }
  .u-footer { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 16px !important; direction: rtl; border-top: 2px solid ${p.primary} !important; padding: 10px 2px 0 !important; margin: 0 !important; background: transparent !important; font-size: 10.5px !important; line-height: 1.6 !important; color: #374151 !important; break-inside: avoid; page-break-inside: avoid; }
  .u-footer-contacts { display: flex !important; flex: 1; flex-wrap: wrap; align-items: center; justify-content: flex-start !important; gap: 6px 22px !important; }
  .u-footer-contact, .u-page-number { display: inline-flex !important; align-items: center; gap: 6px; white-space: nowrap; color: #374151; }
  .u-fi { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; flex: none; border-radius: 50%; background: color-mix(in srgb, ${p.primary} 12%, #ffffff); color: ${p.primary}; }
  .u-fi svg { width: 12px; height: 12px; display: block; }
  .u-page-number { margin-inline-start: auto; padding: 2px 10px 2px 3px; border: 1px solid ${p.border}; border-radius: 999px; }
  `;
}

const cell = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));

/** يحوّل أسطر "التسمية: القيمة" (بـ <br> أو <div>) إلى بنود بيانات */
export function metaHtmlToInfo(html: string): DocInfoItem[] {
  if (!html || !html.trim()) return [];
  const lines = html
    .replace(/<\/div>/gi, '\n').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<div[^>]*>/gi, '')
    .split('\n').map(l => l.trim()).filter(l => l.replace(/<[^>]*>/g, '').trim());
  return lines.map(line => {
    let inTag = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '<') inTag = true;
      else if (c === '>') inTag = false;
      else if (!inTag && c === ':') {
        const label = line.slice(0, i).replace(/<[^>]*>/g, '').trim();
        const value = line.slice(i + 1).replace(/^(\s|<\/span>)+/, '').trim();
        if (label && value) return { label, value };
      }
    }
    return { label: '', value: line };
  });
}

/** الرأس المعتمد (الأصلي) — نفس unifiedHeaderHtml لكل المستندات */
export function unifiedDocHeadHtml(s: DocStyles, title: string, subtitle?: string, meta: DocInfoItem[] = []): string {
  const latin = subtitle && /^[ -~]+$/.test(subtitle) ? subtitle : '';
  return unifiedHeaderHtml({
    styles: s as any,
    fullLogoUrl: docLogoUrl(s),
    titleAr: title,
    titleEn: latin || s.invoiceTitleEn || '',
    metaLinesHtml: meta.filter(m => String(m.value ?? '').trim()).map(m => `<div class="u-meta-row"><span>${m.label}:</span><strong><bdi>${m.value}</bdi></strong></div>`).join(''),
  });
}

export function unifiedDocInfoHtml(info: DocInfoItem[] = []): string {
  const items = info.filter(i => i && i.value !== undefined && i.value !== null && String(i.value).trim() !== '');
  if (!items.length) return '';
  return `<div class="os-info">${items.map(i => `<div>${i.label ? `<span>${i.label}</span>` : ''}<b>${i.value}</b></div>`).join('')}</div>`;
}

/** التذييل الموحد: رسالة الختام + جهات الاتصال بالأيقونات + رقم الصفحة (التنسيق في unifiedDocumentCss) */
export function unifiedDocFootHtml(styles: DocStyles = {}, pageText = 'صفحة 1 من 1'): string {
  if (styles.showFooter === false || styles.show_footer === false) return '';
  const paths: Record<string, string> = {
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 3a2 2 0 0 1-.6 1.7L7.7 9.7a16 16 0 0 0 6.6 6.6l1.3-1.3a2 2 0 0 1 1.7-.6l3 .5a2 2 0 0 1 1.7 2z"/>',
    address: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 5 9 7 9-7"/>',
    web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18z"/>',
    page: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5"/>',
  };
  const icon = (k: string) => `<i class="u-fi"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[k]}</svg></i>`;
  const contacts = [
    { k: 'phone', v: styles.companyPhone || styles.company_phone, ltr: true },
    { k: 'address', v: styles.companyAddress || styles.company_address },
    { k: 'email', v: styles.companyEmail || styles.company_email, ltr: true },
    { k: 'web', v: styles.companyWebsite || styles.company_website, ltr: true },
  ].filter(c => String(c.v || '').trim());
  const thanks = styles.footerText ?? styles.footer_text;
  const showPage = styles.showPageNumber !== false && styles.show_page_number !== false && pageText.trim();
  return `${thanks ? `<div class="u-closing-message">${escHtml(thanks)}</div>` : ''}
  <div class="u-footer" style="display:flex;justify-content:space-between;align-items:center;">
    <div class="u-footer-contacts">${contacts.map(c => `<span class="u-footer-contact">${icon(c.k)}<bdi${c.ltr ? ' dir="ltr"' : ''}>${escHtml(c.v)}</bdi></span>`).join('')}</div>
    ${showPage ? `<span class="u-page-number">${icon('page')}<span class="u-page-number-text">${escHtml(pageText)}</span></span>` : ''}
  </div>`;
}

function sectionHtml(sec: DocSection): string {
  const head = sec.title ? `<div class="os-section"><span>${sec.title}</span>${sec.aside ? `<small>${sec.aside}</small>` : ''}</div>` : '';
  const wrap = (inner: string) => `<div class="os-sec${sec.className ? ` ${sec.className}` : ''}">${inner}</div>`;
  if (sec.kind === 'html') return wrap(head + sec.html);
  const cols = sec.columns;
  if (!sec.rows.length && sec.empty) return wrap(`${head}<p class="os-empty">${sec.empty}</p>`);
  const alignCls = (a?: DocAlign) => (a === 'right' ? ' class="r"' : a === 'left' ? ' class="l"' : '');
  const thead = cols.map(c => `<th${alignCls(c.align)}${c.width ? ` style="width:${c.width}"` : ''}>${c.header}</th>`).join('');
  const tbody = sec.rows.map((r, idx) => {
    const cls = ` class="${idx % 2 === 0 ? 'even-row' : 'odd-row'}${r._isGroupHeader ? ' payment-group' : r._isSubRow ? ' payment-distribution' : r._className ? ` ${r._className}` : ''}"`;
    return `<tr${cls}>${cols.map(c => `<td${alignCls(c.align)}>${cell(c.format ? c.format(r[c.key]) : r[c.key])}</td>`).join('')}</tr>`;
  }).join('');
  const tfoot = sec.footer?.length
    ? `<tfoot>${sec.footer.map(f => {
        const span = Math.max(1, Math.min(cols.length - 1, f.labelSpan ?? cols.length - 1));
        return `<tr><td colspan="${span}" class="r">${f.label}</td><td colspan="${cols.length - span}">${f.value}</td></tr>`;
      }).join('')}</tfoot>`
    : '';
  return wrap(`${head}<table class="os-t${sec.tableClass ? ` ${sec.tableClass}` : ''}"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody>${tfoot}</table>`);
}

/** جسم المستند (بدون <html>) — للمعاينة داخل الحوارات */
export function unifiedDocBodyHtml(s: DocStyles, doc: UnifiedDoc): string {
  const notes = Array.isArray(doc.notes) ? doc.notes.filter(Boolean).join('\n') : doc.notes;
  // الرقم والتاريخ تحت العنوان في الرأس، وبقية البيانات بطاقات
  const isMeta = (i: DocInfoItem) => /رقم|تاريخ|التاريخ|الفترة/.test(i.label);
  const meta = doc.meta ?? (doc.info || []).filter(isMeta);
  const info = doc.meta ? doc.info : (doc.info || []).filter(i => !isMeta(i));
  return `<div class="os-root os-mark">
    ${unifiedDocHeadHtml(s, doc.title, doc.subtitle, meta)}
    ${unifiedDocInfoHtml(info)}
    ${doc.total ? `<div class="os-total"><span class="lbl">${doc.total.label}</span><span class="amt">${doc.total.value}</span></div>` : ''}
    ${doc.summary?.length ? `<div class="os-recon">${doc.summary.map(r => `<div><span>${r.label}</span><span>${r.value}</span></div>`).join('')}</div>` : ''}
    ${(doc.sections || []).map(sectionHtml).join('')}
    ${doc.amountWords ? `<div class="os-words"><b>المبلغ بالحروف:</b> ${escHtml(doc.amountWords)}</div>` : ''}
    ${doc.html || ''}
    ${notes && notes.trim() ? `<div class="os-note measurements-notes">${escHtml(notes)}</div>` : ''}
    ${doc.signatures?.length ? `<div class="os-sign signature-stamp-section">${doc.signatures.map(x => `<div><span>${x.label}</span><b>${escHtml(x.value || '')}</b></div>`).join('')}</div>` : ''}
    ${unifiedDocFootHtml(s)}
  </div>`;
}

/** مستند HTML كامل جاهز للطباعة / المعاينة */
export function renderUnifiedDocument(s: DocStyles, doc: UnifiedDoc, opts: { autoPrint?: boolean; extraCss?: string; bodyAttrs?: string } = {}): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(doc.pageTitle || doc.title.replace(/<[^>]*>/g, ''))}</title>
  <style>${unifiedHeaderFooterCss(s as any)}${opts.extraCss || ''}</style>
</head>
<body class="os-doc" data-keep-print-colors${opts.bodyAttrs ? ` ${opts.bodyAttrs}` : ''}>
  ${unifiedDocBodyHtml(s, doc)}
  ${opts.autoPrint ? '<script>window.onload=function(){window.print();}</script>' : ''}
</body>
</html>`;
}

/** يجلب إعدادات نوع المستند ثم يفتح معاينة الطباعة الموحدة */
export async function printUnifiedDocument(
  type: import('@/types/invoice-templates').InvoiceTemplateType,
  doc: UnifiedDoc,
  opts: { driveFolder?: string; phone?: string } = {},
): Promise<void> {
  const [{ getMergedInvoiceStylesAsync }, { showPrintPreview }] = await Promise.all([
    import('@/hooks/useInvoiceSettingsSync'),
    import('@/components/print/PrintPreviewDialog'),
  ]);
  const styles = await getMergedInvoiceStylesAsync(type);
  showPrintPreview(renderUnifiedDocument(styles, doc), doc.pageTitle || doc.title, opts.driveFolder, opts.phone);
}
