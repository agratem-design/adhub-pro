/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📄 Unified Account Statement HTML Generator (Simple & Detailed Statements)
 * ═══════════════════════════════════════════════════════════════════════════
 * يولد كشف الحساب بنوعيه (المبسط والتفصيلي) باستخدام المحرك المالي المركزي الموحد:
 * (buildCanonicalCustomerLedger) لضمان تطابق الأرقام 100% مع شاشات النظام.
 */

import { resolveInvoiceStyles, formatNum, formatDateForPrint, wrapInDocument, generateCustomerHTML, type ResolvedPrintStyles } from './unifiedInvoiceBase';
import { numberToArabicWords } from '@/lib/printUtils';
import {
  CanonicalLedgerEntry,
  CanonicalCustomerTotals,
  CanonicalCustomerLedgerResult,
} from '@/lib/canonicalCustomerLedger';

export interface CustomerData {
  id: string;
  name: string;
  company?: string;
  phone?: string;
  email?: string;
}

export interface Currency {
  code: string;
  symbol: string;
  writtenName: string;
}

export interface AccountStatementData {
  customerData: CustomerData;
  ledgerResult?: CanonicalCustomerLedgerResult;
  transactions?: any[];
  statistics?: any;
  mode?: 'simple' | 'detailed';
  currency: Currency;
  startDate?: string;
  endDate?: string;
  hidePaymentDistribution?: boolean;
  hideStopAdjustments?: boolean;
  autoPrint?: boolean;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('ar-LY-u-nu-latn');
  } catch {
    return dateStr;
  }
}

