import { getCompositeTaskOperationKey } from '@/lib/compositeTaskOperation';
/**
 * حسابات تكاليف العملية المجمعة (تركيب + طباعة + قص) — دوال صافية بلا قاعدة بيانات.
 *
 * القاعدة الأساسية لخدمات العقد:
 * - في التركيب الأول إذا كان العقد يشمل التركيب/الطباعة فإن قيمتها على الزبون = 0 وتظهر «مشمولة بالعقد».
 * - تكلفة الشركة لهذه الخدمة المشمولة لا تُعدّ خسارة على المهمة؛ هي «مصروف على العقد» (مدفوعة من قيمة العقد).
 * - ربح المهمة = المستحق على الزبون − تكاليف الخدمات غير المشمولة.
 */

export type OperationType = 'new_installation' | 'reinstallation';

export interface CostLine {
  id: string;
  taskId: string;
  billboardId: number;
  /** مساحة الوجه الواحد م² */
  faceArea: number;
  faceAreas?: number[];
  selectedFaces?: number[];
  faces: number;
  /** سعر التركيب على الزبون للوحة */
  customer: number;
  /** تكلفة التركيب على الشركة (الفرقة) للوحة */
  company: number;
  companyPerMeter?: number | null;
  customerExtra: number;
  companyExtra: number;
  inPrint: boolean;
  /** سعر متر الطباعة على الزبون لهذه اللوحة (null = السعر العام للعملية) */
  printCustomerPerMeter?: number | null;
  /** تكلفة متر الطباعة على الشركة لهذه اللوحة (null = السعر العام للعملية) */
  printCompanyPerMeter?: number | null;
  hasCutout: boolean;
  cutoutCount: number;
  cutoutCustomerUnit: number;
  cutoutCompanyUnit: number;
}

export interface OperationDraft {
  type: OperationType;
  contractIncludesInstallation: boolean;
  contractIncludesPrint: boolean;
  lines: CostLine[];
  printEnabled: boolean;
  printCustomerPerMeter: number;
  printCompanyPerMeter: number;
  discount: number;
}

export interface ServiceTotals {
  customer: number;
  company: number;
  included: boolean;
  /** تكلفة الشركة المحمّلة على العقد (للخدمة المشمولة) */
  contractExpense: number;
}

export interface OperationTotals {
  installation: ServiceTotals & { extrasCustomer: number; extrasCompany: number };
  print: ServiceTotals & { area: number; boards: number };
  cutout: ServiceTotals & { count: number };
  customerSubtotal: number;
  discount: number;
  customerTotal: number;
  /** كل ما تدفعه الشركة للتنفيذ */
  companyTotal: number;
  /** الجزء المشمول بالعقد من تكلفة الشركة */
  contractExpense: number;
  /** تكلفة المهمة نفسها = تكلفة الشركة − مصروف العقد */
  taskCost: number;
  profit: number;
  margin: number;
}

export const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
export const money = (n: number) => `${r2(n).toLocaleString('en-US', { maximumFractionDigits: 2 })} د.ل`;
const pos = (n: unknown) => Math.max(0, Number(n) || 0);

/** الخدمة مشمولة بالعقد فقط في التركيب الأول */
export const isIncluded = (type: OperationType, flag: boolean) => type === 'new_installation' && !!flag;

export const lineArea = (l: Pick<CostLine, 'faceArea' | 'faces' | 'faceAreas' | 'selectedFaces'>) => {
  const indices = l.selectedFaces?.length ? l.selectedFaces : Array.from({ length: Math.max(1, Number(l.faces) || 1) }, (_, i) => i + 1);
  return indices.reduce((total, index) => total + pos(l.faceAreas?.[index - 1] ?? l.faceArea), 0);
};

