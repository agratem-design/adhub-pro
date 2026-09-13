import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { DOCUMENT_TYPES } from '@/types/document-types';
import { DEFAULT_PRINT_SETTINGS } from '@/types/print-settings';

const { upsert, rows } = vi.hoisted(() => ({ upsert: vi.fn(), rows: [] as any[] }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({ select: async () => ({ data: rows, error: null }), upsert }) },
}));
vi.mock('@/hooks/useInvoiceSettingsSync', () => ({ clearInvoiceSettingsCache: vi.fn() }));
import { PrintSettingsProvider, usePrintSettings } from '@/store/printSettingsStore';

let api: ReturnType<typeof usePrintSettings>;
let root: Root;
function Consumer() { api = usePrintSettings(); return null; }

describe('shared invoice settings persistence', () => {
  beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    rows.splice(0, rows.length,
      { ...DEFAULT_PRINT_SETTINGS, document_type: DOCUMENT_TYPES.PAYMENT_RECEIPT, document_title_ar: 'إيصال استلام' },
      { ...DEFAULT_PRINT_SETTINGS, document_type: DOCUMENT_TYPES.SALES_INVOICE, document_title_ar: 'فاتورة مبيعات' },
    );
    upsert.mockReset().mockResolvedValue({ error: null });
    root = createRoot(document.createElement('div'));
    await act(async () => { root.render(React.createElement(PrintSettingsProvider, null, React.createElement(Consumer))); });
  });
  afterEach(async () => { await act(async () => root.unmount()); vi.restoreAllMocks(); });

  it('saves every invoice in one request and retains each title', async () => {
    await act(async () => { expect(await api.saveGlobalToAll({ footer_text: 'النص المشترك', document_title_ar: 'لا ينسخ' })).toBe(true); });
    expect(upsert).toHaveBeenCalledTimes(1);
    const payload = upsert.mock.calls[0][0];
    expect(payload).toHaveLength(Object.keys(DOCUMENT_TYPES).length);
    expect(payload.every((row: any) => row.footer_text === 'النص المشترك')).toBe(true);
    expect(payload.find((row: any) => row.document_type === DOCUMENT_TYPES.SALES_INVOICE).document_title_ar).toBe('فاتورة مبيعات');
  });

  it('reports a failed save without changing the active template', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    upsert.mockResolvedValue({ error: { message: 'Save failed' } });
    const previous = api.selectPrintSettingsByType(DOCUMENT_TYPES.SALES_INVOICE).footer_text;
    await act(async () => { expect(await api.saveGlobalToAll({ footer_text: 'لم يحفظ' })).toBe(false); });
    expect(api.selectPrintSettingsByType(DOCUMENT_TYPES.SALES_INVOICE).footer_text).toBe(previous);
  });

  it('updates the official source when editing shared fields from another invoice', async () => {
    await act(async () => { expect(await api.saveSettings(DOCUMENT_TYPES.SALES_INVOICE, { footer_text: 'فوتر موحد' })).toBe(true); });
    expect(upsert.mock.calls[0][0].map((row: any) => row.document_type)).toContain(DOCUMENT_TYPES.PAYMENT_RECEIPT);
    expect(api.selectPrintSettingsByType(DOCUMENT_TYPES.PURCHASE_INVOICE).footer_text).toBe('فوتر موحد');
  });
});
