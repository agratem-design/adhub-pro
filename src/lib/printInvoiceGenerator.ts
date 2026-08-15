/**
 * Unified Print Invoice HTML Generator (فاتورة الطباعة)
 * يستخدم القاعدة الموحدة (unifiedInvoiceBase) + fetchPrintSettingsForInvoice
 */

import { resolveInvoiceStyles, formatNum, formatDateForPrint, wrapInDocument, generateCustomerHTML, type ResolvedPrintStyles } from './unifiedInvoiceBase';
import { hexToRgba } from '@/hooks/useInvoiceSettingsSync';
import { numberToArabicWords } from '@/lib/printUtils';

export interface PrintItem {
  size: string;
  quantity: number;
  faces: number;
  totalFaces: number;
  area: number;
  pricePerMeter: number;
  totalArea: number;
  totalPrice: number;
  width: number;
  height: number;
  isCustomItem?: boolean;
  customDescription?: string;
}

export interface PrintInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  customerCompany?: string;
  customerId?: string;
  customerPhone?: string;
  contractNumbers?: string[];
  items: PrintItem[];
  currency: { code: string; name: string; symbol: string };
  discount?: number;
  discountType?: 'percentage' | 'fixed';
  discountAmount?: number;
  accountDeduction?: number;
  subtotal: number;
  totalAmount: number;
  notes?: string;
  paymentMethod?: string;
  printerForDisplay?: boolean;
  includedInContract?: boolean;
  isReinstallation?: boolean;
  autoPrint?: boolean;
}

