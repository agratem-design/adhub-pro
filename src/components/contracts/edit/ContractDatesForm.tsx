import { useMemo } from 'react';
import { usePricingDurations } from '@/hooks/usePricingDurations';
import { durationEnd, durationName } from '@/utils/pricingDuration';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, CalendarDays, Clock, Flag } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { EditSection, Field, Segmented, ToggleRow } from './ui';

interface ContractDatesFormProps {
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  pricingMode: 'months' | 'days';
  setPricingMode: (mode: 'months' | 'days') => void;
  durationMonths: number;
  setDurationMonths: (months: number) => void;
  durationDays: number;
  setDurationDays: (days: number) => void;
  use30DayMonth?: boolean;
  setUse30DayMonth?: (use: boolean) => void;
}

export function ContractDatesForm({
  startDate, setStartDate, pricingMode, setPricingMode, durationMonths, setDurationMonths,
  durationDays, setDurationDays, use30DayMonth = true, setUse30DayMonth,
}: ContractDatesFormProps) {
  const { data: durations } = usePricingDurations();
  const monthOptions = Array.from(new Set([
    ...durations.filter(d => d.is_active && d.months > 0).map(d => Number(d.months)),
    ...(!durations.length ? [1, 2, 3, 6, 9, 12] : []),
    durationMonths,
  ])).filter(m => m > 0).sort((a, b) => a - b);

  const calculatedEndDate = useMemo(() => {
    if (!startDate) return null;
    const end = pricingMode === 'months' ? durationEnd(startDate, durationMonths, use30DayMonth, durations) : new Date(startDate);
    if (pricingMode === 'days') end.setDate(end.getDate() + durationDays);
    return isNaN(end.getTime()) ? null : end;
  }, [startDate, pricingMode, durationMonths, durationDays, use30DayMonth, durations]);
  const totalDays = calculatedEndDate ? Math.round((calculatedEndDate.getTime() - new Date(startDate).getTime()) / 86400000) : 0;

  return (
    <EditSection icon={CalendarIcon} title="الفترة" description="تاريخ البداية والمدة؛ تاريخ النهاية يُحسب تلقائياً">
      <Segmented
        value={pricingMode}
        onChange={setPricingMode}
        options={[
          { value: 'months', label: 'بالأشهر', icon: CalendarDays },
          { value: 'days', label: 'بالأيام', icon: Clock },
        ]}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="تاريخ البداية" icon={CalendarIcon}>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10 w-full justify-start gap-2 font-medium">
                <CalendarIcon className="h-4 w-4 text-primary" />
                {startDate ? format(new Date(startDate), 'dd MMMM yyyy', { locale: ar }) : <span className="text-muted-foreground">اختر التاريخ</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="z-[10000] w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate ? new Date(startDate) : undefined}
                onSelect={date => setStartDate(date ? format(date, 'yyyy-MM-dd') : '')}
                locale={ar}
                className="pointer-events-auto rounded-xl"
              />
            </PopoverContent>
          </Popover>
        </Field>

        {pricingMode === 'months' ? (
          <Field label="المدة" icon={CalendarDays}>
            <Select value={String(durationMonths)} onValueChange={v => setDurationMonths(Number(v))}>
              <SelectTrigger className="h-10 font-medium"><SelectValue placeholder="الأشهر" /></SelectTrigger>
              <SelectContent className="z-[10000]">
                {monthOptions.map(m => (
                  <SelectItem key={m} value={String(m)}>
                    {durationName(m, durations)}
                    {use30DayMonth && <span className="mr-2 text-muted-foreground">({durations.find(d => Number(d.months) === m)?.days ?? m * 30} يوم)</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : (
          <Field label="عدد الأيام" icon={Clock}>
            <Input type="number" min={1} value={durationDays} onChange={e => setDurationDays(Number(e.target.value) || 0)} className="h-10 tabular-nums" />
          </Field>
        )}
      </div>

      {pricingMode === 'months' && setUse30DayMonth && (
        <ToggleRow
          title="الشهر = 30 يوماً"
          description={use30DayMonth ? 'كل شهر يُحسب 30 يوماً ثابتاً' : 'تُحسب أيام كل شهر الفعلية'}
          checked={use30DayMonth}
          onChange={setUse30DayMonth}
        />
      )}

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
        <div className="bg-muted/30 px-3 py-2.5">
          <p className="flex items-center gap-1 text-xs text-muted-foreground"><Flag className="h-3.5 w-3.5" />تاريخ النهاية</p>
          <p className="text-sm font-bold">{calculatedEndDate ? format(calculatedEndDate, 'dd MMMM yyyy', { locale: ar }) : '—'}</p>
        </div>
        <div className="bg-muted/30 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">إجمالي الأيام</p>
          <p className="text-sm font-bold tabular-nums text-primary">{totalDays} يوم</p>
        </div>
      </div>
    </EditSection>
  );
}
