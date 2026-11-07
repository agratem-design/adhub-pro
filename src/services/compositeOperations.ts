import { selectInstallationColumns, updateInstallationItemCompat } from './installationSchemaCompatibility';
import { getBillboardDimensions } from '@/lib/billboardDimensions';
import { getFaceDimensions, normalizeSelectedFaces } from '@/lib/billboardFaces';
import { supabase } from '@/integrations/supabase/client';
import { loadInstallationOperationIds } from '@/services/installationOperation';
import { getCompositeTaskOperationKey, getOperationLabel, normalizeCompositeTaskType } from '@/lib/compositeTaskOperation';
import { resolveInstallationFacesCount, getAvailableFacesCount } from '@/lib/installationFaces';
import { operationKeyOf, computeOperation, lineArea, linePrintRate, faceAreaFromSize, r2, summarizeStored, type CostLine, type OperationDraft, type OperationType } from '@/lib/compositeCosts';
import { defaultPrinterId } from '@/services/operationsInventory';
import { getBillboardsSortMaps, sortBillboardsStandardSync } from '@/lib/billboardSorter';

const chunk = <T,>(arr: T[], n = 100): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};
const flag = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1';

async function inChunks<T = any>(table: string, select: string, column: string, values: any[], extra?: (q: any) => any): Promise<T[]> {
  const uniq = [...new Set(values.filter(v => v !== null && v !== undefined))];
  if (!uniq.length) return [];
  const parts = await Promise.all(chunk(uniq).map(async ids => {
    const rows: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await selectInstallationColumns<{ data: any[] | null; error: any }>(select, selection => {
        let q = (supabase.from(table as any) as any).select(selection).in(column, ids).range(from, from + 999);
        if (extra) q = extra(q);
        return q;
      });
      if (error) throw new Error(`${table}: ${error.message}`);
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return rows;
  }));
  return parts.flat() as T[];
}

export interface ContractInfo {
  number: number;
  customerName: string | null;
  adType: string | null;
  start: string | null;
  end: string | null;
  includesInstallation: boolean;
  includesPrint: boolean;
  installationValue: number;
  printValue: number;
}

export interface OperationRow {
  key: string;
  label: string;
  type: OperationType;
  customerId: string | null;
  customerName: string;
  contractIds: number[];
  contracts: ContractInfo[];
  adTypes: string[];
  tasks: any[];
  teams: string[];
  createdAt: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  boards: number;
  boardsDone: number;
  /** صور التركيب الفعلية لكل لوحات العملية (وجه أمامي ثم خلفي) */
  installedPhotos: string[];
  hasPrint: boolean;
  hasCutout: boolean;
  money: ReturnType<typeof summarizeStored>;
}

