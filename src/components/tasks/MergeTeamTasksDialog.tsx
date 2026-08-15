import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Merge, Users } from 'lucide-react';

interface TaskToMerge {
  id: string;
  contract_id: number;
  contract_name: string;
  customer_name: string;
  billboard_count: number;
  task_type?: string;
  ad_type?: string;
}

interface ContractInfo {
  contract_id: number;
  ad_type: string;
  customer_name: string;
}

interface MergeTeamTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  teamName: string;
  customerId: string;
  tasks: TaskToMerge[];
  onSuccess: () => void;
}

export function MergeTeamTasksDialog({
  open,
  onOpenChange,
  teamId,
  teamName,
  customerId,
  tasks,
  onSuccess
}: MergeTeamTasksDialogProps) {
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);

  const handleToggleTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const isReinstallation = task.task_type === 'reinstallation';
    
    // Check if any currently selected task has a different type
    const hasDifferentType = selectedTasks.some(selectedId => {
      const selectedTask = tasks.find(t => t.id === selectedId);
      const isSelectedReinstallation = selectedTask?.task_type === 'reinstallation';
      return isSelectedReinstallation !== isReinstallation;
    });

    if (hasDifferentType && !selectedTasks.includes(taskId)) {
      toast.error('لا يمكن دمج مهام التركيب الجديد مع مهام إعادة التركيب. يرجى اختيار مهام من نفس النوع.');
      return;
    }

    setSelectedTasks(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleMerge = async () => {
    if (selectedTasks.length < 2) {
      toast.error('يجب اختيار مهمتين على الأقل للدمج');
      return;
    }

    setMerging(true);
    try {
      // 1. جلب جميع البنود من المهام المختارة
      const { data: items, error: itemsError } = await supabase
        .from('installation_task_items')
        .select('*')
        .in('task_id', selectedTasks);

      if (itemsError) throw itemsError;

      if (!items || items.length === 0) {
        toast.error('لا توجد لوحات في المهام المحددة');
        return;
      }

      // 2. حذف البنود من المهام القديمة أولاً
      const { error: deleteItemsError } = await supabase
        .from('installation_task_items')
        .delete()
        .in('task_id', selectedTasks);

      if (deleteItemsError) throw deleteItemsError;

      // 3. حذف المهام القديمة
      const { error: deleteTasksError } = await supabase
        .from('installation_tasks')
        .delete()
        .in('id', selectedTasks);

      if (deleteTasksError) throw deleteTasksError;

      // 4. إنشاء مهمة جديدة مدمجة
      const selectedTasksData = tasks.filter(t => selectedTasks.includes(t.id));
      const firstTask = selectedTasksData[0];
      const contractIds = selectedTasksData.map(t => t.contract_id);
      const uniqueContractIds = [...new Set(contractIds)];
      
      // تحديد نوع المهمة - إذا كانت أي مهمة إعادة تركيب، تكون المهمة المدمجة إعادة تركيب
      const hasReinstallation = selectedTasksData.some(t => t.task_type === 'reinstallation');
      
      const taskName = hasReinstallation
        ? `إعادة تركيب مجمعة (عقود: ${uniqueContractIds.join('، ')})`
        : `تركيب مجمعة (عقود: ${uniqueContractIds.join('، ')})`;

      const { data: newTask, error: taskError } = await supabase
        .from('installation_tasks')
        .insert({
          contract_id: firstTask?.contract_id,
          team_id: teamId,
          status: 'pending',
          contract_ids: contractIds,
          task_type: hasReinstallation ? 'reinstallation' : 'installation',
          task_name: taskName
        })
        .select()
        .single();

      if (taskError) throw taskError;

      // 5. إضافة البنود إلى المهمة الجديدة
      const updates = items.map(item => {
        const { id, created_at, ...itemWithoutId } = item;
        return {
          ...itemWithoutId,
          task_id: newTask.id
        };
      });

      const { error: insertError } = await supabase
        .from('installation_task_items')
        .insert(updates);

      if (insertError) throw insertError;

      // تحديث اسم المهمة المجمعة التلقائية في جدول composite_tasks لتطابق الاسم الجديد
      await supabase
        .from('composite_tasks')
        .update({ task_name: taskName })
        .eq('installation_task_id', newTask.id);

      toast.success(`تم دمج ${selectedTasks.length} مهمة بنجاح (${items.length} لوحة)`);
      onSuccess();
      onOpenChange(false);
      setSelectedTasks([]);
    } catch (error: any) {
      console.error('Error merging tasks:', error);
      toast.error('فشل في دمج المهام: ' + error.message);
    } finally {
      setMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" />
            دمج مهام التركيب
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-primary" />
              <span className="font-semibold">الفريق:</span>
              <span>{teamName}</span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              اختر المهام التي تريد دمجها (يجب اختيار مهمتين على الأقل)
            </div>
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {tasks.map(task => {
              const isSelected = selectedTasks.includes(task.id);
              const isReinstallation = task.task_type === 'reinstallation';
              
              // Determine if this task is disabled based on current selection
              let isDisabled = false;
              if (selectedTasks.length > 0) {
                const firstSelectedId = selectedTasks[0];
                const firstSelectedTask = tasks.find(t => t.id === firstSelectedId);
                const isFirstReinstallation = firstSelectedTask?.task_type === 'reinstallation';
                isDisabled = isFirstReinstallation !== isReinstallation;
              }

              return (
                <Card
                  key={task.id}
                  className={`transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/5 cursor-pointer'
                      : isDisabled
                      ? 'opacity-50 cursor-not-allowed bg-muted/20'
                      : 'hover:bg-muted/50 cursor-pointer'
                  }`}
                  onClick={() => !isDisabled && handleToggleTask(task.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <Checkbox
                          checked={isSelected}
                          disabled={isDisabled}
                          onCheckedChange={() => !isDisabled && handleToggleTask(task.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">#{task.contract_id}</Badge>
                          <span className="font-semibold">{task.customer_name}</span>
                          {task.task_type === 'reinstallation' && (
                            <Badge className="bg-orange-500 text-xs">إعادة تركيب</Badge>
                          )}
                          {task.ad_type && (
                            <Badge variant="secondary" className="text-xs">{task.ad_type}</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {task.billboard_count} لوحة
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

          {selectedTasks.length > 0 && (
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-sm">
                <span className="text-muted-foreground">المهام المحددة:</span>
                <span className="font-bold mr-2">{selectedTasks.length} مهمة</span>
              </div>
              <div className="text-sm text-muted-foreground">
                إجمالي اللوحات:{' '}
                {tasks
                  .filter(t => selectedTasks.includes(t.id))
                  .reduce((sum, t) => sum + t.billboard_count, 0)}{' '}
                لوحة
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={merging}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleMerge}
              disabled={selectedTasks.length < 2 || merging}
            >
              {merging ? 'جاري الدمج...' : `دمج ${selectedTasks.length} مهمة`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
