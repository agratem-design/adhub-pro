import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarCheck, Check, ExternalLink, Wallet, Trash2, Hammer, FileBarChart2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { Task } from '@/pages/Tasks';

/**
 * المهمات الأسبوعية الثابتة: تُنشأ تلقائياً لكل أسبوع (من السبت إلى الجمعة) في جدول المهمات نفسه،
 * وتُعلَّم ✓ عند إنجازها، مع سجل الأسابيع السابقة للفحص الدوري.
 */
export const WEEKLY_ITEMS = [
  { key: 'payments', title: 'مراجعة الدفعات والمتأخرات', path: '/admin/alerts-center', icon: Wallet },
  { key: 'removal', title: 'متابعة الإزالة', path: '/admin/removal-tasks', icon: Trash2 },
  { key: 'installation', title: 'متابعة التركيب', path: '/admin/composite-tasks', icon: Hammer },
  { key: 'reports', title: 'إعداد التقرير الأسبوعي', path: '/admin/periodic-reports', icon: FileBarChart2 },
] as const;
type ItemKey = typeof WEEKLY_ITEMS[number]['key'];

const TAG = (week: string, key: string) => `[weekly:${key}:${week}]`;
const TAG_RE = /\[weekly:([a-z]+):(\d{4}-\d{2}-\d{2})\]/;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dmy = (s: string) => s.split('-').reverse().slice(0, 2).join('/');
/** بداية الأسبوع (السبت) لتاريخ معطى */
export function weekStart(d = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 1) % 7)); // السبت = 6
  return iso(x);
}
const addDays = (s: string, n: number) => { const [y, m, d] = s.split('-').map(Number); return iso(new Date(y, m - 1, d + n)); };

export const isWeeklyTask = (t: Pick<Task, 'description'>) => TAG_RE.test(String(t.description || ''));

export function WeeklyChecklist({ tasks, canEdit, weeksBack = 8 }: { tasks: Task[]; canEdit: boolean; weeksBack?: number }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const current = weekStart();
  const creating = useRef(false);

  // خريطة: أسبوع ← بند ← المهمة
  const byWeek = useMemo(() => {
    const m = new Map<string, Map<ItemKey, Task>>();
    tasks.forEach(t => {
      const g = String(t.description || '').match(TAG_RE);
      if (!g) return;
      if (!m.has(g[2])) m.set(g[2], new Map());
      m.get(g[2])!.set(g[1] as ItemKey, t);
    });
    return m;
  }, [tasks]);

  // إنشاء بنود الأسبوع الحالي إن لم تكن موجودة
  useEffect(() => {
    if (!canEdit || creating.current) return;
    const have = byWeek.get(current);
    const missing = WEEKLY_ITEMS.filter(i => !have?.has(i.key));
    if (!missing.length) return;
    creating.current = true;
    const due = new Date(`${addDays(current, 5)}T12:00:00`).toISOString(); // الخميس
    supabase.from('tasks').insert(missing.map(i => ({
      title: `${i.title} (أسبوع ${dmy(current)})`, description: `مهمة أسبوعية ثابتة ${TAG(current, i.key)}`,
      due_date: due, priority: 'medium', status: 'pending',
    })) as any).then(({ error }) => {
      if (error) toast.error('تعذر إنشاء مهمات الأسبوع: ' + error.message);
      else qc.invalidateQueries({ queryKey: ['tasks'] });
      creating.current = false;
    });
  }, [byWeek, current, canEdit, qc]);

  const toggle = useMutation({
    mutationFn: async ({ task, done }: { task: Task; done: boolean }) => {
      const { error } = await supabase.from('tasks').update(done
        ? { status: 'completed', completion_result: 'completed', completed_at: new Date().toISOString() }
        : { status: 'pending', completion_result: null, completed_at: null } as any).eq('id', task.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
    onError: (e: any) => toast.error('تعذر التحديث: ' + e.message),
  });

  const week = byWeek.get(current);
  const doneCount = WEEKLY_ITEMS.filter(i => week?.get(i.key)?.status === 'completed').length;
  const history = Array.from({ length: weeksBack }, (_, k) => addDays(current, -7 * (k + 1))).filter(w => byWeek.has(w));

  return (
    <section className="space-y-3 rounded-2xl border border-primary/20 bg-card p-4 shadow-sm md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold"><CalendarCheck className="h-5 w-5 text-primary" />المهمات الأسبوعية
          <span className="text-xs font-normal text-muted-foreground tabular-nums">أسبوع {dmy(current)} – {dmy(addDays(current, 6))}</span>
        </h2>
        <span className={cn('rounded-lg px-2.5 py-1 text-sm font-semibold tabular-nums', doneCount === WEEKLY_ITEMS.length ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-700 dark:text-amber-400')}>{doneCount}/{WEEKLY_ITEMS.length} أُنجزت</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {WEEKLY_ITEMS.map(i => {
          const t = week?.get(i.key);
          const done = t?.status === 'completed';
          return (
            <div key={i.key} className={cn('flex items-center gap-3 rounded-xl border p-3 transition-colors', done ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border')}>
              <button type="button" disabled={!t || !canEdit || toggle.isPending} onClick={() => t && toggle.mutate({ task: t, done: !done })}
                aria-pressed={done} aria-label={`${done ? 'إلغاء إنجاز' : 'تم'}: ${i.title}`}
                className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 disabled:opacity-50', done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-muted-foreground/40 hover:border-primary')}>
                {done && <Check className="h-5 w-5" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className={cn('flex items-center gap-1.5 font-semibold', done && 'text-muted-foreground line-through')}><i.icon className="h-4 w-4 shrink-0 text-primary" />{i.title}</div>
                <div className="text-xs text-muted-foreground">{done && t?.completed_at ? `أُنجزت ${new Date(t.completed_at).toLocaleDateString('en-GB')}` : 'لم تُنجز بعد'}</div>
              </div>
              <button type="button" onClick={() => navigate(i.path)} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`فتح صفحة ${i.title}`} title="فتح الصفحة"><ExternalLink className="h-4 w-4" /></button>
            </div>
          );
        })}
      </div>
      {history.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-xs">
            <thead className="text-muted-foreground"><tr><th className="p-1.5 text-right font-medium">الأسابيع السابقة</th>{WEEKLY_ITEMS.map(i => <th key={i.key} className="p-1.5 text-center font-medium">{i.title}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">
              {history.map(w => (
                <tr key={w}>
                  <td className="p-1.5 tabular-nums">{dmy(w)} – {dmy(addDays(w, 6))}</td>
                  {WEEKLY_ITEMS.map(i => {
                    const t = byWeek.get(w)?.get(i.key);
                    const done = t?.status === 'completed';
                    return (
                      <td key={i.key} className="p-1.5 text-center">
                        <button type="button" disabled={!t || !canEdit} onClick={() => t && toggle.mutate({ task: t, done: !done })} title={done ? 'تم' : 'لم يُنجز — اضغط لتعليمه'}
                          className={cn('inline-flex h-7 w-7 items-center justify-center rounded-md font-bold', !t ? 'text-muted-foreground/40' : done ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-destructive/10 text-destructive')}>
                          {!t ? '—' : done ? <Check className="h-4 w-4" /> : '✗'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
