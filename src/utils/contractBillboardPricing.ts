/**
 * Unified billboard pricing logic — Single Source of Truth
 * Used by both the UI cards (SelectedBillboardsCard) and the save path (ContractEdit).
 */

export interface BillboardPricingInput {
  billboardId: string;
  baseRentalPrice: number;       // from calculateBillboardPrice()
  installationPrice: number;     // from installationDetails
  printCost: number;             // from printCostDetails
  isSingleFace: boolean;
  /** When true, this billboard is a replacement for a paused one — its baseRentalPrice
   *  is fixed to `replacementAllocation`, and it is excluded from contract-discount
   *  distribution so that paused.consumed + replacement.allocated = original full price. */
  isReplacement?: boolean;
  replacementAllocation?: number;
  individualDiscountValue?: number;
  individualDiscountType?: 'percent' | 'amount';
}

export interface BillboardPricingOptions {
  totalDiscount: number;
  printCostEnabled: boolean;
  includePrintInPrice: boolean;
  installationEnabled: boolean;
  includeInstallationInPrice: boolean;
}

export interface BillboardPricingResult {
  billboardId: string;
  baseRentalPrice: number;
  installationPrice: number;       // adjusted for single face
  printCost: number;               // adjusted for single face
  includedPrintCost: number;
  includedInstallCost: number;
  netRentalBeforeDiscount: number;
  rawDiscountPerBillboard: number;
  discountPerBillboard: number;
  individualDiscountAmt: number;   // calculated individual discount amount
  netRentalAfterDiscount: number;
  extraPrintCost: number;
  extraInstallCost: number;
  totalForBoard: number;           // final price shown on card
}

/**
 * Smart rounding to "clean" numbers — matches the card display logic exactly.
 * New logic: >5000 → nearest 500, >1000 → nearest 100, >100 → nearest 50, else → nearest 10
 */
export function roundToClean(value: number): number {
  if (value <= 0) return 0;
  if (value > 5000) return Math.round(value / 500) * 500;
  if (value > 1000) return Math.round(value / 100) * 100;
  if (value > 100) return Math.round(value / 50) * 50;
  return Math.round(value / 10) * 10;
}

/**
 * Calculate pricing for all billboards at once, with proper discount distribution
 * and rounding that matches the UI cards exactly.
 */
