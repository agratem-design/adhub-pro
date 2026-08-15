import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, Save, Palette } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSystemDialog } from '@/contexts/SystemDialogContext';

interface MStatus {
  id: string;
  name: string;
  label: string;
  color: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

const slugify = (s: string) => s.trim().replace(/\s+/g, '_').toLowerCase() || `status_${Date.now()}`;

export function ManageMaintenanceStatusesDialog({ open, onOpenChange, onChanged }: Props) {
  const { confirm } = useSystemDialog();
  const [items, setItems] = useState<MStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('#6b7280');
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('maintenance_statuses')
      .select('*')
      .order('created_at');
    if (error) {
      toast.error('فشل تحميل حالات الصيانة');
    } else {
      setItems((data as any) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const notify = () => {
    onChanged?.();
    try {
      window.dispatchEvent(new CustomEvent('maintenance-statuses-changed'));
    } catch {}
  };

  const update = (id: string, patch: Partial<MStatus>) => {
    setItems(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
  };

  const saveRow = async (s: MStatus) => {
    setSavingIds(prev => new Set(prev).add(s.id));
    const { error } = await supabase
      .from('maintenance_statuses')
      .update({ label: s.label, color: s.color })
      .eq('id', s.id);
    setSavingIds(prev => {
      const n = new Set(prev);
      n.delete(s.id);
      return n;
    });
    if (error) {
      toast.error('فشل حفظ التعديل');
    } else {
      toast.success('تم الحفظ');
      notify();
    }
  };

  const deleteRow = async (s: MStatus) => {
    const ok = await confirm({
      title: 'حذف الحالة',
      message: `هل تريد حذف الحالة "${s.label}"؟ لن يؤثر هذا على القيم المخزّنة في اللوحات.`,
      confirmText: 'حذف',
    });
    if (!ok) return;
    const { error } = await supabase.from('maintenance_statuses').delete().eq('id', s.id);
    if (error) {
      toast.error('فشل الحذف');
    } else {
      toast.success('تم الحذف');
      await load();
      notify();
    }
  };

  const addNew = async () => {
    const label = newLabel.trim();
    if (!label) {
      toast.error('أدخل اسم الحالة');
      return;
    }
    const name = slugify(label);
    if (items.some(i => i.name === name || i.label === label)) {
      toast.error('هذه الحالة موجودة مسبقاً');
      return;
    }
    const { error } = await supabase
      .from('maintenance_statuses')
      .insert({ name, label, color: newColor });
    if (error) {
      toast.error('فشل إضافة الحالة');
    } else {
      toast.success('تمت الإضافة');
      setNewLabel('');
      setNewColor('#6b7280');
      await load();
      notify();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            إدارة حالات الصيانة
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* إضافة حالة جديدة */}
          <div className="p-3 border rounded-lg bg-muted/40 space-y-2">
            <Label className="text-sm font-semibold">إضافة حالة جديدة</Label>
            <div className="flex items-end gap-2 flex-wrap">
              <div className="flex-1 min-w-[180px]">
                <Label className="text-xs">اسم الحالة</Label>
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="مثال: تحتاج تنظيف"
                />
              </div>
              <div>
                <Label className="text-xs">اللون</Label>
                <Input
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="h-10 w-20 p-1"
                />
              </div>
              <Button onClick={addNew} className="gap-1">
                <Plus className="h-4 w-4" />
                إضافة
              </Button>
            </div>
          </div>

          {/* قائمة الحالات */}
          <div className="space-y-2">
            {loading ? (
              <div className="text-center text-muted-foreground py-6">جاري التحميل...</div>
            ) : items.length === 0 ? (
              <div className="text-center text-muted-foreground py-6">لا توجد حالات. أضف الحالة الأولى من الأعلى.</div>
            ) : (
              items.map((s) => (
                <div key={s.id} className="flex items-center gap-2 p-2 border rounded-lg">
                  <span
                    className="inline-block w-4 h-4 rounded-full border"
                    style={{ backgroundColor: s.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <Input
                      value={s.label}
                      onChange={(e) => update(s.id, { label: e.target.value })}
                      className="h-9"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">المعرّف: {s.name}</p>
                  </div>
                  <Input
                    type="color"
                    value={s.color}
                    onChange={(e) => update(s.id, { color: e.target.value })}
                    className="h-9 w-14 p-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => saveRow(s)}
                    disabled={savingIds.has(s.id)}
                    className="gap-1"
                  >
                    <Save className="h-3.5 w-3.5" />
                    حفظ
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteRow(s)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
