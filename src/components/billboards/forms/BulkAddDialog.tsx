import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Zap, Copy, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface BulkAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  municipalities: any[];
  sizes: any[];
  levels: string[];
  citiesList: string[];
  faces: any[];
  billboardTypes: string[];
  onSuccess: () => Promise<void>;
  generateBillboardName: (municipality: string, level: string, size: string, existingNames: string[], billboardId?: number) => string;
  getNextBillboardId: () => Promise<number>;
}

interface BulkBillboard {
  id: string;
  Municipality: string;
  Level: string;
  Size: string;
  City: string;
  District: string;
  Faces_Count: string;
  billboard_type: string;
  status: 'pending' | 'success' | 'error';
  errorMessage?: string;
  Billboard_Name?: string;
}

export const BulkAddDialog: React.FC<BulkAddDialogProps> = ({
  open,
  onOpenChange,
  municipalities,
  sizes,
  levels,
  citiesList,
  faces,
  billboardTypes,
  onSuccess,
  generateBillboardName,
  getNextBillboardId
}) => {
  const [billboards, setBillboards] = useState<BulkBillboard[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [quickAddCount, setQuickAddCount] = useState(5);
  
  // القيم الافتراضية للإضافة السريعة
  const [defaultValues, setDefaultValues] = useState({
    Municipality: '',
    Level: '',
    Size: '',
    City: '',
    Faces_Count: '1',
    billboard_type: ''
  });

  // إضافة صف جديد
  const addRow = () => {
    setBillboards(prev => [...prev, {
      id: crypto.randomUUID(),
      Municipality: defaultValues.Municipality,
      Level: defaultValues.Level,
      Size: defaultValues.Size,
      City: defaultValues.City,
      District: '',
      Faces_Count: defaultValues.Faces_Count,
      billboard_type: defaultValues.billboard_type,
      status: 'pending'
    }]);
  };

  // إضافة عدة صفوف دفعة واحدة
  const addMultipleRows = () => {
    const newRows: BulkBillboard[] = [];
    for (let i = 0; i < quickAddCount; i++) {
      newRows.push({
        id: crypto.randomUUID(),
        Municipality: defaultValues.Municipality,
        Level: defaultValues.Level,
        Size: defaultValues.Size,
        City: defaultValues.City,
        District: '',
        Faces_Count: defaultValues.Faces_Count,
        billboard_type: defaultValues.billboard_type,
        status: 'pending'
      });
    }
    setBillboards(prev => [...prev, ...newRows]);
  };

  // حذف صف
  const removeRow = (id: string) => {
    setBillboards(prev => prev.filter(b => b.id !== id));
  };

  // تحديث قيمة في صف
  const updateRow = (id: string, field: keyof BulkBillboard, value: string) => {
    setBillboards(prev => prev.map(b => 
      b.id === id ? { ...b, [field]: value } : b
    ));
  };

  // نسخ صف
  const duplicateRow = (billboard: BulkBillboard) => {
    setBillboards(prev => [...prev, {
      ...billboard,
      id: crypto.randomUUID(),
      status: 'pending'
    }]);
  };

  // حفظ جميع اللوحات
  const saveAll = async () => {
    const pendingBillboards = billboards.filter(b => b.status === 'pending');
    if (pendingBillboards.length === 0) {
      toast.error('لا توجد لوحات للإضافة');
      return;
    }

    // التحقق من الحقول المطلوبة
    const invalidBillboards = pendingBillboards.filter(b => !b.Municipality || !b.Level || !b.Size);
    if (invalidBillboards.length > 0) {
      toast.error('يرجى تحديد البلدية والمستوى والمقاس لجميع اللوحات');
      return;
    }

    setIsAdding(true);

    try {
      // جلب آخر ID
      let nextId = await getNextBillboardId();
      
      // جلب الأسماء الموجودة
      const { data: existingBillboards } = await supabase
        .from('billboards')
        .select('Billboard_Name');
      const existingNames = (existingBillboards || []).map(b => b.Billboard_Name || '');

      const results: { id: string; success: boolean; error?: string }[] = [];

      for (const billboard of pendingBillboards) {
        try {
          // إنشاء اسم اللوحة
          const billboardName = generateBillboardName(
            billboard.Municipality,
            billboard.Level,
            billboard.Size,
            [...existingNames, ...results.filter(r => r.success).map(() => '')],
            nextId
          );

          // البحث عن size_id
          let sizeId: number | null = null;
          const matchedSize = sizes.find(s => s.name === billboard.Size);
          if (matchedSize) sizeId = matchedSize.id;

          const payload = {
            ID: nextId,
            Billboard_Name: billboardName,
            City: billboard.City || null,
            Municipality: billboard.Municipality,
            District: billboard.District || null,
            Faces_Count: billboard.Faces_Count ? parseInt(billboard.Faces_Count) : 1,
            Size: billboard.Size,
            size_id: sizeId,
            Level: billboard.Level,
            billboard_type: billboard.billboard_type || null,
            Status: 'متاح',
            is_partnership: false
          };

          const { error } = await supabase.from('billboards').insert(payload);
          
          if (error) throw error;

          existingNames.push(billboardName);
          results.push({ id: billboard.id, success: true });
          
          setBillboards(prev => prev.map(b => 
            b.id === billboard.id ? { ...b, status: 'success', Billboard_Name: billboardName } : b
          ));

          nextId++;
        } catch (error: any) {
          results.push({ id: billboard.id, success: false, error: error.message });
          setBillboards(prev => prev.map(b => 
            b.id === billboard.id ? { ...b, status: 'error', errorMessage: error.message } : b
          ));
        }
      }

      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;

      if (successCount > 0) {
        // مزامنة الـ sequence مع آخر ID فعلي لمنع القفز في الترقيم
        await supabase.rpc('setval_billboards_seq' as any);
        toast.success(`تم إضافة ${successCount} لوحة بنجاح`);
        await onSuccess();
      }
      if (errorCount > 0) {
        toast.error(`فشل إضافة ${errorCount} لوحة`);
      }

    } catch (error: any) {
      console.error('Bulk add error:', error);
      toast.error('حدث خطأ أثناء الإضافة');
    } finally {
      setIsAdding(false);
    }
  };

  // مسح الكل
  const clearAll = () => {
    setBillboards([]);
  };

  // مسح المكتملة
  const clearCompleted = () => {
    setBillboards(prev => prev.filter(b => b.status !== 'success'));
  };

  const pendingCount = billboards.filter(b => b.status === 'pending').length;
  const successCount = billboards.filter(b => b.status === 'success').length;
  const errorCount = billboards.filter(b => b.status === 'error').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            إضافة لوحات متعددة
            {billboards.length > 0 && (
              <div className="flex gap-2 mr-4">
                {pendingCount > 0 && <Badge variant="outline">{pendingCount} معلق</Badge>}
                {successCount > 0 && <Badge className="bg-green-500">{successCount} مكتمل</Badge>}
                {errorCount > 0 && <Badge variant="destructive">{errorCount} فشل</Badge>}
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
          {/* القيم الافتراضية */}
          <div className="p-4 rounded-lg bg-muted/30 border space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-primary rounded-full" />
              القيم الافتراضية للإضافة السريعة
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">البلدية</Label>
                <Select value={defaultValues.Municipality} onValueChange={(v) => setDefaultValues(p => ({ ...p, Municipality: v }))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="اختر" />
                  </SelectTrigger>
                  <SelectContent>
                    {municipalities.filter(m => m?.name).map(m => (
                      <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">المستوى</Label>
                <Select value={defaultValues.Level} onValueChange={(v) => setDefaultValues(p => ({ ...p, Level: v }))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="اختر" />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.filter(l => l).map(l => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">المقاس</Label>
                <Select value={defaultValues.Size} onValueChange={(v) => setDefaultValues(p => ({ ...p, Size: v }))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="اختر" />
                  </SelectTrigger>
                  <SelectContent>
                    {sizes.filter(s => s?.name).map(s => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">المدينة</Label>
                <Select value={defaultValues.City} onValueChange={(v) => setDefaultValues(p => ({ ...p, City: v }))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="اختر" />
                  </SelectTrigger>
                  <SelectContent>
                    {citiesList.filter(c => c).map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">عدد الأوجه</Label>
                <Select value={defaultValues.Faces_Count} onValueChange={(v) => setDefaultValues(p => ({ ...p, Faces_Count: v }))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="اختر" />
                  </SelectTrigger>
                  <SelectContent>
                    {faces.filter(f => f?.id).map(f => (
                      <SelectItem key={f.id} value={String(f.count || f.face_count)}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">النوع</Label>
                <Select value={defaultValues.billboard_type} onValueChange={(v) => setDefaultValues(p => ({ ...p, billboard_type: v }))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="اختر" />
                  </SelectTrigger>
                  <SelectContent>
                    {billboardTypes.filter(t => t).map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* أزرار الإضافة السريعة */}
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/50">
              <Button variant="outline" size="sm" onClick={addRow} className="gap-1">
                <Plus className="h-3 w-3" />
                إضافة صف
              </Button>
              <div className="flex items-center gap-2">
                <Input 
                  type="number" 
                  min={1} 
                  max={100}
                  value={quickAddCount} 
                  onChange={(e) => setQuickAddCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-16 h-8 text-center text-sm"
                />
                <Button variant="default" size="sm" onClick={addMultipleRows} className="gap-1">
                  <Zap className="h-3 w-3" />
                  إضافة {quickAddCount} لوحة
                </Button>
              </div>
              {billboards.length > 0 && (
                <>
                  <div className="h-4 w-px bg-border" />
                  <Button variant="ghost" size="sm" onClick={clearCompleted} className="text-muted-foreground">
                    مسح المكتملة
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearAll} className="text-destructive">
                    مسح الكل
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* جدول اللوحات */}
          <ScrollArea className="flex-1 border rounded-lg">
            <div className="min-w-[800px]">
              {/* رأس الجدول */}
              <div className="grid grid-cols-[40px_1fr_1fr_1fr_1fr_120px_120px_60px] gap-2 p-3 bg-muted/50 border-b text-xs font-medium text-muted-foreground sticky top-0">
                <div>#</div>
                <div>البلدية *</div>
                <div>المستوى *</div>
                <div>المقاس *</div>
                <div>المنطقة</div>
                <div>المدينة</div>
                <div>الحالة</div>
                <div></div>
              </div>
              
              {/* صفوف اللوحات */}
              {billboards.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Zap className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>ابدأ بإضافة لوحات باستخدام الأزرار أعلاه</p>
                </div>
              ) : (
                billboards.map((billboard, index) => (
                  <div 
                    key={billboard.id} 
                    className={`grid grid-cols-[40px_1fr_1fr_1fr_1fr_120px_120px_60px] gap-2 p-2 border-b items-center text-sm ${
                      billboard.status === 'success' ? 'bg-green-50 dark:bg-green-950/20' :
                      billboard.status === 'error' ? 'bg-red-50 dark:bg-red-950/20' : ''
                    }`}
                  >
                    <div className="text-xs text-muted-foreground">{index + 1}</div>
                    <Select 
                      value={billboard.Municipality} 
                      onValueChange={(v) => updateRow(billboard.id, 'Municipality', v)}
                      disabled={billboard.status !== 'pending'}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="اختر" />
                      </SelectTrigger>
                      <SelectContent>
                        {municipalities.filter(m => m?.name).map(m => (
                          <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select 
                      value={billboard.Level} 
                      onValueChange={(v) => updateRow(billboard.id, 'Level', v)}
                      disabled={billboard.status !== 'pending'}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="اختر" />
                      </SelectTrigger>
                      <SelectContent>
                        {levels.filter(l => l).map(l => (
                          <SelectItem key={l} value={l}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select 
                      value={billboard.Size} 
                      onValueChange={(v) => updateRow(billboard.id, 'Size', v)}
                      disabled={billboard.status !== 'pending'}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="اختر" />
                      </SelectTrigger>
                      <SelectContent>
                        {sizes.filter(s => s?.name).map(s => (
                          <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input 
                      value={billboard.District} 
                      onChange={(e) => updateRow(billboard.id, 'District', e.target.value)}
                      disabled={billboard.status !== 'pending'}
                      className="h-7 text-xs"
                      placeholder="المنطقة"
                    />
                    <Select 
                      value={billboard.City} 
                      onValueChange={(v) => updateRow(billboard.id, 'City', v)}
                      disabled={billboard.status !== 'pending'}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="اختر" />
                      </SelectTrigger>
                      <SelectContent>
                        {citiesList.filter(c => c).map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1">
                      {billboard.status === 'pending' && (
                        <Badge variant="outline" className="text-[10px]">معلق</Badge>
                      )}
                      {billboard.status === 'success' && (
                        <Badge className="bg-green-500 text-[10px] gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          تم
                        </Badge>
                      )}
                      {billboard.status === 'error' && (
                        <Badge variant="destructive" className="text-[10px] gap-1" title={billboard.errorMessage}>
                          <XCircle className="h-3 w-3" />
                          فشل
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => duplicateRow(billboard)}
                        disabled={billboard.status !== 'pending'}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => removeRow(billboard.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* أزرار الحفظ */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {billboards.length > 0 && `إجمالي: ${billboards.length} لوحة`}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              إغلاق
            </Button>
            <Button 
              onClick={saveAll} 
              disabled={isAdding || pendingCount === 0}
              className="gap-2"
            >
              {isAdding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري الإضافة...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  حفظ {pendingCount} لوحة
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
