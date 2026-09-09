import { executePauseAtomic } from './contractEditService';
/**
 * contractBillboardSwapService.ts
 * الخدمة المركزية الموحدة لعمليات التبديل الفوري 1:1 والإيقاف الذري للوحات
 */

import { supabase } from '@/integrations/supabase/client';
import {
  calculateRemainingBillboardValue,
} from '@/utils/contractBillboardCalculations';
import { ContractFinancialAdjustment } from '@/types/contractBillboardStatus';

export interface InstantBillboardSwapParams {
  contractNumber: number;
  originalBillboardId: number;
  replacementBillboardId: number;
  userId?: string;
  swapRequestId?: string;
}

export interface InstantBillboardSwapResult {
  success: boolean;
  error?: string;
  code?: string;
  contractNumber: number;
  originalBillboardId: number;
  replacementBillboardId: number;
  preservedContractPrice: number;
  contractTotalBefore: number;
  contractTotalAfter: number;
  newBillboardIds: string[];
  updatedBillboardPrices?: any[];
  swapRequestId?: string;
  alreadyProcessed?: boolean;
  reinstallationTaskId?: string;
}

export interface SwapBillboardParams {
  contractNumber: number;
  originalBillboardId: number;
  replacementBillboardId: number;
  effectiveDate?: string;
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

/**
 * خريطة أخطاء قاعدة البيانات وتحويلها لرسائل واضحة ومفهومة للمستخدم
 */
function mapRpcErrorToUserMessage(code: string, rawMessage?: string): string {
  switch (code) {
    case 'CANDIDATE_NOT_AVAILABLE':
      return 'اللوحة البديلة تم حجزها أو لم تعد متاحة حالياً، يرجى اختيار لوحة أخرى.';
    case 'OLD_BILLBOARD_NOT_IN_CONTRACT':
      return 'اللوحة الحالية غير مدرجة في هذا العقد.';
    case 'NEW_BILLBOARD_ALREADY_IN_CONTRACT':
      return 'اللوحة البديلة موجودة بالفعل داخل هذا العقد.';
    case 'CONTRACT_NOT_FOUND':
      return 'لم يتم العثور على بيانات العقد في قاعدة البيانات.';
    case 'OLD_BILLBOARD_NOT_FOUND':
      return 'لم يتم العثور على بيانات اللوحة الحالية.';
    case 'NEW_BILLBOARD_NOT_FOUND':
      return 'لم يتم العثور على بيانات اللوحة البديلة.';
    case 'CONTRACT_DATA_INCONSISTENT':
      return 'تعذر تنفيذ التبديل بسبب عدم تطابق بيانات العقد. لم يتم تطبيق أي تغيير.';
    case 'CONTRACT_EMPTY':
      return 'العقد لا يحتوي على أي لوحات مسجلة.';
    case 'SAME_BILLBOARD':
      return 'لا يمكن استبدال اللوحة بنفسها.';
    case 'PERMISSION_DENIED':
      return 'ليس لديك صلاحية لتعديل هذا العقد.';
    case 'INVALID_INPUT':
      return 'بيانات التبديل غير مكتملة أو غير صالحة.';
    default:
      if (rawMessage && !rawMessage.includes('P0001') && !rawMessage.includes('violates')) {
        return rawMessage;
      }
      return 'تعذر إتمام عملية التبديل الفوري، ولم يتم تطبيق أي تغيير على العقد.';
  }
}

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

