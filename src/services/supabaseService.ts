// @ts-nocheck
import { supabase } from '@/integrations/supabase/client';
import { Billboard, Contract, Pricing } from '@/types';

import { fetchBillboardsWithContracts } from '@/services/billboardContractService';

// جلب جميع اللوحات مع بيانات العقود
export const fetchAllBillboards = async (): Promise<Billboard[]> => {
  console.log('🚀 supabaseService: fetchAllBillboards started');
  try {
    console.log('📞 Calling fetchBillboardsWithContracts...');
    // محاولة جلب اللوحات مع العقود من Supabase أولاً
    const billboardsWithContracts = await fetchBillboardsWithContracts();
    console.log('📦 fetchBillboardsWithContracts returned:', billboardsWithContracts?.length);
    
    if (billboardsWithContracts && billboardsWithContracts.length > 0) {
      console.log('✅ Returning billboards with contracts:', billboardsWithContracts.length);
      return billboardsWithContracts as any;
    }
    console.warn('⚠️ No billboards returned from fetchBillboardsWithContracts');
  } catch (error) {
    console.error('❌ Failed to fetch billboards with contracts:', error);
  }

  // الطريقة القديمة كـ fallback
  try {
    const { data, error } = await supabase
      .from('billboards')
      .select('*');

    if (!error && Array.isArray(data) && data.length > 0) {
      // إزالة التكرار مع الحفاظ على حالة Status من قاعدة البيانات وعدم الكتابة فوقها
      const uniqueBillboards = new Map<number, any>();
      data.forEach((billboard: any) => {
        if (!uniqueBillboards.has(billboard.ID)) {
          const persistedStatus = (billboard as any).Status;
          uniqueBillboards.set(billboard.ID, {
            ...billboard,
            // لا تُعد كتابة الحالة إن كانت موجودة (مثل "إزالة" أو "صيانة").
            // احسبها فقط إذا كانت فارغة.
            Status: (persistedStatus !== undefined && persistedStatus !== null && String(persistedStatus).trim() !== '')
              ? persistedStatus
              : (billboard.Contract_Number ? 'مؤجر' : 'متاح')
          });
        }
      });
      const processedData = Array.from(uniqueBillboards.values());
      console.log('Fetched unique billboards (legacy):', processedData.length);
      return processedData as any;
    }

    console.warn('Supabase billboards unavailable. Details:', (error as any)?.message || 'no data');
  } catch (error) {
    console.warn('Supabase fetchAllBillboards failed:', (error as any)?.message || JSON.stringify(error));
  }

  // No fallback - return empty if Supabase fails
  console.warn('No billboards found, returning empty list');
  return [];
};

// جلب العقود مع دعم جدولين محتملين واستخراج أخطاء أوضح
export const fetchContracts = async (): Promise<Contract[]> => {
  try {
    let data: any[] | null = null; 
    let error: any = null;
    
    // محاولة جلب من جدول Contract أولاً
    try {
      const q1 = await supabase.from('Contract').select('*').order('Contract_Number', { ascending: false });
      data = q1.data as any[] | null; 
      error = q1.error;
      
      if (!error && Array.isArray(data) && data.length > 0) {
        console.log('Fetched contracts (Contract):', data.length);
        const normalized = (data as any[]).map((c: any) => ({
          ...c,
          Contract_Number: c.Contract_Number ?? c.id ?? c.ID,
        })) as Contract[];
        return normalized as any;
      }
    } catch (e) { 
      error = e; 
    }

    console.warn('Contract table not available or empty. Details:', (error as any)?.message || JSON.stringify(error));
    return [];
  } catch (error: any) {
    console.warn('Error in fetchContracts, returning empty list:', error?.message || JSON.stringify(error));
    return [];
  }
};

