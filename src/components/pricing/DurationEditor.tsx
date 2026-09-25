import { useId, useState, useEffect } from 'react';
import { CalendarDays, Check, Layers, Sparkles, Clock } from 'lucide-react';
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

// دالة تنظيف وتوحيد المدخلات الرقمية (تدعم الأرقام العربية والفواصل المختلفة)
function normalizeArabicDecimal(val: string): string {
  if (!val) return '';
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let cleaned = val;
  for (let i = 0; i < 10; i++) {
    cleaned = cleaned.replaceAll(arabicDigits[i], String(i));
  }
  // استبدال الفواصل العربية والإنجليزية بالنقطة العشرية
  cleaned = cleaned.replace(/[،,٫]/g, '.');
  // الإبقاء فقط على الأرقام ونقطة عشرية واحدة
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('');
  }
  return cleaned.replace(/[^0-9.]/g, '');
}

// اقتراح اسم عربي فصيح للمدة بناء على الأشهر والأيام
function suggestArabicName(months: number, days: number): string {
  if (months === 0.5 || (months === 0 && days === 15)) return 'نصف شهر';
  if (months === 1 || days === 30) return 'شهر واحد';
  if (months === 1.5 || days === 45) return 'شهر ونصف';
  if (months === 2 || days === 60) return 'شهران';
  if (months === 2.5 || days === 75) return 'شهران ونصف';
  if (months === 3 || days === 90) return '3 أشهر';
  if (months === 3.5 || days === 105) return 'ثلاثة أشهر ونصف';
  if (months === 4 || days === 120) return '4 أشهر';
  if (months === 4.5 || days === 135) return 'أربعة أشهر ونصف';
  if (months === 5 || days === 150) return '5 أشهر';
  if (months === 5.5 || days === 165) return 'خمسة أشهر ونصف';
  if (months === 6 || days === 180) return '6 أشهر';
  if (months === 6.5 || days === 195) return 'ستة أشهر ونصف';
  if (months === 7 || days === 210) return '7 أشهر';
  if (months === 7.5 || days === 225) return 'سبعة أشهر ونصف';
  if (months === 8 || days === 240) return '8 أشهر';
  if (months === 8.5 || days === 255) return 'ثمانية أشهر ونصف';
  if (months === 9 || days === 270) return '9 أشهر';
  if (months === 9.5 || days === 285) return 'تسعة أشهر ونصف';
  if (months === 10 || days === 300) return '10 أشهر';
  if (months === 10.5 || days === 315) return 'عشرة أشهر ونصف';
  if (months === 11 || days === 330) return '11 شهراً';
  if (months === 11.5 || days === 345) return 'أحد عشر شهراً ونصف';
  if (months === 12 || days === 365) return 'سنة كاملة';
  if (months === 18 || days === 548) return 'سنة ونصف';
  if (months === 24 || days === 730) return 'سنتان';
  if (months === 36 || days === 1095) return '3 سنوات';

  if (months > 0 && months % 1 !== 0) {
    const whole = Math.floor(months);
    const fraction = months - whole;
    if (Math.abs(fraction - 0.5) < 0.05) {
      if (whole === 1) return 'شهر ونصف';
      if (whole === 2) return 'شهران ونصف';
      if (whole >= 3 && whole <= 10) return `${whole} أشهر ونصف`;
      return `${whole} شهراً ونصف`;
    }
  }

  if (days > 0 && days < 30) return `${days} يوماً`;
  return '';
}

