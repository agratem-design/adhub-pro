import { validateRecipients, publicBatch } from './queue.js';

// Serialise every state transition, including alarms and document callbacks.
let chain = Promise.resolve();
function serial(fn) { const job = chain.then(fn); chain = job.catch(() => {}); return job; }
const read = async () => (await chrome.storage.session.get('state')).state || { connection: null, batch: null };
const save = state => chrome.storage.session.set({ state });
const isPopup = sender => !sender.tab && sender.url === chrome.runtime.getURL('popup.html');
const current = batch => batch?.items.find(item => ['loading','clicking'].includes(item.status));

async function review() { await chrome.windows.create({ url: chrome.runtime.getURL('popup.html'), type: 'popup', width: 520, height: 720 }); }
async function next(state) {
  const batch = state.batch;
  if (!batch || batch.state !== 'running' || current(batch)) return;
  const item = batch.items.find(item => item.status === 'pending');
  if (!item) { batch.state = 'complete'; await save(state); return; }
  item.status = 'loading'; item.token = crypto.randomUUID(); item.deadline = Date.now() + 90000;
  await save(state);
  try {
    await chrome.alarms.create('alfares-timeout', { when: item.deadline });
    await chrome.tabs.update(batch.tabId, { url: `https://web.whatsapp.com/send?phone=${item.phone}&text=${encodeURIComponent(item.message)}` });
  } catch { item.status = 'error'; item.error = 'تبويب واتساب غير متاح. افتحه ثم استأنف من الإضافة.'; batch.state = 'paused'; await save(state); }
}

