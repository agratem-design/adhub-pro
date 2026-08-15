import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';
import { buildContractFolderName, buildImagePath } from './contractExportNaming';
import { buildBillboardsCsvBlob } from './exportBillboardsToCSV';

export interface ExportContractImagesZipOptions {
  contractNumber: string | number;
  billboards: any[];
  customerName?: string;
  includePrices?: boolean;
  onProgress?: (done: number, total: number) => void;
}

interface FetchTask {
  url: string;
  pathInZip: string;
}

async function fetchAsBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

/**
 * تنزيل صور لوحات العقد (الصورة الأساسية + صور التركيب الأمامي/الخلفي)
 * كملف ZIP. اسم الملف ZIP و اسم المجلد الجذر داخله متطابقان مع
 * المسار المكتوب في عمود الصور بملف CSV (images/{folder}/...).
 */
export async function exportContractImagesToZip({
  contractNumber,
  billboards,
  customerName = '',
  includePrices = false,
  onProgress,
}: ExportContractImagesZipOptions): Promise<{ added: number; failed: number }> {
  if (!billboards || billboards.length === 0) {
    throw new Error('لا توجد لوحات للتصدير');
  }

  const folderName = buildContractFolderName({ contractNumber, customerName });

  // جلب صور التركيب من قاعدة البيانات (نفس منطق CSV)
  const billboardIds = billboards
    .map((b) => Number(b.ID ?? b.id))
    .filter((id) => Number.isFinite(id));

  const installedImagesMap = new Map<number, { faceA: string; faceB: string }>();
  const cnNum = Number(contractNumber);
  const hasContract = Number.isFinite(cnNum);

  if (billboardIds.length > 0) {
    // 1) جلب صور التركيب الخاصة بهذا العقد فقط (عبر installation_tasks.contract_id أو contract_ids)
    if (hasContract) {
      try {
        const { data: contractTasks } = await supabase
          .from('installation_tasks')
          .select('id')
          .or(`contract_id.eq.${cnNum},contract_ids.cs.{${cnNum}}`);
        const taskIds = (contractTasks || []).map((t: any) => t.id).filter(Boolean);

        if (taskIds.length > 0) {
          const { data: items } = await supabase
            .from('installation_task_items')
            .select('billboard_id, installed_image_face_a_url, installed_image_face_b_url, created_at, task_id')
            .in('billboard_id', billboardIds)
            .in('task_id', taskIds)
            .order('created_at', { ascending: false });
          if (items) {
            for (const it of items as any[]) {
              const bid = Number(it.billboard_id);
              if (!Number.isFinite(bid)) continue;
              const existing = installedImagesMap.get(bid);
              if (existing && (existing.faceA || existing.faceB)) continue;
              const faceA = it.installed_image_face_a_url || '';
              const faceB = it.installed_image_face_b_url || '';
              if (!faceA && !faceB) continue;
              installedImagesMap.set(bid, { faceA, faceB });
            }
          }
        }
      } catch (err) {
        console.warn('[exportContractImagesToZip] contract-scoped install items error:', err);
      }
    }

    // 2) Fallback: billboard_history مفلتر بنفس رقم العقد
    const missingIds = billboardIds.filter((id) => {
      const e = installedImagesMap.get(id);
      return !e || (!e.faceA && !e.faceB);
    });
    if (missingIds.length > 0 && hasContract) {
      try {
        const { data: histItems } = await supabase
          .from('billboard_history')
          .select('billboard_id, installed_image_face_a_url, installed_image_face_b_url, updated_at, contract_number')
          .in('billboard_id', missingIds)
          .eq('contract_number', cnNum)
          .order('updated_at', { ascending: false });
        if (histItems) {
          for (const h of histItems as any[]) {
            const bid = Number(h.billboard_id);
            if (!Number.isFinite(bid)) continue;
            const existing = installedImagesMap.get(bid);
            if (existing && (existing.faceA || existing.faceB)) continue;
            if (!h.installed_image_face_a_url && !h.installed_image_face_b_url) continue;
            installedImagesMap.set(bid, {
              faceA: h.installed_image_face_a_url || '',
              faceB: h.installed_image_face_b_url || '',
            });
          }
        }
      } catch (err) {
        console.warn('[exportContractImagesToZip] billboard_history error:', err);
      }
    }
  }

  // بناء قائمة المهام — كل المسارات داخل ZIP تكون تحت مجلد جذر باسم العقد
  // بحيث: {folderName}/file.csv  و  {folderName}/images/{folderName}/...
  // وهذا يطابق ما هو مكتوب في عمود @IMAGE_NAME داخل CSV (مسار نسبي يبدأ بـ images/)
  // dedup: عند تكرار اسم اللوحة في نفس العقد نضيف معرّف اللوحة لجعل اسم الملف فريداً
  const usedPaths = new Set<string>();
  const dedupPath = (basePath: string, bid: number): string => {
    if (!usedPaths.has(basePath)) {
      usedPaths.add(basePath);
      return basePath;
    }
    // basePath يشبه: images/<name>_<suffix>.<ext>
    const dot = basePath.lastIndexOf('.');
    const stem = dot > 0 ? basePath.slice(0, dot) : basePath;
    const ext = dot > 0 ? basePath.slice(dot) : '';
    const idTag = Number.isFinite(bid) ? `_id${bid}` : '';
    let candidate = `${stem}${idTag}${ext}`;
    let n = 2;
    while (usedPaths.has(candidate)) {
      candidate = `${stem}${idTag}_${n}${ext}`;
      n++;
    }
    usedPaths.add(candidate);
    return candidate;
  };

  const tasks: FetchTask[] = [];
  for (const b of billboards) {
    const bid = Number(b.ID ?? b.id);
    const billboardName = String(b.Billboard_Name || b.name || b.ID || b.id || '');
    const mainUrl = String(b.Image_URL || b.image_url || b.image || '');
    if (mainUrl) {
      const base = buildImagePath({ billboardName, suffix: 'main', url: mainUrl });
      tasks.push({ url: mainUrl, pathInZip: `${folderName}/${dedupPath(base, bid)}` });
    }
    const installed = installedImagesMap.get(bid) || { faceA: '', faceB: '' };
    if (installed.faceA) {
      const base = buildImagePath({ billboardName, suffix: 'A', url: installed.faceA });
      tasks.push({ url: installed.faceA, pathInZip: `${folderName}/${dedupPath(base, bid)}` });
    }
    if (installed.faceB) {
      const base = buildImagePath({ billboardName, suffix: 'B', url: installed.faceB });
      tasks.push({ url: installed.faceB, pathInZip: `${folderName}/${dedupPath(base, bid)}` });
    }
  }

  if (tasks.length === 0) {
    throw new Error('لا توجد صور لتنزيلها لهذا العقد');
  }

  // تنزيل بالتوازي مع حد أقصى
  const zip = new JSZip();
  let added = 0;
  let failed = 0;
  let done = 0;
  const total = tasks.length;
  const concurrency = 6;

  let cursor = 0;
  const worker = async () => {
    while (cursor < tasks.length) {
      const idx = cursor++;
      const task = tasks[idx];
      const blob = await fetchAsBlob(task.url);
      if (blob) {
        zip.file(task.pathInZip, blob);
        added++;
      } else {
        failed++;
      }
      done++;
      onProgress?.(done, total);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));

  if (added === 0) {
    throw new Error('فشل تنزيل الصور (تحقّق من صلاحيات CORS أو الروابط)');
  }

  // إضافة ملف CSV بجانب مجلد images داخل المجلد الجذر
  try {
    const { blob: csvBlob, fileName: csvName } = await buildBillboardsCsvBlob({
      contractNumber,
      billboards,
      customerName,
      includePrices,
    });
    const csvBuffer = await csvBlob.arrayBuffer();
    zip.file(`${folderName}/${csvName}`, csvBuffer);
  } catch (err) {
    console.warn('[exportContractImagesToZip] failed to add CSV:', err);
  }

  // توليد ZIP وتنزيله — اسم الملف نفس اسم المجلد الجذر
  const blob = await zip.generateAsync({ type: 'blob' }, (meta) => {
    if (onProgress && meta.percent != null) {
      // تقدّم مرحلة الضغط (بعد التنزيل)
      onProgress(total, total);
    }
  });
  const fileName = `${folderName}.zip`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);

  return { added, failed };
}
