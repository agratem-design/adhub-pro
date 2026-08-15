import JSZip from 'jszip';
import { buildImagePath, sanitizeName } from './contractExportNaming';

export interface ExportInstallationTaskImagesZipOptions {
  /** رقم العقد (يستخدم لاسم المجلد) */
  contractNumber: string | number;
  /** اسم الزبون (لاسم المجلد) */
  customerName?: string;
  /** عناصر المهمة (installation_task_items) — billboard_id + installed_image_face_a/b_url */
  taskItems: Array<{
    billboard_id: number;
    installed_image_face_a_url?: string | null;
    installed_image_face_b_url?: string | null;
  }>;
  /** خريطة معلومات اللوحات للحصول على الاسم/الصورة الأساسية وغيرها */
  billboardById: Record<number, any>;
  /** نوع إعلان العقد (يُكتب لكل صف في CSV) */
  contractAdType?: string;
  /** اسم مخصص لمجلد ZIP — اختياري */
  customFolderName?: string;
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
 * تنزيل صور مهمة تركيب (الصورة الأساسية + صور التركيب الأمامي/الخلفي)
 * كملف ZIP يطابق هيكل تنزيل صور العقد:
 *   مجلد_جذر/
 *     ├── file.csv
 *     └── images/
 *         └── KH-SK0134_main.jpg
 *         └── KH-SK0134_A.jpg
 *         └── KH-SK0134_B.jpg
 */
export async function exportInstallationTaskImagesToZip({
  contractNumber,
  customerName = '',
  taskItems,
  billboardById,
  contractAdType = '',
  customFolderName,
  onProgress,
}: ExportInstallationTaskImagesZipOptions): Promise<{ added: number; failed: number }> {
  if (!taskItems || taskItems.length === 0) {
    throw new Error('لا توجد لوحات في هذه المهمة');
  }

  // اسم المجلد — مطابق لتسمية تصدير العقد
  const num = sanitizeName(String(contractNumber || ''));
  const cust = sanitizeName(String(customerName || ''));
  const defaultFolder = ['مهمة', 'عقد', num, cust].filter(Boolean).join('_');
  const folderName = customFolderName ? sanitizeName(customFolderName) : defaultFolder;

  // dedup: عند تكرار اسم اللوحة نضيف معرّفاً فريداً
  const usedPaths = new Set<string>();
  const dedupPath = (basePath: string, bid: number): string => {
    if (!usedPaths.has(basePath)) { usedPaths.add(basePath); return basePath; }
    const dot = basePath.lastIndexOf('.');
    const stem = dot > 0 ? basePath.slice(0, dot) : basePath;
    const ext = dot > 0 ? basePath.slice(dot) : '';
    const idTag = Number.isFinite(bid) ? `_id${bid}` : '';
    let candidate = `${stem}${idTag}${ext}`;
    let n = 2;
    while (usedPaths.has(candidate)) { candidate = `${stem}${idTag}_${n}${ext}`; n++; }
    usedPaths.add(candidate);
    return candidate;
  };

  // بناء الأسطر و قائمة التنزيل
  const tasks: FetchTask[] = [];
  type Row = {
    bid: number;
    billboardName: string;
    nearestLandmark: string;
    municipality: string;
    size: string;
    facesCount: string;
    billboardType: string;
    coords: string;
    mainUrl: string;
    mainPath: string;
    faceA: string;
    facePathA: string;
    faceB: string;
    facePathB: string;
  };
  const rowsData: Row[] = [];

  for (const it of taskItems) {
    const bid = Number(it.billboard_id);
    const b = billboardById[bid] || {};
    const billboardName = String(b.Billboard_Name || b.name || bid || '');
    const mainUrl = String(b.Image_URL || b.image_url || b.image || '');
    const faceA = String(it.installed_image_face_a_url || '');
    const faceB = String(it.installed_image_face_b_url || '');

    const mainPath = mainUrl ? dedupPath(buildImagePath({ billboardName, suffix: 'main', url: mainUrl }), bid) : '';
    const facePathA = faceA ? dedupPath(buildImagePath({ billboardName, suffix: 'A', url: faceA }), bid) : '';
    const facePathB = faceB ? dedupPath(buildImagePath({ billboardName, suffix: 'B', url: faceB }), bid) : '';

    if (mainUrl) tasks.push({ url: mainUrl, pathInZip: `${folderName}/${mainPath}` });
    if (faceA) tasks.push({ url: faceA, pathInZip: `${folderName}/${facePathA}` });
    if (faceB) tasks.push({ url: faceB, pathInZip: `${folderName}/${facePathB}` });

    rowsData.push({
      bid,
      billboardName,
      nearestLandmark: String(b.Nearest_Landmark || b.nearest_landmark || b.location || ''),
      municipality: String(b.Municipality || b.municipality || b.City || ''),
      size: String(b.Size || b.size || ''),
      facesCount: String(b.Faces_Count || b.faces_count || b.Faces || b.faces || ''),
      billboardType: String(b.billboard_type || b.Ad_Type || b.ad_type || b.type || ''),
      coords: String(b.GPS_Coordinates || b.coordinates || b.coords || ''),
      mainUrl,
      mainPath,
      faceA,
      facePathA,
      faceB,
      facePathB,
    });
  }

  if (tasks.length === 0) {
    throw new Error('لا توجد صور لتنزيلها لهذه المهمة');
  }

  // تنزيل بالتوازي
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
      const t = tasks[idx];
      const blob = await fetchAsBlob(t.url);
      if (blob) {
        zip.file(t.pathInZip, blob);
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

  // بناء CSV (UTF-16 BE) بنفس هيكل تنزيل صور العقد
  const headers = [
    'اسم اللوحة',
    'أقرب نقطة دالة',
    'البلدية',
    'المقاس',
    'عدد الأوجه',
    'نوع اللوحة',
    '@IMAGE_URL',
    '@IMAGE_NAME',
    'إحداثيات اللوحة',
    'اسم الزبون',
    'نوع الإعلان',
    '@IMAGE_INSTALLED_FACE_A_URL',
    '@IMAGE_INSTALLED_FACE_A_NAME',
    '@IMAGE_INSTALLED_FACE_B_URL',
    '@IMAGE_INSTALLED_FACE_B_NAME',
  ];
  const rows: string[][] = rowsData.map(r => [
    r.billboardName,
    r.nearestLandmark,
    r.municipality,
    r.size,
    r.facesCount,
    r.billboardType,
    r.mainUrl,
    r.mainPath,
    r.coords,
    String(customerName || ''),
    String(contractAdType || r.billboardType || ''),
    r.faceA,
    r.facePathA,
    r.faceB,
    r.facePathB,
  ]);

  const TAB = '\t';
  const CRLF = '\r\n';
  const escapeCell = (v: string) => v.replace(/[\t\r\n]+/g, ' ');
  const lines: string[] = [];
  lines.push(headers.map(escapeCell).join(TAB));
  for (const r of rows) lines.push(r.map(escapeCell).join(TAB));
  const text = lines.join(CRLF) + CRLF;

  // UTF-16 BE + BOM
  const csvBytes = encodeUtf16BE(text);
  const ab = new ArrayBuffer(csvBytes.byteLength);
  new Uint8Array(ab).set(csvBytes);
  const csvName = `${folderName}.csv`;
  zip.file(`${folderName}/${csvName}`, ab);

  // توليد ZIP وتنزيله
  const blob = await zip.generateAsync({ type: 'blob' }, (meta) => {
    if (onProgress && meta.percent != null) onProgress(total, total);
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

function encodeUtf16BE(str: string): Uint8Array {
  const len = str.length;
  const buf = new Uint8Array(2 + len * 2);
  buf[0] = 0xfe; buf[1] = 0xff;
  for (let i = 0; i < len; i++) {
    const code = str.charCodeAt(i);
    buf[2 + i * 2] = (code >> 8) & 0xff;
    buf[2 + i * 2 + 1] = code & 0xff;
  }
  return buf;
}
