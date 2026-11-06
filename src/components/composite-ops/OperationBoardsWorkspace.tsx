import { BillboardCardFrame, CardStatusBadge } from '@/components/billboards/card/BillboardCardFrame';
import { BillboardFaceMedia } from '@/components/billboards/card/BillboardFaceMedia';
import { InstallationFaceSelector } from '@/components/installation/InstallationFaceSelector';
import { saveInstallationFaceSelection } from '@/services/installationFaceSelection';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { pickInstallationTeam } from '@/utils/smartTeamAssignment';
import { installationTeamCoversBillboard } from '@/utils/teamAssignment';
import { cn } from '@/lib/utils';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { sortBillboardsStandardSync } from '@/lib/billboardSorter';
import { useBillboardSortRanks } from '@/hooks/useBillboardSortRanks';
import { smartArabicMatch } from '@/lib/arabicSearch';
import {
  Calculator, Camera, X, CheckCircle2, Sparkles, Star, ShieldOff, ImageIcon, ImagePlus, Loader2, MoreHorizontal, Palette, Plus, Printer, RotateCcw, Search, Trash2, Undo2, Upload, Users, CalendarDays, Rows3, LayoutGrid,
} from 'lucide-react';
import { AddBillboardsToTaskDialog } from '@/components/installation/AddBillboardsToTaskDialog';
import {
  completeBoards, loadOperationBoards, loadOperationDesigns, moveBoards, moveBoardsToTeam, removeBoards, saveInstalledPhotos, setBoardsDate, setBoardsDesign, uncompleteBoards, uploadInstalledPhoto, type BoardItem, type OpDesign,
} from '@/services/operationBoards';
import { UploadProgressBar, splitFaceFiles, useUploadProgress } from '@/components/installation/UploadProgressBar';
import type { OperationRow } from '@/services/compositeOperations';
import { ZoomImage } from '@/components/composite-ops/ImageZoom';
import { CARD_GRID, CardSizeControl, cardVars, useCardSize } from '@/components/composite-ops/CardSize';
import { ScrollTopButton } from '@/components/shared/ScrollTopButton';

const today = () => format(new Date(), 'yyyy-MM-dd');
/** أدنى عرض للبطاقة في نافذة إدارة اللوحات: الأعمدة تتكيّف مع عرض النافذة */
const BOARD_CARD_MIN_W = { xs: 210, sm: 300, md: 360, lg: 460 } as const;
/** البطاقة بالعرض: أقل عرض للبطاقة وعرض الصورة لكل حجم */
const BOARD_ROW_MIN_W = { xs: 380, sm: 480, md: 560, lg: 680 } as const;
const BOARD_ROW_IMG_W = { xs: '160px', sm: '230px', md: '270px', lg: '330px' } as const;
/** ارتفاع صور التصميم/التركيب داخل البطاقة بالطول */
const BOARD_FACE_H = { xs: '4rem', sm: '6rem', md: '6rem', lg: '6rem' } as const;
type BoardLayout = 'horizontal' | 'vertical';
const LAYOUT_KEY = 'operation-boards-layout';
const readLayout = (): BoardLayout => { try { return localStorage.getItem(LAYOUT_KEY) === 'vertical' ? 'vertical' : 'horizontal'; } catch { return 'horizontal'; } };
type BoardAttr = 'size' | 'level' | 'municipality' | 'city';
const BOARD_ATTRS: { key: BoardAttr; label: string; all: string }[] = [
  { key: 'size', label: 'المقاس', all: 'كل المقاسات' },
  { key: 'level', label: 'المستوى', all: 'كل المستويات' },
  { key: 'municipality', label: 'البلدية', all: 'كل البلديات' },
  { key: 'city', label: 'المدينة', all: 'كل المدن' },
];
const EMPTY_ATTRS: Record<BoardAttr, string> = { size: 'all', level: 'all', municipality: 'all', city: 'all' };
const dmy = (s?: string | null) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');

