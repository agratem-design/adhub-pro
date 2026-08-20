import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { loadBillboards } from '@/services/billboardService';
import { smartArabicMatch } from '@/lib/arabicSearch';
import { sortBillboardsStandardSync } from '@/lib/billboardSorter';
import { useQuery } from '@tanstack/react-query';
import { normalizeSize } from '@/lib/utils';
import { addBillboardsToContract, getContractWithBillboards, removeBillboardFromContract, updateContract } from '@/services/contractService';
import { checkLinkedTasks, removeBillboardFromAllTasks, addBillboardToExistingTasks, type BillboardTaskLinks, type TaskTypeSelection } from '@/services/smartBillboardService';
import { calculateInstallationCostFromIds } from '@/services/installationService';
import { getPriceFor, getDailyPriceFor, CustomerType } from '@/data/pricing';
import { ContractPDFDialog } from '@/components/Contract';
import type { Billboard } from '@/types';
import { Button } from '@/components/ui/button';
import { RefreshCw, DollarSign, Settings, Wrench, FileText, List, Map as MapIcon, Trash2, Calculator, PauseCircle, AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import SelectableGoogleHomeMap from '@/components/Map/SelectableGoogleHomeMap';
import { cleanupOrphanedBillboards } from '@/services/contractCleanupService';
import { isBillboardAvailable, getDaysUntilExpiry, checkBillboardConflicts, type BillboardConflict } from '@/utils/contractUtils';
import { BillboardConflictDialog } from '@/components/contracts/BillboardConflictDialog';
import { calculateAllBillboardPrices } from '@/utils/contractBillboardPricing';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

// Import modular components
import { ContractExpensesManager } from '@/components/contracts/ContractExpensesManager';
import { ContractEditHeader } from '@/components/contracts/edit/ContractEditHeader';
import { SelectedBillboardsCard } from '@/components/contracts/edit/SelectedBillboardsCard';
import { BillboardFilters } from '@/components/contracts/edit/BillboardFilters';
import { AvailableBillboardsGrid } from '@/components/contracts/edit/AvailableBillboardsGrid';
import { CustomerInfoForm } from '@/components/contracts/edit/CustomerInfoForm';
import { ContractDatesForm } from '@/components/contracts/edit/ContractDatesForm';
import { InstallmentsManager } from '@/components/contracts/edit/InstallmentsManager';
import { CostSummaryCard } from '@/components/contracts/edit/CostSummaryCard';
import { DesignManager } from '@/components/contracts/DesignManager';
import { PartnershipBillboardsInfo } from '@/components/contracts/PartnershipBillboardsInfo';
import { FriendBillboardsBulkRental } from '@/components/contracts/edit/FriendBillboardsBulkRental';
import { LevelDiscountsCard } from '@/components/contracts/edit/LevelDiscountsCard';
import { SmartBillboardConfirmDialog } from '@/components/contracts/edit/SmartBillboardConfirmDialog';
import { BillboardSwapDialog } from '@/components/contracts/edit/BillboardSwapDialog';
import { BorrowBillboardDialog } from '@/components/contracts/edit/BorrowBillboardDialog';
import { AddPausedFromContractDialog } from '@/components/contracts/edit/AddPausedFromContractDialog';
import { usePausedBillboardsPricing } from '@/hooks/usePausedBillboardsPricing';
import { syncContractIdsWithPaused } from '@/services/pausedBillboardsService';

// ✅ NEW: Currency options
const CURRENCIES = [
  { code: 'LYD', name: 'دينار ليبي', symbol: 'د.ل' },
  { code: 'USD', name: 'دولار أمريكي', symbol: '$' },
  { code: 'EUR', name: 'يورو', symbol: '€' },
  { code: 'GBP', name: 'جنيه إسترليني', symbol: '£' },
  { code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س' },
  { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ' },
];

export default function ContractEdit() {
  const navigate = useNavigate();
  const location = useLocation();
  const { canEdit: canEditFn, isAdmin, user, isLoading: authLoading } = useAuth();

  // التحقق من تسجيل الدخول أولاً — إعادة توجيه لصفحة الدخول إذا لم يكن مُصادقاً
  useEffect(() => {
    if (!authLoading && !user) {
      toast.error('يجب تسجيل الدخول أولاً للوصول إلى هذه الصفحة');
      navigate('/login', { replace: true });
      return;
    }
    if (!authLoading && user && !canEditFn('contracts') && !isAdmin) {
      navigate('/admin/contracts', { replace: true });
    }
  }, [canEditFn, isAdmin, navigate, user, authLoading]);

  // Core state
  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [occupiedBillboardIds, setOccupiedBillboardIds] = useState<Map<number, string>>(new Map());
  const [saving, setSaving] = useState(false);
  const [contractNumber, setContractNumber] = useState<string>('');
  const [currentContract, setCurrentContract] = useState<any>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const selectedBillboardsSet = useMemo(() => new Set(selected), [selected]);
  
  // Smart billboard management
  const [smartConfirmOpen, setSmartConfirmOpen] = useState(false);
  const [smartBillboardLinks, setSmartBillboardLinks] = useState<BillboardTaskLinks[]>([]);
  const [pendingSaveCallback, setPendingSaveCallback] = useState<((types: TaskTypeSelection) => Promise<void>) | null>(null);
  const [pendingRemovalIds, setPendingRemovalIds] = useState<string[]>([]);
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [swapDialogMode, setSwapDialogMode] = useState<'swap' | 'move'>('swap');
  const [borrowDialogOpen, setBorrowDialogOpen] = useState(false);
  const [pausedFromContractOpen, setPausedFromContractOpen] = useState(false);
  const [swapBillboard, setSwapBillboard] = useState<{ id: string; name: string; size: string; imageUrl: string; landmark: string } | null>(null);
  const [maintenanceConfirmOpen, setMaintenanceConfirmOpen] = useState(false);
  const [pendingMaintenanceBillboard, setPendingMaintenanceBillboard] = useState<Billboard | null>(null);

  // ─── Conflict detection state ───
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [conflictList, setConflictList] = useState<BillboardConflict[]>([]);
  const [pendingConflictBillboard, setPendingConflictBillboard] = useState<Billboard | null>(null);

  // ✅ FIXED: Default to stored prices for existing contracts (true)
  // Will be set to false only for new contracts (no saved prices)
  const [useStoredPrices, setUseStoredPrices] = useState<boolean>(true);
  const [refreshingPrices, setRefreshingPrices] = useState(false);
  
  // ✅ NEW: Store the saved base rent from database (before any deductions)
  const [savedBaseRent, setSavedBaseRent] = useState<number | null>(null);
  
  // ✅ NEW: Proportional distribution overrides
  const [billboardPriceOverrides, setBillboardPriceOverrides] = useState<Record<string, number>>({});

  // ✅ NEW: State for individual billboard discounts (خصم محدد على لوحات معينة)
  const [individualDiscounts, setIndividualDiscounts] = useState<Record<string, { value: number; type: 'amount' | 'percent' }>>({});
  
  // ✅ NEW: Factors pricing system state
  const [useFactorsPricing, setUseFactorsPricing] = useState<boolean>(false);
  const [municipalityFactors, setMunicipalityFactors] = useState<any[]>([]);
  const [categoryFactors, setCategoryFactors] = useState<any[]>([]);
  const [basePrices, setBasePrices] = useState<any[]>([]);

  // ✅ NEW: Currency state
  const [contractCurrency, setContractCurrency] = useState<string>('LYD');
  const [exchangeRate, setExchangeRate] = useState<number>(1);

  // Customer data
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerLinkedFriendCompanyId, setCustomerLinkedFriendCompanyId] = useState<string | null>(null);
  const [adType, setAdType] = useState('');

  // Pricing and categories
  const [pricingCategories, setPricingCategories] = useState<string[]>([]);
  const [pricingCategory, setPricingCategory] = useState<string>('عادي');
  const [pricingData, setPricingData] = useState<any[]>([]);

  // ✅ NEW: Print pricing state with enable/disable toggle
  const [printCostEnabled, setPrintCostEnabled] = useState<boolean>(false);
  const [printPricePerMeter, setPrintPricePerMeter] = useState<number>(0);

  const { data: dbSizesData = [] } = useQuery({
    queryKey: ['contract-edit-page-sizes-sorting'],
    queryFn: async () => {
      const { data } = await supabase.from('sizes').select('name, sort_order').order('sort_order', { ascending: true });
      return data || [];
    }
  });

  const { data: dbMunisData = [] } = useQuery({
    queryKey: ['contract-edit-page-munis-sorting'],
    queryFn: async () => {
      const { data } = await supabase.from('municipalities').select('name, sort_order').order('sort_order', { ascending: true });
      return data || [];
    }
  });

  // ✅ NEW: Installation enable/disable toggle
  const [installationEnabled, setInstallationEnabled] = useState<boolean>(true);

  // Previous contract billboard IDs for renewal contracts
  const [previousContractBillboardIds, setPreviousContractBillboardIds] = useState<Set<string>>(new Set());

  // Single face billboards
  const [singleFaceBillboards, setSingleFaceBillboards] = useState<Set<string>>(new Set());
  const toggleSingleFace = (billboardId: string) => {
    const bb = billboards.find(b => String((b as any).ID) === String(billboardId));
    const orig = bb ? ((bb as any).Faces_Count ?? (bb as any).faces_count ?? (bb as any).faces) : null;
    if (orig !== null && orig !== undefined && Number(orig) === 1) return;

    setSingleFaceBillboards(prev => {
      const next = new Set(prev);
      if (next.has(billboardId)) next.delete(billboardId);
      else next.add(billboardId);
      return next;
    });
  };

  const handleUpdateIndividualDiscount = (billboardId: string, value: number, type: 'amount' | 'percent') => {
    setIndividualDiscounts(prev => {
      const next = { ...prev };
      if (value === 0) {
        delete next[billboardId];
      } else {
        next[billboardId] = { value, type };
      }
      return next;
    });
  };

  // ✅ NEW: Include costs in price toggles
  const [includeInstallationInPrice, setIncludeInstallationInPrice] = useState<boolean>(false);
  const [includePrintInPrice, setIncludePrintInPrice] = useState<boolean>(false);

  // ✅ NEW: Include operating fee in costs toggles
  const [includeOperatingInPrint, setIncludeOperatingInPrint] = useState<boolean>(false);
  const [includeOperatingInInstallation, setIncludeOperatingInInstallation] = useState<boolean>(false);
  const [operatingFeeRateInstallation, setOperatingFeeRateInstallation] = useState<number>(3);
  const [operatingFeeRatePrint, setOperatingFeeRatePrint] = useState<number>(3);

  // ✅ NEW: Level-based discounts
  const [levelDiscounts, setLevelDiscounts] = useState<Record<string, number>>({});

  // ✅ NEW: Design management state
  const [billboardDesigns, setBillboardDesigns] = useState<any[]>([]);
  
  // Map view state
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Installation and operating costs
  const [installationCost, setInstallationCost] = useState<number>(0);
  const [installationDetails, setInstallationDetails] = useState<Array<{
    billboardId: string;
    billboardName: string;
    size: string;
    installationPrice: number;
    faces?: number;
    adjustedPrice?: number;
  }>>([]);
  const [operatingFee, setOperatingFee] = useState<number>(0);
  const [operatingFeeRate, setOperatingFeeRate] = useState<number>(3);
  const [partnershipOperatingFeeRate, setPartnershipOperatingFeeRate] = useState<number>(3);

  // ✅ خريطة المبالغ المخصصة للوحات البديلة (replacement_billboard_id → allocated_amount)
  const [replacementAllocationsMap, setReplacementAllocationsMap] = useState<Map<string, number>>(new Map());

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [sizeFilters, setSizeFilters] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('available'); // Default to available only
  const [municipalityFilter, setMunicipalityFilter] = useState<string>('all');

  // Contract form data
  const [startDate, setStartDate] = useState('');
  const [pricingMode, setPricingMode] = useState<'months' | 'days'>('months');
  const [durationMonths, setDurationMonths] = useState<number>(3);
  const [durationDays, setDurationDays] = useState<number>(0);
  const [endDate, setEndDate] = useState('');
  const [use30DayMonth, setUse30DayMonth] = useState<boolean>(true); // حساب الشهر = 30 يوم
  const [billboardCustomDates, setBillboardCustomDates] = useState<Record<string, { startDate: string; endDate: string; startDateReason: string }>>({});
  
  // Auto-calculate end date for a custom start date based on contract duration
  const calculateEndDateForCustomStart = (
    customStartStr: string,
    mode: 'months' | 'days',
    months: number,
    days: number,
    is30Day: boolean
  ): string => {
    if (!customStartStr) return '';
    try {
      const d = new Date(customStartStr);
      const end = new Date(d);
      if (mode === 'months') {
        if (is30Day) {
          const daysToAdd = Math.max(0, Number(months || 0)) * 30;
          end.setDate(end.getDate() + daysToAdd);
        } else {
          end.setMonth(end.getMonth() + months);
        }
      } else {
        const daysToAdd = Math.max(0, Number(days || 0));
        end.setDate(end.getDate() + daysToAdd);
      }
      return end.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const handleUpdateBillboardCustomDates = (billboardId: string, customStartDate: string, reason: string) => {
    setBillboardCustomDates((prev) => {
      const updated = { ...prev };
      if (!customStartDate) {
        delete updated[billboardId];
      } else {
        const computedEndDate = calculateEndDateForCustomStart(
          customStartDate,
          pricingMode,
          durationMonths,
          durationDays,
          use30DayMonth
        );
        updated[billboardId] = {
          startDate: customStartDate,
          endDate: computedEndDate,
          startDateReason: reason
        };
      }
      return updated;
    });
  };

  // Re-calculate custom end dates if contract duration parameters change
  useEffect(() => {
    if (Object.keys(billboardCustomDates).length === 0) return;
    setBillboardCustomDates((prev) => {
      const updated = { ...prev };
      let changed = false;
      Object.keys(updated).forEach((id) => {
        const entry = updated[id];
        if (entry.startDate) {
          const newEnd = calculateEndDateForCustomStart(
            entry.startDate,
            pricingMode,
            durationMonths,
            durationDays,
            use30DayMonth
          );
          if (newEnd !== entry.endDate) {
            updated[id] = { ...entry, endDate: newEnd };
            changed = true;
          }
        }
      });
      return changed ? updated : prev;
    });
  }, [pricingMode, durationMonths, durationDays, use30DayMonth]);

  // ✅ NEW: Alert states for modifying pricing parameters when useStoredPrices is true
  const [pricingAlertOpen, setPricingAlertOpen] = useState(false);
  const [pricingAlertPendingAction, setPricingAlertPendingAction] = useState<(() => void) | null>(null);

  const handlePricingCategoryChange = (newVal: string) => {
    if (newVal === pricingCategory) return;
    if (useStoredPrices) {
      setPricingAlertPendingAction(() => () => {
        setPricingCategory(newVal);
        setUseStoredPrices(false);
      });
      setPricingAlertOpen(true);
    } else {
      setPricingCategory(newVal);
    }
  };

  const handlePricingModeChange = (newVal: 'months' | 'days') => {
    if (newVal === pricingMode) return;
    if (useStoredPrices) {
      setPricingAlertPendingAction(() => () => {
        setPricingMode(newVal);
        setUseStoredPrices(false);
      });
      setPricingAlertOpen(true);
    } else {
      setPricingMode(newVal);
    }
  };

  const handleDurationMonthsChange = (newVal: number) => {
    if (newVal === durationMonths) return;
    if (useStoredPrices) {
      setPricingAlertPendingAction(() => () => {
        setDurationMonths(newVal);
        setUseStoredPrices(false);
      });
      setPricingAlertOpen(true);
    } else {
      setDurationMonths(newVal);
    }
  };

  const handleDurationDaysChange = (newVal: number) => {
    if (newVal === durationDays) return;
    if (useStoredPrices) {
      setPricingAlertPendingAction(() => () => {
        setDurationDays(newVal);
        setUseStoredPrices(false);
      });
      setPricingAlertOpen(true);
    } else {
      setDurationDays(newVal);
    }
  };

  const handleUse30DayMonthChange = (newVal: boolean) => {
    if (newVal === use30DayMonth) return;
    if (useStoredPrices) {
      setPricingAlertPendingAction(() => () => {
        setUse30DayMonth(newVal);
        setUseStoredPrices(false);
      });
      setPricingAlertOpen(true);
    } else {
      setUse30DayMonth(newVal);
    }
  };
  const [rentCost, setRentCost] = useState<number>(0);
  const [userEditedRentCost, setUserEditedRentCost] = useState(false);
  const [originalTotal, setOriginalTotal] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [discountValue, setDiscountValue] = useState<number>(0);

  // Installments
  const [installments, setInstallments] = useState<Array<{ 
    amount: number; 
    paymentType: string; 
    description: string; 
    dueDate: string; 
  }>>([]);
 const [installmentsLoaded, setInstallmentsLoaded] = useState<boolean>(false); // NEW: Track if installments were loaded from DB
  
  // ✅ NEW: Installment distribution settings (saved to DB)
  const [installmentDistributionType, setInstallmentDistributionType] = useState<'single' | 'multiple' | 'periods'>('multiple');
  const [installmentFirstPaymentAmount, setInstallmentFirstPaymentAmount] = useState<number>(0);
  const [installmentFirstPaymentType, setInstallmentFirstPaymentType] = useState<'amount' | 'percent'>('amount');
  const [installmentInterval, setInstallmentInterval] = useState<'month' | '2months' | '3months' | '4months' | '5months' | '6months' | '7months'>('month');
  const [installmentCount, setInstallmentCount] = useState<number>(2);
  const [installmentAutoCalculate, setInstallmentAutoCalculate] = useState<boolean>(false);
  const [installmentFirstAtSigning, setInstallmentFirstAtSigning] = useState<boolean>(true);
  const [hasDifferentFirstPayment, setHasDifferentFirstPayment] = useState<boolean>(false);

  // ✅ NEW: Friend billboard costs
  const [friendBillboardCosts, setFriendBillboardCosts] = useState<Array<{
    billboardId: string;
    friendCompanyId: string;
    friendCompanyName: string;
    friendRentalCost: number;
  }>>([]);

  // ✅ NEW: Friend rental includes installation toggle
  const [friendRentalIncludesInstallation, setFriendRentalIncludesInstallation] = useState<boolean>(false);

  // ✅ NEW: Friend rental operating fee settings
  const [friendRentalOperatingFeeEnabled, setFriendRentalOperatingFeeEnabled] = useState<boolean>(false);
  const [friendRentalOperatingFeeRate, setFriendRentalOperatingFeeRate] = useState<number>(3); // افتراضي 3%

  // Helper functions for friend costs
  const updateFriendBillboardCost = (billboardId: string, friendCompanyId: string, friendCompanyName: string, cost: number) => {
    setFriendBillboardCosts(prev => {
      const existing = prev.find(f => f.billboardId === billboardId);
      if (existing) {
        return prev.map(f => 
          f.billboardId === billboardId 
            ? { ...f, friendCompanyId, friendCompanyName, friendRentalCost: cost }
            : f
        );
      } else {
        return [...prev, { billboardId, friendCompanyId, friendCompanyName, friendRentalCost: cost }];
      }
    });
  };

  // ✅ FIXED: Filter to valid friend costs only and sync friendCompanyId with billboard's actual company
  const validFriendCosts = React.useMemo(() => {
    return friendBillboardCosts
      .filter(f => {
        const bb = billboards.find((b: any) => String(b.ID) === f.billboardId);
        return bb && ((bb as any).friend_company_id || (bb as any).own_company_id) && selected.includes(f.billboardId);
      })
      .map(f => {
        const bb = billboards.find((b: any) => String(b.ID) === f.billboardId);
        const currentFriendCompanyId = (bb as any)?.friend_company_id || (bb as any)?.own_company_id;
        const currentFriendCompanyName = (bb as any)?.friend_companies?.name || f.friendCompanyName;
        return {
          ...f,
          friendCompanyId: currentFriendCompanyId || f.friendCompanyId,
          friendCompanyName: (currentFriendCompanyId ? currentFriendCompanyName : f.friendCompanyName) || 'غير محدد'
        };
      });
  }, [friendBillboardCosts, billboards, selected]);

  const totalFriendCosts = React.useMemo(() => 
    validFriendCosts.reduce((sum, f) => sum + f.friendRentalCost, 0),
    [validFriendCosts]
  );

  // ✅ NEW: Calculate friend rental operating fee (percentage of friend costs)
  const friendOperatingFeeAmount = React.useMemo(() => {
    if (!friendRentalOperatingFeeEnabled || validFriendCosts.length === 0) return 0;
    return Math.round(totalFriendCosts * (friendRentalOperatingFeeRate / 100));
  }, [friendRentalOperatingFeeEnabled, totalFriendCosts, friendRentalOperatingFeeRate, validFriendCosts.length]);

  // ✅ NEW: Get currency symbol
  const getCurrencySymbol = (currencyCode: string): string => {
    return CURRENCIES.find(c => c.code === currencyCode)?.symbol || currencyCode;
  };

  // ✅ NEW: Apply exchange rate to amount
  const applyExchangeRate = (amount: number): number => {
    return Math.round((amount * exchangeRate) * 100) / 100;
  };

  // Load contract number from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cn = params.get('contract');
    if (cn) setContractNumber(String(cn));
  }, [location.search]);

  // Load billboards - wait for auth to be ready
  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        
        // تحميل اللوحات والعقود النشطة بالتوازي
        const [data, activeContractsRes] = await Promise.all([
          loadBillboards(),
          supabase
            .from('Contract')
            .select('Contract_Number, billboard_ids, "End Date"')
            .gte('End Date', today)
        ]);

        setBillboards(data);

        const occupied = new Map<number, string>();
        const currentUrlParams = new URLSearchParams(location.search);
        const currentCN = currentUrlParams.get('contract');

        if (!activeContractsRes.error && activeContractsRes.data) {
          for (const contract of activeContractsRes.data) {
            const cNum = String((contract as any).Contract_Number || '').trim();
            // Exclude current contract being edited
            if (currentCN && cNum === String(currentCN).trim()) {
              continue;
            }
            const ids = (contract as any).billboard_ids;
            const endDate = (contract as any)['End Date'] || '';
            if (ids && typeof ids === 'string') {
              ids.split(',').forEach((bIdStr: string) => {
                const num = parseInt(bIdStr.trim(), 10);
                if (!isNaN(num)) occupied.set(num, endDate);
              });
            }
          }
        } else if (activeContractsRes.error) {
          console.warn('[ContractEdit] ⚠️ فشل استعلام العقود النشطة:', activeContractsRes.error.message);
        }
        setOccupiedBillboardIds(occupied);
      } catch (e: any) {
        console.error('[ContractEdit] ❌ خطأ في تحميل اللوحات:', e);
        toast.error(e?.message || 'فشل تحميل اللوحات');
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, user]);

  // Load customers
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from('customers').select('id,name').order('name', { ascending: true });
        if (!error && Array.isArray(data)) {
          setCustomers(data);
        }
      } catch (e) {
        console.warn('load customers failed');
      }
    })();
  }, []);

  // Load pricing categories
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('pricing_categories')
          .select('name')
          .order('name', { ascending: true });

        if (!error && Array.isArray(data)) {
          const categories = data.map((item: any) => item.name);
          const staticCategories = ['عادي', 'مسوق', 'شركات'];
          const allCategories = Array.from(new Set([...staticCategories, ...categories]));
          setPricingCategories(allCategories);
        } else {
          setPricingCategories(['عادي', 'مسوق', 'شركات', 'المدينة']);
        }
      } catch (e) {
        console.warn('Failed to load pricing categories, using defaults');
        setPricingCategories(['عادي', 'مسوق', 'شركات', 'المدينة']);
      }
    })();
  }, []);

  // ✅ NEW: Size names mapping (size_id -> name)
  const [sizeNames, setSizeNames] = useState(() => new Map<number, string>());
  const [sizeDimensions, setSizeDimensions] = useState(() => new Map<number, { width: number; height: number }>());

  // Load pricing data and size names
  useEffect(() => {
    (async () => {
      try {
        const [pricingRes, sizesRes, municipalitiesRes, categoriesRes, basePricesRes] = await Promise.all([
          supabase.from('pricing').select('*').order('size', { ascending: true }),
          supabase.from('sizes').select('id, name, width, height'),
          supabase.from('municipality_factors').select('*').eq('is_active', true),
          supabase.from('category_factors').select('*').eq('is_active', true),
          supabase.from('base_prices').select('*')
        ]);

        if (!pricingRes.error && Array.isArray(pricingRes.data)) {
          setPricingData(pricingRes.data);
        } else {
          console.error('❌ Failed to load pricing data:', pricingRes.error);
        }

        if (!sizesRes.error && Array.isArray(sizesRes.data)) {
          const sizeMap = new Map(sizesRes.data.map((s: any) => [s.id, s.name]));
          setSizeNames(sizeMap);
          const dimMap = new Map(sizesRes.data.map((s: any) => [s.id, { width: Number(s.width) || 0, height: Number(s.height) || 0 }]));
          setSizeDimensions(dimMap);
        } else {
          console.error('❌ Failed to load size names:', sizesRes.error);
        }

        // ✅ Load factors pricing data
        if (!municipalitiesRes.error && Array.isArray(municipalitiesRes.data)) {
          setMunicipalityFactors(municipalitiesRes.data);
        }
        if (!categoriesRes.error && Array.isArray(categoriesRes.data)) {
          setCategoryFactors(categoriesRes.data);
        }
        if (!basePricesRes.error && Array.isArray(basePricesRes.data)) {
          setBasePrices(basePricesRes.data);
        }
      } catch (e) {
        console.warn('Failed to load pricing/size data:', e);
      }
    })();
  }, []);

  // Load contract data
  useEffect(() => {
    (async () => {
      if (!contractNumber) return;
      try {
        const c = await getContractWithBillboards(contractNumber);
        
        setCurrentContract(c);

        // Fetch billboard IDs of previous contract if this is a renewal
        if (c.previous_contract_number) {
          try {
            const { data: prevContract, error: prevErr } = await supabase
              .from('Contract')
              .select('billboard_ids')
              .eq('Contract_Number', c.previous_contract_number)
              .maybeSingle();
            
            if (!prevErr && prevContract && prevContract.billboard_ids) {
              const prevIds = prevContract.billboard_ids.split(',').map((id: string) => id.trim()).filter(Boolean);
              setPreviousContractBillboardIds(new Set(prevIds));
            } else {
              setPreviousContractBillboardIds(new Set());
            }
          } catch (prevCatchErr) {
            console.error('Failed to load previous contract details:', prevCatchErr);
            setPreviousContractBillboardIds(new Set());
          }
        } else {
          setPreviousContractBillboardIds(new Set());
        }

        setCustomerName(c.customer_name || c['Customer Name'] || '');
        setCustomerId(c.customer_id ?? null);
        setAdType(c.ad_type || c['Ad Type'] || '');
        
        const savedPricingCategory = c.customer_category ?? 'عادي';
        setPricingCategory(savedPricingCategory);

        // ✅ NEW: Load currency settings from contract
        const savedCurrency = c.contract_currency || 'LYD';
        const savedExchangeRate = Number(c.exchange_rate || 1);
        setContractCurrency(savedCurrency);
        setExchangeRate(savedExchangeRate);

        // ✅ FIXED: Proper boolean check for print cost enabled
        const savedPrintEnabled = c.print_cost_enabled === true || c.print_cost_enabled === 1 || c.print_cost_enabled === "true";
        const savedPrintPrice = Number(c.print_price_per_meter || 0);
        setPrintCostEnabled(savedPrintEnabled);
        setPrintPricePerMeter(savedPrintPrice);
        
        // ✅ Load installation enabled from contract (default true if not set)
        const savedInstallationEnabled = c.installation_enabled !== false && c.installation_enabled !== 0 && c.installation_enabled !== "false";
        setInstallationEnabled(savedInstallationEnabled);

        // ✅ NEW: Load "include in price" toggles (persisted in DB)
        const savedIncludeInstallation = c.include_installation_in_price === true || c.include_installation_in_price === 1 || c.include_installation_in_price === 'true' || c.include_installation_in_price === '1';
        const savedIncludePrint = c.include_print_in_billboard_price === true || c.include_print_in_billboard_price === 1 || c.include_print_in_billboard_price === 'true' || c.include_print_in_billboard_price === '1';
        setIncludeInstallationInPrice(savedIncludeInstallation);
        setIncludePrintInPrice(savedIncludePrint);

        // Load single face billboards
        if (c.single_face_billboards) {
          try {
            const ids = typeof c.single_face_billboards === 'string'
              ? JSON.parse(c.single_face_billboards)
              : c.single_face_billboards;
            if (Array.isArray(ids)) setSingleFaceBillboards(new Set(ids.map(String)));
          } catch { setSingleFaceBillboards(new Set()); }
        }

        // ✅ NEW: Load operating fee inclusion in costs
        const savedIncludeOperatingInPrint = c.include_operating_in_print === true;
        const savedIncludeOperatingInInstallation = c.include_operating_in_installation === true;
        setIncludeOperatingInPrint(savedIncludeOperatingInPrint);
        setIncludeOperatingInInstallation(savedIncludeOperatingInInstallation);
        
        // ✅ Load separate operating fee rates for installation and print
        setOperatingFeeRateInstallation(Number(c.operating_fee_rate_installation || c.operating_fee_rate || 3));
        setOperatingFeeRatePrint(Number(c.operating_fee_rate_print || c.operating_fee_rate || 3));

        // ✅ NEW: Load level discounts
        const savedLevelDiscounts = c.level_discounts;
        if (savedLevelDiscounts && typeof savedLevelDiscounts === 'object') {
          setLevelDiscounts(savedLevelDiscounts as Record<string, number>);
        }

        // ✅ NEW: Load friend rental includes installation
        const savedFriendRentalIncludesInstallation = c.friend_rental_includes_installation === true;
        setFriendRentalIncludesInstallation(savedFriendRentalIncludesInstallation);

        // ✅ NEW: Load operating fee rate from contract
        const savedOperatingFeeRate = Number(c.operating_fee_rate || 3);
        setOperatingFeeRate(savedOperatingFeeRate);
        
        // ✅ NEW: Load partnership operating fee rate from contract
        const savedPartnershipOperatingFeeRate = Number(c.partnership_operating_fee_rate || 3);
        setPartnershipOperatingFeeRate(savedPartnershipOperatingFeeRate);
        
        // ✅ NEW: Load design data from contract
        const savedDesigns = c.design_data;
        if (savedDesigns) {
          try {
            const parsed = typeof savedDesigns === 'string' ? JSON.parse(savedDesigns) : savedDesigns;
            setBillboardDesigns(Array.isArray(parsed) ? parsed : []);
          } catch (e) {
            console.error('Failed to parse design data:', e);
            setBillboardDesigns([]);
          }
        }
        
        const s = c.start_date || c['Contract Date'] || '';
        const e = c.end_date || c['End Date'] || '';
        const savedDuration = String(c.Duration || '').trim();
        setStartDate(s);
        setEndDate(e);

        // ✅ Prefer explicitly saved pricing mode/duration columns when present
        const savedPricingMode = c.pricing_mode === 'days' || c.pricing_mode === 'months' ? c.pricing_mode : null;
        const savedDurationMonths = c.duration_months != null ? Number(c.duration_months) : null;
        const savedDurationDays = c.duration_days != null ? Number(c.duration_days) : null;
        const savedUse30Day = typeof c.use_30_day_month === 'boolean' ? c.use_30_day_month : null;

        if (savedPricingMode) {
          setPricingMode(savedPricingMode);
          if (savedPricingMode === 'months') {
            setDurationMonths(savedDurationMonths && savedDurationMonths > 0 ? savedDurationMonths : 3);
            setDurationDays(0);
            setUse30DayMonth(savedUse30Day !== null ? savedUse30Day : true);
          } else {
            setDurationDays(savedDurationDays && savedDurationDays > 0 ? savedDurationDays : 0);
            setDurationMonths(0);
            setUse30DayMonth(savedUse30Day !== null ? savedUse30Day : false);
          }
        } else if (s && e) {
          const sd = new Date(s);
          const ed = new Date(e);
          if (!isNaN(sd.getTime()) && !isNaN(ed.getTime())) {
            const diffTime = Math.abs(ed.getTime() - sd.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const hasMonthWord = savedDuration.includes('شهر') || savedDuration.includes('أشهر') || savedDuration.includes('شهرين');
            const hasDayWord = savedDuration.includes('يوم');
            const nearestMonths = Math.round(diffDays / 30);
            const maxAllowedDiff = Math.max(1.5, nearestMonths * 1.5);
            const isNearMonthBoundary = nearestMonths >= 1 && Math.abs(diffDays - nearestMonths * 30) <= maxAllowedDiff;

            // دالة تخمين الأشهر التقويمية الفعلية
            const getCalendarMonthsDiff = (d1: Date, d2: Date) => {
              const yearDiff = d2.getFullYear() - d1.getFullYear();
              const monthDiff = d2.getMonth() - d1.getMonth();
              const totalMonths = yearDiff * 12 + monthDiff;
              
              const isEndOfMonth = (d: Date) => {
                const nextDay = new Date(d);
                nextDay.setDate(nextDay.getDate() + 1);
                return nextDay.getMonth() !== d.getMonth();
              };
              
              if (Math.abs(d2.getDate() - d1.getDate()) <= 3 || (isEndOfMonth(d1) && isEndOfMonth(d2))) {
                return totalMonths;
              }
              
              const temp = new Date(d1);
              temp.setMonth(temp.getMonth() + totalMonths);
              const diffD = Math.round(Math.abs(d2.getTime() - temp.getTime()) / (1000 * 60 * 60 * 24));
              if (diffD <= 3) return totalMonths;
              
              const tempPlus = new Date(d1);
              tempPlus.setMonth(tempPlus.getMonth() + totalMonths + 1);
              const diffDPlus = Math.round(Math.abs(d2.getTime() - tempPlus.getTime()) / (1000 * 60 * 60 * 24));
              if (diffDPlus <= 3) return totalMonths + 1;

              const tempMinus = new Date(d1);
              tempMinus.setMonth(tempMinus.getMonth() + totalMonths - 1);
              const diffDMinus = Math.round(Math.abs(d2.getTime() - tempMinus.getTime()) / (1000 * 60 * 60 * 24));
              if (diffDMinus <= 3) return totalMonths - 1;

              return null;
            };

            const calendarMonths = getCalendarMonthsDiff(sd, ed);
            const isCalendarMonth = calendarMonths !== null && calendarMonths >= 1;
            const isDayBasedDuration = !hasMonthWord && !isNearMonthBoundary && !isCalendarMonth;

            if (isDayBasedDuration) {
              setPricingMode('days');
              setDurationDays(diffDays);
              setDurationMonths(0);
              setUse30DayMonth(false);
            } else {
              setPricingMode('months');
              const finalMonths = isCalendarMonth ? calendarMonths : nearestMonths;
              setDurationMonths(finalMonths);
              setDurationDays(0);
              // إذا كان التخمين مبنياً على الأشهر التقويمية وليس الـ 30 يوماً
              setUse30DayMonth(!isCalendarMonth || isNearMonthBoundary);
            }
          }
        }
        
        // ✅ FIXED: Accurately isolate pure contractual rental base from saved customer total without double counting
        const baseRentFromDB = Number(c.base_rent || 0);
        const savedCustomerTotal = Number(c.Total || 0);
        const disc = Number(c.Discount ?? 0);
        const extraInstallFromDB = (c.installation_enabled && !c.include_installation_in_price) ? Number(c.installation_cost || 0) : 0;
        const extraPrintFromDB = (String(c.print_cost_enabled) === 'true' && !c.include_print_in_billboard_price) ? Number(c.print_cost || 0) : 0;
        
        // Pure contractual rental base = Customer Total - Extra Services (not included) + Discount
        const contractualRentalBase = savedCustomerTotal > 0 
          ? Math.max(0, savedCustomerTotal - extraInstallFromDB - extraPrintFromDB + (disc > 0 ? disc : 0))
          : (baseRentFromDB > 0 ? baseRentFromDB : Number(c['Total Rent'] || 0));

        setRentCost(contractualRentalBase);
        setSavedBaseRent(baseRentFromDB > 0 ? baseRentFromDB : contractualRentalBase);
        setOriginalTotal(savedCustomerTotal || contractualRentalBase);
        
        // دائماً نستخدم الأسعار المحفوظة عند تعديل عقد موجود
        setUseStoredPrices(true);
        
        if (!isNaN(disc) && disc > 0) {
          setDiscountType('amount');
          setDiscountValue(disc);
        }

        // ✅ NEW: Load existing operating fee from contract
        const existingFee = Number(c.fee || 0);
        if (existingFee > 0) {
          setOperatingFee(existingFee);
        }

        // ✅ FIXED: Load selected billboards from billboard_ids column
        // 🔄 Self-heal: reconcile billboard_ids with paused + replacements
        // before reading them, so paused billboards never leak into "selected"
        // and replacement billboards are always registered.
        let healedIdsStr: string | null = null;
        try {
          const healedIds = await syncContractIdsWithPaused(Number(c.Contract_Number));
          if (Array.isArray(healedIds)) {
            healedIdsStr = healedIds.length > 0 ? healedIds.join(',') : '';
            (c as any).billboard_ids = healedIdsStr || null;
          }
        } catch (syncErr) {
          console.warn('syncContractIdsWithPaused failed:', syncErr);
        }

        if (c.billboard_ids) {
          try {
            // Parse billboard_ids if it's a string
            const idsArray = typeof c.billboard_ids === 'string' 
              ? c.billboard_ids.split(',').map(id => id.trim()).filter(Boolean)
              : Array.isArray(c.billboard_ids) ? c.billboard_ids : [];
            setSelected(idsArray);
          } catch (e) {
            console.warn('Failed to parse billboard_ids:', e);
            // Fallback to old method
            setSelected((c.billboards || []).map((b: any) => String(b.ID)));
          }
        } else {
          // Fallback to old method
          setSelected((c.billboards || []).map((b: any) => String(b.ID)));
        }
        
        // ✅ FIXED: Properly handle installments_data from database
        let loadedInstallments: any[] = [];

        if (c.installments_data) {
          // Handle JSON string format (from database)
          if (typeof c.installments_data === 'string') {
            try {
              const parsed = JSON.parse(c.installments_data);
              if (Array.isArray(parsed)) {
                loadedInstallments = parsed;
              }
            } catch (e) {
              console.warn('Failed to parse installments_data string:', e);
            }
          }
          // Handle array format (already parsed)
          else if (Array.isArray(c.installments_data)) {
            loadedInstallments = c.installments_data;
          }
        }

        const normalizeInstallment = (inst: any, idx: number) => {
          const amount = Number(inst?.amount ?? 0) || 0;
          // ✅ NEW: الدفعة الأولى "عند التوقيع"، الثانية "عند التركيب"
          const defaultPaymentType = idx === 0 ? 'عند التوقيع' : (idx === 1 ? 'عند التركيب' : 'شهري');
          const paymentType = String(inst?.paymentType ?? inst?.type ?? inst?.payment_type ?? '').trim() || defaultPaymentType;
          const description = String(inst?.description ?? inst?.desc ?? '').trim() || `الدفعة ${idx + 1}`;
          const dueDate = String(inst?.dueDate ?? inst?.due_date ?? '').trim() || calculateDueDate(paymentType, idx, s);
          return { amount, paymentType, description, dueDate };
        };

        // If we have valid installments data, use it
        if (loadedInstallments.length > 0) {
          const normalized = loadedInstallments.map(normalizeInstallment);
          setInstallments(normalized);
 setInstallmentsLoaded(true); // Mark installments as loaded from DB
        } else {
          // Fallback to old Payment 1, 2, 3 format
          const payments = [];
          if (c['Payment 1'])
            payments.push({
              amount: typeof c['Payment 1'] === 'object' ? Number((c['Payment 1'] as any).amount || 0) : Number(c['Payment 1']),
              paymentType:
                typeof c['Payment 1'] === 'object'
                  ? String((c['Payment 1'] as any).type || (c['Payment 1'] as any).paymentType || 'عند التوقيع')
                  : 'عند التوقيع',
              description: 'الدفعة الأولى',
              dueDate: calculateDueDate('عند التوقيع', 0, s)
            });
          if (c['Payment 2'])
            payments.push({
              amount: Number(c['Payment 2']),
              paymentType: 'عند التركيب',
              description: 'الدفعة الثانية',
              dueDate: calculateDueDate('عند التركيب', 1, s)
            });
          if (c['Payment 3'])
            payments.push({
              amount: Number(c['Payment 3']),
              paymentType: 'شهري',
              description: 'الدفعة الثالثة',
              dueDate: calculateDueDate('شهري', 2, s)
            });
          
          if (payments.length > 0) {
            setInstallments(payments);
 setInstallmentsLoaded(true); // Mark installments as loaded from DB
          }
        }

        // ✅ NEW: Load installment distribution settings from DB
        const savedDistributionType = c.installment_distribution_type || 'multiple';
        const savedFirstPaymentAmount = Number(c.installment_first_payment_amount || 0);
        const savedFirstPaymentType = c.installment_first_payment_type || 'amount';
        const savedInterval = c.installment_interval || 'month';
        const savedCount = Number(c.installment_count || 2);
        const savedAutoCalculate = c.installment_auto_calculate === true;
        const savedFirstAtSigning = c.installment_first_at_signing !== false; // default true
        
        setInstallmentDistributionType(savedDistributionType as 'single' | 'multiple' | 'periods');
        setInstallmentFirstPaymentAmount(savedFirstPaymentAmount);
        setInstallmentFirstPaymentType(savedFirstPaymentType as 'amount' | 'percent');
        setInstallmentInterval(savedInterval as 'month' | '2months' | '3months' | '4months' | '5months' | '6months' | '7months');
        setInstallmentCount(savedCount);
        setInstallmentAutoCalculate(savedAutoCalculate);
        setInstallmentFirstAtSigning(savedFirstAtSigning);
        setHasDifferentFirstPayment(savedFirstPaymentAmount > 0);

        // ✅ Load friend billboard rentals for this contract
        const { data: friendRentals } = await supabase
          .from('friend_billboard_rentals')
          .select(`
            billboard_id,
            friend_company_id,
            friend_rental_cost,
            friend_companies!inner(name)
          `)
          .eq('contract_number', Number(contractNumber));

        if (friendRentals && friendRentals.length > 0) {
          const friendCosts = friendRentals.map((rental: any) => ({
            billboardId: String(rental.billboard_id),
            friendCompanyId: rental.friend_company_id,
            friendCompanyName: rental.friend_companies?.name || 'غير محدد',
            friendRentalCost: rental.friend_rental_cost || 0
          }));
          setFriendBillboardCosts(friendCosts);
        }

        // ✅ NEW: Load friend rental operating fee settings
        const friendFeeEnabled = c.friend_rental_operating_fee_enabled === true;
        const friendFeeRate = Number(c.friend_rental_operating_fee_rate || 3);
        setFriendRentalOperatingFeeEnabled(friendFeeEnabled);
        setFriendRentalOperatingFeeRate(friendFeeRate);
        
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || 'تعذر تحميل العقد');
      }
    })();
  }, [contractNumber]);

  // ✅ Load individual discounts from stored contract billboard_prices
  useEffect(() => {
    if (!currentContract || !currentContract.billboard_prices) return;
    try {
      const parsedPrices = typeof currentContract.billboard_prices === 'string'
        ? JSON.parse(currentContract.billboard_prices)
        : currentContract.billboard_prices;
      if (Array.isArray(parsedPrices)) {
        const discounts: Record<string, { value: number; type: 'amount' | 'percent' }> = {};
        parsedPrices.forEach((bp: any) => {
          const bId = String(bp.billboardId || bp.billboard_id || '');
          if (bId && bp.individualDiscountValue !== undefined && bp.individualDiscountValue !== null) {
            discounts[bId] = {
              value: Number(bp.individualDiscountValue) || 0,
              type: bp.individualDiscountType === 'percent' ? 'percent' : 'amount'
            };
          }
        });
        setIndividualDiscounts(discounts);
      }
    } catch (e) {
      console.warn('Failed to parse individual discounts from currentContract:', e);
    }
  }, [currentContract?.billboard_prices]);

  // ✅ Load individual custom dates and reasons from stored contract billboard_prices
  useEffect(() => {
    if (!currentContract || !currentContract.billboard_prices) return;
    try {
      const parsedPrices = typeof currentContract.billboard_prices === 'string'
        ? JSON.parse(currentContract.billboard_prices)
        : currentContract.billboard_prices;
      if (Array.isArray(parsedPrices)) {
        const dates: Record<string, { startDate: string; endDate: string; startDateReason: string }> = {};
        parsedPrices.forEach((bp: any) => {
          const bId = String(bp.billboardId || bp.billboard_id || '');
          if (bId && (bp.startDate || bp.endDate)) {
            dates[bId] = {
              startDate: bp.startDate || '',
              endDate: bp.endDate || '',
              startDateReason: bp.startDateReason || ''
            };
          }
        });
        setBillboardCustomDates(dates);
      }
    } catch (e) {
      console.warn('Failed to parse individual custom dates from currentContract:', e);
    }
  }, [currentContract?.billboard_prices]);

  // 🔄 React to paused/replacement changes anywhere in the app:
  // re-read healed billboard_ids from DB so the new replacement billboard
  // appears immediately in "Selected Billboards" without waiting for save.
  useEffect(() => {
    if (!contractNumber) return;
    const handler = async (e: any) => {
      const detail = e?.detail;
      const eventCN = typeof detail === 'object' ? Number(detail?.contractNumber) : Number(detail);
      if (detail && eventCN && eventCN !== Number(contractNumber)) return;
      try {
        const healedIds = await syncContractIdsWithPaused(Number(contractNumber));
        if (Array.isArray(healedIds)) {
          setSelected(healedIds);
          // Refresh contract snapshot so billboard_prices reflects new entries
          try {
            const { data: c } = await supabase
              .from('Contract')
              .select('billboard_ids, billboard_prices')
              .eq('Contract_Number', Number(contractNumber))
              .maybeSingle();
            if (c) {
              setCurrentContract((prev: any) => prev ? { ...prev, ...c } : prev);
            }
          } catch {}
        }
      } catch (err) {
        console.warn('paused-billboards-changed handler failed:', err);
      }
    };
    window.addEventListener('paused-billboards-changed', handler);
    return () => window.removeEventListener('paused-billboards-changed', handler);
  }, [contractNumber]);

  // Load customer linked_friend_company_id
  useEffect(() => {
    const id = customerId || currentContract?.customer_id;
    if (!id) {
      setCustomerLinkedFriendCompanyId(null);
      return;
    }
    (async () => {
      try {
        const { data } = await supabase
          .from('customers')
          .select('linked_friend_company_id')
          .eq('id', id)
          .maybeSingle();
        if (data) {
          setCustomerLinkedFriendCompanyId(data.linked_friend_company_id);
        } else {
          setCustomerLinkedFriendCompanyId(null);
        }
      } catch (err) {
        console.warn('Failed to load customer linked friend company ID:', err);
      }
    })();
  }, [customerId, currentContract]);

  // Calculate installation_cost when selected billboards change
  useEffect(() => {
    if (selected.length > 0) {
      (async () => {
        try {
          const result = await calculateInstallationCostFromIds(selected);
          setInstallationCost(result.totalInstallationCost);
          setInstallationDetails(result.installationDetails);
        } catch (e) {
          console.warn('Failed to calculate installation_cost:', e);
          setInstallationCost(0);
          setInstallationDetails([]);
        }
      })();
    } else {
      setInstallationCost(0);
      setInstallationDetails([]);
    }
  }, [selected]);

  // Auto-calculate end date
  useEffect(() => {
    if (!startDate) return;
    const d = new Date(startDate);
    const end = new Date(d);
    if (pricingMode === 'months') {
      if (use30DayMonth) {
        // حساب الشهر = 30 يوم ثابت
        const days = Math.max(0, Number(durationMonths || 0)) * 30;
        end.setDate(end.getDate() + days);
      } else {
        // حساب الأيام الفعلية للشهر
        end.setMonth(end.getMonth() + durationMonths);
      }
    } else {
      const days = Math.max(0, Number(durationDays || 0));
      end.setDate(end.getDate() + days);
    }
    const iso = end.toISOString().split('T')[0];
    setEndDate(iso);
  }, [startDate, durationMonths, durationDays, pricingMode, use30DayMonth]);


  // ✅ FIXED: Enhanced price lookup with fallback to size name matching (Optimized Logging)
  const getPriceFromDatabase = (sizeId: number | null, level: any, customer: string, months: number, sizeName?: string): number | null => {
    let dbRow = null;
    
    // Try by size_id first if available
    if (sizeId !== null && sizeId !== undefined) {
      dbRow = pricingData.find(p => {
        const pSizeId = p.size_id !== null && p.size_id !== undefined ? Number(p.size_id) : null;
        return pSizeId === sizeId && 
               String(p.billboard_level || '').trim().toUpperCase() === String(level || '').trim().toUpperCase() && 
               String(p.customer_category || '').trim().toUpperCase() === String(customer || '').trim().toUpperCase();
      });
      
    }
    
    // FALLBACK: If no size_id or not found, try by size name with normalization
    if (!dbRow && sizeName) {
      const normalizedInputSize = normalizeSize(sizeName);
      
      dbRow = pricingData.find(p => {
        const dbSize = normalizeSize(String(p.size || ''));
        return dbSize === normalizedInputSize && 
               String(p.billboard_level || '').trim().toUpperCase() === String(level || '').trim().toUpperCase() && 
               String(p.customer_category || '').trim().toUpperCase() === String(customer || '').trim().toUpperCase();
      });
    }
    
    if (dbRow) {
      const monthColumnMap: { [key: number]: string } = {
        1: 'one_month',
        2: '2_months', 
        3: '3_months',
        6: '6_months',
        12: 'full_year'
      };
      
      const column = monthColumnMap[months];
      if (column && dbRow[column] !== null && dbRow[column] !== undefined) {
        return Number(dbRow[column]) || 0;
      }
    }
    
    if (customer !== 'عادي') {
      return getPriceFromDatabase(sizeId, level, 'عادي', months, sizeName);
    }
    
    return null;
  };

  const getDailyPriceFromDatabase = (sizeId: number | null, level: any, customer: string, sizeName?: string): number | null => {
    
    let dbRow = null;
    
    // Try by size_id first if available
    if (sizeId) {
      dbRow = pricingData.find(p => 
        p.size_id === sizeId && 
        String(p.billboard_level || '').trim().toUpperCase() === String(level || '').trim().toUpperCase() && 
        String(p.customer_category || '').trim().toUpperCase() === String(customer || '').trim().toUpperCase()
      );
    }
    
    // ✅ FALLBACK: If no size_id or not found, try by size name with normalization
    if (!dbRow && sizeName) {
      const normalizedInputSize = normalizeSize(sizeName);
      
      dbRow = pricingData.find(p => {
        const dbSize = normalizeSize(String(p.size || ''));
        return dbSize === normalizedInputSize && 
               String(p.billboard_level || '').trim().toUpperCase() === String(level || '').trim().toUpperCase() && 
               String(p.customer_category || '').trim().toUpperCase() === String(customer || '').trim().toUpperCase();
      });
    }
    
    if (dbRow && dbRow.one_day !== null && dbRow.one_day !== undefined) {
      const dailyPrice = Number(dbRow.one_day) || 0;
      return dailyPrice;
    }
    
    if (customer !== 'عادي') {
      return getDailyPriceFromDatabase(sizeId, level, 'عادي', sizeName);
    }
    
    console.warn(`❌ No daily price found for size_id=${sizeId}, sizeName=${sizeName}`);
    return null;
  };

  // ✅ NEW: Get stored price from contract's billboard_prices data
  const getStoredPriceFromContract = (billboardId: string): number | null => {
    if (!currentContract?.billboard_prices) return null;
    
    try {
      const billboardPrices = typeof currentContract.billboard_prices === 'string' 
        ? JSON.parse(currentContract.billboard_prices)
        : currentContract.billboard_prices;
      
      // ✅ SAFE TYPE-AGNOSTIC LOOKUP (String comparison + fallback property names)
      const storedPrice = billboardPrices.find((bp: any) => 
        String(bp.billboardId || bp.billboard_id || '') === String(billboardId)
      );
      if (!storedPrice) return null;

      // ✅ FIXED: For contracts created in ContractCreate.tsx, basePriceBeforeDiscount is missing.
      // We calculate it by taking priceBeforeDiscount (which includes printCost) and subtracting printCost.
      // This prevents double-discounting when editing the contract.
      let basePrice = storedPrice.basePriceBeforeDiscount ?? storedPrice.baseRental;
      if (basePrice === undefined || basePrice === null) {
        if (storedPrice.priceBeforeDiscount !== undefined && storedPrice.priceBeforeDiscount !== null) {
          basePrice = Number(storedPrice.priceBeforeDiscount) - Number(storedPrice.printCost || 0);
        } else {
          basePrice = storedPrice.contractPrice ?? 0;
        }
      }

      return Number(basePrice) || null;
    } catch (e) {
      console.warn('Failed to parse stored billboard prices:', e);
      return null;
    }
  };

  // ✅ UPDATED: Calculate print cost only if enabled and consider faces count
  const calculatePrintCost = (billboard: Billboard): number => {
    if (!printCostEnabled || !printPricePerMeter || printPricePerMeter <= 0) return 0;
    
    const size = (billboard.size || (billboard as any).Size || '') as string;
    const faces = Number((billboard as any).faces || (billboard as any).Faces || (billboard as any).faces_count || (billboard as any).Faces_Count || 1);
    const sizeId = Number((billboard as any).size_id);
    
    // ✅ Use actual dimensions from sizes table
    let width = 0, height = 0;
    if (sizeId && sizeDimensions.has(sizeId)) {
      const dims = sizeDimensions.get(sizeId)!;
      width = dims.width;
      height = dims.height;
    } else {
      const sizeMatch = size.match(/(\d+(?:[.,]\d+)?)\s*[xX×\-]\s*(\d+(?:[.,]\d+)?)/);
      if (!sizeMatch) return 0;
      width = parseFloat(sizeMatch[1].replace(',', '.'));
      height = parseFloat(sizeMatch[2].replace(',', '.'));
    }
    
    if (width <= 0 || height <= 0) return 0;
    // تقريب الأبعاد لأقرب عدد صحيح (الإجراء الهندسي الصحيح)
    width = Math.round(width);
    height = Math.round(height);
    const area = width * height;
    
    return area * faces * printPricePerMeter;
  };

  // ✅ NEW: Calculate price using factors system
  const calculateFactorsPrice = (billboard: Billboard): number => {
    const size = (billboard.size || (billboard as any).Size || '') as string;
    const level = ((billboard as any).level || (billboard as any).Level || 'A') as string;
    const municipality = ((billboard as any).municipality || (billboard as any).Municipality || '') as string;

    // Find base price for this size and level
    const basePrice = basePrices.find(bp => 
      bp.size_name === size && 
      String(bp.billboard_level || '').trim().toUpperCase() === String(level || '').trim().toUpperCase()
    );

    if (!basePrice) {
      console.warn(`⚠️ No base price found for size=${size}, level=${level}`);
      return 0;
    }

    // Get the price based on duration
    let priceValue = 0;
    if (pricingMode === 'months') {
      const months = Math.max(1, Number(durationMonths || 1));
      if (months === 1) priceValue = basePrice.one_month || 0;
      else if (months === 2) priceValue = basePrice.two_months || 0;
      else if (months === 3) priceValue = basePrice.three_months || 0;
      else if (months >= 6 && months < 12) priceValue = basePrice.six_months || 0;
      else if (months >= 12) priceValue = basePrice.full_year || 0;
      else priceValue = (basePrice.one_month || 0) * months;
    } else {
      const days = Math.max(1, Number(durationDays || 1));
      priceValue = (basePrice.one_day || 0) * days;
    }

    // Find municipality factor
    const muniFactor = municipalityFactors.find(mf => 
      String(mf.municipality_name || '').trim().toUpperCase() === String(municipality || '').trim().toUpperCase()
    );
    const municipalityMultiplier = muniFactor?.factor || 1;

    // Find category factor
    const catFactor = categoryFactors.find(cf => 
      String(cf.category_name || '').trim().toUpperCase() === String(pricingCategory || '').trim().toUpperCase()
    );
    const categoryMultiplier = catFactor?.factor || 1;

    // Final price = base price × municipality factor × category factor
    const finalPrice = priceValue * municipalityMultiplier * categoryMultiplier;

    return finalPrice;
  };

  // ✅ FIXED: Calculate billboard price - returns BASE RENTAL PRICE ONLY (no print/installation costs)
  // Print and installation costs are handled separately based on "include in price" flags
  // Using useCallback to ensure re-renders when dependencies change
  const calculateBillboardPrice = React.useCallback((billboard: Billboard): number => {
    const billboardId = String((billboard as any).ID);
    
    // ✅ NEW: Check for proportional distribution overrides first
    if (billboardPriceOverrides[billboardId] !== undefined) {
      return billboardPriceOverrides[billboardId];
    }
    
    let basePrice = 0;
    
    // ✅ ONLY use stored prices if user explicitly chose to
    if (useStoredPrices) {
      const storedPrice = getStoredPriceFromContract(billboardId);
      if (storedPrice !== null) {
        basePrice = storedPrice;
        return applyExchangeRate(basePrice);
      }
    }

    // ✅ NEW: Use factors pricing if enabled
    if (useFactorsPricing) {
      basePrice = calculateFactorsPrice(billboard);
      // ✅ FIXED: Don't add print cost here - it's handled separately
      return applyExchangeRate(basePrice);
    }
    
    // ✅ Calculate fresh price based on CURRENT billboard data (original pricing table)
    
    // ✅ Get both size_id and size name for fallback - ENSURE IT'S A NUMBER!
    const rawSizeId = (billboard as any).size_id || (billboard as any).Size_ID || null;
    const sizeId = rawSizeId !== null ? Number(rawSizeId) : null;
    const level = ((billboard as any).level || (billboard as any).Level) as any;
    const size = (billboard.size || (billboard as any).Size || '') as string;
    
    if (pricingMode === 'months') {
      const months = Math.max(0, Number(durationMonths || 0));
      // ✅ Get price from database (with size name fallback)
      let price = getPriceFromDatabase(sizeId, level, pricingCategory, months, size);
      if (price === null) {
        price = getPriceFor(size, level, pricingCategory as CustomerType, months);
      }
      basePrice = price !== null ? price : 0;
    } else {
      const days = Math.max(0, Number(durationDays || 0));
      // ✅ Get daily price from database (with size name fallback)
      let daily = getDailyPriceFromDatabase(sizeId, level, pricingCategory, size);
      if (daily === null) {
        daily = getDailyPriceFor(size, level, pricingCategory as CustomerType);
      }
      if (daily === null) {
        let monthlyPrice = getPriceFromDatabase(sizeId, level, pricingCategory, 1, size);
        if (monthlyPrice === null) {
          monthlyPrice = getPriceFor(size, level, pricingCategory as CustomerType, 1) || 0;
        }
        daily = monthlyPrice ? Math.round((monthlyPrice / 30) * 100) / 100 : 0;
      }
      basePrice = (daily || 0) * days;
    }

    // ✅ FIXED: Return BASE price only - print/installation costs handled separately
    const convertedPrice = applyExchangeRate(basePrice);
    
    return convertedPrice;
  }, [useStoredPrices, useFactorsPricing, pricingMode, durationMonths, durationDays, pricingCategory, pricingData, contractCurrency, exchangeRate, basePrices, municipalityFactors, categoryFactors, currentContract, billboardPriceOverrides]);

  // Auto-initialize friend billboard costs when selected billboards or customer change
  useEffect(() => {
    if (selected.length === 0) {
      setFriendBillboardCosts([]);
      return;
    }

    setFriendBillboardCosts(prev => {
      // Keep only selected friend billboards
      const updated = prev.filter(item => selected.includes(item.billboardId));
      
      // Add missing ones
      selected.forEach(id => {
        const billboard = billboards.find(b => String((b as any).ID) === id);
        if (billboard && (billboard as any).friend_company_id) {
          const isCustomerFriend = !customerLinkedFriendCompanyId || (billboard as any).friend_company_id === customerLinkedFriendCompanyId;
          
          if (isCustomerFriend) {
            const exists = updated.some(item => item.billboardId === id);
            if (!exists) {
              const price = calculateBillboardPrice(billboard);
              
              updated.push({
                billboardId: id,
                friendCompanyId: (billboard as any).friend_company_id,
                friendCompanyName: (billboard as any).friend_companies?.name || 'شركة صديقة',
                friendRentalCost: price
              });
            }
          }
        }
      });
      return updated;
    });
  }, [selected, billboards, calculateBillboardPrice, customerLinkedFriendCompanyId]);

  // Recalculate/apply pricing when customer category or duration changes
  useEffect(() => {
    setFriendBillboardCosts(prev => {
      return prev.map(item => {
        const billboard = billboards.find(b => String((b as any).ID) === item.billboardId);
        if (billboard) {
          const price = calculateBillboardPrice(billboard);
          return { ...item, friendRentalCost: price };
        }
        return item;
      });
    });
  }, [calculateBillboardPrice]);

  // ✅ NEW: Refresh prices from current pricing system
  const refreshPricesFromSystem = async () => {
    try {
      setRefreshingPrices(true);
      
      // Switch to using fresh prices
      setUseStoredPrices(false);
      
      // Force recalculation by updating a dependency
      setUserEditedRentCost(false);
      
      toast.success('تم تحديث الأسعار من المنظومة الحالية');
      
    } catch (e: any) {
      console.error('Failed to refresh prices:', e);
      toast.error('فشل تحديث الأسعار');
    } finally {
      setRefreshingPrices(false);
    }
  };

  // ✅ Refresh canonical contract & billboards data after in-place swaps/operations without page reload
  const refreshContractData = async () => {
    if (!contractNumber) return;
    try {
      const c = await getContractWithBillboards(contractNumber);
      if (c) {
        setCurrentContract(c);
        if (c.billboard_ids) {
          const ids = String(c.billboard_ids).split(',').map((s: string) => s.trim()).filter(Boolean);
          setSelected(ids);
        }
        const { data: bbs } = await supabase.from('billboards').select('*').limit(3000);
        if (bbs) {
          setBillboards(bbs);
        }
      }
    } catch (err) {
      console.error('Failed to refresh contract data:', err);
    }
  };


  const calculateDueDate = (paymentType: string, index: number, startDateOverride?: string): string => {
    const baseDate = startDateOverride || startDate;
    if (!baseDate) return '';
    
    const date = new Date(baseDate);
    
    if (paymentType === 'عند التوقيع') {
      return baseDate;
    } else if (paymentType === 'شهري') {
      date.setMonth(date.getMonth() + (index + 1));
    } else if (paymentType === 'شهرين') {
      date.setMonth(date.getMonth() + (index + 1) * 2);
    } else if (paymentType === 'ثلاثة أشهر') {
      date.setMonth(date.getMonth() + (index + 1) * 3);
    } else if (paymentType === 'عند التركيب') {
      date.setDate(date.getDate() + 7);
    } else if (paymentType === 'نهاية العقد') {
      return endDate || '';
    } else if (paymentType === 'بعد 20% من العقد') {
      const targetEndDate = endDate;
      if (baseDate && targetEndDate) {
        const start = new Date(baseDate);
        const end = new Date(targetEndDate);
        const duration = end.getTime() - start.getTime();
        if (duration > 0) {
          const offset = duration * 0.20;
          const target = new Date(start.getTime() + offset);
          return target.toISOString().split('T')[0];
        }
      }
      // Fallback: 15 days from start date
      date.setDate(date.getDate() + 15);
      return date.toISOString().split('T')[0];
    } else if (paymentType && paymentType.startsWith('بعد مرور ') && paymentType.endsWith('% من العقد')) {
      const match = paymentType.match(/بعد مرور\s+(\d+)%\s+من\s+العقد/);
      if (match) {
        const percent = parseInt(match[1], 10);
        const targetEndDate = endDate;
        if (baseDate && targetEndDate) {
          const start = new Date(baseDate);
          const end = new Date(targetEndDate);
          const duration = end.getTime() - start.getTime();
          if (duration > 0) {
            const offset = duration * (percent / 100);
            const target = new Date(start.getTime() + offset);
            return target.toISOString().split('T')[0];
          }
        }
      }
    }
    
    return date.toISOString().split('T')[0];
  };

  // ✅ FIXED: Calculate installation_cost summary - show always when billboards are selected
  const installationCostSummary = useMemo(() => {
    // ✅ CHANGED: Show when there are selected billboards, regardless of cost
    if (selected.length === 0) return null;

    const totalInstallationCost = installationDetails.reduce((sum, detail) => sum + (detail.installationPrice || 0), 0);
    
    // Group by size and show unique prices without repetition
    const groupedDetails = installationDetails.reduce((groups: any, detail) => {
      const key = `${detail.size}`;
      if (!groups[key]) {
        groups[key] = {
          size: detail.size,
          pricePerUnit: detail.installationPrice || 0,
          count: 0,
          totalForSize: 0,
          hasPrice: detail.installationPrice !== null && detail.installationPrice > 0
        };
      }
      groups[key].count += 1;
      groups[key].totalForSize += (detail.installationPrice || 0);
      return groups;
    }, {});
    
    return {
      totalInstallationCost,
      groupedSizes: Object.values(groupedDetails),
      hasAnyInstallationCost: totalInstallationCost > 0
    };
  }, [selected.length, installationDetails]);

  // ✅ NEW: Calculate print cost summary with grouped sizes and faces
  const printCostSummary = useMemo(() => {
    if (!printCostEnabled || !printPricePerMeter || printPricePerMeter <= 0 || selected.length === 0) return null;

    const selectedBillboards = billboards.filter(b => selected.includes(String((b as any).ID)));
    
    // Group by size and faces to avoid repetition
    const groupedDetails = selectedBillboards.reduce((groups: any, billboard) => {
      const size = (billboard.size || (billboard as any).Size || '') as string;
      const faces = Number((billboard as any).faces || (billboard as any).Faces || (billboard as any).faces_count || (billboard as any).Faces_Count || 1);
      const sizeId = Number((billboard as any).size_id);
      
      // ✅ Use actual dimensions from sizes table instead of parsing size name
      let width = 0, height = 0;
      if (sizeId && sizeDimensions.has(sizeId)) {
        const dims = sizeDimensions.get(sizeId)!;
        width = dims.width;
        height = dims.height;
      } else {
        // Fallback: parse from size name
        const sizeMatch = size.match(/(\d+(?:[.,]\d+)?)\s*[xX×\-]\s*(\d+(?:[.,]\d+)?)/);
        if (!sizeMatch) return groups;
        width = parseFloat(sizeMatch[1].replace(',', '.'));
        height = parseFloat(sizeMatch[2].replace(',', '.'));
      }
      
      // تقريب الأبعاد لأقرب عدد صحيح (الإجراء الهندسي الصحيح)
      width = Math.round(width);
      height = Math.round(height);
      
      if (width <= 0 || height <= 0) return groups;
      const area = width * height;
      
      const key = `${size}_${faces}faces`;
      
      if (!groups[key]) {
        groups[key] = {
          size,
          faces,
          area,
          count: 0,
          totalArea: 0,
          costPerUnit: area * faces * printPricePerMeter,
          totalCost: 0
        };
      }
      
      groups[key].count += 1;
      groups[key].totalArea += area * faces;
      groups[key].totalCost += area * faces * printPricePerMeter;
      
      return groups;
    }, {});

    const totalPrintCost = Object.values(groupedDetails).reduce((sum: number, group: any) => sum + group.totalCost, 0);
    
    return {
      totalPrintCost,
      groupedDetails: Object.values(groupedDetails)
    };
  }, [billboards, selected, printCostEnabled, printPricePerMeter, sizeDimensions]);

  // Convenience alias (used across calculations + saving)
  const printCostTotal = useMemo(() => Number(printCostSummary?.totalPrintCost || 0), [printCostSummary]);

  // Calculations
  const cities = useMemo(() => Array.from(new Set(billboards.map(b => (b as any).city || (b as any).City))).filter(Boolean).sort() as string[], [billboards]);
  const sizes = useMemo(() => Array.from(new Set(billboards.map(b => (b as any).Size || (b as any).size))).filter(Boolean).sort() as string[], [billboards]);
  const municipalities = useMemo(() => {
    const base = Array.from(new Set(billboards.map(b => (b as any).municipality || (b as any).Municipality))).filter(Boolean).sort() as string[];
    if (cityFilter !== 'all') {
      const cityBillboards = billboards.filter(b => ((b as any).city || (b as any).City) === cityFilter);
      return Array.from(new Set(cityBillboards.map(b => (b as any).municipality || (b as any).Municipality))).filter(Boolean).sort() as string[];
    }
    return base;
  }, [billboards, cityFilter]);

  // ✅ FIXED: estimatedTotal is BASE RENTAL ONLY - print/installation costs handled separately in finalTotal
  // And for replacements, their allocated amount should be used instead of catalog price to keep calculations exact.
  const estimatedTotal = useMemo(() => {
    const sel = billboards.filter((b) => selected.includes(String((b as any).ID)));
    if (pricingMode === 'months') {
      const months = Math.max(0, Number(durationMonths || 0));
      if (!months) return 0;
      return sel.reduce((acc, b) => {
        const id = String((b as any).ID);
        const isReplacement = replacementAllocationsMap.has(id);
        const replacementAllocation = isReplacement ? Number(replacementAllocationsMap.get(id) || 0) : 0;
        const billboardPrice = isReplacement ? replacementAllocation : calculateBillboardPrice(b);
        return acc + billboardPrice;
      }, 0);
    } else {
      const days = Math.max(0, Number(durationDays || 0));
      if (!days) return 0;
      return sel.reduce((acc, b) => {
        const id = String((b as any).ID);
        const isReplacement = replacementAllocationsMap.has(id);
        const replacementAllocation = isReplacement ? Number(replacementAllocationsMap.get(id) || 0) : 0;
        const billboardPrice = isReplacement ? replacementAllocation : calculateBillboardPrice(b);
        return acc + billboardPrice;
      }, 0);
    }
  }, [billboards, selected, durationMonths, durationDays, pricingMode, pricingCategory, pricingData, useStoredPrices, contractCurrency, exchangeRate, useFactorsPricing, basePrices, municipalityFactors, categoryFactors, replacementAllocationsMap]);

  // Paused billboards pricing — first call (no merged details yet) — needed early to unify discount base
  const pausedPricingFirst = usePausedBillboardsPricing(
    contractNumber ? Number(contractNumber) : null,
    startDate,
    endDate,
    {
      calculateBillboardPrice,
      printCostEnabled,
      includePrintInPrice,
      installationEnabled,
      includeInstallationInPrice,
      singleFaceBillboards,
    },
  );

  const baseTotal = useMemo(() => (rentCost && rentCost > 0 ? rentCost : estimatedTotal), [rentCost, estimatedTotal]);

  useEffect(() => {
    // ✅ لا تدوس على rentCost المحمّل من DB إذا كان useStoredPrices = true أو إذا لم يطلب المستخدم تحديث الأسعار
    if (!userEditedRentCost && estimatedTotal > 0 && !useStoredPrices) {
      setRentCost(estimatedTotal);
    }
  }, [estimatedTotal, userEditedRentCost, useStoredPrices]);

  // ✅ توحيد قاعدة الخصم: المختارة + الموقوفة (قبل الخصم) - طرح المخصص للبديلة لتفادي تضخيم قاعدة الخصم
  const pausedBaseRentalSumForDiscount = Number(pausedPricingFirst?.totals?.baseRentalSum || 0);
  const pausedAllocatedSumForDiscount = Number(pausedPricingFirst?.totals?.allocatedSum || 0);
  const combinedDiscountBase = useMemo(
    () => Math.max(0, baseTotal + pausedBaseRentalSumForDiscount - pausedAllocatedSumForDiscount),
    [baseTotal, pausedBaseRentalSumForDiscount, pausedAllocatedSumForDiscount]
  );

  const discountAmount = useMemo(() => {
    if (!discountValue) return 0;
    return discountType === 'percent'
      ? (combinedDiscountBase * Math.max(0, Math.min(100, discountValue)) / 100)
      : Math.max(0, discountValue);
  }, [discountType, discountValue, combinedDiscountBase]);

  // حصة المختارة من الخصم الكلي (نسبياً) — الباقي تتحمّله اللوحات الموقوفة
  const selectedDiscountShare = useMemo(() => {
    if (combinedDiscountBase <= 0 || discountAmount <= 0) return 0;
    return discountAmount * (baseTotal / combinedDiscountBase);
  }, [discountAmount, baseTotal, combinedDiscountBase]);

  // ✅ CORRECTED: Totals must respect "include installation/print in price" flags
  // - finalTotal: what the CUSTOMER pays
  // - rentalCostOnly: net rental for the COMPANY (base after discount minus included service costs)
  const rentalAfterDiscount = useMemo(
    () => Math.max(0, baseTotal - selectedDiscountShare),
    [baseTotal, selectedDiscountShare]
  );

  // Helper: compute print cost for a single billboard (matches selected-billboards logic)
  const computePrintForBillboard = React.useCallback((billboard: any): number => {
    if (!billboard) return 0;
    const sizeId = Number(billboard.size_id);
    const size = (billboard.Size || billboard.size || '') as string;
    let width = 0, height = 0;
    if (sizeId && sizeDimensions.has(sizeId)) {
      const dims = sizeDimensions.get(sizeId)!;
      width = dims.width;
      height = dims.height;
    } else {
      const m = size.match(/(\d+(?:[.,]\d+)?)\s*[xX×\-]\s*(\d+(?:[.,]\d+)?)/);
      if (m) {
        width = parseFloat(m[1].replace(',', '.'));
        height = parseFloat(m[2].replace(',', '.'));
      }
    }
    width = Math.round(width);
    height = Math.round(height);
    const area = width * height;
    const faces = Number(billboard.Faces_Count || billboard.faces_count || 1);
    return applyExchangeRate(area * faces * printPricePerMeter);
  }, [sizeDimensions, printPricePerMeter, exchangeRate]);

  // Paused installation details (separate from selected to avoid double-counting in summaries)
  const [pausedInstallationDetails, setPausedInstallationDetails] = useState<Array<{
    billboardId: string; billboardName: string; size: string;
    installationPrice: number; faces?: number; adjustedPrice?: number;
  }>>([]);

  // Real installation dates per billboard for the CURRENT contract (from installation_task_items)
  const [installDatesByBillboard, setInstallDatesByBillboard] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (!contractNumber) { setInstallDatesByBillboard(new Map()); return; }
    (async () => {
      try {
        const { resolveInstallDatesForContract } = await import('@/utils/installDateResolver');
        const m = await resolveInstallDatesForContract(contractNumber);
        setInstallDatesByBillboard(m);
      } catch (e) {
        console.warn('Failed to resolve install dates:', e);
      }
    })();
  }, [contractNumber]);

  // (pausedPricingFirst declared earlier — used both for discount unification and item objects below)

  const pausedBillboardObjects = useMemo(
    () => pausedPricingFirst.items.map(i => i.billboard).filter(Boolean),
    [pausedPricingFirst.items]
  );
  const pausedBillboardIds = useMemo(
    () => pausedPricingFirst.items.map(i => String(i.raw.billboard_id)),
    [pausedPricingFirst.items]
  );

  // ✅ جلب اللوحات البديلة لهذا العقد (replacement_billboard_id → allocated_amount)
  // حتى يعرف منطق التسعير الموحد أن سعر اللوحة البديلة = allocated_amount فقط.
  useEffect(() => {
    if (!contractNumber) {
      setReplacementAllocationsMap(new Map());
      return;
    }
    let cancelled = false;
    const fetchReplacements = async () => {
      try {
        const [pauseRepls, swapLogsRes] = await Promise.all([
          supabase
            .from('paused_billboard_replacements' as any)
            .select('replacement_billboard_id, allocated_amount')
            .eq('contract_number', Number(contractNumber)),
          supabase
            .from('activity_log')
            .select('*')
            .eq('action', 'instant_billboard_swap')
            .or(`contract_number.eq.${contractNumber},entity_id.eq.${contractNumber}`),
        ]);
        if (cancelled) return;
        const m = new Map<string, number>();
        (pauseRepls.data || []).forEach((r: any) => {
          m.set(String(r.replacement_billboard_id), Number(r.allocated_amount) || 0);
        });
        (swapLogsRes.data || []).forEach((log: any) => {
          let details: any = {};
          try {
            details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details || {};
          } catch {
            details = {};
          }
          if (details?.replacement_billboard_id) {
            m.set(String(details.replacement_billboard_id), Number(details.preserved_contract_price) || 0);
          }
        });
        setReplacementAllocationsMap(m);
      } catch (e) {
        if (!cancelled) setReplacementAllocationsMap(new Map());
      }
    };
    fetchReplacements();
    const handler = (e: any) => {
      const cn = Number(e?.detail?.contractNumber ?? e?.detail);
      if (!e?.detail || cn === Number(contractNumber)) fetchReplacements();
    };
    window.addEventListener('paused-billboards-changed', handler);
    return () => {
      cancelled = true;
      window.removeEventListener('paused-billboards-changed', handler);
    };
  }, [contractNumber]);

  // 🛡️ Defensive: never let a paused billboard contribute to the "selected"
  // pricing/display even if it somehow lingers inside billboard_ids.
  const pausedIdsSet = useMemo(() => new Set(pausedBillboardIds), [pausedBillboardIds]);
  const selectedSansPaused = useMemo(
    () => selected.filter((id) => !pausedIdsSet.has(String(id))),
    [selected, pausedIdsSet],
  );

  // Self-heal: drop paused IDs from selected state silently so every
  // downstream computation (estimatedTotal, baseTotal, pricing, save) uses
  // a clean selection without the paused billboards.
  useEffect(() => {
    if (pausedIdsSet.size === 0) return;
    if (selected.some((id) => pausedIdsSet.has(String(id)))) {
      setSelected((prev) => prev.filter((id) => !pausedIdsSet.has(String(id))));
    }
  }, [pausedIdsSet, selected]);

  // Fetch installation details for paused billboards
  useEffect(() => {
    if (pausedBillboardIds.length === 0) {
      setPausedInstallationDetails([]);
      return;
    }
    (async () => {
      try {
        const result = await calculateInstallationCostFromIds(pausedBillboardIds);
        setPausedInstallationDetails(result.installationDetails || []);
      } catch (e) {
        console.warn('Failed to calculate paused installation cost:', e);
        setPausedInstallationDetails([]);
      }
    })();
  }, [pausedBillboardIds.join(',')]);

  // Merged details (selected + paused) — passed only to children that need them
  const mergedInstallationDetails = useMemo(
    () => [...installationDetails, ...pausedInstallationDetails],
    [installationDetails, pausedInstallationDetails]
  );

  const mergedPrintCostDetails = useMemo(() => {
    const selectedDetails = selected.map(id => {
      const billboard = billboards.find(b => String((b as any).ID) === id);
      return { billboardId: id, printCost: billboard ? computePrintForBillboard(billboard) : 0 };
    });
    const pausedDetails = pausedBillboardObjects.map((b: any) => ({
      billboardId: String(b.ID),
      printCost: computePrintForBillboard(b),
    }));
    return [...selectedDetails, ...pausedDetails];
  }, [selected, billboards, pausedBillboardObjects, computePrintForBillboard]);

  // ✅ Unified pricing across selected + paused billboards so the contract discount
  // is distributed identically over both groups (single source of truth).
  const unifiedPricingByBillboard = useMemo(() => {
    const selectedInputs = selected
      .map((id) => {
        const bb = billboards.find((b) => String((b as any).ID) === id);
        if (!bb) return null;
        const installRaw = installationDetails.find((d) => d.billboardId === id)?.installationPrice || 0;
        const printRaw = mergedPrintCostDetails.find((d) => d.billboardId === id)?.printCost || 0;
        const isReplacement = replacementAllocationsMap.has(id);
        const replacementAllocation = isReplacement ? Number(replacementAllocationsMap.get(id) || 0) : 0;
        const indDiscount = individualDiscounts[id];
        const origFaces = Number((bb as any).Faces_Count ?? (bb as any).faces_count ?? (bb as any).faces ?? 2);
        return {
          billboardId: id,
          baseRentalPrice: calculateBillboardPrice(bb),
          installationPrice: installRaw,
          printCost: printRaw,
          isSingleFace: origFaces === 1 || singleFaceBillboards.has(id),
          isReplacement,
          replacementAllocation,
          individualDiscountValue: indDiscount?.value,
          individualDiscountType: indDiscount?.type,
        };
      })
      .filter(Boolean) as any[];

    const pausedInputs = pausedBillboardObjects.map((bb: any) => {
      const id = String(bb.ID);
      const installRaw = pausedInstallationDetails.find((d) => d.billboardId === id)?.installationPrice || 0;
      const printRaw = mergedPrintCostDetails.find((d) => d.billboardId === id)?.printCost || 0;
      const indDiscount = individualDiscounts[id];
      const origFaces = Number((bb as any).Faces_Count ?? (bb as any).faces_count ?? (bb as any).faces ?? 2);
      return {
        billboardId: id,
        baseRentalPrice: calculateBillboardPrice(bb),
        installationPrice: installRaw,
        printCost: printRaw,
        isSingleFace: origFaces === 1 || singleFaceBillboards.has(id),
        individualDiscountValue: indDiscount?.value,
        individualDiscountType: indDiscount?.type,
      };
    });

    const results = calculateAllBillboardPrices([...selectedInputs, ...pausedInputs], {
      totalDiscount: discountAmount,
      printCostEnabled,
      includePrintInPrice,
      installationEnabled,
      includeInstallationInPrice,
    });
    return new Map(results.map((r) => [r.billboardId, r]));
  }, [
    selected,
    billboards,
    installationDetails,
    pausedBillboardObjects,
    pausedInstallationDetails,
    mergedPrintCostDetails,
    calculateBillboardPrice,
    singleFaceBillboards,
    discountAmount,
    printCostEnabled,
    includePrintInPrice,
    installationEnabled,
    includeInstallationInPrice,
    replacementAllocationsMap,
    individualDiscounts,
  ]);

  // ✅ Combined service totals (selected + paused) — derived from the unified pricing source.
  // Used so that print/installation costs of paused billboards are properly:
  //  - charged to the customer (when "not included in price")
  //  - subtracted from company net rental (when "included in price")
  //  - counted in operating fees and DB save
  // This prevents financial losses when print/installation are enabled on a contract.
  const combinedServiceTotals = useMemo(() => {
    let installRaw = 0, printRaw = 0;
    let includedInstall = 0, includedPrint = 0;
    let extraInstall = 0, extraPrint = 0;
    unifiedPricingByBillboard.forEach((r: any) => {
      installRaw += Number(r.installationPrice || 0);
      printRaw += Number(r.printCost || 0);
      includedInstall += Number(r.includedInstallCost || 0);
      includedPrint += Number(r.includedPrintCost || 0);
      extraInstall += Number(r.extraInstallCost || 0);
      extraPrint += Number(r.extraPrintCost || 0);
    });
    return { installRaw, printRaw, includedInstall, includedPrint, extraInstall, extraPrint };
  }, [unifiedPricingByBillboard]);

  const installationCostCombined = combinedServiceTotals.installRaw;
  const printCostTotalCombined = combinedServiceTotals.printRaw;

  // ✅ CORRECTED: Totals must respect "include installation/print in price" flags
  // AND include paused billboards' service costs so no money is lost on the contract.
  const includedInstallationCost = useMemo(() => {
    if (!installationEnabled || !includeInstallationInPrice) return 0;
    return applyExchangeRate(combinedServiceTotals.includedInstall);
  }, [installationEnabled, includeInstallationInPrice, combinedServiceTotals.includedInstall, exchangeRate]);

  const includedPrintCost = useMemo(() => {
    if (!printCostEnabled || !includePrintInPrice) return 0;
    return applyExchangeRate(combinedServiceTotals.includedPrint);
  }, [printCostEnabled, includePrintInPrice, combinedServiceTotals.includedPrint, exchangeRate]);

  const extraInstallationChargedToCustomer = useMemo(() => {
    if (!installationEnabled || includeInstallationInPrice) return 0;
    return applyExchangeRate(combinedServiceTotals.extraInstall);
  }, [installationEnabled, includeInstallationInPrice, combinedServiceTotals.extraInstall, exchangeRate]);

  const extraPrintChargedToCustomer = useMemo(() => {
    if (!printCostEnabled || includePrintInPrice) return 0;
    return applyExchangeRate(combinedServiceTotals.extraPrint);
  }, [printCostEnabled, includePrintInPrice, combinedServiceTotals.extraPrint, exchangeRate]);

  const netRentalForCompany = useMemo(() => {
    // Net rental = rental after discount − included service costs (selected + paused) − friend rentals
    // ⚠️ لا نستخدم Math.max(0, ...) حتى لا نخفي القيمة السالبة (عقد خاسر)
    return rentalAfterDiscount - includedInstallationCost - includedPrintCost - totalFriendCosts;
  }, [rentalAfterDiscount, includedInstallationCost, includedPrintCost, totalFriendCosts]);

  // نفس أرقام كرت اللوحات المختارة بالضبط — مصدر واحد للحفظ والطباعة
  const selectedBillboardPricingSnapshot = useMemo(() => {
    return selected
      .map((id) => {
        const r = unifiedPricingByBillboard.get(id);
        if (!r) return null;
        const finalPrice = Math.round(r.totalForBoard);
        return {
          billboardId: r.billboardId,
          basePriceBeforeDiscount: r.baseRentalPrice,
          baseRental: r.baseRentalPrice,
          priceBeforeDiscount: r.baseRentalPrice,
          netRentalBeforeDiscount: Math.round(r.netRentalBeforeDiscount),
          discountPerBillboard: Math.round(r.discountPerBillboard),
          netRentalAfterDiscount: Math.round(r.netRentalAfterDiscount),
          priceAfterDiscount: finalPrice,
          contractPrice: r.baseRentalPrice,
          finalPrice,
          printCost: r.printCost,
          installationCost: r.installationPrice,
          includedPrintCost: r.includedPrintCost,
          includedInstallCost: r.includedInstallCost,
          totalBillboardPrice: finalPrice,
          pricingCategory,
          pricingMode,
          duration: pricingMode === 'months' ? durationMonths : durationDays,
          individualDiscountValue: individualDiscounts[r.billboardId]?.value || 0,
          individualDiscountType: individualDiscounts[r.billboardId]?.type || 'amount',
          individualDiscountAmt: r.individualDiscountAmt || 0,
          startDate: billboardCustomDates[r.billboardId]?.startDate || '',
          endDate: billboardCustomDates[r.billboardId]?.endDate || '',
          startDateReason: billboardCustomDates[r.billboardId]?.startDateReason || '',
        };
      })
      .filter(Boolean);
  }, [selected, unifiedPricingByBillboard, pricingCategory, pricingMode, durationMonths, durationDays, individualDiscounts, billboardCustomDates]);

  const lastSyncedSelectedPricesRef = React.useRef<string>('');
  useEffect(() => {
    if (!contractNumber || !currentContract || loading || selectedBillboardPricingSnapshot.length === 0) return;

    const timer = setTimeout(async () => {
      try {
        let stored: any[] = [];
        try {
          const raw = currentContract?.billboard_prices;
          stored = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
          if (!Array.isArray(stored)) stored = [];
        } catch { stored = []; }

        const storedMap = new Map<string, any>();
        stored.forEach((item: any) => {
          const id = String(item.billboardId ?? item.billboard_id ?? item.ID ?? item.id ?? '');
          if (id) storedMap.set(id, item);
        });

        const hasDrift = selectedBillboardPricingSnapshot.some((item: any) => {
          const storedItem = storedMap.get(String(item.billboardId));
          if (!storedItem) return true;
          const storedFinal = Number(storedItem.finalPrice ?? storedItem.priceAfterDiscount ?? storedItem.totalBillboardPrice ?? 0);
          return Math.abs(storedFinal - Number(item.finalPrice || 0)) > 1;
        }) || stored.length !== selectedBillboardPricingSnapshot.length;

        if (!hasDrift) return;
        const json = JSON.stringify(selectedBillboardPricingSnapshot);
        if (lastSyncedSelectedPricesRef.current === json) return;

        const { error } = await supabase
          .from('Contract')
          .update({ billboard_prices: json } as any)
          .eq('Contract_Number', Number(contractNumber));
        if (error) throw error;

        lastSyncedSelectedPricesRef.current = json;
        setCurrentContract((prev: any) => prev ? { ...prev, billboard_prices: json } : prev);
      } catch (e) {
        console.warn('Auto-resync selected billboard_prices failed:', e);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [contractNumber, currentContract, loading, selectedBillboardPricingSnapshot]);

  // Re-call hook with merged details + unified pricing so consumedSum reflects
  // each paused billboard's share of the contract discount.
  const { totals: pausedTotals } = usePausedBillboardsPricing(
    contractNumber ? Number(contractNumber) : null,
    startDate,
    endDate,
    {
      calculateBillboardPrice,
      printCostDetails: mergedPrintCostDetails,
      installationDetails: mergedInstallationDetails,
      printCostEnabled,
      includePrintInPrice,
      installationEnabled,
      includeInstallationInPrice,
      singleFaceBillboards,
      pricingByBillboard: unifiedPricingByBillboard,
    },
  );

  const customerRentalAfterPauseAndDiscount = useMemo(() => {
    // ✅ إجمالي العميل يجب أن يطابق التسلسل الظاهر في الملخص:
    // (أساس اللوحات المختارة + أساس اللوحات الموقوفة) − خصم الإيقاف الخام − الخصم العام.
    // بهذه الصيغة يتم احتساب "المضاف للعقد" تلقائياً داخل الإجمالي النهائي.
    const rawRefund = Number(pausedTotals?.refundSum || 0);
    const pausedBaseRentalSum = Number(pausedTotals?.baseRentalSum || 0);
    const combinedCustomerBase = baseTotal + pausedBaseRentalSum;

    return Math.max(0, combinedCustomerBase - rawRefund - discountAmount);
  }, [baseTotal, pausedTotals, discountAmount]);


  const finalTotal = useMemo(() => {
    // Customer total must match the visible sequence:
    // full price − pause discount − general discount + extra service costs.
    return Math.max(
      0,
      customerRentalAfterPauseAndDiscount + extraInstallationChargedToCustomer + extraPrintChargedToCustomer
    );
  }, [customerRentalAfterPauseAndDiscount, extraInstallationChargedToCustomer, extraPrintChargedToCustomer]);

  const rentalCostOnly = useMemo(() => {
    // includedInstallationCost / includedPrintCost already include paused billboards
    // via combinedServiceTotals — do NOT subtract pausedTotals.includedInstallSum/includedPrintSum again.
    // ✅ طرح تكاليف الشركات الصديقة كان يسبب خللاً في عمود سعر الإيجار (Total Rent)
    // حيث أن سعر إيجار العقد للزبون يجب أن يشمل لوحات الصديق، ويتم طرحها ديناميكياً عند احتساب وعاء رسوم التشغيل للشركة فقط.
    return customerRentalAfterPauseAndDiscount - includedInstallationCost - includedPrintCost;
  }, [customerRentalAfterPauseAndDiscount, includedInstallationCost, includedPrintCost]);

  // ✅ NEW: Handle proportional distribution of new total across billboards
  const handleProportionalDistribution = React.useCallback((newTotal: number) => {
    if (estimatedTotal <= 0 || newTotal <= 0) {
      toast.error('لا يمكن التوزيع - الإجمالي الحالي أو الجديد غير صالح');
      return;
    }
    
    const ratio = newTotal / estimatedTotal;
    const selectedBillboardsData = billboards.filter(b => selected.includes(String((b as any).ID)));
    
    const newOverrides: Record<string, number> = {};
    
    selectedBillboardsData.forEach(billboard => {
      const billboardId = String((billboard as any).ID);
      const currentPrice = calculateBillboardPrice(billboard);
      const newPrice = Math.round(currentPrice * ratio);
      newOverrides[billboardId] = newPrice;
    });
    
    setBillboardPriceOverrides(newOverrides);
    
    // Update the rent cost to reflect the new total
    setRentCost(newTotal);
    setUserEditedRentCost(true);
    
    const changePercent = ((ratio - 1) * 100).toFixed(1);
    toast.success(`تم توزيع ${newTotal.toLocaleString('ar-LY')} بنسبة ${changePercent}% على ${selectedBillboardsData.length} لوحة`);
  }, [estimatedTotal, billboards, selected, calculateBillboardPrice]);

  // ✅ NEW: Calculate rental cost for regular (non-partnership) billboards only
  const regularBillboardsRentalCost = useMemo(() => {
    const regularBillboards = billboards.filter(b => 
      selected.includes(String((b as any).ID)) && !(b as any).is_partnership
    );
    
    if (regularBillboards.length === 0) return 0;
    
    const regularTotal = regularBillboards.reduce((sum, b) => sum + calculateBillboardPrice(b), 0);
    const regularPercentage = estimatedTotal > 0 ? regularTotal / estimatedTotal : 0;
    const regularDiscount = discountAmount * regularPercentage;
    
    return Math.max(0, regularTotal - regularDiscount);
  }, [billboards, selected, estimatedTotal, discountAmount]);

  // ✅ NEW: Calculate rental cost for partnership billboards only
  const partnershipBillboardsRentalCost = useMemo(() => {
    const partnershipBillboards = billboards.filter(b => 
      selected.includes(String((b as any).ID)) && (b as any).is_partnership
    );
    
    if (partnershipBillboards.length === 0) return 0;
    
    const partnershipTotal = partnershipBillboards.reduce((sum, b) => sum + calculateBillboardPrice(b), 0);
    const partnershipPercentage = estimatedTotal > 0 ? partnershipTotal / estimatedTotal : 0;
    const partnershipDiscount = discountAmount * partnershipPercentage;
    
    return Math.max(0, partnershipTotal - partnershipDiscount);
  }, [billboards, selected, estimatedTotal, discountAmount]);

  // ✅ CORRECTED: Calculate operating fee with separate rates for installation and print
  useEffect(() => {
    let fee = Math.round(netRentalForCompany * (operatingFeeRate / 100) * 100) / 100;
    
    // إذا كانت النسبة شاملة التركيب - بنسبة مستقلة
    if (includeOperatingInInstallation && installationEnabled) {
      fee += Math.round(installationCostCombined * (operatingFeeRateInstallation / 100) * 100) / 100;
    }
    
    // إذا كانت النسبة شاملة الطباعة - بنسبة مستقلة
    if (includeOperatingInPrint && printCostEnabled) {
      fee += Math.round(printCostTotalCombined * (operatingFeeRatePrint / 100) * 100) / 100;
    }
    
    setOperatingFee(fee);
  }, [netRentalForCompany, operatingFeeRate, includeOperatingInInstallation, includeOperatingInPrint, installationCostCombined, printCostTotalCombined, installationEnabled, printCostEnabled, operatingFeeRateInstallation, operatingFeeRatePrint]);
  
  // ✅ NEW: Calculate partnership operating fee
  const partnershipOperatingFee = useMemo(() => {
    return Math.round(partnershipBillboardsRentalCost * (partnershipOperatingFeeRate / 100) * 100) / 100;
  }, [partnershipBillboardsRentalCost, partnershipOperatingFeeRate]);

  // ✅ FIXED: Only auto-distribute if installments were NOT loaded from DB
  useEffect(() => {
    // Skip if installments were already loaded from DB or if finalTotal is 0
    if (installmentsLoaded || finalTotal <= 0) return;
    
    // Only create default installments if none exist
    if (installments.length === 0) {
      const cleanAmount = roundToCleanValue(finalTotal / 2);
      const firstAmount = Math.round((finalTotal - cleanAmount) * 100) / 100;
      
      let finalFirst = firstAmount;
      let finalSecond = cleanAmount;
      
      if (roundToCleanValue(firstAmount) !== firstAmount) {
        let cleanFirst = roundToCleanValue(firstAmount);
        const payment2 = Math.round((finalTotal - cleanFirst) * 100) / 100;
        
        if (cleanFirst < payment2) {
          let step = 500;
          if (cleanFirst < 100) step = 1;
          else if (cleanFirst < 1000) step = 10;
          else if (cleanFirst < 10000) step = 100;
          
          cleanFirst += step;
        }
        finalFirst = cleanFirst;
        finalSecond = Math.round((finalTotal - cleanFirst) * 100) / 100;
      }
      
      setInstallments([
        { 
          amount: finalFirst, 
          paymentType: 'عند التوقيع', 
          description: 'الدفعة الأولى',
          dueDate: calculateDueDate('عند التوقيع', 0)
        },
        { 
          amount: finalSecond, 
          paymentType: 'بعد 20% من العقد', 
          description: 'الدفعة الثانية',
          dueDate: calculateDueDate('بعد 20% من العقد', 1)
        },
      ]);
    }
  }, [finalTotal, installmentsLoaded]);

  // ✅ REBUILT: Helper function to check if contract is expired (same as Billboards page)
  const isContractExpired = (endDate: any): boolean => {
    if (!endDate) return false;
    try {
      const end = new Date(endDate);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      return end < now;
    } catch {
      return false;
    }
  };

  // ✅ REBUILT: Get contract number from billboard (same as Billboards page)
  const getCurrentContractNumber = (billboard: any): string => {
    const contractNum = billboard.Contract_Number || 
                       billboard.contractNumber || 
                       billboard.contract_number ||
                       billboard.contract_id ||
                       (billboard.contracts && billboard.contracts[0]?.Contract_Number) ||
                       (billboard.contracts && billboard.contracts[0]?.contract_number) ||
                       (billboard.contracts && billboard.contracts[0]?.id) ||
                       '';
    return String(contractNum).trim();
  };

  // ✅ ENHANCED: Universal Smart Arabic Search with code, adType, customer, landmark, size & level support
  const enhancedSearchBillboards = (billboardsList: any[], query: string) => {
    if (!query || !query.trim()) return billboardsList;

    return billboardsList.filter((billboard: any) => {
      const contractNo = getCurrentContractNumber(billboard);
      const bId = String(billboard.ID || billboard.id || '');
      const code = billboard.code || billboard.Code || `TR-${bId.padStart(4, '0')}`;

      return smartArabicMatch(
        [
          code,
          billboard.Code,
          billboard.name,
          billboard.Billboard_Name,
          billboard.location,
          billboard.Nearest_Landmark,
          billboard.municipality,
          billboard.Municipality,
          billboard.city,
          billboard.City,
          billboard.District,
          billboard.district,
          billboard.Customer_Name,
          billboard.clientName,
          billboard.customer_name,
          billboard.contracts?.[0]?.['Customer Name'],
          billboard.contracts?.[0]?.customer_name,
          billboard.Size,
          billboard.size,
          billboard.Level,
          billboard.level,
          billboard.Ad_Type,
          billboard.adType,
          billboard.ad_type,
          billboard.contracts?.[0]?.['Ad Type'],
          billboard.contracts?.[0]?.ad_type,
          contractNo,
          billboard.Contract_Number,
          billboard.contractNumber,
          bId
        ],
        query
      );
    });
  };

  // ✅ REBUILT: Enhanced filtering with proper availability logic (same as Billboards page)
  const filtered = useMemo(() => {
    
    // First apply search
    const searched = enhancedSearchBillboards(billboards, searchQuery);
    
    const filtered = searched.filter((billboard) => {
      const statusValue = String((billboard.Status ?? billboard.status ?? '')).trim();
      const statusLower = statusValue.toLowerCase();
      const maintenanceStatus = String(billboard.maintenance_status ?? '').trim();
      
      // ✅ Exclude removed billboards (same as Billboards page)
      const isRemoved = statusValue === 'إزالة' || 
                       statusLower === 'ازالة' || 
                       maintenanceStatus === 'تحتاج ازالة لغرض التطوير' || 
                       maintenanceStatus === 'لم يتم التركيب';
      
      if (isRemoved) {
        return false;
      }
      
      // Check contract status
      const contractNum = getCurrentContractNumber(billboard);
      const hasContract = !!(contractNum && contractNum !== '0');
      const endDate = billboard.Rent_End_Date ?? (billboard as any).rent_end_date ?? null;
      const contractExpired = isContractExpired(endDate);

      // ✅ Availability must respect contract dates AND active contracts cross-check
      const billboardId = Number((billboard as any).ID ?? (billboard as any).id);
      const isOccupiedByActiveContract = occupiedBillboardIds.has(billboardId);
      const isAvailable = isBillboardAvailable(billboard, true) && !isOccupiedByActiveContract;
      const isBooked = (hasContract && !contractExpired) || isOccupiedByActiveContract;

      const isHidden = (billboard as any).is_visible_in_available === false;
      
      // Check if near expiry (within 30 days) - use contract end date from active contracts if billboard's own date is missing
      const effectiveEndDate = endDate || (isOccupiedByActiveContract ? occupiedBillboardIds.get(billboardId) : null) || null;
      const daysUntilExpiry = getDaysUntilExpiry(effectiveEndDate);
      const isNearExpiry = typeof daysUntilExpiry === 'number' && daysUntilExpiry > 0 && daysUntilExpiry <= 30;

      // Apply filters
      const municipality = String(billboard.Municipality || billboard.municipality || '');
      const city = String(billboard.City || billboard.city || '');
      const size = String(billboard.Size || billboard.size || '');

      const matchesMunicipality = municipalityFilter === 'all' || municipality === municipalityFilter;
      const matchesCity = cityFilter === 'all' || city === cityFilter;
      const matchesSize = sizeFilters.length > 0 ? sizeFilters.includes(size) : (sizeFilter === 'all' || size === sizeFilter);
      
      // ✅ حساب التوفر بشكل مستقل عن is_visible_in_available للوحات المخفية
      const billboardStatus = String((billboard as any).Status || '').toLowerCase();
      const isNotRemoved = billboardStatus !== 'إزالة' && billboardStatus !== 'removed';
      const isAvailableForContract = (!hasContract || contractExpired) && !isOccupiedByActiveContract && isNotRemoved;
      const isUnrentedHidden = isHidden && isAvailableForContract;
      const isUnderMaintenance = 
        statusValue === 'صيانة' || 
        statusLower === 'maintenance' || 
        maintenanceStatus === 'maintenance' || 
        maintenanceStatus === 'repair_needed' || 
        maintenanceStatus === 'out_of_service' || 
        maintenanceStatus === 'قيد الصيانة' || 
        maintenanceStatus === 'متضررة اللوحة';

      // Check if billboard is in current contract selection
      const isInContract = selected.includes(String((billboard as any).ID ?? (billboard as any).id));

      const hasSearch = searchQuery.trim().length > 0;

      // Status filter logic
      let matchesStatus = false;
      if (hasSearch) {
        matchesStatus = true; // Search overrides status tabs to find any matching billboard!
      } else if (statusFilter === 'all') {
        matchesStatus = true; // "الكل" matches all billboards
      } else if (statusFilter === 'available') {
        matchesStatus = (isAvailable || isInContract) && !isHidden && !isUnderMaintenance;
      } else if (statusFilter === 'nearExpiry') {
        matchesStatus = isNearExpiry;
      } else if (statusFilter === 'rented') {
        matchesStatus = isBooked;
      } else if (statusFilter === 'maintenance') {
        matchesStatus = isUnderMaintenance;
      } else if (statusFilter === 'hidden') {
        matchesStatus = isHidden;
      }

      // Always keep selected billboards visible
      if (isInContract) matchesStatus = true;
      
      return matchesMunicipality && matchesCity && matchesSize && matchesStatus;
    });
    
    // ✅ Strict Multi-Level Sorting: 1. Size Area (4x12 > 4x10 > 3x8 > 3x6 > 3x4), 2. Level (A > B > C > D), 3. Municipality, 4. ID
    return sortBillboardsStandardSync(filtered, dbSizesData, dbMunisData);
  }, [billboards, searchQuery, cityFilter, sizeFilter, sizeFilters, statusFilter, municipalityFilter, selected, dbSizesData, dbMunisData]);

  // Event handlers
  const toggleSelect = async (b: Billboard) => {
    const id = String((b as any).ID);
    const isSelected = selected.includes(id);

    if (!isSelected) {
      const statusValue = String((b as any).Status || '').trim().toLowerCase();
      const maintStatus = String((b as any).maintenance_status || '').trim().toLowerCase();
      const isUnderMaint = 
        statusValue === 'صيانة' || 
        statusValue === 'maintenance' || 
        maintStatus === 'maintenance' || 
        maintStatus === 'repair_needed' || 
        maintStatus === 'out_of_service' || 
        maintStatus === 'قيد الصيانة' || 
        maintStatus === 'متضررة اللوحة';

      if (isUnderMaint) {
        setPendingMaintenanceBillboard(b);
        setMaintenanceConfirmOpen(true);
        return;
      }

      // ─── كشف التعارض مع العقود النشطة ───
      const startDate = (currentContract?.['Contract Date'] || currentContract?.start_date || '').slice(0, 10);
      const endDate = (currentContract?.['End Date'] || currentContract?.end_date || '').slice(0, 10);

      if (startDate && endDate) {
        const namesMap: Record<string, string> = {
          [id]: (b as any).Billboard_Name || (b as any).name || id,
        };
        const conflicts = await checkBillboardConflicts(
          [id],
          startDate,
          endDate,
          contractNumber, // استثناء العقد الحالي
          namesMap
        );

        if (conflicts.length > 0) {
          setPendingConflictBillboard(b);
          setConflictList(conflicts);
          setConflictDialogOpen(true);
          return;
        }
      }
    }

    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleConfirmMaintenanceSelect = () => {
    if (pendingMaintenanceBillboard) {
      const id = String((pendingMaintenanceBillboard as any).ID);
      setSelected((prev) => [...prev, id]);
      setPendingMaintenanceBillboard(null);
    }
    setMaintenanceConfirmOpen(false);
  };

  const removeSelected = async (id: string) => {
    if (!contractNumber) {
      setSelected((prev) => prev.filter((x) => x !== id));
      return;
    }
    try {
      const links = await checkLinkedTasks(Number(contractNumber), [Number(id)]);
      const hasActiveTasks = links.some(link => 
        link.linkedTasks.some(task => 
          task.status !== 'completed' && task.itemStatus !== 'completed'
        )
      );

      if (links.length > 0 && hasActiveTasks) {
        setSmartBillboardLinks(links);
        setPendingRemovalIds([id]);
        setPendingSaveCallback(() => async (types: TaskTypeSelection) => {
          const result = await removeBillboardFromAllTasks(Number(contractNumber), Number(id), types);
          await removeBillboardFromContract(contractNumber, id);
          setSelected((prev) => prev.filter((x) => x !== id));
          if (result.replacedItemId) {
            toast.success('اللوحة المركبة تم تعليمها كمستبدلة - أضف لوحة بديلة بنفس المقاس');
          } else {
            toast.success('تم حذف اللوحة من المهام المحددة');
          }
        });
        setSmartConfirmOpen(true);
      } else {
        if (links.length > 0) {
          await removeBillboardFromAllTasks(Number(contractNumber), Number(id), {
            installation: false,
            print: false,
            cutout: false,
            removal: false,
          });
        }
        await removeBillboardFromContract(contractNumber, id);
        setSelected((prev) => prev.filter((x) => x !== id));
      }
    } catch {
      setSelected((prev) => prev.filter((x) => x !== id));
    }
  };

  // ✅ Bulk remove multiple billboards at once
  const removeMultipleSelected = async (ids: string[]) => {
    if (!contractNumber || ids.length === 0) {
      setSelected((prev) => prev.filter((x) => !ids.includes(x)));
      return;
    }
    try {
      const allBillboardIds = ids.map(id => Number(id));
      const links = await checkLinkedTasks(Number(contractNumber), allBillboardIds);
      const hasActiveTasks = links.some(link => 
        link.linkedTasks.some(task => 
          task.status !== 'completed' && task.itemStatus !== 'completed'
        )
      );

      if (links.length > 0 && hasActiveTasks) {
        setSmartBillboardLinks(links);
        setPendingRemovalIds(ids);
        setPendingSaveCallback(() => async (types: any) => {
          for (const id of ids) {
            await removeBillboardFromAllTasks(Number(contractNumber), Number(id), types);
            await removeBillboardFromContract(contractNumber, id);
          }
          setSelected((prev) => prev.filter((x) => !ids.includes(x)));
          toast.success(`تم حذف ${ids.length} لوحة من العقد والمهام`);
        });
        setSmartConfirmOpen(true);
      } else {
        for (const id of ids) {
          if (links.length > 0) {
            await removeBillboardFromAllTasks(Number(contractNumber), Number(id), {
              installation: false,
              print: false,
              cutout: false,
              removal: false,
            });
          }
          await removeBillboardFromContract(contractNumber, id);
        }
        setSelected((prev) => prev.filter((x) => !ids.includes(x)));
        toast.success(`تم حذف ${ids.length} لوحة من العقد`);
      }
    } catch {
      setSelected((prev) => prev.filter((x) => !ids.includes(x)));
    }
  };

  const handleAddCustomer = async (name: string) => {
    if (!name) return;
    try {
      const { data: newC, error } = await supabase
        .from('customers')
        .insert({ 
          name,
          is_customer: true,
          is_supplier: false
        })
        .select()
        .single();
      if (!error && newC) {
        setCustomerId(newC.id);
        setCustomerName(name);
        setCustomers((prev) => [{ id: newC.id, name }, ...prev]);
        toast.success('تم إضافة العميل بنجاح');
      } else {
        console.error('Error adding customer:', error);
        toast.error('فشل في إضافة العميل');
      }
    } catch (e) {
      console.warn(e);
      toast.error('حدث خطأ أثناء إضافة العميل');
    }
    setCustomerOpen(false);
    setCustomerQuery('');
  };

  const handleSelectCustomer = async (customer: { id: string; name: string }) => {
    setCustomerName(customer.name);
    setCustomerId(customer.id);
    setCustomerOpen(false);
    setCustomerQuery('');

    if (customer.id) {
      try {
        let pricingCategory = null;

        // 1. Try to fetch directly from customer record
        const { data: custData } = await supabase
          .from('customers')
          .select('pricing_category')
          .eq('id', customer.id)
          .maybeSingle();
        if (custData && custData.pricing_category) {
          pricingCategory = custData.pricing_category;
        }

        // 2. Fallback to last contract category
        if (!pricingCategory) {
          const { data, error } = await supabase
            .from('Contract')
            .select('customer_category')
            .eq('customer_id', customer.id)
            .order('id', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (!error && data && data.customer_category) {
            pricingCategory = data.customer_category;
          }
        }

        if (pricingCategory) {
          if (pricingCategories && pricingCategories.includes(pricingCategory)) {
            setPricingCategory(pricingCategory);
            toast.info(`تم تطبيق الفئة السعرية للزبون تلقائياً: ${pricingCategory}`);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch customer pricing category:', err);
      }
    }
  };

  // تقريب للأسفل لأقرب رقم مغلق (مستخدم في distributeWithInterval حيث الدفعة الأولى أكبر)
  const roundToCleanValue = (value: number): number => {
    if (value <= 0) return 0;
    if (value < 100) return Math.floor(value);
    if (value < 1000) return Math.floor(value / 10) * 10;
    if (value < 10000) return Math.floor(value / 100) * 100;
    return Math.floor(value / 500) * 500;
  };

  // تقريب للأعلى لأقرب رقم مغلق (لالتوزيع بالفترات والنماذج)
  const roundUpToCleanValue = (value: number): number => {
    if (value <= 0) return 0;
    if (value < 100) return Math.ceil(value);
    if (value < 1000) return Math.ceil(value / 10) * 10;
    if (value < 10000) return Math.ceil(value / 100) * 100;
    return Math.ceil(value / 500) * 500;
  };

  const distributeEvenly = (count: number) => {
    count = Math.max(1, Math.min(12, Math.floor(count)));
    
    let list;
    if (count === 1) {
      list = [{
        amount: finalTotal,
        paymentType: 'عند التوقيع',
        description: 'دفعة كامل قيمة العقد',
        dueDate: calculateDueDate('عند التوقيع', 0)
      }];
    } else {
      // ✅ خوارزمية ذكية: تقريب للأعلى وترحيل الفرق للدفعة التالية
      let remainingTotal = finalTotal;
      list = Array.from({ length: count }).map((_, i) => {
        const isLast = i === count - 1;
        let amount: number;

        if (isLast) {
          amount = Math.round(remainingTotal * 100) / 100;
        } else {
          const periodsLeft = count - i;
          const exactShare = remainingTotal / periodsLeft;
          amount = roundUpToCleanValue(exactShare);
          remainingTotal -= amount;
        }

        return {
          amount,
          paymentType: i === 0 ? 'عند التوقيع' : (i === 1 ? 'عند التركيب' : 'شهري'),
          description: `الدفعة ${i + 1}`,
          dueDate: calculateDueDate(i === 0 ? 'عند التوقيع' : (i === 1 ? 'عند التركيب' : 'شهري'), i)
        };
      });
    }
    
    setInstallments(list);
 setInstallmentsLoaded(false); // Allow future redistribution
    toast.success(`تم توزيع المبلغ على ${count} أقساط مغلقة بنجاح`);
  };

  const addInstallment = () => {
    const newInstallment = {
      amount: 0,
      paymentType: 'شهري',
      description: `الدفعة ${installments.length + 1}`,
      dueDate: calculateDueDate('شهري', installments.length)
    };
    setInstallments([...installments, newInstallment]);
  };

  const removeInstallment = (index: number) => {
    setInstallments(installments.filter((_, i) => i !== index));
  };

  const updateInstallment = (index: number, field: string, value: any) => {
    setInstallments(prev => prev.map((inst, i) => {
      if (i === index) {
        const updated = { ...inst, [field]: value };
        if (field === 'paymentType') {
          updated.dueDate = calculateDueDate(value, i);
        }
        return updated;
      }
      return inst;
    }));
  };

  const clearAllInstallments = () => {
    setInstallments([]);
 setInstallmentsLoaded(false); // Allow auto-distribution after clearing
  };

  const distributeByDurationPeriods = React.useCallback((count: number) => {
    if (finalTotal <= 0) {
      toast.info('لا يمكن توزيع الدفعات بدون إجمالي صحيح');
      return;
    }
    if (!startDate || !endDate) {
      toast.info('يرجى تحديد تاريخ بداية ونهاية العقد أولاً');
      return;
    }

    count = Math.max(2, Math.min(12, Math.floor(count)));
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDuration = end.getTime() - start.getTime();
    
    if (totalDuration <= 0) {
      toast.info('تاريخ نهاية العقد يجب أن يكون بعد تاريخ البداية');
      return;
    }

    const intervalDuration = totalDuration / count;
    // ✅ خوارزمية ذكية: كل دفعة تُقرّب للأسفل لأقرب رقم مغلق،
    // والفرق ينتقل للدفعة التالية، والدفعة الأخيرة تستوعب المتبقي.
    let remainingTotal = finalTotal;
    const newInstallments = Array.from({ length: count }).map((_, i) => {
      const offset = i * intervalDuration;
      const targetDate = new Date(start.getTime() + offset);
      const dueDateStr = targetDate.toISOString().split('T')[0];

      const isLast = i === count - 1;
      let amount: number;

      if (isLast) {
        // الدفعة الأخيرة تأخذ المتبقي بالضبط
        amount = Math.round(remainingTotal * 100) / 100;
      } else {
        // حساب حصة هذه الفترة من المتبقي، ثم تقريب للأعلى لأقرب رقم مغلق
        const periodsLeft = count - i;
        const exactShare = remainingTotal / periodsLeft;
        amount = roundUpToCleanValue(exactShare);
        remainingTotal -= amount;
      }

      let percentageLabel = '';
      if (i === 0) {
        percentageLabel = 'عند التوقيع';
      } else {
        const percentPassed = Math.round((i / count) * 100);
        percentageLabel = `بعد مرور ${percentPassed}% من العقد`;
      }

      return {
        amount,
        paymentType: percentageLabel,
        description: `الدفعة ${i + 1} (${(100 / count).toFixed(2)}%)`,
        dueDate: dueDateStr
      };
    });

    setInstallments(newInstallments);
    setInstallmentsLoaded(false);
    toast.success(`تم توزيع الدفعات على ${count} فترات متساوية بأرقام مغلقة`);
  }, [finalTotal, startDate, endDate]);

  // ✅ NEW: Create manual/uneven installments
  const createManualInstallments = (count: number) => {
    if (finalTotal <= 0) {
      toast.info('لا يمكن توزيع الدفعات بدون إجمالي صحيح');
      return;
    }
    
    count = Math.max(1, Math.min(12, Math.floor(count)));
    
    // إنشاء دفعات فارغة ليقوم المستخدم بملئها يدوياً
    const newInstallments = Array.from({ length: count }).map((_, i) => ({
      amount: 0,
      paymentType: i === 0 ? 'عند التوقيع' : (i === 1 ? 'عند التركيب' : 'شهري'),
      description: i === 0 ? 'دفعة أولى عند التوقيع' : (i === 1 ? 'دفعة ثانية عند التركيب' : `الدفعة ${i + 1}`),
      dueDate: calculateDueDate(i === 0 ? 'عند التوقيع' : (i === 1 ? 'عند التركيب' : 'شهري'), i)
    }));
    
    setInstallments(newInstallments);
 setInstallmentsLoaded(false); // Allow future redistribution
    toast.info(`تم إنشاء ${count} دفعات فارغة - يرجى إدخال المبالغ يدوياً`);
  };

  // ✅ UPDATED: Smart distribution with config object - Fixed for zero first payment
  const distributeWithInterval = React.useCallback((config: {
    firstPayment: number;
    firstPaymentType: 'amount' | 'percent';
    interval: 'month' | '2months' | '3months' | '4months' | '5months' | '6months' | '7months';
    numPayments?: number;
    lastPaymentDate?: string;
    firstPaymentDate?: string;
    firstAtSigning?: boolean;
  }) => {
    const { firstPayment, firstPaymentType, interval, numPayments, lastPaymentDate, firstPaymentDate, firstAtSigning = true } = config;
    
    if (finalTotal <= 0) {
      toast.info('لا يمكن توزيع الدفعات بدون إجمالي صحيح');
      return;
    }

    let actualFirstPayment = firstPayment;
    if (firstPaymentType === 'percent') {
      actualFirstPayment = Math.round((finalTotal * Math.min(100, Math.max(0, firstPayment)) / 100) * 100) / 100;
    }

    if (actualFirstPayment > finalTotal) {
      toast.info('الدفعة الأولى أكبر من الإجمالي');
      return;
    }

    if (actualFirstPayment < 0) {
      toast.info('قيمة الدفعة الأولى لا يمكن أن تكون سالبة');
      return;
    }

    const monthsMap: Record<string, number> = { month: 1, '2months': 2, '3months': 3, '4months': 4, '5months': 5, '6months': 6, '7months': 7 };
    const intervalMonths = monthsMap[interval] || 1;
    const intervalLabels: Record<string, string> = { month: 'شهري', '2months': 'شهرين', '3months': 'ثلاثة أشهر', '4months': '4 أشهر', '5months': '5 أشهر', '6months': '6 أشهر', '7months': '7 أشهر' };
    const intervalLabel = intervalLabels[interval] || 'شهري';
    
    const newInstallments: Array<{amount: number; paymentType: string; description: string; dueDate: string}> = [];
    const firstDate = firstPaymentDate || startDate || new Date().toISOString().split('T')[0];
    
    // ✅ FIX: إذا كانت الدفعة الأولى صفر، نبدأ مباشرة بالدفعات المتكررة
    const hasFirstPayment = actualFirstPayment > 0;
    const remaining = finalTotal - actualFirstPayment;

    let numberOfRecurringPayments: number;
    if (numPayments && numPayments > 0) {
      numberOfRecurringPayments = Math.min(12, Math.max(1, numPayments));
    } else if (lastPaymentDate) {
      const start = new Date(firstDate);
      const end = new Date(lastPaymentDate);
      const monthsDiff = Math.max(1, Math.round((end.getTime() - start.getTime()) / (30 * 24 * 60 * 60 * 1000)));
      numberOfRecurringPayments = Math.max(1, Math.floor(monthsDiff / intervalMonths));
    } else {
      numberOfRecurringPayments = Math.max(1, Math.floor(6 / intervalMonths));
    }

    // حساب قيمة الدفعة الأولى والدفعات المتكررة مغلقة ونظيفة
    let finalFirstPayment = actualFirstPayment;
    let cleanRecurringAmount = Math.round((remaining / numberOfRecurringPayments) * 100) / 100;
    let firstRecurringAmount = cleanRecurringAmount;

    if (hasFirstPayment) {
      const cleanRec = roundToCleanValue(remaining / numberOfRecurringPayments);
      const adjFirst = Math.round((finalTotal - cleanRec * numberOfRecurringPayments) * 100) / 100;
      if (adjFirst >= 0) {
        let finalFirst = adjFirst;
        
        if (roundToCleanValue(adjFirst) !== adjFirst) {
          let cleanFirst = roundToCleanValue(adjFirst);
          const lastPayment = Math.round((finalTotal - cleanFirst - cleanRec * (numberOfRecurringPayments - 1)) * 100) / 100;
          
          if (cleanFirst < lastPayment) {
            let step = 500;
            if (cleanFirst < 100) step = 1;
            else if (cleanFirst < 1000) step = 10;
            else if (cleanFirst < 10000) step = 100;
            
            cleanFirst += step;
          }
          finalFirst = cleanFirst;
        }
        
        finalFirstPayment = finalFirst;
        cleanRecurringAmount = cleanRec;
      }
    } else {
      const cleanRec = roundToCleanValue(finalTotal / numberOfRecurringPayments);
      const firstRec = Math.round((finalTotal - cleanRec * (numberOfRecurringPayments - 1)) * 100) / 100;
      
      let finalFirst = firstRec;
      
      if (roundToCleanValue(firstRec) !== firstRec) {
        let cleanFirst = roundToCleanValue(firstRec);
        const lastPayment = Math.round((finalTotal - cleanFirst - cleanRec * (numberOfRecurringPayments - 2)) * 100) / 100;
        
        if (cleanFirst < lastPayment) {
          let step = 500;
          if (cleanFirst < 100) step = 1;
          else if (cleanFirst < 1000) step = 10;
          else if (cleanFirst < 10000) step = 100;
          
          cleanFirst += step;
        }
        finalFirst = cleanFirst;
      }
      
      firstRecurringAmount = finalFirst;
      cleanRecurringAmount = cleanRec;
    }
    
    if (hasFirstPayment) {
      newInstallments.push({
        amount: finalFirstPayment,
        // ✅ Always keep first installment as "عند التوقيع" per business rule
        paymentType: 'عند التوقيع',
        description: 'الدفعة الأولى',
        dueDate: firstDate
      });
    }

    let runningTotal = hasFirstPayment ? finalFirstPayment : 0;
    for (let i = 0; i < numberOfRecurringPayments; i++) {
      const isLast = i === numberOfRecurringPayments - 1;
      let amount = cleanRecurringAmount;
      if (!hasFirstPayment && i === 0) {
        amount = firstRecurringAmount;
      }
      
      if (isLast) {
        amount = Math.round((finalTotal - runningTotal) * 100) / 100;
      } else {
        runningTotal += amount;
      }
      
      // ✅ FIX: بدء التواريخ من أول فترة بعد الدفعة الأولى
      const monthOffset = hasFirstPayment ? (i + 1) : (i === 0 ? 0 : i);
      const dueDate = new Date(firstDate);
      dueDate.setMonth(dueDate.getMonth() + monthOffset * intervalMonths);
      
      const installmentNumber = hasFirstPayment ? i + 2 : i + 1;
      
      // ✅ FIX: تحديد نوع الدفع بناءً على الموضع الفعلي
      const overallIndex = newInstallments.length;
      let paymentTypeForThis: string;
      let dueDateIso: string;

      if (firstAtSigning && overallIndex === 0) {
        // أول دفعة = عند التوقيع (نفس تاريخ البداية)
        paymentTypeForThis = 'عند التوقيع';
        dueDateIso = firstDate;
      } else {
        // جميع الدفعات المتبقية تستخدم الفترة المحددة والتاريخ المحسوب
        paymentTypeForThis = intervalLabel;
        dueDateIso = dueDate.toISOString().split('T')[0];
      }
      
      newInstallments.push({
        amount: Math.round(amount * 100) / 100,
        paymentType: paymentTypeForThis,
        description: `الدفعة ${installmentNumber}`,
        dueDate: dueDateIso
      });
    }

    setInstallments(newInstallments);
 setInstallmentsLoaded(false); // Allow future redistribution
    
    if (hasFirstPayment) {
      toast.success(`تم توزيع الدفعات: دفعة أولى (${finalFirstPayment.toLocaleString('ar-LY')} د.ل) + ${numberOfRecurringPayments} أقساط مغلقة (${cleanRecurringAmount.toLocaleString('ar-LY')} د.ل)`);
    } else {
      toast.success(`تم توزيع المبلغ على ${numberOfRecurringPayments} أقساط مغلقة بنجاح`);
    }
  }, [finalTotal, startDate, calculateDueDate]);

  // ✅ NEW: Get installment summary for display
  const getInstallmentSummary = () => {
    if (installments.length === 0) return null;
    if (installments.length === 1) {
      return `دفعة واحدة: ${installments[0].amount.toLocaleString('ar-LY')} د.ل بتاريخ ${installments[0].dueDate}`;
    }

    const first = installments[0];
    const recurring = installments.slice(1);
    const lastDate = installments[installments.length - 1].dueDate;

    // Check if all recurring payments are the same
    const recurringAmount = recurring[0]?.amount || 0;
    const allSame = recurring.every(r => Math.abs(r.amount - recurringAmount) < 1);

    if (allSame && recurring.length > 1) {
      const interval = recurring[0].paymentType;
      return `الدفعة الأولى: ${first.amount.toLocaleString('ar-LY')} د.ل بتاريخ ${first.dueDate}\nبعدها يتم السداد ${interval} بمقدار ${recurringAmount.toLocaleString('ar-LY')} د.ل حتى ${lastDate}`;
    }

    return `${installments.length} دفعات من ${first.dueDate} إلى ${lastDate}`;
  };

  // ✅ NEW: Handle unequal distribution
  const handleApplyUnequalDistribution = React.useCallback((payments: any[]) => {
    const newInstallments = payments.map(p => ({
      amount: p.amount,
      paymentType: p.paymentType,
      description: p.description,
      dueDate: p.dueDate
    }));
    setInstallments(newInstallments);
    toast.success(`تم تطبيق التوزيع غير المتساوي: ${payments.length} دفعات`);
  }, []);

  const validateInstallments = () => {
    if (installments.length === 0) {
      return { isValid: false, message: 'يجب إضافة دفعة واحدة على الأقل' };
    }

    const totalInstallments = installments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
    const difference = Math.abs(totalInstallments - finalTotal);
    
    if (difference > 1) {
      return { 
        isValid: false, 
        message: `مجموع الدفعات (${totalInstallments.toLocaleString()}) لا يساوي إجمالي العقد (${finalTotal.toLocaleString()})` 
      };
    }

    return { isValid: true, message: '' };
  };

  const executeSave = async (skipTaskCheck = false, taskTypes?: TaskTypeSelection) => {
    try {
      if (!contractNumber) return;
      
      const validation = validateInstallments();
      if (!validation.isValid) {
        toast.error(validation.message);
        return;
      }
      
      setSaving(true);
      
      const c = await getContractWithBillboards(contractNumber);
      const current: string[] = (c.billboards || []).map((b: any) => String(b.ID));
      const toAdd = selected.filter((id) => !current.includes(id));
      const toRemove = current.filter((id) => !selected.includes(id));

      // ✅ فحص المهام المرتبطة قبل الحذف
      if (!skipTaskCheck && toRemove.length > 0) {
        const links = await checkLinkedTasks(
          Number(contractNumber),
          toRemove.map(Number)
        );
        const hasActiveTasks = links.some(link => 
          link.linkedTasks.some(task => 
            task.status !== 'completed' && task.itemStatus !== 'completed'
          )
        );

        if (links.length > 0 && hasActiveTasks) {
          setSmartBillboardLinks(links);
          setPendingSaveCallback(() => (types: TaskTypeSelection) => executeSave(true, types));
          setSmartConfirmOpen(true);
          setSaving(false);
          return;
        }
      }

      // حذف اللوحات من العقد ومن المهام المختارة - تتبع اللوحات المستبدلة
      const replacementMap: { itemId: string; size: string }[] = [];
      for (const id of toRemove) {
        const typesToUse = skipTaskCheck && taskTypes ? taskTypes : {
          installation: false,
          print: false,
          cutout: false,
          removal: false
        };
        const result = await removeBillboardFromAllTasks(Number(contractNumber), Number(id), typesToUse);
        if (result.replacedItemId && result.replacedItemSize) {
          replacementMap.push({ itemId: result.replacedItemId, size: result.replacedItemSize });
        }
        await removeBillboardFromContract(contractNumber, id);
      }

      if (toAdd.length > 0) {
        await addBillboardsToContract(contractNumber, toAdd, {
          start_date: startDate,
          end_date: endDate,
          customer_name: customerName,
        });
      }
      
      // ✅ إضافة اللوحات الجديدة للمهام الموجودة مع ربط البدائل
      const addedToTasks: string[] = [];
      for (const id of toAdd) {
        // محاولة ربط اللوحة الجديدة بلوحة مستبدلة بنفس المقاس
        const bbData = billboards.find(b => String((b as any).ID) === id);
        const bbSize = (bbData as any)?.Size || (bbData as any)?.size;
        
        let matchedReplacementId: string | undefined;
        if (bbSize && replacementMap.length > 0) {
          const matchIndex = replacementMap.findIndex(r => r.size === bbSize);
          if (matchIndex >= 0) {
            matchedReplacementId = replacementMap[matchIndex].itemId;
            replacementMap.splice(matchIndex, 1); // استخدم مرة واحدة فقط
          }
        }

        const result = await addBillboardToExistingTasks(Number(contractNumber), Number(id), matchedReplacementId);
        addedToTasks.push(...result.added);
      }
      if (addedToTasks.length > 0) {
        const uniqueTasks = [...new Set(addedToTasks)];
        toast.success(`تمت إضافة اللوحات الجديدة إلى: ${uniqueTasks.join('، ')}`);
      }

      // ✅ NEW: Generate billboard prices data for historical reference
      const selectedBillboardsData = billboards
        .filter((b) => selected.includes(String((b as any).ID)))
        .map((b) => ({
          id: String((b as any).ID),
          name: (b as any).name || (b as any).Billboard_Name || '',
          location: (b as any).location || (b as any).Nearest_Landmark || '',
          city: (b as any).city || (b as any).City || '',
          size: (b as any).size || (b as any).Size || '',
          level: (b as any).level || (b as any).Level || '',
          price: Number((b as any).price) || 0,
          image: (b as any).image || '',
          // ✅ NEW: Store calculated price for this contract (including print cost)
          contractPrice: calculateBillboardPrice(b),
          printCost: calculatePrintCost(b),
          pricingCategory: pricingCategory,
          pricingMode: pricingMode,
          duration: pricingMode === 'months' ? durationMonths : durationDays
        }));

      // ✅ CORRECTED: Fixed calculation structure for database storage
      // ✅ Installments: احفظ نوع/وصف/تاريخ كل دفعة لضمان ظهورها في الطباعة
      const installmentsForSaving = (installments || []).map((inst, idx) => {
        // ✅ NEW: الدفعة الأولى "عند التوقيع"، الثانية "عند التركيب"
        const defaultPaymentType = idx === 0 ? 'عند التوقيع' : (idx === 1 ? 'عند التركيب' : 'شهري');
        const paymentType = String(inst?.paymentType || '').trim() || defaultPaymentType;
        return {
          amount: Number(inst?.amount ?? 0) || 0,
          paymentType,
          description: String(inst?.description || '').trim() || `الدفعة ${idx + 1}`,
          dueDate: String(inst?.dueDate || '').trim() || calculateDueDate(paymentType, idx)
        };
      });

      // ✅ Calculate the base rent from stored prices when enabled, otherwise from pricing table.
      // Newly added billboards will correctly fallback to pricing table calculation.
      const calculatedBaseRent = (() => {
        const sel = billboards.filter((b) => selected.includes(String((b as any).ID)));
        return sel.reduce((acc, b) => {
          const id = String((b as any).ID);
          if (useStoredPrices) {
            const storedPrice = getStoredPriceFromContract(id);
            if (storedPrice !== null) {
              return acc + storedPrice;
            }
          }

          const sizeId = (b as any).size_id || (b as any).Size_ID || null;
          const level = ((b as any).level || (b as any).Level) as any;
          const size = (b.size || (b as any).Size || '') as string;

          if (pricingMode === 'months') {
            const months = Math.max(0, Number(durationMonths || 0));
            let price = getPriceFromDatabase(sizeId !== null ? Number(sizeId) : null, level, pricingCategory, months, size);
            if (price === null) price = getPriceFor(size, level, pricingCategory as CustomerType, months);
            return acc + (price || 0);
          } else {
            const days = Math.max(0, Number(durationDays || 0));
            let daily = getDailyPriceFromDatabase(sizeId !== null ? Number(sizeId) : null, level, pricingCategory, size);
            if (daily === null) daily = getDailyPriceFor(size, level, pricingCategory as CustomerType);
            if (daily === null) {
              let monthly = getPriceFromDatabase(sizeId !== null ? Number(sizeId) : null, level, pricingCategory, 1, size);
              if (monthly === null) monthly = getPriceFor(size, level, pricingCategory as CustomerType, 1) || 0;
              daily = monthly ? Math.round((monthly / 30) * 100) / 100 : 0;
            }
            return acc + (daily || 0) * days;
          }
        }, 0);
      })();
      
      // ✅ Smart rounding for per-billboard final price (fixes 11,594 -> 11,600 while keeping stable values like 12,915)
      const smartRoundContractPrice = (value: number): number => {
        if (!Number.isFinite(value)) return 0;
        const roundedInt = Math.round(value);
        const nearestHundred = Math.round(roundedInt / 100) * 100;
        return Math.abs(roundedInt - nearestHundred) <= 6 ? nearestHundred : roundedInt;
      };
      
      const updates: any = {
        'Customer Name': customerName,
        'Ad Type': adType,
        'Contract Date': startDate,
        'End Date': endDate,
        Duration: pricingMode === 'months'
          ? `${durationMonths} ${durationMonths === 1 ? 'شهر' : durationMonths === 2 ? 'شهرين' : 'أشهر'}`
          : `${durationDays} يوم`,

        // ✅ Persist pricing mode/duration explicitly so editing the contract again
        //    won't have to guess from dates (which broke when use_30_day_month is off)
        pricing_mode: pricingMode,
        duration_months: pricingMode === 'months' ? durationMonths : null,
        duration_days: pricingMode === 'days' ? durationDays : null,
        use_30_day_month: use30DayMonth,


        // ✅ Total = what the customer pays (after discount + any extra service costs)
        'Total': finalTotal,

        // ✅ Total Rent = net rental for the company (after discount minus included service costs)
        'Total Rent': rentalCostOnly,
        
        // ✅ CRITICAL: Save the BASE RENT (original rental price from pricing table)
        base_rent: calculatedBaseRent,

        'Discount': discountAmount,
        customer_category: pricingCategory,
        billboards_data: JSON.stringify(selectedBillboardsData),
        billboards_count: selectedBillboardsData.length,
        billboard_ids: selected, // Pass as array, updateContract will handle conversion

        // ✅ Store billboard prices using unified pricing helper (matches UI cards exactly)
        billboard_prices: JSON.stringify(selectedBillboardPricingSnapshot),

        // ✅ Service costs
        installation_cost: installationEnabled ? applyExchangeRate(installationCostCombined) : 0,
        installation_enabled: installationEnabled,
        print_cost: applyExchangeRate(printCostTotalCombined),
        print_cost_enabled: String(printCostEnabled),
        print_price_per_meter: String(printPricePerMeter),

        // ✅ Persist "include in price" flags
        include_installation_in_price: includeInstallationInPrice,
        include_print_in_billboard_price: includePrintInPrice,

        // ✅ NEW: Persist operating fee inclusion flags
        include_operating_in_print: includeOperatingInPrint,
        include_operating_in_installation: includeOperatingInInstallation,
        operating_fee_rate_installation: operatingFeeRateInstallation,
        operating_fee_rate_print: operatingFeeRatePrint,

        // ✅ NEW: Persist level discounts
        level_discounts: Object.keys(levelDiscounts).length > 0 ? levelDiscounts : null,

        // Single face billboards
        single_face_billboards: singleFaceBillboards.size > 0 ? JSON.stringify(Array.from(singleFaceBillboards)) : null,

        // ✅ NEW: Persist friend rental includes installation
        friend_rental_includes_installation: friendRentalIncludesInstallation,

        // ✅ Currency
        contract_currency: contractCurrency,
        exchange_rate: String(exchangeRate),

        // ✅ Operating fee - إجمالي جميع رسوم التشغيل (عادية + مشاركة + صديقة)
        fee: String(operatingFee + partnershipOperatingFee + friendOperatingFeeAmount),
        operating_fee_rate: operatingFeeRate,
        partnership_operating_fee_rate: partnershipOperatingFeeRate,
        friend_rental_operating_fee_rate: friendRentalOperatingFeeRate,
        friend_rental_operating_fee_enabled: friendRentalOperatingFeeEnabled,

        // ✅ Partnership operating details
        partnership_operating_data: billboards
          .filter(b => selected.includes(String((b as any).ID)) && (b as any).is_partnership)
          .map(b => {
            const billboardId = String((b as any).ID);
            const billboardPrice = calculateBillboardPrice(b);
            const billboardPricePercentage = estimatedTotal > 0 ? billboardPrice / estimatedTotal : 0;
            const discountPerBillboard = discountAmount * billboardPricePercentage;
            const priceAfterDiscount = Math.max(0, billboardPrice - discountPerBillboard);
            const operatingFeeAmount = priceAfterDiscount * (partnershipOperatingFeeRate / 100);

            return {
              billboard_id: Number(billboardId),
              billboard_name: (b as any).Billboard_Name || (b as any).name || '',
              price_after_discount: priceAfterDiscount,
              operating_fee_rate: partnershipOperatingFeeRate,
              operating_fee_amount: operatingFeeAmount
            };
          }),

        // ✅ Designs
        design_data: JSON.stringify(billboardDesigns),

        // ✅ Installments + distribution settings
        installments_data: installmentsForSaving,
        installment_distribution_type: installmentDistributionType,
        installment_first_payment_amount: hasDifferentFirstPayment ? installmentFirstPaymentAmount : 0,
        installment_first_payment_type: installmentFirstPaymentType,
        installment_interval: installmentInterval,
        installment_count: installmentCount,
        installment_auto_calculate: installmentAutoCalculate,
        installment_first_at_signing: installmentFirstAtSigning,
      };

      // ✅ Save ONLY valid friend rentals (filter out billboards no longer friendly or removed from contract)
      updates.friend_rental_data = validFriendCosts.length > 0 ? validFriendCosts : null;

      // ✅ Save friend rental operating fee settings
      (updates as any).friend_rental_operating_fee_enabled = friendRentalOperatingFeeEnabled;
      (updates as any).friend_rental_operating_fee_rate = friendRentalOperatingFeeRate;

      // Also save individual payments for backward compatibility
      if (installmentsForSaving.length > 0) updates['Payment 1'] = { amount: installmentsForSaving[0]?.amount || 0, type: installmentsForSaving[0]?.paymentType || 'عند التوقيع' };
      if (installmentsForSaving.length > 1) updates['Payment 2'] = String(installmentsForSaving[1]?.amount || 0);
      if (installmentsForSaving.length > 2) updates['Payment 3'] = String(installmentsForSaving[2]?.amount || 0);

      // ✅ Remaining should match what the customer pays
      const totalPaid = Number(currentContract?.['Total Paid']) || 0;
      updates['Total Paid'] = String(totalPaid);
      updates['Remaining'] = String(Math.max(0, finalTotal - totalPaid));
      if (customerId) updates.customer_id = customerId;

      await updateContract(contractNumber, updates);

      // ✅ NEW: Update capital_remaining for partnership billboards
      const partnershipBillboards = billboards.filter(b => 
        selected.includes(String((b as any).ID)) && (b as any).is_partnership
      );
      
      for (const bb of partnershipBillboards) {
        const billboardId = (bb as any).ID;
        const capital = Number((bb as any).capital || 0);
        const currentRemaining = Number((bb as any).capital_remaining ?? capital);
        
        // Calculate this billboard's price and discount
        const billboardPrice = calculateBillboardPrice(bb);
        const billboardPricePercentage = estimatedTotal > 0 ? billboardPrice / estimatedTotal : 0;
        const discountPerBillboard = discountAmount * billboardPricePercentage;
        const priceAfterDiscount = Math.max(0, billboardPrice - discountPerBillboard);
        
        // Get partnership terms for capital deduction percentage
        const { data: partnershipTerms } = await supabase
          .from('shared_billboards')
          .select('pre_capital_pct')
          .eq('billboard_id', billboardId)
          .limit(1);
        
        const capitalDeductionPct = Number(partnershipTerms?.[0]?.pre_capital_pct ?? 30) / 100;
        const capitalDeduction = priceAfterDiscount * capitalDeductionPct;
        
        // Calculate new remaining capital (limited to 0)
        const newCapitalRemaining = Math.max(0, currentRemaining - capitalDeduction);
        
        // Update billboard capital_remaining
        const { error: capitalError } = await supabase
          .from('billboards')
          .update({ capital_remaining: newCapitalRemaining })
          .eq('ID', billboardId);
        
        if (capitalError) {
          console.error(`Failed to update capital_remaining for billboard ${billboardId}:`, capitalError);
        }
      }

      // ✅ Save friend billboard rentals with accurate company IDs & clean up orphaned records
      const validFriendBillboardNumericIds: number[] = [];
      for (const billboardId of selected) {
        const billboard = billboards.find(b => String((b as any).ID) === billboardId);
        if (!billboard) continue;
        const currentFriendCompanyId = (billboard as any).friend_company_id || (billboard as any).own_company_id;
        if (!currentFriendCompanyId) continue;

        validFriendBillboardNumericIds.push(Number(billboardId));

        const friendCost = friendBillboardCosts.find(f => f.billboardId === billboardId);
        const billboardPrice = calculateBillboardPrice(billboard);
        const discountPerBillboard = selected.length > 0 && estimatedTotal > 0
          ? discountAmount * (billboardPrice / estimatedTotal) 
          : 0;
        const customerPrice = billboardPrice - discountPerBillboard;
        const rentalCost = (friendCost && friendCost.friendRentalCost !== undefined && friendCost.friendRentalCost !== null)
          ? Number(friendCost.friendRentalCost)
          : customerPrice;

        const { error: rentalError } = await supabase
          .from('friend_billboard_rentals')
          .upsert({
            contract_number: Number(contractNumber),
            billboard_id: Number(billboardId),
            friend_company_id: currentFriendCompanyId,
            start_date: startDate,
            end_date: endDate,
            customer_rental_price: customerPrice,
            friend_rental_cost: rentalCost,
            notes: 'تحديث من تعديل العقد'
          }, {
            onConflict: 'contract_number,billboard_id'
          });

        if (rentalError) {
          console.error('Failed to save friend rental:', rentalError);
        }
      }

      // ✅ Delete orphaned friend rentals for this contract (billboards removed or no longer friendly)
      if (validFriendBillboardNumericIds.length === 0) {
        await supabase
          .from('friend_billboard_rentals')
          .delete()
          .eq('contract_number', Number(contractNumber));
      } else {
        await supabase
          .from('friend_billboard_rentals')
          .delete()
          .eq('contract_number', Number(contractNumber))
          .not('billboard_id', 'in', `(${validFriendBillboardNumericIds.join(',')})`);
      }

      toast.success(`تم حفظ التعديلات مع العملة ${getCurrencySymbol(contractCurrency)} بنجاح`);
      navigate('/admin/contracts');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'فشل حفظ التعديلات');
    } finally {
      setSaving(false);
    }
  };

  const save = () => executeSave(false);

  const handleSmartConfirm = async (selectedTypes: TaskTypeSelection) => {
    setSmartConfirmOpen(false);
    if (pendingSaveCallback) {
      await pendingSaveCallback(selectedTypes);
      setPendingSaveCallback(null);
    }
  };

  const handlePrintContract = () => {
    if (currentContract) {
      setPdfOpen(true);
    } else {
      toast.error('يجب حفظ العقد أولاً');
    }
  };

  // ✅ NEW: Cleanup orphaned billboards
  const handleCleanup = async () => {
    try {
      toast.info('جاري تنظيف اللوحات المحذوفة من العقود...');
      const result = await cleanupOrphanedBillboards();
      
      if (result.cleaned > 0) {
        toast.success(`تم تنظيف ${result.cleaned} لوحة من أصل ${result.total} لوحة`);
        // إعادة تحميل اللوحات
        const data = await loadBillboards();
        setBillboards(data);
      } else {
        toast.info('لا توجد لوحات بحاجة للتنظيف');
      }
    } catch (e: any) {
      console.error('Cleanup failed:', e);
      toast.error('فشل في تنظيف اللوحات');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 text-foreground p-4 md:p-6" dir="rtl">
      <div className="max-w-[1600px] mx-auto space-y-4">
        <ContractEditHeader
          contractNumber={contractNumber}
          onBack={() => navigate('/admin/contracts')}
          onPrint={handlePrintContract}
          onSave={save}
          saving={saving}
        />

 {/* تنبيه الأسعار المحفوظة */}
        {useStoredPrices && currentContract?.billboard_prices && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl border-2 border-amber-500/50 bg-amber-500/10">
            <div className="p-1.5 rounded-lg bg-amber-500/20 mt-0.5 shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-amber-700 dark:text-amber-400">الأسعار المعروضة هي الأسعار المحفوظة مسبقاً في هذا العقد</p>
              <p className="text-xs text-amber-600/80 dark:text-amber-500/80 mt-0.5">
                لن يتم جلب أسعار جديدة من جدول التسعير تلقائياً. لتحديث الأسعار من الجدول الحالي، انقر على زر "تحديث الأسعار من الجدول الحالي" في إعدادات التسعير.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col xl:flex-row gap-4">
          {/* Main Content */}
          <div className="flex-1 space-y-6">
            {/* أزرار الاستعارة والإيقاف الخارجي */}
            <div className="flex justify-end gap-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                className="gap-2 border-primary/50 text-primary hover:bg-primary/10"
                onClick={() => setPausedFromContractOpen(true)}
                title="إضافة لوحة من عقد آخر كموقوفة فقط (دون فكها من العقد المصدر)"
              >
                <PauseCircle className="h-4 w-4" />
                إضافة لوحة موقوفة من عقد آخر
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2 border-amber-500/50 text-amber-700 hover:bg-amber-50 dark:text-amber-300"
                onClick={() => setBorrowDialogOpen(true)}
              >
                <RefreshCw className="h-4 w-4" />
                استعارة لوحة من عقد آخر
              </Button>
            </div>
            {/* اللوحات المرتبطة */}
            <SelectedBillboardsCard
              contractNumber={Number(contractNumber) || undefined}
              previousContractNumber={currentContract?.previous_contract_number}
              previousContractBillboardIds={previousContractBillboardIds}
              onAddPausedFromContractClick={() => setPausedFromContractOpen(true)}
              selected={selected}
              billboards={billboards}
              onRemoveSelected={removeSelected}
              onBulkRemove={removeMultipleSelected}
              onSwapBillboard={(id, name) => {
                const bb = billboards.find(b => String((b as any).ID) === id);
                setSwapBillboard({
                  id,
                  name,
                  size: (bb as any)?.Size || (bb as any)?.size || '',
                  imageUrl: (bb as any)?.Image_URL || '',
                  landmark: (bb as any)?.Nearest_Landmark || '',
                });
                setSwapDialogMode('swap');
                setSwapDialogOpen(true);
              }}
              onMoveBillboard={(id, name) => {
                const bb = billboards.find(b => String((b as any).ID) === id);
                setSwapBillboard({
                  id,
                  name,
                  size: (bb as any)?.Size || (bb as any)?.size || '',
                  imageUrl: (bb as any)?.Image_URL || '',
                  landmark: (bb as any)?.Nearest_Landmark || '',
                });
                setSwapDialogMode('move');
                setSwapDialogOpen(true);
              }}
              calculateBillboardPrice={calculateBillboardPrice}
              installationDetails={mergedInstallationDetails}
              pricingMode={pricingMode}
              durationMonths={durationMonths}
              durationDays={durationDays}
              currencySymbol={getCurrencySymbol(contractCurrency)}
              sizeNames={sizeNames}
              totalDiscount={discountAmount}
              friendBillboardCosts={friendBillboardCosts}
              onUpdateFriendCost={updateFriendBillboardCost}
              partnershipOperatingFeeRate={partnershipOperatingFeeRate}
              customerCategory={pricingCategory}
              // ✅ Merged details (selected + paused) so paused cards show print/install rows
              printCostDetails={mergedPrintCostDetails}
              includePrintInPrice={includePrintInPrice}
              includeInstallationInPrice={includeInstallationInPrice}
              printCostEnabled={printCostEnabled}
              installationEnabled={installationEnabled}
              singleFaceBillboards={singleFaceBillboards}
              onToggleSingleFace={toggleSingleFace}
              pricingByBillboardOverride={unifiedPricingByBillboard}
              installDatesByBillboard={installDatesByBillboard}
              individualDiscounts={individualDiscounts}
              onUpdateIndividualDiscount={handleUpdateIndividualDiscount}
              startDate={startDate}
              endDate={endDate}
              billboardCustomDates={billboardCustomDates}
              onUpdateBillboardCustomDates={handleUpdateBillboardCustomDates}
              use30DayMonth={use30DayMonth}
              customerName={customerName}
              adType={adType}
              onRefresh={refreshContractData}
            />

 {/* NEW: إيجارات اللوحات الصديقة بالجملة */}
            {selected.length > 0 && billboards.filter(b => 
              selected.includes(String((b as any).ID)) && (b as any).friend_company_id
            ).length > 0 && (
              <FriendBillboardsBulkRental
                friendBillboards={billboards
                  .filter(b => selected.includes(String((b as any).ID)) && (b as any).friend_company_id)
                  .map(b => ({
                    id: String((b as any).ID),
                    size: (b as any).Size || (b as any).size || 'غير محدد',
                    friendCompanyId: (b as any).friend_company_id,
                    friendCompanyName: (b as any).friend_companies?.name || 'شركة صديقة'
                  }))
                }
                friendBillboardCosts={friendBillboardCosts}
                onUpdateFriendCost={updateFriendBillboardCost}
                includesInstallation={friendRentalIncludesInstallation}
                onIncludesInstallationChange={setFriendRentalIncludesInstallation}
                currencySymbol={getCurrencySymbol(contractCurrency)}
                operatingFeeEnabled={friendRentalOperatingFeeEnabled}
                operatingFeeRate={friendRentalOperatingFeeRate}
                onOperatingFeeEnabledChange={setFriendRentalOperatingFeeEnabled}
                onOperatingFeeRateChange={setFriendRentalOperatingFeeRate}
                operatingFeeAmount={friendOperatingFeeAmount}
              />
            )}

            {/* خريطة اللوحات المرتبطة - مطوية افتراضياً */}
            {selected.length > 0 && (
              <Card className="bg-card border-border shadow-card overflow-hidden">
                <Collapsible defaultOpen={false}>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                          <MapIcon className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-card-foreground">خريطة اللوحات المرتبطة</h3>
                          <p className="text-xs text-muted-foreground">
                            {selected.length} لوحة مرتبطة بالعقد
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                        {selected.length}
                      </Badge>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t border-border">
                      <SelectableGoogleHomeMap
                        hideInternalFilters
                        billboards={billboards
                          .filter((b) => selected.includes(String((b as any).ID)))
                          .map(b => ({
                            ...b,
                            ID: (b as any).ID || 0,
                            Billboard_Name: (b as any).Billboard_Name || '',
                            City: (b as any).City || '',
                            District: (b as any).District || '',
                            Size: (b as any).Size || '',
                            Status: (b as any).Status || 'متاح',
                            Price: (b as any).Price || '0',
                            Level: (b as any).Level || '',
                            Image_URL: (b as any).Image_URL || '',
                            GPS_Coordinates: (b as any).GPS_Coordinates || '',
                            GPS_Link: (b as any).GPS_Link || '',
                            Nearest_Landmark: (b as any).Nearest_Landmark || '',
                            Faces_Count: (b as any).Faces_Count || '1',
                            Municipality: (b as any).Municipality || '',
                            Rent_End_Date: (b as any).Rent_End_Date || null,
                            Customer_Name: (b as any).Customer_Name || customerName || '',
                            Ad_Type: (b as any).Ad_Type || adType || '',
                            is_visible_in_available: (b as any).is_visible_in_available,
                            id: String((b as any).ID || ''),
                            name: (b as any).Billboard_Name || '',
                            location: (b as any).Nearest_Landmark || '',
                            size: (b as any).Size || '',
                            status: (b as any).Status || 'متاح',
                            coordinates: (b as any).GPS_Coordinates || '',
                            imageUrl: (b as any).Image_URL || '',
                            expiryDate: (b as any).Rent_End_Date || null,
                            area: (b as any).District || '',
                            municipality: (b as any).Municipality || '',
                          })) as Billboard[]}
                        selectedBillboards={selectedBillboardsSet}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            )}

            {/* إدارة التصاميم */}
            {selected.length > 0 && (
              <DesignManager
                selectedBillboards={billboards
                  .filter((b) => selected.includes(String((b as any).ID)))
                  .map((b) => ({
                    id: String((b as any).ID),
                    name: (b as any).name || (b as any).Billboard_Name || '',
                    Image_URL: (b as any).Image_URL || (b as any).image,
                    image: (b as any).image,
                    Nearest_Landmark: (b as any).Nearest_Landmark || (b as any).nearest_landmark,
                    nearest_landmark: (b as any).nearest_landmark
                  }))
                }
                designs={billboardDesigns}
                onChange={setBillboardDesigns}
                contractId={contractNumber}
              />
            )}

 {/* اختيار اللوحات مع الخريطة */}
            <Card className="border-border shadow-lg overflow-hidden h-[calc(100vh-160px)] min-h-[800px] flex flex-col">
              <div className="p-3 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border shrink-0">
                <BillboardFilters
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  cityFilter={cityFilter}
                  setCityFilter={setCityFilter}
                  sizeFilter={sizeFilter}
                  setSizeFilter={setSizeFilter}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  pricingCategory={pricingCategory}
                  setPricingCategory={handlePricingCategoryChange}
                  cities={cities}
                  sizes={sizes}
                  pricingCategories={pricingCategories}
                  municipalities={municipalities}
                  municipalityFilter={municipalityFilter}
                  setMunicipalityFilter={setMunicipalityFilter}
                  onCleanup={handleCleanup}
                  sizeFilters={sizeFilters}
                  setSizeFilters={setSizeFilters}
                  totalCount={billboards.length}
                  selectedCount={selected.length}
                />
              </div>

              <Tabs defaultValue="list" className="w-full flex-1 flex flex-col min-h-0">
                <div className="p-3 border-b border-border shrink-0">
                  <TabsList className="grid w-[240px] grid-cols-2 bg-background/50 h-10">
                    <TabsTrigger value="list" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <List className="h-4 w-4" />
                      القائمة
                    </TabsTrigger>
                    <TabsTrigger value="map" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <MapIcon className="h-4 w-4" />
                      الخريطة
                    </TabsTrigger>
                  </TabsList>
                </div>
                
                <TabsContent value="list" className="m-0 flex-1 overflow-y-auto min-h-0">
                  <div className="p-3 space-y-3">
                    <AvailableBillboardsGrid
                      billboards={filtered}
                      selected={selected}
                      onToggleSelect={toggleSelect}
                      loading={loading}
                      calculateBillboardPrice={(b) => calculateBillboardPrice(b as Billboard)}
                      pricingMode={pricingMode}
                      durationMonths={durationMonths}
                      durationDays={durationDays}
                      pricingCategory={pricingCategory}
                      onSelectCityFilter={(c) => setCityFilter(c)}
                      onSelectMunicipalityFilter={(m) => setMunicipalityFilter?.(m)}
                      onSelectSizeFilter={(s) => setSizeFilter(s)}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="map" className="m-0 p-0 flex-1 min-h-0">
                  <SelectableGoogleHomeMap
                    className="w-full h-full"
                    hideInternalFilters
                    billboards={filtered.map((b) => {
                      const endDate = (b as any).Rent_End_Date ?? (b as any).rent_end_date ?? null;
                      const billboardId = Number((b as any).ID ?? (b as any).id);
                      const isOccupiedByActiveContract = occupiedBillboardIds.has(billboardId);
                      const effectiveEndDate = endDate || (isOccupiedByActiveContract ? occupiedBillboardIds.get(billboardId) : null) || null;
                      const daysUntilExpiry = getDaysUntilExpiry(effectiveEndDate);
                      const isNearExpiry = typeof daysUntilExpiry === 'number' && daysUntilExpiry > 0 && daysUntilExpiry <= 30;
                      const isAvailable = isBillboardAvailable(b, true) && !isOccupiedByActiveContract;
                      const statusLabel = isAvailable ? 'متاح' : isNearExpiry ? 'قريباً' : 'محجوز';

                      return {
                        ...b,
                        ID: (b as any).ID || 0,
                        Billboard_Name: (b as any).Billboard_Name || '',
                        City: (b as any).City || '',
                        District: (b as any).District || '',
                        Size: (b as any).Size || '',
                        Status: statusLabel,
                        Price: (b as any).Price || '0',
                        Level: (b as any).Level || '',
                        Image_URL: (b as any).Image_URL || '',
                        GPS_Coordinates: (b as any).GPS_Coordinates || '',
                        GPS_Link: (b as any).GPS_Link || '',
                        Nearest_Landmark: (b as any).Nearest_Landmark || '',
                        Faces_Count: (b as any).Faces_Count || '1',
                        Municipality: (b as any).Municipality || '',
                        Rent_End_Date: endDate,
                        Customer_Name: (b as any).Customer_Name || '',
                        Ad_Type: (b as any).Ad_Type || '',
                        is_visible_in_available: (b as any).is_visible_in_available,
                        id: String((b as any).ID || ''),
                        name: (b as any).Billboard_Name || '',
                        location: (b as any).Nearest_Landmark || '',
                        size: (b as any).Size || '',
                        status: (isAvailable ? 'available' : 'rented') as 'available' | 'rented',
                        coordinates: (b as any).GPS_Coordinates || '',
                        imageUrl: (b as any).Image_URL || '',
                        expiryDate: endDate,
                        area: (b as any).District || '',
                        municipality: (b as any).Municipality || '',
                        size_id: (b as any).size_id || null,
                      };
                    }) as Billboard[]}
                    selectedBillboards={selectedBillboardsSet}
                    onToggleSelection={(billboardId) => {
                      const billboard = billboards.find((b) => String((b as any).ID) === billboardId);
                      if (billboard) {
                        toggleSelect(billboard);
                      }
                    }}
                    onSelectMultiple={(billboardIds) => {
                      setSelected((prev) => {
                        const newSet = new Set(prev);
                        billboardIds.forEach((id) => newSet.add(id));
                        return Array.from(newSet);
                      });
                      toast.success(`تم تحديد ${billboardIds.length} لوحة`);
                    }}
                    pricingMode={pricingMode}
                    durationMonths={durationMonths}
                    durationDays={durationDays}
                    pricingCategory={pricingCategory}
                    calculateBillboardPrice={(b) => calculateBillboardPrice(b as Billboard)}
                  />
                </TabsContent>
              </Tabs>
            </Card>
          </div>

          {/* Sidebar - القائمة الجانبية */}
          <div className="w-full xl:w-[420px] space-y-3 xl:sticky xl:top-4 xl:self-start">
            {/* معلومات العميل */}
            <CustomerInfoForm
              customerName={customerName}
              setCustomerName={setCustomerName}
              adType={adType}
              setAdType={setAdType}
              pricingCategory={pricingCategory}
              setPricingCategory={handlePricingCategoryChange}
              pricingCategories={pricingCategories}
              customers={customers}
              customerOpen={customerOpen}
              setCustomerOpen={setCustomerOpen}
              customerQuery={customerQuery}
              setCustomerQuery={setCustomerQuery}
              onAddCustomer={handleAddCustomer}
              onSelectCustomer={handleSelectCustomer}
            />

            {/* تواريخ العقد */}
            <ContractDatesForm
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              pricingMode={pricingMode}
              setPricingMode={handlePricingModeChange}
              durationMonths={durationMonths}
              setDurationMonths={handleDurationMonthsChange}
              durationDays={durationDays}
              setDurationDays={handleDurationDaysChange}
              use30DayMonth={use30DayMonth}
              setUse30DayMonth={handleUse30DayMonthChange}
            />

            {/* معلومات لوحات المشاركة */}
            {selected.length > 0 && startDate && endDate && (
              <PartnershipBillboardsInfo 
                billboardIds={selected.map(id => Number(id))}
                startDate={startDate}
                endDate={endDate}
              />
            )}

            {/* رسوم التشغيل للوحات المشاركة */}
            {selected.length > 0 && billboards.filter(b => selected.includes(String((b as any).ID)) && (b as any).is_partnership).length > 0 && (
              <Card className="bg-card border-border shadow-lg overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
                <CardHeader className="py-3 px-4 bg-gradient-to-br from-purple-500/5 to-transparent">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <div className="p-1.5 rounded-lg bg-purple-500/10">
                      <Settings className="h-4 w-4 text-purple-600" />
                    </div>
                    رسوم التشغيل (لوحات المشاركة)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <Label className="text-sm font-medium whitespace-nowrap">النسبة:</Label>
                    <div className="relative flex-1">
                      <input
                        type="number"
                        value={partnershipOperatingFeeRate}
                        onChange={(e) => setPartnershipOperatingFeeRate(Number(e.target.value) || 0)}
                        className="w-full h-10 px-3 rounded-lg bg-background border-2 border-border focus:border-purple-500 transition-colors text-center font-medium"
                        placeholder="3"
                        min="0"
                        step="0.1"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">%</span>
                    </div>
                  </div>
                  
                  <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">إيجار لوحات المشاركة:</span>
                      <span className="font-semibold">{partnershipBillboardsRentalCost.toLocaleString('ar-LY')} د.ل</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-purple-500/20">
                      <span className="font-semibold text-purple-700 dark:text-purple-300">رسوم التشغيل:</span>
                      <span className="text-lg font-bold text-purple-600">{partnershipOperatingFee.toLocaleString('ar-LY')} د.ل</span>
                    </div>
                  </div>
                  
                  <p className="text-xs text-muted-foreground text-center bg-muted/30 p-2 rounded-lg">
 ️ رسوم منفصلة عن اللوحات العادية
                  </p>
                </CardContent>
              </Card>
            )}
            
            {/* رسوم التشغيل العادية - ملخص */}
            {selected.length > 0 && regularBillboardsRentalCost > 0 && (
              <Card className="bg-card border-border shadow-lg overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
                <CardHeader className="py-3 px-4 bg-gradient-to-br from-blue-500/5 to-transparent">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <div className="p-1.5 rounded-lg bg-blue-500/10">
                      <DollarSign className="h-4 w-4 text-blue-600" />
                    </div>
                    رسوم التشغيل (اللوحات العادية)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <Label className="text-sm font-medium whitespace-nowrap">النسبة:</Label>
                    <div className="relative flex-1">
                      <input
                        type="number"
                        value={operatingFeeRate}
                        onChange={(e) => setOperatingFeeRate(Number(e.target.value) || 3)}
                        className="w-full h-10 px-3 rounded-lg bg-background border-2 border-border focus:border-blue-500 transition-colors text-center font-medium"
                        placeholder="3"
                        min="0"
                        max="100"
                        step="0.1"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">%</span>
                    </div>
                  </div>
                  
                  <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">صافي الإيجار (للشركة):</span>
                      <span className="font-semibold">{netRentalForCompany.toLocaleString('ar-LY')} د.ل</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-blue-500/20">
                      <span className="font-semibold text-blue-700 dark:text-blue-300">رسوم التشغيل:</span>
                      <span className="text-lg font-bold text-blue-600">{operatingFee.toLocaleString('ar-LY')} د.ل</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

 {/* إجمالي رسوم التشغيل */}
            {(operatingFee > 0 || partnershipOperatingFee > 0 || friendOperatingFeeAmount > 0) && (
              <Card className="bg-card border-border shadow-lg overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
                <CardHeader className="py-3 px-4 bg-gradient-to-br from-emerald-500/5 to-transparent">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10">
                      <DollarSign className="h-4 w-4 text-emerald-600" />
                    </div>
                    إجمالي رسوم التشغيل
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {operatingFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">رسوم اللوحات العادية ({operatingFeeRate}%):</span>
                      <span className="font-semibold text-blue-600">{operatingFee.toLocaleString('ar-LY')} {getCurrencySymbol(contractCurrency)}</span>
                    </div>
                  )}
                  {partnershipOperatingFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">رسوم لوحات المشاركة ({partnershipOperatingFeeRate}%):</span>
                      <span className="font-semibold text-purple-600">{partnershipOperatingFee.toLocaleString('ar-LY')} {getCurrencySymbol(contractCurrency)}</span>
                    </div>
                  )}
                  {friendOperatingFeeAmount > 0 && (
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">تكلفة اللوحات الصديقة:</span>
                        <span className="font-semibold text-amber-500">{totalFriendCosts.toLocaleString('ar-LY')} {getCurrencySymbol(contractCurrency)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">رسوم التشغيل ({friendRentalOperatingFeeRate}%):</span>
                        <span className="font-semibold text-amber-600">{friendOperatingFeeAmount.toLocaleString('ar-LY')} {getCurrencySymbol(contractCurrency)}</span>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-3 border-t border-emerald-500/20">
                    <span className="font-bold text-emerald-700 dark:text-emerald-300">الإجمالي:</span>
                    <span className="text-xl font-bold text-emerald-600">
                      {(operatingFee + partnershipOperatingFee + friendOperatingFeeAmount).toLocaleString('ar-LY')} {getCurrencySymbol(contractCurrency)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground text-center bg-muted/30 p-2 rounded-lg">
                    يتم حفظ هذا المبلغ في حقل "رسوم التشغيل" بالعقد
                  </p>
                </CardContent>
              </Card>
            )}

            <Card className="bg-card border-border shadow-lg overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
              <CardHeader className="py-3 px-4 bg-gradient-to-br from-amber-500/5 to-transparent">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="p-1.5 rounded-lg bg-amber-500/10">
                    <DollarSign className="h-4 w-4 text-amber-600" />
                  </div>
                  إعدادات العملة
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">عملة العقد</Label>
                    <Select value={contractCurrency} onValueChange={setContractCurrency}>
                      <SelectTrigger className="h-10 bg-background border-2 border-border focus:border-amber-500">
                        <SelectValue placeholder="اختر العملة" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border z-[10000]">
                        {CURRENCIES.map((currency) => (
                          <SelectItem key={currency.code} value={currency.code}>
                            {currency.symbol} - {currency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">سعر الصرف</Label>
                    <div className="relative">
                      <input
                        type="number"
                        value={exchangeRate}
                        onChange={(e) => setExchangeRate(Number(e.target.value) || 1)}
                        className="w-full h-10 px-3 rounded-lg bg-background border-2 border-border focus:border-amber-500 transition-colors text-center font-medium"
                        placeholder="1"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                </div>
                
                {contractCurrency !== 'LYD' && (
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                    <span className="text-xs text-amber-700 dark:text-amber-300">
                      1 د.ل = {exchangeRate} {getCurrencySymbol(contractCurrency)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* إعدادات التسعير */}
            <Card className="bg-card border-border shadow-lg overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-500" />
              <CardHeader className="py-3 px-4 bg-gradient-to-br from-violet-500/5 to-transparent">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="p-1.5 rounded-lg bg-violet-500/10">
                    <RefreshCw className="h-4 w-4 text-violet-600" />
                  </div>
                  إعدادات التسعير
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* نظام التسعير */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">نظام التسعير</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={!useFactorsPricing ? "default" : "outline"}
                      size="sm"
                      className={`h-10 text-xs gap-2 ${!useFactorsPricing ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-md' : 'hover:bg-violet-500/10 hover:border-violet-500/50'}`}
                      onClick={() => setUseFactorsPricing(false)}
                    >
                      <List className="h-4 w-4" />
                      جدول الأسعار
                    </Button>
                    <Button
                      variant={useFactorsPricing ? "default" : "outline"}
                      size="sm"
                      className={`h-10 text-xs gap-2 ${useFactorsPricing ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-md' : 'hover:bg-violet-500/10 hover:border-violet-500/50'}`}
                      onClick={() => setUseFactorsPricing(true)}
                    >
                      <Calculator className="h-4 w-4" />
                      نظام المعاملات
                    </Button>
                  </div>
                </div>

                {/* أسعار مخزنة أو حالية */}
                {!useFactorsPricing && (
                  <div className="space-y-3">
                    {/* Status indicator */}
                    <div className={`flex items-center justify-between p-3 rounded-xl border-2 transition-colors ${
                      useStoredPrices 
                        ? 'bg-amber-500/5 border-amber-500/30' 
                        : 'bg-emerald-500/5 border-emerald-500/30'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${useStoredPrices ? 'bg-amber-500/15' : 'bg-emerald-500/15'}`}>
                          {useStoredPrices ? (
                            <DollarSign className="h-4 w-4 text-amber-600" />
                          ) : (
                            <RefreshCw className="h-4 w-4 text-emerald-600" />
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium">مصدر الأسعار</Label>
                          <p className={`text-xs ${useStoredPrices ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {useStoredPrices ? 'الأسعار المحفوظة في العقد' : 'من جدول التسعير الحالي'}
                          </p>
                        </div>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          useStoredPrices 
                            ? 'border-amber-500/50 text-amber-600 bg-amber-500/10' 
                            : 'border-emerald-500/50 text-emerald-600 bg-emerald-500/10'
                        }`}
                      >
                        {useStoredPrices ? 'محفوظة' : 'محدثة'}
                      </Badge>
                    </div>
                    
                    {/* Prominent refresh button */}
                    {useStoredPrices && (
                      <Button
                        variant="outline"
                        onClick={refreshPricesFromSystem}
                        disabled={refreshingPrices}
                        className="w-full h-12 gap-2.5 border-2 border-primary/40 hover:border-primary hover:bg-primary/10 text-primary font-semibold rounded-xl shadow-sm transition-all"
                      >
                        {refreshingPrices ? (
                          <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            جاري التحديث...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-5 w-5" />
                            تحديث الأسعار من الجدول الحالي
                          </>
                        )}
                      </Button>
                    )}
                    
                    {/* Switch to stored prices if currently using fresh */}
                    {!useStoredPrices && originalTotal > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setUseStoredPrices(true)}
                        className="w-full text-xs text-muted-foreground hover:text-foreground gap-2"
                      >
                        <DollarSign className="h-3.5 w-3.5" />
                        استخدام الأسعار المحفوظة السابقة
                      </Button>
                    )}
                  </div>
                )}
                
                {useFactorsPricing && (
                  <a 
                    href="/admin/pricing-factors" 
                    target="_blank" 
                    className="flex items-center justify-center gap-2 p-3 rounded-xl bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/30 text-violet-700 dark:text-violet-300 text-sm font-medium hover:from-violet-500/20 hover:to-purple-500/20 transition-all"
                  >
                    <Settings className="h-4 w-4" />
                    إدارة المعاملات والأسعار الأساسية
                  </a>
                )}
              </CardContent>
            </Card>

            {/* تكلفة التركيب */}
            <Card className="bg-card border-border shadow-lg overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-orange-500 to-red-500" />
              <CardHeader className="py-3 px-4 bg-gradient-to-br from-orange-500/5 to-transparent">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-orange-500/10">
                      <Wrench className="h-4 w-4 text-orange-600" />
                    </div>
                    تكلفة التركيب
                  </div>
                  <Switch
                    checked={installationEnabled}
                    onCheckedChange={(checked) => {
                      setInstallationEnabled(checked);
                      toast.success(checked ? 'تم تفعيل التركيب' : 'تم إلغاء التركيب');
                    }}
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {installationEnabled && installationCostSummary ? (
                  <div className="space-y-3">
                    {/* الإجمالي الرئيسي */}
                    <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-orange-700 dark:text-orange-300">إجمالي التركيب:</span>
                        <span className="text-xl font-bold text-orange-600">
                          {applyExchangeRate(installationCostSummary.totalInstallationCost).toLocaleString('ar-LY')} {getCurrencySymbol(contractCurrency)}
                        </span>
                      </div>
                    </div>
                    
                    {/* تفاصيل المقاسات */}
                    {installationCostSummary.groupedSizes.length > 0 && (
                      <div className="space-y-1.5">
                        {installationCostSummary.groupedSizes.map((sizeInfo: any, index: number) => (
                          <div key={index} className="flex justify-between text-sm px-2 py-1.5 rounded-lg bg-muted/30">
                            <span className="text-muted-foreground">{sizeInfo.size} ({sizeInfo.count} لوحة)</span>
                            <span className="font-medium">{applyExchangeRate(sizeInfo.totalForSize).toLocaleString()} {getCurrencySymbol(contractCurrency)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-4 bg-muted/20 rounded-lg">
                    {installationEnabled ? 'لا توجد لوحات مختارة' : 'العقد بدون تكلفة تركيب'}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* تكلفة الطباعة */}
            <Card className="bg-card border-border shadow-lg overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-cyan-500 to-blue-500" />
              <CardHeader className="py-3 px-4 bg-gradient-to-br from-cyan-500/5 to-transparent">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-cyan-500/10">
                      <FileText className="h-4 w-4 text-cyan-600" />
                    </div>
                    تكلفة الطباعة
                  </div>
                  <Switch
                    checked={printCostEnabled}
                    onCheckedChange={setPrintCostEnabled}
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {printCostEnabled ? (
                  <div className="space-y-4">
                    {/* سعر المتر */}
                    <div className="flex items-center gap-3">
                      <Label className="text-sm font-medium whitespace-nowrap">سعر المتر²:</Label>
                      <div className="relative flex-1">
                        <input
                          type="number"
                          value={printPricePerMeter}
                          onChange={(e) => setPrintPricePerMeter(Number(e.target.value) || 0)}
                          className="w-full h-10 px-3 rounded-lg bg-background border-2 border-border focus:border-cyan-500 transition-colors text-center font-medium"
                          placeholder="0"
                          min="0"
                          step="0.01"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">د.ل</span>
                      </div>
                    </div>
                    
                    {printCostSummary && printCostSummary.groupedDetails.length > 0 ? (
                      <div className="space-y-3">
                        {/* تفاصيل المقاسات */}
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {printCostSummary.groupedDetails.map((detail: any, index: number) => (
                            <div key={index} className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                              <div className="flex justify-between items-center mb-1.5">
                                <span className="font-semibold text-sm">{detail.size}</span>
                                <Badge variant="secondary" className="text-xs">
                                  {detail.count} لوحة × {detail.faces} وجه
                                </Badge>
                              </div>
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>المساحة: {detail.area.toFixed(1)} م²</span>
                                <span className="font-medium text-cyan-600">{detail.totalCost.toFixed(0)} د.ل</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* الإجمالي */}
                        <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20">
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-cyan-700 dark:text-cyan-300">إجمالي الطباعة:</span>
                            <span className="text-xl font-bold text-cyan-600">
                              {applyExchangeRate(Number(printCostSummary.totalPrintCost || 0)).toLocaleString('ar-LY')} {getCurrencySymbol(contractCurrency)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-center py-4 text-muted-foreground bg-muted/20 rounded-lg">
                        {selected.length === 0 ? 'لا توجد لوحات مختارة' : 'أدخل سعر المتر لحساب التكلفة'}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-4 bg-muted/20 rounded-lg">
                    العقد بدون تكلفة طباعة
                  </div>
                )}
              </CardContent>
            </Card>



            {/* إدارة الدفعات */}
            <InstallmentsManager
              installments={installments}
              finalTotal={finalTotal}
              startDate={startDate}
              endDate={endDate}
              // ✅ Prevent auto-redistribution when installments are loaded from DB
              disableAutoRedistribute={installmentsLoaded}
              onDistributeEvenly={distributeEvenly}
              onDistributeWithInterval={distributeWithInterval}
              onDistributeByDurationPeriods={distributeByDurationPeriods}
              onCreateManualInstallments={createManualInstallments}
              onApplyUnequalDistribution={handleApplyUnequalDistribution}
              onAddInstallment={addInstallment}
              onRemoveInstallment={removeInstallment}
              onUpdateInstallment={updateInstallment}
              onClearAll={clearAllInstallments}
              installmentSummary={getInstallmentSummary()}
              // ✅ NEW: Pass saved settings
              savedDistributionType={installmentDistributionType}
              savedFirstPaymentAmount={installmentFirstPaymentAmount}
              savedFirstPaymentType={installmentFirstPaymentType}
              savedInterval={installmentInterval}
              savedCount={installmentCount}
              savedHasDifferentFirstPayment={hasDifferentFirstPayment}
              savedFirstAtSigning={installmentFirstAtSigning}
              // ✅ NEW: Sync callbacks
              onDistributionTypeChange={setInstallmentDistributionType}
              onFirstPaymentAmountChange={setInstallmentFirstPaymentAmount}
              onFirstPaymentTypeChange={setInstallmentFirstPaymentType}
              onIntervalChange={setInstallmentInterval}
              onCountChange={setInstallmentCount}
              onHasDifferentFirstPaymentChange={setHasDifferentFirstPayment}
              onFirstAtSigningChange={setInstallmentFirstAtSigning}
            />

            {/* مكون تخفيض حسب المستوى */}
            {selected.length > 0 && (
              <LevelDiscountsCard
                selectedBillboards={billboards.filter(b => selected.includes(String((b as any).ID)))}
                levelDiscounts={levelDiscounts}
                setLevelDiscounts={setLevelDiscounts}
                currencySymbol={getCurrencySymbol(contractCurrency)}
                calculateBillboardPrice={calculateBillboardPrice}
                sizeNames={sizeNames}
              />
            )}

            {/* ملخص التكاليف */}
            <CostSummaryCard
              pausedTotals={pausedTotals}
              estimatedTotal={estimatedTotal}
              rentCost={rentCost}
              setRentCost={setRentCost}
              setUserEditedRentCost={setUserEditedRentCost}
              discountType={discountType}
              setDiscountType={setDiscountType}
              discountValue={discountValue}
              setDiscountValue={setDiscountValue}
              baseTotal={baseTotal}
              discountAmount={discountAmount}
              finalTotal={finalTotal}
              installationCost={installationEnabled ? applyExchangeRate(installationCost) : 0}
              rentalCostOnly={rentalCostOnly}
              operatingFee={operatingFee + partnershipOperatingFee}
              operatingFeeRate={operatingFeeRate}
              currentContract={currentContract}
              originalTotal={originalTotal}
              onSave={save}
              onCancel={() => navigate('/admin/contracts')}
              saving={saving}
              totalFriendCosts={totalFriendCosts}
              validFriendCount={validFriendCosts.length}
              storedFriendCount={friendBillboardCosts.length}
              onCleanStaleFriendCosts={() => {
                const validIds = new Set(validFriendCosts.map(f => f.billboardId));
                setFriendBillboardCosts(prev => prev.filter(f => validIds.has(f.billboardId)));
              }}
              // Print cost props
              printCost={printCostEnabled ? applyExchangeRate(printCostTotal) : 0}
              printCostEnabled={printCostEnabled}
              // Installation enabled
              installationEnabled={installationEnabled}
              // Include in price toggles
              includeInstallationInPrice={includeInstallationInPrice}
              setIncludeInstallationInPrice={setIncludeInstallationInPrice}
              includePrintInPrice={includePrintInPrice}
              setIncludePrintInPrice={setIncludePrintInPrice}
              // Operating fee inclusion toggles
              includeOperatingInPrint={includeOperatingInPrint}
              setIncludeOperatingInPrint={setIncludeOperatingInPrint}
              includeOperatingInInstallation={includeOperatingInInstallation}
              setIncludeOperatingInInstallation={setIncludeOperatingInInstallation}
              // Separate operating fee rates
              operatingFeeRateInstallation={operatingFeeRateInstallation}
              setOperatingFeeRateInstallation={setOperatingFeeRateInstallation}
              operatingFeeRatePrint={operatingFeeRatePrint}
              setOperatingFeeRatePrint={setOperatingFeeRatePrint}
              // Currency
              currencySymbol={getCurrencySymbol(contractCurrency)}
              // Proportional distribution
              onProportionalDistribution={handleProportionalDistribution}
              // ✅ NEW: Friend rental operating fee
              friendRentalOperatingFeeEnabled={friendRentalOperatingFeeEnabled}
              setFriendRentalOperatingFeeEnabled={setFriendRentalOperatingFeeEnabled}
              friendRentalOperatingFeeRate={friendRentalOperatingFeeRate}
              setFriendRentalOperatingFeeRate={setFriendRentalOperatingFeeRate}
              friendOperatingFeeAmount={friendOperatingFeeAmount}
            />

            {/* مصاريف وخسائر العقد */}
            {contractNumber && (
              <ContractExpensesManager contractNumber={Number(contractNumber)} />
            )}
          </div>
        </div>

        <ContractPDFDialog
          open={pdfOpen}
          onOpenChange={setPdfOpen}
          contract={{
            ...(currentContract || {}),
            billboard_prices: JSON.stringify(selectedBillboardPricingSnapshot),
          }}
          liveBillboardPrices={selectedBillboardPricingSnapshot as any[]}
        />

        <SmartBillboardConfirmDialog
          open={smartConfirmOpen}
          onOpenChange={setSmartConfirmOpen}
          billboardLinks={smartBillboardLinks}
          onConfirm={handleSmartConfirm}
          loading={saving}
        />

        {swapBillboard && (
          <BillboardSwapDialog
            open={swapDialogOpen}
            onOpenChange={setSwapDialogOpen}
            billboardId={swapBillboard.id}
            billboardName={swapBillboard.name}
            billboardSize={swapBillboard.size}
            billboardImageUrl={swapBillboard.imageUrl}
            billboardLandmark={swapBillboard.landmark}
            currentContractNumber={contractNumber || ''}
            startDate={startDate}
            endDate={endDate}
            mode={swapDialogMode}
            onSwapComplete={() => {
              setSelected(prev => prev.filter(x => x !== swapBillboard.id));
              setSwapBillboard(null);
            }}
          />
        )}

        <BorrowBillboardDialog
          open={borrowDialogOpen}
          onOpenChange={setBorrowDialogOpen}
          targetContractNumber={String(contractNumber || '')}
          targetCustomerName={customerName}
          targetStartDate={startDate}
          targetEndDate={endDate}
          onDone={(bbId) => {
            setSelected(prev => prev.includes(bbId) ? prev : [...prev, bbId]);
            // refresh billboards
            loadBillboards().then(setBillboards).catch(() => {});
          }}
        />

        <AddPausedFromContractDialog
          open={pausedFromContractOpen}
          onOpenChange={setPausedFromContractOpen}
          targetContractNumber={String(contractNumber || '')}
          targetStartDate={startDate}
          targetEndDate={endDate}
          contractDiscountPercent={
            discountType === 'percent'
              ? Math.max(0, Math.min(100, Number(discountValue) || 0))
              : (baseTotal > 0 ? Math.max(0, Math.min(100, (discountAmount / baseTotal) * 100)) : 0)
          }
          onDone={() => {
            loadBillboards().then(setBillboards).catch(() => {});
          }}
        />

        {/* تنبيه تغيير الأسعار المحفوظة */}
        <Dialog open={pricingAlertOpen} onOpenChange={setPricingAlertOpen}>
          <DialogContent className="max-w-md p-6 bg-card border border-border shadow-2xl rounded-xl" dir="rtl">
            <DialogHeader className="space-y-3 text-right">
              <DialogTitle className="flex items-center gap-2 text-xl font-bold text-amber-600">
                <Calculator className="h-6 w-6" />
                تحديث الأسعار وتغيير البيانات المحفوظة
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
                سيتم إعادة حساب وتحديث أسعار اللوحات في العقد بناءً على التغيير الجديد والأسعار الحالية في المنظومة. 
                الأسعار المحفوظة حالياً في العقد تم حسابها بالتفاصيل التالية:
              </DialogDescription>
            </DialogHeader>

            <div className="my-4 p-4 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-2 text-right text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">فئة التسعير المحفوظة:</span>
                <span className="font-semibold text-foreground">{currentContract?.customer_category || 'عادي'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">المدة المحفوظة:</span>
                <span className="font-semibold text-foreground">
                  {currentContract?.Duration || 
                   (currentContract?.pricing_mode === 'days' 
                     ? `${currentContract?.duration_days || 0} يوم` 
                     : `${currentContract?.duration_months || 0} شهر`
                   )}
                </span>
              </div>
              {savedBaseRent !== null && (
                <div className="flex justify-between border-t border-amber-500/10 pt-2 mt-2">
                  <span className="text-muted-foreground font-medium">إجمالي الإيجار الأساسي المحفوظ:</span>
                  <span className="font-bold text-amber-600">
                    {savedBaseRent.toLocaleString('ar-LY')} {getCurrencySymbol(contractCurrency)}
                  </span>
                </div>
              )}
            </div>

            <DialogFooter className="flex flex-row-reverse justify-end gap-2 mt-6">
              <Button
                variant="default"
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-4 py-2"
                onClick={() => {
                  if (pricingAlertPendingAction) {
                    pricingAlertPendingAction();
                  }
                  setPricingAlertOpen(false);
                }}
              >
                تحديث وإعادة الحساب
              </Button>
              <Button
                variant="outline"
                className="border-border hover:bg-muted text-foreground px-4 py-2"
                onClick={() => {
                  setPricingAlertOpen(false);
                  setPricingAlertPendingAction(null);
                }}
              >
                إلغاء التغيير
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmation dialog for billboards under maintenance */}
        <Dialog open={maintenanceConfirmOpen} onOpenChange={setMaintenanceConfirmOpen}>
          <DialogContent dir="rtl" className="max-w-md bg-card border border-border shadow-2xl rounded-xl">
            <DialogHeader className="space-y-3 text-right">
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-amber-500">
                <AlertTriangle className="h-6 w-6 text-amber-500" />
                تأكيد اختيار لوحة تحت الصيانة
              </DialogTitle>
              <div className="text-sm text-muted-foreground leading-relaxed mt-2">
                هذه اللوحة قيد الصيانة حالياً:
                <br /><br />
                - نوع الصيانة: <strong className="text-foreground">{(pendingMaintenanceBillboard as any)?.maintenance_type || 'غير محدد'}</strong>
                <br />
                - السبب: <strong className="text-foreground">{(pendingMaintenanceBillboard as any)?.maintenance_notes || 'غير محدد'}</strong>
                <br /><br />
                هل أنت متأكد من رغبتك في اختيار هذه اللوحة وإضافتها للعقد؟
              </div>
            </DialogHeader>
            <DialogFooter className="flex flex-row-reverse justify-end gap-2 mt-6">
              <Button 
                variant="default" 
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                onClick={handleConfirmMaintenanceSelect}
              >
                تأكيد الاختيار
              </Button>
              <Button variant="outline" className="border-border hover:bg-muted" onClick={() => {
                setMaintenanceConfirmOpen(false);
                setPendingMaintenanceBillboard(null);
              }}>
                إلغاء
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── حوار تحذير التأجير المزدوج ── */}
        <BillboardConflictDialog
          open={conflictDialogOpen}
          conflicts={conflictList}
          singleBillboardName={
            pendingConflictBillboard
              ? ((pendingConflictBillboard as any).Billboard_Name || (pendingConflictBillboard as any).name)
              : undefined
          }
          onConfirm={() => {
            if (pendingConflictBillboard) {
              const id = String((pendingConflictBillboard as any).ID);
              setSelected((prev) => [...prev, id]);
            }
            setConflictDialogOpen(false);
            setPendingConflictBillboard(null);
            setConflictList([]);
          }}
          onCancel={() => {
            setConflictDialogOpen(false);
            setPendingConflictBillboard(null);
            setConflictList([]);
          }}
        />
      </div>
    </div>
  );
}
