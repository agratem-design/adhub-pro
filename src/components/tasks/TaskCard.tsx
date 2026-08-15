import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, CheckCircle2, XCircle, Clock, PlayCircle } from 'lucide-react';
import { format, formatDistanceToNow, differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { Task } from '@/pages/Tasks';
import { TaskCompletionDialog } from './TaskCompletionDialog';

interface TaskCardProps {
  task: Task;
  onEdit: () => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<Task>) => void;
}

export function TaskCard({ task, onEdit, onDelete, onUpdate }: TaskCardProps) {
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  
  const dueDate = new Date(task.due_date);
  const now = new Date();
  const isOverdue = dueDate < now && task.status !== 'completed' && task.status !== 'cancelled';
  
  // حساب الوقت المتبقي أو المتأخر
  const getTimeRemaining = () => {
    const days = differenceInDays(dueDate, now);
    const hours = differenceInHours(dueDate, now) % 24;
    const minutes = differenceInMinutes(dueDate, now) % 60;
    
    if (isOverdue) {
      const overdueDays = Math.abs(days);
      return `متأخر ${overdueDays} ${overdueDays === 1 ? 'يوم' : 'أيام'}`;
    }
    
    if (days > 0) {
      return `باقي ${days} ${days === 1 ? 'يوم' : 'أيام'}`;
    } else if (hours > 0) {
      return `باقي ${hours} ${hours === 1 ? 'ساعة' : 'ساعات'}`;
    } else if (minutes > 0) {
      return `باقي ${minutes} ${minutes === 1 ? 'دقيقة' : 'دقائق'}`;
    } else {
      return 'الآن';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return 'عالية';
      case 'medium': return 'متوسطة';
      case 'low': return 'منخفضة';
      default: return priority;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'in_progress': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'cancelled': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'قيد الانتظار';
      case 'in_progress': return 'قيد التنفيذ';
      case 'completed': return 'مكتملة';
      case 'cancelled': return 'ملغاة';
      default: return status;
    }
  };

  return (
    <>
      <Card className={`p-4 ${isOverdue ? 'border-red-500 border-2' : ''}`}>
        <div className="flex items-start gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{task.title}</h3>
                {task.description && (
                  <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Badge className={getPriorityColor(task.priority)}>
                  {getPriorityLabel(task.priority)}
                </Badge>
                <Badge className={getStatusColor(task.status)}>
                  {getStatusLabel(task.status)}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm flex-wrap">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>الموعد: {format(dueDate, 'PPP', { locale: ar })}</span>
              </div>
              <Badge 
                variant={isOverdue ? 'destructive' : 'default'}
                className={isOverdue ? '' : 'bg-blue-500'}
              >
                {getTimeRemaining()}
              </Badge>
            </div>

            {task.completion_notes && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">ملاحظات الإنجاز:</p>
                <p className="text-sm text-muted-foreground mt-1">{task.completion_notes}</p>
              </div>
            )}

            {task.cancellation_reason && (
              <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                <p className="text-sm font-medium text-red-600 dark:text-red-400">سبب الإلغاء:</p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{task.cancellation_reason}</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {task.status === 'pending' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onUpdate({ status: 'in_progress' })}
                className="gap-1"
              >
                <PlayCircle className="h-4 w-4" />
                بدء التنفيذ
              </Button>
            )}
            {task.status === 'in_progress' && (
              <Button
                size="sm"
                variant="default"
                onClick={() => setCompletionDialogOpen(true)}
                className="gap-1"
              >
                <CheckCircle2 className="h-4 w-4" />
                إتمام
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDelete}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <TaskCompletionDialog
        open={completionDialogOpen}
        onOpenChange={setCompletionDialogOpen}
        selectedCount={1}
        onComplete={(result, notes, reason) => {
          onUpdate({
            status: result === 'completed' ? 'completed' : 'cancelled',
            completion_result: result,
            completion_notes: notes,
            cancellation_reason: reason,
            completed_at: new Date().toISOString(),
          });
          setCompletionDialogOpen(false);
        }}
      />
    </>
  );
}