export function DurationEditor({ name, months, days, onChange }: Props) {
  const id = useId();

  // تحديد الوحدة الافتراضية
  const initialUnit: Unit = months >= 12 && months % 12 === 0 ? 'years' : months > 0 ? 'months' : 'days';
  const initialAmount = String(
    initialUnit === 'years' ? months / 12 : initialUnit === 'months' ? months : days || 30
  );

  const [unit, setUnit] = useState<Unit>(initialUnit);
  const [amountStr, setAmountStr] = useState<string>(initialAmount);
  const [inputMode, setInputMode] = useState<'months_days' | 'direct'>('months_days');

  // حقول الأشهر + الأيام المنفصلة
  const [splitMonths, setSplitMonths] = useState<string>(
    String(months > 0 ? Math.floor(months) : Math.floor(days / 30))
  );
  const [splitDays, setSplitDays] = useState<string>(
    String(days > 0 ? days % 30 : (months % 1) * 30 || 0)
  );

  // تحديث القيم عند اختيار نموذج مسبق
  const applyPreset = (label: string, mVal: number, totalDays: number) => {
    setSplitMonths(String(Math.floor(mVal)));
    setSplitDays(String(totalDays % 30));
    setAmountStr(String(mVal));
    setUnit('months');
    onChange({
      name: label,
      months: mVal,
      days: totalDays,
    });
  };

  // تطبيق التعديل من طريقة [أشهر + أيام]
  const handleSplitChange = (mText: string, dText: string) => {
    const normM = normalizeArabicDecimal(mText);
    const normD = normalizeArabicDecimal(dText);
    setSplitMonths(normM);
    setSplitDays(normD);

    const mNum = parseFloat(normM) || 0;
    const dNum = parseFloat(normD) || 0;

    // حساب الإجمالي
    const totalDays = Math.round(mNum * 30 + dNum);
    const computedMonths = Number((mNum + dNum / 30).toFixed(2));

    const suggested = suggestArabicName(computedMonths, totalDays);
    const finalName = (!name || suggestArabicName(months, days) === name) && suggested ? suggested : name;

    setAmountStr(String(computedMonths));
    setUnit('months');

    onChange({
      name: finalName,
      months: computedMonths,
      days: totalDays,
    });
  };

  // تطبيق التعديل من طريقة [القيمة المباشرة والوحدة]
  const handleDirectAmountChange = (valText: string, currentUnit: Unit) => {
    const cleaned = normalizeArabicDecimal(valText);
    setAmountStr(cleaned);
    setUnit(currentUnit);

    const quantity = parseFloat(cleaned) || 0;
    let computedMonths = 0;
    let computedDays = 0;

    if (currentUnit === 'years') {
      computedMonths = quantity * 12;
      computedDays = Math.round(quantity * 365);
    } else if (currentUnit === 'months') {
      computedMonths = Number(quantity.toFixed(2));
      computedDays = Math.round(quantity * 30);
    } else {
      computedDays = Math.round(quantity);
      computedMonths = Number((quantity / 30).toFixed(2));
    }

    const suggested = suggestArabicName(computedMonths, computedDays);
    const finalName = (!name || suggestArabicName(months, days) === name) && suggested ? suggested : name;

    // مزامنة حقول الشهور والأيام
    setSplitMonths(String(Math.floor(computedMonths)));
    setSplitDays(String(computedDays % 30));

    onChange({
      name: finalName,
      months: computedMonths,
      days: computedDays,
    });
  };

  const suggestedName = suggestArabicName(months, days);
  const isValid = Number.isFinite(days) && days > 0 && Number.isFinite(months) && months >= 0;

  return (
    <div dir="rtl" className="space-y-6 py-2">
      {/* نماذج مسبقة شائعة وسريعة تشمل الكسور والأنصاف */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-amber-500" />
            نماذج مدد وكسور شائعة (جاهزة بنقرة واحدة):
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'شهر ونصف', months: 1.5, days: 45 },
            { label: 'شهران ونصف', months: 2.5, days: 75 },
            { label: 'ثلاثة أشهر ونصف', months: 3.5, days: 105 },
            { label: 'ستة أشهر ونصف', months: 6.5, days: 195 },
            { label: 'ثمانية أشهر ونصف', months: 8.5, days: 255 },
            { label: 'تسعة أشهر ونصف', months: 9.5, days: 285 },
            { label: 'سنة ونصف', months: 18, days: 548 },
            { label: 'سنتان', months: 24, days: 730 },
          ].map((item) => {
            const isSelected = days === item.days || (name && name.trim() === item.label);
            return (
              <Button
                key={item.label}
                type="button"
                variant={isSelected ? 'default' : 'outline'}
                onClick={() => applyPreset(item.label, item.months, item.days)}
                className={`h-auto flex flex-col items-center justify-center p-2.5 rounded-xl text-center transition-all ${
                  isSelected
                    ? 'shadow-sm ring-1 ring-primary'
                    : 'hover:border-primary hover:bg-primary/5'
                }`}
              >
                <span className="font-bold text-xs">{item.label}</span>
                <span className="text-[11px] opacity-75 font-mono mt-0.5">{item.days} يوماً ({item.months} شهر)</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* حقل اسم المدة مع اقتراح ذكي */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={`${id}-name`} className="font-bold">اسم المدة</Label>
          {suggestedName && suggestedName !== name && (
            <button
              type="button"
              onClick={() => onChange({ name: suggestedName, months, days })}
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="h-3 w-3" />
              <span>استخدام الاسم المقترح: &quot;{suggestedName}&quot;</span>
            </button>
          )}
        </div>
        <Input
          id={`${id}-name`}
          value={name}
          onChange={(e) => onChange({ name: e.target.value, months, days })}
          placeholder="مثال: ثمانية أشهر ونصف، شهر ونصف، 45 يوماً..."
          className="h-12 rounded-xl text-base font-semibold"
          maxLength={80}
        />
        <p className="text-xs text-muted-foreground">
          يظهر هذا الاسم المعتمد في شاشات الأسعار، والعقود، والفواتير، والطباعة.
        </p>
      </div>

      {/* تبديل طريقة الإدخال اليدوي */}
      <div className="space-y-3 rounded-2xl border border-border/80 bg-muted/20 p-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-bold flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-primary" />
            كم تستمر هذه المدة؟
          </Label>
          <div className="flex rounded-lg border border-border p-0.5 bg-background text-xs">
            <button
              type="button"
              onClick={() => setInputMode('months_days')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                inputMode === 'months_days'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              بالأشهر والأيام (مفصّل)
            </button>
            <button
              type="button"
              onClick={() => setInputMode('direct')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                inputMode === 'direct'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              قيمة مباشرة (عشري)
            </button>
          </div>
        </div>

        {/* الطريقة الأولى: إدخال الأشهر والأيام مفصلاً (أسهل بكثير للمستخدمين) */}
        {inputMode === 'months_days' && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground">عدد الأشهر:</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    inputMode="decimal"
                    dir="ltr"
                    value={splitMonths}
                    onChange={(e) => handleSplitChange(e.target.value, splitDays)}
                    placeholder="مثال: 8 أو 1"
                    className="h-12 rounded-xl text-center text-lg font-bold bg-background"
                  />
                  <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">شهر</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground">أيام إضافية:</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    value={splitDays}
                    onChange={(e) => handleSplitChange(splitMonths, e.target.value)}
                    placeholder="مثال: 15"
                    className="h-12 rounded-xl text-center text-lg font-bold bg-background"
                  />
                  <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">يوم</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="text-xs text-muted-foreground font-semibold">إضافة نصف شهر سريعة:</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSplitChange(splitMonths, '15')}
                className="h-8 text-xs rounded-lg gap-1 border-dashed"
              >
                + 15 يوماً (نصف شهر)
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleSplitChange(splitMonths, '0')}
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                تصفير الأيام
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              💡 مثال: لكتابة <strong>شهر ونصف</strong> أدخل 1 شهر و 15 يوماً. لكتابة <strong>ثمانية أشهر ونصف</strong> أدخل 8 أشهر و 15 يوماً.
            </p>
          </div>
        )}

        {/* الطريقة الثانية: الإدخال المباشر بالقيمة العشرية والوحدة */}
        {inputMode === 'direct' && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-3">
              <div className="w-36">
                <Input
                  id={`${id}-amount`}
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  value={amountStr}
                  onChange={(e) => handleDirectAmountChange(e.target.value, unit)}
                  placeholder="مثال: 1.5 أو 8.5"
                  className="h-12 rounded-xl text-center text-lg font-bold bg-background"
                />
              </div>

              <div
                className="grid flex-1 grid-cols-3 gap-1 rounded-xl border border-border bg-background p-1"
                role="group"
                aria-label="وحدة المدة"
              >
                {(
                  [
                    ['days', 'يوم'],
                    ['months', 'شهر'],
                    ['years', 'سنة'],
                  ] as const
                ).map(([uKey, uLabel]) => (
                  <button
                    key={uKey}
                    type="button"
                    aria-pressed={unit === uKey}
                    onClick={() => handleDirectAmountChange(amountStr, uKey)}
                    className={`cursor-pointer rounded-lg px-3 py-2 text-sm font-bold whitespace-nowrap transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      unit === uKey
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                  >
                    {uLabel}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {unit === 'years'
                ? 'تُحسب السنة 365 يوماً (أدخل 1.5 لسنة ونصف).'
                : unit === 'months'
                ? 'يُحسب الشهر 30 يوماً. يمكنك كتابة 1.5 لشهر ونصف، أو 8.5 لثمانية أشهر ونصف (تقبل الفاصلة والنقطة والأرقام العربية).'
                : 'أدخل العدد الفعلي للأيام مباشرة (مثل 45 أو 255).'}
            </p>
          </div>
        )}
      </div>

      {/* بطاقة ملخص المدة الحالية */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Check className="h-4 w-4 text-primary" />
            <span>{name.trim() || suggestedName || 'ملخص المدة'}</span>
          </div>
          <span className="text-xs bg-primary/20 text-primary px-2.5 py-0.5 rounded-full font-bold">
            {months} {months === 1 ? 'شهر' : months === 2 ? 'شهران' : 'أشهر'}
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black tabular-nums text-primary font-mono">
            {isValid ? days.toLocaleString('ar-LY') : '0'}
          </span>
          <span className="text-sm font-bold text-muted-foreground">يوماً فعلياً في العقود والأسعار</span>
        </div>

        <p className="text-xs text-muted-foreground border-t border-primary/10 pt-2">
          تُحسب هذه المدة تلقائياً في تواريخ بدء وانتهاء العقود، وفي حسابات أسعار اللوحات الشهرية واليومية.
        </p>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Layers className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p>
          بعد حفظ هذه المدة، ستظهر تلقائياً كزر في شريط المدد بأعلى صفحة الأسعار وفي نماذج إنشاء وتعديل العقود، ويمكنك تحديد أسعارها لكل مقاس ومستوى.
        </p>
      </div>
    </div>
  );
}