function formatNumber(num: number): string {
  if (isNaN(num) || num === null || num === undefined) return '0';
  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function generateTableWithPrices(t: ResolvedPrintStyles, data: PrintInvoiceData): string {
  const totalQuantity = data.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalFaces = data.items.reduce((sum, item) => sum + (item.totalFaces || 0), 0);
  const totalArea = data.items.reduce((sum, item) => sum + ((item.area || 0) * (item.totalFaces || 0)), 0);

  const rowsHtml = data.items.map((item, idx) => {
    const displayName = item.isCustomItem ? (item.customDescription || item.size) : item.size;
    return `
      <tr class="${idx % 2 === 0 ? 'even-row' : 'odd-row'}">
        <td>${idx + 1}</td>
        <td style="font-weight:600;">${displayName}</td>
        <td><span class="num">${item.width?.toFixed(2) || '0'} × ${item.height?.toFixed(2) || '0'}</span></td>
        <td><span class="num" style="font-weight:bold;">${formatNumber(item.quantity)}</span></td>
        <td>
          <span style="display:inline-block;padding:3px 10px;border-radius:20px;background-color:${item.faces === 1 ? '#e0f2fe' : t.primaryColor + '20'};color:${item.faces === 1 ? '#0369a1' : t.primaryColor};font-family:'Manrope',sans-serif;font-weight:bold;font-size:${t.bodyFontSize - 1}px;">
            ${item.faces}
          </span>
        </td>
        <td><span class="num" style="font-weight:bold;">${formatNumber(item.totalFaces)}</span></td>
        <td><span class="num">${(item.area || 0).toFixed(2)} م²</span></td>
        <td><span class="num">${formatNumber(item.pricePerMeter)} ${data.currency.symbol}</span></td>
        <td style="color:${t.primaryColor};font-weight:bold;"><span class="num">${formatNumber(item.totalPrice)} ${data.currency.symbol}</span></td>
      </tr>
    `;
  }).join('');

  return `
    <table class="items-table">
      <thead>
        <tr>
          <th style="width:5%">#</th>
          <th style="width:14%">المقاس</th>
          <th style="width:12%">الأبعاد (م)</th>
          <th style="width:10%">الكمية</th>
          <th style="width:8%">الأوجه</th>
          <th style="width:10%">إجمالي الأوجه</th>
          <th style="width:11%">المساحة/وجه</th>
          <th style="width:12%">سعر المتر</th>
          <th style="width:18%">الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="subtotal-row">
          <td colspan="8" style="text-align:left;">المجموع الفرعي</td>
          <td><span class="num">${formatNumber(data.subtotal)} ${data.currency.symbol}</span></td>
        </tr>
        ${data.discountAmount && data.discountAmount > 0 ? `
        <tr class="subtotal-row" style="color:#e74c3c;">
          <td colspan="8" style="text-align:left;">الخصم ${data.discountType === 'percentage' ? `(${data.discount}%)` : ''}</td>
          <td style="color:#e74c3c;">- <span class="num">${formatNumber(data.discountAmount)} ${data.currency.symbol}</span></td>
        </tr>
        ` : ''}
        ${data.accountDeduction && data.accountDeduction > 0 ? `
        <tr class="subtotal-row" style="color:#0369a1;">
          <td colspan="8" style="text-align:left;">خصم من رصيد الحساب</td>
          <td style="color:#0369a1;">- <span class="num">${formatNumber(data.accountDeduction)} ${data.currency.symbol}</span></td>
        </tr>
        ` : ''}
        <tr class="grand-total-row">
          <td colspan="8" class="totals-label">الإجمالي النهائي</td>
          <td class="totals-value"><span class="num">${formatNumber(data.totalAmount)} ${data.currency.symbol}</span></td>
        </tr>
      </tbody>
    </table>
  `;
}

function generateTablePrinterMode(t: ResolvedPrintStyles, data: PrintInvoiceData): string {
  const totalQuantity = data.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalFaces = data.items.reduce((sum, item) => sum + (item.totalFaces || 0), 0);
  const totalArea = data.items.reduce((sum, item) => sum + ((item.area || 0) * (item.totalFaces || 0)), 0);

  const rowsHtml = data.items.map((item, idx) => {
    const displayName = item.isCustomItem ? (item.customDescription || item.size) : item.size;
    return `
      <tr class="${idx % 2 === 0 ? 'even-row' : 'odd-row'}">
        <td>${idx + 1}</td>
        <td style="font-weight:600;">${displayName}</td>
        <td><span class="num">${item.width?.toFixed(2) || '0'} × ${item.height?.toFixed(2) || '0'}</span></td>
        <td><span class="num" style="font-weight:bold;">${formatNumber(item.quantity)}</span></td>
        <td>
          <span style="display:inline-block;padding:3px 10px;border-radius:20px;background-color:${item.faces === 1 ? '#e0f2fe' : t.primaryColor + '20'};color:${item.faces === 1 ? '#0369a1' : t.primaryColor};font-family:'Manrope',sans-serif;font-weight:bold;font-size:${t.bodyFontSize - 1}px;">
            ${item.faces}
          </span>
        </td>
        <td><span class="num" style="font-weight:bold;">${formatNumber(item.totalFaces)}</span></td>
        <td style="color:${t.primaryColor};font-weight:bold;"><span class="num">${(item.area * item.totalFaces).toFixed(2)} م²</span></td>
      </tr>
    `;
  }).join('');

  return `
    <table class="items-table">
      <thead>
        <tr>
          <th style="width:6%">#</th>
          <th style="width:20%">المقاس</th>
          <th style="width:16%">الأبعاد (م)</th>
          <th style="width:14%">الكمية</th>
          <th style="width:12%">الأوجه</th>
          <th style="width:14%">إجمالي الأوجه</th>
          <th style="width:18%">إجمالي المساحة</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="subtotal-row">
          <td colspan="6" style="text-align:left;">إجمالي القسم (${totalQuantity} لوحة - ${totalFaces} وجه)</td>
          <td><span class="num">${totalArea.toFixed(2)} م²</span></td>
        </tr>
        <tr class="grand-total-row">
          <td colspan="6" class="totals-label">إجمالي المساحة الكلية</td>
          <td class="totals-value"><span class="num">${totalArea.toFixed(2)} م²</span></td>
        </tr>
      </tbody>
    </table>
  `;
}

export async function generatePrintInvoiceHTML(data: PrintInvoiceData): Promise<string> {
  const showPrices = !data.printerForDisplay;
  
  const t = await resolveInvoiceStyles('print_invoice', {
    titleAr: showPrices ? 'فاتورة طباعة' : 'أمر طباعة',
    titleEn: showPrices ? 'PRINT INVOICE' : 'PRINT ORDER',
  });

  const totalQuantity = data.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalFaces = data.items.reduce((sum, item) => sum + (item.totalFaces || 0), 0);

  // Reinstallation badge
  const reinstallBadge = data.isReinstallation ? `
    <div style="display:inline-flex;align-items:center;gap:6px;background:${t.primaryColor}12;border:1.5px solid ${t.primaryColor};color:${t.primaryColor};padding:5px 14px;border-radius:6px;font-size:12px;font-weight:700;margin-bottom:12px;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
      إعادة تركيب
    </div>
  ` : '';

  // Table content
  const tableHtml = showPrices ? generateTableWithPrices(t, data) : generateTablePrinterMode(t, data);

  // Notes
  const notesHtml = data.notes ? `
    <div class="notes-section">
      <strong>ملاحظات:</strong> ${data.notes}
    </div>
  ` : '';

  // Payment info
  const paymentHtml = (data.paymentMethod && showPrices) || data.includedInContract ? `
    <div style="margin-top:10px;padding:8px 12px;background-color:#f0f9ff;border-radius:6px;display:flex;gap:20px;font-size:${t.bodyFontSize - 1}px;color:#0369a1;">
      ${data.paymentMethod && showPrices ? `<span>طريقة الدفع: <strong>${data.paymentMethod}</strong></span>` : ''}
 ${data.includedInContract ? `<span style="color:#059669;"> مضمنة في العقد</span>` : ''}
    </div>
  ` : '';

  // Amount in words (only for priced mode)
  const amountWords = showPrices ? `
    <div class="notes-section" style="margin-top:10px;">
      المبلغ بالكلمات: ${numberToArabicWords(data.totalAmount)} ${data.currency.name} فقط لا غير
    </div>
  ` : '';

  const bodyContent = `
    ${reinstallBadge}
    ${tableHtml}
    ${amountWords}
    ${notesHtml}
    ${paymentHtml}
  `;

  const metaLines = [
    `رقم الفاتورة: <span class="num">${data.invoiceNumber}</span>`,
    `التاريخ: <span class="num">${formatDateForPrint(data.invoiceDate, t.showHijriDate)}</span>`,
  ];
  if (data.contractNumbers?.length) {
    metaLines.push(`العقود: <span class="num">${data.contractNumbers.join(' - ')}</span>`);
  }

  const customerHtml = generateCustomerHTML(t, {
    label: 'العميل',
    name: data.customerName,
    phone: data.customerPhone,
    company: data.customerCompany,
    statsCards: `
      <div class="stat-card">
        <div class="stat-value">${totalQuantity}</div>
        <div class="stat-label">لوحة</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${totalFaces}</div>
        <div class="stat-label">وجه</div>
      </div>
    `,
  });

  return wrapInDocument(t, {
    title: `فاتورة طباعة - ${data.customerName}`,
    headerMetaHtml: metaLines.join('<br/>'),
    customerHtml,
    bodyContent,
    autoPrint: data.autoPrint,
  });
}
