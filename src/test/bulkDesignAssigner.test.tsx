import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BulkDesignAssigner } from '@/components/tasks/BulkDesignAssigner';

const db = vi.hoisted(() => ({ updates: [] as any[], requests: 0, designs: ['a', 'b', 'c'].map(id => ({ id, design_face_a_url: `/${id}.jpg`, design_face_b_url: null })) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (table: string) => table === 'task_designs' ? { select: () => ({ in: async () => ({ data: db.designs, error: null }) }) } : { update: (data: any) => ({ in: async (_key: string, ids: string[]) => { db.requests++; db.updates.push(...ids.map(id=>({id,...data}))); return { error: null }; } }) } } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('design distribution review and persistence', () => {
  let host: HTMLDivElement, root: Root;
  const items = Array.from({ length: 10 }, (_, i) => ({ id: `item-${i}`, billboard_id: i, billboards: { ID: i, Billboard_Name: `لوحة ${i}`, Size: i < 4 ? '3×6' : '4×8' } }));
  const designs = db.designs.map(d => ({ ...d, design_name: `تصميم ${d.id}` }));
  beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; db.updates = []; db.requests=0; host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  async function click(label: string) {
    const button = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === label);
    expect(button).toBeTruthy(); await act(async () => button!.click());
  }
  function render(overrides: Record<string, any> = {}) {
    const props = { open: true, onOpenChange: vi.fn(), taskItems: items, taskDesigns: designs, onSuccess: vi.fn(), ...overrides };
    act(() => root.render(<BulkDesignAssigner {...props} />)); return props;
  }
  it('previews balanced counts and saves exactly that plan', async () => {
    const props = render();
    await click('توزيع متساوٍ');
    await click('تصميم aالوجه الأماميالوجه الخلفي');
    await click('تصميم bالوجه الأماميالوجه الخلفي');
    await click('تصميم cالوجه الأماميالوجه الخلفي');
    await click('معاينة التوزيع');
    expect(document.body.textContent).toContain('تصميم a · 4 لوحة');
    expect(document.body.textContent).toContain('تصميم b · 3 لوحة');
    await click('تطبيق على 10 لوحة');
    expect(db.updates).toHaveLength(10);
    expect(db.requests).toBe(3);
    expect(['a', 'b', 'c'].map(id => db.updates.filter(p => p.selected_design_id === id).length)).toEqual([4, 3, 3]);
    expect(props.onSuccess).toHaveBeenCalledOnce();
  });
  it('restricts assignment to the selected size', async () => {
    render(); await click('حسب المقاس'); await click('3×6 (4)');
    await click('تصميم aالوجه الأماميالوجه الخلفي');
    await click('تطبيق على 4 لوحة');
    expect(db.updates.map(p => p.id)).toEqual(items.slice(0, 4).map(i => i.id));
  });
  it('only assigns unassigned boards and preserves completed boards when requested', async () => {
    render({ taskItems: items.map((item,i)=>({...item,selected_design_id:i<3?'b':null,design_face_a:i===3?'/legacy.jpg':null,status:i===4?'completed':'pending'})) });
    await click('بدون تصميم');
    const checkbox = Array.from(document.querySelectorAll('label')).find(el=>el.textContent?.includes('اللوحات غير المكتملة فقط'))!.querySelector('button')!;
    await act(async()=>checkbox.click());
    await click('تصميم aالوجه الأماميالوجه الخلفي');
    await click('تطبيق على 5 لوحة');
    expect(db.updates.map(p=>p.id)).toEqual(items.slice(5).map(i=>i.id));
  });
  it('starts manual quantities with a balanced plan', async () => {
    render(); await click('توزيع متساوٍ');
    await click('تصميم aالوجه الأماميالوجه الخلفي'); await click('تصميم bالوجه الأماميالوجه الخلفي');
    const checkbox = Array.from(document.querySelectorAll('label')).find(el=>el.textContent?.includes('تحديد الكميات بنفسي'))!.querySelector('button')!;
    await act(async()=>checkbox.click());
    expect((document.querySelector('[aria-label="عدد لوحات تصميم a"]') as HTMLInputElement).value).toBe('5');
    expect((document.querySelector('[aria-label="عدد لوحات تصميم b"]') as HTMLInputElement).value).toBe('5');
    await click('تطبيق على 10 لوحة');
    expect(db.updates.filter(p=>p.selected_design_id==='a')).toHaveLength(5);
  });
});
