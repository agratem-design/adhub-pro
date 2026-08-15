import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useContractPricing } from '@/hooks/useContractPricing';
import { getPriceFor } from '@/data/pricing';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Calculator, 
  Calendar, 
  User, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  RefreshCw, 
  TrendingDown, 
  TrendingUp, 
  DollarSign,
  HelpCircle,
  Settings,
  Printer
} from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import { usePrintTheme, generatePrintDocument, openPrintWindow, loadLogoAsDataUri } from '@/print-engine';
import { DOCUMENT_TYPES } from '@/types/document-types';
interface ContractSimulationResult {
  contractNumber: number;
  startDate: string;
  endDate: string;
  originalDurationDays: number;
  elapsedDays: number;
  pricingMode: 'months' | 'days';
  customerCategory: string;
  adType: string;
  originalRent: number;
  originalTotal: number;
  originalPaid: number;
  originalRemaining: number;
  adjustedRent: number;
  adjustedTotal: number;
  adjustedPaid: number;
  adjustedRemaining: number;
  difference: number;
  printCost: number;
  installationCost: number;
  discount: number;
  adjustedPrint: number;
  adjustedInstall: number;
  adjustedDiscount: number;
  includePrint: boolean;
  includeInstall: boolean;
  printEnabled: boolean;
  installEnabled: boolean;
  closestPeriodName: string;
  billboards: Array<{
    id: string;
    name: string;
    size: string;
    level: string;
    originalPrice: number;
    adjustedPrice: number;
    closestPeriodName: string;
    closestPeriodDays: number;
    closestPeriodPrice: number;
    dailyRate: number;
  }>;
}

