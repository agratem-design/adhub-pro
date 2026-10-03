import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ContractSelectionToolbar } from '@/components/contracts/ContractSelectionToolbar';

describe('contract selection actions', () => {
  const action = vi.fn();
  const props = { count: 1, filteredCount: 285, rangeSelector: <button>تحديد نطاق</button>, printing: false, preparingSizes: false, exporting: false, onClear: action, onSelectAll: action, onPrint: action, onSizes: action, onExport: action };
  it('has clear action names and decorative icons excluded from accessible names', () => {
    const doc = new DOMParser().parseFromString(renderToStaticMarkup(<ContractSelectionToolbar {...props} />), 'text/html');
    if (process.env.INVOICE_DESIGN_PREVIEW_DIR) { mkdirSync(process.env.INVOICE_DESIGN_PREVIEW_DIR, { recursive: true }); writeFileSync(process.env.INVOICE_DESIGN_PREVIEW_DIR + '/toolbar.html', '<!doctype html><html dir="rtl" class="dark"><head><meta charset="utf-8"><link rel="stylesheet" href="toolbar.css"></head><body style="padding:24px"><main>' + renderToStaticMarkup(<ContractSelectionToolbar {...props} />) + '</main></body></html>'); }
    expect(doc.querySelector('section')?.getAttribute('dir')).toBe('rtl');
    expect(doc.body.textContent).toContain('اختيار الكل (285)');
    expect(doc.body.textContent).toContain('طباعة العقود (1)');
    expect(doc.body.textContent).not.toContain('svg');
    expect(Array.from(doc.querySelectorAll('svg')).every(icon => icon.getAttribute('aria-hidden') === 'true')).toBe(true);
  });
  it('disables conflicting actions while preparing a sizes invoice', () => {
    const doc = new DOMParser().parseFromString(renderToStaticMarkup(<ContractSelectionToolbar {...props} preparingSizes />), 'text/html');
    expect(doc.body.textContent).toContain('جاري تجهيز المقاسات');
    expect(Array.from(doc.querySelectorAll('button')).filter(button => button.textContent !== 'تحديد نطاق').every(button => button.disabled)).toBe(true);
  });
});
