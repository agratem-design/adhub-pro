import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Calendar as CalendarIcon, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskDialog } from '@/components/tasks/TaskDialog';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface Task {
  id: string;
  title: string;
  description?: string;
  due_date: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  completion_notes?: string;
  completion_result?: 'completed' | 'not_completed';
  cancellation_reason?: string;
  completed_at?: string;
  created_at: string;
}

export default function Tasks() {
  const queryClient = useQueryClient();
  const { canEdit } = useAuth();
  const canEditSection = canEdit('tasks');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed' | 'cancelled'>('all');

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('due_date', { ascending: true });
      
      if (error) throw error;
      return data as Task[];
    },
  });

  const createTask = useMutation({
    mutationFn: async (task: any) => {
      const { data, error } = await supabase
        .from('tasks')
        .insert([task])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('تم إضافة المهمة بنجاح');
      setDialogOpen(false);
    },
    onError: (error) => {
      toast.error('فشل في إضافة المهمة: ' + error.message);
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Task> & { id: string }) => {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('تم تحديث المهمة بنجاح');
      setDialogOpen(false);
      setSelectedTask(null);
    },
    onError: (error) => {
      toast.error('فشل في تحديث المهمة: ' + error.message);
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('تم حذف المهمة بنجاح');
    },
    onError: (error) => {
      toast.error('فشل في حذف المهمة: ' + error.message);
    },
  });

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">المهمات اليومية</h1>
          <p className="text-muted-foreground">إدارة ومتابعة المهمات اليومية</p>
        </div>
        {canEditSection && (
          <Button onClick={() => {
            setSelectedTask(null);
            setDialogOpen(true);
          }} className="gap-2">
            <Plus className="h-4 w-4" />
            مهمة جديدة
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">الإجمالي</p>
              <p className="text-2xl font-bold">{tasks.length}</p>
            </div>
            <CalendarIcon className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">قيد الانتظار</p>
              <p className="text-2xl font-bold">{pendingCount}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">قيد التنفيذ</p>
              <p className="text-2xl font-bold">{inProgressCount}</p>
            </div>
            <Clock className="h-8 w-8 text-blue-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">مكتملة</p>
              <p className="text-2xl font-bold">{completedCount}</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">الكل ({tasks.length})</TabsTrigger>
            <TabsTrigger value="pending">قيد الانتظار ({pendingCount})</TabsTrigger>
            <TabsTrigger value="in_progress">قيد التنفيذ ({inProgressCount})</TabsTrigger>
            <TabsTrigger value="completed">مكتملة ({completedCount})</TabsTrigger>
            <TabsTrigger value="cancelled">ملغاة</TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="mt-6">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
            ) : filteredTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                لا توجد مهمات {filter !== 'all' ? `في حالة "${filter}"` : ''}
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={canEditSection ? () => {
                      setSelectedTask(task);
                      setDialogOpen(true);
                    } : undefined}
                    onDelete={canEditSection ? () => deleteTask.mutate(task.id) : undefined}
                    onUpdate={canEditSection ? (updates) => updateTask.mutate({ id: task.id, ...updates }) : undefined}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={selectedTask}
        onSave={(task) => {
          if (selectedTask) {
            updateTask.mutate({ id: selectedTask.id, ...task });
          } else {
            createTask.mutate(task);
          }
        }}
      />
    </div>
  );
}