/** Recalculate once for both individual and bulk face selections. */
export function changeCostLineFaces<T extends CostLine & { maxFaces: number; sizeInstallPrice: number; tableFullPrice?: number; faceInstallPrices?: number[]; customerPerMeter: number | null }>(line: T, selection: number[]): T {
  const selectedFaces = [...new Set(selection)].filter(n => Number.isInteger(n) && n >= 1 && n <= line.maxFaces).sort((a, b) => a - b);
  if (!selectedFaces.length) return line;
  const faces = selectedFaces.length;
  const oldFaces = Math.max(1, line.faces);
  const next = { ...line, selectedFaces, faces };
  const sizeInstallPrice = r2(selectedFaces.reduce((sum, face) => sum + (line.faceInstallPrices?.[face - 1] ?? (line.tableFullPrice ?? line.sizeInstallPrice / oldFaces * 2) / 2), 0));
  const tablePricing = Math.abs(line.company - line.sizeInstallPrice) < 0.01;
  // الأوجه قد تختلف في المقاس والسعر: التناسب يكون بالسعر لا بعدد الأوجه
  const priceRatio = line.sizeInstallPrice > 0 ? sizeInstallPrice / line.sizeInstallPrice : faces / oldFaces;
  return {
    ...next, sizeInstallPrice,
    company: line.companyPerMeter != null ? r2(line.companyPerMeter * lineArea(next)) : tablePricing ? sizeInstallPrice : r2(line.company * priceRatio),
    customer: line.customerPerMeter ? r2(line.customerPerMeter * lineArea(next)) : Math.abs(line.customer - line.sizeInstallPrice) < 0.01 ? sizeInstallPrice : r2(line.customer * priceRatio),
  };
}

/** سعر متر الطباعة الفعلي للوحة: الخاص بها إن حُدد، وإلا السعر العام للعملية */
export function linePrintRate(l: Pick<CostLine, 'printCustomerPerMeter' | 'printCompanyPerMeter'>, d: Pick<OperationDraft, 'printCustomerPerMeter' | 'printCompanyPerMeter'>, target: BulkTarget): number {
  const own = target === 'customer' ? l.printCustomerPerMeter : l.printCompanyPerMeter;
  return pos(own != null ? own : target === 'customer' ? d.printCustomerPerMeter : d.printCompanyPerMeter);
}

export function computeOperation(d: OperationDraft): OperationTotals {
  const instIncluded = isIncluded(d.type, d.contractIncludesInstallation);
  const printIncluded = isIncluded(d.type, d.contractIncludesPrint);

  let iCust = 0, iComp = 0, eCust = 0, eComp = 0;
  let pArea = 0, pBoards = 0, pCust = 0, pComp = 0;
  let cCount = 0, cCust = 0, cComp = 0;

  for (const l of d.lines) {
    iCust += instIncluded ? 0 : pos(l.customer);
    iComp += pos(l.company);
    eCust += pos(l.customerExtra);
    eComp += pos(l.companyExtra);
    if (d.printEnabled && l.inPrint) {
      const a = lineArea(l);
      pArea += a; pBoards += 1;
      pCust += a * linePrintRate(l, d, 'customer');
      pComp += a * linePrintRate(l, d, 'company');
    }
    if (l.hasCutout) {
      const q = Math.max(1, Math.round(Number(l.cutoutCount) || 1));
      cCount += q;
      cCust += q * pos(l.cutoutCustomerUnit);
      cComp += q * pos(l.cutoutCompanyUnit);
    }
  }

  const installation = {
    customer: r2(iCust + eCust),
    company: r2(iComp + eComp),
    included: instIncluded,
    contractExpense: instIncluded ? r2(iComp) : 0,
    extrasCustomer: r2(eCust),
    extrasCompany: r2(eComp),
  };
  const printCompany = r2(pComp);
  const print = {
    customer: printIncluded ? 0 : r2(pCust),
    company: printCompany,
    included: printIncluded,
    contractExpense: printIncluded ? printCompany : 0,
    area: r2(pArea),
    boards: pBoards,
  };
  const cutout = { customer: r2(cCust), company: r2(cComp), included: false, contractExpense: 0, count: cCount };

  const customerSubtotal = r2(installation.customer + print.customer + cutout.customer);
  const discount = r2(Math.min(pos(d.discount), customerSubtotal));
  const customerTotal = r2(customerSubtotal - discount);
  const companyTotal = r2(installation.company + print.company + cutout.company);
  const contractExpense = r2(installation.contractExpense + print.contractExpense);
  const taskCost = r2(companyTotal - contractExpense);
  const profit = r2(customerTotal - taskCost);
  return {
    installation, print, cutout, customerSubtotal, discount, customerTotal, companyTotal,
    contractExpense, taskCost, profit, margin: customerTotal > 0 ? r2((profit / customerTotal) * 100) : 0,
  };
}

