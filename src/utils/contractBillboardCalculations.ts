/**
 * contractBillboardCalculations.ts
 * المحرك المالي الموحد لحسابات الفترات والقيم المتبقية وفروق الاستبدال
 */

import {
  BillboardRemainingValueParams,
  BillboardRemainingValueResult,
} from '@/types/contractBillboardStatus';

/**
 * حساب عدد الأيام الفعلي بين تاريخين بدقة (شاملاً اليوم الأول)
 */
export function calculateDaysBetween(startDateStr?: string | null, endDateStr?: string | null): number {
  if (!startDateStr || !endDateStr) return 0;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  
  // ضبط التوقيت لمنتصف الليل لتفادي فروق التوقيت الصيفي
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  
  const diffMs = endUtc - startUtc;
  if (diffMs < 0) return 0;
  // +1 لتضمين يوم البداية والنهاية
  return Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
}

/**
 * حساب القيمة المستهلكة والمتبقية للوحة داخل العقد
 * القاعدة: يوم الاستبدال/الإيقاف هو أول يوم في الفترة الجديدة للوحة البديلة أو الإيقاف
 */
export function calculateRemainingBillboardValue(
  params: BillboardRemainingValueParams
): BillboardRemainingValueResult {
  const {
    startDate,
    endDate,
    effectiveDate,
    contractedPrice = 0,
    printCost = 0,
    installCost = 0,
    includePrint = false,
    includeInstall = false,
  } = params;

  const totalDays = calculateDaysBetween(startDate, endDate) || 30;
  
  // الأيام المنقضية: من تاريخ البداية حتى اليوم السابق لتاريخ السريان
  let elapsedDays = 0;
  if (effectiveDate && startDate) {
    const start = new Date(startDate);
    const eff = new Date(effectiveDate);
    if (!isNaN(start.getTime()) && !isNaN(eff.getTime())) {
      const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
      const effUtc = Date.UTC(eff.getFullYear(), eff.getMonth(), eff.getDate());
      const diffMs = effUtc - startUtc;
      const rawDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      elapsedDays = Math.max(0, Math.min(totalDays, rawDays));
    }
  }

  const remainingDays = Math.max(0, totalDays - elapsedDays);

  // التكاليف غير المسترجعة (الطباعة والتركيب خدمات فعلية تم تنفيذها مسبقاً)
  const nonRefundableCosts = (includePrint ? 0 : printCost) + (includeInstall ? 0 : installCost);
  const rentalBase = Math.max(0, contractedPrice - printCost - installCost);

  const dailyRate = totalDays > 0 ? rentalBase / totalDays : 0;
  
  // حساب المتبقي والمستهلك من الإيجار الصافي
  const remainingValue = Math.min(rentalBase, Math.round(dailyRate * remainingDays));
  const consumedValue = Math.max(0, rentalBase - remainingValue) + nonRefundableCosts;

  return {
    totalDays,
    elapsedDays,
    remainingDays,
    consumedValue,
    remainingValue,
    dailyRate,
    nonRefundableCosts,
  };
}

/**
 * حساب الفرق المالي لعملية استبدال لوحة
 * Replacement ≠ Pause
 * 
 * - إذا كان الفرق = 0: استبدال متكافئ 100% (لا أثر مالي على العقد)
 * - إذا كان الفرق > 0: البديلة أغلى (تضاف الزيادة للعقد)
 * - إذا كان الفرق < 0: البديلة أرخص (يُخصم الفارق من العقد)
 */
export interface SwapFinancialDifferenceParams {
  originalRemainingValue: number;
  replacementMonthlyPrice: number;
  remainingDays: number;
}

export interface SwapFinancialDifferenceResult {
  originalRemainingValue: number;
  replacementValueForPeriod: number;
  difference: number;
  isEquivalent: boolean;
  statusText: string;
}

export function calculateSwapFinancialDifference(
  params: SwapFinancialDifferenceParams
): SwapFinancialDifferenceResult {
  const { originalRemainingValue, replacementMonthlyPrice, remainingDays } = params;
  
  // حساب قيمة اللوحة البديلة لنفس عدد الأيام المتبقية
  const dailyRate = (replacementMonthlyPrice || 0) / 30;
  const replacementValueForPeriod = Math.round(dailyRate * remainingDays);
  
  const difference = replacementValueForPeriod - originalRemainingValue;
  const isEquivalent = Math.abs(difference) < 1; // تطابق ضمن حدود التقريب
  
  let statusText = 'استبدال متكافئ بدون تغيير مالي';
  if (difference > 0) {
    statusText = `زيادة على العقد (+${difference.toLocaleString('ar-LY')} د.ل)`;
  } else if (difference < 0) {
    statusText = `خصم من العقد (${difference.toLocaleString('ar-LY')} د.ل)`;
  }

  return {
    originalRemainingValue,
    replacementValueForPeriod,
    difference: isEquivalent ? 0 : difference,
    isEquivalent,
    statusText,
  };
}

/**
 * تقييم وتصنيف اللوحات البديلة المقترحة (Scoring & Ranking)
 * يعطي درجات بناءً على: نفس المقاس، نفس المدينة، نفس الشارع/المنطقة
 */
export interface BillboardCandidateScoreParams {
  originalBillboard: {
    Size?: string | null;
    City?: string | null;
    District?: string | null;
    Nearest_Landmark?: string | null;
    Level?: string | null;
  };
  candidate: {
    Size?: string | null;
    City?: string | null;
    District?: string | null;
    Nearest_Landmark?: string | null;
    Level?: string | null;
  };
}

export function scoreBillboardCandidate(params: BillboardCandidateScoreParams): {
  score: number;
  matchTier: 'perfect' | 'excellent' | 'good' | 'compatible';
  matchLabel: string;
} {
  const { originalBillboard, candidate } = params;
  let score = 0;

  const sameSize = !!originalBillboard.Size && (originalBillboard.Size || '').trim().toLowerCase() === (candidate.Size || '').trim().toLowerCase();
  const sameCity = !!originalBillboard.City && (originalBillboard.City || '').trim().toLowerCase() === (candidate.City || '').trim().toLowerCase();
  const sameDistrict = !!originalBillboard.District && !!candidate.District && (originalBillboard.District || '').trim().toLowerCase() === (candidate.District || '').trim().toLowerCase();
  const sameLandmark = !!originalBillboard.Nearest_Landmark && !!candidate.Nearest_Landmark && (originalBillboard.Nearest_Landmark || '').trim().toLowerCase() === (candidate.Nearest_Landmark || '').trim().toLowerCase();
  const sameLevel = !!originalBillboard.Level && !!candidate.Level && (originalBillboard.Level || '').trim().toLowerCase() === (candidate.Level || '').trim().toLowerCase();

  if (sameSize) score += 40;
  if (sameCity) score += 30;
  if (sameDistrict) score += 15;
  if (sameLandmark) score += 10;
  if (sameLevel) score += 5;

  if (score >= 90) {
    return { score, matchTier: 'perfect', matchLabel: 'تطابق مثالي' };
  } else if (score >= 70) {
    return { score, matchTier: 'excellent', matchLabel: 'تطابق ممتاز' };
  } else if (score >= 50) {
    return { score, matchTier: 'good', matchLabel: 'بديل مناسب' };
  }
  return { score, matchTier: 'compatible', matchLabel: 'بديل متاح' };
}
