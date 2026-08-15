import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
interface Task {
  id: string;
  title: string;
  description?: string;
  due_date: string;
  status: string;
  completion_notes?: string;
  created_at: string;
}

interface TaskPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTask: (task: Task) => void;
}

export function TaskPickerDialog({ open, onOpenChange, onSelectTask }: TaskPickerDialogProps) {
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks-picker'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as Task[];
    },
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>اختيار مهمة</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          {tasks.map((task) => (
            <Card key={task.id} className="p-3 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onSelectTask(task)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium">{task.title}</h4>
                  {task.description && (
                    <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={task.status === 'completed' ? 'default' : 'secondary'}>
                      {task.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(task.due_date), 'PP', { locale: ar })}
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}