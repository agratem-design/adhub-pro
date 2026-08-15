/**
 * Helper to generate an <img> tag with onerror fallback for print HTML.
 * Falls back to the deterministic local path, then to placeholder.
 */
export function printImgTag(
  src: string | null | undefined,
  alt: string,
  style: string,
  fallbackPath?: string | null,
  className?: string
): string {
  if (!src) return '';
  
  const fallback = fallbackPath || '/placeholder.svg';
  const escapedFallback = fallback.replace(/'/g, "\\'");
  const classAttr = className ? ` class="${className}"` : '';
  
  return `<img src="${src}" alt="${alt}" style="${style}" onerror="this.onerror=null;this.src='${escapedFallback}'"${classAttr} />`;
}