// جلب أسعار اللوحات
export const fetchPricing = async (): Promise<Pricing[]> => {
  try {
    const { data, error } = await supabase
      .from('pricing')
      .select('*');

    if (error) {
      console.error('Error fetching pricing:', error);
      throw error;
    }

    // تحويل أسماء الأعمدة من قاعدة البيانات إلى الـ type المستخدم في التطبيق
    const mappedData = (data || []).map((item: any) => ({
      id: item.id,
      size: item.size,
      Billboard_Level: item.billboard_level,
      Customer_Category: item.customer_category,
      One_Day: item.one_day,
      One_Month: item.one_month,
      '2_Months': item['2_months'],
      '3_Months': item['3_months'],
      '6_Months': item['6_months'],
      Full_Year: item.full_year,
    }));

    return mappedData;
  } catch (error) {
    console.error('Error in fetchPricing:', error);
    throw error;
  }
};

// إنشاء عقد جديد مع معالجة محسنة
export async function createContract(contractData: any) {
  console.log('Creating contract via supabaseService:', contractData);
  
  let contract: any = null;
  let error: any = null;

  // محاولة الإدراج في جدول Contract أولاً
  try {
    const { data, error: contractError } = await supabase
      .from('Contract')
      .insert({
        'Customer Name': contractData.customer_name,
        'Contract Date': contractData.start_date,
        'End Date': contractData.end_date,
        'Total Rent': contractData.rent_cost || 0,
        'Ad Type': contractData.ad_type || '',
        'Discount': contractData.discount || null,
      })
      .select()
      .single();

    if (!contractError) {
      contract = data;
      console.log('Successfully created contract in Contract table');
    } else {
      error = contractError;
      console.warn('Failed to create in Contract table:', contractError);
    }
  } catch (e) {
    error = e;
    console.warn('Contract table insertion failed:', e);
  }

  // إذا فشل Contract، أعد رمي الخطأ
  if (!contract) {
    console.error('Contract creation failed:', error);
    throw error || new Error('فشل في إنشاء العقد');
  }

  return contract;
}

// تحديث حالة اللوحة
export const updateBillboardStatus = async (
  billboardId: number, 
  updates: Partial<Billboard>
): Promise<Billboard> => {
  try {
    const { data, error } = await supabase
      .from('billboards')
      .update(updates)
      .eq('ID', billboardId)
      .select()
      .single();

    if (error) {
      console.error('Error updating billboard:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in updateBillboardStatus:', error);
    throw error;
  }
};

// جلب الإحصائيات مع استخدام البيانات المحسنة
export const fetchDashboardStats = async () => {
  try {
    const [billboards, contracts] = await Promise.all([
      fetchAllBillboards(),
      fetchContracts()
    ]);

    const availableBillboards = billboards.filter((b: any) => {
      const raw = (b as any).Status ?? (b as any).status ?? '';
      const status = String(raw).trim().toLowerCase();
      // استبعاد الحالات غير المتاحة مثل الإزالة والصيانة والحجز
      if (status === 'إزالة' || status === 'maintenance' || status === 'صيانة' || status === 'محجوز') return false;
      return status === 'متاح' || status === 'available';
    });

    const rentedBillboards = billboards.filter(b =>
      b.Status === 'مؤجر' || b.Status === 'rented' || b.Contract_Number
    );

    const nearExpiry = rentedBillboards.filter(billboard => {
      if (!billboard.Rent_End_Date) return false;
      try {
        const endDate = new Date(billboard.Rent_End_Date);
        const today = new Date();
        const diffTime = endDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 20 && diffDays > 0;
      } catch {
        return false;
      }
    });

    const totalRevenue = contracts.reduce((sum, contract) => {
      const total = parseFloat(contract['Total Rent']?.toString() || '0');
      return sum + (isNaN(total) ? 0 : total);
    }, 0);

    return {
      totalBillboards: billboards.length,
      availableBillboards: availableBillboards.length,
      rentedBillboards: rentedBillboards.length,
      nearExpiryBillboards: nearExpiry.length,
      totalContracts: contracts.length,
      totalRevenue,
      availableBillboardsList: availableBillboards,
      nearExpiryBillboardsList: nearExpiry
    };
  } catch (error: any) {
    console.warn('Error fetching dashboard stats, returning defaults:', error?.message || JSON.stringify(error));
    return {
      totalBillboards: 0,
      availableBillboards: 0,
      rentedBillboards: 0,
      nearExpiryBillboards: 0,
      totalContracts: 0,
      totalRevenue: 0,
      availableBillboardsList: [],
      nearExpiryBillboardsList: []
    };
  }
};