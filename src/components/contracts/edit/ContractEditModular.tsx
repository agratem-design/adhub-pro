import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { smartArabicMatch } from '@/lib/arabicSearch';
import { getBillboardsSortMaps, sortBillboardsStandardSync } from '@/lib/billboardSorter';
import { loadBillboards } from '@/services/billboardService';
import { addBillboardsToContract, getContractWithBillboards, removeBillboardFromContract, updateContract } from '@/services/contractService';
import { calculateInstallationCostFromIds } from '@/services/installationService';
import { getPriceFor, getDailyPriceFor, CustomerType } from '@/data/pricing';
import { useContractPricing } from '@/hooks/useContractPricing';
import { usePausedBillboardsPricing } from '@/hooks/usePausedBillboardsPricing';
import { calculateAllBillboardPrices } from '@/utils/contractBillboardPricing';
import { useStableReference } from '@/hooks/useStableMemo';
import { ContractPDFDialog } from '@/components/Contract';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { Billboard } from '@/types';

// Import modular components
import { ContractEditHeader } from '@/components/contracts/edit/ContractEditHeader';
import { SelectedBillboardsCard } from '@/components/contracts/edit/SelectedBillboardsCard';
import { InstallationCostSummary } from '@/components/contracts/InstallationCostSummary';
import { PrintCostSummary } from '@/components/contracts/edit/PrintCostSummary';
import { BillboardFilters } from '@/components/contracts/edit/BillboardFilters';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ContractHistoryTab } from '@/components/contracts/edit/ContractHistoryTab';
import { AvailableBillboardsGrid } from '@/components/contracts/edit/AvailableBillboardsGrid';
import { CustomerInfoForm } from '@/components/contracts/edit/CustomerInfoForm';
import { ContractDatesForm } from '@/components/contracts/edit/ContractDatesForm';
import { InstallmentsManager } from '@/components/contracts/edit/InstallmentsManager';
import { CostSummaryCard } from '@/components/contracts/edit/CostSummaryCard';
import { BillboardManagementMap } from '@/components/Map/BillboardManagementMap';
import { isBillboardAvailable as utilIsAvailable } from '@/utils/contractUtils';

