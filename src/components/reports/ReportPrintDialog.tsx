import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useRef } from 'react';
import DOMPurify from 'dompurify';
import type { Report } from '@/pages/Reports';
import type { ReportItem } from './ReportItemsManager';
import { getFontFamily } from './FontSelector';

interface ReportPrintDialogProps {
  report: Report | null;
  reports?: Report[]; // للتقارير المجمعة (أسبوعي/شهري)
  open: boolean;
  onClose: () => void;
}

export function ReportPrintDialog({ report, reports, open, onClose }: ReportPrintDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);
  
  const isGroupedReport = reports && reports.length > 0;

  const { data: items = [] } = useQuery({
    queryKey: ['report-items', report?.id],
    queryFn: async () => {
      if (!report?.id || report.id === 'grouped') return [];
      const { data, error } = await supabase
        .from('report_items')
        .select('*')
        .eq('report_id', report.id)
        .order('order_index');
      
      if (error) throw error;
      return data as ReportItem[];
    },
    enabled: !!report?.id && open && report?.id !== 'grouped',
  });

  const handlePrint = () => {
    if (printRef.current) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html dir="rtl" lang="ar">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${report?.title ?? 'تقرير'}</title>
            <style>
              @page { size: A4; margin: 15mm; }
              * { margin: 0; padding: 0; box-sizing: border-box; }
              
              body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                direction: rtl; 
                background: white;
                padding: 0;
                margin: 0;
                color: #000;
              }
              
              .page-wrapper { 
                width: 100%; 
                background: white;
                padding: 20px;
              }
              
              .content-area { 
                width: 100%;
                max-width: 210mm;
                margin: 0 auto;
              }
              
              /* Header مثل فواتير العقود */
              .print-header {
                display: grid;
                grid-template-columns: 120px 1fr 120px;
                gap: 20px;
                align-items: center;
                padding: 15px 0;
                border-bottom: 4px solid #d4ab3f;
                margin-bottom: 25px;
              }
              
              .logo-section {
                display: flex;
                justify-content: flex-start;
              }
              
              .logo-section img {
                max-width: 150px;
                width: 150px;
                height: auto;
              }
              
              .header-center {
                text-align: center;
              }
              
              .header-center h1 {
                font-size: 22px;
                font-weight: bold;
                color: #000;
                margin-bottom: 5px;
              }
              
              .header-center .report-type {
                font-size: 14px;
                color: #666;
                font-weight: 600;
              }
              
              .header-dates {
                text-align: left;
                font-size: 12px;
                color: #333;
              }
              
              .header-dates p {
                margin: 3px 0;
                line-height: 1.6;
              }
              
              .header-dates strong {
                color: #000;
              }
              
              .container { width: 100%; padding: 0; }
              
              .ql-editor { 
                padding: 0; 
                color: #000;
                line-height: 1.8;
                font-size: 13px;
              }
              
              .ql-editor p { 
                margin-bottom: 8px; 
                color: #000; 
              }
              
              .ql-editor h1, .ql-editor h2, .ql-editor h3 { 
                margin: 15px 0 10px; 
                color: #000;
                font-weight: bold;
              }
              
              .ql-editor ul, .ql-editor ol { 
                padding-right: 25px; 
                color: #000;
                margin: 10px 0;
              }
              
              .section { 
                margin: 20px 0; 
                padding: 15px; 
                border-radius: 8px; 
                background: #f9f9f9; 
                border: 1px solid #ddd;
                page-break-inside: auto;
                break-inside: auto;
              }
              
              .section-title { 
                font-size: 16px; 
                font-weight: bold; 
                color: #000; 
                margin-bottom: 12px; 
                border-bottom: 2px solid #d4ab3f; 
                padding-bottom: 8px;
              }
              
              .item-card {
                background: white;
                border: 1px solid #ddd;
                border-radius: 6px;
                padding: 12px;
                margin-bottom: 10px;
                page-break-inside: avoid;
              }
              
              .item-card:last-child {
                margin-bottom: 0;
              }
              
              .item-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
                padding-bottom: 8px;
                border-bottom: 1px solid #eee;
              }
              
              .item-title {
                font-size: 14px;
                font-weight: bold;
                color: #000;
              }
              
              .item-row { 
                display: flex; 
                justify-content: space-between; 
                padding: 6px 0; 
                font-size: 12px;
                border-bottom: 1px solid #f0f0f0;
              }
              
              .item-row:last-child { 
                border-bottom: none; 
              }
              
              .item-label { 
                font-weight: 600; 
                color: #333;
              }
              
              .item-value { 
                color: #000;
                font-weight: 500;
              }
              
              .footer { 
                margin-top: 30px; 
                text-align: center; 
                padding-top: 15px; 
                border-top: 2px solid #d4ab3f; 
                color: #666; 
                font-size: 11px;
              }
              
              .daily-report { 
                margin: 15px 0; 
                padding: 15px; 
                border: 1px solid #ddd; 
                border-radius: 8px; 
                background: #f9f9f9;
                page-break-inside: avoid;
              }
              
              .daily-report h3 { 
                font-size: 16px; 
                color: #000; 
                margin-bottom: 10px;
                font-weight: bold;
              }
              
              .daily-report h4 { 
                color: #000;
                font-size: 14px;
                margin: 8px 0;
              }
              
              .daily-report p { 
                color: #000;
                line-height: 1.6;
              }
              
              @media print {
                body { 
                  print-color-adjust: exact; 
                  -webkit-print-color-adjust: exact; 
                  padding: 0;
                  margin: 0;
                }
                
                .page-wrapper {
                  padding: 15mm;
                }
                
                .no-print { 
                  display: none !important; 
                }
                
                .page-break { 
                  page-break-before: always; 
                }
                
                  .print-header {
                    page-break-after: avoid;
                  }
                  .section {
                    page-break-inside: auto;
                    break-inside: auto;
                  }
                  .item-card, .daily-report {
                    page-break-inside: avoid;
                    break-inside: avoid;
                  }
              }
            </style>
          </head>
          <body style="font-family: ${(report as any)?.font_family ? getFontFamily((report as any).font_family) : 'system-ui'};">
            <div class="page-wrapper">
              <div class="content-area">
                ${printRef.current.innerHTML}
              </div>
            </div>
          </body>
          </html>
        `);
        printWindow.document.close();
        
        // انتظار تحميل المحتوى ثم الطباعة - بدون إغلاق تلقائي
        printWindow.onload = function() {
          setTimeout(() => {
            printWindow.focus();
            printWindow.print();
          }, 500);
        };
      }
    }
  };

  if (!report) return null;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-end gap-2 mb-4 no-print">
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            طباعة التقرير
          </Button>
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div ref={printRef} className="space-y-6" dir="rtl">
          {/* Header Section - مثل فواتير العقود */}
          <div className="print-header grid grid-cols-[120px_1fr_120px] gap-5 items-center border-b-4 border-[#d4ab3f] pb-4 mb-6">
            {/* Logo on Left */}
            <div className="logo-section flex justify-start">
              <img src="/new-logo.svg" alt="Logo" className="max-w-[150px] h-auto" />
            </div>
            
            {/* Report Title Center */}
            <div className="header-center text-center">
              <h1 className="text-2xl font-bold text-foreground mb-1">{report.title}</h1>
            </div>
            
            {/* Dates on Right */}
            <div className="header-dates text-left text-xs text-muted-foreground">
              <p>
                <strong>التاريخ:</strong>{' '}
                {report.start_date && report.end_date 
                  ? format(new Date(report.start_date), 'P', { locale: ar })
                  : format(new Date(report.report_date), 'P', { locale: ar })
                }
              </p>
              <p>
                <strong>اليوم:</strong>{' '}
                {format(new Date(report.report_date), 'EEEE', { locale: ar })}
              </p>
            </div>
          </div>

          {/* Summary Section */}
          {report.summary && (
            <div className="section bg-accent/10 p-6 rounded-lg">
              <h3 className="section-title">محتوى التقرير</h3>
              <div 
                className="text-sm leading-relaxed ql-editor" 
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(report.summary) }}
              />
            </div>
          )}

          {/* Report Items (for single daily reports) */}
          {!isGroupedReport && items && items.length > 0 && (
            <div className="section">
              <h3 className="section-title">بنود التقرير</h3>
              <div className="space-y-3">
                {items.map((item: any) => (
                  <div key={item.id} className="item-card">
                    <div className="item-header">
                      <span className="item-title">{item.title}</span>
                    </div>
                    <div className="space-y-2">
                      {item.category && (
                        <div className="item-row">
                          <span className="item-label">التصنيف:</span>
                          <span className="item-value">{item.category}</span>
                        </div>
                      )}
                      {item.description && (
                        <div className="item-row">
                          <span className="item-label">الوصف:</span>
                          <span className="item-value">{item.description}</span>
                        </div>
                      )}
                      {item.amount && (
                        <div className="item-row">
                          <span className="item-label">المبلغ:</span>
                          <span className="item-value font-bold">
                            {Number(item.amount).toLocaleString('ar-LY')} د.ل
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grouped Reports (Weekly/Monthly) */}
          {isGroupedReport && reports && (
            <div className="section">
              <h3 className="section-title">
                {report.report_type === 'weekly' ? 'التقارير اليومية للأسبوع' : 'التقارير اليومية للشهر'}
              </h3>
              <div className="space-y-6">
                {reports.map((dailyReport, index) => (
                  <div key={dailyReport.id} className={`daily-report ${index > 0 ? 'page-break' : ''}`}>
                    <div className="p-5 bg-card border-2 rounded-lg">
                      <h4 className="text-lg font-bold mb-3 text-primary">
                        {dailyReport.title}
                      </h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        {format(new Date(dailyReport.report_date), 'PPP', { locale: ar })}
                      </p>
                      {dailyReport.summary && (
                        <div className="bg-accent/5 p-4 rounded mb-4">
                          <p className="text-sm whitespace-pre-wrap">{dailyReport.summary}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="footer mt-10 pt-6 border-t-2 border-[#d4ab3f] text-center text-sm text-muted-foreground">
            <p className="font-semibold">نظام إدارة اللوحات الإعلانية</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
