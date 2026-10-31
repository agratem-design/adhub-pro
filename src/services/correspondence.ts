import { supabase } from '@/integrations/supabase/client';
import frameSvg from '@/assets/letterhead/letterhead-frame.svg?raw';
import logoSvg from '@/assets/letterhead/letterhead-logo.svg?raw';
import watermarkSvg from '@/assets/letterhead/letterhead-watermark.svg?raw';

export interface LetterheadCompany {
  id: string;
  name: string;
  name_en?: string | null;
  logo_url?: string | null;
  stamp_url?: string | null;
  signature_url?: string | null;
  watermark_url?: string | null;
  watermark_opacity?: number | null;
  commercial_register?: string | null;
  addresses: string[];
  phones: string[];
  email?: string | null;
  brand_color: string;
  font_family: string;
  /** خط الأرقام (إن تُرك فارغاً يُستخدم خط الكتابة) */
  number_font?: string | null;
  signer_name?: string | null;
  signer_title?: string | null;
  reference_prefix: string;
  show_watermark: boolean;
  is_default: boolean;
}

export interface Letter {
  id?: string;
  company_id: string;
  reference_number: string;
  letter_date: string;
  recipient?: string | null;
  greeting?: string | null;
  subject?: string | null;
  body: string;
  closing?: string | null;
  signer_name?: string | null;
  signer_title?: string | null;
  with_stamp?: boolean;
  with_signature?: boolean;
  /** letter = مراسلة، report = تقرير دوري */
  kind?: 'letter' | 'report';
  report_period?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  created_at?: string;
}

/** full = الورقة كاملة، background = الترويسة فقط (لطباعة أوراق جاهزة)، text = الكتابة فقط فوق ورق مطبوع مسبقاً */
export type LetterPrintMode = 'full' | 'background' | 'text';
export const PRINT_MODE_LABELS: Record<LetterPrintMode, string> = { full: 'الورقة كاملة', background: 'الخلفية فقط', text: 'الكتابة فقط' };

/** خطوط مناسبة للأرقام */
export const NUMBER_FONTS = ['Roboto', 'Inter', 'Lato', 'Montserrat', 'Poppins', 'Open Sans', 'Source Sans 3', 'Oswald', 'Roboto Mono', 'Tajawal', 'Cairo', 'Almarai'];
export const LETTER_FONTS = ['Tajawal', 'Cairo', 'Almarai', 'Amiri', 'Scheherazade New', 'Noto Kufi Arabic', 'IBM Plex Sans Arabic', 'Readex Pro', 'Changa', 'El Messiri', 'Noto Naskh Arabic', 'Markazi Text', 'Doran'];
/** خطوط غير موجودة في Google Fonts (تعمل إن كانت مثبتة على الجهاز) */
const LOCAL_FONTS = new Set(['Doran']);

export const MISSING_TABLES_MESSAGE = 'جداول المراسلات غير موجودة بعد. طبّق ملف sql/03_correspondence.sql في محرر SQL في سوبابيس ثم أعد تحميل الصفحة.';
export const MISSING_STAMP_COLUMNS = 'لحفظ الختم والتوقيع وشعار الخلفية طبّق ملف sql/04_correspondence_stamp.sql في محرر SQL في سوبابيس.';
const isMissing = (e: any) => /letterhead_companies|letters/.test(String(e?.message || '')) && /does not exist|schema cache|not find/i.test(String(e?.message || ''));
const isMissingColumn = (e: any) => /(stamp_url|signature_url|watermark_url|watermark_opacity|number_font|with_stamp|with_signature|kind|report_period|period_start|period_end)/.test(String(e?.message || ''));
const STAMP_COMPANY_COLS = ['stamp_url', 'signature_url', 'watermark_url', 'watermark_opacity', 'number_font'];
const STAMP_LETTER_COLS = ['with_stamp', 'with_signature', 'kind', 'report_period', 'period_start', 'period_end'];
const omit = (o: Record<string, any>, keys: string[]) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));

export async function loadCompanies(): Promise<LetterheadCompany[]> {
  const { data, error } = await (supabase as any).from('letterhead_companies').select('*').order('is_default', { ascending: false }).order('name');
  if (error) throw new Error(isMissing(error) ? MISSING_TABLES_MESSAGE : error.message);
  return (data || []).map((c: any) => ({ ...c, addresses: c.addresses || [], phones: c.phones || [] }));
}

