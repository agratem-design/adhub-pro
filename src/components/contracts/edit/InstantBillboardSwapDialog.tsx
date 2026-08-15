// @ts-nocheck
import React, { useEffect, useMemo, useState, useDeferredValue } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  Check,
  Repeat2,
  Calendar,
  MapPin,
  Ruler,
  Clock,
  Sparkles,
  ArrowRight,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Equal,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  calculateRemainingBillboardValue,
  calculateSwapFinancialDifference,
  scoreBillboardCandidate,
} from '@/utils/contractBillboardCalculations';
import { executeBillboardSwap, SwapBillboardResult } from '@/services/contractBillboardSwapService';
import { BillboardImage } from '@/components/BillboardImage';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  originalBillboard: any;
  contractNumber: number;
  contractStartDate: string;
  contractEndDate: string;
  customerName?: string | null;
  adType?: string | null;
  contractedPrice?: number;
  onSwapped?: (result: SwapBillboardResult) => void;
}

export function InstantBillboardSwapDialog({
  open,
  onOpenChange,
  originalBillboard,
  contractNumber,
  contractStartDate,
  contractEndDate,
  customerName,
  adType,
  contractedPrice,
  onSwapped,
}: Props) {
  const [allBillboards, setAllBillboards] = useState<any[]>([]);
  const [loadingBillboards, setLoadingBillboards] = useState(false);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [filterSameSizeOnly, setFilterSameSizeOnly] = useState(false);
  const [filterSameCityOnly, setFilterSameCityOnly] = useState(false);

  // تاريخ سريان الاستبدال
  const todayStr = new Date().toISOString().split('T')[0];
  const initialEffective = (todayStr >= contractStartDate && todayStr <= contractEndDate)
    ? todayStr
    : contractStartDate || todayStr;
  const [effectiveDate, setEffectiveDate] = useState(initialEffective);

  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [isConfirmStep, setIsConfirmStep] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const effectiveContractedPrice = Number(contractedPrice || originalBillboard?.Price || 0);

  // حساب القيمة المتبقية للوحة الحالية
  const remainingCalc = useMemo(() => {
    return calculateRemainingBillboardValue({
      startDate: contractStartDate,
      endDate: contractEndDate,
      effectiveDate,
      contractedPrice: effectiveContractedPrice,
    });
  }, [contractStartDate, contractEndDate, effectiveDate, effectiveContractedPrice]);

  // جلب اللوحات المتاحة عند فتح النافذة
  useEffect(() => {
    if (!open) {
      setSelectedCandidate(null);
      setIsConfirmStep(false);
      setSearch('');
      return;
    }

    setEffectiveDate(initialEffective);
    setSelectedCandidate(null);
    setIsConfirmStep(false);

    const loadCandidates = async () => {
      setLoadingBillboards(true);
      try {
        const { data, error } = await supabase
          .from('billboards')
          .select('ID, Billboard_Name, City, District, Nearest_Landmark, Size, Price, Level, Image_URL, Status, Contract_Number')
          .limit(3000);

        if (!error && data) {
          // استبعاد اللوحة الأصلية
          const availableOnly = data.filter((b) => Number(b.ID) !== Number(originalBillboard?.ID));
          setAllBillboards(availableOnly);
        }
      } catch (err) {
        console.error('Failed to load candidate billboards:', err);
      } finally {
        setLoadingBillboards(false);
      }
    };

    loadCandidates();
  }, [open, originalBillboard?.ID, initialEffective]);

  // تقييم وتصفية وترتيب اللوحات البديلة
  const rankedCandidates = useMemo(() => {
    if (!originalBillboard || allBillboards.length === 0) return [];

    let list = allBillboards;

    // استبعاد المحجوزة لعقود أخرى
    list = list.filter((b) => !b.Contract_Number || Number(b.Contract_Number) === Number(contractNumber));

    // فلاتر سريعة
    if (filterSameSizeOnly && originalBillboard.Size) {
      list = list.filter((b) => (b.Size || '').trim().toLowerCase() === (originalBillboard.Size || '').trim().toLowerCase());
    }
    if (filterSameCityOnly && originalBillboard.City) {
      list = list.filter((b) => (b.City || '').trim().toLowerCase() === (originalBillboard.City || '').trim().toLowerCase());
    }

    // بحث نصي
    const q = deferredSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((b) =>
        [b.Billboard_Name, b.City, b.District, b.Nearest_Landmark, b.Size]
          .map((v) => String(v || '').toLowerCase())
          .some((t) => t.includes(q))
      );
    }

    // حساب الدرجات والترتيب
    const scored = list.map((cand) => {
      const scoreObj = scoreBillboardCandidate({
        originalBillboard,
        candidate: cand,
      });

      const swapDiff = calculateSwapFinancialDifference({
        originalRemainingValue: remainingCalc.remainingValue,
        replacementMonthlyPrice: Number(cand.Price) || 0,
        remainingDays: remainingCalc.remainingDays,
      });

      return {
        ...cand,
        matchScore: scoreObj.score,
        matchTier: scoreObj.matchTier,
        matchLabel: scoreObj.matchLabel,
        swapDiff,
      };
    });

    // ترتيب حسب الدرجة الأعلى أولاً
    return scored.sort((a, b) => b.matchScore - a.matchScore);
  }, [allBillboards, originalBillboard, filterSameSizeOnly, filterSameCityOnly, deferredSearch, remainingCalc, contractNumber]);

  // تنفيذ الاستبدال الفوري
  const handleExecuteSwap = async () => {
    if (!selectedCandidate || !originalBillboard) return;

    setIsExecuting(true);
    try {
      const result = await executeBillboardSwap({
        contractNumber,
        originalBillboardId: Number(originalBillboard.ID),
        replacementBillboardId: Number(selectedCandidate.ID),
        effectiveDate,
        customerName: customerName || undefined,
        adType: adType || undefined,
      });

      if (result.success) {
        toast.success(`تم استبدال اللوحة بنجاح باللوحة #${selectedCandidate.ID} (${selectedCandidate.Billboard_Name || ''})`);
        onOpenChange(false);
        if (onSwapped) {
          onSwapped(result);
        }
      } else {
        toast.error(result.error || 'تعذر إتمام عملية الاستبدال');
      }
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ غير متوقع أثناء الاستبدال');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-background border-border" dir="rtl">
        {/* Header */}
        <DialogHeader className="p-4 bg-muted/30 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Repeat2 className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">التبديل الفوري للوحة</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  استبدال اللوحة الحالية بلوحة بديلة متاحة مباشرة بدون تعقيدات مالية
                </p>
              </div>
            </div>
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">
              عقد #{contractNumber}
            </Badge>
          </div>
        </DialogHeader>

        {/* Current Billboard Snapshot Bar */}
        <div className="px-4 py-3 bg-card border-b border-border grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary shrink-0" />
            <div className="truncate">
              <span className="text-muted-foreground block text-[11px]">اللوحة الحالية</span>
              <strong className="text-foreground truncate">{originalBillboard?.Billboard_Name || `#${originalBillboard?.ID}`}</strong>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Ruler className="w-4 h-4 text-primary shrink-0" />
            <div>
              <span className="text-muted-foreground block text-[11px]">المقاس والمدينة</span>
              <span className="font-semibold text-foreground">{originalBillboard?.Size} • {originalBillboard?.City}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary shrink-0" />
            <div>
              <span className="text-muted-foreground block text-[11px]">الفترة المتبقية</span>
              <span className="font-semibold text-foreground">{remainingCalc.remainingDays} يوم</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <div>
              <span className="text-muted-foreground block text-[11px]">القيمة المتبقية</span>
              <span className="font-bold text-emerald-500">{remainingCalc.remainingValue.toLocaleString('ar-LY')} د.ل</span>
            </div>
          </div>
        </div>

        {/* Body Content */}
        {!isConfirmStep ? (
          <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3">
            {/* Filters & Date Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/20 p-2.5 rounded-lg border border-border">
              {/* Effective Date */}
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">تاريخ السريان:</Label>
                <Input
                  type="date"
                  value={effectiveDate}
                  min={contractStartDate}
                  max={contractEndDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="h-8 text-xs w-36 bg-background"
                />
              </div>

              {/* Quick Tags */}
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant={filterSameSizeOnly ? 'default' : 'outline'}
                  onClick={() => setFilterSameSizeOnly(!filterSameSizeOnly)}
                  className="h-7 text-xs px-2.5"
                >
                  <Ruler className="w-3 h-3 ml-1" />
                  نفس المقاس ({originalBillboard?.Size || '—'})
                </Button>
                <Button
                  size="sm"
                  variant={filterSameCityOnly ? 'default' : 'outline'}
                  onClick={() => setFilterSameCityOnly(!filterSameCityOnly)}
                  className="h-7 text-xs px-2.5"
                >
                  <MapPin className="w-3 h-3 ml-1" />
                  نفس المدينة ({originalBillboard?.City || '—'})
                </Button>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="بحث عن لوحة أو منطقة..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 text-xs pr-8 bg-background"
                />
              </div>
            </div>

            {/* Candidate List */}
            <div className="flex-1 overflow-hidden">
              {loadingBillboards ? (
                <div className="h-64 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-xs">جاري فحص وترتيب أفضل اللوحات البديلة...</span>
                </div>
              ) : rankedCandidates.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <AlertCircle className="w-8 h-8 text-muted-foreground/50" />
                  <span className="text-sm font-semibold">لا توجد لوحات بديلة مطابقة للفلاتر</span>
                  <span className="text-xs">جرب إلغاء بعض الفلاتر لعرض مزيد من الخيارات</span>
                </div>
              ) : (
                <ScrollArea className="h-[46vh] pr-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pb-2">
                    {rankedCandidates.map((cand) => {
                      const isPicked = selectedCandidate?.ID === cand.ID;
                      const diff = cand.swapDiff.difference;

                      return (
                        <div
                          key={cand.ID}
                          onClick={() => setSelectedCandidate(cand)}
                          className={cn(
                            'p-3 rounded-lg border transition-all cursor-pointer flex flex-col justify-between gap-2.5',
                            isPicked
                              ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary'
                              : 'border-border bg-card hover:border-primary/50 hover:bg-muted/30'
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className="w-12 h-12 rounded bg-muted overflow-hidden shrink-0 border border-border">
                                <BillboardImage
                                  src={cand.Image_URL}
                                  alt={cand.Billboard_Name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <strong className="text-xs text-foreground">{cand.Billboard_Name || `#${cand.ID}`}</strong>
                                  <span className="text-[10px] text-muted-foreground">#{cand.ID}</span>
                                </div>
                                <span className="text-[11px] text-muted-foreground block">
                                  {cand.Size} • {cand.City} {cand.District ? `(${cand.District})` : ''}
                                </span>
                                {cand.Nearest_Landmark && (
                                  <span className="text-[10px] text-muted-foreground/80 truncate block max-w-[200px]">
                                    {cand.Nearest_Landmark}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Match Tier Badge */}
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-[10px] shrink-0 font-medium',
                                cand.matchTier === 'perfect' && 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
                                cand.matchTier === 'excellent' && 'bg-primary/10 text-primary border-primary/30',
                                cand.matchTier === 'good' && 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                              )}
                            >
                              {cand.matchLabel}
                            </Badge>
                          </div>

                          {/* Financial Variance Tag */}
                          <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                            <div className="flex items-center gap-1">
                              {diff === 0 ? (
                                <span className="text-emerald-500 flex items-center gap-1 font-semibold text-[11px]">
                                  <Equal className="w-3 h-3" />
                                  متكافئة (0 د.ل)
                                </span>
                              ) : diff > 0 ? (
                                <span className="text-amber-500 flex items-center gap-1 font-semibold text-[11px]">
                                  <TrendingUp className="w-3 h-3" />
                                  أغلى (+{diff.toLocaleString('ar-LY')} د.ل)
                                </span>
                              ) : (
                                <span className="text-blue-500 flex items-center gap-1 font-semibold text-[11px]">
                                  <TrendingDown className="w-3 h-3" />
                                  أرخص ({diff.toLocaleString('ar-LY')} د.ل)
                                </span>
                              )}
                            </div>

                            <Button
                              size="sm"
                              variant={isPicked ? 'default' : 'outline'}
                              className="h-6 text-[11px] px-2"
                            >
                              {isPicked ? 'محددة' : 'اختيار'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        ) : (
          /* Confirmation Step */
          <div className="p-6 flex flex-col gap-4">
            <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-4">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                ملخص عملية الاستبدال
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Original */}
                <div className="p-3 rounded-lg bg-card border border-border space-y-1.5">
                  <span className="text-xs text-destructive font-semibold block">اللوحة الأصلية (ستصبح مستبدلة):</span>
                  <p className="text-sm font-bold text-foreground">{originalBillboard?.Billboard_Name || `#${originalBillboard?.ID}`}</p>
                  <p className="text-xs text-muted-foreground">{originalBillboard?.Size} • {originalBillboard?.City}</p>
                  <p className="text-xs text-muted-foreground">القيمة المتبقية للفترة: {remainingCalc.remainingValue.toLocaleString('ar-LY')} د.ل</p>
                </div>

                {/* Replacement */}
                <div className="p-3 rounded-lg bg-card border border-emerald-500/30 space-y-1.5">
                  <span className="text-xs text-emerald-500 font-semibold block">اللوحة البديلة (ستصبح نشطة في العقد):</span>
                  <p className="text-sm font-bold text-foreground">{selectedCandidate?.Billboard_Name || `#${selectedCandidate?.ID}`}</p>
                  <p className="text-xs text-muted-foreground">{selectedCandidate?.Size} • {selectedCandidate?.City}</p>
                  <p className="text-xs text-muted-foreground">قيمة الفترة المتبقية: {selectedCandidate?.swapDiff.replacementValueForPeriod.toLocaleString('ar-LY')} د.ل</p>
                </div>
              </div>

              {/* Financial Result Message */}
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-xs space-y-1">
                <div className="font-bold text-primary flex items-center gap-1.5">
                  <span>الأثر المالي على العقد:</span>
                  <span>{selectedCandidate?.swapDiff.statusText}</span>
                </div>
                <p className="text-muted-foreground text-[11px]">
                  {selectedCandidate?.swapDiff.difference === 0
                    ? 'الاستبدال متكافئ 1:1. لن يتم خصم أي مبالغ إيقاف ولن تتأثر قيمة العقد الإجمالية.'
                    : selectedCandidate?.swapDiff.difference > 0
                    ? `سيتم تطبيق فارق السعر (+${selectedCandidate?.swapDiff.difference.toLocaleString('ar-LY')} د.ل) فقط على العقد.`
                    : `سيتم خصم فارق السعر (${selectedCandidate?.swapDiff.difference.toLocaleString('ar-LY')} د.ل) فقط من العقد.`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <DialogFooter className="p-3 bg-muted/20 border-t border-border flex items-center justify-between">
          {!isConfirmStep ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                إلغاء
              </Button>
              <Button
                size="sm"
                disabled={!selectedCandidate}
                onClick={() => setIsConfirmStep(true)}
                className="gap-1.5"
              >
                <span>متابعة الاستبدال</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setIsConfirmStep(false)} disabled={isExecuting}>
                رجوع
              </Button>
              <Button
                size="sm"
                disabled={isExecuting}
                onClick={handleExecuteSwap}
                className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري التنفيذ الذري...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>تأكيد واستبدال الآن</span>
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
