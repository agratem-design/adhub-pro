/**
 * Unified Account Statement HTML Generator (كشف الحساب)
 * يستخدم القاعدة الموحدة (unifiedInvoiceBase) + fetchPrintSettingsForInvoice
 */

import { resolveInvoiceStyles, formatNum, formatDateForPrint, wrapInDocument, generateCustomerHTML, type ResolvedPrintStyles } from './unifiedInvoiceBase';
import { numberToArabicWords } from '@/lib/printUtils';
import { hexToRgba } from '@/hooks/useInvoiceSettingsSync';

// =====================================================
// Types
// =====================================================

interface Transaction {
  date: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  notes: string;
  type: string;
  itemTotal?: number | null;
  itemRemaining?: number | null;
  sourceInvoice?: string | null;
  adType?: string | null;
  distributedPaymentId?: string | null;
  distributedPaymentTotal?: number | null;
}

interface Statistics {
  totalContracts: number;
  activeContracts: number;
  totalDebits: number;
  totalCredits: number;
  balance: number;
  totalPayments: number;
}

interface CustomerData {
  id: string;
  name: string;
  company?: string;
  phone?: string;
  email?: string;
}

interface Currency {
  code: string;
  symbol: string;
  writtenName: string;
}

export interface AccountStatementData {
  customerData: CustomerData;
  transactions: Transaction[];
  statistics: Statistics;
  currency: Currency;
  startDate?: string;
  endDate?: string;
  hidePaymentDistribution?: boolean;
  autoPrint?: boolean;
}

// =====================================================
// Date Filtering Logic
// =====================================================

interface FilterResult {
  filteredTransactions: Transaction[];
  openingBalance: number;
  previousTransactions: Transaction[];
  referencedContracts: Transaction[];
}

export function filterTransactionsByDateRange(
  transactions: Transaction[],
  startDate?: string,
  endDate?: string
): FilterResult {
  if (!startDate && !endDate) {
    return { filteredTransactions: transactions, openingBalance: 0, previousTransactions: [], referencedContracts: [] };
  }

  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  if (start) start.setHours(0, 0, 0, 0);
  if (end) end.setHours(23, 59, 59, 999);

  let openingBalance = 0;
  const filteredTransactions: Transaction[] = [];
  const allPreviousTransactions: Transaction[] = [];
  const contractsBeforeRange: Map<string, Transaction> = new Map();
  const paymentsInRange: Transaction[] = [];

  for (const transaction of transactions) {
    const transactionDate = new Date(transaction.date);
    transactionDate.setHours(12, 0, 0, 0);

    if (start && transactionDate < start) {
      openingBalance += transaction.debit - transaction.credit;
      allPreviousTransactions.push(transaction);
      if (transaction.type === 'contract') {
        contractsBeforeRange.set(transaction.reference, transaction);
      }
    } else if (
      (!start || transactionDate >= start) &&
      (!end || transactionDate <= end)
    ) {
      filteredTransactions.push(transaction);
      if (transaction.type === 'payment' || transaction.type === 'receipt' || 
          transaction.type === 'credit' || transaction.credit > 0) {
        paymentsInRange.push(transaction);
      }
    }
  }

  const referencedContracts: Transaction[] = [];
  const addedContractRefs = new Set<string>();
  
  for (const payment of paymentsInRange) {
    const contractRef = payment.reference;
    if (contractRef && contractRef.startsWith('عقد-') && !addedContractRefs.has(contractRef)) {
      const contract = contractsBeforeRange.get(contractRef);
      if (contract) {
        referencedContracts.push(contract);
        addedContractRefs.add(contractRef);
      }
    }
  }

  const previousTransactions = allPreviousTransactions.slice(-5);

  return { filteredTransactions, openingBalance, previousTransactions, referencedContracts };
}

function recalculateStatistics(transactions: Transaction[], openingBalance: number): Statistics {
  let totalDebits = 0;
  let totalCredits = 0;

  for (const t of transactions) {
    totalDebits += t.debit;
    totalCredits += t.credit;
  }

  return {
    totalContracts: 0,
    activeContracts: 0,
    totalDebits,
    totalCredits,
    balance: openingBalance + totalDebits - totalCredits,
    totalPayments: transactions.filter(t => t.credit > 0).length,
  };
}

