(() => {
  const send = payload => chrome.runtime.sendMessage({channel:'alfares',...payload});
  const clean = value => value.replace(/\r\n/g,'\n').replace(/[\u200e\u200f\u202a-\u202e]/g,'').trim();
  const visible = element => element && element.getClientRects().length > 0;
  const delay = () => new Promise(resolve=>setTimeout(resolve,750));
  async function run() {
    const work = await send({action:'WORK'});
    if(!work?.ok) return;
    const item=work.item;
    let clicked=false;
    try {
      const deadline=Date.now()+70000;
      while(Date.now()<deadline) {
        const footer=document.querySelector('#main footer');
        const composer=footer?.querySelector('[contenteditable="true"][role="textbox"]');
        const button=footer?.querySelector('[data-icon="send"]')?.closest('button,[role="button"]');
        if(visible(composer)&&visible(button)&&clean(composer.innerText)===clean(item.message)&&!button.disabled&&button.getAttribute('aria-disabled')!=='true') {
          const header=document.querySelector('#main header');
          if(!visible(header)) {await delay();continue;}
          const chatLabel=header.innerText;
          // Snapshot existing matching messages so an old identical message cannot count as success.
          const existing=new Set(Array.from(document.querySelectorAll('#main .message-out')).map(el=>el.closest('[data-id]')?.getAttribute('data-id')).filter(Boolean));
          const permission=await send({action:'PERMIT',token:item.token});
          if(!permission?.ok) return;
          if(!composer.isConnected||!button.isConnected||!header.isConnected||header.innerText!==chatLabel||clean(composer.innerText)!==clean(item.message)) throw new Error('تغيرت المحادثة قبل الإرسال.');
          clicked=true; button.click();
          const ackDeadline=Date.now()+15000;
          while(Date.now()<ackDeadline) {
            const acknowledged=Array.from(document.querySelectorAll('#main .message-out')).some(el=>{
              const id=el.closest('[data-id]')?.getAttribute('data-id');
              const text=el.querySelector('.selectable-text');
              return id && !existing.has(id) && text && clean(text.innerText)===clean(item.message) && el.querySelector('[data-icon="msg-check"],[data-icon="msg-dblcheck"],[data-icon="msg-dblcheck-ack"]');
            });
            if(acknowledged) {await send({action:'RESULT',token:item.token,result:'sent'});return;}
            await delay();
          }
          throw new Error('تم الضغط على إرسال، لكن لم يظهر تأكيد واتساب. راجع المحادثة؛ لن تتكرر الرسالة تلقائيًا.');
        }
        await delay();
      }
      throw new Error('تعذر تجهيز المحادثة. تحقق من تسجيل الدخول والرقم وواجهة واتساب.');
    } catch(error) { await send({action:'RESULT',token:item.token,result:clicked?'unknown':'error',error:error.message}); }
  }
  run().catch(()=>{});
})();
