import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface GalleryTask {
  taskId: string;
  contractId: number;
  customerName: string;
  adType: string;
  teamName: string;
  status: string;
  isArchived: boolean;
  items: GalleryItem[];
  designs: GalleryDesign[];
}

export interface GalleryHistoryPhoto {
  id: string;
  reinstallNumber: number;
  installedFaceA: string | null;
  installedFaceB: string | null;
  installationDate: string | null;
}

export interface GalleryItem {
  id: string;
  billboardId: number;
  billboardName: string;
  size: string;
  designFaceA: string | null;
  designFaceB: string | null;
  installedFaceA: string | null;
  installedFaceB: string | null;
  installationDate: string | null;
  status: string;
  historyPhotos: GalleryHistoryPhoto[];
}

export interface GalleryDesign {
  id: string;
  designName: string;
  faceAUrl: string | null;
  faceBUrl: string | null;
  cutoutUrl: string | null;
}

export type GalleryFilter = 'all' | 'designs' | 'installations' | 'completed' | 'archived';

export function useImageGallery() {
  const [tasks, setTasks] = useState<GalleryTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<GalleryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [archivedTaskIds, setArchivedTaskIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch items AND designs in parallel to find ALL tasks with images
      const [itemsRes, allDesignsRes, archivedRes, photoHistoryRes] = await Promise.all([
        supabase
          .from('installation_task_items')
          .select('id, task_id, billboard_id, status, design_face_a, design_face_b, installed_image_face_a_url, installed_image_face_b_url, installation_date')
          .limit(5000),
        supabase
          .from('task_designs')
          .select('id, task_id, design_name, design_face_a_url, design_face_b_url, cutout_image_url')
          .limit(5000),
        supabase.from('system_settings').select('setting_value').eq('setting_key', 'archived_gallery_tasks').maybeSingle(),
        supabase
          .from('installation_photo_history')
          .select('id, task_item_id, billboard_id, task_id, reinstall_number, installed_image_face_a_url, installed_image_face_b_url, installation_date')
          .limit(5000),
      ]);

      const allItems = itemsRes.data || [];
      const allDesigns = allDesignsRes.data || [];
      const allPhotoHistory = photoHistoryRes.data || [];

      // Build a map of task_item_id -> history photos
      const historyByItemId = new Map<string, GalleryHistoryPhoto[]>();
      for (const ph of allPhotoHistory) {
        if (!ph.installed_image_face_a_url && !ph.installed_image_face_b_url) continue;
        const arr = historyByItemId.get(ph.task_item_id) || [];
        arr.push({
          id: ph.id,
          reinstallNumber: ph.reinstall_number,
          installedFaceA: ph.installed_image_face_a_url,
          installedFaceB: ph.installed_image_face_b_url,
          installationDate: ph.installation_date,
        });
        historyByItemId.set(ph.task_item_id, arr);
      }
      // Items with images (including those with history photos)
      const itemsWithImages = allItems.filter(i => 
        i.design_face_a || i.design_face_b || i.installed_image_face_a_url || i.installed_image_face_b_url || historyByItemId.has(i.id)
      );

      // Designs with images
      const designsWithImages = allDesigns.filter(d =>
        d.design_face_a_url || d.design_face_b_url || d.cutout_image_url
      );

      // Collect ALL task IDs that have any images (items OR designs)
      const taskIdsFromItems = [...new Set(itemsWithImages.map(i => i.task_id))];
      const taskIdsFromDesigns = [...new Set(designsWithImages.map(d => d.task_id))];
      const allTaskIds = [...new Set([...taskIdsFromItems, ...taskIdsFromDesigns])];

      console.log('📸 Gallery: items with images:', itemsWithImages.length, 'designs with images:', designsWithImages.length, 'unique tasks:', allTaskIds.length);

      if (!allTaskIds.length && !allItems.length && !allDesigns.length) {
        // Still check for contracts with design_data below
      }

      // Get unique billboard IDs needed
      const billboardIds = [...new Set(itemsWithImages.map(i => i.billboard_id))];

      // Fetch tasks
      const tasksRes = allTaskIds.length > 0
        ? await supabase.from('installation_tasks').select('id, contract_id, status, team_id, installation_teams!installation_tasks_team_id_fkey(team_name)').in('id', allTaskIds)
        : { data: [] };

      const taskData = tasksRes.data || [];
      const contractIdsFromTasks = [...new Set(taskData.map(t => t.contract_id).filter(Boolean))] as number[];

      // Also fetch contracts that have design_data but NO installation tasks
      // We look for contracts >= 1161 (same threshold as auto_create_installation_tasks)
      const contractsWithDesignsRes = await supabase
        .from('Contract')
        .select('"Customer Name", "Ad Type", "Contract_Number", design_data')
        .not('design_data', 'is', null)
        .limit(5000);

      const allContractsWithDesigns = (contractsWithDesignsRes.data || []).filter(c => {
        if (!c.design_data) return false;
        try {
          const dd = typeof c.design_data === 'string' ? JSON.parse(c.design_data) : c.design_data;
          const arr = Array.isArray(dd) ? dd : [dd];
          return arr.some((item: any) =>
            item?.design_face_a || item?.designFaceA || item?.design_face_b || item?.designFaceB
          );
        } catch { return false; }
      });

      console.log('📸 Contracts with design URLs:', allContractsWithDesigns.length, 
        'contractIdsFromTasks:', contractIdsFromTasks.length);

      // Contracts with design_data that have NO installation tasks
      const contractIdsWithTasksSet = new Set(contractIdsFromTasks);
      const contractsOnlyDesigns = allContractsWithDesigns.filter(
        c => !contractIdsWithTasksSet.has(c.Contract_Number)
      );
      
      console.log('📸 Contracts with designs only (no tasks):', contractsOnlyDesigns.length,
        'IDs:', contractsOnlyDesigns.map(c => c.Contract_Number).sort((a,b) => b-a).slice(0, 20));

      // Merge all contract IDs
      const allContractIds = [...new Set([
        ...contractIdsFromTasks,
        ...contractsOnlyDesigns.map(c => c.Contract_Number),
      ])];

      // Fetch contracts and billboards
      const [contractsRes, billboardsRes] = await Promise.all([
        allContractIds.length > 0
          ? supabase.from('Contract').select('"Customer Name", "Ad Type", "Contract_Number", design_data').in('Contract_Number', allContractIds)
          : Promise.resolve({ data: [] }),
        billboardIds.length > 0
          ? supabase.from('billboards').select('"ID", "Billboard_Name", "Size"').in('ID', billboardIds)
          : Promise.resolve({ data: [] }),
      ]);

      const contractMap = new Map<number, any>();
      (contractsRes.data || []).forEach((c: any) => contractMap.set(c.Contract_Number, c));

      const billboardMap = new Map<number, any>();
      (billboardsRes.data || [])?.forEach((b: any) => billboardMap.set(b.ID, b));

      const archived = new Set<string>(
        archivedRes.data?.setting_value ? 
          (typeof archivedRes.data.setting_value === 'string' ? 
            JSON.parse(archivedRes.data.setting_value) : 
            (archivedRes.data.setting_value as any)) : []
      );
      setArchivedTaskIds(archived);

      // Helper to extract designs from Contract.design_data
      function extractContractDesigns(contract: any): GalleryDesign[] {
        const designs: GalleryDesign[] = [];
        if (!contract?.design_data) return designs;
        try {
          const dd = typeof contract.design_data === 'string' ? JSON.parse(contract.design_data) : contract.design_data;
          const designArr = Array.isArray(dd) ? dd : [dd];
          const seenUrls = new Set<string>();
          for (const item of designArr) {
            const fA = item?.design_face_a || item?.designFaceA || null;
            const fB = item?.design_face_b || item?.designFaceB || null;
            const key = `${fA || ''}|${fB || ''}`;
            if ((fA || fB) && !seenUrls.has(key)) {
              seenUrls.add(key);
              designs.push({
                id: `contract-design-${designs.length}`,
                designName: item?.design_name || item?.designName || item?.billboardName || 'تصميم العقد',
                faceAUrl: fA,
                faceBUrl: fB,
                cutoutUrl: null,
              });
            }
          }
        } catch (e) {
          console.warn('Error parsing design_data:', e);
        }
        return designs;
      }

      // Build gallery tasks from installation_tasks
      const result: GalleryTask[] = taskData.map(task => {
        const contract = contractMap.get(task.contract_id!);
        const taskItems = itemsWithImages.filter(i => i.task_id === task.id);
        const taskDesigns = designsWithImages.filter(d => d.task_id === task.id);
        const teamName = (task as any).installation_teams?.team_name || 'غير محدد';

        const contractDesigns = taskDesigns.length === 0 ? extractContractDesigns(contract) : [];

        return {
          taskId: task.id,
          contractId: task.contract_id!,
          customerName: contract?.['Customer Name'] || 'غير معروف',
          adType: contract?.['Ad Type'] || '',
          teamName,
          status: task.status || 'pending',
          isArchived: archived.has(task.id),
          items: taskItems.map(item => {
            const bb = billboardMap.get(item.billboard_id);
            return {
              id: item.id,
              billboardId: item.billboard_id,
              billboardName: bb?.Billboard_Name || `لوحة ${item.billboard_id}`,
              size: bb?.Size || '',
              designFaceA: item.design_face_a,
              designFaceB: item.design_face_b,
              installedFaceA: item.installed_image_face_a_url,
              installedFaceB: item.installed_image_face_b_url,
              installationDate: item.installation_date,
              status: item.status || 'pending',
              historyPhotos: (historyByItemId.get(item.id) || []).sort((a, b) => a.reinstallNumber - b.reinstallNumber),
            };
          }),
          designs: (() => {
            const seenKeys = new Set<string>();
            const uniqueDesigns: GalleryDesign[] = [];
            const allD = [
              ...taskDesigns.map(d => ({
                id: d.id,
                designName: d.design_name || 'تصميم',
                faceAUrl: d.design_face_a_url,
                faceBUrl: d.design_face_b_url,
                cutoutUrl: d.cutout_image_url,
              })),
              ...contractDesigns,
            ];
            for (const d of allD) {
              const key = `${d.faceAUrl || ''}|${d.faceBUrl || ''}|${d.cutoutUrl || ''}`;
              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                uniqueDesigns.push(d);
              }
            }
            return uniqueDesigns;
          })(),
        };
      });

      // Add contracts with design_data that have NO installation tasks
      for (const contract of contractsOnlyDesigns) {
        const designs = extractContractDesigns(contract);
        if (designs.length > 0) {
          const virtualId = `contract-${contract.Contract_Number}`;
          result.push({
            taskId: virtualId,
            contractId: contract.Contract_Number,
            customerName: contract['Customer Name'] || 'غير معروف',
            adType: contract['Ad Type'] || '',
            teamName: 'غير محدد',
            status: 'pending',
            isArchived: archived.has(virtualId),
            items: [],
            designs,
          });
        }
      }

      // Sort by contract ID descending (newest first)
      result.sort((a, b) => b.contractId - a.contractId);
      setTasks(result);
    } catch (err) {
      console.error('Error fetching gallery data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleArchive(taskId: string) {
    const newArchived = new Set(archivedTaskIds);
    if (newArchived.has(taskId)) {
      newArchived.delete(taskId);
    } else {
      newArchived.add(taskId);
    }
    setArchivedTaskIds(newArchived);

    // Persist to system_settings
    const archivedArray = [...newArchived];
    await supabase
      .from('system_settings')
      .upsert({
        setting_key: 'archived_gallery_tasks',
        setting_value: JSON.stringify(archivedArray),
      }, { onConflict: 'setting_key' });

    // Update local state
    setTasks(prev => prev.map(t => 
      t.taskId === taskId ? { ...t, isArchived: newArchived.has(taskId) } : t
    ));
  }

  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Apply filter
    switch (filter) {
      case 'designs':
        result = result.filter(t => t.designs.length > 0 || t.items.some(i => i.designFaceA || i.designFaceB));
        break;
      case 'installations':
        result = result.filter(t => t.items.some(i => i.installedFaceA || i.installedFaceB));
        break;
      case 'completed':
        result = result.filter(t => t.status === 'completed');
        break;
      case 'archived':
        result = result.filter(t => t.isArchived);
        break;
      case 'all':
      default:
        result = result.filter(t => !t.isArchived);
        break;
    }

    // Apply search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.customerName.toLowerCase().includes(q) ||
        t.adType.toLowerCase().includes(q) ||
        t.contractId.toString().includes(q) ||
        t.teamName.toLowerCase().includes(q)
      );
    }

    return result;
  }, [tasks, filter, searchQuery]);

  return {
    tasks: filteredTasks,
    allTasks: tasks,
    loading,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    toggleArchive,
    refetch: fetchData,
  };
}
