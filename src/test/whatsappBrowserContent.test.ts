import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import script from '../../extensions/alfares-whatsapp/whatsapp.js?raw';

describe('WhatsApp page adapter',()=>{
  let requests:any[],button:HTMLButtonElement;
  const work={ok:true,item:{token:'unique',phone:'218912345678',message:'رسالة تجريبية'}};
  beforeEach(()=>{
    vi.useFakeTimers();requests=[];
    document.body.innerHTML='<div id="main"><header>المستلم</header><div id="messages"></div><footer><div contenteditable="true" role="textbox"></div><button><span data-icon="send"></span></button></footer></div>';
    document.querySelector<HTMLElement>('[contenteditable]')!.innerText=work.item.message;
    button=document.querySelector('button')!;
    vi.spyOn(HTMLElement.prototype,'getClientRects').mockReturnValue([{}] as any);
  });
  afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();document.body.innerHTML='';});
  function run(permit=true){new Function('chrome',script)({runtime:{sendMessage:async(message:any)=>{requests.push(message);return message.action==='WORK'?work:{ok:permit};}}});}
  it('clicks once and only reports sent after a new outgoing message is acknowledged',async()=>{
    const click=vi.fn(()=>{const msg=document.createElement('div');msg.dataset.id='new';msg.innerHTML='<div class="message-out"><span class="selectable-text"></span><span data-icon="msg-check"></span></div>';msg.querySelector<HTMLElement>('.selectable-text')!.innerText=work.item.message;document.querySelector('#messages')!.append(msg);});
    button.addEventListener('click',click);run();await vi.advanceTimersByTimeAsync(1000);
    expect(click).toHaveBeenCalledOnce();expect(requests.at(-1)).toMatchObject({action:'RESULT',result:'sent'});
  });
  it('does not click when the queue revoked permission',async()=>{
    const click=vi.fn();button.addEventListener('click',click);run(false);await vi.advanceTimersByTimeAsync(1000);
    expect(click).not.toHaveBeenCalled();expect(requests.some(r=>r.action==='RESULT')).toBe(false);
  });
  it('refuses a different draft instead of overwriting or sending it',async()=>{
    document.querySelector<HTMLElement>('[contenteditable]')!.innerText='مسودة مختلفة';const click=vi.fn();button.addEventListener('click',click);run();await vi.advanceTimersByTimeAsync(71000);
    expect(click).not.toHaveBeenCalled();expect(requests.at(-1)).toMatchObject({action:'RESULT',result:'error'});
  });
  it('does not count an old identical message as acknowledgement',async()=>{
    document.querySelector('#messages')!.innerHTML='<div data-id="old"><div class="message-out"><span class="selectable-text"></span><span data-icon="msg-check"></span></div></div>';
    document.querySelector<HTMLElement>('.selectable-text')!.innerText=work.item.message;
    const click=vi.fn();button.addEventListener('click',click);run();await vi.advanceTimersByTimeAsync(16000);
    expect(click).toHaveBeenCalledOnce();expect(requests.at(-1)).toMatchObject({action:'RESULT',result:'unknown'});
  });
});
