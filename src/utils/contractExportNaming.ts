// أدوات مشتركة لتسمية ملفات/مجلدات تصدير العقد
// تضمن أن CSV و ZIP يستخدمان نفس المسارات بالضبط.

export const sanitizeName = (s: string): string =>
  String(s || '')
    .replace(/[\\/:*?"<>|\r\n\t]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

export const getUrlExt = (url: string): string => {
  if (!url) return 'jpg';
  try {
    const clean = String(url).split('?')[0].split('#')[0];
    const m = clean.match(/\.([a-zA-Z0-9]{2,5})$/);
    return m ? m[1].toLowerCase() : 'jpg';
  } catch {
    return 'jpg';
  }
};

/**
 * اسم المجلد/الملف الأساسي للعقد.
 * يُستخدم نفس الاسم لـ:
 *   - اسم ملف CSV
 *   - اسم ملف ZIP
 *   - اسم المجلد الجذر داخل ZIP
 *   - الجزء الأول من مسار الصورة في CSV (images/{folder}/...)
 */
export const buildContractFolderName = (params: {
  contractNumber: string | number;
  customerName?: string;
}): string => {
  const num = sanitizeName(String(params.contractNumber || ''));
  const cust = sanitizeName(String(params.customerName || ''));
  const parts = ['عقد', num, cust].filter(Boolean);
  return parts.join('_');
};

/**
 * مسار الصورة داخل ZIP (والمكتوب في CSV).
 * مثال: images/<billboardName>_main.jpg
 */
export const buildImagePath = (params: {
  folderName?: string;
  billboardName: string;
  suffix: '' | 'A' | 'B' | 'main';
  url: string;
}): string => {
  const name = sanitizeName(params.billboardName) || 'billboard';
  const ext = getUrlExt(params.url);
  const sfx = params.suffix ? `_${params.suffix}` : '';
  return `images/${name}${sfx}.${ext}`;
};