export default function ContractEditModular() {
  const navigate = useNavigate();
  const location = useLocation();

  // Core state
  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [occupiedBillboardIds, setOccupiedBillboardIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [contractNumber, setContractNumber] = useState<string>('');
  const [currentContract, setCurrentContract] = useState<any>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [singleFaceBillboards, setSingleFaceBillboards] = useState<Set<string>>(new Set());

  // Customer data
  const [customers, setCustomers] = useState<{ id: string; name: string; company?: string; phone?: string }[]>([]);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerCompany, setCustomerCompany] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [adType, setAdType] = useState('');

  // ✅ UNIFIED: Use unified pricing hook
  const pricing = useContractPricing();
  
  // Pricing and categories
  const [pricingCategories, setPricingCategories] = useState<string[]>([]);
  const [pricingCategory, setPricingCategory] = useState<string>('عادي');

  // Installation and operating costs
  const [installationCost, setInstallationCost] = useState<number>(0);
  const [installationEnabled, setInstallationEnabled] = useState<boolean>(true);
  const [installationDetails, setInstallationDetails] = useState<Array<{
    billboardId: string;
    billboardName: string;
    size: string;
    installationPrice: number;
    faces?: number;
    adjustedPrice?: number;
  }>>([]);
  const [operatingFee, setOperatingFee] = useState<number>(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [municipalityFilter, setMunicipalityFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [sizeFilters, setSizeFilters] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('available');

  // تعارضات الحالة مع بيانات العقد
  const conflicts = useMemo(() => {
    return billboards.filter((b: any) => {
      const st = String((b.Status || b.status || '')).trim();
      const available = utilIsAvailable(b);
      if (st === 'متاح' || st.toLowerCase() === 'available') {
        return !available; // تظهر متاحة بالحالة لكن غير متاحة فعلياً
      }
      if (st === 'مؤجر' || st.toLowerCase() === 'rented') {
        return available; // تظهر مؤجرة بالحالة لكن متاحة فعلياً
      }
      return false;
    });
  }, [billboards]);
  const [showConflicts, setShowConflicts] = useState(false);
  // Contract form data
  const [startDate, setStartDate] = useState('');
  const [pricingMode, setPricingMode] = useState<'months' | 'days'>('months');
  const [durationMonths, setDurationMonths] = useState<number>(3);
  const [durationDays, setDurationDays] = useState<number>(0);
  const [endDate, setEndDate] = useState('');
  const [rentCost, setRentCost] = useState<number>(0);
  const [userEditedRentCost, setUserEditedRentCost] = useState(false);
  const [originalTotal, setOriginalTotal] = useState<number>(0);
  // ✅ NEW: Store the saved base rent from database (before any deductions)
  const [savedBaseRent, setSavedBaseRent] = useState<number | null>(null);
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [discountValue, setDiscountValue] = useState<number>(0);

  // Installments
  const [installments, setInstallments] = useState<Array<{ 
    amount: number; 
    paymentType: string; 
    description: string; 
    dueDate: string; 
  }>>([]);

  // Friend company costs state
  const [friendBillboardCosts, setFriendBillboardCosts] = useState<Array<{
    billboardId: string;
    friendCompanyId: string;
    friendCompanyName: string;
    friendRentalCost: number;
  }>>([]);
  const [friendCostsSaveState, setFriendCostsSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Print cost state
  const [printCostEnabled, setPrintCostEnabled] = useState<boolean>(false);
  const [printPricePerMeter, setPrintPricePerMeter] = useState<number>(0);
  const [customPrintCosts, setCustomPrintCosts] = useState<Map<string, number>>(new Map());
  
  // ✅ Include costs in price state
  const [includePrintInPrice, setIncludePrintInPrice] = useState<boolean>(true);
  const [includeInstallationInPrice, setIncludeInstallationInPrice] = useState<boolean>(true);

  // Load contract number from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cn = params.get('contract');
    if (cn) setContractNumber(String(cn));
  }, [location.search]);

  // Load billboards
  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const [data, contractsResult] = await Promise.all([
          loadBillboards(),
          supabase.from('Contract').select('Contract_Number, billboard_ids, "End Date"').gte('End Date', today)
        ]);
        setBillboards(data);

        const occupied = new Set<number>();
        if (contractsResult.data) {
          for (const contract of contractsResult.data) {
            // استثناء العقد الحالي المُحرَّر حتى لا تُحجب لوحاته
            if (contractNumber && String(contract.Contract_Number) === String(contractNumber)) continue;
            const ids = contract.billboard_ids;
            if (ids && typeof ids === 'string') {
              ids.split(',').forEach((id: string) => {
                const num = parseInt(id.trim(), 10);
                if (!isNaN(num)) occupied.add(num);
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

  // ✅ REMOVED: Now using unified pricing hook

  // Load contract data
  useEffect(() => {
    (async () => {
      if (!contractNumber) return;
      try {
        const c = await getContractWithBillboards(contractNumber);
        setCurrentContract(c);
        setCustomerName(c.customer_name || c['Customer Name'] || '');
        setCustomerId(c.customer_id ?? null);
        setCustomerCompany(c.Company || null);
        setCustomerPhone(c.Phone || null);
        setAdType(c.ad_type || c['Ad Type'] || '');
        
        const savedPricingCategory = c.customer_category || 'عادي';
        setPricingCategory(savedPricingCategory);
        
        // Load print cost settings
        setPrintCostEnabled(Boolean(c.print_cost_enabled));
        setIncludePrintInPrice(c.include_print_in_billboard_price !== false);
        setIncludeInstallationInPrice(c.include_installation_in_price !== false);
        const savedPrintPrice = Number(c.print_price_per_meter || 0);
        setPrintPricePerMeter(savedPrintPrice);
        
        // Load custom print costs if available
        if (c.print_cost_details) {
          try {
            const details = typeof c.print_cost_details === 'string' 
              ? JSON.parse(c.print_cost_details) 
              : c.print_cost_details;
            const customCosts = new Map<string, number>();
            Object.entries(details).forEach(([size, data]: [string, any]) => {
              if (data.unitCost) {
                customCosts.set(size, data.unitCost);
              }
            });
            setCustomPrintCosts(customCosts);
          } catch (e) {
            console.error('Failed to parse print_cost_details:', e);
          }
        }
        
        const s = c.start_date || c['Contract Date'] || '';
        const e = c.end_date || c['End Date'] || '';
        setStartDate(s);
        setEndDate(e);
        
        if (s && e) {
          const sd = new Date(s);
          const ed = new Date(e);
          if (!isNaN(sd.getTime()) && !isNaN(ed.getTime())) {
            const diffTime = Math.abs(ed.getTime() - sd.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const diffMonths = Math.round(diffDays / 30);
            
            if (diffMonths >= 1) {
              setPricingMode('months');
              setDurationMonths(diffMonths);
            } else {
              setPricingMode('days');
              setDurationDays(diffDays);
            }
          }
        }
        
        // ✅ FIXED: Load base_rent FIRST (the original rental price before deductions)
        const baseRentFromDB = Number(c.base_rent || 0);
        if (baseRentFromDB > 0) {
          setSavedBaseRent(baseRentFromDB);
 setRentCost(baseRentFromDB); // Use base_rent as rentCost, NOT Total Rent
          setOriginalTotal(Number(c['Total Rent'] || 0)); // Keep original final total for comparison
          console.log('✅ Loaded base_rent from DB:', baseRentFromDB);
        } else {
          // ❌ No base_rent saved - use Total Rent temporarily but mark for recalculation
          const savedTotal = typeof c.rent_cost === 'number' ? c.rent_cost : Number(c['Total Rent'] || 0);
          setRentCost(savedTotal);
          setOriginalTotal(savedTotal || 0);
          console.log('⚠️ No base_rent in DB, rentCost set from Total Rent:', savedTotal);
          console.log('⚠️ Will calculate fresh from pricing table');
        }
        
        const disc = Number(c.Discount ?? 0);
        if (!isNaN(disc) && disc > 0) {
          setDiscountType('amount');
          setDiscountValue(disc);
        }

        const existingFee = Number(c.fee || 0);
        if (existingFee > 0) {
          setOperatingFee(existingFee);
        }

        // ✅ Load installation enabled from contract (default true if not set)
        const savedInstallationEnabled = c.installation_enabled !== false && c.installation_enabled !== 0 && c.installation_enabled !== "false";
        setInstallationEnabled(savedInstallationEnabled);
        console.log('✅ MODULAR: Loading installation enabled:', savedInstallationEnabled);

        setSelected((c.billboards || []).map((b: any) => String(b.ID)));
        
        // Load friend billboard costs from contract JSONB, then fallback to synced rentals table
        const storedFriendRentalData = typeof c.friend_rental_data === 'string'
          ? (() => { try { return JSON.parse(c.friend_rental_data); } catch { return []; } })()
          : c.friend_rental_data;
        if (Array.isArray(storedFriendRentalData) && storedFriendRentalData.length > 0) {
          setFriendBillboardCosts(storedFriendRentalData);
        } else {
          const { data: friendRentals } = await supabase
            .from('friend_billboard_rentals')
            .select('billboard_id, friend_company_id, friend_rental_cost, friend_companies(name)')
            .eq('contract_number', Number(contractNumber));
          if (Array.isArray(friendRentals) && friendRentals.length > 0) {
            setFriendBillboardCosts(friendRentals.map((r: any) => ({
              billboardId: String(r.billboard_id),
              friendCompanyId: r.friend_company_id,
              friendCompanyName: r.friend_companies?.name || 'غير محدد',
              friendRentalCost: Number(r.friend_rental_cost) || 0,
            })));
          }
        }
        
        // ✅ Load single face billboards
        if (c.single_face_billboards) {
          try {
            const ids = typeof c.single_face_billboards === 'string'
              ? JSON.parse(c.single_face_billboards)
              : c.single_face_billboards;
            if (Array.isArray(ids)) setSingleFaceBillboards(new Set(ids.map(String)));
          } catch (e) {
            console.warn('Failed to parse single_face_billboards:', e);
          }
        }
        
        if (c.installments_data && Array.isArray(c.installments_data)) {
          setInstallments(c.installments_data);
        } else {
          // Calculate due date helper
          const calcDueDate = (type: string, index: number, start: string) => {
            const date = new Date(start);
            if (type === 'شهري') {
              date.setMonth(date.getMonth() + index);
            }
            return date.toISOString().split('T')[0];
          };

          const payments = [];
          if (c['Payment 1']) payments.push({ 
            amount: c['Payment 1'], 
            paymentType: 'شهري', 
            description: 'الدفعة الأولى',
            dueDate: calcDueDate('شهري', 0, s)
          });
          if (c['Payment 2']) payments.push({ 
            amount: c['Payment 2'], 
            paymentType: 'شهري', 
            description: 'الدفعة الثانية',
            dueDate: calcDueDate('شهري', 1, s)
          });
          if (c['Payment 3']) payments.push({ 
            amount: c['Payment 3'], 
            paymentType: 'شهري', 
            description: 'الدفعة الثالثة',
            dueDate: calcDueDate('شهري', 2, s)
          });
          setInstallments(payments);
        }
        
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || 'تعذر تحميل العقد');
      }
    })();
  }, [contractNumber]);

  // Calculate installation cost when selected billboards change
  useEffect(() => {
    if (selected.length > 0) {
      (async () => {
        try {
          const result = await calculateInstallationCostFromIds(selected);
          setInstallationCost(result.totalInstallationCost);
          setInstallationDetails(result.installationDetails);
        } catch (e) {
          console.warn('Failed to calculate installation cost:', e);
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
      const days = Math.max(0, Number(durationMonths || 0)) * 30;
      end.setDate(end.getDate() + days);
    } else {
      const days = Math.max(0, Number(durationDays || 0));
      end.setDate(end.getDate() + days);
    }
    const iso = end.toISOString().split('T')[0];
    setEndDate(iso);
  }, [startDate, durationMonths, durationDays, pricingMode]);

  // ✅ REMOVED: Now using unified pricing hook - pricing.getPriceFromDatabase & pricing.getDailyPriceFromDatabase

  // ✅ UNIFIED: Calculate billboard price using unified pricing hook
  const calculateBillboardPrice = (billboard: Billboard): number => {
    return pricing.calculateBillboardPrice(
      billboard,
      pricingMode,
      durationMonths,
      durationDays,
      pricingCategory
    );
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

  // Calculations
  const cities = useMemo(() => Array.from(new Set(billboards.map(b => (b as any).city || (b as any).City))).filter(Boolean) as string[], [billboards]);
  const municipalities = useMemo(() => Array.from(new Set(billboards.map(b => (b as any).municipality || (b as any).Municipality))).filter(Boolean) as string[], [billboards]);
  const sizes = useMemo(() => Array.from(new Set(billboards.map(b => String((b as any).size || (b as any).Size || '').trim()))).filter(Boolean).sort() as string[], [billboards]);

  // ✅ Calculate estimated total from pricing table (for new calculations or when refreshing)
  const calculatedEstimatedTotal = useMemo(() => {
    const sel = billboards.filter((b) => selected.includes(String((b as any).ID)));
    if (pricingMode === 'months') {
      const months = Math.max(0, Number(durationMonths || 0));
      if (!months) return 0;
      return sel.reduce((acc, b) => {
        // ✅ FIXED: Get sizeId for accurate price lookup
        const sizeId = (b as any).size_id || (b as any).Size_ID || null;
        const size = (b.size || (b as any).Size || '') as string;
        const level = ((b as any).level || (b as any).Level) as any;
        
        // ✅ FIXED: Use sizeId instead of size name
        let price = pricing.getPriceFromDatabase(sizeId, level, pricingCategory, months);
        if (price === null) {
          price = getPriceFor(size, level, pricingCategory as CustomerType, months);
        }
        if (price !== null) return acc + price;
        
        const monthly = Number((b as any).price) || 0;
        return acc + monthly * months;
      }, 0);
    } else {
      const days = Math.max(0, Number(durationDays || 0));
      if (!days) return 0;
      return sel.reduce((acc, b) => {
        // ✅ FIXED: Get sizeId for accurate price lookup
        const sizeId = (b as any).size_id || (b as any).Size_ID || null;
        const size = (b.size || (b as any).Size || '') as string;
        const level = ((b as any).level || (b as any).Level) as any;
        
        // ✅ FIXED: Use sizeId instead of size name
        let daily = pricing.getDailyPriceFromDatabase(sizeId, level, pricingCategory);
        if (daily === null) {
          daily = getDailyPriceFor(size, level, pricingCategory as CustomerType);
        }
        if (daily === null) {
          // ✅ FIXED: Use sizeId instead of size name
          let monthlyPrice = pricing.getPriceFromDatabase(sizeId, level, pricingCategory, 1);
          if (monthlyPrice === null) {
            monthlyPrice = getPriceFor(size, level, pricingCategory as CustomerType, 1) || 0;
          }
          daily = monthlyPrice ? Math.round((monthlyPrice / 30) * 100) / 100 : 0;
        }
        
        return acc + (daily || 0) * days;
      }, 0);
    }
  }, [billboards, selected, durationMonths, durationDays, pricingMode, pricingCategory, pricing.pricingData]);

  // ✅ Use saved base rent if available, otherwise use calculated value
  const estimatedTotal = useMemo(() => {
    if (calculatedEstimatedTotal > 0) {
      console.log('📊 Using calculatedEstimatedTotal:', calculatedEstimatedTotal);
      return calculatedEstimatedTotal;
    }
    console.log('📊 Using savedBaseRent fallback:', savedBaseRent);
    return savedBaseRent || 0;
  }, [savedBaseRent, calculatedEstimatedTotal]);

  // ✅ CRITICAL FIX: baseTotal should ALWAYS be the estimated total from pricing table
  // Only use rentCost if user explicitly edited it
  const baseTotal = useMemo(() => {
    // If user manually edited the rent cost, use their value
    if (userEditedRentCost && rentCost > 0) {
      return rentCost;
    }
    // Otherwise, always use the calculated/saved base rent
    return estimatedTotal;
  }, [rentCost, estimatedTotal, userEditedRentCost]);

  // ✅ Sync rentCost with estimatedTotal when not user-edited
  useEffect(() => {
    if (!userEditedRentCost && estimatedTotal > 0) {
      setRentCost(estimatedTotal);
    }
  }, [estimatedTotal, userEditedRentCost]);

  const discountAmount = useMemo(() => {
    if (!discountValue) return 0;
    return discountType === 'percent'
      ? (baseTotal * Math.max(0, Math.min(100, discountValue)) / 100)
      : Math.max(0, discountValue);
  }, [discountType, discountValue, baseTotal]);

  // Calculate print cost details grouped by size BEFORE finalTotal
  const printCostDetails = useMemo(() => {
    if (!printCostEnabled || !printPricePerMeter) return [];
    
    const sel = billboards.filter((b) => selected.includes(String((b as any).ID)));
    const detailsMap = new Map<string, {
      size: string;
      quantity: number;
      areaPerBoard: number;
      totalArea: number;
      unitCost: number;
      totalCost: number;
    }>();

    sel.forEach((b) => {
      const size = ((b as any).Size || (b as any).size || '') as string;
      const faces = Number((b as any).Faces_Count || 1);
      
      const sizeMatch = size.match(/(\d+(?:[.,]\d+)?)\s*[xX×\-]\s*(\d+(?:[.,]\d+)?)/);
      if (!sizeMatch) return;
      
      const width = parseFloat(sizeMatch[1]);
      const height = parseFloat(sizeMatch[2]);
      const areaPerBoard = width * height * faces;
      
      // Check if there's a custom unit cost for this size
      const customUnitCost = customPrintCosts.get(size);
      const unitCost = customUnitCost || (areaPerBoard * printPricePerMeter);
      
      if (detailsMap.has(size)) {
        const existing = detailsMap.get(size)!;
        existing.quantity += 1;
        existing.totalArea += areaPerBoard;
        existing.totalCost += unitCost;
      } else {
        detailsMap.set(size, {
          size,
          quantity: 1,
          areaPerBoard,
          totalArea: areaPerBoard,
          unitCost,
          totalCost: unitCost,
        });
      }
    });

    return Array.from(detailsMap.values()).sort((a, b) => b.totalCost - a.totalCost);
  }, [billboards, selected, printCostEnabled, printPricePerMeter, customPrintCosts]);

  // ✅ Per-billboard print cost details for SelectedBillboardsCard
  const perBillboardPrintCosts = useMemo(() => {
    if (!printCostEnabled || !printPricePerMeter) return [];
    
    const sel = billboards.filter((b) => selected.includes(String((b as any).ID)));
    return sel.map((b) => {
      const size = ((b as any).Size || (b as any).size || '') as string;
      const faces = Number((b as any).Faces_Count || 1);
      const sizeMatch = size.match(/(\d+(?:[.,]\d+)?)\s*[xX×\-]\s*(\d+(?:[.,]\d+)?)/);
      if (!sizeMatch) return { billboardId: String((b as any).ID), printCost: 0 };
      
      const width = parseFloat(sizeMatch[1]);
      const height = parseFloat(sizeMatch[2]);
      const areaPerBoard = width * height * faces;
      const customUnitCost = customPrintCosts.get(size);
      const printCost = customUnitCost || (areaPerBoard * printPricePerMeter);
      
      return { billboardId: String((b as any).ID), printCost };
    });
  }, [billboards, selected, printCostEnabled, printPricePerMeter, customPrintCosts]);

  const totalPrintCost = useMemo(() => {
    return printCostDetails.reduce((sum, detail) => sum + detail.totalCost, 0);
  }, [printCostDetails]);

  const handleUpdatePrintUnitCost = (size: string, newCost: number) => {
    setCustomPrintCosts(prev => {
      const newMap = new Map(prev);
      newMap.set(size, newCost);
      return newMap;
    });
  };

  // مصدر حي واحد لأسعار اللوحات المختارة: الكروت + الحفظ التلقائي + الطباعة
  const selectedBillboardPricingSnapshot = useMemo(() => {
    const selectedBillboardObjs = billboards.filter((b: any) =>
      selected.includes(String((b as any).ID))
    );
    if (selectedBillboardObjs.length === 0) return [];

    const pricingInputs = selectedBillboardObjs.map((b: any) => {
      const id = String((b as any).ID);
      const billboardInstallCost = installationEnabled
        ? (installationDetails.find(d => d.billboardId === id)?.installationPrice || 0)
        : 0;
      const printCostForBb = perBillboardPrintCosts.find(p => p.billboardId === id)?.printCost || 0;

      const origFaces = Number((b as any).Faces_Count ?? (b as any).faces_count ?? (b as any).faces ?? 2);
      return {
        billboardId: id,
        baseRentalPrice: calculateBillboardPrice(b),
        installationPrice: billboardInstallCost,
        printCost: printCostForBb,
        isSingleFace: origFaces === 1 || singleFaceBillboards.has(id),
      };
    });

    const pricingResults = calculateAllBillboardPrices(pricingInputs, {
      totalDiscount: discountAmount,
      printCostEnabled,
      includePrintInPrice,
      installationEnabled,
      includeInstallationInPrice,
    });

    return pricingResults.map(r => ({
      billboardId: r.billboardId,
      baseRental: r.baseRentalPrice,
      installationCost: r.installationPrice,
      printCost: r.printCost,
      netRentalBeforeDiscount: Math.round(r.netRentalBeforeDiscount),
      discountPerBillboard: Math.round(r.discountPerBillboard),
      netRentalAfterDiscount: Math.round(r.netRentalAfterDiscount),
      finalPrice: Math.round(r.totalForBoard),
      priceBeforeDiscount: r.baseRentalPrice,
      priceAfterDiscount: Math.round(r.totalForBoard),
    }));
  }, [
    billboards,
    selected,
    installationEnabled,
    installationDetails,
    perBillboardPrintCosts,
    singleFaceBillboards,
    discountAmount,
    printCostEnabled,
    includePrintInPrice,
    includeInstallationInPrice,
    pricingMode,
    durationMonths,
    durationDays,
    pricingCategory,
    pricing.pricingData,
  ]);

  // ✅ Stabilize references — prevent identity-only re-renders downstream
  const stablePerBillboardPrintCosts = useStableReference(perBillboardPrintCosts);
  const stableInstallationDetails = useStableReference(installationDetails);
  const stableSelectedSnapshot = useStableReference(selectedBillboardPricingSnapshot);
  const stableSingleFaceBillboards = useStableReference(singleFaceBillboards);

  const selectedPricingByBillboardMap = useMemo(() => {
    return new Map(stableSelectedSnapshot.map((p: any) => [String(p.billboardId), p]));
  }, [stableSelectedSnapshot]);
  const stableSelectedPricingByBillboardMap = useStableReference(selectedPricingByBillboardMap);

  const pausedPricingOptions = useMemo(() => ({
    calculateBillboardPrice,
    printCostDetails: stablePerBillboardPrintCosts,
    installationDetails: stableInstallationDetails,
    printCostEnabled,
    includePrintInPrice,
    installationEnabled,
    includeInstallationInPrice,
    singleFaceBillboards: stableSingleFaceBillboards,
    pricingByBillboard: stableSelectedPricingByBillboardMap,
    useStoredPrices: true,
  }), [
    calculateBillboardPrice,
    stablePerBillboardPrintCosts,
    stableInstallationDetails,
    printCostEnabled,
    includePrintInPrice,
    installationEnabled,
    includeInstallationInPrice,
    stableSingleFaceBillboards,
    stableSelectedPricingByBillboardMap,
  ]);

  const pausedPricing = usePausedBillboardsPricing(
    contractNumber ? Number(contractNumber) : null,
    startDate || null,
    endDate || null,
    pausedPricingOptions,
  );
  const pausedTotals = pausedPricing.totals;
  const refetchPausedData = pausedPricing.refetch;

  const finalTotal = useMemo(() => {
    const pausedBaseRentalSum = Number(pausedTotals?.baseRentalSum || 0);
    const pausedRefundSum = Number(pausedTotals?.refundSum || 0);
    const combinedBase = (baseTotal || 0) + pausedBaseRentalSum;
    const baseAfter = Math.max(0, combinedBase - pausedRefundSum - (discountAmount || 0));
    const extraPrintCost = printCostEnabled && !includePrintInPrice ? totalPrintCost : 0;
    const extraInstallCost = installationEnabled && !includeInstallationInPrice ? installationCost : 0;
    return baseAfter + extraPrintCost + extraInstallCost;
  }, [baseTotal, pausedTotals, discountAmount, printCostEnabled, includePrintInPrice, totalPrintCost, installationEnabled, includeInstallationInPrice, installationCost]);

  const actualInstallationCost = useMemo(() => installationEnabled ? installationCost : 0, [installationEnabled, installationCost]);
  const rentalCostOnly = useMemo(() => Math.max(0, finalTotal - actualInstallationCost), [finalTotal, actualInstallationCost]);

  useEffect(() => {
    // ✅ FIXED: Calculate operating fee from totalAfterDiscount when installation is disabled
    const baseForFee = !installationEnabled ? finalTotal : rentalCostOnly;
    const fee = Math.round(baseForFee * 0.03 * 100) / 100;
    setOperatingFee(fee);
    console.log(`✅ MODULAR: Operating fee calculated: installationEnabled=${installationEnabled}, baseForFee=${baseForFee}, fee=${fee}`);
  }, [installationEnabled, finalTotal, rentalCostOnly]);

  // 🔄 Auto-resync billboard_prices in DB whenever the live calculation drifts
  // from what's stored. Without this, ContractPDFDialog reads a stale snapshot
  // (e.g. 5,016 instead of the live 6,000) until the user clicks "حفظ" manually.
  const lastSyncedPricesRef = React.useRef<string>('');
  useEffect(() => {
    if (!contractNumber || !currentContract || loading) return;
    if (!Array.isArray(billboards) || billboards.length === 0) return;
    if (selected.length === 0) return;

    const t = setTimeout(async () => {
      try {
        const computed = selectedBillboardPricingSnapshot;
        if (computed.length === 0) return;

        // Compare with stored
        let stored: any[] = [];
        try {
          const raw = (currentContract as any)?.billboard_prices;
          stored = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
          if (!Array.isArray(stored)) stored = [];
        } catch { stored = []; }

        const storedMap = new Map<string, any>();
        stored.forEach((s: any) => {
          const id = String(s.billboardId ?? s.billboard_id ?? s.ID ?? s.id ?? '');
          if (id) storedMap.set(id, s);
        });

        const drift = computed.some(c => {
          const s = storedMap.get(String(c.billboardId));
          if (!s) return true;
          const sFinal = Number(s.finalPrice ?? s.priceAfterDiscount ?? s.netRentalAfterDiscount ?? 0);
          return Math.abs(sFinal - c.finalPrice) > 1;
        }) || stored.length !== computed.length;

        if (!drift) return;

        const json = JSON.stringify(computed);
        if (lastSyncedPricesRef.current === json) return;

        const { error } = await supabase
          .from('Contract')
          .update({ billboard_prices: json } as any)
          .eq('Contract_Number', Number(contractNumber));
        if (error) throw error;
        lastSyncedPricesRef.current = json;

        // Update in-memory copy so subsequent renders use fresh data
        setCurrentContract((prev: any) => prev ? { ...prev, billboard_prices: json } : prev);
        console.log('🔄 Auto-resynced billboard_prices for contract', contractNumber);
      } catch (e) {
        console.warn('Auto-resync billboard_prices failed:', e);
      }
    }, 800);

    return () => clearTimeout(t);
  }, [
    contractNumber,
    currentContract,
    loading,
    billboards,
    selected,
    installationDetails,
    perBillboardPrintCosts,
    singleFaceBillboards,
    discountAmount,
    printCostEnabled,
    includePrintInPrice,
    installationEnabled,
    includeInstallationInPrice,
    selectedBillboardPricingSnapshot,
  ]);

  useEffect(() => {
    if (installments.length === 0 && finalTotal > 0) {
      const half = Math.round((finalTotal / 2) * 100) / 100;
      setInstallments([
        { 
          amount: half, 
          paymentType: 'عند التوقيع', 
          description: 'الدفعة الأولى',
          dueDate: calculateDueDate('عند التوقيع', 0)
        },
        { 
          amount: finalTotal - half, 
          paymentType: 'بعد 20% من العقد', 
          description: 'الدفعة الثانية',
          dueDate: calculateDueDate('بعد 20% من العقد', 1)
        },
      ]);
    }
  }, [finalTotal]);

  const [sortMaps, setSortMaps] = useState<{ sizeOrderMap: Record<string, number>; municipalityOrderMap: Record<string, number> }>({ sizeOrderMap: {}, municipalityOrderMap: {} });

  useEffect(() => {
    getBillboardsSortMaps().then((maps) => setSortMaps(maps));
  }, []);

  const { data: dbSizesData = [] } = useQuery({
    queryKey: ['contract-edit-sizes-sorting'],
    queryFn: async () => {
      const { data } = await supabase.from('sizes').select('name, sort_order').order('sort_order', { ascending: true });
      return data || [];
    }
  });

  const { data: dbMunisData = [] } = useQuery({
    queryKey: ['contract-edit-munis-sorting'],
    queryFn: async () => {
      const { data } = await supabase.from('municipalities').select('name, sort_order').order('sort_order', { ascending: true });
      return data || [];
    }
  });

  // ✅ FIXED: Filter billboards with proper contract expiry checking and standard sorting
  const filtered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const NEAR_DAYS = 30;

    const isNearExpiring = (b: any) => {
      const raw = b.Rent_End_Date || b.rent_end_date || b.rentEndDate || b['End Date'];
      if (!raw) return false;
      const end = new Date(raw);
      if (isNaN(end.getTime())) return false;
      const diff = Math.ceil((end.getTime() - today.getTime()) / 86400000);
      return diff > 0 && diff <= NEAR_DAYS;
    };

    // ✅ Use shared util + active contracts cross-check
    const isBillboardAvailable = (b: any): boolean => {
      const bId = Number(b.ID ?? b.id);
      return utilIsAvailable(b) && !occupiedBillboardIds.has(bId);
    };


    const enrichedBillboards = billboards.map((b: any) => {
      const bId = String(b.ID || b.id || '');
      const isInThisContract = selected.includes(bId);
      const activeAdType = adType || currentContract?.['Ad Type'] || currentContract?.ad_type || b.Ad_Type || b.ad_type || '';
      const activeCustomer = customerName || currentContract?.['Customer Name'] || currentContract?.customer_name || b.Customer_Name || '';

      return {
        ...b,
        isSelected: isInThisContract,
        selected: isInThisContract,
        new_ad_type: isInThisContract ? activeAdType : (b.new_ad_type || b.Ad_Type),
        contract: isInThisContract ? {
          ...(b.contract || {}),
          ad_type: activeAdType,
          'Ad Type': activeAdType,
          customer_name: activeCustomer
        } : b.contract
      };
    });

    const list = enrichedBillboards.filter((b: any) => {
      const c = String(b.city || b.City || '');
      const m = String(b.municipality || b.Municipality || '');
      const s = String(b.size || b.Size || '').trim();
      const isHidden = b.is_visible_in_available === false;

      // ✅ Smart Arabic Search — tokenized fuzzy matching across all fields
      const matchesQ = smartArabicMatch(
        [
          b.name, b.Billboard_Name, b.location, b.Nearest_Landmark,
          b.municipality, b.Municipality, b.city, b.City,
          b.Customer_Name, b.clientName, b.Size, b.size,
          b.Ad_Type, b.adType, b.new_ad_type,
          b.Contract_Number, b.contractNumber,
          b.ID, b.id,
        ],
        searchQuery
      );
      const matchesCity = cityFilter === 'all' || c === cityFilter;
      const matchesMunicipality = municipalityFilter === 'all' || m === municipalityFilter;
      const matchesSize = sizeFilters.length > 0 ? sizeFilters.includes(s) : (sizeFilter === 'all' || s === sizeFilter);

      const isAvailable = isBillboardAvailable(b);
      const isNear = isNearExpiring(b);
      const isInContract = selected.includes(String(b.ID));
      
      const hasSearch = searchQuery.trim().length > 0;
      let shouldShow = false;

      if (hasSearch) {
        shouldShow = true; // Search overrides status tabs to find any matching billboard!
      } else if (statusFilter === 'all') {
        shouldShow = true; // "الكل" matches all billboards
      } else if (statusFilter === 'available') {
        shouldShow = (isAvailable || isInContract) && !isHidden;
      } else if (statusFilter === 'nearExpiry') {
        shouldShow = isNear;
      } else if (statusFilter === 'rented') {
        shouldShow = !isAvailable;
      } else if (statusFilter === 'hidden') {
        shouldShow = isHidden;
      }

      // Always show selected billboards
      if (isInContract) shouldShow = true;

      return matchesQ && matchesCity && matchesMunicipality && matchesSize && shouldShow;
    });

    return sortBillboardsStandardSync(list, dbSizesData, dbMunisData);
  }, [billboards, searchQuery, cityFilter, municipalityFilter, sizeFilter, sizeFilters, statusFilter, selected, adType, customerName, currentContract, dbSizesData, dbMunisData]);

  // Event handlers
  const toggleSelect = (b: Billboard) => {
    const id = String((b as any).ID);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const removeSelected = (id: string) => {
    setSelected((prev) => prev.filter((x) => x !== id));
    // Remove friend cost if exists
    setFriendBillboardCosts(prev => prev.filter(f => f.billboardId !== id));
    // Remove single face if set
    setSingleFaceBillboards(prev => { const next = new Set(prev); next.delete(id); return next; });
  };

  const toggleSingleFace = (billboardId: string) => {
    const bb = billboards.find(b => String((b as any).ID) === String(billboardId));
    const orig = bb ? ((b as any).Faces_Count ?? (b as any).faces_count ?? (b as any).faces) : null;
    if (orig !== null && orig !== undefined && Number(orig) === 1) return;

    setSingleFaceBillboards(prev => {
      const next = new Set(prev);
      if (next.has(billboardId)) next.delete(billboardId);
      else next.add(billboardId);
      return next;
    });
  };

  const handleUpdateFriendCost = (
    billboardId: string,
    friendCompanyId: string,
    friendCompanyName: string,
    cost: number
  ) => {
    setFriendBillboardCosts(prev => {
      const existing = prev.find(f => f.billboardId === billboardId);
      if (existing) {
        return prev.map(f =>
          f.billboardId === billboardId
            ? { ...f, friendRentalCost: cost, friendCompanyId, friendCompanyName }
            : f
        );
      }
      return [...prev, { billboardId, friendCompanyId, friendCompanyName, friendRentalCost: cost }];
    });
  };

  // ✅ Filter to valid friend costs (still in contract AND still has friend_company_id) and sync current company
  const validFriendBillboardCosts = React.useMemo(() => {
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

  const totalFriendCosts = useMemo(
    () => validFriendBillboardCosts.reduce((sum, f) => sum + (Number(f.friendRentalCost) || 0), 0),
    [validFriendBillboardCosts]
  );

  useEffect(() => {
    if (!contractNumber || !currentContract || loading) return;
    const payload = validFriendBillboardCosts.length > 0 ? JSON.stringify(validFriendBillboardCosts) : null;
    const currentPayload = (() => {
      const raw = (currentContract as any).friend_rental_data;
      if (!raw) return null;
      return typeof raw === 'string' ? raw : JSON.stringify(raw);
    })();
    if (payload === currentPayload) return;

    setFriendCostsSaveState('saving');
    const timer = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from('Contract')
          .update({ friend_rental_data: payload ? JSON.parse(payload) : null } as any)
          .eq('Contract_Number', Number(contractNumber));
        if (error) throw error;
        setCurrentContract((prev: any) => prev ? { ...prev, friend_rental_data: payload ? JSON.parse(payload) : null } : prev);
        setFriendCostsSaveState('saved');
      } catch (e) {
        console.warn('Auto-save friend rental data failed:', e);
        setFriendCostsSaveState('idle');
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [contractNumber, currentContract, loading, validFriendBillboardCosts]);

  const handleAddCustomer = async (name: string) => {
    if (!name) return;
    try {
      const { data: newC, error } = await supabase
        .from('customers')
        .insert({ name })
        .select()
        .single();
      if (!error && newC) {
        setCustomerId(newC.id);
        setCustomerName(name);
        setCustomers((prev) => [{ id: newC.id, name }, ...prev]);
      }
    } catch (e) {
      console.warn(e);
    }
    setCustomerOpen(false);
    setCustomerQuery('');
  };

  const handleSelectCustomer = (customer: { id: string; name: string; company?: string; phone?: string }) => {
    setCustomerName(customer.name);
    setCustomerId(customer.id);
    setCustomerCompany(customer.company || null);
    setCustomerPhone(customer.phone || null);
    setCustomerOpen(false);
    setCustomerQuery('');
  };

  // ✅ Function to refresh prices from the current pricing table
  const handleRefreshPricesFromTable = () => {
    setSavedBaseRent(null); // Clear saved base rent to use calculated value
    setUserEditedRentCost(false);
    toast.success('تم تحديث الأسعار من جدول الأسعار الحالي');
    console.log('🔄 Refreshed prices from table, now using calculated:', calculatedEstimatedTotal);
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

  // Installment management
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
          paymentType: i === 0 ? 'عند التوقيع' : 'شهري',
          description: `الدفعة ${i + 1}`,
          dueDate: calculateDueDate(i === 0 ? 'عند التوقيع' : 'شهري', i)
        };
      });
    }
    
    setInstallments(list);
    toast.success(`تم توزيع المبلغ على ${count} أقساط مغلقة بنجاح`);
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
      toast.error('يرجى تحديد تاريخ بداية العقد');
      return;
    }

    const { firstPayment, firstPaymentType, interval, numPayments, lastPaymentDate, firstPaymentDate, firstAtSigning = true } = config;

    let actualFirstPayment = firstPayment;
    if (firstPaymentType === 'percent') {
      actualFirstPayment = Math.round((finalTotal * Math.min(100, Math.max(0, firstPayment)) / 100) * 100) / 100;
    }

    if (actualFirstPayment < 0 || actualFirstPayment > finalTotal) {
      toast.error('قيمة الدفعة الأولى غير صحيحة');
      return;
    }

    const remaining = finalTotal - actualFirstPayment;
    const intervalMonthsMap: Record<string, number> = { 'month': 1, '2months': 2, '3months': 3, '4months': 4, '5months': 5, '6months': 6, '7months': 7 };
    const intervalLabelMap: Record<string, string> = { 'month': 'شهري', '2months': 'كل شهرين', '3months': 'كل 3 أشهر', '4months': 'كل 4 أشهر', '5months': 'كل 5 أشهر', '6months': 'كل 6 أشهر', '7months': 'كل 7 أشهر' };
    const intervalMonths = intervalMonthsMap[interval] || 1;
    const intervalLabel = intervalLabelMap[interval] || 'شهري';

    const newInstallments: Array<{ amount: number; paymentType: string; description: string; dueDate: string; }> = [];
    const firstDate = firstPaymentDate || startDate;

    let numberOfPayments: number;
    const start = new Date(firstDate);
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

    const hasFirstPayment = actualFirstPayment > 0;

    // حساب قيمة الدفعة الأولى والدفعات المتكررة مغلقة ونظيفة
    let finalFirstPayment = actualFirstPayment;
    let cleanRecurringAmount = Math.round((remaining / numberOfPayments) * 100) / 100;
    let firstRecurringAmount = cleanRecurringAmount;

    if (hasFirstPayment) {
      const cleanRec = roundToCleanValue(remaining / numberOfPayments);
      const adjFirst = Math.round((finalTotal - cleanRec * numberOfPayments) * 100) / 100;
      if (adjFirst >= 0) {
        let finalFirst = adjFirst;
        
        if (roundToCleanValue(adjFirst) !== adjFirst) {
          let cleanFirst = roundToCleanValue(adjFirst);
          const lastPayment = Math.round((finalTotal - cleanFirst - cleanRec * (numberOfPayments - 1)) * 100) / 100;
          
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
      const cleanRec = roundToCleanValue(finalTotal / numberOfPayments);
      const firstRec = Math.round((finalTotal - cleanRec * (numberOfPayments - 1)) * 100) / 100;
      
      let finalFirst = firstRec;
      
      if (roundToCleanValue(firstRec) !== firstRec) {
        let cleanFirst = roundToCleanValue(firstRec);
        const lastPayment = Math.round((finalTotal - cleanFirst - cleanRec * (numberOfPayments - 2)) * 100) / 100;
        
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

    // Add first payment if different
    if (hasFirstPayment) {
      newInstallments.push({
        amount: finalFirstPayment,
        paymentType: firstAtSigning ? 'عند التوقيع' : 'مقدم',
        description: 'الدفعة الأولى',
        dueDate: firstDate
      });
    }

    let runningTotal = hasFirstPayment ? finalFirstPayment : 0;
    for (let i = 0; i < numberOfPayments; i++) {
      const isLast = i === numberOfPayments - 1;
      let amount = cleanRecurringAmount;
      if (!hasFirstPayment && i === 0) {
        amount = firstRecurringAmount;
      }
      
      if (isLast) {
        amount = Math.round((finalTotal - runningTotal) * 100) / 100;
      } else {
        runningTotal += amount;
      }

      const paymentDate = new Date(start);
      // ✅ FIX: بدء التواريخ من أول فترة بعد الدفعة الأولى
      const monthOffset = hasFirstPayment ? (i + 1) : i;
      paymentDate.setMonth(paymentDate.getMonth() + (monthOffset * intervalMonths));
      
      newInstallments.push({
        amount: Math.round(amount * 100) / 100,
        paymentType: intervalLabel,
        description: `الدفعة ${newInstallments.length + 1}`,
        dueDate: paymentDate.toISOString().split('T')[0]
      });
    }

    // If no installments created, create single payment
    if (newInstallments.length === 0) {
      newInstallments.push({ amount: finalTotal, paymentType: 'عند التوقيع', description: 'الدفعة الأولى', dueDate: startDate });
    }

    setInstallments(newInstallments);

    const summary = generateInstallmentSummary(newInstallments);
    toast.success(summary);
  };

  const generateInstallmentSummary = (installmentList: typeof installments): string => {
    if (installmentList.length === 0) return '';

    if (installmentList.length === 1) {
      return `دفعة واحدة: ${installmentList[0].amount.toLocaleString('ar-LY')} د.ل بتاريخ ${installmentList[0].dueDate}`;
    }

    const first = installmentList[0];
    const recurring = installmentList.slice(1);

    if (recurring.length === 0) {
      return `الدفعة الأولى: ${first.amount.toLocaleString('ar-LY')} د.ل بتاريخ ${first.dueDate}`;
    }

    const recurringAmount = recurring[0].amount;
    const allSameAmount = recurring.every(r => Math.abs(r.amount - recurringAmount) < 1);
    const lastDate = recurring[recurring.length - 1].dueDate;
    const intervalType = recurring[0].paymentType;

    if (allSameAmount) {
      return `الدفعة الأولى: ${first.amount.toLocaleString('ar-LY')} د.ل بتاريخ ${first.dueDate}\nبعدها يتم السداد ${intervalType} بمقدار ${recurringAmount.toLocaleString('ar-LY')} د.ل حتى ${lastDate}\n(عدد الدفعات: ${recurring.length})`;
    } else {
      return `الدفعة الأولى: ${first.amount.toLocaleString('ar-LY')} د.ل بتاريخ ${first.dueDate}\nبعدها ${recurring.length} دفعات ${intervalType} بمبالغ متفاوتة حتى ${lastDate}`;
    }
  };

  const installmentSummary = React.useMemo(() => {
    return generateInstallmentSummary(installments);
  }, [installments]);

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
    toast.success(`تم توزيع الدفعات على ${count} فترات متساوية بأرقام مغلقة`);
  }, [finalTotal, startDate, endDate]);


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

  const save = async () => {
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

      if (toAdd.length > 0) {
        await addBillboardsToContract(contractNumber, toAdd, {
          start_date: startDate,
          end_date: endDate,
          customer_name: customerName,
        });
      }
      for (const id of toRemove) {
        await removeBillboardFromContract(contractNumber, id);
      }

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
          image: (b as any).image || ''
        }));

      // ✅ CRITICAL FIX: Always save the CALCULATED base rent from pricing table
      // NOT the savedBaseRent (which might be stale or wrong)
      const baseRentToSave = calculatedEstimatedTotal;
      console.log('💾 Saving base_rent:', baseRentToSave, '(calculated from pricing table)');
      console.log('💾 Saving Total Rent:', finalTotal, '(after discounts and additions)');
      
      const updates: any = {
        'Customer Name': customerName,
        Company: customerCompany || null,
        Phone: customerPhone || null,
        'Ad Type': adType,
        'Contract Date': startDate,
        'End Date': endDate,
        'Total Rent': finalTotal,
        // ✅ CRITICAL: Save the CALCULATED base rent (e.g., 6,500) - NOT the final total
        base_rent: baseRentToSave,
        'Discount': discountAmount,
        customer_category: pricingCategory,
        billboards_data: JSON.stringify(selectedBillboardsData),
        billboards_count: selectedBillboardsData.length,
        // ✅ Store billboard prices using unified pricing helper (matches UI cards exactly)
        billboard_prices: JSON.stringify(selectedBillboardPricingSnapshot),
        installation_cost: installationEnabled ? installationCost : 0,
        installation_enabled: installationEnabled,
        include_installation_in_price: includeInstallationInPrice,
        include_print_in_billboard_price: includePrintInPrice,
        fee: operatingFee,
        installments_data: JSON.stringify(installments),
        // ✅ Save ONLY valid friend costs (filter stale entries)
        friend_rental_data: validFriendBillboardCosts.length > 0 ? JSON.stringify(validFriendBillboardCosts) : null,
        // ✅ Save single face billboards
        single_face_billboards: singleFaceBillboards.size > 0 ? JSON.stringify(Array.from(singleFaceBillboards)) : null,
        // ✅ Save print cost details
        print_cost_enabled: printCostEnabled,
        print_cost: printCostEnabled ? totalPrintCost : 0,
        print_price_per_meter: printCostEnabled ? printPricePerMeter : 0,
        print_cost_details: printCostEnabled && printCostDetails.length > 0 
          ? JSON.stringify(
              printCostDetails.reduce((acc, detail) => {
                acc[detail.size] = {
                  quantity: detail.quantity,
                  areaPerBoard: detail.areaPerBoard,
                  totalArea: detail.totalArea,
                  unitCost: detail.unitCost,
                  totalCost: detail.totalCost,
                };
                return acc;
              }, {} as Record<string, any>)
            )
          : null,
      };
      
      if (installments.length > 0) updates['Payment 1'] = installments[0]?.amount || 0;
      if (installments.length > 1) updates['Payment 2'] = installments[1]?.amount || 0;
      if (installments.length > 2) updates['Payment 3'] = installments[2]?.amount || 0;
      
      updates['Total Paid'] = currentContract?.['Total Paid'] || 0;
      updates['Remaining'] = finalTotal - (currentContract?.['Total Paid'] || 0);
      if (customerId) updates.customer_id = customerId;
      
      await updateContract(contractNumber, updates);

      // ✅ Sync friend_billboard_rentals and delete orphans
      const validFriendBillboardNumericIds: number[] = [];
      for (const billboardId of selected) {
        const billboard = billboards.find(b => String((b as any).ID) === billboardId);
        if (!billboard) continue;
        const currentFriendCompanyId = (billboard as any).friend_company_id || (billboard as any).own_company_id;
        if (!currentFriendCompanyId) continue;

        validFriendBillboardNumericIds.push(Number(billboardId));

        const friendCost = friendBillboardCosts.find(f => f.billboardId === billboardId);
        const billboardPrice = Number(billboard.price) || 0;
        const discountPerBillboard = selected.length > 0 && (estimatedTotal || 1) > 0
          ? (discountAmount || 0) * (billboardPrice / (estimatedTotal || 1)) 
          : 0;
        const customerPrice = billboardPrice - discountPerBillboard;
        const rentalCost = (friendCost && friendCost.friendRentalCost !== undefined && friendCost.friendRentalCost !== null)
          ? Number(friendCost.friendRentalCost)
          : customerPrice;

        await supabase
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
      }

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

      toast.success('تم حفظ التعديلات مع نظام الدفعات الديناميكي بنجاح');
      navigate('/admin/contracts');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'فشل حفظ التعديلات');
    } finally {
      setSaving(false);
    }
  };

  const handlePrintContract = () => {
    if (currentContract) {
      setPdfOpen(true);
    } else {
      toast.error('يجب حفظ العقد أولاً');
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6" dir="rtl">
      <div className="max-w-[1920px] mx-auto space-y-6">
        <ContractEditHeader
          contractNumber={contractNumber}
          onBack={() => navigate('/admin/contracts')}
          onPrint={handlePrintContract}
          onSave={save}
          saving={saving}
        />

        <Tabs defaultValue="details" className="space-y-6">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="details">تفاصيل العقد واللوحات</TabsTrigger>
            {contractNumber && <TabsTrigger value="history">سجل التعديلات</TabsTrigger>}
          </TabsList>

          <TabsContent value="details" className="m-0">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
              {/* Main Content - Left Column */}
              <div className="space-y-6">
                {/* اللوحات المختارة */}
                <SelectedBillboardsCard
                  contractNumber={contractNumber ? Number(contractNumber) : undefined}
                  onRefresh={refetchPausedData}
              selected={selected}
              billboards={billboards}
              onRemoveSelected={removeSelected}
              calculateBillboardPrice={calculateBillboardPrice}
              installationDetails={stableInstallationDetails}
              pricingMode={pricingMode}
              durationMonths={durationMonths}
              durationDays={durationDays}
              sizeNames={pricing.sizeNames}
              totalDiscount={discountAmount}
              discountType={discountType}
              discountValue={discountValue}
              friendBillboardCosts={friendBillboardCosts}
              onUpdateFriendCost={handleUpdateFriendCost}
              friendCostsSaveState={friendCostsSaveState}
              customerCategory={pricingCategory}
              singleFaceBillboards={stableSingleFaceBillboards}
              onToggleSingleFace={toggleSingleFace}
              printCostDetails={stablePerBillboardPrintCosts}
              printCostEnabled={printCostEnabled}
              installationEnabled={installationEnabled}
              includePrintInPrice={includePrintInPrice}
              includeInstallationInPrice={includeInstallationInPrice}
              pricingByBillboardOverride={stableSelectedPricingByBillboardMap}
              startDate={startDate}
              endDate={endDate}
            />

            {/* الخريطة */}
            <Card className="bg-card border-border shadow-lg">
              <CardContent className="p-0">
                <div className="h-[450px]">
                  <BillboardManagementMap
                    billboards={filtered}
                    onBillboardClick={(billboard) => {
                      toggleSelect(billboard);
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* تكلفة الطباعة */}
            <PrintCostSummary
              printCostEnabled={printCostEnabled}
              setPrintCostEnabled={setPrintCostEnabled}
              printPricePerMeter={printPricePerMeter}
              setPrintPricePerMeter={setPrintPricePerMeter}
              printCostDetails={printCostDetails}
              onUpdateUnitCost={handleUpdatePrintUnitCost}
              totalPrintCost={totalPrintCost}
            />

            {/* الفلاتر */}
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

            {conflicts.length > 0 && (
              <Alert className="my-3 bg-accent/10 border-accent/30">
                <AlertTitle>تنبيه تعارض الحالات</AlertTitle>
                <AlertDescription>
                  يوجد {conflicts.length} لوحة بها تعارض بين حالة اللوحة وبيانات العقد.
                </AlertDescription>
                <div className="mt-2">
                  <Button size="sm" variant="outline" onClick={() => setShowConflicts((v) => !v)}>
                    {showConflicts ? 'إخفاء التفاصيل' : 'عرض اللوحات المتعارضة'}
                  </Button>
                </div>
                {showConflicts && (
                  <div className="mt-3 text-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {conflicts.slice(0, 20).map((b: any) => (
                        <div key={b.ID} className="p-2 rounded-md bg-card/60 border border-border">
                          <div className="font-medium">{b.Billboard_Name || b.name}</div>
                          <div className="text-muted-foreground">
                            {(b.City || b.city) || ''} • الحالة: {(b.Status || b.status) || '-'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            عقد: {b.Contract_Number || '-'} • نهاية: {b.Rent_End_Date || '-'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Alert>
            )}

            {/* اللوحات المتاحة */}
            <AvailableBillboardsGrid
              billboards={filtered}
              selected={selected}
              onToggleSelect={toggleSelect}
              loading={loading}
              occupiedBillboardIds={occupiedBillboardIds}
              onSelectCityFilter={(c) => setCityFilter(c)}
              onSelectMunicipalityFilter={(m) => setMunicipalityFilter(m)}
              onSelectSizeFilter={(s) => setSizeFilter(s)}
            />
          </div>

          {/* Sidebar - Right Column */}
          <div className="space-y-4">
            <div className="sticky top-6 space-y-4">
              {/* معلومات العميل */}
              <CustomerInfoForm
                customerName={customerName}
                setCustomerName={setCustomerName}
                adType={adType}
                setAdType={setAdType}
                pricingCategory={pricingCategory}
                setPricingCategory={setPricingCategory}
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
                setPricingMode={setPricingMode}
                durationMonths={durationMonths}
                setDurationMonths={setDurationMonths}
                durationDays={durationDays}
                setDurationDays={setDurationDays}
              />

              {/* تفعيل التركيب */}
              <Card className="bg-card/50 border-border shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-card-foreground">تفعيل التركيب</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {installationEnabled ? 'نسبة التشغيل من الإيجار' : 'نسبة التشغيل من الإجمالي'}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={installationEnabled}
                        onChange={(e) => setInstallationEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </CardContent>
              </Card>

              {/* ملخص التركيب */}
              {operatingFee > 0 && (
                <InstallationCostSummary
                  installationCost={installationEnabled ? installationCost : 0}
                  installationDetails={installationDetails}
                  operatingFee={operatingFee}
                  operatingFeeRate={3}
                  setOperatingFeeRate={() => {}}
                  rentalCostOnly={rentalCostOnly}
                  totalAfterDiscount={finalTotal}
                />
              )}

              {/* الأقساط */}
              <InstallmentsManager
                installments={installments}
                finalTotal={finalTotal}
                startDate={startDate}
                endDate={endDate}
                onDistributeEvenly={distributeEvenly}
                onDistributeWithInterval={distributeWithInterval}
                onDistributeByDurationPeriods={distributeByDurationPeriods}
                onApplyUnequalDistribution={(payments) => {
                  setInstallments(payments.map(p => ({
                    amount: p.amount,
                    paymentType: p.paymentType,
                    description: p.description,
                    dueDate: p.dueDate
                  })));
                }}
                onAddInstallment={addInstallment}
                onRemoveInstallment={removeInstallment}
                onUpdateInstallment={updateInstallment}
                onClearAll={clearAllInstallments}
                installmentSummary={installmentSummary}
              />

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
                currentContract={currentContract}
                originalTotal={originalTotal}
                onSave={save}
                onCancel={() => navigate('/admin/contracts')}
                saving={saving}
                totalFriendCosts={totalFriendCosts}
                validFriendCount={validFriendBillboardCosts.length}
                storedFriendCount={friendBillboardCosts.length}
                printCost={totalPrintCost}
                printCostEnabled={printCostEnabled}
                installationEnabled={installationEnabled}
                includeInstallationInPrice={includeInstallationInPrice}
                setIncludeInstallationInPrice={setIncludeInstallationInPrice}
                includePrintInPrice={includePrintInPrice}
                setIncludePrintInPrice={setIncludePrintInPrice}
                pausedTotals={pausedTotals}
                // ✅ NEW: Props for base rent refresh
                savedBaseRent={savedBaseRent}
                calculatedEstimatedTotal={calculatedEstimatedTotal}
                onRefreshPricesFromTable={handleRefreshPricesFromTable}
              />
            </div>
          </div>
          </div>
        </TabsContent>

        {contractNumber && (
          <TabsContent value="history" className="m-0 mt-6 bg-card rounded-xl border p-6">
            <ContractHistoryTab 
              contractNumber={Number(contractNumber)} 
              onRestore={() => window.location.reload()} 
            />
          </TabsContent>
        )}
        </Tabs>
      </div>

      {pdfOpen && currentContract && (
        <ContractPDFDialog
          contract={{
            ...currentContract,
            billboard_prices: JSON.stringify(selectedBillboardPricingSnapshot),
          }}
          liveBillboardPrices={selectedBillboardPricingSnapshot}
          open={pdfOpen}
          onOpenChange={setPdfOpen}
        />
      )}
    </div>
  );
}
