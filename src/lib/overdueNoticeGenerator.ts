import type { ResolvedPrintStyles } from './unifiedInvoiceBase';
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

export async function generateOverdueNoticeHTML(data: OverdueNoticeData, previewStyles?: ResolvedPrintStyles): Promise<string> {
  const t = previewStyles ?? await resolveInvoiceStyles('overdue_notice', {
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

/* ───────── فاتورة المتأخرات المجمعة لزبون (عدة بنود + الإجمالي المتأخر) ───────── */
export interface OverdueStatementItem {
  label: string;
  kind: string;
  date: string;
  overdueDays: number;
  amount: number;
}

export interface OverdueStatementData {
  customerName: string;
  /** اسم الشركة: يظهر عنواناً رئيسياً والزبون ممثلاً لها */
  customerCompany?: string;
  customerPhone?: string;
  items: OverdueStatementItem[];
  /** مجموع البنود قبل خصم الرصيد */
  grossTotal: number;
  /** الإجمالي المتأخر المستحق فعلاً (بعد خصم رصيد/مقاصات الحساب) */
  total: number;
  /** رصيد الحساب المخصوم إن وجد */
  credit?: number;
  currencySymbol?: string;
  currencyName?: string;
  autoPrint?: boolean;
}

const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
/** نص مع الأرقام بخط الأرقام واتجاه سليم */
const withNums = (s: string) => esc(String(s ?? '').replace(/#\s*(\d)/g, 'رقم $1')).replace(/\d[\d,.]*/g, m => `<span class="num" dir="ltr">${m}</span>`);
const dmyLtr = (s: string) => (s ? `<span class="num" dir="ltr">${s.slice(0, 10).split('-').reverse().join('/')}</span>` : '—');

/** تنسيق خاص بفاتورة المتأخرات: بطاقة العميل والتذييل */
const STATEMENT_CSS = `
  .od-customer { display:flex; justify-content:space-between; align-items:center; gap:16px; }
  .od-company { font-size:22px; font-weight:800; line-height:1.4; }
  .od-rep { margin-top:4px; font-size:13px; color:#444; }
  .od-rep b { font-weight:700; color:#111; }
  .od-phone { margin-top:2px; font-size:12px; color:#666; }
  .od-closing { margin-top:18px; padding:14px 16px; border-right:4px solid #b8860b; background:#faf7ef; border-radius:6px; font-size:13px; line-height:1.9; color:#3f3a2c; }
  .u-closing-message { margin-top:auto; padding:10px 0 6px !important; font-size:12px !important; font-weight:700; color:#8a6d1f !important; letter-spacing:.2px; }
  .u-footer { border-top:2px solid #b8860b !important; padding:10px 6px 6px !important; font-size:10.5px !important; color:#555 !important; }
  .u-footer-contacts { justify-content:flex-start !important; gap:6px 22px !important; }
  .u-footer-contact bdi { unicode-bidi:isolate; }
  .u-footer-contact svg { color:#b8860b; }
  .u-page-number { padding:2px 10px; border:1px solid #e5dcc3; border-radius:999px; background:#faf7ef; color:#6b5a2e; }
`;

export async function generateOverdueStatementHTML(data: OverdueStatementData, previewStyles?: ResolvedPrintStyles): Promise<string> {
  const t = previewStyles ?? await resolveInvoiceStyles('overdue_notice', {
    titleAr: 'فاتورة المتأخرات',
    titleEn: 'OVERDUE INVOICE',
  });
  const currency = data.currencySymbol || 'د.ل';
  const currencyName = data.currencyName || 'دينار ليبي';
  const todayIso = new Date().toISOString().slice(0, 10);
  const ref = `OD-${todayIso.replace(/-/g, '')}`;
  const maxDays = data.items.reduce((m, i) => Math.max(m, i.overdueDays || 0), 0);
  const money = (n: number) => `<span class="num" dir="ltr">${formatNum(n)}</span> ${currency}`;

  const rows = data.items.map((it, i) => `
        <tr class="${i % 2 ? 'odd-row' : 'even-row'}">
          <td style="text-align:center;"><span class="num">${i + 1}</span></td>
          <td style="text-align:right;"><b>${withNums(it.label)}</b><div style="font-size:11px;color:#666;">${esc(it.kind)}</div></td>
          <td style="text-align:center;">${dmyLtr(it.date)}</td>
          <td style="text-align:center;">${it.overdueDays > 0 ? `<span style="color:#b91c1c;font-weight:700;"><span class="num">${it.overdueDays}</span> يوم</span>` : '—'}</td>
          <td style="text-align:center;font-weight:700;">${money(it.amount)}</td>
        </tr>`).join('');

  const credit = Number(data.credit) || 0;
  const bodyContent = `
    <table class="items-table">
      <thead>
        <tr>
          <th style="width:6%;">#</th>
          <th>البيان</th>
          <th style="width:16%;">تاريخ الاستحقاق</th>
          <th style="width:14%;">التأخير</th>
          <th style="width:20%;">المبلغ</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        ${credit > 0.5 ? `
        <tr class="subtotal-row">
          <td colspan="4" class="totals-label">المجموع</td>
          <td class="totals-value">${money(data.grossTotal)}</td>
        </tr>
        <tr class="subtotal-row">
          <td colspan="4" class="totals-label">يُخصم رصيد ومقاصات الحساب</td>
          <td class="totals-value">- ${money(credit)}</td>
        </tr>` : ''}
        <tr class="grand-total-row">
          <td colspan="4" class="totals-label">إجمالي المتأخر المستحق</td>
          <td class="totals-value">${money(data.total)}</td>
        </tr>
      </tbody>
    </table>

    <div class="notes-section">
      المبلغ بالكلمات: ${numberToArabicWords(Math.round(data.total))} ${currencyName} فقط لا غير
    </div>

    <div class="od-closing">
      نأمل التكرم بتسوية المبالغ المستحقة أعلاه في أقرب وقت ممكن.<br>
      وفي حال إتمام السداد، يُرجى اعتبار هذه الفاتورة للعلم فقط، مع تزويدنا بما يفيد السداد لتحديث حسابكم لدينا.
    </div>
  `;

  const company = data.customerCompany?.trim();
  const statsCards = `
      <div class="stat-card">
        <div class="stat-value"><span class="num">${data.items.length}</span></div>
        <div class="stat-label">بند متأخر</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:#dc2626;"><span class="num">${maxDays}</span></div>
        <div class="stat-label">أقصى تأخير (يوم)</div>
      </div>`;
  const customerHtml = !t.showCustomerSection ? '' : `
  <div class="customer-section od-customer">
    <div>
      <div class="customer-label">${company ? 'السادة / الشركة' : 'العميل'}</div>
      <div class="od-company">${esc(company || data.customerName)}</div>
      ${company && company !== data.customerName ? `<div class="od-rep">ويمثلها: <b>${esc(data.customerName)}</b></div>` : ''}
      ${data.customerPhone ? `<div class="od-phone">هاتف: <bdi dir="ltr" class="num">${esc(data.customerPhone)}</bdi></div>` : ''}
    </div>
    <div class="stats-cards">${statsCards}</div>
  </div>`;

  return wrapInDocument(t, {
    title: `فاتورة متأخرات - ${company || data.customerName}`,
    headerMetaHtml: `
      رقم المرجع: <span class="num" dir="ltr">${ref}</span><br/>
      التاريخ: ${dmyLtr(todayIso)}
    `,
    customerHtml,
    bodyContent,
    extraCSS: STATEMENT_CSS,
    autoPrint: data.autoPrint,
  });
}
