import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Building2, CalendarClock, Loader2, Plus, Trash2 } from 'lucide-react';
import { inHousePrinterId, mainPrinterAt, type PrinterDefaults } from '@/lib/printerDefaults';

const AUTO = '__auto__';

/**
 * المطبعة الرئيسية حسب الفترة: مهمة الطباعة تأخذ افتراضياً المطبعة المعتمدة
 * في تاريخ إنشاء العقد، والعقد الشامل للتركيب والطباعة يأخذ مطبعة الشركة.
 */
export function MainPrinterSchedule({ printers, canEdit, value, onPersist }: {
  printers: { id: string; name: string; is_active: boolean }[];
  canEdit: boolean;
  value: PrinterDefaults;
  onPersist: (next: PrinterDefaults) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [newPrinter, setNewPrinter] = useState('');
  const [newFrom, setNewFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const active = printers.filter(p => p.is_active);
  const nameOf = (id: string | null) => printers.find(p => p.id === id)?.name || '—';

  const schedule = [...value.schedule].sort((a, b) => b.from.localeCompare(a.from));
  const today = new Date().toISOString().slice(0, 10);
  const currentMain = mainPrinterAt(value, today, active);
  const inHouse = inHousePrinterId(value, active);

  const persist = async (next: PrinterDefaults) => {
    setSaving(true);
    try {
      await onPersist(next);
      toast.success('حُفظت إعدادات المطبعة الافتراضية');
    } catch (e: any) {
      toast.error('تعذر الحفظ: ' + (e?.message || ''));
    } finally { setSaving(false); }
  };

  const add = () => {
    if (!newPrinter || !newFrom) { toast.error('اختر المطبعة وتاريخ البداية'); return; }
    const rest = value.schedule.filter(r => r.from !== newFrom);
    persist({ ...value, schedule: [...rest, { printer_id: newPrinter, from: newFrom }] }).then(() => setNewPrinter(''));
  };

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card" aria-label="المطبعة الافتراضية">
      <header className="border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><CalendarClock className="h-4 w-4 text-primary" />المطبعة الافتراضية لمهام الطباعة</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          تُختار تلقائياً المطبعة الرئيسية المعتمدة في تاريخ إنشاء العقد، ويمكن تغييرها من المهمة. العقود الشاملة للتركيب والطباعة تذهب لمطبعة الشركة.
        </p>
      </header>

      <div className="space-y-4 p-4">
        <div className="rounded-lg bg-primary/10 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">المطبعة الرئيسية اليوم</p>
          <p className="text-base font-bold">{currentMain ? nameOf(currentMain) : <span className="text-amber-500">غير محددة — أضف فترة</span>}</p>
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs"><Building2 className="h-3.5 w-3.5" />مطبعة الشركة (الشامل للتركيب والطباعة)</Label>
          <Select
            disabled={!canEdit || saving}
            value={value.in_house_printer_id || AUTO}
            onValueChange={v => persist({ ...value, in_house_printer_id: v === AUTO ? null : v })}
          >
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={AUTO}>تلقائي{inHouse ? ` (${nameOf(inHouse)})` : ''}</SelectItem>
              {active.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold">فترات المطبعة الرئيسية</p>
          {schedule.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">لا توجد فترات بعد</p>
          ) : (
            <ol className="relative space-y-2 pr-4">
              <span className="absolute bottom-2 right-[5px] top-2 w-px bg-border" aria-hidden />
              {schedule.map((r, i) => {
                const next = schedule[i - 1];
                const isCurrent = r.from <= today && (!next || next.from > today);
                return (
                  <li key={r.from + r.printer_id} className="relative flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                    <span className={`absolute -right-[15px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ${isCurrent ? 'bg-primary' : 'bg-muted-foreground/40'}`} aria-hidden />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {nameOf(r.printer_id)}
                        {isCurrent && <span className="mr-1.5 rounded bg-primary/15 px-1.5 text-xs font-semibold text-primary">الحالية</span>}
                      </p>
                      <p className="text-xs tabular-nums text-muted-foreground">من {r.from}{next ? ` إلى ${next.from}` : ' — حتى الآن'}</p>
                    </div>
                    {canEdit && (
                      <button type="button" disabled={saving} aria-label="حذف الفترة"
                        onClick={() => persist({ ...value, schedule: value.schedule.filter(x => !(x.from === r.from && x.printer_id === r.printer_id)) })}
                        className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {canEdit && (
          <div className="space-y-2 rounded-lg bg-muted/40 p-3">
            <p className="text-xs font-semibold">إضافة فترة</p>
            <Select value={newPrinter} onValueChange={setNewPrinter}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="اختر المطبعة" /></SelectTrigger>
              <SelectContent>{active.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input type="date" className="h-9 flex-1" value={newFrom} onChange={e => setNewFrom(e.target.value)} aria-label="معتمدة ابتداءً من" />
              <Button size="sm" className="h-9 gap-1" onClick={add} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}إضافة
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
