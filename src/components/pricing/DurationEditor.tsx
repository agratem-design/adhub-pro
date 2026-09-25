import { useId, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Unit = 'days' | 'months' | 'years';

interface Props {
  name: string;
  months: number;
  days: number;
  onChange: (value: { name: string; months: number; days: number }) => void;
}

// دالة تنظيف وتوحيد المدخلات الرقمية لدعم الفواصل العربية والنقاط
function normalizeArabicDecimal(val: string): string {
  if (!val) return '';
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let cleaned = val;
  for (let i = 0; i < 10; i++) {
    cleaned = cleaned.replaceAll(arabicDigits[i], String(i));
  }
  // استبدال الفواصل العربية والإنجليزية بالنقطة العشرية
  cleaned = cleaned.replace(/[،,٫]/g, '.');
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('');
  }
  return cleaned.replace(/[^0-9.]/g, '');
}

// اقتراح اسم عربي فصيح للمدة بناء على الأشهر والأيام
function suggestArabicName(months: number, days: number): string {
  if (months === 0.5 || days === 15) return 'نصف شهر';
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

const PRESET_OPTIONS = [
  { name: 'شهر ونصف', months: 1.5, days: 45 },
  { name: 'شهران ونصف', months: 2.5, days: 75 },
  { name: 'ثلاثة أشهر ونصف', months: 3.5, days: 105 },
  { name: 'ستة أشهر ونصف', months: 6.5, days: 195 },
  { name: 'ثمانية أشهر ونصف', months: 8.5, days: 255 },
  { name: 'سنة ونصف', months: 18, days: 548 },
  { name: 'سنتان', months: 24, days: 730 },
];

export function DurationEditor({ name, months, days, onChange }: Props) {
  const id = useId();

  // تحديد الوحدة الأولية
  const initialUnit: Unit = months >= 12 && months % 12 === 0 ? 'years' : months > 0 ? 'months' : 'days';
  const initialAmount = String(
    initialUnit === 'years' ? months / 12 : initialUnit === 'months' ? months : days || 30
  );

  const [unit, setUnit] = useState<Unit>(initialUnit);
  const [amount, setAmount] = useState<string>(initialAmount);

  // تحديث القيمة عند تغيير الحقل
  const handleAmountChange = (raw: string) => {
    const cleaned = normalizeArabicDecimal(raw);
    setAmount(cleaned);

    const num = parseFloat(cleaned);
    if (!isNaN(num) && num > 0) {
      let computedMonths = 0;
      let computedDays = 0;

      if (unit === 'years') {
        computedMonths = num * 12;
        computedDays = Math.round(num * 365);
      } else if (unit === 'months') {
        computedMonths = Number(num.toFixed(2));
        computedDays = Math.round(num * 30);
      } else {
        computedDays = Math.round(num);
        computedMonths = Number((num / 30).toFixed(2));
      }

      const autoName = suggestArabicName(computedMonths, computedDays);
      const shouldUpdateName = !name || name === suggestArabicName(months, days);

      onChange({
        name: shouldUpdateName && autoName ? autoName : name,
        months: computedMonths,
        days: computedDays,
      });
    } else {
      onChange({
        name,
        months: 0,
        days: 0,
      });
    }
  };

  // تغيير الوحدة (يوم / شهر / سنة)
  const handleUnitChange = (nextUnit: Unit) => {
    setUnit(nextUnit);
    const num = parseFloat(amount);
    if (!isNaN(num) && num > 0) {
      let computedMonths = 0;
      let computedDays = 0;

      if (nextUnit === 'years') {
        computedMonths = num * 12;
        computedDays = Math.round(num * 365);
      } else if (nextUnit === 'months') {
        computedMonths = Number(num.toFixed(2));
        computedDays = Math.round(num * 30);
      } else {
        computedDays = Math.round(num);
        computedMonths = Number((num / 30).toFixed(2));
      }

      const autoName = suggestArabicName(computedMonths, computedDays);
      const shouldUpdateName = !name || name === suggestArabicName(months, days);

      onChange({
        name: shouldUpdateName && autoName ? autoName : name,
        months: computedMonths,
        days: computedDays,
      });
    }
  };

  // اختيار نموذج سريع
  const selectPreset = (preset: { name: string; months: number; days: number }) => {
    setUnit('months');
    setAmount(String(preset.months));
    onChange({
      name: preset.name,
      months: preset.months,
      days: preset.days,
    });
  };

  const suggestedName = suggestArabicName(months, days);

  return (
    <div dir="rtl" className="space-y-4 py-1">
      {/* نماذج سريعة وبسيطة (Pills) بدون أي تداخل نصوص */}
      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          نماذج مدد شائعة (اختر مباشرة أو أدخل أدناه):
        </span>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_OPTIONS.map((p) => {
            const isSelected = days === p.days && (name === p.name || months === p.months);
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => selectPreset(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-background hover:bg-muted/70 border-border text-foreground'
                }`}
              >
                {p.name} <span className="opacity-70 text-[10px]">({p.days} يوم)</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* حقل اسم المدة */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor={`${id}-name`} className="text-sm font-bold">اسم المدة</Label>
          {suggestedName && suggestedName !== name && (
            <button
              type="button"
              onClick={() => onChange({ name: suggestedName, months, days })}
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="h-3 w-3" />
              <span>استخدام: {suggestedName}</span>
            </button>
          )}
        </div>
        <Input
          id={`${id}-name`}
          value={name}
          onChange={(e) => onChange({ name: e.target.value, months, days })}
          placeholder="مثال: شهر ونصف، ثمانية أشهر ونصف..."
          className="h-11 rounded-xl text-sm font-semibold"
          maxLength={80}
        />
        <p className="text-[11px] text-muted-foreground">
          يظهر هذا الاسم في قوائم الأسعار والعقود والطباعة.
        </p>
      </div>

      {/* إدخال القيمة والوحدة (يقبل الكسور العشرية مثل 1.5 و 8.5 بكل سلاسة) */}
      <div className="space-y-2">
        <Label htmlFor={`${id}-amount`} className="text-sm font-bold">كم تستمر هذه المدة؟</Label>
        <div className="flex items-center gap-2">
          <div className="w-32 shrink-0">
            <Input
              id={`${id}-amount`}
              type="text"
              inputMode="decimal"
              dir="ltr"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="1.5 أو 8.5"
              className="h-11 rounded-xl text-center text-lg font-bold"
            />
          </div>

          <div
            className="flex flex-1 rounded-xl border border-border bg-muted/40 p-1"
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
                onClick={() => handleUnitChange(uKey)}
                className={`flex-1 py-1.5 px-3 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                  unit === uKey
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:bg-background hover:text-foreground'
                }`}
              >
                {uLabel}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {unit === 'months'
            ? '💡 يمكنك كتابة أرقام عشرية بحرية مثل: 1.5 (شهر ونصف) أو 8.5 (ثمانية أشهر ونصف).'
            : unit === 'years'
            ? '💡 تُحسب السنة 365 يوماً (أدخل 1.5 لسنة ونصف أو 2 لسنتين).'
            : '💡 أدخل عدد الأيام الفعلي مباشرة (مثل 45 أو 255 يوماً).'}
        </p>
      </div>

      {/* بطاقة ملخص المدة */}
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="text-[11px] font-semibold text-muted-foreground">ملخص المدة المعتمدة:</div>
          <div className="text-sm font-bold text-foreground">
            {name.trim() || suggestedName || 'يرجى إدخال المدة'}
          </div>
        </div>
        <div className="text-left font-mono">
          <div className="text-xl font-black text-primary leading-none">
            {Number.isFinite(days) && days > 0 ? days.toLocaleString('ar-LY') : '0'}
            <span className="text-xs font-normal text-muted-foreground mr-1">يوماً</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            ({months} {months === 1 ? 'شهر' : 'أشهر'})
          </div>
        </div>
      </div>
    </div>
  );
}
