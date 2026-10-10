import { Settings } from 'lucide-react';
import { EditSection } from './ui';

/** رسوم التشغيل: جدول واحد للوحات العادية والمشاركة والشركات الصديقة */
export function OperatingFeesCard({
  showRegular, regularBase, regularRate, setRegularRate, regularFee,
  showPartnership, partnershipBase, partnershipRate, setPartnershipRate, partnershipFee,
  friendFee, friendRate, currencySymbol, className,
}: {
  showRegular: boolean;
  regularBase: number;
  regularRate: number;
  setRegularRate: (v: number) => void;
  regularFee: number;
  showPartnership: boolean;
  partnershipBase: number;
  partnershipRate: number;
  setPartnershipRate: (v: number) => void;
  partnershipFee: number;
  friendFee: number;
  friendRate: number;
  currencySymbol: string;
  className?: string;
}) {
  if (!showRegular && !showPartnership && friendFee <= 0) return null;
  const fmt = (n: number) => Number(n || 0).toLocaleString('ar-LY', { maximumFractionDigits: 2 });
  const total = (showRegular ? regularFee : 0) + (showPartnership ? partnershipFee : 0) + friendFee;
  const rateInput = (value: number, onChange: (v: number) => void, label: string) => (
    <div className="relative w-24">
      <input
        type="number"
        aria-label={label}
        value={value}
        onChange={e => onChange(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value) || 0))}
        className="h-9 w-full rounded-lg border border-input bg-background px-2 pl-6 text-center text-sm font-semibold focus:border-primary focus:outline-none"
        min="0" max="100" step="0.1"
      />
      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
    </div>
  );
  return (
    <EditSection
      icon={Settings}
      title="رسوم التشغيل"
      description="نسبة من صافي الإيجار، تُحفظ في العقد"
      actions={<span className="font-manrope text-base font-extrabold tabular-nums text-primary">{fmt(total)} {currencySymbol}</span>}
      flush
      className={className}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-right font-medium">النوع</th>
              <th className="px-4 py-2 text-right font-medium">أساس الاحتساب</th>
              <th className="px-4 py-2 text-right font-medium">النسبة</th>
              <th className="px-4 py-2 text-left font-medium">الرسوم</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {showRegular && (
              <tr>
                <td className="px-4 py-2.5 font-medium">اللوحات العادية</td>
                <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{fmt(regularBase)} <span className="text-xs">صافي الإيجار</span></td>
                <td className="px-4 py-2">{rateInput(regularRate, setRegularRate, 'نسبة رسوم اللوحات العادية')}</td>
                <td className="px-4 py-2.5 text-left font-semibold tabular-nums">{fmt(regularFee)}</td>
              </tr>
            )}
            {showPartnership && (
              <tr>
                <td className="px-4 py-2.5 font-medium">لوحات المشاركة</td>
                <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{fmt(partnershipBase)} <span className="text-xs">إيجار المشاركة</span></td>
                <td className="px-4 py-2">{rateInput(partnershipRate, setPartnershipRate, 'نسبة رسوم لوحات المشاركة')}</td>
                <td className="px-4 py-2.5 text-left font-semibold tabular-nums">{fmt(partnershipFee)}</td>
              </tr>
            )}
            {friendFee > 0 && (
              <tr>
                <td className="px-4 py-2.5 font-medium">الشركات الصديقة</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">تُضبط من قسم إيجارات الشركات</td>
                <td className="px-4 py-2.5 tabular-nums">{friendRate}%</td>
                <td className="px-4 py-2.5 text-left font-semibold tabular-nums">{fmt(friendFee)}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-primary/5">
              <td className="px-4 py-2.5 font-bold" colSpan={3}>الإجمالي</td>
              <td className="px-4 py-2.5 text-left font-bold tabular-nums text-primary">{fmt(total)} {currencySymbol}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </EditSection>
  );
}
