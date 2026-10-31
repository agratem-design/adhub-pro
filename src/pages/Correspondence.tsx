import { usePersistedState } from '@/hooks/usePersistedState';
import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { AlertTriangle, ArrowLeft, ArrowRight, Archive, Building2, CalendarDays, Copy, FileText, FilePlus2, Loader2, Mail, Pencil, Printer, Save, Search, Trash2, Upload, X } from 'lucide-react';
import { preparePrintWindow, writePrintWindow } from '@/utils/printWindowHelper';
import { LetterPreview, MODE_HINT, PrintMenu } from '@/components/correspondence/LetterParts';
import {
  LETTER_FONTS, NUMBER_FONTS, PRINT_MODE_LABELS, deleteLetter, loadCompanies, loadLetters, nextReference, renderLetterHtml, saveCompany, saveLetter,
  type Letter, type LetterheadCompany, type LetterPrintMode,
} from '@/services/correspondence';

const today = () => new Date().toISOString().slice(0, 10);
const emptyLetter = (c?: LetterheadCompany | null, letters: Letter[] = []): Letter => ({
  company_id: c?.id || '', reference_number: c ? nextReference(c.reference_prefix, letters.filter(l => l.company_id === c.id)) : '',
  letter_date: today(), recipient: '', greeting: 'تحية طيبة، وبعد،', subject: '', body: '',
  closing: 'وتفضلوا بقبول فائق الاحترام والتقدير.', signer_name: c?.signer_name || '', signer_title: c?.signer_title || '',
  with_stamp: true, with_signature: true,
});

function CompanyLogo({ company, compact = false }: { company: LetterheadCompany; compact?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showLogo = company.logo_url && failedUrl !== company.logo_url;
  return (
    <span className={cn('flex shrink-0 items-center justify-center overflow-hidden', compact ? 'h-12 w-12 rounded-xl border border-border/60 bg-white p-1.5' : 'h-36 w-full bg-white p-7 sm:h-44 sm:p-9')}>
      {showLogo ? <img src={company.logo_url!} alt={`شعار ${company.name}`} className="h-full w-full object-contain motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105" onError={() => setFailedUrl(company.logo_url!)} />
        : <Building2 aria-hidden="true" className={cn('text-amber-700', compact ? 'h-6 w-6' : 'h-14 w-14')} />}
    </span>
  );
}

/** صورة قابلة للرفع (شعار / ختم / توقيع) */
function ImageSlot({ label, url, hint, onChange, folder, name }: { label: string; url?: string | null; hint: string; onChange: (u: string | null) => void; folder: string; name: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try {
      const { uploadImageWithFallback } = await import('@/services/imageUploadService');
      onChange(await uploadImageWithFallback(f, name, folder));
      toast.success(`تم رفع ${label}`);
    } catch (e: any) { toast.error(e.message || `فشل رفع ${label}`); } finally { setBusy(false); if (ref.current) ref.current.value = ''; }
  };
  return (
    <div className="space-y-1.5">
      <div className="text-sm">{label}</div>
      <div className="flex h-20 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-[repeating-conic-gradient(#f3f3f3_0_25%,#fff_0_50%)] bg-[length:16px_16px]">
        {url ? <img src={url} alt={label} className="max-h-full max-w-full object-contain" /> : <span className="px-2 text-center text-xs text-muted-foreground">{hint}</span>}
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={e => upload(e.target.files?.[0])} />
      <div className="flex gap-1">
        <Button type="button" variant="outline" size="sm" className="h-8 flex-1" disabled={busy} onClick={() => ref.current?.click()}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}رفع</Button>
        {url && <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => onChange(null)}><X className="h-3.5 w-3.5" /></Button>}
      </div>
    </div>
  );
}

