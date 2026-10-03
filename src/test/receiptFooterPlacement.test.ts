import { describe, expect, it } from 'vitest';
import { unifiedFooterHtml } from '@/lib/unifiedInvoiceBase';
import { withRepeatedPrintHeader } from '@/lib/repeatedPrintHeader';

describe('receipt footer placement', () => {
  it('keeps company contacts together on the right and pagination separate', () => {
    const html = unifiedFooterHtml({ companyPhone: '0910000000', companyAddress: 'عنوان تجريبي', showFooter: true } as any);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('.u-footer-contacts')?.textContent).toContain('0910000000');
    expect(doc.querySelector('.u-footer-contacts')?.textContent).toContain('عنوان تجريبي');
    expect(doc.querySelector('.u-footer-contacts .u-page-number')).toBeNull();
    expect((doc.querySelector('.u-footer') as HTMLElement).style.justifyContent).toBe('space-between');
  });
  it('places header in thead and footer in tfoot for reliable multi-page printing, and restores the preview', () => {
    const footer = unifiedFooterHtml({ companyPhone: '0910000000', companyAddress: 'عنوان تجريبي', showFooter: true } as any);
    const html = withRepeatedPrintHeader(`<html><body><div class="paper"><div class="u-header">Header</div><div>Invoice</div>${footer}</div><style>@page { margin: 0; }</style></body></html>`);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    document.body.innerHTML = doc.body.innerHTML;
    const original = document.querySelector('.paper')!.innerHTML;
    new Function(doc.querySelector('script')!.textContent!)();
    window.dispatchEvent(new Event('beforeprint'));
    const tfoot = document.querySelector('.print-pagination-shell > tfoot');
    expect(tfoot).not.toBeNull();
    expect(tfoot?.querySelector('.u-footer')).not.toBeNull();
    expect(tfoot?.textContent).toContain('0910000000');
    expect((tfoot?.querySelector('.u-footer') as HTMLElement).style.display).not.toBe('none');
    const thead = document.querySelector('.print-pagination-shell > thead');
    expect(thead).not.toBeNull();
    expect(thead?.querySelector('.u-header')).not.toBeNull();
    window.dispatchEvent(new Event('afterprint'));
    expect(document.querySelector('.print-pagination-shell')).toBeNull();
    expect(document.querySelector('.paper')!.innerHTML).toBe(original);
  });
});
