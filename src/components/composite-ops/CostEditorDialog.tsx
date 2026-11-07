import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Wrench, Printer, Scissors, Percent, Search, Loader2, ShieldCheck, Save, AlertTriangle, Check, MapPin } from 'lucide-react';
import { money, changeCostLineFaces, applyBulkPrice, computeOperation, lineArea, linePrintRate, r2, smartDistribute, type BulkMode, type BulkTarget } from '@/lib/compositeCosts';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { ZoomImage } from '@/components/composite-ops/ImageZoom';
import { loadEditor, saveEditor, discountAmount, type DiscountMode, type EditorLine, type EditorState, type OperationRow } from '@/services/compositeOperations';


type Tab = 'installation' | 'print' | 'cutout';

function Num({ value, onChange, disabled, className, label }: { value: number; onChange: (v: number) => void; disabled?: boolean; className?: string; label: string }) {
  const [text, setText] = useState(String(value ?? 0));
  useEffect(() => { setText(String(value ?? 0)); }, [value]);
  return (
    <Input
      dir="ltr"
      inputMode="decimal"
      aria-label={label}
      disabled={disabled}
      value={disabled ? '0' : text}
      onChange={e => {
        const t = e.target.value.replace(/[^0-9.]/g, '');
        setText(t);
        onChange(Math.max(0, Number(t) || 0));
      }}
      onFocus={e => e.currentTarget.select()}
      className={cn('h-9 text-center tabular-nums', className)}
    />
  );
}

/** حقل سعر المتر المربع للوحة: مُثبَّت (أزرق) أو محسوب من المبلغ ÷ المساحة (باهت) */
function MeterRate({ value, pinned, disabled, onChange, label, onReset }: { value: number; pinned: boolean; disabled?: boolean; onChange: (v: number) => void; label: string; onReset?: () => void }) {
  return (
    <div className="mt-1 flex items-center gap-1" title={pinned ? 'سعر متر خاص بهذه اللوحة' : 'محسوب من المبلغ ÷ المساحة — عدّله لتثبيت سعر المتر'}>
      <Num label={label} value={value} disabled={disabled} onChange={onChange}
        className={cn('h-7 px-1 text-[11px]', pinned ? 'border-primary/50 bg-primary/5 font-semibold text-primary' : 'text-muted-foreground')} />
      <span className="shrink-0 text-[10px] text-muted-foreground">/م<sup>2</sup></span>
      {onReset && pinned && !disabled && (
        <button type="button" onClick={onReset} className="shrink-0 text-[10px] text-muted-foreground hover:text-primary" title="رجوع للسعر العام" aria-label={`رجوع للسعر العام — ${label}`}>↺</button>
      )}
    </div>
  );
}

/** المساحة بأرقام لاتينية؛ الأُس داخل <sup> كي لا يقلبه اتجاه RTL */
function Area({ value, className }: { value: number; className?: string }) {
  const v = Math.round((Number(value) || 0) * 10) / 10;
  return <span className={cn('whitespace-nowrap tabular-nums', className)}><bdi>{v.toLocaleString('en-US', { maximumFractionDigits: 1 })}</bdi> م<sup className="text-[0.7em]">2</sup></span>;
}

