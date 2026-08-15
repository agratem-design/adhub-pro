import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, FileText, Calendar as CalendarIcon, StickyNote, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { TaskPickerDialog } from './TaskPickerDialog';
import { Badge } from '@/components/ui/badge';

export interface ReportItem {
  id: string;
  report_id: string;
  item_type: 'task' | 'event' | 'note';
  task_id?: string;
  title: string;
  description?: string;
  status?: string;
  notes?: string;
  order_index: number;
}

interface ReportItemsManagerProps {
  reportId: string;
}

export function ReportItemsManager({ reportId }: ReportItemsManagerProps) {
  const queryClient = useQueryClient();
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    item_type: 'note' as 'task' | 'event' | 'note',
    title: '',
    description: '',
    notes: '',
  });

  const { data: items = [] } = useQuery({
    queryKey: ['report-items', reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_items')
        .select('*')
        .eq('report_id', reportId)
        .order('order_index');
      
      if (error) throw error;
      return data as ReportItem[];
    },
  });

  const addItem = useMutation({
    mutationFn: async (item: any) => {
      const { data, error } = await supabase
        .from('report_items')
        .insert([{
          ...item,
          report_id: reportId,
          order_index: items.length,
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-items', reportId] });
      toast.success('تم إضافة البند بنجاح');
      setNewItem({ item_type: 'note', title: '', description: '', notes: '' });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('report_items')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-items', reportId] });
      toast.success('تم حذف البند');
    },
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'task': return <FileText className="h-5 w-5" />;
      case 'event': return <CalendarIcon className="h-5 w-5" />;
      case 'note': return <StickyNote className="h-5 w-5" />;
      default: return null;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'task': return 'مهمة';
      case 'event': return 'حدث';
      case 'note': return 'ملاحظة';
      default: return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'task': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'event': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'note': return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">بنود التقرير</h3>
          <p className="text-sm text-muted-foreground mt-1">
            أضف الأحداث والملاحظات والمهام المكتملة
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setTaskPickerOpen(true)}
          className="gap-2"
        >
          <FileText className="h-4 w-4" />
          استيراد من المهمات
        </Button>
      </div>

      {/* قائمة البنود الحالية */}
      {items.length > 0 && (
        <div className="space-y-3">
          <Label className="text-base">البنود المضافة ({items.length})</Label>
          <div className="grid gap-3">
            {items.map((item, index) => (
              <Card key={item.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  {/* رقم البند */}
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                      {index + 1}
                    </div>
                  </div>

                  {/* أيقونة ونوع البند */}
                  <div className={`p-2.5 rounded-lg ${getTypeColor(item.item_type)}`}>
                    {getIcon(item.item_type)}
                  </div>
                  
                  {/* محتوى البند */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {getTypeLabel(item.item_type)}
                      </Badge>
                      <h4 className="font-semibold text-lg">{item.title}</h4>
                    </div>
                    
                    {item.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {item.description}
                      </p>
                    )}
                    
                    {item.status && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">الحالة:</span>
                        <Badge variant="secondary">{item.status}</Badge>
                      </div>
                    )}
                    
                    {item.notes && (
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm"><strong>ملاحظات:</strong> {item.notes}</p>
                      </div>
                    )}
                  </div>
                  
                  {/* زر الحذف */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteItem.mutate(item.id)}
                    className="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* نموذج إضافة بند جديد */}
      <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-2 border-dashed">
        <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <Plus className="h-5 w-5" />
          إضافة بند جديد
        </h4>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* نوع البند */}
            <div>
              <Label className="text-base mb-2">نوع البند *</Label>
              <Select
                value={newItem.item_type}
                onValueChange={(v) => setNewItem({ ...newItem, item_type: v as any })}
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="event">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      حدث
                    </div>
                  </SelectItem>
                  <SelectItem value="note">
                    <div className="flex items-center gap-2">
                      <StickyNote className="h-4 w-4" />
                      ملاحظة
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* العنوان */}
            <div>
              <Label className="text-base mb-2">العنوان *</Label>
              <Input
                value={newItem.title}
                onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                placeholder="عنوان البند"
                className="h-12"
              />
            </div>
          </div>

          {/* التفاصيل */}
          <div>
            <Label className="text-base mb-2">التفاصيل</Label>
            <Textarea
              value={newItem.description}
              onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
              placeholder="اكتب تفاصيل البند هنا..."
              rows={4}
              className="resize-none"
            />
          </div>

          {/* زر الإضافة */}
          <Button
            onClick={() => addItem.mutate(newItem)}
            disabled={!newItem.title.trim()}
            className="w-full h-12 text-base"
            size="lg"
          >
            <Plus className="h-5 w-5 ml-2" />
            إضافة البند إلى التقرير
          </Button>
        </div>
      </Card>

      {/* نافذة اختيار المهمات */}
      <TaskPickerDialog
        open={taskPickerOpen}
        onOpenChange={setTaskPickerOpen}
        onSelectTask={(task) => {
          addItem.mutate({
            item_type: 'task',
            task_id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            notes: task.completion_notes,
          });
          setTaskPickerOpen(false);
        }}
      />
    </div>
  );
}
