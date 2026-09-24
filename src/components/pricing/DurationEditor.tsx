import { useId, useState } from 'react';
import { CalendarDays, Check, Layers } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

type Unit = 'days' | 'months' | 'years';
interface Props {
  name: string;
  months: number;
  days: number;
  onChange: (value: { name: string; months: number; days: number }) => void;
}

export function DurationEditor({ name, months, days, onChange }: Props) {
  const id = useId();
  const [unit, setUnit] = useState<Unit>(months >= 12 && months % 12 === 0 ? 'years' : months > 0 ? 'months' : 'days');
  const [amount, setAmount] = useState<string>(String(months >= 12 && months % 12 === 0 ? months / 12 : months || days));
  const apply = (value: string, nextUnit: Unit) => {
    setAmount(value);
    setUnit(nextUnit);
    const quantity = Number(value);
    onChange({
      name,
      months: nextUnit === 'years' ? quantity * 12 : nextUnit === 'months' ? quantity : quantity / 30,
      days: Math.round(quantity * (nextUnit === 'years' ? 365 : nextUnit === 'months' ? 30 : 1)),
    });
  };
  const preset = (label: string, value: number, nextUnit: Unit, totalDays: number) => {
    setUnit(nextUnit);
    setAmount(String(value));
    onChange({ name: label, months: nextUnit === 'years' ? value * 12 : value, days: totalDays });
  };
  const valid = Number(amount) > 0 && Number.isFinite(days) && days > 0;

  return (
    <div dir="rtl" className="space-y-6 py-2">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">ابدأ بمثال أو أدخل المدة بنفسك</p>
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="outline" className="h-auto justify-start gap-3 rounded-xl p-3 text-right hover:border-primary hover:bg-primary/5" onClick={() => preset('شهر ونصف', 1.5, 'months', 45)}>
            <CalendarDays className="h-5 w-5 shrink-0 text-primary" />
            <span><span className="block font-semibold">شهر ونصف</span><span className="block text-xs font-normal text-muted-foreground">45 يومًا</span></span>
          </Button>
          <Button type="button" variant="outline" className="h-auto justify-start gap-3 rounded-xl p-3 text-right hover:border-primary hover:bg-primary/5" onClick={() => preset('سنتان', 2, 'years', 730)}>
            <CalendarDays className="h-5 w-5 shrink-0 text-primary" />
            <span><span className="block font-semibold">سنتان</span><span className="block text-xs font-normal text-muted-foreground">730 يومًا</span></span>
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${id}-name`}>اسم المدة</Label>
        <Input id={`${id}-name`} value={name} onChange={e => onChange({ name: e.target.value, months, days })} placeholder="مثال: شهر ونصف" className="h-12 rounded-xl" maxLength={80} />
        <p className="text-xs text-muted-foreground">يظهر هذا الاسم في الأسعار والعقود والعروض والطباعة.</p>
      </div>

      <div className="space-y-3">
        <Label htmlFor={`${id}-amount`}>كم تستمر هذه المدة؟</Label>
        <div className="flex gap-3">
          <Input id={`${id}-amount`} type="number" dir="ltr" value={amount} min={unit === 'days' ? 1 : 0.5} step={unit === 'days' ? 1 : 0.5} onChange={e => apply(e.target.value, unit)} className="h-12 w-28 rounded-xl text-center text-lg font-semibold" />
          <div className="grid flex-1 grid-cols-3 gap-1 rounded-xl border border-border bg-muted/40 p-1" role="group" aria-label="وحدة المدة">
            {([['days', 'يوم'], ['months', 'شهر'], ['years', 'سنة']] as const).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={unit === value} onClick={() => apply(amount, value)} className={`cursor-pointer rounded-lg px-2 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${unit === value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-background hover:text-foreground'}`}>{label}</button>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{unit === 'years' ? 'تُحسب السنة 365 يومًا.' : unit === 'months' ? 'يُحسب الشهر 30 يومًا. أدخل 1.5 لشهر ونصف.' : 'أدخل العدد الفعلي للأيام.'}</p>
      </div>

      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4" aria-live="polite">
        <div className="flex items-center gap-2 text-sm font-semibold"><Check className="h-4 w-4 text-primary" />{name.trim() || 'ملخص المدة'}</div>
        <p className="mt-2 text-2xl font-bold tabular-nums">{valid ? `${days.toLocaleString('ar-LY')} يومًا` : 'أدخل مدة أكبر من صفر'}</p>
      </div>
      <div className="flex items-start gap-2 text-sm text-muted-foreground">
        <Layers className="mt-0.5 h-4 w-4 shrink-0" />
        <p>بعد الإضافة، اختر مستوى موجودًا أو أضف مستوى جديدًا، ثم أدخل أسعار هذه المدة لكل مقاس وفئة.</p>
      </div>
    </div>
  );
}
