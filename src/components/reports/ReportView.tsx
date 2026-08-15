import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Edit, Printer, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';
import DOMPurify from 'dompurify';
import type { Report } from '@/pages/Reports';
import type { ReportItem } from './ReportItemsManager';
import { getFontFamily } from './FontSelector';
import { getFontWeight } from './FontWeightSelector';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ReportViewProps {
  report: Report | null;
  onClose: () => void;
  onEdit: (report: Report) => void;
  onPrint?: (report: Report) => void;
  onDeleted?: () => void;
}

export function ReportView({ report, onClose, onEdit, onPrint, onDeleted }: ReportViewProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const queryClient = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ['report-items', report?.id],
    queryFn: async () => {
      if (!report?.id) return [];
      const { data, error } = await supabase
        .from('report_items')
        .select('*')
        .eq('report_id', report.id)
        .order('order_index');
      
      if (error) throw error;
      return data as ReportItem[];
    },
    enabled: !!report?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!report?.id) return;
      
      // حذف بنود التقرير أولاً
      const { error: itemsError } = await supabase
        .from('report_items')
        .delete()
        .eq('report_id', report.id);
      
      if (itemsError) throw itemsError;
      
      // ثم حذف التقرير
      const { error: reportError } = await supabase
        .from('reports')
        .delete()
        .eq('id', report.id);
      
      if (reportError) throw reportError;
    },
    onSuccess: () => {
      toast.success('تم حذف التقرير بنجاح');
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      onClose();
      onDeleted?.();
    },
    onError: (error) => {
      console.error('Delete error:', error);
      toast.error('حدث خطأ أثناء حذف التقرير');
    },
  });

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    deleteMutation.mutate();
    setShowDeleteDialog(false);
  };

  const handlePrint = async () => {
    const { saveHtmlAsPdf } = await import('@/utils/pdfHelpers');
    const { BRAND_LOGO } = await import('@/lib/branding');
    
    const html = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Arial', sans-serif; 
            direction: rtl;
            text-align: right;
            background: white;
            padding: 15mm;
            color: #000;
          }
          .header { 
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 3px solid #D4AF37;
            padding-bottom: 12px;
            margin-bottom: 15px;
            page-break-after: avoid;
          }
          .header-content {
            flex: 1;
          }
          .header h1 { 
            font-size: 20px;
            margin: 0 0 6px 0;
            color: #000;
            font-weight: bold;
          }
          .header .meta { 
            color: #333;
            font-size: 11px;
            line-height: 1.4;
          }
          .logo {
            width: 150px;
            height: 150px;
            object-fit: contain;
            flex-shrink: 0;
          }
          .summary { 
            background: #f9f9f9;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            margin-bottom: 15px;
            page-break-inside: avoid;
          }
          .summary h3 {
            margin: 0 0 8px 0;
            color: #000;
            font-size: 14px;
            font-weight: bold;
          }
          .ql-editor { 
            padding: 0;
            color: #000;
            line-height: 1.6;
            font-size: 11px;
          }
          .ql-editor p { margin-bottom: 6px; }
          .ql-editor h1, .ql-editor h2, .ql-editor h3 { 
            margin: 10px 0 6px;
            font-weight: bold;
          }
          .ql-editor ul, .ql-editor ol { 
            padding-right: 20px;
            margin-bottom: 6px;
          }
          .items h3 { 
            font-size: 14px;
            margin-bottom: 10px;
            color: #000;
            font-weight: bold;
          }
          .item { 
            border: 1px solid #ddd;
            padding: 10px;
            margin-bottom: 8px;
            border-radius: 6px;
            page-break-inside: avoid;
            background: white;
          }
          .item-number { 
            display: inline-block;
            width: 24px;
            height: 24px;
            background: #D4AF37;
            color: white;
            text-align: center;
            line-height: 24px;
            border-radius: 50%;
            margin-left: 8px;
            font-weight: bold;
            font-size: 11px;
          }
          .item h4 { 
            display: inline-block;
            margin: 0 0 6px 0;
            font-size: 12px;
            color: #000;
            font-weight: bold;
          }
          .item p { 
            margin: 4px 0;
            color: #333;
            font-size: 10px;
            line-height: 1.5;
          }
          .item strong { 
            color: #000;
            font-weight: bold;
          }
          @page {
            size: A4;
            margin: 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-content">
            <h1>${report?.title || ''}</h1>
            <div class="meta">
              <p>التاريخ: ${format(new Date(report?.report_date || new Date()), 'PPP', { locale: ar })}</p>
              <p>اليوم: ${format(new Date(report?.report_date || new Date()), 'EEEE', { locale: ar })}</p>
              <p>${report?.report_type === 'daily' ? 'تقرير يومي' : report?.report_type === 'weekly' ? 'تقرير أسبوعي' : 'تقرير شهري'}</p>
            </div>
          </div>
          <img src="${BRAND_LOGO}" alt="الشعار" class="logo" crossorigin="anonymous" />
        </div>

        ${report?.summary ? `
        <div class="summary">
          <h3>محتوى التقرير</h3>
          <div class="ql-editor">${DOMPurify.sanitize(report.summary)}</div>
        </div>
        ` : ''}

        ${items.length > 0 ? `
        <div class="items">
          <h3>بنود التقرير</h3>
          ${items.map((item, index) => `
            <div class="item">
              <span class="item-number">${index + 1}</span>
              <h4>${item.title}</h4>
              ${item.description ? `<p>${item.description}</p>` : ''}
              ${item.status ? `<p><strong>الحالة:</strong> ${item.status}</p>` : ''}
              ${item.notes ? `<p><strong>ملاحظات:</strong> ${item.notes}</p>` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}
      </body>
      </html>
    `;

    await saveHtmlAsPdf(
      html,
      `تقرير_${report?.title}_${format(new Date(report?.report_date || new Date()), 'yyyy-MM-dd')}.pdf`,
      { marginMm: [0, 0, 0, 0], waitMs: 2500 }
    );
  };

  if (!report) return null;

  return (
    <>
      <Dialog open={!!report} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{report.title}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onEdit(report)}>
                  <Edit className="h-4 w-4 ml-2" />
                  تعديل
                </Button>
                <Button variant="outline" size="sm" onClick={() => onPrint?.(report)}>
                  <Printer className="h-4 w-4 ml-2" />
                  طباعة
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 ml-2" />
                  حذف
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

        <div className="space-y-4">
          {/* محتوى للطباعة */}
          <div className="print-content" style={{ display: 'none' }}>
            <div className="header">
              <h1>{report.title}</h1>
              <div className="meta">
                <p>التاريخ: {format(new Date(report.report_date), 'PPP', { locale: ar })}</p>
                <p>نوع التقرير: {report.report_type === 'daily' ? 'يومي' : report.report_type === 'weekly' ? 'أسبوعي' : 'شهري'}</p>
              </div>
            </div>

            {report.summary && (
              <div className="summary">
                <h3>محتوى التقرير</h3>
                <div className="ql-editor" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(report.summary) }} />
              </div>
            )}

            <div className="items">
              <h3>بنود التقرير</h3>
              {items.map((item, index) => (
                <div key={item.id} className="item">
                  <span className="item-number">{index + 1}</span>
                  <h4>{item.title}</h4>
                  {item.description && <p>{item.description}</p>}
                  {item.status && <p><strong>الحالة:</strong> {item.status}</p>}
                  {item.notes && <p><strong>ملاحظات:</strong> {item.notes}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* محتوى للعرض */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {format(new Date(report.report_date), 'PPP', { locale: ar })}
              </p>
              <p className="text-sm text-muted-foreground">
                نوع التقرير: {report.report_type === 'daily' ? 'يومي' : report.report_type === 'weekly' ? 'أسبوعي' : 'شهري'}
              </p>
            </div>
          </div>

          {report.summary && (
            <Card className="p-4 overflow-hidden">
              <h3 className="font-semibold mb-2">محتوى التقرير</h3>
              <div 
                className="text-sm ql-editor break-words overflow-hidden" 
                style={{
                  fontFamily: getFontFamily((report as any).font_family || 'system'),
                  fontWeight: getFontWeight((report as any).font_weight || '400')
                }}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(report.summary) }}
              />
            </Card>
          )}

          <div>
            <h3 className="font-semibold mb-3">بنود التقرير</h3>
            <div className="space-y-3">
              {items.map((item, index) => (
                <Card key={item.id} className="p-4 overflow-hidden">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <h4 className="font-medium mb-1 break-words">{item.title}</h4>
                      {item.description && (
                        <p className="text-sm text-muted-foreground mb-2 break-words">{item.description}</p>
                      )}
                      {item.status && (
                        <p className="text-sm break-words"><strong>الحالة:</strong> {item.status}</p>
                      )}
                      {item.notes && (
                        <p className="text-sm break-words"><strong>ملاحظات:</strong> {item.notes}</p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف التقرير</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا التقرير؟ سيتم حذف جميع البنود المرتبطة به. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}