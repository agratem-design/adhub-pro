/**
 * Print Engine Utilities
 * دوال مساعدة للطباعة
 */

/**
 * تحميل الشعار كـ Data URI
 */
export async function loadLogoAsDataUri(logoPath: string): Promise<string> {
  try {
    const response = await fetch(logoPath);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error loading logo:', error);
    return '';
  }
}

/**
 * تنسيق الرقم بالعربية
 */
export function formatArabicNumber(num: number): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * تنسيق التاريخ
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '—';
  try {
    return new Date(dateString).toLocaleDateString('ar-LY');
  } catch {
    return dateString;
  }
}

/**
 * تنسيق التاريخ والوقت
 */
export function formatDateTime(dateString: string): string {
  if (!dateString) return '—';
  try {
    return new Date(dateString).toLocaleString('ar-LY');
  } catch {
    return dateString;
  }
}

/**
 * تحويل الرقم إلى كلمات عربية (تفقيط)
 */
export function numberToArabicWords(num: number): string {
  if (num === null || num === undefined || isNaN(num)) return '';
  
  num = Math.round(Math.abs(num));
  
  if (num === 0) return 'صفر';
  
  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  
  const convertHundreds = (n: number): string => {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) {
      const ten = Math.floor(n / 10);
      const one = n % 10;
      return ones[one] + (one > 0 ? ' و' : '') + tens[ten];
    }
    const hundred = Math.floor(n / 100);
    const remainder = n % 100;
    let result = '';
    if (hundred === 1) result = 'مائة';
    else if (hundred === 2) result = 'مائتان';
    else result = ones[hundred] + ' مائة';
    if (remainder > 0) result += ' و' + convertHundreds(remainder);
    return result;
  };

  if (num < 1000) return convertHundreds(num);
  
  if (num < 1000000) {
    const thousands = Math.floor(num / 1000);
    const remainder = num % 1000;
    let result = '';
    if (thousands === 1) result = 'ألف';
    else if (thousands === 2) result = 'ألفان';
    else if (thousands >= 3 && thousands <= 10) result = convertHundreds(thousands) + ' آلاف';
    else result = convertHundreds(thousands) + ' ألف';
    if (remainder > 0) result += ' و' + convertHundreds(remainder);
    return result;
  }
  
  if (num < 1000000000) {
    const millions = Math.floor(num / 1000000);
    const remainder = num % 1000000;
    let result = '';
    if (millions === 1) result = 'مليون';
    else if (millions === 2) result = 'مليونان';
    else if (millions >= 3 && millions <= 10) result = convertHundreds(millions) + ' ملايين';
    else result = convertHundreds(millions) + ' مليون';
    if (remainder > 0) result += ' و' + numberToArabicWords(remainder);
    return result;
  }
  
  return num.toLocaleString('en-US');
}
