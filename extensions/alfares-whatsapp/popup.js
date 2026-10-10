const $=id=>document.getElementById(id);
const labels={pending:'بانتظار الإرسال',loading:'تجهيز المحادثة',clicking:'جارٍ التحقق',sent:'أُرسلت',error:'تعذر الإرسال',unknown:'غير مؤكدة — راجع المحادثة',cancelled:'أُلغيت',review:'مراجعة الدفعة',running:'الإرسال جارٍ',paused:'متوقفة مؤقتًا',complete:'اكتملت الدفعة'};
const request=async(action,extra={})=>{const result=await chrome.runtime.sendMessage({channel:'alfares',action,...extra});if(!result?.ok)throw new Error(result?.error||'تعذر الاتصال');return result;};
let lastRender='';
async function refresh(){
  const result=await request('STATUS');$('connection').textContent=result.origin?`الصفحة المرتبطة: ${result.origin}`:'لا توجد صفحة مرتبطة.';
  const batch=result.batch;$('batch').hidden=!batch;if(!batch)return;
  $('summary').textContent=`${labels[batch.state]||batch.state} · ${batch.items.filter(i=>i.status==='sent').length} / ${batch.items.length}`;
  const active=batch.items.some(i=>['loading','clicking'].includes(i.status));
  $('start').disabled=!['review','paused'].includes(batch.state)||active;
  $('start').textContent=batch.state==='paused'?'استئناف الرسائل المنتظرة فقط':'بدء الإرسال للمستلمين المعروضين';
  $('pause').disabled=batch.state!=='running';$('cancel').disabled=!['review','running','paused'].includes(batch.state);$('clear').disabled=['running','review'].includes(batch.state)||active;
  const fingerprint=JSON.stringify(batch.items);
  if(fingerprint!==lastRender){lastRender=fingerprint;$('recipients').replaceChildren();for(const row of batch.items){
    const card=document.createElement('article'),name=document.createElement('strong'),phone=document.createElement('p'),status=document.createElement('p'),details=document.createElement('details'),summary=document.createElement('summary'),message=document.createElement('pre');
    name.textContent=row.name;phone.className='phone';phone.textContent=row.phone;status.textContent=[labels[row.status],row.error].filter(Boolean).join(' — ');summary.textContent='معاينة الرسالة';message.textContent=row.message;details.append(summary,message);card.append(name,phone,status,details);$('recipients').append(card);
  }}
}
async function perform(action,extra){try{$('error').textContent='';await request(action,extra);await refresh();}catch(error){$('error').textContent=error.message;}}
$('connect').onclick=async()=>{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});await perform('CONNECT',{tabId:tab?.id});};
$('start').onclick=()=>perform('START',{tabId:Number($('tabs').value)});
$('pause').onclick=()=>perform('PAUSE');$('cancel').onclick=()=>perform('CANCEL');$('clear').onclick=()=>perform('CLEAR');
request('TABS').then(({tabs})=>{for(const tab of tabs){const option=document.createElement('option');option.value=tab.id;option.textContent=`${tab.title} — ${tab.id}`;$('tabs').append(option);}}).catch(error=>{$('error').textContent=error.message;});
refresh().catch(error=>{$('error').textContent=error.message;});setInterval(()=>refresh().catch(()=>{}),1500);
