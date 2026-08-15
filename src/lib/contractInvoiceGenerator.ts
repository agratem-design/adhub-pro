/**
 * Unified Contract Invoice HTML Generator
 * يستخدم القاعدة الموحدة (unifiedInvoiceBase) + fetchPrintSettingsForInvoice
 */

import { resolveInvoiceStyles, formatNum, formatDateForPrint, wrapInDocument, generateCustomerHTML } from './unifiedInvoiceBase';
import { numberToArabicWords } from '@/lib/printUtils';
import { hexToRgba } from '@/hooks/useInvoiceSettingsSync';

export interface ContractInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  contractId: string | number;
  customerName: string;
  customerCompany?: string;
  customerPhone?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  contractDuration?: string | number;
  currencySymbol: string;
  currencyWrittenName: string;
  items: Array<{
    size: string;
    faces: number | string;
    billboardCount: number | string;
    unitPrice: number | string;
    totalPrice: number | string;
  }>;
  totalBillboards: number;
  grandTotal: number;
  discountInfo?: {
    display: string;
    text: string;
    type: string;
    value: number;
  } | null;
  discountAmount?: number;
  rentCost?: number;
  operatingFee?: number;
  printCostEnabled?: boolean;
  autoPrint?: boolean;
}

export async function generateContractInvoiceHTML(data: ContractInvoiceData): Promise<string> {
  const t = await resolveInvoiceStyles('contract', {
    titleAr: 'فاتورة العقد',
    titleEn: 'CONTRACT INVOICE',
  });

  // Items with fixed rows
  const FIXED_ROWS = 10;
  const displayItems = [...data.items];
  while (displayItems.length < FIXED_ROWS) {
    displayItems.push({ size: '', faces: '', billboardCount: '', unitPrice: '', totalPrice: '' } as any);
  }

  const bodyContent = `
    <table class="items-table">
      <thead>
        <tr>
          <th style="width:6%">#</th>
          <th style="width:30%">المقاس</th>
          <th style="width:12%">عدد الأوجه</th>
          <th style="width:12%">الكمية</th>
          <th style="width:20%">سعر اللوحة</th>
          <th style="width:20%">الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${displayItems.map((item: any, idx: number) => {
          const isEmpty = !item.size;
          return `
          <tr class="${idx % 2 === 0 ? 'even-row' : 'odd-row'}">
            <td>${isEmpty ? '' : idx + 1}</td>
            <td style="font-weight:600;">${isEmpty ? '' : item.size}</td>
            <td>
              ${isEmpty ? '' : `<span style="display:inline-block;padding:3px 10px;border-radius:20px;background-color:${item.faces === 1 ? '#e0f2fe' : t.primaryColor + '20'};color:${item.faces === 1 ? '#0369a1' : t.primaryColor};font-family:'Manrope',sans-serif;font-weight:bold;font-size:${t.bodyFontSize - 1}px;">${item.faces}</span>`}
            </td>
            <td style="font-family:'Manrope',sans-serif;font-weight:bold;">${isEmpty ? '' : item.billboardCount}</td>
            <td>${isEmpty ? '' : `<span class="num">${formatNum(Number(item.unitPrice))}</span> ${data.currencySymbol}`}</td>
            <td style="color:${t.primaryColor};font-weight:bold;">${isEmpty ? '' : `<span class="num">${formatNum(Number(item.totalPrice))}</span> ${data.currencySymbol}`}</td>
          </tr>`;
        }).join('')}

        ${data.discountInfo ? `
          <tr class="subtotal-row" style="color:#28a745;">
            <td colspan="5" style="text-align:left;">الخصم (${data.discountInfo.display})</td>
            <td style="font-family:'Manrope',sans-serif;color:#28a745;">- <span class="num">${formatNum(data.discountAmount || 0)}</span> ${data.currencySymbol}</td>
          </tr>
        ` : ''}


        <tr class="grand-total-row">
          <td colspan="5" class="totals-label">الإجمالي للعميل (${data.totalBillboards} لوحة)</td>
          <td class="totals-value"><span class="num">${formatNum(data.grandTotal)}</span> ${data.currencySymbol}</td>
        </tr>
      </tbody>
    </table>

    <div class="notes-section">
      المبلغ بالكلمات: ${numberToArabicWords(data.grandTotal)} ${data.currencyWrittenName}
      ${data.printCostEnabled ? '<br><small style="color:#28a745;">* الأسعار شاملة تكلفة الطباعة</small>' : '<br><small style="color:#6c757d;">* الأسعار غير شاملة تكلفة الطباعة</small>'}
    </div>
  `;

  const customerHtml = generateCustomerHTML(t, {
    label: 'العميل',
    name: data.customerName,
    company: data.customerCompany,
    statsCards: `
      <div class="stat-card">
        <div class="stat-value">${data.totalBillboards}</div>
        <div class="stat-label">لوحة</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.contractDuration || '-'}</div>
        <div class="stat-label">يوم</div>
      </div>
    `,
  });

  return wrapInDocument(t, {
    title: `فاتورة العقد ${data.contractId}`,
    headerMetaHtml: `
      رقم الفاتورة: <span class="num">${data.invoiceNumber}</span><br/>
      التاريخ: <span class="num">${formatDateForPrint(data.invoiceDate, t.showHijriDate)}</span><br/>
      رقم العقد: <span class="num">${data.contractId || 'غير محدد'}</span>
    `,
    customerHtml,
    bodyContent,
    autoPrint: data.autoPrint,
  });
}
