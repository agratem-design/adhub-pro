import { AlertCircle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { addCalendarDays } from '@/services/billboardAvailabilityService';
import { calculateDaysBetween } from '@/utils/contractBillboardCalculations';

export type CompensationChoices = Record<string, { enabled: boolean; contractNumber: number }>;
export function readPrices(raw: unknown): any[] {
  try { const value = typeof raw === 'string' ? JSON.parse(raw) : raw; return Array.isArray(value) ? value : []; } catch { return []; }
}
export function withCompensation(prices: any[], choices: CompensationChoices, saved?: unknown) {
  const previous = readPrices(saved);
  return prices.map(p => {
    const old = previous.find(x => String(x.billboardId) === String(p.billboardId));
    const choice = choices[String(p.billboardId)];
    return { ...p, compensateOriginal: choice?.enabled ?? old?.compensateOriginal ?? false,
      originalContractNumber: choice?.contractNumber ?? old?.originalContractNumber ?? null };
  });
}

export function RentalCompensationAlert({ billboards, startDate, endDate, contractNumber, choices, onChange, savedPrices }: {
  billboards: any[]; startDate: string; endDate: string; contractNumber?: string | number;
  choices: CompensationChoices; onChange: (value: CompensationChoices) => void; savedPrices?: unknown;
}) {
  const saved = readPrices(savedPrices);
  const days = calculateDaysBetween(startDate, endDate);
  const rows = billboards.map(b => {
    const id = String(b.ID ?? b.id);
    const old = saved.find(p => String(p.billboardId) === id);
    const source = old?.originalContractNumber || b.Contract_Number;
    const eligible = old?.compensateOriginal || (source && String(source) !== String(contractNumber ?? '') &&
      b.Rent_End_Date?.slice(0, 10) >= startDate && (!b.Rent_Start_Date || b.Rent_Start_Date.slice(0, 10) <= endDate));
    return { b, id, source, old, eligible };
  }).filter(r => r.eligible);
  if (!rows.length || !days) return null;
  return <div role="alert" dir="rtl" className="space-y-3 rounded-xl border border-primary/40 bg-primary/10 p-4">
    <p className="flex items-center gap-2 font-semibold"><AlertCircle className="h-5 w-5 text-primary" />استعانة بلوحات مؤجرة — تعويض العقد الأصلي</p>
    <p className="text-sm text-muted-foreground">يمكن تمديد اللوحة في عقدها الأصلي بمدة هذا العقد ({days} يوم)، دون زيادة قيمته المالية. ينطبق على جميع أنواع العقود.</p>
    {rows.map(({ b, id, source, old }) => <label key={id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-3 transition-all duration-200 hover:border-primary">
      <Checkbox checked={choices[id]?.enabled ?? old?.compensateOriginal ?? false} onCheckedChange={checked => onChange({ ...choices, [id]: { enabled: checked === true, contractNumber: Number(source) } })} />
      <span className="text-sm"><span className="font-semibold">{b.Billboard_Name || id} — العقد #{source}</span><br />
        {old?.compensateOriginal ? 'التعويض محفوظ؛ تعديل المدة يحدّث فرق الأيام فقط.' : `إضافة ${days} يوم${b.Rent_End_Date ? `؛ الانتهاء المتوقع ${addCalendarDays(b.Rent_End_Date.slice(0, 10), days)}` : ''}`}
      </span>
    </label>)}
  </div>;
}
