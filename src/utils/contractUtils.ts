/**
 * Contract utility functions for handling expired contracts and billboard status
 */

import { 
  resolveBillboardAvailability, 
  isDateExpired as serviceIsDateExpired,
  checkMaintenanceOrRemoval,
  normalizeDateOnly
} from '@/services/billboardAvailabilityService';

export const isContractExpired = (endDate: string | null): boolean => {
  if (!endDate) return false;
  return serviceIsDateExpired(endDate);
};

export const isContractActive = (startDate: string | null, endDate: string | null): boolean => {
  if (!startDate || !endDate) return false;
  
  try {
    const todayStr = normalizeDateOnly(new Date())!;
    const startStr = normalizeDateOnly(startDate);
    const endStr = normalizeDateOnly(endDate);
    if (!startStr || !endStr) return false;
    return todayStr >= startStr && todayStr <= endStr;
  } catch (error) {
    console.error('Error checking contract active status:', error);
    return false;
  }
};

export const getDaysUntilExpiry = (endDate: string | null): number | null => {
  if (!endDate) return null;
  
  try {
    const contractEndDate = new Date(endDate);
    const today = new Date();
    
    contractEndDate.setHours(23, 59, 59, 999);
    today.setHours(0, 0, 0, 0);
    
    const diffTime = contractEndDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  } catch (error) {
    console.error('Error calculating days until expiry:', error);
    return null;
  }
};

export const shouldShowContractInfo = (billboard: any): boolean => {
  const contractNumber = billboard.Contract_Number || billboard.contractNumber;
  const endDate = billboard.Rent_End_Date || billboard.rent_end_date || billboard.contract?.end_date;
  
  if (!contractNumber) return false;
  if (!endDate) return true;
  return !isContractExpired(endDate);
};

export const isBillboardBlockedFromAvailability = (billboard: any): boolean => {
  const check = checkMaintenanceOrRemoval(billboard);
  return check.isRemoved || check.isMaintenance;
};

export const isBillboardAvailable = (billboard: any, ignoreVisibility = false): boolean => {
  const resolution = resolveBillboardAvailability(billboard, (billboard as any)?.contracts || [], {
    ignoreMarketingVisibility: ignoreVisibility,
  });

  if (isBillboardBlockedFromAvailability(billboard)) {
    return false;
  }

  if (!ignoreVisibility) {
    if (resolution.marketingVisibility === 'FORCE_HIDE') return false;
  }

  return resolution.isAvailableNow;
};

export const generateMunicipalityCode = (name: string): string => {
  const cleanName = name.trim().toLowerCase();
  
  const charMap: { [key: string]: string } = {
    'أ': 'a', 'ا': 'a', 'إ': 'a', 'آ': 'a',
    'ب': 'b',
    'ت': 't',
    'ث': 'th',
    'ج': 'j',
    'ح': 'h',
    'خ': 'kh',
    'د': 'd',
    'ذ': 'dh',
    'ر': 'r',
    'ز': 'z',
    'س': 's',
    'ش': 'sh',
    'ص': 's',
    'ض': 'd',
    'ط': 't',
    'ظ': 'z',
    'ع': 'a',
    'غ': 'gh',
    'ف': 'f',
    'ق': 'q',
    'ك': 'k',
    'ل': 'l',
    'م': 'm',
    'ن': 'n',
    'ه': 'h',
    'و': 'w',
    'ي': 'y', 'ى': 'y', 'ئ': 'y', 'ء': 'a'
  };

  const words = cleanName.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    let code = '';
    for (let i = 0; i < Math.min(words.length, 3); i++) {
      const w = words[i];
      let cleanWord = w;
      if (cleanWord.startsWith('ال') && cleanWord.length > 2) {
        cleanWord = cleanWord.slice(2);
      }
      const firstChar = cleanWord[0];
      if (charMap[firstChar]) {
        code += charMap[firstChar];
      } else if (/[a-z]/i.test(firstChar)) {
        code += firstChar;
      }
    }
    if (code.length >= 2) {
      return code.slice(0, 3).toUpperCase();
    }
  }

  let cleanNameSingle = cleanName;
  if (cleanNameSingle.startsWith('ال') && cleanNameSingle.length > 2) {
    cleanNameSingle = cleanNameSingle.slice(2);
  }

  let code = '';
  for (let i = 0; i < cleanNameSingle.length; i++) {
    const char = cleanNameSingle[i];
    if (charMap[char]) {
      code += charMap[char];
    } else if (/[a-z]/i.test(char)) {
      code += char;
    }
    if (code.length >= 3) break;
  }

  if (code.length >= 2) {
    return code.slice(0, 3).toUpperCase();
  }

  return 'MU';
};

