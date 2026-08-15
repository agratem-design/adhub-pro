import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CompositeTaskWithDetails, UpdateCompositeTaskCostsInput } from '@/types/composite-task';
import { Wrench, Printer, Scissors } from 'lucide-react';

interface EditCompositeTaskCostsDialogProps {
  task: CompositeTaskWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: UpdateCompositeTaskCostsInput) => Promise<void>;
}

export const EditCompositeTaskCostsDialog: React.FC<EditCompositeTaskCostsDialogProps> = ({
  task,
  open,
  onOpenChange,
  onSave
}) => {
  const [installationCost, setInstallationCost] = useState(0);
  const [printCost, setPrintCost] = useState(0);
  const [cutoutCost, setCutoutCost] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setInstallationCost(task.installation_cost);
      setPrintCost(task.print_cost);
      setCutoutCost(task.cutout_cost);
      setNotes(task.notes || '');
    }
  }, [task]);

  const handleSave = async () => {
    if (!task) return;

    setSaving(true);
    try {
      await onSave({
        id: task.id,
        customer_installation_cost: installationCost,
        company_installation_cost: installationCost, // افتراضياً نفس القيمة
        customer_print_cost: printCost,
        company_print_cost: printCost,
        customer_cutout_cost: cutoutCost,
        company_cutout_cost: cutoutCost,
        notes: notes.trim() || undefined
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving costs:', error);
    } finally {
      setSaving(false);
    }
  };

  const totalCost = installationCost + printCost + cutoutCost;

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-6 gap-0">
        <DialogHeader className="pb-4 border-b border-border/40">
          <DialogTitle className="text-lg font-extrabold">تعديل تكاليف المهمة للزبون</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-5">
          {/* عنوان المهمة */}
          <div className="text-sm text-muted-foreground">
            <div className="font-medium">{task.customer_name}</div>
            <div>عقد #{task.contract_id}</div>
          </div>

          {/* تكلفة التركيب */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-orange-600" />
              تكلفة التركيب (د.ل)
            </Label>
            {task.task_type === 'reinstallation' ? (
              <>
                <Input
                  type="number"
                  value={installationCost}
                  onChange={(e) => setInstallationCost(Number(e.target.value) || 0)}
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-muted-foreground">
                  إعادة التركيب - التكلفة منفصلة
                </p>
              </>
            ) : (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <div className="text-sm text-blue-600 dark:text-blue-400">
                  التركيب الجديد شامل من العقد (لا يحتسب للزبون)
                </div>
              </div>
            )}
          </div>


          {/* تكلفة الطباعة */}
          {task.print_task_id && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Printer className="h-4 w-4 text-blue-600" />
                تكلفة الطباعة (د.ل)
              </Label>
              <Input
                type="number"
                value={printCost}
                onChange={(e) => setPrintCost(Number(e.target.value) || 0)}
                min="0"
                step="0.01"
              />
            </div>
          )}

          {/* تكلفة القص */}
          {task.cutout_task_id && (
            <div className="space-y-3 p-3 border border-purple-200 dark:border-purple-800 rounded-lg bg-purple-50/50 dark:bg-purple-950/20">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
                  <Scissors className="h-4 w-4" />
                  تكلفة القص
                </Label>
                <span className="text-xs text-muted-foreground">
                  {task.cutout_task?.items?.length || 0} عنصر
                </span>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">السعر للزبون (د.ل)</Label>
                  <Input
                    type="number"
                    value={cutoutCost}
                    onChange={(e) => setCutoutCost(Number(e.target.value) || 0)}
                    min="0"
                    step="0.01"
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          )}

          {/* الإجمالي */}
          <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
            <span className="font-semibold">الإجمالي:</span>
            <span className="text-xl font-bold text-primary">
              {totalCost.toLocaleString('ar-LY')} د.ل
            </span>
          </div>

          {/* ملاحظات */}
          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أضف ملاحظات إضافية..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            إلغاء
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
