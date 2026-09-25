export type PrintLevelSelection = 'all' | string[];

/** Accept saved single-level preferences from older versions. */
export function normalizePrintLevels(value: unknown): PrintLevelSelection {
  if (value === 'all') return 'all';
  if (Array.isArray(value)) return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0))];
  return typeof value === 'string' && value.trim() ? [value] : 'all';
}

export function resolvePrintLevels(selection: PrintLevelSelection, available: string[]): string[] {
  return available.filter(code => selection === 'all' || selection.includes(code));
}
