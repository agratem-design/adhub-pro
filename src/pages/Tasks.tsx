import { usePersistedState } from '@/hooks/usePersistedState';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { CheckCircle2, Clock, ClipboardList, FileText, ListTodo, Loader2, Pencil, PlayCircle, Plus, Save, Search, Trash2, X, XCircle } from 'lucide-react';
import { TaskCompletionDialog } from '@/components/tasks/TaskCompletionDialog';
import { WeeklyChecklist, isWeeklyTask } from '@/components/tasks/WeeklyChecklist';
import { LetterPreview, MODE_HINT, PrintMenu } from '@/components/correspondence/LetterParts';
import { preparePrintWindow, writePrintWindow } from '@/utils/printWindowHelper';
import { PRINT_MODE_LABELS, loadCompanies, renderLetterHtml, type Letter, type LetterPrintMode, type RenderOptions } from '@/services/correspondence';

export interface Task {
  id: string;
  title: string;
  description?: string;
  due_date: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  completion_notes?: string;
  completion_result?: 'completed' | 'not_completed';
  cancellation_reason?: string;
  completed_at?: string;
  created_at: string;
}

type Filter = 'all' | 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'overdue';
type Draft = Partial<Task> & { title: string; due_date: string; priority: Task['priority']; status: Task['status'] };

