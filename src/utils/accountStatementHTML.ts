// ✅ دالة مشتركة لتوليد HTML كشف الحساب (تُستخدم للطباعة والإرسال كـ PDF)

import { getMergedInvoiceStylesAsync } from '@/hooks/useInvoiceSettingsSync';
import { unifiedHeaderFooterCss, unifiedHeaderHtml, unifiedFooterHtml } from '@/lib/unifiedInvoiceBase';
import { numberToArabicWords } from '@/lib/printUtils';
interface Transaction {
  id: string;
  date: string;
  type: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  reference: string;
  notes: string;
  method?: string;
}

interface Currency {
  code: string;
  name: string;
  symbol: string;
  writtenName: string;
}

interface Statistics {
  totalDebits: number;
  totalCredits: number;
  balance: number;
}

interface CustomerData {
  name: string;
  id: string;
  company?: string;
  phone?: string;
  email?: string;
}

interface GenerateAccountStatementHTMLParams {
  customerData: CustomerData;
  allTransactions: Transaction[];
  statistics: Statistics;
  currency: Currency;
  startDate?: string;
  endDate?: string;
  statementNumber?: string;
  statementDate?: string;
  logoDataUri?: string;
}

const formatArabicNumber = (num: number): string => {
  if (isNaN(num) || num === null || num === undefined) return '0';
  
  const numStr = num.toString();
  const parts = numStr.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];
  
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  if (decimalPart) {
    return `${formattedInteger}.${decimalPart}`;
  }
  
  return formattedInteger;
};

