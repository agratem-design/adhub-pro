import { supabase } from '@/integrations/supabase/client';

export type CustomerType = 'عادي' | 'المدينة' | 'مسوق' | 'شركات' | 'البهلول' | 'جوتن';
export type LevelType = 'A' | 'B' | 'S' | string;

interface PricingRecord {
  id: number;
  size: string;
  billboard_level: string;
  customer_category: string;
  one_month: number;
  '2_months': number;
  '3_months': number;
  '6_months': number;
  full_year: number;
  one_day: number;
}

// جلب جميع الأسعار من قاعدة البيانات
export async function getAllPricing(): Promise<PricingRecord[]> {
  try {
    const { data, error } = await supabase
      .from('pricing')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('Error fetching pricing data:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Failed to fetch pricing data:', error);
    return [];
  }
}

// تطبيع المقاس
function canonSize(size: string): string {
  if (!size) return '4x12';
  let s = String(size).toLowerCase().replace(/[×xX]/g, 'x').replace(/[^\dx]/g, '');
  const parts = s.split('x').map(Number).filter(n => !isNaN(n));
  if (parts.length === 2) {
    parts.sort((a,b)=>a-b);
    return parts.join('x');
  }
  return s;
}

// تطبيع الرقم
function normalizeNumber(v: any): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  const n = Number(String(v).replace(/[^\d.-]/g, ''));
  return isNaN(n) ? null : n;
}

// الحصول على مفتاح الشهر
function getMonthKey(months: number): keyof PricingRecord {
  switch (months) {
    case 1: return 'one_month';
    case 2: return '2_months';
    case 3: return '3_months';
    case 6: return '6_months';
    case 12: return 'full_year';
    default: return 'one_month';
  }
}

// الحصول على السعر لمقاس ومستوى وفئة عميل ومدة معينة
export async function getPriceFor(
  size: string, 
  level: LevelType | undefined, 
  customer: CustomerType, 
  months: number
): Promise<number | null> {
  try {
    const pricingData = await getAllPricing();
    const key = getMonthKey(months);
    const cs = canonSize(size);
    const lvl = level || 'A';

    // البحث الدقيق: مقاس + مستوى + فئة عميل
    let row = pricingData.find(r => 
      canonSize(r.size) === cs && 
      r.billboard_level === lvl && 
      r.customer_category === customer
    );

    // البحث البديل 1: تجاهل المستوى
    if (!row) {
      row = pricingData.find(r => 
        canonSize(r.size) === cs && 
        r.customer_category === customer
      );
    }

    // البحث البديل 2: أي صف بنفس المقاس
    if (!row) {
      row = pricingData.find(r => canonSize(r.size) === cs);
    }

    if (!row) {
      console.warn(`No pricing found for size: ${size}, level: ${level}, customer: ${customer}, months: ${months}`);
      return null;
    }

    const price = normalizeNumber((row as any)[key]);
    console.log(`Found price: ${price} for ${size} ${level} ${customer} ${months}months`);
    return price;
  } catch (error) {
    console.error('Error getting price:', error);
    return null;
  }
}

// الحصول على السعر اليومي
export async function getDailyPriceFor(
  size: string, 
  level: LevelType | undefined, 
  customer: CustomerType
): Promise<number | null> {
  try {
    const pricingData = await getAllPricing();
    const cs = canonSize(size);
    const lvl = level || 'A';

    // البحث الدقيق
    let row = pricingData.find(r => 
      canonSize(r.size) === cs && 
      r.billboard_level === lvl && 
      r.customer_category === customer
    );

    // البحث البديل 1: تجاهل المستوى
    if (!row) {
      row = pricingData.find(r => 
        canonSize(r.size) === cs && 
        r.customer_category === customer
      );
    }

    // البحث البديل 2: أي صف بنفس المقاس
    if (!row) {
      row = pricingData.find(r => canonSize(r.size) === cs);
    }

    if (!row) {
      console.warn(`No daily pricing found for size: ${size}, level: ${level}, customer: ${customer}`);
      return null;
    }

    return normalizeNumber(row.one_day);
  } catch (error) {
    console.error('Error getting daily price:', error);
    return null;
  }
}

// الحصول على جميع فئات العملاء من قاعدة البيانات
export async function getCustomerCategories(): Promise<CustomerType[]> {
  try {
    const pricingData = await getAllPricing();
    const categories = Array.from(new Set(pricingData.map(p => p.customer_category))) as CustomerType[];
    return categories;
  } catch (error) {
    console.error('Error getting customer categories:', error);
    return ['عادي', 'المدينة', 'مسوق', 'شركات'];
  }
}

// الحصول على جميع المقاسات المتاحة
export async function getAvailableSizes(): Promise<string[]> {
  try {
    const pricingData = await getAllPricing();
    const sizes = Array.from(new Set(pricingData.map(p => p.size)));
    return sizes;
  } catch (error) {
    console.error('Error getting available sizes:', error);
    return [];
  }
}

// الحصول على جميع المستويات المتاحة
export async function getAvailableLevels(): Promise<string[]> {
  try {
    const pricingData = await getAllPricing();
    const levels = Array.from(new Set(pricingData.map(p => p.billboard_level)));
    return levels;
  } catch (error) {
    console.error('Error getting available levels:', error);
    return ['A', 'B'];
  }
}