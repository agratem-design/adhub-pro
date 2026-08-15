import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatGregorianDate(input: string | Date, locale: string = 'ar-LY'): string {
  try {
    if (!input) return '';
    let date: Date;
    if (input instanceof Date) {
      date = input;
    } else {
      const cleanStr = String(input).trim();
      if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(cleanStr)) {
        return cleanStr.replace(/\-/g, '/');
      }
      date = new Date(cleanStr);
    }
    if (isNaN(date.getTime())) return String(input);
    
    // Check if the input is a date-only string (YYYY-MM-DD) to prevent timezone offsets
    const isDateOnly = typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim());
    
    const day = String(isDateOnly ? date.getUTCDate() : date.getDate()).padStart(2, '0');
    const month = String(isDateOnly ? date.getUTCMonth() + 1 : date.getMonth() + 1).padStart(2, '0');
    const year = isDateOnly ? date.getUTCFullYear() : date.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch {
    return String(input);
  }
}

function parseFlexibleDate(input: string): Date | null {
  const value = input.trim();
  if (!value) return null;

  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    const result = new Date(Date.UTC(year, month - 1, day));
    if (result.getUTCFullYear() === year && result.getUTCMonth() === month - 1 && result.getUTCDate() === day) {
      return result;
    }
    return null;
  }

  const dmy = value.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:$|\s)/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const rawYear = Number(dmy[3]);
    const year = rawYear < 100 ? rawYear + 2000 : rawYear;
    const result = new Date(Date.UTC(year, month - 1, day));
    if (result.getUTCFullYear() === year && result.getUTCMonth() === month - 1 && result.getUTCDate() === day) {
      return result;
    }
    return null;
  }

  return null;
}

// Format date as "12 فبراير 2025" (Arabic month name, Latin digits)
export function formatLongArabicDate(input: string | Date | null | undefined): string {
  if (!input) return '';
  try {
    let date: Date;
    let suffix = '';

    if (input instanceof Date) {
      date = input;
    } else {
      const s = String(input).trim();
      const datedPrefix = s.match(/^((?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|(?:\d{4}-\d{2}-\d{2})(?:[T\s].*?)?)(\s*\([^)]*\))?$/);
      const datePart = datedPrefix?.[1]?.trim() || s;
      suffix = datedPrefix?.[2] || '';

      const parsed = parseFlexibleDate(datePart);
      if (!parsed) {
        return s;
      }
      date = parsed;
    }

    if (isNaN(date.getTime())) return '';
    const formatted = new Intl.DateTimeFormat('ar-LY-u-nu-latn', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      calendar: 'gregory',
      timeZone: 'UTC',
    } as Intl.DateTimeFormatOptions).format(date);
    return `${formatted}${suffix}`;
  } catch {
    return '';
  }
}

// Normalize Arabic text for robust searching: lowercase, remove diacritics, normalize alef/yaa/taa marbuta, remove tatweel
export function normalizeArabic(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  let s = String(input).toLowerCase();
  // Remove diacritics and superscript alef
  s = s.replace(/[\u064B-\u0652\u0670]/g, '');
  // Tatweel
  s = s.replace(/[\u0640]/g, '');
  // Normalize Alef variants to ا
  s = s.replace(/[\u0622\u0623\u0625]/g, '\u0627');
  // Normalize Yaa forms and Alef Maqsura to ي
  s = s.replace(/[\u0649\u0626]/g, '\u064A');
  // Normalize Taa Marbuta to ه for broader matching
  s = s.replace(/[\u0629]/g, '\u0647');
  // Convert Arabic-Indic digits to Latin digits for consistency
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  for (let i = 0; i < arabicDigits.length; i++) {
    const ar = arabicDigits[i];
    s = s.replace(new RegExp(ar, 'g'), String(i));
  }
  // Collapse spaces
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

export function queryTokens(query: string): string[] {
  return normalizeArabic(query).split(/\s+/).filter(Boolean);
}

/**
 * Normalize billboard size to a consistent format (smaller dimension first)
 * Handles numeric (e.g., "10x4" → "4x10"), with suffixes (e.g., "3X8-T" → "3x8-T"),
 * decimal (e.g., "2.5X4" → "2.5x4"), and textual names (e.g., "سوسيت" → "سوسيت")
 */
export function normalizeSize(size: string | null | undefined): string {
  if (!size) return '';
  const trimmed = size.trim();
  // Match dimensions with optional suffixes: "3X8-T", "2.5X4", "10x4"
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*(.*)$/);
  if (!match) return trimmed;
  const a = parseFloat(match[1]);
  const b = parseFloat(match[2]);
  const suffix = match[3] ? match[3].trim() : '';
  const [small, large] = a <= b ? [a, b] : [b, a];
  const fmt = (n: number) => Number.isInteger(n) ? String(n) : n.toString();
  const base = `${fmt(small)}x${fmt(large)}`;
  if (!suffix) return base;
  const cleanSuffix = suffix.startsWith('-') ? suffix : `-${suffix}`;
  return `${base}${cleanSuffix}`;
}

/**
 * Format size for display: larger dimension first (e.g., "10x4")
 * Preserves suffixes and decimal points
 */
export function displaySize(size: string | null | undefined): string {
  if (!size) return '—';
  const trimmed = size.trim();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*(.*)$/);
  if (!match) return trimmed;
  const a = parseFloat(match[1]);
  const b = parseFloat(match[2]);
  const suffix = match[3] ? match[3].trim() : '';
  const [large, small] = a >= b ? [a, b] : [b, a];
  const fmt = (n: number) => Number.isInteger(n) ? String(n) : n.toString();
  const base = `${fmt(large)}x${fmt(small)}`;
  const cleanSuffix = suffix ? (suffix.startsWith('-') ? suffix : `-${suffix}`) : '';
  return `${base}${cleanSuffix}`;
}

/**
 * Professional Arabic formatting for billboard faces count (e.g. 1 → "وجه واحد", 2 → "وجهين")
 */
export function formatFacesCountArabic(count: number | string | null | undefined): string {
  const num = Number(count) || 1;
  if (num === 1) return 'وجه واحد';
  if (num === 2) return 'وجهين';
  if (num === 3) return 'ثلاثة أوجه';
  if (num === 4) return 'أربعة أوجه';
  if (num === 5) return 'خمسة أوجه';
  if (num === 6) return 'ستة أوجه';
  if (num === 7) return 'سبعة أوجه';
  if (num === 8) return 'ثمانية أوجه';
  if (num === 9) return 'تسعة أوجه';
  if (num === 10) return 'عشرة أوجه';
  return `${num} أوجه`;
}

