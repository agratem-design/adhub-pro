/**
 * أجزاء الفواتير المشتركة — تُرسم بالنمط الموحد (unifiedDocument.ts).
 * الألوان كلها من إعدادات الطباعة؛ لا ألوان ثابتة هنا.
 */
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

/** شريط الإجمالي ثم تحته على اليسار صندوق التفاصيل (المجموع الفرعي، الخصم...) */
export function invoiceSummaryHtml(rows: { label: string; value: string }[], total: string, totalLabel = 'الإجمالي المستحق'): string {
  return `<div class="invoice-summary"><div class="os-total grand-total-row invoice-summary-total" style="margin-top:14px"><span class="lbl">${escape(totalLabel)}</span><strong class="amt num">${escape(total)}</strong></div>
    ${rows.length ? `<div class="os-recon">${rows.map(row => `<div class="invoice-summary-line"><span>${escape(row.label)}</span><span class="num">${escape(row.value)}</span></div>`).join('')}<div><span>${escape(totalLabel)}</span><span class="num">${escape(total)}</span></div></div>` : ''}</div>`;
}

/** رأس الفواتير المعتمد (الهيدر وبيانات المستند) — بقية الجسم من unifiedDocumentCss */
export const invoiceBrandCss = `
  body.invoice-brand { --invoice-gold:#d6ac40; color:#222; line-height:1.65; }
  .invoice-brand .u-header { border:0 !important; border-bottom:2px solid var(--invoice-gold) !important; background:#fff !important; min-height:96px !important; margin-bottom:16px !important; padding:0 0 16px !important; }
  .invoice-brand .u-header .u-invoice-details:empty { display:none; }
  .invoice-brand .u-invoice-info { text-align:right; }
  .invoice-brand .u-invoice-title { font-size:26px; line-height:1.4; color:#222; }
  .invoice-brand .u-invoice-subtitle { color:#666; letter-spacing:1px; font-size:11px; font-weight:400; opacity:1; }
  .invoice-brand .u-logo { max-width:220px; }
  .invoice-brand .invoice-meta { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px 24px; margin:0 0 16px; padding:9px 12px; border:1px solid #d9d9d9; font-size:11px; }
  .invoice-brand .invoice-meta > div { width:auto !important; }
  .invoice-brand .invoice-meta .num { color:#222; font-size:12px; }
  .invoice-brand .u-footer { border-top:1px solid #ccc; font-size:10px; }
`;

export function invoiceNotesHtml(words: string, notes?: string): string {
  return `<div class="notes-section">${words ? `<div class="os-words invoice-note-line"><strong>المبلغ بالحروف:</strong> <span>${escape(words)}</span></div>` : ''}${notes ? `<div class="os-note invoice-note-line"><strong>ملاحظات:</strong> <span>${escape(notes)}</span></div>` : ''}</div>`;
}
