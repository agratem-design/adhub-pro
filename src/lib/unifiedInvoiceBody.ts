import { PRINT_INK_SAVER_CSS } from './printInkSaver';
/** Shared printed stationery for invoices, receipts and operational statements. */
export function unifiedInvoiceBodyCss(styles: Record<string, any>): string {
  const bodySize = styles.bodyFontSize ?? 12;
  const border = styles.tableBorderColor || styles.tableBorder || '#e5e5e5';
  const text = styles.tableTextColor || styles.tableText || '#171717';
  const headerBg = styles.tableHeaderBgColor || styles.tableHeaderBg || styles.primaryColor || '#000000';
  const headerText = styles.tableHeaderTextColor || styles.tableHeaderText || '#ffffff';
  const even = styles.tableRowEvenColor || styles.tableRowEven || '#f0f0f0';
  const odd = styles.tableRowOddColor || styles.tableRowOdd || '#ffffff';
  const partyBg = styles.customerSectionBgColor || styles.customerBg || '#ffffff';
  const partyText = styles.customerSectionTextColor || styles.customerText || text;
  const totalBg = styles.totalBgColor || styles.totalBg || '#000000';
  const totalText = styles.totalTextColor || styles.totalText || '#ffffff';
  const radius = styles.borderRadius ?? 6;
  const accent = !styles.primaryColor || /^#(?:000(?:000)?|262626|333333)$/i.test(styles.primaryColor)
    ? '#b8860b' : styles.primaryColor;
  return `
  @font-face { font-family: 'Doran'; src: url('/Doran-Regular.otf') format('opentype'); font-weight: 400; }
  @font-face { font-family: 'Doran'; src: url('/Doran-Bold.otf') format('opentype'); font-weight: 700; }
  @font-face { font-family: 'Manrope'; src: url('/Manrope-Regular.otf') format('opentype'); font-weight: 400; }
  @font-face { font-family: 'Manrope'; src: url('/Manrope-Bold.otf') format('opentype'); font-weight: 700; }
  html, body { font-family: ${styles.fontFamily || "'Doran', sans-serif"} !important; }
  /* Shared interior: restrained sections, full-width tables, compact totals. */
  :root { --invoice-body-border: ${border}; --invoice-body-text: ${text}; --invoice-accent: ${accent}; }
  .invoice-print-label {
    display: inline-block; max-width: 100%; box-sizing: border-box;
    background: transparent !important; color: ${text} !important;
    border: 1px solid ${border} !important; border-radius: 3px !important;
    padding: 2px 5px !important; font-size: 10px !important;
    line-height: 1.5 !important; font-weight: 400 !important;
    vertical-align: middle; white-space: normal; overflow-wrap: anywhere;
  }
  .u-invoice-info { text-align: right; }
  .u-header { min-height:96px !important; height:auto !important; border:0 !important;
    border-bottom:2px solid ${accent} !important; border-radius:0 !important;
    padding:0 0 18px !important; margin-top:0 !important; margin-bottom:${styles.headerMarginBottom ?? 20}px !important;
    box-shadow:none !important; align-items:center; }
  .u-logo { max-width:100%; object-fit:contain !important; }
  .u-company-side { min-width:0; }
  .u-invoice-title { margin-bottom:4px; line-height:1.4; }
  .u-invoice-subtitle { letter-spacing:1.5px; font-weight:400; }
  .u-invoice-details { font-size: 11px; line-height: 1.9; overflow-wrap: anywhere; }
  .u-invoice-details > div { display: block !important; width: 100%; direction: rtl; }
  .u-invoice-details > div > span { display: inline !important; margin-inline-end: 4px; }
  .u-invoice-details strong { display: inline !important; white-space: nowrap; overflow-wrap: normal; }
  .u-invoice-details span, .u-invoice-details strong { font-size: inherit; line-height: inherit; }
  .customer-section, .customer-info, .info-section, .team-info, .payment-info {
    background: ${partyBg} !important; color: ${partyText} !important;
    border: 1px solid ${styles.customerSectionBorderColor || styles.customerBorder || border} !important;
    border-inline-start: 3px solid ${accent} !important;
    border-radius: ${radius}px !important; box-shadow: none !important;
    padding: 14px 16px !important; margin-bottom: 20px !important;
    gap:16px; min-width:0; break-inside:avoid;
  }
  .customer-section > div { min-width:0; }
  .customer-name-text { margin:3px 0 6px; line-height:1.5; overflow-wrap:anywhere; }
  .customer-section .info-grid { gap:12px; }
  .info-box, .info-row, .team-details, .payment-details { min-width: 0; }
  .info-box { background: transparent !important; box-shadow: none !important; border-radius: 0 !important; padding: 6px 8px !important; }
  .info-label, .customer-label, .item-detail-label { color: ${partyText} !important; opacity: .8; font-size: ${Math.max(10, bodySize - 1)}px !important; }
  .info-value, .customer-detail { color: ${partyText} !important; overflow-wrap: anywhere; }
  .section-title, .payment-title, .team-title {
    background: transparent !important; color: ${text} !important;
    border-bottom: 1px solid ${border} !important; border-radius: 0 !important;
    font-size: ${styles.headerFontSize ?? 14}px !important; padding: 0 0 8px !important; margin-bottom: 12px !important;
  }
  .items-table, .billboards-table, .movements-table, .rental-table {
    width: 100% !important; border-collapse: collapse !important;
    border-radius: 0 !important; overflow: visible !important;
    font-size: ${bodySize}px !important; margin-bottom: 18px !important; line-height:1.65;
  }
  :is(.items-table, .billboards-table, .movements-table, .rental-table) th {
    background: ${headerBg} !important; color: ${headerText} !important;
    border: 1px solid ${border} !important; padding: 10px 7px !important;
    text-align: center; font-weight: 700;
  }
  :is(.items-table, .billboards-table, .movements-table, .rental-table) td {
    border: 1px solid ${border} !important; padding: 10px 7px !important;
    color: ${text}; vertical-align: middle; overflow-wrap: anywhere;
  }
  :is(.items-table, .billboards-table, .movements-table, .rental-table) tbody tr:nth-child(odd) { background: ${odd} !important; }
  :is(.items-table, .billboards-table, .movements-table, .rental-table) tbody tr:nth-child(even) { background: ${even} !important; }
  .items-table tbody tr.subtotal-row { background: ${styles.subtotalBgColor || styles.subtotalBg || even} !important; }
  .items-table tbody tr.grand-total-row { background: ${totalBg} !important; }
  .items-table tbody tr.grand-total-row td { color: ${totalText} !important; padding: 9px 6px !important; }
  .stats-cards { gap: 16px !important; flex-wrap:wrap; justify-content:flex-end; }
  .stat-card { padding-inline-start:16px; border-inline-start:1px solid ${border}; }
  .stat-value { font-size: ${Math.min(styles.statValueFontSize ?? 22, 24)}px !important; }
  .summary-section, .cost-section {
    background: ${partyBg} !important; color: ${partyText} !important;
    border: 1px solid ${border} !important; border-radius: ${radius}px !important;
    padding: 10px !important; margin-top: 12px !important; box-shadow: none !important;
    break-inside: avoid;
  }
  .summary-grid, .cost-grid { gap: 8px !important; margin-bottom: 8px !important; }
  .summary-item, .summary-box, .cost-item {
    background: transparent !important; color: ${partyText} !important;
    border: 0 !important; border-radius: 0 !important; padding: 6px !important; box-shadow: none !important;
  }
  .summary-label, .cost-label { color: ${partyText} !important; font-size: ${Math.max(10, bodySize - 1)}px !important; opacity: 1 !important; }
  .summary-value, .cost-value { color: ${partyText} !important; font-size: ${bodySize + 4}px !important; overflow-wrap: anywhere; }
  .total-amount, .total-section, .amount-section, .final-balance {
    background: ${totalBg} !important; color: ${totalText} !important;
    border: 1px solid ${styles.totalBorderColor || border} !important;
    border-radius: ${radius}px !important; padding: 10px 12px !important;
    margin-top: 10px !important; font-size: ${bodySize + 6}px !important;
    box-shadow: none !important; overflow-wrap: anywhere; break-inside: avoid;
  }
  .amount-section .amount, .amount-section .currency, .amount-section .amount-words { color: ${totalText} !important; }
  .amount-section .amount { font-size: ${bodySize + 10}px !important; }
  .amount-row { flex-wrap: wrap; gap: 8px; }
  .notes-section, .notes { border-radius: ${radius}px !important; padding: 12px 14px !important;
    margin-top: 16px !important; line-height:1.9; break-inside:avoid;
    background:#fafaf9 !important; color:${text} !important; border:1px solid ${border} !important; }
  .num { direction:ltr; unicode-bidi:isolate; font-variant-numeric:tabular-nums; }
  .signature-stamp-section { margin-top:28px; padding-top:16px; border-top:1px solid ${border}; break-inside:avoid; }
  .signature-block-title { font-size:${bodySize}px; margin-bottom:44px; }
  .signature-line { border-top:1px solid ${border}; }
  .u-footer { margin-bottom:0; margin-top:20px; padding-top:10px; break-inside:avoid; }
  .operational-task-image { width: 65px; max-height: 60px; object-fit: contain; display: inline-block; margin: 2px; }
  .operational-task-description { font-size: ${Math.max(10, bodySize - 1)}px; margin-top: 3px; }
  :is(.items-table, .billboards-table, .movements-table, .rental-table) thead { display: table-header-group; }
  :is(.items-table, .billboards-table, .movements-table, .rental-table) tr { break-inside: avoid; }
  @media print {
    .u-header { margin-top: 0 !important; padding-top: 2px !important; }
  }
  ${PRINT_INK_SAVER_CSS}
  /* Fine rules carry the brand identity without large solid ink areas. */
  html body:not([data-keep-print-colors]):not(:has(.os-mark)) :is(.items-table, .billboards-table, .movements-table, .rental-table) thead th {
    border-top:2px solid ${accent} !important; border-bottom:1px solid ${border} !important;
    padding-top:11px !important; padding-bottom:11px !important;
  }
  html body:not([data-keep-print-colors]):not(:has(.os-mark)) .items-table tbody tr.subtotal-row td {
    background:#fff !important; padding:7px !important; font-weight:400;
  }
  html body:not([data-keep-print-colors]):not(:has(.os-mark)) .items-table tbody tr.grand-total-row td {
    border-top:2px solid ${accent} !important; padding:12px 7px !important; font-weight:700;
  }
  html body:not([data-keep-print-colors]):not(:has(.os-mark)) :is(.total-section, .total-amount, .amount-section, .final-balance) {
    border-inline-start:3px solid ${accent} !important;
  }
  `;
}

