import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import type { GalleryTask } from '@/hooks/useImageGallery';
import { createFileNameDeduplicator, deduplicateBaseName } from '@/utils/fileNameDedup';

const EXPORT_MARKER = 'task_images_v1';

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim();
}

function shortId(id: string | null): string {
  if (!id) return '';
  return id.replace(/-/g, '').slice(0, 8);
}

function getExtension(url: string): string {
  const match = url.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?|$)/i);
  return match ? `.${match[1].toLowerCase()}` : '.jpg';
}

function getZipFileName(row: TaskImageRow): string {
  const name = sanitizeFileName(row.zipBaseName);
  const ext = getExtension(row.imageUrl);
  return `${name}${ext}`;
}

function getZipFileNameNoExt(row: TaskImageRow): string {
  return sanitizeFileName(row.zipBaseName);
}

interface TaskImageRow {
  source: string;
  marker: string;
  taskId: string;
  contractId: number;
  customerName: string;
  adType: string;
  imageName: string;
  imageUrl: string;
  imageType: string;
  billboardName: string;
  billboardId: number | null;
  recordId: string | null;  // merged itemId or designId
  recordType: 'design' | 'item';
  zipBaseName: string; // matches the actual filename used in ZIP export
}

function getImageSource(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'غير معروف';
  }
}

