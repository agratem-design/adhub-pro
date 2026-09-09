import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resumePausedBillboard } from '@/services/pausedBillboardsService';
import { calculateRemainingBillboardValue } from '@/utils/contractBillboardCalculations';
import { toast } from 'sonner';

type ResumeRow = {
  id: string;
  billboard_name?: string | null;
  price_snapshot?: Record<string, unknown> | null;
  refund_amount?: number | null;
  net_rent?: number | null;
  pause_date: string;
  original_start_date: string;
  original_end_date: string;
};

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'تعذر استئناف اللوحة';

export function ResumePausedBillboardDialog({ row, onClose, onChanged, currency }: {
  row: ResumeRow; onClose: () => void; onChanged: () => void; currency: string;
}) {
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [cancel, setCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const price = row.price_snapshot;
  const amount = cancel ? Number(row.refund_amount || 0) : calculateRemainingBillboardValue({
    startDate: row.original_start_date, endDate: row.original_end_date, effectiveDate: date,
    contractedPrice: Number(row.net_rent || 0),
  }).remainingValue;
  const valid = !!price && (cancel || (date > row.pause_date && date <= row.original_end_date));
  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await resumePausedBillboard(row.id, date, cancel);
      toast.success(cancel ? 'تم إلغاء الإيقاف مع حفظ أثره في السجل' : 'تم بدء فترة التشغيل الجديدة');
      onChanged(); onClose();
    } catch (error: unknown) { toast.error(errorMessage(error)); }
    finally { setBusy(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent dir="rtl" className="max-w-lg">
      <DialogHeader><DialogTitle>استئناف اللوحة {row.billboard_name}</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">يُحفظ هذا الإجراء فور تأكيده، مع الاحتفاظ بسجل الإيقاف. راجع الدفعات بعد تغيّر الإجمالي.</p>
      <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={cancel} onChange={e => setCancel(e.target.checked)} />إلغاء إيقاف سُجّل بالخطأ وإعادة الفترة الأصلية</label>
      {!cancel && <div className="space-y-2"><Label htmlFor="resume-date">تاريخ بدء التشغيل مجدداً</Label><Input id="resume-date" type="date" value={date} max={row.original_end_date} onChange={e => setDate(e.target.value)} /></div>}
      {!price && <p role="alert" className="text-sm text-destructive">السعر التاريخي غير مكتمل. يجب استكمال بيانات هذا الإيقاف قبل استئنافه.</p>}
      <div className="rounded-lg border border-border bg-primary/10 p-4 text-sm">المبلغ المضاف إلى العقد: <strong>{amount.toLocaleString('ar-LY')} {currency}</strong></div>
      <DialogFooter><Button variant="outline" onClick={onClose} disabled={busy} className="min-h-10 cursor-pointer transition-all duration-200">رجوع</Button><Button onClick={submit} disabled={!valid || busy} className="min-h-10 cursor-pointer transition-all duration-200 active:scale-95">{busy ? 'جارٍ التنفيذ' : 'تأكيد الإجراء'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