/** ملخص عملية من القيم المحفوظة في composite_tasks (للقائمة) بنفس قاعدة الشمول */
export function summarizeStored(
  rows: Array<{ customer_installation_cost?: any; company_installation_cost?: any; customer_print_cost?: any; company_print_cost?: any; customer_cutout_cost?: any; company_cutout_cost?: any; discount_amount?: any; paid_amount?: any }>,
  type: OperationType,
  includesInstallation: boolean,
  includesPrint: boolean,
) {
  const sum = (k: string) => rows.reduce((s, r: any) => s + pos(r[k]), 0);
  const instIncluded = isIncluded(type, includesInstallation);
  const printIncluded = isIncluded(type, includesPrint);
  const customerSubtotal = (instIncluded ? 0 : sum('customer_installation_cost')) + (printIncluded ? 0 : sum('customer_print_cost')) + sum('customer_cutout_cost');
  const discount = Math.min(sum('discount_amount'), customerSubtotal);
  const customerTotal = r2(customerSubtotal - discount);
  const companyTotal = r2(sum('company_installation_cost') + sum('company_print_cost') + sum('company_cutout_cost'));
  const contractExpense = r2((instIncluded ? sum('company_installation_cost') : 0) + (printIncluded ? sum('company_print_cost') : 0));
  const taskCost = r2(companyTotal - contractExpense);
  const paid = r2(sum('paid_amount'));
  return {
    customerTotal, companyTotal, contractExpense, taskCost,
    profit: r2(customerTotal - taskCost),
    paid, remaining: r2(Math.max(0, customerTotal - paid)),
    instIncluded, printIncluded,
  };
}

/** مساحة الوجه من جدول المقاسات أو من نص المقاس مثل 12x4 */
export function faceAreaFromSize(size: string | null | undefined, sizes: Record<string, { width?: any; height?: any }>): number {
  const name = String(size || '').trim();
  const s = sizes[name] || sizes[name.toLowerCase()];
  const w = Number(s?.width), h = Number(s?.height);
  if (w > 0 && h > 0) return r2(w * h);
  const m = name.match(/(\d+(?:\.\d+)?)\s*[xX×*]\s*(\d+(?:\.\d+)?)/);
  return m ? r2(parseFloat(m[1]) * parseFloat(m[2])) : 0;
}

export type BulkTarget = 'customer' | 'company';
export type BulkMode = 'piece' | 'meter';

/** تسعير جماعي واضح: سعر للوحة (للمزدوجة ونصفه للوجه الواحد) أو للمتر، على الزبون أو الشركة، لمجموعة لوحات محددة */
export function applyBulkPrice(lines: CostLine[], ids: Set<string>, target: BulkTarget, mode: BulkMode, value: number): CostLine[] {
  const v = pos(value);
  return lines.map(l => {
    if (!ids.has(l.id)) return l;
    const faces = Math.max(1, Number(l.faces) || 1);
    const price = mode === 'meter' ? r2(v * lineArea(l)) : r2((v / 2) * faces);
    return target === 'customer' ? { ...l, customer: price } : { ...l, company: price, companyPerMeter: mode === 'meter' ? v : null };
  });
}

/** خطوة تقريب «مسكرة» حسب حجم المبلغ لكل لوحة */
export const niceStep = (avg: number) => (avg < 200 ? 5 : avg < 1000 ? 10 : avg < 10000 ? 50 : 100);

