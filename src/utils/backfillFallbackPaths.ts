/**
 * Backfill fallback paths for all existing image URLs in the database.
 * Only processes records that are MISSING fallback paths.
 */
import { supabase } from '@/integrations/supabase/client';
import { generateFallbackPath } from './fallbackPathGenerator';

interface BackfillProgress {
  table: string;
  processed: number;
  total: number;
  updated: number;
}

export async function backfillFallbackPaths(
  onProgress?: (progress: BackfillProgress) => void
): Promise<{ totalUpdated: number; errors: string[] }> {
  let totalUpdated = 0;
  const errors: string[] = [];

  // Helper to build contract lookup maps
  async function buildContractMaps(taskIds: string[]) {
    const { data: tasks } = await supabase.from('installation_tasks').select('id, contract_id').in('id', taskIds);
    const contractIds = [...new Set((tasks || []).map(t => t.contract_id).filter(Boolean))];
    const { data: contracts } = contractIds.length
      ? await supabase.from('Contract').select('"Contract_Number", "Ad Type", "Customer Name"').in('Contract_Number', contractIds)
      : { data: [] };

    const taskContractMap = new Map<string, number>();
    (tasks || []).forEach(t => taskContractMap.set(t.id, t.contract_id));

    const contractDataMap = new Map<number, { adType: string; customerName: string }>();
    (contracts || []).forEach(c => contractDataMap.set(c.Contract_Number, {
      adType: c['Ad Type'] || '',
      customerName: c['Customer Name'] || '',
    }));

    return { taskContractMap, contractDataMap };
  }

  // 1. Backfill installation_task_items — only where fallback paths are missing
  try {
    const { data: items } = await supabase
      .from('installation_task_items')
      .select('id, billboard_id, task_id, design_face_a, design_face_b, installed_image_face_a_url, installed_image_face_b_url, fallback_path_design_a, fallback_path_design_b, fallback_path_installed_a, fallback_path_installed_b')
      .or('design_face_a.not.is.null,design_face_b.not.is.null,installed_image_face_a_url.not.is.null,installed_image_face_b_url.not.is.null')
      .or('fallback_path_design_a.is.null,fallback_path_design_b.is.null,fallback_path_installed_a.is.null,fallback_path_installed_b.is.null')
      .limit(5000);

    if (items?.length) {
      // Filter to only items that actually need updates
      const needsUpdate = items.filter(i =>
        (i.design_face_a && !i.fallback_path_design_a) ||
        (i.design_face_b && !i.fallback_path_design_b) ||
        (i.installed_image_face_a_url && !i.fallback_path_installed_a) ||
        (i.installed_image_face_b_url && !i.fallback_path_installed_b)
      );

      if (needsUpdate.length) {
        const billboardIds = [...new Set(needsUpdate.map(i => i.billboard_id))] as any[];
        const taskIds = [...new Set(needsUpdate.map(i => i.task_id))] as any[];

        const [bbRes, maps] = await Promise.all([
          supabase.from('billboards').select('"ID", "Billboard_Name"').in('ID', billboardIds),
          buildContractMaps(taskIds),
        ]);

        const bbMap = new Map<number, string>();
        (bbRes.data || []).forEach(b => bbMap.set(b.ID, b.Billboard_Name || `لوحة ${b.ID}`));

        for (let i = 0; i < needsUpdate.length; i++) {
          const item = needsUpdate[i];
          const bbName = bbMap.get(item.billboard_id) || `لوحة ${item.billboard_id}`;
          const contractId = maps.taskContractMap.get(item.task_id);
          const contractData = contractId ? maps.contractDataMap.get(contractId) : undefined;
          const adType = contractData?.adType || '';
          const customerName = contractData?.customerName || '';

          const updates: Record<string, string> = {};
          if (item.design_face_a && !item.fallback_path_design_a) {
            updates.fallback_path_design_a = generateFallbackPath(bbName, 'design', 'face_a', adType, item.id, item.design_face_a, customerName, contractId);
          }
          if (item.design_face_b && !item.fallback_path_design_b) {
            updates.fallback_path_design_b = generateFallbackPath(bbName, 'design', 'face_b', adType, item.id, item.design_face_b, customerName, contractId);
          }
          if (item.installed_image_face_a_url && !item.fallback_path_installed_a) {
            updates.fallback_path_installed_a = generateFallbackPath(bbName, 'installed', 'face_a', adType, item.id, item.installed_image_face_a_url, customerName, contractId);
          }
          if (item.installed_image_face_b_url && !item.fallback_path_installed_b) {
            updates.fallback_path_installed_b = generateFallbackPath(bbName, 'installed', 'face_b', adType, item.id, item.installed_image_face_b_url, customerName, contractId);
          }

          if (Object.keys(updates).length > 0) {
            const { error } = await (supabase as any).from('installation_task_items').update(updates).eq('id', item.id);
            if (!error) totalUpdated++;
            else errors.push(`item ${item.id}: ${error.message}`);
          }

          onProgress?.({ table: 'installation_task_items', processed: i + 1, total: needsUpdate.length, updated: totalUpdated });
        }
      }
    }
  } catch (e: any) {
    errors.push(`installation_task_items: ${e.message}`);
  }

  // 2. Backfill task_designs — only where fallback paths are missing
  try {
    const { data: designs } = await supabase
      .from('task_designs')
      .select('id, task_id, design_name, design_face_a_url, design_face_b_url, cutout_image_url, fallback_path_face_a, fallback_path_face_b, fallback_path_cutout')
      .or('design_face_a_url.not.is.null,design_face_b_url.not.is.null,cutout_image_url.not.is.null')
      .or('fallback_path_face_a.is.null,fallback_path_face_b.is.null,fallback_path_cutout.is.null')
      .limit(5000);

    if (designs?.length) {
      const needsUpdate = designs.filter(d =>
        (d.design_face_a_url && !d.fallback_path_face_a) ||
        (d.design_face_b_url && !d.fallback_path_face_b) ||
        (d.cutout_image_url && !d.fallback_path_cutout)
      );

      if (needsUpdate.length) {
        const taskIds = [...new Set(needsUpdate.map(d => d.task_id))] as any[];
        const maps = await buildContractMaps(taskIds);

        for (let i = 0; i < needsUpdate.length; i++) {
          const d = needsUpdate[i];
          const designName = d.design_name || 'تصميم';
          const contractId = maps.taskContractMap.get(d.task_id);
          const contractData = contractId ? maps.contractDataMap.get(contractId) : undefined;
          const adType = contractData?.adType || '';
          const customerName = contractData?.customerName || '';

          const updates: Record<string, string> = {};
          if (d.design_face_a_url && !d.fallback_path_face_a) {
            updates.fallback_path_face_a = generateFallbackPath(designName, 'design', 'face_a', adType, d.id, d.design_face_a_url, customerName, contractId);
          }
          if (d.design_face_b_url && !d.fallback_path_face_b) {
            updates.fallback_path_face_b = generateFallbackPath(designName, 'design', 'face_b', adType, d.id, d.design_face_b_url, customerName, contractId);
          }
          if (d.cutout_image_url && !d.fallback_path_cutout) {
            updates.fallback_path_cutout = generateFallbackPath(designName, 'design', 'cutout', adType, d.id, d.cutout_image_url, customerName, contractId);
          }

          if (Object.keys(updates).length > 0) {
            const { error } = await (supabase as any).from('task_designs').update(updates).eq('id', d.id);
            if (!error) totalUpdated++;
            else errors.push(`design ${d.id}: ${error.message}`);
          }

          onProgress?.({ table: 'task_designs', processed: i + 1, total: needsUpdate.length, updated: totalUpdated });
        }
      }
    }
  } catch (e: any) {
    errors.push(`task_designs: ${e.message}`);
  }

  // 3. Backfill installation_photo_history — only where fallback paths are missing
  try {
    const { data: history } = await supabase
      .from('installation_photo_history')
      .select('id, billboard_id, task_id, reinstall_number, installed_image_face_a_url, installed_image_face_b_url, fallback_path_installed_a, fallback_path_installed_b')
      .or('installed_image_face_a_url.not.is.null,installed_image_face_b_url.not.is.null')
      .or('fallback_path_installed_a.is.null,fallback_path_installed_b.is.null')
      .limit(5000);

    if (history?.length) {
      const needsUpdate = history.filter(h =>
        (h.installed_image_face_a_url && !h.fallback_path_installed_a) ||
        (h.installed_image_face_b_url && !h.fallback_path_installed_b)
      );

      if (needsUpdate.length) {
        const billboardIds = [...new Set(needsUpdate.map(h => h.billboard_id))] as any[];
        const taskIds = [...new Set(needsUpdate.map(h => h.task_id).filter(Boolean))] as any[];

        const [bbRes, maps] = await Promise.all([
          supabase.from('billboards').select('"ID", "Billboard_Name"').in('ID', billboardIds),
          taskIds.length ? buildContractMaps(taskIds) : Promise.resolve({ taskContractMap: new Map(), contractDataMap: new Map() }),
        ]);

        const bbMap = new Map<number, string>();
        (bbRes.data || []).forEach(b => bbMap.set(b.ID, b.Billboard_Name || `لوحة ${b.ID}`));

        for (let i = 0; i < needsUpdate.length; i++) {
          const h = needsUpdate[i];
          const bbName = bbMap.get(h.billboard_id) || `لوحة ${h.billboard_id}`;
          const contractId = h.task_id ? maps.taskContractMap.get(h.task_id) : undefined;
          const contractData = contractId ? maps.contractDataMap.get(contractId) : undefined;
          const adType = contractData?.adType || '';
          const customerName = contractData?.customerName || '';

          const updates: Record<string, string> = {};
          if (h.installed_image_face_a_url && !h.fallback_path_installed_a) {
            updates.fallback_path_installed_a = generateFallbackPath(bbName, 'history', 'face_a', adType, h.id, h.installed_image_face_a_url, customerName, contractId, h.reinstall_number);
          }
          if (h.installed_image_face_b_url && !h.fallback_path_installed_b) {
            updates.fallback_path_installed_b = generateFallbackPath(bbName, 'history', 'face_b', adType, h.id, h.installed_image_face_b_url, customerName, contractId, h.reinstall_number);
          }

          if (Object.keys(updates).length > 0) {
            const { error } = await (supabase as any).from('installation_photo_history').update(updates).eq('id', h.id);
            if (!error) totalUpdated++;
            else errors.push(`history ${h.id}: ${error.message}`);
          }

          onProgress?.({ table: 'installation_photo_history', processed: i + 1, total: needsUpdate.length, updated: totalUpdated });
        }
      }
    }
  } catch (e: any) {
    errors.push(`installation_photo_history: ${e.message}`);
  }

  // 4. Backfill billboards — only where fallback_path_image is null
  try {
    const { data: bbs } = await supabase
      .from('billboards')
      .select('"ID", "Billboard_Name", "Image_URL", "Contract_Number"')
      .not('Image_URL', 'is', null)
      .is('fallback_path_image', null)
      .limit(5000);

    if (bbs?.length) {
      const contractNumbers = [...new Set(bbs.map(b => b.Contract_Number).filter(Boolean))];
      const { data: contracts } = contractNumbers.length
        ? await supabase.from('Contract').select('"Contract_Number", "Ad Type", "Customer Name"').in('Contract_Number', contractNumbers)
        : { data: [] };
      const contractDataMap = new Map<number, { adType: string; customerName: string }>();
      (contracts || []).forEach(c => contractDataMap.set(c.Contract_Number, {
        adType: c['Ad Type'] || '',
        customerName: c['Customer Name'] || '',
      }));

      for (let i = 0; i < bbs.length; i++) {
        const b = bbs[i];
        if (!b.Image_URL) continue;
        const contractData = b.Contract_Number ? contractDataMap.get(b.Contract_Number) : undefined;
        const fallback = generateFallbackPath(
          b.Billboard_Name || `لوحة ${b.ID}`, 'billboard', 'face_a', contractData?.adType || '', String(b.ID), b.Image_URL,
          contractData?.customerName, b.Contract_Number
        );
        const { error } = await (supabase as any).from('billboards').update({ fallback_path_image: fallback }).eq('ID', b.ID);
        if (!error) totalUpdated++;
        else errors.push(`billboard ${b.ID}: ${error.message}`);

        onProgress?.({ table: 'billboards', processed: i + 1, total: bbs.length, updated: totalUpdated });
      }
    }
  } catch (e: any) {
    errors.push(`billboards: ${e.message}`);
  }

  return { totalUpdated, errors };
}
