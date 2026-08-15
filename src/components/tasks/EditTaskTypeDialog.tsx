import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Edit } from 'lucide-react';

interface EditTaskTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  currentTaskType: 'installation' | 'reinstallation';
  onSuccess: () => void;
}

export function EditTaskTypeDialog({
  open,
  onOpenChange,
  taskId,
  currentTaskType,
  onSuccess
}: EditTaskTypeDialogProps) {
  const [taskType, setTaskType] = useState<'installation' | 'reinstallation'>(currentTaskType);
  const [saving, setSaving] = useState(false);

  // مزامنة الحالة عند تغيير currentTaskType أو فتح الـ Dialog
  useEffect(() => {
    if (open) {
      setTaskType(currentTaskType);
    }
  }, [open, currentTaskType]);

  const handleSave = async () => {
    if (taskType === currentTaskType) {
      onOpenChange(false);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('installation_tasks')
        .update({ task_type: taskType })
        .eq('id', taskId);

      if (error) throw error;

      toast.success('تم تعديل نوع المهمة بنجاح');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating task type:', error);
      toast.error('فشل في تعديل نوع المهمة: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            تعديل نوع المهمة
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>نوع المهمة</Label>
            <Select 
              value={taskType} 
              onValueChange={(v: 'installation' | 'reinstallation') => setTaskType(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="installation">تركيب جديد</SelectItem>
                <SelectItem value="reinstallation">إعادة تركيب</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
