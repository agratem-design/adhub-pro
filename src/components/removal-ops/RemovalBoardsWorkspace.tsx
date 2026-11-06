import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarDays, CheckCircle2, LayoutGrid, Rows3, Search, Undo2, Users, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, formatFacesCountArabic } from '@/lib/utils';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { smartArabicMatch } from '@/lib/arabicSearch';
import { sortBillboardsStandardSync } from '@/lib/billboardSorter';
import { useBillboardSortRanks } from '@/hooks/useBillboardSortRanks';
import { ZoomImage } from '@/components/composite-ops/ImageZoom';
import { CARD_GRID, CardSizeControl, cardVars, useCardSize } from '@/components/composite-ops/CardSize';
import { BillboardCardFrame, CardStatusBadge } from '@/components/billboards/card/BillboardCardFrame';
import { ScrollTopButton } from '@/components/shared/ScrollTopButton';
import { CompleteRemovalDialog } from '@/components/removal-ops/CompleteRemovalDialog';
import { REMOVAL_STATUS } from '@/components/removal-ops/RemovalOperationCard';
import { completeRemovalItems, undoRemovalItem } from '@/services/removalActions';
import type { RemovalOperation } from '@/services/removalOperations';
import type { RemovalTaskItem } from '@/hooks/useRemovalData';

type Filter = 'all' | 'pending' | 'done';
type Layout = 'horizontal' | 'vertical';
const LAYOUT_KEY = 'removal-boards-layout';
const readLayout = (): Layout => { try { return localStorage.getItem(LAYOUT_KEY) === 'vertical' ? 'vertical' : 'horizontal'; } catch { return 'horizontal'; } };
const dmy = (s?: string | null) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
/** أدنى عرض للبطاقة (نفس مقاسات نافذة التركيب) */
const CARD_MIN_W = { xs: 210, sm: 300, md: 360, lg: 460 } as const;
const ROW_MIN_W = { xs: 380, sm: 480, md: 560, lg: 680 } as const;
const ROW_IMG_W = { xs: '160px', sm: '230px', md: '270px', lg: '330px' } as const;

