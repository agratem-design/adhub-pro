import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Report } from '@/pages/Reports';
import { ReportItemsManager } from './ReportItemsManager';
import { RichTextEditor } from './RichTextEditor';
import { FontSelector, getFontFamily } from './FontSelector';
import { FontWeightSelector, getFontWeight } from './FontWeightSelector';

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: Report | null;
  reportType: 'daily' | 'weekly' | 'monthly';
  onSaved: () => void;
}

export function ReportDialog({ open, onOpenChange, report, reportType, onSaved }: ReportDialogProps) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [reportId, setReportId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFont, setSelectedFont] = useState('system');
  const [selectedFontWeight, setSelectedFontWeight] = useState('400');

  useEffect(() => {
    if (report) {
      setTitle(report.title);
      setSummary(report.summary || '');
      setReportId(report.id);
      setSelectedFont((report as any).font_family || 'system');
      setSelectedFontWeight((report as any).font_weight || '400');
    } else {
      setTitle('');
      setSummary('');
      setReportId(null);
      setSelectedFont('system');
      setSelectedFontWeight('400');
    }
  }, [report]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('يرجى إدخال عنوان التقرير');
      return;
    }

    setIsLoading(true);
    try {
      if (report?.id) {
        const { error } = await supabase
          .from('reports')
          .update({
            title,
            summary,
            font_family: selectedFont,
            font_weight: selectedFontWeight,
          })
          .eq('id', report.id);

        if (error) throw error;
        toast.success('تم تحديث التقرير بنجاح');
      } else {
        const { data, error } = await supabase
          .from('reports')
          .insert([{
            title,
            summary,
            report_type: reportType,
            report_date: report?.report_date || new Date().toISOString(),
            font_family: selectedFont,
            font_weight: selectedFontWeight,
          }])
          .select()
          .single();

        if (error) throw error;
        setReportId(data.id);
        toast.success('تم إنشاء التقرير بنجاح');
      }

      onSaved();
      if (!reportId) {
        onOpenChange(false);
      }
    } catch (error: any) {
      toast.error('فشل في حفظ التقرير: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{report?.id ? 'تعديل التقرير' : 'تقرير جديد'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>عنوان التقرير *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="أدخل عنوان التقرير"
            />
          </div>

          <div>
            <Label>محتوى التقرير</Label>
            <div style={{ 
              fontFamily: getFontFamily(selectedFont),
              fontWeight: getFontWeight(selectedFontWeight)
            }}>
              <RichTextEditor
                value={summary}
                onChange={setSummary}
                placeholder="اكتب محتوى التقرير مع التنسيق..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FontSelector value={selectedFont} onChange={setSelectedFont} />
            <FontWeightSelector value={selectedFontWeight} onChange={setSelectedFontWeight} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? 'جاري الحفظ...' : 'حفظ'}
            </Button>
          </div>

          {(reportId || report?.id) && (
            <div className="border-t pt-4 mt-4">
              <ReportItemsManager reportId={reportId || report!.id} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}