import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { CustomDatePicker } from '@/components/ui/custom-date-picker';

interface TaskCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (result: 'completed' | 'not_completed', notes: string, reason?: string, installationDate?: string) => void;
  selectedCount: number;
}

export function TaskCompletionDialog({ open, onOpenChange, onComplete, selectedCount }: TaskCompletionDialogProps) {
  const [result, setResult] = useState<'completed' | 'not_completed'>('completed');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [installationDate, setInstallationDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSubmit = () => {
    onComplete(result, notes, result === 'not_completed' ? reason : undefined, installationDate || undefined);
    setResult('completed');
    setNotes('');
    setReason('');
    setInstallationDate('');
  };

  if (!open) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-md w-full animate-in slide-in-from-bottom-5">
      <Card className="shadow-2xl border-2 border-primary/20">
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <span>إتمام المهمة</span>
            <span className="text-sm font-normal text-muted-foreground">
              ({selectedCount} لوحة محددة)
            </span>
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          <div>
            <Label>حالة الإنجاز</Label>
            <RadioGroup value={result} onValueChange={(v) => setResult(v as any)} className="mt-2">
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="completed" id="completed" />
                <Label htmlFor="completed" className="cursor-pointer">تم الإنجاز</Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="not_completed" id="not_completed" />
                <Label htmlFor="not_completed" className="cursor-pointer">لم يتم الإنجاز</Label>
              </div>
            </RadioGroup>
          </div>

          {result === 'completed' && (
            <div>
              <Label htmlFor="installation-date" className="flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                تاريخ التركيب
              </Label>
              <CustomDatePicker
                value={installationDate || new Date().toISOString().split('T')[0]}
                onChange={(val) => setInstallationDate(val)}
                placeholder="اختر تاريخ التركيب"
                className="mt-1.5"
              />
            </div>
          )}

          <div>
            <Label>ملاحظات الإنجاز</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="اكتب ما حصل في المهمة..."
              rows={3}
              className="mt-1.5"
            />
          </div>

          {result === 'not_completed' && (
            <div>
              <Label>سبب عدم الإنجاز *</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="اذكر السبب..."
                rows={2}
                className="mt-1.5"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSubmit}>
              حفظ ({selectedCount})
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}