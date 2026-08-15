/**
 * Smart Billboard Service
 * يتعامل مع إضافة/حذف اللوحات من العقود بذكاء
 * يشمل: مهام التركيب، الطباعة، القص المجسمات، الإزالة
 */

import { supabase } from '@/integrations/supabase/client';

export interface LinkedTaskInfo {
  type: 'installation' | 'print' | 'cutout' | 'removal';
  label: string;
  taskId: string;
  itemCount: number;
  status: string;
  itemStatus?: string; // حالة البند نفسه (completed = مركبة فعلاً)
}

export interface BillboardTaskLinks {
  billboardId: number;
  billboardName: string;
  linkedTasks: LinkedTaskInfo[];
}

/**
 * يفحص اللوحات المراد حذفها ويجلب المهام المرتبطة بها
 */
export async function checkLinkedTasks(
  contractNumber: number,
  billboardIds: number[]
): Promise<BillboardTaskLinks[]> {
  if (billboardIds.length === 0) return [];

  const results: BillboardTaskLinks[] = [];

  // جلب أسماء اللوحات
  const { data: billboards } = await supabase
    .from('billboards')
    .select('ID, Billboard_Name')
    .in('ID', billboardIds);

  const nameMap = new Map<number, string>();
  (billboards || []).forEach(b => nameMap.set(b.ID, b.Billboard_Name || `لوحة ${b.ID}`));

  // جلب سجل تاريخ اللوحات للتحقق من التركيب المسبق
  const { data: historyItems } = await supabase
    .from('billboard_history')
    .select('billboard_id')
    .eq('contract_number', contractNumber)
    .in('billboard_id', billboardIds);
  
  const historySet = new Set((historyItems || []).map(h => Number(h.billboard_id)));

  // 1. مهام التركيب
  const { data: installTasks } = await supabase
    .from('installation_tasks')
    .select('id, status')
    .eq('contract_id', contractNumber);

  const installTaskIds = (installTasks || []).map(t => t.id);
  let installItems: any[] = [];
  if (installTaskIds.length > 0) {
    const { data } = await supabase
      .from('installation_task_items')
      .select('id, billboard_id, task_id, status')
      .in('task_id', installTaskIds)
      .in('billboard_id', billboardIds);
    installItems = data || [];
  }

  // 2. مهام الطباعة
  const { data: printTasks } = await supabase
    .from('print_tasks')
    .select('id, status, contract_id')
    .eq('contract_id', contractNumber);

  const printTaskIds = (printTasks || []).map(t => t.id);
  let printItems: any[] = [];
  if (printTaskIds.length > 0) {
    const { data } = await supabase
      .from('print_task_items')
      .select('id, billboard_id, task_id, status')
      .in('task_id', printTaskIds)
      .in('billboard_id', billboardIds);
    printItems = data || [];
  }

  // 3. مهام القص المجسمات
  const { data: cutoutTasks } = await supabase
    .from('cutout_tasks')
    .select('id, status, contract_id')
    .eq('contract_id', contractNumber);

  const cutoutTaskIds = (cutoutTasks || []).map(t => t.id);
  let cutoutItems: any[] = [];
  if (cutoutTaskIds.length > 0) {
    const { data } = await supabase
      .from('cutout_task_items')
      .select('id, billboard_id, task_id, status')
      .in('task_id', cutoutTaskIds)
      .in('billboard_id', billboardIds);
    cutoutItems = data || [];
  }

  // 4. مهام الإزالة
  const { data: removalTasks } = await supabase
    .from('removal_tasks')
    .select('id, status, contract_id')
    .eq('contract_id', contractNumber);

  const removalTaskIds = (removalTasks || []).map(t => t.id);
  let removalItems: any[] = [];
  if (removalTaskIds.length > 0) {
    const { data } = await supabase
      .from('removal_task_items')
      .select('id, billboard_id, task_id, status')
      .in('task_id', removalTaskIds)
      .in('billboard_id', billboardIds);
    removalItems = data || [];
  }

  // بناء النتائج لكل لوحة
  for (const bbId of billboardIds) {
    const linkedTasks: LinkedTaskInfo[] = [];
    const isAlreadyInstalled = historySet.has(bbId);

    const bbInstallItems = installItems.filter(i => i.billboard_id === bbId);
    if (bbInstallItems.length > 0) {
      const taskStatus = installTasks?.find(t => t.id === bbInstallItems[0].task_id)?.status || 'pending';
      const itemStatus = bbInstallItems[0].status || 'pending';
      linkedTasks.push({
        type: 'installation',
        label: 'مهمة تركيب',
        taskId: bbInstallItems[0].task_id,
        itemCount: bbInstallItems.length,
        status: isAlreadyInstalled ? 'completed' : taskStatus,
        itemStatus: isAlreadyInstalled ? 'completed' : itemStatus,
      });
    } else if (isAlreadyInstalled) {
      // ✅ إذا تم تركيبها سابقاً، نقوم بإضافة مهمة تركيب مكتملة مصطنعة لضمان إعلام الواجهة وتاريخها
      linkedTasks.push({
        type: 'installation',
        label: 'مهمة تركيب',
        taskId: 'history',
        itemCount: 1,
        status: 'completed',
        itemStatus: 'completed',
      });
    }

    const bbPrintItems = printItems.filter(i => i.billboard_id === bbId);
    if (bbPrintItems.length > 0) {
      const taskStatus = printTasks?.find(t => t.id === bbPrintItems[0].task_id)?.status || 'pending';
      linkedTasks.push({
        type: 'print',
        label: 'مهمة طباعة',
        taskId: bbPrintItems[0].task_id,
        itemCount: bbPrintItems.length,
        status: isAlreadyInstalled ? 'completed' : taskStatus,
      });
    }

    const bbCutoutItems = cutoutItems.filter(i => i.billboard_id === bbId);
    if (bbCutoutItems.length > 0) {
      const taskStatus = cutoutTasks?.find(t => t.id === bbCutoutItems[0].task_id)?.status || 'pending';
      linkedTasks.push({
        type: 'cutout',
        label: 'مهمة قص مجسم',
        taskId: bbCutoutItems[0].task_id,
        itemCount: bbCutoutItems.length,
        status: isAlreadyInstalled ? 'completed' : taskStatus,
      });
    }

    const bbRemovalItems = removalItems.filter(i => i.billboard_id === bbId);
    if (bbRemovalItems.length > 0) {
      const taskStatus = removalTasks?.find(t => t.id === bbRemovalItems[0].task_id)?.status || 'pending';
      linkedTasks.push({
        type: 'removal',
        label: 'مهمة إزالة',
        taskId: bbRemovalItems[0].task_id,
        itemCount: bbRemovalItems.length,
        status: isAlreadyInstalled ? 'completed' : taskStatus,
      });
    }

    if (linkedTasks.length > 0) {
      results.push({
        billboardId: bbId,
        billboardName: nameMap.get(bbId) || `لوحة ${bbId}`,
        linkedTasks,
      });
    }
  }

  return results;
}

