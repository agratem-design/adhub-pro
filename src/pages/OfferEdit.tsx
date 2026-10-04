import { usePricingDurations } from '@/hooks/usePricingDurations';
import { PricingSnapshotCard } from '@/components/contracts/edit/PricingSnapshotCard';
import { buildPricingSnapshot, parsePricingSnapshot, shouldRefreshSnapshot } from '@/utils/pricingSnapshot';
import { durationPrice, durationName, durationEnd } from '@/utils/pricingDuration';
// @ts-nocheck
import { isBillboardAvailable } from '@/utils/contractUtils';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { loadBillboards } from '@/services/billboardService';
import { smartArabicMatch } from '@/lib/arabicSearch';
import { sortBillboardsStandardSync } from '@/lib/billboardSorter';
import { useQuery } from '@tanstack/react-query';
import { calculateInstallationCostFromIds } from '@/services/installationService';
import { getPriceFor, getDailyPriceFor, CustomerType } from '@/data/pricing';
import { useContractPricing } from '@/hooks/useContractPricing';
import { calculateAllBillboardPrices } from '@/utils/contractBillboardPricing';
import { money } from '@/utils/contractEditMoney';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { Billboard } from '@/types';
import { ArrowLeft, Save, Map as MapIcon, Wrench, FileText, List, DollarSign, Printer, Trash2, RefreshCw, Calculator, AlertTriangle, Layers, Plus, Filter, ChevronDown } from 'lucide-react';
import { ContractEditHeader } from '@/components/contracts/edit/ContractEditHeader';
import { PendingChangesBanner } from '@/components/contracts/edit/PendingChangesBanner';
import { rescaleInstallmentsToTotal, installmentsMatchTotal } from '@/utils/rescaleInstallments';
import { getBillboardDimensions } from '@/lib/billboardDimensions';

// Import modular components (shared with contract edit)
import { SelectedBillboardsCard } from '@/components/contracts/edit/SelectedBillboardsCard';
import { PrintCostSummary } from '@/components/contracts/edit/PrintCostSummary';
import { BillboardFilters } from '@/components/contracts/edit/BillboardFilters';
import { AvailableBillboardsGrid } from '@/components/contracts/edit/AvailableBillboardsGrid';
import { CustomerInfoForm } from '@/components/contracts/edit/CustomerInfoForm';
import { ContractDatesForm } from '@/components/contracts/edit/ContractDatesForm';
import { InstallmentsManager } from '@/components/contracts/edit/InstallmentsManager';
import { LevelDiscountsCard } from '@/components/contracts/edit/LevelDiscountsCard';
import { CostSummaryCard } from '@/components/contracts/edit/CostSummaryCard';
import SelectableGoogleHomeMap from '@/components/Map/SelectableGoogleHomeMap';
import { ContractPDFDialog } from '@/components/Contract';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