// ─────────────────────────────────────────────────────────────────────────────
// Billboard Conflict Detection
// ─────────────────────────────────────────────────────────────────────────────

export interface BillboardConflict {
  billboardId: string;
  billboardName: string;
  activeContractNumber: string;
  activeContractCustomer: string;
  activeContractEndDate: string;
  daysRemaining: number;
  startDate?: string;
  adType?: string;
}

/**
 * يتحقق من وجود تعارض بين اللوحات المختارة والعقود النشطة الموجودة.
 * يُعيد قائمة بالتعارضات المكتشفة.
 *
 * @param billboardIds - معرّفات اللوحات المراد التحقق منها
 * @param newStartDate - تاريخ بداية العقد الجديد (YYYY-MM-DD)
 * @param newEndDate   - تاريخ نهاية العقد الجديد (YYYY-MM-DD)
 * @param excludeContractNumber - رقم العقد الحالي لتجاهله (عند التعديل)
 * @param billboardNamesMap - خريطة اختيارية لأسماء اللوحات {id -> name}
 */
export const checkBillboardConflicts = async (
  billboardIds: string[],
  newStartDate: string,
  newEndDate: string,
  excludeContractNumber?: string,
  billboardNamesMap?: Record<string, string>
): Promise<BillboardConflict[]> => {
  if (!billboardIds.length || !newStartDate || !newEndDate) return [];

  try {
    // تحميل supabase ديناميكياً لتجنب الاستيراد الدائري
    const { supabase } = await import('@/integrations/supabase/client');

    const today = new Date().toISOString().split('T')[0];

    // جلب جميع العقود النشطة (لم تنته بعد)
    let query = supabase
      .from('Contract')
      .select('Contract_Number, "Customer Name", "End Date", "Contract Date", "Ad Type", billboard_ids')
      .gte('"End Date"', today);

    const { data: activeContracts, error } = await query;

    if (error) {
      console.error('checkBillboardConflicts error:', error);
      return [];
    }

    if (!activeContracts || activeContracts.length === 0) return [];

    const conflicts: BillboardConflict[] = [];
    const today_ts = new Date().getTime();

    for (const contract of activeContracts) {
      // تجاهل العقد الحالي عند التعديل
      if (
        excludeContractNumber &&
        String(contract.Contract_Number) === String(excludeContractNumber)
      ) {
        continue;
      }

      const contractEndDate = contract['End Date'];
      if (!contractEndDate) continue;

      // التحقق من التداخل الزمني بين العقدين
      // التداخل يحدث إذا: بداية_الجديد <= نهاية_القائم && نهاية_الجديد >= بداية_القائم
      const existingStart = contract['Contract Date']
        ? new Date(contract['Contract Date']).getTime()
        : 0;
      const existingEnd = new Date(contractEndDate).getTime();
      const newStart = new Date(newStartDate).getTime();
      const newEnd = new Date(newEndDate).getTime();

      const hasOverlap = newStart <= existingEnd && newEnd >= existingStart;
      if (!hasOverlap) continue;

      // استخرج معرّفات اللوحات في هذا العقد
      const rawIds = contract.billboard_ids;
      if (!rawIds) continue;

      let contractBillboardIds: string[] = [];
      if (typeof rawIds === 'string') {
        contractBillboardIds = rawIds
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);
      } else if (Array.isArray(rawIds)) {
        contractBillboardIds = (rawIds as any[]).map((x) => String(x).trim());
      }

      // ابحث عن تقاطع بين اللوحات المطلوبة واللوحات في العقد القائم
      for (const reqId of billboardIds) {
        if (contractBillboardIds.includes(String(reqId))) {
          const daysRemaining = Math.ceil(
            (existingEnd - today_ts) / (1000 * 60 * 60 * 24)
          );
          conflicts.push({
            billboardId: reqId,
            billboardName:
              billboardNamesMap?.[reqId] || `لوحة #${reqId}`,
            activeContractNumber: String(contract.Contract_Number),
            activeContractCustomer: contract['Customer Name'] || '',
            activeContractEndDate: contractEndDate,
            daysRemaining: Math.max(0, daysRemaining),
            startDate: contract['Contract Date'] || undefined,
            adType: contract['Ad Type'] || (contract as any).ad_type || (contract as any).Ad_Type || undefined,
          });
        }
      }
    }

    return conflicts;
  } catch (err) {
    console.error('checkBillboardConflicts unexpected error:', err);
    return [];
  }
};