export function calculateAllBillboardPrices(
  inputs: BillboardPricingInput[],
  options: BillboardPricingOptions
): BillboardPricingResult[] {
  const { totalDiscount, printCostEnabled, includePrintInPrice, installationEnabled, includeInstallationInPrice } = options;

  // Step 1: Adjust for single face, apply individual discount, and compute net rental before discount
  const intermediate = inputs.map(inp => {
    const installPrice = inp.isSingleFace ? Math.round(inp.installationPrice / 2) : inp.installationPrice;
    const printPrice = inp.isSingleFace ? Math.round(inp.printCost / 2) : inp.printCost;

    const includedPrint = (printCostEnabled && includePrintInPrice) ? printPrice : 0;
    const includedInstall = (installationEnabled && includeInstallationInPrice) ? installPrice : 0;
    // ✅ للوحة البديلة: allocated_amount يُعامَل كإجمالي اللوحة (مثل baseRentalPrice لأي لوحة عادية).
    // إذا كان "تضمين الطباعة/التركيب في السعر" مفعّلاً، فإن هذه التكاليف تُعتبر داخل المبلغ المخصص.
    const isReplacement = !!inp.isReplacement;
    const replacementAlloc = Number(inp.replacementAllocation || 0);
    const originalBaseRental = isReplacement ? replacementAlloc : inp.baseRentalPrice;

    // Calculate individual discount amount
    let individualDiscountAmt = 0;
    if (!isReplacement && inp.individualDiscountValue && inp.individualDiscountValue > 0) {
      if (inp.individualDiscountType === 'percent') {
        individualDiscountAmt = Math.round(originalBaseRental * (inp.individualDiscountValue / 100));
      } else {
        individualDiscountAmt = inp.individualDiscountValue;
      }
    }

    const effectiveBaseRental = Math.max(0, originalBaseRental - individualDiscountAmt);
    const netRentalBeforeDiscount = Math.max(
      0,
      effectiveBaseRental - includedPrint - includedInstall
    );

    const extraPrint = (printCostEnabled && !includePrintInPrice) ? printPrice : 0;
    const extraInstall = (installationEnabled && !includeInstallationInPrice) ? installPrice : 0;

    return {
      billboardId: inp.billboardId,
      baseRentalPrice: originalBaseRental,
      effectiveBaseRental,
      individualDiscountAmt,
      installationPrice: installPrice,
      printCost: printPrice,
      includedPrintCost: includedPrint,
      includedInstallCost: includedInstall,
      netRentalBeforeDiscount,
      extraPrintCost: extraPrint,
      extraInstallCost: extraInstall,
      isReplacement,
    };
  });

  // Step 2: Total net rental for proportional discount distribution
  // ✅ نستبعد اللوحات البديلة من توزيع الخصم (سعرها allocated_amount يُعتبر نهائياً).
  const totalNetRental = intermediate
    .filter(i => !i.isReplacement)
    .reduce((s, i) => s + i.netRentalBeforeDiscount, 0);

  const prelimResults = intermediate.map(item => {
    const proportion = (item.isReplacement || totalNetRental <= 0)
      ? 0
      : item.netRentalBeforeDiscount / totalNetRental;
    const rawDiscount = item.isReplacement ? 0 : totalDiscount * proportion;
    // ✅ Client price excludes print/installation if they are included in the price (free for customer)
    const rawTotal = Math.max(0, item.effectiveBaseRental - rawDiscount) + item.extraInstallCost + item.extraPrintCost;
    // ✅ نقرّب فقط عندما يوجد خصم فعلي على العقد. بدون خصم، نُبقي القيمة الخام
    // لتجنّب ظهور سطر "خصم" وهمي ناتج عن فرق التقريب.
    const roundedTotal = item.isReplacement || totalDiscount <= 0
      ? rawTotal
      : roundToClean(rawTotal);

    return { ...item, rawDiscount, rawTotal, roundedTotal };
  });

  // Step 4: Try clean-number mode against the exact contract total first
  const roundMoney = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const totalEffectiveRental = intermediate
    .filter(i => !i.isReplacement)
    .reduce((s, i) => s + i.effectiveBaseRental, 0);
  const totalExtraServices = intermediate
    .filter(i => !i.isReplacement)
    .reduce((s, i) => s + i.extraInstallCost + i.extraPrintCost, 0);
  const expectedContractTotal = roundMoney(Math.max(0, totalEffectiveRental - totalDiscount) + totalExtraServices);

  // ✅ نتجاهل البديلة في حساب الفجوة (مبلغها ثابت)
  const sumOfRounded = prelimResults
    .filter(r => !r.isReplacement)
    .reduce((s, r) => s + r.roundedTotal, 0);
  const gap = roundMoney(sumOfRounded - expectedContractTotal);

  // ✅ نستخدم القيم المقرّبة دائماً (سواء يوجد خصم أم لا)
  let useRounded = true;

  if (gap !== 0 && totalDiscount > 0) {
    // Group boards by their roundedTotal so identical boards stay uniform — استبعد البديلة
    const groupMap = new Map<number, number[]>();
    prelimResults.forEach((r, i) => {
      if (r.isReplacement) return;
      const key = r.roundedTotal;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(i);
    });

    const groupEntries = Array.from(groupMap.entries()); // [roundedTotal, indices[]]

    // For each group, generate clean candidates (current ± 1-2 clean steps)
    const getCleanStep = (val: number): number => {
      if (val > 5000) return 500;
      if (val > 1000) return 100;
      if (val > 100) return 50;
      return 10;
    };

    const groupCandidates: { value: number; count: number }[][] = groupEntries.map(([total, indices]) => {
      const step = getCleanStep(total);
      const candidates = new Set<number>();
      candidates.add(total);
      for (let d = 1; d <= 2; d++) {
        const up = roundToClean(total + step * d);
        const down = roundToClean(total - step * d);
        if (up > 0) candidates.add(up);
        if (down > 0) candidates.add(down);
      }
      return Array.from(candidates).map(v => ({ value: v, count: indices.length }));
    });

    // Brute-force search for combination with smallest gap
    let bestCombo: number[] | null = null;
    let bestGap = Infinity;

    const search = (gi: number, currentSum: number, chosen: number[]) => {
      if (bestGap === 0) return; // found perfect match
      if (gi === groupCandidates.length) {
        const g = Math.abs(roundMoney(currentSum - expectedContractTotal));
        if (g < bestGap) {
          bestGap = g;
          bestCombo = [...chosen];
        }
        return;
      }
      for (const cand of groupCandidates[gi]) {
        search(gi + 1, currentSum + cand.value * cand.count, [...chosen, cand.value]);
      }
    };

    search(0, 0, []);

    if (bestCombo && bestGap < 0.5) {
      // Apply the best combination back to prelimResults
      groupEntries.forEach(([, indices], gi) => {
        const newVal = bestCombo![gi];
        for (const idx of indices) {
          prelimResults[idx].roundedTotal = newVal;
        }
      });
    }
    // ✅ حتى لو لم نجد توليفة مثالية تطابق الإجمالي، نُبقي القيم المقرّبة
    // ونتقبّل فارقاً بسيطاً في إجمالي العقد (هذا ما طلبه المستخدم).
  }

  // ✅ تسوية متبقّيات التقريب: نضمن أن مجموع إجماليات اللوحات = إجمالي العقد بدقة.
  // نُوزّع الفجوة بالتساوي على مجموعات اللوحات المتشابهة أولاً لضمان التوازن،
  // ثم نعالج أي فجوة متبقّية بالطريقة التقليدية خطوةً بخطوة.
  {
    const getStep = (v: number): number => {
      if (v > 5000) return 500;
      if (v > 1000) return 100;
      if (v > 100) return 50;
      return 10;
    };
    const nonReplIdx = prelimResults
      .map((r, i) => (r.isReplacement ? -1 : i))
      .filter((i) => i >= 0);

    const sumNonRepl = () =>
      prelimResults
        .filter((r) => !r.isReplacement)
        .reduce((s, r) => s + r.roundedTotal, 0);

    let curGap = roundMoney(sumNonRepl() - expectedContractTotal);

    // ── مرحلة 1: توزيع الفجوة بالتساوي على مجموعات اللوحات المتشابهة ──
    // نبني مجموعات حسب roundedTotal المتطابق.
    // نُعطي الأولوية للمجموعات الأكبر (عدداً) ثم الأعلى قيمةً لامتصاص أكبر قدر من الفجوة.
    if (Math.abs(curGap) >= 1) {
      // بناء مجموعات اللوحات المتشابهة
      const groupMap = new Map<number, number[]>();
      nonReplIdx.forEach((i) => {
        const key = prelimResults[i].roundedTotal;
        if (!groupMap.has(key)) groupMap.set(key, []);
        groupMap.get(key)!.push(i);
      });

      // ترتيب المجموعات: الأكثر عدداً أولاً (تساعد أكثر في تغطية الفجوة)، ثم الأعلى قيمةً
      const sortedGroups = Array.from(groupMap.entries()).sort(
        ([valA, idxA], [valB, idxB]) =>
          idxB.length - idxA.length || valB - valA
      );

      for (const [, indices] of sortedGroups) {
        if (Math.abs(curGap) < 1) break;
        const count = indices.length;
        const step = getStep(prelimResults[indices[0]].roundedTotal);
        // كم خطوة يمكن توزيعها على هذه المجموعة بالتساوي؟
        const stepsNeeded = Math.round(Math.abs(curGap) / step);
        // نوزّع: كل لوحة تأخذ نفس عدد الخطوات قدر الإمكان
        const stepsPerBoard = Math.floor(stepsNeeded / count);
        if (stepsPerBoard >= 1) {
          const sign = curGap > 0 ? -1 : 1;
          for (const i of indices) {
            prelimResults[i].roundedTotal = Math.max(
              0,
              prelimResults[i].roundedTotal + sign * stepsPerBoard * step
            );
          }
          curGap = roundMoney(sumNonRepl() - expectedContractTotal);
        }
      }
    }

    // ── مرحلة 2: أي فجوة متبقّية تُعالَج لوحةً بلوحة (سلوك التقليدي) ──
    // الأكبر قيمةً أولاً ليستوعب خطوات أكبر
    const sortedIdx = [...nonReplIdx].sort(
      (a, b) => prelimResults[b].roundedTotal - prelimResults[a].roundedTotal
    );

    let safety = 2000;
    while (Math.abs(curGap) >= 1 && safety-- > 0 && sortedIdx.length > 0) {
      // ابحث عن أكبر خطوة لا تتجاوز |الفجوة|
      let bestI = -1;
      let bestStep = 0;
      for (const i of sortedIdx) {
        const step = getStep(prelimResults[i].roundedTotal);
        if (step <= Math.abs(curGap) + 0.0001 && step > bestStep) {
          bestI = i;
          bestStep = step;
        }
      }
      if (bestI < 0) {
        // الفجوة أصغر من أصغر خطوة (10).
        // نحاول توزيعها بالتساوي على اللوحات المتشابهة أولاً للمحافظة على التوازن.
        // نبحث عن مجموعة اللوحات التي تساوي قيمة sortedIdx[0].
        const refVal = prelimResults[sortedIdx[0]].roundedTotal;
        const sameGroup = sortedIdx.filter(
          (i) => prelimResults[i].roundedTotal === refVal
        );
        if (sameGroup.length > 1) {
          // وزّع الفجوة بالتساوي: كل لوحة تحمل حصتها من الفجوة
          const sharePerBoard = roundMoney(curGap / sameGroup.length);
          for (const i of sameGroup) {
            prelimResults[i].roundedTotal = roundMoney(
              prelimResults[i].roundedTotal - sharePerBoard
            );
          }
        } else {
          // لوحة واحدة: امتص الفجوة بالكامل
          prelimResults[sortedIdx[0]].roundedTotal = roundMoney(
            prelimResults[sortedIdx[0]].roundedTotal - curGap
          );
        }
        curGap = 0;
        break;
      }
      const sign = curGap > 0 ? -1 : 1;
      prelimResults[bestI].roundedTotal = Math.max(
        0,
        prelimResults[bestI].roundedTotal + sign * bestStep
      );
      curGap = roundMoney(sumNonRepl() - expectedContractTotal);
    }
  }

  // Step 5: Build final results
  const results: BillboardPricingResult[] = prelimResults.map(item => {
    const useTotal = useRounded ? item.roundedTotal : item.rawTotal;
    // ✅ نضبط الخصم/الفرق لكل لوحة بحيث: netAfterDiscount + extras = useTotal
    //    سواء كان هناك خصم عقد أو لا (الفرق الناتج عن التقريب يُسجَّل ضمن discountPerBillboard).
    const adjustedDiscount = item.isReplacement
      ? 0
      : item.rawDiscount + (item.rawTotal - useTotal);
    const netAfterDiscount = Math.max(0, item.netRentalBeforeDiscount - adjustedDiscount);
    const finalTotal = Math.max(0, item.effectiveBaseRental - adjustedDiscount) + item.extraInstallCost + item.extraPrintCost;

    return {
      billboardId: item.billboardId,
      baseRentalPrice: item.baseRentalPrice,
      installationPrice: item.installationPrice,
      printCost: item.printCost,
      includedPrintCost: item.includedPrintCost,
      includedInstallCost: item.includedInstallCost,
      netRentalBeforeDiscount: item.netRentalBeforeDiscount,
      rawDiscountPerBillboard: item.rawDiscount,
      discountPerBillboard: adjustedDiscount,
      individualDiscountAmt: item.individualDiscountAmt,
      netRentalAfterDiscount: netAfterDiscount,
      extraPrintCost: item.extraPrintCost,
      extraInstallCost: item.extraInstallCost,
      totalForBoard: finalTotal,
    };
  });

  return results;
}
