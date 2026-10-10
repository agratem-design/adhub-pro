import { supabase } from '@/integrations/supabase/client';
import { generateFallbackPath } from '@/utils/fallbackPathGenerator';

export async function assignBoardDesign(item: any, design: any | null, contractId?: number) {
  const faceA = design?.design_face_a_url || null;
  const faceB = design?.design_face_b_url || null;
  const { error } = await supabase.from('installation_task_items').update({
    selected_design_id: design?.id || null, design_face_a: faceA, design_face_b: faceB,
  }).eq('id', item.id);
  if (error) throw error;
  // Preserve the existing card's synchronization with billboard and print data.
  if (contractId) {
    const { data: printTasks, error: queryError } = await supabase.from('print_tasks').select('id').eq('contract_id', contractId);
    if (queryError) throw new Error('حُفظ التصميم، لكن تعذر تحديث بيانات الطباعة.');
    if (printTasks?.length) {
      const { error: printError } = await supabase.from('print_task_items').update({ design_face_a: faceA, design_face_b: faceB }).in('task_id', printTasks.map(t => t.id)).eq('billboard_id', item.billboard_id);
      if (printError) throw new Error('حُفظ التصميم، لكن تعذر تحديث بيانات الطباعة.');
    }
    const { error: boardError } = await supabase.from('billboards').update({ design_face_a: faceA, design_face_b: faceB }).eq('ID', item.billboard_id);
    if (boardError) throw new Error('حُفظ تصميم المهمة، لكن تعذر تحديث تصميم اللوحة.');
  }
}

export async function saveBoardPhotos(item: any, billboard: any, adType: string, faceA: string, faceB: string) {
  const name = billboard?.Billboard_Name || `لوحة ${item.billboard_id}`;
  const { error } = await supabase.from('installation_task_items').update({
    installed_image_url: item.installed_image_url || null,
    installed_image_face_a_url: faceA || null,
    installed_image_face_b_url: faceB || null,
    fallback_path_installed_a: faceA ? generateFallbackPath(name, 'installed', 'face_a', adType, item.id, faceA) : null,
    fallback_path_installed_b: faceB ? generateFallbackPath(name, 'installed', 'face_b', adType, item.id, faceB) : null,
  }).eq('id', item.id);
  if (error) throw error;
}