function flattenTaskImages(tasks: GalleryTask[]): TaskImageRow[] {
  const rows: TaskImageRow[] = [];

  for (const task of tasks) {
    for (const d of task.designs) {
      const dn = sanitizeFileName(d.designName);
      const sid = shortId(d.id);
      if (d.faceAUrl) rows.push({
        source: getImageSource(d.faceAUrl), marker: EXPORT_MARKER,
        taskId: task.taskId, contractId: task.contractId,
        customerName: task.customerName, adType: task.adType,
        imageName: `${d.designName} - وجه أ`, imageUrl: d.faceAUrl,
        imageType: 'تصميم وجه أ', billboardName: '', billboardId: null,
        recordId: d.id, recordType: 'design',
        zipBaseName: `${dn} - وجه أمامي - ${sid}`,
      });
      if (d.faceBUrl) rows.push({
        source: getImageSource(d.faceBUrl), marker: EXPORT_MARKER,
        taskId: task.taskId, contractId: task.contractId,
        customerName: task.customerName, adType: task.adType,
        imageName: `${d.designName} - وجه ب`, imageUrl: d.faceBUrl,
        imageType: 'تصميم وجه ب', billboardName: '', billboardId: null,
        recordId: d.id, recordType: 'design',
        zipBaseName: `${dn} - وجه خلفي - ${sid}`,
      });
      if (d.cutoutUrl) rows.push({
        source: getImageSource(d.cutoutUrl), marker: EXPORT_MARKER,
        taskId: task.taskId, contractId: task.contractId,
        customerName: task.customerName, adType: task.adType,
        imageName: `${d.designName} - مجسم`, imageUrl: d.cutoutUrl,
        imageType: 'مجسم', billboardName: '', billboardId: null,
        recordId: d.id, recordType: 'design',
        zipBaseName: `${dn} - مجسم - ${sid}`,
      });
    }

    for (const item of task.items) {
      const bbName = sanitizeFileName(item.billboardName);
      const sid = shortId(item.id);
      if (item.designFaceA) rows.push({
        source: getImageSource(item.designFaceA), marker: EXPORT_MARKER,
        taskId: task.taskId, contractId: task.contractId,
        customerName: task.customerName, adType: task.adType,
        imageName: `${item.billboardName} - تصميم وجه أ`, imageUrl: item.designFaceA,
        imageType: 'تصميم وجه أ', billboardName: item.billboardName, billboardId: item.billboardId,
        recordId: item.id, recordType: 'item',
        zipBaseName: `${bbName} - تصميم وجه أمامي - ${task.adType} - ${sid}`,
      });
      if (item.designFaceB) rows.push({
        source: getImageSource(item.designFaceB), marker: EXPORT_MARKER,
        taskId: task.taskId, contractId: task.contractId,
        customerName: task.customerName, adType: task.adType,
        imageName: `${item.billboardName} - تصميم وجه ب`, imageUrl: item.designFaceB,
        imageType: 'تصميم وجه ب', billboardName: item.billboardName, billboardId: item.billboardId,
        recordId: item.id, recordType: 'item',
        zipBaseName: `${bbName} - تصميم وجه خلفي - ${task.adType} - ${sid}`,
      });
      if (item.installedFaceA) rows.push({
        source: getImageSource(item.installedFaceA), marker: EXPORT_MARKER,
        taskId: task.taskId, contractId: task.contractId,
        customerName: task.customerName, adType: task.adType,
        imageName: `${item.billboardName} - تركيب وجه أ`, imageUrl: item.installedFaceA,
        imageType: 'تركيب وجه أ', billboardName: item.billboardName, billboardId: item.billboardId,
        recordId: item.id, recordType: 'item',
        zipBaseName: `${bbName} - تركيب وجه أمامي - ${task.adType} - ${sid}`,
      });
      if (item.installedFaceB) rows.push({
        source: getImageSource(item.installedFaceB), marker: EXPORT_MARKER,
        taskId: task.taskId, contractId: task.contractId,
        customerName: task.customerName, adType: task.adType,
        imageName: `${item.billboardName} - تركيب وجه ب`, imageUrl: item.installedFaceB,
        imageType: 'تركيب وجه ب', billboardName: item.billboardName, billboardId: item.billboardId,
        recordId: item.id, recordType: 'item',
        zipBaseName: `${bbName} - تركيب وجه خلفي - ${task.adType} - ${sid}`,
      });

      // History photos (previous installations)
      for (const hp of (item.historyPhotos || [])) {
        const hpSid = shortId(hp.id);
        if (hp.installedFaceA) rows.push({
          source: getImageSource(hp.installedFaceA), marker: EXPORT_MARKER,
          taskId: task.taskId, contractId: task.contractId,
          customerName: task.customerName, adType: task.adType,
          imageName: `${item.billboardName} - تركيب سابق ${hp.reinstallNumber} وجه أ`, imageUrl: hp.installedFaceA,
          imageType: `تركيب سابق ${hp.reinstallNumber} وجه أ`, billboardName: item.billboardName, billboardId: item.billboardId,
          recordId: hp.id, recordType: 'item',
          zipBaseName: `${bbName} - تركيب سابق ${hp.reinstallNumber} وجه أمامي - ${task.adType} - ${hpSid}`,
        });
        if (hp.installedFaceB) rows.push({
          source: getImageSource(hp.installedFaceB), marker: EXPORT_MARKER,
          taskId: task.taskId, contractId: task.contractId,
          customerName: task.customerName, adType: task.adType,
          imageName: `${item.billboardName} - تركيب سابق ${hp.reinstallNumber} وجه ب`, imageUrl: hp.installedFaceB,
          imageType: `تركيب سابق ${hp.reinstallNumber} وجه ب`, billboardName: item.billboardName, billboardId: item.billboardId,
          recordId: hp.id, recordType: 'item',
          zipBaseName: `${bbName} - تركيب سابق ${hp.reinstallNumber} وجه خلفي - ${task.adType} - ${hpSid}`,
        });
      }
    }
  }

  return rows;
}

