// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Check, 
  X, 
  Repeat2, 
  AlertTriangle, 
  Calendar, 
  MapPin, 
  Ruler, 
  Star,
  Layers,
  Coins,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Clock,
  SlidersHorizontal,
  ChevronLeft
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { createReplacement } from '@/services/pausedBillboardReplacementService';
import { formatAmount } from '@/lib/formatUtils';
import { toast } from 'sonner';
import { BillboardImage } from '@/components/BillboardImage';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pausedBillboardId: string;
  contractNumber: number;
  contractEndDate: string;
  pauseDate: string;
  pausedBillboardName: string;
  remainingAmount: number;
  customerName?: string | null;
  adType?: string | null;
  onSaved?: () => void;
}

export function ReplacePausedBillboardDialog({
  open,
  onOpenChange,
  pausedBillboardId,
  contractNumber,
  contractEndDate,
  pauseDate,
  pausedBillboardName,
  remainingAmount,
  customerName,
  adType,
  onSaved,
}: Props) {
  const [all, setAll] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'booked'>('all');
  const [sortBy, setSortBy] = useState<'price-asc' | 'price-desc' | 'name' | 'default'>('default');
  const [picked, setPicked] = useState<any>(null);
  const [allocated, setAllocated] = useState<number>(0);
  const [startDate, setStartDate] = useState<string>(pauseDate || '');
  const [endDate, setEndDate] = useState<string>(contractEndDate || '');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPicked(null);
    setSearch('');
    setStatusFilter('all');
    setSortBy('default');
    setAllocated(Math.round(remainingAmount));
    setStartDate(pauseDate || '');
    setEndDate(contractEndDate || '');
    setNotes('');
    (async () => {
      const { data } = await supabase
        .from('billboards')
        .select('ID, Billboard_Name, City, Size, Price, Status, Contract_Number, Image_URL, Nearest_Landmark')
        .limit(5000);
      setAll(data || []);
    })();
  }, [open, remainingAmount, pauseDate, contractEndDate]);

  // Duration in days
  const durationDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = end.getTime() - start.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [startDate, endDate]);

  // Estimated cost of the selected replacement billboard
  const estimatedCost = useMemo(() => {
    if (!picked || durationDays <= 0) return 0;
    const monthlyPrice = Number(picked.Price) || 0;
    const dailyPrice = monthlyPrice / 30;
    return Math.round(dailyPrice * durationDays);
  }, [picked, durationDays]);

  // Financial variance (remaining amount - estimated cost)
  const financialVariance = useMemo(() => {
    return Math.round(remainingAmount - estimatedCost);
  }, [remainingAmount, estimatedCost]);

  // Automatically update allocated amount when estimated cost changes
  useEffect(() => {
    if (picked) {
      setAllocated(Math.min(Math.round(remainingAmount), estimatedCost || Math.round(remainingAmount)));
    }
  }, [picked, estimatedCost, remainingAmount]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = all;
    
    // Status Filter
    if (statusFilter === 'available') {
      list = list.filter((b) => !b.Contract_Number);
    } else if (statusFilter === 'booked') {
      list = list.filter((b) => b.Contract_Number);
    }

    if (q) {
      list = list.filter((b) =>
        [b.Billboard_Name, b.City, b.Size, b.Nearest_Landmark]
          .map((v: any) => String(v || ''))
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    }

    // Sorting
    const sorted = [...list];
    if (sortBy === 'price-asc') {
      sorted.sort((a, b) => (Number(a.Price) || 0) - (Number(b.Price) || 0));
    } else if (sortBy === 'price-desc') {
      sorted.sort((a, b) => (Number(b.Price) || 0) - (Number(a.Price) || 0));
    } else if (sortBy === 'name') {
      sorted.sort((a, b) => (a.Billboard_Name || '').localeCompare(b.Billboard_Name || ''));
    }
    
    return sorted.slice(0, 200);
  }, [all, search, statusFilter, sortBy]);

  const handleSave = async () => {
    if (!picked) {
      toast.error('اختر اللوحة البديلة');
      return;
    }
    if (!startDate || !endDate) {
      toast.error('تاريخ البداية والنهاية مطلوبان');
      return;
    }
    try {
      setSaving(true);
      await createReplacement({
        paused_billboard_id: pausedBillboardId,
        contract_number: contractNumber,
        replacement_billboard_id: Number(picked.ID),
        replacement_billboard_name: picked.Billboard_Name || null,
        start_date: startDate,
        end_date: endDate,
        allocated_amount: Number(allocated) || 0,
        notes: notes || null,
        customerName,
        adType,
      });
      toast.success('تم تسجيل اللوحة البديلة بنجاح');
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      toast.error('فشل الحفظ: ' + (e?.message || ''));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-6xl bg-card border-border h-[90vh] flex flex-col p-0 rounded-[28px] shadow-2xl overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4.5 border-b bg-gradient-to-r from-primary/5 to-transparent shrink-0">
          <DialogTitle className="flex items-center gap-3 text-xl font-bold">
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <Repeat2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <span className="font-extrabold tracking-tight">تبديل وهيكلة اللوحة الموقوفة</span>
              <p className="text-sm font-normal text-muted-foreground mt-0.5">
                اللوحة الموقوفة الحالية: <strong className="text-foreground">"{pausedBillboardName}"</strong> (العقد #{contractNumber})
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Master-Detail Layout Panel */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          
          {/* RIGHT SIDE: Master Billboard List (col-span-7) */}
          <div className="lg:col-span-7 flex flex-col h-full overflow-hidden p-6 border-l border-border/60">
            {/* Filters Bar */}
            <div className="space-y-3.5 shrink-0">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="ابحث بالاسم، المدينة، المقاس، أو أقرب نقطة..."
                    className="pr-10 h-11 text-xs rounded-xl border-border/80 bg-background focus-visible:ring-primary shadow-sm"
                  />
                </div>
                
                {/* Sorting Select */}
                <div className="relative shrink-0">
                  <select
                    value={sortBy}
                    onChange={(e: any) => setSortBy(e.target.value)}
                    className="h-11 px-3 pl-8 text-xs font-semibold rounded-xl border border-border/80 bg-background hover:bg-muted/40 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
                  >
                    <option value="default">الترتيب الافتراضي</option>
                    <option value="price-asc">السعر: من الأقل للأعلى</option>
                    <option value="price-desc">السعر: من الأعلى للأقل</option>
                    <option value="name">الاسم: أبجدياً</option>
                  </select>
                  <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Status Tabs */}
              <div className="bg-muted/60 p-1 rounded-xl flex gap-1 w-full justify-between sm:justify-start">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={cn(
                    "px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex-1 sm:flex-initial",
                    statusFilter === 'all' 
                      ? "bg-card text-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  الكل ({all.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('available')}
                  className={cn(
                    "px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex-1 sm:flex-initial",
                    statusFilter === 'available' 
                      ? "bg-emerald-500 text-white shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  متاحة ({all.filter(b => !b.Contract_Number).length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('booked')}
                  className={cn(
                    "px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex-1 sm:flex-initial",
                    statusFilter === 'booked' 
                      ? "bg-rose-500 text-white shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  غير متاحة ({all.filter(b => b.Contract_Number).length})
                </button>
              </div>
            </div>

            {/* Scrollable Billboards List */}
            <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-3">
              {filtered.map((b: any) => {
                const isSelected = picked?.ID === b.ID;
                const isBusy = b.Contract_Number && Number(b.Contract_Number) !== contractNumber;
                
                return (
                  <div
                    key={b.ID}
                    onClick={() => setPicked(b)}
                    className={cn(
                      "group cursor-pointer overflow-hidden border rounded-[20px] transition-all duration-300 hover:shadow-md flex h-[125px] relative",
                      isSelected 
                        ? "border-primary bg-primary/[0.02] ring-2 ring-primary/25 shadow-sm"
                        : "border-border/60 bg-card hover:bg-muted/20"
                    )}
                  >
                    <div className="flex w-full">
                      {/* Billboard Thumbnail */}
                      <div className="w-[110px] h-full relative bg-muted shrink-0 overflow-hidden">
                        <BillboardImage
                          billboard={b}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          alt={b.Billboard_Name}
                        />
                        <Badge variant="secondary" className="absolute top-1.5 right-1.5 text-[9px] px-1 py-0 h-4 shadow-sm bg-background/80">
                          #{b.ID}
                        </Badge>
                      </div>

                      {/* Details */}
                      <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-extrabold text-sm truncate group-hover:text-primary transition-colors">
                              {b.Billboard_Name}
                            </span>
                            <div className="shrink-0 flex gap-1">
                              {isBusy ? (
                                <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4.5 font-bold">
                                  محجوزة #{b.Contract_Number}
                                </Badge>
                              ) : (
                                <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] px-1.5 py-0 h-4.5 font-bold border-none">
                                  متاحة للتعاقد
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-1.5">
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                              <MapPin className="h-3 w-3 text-primary/70 shrink-0" />
                              <span className="truncate">{b.City}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                              <Ruler className="h-3 w-3 text-primary/70 shrink-0" />
                              <span>{b.Size}</span>
                            </div>
                            {b.Nearest_Landmark && (
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80 truncate col-span-2">
                                <Star className="h-3 w-3 text-amber-500 shrink-0" />
                                <span className="truncate">{b.Nearest_Landmark}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="border-t border-border/40 pt-2 flex items-center justify-between mt-1">
                          <span className="text-[9px] text-muted-foreground font-bold">السعر الشهري:</span>
                          <span className="text-xs font-black text-primary tabular-nums" dir="ltr">
                            {formatAmount(Number(b.Price) || 0)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Selected Checkmark overlay */}
                    {isSelected && (
                      <div className="absolute top-3 left-3 h-6 w-6 rounded-full bg-primary flex items-center justify-center shadow-md">
                        <Check className="h-3.5 w-3.5 text-primary-foreground stroke-[3.5px]" />
                      </div>
                    )}
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="text-center py-16 text-muted-foreground text-sm flex flex-col items-center justify-center gap-2">
                  <Layers className="h-10 w-10 opacity-30" />
                  <span>لا توجد لوحات تطابق هذا البحث أو التصفية.</span>
                </div>
              )}
            </div>
          </div>

          {/* LEFT SIDE: Detail, Configuration, and Real-Time Financial Comparison (col-span-5) */}
          <div className="lg:col-span-5 bg-muted/25 flex flex-col h-full overflow-hidden p-6">
            {!picked ? (
              /* Empty State Placeholder */
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-border/80 rounded-[22px] bg-card/50">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4 animate-bounce">
                  <Repeat2 className="h-7 w-7" />
                </div>
                <h3 className="font-extrabold text-sm text-foreground">لم يتم اختيار لوحة بديلة</h3>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-[250px] leading-relaxed">
                  الرجاء النقر فوق أحد الكروت في القائمة الجانبية لتخصيص عملية التبديل، وضبط التواريخ، ومراجعة الحسابات والفرق المالي مباشرة.
                </p>
                <div className="mt-4 flex items-center gap-1.5 text-[10px] text-primary/80 font-bold bg-primary/5 px-3 py-1.5 rounded-full border border-primary/10">
                  <ChevronLeft className="h-4 w-4" />
                  <span>تصفح اللوحات البديلة وحدد للبدء</span>
                </div>
              </div>
            ) : (
              /* Configuration and live comparison view */
              <div className="flex-1 flex flex-col overflow-y-auto space-y-4 pr-1">
                {/* 1. Comparison Card Banner */}
                <div className="bg-card border border-border/60 rounded-[22px] p-4 space-y-3.5 shadow-sm">
                  <div className="text-xs font-bold text-muted-foreground pb-2 border-b border-border/40 flex items-center gap-1.5">
                    <Repeat2 className="h-4.5 w-4.5 text-primary" />
                    مقارنة لوحة التبديل المحددة
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl bg-muted overflow-hidden shrink-0 border border-border/60">
                      <BillboardImage billboard={picked} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-extrabold text-xs flex items-center gap-1.5">
                        <span className="truncate">{picked.Billboard_Name}</span>
                        <Badge variant="outline" className="text-[9px] h-4 rounded-md">#{picked.ID}</Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1 flex flex-wrap gap-x-2">
                        <span>المدينة: {picked.City}</span>
                        <span>•</span>
                        <span>السعر: {formatAmount(Number(picked.Price) || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Interactive Calculator / Financial Preview */}
                <div className="bg-primary/[0.01] border-2 border-primary/20 rounded-[22px] p-4 space-y-3.5 shadow-inner">
                  <div className="text-xs font-black text-foreground flex items-center gap-1.5">
                    <Coins className="h-4.5 w-4.5 text-primary" />
                    الحسابات المالية والمدد (تحديث حي)
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {/* Remaining Credit */}
                    <div className="bg-card p-3 rounded-xl border border-border/40">
                      <div className="text-[9px] text-muted-foreground font-bold">الرصيد المتبقي بالكامل</div>
                      <div className="text-sm font-black text-foreground tabular-nums mt-1 text-primary" dir="ltr">
                        {formatAmount(remainingAmount)}
                      </div>
                    </div>

                    {/* Calculated Duration */}
                    <div className="bg-card p-3 rounded-xl border border-border/40">
                      <div className="text-[9px] text-muted-foreground font-bold">مدة التبديل المحسوبة</div>
                      <div className="text-sm font-black text-foreground tabular-nums mt-1 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{durationDays} يوم</span>
                      </div>
                    </div>

                    {/* Estimated Cost */}
                    <div className="bg-card p-3 rounded-xl border border-border/40 col-span-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] text-muted-foreground font-bold">تكلفة البديلة المتوقعة للمدة</span>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setAllocated(estimatedCost)}
                          className="h-5 text-[9px] px-1.5 text-primary font-bold hover:bg-primary/5 rounded"
                        >
                          تطبيق المبلغ المتوقع
                        </Button>
                      </div>
                      <div className="text-sm font-black text-foreground tabular-nums mt-1" dir="ltr">
                        {formatAmount(estimatedCost)}
                      </div>
                    </div>

                    {/* Financial Difference (Variance) */}
                    <div className={cn(
                      "p-3 rounded-xl border col-span-2 flex items-center justify-between",
                      financialVariance >= 0 
                        ? "bg-emerald-500/[0.02] border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        : "bg-rose-500/[0.02] border-rose-500/20 text-rose-600 dark:text-rose-400"
                    )}>
                      <div className="text-[9px] font-bold">الفرق المالي المتبقي (وفورات / عجز)</div>
                      <div className="flex items-center gap-1.5 font-black text-xs tabular-nums" dir="ltr">
                        {financialVariance >= 0 ? (
                          <TrendingDown className="h-4 w-4" />
                        ) : (
                          <TrendingUp className="h-4 w-4" />
                        )}
                        <span>{formatAmount(financialVariance)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Dates & Allocation settings form */}
                <div className="space-y-4 bg-card border border-border/60 p-4 rounded-[22px] shadow-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold flex items-center gap-1 text-foreground/80">
                        <Calendar className="h-3.5 w-3.5 text-primary" /> 
                        تاريخ البداية
                      </Label>
                      <Input 
                        type="date" 
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)} 
                        className="rounded-xl border-border/80 focus-visible:ring-primary h-10 text-xs"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold flex items-center gap-1 text-foreground/80">
                        <Calendar className="h-3.5 w-3.5 text-primary" /> 
                        تاريخ النهاية
                      </Label>
                      <Input 
                        type="date" 
                        value={endDate} 
                        onChange={(e) => setEndDate(e.target.value)} 
                        className="rounded-xl border-border/80 focus-visible:ring-primary h-10 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold flex items-center gap-1 text-foreground/80">
                      <Coins className="h-3.5 w-3.5 text-primary" />
                      المبلغ المعتمد للتخصيص
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={allocated}
                        onChange={(e) => setAllocated(Number(e.target.value) || 0)}
                        className="rounded-xl border-border/80 focus-visible:ring-primary h-10 text-xs flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setAllocated(Math.round(remainingAmount))}
                        className="rounded-xl shrink-0 h-10 text-[10px] bg-background hover:bg-muted"
                      >
                        المتبقي بالكامل
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-foreground/80">ملاحظات التبديل والتركيب (اختياري)</Label>
                    <Input 
                      value={notes} 
                      onChange={(e) => setNotes(e.target.value)} 
                      placeholder="أدخل أي ملاحظات للتوجيه لفرق التركيب..."
                      className="rounded-xl border-border/80 focus-visible:ring-primary h-10 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t bg-muted/40 shrink-0 gap-2 flex justify-between items-center w-full">
          <Button variant="ghost" className="rounded-xl font-bold h-11 border border-border/40 hover:bg-muted/80" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 ml-1.5" /> إلغاء وإغلاق
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!picked || saving}
            className="rounded-xl min-w-[130px] font-bold h-11 shadow-lg shadow-primary/10"
          >
            <Check className="w-4 h-4 ml-1.5" />
            {saving ? 'جاري الحفظ...' : 'تأكيد وحفظ البديل'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
