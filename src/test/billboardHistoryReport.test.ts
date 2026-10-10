import { describe, it, expect, vi } from 'vitest';
import { historyStatus, historyTotals, escapeHistoryHTML, type HistoryRecord } from '@/components/billboards/historyModel';
import { buildHistoryReport, type HistoryReportOptions } from '@/components/billboards/historyReport';
import type { ResolvedPrintStyles } from '@/lib/unifiedInvoiceBase';

vi.mock('@/lib/unifiedInvoiceBase', () => ({
  generateCustomerHTML: (_: unknown, data: { name: string; statsCards: string }) => `${data.name}${data.statsCards}`,
  wrapInDocument: (_: unknown, data: { customerHtml: string; bodyContent: string; extraCSS: string }) => `<html>${data.customerHtml}${data.bodyContent}<style>${data.extraCSS}</style></html>`,
}));
const record: HistoryRecord = { id: 'current-12', contract_number: 12, customer_name: '<script>alert(1)</script>', ad_type: 'إعلان', start_date: '2026-10-01', end_date: '2026-10-09', duration_days: 8, rent_amount: 1234.5, installation_cost: 99, print_cost: 55 };
const options: HistoryReportOptions = { landscape: true, financial: true, costs: true, team: false, notes: false, installationImages: false, designImages: false };
const styles = { primaryColor: '#d6ac40' } as ResolvedPrintStyles;

describe('billboard history and report', () => {
  it('keeps the current record active on its last calendar day', () => {
    expect(historyStatus(record, '2026-10-09')).toBe('current');
    expect(historyStatus(record, '2026-10-10')).toBe('completed');
  });
  it('distinguishes future and paused records', () => {
    expect(historyStatus({ ...record, start_date: '2026-11-01' }, '2026-10-09')).toBe('upcoming');
    expect(historyStatus({ ...record, individual_billboard_data: { type: 'pause' } }, '2026-10-09')).toBe('paused');
  });
  it('uses only supplied records for report totals without adding service costs twice', () => {
    expect(historyTotals([record])).toEqual({ count: 1, days: 8, revenue: 1234.5 });
    expect(buildHistoryReport(styles, 'لوحة', 1, [record], options)).toContain('1,234.5');
  });
  it('escapes names in generated documents', () => {
    const html = buildHistoryReport(styles, '<b>لوحة</b>', 1, [record], options);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(escapeHistoryHTML('"<&')).toBe('&quot;&lt;&amp;');
  });
  it('hides amounts and service columns when financial information is disabled', () => {
    const html = buildHistoryReport(styles, 'لوحة', 1, [record], { ...options, financial: false });
    expect(html).not.toContain('1,234.5');
    expect(html).not.toContain('القيمة (د.ل)');
    expect(html).not.toContain('<th>التركيب</th>');
    expect(html).not.toContain('إجمالي قيمة السجلات');
  });
  it('renders safe images separately and rejects executable URLs', () => {
    const html = buildHistoryReport(styles, 'لوحة', 1, [{ ...record, design_face_a_url: 'javascript:alert(1)', design_face_b_url: 'https://example.com/b.jpg' }], { ...options, designImages: true });
    expect(html).not.toContain('javascript:');
    expect(html).toContain('https://example.com/b.jpg');
    expect(html.indexOf('history-attachment')).toBeGreaterThan(html.indexOf('</table>'));
  });
  it('supports portrait layout and all rows of a long history', () => {
    const records = Array.from({ length: 70 }, (_, i) => ({ ...record, id: String(i), contract_number: i + 1 }));
    const html = buildHistoryReport(styles, 'لوحة', 1, records, { ...options, landscape: false });
    expect(html).toContain('size:A4 portrait');
    expect(html).toContain('>70</strong>');
    expect(html).toContain('display:table-header-group');
  });
});