function CompanyEditor({ company, onSaved, onCancel }: { company: Partial<LetterheadCompany>; onSaved: (c: LetterheadCompany) => void; onCancel: () => void }) {
  const [c, setC] = useState<Partial<LetterheadCompany>>({ addresses: [], phones: [], brand_color: '#D4A72C', font_family: 'Tajawal', reference_prefix: '', show_watermark: true, ...company });
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<LetterheadCompany>) => setC(p => ({ ...p, ...patch }));
  const slug = (c.name || 'company').replace(/\s+/g, '-');
  const save = async () => {
    if (!c.name?.trim()) { toast.error('اسم الشركة مطلوب'); return; }
    setBusy(true);
    try { const saved = await saveCompany({ ...c, addresses: (c.addresses || []).filter(Boolean), phones: (c.phones || []).filter(Boolean) }); if (saved._warning) toast.warning(saved._warning, { duration: 9000 }); else toast.success('تم حفظ بيانات الشركة'); onSaved(saved); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const lines = (v: string[] | undefined) => (v || []).join('\n');
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">اسم الشركة<Input value={c.name || ''} onChange={e => set({ name: e.target.value })} /></label>
        <label className="space-y-1 text-sm">الاسم بالإنجليزية<Input dir="ltr" value={c.name_en || ''} onChange={e => set({ name_en: e.target.value })} /></label>
        <label className="space-y-1 text-sm">رقم السجل التجاري<Input dir="ltr" value={c.commercial_register || ''} onChange={e => set({ commercial_register: e.target.value })} /></label>
        <label className="space-y-1 text-sm">بادئة الرقم الإشاري (مثل F)<Input dir="ltr" value={c.reference_prefix || ''} onChange={e => set({ reference_prefix: e.target.value })} /></label>
        <label className="space-y-1 text-sm">العناوين (سطر لكل عنوان)<Textarea rows={2} value={lines(c.addresses)} onChange={e => set({ addresses: e.target.value.split('\n') })} /></label>
        <label className="space-y-1 text-sm">الهواتف (سطر لكل رقم)<Textarea dir="ltr" rows={2} value={lines(c.phones)} onChange={e => set({ phones: e.target.value.split('\n') })} /></label>
        <label className="space-y-1 text-sm">البريد الإلكتروني<Input dir="ltr" value={c.email || ''} onChange={e => set({ email: e.target.value })} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-sm">اللون الرسمي
            <div className="flex gap-2"><input type="color" value={c.brand_color || '#D4A72C'} onChange={e => set({ brand_color: e.target.value })} className="h-10 w-12 cursor-pointer rounded border border-border bg-transparent" /><Input dir="ltr" value={c.brand_color || ''} onChange={e => set({ brand_color: e.target.value })} /></div>
          </label>
          <label className="space-y-1 text-sm">خط الكتابة
            <Select value={c.font_family || 'Tajawal'} onValueChange={v => set({ font_family: v })}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>{LETTER_FONTS.map(f => <SelectItem key={f} value={f}><span style={{ fontFamily: f }}>{f}</span></SelectItem>)}</SelectContent>
            </Select>
          </label>
        </div>
        <label className="space-y-1 text-sm">خط الأرقام
          <Select value={c.number_font || '__same'} onValueChange={v => set({ number_font: v === '__same' ? null : v })}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__same">نفس خط الكتابة</SelectItem>
              {[...new Set([...NUMBER_FONTS, ...LETTER_FONTS])].map(f => <SelectItem key={f} value={f}><span style={{ fontFamily: f }}>{f} — 14/10/2025</span></SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <div className="hidden sm:block" />
        <label className="space-y-1 text-sm">اسم الموقِّع<Input value={c.signer_name || ''} onChange={e => set({ signer_name: e.target.value })} /></label>
        <label className="space-y-1 text-sm">صفة الموقِّع<Input value={c.signer_title || ''} onChange={e => set({ signer_title: e.target.value })} /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ImageSlot label="الشعار" url={c.logo_url} hint="بدون رفع: شعار القالب الرسمي" folder="letterheads" name={`letterhead-${slug}`} onChange={u => set({ logo_url: u })} />
        <div className="space-y-1.5">
          <ImageSlot label="شعار الخلفية (العلامة المائية)" url={c.watermark_url} hint="بدون رفع: الشعار أعلاه أو رسمة القالب" folder="letterheads" name={`watermark-${slug}`} onChange={u => set({ watermark_url: u })} />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">الشفافية
            <input type="range" min={2} max={30} step={1} value={Math.round((Number(c.watermark_opacity) || 0.06) * 100)} onChange={e => set({ watermark_opacity: Number(e.target.value) / 100 })} className="flex-1 accent-primary" />
            <span className="w-8 tabular-nums">{Math.round((Number(c.watermark_opacity) || 0.06) * 100)}%</span>
          </label>
        </div>
        <ImageSlot label="الختم (PNG شفاف)" url={c.stamp_url} hint="يظهر فوق مكان التوقيع لتكون الورقة مختومة" folder="letterheads" name={`stamp-${slug}`} onChange={u => set({ stamp_url: u })} />
        <ImageSlot label="صورة التوقيع (PNG شفاف)" url={c.signature_url} hint="اختياري: توقيع المدير فوق الخط" folder="letterheads" name={`signature-${slug}`} onChange={u => set({ signature_url: u })} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm"><Switch checked={c.show_watermark !== false} onCheckedChange={v => set({ show_watermark: v })} />إظهار شعار الخلفية</label>
        <label className="flex items-center gap-2 text-sm"><Switch checked={!!c.is_default} onCheckedChange={v => set({ is_default: v })} />الشركة الافتراضية</label>
        <div className="ms-auto flex gap-2">
          <Button variant="outline" onClick={onCancel}>إلغاء</Button>
          <Button onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}حفظ</Button>
        </div>
      </div>
    </div>
  );
}

export default function Correspondence() {
  const qc = useQueryClient();
  const { confirm } = useSystemDialog();
  const companiesQ = useQuery({ queryKey: ['letterhead-companies'], queryFn: loadCompanies });
  const lettersQ = useQuery({ queryKey: ['letters'], queryFn: () => loadLetters(), enabled: companiesQ.isSuccess });
  const companies = companiesQ.data || [];
  const allLetters = lettersQ.data || [];
  // التقارير الدورية لها صفحتها الخاصة
  const letters = useMemo(() => allLetters.filter(l => (l.kind || 'letter') !== 'report'), [allLetters]);
  const [companyId, setCompanyId] = useState<string>('');
  const [draft, setDraft] = useState<Letter | null>(null);
  const [editingCompany, setEditingCompany] = useState<Partial<LetterheadCompany> | null>(null);
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = usePersistedState<LetterPrintMode>('correspondence.mode', 'full');
  const [yearOnlyDate, setYearOnlyDate] = usePersistedState<boolean>('correspondence.yearOnlyDate', false);
  const [fit, setFit] = useState<{ scale: number; overflow: boolean }>({ scale: 1, overflow: false });

  const company = companies.find(c => c.id === (draft?.company_id || companyId)) || null;
  const list = useMemo(() => {
    const s = q.trim();
    return letters.filter(l => (!companyId || l.company_id === companyId) && (!s || [l.reference_number, l.recipient, l.subject, l.body].some(v => String(v || '').includes(s))));
  }, [letters, companyId, q]);

  const companyLetters = letters.filter(l => !companyId || l.company_id === companyId);
  const monthLetters = companyLetters.filter(l => l.letter_date?.slice(0, 7) === today().slice(0, 7));

  const html = useMemo(() => (company && draft ? renderLetterHtml(company, draft, window.location.origin, { mode, yearOnlyDate }) : ''), [company, draft, mode, yearOnlyDate]);
  const set = (patch: Partial<Letter>) => setDraft(d => (d ? { ...d, ...patch } : d));

  const print = (l: Letter, m: LetterPrintMode = 'full') => {
    const c = companies.find(x => x.id === l.company_id);
    if (!c) return;
    const suffix = m === 'full' ? '' : ` (${PRINT_MODE_LABELS[m]})`;
    const w = preparePrintWindow(`مراسلة ${l.reference_number}`);
    writePrintWindow(w, renderLetterHtml(c, l, window.location.origin, { mode: m, yearOnlyDate }), { title: m === 'background' ? `ترويسة ${c.name}` : `مراسلة ${l.reference_number} - ${l.subject || ''}${suffix}`.trim(), showDownloadPdf: true, showShare: true, autoPrint: false });
  };

  const save = async (andPrint: LetterPrintMode | false = false) => {
    if (!draft) return;
    setSaving(true);
    try {
      const saved = await saveLetter(draft);
      setDraft(saved);
      qc.invalidateQueries({ queryKey: ['letters'] });
      toast.success(`تم حفظ المراسلة ${saved.reference_number}`);
      if (andPrint) print(saved, andPrint);
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const err = (companiesQ.error || lettersQ.error) as Error | null;

  return (
    <div dir="rtl" className="mx-auto max-w-[1800px] space-y-6 p-4 text-right md:p-6 [&_button]:cursor-pointer [&_button]:transition-all [&_button]:duration-200 [&_[role=combobox]]:cursor-pointer">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-card p-5 shadow-sm md:p-6">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary"><Mail className="h-6 w-6" /></span>المراسلات الرسمية</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">أنشئ مراسلاتك بهوية شركتك، وراجعها واحفظها واطبعها من مكان واحد.</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 lg:w-auto">
          {company ? <Button variant="outline" onClick={() => { setCompanyId(''); setDraft(null); setEditingCompany(null); setQ(''); }}><ArrowRight className="h-4 w-4" />جميع الشركات</Button>
            : <Button variant="outline" onClick={() => setEditingCompany({})}><Building2 className="h-4 w-4" />إضافة شركة</Button>}
          {company && <Button onClick={() => setDraft(emptyLetter(company, allLetters))}><FilePlus2 className="h-4 w-4" />مراسلة جديدة</Button>}
        </div>
      </header>

      {err && <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{err.message}</div>}

      {editingCompany && (
        <CompanyEditor company={editingCompany} onCancel={() => setEditingCompany(null)}
          onSaved={c => { setEditingCompany(null); qc.setQueryData<LetterheadCompany[]>(['letterhead-companies'], previous => [...(previous || []).filter(item => item.id !== c.id), c]); qc.invalidateQueries({ queryKey: ['letterhead-companies'] }); setCompanyId(c.id); setDraft(current => current?.company_id === c.id ? current : null); setQ(''); }} />
      )}

      {!company ? (
        <section aria-labelledby="company-picker-title" className="mx-auto max-w-5xl py-6 sm:py-10">
          <div className="mb-8 text-center sm:mb-10">
            <h2 id="company-picker-title" className="text-xl font-bold sm:text-2xl">اختر الشركة للمتابعة</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">مراسلات كل شركة في مساحة خاصة بها</p>
          </div>
          {companiesQ.isLoading ? <div className="flex flex-wrap justify-center gap-5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 w-full rounded-2xl sm:h-64 sm:w-64" />)}</div>
            : companies.length ? <div className="flex flex-wrap justify-center gap-5 sm:gap-6">
              {companies.map(c => (
                <button key={c.id} type="button" aria-label={`الدخول إلى مراسلات ${c.name}`} onClick={() => { setCompanyId(c.id); setQ(''); setEditingCompany(null); }}
                  className="group flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-primary/20 bg-card text-right shadow-sm hover:border-primary/70 hover:shadow-[0_8px_28px_-12px_rgba(184,134,11,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background motion-safe:hover:-translate-y-1 sm:w-64">
                  <CompanyLogo company={c} />
                  <span className="flex min-h-20 w-full flex-1 items-center gap-3 border-t border-border/60 px-5 py-4 group-hover:bg-primary/5">
                    <span className="min-w-0 flex-1 break-words text-base font-bold leading-7">{c.name}</span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:bg-primary/15 group-hover:text-foreground"><ArrowLeft aria-hidden="true" className="h-4 w-4" /></span>
                  </span>
                </button>
              ))}
            </div> : !companiesQ.isError && <div className="rounded-2xl border border-dashed border-primary/30 bg-card p-10 text-center">
              <Building2 className="mx-auto mb-4 h-10 w-10 text-primary" />
              <h3 className="font-bold">أضف شركتك الأولى</h3>
              <p className="mt-2 text-sm text-muted-foreground">أضف اسم الشركة وشعارها لتظهر هنا وتبدأ مراسلاتك.</p>
              <Button className="mt-5" onClick={() => setEditingCompany({})}>إضافة شركة</Button>
            </div>}
        </section>
      ) : <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-3">
        <div className="flex min-w-0 items-center gap-2 px-1 text-sm">
          <CompanyLogo company={company} compact />
          <span className="break-words font-semibold">{company.name}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!company} onClick={() => setEditingCompany(company!)}><Pencil className="h-4 w-4" />بيانات الشركة</Button>
          <Button variant="outline" onClick={() => setEditingCompany({})}><Building2 className="h-4 w-4" />شركة جديدة</Button>
          <Button variant="outline" disabled={!company} title="طباعة أوراق الترويسة الرسمية فارغة للكتابة عليها لاحقاً" onClick={() => company && print({ ...emptyLetter(company), company_id: company.id }, 'background')}><Printer className="h-4 w-4" />ترويسة فارغة</Button>
        </div>
      </div>

      {!draft && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: 'إجمالي المراسلات', value: companyLetters.length, icon: Archive },
          { label: 'مراسلات هذا الشهر', value: monthLetters.length, icon: CalendarDays },
          { label: 'الشركات المسجلة', value: companies.length, icon: Building2 },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 last:col-span-2 sm:last:col-span-1">
            <Icon className="h-5 w-5 shrink-0 text-primary" />
            <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{companiesQ.isLoading || lettersQ.isLoading ? '—' : value}</p></div>
          </div>
        ))}
      </div>}


      {draft && company ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="min-w-0 space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm md:p-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold"><FileText className="h-4 w-4 text-primary" />{draft.id ? `تعديل المراسلة ${draft.reference_number}` : 'مراسلة جديدة'}</h2>
              <Button variant="ghost" size="sm" onClick={() => setDraft(null)}><X className="h-4 w-4" />إغلاق</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">الرقم الإشاري <span className="text-xs text-muted-foreground">(قابل للتعديل)</span>
                <div className="flex gap-1">
                  <Input dir="ltr" value={draft.reference_number} onChange={e => set({ reference_number: e.target.value })} className="min-w-0 flex-1 text-center font-bold tabular-nums" placeholder={`${company.reference_prefix || ''}1`} />
                  <Button type="button" variant="outline" size="sm" className="h-10 shrink-0" title="الرقم التالي تلقائياً" onClick={() => set({ reference_number: nextReference(company.reference_prefix, allLetters.filter(l => l.company_id === company.id && l.id !== draft.id)) })}>التالي</Button>
                </div>
              </label>
              <label className="space-y-1 text-sm">التاريخ<Input type="date" value={draft.letter_date} onChange={e => set({ letter_date: e.target.value })} /></label>
            </div>
            <label className="block space-y-1 text-sm">الموجَّه إليه<Input value={draft.recipient || ''} onChange={e => set({ recipient: e.target.value })} placeholder="السيد الأستاذ/ ... المحترم" /></label>
            <label className="block space-y-1 text-sm">التحية<Input value={draft.greeting || ''} onChange={e => set({ greeting: e.target.value })} /></label>
            <label className="block space-y-1 text-sm">الموضوع<Input placeholder="اكتب عنوانًا واضحًا للمراسلة" value={draft.subject || ''} onChange={e => set({ subject: e.target.value })} /></label>
            <label className="block space-y-1 text-sm">نص المراسلة <span className="text-xs text-muted-foreground">(سطر فارغ بين الفقرات)</span>
              <Textarea placeholder="اكتب تفاصيل المراسلة هنا…" rows={12} value={draft.body} onChange={e => set({ body: e.target.value })} style={{ fontFamily: company.font_family }} className="text-base leading-8" />
            </label>
            <label className="block space-y-1 text-sm">الختام<Input value={draft.closing || ''} onChange={e => set({ closing: e.target.value })} /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">الموقِّع<Input value={draft.signer_name || ''} onChange={e => set({ signer_name: e.target.value })} /></label>
              <label className="space-y-1 text-sm">الصفة<Input value={draft.signer_title || ''} onChange={e => set({ signer_title: e.target.value })} /></label>
            </div>
            <div className="flex flex-wrap gap-4 rounded-lg bg-muted/40 p-2.5 text-sm">
              <label className={cn('flex items-center gap-2', !company.stamp_url && 'opacity-50')} title={company.stamp_url ? '' : 'ارفع صورة الختم من بيانات الشركة'}>
                <Switch disabled={!company.stamp_url} checked={draft.with_stamp !== false && !!company.stamp_url} onCheckedChange={v => set({ with_stamp: v })} />مختومة (الختم)
              </label>
              <label className={cn('flex items-center gap-2', !company.signature_url && 'opacity-50')} title={company.signature_url ? '' : 'ارفع صورة التوقيع من بيانات الشركة'}>
                <Switch disabled={!company.signature_url} checked={draft.with_signature !== false && !!company.signature_url} onCheckedChange={v => set({ with_signature: v })} />صورة التوقيع
              </label>
              {(!company.stamp_url || !company.signature_url) && <button type="button" className="text-xs text-primary underline-offset-2 hover:underline" onClick={() => setEditingCompany(company)}>رفع الختم/التوقيع من بيانات الشركة</button>}
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
              <Button variant="outline" disabled={saving} onClick={() => save(false)}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}حفظ</Button>
              <PrintMenu label="حفظ وطباعة" onPrint={m => save(m)} yearOnlyDate={yearOnlyDate} onYearOnlyDateChange={setYearOnlyDate} />
            </div>
          </section>
          <section className="min-w-0 space-y-3 self-start rounded-2xl border border-border bg-muted/30 p-3 md:p-4 xl:sticky xl:top-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-muted-foreground">معاينة الطباعة <span className="ms-2 text-xs font-normal">A4</span></div>
              <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
                {(Object.keys(PRINT_MODE_LABELS) as LetterPrintMode[]).map(m => (
                  <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m} className={cn('min-h-10 rounded-md px-3 py-1.5 font-medium transition-colors', mode === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{PRINT_MODE_LABELS[m]}</button>
                ))}
              </div>
            </div>
            {mode !== 'background' && fit.overflow && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" />النص أطول من منطقة الكتابة حتى بعد تصغير الخط — اختصر النص، فلن يُطبع ما يتجاوز الحدود.</div>
            )}
            {mode !== 'background' && !fit.overflow && fit.scale < 0.999 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-400">صُغِّر الخط تلقائياً إلى {Math.round(fit.scale * 100)}% ليبقى النص داخل منطقة الكتابة.</div>
            )}
            <LetterPreview html={html} onFit={setFit} />
            <p className="text-xs text-muted-foreground">{MODE_HINT[mode]}</p>
          </section>
        </div>
      ) : (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
            <div><h2 className="font-bold">أرشيف المراسلات</h2><p className="mt-1 text-xs text-muted-foreground">{list.length} مراسلة{q.trim() ? ' تطابق البحث' : ' محفوظة للشركة المحددة'}</p></div>
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} aria-label="البحث في المراسلات" placeholder="ابحث بالرقم أو المستلم أو الموضوع…" className="h-11 pr-9 pl-10" />
            {q && <Button variant="ghost" size="icon" aria-label="مسح البحث" className="absolute left-1 top-1/2 h-9 w-9 -translate-y-1/2" onClick={() => setQ('')}><X className="h-4 w-4" /></Button>}
          </div>
          </div>
          {companiesQ.isLoading || lettersQ.isLoading ? <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
            : !list.length ? <div className="flex flex-col items-center rounded-2xl border border-dashed border-primary/30 bg-card px-5 py-14 text-center">
              <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Mail className="h-8 w-8" /></span>
              <h3 className="text-lg font-bold">{q.trim() ? 'لا توجد نتائج مطابقة' : company ? 'ابدأ مراسلتك الأولى' : 'أضف شركتك للبدء'}</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{q.trim() ? 'جرّب رقمًا إشاريًا أو اسم مستلم أو موضوعًا آخر.' : company ? 'أنشئ خطابًا رسميًا بترويسة شركتك، مع معاينة مباشرة قبل الطباعة.' : 'أدخل بيانات الشركة وشعارها لتجهيز ترويسة مراسلاتك الرسمية.'}</p>
              <Button className="mt-5" variant={q.trim() ? 'outline' : 'default'} onClick={() => q.trim() ? setQ('') : company ? setDraft(emptyLetter(company, allLetters)) : setEditingCompany({})}>{q.trim() ? <X className="h-4 w-4" /> : <FilePlus2 className="h-4 w-4" />}{q.trim() ? 'مسح البحث' : company ? 'إنشاء مراسلة' : 'إضافة شركة'}</Button>
            </div>
            : (
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full text-sm">
                  <thead className="hidden bg-muted/50 text-xs text-muted-foreground md:table-header-group">
                    <tr><th className="p-3 text-right">الرقم الإشاري</th><th className="p-3 text-right">التاريخ</th><th className="p-3 text-right">الموجَّه إليه / الموضوع</th><th className="p-3 text-left">الإجراءات</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {list.map(l => (
                      <tr key={l.id} className="grid grid-cols-2 p-3 transition-colors hover:bg-primary/5 md:table-row md:p-0">
                        <td className="p-2 font-bold tabular-nums md:p-3" dir="ltr" style={{ textAlign: 'right' }}>{l.reference_number}</td>
                        <td className="p-2 text-left tabular-nums md:p-3 md:text-right">{String(l.letter_date).split('-').reverse().join('/')}</td>
                        <td className="col-span-2 p-2 md:p-3"><div className="font-semibold">{l.recipient?.trim() || l.subject?.trim() || '—'}</div>{l.recipient?.trim() && <div className="text-xs text-muted-foreground">{l.subject}</div>}</td>
                        <td className="col-span-2 p-2 md:p-3">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <Button size="sm" variant="outline" className="h-8" onClick={() => setDraft(l)}><Pencil className="h-3.5 w-3.5" />تعديل</Button>
                            <PrintMenu size="sm" onPrint={m => print(l, m)} yearOnlyDate={yearOnlyDate} onYearOnlyDateChange={setYearOnlyDate} />
                            <Button size="sm" variant="ghost" className="h-10 w-10" aria-label="نسخ كمراسلة جديدة" title="نسخ كمراسلة جديدة" onClick={() => { const c = companies.find(x => x.id === l.company_id); setDraft({ ...l, id: undefined, created_at: undefined, letter_date: today(), reference_number: nextReference(c?.reference_prefix || '', allLetters.filter(x => x.company_id === l.company_id)) }); }}><Copy className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="ghost" aria-label={`حذف المراسلة ${l.reference_number}`} title="حذف المراسلة" className="h-10 w-10 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={async () => {
                              if (!(await confirm({ title: 'حذف المراسلة', message: `حذف المراسلة ${l.reference_number} نهائياً؟`, confirmText: 'حذف', variant: 'destructive' } as any))) return;
                              try { await deleteLetter(l.id!); qc.invalidateQueries({ queryKey: ['letters'] }); toast.success('تم الحذف'); } catch (e: any) { toast.error(e.message); }
                            }}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </section>
      )}
      </>}
    </div>
  );
}
