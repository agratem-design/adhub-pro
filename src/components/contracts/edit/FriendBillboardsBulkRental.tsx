import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Building2 } from 'lucide-react';
import type { Billboard } from '@/types';
import { BillboardImageZoom } from './BillboardImageZoom';
import { Button } from '@/components/ui/button';
import { allocateMoney, money } from '@/utils/contractEditMoney';
import { quoteFriendRental, type FriendRentalBoard, type FriendRentalSnapshot, type FriendPricingRow, type FriendPricingPeriod } from '@/utils/friendRentalPricing';

interface FriendBillboardCost {
  billboardId: string;
  friendCompanyId: string;
  friendCompanyName: string;
  friendRentalCost: number;
  pricingSnapshot?: FriendRentalSnapshot;
}
interface FriendBillboardsBulkRentalProps {
  billboardDetails?: Billboard[];
  customerRentalByBillboard?: ReadonlyMap<string, { netRentalAfterDiscount: number; totalForBoard: number; installationPrice: number; printCost: number }>;
  includesPrint?: boolean;
  onIncludesPrintChange?: (value: boolean) => void;
  installationEnabled?: boolean;
  printEnabled?: boolean;
  friendBillboards: FriendRentalBoard[];
  friendBillboardCosts: FriendBillboardCost[];
  onUpdateFriendCost: (billboardId: string, friendCompanyId: string, friendCompanyName: string, cost: number, snapshot?: FriendRentalSnapshot) => void;
  pricingData?: FriendPricingRow[];
  pricingPeriod?: FriendPricingPeriod;
  includesInstallation: boolean;
  onIncludesInstallationChange: (includes: boolean) => void;
  currencySymbol?: string;
  operatingFeeEnabled?: boolean;
  operatingFeeRate?: number;
  onOperatingFeeEnabledChange?: (enabled: boolean) => void;
  onOperatingFeeRateChange?: (rate: number) => void;
  operatingFeeAmount?: number;
}

