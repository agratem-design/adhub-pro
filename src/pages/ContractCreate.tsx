// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { createContract } from '@/services/contractService';
import type { Billboard } from '@/types';
import { getPriceFor, getDailyPriceFor, CustomerType } from '@/data/pricing';
import { isBillboardAvailable, checkBillboardConflicts, type BillboardConflict } from '@/utils/contractUtils';
import { BillboardConflictDialog } from '@/components/contracts/BillboardConflictDialog';
import { useContractForm } from '@/hooks/useContractForm';
import { useContractCalculations } from '@/hooks/useContractCalculations';
import { useContractInstallments } from '@/hooks/useContractInstallments';
import { useContractPricing } from '@/hooks/useContractPricing';
import { ContractFormSidebar } from '@/components/contracts/ContractFormSidebar';
import { FriendBillboardsBulkRental } from '@/components/contracts/edit/FriendBillboardsBulkRental';
import { ContractExpensesManager } from '@/components/contracts/ContractExpensesManager';
import { BillboardSelector } from '@/components/contracts/BillboardSelector';
import { BillboardFilters } from '@/components/contracts/edit/BillboardFilters';
import SelectableGoogleHomeMap from '@/components/Map/SelectableGoogleHomeMap';
import { InstallationCostSummary } from '@/components/contracts/InstallationCostSummary';
import { DesignManager, type BillboardDesign } from '@/components/contracts/DesignManager';
import { DollarSign, Settings, PaintBucket, List, Map as MapIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ✅ NEW: Currency options
const CURRENCIES = [
  { code: 'LYD', name: 'دينار ليبي', symbol: 'د.ل' },
  { code: 'USD', name: 'دولار أمريكي', symbol: '$' },
  { code: 'EUR', name: 'يورو', symbol: '€' },
  { code: 'GBP', name: 'جنيه إسترليني', symbol: '£' },
  { code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س' },
  { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ' },
];

export default function ContractCreate() {
  const navigate = useNavigate();
  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nextContractNumber, setNextContractNumber] = useState<string>('');
  const [pricingCategories, setPricingCategories] = useState<string[]>([]);

  // ✅ NEW: Print pricing state with enable/disable toggle
  const [printCostEnabled, setPrintCostEnabled] = useState<boolean>(false);
  const [printPricePerMeter, setPrintPricePerMeter] = useState<number>(0);

  // ✅ NEW: Installation enable/disable toggle
  const [installationEnabled, setInstallationEnabled] = useState<boolean>(true);

  // ✅ NEW: Design management state
  const [designs, setDesigns] = useState<Array<{
    billboardId: string;
    billboardName: string;
    designFaceA: string;
    designFaceB: string;
    notes?: string;
  }>>([]);

  // ✅ NEW: Currency conversion state
  const [contractCurrency, setContractCurrency] = useState<string>('LYD');
  const [exchangeRate, setExchangeRate] = useState<number>(1);

  // ✅ NEW: Operating fee rate state
  const [operatingFeeRate, setOperatingFeeRate] = useState<number>(3);

  // ✅ NEW: Friend rentals states
  const [friendBillboardCosts, setFriendBillboardCosts] = useState<Array<{
    billboardId: string;
    friendCompanyId: string;
    friendCompanyName: string;
    friendRentalCost: number;
  }>>([]);
  const [friendRentalIncludesInstallation, setFriendRentalIncludesInstallation] = useState<boolean>(false);
  const [friendRentalOperatingFeeEnabled, setFriendRentalOperatingFeeEnabled] = useState<boolean>(false);
  const [friendRentalOperatingFeeRate, setFriendRentalOperatingFeeRate] = useState<number>(3);
  const [customerLinkedFriendCompanyId, setCustomerLinkedFriendCompanyId] = useState<string | null>(null);

  // ─── Conflict detection state ───
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [conflictList, setConflictList] = useState<BillboardConflict[]>([]);
  const [pendingConflictBillboard, setPendingConflictBillboard] = useState<Billboard | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('available');
  const [municipalityFilter, setMunicipalityFilter] = useState<string>('all');
  const [sizeFilters, setSizeFilters] = useState<string[]>([]);
  const [cityFilters, setCityFilters] = useState<string[]>([]);
  const [municipalityFilters, setMunicipalityFilters] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const cities = useMemo(
    () => Array.from(new Set(billboards.map((b) => b.City || b.city))).filter(Boolean) as string[],
    [billboards]
  );

  const sizes = useMemo(() => {
    const sizeSet = new Set<string>();
    billboards.forEach(b => {
      const size = b.Size || b.size;
      if (size) sizeSet.add(size);
    });
    return Array.from(sizeSet).filter(Boolean) as string[];
  }, [billboards]);

  const municipalities = useMemo(() => {
    const base = Array.from(new Set(billboards.map(b => b.Municipality || (b as any).municipality))).filter(Boolean).sort() as string[];
    if (cityFilter !== 'all') {
      const cityBillboards = billboards.filter(b => (b.City || b.city) === cityFilter);
      return Array.from(new Set(cityBillboards.map(b => b.Municipality || (b as any).municipality))).filter(Boolean).sort() as string[];
    }
    return base;
  }, [billboards, cityFilter]);

  const filteredBillboards = useMemo(() => {
    return billboards.filter((b: any) => {
      const name = b.Billboard_Name || b.name || '';
      const location = b.Nearest_Landmark || b.location || '';
      const city = b.City || b.city || '';
      const size = b.Size || b.size || '';
      const status = b.Status || b.status || '';
      const mun = b.Municipality || b.municipality || '';

      const matchesQ = !searchQuery || 
        name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        location.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCity = cityFilters.length > 0 
        ? cityFilters.includes(city)
        : (cityFilter === 'all' || city === cityFilter);

      const matchesSize = sizeFilters.length > 0
        ? sizeFilters.includes(size)
        : (sizeFilter === 'all' || size === sizeFilter);

      const matchesMuni = municipalityFilters.length > 0
        ? municipalityFilters.includes(mun)
        : (municipalityFilter === 'all' || mun === municipalityFilter);

      const isHidden = b.is_visible_in_available === false;
      const isAvail = isBillboardAvailable(b, true);
      const matchesStatus =
        (statusFilter === 'all' && !isHidden) ||
        (statusFilter === 'available' && isAvail && !isHidden) ||
        (statusFilter === 'rented' && !isAvail && !isHidden) ||
        (statusFilter === 'hidden' && isHidden);

      return matchesQ && matchesCity && matchesSize && matchesMuni && matchesStatus;
    });
  }, [billboards, searchQuery, cityFilter, cityFilters, sizeFilter, sizeFilters, statusFilter, municipalityFilter, municipalityFilters]);

  // ✅ NEW: Use unified pricing hook
  const pricing = useContractPricing();

  // Contract form hook
  const {
    formData,
    updateFormData,
    selected,
    setSelected,
    installments,
    setInstallments,
    updateInstallment,
    userEditedRentCost,
    setUserEditedRentCost,
    installationCost,
    installationDetails,
    calculateDueDate,
    use30DayMonth,
    setUse30DayMonth
  } = useContractForm();

  // ✅ NEW: Get current currency info
  const getCurrentCurrency = () => {
    return CURRENCIES.find(c => c.code === contractCurrency) || CURRENCIES[0];
  };

  // ✅ NEW: Apply currency conversion to price
  const convertPrice = (priceInLYD: number): number => {
    return Math.round((priceInLYD * exchangeRate) * 100) / 100;
  };

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

  // Load customer linked_friend_company_id
  useEffect(() => {
    if (!formData.customerId) {
      setCustomerLinkedFriendCompanyId(null);
      return;
    }
    (async () => {
      try {
        const { data } = await supabase
          .from('customers')
          .select('linked_friend_company_id')
          .eq('id', formData.customerId)
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
  }, [formData.customerId]);

  // Auto-initialize friend billboard costs when selected billboards or customer/dates change
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
              const price = pricing.calculateBillboardPrice(
                billboard,
                formData.pricingMode,
                formData.durationMonths,
                formData.durationDays,
                formData.pricingCategory,
                convertPrice
              );
              
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
  }, [selected, billboards, formData.pricingMode, formData.durationMonths, formData.durationDays, formData.pricingCategory, customerLinkedFriendCompanyId, convertPrice]);

  // Recalculate/apply pricing when customer category or duration changes
  useEffect(() => {
    setFriendBillboardCosts(prev => {
      return prev.map(item => {
        const billboard = billboards.find(b => String((b as any).ID) === item.billboardId);
        if (billboard) {
          const price = pricing.calculateBillboardPrice(
            billboard,
            formData.pricingMode,
            formData.durationMonths,
            formData.durationDays,
            formData.pricingCategory,
            convertPrice
          );
          return { ...item, friendRentalCost: price };
        }
        return item;
      });
    });
  }, [formData.pricingMode, formData.durationMonths, formData.durationDays, formData.pricingCategory, convertPrice]);

  // ✅ REMOVED: Now using unified pricing hook - pricing.getPriceFromDatabase & pricing.getDailyPriceFromDatabase

  // ✅ UPDATED: Calculate print cost only if enabled
  const calculatePrintCost = (billboard: Billboard): number => {
    if (!printCostEnabled || !printPricePerMeter || printPricePerMeter <= 0) return 0;
    
    const size = (billboard.Size || '') as string;
    const faces = Number(billboard.Faces_Count || 1);
    
    const sizeMatch = size.match(/(\d+(?:[.,]\d+)?)\s*[xX×\-]\s*(\d+(?:[.,]\d+)?)/);
    if (!sizeMatch) return 0;
    
    const width = parseFloat(sizeMatch[1].replace(',', '.'));
    const height = parseFloat(sizeMatch[2].replace(',', '.'));
    const area = width * height;
    
    const costInLYD = area * faces * printPricePerMeter;
    return convertPrice(costInLYD);
  };

  const selectedBillboardsSet = useMemo(() => new Set(selected), [selected]);

  // ✅ NEW: Calculate print cost total
  const printCostTotal = React.useMemo(() => {
    if (!printCostEnabled) return 0;
    return billboards
      .filter((b) => selected.includes(String(b.ID)))
      .reduce((sum, b) => sum + calculatePrintCost(b), 0);
  }, [billboards, selected, printCostEnabled, printPricePerMeter, contractCurrency, exchangeRate]);

  // ✅ UNIFIED: Contract calculations using unified pricing hook
  const estimatedTotalWithPrint = React.useMemo(() => {
    const sel = billboards.filter((b) => selected.includes(String(b.ID)));
    return sel.reduce((acc, b) => {
      const basePrice = pricing.calculateBillboardPrice(
        b,
        formData.pricingMode,
        formData.durationMonths,
        formData.durationDays,
        formData.pricingCategory,
        convertPrice
      );
      const printCost = calculatePrintCost(b);
      return acc + basePrice + printCost;
    }, 0);
  }, [billboards, selected, formData.durationMonths, formData.durationDays, formData.pricingMode, formData.pricingCategory, pricing.pricingData, printCostEnabled, printPricePerMeter, contractCurrency, exchangeRate]);

  const calculations = useContractCalculations({
    formData,
    selected,
    billboards,
    userEditedRentCost,
    installationCost,
    installationEnabled,
    pricingData: pricing.pricingData,
    getPriceFromDatabase: pricing.getPriceFromDatabase,
    getDailyPriceFromDatabase: pricing.getDailyPriceFromDatabase,
    onRentCostChange: (cost) => updateFormData({ rentCost: cost }),
    customEstimatedTotal: estimatedTotalWithPrint,
    convertPrice
  });

  // ✅ NEW: Calculate rental cost only
  const rentalCostOnly = React.useMemo(() => {
    const actualInstallationCost = installationEnabled ? convertPrice(installationCost) : 0;
    return Math.max(0, calculations.finalTotal - actualInstallationCost - printCostTotal);
  }, [calculations.finalTotal, installationCost, installationEnabled, printCostTotal, exchangeRate]);

  // ✅ NEW: Friend costs and operating fee calculations
  const totalFriendCosts = React.useMemo(() => {
    return friendBillboardCosts
      .filter(f => selected.includes(f.billboardId))
      .reduce((sum, f) => sum + f.friendRentalCost, 0);
  }, [friendBillboardCosts, selected]);

  const friendOperatingFeeAmount = React.useMemo(() => {
    if (!friendRentalOperatingFeeEnabled || friendBillboardCosts.length === 0) return 0;
    return Math.round(totalFriendCosts * (friendRentalOperatingFeeRate / 100));
  }, [friendRentalOperatingFeeEnabled, totalFriendCosts, friendRentalOperatingFeeRate]);

  // ✅ FIXED: Calculate operating fee based on installationEnabled and include friend operating fee
  const operatingFee = React.useMemo(() => {
    // When installation is disabled, calculate from finalTotal - printCost
    // When installation is enabled, calculate from rentalCostOnly
    const baseForFee = !installationEnabled ? calculations.finalTotal - printCostTotal : rentalCostOnly;
    // ✅ طرح تكاليف اللوحات الصديقة من وعاء النسبة العادية لمنع التكرار
    const regularRentalBase = Math.max(0, baseForFee - totalFriendCosts);
    const baseFee = Math.round(regularRentalBase * (operatingFeeRate / 100) * 100) / 100;
    return baseFee + friendOperatingFeeAmount;
  }, [installationEnabled, calculations.finalTotal, printCostTotal, rentalCostOnly, operatingFeeRate, friendOperatingFeeAmount, totalFriendCosts]);

  // Installments management hook
  const installmentManager = useContractInstallments({
    installments,
    setInstallments,
    finalTotal: calculations.finalTotal,
    calculateDueDate,
    startDate: formData.startDate,
    endDate: formData.endDate
  });

  // ✅ Installment distribution settings
  const [installmentDistributionType, setInstallmentDistributionType] = useState<'single' | 'multiple' | 'periods'>('multiple');
  const [installmentFirstPaymentAmount, setInstallmentFirstPaymentAmount] = useState<number>(0);
  const [installmentFirstPaymentType, setInstallmentFirstPaymentType] = useState<'amount' | 'percent'>('amount');
  const [installmentInterval, setInstallmentInterval] = useState<'month' | '2months' | '3months' | '4months' | '5months' | '6months' | '7months'>('month');
  const [installmentCount, setInstallmentCount] = useState<number>(2);
  const [installmentFirstAtSigning, setInstallmentFirstAtSigning] = useState<boolean>(true);
  const [hasDifferentFirstPayment, setHasDifferentFirstPayment] = useState<boolean>(false);

  // Helper to round installment values down to clean/closed numbers (nearest 500 for >=10k, nearest 100 for >=1k, etc.) to ensure the first payment is always the largest.
  const roundToCleanValue = (value: number): number => {
    if (value <= 0) return 0;
    if (value < 100) {
      return Math.floor(value);
    }
    if (value < 1000) {
      return Math.floor(value / 10) * 10;
    }
    if (value < 10000) {
      return Math.floor(value / 100) * 100;
    }
    return Math.floor(value / 500) * 500;
  };

  // ✅ Default installments initialization for creation (signature + 20% contract duration)
  useEffect(() => {
    if (calculations.finalTotal <= 0) return;
    
    if (installments.length === 0) {
      const cleanAmount = roundToCleanValue(calculations.finalTotal / 2);
      const firstAmount = Math.round((calculations.finalTotal - cleanAmount) * 100) / 100;
      
      let finalFirst = firstAmount;
      let finalSecond = cleanAmount;
      
      if (roundToCleanValue(firstAmount) !== firstAmount) {
        let cleanFirst = roundToCleanValue(firstAmount);
        const payment2 = Math.round((calculations.finalTotal - cleanFirst) * 100) / 100;
        
        if (cleanFirst < payment2) {
          let step = 500;
          if (cleanFirst < 100) step = 1;
          else if (cleanFirst < 1000) step = 10;
          else if (cleanFirst < 10000) step = 100;
          
          cleanFirst += step;
        }
        finalFirst = cleanFirst;
        finalSecond = Math.round((calculations.finalTotal - cleanFirst) * 100) / 100;
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
      console.log('✅ Created default installments for new contract:', finalFirst, finalSecond);
    }
  }, [calculations.finalTotal, installments.length]);

  // Get next contract number
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('Contract')
          .select('Contract_Number')
          .order('Contract_Number', { ascending: false })
          .limit(1);

        if (!error && data && data.length > 0) {
          const lastNumber = parseInt(data[0].Contract_Number) || 0;
          setNextContractNumber(String(lastNumber + 1));
        } else {
          setNextContractNumber('1');
        }
      } catch (e) {
        console.warn('Failed to get next contract number, using 1');
        setNextContractNumber('1');
      }
    })();
  }, []);

  // ✅ Load billboards with availability filter — cross-check active contracts
  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        // 1) Load billboards that look available based on their own fields
        const { data, error } = await supabase
          .from("billboards")
          .select(`
            "ID",
            "Billboard_Name",
            "Status",
            "Rent_End_Date",
            "Size",
            "Level",
            "Price",
            "Nearest_Landmark",
            "City",
            "Image_URL",
            "Faces_Count",
            "GPS_Coordinates",
            "size_id"
          `)
          .or(`"Rent_End_Date".is.null,"Rent_End_Date".lt.${today}`)
          .eq("Status", "متاح");

        if (error) {
          console.error("Supabase error:", error);
          toast.error('فشل تحميل اللوحات: ' + (error.message || 'تحقق من الشبكة'));
          setBillboards([]);
          setLoading(false);
          return;
        }

        // 2) Load active contracts to cross-check billboard_ids
        const { data: activeContracts } = await supabase
          .from('Contract')
          .select('Contract_Number, billboard_ids, "End Date"')
          .gte('End Date', today);

        // Build a set of billboard IDs that are in active contracts
        const occupiedIds = new Set<number>();
        if (activeContracts) {
          for (const contract of activeContracts) {
            const ids = contract.billboard_ids;
            if (ids && typeof ids === 'string') {
              ids.split(',').forEach((id: string) => {
                const num = parseInt(id.trim(), 10);
                if (!isNaN(num)) occupiedIds.add(num);
              });
            }
          }
        }

        // 3) Filter out billboards that are actually in active contracts
        const availableBillboards = (data || []).filter(
          (b: any) => !occupiedIds.has(b.ID)
        );

        console.log('✅ تم تحميل', data?.length || 0, 'لوحة، منها', availableBillboards.length, 'متاحة فعلياً بعد التحقق من العقود النشطة');
        setBillboards(availableBillboards);
      } catch (e: any) {
        console.error("Unexpected error:", e);
        toast.error(e?.message || 'فشل تحميل اللوحات');
        setBillboards([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ✅ Load pricing categories ONLY from DB
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('pricing_categories')
          .select('name')
          .order('name', { ascending: true });

        if (!error && Array.isArray(data)) {
          const categories = data.map((item: any) => item.name);
          setPricingCategories(categories);
        } else {
          setPricingCategories([]);
          toast.error('لم يتم العثور على فئات سعرية');
        }
      } catch (e) {
        console.error('Failed to load pricing categories:', e);
        setPricingCategories([]);
        toast.error('فشل تحميل فئات الأسعار');
      }
    })();
  }, []);

  // ✅ UNIFIED: Calculate billboard price using unified pricing hook
  const calculateBillboardPrice = (billboard: Billboard): number => {
    const basePrice = pricing.calculateBillboardPrice(
      billboard,
      formData.pricingMode,
      formData.durationMonths,
      formData.durationDays,
      formData.pricingCategory,
      convertPrice
    );
    const printCost = calculatePrintCost(billboard);
    return basePrice + printCost;
  };

  // Toggle billboard selection — مع كشف التعارض
  const toggleSelect = async (billboard: Billboard) => {
    const id = String(billboard.ID);

    // إذا كانت اللوحة محددة بالفعل → أزلها مباشرة بدون تحقق
    if (selected.includes(id)) {
      setSelected((prev) => prev.filter((x) => x !== id));
      return;
    }

    // التحقق من التعارض عند التواريخ المدخلة
    if (formData.startDate && formData.endDate) {
      const namesMap: Record<string, string> = { [id]: (billboard as any).Billboard_Name || (billboard as any).name || id };
      const conflicts = await checkBillboardConflicts(
        [id],
        formData.startDate,
        formData.endDate,
        undefined,
        namesMap
      );

      if (conflicts.length > 0) {
        setPendingConflictBillboard(billboard);
        setConflictList(conflicts);
        setConflictDialogOpen(true);
        return; // انتظر تأكيد المستخدم
      }
    }

    // لا تعارض → أضف مباشرة
    setSelected((prev) => [...prev, id]);
  };

  // Remove selected billboard
  const removeSelected = (id: string) => setSelected((prev) => prev.filter((x) => x !== id));

  // ✅ UNIFIED: Submit contract with better error handling
  const submit = async () => {
    try {
      console.log('🚀 Starting contract submission...');
      
      if (!formData.customerName || !formData.startDate || !formData.endDate || selected.length === 0) {
        toast.error('يرجى تعبئة بيانات الزبون والتواريخ واختيار لوحات');
        return;
      }

      const validation = installmentManager.validateInstallments();
      if (!validation.isValid) {
        toast.error(validation.message);
        return;
      }

      setSaving(true);
      console.log('✅ Validation passed, preparing payload...');

      const selectedBillboardsData = billboards
        .filter((b) => selected.includes(String(b.ID)))
        .map((b) => ({
          id: String(b.ID),
          name: b.Billboard_Name || '',
          location: b.Nearest_Landmark || '',
          city: b.City || '',
          size: b.Size || '',
          level: b.Level || '',
          price: Number(b.Price) || 0,
          image: b.Image_URL || '',
          contractPrice: calculateBillboardPrice(b),
          printCost: calculatePrintCost(b),
          pricingCategory: formData.pricingCategory,
          pricingMode: formData.pricingMode,
          duration: formData.pricingMode === 'months' ? formData.durationMonths : formData.durationDays
        }));

      const payload: any = {
        customer_name: formData.customerName,
        start_date: formData.startDate,
        end_date: formData.endDate,
        'Customer Name': formData.customerName,
        'Ad Type': formData.adType,
        'Contract Date': formData.startDate,
        'End Date': formData.endDate,
        'Duration': formData.pricingMode === 'months'
          ? `${formData.durationMonths} ${formData.durationMonths === 1 ? 'شهر' : 'أشهر'}`
          : `${formData.durationDays} يوم`,
        'Total': calculations.finalTotal,
        'Total Rent': rentalCostOnly,
        'Discount': calculations.discountAmount,
        ad_type: formData.adType,
        billboard_ids: selected,
        customer_category: formData.pricingCategory,
        billboards_data: JSON.stringify(selectedBillboardsData),
        billboards_count: selectedBillboardsData.length,
        // ✅ Store billboard prices with discount details for history
        billboard_prices: JSON.stringify(selectedBillboardsData.map(b => {
          const billboardPrice = b.contractPrice; // السعر قبل الخصم
          const discountPerBillboard = selected.length > 0 
            ? calculations.discountAmount * (billboardPrice / estimatedTotalWithPrint)
            : 0;
          
          return {
            billboardId: b.id,
            priceBeforeDiscount: billboardPrice,
            discountPerBillboard: discountPerBillboard,
            priceAfterDiscount: billboardPrice - discountPerBillboard,
            contractPrice: billboardPrice - discountPerBillboard,
            printCost: b.printCost,
            pricingCategory: b.pricingCategory,
            pricingMode: b.pricingMode,
            duration: b.duration
          };
        })),
        installments_data: installments,
        installation_cost: installationEnabled ? convertPrice(installationCost) : 0,
        installation_enabled: installationEnabled,
        print_cost: printCostTotal,
        print_cost_enabled: printCostEnabled,
        print_price_per_meter: printPricePerMeter,
        contract_currency: contractCurrency,
        exchange_rate: exchangeRate,
        fee: String(operatingFee),
        operating_fee_rate: operatingFeeRate,
        'Total Paid': 0,
        'Remaining': calculations.finalTotal,
        rent_cost: calculations.finalTotal,
        discount: calculations.discountAmount,
        billboard_designs: JSON.stringify(designs),
        pricing_mode: formData.pricingMode,
        duration_months: formData.pricingMode === 'months' ? formData.durationMonths : null,
        duration_days: formData.pricingMode === 'days' ? formData.durationDays : null,
        use_30_day_month: use30DayMonth,
        installment_distribution_type: installmentDistributionType,
        installment_first_payment_amount: installmentFirstPaymentAmount,
        installment_first_payment_type: installmentFirstPaymentType,
        installment_interval: installmentInterval,
        installment_count: installmentCount,
        installment_first_at_signing: installmentFirstAtSigning,
        friend_rental_data: friendBillboardCosts.length > 0 ? JSON.stringify(friendBillboardCosts) : null,
        friend_rental_includes_installation: friendRentalIncludesInstallation,
        friend_rental_operating_fee_enabled: friendRentalOperatingFeeEnabled,
        friend_rental_operating_fee_rate: friendRentalOperatingFeeRate,
      };
      
      if (formData.customerId) payload.customer_id = formData.customerId;
      
      console.log('📦 Payload prepared:', {
        customer: payload.customer_name,
        billboards: payload.billboard_ids?.length || 0,
        total: payload.Total,
        installments: payload.installments_data?.length || 0
      });
      
      console.log('💾 Calling createContract...');
      const result = await createContract(payload);
      console.log('✅ Contract created successfully:', result?.Contract_Number);
      
      toast.success(`تم إنشاء العقد بعملة ${getCurrentCurrency().name} بنجاح`);
      navigate('/admin/contracts');
    } catch (e: any) {
      console.error('❌ Contract creation error:', e);
      console.error('Error details:', {
        message: e?.message,
        details: e?.details,
        hint: e?.hint,
        code: e?.code
      });
      toast.error(e?.message || 'فشل إنشاء العقد');
    } finally {
      setSaving(false);
      console.log('🏁 Contract submission finished');
    }
  };

  const currentCurrency = getCurrentCurrency();

  return (
    <div className="container mx-auto px-4 py-6 space-y-6" dir="rtl">

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
          // المستخدم أكّد الإضافة رغم التحذير
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

      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-header">إنشاء عقد جديد {nextContractNumber && `#${nextContractNumber}`}</h1>
          <p className="page-subtitle">إنشاء عقد إيجار جديد مع نظام دفعات ديناميكي وتكلفة طباعة وعملات متعددة</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/admin/contracts')}>
            عودة
          </Button>
          <Button onClick={submit} className="btn-primary">
            إنشاء العقد
          </Button>
        </div>
      </div>
      
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Content */}
        <div className="flex-1 space-y-6">
          {/* Billboard Selection - Tabs for List and Map View */}
          <div className="expenses-preview-item flex flex-col h-[calc(100vh-160px)] min-h-[950px] border border-amber-500/20 shadow-[0_20px_50px_rgba(0,0,0,0.15)] bg-slate-950/40 backdrop-blur-xl rounded-3xl p-4">

            <h3 className="expenses-preview-label mb-2 shrink-0 text-amber-500 font-extrabold">اختيار اللوحات</h3>
            
            <div className="shrink-0 mb-2">
              <BillboardFilters
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                cityFilter={cityFilter}
                setCityFilter={setCityFilter}
                sizeFilter={sizeFilter}
                setSizeFilter={setSizeFilter}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                pricingCategory={formData.pricingCategory}
                setPricingCategory={(category) => updateFormData({ pricingCategory: category })}
                cities={cities}
                sizes={sizes}
                pricingCategories={pricingCategories}
                municipalities={municipalities}
                municipalityFilter={municipalityFilter}
                setMunicipalityFilter={setMunicipalityFilter}
                sizeFilters={sizeFilters}
                setSizeFilters={setSizeFilters}
                cityFilters={cityFilters}
                setCityFilters={setCityFilters}
                municipalityFilters={municipalityFilters}
                setMunicipalityFilters={setMunicipalityFilters}
                totalCount={billboards.length}
                selectedCount={selected.length}
              />
            </div>

            <Tabs value={viewMode} onValueChange={(val) => setViewMode(val as 'list' | 'map')} className="w-full flex-1 flex flex-col min-h-0">
              <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted/40 h-10 p-1 rounded-xl shrink-0">
                <TabsTrigger value="list" className="flex items-center justify-center gap-2 rounded-lg text-xs font-bold transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-amber-600 data-[state=active]:text-white data-[state=active]:shadow-md cursor-pointer">
                  <List className="h-4 w-4" />
                  عرض القائمة
                </TabsTrigger>
                <TabsTrigger value="map" className="flex items-center justify-center gap-2 rounded-lg text-xs font-bold transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-amber-600 data-[state=active]:text-white data-[state=active]:shadow-md cursor-pointer">
                  <MapIcon className="h-4 w-4" />
                  عرض الخريطة
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="list" className="flex-1 overflow-y-auto min-h-0 mt-0">
                <BillboardSelector
                  billboards={billboards}
                  selected={selected}
                  onToggleSelect={toggleSelect}
                  onRemoveSelected={removeSelected}
                  loading={loading}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  cityFilter={cityFilter}
                  setCityFilter={setCityFilter}
                  sizeFilter={sizeFilter}
                  setSizeFilter={setSizeFilter}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  pricingCategory={formData.pricingCategory}
                  setPricingCategory={(category) => updateFormData({ pricingCategory: category })}
                  pricingCategories={pricingCategories}
                  calculateBillboardPrice={calculateBillboardPrice}
                  installationDetails={installationDetails}
                  pricingMode={formData.pricingMode}
                  durationMonths={formData.durationMonths}
                  durationDays={formData.durationDays}
                  currencySymbol={currentCurrency.symbol}
                  hideFilters={true}
                />
              </TabsContent>
              
              <TabsContent value="map" className="flex-1 min-h-0 mt-0">
                <div className="relative w-full h-[700px] lg:h-[800px]">
                  <SelectableGoogleHomeMap
                    className="w-full h-full"
                    hideInternalFilters
                    billboards={filteredBillboards.map(b => ({
                      ...b,
                      id: String(b.ID || ''),
                      name: b.Billboard_Name || '',
                      location: b.Nearest_Landmark || '',
                      size: b.Size || '',
                      status: (b.Status === 'متاح' || b.Status === 'available') ? 'available' : 'rented',
                      coordinates: (b as any).GPS_Coordinates || '',
                      imageUrl: b.Image_URL || '',
                      expiryDate: (b as any).Rent_End_Date || null,
                      area: (b as any).District || '',
                      municipality: b.Municipality || '',
                      Customer_Name: (b as any).Customer_Name || '',
                      Ad_Type: (b as any).Ad_Type || '',
                      size_id: (b as any).size_id || null,
                    })) as Billboard[]}
                    selectedBillboards={selectedBillboardsSet}
                    onToggleSelection={(id) => {
                      const billboard = billboards.find((b: any) => String(b.ID) === id);
                      if (billboard) toggleSelect(billboard);
                    }}
                    onSelectMultiple={(billboardIds) => {
                      billboardIds.forEach(id => {
                        const billboard = billboards.find((b: any) => String(b.ID) === id);
                        if (billboard && !selected.includes(String(billboard.ID))) {
                          toggleSelect(billboard);
                        }
                      });
                    }}
                    onSelectAll={() => {
                      const availableIds = billboards
                        .filter(b => b.Status === 'متاح')
                        .map(b => String(b.ID));
                      setSelected(availableIds);
                      toast.success(`تم تحديد ${availableIds.length} لوحة`);
                    }}
                    onClearAll={() => {
                      setSelected([]);
                      toast.info('تم إلغاء تحديد جميع اللوحات');
                    }}
                    pricingMode={formData.pricingMode}
                    durationMonths={formData.durationMonths}
                    durationDays={formData.durationDays}
                    pricingCategory={formData.pricingCategory}
                    calculateBillboardPrice={calculateBillboardPrice}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Currency Selection */}
          <div className="expenses-preview-item">
            <div className="flex items-center justify-between mb-3">
              <h3 className="expenses-preview-label flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                إعدادات العملة
              </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="expenses-form-label block mb-2">عملة العقد</label>
                <Select value={contractCurrency} onValueChange={setContractCurrency}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="اختر العملة" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>
                        {currency.symbol} - {currency.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="expenses-form-label block mb-2">سعر الصرف (1 د.ل = ؟ {contractCurrency})</label>
                <input
                  type="number"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(Number(e.target.value) || 1)}
                  className="w-full px-4 py-3 rounded bg-input border border-border text-card-foreground font-medium"
                  placeholder="1"
                  min="0"
                  step="0.01"
                />
              </div>
              
              <div>
                <label className="expenses-form-label block mb-2">العملة المعروضة</label>
                <div className="px-4 py-3 rounded bg-muted text-card-foreground font-bold flex items-center gap-2">
                  <span className="text-2xl">{currentCurrency.symbol}</span>
                  <span>{currentCurrency.name}</span>
                </div>
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded mt-4">
              <div className="font-medium mb-1">مثال على التحويل:</div>
              <div>1,000 د.ل × {exchangeRate} = {convertPrice(1000).toLocaleString()} {currentCurrency.symbol}</div>
            </div>
          </div>

          {/* Print Cost */}
          <div className="expenses-preview-item">
            <div className="flex items-center justify-between mb-3">
              <h3 className="expenses-preview-label">تكلفة الطباعة</h3>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">تفعيل تكلفة الطباعة</label>
                <button
                  type="button"
                  onClick={() => setPrintCostEnabled(!printCostEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    printCostEnabled ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      printCostEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
            
            <div className={`text-sm p-2 rounded mb-3 ${
              printCostEnabled 
                ? 'text-green-700 bg-green-50 border border-green-200' 
                : 'text-gray-600 bg-gray-50 border border-gray-200'
            }`}>
 <strong>الحالة الحالية:</strong> تكلفة الطباعة {printCostEnabled ? 'مفعلة ' : 'غير مفعلة '}
            </div>
            
            {printCostEnabled && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="expenses-form-label block mb-2">سعر المتر للطباعة ({currentCurrency.symbol})</label>
                    <input
                      type="number"
                      value={printPricePerMeter}
                      onChange={(e) => setPrintPricePerMeter(Number(e.target.value) || 0)}
                      className="w-full px-4 py-3 rounded bg-input border border-border text-card-foreground font-medium"
                      placeholder="0"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="expenses-form-label block mb-2">إجمالي تكلفة الطباعة</label>
                    <div className="px-4 py-3 rounded bg-muted text-card-foreground font-bold">
                      {printCostTotal.toLocaleString('en-US')} {currentCurrency.symbol}
                    </div>
                  </div>
                </div>
                
                {printPricePerMeter > 0 && selected.length > 0 && (
                  <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                    <div className="font-medium mb-2">تفاصيل تكلفة الطباعة للوحات المختارة:</div>
                    <div className="space-y-1">
                      {billboards
                        .filter(b => selected.includes(String(b.ID)))
                        .map(b => {
                          const printCost = calculatePrintCost(b);
                          const size = (b.Size || '') as string;
                          const faces = Number(b.Faces_Count || 1);
                          const sizeMatch = size.match(/(\d+(?:[.,]\d+)?)\s*[xX×\-]\s*(\d+(?:[.,]\d+)?)/);
                          const area = sizeMatch ? parseFloat(sizeMatch[1]) * parseFloat(sizeMatch[2]) : 0;
                          
                          return (
                            <div key={b.ID} className="text-xs">
                              <strong>{b.Billboard_Name}:</strong> {area}م² × {faces} وجه × {printPricePerMeter} = {printCost.toLocaleString()} {currentCurrency.symbol}
                            </div>
                          );
                        })
                      }
                    </div>
                  </div>
                )}
                
                <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
 عند تفعيل تكلفة الطباعة، سيتم إضافة التكلفة تلقائياً إلى سعر كل لوحة وستظهر في العقد المطبوع كـ "شاملة تكاليف الطباعة"
                </div>
              </div>
            )}
            
            {!printCostEnabled && (
              <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                تكلفة الطباعة غير مفعلة. العقد سيظهر كـ "غير شاملة تكاليف الطباعة"
              </div>
            )}
          </div>

          {/* Design Manager - إدارة تصاميم اللوحات */}
          <DesignManager
            selectedBillboards={billboards
              .filter((b) => selected.includes(String(b.ID)))
              .map((b) => ({
                id: String(b.ID),
                name: b.Billboard_Name || '',
                Image_URL: (b as any).Image_URL,
                image: (b as any).image,
                Nearest_Landmark: (b as any).Nearest_Landmark,
                nearest_landmark: (b as any).nearest_landmark
              }))
            }
            designs={designs}
            onChange={setDesigns}
            contractId={nextContractNumber}
          />

          {/* Operating Fee Settings */}
          <div className="expenses-preview-item">
            <div className="flex items-center justify-between mb-3">
              <h3 className="expenses-preview-label flex items-center gap-2">
                <Settings className="h-5 w-5" />
                إعدادات رسوم التشغيل
              </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="expenses-form-label block mb-2">نسبة التشغيل (%)</label>
                <input
                  type="number"
                  value={operatingFeeRate}
                  onChange={(e) => setOperatingFeeRate(Number(e.target.value) || 3)}
                  className="w-full px-4 py-3 rounded bg-input border border-border text-card-foreground font-medium"
                  placeholder="3"
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>
              
              <div>
                <label className="expenses-form-label block mb-2">صافي الإيجار (أساس الحساب)</label>
                <div className="px-4 py-3 rounded bg-muted text-card-foreground font-bold">
                  {rentalCostOnly.toLocaleString('en-US')} {currentCurrency.symbol}
                </div>
              </div>
              
              <div>
                <label className="expenses-form-label block mb-2">رسوم التشغيل المحسوبة</label>
                <div className="px-4 py-3 rounded bg-primary/10 text-primary font-bold">
                  {operatingFee.toLocaleString('en-US')} {currentCurrency.symbol}
                </div>
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded mt-4">
              <div className="font-medium mb-1">طريقة الحساب:</div>
              <div>رسوم التشغيل = صافي الإيجار × {operatingFeeRate}% = {rentalCostOnly.toLocaleString()} × {operatingFeeRate}% = {operatingFee.toLocaleString()} {currentCurrency.symbol}</div>
              <div className="text-xs mt-2 text-blue-600">
 صافي الإيجار = الإجمالي النهائي - تكلفة التركيب - تكلفة الطباعة - الخصم
              </div>
            </div>
          </div>

          
          {/* Installation Cost Summary */}
          <div className="expenses-preview-item">
            <div className="flex items-center justify-between mb-4">
              <h3 className="expenses-preview-label">ملخص تكلفة التركيب</h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={installationEnabled}
                  onChange={(e) => setInstallationEnabled(e.target.checked)}
                  className="w-5 h-5 rounded border-border"
                />
                <span className="text-sm font-medium">تفعيل التركيب</span>
              </label>
            </div>
            
            {installationEnabled && installationCost > 0 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="expenses-form-label block mb-2">إجمالي تكلفة التركيب</label>
                    <div className="px-4 py-3 rounded bg-orange/10 text-orange font-bold">
                      {convertPrice(installationCost).toLocaleString('en-US')} {currentCurrency.symbol}
                    </div>
                  </div>
                  
                  <div>
                    <label className="expenses-form-label block mb-2">عدد اللوحات</label>
                    <div className="px-4 py-3 rounded bg-muted text-card-foreground font-bold">
                      {selected.length} لوحة
                    </div>
                  </div>
                </div>

                {installationDetails.length > 0 && (
                  <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                    <div className="font-medium mb-2">تفاصيل تكلفة التركيب حسب المقاس:</div>
                    <div className="space-y-1">
                      {Array.from(new Map(installationDetails.map(detail => [detail.size, detail])).values())
                        .map((detail, index) => {
                          const sizeCount = installationDetails.filter(d => d.size === detail.size).length;
                          const totalForSize = detail.installationPrice * sizeCount;
                          const convertedPrice = convertPrice(totalForSize);
                          
                          return (
                            <div key={index} className="text-xs flex justify-between">
                              <span><strong>مقاس {detail.size}:</strong> {detail.installationPrice.toLocaleString()} د.ل × {sizeCount} لوحة</span>
                              <span className="font-bold">{convertedPrice.toLocaleString()} {currentCurrency.symbol}</span>
                            </div>
                          );
                        })
                      }
                    </div>
                  </div>
                )}
              </>
            )}
            
            {!installationEnabled && (
              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
 <div className="font-medium">️ التركيب غير مفعل</div>
                <div className="text-xs mt-2">
                  عند إلغاء التركيب، سيتم حساب نسبة التشغيل من الإجمالي الكلي (صافي الإيجار = الإجمالي الكلي)
                </div>
              </div>
            )}
          </div>

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
              currencySymbol={getCurrentCurrency().symbol}
              operatingFeeEnabled={friendRentalOperatingFeeEnabled}
              operatingFeeRate={friendRentalOperatingFeeRate}
              onOperatingFeeEnabledChange={setFriendRentalOperatingFeeEnabled}
              onOperatingFeeRateChange={setFriendRentalOperatingFeeRate}
              operatingFeeAmount={friendOperatingFeeAmount}
            />
          )}
        </div>

        {/* Sidebar */}
        <ContractFormSidebar
          formData={formData}
          updateFormData={updateFormData}
          pricingCategories={pricingCategories}
          installments={installments}
          setInstallments={setInstallments}
          updateInstallment={updateInstallment}
          estimatedTotal={estimatedTotalWithPrint}
          baseTotal={calculations.baseTotal}
          discountAmount={calculations.discountAmount}
          totalAfterDiscount={calculations.totalAfterDiscount}
          rentalCostOnly={rentalCostOnly}
          finalTotal={calculations.finalTotal}
          operatingFee={operatingFee}
          installationCost={convertPrice(installationCost)}
          userEditedRentCost={userEditedRentCost}
          setUserEditedRentCost={setUserEditedRentCost}
          onSubmit={submit}
          onCancel={() => navigate('/admin/contracts')}
          saving={saving}
          submitLabel="إنشاء العقد"
          distributeEvenly={installmentManager.distributeEvenly}
          onDistributeWithInterval={installmentManager.distributeWithInterval}
          onDistributeByDurationPeriods={installmentManager.distributeByDurationPeriods}
          onCreateManualInstallments={installmentManager.createManualInstallments}
          onApplyUnequalDistribution={(payments) => {
            setInstallments(payments.map(p => ({
              amount: p.amount,
              paymentType: p.paymentType,
              description: p.description,
              dueDate: p.dueDate
            })));
          }}
          addInstallment={installmentManager.addInstallment}
          removeInstallment={installmentManager.removeInstallment}
          clearAllInstallments={installmentManager.clearAllInstallments}
          calculateDueDate={calculateDueDate}
          installmentSummary={installmentManager.getInstallmentSummary()}
          savedDistributionType={installmentDistributionType}
          savedFirstPaymentAmount={installmentFirstPaymentAmount}
          savedFirstPaymentType={installmentFirstPaymentType}
          savedInterval={installmentInterval}
          savedCount={installmentCount}
          savedHasDifferentFirstPayment={hasDifferentFirstPayment}
          savedFirstAtSigning={installmentFirstAtSigning}
          onDistributionTypeChange={setInstallmentDistributionType}
          onFirstPaymentAmountChange={setInstallmentFirstPaymentAmount}
          onFirstPaymentTypeChange={setInstallmentFirstPaymentType}
          onIntervalChange={setInstallmentInterval}
          onCountChange={setInstallmentCount}
          onHasDifferentFirstPaymentChange={setHasDifferentFirstPayment}
          onFirstAtSigningChange={setInstallmentFirstAtSigning}
          use30DayMonth={use30DayMonth}
          setUse30DayMonth={setUse30DayMonth}
          currencySymbol={currentCurrency.symbol}
        />
      </div>
    </div>
  );
}