export interface TaskTypeSelection {
  installation: boolean;
  print: boolean;
  cutout: boolean;
  removal: boolean;
}

/**
 * حذف اللوحة من المهام المختارة فقط
 * إذا كانت اللوحة مركبة (completed) في مهمة التركيب، تبقى وتُعلّم كمستبدلة
 */
export async function removeBillboardFromAllTasks(
  contractNumber: number,
  billboardId: number,
  selectedTypes?: TaskTypeSelection
): Promise<{ replacedItemId?: string; replacedItemSize?: string }> {
  const types = selectedTypes || { installation: true, print: true, cutout: true, removal: true };
  let replacedItemId: string | undefined;
  let replacedItemSize: string | undefined;

  if (types.installation) {
    const { data: installTasks } = await supabase
      .from('installation_tasks')
      .select('id, status')
      .eq('contract_id', contractNumber);
    if (installTasks?.length) {
      // ✅ جلب العناصر للتحقق إذا كانت اللوحة أو المهمة مكتملة
      const { data: items } = await supabase
        .from('installation_task_items')
        .select('id, status, task_id')
        .in('task_id', installTasks.map(t => t.id))
        .eq('billboard_id', billboardId);

      const isCompleted = (items || []).some(item => {
        const parentTask = installTasks.find(t => t.id === item.task_id);
        return item.status === 'completed' || parentTask?.status === 'completed';
      });

      if (isCompleted && items && items.length > 0) {
        // اللوحة مركبة فعلاً - نعلّمها كمستبدلة بدل الحذف
        replacedItemId = items[0].id;
        
        // جلب مقاس اللوحة للربط مع البديلة
        const { data: bb } = await supabase
          .from('billboards')
          .select('Size')
          .eq('ID', billboardId)
          .single();
        replacedItemSize = bb?.Size || undefined;

        await supabase
          .from('installation_task_items')
          .update({
            replacement_status: 'replaced',
            replacement_reason: 'إزالة من العقد بعد التركيب',
            replacement_cost_bearer: 'company',
          })
          .eq('id', replacedItemId);
      } else {
        // اللوحة لم تُركّب بعد - نحذفها عادياً
        await supabase
          .from('installation_task_items')
          .delete()
          .in('task_id', installTasks.map(t => t.id))
          .eq('billboard_id', billboardId);
      }
    }
  }

  if (types.print) {
    const { data: printTasks } = await supabase
      .from('print_tasks')
      .select('id, status')
      .eq('contract_id', contractNumber);
    if (printTasks?.length) {
      const activePrintTaskIds = printTasks.filter(t => t.status !== 'completed').map(t => t.id);
      if (activePrintTaskIds.length > 0) {
        await supabase
          .from('print_task_items')
          .delete()
          .in('task_id', activePrintTaskIds)
          .eq('billboard_id', billboardId);
      }
    }
  }

  if (types.cutout) {
    const { data: cutoutTasks } = await supabase
      .from('cutout_tasks')
      .select('id, status')
      .eq('contract_id', contractNumber);
    if (cutoutTasks?.length) {
      const activeCutoutTaskIds = cutoutTasks.filter(t => t.status !== 'completed').map(t => t.id);
      if (activeCutoutTaskIds.length > 0) {
        await supabase
          .from('cutout_task_items')
          .delete()
          .in('task_id', activeCutoutTaskIds)
          .eq('billboard_id', billboardId);
      }
    }
  }

  if (types.removal) {
    const { data: removalTasks } = await supabase
      .from('removal_tasks')
      .select('id, status')
      .eq('contract_id', contractNumber);
    if (removalTasks?.length) {
      const activeRemovalTaskIds = removalTasks.filter(t => t.status !== 'completed').map(t => t.id);
      if (activeRemovalTaskIds.length > 0) {
        await supabase
          .from('removal_task_items')
          .delete()
          .in('task_id', activeRemovalTaskIds)
          .eq('billboard_id', billboardId);
      }
    }
  }

  return { replacedItemId, replacedItemSize };
}

