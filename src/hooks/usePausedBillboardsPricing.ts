// @ts-nocheck
import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { listPausedBillboards, PausedBillboard } from '@/services/pausedBillboardsService';
import { calculateDaysBetween } from '@/utils/contractBillboardCalculations';

export interface PausedItemWithPricing {
  raw: PausedBillboard;
  billboard: any | null;
  /** Net rental BEFORE distributed contract discount (= baseRental − includedCosts) */
  baseRentalBeforeDiscount: number;
  /** Discount distributed to this billboard from contract total (0 if no distribution) */
  discountApplied: number;
  /** True when the contract-level discount distribution is active for this billboard */
  hasDistributedDiscount: boolean;
  /** Base rental from pricing table (live) */
  baseRental: number;
  /** Print cost adjusted for single-face */
  printCost: number;
  /** Installation cost adjusted for single-face */
  installPrice: number;
  /** Print cost included inside the rental */
  includedPrintCost: number;
  /** Installation cost included inside the rental */
  includedInstallCost: number;
  /** Print cost added on top */
  extraPrintCost: number;
  /** Installation cost added on top */
  extraInstallCost: number;
  /** Net rental after distributed discount (base − included − discount). */
  netRentalAfterDiscount: number;
  /** Final total per board */
  totalForBoard: number;
  fullPrice: number;
  /** Rental-only base used for pause refund/consumed calculation */
  rentalBase: number;
  /** Consumed portion of rental only */
  consumedRental: number;
  /** Print cost fully added to contract */
  printAdded: number;
  /** Install cost fully added to contract */
  installAdded: number;
  netRentalWithExtras: number;
  isSingleFace: boolean;
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
  dailyRate: number;
  consumedAuto: number;
  refundAuto: number;
  /** Effective refund (0 if replaced!) */
  refund: number;
  /** Allocated amount for replacement */
  allocatedForReplacement: number;
  /** Difference if replacement is more or less expensive */
  replacementDifference: number;
  effectiveRefund: number;
  /** Whether this paused board has been replaced with another billboard */
  hasReplacement: boolean;
  status: 'paused' | 'replaced';
  consumed: number;
  isManualRefund: boolean;
  effectivePauseDate: string;
}

export interface PausedTotals {
  count: number;
  purePausedCount: number;
  replacedCount: number;
  fullSum: number;
  consumedSum: number;
  /** Sum of refund ONLY for pure paused boards without replacement */
  refundSum: number;
  effectiveRefundSum: number;
  /** Sum of replacement differences (+ for upgrade, - for downgrade, 0 for equivalent) */
  replacementDifferencesSum: number;
  allocatedSum: number;
  printSum: number;
  installSum: number;
  baseRentalSum: number;
  discountSum: number;
  includedPrintSum: number;
  includedInstallSum: number;
}

export interface PausedPricingOptions {
  calculateBillboardPrice?: (billboard: any) => number;
  printCostDetails?: Array<{ billboardId: string; printCost: number }>;
  installationDetails?: Array<{ billboardId: string; installationPrice: number; adjustedPrice?: number }>;
  printCostEnabled?: boolean;
  includePrintInPrice?: boolean;
  installationEnabled?: boolean;
  includeInstallationInPrice?: boolean;
  singleFaceBillboards?: Set<string>;
  useStoredPrices?: boolean;
  pricingByBillboard?: Map<string, any>;
}

function roundToBucket(val: number, bucket = 50): number {
  if (!val || val <= 0) return 0;
  return Math.round(val / bucket) * bucket;
}