    // إذا كانت محجوزة لعقد آخر
    if (bb.Contract_Number && Number(bb.Contract_Number) !== Number(excludeContractNumber)) {
      return {
        isAvailable: false,
        conflictReason: `اللوحة محجوزة حالياً في العقد #${bb.Contract_Number}`,
      };
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
 * ═══════════════════════════════════════════════════════════════════════════
 * تنفيذ عملية التبديل الفوري 1:1 الذرية (Instant 1:1 Equivalent Swap)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * القواعد الصارمة:
 * 1. INSTANT_SWAP !== PAUSE (صفر سجلات في paused_billboards و paused_billboard_replacements)
 * 2. الحفاظ المالي التام: سعر اللوحة القديمة ينتقل للجديدة، إجمالي العقد ثابت (فرق 0.00 د.ل)
 * 3. المعاملة ذرية حصراً عبر PostgreSQL RPC (execute_instant_billboard_swap) مع قفل الصفوف FOR UPDATE
 * 4. FAIL CLOSED: لا يوجد أي تعديل يدوي متتابع من العميل في حال تعذر RPC
 */
export async function executeInstantBillboardSwap(
  params: InstantBillboardSwapParams
): Promise<InstantBillboardSwapResult> {
  const { contractNumber, originalBillboardId, replacementBillboardId, userId } = params;

  if (!contractNumber || !originalBillboardId || !replacementBillboardId) {
    return {
      success: false,
      code: 'INVALID_INPUT',
      error: 'بيانات التبديل غير مكتملة',
      contractNumber: contractNumber || 0,
      originalBillboardId: originalBillboardId || 0,
      replacementBillboardId: replacementBillboardId || 0,
      preservedContractPrice: 0,
      contractTotalBefore: 0,
      contractTotalAfter: 0,
      newBillboardIds: [],
    };
  }

  if (Number(originalBillboardId) === Number(replacementBillboardId)) {
    return {
      success: false,
      code: 'SAME_BILLBOARD',
      error: 'لا يمكن استبدال اللوحة بنفسها',
      contractNumber,
      originalBillboardId,
      replacementBillboardId,
      preservedContractPrice: 0,
      contractTotalBefore: 0,
      contractTotalAfter: 0,
      newBillboardIds: [],
    };
  }

  const stableSwapRequestId = params.swapRequestId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined);

  try {
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('execute_instant_billboard_swap', {
      p_contract_number: Number(contractNumber),
      p_original_billboard_id: Number(originalBillboardId),
      p_replacement_billboard_id: Number(replacementBillboardId),
      p_user_id: userId || null,
      p_swap_event_id: stableSwapRequestId || null,
    });

    if (rpcErr) {
      console.error('RPC execute_instant_billboard_swap failed:', rpcErr);
      const code = (rpcErr as any).code || 'RPC_ERROR';
      const msg = mapRpcErrorToUserMessage(code, rpcErr.message);
      return {
        success: false,
        code,
        error: msg,
        contractNumber,
        originalBillboardId,
        replacementBillboardId,
        preservedContractPrice: 0,
        contractTotalBefore: 0,
        contractTotalAfter: 0,
        newBillboardIds: [],
        swapRequestId: stableSwapRequestId,
      };
    }

    if (!rpcRes || !rpcRes.success) {
      const code = rpcRes?.code || 'SWAP_FAILED';
      const msg = rpcRes?.message || mapRpcErrorToUserMessage(code);
      return {
        success: false,
        code,
        error: msg,
        contractNumber,
        originalBillboardId,
        replacementBillboardId,
        preservedContractPrice: 0,
        contractTotalBefore: 0,
        contractTotalAfter: 0,
        newBillboardIds: [],
        swapRequestId: stableSwapRequestId,
      };
    }

    const newIds = Array.isArray(rpcRes.new_billboard_ids)
      ? rpcRes.new_billboard_ids.map(String)
      : [];

    return {
      success: true,
      swapRequestId: stableSwapRequestId,
      alreadyProcessed: Boolean(rpcRes.already_processed),
      reinstallationTaskId: rpcRes.reinstallation_task_id,
      contractNumber: Number(rpcRes.contract_number),
      originalBillboardId: Number(rpcRes.original_billboard_id),
      replacementBillboardId: Number(rpcRes.replacement_billboard_id),
      preservedContractPrice: Number(rpcRes.preserved_contract_price || 0),
      contractTotalBefore: Number(rpcRes.contract_total_before || 0),
      contractTotalAfter: Number(rpcRes.contract_total_after || 0),
      newBillboardIds: newIds,
      updatedBillboardPrices: rpcRes.updated_billboard_prices,
    };
  } catch (err: any) {
    console.error('executeInstantBillboardSwap exception:', err);
    return {
      success: false,
      code: 'EXCEPTION',
      error: err.message || 'حدث خطأ غير متوقع أثناء تنفيذ عملية التبديل الفوري',
      contractNumber,
      originalBillboardId,
      replacementBillboardId,
      preservedContractPrice: 0,
      contractTotalBefore: 0,
      contractTotalAfter: 0,
      newBillboardIds: [],
    };
  }
}

/**
 * دالة التبديل السابقة - مفصولة وموجهة للتبديل الفوري الذري المباشر
 */
export async function executeBillboardSwap(params: SwapBillboardParams): Promise<SwapBillboardResult> {
  const result = await executeInstantBillboardSwap({
    contractNumber: params.contractNumber,
    originalBillboardId: params.originalBillboardId,
    replacementBillboardId: params.replacementBillboardId,
    userId: params.userId,
  });

  const todayStr = new Date().toISOString().split('T')[0];

  return {
    success: result.success,
    error: result.error,
    originalBillboardId: result.originalBillboardId,
    replacementBillboardId: result.replacementBillboardId,
    effectiveDate: params.effectiveDate || todayStr,
    difference: 0,
    isEquivalent: true,
    originalRemainingValue: result.preservedContractPrice,
    replacementValue: result.preservedContractPrice,
    newBillboardIds: result.newBillboardIds,
  };
}

/**
 * تنفيذ عملية الإيقاف السريع بدون بديل (Pure Quick Pause)
 */
export async function executeQuickPause(params: {
  contractNumber: number;
  billboardId: number;
  pauseDate: string;
  expectedRevision?: number;
  notes?: string;
  userId?: string;
}): Promise<{
  success: boolean;
  error?: string;
  pauseRefund: number;
  newBillboardIds: string[];
}> {
  try {
    return await executePauseAtomic(params.contractNumber, params.billboardId, params.pauseDate, params.notes, null, params.expectedRevision);
  } catch (error: any) {
    return { success: false, error: error.message || 'تعذر إيقاف اللوحة', pauseRefund: 0, newBillboardIds: [] };
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
