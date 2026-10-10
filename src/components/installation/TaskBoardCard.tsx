import { useState, useEffect } from 'react';
import { BoardMediaEditor } from './BoardMediaEditor';
import { Camera, CheckCircle2, Clock, ImageIcon, MapPin, Settings2, Layers, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { resolveInstallationFacesCount } from '@/lib/installationFaces';

export function TaskBoardCard({ item, billboard, taskType, contractId, design, selected, printActive, paused, replacement, onSelect, onPhoto, onManage, onPreview, onRefresh, taskDesigns = [], adType, editRequest }: {
  item: any; billboard: any; taskType?: string; contractId?: number; design?: any; selected: boolean;
  printActive: boolean; paused?: boolean; replacement?: boolean; onSelect: (checked: boolean) => void;
  onPhoto: () => void; onManage: () => void; onPreview: (url: string) => void;
  onRefresh?: () => void; taskDesigns?: any[]; adType?: string; editRequest?: {mode: 'design' | 'photos'; nonce: number};
}) {
  const [editorMode, setEditorMode] = useState<'design' | 'photos' | null>(null);
  useEffect(() => { if (editRequest) setEditorMode(editRequest.mode); }, [editRequest]);
  const done = item.status === 'completed';
  const image = done ? item.installed_image_face_a_url || item.installed_image_url || billboard?.Image_URL : billboard?.Image_URL;
  const designUrl = design?.design_face_a_url || item.design_face_a;
  const name = billboard?.Billboard_Name || `لوحة #${item.billboard_id}`;
  const landmark = String(billboard?.Nearest_Landmark || billboard?.Nearest_landmark || billboard?.location || '').trim();
  const district = String(billboard?.District || billboard?.district || billboard?.Area || billboard?.area || '').trim();
  const municipality = String(billboard?.Municipality || billboard?.municipality || billboard?.Municipality_Name || '').trim();
  const faces = resolveInstallationFacesCount(item, billboard, taskType);
  return <article className={cn('flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card shadow-card transition-colors duration-200', selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/40')} dir="rtl">
    <header className="flex items-center gap-2 px-3 py-2.5">
      <Checkbox checked={selected} onCheckedChange={value => onSelect(value === true)} aria-label={`تحديد ${name}`} />
      <h3 className="min-w-0 flex-1 truncate text-[13px] font-bold" title={name}>{name}</h3>
      <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-[11px] font-semibold" dir="ltr">{billboard?.Size || '—'}</span><Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={onManage} aria-label="إدارة اللوحة"><Settings2 className="h-4 w-4"/><span className="sr-only">إدارة اللوحة</span></Button>
    </header>
    <button type="button" className="relative aspect-[16/10] w-full overflow-hidden bg-muted cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" onClick={() => image && onPreview(image)} aria-label={`عرض صورة ${name}`} disabled={!image}>
      {image ? <img src={image} alt={name} className="h-full w-full object-cover" loading="lazy" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = "/placeholder.svg"; }} /> : <span className="flex h-full items-center justify-center"><ImageIcon className="h-8 w-8 text-muted-foreground" /></span>}
      <span className={cn('absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md border bg-card/95 px-2 py-1 text-[11px] font-semibold shadow-sm', done ? 'text-success border-success/25' : 'text-warning border-warning/25')}>{done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}{done ? 'مكتملة' : 'بانتظار التركيب'}</span>
    </button>
    <div className="flex flex-1 flex-col gap-3 p-3">
      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        {contractId && <span>عقد #{contractId}</span>}<span>{faces === 1 ? 'وجه واحد' : 'وجهين'}</span>{printActive && <span className="text-info">مع الطباعة</span>}
        {paused && <span className="text-warning">موقوفة</span>}{replacement && <span className="text-info">بديلة</span>}
      </div>
      <dl className="space-y-3 rounded-lg border border-border/70 p-3 text-[12px]">
        <div>
          <dt className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" />أقرب نقطة دالة</dt>
          <dd className="break-words leading-relaxed">{landmark || 'غير محددة'}</dd>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-border/60 pt-2">
          <div className="min-w-0"><dt className="mb-1 text-[11px] text-muted-foreground">المنطقة</dt><dd className="break-words leading-relaxed">{district || 'غير محددة'}</dd></div>
          <div className="min-w-0"><dt className="mb-1 text-[11px] text-muted-foreground">البلدية</dt><dd className="break-words leading-relaxed">{municipality || 'غير محددة'}</dd></div>
        </div>
      </dl>
      {!editorMode && <div className="overflow-hidden rounded-lg border border-border bg-muted/25">
        <div className="flex items-center gap-2 px-3 py-2"><Layers className="h-4 w-4 shrink-0 text-muted-foreground" /><div className="min-w-0"><p className="text-[10px] text-muted-foreground">التصميم المطبق</p><p className={cn('break-words text-[12px] font-medium', !designUrl && 'text-warning')}>{design?.design_name || (designUrl ? 'تصميم محفوظ' : 'لم يوزع بعد')}</p></div></div>
        {designUrl && <button type="button" onClick={() => onPreview(designUrl)} className="group relative block w-full cursor-pointer border-t border-border bg-background p-2 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" aria-label={`عرض تصميم ${name}`}><img src={designUrl} alt="التصميم المطبق" className="h-32 w-full object-contain" /><span className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary"><Maximize2 className="h-3.5 w-3.5" />تكبير التصميم</span></button>}
      </div>}
      {editorMode && onRefresh ? <BoardMediaEditor key={`${item.id}-${editorMode}`} mode={editorMode} item={item} billboard={billboard} taskType={taskType} designs={taskDesigns} contractId={contractId} adType={adType} onRefresh={onRefresh} onClose={() => setEditorMode(null)} /> : <footer className="mt-auto grid grid-cols-2 gap-2 border-t border-border pt-3">
        <Button size="sm" variant="outline" onClick={() => onRefresh ? setEditorMode('design') : onManage()} className="h-10 gap-1.5 text-[12px]"><Layers className="h-4 w-4" />تعديل التصميم</Button>
        <Button size="sm" onClick={() => onRefresh ? setEditorMode('photos') : onPhoto()} className="h-10 gap-1.5 text-[12px]"><Camera className="h-4 w-4" />{done ? 'صور التركيب' : 'إضافة صورة'}</Button>
      </footer>}

    </div>
  </article>;
}