function PhotoDialog({ item, op, onClose, onSaved }: { item: BoardItem; op: OperationRow; onClose: () => void; onSaved: () => void }) {
  const [a, setA] = useState(item.installedA || '');
  const [b, setB] = useState(item.installedB || '');
  const [busy, setBusy] = useState<'save' | null>(null);
  const [uploading, setUploading] = useState<Record<'A' | 'B', boolean>>({ A: false, B: false });
  const fileA = useRef<HTMLInputElement>(null);
  const fileB = useRef<HTMLInputElement>(null);
  const fileBoth = useRef<HTMLInputElement>(null);
  const progA = useUploadProgress();
  const progB = useUploadProgress();
  const uploadOne = async (face: 'A' | 'B', file: File) => {
    const prog = face === 'A' ? progA : progB;
    setUploading(u => ({ ...u, [face]: true }));
    prog.start(file.size);
    try {
      const url = await uploadInstalledPhoto(file, item, face, op);
      face === 'A' ? setA(url) : setB(url);
      prog.finish(true);
      return true;
    } catch (e: any) { prog.finish(false); toast.error(`${face === 'A' ? 'الوجه الأمامي' : 'الوجه الخلفي'}: ${e.message || 'فشل الرفع'}`); return false; }
    finally { setUploading(u => ({ ...u, [face]: false })); }
  };
  const upload = async (face: 'A' | 'B', file?: File) => {
    if (file && await uploadOne(face, file)) toast.success('تم رفع الصورة');
  };
  /** رفع صورتي الوجهين دفعة واحدة (بالتوازي) */
  const uploadBoth = async (list: FileList | null) => {
    const files = splitFaceFiles(list);
    if (!files.length) { toast.error('اختر صوراً صالحة'); return; }
    const targets = faces.map(f => f[0]);
    const ok = (await Promise.all(files.slice(0, targets.length).map((f, idx) => uploadOne(targets[idx], f)))).filter(Boolean).length;
    if (ok) toast.success(ok > 1 ? 'تم رفع صورتي الوجهين' : 'تم رفع الصورة');
  };
  const uploadingAny = uploading.A || uploading.B;
  const save = async () => {
    setBusy('save');
    try { await saveInstalledPhotos(item, a.trim() || null, b.trim() || null); toast.success('تم حفظ صور التركيب'); onSaved(); onClose(); }
    catch (e: any) { toast.error(e.message || 'فشل الحفظ'); } finally { setBusy(null); }
  };
  const [showLinks, setShowLinks] = useState(false);
  const faces: ['A' | 'B', string, string, (v: string) => void, React.RefObject<HTMLInputElement>][] = [];
  if (item.selectedFaces.includes(1)) faces.push(['A', 'الوجه الأمامي', a, setA, fileA]);
  if (item.selectedFaces.includes(2)) faces.push(['B', 'الوجه الخلفي', b, setB, fileB]);
  return (
    <Dialog open onOpenChange={o => { if (!o && !uploadingAny) onClose(); }}>
      <DialogContent dir="rtl" className="max-h-[92vh] max-w-5xl overflow-y-auto text-right">
        <DialogTitle>صور التركيب · {item.name}</DialogTitle>
        <DialogDescription>ارفع صورة، أو انقر على مربع الوجه ثم الصق صورة من الحافظة (Ctrl+V)</DialogDescription>
        {faces.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-2"
            onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy && !uploadingAny) uploadBoth(e.dataTransfer.files); }}>
            <input ref={fileBoth} type="file" accept="image/*" multiple className="hidden" onChange={e => { uploadBoth(e.target.files); e.target.value = ''; }} />
            <Button type="button" size="sm" disabled={!!busy || uploadingAny} onClick={() => fileBoth.current?.click()}>
              {uploadingAny ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}رفع الوجهين معاً
            </Button>
            <span className="text-[11px] text-muted-foreground">اختر صورتين أو اسحبهما هنا — الأولى بالاسم للأمامي والثانية للخلفي</span>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {faces.map(([face, label, val, set, ref]) => (
            <div key={face} className="space-y-2">
              <div className="text-sm font-semibold">{label}</div>
              <div tabIndex={0} title="انقر ثم الصق صورة (Ctrl+V)" className="flex aspect-video cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border border-dashed border-border bg-muted/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30">
                {val ? <img src={val} alt={label} className="h-full w-full object-contain" /> : <><Camera className="h-6 w-6 text-muted-foreground" /><span className="text-[11px] text-muted-foreground">انقر هنا ثم Ctrl+V</span></>}
              </div>
              <input ref={ref} type="file" accept="image/*" className="hidden" onChange={e => { upload(face, e.target.files?.[0]); e.target.value = ''; }} />
              <UploadProgressBar value={(face === 'A' ? progA : progB).progress} />
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="flex-1" disabled={!!busy || uploading[face]} onClick={() => ref.current?.click()}>
                  {uploading[face] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}رفع
                </Button>
                {val && <Button type="button" variant="ghost" size="sm" onClick={() => set('')}>مسح</Button>}
                <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setShowLinks(v => !v)}>{showLinks ? 'إخفاء الرابط' : 'إظهار الرابط'}</Button>
              </div>
              {showLinks && <Input dir="ltr" placeholder="https://" value={val} onChange={e => set(e.target.value)} />}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={save} disabled={!!busy || uploadingAny}>{busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" />}حفظ</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export interface MoveOption { id: string; name: string; inOperation: boolean; eligible: boolean; recommended: boolean; current: boolean }

/** قائمة نقل ذكية: الأنسب أولاً، ثم فرق العملية، ثم بقية الفرق؛ غير المناسبة معطّلة ما لم يُفعَّل «تجاوز أحكام الفرق» */
function MoveMenu({ options, override, onMove, trigger }: { options: MoveOption[]; override: boolean; onMove: (o: MoveOption) => void; trigger: React.ReactNode }) {
  const rec = options.find(o => o.recommended && !o.current);
  const section = (title: string, list: MoveOption[]) => list.length > 0 && (
    <>
      <DropdownMenuLabel className="text-xs text-muted-foreground">{title}</DropdownMenuLabel>
      {list.map(o => (
        <DropdownMenuItem key={o.id} disabled={o.current || (!o.eligible && !override)} onClick={() => onMove(o)} className="flex items-center gap-2">
          {o.recommended ? <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> : <Users className="h-3.5 w-3.5 opacity-60" />}
          <span className="flex-1">{o.name}</span>
          {o.current && <span className="text-[10px] text-muted-foreground">الحالية</span>}
          {!o.eligible && !o.current && <span className="text-[10px] text-destructive">خارج نطاقها</span>}
          {!o.inOperation && !o.current && <span className="text-[10px] text-muted-foreground">مهمة جديدة</span>}
        </DropdownMenuItem>
      ))}
    </>
  );
  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70vh] w-80 overflow-y-auto text-right text-sm">
        {rec && (<><DropdownMenuItem onClick={() => onMove(rec)} className="flex items-center gap-2 font-semibold text-primary"><Sparkles className="h-3.5 w-3.5" />الأنسب: {rec.name}</DropdownMenuItem><DropdownMenuSeparator /></>)}
        {section('فرق العملية', options.filter(o => o.inOperation))}
        {section('فرق أخرى', options.filter(o => !o.inOperation))}
        {!override && options.some(o => !o.eligible && !o.current) && <div className="px-2 py-1.5 text-[11px] text-muted-foreground">فعّل «تجاوز أحكام الفرق» لنقلها لفرقة خارج نطاقها</div>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** اختيار التصميم بصور مصغرة */
function DesignMenu({ designs, current, onPick, trigger }: { designs: OpDesign[]; current: string | null; onPick: (d: OpDesign) => void; trigger: React.ReactNode }) {
  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70vh] w-[26rem] overflow-y-auto p-1.5 text-right">
        {!designs.length && <div className="p-3 text-center text-xs text-muted-foreground">لا توجد تصاميم — أضفها من زر «التصاميم» أعلى النافذة</div>}
        {designs.map((d, k) => (
          <DropdownMenuItem key={`${d.id || 'u'}-${k}`} onClick={() => onPick(d)} className={cn('flex items-center gap-2 p-1.5', current && current === d.a && 'bg-primary/10')}>
            <span className="grid shrink-0 grid-cols-2 gap-1">
              {[d.a, d.b].map((src, j) => (
                <span key={j} className="flex h-12 w-16 items-center justify-center overflow-hidden rounded border border-border bg-muted">
                  {src ? <img src={src} alt="" className="h-full w-full object-contain" loading="lazy" /> : <span className="text-[9px] text-muted-foreground">{j ? 'بلا خلفي' : '—'}</span>}
                </span>
              ))}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs">{d.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BoardCard({ horizontal = false, i, gallery, isDone, selected, busy, showTeam, showContract, moveOptions, override, designs, onToggle, onComplete, onUncomplete, onPhotos, onMove, onDesign, onRemove, onFacesChange }: {
  horizontal?: boolean; i: BoardItem; gallery: { src: string; label?: string }[]; isDone: boolean; selected: boolean; busy: boolean; showTeam: boolean; showContract: boolean;
  moveOptions: MoveOption[]; override: boolean; designs: OpDesign[]; onToggle: (c: boolean) => void; onComplete: () => void; onUncomplete: () => void; onPhotos: () => void;
  onFacesChange: (faces: number[]) => void;
  onMove: (o: MoveOption) => void; onDesign: (d: OpDesign) => void; onRemove: () => void;
}) {
  return <BillboardCardFrame code={i.name} size={i.size} tone={selected ? 'selected' : 'default'}
    title={i.landmark || i.name} municipality={i.municipality || undefined} district={i.area || undefined} city={i.city || undefined}
    imageHeight="h-[var(--img-h,200px)]" horizontal={horizontal}
    headerActions={<><Checkbox className="h-5 w-5" checked={selected} onCheckedChange={c => onToggle(c === true)} aria-label={`تحديد ${i.name}`} /><Button type="button" size="icon" variant="ghost" className="h-10 w-10 cursor-pointer text-muted-foreground hover:text-destructive" disabled={busy || isDone} onClick={onRemove} aria-label={`إزالة ${i.name}`} title={isDone ? 'ألغِ الإكمال أولاً' : 'إزالة اللوحة'}><Trash2 className="h-4 w-4" /></Button></>}
    image={<ZoomImage src={i.photo} alt={i.name} title={i.name} gallery={gallery} className="h-full w-full" />}
    statusBadges={<CardStatusBadge kind={isDone ? 'available' : 'warning'} icon={isDone ? CheckCircle2 : CalendarDays} label={isDone ? `مركبة ${dmy(i.installationDate)}` : 'بانتظار التركيب'} />}
    headerExtra={<span className="ms-auto inline-flex min-w-0 max-w-full items-center gap-1.5 text-[11px] text-muted-foreground" title={i.teamName}><Users className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{i.teamName}</span></span>}>
    {showContract && i.contractNumber && <div className="text-xs text-muted-foreground">العقد <span className="font-semibold text-foreground">#{i.contractNumber}</span></div>}
    <InstallationFaceSelector maxFaces={i.maxFaces} selectedFaces={i.selectedFaces} disabled={busy} onChange={onFacesChange} />
    {horizontal ? (
      // شريط مصغّر: تصميم وتركيب لكل وجه بدل الصناديق الكبيرة
      <div className="grid grid-cols-4 gap-1.5">
        {i.selectedFaces.flatMap(face => ([['تصميم', face === 1 ? i.designA : face === 2 ? i.designB : null], ['تركيب', face === 1 ? i.installedA : face === 2 ? i.installedB : null]] as const).map(([label, src]) => (
          <div key={`${face}-${label}`} className="min-w-0 space-y-0.5">
            <ZoomImage src={src} alt={`${label} الوجه ${face}`} title={i.name} gallery={gallery} className="h-10 w-full rounded-md border border-border" imgClassName="object-contain" />
            <div className="truncate text-center text-[10px] text-muted-foreground">و{face} · {src ? label : label === 'تصميم' ? 'بلا تصميم' : 'لم يُرفع'}</div>
          </div>
        )))}
      </div>
    ) : (
      <BillboardFaceMedia faces={i.selectedFaces.map(face => ({ face, design: face === 1 ? i.designA : face === 2 ? i.designB : null, installed: face === 1 ? i.installedA : face === 2 ? i.installedB : null }))}
        renderImage={(src, label) => <ZoomImage src={src} alt={label} title={i.name} gallery={gallery} className="h-[var(--face-h,6rem)] w-full rounded-md" imgClassName="object-contain" />} />
    )}
    {horizontal ? (
      // بالعرض: زران رئيسيان بنص، والفرقة/التصميم أيقونتان بتلميح — لا تداخل في العرض الضيق
      <footer className="mt-auto flex items-center gap-1.5 border-t border-border pt-2 [&_button]:cursor-pointer [&_button]:transition-all [&_button]:duration-200">
        <Button size="sm" variant={isDone ? 'outline' : 'default'} className="h-8 min-w-0 flex-1 gap-1 px-2 text-xs" disabled={busy} onClick={isDone ? onUncomplete : onComplete}>
          {isDone ? <Undo2 className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}<span className="truncate">{isDone ? 'إلغاء الإكمال' : 'تم التركيب'}</span>
        </Button>
        <Button size="sm" variant="outline" className="h-8 min-w-0 flex-1 gap-1 px-2 text-xs" disabled={busy} onClick={onPhotos}>
          <Camera className="h-4 w-4 shrink-0" /><span className="truncate">صور التركيب</span>
        </Button>
        <MoveMenu options={moveOptions} override={override} onMove={onMove} trigger={<Button size="icon" variant="outline" className="h-8 w-8 shrink-0 text-muted-foreground" disabled={busy} title="تغيير الفرقة" aria-label="تغيير الفرقة"><Users className="h-4 w-4" /></Button>} />
        <DesignMenu designs={designs} current={i.designA} onPick={onDesign} trigger={<Button size="icon" variant="outline" className="h-8 w-8 shrink-0 text-muted-foreground" disabled={busy} title="تغيير التصميم" aria-label="تغيير التصميم"><Palette className="h-4 w-4" /></Button>} />
      </footer>
    ) : (
    <footer className="mt-auto space-y-2 border-t border-border pt-3 [&_button]:cursor-pointer [&_button]:transition-all [&_button]:duration-200">
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant={isDone ? 'outline' : 'default'} className="h-10 gap-1.5 text-xs" disabled={busy} onClick={isDone ? onUncomplete : onComplete}>{isDone ? <Undo2 className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}{isDone ? 'إلغاء الإكمال' : 'تم التركيب'}</Button>
        <Button size="sm" variant="outline" className="h-10 gap-1.5 text-xs" disabled={busy} onClick={onPhotos}><Camera className="h-4 w-4" />صور التركيب</Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MoveMenu options={moveOptions} override={override} onMove={onMove} trigger={<Button size="sm" variant="ghost" className="h-10 gap-1.5 text-xs text-muted-foreground" disabled={busy}><Users className="h-4 w-4" />تغيير الفرقة</Button>} />
        <DesignMenu designs={designs} current={i.designA} onPick={onDesign} trigger={<Button size="sm" variant="ghost" className="h-10 gap-1.5 text-xs text-muted-foreground" disabled={busy}><Palette className="h-4 w-4" />تغيير التصميم</Button>} />
      </div>
    </footer>
    )}
  </BillboardCardFrame>;
}

export function OperationBoardsWorkspace({ op, onClose, onChanged, onEditCosts, onDesigns, onDistribute, onPrint }: {
  op: OperationRow;
  onClose: () => void;
  onChanged: () => void;
  onEditCosts: () => void;
  onDesigns: () => void;
  onDistribute: () => void;
  onPrint: (itemIds?: string[]) => void;
}) {
  const { confirm } = useSystemDialog();
  const sortReady = useBillboardSortRanks();
  const [items, setItems] = useState<BoardItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [team, setTeam] = useState('all');
  const [status, setStatus] = useState('all');
  const [contract, setContract] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [photoItem, setPhotoItem] = useState<BoardItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [cardSize] = useCardSize();
  const [layout, setLayoutState] = useState<BoardLayout>(readLayout);
  const setLayout = (v: BoardLayout) => { setLayoutState(v); try { localStorage.setItem(LAYOUT_KEY, v); } catch { /* ignore */ } };
  const horizontal = layout === 'horizontal';
  const [override, setOverride] = useState(false);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [opTeamIds, setOpTeamIds] = useState<Map<string, string>>(new Map()); // team_id -> installation task id
  const [designs, setDesigns] = useState<OpDesign[]>([]);
  useEffect(() => {
    supabase.from('installation_teams').select('*').then(({ data }) => setAllTeams((data || []).filter((t: any) => t.is_active !== false)));
  }, []);
  useEffect(() => {
    const ids = op.tasks.map(t => t.installation_task_id).filter(Boolean);
    if (!ids.length) return;
    supabase.from('installation_tasks').select('id, team_id').in('id', ids).then(({ data }) => setOpTeamIds(new Map((data || []).filter((t: any) => t.team_id).map((t: any) => [t.team_id, t.id]))));
  }, [op]);

  const reload = async () => {
    try { setItems(await loadOperationBoards(op)); setError(null); }
    catch (e: any) { setError(e.message || 'تعذر تحميل اللوحات'); }
  };
  useEffect(() => { setItems(null); setSelected(new Set()); reload(); }, [op.key, op.tasks.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (items) loadOperationDesigns(op, items).then(setDesigns).catch(() => setDesigns([])); }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const teams = useMemo(() => op.tasks.filter(t => t.installation_task_id).map(t => ({ taskId: t.installation_task_id as string, name: t.teamName as string })), [op]);
  const [attrs, setAttrs] = useState<Record<BoardAttr, string>>(EMPTY_ATTRS);
  // خيارات الفلاتر من لوحات العملية مع عدد كل خيار
  const attrOptions = useMemo(() => {
    const out = {} as Record<BoardAttr, [string, number][]>;
    BOARD_ATTRS.forEach(({ key }) => {
      const counts = new Map<string, number>();
      (items || []).forEach(i => { const v = String(i[key] ?? '').trim(); if (v && v !== '—') counts.set(v, (counts.get(v) || 0) + 1); });
      out[key] = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ar'));
    });
    return out;
  }, [items]);
  const teamCount = useMemo(() => { const m = new Map<string, number>(); (items || []).forEach(i => m.set(i.taskId, (m.get(i.taskId) || 0) + 1)); return m; }, [items]);
  const activeFilters = BOARD_ATTRS.filter(a => attrs[a.key] !== 'all').length + Number(team !== 'all') + Number(!!q.trim());
  const visible = useMemo(() => {
    const list = (items || []).filter(i =>
      (team === 'all' || i.taskId === team)
      && (status === 'all' || (status === 'done' ? i.status === 'completed' : i.status !== 'completed'))
      && (contract === 'all' || String(i.contractNumber) === contract)
      && BOARD_ATTRS.every(({ key }) => attrs[key] === 'all' || String(i[key] ?? '').trim() === attrs[key])
      && smartArabicMatch([i.name, i.landmark, i.area, i.city, i.municipality, i.size, i.billboardId], q));
    return sortBillboardsStandardSync(list.map(i => ({ ...i, Size: i.size, Billboard_Name: i.name, ID: i.billboardId })) as any) as unknown as BoardItem[];
  }, [items, q, team, status, contract, attrs, sortReady]);

  const done = (items || []).filter(i => i.status === 'completed').length;
  const total = items?.length || 0;
  const sel = (items || []).filter(i => selected.has(i.id));

  const taskTeam = useMemo(() => new Map([...opTeamIds.entries()].map(([team, task]) => [task, team])), [opTeamIds]);
  const optionsFor = (boards: BoardItem[]): MoveOption[] => {
    const currentTeams = new Set(boards.map(b => taskTeam.get(b.taskId)).filter(Boolean));
    const best = boards.length === 1
      ? pickInstallationTeam(allTeams, { Size: boards[0].size, City: boards[0].city, friend_company_id: boards[0].friendCompanyId }, taskTeam.get(boards[0].taskId))
      : null;
    return allTeams.map(t => ({
      id: t.id,
      name: t.team_name || 'فرقة',
      inOperation: opTeamIds.has(t.id),
      eligible: boards.every(b => installationTeamCoversBillboard(t, b.size, b.city, b.friendCompanyId)),
      recommended: !!best && best.id === t.id,
      current: currentTeams.size === 1 && currentTeams.has(t.id),
    })).sort((a, b) => Number(b.recommended) - Number(a.recommended) || Number(b.eligible) - Number(a.eligible) || a.name.localeCompare(b.name, 'ar'));
  };
  const moveTo = (boards: BoardItem[], o: MoveOption) => run(async () => {
    const team = allTeams.find(t => t.id === o.id);
    if (!team) throw new Error('الفرقة غير متاحة');
    if (!o.eligible && !override) throw new Error('الفرقة خارج نطاق هذه اللوحات — فعّل «تجاوز أحكام الفرق»');
    await moveBoardsToTeam(boards, team, op);
  }, `نُقلت ${boards.length > 1 ? `${boards.length} لوحات` : ''} إلى ${o.name}${o.inOperation ? '' : ' (مهمة جديدة ضمن العملية)'}`, true);

  /** توزيع ذكي: كل لوحة محددة إلى أنسب فرقة لها */
  const smartDistribute = (boards: BoardItem[]) => run(async () => {
    const groups = new Map<string, BoardItem[]>();
    const missing: string[] = [];
    boards.forEach(b => {
      const best = pickInstallationTeam(allTeams, { Size: b.size, City: b.city, friend_company_id: b.friendCompanyId }, taskTeam.get(b.taskId));
      if (!best) { missing.push(b.name); return; }
      if (best.id === taskTeam.get(b.taskId)) return;
      groups.set(best.id, [...(groups.get(best.id) || []), b]);
    });
    for (const [teamId, list] of groups) await moveBoardsToTeam(list, allTeams.find(t => t.id === teamId), op);
    if (missing.length) toast.warning(`لا توجد فرقة مناسبة لـ: ${missing.slice(0, 5).join('، ')}`);
    if (!groups.size) toast.info('كل اللوحات المحددة لدى أنسب فرقة لها');
  }, 'تم التوزيع الذكي على الفرق', true);

  /** إعادة احتساب الفاتورة من الصفر بالأسعار المستخدمة في لوحات العملية */
  const reprice = async (newIds?: Set<string>) => {
    try {
      const { repriceOperation } = await import('@/services/compositeOperations');
      const r = await repriceOperation(op, newIds);
      const total = r.totals.customerTotal;
      toast.success(`أُعيد احتساب الفاتورة${r.added ? ` (سُعّرت ${r.added} لوحة جديدة بنفس أسعار العملية)` : ''}${typeof total === 'number' ? ` — الإجمالي ${Math.round(total).toLocaleString('ar-LY')} د.ل` : ''}`);
    } catch (e: any) { toast.error(`تعذّر إعادة احتساب الفاتورة: ${e.message || e}`); }
  };

  const run = async (fn: () => Promise<void>, msg: string, recalc = false) => {
    setBusy(true);
    try { await fn(); toast.success(msg); setSelected(new Set()); if (recalc) await reprice(); await reload(); onChanged(); }
    catch (e: any) { toast.error(e.message || 'فشلت العملية'); }
    finally { setBusy(false); }
  };

  const toggle = (id: string, on: boolean) => setSelected(p => { const n = new Set(p); on ? n.add(id) : n.delete(id); return n; });

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent dir="rtl" className="flex h-[96vh] max-w-[min(1600px,98vw)] flex-col gap-0 overflow-hidden p-0 text-right">
        <header className="space-y-3 border-b border-border px-5 py-4 pl-12">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-lg font-bold">إدارة اللوحات · {op.label}</DialogTitle>
              <DialogDescription className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-foreground">{op.customerName}</span>
                {op.contracts.map(c => <span key={c.number} className="rounded-md border border-border px-2 py-0.5 tabular-nums">#{c.number}{c.adType ? ` · ${c.adType}` : ''}</span>)}
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{op.teams.join('، ')}</span>
              </DialogDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setAddOpen(true)} disabled={!teams.length}><Plus className="h-4 w-4" />إضافة لوحات</Button>
              <Button size="sm" variant="outline" onClick={onDesigns}><ImagePlus className="h-4 w-4" />التصاميم</Button>
              <Button size="sm" variant="outline" onClick={onDistribute}><Palette className="h-4 w-4" />توزيع التصاميم</Button>
              <Button size="sm" variant="outline" onClick={() => onPrint()}><Printer className="h-4 w-4" />طباعة التركيب</Button>
              <Button size="sm" variant="outline" onClick={onEditCosts}><Calculator className="h-4 w-4" />التكاليف</Button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
            <span className="text-sm tabular-nums"><b>{done}</b> / {total} مركبة</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث باسم اللوحة، أقرب نقطة دالة، أو المنطقة..." className="h-9 pr-9 pl-8" aria-label="بحث في اللوحات" />
              {q && <button type="button" onClick={() => setQ('')} className="absolute left-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground" aria-label="مسح البحث"><X className="h-3.5 w-3.5" /></button>}
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">كل الحالات</SelectItem><SelectItem value="pending">غير مركبة</SelectItem><SelectItem value="done">مركبة</SelectItem></SelectContent>
            </Select>
            {op.contractIds.length > 1 && (
              <Select value={contract} onValueChange={setContract}>
                <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">كل العقود</SelectItem>{op.contractIds.map(n => <SelectItem key={n} value={String(n)}>عقد #{n}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <label className={cn('flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs', override ? 'border-destructive/50 bg-destructive/5 text-destructive' : 'border-border text-muted-foreground')} title="يسمح بنقل اللوحة لأي فرقة حتى لو كانت خارج مدنها أو مقاساتها">
              <ShieldOff className="h-3.5 w-3.5" /><Switch checked={override} onCheckedChange={setOverride} />تجاوز أحكام الفرق
            </label>
            <div role="radiogroup" aria-label="شكل البطاقات" className="flex rounded-lg border border-border p-0.5">
              <button type="button" role="radio" aria-checked={horizontal} onClick={() => setLayout('horizontal')} className={cn('flex h-8 items-center gap-1 rounded-md px-2.5 text-xs', horizontal ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}><Rows3 className="h-4 w-4" />بالعرض</button>
              <button type="button" role="radio" aria-checked={!horizontal} onClick={() => setLayout('vertical')} className={cn('flex h-8 items-center gap-1 rounded-md px-2.5 text-xs', !horizontal ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}><LayoutGrid className="h-4 w-4" />بالطول</button>
            </div>
            <CardSizeControl />
          </div>
          {/* فلاتر اللوحات: الفرقة، المقاس، المستوى، البلدية، المدينة */}
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="فلاتر اللوحات">
            <Select value={team} onValueChange={setTeam} dir="rtl">
              <SelectTrigger className={cn('h-9 w-[170px] text-xs', team !== 'all' && 'border-primary text-primary')} aria-label="الفرقة"><Users className="ml-1 h-3.5 w-3.5 shrink-0" /><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">كل الفرق</SelectItem>{teams.map(t => <SelectItem key={t.taskId} value={t.taskId}>{t.name} ({teamCount.get(t.taskId) || 0})</SelectItem>)}</SelectContent>
            </Select>
            {BOARD_ATTRS.map(({ key, label, all }) => (
              <Select key={key} value={attrs[key]} onValueChange={v => setAttrs(f => ({ ...f, [key]: v }))} dir="rtl">
                <SelectTrigger className={cn('h-9 w-[150px] text-xs', attrs[key] !== 'all' && 'border-primary text-primary')} aria-label={label}><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">{all}</SelectItem>{attrOptions[key].map(([v, n]) => <SelectItem key={v} value={v}>{v} ({n})</SelectItem>)}</SelectContent>
              </Select>
            ))}
            {activeFilters > 0 && <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={() => { setQ(''); setTeam('all'); setAttrs(EMPTY_ATTRS); }}><X className="h-3.5 w-3.5" />مسح الفلاتر ({activeFilters})</Button>}
            <span className="ms-auto text-xs text-muted-foreground">{visible.length} من {total} لوحة</span>
          </div>
          {/* أدوات التحديد: تعمل على اللوحات الظاهرة حسب البحث والفلاتر */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">التحديد:</span>
            <Button size="sm" variant="outline" className="h-8" disabled={!visible.length} onClick={() => setSelected(new Set(visible.map(i => i.id)))}>تحديد الكل ({visible.length})</Button>
            <Button size="sm" variant="outline" className="h-8" disabled={!visible.length} onClick={() => setSelected(p => { const n = new Set(p); visible.forEach(i => (n.has(i.id) ? n.delete(i.id) : n.add(i.id))); return n; })}>عكس التحديد</Button>
            {visible.some(i => i.status !== 'completed') && <Button size="sm" variant="outline" className="h-8" onClick={() => setSelected(new Set(visible.filter(i => i.status !== 'completed').map(i => i.id)))}>غير المركبة ({visible.filter(i => i.status !== 'completed').length})</Button>}
            {visible.some(i => i.status === 'completed') && <Button size="sm" variant="outline" className="h-8" onClick={() => setSelected(new Set(visible.filter(i => i.status === 'completed').map(i => i.id)))}>المركبة ({visible.filter(i => i.status === 'completed').length})</Button>}
            {selected.size > 0 && <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelected(new Set())}>إلغاء ({selected.size})</Button>}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <ScrollTopButton className="absolute bottom-24 right-6" threshold={300} />
          {error ? <div className="p-8 text-center text-destructive">{error}</div>
            : !items ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}</div>
            : !visible.length ? <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">لا توجد لوحات مطابقة{activeFilters > 0 && <div><Button size="sm" variant="outline" className="mt-3" onClick={() => { setQ(''); setTeam('all'); setAttrs(EMPTY_ATTRS); }}>مسح الفلاتر</Button></div>}</div>
            : (
              <div className={cn('grid gap-3', CARD_GRID[cardSize].text)} style={{ ...cardVars(cardSize), ['--img-w' as any]: BOARD_ROW_IMG_W[cardSize], ['--face-h' as any]: BOARD_FACE_H[cardSize], gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${(horizontal ? BOARD_ROW_MIN_W : BOARD_CARD_MIN_W)[cardSize]}px), 1fr))` }}>
                {visible.map(i => {
                  const isDone = i.status === 'completed';
                  const gallery = ([['صورة اللوحة', i.photo], ...i.selectedFaces.flatMap(face => [[`تصميم الوجه ${face}`, face === 1 ? i.designA : face === 2 ? i.designB : null], [`تركيب الوجه ${face}`, face === 1 ? i.installedA : face === 2 ? i.installedB : null]])])
                    .filter(([, src]) => !!src).map(([label, src]) => ({ src: src as string, label }));
                  return (
                    <BoardCard key={i.id} horizontal={horizontal} i={i} gallery={gallery} isDone={isDone} selected={selected.has(i.id)} busy={busy}
                      showTeam={teams.length > 1} showContract={op.contractIds.length > 1}
                      moveOptions={optionsFor([i])} override={override} designs={designs}
                      onFacesChange={faces => run(() => saveInstallationFaceSelection({ id: i.id, taskId: i.taskId, maxFaces: i.maxFaces }, faces, op), 'تم حفظ أوجه التركيب وتحديث التكاليف')}
                      onDesign={d => run(() => setBoardsDesign([i], d), 'تم تعيين التصميم')}
                      onToggle={c => toggle(i.id, c)}
                      onComplete={() => run(() => completeBoards([i], date), 'تم تسجيل التركيب')}
                      onUncomplete={() => run(() => uncompleteBoards([i]), 'تم إلغاء الإكمال')}
                      onPhotos={() => setPhotoItem(i)}
                      onMove={o => moveTo([i], o)}
                      onRemove={async () => { if (await confirm({ title: 'إزالة اللوحة', message: `إزالة ${i.name} من هذه العملية؟`, confirmText: 'إزالة', variant: 'destructive' } as any)) run(() => removeBoards([i]), 'تمت الإزالة', true); }} />
                  );
                })}
              </div>
            )}
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/30 px-4 py-3">
          <label className="flex items-center gap-2 text-sm"><CalendarDays className="h-4 w-4" />تاريخ التركيب
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 w-[160px]" />
          </label>
          {sel.length > 0 ? (
            <>
              <span className="text-sm font-semibold">{sel.length} محددة</span>
              <Button size="sm" variant="outline" className="min-h-10 cursor-pointer transition-all duration-200" disabled={busy} onClick={() => onPrint(sel.map(i => i.id))}><Printer className="h-4 w-4" />طباعة التركيب للمحددة</Button>
              <Button size="sm" disabled={busy} onClick={() => run(() => completeBoards(sel.filter(i => i.status !== 'completed'), date), 'تم تسجيل التركيب')}><CheckCircle2 className="h-4 w-4" />تم التركيب</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => setBoardsDate(sel, date), 'تم تحديث التاريخ')}><CalendarDays className="h-4 w-4" />تعيين التاريخ</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => uncompleteBoards(sel.filter(i => i.status === 'completed')), 'تم إلغاء الإكمال')}><RotateCcw className="h-4 w-4" />إلغاء الإكمال</Button>
              <MoveMenu options={optionsFor(sel)} override={override} onMove={o => moveTo(sel, o)}
                trigger={<Button size="sm" variant="outline" disabled={busy}><Users className="h-4 w-4" />نقل لفرقة</Button>} />
              <Button size="sm" variant="outline" disabled={busy} onClick={() => smartDistribute(sel)} title="كل لوحة إلى أنسب فرقة حسب المدينة والمقاس والفرقة السابقة"><Sparkles className="h-4 w-4" />توزيع ذكي</Button>
              <DesignMenu designs={designs} current={null} onPick={d => run(() => setBoardsDesign(sel, d), `تم تعيين التصميم لـ ${sel.length} لوحة`)}
                trigger={<Button size="sm" variant="outline" disabled={busy}><Palette className="h-4 w-4" />تعيين تصميم</Button>} />
              <Button size="sm" variant="ghost" className="text-destructive" disabled={busy || sel.some(i => i.status === 'completed')} onClick={async () => {
                if (await confirm({ title: 'إزالة اللوحات', message: `إزالة ${sel.length} لوحة من العملية؟`, confirmText: 'إزالة', variant: 'destructive' } as any)) run(() => removeBoards(sel), 'تمت الإزالة', true);
              }}><Trash2 className="h-4 w-4" />إزالة</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>إلغاء التحديد</Button>
            </>
          ) : <span className="text-xs text-muted-foreground">حدد لوحات لتنفيذ إجراء جماعي</span>}
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          <Button variant="outline" className="ms-auto" onClick={onClose}>إغلاق</Button>
        </footer>

        {photoItem && <PhotoDialog item={photoItem} op={op} onClose={() => setPhotoItem(null)} onSaved={() => { reload(); onChanged(); }} />}
        {addOpen && teams.length > 0 && (
          <AddBillboardsToTaskDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            taskId={team !== 'all' ? team : teams[0].taskId}
            contractId={op.contractIds[0]}
            contractIds={op.contractIds}
            existingBillboardIds={(items || []).map(i => i.billboardId)}
            customerName={op.customerName}
            onSuccess={async () => {
              setAddOpen(false);
              setBusy(true);
              try {
                const before = new Set((items || []).map(i => i.id));
                const fresh = await loadOperationBoards(op);
                await reprice(new Set(fresh.filter(i => !before.has(i.id)).map(i => i.id)));
              } finally { setBusy(false); await reload(); onChanged(); }
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
