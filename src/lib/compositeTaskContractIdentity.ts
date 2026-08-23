export const normalizeContractId = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str) return null;
  const num = Number(str);
  return Number.isFinite(num) && num > 0 ? num : null;
};

type ContractAdTypeCandidate = {
  contractNumber: unknown;
  adType?: unknown;
  customerId?: unknown;
  customerName?: unknown;
};

const normalizeCustomerName = (value: unknown): string => String(value || '')
  .trim()
  .toLocaleLowerCase('ar')
  .replace(/[\u064B-\u065F\u0670]/g, '')
  .replace(/[أإآ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/\s+/g, ' ');

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