const PRIORITY: Record<Task['priority'], { label: string; cls: string }> = {
  high: { label: 'عالية', cls: 'bg-destructive/15 text-destructive' },
  medium: { label: 'متوسطة', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  low: { label: 'منخفضة', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
};
const STATUS: Record<Task['status'], { label: string; cls: string }> = {
  pending: { label: 'قيد الانتظار', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  in_progress: { label: 'قيد التنفيذ', cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  completed: { label: 'مكتملة', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  cancelled: { label: 'ملغاة', cls: 'bg-muted text-muted-foreground' },
};
const TASK_LAYOUT: RenderOptions = { paginate: true, markup: true, alwaysPageNumbers: true };
const todayIso = () => new Date().toISOString().slice(0, 10);
const dmy = (s?: string) => (s ? s.slice(0, 10).split('-').reverse().join('/') : '');
const isOpen = (t: Pick<Task, 'status'>) => t.status === 'pending' || t.status === 'in_progress';
const isOverdue = (t: Pick<Task, 'status' | 'due_date'>) => isOpen(t) && String(t.due_date).slice(0, 10) < todayIso();
const emptyDraft = (): Draft => ({ title: '', description: '', due_date: todayIso(), priority: 'medium', status: 'pending' });
const cellText = (s?: string | null) => String(s || '').replace(/\|/g, '/').replace(/\n+/g, ' ').trim();

/** المهمة على ورقة الترويسة: جدول البيانات ثم التفاصيل */
function taskBody(t: Draft): string {
  const rows = [
    ['الأولوية', PRIORITY[t.priority].label],
    ['الحالة', STATUS[t.status].label],
    ['تاريخ الاستحقاق', dmy(t.due_date)],
    ...(t.completed_at ? [['تاريخ الإنجاز', dmy(t.completed_at)]] : []),
  ];
  const parts = ['| البند | التفاصيل |', '|---|---|', ...rows.map(([a, b]) => `| ${a} | ${b} |`)];
  if (t.description?.trim()) parts.push('', '### التفاصيل', t.description.trim());
  if (t.completion_notes?.trim()) parts.push('', '### ملاحظات الإنجاز', t.completion_notes.trim());
  if (t.cancellation_reason?.trim()) parts.push('', '### سبب عدم الإنجاز', t.cancellation_reason.trim());
  return parts.join('\n');
}
/** قائمة المهمات على ورقة الترويسة */
function listBody(tasks: Task[]): string {
  return ['| # | المهمة | الموعد | الأولوية | الحالة |', '|---|---|---|---|---|',
    ...tasks.map((t, i) => `| ${i + 1} | ${cellText(t.title)}${isOverdue(t) ? ' (متأخرة)' : ''} | ${dmy(t.due_date)} | ${PRIORITY[t.priority]?.label || ''} | ${STATUS[t.status]?.label || ''} |`)].join('\n');
}

export default function Tasks() {
  const qc = useQueryClient();
  const { confirm } = useSystemDialog();
  const { canEdit } = useAuth();
  const canEditSection = canEdit('tasks');
  const [filter, setFilter] = usePersistedState<Filter>('tasks.filter', 'all');
  const [mode, setMode] = usePersistedState<LetterPrintMode>('tasks.mode', 'full');
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [baseline, setBaseline] = useState('');
  const [pages, setPages] = useState(1);
  const [completing, setCompleting] = useState<Task | null>(null);
  const dirty = !!draft && JSON.stringify(draft) !== baseline;
  const open = (d: Draft | null) => { setBaseline(d ? JSON.stringify(d) : ''); setDraft(d); };
  const set = (patch: Partial<Draft>) => setDraft(d => (d ? { ...d, ...patch } : d));

  const { data: allTasks = [], isLoading, error } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('*').order('due_date', { ascending: true });
      if (error) throw error;
      return data as Task[];
    },
  });
  // المهمات الأسبوعية الثابتة لها لوحتها الخاصة أعلى الصفحة
  const tasks = useMemo(() => allTasks.filter(t => !isWeeklyTask(t)), [allTasks]);
  const companiesQ = useQuery({ queryKey: ['letterhead-companies'], queryFn: loadCompanies });
  const company = (companiesQ.data || []).find(c => c.is_default) || companiesQ.data?.[0] || null;

  const saveTask = useMutation({
    mutationFn: async (t: Partial<Task>) => {
      const { id, created_at, ...fields } = t as Task;
      const payload = { ...fields, due_date: fields.due_date ? new Date(`${String(fields.due_date).slice(0, 10)}T12:00:00`).toISOString() : fields.due_date };
      const res = id
        ? await supabase.from('tasks').update(payload).eq('id', id).select().single()
        : await supabase.from('tasks').insert([payload]).select().single();
      if (res.error) throw res.error;
      return res.data as Task;
    },
    onSuccess: (saved, vars) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(vars.id ? 'تم تحديث المهمة' : 'تمت إضافة المهمة');
      if (draft && (draft.id === saved.id || !draft.id)) open({ ...saved, due_date: String(saved.due_date).slice(0, 10) });
    },
    onError: (e: any) => toast.error('فشل حفظ المهمة: ' + e.message),
  });
  const deleteTask = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('tasks').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); toast.success('تم حذف المهمة'); },
    onError: (e: any) => toast.error('فشل حذف المهمة: ' + e.message),
  });

  const counts = useMemo(() => ({
    all: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    cancelled: tasks.filter(t => t.status === 'cancelled').length,
    overdue: tasks.filter(isOverdue).length,
  }), [tasks]);
  const list = useMemo(() => {
    const s = q.trim();
    return tasks.filter(t => (filter === 'all' || (filter === 'overdue' ? isOverdue(t) : t.status === filter))
      && (!s || [t.title, t.description, t.completion_notes].some(v => String(v || '').includes(s))));
  }, [tasks, filter, q]);

  const letterOf = (subject: string, body: string, date = todayIso()): Letter => ({
    company_id: company?.id || '', reference_number: `T-${date.replace(/-/g, '')}`, letter_date: date,
    recipient: '', greeting: '', subject, body, closing: '', signer_name: company?.signer_name || '', signer_title: company?.signer_title || '',
    with_stamp: false, with_signature: false,
  });
  const html = useMemo(() => (company && draft ? renderLetterHtml(company, letterOf(draft.title || 'مهمة', taskBody(draft)), window.location.origin, { ...TASK_LAYOUT, mode }) : ''), [company, draft, mode]);

  const printLetter = (l: Letter, m: LetterPrintMode, title: string) => {
    if (!company) { toast.error('أضف شركة من صفحة المراسلات الرسمية لاستخدام الترويسة'); return; }
    const w = preparePrintWindow(title);
    writePrintWindow(w, renderLetterHtml(company, l, window.location.origin, { ...TASK_LAYOUT, mode: m }), { title, showDownloadPdf: true, showShare: true, autoPrint: false });
  };
  const printTask = (t: Draft, m: LetterPrintMode = 'full') => printLetter(letterOf(t.title || 'مهمة', taskBody(t)), m, `مهمة - ${t.title}`);
  const printList = (m: LetterPrintMode) => {
    if (!list.length) { toast.info('لا توجد مهمات لطباعتها'); return; }
    const label = filter === 'all' ? 'قائمة المهمات' : filter === 'overdue' ? 'المهمات المتأخرة' : `المهمات ${STATUS[filter].label}`;
    printLetter(letterOf(label, listBody(list)), m, label);
  };

  const closeDraft = async () => {
    if (dirty && !(await confirm({ title: 'تعديلات غير محفوظة', message: 'أغلق المهمة بدون حفظ التعديلات؟', confirmText: 'إغلاق بدون حفظ', cancelText: 'متابعة التعديل', variant: 'destructive' } as any))) return false;
    open(null); return true;
  };
  const save = (andPrint: LetterPrintMode | false = false) => {
    if (!draft) return;
    if (!draft.title.trim()) { toast.error('عنوان المهمة مطلوب'); return; }
    saveTask.mutate(draft as Partial<Task>, { onSuccess: saved => { if (andPrint) printTask({ ...saved, due_date: String(saved.due_date).slice(0, 10) } as Draft, andPrint); } });
  };
  const remove = async (t: Task) => {
    if (!(await confirm({ title: 'حذف المهمة', message: `حذف المهمة «${t.title}»؟`, confirmText: 'حذف', variant: 'destructive' } as any))) return;
    deleteTask.mutate(t.id);
    if (draft?.id === t.id) open(null);
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'الكل' }, { key: 'overdue', label: 'متأخرة' }, { key: 'pending', label: 'قيد الانتظار' },
    { key: 'in_progress', label: 'قيد التنفيذ' }, { key: 'completed', label: 'مكتملة' }, { key: 'cancelled', label: 'ملغاة' },
  ];

  return (
    <div dir="rtl" className="mx-auto max-w-[1800px] space-y-6 p-4 text-right md:p-6 [&_button]:cursor-pointer [&_button]:transition-all [&_button]:duration-200 [&_[role=combobox]]:cursor-pointer">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-card p-5 shadow-sm md:p-6">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary"><ListTodo className="h-6 w-6" /></span>المهمات</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">سجّل مهماتك وتابع تنفيذها، واطبع المهمة أو القائمة على ترويسة الشركة.</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 lg:w-auto">
          {!draft && <PrintMenu label="طباعة القائمة" onPrint={printList} />}
          {canEditSection && <Button onClick={async () => { if (!draft || await closeDraft()) open(emptyDraft()); }}><Plus className="h-4 w-4" />مهمة جديدة</Button>}
        </div>
      </header>

      {error && <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{(error as Error).message}</div>}

      {!draft && !isLoading && <WeeklyChecklist tasks={allTasks} canEdit={canEditSection} />}

      {!draft && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'إجمالي المهمات', value: counts.all, icon: ClipboardList, f: 'all' as Filter },
          { label: 'قيد الانتظار', value: counts.pending, icon: Clock, f: 'pending' as Filter },
          { label: 'قيد التنفيذ', value: counts.in_progress, icon: PlayCircle, f: 'in_progress' as Filter },
          { label: 'متأخرة', value: counts.overdue, icon: XCircle, f: 'overdue' as Filter },
        ].map(({ label, value, icon: Icon, f }) => (
          <button key={label} type="button" onClick={() => setFilter(f)} className={cn('flex items-center gap-3 rounded-xl border bg-card p-4 text-right hover:border-primary/50', filter === f ? 'border-primary' : 'border-border')}>
            <Icon className={cn('h-5 w-5 shrink-0', f === 'overdue' && value ? 'text-destructive' : 'text-primary')} />
            <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{isLoading ? '—' : value}</p></div>
          </button>
        ))}
      </div>}

      {draft ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="min-w-0 space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm md:p-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold"><FileText className="h-4 w-4 text-primary" />{draft.id ? 'تعديل المهمة' : 'مهمة جديدة'}</h2>
              <div className="flex items-center gap-2">
                {dirty && <span className="text-xs text-amber-700 dark:text-amber-400">● غير محفوظة</span>}
                <Button variant="ghost" size="sm" onClick={closeDraft}><X className="h-4 w-4" />إغلاق</Button>
              </div>
            </div>
            <label className="block space-y-1 text-sm">عنوان المهمة<Input value={draft.title} onChange={e => set({ title: e.target.value })} placeholder="اكتب عنواناً واضحاً للمهمة" disabled={!canEditSection} /></label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-sm">تاريخ الاستحقاق<Input type="date" value={String(draft.due_date).slice(0, 10)} onChange={e => set({ due_date: e.target.value })} disabled={!canEditSection} /></label>
              <label className="space-y-1 text-sm">الأولوية
                <Select value={draft.priority} onValueChange={v => set({ priority: v as Task['priority'] })} disabled={!canEditSection}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(PRIORITY) as Task['priority'][]).map(k => <SelectItem key={k} value={k}>{PRIORITY[k].label}</SelectItem>)}</SelectContent>
                </Select>
              </label>
              <label className="space-y-1 text-sm">الحالة
                <Select value={draft.status} onValueChange={v => set({ status: v as Task['status'] })} disabled={!canEditSection}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(STATUS) as Task['status'][]).map(k => <SelectItem key={k} value={k}>{STATUS[k].label}</SelectItem>)}</SelectContent>
                </Select>
              </label>
            </div>
            <label className="block space-y-1.5 text-sm"><span className="font-semibold">تفاصيل المهمة</span>
              <Textarea rows={10} value={draft.description || ''} onChange={e => set({ description: e.target.value })} placeholder="الخطوات، الملاحظات، المسؤول… (يمكن استخدام - للقوائم و| للجداول)" disabled={!canEditSection} />
            </label>
            {(draft.status === 'completed' || draft.status === 'cancelled') && (
              <label className="block space-y-1 text-sm">{draft.status === 'completed' ? 'ملاحظات الإنجاز' : 'سبب الإلغاء'}
                <Textarea rows={3} value={(draft.status === 'completed' ? draft.completion_notes : draft.cancellation_reason) || ''} onChange={e => set(draft.status === 'completed' ? { completion_notes: e.target.value } : { cancellation_reason: e.target.value })} disabled={!canEditSection} />
              </label>
            )}
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
              {canEditSection && <Button variant="outline" disabled={saveTask.isPending} onClick={() => save(false)}>{saveTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}حفظ</Button>}
              {canEditSection ? <PrintMenu label="حفظ وطباعة" onPrint={m => save(m)} /> : <PrintMenu onPrint={m => printTask(draft, m)} />}
            </div>
          </section>
          <section className="min-w-0 space-y-3 self-start rounded-2xl border border-border bg-muted/30 p-3 md:p-4 xl:sticky xl:top-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-muted-foreground">معاينة الطباعة <span className="ms-2 text-xs font-normal">A4 — {pages} {pages > 2 ? 'صفحات' : pages === 2 ? 'صفحتان' : 'صفحة'}</span></div>
              <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
                {(Object.keys(PRINT_MODE_LABELS) as LetterPrintMode[]).map(m => (
                  <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m} className={cn('min-h-10 rounded-md px-3 py-1.5 font-medium transition-colors', mode === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{PRINT_MODE_LABELS[m]}</button>
                ))}
              </div>
            </div>
            {company ? <LetterPreview html={html} onFit={f => setPages(f.pages)} />
              : <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">{companiesQ.isLoading ? 'جارٍ تحميل الترويسة…' : 'أضف شركة من صفحة «المراسلات الرسمية» لتظهر المعاينة على الترويسة.'}</div>}
            <p className="text-xs text-muted-foreground">{MODE_HINT[mode]}</p>
          </section>
        </div>
      ) : (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap gap-1">
              {FILTERS.map(f => (
                <button key={f.key} type="button" onClick={() => setFilter(f.key)} aria-pressed={filter === f.key}
                  className={cn('min-h-9 rounded-lg border px-3 text-sm', filter === f.key ? 'border-primary bg-primary/10 font-semibold' : 'border-border hover:bg-muted')}>
                  {f.label} <span className="tabular-nums text-xs text-muted-foreground">({counts[f.key]})</span>
                </button>
              ))}
            </div>
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} aria-label="البحث في المهمات" placeholder="ابحث في العنوان أو التفاصيل…" className="h-11 pr-9 pl-10" />
              {q && <Button variant="ghost" size="icon" aria-label="مسح البحث" className="absolute left-1 top-1/2 h-9 w-9 -translate-y-1/2" onClick={() => setQ('')}><X className="h-4 w-4" /></Button>}
            </div>
          </div>
          {isLoading ? <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
            : !list.length ? <div className="flex flex-col items-center rounded-2xl border border-dashed border-primary/30 bg-card px-5 py-14 text-center">
              <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ListTodo className="h-8 w-8" /></span>
              <h3 className="text-lg font-bold">{q.trim() || filter !== 'all' ? 'لا توجد مهمات مطابقة' : 'ابدأ مهمتك الأولى'}</h3>
              {canEditSection && !q.trim() && filter === 'all' && <Button className="mt-5" onClick={() => open(emptyDraft())}><Plus className="h-4 w-4" />مهمة جديدة</Button>}
            </div>
            : (
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full text-sm">
                  <thead className="hidden bg-muted/50 text-xs text-muted-foreground md:table-header-group">
                    <tr><th className="p-3 text-right">الموعد</th><th className="p-3 text-right">المهمة</th><th className="p-3 text-right">الأولوية / الحالة</th><th className="p-3 text-left">الإجراءات</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {list.map(t => {
                      const late = isOverdue(t);
                      const days = Math.round((Date.parse(todayIso()) - Date.parse(String(t.due_date).slice(0, 10))) / 86_400_000);
                      return (
                        <tr key={t.id} className={cn('grid grid-cols-2 p-3 transition-colors hover:bg-primary/5 md:table-row md:p-0', late && 'bg-destructive/5')}>
                          <td className="p-2 tabular-nums md:p-3">
                            <div className="font-bold">{dmy(t.due_date)}</div>
                            {isOpen(t) && <div className={cn('text-xs', late ? 'text-destructive' : days === 0 ? 'text-amber-600' : 'text-muted-foreground')}>{late ? `متأخرة ${days} يوم` : days === 0 ? 'اليوم' : `بعد ${-days} يوم`}</div>}
                          </td>
                          <td className="col-span-2 p-2 md:p-3">
                            <button type="button" className="text-right font-semibold hover:underline" onClick={() => open({ ...t, due_date: String(t.due_date).slice(0, 10) })}>{t.title}</button>
                            {t.description && <div className="line-clamp-1 text-xs text-muted-foreground">{t.description}</div>}
                          </td>
                          <td className="p-2 md:p-3">
                            <div className="flex flex-wrap gap-1 text-xs">
                              <span className={cn('rounded-md px-2 py-0.5', PRIORITY[t.priority]?.cls)}>{PRIORITY[t.priority]?.label}</span>
                              <span className={cn('rounded-md px-2 py-0.5', STATUS[t.status]?.cls)}>{STATUS[t.status]?.label}</span>
                            </div>
                          </td>
                          <td className="col-span-2 p-2 md:p-3">
                            <div className="flex flex-wrap items-center justify-end gap-1">
                              {canEditSection && t.status === 'pending' && <Button size="sm" variant="outline" className="h-8" onClick={() => saveTask.mutate({ id: t.id, status: 'in_progress' })}><PlayCircle className="h-3.5 w-3.5" />بدء</Button>}
                              {canEditSection && isOpen(t) && <Button size="sm" variant="outline" className="h-8" onClick={() => setCompleting(t)}><CheckCircle2 className="h-3.5 w-3.5" />إتمام</Button>}
                              <Button size="sm" variant="outline" className="h-8" onClick={() => open({ ...t, due_date: String(t.due_date).slice(0, 10) })}><Pencil className="h-3.5 w-3.5" />{canEditSection ? 'تعديل' : 'عرض'}</Button>
                              <PrintMenu size="sm" onPrint={m => printTask({ ...t, due_date: String(t.due_date).slice(0, 10) }, m)} />
                              {canEditSection && <Button size="sm" variant="ghost" aria-label={`حذف المهمة ${t.title}`} title="حذف المهمة" className="h-10 w-10 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => remove(t)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </section>
      )}

      <TaskCompletionDialog
        open={!!completing}
        onOpenChange={o => { if (!o) setCompleting(null); }}
        selectedCount={1}
        onComplete={(result, notes, reason) => {
          if (!completing) return;
          saveTask.mutate({
            id: completing.id,
            status: result === 'completed' ? 'completed' : 'cancelled',
            completion_result: result,
            completion_notes: notes,
            cancellation_reason: reason,
            completed_at: new Date().toISOString(),
          });
          setCompleting(null);
        }}
      />
    </div>
  );
}