async function handle(message, sender) {
  if (message?.channel !== 'alfares') return {ok:false};
  const state = await read(), popup = isPopup(sender), action = message.action;
  if (action === 'CONNECT' && popup) {
    if (current(state.batch) || state.batch && ['running','paused','review'].includes(state.batch.state)) throw new Error('أنه الدفعة الحالية أو ألغها قبل تغيير الربط.');
    const tab = await chrome.tabs.get(message.tabId);
    const url = new URL(tab.url || '');
    if (!['http:','https:'].includes(url.protocol) || url.hostname === 'web.whatsapp.com') throw new Error('افتح صفحة نظام الفارس ثم اضغط ربط الصفحة.');
    await chrome.scripting.executeScript({ target: {tabId:tab.id}, files:['bridge.js'] });
    state.connection = {tabId:tab.id, origin:url.origin}; await save(state);
    return {ok:true};
  }
  if (['WORK','PERMIT','RESULT'].includes(action)) {
    const batch = state.batch, item = current(batch);
    if (!batch || !item || sender.tab?.id !== batch.tabId || sender.frameId !== 0) return {ok:false};
    const url = new URL(sender.url || 'https://invalid');
    if (url.origin !== 'https://web.whatsapp.com' || url.pathname !== '/send' || url.searchParams.get('phone') !== item.phone || url.searchParams.get('text') !== item.message) return {ok:false};
    if (action === 'WORK') {
      if (batch.state !== 'running' || item.status !== 'loading') return {ok:false};
      if (item.documentId && item.documentId !== sender.documentId) return {ok:false};
      item.documentId = sender.documentId; await save(state);
      return {ok:true, item:{token:item.token,message:item.message,phone:item.phone}};
    }
    if (item.token !== message.token || item.documentId !== sender.documentId) return {ok:false};
    if (action === 'PERMIT') {
      if (batch.state !== 'running' || item.status !== 'loading') return {ok:false};
      item.status = 'clicking'; await save(state); return {ok:true};
    }
    // A message is only marked sent when WhatsApp shows a server acknowledgement.
    if (message.result === 'sent' && item.status === 'clicking') item.status = 'sent';
    else { item.status = item.status === 'clicking' ? 'unknown' : 'error'; item.error = String(message.error || 'تعذر التحقق من الرسالة.').slice(0,250); if (batch.state !== 'cancelled') batch.state = 'paused'; }
    await save(state); await chrome.alarms.clear('alfares-timeout');
    if (batch.state === 'running') await chrome.alarms.create('alfares-next', {when:Date.now()+15000});
    return {ok:true};
  }
  const trusted = state.connection && sender.tab?.id === state.connection.tabId && sender.frameId === 0 && new URL(sender.url || 'https://invalid').origin === state.connection.origin;
  if (!popup && !trusted) throw new Error('اربط تبويب النظام من أيقونة الإضافة أولًا.');
  if (action === 'STATUS') return {ok:true, connected:!!state.connection, origin:state.connection?.origin, batch:popup?state.batch:publicBatch(state.batch)};
  if (action === 'PREPARE' && trusted) {
    if (current(state.batch) || state.batch && ['running','paused','review'].includes(state.batch.state)) throw new Error('أكمل الدفعة الحالية أو ألغها أولًا.');
    const items = validateRecipients(message.payload);
    state.batch = {id:crypto.randomUUID(),state:'review',items}; await save(state); await review();
    return {ok:true,batch:publicBatch(state.batch)};
  }
  if (action === 'REVIEW') { await review(); return {ok:true}; }
  if (action === 'START' && popup) {
    if (!state.batch || !['review','paused'].includes(state.batch.state)) throw new Error('لا توجد دفعة جاهزة.');
    if (current(state.batch)) throw new Error('انتظر انتهاء التحقق من الرسالة الحالية.');
    const tabs = await chrome.tabs.query({url:'https://web.whatsapp.com/*'});
    if (!tabs.length) throw new Error('افتح واتساب ويب وسجّل الدخول في هذا المتصفح أولًا.');
    if (tabs.length > 1 && !tabs.some(tab=>tab.id===Number(message.tabId))) throw new Error('اختر تبويب واتساب الذي تريد استخدامه.');
    state.batch.tabId = tabs.find(tab=>tab.id===Number(message.tabId))?.id ?? tabs[0].id;
    state.batch.state = 'running'; await save(state); await next(state); return {ok:true};
  }
  if (action === 'TABS' && popup) return {ok:true,tabs:(await chrome.tabs.query({url:'https://web.whatsapp.com/*'})).map(tab=>({id:tab.id,title:tab.title||'WhatsApp'}))};
  if (['PAUSE','CANCEL'].includes(action) && state.batch) {
    const item = current(state.batch);
    state.batch.state = action === 'CANCEL' ? 'cancelled' : 'paused';
    if (item?.status === 'loading') { item.status = action === 'CANCEL' ? 'cancelled':'pending'; delete item.documentId; }
    if (action === 'CANCEL') state.batch.items.forEach(row=>{if(row.status==='pending')row.status='cancelled';});
    await save(state); await chrome.alarms.clear('alfares-next');
    // In-flight clicks may finish; the result still updates, without advancing the queue.
    return {ok:true};
  }
  if (action === 'CLEAR' && popup && !current(state.batch) && !['running','review'].includes(state.batch?.state)) {state.batch=null; await save(state); return {ok:true};}
  throw new Error('إجراء غير متاح.');
}

chrome.runtime.onMessage.addListener((message,sender,reply) => {
  if(message?.channel!=='alfares') return;
  serial(()=>handle(message,sender)).then(reply,error=>reply({ok:false,error:error.message})); return true;
});
chrome.alarms.onAlarm.addListener(alarm=>serial(async()=>{
  const state=await read();
  if(alarm.name==='alfares-next') return next(state);
  if(alarm.name==='alfares-timeout') {
    const item=current(state.batch);
    if(item && Date.now()>=item.deadline) { item.status=item.status==='clicking'?'unknown':'error'; item.error='انتهت مهلة التحقق. راجع المحادثة قبل إعادة الإرسال.'; if(state.batch.state!=='cancelled')state.batch.state='paused'; await save(state); }
  }
}));
