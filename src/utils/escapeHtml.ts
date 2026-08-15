/**
 * Escape a value for safe insertion as HTML text content or attribute value.
 * Coerces non-strings to string. Returns '' for null/undefined.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return c;
    }
  });
}

/**
 * JSON-encode a value for safe inclusion inside an HTML attribute string
 * such as an inline onclick handler. Escapes both JS-string and HTML-attr
 * special characters (quotes, &, <, >).
 */
export function jsonForHtmlAttr(value: unknown): string {
  return JSON.stringify(value ?? '')
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/"/g, '&quot;');
}
