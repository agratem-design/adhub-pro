import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateInstallationCostFromIds } from '@/services/installationService';

interface EditFormData {
  customerName: string;
  customerId: string | null;
  adType: string;
  pricingCategory: string;
  startDate: string;
  endDate: string;
  pricingMode: 'months' | 'days';
  durationMonths: number;
  durationDays: number;
  rentCost: number;
  discountType: 'percent' | 'amount';
  discountValue: number;
  operatingFeeRate: number;
}

interface EditInstallment {
  amount: number;
  paymentType: string;
  description: string;
  dueDate: string;
}

interface FriendBillboardCost {
  billboardId: string;
  friendCompanyId: string;
  friendCompanyName: string;
  friendRentalCost: number;
}

export function useContractEdit(contractId: string) {
  const [formData, setFormData] = useState<EditFormData>({
    customerName: '',
    customerId: null,
    adType: '',
    pricingCategory: 'عادي',
    startDate: '',
    endDate: '',
    pricingMode: 'months',
    durationMonths: 3,
    durationDays: 0,
    rentCost: 0,
    discountType: 'percent',
    discountValue: 0,
    operatingFeeRate: 3
  });

  const [selectedBillboards, setSelectedBillboards] = useState<string[]>([]);
  const [installments, setInstallments] = useState<EditInstallment[]>([]);
  const [installationCost, setInstallationCost] = useState<number>(0);
  const [installationDetails, setInstallationDetails] = useState<Array<{
    billboardId: string;
    billboardName: string;
    size: string;
    installationPrice: number;
    faces?: number;
    adjustedPrice?: number;
  }>>([]);
  const [pricingData, setPricingData] = useState<any[]>([]);
  const [originalContract, setOriginalContract] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [friendBillboardCosts, setFriendBillboardCosts] = useState<FriendBillboardCost[]>([]);

  // Load contract data
  useEffect(() => {
    if (!contractId) return;

    const loadContractData = async () => {
      try {
        setIsLoading(true);
        
        // Load contract from database
        const { data: contract, error } = await supabase
          .from('Contract')
          .select('*')
          .eq('Contract_Number', Number(contractId))
          .single();

        if (error) {
          console.error('Error loading contract:', error);
          return;
        }

        if (!contract) {
          console.error('Contract not found');
          return;
        }

        setOriginalContract(contract as any);

        // Update form data
        const contractData = contract as any;
        setFormData({
          customerName: contractData['Customer Name'] || '',
          customerId: contractData.customer_id || null,
          adType: contractData['Ad Type'] || '',
          pricingCategory: contractData.customer_category || 'عادي',
          startDate: contractData['Contract Date'] || '',
          endDate: contractData['End Date'] || '',
          pricingMode: 'months',
          durationMonths: 3,
          durationDays: 0,
          rentCost: contractData['Total Rent'] || 0,
          discountType: 'percent',
          discountValue: contractData.Discount || 0,
          operatingFeeRate: contract.operating_fee_rate || 3
        });

        // Set selected billboards
        if (contract.billboard_ids && Array.isArray(contract.billboard_ids)) {
          setSelectedBillboards(contract.billboard_ids);
        }

        // Set installments
        if (contract.installments_data && Array.isArray(contract.installments_data)) {
          setInstallments(contract.installments_data);
        }

        // Load friend billboard rentals for this contract
        const { data: friendRentals } = await supabase
          .from('friend_billboard_rentals')
          .select(`
            billboard_id,
            friend_company_id,
            friend_rental_cost,
            friend_companies!inner(name)
          `)
          .eq('contract_number', Number(contractId));

        if (friendRentals && friendRentals.length > 0) {
          const friendCosts: FriendBillboardCost[] = friendRentals.map((rental: any) => ({
            billboardId: String(rental.billboard_id),
            friendCompanyId: rental.friend_company_id,
            friendCompanyName: rental.friend_companies?.name || 'غير محدد',
            friendRentalCost: rental.friend_rental_cost || 0
          }));
          setFriendBillboardCosts(friendCosts);
        }

      } catch (error) {
        console.error('Error loading contract data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadContractData();
  }, [contractId]);

  // Load pricing data
  useEffect(() => {
    const loadPricingData = async () => {
      try {
        const { data, error } = await supabase
          .from('pricing')
          .select('*')
          .order('size', { ascending: true });

        if (!error && Array.isArray(data)) {
          setPricingData(data);
        }
      } catch (e) {
        console.warn('Failed to load pricing data');
      }
    };

    loadPricingData();
  }, []);

  // Calculate installation cost when selected billboards change
  useEffect(() => {
    if (selectedBillboards.length > 0) {
      const calculateCost = async () => {
        try {
          const result = await calculateInstallationCostFromIds(selectedBillboards);
          setInstallationCost(result.totalInstallationCost);
          setInstallationDetails(result.installationDetails);
        } catch (e) {
          console.warn('Failed to calculate installation cost:', e);
          setInstallationCost(0);
          setInstallationDetails([]);
        }
      };

      calculateCost();
    } else {
      setInstallationCost(0);
      setInstallationDetails([]);
    }
  }, [selectedBillboards]);

  // Auto-calculate end date when start date or duration changes
  useEffect(() => {
    if (!formData.startDate) return;
    
    const startDate = new Date(formData.startDate);
    const endDate = new Date(startDate);
    
    if (formData.pricingMode === 'months') {
      const days = Math.max(0, Number(formData.durationMonths || 0)) * 30;
      endDate.setDate(endDate.getDate() + days);
    } else {
      const days = Math.max(0, Number(formData.durationDays || 0));
      endDate.setDate(endDate.getDate() + days);
    }
    
    const isoDate = endDate.toISOString().split('T')[0];
    setFormData(prev => ({ ...prev, endDate: isoDate }));
  }, [formData.startDate, formData.durationMonths, formData.durationDays, formData.pricingMode]);

  const updateFormData = (updates: Partial<EditFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

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

  const removeFriendBillboardCost = (billboardId: string) => {
    setFriendBillboardCosts(prev => prev.filter(f => f.billboardId !== billboardId));
  };

  // ✅ Filter to only valid friend billboards (still in contract AND still have friend_company_id)
  const getValidFriendCosts = (billboards: any[]) => {
    return friendBillboardCosts
      .filter(f => {
        const bb = billboards.find((b: any) => String(b.ID) === f.billboardId);
        return bb && Boolean((bb as any).friend_company_id) && selectedBillboards.includes(f.billboardId);
      })
      .map(f => {
        const bb = billboards.find((b: any) => String(b.ID) === f.billboardId);
        const currentFriendCompanyId = (bb as any)?.friend_company_id;
        const currentFriendCompanyName = (bb as any)?.friend_companies?.name || f.friendCompanyName;
        return {
          ...f,
          friendCompanyId: currentFriendCompanyId || f.friendCompanyId,
          friendCompanyName: (currentFriendCompanyId ? currentFriendCompanyName : f.friendCompanyName) || 'غير محدد'
        };
      });
  };

  // Calculate total friend costs (raw - kept for backwards compat)
  const totalFriendCosts = friendBillboardCosts.reduce((sum, f) => sum + f.friendRentalCost, 0);

  const updateInstallment = (index: number, field: string, value: any) => {
    setInstallments(prev => prev.map((inst, i) => {
      if (i === index) {
        const updated = { ...inst, [field]: value };
        // Recalculate due date if payment type changed
        if (field === 'paymentType') {
          updated.dueDate = calculateDueDate(value, index);
        }
        return updated;
      }
      return inst;
    }));
  };

  const calculateDueDate = (paymentType: string, index: number, startDateOverride?: string): string => {
    const baseDate = startDateOverride || formData.startDate;
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
      return formData.endDate || '';
    }
    
    return date.toISOString().split('T')[0];
  };

  // ✅ FIXED: Use size_id for accurate price matching
  const getPriceFromDatabase = (sizeId: number | null, level: any, customer: string, months: number): number | null => {
    if (!sizeId) return null;
    
    // ✅ FIXED: Match by size_id instead of size name
    const dbRow = pricingData.find(p => 
      p.size_id === sizeId && 
      String(p.billboard_level || '').trim().toUpperCase() === String(level || '').trim().toUpperCase() && 
      String(p.customer_category || '').trim().toUpperCase() === String(customer || '').trim().toUpperCase()
    );
    
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
      return getPriceFromDatabase(sizeId, level, 'عادي', months);
    }
    
    return null;
  };

  // ✅ NEW: Calculate billboard price with discount distribution
  const calculateBillboardPriceWithDiscount = (
    billboard: any,
    months: number,
    days: number,
    mode: 'months' | 'days',
    totalDiscount: number,
    totalBillboards: number
  ): { priceBeforeDiscount: number; priceAfterDiscount: number; discountPerBillboard: number } => {
    const sizeId = billboard.size_id || billboard.Size_ID;
    const level = billboard.level || billboard.Level;
    
    let priceBeforeDiscount = 0;
    
    if (mode === 'months' && months > 0) {
      const price = getPriceFromDatabase(sizeId, level, formData.pricingCategory, months);
      priceBeforeDiscount = price || 0;
    } else if (mode === 'days' && days > 0) {
      const dailyPrice = getDailyPriceFromDatabase(sizeId, level, formData.pricingCategory);
      priceBeforeDiscount = (dailyPrice || 0) * days;
    }
    
    // Distribute discount equally across all billboards
    const discountPerBillboard = totalBillboards > 0 ? totalDiscount / totalBillboards : 0;
    const priceAfterDiscount = Math.max(0, priceBeforeDiscount - discountPerBillboard);
    
    return { priceBeforeDiscount, priceAfterDiscount, discountPerBillboard };
  };

  const getDailyPriceFromDatabase = (sizeId: number | null, level: any, customer: string): number | null => {
    if (!sizeId) return null;
    
    // ✅ FIXED: Match by size_id instead of size name
    const dbRow = pricingData.find(p => 
      p.size_id === sizeId && 
      String(p.billboard_level || '').trim().toUpperCase() === String(level || '').trim().toUpperCase() && 
      String(p.customer_category || '').trim().toUpperCase() === String(customer || '').trim().toUpperCase()
    );
    
    if (dbRow && dbRow.one_day !== null && dbRow.one_day !== undefined) {
      return Number(dbRow.one_day) || 0;
    }
    if (customer !== 'عادي') {
      return getDailyPriceFromDatabase(sizeId, level, 'عادي');
    }
    
    return null;
  };

  return {
    formData,
    updateFormData,
    selectedBillboards,
    setSelectedBillboards,
    installments,
    setInstallments,
    updateInstallment,
    installationCost,
    installationDetails,
    pricingData,
    getPriceFromDatabase,
    getDailyPriceFromDatabase,
    calculateDueDate,
    calculateBillboardPriceWithDiscount,
    originalContract,
    isLoading,
    friendBillboardCosts,
    updateFriendBillboardCost,
    removeFriendBillboardCost,
    totalFriendCosts
  };
}