/**
 * Unified Purchase Invoice HTML Generator
 * يستخدم نفس القاعدة الموحدة كفاتورة العقد
 */

import { resolveInvoiceStyles, formatNum, formatDateForPrint, wrapInDocument, generateCustomerHTML } from './unifiedInvoiceBase';
import { numberToArabicWords } from '@/lib/printUtils';
import { fetchInvoiceExtras, generateBankAndStampHTML } from '@/utils/invoiceExtras';

export interface PurchaseInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  invoiceName?: string;
  supplierName: string;
  supplierId?: string;
  supplierPhone?: string;
  supplierCompany?: string;
  billboardImage?: string;
  billboardName?: string;
  isFriendRental?: boolean;
  showTotalMeters?: boolean;
  items: Array<{
    description: string;
    quantity: number;
    unit?: string;
    unitPrice: number;
    total: number;
    durationMonths?: number;
    image_url?: string;
    size?: string;
    faces?: number;
    width?: number | null;
    height?: number | null;
    depth?: number | null;
    billboardName?: string;
    locationDetails?: string;
    startDate?: string;
    isContractHeader?: boolean;
    isContractSubRow?: boolean;
  }>;
  discount?: number;
  totalAmount: number;
  notes?: string;
  autoPrint?: boolean;
}

function parseSizeToMeters(size?: string): number {
  if (!size) return 0;
  const match = size.match(/(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+(?:\.\d+)?)/);
  if (match) return parseFloat(match[1]) * parseFloat(match[2]);
  return 0;
}

