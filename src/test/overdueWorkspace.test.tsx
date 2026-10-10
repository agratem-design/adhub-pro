import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OverdueWorkspace } from '@/components/billing/OverdueWorkspace';

describe('overdue collection workspace', () => {
  let host: HTMLDivElement, root: Root;
  beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  function render() {
    const settle = vi.fn(), account = vi.fn(), reminder = vi.fn(), refresh = vi.fn();
    const customer = (key: string, name: string, amount: number) => ({ key, name, amount, count: 1, days: 30, onAccount: account, onReminder: reminder, items: [{key:`invoice-${key}`,title:`فاتورة ${name}`,amount:amount+100,date:'2026-09-01',days:30,onSettle:settle,onReminder:reminder}] });
    const props = { title:'متأخرات', description:'مراجعة المستحقات', itemLabel:'فواتير', customers:[customer('a','زبون أول',400),customer('b','زبون ثانٍ',800)],totalAmount:1200,totalItems:2,search:'',onSearch:vi.fn(),minDays:0,onMinDays:vi.fn(),minAmount:'',onMinAmount:vi.fn(),sort:'oldest',onSort:vi.fn(),onRefresh:refresh };
    act(() => root.render(<OverdueWorkspace {...props}/>)); return { props, settle, account, reminder, refresh };
  }
  function click(text: string) {
    const button = Array.from(host.querySelectorAll('button')).find(el=>el.textContent?.trim()===text)!;
    expect(button).toBeTruthy(); act(()=>button.click());
  }
  it('shows the net account amount independently of individual invoice amounts', () => {
    render();
    const detail = host.querySelector('[aria-label="تفاصيل المتأخرات"]')!;
    expect(detail.querySelector('header')?.textContent).toContain((400).toLocaleString('ar-LY'));
    expect(detail.querySelector('article')?.textContent).toContain((500).toLocaleString('ar-LY'));
  });
  it('selects a customer without invoking payment or messaging', () => {
    const actions = render();
    const button = Array.from(host.querySelectorAll('button')).find(el=>el.getAttribute('aria-pressed')!==null&&el.textContent?.includes('زبون ثانٍ'))!;
    act(()=>button.click());
    expect(host.querySelector('[aria-label="تفاصيل المتأخرات"] h2')?.textContent).toBe('زبون ثانٍ');
    expect(actions.settle).not.toHaveBeenCalled(); expect(actions.reminder).not.toHaveBeenCalled();
    click('فتح كشف الحساب'); expect(actions.account).toHaveBeenCalledOnce();
    click('تسديد'); expect(actions.settle).toHaveBeenCalledOnce();
  });
  it('refreshes through the page loader without changing customer balances', () => {
    const actions = render(); click('تحديث'); expect(actions.refresh).toHaveBeenCalledOnce();
    expect(actions.settle).not.toHaveBeenCalled();
  });
});
