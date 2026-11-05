import { usePersistedState } from '@/hooks/usePersistedState';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { Archive, ArchiveRestore, CalendarRange, FileBarChart2, Loader2, Pencil, RefreshCw, Save, Shuffle, X } from 'lucide-react';
import { preparePrintWindow, writePrintWindow } from '@/utils/printWindowHelper';
import { LetterPreview, PrintMenu } from '@/components/correspondence/LetterParts';
import { LetterBodyEditor } from '@/components/correspondence/LetterBodyEditor';
import {
  PRINT_MODE_LABELS, archiveLetter, loadCompanies, loadLetters, nextReference, renderLetterHtml, saveLetter,
  type Letter, type LetterPrintMode,
} from '@/services/correspondence';
import {
  DEFAULT_SECTIONS, PERIODS, dmy, loadReportData, periodRange, todayIso, writeReport,
  type ReportData, type ReportPeriod, type ReportSections,
} from '@/services/periodicReports';

const SECTION_LABELS: Record<keyof ReportSections, string> = {
  contracts: 'العقود الجديدة', installs: 'التركيبات', removals: 'المحالة للإزالة', payments: 'الدخولات المالية', details: 'القوائم التفصيلية',
};

export default function PeriodicReports() {
  const qc = useQueryClient();
  const { confirm } = useSystemDialog();
  const companiesQ = useQuery({ queryKey: ['letterhead-companies'], queryFn: loadCompanies });
  const lettersQ = useQuery({ queryKey: ['letters'], queryFn: () => loadLetters(), enabled: companiesQ.isSuccess });
  const companies = companiesQ.data || [];
  const allLetters = lettersQ.data || [];
  const [showArchived, setShowArchived] = useState(false);
  const allReports = useMemo(() => allLetters.filter(l => l.kind === 'report'), [allLetters]);
  const reports = useMemo(() => allReports.filter(l => !!l.archived_at === showArchived), [allReports, showArchived]);
  const archivedCount = allReports.filter(l => l.archived_at).length;
  const setArchived = async (r: Letter, archived: boolean) => {
    try { await archiveLetter(r.id!, archived); qc.invalidateQueries({ queryKey: ['letters'] }); toast.success(archived ? `أُرشف التقرير ${r.reference_number}` : `استُرجع التقرير ${r.reference_number}`); }
    catch (e: any) { toast.error(e.message, { duration: 9000 }); }
  };

  const [companyId, setCompanyId] = useState('');
  const [period, setPeriod] = usePersistedState<ReportPeriod>('periodicReports.period', 'week');
  const [end, setEnd] = useState(todayIso());
  const [customFrom, setCustomFrom] = useState('');
  const [sections, setSections] = useState<ReportSections>(DEFAULT_SECTIONS);
  const [seed, setSeed] = useState(1);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<Letter | null>(null);
  const [mode, setMode] = usePersistedState<LetterPrintMode>('periodicReports.mode', 'full');
  const [pages, setPages] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!companyId && companies.length) setCompanyId((companies.find(c => c.is_default) || companies[0]).id); }, [companies, companyId]);
  const company = companies.find(c => c.id === (draft?.company_id || companyId)) || null;
  const range = periodRange(period, end, customFrom);

  const compose = (d: ReportData, s: ReportSections, sd: number, keep?: Letter | null) => {
    if (!company) return;
    const r = writeReport(d, period, s, sd);
    setDraft(prev => {
      const base = keep || prev;
      return {
        ...(base || {}),
        company_id: company.id,
        kind: 'report',
        report_period: period,
        period_start: d.from,
        period_end: d.to,
        reference_number: base?.reference_number || nextReference(company.reference_prefix, allLetters.filter(l => l.company_id === company.id)),
        letter_date: base?.letter_date || todayIso(),
        recipient: base?.recipient ?? r.recipient,
        greeting: base?.greeting ?? 'تحية طيبة، وبعد،',
        subject: r.subject,
        body: r.body,
        closing: base?.closing ?? 'وتفضلوا بقبول فائق الاحترام والتقدير.',
        signer_name: base?.signer_name ?? company.signer_name ?? '',
        signer_title: base?.signer_title ?? company.signer_title ?? '',
        with_stamp: base?.with_stamp ?? true,
        with_signature: base?.with_signature ?? true,
      } as Letter;
    });
  };

  const generate = async () => {
    if (!company) { toast.error('أضف بيانات الشركة من صفحة المراسلات أولاً'); return; }
    if (range.from > range.to) { toast.error('تاريخ البداية بعد تاريخ النهاية'); return; }
    setLoading(true);
    try {
      const d = await loadReportData(range.from, range.to);
      setData(d);
      compose(d, sections, seed, draft?.id ? null : draft);
    } catch (e: any) { toast.error(e.message || 'تعذّر جمع البيانات'); } finally { setLoading(false); }
  };

  const rephrase = () => {
    if (!data) return;
    const n = seed + 1;
    setSeed(n);
    compose(data, sections, n);
    toast.success('أُعيدت الصياغة بأسلوب آخر');
  };

  const html = useMemo(() => (company && draft ? renderLetterHtml(company, draft, window.location.origin, { mode, paginate: true, markup: true }) : ''), [company, draft, mode]);
  const set = (patch: Partial<Letter>) => setDraft(d => (d ? { ...d, ...patch } : d));

  const print = (l: Letter, m: LetterPrintMode = 'full') => {
    const c = companies.find(x => x.id === l.company_id);
    if (!c) return;
    const w = preparePrintWindow(`تقرير ${l.reference_number}`);
    writePrintWindow(w, renderLetterHtml(c, l, window.location.origin, { mode: m, paginate: true, markup: true }), {
      title: `${l.subject || 'تقرير'}${m === 'full' ? '' : ` (${PRINT_MODE_LABELS[m]})`}`, showDownloadPdf: true, showShare: true, autoPrint: false,
    });
  };

  const save = async (andPrint: LetterPrintMode | false = false) => {
    if (!draft) return;
    setSaving(true);
    try {
      const saved = await saveLetter({ ...draft, kind: 'report' });
      setDraft(saved);
      qc.invalidateQueries({ queryKey: ['letters'] });
      if (saved.kind !== 'report') toast.warning('حُفظ التقرير، لكن لتمييزه عن المراسلات طبّق ملف sql/05_letters_reports.sql', { duration: 9000 });
      else toast.success(`تم حفظ التقرير ${saved.reference_number}`);
      if (andPrint) print(saved, andPrint);
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const err = (companiesQ.error || lettersQ.error) as Error | null;

  return (
    <div dir="rtl" className="space-y-4 p-4 text-right md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><FileBarChart2 className="h-6 w-6" />التقارير الدورية</h1>
          <p className="text-sm text-muted-foreground">تقرير مكتوب عن العقود والتركيبات والإزالة والدخولات، على ورقة المراسلات الرسمية وقابل للتعديل</p>
        </div>
        {companies.length > 1 && (
          <Select value={companyId} onValueChange={v => { setCompanyId(v); setDraft(d => (d ? { ...d, company_id: v } : d)); }}>
            <SelectTrigger className="h-10 w-[240px]"><SelectValue /></SelectTrigger>
            <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </header>

      {err && <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{err.message}</div>}

      {/* الفترة والبنود */}
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map(p => (
            <button key={p.id} type="button" onClick={() => setPeriod(p.id)}
              className={cn('rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors', period === p.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted')}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {period === 'custom' && (
            <label className="space-y-1 text-sm">من<Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-44" /></label>
          )}
          <label className="space-y-1 text-sm">{period === 'custom' ? 'إلى' : 'حتى تاريخ'}<Input type="date" value={end} onChange={e => setEnd(e.target.value)} className="w-44" /></label>
          <div className="flex h-10 items-center gap-2 rounded-lg bg-muted/50 px-3 text-sm"><CalendarRange className="h-4 w-4 text-muted-foreground" />من {dmy(range.from)} إلى {dmy(range.to)}</div>
          <Button onClick={generate} disabled={loading || !company} className="ms-auto">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{draft ? 'تحديث التقرير بالبيانات' : 'إنشاء التقرير'}
          </Button>
        </div>
        <div className="flex flex-wrap gap-4 border-t border-border pt-3 text-sm">
          {(Object.keys(SECTION_LABELS) as (keyof ReportSections)[]).map(k => (
            <label key={k} className="flex items-center gap-2">
              <Switch checked={sections[k]} onCheckedChange={v => { const s = { ...sections, [k]: v }; setSections(s); if (data) compose(data, s, seed); }} />{SECTION_LABELS[k]}
            </label>
          ))}
        </div>
        {data && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['عقود جديدة', data.contracts.length, `${Math.round(data.contracts.reduce((s, c) => s + c.total, 0)).toLocaleString('en-US')} د.ل`],
              ['لوحات رُكّبت', data.installs.length, `${data.installs.filter(i => i.reinstall).length} إعادة تركيب`],
              ['أُحيلت للإزالة', data.removalsReferred.length, `أُزيل ${data.removalsDone} — المعلّق ${data.removalsPendingAll}`],
              ['الدخولات', `${Math.round(data.payments.reduce((s, p) => s + p.amount, 0)).toLocaleString('en-US')}`, `${new Set(data.payments.map(p => p.group)).size} دفعة`],
            ].map(([t, v, sub]) => (
              <div key={String(t)} className="rounded-lg border border-border bg-background p-3">
                <div className="text-xs text-muted-foreground">{t}</div>
                <div className="text-xl font-bold tabular-nums">{v}</div>
                <div className="text-xs text-muted-foreground">{sub}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {draft && company ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold">{draft.id ? `تعديل التقرير ${draft.reference_number}` : 'تقرير جديد'}</h2>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={!data} onClick={rephrase} title="نفس الأرقام بصياغة مختلفة"><Shuffle className="h-4 w-4" />صياغة أخرى</Button>
                <Button variant="ghost" size="sm" onClick={() => setDraft(null)}><X className="h-4 w-4" />إغلاق</Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">الرقم الإشاري
                <div className="flex gap-1">
                  <Input dir="ltr" value={draft.reference_number} onChange={e => set({ reference_number: e.target.value })} className="min-w-0 flex-1 text-center font-bold" />
                  <Button type="button" variant="outline" size="sm" className="h-10" onClick={() => set({ reference_number: nextReference(company.reference_prefix, allLetters.filter(l => l.company_id === company.id && l.id !== draft.id)) })}>التالي</Button>
                </div>
              </label>
              <label className="space-y-1 text-sm">تاريخ التقرير<Input type="date" value={draft.letter_date} onChange={e => set({ letter_date: e.target.value })} /></label>
            </div>
            <label className="block space-y-1 text-sm">الموجَّه إليه<Input value={draft.recipient || ''} onChange={e => set({ recipient: e.target.value })} /></label>
            <label className="block space-y-1 text-sm">الموضوع<Input value={draft.subject || ''} onChange={e => set({ subject: e.target.value })} /></label>
            <div className="space-y-1.5 text-sm">
              <div className="font-semibold">نص التقرير <span className="text-xs font-normal text-muted-foreground">— عدّل بحرية، والجداول قابلة للتعديل مباشرة</span></div>
              <LetterBodyEditor key={draft.id || 'new'} value={draft.body} onChange={body => set({ body })} font={company.font_family} />
            </div>
            <label className="block space-y-1 text-sm">الختام<Input value={draft.closing || ''} onChange={e => set({ closing: e.target.value })} /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">الموقِّع<Input value={draft.signer_name || ''} onChange={e => set({ signer_name: e.target.value })} /></label>
              <label className="space-y-1 text-sm">الصفة<Input value={draft.signer_title || ''} onChange={e => set({ signer_title: e.target.value })} /></label>
            </div>
            <div className="flex flex-wrap gap-4 rounded-lg bg-muted/40 p-2.5 text-sm">
              <label className={cn('flex items-center gap-2', !company.stamp_url && 'opacity-50')}><Switch disabled={!company.stamp_url} checked={draft.with_stamp !== false && !!company.stamp_url} onCheckedChange={v => set({ with_stamp: v })} />مختوم</label>
              <label className={cn('flex items-center gap-2', !company.signature_url && 'opacity-50')}><Switch disabled={!company.signature_url} checked={draft.with_signature !== false && !!company.signature_url} onCheckedChange={v => set({ with_signature: v })} />صورة التوقيع</label>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
              <Button variant="outline" disabled={saving} onClick={() => save(false)}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}حفظ</Button>
              <PrintMenu label="حفظ وطباعة" onPrint={m => save(m)} />
            </div>
          </section>
          <section className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-muted-foreground">المعاينة — {pages} {pages === 1 ? 'صفحة' : pages === 2 ? 'صفحتان' : 'صفحات'}</div>
              <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
                {(Object.keys(PRINT_MODE_LABELS) as LetterPrintMode[]).map(m => (
                  <button key={m} type="button" onClick={() => setMode(m)} className={cn('rounded-md px-3 py-1.5 font-medium transition-colors', mode === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{PRINT_MODE_LABELS[m]}</button>
                ))}
              </div>
            </div>
            <LetterPreview html={html} onFit={f => setPages(f.pages)} />
          </section>
        </div>
      ) : (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground">{showArchived ? 'التقارير المؤرشفة' : 'التقارير المحفوظة'}</h2>
            <button type="button" onClick={() => setShowArchived(v => !v)} className="inline-flex min-h-8 items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"><Archive className="h-3.5 w-3.5" />{showArchived ? 'العودة للتقارير النشطة' : `الأرشيف (${archivedCount})`}</button>
          </div>
          {lettersQ.isLoading ? <Skeleton className="h-24 w-full" />
            : !reports.length ? <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">{showArchived ? 'لا توجد تقارير مؤرشفة' : 'اختر الفترة ثم «إنشاء التقرير»'}</div>
            : (
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr><th className="p-3 text-right">الرقم الإشاري</th><th className="p-3 text-right">الفترة</th><th className="p-3 text-right">الموضوع</th><th className="p-3" /></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {reports.map(r => (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="p-3 font-bold" dir="ltr" style={{ textAlign: 'right' }}>{r.reference_number}</td>
                        <td className="p-3 tabular-nums">{r.period_start ? `${dmy(r.period_start)} – ${dmy(r.period_end || '')}` : dmy(r.letter_date)}</td>
                        <td className="p-3">{r.subject}</td>
                        <td className="p-3">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" className="h-8" onClick={() => { setDraft(r); if (r.report_period) setPeriod(r.report_period as ReportPeriod); if (r.period_end) setEnd(r.period_end); if (r.period_start) setCustomFrom(r.period_start); }}><Pencil className="h-3.5 w-3.5" />تعديل</Button>
                            <PrintMenu size="sm" onPrint={m => print(r, m)} />
                            {showArchived
                              ? <Button size="sm" variant="outline" className="h-8" onClick={() => setArchived(r, false)}><ArchiveRestore className="h-3.5 w-3.5" />استرجاع</Button>
                              : <Button size="sm" variant="ghost" className="h-8 text-muted-foreground hover:text-amber-700" title="أرشفة التقرير (يمكن استرجاعه)" aria-label={`أرشفة التقرير ${r.reference_number}`} onClick={async () => {
                                if (!(await confirm({ title: 'أرشفة التقرير', message: `نقل التقرير ${r.reference_number} إلى الأرشيف؟ يمكنك استرجاعه لاحقاً.`, confirmText: 'أرشفة' } as any))) return;
                                setArchived(r, true);
                              }}><Archive className="h-3.5 w-3.5" /></Button>}
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
    </div>
  );
}