export async function loadOperations(): Promise<OperationRow[]> {
  const tasks: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('composite_tasks').select('*').order('created_at', { ascending: false }).range(from, from + 999);
    if (error) throw new Error(error.message);
    tasks.push(...(data || []));
    if (!data || data.length < 1000) break;
  }

  const installIds = tasks.map(t => t.installation_task_id).filter(Boolean);
  const [installs, items, operationIds] = await Promise.all([
    inChunks('installation_tasks', 'id, task_type, reinstallation_number, contract_id, contract_ids, status, task_name, team_id, installation_teams(team_name)', 'id', installIds),
    inChunks('installation_task_items', 'task_id, status, installed_image_face_a_url, installed_image_face_b_url', 'task_id', installIds, q => q.neq('status', 'replaced')),
    loadInstallationOperationIds().catch(() => ({} as Record<string, string>)),
  ]);
  const installMap = new Map(installs.map((i: any) => [i.id, i]));
  const counts = new Map<string, { total: number; done: number }>();
  const photosByTask = new Map<string, string[]>();
  items.forEach((i: any) => {
    const c = counts.get(i.task_id) || { total: 0, done: 0 };
    c.total += 1;
    if (i.status === 'completed') c.done += 1;
    counts.set(i.task_id, c);
    const photos = [i.installed_image_face_a_url, i.installed_image_face_b_url].filter((u: any): u is string => !!u);
    if (photos.length) photosByTask.set(i.task_id, [...(photosByTask.get(i.task_id) || []), ...photos]);
  });

  const enriched = tasks.map(t => {
    const it: any = t.installation_task_id ? installMap.get(t.installation_task_id) : null;
    const contractIds = [...new Set([t.contract_id, it?.contract_id, ...((it?.contract_ids as number[]) || [])].map(Number).filter(Boolean))].sort((a, b) => a - b);
    return {
      ...t,
      task_type: normalizeCompositeTaskType(it?.task_type ?? t.task_type),
      contract_ids: contractIds,
      contractIds,
      reinstallationNumber: it?.reinstallation_number ?? null,
      teamName: it?.installation_teams?.team_name || 'بدون فرقة',
      installationStatus: it?.status || null,
      installationTaskName: it?.task_name || null,
      // اسم المهمة يحمل عنوان الملحق وسبب التبديل لعرضه في عنوان البطاقة
      task_name: it?.task_name ?? t.task_name ?? null,
    };
  });

  const allContractNums = [...new Set(enriched.flatMap(t => t.contractIds))];
  const contractsRaw = await inChunks('Contract', '"Contract_Number", "Customer Name", "Ad Type", "Contract Date", "End Date", include_installation_in_price, include_print_in_billboard_price, installation_enabled, print_cost_enabled, installation_cost, print_cost', 'Contract_Number', allContractNums);
  const contractMap = new Map<number, ContractInfo>(contractsRaw.map((c: any) => [Number(c.Contract_Number), {
    number: Number(c.Contract_Number),
    customerName: c['Customer Name'] ?? null,
    adType: c['Ad Type'] ?? null,
    start: c['Contract Date'] ?? null,
    end: c['End Date'] ?? null,
    // التركيب الأول جزء من العقد (إلا إذا أُلغي التركيب في العقد صراحة)
    includesInstallation: flag(c.include_installation_in_price) || c.installation_enabled !== false,
    // الطباعة مشمولة إذا كانت ضمن سعر اللوحة أو مفعّلة في العقد (تكلفتها مضافة لقيمة العقد)
    includesPrint: flag(c.include_print_in_billboard_price) || flag(c.print_cost_enabled),
    installationValue: Number(c.installation_cost) || 0,
    printValue: Number(c.print_cost) || 0,
  }]));

  const groups = new Map<string, any[]>();
  enriched.forEach(t => {
    // العملية التي أُنشئت مرة واحدة (كل فرقها وعقودها) = عملية واحدة وفاتورة واحدة
    const opId = t.installation_task_id ? operationIds[t.installation_task_id] : null;
    const k = operationKeyOf(t, opId);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  });

  const rows: OperationRow[] = [];
  groups.forEach((list, key) => {
    list.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const first = list[0];
    const type = normalizeCompositeTaskType(first.task_type);
    const contractIds = [...new Set(list.flatMap(t => t.contractIds))].sort((a, b) => a - b);
    const contracts = contractIds.map(n => contractMap.get(n)).filter(Boolean) as ContractInfo[];
    // الشمول يُطبَّق فقط إذا كانت كل عقود العملية تشمل الخدمة
    const incI = contracts.length > 0 && contracts.every(c => c.includesInstallation);
    const incP = contracts.length > 0 && contracts.every(c => c.includesPrint);
    let boards = 0, boardsDone = 0;
    list.forEach(t => { const c = counts.get(t.installation_task_id); if (c) { boards += c.total; boardsDone += c.done; } });
    // فرقة فارغة (نُقلت لوحاتها لفرقة أخرى) لا تُبقي العملية «قيد التنفيذ»
    const hasBoards = (t: any) => (counts.get(t.installation_task_id)?.total || 0) > 0;
    const active = boards > 0 ? list.filter(hasBoards) : list;
    const statuses = active.map(t => {
      const c = counts.get(t.installation_task_id);
      if (c && c.total > 0) return c.done === c.total ? 'completed' : c.done > 0 ? 'in_progress' : (t.installationStatus || t.status);
      return t.installationStatus || t.status;
    });
    const status: OperationRow['status'] = boards > 0 && boardsDone === boards ? 'completed'
      : statuses.every(s => s === 'completed') ? 'completed'
      : statuses.every(s => s === 'cancelled') ? 'cancelled'
      : statuses.some(s => s === 'in_progress' || s === 'completed') || boardsDone > 0 ? 'in_progress' : 'pending';
    rows.push({
      key,
      label: getOperationLabel(first),
      type,
      customerId: first.customer_id,
      customerName: first.customer_name || contracts[0]?.customerName || '—',
      contractIds,
      contracts,
      adTypes: [...new Set(contracts.map(c => c.adType).filter(Boolean) as string[])],
      tasks: list,
      teams: [...new Set(active.map(t => t.teamName))],
      createdAt: first.created_at,
      status,
      boards,
      boardsDone,
      installedPhotos: list.flatMap(t => photosByTask.get(t.installation_task_id) || []),
      hasPrint: list.some(t => t.print_task_id) || list.some(t => Number(t.customer_print_cost) > 0 || Number(t.company_print_cost) > 0),
      hasCutout: list.some(t => t.cutout_task_id) || list.some(t => Number(t.company_cutout_cost) > 0),
      money: summarizeStored(list, type, incI, incP),
    });
  });
  rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return rows;
}

/* ───────────── محرر التكاليف ───────────── */