/**
 * إضافة لوحة جديدة للمهام الموجودة مع نسخ الأسعار من نفس المقاس
 * إذا تم تمرير replacesItemId، تُعلّم اللوحة الجديدة كبديلة مرتبطة بالأصلية
 */
export async function addBillboardToExistingTasks(
  contractNumber: number,
  billboardId: number,
  replacesItemId?: string
): Promise<{ added: string[] }> {
  const added: string[] = [];

  // جلب معلومات اللوحة
  const { data: billboard } = await supabase
    .from('billboards')
    .select('ID, Size, City, Faces_Count, has_cutout, friend_company_id')
    .eq('ID', billboardId)
    .single();
  
  if (!billboard) return { added };

  const billboardSize = billboard.Size;
  const billboardCity = billboard.City;
  const billboardCompanyId = billboard.friend_company_id;

  // 1. إضافة لمهام التركيب
  // تأخير قصير لانتظار التريقر (auto_create_installation_tasks) الذي ينشئ المهام تلقائياً
  await new Promise(r => setTimeout(r, 600));

  let installTasks: any[] | null = null;
  const fetchInstallTasks = async () => {
    const { data } = await supabase
      .from('installation_tasks')
      .select('id, team_id, task_type')
      .eq('contract_id', contractNumber)
      .eq('task_type', 'installation')
      .order('created_at', { ascending: true });
    return data;
  };

  installTasks = await fetchInstallTasks();

  // إذا لم تُوجد مهام، ننتظر لاحتمال أن التريقر أنشأها
  if (!installTasks?.length) {
    await new Promise(r => setTimeout(r, 800));
    installTasks = await fetchInstallTasks();
  }

  if (installTasks?.length) {
    const { data: teams } = await supabase
      .from('installation_teams')
      .select('id, sizes, cities, friend_company_ids');

    // ✅ تحديد الفريق الصحيح للوحة (أولوية للفرق المرتبطة بالشركة المالكة)
    const sortedTeams = [...(teams || [])].sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0));
    
    const matchesSizeAndCity = (t: any) => {
      const sizeMatch = Array.isArray(t.sizes) && t.sizes.includes(billboardSize);
      if (!sizeMatch) return false;
      if (Array.isArray(t.cities) && t.cities.length > 0 && billboardCity) {
        if (!t.cities.includes(billboardCity)) return false;
      }
      return true;
    };

    let correctTeam: any = null;
    // أولاً: البحث في الفرق المرتبطة بالشركة المالكة
    if (billboardCompanyId) {
      correctTeam = sortedTeams.find((t: any) => 
        matchesSizeAndCity(t) && Array.isArray(t.friend_company_ids) && t.friend_company_ids.includes(billboardCompanyId)
      );
    }
    // ثانياً: fallback للفرق العامة (بدون ربط شركة) تطابق مدينة + مقاس
    if (!correctTeam) {
      correctTeam = sortedTeams.find((t: any) => 
        matchesSizeAndCity(t) && (!Array.isArray(t.friend_company_ids) || t.friend_company_ids.length === 0)
      );
    }
    // ثالثاً: أي فريق يطابق مدينة + مقاس (حتى لو مرتبط بشركة)
    if (!correctTeam) {
      correctTeam = sortedTeams.find((t: any) => matchesSizeAndCity(t));
    }
    // رابعاً: أي فريق يطابق المقاس فقط
    if (!correctTeam) {
      correctTeam = sortedTeams.find((t: any) => Array.isArray(t.sizes) && t.sizes.includes(billboardSize));
    }
    // خامساً: أي فريق كحل أخير
    if (!correctTeam && sortedTeams.length > 0) {
      correctTeam = sortedTeams[0];
    }

    // ✅ البحث عن المهمة الأساسية للفريق الصحيح (الأقدم)
    let targetTaskId: string | null = null;
    
    if (correctTeam) {
      // أولاً: البحث عن مهمة موجودة لهذا الفريق
      const teamTask = installTasks.find(t => t.team_id === correctTeam.id);
      if (teamTask) {
        targetTaskId = teamTask.id;
        
        // ✅ دمج المهام المكررة لنفس الفريق إن وجدت
        const duplicateTeamTasks = installTasks.filter(t => t.team_id === correctTeam.id && t.id !== teamTask.id);
        for (const dupTask of duplicateTeamTasks) {
          const { data: dupItems } = await supabase
            .from('installation_task_items')
            .select('id, billboard_id')
            .eq('task_id', dupTask.id);
          
          if (dupItems?.length) {
            const { data: primaryItems } = await supabase
              .from('installation_task_items')
              .select('billboard_id')
              .eq('task_id', targetTaskId);
            const primaryBbIds = new Set((primaryItems || []).map(p => p.billboard_id));
            
            for (const item of dupItems) {
              if (primaryBbIds.has(item.billboard_id)) {
                await supabase.from('installation_task_items').delete().eq('id', item.id);
              } else {
                await supabase.from('installation_task_items').update({ task_id: targetTaskId }).eq('id', item.id);
              }
            }
          }
          await supabase.from('installation_tasks').delete().eq('id', dupTask.id);
        }
      } else {
        // لا توجد مهمة لهذا الفريق - إنشاء واحدة جديدة
        const { data: newTask } = await supabase
          .from('installation_tasks')
          .insert({ contract_id: contractNumber, team_id: correctTeam.id, status: 'pending', task_type: 'installation' })
          .select('id')
          .single();
        if (newTask) targetTaskId = newTask.id;
      }
    } else {
      // لا يوجد فريق مطابق - استخدام أول مهمة موجودة
      targetTaskId = installTasks[0].id;
    }

    if (targetTaskId) {
      const { data: existing } = await supabase
        .from('installation_task_items')
        .select('id, replacement_status')
        .eq('task_id', targetTaskId)
        .eq('billboard_id', billboardId);

      if (existing?.length) {
        // العنصر موجود (أُنشئ بواسطة trigger) - نحدّث بيانات الاستبدال إن وُجد replacesItemId
        if (replacesItemId && !existing[0].replacement_status) {
          await supabase
            .from('installation_task_items')
            .update({
              replacement_status: 'replacement',
              replaces_item_id: replacesItemId,
              replacement_reason: 'استبدال من العقد',
              replacement_cost_bearer: 'company',
            } as any)
            .eq('id', existing[0].id);

          await supabase
            .from('installation_task_items')
            .update({ replaced_by_item_id: existing[0].id } as any)
            .eq('id', replacesItemId);

          added.push('مهمة التركيب (ربط استبدال)');
        }
      } else {
        const insertData: any = {
          task_id: targetTaskId,
          billboard_id: billboardId,
          status: 'pending',
        };

        if (replacesItemId) {
          insertData.replacement_status = 'replacement';
          insertData.replaces_item_id = replacesItemId;
          insertData.replacement_reason = 'استبدال من العقد';
          insertData.replacement_cost_bearer = 'company';
        }

        const { data: insertedItem } = await supabase
          .from('installation_task_items')
          .insert(insertData)
          .select('id')
          .single();

        if (replacesItemId && insertedItem) {
          await supabase
            .from('installation_task_items')
            .update({ replaced_by_item_id: insertedItem.id } as any)
            .eq('id', replacesItemId);
        }

        added.push('مهمة التركيب');
      }
    }
  }

  // 2. إضافة لمهام الطباعة
  const { data: printTasks } = await supabase
    .from('print_tasks')
    .select('id')
    .eq('contract_id', contractNumber);

  if (printTasks?.length) {
    const printTaskId = printTasks[0].id;

    // جلب أسعار من لوحة أخت بنفس المقاس
    const { data: siblingItems } = await supabase
      .from('print_task_items')
      .select('unit_cost, customer_unit_cost, width, height, area, quantity, faces_count, customer_unit_price, printer_unit_cost')
      .eq('task_id', printTaskId)
      .limit(100);

    // البحث عن لوحة بنفس المقاس
    let siblingPricing: any = null;
    if (siblingItems?.length) {
      // جلب مقاسات اللوحات الموجودة
      const siblingBbIds = await supabase
        .from('print_task_items')
        .select('billboard_id')
        .eq('task_id', printTaskId);
      
      if (siblingBbIds.data?.length) {
        const { data: siblingBillboards } = await supabase
          .from('billboards')
          .select('ID, Size')
          .in('ID', siblingBbIds.data.map(s => s.billboard_id!).filter(Boolean));

        const sameSizeBbId = siblingBillboards?.find(b => b.Size === billboardSize)?.ID;
        if (sameSizeBbId) {
          const { data: sameSizeItem } = await supabase
            .from('print_task_items')
            .select('*')
            .eq('task_id', printTaskId)
            .eq('billboard_id', sameSizeBbId)
            .limit(1)
            .single();
          if (sameSizeItem) siblingPricing = sameSizeItem;
        }

        // إذا لم نجد نفس المقاس، نأخذ أي أخت
        if (!siblingPricing && siblingItems.length > 0) {
          siblingPricing = siblingItems[0];
        }
      }
    }

    // تحقق من عدم الوجود
    const { data: existingPrint } = await supabase
      .from('print_task_items')
      .select('id')
      .eq('task_id', printTaskId)
      .eq('billboard_id', billboardId);

    if (!existingPrint?.length) {
      const newItem: any = {
        task_id: printTaskId,
        billboard_id: billboardId,
        status: 'pending',
        quantity: 1,
        faces_count: billboard.Faces_Count || 1,
      };

      if (siblingPricing) {
        newItem.unit_cost = siblingPricing.unit_cost;
        newItem.customer_unit_cost = siblingPricing.customer_unit_cost;
        newItem.customer_unit_price = siblingPricing.customer_unit_price;
        newItem.printer_unit_cost = siblingPricing.printer_unit_cost;
        newItem.width = siblingPricing.width;
        newItem.height = siblingPricing.height;
        newItem.area = siblingPricing.area;
        newItem.total_cost = siblingPricing.unit_cost ? (siblingPricing.unit_cost * (siblingPricing.area || 1)) : 0;
        newItem.customer_total_cost = siblingPricing.customer_unit_cost ? (siblingPricing.customer_unit_cost * (siblingPricing.area || 1)) : 0;
        newItem.customer_total_price = siblingPricing.customer_unit_price ? (siblingPricing.customer_unit_price * (siblingPricing.area || 1)) : 0;
      }

      await supabase.from('print_task_items').insert(newItem);
      added.push('مهمة الطباعة');
    }
  }

  // 3. إضافة لمهام القص المجسمات (فقط إذا اللوحة فيها مجسم)
  if (billboard.has_cutout) {
    const { data: cutoutTasks } = await supabase
      .from('cutout_tasks')
      .select('id')
      .eq('contract_id', contractNumber);

    if (cutoutTasks?.length) {
      const cutoutTaskId = cutoutTasks[0].id;

      // جلب أسعار من أخت بنفس المقاس
      const { data: siblingCutout } = await supabase
        .from('cutout_task_items')
        .select('*')
        .eq('task_id', cutoutTaskId)
        .limit(1)
        .single();

      const { data: existingCutout } = await supabase
        .from('cutout_task_items')
        .select('id')
        .eq('task_id', cutoutTaskId)
        .eq('billboard_id', billboardId);

      if (!existingCutout?.length) {
        const newCutoutItem: any = {
          task_id: cutoutTaskId,
          billboard_id: billboardId,
          status: 'pending',
          quantity: 1,
          unit_cost: siblingCutout?.unit_cost || 0,
          total_cost: siblingCutout?.unit_cost || 0,
        };

        await supabase.from('cutout_task_items').insert(newCutoutItem);
        added.push('مهمة القص');
      }
    }
  }

  return { added };
}