function fmtNum(num: number): string {
  if (isNaN(num) || num === null || num === undefined) return '0';
  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * توليد أسطر الكشف المبسط (Simple Statement Rows)
 * 5 أعمدة واضحة بدون مصطلحات محاسبية معقدة
 */
function generateSimpleStatementRows(
  t: ResolvedPrintStyles,
  entries: CanonicalLedgerEntry[],
  currency: Currency
): string {
  let html = '';

  entries.forEach((entry, index) => {
    const isEven = index % 2 === 0;
    const rowClass = isEven ? 'even-row' : 'odd-row';

    let displayTitle = entry.description;
    let subtitleHtml = '';

    if (entry.subtitle) {
      subtitleHtml = `<div style="font-size:8.5px;color:#666;margin-top:2px;">${entry.subtitle}</div>`;
    }

    if (entry.type === 'opening_balance') {
      html += `
        <tr class="subtotal-row" style="background:${t.primaryColor}15 !important;font-weight:bold;">
          <td style="text-align:center;">—</td>
          <td style="text-align:center;font-size:9px;"><span class="num">${formatDate(entry.date)}</span></td>
          <td style="text-align:right;"><strong>${entry.description}</strong></td>
          <td style="text-align:center;">${entry.displayCharge > 0 ? `<span class="num">${currency.symbol} ${fmtNum(entry.displayCharge)}</span>` : '—'}</td>
          <td style="text-align:center;">${entry.displayReduction > 0 ? `<span class="num">${currency.symbol} ${fmtNum(entry.displayReduction)}</span>` : '—'}</td>
          <td style="text-align:center;font-weight:bold;"><span class="num">${currency.symbol} ${fmtNum(entry.runningBalance)}</span></td>
        </tr>
      `;
      return;
    }

    const chargeText = entry.displayCharge > 0 ? `${currency.symbol} ${fmtNum(entry.displayCharge)}` : '—';
    const reductionText = entry.displayReduction > 0 ? `${currency.symbol} ${fmtNum(entry.displayReduction)}` : '—';

    html += `
      <tr class="${rowClass}">
        <td style="text-align:center;">${index + 1}</td>
        <td style="text-align:center;font-size:9px;"><span class="num">${formatDate(entry.date)}</span></td>
        <td style="text-align:right;">
          <div style="font-weight:600;">${displayTitle}</div>
          ${subtitleHtml}
        </td>
        <td style="text-align:center;color:${entry.displayCharge > 0 ? '#b91c1c' : '#333'};font-weight:${entry.displayCharge > 0 ? '600' : 'normal'};">
          ${chargeText !== '—' ? `<span class="num">${chargeText}</span>` : '—'}
        </td>
        <td style="text-align:center;color:${entry.displayReduction > 0 ? '#15803d' : '#333'};font-weight:${entry.displayReduction > 0 ? '600' : 'normal'};">
          ${reductionText !== '—' ? `<span class="num">${reductionText}</span>` : '—'}
        </td>
        <td style="text-align:center;font-weight:bold;color:${entry.runningBalance < 0 ? '#15803d' : '#1e293b'};">
          <span class="num">${entry.runningBalance < 0 ? `${fmtNum(Math.abs(entry.runningBalance))} ${currency.symbol} (دائن)` : `${currency.symbol} ${fmtNum(entry.runningBalance)}`}</span>
        </td>
      </tr>
    `;
  });

  return html;
}

/**
 * توليد أسطر الكشف التفصيلي (Detailed Statement Rows)
 * 6 أعمدة محاسبية أنيقة مع إفصاحات كاملة
 */
function generateDetailedStatementRows(
  t: ResolvedPrintStyles,
  entries: CanonicalLedgerEntry[],
  currency: Currency
): string {
  let html = '';

  entries.forEach((entry, index) => {
    const isEven = index % 2 === 0;
    const rowClass = isEven ? 'even-row' : 'odd-row';

    let typeBadgeLabel = 'حركة';
    let typeBadgeColor = '#6b7280';

    if (entry.type === 'contract') {
      typeBadgeLabel = 'عقد إيجار لوحات طرقية';
      typeBadgeColor = '#2563eb';
    } else if (entry.type === 'composite_task') {
      typeBadgeLabel = entry.metadata?.badgeTitle || 'فاتورة طباعة';
      typeBadgeColor = '#7c3aed';
    } else if (entry.type === 'cash_payment') {
      typeBadgeLabel = 'سند قبض';
      typeBadgeColor = '#16a34a';
    } else if (entry.type === 'general_discount') {
      typeBadgeLabel = 'خصم عام';
      typeBadgeColor = '#d97706';
    } else if (entry.type === 'purchase_offset') {
      typeBadgeLabel = 'مقاصة مشتريات';
      typeBadgeColor = '#0891b2';
    } else if (entry.type === 'friend_company_offset') {
      typeBadgeLabel = 'مقاصة شركة صديقة';
      typeBadgeColor = '#059669';
    } else if (entry.type === 'sales_invoice') {
      typeBadgeLabel = 'فاتورة مبيعات';
      typeBadgeColor = '#4f46e5';
    } else if (entry.type === 'printed_invoice') {
      typeBadgeLabel = 'فاتورة طباعة';
      typeBadgeColor = '#9333ea';
    } else if (entry.type === 'opening_balance') {
      typeBadgeLabel = 'رصيد سابق';
      typeBadgeColor = '#475569';
    }

    let subtitleHtml = '';
    if (entry.subtitle) {
      subtitleHtml = `<div style="font-size:8.5px;color:#666;margin-top:2px;">${entry.subtitle}</div>`;
    }

    if (entry.type === 'opening_balance') {
      html += `
        <tr class="subtotal-row" style="background:${t.primaryColor}15 !important;font-weight:bold;">
          <td style="text-align:center;">—</td>
          <td style="text-align:center;font-size:9px;"><span class="num">${formatDate(entry.date)}</span></td>
          <td style="text-align:center;"><span style="font-size:8px;padding:2px 6px;border-radius:4px;background:#e2e8f0;color:#334155;font-weight:bold;">رصيد سابق</span></td>
          <td style="text-align:right;"><strong>${entry.description}</strong></td>
          <td style="text-align:center;">${entry.displayCharge > 0 ? `<span class="num">${currency.symbol} ${fmtNum(entry.displayCharge)}</span>` : '—'}</td>
          <td style="text-align:center;">${entry.displayReduction > 0 ? `<span class="num">${currency.symbol} ${fmtNum(entry.displayReduction)}</span>` : '—'}</td>
          <td style="text-align:center;font-weight:bold;"><span class="num">${currency.symbol} ${fmtNum(entry.runningBalance)}</span></td>
        </tr>
      `;
      return;
    }

    const chargeText = entry.displayCharge > 0 ? `${currency.symbol} ${fmtNum(entry.displayCharge)}` : '—';
    const reductionText = entry.displayReduction > 0 ? `${currency.symbol} ${fmtNum(entry.displayReduction)}` : '—';

    html += `
      <tr class="${rowClass}">
        <td style="text-align:center;">${index + 1}</td>
        <td style="text-align:center;font-size:9px;"><span class="num">${formatDate(entry.date)}</span></td>
        <td style="text-align:center;">
          <span style="font-size:8px;padding:2px 5px;border-radius:4px;border:1px solid ${typeBadgeColor}40;color:${typeBadgeColor};font-weight:600;white-space:nowrap;">
            ${typeBadgeLabel}
          </span>
        </td>
        <td style="text-align:right;">
          <div style="font-weight:600;">${entry.description}</div>
          <div style="font-size:8.5px;color:#555;">المرجع: ${entry.reference}${entry.notes && entry.notes !== '—' ? ` | ملاحظات: ${entry.notes}` : ''}</div>
          ${subtitleHtml}
        </td>
        <td style="text-align:center;color:${entry.displayCharge > 0 ? '#b91c1c' : '#333'};font-weight:${entry.displayCharge > 0 ? '600' : 'normal'};">
          ${chargeText !== '—' ? `<span class="num">${chargeText}</span>` : '—'}
        </td>
        <td style="text-align:center;color:${entry.displayReduction > 0 ? '#15803d' : '#333'};font-weight:${entry.displayReduction > 0 ? '600' : 'normal'};">
          ${reductionText !== '—' ? `<span class="num">${reductionText}</span>` : '—'}
        </td>
        <td style="text-align:center;font-weight:bold;color:${entry.runningBalance < 0 ? '#15803d' : '#1e293b'};">
          <span class="num">${entry.runningBalance < 0 ? `${fmtNum(Math.abs(entry.runningBalance))} ${currency.symbol} (دائن)` : `${currency.symbol} ${fmtNum(entry.runningBalance)}`}</span>
        </td>
      </tr>
    `;
  });

  return html;
}

/**
 * المولد الموحد لطباعة كشف الحساب
 */
export async function generateAccountStatementHTML(data: AccountStatementData): Promise<string> {
  const mode = data.mode || 'simple';
  const isSimple = mode === 'simple';

  const t = await resolveInvoiceStyles('account_statement', {
    titleAr: isSimple ? 'كشف حساب' : 'كشف حساب تفصيلي',
    titleEn: isSimple ? 'CUSTOMER STATEMENT' : 'DETAILED CUSTOMER STATEMENT',
  });

  const ledgerResult: CanonicalCustomerLedgerResult = data.ledgerResult || {
    allEntries: (data.transactions || []).map((t, idx) => ({
      id: `t-${idx}`,
      date: t.date,
      type: (t.type as any) || (t.debit > 0 ? 'contract' : 'cash_payment'),
      category: t.debit > 0 ? 'charge' : 'cash_payment',
      sourceTable: 'legacy',
      sourceId: String(idx),
      reference: t.reference || '—',
      description: t.description || '—',
      notes: t.notes || '—',
      debitEffect: t.debit || 0,
      cashPaymentEffect: t.credit || 0,
      nonCashAdjustmentEffect: 0,
      balanceEffect: (t.debit || 0) - (t.credit || 0),
      runningBalance: t.balance || 0,
      displayCharge: t.debit || 0,
      displayReduction: t.credit || 0,
      isInformationalOnly: false,
    })),
    displayedEntries: (data.transactions || []).map((t, idx) => ({
      id: `t-${idx}`,
      date: t.date,
      type: (t.type as any) || (t.debit > 0 ? 'contract' : 'cash_payment'),
      category: t.debit > 0 ? 'charge' : 'cash_payment',
      sourceTable: 'legacy',
      sourceId: String(idx),
      reference: t.reference || '—',
      description: t.description || '—',
      notes: t.notes || '—',
      debitEffect: t.debit || 0,
      cashPaymentEffect: t.credit || 0,
      nonCashAdjustmentEffect: 0,
      balanceEffect: (t.debit || 0) - (t.credit || 0),
      runningBalance: t.balance || 0,
      displayCharge: t.debit || 0,
      displayReduction: t.credit || 0,
      isInformationalOnly: false,
    })),
    totals: {
      totalCustomerCharges: data.statistics?.totalDebits || 0,
      cashPayments: data.statistics?.totalCredits || 0,
      generalDiscounts: 0,
      purchaseOffsets: 0,
      friendCompanyOffsets: 0,
      otherNonCashCredits: 0,
      totalNonCashAdjustments: 0,
      finalBalance: data.statistics?.balance || 0,
      repaymentPercentage: 100,
      informationalContractDiscounts: 0,
      informationalStopAdjustments: 0,
      debtBreakdown: {
        contracts: data.statistics?.totalDebits || 0,
        salesInvoices: 0,
        printedInvoices: 0,
        compositeTasks: 0,
        otherDebts: 0,
      },
    },
    openingBalance: 0,
    endingBalance: data.statistics?.balance || 0,
  };

  const entries = ledgerResult.displayedEntries || [];
  const totals = ledgerResult.totals;
  const finalBalance = ledgerResult.endingBalance;

  const periodStart = data.startDate ? formatDate(data.startDate) : 'بداية التعامل';
  const periodEnd = data.endDate ? formatDate(data.endDate) : 'حتى الآن';

  let tableHeaderHtml = '';
  let tableRowsHtml = '';

  if (isSimple) {
    tableHeaderHtml = `
      <tr>
        <th style="width:5%">#</th>
        <th style="width:12%">التاريخ</th>
        <th style="width:41%">البيان والتفاصيل</th>
        <th style="width:14%">المستحق (+)</th>
        <th style="width:14%">المدفوع / التسوية (-)</th>
        <th style="width:14%">الرصيد المتبقي</th>
      </tr>
    `;
    tableRowsHtml = generateSimpleStatementRows(t, entries, data.currency);
  } else {
    tableHeaderHtml = `
      <tr>
        <th style="width:4%">#</th>
        <th style="width:11%">التاريخ</th>
        <th style="width:14%">نوع الحركة</th>
        <th style="width:31%">البيان والمرجع</th>
        <th style="width:13%">مستحق (+)</th>
        <th style="width:13%">سداد / تسوية (-)</th>
        <th style="width:14%">الرصيد التراكمي</th>
      </tr>
    `;
    tableRowsHtml = generateDetailedStatementRows(t, entries, data.currency);
  }

  // بطاقات الملخص النهائي
  const balanceStateText = finalBalance > 0
    ? 'المبلغ المتبقي المطلوب من العميل'
    : finalBalance < 0
    ? 'رصيد دائن لصالح العميل'
    : 'الحساب مسدد بالكامل (الرصيد: 0)';

  const summaryBoxesHtml = `
    <div class="statement-summary-box" style="margin-top:16px;border:2px solid ${t.primaryColor};border-radius:8px;overflow:hidden;page-break-inside:avoid;break-inside:avoid;">
      <div style="background:${t.primaryColor};color:${t.totalText};padding:9px 16px;font-weight:bold;font-size:${t.headerFontSize}px;">
        <span>ملخص الحساب المالي</span>
      </div>
      <div style="padding:12px 16px;background:#fff;">
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(170px, 1fr));gap:10px;margin-bottom:12px;">
          
          <div style="background:#f8fafc;padding:9px 12px;border-radius:6px;border:1px solid #e2e8f0;">
            <div style="font-size:10px;color:#64748b;font-weight:600;">إجمالي المستحقات</div>
            <div style="font-size:15px;font-weight:bold;color:#b91c1c;margin-top:3px;">
              <span class="num">${data.currency.symbol} ${fmtNum(totals.totalCustomerCharges)}</span>
            </div>
          </div>

          <div style="background:#f8fafc;padding:9px 12px;border-radius:6px;border:1px solid #e2e8f0;">
            <div style="font-size:10px;color:#64748b;font-weight:600;">إجمالي المدفوع نقداً</div>
            <div style="font-size:15px;font-weight:bold;color:#15803d;margin-top:3px;">
              <span class="num">${data.currency.symbol} ${fmtNum(totals.cashPayments)}</span>
            </div>
          </div>

          ${totals.totalNonCashAdjustments > 0 ? `
          <div style="background:#f8fafc;padding:9px 12px;border-radius:6px;border:1px solid #e2e8f0;">
            <div style="font-size:10px;color:#64748b;font-weight:600;">التسويات والمقاصة</div>
            <div style="font-size:15px;font-weight:bold;color:#0891b2;margin-top:3px;">
              <span class="num">${data.currency.symbol} ${fmtNum(totals.totalNonCashAdjustments)}</span>
            </div>
          </div>
          ` : ''}

          <div style="background:${finalBalance > 0 ? '#fef2f2' : '#f0fdf4'};padding:9px 12px;border-radius:6px;border:1.5px solid ${finalBalance > 0 ? '#ef4444' : '#22c55e'};">
            <div style="font-size:10px;color:${finalBalance > 0 ? '#991b1b' : '#166534'};font-weight:bold;">${balanceStateText}</div>
            <div style="font-size:16px;font-weight:900;color:${finalBalance > 0 ? '#b91c1c' : '#15803d'};margin-top:3px;">
              <span class="num">${data.currency.symbol} ${fmtNum(Math.abs(finalBalance))}</span>
            </div>
          </div>

        </div>

        <div style="margin-top:8px;text-align:center;font-size:11px;color:#475569;font-weight:600;border-top:1px solid #e2e8f0;padding-top:6px;">
          المبلغ كتابةً: ${numberToArabicWords(Math.abs(finalBalance))} ${data.currency.writtenName} ${finalBalance < 0 ? '(رصيد دائن لصالح العميل)' : finalBalance === 0 ? '(خالص المسدد)' : '(مستحق السداد)'}
        </div>
      </div>
    </div>
  `;

  const bodyContent = `
    <!-- Table -->
    <table class="items-table" style="font-size:${t.bodyFontSize - 1}px;width:100%;border-collapse:collapse;">
      <thead>
        ${tableHeaderHtml}
      </thead>
      <tbody>
        ${tableRowsHtml}
      </tbody>
    </table>

    ${summaryBoxesHtml}
  `;

  const customerHtml = generateCustomerHTML(t, {
    label: 'بيانات العميل',
    name: data.customerData.name,
    company: data.customerData.company,
    phone: data.customerData.phone,
    statsCards: `
      <div class="stat-card">
        <div class="stat-value">${entries.length}</div>
        <div class="stat-label">حركة مالية</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${totals.repaymentPercentage}%</div>
        <div class="stat-label">نسبة تسوية الحساب</div>
      </div>
    `,
  });

  const extraCSS = `
    .items-table td { font-size: ${t.bodyFontSize - 1}px; padding: 6px 4px; border: 1px solid #cbd5e1; }
    .items-table th { font-size: ${t.bodyFontSize - 1}px; padding: 8px 4px; background: ${t.primaryColor}; color: ${t.totalText}; }
    .statement-summary-box { page-break-inside: avoid !important; break-inside: avoid !important; }
    .items-table tr { page-break-inside: avoid !important; break-inside: avoid !important; }
    .items-table tr:last-child { page-break-after: avoid !important; break-after: avoid !important; }
    .items-table tr:nth-last-child(-n+2) { page-break-after: avoid !important; break-after: avoid !important; }
  `;

  return wrapInDocument(t, {
    title: `${isSimple ? 'كشف حساب' : 'كشف حساب تفصيلي'} - ${data.customerData.name}`,
    headerMetaHtml: `
      ${!isSimple ? 'نوع الكشف: <strong>كشف حساب تفصيلي</strong><br/>' : ''}
      الفترة: <span class="num">${periodStart}</span> إلى <span class="num">${periodEnd}</span><br/>
      تاريخ الطباعة: <span class="num">${formatDateForPrint(new Date().toISOString(), t.showHijriDate)}</span>
    `,
    customerHtml,
    bodyContent,
    extraCSS,
    autoPrint: data.autoPrint,
  });
}
