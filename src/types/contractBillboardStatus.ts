/**
 * contractBillboardStatus.ts
 * نموذج الحالة والتعديلات المالية الموحد للوحات داخل العقود
 */

export type ContractBillboardStatus = 'active' | 'paused' | 'replaced' | 'cancelled';

export interface ContractFinancialAdjustment {
  id?: string;
  contractNumber: number;
  type: 'pause_refund' | 'replacement_difference' | 'manual_adjustment';
  billboardId?: number | string;
  originalBillboardId?: number | string;
  replacementBillboardId?: number | string;
  amount: number; // موجب = زيادة على العقد، سالب = خصم من العقد
  reason?: string;
  effectiveDate: string;
  createdAt?: string;
}

export interface BillboardPriceSnapshot {
  billboardId: string | number;
  basePriceBeforeDiscount: number;
  priceBeforeDiscount: number;
  discountPerBillboard: number;
  priceAfterDiscount: number;
  contractPrice: number;
  finalPrice: number;
  printCost: number;
  installationCost: number;
  totalBillboardPrice: number;
  status?: ContractBillboardStatus;
  _replacement_of?: string;
}

export interface BillboardRemainingValueParams {
  startDate: string;
  endDate: string;
  effectiveDate: string;
  contractedPrice: number;
  printCost?: number;
  installCost?: number;
  includePrint?: boolean;
  includeInstall?: boolean;
}

export interface BillboardRemainingValueResult {
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
  consumedValue: number;
  remainingValue: number;
  dailyRate: number;
  nonRefundableCosts: number;
}