interface OperationalItem {
  billboard_name?: string; billboard_size?: string; description?: string | null;
  quantity: number; unit_cost: number; total_cost: number;
  width?: number; height?: number; area?: number;
  billboard_image?: string; cutout_image_url?: string | null;
  design_face_a?: string | null; design_face_b?: string | null;
}
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const number = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 3 });
export function renderOperationalTaskTable(items: OperationalItem[], type: 'cut' | 'print'): string {
  const hasImages = items.some(item => item.billboard_image || item.cutout_image_url || item.design_face_a || item.design_face_b);
  return `<table class="items-table operational-task-table"><thead><tr>
    <th>#</th><th>اللوحة / البيان</th><th>المقاس</th>${type === 'print' ? '<th>المساحة م²</th>' : ''}<th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th>${hasImages ? '<th>الصور والتصاميم</th>' : ''}
    </tr></thead><tbody>${items.map((item, index) => `<tr>
      <td>${index + 1}</td><td style="text-align:right">${escape(item.billboard_name || item.description || 'لوحة')}<div class="operational-task-description">${item.billboard_name ? escape(item.description) : ''}</div></td>
      <td>${escape(item.billboard_size || (item.width && item.height ? `${item.width} × ${item.height}` : '—'))}</td>
      ${type === 'print' ? `<td><span class="num">${number(item.area || 0)}</span></td>` : ''}
      <td><span class="num">${number(item.quantity)}</span></td><td><span class="num">${number(item.unit_cost)}</span> د.ل</td><td><strong class="num">${number(item.total_cost)}</strong> د.ل</td>
      ${hasImages ? `<td>${[item.billboard_image, item.cutout_image_url, item.design_face_a, item.design_face_b].filter(Boolean).map(url => `<img class="operational-task-image" src="${escape(url)}" alt="صورة اللوحة أو التصميم" />`).join('')}</td>` : ''}
      </tr>`).join('')}</tbody></table>`;
}
