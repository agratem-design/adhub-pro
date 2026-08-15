import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Plus, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { ar } from 'date-fns/locale';

interface BillboardExtendRentalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billboard: {
    ID: number;
    Billboard_Name?: string;
    Rent_End_Date?: string;
    Contract_Number?: number;
  };
  onSuccess?: () => void;
}

const EXTENSION_TYPES = [
  { value: 'public_event', label: 'مناسبة عامة' },
  { value: 'installation_delay', label: 'تأخير في التركيب' },
  { value: 'manual', label: 'تمديد يدوي' },
];

export function BillboardExtendRentalDialog({
  open,
  onOpenChange,
  billboard,
  onSuccess
}: BillboardExtendRentalDialogProps) {
  const [extensionDays, setExtensionDays] = useState<number>(7);
  const [reason, setReason] = useState('');
  const [extensionType, setExtensionType] = useState<string>('manual');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const currentEndDate = billboard.Rent_End_Date ? new Date(billboard.Rent_End_Date) : new Date();
  const newEndDate = addDays(currentEndDate, extensionDays);

  const handleSave = async () => {
    if (!reason.trim()) {
      toast.error('الرجاء إدخال سبب التمديد');
      return;
    }

    if (extensionDays <= 0) {
      toast.error('الرجاء إدخال عدد أيام صحيح');
      return;
    }

    setSaving(true);
    try {
      // 1. حفظ سجل التمديد
      const { error: extensionError } = await supabase
        .from('billboard_extensions')
        .insert({
          billboard_id: billboard.ID,
          contract_number: billboard.Contract_Number || null,
          extension_days: extensionDays,
          reason: reason.trim(),
          extension_type: extensionType,
          old_end_date: billboard.Rent_End_Date,
          new_end_date: format(newEndDate, 'yyyy-MM-dd'),
          notes: notes.trim() || null
        });

      if (extensionError) throw extensionError;

      // 2. تحديث تاريخ انتهاء اللوحة
      const { error: updateError } = await supabase
        .from('billboards')
        .update({ Rent_End_Date: format(newEndDate, 'yyyy-MM-dd') })
        .eq('ID', billboard.ID);

      if (updateError) throw updateError;

      toast.success(`تم تمديد الإيجار بـ ${extensionDays} يوم`);
      onOpenChange(false);
      onSuccess?.();
      
      // إعادة تعيين النموذج
      setExtensionDays(7);
      setReason('');
      setExtensionType('manual');
      setNotes('');
    } catch (error: any) {
      console.error('Error extending rental:', error);
      toast.error('فشل في تمديد الإيجار: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            تمديد إيجار اللوحة
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* معلومات اللوحة */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">اللوحة:</span>
              <span className="font-semibold">{billboard.Billboard_Name || `#${billboard.ID}`}</span>
            </div>
            {billboard.Contract_Number && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">رقم العقد:</span>
                <span className="font-semibold">#{billboard.Contract_Number}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">تاريخ الانتهاء الحالي:</span>
              <span className="font-semibold text-destructive">
                {billboard.Rent_End_Date 
                  ? format(new Date(billboard.Rent_End_Date), 'dd/MM/yyyy', { locale: ar })
                  : 'غير محدد'}
              </span>
            </div>
          </div>

          {/* نوع التمديد */}
          <div className="space-y-2">
            <Label>نوع التمديد</Label>
            <Select value={extensionType} onValueChange={setExtensionType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXTENSION_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* عدد الأيام */}
          <div className="space-y-2">
            <Label>عدد أيام التمديد</Label>
            <Input
              type="number"
              min={1}
              value={extensionDays}
              onChange={(e) => setExtensionDays(parseInt(e.target.value) || 0)}
              placeholder="أدخل عدد الأيام"
            />
          </div>

          {/* سبب التمديد */}
          <div className="space-y-2">
            <Label>سبب التمديد <span className="text-destructive">*</span></Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: مناسبة العيد الوطني..."
              rows={2}
            />
          </div>

          {/* ملاحظات إضافية */}
          <div className="space-y-2">
            <Label>ملاحظات إضافية (اختياري)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي ملاحظات إضافية..."
              rows={2}
            />
          </div>

          {/* معاينة التاريخ الجديد */}
          <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <Calendar className="h-4 w-4" />
              <span className="text-sm font-medium">تاريخ الانتهاء الجديد:</span>
              <span className="font-bold">
                {format(newEndDate, 'dd/MM/yyyy', { locale: ar })}
              </span>
            </div>
          </div>

          {/* تحذير */}
          <div className="flex items-start gap-2 text-sm text-muted-foreground bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <span>سيتم تمديد تاريخ انتهاء اللوحة فقط. لن يتم تعديل تاريخ انتهاء العقد.</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            إلغاء
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'جاري الحفظ...' : 'تأكيد التمديد'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
