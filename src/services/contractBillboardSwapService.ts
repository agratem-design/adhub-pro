/**
 * contractBillboardSwapService.ts
 * الخدمة المركزية الموحدة لعمليات التبديل الفوري والإيقاف الذري للوحات
 */

import { supabase } from '@/integrations/supabase/client';
import {
  calculateRemainingBillboardValue,
  calculateSwapFinancialDifference,
  calculateDaysBetween,
} from '@/utils/contractBillboardCalculations';
import { ContractFinancialAdjustment } from '@/types/contractBillboardStatus';

export interface SwapBillboardParams {
  contractNumber: number;
  originalBillboardId: number;
  replacementBillboardId: number;
  effectiveDate: string;
  operationId?: string;
  customerName?: string;
  adType?: string;
  notes?: string;
  userId?: string;
}

export interface SwapBillboardResult {
  success: boolean;
  error?: string;
  originalBillboardId: number;
  replacementBillboardId: number;
  effectiveDate: string;
  difference: number;
  isEquivalent: boolean;
  originalRemainingValue: number;
  replacementValue: number;
  newBillboardIds: string[];
  adjustment?: ContractFinancialAdjustment;
}

// ذاكرة مؤقتة لمنع تكرار الطلبات (Idempotency Cache)
const processedOperations = new Map<string, { result: SwapBillboardResult; timestamp: number }>();

/**
 * التحقق من توفر اللوحة البديلة للفترة المحددة
 */
export async function checkBillboardAvailabilityForPeriod(
  billboardId: number,
  startDate: string,
  endDate: string,
  excludeContractNumber?: number
): Promise<{ isAvailable: boolean; conflictReason?: string }> {
  try {
    // 1. فحص حالة اللوحة الحالية
    const { data: bb, error: bbErr } = await supabase
      .from('billboards')
      .select('ID, Billboard_Name, Status, Contract_Number, Rent_Start_Date, Rent_End_Date')
      .eq('ID', billboardId)
      .single();

    if (bbErr || !bb) {
      return { isAvailable: false, conflictReason: 'اللوحة غير موجودة' };
    }

    // إذا كانت محجوزة لنفس العقد
    if (bb.Contract_Number && Number(bb.Contract_Number) === Number(excludeContractNumber)) {
      return { isAvailable: true };
    }

    // 2. فحص العقود النشطة المتداخلة مع هذه الفترة
    const { data: activeContracts, error: cErr } = await supabase
      .from('Contract')
      .select('Contract_Number, "Customer Name", "Contract Date", "End Date", billboard_ids')
      .neq('Contract_Number', excludeContractNumber || 0)
      .or(`"End Date".gte.${startDate},"Contract Date".lte.${endDate}`);

    if (cErr) {
      console.warn('Error checking active contracts:', cErr);
    } else if (activeContracts) {
      for (const contract of activeContracts) {
        const ids = (contract.billboard_ids || '').split(',').map((s: string) => s.trim());
        if (ids.includes(String(billboardId))) {
          const cStart = contract['Contract Date'];
          const cEnd = contract['End Date'];
          // التحقق من التداخل الزمني
          if (cStart && cEnd && !(cEnd < startDate || cStart > endDate)) {
            return {
              isAvailable: false,
              conflictReason: `اللوحة محجوزة حالياً في العقد #${contract.Contract_Number} (${contract['Customer Name'] || 'عميل'}) من ${cStart} إلى ${cEnd}`,
            };
          }
        }
      }
    }

    return { isAvailable: true };
  } catch (err: any) {
    console.error('Availability check exception:', err);
    return { isAvailable: false, conflictReason: err.message || 'خطأ أثناء فحص توفر اللوحة' };
  }
}

/**
 * تنفيذ عملية التبديل الفوري الذرية (Atomic Swap Operation)
 * Replacement ≠ Pause
 */
