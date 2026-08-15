/**
 * Tracks used filenames and returns unique versions by appending _2, _3, etc.
 */
export function createFileNameDeduplicator() {
  const usedNames = new Map<string, number>();

  return function deduplicate(baseName: string, extension: string): string {
    const key = `${baseName}${extension}`.toLowerCase();
    const count = usedNames.get(key) || 0;
    usedNames.set(key, count + 1);

    if (count === 0) {
      return `${baseName}${extension}`;
    }
    return `${baseName}_${count + 1}${extension}`;
  };
}

/**
 * Same as above but returns baseName (no extension) for the "بدون امتداد" column.
 */
export function deduplicateBaseName(baseName: string, deduplicatedFull: string, extension: string): string {
  // If dedup added a suffix, strip extension to get the base
  if (deduplicatedFull.endsWith(extension)) {
    return deduplicatedFull.slice(0, -extension.length);
  }
  return baseName;
}
