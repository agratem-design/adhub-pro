import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { buildDesignAssignmentPlan } from '@/lib/designAssignmentPlan';
import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Layers, Grid3x3, Ruler, Shuffle, Check,
  Image as ImageIcon, Palette,
  Trash2
} from 'lucide-react';

interface TaskDesign {
  id: string;
  design_name: string;
  design_face_a_url: string;
  design_face_b_url?: string;
}

interface TaskItem {
  id: string;
  billboard_id: number;
  selected_design_id?: string;
  design_face_a?: string;
  design_face_b?: string;
  status?: string;
  billboards?: {
    ID: number;
    Billboard_Name: string;
    Size: string;
    Image_URL?: string;
  };
}

interface BulkDesignAssignerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskItems: TaskItem[];
  taskDesigns: TaskDesign[];
  onSuccess: () => void;
}

type AssignMode = 'unassigned' | 'all' | 'by_size' | 'distribute' | 'manual' | 'delete_all' | 'delete_by_size';

export function BulkDesignAssigner({
  open,
  onOpenChange,
  taskItems,
  taskDesigns,
  onSuccess
}: BulkDesignAssignerProps) {
  const [assignMode, setAssignMode] = useState<AssignMode>('all');
  const [selectedDesignIds, setSelectedDesignIds] = useState<string[]>([]);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedDistributeSizes, setSelectedDistributeSizes] = useState<string[]>([]);
  const [selectedBillboardIds, setSelectedBillboardIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [boardSearch, setBoardSearch] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [designSearch, setDesignSearch] = useState('');
  const [pendingOnly, setPendingOnly] = useState(false);
  const [customQuantities, setCustomQuantities] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  useEffect(() => { if (open) { resetForm(); setBoardSearch(''); setShowPreview(false); } }, [open]);

  // استخراج المقاسات الفريدة مع العدد
  const sizesWithCount = useMemo(() => {
    const sizeMap: Record<string, number> = {};
    taskItems.forEach(item => {
      if (item.billboards?.Size) {
        sizeMap[item.billboards.Size] = (sizeMap[item.billboards.Size] || 0) + 1;
      }
    });
    return Object.entries(sizeMap).sort((a, b) => b[1] - a[1]);
  }, [taskItems]);

  // حذف التصاميم من اللوحات
  const handleDeleteDesigns = async () => {
    setSaving(true);
    try {
      const itemsToUpdate = targetItems;

      if (itemsToUpdate.length === 0) {
        toast.error('لا توجد لوحات لحذف التصميم منها');
        setSaving(false);
        return;
      }

      for (let offset = 0; offset < itemsToUpdate.length; offset += 200) {
        const { error } = await supabase.from('installation_task_items').update({
          selected_design_id: null, design_face_a: null, design_face_b: null,
        }).in('id', itemsToUpdate.slice(offset, offset + 200).map(item => item.id));
        if (error) throw error;
      }

      toast.success(`تم حذف التصاميم من ${itemsToUpdate.length} لوحة بنجاح`);
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error deleting designs:', error);
      toast.error('فشل في حذف التصاميم');
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async () => {
    if (assignMode === 'delete_all' || assignMode === 'delete_by_size') {
      await handleDeleteDesigns();
      return;
    }

    if (selectedDesignIds.length === 0) {
      toast.error('يرجى اختيار تصميم واحد على الأقل');
      return;
    }

    setSaving(true);
    try {
      const itemsToUpdate = targetItems;
      if (!quantitiesValid) { toast.error('راجع كميات التصاميم؛ مجموعها يجب أن يساوي عدد اللوحات.'); return; }
      if (itemsToUpdate.length === 0) {
        toast.error('لا توجد لوحات لتحديث التصميم لها');
        setSaving(false);
        return;
      }

      // جلب تفاصيل التصاميم للحفظ
      const { data: designsData, error: designsError } = await supabase
        .from('task_designs')
        .select('id, design_face_a_url, design_face_b_url')
        .in('id', selectedDesignIds);

      if (designsError) throw designsError;

      if (selectedDesignIds.some(id => !designsData?.some(d => d.id === id))) {
        throw new Error('أحد التصاميم لم يعد متاحاً، أعد فتح التوزيع.');
      }
      for (const designId of selectedDesignIds) {
        const ids = plan.filter(row => row.designId === designId).map(row => row.itemId);
        const design = designsData!.find(d => d.id === designId)!;
        for (let offset = 0; offset < ids.length; offset += 200) {
          const { error } = await supabase.from('installation_task_items').update({
            selected_design_id: design.id,
            design_face_a: design.design_face_a_url,
            design_face_b: design.design_face_b_url || null,
          }).in('id', ids.slice(offset, offset + 200));
          if (error) throw error;
        }
      }

      toast.success(`تم تعيين التصاميم لـ ${itemsToUpdate.length} لوحة بنجاح`);
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error assigning designs:', error);
      toast.error('فشل في تعيين التصاميم');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setAssignMode('all');
    setDesignSearch(''); setPendingOnly(false); setCustomQuantities(false); setQuantities({});
    setSelectedDesignIds([]);
    setSelectedSize('');
    setSelectedDistributeSizes([]);
    setSelectedBillboardIds(new Set());
  };

  const toggleDesignSelection = (designId: string) => {
    setCustomQuantities(false); setQuantities({});
    setSelectedDesignIds(prev =>
      prev.includes(designId)
        ? prev.filter(id => id !== designId)
        : [...prev, designId]
    );
  };

  const toggleDistributeSize = (size: string) => {
    setSelectedDistributeSizes(prev =>
      prev.includes(size)
        ? prev.filter(s => s !== size)
        : [...prev, size]
    );
  };

  const toggleBillboardSelection = (itemId: string) => {
    setSelectedBillboardIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const clearBillboardSelection = () => {
    setSelectedBillboardIds(new Set());
  };

  const isDeleteMode = assignMode === 'delete_all' || assignMode === 'delete_by_size';
  const unassignedCount = taskItems.filter(item => !item.selected_design_id && !item.design_face_a && !item.design_face_b).length;
  const targetItems = taskItems.filter(item => {
    if (pendingOnly && item.status === 'completed') return false;
    if (assignMode === 'unassigned') return !item.selected_design_id && !item.design_face_a && !item.design_face_b;
    if (assignMode === 'by_size' || assignMode === 'delete_by_size') return item.billboards?.Size === selectedSize;
    if (assignMode === 'manual') return selectedBillboardIds.has(item.id);
    if (assignMode === 'distribute' && selectedDistributeSizes.length) return selectedDistributeSizes.includes(item.billboards?.Size || '');
    return true;
  });
  const totalQuantity = selectedDesignIds.reduce((sum,id) => sum + (quantities[id] || 0), 0);
  const quantitiesValid = !customQuantities || (totalQuantity === targetItems.length && selectedDesignIds.every(id => Number.isInteger(quantities[id]) && quantities[id] >= 0));
  const balancedPlan = buildDesignAssignmentPlan(targetItems.map(i => i.id), selectedDesignIds, assignMode === 'distribute');
  const plan = quantitiesValid ? buildDesignAssignmentPlan(targetItems.map(i => i.id), selectedDesignIds, assignMode === 'distribute', customQuantities ? quantities : undefined) : [];
  const visibleDesigns = taskDesigns.filter(d => (d.design_name || '').toLowerCase().includes(designSearch.toLowerCase()));
  const visibleBoards = taskItems.filter(item => (!pendingOnly || item.status !== 'completed') && `${item.billboards?.Billboard_Name || item.billboard_id} ${item.billboards?.Size || ''}`.toLowerCase().includes(boardSearch.toLowerCase()));
  const canSave = !saving && quantitiesValid && targetItems.length > 0 && (isDeleteMode || selectedDesignIds.length > 0);
  const changeMode = (mode: AssignMode) => {
    setAssignMode(mode); setShowPreview(false); setCustomQuantities(false); setQuantities({});
    if (mode !== 'distribute') setSelectedDesignIds(ids => ids.slice(0, 1));
  };
  const modes: { mode: AssignMode; label: string; icon: typeof Layers }[] = [
    { mode: 'unassigned', label: 'بدون تصميم', icon: ImageIcon },
    { mode: 'all', label: 'كل اللوحات', icon: Grid3x3 },
    { mode: 'by_size', label: 'حسب المقاس', icon: Ruler },
    { mode: 'manual', label: 'لوحات محددة', icon: Check },
    { mode: 'distribute', label: 'توزيع متساوٍ', icon: Shuffle },
  ];
  return (
    <Dialog open={open} onOpenChange={value => { if (!saving) onOpenChange(value); }}>
      <DialogContent dir="rtl" className="flex max-h-[92dvh] w-[calc(100vw-24px)] max-w-6xl flex-col gap-0 overflow-hidden rounded-2xl border-border bg-background p-0 [&_button]:cursor-pointer [&_button]:transition-colors [&_button]:duration-200">
        <DialogHeader className="shrink-0 border-b border-border bg-card px-4 py-4 pl-12 text-right sm:px-6">
          <DialogTitle className="flex items-center gap-2 text-lg"><Palette className="h-5 w-5 text-primary" />توزيع التصاميم</DialogTitle>
          <DialogDescription className="text-right">حدد اللوحات والتصاميم، وراجع التوزيع قبل تطبيقه.</DialogDescription>
        </DialogHeader>
        <div aria-busy={saving} className={cn("min-h-0 flex-1 overflow-y-auto p-4 sm:p-5", saving && "pointer-events-none opacity-70")}>
          <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="min-w-0 space-y-4">
              <section className="rounded-xl border border-border bg-card p-3">
                <h3 className="mb-3 text-[13px] font-bold">1. اختر اللوحات</h3>
                <div className="grid grid-cols-2 gap-2">{modes.map(({mode,label,icon:Icon}) => <button type="button" key={mode} onClick={() => changeMode(mode)} aria-pressed={assignMode===mode} className={cn('flex min-h-11 items-center gap-2 rounded-lg border px-2 text-right text-[12px]',assignMode===mode?'border-primary bg-primary/10 text-primary':'border-border hover:bg-muted')}><Icon className="h-4 w-4 shrink-0" />{label}</button>)}</div>
                <p className="mt-2 text-[11px] text-muted-foreground">{unassignedCount} لوحة بدون تصميم</p><label className="mt-3 flex min-h-10 cursor-pointer items-center gap-2 rounded-lg bg-muted/40 px-2 text-[12px]"><Checkbox checked={pendingOnly} onCheckedChange={v=>setPendingOnly(v===true)} />اللوحات غير المكتملة فقط</label>
                {(assignMode==='by_size'||assignMode==='delete_by_size'||assignMode==='distribute') && <div className="mt-4 border-t border-border pt-3"><p className="mb-2 text-[12px] text-muted-foreground">{assignMode==='distribute'?'المقاسات المستهدفة (الكل افتراضياً)':'اختر المقاس'}</p><div className="flex flex-wrap gap-2">{sizesWithCount.map(([size,count]) => <button type="button" key={size} aria-pressed={assignMode==='distribute'?selectedDistributeSizes.includes(size):selectedSize===size} onClick={() => assignMode==='distribute'?toggleDistributeSize(size):setSelectedSize(size)} className={cn('min-h-10 rounded-lg border px-3 text-[12px]',(assignMode==='distribute'?selectedDistributeSizes.includes(size):selectedSize===size)?'border-primary bg-primary/10 text-primary':'border-border hover:bg-muted')}>{size} <span className="text-muted-foreground">({count})</span></button>)}</div>{assignMode==='distribute'&&selectedDistributeSizes.length>0&&<Button variant="ghost" size="sm" onClick={()=>setSelectedDistributeSizes([])} className="mt-2">كل المقاسات</Button>}</div>}
              </section>
              {assignMode==='manual'&&<section className="rounded-xl border border-border bg-card p-3"><Input value={boardSearch} onChange={e=>setBoardSearch(e.target.value)} placeholder="بحث عن لوحة أو مقاس" aria-label="البحث في لوحات التوزيع" /><div className="my-2 flex items-center justify-between gap-2 text-[12px]"><span>{selectedBillboardIds.size} محددة</span><div className="flex"><Button variant="ghost" size="sm" onClick={()=>setSelectedBillboardIds(new Set([...selectedBillboardIds,...visibleBoards.map(i=>i.id)]))}>تحديد الظاهر</Button><Button variant="ghost" size="sm" onClick={clearBillboardSelection}>مسح</Button></div></div><div className="max-h-64 space-y-1 overflow-y-auto">{visibleBoards.map(item=><label key={item.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg p-2 hover:bg-muted"><Checkbox checked={selectedBillboardIds.has(item.id)} onCheckedChange={()=>toggleBillboardSelection(item.id)} aria-label={`تحديد ${item.billboards?.Billboard_Name || item.billboard_id}`} /><span className="min-w-0 flex-1 truncate text-[12px]">{item.billboards?.Billboard_Name||`لوحة #${item.billboard_id}`}</span><span className="text-[11px] text-muted-foreground">{item.billboards?.Size}</span></label>)}{!visibleBoards.length&&<p className="py-4 text-center text-[12px] text-muted-foreground">لا توجد نتائج</p>}</div></section>}
              {assignMode==='distribute'&&selectedDesignIds.length>0&&<section className="rounded-xl border border-border bg-card p-3"><div className="flex items-center justify-between gap-2"><h3 className="text-[13px] font-bold">كميات التصاميم</h3><Button variant="ghost" size="sm" onClick={()=>{setCustomQuantities(false);setQuantities({});}}>تساوي تلقائي</Button></div><label className="my-2 flex min-h-10 cursor-pointer items-center gap-2 text-[12px]"><Checkbox checked={customQuantities} onCheckedChange={v=>{setCustomQuantities(v===true);setQuantities(Object.fromEntries(selectedDesignIds.map(id=>[id,balancedPlan.filter(p=>p.designId===id).length])));}}/>تحديد الكميات بنفسي</label><div className="space-y-2">{selectedDesignIds.map(id=><div key={id} className="flex items-center justify-between gap-2"><span className="min-w-0 flex-1 truncate text-[12px]">{taskDesigns.find(d=>d.id===id)?.design_name}</span>{customQuantities?<Input type="number" min={0} max={targetItems.length} step={1} value={quantities[id]??0} aria-label={`عدد لوحات ${taskDesigns.find(d=>d.id===id)?.design_name}`} onChange={e=>setQuantities(q=>({...q,[id]:Number(e.target.value)}))} className="h-10 w-20"/>:<span className="text-[12px] font-semibold">{balancedPlan.filter(p=>p.designId===id).length} لوحة</span>}</div>)}</div>{customQuantities&&<p className={cn('mt-3 text-[12px]',quantitiesValid?'text-success':'text-destructive')}>المجموع {totalQuantity} / {targetItems.length}{!quantitiesValid?' · عدّل الكميات لتطابق عدد اللوحات':''}</p>}</section>}
              <section className="rounded-xl border border-primary/25 bg-primary/5 p-4"><p className="text-[12px] text-muted-foreground">اللوحات المستهدفة</p><p className="mt-1 text-2xl font-bold">{targetItems.length} <span className="text-[13px] font-normal">من {taskItems.length} لوحة</span></p><p className="mt-2 text-[12px] text-muted-foreground">{isDeleteMode?'إزالة التعيين من اللوحات فقط':`${selectedDesignIds.length} تصميم مختار`}</p></section>
              <details className="rounded-xl border border-border bg-card p-3"><summary className="cursor-pointer text-[12px] text-muted-foreground">إزالة تعيين التصاميم</summary><p className="my-3 text-[11px] text-muted-foreground">تبقى ملفات التصاميم محفوظة في المهمة.</p><div className="flex flex-wrap gap-2"><Button variant={assignMode==='delete_all'?'destructive':'outline'} size="sm" onClick={()=>changeMode('delete_all')}>من كل اللوحات</Button><Button variant={assignMode==='delete_by_size'?'destructive':'outline'} size="sm" onClick={()=>changeMode('delete_by_size')}>من مقاس محدد</Button></div></details>
            </aside>
            <section className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-[14px] font-bold">{showPreview?'3. مراجعة التوزيع':isDeleteMode?'مراجعة الإزالة':'2. اختر التصميم'}</h3><Button variant="outline" size="sm" onClick={()=>setShowPreview(v=>!v)} disabled={!showPreview&&!isDeleteMode&&(!selectedDesignIds.length||!quantitiesValid)}>{showPreview?'العودة للتصاميم':'معاينة التوزيع'}</Button></div>
              {isDeleteMode ? <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-5"><Trash2 className="mb-3 h-7 w-7 text-destructive"/><h4 className="text-[14px] font-bold">إزالة التصاميم من {targetItems.length} لوحة</h4><p className="mt-2 text-[12px] text-muted-foreground">سيتم إفراغ التصميم الأمامي والخلفي والتعيين الحالي للوحات المستهدفة.</p>{!targetItems.length&&<p className="mt-3 text-[12px] text-warning">اختر مقاساً يحتوي على لوحات.</p>}</div> : showPreview ? <div className="space-y-4"><div className="flex flex-wrap gap-2">{selectedDesignIds.map(id=><span key={id} className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-[12px]">{taskDesigns.find(d=>d.id===id)?.design_name||'تصميم'} · {plan.filter(p=>p.designId===id).length} لوحة</span>)}</div><div className="overflow-hidden rounded-xl border border-border"><div className="grid grid-cols-2 gap-3 border-b border-border bg-muted px-3 py-2 text-[12px] font-bold"><span>اللوحة والمقاس</span><span>التصميم بعد التطبيق</span></div><div className="max-h-96 overflow-y-auto">{plan.map(row=>{const item=taskItems.find(i=>i.id===row.itemId)!,design=taskDesigns.find(d=>d.id===row.designId);return <div key={row.itemId} className="grid grid-cols-2 items-center gap-3 border-b border-border/60 px-3 py-2 last:border-0"><div className="min-w-0"><p className="truncate text-[12px] font-medium">{item.billboards?.Billboard_Name||`لوحة #${item.billboard_id}`}</p><span className="text-[11px] text-muted-foreground">{item.billboards?.Size}</span><p className="mt-1 text-[10px] text-muted-foreground">الحالي: {taskDesigns.find(d=>d.id===item.selected_design_id)?.design_name || (item.design_face_a||item.design_face_b?'تصميم محفوظ':'بدون تصميم')}</p></div><div className="flex min-w-0 items-center gap-2">{design?.design_face_a_url&&<img src={design.design_face_a_url} alt="التصميم" className="h-9 w-12 shrink-0 rounded border border-border object-contain"/>}<span className="truncate text-[12px]">{design?.design_name}</span></div></div>;})}{!plan.length&&<p className="p-6 text-center text-[12px] text-muted-foreground">لا توجد لوحات مستهدفة.</p>}</div></div></div> : <><Input value={designSearch} onChange={e=>setDesignSearch(e.target.value)} placeholder="ابحث باسم التصميم..." aria-label="البحث في التصاميم" className="mb-3"/><p className="mb-4 text-[12px] text-muted-foreground">{assignMode==='distribute'?(customQuantities?'توزع التصاميم حسب الكميات التي حددتها.':'اختر عدة تصاميم؛ توزع بالتساوي وفق ترتيب اختيارها.'):'يطبق تصميم واحد على اللوحات المستهدفة.'}</p><div className="grid gap-3 sm:grid-cols-2">{visibleDesigns.map(design=>{const selected=selectedDesignIds.includes(design.id);return <button type="button" key={design.id} aria-pressed={selected} onClick={()=>assignMode==='distribute'?toggleDesignSelection(design.id):setSelectedDesignIds([design.id])} className={cn('min-w-0 rounded-xl border bg-card p-3 text-right hover:border-primary/50',selected?'border-primary ring-2 ring-primary/15':'border-border')}><div className="mb-3 flex items-center justify-between gap-2"><h4 className="truncate text-[13px] font-semibold">{design.design_name||'تصميم بدون اسم'}</h4>{selected&&<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] text-primary-foreground">{assignMode==='distribute'?selectedDesignIds.indexOf(design.id)+1:<Check className="h-4 w-4"/>}</span>}</div><div className="grid grid-cols-2 gap-2">{[design.design_face_a_url,design.design_face_b_url].map((url,index)=><div key={index}><p className="mb-1 text-center text-[10px] text-muted-foreground">{index===0?'الوجه الأمامي':'الوجه الخلفي'}</p><div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">{url?<img src={url} alt={index===0?'تصميم أمامي':'تصميم خلفي'} className="h-full w-full object-contain" onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src='/placeholder.svg';}}/>:<ImageIcon className="h-5 w-5 text-muted-foreground"/>}</div></div>)}</div></button>;})}</div>{!visibleDesigns.length&&taskDesigns.length>0&&<p className="p-6 text-center text-[12px] text-muted-foreground">لا توجد تصاميم مطابقة للبحث.</p>}{!taskDesigns.length&&<div className="rounded-xl border border-dashed border-border p-10 text-center"><ImageIcon className="mx-auto mb-3 h-7 w-7 text-muted-foreground"/><p className="text-[13px]">لا توجد تصاميم. أضفها من إدارة التصاميم أولاً.</p></div>}</>}
            </section>
          </div>
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-card p-4"><p className="text-[12px] text-muted-foreground">{targetItems.length} لوحة ستتغير عند التطبيق</p><div className="flex gap-2"><Button variant="outline" disabled={saving} onClick={()=>onOpenChange(false)}>إلغاء</Button><Button disabled={!canSave} variant={isDeleteMode?'destructive':'default'} onClick={handleAssign}>{saving?'جارٍ الحفظ...':isDeleteMode?'إزالة التعيين':`تطبيق على ${targetItems.length} لوحة`}</Button></div></footer>
      </DialogContent>
    </Dialog>
  );
}
