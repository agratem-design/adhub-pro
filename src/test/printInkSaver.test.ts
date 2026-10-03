import { describe, expect, it } from 'vitest';
import { applyPrintInkSaver, PRINT_INK_SAVER_CSS } from '@/lib/printInkSaver';

describe('economical print surfaces', () => {
  it('adds the final light surface rules once without changing content or images', () => {
    const input = '<html><head><style>th{background:black;color:white}</style></head><body><table><tr><th>الإجمالي</th></tr></table><img src="design.jpg"></body></html>';
    const result = applyPrintInkSaver(input);
    expect(result.indexOf('id="print-ink-saver"')).toBeGreaterThan(result.indexOf('th{background'));
    expect(result).toContain('<img src="design.jpg">');
    expect(result).toContain('<th>الإجمالي</th>');
    expect(applyPrintInkSaver(result)).toBe(result);
    expect(PRINT_INK_SAVER_CSS).toContain('.receipt-summary-balance');
    expect(PRINT_INK_SAVER_CSS).toContain('color: #262626 !important');
    expect(PRINT_INK_SAVER_CSS).toContain('html body table tfoot tr');
    expect(PRINT_INK_SAVER_CSS).toContain('html body table tfoot td');
  });
});
