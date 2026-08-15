/**
 * Unified Receipt HTML Generator
 * يستخدم نفس القاعدة الموحدة كفاتورة العقد
 */

import { resolveInvoiceStyles, formatNum, formatDateForPrint, wrapInDocument, generateCustomerHTML } from './unifiedInvoiceBase';
import { numberToArabicWords } from '@/lib/printUtils';

export interface ReceiptData {
  receiptNumber: string;
  receiptDate: string;
  customerName: string;
  customerId?: string;
  customerPhone?: string;
  customerCompany?: string;
  amount: number;
  paymentMethod?: string;
  contractNumber?: number;
  reference?: string;
  notes?: string;
  autoPrint?: boolean;
}

export async function generateReceiptHTML(data: ReceiptData): Promise<string> {
  const t = await resolveInvoiceStyles('receipt', {
    titleAr: 'إيصال استلام',
    titleEn: 'PAYMENT RECEIPT',
  });

  const paymentMethodAr = data.paymentMethod === 'cash' ? 'نقداً' 
    : data.paymentMethod === 'bank_transfer' ? 'تحويل بنكي'
    : data.paymentMethod === 'check' ? 'شيك'
    : data.paymentMethod || 'غير محدد';

  const bodyContent = `
    <table class="items-table">
      <tbody>
        <tr class="even-row">
          <td style="text-align:right;font-weight:700;width:30%;">المبلغ المستلم</td>
          <td style="text-align:center;font-size:20px;font-weight:700;color:${t.primaryColor};">
            <span class="num">${formatNum(data.amount)}</span> د.ل
          </td>
        </tr>
        <tr class="odd-row">
          <td style="text-align:right;font-weight:700;">طريقة الدفع</td>
          <td style="text-align:center;">${paymentMethodAr}</td>
        </tr>
        ${data.contractNumber ? `
        <tr class="even-row">
          <td style="text-align:right;font-weight:700;">رقم العقد</td>
          <td style="text-align:center;"><span class="num">${data.contractNumber}</span></td>
        </tr>
        ` : ''}
        ${data.reference ? `
        <tr class="odd-row">
          <td style="text-align:right;font-weight:700;">المرجع</td>
          <td style="text-align:center;">${data.reference}</td>
        </tr>
        ` : ''}
        <tr class="grand-total-row">
          <td class="totals-label">الإجمالي</td>
          <td class="totals-value"><span class="num">${formatNum(data.amount)}</span> د.ل</td>
        </tr>
      </tbody>
    </table>

    <div class="notes-section">
      المبلغ بالكلمات: ${numberToArabicWords(data.amount)} دينار ليبي فقط لا غير
      ${data.notes ? `<br><br><strong>ملاحظات:</strong> ${data.notes}` : ''}
    </div>

    <div class="signatures">
      <div class="signature-block">
        <div class="signature-line">توقيع المستلم</div>
      </div>
      <div class="signature-block">
        <div class="signature-line">توقيع المحاسب</div>
      </div>
    </div>
  `;

  const customerHtml = generateCustomerHTML(t, {
    label: 'الدافع',
    name: data.customerName,
    company: data.customerCompany,
    phone: data.customerPhone,
    statsCards: `
      <div class="stat-card">
        <div class="stat-value"><span class="num">${formatNum(data.amount)}</span></div>
        <div class="stat-label">د.ل</div>
      </div>
    `,
  });

  const metaLines = [
    `رقم الإيصال: <span class="num">${data.receiptNumber}</span>`,
    `التاريخ: <span class="num">${formatDateForPrint(data.receiptDate, t.showHijriDate)}</span>`,
  ];
  if (data.contractNumber) {
    metaLines.push(`رقم العقد: <span class="num">${data.contractNumber}</span>`);
  }

  return wrapInDocument(t, {
    title: `إيصال استلام - ${data.customerName}`,
    headerMetaHtml: metaLines.join('<br/>'),
    customerHtml,
    bodyContent,
    autoPrint: data.autoPrint,
  });
}
