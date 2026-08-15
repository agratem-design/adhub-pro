import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Globe, Search, Eye, Clock, Building2, Calendar, CheckCircle2, Loader2, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { smartArabicMatch } from '@/lib/arabicSearch';

interface ActiveContractItem {
  contractNumber: number | string;
  customerName: string;
  adType: string;
  endDate: string;
  billboardCount: number;
  isForcedVisible: boolean; // moxharah fi al-muta7 yadawiyan
  isExpiringSoon: boolean;  // stota7 qareeban
  daysRemaining?: number;
}

interface UploadAvailablePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monthsAhead: number;
  billboards: any[];
  isContractExpired: (endDate: string | null) => boolean;
  onConfirmUpload: (monthsAhead: number) => Promise<void>;
}

export const UploadAvailablePreviewDialog: React.FC<UploadAvailablePreviewDialogProps> = ({
  open,
  onOpenChange,
  monthsAhead,
  billboards,
  isContractExpired,
  onConfirmUpload,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [contractTab, setContractTab] = useState<'forced' | 'expiring' | 'all'>('forced');

  const [stats, setStats] = useState({
    totalExportCount: 0,
    availableWithoutContractCount: 0,
    forcedVisibleCount: 0,
    expiringSoonCount: 0,
  });

  const [activeContractsList, setActiveContractsList] = useState<ActiveContractItem[]>([]);

  // Load contracts and analyze billboards when dialog opens
  useEffect(() => {
    if (!open) return;

    let isMounted = true;
    const analyzeData = async () => {
      setLoadingData(true);
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const months = Math.max(1, Math.floor(Number(monthsAhead) || 4));
        const futureLimit = new Date();
        futureLimit.setMonth(futureLimit.getMonth() + months);

        // Fetch active contracts from Supabase
        const { data: contractsData, error } = await supabase
          .from('Contract')
          .select('Contract_Number, "Contract Date", "End Date", "Customer Name", "Ad Type", billboard_ids, billboard_prices');

        if (error) console.warn('Error fetching contracts for preview:', error);

        // جمع IDs جميع لوحات العقود النشطة
        const allContractBillboardIds: number[] = [];
        (contractsData || []).forEach((c: any) => {
          const ids = String(c.billboard_ids || '')
            .split(',')
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
          allContractBillboardIds.push(...ids);
        });

        // جلب is_visible_in_available مباشرةً من DB لجميع لوحات العقود
        const forcedVisibleSet = new Set<string>(); // IDs اللوحات المُفعَّل فيها الإظهار
        const hiddenSet = new Set<string>();         // IDs اللوحات المخفية يدوياً

        if (allContractBillboardIds.length > 0) {
          const { data: bbVisibility } = await supabase
            .from('billboards')
            .select('ID, is_visible_in_available')
            .in('ID', allContractBillboardIds);

          (bbVisibility || []).forEach((b: any) => {
            if (b.is_visible_in_available === true) forcedVisibleSet.add(String(b.ID));
            if (b.is_visible_in_available === false) hiddenSet.add(String(b.ID));
          });
        }

        // بناء خريطة per-contract: العقد مُفعَّل الإظهار فقط إذا كانت جميع لوحاته الخاصة به true
        // هذا يمنع اللوحات المشتركة بين عقود متعددة من تعليم عقود أخرى كـ "مُفعَّل الإظهار" خطأً
        const contractForcedMap = new Map<string, boolean>();
        (contractsData || []).forEach((c: any) => {
          const contractNum = String(c.Contract_Number);
          const cIds = String(c.billboard_ids || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          if (cIds.length === 0) {
            contractForcedMap.set(contractNum, false);
            return;
          }
          // العقد مُفعَّل فقط إذا كانت جميع لوحاته true في DB
          const allForced = cIds.length > 0 && cIds.every((id) => forcedVisibleSet.has(id));
          contractForcedMap.set(contractNum, allForced);
        });

        // Map billboardId -> Array of active contracts
        const billboardActiveContractsMap = new Map<string, Array<{
          contractNumber: number | string;
          customerName: string;
          adType: string;
          endDate: string;
          isUpcoming: boolean;
          isContractForced: boolean;
        }>>();

        (contractsData || []).forEach((c: any) => {
          const cEndDate = c['End Date'] || '';
          const isExpired = cEndDate ? isContractExpired(cEndDate) : false;
          if (isExpired) return;

          const contractNumber = c.Contract_Number;
          const isContractForced = contractForcedMap.get(String(contractNumber)) === true;

          const ids = String(c.billboard_ids || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);

          let billboardPricesParsed: any[] = [];
          if (c.billboard_prices) {
            try {
              billboardPricesParsed = typeof c.billboard_prices === 'string'
                ? JSON.parse(c.billboard_prices)
                : c.billboard_prices;
            } catch {}
          }

          ids.forEach((id) => {
            let customEnd = '';
            if (Array.isArray(billboardPricesParsed)) {
              const match = billboardPricesParsed.find((p: any) => String(p.billboardId || p.billboard_id || '') === String(id));
              if (match && match.endDate) customEnd = match.endDate;
            }

            const effectiveEnd = customEnd || cEndDate;
            if (effectiveEnd && isContractExpired(effectiveEnd)) return;

            let isUpcoming = false;
            if (effectiveEnd) {
              try {
                const ed = new Date(effectiveEnd);
                if (ed <= futureLimit) {
                  isUpcoming = true;
                }
              } catch {}
            }

            const existingList = billboardActiveContractsMap.get(String(id)) || [];
            existingList.push({
              contractNumber,
              customerName: c['Customer Name'] || 'غير محدد',
              adType: c['Ad Type'] || '',
              endDate: effectiveEnd,
              isUpcoming,
              isContractForced,
            });
            billboardActiveContractsMap.set(String(id), existingList);
          });
        });

        let total = 0;
        let availNoContract = 0;
        let forcedCount = 0;
        let expiringCount = 0;

        const contractsAggMap = new Map<string | number, ActiveContractItem>();

        (billboards || []).forEach((b: any) => {
          const bId = String(b.ID ?? b.id ?? '').trim();
          const status = String(b.Status || b.status || '').trim();
          const maint = String(b.maintenance_status || '').trim();

          // استخدام قيم DB المُحدَّثة مباشرةً بدلاً من props
          const isHiddenByUser = hiddenSet.has(bId) || b.is_visible === false || status === 'مخفي' || maint === 'hidden' || maint === 'مخفي';
          if (isHiddenByUser) return;

          const activeContracts = billboardActiveContractsMap.get(bId) || [];
          const hasActive = activeContracts.length > 0 || Boolean(b.Contract_Number && String(b.Contract_Number) !== '0' && !isContractExpired(b.Rent_End_Date || b.rent_end_date));

          // ✅ قاعدة اللوحات المشتركة: الإخفاء يغلب الإظهار!
          // إذا كانت اللوحة مرتبطة بأي عقد نشط (ساري المفعول، غير قادم الانتهاء، وغير مُفعَّل الإظهار)،
          // تُعتبر اللوحة مخفية وتُستثنى من التصدير للمتاح
          const isHiddenByActiveContract = activeContracts.some(
            (ac) => !ac.isUpcoming && !ac.isContractForced
          );

          if (isHiddenByActiveContract) return;

          const firstActive = activeContracts[0];
          const contractNumber = firstActive?.contractNumber || b.Contract_Number;
          const endDateStr = firstActive?.endDate || b.Rent_End_Date || b.rent_end_date || '';
          const customerName = firstActive?.customerName || b.Customer_Name || b.customer_name || 'غير محدد';
          const adType = firstActive?.adType || b.Ad_Type || b.ad_type || '';

          const isBillboardForced = forcedVisibleSet.has(bId);
          const isContractForced = contractNumber ? contractForcedMap.get(String(contractNumber)) === true : false;
          const isForced = isContractForced;

          let isUpcoming = activeContracts.some((ac) => ac.isUpcoming);
          if (!isUpcoming && hasActive && endDateStr) {
            try {
              const ed = new Date(endDateStr);
              if (ed <= futureLimit) {
                isUpcoming = true;
              }
            } catch {}
          }

          // تضمين اللوحة: مُعلَّمة بشكل فردي true OR ليس لها عقد نشط OR عقدها قادم الانتهاء
          const isIncluded = isBillboardForced || !hasActive || isUpcoming;
          if (!isIncluded) return;

          total++;

          if (isBillboardForced) {
            forcedCount++;
          } else if (!hasActive) {
            availNoContract++;
          } else if (isUpcoming) {
            expiringCount++;
          }

          // Group active contracts
          if (hasActive && contractNumber) {
            const key = String(contractNumber);
            let daysRemaining: number | undefined = undefined;
            if (endDateStr) {
              try {
                const ed = new Date(endDateStr);
                daysRemaining = Math.ceil((ed.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              } catch {}
            }

            const existing = contractsAggMap.get(key);
            if (existing) {
              existing.billboardCount++;
              if (isForced) existing.isForcedVisible = true;
              if (isUpcoming) existing.isExpiringSoon = true;
            } else {
              contractsAggMap.set(key, {
                contractNumber,
                customerName,
                adType,
                endDate: endDateStr,
                billboardCount: 1,
                isForcedVisible: isForced,
                isExpiringSoon: isUpcoming,
                daysRemaining,
              });
            }
          }
        });

        const activeList = Array.from(contractsAggMap.values()).sort((a, b) => {
          if (a.isForcedVisible && !b.isForcedVisible) return -1;
          if (!a.isForcedVisible && b.isForcedVisible) return 1;
          return b.billboardCount - a.billboardCount;
        });

        if (isMounted) {
          setStats({
            totalExportCount: total,
            availableWithoutContractCount: availNoContract,
            forcedVisibleCount: forcedCount,
            expiringSoonCount: expiringCount,
          });
          setActiveContractsList(activeList);
        }
      } catch (e) {
        console.error('Error analyzing preview data:', e);
      } finally {
        if (isMounted) setLoadingData(false);
      }
    };

    analyzeData();

    return () => {
      isMounted = false;
    };
  }, [open, billboards, monthsAhead, isContractExpired]);

  // Derived lists by category
  const forcedContracts = useMemo(() => {
    return activeContractsList.filter((c) => c.isForcedVisible);
  }, [activeContractsList]);

  const expiringContracts = useMemo(() => {
    return activeContractsList.filter((c) => c.isExpiringSoon && !c.isForcedVisible);
  }, [activeContractsList]);

  // Filtered contracts by tab and search query
  const filteredContracts = useMemo(() => {
    let source = activeContractsList;
    if (contractTab === 'forced') {
      source = forcedContracts;
    } else if (contractTab === 'expiring') {
      source = expiringContracts;
    }

    if (!searchQuery.trim()) return source;
    return source.filter((c) =>
      smartArabicMatch(
        [c.contractNumber, c.customerName, c.adType],
        searchQuery
      )
    );
  }, [activeContractsList, forcedContracts, expiringContracts, contractTab, searchQuery]);

  const handleConfirm = async () => {
    setIsUploading(true);
    try {
      await onConfirmUpload(monthsAhead);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !isUploading && onOpenChange(val)}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-card border-border shadow-2xl">
        {/* Header */}
        <DialogHeader className="pb-3 border-b border-border/80">
          <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Globe className="h-5 w-5" />
            </div>
            معاينة العقود واللوحات قبل الرفع إلى الموقع
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            عرض العقود المفعل فيها خيار "إظهار اللوحات في المتاح" والعقود الفعالة القادمة ({monthsAhead} أشهر)
          </p>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-4 py-3 px-1">
          {loadingData ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              <p className="text-xs font-medium">جاري تحليل بيانات العقود واللوحات...</p>
            </div>
          ) : (
            <>
              {/* Stats Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col">
                  <span className="text-xs text-muted-foreground font-medium">إجمالي المرفوع</span>
                  <span className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">
                    {stats.totalExportCount} <span className="text-xs font-normal text-slate-500">لوحة</span>
                  </span>
                </div>

                <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-200/60 dark:border-emerald-900/50 flex flex-col">
                  <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">متاحة بدون عقد</span>
                  <span className="text-xl font-bold text-emerald-800 dark:text-emerald-300 mt-1">
                    {stats.availableWithoutContractCount} <span className="text-xs font-normal text-emerald-600">لوحة</span>
                  </span>
                </div>

                <div className="bg-purple-50/60 dark:bg-purple-950/30 p-3 rounded-xl border border-purple-200/60 dark:border-purple-900/50 flex flex-col">
                  <span className="text-xs text-purple-700 dark:text-purple-400 font-medium flex items-center gap-1">
                    <Eye className="h-3 w-3" /> مظهرة يدوياً
                  </span>
                  <span className="text-xl font-bold text-purple-800 dark:text-purple-300 mt-1">
                    {stats.forcedVisibleCount} <span className="text-xs font-normal text-purple-600">لوحة</span>
                  </span>
                </div>

                <div className="bg-amber-50/60 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200/60 dark:border-amber-900/50 flex flex-col">
                  <span className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3" /> تنتهي قريباً
                  </span>
                  <span className="text-xl font-bold text-amber-800 dark:text-amber-300 mt-1">
                    {stats.expiringSoonCount} <span className="text-xs font-normal text-amber-600">لوحة</span>
                  </span>
                </div>
              </div>

              {/* Tabs & Search Filter */}
              <div className="space-y-2.5">
                <Tabs value={contractTab} onValueChange={(val) => setContractTab(val as any)} className="w-full">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <TabsList className="bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-3 w-full sm:w-auto">
                      <TabsTrigger
                        value="forced"
                        className="text-xs gap-1.5 font-bold data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded-lg transition-all"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        مظهرة في المتاح ({forcedContracts.length})
                      </TabsTrigger>
                      <TabsTrigger
                        value="expiring"
                        className="text-xs gap-1.5 font-bold data-[state=active]:bg-amber-600 data-[state=active]:text-white rounded-lg transition-all"
                      >
                        <Clock className="h-3.5 w-3.5" />
                        ستتاح قريباً ({expiringContracts.length})
                      </TabsTrigger>
                      <TabsTrigger
                        value="all"
                        className="text-xs gap-1.5 font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg transition-all"
                      >
                        الكل ({activeContractsList.length})
                      </TabsTrigger>
                    </TabsList>

                    {/* Search Bar */}
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="بحث برقم العقد أو اسم العميل..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pr-8 h-8 text-xs bg-background"
                      />
                    </div>
                  </div>
                </Tabs>

                {/* Sub-header description depending on active tab */}
                <div className="text-xs text-muted-foreground font-medium px-1 flex items-center gap-1.5">
                  {contractTab === 'forced' && (
                    <>
                      <Eye className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                      <span>عرض العقود المفعل فيها خيار "إظهار اللوحات في المتاح" من صفحة العقود ({forcedContracts.length} عقد)</span>
                    </>
                  )}
                  {contractTab === 'expiring' && (
                    <>
                      <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      <span>عرض العقود الفعالة التي تنتهي خلال نافذة التصدير ({expiringContracts.length} عقد)</span>
                    </>
                  )}
                  {contractTab === 'all' && (
                    <>
                      <Building2 className="h-3.5 w-3.5 text-primary" />
                      <span>عرض جميع العقود الفعالة المشمولة ({activeContractsList.length} عقد)</span>
                    </>
                  )}
                </div>

                {/* Table of Contracts */}
                {filteredContracts.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-muted-foreground text-xs">
                    {searchQuery
                      ? 'لا توجد عقود تطابق بحثك'
                      : contractTab === 'forced'
                      ? 'لا توجد عقود مفعّل فيها خيار الإظهار في المتاح حالياً'
                      : 'لا توجد عقود في هذه الفئة'}
                  </div>
                ) : (
                  <ScrollArea className="h-[280px] rounded-xl border border-border bg-background">
                    <div className="divide-y divide-border/60">
                      {filteredContracts.map((c) => (
                        <div
                          key={String(c.contractNumber)}
                          className="p-3 hover:bg-muted/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          {/* Left info: Contract # and Customer */}
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="font-mono text-xs font-bold px-2 py-0.5 border-primary/40 text-primary bg-primary/5 shrink-0">
                              عقد {c.contractNumber}
                            </Badge>

                            <div>
                              <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                                {c.customerName}
                                {c.adType && (
                                  <span className="text-xs font-normal text-muted-foreground">({c.adType})</span>
                                )}
                              </div>
                              {c.endDate && (
                                <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Calendar className="h-3 w-3 text-slate-400" />
                                  ينتهي: {c.endDate}
                                  {c.daysRemaining !== undefined && c.daysRemaining > 0 && (
                                    <span className="text-amber-600 dark:text-amber-400">
                                      (متبقي {c.daysRemaining} يوم)
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right info: Billboard count & Badges */}
                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            {c.isForcedVisible && (
                              <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800 text-[11px] font-medium gap-1">
                                <Eye className="h-3 w-3" /> مظهرة في المتاح
                              </Badge>
                            )}
                            {c.isExpiringSoon && !c.isForcedVisible && (
                              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 text-[11px] font-medium gap-1">
                                <Clock className="h-3 w-3" /> ستتاح قريباً
                              </Badge>
                            )}

                            <Badge variant="secondary" className="font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                              {c.billboardCount} لوحة
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="pt-3 border-t border-border flex-col sm:flex-row gap-2 sm:justify-between items-center">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>جاهز للرفع والتحديث المباشر للموقع الإلكتروني</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isUploading}
              className="text-xs"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isUploading || loadingData}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 text-xs font-bold min-w-[140px]"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري الرفع...
                </>
              ) : (
                <>
                  <Globe className="h-4 w-4" />
                  تأكيد والرفع للموقع
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
