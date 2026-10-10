import { describe, beforeEach, expect, it, vi } from 'vitest';
import { assignBoardDesign, saveBoardPhotos } from '@/services/boardMediaService';
const db = vi.hoisted(() => ({ updates: [] as any[], failItem: false }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (table: string) => ({
  update: (data: any) => ({ in: (_key: string, ids: string[]) => ({ eq: async (key: string, id: any) => { db.updates.push({ table, data, key, id, ids }); return { error: null }; } }), eq: async (key: string, id: any) => { db.updates.push({ table, data, key, id }); return { error: table === 'installation_task_items' && db.failItem ? new Error('db error') : null }; } }),
  select: () => ({ eq: async () => ({ data: [{ id: 'print-1' }], error: null }) }),
}) } }));
describe('board media persistence', () => {
  const item = { id: 'item-1', billboard_id: 42, installed_image_url: '/legacy.jpg' };
  beforeEach(() => { db.updates = []; db.failItem = false; });
  it('saves the chosen design and synchronizes linked printing and billboard data', async () => {
    await assignBoardDesign(item, { id: 'design-1', design_face_a_url: '/a.jpg', design_face_b_url: '/b.jpg' }, 1320);
    expect(db.updates.map(row => row.table)).toEqual(['installation_task_items', 'print_task_items', 'billboards']);
    expect(db.updates[0].data).toEqual({ selected_design_id: 'design-1', design_face_a: '/a.jpg', design_face_b: '/b.jpg' });
    expect(db.updates[1].id).toBe(42);
  });
  it('stops synchronization if the initial save fails', async () => {
    db.failItem = true; await expect(assignBoardDesign(item, { id: 'design-1' }, 1320)).rejects.toThrow('db error');
    expect(db.updates).toHaveLength(1);
  });
  it('preserves legacy photos and builds fallback paths for both faces', async () => {
    await saveBoardPhotos(item, { Billboard_Name: 'TR-42' }, 'حملة', '/a.jpg', '/b.jpg');
    const update = db.updates[0];
    expect(update.id).toBe('item-1'); expect(update.data.installed_image_url).toBe('/legacy.jpg');
    expect(update.data.installed_image_face_b_url).toBe('/b.jpg');
    expect(update.data.fallback_path_installed_a).toContain('TR-42');
    expect(update.data.fallback_path_installed_b).toContain('TR-42');
  });
});
