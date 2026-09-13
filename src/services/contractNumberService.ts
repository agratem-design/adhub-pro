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

function getContractYear(c: any): number | null {
  const dateStr = c['Contract Date'];
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const y = d.getFullYear();
  return isNaN(y) ? null : y;
}

/**
 * دالة البحث عن الفجوات والأرقام المفقودة في تسلسل العقود
 * تفحص الأرقام بين أول عقد وآخر عقد في السنة المحددة أو عبر جميع السنوات
 * مع ضمان عدم اعتبار أي عقد مسجل في قاعدة البيانات (في أي سنة كانت) كرقم ناقص
 */
export async function findContractGaps(targetYear?: number | 'all'): Promise<ContractGapsResult> {
  const currentYear = new Date().getFullYear();
  const selectedYear = targetYear !== undefined ? targetYear : currentYear;

  try {
    // جلب جميع العقود مع أرقامها وتواريخها واسم العميل
    let query = supabase
      .from('Contract')
      .select('Contract_Number, "Customer Name", "Contract Date", "Ad Type"')
      .not('Contract_Number', 'is', null)
      .limit(50000);

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

    // بناء خريطة شاملة لجميع العقود في قاعدة البيانات عبر كل السنوات
    const allContractsMap = new Map<number, any>();
    const yearsSet = new Set<number>();

    data.forEach((c: any) => {
      const num = parseInt(String(c.Contract_Number), 10);
      if (!isNaN(num) && num > 0) {
        allContractsMap.set(num, c);
      }
      const y = getContractYear(c);
      if (y && y > 2000) yearsSet.add(y);
    });
    yearsSet.add(currentYear);
    const availableYears = Array.from(yearsSet).sort((a, b) => b - a);

    if (allContractsMap.size === 0) {
      return {
        year: selectedYear,
        minNumber: 0,
        maxNumber: 0,
        totalContracts: 0,
        gaps: [],
        availableYears: [currentYear],
      };
    }

    const allNums = Array.from(allContractsMap.keys()).sort((a, b) => a - b);
    const maxDbNum = allNums[allNums.length - 1];

    // تحديد نطاق الأرقام المطلوب فحص الفجوات داخله
    let minNumber = 0;
    let maxNumber = 0;
    let yearContractsCount = 0;

    if (selectedYear === 'all') {
      minNumber = allNums[0];
      maxNumber = maxDbNum;
      yearContractsCount = allNums.length;
    } else {
      const yearNums: number[] = [];
      allContractsMap.forEach((c, num) => {
        if (getContractYear(c) === Number(selectedYear)) {
          yearNums.push(num);
        }
      });

      if (yearNums.length === 0) {
        return {
          year: selectedYear,
          minNumber: 0,
          maxNumber: 0,
          totalContracts: 0,
          gaps: [],
          availableYears,
        };
      }

      yearNums.sort((a, b) => a - b);
      minNumber = yearNums[0];
      maxNumber = yearNums[yearNums.length - 1];
      yearContractsCount = yearNums.length;
    }

    const gaps: ContractGap[] = [];

    // فحص الأرقام المحصورة داخل النطاق
    for (let num = minNumber + 1; num < maxNumber; num++) {
      // الجوهر: إذا كان الرقم موجوداً أصلاً في قاعدة البيانات (في أي سنة كانت)، فهو ليس فجوة إطلاقاً!
      if (allContractsMap.has(num)) {
        continue;
      }

      // العثور على أقرب عقد سابق فعلي من قاعدة البيانات الشاملة
      let prevNum = num - 1;
      while (prevNum >= 1 && !allContractsMap.has(prevNum)) {
        prevNum--;
      }
      const prevC = prevNum >= 1 ? allContractsMap.get(prevNum) : null;

      // العثور على أقرب عقد تالٍ فعلي من قاعدة البيانات الشاملة
      let nextNum = num + 1;
      while (nextNum <= maxDbNum && !allContractsMap.has(nextNum)) {
        nextNum++;
      }
      const nextC = nextNum <= maxDbNum ? allContractsMap.get(nextNum) : null;

      gaps.push({
        number: num,
        year: typeof selectedYear === 'number'
          ? selectedYear
          : (nextC ? (getContractYear(nextC) || currentYear) : currentYear),
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

    return {
      year: selectedYear,
      minNumber,
      maxNumber,
      totalContracts: yearContractsCount,
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