/**
 * موزع ذكي: يوزّع مبلغاً إجمالياً على اللوحات بنسبة مساحة كل لوحة،
 * بأرقام مقرّبة (5/10/50/100) ومجموعها يساوي الإجمالي تماماً (الفرق يُضاف لأكبر لوحة).
 */
export function smartDistribute(total: number, weights: { id: string; weight: number }[]): Map<string, number> {
  const out = new Map<string, number>();
  const T = pos(total);
  if (!weights.length) return out;
  const W = weights.reduce((s, w) => s + pos(w.weight), 0);
  const norm = W > 0 ? weights.map(w => ({ id: w.id, weight: pos(w.weight) })) : weights.map(w => ({ id: w.id, weight: 1 }));
  const sumW = norm.reduce((s, w) => s + w.weight, 0);
  const step = niceStep(T / norm.length);
  let assigned = 0;
  norm.forEach(w => {
    const v = Math.round(((T * w.weight) / sumW) / step) * step;
    out.set(w.id, v);
    assigned += v;
  });
  const diff = r2(T - assigned);
  if (diff !== 0) {
    const biggest = [...norm].sort((a, b) => b.weight - a.weight)[0];
    out.set(biggest.id, r2(Math.max(0, (out.get(biggest.id) || 0) + diff)));
  }
  return out;
}

/**
 * دمج صفوف أوامر العمل (صف لكل فرقة) في عملية واحدة: فاتورة واحدة وقيد واحد للزبون.
 * الحقول المالية تُجمع، والهوية للمهمة الأقدم، و operation_task_ids يحمل كل الصفوف.
 */
const MONEY_FIELDS = [
  'customer_installation_cost', 'company_installation_cost', 'customer_print_cost', 'company_print_cost',
  'customer_cutout_cost', 'company_cutout_cost', 'discount_amount', 'customer_total', 'company_total',
  'net_profit', 'paid_amount', 'total_cost', 'installation_cost', 'print_cost', 'cutout_cost',
];
export function mergeCompositeOperations<T extends Record<string, any>>(tasks: T[], keyOf: (t: T) => string): (T & { operation_task_ids: string[] })[] {
  const groups = new Map<string, T[]>();
  for (const t of tasks) {
    const k = keyOf(t);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  }
  return [...groups.values()].map(list => {
    const sorted = [...list].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
    const merged: any = { ...sorted[0], operation_task_ids: sorted.map(t => t.id) };
    if (sorted.length > 1) {
      for (const f of MONEY_FIELDS) {
        if (sorted.some(t => t[f] !== undefined && t[f] !== null)) merged[f] = r2(sorted.reduce((s, t) => s + (Number(t[f]) || 0), 0));
      }
      merged.print_task_id = sorted.find(t => t.print_task_id)?.print_task_id ?? null;
      merged.cutout_task_id = sorted.find(t => t.cutout_task_id)?.cutout_task_id ?? null;
      merged.notes = sorted.map(t => t.notes).filter(Boolean).join(' | ') || null;
    }
    return merged;
  });
}

/**
 * مفتاح العملية الموحد (الصفحة وكشف الحساب):
 * - إعادة التركيب: العقد الرئيسي + رقم الإعادة، مهما اختلفت عقود كل فرقة.
 * - عملية مسجلة الهوية: هويتها.
 * - تركيب أول لعدة عقود بلا هوية: العقد الرئيسي + وقت الإنشاء (نافذة 10 دقائق).
 * - غير ذلك: التجميع المعتاد.
 */
export function operationKeyOf(t: any, operationId?: string | null): string {
  const reNum = Number(t.reinstallationNumber ?? t.reinstallation_number);
  const primary = t.contract_id ?? 'none';
  if (t.task_type === 'reinstallation' && reNum > 0) return `c:${primary}:re:${reNum}`;
  if (operationId) return `operation:${operationId}`;
  const ids = new Set([t.contract_id, ...((t.contract_ids || t.contractIds || []) as any[])].map(Number).filter(Boolean));
  if (ids.size > 1) return `c:${primary}:inst-multi:${String(t.created_at || '').slice(0, 15)}`;
  return getCompositeTaskOperationKey(t);
}
