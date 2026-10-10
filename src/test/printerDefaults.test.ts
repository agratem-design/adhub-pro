import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ tables: {} as Record<string, any[]> }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from(table: string) {
    const filters: ((row: any) => boolean)[] = [];
    let update: any;
    let range: [number, number] | undefined;
    const run = () => {
      let data = (state.tables[table] || []).filter(row => filters.every(filter => filter(row)));
      if (update) data.forEach(row => Object.assign(row, update));
      if (range) data = data.slice(range[0], range[1] + 1);
      return { data, error: null };
    };
    const query: any = {
      select: () => query, order: () => query,
      eq: (key: string, value: any) => { filters.push(row => row[key] === value); return query; },
      is: (key: string, value: any) => { filters.push(row => row[key] === value); return query; },
      neq: (key: string, value: any) => { filters.push(row => row[key] !== value); return query; },
      in: (key: string, values: any[]) => { filters.push(row => values.includes(row[key])); return query; },
      range: (from: number, to: number) => { range = [from, to]; return query; },
      update: (values: any) => { update = values; return query; },
      maybeSingle: async () => ({ data: run().data[0] || null, error: null }),
      then: (resolve: any, reject: any) => Promise.resolve(run()).then(resolve, reject),
    };
    return query;
  },
} }));

import { defaultPrinterForContract, ensureDefaultPrinterAssignments, mainPrinterAt } from '@/lib/printerDefaults';
const printers = [{ id: 'fares', name: 'الفارس الذهبي' }, { id: 'external', name: 'مطبعة خارجية' }];
const defaults = { in_house_printer_id: null, schedule: [] };

describe('default printer attribution', () => {
  beforeEach(() => { state.tables = {}; });
  it('uses Golden Knight when no main printer periods have been configured', () => {
    expect(mainPrinterAt(defaults, '2026-10-09', printers)).toBe('fares');
    expect(defaultPrinterForContract(defaults, printers, { 'Contract Date': '2026-10-03' })).toBe('fares');
  });
  it('respects dated main printer changes while included contracts stay with the company printer', () => {
    const config = { ...defaults, schedule: [{ printer_id: 'fares', from: '2026-01-01' }, { printer_id: 'external', from: '2026-10-01' }] };
    expect(defaultPrinterForContract(config, printers, { 'Contract Date': '2026-09-30' })).toBe('fares');
    expect(defaultPrinterForContract(config, printers, { 'Contract Date': '2026-10-03' })).toBe('external');
    expect(defaultPrinterForContract(config, printers, { 'Contract Date': '2026-10-03', include_installation_in_price: true, include_print_in_billboard_price: true })).toBe('fares');
  });
  it('persists missing task and invoice attribution without moving assigned or cancelled tasks', async () => {
    state.tables = {
      printers: printers.map(p => ({ ...p, is_active: true })),
      Contract: [{ Contract_Number: 1311, 'Contract Date': '2026-10-03' }],
      print_tasks: [
        { id: 'missing', contract_id: 1311, created_at: '2026-10-03', printer_id: null, invoice_id: 'invoice', status: 'pending' },
        { id: 'assigned', printer_id: 'external', status: 'pending' },
        { id: 'cancelled', printer_id: null, status: 'cancelled' },
      ],
      printed_invoices: [{ id: 'invoice', printer_id: null }],
    };
    expect(await ensureDefaultPrinterAssignments()).toBe(1);
    expect(state.tables.print_tasks.map(t => t.printer_id)).toEqual(['fares', 'external', null]);
    expect(state.tables.printed_invoices[0].printer_id).toBe('fares');
    expect(await ensureDefaultPrinterAssignments()).toBe(0);
  });
});
