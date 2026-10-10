import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {BrowserWhatsAppBatch} from '@/components/billing/BrowserWhatsAppBatch';
import {whatsappBrowserRequest} from '@/lib/whatsappBrowser';
vi.mock('@/lib/whatsappBrowser',()=>({whatsappBrowserRequest:vi.fn()}));
describe('browser batch selection',()=>{
  let host:HTMLDivElement,root:Root;
  beforeEach(()=>{vi.clearAllMocks();(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);vi.mocked(whatsappBrowserRequest).mockResolvedValue({ok:true,connected:true,batch:null});});
  afterEach(()=>{act(()=>root.unmount());host.remove();});
  function render(){act(()=>root.render(<BrowserWhatsAppBatch recipients={[{id:'1',name:'أول',phone:'0912345678',message:'رسالة أولى'},{id:'2',name:'ثان',phone:'0922345678',message:'رسالة ثانية'},{id:'3',name:'ناقص',phone:'',message:'رسالة'}]}/>));}
  function button(text:string){return Array.from(host.querySelectorAll('button')).find(el=>el.textContent?.includes(text))!;}
  it('never sends automatically, excludes invalid numbers, and prepares only selected recipients',async()=>{
    render();expect(whatsappBrowserRequest).not.toHaveBeenCalled();
    act(()=>button('تحديد كل النتائج').click());expect(host.querySelectorAll('input:checked')).toHaveLength(2);
    expect(host.querySelector<HTMLInputElement>('[aria-label="تحديد ناقص"]')?.disabled).toBe(true);
    await act(async()=>button('فحص الاتصال').click());
    act(()=>host.querySelector<HTMLInputElement>('[aria-label="تحديد ثان"]')!.click());
    await act(async()=>button('مراجعة وبدء دفعة').click());
    expect(whatsappBrowserRequest).toHaveBeenLastCalledWith('PREPARE',[{id:'1',name:'أول',phone:'218912345678',message:'رسالة أولى'}]);
  });
});
