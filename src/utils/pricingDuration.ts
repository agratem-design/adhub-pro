export interface PricingDuration {
  id: string;
  name: string;
  label: string;
  days: number;
  months: number;
  db_column: string;
  sort_order: number;
  is_active: boolean;
}

export const legacyColumns: Record<number, string> = {
  1: 'one_month',
  2: '2_months',
  3: '3_months',
  6: '6_months',
  12: 'full_year',
};

export const isCustomDuration = (key: string) => ![...Object.values(legacyColumns), 'one_day'].includes(key);

export function readDurationPrice(row: any, key: string): number | null {
  const value = isCustomDuration(key) ? row?.duration_prices?.[key] : row?.[key];
  return value == null || !Number.isFinite(Number(value)) ? null : Number(value);
}

export function durationPrice(row: any, months: number, durations: PricingDuration[] = []): number | null {
  const numMonths = Number(months);
  const key = durations.find(d => Number(d.months) === numMonths)?.db_column ?? legacyColumns[numMonths];
  return key ? readDurationPrice(row, key) : null;
}

export function durationName(months: number | string, durations: PricingDuration[] = []): string {
  const num = Number(months);
  const matched = durations.find(d => Number(d.months) === num);
  if (matched?.name) return matched.name;
  if (!Number.isFinite(num) || num <= 0) return '';
  if (num === 1) return 'شهر واحد';
  if (num === 2) return 'شهرين';
  if (num >= 3 && num <= 10) return `${num} أشهر`;
  return `${num} شهر`;
}

export function durationEnd(start: string, months: number, fixed: boolean, durations: PricingDuration[] = []): Date {
  const date = new Date(start);
  const numMonths = Number(months);
  const duration = durations.find(d => Number(d.months) === numMonths && isCustomDuration(d.db_column));
  if (duration || fixed) {
    date.setDate(date.getDate() + (duration ? duration.days : Math.round(numMonths * 30)));
  } else {
    date.setMonth(date.getMonth() + Math.floor(numMonths));
    date.setDate(date.getDate() + Math.round((numMonths % 1) * 30));
  }
  return date;
}

/**
 * Resolves the clean, official duration name for a contract from pricing_durations.
 * Prevents redundant numbers or duplicate days such as "(45 يوم (45))".
 */
export function getContractDurationName(contract: any, durations: PricingDuration[] = []): string {
  if (!contract) return '';

  const activeDurations = (durations || []).filter(d => d.is_active !== false);

  // 1. Match by duration_months if present and > 0
  const monthsVal = contract.duration_months != null ? Number(contract.duration_months) : null;
  if (monthsVal != null && Number.isFinite(monthsVal) && monthsVal > 0) {
    const matched = activeDurations.find(d => Math.abs(Number(d.months) - monthsVal) < 0.01);
    if (matched?.name) return matched.name;
  }

  // 2. Match by duration_days if present and > 0
  const daysVal = contract.duration_days != null ? Number(contract.duration_days) : null;
  if (daysVal != null && Number.isFinite(daysVal) && daysVal > 0) {
    const matched = activeDurations.find(d => Number(d.days) === daysVal);
    if (matched?.name) return matched.name;
  }

  // 3. Calculate difference between start_date and end_date
  const startDateStr = contract.start_date || contract['Contract Date'];
  const endDateStr = contract.end_date || contract['End Date'];
  let diffDays = 0;
  if (startDateStr && endDateStr) {
    const s = new Date(startDateStr);
    const e = new Date(endDateStr);
    const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    if (diff > 0) {
      diffDays = diff;
      const matched = activeDurations.find(d => Number(d.days) === diffDays);
      if (matched?.name) return matched.name;
    }
  }

  // 4. Check if contract.Duration or contract.duration_label already contains a named duration
  const existingDuration = String(contract.Duration || contract.duration_label || '').trim();
  if (existingDuration) {
    const directMatch = activeDurations.find(
      d => d.name.trim() === existingDuration || d.label.trim() === existingDuration
    );
    if (directMatch?.name) return directMatch.name;

    // Check if the string has a day number that matches a duration (e.g. "45 يوم" -> matches 45 -> "شهر ونصف")
    const matchNum = existingDuration.match(/\d+(?:\.\d+)?/);
    if (matchNum) {
      const parsedNum = parseFloat(matchNum[0]);
      const matchedByDays = activeDurations.find(d => Number(d.days) === parsedNum);
      if (matchedByDays?.name) return matchedByDays.name;
      const matchedByMonths = activeDurations.find(d => Math.abs(Number(d.months) - parsedNum) < 0.01);
      if (matchedByMonths?.name) return matchedByMonths.name;
    }
  }

  // 5. Fallback formatting by months
  if (monthsVal != null && Number.isFinite(monthsVal) && monthsVal > 0) {
    return durationName(monthsVal, activeDurations);
  }

  // 6. Fallback formatting by days
  if (diffDays > 0) {
    return `${diffDays} يوم`;
  }
  if (daysVal != null && daysVal > 0) {
    return `${daysVal} يوم`;
  }

  return existingDuration;
}

/**
 * Resolves the numeric day count for a duration.
 * Supports explicit day count fallback, lookup in PricingDuration[],
 * built-in standard duration mapping, and extracting numbers from strings.
 */
