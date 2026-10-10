import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, Layers } from 'lucide-react';
import type { Billboard } from '@/types';
import { cn } from '@/lib/utils';
import { EditSection } from './ui';

interface LevelDiscountsCardProps {
  selectedBillboards: Billboard[];
  levelDiscounts: Record<string, number>;
  setLevelDiscounts: (discounts: Record<string, number>) => void;
  currencySymbol?: string;
  calculateBillboardPrice: (billboard: Billboard) => number;
  sizeNames?: Map<number, string>;
}

interface LevelSummary {
  level: string;
  billboards: { id: string; name: string; size: string; price: number }[];
  totalPrice: number;
  discountPercent: number;
  discountAmount: number;
  priceAfterDiscount: number;
}

const fmt = (n: number) => Math.round(Number(n || 0)).toLocaleString('ar-LY');

/** تخفيض بنسبة لكل مستوى لوحات: جدول واحد، والضغط على الصف يعرض لوحاته */
export function LevelDiscountsCard({
  selectedBillboards, levelDiscounts, setLevelDiscounts, currencySymbol = 'د.ل', calculateBillboardPrice, sizeNames = new Map(),
}: LevelDiscountsCardProps) {
  const [expandedLevel, setExpandedLevel] = useState<string | null>(null);

  const levelSummaries = useMemo<LevelSummary[]>(() => {
    const getDisplaySize = (b: any): string => {
      const sizeId = b.size_id || b.Size_ID;
      if (sizeId && sizeNames.has(sizeId)) return sizeNames.get(sizeId)!;
      return b.size || b.Size || 'غير محدد';
    };
    const map = new Map<string, LevelSummary>();
    selectedBillboards.forEach((b) => {
      const level = (b as any).Level || (b as any).level || 'غير محدد';
      const price = calculateBillboardPrice(b);
      const info = { id: String((b as any).ID), name: (b as any).Billboard_Name || (b as any).name || '', size: getDisplaySize(b), price };
      const cur = map.get(level);
      if (cur) { cur.billboards.push(info); cur.totalPrice += price; }
      else map.set(level, { level, billboards: [info], totalPrice: price, discountPercent: 0, discountAmount: 0, priceAfterDiscount: price });
    });
    map.forEach((s, level) => {
      const pct = levelDiscounts[level] || 0;
      s.discountPercent = pct;
      s.discountAmount = s.totalPrice * (pct / 100);
      s.priceAfterDiscount = s.totalPrice - s.discountAmount;
    });
    return Array.from(map.values()).sort((a, b) => a.level.localeCompare(b.level));
  }, [selectedBillboards, calculateBillboardPrice, levelDiscounts, sizeNames]);

  const handleDiscountChange = (level: string, value: number) => {
    const next = { ...levelDiscounts };
    if (value > 0) next[level] = Math.min(100, Math.max(0, value));
    else delete next[level];
    setLevelDiscounts(next);
  };

  const totals = useMemo(() => levelSummaries.reduce(
    (acc, s) => ({ before: acc.before + s.totalPrice, discount: acc.discount + s.discountAmount }),
    { before: 0, discount: 0 },
  ), [levelSummaries]);

  if (levelSummaries.length === 0) return null;

  return (
    <EditSection
      icon={Layers}
      title="تخفيض حسب المستوى"
      description="نسبة تخفيض على كل لوحات المستوى نفسه"
      actions={totals.discount > 0 ? (
        <span className="rounded-md bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-500">
          <span dir="ltr">−{fmt(totals.discount)}</span> {currencySymbol}
        </span>
      ) : undefined}
      flush
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-right font-medium">المستوى</th>
              <th className="px-4 py-2 text-right font-medium">الإيجار</th>
              <th className="px-4 py-2 text-right font-medium">التخفيض</th>
              <th className="px-4 py-2 text-left font-medium">بعد التخفيض</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {levelSummaries.map((s) => {
              const open = expandedLevel === s.level;
              const sizes = Array.from(new Set(s.billboards.map(b => b.size)));
              return (
                <Fragment key={s.level}>
                  <tr key={s.level} className="cursor-pointer hover:bg-muted/20" onClick={() => setExpandedLevel(open ? null : s.level)}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 font-manrope text-sm font-bold text-primary">{s.level}</span>
                        <span className="min-w-0">
                          <span className="block text-xs text-muted-foreground">{s.billboards.length} لوحة</span>
                          <span className="block truncate text-xs text-muted-foreground" dir="ltr">{sizes.join(' · ')}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">{fmt(s.totalPrice)}</td>
                    <td className="px-4 py-2" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <div className="relative w-20">
                          <input
                            type="number" min="0" max="100" step="0.5"
                            aria-label={`نسبة تخفيض المستوى ${s.level}`}
                            value={s.discountPercent || ''}
                            placeholder="0"
                            onChange={e => handleDiscountChange(s.level, Number(e.target.value))}
                            className="h-9 w-full rounded-lg border border-input bg-background px-2 pl-6 text-center text-sm font-semibold focus:border-primary focus:outline-none"
                          />
                          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                        </div>
                        {s.discountAmount > 0 && <span dir="ltr" className="text-xs font-semibold tabular-nums text-rose-500">−{fmt(s.discountAmount)}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-left font-semibold tabular-nums">{fmt(s.priceAfterDiscount)}</td>
                  </tr>
                  {open && (
                    <tr key={`${s.level}-items`} className="bg-muted/10">
                      <td colSpan={4} className="px-4 py-2">
                        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                          {s.billboards.map(b => (
                            <li key={b.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
                              <span className="min-w-0 truncate"><span className="font-medium">{b.name}</span> <span className="text-muted-foreground" dir="ltr">{b.size}</span></span>
                              <span className="shrink-0 tabular-nums">{fmt(b.price)} {currencySymbol}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          {totals.discount > 0 && (
            <tfoot>
              <tr className="border-t border-border bg-primary/5 font-semibold">
                <td className="px-4 py-2.5">الإجمالي</td>
                <td className="px-4 py-2.5 tabular-nums">{fmt(totals.before)}</td>
                <td className="px-4 py-2.5 tabular-nums text-rose-500"><span dir="ltr">−{fmt(totals.discount)}</span></td>
                <td className="px-4 py-2.5 text-left tabular-nums text-primary">{fmt(totals.before - totals.discount)} {currencySymbol}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </EditSection>
  );
}