async function upsert(table: string, payload: Record<string, any>, id: string | undefined, fallbackCols: string[]) {
  const run = (p: Record<string, any>) => id
    ? (supabase as any).from(table).update(p).eq('id', id).select('*').single()
    : (supabase as any).from(table).insert(p).select('*').single();
  let { data, error } = await run(payload);
  let warning: string | null = null;
  if (error && isMissingColumn(error)) {
    const hadValues = fallbackCols.some(k => payload[k] != null && payload[k] !== true);
    ({ data, error } = await run(omit(payload, fallbackCols)));
    if (!error && hadValues) warning = MISSING_STAMP_COLUMNS;
  }
  return { data, error, warning };
}

export async function saveCompany(c: Partial<LetterheadCompany>): Promise<LetterheadCompany & { _warning?: string | null }> {
  const payload = { ...c, updated_at: new Date().toISOString() };
  const { data, error, warning } = await upsert('letterhead_companies', payload, c.id, STAMP_COMPANY_COLS);
  if (error) throw new Error(error.message);
  if (data.is_default) await (supabase as any).from('letterhead_companies').update({ is_default: false }).neq('id', data.id);
  return { ...data, _warning: warning };
}

export async function loadLetters(companyId?: string | null): Promise<Letter[]> {
  let q = (supabase as any).from('letters').select('*').order('letter_date', { ascending: false }).order('created_at', { ascending: false }).limit(500);
  if (companyId) q = q.eq('company_id', companyId);
  const { data, error } = await q;
  if (error) throw new Error(isMissing(error) ? MISSING_TABLES_MESSAGE : error.message);
  return data || [];
}

export async function saveLetter(l: Letter): Promise<Letter> {
  const ref = l.reference_number.trim();
  if (!ref) throw new Error('الرقم الإشاري مطلوب');
  const payload: Record<string, any> = { ...l, reference_number: ref, updated_at: new Date().toISOString() };
  delete payload.created_at;
  const { data, error } = await upsert('letters', payload, l.id, STAMP_LETTER_COLS);
  if (error) {
    if (String(error.message).includes('letters_company_reference_unique')) throw new Error(`الرقم الإشاري ${ref} مستخدم سابقاً لهذه الشركة`);
    throw new Error(error.message);
  }
  return { with_stamp: l.with_stamp, with_signature: l.with_signature, kind: l.kind, report_period: l.report_period, period_start: l.period_start, period_end: l.period_end, ...data };
}

