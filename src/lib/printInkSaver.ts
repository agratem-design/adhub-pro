/** Light printed surfaces retain dark text and borders without solid ink blocks. */
export const PRINT_INK_SAVER_CSS = `
html body :is(table th, .u-header, .measurements-header,
  .measurements-summary, .measurements-total-row, .receipt-summary-grand, .receipt-summary-balance,
  .amount-row.total, .grand-total-row, .total-row, .total-amount, .total-section, .amount-section,
  .final-balance, .invoice-total-section, .summary-section, .cost-section,
  [class*="grand-total"], [class*="total-box"], [class*="summary-total"]) {
  background: #ffffff !important;
  background-image: none !important;
  color: #262626 !important;
  box-shadow: none !important;
}
html body table th :is(span, strong, small, div) { color: #262626 !important; }
html body table th { border-bottom: 1px solid #737373 !important; }
/* Footer rows may carry inline backgrounds without a totals class. */
html body table tfoot,
html body table tfoot tr,
html body table tfoot td,
html body table tfoot th {
  background: #ffffff !important;
  background-image: none !important;
  color: #262626 !important;
}
html body table tfoot :is(span, strong, small, div, p) {
  background: transparent !important;
  color: #262626 !important;
}
html body table tfoot td { border-top: 1px solid #a3a3a3 !important; }
html body :is(.amount-row.total, .grand-total-row, .total-row, .total-amount, .total-section,
  .amount-section, .final-balance, .invoice-total-section,
  .receipt-summary-grand, .receipt-summary-balance, [class*="grand-total"], [class*="total-box"],
  [class*="summary-total"]) :is(td, span, strong, small, div, p) {
  background-color: transparent !important;
  color: #262626 !important;
}
html body :is(.total-section, .total-amount, .amount-section,
  .invoice-total-section, .receipt-summary-grand, .receipt-summary-balance) { border: 1px solid #a3a3a3 !important; }
`;

export function applyPrintInkSaver(html: string): string {
  if (html.includes('id="print-ink-saver"')) return html;
  const style = `<style id="print-ink-saver">${PRINT_INK_SAVER_CSS}</style>`;
  return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${style}</head>`) : style + html;
}
