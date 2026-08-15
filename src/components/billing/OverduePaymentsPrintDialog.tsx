import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { getMergedInvoiceStylesAsync } from '@/hooks/useInvoiceSettingsSync';
import { unifiedHeaderHtml, type UnifiedPrintStyles } from '@/lib/unifiedInvoiceBase';

interface OverdueInstallment {
  contractNumber: number;
  customerName: string;
  customerId: string | null;
  installmentAmount: number;
  dueDate: string;
  description: string;
  daysOverdue: number;
  installmentId?: string;
  adType?: string;
}

interface UnpaidPrintInvoice {
  invoiceId: string;
  contractNumber: number;
  customerName: string;
  customerId: string | null;
  amount: number;
  createdAt: string;
  daysOverdue: number;
  adType?: string;
}

interface CustomerOverdue {
  customerId: string | null;
  customerName: string;
  totalOverdue: number;
  overdueCount: number;
  oldestDueDate: string;
  oldestDaysOverdue: number;
  installments: OverdueInstallment[];
  unpaidInvoices: UnpaidPrintInvoice[];
}

interface OverduePaymentsPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerOverdue: CustomerOverdue;
}

export function OverduePaymentsPrintDialog({
  open,
  onOpenChange,
  customerOverdue,
}: OverduePaymentsPrintDialogProps) {
  const [styles, setStyles] = useState<UnifiedPrintStyles | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (open) {
      setIsLoading(true);
      getMergedInvoiceStylesAsync('receipt').then((s) => {
        setStyles(s);
        setIsLoading(false);
      });
    }
  }, [open]);
  
  const handlePrint = async () => {
    const printContent = document.getElementById('overdue-statement-print');
    if (!printContent || !styles) return;

    const baseUrl = window.location.origin;
    const logoUrl = styles.logoPath || '/logofaresgold.svg';
    const fullLogoUrl = logoUrl.startsWith('http') ? logoUrl : `${baseUrl}${logoUrl}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>كشف الدفعات المتأخرة</title>
        ${printContent.querySelector('style')?.outerHTML || ''}
      </head>
      <body>
        ${printContent.innerHTML.replace('/logofaresgold.svg', fullLogoUrl)}
      </body>
      </html>
    `;
    
    const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
    showPrintPreview(htmlContent, 'كشف الدفعات المتأخرة', 'billing-overdue');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ar-LY-u-nu-latn');
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto print:max-w-full print:max-h-full">
        <div className="print:hidden flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">كشف الدفعات المتأخرة</h2>
          <div className="flex gap-2">
            <Button onClick={handlePrint} variant="default">
              طباعة
            </Button>
            <Button onClick={() => onOpenChange(false)} variant="outline" size="icon">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div id="overdue-statement-print" className="bg-white">
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700;900&display=swap');
            
            @media print {
              @page { size: A4 portrait; margin: 10mm; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              #overdue-statement-print { width: 100% !important; max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
            }
            
            #overdue-statement-print {
              font-family: 'Noto Sans Arabic', Arial, sans-serif;
              direction: rtl;
              color: #1f2937;
              line-height: 1.6;
              background: white;
              padding: 40px;
            }
            
            .statement-header {
              background: ${styles?.primaryColor || '#1f2937'};
              color: white;
              padding: 30px;
              border-radius: 12px;
              text-align: center;
              margin-bottom: 30px;
            }
            
            .statement-title { font-size: 32px; font-weight: 900; margin-bottom: 8px; }
            .statement-subtitle { font-size: 16px; opacity: 0.95; font-weight: 600; }
            
            .company-logo { text-align: center; margin-bottom: 20px; }
            .company-logo img { max-width: ${styles?.logoSize || 200}px; height: auto; }
            
            .customer-info {
              background: ${styles?.primaryColor}10;
              border: 2px solid ${styles?.primaryColor || '#dc2626'};
              border-radius: 12px;
              padding: 25px;
              margin-bottom: 30px;
            }
            
            .customer-info-title {
              font-size: 20px;
              font-weight: 900;
              color: ${styles?.primaryColor || '#dc2626'};
              margin-bottom: 15px;
            }
            
            .customer-details { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
            
            .customer-detail-item {
              display: flex;
              justify-content: space-between;
              padding: 12px;
              background: white;
              border-radius: 8px;
              border: 1px solid ${styles?.tableBorderColor || '#e5e7eb'};
            }
            
            .detail-label { font-weight: 700; color: ${styles?.customerSectionTextColor || '#6b7280'}; }
            .detail-value { font-weight: 900; color: #111827; }
            }
            
            .detail-label {
              font-weight: 700;
              color: #6b7280;
            }
            
            .detail-value {
              font-weight: 900;
              color: #111827;
            }
            
            .summary-section {
              background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
              color: white;
              padding: 25px;
              border-radius: 12px;
              margin-bottom: 30px;
              text-align: center;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            
            .summary-title {
              font-size: 18px;
              font-weight: 700;
              margin-bottom: 15px;
              opacity: 0.95;
            }
            
            .summary-amount {
              font-size: 40px;
              font-weight: 900;
              text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
            }
            
            .section-title {
              font-size: 22px;
              font-weight: 900;
              color: #dc2626;
              margin: 30px 0 20px;
              padding-bottom: 10px;
              border-bottom: 3px solid #dc2626;
              display: flex;
              align-items: center;
              gap: 10px;
            }
            
            .payments-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              border-radius: 8px;
              overflow: hidden;
            }
            
            .payments-table thead {
              background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
              color: white;
            }
            
            .payments-table th {
              padding: 15px 12px;
              text-align: center;
              font-weight: 700;
              font-size: 14px;
              border: 1px solid #374151;
            }
            
            .payments-table td {
              padding: 12px;
              text-align: center;
              border: 1px solid #e5e7eb;
              font-size: 13px;
            }
            
            .payments-table tbody tr:nth-child(even) {
              background: #f9fafb;
            }
            
            .payments-table tbody tr:hover {
              background: #fef3c7;
            }
            
            .overdue-badge {
              display: inline-block;
              background: #fee2e2;
              color: #991b1b;
              padding: 6px 12px;
              border-radius: 6px;
              font-weight: 900;
              font-size: 12px;
              border: 2px solid #dc2626;
            }
            
            .contract-badge {
              display: inline-block;
              background: #dbeafe;
              color: #1e40af;
              padding: 6px 12px;
              border-radius: 6px;
              font-weight: 700;
              font-size: 12px;
              border: 1px solid #3b82f6;
            }
            
            .amount-cell {
              font-weight: 900;
              color: #dc2626;
              font-size: 15px;
            }
            
            .warning-box {
              background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
              border: 3px solid #f59e0b;
              border-radius: 12px;
              padding: 25px;
              margin: 30px 0;
              text-align: center;
            }
            
            .warning-title {
              font-size: 20px;
              font-weight: 900;
              color: #92400e;
              margin-bottom: 10px;
            }
            
            .warning-text {
              font-size: 15px;
              color: #78350f;
              font-weight: 600;
              line-height: 1.8;
            }
            
            .footer {
              background: #f9fafb;
              border-top: 3px solid #dc2626;
              padding: 20px;
              text-align: center;
              margin-top: 40px;
              border-radius: 8px;
            }
            
            .footer-date {
              color: #6b7280;
              font-size: 13px;
              font-weight: 600;
              margin-bottom: 8px;
            }
            
            .footer-text {
              color: #9ca3af;
              font-size: 11px;
              font-weight: 500;
            }
            
            .divider {
              height: 3px;
              background: linear-gradient(90deg, transparent 0%, #dc2626 50%, transparent 100%);
              margin: 25px 0;
            }
          `}</style>

          <div className="company-logo">
            <img src="/logofaresgold.svg" alt="شعار الشركة" />
          </div>

          <div className="statement-header">
            <div className="statement-title">كشف الدفعات المتأخرة</div>
            <div className="statement-subtitle">بيان تفصيلي بالمستحقات المتأخرة</div>
          </div>

          <div className="customer-info">
            <div className="customer-info-title">
              <span>بيانات العميل</span>
            </div>
            <div className="customer-details">
              <div className="customer-detail-item">
                <span className="detail-label">اسم العميل:</span>
                <span className="detail-value">{customerOverdue.customerName}</span>
              </div>
              <div className="customer-detail-item">
                <span className="detail-label">عدد الدفعات المتأخرة:</span>
                <span className="detail-value">{customerOverdue.overdueCount} دفعة</span>
              </div>
              <div className="customer-detail-item">
                <span className="detail-label">أقدم تأخير:</span>
                <span className="detail-value">{customerOverdue.oldestDaysOverdue} يوم</span>
              </div>
              <div className="customer-detail-item">
                <span className="detail-label">تاريخ الإصدار:</span>
                <span className="detail-value">{formatDate(new Date().toISOString())}</span>
              </div>
            </div>
          </div>

          <div className="summary-section">
            <div className="summary-title">إجمالي المستحقات المتأخرة</div>
            <div className="summary-amount">{formatCurrency(customerOverdue.totalOverdue)} د.ل</div>
          </div>

          <div className="divider"></div>

          {customerOverdue.installments.length > 0 && (
            <>
              <div className="section-title">
                <span>دفعات العقود المتأخرة ({customerOverdue.installments.length})</span>
              </div>
              <table className="payments-table">
                <thead>
                  <tr>
                    <th style={{width: '8%'}}>#</th>
                    <th style={{width: '18%'}}>رقم العقد</th>
                    <th style={{width: '20%'}}>نوع الإعلان</th>
                    <th style={{width: '16%'}}>المبلغ</th>
                    <th style={{width: '16%'}}>تاريخ الاستحقاق</th>
                    <th style={{width: '12%'}}>مدة التأخير</th>
                    <th style={{width: '10%'}}>الوصف</th>
                  </tr>
                </thead>
                <tbody>
                  {customerOverdue.installments.map((installment, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>
                        <span className="contract-badge">عقد #{installment.contractNumber}</span>
                      </td>
                      <td style={{fontWeight: '700', color: '#1e40af'}}>
                        {installment.adType || '—'}
                      </td>
                      <td className="amount-cell">{formatCurrency(installment.installmentAmount)} د.ل</td>
                      <td style={{fontWeight: '600'}}>{formatDate(installment.dueDate)}</td>
                      <td>
                        <span className="overdue-badge">{installment.daysOverdue} يوم</span>
                      </td>
                      <td style={{fontSize: '12px', color: '#6b7280'}}>{installment.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {customerOverdue.unpaidInvoices.length > 0 && (
            <>
              <div className="section-title">
                <span>فواتير الطباعة غير المسددة ({customerOverdue.unpaidInvoices.length})</span>
              </div>
              <table className="payments-table">
                <thead>
                  <tr>
                    <th style={{width: '8%'}}>#</th>
                    <th style={{width: '18%'}}>رقم العقد</th>
                    <th style={{width: '20%'}}>نوع الإعلان</th>
                    <th style={{width: '18%'}}>المبلغ</th>
                    <th style={{width: '18%'}}>تاريخ الإصدار</th>
                    <th style={{width: '18%'}}>مدة التأخير</th>
                  </tr>
                </thead>
                <tbody>
                  {customerOverdue.unpaidInvoices.map((invoice, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>
                        <span className="contract-badge">عقد #{invoice.contractNumber}</span>
                      </td>
                      <td style={{fontWeight: '700', color: '#1e40af'}}>
                        {invoice.adType || '—'}
                      </td>
                      <td className="amount-cell">{formatCurrency(invoice.amount)} د.ل</td>
                      <td style={{fontWeight: '600'}}>{formatDate(invoice.createdAt)}</td>
                      <td>
                        <span className="overdue-badge">{invoice.daysOverdue} يوم</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div className="warning-box">
            <div className="warning-title">تنبيه هام</div>
            <div className="warning-text">
              يُرجى تسديد المبالغ المستحقة في أقرب وقت ممكن لتجنب أي إجراءات قانونية.
            </div>
          </div>

          <div className="footer">
            <div className="footer-date">
              تاريخ الطباعة: {formatDate(new Date().toISOString())} | الوقت: {new Date().toLocaleTimeString('ar-LY')}
            </div>
            <div className="footer-text">
              شكراً لتعاملكم معنا | هذا البيان صادر آلياً من نظام الإدارة
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
