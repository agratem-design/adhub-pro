/** Print identity follows the supplied August 2026 price sheet with edge-to-edge full-page layout. */
export function pricingPrintStyles(theme: 'light' | 'dark') {
  const dark = theme === 'dark';
  return `
    @font-face { font-family: Doran; src: url('/Doran-Regular.otf') format('opentype'); font-weight: 400; }
    @font-face { font-family: Doran; src: url('/Doran-Bold.otf') format('opentype'); font-weight: 700 900; }
    @font-face { font-family: Manrope; src: url('/Manrope-SemiBold.ttf') format('truetype'); font-weight: 600; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    :root { --paper: ${dark ? '#171717' : '#fff'}; --ink: ${dark ? '#f8f8f8' : '#181818'}; --muted: ${dark ? '#ccc' : '#505050'}; --gold: #d4ad27; }
    body { font-family: Doran, sans-serif; color: var(--ink); background: #3b3b3b; line-height: 1.4; padding: 0; margin: 0; }
    .page { width: 210mm; min-height: 297mm; max-width: 100vw; margin: 12px auto; background: var(--paper); position: relative; isolation: isolate; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.35); }
    .page::before { content: ''; position: absolute; z-index: -1; left: -15mm; bottom: -10mm; width: 120mm; height: 155mm; background: url('/pricing-knight-watermark.svg') no-repeat center / contain; filter: grayscale(1); opacity: .07; }
    .page::after { content: ''; position: absolute; bottom: 0; right: 0; left: 0; height: 4mm; background: linear-gradient(100deg, #ece260, #d4ad27 55%); }
    .page-content { min-height: 297mm; padding: 4.5mm 6mm 4mm 6mm; display: grid; grid-template-rows: auto auto 1fr auto; gap: 2mm; box-sizing: border-box; }
    .header { display: flex; flex-direction: row-reverse; align-items: center; justify-content: space-between; gap: 6mm; padding-bottom: 2mm; border-bottom: .45mm solid var(--gold); }
    .logo-area { width: 44%; min-width: 0; flex-shrink: 1; ${dark ? 'background: #fff; border-radius: 2mm; padding: 2mm;' : ''} }
    .logo { display: block; width: 100%; height: 30mm; object-fit: contain; }
    .title-area { text-align: right; }
    .main-title { font-size: 19.5pt; font-weight: 700; line-height: 1.3; white-space: normal; }
    .main-title span { background: linear-gradient(transparent 45%, #d4ad27 45%, #d4ad27 68%, transparent 68%); }
    .header-note { margin-top: 1.5mm; padding: 1.2mm 2.5mm; border-right: .6mm solid var(--gold); background: #d4ad2710; line-height: 1.4; font-size: 9.5pt; color: ${dark ? '#ff9292' : '#c51d24'}; white-space: nowrap; }
    .sheet-meta { display: flex; justify-content: space-between; gap: 3mm; margin: 0; padding: 0.5mm 1mm; align-items: center; font-size: 9.5pt; font-weight: 700; color: var(--muted); }
    .meta-level-title { font-weight: 700; color: var(--ink); font-size: 10pt; }
    .meta-currency { font-weight: 600; color: var(--muted); font-size: 9pt; }
    .price-cards { display: flex; flex-direction: column; justify-content: space-between; gap: 2.8mm; min-height: 0; flex: 1; height: 100%; }
    .size-card { break-inside: avoid; page-break-inside: avoid; display: flex; flex-direction: column; justify-content: center; }
    .size-heading { display: flex; align-items: stretch; gap: 4mm; justify-content: space-between; height: 10.5mm; margin-bottom: 1.5mm; }
    .size-label, .print-size-label { display: flex; align-items: center; justify-content: space-between; gap: 2.5mm; padding: 0.8mm 3mm; border: .35mm solid var(--ink); border-radius: 3mm 0 3mm 0; color: var(--ink); line-height: 1; width: 62mm; min-width: 62mm; max-width: 62mm; box-sizing: border-box; }
    .print-size-label { margin-inline-start: auto; border-color: #666; }
    .size-label span, .print-size-label span { font-size: 11.5pt; font-weight: 700; white-space: nowrap; line-height: 1; }
    .size-label bdi, .print-size-label bdi { border-right: .35mm solid var(--ink); padding-right: 2.5mm; font: 700 12.5pt Manrope, Doran, sans-serif; white-space: nowrap; }
    .print-size-label bdi { font-size: 12pt; border-color: #666; }
    .size-label small { font-size: 8.5pt; }
    .duration-prices { display: grid; grid-template-columns: repeat(var(--columns), minmax(0, 1fr)); border: .35mm solid var(--ink); border-radius: 4mm 0 4mm 4mm; padding: 1mm 0; height: 16mm; min-height: 16mm; align-items: center; width: 100%; }
    .duration-price { text-align: center; padding: 0 1mm; }
    .duration-price + .duration-price { border-right: .3mm solid var(--ink); }
    .duration-label { font-size: var(--label-font, 11pt); font-weight: 700; white-space: nowrap; }
    .price { display: flex; direction: ltr; align-items: baseline; justify-content: center; gap: 1mm; white-space: nowrap; font: 600 var(--price-font, 12pt) Manrope, Doran, sans-serif; font-variant-numeric: tabular-nums; }
    .price small { font: 700 .75em Doran, sans-serif; }

    /* المسافة والارتفاع الديناميكي للمقاسات حسب عدد المقاسات المتوفرة */
    .price-cards[data-count="1"] { justify-content: center; padding: 30mm 0; gap: 0; }
    .price-cards[data-count="1"] .size-heading { height: 16mm; margin-bottom: 4mm; }
    .price-cards[data-count="1"] .duration-prices { height: 26mm; min-height: 26mm; }
    .price-cards[data-count="1"] .size-label,
    .price-cards[data-count="1"] .print-size-label { width: 72mm; min-width: 72mm; max-width: 72mm; }
    .price-cards[data-count="1"] .size-label span,
    .price-cards[data-count="1"] .print-size-label span { font-size: 14pt; line-height: 1; }
    .price-cards[data-count="1"] .size-label bdi,
    .price-cards[data-count="1"] .print-size-label bdi { font-size: 16.5pt; }

    .price-cards[data-count="2"] { justify-content: space-around; padding: 16mm 0; gap: 28mm; }
    .price-cards[data-count="2"] .size-heading { height: 14.5mm; margin-bottom: 3.5mm; }
    .price-cards[data-count="2"] .duration-prices { height: 23mm; min-height: 23mm; }
    .price-cards[data-count="2"] .size-label,
    .price-cards[data-count="2"] .print-size-label { width: 68mm; min-width: 68mm; max-width: 68mm; }
    .price-cards[data-count="2"] .size-label span,
    .price-cards[data-count="2"] .print-size-label span { font-size: 13.5pt; line-height: 1; }
    .price-cards[data-count="2"] .size-label bdi,
    .price-cards[data-count="2"] .print-size-label bdi { font-size: 15.5pt; }

    .price-cards[data-count="3"] { justify-content: space-between; padding: 8mm 0; gap: 18mm; }
    .price-cards[data-count="3"] .size-heading { height: 13.5mm; margin-bottom: 3mm; }
    .price-cards[data-count="3"] .duration-prices { height: 20.5mm; min-height: 20.5mm; }
    .price-cards[data-count="3"] .size-label,
    .price-cards[data-count="3"] .print-size-label { width: 65mm; min-width: 65mm; max-width: 65mm; }
    .price-cards[data-count="3"] .size-label span,
    .price-cards[data-count="3"] .print-size-label span { font-size: 13pt; line-height: 1; }
    .price-cards[data-count="3"] .size-label bdi,
    .price-cards[data-count="3"] .print-size-label bdi { font-size: 14.5pt; }

    .price-cards[data-count="4"] { justify-content: space-between; padding: 4mm 0; gap: 13mm; }
    .price-cards[data-count="4"] .size-heading { height: 12.5mm; margin-bottom: 2.5mm; }
    .price-cards[data-count="4"] .duration-prices { height: 18.5mm; min-height: 18.5mm; }
    .price-cards[data-count="4"] .size-label,
    .price-cards[data-count="4"] .print-size-label { width: 64mm; min-width: 64mm; max-width: 64mm; }
    .price-cards[data-count="4"] .size-label span,
    .price-cards[data-count="4"] .print-size-label span { font-size: 12.5pt; line-height: 1; }
    .price-cards[data-count="4"] .size-label bdi,
    .price-cards[data-count="4"] .print-size-label bdi { font-size: 14pt; }

    .price-cards[data-count="5"] { justify-content: space-between; padding: 1.5mm 0; gap: 8mm; }
    .price-cards[data-count="5"] .size-heading { height: 11.5mm; margin-bottom: 2mm; }
    .price-cards[data-count="5"] .duration-prices { height: 17.5mm; min-height: 17.5mm; }
    .price-cards[data-count="5"] .size-label,
    .price-cards[data-count="5"] .print-size-label { width: 63mm; min-width: 63mm; max-width: 63mm; }
    .price-cards[data-count="5"] .size-label span,
    .price-cards[data-count="5"] .print-size-label span { font-size: 12pt; line-height: 1; }
    .price-cards[data-count="5"] .size-label bdi,
    .price-cards[data-count="5"] .print-size-label bdi { font-size: 13.5pt; }

    .price-cards[data-count="6"] { justify-content: space-between; padding: 0; gap: 5mm; }
    .price-cards[data-count="6"] .size-heading { height: 11mm; margin-bottom: 1.5mm; }
    .price-cards[data-count="6"] .duration-prices { height: 16.5mm; min-height: 16.5mm; }
    .price-cards[data-count="6"] .size-label,
    .price-cards[data-count="6"] .print-size-label { width: 62mm; min-width: 62mm; max-width: 62mm; }
    .price-cards[data-count="6"] .size-label span,
    .price-cards[data-count="6"] .print-size-label span { font-size: 12pt; line-height: 1; }

    .price-cards[data-count="7"],
    .price-cards:not([data-count]) { justify-content: space-between; padding: 0; gap: 2.8mm; }
    .price-cards[data-count="7"] .size-heading,
    .price-cards:not([data-count]) .size-heading { height: 10.5mm; margin-bottom: 1.5mm; }
    .price-cards[data-count="7"] .duration-prices,
    .price-cards:not([data-count]) .duration-prices { height: 16mm; min-height: 16mm; }
    .price-cards[data-count="7"] .size-label,
    .price-cards[data-count="7"] .print-size-label,
    .price-cards:not([data-count]) .size-label,
    .price-cards:not([data-count]) .print-size-label { width: 62mm; min-width: 62mm; max-width: 62mm; }
    .price-cards[data-count="7"] .size-label span,
    .price-cards[data-count="7"] .print-size-label span,
    .price-cards:not([data-count]) .size-label span,
    .price-cards:not([data-count]) .print-size-label span { font-size: 11.5pt; line-height: 1; }

    /* دليل مقاسات الطباعة في ورقة واحدة (تنسيق شبكي بعمودين متوازيين) */
    .catalog-page-content {
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      min-height: 297mm;
      height: 297mm;
      padding: 5mm 6mm 4mm 6mm;
      box-sizing: border-box;
    }
    .catalog-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 3mm 4.5mm;
      align-content: start;
      margin: 2mm 0;
      flex: 1;
    }
    .catalog-card {
      break-inside: avoid;
      page-break-inside: avoid;
      display: flex;
      flex-direction: column;
      gap: 0.8mm;
    }
    .catalog-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 2mm;
      padding: 1.2mm 3mm;
      border: .35mm solid var(--ink);
      border-radius: 2.5mm 0 2.5mm 0;
      background: ${dark ? '#222' : '#fafafa'};
      height: 9.5mm;
      box-sizing: border-box;
    }
    .catalog-badge {
      font-size: 7.5pt;
      font-weight: 700;
      color: var(--muted);
      background: #ece26030;
      padding: 0.4mm 1.5mm;
      border-radius: 1mm;
      font-variant-numeric: tabular-nums;
    }
    .catalog-label-name {
      flex: 1;
      font-size: 8.5pt;
      font-weight: 700;
      color: var(--ink);
      white-space: nowrap;
      text-align: right;
      padding-right: 1.5mm;
    }
    .catalog-val-name {
      font: 600 12pt Manrope, Doran, sans-serif;
      color: var(--ink);
      white-space: nowrap;
      padding-right: 2.5mm;
      border-right: .35mm solid var(--ink);
      font-variant-numeric: tabular-nums;
    }
    .catalog-card-bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 2mm;
      padding: 1.4mm 3mm;
      border: .35mm solid var(--ink);
      border-radius: 0 0 2.5mm 2.5mm;
      background: ${dark ? '#1a1a1a' : '#fff'};
      height: 11mm;
      box-sizing: border-box;
    }
    .catalog-label-print {
      flex: 1;
      font-size: 8.5pt;
      font-weight: 700;
      color: var(--muted);
      white-space: nowrap;
      text-align: right;
    }
    .catalog-val-print {
      font: 600 12pt Manrope, Doran, sans-serif;
      color: var(--ink);
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }

    .footer { display: flex; justify-content: space-between; gap: 4mm; margin-top: auto; padding-top: 1.5mm; align-items: center; font-size: 8.5pt; color: var(--muted); border-top: .25mm solid #ddd; }
    .preview-toolbar { position: sticky; top: 0; z-index: 100; display: flex; justify-content: center; gap: 12px; padding: 12px; background: #fff; border-bottom: 1px solid #ddd; box-shadow: 0 2px 12px #0001; }
    .preview-toolbar button { min-height: 42px; padding: 8px 22px; border: 1px solid #aaa; border-radius: 8px; color: #181818; font: 700 14px Doran, sans-serif; cursor: pointer; transition: background .2s; }
    .print-btn { background: #d4ad27; } .close-preview-btn { background: #fff; }
    .preview-toolbar button:hover { background: #eee2b4; }
    .preview-toolbar button:focus-visible { outline: 3px solid #785b13; outline-offset: 2px; }
    @media screen and (max-width: 650px) {
      .page-content { padding: 14px 10px 24px; min-height: 0; height: auto; display: flex; flex-direction: column; }
      .catalog-grid { grid-template-columns: 1fr; gap: 8px; }
      .price-cards { display: flex; flex-direction: column; gap: 10px; }
      .size-heading { height: auto; flex-wrap: wrap; }
      .size-label, .print-size-label { min-width: 0; min-height: 38px; }
      .size-label span, .print-size-label span { flex: 1; font-size: 12px; }
      .header { gap: 10px; } .main-title { font-size: 18px; } .header-note { font-size: 10px; white-space: normal; }
      .sheet-meta { font-size: 10px; } .price { font-size: clamp(6px, 1.7vw, 11px); gap: 1px; }
      .duration-label { font-size: 10px; } .size-label bdi { font-size: 14px; }
      .footer { font-size: 9px; margin-top: 14px; }
    }
    @media print {
      @page {
        size: A4 portrait;
        margin: 0; /* Zero margin enables true full-page edge-to-edge printing */
      }
      html, body {
        background: var(--paper);
        margin: 0 !important;
        padding: 0 !important;
        width: 210mm !important;
        height: 297mm !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .page {
        width: 210mm !important;
        height: 297mm !important;
        min-height: 297mm !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        break-inside: avoid;
        page-break-inside: avoid;
        break-after: page;
        page-break-after: always;
      }
      .page:last-of-type {
        break-after: auto;
        page-break-after: auto;
      }
      .page-content {
        width: 210mm !important;
        height: 297mm !important;
        min-height: 297mm !important;
        padding: 4.5mm 6mm 4mm 6mm !important;
        box-sizing: border-box !important;
      }
      .size-card, .header, .footer {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .preview-toolbar {
        display: none !important;
      }
    }
    @media (prefers-reduced-motion: reduce) { .print-btn { transition: none; } }
  `;
}
