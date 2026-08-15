import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { getPriceFor, getDailyPriceFor, CustomerType } from '@/data/pricing';
import { calculateInstallationCostFromIds } from '@/services/installationService';

export interface ContractFormData {
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

export interface Installment {
  amount: number;
  paymentType: string;
  description: string;
  dueDate: string;
}

export const useContractForm = (initialData?: Partial<ContractFormData>) => {
  // Form state
  const [formData, setFormData] = useState<ContractFormData>({
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
    operatingFeeRate: 3,
    ...initialData
  });

  // ✅ حساب الشهر = 30 يوم (مفعل افتراضياً)
  const [use30DayMonth, setUse30DayMonth] = useState<boolean>(true);


  // Selection and data
  const [selected, setSelected] = useState<string[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [userEditedRentCost, setUserEditedRentCost] = useState(false);

  // Installation cost
  const [installationCost, setInstallationCost] = useState<number>(0);
  const [installationDetails, setInstallationDetails] = useState<Array<{
    billboardId: string;
    billboardName: string;
    size: string;
    installationPrice: number;
    faces?: number;
    adjustedPrice?: number;
  }>>([]);

  // Pricing data
  const [pricingData, setPricingData] = useState<any[]>([]);

  // يتعقّب ما إذا كان المستخدم اختار الفئة السعرية يدوياً (لتجنّب الكتابة فوقها)
  const userPickedCategoryRef = useRef<boolean>(false);

  // Load pricing data
  useEffect(() => {
    (async () => {
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
    })();
  }, []);

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

  // إعادة تفعيل الجلب التلقائي عند تغيير العميل
  useEffect(() => {
    userPickedCategoryRef.current = false;
  }, [formData.customerId, formData.customerName]);

  // Fetch pricing category للعميل (id أولاً ثم الاسم) — لا نكتب فوق اختيار المستخدم
  useEffect(() => {
    const name = (formData.customerName || '').trim();
    if (!formData.customerId && !name) return;
    if (userPickedCategoryRef.current) return;

    (async () => {
      try {
        let pricingCategory = null;

        // 1. Try to fetch directly from customer record
        if (formData.customerId) {
          const { data: custData } = await supabase
            .from('customers')
            .select('pricing_category')
            .eq('id', formData.customerId)
            .maybeSingle();
          if (custData && custData.pricing_category) {
            pricingCategory = custData.pricing_category;
          }
        }

        // 2. Fallback to last contract category
        if (!pricingCategory) {
          let row: any = null;

          if (formData.customerId) {
            const { data } = await supabase
              .from('Contract')
              .select('customer_category, created_at, id')
              .eq('customer_id', formData.customerId)
              .not('customer_category', 'is', null)
              .order('created_at', { ascending: false, nullsFirst: false })
              .order('id', { ascending: false })
              .limit(1)
              .maybeSingle();
            row = data;
          }

          if (!row && name) {
            const safe = name.replace(/[,()"']/g, ' ').trim();
            const { data } = await supabase
              .from('Contract')
              .select('customer_category, created_at, id, customer_name, "Customer Name"')
              .or(`customer_name.ilike.${safe},"Customer Name".ilike.${safe}`)
              .not('customer_category', 'is', null)
              .order('created_at', { ascending: false, nullsFirst: false })
              .order('id', { ascending: false })
              .limit(1)
              .maybeSingle();
            row = data;
          }

          if (row && (row as any).customer_category) {
            pricingCategory = (row as any).customer_category as string;
          }
        }

        if (pricingCategory && !userPickedCategoryRef.current) {
          setFormData(prev => (prev.pricingCategory === pricingCategory ? prev : { ...prev, pricingCategory }));
          toast.info(`تم تطبيق الفئة السعرية للعميل: ${pricingCategory}`);
        }
      } catch (err) {
        console.warn('Failed to fetch customer pricing category:', err);
      }
    })();
  }, [formData.customerId, formData.customerName]);

  // Auto-calculate end date
  useEffect(() => {
    if (!formData.startDate) return;
    const d = new Date(formData.startDate);
    const end = new Date(d);
    if (formData.pricingMode === 'months') {
      if (use30DayMonth) {
        // كل شهر = 30 يوم بالضبط
        const days = Math.max(0, Number(formData.durationMonths || 0)) * 30;
        end.setDate(end.getDate() + days);
      } else {
        // أشهر تقويمية حقيقية
        end.setMonth(end.getMonth() + Math.max(0, Number(formData.durationMonths || 0)));
      }
    } else {
      const days = Math.max(0, Number(formData.durationDays || 0));
      end.setDate(end.getDate() + days);
    }
    const iso = end.toISOString().split('T')[0];
    setFormData(prev => ({ ...prev, endDate: iso }));
  }, [formData.startDate, formData.durationMonths, formData.durationDays, formData.pricingMode, use30DayMonth]);

  // ✅ FIXED: Price calculation functions using size_id
  const getPriceFromDatabase = (sizeId: number | null, level: any, customer: string, months: number): number | null => {
    if (!sizeId) return null;
    
    // ✅ FIXED: Match by size_id instead of size name
    const dbRow = pricingData.find(p => 
      p.size_id === sizeId && 
      p.billboard_level === level && 
      p.customer_category === customer
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

  const getDailyPriceFromDatabase = (sizeId: number | null, level: any, customer: string): number | null => {
    if (!sizeId) return null;
    
    // ✅ FIXED: Match by size_id instead of size name
    const dbRow = pricingData.find(p => 
      p.size_id === sizeId && 
      p.billboard_level === level && 
      p.customer_category === customer
    );
    
    if (dbRow && dbRow.one_day !== null && dbRow.one_day !== undefined) {
      return Number(dbRow.one_day) || 0;
    }
    if (customer !== 'عادي') {
      return getDailyPriceFromDatabase(sizeId, level, 'عادي');
    }
    
    return null;
  };

  // Calculate due date for installments
  const calculateDueDate = (paymentType: string, index: number, startDateOverride?: string): string => {
    const baseDate = startDateOverride || formData.startDate;
    if (!baseDate) return '';
    const d = new Date(baseDate);
    
    if (paymentType === 'عند التوقيع') {
      return baseDate;
    } else if (paymentType === 'شهري') {
      d.setMonth(d.getMonth() + (index + 1));
    } else if (paymentType === 'شهرين') {
      d.setMonth(d.getMonth() + (index + 1) * 2);
    } else if (paymentType === 'ثلاثة أشهر') {
      d.setMonth(d.getMonth() + (index + 1) * 3);
    } else if (paymentType === 'عند التركيب') {
      d.setDate(d.getDate() + 7);
    } else if (paymentType === 'نهاية العقد') {
      return formData.endDate || '';
    } else if (paymentType === 'بعد 20% من العقد') {
      const targetEndDate = formData.endDate;
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
      d.setDate(d.getDate() + 15);
      return d.toISOString().split('T')[0];
    } else if (paymentType && paymentType.startsWith('بعد مرور ') && paymentType.endsWith('% من العقد')) {
      const match = paymentType.match(/بعد مرور\s+(\d+)%\s+من\s+العقد/);
      if (match) {
        const percent = parseInt(match[1], 10);
        const targetEndDate = formData.endDate;
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
    
    return d.toISOString().split('T')[0];
  };

  // Update form data
  const updateFormData = (updates: Partial<ContractFormData>) => {
    if (Object.prototype.hasOwnProperty.call(updates, 'pricingCategory')) {
      userPickedCategoryRef.current = true;
    }
    setFormData(prev => ({ ...prev, ...updates }));
  };

  // Update installment
  const updateInstallment = (index: number, field: string, value: any) => {
    setInstallments(prev => prev.map((inst, i) => {
      if (i === index) {
        const updated = { ...inst, [field]: value };
        if (field === 'paymentType') {
          updated.dueDate = calculateDueDate(value, index);
        }
        return updated;
      }
      return inst;
    }));
  };

  return {
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
    pricingData,
    getPriceFromDatabase,
    getDailyPriceFromDatabase,
    calculateDueDate,
    use30DayMonth,
    setUse30DayMonth
  };
};