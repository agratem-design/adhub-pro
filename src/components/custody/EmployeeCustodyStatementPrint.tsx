import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { toast } from 'sonner';
import { getMergedInvoiceStylesAsync, hexToRgba } from '@/hooks/useInvoiceSettingsSync';
import { unifiedHeaderFooterCss, unifiedHeaderHtml, unifiedFooterHtml, formatDateForPrint } from '@/lib/unifiedInvoiceBase';
import { preparePrintWindow, writePrintWindow } from '@/utils/printWindowHelper';
interface EmployeeCustodyStatementPrintProps {
  employeeId: string;
  employeeName: string;
  employeePosition?: string;
}

export function EmployeeCustodyStatementPrint({ 
  employeeId, 
  employeeName,
  employeePosition 
}: EmployeeCustodyStatementPrintProps) {
  const [loading, setLoading] = useState(false);

  const handlePrint = async () => {
    const docTitle = `كشف_عهد_${employeeName}`;
    const printWindow = preparePrintWindow(docTitle);
    setLoading(true);

    try {
      // Load all accounts for this employee
      const { data: accounts, error: accError } = await supabase
        .from('custody_accounts')
        .select('*')
        .eq('employee_id', employeeId)
        .order('assigned_date', { ascending: true });

      if (accError) throw accError;
      if (!accounts || accounts.length === 0) {
        toast.error('لا توجد عهد لهذا الموظف');
        if (printWindow && !printWindow.closed) printWindow.close();
        return;
      }

      const accountIds = accounts.map(a => a.id);

      // Load all transactions for these accounts
      const { data: transactions, error: txError } = await supabase
        .from('custody_transactions')
        .select('*')
        .in('custody_account_id', accountIds)
        .order('transaction_date', { ascending: true });

      if (txError) throw txError;

      // Load all expenses for these accounts
      const { data: expenses, error: expError } = await supabase
        .from('custody_expenses')
        .select('*')
        .in('custody_account_id', accountIds)
        .order('expense_date', { ascending: true });

      if (expError) throw expError;

      const html = await generateCombinedStatementHTML(
        employeeName,
        employeePosition || '',
        accounts,
        transactions || [],
        expenses || []
      );

      writePrintWindow(printWindow, html, {
        title: docTitle,
        landscape: false,
        showDownloadPdf: true,
        showShare: true,
        autoPrint: true,
      });
    } catch (error) {
      console.error('Error generating combined statement:', error);
      toast.error('فشل في إنشاء الكشف الموحد');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      onClick={handlePrint} 
      variant="outline" 
      size="sm" 
      className="gap-1"
      disabled={loading}
    >
      <FileText className="h-4 w-4" />
      {loading ? 'جاري التحميل...' : 'كشف موحد'}
    </Button>
  );
}

async function generateCombinedStatementHTML(
  employeeName: string,
  employeePosition: string,
  accounts: any[],
  transactions: any[],
  expenses: any[]
): Promise<string> {
  const styles = await getMergedInvoiceStylesAsync('custody');
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const logoUrl = styles.logoPath || '/logofaresgold.svg';
  const fullLogoUrl = logoUrl.startsWith('http') ? logoUrl : `${baseUrl}${logoUrl}`;

  const combinedFooterText = `${styles.footerText || 'تاريخ الطباعة:'} ${new Date().toLocaleString('ar-LY-u-nu-latn')}<br/>${styles.companyName} ${styles.companySubtitle}`;
  const combinedStyles = { ...styles, footerText: combinedFooterText };

  // Calculate totals
  const totalInitial = accounts.reduce((sum, acc) => sum + acc.initial_amount, 0);
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.current_balance, 0);
  const totalDeposits = transactions.filter(t => t.transaction_type === 'deposit').reduce((s, t) => s + t.amount, 0);
  const totalWithdrawals = transactions.filter(t => t.transaction_type === 'withdrawal').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  // Generate accounts summary table
  const accountsSummaryRows = accounts.map(acc => `
    <tr>
      <td>${acc.account_number}</td>
      <td>${formatDateForPrint(acc.assigned_date, styles.showHijriDate)}</td>
      <td>${acc.initial_amount.toLocaleString('ar-LY')} د.ل</td>
      <td class="${acc.current_balance >= 0 ? 'credit-amount' : 'debit-amount'}">${acc.current_balance.toLocaleString('ar-LY')} د.ل</td>
      <td>
        <span class="status-badge ${acc.status === 'active' ? 'active' : 'closed'}">
          ${acc.status === 'active' ? 'نشط' : 'مغلق'}
        </span>
      </td>
    </tr>
  `).join('');

  // Combine all movements from all accounts
  const filteredTransactions = transactions.filter(t => t.transaction_type !== 'expense');
  
  const allMovements = [
    ...filteredTransactions.map(t => {
      const account = accounts.find(a => a.id === t.custody_account_id);
      return {
        date: t.transaction_date,
        accountNumber: account?.account_number || '-',
        type: t.transaction_type,
        description: t.description || '-',
        debit: t.transaction_type === 'withdrawal' ? t.amount : 0,
        credit: t.transaction_type === 'deposit' ? t.amount : 0,
        receipt: t.receipt_number || '-'
      };
    }),
    ...expenses.map(e => {
      const account = accounts.find(a => a.id === e.custody_account_id);
      return {
        date: e.expense_date,
        accountNumber: account?.account_number || '-',
        type: 'expense',
        description: `${e.expense_category}: ${e.description}`,
        debit: e.amount,
        credit: 0,
        receipt: e.receipt_number || '-'
      };
    })
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const movementRows = allMovements.map(m => `
    <tr>
      <td>${formatDateForPrint(m.date, styles.showHijriDate)}</td>
      <td>${m.accountNumber}</td>
      <td>${m.type === 'deposit' ? 'إيداع' : m.type === 'withdrawal' ? 'سحب' : 'مصروف'}</td>
      <td style="text-align: right;">${m.description}</td>
      <td>${m.receipt}</td>
      <td class="debit-amount">${m.debit > 0 ? m.debit.toLocaleString('ar-LY') : '-'}</td>
      <td class="credit-amount">${m.credit > 0 ? m.credit.toLocaleString('ar-LY') : '-'}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>كشف العهد الموحد - ${employeeName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    html, body {
      font-family: ${styles.fontFamily || "'Noto Sans Arabic', Arial, sans-serif"};
      direction: rtl;
      text-align: right;
      background: white;
      color: ${styles.customerSectionTextColor};
      font-size: ${styles.bodyFontSize}px;
      line-height: 1.3;
    }
    
    @page { size: A4 portrait; margin: 10mm; }
    .page { width: 190mm; padding: 0; }
    
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 15px;
      border-bottom: 2px solid ${styles.primaryColor};
      padding-bottom: 12px;
    }

    ${unifiedHeaderFooterCss(combinedStyles)}
    
    .employee-section {
      background: ${styles.primaryColor};
      color: ${styles.tableHeaderTextColor};
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .employee-name { font-size: 16px; font-weight: bold; }
    .employee-position { font-size: ${styles.bodyFontSize}px; opacity: 0.9; }
    .accounts-count { background: rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 4px; font-size: ${styles.bodyFontSize}px; }
    
    .section-title {
      font-size: ${styles.headerFontSize}px;
      font-weight: bold;
      color: ${styles.tableHeaderTextColor};
      margin-bottom: 10px;
      text-align: center;
      background: ${styles.tableHeaderBgColor};
      padding: 6px;
      border-radius: 4px;
    }
    
    .accounts-table, .movements-table { width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 15px; page-break-inside: avoid; }
    .accounts-table th, .movements-table th {
      background: ${styles.tableHeaderBgColor};
      color: ${styles.tableHeaderTextColor};
      font-weight: bold;
      padding: 6px 4px;
      text-align: center;
      border: ${styles.tableBorderWidth || 1}px ${styles.tableBorderStyle || 'solid'} ${styles.tableBorderColor};
      font-size: 9px;
    }
    .accounts-table td, .movements-table td { padding: 5px 3px; border: ${styles.tableBorderWidth || 1}px ${styles.tableBorderStyle || 'solid'} ${styles.tableBorderColor}; text-align: center; vertical-align: middle; }
    .accounts-table tbody tr:nth-child(even), .movements-table tbody tr:nth-child(even) { background: ${hexToRgba(styles.tableRowEvenColor, 100)}; }
    .accounts-table tbody tr:nth-child(odd), .movements-table tbody tr:nth-child(odd) { background: ${hexToRgba(styles.tableRowOddColor, 100)}; }
    .accounts-table tbody tr, .movements-table tbody tr { page-break-inside: avoid; }
    
    .debit-amount { color: #dc2626; font-weight: bold; }
    .credit-amount { color: #16a34a; font-weight: bold; }
    
    .status-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 8px; font-weight: bold; }
    .status-badge.active { background: #dcfce7; color: #166534; }
    .status-badge.closed { background: #f3f4f6; color: #6b7280; }
    
    .summary-section {
      background: ${hexToRgba(styles.customerSectionBgColor, 50)};
      padding: 12px;
      border-radius: 6px;
      margin-top: 15px;
      border: 2px solid ${styles.primaryColor};
      page-break-inside: avoid;
    }
    .summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; page-break-inside: avoid; }
    .summary-box { background: white; padding: 10px; border-radius: 4px; border: 1px solid ${styles.tableBorderColor}; text-align: center; page-break-inside: avoid; }
    .summary-label { font-size: 9px; color: #666; margin-bottom: 5px; }
    .summary-value { font-size: ${styles.bodyFontSize}px; font-weight: bold; color: ${styles.customerSectionTextColor}; }
    
    .final-balance {
      background: ${styles.totalBgColor};
      color: ${styles.totalTextColor};
      padding: 15px;
      text-align: center;
      border-radius: 6px;
      font-size: 18px;
      font-weight: bold;
      margin-top: 15px;
      page-break-inside: avoid;
    }
    
    .footer {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 2px solid ${styles.primaryColor};
      text-align: center;
      font-size: 8px;
      color: ${styles.footerTextColor};
    }
    
    @media print {
      html, body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="page">
    ${unifiedHeaderHtml({
      styles: combinedStyles,
      fullLogoUrl,
      metaLinesHtml: '<div><strong>كشف العهد المالية الموحد</strong></div>',
      titleAr: 'كشف عهد موحد',
      titleEn: 'COMBINED STATEMENT',
    })}
    
    <div class="employee-section">
      <div>
        <div class="employee-name">${employeeName}</div>
        <div class="employee-position">${employeePosition || 'موظف'}</div>
      </div>
      <div class="accounts-count">عدد العهد: ${accounts.length}</div>
    </div>
    
    <div class="section-title">ملخص العهد المالية</div>
    <table class="accounts-table">
      <thead>
        <tr>
          <th>رقم العهدة</th>
          <th>تاريخ الاستلام</th>
          <th>المبلغ الأولي</th>
          <th>الرصيد الحالي</th>
          <th>الحالة</th>
        </tr>
      </thead>
      <tbody>
        ${accountsSummaryRows}
        <tr style="background: #fef3c7; font-weight: bold;">
          <td colspan="2">الإجمالي</td>
          <td>${totalInitial.toLocaleString('ar-LY')} د.ل</td>
          <td class="${totalBalance >= 0 ? 'credit-amount' : 'debit-amount'}">${totalBalance.toLocaleString('ar-LY')} د.ل</td>
          <td>-</td>
        </tr>
      </tbody>
    </table>
    
    <div class="section-title">سجل الحركات</div>
    <table class="movements-table">
      <thead>
        <tr>
          <th style="width: 12%;">التاريخ</th>
          <th style="width: 12%;">رقم العهدة</th>
          <th style="width: 10%;">النوع</th>
          <th style="width: 30%;">البيان</th>
          <th style="width: 10%;">رقم الإيصال</th>
          <th style="width: 13%;">مدين</th>
          <th style="width: 13%;">دائن</th>
        </tr>
      </thead>
      <tbody>
        ${movementRows.length > 0 ? movementRows : '<tr><td colspan="7" style="text-align: center; color: #999;">لا توجد حركات</td></tr>'}
      </tbody>
    </table>
    
    <div class="summary-section">
      <div class="section-title">الملخص المالي</div>
      <div class="summary-grid">
        <div class="summary-box">
          <div class="summary-label">إجمالي المبالغ الأولية</div>
          <div class="summary-value">${totalInitial.toLocaleString('ar-LY')} د.ل</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">إجمالي الإيداعات</div>
          <div class="summary-value" style="color: #16a34a;">${totalDeposits.toLocaleString('ar-LY')} د.ل</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">إجمالي السحوبات</div>
          <div class="summary-value" style="color: #dc2626;">${totalWithdrawals.toLocaleString('ar-LY')} د.ل</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">إجمالي المصروفات</div>
          <div class="summary-value" style="color: #dc2626;">${totalExpenses.toLocaleString('ar-LY')} د.ل</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">عدد العهد</div>
          <div class="summary-value">${accounts.length}</div>
        </div>
      </div>
    </div>
    
    <div class="final-balance">
      إجمالي الرصيد الحالي: ${totalBalance.toLocaleString('ar-LY')} دينار ليبي
    </div>
    
    ${unifiedFooterHtml(combinedStyles)}
  </div>
  
  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;
}