/** لوحات أمر الإزالة بنفس شكل «إدارة لوحات التركيب»: بحث وفلاتر، تحديد جماعي، توثيق الإزالة بتاريخ، تراجع */
export function RemovalBoardsWorkspace({ op, billboardById, allItems, onClose, onChanged }: {
  op: RemovalOperation; billboardById: Record<string | number, any>; allItems: RemovalTaskItem[];
  onClose: () => void; onChanged: () => void;
}) {
  const [filter, setFilter] = useState<Filter>(op.boardsDone === op.boards ? 'all' : 'pending');
  const [q, setQ] = useState('');
  const [team, setTeam] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [completeIds, setCompleteIds] = useState<string[] | null>(null);
  const [layout, setLayoutState] = useState<Layout>(readLayout);
  const setLayout = (l: Layout) => { setLayoutState(l); try { localStorage.setItem(LAYOUT_KEY, l); } catch { /* ignore */ } };
  const horizontal = layout === 'horizontal';
  const [cardSize] = useCardSize();
  const { confirm } = useSystemDialog();
  const sortReady = useBillboardSortRanks();

  const teamOf = useMemo(() => new Map(op.parts.flatMap(p => p.items.map(i => [i.id, p] as const))), [op]);
  const visible = useMemo(() => sortBillboardsStandardSync(op.items.filter(i => {
    if (filter === 'done' ? i.status !== 'completed' : filter === 'pending' ? i.status === 'completed' : false) return false;
    if (team !== 'all' && teamOf.get(i.id)?.taskId !== team) return false;
    if (!q.trim()) return true;
    const bb = billboardById[i.billboard_id] || {};
    return smartArabicMatch([bb.Billboard_Name, bb.Nearest_Landmark, bb.District, bb.Municipality, bb.City, bb.Size, i.billboard_id], q);
  }).map(i => {
    // الترتيب الموحد: المقاس ← المستوى ← البلدية
    const bb = billboardById[i.billboard_id] || {};
    return { item: i, Size: bb.Size, Level: bb.Level, Municipality: bb.Municipality, City: bb.City, ID: i.billboard_id, Billboard_Name: bb.Billboard_Name };
  })).map(r => r.item), [op, filter, team, q, billboardById, teamOf, sortReady]);

  const total = op.boards, done = op.boardsDone;
  const sel = op.items.filter(i => selected.has(i.id));
  const toggle = (id: string, on: boolean) => setSelected(prev => { const n = new Set(prev); on ? n.add(id) : n.delete(id); return n; });
  const activeFilters = (q.trim() ? 1 : 0) + (team !== 'all' ? 1 : 0);

  const doComplete = async (date: string, notes: string) => {
    if (!completeIds) return;
    try {
      const n = await completeRemovalItems(completeIds, date, notes || null, allItems);
      toast.success(`وُثّقت إزالة ${n} لوحة`);
      setSelected(new Set());
      onChanged();
    } catch (e: any) { toast.error('تعذر توثيق الإزالة: ' + (e?.message || e)); throw e; }
  };

  const undo = async (items: RemovalTaskItem[]) => {
    if (!items.length) return;
    const name = items.length === 1 ? (billboardById[items[0].billboard_id]?.Billboard_Name || `لوحة ${items[0].billboard_id}`) : `${items.length} لوحة`;
    const ok = await confirm({ title: 'التراجع عن الإزالة', message: `ستعود ${name} إلى قائمة الإزالة المعلقة.`, confirmText: 'تراجع' } as any);
    if (!ok) return;
    try { for (const it of items) await undoRemovalItem(it); toast.success('تم التراجع'); setSelected(new Set()); onChanged(); }
    catch (e: any) { toast.error('فشل التراجع: ' + (e?.message || e)); }
  };

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent dir="rtl" className="flex h-[96vh] max-w-[min(1600px,98vw)] flex-col gap-0 overflow-hidden p-0 text-right">
        <header className="space-y-3 border-b border-border px-5 py-4 pl-12">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-lg font-bold">إدارة الإزالة · عقد #{op.contractId}</DialogTitle>
            <span className={cn('rounded-lg px-2 py-0.5 text-xs font-semibold', REMOVAL_STATUS[op.status].cls)}>{REMOVAL_STATUS[op.status].label}</span>
          </div>
          <DialogDescription className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-foreground">{op.customerName}</span>
            {op.adType && <span className="rounded-md border border-border px-2 py-0.5">{op.adType}</span>}
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{op.teams.join('، ')}</span>
          </DialogDescription>
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
            <span className="text-sm tabular-nums"><b>{done}</b> / {total} أُزيلت</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث باسم اللوحة، أقرب نقطة دالة، أو المنطقة..." className="h-9 pr-9 pl-8" aria-label="بحث في اللوحات" />
              {q && <button type="button" onClick={() => setQ('')} className="absolute left-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground" aria-label="مسح البحث"><X className="h-3.5 w-3.5" /></button>}
            </div>
            <Select value={filter} onValueChange={v => setFilter(v as Filter)} dir="rtl">
              <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">المعلقة ({total - done})</SelectItem>
                <SelectItem value="done">المُزالة ({done})</SelectItem>
                <SelectItem value="all">كل الحالات ({total})</SelectItem>
              </SelectContent>
            </Select>
            {op.parts.length > 1 && (
              <Select value={team} onValueChange={setTeam} dir="rtl">
                <SelectTrigger className={cn('h-9 w-[180px] text-xs', team !== 'all' && 'border-primary text-primary')} aria-label="الفرقة"><Users className="ml-1 h-3.5 w-3.5 shrink-0" /><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">كل الفرق</SelectItem>{op.parts.map(p => <SelectItem key={p.taskId} value={p.taskId}>{p.teamName} ({p.done}/{p.items.length})</SelectItem>)}</SelectContent>
              </Select>
            )}
            <div role="radiogroup" aria-label="شكل البطاقات" className="flex rounded-lg border border-border p-0.5">
              <button type="button" role="radio" aria-checked={horizontal} onClick={() => setLayout('horizontal')} className={cn('flex h-8 items-center gap-1 rounded-md px-2.5 text-xs', horizontal ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}><Rows3 className="h-4 w-4" />بالعرض</button>
              <button type="button" role="radio" aria-checked={!horizontal} onClick={() => setLayout('vertical')} className={cn('flex h-8 items-center gap-1 rounded-md px-2.5 text-xs', !horizontal ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}><LayoutGrid className="h-4 w-4" />بالطول</button>
            </div>
            <CardSizeControl />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">التحديد:</span>
            <Button size="sm" variant="outline" className="h-8" disabled={!visible.length} onClick={() => setSelected(new Set(visible.map(i => i.id)))}>تحديد الكل ({visible.length})</Button>
            {visible.some(i => i.status !== 'completed') && <Button size="sm" variant="outline" className="h-8" onClick={() => setSelected(new Set(visible.filter(i => i.status !== 'completed').map(i => i.id)))}>المعلقة ({visible.filter(i => i.status !== 'completed').length})</Button>}
            {visible.some(i => i.status === 'completed') && <Button size="sm" variant="outline" className="h-8" onClick={() => setSelected(new Set(visible.filter(i => i.status === 'completed').map(i => i.id)))}>المُزالة ({visible.filter(i => i.status === 'completed').length})</Button>}
            {selected.size > 0 && <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelected(new Set())}>إلغاء ({selected.size})</Button>}
            {activeFilters > 0 && <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={() => { setQ(''); setTeam('all'); }}><X className="h-3.5 w-3.5" />مسح الفلاتر ({activeFilters})</Button>}
            <span className="ms-auto text-muted-foreground">{visible.length} من {total} لوحة</span>
          </div>
        </header>

        <div className="relative min-h-0 flex-1 overflow-y-auto p-4">
          <ScrollTopButton className="absolute bottom-24 right-6" threshold={300} />
          {!visible.length ? <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">لا توجد لوحات مطابقة</div> : (
            <div className={cn('grid gap-3', CARD_GRID[cardSize].text)} style={{ ...cardVars(cardSize), ['--img-w' as any]: ROW_IMG_W[cardSize], gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${(horizontal ? ROW_MIN_W : CARD_MIN_W)[cardSize]}px), 1fr))` }}>
              {visible.map(item => {
                const bb = billboardById[item.billboard_id] || {};
                const isDone = item.status === 'completed';
                const isSel = selected.has(item.id);
                const name = bb.Billboard_Name || `لوحة ${item.billboard_id}`;
                const installedA = item.installed_image_face_a_url || item.installed_image_url || null;
                // الصورة الرئيسية: بعد الإزالة ← صورة التركيب ← صورة اللوحة الأصلية ← التصميم
                const cover = item.removed_image_url || installedA || item.installed_image_face_b_url || bb.Image_URL || item.design_face_a || null;
                const gallery = ([
                  ['بعد الإزالة', item.removed_image_url], ['صورة التركيب', installedA], ['صورة التركيب (خلفي)', item.installed_image_face_b_url],
                  ['صورة اللوحة', bb.Image_URL], ['التصميم الأمامي', item.design_face_a], ['التصميم الخلفي', item.design_face_b],
                ] as const).filter(([, src]) => !!src).map(([label, src]) => ({ src: src as string, label }));
                const coverLabel = item.removed_image_url ? 'بعد الإزالة' : installedA || item.installed_image_face_b_url ? 'صورة التركيب' : bb.Image_URL ? 'صورة اللوحة' : item.design_face_a ? 'التصميم' : '';
                const part = teamOf.get(item.id);
                const thumbs = ([['التصميم', item.design_face_a], ['التركيب', installedA], ['بعد الإزالة', item.removed_image_url]] as const);
                return (
                  <BillboardCardFrame key={item.id} code={name} size={bb.Size} tone={isSel ? 'selected' : 'default'} horizontal={horizontal}
                    title={bb.Nearest_Landmark || name} municipality={bb.Municipality || undefined} district={bb.District || undefined} city={bb.City || undefined}
                    imageHeight="h-[var(--img-h,200px)]"
                    headerActions={<Checkbox className="h-5 w-5" checked={isSel} onCheckedChange={c => toggle(item.id, c === true)} aria-label={`تحديد ${name}`} />}
                    image={<ZoomImage src={cover} alt={name} title={name} gallery={gallery} className="h-full w-full" />}
                    statusBadges={<>
                      <CardStatusBadge kind={isDone ? 'available' : 'warning'} icon={isDone ? CheckCircle2 : CalendarDays} label={isDone ? `أُزيلت ${dmy(item.removal_date)}` : 'بانتظار الإزالة'} />
                      {coverLabel && <CardStatusBadge kind="info" label={coverLabel} />}
                    </>}
                    headerExtra={part && <span className="ms-auto inline-flex min-w-0 max-w-full items-center gap-1.5 text-[11px] text-muted-foreground" title={part.teamName}><Users className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{part.teamName}</span></span>}>
                    <div className="text-xs text-muted-foreground">{formatFacesCountArabic(Number(bb.Faces_Count) || 1)}</div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {thumbs.map(([label, src]) => (
                        <div key={label} className="min-w-0 space-y-0.5">
                          <ZoomImage src={src} alt={label} title={name} gallery={gallery} className="h-12 w-full rounded-md border border-border" imgClassName="object-contain" />
                          <div className="truncate text-center text-[10px] text-muted-foreground">{src ? label : label === 'التصميم' ? 'بلا تصميم' : 'لم يُرفع'}</div>
                        </div>
                      ))}
                    </div>
                    {item.notes && <div className="rounded bg-muted/50 px-2 py-1 text-xs">{item.notes}</div>}
                    <footer className="mt-auto border-t border-border pt-2 [&_button]:cursor-pointer [&_button]:transition-all [&_button]:duration-200">
                      {isDone
                        ? <Button size="sm" variant="outline" className="h-9 w-full gap-1.5 text-xs" onClick={() => undo([item])}><Undo2 className="h-4 w-4" />تراجع عن الإزالة</Button>
                        : <Button size="sm" className="h-9 w-full gap-1.5 text-xs" onClick={() => setCompleteIds([item.id])}><CheckCircle2 className="h-4 w-4" />تمت الإزالة</Button>}
                    </footer>
                  </BillboardCardFrame>
                );
              })}
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/30 px-4 py-3">
          {sel.length > 0 ? (
            <>
              <span className="text-sm font-semibold">{sel.length} محددة</span>
              {sel.some(i => i.status !== 'completed') && <Button size="sm" onClick={() => setCompleteIds(sel.filter(i => i.status !== 'completed').map(i => i.id))}><CheckCircle2 className="h-4 w-4" />تمت الإزالة ({sel.filter(i => i.status !== 'completed').length})</Button>}
              {sel.some(i => i.status === 'completed') && <Button size="sm" variant="outline" onClick={() => undo(sel.filter(i => i.status === 'completed'))}><Undo2 className="h-4 w-4" />تراجع ({sel.filter(i => i.status === 'completed').length})</Button>}
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>إلغاء التحديد</Button>
            </>
          ) : <span className="text-xs text-muted-foreground">حدد لوحات لتوثيق إزالتها دفعة واحدة</span>}
          <Button variant="outline" className="ms-auto" onClick={onClose}>إغلاق</Button>
        </footer>

        <CompleteRemovalDialog open={!!completeIds} count={completeIds?.length || 0} subtitle={`${op.customerName} · عقد #${op.contractId}`}
          onOpenChange={o => { if (!o) setCompleteIds(null); }} onConfirm={doComplete} />
      </DialogContent>
    </Dialog>
  );
}
