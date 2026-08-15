import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface CutoutItem {
  id: string;
  description: string;
  quantity: number;
  unit_cost: number;
  cutout_image_url: string;
}

interface CreateManualCutoutTaskProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateManualCutoutTask({ open, onOpenChange, onSuccess }: CreateManualCutoutTaskProps) {
  const [customerName, setCustomerName] = useState('');
  const [printerId, setPrinterId] = useState('');
  const [unitCost, setUnitCost] = useState(50);
  const [priority, setPriority] = useState('normal');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<CutoutItem[]>([]);
  const [loading, setLoading] = useState(false);

  const { data: printers = [] } = useQuery({
    queryKey: ['printers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('printers')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    }
  });

  const addItem = () => {
    setItems([...items, {
      id: `temp_${Date.now()}`,
      description: '',
      quantity: 1,
      unit_cost: unitCost,
      cutout_image_url: ''
    }]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof CutoutItem, value: any) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleSubmit = async () => {
    if (!customerName.trim()) {
      toast.error('الرجاء إدخال اسم العميل');
      return;
    }

    if (items.length === 0) {
      toast.error('الرجاء إضافة عنصر واحد على الأقل');
      return;
    }

    setLoading(true);
    try {
      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
      const totalCost = items.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);

      // Create cutout task
      const { data: task, error: taskError } = await supabase
        .from('cutout_tasks')
        .insert({
          customer_name: customerName,
          printer_id: printerId || null,
          total_quantity: totalQuantity,
          unit_cost: unitCost,
          total_cost: totalCost,
          priority,
          notes,
          status: 'pending'
        })
        .select()
        .single();

      if (taskError) throw taskError;

      // Create task items
      const taskItems = items.map(item => ({
        task_id: task.id,
        description: item.description,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        total_cost: item.quantity * item.unit_cost,
        cutout_image_url: item.cutout_image_url || null,
        status: 'pending'
      }));

      const { error: itemsError } = await supabase
        .from('cutout_task_items')
        .insert(taskItems);

      if (itemsError) throw itemsError;

      toast.success('تم إنشاء مهمة المجسمات بنجاح');
      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setCustomerName('');
      setPrinterId('');
      setUnitCost(50);
      setPriority('normal');
      setNotes('');
      setItems([]);
    } catch (error) {
      console.error('Error creating cutout task:', error);
      toast.error('فشل في إنشاء المهمة');
    } finally {
      setLoading(false);
    }
  };

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalCost = items.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إنشاء مهمة مجسمات يدوية</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="customerName">اسم العميل *</Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="أدخل اسم العميل"
              />
            </div>

            <div>
              <Label htmlFor="printer">المطبعة</Label>
              <Select value={printerId} onValueChange={setPrinterId}>
                <SelectTrigger id="printer">
                  <SelectValue placeholder="اختر المطبعة" />
                </SelectTrigger>
                <SelectContent>
                  {printers.map((printer) => (
                    <SelectItem key={printer.id} value={printer.id}>
                      {printer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="unitCost">سعر الوحدة (د.ل)</Label>
              <Input
                id="unitCost"
                type="number"
                value={unitCost}
                onChange={(e) => setUnitCost(Number(e.target.value))}
                min="0"
                step="0.1"
              />
            </div>

            <div>
              <Label htmlFor="priority">الأولوية</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">منخفض</SelectItem>
                  <SelectItem value="normal">عادي</SelectItem>
                  <SelectItem value="high">عالي</SelectItem>
                  <SelectItem value="urgent">عاجل</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label>العناصر</Label>
              <Button type="button" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 ml-1" />
                إضافة عنصر
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={item.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">عنصر {index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label>الوصف</Label>
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        placeholder="وصف العنصر"
                      />
                    </div>

                    <div>
                      <Label>الكمية</Label>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))}
                        min="1"
                      />
                    </div>

                    <div>
                      <Label>سعر الوحدة</Label>
                      <Input
                        type="number"
                        value={item.unit_cost}
                        onChange={(e) => updateItem(item.id, 'unit_cost', Number(e.target.value))}
                        min="0"
                        step="0.1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>رابط صورة المجسم</Label>
                    <Input
                      value={item.cutout_image_url}
                      onChange={(e) => updateItem(item.id, 'cutout_image_url', e.target.value)}
                      placeholder="https://..."
                    />
                  </div>

                  <div className="text-sm text-muted-foreground">
                    الإجمالي: {(item.quantity * item.unit_cost).toFixed(2)} د.ل
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">ملاحظات</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات إضافية..."
              rows={3}
            />
          </div>

          {/* Summary */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span>إجمالي الكمية:</span>
              <span className="font-bold">{totalQuantity} قطعة</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>التكلفة الإجمالية:</span>
              <span>{totalCost.toFixed(2)} د.ل</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              إلغاء
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'جاري الحفظ...' : 'حفظ المهمة'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
