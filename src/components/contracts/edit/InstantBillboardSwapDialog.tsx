// @ts-nocheck
import React, { useEffect, useMemo, useState, useDeferredValue, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  Check,
  Repeat2,
  MapPin,
  Ruler,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Building2,
  Layers,
  Eye,
  X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  executeInstantBillboardSwap,
  InstantBillboardSwapResult,
} from '@/services/contractBillboardSwapService';
import { BillboardImage } from '@/components/BillboardImage';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  originalBillboard: any;
  contractNumber: number;
  contractStartDate?: string;
  contractEndDate?: string;
  customerName?: string | null;
  adType?: string | null;
  contractedPrice?: number;
  onSwapped?: (result: InstantBillboardSwapResult) => void;
}

export function isSameCanonicalSize(
  orig: { size_id?: number | string | null; Size_ID?: number | string | null; Size?: string | null; size?: string | null } | null | undefined,
  cand: { size_id?: number | string | null; Size_ID?: number | string | null; Size?: string | null; size?: string | null } | null | undefined
): boolean {
  if (!orig || !cand) return false;
  const origSizeId = orig.size_id ?? orig.Size_ID;
  const candSizeId = cand.size_id ?? cand.Size_ID;

  // Strict Canonical Rule: Must have valid matching size_id foreign keys to sizes table
  if (origSizeId != null && candSizeId != null && String(origSizeId).trim() !== '' && String(candSizeId).trim() !== '') {
    return String(origSizeId).trim() === String(candSizeId).trim();
  }

  // If size_id is missing on either side, it is NOT a verified canonical match
  return false;
}

/**
 * Informational text similarity helper for unverified suggestions only.
 * NEVER used for canonical same-size filtering.
 */
