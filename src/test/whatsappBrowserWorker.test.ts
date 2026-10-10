import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';

describe('WhatsApp extension worker safety and queue lifecycle',()=>{
  let state:any,listener:any,alarm:any,chromeMock:any;
  const app={tab:{id:1},frameId:0,url:'https://alfares.test/admin/overdue-payments'};
  const popup={url:'chrome-extension://test/popup.html'};
  const recipients=[{name:'أ',phone:'0912345678',message:'رسالة أولى'},{name:'ب',phone:'0922345678',message:'رسالة ثانية'}];
  const call=(action:string,sender:any=app,extra:any={})=>new Promise<any>(resolve=>listener({channel:'alfares',action,...extra},sender,resolve));
  const wa=()=>({tab:{id:2},frameId:0,documentId:'doc',url:`https://web.whatsapp.com/send?phone=${state.batch.items[0].phone}&text=${encodeURIComponent(state.batch.items[0].message)}`});
  beforeEach(async()=>{
    vi.resetModules();state={connection:{tabId:1,origin:'https://alfares.test'},batch:null};
    chromeMock={runtime:{getURL:(file:string)=>`chrome-extension://test/${file}`,onMessage:{addListener:(fn:any)=>{listener=fn;}}},storage:{session:{get:vi.fn(async()=>({state:structuredClone(state)})),set:vi.fn(async(value:any)=>{state=structuredClone(value.state);})}},windows:{create:vi.fn(async()=>({}))},tabs:{query:vi.fn(async()=>[{id:2,url:'https://web.whatsapp.com/'}]),update:vi.fn(async()=>({})),get:vi.fn(async()=>({id:1,url:app.url}))},scripting:{executeScript:vi.fn(async()=>[])},alarms:{create:vi.fn(async()=>{}),clear:vi.fn(async()=>true),onAlarm:{addListener:(fn:any)=>{alarm=fn;}}}};
    vi.stubGlobal('chrome',chromeMock);await import('../../extensions/alfares-whatsapp/background.js');
  });
  afterEach(()=>vi.unstubAllGlobals());
  async function start(){await call('PREPARE',app,{payload:recipients});await call('START',popup);}
  it('rejects other tabs and origins even when the payload is valid',async()=>{
    expect((await call('PREPARE',{...app,tab:{id:9}},{payload:recipients})).ok).toBe(false);
    expect((await call('PREPARE',{...app,url:'https://evil.test/'},{payload:recipients})).ok).toBe(false);
    expect(state.batch).toBeNull();
  });
  it('only prepares from the app; only the extension review can start sending',async()=>{
    expect((await call('PREPARE',app,{payload:recipients})).ok).toBe(true);
    expect(state.batch.state).toBe('review');expect(chromeMock.tabs.update).not.toHaveBeenCalled();
    expect((await call('START')).ok).toBe(false);expect(chromeMock.tabs.update).not.toHaveBeenCalled();
    await call('START',popup);expect(chromeMock.tabs.update).toHaveBeenCalledOnce();
  });
  it('rejects a mismatched recipient or document and grants click permission only once',async()=>{
    await start();const token=state.batch.items[0].token;
    expect((await call('WORK',{...wa(),url:'https://web.whatsapp.com/'})).ok).toBe(false);
    expect((await call('WORK',wa())).ok).toBe(true);
    expect((await call('PERMIT',{...wa(),documentId:'other'},{token})).ok).toBe(false);
    expect((await call('PERMIT',wa(),{token})).ok).toBe(true);
    expect((await call('PERMIT',wa(),{token})).ok).toBe(false);
  });
  it('pauses an ambiguous send and resumes only pending recipients',async()=>{
    await start();await call('WORK',wa());const token=state.batch.items[0].token;
    await call('PERMIT',wa(),{token});await call('RESULT',wa(),{token,result:'unknown',error:'لا يوجد تأكيد'});
    expect(state.batch.items[0].status).toBe('unknown');expect(state.batch.state).toBe('paused');
    await call('START',popup);expect(state.batch.items[0].status).toBe('unknown');expect(state.batch.items[1].status).toBe('loading');
    expect(chromeMock.tabs.update.mock.calls[1][1].url).toContain('218922345678');
  });
  it('revokes permission for an unclicked message on pause',async()=>{
    await start();await call('WORK',wa());const sender=wa(),token=state.batch.items[0].token;
    await call('PAUSE');expect((await call('PERMIT',sender,{token})).ok).toBe(false);
    expect(state.batch.items[0].status).toBe('pending');expect(state.batch.state).toBe('paused');
  });
  it('records an in-flight acknowledgement after cancellation without advancing',async()=>{
    await start();await call('WORK',wa());const sender=wa(),token=state.batch.items[0].token;
    await call('PERMIT',sender,{token});await call('CANCEL');
    expect((await call('PREPARE',app,{payload:recipients})).ok).toBe(false);
    await call('RESULT',sender,{token,result:'sent'});
    expect(state.batch.items[0].status).toBe('sent');expect(state.batch.items[1].status).toBe('cancelled');
    expect(state.batch.state).toBe('cancelled');expect(chromeMock.tabs.update).toHaveBeenCalledOnce();
  });
  it('times out without replaying an uncertain click',async()=>{
    await start();await call('WORK',wa());await call('PERMIT',wa(),{token:state.batch.items[0].token});
    state.batch.items[0].deadline=Date.now()-1;await alarm({name:'alfares-timeout'});
    expect(state.batch.items[0].status).toBe('unknown');expect(state.batch.state).toBe('paused');
    expect(chromeMock.tabs.update).toHaveBeenCalledOnce();
  });
});
