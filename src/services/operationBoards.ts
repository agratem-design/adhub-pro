import { getAvailableFacesCount, getInstallationFaceIndices } from '@/lib/installationFaces';
import { supabase } from '@/integrations/supabase/client';
import { parseContractBillboardIds } from '@/lib/compositeTaskContractIdentity';
import type { OperationRow } from '@/services/compositeOperations';
import { prepareInstallationOperationTask } from '@/services/installationOperation';

export interface BoardItem {
  id: string;
  taskId: string;
  teamName: string;
  billboardId: number;
  name: string;
  size: string;
  faces: number;
  maxFaces: number;
  selectedFaces: number[];
  photo: string | null;
  landmark: string | null;
  area: string | null;
  municipality: string | null;
  level: string | null;
  designA: string | null;
  designB: string | null;
  installedA: string | null;
  installedB: string | null;
  status: 'pending' | 'completed' | string;
  installationDate: string | null;
  notes: string | null;
  contractNumber: number | null;
  hasCutout: boolean;
  city: string | null;
  friendCompanyId: string | null;
}

const chunk = <T,>(a: T[], n = 100) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const nowIso = () => new Date().toISOString();

export async function loadOperationBoards(op: OperationRow): Promise<BoardItem[]> {
  const taskIds = op.tasks.map(t => t.installation_task_id).filter(Boolean);
  if (!taskIds.length) return [];
  const teamByTask = new Map(op.tasks.map(t => [t.installation_task_id, t.teamName]));
  const { data: items, error } = await supabase.from('installation_task_items').select('*').in('task_id', taskIds).neq('status', 'replaced');
  if (error) throw error;
  const ids = [...new Set((items || []).map((i: any) => Number(i.billboard_id)))];
  const [boards, contractsR] = await Promise.all([
    Promise.all(chunk(ids).map(part => supabase.from('billboards')
      .select('"ID", "Billboard_Name", "Size", "Faces_Count", "Image_URL", "Nearest_Landmark", "District", "City", "Municipality", "Level", friend_company_id').in('ID', part)))
      .then(rs => rs.flatMap(r => { if (r.error) throw r.error; return r.data || []; })),
    supabase.from('Contract').select('"Contract_Number", billboard_ids').in('Contract_Number', op.contractIds.length ? op.contractIds : [-1]),
  ]);
  const bMap = new Map(boards.map((b: any) => [Number(b.ID), b]));
  const contractOf = new Map<number, number>();
  (contractsR.data || []).forEach((c: any) => parseContractBillboardIds(c.billboard_ids).forEach(id => { if (!contractOf.has(id)) contractOf.set(id, Number(c.Contract_Number)); }));

  return (items || []).map((i: any) => {
    const b: any = bMap.get(Number(i.billboard_id)) || {};
    return {
      id: i.id,
      taskId: i.task_id,
      teamName: teamByTask.get(i.task_id) || '—',
      billboardId: Number(i.billboard_id),
      name: b.Billboard_Name || `لوحة ${i.billboard_id}`,
      size: b.Size || '—',
      faces: getInstallationFaceIndices(i, b, op.type).length,
      maxFaces: getAvailableFacesCount(b),
      selectedFaces: getInstallationFaceIndices(i, b, op.type),
      photo: b.Image_URL || null,
      landmark: b.Nearest_Landmark || null,
      area: b.District || b.City || null,
      municipality: b.Municipality || null,
      level: b.Level || null,
      designA: i.design_face_a || null,
      designB: i.design_face_b || null,
      installedA: i.installed_image_face_a_url || i.installed_image_url || null,
      installedB: i.installed_image_face_b_url || null,
      status: i.status,
      installationDate: i.installation_date || null,
      notes: i.notes || null,
      contractNumber: contractOf.get(Number(i.billboard_id)) ?? (op.contractIds.length === 1 ? op.contractIds[0] : null),
      hasCutout: !!i.has_cutout,
      city: b.City || null,
      friendCompanyId: b.friend_company_id || null,
    };
  });
}