export async function deleteLetter(id: string) {
  const { error } = await (supabase as any).from('letters').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** الرقم الإشاري التالي: البادئة + أكبر رقم مستخدم + 1 (مثل F171 ← F172) */
export function nextReference(prefix: string, letters: Letter[]): string {
  const p = prefix || '';
  let max = 0;
  letters.forEach(l => {
    const m = String(l.reference_number || '').match(/(\d+)\s*$/);
    if (m && String(l.reference_number).startsWith(p)) max = Math.max(max, Number(m[1]));
  });
  return `${p}${max + 1}`;
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
/** يلفّ تسلسلات الأرقام (مثل 14/10/2025 أو 091.322.8908) بخط الأرقام */
const nums = (html: string) => html.replace(/[0-9\u0660-\u0669]+(?:[.,/:\-][0-9\u0660-\u0669]+)*/g, m => `<x-n>${m}</x-n>`);
const abs = (url: string | null | undefined, origin: string) => !url ? '' : /^(https?:|data:|blob:)/.test(url) ? url : `${origin}${url.startsWith('/') ? '' : '/'}${url}`;

/* ---------- تلوين القالب بلون الشركة ---------- */
type HSL = [number, number, number];
function rgbToHsl(r: number, g: number, b: number): HSL {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}
function hexToRgb(hex: string): [number, number, number] | null {
  const m = String(hex || '').trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}
const TEMPLATE_GOLD = rgbToHsl(0.834, 0.703, 0.206);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const recolorCache = new Map<string, string>();
/** يستبدل درجات الذهبي في القالب بدرجات لون الشركة مع الحفاظ على التدرّج */
function recolorFrame(brand: string): string {
  const rgb = hexToRgb(brand);
  if (!rgb) return frameSvg;
  const key = brand.toLowerCase();
  if (recolorCache.has(key)) return recolorCache.get(key)!;
  const [bh, bs, bl] = rgbToHsl(...rgb);
  const [gh, gs, gl] = TEMPLATE_GOLD;
  const out = frameSvg.replace(/rgb\(([\d.]+)%,\s*([\d.]+)%,\s*([\d.]+)%\)/g, (all, r, g, b) => {
    const [h, s, l] = rgbToHsl(+r / 100, +g / 100, +b / 100);
    if (s < 0.2) return all; // رمادي/أبيض/أسود يبقى كما هو
    const w = clamp01(s / gs);
    const nh = (bh + (h - gh) + 360) % 360;
    const ns = clamp01(s * (bs / gs));
    const nl = clamp01(l + (bl - gl) * w);
    const [nr, ng, nb] = hslToRgb(nh, ns, nl);
    return `rgb(${(nr * 100).toFixed(2)}%, ${(ng * 100).toFixed(2)}%, ${(nb * 100).toFixed(2)}%)`;
  });
  recolorCache.set(key, out);
  return out;
}

/* ---------- أبعاد القالب (بالنقطة pt، صفحة A4 = 595.28 × 841.89) ---------- */
const PAGE_W = 595.276;
const BODY = { top: 150, side: 28, bottomWithSign: 648, bottomPlain: 748 };
const box = (left: number, right: number, cy: number, h = 18) => `left:${left}pt;width:${right - left}pt;top:${cy - h / 2}pt;height:${h}pt;line-height:${h}pt;`;

export interface RenderOptions {
  mode?: LetterPrintMode;
  /** ترك اليوم والشهر فارغين للكتابة اليدوية مع إبقاء السنة */
  yearOnlyDate?: boolean;
  /** تقارير متعددة الصفحات: يُوزَّع النص على صفحات بنفس الترويسة بدلاً من تصغير الخط */
  paginate?: boolean;
  /** تنسيق مبسّط في النص: «## عنوان»، «- بند»، جداول «| a | b |» */
  markup?: boolean;
}

/** تحويل النص المبسّط إلى كتل HTML (عناوين/فقرات/قوائم/جداول) */
export function renderMarkup(text: string): string {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const out: string[] = [];
  let para: string[] = [], list: string[] = [], table: string[][] = [];
  let bid = 0;
  const cell = (c: string) => nums(esc(c.trim()));
  const flushPara = () => { if (para.length) { out.push(`<p data-bid="b${bid++}">${para.map(l => nums(esc(l.trim()))).join('<br/>')}</p>`); para = []; } };
  const flushList = () => { if (list.length) { out.push(`<ul data-bid="b${bid++}">${list.map(l => `<li>${nums(esc(l))}</li>`).join('')}</ul>`); list = []; } };
  const flushTable = () => {
    if (!table.length) return;
    const [head, ...rows] = table;
    out.push(`<table data-bid="b${bid++}"><thead><tr>${head.map(c => `<th>${cell(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${cell(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    table = [];
  };
  const flush = () => { flushPara(); flushList(); flushTable(); };
  for (const raw of lines) {
    const l = raw.trimEnd();
    const t = l.trim();
    if (!t) { flush(); continue; }
    if (/^#{1,3}\s+/.test(t)) { flush(); out.push(`<h3 data-bid="b${bid++}">${nums(esc(t.replace(/^#{1,3}\s+/, '')))}</h3>`); continue; }
    if (/^[-•*]\s+/.test(t)) { flushPara(); flushTable(); list.push(t.replace(/^[-•*]\s+/, '')); continue; }
    if (/^\|.*\|$/.test(t)) {
      flushPara(); flushList();
      const cells = t.slice(1, -1).split('|');
      if (cells.every(c => /^\s*:?-{2,}:?\s*$/.test(c))) continue;
      table.push(cells); continue;
    }
    flushList(); flushTable(); para.push(t);
  }
  flush();
  return out.join('\n');
}

/** صفحة المراسلة A4 على قالب الترويسة الرسمي — مصدر واحد للمعاينة والطباعة */
export function renderLetterHtml(company: LetterheadCompany, letter: Letter, origin: string, opts: RenderOptions = {}): string {
  const mode = opts.mode || 'full';
  const paginate = !!opts.paginate;
  const showBg = mode !== 'text';
  const showText = mode !== 'background';
  const color = company.brand_color || '#D4A72C';
  const font = company.font_family || 'Tajawal';
  const numFont = company.number_font || font;
  const [y, mo, d] = String(letter.letter_date || '').slice(0, 10).split('-');
  const customLogo = abs(company.logo_url, origin);
  const wmUrl = abs(company.watermark_url, origin) || customLogo;
  const wmOpacity = Math.max(0.02, Math.min(0.4, Number(company.watermark_opacity) || 0.06));
  const stamp = abs(company.stamp_url, origin);
  const sigImg = abs(company.signature_url, origin);
  const bodyHtml = opts.markup
    ? renderMarkup(letter.body)
    : String(letter.body || '').split(/\n\s*\n/).filter(p => p.trim()).map((p, i) => `<p data-bid="p${i}">${nums(esc(p.trim())).replace(/\n/g, '<br/>')}</p>`).join('');
  const signer = (letter.signer_name ?? '') || company.signer_name || '';
  const signerTitle = (letter.signer_title ?? '') || company.signer_title || '';
  const withStamp = letter.with_stamp !== false && !!stamp;
  const withSig = letter.with_signature !== false && !!sigImg;
  const hasSign = !!(signer || signerTitle || withStamp || withSig);
  const bodyBottom = hasSign ? BODY.bottomWithSign : BODY.bottomPlain;
  const phones = (company.phones || []).filter(Boolean);
  const addresses = (company.addresses || []).filter(Boolean).slice(0, 2);
  const doranFace = [font, numFont].includes('Doran')
    ? `<style>${[['Light', 300], ['Regular', 400], ['Medium', 500], ['Bold', 700], ['ExtraBold', 800]].map(([n, w]) => `@font-face{font-family:'Doran';src:url('${origin}/Doran-${n}.otf') format('opentype');font-weight:${w};font-display:block}`).join('')}</style>`
    : '';
  const fontLink = [...new Set([font, numFont])].filter(f => !LOCAL_FONTS.has(f)).map(f => `<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;500;700;800&display=swap" rel="stylesheet">`).join('');

  const background = !showBg ? '' : `
  ${company.show_watermark ? (wmUrl ? `<img class="wm-img" src="${esc(wmUrl)}" alt="" style="opacity:${wmOpacity}"/>` : `<div class="layer wm" style="opacity:${(wmOpacity / 0.06).toFixed(2)}">${watermarkSvg}</div>`) : ''}
  <div class="layer">${recolorFrame(color)}</div>
  ${customLogo ? `<img class="logo-img" src="${esc(customLogo)}" alt="${esc(company.name)}"/>` : `<div class="logo-svg">${logoSvg}</div>`}
  ${company.commercial_register ? `<div class="abs meta-bg" style="${box(370, 481, 104.5)}">${esc(company.commercial_register)}</div>` : ''}
  ${phones.length ? `<div class="abs contact" style="left:404pt;top:774pt;height:15pt;line-height:15pt">${esc(phones.join('  -  '))}</div>` : ''}
  ${company.email ? `<div class="abs contact" style="left:404pt;top:801pt;height:15pt;line-height:15pt">${esc(company.email)}</div>` : ''}
  ${addresses.length ? `<div class="abs addr" style="right:${PAGE_W - 252}pt;top:${addresses.length > 1 ? 779 : 786}pt">${addresses.map(a => `<div>${nums(esc(a))}</div>`).join('')}</div>` : ''}`;

  const meta = !showText ? '' : `
  <div class="abs meta" style="${box(478, 527, 58)}">${opts.yearOnlyDate ? '' : esc(d || '')}</div>
  <div class="abs meta" style="${box(433, 474, 58)}">${opts.yearOnlyDate ? '' : esc(mo || '')}</div>
  <div class="abs meta" style="${box(384, 427, 58)}">${esc(y || '')}</div>
  <div class="abs meta" style="${box(399, 494, 81)}">${esc(letter.reference_number)}</div>`;

  const blocks = `
      ${letter.recipient ? `<div class="to" data-bid="to">${nums(esc(letter.recipient))}</div>` : ''}
      ${letter.greeting ? `<div class="greet" data-bid="gr">${nums(esc(letter.greeting))}</div>` : ''}
      ${letter.subject ? `<div class="subject" data-bid="sj">الموضوع: ${nums(esc(letter.subject))}</div>` : ''}
      ${bodyHtml}
      ${letter.closing ? `<div class="closing" data-bid="cl">${nums(esc(letter.closing))}</div>` : ''}`;
  const bodyBox = (inner: string, bottom: number, ids = false) => !showText ? '' : `
  <div ${ids ? 'id="body" ' : ''}class="content body${!paginate ? ' letter-body' : ''}" style="top:${BODY.top}pt;left:${BODY.side}pt;right:${BODY.side}pt;height:${bottom - BODY.top}pt">
    <div ${ids ? 'id="flow" ' : ''}class="flow">${inner}</div>
  </div>`;

  const sign = !showText || !hasSign ? '' : `<div class="sign-wrap">
  <div class="sign">
    ${signer ? `<div class="sn">${esc(signer)}</div>` : ''}
    ${signerTitle ? `<div class="st">${esc(signerTitle)}</div>` : ''}
    ${withSig ? `<div class="sig-area"><img src="${esc(sigImg)}" alt=""/></div>` : ''}
    <div class="dots">……………………………………</div>
  </div>
  ${withStamp ? `<img class="stamp" src="${esc(stamp)}" alt=""/>` : ''}
</div>`;

  const pageOpen = `<div class="paper page lp" data-print-page data-mode="${mode}">`;
  const pagesHtml = paginate
    ? `<div id="pages">${pageOpen}${background}${meta}${bodyBox(blocks, BODY.bottomPlain)}</div></div>
<template id="page-tpl">${pageOpen}${background}${meta}${bodyBox('', BODY.bottomPlain)}</div></template>
<template id="sign-tpl">${sign}</template>`
    : `${pageOpen}${background}${meta}${bodyBox(blocks, bodyBottom, true)}${sign}</div>`;

  const script = paginate ? `
(function () {
  var PLAIN = ${BODY.bottomPlain - BODY.top}, SIGNH = ${BODY.bottomWithSign - BODY.top};
  var tpl = document.getElementById('page-tpl'), signTpl = document.getElementById('sign-tpl');
  var first = document.querySelector('.lp');
  var firstFlow = first && first.querySelector('.flow');
  var SRC = firstFlow ? firstFlow.innerHTML : '';
  function pages() { return Array.prototype.slice.call(document.querySelectorAll('.lp')); }
  function bodyOf(p) { return p.querySelector('.body'); }
  function flowOf(p) { return p.querySelector('.flow'); }
  function hostOf(p) { return (p.closest && p.closest('.page-scale-wrapper')) || p; }
  function over(p) { var b = bodyOf(p), f = flowOf(p); return !!(b && f && f.scrollHeight > b.clientHeight + 1); }
  function newPageAfter(p) {
    var n = tpl.content.firstElementChild.cloneNode(true), h = hostOf(p);
    h.parentNode.insertBefore(n, h.nextSibling);
    return n;
  }
  function contOf(nf, el) {
    var c = nf.firstElementChild;
    return c && el.getAttribute('data-bid') && c.getAttribute('data-bid') === el.getAttribute('data-bid') ? c : null;
  }
  function moveOne(p, next) {
    var f = flowOf(p), nf = flowOf(next), last = f.lastElementChild;
    if (!last) return false;
    var tag = last.tagName, cont = contOf(nf, last);
    if ((tag === 'UL' || tag === 'OL') && last.children.length > 1) {
      if (!cont) { cont = last.cloneNode(false); nf.insertBefore(cont, nf.firstChild); }
      cont.insertBefore(last.lastElementChild, cont.firstChild); return true;
    }
    if (tag === 'TABLE' && last.tBodies[0] && last.tBodies[0].rows.length > 1) {
      if (!cont) { cont = last.cloneNode(false); if (last.tHead) cont.appendChild(last.tHead.cloneNode(true)); cont.appendChild(document.createElement('tbody')); nf.insertBefore(cont, nf.firstChild); }
      var tb = last.tBodies[0]; cont.tBodies[0].insertBefore(tb.rows[tb.rows.length - 1], cont.tBodies[0].firstChild); return true;
    }
    if (tag === 'P' && (f.children.length === 1 || cont)) {
      var words = last.innerHTML.split(' ');
      if (words.length > 6) {
        if (!cont) { cont = last.cloneNode(false); cont.innerHTML = ''; nf.insertBefore(cont, nf.firstChild); }
        var take = words.splice(Math.max(1, words.length - 4));
        last.innerHTML = words.join(' ');
        cont.innerHTML = take.join(' ') + (cont.innerHTML ? ' ' + cont.innerHTML : '');
        return true;
      }
    }
    if (cont && tag === 'P') { cont.innerHTML = last.innerHTML + ' ' + cont.innerHTML; f.removeChild(last); }
    else if (cont && (tag === 'UL' || tag === 'OL')) { while (last.lastElementChild) cont.insertBefore(last.lastElementChild, cont.firstChild); f.removeChild(last); }
    else if (cont && tag === 'TABLE' && last.tBodies[0]) { var rows = last.tBodies[0].rows; while (rows.length) cont.tBodies[0].insertBefore(rows[rows.length - 1], cont.tBodies[0].firstChild); f.removeChild(last); }
    else nf.insertBefore(last, nf.firstChild);
    var prev = f.lastElementChild;
    if (prev && /^H[1-6]$/.test(prev.tagName) && f.children.length > 1) nf.insertBefore(prev, nf.firstChild);
    return true;
  }
  function layout() {
    if (!first) return;
    pages().slice(1).forEach(function (p) { var h = hostOf(p); h.parentNode.removeChild(h); });
    Array.prototype.slice.call(document.querySelectorAll('.lp .sign-wrap, .lp .pno')).forEach(function (e) { e.parentNode.removeChild(e); });
    if (firstFlow) firstFlow.innerHTML = SRC;
    var guard = 0;
    function fill(k, h) {
      var p = pages()[k];
      bodyOf(p).style.height = h + 'pt';
      while (over(p) && guard++ < 20000) {
        var next = pages()[k + 1] || newPageAfter(p);
        if (!moveOne(p, next)) break;
      }
    }
    if (firstFlow) {
      // كل الصفحات بالارتفاع الكامل، ثم تُترك مساحة التوقيع في الصفحة الأخيرة فقط
      for (var k = 0; k < pages().length && guard < 20000; k++) fill(k, PLAIN);
      for (var j = pages().length - 1; j < pages().length && guard < 20000; j++) fill(j, SIGNH);
    }
    var all = pages(), lastPage = all[all.length - 1];
    if (signTpl && signTpl.content.firstElementChild) lastPage.appendChild(signTpl.content.firstElementChild.cloneNode(true));
    if (all.length > 1) all.forEach(function (p, i) { var d = document.createElement('div'); d.className = 'pno'; d.textContent = 'صفحة ' + (i + 1) + ' من ' + all.length; p.appendChild(d); });
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    report(all.length);
  }
  function report(n) {
    try { window.parent && window.parent !== window && window.parent.postMessage({ type: 'letter-fit', scale: 1, overflow: false, pages: n, height: document.documentElement.scrollHeight }, '*'); } catch (e) {}
  }
  layout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  window.addEventListener('load', function () { setTimeout(layout, 50); });
})();` : `
(function () {
  var body = document.getElementById('body');
  var flow = document.getElementById('flow');
  function fit() {
    if (!body || !flow) { report(1, false); return; }
    var paper = body.closest('.paper');
    paper.classList.remove('short-letter');
    paper.style.removeProperty('--letter-sign-top');
    var size = 14;
    body.style.fontSize = size + 'pt';
    // Keep the signature and stamp close to short letters on the left.
    if (flow.scrollHeight <= body.clientHeight * 0.65) {
      paper.classList.add('short-letter');
      paper.style.setProperty('--letter-sign-top', (${BODY.top} + flow.getBoundingClientRect().height * 0.75 + 24) + 'pt');
    }
    while (flow.scrollHeight > body.clientHeight + 1 && size > 9.5) { size -= 0.25; body.style.fontSize = size + 'pt'; }
    report(size / 14, flow.scrollHeight > body.clientHeight + 1);
  }
  function report(scale, overflow) {
    try { window.parent && window.parent !== window && window.parent.postMessage({ type: 'letter-fit', scale: scale, overflow: overflow, pages: 1, height: document.documentElement.scrollHeight }, '*'); } catch (e) {}
  }
  fit();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  window.addEventListener('load', fit);
})();`;

  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
<title>${paginate ? 'تقرير' : 'مراسلة'} ${esc(letter.reference_number)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fontLink}${doranFace}
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: '${font}', 'Tajawal', sans-serif; color: #1f1d1e; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .paper { position: relative; width: 210mm; height: 297mm; margin: 0 auto; overflow: hidden; background: #fff; }
  .layer { position: absolute; inset: 0; pointer-events: none; }
  .layer svg { width: 100%; height: 100%; display: block; }
  .wm-img { position: absolute; left: 50%; top: 52%; width: 150mm; max-height: 170mm; object-fit: contain; transform: translate(-50%, -50%); opacity: .06; }
  .logo-svg { position: absolute; left: 28pt; top: 24pt; width: 280pt; height: 96pt; }
  .logo-svg svg { width: 100%; height: 100%; display: block; }
  .logo-img { position: absolute; left: 30pt; top: 26pt; width: 276pt; height: 92pt; object-fit: contain; object-position: left center; }
  .abs { position: absolute; white-space: nowrap; overflow: hidden; }
  x-n, .meta, .meta-bg, .contact { font-family: '${numFont}', '${font}', sans-serif; }
  .meta, .meta-bg { text-align: center; font-size: 11pt; font-weight: 800; letter-spacing: .4pt; direction: ltr; }
  .meta-bg { font-weight: 500; font-size: 10pt; letter-spacing: .3pt; text-align: right; }
  .contact { direction: ltr; text-align: left; font-size: 9.5pt; letter-spacing: .7pt; max-width: 182pt; }
  .addr { text-align: right; font-size: 9pt; line-height: 13.5pt; white-space: nowrap; max-width: 210pt; overflow: hidden; }
  .content { position: absolute; overflow: hidden; font-size: ${paginate ? 12.5 : 14}pt; line-height: ${paginate ? 1.68 : 1.72}; }
  .letter-body > .flow { display: flow-root; }
  .letter-body { text-align: right; }
  .content .to, .content .greet, .content .subject { text-align: right; font-weight: 800; margin: 0 0 ${paginate ? '.7em' : '1em'}; }
  .content p { margin: 0 0 ${paginate ? '.75em' : '1em'}; text-align: justify; }
  .letter-body p { text-align: right; margin-bottom: .8em; }
  .content h3 { font-size: 1.08em; font-weight: 800; margin: .9em 0 .45em; padding-right: 8pt; border-right: 3pt solid ${color}; line-height: 1.4; }
  .content ul { margin: 0 0 .8em; padding: 0 1.2em 0 0; }
  .content li { margin: 0 0 .25em; }
  .content li::marker { color: ${color}; }
  .content table { width: 100%; border-collapse: collapse; margin: .2em 0 .9em; font-size: .86em; line-height: 1.45; }
  .content th { background: ${color}22; font-weight: 800; }
  .content th, .content td { border: .6pt solid ${color}88; padding: 3pt 5pt; text-align: right; vertical-align: top; }
  .content .closing { font-weight: 700; }
  .sign-wrap { position: absolute; inset: 0; pointer-events: none; }
  .sign { position: absolute; left: 30pt; width: 175pt; top: 657pt; height: 100pt; text-align: center; font-size: 13pt; line-height: 1.45; overflow: hidden; }
  .sign .sn, .sign .st { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sign .sig-area { height: 28pt; display: flex; align-items: center; justify-content: center; }
  .sign .sig-area img { max-height: 40pt; max-width: 150pt; object-fit: contain; mix-blend-mode: multiply; margin-top: -6pt; }
  .sign .dots { letter-spacing: 1px; color: #555; font-size: 11pt; }
  .stamp { position: absolute; left: 150pt; top: 640pt; width: 110pt; height: 110pt; object-fit: contain; mix-blend-mode: multiply; opacity: .92; transform: rotate(-8deg); }
  .short-letter .sign-wrap { inset: auto; top: var(--letter-sign-top); left: 30pt; width: 175pt; display: flex; flex-direction: column; align-items: center; }
  .short-letter .sign { position: static; width: 100%; height: auto; overflow: visible; }
  .short-letter .stamp { position: absolute; left: 50%; top: ${(signer ? 13 * 1.45 : 0) + (signerTitle ? 13 * 1.45 : 0)}pt; width: 90pt; height: 90pt; margin: 0; transform: translateX(-50%) rotate(-8deg); }
  .pno { position: absolute; left: 0; right: 0; top: 750pt; text-align: center; font-size: 8pt; color: #777; }
  @media screen { body { background: #e9e9e9; padding: 8mm 0; } .paper { box-shadow: 0 2px 18px rgba(0,0,0,.18); } .paper + .paper { margin-top: 8mm; } }
</style></head><body>
${pagesHtml}
<script>${script}
</script>
</body></html>`;
}
