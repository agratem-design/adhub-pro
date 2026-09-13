import { supabase } from '@/integrations/supabase/client';

export const contractDesignCache = new Map<number, string[]>();

/**
 * جلب جميع تصاميم العقد مع الفولباك الكامل المطابق تماماً لـ ContractCard
 * يضمن نفس ترتيب الأولويات، والترتيب التصاعدي لتصاميم المهمة، ودعم الكاش.
 */
export async function fetchContractDesignUrls(
  contractNumber: number,
  contractObj?: any
): Promise<string[]> {
  if (!contractNumber || !Number.isFinite(contractNumber)) return [];

  // 0. فحص الذاكرة المؤقتة (Cache)
  if (contractDesignCache.has(contractNumber)) {
    const cached = contractDesignCache.get(contractNumber) || [];
    if (cached.length > 0) return cached;
  }

  const allImages: string[] = [];
  const addImage = (url: unknown) => {
    if (typeof url === 'string') {
      const trimmed = url.trim();
      if (
        trimmed &&
        (trimmed.startsWith('http') || trimmed.startsWith('/') || trimmed.startsWith('data:')) &&
        !allImages.includes(trimmed)
      ) {
        allImages.push(trimmed);
      }
    }
  };

  try {
    // 1. استخراج التصاميم المضمنة مباشرة في العقد (design_data)
    let rawInlineDesigns = contractObj?.design_data;
    if (rawInlineDesigns === undefined) {
      const { data: contractRow } = await supabase
        .from('Contract')
        .select('design_data, billboard_ids')
        .eq('Contract_Number', contractNumber)
        .maybeSingle();

      if (contractRow) {
        rawInlineDesigns = contractRow.design_data;
        if (!contractObj) contractObj = contractRow;
        else if (!(contractObj as any).billboard_ids && contractRow.billboard_ids) {
          (contractObj as any).billboard_ids = contractRow.billboard_ids;
        }
      }
    }

    if (rawInlineDesigns) {
      try {
        let parsed = typeof rawInlineDesigns === 'string'
          ? JSON.parse(rawInlineDesigns)
          : rawInlineDesigns;
        // التعامل مع JSON مشفر مرتين (double-stringified)
        if (typeof parsed === 'string') {
          try {
            parsed = JSON.parse(parsed);
          } catch {}
        }
        if (Array.isArray(parsed)) {
          parsed.forEach((design: any) => {
            addImage(design?.designFaceA || design?.faceA || design?.design_face_a || design?.design_face_a_url || design?.designFaceAUrl);
            addImage(design?.designFaceB || design?.faceB || design?.design_face_b || design?.design_face_b_url || design?.designFaceBUrl);
          });
        } else if (parsed && typeof parsed === 'object') {
          addImage(parsed?.designFaceA || parsed?.faceA || parsed?.design_face_a || parsed?.design_face_a_url || parsed?.designFaceAUrl);
          addImage(parsed?.designFaceB || parsed?.faceB || parsed?.design_face_b || parsed?.design_face_b_url || parsed?.designFaceBUrl);
        }
      } catch {
        // Ignore parse errors
      }
    }

    if (allImages.length > 0) {
      contractDesignCache.set(contractNumber, allImages);
      return allImages;
    }

    // 2. مهام التركيب المباشرة لهذا العقد (الأولوية القصوى - الأحدث أولاً)
    const { data: directTasks } = await supabase
      .from('installation_tasks')
      .select('id, reinstallation_number, task_type')
      .eq('contract_id', contractNumber)
      .order('reinstallation_number', { ascending: false, nullsFirst: false });

    if (directTasks && directTasks.length > 0) {
      for (const task of directTasks) {
        // أ) جلب التصاميم من جدول task_designs التابع للمهمة أولاً (مرتبة حسب الإدخال)
        const { data: taskDesigns } = await supabase
          .from('task_designs')
          .select('design_face_a_url, design_face_b_url, cutout_image_url')
          .eq('task_id', task.id)
          .order('created_at', { ascending: true });

        (taskDesigns || []).forEach(td => {
          addImage(td.design_face_a_url);
          addImage(td.design_face_b_url);
          addImage(td.cutout_image_url);
        });

        // ب) جلب التصاميم من عناصر المهمة installation_task_items
        const { data: taskItems } = await supabase
          .from('installation_task_items')
          .select('design_face_a, design_face_b')
          .eq('task_id', task.id)
          .or('design_face_a.not.is.null,design_face_b.not.is.null');

        (taskItems || []).forEach(item => {
          addImage(item.design_face_a);
          addImage(item.design_face_b);
        });

        if (allImages.length > 0) break;
      }
    }

    // 3. المهام المدمجة (combined tasks - contract_ids يحتوي على رقم العقد)
    if (allImages.length === 0) {
      const { data: combinedTasks } = await supabase
        .from('installation_tasks')
        .select('id')
        .contains('contract_ids', [contractNumber]);

      if (combinedTasks && combinedTasks.length > 0) {
        const taskIds = combinedTasks.map(t => t.id);
        const { data: combinedItems } = await supabase
          .from('installation_task_items')
          .select(`
            design_face_a, design_face_b,
            billboard:billboards!installation_task_items_billboard_id_fkey(Contract_Number)
          `)
          .in('task_id', taskIds)
          .or('design_face_a.not.is.null,design_face_b.not.is.null');

        (combinedItems || []).forEach(item => {
          const bb = item.billboard as any;
          if (bb?.Contract_Number === contractNumber) {
            addImage(item.design_face_a);
            addImage(item.design_face_b);
          }
        });

        if (allImages.length === 0) {
          const { data: combinedDesigns } = await supabase
            .from('task_designs')
            .select('design_face_a_url, design_face_b_url')
            .in('task_id', taskIds)
            .order('created_at', { ascending: true });

          (combinedDesigns || []).forEach(td => {
            addImage(td.design_face_a_url);
            addImage(td.design_face_b_url);
          });
        }
      }
    }

    // 4. المهام المجمعة (composite_tasks)
    if (allImages.length === 0) {
      const { data: compositeTasks } = await supabase
        .from('composite_tasks')
        .select('installation_task_id')
        .eq('contract_id', contractNumber)
        .not('installation_task_id', 'is', null);

      if (compositeTasks && compositeTasks.length > 0) {
        const itIds = compositeTasks
          .map(c => c.installation_task_id)
          .filter((id): id is string => Boolean(id));

        if (itIds.length > 0) {
          const { data: compDesigns } = await supabase
            .from('task_designs')
            .select('design_face_a_url, design_face_b_url')
            .in('task_id', itIds)
            .order('created_at', { ascending: true });

          (compDesigns || []).forEach(td => {
            addImage(td.design_face_a_url);
            addImage(td.design_face_b_url);
          });

          if (allImages.length === 0) {
            const { data: compItems } = await supabase
              .from('installation_task_items')
              .select('design_face_a, design_face_b')
              .in('task_id', itIds)
              .or('design_face_a.not.is.null,design_face_b.not.is.null');

            (compItems || []).forEach(item => {
              addImage(item.design_face_a);
              addImage(item.design_face_b);
            });
          }
        }
      }
    }

    // 5. حالة فولباك من اللوحات المرتبطة بالعقد (فقط تصاميم اللوحات وليس صور الهياكل)
    if (allImages.length === 0) {
      const bbIds = (contractObj as any)?.billboard_ids
        ? String((contractObj as any).billboard_ids)
            .split(',')
            .map(s => Number(s.trim()))
            .filter(n => Number.isFinite(n) && n > 0)
        : [];

      if (bbIds.length > 0) {
        const { data: latestPreviousItem } = await supabase
          .from('installation_task_items')
          .select('design_face_a, design_face_b')
          .in('billboard_id', bbIds)
          .or('design_face_a.not.is.null,design_face_b.not.is.null')
          .order('created_at', { ascending: false })
          .limit(1);

        if (latestPreviousItem && latestPreviousItem.length > 0) {
          addImage(latestPreviousItem[0].design_face_a);
          addImage(latestPreviousItem[0].design_face_b);
        }
      }

      if (allImages.length === 0) {
        const { data: billboards } = await supabase
          .from('billboards')
          .select('design_face_a, design_face_b')
          .eq('Contract_Number', contractNumber);

        (billboards || []).forEach(b => {
          addImage(b.design_face_a);
          addImage(b.design_face_b);
        });
      }
    }

    contractDesignCache.set(contractNumber, allImages);
  } catch (err) {
    console.error('Error fetching contract design URLs:', contractNumber, err);
  }

  return allImages;
}