export interface EditorLine extends CostLine {
  teamName: string;
  name: string;
  size: string;
  image: string | null;
  landmark: string | null;
  area: string | null;
  municipality: string | null;
  sizeInstallPrice: number;
  tableFullPrice?: number;
  maxFaces: number;
  faceLabels?: string[];
  faceInstallPrices?: number[];
  contractNumber: number | null;
  /** سعر متر التركيب على الزبون الذي حُسب به سعر اللوحة (null = سعر مقطوع) */
  customerPerMeter: number | null;
}

export interface EditorState {
  op: OperationRow;
  primaryTaskId: string;
  printTaskId: string | null;
  printerId: string | null;
  printers: { id: string; name: string }[];
  draft: OperationDraft;
  lines: EditorLine[];
  discountReason: string;
  /** طريقة الخصم المحفوظة في cost_allocation: مبلغ ثابت أو نسبة من إجمالي الزبون */
  discountMode: DiscountMode;
  discountPercent: number;
  notes: string;
  /** أسعار الزبون في آخر عملية سابقة له (اقتراح افتراضي) */
  suggested: { installPerMeter: number; printPerMeter: number };
  /** قيمة الخدمات المشمولة كما سُجلت في العقد (للعرض فقط) */
  contractValues: { installation: number; print: number };
}

export type DiscountMode = 'amount' | 'percent';
/** مبلغ الخصم الفعلي حسب الطريقة (النسبة تُحسب من إجمالي الزبون قبل الخصم) */
export const discountAmount = (mode: DiscountMode, amount: number, percent: number, subtotal: number) =>
  mode === 'percent' ? r2(Math.max(0, subtotal) * Math.min(100, Math.max(0, Number(percent) || 0)) / 100) : Math.max(0, Number(amount) || 0);

const parseIds = (s: unknown) => String(s || '').split(/[^0-9]+/).map(Number).filter(Boolean);