/** يحدّث حالة أوامر التركيب وأوامر العمل والطباعة/القص بعد أي تغيير في حالة اللوحات */
export async function syncOperationStatus(taskIds: string[]) {
  for (const taskId of [...new Set(taskIds)]) {
    const { data, error } = await supabase.from('installation_task_items').select('status').eq('task_id', taskId).neq('status', 'replaced');
    if (error) throw error;
    const total = data?.length || 0;
    const done = (data || []).filter(i => i.status === 'completed').length;
    const status = total > 0 && done === total ? 'completed' : done > 0 ? 'in_progress' : 'pending';
    await supabase.from('installation_tasks').update({ status } as any).eq('id', taskId);
    const { data: comps } = await supabase.from('composite_tasks').select('id, print_task_id, cutout_task_id, status').eq('installation_task_id', taskId);
    for (const c of comps || []) {
      if (c.status !== 'cancelled') await supabase.from('composite_tasks').update({ status, updated_at: nowIso() } as any).eq('id', c.id);
      if (status === 'completed') {
        if (c.print_task_id) await supabase.from('print_tasks').update({ status: 'completed', completed_at: nowIso() } as any).eq('id', c.print_task_id);
        if (c.cutout_task_id) await supabase.from('cutout_tasks').update({ status: 'completed', completed_at: nowIso() } as any).eq('id', c.cutout_task_id);
      }
    }
  }
}

export async function completeBoards(items: BoardItem[], date: string, notes?: string) {
  if (!items.length) throw new Error('لا توجد لوحات غير مركبة ضمن التحديد');
  const { error } = await supabase.from('installation_task_items').update({
    status: 'completed', installation_date: date, completed_at: nowIso(), ...(notes ? { notes } : {}),
  } as any).in('id', items.map(i => i.id));
  if (error) throw error;
  await syncOperationStatus(items.map(i => i.taskId));
}

export async function uncompleteBoards(items: BoardItem[]) {
  if (!items.length) throw new Error('لا توجد لوحات مركبة ضمن التحديد');
  const { error } = await supabase.from('installation_task_items').update({ status: 'pending', installation_date: null, completed_at: null } as any).in('id', items.map(i => i.id));
  if (error) throw error;
  await syncOperationStatus(items.map(i => i.taskId));
}

export async function setBoardsDate(items: BoardItem[], date: string) {
  const { error } = await supabase.from('installation_task_items').update({ installation_date: date } as any).in('id', items.map(i => i.id));
  if (error) throw error;
}

/** نقل لوحات إلى فرقة أخرى داخل نفس العملية */
export async function moveBoards(items: BoardItem[], targetTaskId: string) {
  if (!items.length) throw new Error('اللوحات المحددة لدى هذه الفرقة أصلاً');
  const { error } = await supabase.from('installation_task_items').update({ task_id: targetTaskId } as any).in('id', items.map(i => i.id));
  if (error) throw error;
  await syncOperationStatus([...items.map(i => i.taskId), targetTaskId]);
}

/** إزالة لوحات غير مركبة من العملية */
export async function removeBoards(items: BoardItem[]) {
  if (items.some(i => i.status === 'completed')) throw new Error('لا يمكن إزالة لوحة تم تركيبها؛ ألغِ الإكمال أولاً');
  await removeTaskItems(items.map(i => i.id));
}

/**
 * حذف لوحات من أوامر التركيب. اللوحة غير المركّبة في تركيب جديد لعدة عقود (سُحبت من أمرها
 * الأصلي عند الإنشاء) تُعاد إلى أمر التركيب الأصلي لعقدها بدل حذفها، ويُنشأ الأمر من جديد
 * إن كان قد حُذف بعد أن فرغ — حتى لا تخرج اللوحة من دورة التركيب.
 */
