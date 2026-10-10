import { useEffect, useMemo, useState } from 'react';
import { Download, Link2, MessageSquare, Pause, Search, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { whatsappBrowserRequest, type BrowserBatch, type BrowserRecipient } from '@/lib/whatsappBrowser';
import { normalizePhone } from '../../../extensions/alfares-whatsapp/queue.js';

const labels: Record<string,string> = {pending:'بانتظار الإرسال',loading:'تجهيز المحادثة',clicking:'جارٍ التحقق',sent:'أُرسلت',error:'تعذر الإرسال',unknown:'غير مؤكدة — راجع واتساب',cancelled:'أُلغيت',review:'بانتظار بدء الإرسال من الإضافة',running:'الإرسال جارٍ',paused:'متوقفة مؤقتًا',complete:'اكتملت الدفعة'};

export function BrowserWhatsAppBatch({recipients}: {recipients: BrowserRecipient[]}) {
  const [selected,setSelected]=useState<Set<string>>(new Set());
  const [search,setSearch]=useState('');
  const [edits,setEdits]=useState<Record<string,string>>({});
  const [preview,setPreview]=useState<string|null>(null);
  const [batch,setBatch]=useState<BrowserBatch|null>(null);
  const [connected,setConnected]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const rows=useMemo(()=>recipients.map(row=>({...row,phone:normalizePhone(row.phone)})),[recipients]);
  const visible=rows.filter(row=>`${row.name} ${row.phone}`.includes(search.trim()));
  const eligible=visible.filter(row=>row.phone);
  const chosen=rows.filter(row=>selected.has(row.id)&&row.phone);
  const active=!!batch&&['review','running','paused'].includes(batch.state);
  const allVisible=eligible.length>0&&eligible.every(row=>selected.has(row.id));
  const selectedPreview=rows.find(row=>row.id===preview);
  const duplicate=chosen.some((row,index)=>chosen.findIndex(other=>other.phone===row.phone)!==index);
  async function request(action:Parameters<typeof whatsappBrowserRequest>[0],payload?:BrowserRecipient[]) {
    setBusy(true);setError('');
    try {const result=await whatsappBrowserRequest(action,payload);setConnected(true);if('batch'in result)setBatch(result.batch||null);}
    catch(err){setError(err instanceof Error?err.message:'تعذر الاتصال');if(action==='STATUS')setConnected(false);}
    finally{setBusy(false);}
  }
  useEffect(()=>{
    if(!connected)return;
    let disposed=false;
    const timer=window.setInterval(()=>{whatsappBrowserRequest('STATUS').then(result=>{if(!disposed){setBatch(result.batch||null);setError('');}}).catch(err=>{if(!disposed){setConnected(false);setError(err.message);}});},2500);
    return()=>{disposed=true;window.clearInterval(timer);};
  },[connected]);
  function toggleVisible(){setSelected(old=>{const next=new Set(old);eligible.forEach(row=>{if(allVisible)next.delete(row.id);else next.add(row.id);});return next;});}
  return <section dir="rtl" className="space-y-4 text-right">
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
      <h3 className="font-bold">الإرسال من واتساب المفتوح</h3>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">حدد المستلمين، راجع الرسائل، ثم ابدأ الدفعة من الإضافة. تستمر المتابعة هنا ويمكنك إيقاف المتبقي.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild><a href="/downloads/alfares-whatsapp.zip" download><Download className="h-4 w-4"/>تحميل الإضافة</a></Button>
        <Button variant="outline" size="sm" onClick={()=>request('STATUS')} disabled={busy}><Link2 className="h-4 w-4"/>{connected?'تحديث الاتصال':'فحص الاتصال'}</Button>
        {connected&&<span className="self-center text-xs text-primary">الإضافة متصلة</span>}
      </div>
      <details className="mt-3 text-xs leading-6 text-muted-foreground"><summary className="cursor-pointer">تركيب الإضافة لأول مرة</summary><ol className="list-inside list-decimal"><li>فك ضغط الملف، وافتح إدارة الإضافات في Chrome أو Edge.</li><li>فعّل وضع المطوّر واختر «تحميل إضافة غير مضغوطة»، ثم اختر مجلد الإضافة.</li><li>افتح واتساب ويب وسجّل الدخول. ارجع إلى النظام وافتح أيقونة الإضافة ثم «ربط صفحة النظام المفتوحة».</li><li>اضغط «فحص الاتصال» هنا. أعد الربط عند تحديث صفحة النظام.</li></ol></details>
    </div>
    {error&&<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    {batch&&<div className="space-y-3 rounded-xl border p-4" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{labels[batch.state]||batch.state}</h3><span className="text-sm">أُرسلت {batch.items.filter(row=>row.status==='sent').length} من {batch.items.length}</span></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={()=>request('REVIEW')} disabled={busy}>فتح الإضافة والمراجعة</Button><Button variant="outline" size="sm" onClick={()=>request('PAUSE')} disabled={busy||batch.state!=='running'}><Pause className="h-4 w-4"/>إيقاف مؤقت</Button><Button variant="outline" size="sm" onClick={()=>request('CANCEL')} disabled={busy||!active}><X className="h-4 w-4"/>إلغاء المتبقي</Button></div>
      <p className="text-xs text-muted-foreground">قد تكتمل الرسالة الجارية عند الإيقاف. أُرسلت تعني تأكيد واتساب للإرسال، ولا تعني القراءة.</p>
      <div className="max-h-48 space-y-2 overflow-y-auto">{batch.items.map(row=><div key={row.id} className="rounded-lg bg-muted/40 p-2 text-xs"><div className="flex justify-between gap-2"><span>{row.name}</span><span>{labels[row.status]||row.status}</span></div>{row.error&&<p className="mt-1 text-destructive">{row.error}</p>}</div>)}</div>
    </div>}
    <div className="flex flex-wrap items-center gap-2"><div className="relative min-w-0 flex-1"><Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground"/><Input aria-label="بحث المستلمين" placeholder="ابحث بالاسم أو الرقم..." value={search} onChange={event=>setSearch(event.target.value)} className="pr-9"/></div><Button variant="outline" onClick={toggleVisible} disabled={active||!eligible.length}>{allVisible?'إلغاء تحديد النتائج':'تحديد كل النتائج'}</Button><Button variant="ghost" onClick={()=>setSelected(new Set())} disabled={active||!selected.size}>إلغاء التحديد</Button></div>
    <p className="text-xs text-muted-foreground">{chosen.length} محدد · {rows.filter(row=>!row.phone).length} بدون رقم صالح · الحد الأقصى 200 مستلم. تحديد النتائج يشمل نتائج البحث الحالية.</p>
    <div className="grid gap-3 md:grid-cols-2">
      <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border p-2">{visible.map(row=><div key={row.id} className={`flex items-center gap-3 rounded-lg border p-3 ${selected.has(row.id)?'border-primary/40 bg-primary/5':'border-transparent bg-muted/30'}`}>
        <input type="checkbox" aria-label={`تحديد ${row.name}`} className="h-4 w-4 cursor-pointer accent-primary" checked={selected.has(row.id)} disabled={active||!row.phone} onChange={()=>setSelected(old=>{const next=new Set(old);next.has(row.id)?next.delete(row.id):next.add(row.id);return next;})}/>
        <button type="button" className="min-w-0 flex-1 cursor-pointer text-right transition-colors hover:text-primary" onClick={()=>setPreview(row.id)}><span className="block font-semibold">{row.name}</span><span className="block text-xs text-muted-foreground" dir="ltr">{row.phone||'بدون رقم صالح'}</span></button><Button variant="ghost" size="sm" aria-label={`معاينة رسالة ${row.name}`} onClick={()=>setPreview(row.id)}>معاينة</Button>
      </div>)}{!visible.length&&<p className="p-4 text-sm text-muted-foreground">لا توجد نتائج.</p>}</div>
      <div className="rounded-xl border p-3">{selectedPreview?<><label className="mb-2 block text-sm font-semibold" htmlFor="batch-message">رسالة {selectedPreview.name}</label><Textarea id="batch-message" value={edits[selectedPreview.id]??selectedPreview.message} disabled={active} maxLength={4000} onChange={event=>setEdits(old=>({...old,[selectedPreview.id]:event.target.value}))} className="min-h-64 leading-7"/><Button variant="ghost" size="sm" disabled={active} onClick={()=>setEdits(old=>{const next={...old};delete next[selectedPreview.id];return next;})}>استعادة الرسالة الأصلية</Button></>:<p className="p-6 text-center text-sm text-muted-foreground">اختر «معاينة» لقراءة رسالة المستلم وتعديلها قبل الإرسال.</p>}</div>
    </div>
    {duplicate&&<p role="alert" className="text-sm text-destructive">رقم مشترك: {chosen.filter((row)=>chosen.some(other=>other.id!==row.id&&other.phone===row.phone)).map(row=>row.name).join('، ')}. اختر مستلمًا واحدًا لكل رقم.</p>}
    <Button onClick={()=>request('PREPARE',chosen.map(row=>({...row,message:edits[row.id]??row.message})))} disabled={!connected||busy||active||!chosen.length||chosen.length>200||duplicate||chosen.some(row=>!(edits[row.id]??row.message).trim())}><Send className="h-4 w-4"/>مراجعة وبدء دفعة ({chosen.length})</Button>
  </section>;
}

export function BrowserWhatsAppBatchDialog({recipients}:{recipients:BrowserRecipient[]}) {
  return <Dialog><DialogTrigger asChild><Button><MessageSquare className="h-4 w-4"/>إرسال جماعي عبر المتصفح</Button></DialogTrigger><DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>إرسال جماعي عبر واتساب</DialogTitle></DialogHeader><BrowserWhatsAppBatch recipients={recipients}/></DialogContent></Dialog>;
}
