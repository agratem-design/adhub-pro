import { executePauseAtomic } from './contractEditService';
import { calculateRemainingBillboardValue } from '@/utils/contractBillboardCalculations';
import { supabase } from '@/integrations/supabase/client';

export interface PauseCalculationResult {
  billboardPrice: number;
  printShareTotal: number;
  installShareTotal: number;
  netRent: number;
  totalDays: number;
  elapsedDays: number;
  dueRent: number;
  amountConsumed: number;
  unusedRefund: number;
}

export const calculateBillboardPauseValue = (
  pauseDate: string,
  rentStartDate: string,
  contractEndDate: string,
  billboardPrice: number,
  printCost: number = 0,
  installCost: number = 0,
  includePrint: boolean = false,
  includeInstall: boolean = false
): PauseCalculationResult => {
  const result = calculateRemainingBillboardValue({ startDate: rentStartDate, endDate: contractEndDate,
    effectiveDate: pauseDate, contractedPrice: billboardPrice, printCost, installCost, includePrint, includeInstall });
  const netRent = Math.max(0, billboardPrice - printCost - installCost);
  return { billboardPrice, printShareTotal: printCost, installShareTotal: installCost,
    netRent, totalDays: result.totalDays, elapsedDays: result.elapsedDays,
    dueRent: Math.max(0, netRent - result.remainingValue),
    amountConsumed: result.consumedValue, unusedRefund: result.remainingValue };

};

export const pauseBillboardFromContract = async (
  billboardId: number,
  contractNumber: number,
  pauseDate: string,
  notes: string,
  refundAmount: number,
  deductFromContract: boolean
) => {
  await executePauseAtomic(contractNumber, billboardId, pauseDate, notes, deductFromContract ? refundAmount : 0);
  return true;

};

export const autoPauseBillboardFromActiveContract = async (
  billboardId: number,
  oldContractNumber: number,
  pauseDateStr: string
) => {
  // The database derives the refund from the saved price and deducts it once.
  await executePauseAtomic(oldContractNumber, billboardId, pauseDateStr,
    'تم نقل اللوحة إلى عقد آخر');
};
