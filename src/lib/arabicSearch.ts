/**
 * Universal Smart Arabic Text Normalization & Search Helper
 * Provides fuzzy token matching, Alef/Teh Marbuta/Alef Maksura normalization,
 * size character unification (×, * -> x), and multi-field code search.
 */

export function normalizeArabicText(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  let str = String(text).toLowerCase().trim();

  // Remove Arabic diacritics (Harakat)
  str = str.replace(/[\u064B-\u065F\u0670]/g, '');

  // Unify size separators (×, * -> x)
  str = str.replace(/[×*]/g, 'x');

  // Normalize Alef variations (أ, إ, آ => ا)
  str = str.replace(/[أإآ]/g, 'ا');

  // Normalize Teh Marbuta (ة => ه)
  str = str.replace(/ة/g, 'ه');

  // Normalize Alef Maksura (ى => ي)
  str = str.replace(/ى/g, 'ي');

  // Remove Tatweel (ـ)
  str = str.replace(/ـ/g, '');

  return str;
}

export const normalizeArabic = normalizeArabicText;

/**
 * Performs a smart, tokenized Arabic multi-field search.
 * Splits query by spaces/hyphens into tokens, normalizes Arabic text,
 * and ensures EVERY token matches at least one field or composite field.
 */
export function smartArabicMatch(
  fields: (string | number | null | undefined)[],
  query: string
): boolean {
  if (!query || !query.trim()) return true;

  const normalizedQuery = normalizeArabicText(query);
  const queryTokens = normalizedQuery.split(/[\s\-_\/]+/).filter(Boolean);
  if (queryTokens.length === 0) return true;

  const normalizedFields = fields
    .filter((f) => f !== null && f !== undefined && f !== '')
    .map((f) => normalizeArabicText(f));

  const combinedNormalizedText = normalizedFields.join(' ');
  const combinedCleanText = combinedNormalizedText.replace(/[\-_\/]/g, '');
  const cleanQuery = normalizedQuery.replace(/[\s\-_\/]/g, '');

  // Direct clean match for codes (e.g. TRJZ0918 matching TR-JZ0918)
  if (cleanQuery && combinedCleanText.includes(cleanQuery)) {
    return true;
  }

  // Every token must match in normalized text or clean text
  return queryTokens.every((token) => {
    const cleanToken = token.replace(/[\-_\/]/g, '');
    return combinedNormalizedText.includes(token) || (cleanToken && combinedCleanText.includes(cleanToken));
  });
}