export function usePausedBillboardsPricing(
  contractNumber: number | null | undefined,
  contractStartDate: string | null | undefined,
  contractEndDate: string | null | undefined,
  options?: PausedPricingOptions
) {
  const [rows, setRows] = useState<PausedBillboard[]>([]);
  const [billboardsMap, setBillboardsMap] = useState<Record<number, any>>({});
  const [replacementsByPausedId, setReplacementsByPausedId] = useState<Record<string, { allocated: number; replacementId: number; replacementName?: string }>>({});
  const [loading, setLoading] = useState(false);

  const fetchPausedData = useCallback(async () => {
    if (!contractNumber) {
      setRows([]);
      setBillboardsMap({});
      setReplacementsByPausedId({});
      return;
    }
    setLoading(true);
    try {
      const [pausedRows, replacements] = await Promise.all([
        listPausedBillboards(Number(contractNumber)),
        supabase
          .from('paused_billboard_replacements' as any)
          .select('*')
          .eq('contract_number', Number(contractNumber)),
      ]);

      const replMap: Record<string, { allocated: number; replacementId: number; replacementName?: string }> = {};
      for (const r of (replacements.data || []) as any[]) {
        replMap[String(r.paused_billboard_id)] = {
          allocated: Number(r.allocated_amount) || 0,
          replacementId: Number(r.replacement_billboard_id),
          replacementName: r.replacement_billboard_name,
        };
      }
      setReplacementsByPausedId(replMap);
      setRows(pausedRows);

      const bbIds = Array.from(new Set(pausedRows.map((r) => Number(r.billboard_id)).filter(Boolean)));
      if (bbIds.length > 0) {
        const { data: bbs } = await supabase
          .from('billboards')
          .select('ID, Billboard_Name, City, District, Nearest_Landmark, Size, Price, Level, Image_URL, Status, Contract_Number')
          .in('ID', bbIds);
        const map: Record<number, any> = {};
        (bbs || []).forEach((b: any) => { map[b.ID] = b; });
        setBillboardsMap(map);
      } else {
        setBillboardsMap({});
      }
    } catch (e) {
      console.error('Error fetching paused billboards pricing:', e);
    } finally {
      setLoading(false);
    }
  }, [contractNumber]);

  useEffect(() => {
    fetchPausedData();
  }, [fetchPausedData]);

  const refetch = fetchPausedData;

  const printMap = useMemo(() => {
    const map = new Map<string, number>();
    options?.printCostDetails?.forEach((p) => {
      map.set(String(p.billboardId), Number(p.printCost) || 0);
    });
    return map;
  }, [options?.printCostDetails]);

  const installMap = useMemo(() => {
    const map = new Map<string, number>();
    options?.installationDetails?.forEach((i) => {
      map.set(String(i.billboardId), Number(i.adjustedPrice ?? i.installationPrice) || 0);
    });
    return map;
  }, [options?.installationDetails]);

  const items = useMemo<PausedItemWithPricing[]>(() => {
    const singleFace = options?.singleFaceBillboards || new Set<string>();
    const printCostEnabled = !!options?.printCostEnabled;
    const includePrintInPrice = !!options?.includePrintInPrice;
    const installEnabled = !!options?.installationEnabled;
    const includeInstallInPrice = !!options?.includeInstallationInPrice;
    const calcPrice = options?.calculateBillboardPrice;
    const pricingByBb = options?.pricingByBillboard;

    return rows.map((r) => {
      const bbId = String(r.billboard_id);
      const bb = billboardsMap[Number(r.billboard_id)] || null;
      const isSingleFace = singleFace.has(bbId);

      let baseRental = 0;
      if (options?.useStoredPrices) {
        baseRental = Number((r as any).price_before_discount ?? r.net_rent ?? r.original_price ?? r.full_price ?? 0);
      }
      if (!baseRental && calcPrice && bb) {
        try { baseRental = Number(calcPrice(bb)) || 0; } catch { baseRental = 0; }
      }
      if (!baseRental) {
        baseRental = Number((r as any).price_before_discount ?? r.net_rent ?? r.original_price ?? r.full_price ?? 0);
      }
      if (!baseRental) {
        const sumConsumedRefund = Number((r as any).consumed_amount || 0) + Number((r as any).refund_amount || 0);
        if (sumConsumedRefund > 0) {
          baseRental = sumConsumedRefund;
        }
      }

      const rawPrint = printMap.get(bbId) || 0;
      const rawInstall = installMap.get(bbId) || 0;
      const printCost = isSingleFace ? Math.round(rawPrint / 2) : rawPrint;
      const installPrice = isSingleFace ? Math.round(rawInstall / 2) : rawInstall;

      const includedPrintCost = printCostEnabled && includePrintInPrice ? printCost : 0;
      const includedInstallCost = installEnabled && includeInstallInPrice ? installPrice : 0;
      const extraPrintCost = printCostEnabled && !includePrintInPrice ? printCost : 0;
      const extraInstallCost = installEnabled && !includeInstallInPrice ? installPrice : 0;

      const perBb = pricingByBb?.get(bbId);
      const baseRentalBeforeDiscount = Math.max(0, baseRental - includedPrintCost - includedInstallCost);
      const hasDistributedDiscount = !!(perBb && Number.isFinite((perBb as any).netRentalAfterDiscount));
      const netRentalAfterDiscount = hasDistributedDiscount
        ? Math.max(0, Number((perBb as any).netRentalAfterDiscount))
        : baseRentalBeforeDiscount;
      const discountApplied = hasDistributedDiscount
        ? Math.max(0, baseRentalBeforeDiscount - netRentalAfterDiscount)
        : 0;

      const totalForBoard = (perBb as any)?.totalForBoard != null
        ? Number((perBb as any).totalForBoard)
        : (netRentalAfterDiscount + includedPrintCost + includedInstallCost + extraPrintCost + extraInstallCost);
      const fullPrice = totalForBoard;
      const netRentalWithExtras = netRentalAfterDiscount + extraPrintCost + extraInstallCost;

      const start = (r as any).original_start_date || contractStartDate || null;
      const end = (r as any).original_end_date || contractEndDate || null;

      const effectivePauseDate = r.pause_date || start || '';

      const totalDays = calculateDaysBetween(start, end) || 30;
      const elapsedDays = effectivePauseDate
        ? Math.max(0, Math.min(totalDays, calculateDaysBetween(start, effectivePauseDate) - 1))
        : 0;
      const remainingDays = Math.max(0, totalDays - elapsedDays);
      const dailyRate = fullPrice / totalDays;

      const rentalBase = Math.max(0, Math.round(netRentalAfterDiscount));
      const printAdded = includedPrintCost + extraPrintCost;
      const installAdded = includedInstallCost + extraInstallCost;
      const nonRefundable = printAdded + installAdded;

      // فحص هل اللوحة مستبدلة
      const replInfo = replacementsByPausedId[String((r as any).id)];
      const hasReplacement = !!replInfo;
      const allocatedForReplacement = replInfo ? Number(replInfo.allocated) || 0 : 0;

      const rawRemainingValue = (rentalBase * remainingDays) / Math.max(1, totalDays);
      const refundAuto = Math.min(rentalBase, roundToBucket(rawRemainingValue, 50));
      const consumedRentalAuto = Math.max(0, rentalBase - refundAuto);
      const consumedAuto = consumedRentalAuto + nonRefundable;

      const manual = (r as any).manual_refund;
      const isManualRefund = manual !== null && manual !== undefined;
      
      let baseRefund = refundAuto;
      if (options?.useStoredPrices && r.refund_amount !== undefined && r.refund_amount !== null && !hasReplacement) {
        baseRefund = Number(r.refund_amount) || 0;
      } else if (isManualRefund && !hasReplacement) {
        baseRefund = Math.min(rentalBase, Math.max(0, Number(manual)));
      }

      // ✅ القاعدة الذهبية: Replacement ≠ Pause
      // إذا كانت مستبدلة: Refund = 0، واللوحة لا تفرض أي خصم إيقاف
      const refund = hasReplacement ? 0 : baseRefund;
      const effectiveRefund = hasReplacement ? 0 : baseRefund;
      const consumedRental = hasReplacement ? rentalBase : Math.max(0, rentalBase - refund);
      const consumed = consumedRental + nonRefundable;

      // الفرق المالي للاستبدال
      const replacementDifference = hasReplacement ? Math.round(allocatedForReplacement - (rentalBase - consumedRentalAuto)) : 0;

      return {
        raw: r,
        billboard: bb,
        baseRentalBeforeDiscount,
        discountApplied,
        hasDistributedDiscount,
        baseRental,
        printCost,
        installPrice,
        includedPrintCost,
        includedInstallCost,
        extraPrintCost,
        extraInstallCost,
        netRentalAfterDiscount,
        totalForBoard,
        fullPrice,
        rentalBase,
        consumedRental,
        printAdded,
        installAdded,
        netRentalWithExtras,
        isSingleFace,
        totalDays,
        elapsedDays,
        remainingDays,
        dailyRate,
        consumedAuto,
        refundAuto,
        refund,
        allocatedForReplacement,
        replacementDifference,
        effectiveRefund,
        hasReplacement,
        status: hasReplacement ? 'replaced' : 'paused',
        consumed,
        isManualRefund,
        effectivePauseDate,
      };
    });
  }, [rows, billboardsMap, replacementsByPausedId, contractStartDate, contractEndDate, options, printMap, installMap]);

  const totals = useMemo<PausedTotals>(() => {
    const purePaused = items.filter((i) => !i.hasReplacement);
    const replaced = items.filter((i) => i.hasReplacement);

    return {
      count: items.length,
      purePausedCount: purePaused.length,
      replacedCount: replaced.length,
      fullSum: items.reduce((s, i) => s + i.fullPrice, 0),
      consumedSum: items.reduce((s, i) => s + i.consumed, 0),
      // ✅ RefundSum يشمل فقط اللوحات الموقوفة بدون استبدال
      refundSum: purePaused.reduce((s, i) => s + i.refund, 0),
      effectiveRefundSum: purePaused.reduce((s, i) => s + (i.effectiveRefund || 0), 0),
      replacementDifferencesSum: replaced.reduce((s, i) => s + (i.replacementDifference || 0), 0),
      allocatedSum: replaced.reduce((s, i) => s + (i.allocatedForReplacement || 0), 0),
      printSum: purePaused.reduce((s, i) => s + (i.printCost || 0), 0),
      installSum: purePaused.reduce((s, i) => s + (i.installPrice || 0), 0),
      baseRentalSum: purePaused.reduce((s, i) => s + (i.baseRental || 0), 0),
      discountSum: purePaused.reduce((s, i) => s + (i.discountApplied || 0), 0),
      includedPrintSum: purePaused.reduce((s, i) => s + (i.includedPrintCost || 0), 0),
      includedInstallSum: purePaused.reduce((s, i) => s + (i.includedInstallCost || 0), 0),
    };
  }, [items]);

  return { items, totals, loading, refetch };
}
