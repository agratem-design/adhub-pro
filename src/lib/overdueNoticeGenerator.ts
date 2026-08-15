/**
 * Unified Overdue Notice HTML Generator (إشعار تأخير)
 * يستخدم القاعدة الموحدة (unifiedInvoiceBase) + fetchPrintSettingsForInvoice
 */

import { resolveInvoiceStyles, formatNum, formatDateForPrint, wrapInDocument, generateCustomerHTML } from './unifiedInvoiceBase';
import { numberToArabicWords } from '@/lib/printUtils';

export interface OverdueNoticeData {
  customerName: string;
  customerPhone?: string;
  customerCompany?: string;
  contractNumber: number;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  overdueDays: number;
  currencySymbol?: string;
  currencyName?: string;
  notes?: string;
  autoPrint?: boolean;
}

export async function generateOverdueNoticeHTML(data: OverdueNoticeData): Promise<string> {
  const t = await resolveInvoiceStyles('overdue_notice', {
    titleAr: 'إشعار تأخير دفعة',
    titleEn: 'OVERDUE NOTICE',
  });

  const currency = data.currencySymbol || 'د.ل';
  const currencyName = data.currencyName || 'دينار ليبي';
  const today = new Date().toLocaleDateString('ar-LY-u-nu-latn');

  const bodyContent = `
    <!-- Alert banner -->
    <div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:8px;padding:14px;margin-bottom:18px;text-align:center;">
      <div style="color:#92400e;font-size:14px;font-weight:700;line-height:1.4;">
        هذه الدفعة متأخرة عن موعد استحقاقها<br>
        يرجى المبادرة بالسداد في أقرب وقت
      </div>
    </div>

    <!-- Details table -->
    <table class="items-table">
      <tbody>
        <tr class="even-row">
          <td style="text-align:right;font-weight:700;width:35%;">رقم العقد</td>
          <td style="text-align:center;"><span class="num">${data.contractNumber}</span></td>
        </tr>
        <tr class="odd-row">
          <td style="text-align:right;font-weight:700;">رقم القسط</td>
          <td style="text-align:center;"><span class="num">${data.installmentNumber}</span></td>
        </tr>
        <tr class="even-row">
          <td style="text-align:right;font-weight:700;">تاريخ الاستحقاق</td>
          <td style="text-align:center;"><span class="num">${new Date(data.dueDate).toLocaleDateString('ar-LY-u-nu-latn')}</span></td>
        </tr>
        <tr class="odd-row">
          <td style="text-align:right;font-weight:700;">أيام التأخير</td>
          <td style="text-align:center;">
            <span style="display:inline-block;padding:4px 12px;background:#fee2e2;border:1px solid #dc2626;color:#991b1b;border-radius:5px;font-weight:700;">
              <span class="num">${data.overdueDays}</span> يوم
            </span>
          </td>
        </tr>
        <tr class="grand-total-row">
          <td class="totals-label">المبلغ المستحق</td>
          <td class="totals-value"><span class="num">${formatNum(data.amount)}</span> ${currency}</td>
        </tr>
      </tbody>
    </table>

    <div class="notes-section">
      المبلغ بالكلمات: ${numberToArabicWords(data.amount)} ${currencyName} فقط لا غير
      ${data.notes ? `<br><br><strong>ملاحظات:</strong> ${data.notes}` : ''}
    </div>

    <!-- Warning box -->
    <div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:8px;padding:16px;margin-top:18px;text-align:center;">
 <div style="color:#92400e;font-size:15px;font-weight:900;margin-bottom:6px;">️ تنبيه مهم</div>
      <div style="color:#78350f;font-size:13px;line-height:1.5;">
        يرجى تسوية المبلغ المستحق في أقرب وقت ممكن لتجنب أي إجراءات إضافية.
        <br>في حال وجود أي استفسار، يرجى التواصل مع قسم الحسابات.
      </div>
    </div>
  `;

  const customerHtml = generateCustomerHTML(t, {
    label: 'العميل',
    name: data.customerName,
    company: data.customerCompany,
    phone: data.customerPhone,
    statsCards: `
      <div class="stat-card">
        <div class="stat-value" style="color:#dc2626;"><span class="num">${data.overdueDays}</span></div>
        <div class="stat-label">يوم تأخير</div>
      </div>
    `,
  });

  return wrapInDocument(t, {
    title: `إشعار تأخير - عقد ${data.contractNumber}`,
    headerMetaHtml: `
      رقم العقد: <span class="num">${data.contractNumber}</span><br/>
      تاريخ الإشعار: <span class="num">${formatDateForPrint(today, t.showHijriDate)}</span>
    `,
    customerHtml,
    bodyContent,
    autoPrint: data.autoPrint,
  });
}
