// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PauseCircle, Plus, History, FilePlus2, TrendingUp, TrendingDown, Inbox, Coins, Printer, Wrench } from 'lucide-react';
import { formatAmount } from '@/lib/formatUtils';
import { PausedBillboardCard } from './PausedBillboardCard';
import { usePausedBillboardsPricing, PausedPricingOptions } from '@/hooks/usePausedBillboardsPricing';

interface Props extends PausedPricingOptions {
  contractNumber: number | null | undefined;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  onAddClick: () => void;
  onBulkClick?: () => void;
  onAddFromContractClick?: () => void;
  refreshKey?: number;
  onChanged?: () => void;
  currencySymbol?: string;
  onToggleSingleFace?: (billboardId: string) => void;
  pricingMode?: 'months' | 'days';
  durationMonths?: number;
  durationDays?: number;
  previousContractNumber?: number | null;
  previousContractBillboardIds?: Set<string>;
}

export function PausedBillboardsList({
  contractNumber,
  contractStartDate,
  contractEndDate,
  onAddClick,
  onBulkClick,
  onAddFromContractClick,
  refreshKey,
  onChanged,
  currencySymbol = 'د.ل',
  onToggleSingleFace,
  pricingMode,
  durationMonths,
  durationDays,
  previousContractNumber,
  previousContractBillboardIds,
  // Pricing options
  calculateBillboardPrice,
  printCostDetails,
  installationDetails,
  printCostEnabled,
  includePrintInPrice,
  installationEnabled,
  includeInstallationInPrice,
  singleFaceBillboards,
  pricingByBillboard,
}: Props) {
  const { items, totals, loading, refetch } = usePausedBillboardsPricing(
    contractNumber,
    contractStartDate,
    contractEndDate,
    {
      calculateBillboardPrice,
      printCostDetails,
      installationDetails,
      printCostEnabled,
      includePrintInPrice,
      installationEnabled,
      includeInstallationInPrice,
      singleFaceBillboards,
      pricingByBillboard,
    },
  );

  // ✅ ترتيب نفس صفحة اللوحات المختارة — حسب sort_order من جدول sizes
  const { data: sizesOrder = [] } = useQuery({
    queryKey: ['sizes-order'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sizes')
        .select('id, name, sort_order')
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const sortedItems = useMemo(() => {
    const getOrder = (it: any): number => {
      const bb = it.billboard || {};
      const sizeId = bb.size_id || bb.Size_ID;
      if (sizeId) {
        const f = sizesOrder.find((s: any) => s.id === sizeId);
        if (f) return f.sort_order ?? 999;
      }
      const size = bb.Size || bb.size || it.raw?.size;
      if (size) {
        const f = sizesOrder.find((s: any) => s.name === size);
        if (f) return f.sort_order ?? 999;
      }
      return 999;
    };
    return [...items].sort((a, b) => {
      const d = getOrder(a) - getOrder(b);
      if (d !== 0) return d;
      // ثبات الترتيب الثانوي حتى لا تهتز الكروت
      return Number(a.raw?.id || 0) - Number(b.raw?.id || 0);
    });
  }, [items, sizesOrder]);

  // ✅ ملخص المقاسات والأوجه — مطابق لمنطق اللوحات المختارة
  const sizeSummary = useMemo(() => {
    const sizeMap = new Map<string, { count: number; faces: number }>();
    let totalFaces = 0;
    sortedItems.forEach((it: any) => {
      const bb = it.billboard || {};
      const size = bb.Size || bb.size || it.raw?.size || 'غير محدد';
      const rawFaces = Number(bb.Faces_Count ?? bb.faces_count ?? 2);
      const baseFaces = Number.isFinite(rawFaces) && rawFaces > 0 ? rawFaces : 2;
      const faces = it.isSingleFace ? 1 : baseFaces;
      totalFaces += faces;
      const cur = sizeMap.get(size);
      if (cur) sizeMap.set(size, { count: cur.count + 1, faces: cur.faces + faces });
      else sizeMap.set(size, { count: 1, faces });
    });
    const sortedSizes = Array.from(sizeMap.entries()).sort((a, b) => {
      const oa = sizesOrder.find((s: any) => s.name === a[0])?.sort_order ?? 999;
      const ob = sizesOrder.find((s: any) => s.name === b[0])?.sort_order ?? 999;
      return oa - ob;
    });
    return { sizes: sortedSizes, totalFaces, totalCount: sortedItems.length };
  }, [sortedItems, sizesOrder]);

  const [highlightId, setHighlightId] = useState<number | null>(null);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => { refetch(); }, [refreshKey]);

  useEffect(() => {
    const handler = (e: any) => {
      const detail = e?.detail;
      if (typeof detail !== 'object' || !contractNumber) return;
      if (Number(detail?.contractNumber) !== Number(contractNumber)) return;
      // ✅ أحداث "updated" تأتي من الـ auto-sync الصامت — لا تعيد الحساب في الأب.
      if (detail?.action === 'updated') return;
      onChanged?.();
      if (detail?.action === 'added' && detail?.billboardId) {
        const bbId = Number(detail.billboardId);
        setHighlightId(bbId);
        setTimeout(() => {
          try {
            sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const el = document.querySelector(`[data-paused-bb="${bbId}"]`) as HTMLElement | null;
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } catch {}
        }, 150);
        setTimeout(() => setHighlightId(null), 2500);
      }
    };
    window.addEventListener('paused-billboards-changed', handler);
    return () => window.removeEventListener('paused-billboards-changed', handler);
  }, [contractNumber, onChanged]);

  return (
    <Card
      ref={sectionRef as any}
      className="border-2 border-primary/40 bg-gradient-to-br from-primary/5 via-background to-amber-500/5 shadow-lg overflow-hidden"
    >
      <CardHeader className="py-3 px-4 bg-primary/10 border-b-2 border-primary/30">
        <CardTitle className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="bg-primary/20 rounded-lg p-1.5">
              <PauseCircle className="h-5 w-5 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold text-foreground">اللوحات الموقوفة</span>
              <span className="text-[11px] text-muted-foreground font-normal">
                تُحسب بنفس طريقة اللوحات المختارة، ثم يُطبَّق خصم تاريخ الإيقاف
              </span>
            </div>
            <Badge className="bg-primary text-primary-foreground border-0 mr-1 tabular-nums text-sm px-2.5">
              {items.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {onAddFromContractClick && (
              <Button size="sm" variant="default" className="h-8 text-xs gap-1 shadow-md" onClick={onAddFromContractClick}>
                <FilePlus2 className="h-3.5 w-3.5" />
                إضافة من عقد آخر
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={onAddClick}>
              <Plus className="h-3.5 w-3.5" />
              إضافة لوحة موقوفة
            </Button>
            {onBulkClick && (
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={onBulkClick}>
                <History className="h-3.5 w-3.5" />
                تسجيل سابقاً
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>

      {items.length > 0 && (
        <div className="px-3 pt-3">
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
              </div>
              <h3 className="text-sm font-bold text-foreground">ملخص اللوحات الموقوفة</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              <div className="bg-background/80 backdrop-blur rounded-lg p-2 border border-border text-center">
                <div className="text-xl font-bold text-primary tabular-nums">{sizeSummary.totalCount}</div>
                <div className="text-[11px] text-muted-foreground">إجمالي اللوحات</div>
              </div>
              <div className="bg-background/80 backdrop-blur rounded-lg p-2 border border-border text-center">
                <div className="text-xl font-bold text-accent tabular-nums">{sizeSummary.totalFaces}</div>
                <div className="text-[11px] text-muted-foreground">إجمالي الأوجه</div>
              </div>
              {sizeSummary.sizes.map(([size, data]) => (
                <div key={size} className="bg-background/80 backdrop-blur rounded-lg p-2 border border-border text-center">
                  <div className="text-base font-bold text-foreground tabular-nums">{data.count}</div>
                  <div className="text-[11px] text-muted-foreground">{size}</div>
                  <div className="text-[10px] text-primary/70 tabular-nums">{data.faces} وجه</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-muted/20 border-b border-border">
          <div className="rounded-lg border border-border bg-background p-2 text-center">
            <div className="text-[10px] text-muted-foreground">عدد اللوحات</div>
            <div className="text-lg font-bold tabular-nums text-foreground">{totals.count}</div>
          </div>
          <div className="rounded-lg border border-border bg-background p-2 text-center">
            <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
              <Coins className="h-3 w-3" /> الإجمالي قبل الإيقاف
            </div>
            <div className="text-lg font-bold tabular-nums text-foreground" dir="ltr">{formatAmount(totals.fullSum)}</div>
          </div>
          <div className="rounded-lg border-2 border-primary/40 bg-primary/10 p-2 text-center">
            <div className="text-[10px] text-primary flex items-center justify-center gap-1">
              <TrendingUp className="h-3 w-3" /> المضاف للعقد
            </div>
            <div className="text-lg font-bold tabular-nums text-primary" dir="ltr">{formatAmount(totals.consumedSum)}</div>
          </div>
          <div className="rounded-lg border-2 border-amber-500/40 bg-amber-500/10 p-2 text-center">
            <div className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1">
              <TrendingDown className="h-3 w-3" /> خصم الإيقاف
            </div>
            <div className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400" dir="ltr">{formatAmount(totals.refundSum)}</div>
          </div>
          {installationEnabled && (totals.installSum || 0) > 0 && (
            <div className="rounded-lg border border-accent/40 bg-accent/10 p-2 text-center">
              <div className="text-[10px] text-accent flex items-center justify-center gap-1">
                <Wrench className="h-3 w-3" /> إجمالي التركيب
              </div>
              <div className="text-lg font-bold tabular-nums text-accent" dir="ltr">{formatAmount(totals.installSum)}</div>
            </div>
          )}
          {printCostEnabled && (totals.printSum || 0) > 0 && (
            <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 p-2 text-center">
              <div className="text-[10px] text-orange-600 flex items-center justify-center gap-1">
                <Printer className="h-3 w-3" /> إجمالي الطباعة
              </div>
              <div className="text-lg font-bold tabular-nums text-orange-600" dir="ltr">{formatAmount(totals.printSum)}</div>
            </div>
          )}
        </div>
      )}

      <CardContent className="p-3">
        {loading ? (
          <div className="text-xs text-muted-foreground text-center py-6">جاري التحميل...</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-6 gap-2">
            <div className="bg-muted/50 rounded-full p-3">
              <Inbox className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="text-sm font-medium text-foreground">لا توجد لوحات موقوفة لهذا العقد</div>
            <div className="text-[11px] text-muted-foreground max-w-md">
              يمكنك جلب لوحة من عقد آخر وإضافتها كموقوفة، أو تسجيل لوحة محذوفة سابقاً.
            </div>
            {onAddFromContractClick && (
              <Button size="sm" className="mt-2 gap-1" onClick={onAddFromContractClick}>
                <FilePlus2 className="h-3.5 w-3.5" />
                إضافة لوحة موقوفة من عقد آخر
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 auto-rows-fr gap-3 items-stretch">
            {sortedItems.map((it) => (
              <PausedBillboardCard
                key={it.raw.id}
                item={it}
                highlight={highlightId === Number(it.raw.billboard_id)}
                onChanged={() => { refetch(); onChanged?.(); }}
                contractStartDate={contractStartDate}
                printCostEnabled={printCostEnabled}
                includePrintInPrice={includePrintInPrice}
                installationEnabled={installationEnabled}
                includeInstallationInPrice={includeInstallationInPrice}
                currencySymbol={currencySymbol}
                onToggleSingleFace={onToggleSingleFace}
                pricingMode={pricingMode}
                durationMonths={durationMonths}
                durationDays={durationDays}
                previousContractNumber={previousContractNumber}
                previousContractBillboardIds={previousContractBillboardIds}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