export async function removeTaskItems(itemIds: string[]): Promise<{ returned: number; deleted: number }> {
  if (!itemIds.length) return { returned: 0, deleted: 0 };
  const { data: items, error } = await supabase.from('installation_task_items').select('id, task_id, billboard_id, status').in('id', itemIds);
  if (error) throw error;
  const taskIds = [...new Set((items || []).map((i: any) => i.task_id as string))];
  const { data: tasks, error: tErr } = await supabase.from('installation_tasks').select('id, contract_id, contract_ids, team_id, task_type').in('id', taskIds.length ? taskIds : ['-']);
  if (tErr) throw tErr;
  const taskMap = new Map((tasks || []).map((t: any) => [t.id as string, t]));
  const contractsOf = (t: any) => [...new Set([...(t.contract_ids || []), t.contract_id].map(Number).filter(Boolean))];
  const isCombined = (t: any) => t?.task_type === 'installation' && contractsOf(t).length > 1;

  const toReturn = (items || []).filter((i: any) => i.status !== 'completed' && isCombined(taskMap.get(i.task_id)));
  const allContracts = [...new Set(toReturn.flatMap((i: any) => contractsOf(taskMap.get(i.task_id))))];
  const contractOf = new Map<number, number>();
  if (allContracts.length) {
    const { data: cs, error: cErr } = await supabase.from('Contract').select('"Contract_Number", billboard_ids').in('Contract_Number', allContracts);
    if (cErr) throw cErr;
    (cs || []).forEach((c: any) => parseContractBillboardIds(c.billboard_ids).forEach(id => { if (!contractOf.has(id)) contractOf.set(id, Number(c.Contract_Number)); }));
  }

  const deleteIds = new Set<string>((items || []).map((i: any) => i.id));
  const touched = new Set<string>(taskIds);
  const originalFor = new Map<string, string>();
  let returned = 0;
  for (const i of toReturn as any[]) {
    const task = taskMap.get(i.task_id);
    const contract = contractOf.get(Number(i.billboard_id));
    if (!contract || !contractsOf(task).includes(contract)) continue;
    const key = `${contract}:${task.team_id}`;
    let target = originalFor.get(key);
    if (!target) {
      const { data: originals, error: oErr } = await supabase.from('installation_tasks').select('id, contract_ids, team_id')
        .eq('contract_id', contract).eq('task_type', 'installation').neq('id', task.id);
      if (oErr) throw oErr;
      const singles = (originals || []).filter((o: any) => contractsOf({ ...o, contract_id: contract }).length <= 1);
      target = (singles.find((o: any) => o.team_id === task.team_id) || singles[0])?.id;
      if (!target) {
        const { data: created, error: nErr } = await supabase.from('installation_tasks').insert({
          ...(await prepareInstallationOperationTask(crypto.randomUUID())),
          contract_id: contract, contract_ids: [contract], team_id: task.team_id, status: 'pending', task_type: 'installation',
        } as any).select('id').single();
        if (nErr) throw nErr;
        target = created.id as string;
      }
      originalFor.set(key, target);
    }
    const { data: dup } = await supabase.from('installation_task_items').select('id').eq('task_id', target).eq('billboard_id', i.billboard_id).neq('status', 'replaced').limit(1);
    if (dup?.length) continue; // موجودة أصلاً في الأمر الأصلي: تُحذف من المجمعة فقط
    const { error: mErr } = await supabase.from('installation_task_items').update({ task_id: target } as any).eq('id', i.id);
    if (mErr) throw mErr;
    deleteIds.delete(i.id);
    touched.add(target);
    returned++;
  }
  if (deleteIds.size) {
    const { error: dErr } = await supabase.from('installation_task_items').delete().in('id', [...deleteIds]);
    if (dErr) throw dErr;
  }
  await syncOperationStatus([...touched]);
  return { returned, deleted: deleteIds.size };
}

export async function saveInstalledPhotos(item: BoardItem, a: string | null, b: string | null) {
  const { error } = await supabase.from('installation_task_items').update({
    installed_image_face_a_url: a || null, installed_image_face_b_url: b || null, installed_image_url: a || null,
  } as any).eq('id', item.id);
  if (error) throw error;
}

export async function uploadInstalledPhoto(file: File, item: BoardItem, face: 'A' | 'B', op: OperationRow) {
  if (!file.type.startsWith('image/')) throw new Error('اختر ملف صورة');
  if (file.size > 25 * 1024 * 1024) throw new Error('حجم الصورة أكبر من 25MB');
  const clean = (s: string) => s.replace(/\s+/g, '-').replace(/[^\w؀-ۿ_-]/g, '-');
  const contract = item.contractNumber ? `C${item.contractNumber}` : '';
  const folder = `installation-photos/${clean([contract, `re${item.taskId.slice(0, 6)}`, op.customerName].filter(Boolean).join('_'))}`;
  const name = clean([item.name, contract, `face-${face}`, `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`].filter(Boolean).join('_')) + '.jpg';
  const { uploadImageWithFallback } = await import('@/services/imageUploadService');
  return uploadImageWithFallback(file, name, folder);
}


