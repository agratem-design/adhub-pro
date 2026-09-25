import { pricingPrintStyles } from './pricingPrintStyles';
import { escapePrintText as esc } from './printSizeCatalog';

interface Price { size_name: string; billboard_level: string; one_month: number; two_months: number; three_months: number; six_months: number; full_year: number; one_day: number }
interface Factor { factor: number; is_active: boolean; municipality_name?: string; category_name?: string }
interface Options { type: 'all' | 'base_prices' | 'municipalities' | 'single_city'; prices: Price[]; municipalities: Factor[]; categories: Factor[]; city: string; category: string; size: string; level: string; origin: string; showComparison?: boolean }
const periods = [['one_day', 'يومي'], ['one_month', '30 يوم'], ['two_months', '60 يوم'], ['three_months', '90 يوم'], ['six_months', '180 يوم'], ['full_year', 'سنة كاملة']] as const;
const money = (n: number) => Math.round(n).toLocaleString('en-US');
const effect = (n: number) => n === 1 ? 'نفس السعر' : `${n < 1 ? 'تخفيض' : 'زيادة'} ${Number((Math.abs(n - 1) * 100).toFixed(2))}%`;

export function buildFactorPricingPrint(o: Options) {
  const pages: string[] = [];
  const municipal = o.municipalities.find(m => m.municipality_name === o.city)?.factor ?? 1;
  const category = o.categories.find(c => c.category_name === o.category)?.factor ?? 1;
  const multiplier = municipal * category;
  const addPage = (title: string, meta: string, body: string) => pages.push(`<section class="page factor-sheet"><div class="page-content"><header class="header"><div class="logo-area"><img class="logo" src="/logofares.svg" alt="الفارس الذهبي"></div><div class="title-area"><h1 class="main-title"><span>${title}</span></h1><div class="header-note">جميع الأسعار بالدينار الليبي</div></div></header><div class="sheet-meta">${meta}</div><main>${body}</main><footer class="footer"><span>تاريخ الإصدار: ${esc(new Date().toLocaleDateString('ar-LY'))}</span><span>صفحة ${pages.length + 1}</span></footer></div></section>`);
  if (o.type !== 'municipalities') {
    const levels = [...new Set(o.prices.map(p => p.billboard_level))].filter(l => o.level === 'all' || l === o.level);
    for (const level of levels) {
      const rows = o.prices.filter(p => p.billboard_level === level);
      for (let i = 0; i < rows.length; i += 6) {
        const single = o.type === 'single_city';
        const compare = single && o.showComparison;
        addPage(single ? `أسعار الإيجار · ${esc(o.city)}` : 'أسعار الإيجار الأساسية', `المستوى ${esc(level)}${compare ? ` · معامل المدينة ${municipal} × معامل العميل ${category} = ${Number(multiplier.toFixed(4))} · ${effect(multiplier)}` : single ? ' · الأسعار النهائية' : ' · الأسعار الأساسية'}`,
          `<div class="factor-cards">${rows.slice(i, i + 6).map(p => `<section class="size-card"><div class="size-heading"><div class="size-label"><span>مقاس المساحة<br>الإعلانية</span><bdi>${esc(p.size_name)}</bdi></div></div><div class="duration-prices" style="--columns:6">${periods.map(([key, label]) => `<div class="duration-price"><div class="duration-label">${label}</div><div class="price">${money((p[key] || 0) * (single ? multiplier : 1))}<small>د.ل</small></div>${compare ? `<div class="base-comparison">الأساس ${money(p[key] || 0)}</div>` : ''}</div>`).join('')}</div></section>`).join('')}</div>`);
      }
    }
  }
  const reference = o.prices.find(p => p.size_name === o.size && p.billboard_level === (o.level === 'all' ? 'A' : o.level));
  const table = (rows: Factor[], name: 'municipality_name' | 'category_name') => {
    for (let i = 0; i < rows.length; i += 16) addPage(name === 'municipality_name' ? 'مقارنة أسعار المدن' : 'معاملات العملاء', `مقاس ${esc(o.size)} · المستوى ${esc(reference?.billboard_level ?? (o.level === 'all' ? 'A' : o.level))} · سنة كاملة · الأساس ${reference ? money(reference.full_year) + ' د.ل' : 'غير متوفر'}`, `<table class="factor-table"><thead><tr><th>${name === 'municipality_name' ? 'المدينة' : 'العميل'}</th><th>المعامل</th><th>التأثير</th><th>السعر بعد المعامل</th><th>الفرق عن الأساس</th></tr></thead><tbody>${rows.slice(i, i + 16).map(f => `<tr><td>${esc(f[name])}</td><td>${f.factor}</td><td>${effect(f.factor)}</td><td>${reference ? money(reference.full_year * f.factor) : '—'}</td><td>${reference ? money(reference.full_year * f.factor - reference.full_year) : '—'}</td></tr>`).join('')}</tbody></table>`);
  };
  if (o.type === 'all' || o.type === 'municipalities') table(o.municipalities.filter(m => m.is_active), 'municipality_name');
  if (o.type === 'all') table(o.categories.filter(c => c.is_active), 'category_name');
  if (!pages.length) throw new Error('لا توجد أسعار تطابق خيارات الطباعة');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><base href="${esc(o.origin)}/"><title>الأسعار والمعاملات</title><style>${pricingPrintStyles('light')}
  .factor-sheet .page-content { height:297mm; padding:10mm 10mm 12mm !important; grid-template-rows:36mm 13mm minmax(0,1fr) 8mm; gap:3mm; }
  .factor-sheet .main-title { font-size:20pt; } .factor-sheet .sheet-meta { font-size:10pt; display:block; }
  .factor-sheet main { min-height:0; } .factor-cards { display:grid; gap:5mm; }
  .factor-sheet .duration-prices { height:16mm; } .factor-sheet .duration-label { font-size:10pt; }
  .factor-sheet .price { font-size:13pt; }
  .factor-sheet .size-heading { height:11mm; margin-bottom:2mm; }
  .factor-sheet .size-label { width:auto; min-width:0; max-width:none; border:0; padding:0; justify-content:flex-start; gap:2mm; }
  .factor-sheet .size-label span, .factor-sheet .size-label bdi { display:flex; align-items:center; justify-content:center; height:100%; border:.3mm solid #333; border-radius:2mm; padding:1mm 3mm; background:#fff; }
  .factor-sheet .size-label span { font-size:11pt; line-height:1.2; min-width:39mm; background:#f7f4eb; text-align:center; }
  .factor-sheet .size-label bdi { font-size:15pt; min-width:27mm; direction:ltr; }
  .factor-sheet .header-note { color:#555; background:none; border:0; } .comparison-key,.base-comparison { font-size:9pt; color:#555; }
  .factor-table { border-collapse:collapse; width:100%; font-size:11pt; } .factor-table th { background:#f7f4eb; }
  .factor-table th,.factor-table td { padding:3mm 2mm; border-bottom:.25mm solid #ddd; text-align:center; }
  .factor-table th:first-child,.factor-table td:first-child { text-align:right; } .factor-table tr { break-inside:avoid; }
  .factor-sheet .footer { margin:0; } .factor-sheet::after { bottom:5mm; left:10mm; right:10mm; height:2mm; }
  </style></head><body><nav class="preview-toolbar"><button class="print-btn" onclick="window.print()">طباعة / حفظ PDF</button><button onclick="if(window.opener){window.opener.focus();window.close()}else{location.href='/admin/pricing-factors'}">إغلاق والرجوع</button></nav>${pages.join('')}</body></html>`;
}
