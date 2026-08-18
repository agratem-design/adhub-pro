import { supabase } from '@/integrations/supabase/client';

export interface ContractGap {
  number: number;
  year: number;
  previousContract?: {
    number: number;
    customerName: string;
    date: string;
  } | null;
  nextContract?: {
    number: number;
    customerName: string;
    date: string;
  } | null;
}

export interface ContractGapsResult {
  year: number | 'all';
  minNumber: number;
  maxNumber: number;
  totalContracts: number;
  gaps: ContractGap[];
  availableYears: number[];
}

/**
 * دالة البحث عن الفجوات والأرقام المفقودة في تسلسل العقود
 * تفحص الأرقام بين أول عقد وآخر عقد في السنة المحددة أو عبر جميع السنوات
 */
export async function findContractGaps(targetYear?: number | 'all'): Promise<ContractGapsResult> {
  const currentYear = new Date().getFullYear();
  const selectedYear = targetYear !== undefined ? targetYear : currentYear;

  try {
    // جلب العقود مع أرقامها وتواريخها واسم العميل
    let query = supabase
      .from('Contract')
      .select('Contract_Number, "Customer Name", "Contract Date", "Ad Type", created_at')
      .not('Contract_Number', 'is', null);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching contracts for gaps:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return {
        year: selectedYear,
        minNumber: 0,
        maxNumber: 0,
        totalContracts: 0,
        gaps: [],
        availableYears: [currentYear],
      };
    }

    // استخراج السنوات المتاحة في قاعدة البيانات
    const yearsSet = new Set<number>();
    data.forEach((c: any) => {
      const dateStr = c['Contract Date'] || c.created_at;
      if (dateStr) {
        const y = new Date(dateStr).getFullYear();
        if (!isNaN(y) && y > 2000) yearsSet.add(y);
      }
    });
    yearsSet.add(currentYear);
    const availableYears = Array.from(yearsSet).sort((a, b) => b - a);

    // تصفية العقود حسب السنة المحددة
    const filteredData = data.filter((c: any) => {
      const num = parseInt(String(c.Contract_Number), 10);
      if (isNaN(num) || num <= 0) return false;

      if (selectedYear === 'all') return true;

      const dateStr = c['Contract Date'] || c.created_at;
      if (!dateStr) return false;
      const y = new Date(dateStr).getFullYear();
      return y === Number(selectedYear);
    });

    if (filteredData.length === 0) {
      return {
        year: selectedYear,
        minNumber: 0,
        maxNumber: 0,
        totalContracts: 0,
        gaps: [],
        availableYears,
      };
    }

    // خريطة سريعة للوصول إلى بيانات العقد عبر رقمه
    const contractsByNumber = new Map<number, any>();
    filteredData.forEach((c: any) => {
      const num = parseInt(String(c.Contract_Number), 10);
      if (!isNaN(num) && num > 0) {
        contractsByNumber.set(num, c);
      }
    });

    const existingNumbers = Array.from(contractsByNumber.keys()).sort((a, b) => a - b);
    const minNumber = existingNumbers[0];
    const maxNumber = existingNumbers[existingNumbers.length - 1];
    const existingSet = new Set(existingNumbers);

    const gaps: ContractGap[] = [];

    for (let num = minNumber + 1; num < maxNumber; num++) {
      if (!existingSet.has(num)) {
        // العثور على أقرب عقد سابق
        let prevNum = num - 1;
        while (prevNum >= minNumber && !contractsByNumber.has(prevNum)) {
          prevNum--;
        }
        const prevC = prevNum >= minNumber ? contractsByNumber.get(prevNum) : null;

        // العثور على أقرب عقد تالٍ
        let nextNum = num + 1;
        while (nextNum <= maxNumber && !contractsByNumber.has(nextNum)) {
          nextNum++;
        }
        const nextC = nextNum <= maxNumber ? contractsByNumber.get(nextNum) : null;

        gaps.push({
          number: num,
          year: typeof selectedYear === 'number' ? selectedYear : (prevC ? new Date(prevC['Contract Date'] || prevC.created_at).getFullYear() : currentYear),
          previousContract: prevC ? {
            number: prevNum,
            customerName: prevC['Customer Name'] || 'عميل غير محدد',
            date: prevC['Contract Date'] || '',
          } : null,
          nextContract: nextC ? {
            number: nextNum,
            customerName: nextC['Customer Name'] || 'عميل غير محدد',
            date: nextC['Contract Date'] || '',
          } : null,
        });
      }
    }

    return {
      year: selectedYear,
      minNumber,
      maxNumber,
      totalContracts: existingNumbers.length,
      gaps,
      availableYears,
    };
  } catch (error) {
    console.error('Failed to calculate contract gaps:', error);
    return {
      year: selectedYear,
      minNumber: 0,
      maxNumber: 0,
      totalContracts: 0,
      gaps: [],
      availableYears: [currentYear],
    };
  }
}

/**
 * التحقق مما إذا كان رقم العقد متاحاً (غير مستخدم)
 */
export async function isContractNumberAvailable(contractNumber: number): Promise<{ available: boolean; contract?: any }> {
  try {
    const { data, error } = await supabase
      .from('Contract')
      .select('Contract_Number, "Customer Name", "Contract Date"')
      .eq('Contract_Number', contractNumber)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.warn('Error checking contract number availability:', error);
    }

    if (data && data.Contract_Number) {
      return { available: false, contract: data };
    }

    return { available: true };
  } catch (e) {
    console.error('Failed to verify contract number:', e);
    return { available: true };
  }
}
