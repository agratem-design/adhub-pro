import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, Coins, ExternalLink, History, List, Loader2, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { EditSection, Field, Segmented } from './ui';

/** مصدر الأسعار (الجدول / المعاملات، المحفوظة / الحالية) والعملة وسعر الصرف */
export function PricingSettingsCard({
  useFactorsPricing, setUseFactorsPricing, useStoredPrices, setUseStoredPrices, hasStoredPrices,
  refreshing, onRefreshFromTable, currency, setCurrency, exchangeRate, setExchangeRate, currencies, currencySymbol,
}: {
  useFactorsPricing: boolean;
  setUseFactorsPricing: (v: boolean) => void;
  useStoredPrices: boolean;
  setUseStoredPrices: (v: boolean) => void;
  hasStoredPrices: boolean;
  refreshing: boolean;
  onRefreshFromTable: () => void;
  currency: string;
  setCurrency: (v: string) => void;
  exchangeRate: number;
  setExchangeRate: (v: number) => void;
  currencies: { code: string; symbol: string; name: string }[];
  currencySymbol: string;
}) {
  return (
    <EditSection icon={SlidersHorizontal} title="إعدادات التسعير" description="مصدر الأسعار وعملة العقد">
      <Field label="نظام التسعير">
        <Segmented
          value={useFactorsPricing ? 'factors' : 'table'}
          onChange={v => setUseFactorsPricing(v === 'factors')}
          options={[
            { value: 'table', label: 'جدول الأسعار', icon: List },
            { value: 'factors', label: 'نظام المعاملات', icon: Calculator },
          ]}
        />
      </Field>

      {!useFactorsPricing ? (
        <div className="rounded-lg border border-border">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium">مصدر الأسعار</p>
              <p className="text-xs text-muted-foreground">{useStoredPrices ? 'الأسعار المحفوظة في العقد (لا تتغير بتغير الجدول)' : 'من جدول التسعير الحالي'}</p>
            </div>
            <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${useStoredPrices ? 'bg-amber-500/15 text-amber-500' : 'bg-emerald-500/15 text-emerald-500'}`}>
              {useStoredPrices ? 'محفوظة' : 'محدّثة'}
            </span>
          </div>
          <div className="border-t border-border p-2">
            {useStoredPrices ? (
              <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={onRefreshFromTable} disabled={refreshing}>
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                تحديث الأسعار من الجدول الحالي
              </Button>
            ) : hasStoredPrices ? (
              <Button variant="ghost" size="sm" className="w-full gap-1.5 text-muted-foreground" onClick={() => setUseStoredPrices(true)}>
                <History className="h-4 w-4" />الرجوع إلى الأسعار المحفوظة
              </Button>
            ) : (
              <p className="px-1 py-1 text-xs text-muted-foreground">الأسعار تُحفظ مع العقد عند الحفظ.</p>
            )}
          </div>
        </div>
      ) : (
        <a href="/admin/pricing-factors" target="_blank" rel="noreferrer"
          className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm hover:bg-muted">
          <span>إدارة المعاملات والأسعار الأساسية</span>
          <ExternalLink className="h-4 w-4 text-muted-foreground" />
        </a>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="عملة العقد" icon={Coins}>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="h-10"><SelectValue placeholder="اختر العملة" /></SelectTrigger>
            <SelectContent className="z-[10000]">
              {currencies.map(c => <SelectItem key={c.code} value={c.code}>{c.symbol} — {c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="سعر الصرف" hint={currency !== 'LYD' ? `1 د.ل = ${exchangeRate} ${currencySymbol}` : undefined}>
          <Input type="number" min="0" step="0.01" value={exchangeRate}
            onChange={e => setExchangeRate(Number(e.target.value) || 1)} className="h-10 text-center tabular-nums" />
        </Field>
      </div>
    </EditSection>
  );
}
