import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Globe, Search, Eye, Clock, Building2, Calendar, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { smartArabicMatch } from '@/lib/arabicSearch';
import { 
  resolveBillboardAvailability, 
  resolveContractMarketingVisibility,
  normalizeDateOnly,
  addCalendarMonths,
  ContractMarketingVisibilityState
} from '@/services/billboardAvailabilityService';

export interface ContractPreviewGroup {
  contractNumber: number | string;
  customerName: string;
  adType: string;
  startDate?: string | null;
  endDate: string;
  isExpired: boolean;
  marketingState: ContractMarketingVisibilityState;
  requestedForceShowCount: number;
  blockedByOtherContractsCount: number;
  effectiveForceShowCount: number;
  forceShowCount: number; // Alias for effectiveForceShowCount
  totalBillboards: number;
  eligibleBillboardsCount: number;
  isExplicitlyShown: boolean; // Non-expired active contract with >= 1 effective FORCE_SHOW billboard
  isUpcomingContract: boolean; // Non-expired active contract ending within upcoming window
  daysRemaining?: number;
}

export interface BillboardSummaryStats {
  totalBillboards: number;
  availableWithoutContractBillboards: number;
  marketingVisibleBillboards: number;
  upcomingBillboards: number;
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

  const [stats, setStats] = useState<BillboardSummaryStats>({
    totalBillboards: 0,
    availableWithoutContractBillboards: 0,
    marketingVisibleBillboards: 0,
    upcomingBillboards: 0,
  });

  const [contractGroupsList, setContractGroupsList] = useState<ContractPreviewGroup[]>([]);

