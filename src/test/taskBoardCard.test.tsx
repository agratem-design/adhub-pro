import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskBoardCard } from '@/components/installation/TaskBoardCard';

describe('TaskBoardCard actions and execution information', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); });

  function render(overrides: Record<string, any> = {}) {
    const props = {
      item: { id: 'item-1', billboard_id: 42, status: 'pending', faces_to_install: 1 },
      billboard: { Billboard_Name: 'TR-42', Size: '3×6', Image_URL: '/board.jpg' },
      selected: false, printActive: true, contractId: 1320,
      onSelect: vi.fn(), onManage: vi.fn(), onPhoto: vi.fn(), onPreview: vi.fn(),
      ...overrides,
    };
    act(() => root.render(<TaskBoardCard {...props} />));
    return props;
  }
  function click(label: string) {
    const button = Array.from(host.querySelectorAll('button')).find(b => b.textContent?.includes(label));
    expect(button).toBeTruthy();
    act(() => button!.click());
  }

  it('keeps image upload and board management as separate actions', () => {
    const props = render();
    click('إضافة صورة');
    expect(props.onPhoto).toHaveBeenCalledOnce();
    expect(props.onManage).not.toHaveBeenCalled();
    click('إدارة اللوحة');
    expect(props.onManage).toHaveBeenCalledOnce();
    expect(host.textContent).toContain('عقد #1320');
    expect(host.textContent).toContain('مع الطباعة');
  });

  it('selects a board without opening management or the photo', () => {
    const props = render();
    act(() => (host.querySelector('[role="checkbox"]') as HTMLElement).click());
    expect(props.onSelect).toHaveBeenCalledWith(true);
    expect(props.onManage).not.toHaveBeenCalled();
    expect(props.onPhoto).not.toHaveBeenCalled();
  });

  it('previews the installed image for completed boards', () => {
    const props = render({ item: { id: 'item-1', billboard_id: 42, status: 'completed', installed_image_face_a_url: '/installed.jpg' } });
    act(() => (host.querySelector('[aria-label="عرض صورة TR-42"]') as HTMLElement).click());
    expect(props.onPreview).toHaveBeenCalledWith('/installed.jpg');
    expect(host.textContent).toContain('مكتملة');
    expect(host.textContent).toContain('صور التركيب');
  });

  it('handles missing billboard data and hides inactive printing', () => {
    render({ billboard: undefined, printActive: false });
    expect(host.textContent).toContain('لوحة #42');
    expect(host.textContent).toContain('أقرب نقطة دالة');
    expect(host.textContent).toContain('غير محددة');
    expect(host.textContent).not.toContain('مع الطباعة');
    expect((host.querySelector('[aria-label="عرض صورة لوحة #42"]') as HTMLButtonElement).disabled).toBe(true);
  });
});