export async function executeBillboardSwap(params: SwapBillboardParams): Promise<SwapBillboardResult> {
  const {
    contractNumber,
    originalBillboardId,
    replacementBillboardId,
    effectiveDate,
    operationId = crypto.randomUUID(),
    customerName,
    adType,
    notes,
    userId,
  } = params;

  // 1. حماية Idempotency من النقر المزدوج
  if (operationId && processedOperations.has(operationId)) {
    const cached = processedOperations.get(operationId)!;
    if (Date.now() - cached.timestamp < 30000) {
      return cached.result;
    }
  }

  try {
    // 2. جلب بيانات العقد الحالية
    const { data: contract, error: contractErr } = await supabase
      .from('Contract')
      .select('*')
      .eq('Contract_Number', contractNumber)
      .single();

    if (contractErr || !contract) {
      throw new Error(`العقد #${contractNumber} غير موجود`);
    }

    const contractStartDate = contract['Contract Date'] || contract.start_date || effectiveDate;
    const contractEndDate = contract['End Date'] || contract.end_date || effectiveDate;

    // 3. التحقق من وجود اللوحة الأصلية في العقد
    const currentIdsStr = contract.billboard_ids || '';
    const currentIds = currentIdsStr.split(',').map((s: string) => s.trim()).filter(Boolean);
    
    if (!currentIds.includes(String(originalBillboardId))) {
      throw new Error(`اللوحة الأصلية #${originalBillboardId} غير مدرجة حالياً في العقد`);
    }

    // 4. التحقق من توفر اللوحة البديلة طوال الفترة المتبقية
    const availability = await checkBillboardAvailabilityForPeriod(
      replacementBillboardId,
      effectiveDate,
      contractEndDate,
      contractNumber
    );

    if (!availability.isAvailable) {
      throw new Error(availability.conflictReason || 'اللوحة البديلة غير متاحة للفترة المطلوبة');
    }

    // 5. جلب بيانات اللوحتين
    const [origBbRes, replBbRes] = await Promise.all([
      supabase.from('billboards').select('*').eq('ID', originalBillboardId).single(),
      supabase.from('billboards').select('*').eq('ID', replacementBillboardId).single(),
    ]);

    if (origBbRes.error || !origBbRes.data) throw new Error('بيانات اللوحة الأصلية غير متوفرة');
    if (replBbRes.error || !replBbRes.data) throw new Error('بيانات اللوحة البديلة غير متوفرة');

    const originalBillboard = origBbRes.data;
    const replacementBillboard = replBbRes.data;

    // 6. استخراج سعر اللوحة الأصلية المتفق عليه (Snapshot from Contract)
    let contractedPrice = Number(originalBillboard.Price) || 0;
    let pricesArray: any[] = [];
    try {
      const rawPrices = contract.billboard_prices;
      if (rawPrices) {
        pricesArray = typeof rawPrices === 'string' ? JSON.parse(rawPrices) : rawPrices;
        if (Array.isArray(pricesArray)) {
          const snapshot = pricesArray.find(
            (p: any) => String(p.billboardId ?? p.billboard_id ?? p.ID ?? p.id) === String(originalBillboardId)
          );
          if (snapshot) {
            contractedPrice = Number(snapshot.contractPrice ?? snapshot.finalPrice ?? snapshot.priceAfterDiscount ?? contractedPrice);
          }
        }
      }
    } catch {}

    // 7. حساب القيمة المتبقية للأصلية وقيمة البديلة للفترة المتبقية
    const origRemaining = calculateRemainingBillboardValue({
      startDate: contractStartDate,
      endDate: contractEndDate,
      effectiveDate,
      contractedPrice,
    });

    const swapDiff = calculateSwapFinancialDifference({
      originalRemainingValue: origRemaining.remainingValue,
      replacementMonthlyPrice: Number(replacementBillboard.Price) || 0,
      remainingDays: origRemaining.remainingDays,
    });

    // 8. تحديث قائمة اللوحات والأسعار بالعقد
    const updatedIds = currentIds
      .filter((id: string) => String(id) !== String(originalBillboardId))
      .concat(String(replacementBillboardId));

    // تحديث مصفوفة الأسعار Snapshot
    const updatedPricesArray = pricesArray.filter(
      (p: any) => String(p.billboardId ?? p.billboard_id ?? p.ID ?? p.id) !== String(originalBillboardId)
    );

    const replacementPriceEntry = {
      billboardId: String(replacementBillboardId),
      basePriceBeforeDiscount: swapDiff.replacementValueForPeriod,
      priceBeforeDiscount: swapDiff.replacementValueForPeriod,
      discountPerBillboard: 0,
      priceAfterDiscount: swapDiff.replacementValueForPeriod,
      contractPrice: swapDiff.replacementValueForPeriod,
      finalPrice: swapDiff.replacementValueForPeriod,
      printCost: 0,
      installationCost: 0,
      totalBillboardPrice: swapDiff.replacementValueForPeriod,
      status: 'active',
      _replacement_of: String(originalBillboardId),
    };
    updatedPricesArray.push(replacementPriceEntry);

    // 9. تنفيذ التحديثات في قاعدة البيانات
    // أ. تسجيل اللوحة الموقوفة كـ replaced
    const { data: pausedRow, error: pausedInsertErr } = await supabase
      .from('paused_billboards')
      .insert({
        contract_number: contractNumber,
        billboard_id: originalBillboardId,
        billboard_name: originalBillboard.Billboard_Name || `لوحة #${originalBillboardId}`,
        pause_date: effectiveDate,
        original_price: contractedPrice,
        consumed_amount: origRemaining.consumedValue,
        refund_amount: 0, // لا مسترجع لأنها استُبدلت بالكامل
        deducted_from_contract: false,
        net_rent: contractedPrice,
        full_price: contractedPrice,
        original_start_date: contractStartDate,
        original_end_date: contractEndDate,
        notes: `تم الاستبدال باللوحة #${replacementBillboardId} (${replacementBillboard.Billboard_Name || ''}) ابتداءً من ${effectiveDate}${notes ? ' - ' + notes : ''}`,
      } as any)
      .select()
      .single();

    if (pausedInsertErr) throw pausedInsertErr;

    // ب. تسجيل علاقة الاستبدال
    if (pausedRow) {
      await supabase.from('paused_billboard_replacements').insert({
        paused_billboard_id: (pausedRow as any).id,
        contract_number: contractNumber,
        replacement_billboard_id: replacementBillboardId,
        replacement_billboard_name: replacementBillboard.Billboard_Name || null,
        start_date: effectiveDate,
        end_date: contractEndDate,
        allocated_amount: swapDiff.replacementValueForPeriod,
        notes: notes || `استبدال مباشر من #${originalBillboardId}`,
      } as any);
    }

    // ج. تنفيذ الاستبدال عبر PostgreSQL Atomic RPC (Server-side single transaction with Mandatory Version Check)
    const effectiveCustomerName = customerName || contract['Customer Name'] || null;
    const effectiveAdType = adType || contract['Ad Type'] || null;
    const expectedContractVersion = Number(contract.version || 1);

    try {
      const { data: swapRpcRes, error: swapRpcErr } = await supabase.rpc('execute_billboard_swap_atomic', {
        p_contract_number: Number(contractNumber),
        p_original_billboard_id: Number(originalBillboardId),
        p_replacement_billboard_id: Number(replacementBillboardId),
        p_expected_version: expectedContractVersion,
        p_updated_billboard_ids: updatedIds.join(','),
        p_updated_prices_json: JSON.stringify(updatedPricesArray),
        p_effective_date: effectiveDate || null,
        p_contract_end_date: contractEndDate || null,
        p_customer_name: effectiveCustomerName,
        p_ad_type: effectiveAdType,
      });

      if (swapRpcErr) {
        if (swapRpcErr.message?.includes('CONTRACT_VERSION_CONFLICT')) {
          throw new Error('تم تعديل هذا العقد بواسطة مستخدم آخر. يرجى إعادة تحميل الصفحة والمحاولة مرة أخرى.');
        }
        console.warn('RPC execute_billboard_swap_atomic failed, falling back to direct updates:', swapRpcErr);

        // Fallback: Client-side updates with false preservation
        const { data: swapBbs } = await supabase
          .from('billboards')
          .select('ID, is_visible_in_available')
          .in('ID', [originalBillboardId, replacementBillboardId]);

        const origFlag = swapBbs?.find(b => b.ID === originalBillboardId)?.is_visible_in_available;
        const replFlag = swapBbs?.find(b => b.ID === replacementBillboardId)?.is_visible_in_available;

        const origPreserved = origFlag === false ? false : null;
        const replPreserved = replFlag === false ? false : null;

        const [origRes, replRes] = await Promise.all([
          supabase.from('billboards').update({
            Contract_Number: null,
            Customer_Name: null,
            Ad_Type: null,
            Rent_Start_Date: null,
            Rent_End_Date: null,
            Status: 'متاح',
            is_visible_in_available: origPreserved,
          } as any).eq('ID', originalBillboardId),

          supabase.from('billboards').update({
            Contract_Number: contractNumber,
            Customer_Name: effectiveCustomerName,
            Ad_Type: effectiveAdType,
            Rent_Start_Date: effectiveDate,
            Rent_End_Date: contractEndDate,
            Status: 'محجوز',
            is_visible_in_available: replPreserved,
          } as any).eq('ID', replacementBillboardId),
        ]);

        if (origRes.error) throw new Error('فشل في تحرير اللوحة المستبدلة: ' + origRes.error.message);
        if (replRes.error) throw new Error('فشل في حجز اللوحة البديلة: ' + replRes.error.message);

        const { error: contractUpdateErr } = await supabase.from('Contract').update({
          billboard_ids: updatedIds.join(','),
          billboard_prices: JSON.stringify(updatedPricesArray),
          billboards_count: updatedIds.length,
        } as any).eq('Contract_Number', contractNumber);

        if (contractUpdateErr) throw new Error('فشل في تحديث بيانات العقد: ' + contractUpdateErr.message);
      } else {
        console.log('✅ Executed atomic billboard swap RPC successfully:', swapRpcRes);
      }
    } catch (swapErr) {
      console.error('Swap execution error:', swapErr);
      throw swapErr;
    }

    // هـ. تسجيل سجل النشاط (Audit Log)
    try {
      await supabase.from('activity_log').insert({
        action: 'billboard_swapped',
        entity_type: 'contract',
        entity_id: String(contractNumber),
        contract_number: contractNumber,
        customer_name: customerName || contract['Customer Name'] || '',
        description: `استبدال فوري للوحة #${originalBillboardId} باللوحة #${replacementBillboardId} ابتداءً من ${effectiveDate} (فرق السعر: ${swapDiff.difference} د.ل)`,
        details: {
          originalBillboardId,
          replacementBillboardId,
          effectiveDate,
          originalRemainingValue: origRemaining.remainingValue,
          replacementValue: swapDiff.replacementValueForPeriod,
          difference: swapDiff.difference,
          isEquivalent: swapDiff.isEquivalent,
        },
        user_id: userId || null,
      } as any);
    } catch (logErr) {
      console.warn('Audit log insert failed:', logErr);
    }

    const adjustment: ContractFinancialAdjustment = {
      contractNumber,
      type: 'replacement_difference',
      originalBillboardId,
      replacementBillboardId,
      amount: swapDiff.difference,
      effectiveDate,
      reason: swapDiff.statusText,
    };

    const finalResult: SwapBillboardResult = {
      success: true,
      originalBillboardId,
      replacementBillboardId,
      effectiveDate,
      difference: swapDiff.difference,
      isEquivalent: swapDiff.isEquivalent,
      originalRemainingValue: origRemaining.remainingValue,
      replacementValue: swapDiff.replacementValueForPeriod,
      newBillboardIds: updatedIds,
      adjustment,
    };

    if (operationId) {
      processedOperations.set(operationId, { result: finalResult, timestamp: Date.now() });
    }

    return finalResult;
  } catch (err: any) {
    console.error('executeBillboardSwap failed:', err);
    return {
      success: false,
      error: err.message || 'فشلت عملية استبدال اللوحة',
      originalBillboardId,
      replacementBillboardId,
      effectiveDate,
      difference: 0,
      isEquivalent: true,
      originalRemainingValue: 0,
      replacementValue: 0,
      newBillboardIds: [],
    };
  }
}

