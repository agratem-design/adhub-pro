import { supabase } from '@/integrations/supabase/client';

/**
 * جلب جميع تصاميم العقد مع الفولباك الكامل المطابق لكروت العقود واللوحات
 */
export async function fetchContractDesignUrls(contractNumber: number): Promise<string[]> {
  if (!contractNumber || !Number.isFinite(contractNumber)) return [];

  const allImages: string[] = [];
  const addImage = (url: string | null | undefined) => {
    if (typeof url === 'string' && url.trim() && !allImages.includes(url.trim())) {
      allImages.push(url.trim());
    }
  };

  try {
    // ✅ 1. مهام التركيب المباشرة لهذا العقد (الأحدث أولاً)
    const { data: tasks } = await supabase
      .from('installation_tasks')
      .select('id, reinstallation_number, task_type')
      .eq('contract_id', contractNumber)
      .order('reinstallation_number', { ascending: false, nullsFirst: false });

    if (tasks && tasks.length > 0) {
      for (const task of tasks) {
        const { data: items } = await supabase
          .from('installation_task_items')
          .select('design_face_a, design_face_b')
          .eq('task_id', task.id)
          .or('design_face_a.not.is.null,design_face_b.not.is.null');

        (items || []).forEach(item => {
          addImage(item.design_face_a);
          addImage(item.design_face_b);
        });

        if (allImages.length > 0) break;

        const { data: taskDesigns } = await supabase
          .from('task_designs')
          .select('design_face_a_url, design_face_b_url')
          .eq('task_id', task.id);

        (taskDesigns || []).forEach(td => {
          addImage(td.design_face_a_url);
          addImage(td.design_face_b_url);
        });

        if (allImages.length > 0) break;
      }
    }

    // ✅ 2. المهام المدمجة (contract_ids يتضمن رقم العقد)
    if (allImages.length === 0) {
      const { data: combinedTasks } = await supabase
        .from('installation_tasks')
        .select('id')
        .contains('contract_ids', [contractNumber]);

      if (combinedTasks && combinedTasks.length > 0) {
        const taskIds = combinedTasks.map(t => t.id);
        const { data: items } = await supabase
          .from('installation_task_items')
          .select(`design_face_a, design_face_b, billboard:billboards!installation_task_items_billboard_id_fkey(Contract_Number)`)
          .in('task_id', taskIds)
          .or('design_face_a.not.is.null,design_face_b.not.is.null');

        (items || []).forEach(item => {
          const billboard = item.billboard as any;
          if (billboard?.Contract_Number === contractNumber) {
            addImage(item.design_face_a);
            addImage(item.design_face_b);
          }
        });

        if (allImages.length === 0) {
          const { data: taskDesigns } = await supabase
            .from('task_designs')
            .select('design_face_a_url, design_face_b_url')
            .in('task_id', taskIds);

          (taskDesigns || []).forEach(td => {
            addImage(td.design_face_a_url);
            addImage(td.design_face_b_url);
          });
        }
      }
    }

    // ✅ 2.5. المهام المجمعة عبر composite_tasks
    if (allImages.length === 0) {
      const { data: compositeTasks } = await supabase
        .from('composite_tasks')
        .select('installation_task_id')
        .eq('contract_id', contractNumber)
        .not('installation_task_id', 'is', null);

      if (compositeTasks && compositeTasks.length > 0) {
        const taskIds = compositeTasks.map(ct => ct.installation_task_id).filter((id): id is string => id !== null);
        if (taskIds.length > 0) {
          const { data: items } = await supabase
            .from('installation_task_items')
            .select(`design_face_a, design_face_b, billboard:billboards!installation_task_items_billboard_id_fkey(Contract_Number)`)
            .in('task_id', taskIds)
            .or('design_face_a.not.is.null,design_face_b.not.is.null');

          (items || []).forEach(item => {
            const billboard = item.billboard as any;
            if (billboard?.Contract_Number === contractNumber) {
              addImage(item.design_face_a);
              addImage(item.design_face_b);
            }
          });

          if (allImages.length === 0) {
            const { data: taskDesigns } = await supabase
              .from('task_designs')
              .select('design_face_a_url, design_face_b_url')
              .in('task_id', taskIds);

            (taskDesigns || []).forEach(td => {
              addImage(td.design_face_a_url);
              addImage(td.design_face_b_url);
            });
          }
        }
      }
    }

    // ✅ 3. البحث عبر لوحات العقد (installation_task_items)
    if (allImages.length === 0) {
      const { data: contractBillboards } = await supabase
        .from('billboards')
        .select('ID')
        .eq('Contract_Number', contractNumber);

      if (contractBillboards && contractBillboards.length > 0) {
        const billboardIds = contractBillboards.map(b => b.ID);
        const { data: designItems } = await supabase
          .from('installation_task_items')
          .select('design_face_a, design_face_b, task_id')
          .in('billboard_id', billboardIds)
          .or('design_face_a.not.is.null,design_face_b.not.is.null');

        if (designItems && designItems.length > 0) {
          const dTaskIds = [...new Set(designItems.map(d => d.task_id).filter(Boolean))];
          if (dTaskIds.length > 0) {
            const { data: dTasks } = await supabase
              .from('installation_tasks')
              .select('id, contract_id, contract_ids')
              .in('id', dTaskIds);

            const taskMap = new Map((dTasks || []).map(t => [t.id, t]));
            designItems.forEach(item => {
              const task = taskMap.get(item.task_id);
              if (!task) return;
              if (task.contract_id === contractNumber ||
                  (Array.isArray(task.contract_ids) && task.contract_ids.includes(contractNumber))) {
                addImage(item.design_face_a);
                addImage(item.design_face_b);
              }
            });
          }
        }
      }
    }

    // ✅ 4. design_data المحفوظة في العقد جدول Contract
    if (allImages.length === 0) {
      const { data: contractData } = await supabase
        .from('Contract')
        .select('design_data')
        .eq('Contract_Number', contractNumber)
        .maybeSingle();

      if (contractData?.design_data) {
        try {
          const designData = typeof contractData.design_data === 'string'
            ? JSON.parse(contractData.design_data)
            : contractData.design_data;

          if (Array.isArray(designData)) {
            for (const d of designData) {
              const fA = typeof d?.designFaceA === 'string' && d.designFaceA.trim() ? d.designFaceA.trim() : null;
              const fB = typeof d?.designFaceB === 'string' && d.designFaceB.trim() ? d.designFaceB.trim() : null;
              const img = typeof d?.billboardImage === 'string' && d.billboardImage.trim() ? d.billboardImage.trim() : null;
              addImage(fA || fB || img);
            }
          }
        } catch (e) { /* ignore */ }
      }
    }

    // ✅ 5. فولباك مباشر من صور اللوحات في جدول billboards
    if (allImages.length === 0) {
      const { data: billboards } = await supabase
        .from('billboards')
        .select('Image_URL, design_face_a, design_face_b')
        .eq('Contract_Number', contractNumber);

      (billboards || []).forEach(b => {
        addImage(b.design_face_a);
        addImage(b.design_face_b);
        addImage(b.Image_URL);
      });
    }
  } catch (err) {
    console.error('Error fetching contract design URLs:', err);
  }

  return allImages;
}