export function exportTaskImagesToExcel(tasks: GalleryTask[]) {
  const imageRows = flattenTaskImages(tasks);
  if (!imageRows.length) {
    toast.error('لا توجد صور للتصدير');
    return;
  }

  const dedup = createFileNameDeduplicator();
  const rows = imageRows.map(r => {
    const ext = getExtension(r.imageUrl);
    const baseName = sanitizeFileName(r.zipBaseName);
    const fullName = dedup(baseName, ext);
    const baseNameDeduped = deduplicateBaseName(baseName, fullName, ext);
    return {
      'مصدر الصورة': r.source,
      'معرف_التصدير': r.marker,
      'معرف المهمة': r.taskId,
      'رقم العقد': r.contractId,
      'العميل': r.customerName,
      'نوع الإعلان': r.adType,
      'اسم الصورة': r.imageName,
      'اسم الملف بالامتداد': fullName,
      'اسم الملف بدون امتداد': baseNameDeduped,
      'رابط الصورة': r.imageUrl,
      'نوع الصورة': r.imageType,
      'اسم اللوحة': r.billboardName,
      'معرف اللوحة': r.billboardId || '',
      'معرف السجل': r.recordId || '',
      'نوع السجل': r.recordType,
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'معرض الصور');

  ws['!cols'] = [
    { wch: 30 }, { wch: 18 }, { wch: 36 }, { wch: 12 },
    { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 35 },
    { wch: 30 }, { wch: 50 }, { wch: 15 }, { wch: 20 },
    { wch: 12 }, { wch: 36 }, { wch: 10 },
  ];

  XLSX.writeFile(wb, `معرض_صور_المهام_${new Date().toLocaleDateString('ar-LY')}.xlsx`);
  toast.success(`تم تصدير ${imageRows.length} صورة إلى Excel`);
}

const typeToDesignField: Record<string, string> = {
  'تصميم وجه أ': 'design_face_a_url',
  'تصميم وجه ب': 'design_face_b_url',
  'مجسم': 'cutout_image_url',
};

const typeToItemField: Record<string, string> = {
  'تصميم وجه أ': 'design_face_a',
  'تصميم وجه ب': 'design_face_b',
  'تركيب وجه أ': 'installed_image_face_a_url',
  'تركيب وجه ب': 'installed_image_face_b_url',
};

// Expected columns and their possible aliases
const EXPECTED_COLUMNS: Record<string, string[]> = {
  'رابط الصورة': ['رابط الصورة', 'image_url', 'url', 'رابط'],
  'نوع الصورة': ['نوع الصورة', 'image_type', 'نوع'],
  'معرف السجل': ['معرف السجل', 'record_id', 'معرف التصميم', 'معرف العنصر'],
  'نوع السجل': ['نوع السجل', 'record_type'],
  'معرف_التصدير': ['معرف_التصدير', 'export_marker'],
  'العميل': ['العميل', 'customer', 'اسم العميل'],
  'رقم العقد': ['رقم العقد', 'contract_number', 'العقد'],
  'نوع الإعلان': ['نوع الإعلان', 'ad_type'],
  'اسم الصورة': ['اسم الصورة', 'image_name'],
  'اسم اللوحة': ['اسم اللوحة', 'billboard_name'],
};

export interface ColumnMappingEntry {
  expectedCol: string;
  mappedCol: string | null;
  required: boolean;
}

export interface TaskImportPreview {
  designUpdates: { designId: string; field: string; url: string }[];
  itemUpdates: { itemId: string; field: string; url: string }[];
  contractDesignUpdates: { contractId: number; designIndex: number; field: string; url: string }[];
  totalRows: number;
  validRows: number;
  isValidFormat: boolean;
  errors: string[];
  fileName?: string;
  fileHeaders: string[];
  columnMapping: ColumnMappingEntry[];
  sampleRows: Record<string, any>[];
  rawRows: Record<string, any>[];
}

function autoMapColumn(header: string): string | null {
  const normalized = header.trim().toLowerCase();
  for (const [expected, aliases] of Object.entries(EXPECTED_COLUMNS)) {
    for (const alias of aliases) {
      if (alias.toLowerCase() === normalized) return expected;
    }
  }
  return null;
}

export async function parseTaskImagesExcel(file: File): Promise<TaskImportPreview> {
  const errors: string[] = [];
  const emptyResult: TaskImportPreview = {
    designUpdates: [], itemUpdates: [], contractDesignUpdates: [], totalRows: 0, validRows: 0,
    isValidFormat: false, errors: [], fileName: file.name,
    fileHeaders: [], columnMapping: [], sampleRows: [], rawRows: [],
  };

  try {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

    if (!rawRows.length) return { ...emptyResult, errors: ['الملف فارغ'] };

    const fileHeaders = Object.keys(rawRows[0]);
    
    // Build column mapping
    const requiredCols = ['رابط الصورة', 'نوع الصورة', 'معرف السجل', 'نوع السجل'];
    const columnMapping: ColumnMappingEntry[] = Object.keys(EXPECTED_COLUMNS).map(expectedCol => ({
      expectedCol,
      mappedCol: fileHeaders.find(h => autoMapColumn(h) === expectedCol) || null,
      required: requiredCols.includes(expectedCol),
    }));

    const hasMarker = rawRows[0]['معرف_التصدير'] === EXPORT_MARKER;
    if (!hasMarker) errors.push('الملف ليس من تصدير النظام - تحقق من مطابقة الأعمدة');

    // Get mapped column names
    const urlCol = columnMapping.find(c => c.expectedCol === 'رابط الصورة')?.mappedCol;
    const typeCol = columnMapping.find(c => c.expectedCol === 'نوع الصورة')?.mappedCol;
    const recordIdCol = columnMapping.find(c => c.expectedCol === 'معرف السجل')?.mappedCol;
    const recordTypeCol = columnMapping.find(c => c.expectedCol === 'نوع السجل')?.mappedCol;

    if (!urlCol) errors.push('لم يتم العثور على عمود "رابط الصورة"');
    if (!typeCol) errors.push('لم يتم العثور على عمود "نوع الصورة"');
    if (!recordIdCol) errors.push('لم يتم العثور على عمود "معرف السجل"');

    const designUpdates: { designId: string; field: string; url: string }[] = [];
    const itemUpdates: { itemId: string; field: string; url: string }[] = [];
    const contractDesignUpdates: { contractId: number; designIndex: number; field: string; url: string }[] = [];

    const contractIdCol = columnMapping.find(c => c.expectedCol === 'رقم العقد')?.mappedCol;

    if (urlCol && typeCol && recordIdCol) {
      for (const row of rawRows) {
        const url = String(row[urlCol] || '').trim();
        const imageType = String(row[typeCol] || '').trim();
        const recordId = String(row[recordIdCol] || '').trim();
        const recordType = recordTypeCol ? String(row[recordTypeCol] || '').trim() : '';

        const designId = recordType === 'design' ? recordId : String(row['معرف التصميم'] || '').trim();
        const itemId = recordType === 'item' ? recordId : String(row['معرف العنصر'] || '').trim();

        if (!url || !url.startsWith('http')) continue;

        // Handle virtual contract-design IDs by updating Contract.design_data
        const contractDesignMatch = designId.match(/^contract-design-(\d+)$/);
        if (contractDesignMatch && typeToDesignField[imageType]) {
          const contractIdValue = contractIdCol ? Number(row[contractIdCol]) : 0;
          if (contractIdValue > 0) {
            const designFieldMap: Record<string, string> = {
              'design_face_a_url': 'design_face_a',
              'design_face_b_url': 'design_face_b',
            };
            const dbField = typeToDesignField[imageType];
            const jsonField = designFieldMap[dbField] || dbField;
            contractDesignUpdates.push({
              contractId: contractIdValue,
              designIndex: Number(contractDesignMatch[1]),
              field: jsonField,
              url,
            });
          }
          continue;
        }

        if (designId && typeToDesignField[imageType]) {
          designUpdates.push({ designId, field: typeToDesignField[imageType], url });
        } else if (itemId && typeToItemField[imageType]) {
          itemUpdates.push({ itemId, field: typeToItemField[imageType], url });
        }
      }
    }

    return {
      designUpdates, itemUpdates, contractDesignUpdates,
      totalRows: rawRows.length,
      validRows: designUpdates.length + itemUpdates.length + contractDesignUpdates.length,
      isValidFormat: hasMarker,
      errors,
      fileName: file.name,
      fileHeaders,
      columnMapping,
      sampleRows: rawRows.slice(0, 3),
      rawRows,
    };
  } catch {
    return { ...emptyResult, errors: ['فشل في قراءة الملف'] };
  }
}

/** Re-process raw rows with updated column mapping */
export function reprocessWithMapping(
  prev: TaskImportPreview,
  newMapping: ColumnMappingEntry[]
): TaskImportPreview {
  const rawRows = prev.rawRows;
  if (!rawRows.length) return prev;

  const errors: string[] = [];
  const urlCol = newMapping.find(c => c.expectedCol === 'رابط الصورة')?.mappedCol;
  const typeCol = newMapping.find(c => c.expectedCol === 'نوع الصورة')?.mappedCol;
  const recordIdCol = newMapping.find(c => c.expectedCol === 'معرف السجل')?.mappedCol;
  const recordTypeCol = newMapping.find(c => c.expectedCol === 'نوع السجل')?.mappedCol;
  const contractIdCol = newMapping.find(c => c.expectedCol === 'رقم العقد')?.mappedCol;

  if (!urlCol) errors.push('لم يتم العثور على عمود "رابط الصورة"');
  if (!typeCol) errors.push('لم يتم العثور على عمود "نوع الصورة"');
  if (!recordIdCol) errors.push('لم يتم العثور على عمود "معرف السجل"');

  const designUpdates: TaskImportPreview['designUpdates'] = [];
  const itemUpdates: TaskImportPreview['itemUpdates'] = [];
  const contractDesignUpdates: TaskImportPreview['contractDesignUpdates'] = [];

  if (urlCol && typeCol && recordIdCol) {
    for (const row of rawRows) {
      const url = String(row[urlCol] || '').trim();
      const imageType = String(row[typeCol] || '').trim();
      const recordId = String(row[recordIdCol] || '').trim();
      const recordType = recordTypeCol ? String(row[recordTypeCol] || '').trim() : '';

      const designId = recordType === 'design' ? recordId : String(row['معرف التصميم'] || '').trim();
      const itemId = recordType === 'item' ? recordId : String(row['معرف العنصر'] || '').trim();

      if (!url || !url.startsWith('http')) continue;

      const contractDesignMatch = designId.match(/^contract-design-(\d+)$/);
      if (contractDesignMatch && typeToDesignField[imageType]) {
        const contractIdValue = contractIdCol ? Number(row[contractIdCol]) : 0;
        if (contractIdValue > 0) {
          const designFieldMap: Record<string, string> = {
            'design_face_a_url': 'design_face_a',
            'design_face_b_url': 'design_face_b',
          };
          const dbField = typeToDesignField[imageType];
          const jsonField = designFieldMap[dbField] || dbField;
          contractDesignUpdates.push({
            contractId: contractIdValue,
            designIndex: Number(contractDesignMatch[1]),
            field: jsonField,
            url,
          });
        }
        continue;
      }

      if (designId && typeToDesignField[imageType]) {
        designUpdates.push({ designId, field: typeToDesignField[imageType], url });
      } else if (itemId && typeToItemField[imageType]) {
        itemUpdates.push({ itemId, field: typeToItemField[imageType], url });
      }
    }
  }

  return {
    ...prev,
    designUpdates,
    itemUpdates,
    contractDesignUpdates,
    validRows: designUpdates.length + itemUpdates.length + contractDesignUpdates.length,
    errors,
    columnMapping: newMapping,
  };
}
