import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { createFileNameDeduplicator, deduplicateBaseName } from '@/utils/fileNameDedup';

// ========== Constants ==========
const EXPORT_MARKER = 'billboard_photos_v1';

function sanitizeFileNameExcel(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim();
}

function getExtensionExcel(url: string): string {
  const match = url.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?|$)/i);
  return match ? `.${match[1].toLowerCase()}` : '.jpg';
}

const COLUMNS = {
  source: 'مصدر الصورة',
  marker: 'معرف_التصدير',
  id: 'معرف اللوحة',
  name: 'اسم اللوحة',
  imageName: 'اسم الصورة',
  fileNameWithExt: 'اسم الملف بالامتداد',
  fileNameNoExt: 'اسم الملف بدون امتداد',
  imageUrl: 'رابط الصورة',
  city: 'المدينة',
  municipality: 'البلدية',
  size: 'المقاس',
  status: 'الحالة',
} as const;

// ========== Types ==========
export interface PhotoRow {
  id: number;
  name: string;
  imageUrl: string;
  city: string | null;
  municipality: string | null;
  size: string | null;
  status: string | null;
}

export interface ParsedImportRow {
  id: number;
  imageUrl: string;
  imageName: string;
  originalName: string;
}

export interface ImportPreview {
  rows: ParsedImportRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  fileName: string;
  isValidFormat: boolean;
  errors: string[];
}

// ========== Helpers ==========
function getImageFileName(url: string, billboardName: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    if (lastPart && lastPart.includes('.') && lastPart.length > 2) {
      return decodeURIComponent(lastPart);
    }
  } catch { /* ignore */ }
  const extMatch = url.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?|$)/i);
  const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '.jpg';
  return `${billboardName.replace(/[\\/:*?"<>|]/g, '_').trim()}${ext}`;
}

function getImageSource(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return 'غير معروف';
  }
}

// ========== Export ==========
export function exportBillboardPhotosToExcel(photos: PhotoRow[]) {
  if (!photos.length) {
    toast.error('لا توجد صور للتصدير');
    return;
  }

  const dedup = createFileNameDeduplicator();
  const rows = photos.map(p => {
    const baseName = sanitizeFileNameExcel(p.name);
    const ext = getExtensionExcel(p.imageUrl);
    const zipName = dedup(baseName, ext);
    const zipNameNoExt = deduplicateBaseName(baseName, zipName, ext);
    return {
      [COLUMNS.source]: getImageSource(p.imageUrl),
      [COLUMNS.marker]: EXPORT_MARKER,
      [COLUMNS.id]: p.id,
      [COLUMNS.name]: p.name,
      [COLUMNS.imageName]: getImageFileName(p.imageUrl, p.name),
      [COLUMNS.fileNameWithExt]: zipName,
      [COLUMNS.fileNameNoExt]: zipNameNoExt,
      [COLUMNS.imageUrl]: p.imageUrl,
      [COLUMNS.city]: p.city || '',
      [COLUMNS.municipality]: p.municipality || '',
      [COLUMNS.size]: p.size || '',
      [COLUMNS.status]: p.status || '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'صور اللوحات');

  // Column widths
  ws['!cols'] = [
    { wch: 30 }, // source
    { wch: 18 }, // marker
    { wch: 12 }, // id
    { wch: 25 }, // name
    { wch: 30 }, // imageName
    { wch: 35 }, // fileNameWithExt
    { wch: 30 }, // fileNameNoExt
    { wch: 50 }, // imageUrl
    { wch: 15 }, // city
    { wch: 15 }, // municipality
    { wch: 12 }, // size
    { wch: 12 }, // status
  ];

  const date = new Date().toLocaleDateString('ar-LY');
  XLSX.writeFile(wb, `صور_اللوحات_${photos.length}_${date}.xlsx`);
  toast.success(`تم تصدير ${photos.length} صورة إلى Excel`);
}

// ========== Parse & Validate Import ==========
export async function parseAndPreviewImport(file: File): Promise<ImportPreview> {
  const errors: string[] = [];
  
  try {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

    if (!rawRows.length) {
      return {
        rows: [], totalRows: 0, validRows: 0, invalidRows: 0,
        fileName: file.name, isValidFormat: false,
        errors: ['الملف فارغ - لا يحتوي على بيانات'],
      };
    }

    // Check if it's our export format
    const firstRow = rawRows[0];
    const hasMarker = firstRow[COLUMNS.marker] === EXPORT_MARKER;
    const hasIdCol = COLUMNS.id in firstRow || 'id' in firstRow || 'ID' in firstRow;
    const hasUrlCol = COLUMNS.imageUrl in firstRow || 'imageUrl' in firstRow || 'Image_URL' in firstRow;

    if (!hasIdCol) errors.push('عمود "معرف اللوحة" غير موجود');
    if (!hasUrlCol) errors.push('عمود "رابط الصورة" غير موجود');

    const isValidFormat = hasMarker && hasIdCol && hasUrlCol;
    if (!hasMarker && hasIdCol && hasUrlCol) {
      errors.push('الملف ليس من تصدير النظام - تأكد من استخدام ملف تم تصديره من هذا المعرض');
    }

    const rows: ParsedImportRow[] = [];
    let invalidRows = 0;

    for (const row of rawRows) {
      const id = Number(row[COLUMNS.id] || row['id'] || row['ID']);
      const url = String(row[COLUMNS.imageUrl] || row['imageUrl'] || row['Image_URL'] || '').trim();
      const imageName = String(row[COLUMNS.imageName] || row['اسم الصورة'] || '').trim();
      const originalName = String(row[COLUMNS.name] || row['اسم اللوحة'] || '').trim();

      if (id && url && url.startsWith('http')) {
        rows.push({ id, imageUrl: url, imageName, originalName });
      } else {
        invalidRows++;
      }
    }

    return {
      rows,
      totalRows: rawRows.length,
      validRows: rows.length,
      invalidRows,
      fileName: file.name,
      isValidFormat,
      errors,
    };
  } catch (err) {
    return {
      rows: [], totalRows: 0, validRows: 0, invalidRows: 0,
      fileName: file.name, isValidFormat: false,
      errors: ['فشل في قراءة الملف - تأكد أنه ملف Excel صحيح'],
    };
  }
}