// =====================================================
// Format helpers
// =====================================================

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('ar-LY-u-nu-latn');
  } catch {
    return dateStr;
  }
}

function fmtNum(num: number): string {
  if (isNaN(num) || num === null || num === undefined) return '0';
  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

// =====================================================
// Table generation
// =====================================================

function generateStatementRows(
  t: ResolvedPrintStyles,
  transactions: Transaction[],
  currency: Currency,
  openingBalance: number,
  previousTransactions: Transaction[],
  referencedContracts: Transaction[],
  hidePaymentDistribution?: boolean
): string {
  let html = '';

  // Referenced contracts
  if (referencedContracts.length > 0) {
    html += `<tr class="subtotal-row"><td colspan="11" style="text-align:center;font-size:10px;">═══ عقود مرجعية (خارج النطاق لكن لها دفعات في الفترة) ═══</td></tr>`;
    referencedContracts.forEach(contract => {
      html += `
        <tr class="even-row" style="opacity:0.7;">
          <td>⟵</td>
          <td style="font-size:9px;">${formatDate(contract.date)}</td>
          <td style="text-align:right;font-size:9px;">[مرجع] ${contract.description}</td>
          <td style="font-size:9px;">${contract.adType || '—'}</td>
          <td style="font-size:9px;">${contract.reference}</td>
          <td>${contract.debit > 0 ? `${currency.symbol} ${fmtNum(contract.debit)}` : '—'}</td>
          <td>${contract.credit > 0 ? `${currency.symbol} ${fmtNum(contract.credit)}` : '—'}</td>
          <td style="font-size:9px;">(ضمن الرصيد السابق)</td>
          <td>—</td>
          <td>—</td>
          <td style="font-size:9px;">عقد قديم</td>
        </tr>`;
    });
    html += `<tr class="subtotal-row"><td colspan="11" style="text-align:center;font-size:10px;">═══════════════════════</td></tr>`;
  }

  // Previous transactions
  if (previousTransactions.length > 0 && openingBalance !== 0) {
    let prevRunningBalance = openingBalance;
    for (let i = previousTransactions.length - 1; i >= 0; i--) {
      prevRunningBalance -= (previousTransactions[i].debit - previousTransactions[i].credit);
    }

    previousTransactions.forEach((transaction, index) => {
      prevRunningBalance += transaction.debit - transaction.credit;
      html += `
        <tr class="even-row" style="opacity:0.7;">
          <td>◄</td>
          <td style="font-size:9px;">${formatDate(transaction.date)}</td>
          <td style="text-align:right;font-size:9px;">[سابق] ${transaction.description}</td>
          <td style="font-size:9px;">${transaction.adType || '—'}</td>
          <td style="font-size:9px;">${transaction.reference}</td>
          <td>${transaction.debit > 0 ? `${currency.symbol} ${fmtNum(transaction.debit)}` : '—'}</td>
          <td>${transaction.credit > 0 ? `${currency.symbol} ${fmtNum(transaction.credit)}` : '—'}</td>
          <td>${index === previousTransactions.length - 1 ? `${currency.symbol} ${fmtNum(openingBalance)}` : `${currency.symbol} ${fmtNum(prevRunningBalance)}`}</td>
          <td>—</td>
          <td>—</td>
          <td style="font-size:9px;">(خارج النطاق)</td>
        </tr>`;
    });

    html += `
      <tr class="subtotal-row">
        <td colspan="7" style="text-align:center;font-size:10px;">══ نهاية الحركات السابقة ══</td>
        <td colspan="4" style="font-weight:bold;">رصيد مُرحّل: ${currency.symbol} ${fmtNum(openingBalance)}</td>
      </tr>`;
  } else if (openingBalance !== 0) {
    html += `
      <tr class="subtotal-row">
        <td>—</td>
        <td>—</td>
        <td style="text-align:right;">رصيد سابق (مُرحّل)</td>
        <td>—</td>
        <td>—</td>
        <td>${openingBalance > 0 ? `${currency.symbol} ${fmtNum(openingBalance)}` : '—'}</td>
        <td>${openingBalance < 0 ? `${currency.symbol} ${fmtNum(Math.abs(openingBalance))}` : '—'}</td>
        <td>${currency.symbol} ${fmtNum(openingBalance)}</td>
        <td>—</td>
        <td>—</td>
        <td></td>
      </tr>`;
  }

  // Distributed payment groups
  const distributedGroups: Map<string, Transaction[]> = new Map();
  const processedDistributedIds = new Set<string>();
  
  transactions.forEach(transaction => {
    if (transaction.distributedPaymentId) {
      const existing = distributedGroups.get(transaction.distributedPaymentId) || [];
      existing.push(transaction);
      distributedGroups.set(transaction.distributedPaymentId, existing);
    }
  });

  // Transaction rows
  let runningBalance = openingBalance;
  let rowIndex = 1;
  
  for (let i = 0; i < transactions.length; i++) {
    const transaction = transactions[i];
    runningBalance += transaction.debit - transaction.credit;
    
    // Distributed payment group
    if (transaction.distributedPaymentId && !processedDistributedIds.has(transaction.distributedPaymentId)) {
      const groupedTransactions = distributedGroups.get(transaction.distributedPaymentId) || [];
      const totalDistributed = transaction.distributedPaymentTotal || groupedTransactions.reduce((sum, t) => sum + t.credit, 0);
      
      let groupEndBalance = runningBalance;
      for (let j = i + 1; j < transactions.length; j++) {
        if (transactions[j].distributedPaymentId === transaction.distributedPaymentId) {
          groupEndBalance += transactions[j].debit - transactions[j].credit;
        } else break;
      }
      
      if (hidePaymentDistribution) {
        const displayNotes = transaction.notes !== '—' ? transaction.notes : '';
        html += `
          <tr class="${rowIndex % 2 === 0 ? 'even-row' : 'odd-row'}">
            <td>${rowIndex}</td>
            <td style="font-size:9px;"><span class="num">${formatDate(transaction.date)}</span></td>
            <td style="text-align:right;">دفعة من العميل</td>
            <td style="font-size:9px;">—</td>
            <td>${transaction.reference || '—'}</td>
            <td>—</td>
            <td style="font-weight:bold;">${currency.symbol} ${fmtNum(totalDistributed)}</td>
            <td style="font-weight:bold;">${currency.symbol} ${fmtNum(groupEndBalance)}</td>
            <td>—</td>
            <td>—</td>
            <td style="font-size:9px; white-space: pre-line;">${displayNotes}</td>
          </tr>`;
      } else {
        html += `
          <tr class="subtotal-row" style="background:${t.primaryColor}10 !important;">
            <td>●</td>
            <td style="font-size:9px;">${formatDate(transaction.date)}</td>
            <td colspan="3" style="text-align:right;">دفعة موزعة - إجمالي: ${currency.symbol} ${fmtNum(totalDistributed)}</td>
            <td>—</td>
            <td style="color:${t.primaryColor};font-weight:bold;">${currency.symbol} ${fmtNum(totalDistributed)}</td>
            <td></td>
            <td></td>
            <td></td>
            <td style="font-size:9px;">عدد: ${groupedTransactions.length}</td>
          </tr>`;
        
        groupedTransactions.forEach((distTrans, distIndex) => {
          let displayDescription = distTrans.description;
          if (distTrans.sourceInvoice && displayDescription.includes('SALE-')) {
            displayDescription = displayDescription.replace(/SALE-\d+/g, distTrans.sourceInvoice);
          }
          
          const itemRemaining = distTrans.itemRemaining != null ? `${currency.symbol} ${fmtNum(distTrans.itemRemaining)}` : '—';
          const itemTotal = distTrans.itemTotal != null ? `${currency.symbol} ${fmtNum(distTrans.itemTotal)}` : '—';
          
          const displayNotes = distTrans.notes !== '—' ? distTrans.notes : '';
          
          html += `
            <tr class="${distIndex % 2 === 0 ? 'even-row' : 'odd-row'}" style="font-size:10px;">
              <td>  ↳ ${distIndex + 1}</td>
              <td></td>
              <td style="text-align:right;padding-right:20px;">└─ ${displayDescription}</td>
              <td style="font-size:9px;">${distTrans.adType || '—'}</td>
              <td>${distTrans.reference}</td>
              <td>${distTrans.debit > 0 ? `${currency.symbol} ${fmtNum(distTrans.debit)}` : '—'}</td>
              <td>${distTrans.credit > 0 ? `${currency.symbol} ${fmtNum(distTrans.credit)}` : '—'}</td>
              <td>${distIndex === groupedTransactions.length - 1 ? `${currency.symbol} ${fmtNum(groupEndBalance)}` : ''}</td>
              <td>${itemTotal}</td>
              <td>${itemRemaining}</td>
              <td style="font-size:9px; white-space: pre-line;">${displayNotes}</td>
            </tr>`;
        });
      }
      
      processedDistributedIds.add(transaction.distributedPaymentId);
      rowIndex++;
      continue;
    }
    
    if (transaction.distributedPaymentId && processedDistributedIds.has(transaction.distributedPaymentId)) {
      continue;
    }
    
    let displayDescription = transaction.description;
    if (transaction.sourceInvoice && displayDescription.includes('SALE-')) {
      displayDescription = displayDescription.replace(/SALE-\d+/g, transaction.sourceInvoice);
    }
    
    const itemRemaining = transaction.itemRemaining != null ? `${currency.symbol} ${fmtNum(transaction.itemRemaining)}` : '—';
    const itemTotal = transaction.itemTotal != null ? `${currency.symbol} ${fmtNum(transaction.itemTotal)}` : '—';
    
    const displayNotes = transaction.notes !== '—' ? transaction.notes : '';
    
    html += `
      <tr class="${rowIndex % 2 === 0 ? 'even-row' : 'odd-row'}">
        <td>${rowIndex}</td>
        <td style="font-size:9px;"><span class="num">${formatDate(transaction.date)}</span></td>
        <td style="text-align:right;">${displayDescription}</td>
        <td style="font-size:9px;">${transaction.adType || '—'}</td>
        <td style="font-size:9px;">${transaction.reference}</td>
        <td>${transaction.debit > 0 ? `${currency.symbol} ${fmtNum(transaction.debit)}` : '—'}</td>
        <td>${transaction.credit > 0 ? `${currency.symbol} ${fmtNum(transaction.credit)}` : '—'}</td>
        <td style="font-weight:bold;"><span class="num">${currency.symbol} ${fmtNum(runningBalance)}</span></td>
        <td>${itemTotal}</td>
        <td>${itemRemaining}</td>
        <td style="font-size:9px; white-space: pre-line;">${displayNotes}</td>
      </tr>`;
    rowIndex++;
  }

  return html;
}

// =====================================================
// Main Generator
// =====================================================

export async function generateAccountStatementHTML(data: AccountStatementData): Promise<string> {
  const t = await resolveInvoiceStyles('account_statement', {
    titleAr: 'كشف حساب',
    titleEn: 'ACCOUNT STATEMENT',
  });

  const { filteredTransactions, openingBalance, previousTransactions, referencedContracts } = 
    filterTransactionsByDateRange(data.transactions, data.startDate, data.endDate);

  const stats = recalculateStatistics(filteredTransactions, openingBalance);

  const periodStart = data.startDate ? new Date(data.startDate).toLocaleDateString('ar-LY-u-nu-latn') : 'بداية السجل';
  const periodEnd = data.endDate ? new Date(data.endDate).toLocaleDateString('ar-LY-u-nu-latn') : 'حتى الآن';

  const tableRows = generateStatementRows(t, filteredTransactions, data.currency, openingBalance, previousTransactions, referencedContracts, data.hidePaymentDistribution);

  // Summary section
  const balanceLabel = stats.balance > 0 
    ? 'الرصيد النهائي (مستحق على العميل)' 
    : stats.balance < 0 
      ? 'الرصيد النهائي (رصيد دائن للعميل)' 
      : 'الرصيد النهائي (مسدد بالكامل)';

  const bodyContent = `
    <!-- Table -->
    <table class="items-table" style="font-size:${t.bodyFontSize - 1}px;">
      <thead>
        <tr>
          <th style="width:3%">#</th>
          <th style="width:8%">التاريخ</th>
          <th style="width:15%">البيان</th>
          <th style="width:10%">نوع الإعلان</th>
          <th style="width:10%">المرجع</th>
          <th style="width:8%">مدين</th>
          <th style="width:8%">دائن</th>
          <th style="width:8%">الرصيد</th>
          <th style="width:8%">قيمة العنصر</th>
          <th style="width:8%">متبقي العنصر</th>
          <th style="width:14%">ملاحظات</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>

    <!-- Summary -->
    <div style="margin-top:20px;border:2px solid ${t.primaryColor};border-radius:8px;overflow:hidden;">
      <div style="background:${t.primaryColor};color:${t.totalText};padding:10px 16px;font-weight:bold;font-size:${t.headerFontSize}px;">
        ملخص الرصيد
      </div>
      <div style="padding:12px 16px;">
        ${openingBalance !== 0 ? `
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid ${t.tableBorder};">
          <span style="font-weight:bold;">الرصيد السابق (مُرحّل)</span>
          <span class="num" style="font-weight:bold;">${data.currency.symbol} ${fmtNum(Math.abs(openingBalance))} ${openingBalance < 0 ? '(دائن)' : '(مدين)'}</span>
        </div>
        ` : ''}
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid ${t.tableBorder};">
          <span style="font-weight:bold;">إجمالي المدين</span>
          <span class="num" style="font-weight:bold;">${data.currency.symbol} ${fmtNum(stats.totalDebits)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid ${t.tableBorder};margin-bottom:12px;">
          <span style="font-weight:bold;">إجمالي الدائن</span>
          <span class="num" style="font-weight:bold;">${data.currency.symbol} ${fmtNum(stats.totalCredits)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:12px 0;background:${t.totalBg};color:${t.totalText};margin:-12px -16px -12px -16px;padding:12px 16px;font-size:${t.headerFontSize}px;">
          <span style="font-weight:bold;">${balanceLabel}</span>
          <span class="num" style="font-weight:bold;font-size:${t.headerFontSize + 2}px;">${data.currency.symbol} ${fmtNum(Math.abs(stats.balance))}</span>
        </div>
      </div>
    </div>

    <div class="notes-section" style="margin-top:15px;">
      الرصيد بالكلمات: ${numberToArabicWords(Math.abs(stats.balance))} ${data.currency.writtenName} ${stats.balance < 0 ? '(رصيد دائن)' : stats.balance === 0 ? '(مسدد بالكامل)' : ''}
    </div>
  `;

  const customerHtml = generateCustomerHTML(t, {
    label: 'العميل',
    name: data.customerData.name,
    company: data.customerData.company,
    phone: data.customerData.phone,
    statsCards: `
      <div class="stat-card">
        <div class="stat-value">${filteredTransactions.length}</div>
        <div class="stat-label">حركة</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.totalPayments}</div>
        <div class="stat-label">دفعة</div>
      </div>
    `,
  });

  const extraCSS = `
    .items-table td { font-size: ${t.bodyFontSize - 1}px; padding: 6px 4px; }
    .items-table th { font-size: ${t.bodyFontSize - 1}px; padding: 8px 4px; }
  `;

  return wrapInDocument(t, {
    title: `كشف حساب - ${data.customerData.name}`,
    headerMetaHtml: `
      الفترة من: <span class="num">${periodStart}</span><br/>
      إلى: <span class="num">${periodEnd}</span><br/>
      تاريخ الإصدار: <span class="num">${formatDateForPrint(new Date().toISOString(), t.showHijriDate)}</span>
    `,
    customerHtml,
    bodyContent,
    extraCSS,
    autoPrint: data.autoPrint,
  });
}