export function isDimensionTextSimilar(
  orig: { Size?: string | null; size?: string | null } | null | undefined,
  cand: { Size?: string | null; size?: string | null } | null | undefined
): boolean {
  if (!orig || !cand) return false;
  const normalize = (s: string | null | undefined) =>
    String(s || '')
      .replace(/×|\*|X|x/g, 'x')
      .replace(/\s+/g, '')
      .replace(/متر|m/g, '')
      .trim()
      .toLowerCase();

  const sOrig = normalize(orig.Size || orig.size);
  const sCand = normalize(cand.Size || cand.size);
  return !!sOrig && sOrig === sCand;
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

  // Filters — "نفس المقاس" is ON by default
  const [filterSameSizeOnly, setFilterSameSizeOnly] = useState(true);
  const [filterSameCityOnly, setFilterSameCityOnly] = useState(false);
  const [filterSameLevelOnly, setFilterSameLevelOnly] = useState(false);

  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [isConfirmStep, setIsConfirmStep] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const swapRequestIdRef = useRef<string | null>(null);

  // Image Preview Modal State
  const [previewImageBillboard, setPreviewImageBillboard] = useState<any | null>(null);

  const effectiveContractedPrice = Number(
    contractedPrice || originalBillboard?.Price || originalBillboard?.price || 0
  );

  // جلب اللوحات المتاحة عند فتح النافذة
  useEffect(() => {
    swapRequestIdRef.current = null;
    if (!open) {
      setSelectedCandidate(null);
      setIsConfirmStep(false);
      setSearch('');
      setPreviewImageBillboard(null);
      return;
    }

    setSelectedCandidate(null);
    setIsConfirmStep(false);
    setFilterSameSizeOnly(true);
    setFilterSameCityOnly(false);
    setFilterSameLevelOnly(false);

    const loadCandidates = async () => {
      setLoadingBillboards(true);
      try {
        const { data, error } = await supabase
          .from('billboards')
          .select(
            'ID, Billboard_Name, City, Municipality, District, Nearest_Landmark, Size, size_id, Price, Level, Image_URL, image_name, Status, Contract_Number, GPS_Coordinates, GPS_Link, Faces_Count, Category_Level'
          )
          .limit(3000);

        if (!error && data) {
          // استبعاد اللوحة الأصلية واستبعاد المحجوزة لعقود أخرى
          const availableOnly = data.filter((b) => {
            const isOrig = Number(b.ID) === Number(originalBillboard?.ID);
            if (isOrig) return false;
            // المتاحة فقط
            const isRentedToOther =
              b.Contract_Number && Number(b.Contract_Number) !== Number(contractNumber);
            if (isRentedToOther) return false;
            const status = String(b.Status || '').trim().toLowerCase();
            const isAvailable =
              status === 'متاح' ||
              status === 'available' ||
              (!b.Contract_Number && status !== 'صيانة' && status !== 'maintenance');
            return isAvailable;
          });

          setAllBillboards(availableOnly);
        }
      } catch (err) {
        console.error('Failed to load candidate billboards for instant swap:', err);
      } finally {
        setLoadingBillboards(false);
      }
    };

    loadCandidates();
  }, [open, originalBillboard?.ID, contractNumber]);

  // تصفية وترتيب اللوحات البديلة بذكاء (Smart Ranking)
  const rankedCandidates = useMemo(() => {
    if (!originalBillboard || allBillboards.length === 0) return [];

    let list = allBillboards;

    // 1. فلتر نفس المقاس باستخدام المعرف الرسمي المعتمد (size_id)
    if (filterSameSizeOnly) {
      list = list.filter((b) => isSameCanonicalSize(originalBillboard, b));
    }

    // 2. فلتر نفس المدينة أو البلدية
    if (filterSameCityOnly && (originalBillboard.City || originalBillboard.Municipality)) {
      const origCity = String(originalBillboard.City || '').trim().toLowerCase();
      const origMun = String(originalBillboard.Municipality || '').trim().toLowerCase();
      list = list.filter((b) => {
        const cCity = String(b.City || '').trim().toLowerCase();
        const cMun = String(b.Municipality || '').trim().toLowerCase();
        return (origCity && cCity === origCity) || (origMun && cMun === origMun);
      });
    }

    // 3. فلتر نفس المستوى / الفئة
    if (filterSameLevelOnly && (originalBillboard.Level || originalBillboard.Category_Level)) {
      const origLevel = String(originalBillboard.Level || originalBillboard.Category_Level || '')
        .trim()
        .toLowerCase();
      list = list.filter((b) => {
        const cLevel = String(b.Level || b.Category_Level || '').trim().toLowerCase();
        return origLevel && cLevel === origLevel;
      });
    }

    // 4. بحث نصي ذكي
    const q = deferredSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((b) =>
        [
          b.Billboard_Name,
          String(b.ID),
          b.City,
          b.Municipality,
          b.District,
          b.Nearest_Landmark,
          b.Size,
          b.Level,
        ]
          .map((v) => String(v || '').toLowerCase())
          .some((t) => t.includes(q))
      );
    }

    // 5. حساب درجات التطابق والترتيب الذكي (Smart Ranking)
    const origCity = String(originalBillboard.City || '').trim().toLowerCase();
    const origMun = String(originalBillboard.Municipality || '').trim().toLowerCase();
    const origLevel = String(originalBillboard.Level || originalBillboard.Category_Level || '')
      .trim()
      .toLowerCase();

    const scored = list.map((cand) => {
      let score = 0;
      const cCity = String(cand.City || '').trim().toLowerCase();
      const cMun = String(cand.Municipality || '').trim().toLowerCase();
      const cLevel = String(cand.Level || cand.Category_Level || '').trim().toLowerCase();

      const isSameSize = isSameCanonicalSize(originalBillboard, cand);
      const isSameMun = origMun && cMun === origMun;
      const isSameCity = origCity && cCity === origCity;
      const isSameLevel = origLevel && cLevel === origLevel;

      if (isSameSize) score += 50;
      if (isSameMun) score += 30;
      else if (isSameCity) score += 20;
      if (isSameLevel) score += 15;

      let matchLabel = 'بديل متاح';
      if (isSameSize && (isSameMun || isSameCity) && isSameLevel) {
        matchLabel = 'تطابق كامل (مقاس + موقع + فئة)';
      } else if (isSameSize && (isSameMun || isSameCity)) {
        matchLabel = 'تطابق (مقاس + موقع)';
      } else if (isSameSize) {
        matchLabel = 'نفس المقاس';
      }

      return {
        ...cand,
        matchScore: score,
        matchLabel,
        isSameSize,
      };
    });

    // ترتيب حسب الدرجة الأعلى
    return scored.sort((a, b) => b.matchScore - a.matchScore);
  }, [
    allBillboards,
    originalBillboard,
    filterSameSizeOnly,
    filterSameCityOnly,
    filterSameLevelOnly,
    deferredSearch,
  ]);

  // تنفيذ الاستبدال الفوري الذري
  const handleExecuteSwap = async () => {
    if (!selectedCandidate || !originalBillboard || isExecuting) return;

    if (!swapRequestIdRef.current) {
      swapRequestIdRef.current = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : undefined;
    }

    setIsExecuting(true);
    try {
      const result = await executeInstantBillboardSwap({
        contractNumber,
        originalBillboardId: Number(originalBillboard.ID),
        replacementBillboardId: Number(selectedCandidate.ID),
        swapRequestId: swapRequestIdRef.current || undefined,
      });

      if (result.success) {
        swapRequestIdRef.current = null;
        toast.success(
          `تم استبدال اللوحة بنجاح باللوحة #${selectedCandidate.ID} (${selectedCandidate.Billboard_Name || ''}) دون أي تغيير في إجمالي العقد`
        );
        onOpenChange(false);
        if (onSwapped) {
          onSwapped(result);
        }
      } else {
        toast.error(result.error || 'تعذر إتمام عملية التبديل الفوري');
      }
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ غير متوقع أثناء الاستبدال');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !isExecuting && onOpenChange(v)}>
        <DialogContent
          className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-background border-border shadow-2xl"
          dir="rtl"
        >
          {/* Header */}
          <DialogHeader className="p-4 bg-muted/40 border-b border-border/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
                  <Repeat2 className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                    <span>التبديل الفوري للوحة</span>
                    <Badge variant="outline" className="border-primary/40 text-primary bg-primary/5 text-xs">
                      1:1 مباشر
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    استبدال اللوحة الحالية بلوحة بديلة متاحة داخل نفس العقد مع الحفاظ التام على السعر
                  </DialogDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-border text-muted-foreground bg-background text-xs">
                  عقد #{contractNumber}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          {/* Current Billboard Snapshot & Financial Invariant Bar */}
          <div className="px-4 py-3 bg-card border-b border-border grid grid-cols-1 md:grid-cols-12 gap-3 text-xs items-center">
            {/* Old Billboard Preview */}
            <div className="md:col-span-7 flex items-center gap-3">
              <div
                className="w-14 h-14 rounded-lg bg-muted overflow-hidden shrink-0 border border-border relative group cursor-pointer"
                onClick={() => setPreviewImageBillboard(originalBillboard)}
                title="تكبير الصورة"
              >
                <BillboardImage
                  billboard={originalBillboard}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Eye className="w-4 h-4 text-white" />
                </div>
              </div>

              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">اللوحة الحالية:</span>
                  <strong className="text-foreground text-xs truncate">
                    {originalBillboard?.Billboard_Name || `#${originalBillboard?.ID}`}
                  </strong>
                  <span className="text-[10px] text-muted-foreground font-mono">#{originalBillboard?.ID}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Ruler className="w-3.5 h-3.5 text-primary" />
                    {originalBillboard?.Size || '—'}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                    {originalBillboard?.City || '—'}
                    {originalBillboard?.Municipality ? ` (${originalBillboard.Municipality})` : ''}
                  </span>
                  {originalBillboard?.Level && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-primary" />
                        فئة {originalBillboard.Level}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Financial Invariant Message */}
            <div className="md:col-span-5 p-2.5 rounded-xl bg-primary/10 border border-primary/25 flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
              <div className="space-y-0.5">
                <div className="font-bold text-foreground text-xs flex items-center gap-1">
                  <span>سعر الموضع التعاقدي:</span>
                  <span className="text-primary font-mono">{effectiveContractedPrice.toLocaleString('ar-LY')} د.ل</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  إجمالي العقد ثابت تماماً (فرق العقد: 0.00 د.ل)
                </p>
              </div>
            </div>
          </div>

          {/* Body Content */}
          {!isConfirmStep ? (
            <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3 min-h-0">
              {/* Filters & Search Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 bg-muted/20 p-2.5 rounded-xl border border-border">
                {/* Quick Filters */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    size="sm"
                    variant={filterSameSizeOnly ? 'default' : 'outline'}
                    onClick={() => setFilterSameSizeOnly(!filterSameSizeOnly)}
                    className="h-7 text-xs px-2.5 cursor-pointer rounded-lg transition-all"
                  >
                    <Ruler className="w-3.5 h-3.5 ml-1" />
                    نفس المقاس ({originalBillboard?.Size || '—'})
                  </Button>

                  <Button
                    size="sm"
                    variant={filterSameCityOnly ? 'default' : 'outline'}
                    onClick={() => setFilterSameCityOnly(!filterSameCityOnly)}
                    className="h-7 text-xs px-2.5 cursor-pointer rounded-lg transition-all"
                  >
                    <MapPin className="w-3.5 h-3.5 ml-1" />
                    نفس المدينة / البلدية
                  </Button>

                  {originalBillboard?.Level && (
                    <Button
                      size="sm"
                      variant={filterSameLevelOnly ? 'default' : 'outline'}
                      onClick={() => setFilterSameLevelOnly(!filterSameLevelOnly)}
                      className="h-7 text-xs px-2.5 cursor-pointer rounded-lg transition-all"
                    >
                      <Layers className="w-3.5 h-3.5 ml-1" />
                      فئة ({originalBillboard.Level})
                    </Button>
                  )}

                  <Badge variant="secondary" className="text-[11px] h-7 px-2 font-normal text-muted-foreground bg-muted">
                    اللوحات المتاحة ({rankedCandidates.length})
                  </Badge>
                </div>

                {/* Search */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="بحث بالاسم، الكود، المنطقة..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 text-xs pr-8 bg-background rounded-lg border-border"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute left-2.5 top-2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Candidates Grid / List */}
              <div className="flex-1 overflow-hidden min-h-[300px]">
                {loadingBillboards ? (
                  <div className="h-64 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <Loader2 className="w-7 h-7 animate-spin text-primary" />
                    <span className="text-xs font-medium">جاري فحص وترتيب أفضل اللوحات البديلة المتاحة...</span>
                  </div>
                ) : rankedCandidates.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center gap-2.5 text-muted-foreground p-6 text-center">
                    <AlertCircle className="w-8 h-8 text-muted-foreground/60" />
                    <span className="text-sm font-semibold text-foreground">لا توجد لوحات بديلة مطابقة للفلاتر</span>
                    <p className="text-xs max-w-sm">
                      جرب إلغاء تفعيل بعض الفلاتر أعلاه (مثل فلتر نفس المقاس أو المدينة) لعرض خيارات إضافية متاحة.
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-[46vh] pr-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-3">
                      {rankedCandidates.map((cand) => {
                        const isPicked = selectedCandidate?.ID === cand.ID;

                        return (
                          <div
                            key={cand.ID}
                            onClick={() => setSelectedCandidate(cand)}
                            className={cn(
                              'p-3 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2.5 relative group',
                              isPicked
                                ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary'
                                : 'border-border/80 bg-card hover:border-primary/50 hover:bg-muted/30'
                            )}
                          >
                            <div className="flex items-start justify-between gap-2.5">
                              {/* Image Thumbnail with Preview Trigger */}
                              <div
                                className="w-16 h-16 rounded-lg bg-muted overflow-hidden shrink-0 border border-border relative group/img cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewImageBillboard(cand);
                                }}
                                title="معاينة الصورة بالحجم الكامل"
                              >
                                <BillboardImage
                                  billboard={cand}
                                  className="w-full h-full object-cover transition-transform group-hover/img:scale-105"
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                                  <Eye className="w-4 h-4 text-white" />
                                </div>
                              </div>

                              {/* Billboard Details */}
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center gap-1.5 justify-between">
                                  <strong className="text-xs text-foreground truncate block">
                                    {cand.Billboard_Name || `لوحة #${cand.ID}`}
                                  </strong>
                                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                                    #{cand.ID}
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] h-5 px-1.5 font-normal border-primary/30 text-primary bg-primary/5"
                                  >
                                    <Ruler className="w-3 h-3 ml-1" />
                                    {cand.Size || '—'}
                                  </Badge>

                                  <span className="truncate">
                                    {cand.City} {cand.Municipality ? `• ${cand.Municipality}` : ''}
                                  </span>
                                </div>

                                {cand.Nearest_Landmark && (
                                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80 truncate">
                                    <MapPin className="w-3 h-3 shrink-0 text-muted-foreground/60" />
                                    <span className="truncate">{cand.Nearest_Landmark}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Card Footer: Match Tag & Selection Indicator */}
                            <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                              <Badge
                                variant="secondary"
                                className={cn(
                                  'text-[10px] font-normal px-2 py-0.5',
                                  cand.matchScore >= 70
                                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                                    : cand.matchScore >= 50
                                    ? 'bg-primary/10 text-primary border border-primary/30'
                                    : 'bg-muted text-muted-foreground'
                                )}
                              >
                                {cand.matchLabel}
                              </Badge>

                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-muted-foreground font-mono">
                                  0.00 د.ل فرق
                                </span>

                                <Button
                                  size="sm"
                                  variant={isPicked ? 'default' : 'outline'}
                                  className={cn(
                                    'h-6 text-[11px] px-2.5 rounded-lg cursor-pointer transition-all',
                                    isPicked && 'bg-primary text-primary-foreground font-bold shadow-sm'
                                  )}
                                >
                                  {isPicked ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 ml-1" />
                                      محددة
                                    </>
                                  ) : (
                                    'اختيار'
                                  )}
                                </Button>
                              </div>
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
            <div className="p-6 flex flex-col gap-4 overflow-y-auto">
              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    مراجعة وتأكيد التبديل الفوري
                  </h4>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-500/5 text-xs">
                    استبدال متكافئ 1:1
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Original Billboard */}
                  <div className="p-3.5 rounded-xl bg-card border border-destructive/30 space-y-2">
                    <span className="text-xs text-destructive font-semibold flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-destructive" />
                      اللوحة الحالية (ستتحرر وتصبح متاحة):
                    </span>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden shrink-0 border border-border">
                        <BillboardImage billboard={originalBillboard} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <strong className="text-xs text-foreground block truncate">
                          {originalBillboard?.Billboard_Name || `#${originalBillboard?.ID}`}
                        </strong>
                        <p className="text-[11px] text-muted-foreground">
                          {originalBillboard?.Size} • {originalBillboard?.City}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Replacement Billboard */}
                  <div className="p-3.5 rounded-xl bg-card border border-emerald-500/40 space-y-2">
                    <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      اللوحة البديلة (ستصبح مؤجرة داخل العقد):
                    </span>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden shrink-0 border border-emerald-500/30">
                        <BillboardImage billboard={selectedCandidate} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <strong className="text-xs text-foreground block truncate">
                          {selectedCandidate?.Billboard_Name || `#${selectedCandidate?.ID}`}
                        </strong>
                        <p className="text-[11px] text-muted-foreground">
                          {selectedCandidate?.Size} • {selectedCandidate?.City}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Clear Financial Invariant Confirmation */}
                <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/25 space-y-1.5 text-xs">
                  <div className="font-bold text-primary flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    <span>الضمان المالي لعملية التبديل الفوري:</span>
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    عملية التبديل الفوري هي إحلال مباشر للوحة البديلة في موضع اللوحة الحالية. يستمر العقد بنفس
                    السعر المتفق عليه (<strong className="text-foreground">{effectiveContractedPrice.toLocaleString('ar-LY')} د.ل</strong>)
                    وبنفس الفترة التعاقدية دون أي تغيير في إجمالي العقد (فرق العقد: 0.00 د.ل) ودون الدخول في حسابات
                    الإيقاف أو الاسترداد.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <DialogFooter className="p-3 bg-muted/20 border-t border-border flex items-center justify-between">
            {!isConfirmStep ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  disabled={isExecuting}
                  className="cursor-pointer"
                >
                  إلغاء
                </Button>
                <Button
                  size="sm"
                  disabled={!selectedCandidate || isExecuting}
                  onClick={() => setIsConfirmStep(true)}
                  className="gap-1.5 cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                >
                  <span>متابعة الاستبدال</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsConfirmStep(false)}
                  disabled={isExecuting}
                  className="cursor-pointer"
                >
                  رجوع
                </Button>
                <Button
                  size="sm"
                  disabled={isExecuting}
                  onClick={handleExecuteSwap}
                  className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md cursor-pointer"
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري تنفيذ التبديل الذري...</span>
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

      {/* Image Preview Sub-Dialog */}
      {previewImageBillboard && (
        <Dialog open={!!previewImageBillboard} onOpenChange={() => setPreviewImageBillboard(null)}>
          <DialogContent className="max-w-2xl p-0 overflow-hidden bg-black/95 border-border" dir="rtl">
            <DialogTitle className="sr-only">معاينة صورة اللوحة الإعلانية</DialogTitle>
            <DialogDescription className="sr-only">صورة مكبرة للوحة الإعلانية بدقة عالية</DialogDescription>
            <div className="relative">
              <div className="p-3 bg-black/60 text-white flex items-center justify-between border-b border-white/10">
                <div>
                  <strong className="text-sm block">
                    {previewImageBillboard?.Billboard_Name || `لوحة #${previewImageBillboard?.ID}`}
                  </strong>
                  <span className="text-xs text-white/70">
                    {previewImageBillboard?.Size} • {previewImageBillboard?.City}
                  </span>
                </div>
                <button
                  onClick={() => setPreviewImageBillboard(null)}
                  className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="max-h-[70vh] flex items-center justify-center p-4">
                <BillboardImage
                  billboard={previewImageBillboard}
                  className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-lg"
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
