export interface CompositeTaskIdentity {
  id: string;
  task_number?: number | null;
  contract_id?: number | null;
  installation_task_id?: string | null;
  task_type?: string | null;
  reinstallation_number?: number | null;
  team_name?: string | null;
  team_id?: string | null;
  remaining?: number | null;
  total?: number | null;
  is_fully_paid?: boolean | null;
}

/**
 * Normalizes installation team names for grouping.
 * - Abdulrazzaq and Issa work together as the in-house crew on contract missions ("فرقة عبدالرزاق وعيسى لنفس المهمة تكون فاتورة واحدة").
 * - External companies and distinct contractor teams (such as "دانة مصراتة", "اثر مصراتة", "هشام") stay isolated on their own separate rows ("دانة مصراتة تظهر لوحدها").
 */
export function normalizeInstallationTeamGroup(teamName?: string | null): string {
  if (!teamName) return 'main_crew';
  const clean = teamName.trim();
  if (clean.includes('عبدالرزاق') || clean.includes('عيسى')) {
    return 'main_crew';
  }
  return `team:${clean}`;
}

export function compositeTaskLabel(task: CompositeTaskIdentity, adType?: string): string {
  const isReinstall = task.task_type === 'reinstallation';
  let kindStr: string;

  if (isReinstall) {
    const num = task.reinstallation_number || 1;
    kindStr = `مهمة إعادة تركيب رقم ${num}`;
  } else if (task.task_type === 'installation' || task.task_type === 'new_installation' || task.installation_task_id) {
    kindStr = 'مهمة تركيب جديد';
  } else if (task.task_type === 'print') {
    kindStr = task.task_number ? `مهمة طباعة #${task.task_number}` : 'مهمة طباعة';
  } else if (task.task_type === 'cutout') {
    kindStr = task.task_number ? `مهمة قص مجسمات #${task.task_number}` : 'مهمة قص مجسمات';
  } else {
    kindStr = task.task_number ? `مهمة مجمعة #${task.task_number}` : 'مهمة مجمعة';
  }

  const isFullyPaid = task.is_fully_paid ?? (
    task.remaining !== undefined &&
    task.remaining !== null &&
    Number(task.remaining) <= 0.01 &&
    task.total !== undefined &&
    task.total !== null &&
    Number(task.total) > 0
  );

  const paidSuffix = isFullyPaid ? ' (مسددة بالكامل)' : '';

  return [
    `${kindStr}${task.contract_id ? ` — عقد #${task.contract_id}` : ''}${paidSuffix}`,
    adType?.trim(),
  ].filter(Boolean).join(' — ');
}

// Group tasks that belong to the same mission (contract + task_type + reinstallation_number)
// When multiple teams work on the same mission, they are aggregated into one mission row.
export function compositeTaskGroupKey(task: CompositeTaskIdentity): string {
  const isReinstall = task.task_type === 'reinstallation';
  if (task.contract_id) {
    if (isReinstall) {
      const num = task.reinstallation_number || 1;
      return `composite:contract:${task.contract_id}:reinstallation:${num}`;
    }
    if (task.task_type === 'installation' || task.task_type === 'new_installation' || task.installation_task_id) {
      return `composite:contract:${task.contract_id}:installation`;
    }
  }
  return task.installation_task_id ? `installation:${task.installation_task_id}` : `composite:${task.id}`;
}

