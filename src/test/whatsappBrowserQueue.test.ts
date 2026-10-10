import { describe, expect, it } from 'vitest';
import { normalizePhone, validateRecipients, publicBatch } from '../../extensions/alfares-whatsapp/queue.js';

describe('browser WhatsApp queue validation',()=>{
  it('normalizes Libyan and international numbers without corrupting country codes',()=>{
    expect(normalizePhone('٠٩١ ٢٣٤ ٥٦٧٨')).toBe('218912345678');
    expect(normalizePhone('+44 7700 900123')).toBe('447700900123');
    expect(normalizePhone('00218-91-2345678')).toBe('218912345678');
    expect(normalizePhone('abc123')).toBe('');expect(normalizePhone('123')).toBe('');
  });
  it('rejects duplicate recipients after phone normalization',()=>{
    expect(()=>validateRecipients([{name:'أ',phone:'0912345678',message:'أ'},{name:'ب',phone:'+218912345678',message:'ب'}])).toThrow(/مكرر/);
  });
  it('rejects empty and oversized batches and invalid messages',()=>{
    expect(()=>validateRecipients([])).toThrow();expect(()=>validateRecipients(new Array(201).fill({}))).toThrow();
    expect(()=>validateRecipients([{phone:'0912345678',message:' '}])).toThrow();
    expect(()=>validateRecipients([{phone:'0912345678',message:'a'.repeat(4001)}])).toThrow();
  });
  it('takes an immutable snapshot with pending status regardless of provided state',()=>{
    const source={phone:'0912345678',name:'أ',message:' النص ',status:'sent'};
    const [item]=validateRecipients([source]);source.message='تغير';expect(item.message).toBe('النص');expect(item.status).toBe('pending');
  });
  it('does not expose message bodies or phone numbers to status polling',()=>{
    const batch=publicBatch({id:'x',state:'running',items:[{id:'1',name:'أ',phone:'secret',message:'private',token:'secret-token',status:'pending'}]});
    expect(batch.items[0]).not.toHaveProperty('phone');expect(batch.items[0]).not.toHaveProperty('message');expect(batch.items[0]).not.toHaveProperty('token');
  });
});
