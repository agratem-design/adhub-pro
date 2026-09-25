import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useEffect, useId, useState } from 'react';

export function FactorValueEditor({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const inputId = useId();
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return <div className="space-y-5 rounded-xl border border-border bg-muted/20 p-4" dir="rtl">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <Label htmlFor={inputId}>قيمة المعامل<span className="mt-1 block text-sm font-normal text-muted-foreground">1.00 يحافظ على السعر الأساسي</span></Label>
      <Input id={inputId} aria-label="قيمة المعامل" dir="ltr" type="number" min="0.5" max="2" step="0.05" value={draft} className="h-12 w-28 text-center text-xl font-bold" onChange={e => { setDraft(e.target.value); const n = Number(e.target.value); if (e.target.value && Number.isFinite(n) && n >= 0.5 && n <= 2) onChange(n); }} onBlur={() => setDraft(String(value))} />
    </div>
    <Slider dir="ltr" aria-label="تغيير المعامل" min={0.5} max={2} step={0.05} value={[value]} onValueChange={([n]) => onChange(n)} />
    <div className="grid grid-cols-3 gap-2">{[{ value: 0.75, label: 'تخفيض 25%' }, { value: 1, label: 'السعر الأساسي' }, { value: 1.25, label: 'زيادة 25%' }].map(p => <Button key={p.value} type="button" variant="outline" className={`h-10 cursor-pointer px-1 text-xs transition-all duration-200 ${value === p.value ? 'border-primary bg-primary/10' : ''}`} onClick={() => onChange(p.value)}>{p.label}</Button>)}</div>
    <div aria-live="polite" className="rounded-lg border border-primary/20 bg-primary/5 p-3">
      <p className="text-xs text-muted-foreground">مثال توضيحي على سعر أساسي 1,000 د.ل</p>
      <div className="mt-2 flex items-center justify-between gap-3"><span className="text-2xl font-bold tabular-nums">{Math.round(1000 * value).toLocaleString('ar-LY')} <span className="text-xs font-normal">د.ل</span></span><span className="text-sm">{value === 1 ? 'بدون تغيير' : `${value > 1 ? 'زيادة' : 'تخفيض'} ${Math.round(Math.abs(value - 1) * 100)}%`}</span></div>
    </div>
  </div>;
}