export default function ContractClosureSimulator() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [closureDate, setClosureDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  
  // Simulation Settings
  const [proRateDiscount, setProRateDiscount] = useState<boolean>(true);
  const [fullSetupCosts, setFullSetupCosts] = useState<boolean>(true); // Charge full installation & print costs
  const [overrideCategory, setOverrideCategory] = useState<string>('default');
  const [calculationMethod, setCalculationMethod] = useState<'closest_period' | 'original_prorate'>('closest_period');
  
  // Load unified print theme
  const { theme: printTheme } = usePrintTheme(DOCUMENT_TYPES.CUSTOMER_INVOICE);
  
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Find earliest ending contract to calculate date and explain it
  const earliestEndDateContract = useMemo(() => {
    if (!contracts || contracts.length === 0) return null;
    const validContracts = contracts.filter(c => c['End Date'] || c.original_end_date);
    if (validContracts.length === 0) return null;
    return [...validContracts].sort((a, b) => {
      const dateA = new Date(a['End Date'] || a.original_end_date || '').getTime();
      const dateB = new Date(b['End Date'] || b.original_end_date || '').getTime();
      return dateA - dateB;
    })[0];
  }, [contracts]);

  const { pricingData, loading: pricingLoading } = useContractPricing();

  // Extract unique customer categories from pricingData dynamically
  const uniqueCategories = useMemo<string[]>(() => {
    if (!pricingData || pricingData.length === 0) return [];
    const cats = pricingData.map(p => String(p.customer_category || '').trim()).filter(Boolean);
    return Array.from(new Set(cats)).sort();
  }, [pricingData]);

  // Load all customers
  useEffect(() => {
    async function loadCustomers() {
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('id, name, company, pricing_category')
          .order('name', { ascending: true });
        
        if (error) throw error;
        if (data) setCustomers(data);
      } catch (err: any) {
        console.error('Failed to load customers:', err);
        toast.error('فشل تحميل قائمة العملاء');
      }
    }
    loadCustomers();
  }, []);

  // Filter customers by search query
  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers;
    return customers.filter(c => 
      (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.company || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [customers, searchQuery]);

  // Handle customer selection and load their contracts
  const handleCustomerChange = async (customerId: string) => {
    setSelectedCustomerId(customerId);
    if (!customerId) {
      setContracts([]);
      return;
    }
    
    setLoading(true);
    try {
      const selectedCust = customers.find(c => c.id === customerId);
      let mergedContracts: any[] = [];

      if (selectedCust) {
        // Query by ID and Name concurrently
        const [resById, resByName] = await Promise.all([
          supabase.from('Contract').select('*').eq('customer_id', customerId),
          supabase.from('Contract').select('*').eq('Customer Name', selectedCust.name)
        ]);

        const mergedMap = new Map<number, any>();
        
        if (resById.data) {
          resById.data.forEach(c => mergedMap.set(c.Contract_Number, c));
        }
        if (resByName.data) {
          resByName.data.forEach(c => mergedMap.set(c.Contract_Number, c));
        }
        
        mergedContracts = Array.from(mergedMap.values());
      }

      setContracts(mergedContracts);
      if (mergedContracts.length === 0) {
        toast.info('لا توجد عقود مسجلة لهذا العميل');
      }
    } catch (err: any) {
      console.error('Error fetching contracts:', err);
      toast.error('فشل تحميل عقود العميل');
    } finally {
      setLoading(false);
    }
  };

  // Safe day difference calculation
  const getDaysDifference = (startStr: string, endStr: string): number => {
    if (!startStr || !endStr) return 0;
    const s = new Date(startStr);
    const e = new Date(endStr);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
    
    s.setHours(0, 0, 0, 0);
    e.setHours(0, 0, 0, 0);
    const diffTime = e.getTime() - s.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  // Human-readable period name from days
  const getPeriodNameFromDays = (days: number): string => {
    if (days >= 350) return 'سنة كاملة';
    if (days >= 170) return '6 أشهر';
    if (days >= 85) return '3 أشهر';
    if (days >= 55) return 'شهرين';
    if (days >= 28) return 'شهر واحد';
    if (days >= 1) return `${days} يوم`;
    return 'غير محدد';
  };

  // Adjust rent calculation for a billboard
  const getAdjustedBillboardRent = (
    billboard: any,
    elapsedDays: number,
    category: string,
    originalPrice: number,
    contractDurationDays: number
  ) => {
    // Sanitize originalPrice to guarantee it is a valid positive number
    let cleanOriginalPrice = Number(originalPrice);
    if (isNaN(cleanOriginalPrice) || cleanOriginalPrice <= 0) {
      cleanOriginalPrice = 0;
    }

    if (elapsedDays <= 0) {
      return {
        adjustedPrice: 0,
        closestPeriodName: 'لا يوجد',
        closestPeriodDays: 0,
        closestPeriodPrice: 0,
        dailyRate: 0,
        pricingSource: 'none' as const
      };
    }

    const size = billboard.Size || billboard.size || '';
    const level = billboard.Level || billboard.level || 'A';
    
    const sizeRef = billboard.size_id || billboard.Size_ID || size;
    const normSize = String(sizeRef).trim().toLowerCase().replace(/\s+/g, '').replace(/×/g, 'x');
    const normLevel = String(level).trim();
    const normCategory = String(category || 'عادي').trim();

    // Find in loaded pricingData (case-insensitive matching like the hook does)
    const pricingRow = pricingData.find(row => {
      const rowSize = String(row.size_id || row.size || '').trim().toLowerCase().replace(/\s+/g, '').replace(/×/g, 'x');
      const rowLevel = String(row.billboard_level || '').trim().toUpperCase();
      const rowCategory = String(row.customer_category || '').trim().toUpperCase();
      return rowSize === normSize && rowLevel === normLevel.toUpperCase() && rowCategory === normCategory.toUpperCase();
    });

    const periods = [
      { days: 1, col: 'one_day', name: 'يوم واحد', months: 0 },
      { days: 30, col: 'one_month', name: 'شهر واحد', months: 1 },
      { days: 60, col: '2_months', name: 'شهرين', months: 2 },
      { days: 90, col: '3_months', name: '3 أشهر', months: 3 },
      { days: 180, col: '6_months', name: '6 أشهر', months: 6 },
      { days: 360, col: 'full_year', name: 'سنة كاملة', months: 12 }
    ];

    // Find closest period using floor-rounding:
    // Pick the largest period whose days ≤ elapsedDays.
    // This ensures the client pays for what they actually consumed,
    // not rounded up to a higher tier.
    let closestPeriod = periods[0]; // fallback to 1 day
    for (const p of periods) {
      if (p.days <= elapsedDays) {
        closestPeriod = p;
      }
    }

    // Determine price — track source for transparency
    let periodPrice: number | null = null;
    let pricingSource: 'pricing_table' | 'static_table' | 'daily_rate' | 'contract_prorate' = 'contract_prorate';

    // 1) Try from database pricing table
    if (pricingRow) {
      const val = pricingRow[closestPeriod.col];
      if (val !== null && val !== undefined && Number(val) > 0) {
        periodPrice = Number(val);
        pricingSource = 'pricing_table';
      }
    }

    // 2) Static fallback (hardcoded pricing data)
    if (periodPrice === null || periodPrice === undefined || isNaN(periodPrice) || periodPrice <= 0) {
      if (closestPeriod.months > 0) {
        const staticVal = getPriceFor(size, level as any, normCategory as any, closestPeriod.months);
        if (staticVal !== undefined && staticVal !== null && staticVal > 0) {
          periodPrice = staticVal;
          pricingSource = 'static_table';
        }
      }
    }

    // 3) Daily rate fallback (use one_day price × period days)
    if (periodPrice === null || periodPrice === undefined || isNaN(periodPrice) || periodPrice <= 0) {
      if (pricingRow && pricingRow.one_day && Number(pricingRow.one_day) > 0) {
        periodPrice = Number(pricingRow.one_day) * closestPeriod.days;
        pricingSource = 'daily_rate';
      }
    }

    // 4) Contract pro-rata fallback (same formula as original_prorate method)
    if (periodPrice === null || periodPrice === undefined || isNaN(periodPrice) || periodPrice <= 0) {
      const contractDays = contractDurationDays || 90;
      periodPrice = (cleanOriginalPrice / contractDays) * closestPeriod.days;
      pricingSource = 'contract_prorate';
    }

    // Final sanity check to avoid NaN
    const finalPeriodPrice = periodPrice && !isNaN(periodPrice) && periodPrice > 0 ? periodPrice : cleanOriginalPrice;
    const dailyRate = finalPeriodPrice / closestPeriod.days;
    const adjustedPrice = Math.round(dailyRate * elapsedDays * 100) / 100;

    return {
      adjustedPrice: isNaN(adjustedPrice) ? 0 : adjustedPrice,
      closestPeriodName: closestPeriod.name,
      closestPeriodDays: closestPeriod.days,
      closestPeriodPrice: finalPeriodPrice,
      dailyRate: isNaN(dailyRate) ? 0 : dailyRate,
      pricingSource
    };
  };

  // Perform full simulation on loaded contracts
  const simulationResults = useMemo<ContractSimulationResult[]>(() => {
    if (!contracts.length || !closureDate) return [];

    const selectedCust = customers.find(c => c.id === selectedCustomerId);
    const defaultCategory = selectedCust?.pricing_category || 'عادي';

    const results = contracts.map(contract => {
      const startDate = contract['Contract Date'] || contract.original_start_date || '';
      const endDate = contract['End Date'] || contract.original_end_date || '';
      const pricingMode = (contract.pricing_mode || 'months') as 'months' | 'days';
      const category = overrideCategory === 'default' ? (contract.customer_category || defaultCategory) : overrideCategory;

      const originalDurationDays = getDaysDifference(startDate, endDate);
      
      // Calculate elapsed days today or target date
      let elapsedDays = getDaysDifference(startDate, closureDate);
      if (new Date(closureDate) > new Date(endDate)) {
        elapsedDays = originalDurationDays;
      }

      // Parse billboards
      let billboardsArray: any[] = [];
      try {
        if (contract.billboards_data) {
          billboardsArray = typeof contract.billboards_data === 'string' 
            ? JSON.parse(contract.billboards_data) 
            : contract.billboards_data;
        }
      } catch (err) {
        console.warn('Failed to parse billboards_data for contract:', contract.Contract_Number, err);
      }

      // Reconcile individual billboard prices if available
      let billboardPricesList: any = null;
      try {
        if (contract.billboard_prices) {
          billboardPricesList = typeof contract.billboard_prices === 'string'
            ? JSON.parse(contract.billboard_prices)
            : contract.billboard_prices;
        }
      } catch (err) {
        // ignore
      }

      let simulatedRentSum = 0;
      const simulatedBillboards = billboardsArray.map((bb: any, idx: number) => {
        const boardId = String(bb.ID || bb.id || idx);
        
        // Find contract price for this billboard
        let originalPrice = Number(bb.Price) || Number(bb.price) || 0;
        
        if (billboardPricesList) {
          if (Array.isArray(billboardPricesList)) {
            const priceEntry = billboardPricesList.find((p: any) => 
              String(p.billboardId) === String(boardId) || String(p.billboard_id) === String(boardId)
            );
            if (priceEntry) {
              originalPrice = Number(priceEntry.priceBeforeDiscount) || 
                              Number(priceEntry.priceAfterDiscount) || 
                              Number(priceEntry.baseRental) || 
                              Number(priceEntry.finalPrice) || 
                              Number(priceEntry.price) || 
                              originalPrice;
            }
          } else if (typeof billboardPricesList === 'object') {
            const val = billboardPricesList[boardId];
            if (val !== undefined && val !== null) {
              if (typeof val === 'object') {
                originalPrice = Number(val.priceBeforeDiscount) || 
                                Number(val.priceAfterDiscount) || 
                                Number(val.baseRental) || 
                                Number(val.finalPrice) || 
                                Number(val.price) || 
                                originalPrice;
              } else {
                originalPrice = Number(val) || originalPrice;
              }
            }
          }
        }
        
        if (!originalPrice || isNaN(originalPrice) || typeof originalPrice === 'object') {
          originalPrice = (Number(contract['Total Rent']) || Number(contract.base_rent) || 0) / (billboardsArray.length || 1);
        }
        
        let calc = {
          adjustedPrice: 0,
          closestPeriodName: '',
          closestPeriodDays: 0,
          closestPeriodPrice: 0,
          dailyRate: 0,
          pricingSource: 'none' as 'none' | 'pricing_table' | 'static_table' | 'daily_rate' | 'contract_prorate'
        };

        if (calculationMethod === 'original_prorate') {
          const isCompleted = elapsedDays >= originalDurationDays;
          const dailyRate = originalDurationDays > 0 ? (originalPrice / originalDurationDays) : 0;
          const adjustedPrice = isCompleted ? originalPrice : (dailyRate * elapsedDays);
          
          calc = {
            adjustedPrice: isNaN(adjustedPrice) ? 0 : adjustedPrice,
            closestPeriodName: isCompleted ? 'مكتمل المدة' : `مدة العقد (${originalDurationDays} يوم)`,
            closestPeriodDays: originalDurationDays,
            closestPeriodPrice: originalPrice,
            dailyRate: isNaN(dailyRate) ? 0 : dailyRate,
            pricingSource: 'contract_prorate'
          };
        } else {
          calc = getAdjustedBillboardRent(
            bb,
            elapsedDays,
            category,
            originalPrice,
            originalDurationDays
          );
        }

        const isCompleted = elapsedDays >= originalDurationDays;
        const finalAdjustedPrice = isCompleted ? originalPrice : calc.adjustedPrice;

        // Accumulate the correct final value (originalPrice for completed, calc for active)
        simulatedRentSum += finalAdjustedPrice;

        return {
          id: boardId,
          name: bb.Billboard_Name || bb.name || `لوحة #${boardId}`,
          size: bb.Size || bb.size || 'غير حدد',
          level: bb.Level || bb.level || 'A',
          originalPrice,
          adjustedPrice: finalAdjustedPrice,
          closestPeriodName: isCompleted ? 'مكتمل المدة' : calc.closestPeriodName,
          closestPeriodDays: calc.closestPeriodDays,
          closestPeriodPrice: isCompleted ? originalPrice : calc.closestPeriodPrice,
          dailyRate: calc.dailyRate,
          pricingSource: calc.pricingSource
        };
      });

      // Original financial figures
      const originalRent = Number(contract['Total Rent'] || 0) || Number(contract.base_rent || 0) || 0;
      const originalTotal = Number(contract['Total'] || 0) || 0;
      
      let originalPaid = Number(String(contract['Total Paid'] || '0').replace(/,/g, '')) || 0;
      let originalRemaining = Number(String(contract['Remaining'] || '0').replace(/,/g, '')) || 0;

      // Reconcile and sync with payment_status to avoid database out-of-sync inconsistencies
      if (contract.payment_status === 'paid' || originalRemaining <= 0 || originalPaid >= originalTotal) {
        originalPaid = originalTotal;
        originalRemaining = 0;
      }

      // Reconcile if print or installation costs are already included in the billboard price
      const includePrint = contract.include_print_in_billboard_price === true || 
                           contract.include_print_in_billboard_price === 1 || 
                           contract.include_print_in_billboard_price === 'true' || 
                           String(contract.include_print_in_billboard_price) === '1';

      const includeInstall = contract.include_installation_in_price === true || 
                             contract.include_installation_in_price === 1 || 
                             contract.include_installation_in_price === 'true' || 
                             String(contract.include_installation_in_price) === '1';

      const printEnabled = contract.print_cost_enabled === 'true' || 
                           contract.print_cost_enabled === true || 
                           Number(contract.print_cost || 0) > 0 || 
                           includePrint;

      const installEnabled = contract.installation_enabled === true || 
                             contract.installation_enabled === 'true' || 
                             Number(contract.installation_cost || 0) > 0 || 
                             includeInstall;

      // Adjusted figures
      let adjustedRent = simulatedRentSum || 0;
      
      // Print and installation adjustments
      const printCost = includePrint ? 0 : (Number(contract.print_cost || 0) || 0);
      const installCost = includeInstall ? 0 : (Number(contract.installation_cost || 0) || 0);
      
      let adjustedPrint = printCost;
      let adjustedInstall = installCost;
      
      if (!fullSetupCosts) {
        // Pro-rate print and installation costs if requested
        const pct = originalDurationDays > 0 ? (elapsedDays / originalDurationDays) : 0;
        adjustedPrint = Math.round(printCost * pct * 100) / 100;
        adjustedInstall = Math.round(installCost * pct * 100) / 100;
      }

      // Discount adjustments
      const originalDiscount = Number(contract.Discount || 0) || 0;
      let adjustedDiscount = originalDiscount;
      
      if (proRateDiscount && originalDurationDays > 0) {
        const pct = elapsedDays / originalDurationDays;
        adjustedDiscount = Math.round(originalDiscount * pct * 100) / 100;
      }

      const isCompleted = elapsedDays >= originalDurationDays;
      const adjustedPaid = originalPaid;
      let adjustedTotal = 0;
      let adjustedRemaining = 0;
      let difference = 0;

      if (isCompleted) {
        // Expired/completed contracts remain exactly as originally billed/paid
        adjustedRent = originalRent;
        adjustedPrint = printCost;
        adjustedInstall = installCost;
        adjustedDiscount = originalDiscount;
        adjustedTotal = originalTotal;
        adjustedRemaining = originalRemaining;
        difference = 0;
      } else {
        // Simulated premature早期 إغلاق calculations
        adjustedTotal = Math.max(0, adjustedRent + adjustedPrint + adjustedInstall - adjustedDiscount);
        adjustedRemaining = Math.round((adjustedTotal - originalPaid) * 100) / 100;
        difference = Math.round((adjustedTotal - originalTotal) * 100) / 100;
      }

      return {
        contractNumber: contract.Contract_Number,
        startDate,
        endDate,
        originalDurationDays,
        elapsedDays,
        pricingMode,
        customerCategory: category,
        adType: contract['Ad Type'] || 'غير محدد',
        originalRent,
        originalTotal,
        originalPaid,
        originalRemaining,
        adjustedRent,
        adjustedTotal,
        adjustedPaid,
        adjustedRemaining,
        difference,
        printCost,
        installationCost: installCost,
        discount: originalDiscount,
        adjustedPrint,
        adjustedInstall,
        adjustedDiscount,
        billboards: simulatedBillboards,
        includePrint,
        includeInstall,
        printEnabled,
        installEnabled,
        closestPeriodName: isCompleted ? 'مكتمل المدة' : (simulatedBillboards[0]?.closestPeriodName || 'يوم واحد')
      };
    });

    return results.sort((a, b) => b.contractNumber - a.contractNumber);
  }, [contracts, closureDate, proRateDiscount, fullSetupCosts, pricingData, overrideCategory, customers, selectedCustomerId, calculationMethod]);

  // Overall customer summaries
  const totals = useMemo(() => {
    let originalTotalSum = 0;
    let adjustedTotalSum = 0;
    let paidSum = 0;
    let incompleteDurationCount = 0;
    
    simulationResults.forEach(res => {
      originalTotalSum += res.originalTotal || 0;
      adjustedTotalSum += res.adjustedTotal || 0;
      paidSum += res.adjustedPaid || 0;
      if (res.elapsedDays < res.originalDurationDays) {
        incompleteDurationCount++;
      }
    });

    const netRemaining = Math.round((adjustedTotalSum - paidSum) * 100) / 100;
    const netSavings = Math.round((adjustedTotalSum - originalTotalSum) * 100) / 100;

    return {
      originalTotalSum,
      adjustedTotalSum,
      paidSum,
      netRemaining,
      netSavings,
      incompleteDurationCount
    };
  }, [simulationResults]);

  const printProfessionalReport = async () => {
    const selectedCust = customers.find(c => c.id === selectedCustomerId);
    const customerName = selectedCust?.name || 'غير محدد';
    const customerCompany = selectedCust?.company || '';
    const customerCategoryName = selectedCust?.pricing_category || 'عادي';
    
    // Build Table Rows
    const tableRows = simulationResults.map((res, index) => {
      const originalTotalFormatted = res.originalTotal.toLocaleString('ar-LY');
      const adjustedTotalFormatted = res.adjustedTotal.toLocaleString('ar-LY');
      const adjustedPaidFormatted = res.adjustedPaid.toLocaleString('ar-LY');
      const adjustedRemainingFormatted = res.adjustedRemaining.toLocaleString('ar-LY');
      
      let balanceStatusText = '';
      let balanceClass = '';
      if (res.adjustedRemaining > 0) {
        balanceStatusText = `مطلوب دفع ${adjustedRemainingFormatted} د.ل`;
        balanceClass = 'status-unpaid';
      } else if (res.adjustedRemaining < 0) {
        balanceStatusText = `فائض مسترجع ${Math.abs(res.adjustedRemaining).toLocaleString('ar-LY')} د.ل`;
        balanceClass = 'status-surplus';
      } else {
        balanceStatusText = 'مسوى بالكامل (0)';
        balanceClass = 'status-paid';
      }

      const printBadgeText = res.printEnabled ? (res.includePrint ? 'طباعة مشمولة' : 'الطباعة +') : '';
      const installBadgeText = res.installEnabled ? (res.includeInstall ? 'تركيب مشمول' : 'التركيب +') : '';
      const badgesHTML = [printBadgeText, installBadgeText]
        .filter(Boolean)
        .map(txt => `<span class="badge ${txt.includes('مشمول') ? 'badge-included' : 'badge-add'}">${txt}</span>`)
        .join(' ');

      return `
        <tr>
          <td style="text-align: center;">${index + 1}</td>
          <td style="text-align: center;">#${res.contractNumber}</td>
          <td style="text-align: right;">
            <strong>${res.adType}</strong>
            <div style="margin-top: 3px; font-size: 8px;">${badgesHTML}</div>
          </td>
          <td style="text-align: center;">${res.elapsedDays} / ${res.originalDurationDays} يوم</td>
          <td style="text-align: center;">
            <div style="font-weight: bold;">${res.closestPeriodName}</div>
            <div style="font-size: 8px; color: #64748b;">(الأصلية: ${getPeriodNameFromDays(res.originalDurationDays)})</div>
          </td>
          <td class="font-numbers" style="text-align: left;">${originalTotalFormatted} د.ل</td>
          <td class="font-numbers" style="text-align: left; font-weight: bold; color: #b45309;">${adjustedTotalFormatted} د.ل</td>
          <td class="font-numbers" style="text-align: left; font-weight: bold; color: #047857;">${adjustedPaidFormatted} د.ل</td>
          <td class="font-numbers ${balanceClass}" style="text-align: left;">${balanceStatusText}</td>
        </tr>
      `;
    }).join('');

    // Build Detailed Sheets for each Contract
    const detailedSheetsHTML = simulationResults.map((res) => {
      const getPricingSourceLabel = (src: string) => {
        switch (src) {
          case 'pricing_table': return 'من جدول الأسعار';
          case 'static_table': return 'من الجدول الثابت';
          case 'daily_rate': return 'من سعر اليوم';
          case 'contract_prorate': return 'من سعر العقد';
          default: return '';
        }
      };

      const billboardRowsHTML = res.billboards.map(bb => {
        const sourceLabel = getPricingSourceLabel(bb.pricingSource);
        const sourceColor = bb.pricingSource === 'pricing_table' ? '#047857' : 
                            bb.pricingSource === 'contract_prorate' ? '#b45309' : '#6b7280';
        return `
          <tr>
            <td style="text-align: right;"><strong>${bb.name}</strong></td>
            <td style="text-align: center;">${bb.size} <span class="badge badge-add">${bb.level}</span></td>
            <td class="font-numbers" style="text-align: left;">${bb.originalPrice.toLocaleString('ar-LY')} د.ل</td>
            <td style="text-align: center;" class="font-numbers text-amber-600">${bb.elapsedDays ?? res.elapsedDays} يوم</td>
            <td style="text-align: center;">
              <div style="font-weight: bold; color: #0f172a;">${bb.closestPeriodName}</div>
              <div style="font-size: 9px; font-weight: bold; color: #b45309;">${bb.closestPeriodPrice.toLocaleString('ar-LY')} د.ل</div>
              <div style="font-size: 7px; color: ${sourceColor};">(${sourceLabel})</div>
            </td>
            <td style="text-align: center;">
              <div class="font-numbers" style="font-weight: bold;">${bb.dailyRate.toFixed(2)} د.ل</div>
              <div style="font-size: 7px; color: #64748b;">(${bb.closestPeriodPrice.toLocaleString('ar-LY')} ÷ ${bb.closestPeriodDays} يوم)</div>
            </td>
            <td class="font-numbers font-bold" style="text-align: left; color: #047857;">${bb.adjustedPrice.toLocaleString('ar-LY')} د.ل</td>
          </tr>
        `;
      }).join('');

      return `
        <div class="page-break" style="margin-top: 40px; border-top: 2px dashed #cbd5e1; padding-top: 30px; page-break-before: always;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="font-size: 14px; font-weight: 800; color: #0f172a; margin: 0;">
              عقد رقم #${res.contractNumber} — ${res.adType}
            </h3>
            <div style="display: flex; gap: 5px;">
              <span class="badge badge-add">فئة ${res.customerCategory}</span>
              <span class="badge badge-add">${res.pricingMode === 'months' ? 'تقسيم شهري' : 'تقسيم يومي'}</span>
              <span class="badge ${res.elapsedDays >= res.originalDurationDays ? 'badge-included' : 'badge-add'}">
                المدة المنقضية: ${res.elapsedDays} يوم (${Math.round((res.elapsedDays / (res.originalDurationDays || 1)) * 100)}%)
              </span>
            </div>
          </div>
          <p style="font-size: 10px; color: #64748b; margin-bottom: 12px;">
            الفترة الأصلية للعقد: من <strong>${res.startDate}</strong> إلى <strong>${res.endDate}</strong> (${res.originalDurationDays} يوم)
          </p>

          <h4 style="font-size: 11px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">اللوحات المشمولة بالعقد والأسعار المحتسبة</h4>
          <table class="print-table" style="margin-bottom: 20px;">
            <thead>
              <tr>
                <th style="text-align: right;">اللوحة</th>
                <th style="width: 90px; text-align: center;">المقاس / الفئة</th>
                <th style="width: 100px; text-align: left;">سعر العقد الأصلي</th>
                <th style="width: 80px; text-align: center;">المدة المنقضية</th>
                <th style="width: 130px; text-align: center;">الفترة المعتمدة وسعرها</th>
                <th style="width: 110px; text-align: center;">سعر اليوم الواحد</th>
                <th style="width: 110px; text-align: left;">السعر المعدل</th>
              </tr>
            </thead>
            <tbody>
              ${billboardRowsHTML}
            </tbody>
          </table>

          <div style="display: grid; grid-template-columns: 1.2fr 1.8fr; gap: 20px; align-items: start;">
            <!-- Explanation -->
            <div style="background-color: #fcfbf7; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; font-size: 10px; color: #475569; text-align: right; line-height: 1.8; direction: rtl;">
              <strong style="color: #0f172a;">كيف تمت التسوية؟</strong><br/>
              <strong>1.</strong> تم تحديد الفترة المعتمدة لكل لوحة من جدول الأسعار (أكبر فترة لا تتجاوز ${res.elapsedDays} يوم منقضية).<br/>
              <strong>2.</strong> <strong>سعر اليوم الواحد</strong> = سعر الفترة المعتمدة ÷ عدد أيام الفترة.<br/>
              <strong>3.</strong> <strong>السعر المعدل</strong> = سعر اليوم الواحد × ${res.elapsedDays} يوم منقضية.<br/>
              <strong>4.</strong> مصاريف التجهيز (طباعة وتركيب): ${fullSetupCosts ? 'محتسبة كاملة دون تخفيض' : 'موزعة نسبياً مع المدة المنقضية'}.<br/>
              <strong>5.</strong> الخصم الممنوح: ${proRateDiscount ? 'موزع نسبياً مع مدة الاستفادة الفعلية' : 'محتسب بالكامل'}.
            </div>

            <!-- Pricing Comparison -->
            <table class="print-table" style="margin: 0;">
              <thead>
                <tr>
                  <th style="text-align: right;">البند المالي</th>
                  <th style="width: 120px; text-align: center;">التعاقد الأصلي</th>
                  <th style="width: 140px; text-align: left;">التسوية إذا أغلق اليوم</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="text-align: right;">إيجار اللوحات (الصافي)</td>
                  <td style="text-align: center;" class="font-numbers">${res.originalRent.toLocaleString('ar-LY')} د.ل</td>
                  <td style="text-align: left;" class="font-numbers font-bold text-emerald-600">${res.adjustedRent.toLocaleString('ar-LY')} د.ل</td>
                </tr>
                <tr>
                  <td style="text-align: right;">مجموع مصاريف التجهيز</td>
                  <td style="text-align: center;" class="font-numbers">${(res.printCost + res.installationCost).toLocaleString('ar-LY')} د.ل</td>
                  <td style="text-align: left;" class="font-numbers">${(res.adjustedPrint + res.adjustedInstall).toLocaleString('ar-LY')} د.ل</td>
                </tr>
                <tr>
                  <td class="status-unpaid" style="text-align: right;">الخصم الممنوح (-)</td>
                  <td style="text-align: center;" class="font-numbers status-unpaid">-${res.discount.toLocaleString('ar-LY')} د.ل</td>
                  <td style="text-align: left;" class="font-numbers status-unpaid">-${res.adjustedDiscount.toLocaleString('ar-LY')} د.ل</td>
                </tr>
                <tr class="totals-row">
                  <td style="text-align: right;">إجمالي العقد النهائي</td>
                  <td style="text-align: center;" class="font-numbers">${res.originalTotal.toLocaleString('ar-LY')} د.ل</td>
                  <td style="text-align: left;" class="font-numbers text-amber-600">${res.adjustedTotal.toLocaleString('ar-LY')} د.ل</td>
                </tr>
                <tr>
                  <td style="text-align: right;">المدفوع الفعلي</td>
                  <td style="text-align: center;" class="font-numbers font-bold text-emerald-600">${res.originalPaid.toLocaleString('ar-LY')} د.ل</td>
                  <td style="text-align: left;" class="font-numbers font-bold text-emerald-600">${res.adjustedPaid.toLocaleString('ar-LY')} د.ل</td>
                </tr>
                <tr class="grand-total-row">
                  <td style="text-align: right;">${res.adjustedRemaining >= 0 ? 'المتبقي بذمة العميل' : 'رصيد فائض مستحق للزبون'}</td>
                  <td style="text-align: center;" class="font-numbers text-muted-foreground">${res.originalRemaining.toLocaleString('ar-LY')} د.ل</td>
                  <td style="text-align: left;" class="font-numbers">
                    ${Math.abs(res.adjustedRemaining).toLocaleString('ar-LY')} د.ل
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');

    const title = `تقرير تسوية وتصفية الحساب المالي - ${customerName}`;
    
    const headerData = {
      titleAr: 'تقرير تسوية وتصفية الحساب المالي',
      titleEn: 'ACCOUNTS SETTLEMENT REPORT',
      documentNumber: `SET-${Date.now().toString().slice(-6)}`,
      date: new Date().toLocaleDateString('ar-LY'),
    };

    const partyData = {
      title: 'بيانات العميل المستهدف',
      name: customerName,
      details: [
        customerCompany ? `الشركة: ${customerCompany}` : '',
        `تاريخ التسوية: ${closureDate}`,
        `الفئة السعرية للتسوية: ${overrideCategory === 'default' ? `الافتراضية للزبون (${customerCategoryName})` : overrideCategory}`,
        `طريقة احتساب الإيجار: ${calculationMethod === 'closest_period' ? 'مطابقة شريحة من جدول الأسعار' : 'نسبة وتناسب مباشر من سعر العقد الأصلي (دون تقريب)'}`
      ].filter(Boolean)
    };

    // Load logo with absolute path fallback using window origin
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const fullLogoUrl = `${origin}/logofaresgold.svg`;
    let logoDataUri = '';
    try {
      logoDataUri = await loadLogoAsDataUri(fullLogoUrl);
    } catch (e) {
      console.error('Failed to load logo as data uri', e);
    }
    if (!logoDataUri) {
      logoDataUri = fullLogoUrl;
    }

    // Force swap to place details on right & logo on left, and force the corporate horse logo without redundant overlapping text
    const themeToUse = {
      ...printTheme,
      showLogo: true,
      logoPath: '/logofaresgold.svg',
      headerSwap: true, // Swaps header: title on the right, logo on the left in RTL
      showCompanyName: false,
      showCompanySubtitle: false,
      showCompanyAddress: false,
      showCompanyContact: false,
    };

    const bodyContent = `
      <style>
        /* Force Portrait A4 width on screen and print to match receipts and invoices */
        @media screen {
          .print-container {
            width: 210mm !important;
            max-width: 210mm !important;
            padding: 15mm !important;
            background: white !important;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1) !important;
            margin: 20px auto !important;
          }
        }
        @media print {
          @page {
            size: A4 portrait !important;
            margin: 0 !important;
          }
          html, body {
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .print-container {
            width: 210mm !important;
            max-width: 210mm !important;
            padding: 15mm !important;
            box-shadow: none !important;
            background: white !important;
          }
        }

        /* Align English subtitle to the right side next to the Arabic title */
        .u-invoice-subtitle {
          text-align: right !important;
          direction: rtl !important;
          margin-top: 4px !important;
        }

        /* Position the company logo cleanly on the far left side */
        .u-company-side {
          align-items: flex-end !important;
          text-align: left !important;
        }
        .u-logo {
          display: block !important;
          margin-left: 0 !important;
          margin-right: auto !important;
          max-height: 80px !important;
          width: auto !important;
        }

        /* Prevent vertical text split in table columns and use unified table classes */
        .print-table {
          table-layout: auto !important;
          width: 100% !important;
          border-collapse: collapse !important;
          margin-bottom: 25px !important;
        }
        .print-table th, .print-table td {
          padding: 6px 8px !important;
          font-size: 9px !important;
          border: 1px solid #e2e8f0 !important;
        }
        .print-table th {
          white-space: nowrap !important;
          text-align: center !important;
          font-weight: bold !important;
        }
        .print-table td {
          text-align: center !important;
          color: #1e293b !important;
          vertical-align: middle !important;
        }
        .print-table .grand-total-row td,
        .print-table .grand-total-row td.text-muted-foreground,
        .print-table .totals-row td,
        .print-table .totals-row td.font-numbers,
        .print-table .totals-row td.text-amber-600 {
          color: #ffffff !important;
        }
        .print-table td.font-numbers {
          font-family: 'Courier New', monospace;
          font-weight: bold;
        }
        
        /* Force color print settings */
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        
        /* Badges */
        .badge {
          display: inline-block;
          font-size: 7px;
          font-weight: 700;
          padding: 1px 4px;
          border-radius: 3px;
          margin: 1px;
          border: 1px solid;
        }
        .badge-included {
          background-color: #ecfdf5 !important;
          border-color: #a7f3d0 !important;
          color: #065f46 !important;
        }
        .badge-add {
          background-color: #f1f5f9 !important;
          border-color: #cbd5e1 !important;
          color: #475569 !important;
        }
        
        /* Status texts */
        .status-unpaid {
          color: #be123c !important;
          font-weight: 700;
        }
        .status-surplus {
          color: #1d4ed8 !important;
          font-weight: 700;
        }
        .status-paid {
          color: #047857 !important;
          font-weight: 700;
        }

        /* Decision Alert box overrides */
        .decision-alert {
          padding: 12px;
          border-radius: 8px;
          border: 2px solid ${themeToUse.primaryColor || '#000000'} !important;
          margin-bottom: 20px;
          text-align: center;
        }
        .decision-alert-rose {
          background-color: #fff1f2 !important;
          border-color: #fecdd3 !important;
          color: #9f1239 !important;
        }
        .decision-alert-blue {
          background-color: #f0f9ff !important;
          border-color: #bae6fd !important;
          color: #075985 !important;
        }
        .decision-alert-emerald {
          background-color: #f0fdf4 !important;
          border-color: #bbf7d0 !important;
          color: #166534 !important;
        }

        /* Target customer data card - Solid White background with thin border */
        .party-section {
          background-color: #ffffff !important;
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          color: #1e293b !important;
          padding: 10px 15px !important;
          margin-bottom: 20px !important;
          border-radius: 6px !important;
          border-right: 5px solid ${themeToUse.primaryColor || '#000000'} !important;
          border-left: none !important;
        }
        .party-title {
          color: ${themeToUse.primaryColor || '#000000'} !important;
          font-size: 11px !important;
          font-weight: bold !important;
          margin-bottom: 4px !important;
        }
        .party-details {
          color: #334155 !important;
          font-size: 10px !important;
        }

        /* Page break styling */
        .page-break {
          page-break-before: always !important;
          break-before: page !important;
        }
      </style>

      <!-- Decision Alert Box -->
      <div class="decision-alert ${
        totals.netRemaining > 0 
          ? 'decision-alert-rose' 
          : totals.netRemaining < 0 
            ? 'decision-alert-blue' 
            : 'decision-alert-emerald'
      }">
        <h4 style="margin: 0 0 5px 0; font-size: 13px; font-weight: 800;">خلاصة قرار التسوية المالي النهائي</h4>
        <p style="margin: 0; font-size: 11px; font-weight: 700;">
          المبلغ المستحق للإغلاق والتسوية النهائية: 
          <strong>${Math.abs(totals.netRemaining).toLocaleString('ar-LY')} د.ل</strong> 
          (${totals.netRemaining > 0 ? 'مطالب بالدفع ذمة دائنة' : totals.netRemaining < 0 ? 'مستحق للاسترداد كفائض للزبون' : 'الحساب متوازن بالكامل'})
        </p>
      </div>

      <!-- Totals Cards Grid -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px;">
        <div style="background-color: #fcfbf7; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; text-align: center;">
          <div style="font-size: 9px; font-weight: 700; color: #475569; margin: 0 0 5px 0;">إجمالي العقود الأصلي</div>
          <div style="font-size: 15px; font-weight: 900; color: #0f172a;">${totals.originalTotalSum.toLocaleString('ar-LY')} د.ل</div>
        </div>
        <div style="background-color: #fcfbf7; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; text-align: center;">
          <div style="font-size: 9px; font-weight: 700; color: #475569; margin: 0 0 5px 0;">القيمة المعدلة (إذا أغلق اليوم)</div>
          <div style="font-size: 15px; font-weight: 900; color: #0f172a;">${totals.adjustedTotalSum.toLocaleString('ar-LY')} د.ل</div>
        </div>
        <div style="background-color: #fcfbf7; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; text-align: center;">
          <div style="font-size: 9px; font-weight: 700; color: #475569; margin: 0 0 5px 0;">إجمالي المبالغ المدفوعة فعلياً</div>
          <div style="font-size: 15px; font-weight: 900; color: #0f172a;">${totals.paidSum.toLocaleString('ar-LY')} د.ل</div>
        </div>
        <div style="background-color: ${totals.netRemaining >= 0 ? '#fff1f2' : '#eff6ff'}; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; text-align: center;">
          <div style="font-size: 9px; font-weight: 700; color: #475569; margin: 0 0 5px 0;">${totals.netRemaining >= 0 ? 'المتبقي بذمة العميل' : 'رصيد مستحق للزبون (فائض)'}</div>
          <div style="font-size: 15px; font-weight: 900; color: ${totals.netRemaining >= 0 ? '#be123c' : '#1d4ed8'};">
            ${Math.abs(totals.netRemaining).toLocaleString('ar-LY')} د.ل
          </div>
        </div>
      </div>

      <!-- Contracts Summary Table -->
      <h3 style="font-size: 12px; font-weight: 800; color: #0f172a; margin-bottom: 10px; margin-top: 10px;">ملخص إجمالي أرصدة تسوية العقود</h3>
      <table class="print-table">
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">ت</th>
            <th style="width: 60px; text-align: center;">رقم العقد</th>
            <th style="text-align: right;">نوع الإعلان والخدمات</th>
            <th style="width: 110px; text-align: center;">المدة (المنقضية / الكلية)</th>
            <th style="width: 110px; text-align: center;">الشريحة المعتمدة</th>
            <th style="width: 90px; text-align: left;">القيمة الأصلية</th>
            <th style="width: 90px; text-align: left;">القيمة المعدلة</th>
            <th style="width: 90px; text-align: left;">المدفوع الفعلي</th>
            <th style="width: 130px; text-align: left;">رصيد التسوية</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <!-- Detailed sheets for each contract -->
      ${detailedSheetsHTML}
    `;

    const htmlContent = generatePrintDocument({
      theme: themeToUse,
      title,
      headerData,
      logoDataUri,
      partyData,
      bodyContent
    });

    await openPrintWindow(htmlContent, title);
  };

  return (
    <div className="p-6 space-y-6 max-w-full mx-auto" style={{ direction: 'rtl' }}>
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <Calculator className="h-6 w-6 text-amber-500 animate-pulse" />
            <span>محاكي إغلاق عقود العملاء</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 font-bold">
            قم بتجربة إغلاق كافة عقود زبون معين بتاريخ اليوم أو تاريخ مخصص، واحتساب المستحقات الفعلية والمدد المنقضية بناءً على شرائح جدول الأسعار المحفوظة.
          </p>
        </div>
        {selectedCustomerId && simulationResults.length > 0 && (
          <Button
            onClick={printProfessionalReport}
            className="no-print flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md h-10 px-4 text-xs cursor-pointer"
          >
            <Printer className="h-4.5 w-4.5" />
            <span>طباعة تقرير التسوية</span>
          </Button>
        )}
      </div>

      {/* Simulator Inputs Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
        <Card className="lg:col-span-2 border-border bg-card/30 backdrop-blur-md rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <User className="h-4 w-4 text-amber-500" />
              <span>إعدادات المحاكاة والعميل</span>
            </CardTitle>
            <CardDescription className="text-xs">
              حدد العميل وتاريخ التسوية المطلوب لاحتساب الفروقات المالية.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Customer Select */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">ابحث واختر العميل</Label>
                <div className="space-y-2">
                  <Input 
                    type="text" 
                    placeholder="ابحث باسم العميل أو الشركة..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-10 text-xs"
                  />
                  <Select 
                    value={selectedCustomerId} 
                    onValueChange={handleCustomerChange}
                  >
                    <SelectTrigger className="h-10 text-xs">
                      <SelectValue placeholder="اختر من قائمة العملاء المفلترة..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {filteredCustomers.length > 0 ? (
                        filteredCustomers.map(c => (
                          <SelectItem key={c.id} value={c.id} className="text-xs">
                            {c.name} {c.company ? `(${c.company})` : ''} — فئة {c.pricing_category || 'عادي'}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled className="text-xs text-center">لا توجد نتائج مطابقة</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Closure Date Select */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">تاريخ الإغلاق والتسوية</Label>
                <div className="flex flex-col gap-2">
                  <Input 
                    type="date"
                    value={closureDate}
                    onChange={(e) => setClosureDate(e.target.value)}
                    className="h-10 font-bold"
                  />
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setClosureDate(new Date().toISOString().split('T')[0])}
                      className="text-xs cursor-pointer flex-1"
                    >
                      <Clock className="h-3.5 w-3.5 mr-1" />
                      تاريخ اليوم
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        if (earliestEndDateContract) {
                          const earliestDate = earliestEndDateContract['End Date'] || earliestEndDateContract.original_end_date;
                          if (earliestDate) setClosureDate(earliestDate);
                        }
                      }}
                      className="text-xs cursor-pointer flex-1"
                      disabled={!earliestEndDateContract}
                    >
                      نهاية العقد الأول {earliestEndDateContract ? `(#${earliestEndDateContract.Contract_Number})` : ''}
                    </Button>
                  </div>
                  {earliestEndDateContract && (
                    <p className="text-[9px] text-muted-foreground leading-normal mt-1.5 p-1.5 rounded bg-muted/40 border border-border/40">
 زر <strong>نهاية العقد الأول</strong> يضبط تاريخ المحاكاة تلقائياً إلى تاريخ انتهاء العقد الأقرب للزبون 
                      (عقد <strong>#{earliestEndDateContract.Contract_Number}</strong> ينتهي بتاريخ <strong>{earliestEndDateContract['End Date'] || earliestEndDateContract.original_end_date}</strong>).
                    </p>
                  )}
                </div>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Calculation Settings Card */}
        <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Settings className="h-4 w-4 text-amber-500" />
              <span>خيارات الاحتساب</span>
            </CardTitle>
            <CardDescription className="text-xs">
              تحديد كيفية التعامل مع الخصومات والمصاريف الإضافية.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-2 rounded-xl bg-background border border-border/40">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold cursor-pointer">توزيع الخصم نسبياً</Label>
                <p className="text-[10px] text-muted-foreground leading-normal">
                  تخفيض الخصم الممنوح طردياً مع المدة المنقضية.
                </p>
              </div>
              <Switch checked={proRateDiscount} onCheckedChange={setProRateDiscount} />
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-background border border-border/40">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold cursor-pointer">كامل تكاليف التجهيز</Label>
                <p className="text-[10px] text-muted-foreground leading-normal">
                  احتساب تكاليف الطباعة والتركيب كاملة دون نسبية.
                </p>
              </div>
              <Switch checked={fullSetupCosts} onCheckedChange={setFullSetupCosts} />
            </div>

            <div className="space-y-2 pt-2 border-t border-border/40">
              <Label className="text-xs font-bold">الفئة السعرية المستهدفة للمحاكاة</Label>
              <Select 
                value={overrideCategory} 
                onValueChange={setOverrideCategory}
              >
                <SelectTrigger className="h-9 text-xs bg-background border-border/40">
                  <SelectValue placeholder="اختر الفئة السعرية للمحاكاة..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default" className="text-xs">الفئة الأصلية للعقد (افتراضي)</SelectItem>
                  {uniqueCategories.map(cat => (
                    <SelectItem key={cat} value={cat} className="text-xs">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 pt-2 border-t border-border/40">
              <Label className="text-xs font-bold">طريقة احتساب الإيجار المعدل</Label>
              <Select 
                value={calculationMethod} 
                onValueChange={(v: any) => setCalculationMethod(v)}
              >
                <SelectTrigger className="h-9 text-xs bg-background border-border/40">
                  <SelectValue placeholder="اختر طريقة الاحتساب..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="closest_period" className="text-xs">مطابقة شريحة من جدول الأسعار (افتراضي)</SelectItem>
                  <SelectItem value="original_prorate" className="text-xs">نسبة وتناسب مباشر من سعر العقد الأصلي</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Simulator Overall Metrics Summary */}
      {selectedCustomerId && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Card 1: Original total */}
          <Card className="bg-gradient-to-br from-muted/50 to-muted/20 border-border/40 shadow-sm rounded-2xl">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-semibold">إجمالي العقود الأصلي</p>
                <h3 className="text-lg font-black font-numbers">{totals.originalTotalSum.toLocaleString('ar-LY')} د.ل</h3>
                <p className="text-[10px] text-muted-foreground">{contracts.length} عقود إجمالية ({totals.incompleteDurationCount} غير مكتملة المدة)</p>
              </div>
              <div className="p-2.5 rounded-xl bg-muted/40 text-muted-foreground">
                <FileText className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Adjusted total */}
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20 shadow-sm rounded-2xl">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold">القيمة المعدلة (إذا أغلق اليوم)</p>
                <h3 className="text-lg font-black font-numbers text-amber-600 dark:text-amber-400">{totals.adjustedTotalSum.toLocaleString('ar-LY')} د.ل</h3>
                <p className="text-[10px] text-amber-600/80">نسبة التخفيض: {totals.originalTotalSum > 0 ? Math.round(((totals.originalTotalSum - totals.adjustedTotalSum) / totals.originalTotalSum) * 100) : 0}%</p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600">
                <Calculator className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Paid amount */}
          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 shadow-sm rounded-2xl">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">إجمالي المبالغ المدفوعة فعلياً</p>
                <h3 className="text-lg font-black font-numbers text-emerald-600 dark:text-emerald-400">{totals.paidSum.toLocaleString('ar-LY')} د.ل</h3>
                <p className="text-[10px] text-emerald-600/80">المحصل من القيمة المعدلة</p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-600">
                <DollarSign className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Net Balance Closure */}
          <Card className={`bg-gradient-to-br ${totals.netRemaining >= 0 ? 'from-rose-500/10 to-rose-500/5 border-rose-500/20' : 'from-blue-500/10 to-blue-500/5 border-blue-500/20'} shadow-sm rounded-2xl`}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold">{totals.netRemaining >= 0 ? 'المتبقي بذمة العميل' : 'رصيد مستحق للزبون (فائض)'}</p>
                <h3 className={`text-lg font-black font-numbers ${totals.netRemaining >= 0 ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>
                  {Math.abs(totals.netRemaining).toLocaleString('ar-LY')} د.ل
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  {totals.netRemaining >= 0 ? 'يجب تحصيله لإغلاق الحساب' : 'يتم إرجاعه أو ترحيله لحسابه'}
                </p>
              </div>
              <div className={`p-2.5 rounded-xl ${totals.netRemaining >= 0 ? 'bg-rose-500/20 text-rose-600' : 'bg-blue-500/20 text-blue-600'}`}>
                {totals.netRemaining >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              </div>
            </CardContent>
          </Card>

        </div>
      )}

      {/* صندوق خلاصة التسوية المباشر والواضح جداً */}
      {selectedCustomerId && simulationResults.length > 0 && (
        <div className={cn(
          "p-5 rounded-2xl border-2 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg animate-in fade-in duration-300",
          totals.netRemaining > 0 
            ? "bg-rose-500/10 border-rose-500/35 text-rose-900 dark:text-rose-200" 
            : totals.netRemaining < 0 
              ? "bg-blue-500/10 border-blue-500/35 text-blue-900 dark:text-blue-200"
              : "bg-emerald-500/10 border-emerald-500/35 text-emerald-900 dark:text-emerald-200"
        )}>
          <div className="flex items-center gap-4">
            <div className={cn(
              "p-3.5 rounded-xl shrink-0 shadow-inner",
              totals.netRemaining > 0 
                ? "bg-rose-500/20 text-rose-600 dark:text-rose-400" 
                : totals.netRemaining < 0 
                  ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                  : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
            )}>
              {totals.netRemaining > 0 ? (
                <AlertCircle className="h-7 w-7 animate-bounce" />
              ) : (
                <CheckCircle className="h-7 w-7" />
              )}
            </div>
            <div>
              <h4 className="text-base font-black">خلاصة قرار التسوية المالي النهائي</h4>
              <p className="text-xs opacity-80 mt-1">
                الزبون: <span className="font-bold">{customers.find(c => c.id === selectedCustomerId)?.name || 'غير محدد'}</span> — تاريخ المحاكاة: <span className="font-bold">{closureDate}</span>
              </p>
            </div>
          </div>
          
          <div className="text-center md:text-left min-w-[200px] border-t md:border-t-0 md:border-r border-current/25 pt-3 md:pt-0 md:pr-6 flex flex-col items-center md:items-end">
            <span className="text-[10px] uppercase font-bold opacity-75">المبلغ المطلوب لإغلاق الحساب</span>
            <span className="text-3xl font-black font-numbers tracking-tight mt-1">
              {Math.abs(totals.netRemaining).toLocaleString('ar-LY')} د.ل
            </span>
            <span className="text-xs font-bold mt-1.5 px-3 py-1 rounded-full bg-current/10">
              {totals.netRemaining > 0 ? 'مطالب بالدفع (ذمة دائنة)' : totals.netRemaining < 0 ? 'مستحق للاسترداد (فائض مدفوع)' : 'الحساب متوازن ومسوى'}
            </span>
          </div>
        </div>
      )}

      {/* Simulator Details Section */}
      {loading ? (
        <Card className="border-border p-12 text-center flex flex-col items-center justify-center gap-4 bg-card/30 backdrop-blur-md rounded-2xl">
          <RefreshCw className="h-10 w-10 text-amber-500 animate-spin" />
          <p className="text-sm font-semibold text-muted-foreground">جاري تحميل بيانات العقود والأسعار...</p>
        </Card>
      ) : selectedCustomerId && simulationResults.length > 0 ? (
        <div className="space-y-6">
          {/* لوحة توضيحية لآلية الاحتساب */}
          <Card className="border-border bg-amber-500/5 backdrop-blur-md rounded-2xl shadow-sm border-dashed">
            <CardContent className="p-5 space-y-3">
              <h3 className="text-sm font-bold text-amber-800 dark:text-amber-400 flex items-center gap-2">
                <HelpCircle className="h-4.5 w-4.5" />
                <span>كيف يتم احتساب تسوية إغلاق العقود؟</span>
              </h3>
              <ul className="text-xs text-amber-700 dark:text-amber-400/90 list-disc list-inside space-y-2 leading-relaxed">
                <li>
                  <strong>حساب المدة المنقضية:</strong> يتم طرح تاريخ بداية العقد من تاريخ التسوية المحدد (اليوم) للحصول على عدد الأيام الفعلية التي استفاد منها العميل.
                </li>
                <li>
                  <strong>البحث عن الفترة المعتمدة:</strong> يتم مقارنة الأيام المنقضية بالفترات المحددة في جدول الأسعار (يوم، شهر، شهرين، 3 أشهر، 6 أشهر، سنة كاملة) ويتم اعتماد أكبر فترة لا تتجاوز المدة المنقضية.
                </li>
                <li>
                  <strong>احتساب سعر اليوم:</strong> يُقسم سعر الشريحة الأقرب للوحة على عدد أيامها، ثم يضرب هذا المعدل اليومي في عدد أيام الاستخدام الفعلية.
                </li>
                <li>
                  <strong>الخصومات ومصاريف التأسيس:</strong> يتم تطبيق نسبة الخصم الموزعة تناسبياً، وتضاف تكاليف التجهيز والطباعة وفقاً للخيارات المحددة في لوحة التحكم الجانبية.
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* جدول ملخص العقود وتوضيح مصدر الفائض أو العجز */}
          <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl shadow-sm overflow-hidden">
            <CardHeader className="py-4 px-6 border-b border-border/40">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <TrendingDown className="h-4.5 w-4.5 text-primary" />
                <span>ملخص تسوية العقود ومصدر الفروقات المالية</span>
              </CardTitle>
              <CardDescription className="text-xs">
                جدول يلخص أثر الإغلاق على كل عقد من عقود العميل الـ {simulationResults.length} لمعرفة أي العقود يترتب عليها فائض أو مستحقات.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="text-xs font-bold text-center w-[50px]">ت</TableHead>
                      <TableHead className="text-xs font-bold text-center">رقم العقد</TableHead>
                      <TableHead className="text-xs font-bold text-center">نوع الإعلان</TableHead>
                      <TableHead className="text-xs font-bold text-center">المدة المنقضية / الكلية</TableHead>
                      <TableHead className="text-xs font-bold text-center">الشريحة المعتمدة</TableHead>
                      <TableHead className="text-xs font-bold text-left">القيمة الأصلية</TableHead>
                      <TableHead className="text-xs font-bold text-left">القيمة المعدلة</TableHead>
                      <TableHead className="text-xs font-bold text-left">المدفوع الفعلي</TableHead>
                      <TableHead className="text-xs font-bold text-left">حالة رصيد التسوية</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {simulationResults.map((res, index) => (
                      <TableRow key={res.contractNumber} className="hover:bg-muted/10">
                        <TableCell className="text-center font-bold text-xs font-numbers">{index + 1}</TableCell>
                        <TableCell className="text-center font-bold text-xs font-numbers">#{res.contractNumber}</TableCell>
                        <TableCell className="text-center text-xs">
                          <div className="font-semibold">{res.adType}</div>
                          <div className="flex items-center justify-center gap-1 mt-1 text-[9px] font-bold">
                            {res.printEnabled && (
                              res.includePrint ? (
                                <span className="text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">طباعة مشمولة</span>
                              ) : (
                                <span className="text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-border/40">الطباعة +</span>
                              )
                            )}
                            {res.installEnabled && (
                              res.includeInstall ? (
                                <span className="text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">تركيب مشمول</span>
                              ) : (
                                <span className="text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-border/40">التركيب +</span>
                              )
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          <span className="font-bold text-amber-600 font-numbers">{res.elapsedDays}</span>
                          <span className="text-muted-foreground/60 font-numbers"> / {res.originalDurationDays} يوم</span>
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          <div className="flex flex-col gap-1 items-center">
                            <span className="font-semibold text-primary px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                              {res.closestPeriodName}
                            </span>
                            <span className="text-[9px] text-muted-foreground font-bold font-numbers">
                              (الأصلية: {getPeriodNameFromDays(res.originalDurationDays)})
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-left font-numbers text-xs">{res.originalTotal.toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell className="text-left font-numbers text-xs font-bold text-amber-700 dark:text-amber-400">{res.adjustedTotal.toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell className="text-left font-numbers text-xs text-emerald-600 font-semibold">{res.adjustedPaid.toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell className="text-left">
                          {res.adjustedRemaining > 0 ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center gap-1 justify-end">
                              <AlertCircle className="h-3 w-3 shrink-0" />
                              مطلوب دفع {res.adjustedRemaining.toLocaleString('ar-LY')} د.ل
                            </span>
                          ) : res.adjustedRemaining < 0 ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center gap-1 justify-end">
                              <CheckCircle className="h-3 w-3 shrink-0" />
                              فائض مسترجع {Math.abs(res.adjustedRemaining).toLocaleString('ar-LY')} د.ل
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center gap-1 justify-end">
                              مسوى بالكامل (0)
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <h2 className="text-base font-black text-foreground flex items-center gap-2 mt-6">
            <FileText className="h-5 w-5 text-amber-500" />
            <span>تفاصيل تسوية العقود الفردية (كشف تفصيلي)</span>
          </h2>

          {simulationResults.map(res => (
            <Card key={res.contractNumber} className="border-border bg-card/30 backdrop-blur-md rounded-2xl shadow-sm overflow-hidden">
              
              {/* Contract Info Header */}
              <CardHeader className="bg-gradient-to-r from-primary/5 via-transparent to-transparent border-b border-border/20 py-4 px-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="p-2 rounded-lg bg-primary/10 text-primary font-bold text-xs">
                      #{res.contractNumber}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">
                        عقد رقم #{res.contractNumber} — {res.adType}
                      </h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        الفترة الأصلية: {res.startDate} إلى {res.endDate} ({res.originalDurationDays} يوم)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-bold border-amber-500/30 text-amber-800 dark:text-amber-400 bg-amber-500/5">
                      فئة {res.customerCategory}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] font-bold">
                      {res.pricingMode === 'months' ? 'تقسيم شهري' : 'تقسيم يومي'}
                    </Badge>
                    <Badge className={`text-[10px] font-bold ${res.elapsedDays >= res.originalDurationDays ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-400' : 'bg-amber-500/20 text-amber-800 dark:text-amber-400'}`}>
                      المدة المنقضية: {res.elapsedDays} يوم ({Math.round((res.elapsedDays / (res.originalDurationDays || 1)) * 100)}%)
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                
                {/* Billboards breakdown table */}
                <div className="space-y-2">
                  <h5 className="text-xs font-bold text-foreground">اللوحات المشمولة بالعقد والأسعار المحتسبة</h5>
                  <div className="border border-border/40 rounded-xl overflow-hidden bg-background/50">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="text-xs font-bold text-right">اللوحة</TableHead>
                          <TableHead className="text-xs font-bold text-center">المقاس / الفئة</TableHead>
                          <TableHead className="text-xs font-bold className text-center">السعر الأصلي</TableHead>
                          <TableHead className="text-xs font-bold text-center">المدة المنقضية</TableHead>
                          <TableHead className="text-xs font-bold text-center">الفترة المعتمدة وسعرها</TableHead>
                          <TableHead className="text-xs font-bold text-center">سعر اليوم الواحد</TableHead>
                          <TableHead className="text-xs font-bold text-left">السعر المعدل</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {res.billboards.map(bb => (
                          <TableRow key={bb.id} className="hover:bg-muted/10">
                            <TableCell className="text-xs font-bold text-right">{bb.name}</TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center">
                                <span className="text-xs font-semibold font-numbers">{bb.size}</span>
                                <Badge variant="outline" className="text-[9px] scale-90 mt-0.5">{bb.level}</Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-numbers text-xs">{bb.originalPrice.toLocaleString('ar-LY')} د.ل</TableCell>
                            <TableCell className="text-center font-numbers text-xs text-amber-600 font-bold">{bb.elapsedDays ?? res.elapsedDays} يوم</TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center">
                                <span className="text-xs font-bold text-foreground">{bb.closestPeriodName}</span>
                                <span className="text-[10px] font-bold font-numbers text-amber-700 dark:text-amber-400">{bb.closestPeriodPrice.toLocaleString('ar-LY')} د.ل</span>
                                <span className={`text-[8px] ${bb.pricingSource === 'pricing_table' ? 'text-emerald-600' : bb.pricingSource === 'contract_prorate' ? 'text-amber-600' : 'text-muted-foreground'}`}>
                                  ({bb.pricingSource === 'pricing_table' ? 'من جدول الأسعار' : bb.pricingSource === 'static_table' ? 'من الجدول الثابت' : bb.pricingSource === 'daily_rate' ? 'من سعر اليوم' : 'من سعر العقد'})
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center">
                                <span className="text-xs font-bold font-numbers">{(bb.dailyRate).toFixed(2)} د.ل</span>
                                <span className="text-[8px] text-muted-foreground font-numbers">({bb.closestPeriodPrice.toLocaleString('ar-LY')} ÷ {bb.closestPeriodDays} يوم)</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-left font-numbers text-xs font-black text-emerald-600 dark:text-emerald-400">
                              {bb.adjustedPrice.toLocaleString('ar-LY')} د.ل
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Financial Summary comparison table */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/20">
                  
                  {/* Explanation card */}
                  <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 space-y-2 flex flex-col justify-center">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-400">
                      <HelpCircle className="h-4 w-4 shrink-0" />
                      <span>تفاصيل معادلة التسوية المالية للعقد</span>
                    </div>
                    <p className="text-xs text-amber-700 dark:text-amber-400/80 leading-relaxed text-justify">
                      يتم حساب قيمة الإيجار المعدل بجمع إيجار اللوحات المحتسب بناءً على المدة المنقضية ( {res.elapsedDays} يوم ) طردياً مع شرائح الأسعار الأقرب.
                      مضافاً إليها مصاريف التجهيز (طباعة وتركيب)
                      {fullSetupCosts ? ' كاملة دون تخفيض' : ' موزعة نسبياً مع المدة المنقضية'}،
                      ومخصوماً منها قيمة الخصم الممنوح {proRateDiscount ? 'موزعة نسبياً مع مدة الاستفادة الفعلية.' : 'بالكامل.'}
                    </p>
                  </div>

                  {/* Pricing Comparison Table */}
                  <div className="border border-border/40 rounded-xl overflow-hidden bg-background/50">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="text-xs font-bold text-right">البند المالي</TableHead>
                          <TableHead className="text-xs font-bold text-center">التعاقد الأصلي</TableHead>
                          <TableHead className="text-xs font-bold text-left">التسوية إذا أغلق اليوم</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="text-xs text-right">إيجار اللوحات (الصافي)</TableCell>
                          <TableCell className="text-center font-numbers text-xs">{res.originalRent.toLocaleString('ar-LY')} د.ل</TableCell>
                          <TableCell className="text-left font-numbers text-xs text-emerald-600 font-bold">{res.adjustedRent.toLocaleString('ar-LY')} د.ل</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs text-right">مجموع مصاريف التجهيز</TableCell>
                          <TableCell className="text-center font-numbers text-xs">{(res.printCost + res.installationCost).toLocaleString('ar-LY')} د.ل</TableCell>
                          <TableCell className="text-left font-numbers text-xs">
                            {(res.adjustedPrint + res.adjustedInstall).toLocaleString('ar-LY')} د.ل
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs text-right text-rose-600">الخصم الممنوح (-)</TableCell>
                          <TableCell className="text-center font-numbers text-xs text-rose-600">-{res.discount.toLocaleString('ar-LY')} د.ل</TableCell>
                          <TableCell className="text-left font-numbers text-xs text-rose-600">
                            -{res.adjustedDiscount.toLocaleString('ar-LY')} د.ل
                          </TableCell>
                        </TableRow>
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableCell className="text-xs font-black text-right">إجمالي العقد النهائي</TableCell>
                          <TableCell className="text-center font-numbers text-xs font-black">{res.originalTotal.toLocaleString('ar-LY')} د.ل</TableCell>
                          <TableCell className="text-left font-numbers text-xs font-black text-amber-600">{res.adjustedTotal.toLocaleString('ar-LY')} د.ل</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs text-right">المدفوع الفعلي</TableCell>
                          <TableCell className="text-center font-numbers text-xs font-bold text-emerald-600">{res.originalPaid.toLocaleString('ar-LY')} د.ل</TableCell>
                          <TableCell className="text-left font-numbers text-xs font-bold text-emerald-600">{res.adjustedPaid.toLocaleString('ar-LY')} د.ل</TableCell>
                        </TableRow>
                        <TableRow className={`${res.adjustedRemaining >= 0 ? 'bg-rose-500/5' : 'bg-blue-500/5'}`}>
                          <TableCell className="text-xs font-black text-right">
                            {res.adjustedRemaining >= 0 ? 'المتبقي بذمة العميل' : 'رصيد فائض مستحق للزبون'}
                          </TableCell>
                          <TableCell className="text-center font-numbers text-xs text-muted-foreground">{res.originalRemaining.toLocaleString('ar-LY')} د.ل</TableCell>
                          <TableCell className={`text-left font-numbers text-xs font-black ${res.adjustedRemaining >= 0 ? 'text-rose-600' : 'text-blue-600'}`}>
                            {Math.abs(res.adjustedRemaining).toLocaleString('ar-LY')} د.ل
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                </div>

              </CardContent>
            </Card>
          ))}
        </div>
      ) : selectedCustomerId ? (
        <Card className="border-border p-12 text-center flex flex-col items-center justify-center gap-2 bg-card/30 backdrop-blur-md rounded-2xl">
          <AlertCircle className="h-8 w-8 text-amber-500" />
          <p className="text-sm font-semibold text-muted-foreground">لا توجد عقود مسجلة لهذا العميل لمحاكاة إغلاقها.</p>
        </Card>
      ) : (
        <Card className="border-border p-12 text-center flex flex-col items-center justify-center gap-2 bg-card/30 backdrop-blur-md rounded-2xl border-dashed">
          <User className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-semibold text-muted-foreground">يرجى البحث واختيار عميل من القائمة أعلاه لبدء محاكاة إغلاق العقود.</p>
        </Card>
      )}

    </div>
  );
}
