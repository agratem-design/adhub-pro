import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarIcon, CalendarDays, Clock, Settings2, Info } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

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
  startDate,
  setStartDate,
  endDate,
  pricingMode,
  setPricingMode,
  durationMonths,
  setDurationMonths,
  durationDays,
  setDurationDays,
  use30DayMonth = true,
  setUse30DayMonth
}: ContractDatesFormProps) {
  // حساب عدد الأيام الفعلية
  const totalDays = React.useMemo(() => {
    if (pricingMode === 'days') return durationDays;
    // إذا كان use30DayMonth مفعل: كل شهر = 30 يوم
    // إذا كان معطل: نحسب الأيام الفعلية من تاريخ البداية للنهاية
    if (use30DayMonth) {
      return durationMonths * 30;
    }
    // حساب الأيام الفعلية بناءً على الأشهر التقويمية
    if (startDate) {
      const start = new Date(startDate);
      const end = new Date(startDate);
      end.setMonth(end.getMonth() + durationMonths);
      return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }
    return durationMonths * 30; // fallback
  }, [pricingMode, durationMonths, durationDays, use30DayMonth, startDate]);

  // حساب تاريخ الانتهاء المتوقع
  const calculatedEndDate = React.useMemo(() => {
    if (!startDate) return null;
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return null;
    
    if (pricingMode === 'days') {
      start.setDate(start.getDate() + durationDays);
    } else {
      if (use30DayMonth) {
        start.setDate(start.getDate() + (durationMonths * 30));
      } else {
        start.setMonth(start.getMonth() + durationMonths);
      }
    }
    return start;
  }, [startDate, pricingMode, durationMonths, durationDays, use30DayMonth]);

  return (
    <Card className="border-border shadow-lg overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/40" />
      <CardHeader className="py-3 px-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25">
            <CalendarIcon className="h-4 w-4 text-primary-foreground" />
          </div>
          التواريخ والمدة
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Pricing Mode Toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPricingMode('months')}
            className={cn(
              "p-3 rounded-xl border-2 text-center transition-all duration-200 flex items-center justify-center gap-2",
              pricingMode === 'months' 
                ? "border-primary bg-gradient-to-br from-primary/15 to-primary/5 text-primary shadow-lg shadow-primary/15" 
                : "border-border hover:border-primary/50 text-muted-foreground hover:bg-muted/50"
            )}
          >
            <CalendarDays className="h-4 w-4" />
            <span className="font-semibold text-sm">شهري</span>
          </button>
          <button
            type="button"
            onClick={() => setPricingMode('days')}
            className={cn(
              "p-3 rounded-xl border-2 text-center transition-all duration-200 flex items-center justify-center gap-2",
              pricingMode === 'days' 
                ? "border-primary bg-gradient-to-br from-primary/15 to-primary/5 text-primary shadow-lg shadow-primary/15" 
                : "border-border hover:border-primary/50 text-muted-foreground hover:bg-muted/50"
            )}
          >
            <Clock className="h-4 w-4" />
            <span className="font-semibold text-sm">يومي</span>
          </button>
        </div>

        {/* 30 Day Month Setting */}
        {pricingMode === 'months' && setUse30DayMonth && (
          <div className="p-3 rounded-xl bg-gradient-to-r from-accent/30 to-accent/10 border border-accent/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="use30day"
                  checked={use30DayMonth}
                  onCheckedChange={(checked) => setUse30DayMonth(!!checked)}
                  className="border-primary data-[state=checked]:bg-primary"
                />
                <Label htmlFor="use30day" className="text-sm font-medium cursor-pointer">
                  حساب الشهر = 30 يوم
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-right">
                      <p className="font-semibold mb-1">طريقة الحساب:</p>
 <p> مفعل: كل شهر = 30 يوم ثابت</p>
 <p> معطل: حسب أيام الشهر الفعلية</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full tabular-nums">
                {use30DayMonth ? `${durationMonths * 30} يوم` : 'أيام فعلية'}
              </span>
            </div>
          </div>
        )}

        {/* Start Date & Duration */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <CalendarIcon className="h-3 w-3 text-muted-foreground dark:text-white" />
              تاريخ البداية
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full h-10 justify-start text-right font-medium rounded-xl border-2 border-border hover:border-primary/50 bg-background text-foreground hover:bg-accent/5 transition-all shadow-sm",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="ml-2 h-4 w-4 text-primary dark:text-white shrink-0" />
                  {startDate ? format(new Date(startDate), "dd MMMM yyyy", { locale: ar }) : "اختر التاريخ"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 border-2 border-border shadow-xl z-[10000]" align="start">
                <Calendar
                  mode="single"
                  selected={startDate ? new Date(startDate) : undefined}
                  onSelect={(date) => setStartDate(date ? format(date, 'yyyy-MM-dd') : '')}
                  locale={ar}
                  className="rounded-xl pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {pricingMode === 'months' ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                المدة (أشهر)
              </label>
              <Select value={String(durationMonths)} onValueChange={(v) => setDurationMonths(Number(v))}>
                <SelectTrigger className="h-10 text-sm bg-background border-2 border-border rounded-xl font-medium">
                  <SelectValue placeholder="الأشهر" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-[10000]">
                  {[1, 2, 3, 6, 9, 12].map((m) => (
                    <SelectItem key={m} value={String(m)} className="font-medium">
                      {m} {m === 1 ? 'شهر' : m === 2 ? 'شهرين' : 'أشهر'}
                      {use30DayMonth && (
                        <span className="text-muted-foreground mr-2">({m * 30} يوم)</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                عدد الأيام
              </label>
              <Input 
                type="number" 
                min={1} 
                value={durationDays} 
                onChange={(e) => setDurationDays(Number(e.target.value) || 0)} 
                placeholder="الأيام"
                className="h-10 text-sm bg-background border-2 border-border focus:border-primary rounded-xl font-medium tabular-nums"
              />
            </div>
          )}
        </div>

        <Separator className="my-2" />

        {/* End Date & Summary */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 via-green-500/5 to-transparent border-2 border-emerald-500/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              ملخص الفترة
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">تاريخ الانتهاء</span>
              <div className="font-bold text-base text-foreground">
                {calculatedEndDate ? format(calculatedEndDate, "dd MMMM yyyy", { locale: ar }) : '---'}
              </div>
            </div>
            <div className="space-y-1 text-left">
              <span className="text-xs text-muted-foreground">إجمالي الأيام</span>
              <div className="font-bold text-base text-emerald-600 tabular-nums">
                <span>{totalDays}</span> <span>يوم</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
