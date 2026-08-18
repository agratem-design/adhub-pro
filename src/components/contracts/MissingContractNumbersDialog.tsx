import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Hash,
  Search,
  Sparkles,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Plus,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { findContractGaps, isContractNumberAvailable, type ContractGap, type ContractGapsResult } from '@/services/contractNumberService';

interface MissingContractNumbersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectMissingNumber: (contractNumber: number, year: number | string) => void;
  initialYear?: number | 'all';
}

export function MissingContractNumbersDialog({
  open,
  onOpenChange,
  onSelectMissingNumber,
  initialYear,
}: MissingContractNumbersDialogProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(initialYear || currentYear);
  const [loading, setLoading] = useState<boolean>(false);
  const [gapsData, setGapsData] = useState<ContractGapsResult | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Manual custom number input
  const [manualNumber, setManualNumber] = useState<string>('');
  const [manualChecking, setManualChecking] = useState<boolean>(false);
  const [manualStatus, setManualStatus] = useState<{ checked: boolean; available: boolean; contract?: any } | null>(null);

  const loadGaps = async (year: number | 'all') => {
    setLoading(true);
    try {
      const result = await findContractGaps(year);
      setGapsData(result);
    } catch (err) {
      toast.error('حدث خطأ أثناء فحص أرقام العقود');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadGaps(selectedYear);
      setManualNumber('');
      setManualStatus(null);
    }
  }, [open, selectedYear]);

  // Check manual custom number availability
  const checkManualAvailability = async () => {
    const num = parseInt(manualNumber.trim(), 10);
    if (!num || num <= 0) {
      toast.error('يرجى إدخال رقم عقد صحيح');
      return;
    }
    setManualChecking(true);
    try {
      const res = await isContractNumberAvailable(num);
      setManualStatus({ checked: true, available: res.available, contract: res.contract });
    } catch (e) {
      toast.error('فشل فحص توفر الرقم');
    } finally {
      setManualChecking(false);
    }
  };

  const handleSelectGap = (gapNumber: number, gapYear: number) => {
    onSelectMissingNumber(gapNumber, gapYear);
    onOpenChange(false);
    toast.success(`تم اختيار الرقم المتروك #${gapNumber} للعقد الجديد`);
  };

  const handleApplyManualNumber = () => {
    const num = parseInt(manualNumber.trim(), 10);
    if (!num || !manualStatus?.available) return;
    const targetY = typeof selectedYear === 'number' ? selectedYear : currentYear;
    onSelectMissingNumber(num, targetY);
    onOpenChange(false);
    toast.success(`تم اختيار الرقم المخصص #${num} للعقد الجديد`);
  };

  const filteredGaps = useMemo(() => {
    if (!gapsData?.gaps) return [];
    if (!searchFilter.trim()) return gapsData.gaps;
    const q = searchFilter.trim();
    return gapsData.gaps.filter(
      (g) =>
        String(g.number).includes(q) ||
        g.previousContract?.customerName?.toLowerCase().includes(q.toLowerCase()) ||
        g.nextContract?.customerName?.toLowerCase().includes(q.toLowerCase())
    );
  }, [gapsData, searchFilter]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background text-foreground border-border shadow-2xl rounded-2xl" dir="rtl">
        {/* Header */}
        <DialogHeader className="p-5 border-b border-border/60 bg-gradient-to-l from-amber-500/10 via-background to-background shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Hash className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  إضافة عقد لرقم ناقص (كاشف الفجوات)
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  البحث التلقائي عن الأرقام التسلسلية المتروكة بين أول عقد وآخر عقد في السنة
                </DialogDescription>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full w-8 h-8 hover:bg-muted"
              onClick={() => loadGaps(selectedYear)}
              disabled={loading}
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Year selector & Quick stats */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-border/40">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">السنة المستهدفة:</span>
              <Select
                value={String(selectedYear)}
                onValueChange={(val) => setSelectedYear(val === 'all' ? 'all' : Number(val))}
              >
                <SelectTrigger className="h-8 w-32 text-xs font-bold rounded-lg border-amber-500/30 bg-background focus:ring-amber-500/30">
                  <SelectValue placeholder="اختر السنة" />
                </SelectTrigger>
                <SelectContent className="z-[10000]">
                  <SelectItem value="all">جميع السنوات</SelectItem>
                  {(gapsData?.availableYears || [currentYear]).map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      سنة {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {gapsData && gapsData.totalContracts > 0 && (
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span>أول عقد: <strong className="text-foreground font-bold">#{gapsData.minNumber}</strong></span>
                <span>•</span>
                <span>آخر عقد: <strong className="text-foreground font-bold">#{gapsData.maxNumber}</strong></span>
                <span>•</span>
                <span>المسجلة: <strong className="text-foreground font-bold">{gapsData.totalContracts}</strong></span>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Summary Box */}
          {gapsData && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-muted/40 border border-border/60 rounded-xl p-3 text-center">
                <div className="text-[11px] text-muted-foreground font-medium">نطاق الترقيم</div>
                <div className="text-sm font-bold text-foreground mt-0.5" dir="ltr">
                  {gapsData.minNumber > 0 ? `#${gapsData.minNumber} → #${gapsData.maxNumber}` : '—'}
                </div>
              </div>

              <div className="bg-muted/40 border border-border/60 rounded-xl p-3 text-center">
                <div className="text-[11px] text-muted-foreground font-medium">العقود الموجودة</div>
                <div className="text-sm font-bold text-foreground mt-0.5">
                  {gapsData.totalContracts} عقد
                </div>
              </div>

              <div className={`border rounded-xl p-3 text-center ${gapsData.gaps.length > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
                <div className="text-[11px] font-medium text-muted-foreground">الفجوات المتروكة</div>
                <div className={`text-base font-extrabold mt-0.5 ${gapsData.gaps.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {gapsData.gaps.length > 0 ? `${gapsData.gaps.length} رقم مفقود` : 'لا توجد فجوات ✓'}
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto" />
              <p className="text-sm text-muted-foreground">جاري فحص وتدقيق تسلسل العقود بحثاً عن أي أرقام متروكة...</p>
            </div>
          )}

          {/* List of Gaps */}
          {!loading && gapsData && gapsData.gaps.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  الأرقام المتروكة المتاحة للاستخدام ({filteredGaps.length}):
                </h4>

                {gapsData.gaps.length > 6 && (
                  <div className="relative w-44">
                    <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="بحث عن رقم..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="h-7 pr-8 text-xs rounded-lg bg-background"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[260px] overflow-y-auto p-0.5">
                {filteredGaps.map((gap) => (
                  <div
                    key={gap.number}
                    className="group border border-border/70 hover:border-amber-500/50 bg-card hover:bg-amber-500/5 p-3 rounded-xl transition-all shadow-sm flex flex-col justify-between gap-2.5"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 font-extrabold text-sm border border-amber-500/30">
                          #{gap.number}
                        </div>
                        <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/60">
                          سنة {gap.year}
                        </Badge>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleSelectGap(gap.number, gap.year)}
                        className="h-7 px-3 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black shadow-sm gap-1 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>استخدام</span>
                      </Button>
                    </div>

                    <div className="text-[11px] text-muted-foreground bg-muted/30 p-2 rounded-lg space-y-0.5">
                      {gap.previousContract && (
                        <div className="truncate">
                          السابق: <strong className="text-foreground">#{gap.previousContract.number}</strong> ({gap.previousContract.customerName})
                        </div>
                      )}
                      {gap.nextContract && (
                        <div className="truncate">
                          التالي: <strong className="text-foreground">#{gap.nextContract.number}</strong> ({gap.nextContract.customerName})
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty Gaps State */}
          {!loading && gapsData && gapsData.gaps.length === 0 && (
            <div className="py-8 px-4 text-center border border-dashed border-emerald-500/30 rounded-xl bg-emerald-500/5 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h4 className="font-bold text-sm text-foreground">
                التسلسل منتظم تماماً ولا توجد أرقام مفقودة
              </h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                {selectedYear === 'all'
                  ? 'جميع الأرقام التسلسلية من أول عقد إلى آخر عقد متسلسلة بدون أي فجوات.'
                  : `تسلسل العقود في سنة ${selectedYear} منتظم من العقد #${gapsData.minNumber} حتى العقد #${gapsData.maxNumber}.`}
              </p>
            </div>
          )}

          {/* Manual Number Section */}
          <div className="pt-3 border-t border-border/60">
            <h4 className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-primary" />
              أو إدخال رقم عقد مخصص يدوياً:
            </h4>

            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="أدخل رقم العقد (مثال: 55)"
                value={manualNumber}
                onChange={(e) => {
                  setManualNumber(e.target.value);
                  setManualStatus(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    checkManualAvailability();
                  }
                }}
                className="h-9 text-sm rounded-xl"
              />

              <Button
                type="button"
                variant="outline"
                onClick={checkManualAvailability}
                disabled={manualChecking || !manualNumber.trim()}
                className="h-9 text-xs font-bold px-4 rounded-xl shrink-0"
              >
                {manualChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'فحص التوفر'}
              </Button>
            </div>

            {manualStatus && (
              <div className="mt-2 text-xs">
                {manualStatus.available ? (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>الرقم #{manualNumber} متاح وغير مستخدم!</span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleApplyManualNumber}
                      className="h-7 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      تأكيد واستخدام
                    </Button>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>
                      الرقم #{manualNumber} مستخدم بالفعل (مسجل لـ "{manualStatus.contract?.['Customer Name'] || 'عميل'}" بتاريخ {manualStatus.contract?.['Contract Date'] || '—'}).
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/60 bg-muted/20 flex justify-end shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl px-5 text-xs font-bold"
          >
            إغلاق
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
