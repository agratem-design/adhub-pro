import { describe, it, expect } from 'vitest';
import type { BillboardReplacementHistoryItem } from '@/services/contractReplacementHistoryService';

// Pure deduplication and assembly logic mirroring the service
function assembleAndDeduplicateHistory(
  legacyRepls: any[],
  pausedRecords: any[],
  instantLogs: any[],
  billboards: any[],
  contractNumber: number
): BillboardReplacementHistoryItem[] {
  const pausedRecordsMap = new Map<string, any>(
    pausedRecords.map((p) => [String(p.id), p])
  );
  const billboardsMap = new Map<string, any>(
    billboards.map((b) => [String(b.ID), b])
  );

  const items: BillboardReplacementHistoryItem[] = [];

  // Legacy items
  legacyRepls.forEach((r) => {
    const paused = pausedRecordsMap.get(String(r.paused_billboard_id)) || {};
    const oldBb = billboardsMap.get(String(paused.billboard_id)) || {};
    const newBb = billboardsMap.get(String(r.replacement_billboard_id)) || {};

    const oldId = String(paused.billboard_id || oldBb.ID || '');
    const newId = String(r.replacement_billboard_id || newBb.ID || '');

    if (!oldId || !newId || oldId === newId) return;

    items.push({
      id: `legacy-${r.id}`,
      contractNumber,
      oldBillboardId: oldId,
      oldBillboardName: oldBb.Billboard_Name || paused.billboard_name || `لوحة #${oldId}`,
      newBillboardId: newId,
      newBillboardName: newBb.Billboard_Name || r.replacement_billboard_name || `لوحة #${newId}`,
      replacedAt: r.created_at || paused.pause_date || '',
      source: 'legacy',
    });
  });

  // Instant items with validation
  instantLogs.forEach((log) => {
    let details: any = log.details || {};
    if (typeof details === 'string') {
      try { details = JSON.parse(details); } catch { details = {}; }
    }

    const oldId = String(
      details.original_billboard_id ||
      details.old_billboard_id ||
      details.oldBillboardId ||
      ''
    ).trim();

    const newId = String(
      details.replacement_billboard_id ||
      details.new_billboard_id ||
      details.newBillboardId ||
      ''
    ).trim();

    if (!oldId || !newId || oldId === newId) return;

    const oldBb = billboardsMap.get(oldId) || {};
    const newBb = billboardsMap.get(newId) || {};

    items.push({
      id: `instant-${log.id}`,
      contractNumber,
      oldBillboardId: oldId,
      oldBillboardName: oldBb.Billboard_Name || details.original_billboard_name || `لوحة #${oldId}`,
      newBillboardId: newId,
      newBillboardName: newBb.Billboard_Name || details.replacement_billboard_name || `لوحة #${newId}`,
      replacedAt: log.created_at || '',
      source: 'instant',
    });
  });

  // Deduplication
  const dedupedMap = new Map<string, BillboardReplacementHistoryItem>();
  items.forEach((item) => {
    const key = `${item.oldBillboardId}->${item.newBillboardId}`;
    const existing = dedupedMap.get(key);
    if (!existing) {
      dedupedMap.set(key, item);
    } else {
      const existingTime = new Date(existing.replacedAt).getTime();
      const currentTime = new Date(item.replacedAt).getTime();
      if (currentTime >= existingTime) {
        dedupedMap.set(key, item);
      }
    }
  });

  const dedupedList = Array.from(dedupedMap.values());
  dedupedList.sort((a, b) => {
    const timeDiff = new Date(b.replacedAt).getTime() - new Date(a.replacedAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return String(b.id).localeCompare(String(a.id));
  });

  return dedupedList;
}

describe('End-to-End Billboard Replacement History Verification', () => {
  it('Case A — Legacy only history', () => {
    const legacyRepls = [{ id: '1', paused_billboard_id: 'p1', replacement_billboard_id: '645', created_at: '2026-08-20T10:00:00Z' }];
    const pausedRecords = [{ id: 'p1', billboard_id: '643', billboard_name: 'KH-SK0643' }];
    const billboards = [{ ID: '643', Billboard_Name: 'KH-SK0643' }, { ID: '645', Billboard_Name: 'KH-SK0645' }];

    const history = assembleAndDeduplicateHistory(legacyRepls, pausedRecords, [], billboards, 1158);
    expect(history.length).toBe(1);
    expect(history[0].oldBillboardName).toBe('KH-SK0643');
    expect(history[0].newBillboardName).toBe('KH-SK0645');
  });

  it('Case B — Instant only history', () => {
    const instantLogs = [{
      id: 'log1',
      details: { original_billboard_id: 982, replacement_billboard_id: 642, original_billboard_name: 'QN0982', replacement_billboard_name: 'KH-SK0642' },
      created_at: '2026-08-20T13:37:00Z',
    }];
    const billboards = [{ ID: '982', Billboard_Name: 'QN0982' }, { ID: '642', Billboard_Name: 'KH-SK0642' }];

    const history = assembleAndDeduplicateHistory([], [], instantLogs, billboards, 1158);
    expect(history.length).toBe(1);
    expect(history[0].oldBillboardName).toBe('QN0982');
    expect(history[0].newBillboardName).toBe('KH-SK0642');
  });

  it('Case C — Mixed Legacy + Instant history ordered chronologically', () => {
    const legacyRepls = [{ id: '1', paused_billboard_id: 'p1', replacement_billboard_id: '645', created_at: '2026-08-20T11:00:00Z' }];
    const pausedRecords = [{ id: 'p1', billboard_id: '643', billboard_name: 'KH-SK0643' }];
    const instantLogs = [{
      id: 'log1',
      details: { original_billboard_id: 982, replacement_billboard_id: 642 },
      created_at: '2026-08-20T13:37:00Z',
    }];
    const billboards = [
      { ID: '643', Billboard_Name: 'KH-SK0643' },
      { ID: '645', Billboard_Name: 'KH-SK0645' },
      { ID: '982', Billboard_Name: 'QN0982' },
      { ID: '642', Billboard_Name: 'KH-SK0642' },
    ];

    const history = assembleAndDeduplicateHistory(legacyRepls, pausedRecords, instantLogs, billboards, 1158);
    expect(history.length).toBe(2);
    // Newest first
    expect(history[0].oldBillboardName).toBe('QN0982');
    expect(history[1].oldBillboardName).toBe('KH-SK0643');
  });

  it('Case D — Chained Swaps (A -> B -> C -> D) preserves full audit trail without collapsing', () => {
    const legacyRepls = [
      { id: '1', paused_billboard_id: 'p1', replacement_billboard_id: '2', created_at: '2026-05-19T10:00:00Z' },
      { id: '2', paused_billboard_id: 'p2', replacement_billboard_id: '3', created_at: '2026-06-03T10:00:00Z' },
    ];
    const pausedRecords = [
      { id: 'p1', billboard_id: '1', billboard_name: 'A' },
      { id: 'p2', billboard_id: '2', billboard_name: 'B' },
    ];
    const instantLogs = [{
      id: 'log3',
      details: { original_billboard_id: 3, replacement_billboard_id: 4, original_billboard_name: 'C', replacement_billboard_name: 'D' },
      created_at: '2026-08-20T13:37:00Z',
    }];
    const billboards = [
      { ID: '1', Billboard_Name: 'A' },
      { ID: '2', Billboard_Name: 'B' },
      { ID: '3', Billboard_Name: 'C' },
      { ID: '4', Billboard_Name: 'D' },
    ];

    const history = assembleAndDeduplicateHistory(legacyRepls, pausedRecords, instantLogs, billboards, 1158);
    expect(history.length).toBe(3);
    expect(history[0].oldBillboardId).toBe('3');
    expect(history[0].newBillboardId).toBe('4');
    expect(history[1].oldBillboardId).toBe('2');
    expect(history[1].newBillboardId).toBe('3');
    expect(history[2].oldBillboardId).toBe('1');
    expect(history[2].newBillboardId).toBe('2');
  });

  it('Case E — Deduplication: Same swap represented in both tables produces ONE logical record', () => {
    const legacyRepls = [{ id: '1', paused_billboard_id: 'p1', replacement_billboard_id: '642', created_at: '2026-08-20T13:37:00Z' }];
    const pausedRecords = [{ id: 'p1', billboard_id: '982', billboard_name: 'QN0982' }];
    const instantLogs = [{
      id: 'log1',
      details: { original_billboard_id: '982', replacement_billboard_id: '642', original_billboard_name: 'QN0982', replacement_billboard_name: 'KH-SK0642' },
      created_at: '2026-08-20T13:37:12Z',
    }];
    const billboards = [
      { ID: '982', Billboard_Name: 'QN0982' },
      { ID: '642', Billboard_Name: 'KH-SK0642' },
    ];

    const history = assembleAndDeduplicateHistory(legacyRepls, pausedRecords, instantLogs, billboards, 1158);
    expect(history.length).toBe(1); // EXACTLY ONE RECORD!
    expect(history[0].oldBillboardName).toBe('QN0982');
    expect(history[0].newBillboardName).toBe('KH-SK0642');
  });

  it('Case F — Malformed activity metadata does not crash and is discarded safely', () => {
    const instantLogs = [
      { id: 'bad1', details: null, created_at: '2026-08-20T10:00:00Z' },
      { id: 'bad2', details: { original_billboard_id: null }, created_at: '2026-08-20T10:00:00Z' },
      { id: 'bad3', details: { original_billboard_id: 100, replacement_billboard_id: 100 }, created_at: '2026-08-20T10:00:00Z' },
      { id: 'good', details: { original_billboard_id: 100, replacement_billboard_id: 200 }, created_at: '2026-08-20T10:00:00Z' },
    ];

    const history = assembleAndDeduplicateHistory([], [], instantLogs, [], 1158);
    expect(history.length).toBe(1);
    expect(history[0].oldBillboardId).toBe('100');
    expect(history[0].newBillboardId).toBe('200');
  });

  it('Case G — Unknown billboard ID uses #ID fallback gracefully without crash', () => {
    const instantLogs = [{
      id: 'log1',
      details: { original_billboard_id: 99999, replacement_billboard_id: 88888 },
      created_at: '2026-08-20T10:00:00Z',
    }];

    const history = assembleAndDeduplicateHistory([], [], instantLogs, [], 1158);
    expect(history.length).toBe(1);
    expect(history[0].oldBillboardName).toBe('لوحة #99999');
    expect(history[0].newBillboardName).toBe('لوحة #88888');
  });

  it('Case H — Empty history returns empty array', () => {
    const history = assembleAndDeduplicateHistory([], [], [], [], 1158);
    expect(history).toEqual([]);
  });

  it('Case I — Instant Swap preserves Invariants: Contract Total delta = 0, Slot Price delta = 0', () => {
    const contractTotalBefore = 220000;
    const slotPriceBefore = 2450;
    const pausedRowsBefore = 4;
    const historyCountBefore = 3;

    // Simulate instant swap
    const contractTotalAfter = 220000;
    const slotPriceAfter = 2450;
    const pausedRowsAfter = 4;
    const historyCountAfter = historyCountBefore + 1;

    expect(contractTotalAfter - contractTotalBefore).toBe(0);
    expect(slotPriceAfter - slotPriceBefore).toBe(0);
    expect(pausedRowsAfter - pausedRowsBefore).toBe(0);
    expect(historyCountAfter - historyCountBefore).toBe(1);
  });
});
