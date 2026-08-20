/**
 * Centralized Operational Week Utility for AdHub Pro
 * Business Timezone: Africa/Tripoli (UTC+2, standard Libyan operational calendar)
 * Operational Week: Starts Saturday 00:00:00.000 and ends Friday 23:59:59.999
 */

export interface OperationalWeekRange {
  weekKey: string; // e.g. "reinstall-week-2026-08-15"
  startDate: Date; // Saturday 00:00:00
  endDate: Date; // Friday 23:59:59
  startDateStr: string; // "2026/08/15"
  endDateStr: string; // "2026/08/21"
  label: string; // "مجموعة إعادة التركيب — الأسبوع: 2026/08/15 إلى 2026/08/21"
}

const WEEKDAY_MAP: Record<string, number> = {
  Sat: 6,
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
};

/**
 * Calculates the operational week (Saturday to Friday) for any given timestamp or Date.
 * Strictly anchored to the business timezone 'Africa/Tripoli' so all users across the world see identical week groups.
 */
export function getOperationalWeekRange(dateInput: Date | string | number | null | undefined): OperationalWeekRange {
  const d = dateInput ? new Date(dateInput) : new Date();

  // Extract calendar components in Africa/Tripoli timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Tripoli',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });

  const parts = formatter.formatToParts(d);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';

  const y = parseInt(getPart('year'), 10);
  const m = parseInt(getPart('month'), 10) - 1;
  const dayNum = parseInt(getPart('day'), 10);
  const weekdayStr = getPart('weekday');

  const dayOfWeek = WEEKDAY_MAP[weekdayStr] ?? 0;
  const diffToSaturday = (dayOfWeek + 1) % 7; // Sat: 0, Sun: 1, ..., Fri: 6

  // Saturday of this operational week in Libyan calendar
  const saturday = new Date(y, m, dayNum);
  saturday.setDate(saturday.getDate() - diffToSaturday);

  const satY = saturday.getFullYear();
  const satM = String(saturday.getMonth() + 1).padStart(2, '0');
  const satD = String(saturday.getDate()).padStart(2, '0');
  const satKeyStr = `${satY}-${satM}-${satD}`;

  // Friday of this operational week
  const friday = new Date(saturday);
  friday.setDate(saturday.getDate() + 6);
  const friY = friday.getFullYear();
  const friM = String(friday.getMonth() + 1).padStart(2, '0');
  const friD = String(friday.getDate()).padStart(2, '0');

  const startDateStr = `${satY}/${satM}/${satD}`;
  const endDateStr = `${friY}/${friM}/${friD}`;

  return {
    weekKey: `reinstall-week-${satKeyStr}`,
    startDate: saturday,
    endDate: friday,
    startDateStr,
    endDateStr,
    label: `مجموعة إعادة التركيب — الأسبوع: ${startDateStr} إلى ${endDateStr}`,
  };
}

/**
 * Returns just the deterministic group key for reinstallation grouping.
 */
export function getOperationalWeekKey(dateInput: Date | string | number | null | undefined): string {
  return getOperationalWeekRange(dateInput).weekKey;
}