function FacesPicker({ l, onToggle }: { l: EditorLine; onToggle: (face: number) => void }) {
  const max = l.maxFaces || 1;
  const sel = l.selectedFaces || Array.from({ length: l.faces }, (_, i) => i + 1);
  if (max <= 1) {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="rounded-md border border-border bg-muted/60 px-2.5 py-1 text-[11px] text-muted-foreground">وجه واحد{l.faceLabels?.[0] && <span className="ms-1 tabular-nums" dir="ltr">{l.faceLabels[0]}</span>}</span>
        <Area value={lineArea(l)} className="text-[11px] text-muted-foreground" />
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-1">
        {Array.from({ length: max }, (_, i) => i + 1).map(f => {
          const active = sel.includes(f);
          return (
            <button key={f} type="button" onClick={() => onToggle(f)} aria-pressed={active}
              aria-label={`الوجه ${f}، ${l.faceLabels?.[f - 1] || l.size} متر`} title={active ? 'اضغط لإلغاء هذا الوجه' : 'اضغط لإضافة هذا الوجه'}
              className={cn('flex min-w-[58px] flex-col items-center rounded-lg border px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                active ? 'border-primary bg-primary/15 text-foreground' : 'border-dashed border-border text-muted-foreground opacity-70 hover:border-primary/50 hover:opacity-100')}>
              <span className="flex items-center gap-1 text-[11px] font-semibold">
                <span className={cn('flex h-3.5 w-3.5 items-center justify-center rounded-full border', active ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/50')}>
                  {active && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                </span>
                وجه {f}
              </span>
              {l.faceLabels?.[f - 1] && <span className="text-[10px] tabular-nums opacity-80" dir="ltr">{l.faceLabels[f - 1]}</span>}
            </button>
          );
        })}
      </div>
      <span className="text-[11px] text-muted-foreground"><span className="tabular-nums">{sel.length}/{max}</span> · <Area value={lineArea(l)} /></span>
    </div>
  );
}

function BoardCell({ l, extra }: { l: EditorLine; extra?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <ZoomImage src={l.image} alt={l.name} title={`${l.name} · ${l.size}`} className="h-14 w-20 shrink-0 rounded-md border border-border" />
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-1.5"><span className="truncate font-semibold">{l.name}</span><span className="shrink-0 rounded bg-muted px-1.5 text-[10px] tabular-nums">{l.size}</span></div>
        {l.landmark && <div className="truncate text-[11px] text-muted-foreground">{l.landmark}</div>}
        {(l.municipality || (l.area && l.area !== l.municipality)) && (
          <div className="flex flex-wrap items-center gap-1">
            {l.area && l.area !== l.municipality && (
              <span className="inline-flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-1.5 py-px text-[11px] text-violet-700 dark:text-violet-300">
                <MapPin className="h-3 w-3" />{l.area}
              </span>
            )}
            {l.municipality && (
              <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-1.5 py-px text-[11px] font-semibold text-sky-700 dark:text-sky-300">{l.municipality}</span>
            )}
          </div>
        )}
        {extra && <div className="truncate text-[11px] text-muted-foreground/80">{extra}</div>}
      </div>
    </div>
  );
}

function IncludedBanner({ what, contractValue, expense }: { what: string; contractValue: number; expense: number }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
      <div className="space-y-1">
        <div className="font-bold text-emerald-700 dark:text-emerald-400">{what} مشمول في سعر العقد — قيمته على الزبون 0 د.ل</div>
        <div className="text-muted-foreground">
          تكلفة التنفيذ ({money(expense)}) تُسجَّل مصروفاً على العقد ولا تُحسب خسارة على المهمة.
          {contractValue > 0 && <> قيمة {what} المسجلة في العقد: <b className="tabular-nums">{money(contractValue)}</b>.</>}
        </div>
      </div>
    </div>
  );
}

export function CostEditorDialog({ op, open, onOpenChange, onSaved }: { op: OperationRow | null; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const { confirm } = useSystemDialog();
  const [state, setState] = useState<EditorState | null>(null);
  const [lines, setLines] = useState<EditorLine[]>([]);
  const [printEnabled, setPrintEnabled] = useState(false);
  const [printCust, setPrintCust] = useState(0);
  const [printComp, setPrintComp] = useState(0);
  const [printerId, setPrinterId] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [discountMode, setDiscountMode] = useState<DiscountMode>('amount');
  const [discountPct, setDiscountPct] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [notes, setNotes] = useState('');
  const [tab, setTab] = useState<Tab>('installation');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [team, setTeam] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTarget, setBulkTarget] = useState<BulkTarget>('company');
  const [bulkMode, setBulkMode] = useState<BulkMode | 'table' | 'total'>('meter');
  const [bulkValue, setBulkValue] = useState(0);
  const [cutTotalCust, setCutTotalCust] = useState(0);
  const [cutTotalComp, setCutTotalComp] = useState(0);

  useEffect(() => {
    if (!open || !op) return;
    let cancelled = false;
    setState(null); setError(null); setTab('installation'); setQ(''); setTeam('all'); setSelected(new Set());
    loadEditor(op).then(s => {
      if (cancelled) return;
      setState(s);
      setLines(s.lines);
      setPrintEnabled(s.draft.printEnabled);
      // سعر متر الطباعة للزبون: الحالي، أو من آخر عملية سابقة له
      const incPrint = s.draft.type === 'new_installation' && s.draft.contractIncludesPrint;
      setPrintCust(s.draft.printCustomerPerMeter || (incPrint ? 0 : s.suggested.printPerMeter));
      setPrintComp(s.draft.printCompanyPerMeter);
      setPrinterId(s.printerId);
      setDiscount(s.draft.discount);
      setDiscountMode(s.discountMode);
      setDiscountPct(s.discountPercent);
      setDiscountReason(s.discountReason);
      setNotes(s.notes);
      const cut = computeOperation(s.draft).cutout;
      setCutTotalCust(cut.customer);
      setCutTotalComp(cut.company);
      const incInst = s.draft.contractIncludesInstallation && s.draft.type === 'new_installation';
      setBulkTarget(incInst ? 'company' : 'customer');
      setBulkMode('meter');
      // سعر المتر المحفوظ لهذه العملية إن وُجد، وإلا المقترح من آخر عملية للزبون
      const savedRates = [...new Set(s.lines.map(l => l.customerPerMeter).filter(Boolean))];
      setBulkValue(incInst ? 0 : savedRates.length === 1 ? Number(savedRates[0]) : s.suggested.installPerMeter);
    }).catch(e => !cancelled && setError(e.message || 'تعذر تحميل البيانات'));
    return () => { cancelled = true; };
  }, [open, op]);

  const draft = useMemo(() => {
    if (!state) return null;
    const base = { ...state.draft, lines, printEnabled, printCustomerPerMeter: printCust, printCompanyPerMeter: printComp, discount: 0 };
    return { ...base, discount: discountAmount(discountMode, discount, discountPct, computeOperation(base).customerSubtotal) };
  }, [state, lines, printEnabled, printCust, printComp, discount, discountMode, discountPct]);
  const totals = useMemo(() => draft ? computeOperation(draft) : null, [draft]);

  const teams = useMemo(() => [...new Set(lines.map(l => l.teamName))], [lines]);
  const adTypeOf = useMemo(() => new Map((op?.contracts || []).map(c => [c.number, c.adType || ''])), [op]);
  const sizes = useMemo(() => [...new Set(lines.map(l => l.size))], [lines]);
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return lines.filter(l => (team === 'all' || l.teamName === team)
      && (!s || l.name.toLowerCase().includes(s) || String(l.billboardId).includes(s) || l.size.toLowerCase().includes(s) || (l.landmark || '').toLowerCase().includes(s)));
  }, [lines, q, team]);

  const dirty = useMemo(() => {
    if (!state) return false;
    return JSON.stringify(lines) !== JSON.stringify(state.lines) || printEnabled !== state.draft.printEnabled
      || printCust !== state.draft.printCustomerPerMeter || printComp !== state.draft.printCompanyPerMeter
      || discountMode !== state.discountMode || (discountMode === 'percent' ? discountPct !== state.discountPercent : discount !== state.draft.discount) || discountReason !== state.discountReason || notes !== state.notes || printerId !== state.printerId;
  }, [state, lines, printEnabled, printCust, printComp, discount, discountMode, discountPct, discountReason, notes, printerId]);

  const update = (id: string, patch: Partial<EditorLine>) => setLines(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));

  const [scope, setScope] = useState<string>('visible');
  const applyBulk = () => {
    const ids = new Set(
      scope === 'selected' ? [...selected]
        : scope === 'visible' ? visible.map(l => l.id)
        : lines.filter(l => l.size === scope.replace(/^size:/, '')).map(l => l.id),
    );
    if (!ids.size) { toast.error('لا توجد لوحات ضمن النطاق المحدد'); return; }
    if (bulkMode === 'total') {
      const shares = smartDistribute(bulkValue, lines.filter(l => ids.has(l.id)).map(l => ({ id: l.id, weight: lineArea(l) })));
      setLines(prev => prev.map(l => !shares.has(l.id) ? l : bulkTarget === 'customer' ? { ...l, customer: shares.get(l.id)!, customerPerMeter: null } : { ...l, company: shares.get(l.id)!, companyPerMeter: null }));
      toast.success(`تم توزيع ${money(bulkValue)} على ${ids.size} لوحة حسب المساحة`);
      return;
    }
    if (bulkMode === 'table') {
      setLines(prev => prev.map(l => !ids.has(l.id) ? l : bulkTarget === 'customer' ? { ...l, customer: l.sizeInstallPrice, customerPerMeter: null } : { ...l, company: l.sizeInstallPrice, companyPerMeter: null }));
    } else {
      // سعر المتر على الزبون يُحفظ مع كل لوحة ليظهر في المحرر والفاتورة
      const rate = bulkTarget === 'customer' && bulkMode === 'meter' && bulkValue > 0 ? Math.round(bulkValue * 100) / 100 : null;
      setLines(prev => (applyBulkPrice(prev, ids, bulkTarget, bulkMode, bulkValue) as EditorLine[])
        .map(l => ids.has(l.id) && bulkTarget === 'customer' ? { ...l, customerPerMeter: rate } : l));
    }
    toast.success(`تم تطبيق السعر على ${ids.size} لوحة`);
  };

  const handleToggleLineFace = (line: EditorLine, face: number) => {
    const current = line.selectedFaces || Array.from({ length: line.faces }, (_, i) => i + 1);
    const selection = current.includes(face) ? current.filter(f => f !== face) : [...current, face];
    if (!selection.length) { toast.info('يجب اختيار وجه واحد على الأقل'); return; }
    setLines(previous => previous.map(l => l.id === line.id ? changeCostLineFaces(l, selection) : l));
  };

  const applyBulkFaces = (mode: 'single' | 'double' | 'max_available') => {
    const targetLines = scope === 'selected'
      ? lines.filter(l => selected.has(l.id))
      : scope === 'visible'
      ? visible
      : lines.filter(l => l.size === scope.replace(/^size:/, ''));

    if (!targetLines.length) {
      toast.error('لا توجد لوحات ضمن النطاق المحدد');
      return;
    }

    const targetIds = new Set(targetLines.map(l => l.id));
    let updatedCount = 0;

    setLines(prev => prev.map(l => {
      if (!targetIds.has(l.id)) return l;
      const max = l.maxFaces || 1;
      let targetFaces = 1;
      if (mode === 'single') targetFaces = 1;
      else if (mode === 'double') targetFaces = Math.min(2, max);
      else if (mode === 'max_available') targetFaces = max;

      const selection = Array.from({ length: targetFaces }, (_, i) => i + 1);
      updatedCount++;
      return changeCostLineFaces(l, selection);
    }));

    toast.success(`تم تحديث أوجه ${updatedCount} لوحة`);
  };

  const distributeCutout = () => {
    const active = lines.filter(l => l.hasCutout);
    if (!active.length) { toast.error('فعّل المجسم على لوحة واحدة على الأقل'); return; }
    const weights = active.map(l => ({ id: l.id, weight: lineArea(l) }));
    const cust = smartDistribute(cutTotalCust, weights);
    const comp = smartDistribute(cutTotalComp, weights);
    setLines(prev => prev.map(l => {
      if (!l.hasCutout) return l;
      const q = Math.max(1, Math.round(l.cutoutCount) || 1);
      return { ...l, cutoutCount: q, cutoutCustomerUnit: Math.round(((cust.get(l.id) || 0) / q) * 100) / 100, cutoutCompanyUnit: Math.round(((comp.get(l.id) || 0) / q) * 100) / 100 };
    }));
    toast.success(`تم التوزيع على ${active.length} لوحة`);
  };

  const close = async (o: boolean) => {
    if (!o && dirty && !saving) {
      const ok = await confirm({ title: 'تعديلات غير محفوظة', message: 'هل تريد الإغلاق دون حفظ التعديلات؟', confirmText: 'إغلاق دون حفظ' } as any);
      if (!ok) return;
    }
    onOpenChange(o);
  };

  const save = async () => {
    if (!state || !draft) return;
    if (printEnabled && !lines.some(l => l.inPrint)) { toast.error('اختر لوحة واحدة على الأقل للطباعة أو أوقف الطباعة'); setTab('print'); return; }
    setSaving(true);
    try {
      await saveEditor(state, lines, draft, { discountReason, notes, printerId, discountMode, discountPercent: discountPct });
      toast.success('تم حفظ التكاليف');
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const instIncluded = !!totals?.installation.included;
  const missingCustomer = useMemo(() => lines.filter(l => !(l.customer > 0)).length, [lines]);
  const printIncluded = !!totals?.print.included;

  const tabs: { key: Tab; label: string; icon: any; value?: string }[] = [
    { key: 'installation', label: 'التركيب', icon: Wrench, value: totals ? (instIncluded ? 'مشمول' : money(totals.installation.customer)) : '' },
    { key: 'print', label: 'الطباعة', icon: Printer, value: totals ? (!printEnabled ? 'متوقفة' : printIncluded ? 'مشمولة' : money(totals.print.customer)) : '' },
    { key: 'cutout', label: 'المجسمات', icon: Scissors, value: totals ? (totals.cutout.count ? money(totals.cutout.customer) : '—') : '' },  ];

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent dir="rtl" className="flex h-[95vh] max-h-[95vh] w-[95vw] max-w-[1360px] flex-col gap-0 overflow-hidden p-0 text-right">
        <header className="border-b border-border px-5 py-4 pl-12">
          <DialogTitle className="text-lg font-bold">تكاليف {op?.label}</DialogTitle>
          <DialogDescription className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-foreground">{op?.customerName}</span>
            {op?.contractIds.map(n => <span key={n} className="rounded-md border border-border px-2 py-0.5"><b className="tabular-nums">عقد #{n}</b>{adTypeOf.get(n) && <span className="text-muted-foreground"> · {adTypeOf.get(n)}</span>}</span>)}
            {op?.teams.map(t => <span key={t} className="rounded-md bg-muted px-2 py-0.5">{t}</span>)}
            {instIncluded && <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-400">التركيب مشمول بالعقد</span>}
            {printIncluded && <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-400">الطباعة مشمولة بالعقد</span>}
          </DialogDescription>
        </header>

        {error ? (
          <div className="p-8 text-center text-destructive">{error}</div>
        ) : !state || !totals ? (
          <div className="space-y-3 p-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : (
          <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="flex min-h-0 flex-col">
              <nav className="flex gap-1 overflow-x-auto border-b border-border px-3 pt-2" role="tablist">
                {tabs.map(t => (
                  <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
                    className={cn('flex shrink-0 items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-sm transition-colors',
                      tab === t.key ? 'border-primary font-bold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                    <t.icon className="h-4 w-4" />{t.label}
                    {t.value && <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] tabular-nums">{t.value}</span>}
                  </button>
                ))}
              </nav>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {tab === 'installation' && (
                  <div className="space-y-3">
                    {instIncluded && <IncludedBanner what="التركيب" contractValue={state.contractValues.installation} expense={totals.installation.contractExpense} />}

                    {!instIncluded && missingCustomer > 0 && (
                      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-amber-700 dark:text-amber-400">{missingCustomer} لوحة بلا سعر على الزبون</div>
                          <div className="text-xs text-muted-foreground">{state.draft.type === 'reinstallation' ? 'إعادة التركيب غير مشمولة بالعقد — ' : ''}حدّد سعر المتر أو المبلغ ثم اضغط «تطبيق».</div>
                        </div>
                        {state.suggested.installPerMeter > 0 && (
                          <Button size="sm" variant="outline" className="h-8 border-amber-500/50" onClick={() => {
                            const rate = state.suggested.installPerMeter;
                            const ids = new Set(lines.filter(l => !(l.customer > 0)).map(l => l.id));
                            setLines(prev => (applyBulkPrice(prev, ids, 'customer', 'meter', rate) as EditorLine[]).map(l => ids.has(l.id) ? { ...l, customerPerMeter: rate } : l));
                            toast.success(`تم تسعير ${ids.size} لوحة بـ ${rate} د.ل/م²`);
                          }}>تطبيق آخر سعر للزبون ({state.suggested.installPerMeter} د.ل/م²)</Button>
                        )}
                      </div>
                    )}

                    <section className="space-y-2.5 rounded-xl border border-border bg-muted/30 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="w-[88px] shrink-0 text-xs font-bold text-muted-foreground">تسعير جماعي</span>
                        <Select value={bulkTarget} onValueChange={v => setBulkTarget(v as BulkTarget)}>
                          <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="customer" disabled={instIncluded}>سعر الزبون</SelectItem>
                            <SelectItem value="company">تكلفة الفرقة</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={bulkMode} onValueChange={v => setBulkMode(v as any)}>
                          <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="piece">مبلغ لكل لوحة</SelectItem>
                            <SelectItem value="meter">سعر المتر × المساحة</SelectItem>
                            <SelectItem value="table">السعر الافتراضي للمقاس</SelectItem>
                            <SelectItem value="total">توزيع مبلغ إجمالي (حسب المساحة)</SelectItem>
                          </SelectContent>
                        </Select>
                        {bulkMode !== 'table' && <Num label="القيمة" value={bulkValue} onChange={setBulkValue} className="w-[110px]" />}
                        <Select value={scope} onValueChange={setScope}>
                          <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="visible">اللوحات الظاهرة ({visible.length})</SelectItem>
                            <SelectItem value="selected" disabled={!selected.size}>المحددة ({selected.size})</SelectItem>
                            {sizes.map(s => <SelectItem key={s} value={`size:${s}`}>مقاس {s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button size="sm" className="h-9 px-5" onClick={applyBulk}>تطبيق</Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-2.5">
                        <span className="w-[88px] shrink-0 text-xs font-bold text-muted-foreground">الأوجه</span>
                        <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
                          {([['single', 'وجه واحد'], ['double', 'وجهين'], ['max_available', 'حسب المتوفر']] as const).map(([m, label]) => (
                            <Button key={m} type="button" size="sm" variant="ghost" className="h-7 px-3 text-xs hover:bg-muted" onClick={() => applyBulkFaces(m)}>{label}</Button>
                          ))}
                        </div>
                        <span className="text-[11px] text-muted-foreground">على {scope === 'selected' ? `المحددة (${selected.size})` : scope === 'visible' ? `الظاهرة (${visible.length})` : `مقاس ${scope.replace(/^size:/, '')}`}</span>
                        <Button size="sm" variant="outline" className="h-8 ms-auto text-xs" title="سعر تركيب المقاس في الإعدادات (نصفه للوجه الواحد)" onClick={() => {
                          const missing = lines.filter(l => !l.sizeInstallPrice).length;
                          setLines(prev => prev.map(l => ({ ...l, company: l.sizeInstallPrice || l.company })));
                          toast.success(missing ? `تم جلب تكلفة الفرقة من الأسعار الافتراضية؛ ${missing} لوحة بلا سعر افتراضي لمقاسها` : 'تم جلب تكلفة الفرقة من الأسعار الافتراضية للمقاسات');
                        }}>تكلفة الفرقة الافتراضية</Button>
                      </div>
                    </section>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative min-w-[200px] flex-1">
                        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث باسم اللوحة أو الرقم أو المقاس" className="h-9 pr-9" />
                      </div>
                      {teams.length > 1 && (
                        <Select value={team} onValueChange={setTeam}>
                          <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">كل الفرق</SelectItem>
                            {teams.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <div className="rounded-xl border border-border">
                      <table className="w-full min-w-[900px] text-sm">
                        <thead className="sticky -top-4 z-10 bg-muted text-[11px] text-muted-foreground shadow-[0_1px_0_hsl(var(--border))]">
                          <tr>
                            <th className="w-10 p-2"><Checkbox aria-label="تحديد الكل" checked={visible.length > 0 && visible.every(l => selected.has(l.id))}
                              onCheckedChange={c => setSelected(c ? new Set(visible.map(l => l.id)) : new Set())} /></th>
                            <th className="p-2 text-right">اللوحة</th>
                            <th className="p-2">الأوجه</th>
                            <th className="p-2">سعر الزبون<div className="font-normal text-[10px] opacity-80">المبلغ / سعر المتر</div></th>
                            <th className="p-2">تكلفة الفرقة<div className="font-normal text-[10px] opacity-80">المبلغ / سعر المتر</div></th>
                            <th className="p-2">إضافي زبون</th>
                            <th className="p-2">إضافي شركة</th>
                            <th className="p-2 text-left">الربح</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visible.map(l => {
                            const noPrice = !instIncluded && !(l.customer > 0);
                            const area = lineArea(l);
                            const lineProfit = (instIncluded ? 0 : l.customer) + l.customerExtra - (instIncluded ? l.companyExtra : l.company + l.companyExtra);
                            return (
                            <tr key={l.id} className={cn('border-t border-border transition-colors hover:bg-muted/30', selected.has(l.id) && 'bg-primary/5')}>
                              <td className="p-2 text-center"><Checkbox aria-label={`تحديد ${l.name}`} checked={selected.has(l.id)}
                                onCheckedChange={c => setSelected(prev => { const n = new Set(prev); c ? n.add(l.id) : n.delete(l.id); return n; })} /></td>
                              <td className="p-2"><BoardCell l={l} extra={[teams.length > 1 ? l.teamName : '', op && op.contractIds.length > 1 && l.contractNumber ? `عقد #${l.contractNumber}${adTypeOf.get(l.contractNumber) ? ` · ${adTypeOf.get(l.contractNumber)}` : ''}` : ''].filter(Boolean).join(' · ')} /></td>
                              <td className="p-2 text-center"><FacesPicker l={l} onToggle={f => handleToggleLineFace(l, f)} /></td>
                              <td className="p-2 w-[130px] align-top">
                                <Num label="سعر الزبون" value={l.customer} disabled={instIncluded} onChange={v => update(l.id, { customer: v, customerPerMeter: null })}
                                  className={noPrice ? 'border-amber-500/70 bg-amber-500/5' : undefined} />
                                {!instIncluded && (
                                  <MeterRate label={`سعر متر الزبون — ${l.name}`} disabled={!(area > 0)} pinned={!!l.customerPerMeter}
                                    value={l.customerPerMeter || (area > 0 ? r2(l.customer / area) : 0)}
                                    onChange={v => update(l.id, { customer: r2(v * area), customerPerMeter: v > 0 ? v : null })} />
                                )}
                              </td>
                              <td className="p-2 w-[130px] align-top">
                                <Num label="تكلفة الفرقة" value={l.company} onChange={v => update(l.id, { company: v, companyPerMeter: null })} />
                                <MeterRate label={`سعر متر الفرقة — ${l.name}`} disabled={!(area > 0)} pinned={l.companyPerMeter != null}
                                  value={l.companyPerMeter ?? (area > 0 ? r2(l.company / area) : 0)}
                                  onChange={v => update(l.id, { company: r2(v * area), companyPerMeter: v > 0 ? v : null })} />
                                {l.sizeInstallPrice > 0 && l.company !== l.sizeInstallPrice && (
                                  <button type="button" className="mt-0.5 w-full text-center text-[10px] text-primary hover:underline" onClick={() => update(l.id, { company: l.sizeInstallPrice, companyPerMeter: null })}>الافتراضي {l.sizeInstallPrice}</button>
                                )}
                              </td>
                              <td className="p-2 w-[96px]"><Num label="إضافي زبون" value={l.customerExtra} onChange={v => update(l.id, { customerExtra: v })} className="text-muted-foreground" /></td>
                              <td className="p-2 w-[96px]"><Num label="إضافي شركة" value={l.companyExtra} onChange={v => update(l.id, { companyExtra: v })} className="text-muted-foreground" /></td>
                              <td className={cn('p-2 w-[96px] text-left text-xs font-semibold tabular-nums', instIncluded ? 'text-muted-foreground' : lineProfit < 0 ? 'text-destructive' : 'text-emerald-600')}>
                                {instIncluded ? 'مشمول' : money(lineProfit)}
                              </td>
                            </tr>
                            );
                          })}
                          {!visible.length && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">لا توجد لوحات</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {tab === 'print' && (
                  <div className="space-y-3">
                    <label className="flex items-center justify-between rounded-xl border border-border p-3">
                      <span className="font-semibold">تفعيل الطباعة لهذه العملية</span>
                      <Switch checked={printEnabled} onCheckedChange={setPrintEnabled} />
                    </label>
                    {printEnabled && (
                      <>
                        {printIncluded && <IncludedBanner what="الطباعة" contractValue={state.contractValues.print} expense={totals.print.contractExpense} />}
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">المطبعة</div>
                            <Select value={printerId || 'none'} onValueChange={v => setPrinterId(v === 'none' ? null : v)}>
                              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">بدون تحديد</SelectItem>
                                {state.printers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">سعر المتر على الزبون {printIncluded && '(مشمول)'}</div>
                            <Num label="سعر المتر على الزبون" value={printCust} disabled={printIncluded} onChange={setPrintCust} />
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">تكلفة المتر على الشركة</div>
                            <Num label="تكلفة المتر على الشركة" value={printComp} onChange={setPrintComp} />
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{totals.print.boards} لوحة · <b className="text-foreground"><Area value={totals.print.area} /></b></span>
                          <span className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setLines(p => p.map(l => ({ ...l, inPrint: true })))}>تحديد الكل</Button>
                            <Button variant="outline" size="sm" onClick={() => setLines(p => p.map(l => ({ ...l, inPrint: false })))}>إلغاء الكل</Button>
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                          <span>السعر العام أعلاه يُطبَّق على كل لوحة. لتسعير لوحة بسعر متر مختلف عدّل الحقل أمامها؛ <b className="text-primary">الأزرق</b> = سعر خاص.</span>
                          {lines.some(l => l.printCustomerPerMeter != null || l.printCompanyPerMeter != null) && (
                            <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setLines(p => p.map(l => ({ ...l, printCustomerPerMeter: null, printCompanyPerMeter: null })))}>توحيد الكل على السعر العام</Button>
                          )}
                        </div>
                        <div className="grid gap-2 xl:grid-cols-2">
                          {lines.map(l => {
                            const area = lineArea(l);
                            const cRate = linePrintRate(l, { printCustomerPerMeter: printCust, printCompanyPerMeter: printComp }, 'customer');
                            const kRate = linePrintRate(l, { printCustomerPerMeter: printCust, printCompanyPerMeter: printComp }, 'company');
                            // يُحفظ كسعر خاص فقط إذا اختلف عن السعر العام
                            const pin = (v: number, def: number) => (Math.abs(v - def) < 0.005 ? null : v);
                            return (
                              <div key={l.id} className={cn('flex items-center gap-2 rounded-lg border p-2 text-sm transition-colors', l.inPrint ? 'border-primary/50 bg-primary/5' : 'border-border opacity-60')}>
                                <Checkbox checked={l.inPrint} onCheckedChange={c => update(l.id, { inPrint: !!c })} aria-label={`طباعة ${l.name}`} />
                                <div className="min-w-0 flex-1"><BoardCell l={l} /></div>
                                <div className="shrink-0 text-center text-xs tabular-nums">
                                  <div className="font-semibold"><Area value={area} /></div>
                                  <div className="text-muted-foreground">{l.faces} وجه</div>
                                </div>
                                {l.inPrint && (
                                  <div className="grid w-[150px] shrink-0 gap-0.5">
                                    {!printIncluded && (
                                      <div>
                                        <div className="text-[10px] text-muted-foreground">متر الزبون</div>
                                        <MeterRate label={`سعر متر الطباعة على الزبون — ${l.name}`} pinned={l.printCustomerPerMeter != null} value={cRate}
                                          onChange={v => update(l.id, { printCustomerPerMeter: pin(v, printCust) })} onReset={() => update(l.id, { printCustomerPerMeter: null })} />
                                      </div>
                                    )}
                                    <div>
                                      <div className="text-[10px] text-muted-foreground">متر الشركة</div>
                                      <MeterRate label={`تكلفة متر الطباعة على الشركة — ${l.name}`} pinned={l.printCompanyPerMeter != null} value={kRate}
                                        onChange={v => update(l.id, { printCompanyPerMeter: pin(v, printComp) })} onReset={() => update(l.id, { printCompanyPerMeter: null })} />
                                    </div>
                                    <div className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                                      {!printIncluded && <>زبون <b className="text-foreground">{money(area * cRate)}</b> · </>}شركة {money(area * kRate)}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {tab === 'cutout' && (
                  <div className="space-y-3">
                    <section className="rounded-xl border border-border bg-muted/30 p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-bold text-muted-foreground">إجمالي المجسمات — يوزَّع تلقائياً على اللوحات المفعّلة حسب المساحة وبأرقام مقرّبة</div>
                        <div className="text-xs text-muted-foreground">{lines.filter(l => l.hasCutout).length} لوحة مفعّلة · {totals.cutout.count} مجسم</div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                        <div className="space-y-1"><div className="text-xs">الإجمالي على الزبون</div><Num label="إجمالي المجسمات على الزبون" value={cutTotalCust} onChange={setCutTotalCust} /></div>
                        <div className="space-y-1"><div className="text-xs">الإجمالي على الشركة</div><Num label="إجمالي المجسمات على الشركة" value={cutTotalComp} onChange={setCutTotalComp} /></div>
                        <Button className="h-9" onClick={distributeCutout}>توزيع ذكي</Button>
                      </div>
                    </section>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setLines(p => p.map(l => ({ ...l, hasCutout: true })))}>تفعيل الكل</Button>
                      <Button variant="outline" size="sm" onClick={() => setLines(p => p.map(l => ({ ...l, hasCutout: false })))}>إلغاء الكل</Button>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full min-w-[760px] text-sm">
                        <thead className="bg-muted/50 text-xs text-muted-foreground">
                          <tr><th className="p-2">مجسم</th><th className="p-2 text-right">اللوحة</th><th className="p-2">العدد</th><th className="p-2">الوحدة للزبون</th><th className="p-2">الوحدة على الشركة</th><th className="p-2">الإجمالي (زبون / شركة)</th></tr>
                        </thead>
                        <tbody>
                          {lines.map(l => (
                            <tr key={l.id} className={cn('border-t border-border', !l.hasCutout && 'opacity-60')}>
                              <td className="p-2 text-center"><Switch checked={l.hasCutout} onCheckedChange={c => update(l.id, { hasCutout: c })} aria-label={`مجسم ${l.name}`} /></td>
                              <td className="p-2"><BoardCell l={l} /></td>
                              <td className="p-2 w-[80px]"><Num label="العدد" value={l.cutoutCount} disabled={!l.hasCutout} onChange={v => update(l.id, { cutoutCount: Math.max(1, Math.round(v)) })} /></td>
                              <td className="p-2 w-[110px]"><Num label="سعر الوحدة للزبون" value={l.cutoutCustomerUnit} disabled={!l.hasCutout} onChange={v => update(l.id, { cutoutCustomerUnit: v })} /></td>
                              <td className="p-2 w-[110px]"><Num label="تكلفة الوحدة على الشركة" value={l.cutoutCompanyUnit} disabled={!l.hasCutout} onChange={v => update(l.id, { cutoutCompanyUnit: v })} /></td>
                              <td className="p-2 text-center text-xs tabular-nums">{l.hasCutout ? <>{money(Math.max(1, l.cutoutCount) * l.cutoutCustomerUnit)}<div className="text-muted-foreground">{money(Math.max(1, l.cutoutCount) * l.cutoutCompanyUnit)}</div></> : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
            </div>

            <aside className="flex min-h-0 flex-col border-t border-border bg-muted/20 lg:border-r lg:border-t-0">
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <table className="w-full text-sm">
                  <thead className="text-[11px] text-muted-foreground"><tr><th className="pb-2 text-right">الخدمة</th><th className="pb-2 text-left">على الزبون</th><th className="pb-2 text-left">تكلفة التنفيذ</th></tr></thead>
                  <tbody className="tabular-nums">
                    {[
                      { label: 'التركيب', s: totals.installation, show: true },
                      { label: 'الطباعة', s: totals.print, show: printEnabled },
                      { label: 'المجسمات', s: totals.cutout, show: totals.cutout.count > 0 },
                    ].filter(r => r.show).map(r => (
                      <tr key={r.label} className="border-t border-border/60">
                        <td className="py-2">{r.label}{r.s.included && <span className="mr-1 rounded bg-emerald-500/10 px-1 text-[10px] text-emerald-700 dark:text-emerald-400">مشمول</span>}</td>
                        <td className="py-2 text-left">{money(r.s.customer)}</td>
                        <td className="py-2 text-left text-muted-foreground">{money(r.s.company)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <dl className="space-y-2.5 rounded-xl border border-border bg-card p-3 text-sm tabular-nums">
                  <div className="flex justify-between"><dt className="text-muted-foreground">إجمالي الزبون</dt><dd>{money(totals.customerSubtotal)}</dd></div>
                  <div className="space-y-1.5 rounded-lg bg-muted/40 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="flex items-center gap-1.5 text-muted-foreground"><Percent className="h-3.5 w-3.5" />الخصم</dt>
                      <dd className="flex items-center gap-1.5">
                        <div role="radiogroup" aria-label="طريقة الخصم" className="flex rounded-md border border-border bg-background p-0.5 text-[11px]">
                          {([['amount', 'د.ل'], ['percent', '%']] as const).map(([m, label]) => (
                            <button key={m} type="button" role="radio" aria-checked={discountMode === m}
                              onClick={() => {
                                if (m === discountMode) return;
                                const sub = totals.customerSubtotal;
                                if (m === 'percent') setDiscountPct(sub > 0 ? Math.round((totals.discount / sub) * 10000) / 100 : 0);
                                else setDiscount(totals.discount);
                                setDiscountMode(m);
                              }}
                              className={cn('h-6 min-w-[32px] rounded px-1.5 font-semibold transition-colors', discountMode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                              {label}
                            </button>
                          ))}
                        </div>
                        {discountMode === 'percent'
                          ? <Num label="نسبة الخصم" value={discountPct} onChange={v => setDiscountPct(Math.min(100, v))} className={cn('h-8 w-[80px] bg-background', discountPct > 0 && 'border-amber-500/60 text-amber-700 dark:text-amber-400')} />
                          : <Num label="مبلغ الخصم" value={discount} onChange={setDiscount} className={cn('h-8 w-[100px] bg-background', discount > 0 && 'border-amber-500/60 text-amber-700 dark:text-amber-400')} />}
                      </dd>
                    </div>
                    {totals.discount > 0 && (
                      <div className="flex justify-between text-[11px] text-amber-700 dark:text-amber-400">
                        <span>{discountMode === 'percent' ? `${discountPct}% من ${money(totals.customerSubtotal)}` : totals.customerSubtotal > 0 ? `${Math.round((totals.discount / totals.customerSubtotal) * 1000) / 10}% من الإجمالي` : ''}</span>
                        <span className="font-semibold">− {money(totals.discount)}</span>
                      </div>
                    )}
                    {(totals.discount > 0 || discountReason) && (
                      <Input value={discountReason} onChange={e => setDiscountReason(e.target.value)} placeholder="سبب الخصم" aria-label="سبب الخصم" className="h-8 bg-background text-xs" />
                    )}
                    {discountMode === 'amount' && discount > totals.customerSubtotal && <div className="text-[11px] text-amber-600">أكبر من الإجمالي؛ سيُطبَّق بحد {money(totals.customerSubtotal)}.</div>}
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 text-base font-bold"><dt>المستحق على الزبون</dt><dd>{money(totals.customerTotal)}</dd></div>
                </dl>

                <dl className="space-y-2 rounded-xl border border-border bg-card p-3 text-sm tabular-nums">
                  <div className="flex justify-between"><dt className="text-muted-foreground">تكلفة التنفيذ الكلية</dt><dd>{money(totals.companyTotal)}</dd></div>
                  {totals.contractExpense > 0 && (
                    <div className="flex justify-between text-emerald-700 dark:text-emerald-400"><dt>منها مصروف على العقد</dt><dd>{money(totals.contractExpense)}</dd></div>
                  )}
                  <div className="flex justify-between"><dt className="text-muted-foreground">تكلفة المهمة</dt><dd>{money(totals.taskCost)}</dd></div>
                  <div className={cn('flex justify-between border-t border-border pt-2 text-base font-bold', totals.profit < 0 ? 'text-destructive' : 'text-emerald-600')}>
                    <dt>ربح المهمة</dt><dd>{money(totals.profit)}{totals.customerTotal > 0 && <span className="mr-1 text-xs font-normal">({totals.margin}%)</span>}</dd>
                  </div>
                  {!instIncluded && missingCustomer > 0 && (
                    <button type="button" onClick={() => setTab('installation')} className="w-full rounded-md bg-amber-500/10 px-2 py-1 text-right text-[11px] text-amber-700 hover:bg-amber-500/20 dark:text-amber-400">
                      {missingCustomer} لوحة بلا سعر على الزبون — لم يُحتسب لها مستحق
                    </button>
                  )}
                </dl>
                <div className="space-y-1.5 rounded-xl border border-border bg-card p-3">
                  <div className="text-xs font-semibold text-muted-foreground">ملاحظات</div>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="ملاحظات على العملية…" aria-label="ملاحظات" className="resize-none bg-background text-sm" />
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  ربح المهمة = المستحق على الزبون − تكلفة الخدمات غير المشمولة. تكلفة الخدمات المشمولة في العقد تُحمَّل على العقد نفسه.
                </p>
              </div>
              <footer className="flex gap-2 border-t border-border p-3">
                <Button className="h-11 flex-1" onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  حفظ التكاليف{dirty && <span className="h-2 w-2 rounded-full bg-amber-400" aria-label="توجد تعديلات" />}
                </Button>
                <Button variant="outline" className="h-11" onClick={() => close(false)} disabled={saving}>إغلاق</Button>
              </footer>
            </aside>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
