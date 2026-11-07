import { describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ upsert: async () => ({ error: null }) }) } }));
import { syncEventsAutoContinue } from '@/services/googleCalendarService';

const config = { scriptUrl: 'https://script.google.com/macros/s/auto-test/exec', emails: [], reminders: [1440], syncContracts: true, syncInstallments: true, syncContractStarts: true, syncInvoices: true, autoSync: false, lastSync: null };
const events = Array.from({ length: 12 }, (_, i) => ({
  id: `ev-${i}`, tag: `ADHUB_${i}`, type: 'installment' as const, title: `موعد ${i}`, description: '', startDate: '2026-12-01',
  allDay: true, customerName: 'عميل', daysRemainingOrOverdue: 5, isOverdue: false, isContractActive: true, statusText: 'قادم',
}));

describe('syncEventsAutoContinue', () => {
  it('skips an event the old script fails on and sends the rest', async () => {
    const original = global.fetch;
    const sentTags: string[] = [];
    global.fetch = vi.fn(async (_url: any, init: any) => {
      const body = JSON.parse(init.body);
      const tags: string[] = body.events.map((e: any) => e.tag);
      const badAt = tags.indexOf('ADHUB_3');
      if (badAt >= 0) {
        sentTags.push(...tags.slice(0, badAt));
        return { ok: true, status: 200, json: async () => ({ success: false, totalProcessed: badAt, createdCount: badAt, error: 'Invalid argument: guest' }) } as any;
      }
      sentTags.push(...tags);
      return { ok: true, status: 200, json: async () => ({ success: true, createdCount: tags.length, totalProcessed: tags.length }) } as any;
    }) as any;
    try {
      const res = await syncEventsAutoContinue(config as any, events as any, undefined, { batchSize: 5, delayMs: 1 });
      expect(res.success).toBe(true);
      expect(res.failed?.map(f => f.tag)).toEqual(['ADHUB_3']);
      expect(sentTags).toHaveLength(11);
      expect(sentTags).not.toContain('ADHUB_3');
    } finally { global.fetch = original; }
  });

  it('stops with a resume index when the user stops it', async () => {
    const original = global.fetch;
    global.fetch = vi.fn(async (_u: any, init: any) => {
      const n = JSON.parse(init.body).events.length;
      return { ok: true, status: 200, json: async () => ({ success: true, createdCount: n, totalProcessed: n }) } as any;
    }) as any;
    try {
      const res = await syncEventsAutoContinue(config as any, events as any, undefined, { batchSize: 5, delayMs: 1, shouldStop: () => true });
      expect(res.success).toBe(false);
      expect(res.lastProcessedIndex).toBe(0);
    } finally { global.fetch = original; }
  });
});