export function generateAccountStatementHTML({
  customerData,
  allTransactions,
  statistics,
  currency,
  startDate,
  endDate,
  statementNumber,
  statementDate,
  logoDataUri = '',
}: GenerateAccountStatementHTMLParams): string {
  const periodStart = startDate ? new Date(startDate).toLocaleDateString('ar-LY-u-nu-latn') : 'غير محدد';
  const periodEnd = endDate ? new Date(endDate).toLocaleDateString('ar-LY-u-nu-latn') : 'غير محدد';
  const finalStatementDate = statementDate || new Date().toLocaleDateString('ar-LY-u-nu-latn');
  const finalStatementNumber = statementNumber || `STMT-${Date.now()}`;

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>كشف حساب ${customerData.name}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        html, body {
          width: 210mm;
          font-family: 'Noto Sans Arabic', Arial, sans-serif;
          direction: rtl;
          text-align: right;
          background: white;
          color: #000;
          font-size: 12px;
          line-height: 1.4;
          overflow: visible;
        }
        
        .statement-container {
          width: 210mm;
          padding: 10mm 15mm;
          display: flex;
          flex-direction: column;
        }
        
        /* Header table for repeating on all pages */
        .header-table {
          width: 100%;
          margin-bottom: 15px;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #000;
          padding-bottom: 15px;
          margin-bottom: 15px;
        }
        
        .statement-info {
          text-align: left;
          direction: ltr;
        }
        
        .statement-title {
          font-size: 24px;
          font-weight: bold;
          color: #000;
          margin-bottom: 8px;
        }
        
        .statement-details {
          font-size: 11px;
          color: #666;
          line-height: 1.5;
        }
        
        .company-info {
          text-align: right;
        }
        
        .company-logo {
          max-width: 160px;
          height: auto;
          object-fit: contain;
        }
        
        .customer-info {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 0;
          margin-bottom: 15px;
          border-right: 4px solid #000;
        }
        
        .customer-title {
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 8px;
          color: #000;
        }
        
        .customer-details {
          font-size: 12px;
          line-height: 1.5;
        }
        
        /* Main table wrapper */
        .table-wrapper {
          width: 100%;
        }
        
        .transactions-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          table-layout: fixed;
        }
        
        .transactions-table th {
          background: #000;
          color: white;
          padding: 10px 6px;
          text-align: center;
          font-weight: bold;
          border: 1px solid #000;
          font-size: 10px;
          height: 35px;
        }
        
        .transactions-table td {
          padding: 6px 4px;
          text-align: center;
          border: 1px solid #ddd;
          font-size: 9px;
          vertical-align: middle;
          height: 28px;
          word-wrap: break-word;
          overflow-wrap: break-word;
          max-width: 150px;
        }
        
        .transactions-table tbody tr:nth-child(even) {
          background: #f8f9fa;
        }
        
        .debit {
          color: #dc2626;
          font-weight: bold;
        }
        
        .credit {
          color: #16a34a;
          font-weight: bold;
        }
        
        .balance {
          font-weight: bold;
        }
        
        .summary-section {
          margin-top: 20px;
          border-top: 2px solid #000;
          padding-top: 15px;
          page-break-inside: avoid;
        }
        
        .summary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 0;
          font-size: 13px;
        }

        .summary-row.total-debits {
          font-size: 14px;
          font-weight: bold;
          color: #dc2626;
          margin-bottom: 8px;
        }

        .summary-row.total-credits {
          font-size: 14px;
          font-weight: bold;
          color: #16a34a;
          margin-bottom: 8px;
        }
        
        .summary-row.balance {
          font-size: 18px;
          font-weight: bold;
          background: #000;
          color: white;
          padding: 15px 20px;
          border-radius: 0;
          margin-top: 10px;
          border: none;
        }
        
        .currency {
          font-weight: bold;
          color: #FFD700;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
        }
        
        .footer {
          text-align: center;
          font-size: 10px;
          color: #666;
          border-top: 1px solid #ddd;
          padding-top: 10px;
          margin-top: 20px;
        }
        
        @media print {
          html, body {
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color-adjust: exact;
          }
          
          .statement-container {
            width: 210mm !important;
            padding: 8mm 12mm !important;
          }
          
          /* Header repeats on each page */
          thead {
            display: table-header-group;
          }
          
          /* Footer repeats on each page */
          tfoot {
            display: table-footer-group;
          }
          
          /* Prevent row breaks */
          tr {
            page-break-inside: avoid;
          }
          
          /* Summary section stays together */
          .summary-section {
            page-break-inside: avoid;
          }
          
          /* Page header - repeats on each page */
          .page-header {
            position: running(pageHeader);
          }
          
          @page {
            size: A4 portrait;
            margin: 12mm 10mm 15mm 10mm;
            
            @top-center {
              content: element(pageHeader);
            }
          }
        }
      </style>
    </head>
    <body>
      <!-- Wrapper table for repeating header/footer -->
      <table class="page-wrapper" style="width: 100%; border-collapse: collapse;">
        <!-- Repeating header on each page -->
        <thead>
          <tr>
            <td style="padding: 0;">
              <div class="header">
                <div class="statement-info">
                  <div class="statement-title">كشف حساب</div>
                  <div class="statement-details">
                    رقم الكشف: ${finalStatementNumber}<br>
                    التاريخ: ${finalStatementDate}<br>
                    الفترة: ${periodStart} - ${periodEnd}
                  </div>
                </div>
                
                <div class="company-info">
                  <img src="${logoDataUri}" alt="شعار الشركة" class="company-logo">
                </div>
              </div>
            </td>
          </tr>
        </thead>
        
        <!-- Repeating footer on each page -->
        <tfoot>
          <tr>
            <td style="padding: 0;">
              <div class="footer">
                شكراً لتعاملكم معنا | Thank you for your business<br>
                هذا كشف حساب إلكتروني ولا يحتاج إلى ختم أو توقيع
              </div>
            </td>
          </tr>
        </tfoot>
        
        <!-- Main content -->
        <tbody>
          <tr>
            <td style="padding: 0; vertical-align: top;">
              <div class="statement-container">
                <div class="customer-info">
                  <div class="customer-title">بيانات العميل</div>
                  <div class="customer-details">
                    <strong>الاسم:</strong> ${customerData.name}<br>
                    ${customerData.company ? `<strong>الشركة:</strong> ${customerData.company}<br>` : ''}
                    ${customerData.phone ? `<strong>الهاتف:</strong> ${customerData.phone}<br>` : ''}
                    ${customerData.email ? `<strong>البريد الإلكتروني:</strong> ${customerData.email}<br>` : ''}
                    <strong>رقم العميل:</strong> ${customerData.id}
                  </div>
                </div>
                
                <table class="transactions-table">
                  <thead>
                    <tr>
                      <th style="width: 6%">#</th>
                      <th style="width: 11%">التاريخ</th>
                      <th style="width: 22%">البيان</th>
                      <th style="width: 11%">المرجع</th>
                      <th style="width: 12%">مدين</th>
                      <th style="width: 12%">دائن</th>
                      <th style="width: 13%">الرصيد</th>
                      <th style="width: 13%">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${allTransactions.map((transaction, index) => `
                      <tr>
                        <td>${index + 1}</td>
                        <td>${transaction.date ? new Date(transaction.date).toLocaleDateString('ar-LY-u-nu-latn') : '—'}</td>
                        <td style="text-align: right; padding-right: 8px;">${transaction.description}</td>
                        <td>${transaction.reference}</td>
                        <td class="debit">${transaction.debit > 0 ? `${currency.symbol} ${formatArabicNumber(transaction.debit)}` : '—'}</td>
                        <td class="credit">${transaction.credit > 0 ? `${currency.symbol} ${formatArabicNumber(transaction.credit)}` : '—'}</td>
                        <td class="balance">${currency.symbol} ${formatArabicNumber(transaction.balance)}</td>
                        <td style="text-align: right; padding-right: 8px;">${transaction.notes || '—'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
                
                <div class="summary-section">
                  <div class="summary-row total-debits">
                    <span>إجمالي المدين:</span>
                    <span>${currency.symbol} ${formatArabicNumber(statistics.totalDebits)}</span>
                  </div>
                  <div class="summary-row total-credits">
                    <span>إجمالي الدائن:</span>
                    <span>- ${currency.symbol} ${formatArabicNumber(statistics.totalCredits)}</span>
                  </div>
                  <div class="summary-row balance" style="background: ${statistics.balance > 0 ? '#000' : '#065f46'};">
                    <span>الرصيد النهائي:</span>
                    <span class="currency">${currency.symbol} ${formatArabicNumber(Math.abs(statistics.balance))}${statistics.balance < 0 ? ' (رصيد دائن)' : statistics.balance === 0 ? ' (مسدد بالكامل)' : ''}</span>
                  </div>
                  <div style="margin-top: 12px; font-size: 12px; color: #666; text-align: center;">
                    الرصيد بالكلمات: ${numberToArabicWords(Math.abs(statistics.balance))} ${currency.writtenName}${statistics.balance < 0 ? ' (رصيد دائن)' : statistics.balance === 0 ? ' (مسدد بالكامل)' : ''}
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </body>
    </html>
  `;
}

/**
 * نسخة async من توليد كشف الحساب تستخدم إعدادات تصميم الطباعة الموحدة
 */
export async function generateUnifiedAccountStatementHTML({
  customerData,
  allTransactions,
  statistics,
  currency,
  startDate,
  endDate,
  statementNumber,
  statementDate,
}: GenerateAccountStatementHTMLParams): Promise<string> {
  // جلب إعدادات القالب المحفوظة
  const styles = await getMergedInvoiceStylesAsync('account_statement');
  
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const logoUrl = styles.logoPath || '/logofaresgold.svg';
  const fullLogoUrl = logoUrl.startsWith('http') ? logoUrl : `${baseUrl}${logoUrl}`;

  const periodStart = startDate ? new Date(startDate).toLocaleDateString('ar-LY-u-nu-latn') : 'غير محدد';
  const periodEnd = endDate ? new Date(endDate).toLocaleDateString('ar-LY-u-nu-latn') : 'غير محدد';
  const finalStatementDate = statementDate || new Date().toLocaleDateString('ar-LY-u-nu-latn');
  const finalStatementNumber = statementNumber || `STMT-${Date.now()}`;

  const metaLinesHtml = `
    <div><strong>رقم الكشف:</strong> ${finalStatementNumber}</div>
    <div><strong>التاريخ:</strong> ${finalStatementDate}</div>
    <div><strong>الفترة:</strong> ${periodStart} - ${periodEnd}</div>
  `;

  const headerHtml = unifiedHeaderHtml({
    styles,
    fullLogoUrl,
    metaLinesHtml,
    titleAr: 'كشف حساب',
    titleEn: 'ACCOUNT STATEMENT'
  });

  const footerHtml = unifiedFooterHtml(styles);

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>كشف حساب ${customerData.name}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
        @font-face { font-family: 'Manrope'; src: url('${baseUrl}/Manrope-Bold.otf') format('opentype'); font-weight: 700; }
        @font-face { font-family: 'Doran'; src: url('${baseUrl}/Doran-Regular.otf') format('opentype'); font-weight: 400; }
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        html, body {
          width: 210mm;
          font-family: '${styles.fontFamily || 'Doran'}', 'Noto Sans Arabic', Arial, sans-serif;
          direction: rtl;
          text-align: right;
          background: white;
          color: #000;
          font-size: ${styles.bodyFontSize || 12}px;
          line-height: 1.4;
          overflow: visible;
        }
        
        .statement-container {
          width: 210mm;
          padding: ${styles.pageMarginTop || 10}mm ${styles.pageMarginRight || 15}mm ${styles.pageMarginBottom || 10}mm ${styles.pageMarginLeft || 15}mm;
          display: flex;
          flex-direction: column;
        }
        
        ${unifiedHeaderFooterCss(styles)}
        
        .content-area { flex: 1; }
        
        .customer-info {
          background: ${styles.customerSectionBgColor || '#f8f9fa'};
          padding: 15px;
          border-radius: 0;
          margin-bottom: 15px;
          border-right: 4px solid ${styles.customerSectionBorderColor || styles.primaryColor || '#D4AF37'};
        }
        
        .customer-title {
          font-size: ${styles.headerFontSize || 14}px;
          font-weight: bold;
          margin-bottom: 8px;
          color: ${styles.customerSectionTitleColor || styles.primaryColor || '#D4AF37'};
        }
        
        .customer-details {
          font-size: ${styles.bodyFontSize || 12}px;
          line-height: 1.5;
          color: ${styles.customerSectionTextColor || '#333'};
        }
        
        .transactions-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          table-layout: fixed;
        }
        
        .transactions-table th {
          background: ${styles.tableHeaderBgColor || styles.primaryColor || '#D4AF37'};
          color: ${styles.tableHeaderTextColor || '#fff'};
          padding: ${(styles as any).tableHeaderPadding || '10px 6px'};
          text-align: center;
          font-weight: ${(styles as any).tableHeaderFontWeight || 'bold'};
          border: ${(styles as any).tableBorderWidth || 1}px ${(styles as any).tableBorderStyle || 'solid'} ${styles.tableBorderColor || styles.primaryColor || '#D4AF37'};
          font-size: ${(styles as any).tableHeaderFontSize || 10}px;
          height: 35px;
        }
        
        .transactions-table td {
          padding: ${(styles as any).tableBodyPadding || '6px 4px'};
          text-align: center;
          border: ${(styles as any).tableBorderWidth || 1}px ${(styles as any).tableBorderStyle || 'solid'} ${styles.tableBorderColor || '#ddd'};
          font-size: ${(styles as any).tableBodyFontSize || 9}px;
          vertical-align: middle;
          height: 28px;
          color: ${styles.tableTextColor || '#333'};
          line-height: ${(styles as any).tableLineHeight || '1.4'};
        }
        
        .transactions-table tbody tr:nth-child(even) {
          background: ${styles.tableRowEvenColor || '#f8f9fa'};
        }
        
        .transactions-table tbody tr:nth-child(odd) {
          background: ${styles.tableRowOddColor || '#fff'};
        }
        
        .debit { color: ${styles.balanceSummaryNegativeColor || '#dc2626'}; font-weight: bold; }
        .credit { color: ${styles.balanceSummaryPositiveColor || '#16a34a'}; font-weight: bold; }
        .balance { font-weight: bold; }
        
        .summary-section {
          margin-top: 20px;
          border-top: 2px solid ${styles.primaryColor || '#D4AF37'};
          padding-top: 15px;
          page-break-inside: avoid;
        }
        
        .summary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 0;
          font-size: 13px;
        }

        .summary-row.total-debits {
          font-size: 14px;
          font-weight: bold;
          color: ${styles.balanceSummaryNegativeColor || '#dc2626'};
          margin-bottom: 8px;
        }

        .summary-row.total-credits {
          font-size: 14px;
          font-weight: bold;
          color: ${styles.balanceSummaryPositiveColor || '#16a34a'};
          margin-bottom: 8px;
        }
        
        .summary-row.balance-total {
          font-size: 18px;
          font-weight: bold;
          background: ${styles.totalBgColor || styles.primaryColor || '#D4AF37'};
          color: ${styles.totalTextColor || '#fff'};
          padding: 15px 20px;
          border-radius: 0;
          margin-top: 10px;
        }
        
        @media print {
          html, body {
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          tr { page-break-inside: avoid; }
          .summary-section { page-break-inside: avoid; }
          
          @page {
            size: A4 portrait;
            margin: 12mm 10mm 15mm 10mm;
          }
        }
      </style>
    </head>
    <body>
      <table class="page-wrapper" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr><td style="padding: 0;">${headerHtml}</td></tr>
        </thead>
        
        <tfoot>
          <tr><td style="padding: 0;">${footerHtml}</td></tr>
        </tfoot>
        
        <tbody>
          <tr>
            <td style="padding: 0; vertical-align: top;">
              <div class="statement-container">
                <div class="customer-info">
                  <div class="customer-title">بيانات العميل</div>
                  <div class="customer-details">
                    <strong>الاسم:</strong> ${customerData.name}<br>
                    ${customerData.company ? `<strong>الشركة:</strong> ${customerData.company}<br>` : ''}
                    ${customerData.phone ? `<strong>الهاتف:</strong> ${customerData.phone}<br>` : ''}
                    ${customerData.email ? `<strong>البريد الإلكتروني:</strong> ${customerData.email}<br>` : ''}
                    <strong>رقم العميل:</strong> ${customerData.id}
                  </div>
                </div>
                
                <table class="transactions-table">
                  <thead>
                    <tr>
                      <th style="width: 6%">#</th>
                      <th style="width: 11%">التاريخ</th>
                      <th style="width: 22%">البيان</th>
                      <th style="width: 11%">المرجع</th>
                      <th style="width: 12%">مدين</th>
                      <th style="width: 12%">دائن</th>
                      <th style="width: 13%">الرصيد</th>
                      <th style="width: 13%">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${allTransactions.map((transaction, index) => `
                      <tr>
                        <td>${index + 1}</td>
                        <td>${transaction.date ? new Date(transaction.date).toLocaleDateString('ar-LY-u-nu-latn') : '—'}</td>
                        <td style="text-align: right; padding-right: 8px;">${transaction.description}</td>
                        <td>${transaction.reference}</td>
                        <td class="debit">${transaction.debit > 0 ? `${currency.symbol} ${formatArabicNumber(transaction.debit)}` : '—'}</td>
                        <td class="credit">${transaction.credit > 0 ? `${currency.symbol} ${formatArabicNumber(transaction.credit)}` : '—'}</td>
                        <td class="balance">${currency.symbol} ${formatArabicNumber(transaction.balance)}</td>
                        <td style="text-align: right; padding-right: 8px;">${transaction.notes || '—'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
                
                <div class="summary-section">
                  <div class="summary-row total-debits">
                    <span>إجمالي المدين:</span>
                    <span>${currency.symbol} ${formatArabicNumber(statistics.totalDebits)}</span>
                  </div>
                  <div class="summary-row total-credits">
                    <span>إجمالي الدائن:</span>
                    <span>- ${currency.symbol} ${formatArabicNumber(statistics.totalCredits)}</span>
                  </div>
                  <div class="summary-row balance-total" style="background: ${statistics.balance > 0 ? (styles.totalBgColor || styles.primaryColor || '#D4AF37') : (styles.balanceSummaryPositiveColor || '#065f46')};">
                    <span>الرصيد النهائي:</span>
                    <span>${currency.symbol} ${formatArabicNumber(Math.abs(statistics.balance))}${statistics.balance < 0 ? ' (رصيد دائن)' : statistics.balance === 0 ? ' (مسدد بالكامل)' : ''}</span>
                  </div>
                  <div style="margin-top: 12px; font-size: 12px; color: #666; text-align: center;">
                    الرصيد بالكلمات: ${numberToArabicWords(Math.abs(statistics.balance))} ${currency.writtenName}${statistics.balance < 0 ? ' (رصيد دائن)' : statistics.balance === 0 ? ' (مسدد بالكامل)' : ''}
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </body>
    </html>
  `;
}
