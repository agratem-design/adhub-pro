import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isCustomDuration } from '@/utils/pricingDuration';
import { relativeCompanyPrice } from '@/utils/relativeCompanyPrice';
import { computeRelativePricingPlan, PricingPeriod, PricingRow } from '@/utils/pricingRelativeCalculator';
import { Layers, Percent, ArrowUpDown } from 'lucide-react';

export interface LevelOption {
  code: string;
  name?: string;
}

export interface CompanyPriceEditorProps {
  target: { customer: string; size?: string; level?: string };
  categories: string[];
  records: PricingRow[];
  periods: PricingPeriod[];
  level: string;
  levels?: LevelOption[];
  month: string;
  sizes: { id: number; name: string; sort_order?: number | null }[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function CompanyPriceEditor({
  target,
  categories,
  records,
  periods,
  level,
  levels = [],
  month,
  sizes,
  onClose,
  onSaved,
}: CompanyPriceEditorProps) {
  const [customer, setCustomer] = useState(target.customer || 'شركات');
  const isCompany = customer === 'شركات';

  const [targetLevel, setTargetLevel] = useState<string>(target.level || level || levels[0]?.code || 'A');
  const [referenceLevel, setReferenceLevel] = useState<string>(() => {
    const curLevel = target.level || level;
    const others = levels.filter(l => l.code !== curLevel);
    if (others.some(l => l.code === 'A')) return 'A';
    if (others.length > 0) return others[0].code;
    return '__SAME__';
  });

  const [mode, setMode] = useState<'discount' | 'increase' | 'zero'>('discount');
  const [percent, setPercent] = useState('10');
  const [scope, setScope] = useState<string>(() => {
    if (target.size) return 'single_current';
    return 'current';
  });
  const [busy, setBusy] = useState(false);

  const rate = Number(percent);
  const valid = mode === 'zero' || (percent.trim() !== '' && Number.isFinite(rate) && rate >= 0 && (mode !== 'discount' || rate <= 100));

  const currentPeriodLabel = periods.find(p => p.key === month)?.label || month;

  // Auto-switch referenceLevel if it matches targetLevel
  const handleTargetLevelChange = (newTarget: string) => {
    setTargetLevel(newTarget);
    if (referenceLevel === newTarget) {
      const other = levels.find(l => l.code !== newTarget);
      setReferenceLevel(other ? other.code : '__SAME__');
    }
  };

  const { plan, changes, skipped } = useMemo(() => {
    return computeRelativePricingPlan({
      customer,
      targetLevel,
      referenceLevel,
      records,
      periods,
      scope,
      month,
      targetSize: target.size,
      mode,
      rate,
      valid,
      sizes,
    });
  }, [customer, targetLevel, referenceLevel, records, periods, scope, month, target.size, mode, rate, valid, sizes]);

  const save = async () => {
    if (busy || !valid || !customer || !changes.length) return;
    setBusy(true);
    let saved = 0;
    try {
      const groups = new Map<string, typeof changes>();
      changes.forEach(change => {
        const key = JSON.stringify([change.size, change.level]);
        groups.set(key, [...(groups.get(key) || []), change]);
      });

      for (const group of groups.values()) {
        const first = group[0];
        const { data: current, error: readError } = await supabase
          .from('pricing')
          .select('*')
          .eq('size', first.size)
          .eq('billboard_level', first.level)
          .eq('customer_category', customer)
          .maybeSingle();

        if (readError) throw readError;

        const patch: Record<string, any> = {};
        for (const change of group) {
          if (isCustomDuration(change.period.dbColumn)) {
            patch.duration_prices = {
              ...(patch.duration_prices || current?.duration_prices || {}),
              [change.period.dbColumn]: change.after,
            };
          } else {
            patch[change.period.dbColumn] = change.after;
          }
        }

        const response = current
          ? await supabase.from('pricing').update(patch).eq('id', current.id)
          : await supabase.from('pricing').insert({
              size: first.size,
              billboard_level: first.level,
              customer_category: customer,
              size_id: sizes.find(s => s.name === first.size)?.id ?? null,
              ...patch,
            });

        if (response.error) throw response.error;
        saved += group.length;
      }

      toast.success(
        isCompany
          ? `تم حفظ ${saved} سعر للمستوى ${targetLevel} في فئة الشركات`
          : `تم حفظ ${saved} سعر لفئة ${customer}`
      );
      onClose();
    } catch (error: any) {
      toast.error(`تم حفظ ${saved} سعر ثم توقف الحفظ: ${error.message || 'تعذر الاتصال'}. راجع القيم قبل إعادة المحاولة.`);
    } finally {
      await onSaved();
      setBusy(false);
    }
  };

  const previewExample = valid ? relativeCompanyPrice(1000, mode, rate)?.toLocaleString('ar-LY') : '—';

  return (
    <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
      <DialogContent dir="rtl" className="max-w-4xl flex flex-col max-h-[92dvh] [&_button]:cursor-pointer">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Percent className="h-5 w-5 text-primary" />
            {target.size
              ? (isCompany
                  ? `تسعير المقاس ${target.size} · فئة الشركات (المستوى ${targetLevel})`
                  : `تسعير المقاس ${target.size} · فئة ${customer}`)
              : (isCompany
                  ? `تسعير المستوى ${targetLevel} في فئة الشركات`
                  : `تسعير فئة ${customer} مقارنة بالشركات`)}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {isCompany
              ? `تعديل أسعار المستوى ${targetLevel} كنسبة تخفيض أو زيادة استناداً إلى مستوى آخر أو السعر الحالي لنفس المستوى.`
              : 'الحساب من سعر الشركات لنفس المقاس والمستوى والمدة. نسبة 0% تعني نفس سعر الشركات، والتصفير يجعل السعر 0 د.ل.'}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto min-h-0 space-y-4 py-2">
          {/* Controls row */}
          {isCompany ? (
            <div className="grid sm:grid-cols-3 gap-3 rounded-xl border border-border p-3 bg-muted/20">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  المستوى المطلوب تسعيره
                </Label>
                <Select
                  value={targetLevel}
                  onValueChange={handleTargetLevelChange}
                  disabled={busy || (!!target.size && !!target.level)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="اختر المستوى" />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map(l => (
                      <SelectItem key={l.code} value={l.code}>
                        المستوى {l.code} {l.name && l.name !== l.code ? `(${l.name})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold flex items-center gap-1.5">
                  <ArrowUpDown className="h-3.5 w-3.5 text-primary" />
                  المستوى المرجعي للحساب
                </Label>
                <Select
                  value={referenceLevel}
                  onValueChange={setReferenceLevel}
                  disabled={busy}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="اختر المرجع" />
                  </SelectTrigger>
                  <SelectContent>
                    {levels
                      .filter(l => l.code !== targetLevel)
                      .map(l => (
                        <SelectItem key={l.code} value={l.code}>
                          المستوى {l.code} {l.name && l.name !== l.code ? `(${l.name})` : ''}
                        </SelectItem>
                      ))}
                    <SelectItem value="__SAME__">
                      نفس المستوى {targetLevel} (الأسعار الحالية)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">نطاق التطبيق</Label>
                <Select value={scope} onValueChange={setScope} disabled={busy}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {target.size ? (
                      <>
                        <SelectItem value="single_current">المقاس {target.size} · {currentPeriodLabel}</SelectItem>
                        <SelectItem value="single_all">المقاس {target.size} · جميع المدد</SelectItem>
                        <SelectItem value="level_all">المستوى {targetLevel} كامل · جميع المقاسات والمدد</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="current">المستوى {targetLevel} · {currentPeriodLabel}</SelectItem>
                        <SelectItem value="all">المستوى {targetLevel} · جميع المدد</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4 rounded-xl border border-border p-3 bg-muted/20">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">الفئة المطلوب تعديلها</Label>
                <Select value={customer} onValueChange={setCustomer} disabled={busy || !!target.size}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="اختر الفئة" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c !== 'شركات').map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">نطاق التعديل</Label>
                <Select value={scope} onValueChange={setScope} disabled={busy || !!target.size}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">المستوى {level} · {currentPeriodLabel}</SelectItem>
                    <SelectItem value="level">المستوى {level} · جميع المدد</SelectItem>
                    <SelectItem value="all">الفئة كاملة · جميع المستويات والمدد</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Mode selector */}
          <div className="space-y-2">
            <Label className="text-xs font-bold">نوع التعديل</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy}
                variant={mode === 'discount' ? 'default' : 'outline'}
                aria-pressed={mode === 'discount'}
                onClick={() => setMode('discount')}
                className="h-9"
              >
                {isCompany && referenceLevel !== '__SAME__'
                  ? `تخفيض من المستوى ${referenceLevel}`
                  : 'تخفيض'}
              </Button>
              <Button
                type="button"
                disabled={busy}
                variant={mode === 'increase' ? 'default' : 'outline'}
                aria-pressed={mode === 'increase'}
                onClick={() => setMode('increase')}
                className="h-9"
              >
                {isCompany && referenceLevel !== '__SAME__'
                  ? `زيادة عن المستوى ${referenceLevel}`
                  : 'زيادة'}
              </Button>
              <Button
                type="button"
                disabled={busy}
                variant={mode === 'zero' ? 'default' : 'outline'}
                aria-pressed={mode === 'zero'}
                onClick={() => setMode('zero')}
                className="h-9"
              >
                تصفير الأسعار (0 د.ل)
              </Button>
            </div>
          </div>

          {/* Percentage field */}
          {mode !== 'zero' && (
            <div className="space-y-2 rounded-xl border border-border p-3 bg-muted/10">
              <Label htmlFor="pricing-percentage" className="text-sm font-bold">
                نسبة {mode === 'discount' ? 'التخفيض' : 'الزيادة'}{' '}
                {isCompany
                  ? (referenceLevel === '__SAME__' ? 'عن السعر الحالي' : `مقارنة بالمستوى ${referenceLevel}`)
                  : 'من سعر الشركات'}{' '}
                (%)
              </Label>
              <Input
                id="pricing-percentage"
                type="number"
                min={0}
                max={mode === 'discount' ? 100 : undefined}
                step="0.1"
                value={percent}
                disabled={busy}
                onChange={e => setPercent(e.target.value)}
                className="max-w-xs h-10 font-bold"
              />
              <p className="text-xs text-muted-foreground">
                مثال: إذا كان سعر المرجع 1,000 د.ل ← السعر الجديد سيكون{' '}
                <span className="font-bold text-foreground">{previewExample}</span> د.ل. (التقريب لأقرب دينار).
              </p>
            </div>
          )}

          {!valid && (
            <p role="alert" className="text-destructive text-sm font-medium">
              أدخل نسبة صحيحة غير سالبة؛ التخفيض لا يتجاوز 100%.
            </p>
          )}

          {/* Preview summary and table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">
                معاينة الأسعار: <span className="text-primary">{changes.length} سعر سيتغير</span>
                {skipped > 0 && (
                  <span className="font-normal text-muted-foreground text-xs mr-2">
                    (تم استبعاد {skipped} سعر لعدم توفر سعر مرجعي صالح)
                  </span>
                )}
              </p>
            </div>

            <div className="max-h-64 overflow-auto rounded-xl border border-border">
              <table className="w-full text-sm text-right">
                <thead className="sticky top-0 bg-muted border-b border-border">
                  <tr>
                    <th className="p-2.5 font-bold w-12 text-center">#</th>
                    <th className="p-2.5 font-bold">المقاس / المستوى</th>
                    <th className="p-2.5 font-bold">المدة</th>
                    <th className="p-2.5 font-bold">المرجع</th>
                    <th className="p-2.5 font-bold">السعر الحالي</th>
                    <th className="p-2.5 font-bold">السعر الجديد</th>
                    <th className="p-2.5 font-bold">الفارق</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        لا توجد أسعار ستتغير وفق الخيارات الحالية.
                      </td>
                    </tr>
                  ) : (
                    changes.map((p, i) => {
                      const isNew = p.before == null;
                      return (
                        <tr key={i} className="border-t border-border hover:bg-muted/30 transition-colors">
                          <td className="p-2.5 text-xs text-muted-foreground tabular-nums text-center">{i + 1}</td>
                          <td className="p-2.5 font-medium">
                            <bdi>{p.size}</bdi>
                            <span className="text-xs text-muted-foreground font-normal"> / {p.level}</span>
                            {p.sizeOrder != null && p.sizeOrder < 999 && (
                              <span className="text-[10px] text-muted-foreground/75 bg-muted px-1.5 py-0.5 rounded mr-1.5 inline-block font-normal">
                                رتبة {p.sizeOrder}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5">{p.period.label}</td>
                          <td className="p-2.5 tabular-nums text-muted-foreground">
                            {p.base != null ? `${p.base.toLocaleString('ar-LY')} د.ل` : '—'}
                            <span className="block text-[10px] text-muted-foreground/70">{p.referenceLabel}</span>
                          </td>
                          <td className="p-2.5 tabular-nums">
                            {p.before != null ? `${p.before.toLocaleString('ar-LY')} د.ل` : <span className="text-xs text-muted-foreground">غير محدد</span>}
                          </td>
                          <td className="p-2.5 tabular-nums font-bold text-primary">
                            {p.after != null ? `${p.after.toLocaleString('ar-LY')} د.ل` : '—'}
                          </td>
                          <td className="p-2.5 tabular-nums text-xs">
                            {isNew ? (
                              <span className="text-primary font-semibold">سعر جديد</span>
                            ) : p.diff == null || p.diff === 0 ? (
                              <span className="text-muted-foreground">بدون تغيير</span>
                            ) : p.diff > 0 ? (
                              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                +{p.diff.toLocaleString('ar-LY')} د.ل
                              </span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                {p.diff.toLocaleString('ar-LY')} د.ل
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground">
              {isCompany
                ? 'الأسعار المحفوظة ستسري على فئة الشركات للمستوى المحدد. المرجع يُستخدم في حساب القيم فقط.'
                : 'القيم المعروضة بالدينار الليبي. ستُستبدل أسعار الفئة بالقيم الجديدة الظاهرة.'}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
          <Button
            type="button"
            disabled={busy || !valid || !customer || !changes.length}
            onClick={save}
            className="font-bold cursor-pointer"
          >
            {busy ? 'جارٍ حفظ الأسعار...' : `حفظ ${changes.length} سعر`}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onClose}
            className="cursor-pointer"
          >
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