export async function generatePurchaseInvoiceHTML(data: PurchaseInvoiceData): Promise<string> {
  const [t, extras] = await Promise.all([
    resolveInvoiceStyles('purchase_invoice', {
      titleAr: data.invoiceName || 'فاتورة مشتريات',
      titleEn: 'PURCHASE INVOICE',
    }),
    fetchInvoiceExtras(),
  ]);

  const subtotal = data.items.reduce((sum, item) => sum + item.total, 0);
  const discount = data.discount || 0;
  const isFriend = data.isFriendRental === true;

  let bodyContent: string;

  if (isFriend) {
    // Friend rental layout: # | Image | Description | Size | Faces | Duration | Total
    const totalFaces = data.items.reduce((s, item) => s + (item.faces || 0), 0);
    const totalMeters = data.items.reduce((s, item) => {
      const area = parseSizeToMeters(item.size);
      return s + area * (item.faces || 1);
    }, 0);

    const rowsHtml = data.items.map((item, idx) => {
      const imgUrl = item.image_url || ((data.items.length === 1 && data.billboardImage) ? data.billboardImage : null);
      const formattedStartDate = item.startDate ? formatDateForPrint(item.startDate) : '—';
      
      const isHeader = item.isContractHeader === true;
      const isSubRow = item.isContractSubRow === true;
      
      const rowStyle = isHeader 
        ? `background-color: ${t.primaryColor}10; font-weight: bold;` 
        : isSubRow 
          ? `font-size: 10px; opacity: 0.95;` 
          : ``;
          
      const displayTotal = isSubRow 
        ? '<span style="font-size: 10px; color: #777; font-weight: normal;">مضمن في العقد</span>' 
        : `<span class="num">${formatNum(item.total)}</span> د.ل`;
        
      const displayDuration = isHeader 
        ? '—' 
        : `<span class="num">${item.durationMonths || 0}</span> شهر`;

      const displayFaces = isHeader && !item.faces
        ? '—'
        : `<span class="num">${item.faces || 0}</span>`;

      return `
      <tr class="${idx % 2 === 0 ? 'even-row' : 'odd-row'}" style="${rowStyle}">
        <td>${isSubRow ? `↳` : idx + 1}</td>
        <td style="padding:4px;">
          ${imgUrl ? `<img src="${imgUrl}" alt="" style="width:70px;height:50px;object-fit:cover;border-radius:4px;border:1px solid #ddd;" />` : '<div style="width:70px;height:50px;background:#f0f0f0;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#999;font-size:10px;">—</div>'}
        </td>
        <td style="text-align:right;font-size:11px;line-height:1.3;white-space:normal;">${item.locationDetails || '—'}</td>
        <td>${item.size || '—'}</td>
        <td>${displayFaces}</td>
        <td>${formattedStartDate}</td>
        <td>${displayDuration}</td>
        <td style="color:${t.primaryColor};font-weight:bold;">${displayTotal}</td>
      </tr>
    `;
    }).join('');

    bodyContent = `
      <table class="items-table">
        <thead>
          <tr>
            <th style="width:4%">#</th>
            <th style="width:10%">الصورة</th>
            <th style="width:42%">الموقع</th>
            <th style="width:10%">المقاس</th>
            <th style="width:8%">الأوجه</th>
            <th style="width:11%">تاريخ البداية</th>
            <th style="width:6%">المدة</th>
            <th style="width:9%">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          <tr class="subtotal-row">
            <td colspan="4" style="text-align:right;">المجموع الفرعي</td>
            <td><span class="num">${totalFaces}</span> وجه</td>
            <td colspan="2"></td>
            <td><span class="num">${formatNum(subtotal)}</span> د.ل</td>
          </tr>
          ${discount > 0 ? `
          <tr class="subtotal-row" style="color:#28a745;">
            <td colspan="7" style="text-align:right;">الخصم</td>
            <td style="color:#28a745;">- <span class="num">${formatNum(discount)}</span> د.ل</td>
          </tr>
          ` : ''}
          <tr class="total-meters-row" style="display:none;">
            <td colspan="7" style="text-align:right;">إجمالي الأمتار المربعة</td>
            <td><span class="num">${formatNum(totalMeters)}</span> م²</td>
          </tr>
          <tr class="grand-total-row">
            <td colspan="7" class="totals-label">الإجمالي النهائي</td>
            <td class="totals-value"><span class="num">${formatNum(data.totalAmount)}</span> د.ل</td>
          </tr>
        </tbody>
      </table>

      <div class="notes-section invoice-notes-section">
        المبلغ بالكلمات: ${numberToArabicWords(data.totalAmount)} دينار ليبي فقط لا غير
        ${data.notes ? `<br><br><strong class="invoice-rental-notes">ملاحظات:</strong> <span class="invoice-rental-notes">${data.notes}</span>` : ''}
      </div>

      ${generateBankAndStampHTML(extras, t.primaryColor)}
    `;
  } else {
    // Original layout for non-friend rentals
    const hasDuration = data.items.some(item => item.durationMonths != null);

    const rowsHtml = data.items.map((item, idx) => {
      const imgUrl = item.image_url || ((data.items.length === 1 && data.billboardImage) ? data.billboardImage : null);
      const dimParts: string[] = [];
      if (item.width) dimParts.push(`<span class="num">${item.width}</span>`);
      if (item.height) dimParts.push(`<span class="num">${item.height}</span>`);
      if (item.depth) dimParts.push(`<span class="num">${item.depth}</span>`);
      const dimHtml = dimParts.length >= 2 ? `<div style="font-size:11px;color:#666;margin-top:3px;">الأبعاد: ${dimParts.join(' × ')} سم</div>` : '';
      return `
      <tr class="${idx % 2 === 0 ? 'even-row' : 'odd-row'}">
        <td>${idx + 1}</td>
        <td style="text-align:right;font-weight:600;">
          <div style="display:flex;align-items:center;gap:10px;flex-direction:row-reverse;">
            ${imgUrl ? `<img src="${imgUrl}" alt="" style="width:80px;height:55px;object-fit:cover;border-radius:6px;border:1px solid #ddd;flex-shrink:0;" />` : ''}
            <div><span>${item.description || ''}</span>${dimHtml}</div>
          </div>
        </td>
        ${hasDuration ? `<td><span class="num">${item.durationMonths || 0}</span> شهر</td>` : ''}
        <td><span class="num">${item.quantity || 0}</span> ${item.unit || ''}</td>
        <td><span class="num">${formatNum(item.unitPrice)}</span> د.ل</td>
        <td style="color:${t.primaryColor};font-weight:bold;"><span class="num">${formatNum(item.total)}</span> د.ل</td>
      </tr>
    `;
    }).join('');

    const colCount = hasDuration ? 6 : 5;

    bodyContent = `
      <table class="items-table">
        <thead>
          <tr>
            <th style="width:6%">#</th>
            <th style="width:${hasDuration ? '34%' : '40%'}">الوصف</th>
            ${hasDuration ? '<th style="width:12%">المدة (أشهر)</th>' : ''}
            <th style="width:12%">الكمية</th>
            <th style="width:17%">سعر الوحدة</th>
            <th style="width:19%">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          <tr class="subtotal-row">
            <td colspan="${colCount - 1}" style="text-align:right;">المجموع الفرعي</td>
            <td><span class="num">${formatNum(subtotal)}</span> د.ل</td>
          </tr>
          ${discount > 0 ? `
          <tr class="subtotal-row" style="color:#28a745;">
            <td colspan="${colCount - 1}" style="text-align:right;">الخصم</td>
            <td style="color:#28a745;">- <span class="num">${formatNum(discount)}</span> د.ل</td>
          </tr>
          ` : ''}
          <tr class="grand-total-row">
            <td colspan="${colCount - 1}" class="totals-label">الإجمالي النهائي</td>
            <td class="totals-value"><span class="num">${formatNum(data.totalAmount)}</span> د.ل</td>
          </tr>
        </tbody>
      </table>

      <div class="notes-section">
        المبلغ بالكلمات: ${numberToArabicWords(data.totalAmount)} دينار ليبي فقط لا غير
        ${data.notes ? `<br><br><strong>ملاحظات:</strong> ${data.notes}` : ''}
      </div>

      ${generateBankAndStampHTML(extras, t.primaryColor)}
    `;
  }

  const customerHtml = generateCustomerHTML(t, {
    label: 'المورد',
    name: data.supplierName || 'غير محدد',
    company: data.supplierCompany,
    phone: data.supplierPhone,
    extraInfo: data.invoiceName ? `<div style="margin-top:6px;font-size:14px;color:${t.customerText};opacity:0.85;">${data.invoiceName}</div>` : '',
    statsCards: `
      <div class="stat-card">
        <div class="stat-value">${data.items.length}</div>
        <div class="stat-label">صنف</div>
      </div>
    `,
  });

  return wrapInDocument(t, {
    title: `فاتورة مشتريات - ${data.supplierName}`,
    headerMetaHtml: `
      رقم الفاتورة: <span class="num">${data.invoiceNumber}</span><br/>
      التاريخ: <span class="num">${formatDateForPrint(data.invoiceDate, t.showHijriDate)}</span>
    `,
    customerHtml,
    bodyContent,
    autoPrint: data.autoPrint,
  });
}