export default function OfferEdit() {
  const navigate = useNavigate();
  // ✅ نفس تخطيط صفحة تعديل العقد
  const [workspaceSection, setWorkspaceSection] = useState<'basics' | 'boards' | 'catalog' | 'pricing'>('boards');
  const [boardsViewMode, setBoardsViewMode] = useState<'cards' | 'map' | 'split'>('cards');
  const [catalogFiltersCollapsed, setCatalogFiltersCollapsed] = useState(false);
  // ⚠️ لوحات أضيفت/أزيلت بعد تحميل العرض: يُمنع الحفظ حتى «معالجة التعديلات»
  const [billboardBaseline, setBillboardBaseline] = useState<{ ids: string[]; total: number } | null>(null);
  const { id: offerId } = useParams();
  const isEditing = Boolean(offerId);

  // Core state
  const [billboards, setBillboards] = useState<Billboard[]>([]);
  // ✅ Cross-check active contracts (source of truth) — same pattern as ContractEditModular
  const [occupiedBillboardIds, setOccupiedBillboardIds] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentOffer, setCurrentOffer] = useState<any>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const selectedBillboardsSet = useMemo(() => new Set(selected), [selected]);
  const [singleFaceBillboards, setSingleFaceBillboards] = useState<Set<string>>(new Set());
  const [individualDiscounts, setIndividualDiscounts] = useState<Record<string, { value: number; type: 'amount' | 'percent' }>>({});
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfContractData, setPdfContractData] = useState<any>(null);

  // Customer data
  const [customers, setCustomers] = useState<{ id: string; name: string; company?: string; phone?: string }[]>([]);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerCompany, setCustomerCompany] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [adType, setAdType] = useState('');

  // Pricing
  const pricing = useContractPricing();
  const [pricingCategories, setPricingCategories] = useState<string[]>([]);
  const [pricingCategory, setPricingCategory] = useState<string>('عادي');

  // Installation and operating costs
  const [installationCost, setInstallationCost] = useState<number>(0);
  const [installationEnabled, setInstallationEnabled] = useState<boolean>(true);
  const [installationDetails, setInstallationDetails] = useState<Array<{
    billboardId: string; billboardName: string; size: string;
    installationPrice: number; faces?: number; adjustedPrice?: number;
  }>>([]);
  const [operatingFee, setOperatingFee] = useState<number>(0);

  // Filters - default to 'all' to show all billboards
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [municipalityFilter, setMunicipalityFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [sizeFilters, setSizeFilters] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Dates & pricing
  const [startDate, setStartDate] = useState('');
  const [pricingMode, setPricingMode] = useState<'months' | 'days'>('months');
  const { data: durations } = usePricingDurations();
  const [durationMonths, setDurationMonths] = useState<number>(3);
  const [durationDays, setDurationDays] = useState<number>(0);
  const [use30DayMonth, setUse30DayMonth] = useState<boolean>(true);
  const [endDate, setEndDate] = useState('');
  const [rentCost, setRentCost] = useState<number>(0);
  const [userEditedRentCost, setUserEditedRentCost] = useState(false);
  const [originalTotal, setOriginalTotal] = useState<number>(0);
  const [savedBaseRent, setSavedBaseRent] = useState<number | null>(null);
  const [useStoredPrices, setUseStoredPrices] = useState<boolean>(false);
  const [refreshingPrices, setRefreshingPrices] = useState(false);
  const [maintenanceConfirmOpen, setMaintenanceConfirmOpen] = useState(false);
  const [pendingMaintenanceBillboard, setPendingMaintenanceBillboard] = useState<Billboard | null>(null);
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [discountValue, setDiscountValue] = useState<number>(0);

  // Level-based discounts
  const [levelDiscounts, setLevelDiscounts] = useState<Record<string, number>>({});

  // Installments
  const [installments, setInstallments] = useState<Array<{
    amount: number; paymentType: string; description: string; dueDate: string;
  }>>([]);
  const [installmentsLoaded, setInstallmentsLoaded] = useState<boolean>(false);
  const [installmentDistributionType, setInstallmentDistributionType] = useState<'single' | 'multiple' | 'periods'>('multiple');
  const [installmentFirstPaymentAmount, setInstallmentFirstPaymentAmount] = useState<number>(0);
  const [installmentFirstPaymentType, setInstallmentFirstPaymentType] = useState<'amount' | 'percent'>('amount');
  const [installmentInterval, setInstallmentInterval] = useState<'month' | '2months' | '3months' | '4months' | '5months' | '6months' | '7months'>('month');
  const [installmentCount, setInstallmentCount] = useState<number>(2);
  const [installmentAutoCalculate, setInstallmentAutoCalculate] = useState<boolean>(false);
  const [installmentFirstAtSigning, setInstallmentFirstAtSigning] = useState<boolean>(true);
  const [hasDifferentFirstPayment, setHasDifferentFirstPayment] = useState<boolean>(false);

  // Friend company costs
  const [friendBillboardCosts, setFriendBillboardCosts] = useState<Array<{
    billboardId: string; friendCompanyId: string; friendCompanyName: string; friendRentalCost: number;
  }>>([]);

  // Print cost
  const [printCostEnabled, setPrintCostEnabled] = useState<boolean>(false);
  const [printPricePerMeter, setPrintPricePerMeter] = useState<number>(0);
  const [customPrintCosts, setCustomPrintCosts] = useState<Map<string, number>>(new Map());

  const { data: dbSizesData = [] } = useQuery({
    queryKey: ['offer-edit-sizes-sorting'],
    queryFn: async () => {
      const { data } = await supabase.from('sizes').select('id, name, width, height, sort_order').order('sort_order', { ascending: true });
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const sizeDimensionsMap = useMemo(() => {
    const map = new Map<string | number, { width: number; height: number }>();
    dbSizesData.forEach((s: any) => {
      const w = Number(s.width) || 0;
      const h = Number(s.height) || 0;
      if (w > 0 && h > 0) {
        map.set(s.id, { width: w, height: h });
        map.set(Number(s.id), { width: w, height: h });
        map.set(String(s.id), { width: w, height: h });
        map.set(s.name, { width: w, height: h });
        map.set(String(s.name).toLowerCase(), { width: w, height: h });
      }
    });
    return map;
  }, [dbSizesData]);

  // Include in price toggles
  const [includeInstallationInPrice, setIncludeInstallationInPrice] = useState<boolean>(true);
  const [includePrintInPrice, setIncludePrintInPrice] = useState<boolean>(false);

  // ========== LOAD DATA ==========

  // Load billboards + occupied set from active contracts (cross-check, like ContractEditModular)
  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const [data, contractsResult] = await Promise.all([
          loadBillboards(),
          supabase.from('Contract').select('Contract_Number, billboard_ids, "End Date"').gte('End Date', today),
        ]);
        setBillboards(data);

        const occupied = new Map<number, string>();
        if (contractsResult.data) {
          for (const c of contractsResult.data as any[]) {
            const ids = c.billboard_ids;
            if (ids && typeof ids === 'string') {
              ids.split(',').forEach((id: string) => {
                const n = parseInt(String(id).trim(), 10);
                if (!isNaN(n)) occupied.set(n, c['End Date'] as string);
              });
            }
          }
        }
        setOccupiedBillboardIds(occupied);
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || 'فشل تحميل اللوحات');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load customers
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from('customers').select('id,name,company,phone').order('name', { ascending: true });
        if (!error && Array.isArray(data)) setCustomers(data);
      } catch (e) { console.warn('load customers failed'); }
    })();
  }, []);

  // Load pricing categories
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from('pricing_categories').select('name').order('name', { ascending: true });
        if (!error && Array.isArray(data)) {
          const categories = data.map((item: any) => item.name);
          const staticCategories = ['عادي', 'مسوق', 'شركات'];
          setPricingCategories(Array.from(new Set([...staticCategories, ...categories])));
        } else {
          setPricingCategories(['عادي', 'مسوق', 'شركات']);
        }
      } catch (e) {
        setPricingCategories(['عادي', 'مسوق', 'شركات']);
      }
    })();
  }, []);

  // Load offer data when editing
  useEffect(() => {
    if (!offerId) return;
    (async () => {
      try {
        const { data: offer, error } = await supabase
          .from('offers')
          .select('*')
          .eq('id', offerId)
          .single();
        if (error) throw error;
        if (!offer) return;

        setCurrentOffer(offer);
        setCustomerName(offer.customer_name || '');
        setCustomerId(offer.customer_id || null);
        setAdType(offer.ad_type || '');
        setPricingCategory(offer.pricing_category || 'عادي');

        const s = offer.start_date || '';
        const e = offer.end_date || '';
        setUse30DayMonth((offer as any).use_30_day_month ?? true);
        setStartDate(s);
        setEndDate(e);

        if (offer.duration_months > 0) {
          setPricingMode('months'); setDurationMonths(Number(offer.duration_months));
        } else if (s && e) {
          const sd = new Date(s);
          const ed = new Date(e);
          if (!isNaN(sd.getTime()) && !isNaN(ed.getTime())) {
            const diffDays = Math.ceil(Math.abs(ed.getTime() - sd.getTime()) / (1000 * 60 * 60 * 24));
            const diffMonths = Math.round(diffDays / 30);
            if (diffMonths >= 1) { setPricingMode('months'); setDurationMonths(diffMonths); }
            else { setPricingMode('days'); setDurationDays(diffDays); }
          }
        }

        // Total/discount
        let calculatedBaseRent = 0;
        const indDiscounts: Record<string, { value: number; type: 'amount' | 'percent' }> = {};
        if (offer.billboard_prices) {
          try {
            const prices = typeof offer.billboard_prices === 'string' 
              ? JSON.parse(offer.billboard_prices)
              : offer.billboard_prices;
            if (Array.isArray(prices)) {
              prices.forEach((bp: any) => {
                const basePrice = bp.basePriceBeforeDiscount ?? bp.baseRental ?? bp.contractPrice ?? 0;
                calculatedBaseRent += Number(basePrice);
                const bId = String(bp.billboardId || bp.billboard_id || '');
                if (bId && bp.individualDiscountValue !== undefined && bp.individualDiscountValue !== null && Number(bp.individualDiscountValue) > 0) {
                  indDiscounts[bId] = {
                    value: Number(bp.individualDiscountValue) || 0,
                    type: bp.individualDiscountType === 'percent' ? 'percent' : 'amount'
                  };
                }
              });
            }
          } catch (e) {
            console.warn('Failed to calculate savedBaseRent from billboard_prices:', e);
          }
        }
        if ((offer as any).individual_discounts) {
          try {
            const parsed = typeof (offer as any).individual_discounts === 'string'
              ? JSON.parse((offer as any).individual_discounts)
              : (offer as any).individual_discounts;
            if (parsed && typeof parsed === 'object') {
              Object.assign(indDiscounts, parsed);
            }
          } catch (e) {
            console.warn('Failed to parse individual_discounts:', e);
          }
        }
        setIndividualDiscounts(indDiscounts);

        const savedTotal = Number(offer.total || 0);
        if (calculatedBaseRent > 0) {
          setSavedBaseRent(calculatedBaseRent);
          setRentCost(calculatedBaseRent);
          setOriginalTotal(savedTotal);
          console.log('✅ Loaded savedBaseRent from offer billboard_prices:', calculatedBaseRent);
        } else {
          setRentCost(savedTotal);
          setOriginalTotal(savedTotal);
        }
        // ✅ مثل تعديل العقد: يفتح العرض على أسعاره المحفوظة حتى لا يتغير إجماليه بمجرد فتحه.
        //    زر «إعادة الاحتساب» يحدّث الأسعار من الجدول الحالي عند الحاجة.
        setUseStoredPrices(calculatedBaseRent > 0);

        // الخصم العام: العروض الجديدة تحفظ في discount الخصم العام فقط. العروض القديمة كانت تحفظ فيه
        // (العام + الفردي + المستوى) فنستخرج الخصم العام من نصيب اللوحات المحفوظ حتى لا يُحسب الخصم الفردي مرتين.
        let savedPriceRows: any[] = [];
        try {
          const raw = typeof offer.billboard_prices === 'string' ? JSON.parse(offer.billboard_prices) : offer.billboard_prices;
          savedPriceRows = Array.isArray(raw) ? raw : [];
        } catch { savedPriceRows = []; }
        const isNewSchema = savedPriceRows.some((r: any) => r && 'levelDiscountPercent' in r);
        let disc = Number(offer.discount ?? 0);
        if (!isNewSchema && savedPriceRows.length > 0) {
          if (savedPriceRows.some((r: any) => r?.discountPerBillboard != null)) {
            disc = savedPriceRows.reduce((sum: number, r: any) => sum + Number(r?.discountPerBillboard || 0), 0);
          } else {
            disc = Math.max(0, disc - savedPriceRows.reduce((sum: number, r: any) => sum + Number(r?.individualDiscountAmt || 0), 0));
          }
        }
        if (Number.isFinite(disc) && disc > 0) {
          setDiscountType('amount');
          setDiscountValue(Math.round(disc * 100) / 100);
        }
        // تخفيض المستوى في العروض القديمة مدموج في الخصم العام أعلاه، فلا نُحمّله منفصلاً
        if (!isNewSchema) (offer as any).level_discounts = null;

        // Installation
        setInstallationEnabled(offer.installation_enabled !== false);
        setInstallationCost(Number(offer.installation_cost || 0));
        setIncludeInstallationInPrice(offer.include_installation_in_price !== false);

        // Print
        setPrintCostEnabled(Boolean(offer.print_cost_enabled));
        setPrintPricePerMeter(Number(offer.print_price_per_meter || 0));
        setIncludePrintInPrice(Boolean(offer.include_print_in_billboard_price));

        // Operating
        setOperatingFee(Number(offer.operating_fee || 0));

        // Selected billboards
        if (offer.billboards_data) {
          try {
            const bbs = typeof offer.billboards_data === 'string' ? JSON.parse(offer.billboards_data) : offer.billboards_data;
            if (Array.isArray(bbs)) setSelected(bbs.map((b: any) => String(b.id || b.ID)));
          } catch (e) { console.warn('Failed to parse billboards_data'); }
        }

        // Installments
        if (offer.installments_data) {
          try {
            const inst = typeof offer.installments_data === 'string' ? JSON.parse(offer.installments_data) : offer.installments_data;
            if (Array.isArray(inst)) {
              setInstallments(inst);
              setInstallmentsLoaded(true);
            }
          } catch (e) { console.warn('Failed to parse installments_data'); }
        }

        // Load installment distribution settings from DB
        const savedDistributionType = offer.installment_distribution_type || 'multiple';
        const savedFirstPaymentAmount = Number(offer.installment_first_payment_amount || 0);
        const savedFirstPaymentType = offer.installment_first_payment_type || 'amount';
        const savedInterval = offer.installment_interval || 'month';
        const savedCount = Number(offer.installment_count || 2);
        const savedAutoCalculate = offer.installment_auto_calculate === true;
        const savedFirstAtSigning = offer.installment_first_at_signing !== false; // default true
        
        setInstallmentDistributionType(savedDistributionType as 'single' | 'multiple' | 'periods');
        setInstallmentFirstPaymentAmount(savedFirstPaymentAmount);
        setInstallmentFirstPaymentType(savedFirstPaymentType as 'amount' | 'percent');
        setInstallmentInterval(savedInterval as 'month' | '2months' | '3months' | '4months' | '5months' | '6months' | '7months');
        setInstallmentCount(savedCount);
        setInstallmentAutoCalculate(savedAutoCalculate);
        setInstallmentFirstAtSigning(savedFirstAtSigning);
        setHasDifferentFirstPayment(savedFirstPaymentAmount > 0);

        // Single face billboards
        if (offer.single_face_billboards) {
          try {
            const ids = typeof offer.single_face_billboards === 'string' ? JSON.parse(offer.single_face_billboards) : offer.single_face_billboards;
            if (Array.isArray(ids)) setSingleFaceBillboards(new Set(ids.map(String)));
          } catch (e) { console.warn('Failed to parse single_face_billboards'); }
        }

        // Installation details
        if (offer.installation_details) {
          try {
            const details = typeof offer.installation_details === 'string' ? JSON.parse(offer.installation_details) : offer.installation_details;
            if (Array.isArray(details)) setInstallationDetails(details);
          } catch (e) { console.warn('Failed to parse installation_details'); }
        }

        // Level discounts
        const savedLevelDiscounts = offer.level_discounts;
        if (savedLevelDiscounts && typeof savedLevelDiscounts === 'object') {
          setLevelDiscounts(savedLevelDiscounts as Record<string, number>);
        }

      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || 'تعذر تحميل العرض');
      }
    })();
  }, [offerId]);

  // ========== CALCULATIONS ==========

  // Calculate installation cost
  useEffect(() => {
    if (selected.length > 0) {
      (async () => {
        try {
          const result = await calculateInstallationCostFromIds(selected);
          setInstallationCost(result.totalInstallationCost);
          setInstallationDetails(result.installationDetails);
        } catch (e) {
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
      end.setTime(durationEnd(startDate, durationMonths, use30DayMonth, durations).getTime());
    } else {
      end.setDate(end.getDate() + Math.max(0, Number(durationDays || 0)));
    }
    setEndDate(end.toISOString().split('T')[0]);
  }, [startDate, durationMonths, durationDays, pricingMode, use30DayMonth, durations]);

  // ✅ NEW: Get stored price from offer's billboard_prices data
  const getStoredPriceFromOffer = (billboardId: string): number | null => {
    if (!currentOffer?.billboard_prices) return null;
    
    try {
      const billboardPrices = typeof currentOffer.billboard_prices === 'string' 
        ? JSON.parse(currentOffer.billboard_prices)
        : currentOffer.billboard_prices;
      
      // ✅ SAFE LOOKUP
      const storedPrice = billboardPrices.find((bp: any) => 
        String(bp.billboardId || bp.billboard_id || '') === String(billboardId)
      );
      if (!storedPrice) return null;

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

  // Calculate billboard price
  const calculateBillboardPrice = useCallback((billboard: Billboard): number => {
    const billboardId = String((billboard as any).ID);
    
    // ✅ ONLY use stored prices if user explicitly chose to
    if (useStoredPrices) {
      const storedPrice = getStoredPriceFromOffer(billboardId);
      if (storedPrice !== null && storedPrice > 0) {
        return storedPrice;
      }
    }
    
    let price = pricing.calculateBillboardPrice(billboard, pricingMode, durationMonths, durationDays, pricingCategory);
    if (!price || price === 0) {
      const bp = Number((billboard as any).Price || (billboard as any).price || 0);
      if (bp > 0) {
        price = pricingMode === 'months' ? bp * Math.max(1, durationMonths) : Math.round((bp / 30) * durationDays);
      }
    }
    return price || 0;
  }, [useStoredPrices, currentOffer, pricingMode, durationMonths, durationDays, pricingCategory, pricing.pricingData, durations]);

  // ✅ تحديث فوري وإعادة احتساب عند تغيير معايير التسعير
  const handlePricingCategoryChange = (newVal: string) => {
    if (newVal === pricingCategory) return;
    setPricingCategory(newVal);
    setInstallmentsLoaded(false);
    if (useStoredPrices) {
      setUseStoredPrices(false);
      toast.info('تم تحديث فئة التسعير وإعادة احتساب الأسعار');
    }
  };

  const handlePricingModeChange = (newVal: 'months' | 'days') => {
    if (newVal === pricingMode) return;
    setPricingMode(newVal);
    setInstallmentsLoaded(false);
    if (useStoredPrices) {
      setUseStoredPrices(false);
      toast.info('تم تحديث نوع المدة وإعادة احتساب الأسعار');
    }
  };

  const handleDurationMonthsChange = (newVal: number) => {
    if (newVal === durationMonths) return;
    setDurationMonths(newVal);
    setInstallmentsLoaded(false);
    if (useStoredPrices) {
      setUseStoredPrices(false);
      toast.info('تم تحديث المدة وإعادة احتساب الأسعار');
    }
  };

  const handleDurationDaysChange = (newVal: number) => {
    if (newVal === durationDays) return;
    setDurationDays(newVal);
    setInstallmentsLoaded(false);
    if (useStoredPrices) {
      setUseStoredPrices(false);
      toast.info('تم تحديث عدد الأيام وإعادة احتساب الأسعار');
    }
  };

  const handleUse30DayMonthChange = (newVal: boolean) => {
    if (newVal === use30DayMonth) return;
    setUse30DayMonth(newVal);
    setInstallmentsLoaded(false);
    if (useStoredPrices) {
      setUseStoredPrices(false);
      toast.info('تم تحديث إعدادات الشهر وإعادة احتساب الأسعار');
    }
  };

  // ✅ إعادة احتساب شاملة للعرض بالكامل من جديد وفق جدول التسعير الحالي
  const handleRecalculateAll = async () => {
    setRefreshingPrices(true);
    try {
      setUseStoredPrices(false);
      setUserEditedRentCost(false);
      setInstallmentsLoaded(false);

      if (selected.length > 0) {
        try {
          const result = await calculateInstallationCostFromIds(selected);
          setInstallationCost(result.totalInstallationCost);
          setInstallationDetails(result.installationDetails);
        } catch (e) {
          console.warn('Failed to recalc installation:', e);
        }
      }

      toast.success('تمت إعادة احتساب أسعار وتكاليف العرض بالكامل من جديد وفق جدول التسعير الحالي');
    } finally {
      setRefreshingPrices(false);
    }
  };

  const handleRefreshPricesFromTable = () => {
    handleRecalculateAll();
  };

  // ✅ Estimated total - ديناميكي تماماً ومحسوب من مجموع اللوحات المختارة فعلياً
  const estimatedTotal = useMemo(() => {
    const sel = billboards.filter((b) => selected.includes(String((b as any).ID)));
    if (sel.length === 0) return 0;
    return sel.reduce((acc, b) => acc + calculateBillboardPrice(b), 0);
  }, [billboards, selected, calculateBillboardPrice]);

  // السعر المحسوب دائماً من جدول التسعير الحالي (للمقارنة مع المحفوظ إن وجد)
  const calculatedEstimatedTotal = useMemo(() => {
    const sel = billboards.filter((b) => selected.includes(String((b as any).ID)));
    if (sel.length === 0) return 0;
    return sel.reduce((acc, b) => {
      let p = pricing.calculateBillboardPrice(b, pricingMode, durationMonths, durationDays, pricingCategory);
      if (!p || p === 0) {
        const bp = Number((b as any).Price || (b as any).price || 0);
        if (bp > 0) {
          p = pricingMode === 'months' ? bp * Math.max(1, durationMonths) : Math.round((bp / 30) * durationDays);
        }
      }
      return acc + (p || 0);
    }, 0);
  }, [billboards, selected, pricingMode, durationMonths, durationDays, pricingCategory, pricing.pricingData]);

  const baseTotal = useMemo(() => {
    if (userEditedRentCost && rentCost > 0) return rentCost;
    return estimatedTotal;
  }, [rentCost, estimatedTotal, userEditedRentCost]);

  useEffect(() => {
    if (!userEditedRentCost) setRentCost(estimatedTotal);
  }, [estimatedTotal, userEditedRentCost]);

  // Level discount total
  const totalLevelDiscountAmount = useMemo(() => {
    if (Object.keys(levelDiscounts).length === 0) return 0;
    const sel = billboards.filter((b) => selected.includes(String((b as any).ID)));
    let total = 0;
    sel.forEach((b) => {
      const level = (b as any).Level || (b as any).level || '';
      const discountPercent = levelDiscounts[level] || 0;
      if (discountPercent > 0) {
        total += calculateBillboardPrice(b) * (discountPercent / 100);
      }
    });
    return total;
  }, [billboards, selected, levelDiscounts, calculateBillboardPrice]);

  // General discount before individual discounts

  // Print cost details
  const printCostDetails = useMemo(() => {
    if (!printCostEnabled || !printPricePerMeter) return [];
    const sel = billboards.filter((b) => selected.includes(String((b as any).ID)));
    const detailsMap = new Map();
    sel.forEach((b) => {
      const id = String((b as any).ID);
      const isSingle = singleFaceBillboards.has(id);
      const size = ((b as any).Size || (b as any).size || '') as string;
      const rawFaces = Number((b as any).Faces_Count || (b as any).faces_count || (b as any).faces || 2);
      const faces = isSingle ? 1 : rawFaces;
      const dims = getBillboardDimensions(b, sizeDimensionsMap);
      if (dims.area <= 0) return;
      const areaPerFace = dims.area;
      const areaPerBoard = dims.area * faces;
      const customUnitCost = customPrintCosts.get(size);
      const unitCost = customUnitCost ? (isSingle ? customUnitCost / 2 : customUnitCost) : (areaPerBoard * printPricePerMeter);
      const key = `${size}_${faces}faces`;
      if (detailsMap.has(key)) {
        const existing = detailsMap.get(key)!;
        existing.count += 1;
        existing.quantity += 1;
        existing.totalArea += areaPerBoard;
        existing.totalCost += unitCost;
      } else {
        detailsMap.set(key, {
          size,
          faces,
          area: areaPerFace,
          areaPerBoard,
          count: 1,
          quantity: 1,
          totalArea: areaPerBoard,
          unitCost,
          totalCost: unitCost,
        });
      }
    });
    return Array.from(detailsMap.values()).sort((a, b) => b.totalCost - a.totalCost);
  }, [billboards, selected, singleFaceBillboards, printCostEnabled, printPricePerMeter, customPrintCosts, sizeDimensionsMap]);

  const totalPrintCost = useMemo(() => printCostDetails.reduce((sum, d) => sum + d.totalCost, 0), [printCostDetails]);

  // ✅ Per-billboard print cost details for SelectedBillboardsCard
  const perBillboardPrintCosts = useMemo(() => {
    if (!printCostEnabled || !printPricePerMeter) return [];
    const sel = billboards.filter((b) => selected.includes(String((b as any).ID)));
    return sel.map((b) => {
      const size = ((b as any).Size || (b as any).size || '') as string;
      const rawFaces = Number((b as any).Faces_Count || (b as any).faces_count || (b as any).faces || 2);
      const dims = getBillboardDimensions(b, sizeDimensionsMap);
      if (dims.area <= 0) return { billboardId: String((b as any).ID), printCost: 0 };
      const areaPerBoard = dims.area * rawFaces;
      const customUnitCost = customPrintCosts.get(size);
      const printCost = customUnitCost || (areaPerBoard * printPricePerMeter);
      return { billboardId: String((b as any).ID), printCost };
    });
  }, [billboards, selected, printCostEnabled, printPricePerMeter, customPrintCosts, sizeDimensionsMap]);

  // ✅ مدخلات التسعير الموحد (نفس منطق تعديل العقد) — مصدر واحد للعرض والحفظ والطباعة
  const offerPricingInputs = useMemo(() => selected
    .map((id) => {
      const bb = billboards.find((b) => String((b as any).ID) === id);
      if (!bb) return null;
      const installRaw = installationDetails.find((d) => d.billboardId === id)?.installationPrice || 0;
      const origFaces = Number((bb as any).Faces_Count ?? (bb as any).faces_count ?? (bb as any).faces ?? 2);
      // perBillboardPrintCosts محسوبة بعدد الأوجه الفعلي؛ اللوحة ذات الوجه الواحد تُضاعف هنا لأن الحساب الموحد ينصّفها (نفس منطق تعديل العقد)
      const printRaw = (perBillboardPrintCosts.find((d) => d.billboardId === id)?.printCost || 0) * (origFaces === 1 ? 2 : 1);
      const indDiscount = individualDiscounts[id];
      return {
        billboardId: id,
        baseRentalPrice: calculateBillboardPrice(bb),
        installationPrice: installRaw,
        printCost: printRaw,
        isSingleFace: origFaces === 1 || singleFaceBillboards.has(id),
        individualDiscountValue: indDiscount?.value,
        individualDiscountType: indDiscount?.type,
        levelDiscountPercent: Number(levelDiscounts[String((bb as any).Level || (bb as any).level || '')] || 0),
      };
    })
    .filter(Boolean) as any[], [selected, billboards, installationDetails, perBillboardPrintCosts, calculateBillboardPrice,
    singleFaceBillboards, individualDiscounts, levelDiscounts]);

  const offerPricingOptions = { printCostEnabled, includePrintInPrice, installationEnabled, includeInstallationInPrice };

  // قاعدة الخصم العام = صافي الإيجار بعد الخصم الفردي وتخفيض المستوى ودون التركيب/الطباعة المضمّنة (مثل العقد)
  const offerDiscountBase = useMemo(() => money(calculateAllBillboardPrices(offerPricingInputs, { totalDiscount: 0, ...offerPricingOptions })
    .reduce((sum, row) => sum + row.netRentalBeforeDiscount, 0)),
    [offerPricingInputs, printCostEnabled, includePrintInPrice, installationEnabled, includeInstallationInPrice]);

  const requestedGeneralDiscount = money(!discountValue ? 0 : discountType === 'percent'
    ? offerDiscountBase * Math.max(0, Math.min(100, discountValue)) / 100
    : Math.max(0, discountValue));
  const generalDiscountAmount = Math.min(requestedGeneralDiscount, offerDiscountBase);
  const generalDiscountExceedsBase = requestedGeneralDiscount > offerDiscountBase + 0.005;

  const unifiedPricingByBillboard = useMemo(() => {
    const results = calculateAllBillboardPrices(offerPricingInputs, { totalDiscount: generalDiscountAmount, ...offerPricingOptions });
    return new Map(results.map((r) => [r.billboardId, r]));
  }, [offerPricingInputs, generalDiscountAmount, printCostEnabled, includePrintInPrice, installationEnabled, includeInstallationInPrice]);

  // صفوف أسعار اللوحات المحفوظة/المطبوعة — نفس أرقام الكروت بالضبط
  const offerBillboardPriceRows = useMemo(() => Array.from(unifiedPricingByBillboard.values()).map((r) => ({
    billboardId: r.billboardId,
    schemaVersion: 2,
    basePriceBeforeDiscount: r.baseRentalPrice,
    baseRental: r.baseRentalPrice,
    contractPrice: r.baseRentalPrice,
    priceBeforeDiscount: money(r.baseRentalPrice + r.extraPrintCost + r.extraInstallCost),
    netRentalBeforeDiscount: money(r.netRentalBeforeDiscount),
    discountPerBillboard: money(r.discountPerBillboard),
    individualDiscountValue: individualDiscounts[r.billboardId]?.value || 0,
    individualDiscountType: individualDiscounts[r.billboardId]?.type || 'amount',
    individualDiscountAmt: money(r.individualDiscountAmt || 0),
    levelDiscountPercent: Number(offerPricingInputs.find((i: any) => i.billboardId === r.billboardId)?.levelDiscountPercent || 0),
    levelDiscountAmt: money(r.levelDiscountAmt || 0),
    netRentalAfterDiscount: money(r.netRentalAfterDiscount),
    printCost: printCostEnabled ? r.printCost : 0,
    installationCost: installationEnabled ? r.installationPrice : 0,
    includedPrintCost: r.includedPrintCost,
    includedInstallCost: r.includedInstallCost,
    isSingleFace: !!offerPricingInputs.find((i: any) => i.billboardId === r.billboardId)?.isSingleFace,
    priceAfterDiscount: money(r.totalForBoard),
    finalPrice: money(r.totalForBoard),
    totalBillboardPrice: money(r.totalForBoard),
  })), [unifiedPricingByBillboard, individualDiscounts, offerPricingInputs, printCostEnabled, installationEnabled]);

  const handleUpdatePrintUnitCost = (size: string, newCost: number) => {
    setInstallmentsLoaded(false);
    setUserEditedRentCost(false);
    if (useStoredPrices) setUseStoredPrices(false);
    setCustomPrintCosts(prev => { const m = new Map(prev); m.set(size, newCost); return m; });
  };

  const combinedServiceTotals = useMemo(() => {
    let installRaw = 0, printRaw = 0;
    let includedInstall = 0, includedPrint = 0;
    let extraInstall = 0, extraPrint = 0;
    let totalIndividualDiscount = 0;
    unifiedPricingByBillboard.forEach((r: any) => {
      installRaw += Number(r.installationPrice || 0);
      printRaw += Number(r.printCost || 0);
      includedInstall += Number(r.includedInstallCost || 0);
      includedPrint += Number(r.includedPrintCost || 0);
      extraInstall += Number(r.extraInstallCost || 0);
      extraPrint += Number(r.extraPrintCost || 0);
      totalIndividualDiscount += Number(r.individualDiscountAmt || 0);
    });
    return { installRaw, printRaw, includedInstall, includedPrint, extraInstall, extraPrint, totalIndividualDiscount };
  }, [unifiedPricingByBillboard]);

  const includedInstallationCost = useMemo(() => {
    return (installationEnabled && includeInstallationInPrice) ? combinedServiceTotals.includedInstall : 0;
  }, [installationEnabled, includeInstallationInPrice, combinedServiceTotals.includedInstall]);

  const includedPrintCost = useMemo(() => {
    return (printCostEnabled && includePrintInPrice) ? combinedServiceTotals.includedPrint : 0;
  }, [printCostEnabled, includePrintInPrice, combinedServiceTotals.includedPrint]);

  const extraInstallationChargedToCustomer = useMemo(() => {
    return (installationEnabled && !includeInstallationInPrice) ? combinedServiceTotals.extraInstall : 0;
  }, [installationEnabled, includeInstallationInPrice, combinedServiceTotals.extraInstall]);

  const extraPrintChargedToCustomer = useMemo(() => {
    return (printCostEnabled && !includePrintInPrice) ? combinedServiceTotals.extraPrint : 0;
  }, [printCostEnabled, includePrintInPrice, combinedServiceTotals.extraPrint]);

  const actualInstallationCost = useMemo(() => installationEnabled ? combinedServiceTotals.installRaw : 0, [installationEnabled, combinedServiceTotals.installRaw]);
  const actualPrintCost = useMemo(() => printCostEnabled ? combinedServiceTotals.printRaw : 0, [printCostEnabled, combinedServiceTotals.printRaw]);

  const discountAmount = useMemo(() => {
    return generalDiscountAmount + combinedServiceTotals.totalIndividualDiscount;
  }, [generalDiscountAmount, combinedServiceTotals.totalIndividualDiscount]);

  // الإجمالي = مجموع أسعار اللوحات النهائية (نفس الكروت والحفظ والطباعة)
  const finalTotal = useMemo(() => money(Array.from(unifiedPricingByBillboard.values())
    .reduce((sum, row) => sum + row.totalForBoard, 0)), [unifiedPricingByBillboard]);

  // صافي الإيجار = الإجمالي ناقص تكاليف التركيب والطباعة (مضمّنة أو إضافية)
  const rentalCostOnly = useMemo(() => Math.max(0, money(finalTotal - actualInstallationCost - actualPrintCost)),
    [finalTotal, actualInstallationCost, actualPrintCost]);

  // Grouped installation cost summary like ContractEdit
  const installationCostSummary = useMemo(() => {
    if (selected.length === 0) return null;
    const totalInstallationCost = installationDetails.reduce((sum, detail) => {
      const isSingle = singleFaceBillboards.has(detail.billboardId);
      const price = (detail.installationPrice || 0) / (isSingle ? 2 : 1);
      return sum + price;
    }, 0);
    const groupedDetails = installationDetails.reduce((groups: any, detail) => {
      const isSingle = singleFaceBillboards.has(detail.billboardId);
      const price = (detail.installationPrice || 0) / (isSingle ? 2 : 1);
      const key = `${detail.size}_${isSingle ? 'single' : 'double'}`;
      if (!groups[key]) {
        groups[key] = {
          size: `${detail.size}${isSingle ? ' (وجه واحد)' : ''}`,
          pricePerUnit: price,
          count: 0,
          totalForSize: 0,
        };
      }
      groups[key].count += 1;
      groups[key].totalForSize += price;
      return groups;
    }, {});
    return { totalInstallationCost, groupedSizes: Object.values(groupedDetails) };
  }, [selected.length, installationDetails, singleFaceBillboards]);

  // Operating fee
  useEffect(() => {
    // نسبة التشغيل على صافي الإيجار فقط (بدون تركيب وطباعة) — نفس قاعدة العقد
    const fee = Math.round(Math.max(0, rentalCostOnly) * 0.03 * 100) / 100;
    setOperatingFee(fee);
  }, [rentalCostOnly]);

  // Auto-create installments
  useEffect(() => {
    if (installmentsLoaded) return;
    if (installments.length === 0 && finalTotal > 0) {
      const half = Math.round((finalTotal / 2) * 100) / 100;
      setInstallments([
        { amount: half, paymentType: 'عند التوقيع', description: 'الدفعة الأولى', dueDate: startDate || '' },
        { amount: finalTotal - half, paymentType: 'شهري', description: 'الدفعة الثانية', dueDate: calculateDueDate('شهري', 1) },
      ]);
    }
  }, [finalTotal, installmentsLoaded]);

  // ========== FILTER BILLBOARDS - SHOW ALL ==========

  const cities = useMemo(() => Array.from(new Set(billboards.map(b => (b as any).city || (b as any).City))).filter(Boolean).sort() as string[], [billboards]);
  const municipalities = useMemo(() => {
    const base = Array.from(new Set(billboards.map(b => (b as any).municipality || (b as any).Municipality))).filter(Boolean).sort() as string[];
    // Filter municipalities by selected city
    if (cityFilter !== 'all') {
      const cityBillboards = billboards.filter(b => ((b as any).city || (b as any).City) === cityFilter);
      return Array.from(new Set(cityBillboards.map(b => (b as any).municipality || (b as any).Municipality))).filter(Boolean).sort() as string[];
    }
    return base;
  }, [billboards, cityFilter]);
  const sizes = useMemo(() => Array.from(new Set(billboards.map(b => String((b as any).Size || (b as any).size || '').trim()))).filter(Boolean).sort() as string[], [billboards]);

  // Helper: check if billboard is near expiry (uses occupied map's End Date as fallback)
  const isNearExpiring = (b: any): boolean => {
    const id = Number(b.ID ?? b.id);
    const endDate = b.Rent_End_Date || b.rent_end_date || b.rentEndDate || occupiedBillboardIds.get(id) || '';
    if (!endDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    if (isNaN(end.getTime())) return false;
    const diff = Math.ceil((end.getTime() - today.getTime()) / 86400000);
    return diff > 0 && diff <= 30;
  };

  // ✅ Effective availability: cross-checks active contracts table, not just stored Status
  const isAvailableEffective = (b: any): boolean => {
    const id = Number(b.ID ?? b.id);
    if (occupiedBillboardIds.has(id)) return false;
    return isBillboardAvailable(b);
  };

  // Helper: check if billboard is rented (not available)
  const isBillboardRented = (b: any): boolean => {
    const id = Number(b.ID ?? b.id);
    if (occupiedBillboardIds.has(id)) return true;
    const st = String(b.Status || b.status || '').toLowerCase();
    return st === 'مؤجر' || st === 'محجوز' || st === 'rented';
  };

  const mapBillboardWithEffectiveStatus = (b: any): Billboard => {
    const id = Number(b.ID ?? b.id ?? 0);
    const effectiveEndDate = (b as any).Rent_End_Date ?? (b as any).rent_end_date ?? occupiedBillboardIds.get(id) ?? null;
    const effectiveStatus = isBillboardRented(b) ? 'مؤجر' : 'متاح';
    const effectiveStatusEn = isBillboardRented(b) ? 'rented' : 'available';

    return {
      ...b,
      ID: (b as any).ID || 0,
      Billboard_Name: (b as any).Billboard_Name || '',
      City: (b as any).City || '',
      District: (b as any).District || '',
      Size: (b as any).Size || '',
      Status: effectiveStatus,
      Price: (b as any).Price || '0',
      Level: (b as any).Level || '',
      Image_URL: (b as any).Image_URL || '',
      GPS_Coordinates: (b as any).GPS_Coordinates || '',
      GPS_Link: (b as any).GPS_Link || '',
      Nearest_Landmark: (b as any).Nearest_Landmark || '',
      Faces_Count: (b as any).Faces_Count || '1',
      Municipality: (b as any).Municipality || '',
      Rent_End_Date: effectiveEndDate,
      Customer_Name: (b as any).Customer_Name || '',
      Ad_Type: (b as any).Ad_Type || '',
      is_visible_in_available: (b as any).is_visible_in_available,
      id: String((b as any).ID || ''),
      name: (b as any).Billboard_Name || '',
      location: (b as any).Nearest_Landmark || '',
      size: (b as any).Size || '',
      status: effectiveStatusEn as 'available' | 'rented',
      coordinates: (b as any).GPS_Coordinates || '',
      imageUrl: (b as any).Image_URL || '',
      expiryDate: effectiveEndDate,
      area: (b as any).District || '',
      municipality: (b as any).Municipality || '',
      size_id: (b as any).size_id || null,
    } as Billboard;
  };


  const { data: dbMunisData = [] } = useQuery({
    queryKey: ['offer-edit-munis-sorting'],
    queryFn: async () => {
      const { data } = await supabase.from('municipalities').select('name, sort_order').order('sort_order', { ascending: true });
      return data || [];
    }
  });

  const enhancedSearchMatch = (b: any, query: string): boolean => {
    if (!query || !query.trim()) return true;
    const bIdStr = String(b.ID || b.id || '');
    const code = b.code || b.Code || `TR-${bIdStr.padStart(4, '0')}`;

    return smartArabicMatch(
      [
        code, b.code, b.Code,
        b.name, b.Billboard_Name, b.location, b.Nearest_Landmark,
        b.municipality, b.Municipality, b.city, b.City, b.District, b.district,
        b.Customer_Name, b.clientName, b.customer_name,
        b.Size, b.size, b.Level, b.level,
        b.Ad_Type, b.adType, b.ad_type, b.new_ad_type,
        b.Contract_Number, b.contractNumber,
        b.ID, b.id, bIdStr
      ],
      query
    );
  };

  // Show rented + near-expiry billboards for offers
  const filtered = useMemo(() => {
    const list = billboards.filter((b: any) => {
      const c = String(b.city || b.City || '');
      const m = String(b.municipality || b.Municipality || '');
      const s = String(b.size || b.Size || '').trim();
      const isHidden = b.is_visible_in_available === false;

      const matchesQ = enhancedSearchMatch(b, searchQuery);
      const matchesCity = cityFilter === 'all' || c === cityFilter;
      const matchesMunicipality = municipalityFilter === 'all' || m === municipalityFilter;
      const matchesSize = sizeFilters.length > 0 ? sizeFilters.includes(s) : (sizeFilter === 'all' || s === sizeFilter);

      const isAvail = isAvailableEffective(b);
      const isNear = isNearExpiring(b);
      const isInSelection = selected.includes(String(b.ID || b.id));

      const statusValue = String((b.Status ?? b.status ?? '')).trim();
      const statusLower = statusValue.toLowerCase();
      const maintenanceStatus = String(b.maintenance_status ?? '').trim().toLowerCase();
      const isUnderMaintenance = 
        statusValue === 'صيانة' || 
        statusLower === 'maintenance' || 
        maintenanceStatus === 'maintenance' || 
        maintenanceStatus === 'repair_needed' || 
        maintenanceStatus === 'out_of_service' || 
        maintenanceStatus === 'قيد الصيانة' || 
        maintenanceStatus === 'متضررة اللوحة';

      const hasSearch = searchQuery.trim().length > 0;
      let shouldShow = false;
      if (hasSearch) {
        shouldShow = true; // Search overrides status tabs to find any matching billboard!
      } else if (statusFilter === 'all') {
        shouldShow = true; // "الكل" matches all billboards
      } else if (statusFilter === 'available') {
        shouldShow = (isAvail || isInSelection) && !isHidden && !isUnderMaintenance;
      } else if (statusFilter === 'nearExpiry') {
        shouldShow = isNear;
      } else if (statusFilter === 'rented') {
        shouldShow = !isAvail;
      } else if (statusFilter === 'maintenance') {
        shouldShow = isUnderMaintenance;
      } else if (statusFilter === 'hidden') {
        shouldShow = isHidden;
      }

      if (isInSelection) shouldShow = true;

      return matchesQ && matchesCity && matchesMunicipality && matchesSize && shouldShow;
    });

    return sortBillboardsStandardSync(list, dbSizesData, dbMunisData);
  }, [billboards, searchQuery, cityFilter, municipalityFilter, sizeFilter, sizeFilters, statusFilter, selected, occupiedBillboardIds, dbSizesData, dbMunisData]);

  // ========== HANDLERS ==========

  const toggleSelect = (b: Billboard) => {
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
    } else {
      // Removing billboard
      setSingleFaceBillboards(prev => { const next = new Set(prev); next.delete(id); return next; });
      setIndividualDiscounts(prev => { const next = { ...prev }; delete next[id]; return next; });
      setFriendBillboardCosts(prev => prev.filter(f => f.billboardId !== id));
    }

    setUserEditedRentCost(false);
    setInstallmentsLoaded(false);
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleConfirmMaintenanceSelect = () => {
    if (pendingMaintenanceBillboard) {
      const id = String((pendingMaintenanceBillboard as any).ID);
      setUserEditedRentCost(false);
      setInstallmentsLoaded(false);
        setSelected(prev => [...prev, id]);
      setPendingMaintenanceBillboard(null);
    }
    setMaintenanceConfirmOpen(false);
  };

  const removeSelected = (id: string) => {
    setUserEditedRentCost(false);
    setInstallmentsLoaded(false);
    setSelected(prev => prev.filter(x => x !== id));
    setFriendBillboardCosts(prev => prev.filter(f => f.billboardId !== id));
    setSingleFaceBillboards(prev => { const next = new Set(prev); next.delete(id); return next; });
    setIndividualDiscounts(prev => { const next = { ...prev }; delete next[id]; return next; });
  };

  const removeMultipleSelected = (ids: string[]) => {
    setUserEditedRentCost(false);
    setInstallmentsLoaded(false);
    setSelected(prev => prev.filter(x => !ids.includes(x)));
    setFriendBillboardCosts(prev => prev.filter(f => !ids.includes(f.billboardId)));
    setSingleFaceBillboards(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.delete(id));
      return next;
    });
    setIndividualDiscounts(prev => {
      const next = { ...prev };
      ids.forEach(id => delete next[id]);
      return next;
    });
  };

  const toggleSingleFace = (billboardId: string) => {
    const bb = billboards.find(b => String((b as any).ID) === String(billboardId));
    const orig = bb ? ((bb as any).Faces_Count ?? (bb as any).faces_count ?? (bb as any).faces) : null;
    if (orig !== null && orig !== undefined && Number(orig) === 1) return;

    setUserEditedRentCost(false);
    setInstallmentsLoaded(false);
    if (useStoredPrices) setUseStoredPrices(false);
    setSingleFaceBillboards(prev => {
      const next = new Set(prev);
      if (next.has(billboardId)) next.delete(billboardId);
      else next.add(billboardId);
      return next;
    });
  };

  const handleUpdateIndividualDiscount = (billboardId: string, value: number, type: 'amount' | 'percent') => {
    setUserEditedRentCost(false);
    setInstallmentsLoaded(false);
    if (useStoredPrices) setUseStoredPrices(false);
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

  const handleUpdateFriendCost = (billboardId: string, friendCompanyId: string, friendCompanyName: string, cost: number) => {
    setFriendBillboardCosts(prev => {
      const existing = prev.find(f => f.billboardId === billboardId);
      if (existing) return prev.map(f => f.billboardId === billboardId ? { ...f, friendRentalCost: cost, friendCompanyId, friendCompanyName } : f);
      return [...prev, { billboardId, friendCompanyId, friendCompanyName, friendRentalCost: cost }];
    });
  };

  const handleAddCustomer = async (name: string) => {
    if (!name) return;
    try {
      const { data: newC, error } = await supabase.from('customers').insert({ name }).select().single();
      if (!error && newC) { setCustomerId(newC.id); setCustomerName(name); setCustomers(prev => [{ id: newC.id, name }, ...prev]); }
    } catch (e) { console.warn(e); }
    setCustomerOpen(false); setCustomerQuery('');
  };

  const handleSelectCustomer = (customer: { id: string; name: string; company?: string; phone?: string }) => {
    setCustomerName(customer.name); setCustomerId(customer.id);
    setCustomerCompany(customer.company || null); setCustomerPhone(customer.phone || null);
    setCustomerOpen(false); setCustomerQuery('');
  };


  // ========== INSTALLMENT HELPERS ==========

  const calculateDueDate = (paymentType: string, index: number, startDateOverride?: string): string => {
    const baseDate = startDateOverride || startDate;
    if (!baseDate) return '';
    const date = new Date(baseDate);
    if (paymentType === 'عند التوقيع') return baseDate;
    else if (paymentType === 'شهري') date.setMonth(date.getMonth() + (index + 1));
    else if (paymentType === 'شهرين') date.setMonth(date.getMonth() + (index + 1) * 2);
    else if (paymentType === 'ثلاثة أشهر') date.setMonth(date.getMonth() + (index + 1) * 3);
    else if (paymentType === 'عند التركيب') date.setDate(date.getDate() + 7);
    else if (paymentType === 'نهاية العقد') return endDate || '';
    return date.toISOString().split('T')[0];
  };

  // ✅ تقريب للأسفل لأقرب رقم مغلق
  const roundToCleanValue = (value: number): number => {
    if (value <= 0) return 0;
    if (value < 100) return Math.floor(value);
    if (value < 1000) return Math.floor(value / 10) * 10;
    if (value < 10000) return Math.floor(value / 100) * 100;
    return Math.floor(value / 500) * 500;
  };

  // ✅ تقريب للأعلى لأقرب رقم مغلق
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
    setInstallmentsLoaded(false);
  };

  const distributeWithInterval = (config: {
    firstPayment: number;
    firstPaymentType: 'amount' | 'percent';
    interval: 'month' | '2months' | '3months' | '4months' | '5months' | '6months' | '7months';
    numPayments?: number;
    lastPaymentDate?: string;
    firstPaymentDate?: string;
    firstAtSigning?: boolean;
  }) => {
    if (!startDate || finalTotal <= 0) {
      toast.error('يرجى تحديد تاريخ البداية');
      return;
    }
    const { firstPayment, interval, numPayments, lastPaymentDate, firstPaymentDate, firstAtSigning = true } = config;
    if (firstPayment < 0 || firstPayment > finalTotal) {
      toast.error('قيمة الدفعة الأولى غير صحيحة');
      return;
    }
    
    const remaining = finalTotal - firstPayment;
    const intervalMonthsMap: Record<string, number> = { 'month': 1, '2months': 2, '3months': 3, '4months': 4, '5months': 5, '6months': 6, '7months': 7 };
    const intervalLabelMap: Record<string, string> = { 'month': 'شهري', '2months': 'كل شهرين', '3months': 'كل 3 أشهر', '4months': 'كل 4 أشهر', '5months': 'كل 5 أشهر', '6months': 'كل 6 أشهر', '7months': 'كل 7 أشهر' };
    const intervalMonths = intervalMonthsMap[interval] || 1;
    const intervalLabel = intervalLabelMap[interval] || 'شهري';
    
    const newInstallments: typeof installments = [];
    
    // Add first payment if different
    if (firstPayment > 0) {
      newInstallments.push({
        amount: Math.round(firstPayment * 100) / 100,
        paymentType: firstAtSigning ? 'عند التوقيع' : 'مقدم',
        description: 'الدفعة الأولى',
        dueDate: firstPaymentDate || startDate
      });
    }
    
    if (remaining > 0) {
      const start = new Date(firstPaymentDate || startDate);
      let numberOfPayments: number;
      
      if (numPayments) {
        numberOfPayments = numPayments;
      } else if (lastPaymentDate) {
        const calculatedEndDate = new Date(lastPaymentDate);
        const monthsDiff = Math.max(intervalMonths, Math.round((calculatedEndDate.getTime() - start.getTime()) / (30 * 24 * 60 * 60 * 1000)));
        numberOfPayments = Math.max(1, Math.floor(monthsDiff / intervalMonths));
      } else {
        const calculatedEndDate = new Date(endDate || startDate);
        const monthsDiff = Math.max(intervalMonths, Math.round((calculatedEndDate.getTime() - start.getTime()) / (30 * 24 * 60 * 60 * 1000)));
        numberOfPayments = Math.max(1, Math.floor(monthsDiff / intervalMonths));
      }
      
      const recurringPayment = Math.round((remaining / numberOfPayments) * 100) / 100;
      const lastPaymentAmount = Math.round((remaining - (recurringPayment * (numberOfPayments - 1))) * 100) / 100;
      
      for (let i = 0; i < numberOfPayments; i++) {
        const paymentDate = new Date(start);
        paymentDate.setMonth(paymentDate.getMonth() + ((i + 1) * intervalMonths));
        newInstallments.push({
          amount: i === numberOfPayments - 1 ? lastPaymentAmount : recurringPayment,
          paymentType: intervalLabel,
          description: `الدفعة ${newInstallments.length + 1}`,
          dueDate: paymentDate.toISOString().split('T')[0]
        });
      }
    }
    
    // If no installments created (firstPayment=0, remaining=0), create single payment
    if (newInstallments.length === 0) {
      newInstallments.push({ amount: finalTotal, paymentType: 'عند التوقيع', description: 'الدفعة الأولى', dueDate: startDate });
    }
    
    setInstallments(newInstallments);
    setInstallmentsLoaded(false);
    toast.success(`تم التوزيع: ${newInstallments.length} دفعات`);
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
        amount = Math.round(remainingTotal * 100) / 100;
      } else {
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

  const createManualInstallments = (count: number) => {
    if (finalTotal <= 0) {
      toast.info('لا يمكن توزيع الدفعات بدون إجمالي صحيح');
      return;
    }
    
    count = Math.max(1, Math.min(12, Math.floor(count)));
    
    const newInstallments = Array.from({ length: count }).map((_, i) => ({
      amount: 0,
      paymentType: i === 0 ? 'عند التوقيع' : (i === 1 ? 'عند التركيب' : 'شهري'),
      description: `الدفعة ${i + 1}`,
      dueDate: calculateDueDate(i === 0 ? 'عند التوقيع' : (i === 1 ? 'عند التركيب' : 'شهري'), i)
    }));
    
    setInstallments(newInstallments);
    setInstallmentsLoaded(false);
  };

  const handleApplyUnequalDistribution = (payments: any[]) => {
    setInstallments(payments.map(p => ({
      amount: p.amount,
      paymentType: p.paymentType,
      description: p.description,
      dueDate: p.dueDate
    })));
    setInstallmentsLoaded(false);
  };

  const addInstallment = () => setInstallments([...installments, { amount: 0, paymentType: 'شهري', description: `الدفعة ${installments.length + 1}`, dueDate: calculateDueDate('شهري', installments.length) }]);
  const removeInstallment = (index: number) => setInstallments(installments.filter((_, i) => i !== index));
  const updateInstallment = (index: number, field: string, value: any) => setInstallments(prev => prev.map((inst, i) => i === index ? { ...inst, [field]: value, ...(field === 'paymentType' ? { dueDate: calculateDueDate(value, i) } : {}) } : inst));
  const clearAllInstallments = () => {
    setInstallments([]);
    setInstallmentsLoaded(false);
  };

  const installmentSummary = React.useMemo(() => {
    if (installments.length === 0) return '';
    if (installments.length === 1) return `دفعة واحدة: ${installments[0].amount.toLocaleString('ar-LY')} د.ل`;
    const first = installments[0];
    const recurring = installments.slice(1);
    return `الدفعة الأولى: ${first.amount.toLocaleString('ar-LY')} د.ل - ${recurring.length} دفعات أخرى`;
  }, [installments]);

  // ========== SAVE ==========

  const save = async () => {
    try {
      if (!customerName || selected.length === 0) { toast.error('يرجى تعبئة البيانات المطلوبة واختيار لوحات'); return; }
      if (pendingBillboardChanges) {
        toast.error('تم تعديل لوحات العرض — اضغط «معالجة التعديلات» لإعادة توزيع الدفعات قبل الحفظ');
        setWorkspaceSection('pricing');
        return;
      }
      if (generalDiscountExceedsBase) {
        toast.error('الخصم أكبر من صافي الإيجار القابل للخصم — قلّل قيمة الخصم قبل الحفظ');
        setWorkspaceSection('pricing');
        return;
      }
      if (installments.length > 0 && !installmentsMatchTotal(installments, finalTotal)) {
        toast.error('مجموع الدفعات لا يساوي إجمالي العرض — أعد توزيع الدفعات قبل الحفظ');
        setWorkspaceSection('pricing');
        return;
      }
      setSaving(true);

      const selectedBillboardsData = billboards
        .filter(b => selected.includes(String((b as any).ID)))
        .map(b => ({
          id: String((b as any).ID), ID: (b as any).ID,
          name: (b as any).name || (b as any).Billboard_Name || '',
          Billboard_Name: (b as any).Billboard_Name || '',
          size: (b as any).size || (b as any).Size || '',
          Size: (b as any).Size || '',
          level: (b as any).level || (b as any).Level || '',
          Level: (b as any).Level || '',
          city: (b as any).city || (b as any).City || '',
          City: (b as any).City || '',
          Municipality: (b as any).Municipality || '',
          District: (b as any).District || '',
          Nearest_Landmark: (b as any).Nearest_Landmark || '',
          Image_URL: ((b as any).Image_URL && !String((b as any).Image_URL).startsWith('data:')) ? (b as any).Image_URL : '',
          Faces_Count: (b as any).Faces_Count || 1,
          GPS_Coordinates: (b as any).GPS_Coordinates || '',
          price: calculateBillboardPrice(b),
          Price: calculateBillboardPrice(b),
        }));

      const billboardPrices = offerBillboardPriceRows;

      const installmentsForSaving = (installments || []).map((inst, idx) => {
        const defaultPaymentType = idx === 0 ? 'عند التوقيع' : (idx === 1 ? 'عند التركيب' : 'شهري');
        const paymentType = String(inst?.paymentType || '').trim() || defaultPaymentType;
        return {
          amount: Number(inst?.amount ?? 0) || 0,
          paymentType,
          description: String(inst?.description || '').trim() || `الدفعة ${idx + 1}`,
          dueDate: String(inst?.dueDate || '').trim() || calculateDueDate(paymentType, idx)
        };
      });

      const offerData: any = {
        customer_name: customerName,
        customer_id: customerId || null,
        start_date: startDate,
        end_date: endDate,
        duration_months: pricingMode === 'months' ? durationMonths : 0,
        duration_label: pricingMode === 'months' ? durationName(durationMonths, durations) : `${durationDays} يوم`,
        use_30_day_month: use30DayMonth,
        total: finalTotal,
        // الخصم العام فقط (الخصم الفردي وتخفيض المستوى محفوظان داخل أسعار اللوحات) — نفس معنى Discount في العقد
        discount: generalDiscountAmount,
        discount_type: discountType === 'percent' ? 'percentage' : 'fixed',
        discount_percentage: discountType === 'percent' ? discountValue : 0,
        status: currentOffer?.status || 'pending',
        billboards_count: selected.length,
        billboards_data: JSON.stringify(selectedBillboardsData),
        notes: '',
        pricing_category: pricingCategory,
        ad_type: adType,
        installation_cost: actualInstallationCost,
        installation_enabled: installationEnabled,
        print_cost: actualPrintCost,
        print_cost_enabled: printCostEnabled,
        print_price_per_meter: printCostEnabled ? printPricePerMeter : 0,
        installments_data: installmentsForSaving.length > 0 ? installmentsForSaving : null,
        installment_distribution_type: installmentDistributionType,
        installment_first_payment_amount: installmentFirstPaymentAmount,
        installment_first_payment_type: installmentFirstPaymentType,
        installment_interval: installmentInterval,
        installment_count: installmentCount,
        installment_auto_calculate: installmentAutoCalculate,
        installment_first_at_signing: installmentFirstAtSigning,
        billboard_prices: JSON.stringify(billboardPrices),
        operating_fee: operatingFee,
        operating_fee_rate: 3,
        include_print_in_billboard_price: includePrintInPrice,
        include_installation_in_price: includeInstallationInPrice,
        installation_details: installationDetails.length > 0 ? JSON.stringify(installationDetails) : null,
        single_face_billboards: singleFaceBillboards.size > 0 ? JSON.stringify(Array.from(singleFaceBillboards)) : null,
        level_discounts: Object.keys(levelDiscounts).length > 0 ? levelDiscounts : null,
      };

      // حفظ نسخة احتياطية محلية قبل الإرسال لمنع فقدان البيانات
      try {
        localStorage.setItem('adhub_offer_draft_backup', JSON.stringify(offerData));
      } catch {}

      // ✅ حفظ نسخة من قائمة أسعار الفئة وقت التسعير
      const existingSnapshot = parsePricingSnapshot((currentOffer as any)?.pricing_snapshot);
      const offerPayload: any = { ...offerData };
      if (shouldRefreshSnapshot(existingSnapshot, pricingCategory, useStoredPrices)) {
        const snap = buildPricingSnapshot(pricing.pricingData || [], pricingCategory, durations);
        if (snap) offerPayload.pricing_snapshot = snap;
      }
      const missingSnapshotColumn = (err: any) => !!err && 'pricing_snapshot' in offerPayload && /pricing_snapshot/i.test(String(err.message || err.details || ''));
      const withoutSnapshot = () => { const { pricing_snapshot: _omit, ...rest } = offerPayload; return rest; };

      if (isEditing) {
        let { error } = await supabase.from('offers').update(offerPayload).eq('id', offerId);
        if (missingSnapshotColumn(error)) ({ error } = await supabase.from('offers').update(withoutSnapshot()).eq('id', offerId));
        if (error) throw error;
        toast.success('تم تحديث العرض بنجاح');
      } else {
        let { error } = await supabase.from('offers').insert([offerPayload]);
        if (missingSnapshotColumn(error)) ({ error } = await supabase.from('offers').insert([withoutSnapshot()]));
        if (error) throw error;
        toast.success('تم إنشاء العرض بنجاح');
      }

      try {
        localStorage.removeItem('adhub_offer_draft_backup');
      } catch {}

      navigate('/admin/offers');
    } catch (e: any) {
      console.error('[OfferEdit save error]:', e);
      const msg = String(e?.message || '');
      if (msg.includes('Failed to fetch') || msg.includes('Network') || msg.includes('fetch')) {
        toast.error('تعذر الاتصال بالخادم السحابي (انقطاع الإنترنت أو اعتراض من ملحق المتصفح مثل IDM). تم حفظ المسودة، يرجى إعادة المحاولة.');
      } else {
        toast.error(msg || 'فشل حفظ العرض');
      }
    } finally {
      setSaving(false);
    }
  };

  // ========== RENDER ==========

  useEffect(() => {
    if (isEditing && currentOffer && billboardBaseline === null && selected.length > 0 && finalTotal > 0) {
      setBillboardBaseline({ ids: [...selected], total: finalTotal });
    }
  }, [isEditing, currentOffer, billboardBaseline, selected, finalTotal]);
  const addedSinceBaseline = billboardBaseline ? selected.filter((id) => !billboardBaseline.ids.includes(id)) : [];
  const removedSinceBaseline = billboardBaseline ? billboardBaseline.ids.filter((id) => !selected.includes(id)) : [];
  const pendingBillboardChanges = addedSinceBaseline.length > 0 || removedSinceBaseline.length > 0;
  const zeroPricedAddedNames = addedSinceBaseline
    .filter((id) => {
      const row: any = unifiedPricingByBillboard.get(id);
      return row && !row.isReplacement && Number(row.baseRentalPrice || 0) <= 0;
    })
    .map((id) => {
      const bb: any = billboards.find((b) => String((b as any).ID) === id);
      return bb?.Billboard_Name || bb?.name || `#${id}`;
    });
  const processBillboardChanges = () => {
    if (zeroPricedAddedNames.length > 0) {
      toast.error(`حدّد سعر اللوحات بدون سعر أولاً: ${zeroPricedAddedNames.join('، ')}`);
      return;
    }
    setInstallments((prev: any[]) => rescaleInstallmentsToTotal(prev, finalTotal));
    setInstallmentsLoaded(true);
    setBillboardBaseline({ ids: [...selected], total: finalTotal });
    toast.success('تمت معالجة التعديلات: أُعيد توزيع الدفعات على الإجمالي الجديد');
  };

  const handlePrintOffer = () => {
    if (!isEditing || !currentOffer) {
      toast.info('احفظ العرض أولاً ثم اطبعه');
      return;
    }
                  // ✅ Map offer data to contract-compatible fields for ContractPDFDialog
                  const selectedBBs = billboards.filter(b => selected.includes(String((b as any).ID)));
                  const mappedContract = {
                    id: currentOffer.offer_number || 0,
                    offer_number: currentOffer.offer_number || 0,
                    Contract_Number: currentOffer.offer_number || 0,
                    is_offer: true,
                    customer_name: customerName,
                    'Customer Name': customerName,
                    customer_id: customerId,
                    'Ad Type': adType || 'عرض سعر',
                    start_date: startDate,
                    'Contract Date': startDate,
                    end_date: endDate,
                    'End Date': endDate,
                    Duration: pricingMode === 'months' ? durationName(durationMonths, durations) : `${durationDays} يوم`,
                    Total: finalTotal,
                    'Total Rent': finalTotal,
                    Discount: generalDiscountAmount,
                    installation_cost: actualInstallationCost,
                    installation_enabled: installationEnabled,
                    include_installation_in_price: includeInstallationInPrice,
                    include_print_in_billboard_price: includePrintInPrice,
                    print_cost_enabled: printCostEnabled,
                    print_cost: actualPrintCost,
                    print_price_per_meter: printPricePerMeter,
                    billboard_ids: selected.join(','),
                    installments_data: JSON.stringify(installments),
                    customer_category: pricingCategory,
                    contract_currency: currentOffer.currency || 'LYD',
                    exchange_rate: String(currentOffer.exchange_rate || 1),
                    operating_fee_rate: 3,
                    single_face_billboards: singleFaceBillboards.size > 0 ? JSON.stringify(Array.from(singleFaceBillboards)) : null,
                    level_discounts: Object.keys(levelDiscounts).length > 0 ? levelDiscounts : null,
                    billboard_prices: JSON.stringify(offerBillboardPriceRows),
                    billboards_data: currentOffer.billboards_data,
                  };
                  setPdfContractData(mappedContract);
                  setPdfOpen(true);
  };

  const selectedOfferBillboardsMapped = billboards
    .filter((b) => selected.includes(String((b as any).ID)))
    .map(b => ({
      ...mapBillboardWithEffectiveStatus(b),
      Customer_Name: (b as any).Customer_Name || customerName || '',
      Ad_Type: (b as any).Ad_Type || adType || '',
    })) as Billboard[];

  return (
    <div className="min-h-screen bg-muted/20 text-foreground p-3 md:p-4" dir="rtl">
      <div className="max-w-[1440px] mx-auto space-y-3">
        <div className="sticky top-0 z-30 space-y-2 bg-background/95 pb-2 backdrop-blur">
        <ContractEditHeader
          contractNumber={String(currentOffer?.offer_number || '')}
          title={isEditing ? `تعديل عرض سعر #${currentOffer?.offer_number || ''}` : 'إنشاء عرض سعر جديد'}
          subtitle="العرض لا يحجز اللوحات — راجع الأسعار والدفعات قبل حفظ العرض"
          printLabel="طباعة العرض"
          saveLabel={isEditing ? 'حفظ التعديلات' : 'حفظ العرض'}
          hidePrint={!isEditing || !currentOffer}
          onBack={() => navigate('/admin/offers')}
          onPrint={handlePrintOffer}
          onSave={save}
          saving={saving}
          extraActions={
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecalculateAll}
              disabled={refreshingPrices || saving}
              className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 gap-2"
              title="إعادة احتساب جميع أسعار وتكاليف العرض من جديد وفق جدول التسعير الحالي"
            >
              <RefreshCw className={`h-4 w-4 ${refreshingPrices ? 'animate-spin' : ''}`} />
              إعادة الاحتساب
            </Button>
          }
        />
        <nav aria-label="أقسام تعديل العرض" className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1.5">
          {([
            ['basics', 'بيانات العرض'],
            ['boards', `لوحات العرض (${selected.length})`],
            ['catalog', 'اختيار لوحات جديدة'],
            ['pricing', 'الأسعار والدفعات'],
          ] as const).map(([section, label]) => (
            <button key={section} type="button" aria-pressed={workspaceSection === section}
              onClick={() => setWorkspaceSection(section)}
              className={`min-h-11 flex-1 cursor-pointer whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${workspaceSection === section ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              {label}
            </button>
          ))}
        </nav>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-card px-3 py-2 sm:grid-cols-4" aria-live="polite">
          <div><span className="text-xs text-muted-foreground">حالة العرض</span><p className="text-sm font-semibold">{isEditing ? (currentOffer?.status === 'approved' ? 'معتمد' : currentOffer?.status === 'rejected' ? 'مرفوض' : 'قيد الانتظار') : 'عرض جديد'}</p></div>
          <div><span className="text-xs text-muted-foreground">الإجمالي السابق</span><p className="font-semibold">{Number(originalTotal || 0).toLocaleString('ar-LY')} د.ل</p></div>
          <div><span className="text-xs text-muted-foreground">الإجمالي الحالي</span><p className="font-semibold text-primary">{Number(finalTotal || 0).toLocaleString('ar-LY')} د.ل</p></div>
          <div><span className="text-xs text-muted-foreground">عدد اللوحات</span><p className="font-semibold">{selected.length}</p></div>
        </div>

        {pendingBillboardChanges && billboardBaseline && (
          <PendingChangesBanner
            added={addedSinceBaseline.length}
            removed={removedSinceBaseline.length}
            previousTotal={billboardBaseline.total}
            newTotal={finalTotal}
            installmentsMatch={installmentsMatchTotal(installments, finalTotal)}
            entityLabel="العرض"
            zeroPricedNames={zeroPricedAddedNames}
            onProcess={processBillboardChanges}
            onReview={() => setWorkspaceSection('pricing')}
          />
        )}

        <section className={`${workspaceSection === 'basics' ? 'grid' : 'hidden'} scroll-mt-40 items-start gap-5 lg:grid-cols-2`} aria-label="بيانات العرض">
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
              customerCompany={customerCompany}
              customerPhone={customerPhone}
            />

            {/* التواريخ والمدة */}
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

        </section>

        <div className="flex flex-col gap-6">
          <div className={`${['boards', 'catalog'].includes(workspaceSection) ? 'block' : 'hidden'} scroll-mt-40 min-w-0 space-y-4`}>
            <div className={workspaceSection === 'boards' ? 'space-y-3' : 'hidden'}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-base font-bold">لوحات العرض</h2>
                <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border">
                  <Button type="button" size="sm" variant={boardsViewMode === 'cards' ? 'default' : 'ghost'} onClick={() => setBoardsViewMode('cards')} className="h-8 gap-1.5 text-xs font-medium cursor-pointer">
                    <List className="h-3.5 w-3.5" />
                    قائمة البطاقات
                  </Button>
                  <Button type="button" size="sm" variant={boardsViewMode === 'map' ? 'default' : 'ghost'} onClick={() => setBoardsViewMode('map')} className="h-8 gap-1.5 text-xs font-medium cursor-pointer">
                    <MapIcon className="h-3.5 w-3.5" />
                    خريطة اللوحات ({selected.length})
                  </Button>
                  <Button type="button" size="sm" variant={boardsViewMode === 'split' ? 'default' : 'ghost'} onClick={() => setBoardsViewMode('split')} className="h-8 gap-1.5 text-xs font-medium cursor-pointer">
                    <Layers className="h-3.5 w-3.5" />
                    عرض مدمج
                  </Button>
                </div>
              </div>
              <Button type="button" variant="outline" onClick={() => setWorkspaceSection('catalog')} className="min-h-10 cursor-pointer gap-2 transition-all duration-200">
                <Plus className="h-4 w-4" />
                اختيار لوحات جديدة
              </Button>
            </div>

            {/* زر إزالة اللوحات الفارغة */}
            {(() => {
              const emptyIds = selected.filter(id => !billboards.find(b => String((b as any).ID) === id));
              if (emptyIds.length === 0) return null;
              return (
                <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <span className="text-sm text-destructive font-medium">
                    <Trash2 className="h-4 w-4 inline ml-1" />
                    يوجد {emptyIds.length} لوحة فارغة/غير موجودة
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setUserEditedRentCost(false);
                      setInstallmentsLoaded(false);
                      if (useStoredPrices) setUseStoredPrices(false);
                      setSelected(prev => prev.filter(id => !emptyIds.includes(id)));
                      setSingleFaceBillboards(prev => {
                        const next = new Set(prev);
                        emptyIds.forEach(id => next.delete(id));
                        return next;
                      });
                      setIndividualDiscounts(prev => {
                        const next = { ...prev };
                        emptyIds.forEach(id => delete next[id]);
                        return next;
                      });
                      toast.success(`تم إزالة ${emptyIds.length} لوحة فارغة وإعادة الاحتساب`);
                    }}
                  >
                    إزالة الكل
                  </Button>
                </div>
              );
            })()}

            {/* زر إزالة اللوحات المؤجرة */}
            {(() => {
              const rentedIds = selected.filter(id => {
                const b = billboards.find(bb => String((bb as any).ID) === id);
                if (!b) return false;
                // ✅ Cross-checked: detects rented via active contract too
                return isBillboardRented(b);
              });
              if (rentedIds.length === 0) return null;
              return (
                <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <span className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                    <Trash2 className="h-4 w-4 inline ml-1" />
                    يوجد {rentedIds.length} لوحة مؤجرة حالياً في العرض
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                    onClick={() => {
                      setUserEditedRentCost(false);
                      setInstallmentsLoaded(false);
                      if (useStoredPrices) setUseStoredPrices(false);
                      setSelected(prev => prev.filter(id => !rentedIds.includes(id)));
                      setSingleFaceBillboards(prev => {
                        const next = new Set(prev);
                        rentedIds.forEach(id => next.delete(id));
                        return next;
                      });
                      setIndividualDiscounts(prev => {
                        const next = { ...prev };
                        rentedIds.forEach(id => delete next[id]);
                        return next;
                      });
                      toast.success(`تم إزالة ${rentedIds.length} لوحة مؤجرة وإعادة الاحتساب`);
                    }}
                  >
                    إزالة المؤجرة
                  </Button>
                </div>
              );
            })()}

            {boardsViewMode === 'map' && (
              <div className="w-full h-[760px] lg:h-[84vh] min-h-[620px] rounded-2xl overflow-hidden border border-border shadow-sm relative">
                <SelectableGoogleHomeMap
                  className="w-full h-full"
                  billboards={selectedOfferBillboardsMapped}
                  selectedBillboards={selectedBillboardsSet}
                  onToggleSelection={(billboardId) => {
                    const billboard = billboards.find((b) => String((b as any).ID) === billboardId);
                    if (billboard) toggleSelect(billboard);
                  }}
                  pricingMode={pricingMode}
                  durationMonths={durationMonths}
                  durationDays={durationDays}
                  pricingCategory={pricingCategory}
                  calculateBillboardPrice={calculateBillboardPrice}
                  billboardPricingResults={unifiedPricingByBillboard}
                />
              </div>
            )}
            {boardsViewMode === 'split' && (
              <div className="w-full h-[540px] lg:h-[58vh] min-h-[440px] mb-4 rounded-2xl overflow-hidden border border-border shadow-sm relative">
                <SelectableGoogleHomeMap
                  className="w-full h-full"
                  billboards={selectedOfferBillboardsMapped}
                  selectedBillboards={selectedBillboardsSet}
                  onToggleSelection={(billboardId) => {
                    const billboard = billboards.find((b) => String((b as any).ID) === billboardId);
                    if (billboard) toggleSelect(billboard);
                  }}
                  pricingMode={pricingMode}
                  durationMonths={durationMonths}
                  durationDays={durationDays}
                  pricingCategory={pricingCategory}
                  calculateBillboardPrice={calculateBillboardPrice}
                  billboardPricingResults={unifiedPricingByBillboard}
                />
              </div>
            )}

            {boardsViewMode !== 'map' && (
            <>
            <SelectedBillboardsCard
              selected={selected}
              billboards={billboards}
              onRemoveSelected={removeSelected}
              onBulkRemove={removeMultipleSelected}
              calculateBillboardPrice={calculateBillboardPrice}
              installationDetails={installationDetails}
              pricingMode={pricingMode}
              durationMonths={durationMonths}
              durationDays={durationDays}
              sizeNames={pricing.sizeNames}
              totalDiscount={generalDiscountAmount}
              discountType={discountType}
              discountValue={discountValue}
              friendBillboardCosts={friendBillboardCosts}
              onUpdateFriendCost={handleUpdateFriendCost}
              customerCategory={pricingCategory}
              singleFaceBillboards={singleFaceBillboards}
              onToggleSingleFace={toggleSingleFace}
              individualDiscounts={individualDiscounts}
              onUpdateIndividualDiscount={handleUpdateIndividualDiscount}
              pricingByBillboardOverride={unifiedPricingByBillboard}
              onRefresh={handleRecalculateAll}
              printCostDetails={perBillboardPrintCosts}
              printCostEnabled={printCostEnabled}
              installationEnabled={installationEnabled}
              includePrintInPrice={includePrintInPrice}
              includeInstallationInPrice={includeInstallationInPrice}
              startDate={startDate}
              endDate={endDate}
              customerName={customerName}
              adType={adType}
            />

            </>
            )}
            </div>

            <div className={workspaceSection === 'catalog' ? 'space-y-4' : 'hidden'}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-lg font-bold">اختيار لوحات جديدة</h2><p className="text-sm text-muted-foreground">ابحث وحدد اللوحات لإضافتها إلى العرض</p></div>
                <Button type="button" variant="outline" onClick={() => setWorkspaceSection('boards')} className="min-h-10 cursor-pointer transition-all duration-200">مراجعة لوحات العرض ({selected.length})</Button>
              </div>
            <Card className="flex min-h-[700px] flex-col overflow-hidden border-border shadow-sm">
              <div className="shrink-0 border-b border-border bg-gradient-to-l from-primary/10 via-primary/5 to-transparent p-3 lg:p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 text-primary" />
                    فلاتر البحث والتصفية
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCatalogFiltersCollapsed(prev => !prev)}
                    className="h-7 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg border border-border/60 bg-background/50"
                  >
                    <span>{catalogFiltersCollapsed ? 'إظهار الفلاتر' : 'طي الفلاتر لتوسيع المساحة'}</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${catalogFiltersCollapsed ? '' : 'rotate-180'}`} />
                  </Button>
                </div>
                {!catalogFiltersCollapsed && (
                <BillboardFilters
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  cityFilter={cityFilter}
                  setCityFilter={setCityFilter}
                  municipalityFilter={municipalityFilter}
                  setMunicipalityFilter={setMunicipalityFilter}
                  sizeFilter={sizeFilter}
                  setSizeFilter={setSizeFilter}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  pricingCategory={pricingCategory}
                  setPricingCategory={setPricingCategory}
                  cities={cities}
                  municipalities={municipalities}
                  sizes={sizes}
                  pricingCategories={pricingCategories}
                  sizeFilters={sizeFilters}
                  setSizeFilters={setSizeFilters}
                  totalCount={billboards.length}
                  selectedCount={selected.length}
                />
                )}
              </div>

              <Tabs value={viewMode} onValueChange={(val) => setViewMode(val as 'list' | 'map')} className="w-full flex-1 flex flex-col min-h-0">
                <div className="p-3 border-b border-border/60 shrink-0">
                  <TabsList className="grid w-[240px] grid-cols-2 bg-muted/40 h-10 p-1 rounded-xl">
                    <TabsTrigger value="list" className="flex items-center justify-center gap-2 rounded-lg text-xs font-bold transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-amber-600 data-[state=active]:text-white data-[state=active]:shadow-md cursor-pointer">
                      <List className="h-4 w-4" />
                      القائمة
                    </TabsTrigger>
                    <TabsTrigger value="map" className="flex items-center justify-center gap-2 rounded-lg text-xs font-bold transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-amber-600 data-[state=active]:text-white data-[state=active]:shadow-md cursor-pointer">
                      <MapIcon className="h-4 w-4" />
                      الخريطة
                    </TabsTrigger>
                  </TabsList>
                </div>
                
                <TabsContent value="list" className="m-0 flex-1 overflow-y-auto min-h-[500px] max-h-[75vh]">
                  <div className="p-3 space-y-3">
                    <AvailableBillboardsGrid
                      billboards={filtered}
                      selected={selected}
                      onToggleSelect={toggleSelect}
                      loading={loading}
                      allowAllSelection={true}
                      calculateBillboardPrice={calculateBillboardPrice}
                      pricingMode={pricingMode}
                      durationMonths={durationMonths}
                      durationDays={durationDays}
                      pricingCategory={pricingCategory}
                      onSelectCityFilter={(c) => setCityFilter(c)}
                      onSelectMunicipalityFilter={(m) => setMunicipalityFilter(m)}
                      onSelectSizeFilter={(s) => setSizeFilter(s)}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="map" className="m-0 p-0 flex-1 min-h-[650px] h-[760px] lg:h-[84vh] relative">
                  <SelectableGoogleHomeMap
                    className="w-full h-full min-h-[650px]"
                    billboards={filtered.map((b) => mapBillboardWithEffectiveStatus(b)) as Billboard[]}
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
                    calculateBillboardPrice={calculateBillboardPrice}
                    hideInternalFilters
                    billboardPricingResults={unifiedPricingByBillboard}
                  />
                </TabsContent>
              </Tabs>
            </Card>
            </div>
          </div>

          <div className={`${workspaceSection === 'pricing' ? 'grid' : 'hidden'} scroll-mt-40 min-w-0 items-start gap-5 lg:grid-cols-2`}>
            {isEditing && <PricingSnapshotCard snapshot={(currentOffer as any)?.pricing_snapshot} currentPricing={pricing.pricingData || []} entityLabel="العرض" />}
            <div className="lg:col-span-2 flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-lg font-bold">الأسعار والخدمات والدفعات</h2><p className="text-sm text-muted-foreground">اضبط التكاليف والخصومات والدفعات ثم راجع الملخص</p></div>
              <div className="flex flex-wrap gap-2">
                <a href="#offer-summary" className="min-h-10 rounded-lg border border-border bg-card px-4 py-2 text-sm cursor-pointer hover:bg-muted">الملخص</a>
                <a href="#offer-payments" className="min-h-10 rounded-lg border border-border bg-card px-4 py-2 text-sm cursor-pointer hover:bg-muted">الدفعات</a>
              </div>
            </div>
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
                    <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-orange-700 dark:text-orange-300">إجمالي التركيب:</span>
                        <span className="text-xl font-bold text-orange-600">
                          {actualInstallationCost.toLocaleString('ar-LY')} د.ل
                        </span>
                      </div>
                    </div>
                    {(installationCostSummary.groupedSizes as any[]).length > 0 && (
                      <div className="space-y-1.5">
                        {(installationCostSummary.groupedSizes as any[]).map((sizeInfo: any, index: number) => (
                          <div key={index} className="flex justify-between text-sm px-2 py-1.5 rounded-lg bg-muted/30">
                            <span className="text-muted-foreground">{sizeInfo.size} ({sizeInfo.count} لوحة)</span>
                            <span className="font-medium">{sizeInfo.totalForSize.toLocaleString()} د.ل</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-4 bg-muted/20 rounded-lg">
                    {installationEnabled ? 'لا توجد لوحات مختارة' : 'العرض بدون تكلفة تركيب'}
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
                    
                    {printCostDetails.length > 0 ? (
                      <div className="space-y-3">
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {printCostDetails.map((detail: any, index: number) => (
                            <div key={index} className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                              <div className="flex justify-between items-center mb-1.5">
                                <span className="font-semibold text-sm">{detail.size}</span>
                                <Badge variant="secondary" className="text-xs">
                                  {detail.count} لوحة × {detail.faces} وجه
                                </Badge>
                              </div>
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>المساحة: {detail.area?.toFixed(1) || 0} م²</span>
                                <span className="font-medium text-cyan-600">{(detail.totalCost || 0).toFixed(0)} د.ل</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20">
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-cyan-700 dark:text-cyan-300">إجمالي الطباعة:</span>
                            <span className="text-xl font-bold text-cyan-600">
                              {totalPrintCost.toLocaleString('ar-LY')} د.ل
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
                    العرض بدون تكلفة طباعة
                  </div>
                )}
              </CardContent>
            </Card>

            {/* رسوم التشغيل */}
            {operatingFee > 0 && (
              <Card className="bg-card border-border shadow-lg overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
                <CardHeader className="py-3 px-4 bg-gradient-to-br from-blue-500/5 to-transparent">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <div className="p-1.5 rounded-lg bg-blue-500/10">
                      <DollarSign className="h-4 w-4 text-blue-600" />
                    </div>
                    رسوم التشغيل (3%)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span>{installationCost > 0 ? 'صافي تكلفة الإيجار:' : 'الإجمالي بعد الخصم:'}</span>
                      <span className="font-medium">{(installationCost > 0 ? rentalCostOnly : finalTotal).toLocaleString('ar-LY')} د.ل</span>
                    </div>
                    <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
                      <div className="flex justify-between items-center font-bold">
                        <span>إجمالي رسوم التشغيل:</span>
                        <span className="text-blue-600">{operatingFee.toLocaleString('ar-LY')} د.ل</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* مؤشر ومحدد مصدر الأسعار */}
            {isEditing && (
              <Card className="bg-card border-border shadow-lg overflow-hidden">
                <CardContent className="p-4 space-y-3">
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
                          {useStoredPrices ? 'الأسعار المحفوظة في العرض سابقاً' : 'من جدول التسعير الحالي (معاد احتسابه)'}
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
                  
                  {/* أزرار التبديل وإعادة الاحتساب */}
                  {!useStoredPrices ? (
                    <div className="flex items-center justify-between pt-1">
                      {savedBaseRent !== null && savedBaseRent > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          الإيجار المحفوظ سابقاً: {savedBaseRent.toLocaleString('ar-LY')} د.ل
                        </span>
                      ) : <span />}
                      {savedBaseRent !== null && savedBaseRent > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setUseStoredPrices(true);
                            toast.info('تم التبديل للأسعار المحفوظة سابقاً');
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground gap-1.5 h-7"
                        >
                          <DollarSign className="h-3.5 w-3.5" />
                          استخدام الأسعار المحفوظة السابقة
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleRecalculateAll}
                      disabled={refreshingPrices}
                      className="w-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-medium"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${refreshingPrices ? 'animate-spin' : ''}`} />
                      إعادة الاحتساب من جدول التسعير الحالي
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* مكون تخفيض حسب المستوى */}
            {selected.length > 0 && (
              <LevelDiscountsCard
                selectedBillboards={billboards.filter(b => selected.includes(String((b as any).ID)))}
                levelDiscounts={levelDiscounts}
                setLevelDiscounts={setLevelDiscounts}
                currencySymbol="د.ل"
                calculateBillboardPrice={calculateBillboardPrice}
                sizeNames={pricing.sizeNames}
              />
            )}

            <div id="offer-payments" className="scroll-mt-40 lg:col-span-2">
            {/* الأقساط */}
            <InstallmentsManager
              installments={installments}
              finalTotal={finalTotal}
              startDate={startDate}
              endDate={endDate}
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
              installmentSummary={installmentSummary}
              // ✅ Pass saved settings
              savedDistributionType={installmentDistributionType}
              savedFirstPaymentAmount={installmentFirstPaymentAmount}
              savedFirstPaymentType={installmentFirstPaymentType}
              savedInterval={installmentInterval}
              savedCount={installmentCount}
              savedHasDifferentFirstPayment={hasDifferentFirstPayment}
              savedFirstAtSigning={installmentFirstAtSigning}
              // ✅ Sync callbacks
              onDistributionTypeChange={setInstallmentDistributionType}
              onFirstPaymentAmountChange={setInstallmentFirstPaymentAmount}
              onFirstPaymentTypeChange={setInstallmentFirstPaymentType}
              onIntervalChange={setInstallmentInterval}
              onCountChange={setInstallmentCount}
              onHasDifferentFirstPaymentChange={setHasDifferentFirstPayment}
              onFirstAtSigningChange={setInstallmentFirstAtSigning}
            />

            </div>
            <div id="offer-summary" className="scroll-mt-40 lg:col-span-2">
            {/* ملخص التكلفة */}
            <CostSummaryCard
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
              installationCost={actualInstallationCost}
              rentalCostOnly={rentalCostOnly}
              operatingFee={operatingFee}
              currentContract={currentOffer}
              originalTotal={originalTotal}
              onSave={save}
              onCancel={() => navigate('/admin/offers')}
              saving={saving}
              savedBaseRent={useStoredPrices ? savedBaseRent : null}
              calculatedEstimatedTotal={calculatedEstimatedTotal}
              onRefreshPricesFromTable={handleRecalculateAll}
              printCost={actualPrintCost}
              printCostEnabled={printCostEnabled}
              installationEnabled={installationEnabled}
              includeInstallationInPrice={includeInstallationInPrice}
              setIncludeInstallationInPrice={setIncludeInstallationInPrice}
              includePrintInPrice={includePrintInPrice}
              setIncludePrintInPrice={setIncludePrintInPrice}
            />
            </div>
          </div>
        </div>
      </div>

      {pdfOpen && pdfContractData && (
        <ContractPDFDialog
          contract={pdfContractData}
          open={pdfOpen}
          onOpenChange={setPdfOpen}
        />
      )}

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
              هل أنت متأكد من رغبتك في اختيار هذه اللوحة وإضافتها للعرض؟
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
    </div>
  );
}