/**
 * نقل لوحات إلى أي فرقة: إن كانت للفرقة مهمة ضمن العملية تُنقل إليها،
 * وإلا تُنشأ لها أمر تركيب جديد داخل نفس العملية (نفس العقود والنوع ورقم إعادة التركيب) ثم تُنقل اللوحات.
 */
export async function moveBoardsToTeam(items: BoardItem[], team: { id: string; team_name?: string }, op: OperationRow): Promise<string> {
  if (!items.length) throw new Error('لا توجد لوحات للنقل');
  const existing = op.tasks.find(t => t.installation_task_id && (t.team_id === team.id || t.installation_team_id === team.id));
  let targetTaskId: string | null = existing?.installation_task_id || null;
  if (!targetTaskId) {
    const { data: teamTasks } = await supabase.from('installation_tasks').select('id, team_id').in('id', op.tasks.map(t => t.installation_task_id).filter(Boolean));
    targetTaskId = (teamTasks || []).find((t: any) => t.team_id === team.id)?.id || null;
  }
  if (!targetTaskId) {
    const { loadInstallationOperationIds, linkInstallationOperation } = await import('@/services/installationOperation');
    const sourceId = op.tasks.find(t => t.installation_task_id)?.installation_task_id;
    const { data: src, error: srcErr } = await supabase.from('installation_tasks').select('*').eq('id', sourceId).single();
    if (srcErr) throw srcErr;
    const opTaskIds = op.tasks.map(t => t.installation_task_id).filter(Boolean) as string[];
    const ids = await loadInstallationOperationIds().catch(() => ({} as Record<string, string>));
    const operationId = opTaskIds.map(id => ids[id]).find(Boolean) || crypto.randomUUID();
    const newId = crypto.randomUUID();
    // كل مهام العملية + المهمة الجديدة تحت هوية عملية واحدة (فاتورة واحدة)
    await linkInstallationOperation(operationId, [...opTaskIds, newId]);
    const { error } = await supabase.from('installation_tasks').insert({
      id: newId,
      contract_id: (src as any).contract_id,
      contract_ids: (src as any).contract_ids,
      team_id: team.id,
      status: 'pending',
      task_type: (src as any).task_type,
      reinstallation_number: (src as any).reinstallation_number,
      task_name: (src as any).task_name,
    } as any);
    if (error) throw error;
    targetTaskId = newId;
  }
  const toMove = items.filter(i => i.taskId !== targetTaskId);
  if (toMove.length) await moveBoards(toMove, targetTaskId!);
  return targetTaskId!;
}


export interface OpDesign { id: string | null; name: string; a: string | null; b: string | null }

/** تصاميم العملية (من أوامر التركيب) + التصاميم المستخدمة فعلاً في لوحاتها */
export async function loadOperationDesigns(op: OperationRow, items: BoardItem[] = []): Promise<OpDesign[]> {
  const taskIds = op.tasks.map(t => t.installation_task_id).filter(Boolean);
  const out: OpDesign[] = [];
  const seen = new Set<string>();
  if (taskIds.length) {
    const { data, error } = await (supabase as any).from('task_designs').select('id, design_name, design_face_a_url, design_face_b_url, design_order').in('task_id', taskIds).order('design_order');
    if (error) throw error;
    (data || []).forEach((d: any) => {
      const k = `${d.design_face_a_url || ''}|${d.design_face_b_url || ''}`;
      if (seen.has(k) || (!d.design_face_a_url && !d.design_face_b_url)) return;
      seen.add(k);
      out.push({ id: d.id, name: d.design_name || `تصميم ${out.length + 1}`, a: d.design_face_a_url || null, b: d.design_face_b_url || null });
    });
  }
  items.forEach(i => {
    const k = `${i.designA || ''}|${i.designB || ''}`;
    if ((!i.designA && !i.designB) || seen.has(k)) return;
    seen.add(k);
    out.push({ id: null, name: `مستخدم في ${i.name}`, a: i.designA, b: i.designB });
  });
  return out;
}

/** تعيين تصميم للوحات (الوجهان معاً) */
export async function setBoardsDesign(items: BoardItem[], d: OpDesign) {
  const { error } = await supabase.from('installation_task_items').update({
    design_face_a: d.a, design_face_b: d.b, selected_design_id: d.id,
  } as any).in('id', items.map(i => i.id));
  if (error) throw error;
}