  // Load contracts and analyze billboards when dialog opens
  useEffect(() => {
    if (!open) return;

    let isMounted = true;
    const analyzeData = async () => {
      setLoadingData(true);
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = normalizeDateOnly(today)!;

        const months = Math.max(1, Math.floor(Number(monthsAhead) || 4));
        const futureLimitStr = addCalendarMonths(todayStr, months);

        // 1. Fetch valid contracts from Supabase (excluding deleted/released)
        const { data: contractsData, error: contractsErr } = await supabase
          .from('Contract')
          .select('Contract_Number, "Contract Date", "End Date", "Customer Name", "Ad Type", billboard_ids, billboard_prices, billboards_released, is_visible_in_available')
          .order('Contract_Number', { ascending: false });

        if (contractsErr) {
          console.error('Error fetching contracts for preview:', contractsErr);
        }
        const validContracts = (contractsData || []).filter(
          (c: any) => c.billboards_released !== true
        );

        // 2. Fetch latest visibility flags for all billboards from DB
        const { data: bbRows, error: bbErr } = await supabase
          .from('billboards')
          .select('ID, Billboard_Name, Status, Contract_Number, Rent_Start_Date, Rent_End_Date, is_visible_in_available, maintenance_status, friend_company_id');

        if (bbErr) {
          console.error('Error fetching billboards for preview:', bbErr);
        }

        const bbMap = new Map<string, any>();
        (bbRows || []).forEach((b: any) => {
          bbMap.set(String(b.ID), b);
        });

        // Merge latest DB fields into billboards array
        const mergedBillboards = (billboards || []).map((b: any) => {
          const id = String(b.ID ?? b.id ?? '');
          const dbData = bbMap.get(id);
          return dbData ? { ...b, ...dbData } : b;
        });

        // 3. Resolve all billboard rows individually through unified engine
        let totalCount = 0;
        let availNoContractCount = 0;
        let forcedCount = 0;
        let expiringCount = 0;

        const eligibleBillboardIds = new Set<string>();

        mergedBillboards.forEach((b: any) => {
          const res = resolveBillboardAvailability(b, validContracts, {
            referenceDate: todayStr,
            upcomingMonthsWindow: months,
          });

          if (res.isMarketingVisible) {
            totalCount++;
            eligibleBillboardIds.add(res.billboardId);

            if (res.classification === 'EXPLICIT_CONTRACT_SHOW' || res.classification === 'EXPLICIT_BILLBOARD_SHOW') {
              forcedCount++;
            } else if (res.classification === 'AVAILABLE_WITHOUT_CONTRACT') {
              availNoContractCount++;
            } else if (res.classification === 'UPCOMING') {
              expiringCount++;
            }
          }
        });

        // 4. Build contract groups from active/non-expired contracts only
        const activeGroups: ContractPreviewGroup[] = [];

        validContracts.forEach((c: any) => {
          const contractNum = c.Contract_Number;
          const cIds = String(c.billboard_ids || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);

          if (cIds.length === 0) return;

          const endDateStr = c['End Date'] || '';
          const normEnd = normalizeDateOnly(endDateStr);
          const isExpired = normEnd ? normEnd < todayStr : false;

          // Build billboard rows for this contract to resolve marketing visibility
          const contractBbRows = cIds.map((id) => {
            const bb = bbMap.get(id);
            return {
              ID: id,
              Billboard_Name: bb?.Billboard_Name,
              Status: bb?.Status,
              Contract_Number: bb?.Contract_Number,
              Rent_End_Date: bb?.Rent_End_Date,
              is_visible_in_available: bb ? bb.is_visible_in_available : null,
              friend_company_id: bb ? bb.friend_company_id : null,
            };
          });

          // Resolve contract marketing visibility with Shared Billboard Blocking Policy
          const visInfo = resolveContractMarketingVisibility(contractBbRows, validContracts, { referenceDate: todayStr });

          // Count how many billboards of this contract are included in export
          const eligibleCount = cIds.filter((id) => eligibleBillboardIds.has(id)).length;

          // Check if contract is expiring soon within window
          let isExpiringSoon = false;
          let daysRemaining: number | undefined = undefined;

          if (normEnd && !isExpired) {
            try {
              const ed = new Date(endDateStr);
              daysRemaining = Math.ceil((ed.getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24));
              if (normEnd >= todayStr && normEnd <= futureLimitStr) {
                isExpiringSoon = true;
              }
            } catch {}
          }

          // STRICT CRITERIA (Scope C Contract-Level Explicit Activation):
          // 1. Explicitly Shown: Contract MUST be active (!isExpired) AND have explicit contract-level activation (c.is_visible_in_available === true)
          const hasExplicitContractActivation = !isExpired && c.is_visible_in_available === true;
          const isExplicitlyShown = hasExplicitContractActivation;

          // 2. Upcoming Contract: Contract MUST be active (!isExpired) AND end within upcoming window AND have eligible boards
          const isUpcomingContract = !isExpired && isExpiringSoon && eligibleCount > 0;

          // Only active contracts that are either explicitly shown or upcoming qualify for preview
          if (isExplicitlyShown || isUpcomingContract) {
            activeGroups.push({
              contractNumber: contractNum,
              customerName: c['Customer Name'] || 'غير محدد',
              adType: c['Ad Type'] || '',
              startDate: normalizeDateOnly(c['Contract Date']),
              endDate: normEnd ? new Date(normEnd).toLocaleDateString('ar-LY') : '',
              isExpired,
              marketingState: isExplicitlyShown ? visInfo.state : 'OFF',
              requestedForceShowCount: isExplicitlyShown ? visInfo.requestedForceShowCount : 0,
              blockedByOtherContractsCount: isExplicitlyShown ? visInfo.blockedByOtherContractsCount : 0,
              effectiveForceShowCount: isExplicitlyShown ? visInfo.effectiveForceShowCount : 0,
              forceShowCount: isExplicitlyShown ? visInfo.effectiveForceShowCount : 0,
              totalBillboards: cIds.length,
              eligibleBillboardsCount: eligibleCount,
              isExplicitlyShown,
              isUpcomingContract,
              daysRemaining: daysRemaining && daysRemaining > 0 ? daysRemaining : undefined,
            });
          }
        });

        // Sort: Explicitly shown first, then by eligible billboards count descending
        activeGroups.sort((a, b) => {
          if (a.isExplicitlyShown && !b.isExplicitlyShown) return -1;
          if (!a.isExplicitlyShown && b.isExplicitlyShown) return 1;
          return b.eligibleBillboardsCount - a.eligibleBillboardsCount;
        });

        if (isMounted) {
          setStats({
            totalBillboards: totalCount,
            availableWithoutContractBillboards: availNoContractCount,
            marketingVisibleBillboards: forcedCount,
            upcomingBillboards: expiringCount,
          });
          setContractGroupsList(activeGroups);
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

  // Derived contract lists by tab category
  const explicitlyShownContracts = useMemo(() => {
    return contractGroupsList.filter((c) => c.isExplicitlyShown);
  }, [contractGroupsList]);

  const upcomingContracts = useMemo(() => {
    return contractGroupsList.filter((c) => c.isUpcomingContract && !c.isExplicitlyShown);
  }, [contractGroupsList]);

  const allPreviewContracts = useMemo(() => {
    return contractGroupsList;
  }, [contractGroupsList]);

  // Filtered contracts by tab and search query
  const filteredContracts = useMemo(() => {
    let source = allPreviewContracts;
    if (contractTab === 'forced') {
      source = explicitlyShownContracts;
    } else if (contractTab === 'expiring') {
      source = upcomingContracts;
    }

    if (!searchQuery.trim()) return source;
    return source.filter((c) =>
      smartArabicMatch(
        [c.contractNumber, c.customerName, c.adType],
        searchQuery
      )
    );
  }, [allPreviewContracts, explicitlyShownContracts, upcomingContracts, contractTab, searchQuery]);

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
            عرض العقود الفعالة المفعل فيها خيار "إظهار اللوحات في المتاح" والعقود الفعالة القادمة ({monthsAhead} أشهر)
          </p>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-4 py-3 px-1">
          {loadingData ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              <p className="text-xs font-medium">جاري تحليل بيانات العقود واللوحات بالمحرك الموحد...</p>
            </div>
          ) : (
            <>
              {/* Stats Summary Cards (Billboard Counts) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col">
                  <span className="text-xs text-muted-foreground font-medium">إجمالي المرفوع</span>
                  <span className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">
                    {stats.totalBillboards} <span className="text-xs font-normal text-slate-500">لوحة</span>
                  </span>
                </div>

                <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-200/60 dark:border-emerald-900/50 flex flex-col">
                  <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">متاحة بدون عقد</span>
                  <span className="text-xl font-bold text-emerald-800 dark:text-emerald-300 mt-1">
                    {stats.availableWithoutContractBillboards} <span className="text-xs font-normal text-emerald-600">لوحة</span>
                  </span>
                </div>

                <div className="bg-purple-50/60 dark:bg-purple-950/30 p-3 rounded-xl border border-purple-200/60 dark:border-purple-900/50 flex flex-col">
                  <span className="text-xs text-purple-700 dark:text-purple-400 font-medium flex items-center gap-1">
                    <Eye className="h-3 w-3" /> مظهرة يدوياً
                  </span>
                  <span className="text-xl font-bold text-purple-800 dark:text-purple-300 mt-1">
                    {stats.marketingVisibleBillboards} <span className="text-xs font-normal text-purple-600">لوحة</span>
                  </span>
                </div>

                <div className="bg-amber-50/60 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200/60 dark:border-amber-900/50 flex flex-col">
                  <span className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3" /> تنتهي قريباً
                  </span>
                  <span className="text-xl font-bold text-amber-800 dark:text-amber-300 mt-1">
                    {stats.upcomingBillboards} <span className="text-xs font-normal text-amber-600">لوحة</span>
                  </span>
                </div>
              </div>

              {/* Tabs & Search Filter (Contract Counts) */}
              <div className="space-y-2.5">
                <Tabs value={contractTab} onValueChange={(val) => setContractTab(val as any)} className="w-full">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <TabsList className="bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-3 w-full sm:w-auto">
                      <TabsTrigger
                        value="forced"
                        className="text-xs gap-1.5 font-bold data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded-lg transition-all"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        مظهرة في المتاح ({explicitlyShownContracts.length})
                      </TabsTrigger>
                      <TabsTrigger
                        value="expiring"
                        className="text-xs gap-1.5 font-bold data-[state=active]:bg-amber-600 data-[state=active]:text-white rounded-lg transition-all"
                      >
                        <Clock className="h-3.5 w-3.5" />
                        ستتاح قريباً ({upcomingContracts.length})
                      </TabsTrigger>
                      <TabsTrigger
                        value="all"
                        className="text-xs gap-1.5 font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg transition-all"
                      >
                        الكل ({allPreviewContracts.length})
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
                      <span>عرض العقود الفعالة المفعل فيها خيار "إظهار اللوحات في المتاح" ({explicitlyShownContracts.length} عقد)</span>
                    </>
                  )}
                  {contractTab === 'expiring' && (
                    <>
                      <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      <span>عرض العقود الفعالة التي تنتهي خلال نافذة التصدير ({upcomingContracts.length} عقد)</span>
                    </>
                  )}
                  {contractTab === 'all' && (
                    <>
                      <Building2 className="h-3.5 w-3.5 text-primary" />
                      <span>عرض جميع العقود الفعالة المشمولة ({allPreviewContracts.length} عقد)</span>
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
                            {c.isExplicitlyShown && c.marketingState === 'ON' && (
                              <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800 text-[11px] font-medium gap-1">
                                <Eye className="h-3 w-3" /> مظهر بالكامل ({c.effectiveForceShowCount}/{c.totalBillboards})
                              </Badge>
                            )}
                            {c.isExplicitlyShown && c.marketingState === 'PARTIAL' && (
                              <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/60 text-[11px] font-medium gap-1">
                                <Eye className="h-3 w-3" /> مظهر جزئياً ({c.effectiveForceShowCount}/{c.totalBillboards})
                              </Badge>
                            )}
                            {c.blockedByOtherContractsCount > 0 && (
                              <Badge variant="outline" className="bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900 text-[11px] font-medium gap-1">
                                <ShieldAlert className="h-3 w-3" /> محجوبة بعقد آخر ({c.blockedByOtherContractsCount})
                              </Badge>
                            )}
                            {c.isUpcomingContract && !c.isExplicitlyShown && (
                              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 text-[11px] font-medium gap-1">
                                <Clock className="h-3 w-3" /> ستتاح قريباً
                              </Badge>
                            )}

                            <Badge variant="secondary" className="font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                              {c.eligibleBillboardsCount || c.effectiveForceShowCount} لوحة
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
