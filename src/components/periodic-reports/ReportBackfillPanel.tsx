import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { CalendarClock, CheckCircle2, Loader2, Square, X } from 'lucide-react';
import { PrintMenu } from '@/components/correspondence/LetterParts';
import { nextReference, saveLetter, type Letter, type LetterheadCompany, type LetterPrintMode, type RenderOptions } from '@/services/correspondence';
import { REPORT_SIGNER, dmy, loadContractAdjustments, reportPrefix, saveReportSnapshot, loadReportData, todayIso, writeReport, type ReportSections } from '@/services/periodicReports';
import { printReportsBatch } from '@/services/reportsBatchPrint';

const addDays = (s: string, n: number) => { const [y, m, d] = s.split('-').map(Number); const t = new Date(y, m - 1, d + n); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };

interface Week { from: string; to: string; existing?: Letter }

/** التقارير الأسبوعية الفائتة: إنشاء كل أسبوع لم يُكتب تقريره، ثم طباعتها كلها دفعة واحدة */
export function ReportBackfillPanel({ company, reports, allLetters, sections, docOpts, onSaved, onClose }: {
  company: LetterheadCompany; reports: Letter[]; allLetters: Letter[]; sections: ReportSections; docOpts?: Pick<RenderOptions, 'hideReference' | 'hideSign' | 'hideRecipient' | 'hideGreeting' | 'hideClosing'>;
  onSaved: () => void; onClose: () => void;
}) {
  const [lastEnd, setLastEnd] = useState(todayIso());
  const [from, setFrom] = useState(addDays(todayIso(), -364));
  const [created, setCreated] = useState<Map<string, Letter>>(new Map());
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [running, setRunning] = useState<{ done: number; total: number; label: string } | null>(null);
  const cancel = useRef(false);
  const [withStamp, setWithStamp] = useState(false);
  const [withSignature, setWithSignature] = useState(false);

  const weeks: Week[] = useMemo(() => {
    const out: Week[] = [];
    for (let to = lastEnd, guard = 0; addDays(to, -6) >= from && guard < 260; to = addDays(to, -7), guard++) {
      const f = addDays(to, -6);
      const existing = created.get(to) || reports.find(r => !r.archived_at && r.company_id === company.id && (r.report_period || 'week') === 'week' && r.period_end === to && r.period_start === f);
      out.push({ from: f, to, existing });
    }
    return out.reverse(); // الأقدم أولاً
  }, [lastEnd, from, reports, created, company.id]);
  const missing = weeks.filter(w => !w.existing);
  const sel = selected ?? new Set(missing.map(w => w.to));
  const toggle = (k: string, on: boolean) => setSelected(() => { const n = new Set(sel); on ? n.add(k) : n.delete(k); return n; });

  const createMissing = async () => {
    const todo = missing.filter(w => sel.has(w.to));
    if (!todo.length) { toast.info('لا توجد أسابيع محددة بدون تقرير'); return; }
    cancel.current = false;
    // تسلسل التقارير منفصل عن المراسلات
    const pool = reports.filter(l => l.company_id === company.id);
    let ok = 0;
    for (let i = 0; i < todo.length; i++) {
      if (cancel.current) break;
      const w = todo[i];
      setRunning({ done: i, total: todo.length, label: `أسبوع ${dmy(w.from)} – ${dmy(w.to)}` });
      try {
        const d = await loadReportData(w.from, w.to);
        // يقارن بالتقارير السابقة (ومنها ما أُنشئ للتو في هذه الدفعة)
        d.adjustments = await loadContractAdjustments(w.from, pool).catch(() => []);
        const r = writeReport(d, 'week', sections, i + 1); // صياغة مختلفة لكل أسبوع
        const saved = await saveLetter({
          company_id: company.id, kind: 'report', report_period: 'week', period_start: w.from, period_end: w.to,
          reference_number: nextReference(reportPrefix(company.reference_prefix), pool), letter_date: w.to,
          recipient: '', greeting: '', subject: r.subject, body: r.body,
          closing: '', signer_name: REPORT_SIGNER.name, signer_title: REPORT_SIGNER.title,
          with_stamp: withStamp, with_signature: withSignature,
        });
        pool.push(saved);
        if (saved.id) await saveReportSnapshot(saved.id, d);
        setCreated(m => new Map(m).set(w.to, saved));
        ok++;
      } catch (e: any) {
        toast.error(`تعذر إنشاء تقرير ${dmy(w.from)} – ${dmy(w.to)}: ${e.message || e}`, { duration: 9000 });
        break;
      }
    }
    setRunning(null);
    setSelected(null);
    onSaved();
    if (ok) toast.success(`أُنشئ ${ok} تقرير أسبوعي${cancel.current ? ' (أُوقف قبل الاكتمال)' : ''}`);
  };

  const printAll = async (m: LetterPrintMode, onlySelected: boolean) => {
    const list = weeks.filter(w => w.existing && (!onlySelected || sel.has(w.to))).map(w => w.existing!);
    if (!list.length) { toast.info('لا توجد تقارير محفوظة في هذه الفترة لطباعتها'); return; }
    setRunning({ done: 0, total: list.length, label: 'تجهيز الطباعة' });
    try {
      await printReportsBatch(company, list, m, `التقارير الأسبوعية ${dmy(list[0].period_start || '')} – ${dmy(list[list.length - 1].period_end || '')}`,
        (done, total) => setRunning({ done, total, label: 'تجهيز الطباعة' }), docOpts);
    } catch (e: any) { toast.error(e.message || 'تعذر تجهيز الطباعة'); }
    finally { setRunning(null); }
  };

  const busy = !!running;
  const existingCount = weeks.length - missing.length;
  return (
    <section className="space-y-3 rounded-xl border border-primary/30 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold"><CalendarClock className="h-5 w-5 text-primary" />التقارير الأسبوعية الفائتة</h2>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}><X className="h-4 w-4" />إغلاق</Button>
      </div>
      <p className="text-sm text-muted-foreground">يقسّم الفترة إلى أسابيع (7 أيام تنتهي بالتاريخ المحدد)، ويكتب تقرير كل أسبوع ليس له تقرير بأرقام ذلك الأسبوع نفسه، ثم يمكنك طباعتها كلها دفعة واحدة.</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">من تاريخ<Input type="date" value={from} onChange={e => { setFrom(e.target.value); setSelected(null); }} className="w-44" disabled={busy} /></label>
        <label className="space-y-1 text-sm">آخر أسبوع ينتهي في<Input type="date" value={lastEnd} onChange={e => { setLastEnd(e.target.value); setSelected(null); }} className="w-44" disabled={busy} /></label>
        <div className="flex h-10 items-center gap-3 rounded-lg bg-muted/50 px-3 text-sm">
          <span>{weeks.length} أسبوع</span><span className="text-emerald-600">{existingCount} لها تقرير</span><span className="text-destructive">{missing.length} فائت</span>
        </div>
        <div className="ms-auto flex flex-wrap gap-2">
          {busy && running.label !== 'تجهيز الطباعة'
            ? <Button variant="outline" onClick={() => { cancel.current = true; }}><Square className="h-4 w-4" />إيقاف</Button>
            : <Button onClick={createMissing} disabled={busy || !missing.some(w => sel.has(w.to))}><CheckCircle2 className="h-4 w-4" />إنشاء الفائتة المحددة ({missing.filter(w => sel.has(w.to)).length})</Button>}
          <PrintMenu label={`طباعة الكل دفعة واحدة (${existingCount})`} onPrint={m => printAll(m, false)} />
        </div>
      </div>
      <div className="flex flex-wrap gap-4 rounded-lg bg-muted/40 p-2.5 text-sm">
        <span className="text-muted-foreground">للتقارير التي ستُنشأ:</span>
        <label className={cn('flex items-center gap-2', !company.stamp_url && 'opacity-50')}><Switch disabled={busy || !company.stamp_url} checked={withStamp && !!company.stamp_url} onCheckedChange={setWithStamp} />مختومة</label>
        <label className={cn('flex items-center gap-2', !company.signature_url && 'opacity-50')}><Switch disabled={busy || !company.signature_url} checked={withSignature && !!company.signature_url} onCheckedChange={setWithSignature} />صورة التوقيع</label>
      </div>
      {running && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground"><span className="flex items-center gap-1"><Loader2 className="h-3.5 w-3.5 animate-spin" />{running.label}</span><span className="tabular-nums">{running.done}/{running.total}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${running.total ? (running.done / running.total) * 100 : 0}%` }} /></div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-muted-foreground">التحديد:</span>
        <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => setSelected(new Set(weeks.map(w => w.to)))}>الكل</Button>
        <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => setSelected(new Set(missing.map(w => w.to)))}>الفائتة فقط</Button>
        <Button size="sm" variant="ghost" className="h-8" disabled={busy} onClick={() => setSelected(new Set())}>إلغاء</Button>
        <span className="ms-auto"><PrintMenu size="sm" label={`طباعة المحدد (${weeks.filter(w => w.existing && sel.has(w.to)).length})`} onPrint={m => printAll(m, true)} /></span>
      </div>
      <div className="grid max-h-80 gap-1.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {weeks.map(w => (
          <label key={w.to} className={cn('flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm', sel.has(w.to) ? 'border-primary bg-primary/5' : 'border-border')}>
            <Checkbox checked={sel.has(w.to)} onCheckedChange={c => toggle(w.to, c === true)} disabled={busy} />
            <span className="flex-1 tabular-nums">{dmy(w.from)} – {dmy(w.to)}</span>
            {w.existing ? <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-400">محفوظ</span> : <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] text-destructive">فائت</span>}
          </label>
        ))}
      </div>
    </section>
  );
}
