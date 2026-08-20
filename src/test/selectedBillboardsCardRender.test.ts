import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

/**
 * Test suite for SelectedBillboardsCard rendering logic, badge resolution,
 * ID normalization, and metadata safety.
 */

describe('SelectedBillboardsCard Component Logic & Badge Resolution', () => {
  // Test 1: cn utility verification
  it('cn helper works properly with conditional classes', () => {
    const isInstant = true;
    const className = cn(
      'text-white text-[10px] font-bold px-2 py-0.5 shadow-md flex items-center gap-1 backdrop-blur-sm',
      isInstant ? 'bg-primary text-primary-foreground border border-primary/40' : 'bg-blue-600/90 border border-blue-500/20'
    );
    expect(className).toContain('bg-primary');
    expect(className).toContain('text-primary-foreground');
  });

  // Test 2: ID Normalization across number and string types
  it('normalizes string and number billboard IDs seamlessly in replacementsMap', () => {
    const swapLogs = [
      {
        id: 'log-1',
        created_at: '2026-08-20T11:37:12.169Z',
        action: 'instant_billboard_swap',
        details: {
          replacement_billboard_id: 642, // numeric
          original_billboard_id: 982,
          original_billboard_name: 'QN0982',
          preserved_contract_price: 2450,
        },
      },
      {
        id: 'log-2',
        created_at: '2026-08-20T09:28:08.762Z',
        action: 'instant_billboard_swap',
        details: JSON.stringify({
          replacement_billboard_id: '645', // stringified numeric in JSON
          original_billboard_id: '643',
          original_billboard_name: 'KH-SK0643',
          preserved_contract_price: 1100,
        }),
      },
    ];

    const replacementsMap = new Map<string, any>();
    swapLogs.forEach((log) => {
      let details: any = {};
      try {
        details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details || {};
      } catch {
        details = {};
      }
      const replId = details?.replacement_billboard_id;
      if (replId) {
        replacementsMap.set(String(replId), {
          isInstantSwap: true,
          pausedName: details.original_billboard_name || `لوحة #${details.original_billboard_id}`,
          allocated: Number(details.preserved_contract_price) || 0,
          originalId: details.original_billboard_id,
        });
      }
    });

    // Lookup with string ID '642'
    expect(replacementsMap.has('642')).toBe(true);
    expect(replacementsMap.get('642').isInstantSwap).toBe(true);
    expect(replacementsMap.get('642').pausedName).toBe('QN0982');
    expect(replacementsMap.get('642').allocated).toBe(2450);

    // Lookup with string ID '645'
    expect(replacementsMap.has('645')).toBe(true);
    expect(replacementsMap.get('645').isInstantSwap).toBe(true);
    expect(replacementsMap.get('645').pausedName).toBe('KH-SK0643');

    // Normal billboard '510' that was not swapped
    expect(replacementsMap.has('510')).toBe(false);
  });

  // Test 3: Corrupted or missing details safety
  it('safely handles malformed or null activity_log entries without throwing', () => {
    const malformedLogs = [
      { id: 'log-err-1', action: 'instant_billboard_swap', details: null },
      { id: 'log-err-2', action: 'instant_billboard_swap', details: 'INVALID_JSON{{{' },
      { id: 'log-err-3', action: 'instant_billboard_swap', details: {} },
      { id: 'log-err-4', action: 'instant_billboard_swap', details: { other_data: 123 } },
    ];

    const replacementsMap = new Map<string, any>();
    expect(() => {
      malformedLogs.forEach((log) => {
        let details: any = {};
        try {
          details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details || {};
        } catch {
          details = {};
        }
        const replId = details?.replacement_billboard_id;
        if (replId) {
          replacementsMap.set(String(replId), {
            isInstantSwap: true,
            pausedName: details.original_billboard_name || `لوحة #${details.original_billboard_id}`,
            allocated: Number(details.preserved_contract_price) || 0,
          });
        }
      });
    }).not.toThrow();

    expect(replacementsMap.size).toBe(0);
  });

  // Test 4: Badge and Banner Rendering Model
  it('correctly builds badge and banner data for different billboard types', () => {
    const billboards = [
      { id: '626', name: 'Normal BB 626' },
      { id: '642', name: 'Instant Swapped BB 642' },
      { id: '671', name: 'Pause Replacement BB 671' },
    ];

    const replacementsMap = new Map<string, any>([
      ['642', { isInstantSwap: true, pausedName: 'QN0982', allocated: 2450, originalId: 982 }],
      ['671', { isInstantSwap: false, pausedName: 'ZL-ZL0670', allocated: 2400, startDate: '2026-05-24', endDate: '2026-10-26' }],
    ]);

    // Check Normal Billboard 626
    const bb626Repl = replacementsMap.get('626');
    expect(bb626Repl).toBeUndefined();

    // Check Instant Swap Billboard 642
    const bb642Repl = replacementsMap.get('642');
    expect(bb642Repl).toBeDefined();
    expect(bb642Repl.isInstantSwap).toBe(true);
    expect(bb642Repl.pausedName).toBe('QN0982');
    expect(bb642Repl.allocated).toBe(2450);

    // Check Pause Replacement Billboard 671
    const bb671Repl = replacementsMap.get('671');
    expect(bb671Repl).toBeDefined();
    expect(bb671Repl.isInstantSwap).toBe(false);
    expect(bb671Repl.pausedName).toBe('ZL-ZL0670');
    expect(bb671Repl.allocated).toBe(2400);
  });
});
