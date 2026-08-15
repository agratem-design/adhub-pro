import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  Layers, Grid3x3, Ruler, Shuffle, Check, 
  Image as ImageIcon, Palette, CheckCircle2, 
  Trash2, SlidersHorizontal, Info 
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
  billboards?: {
    ID: number;
    Billboard_Name: string;
    Size: string;
  };
}

interface BulkDesignAssignerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskItems: TaskItem[];
  taskDesigns: TaskDesign[];
  onSuccess: () => void;
}

type AssignMode = 'all' | 'by_size' | 'distribute' | 'manual' | 'delete_all' | 'delete_by_size';

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
      let itemsToUpdate: TaskItem[] = [];

      if (assignMode === 'delete_all') {
        itemsToUpdate = taskItems;
      } else if (assignMode === 'delete_by_size') {
        if (!selectedSize) {
          toast.error('يرجى اختيار المقاس');
          setSaving(false);
          return;
        }
        itemsToUpdate = taskItems.filter(
          item => item.billboards?.Size === selectedSize
        );
      }

      if (itemsToUpdate.length === 0) {
        toast.error('لا توجد لوحات لحذف التصميم منها');
        setSaving(false);
        return;
      }

      // حذف التصاميم
      for (const item of itemsToUpdate) {
        const { error } = await supabase
          .from('installation_task_items')
          .update({
            selected_design_id: null,
            design_face_a: null,
            design_face_b: null
          })
          .eq('id', item.id);

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
      let itemsToUpdate: TaskItem[] = [];

      switch (assignMode) {
        case 'all':
          itemsToUpdate = taskItems;
          break;

        case 'by_size':
          if (!selectedSize) {
            toast.error('يرجى اختيار المقاس');
            setSaving(false);
            return;
          }
          itemsToUpdate = taskItems.filter(
            item => item.billboards?.Size === selectedSize
          );
          break;

        case 'distribute':
          itemsToUpdate = taskItems;
          if (selectedDistributeSizes.length > 0) {
            itemsToUpdate = itemsToUpdate.filter(
              item => item.billboards?.Size && selectedDistributeSizes.includes(item.billboards.Size)
            );
          }
          break;

        case 'manual':
          if (selectedBillboardIds.size === 0) {
            toast.error('يرجى اختيار لوحة واحدة على الأقل');
            setSaving(false);
            return;
          }
          itemsToUpdate = taskItems.filter(item =>
            selectedBillboardIds.has(item.id)
          );
          break;
      }

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

      // تطبيق التصاميم
      if (assignMode === 'distribute' && selectedDesignIds.length > 1) {
        // توزيع متساوي لعدة تصاميم
        const itemsPerDesign = Math.ceil(itemsToUpdate.length / selectedDesignIds.length);
        
        for (let i = 0; i < itemsToUpdate.length; i++) {
          const designIndex = Math.floor(i / itemsPerDesign);
          const designId = selectedDesignIds[Math.min(designIndex, selectedDesignIds.length - 1)];
          const design = designsData?.find(d => d.id === designId);
          
          const updateData: any = { selected_design_id: designId };
          if (design) {
            updateData.design_face_a = design.design_face_a_url;
            updateData.design_face_b = design.design_face_b_url || null;
          }
          
          const { error } = await supabase
            .from('installation_task_items')
            .update(updateData)
            .eq('id', itemsToUpdate[i].id);

          if (error) throw error;
        }
      } else {
        // تعيين نفس التصميم لكل اللوحات المختارة (أو التوزيع لتصميم واحد)
        const designId = selectedDesignIds[0];
        const design = designsData?.find(d => d.id === designId);
        
        const updateData: any = { selected_design_id: designId };
        if (design) {
          updateData.design_face_a = design.design_face_a_url;
          updateData.design_face_b = design.design_face_b_url || null;
        }
        
        for (const item of itemsToUpdate) {
          const { error } = await supabase
            .from('installation_task_items')
            .update(updateData)
            .eq('id', item.id);

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
    setSelectedDesignIds([]);
    setSelectedSize('');
    setSelectedDistributeSizes([]);
    setSelectedBillboardIds(new Set());
  };

  const toggleDesignSelection = (designId: string) => {
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

  const selectAllBillboards = () => {
    setSelectedBillboardIds(new Set(taskItems.map(i => i.id)));
  };

  const clearBillboardSelection = () => {
    setSelectedBillboardIds(new Set());
  };

  const getAffectedCount = () => {
    switch (assignMode) {
      case 'all':
      case 'delete_all':
        return taskItems.length;
      case 'by_size':
      case 'delete_by_size':
        return taskItems.filter(i => i.billboards?.Size === selectedSize).length;
      case 'distribute':
        if (selectedDistributeSizes.length > 0) {
          return taskItems.filter(
            item => item.billboards?.Size && selectedDistributeSizes.includes(item.billboards.Size)
          ).length;
        }
        return taskItems.length;
      case 'manual':
        return selectedBillboardIds.size;
      default:
        return 0;
    }
  };

  const isDeleteMode = assignMode === 'delete_all' || assignMode === 'delete_by_size';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-[24px] border-border/40 bg-background/95 backdrop-blur-lg shadow-2xl">
        {/* Header */}
        <DialogHeader className="px-6 py-4.5 border-b border-border/30 bg-gradient-to-l from-primary/8 via-transparent to-transparent">
          <DialogTitle className="flex items-center justify-between text-xl font-black tracking-tight text-foreground/90">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-2xl shadow-inner">
                <Palette className="h-5.5 w-5.5 text-primary" />
              </div>
              <span>توزيع التصاميم على اللوحات</span>
            </div>
            <Badge className="bg-primary/15 text-primary border border-primary/25 rounded-xl px-3 py-1 font-bold text-xs shrink-0 ml-4">
              إجمالي {taskItems.length} لوحة
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Side Panel - Configuration Options */}
          <div className="w-full md:w-80 border-b md:border-b-0 md:border-l border-border/30 bg-muted/20 p-5 flex flex-col gap-5 overflow-y-auto shrink-0 select-none">
            
            {/* Assignment Modes */}
            <div className="space-y-3">
              <Label className="text-[11px] font-bold text-muted-foreground/80 flex items-center gap-2 tracking-wide uppercase">
                <SlidersHorizontal className="h-3.5 w-3.5 text-primary/70" />
                خيارات التعيين والتوزيع
              </Label>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { mode: 'all' as AssignMode, icon: Grid3x3, label: 'كل اللوحات', desc: `${taskItems.length} لوحة` },
                  { mode: 'by_size' as AssignMode, icon: Ruler, label: 'حسب المقاس', desc: `${sizesWithCount.length} مقاس` },
                  { mode: 'distribute' as AssignMode, icon: Shuffle, label: 'توزيع متساوي', desc: 'عدة تصاميم' },
                  { mode: 'manual' as AssignMode, icon: Check, label: 'اختيار يدوي', desc: 'تحديد مخصص' },
                ].map(({ mode, icon: Icon, label, desc }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setAssignMode(mode);
                      // Reset values to prevent conflicting filters
                      if (mode !== 'distribute') setSelectedDistributeSizes([]);
                      if (mode !== 'by_size') setSelectedSize('');
                    }}
                    className={`relative p-3 rounded-xl border text-right transition-all duration-200 hover:scale-[1.02] ${
                      assignMode === mode
                        ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/20'
                        : 'border-border/40 bg-card/65 hover:border-primary/40 hover:bg-muted/40'
                    }`}
                  >
                    {assignMode === mode && (
                      <div className="absolute top-2 left-2">
                        <CheckCircle2 className="h-4.5 w-4.5 text-primary" />
                      </div>
                    )}
                    <Icon className={`h-5 w-5 mb-1.5 ${assignMode === mode ? 'text-primary' : 'text-muted-foreground/70'}`} />
                    <p className={`text-xs font-bold leading-tight ${assignMode === mode ? 'text-primary' : 'text-foreground/85'}`}>{label}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Delete Option */}
            <div className="space-y-3 border-t border-border/30 pt-4">
              <Label className="text-[11px] font-bold text-destructive/80 flex items-center gap-2 tracking-wide uppercase">
                <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
                حذف وإزالة التصاميم
              </Label>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { mode: 'delete_all' as AssignMode, icon: Grid3x3, label: 'حذف الكل', desc: `${taskItems.length} لوحة` },
                  { mode: 'delete_by_size' as AssignMode, icon: Ruler, label: 'حذف مقاس معين', desc: `${sizesWithCount.length} مقاس` },
                ].map(({ mode, icon: Icon, label, desc }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setAssignMode(mode);
                      setSelectedDistributeSizes([]);
                      if (mode !== 'delete_by_size') setSelectedSize('');
                    }}
                    className={`relative p-3 rounded-xl border text-right transition-all duration-200 hover:scale-[1.02] ${
                      assignMode === mode
                        ? 'border-destructive bg-destructive/10 shadow-sm ring-1 ring-destructive/20'
                        : 'border-border/40 bg-card/65 hover:border-destructive/40 hover:bg-destructive/5'
                    }`}
                  >
                    {assignMode === mode && (
                      <div className="absolute top-2 left-2">
                        <Trash2 className="h-4.5 w-4.5 text-destructive" />
                      </div>
                    )}
                    <Icon className={`h-5 w-5 mb-1.5 ${assignMode === mode ? 'text-destructive' : 'text-muted-foreground/70'}`} />
                    <p className={`text-xs font-bold leading-tight ${assignMode === mode ? 'text-destructive' : 'text-foreground/85'}`}>{label}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Target Size Select (Single Mode) */}
            {(assignMode === 'by_size' || assignMode === 'delete_by_size') && (
              <div className="space-y-2.5 border-t border-border/30 pt-4 animate-in slide-in-from-top-2 duration-200">
                <Label className="text-xs font-bold text-foreground/80">اختر المقاس المطلوب</Label>
                <div className="flex flex-wrap gap-1.5">
                  {sizesWithCount.map(([size, count]) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      className={`px-3 py-2 rounded-lg border text-xs font-bold transition-all ${
                        selectedSize === size
                          ? assignMode === 'delete_by_size' 
                            ? 'border-destructive bg-destructive text-destructive-foreground font-black'
                            : 'border-primary bg-primary text-primary-foreground font-black'
                          : 'border-border/50 bg-card hover:border-primary/40'
                      }`}
                    >
                      {size}
                      <Badge variant="secondary" className="mr-2 text-[10px] px-1.5 py-0">{count}</Badge>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Multi-Size Filter selection for Equal Distribution Mode */}
            {assignMode === 'distribute' && (
              <div className="space-y-2.5 border-t border-border/30 pt-4 animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground/80 flex items-center gap-1.5">
                    <Ruler className="h-3.5 w-3.5 text-primary/70" />
                    المقاسات المستهدفة
                  </Label>
                  {selectedDistributeSizes.length > 0 && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-primary font-bold" 
                      onClick={() => setSelectedDistributeSizes([])}
                    >
                      إلغاء التحديد
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {sizesWithCount.map(([size, count]) => {
                    const isSelected = selectedDistributeSizes.includes(size);
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => toggleDistributeSize(size)}
                        className={`px-3 py-2 rounded-lg border text-xs font-bold transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/10 text-primary font-black shadow-sm'
                            : 'border-border/50 bg-card hover:border-primary/45'
                        }`}
                      >
                        {size}
                        <Badge variant="secondary" className="mr-2 text-[10px] px-1.5 py-0">{count}</Badge>
                      </button>
                    );
                  })}
                </div>
                <div className="p-2.5 bg-muted/40 rounded-xl flex items-start gap-2 border border-border/25">
                  <Info className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground/80 leading-normal">
                    يمكن اختيار مقاس أو مقاسين أو أكثر. في حال عدم اختيار أي مقاس، سيتم التوزيع بشكل متساوٍ على جميع اللوحات المتاحة.
                  </p>
                </div>
              </div>
            )}

            {/* Manual Billboard Selection */}
            {assignMode === 'manual' && (
              <div className="space-y-2.5 border-t border-border/30 pt-4 flex-1 flex flex-col min-h-[200px] animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground/80">اختر اللوحات</Label>
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[10px] font-bold" onClick={selectAllBillboards}>
                      الكل
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[10px] font-bold" onClick={clearBillboardSelection}>
                      مسح
                    </Button>
                  </div>
                </div>
                <Badge variant="outline" className="w-fit text-[10px] px-2.5 py-0.5 font-bold border-primary/20 text-primary bg-primary/5">
                  {selectedBillboardIds.size} لوحة محددة
                </Badge>
                <ScrollArea className="flex-1 rounded-xl border border-border/30 bg-card/65 min-h-[120px]">
                  <div className="p-2 space-y-1">
                    {taskItems.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleBillboardSelection(item.id)}
                        className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-right transition-all ${
                          selectedBillboardIds.has(item.id)
                            ? 'bg-primary/8 border border-primary/25'
                            : 'hover:bg-muted/40 border border-transparent'
                        }`}
                      >
                        <Checkbox
                          checked={selectedBillboardIds.has(item.id)}
                          className="pointer-events-none data-[state=checked]:bg-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate text-foreground/85">
                            {item.billboards?.Billboard_Name || `#${item.billboard_id}`}
                          </p>
                          <p className="text-[10px] text-muted-foreground/75 mt-0.5">{item.billboards?.Size}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Summary Box */}
            {(selectedDesignIds.length > 0 || isDeleteMode) && (
              <div className={`p-3.5 rounded-2xl border mt-auto animate-in fade-in duration-300 ${
                isDeleteMode 
                  ? 'bg-destructive/8 border-destructive/20 text-destructive' 
                  : 'bg-primary/8 border-primary/20 text-primary'
              }`}>
                <p className="text-xs font-bold flex items-center gap-1.5">
                  {isDeleteMode ? <Trash2 className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  {isDeleteMode ? 'سيتم حذف التصاميم من:' : 'سيتم تطبيق التصاميم على:'}
                </p>
                <p className="text-2xl font-black mt-1.5 tracking-tight">
                  {getAffectedCount()} لوحة
                </p>
                {assignMode === 'distribute' && selectedDesignIds.length > 1 && getAffectedCount() > 0 && (
                  <p className="text-[10px] text-muted-foreground/80 mt-1 leading-normal">
                    ≈ {Math.ceil(getAffectedCount() / selectedDesignIds.length)} لوحة لكل تصميم (التوزيع بالتساوي)
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Right Panel - Designs Selection */}
          {!isDeleteMode ? (
            <div className="flex-1 p-5 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-4.5">
                <Label className="text-sm font-black text-foreground/90 flex items-center gap-2">
                  <ImageIcon className="h-4.5 w-4.5 text-primary" />
                  <span>تحديد التصاميم للمهمة</span>
                  {assignMode === 'distribute' && (
                    <span className="text-[10px] text-muted-foreground/70 font-bold bg-muted px-2 py-0.5 rounded-md">
                      (يمكن تحديد تصميمين أو أكثر للتوزيع)
                    </span>
                  )}
                </Label>
                <Badge variant="outline" className="border-primary/20 text-primary bg-primary/5 font-extrabold text-xs px-2.5 py-0.5">
                  {selectedDesignIds.length} تصميم مختار
                </Badge>
              </div>
              
              <ScrollArea className="flex-1 min-h-0 pr-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4">
                  {taskDesigns.map(design => {
                    const isSelected = selectedDesignIds.includes(design.id);
                    return (
                      <button
                        key={design.id}
                        type="button"
                        onClick={() => {
                          if (assignMode === 'distribute') {
                            toggleDesignSelection(design.id);
                          } else {
                            setSelectedDesignIds([design.id]);
                          }
                        }}
                        className={`relative p-3.5 rounded-2xl border text-right transition-all duration-200 group ${
                          isSelected
                            ? 'border-primary bg-primary/4 shadow-lg ring-1 ring-primary/20 scale-[1.01]'
                            : 'border-border/40 bg-card/45 hover:border-primary/40 hover:shadow-md hover:bg-card/90'
                        }`}
                      >
                        {/* Selector check indicator */}
                        {isSelected && (
                          <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 animate-in zoom-in-50 duration-150">
                            {assignMode === 'distribute' && (
                              <Badge className="bg-primary text-primary-foreground font-black text-[9px] h-5 px-1.5 shadow-sm rounded-lg">
                                #{selectedDesignIds.indexOf(design.id) + 1}
                              </Badge>
                            )}
                            <div className="h-5.5 w-5.5 rounded-full bg-primary flex items-center justify-center shadow-md border border-white/10">
                              <Check className="h-3.5 w-3.5 text-primary-foreground stroke-[3.5px]" />
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2 mb-3">
                          <div className={`p-1.5 rounded-lg border ${
                            isSelected ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-muted border-border/30 text-muted-foreground'
                          }`}>
                            <Palette className="h-3.5 w-3.5" />
                          </div>
                          <p className={`font-black text-sm truncate ${isSelected ? 'text-primary' : 'text-foreground/90'}`}>
                            {design.design_name}
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3.5">
                          <div className="space-y-1">
                            <p className="text-[9px] text-muted-foreground/80 text-center font-bold tracking-wide">الوجه الأمامي</p>
                            <div className={`aspect-video rounded-xl overflow-hidden border transition-all ${
                              isSelected ? 'border-primary/45 shadow-sm' : 'border-border/40 group-hover:border-primary/20'
                            }`}>
                              <img
                                src={design.design_face_a_url}
                                alt="الوجه الأمامي"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = '/placeholder.svg';
                                }}
                              />
                            </div>
                          </div>
                          {design.design_face_b_url ? (
                            <div className="space-y-1">
                              <p className="text-[9px] text-muted-foreground/80 text-center font-bold tracking-wide">الوجه الخلفي</p>
                              <div className={`aspect-video rounded-xl overflow-hidden border transition-all ${
                                isSelected ? 'border-primary/45 shadow-sm' : 'border-border/40 group-hover:border-primary/20'
                              }`}>
                                <img
                                  src={design.design_face_b_url}
                                  alt="الوجه الخلفي"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = '/placeholder.svg';
                                  }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <p className="text-[9px] text-muted-foreground/80 text-center font-bold tracking-wide">الوجه الخلفي</p>
                              <div className="aspect-video rounded-xl border border-dashed border-border/40 flex items-center justify-center bg-muted/40">
                                <p className="text-[9px] text-muted-foreground/60 font-semibold">لا يوجد</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          ) : (
            /* Delete Designs view */
            <div className="flex-1 p-5 flex flex-col items-center justify-center min-h-0 select-none">
              <div className="text-center space-y-4 max-w-sm">
                <div className="p-6 bg-destructive/8 border border-destructive/15 rounded-full inline-block animate-pulse">
                  <Trash2 className="h-14 w-14 text-destructive" />
                </div>
                <h3 className="text-lg font-black text-destructive tracking-tight">حذف وإلغاء تعيين التصاميم</h3>
                <p className="text-xs text-muted-foreground/90 leading-relaxed font-medium">
                  {assignMode === 'delete_all' 
                    ? `سيتم إزالة وحذف التصاميم المرفقة بجميع اللوحات في هذه المهمة (${taskItems.length} لوحة).`
                    : selectedSize 
                      ? `سيتم إزالة وحذف التصاميم فقط للوحات ذات المقاس ${selectedSize} (${getAffectedCount()} لوحة).`
                      : 'يرجى تحديد المقاس المستهدف من اللوحة الجانبية لحذف التصاميم المرتبطة به.'
                  }
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border/30 bg-muted/30 flex items-center gap-3.5">
          <Button
            onClick={handleAssign}
            disabled={saving || (!isDeleteMode && selectedDesignIds.length === 0) || (assignMode === 'delete_by_size' && !selectedSize)}
            variant={isDeleteMode ? "destructive" : "default"}
            className={`flex-1 h-11 text-sm font-black gap-2 rounded-2xl shadow-md transition-all hover:scale-[1.01] ${
              isDeleteMode 
                ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' 
                : 'bg-primary hover:bg-primary/95 text-primary-foreground'
            }`}
          >
            {saving ? (
              <>
                <div className="h-4.5 w-4.5 border-2.5 border-current/30 border-t-current rounded-full animate-spin" />
                {isDeleteMode ? 'جاري حذف التصاميم...' : 'جاري تطبيق وتوزيع التصاميم...'}
              </>
            ) : isDeleteMode ? (
              <>
                <Trash2 className="h-4.5 w-4.5" />
                تأكيد حذف التصاميم من {getAffectedCount()} لوحة
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4.5 w-4.5" />
                تطبيق وتعيين التصاميم على {getAffectedCount()} لوحة
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              resetForm();
            }}
            disabled={saving}
            className="h-11 border-border/40 text-muted-foreground hover:text-foreground font-bold px-5 rounded-2xl transition-all"
          >
            إلغاء
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}