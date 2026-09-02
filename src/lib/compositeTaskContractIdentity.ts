export const normalizeContractId = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str) return null;
  const num = Number(str);
  return Number.isFinite(num) && num > 0 ? num : null;
};

export type ContractAdTypeCandidate = {
  contractNumber: unknown;
  adType?: unknown;
  customerId?: unknown;
  customerName?: unknown;
  billboardIds?: unknown;
  contractDate?: unknown;
  includeInstallation?: boolean;
  includePrint?: boolean;
};

export const normalizeCustomerName = (value: unknown): string => String(value || '')
  .trim()
  .toLocaleLowerCase('ar')
  .replace(/[\u064B-\u065F\u0670]/g, '')
  .replace(/[أإآ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/\s+/g, ' ');

export const parseContractBillboardIds = (billboardIdsRaw: unknown): number[] => {
  if (!billboardIdsRaw) return [];
  if (Array.isArray(billboardIdsRaw)) {
    return billboardIdsRaw.map(Number).filter(n => Number.isFinite(n) && n > 0);
  }
  const str = String(billboardIdsRaw).trim();
  if (!str) return [];
  return str
    .split(',')
    .map(s => Number(s.trim()))
    .filter(n => Number.isFinite(n) && n > 0);
};

const toTimestamp = (value: unknown): number | null => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const timestamp = new Date(String(value)).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

/**
 * يطابق أرقام العقود التابعة لنفس العميل بناءً على تقاطع اللوحات مع حقل billboard_ids في العقود في التاريخ المحدد
 */
export const matchContractIdsForTaskBillboards = ({
  taskBillboardIds,
  contracts,
  taskCustomerId,
  taskCustomerName,
  fallbackContractId,
  taskDate,
}: {
  taskBillboardIds: number[];
  contracts: Array<{
    Contract_Number?: unknown;
    contractNumber?: unknown;
    billboard_ids?: unknown;
    billboardIds?: unknown;
    customer_id?: unknown;
    customerId?: unknown;
    'Customer Name'?: unknown;
    customerName?: unknown;
    'Contract Date'?: unknown;
    contractDate?: unknown;
    'Start Date'?: unknown;
    start_date?: unknown;
    'End Date'?: unknown;
    endDate?: unknown;
    end_date?: unknown;
  }>;
  taskCustomerId?: unknown;
  taskCustomerName?: unknown;
  fallbackContractId?: unknown;
  taskDate?: unknown;
}): number[] => {
  const directId = normalizeContractId(fallbackContractId);
  const matched = new Set<number>();
  if (directId) matched.add(directId);

  const normTaskId = String(taskCustomerId || '').trim();
  const normTaskName = normalizeCustomerName(taskCustomerName);

  // فلترة عقود نفس العميل فقط
  const customerContracts = contracts.filter(c => {
    const cCustId = String(c.customerId ?? c.customer_id ?? '').trim();
    if (normTaskId && cCustId) return normTaskId === cCustId;
    const cCustName = normalizeCustomerName(c.customerName ?? c['Customer Name']);
    if (normTaskName && cCustName) return normTaskName === cCustName;
    return Boolean(directId && normalizeContractId(c.contractNumber ?? c.Contract_Number) === directId);
  });

  const targetBillboardsSet = new Set(taskBillboardIds.map(Number).filter(Boolean));
  if (targetBillboardsSet.size === 0) return Array.from(matched);

  const taskTimestamp = toTimestamp(taskDate);

  // اللوحة قد يعاد تأجيرها لنفس الزبون في عقد لاحق. لذلك لا نضم كل عقد
  // يحتوي رقم اللوحة، بل نختار أحدث عقد كان موجوداً وقت إنشاء المهمة لكل لوحة.
  targetBillboardsSet.forEach(billboardId => {
    const candidates = customerContracts
      .map(c => ({
        contract: c,
        contractId: normalizeContractId(c.contractNumber ?? c.Contract_Number),
        contractTimestamp: toTimestamp(c.contractDate ?? c['Contract Date'] ?? c['Start Date'] ?? c.start_date),
        endTimestamp: toTimestamp(c.endDate ?? c['End Date'] ?? c.end_date),
        billboardIds: parseContractBillboardIds(c.billboardIds ?? c.billboard_ids),
      }))
      .filter(candidate => {
        if (!candidate.contractId || !candidate.billboardIds.includes(billboardId)) return false;
        if (candidate.contractId === directId) return true;
        // عند توفر تاريخ المهمة، العقود غير المؤرخة أو اللاحقة لها ليست دليلاً تاريخياً آمناً.
        if (taskTimestamp !== null) {
          return candidate.contractTimestamp !== null && candidate.contractTimestamp <= taskTimestamp;
        }
        return true;
      })
      .sort((a, b) => {
        const aActive = taskTimestamp !== null && (a.endTimestamp === null || a.endTimestamp >= taskTimestamp) ? 1 : 0;
        const bActive = taskTimestamp !== null && (b.endTimestamp === null || b.endTimestamp >= taskTimestamp) ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;
        const dateDiff = (b.contractTimestamp ?? -1) - (a.contractTimestamp ?? -1);
        if (dateDiff !== 0) return dateDiff;
        return (b.contractId ?? 0) - (a.contractId ?? 0);
      });

    if (candidates[0]?.contractId) matched.add(candidates[0].contractId);
  });

  return Array.from(matched).sort((a, b) => a - b);
};

/**
 * يحدد رقم العقد للوحة معينة من بين العقود المطابقة دون الاعتماد على جدول اللوحات الفعلي
 */
export const resolveBillboardContractNumber = ({
  billboardId,
  matchedContractIds,
  contracts,
  fallbackContractId,
}: {
  billboardId: number;
  matchedContractIds: number[];
  contracts: Array<any>;
  fallbackContractId?: number;
}): number | undefined => {
  if (!matchedContractIds || matchedContractIds.length === 0) {
    return fallbackContractId;
  }
  if (matchedContractIds.length === 1) {
    return matchedContractIds[0];
  }

  const numBId = Number(billboardId);
  const targetC = contracts.find(c => {
    const cNum = normalizeContractId(c.contractNumber ?? c.Contract_Number);
    if (!cNum || !matchedContractIds.includes(cNum)) return false;
    const bIds = parseContractBillboardIds(c.billboardIds ?? c.billboard_ids);
    return bIds.includes(numBId);
  });

  if (targetC) {
    return normalizeContractId(targetC.contractNumber ?? targetC.Contract_Number) || fallbackContractId;
  }
  return fallbackContractId;
};

export const filterTaskContractIdsByCustomer = ({
  candidateContractIds,
  directContractId,
  taskCustomerId,
  taskCustomerName,
  contracts,
}: {
  candidateContractIds: unknown[];
  directContractId: unknown;
  taskCustomerId?: unknown;
  taskCustomerName?: unknown;
  contracts: ContractAdTypeCandidate[];
}): number[] => {
  const directId = normalizeContractId(directContractId);
  const normalizedIds = [...new Set(
    candidateContractIds
      .map(normalizeContractId)
      .filter((id): id is number => id !== null)
  )];

  if (directId && !normalizedIds.includes(directId)) normalizedIds.unshift(directId);

  const contractMap = new Map<number, ContractAdTypeCandidate>();
  contracts.forEach(contract => {
    const id = normalizeContractId(contract.contractNumber);
    if (id) contractMap.set(id, contract);
  });

  const normalizedTaskCustomerId = String(taskCustomerId || '').trim();
  const normalizedTaskCustomerName = normalizeCustomerName(taskCustomerName);

  return normalizedIds.filter(contractId => {
    const contract = contractMap.get(contractId);
    if (!contract) return contractId === directId;

    const contractCustomerId = String(contract.customerId || '').trim();
    if (normalizedTaskCustomerId && contractCustomerId) {
      return normalizedTaskCustomerId === contractCustomerId;
    }

    const contractCustomerName = normalizeCustomerName(contract.customerName);
    if (normalizedTaskCustomerName && contractCustomerName) {
      return normalizedTaskCustomerName === contractCustomerName;
    }

    return contractId === directId;
  });
};

export const resolveTaskContractAdTypes = (params: {
  candidateContractIds: unknown[];
  directContractId: unknown;
  taskCustomerId?: unknown;
  taskCustomerName?: unknown;
  contracts: ContractAdTypeCandidate[];
}): string[] => {
  const allowedIds = filterTaskContractIdsByCustomer(params);
  const contractMap = new Map<number, ContractAdTypeCandidate>();
  params.contracts.forEach(contract => {
    const id = normalizeContractId(contract.contractNumber);
    if (id) contractMap.set(id, contract);
  });

  return [...new Set(allowedIds.flatMap(contractId => {
    const value = String(contractMap.get(contractId)?.adType || '').trim();
    return value && value !== 'غير محدد' && value !== 'null' ? [value] : [];
  }))];
};
