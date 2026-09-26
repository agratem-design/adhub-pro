/**
 * تحليل وتنظيف وتنسيق مدخلات السعر الرقمية بدقة عالية لتجربة مستخدم سلسة:
 * - يدعم الأرقام الإنجليزية (0-9) والأرقام العربية/المشرقية (٠-٩ و ۰-۹)
 * - يدعم الفواصل بجميع أشكالها (فاصلة إنجليزية ','، فاصلة عربية '،'، فاصلة آلاف عربية '٬'، مسافات)
 * - يدعم فواصل الآلاف المكتوبة كنقاط مثل (50.000 أو 1.000.000)
 * - يدعم الفواصل العشرية (مثل 15.5 أو 15٫5)
 * - يتجاهل النصوص الإضافية للعملة تلقائياً (د.ل، دل، دينار، LYD)
 * - يتحقق من صحة الرقم وعدم كونه سالباً
 * - ينسق الأرقام تلقائياً بفواصل الآلاف أثناء الكتابة مع الحفاظ على المؤشر
 */

export interface PriceParseResult {
  value: number | null;
  isValid: boolean;
  error?: string;
}

export function parsePriceInput(raw: unknown): PriceParseResult {
  if (raw === null || raw === undefined) {
    return { value: null, isValid: true };
  }

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) {
      return { value: null, isValid: false, error: 'أدخل سعراً صحيحاً غير سالب' };
    }
    if (raw < 0) {
      return { value: null, isValid: false, error: 'أدخل سعراً صحيحاً غير سالب' };
    }
    return { value: raw, isValid: true };
  }

  let str = String(raw).trim();
  if (str === '') {
    return { value: null, isValid: true };
  }

  // 1. التحقق من الإشارة السالبة أولاً
  if (/[-−]/.test(str)) {
    return { value: null, isValid: false, error: 'أدخل سعراً صحيحاً غير سالب' };
  }

  // 2. إزالة نصوص ورموز العملات
  str = str.replace(/(د\.?ل\.?|دينار|lyd)/gi, '').trim();

  // 3. تحويل الأرقام العربية والمشرقية إلى أرقام لاتينية (0-9)
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  for (let i = 0; i < 10; i++) {
    str = str.replaceAll(arabicDigits[i], String(i)).replaceAll(persianDigits[i], String(i));
  }

  // 4. إزالة المسافات والفراغات بجميع أنواعها
  str = str.replace(/[\s\u00A0\u200B]+/g, '');

  // 5. إزالة فواصل الآلاف (الإنجليزية والعربية والاقتباسات)
  str = str.replace(/[,،٬`']/g, '');

  // 6. استبدال الفاصلة العشرية العربية '٫' بالنقطة '.'
  str = str.replace(/\u066B/g, '.');

  // فحص عدم وجود نقاط متتالية غير صالحة مثل '..'
  if (/\.{2,}/.test(str)) {
    return { value: null, isValid: false, error: 'أدخل سعراً صحيحاً غير سالب' };
  }

  // 7. معالجة النقاط:
  // في حال وجود أكثر من نقطة (مثل 1.000.000)، فهي فواصل آلاف قطعاً
  const dotParts = str.split('.');
  if (dotParts.length > 2) {
    str = dotParts.join('');
  } else if (dotParts.length === 2) {
    // إذا كان بعد النقطة 3 أرقام بالضبط (مثل 50.000 أو 38.500) والجزء الصحيح مكون من رقم أو أكثر:
    // في ليبيا يُستخدم التنسيق النقطي كفاصل آلاف للمبالغ النقدية
    if (dotParts[1].length === 3 && dotParts[0].length >= 1) {
      str = dotParts[0] + dotParts[1];
    }
  }

  // 8. التحقق من أن السلسلة المتبقية تتكون من أرقام فقط (مع كسر عشري اختياري)
  if (!/^\d+(\.\d+)?$/.test(str)) {
    return { value: null, isValid: false, error: 'أدخل سعراً صحيحاً غير سالب' };
  }

  const num = Number(str);
  if (!Number.isFinite(num) || num < 0) {
    return { value: null, isValid: false, error: 'أدخل سعراً صحيحاً غير سالب' };
  }

  return { value: num, isValid: true };
}

/**
 * تنسيق الرقم المكتوب بإضافة فواصل الآلاف تلقائياً:
 * - يحول الأرقام العربية إلى لاتينية
 * - يضيف فاصلة كل 3 أرقام (مثال: 50000 -> 50,000)
 * - يحافظ على الكسور العشرية والإشارات السالبة إن وُجدت
 */
export function formatPriceWithCommas(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  let str = String(raw).trim();
  if (str === '') return '';

  // تحويل الأرقام العربية والمشرقية إلى أرقام لاتينية
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  for (let i = 0; i < 10; i++) {
    str = str.replaceAll(arabicDigits[i], String(i)).replaceAll(persianDigits[i], String(i));
  }

  // استبدال الفاصلة العشرية العربية '٫' بالنقطة
  str = str.replace(/\u066B/g, '.');

  const isNegative = str.startsWith('-') || str.startsWith('−');

  // إبقاء الأرقام والنقطة فقط
  str = str.replace(/[^0-9.]/g, '');
  if (!str) return isNegative ? '-' : '';

  const parts = str.split('.');
  const intPart = parts[0];
  const decPart = parts.length > 1 ? '.' + parts.slice(1).join('') : '';

  const formattedInt = intPart ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '';
  return (isNegative ? '-' : '') + formattedInt + decPart;
}

/**
 * تنسيق القيمة مع الحفاظ التام على موضع مؤشر الكتابة (Cursor):
 */
export function formatPriceInputWithCursor(inputStr: string, oldCursor: number): { formatted: string; newCursor: number } {
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  let str = inputStr;
  for (let i = 0; i < 10; i++) {
    str = str.replaceAll(arabicDigits[i], String(i)).replaceAll(persianDigits[i], String(i));
  }
  str = str.replace(/\u066B/g, '.');

  const beforeCursor = str.slice(0, oldCursor);
  const rawBeforeCount = (beforeCursor.match(/[0-9.]/g) || []).length;

  const formatted = formatPriceWithCommas(str);

  let newCursor = 0;
  let seen = 0;
  while (newCursor < formatted.length && seen < rawBeforeCount) {
    if (/[0-9.]/.test(formatted[newCursor])) {
      seen++;
    }
    newCursor++;
  }

  return { formatted, newCursor };
}
