export type NumberedItem = { sequence_number: number };

/** Insert the clicked items at consecutive slots; fill other slots in their previous order. */
export function reorderMunicipalityItems<T extends NumberedItem>(
  items: T[], clicked: number[], start: number, direction: 1 | -1,
): T[] {
  const sorted = [...items].sort((a, b) => a.sequence_number - b.sequence_number);
  const byNumber = new Map(sorted.map(item => [item.sequence_number, item]));
  if (byNumber.size !== items.length || new Set(clicked).size !== clicked.length ||
      clicked.some(number => !byNumber.has(number)) ||
      !Number.isInteger(start) || start < 1 || start > items.length ||
      (clicked.length > 0 && (start + (clicked.length - 1) * direction < 1 ||
        start + (clicked.length - 1) * direction > items.length))) {
    throw new Error('الترتيب المطلوب خارج نطاق أرقام المجموعة');
  }
  const slots = new Map(clicked.map((number, index) => [start + index * direction, byNumber.get(number)!]));
  const selected = new Set(clicked);
  const remaining = sorted.filter(item => !selected.has(item.sequence_number));
  let cursor = 0;
  return sorted.map((_, index) => ({
    ...(slots.get(index + 1) ?? remaining[cursor++]), sequence_number: index + 1,
  }));
}

export function municipalityColor(name: string): string {
  const palette = ['#0369a1', '#047857', '#a16207', '#be123c', '#6d28d9', '#0e7490', '#c2410c'];
  let hash = 0;
  for (const character of name.trim()) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return palette[Math.abs(hash) % palette.length];
}