export async function loadEditor(op: OperationRow): Promise<EditorState> {
  const tasks = op.tasks;
  const primary = tasks.find(t => t.print_task_id) || tasks.find(t => t.cutout_task_id) || tasks[0];
  const installIds = tasks.map(t => t.installation_task_id).filter(Boolean);
  const teamByTask = new Map(tasks.map(t => [t.installation_task_id, t.teamName]));

  const [items, sizesR, printersR, printTaskR, contractsR] = await Promise.all([
    inChunks('installation_task_items',
      'id, task_id, billboard_id, status, customer_installation_cost, customer_reinstall_cost, price_per_meter, pricing_type, company_installation_price_per_meter, company_installation_cost, additional_cost, company_additional_cost, faces_to_install, selected_faces, reinstalled_faces, has_cutout, cutout_count, cutout_customer_cost, cutout_company_cost, design_face_a, design_face_b, installed_image_face_a_url',
      'task_id', installIds, q => q.neq('status', 'replaced')),
    supabase.from('sizes').select('name, width, height, installation_price'),
    supabase.from('printers').select('id, name').eq('is_active', true).order('name'),
    primary.print_task_id
      ? supabase.from('print_tasks').select('id, printer_id, price_per_meter, customer_price_per_meter, total_area').eq('id', primary.print_task_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from('Contract').select('"Contract_Number", billboard_ids').in('Contract_Number', op.contractIds.length ? op.contractIds : [-1]),
  ]);

  const billboardIds = [...new Set(items.map((i: any) => Number(i.billboard_id)))];
  const [billboards, printItems] = await Promise.all([
    inChunks('billboards', '"ID", "Billboard_Name", "Size", "Level", "Faces_Count", face_dimensions, "Image_URL", "Nearest_Landmark", "District", "City", "Municipality"', 'ID', billboardIds),
    primary.print_task_id ? inChunks('print_task_items', 'billboard_id, area, unit_cost, customer_unit_cost', 'task_id', [primary.print_task_id]) : Promise.resolve([]),
  ]);
  const bMap = new Map(billboards.map((b: any) => [Number(b.ID), b]));
  const sizes: Record<string, any> = {};
  (sizesR.data || []).forEach((s: any) => { sizes[s.name] = s; sizes[String(s.name).toLowerCase()] = s; });
  const printSet = new Set((printItems as any[]).map(p => Number(p.billboard_id)));
  const hasPrintTask = !!primary.print_task_id;
  // سعر متر الطباعة لكل لوحة كما حُفظ في بنود الطباعة؛ يُعتبر خاصاً باللوحة فقط إذا اختلف عن السعر العام
  const ptRow: any = printTaskR.data;
  const defPrintCust = Number(ptRow?.customer_price_per_meter) || 0;
  const defPrintComp = Number(ptRow?.price_per_meter) || 0;
  const printRates = new Map<number, { customer: number | null; company: number | null }>();
  (printItems as any[]).forEach(p => {
    const a = Number(p.area) || 0;
    if (a <= 0) return;
    const cust = r2((Number(p.customer_unit_cost) || 0) / a);
    const comp = r2((Number(p.unit_cost) || 0) / a);
    printRates.set(Number(p.billboard_id), {
      customer: Math.abs(cust - defPrintCust) > 0.01 ? cust : null,
      company: Math.abs(comp - defPrintComp) > 0.01 ? comp : null,
    });
  });
  const contractOfBoard = new Map<number, number>();
  (contractsR.data || []).forEach((c: any) => parseIds(c.billboard_ids).forEach(id => { if (!contractOfBoard.has(id)) contractOfBoard.set(id, Number(c.Contract_Number)); }));

  const isRe = op.type === 'reinstallation';
  const unsorted: EditorLine[] = items.map((i: any) => {
    const b: any = bMap.get(Number(i.billboard_id)) || {};
    const faces = resolveInstallationFacesCount({ faces_to_install: i.faces_to_install, reinstalled_faces: i.reinstalled_faces, selected_faces: i.selected_faces, billboard: b }, b, op.type);
    const sizeKey = String(b.Size || '').trim();
    const swapped = sizeKey.replace(/^(\d+(?:\.\d+)?)\s*[xX×*]\s*(\d+(?:\.\d+)?)/, '$2x$1');
    const sizeRow = sizes[sizeKey] || sizes[sizeKey.toLowerCase()] || sizes[swapped] || sizes[swapped.toLowerCase()];
    const tableFull = Number(sizeRow?.installation_price) || 0;
    const maxFaces = getAvailableFacesCount(b);
    const dimensions = getFaceDimensions(b, maxFaces, { width: Number(sizeRow?.width) || getBillboardDimensions(b).width, height: Number(sizeRow?.height) || getBillboardDimensions(b).height });
    const explicit = normalizeSelectedFaces(i.selected_faces, maxFaces);
    const selectedFaces = explicit.length ? explicit : faces === 1 && i.reinstalled_faces === 'face_b' && maxFaces >= 2 ? [2] : Array.from({ length: faces }, (_, index) => index + 1);
    const faceInstallPrices = dimensions.map((d, index) => {
      if (!b.face_dimensions?.[index]?.width) return tableFull / 2;
      const match: any = (sizesR.data || []).find((s: any) => (Number(s.width) === d.width && Number(s.height) === d.height) || (Number(s.width) === d.height && Number(s.height) === d.width));
      // A custom size without a price row inherits the base price per square metre.
      return match ? (Number(match.installation_price) || 0) / 2 : (tableFull / 2) * (d.width * d.height) / (faceAreaFromSize(b.Size, sizes) || 1);
    });
    const tableSelected = r2(selectedFaces.reduce((sum, face) => sum + faceInstallPrices[face - 1], 0));
    // مشغّل القاعدة يصفّر customer_reinstall_cost عند كل حفظ إذا reinstall_count = 0،
    // والحفظ يكتب السعر في الحقلين؛ لذلك 0 هنا لا يعني «بلا سعر»
    const customer = isRe ? (Number(i.customer_reinstall_cost) || Number(i.customer_installation_cost) || 0) : i.customer_installation_cost;
    return {
      id: i.id,
      taskId: i.task_id,
      teamName: teamByTask.get(i.task_id) || '—',
      billboardId: Number(i.billboard_id),
      name: b.Billboard_Name || `لوحة ${i.billboard_id}`,
      size: b.Size || '—',
      // الصورة الواقعية للوحة أولاً، ثم صورة التركيب، ثم التصميم
      image: b.Image_URL || i.installed_image_face_a_url || i.design_face_a || i.design_face_b || null,
      landmark: b.Nearest_Landmark || null,
      area: b.District || b.City || null,
      municipality: b.Municipality || null,
      faceArea: faceAreaFromSize(b.Size, sizes),
      faces,
      selectedFaces,
      faceAreas: dimensions.map(d => d.width * d.height),
      faceLabels: dimensions.map(d => `${d.width} × ${d.height}`),
      faceInstallPrices,
      maxFaces: getAvailableFacesCount(b),
      tableFullPrice: tableFull,
      sizeInstallPrice: tableSelected,
      customer: Number(customer) || 0,
      company: i.company_installation_cost === null || i.company_installation_cost === undefined ? tableSelected : Number(i.company_installation_cost) || 0,
      customerExtra: Number(i.additional_cost) || 0,
      companyPerMeter: i.company_installation_price_per_meter ?? null,
      companyExtra: Number(i.company_additional_cost) || 0,
      inPrint: hasPrintTask ? printSet.has(Number(i.billboard_id)) : true,
      printCustomerPerMeter: printRates.get(Number(i.billboard_id))?.customer ?? null,
      printCompanyPerMeter: printRates.get(Number(i.billboard_id))?.company ?? null,
      hasCutout: !!i.has_cutout,
      cutoutCount: Number(i.cutout_count) || 1,
      cutoutCustomerUnit: Number(i.cutout_customer_cost) || 0,
      cutoutCompanyUnit: Number(i.cutout_company_cost) || 0,
      contractNumber: contractOfBoard.get(Number(i.billboard_id)) ?? (op.contractIds.length === 1 ? op.contractIds[0] : null),
      customerPerMeter: i.pricing_type === 'meter' && Number(i.price_per_meter) > 0 && Number(customer) > 0 ? Number(i.price_per_meter) : null,
    };
  });

  // الترتيب الموحد: ترتيب المقاس في الإعدادات ← المستوى ← البلدية
  await getBillboardsSortMaps();
  const lines = sortBillboardsStandardSync(unsorted.map(line => {
    const b: any = bMap.get(line.billboardId) || {};
    return { line, Size: b.Size, Level: b.Level, Municipality: b.Municipality, City: b.City, ID: line.billboardId, Billboard_Name: line.name };
  })).map(w => w.line);

  const pt: any = printTaskR.data;
  const suggested = await loadCustomerSuggestedPrices(op, sizes);
  const storedPrintCustomer = tasks.reduce((s, t) => s + (Number(t.customer_print_cost) || 0), 0);
  const storedPrintCompany = tasks.reduce((s, t) => s + (Number(t.company_print_cost) || 0), 0);
  const incI = op.money.instIncluded || (op.contracts.length > 0 && op.contracts.every(c => c.includesInstallation));
  const incP = op.contracts.length > 0 && op.contracts.every(c => c.includesPrint);

  return {
    op,
    primaryTaskId: primary.id,
    printTaskId: primary.print_task_id || null,
    printerId: pt?.printer_id || defaultPrinterId((printersR.data || []) as { id: string; name: string }[]),
    printers: (printersR.data || []) as any,
    lines,
    discountReason: primary.discount_reason || '',
    discountMode: primary.cost_allocation?.discount_mode === 'percent' ? 'percent' : 'amount',
    discountPercent: Number(primary.cost_allocation?.discount_percent) || 0,
    notes: primary.notes || '',
    suggested,
    contractValues: {
      installation: op.contracts.reduce((s, c) => s + c.installationValue, 0),
      print: op.contracts.reduce((s, c) => s + c.printValue, 0),
    },
    draft: {
      type: op.type,
      contractIncludesInstallation: incI,
      contractIncludesPrint: incP,
      lines,
      // الطباعة المشمولة بالعقد تظهر مفعّلة دائماً في التركيب الأول
      printEnabled: hasPrintTask || storedPrintCustomer > 0 || storedPrintCompany > 0 || (op.type === 'new_installation' && incP),
      printCustomerPerMeter: Number(pt?.customer_price_per_meter) || 0,
      printCompanyPerMeter: Number(pt?.price_per_meter) || 0,
      discount: tasks.reduce((s, t) => s + (Number(t.discount_amount) || 0), 0),
    },
  };
}

/**
 * حفظ واحد مرتب: البنود ← الطباعة ← صفوف أمر العمل (الأخيرة تكتب القيم النهائية
 * فتتغلب على أي إعادة احتساب من مشغلات القاعدة).
 */
export async function saveEditor(state: EditorState, lines: EditorLine[], draft: OperationDraft, extra: { discountReason: string; notes: string; printerId: string | null; discountMode?: DiscountMode; discountPercent?: number }) {
  const { op } = state;
  const totals = computeOperation({ ...draft, lines });
  const instIncluded = totals.installation.included;
  const isRe = op.type === 'reinstallation';
  const now = new Date().toISOString();
  const original = new Map(state.lines.map(l => [l.id, l]));

  // 1) بنود التركيب — فقط ما تغيّر
  const changed = lines.filter(l => {
    const o = original.get(l.id);
    return !o || o.customer !== l.customer || o.company !== l.company || o.customerExtra !== l.customerExtra || o.companyExtra !== l.companyExtra
      || o.hasCutout !== l.hasCutout || o.cutoutCount !== l.cutoutCount || o.cutoutCustomerUnit !== l.cutoutCustomerUnit || o.cutoutCompanyUnit !== l.cutoutCompanyUnit
      || o.customerPerMeter !== l.customerPerMeter || o.companyPerMeter !== l.companyPerMeter
      || o.faces !== l.faces || JSON.stringify(o.selectedFaces) !== JSON.stringify(l.selectedFaces)
      || (instIncluded && o.customer !== 0);
  });
  for (const part of chunk(changed, 15)) {
    const results = await Promise.all(part.map(l => {
      const customer = instIncluded ? 0 : r2(l.customer);
      const patch: any = {
        faces_to_install: l.faces,
        selected_faces: l.selectedFaces,
        reinstalled_faces: l.faces === 1 ? (l.selectedFaces?.[0] === 2 ? 'face_b' : 'face_a') : 'both',
        company_installation_cost: r2(l.company),
        company_installation_price_per_meter: l.companyPerMeter ?? null,
        price_per_meter: !instIncluded && l.customerPerMeter ? r2(l.customerPerMeter) : null,
        pricing_type: !instIncluded && l.customerPerMeter ? 'meter' : 'piece',
        additional_cost: r2(l.customerExtra) || null,
        company_additional_cost: r2(l.companyExtra) || null,
        has_cutout: l.hasCutout,
        cutout_count: l.hasCutout ? Math.max(1, Math.round(l.cutoutCount)) : null,
        cutout_customer_cost: l.hasCutout ? r2(l.cutoutCustomerUnit) : null,
        cutout_company_cost: l.hasCutout ? r2(l.cutoutCompanyUnit) : null,
      };
      if (isRe) { patch.customer_reinstall_cost = customer; patch.customer_installation_cost = customer; }
      else patch.customer_installation_cost = customer;
      return updateInstallationItemCompat(l.id, patch);
    }));
    const failed = results.find(r => r.error);
    if (failed?.error) throw new Error(`بنود التركيب: ${failed.error.message}`);
  }

  // 2) الطباعة
  let printTaskId = state.printTaskId;
  const primary = op.tasks.find(t => t.id === state.primaryTaskId)!;
  // لا تُنشأ مهمة طباعة فارغة (مشمولة بلا تكلفة مطبعة بعد)
  if (draft.printEnabled && (printTaskId || totals.print.company > 0 || totals.print.customer > 0)) {
    const printPayload: any = {
      printer_id: extra.printerId || null,
      price_per_meter: r2(draft.printCompanyPerMeter),
      customer_price_per_meter: totals.print.included ? 0 : r2(draft.printCustomerPerMeter),
      total_area: totals.print.area,
      total_cost: totals.print.company,
      printer_total_cost: totals.print.company,
      customer_total_amount: totals.print.customer,
      updated_at: now,
    };
    if (!printTaskId) {
      const { data, error } = await supabase.from('print_tasks').insert({
        ...printPayload,
        contract_id: primary.contract_id,
        customer_id: primary.customer_id,
        customer_name: primary.customer_name,
        installation_task_id: primary.installation_task_id || null,
        composite_task_id: primary.id,
        is_composite: true,
        status: 'pending',
      } as any).select('id').single();
      if (error) throw new Error(`مهمة الطباعة: ${error.message}`);
      printTaskId = data.id;
      const link = await supabase.from('composite_tasks').update({ print_task_id: printTaskId } as any).eq('id', primary.id);
      if (link.error) throw new Error(link.error.message);
    } else {
      const { error } = await supabase.from('print_tasks').update(printPayload).eq('id', printTaskId);
      if (error) throw new Error(`مهمة الطباعة: ${error.message}`);
    }

    // مزامنة لوحات الطباعة بالفرق فقط (لا حذف وإعادة إدخال للكل)
    const { data: existing, error: exErr } = await supabase.from('print_task_items').select('id, billboard_id').eq('task_id', printTaskId!);
    if (exErr) throw new Error(exErr.message);
    const wanted = new Map(lines.filter(l => l.inPrint).map(l => [l.billboardId, l]));
    const existingIds = new Set((existing || []).map((e: any) => Number(e.billboard_id)));
    const toDelete = (existing || []).filter((e: any) => !wanted.has(Number(e.billboard_id))).map((e: any) => e.id);
    const toInsert = [...wanted.values()].filter(l => !existingIds.has(l.billboardId));
    if (toDelete.length) {
      const { error } = await supabase.from('print_task_items').delete().in('id', toDelete);
      if (error) throw new Error(error.message);
    }
    const itemRow = (l: EditorLine) => {
      const area = r2(lineArea(l));
      const compRate = linePrintRate(l, draft, 'company');
      const custRate = linePrintRate(l, draft, 'customer');
      return {
        description: (l.selectedFaces || Array.from({ length: l.faces }, (_, i) => i + 1)).map(face => `وجه ${face}: ${l.faceLabels?.[face - 1] || l.size} م`).join('، '),
        area,
        faces_count: l.faces,
        unit_cost: r2(area * compRate),
        printer_unit_cost: r2(area * compRate),
        total_cost: r2(area * compRate),
        customer_unit_cost: totals.print.included ? 0 : r2(area * custRate),
      };
    };
    if (toInsert.length) {
      const { error } = await supabase.from('print_task_items').insert(toInsert.map(l => ({
        task_id: printTaskId, billboard_id: l.billboardId, description: `${l.size} - ${l.faces === 1 ? 'وجه واحد' : l.faces === 2 ? 'وجهين' : `${l.faces} أوجه`}`,
        quantity: 1, status: 'pending', design_face_a: l.image, ...itemRow(l),
      })) as any);
      if (error) throw new Error(error.message);
    }
    const keep = (existing || []).filter((e: any) => wanted.has(Number(e.billboard_id)));
    for (const part of chunk(keep, 15)) {
      const results = await Promise.all(part.map((e: any) => supabase.from('print_task_items').update(itemRow(wanted.get(Number(e.billboard_id))!) as any).eq('id', e.id)));
      const failed = results.find(result => result.error);
      if (failed?.error) throw new Error(`بنود الطباعة: ${failed.error.message}`);
    }
  } else if (printTaskId) {
    const { error } = await supabase.from('print_tasks').update({ total_cost: 0, printer_total_cost: 0, customer_total_amount: 0, updated_at: now } as any).eq('id', printTaskId);
    if (error) throw new Error(error.message);
  }

  // 3) صفوف أمر العمل: التركيب لكل فرقة، والمشترك (طباعة/قص/خصم) على المهمة الرئيسية فقط
  const contractExpense = totals.contractExpense;
  for (const t of op.tasks) {
    const own = lines.filter(l => l.taskId === t.installation_task_id);
    const isPrimary = t.id === state.primaryTaskId;
    const custInst = instIncluded ? own.reduce((s, l) => s + l.customerExtra, 0) : own.reduce((s, l) => s + l.customer + l.customerExtra, 0);
    const compInst = own.reduce((s, l) => s + l.company + l.companyExtra, 0);
    const custCut = own.filter(l => l.hasCutout).reduce((s, l) => s + Math.max(1, Math.round(l.cutoutCount)) * l.cutoutCustomerUnit, 0);
    const compCut = own.filter(l => l.hasCutout).reduce((s, l) => s + Math.max(1, Math.round(l.cutoutCount)) * l.cutoutCompanyUnit, 0);
    const patch: any = {
      customer_installation_cost: r2(custInst),
      company_installation_cost: r2(compInst),
      customer_print_cost: isPrimary ? totals.print.customer : 0,
      company_print_cost: isPrimary ? totals.print.company : 0,
      customer_cutout_cost: r2(custCut),
      company_cutout_cost: r2(compCut),
      discount_amount: isPrimary ? totals.discount : 0,
      discount_reason: isPrimary ? (extra.discountReason.trim() || null) : null,
      notes: isPrimary ? (extra.notes.trim() || null) : t.notes,
      cost_allocation: {
        ...(t.cost_allocation || {}),
        contract_expense: isPrimary ? contractExpense : 0,
        includes: { installation: instIncluded, print: totals.print.included },
        ...(isPrimary && extra.discountMode ? { discount_mode: extra.discountMode, discount_percent: extra.discountMode === 'percent' ? r2(extra.discountPercent || 0) : null } : {}),
        updated_at: now,
      },
      updated_at: now,
    };
    const { error } = await supabase.from('composite_tasks').update(patch).eq('id', t.id);
    if (error) throw new Error(`أمر العمل: ${error.message}`);
  }
  return totals;
}

/** سعر متر التركيب والطباعة للزبون من آخر عملية سابقة له (لتسهيل الإدخال) */
async function loadCustomerSuggestedPrices(op: OperationRow, sizes: Record<string, any>) {
  const out = { installPerMeter: 0, printPerMeter: 0 };
  if (!op.customerId) return out;
  const own = new Set(op.tasks.map(t => t.id));
  const ownPrint = new Set(op.tasks.map(t => t.print_task_id).filter(Boolean));
  try {
    const [compR, printR] = await Promise.all([
      supabase.from('composite_tasks').select('id, installation_task_id, customer_installation_cost, created_at')
        .eq('customer_id', op.customerId).gt('customer_installation_cost', 0).order('created_at', { ascending: false }).limit(6),
      supabase.from('print_tasks').select('id, customer_price_per_meter, created_at')
        .eq('customer_id', op.customerId).gt('customer_price_per_meter', 0).order('created_at', { ascending: false }).limit(6),
    ]);
    const prevPrint = (printR.data || []).find((p: any) => !ownPrint.has(p.id));
    if (prevPrint) out.printPerMeter = Number(prevPrint.customer_price_per_meter) || 0;
    const prev = (compR.data || []).find((c: any) => !own.has(c.id) && c.installation_task_id);
    if (prev) {
      const { data: items } = await supabase.from('installation_task_items')
        .select('billboard_id, customer_installation_cost, customer_reinstall_cost, price_per_meter, pricing_type, faces_to_install')
        .eq('task_id', prev.installation_task_id).neq('status', 'replaced');
      const meter = (items || []).find((i: any) => i.pricing_type === 'meter' && Number(i.price_per_meter) > 0);
      if (meter) out.installPerMeter = Number(meter.price_per_meter);
      else if (items?.length) {
        const ids = items.map((i: any) => Number(i.billboard_id));
        const { data: bbs } = await supabase.from('billboards').select('"ID", "Size", "Faces_Count"').in('ID', ids);
        const bMap = new Map((bbs || []).map((b: any) => [Number(b.ID), b]));
        let money = 0, area = 0;
        items.forEach((i: any) => {
          const b: any = bMap.get(Number(i.billboard_id));
          const cost = Number(i.customer_reinstall_cost) || Number(i.customer_installation_cost) || 0;
          const a = faceAreaFromSize(b?.Size, sizes) * (Number(i.faces_to_install) || Number(b?.Faces_Count) || 1);
          if (cost > 0 && a > 0) { money += cost; area += a; }
        });
        if (area > 0) out.installPerMeter = r2(money / area);
      }
    }
  } catch { /* اقتراح فقط */ }
  return out;
}

/**
 * إعادة احتساب فاتورة العملية من الصفر بعد إضافة/إزالة/نقل لوحات.
 * اللوحات الجديدة تُسعَّر بنفس الأسعار المستخدمة في لوحات العملية:
 * نفس المقاس وعدد الأوجه ← نفس السعر حرفياً، وإلا ← سعر المتر الفعلي للعملية × المساحة.
 * ثم يُحفظ كل شيء عبر saveEditor فتُكتب إجماليات التركيب والطباعة والقص من جديد.
 */
export async function repriceOperation(op: OperationRow, newItemIds: Set<string> = new Set()) {
  const state = await loadEditor(op);
  const isNew = (l: EditorLine) => newItemIds.has(l.id);
  const priced = state.lines.filter(l => !isNew(l));
  const area = (l: EditorLine) => (l.faceArea || 0) * (l.faces || 0);
  const sizeKey = (l: EditorLine) => `${String(l.size).trim().toLowerCase()}|${l.faces}`;

  // مرجع الأسعار من اللوحات القائمة
  const bySize = new Map<string, EditorLine>();
  priced.forEach(l => { if (!bySize.has(sizeKey(l)) && (l.customer > 0 || l.company > 0)) bySize.set(sizeKey(l), l); });
  const custPriced = priced.filter(l => l.customer > 0 && area(l) > 0);
  const custArea = custPriced.reduce((s, l) => s + area(l), 0);
  const custPerMeter = custArea > 0 ? custPriced.reduce((s, l) => s + l.customer, 0) / custArea : state.suggested.installPerMeter;
  const compPriced = priced.filter(l => l.sizeInstallPrice > 0);
  const compBase = compPriced.reduce((s, l) => s + l.sizeInstallPrice, 0);
  const compRatio = compBase > 0 ? compPriced.reduce((s, l) => s + l.company, 0) / compBase : 1;
  const cutPriced = priced.filter(l => l.hasCutout && (l.cutoutCustomerUnit > 0 || l.cutoutCompanyUnit > 0));
  const avg = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
  const cutCust = avg(cutPriced.map(l => l.cutoutCustomerUnit));
  const cutComp = avg(cutPriced.map(l => l.cutoutCompanyUnit));
  const printShare = priced.length ? priced.filter(l => l.inPrint).length / priced.length : 1;

  const lines: EditorLine[] = state.lines.map(l => {
    if (!isNew(l)) return l;
    const twin = bySize.get(sizeKey(l));
    const customer = twin ? twin.customer : r2(custPerMeter * area(l));
    const company = twin ? twin.company : r2(l.sizeInstallPrice * compRatio);
    return {
      ...l,
      customer: customer || 0,
      company: company || l.company,
      cutoutCustomerUnit: l.hasCutout && !l.cutoutCustomerUnit ? r2(cutCust) : l.cutoutCustomerUnit,
      cutoutCompanyUnit: l.hasCutout && !l.cutoutCompanyUnit ? r2(cutComp) : l.cutoutCompanyUnit,
      // تُطبع اللوحة الجديدة إذا كانت طباعة العملية تشمل لوحاتها
      inPrint: state.draft.printEnabled ? printShare >= 0.5 : l.inPrint,
    };
  });

  // الأسطر الجديدة تُعتبر «متغيرة» حتى تُكتب أسعارها
  const baseline = { ...state, lines: state.lines.map(l => (isNew(l) ? { ...l, customer: -1 } : l)) };
  // الخصم بالنسبة يتبع الإجمالي الجديد بعد تغيّر اللوحات
  const subtotal = computeOperation({ ...state.draft, lines, discount: 0 }).customerSubtotal;
  const discount = discountAmount(state.discountMode, state.draft.discount, state.discountPercent, subtotal);
  const totals = await saveEditor(baseline, lines, { ...state.draft, lines, discount }, {
    discountReason: state.discountReason, notes: state.notes, printerId: state.printerId,
    discountMode: state.discountMode, discountPercent: state.discountPercent,
  });
  return { totals, added: lines.filter(isNew).length, custPerMeter: r2(custPerMeter) };
}
