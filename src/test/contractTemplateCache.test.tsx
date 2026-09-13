import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { useContractTemplateSettings } from '@/hooks/useContractTemplateSettings';
import { contractTemplateQueryOptions } from '@/lib/contractTemplateQuery';

const { row, maybeSingle } = vi.hoisted(() => {
  const row = { setting_value: { termsStartY: 777, tableBackgroundUrl: '/saved-table.svg' }, background_url: '/saved-cover.svg' };
  return { row, maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }) };
});
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) },
}));

it.each(['print-first', 'settings-first'])('preserves saved settings across navigation: %s', async (order) => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRoot(document.createElement('div'));
  let printed: ReturnType<typeof useContractTemplateSettings>['data'];
  let settings: ReturnType<typeof useQuery>['data'];
  function Print() { printed = useContractTemplateSettings().data; return null; }
  function Settings() { settings = useQuery(contractTemplateQueryOptions).data; return null; }
  const render = async (Component: typeof Print) => {
    await act(async () => {
      root.render(<QueryClientProvider client={client}><Component /></QueryClientProvider>);
    });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  };
  try {
    await render(order === 'print-first' ? Print : Settings);
    await render(order === 'print-first' ? Settings : Print);
    expect(settings).toEqual(row);
    expect(printed?.settings.termsStartY).toBe(777);
    expect(printed?.backgroundUrl).toBe('/saved-cover.svg');
    expect(printed?.tableBackgroundUrl).toBe('/saved-table.svg');
    expect(client.getQueryData(contractTemplateQueryOptions.queryKey)).toEqual(row);
  } finally {
    await act(async () => root.unmount());
    client.clear();
  }
});