/**
 * تنفيذ عملية الإيقاف السريع بدون بديل (Pure Quick Pause)
 */
export async function executeQuickPause(params: {
  contractNumber: number;
  billboardId: number;
  pauseDate: string;
  notes?: string;
  userId?: string;
}): Promise<{
  success: boolean;
  error?: string;
  pauseRefund: number;
  newBillboardIds: string[];
}> {
  const { contractNumber, billboardId, pauseDate, notes, userId } = params;

  try {
    const { data: contract, error: cErr } = await supabase
      .from('Contract')
      .select('*')
      .eq('Contract_Number', contractNumber)
      .single();

    if (cErr || !contract) throw new Error('العقد غير موجود');

    const contractStartDate = contract['Contract Date'] || contract.start_date || pauseDate;
    const contractEndDate = contract['End Date'] || contract.end_date || pauseDate;

    const { data: bb, error: bbErr } = await supabase
      .from('billboards')
      .select('*')
      .eq('ID', billboardId)
      .single();

    if (bbErr || !bb) throw new Error('بيانات اللوحة غير موجودة');

    // استخراج السعر المتفق عليه
    let contractedPrice = Number(bb.Price) || 0;
    try {
      const rawPrices = contract.billboard_prices;
      if (rawPrices) {
        const pricesArray = typeof rawPrices === 'string' ? JSON.parse(rawPrices) : rawPrices;
        const snapshot = pricesArray.find(
          (p: any) => String(p.billboardId ?? p.billboard_id ?? p.ID ?? p.id) === String(billboardId)
        );
        if (snapshot) {
          contractedPrice = Number(snapshot.contractPrice ?? snapshot.finalPrice ?? contractedPrice);
        }
      }
    } catch {}

    const remainingCalc = calculateRemainingBillboardValue({
      startDate: contractStartDate,
      endDate: contractEndDate,
      effectiveDate: pauseDate,
      contractedPrice,
    });

    const currentIds = (contract.billboard_ids || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const updatedIds = currentIds.filter((id: string) => String(id) !== String(billboardId));

    // 1. تسجيل الإيقاف
    await supabase.from('paused_billboards').insert({
      contract_number: contractNumber,
      billboard_id: billboardId,
      billboard_name: bb.Billboard_Name || `لوحة #${billboardId}`,
      pause_date: pauseDate,
      original_price: contractedPrice,
      consumed_amount: remainingCalc.consumedValue,
      refund_amount: remainingCalc.remainingValue,
      deducted_from_contract: true,
      net_rent: contractedPrice,
      full_price: contractedPrice,
      original_start_date: contractStartDate,
      original_end_date: contractEndDate,
      notes: notes || `إيقاف بدون بديل ابتداءً من ${pauseDate}`,
    } as any);

    // 2. تحرير اللوحة
    await supabase.from('billboards').update({
      Contract_Number: null,
      Customer_Name: null,
      Ad_Type: null,
      Rent_Start_Date: null,
      Rent_End_Date: null,
      Status: 'متاح',
      is_visible_in_available: true,
    } as any).eq('ID', billboardId);

    // 3. تحديث العقد
    await supabase.from('Contract').update({
      billboard_ids: updatedIds.length > 0 ? updatedIds.join(',') : null,
      billboards_count: updatedIds.length,
    } as any).eq('Contract_Number', contractNumber);

    // 4. تسجيل النشاط
    try {
      await supabase.from('activity_log').insert({
        action: 'billboard_paused',
        entity_type: 'contract',
        entity_id: String(contractNumber),
        contract_number: contractNumber,
        customer_name: contract['Customer Name'] || '',
        description: `إيقاف اللوحة #${billboardId} من العقد #${contractNumber} بتاريخ ${pauseDate} (مسترجع: ${remainingCalc.remainingValue} د.ل)`,
        details: {
          billboardId,
          pauseDate,
          consumedValue: remainingCalc.consumedValue,
          refundValue: remainingCalc.remainingValue,
        },
        user_id: userId || null,
      } as any);
    } catch {}

    return {
      success: true,
      pauseRefund: remainingCalc.remainingValue,
      newBillboardIds: updatedIds,
    };
  } catch (err: any) {
    console.error('executeQuickPause failed:', err);
    return {
      success: false,
      error: err.message || 'فشلت عملية إيقاف اللوحة',
      pauseRefund: 0,
      newBillboardIds: [],
    };
  }
}

/**
 * نقل لوحة ذرياً بين عقدين عبر PostgreSQL Atomic RPC
 * Single Database Transaction with Mandatory Optimistic Versioning
 */
export async function transferBillboardBetweenContracts(
  sourceContractNumber: number,
  targetContractNumber: number,
  billboardId: number,
  expectedSourceVersion: number,
  expectedTargetVersion: number,
  targetMeta: {
    startDate?: string;
    endDate?: string;
    customerName?: string;
    adType?: string;
  }
) {
  const { data, error } = await supabase.rpc('transfer_contract_billboard_atomic', {
    p_source_contract_number: sourceContractNumber,
    p_target_contract_number: targetContractNumber,
    p_billboard_id: billboardId,
    p_expected_source_version: expectedSourceVersion,
    p_expected_target_version: expectedTargetVersion,
    p_target_start_date: targetMeta.startDate || null,
    p_target_end_date: targetMeta.endDate || null,
    p_target_customer_name: targetMeta.customerName || null,
    p_target_ad_type: targetMeta.adType || null,
  });

  if (error) {
    if (error.message?.includes('CONTRACT_VERSION_CONFLICT')) {
      throw new Error('تم تعديل أحد العقدين بواسطة مستخدم آخر. يرجى إعادة تحميل الصفحة والمحاولة مرة أخرى.');
    }
    throw error;
  }
  return data;
}
