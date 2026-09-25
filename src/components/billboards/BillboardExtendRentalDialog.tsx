import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Plus, AlertCircle, Clock3, FileText, ArrowLeft, Check } from 'lucide-react';
import { extendBillboardRental } from '@/services/billboardRentalService';
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

    if (!Number.isInteger(extensionDays) || extensionDays <= 0 || !billboard.Contract_Number || !billboard.Rent_End_Date) {
      toast.error('الرجاء إدخال عدد أيام صحيح');
      return;
    }

    setSaving(true);
    try {
      await extendBillboardRental(billboard.ID, billboard.Contract_Number!, extensionDays,
        reason.trim(), extensionType, notes.trim(), billboard.Rent_End_Date!);

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

  const formatDate = (value: Date) => format(value, 'dd MMMM yyyy', { locale: ar });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden border-border/80 p-0 shadow-2xl" dir="rtl">
        <div className="h-1.5 bg-gradient-to-l from-primary via-amber-400 to-primary/40" />
        <DialogHeader className="border-b border-border/70 bg-muted/20 px-6 pb-5 pt-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/20">
              <Calendar className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-xl font-bold tracking-tight">تمديد إيجار اللوحة</DialogTitle>
              <p className="truncate text-sm text-muted-foreground">تحديث مدة اللوحة مع الاحتفاظ ببيانات العقد</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border bg-background px-3 py-2.5">
              <span className="text-[11px] text-muted-foreground">اللوحة</span>
              <p className="mt-0.5 truncate font-bold text-foreground">{billboard.Billboard_Name || `#${billboard.ID}`}</p>
            </div>
            <div className="rounded-xl border border-border bg-background px-3 py-2.5">
              <span className="text-[11px] text-muted-foreground">العقد</span>
              <p className="mt-0.5 font-bold text-foreground">{billboard.Contract_Number ? `#${billboard.Contract_Number}` : 'غير مرتبط'}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />الانتهاء الحالي</div>
              <p className="text-base font-bold text-destructive">{billboard.Rent_End_Date ? formatDate(currentEndDate) : 'غير محدد'}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground"><ArrowLeft className="h-3.5 w-3.5" />بعد التمديد</div>
              <p className="text-base font-bold text-emerald-700 dark:text-emerald-400">{formatDate(newEndDate)}</p>
            </div>
          </div>

          {/* نوع التمديد */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">نوع التمديد</Label>
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
            <Label className="text-sm font-semibold">عدد أيام التمديد</Label>
            <Input
              type="number"
              min={1}
              value={extensionDays}
              onChange={(e) => setExtensionDays(parseInt(e.target.value) || 0)}
              placeholder="أدخل عدد الأيام"
              className="h-10 text-center text-lg font-bold"
            />
          </div>
          </div>

          {/* سبب التمديد */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 text-primary" />سبب التمديد <span className="text-destructive">*</span></Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: مناسبة العيد الوطني..."
              rows={2}
              className="resize-none"
            />
          </div>

          {/* ملاحظات إضافية */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">ملاحظات إضافية <span className="font-normal text-muted-foreground">(اختياري)</span></Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي ملاحظات إضافية..."
              rows={2}
              className="resize-none"
            />
          </div>

          {/* معاينة التاريخ الجديد */}
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <span>سيتم تمديد تاريخ انتهاء اللوحة فقط، ولن يتغير تاريخ انتهاء العقد.</span>
          </div>
        </div>

        <DialogFooter className="border-t border-border/70 bg-muted/20 px-6 py-4">
          <Button variant="outline" className="h-10 cursor-pointer transition-all duration-200" onClick={() => onOpenChange(false)} disabled={saving}>
            إلغاء
          </Button>
          <Button className="h-10 min-w-36 cursor-pointer gap-2 bg-primary text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90" onClick={handleSave} disabled={saving}>
            {saving ? 'جاري الحفظ...' : <><Check className="h-4 w-4" />تأكيد التمديد</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