export function FriendBillboardsBulkRental({ friendBillboards, friendBillboardCosts, onUpdateFriendCost, pricingData = [], pricingPeriod, customerRentalByBillboard, billboardDetails = [],
  includesInstallation, onIncludesInstallationChange, includesPrint = false, onIncludesPrintChange, installationEnabled = true, printEnabled = false, currencySymbol = 'د.ل', operatingFeeEnabled = false,
  operatingFeeRate = 3, onOperatingFeeEnabledChange, onOperatingFeeRateChange, operatingFeeAmount = 0 }: FriendBillboardsBulkRentalProps) {
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [manualTotals, setManualTotals] = useState<Record<string, string>>({});
  const costs = new Map(friendBillboardCosts.map(row => [row.billboardId, row]));
  const companies = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; boards: FriendRentalBoard[] }>();
    for (const board of friendBillboards) {
      if (!groups.has(board.friendCompanyId)) groups.set(board.friendCompanyId, { id: board.friendCompanyId, name: board.friendCompanyName || 'شركة صديقة', boards: [] });
      groups.get(board.friendCompanyId)!.boards.push(board);
    }
    return Array.from(groups.values());
  }, [friendBillboards]);
  const categoryOptions = Array.from(new Set(pricingData.map(row => row.customer_category).filter((value): value is string => !!value))).sort();
  const total = money(friendBillboards.reduce((sum, board) => sum + (costs.get(board.id)?.friendRentalCost ?? 0), 0));
  if (!friendBillboards.length) return null;
  return (
    <Card className="border-border bg-card shadow-sm [&_button]:min-h-10 [&_button]:cursor-pointer [&_button]:transition-all [&_button]:duration-200 [&_input]:min-h-10">
      <CardHeader className="border-b border-border bg-primary/5">
        <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-lg">
          <span className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" />إيجارات الشركات الصديقة</span>
          <span className="text-primary tabular-nums">{total.toLocaleString('ar-LY')} {currencySymbol}</span>
        </CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">تكلفة استئجار اللوحات من الشركات. {pricingPeriod ? 'اختر فئة لكل شركة وراجع الأسعار قبل تطبيقها على المسودة.' : 'حدد تكلفة كل لوحة أو وزّع المبلغ المتفق عليه للشركة.'} تُحفظ مع زر حفظ العقد.</p>
      </CardHeader>
      <CardContent className="space-y-5 p-4 lg:p-5">
        <div className="flex flex-wrap items-center gap-5 rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-3"><Switch id="friend-includes-installation" checked={includesInstallation} onCheckedChange={onIncludesInstallationChange} /><Label htmlFor="friend-includes-installation" className="cursor-pointer">تكلفة الشركة تشمل التركيب</Label></div>
          {onIncludesPrintChange && <div className="flex items-center gap-3"><Switch id="friend-includes-print" checked={includesPrint} onCheckedChange={onIncludesPrintChange} /><Label htmlFor="friend-includes-print" className="cursor-pointer">تكلفة الشركة تشمل الطباعة</Label></div>}
          <div className="flex flex-wrap items-center gap-3"><Switch id="friend-operating-fee" checked={operatingFeeEnabled} onCheckedChange={onOperatingFeeEnabledChange} /><Label htmlFor="friend-operating-fee" className="cursor-pointer">رسوم التشغيل</Label>
            {operatingFeeEnabled && <><Input aria-label="نسبة رسوم تشغيل الإيجارات الصديقة" className="w-24" type="number" min="0" max="100" step="0.5" value={operatingFeeRate} onChange={event => onOperatingFeeRateChange?.(Math.max(0, Math.min(100, Number(event.target.value) || 0)))} /><span>%</span><span className="text-sm">{operatingFeeAmount.toLocaleString('ar-LY')} {currencySymbol}</span></>}
          </div>
        </div>
        {companies.map(company => {
          const savedCategories = Array.from(new Set(company.boards.map(board => costs.get(board.id)?.pricingSnapshot?.category).filter(Boolean)));
          const category = categories[company.id] ?? (savedCategories.length === 1 ? savedCategories[0]! : '');
          const quotes = company.boards.map(board => pricingPeriod ? quoteFriendRental(pricingData, board, category, pricingPeriod) : null);
          const complete = quotes.every(Boolean);
          const companyTotal = money(company.boards.reduce((sum, board) => sum + (costs.get(board.id)?.friendRentalCost ?? 0), 0));
          const manual = manualTotals[company.id];
          return <section key={company.id} className="overflow-hidden rounded-xl border border-border" aria-label={`إيجارات ${company.name}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 p-4">
              <div><h3 className="font-bold">{company.name}</h3><p className="text-sm text-muted-foreground">{company.boards.length} لوحة · التكلفة الحالية {companyTotal.toLocaleString('ar-LY')} {currencySymbol}</p></div>
              {pricingPeriod && <div className="flex w-full flex-wrap items-end gap-2 lg:w-auto">
                <div className="min-w-[180px] flex-1"><Label htmlFor={`friend-category-${company.id}`} className="mb-1 block">فئة تكلفة الإيجار</Label>
                  <select id={`friend-category-${company.id}`} value={category} onChange={event => setCategories(prev => ({ ...prev, [company.id]: event.target.value }))} className="h-11 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    <option value="">اختر فئة من جدول التسعير</option>
                    {category && !categoryOptions.includes(category) && <option value={category}>{category} (غير متاحة حالياً)</option>}
                    {categoryOptions.map(value => <option key={value} value={value}>{value}</option>)}
                  </select>
                </div>
                <Button type="button" disabled={!category || !complete} onClick={() => company.boards.forEach((board, index) => {
                  const quote = quotes[index]!;
                  onUpdateFriendCost(board.id, company.id, company.name, quote.cost, quote.snapshot);
                })}>تطبيق أسعار الفئة</Button>
              </div>}
            </div>
            {category && pricingPeriod && <div className="border-b border-border px-4 py-3 text-sm" aria-live="polite">
              {complete ? `الإجمالي المقترح: ${money(quotes.reduce((sum, quote) => sum + quote!.cost, 0)).toLocaleString('ar-LY')} ${currencySymbol}` : 'تعذّر تسعير بعض اللوحات لهذه الفئة والمستوى والمدة. أكمل جدول الأسعار أو أدخل تكلفتها يدوياً.'}
            </div>}
            <div className="grid items-start gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
              {company.boards.map((board, index) => {
                const saved = costs.get(board.id);
                const quote = quotes[index];
                const customerPrice = customerRentalByBillboard?.get(board.id);
                const customerRental = customerPrice?.totalForBoard;
                const additionalServices = customerPrice ? (installationEnabled && !includesInstallation ? customerPrice.installationPrice : 0) + (printEnabled && !includesPrint ? customerPrice.printCost : 0) : 0;
                const margin = saved && customerRental != null ? money(customerRental - saved.friendRentalCost - additionalServices) : null;
                const matchesQuote = !!quote && !!saved && money(quote.cost) === money(saved.friendRentalCost);
                const billboard = billboardDetails.find(item => String(item.ID) === board.id);
                return <article key={board.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-200 hover:border-primary/50" aria-label={`تكلفة وربح ${board.name || board.id}`}>
                  <div className="relative h-56 border-b border-border bg-muted/30">
                    {billboard ? <BillboardImageZoom billboard={billboard} alt={board.name || `لوحة ${board.id}`} thumbnailObjectFit="contain" className="h-full w-full" /> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">لا توجد صورة للوحة</div>}
                  </div>
                  <div className="space-y-3 p-4">
                  <div className="min-w-0 border-b border-border pb-2"><p className="font-semibold break-words">{board.name || `لوحة ${board.id}`} <span className="text-xs text-muted-foreground">#{board.id}</span></p><p className="text-sm text-muted-foreground">{board.size} · المستوى {board.level || 'غير محدد'}</p><p className="text-xs text-muted-foreground">{company.name}</p></div>
                  {billboard && <p className="text-sm leading-6 text-muted-foreground">{[billboard.City, billboard.District, billboard.Nearest_Landmark].filter(Boolean).join(' · ')}</p>}
                  <dl className="space-y-2 rounded-lg border border-border bg-muted/20 p-3 text-sm">
                    <div className="flex justify-between gap-2"><dt>للشركة الصديقة</dt><dd className="font-semibold tabular-nums">{saved ? `${saved.friendRentalCost.toLocaleString('ar-LY')} ${currencySymbol}` : 'لم تُحدد التكلفة'}</dd></div>
                    <div className="flex justify-between gap-2"><dt>سعر العميل بعد الخصم والخدمات</dt><dd className="font-semibold tabular-nums">{customerRental != null ? `${customerRental.toLocaleString('ar-LY')} ${currencySymbol}` : 'غير متاح'}</dd></div>
                    <div className="flex justify-between gap-2"><dt>خدمات غير مشمولة بتكلفة الصديق</dt><dd>{additionalServices.toLocaleString('ar-LY')} {currencySymbol}</dd></div>
                    <div className={`flex justify-between gap-2 rounded-lg p-2 ${margin == null ? 'bg-muted' : margin < 0 ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}><dt className="font-bold">{margin != null && margin < 0 ? 'خسارة الإيجار' : 'هامش ربح الإيجار'}</dt><dd className="font-bold tabular-nums">{margin == null ? 'غير محسوب' : `${margin.toLocaleString('ar-LY')} ${currencySymbol}`}</dd></div>
                  </dl>
                  <p className="text-xs text-muted-foreground">هامش الإيجار قبل رسوم التشغيل والمصاريف الأخرى، وليس صافي ربح العقد.</p>
                  {category && pricingPeriod && <p className={`rounded-lg border p-2 text-xs font-semibold ${matchesQuote ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-muted text-foreground'}`}>{!quote ? 'لا يوجد سعر مطابق لهذه الفئة' : !saved ? 'سعر الفئة لم يُطبق بعد' : matchesQuote ? 'التكلفة تطابق سعر الفئة المختارة' : 'التكلفة تختلف عن سعر الفئة المختارة'}</p>}
                  <div className="text-sm leading-6">{category && pricingPeriod ? <><p className={quote ? 'font-semibold text-primary' : 'text-destructive'}>{quote ? `${quote.cost.toLocaleString('ar-LY')} ${currencySymbol}` : 'لا يوجد سعر مطابق'}</p><p className="text-muted-foreground">{quote?.snapshot.source}</p></> : <p className="text-muted-foreground">{saved?.pricingSnapshot ? `الفئة المطبقة: ${saved.pricingSnapshot.category}` : saved ? 'تكلفة محفوظة أو معدّلة يدوياً' : 'لم تُحدد التكلفة بعد'}</p>}
                    {quote && saved && (quote.cost !== saved.friendRentalCost || quote.snapshot.category !== saved.pricingSnapshot?.category) && <p className="text-muted-foreground">السعر المقترح لم يُطبّق بعد.</p>}
                  </div>
                  <div><Label htmlFor={`friend-cost-${board.id}`} className="mb-1 block text-xs">التكلفة المطبقة ({currencySymbol})</Label><Input id={`friend-cost-${board.id}`} type="number" min="0" step="0.01" dir="ltr" value={saved?.friendRentalCost ?? ''} placeholder="حدد التكلفة" onChange={event => {
                    const value = event.target.value;
                    if (value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0) onUpdateFriendCost(board.id, company.id, company.name, money(Number(value)));
                  }} /></div>
                  {quote && !matchesQuote && <Button type="button" variant="outline" className="w-full" onClick={() => onUpdateFriendCost(board.id, company.id, company.name, quote.cost, quote.snapshot)}>تطبيق سعر الفئة لهذه اللوحة</Button>}
                  </div>
                </article>;
              })}
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-border bg-muted/20 p-4">
              <Label htmlFor={`friend-total-${company.id}`}>إجمالي متفق عليه للشركة</Label>
              <Input id={`friend-total-${company.id}`} type="number" min="0" step="0.01" className="w-40" placeholder={String(companyTotal)} value={manual ?? ''} onChange={event => setManualTotals(prev => ({ ...prev, [company.id]: event.target.value }))} />
              <Button type="button" variant="outline" disabled={manual == null || manual === '' || !Number.isFinite(Number(manual)) || Number(manual) < 0} onClick={() => {
                const amounts = allocateMoney(Number(manual), company.boards.map(board => costs.get(board.id)?.friendRentalCost ?? 0));
                company.boards.forEach((board, index) => onUpdateFriendCost(board.id, company.id, company.name, amounts[index]));
                setManualTotals(prev => ({ ...prev, [company.id]: '' }));
              }}>توزيع الإجمالي على اللوحات</Button>
              <span className="text-xs text-muted-foreground">بحسب التكاليف الحالية، أو بالتساوي إذا لم تُحدد بعد.</span>
            </div>
          </section>;
        })}
      </CardContent>
    </Card>
  );
}
