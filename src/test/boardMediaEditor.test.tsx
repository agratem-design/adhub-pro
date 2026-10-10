import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { BoardMediaEditor } from '@/components/installation/BoardMediaEditor';

const mocks = vi.hoisted(() => ({ assign: vi.fn(), photos: vi.fn(), insert: vi.fn(), insertError: null as any }));
vi.mock('@/services/boardMediaService', () => ({ assignBoardDesign: mocks.assign, saveBoardPhotos: mocks.photos }));
vi.mock('@/components/ui/image-upload-zone', () => ({ ImageUploadZone: ({ label, value, onChange }: any) => <div><span>{value}</span><button onClick={() => onChange('/new-front.jpg')}>{label}</button></div> }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ insert: (row: any) => { mocks.insert(row); return { select: () => ({ single: async () => ({ data: { id: 'new-design', ...row }, error: mocks.insertError }) }) }; } }) } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('inline board media editing', () => {
  let root: Root, host: HTMLDivElement;
  const item = { id: 'item-1', task_id: 'task-1', billboard_id: 42, faces_to_install: 1, installed_image_face_a_url: '/old-a.jpg', installed_image_face_b_url: '/old-b.jpg' };
  const design = { id: 'design-1', design_name: 'تصميم جاهز', design_face_a_url: '/design.jpg' };
  beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; mocks.assign.mockReset(); mocks.photos.mockReset(); mocks.insert.mockReset(); mocks.insertError = null; host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  function render(mode: 'design' | 'photos' = 'design') {
    const props = { mode, item, billboard: { Billboard_Name: 'TR-42', Faces_Count: 1 }, contractId: 1320, adType: 'حملة', designs: [design], onClose: vi.fn(), onRefresh: vi.fn() };
    act(() => root.render(<BoardMediaEditor {...props} />)); return props;
  }
  async function click(text: string) {
    const button = Array.from(host.querySelectorAll('button')).find(b => b.textContent?.trim() === text)!;
    expect(button).toBeTruthy(); await act(async () => button.click());
  }
  it('applies a selected design immediately without opening another window', async () => {
    const props = render(); await click('تصميم جاهز');
    expect(mocks.assign).toHaveBeenCalledWith(item, design, 1320);
    expect(props.onClose).toHaveBeenCalledOnce(); expect(props.onRefresh).toHaveBeenCalledOnce();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it('creates and applies an uploaded design in one action', async () => {
    const props = render(); await click('رفع تصميم جديد لهذه اللوحة');
    await click('تصميم الوجه الأمامي'); await click('حفظ وتطبيق التصميم');
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ task_id: 'task-1', design_face_a_url: '/new-front.jpg' }));
    expect(mocks.assign).toHaveBeenCalledWith(item, expect.objectContaining({ id: 'new-design' }), 1320);
    expect(props.onClose).toHaveBeenCalledOnce();
  });
  it('preserves the untouched face when uploading a one-face installation', async () => {
    render('photos'); expect(host.textContent).not.toContain('صورة تركيب الوجه الخلفي');
    await click('صورة تركيب الوجه الأمامي'); await click('حفظ صور التركيب');
    expect(mocks.photos).toHaveBeenCalledWith(item, expect.anything(), 'حملة', '/new-front.jpg', '/old-b.jpg');
  });
  it('keeps the editor open if assignment fails', async () => {
    mocks.assign.mockRejectedValueOnce(new Error('فشل الحفظ')); const props = render();
    await click('تصميم جاهز'); expect(props.onClose).not.toHaveBeenCalled();
    expect(props.onRefresh).toHaveBeenCalledOnce();
  });
});
