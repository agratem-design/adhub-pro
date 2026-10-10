import type { ComponentType, ReactNode } from 'react';
import { Switch } from '@/components/ui/switch';
import { EditSection } from './ui';

/** بطاقة خدمة موحدة (التركيب، الطباعة): تفعيل، تفصيل حسب المقاس، الإجمالي */
export function ServiceCostCard({
  icon, title, description, enabled, onToggle, rows, total, currencySymbol, emptyText, disabledText, extra,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  rows: { label: ReactNode; sub?: ReactNode; value: number }[];
  total: number;
  currencySymbol: string;
  emptyText: string;
  disabledText: string;
  /** حقول إضافية (مثل سعر المتر للطباعة) */
  extra?: ReactNode;
}) {
  const fmt = (n: number) => Math.round(Number(n || 0)).toLocaleString('ar-LY');
  return (
    <EditSection
      icon={icon}
      title={title}
      description={description}
      actions={<Switch checked={enabled} onCheckedChange={onToggle} aria-label={`تفعيل ${title}`} />}
      flush
    >
      {!enabled ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">{disabledText}</p>
      ) : (
        <>
          {extra && <div className="border-b border-border p-4">{extra}</div>}
          {rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
          ) : (
            <ul className="max-h-56 divide-y divide-border overflow-y-auto">
              {rows.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium">{r.label}</span>
                    {r.sub && <span className="block text-xs text-muted-foreground">{r.sub}</span>}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{fmt(r.value)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between border-t border-border bg-primary/5 px-4 py-2.5">
            <span className="text-sm font-semibold">الإجمالي</span>
            <span className="font-manrope text-base font-extrabold tabular-nums text-primary">{fmt(total)} {currencySymbol}</span>
          </div>
        </>
      )}
    </EditSection>
  );
}
