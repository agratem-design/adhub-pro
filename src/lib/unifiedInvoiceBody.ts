import { PRINT_INK_SAVER_CSS } from './printInkSaver';
/** Shared invoice interiors, based on the receipt and sizes statement. */
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
  return `
  @font-face { font-family: 'Doran'; src: url('/Doran-Regular.otf') format('opentype'); font-weight: 400; }
  @font-face { font-family: 'Doran'; src: url('/Doran-Bold.otf') format('opentype'); font-weight: 700; }
  @font-face { font-family: 'Manrope'; src: url('/Manrope-Regular.otf') format('opentype'); font-weight: 400; }
  @font-face { font-family: 'Manrope'; src: url('/Manrope-Bold.otf') format('opentype'); font-weight: 700; }
  html, body { font-family: ${styles.fontFamily || "'Doran', sans-serif"} !important; }
  /* Shared interior: restrained sections, full-width tables, compact totals. */
  :root { --invoice-body-border: ${border}; --invoice-body-text: ${text}; }
  .invoice-print-label {
    display: inline-block; max-width: 100%; box-sizing: border-box;
    background: transparent !important; color: ${text} !important;
    border: 1px solid ${border} !important; border-radius: 3px !important;
    padding: 2px 5px !important; font-size: 10px !important;
    line-height: 1.5 !important; font-weight: 400 !important;
    vertical-align: middle; white-space: normal; overflow-wrap: anywhere;
  }
  .u-invoice-info { text-align: right; }
  .u-header { min-height:88px !important; height:auto !important; border:0 !important;
    border-bottom:1px solid ${border} !important; border-radius:0 !important;
    padding:18px 0 14px !important; margin-top:12px !important; margin-bottom:16px !important;
    box-shadow:none !important; align-items:center; }
  .u-logo { min-height:64px; object-fit:contain !important; }
  .u-invoice-details { font-size: 11px; line-height: 1.6; overflow-wrap: normal; }
  .u-invoice-details > div { display: block !important; width: 100%; direction: rtl; }
  .u-invoice-details > div > span { display: inline !important; margin-inline-end: 4px; }
  .u-invoice-details strong { display: inline !important; white-space: nowrap; overflow-wrap: normal; }
  .u-invoice-details span, .u-invoice-details strong { font-size: inherit; line-height: inherit; }
  .customer-section, .customer-info, .info-section, .team-info, .payment-info {
    background: ${partyBg} !important; color: ${partyText} !important;
    border: 1px solid ${styles.customerSectionBorderColor || styles.customerBorder || border} !important;
    border-radius: ${radius}px !important; box-shadow: none !important;
    padding: 10px 12px !important; margin-bottom: 12px !important;
  }
  .info-box, .info-row, .team-details, .payment-details { min-width: 0; }
  .info-box { background: transparent !important; box-shadow: none !important; border-radius: 0 !important; padding: 6px 8px !important; }
  .info-label, .customer-label, .item-detail-label { color: ${partyText} !important; opacity: .8; font-size: ${Math.max(10, bodySize - 1)}px !important; }
  .info-value, .customer-detail { color: ${partyText} !important; overflow-wrap: anywhere; }
  .section-title, .payment-title, .team-title {
    background: transparent !important; color: ${text} !important;
    border-bottom: 1px solid ${border} !important; border-radius: 0 !important;
    font-size: ${styles.headerFontSize ?? 14}px !important; padding: 0 0 6px !important; margin-bottom: 8px !important;
  }
  .items-table, .billboards-table, .movements-table, .rental-table {
    width: 100% !important; border-collapse: collapse !important;
    border-radius: 0 !important; overflow: visible !important;
    font-size: ${bodySize}px !important; margin-bottom: 12px !important;
  }
  :is(.items-table, .billboards-table, .movements-table, .rental-table) th {
    background: ${headerBg} !important; color: ${headerText} !important;
    border: 1px solid ${border} !important; padding: 8px 6px !important;
    text-align: center; font-weight: 700;
  }
  :is(.items-table, .billboards-table, .movements-table, .rental-table) td {
    border: 1px solid ${border} !important; padding: 7px 6px !important;
    color: ${text}; vertical-align: middle; overflow-wrap: anywhere;
  }
  :is(.items-table, .billboards-table, .movements-table, .rental-table) tbody tr:nth-child(odd) { background: ${even} !important; }
  :is(.items-table, .billboards-table, .movements-table, .rental-table) tbody tr:nth-child(even) { background: ${odd} !important; }
  .items-table tbody tr.subtotal-row { background: ${styles.subtotalBgColor || styles.subtotalBg || even} !important; }
  .items-table tbody tr.grand-total-row { background: ${totalBg} !important; }
  .items-table tbody tr.grand-total-row td { color: ${totalText} !important; padding: 9px 6px !important; }
  .stats-cards { gap: 16px !important; }
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
  .notes-section, .notes { border-radius: ${radius}px !important; padding: 9px 12px !important; margin-top: 10px !important; }
  .operational-task-image { width: 65px; max-height: 60px; object-fit: contain; display: inline-block; margin: 2px; }
  .operational-task-description { font-size: ${Math.max(10, bodySize - 1)}px; margin-top: 3px; }
  :is(.items-table, .billboards-table, .movements-table, .rental-table) thead { display: table-header-group; }
  :is(.items-table, .billboards-table, .movements-table, .rental-table) tr { break-inside: avoid; }
  @media print {
    .u-header { margin-top: 0 !important; padding-top: 2px !important; }
  }
  ${PRINT_INK_SAVER_CSS}
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
