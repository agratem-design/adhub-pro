export type OperationTaskLike = {
  id?: string | null;
  contract_id?: number | string | null;
  contract_ids?: number[] | null;
  contractIds?: number[] | null;
  _contractIds?: number[] | null;
  task_type?: string | null;
  _taskType?: string | null;
  installation_task_id?: string | null;
  reinstallationNumber?: number | null;
  _reinstallationNumber?: number | null;
  created_at?: string | null;
};

export type InstallationCostItemLike = {
  customer_installation_cost?: number | null;
  customer_original_install_cost?: number | null;
  customer_reinstall_cost?: number | null;
};

export type CompositeTaskType = 'new_installation' | 'reinstallation';

export type SharedOperationCosts = {
  customerPrint: number;
  companyPrint: number;
  customerCutout: number;
  companyCutout: number;
  discount: number;
};

const EMPTY_SHARED_OPERATION_COSTS: SharedOperationCosts = {
  customerPrint: 0,
  companyPrint: 0,
  customerCutout: 0,
  companyCutout: 0,
  discount: 0,
};

/**
 * Installation tasks store the initial operation as `installation`, while
 * comprehensive tasks use `new_installation`. Keep that vocabulary difference
 * from turning a normal installation into a reinstallation in the UI.
 */
export const normalizeCompositeTaskType = (
  value: string | null | undefined,
): CompositeTaskType => value === 'reinstallation' ? 'reinstallation' : 'new_installation';

const normalizeContractKey = (value: unknown): string => {
  if (value === null || value === undefined || String(value).trim() === '') return 'unlinked';
  return String(value).trim();
};

/**
 * فحص حاسم وشامل إذا كانت المهمة تغطي أكثر من عقد مختلف
 */
export const isMultiContractOperation = (task: OperationTaskLike): boolean => {
  return getOperationContractIds(task).length > 1;
};

const getOperationContractIds = (task: OperationTaskLike): number[] => {
  const allIds = [
    ...(Array.isArray((task as any).contractIds) ? (task as any).contractIds : []),
    ...(Array.isArray((task as any).contract_ids) ? (task as any).contract_ids : []),
    ...(Array.isArray((task as any)._contractIds) ? (task as any)._contractIds : []),
  ];
  return [...new Set(allIds.map(Number).filter(Boolean))].sort((a, b) => a - b);
};

export const isReinstallationOperation = (task: OperationTaskLike): boolean =>
  task.task_type === 'reinstallation' || task._taskType === 'reinstallation';

export const getTaskReinstallationNumber = (task: OperationTaskLike): number | null => {
  const raw = task.reinstallationNumber ?? task._reinstallationNumber;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
};

/**
 * مفتاح تجميع المهام في البطاقات:
 * المهام المجمعة لعدة عقود تكون بطاقة مستقلة بذاتها ولاتنضوي تحت بطاقة عقد واحد محدد.
 */
export const getTaskContractGroupKey = (task: OperationTaskLike): string => {
  if (isMultiContractOperation(task)) {
    const contractIdentity = getOperationContractIds(task).join('-');
    const sequence = getTaskReinstallationNumber(task);
    if (sequence !== null) return `multi-contract-${contractIdentity}-reinstallation-${sequence}`;
    return `multi-contract-${task.id || task.installation_task_id || 'isolated'}`;
  }
  return `contract-${normalizeContractKey(task.contract_id)}`;
};

/**
 * Financial and operational grouping boundary.
 * Reinstallation operations never fall back to a weekly/date bucket because
 * invoices must not combine unrelated operations that happened in the same week.
 */
export const getCompositeTaskOperationKey = (task: OperationTaskLike): string => {
  if (isMultiContractOperation(task)) {
    const contractIdentity = getOperationContractIds(task).join('-');
    const stableTaskId = task.installation_task_id || task.id || 'isolated';
    const sequence = getTaskReinstallationNumber(task);
    return sequence !== null
      ? `multi-contract:${contractIdentity}:reinstallation:${sequence}`
      : `multi-contract:reinstallation:${stableTaskId}`;
  }

  const contractKey = normalizeContractKey(task.contract_id);
  if (!isReinstallationOperation(task)) return `${contractKey}:installation:initial`;

  const sequence = getTaskReinstallationNumber(task);
  if (sequence !== null) return `${contractKey}:reinstallation:${sequence}`;

  const stableTaskId = task.installation_task_id || task.id || 'unknown';
  return `${contractKey}:reinstallation:task:${stableTaskId}`;
};

export const getOperationLabel = (task: OperationTaskLike): string => {
  const isMulti = isMultiContractOperation(task);
  if (!isReinstallationOperation(task)) {
    return isMulti ? 'مهمة تركيب مجمعة لعدة عقود' : 'التركيب الأول';
  }
  const sequence = getTaskReinstallationNumber(task);
  if (isMulti) {
    return sequence !== null ? `إعادة تركيب مجمعة (${sequence})` : 'إعادة تركيب مجمعة لعدة عقود';
  }
  return sequence !== null ? `إعادة تركيب ${sequence}` : 'إعادة تركيب مستقلة';
};

export const sortTasksNewestFirst = <T extends OperationTaskLike>(tasks: T[]): T[] =>
  [...tasks].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  });

export const selectLatestOperationTasks = <T extends OperationTaskLike>(tasks: T[]): T[] => {
  const ordered = sortTasksNewestFirst(tasks);
  const latest = ordered[0];
  if (!latest) return [];
  const operationKey = getCompositeTaskOperationKey(latest);
  return ordered.filter(task => getCompositeTaskOperationKey(task) === operationKey);
};

/**
 * Printing, cutout and operation-level discounts are shared values. Persist
 * them on one composite task only so summing team rows cannot duplicate them.
 */
export const getSharedOperationCostsForTask = (
  taskId: string | null | undefined,
  primaryTaskId: string | null | undefined,
  costs: SharedOperationCosts,
): SharedOperationCosts => taskId === primaryTaskId ? costs : { ...EMPTY_SHARED_OPERATION_COSTS };

/**
 * Returns the billable installation cost for the current operation only.
 * Historical/original installation cost is intentionally excluded from an
 * independent reinstallation operation to prevent charging it twice.
 */
export const getCurrentOperationInstallationCost = (
  item: InstallationCostItemLike,
  taskType?: string | null,
): number => {
  if (taskType === 'reinstallation') {
    return Number(item.customer_reinstall_cost) || Number(item.customer_installation_cost) || 0;
  }
  return Number(item.customer_installation_cost) || 0;
};
