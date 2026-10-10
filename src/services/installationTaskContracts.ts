import { supabase } from '@/integrations/supabase/client';
import { normalizeContractId, parseContractBillboardIds } from '@/lib/compositeTaskContractIdentity';

/** عقد داخل مهمة تركيب مع لوحاته الفعلية في المهمة */
export interface TaskContractInfo {
  contractId: number;
  adType: string;
  customerName: string;
  contractDate: string | null;
  endDate: string | null;
  billboardIds: number[];
}

export interface ContractRowLike {
  Contract_Number: number | string;
  'Customer Name'?: string | null;
  'Ad Type'?: string | null;
  'Contract Date'?: string | null;
  'End Date'?: string | null;
  billboard_ids?: string | null;
  customer_id?: string | null;
}

const day = (v?: string | null) => {
  const s = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

/**
 * توزيع لوحات المهمة على عقود الزبون.
 * أولوية: عقود المهمة المسجلة ← العقد الساري وقت إنشاء المهمة ← الأحدث تاريخاً ← الأعلى رقماً
 * (نفس قاعدة ترحيل قاعدة البيانات لمهام إعادة التركيب التاريخية).
 */
export function assignBillboardsToContracts(
  billboardIds: number[],
  contracts: ContractRowLike[],
  preferredContractIds: number[] = [],
  taskDate?: string | null,
): { byContract: Map<number, number[]>; unmatched: number[] } {
  const preferred = new Set(preferredContractIds.map(Number));
  const date = day(taskDate);
  const rows = contracts.map(c => ({
    id: Number(c.Contract_Number),
    ids: new Set(parseContractBillboardIds(c.billboard_ids)),
    start: day(c['Contract Date']),
    end: day(c['End Date']),
  }));
  const byContract = new Map<number, number[]>();
  const unmatched: number[] = [];
  for (const bb of billboardIds) {
    const candidates = rows.filter(r => r.ids.has(bb));
    if (!candidates.length) { unmatched.push(bb); continue; }
    const rank = (r: typeof rows[number]) => [
      preferred.has(r.id) ? 1 : 0,
      !date || !r.end || r.end >= date ? 1 : 0,
      !date || !r.start || r.start <= date ? 1 : 0,
      r.start || '',
      r.id,
    ] as const;
    candidates.sort((a, b) => {
      const ra = rank(a), rb = rank(b);
      for (let i = 0; i < ra.length; i++) {
        if (ra[i] !== rb[i]) return ra[i] > rb[i] ? -1 : 1;
      }
      return 0;
    });
    const chosen = candidates[0].id;
    byContract.set(chosen, [...(byContract.get(chosen) || []), bb]);
  }
  return { byContract, unmatched };
}

export function buildTaskName(opts: {
  adTypes: string[];
  customerName: string;
  taskType?: string | null;
  reinstallationNumber?: number | null;
  contractIds: number[];
}): string {
  const ads = [...new Set(opts.adTypes.map(a => String(a || '').trim()).filter(Boolean))].join(' / ');
  const typeLabel = opts.taskType === 'reinstallation'
    ? `إعادة تركيب${opts.reinstallationNumber ? ` ${opts.reinstallationNumber}` : ''}`
    : 'تركيب جديد';
  const ids = [...new Set(opts.contractIds)].sort((a, b) => a - b);
  const contractsLabel = ids.length ? `(عقد #${ids.join('، #')})` : '';
  return [ads, opts.customerName, typeLabel, contractsLabel].filter(Boolean).join(' - ');
}

/** الاسم مولَّد تلقائياً (فارغ أو ينتهي بقائمة العقود) فيجوز تحديثه */
export function isAutoTaskName(name?: string | null): boolean {
  const n = String(name || '').trim();
  return !n || /\(عقد #[\d،,\s#]+\)$/.test(n);
}

async function loadCustomerContracts(baseContractId: number | null, customerName?: string | null): Promise<ContractRowLike[]> {
  const cols = 'Contract_Number, "Customer Name", "Ad Type", "Contract Date", "End Date", billboard_ids, customer_id';
  let customerId: string | null = null;
  let name = customerName || null;
  if (baseContractId) {
    const { data } = await supabase.from('Contract').select(cols).eq('Contract_Number', baseContractId).maybeSingle();
    customerId = (data as any)?.customer_id || null;
    name = name || (data as any)?.['Customer Name'] || null;
  }
  if (customerId) {
    const { data } = await supabase.from('Contract').select(cols).eq('customer_id', customerId);
    return (data || []) as any;
  }
  if (name) {
    const { data } = await supabase.from('Contract').select(cols).eq('Customer Name', name);
    return (data || []) as any;
  }
  return [];
}

/**
 * يحدد عقود مهمة التركيب من لوحاتها الفعلية، ويحفظها في المهمة والمهمة المجمعة عند اختلافها،
 * ويحدّث الاسم إن كان مولَّداً تلقائياً. لا يلمس المهام ذات العقد الواحد التي لم تتغير.
 */
export async function syncInstallationTaskContracts(taskId: string): Promise<{
  contracts: TaskContractInfo[];
  unmatched: number[];
  changed: boolean;
}> {
  const { data: task } = await supabase
    .from('installation_tasks')
    .select('id, contract_id, contract_ids, task_name, task_type, reinstallation_number, created_at')
    .eq('id', taskId)
    .maybeSingle();
  if (!task) return { contracts: [], unmatched: [], changed: false };

  const { data: items } = await supabase.from('installation_task_items').select('billboard_id').eq('task_id', taskId);
  const billboardIds = [...new Set((items || []).map((i: any) => Number(i.billboard_id)).filter(Boolean))];
  const baseId = normalizeContractId((task as any).contract_id);
  const contracts = await loadCustomerContracts(baseId);
  const stored = [...new Set([baseId, ...(((task as any).contract_ids || []) as number[])].map(normalizeContractId).filter((x): x is number => !!x))];

  const { byContract, unmatched } = assignBillboardsToContracts(billboardIds, contracts, stored, (task as any).created_at);
  const resolvedIds = [...byContract.keys()];
  if (baseId && !resolvedIds.includes(baseId) && billboardIds.length === 0) resolvedIds.push(baseId);

  const info: TaskContractInfo[] = resolvedIds
    .map(id => {
      const c = contracts.find(x => Number(x.Contract_Number) === id);
      return {
        contractId: id,
        adType: String(c?.['Ad Type'] || ''),
        customerName: String(c?.['Customer Name'] || ''),
        contractDate: day(c?.['Contract Date']),
        endDate: day(c?.['End Date']),
        billboardIds: byContract.get(id) || [],
      };
    })
    .sort((a, b) => a.contractId - b.contractId);

  const newIds = info.map(c => c.contractId);
  const sameSet = newIds.length === stored.length && newIds.every(id => stored.includes(id));
  let changed = false;
  if (newIds.length > 1 && !sameSet) {
    const patch: Record<string, unknown> = { contract_ids: newIds };
    if (isAutoTaskName((task as any).task_name)) {
      patch.task_name = buildTaskName({
        adTypes: info.map(c => c.adType),
        customerName: info[0]?.customerName || '',
        taskType: (task as any).task_type,
        reinstallationNumber: (task as any).reinstallation_number,
        contractIds: newIds,
      });
    }
    const { error } = await supabase.from('installation_tasks').update(patch as any).eq('id', taskId);
    if (!error) {
      changed = true;
      await supabase.from('composite_tasks').update({ contract_ids: newIds } as any).eq('installation_task_id', taskId);
    }
  }
  return { contracts: info, unmatched, changed };
}
