import { useCallback, useState, useRef, useEffect } from 'react';
import { Camera, Check, Loader2, Palette, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImageUploadZone } from '@/components/ui/image-upload-zone';
import { supabase } from '@/integrations/supabase/client';
import { assignBoardDesign, saveBoardPhotos } from '@/services/boardMediaService';
import { resolveInstallationFacesCount } from '@/lib/installationFaces';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function BoardMediaEditor({ mode, item, billboard, taskType, designs, contractId, adType = '', onClose, onRefresh }: {
  mode: 'design' | 'photos'; item: any; billboard: any; taskType?: string; designs: any[]; contractId?: number;
  adType?: string; onClose: () => void; onRefresh: () => void;
}) {
  const editorRef = useRef<HTMLElement>(null);
  useEffect(() => { editorRef.current?.scrollIntoView({block:'nearest',behavior:'auto'}); }, []);
  const [newDesign, setNewDesign] = useState(false);
  const [name, setName] = useState('');
  const [faceA, setFaceA] = useState(mode === 'photos' ? item.installed_image_face_a_url || '' : '');
  const [faceB, setFaceB] = useState(mode === 'photos' ? item.installed_image_face_b_url || '' : '');
  const [extraDesigns, setExtraDesigns] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingA, setUploadingA] = useState(false);
  const [uploadingB, setUploadingB] = useState(false);
  const uploadAChanged = useCallback((value: boolean) => setUploadingA(value), []);
  const uploadBChanged = useCallback((value: boolean) => setUploadingB(value), []);
  const busy = saving || uploadingA || uploadingB;
  const available = [...designs, ...extraDesigns.filter(d => !designs.some(existing => existing.id === d.id))];
  const folder = `${mode === 'photos' ? 'installation-photos' : 'designs'}/C${contractId || 'task'}_re${String(item.task_id).slice(0, 6)}`;
  const uploadName = `${billboard?.Billboard_Name || item.billboard_id}_${item.id}_${Date.now()}`;
  const twoFaces = mode === 'design' || resolveInstallationFacesCount(item, billboard, taskType) > 1;

  const applyDesign = async (design: any | null) => {
    setSaving(true);
    try {
      await assignBoardDesign(item, design, contractId);
      toast.success('تم تطبيق التصميم على اللوحة'); onRefresh(); onClose();
    } catch (error: any) {
      toast.error(error.message || 'تعذر حفظ التصميم'); onRefresh();
    } finally { setSaving(false); }
  };
  const save = async () => {
    if (busy) return;
    setSaving(true);
    try {
      if (mode === 'photos') {
        await saveBoardPhotos(item, billboard, adType, faceA, faceB);
        toast.success('تم حفظ صور التركيب'); onRefresh(); onClose();
      } else {
        if (!faceA) { toast.error('ارفع التصميم الأمامي أولاً'); return; }
        const { data, error } = await supabase.from('task_designs').insert({
          task_id: item.task_id, design_name: name.trim() || adType || 'تصميم اللوحة',
          design_face_a_url: faceA, design_face_b_url: faceB || null, design_order: available.length,
        }).select().single();
        if (error) throw error;
        setExtraDesigns(existing => [...existing, data]); setNewDesign(false);
        await assignBoardDesign(item, data, contractId);
        toast.success('تمت إضافة التصميم وتطبيقه'); onRefresh(); onClose();
      }
    } catch (error: any) { toast.error(error.message || 'تعذر الحفظ'); onRefresh(); }
    finally { setSaving(false); }
  };
  return <section ref={editorRef} className="space-y-3 rounded-xl border border-primary/30 bg-card p-3" dir="rtl" aria-label={mode === 'design' ? 'تعديل تصميم اللوحة' : 'رفع صور تركيب اللوحة'}>
    <header className="flex items-center justify-between gap-2"><h4 className="flex items-center gap-2 text-[13px] font-bold">{mode === 'design' ? <Palette className="h-4 w-4" /> : <Camera className="h-4 w-4" />}{mode === 'design' ? 'تصميم هذه اللوحة' : 'صور تركيب هذه اللوحة'}</h4><Button size="icon" variant="ghost" className="h-9 w-9" disabled={busy} onClick={onClose} aria-label="إغلاق التعديل"><X className="h-4 w-4" /></Button></header>
    {mode === 'design' && !newDesign ? <>
      <p className="text-[11px] text-muted-foreground">اضغط على التصميم لتطبيقه مباشرة.</p>
      <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto">{available.map(design => <button type="button" key={design.id} disabled={busy} onClick={() => applyDesign(design)} className={cn('cursor-pointer overflow-hidden rounded-lg border p-2 text-right transition-colors hover:border-primary', item.selected_design_id === design.id ? 'border-primary bg-primary/5' : 'border-border')}><img src={design.design_face_a_url} alt={design.design_name} className="h-20 w-full object-contain" /><span className="mt-2 flex items-center gap-1 text-[11px]">{item.selected_design_id === design.id && <Check className="h-3 w-3 shrink-0 text-primary" />}<span className="break-words">{design.design_name || 'تصميم'}</span></span></button>)}</div>
      <Button size="sm" variant="outline" className="w-full" disabled={busy} onClick={() => setNewDesign(true)}><Plus className="h-4 w-4" />رفع تصميم جديد لهذه اللوحة</Button>
      {item.selected_design_id && <Button size="sm" variant="ghost" disabled={busy} onClick={() => applyDesign(null)}>إزالة تعيين التصميم</Button>}
    </> : <>
      {mode === 'design' && <Input value={name} onChange={e => setName(e.target.value)} placeholder="اسم التصميم (اختياري)" aria-label="اسم التصميم الجديد" disabled={busy} />}
      <ImageUploadZone value={faceA} showPreview={!!faceA} onChange={setFaceA} onUploadingChange={uploadAChanged} showUrlInput={false} label={mode === 'design' ? 'تصميم الوجه الأمامي' : 'صورة تركيب الوجه الأمامي'} imageName={`${uploadName}_face-A`} folder={folder} disabled={saving} previewHeight="h-28" />
      {twoFaces && <ImageUploadZone value={faceB} showPreview={!!faceB} onChange={setFaceB} onUploadingChange={uploadBChanged} showUrlInput={false} label={mode === 'design' ? 'تصميم الوجه الخلفي (اختياري)' : 'صورة تركيب الوجه الخلفي'} imageName={`${uploadName}_face-B`} folder={folder} disabled={saving} previewHeight="h-28" />}
      <Button size="sm" className="w-full" onClick={save} disabled={busy || (mode === 'design' ? !faceA : !faceA && !faceB)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{mode === 'design' ? 'حفظ وتطبيق التصميم' : 'حفظ صور التركيب'}</Button>
      {mode === 'design' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setNewDesign(false)}>اختيار تصميم موجود</Button>}
    </>}
  </section>;
}
