import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EditReplacementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: any;
  allItems: any[];
  onSaved: () => void;
}

const REASONS = [
  'عيب تصنيع',
  'طلب الزبون',
  'تلف بسبب الطقس',
  'حادث',
  'إزالة من العقد بعد التركيب',
  'استبدال من العقد',
  'أخرى',
];

export function EditReplacementDialog({ open, onOpenChange, item, allItems, onSaved }: EditReplacementDialogProps) {
  const isCustomReason = item.replacement_reason && !REASONS.includes(item.replacement_reason);
  const [status, setStatus] = useState(item.replacement_status || 'replaced');
  const [reason, setReason] = useState(isCustomReason ? 'أخرى' : (item.replacement_reason || ''));
  const [customReason, setCustomReason] = useState(isCustomReason ? item.replacement_reason : '');
  const [costBearer, setCostBearer] = useState(item.replacement_cost_bearer || 'company');
  const [costPercentage, setCostPercentage] = useState(item.replacement_cost_percentage || 50);
  const [linkedItemId, setLinkedItemId] = useState(
    item.replacement_status === 'replaced' ? (item.replaced_by_item_id || '') :
    item.replacement_status === 'replacement' ? (item.replaces_item_id || '') : ''
  );
  const [saving, setSaving] = useState(false);

  // اللوحات الأخرى في نفس المهمة (للربط)
  const otherItems = allItems.filter(i => i.id !== item.id);

  const handleSave = async () => {
    setSaving(true);
    try {
      const finalReason = reason === 'أخرى' ? customReason : reason;
      const updates: any = {
        replacement_status: status,
        replacement_reason: finalReason,
        replacement_cost_bearer: costBearer,
        replacement_cost_percentage: costBearer === 'split' ? costPercentage : null,
      };

      // إذا تغيرت الحالة، نحتاج تنظيف الروابط القديمة
      if (status !== item.replacement_status) {
        // إزالة الروابط القديمة
        if (item.replaced_by_item_id) {
          await supabase.from('installation_task_items').update({
            replaces_item_id: null, replacement_status: null, replacement_reason: null,
            replacement_cost_bearer: null, replacement_cost_percentage: null,
          } as any).eq('id', item.replaced_by_item_id);
        }
        if (item.replaces_item_id) {
          await supabase.from('installation_task_items').update({
            replaced_by_item_id: null,
          } as any).eq('id', item.replaces_item_id);
        }
        updates.replaced_by_item_id = null;
        updates.replaces_item_id = null;
        updates.reinstall_count = status === 'reinstalled' ? (item.reinstall_count || 1) : item.reinstall_count;
      }

      // تحديث الربط (فقط إذا لم تتغير الحالة)
      if (status === item.replacement_status && status === 'replaced') {
        // إزالة الربط القديم
        if (item.replaced_by_item_id && item.replaced_by_item_id !== linkedItemId) {
          await supabase.from('installation_task_items').update({
            replaces_item_id: null,
            replacement_status: null,
            replacement_reason: null,
            replacement_cost_bearer: null,
          } as any).eq('id', item.replaced_by_item_id);
        }
        updates.replaced_by_item_id = linkedItemId === '__none__' ? null : linkedItemId || null;
        // ربط اللوحة البديلة الجديدة
        if (linkedItemId && linkedItemId !== '__none__') {
          await supabase.from('installation_task_items').update({
            replaces_item_id: item.id,
            replacement_status: 'replacement',
            replacement_reason: reason,
            replacement_cost_bearer: costBearer,
            replacement_cost_percentage: costBearer === 'split' ? costPercentage : null,
          } as any).eq('id', linkedItemId);
        }
      } else if (status === item.replacement_status && status === 'replacement') {
        // إزالة الربط القديم
        if (item.replaces_item_id && item.replaces_item_id !== linkedItemId) {
          await supabase.from('installation_task_items').update({
            replaced_by_item_id: null,
          } as any).eq('id', item.replaces_item_id);
        }
        updates.replaces_item_id = linkedItemId === '__none__' ? null : linkedItemId || null;
        // ربط اللوحة الأصلية الجديدة
        if (linkedItemId && linkedItemId !== '__none__') {
          await supabase.from('installation_task_items').update({
            replaced_by_item_id: item.id,
            replacement_status: 'replaced',
          } as any).eq('id', linkedItemId);
        }
      }

      await supabase.from('installation_task_items').update(updates).eq('id', item.id);
      toast.success('تم تحديث بيانات الاستبدال');
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>تعديل بيانات الاستبدال - لوحة #{item.billboard_id}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* حالة اللوحة */}
          <div className="space-y-1.5">
            <Label>حالة اللوحة</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="replaced">مستبدلة</SelectItem>
                <SelectItem value="replacement">لوحة بديلة</SelectItem>
                <SelectItem value="reinstalled">إعادة تركيب</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* السبب */}
          <div className="space-y-1.5">
            <Label>سبب الاستبدال</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder="اختر السبب" /></SelectTrigger>
              <SelectContent>
                {REASONS.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {reason === 'أخرى' && (
              <Input
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="اكتب السبب..."
                className="mt-2"
              />
            )}
          </div>

          {/* تحمل التكلفة */}
          <div className="space-y-1.5">
            <Label>تحمل التكلفة</Label>
            <Select value={costBearer} onValueChange={setCostBearer}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="company">الشركة</SelectItem>
                <SelectItem value="customer">الزبون</SelectItem>
                <SelectItem value="split">نسبة مخصصة</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {costBearer === 'split' && (
            <div className="space-y-1.5">
              <Label>نسبة الزبون (%)</Label>
              <Input
                type="number"
                min={0} max={100}
                value={costPercentage}
                onChange={e => setCostPercentage(Number(e.target.value))}
              />
            </div>
          )}

          {/* ربط اللوحة - فقط للحالات التي تحتاج ربط */}
          {(status === 'replaced' || status === 'replacement') && (
          <div className="space-y-1.5">
            <Label>
              {status === 'replaced' ? 'اللوحة البديلة' : 'بديلة عن لوحة'}
            </Label>
            <Select value={linkedItemId} onValueChange={setLinkedItemId}>
              <SelectTrigger><SelectValue placeholder="اختر اللوحة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">بدون ربط</SelectItem>
                {otherItems.map(i => (
                  <SelectItem key={i.id} value={i.id}>
                    لوحة #{i.billboard_id}
                    {i.replacement_status ? ` (${i.replacement_status === 'replaced' ? 'مستبدلة' : i.replacement_status === 'replacement' ? 'بديلة' : ''})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