export function getDurationDays(
  duration: string,
  durations?: PricingDuration[],
  daysFallback?: string | number
): number | null {
  if (daysFallback != null) {
    const num = typeof daysFallback === 'number'
      ? daysFallback
      : parseInt(String(daysFallback).replace(/[^\d]/g, ''), 10);
    if (!isNaN(num) && num > 0) return num;
  }

  const clean = String(duration || '').trim();
  if (!clean) return null;

  const parenMatch = clean.match(/\((\d+)\)/);
  if (parenMatch) return parseInt(parenMatch[1], 10);

  if (durations && Array.isArray(durations)) {
    const matched = durations.find(d =>
      (d.name && d.name.trim() === clean) ||
      (d.label && d.label.trim() === clean)
    );
    if (matched && matched.days && Number(matched.days) > 0) {
      return Number(matched.days);
    }
  }

  const STANDARD_MAP: Record<string, number> = {
    'شهر ونصف': 45,
    'شهر ونص': 45,
    'شهر': 30,
    'شهر واحد': 30,
    'شهرين': 60,
    'شهران': 60,
    '3 أشهر': 90,
    '3 اشهر': 90,
    'ثلاثة أشهر': 90,
    'ثلاثة اشهر': 90,
    '4 أشهر': 120,
    '4 اشهر': 120,
    'أربعة أشهر': 120,
    'اربعه اشهر': 120,
    '5 أشهر': 150,
    '5 اشهر': 150,
    'خمسة أشهر': 150,
    'خمسه اشهر': 150,
    '6 أشهر': 180,
    '6 اشهر': 180,
    'ستة أشهر': 180,
    'ستة اشهر': 180,
    'نصف سنة': 180,
    'سنة': 365,
    'سنة كاملة': 365,
    'سنة واحده': 365,
    'سنة واحدة': 365,
    'عام': 365,
    'عام كامل': 365,
    'سنتين': 730,
    'سنتان': 730,
  };

  if (STANDARD_MAP[clean] != null) return STANDARD_MAP[clean];

  const sortedEntries = Object.entries(STANDARD_MAP).sort((a, b) => b[0].length - a[0].length);
  for (const [key, val] of sortedEntries) {
    if (clean.includes(key)) return val;
  }

  const numMatch = clean.match(/(\d+)\s*(?:يوم|days?)/i);
  if (numMatch) return parseInt(numMatch[1], 10);

  const rawNum = clean.match(/^\d+$/);
  if (rawNum) return parseInt(rawNum[0], 10);

  return null;
}

/**
 * Replaces {duration} in legal contract terms cleanly.
 * Formats named durations with the name without parentheses and days count in parentheses:
 * e.g. "تبلغ مدة هذا العقد شهر ونصف (45) يوماً"
 *
 * @param text The contract term template text containing {duration}
 * @param duration The duration name (e.g. "شهر ونصف") or duration string
 * @param durationDays Optional number of days or days string (e.g. 45 or "45")
 * @param durations Optional list of pricing durations from database
 */
export function replaceDurationVariable(
  text: string,
  duration: string,
  durationDays?: string | number,
  durations?: PricingDuration[]
): string {
  if (!text) return '';
  const cleanDuration = String(duration || '').trim();
  if (!cleanDuration) {
    return text.replace(/\{\s*duration\s*\}/g, '');
  }

  const days = getDurationDays(cleanDuration, durations, durationDays);

  const isNamedDuration = /شهر|أشهر|شهرين|شهران|سنة|سنوات|عام|أعوام/.test(cleanDuration);

  if (isNamedDuration) {
    const baseName = cleanDuration
      .replace(/\s*\(\s*\d+\s*(?:يوم|يوماً)?\s*\)/g, '')
      .replace(/\s*\d+\s*(?:يوم|يوماً)/g, '')
      .trim();

    const formattedWithDays = days
      ? `${baseName} (${days}) يوماً`
      : baseName;

    const formattedNoTrailing = days
      ? `${baseName} (${days} يوماً)`
      : baseName;

    return text
      .replace(/\(\s*\{\s*duration\s*\}\s*\)\s*(?:يوماً|يوم|يومًا)/g, formattedWithDays)
      .replace(/\{\s*duration\s*\}\s*(?:يوماً|يوم|يومًا)/g, formattedWithDays)
      .replace(/\(\s*\{\s*duration\s*\}\s*\)/g, formattedNoTrailing)
      .replace(/\{\s*duration\s*\}/g, formattedWithDays);
  }

  const rawDays = days || cleanDuration.replace(/[^\d]/g, '');
  if (rawDays) {
    return text
      .replace(/\(\s*\{\s*duration\s*\}\s*\)\s*(?:يوماً|يوم|يومًا)/g, `(${rawDays}) يوماً`)
      .replace(/\{\s*duration\s*\}\s*(?:يوماً|يوم|يومًا)/g, `(${rawDays}) يوماً`)
      .replace(/\(\s*\{\s*duration\s*\}\s*\)/g, `(${rawDays} يوماً)`)
      .replace(/\{\s*duration\s*\}/g, `(${rawDays}) يوماً`);
  }

  return text.replace(/\{\s*duration\s*\}/g, cleanDuration);
}
