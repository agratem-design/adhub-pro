import { useState, useMemo } from 'react';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { RefreshCw, Plus, Trash2, AlertTriangle, DollarSign, TrendingDown, User, Check, Image as ImageIcon, MapPin, Landmark, Ruler, Camera } from 'lucide-react';
import { ImageUploadZone } from '@/components/ui/image-upload-zone';

interface PrintReprintsSectionProps {
  taskId: string;
  items: any[];
  printerPricePerMeter: number;
  customerPricePerMeter: number;
}

interface ReprintEntry {
  id: string;
  task_id: string;
  print_task_item_id: string;
  billboard_id: number | null;
  face_type: string;
  reason: string;
  cost_type: string;
  area: number;
  printer_cost: number;
  customer_charge: number;
  notes: string | null;
  status: string;
  created_at: string;
  defect_image_url: string | null;
}

const COST_TYPE_LABELS: Record<string, { label: string; color: string; icon: typeof User }> = {
  customer: { label: 'على الزبون', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400', icon: User },
  loss: { label: 'خسارة (على الشركة)', color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400', icon: TrendingDown },
  printer: { label: 'على المطبعة', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400', icon: DollarSign },
};

const FACE_LABELS: Record<string, string> = {
  A: 'وجه A',
  B: 'وجه B',
  both: 'الوجهين',
};

const REASONS = [
  'خطأ في الطباعة',
  'تلف أثناء التركيب',
  'تلف بسبب الطقس',
  'خطأ في التصميم',
  'طلب الزبون تغيير',
  'جودة غير مقبولة',
  'أخرى',
];

export function PrintReprintsSection({ taskId, items, printerPricePerMeter, customerPricePerMeter }: PrintReprintsSectionProps) {
  const queryClient = useQueryClient();
  const { confirm: systemConfirm } = useSystemDialog();
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Step-based form
  const [selectedBillboardId, setSelectedBillboardId] = useState<number | null>(null);
  const [faceType, setFaceType] = useState('A');
  const [reason, setReason] = useState('');
  const [costType, setCostType] = useState('loss');
  const [notes, setNotes] = useState('');
  const [defectImageUrl, setDefectImageUrl] = useState('');

  const { data: reprints = [] } = useQuery({
    queryKey: ['print-reprints', taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('print_reprints')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ReprintEntry[];
    },
  });

  // Group items by billboard for visual selection
  const billboardCards = useMemo(() => {
    const map = new Map<number, { billboard: any; items: any[]; facesCount: number; area: number; imageUrl: string | null }>();
    items.forEach(item => {
      const bbId = item.billboard_id || 0;
      const bb = item.billboards;
      if (!map.has(bbId)) {
        map.set(bbId, {
          billboard: bb,
          items: [],
          facesCount: bb?.Faces_Count || 1,
          area: item.area || (item.width * item.height),
          imageUrl: bb?.Image_URL || null,
        });
      }
      map.get(bbId)!.items.push(item);
    });
    return Array.from(map.entries());
  }, [items]);

  const selectedBillboard = useMemo(() => {
    return billboardCards.find(([id]) => id === selectedBillboardId);
  }, [billboardCards, selectedBillboardId]);

  const selectedItem = useMemo(() => {
    if (!selectedBillboard) return null;
    return selectedBillboard[1].items[0]; // first item for this billboard
  }, [selectedBillboard]);

  const reprintArea = useMemo(() => {
    if (!selectedItem) return 0;
    const singleFaceArea = selectedItem.area || (selectedItem.width * selectedItem.height);
    if (faceType === 'both') return singleFaceArea * 2;
    return singleFaceArea;
  }, [selectedItem, faceType]);

  const addReprintMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItem) throw new Error('اختر لوحة');
      const printerCost = reprintArea * printerPricePerMeter;
      const customerCharge = costType === 'customer' ? reprintArea * customerPricePerMeter : 0;

      const { error } = await supabase.from('print_reprints').insert({
        task_id: taskId,
        print_task_item_id: selectedItem.id,
        billboard_id: selectedItem.billboard_id || null,
        face_type: faceType,
        reason,
        cost_type: costType,
        area: reprintArea,
        printer_cost: printerCost,
        customer_charge: customerCharge,
        notes: notes || null,
        defect_image_url: defectImageUrl || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تمت إضافة إعادة الطباعة');
      queryClient.invalidateQueries({ queryKey: ['print-reprints', taskId] });
      resetForm();
    },
    onError: (e: any) => toast.error('فشل: ' + e.message),
  });

  const deleteReprintMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('print_reprints').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم حذف إعادة الطباعة');
      queryClient.invalidateQueries({ queryKey: ['print-reprints', taskId] });
    },
    onError: (e: any) => toast.error('فشل: ' + e.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('print_reprints').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تحديث الحالة');
      queryClient.invalidateQueries({ queryKey: ['print-reprints', taskId] });
    },
    onError: (e: any) => toast.error('فشل: ' + e.message),
  });

  const resetForm = () => {
    setDialogOpen(false);
    setSelectedBillboardId(null);
    setFaceType('A');
    setReason('');
    setCostType('loss');
    setNotes('');
    setDefectImageUrl('');
  };

  // Stats
  const totalReprintArea = reprints.reduce((s, r) => s + r.area, 0);
  const totalPrinterCost = reprints.reduce((s, r) => s + r.printer_cost, 0);
  const totalCustomerCharge = reprints.reduce((s, r) => s + r.customer_charge, 0);
  const totalLoss = reprints.filter(r => r.cost_type === 'loss').reduce((s, r) => s + r.printer_cost, 0);
  const totalPrinterBorne = reprints.filter(r => r.cost_type === 'printer').reduce((s, r) => s + r.printer_cost, 0);

  if (items.length === 0) return null;

  return (
    <>
      <Card className="border-0 shadow-md bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/50 dark:to-orange-950/50 border-b flex items-center justify-between">
          <h3 className="font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/50">
              <RefreshCw className="h-4 w-4 text-red-600 dark:text-red-400" />
            </span>
            إعادة الطباعة ({reprints.length})
          </h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDialogOpen(true)}
            className="gap-1.5 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50"
          >
            <Plus className="h-4 w-4" />
            إضافة إعادة طباعة
          </Button>
        </div>
        <CardContent className="p-4">
          {reprints.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">لا توجد إعادات طباعة لهذه المهمة</p>
          ) : (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                  <span className="text-[10px] text-muted-foreground block">إجمالي المساحة</span>
                  <span className="font-bold text-sm">{totalReprintArea.toFixed(2)} م²</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                  <span className="text-[10px] text-muted-foreground block">تكلفة الطباعة</span>
                  <span className="font-bold text-sm">{totalPrinterCost.toLocaleString()} د.ل</span>
                </div>
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800">
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 block">محمّل على الزبون</span>
                  <span className="font-bold text-sm text-blue-700 dark:text-blue-300">{totalCustomerCharge.toLocaleString()} د.ل</span>
                </div>
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800">
                  <span className="text-[10px] text-red-600 dark:text-red-400 block">خسارة</span>
                  <span className="font-bold text-sm text-red-700 dark:text-red-300">{totalLoss.toLocaleString()} د.ل</span>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800">
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 block">على المطبعة</span>
                  <span className="font-bold text-sm text-amber-700 dark:text-amber-300">{totalPrinterBorne.toLocaleString()} د.ل</span>
                </div>
              </div>

              {/* List */}
              <div className="space-y-3">
                {reprints.map(r => {
                  const costInfo = COST_TYPE_LABELS[r.cost_type] || COST_TYPE_LABELS.loss;
                  const CostIcon = costInfo.icon;
                  const matchedItem = items.find(i => i.id === r.print_task_item_id);
                  const bb = matchedItem?.billboards;
                  const bbName = bb?.Billboard_Name || `لوحة ${r.billboard_id || ''}`;
                  const bbSize = bb?.Size || '';
                  const bbDistrict = bb?.District || '';
                  const bbLandmark = bb?.Nearest_Landmark || '';
                  
                  // تصميم الوجه المناسب - من اللوحة أو من البند
                  const designA = matchedItem?.design_face_a || bb?.design_face_a;
                  const designB = matchedItem?.design_face_b || bb?.design_face_b;
                  const showDesignA = r.face_type === 'A' || r.face_type === 'both';
                  const showDesignB = r.face_type === 'B' || r.face_type === 'both';

                  return (
                    <div key={r.id} className="rounded-xl border border-border/50 bg-slate-50/50 dark:bg-slate-700/30 overflow-hidden">
                      <div className="flex flex-col md:flex-row">
                        {/* Design panel - right side */}
                        <div className="shrink-0 w-full md:w-[220px] border-b md:border-b-0 md:border-l border-border/30 bg-muted/30 p-3">
                          {/* Size badge */}
                          {bbSize && (
                            <div className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm font-semibold text-red-600 dark:text-red-400 mb-2">
                              <Ruler className="h-4 w-4" />
                              {bbSize}
                            </div>
                          )}
                          {/* Design images */}
                          {showDesignA && designA && (
                            <div className="relative w-full rounded-lg overflow-hidden border bg-white dark:bg-slate-800 mb-2" style={{ height: '120px' }}>
                              <img src={designA} alt="الوجه A" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                              <div className="absolute bottom-0 inset-x-0 flex items-center px-2 py-0.5 bg-black/60 text-white text-[9px]">
                                <span>الوجه A</span>
                              </div>
                            </div>
                          )}
                          {showDesignB && designB && (
                            <div className="relative w-full rounded-lg overflow-hidden border bg-white dark:bg-slate-800" style={{ height: '120px' }}>
                              <img src={designB} alt="الوجه B" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                              <div className="absolute bottom-0 inset-x-0 flex items-center px-2 py-0.5 bg-black/60 text-white text-[9px]">
                                <span>الوجه B</span>
                              </div>
                            </div>
                          )}
                          {!designA && !designB && (
                            <div className="w-full rounded-lg border bg-muted flex items-center justify-center" style={{ height: '80px' }}>
                              <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                            </div>
                          )}
                        </div>

                        {/* Billboard info - left side */}
                        <div className="flex-1 min-w-0 p-4">
                          {/* Header row */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-foreground">{bbName}</h4>
                              <Badge variant="outline" className="text-[10px]">{FACE_LABELS[r.face_type] || r.face_type}</Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              <Select value={r.status} onValueChange={(v) => updateStatusMutation.mutate({ id: r.id, status: v })}>
                                <SelectTrigger className="h-7 text-[10px] w-20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">معلق</SelectItem>
                                  <SelectItem value="completed">مكتمل</SelectItem>
                                  <SelectItem value="cancelled">ملغي</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={async () => {
                                  if (await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف إعادة الطباعة؟', variant: 'destructive', confirmText: 'حذف' })) {
                                    deleteReprintMutation.mutate(r.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Location info */}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                            {bbDistrict && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5 text-purple-500/70" />
                                {bbDistrict}
                              </span>
                            )}
                            {bbLandmark && (
                              <span className="flex items-center gap-1">
                                <Landmark className="h-3.5 w-3.5 text-amber-500/70" />
                                {bbLandmark}
                              </span>
                            )}
                          </div>

                          {/* Reprint details */}
                          <div className="mt-3 p-3 rounded-lg bg-white/60 dark:bg-slate-600/30 border border-border/30">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <Badge className={`${costInfo.color} text-[10px] gap-1`}>
                                <CostIcon className="h-3 w-3" />
                                {costInfo.label}
                              </Badge>
                              <Badge variant={r.status === 'completed' ? 'default' : r.status === 'cancelled' ? 'destructive' : 'secondary'} className="text-[10px]">
                                {r.status === 'completed' ? 'مكتمل' : r.status === 'cancelled' ? 'ملغي' : 'معلق'}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/50 dark:text-red-400">
                                <RefreshCw className="h-3 w-3 ml-1" />
                                إعادة طباعة
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{r.reason}</span>
                              <span>•</span>
                              <span>{r.area.toFixed(2)} م²</span>
                              <span>•</span>
                              <span>مطبعة: {r.printer_cost.toLocaleString()} د.ل</span>
                              {r.cost_type === 'customer' && (
                                <>
                                  <span>•</span>
                                  <span className="text-blue-600 dark:text-blue-400 font-medium">زبون: {r.customer_charge.toLocaleString()} د.ل</span>
                                </>
                              )}
                            </div>
                            {r.notes && <p className="text-[11px] text-muted-foreground/70 mt-1">{r.notes}</p>}
                            {/* Defect image */}
                            {(r as any).defect_image_url && (
                              <div className="mt-2">
                                <p className="text-[10px] text-red-600 dark:text-red-400 font-medium mb-1 flex items-center gap-1">
                                  <Camera className="h-3 w-3" />
                                  صورة الخلل
                                </p>
                                <div className="w-32 h-24 rounded-lg overflow-hidden border bg-muted">
                                  <img
                                    src={(r as any).defect_image_url}
                                    alt="صورة الخلل"
                                    className="w-full h-full object-cover cursor-pointer"
                                    onClick={() => window.open((r as any).defect_image_url, '_blank')}
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add Reprint Dialog - Visual Selection */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) resetForm(); else setDialogOpen(true); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-red-500" />
              إضافة إعادة طباعة
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Step 1: Select Billboard - Visual Cards */}
            <div>
              <p className="text-sm font-medium mb-2">1. اختر اللوحة</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {billboardCards.map(([bbId, data]) => {
                  const isSelected = selectedBillboardId === bbId;
                  const bb = data.billboard;
                  const bbName = bb?.Billboard_Name || `لوحة ${bbId}`;
                  
                  return (
                    <button
                      key={bbId}
                      onClick={() => {
                        setSelectedBillboardId(bbId);
                        // Auto-set face based on faces count
                        if (data.facesCount === 1) setFaceType('A');
                      }}
                      className={`relative rounded-xl border-2 p-2 text-right transition-all ${
                        isSelected
                          ? 'border-red-500 bg-red-50/50 dark:bg-red-950/30 ring-2 ring-red-500/20'
                          : 'border-border hover:border-red-300 hover:bg-red-50/20 dark:hover:bg-red-950/10'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                      {/* Image */}
                      <div className="w-full h-20 rounded-lg overflow-hidden mb-2 bg-muted">
                        {data.imageUrl ? (
                          <img src={data.imageUrl} alt={bbName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                      <p className="font-semibold text-xs truncate">{bbName}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant="outline" className={`text-[9px] px-1 py-0 ${
                          data.facesCount >= 2
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                            : 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                        }`}>
                          {data.facesCount >= 2 ? 'وجهين' : 'وجه واحد'}
                        </Badge>
                        <span className="text-[9px] text-muted-foreground">{data.area.toFixed(1)} م²</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Face & Reason - only show when billboard selected */}
            {selectedBillboard && (
              <>
                {/* Face Selection - visual buttons */}
                <div>
                  <p className="text-sm font-medium mb-2">2. اختر الوجه</p>
                  <div className="flex gap-2">
                    {selectedBillboard[1].facesCount >= 2 ? (
                      <>
                        <button
                          onClick={() => setFaceType('A')}
                          className={`flex-1 rounded-lg border-2 p-3 text-center transition-all ${
                            faceType === 'A' ? 'border-red-500 bg-red-50 dark:bg-red-950/30' : 'border-border hover:border-red-200'
                          }`}
                        >
                          <span className="text-lg font-bold block">A</span>
                          <span className="text-[10px] text-muted-foreground">الوجه الأمامي</span>
                        </button>
                        <button
                          onClick={() => setFaceType('B')}
                          className={`flex-1 rounded-lg border-2 p-3 text-center transition-all ${
                            faceType === 'B' ? 'border-red-500 bg-red-50 dark:bg-red-950/30' : 'border-border hover:border-red-200'
                          }`}
                        >
                          <span className="text-lg font-bold block">B</span>
                          <span className="text-[10px] text-muted-foreground">الوجه الخلفي</span>
                        </button>
                        <button
                          onClick={() => setFaceType('both')}
                          className={`flex-1 rounded-lg border-2 p-3 text-center transition-all ${
                            faceType === 'both' ? 'border-red-500 bg-red-50 dark:bg-red-950/30' : 'border-border hover:border-red-200'
                          }`}
                        >
                          <span className="text-lg font-bold block">A+B</span>
                          <span className="text-[10px] text-muted-foreground">الوجهين</span>
                        </button>
                      </>
                    ) : (
                      <div className="flex-1 rounded-lg border-2 border-red-500 bg-red-50 dark:bg-red-950/30 p-3 text-center">
                        <span className="text-lg font-bold block">A</span>
                        <span className="text-[10px] text-muted-foreground">وجه واحد فقط</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <p className="text-sm font-medium mb-2">3. السبب</p>
                  <div className="flex flex-wrap gap-1.5">
                    {REASONS.map(r => (
                      <button
                        key={r}
                        onClick={() => setReason(r)}
                        className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                          reason === r
                            ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                            : 'border-border hover:border-red-200 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cost Type */}
                <div>
                  <p className="text-sm font-medium mb-2">4. تحميل التكلفة على</p>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: 'customer', label: 'الزبون', icon: User, color: 'blue' },
                      { value: 'loss', label: 'خسارة (الشركة)', icon: TrendingDown, color: 'red' },
                      { value: 'printer', label: 'المطبعة', icon: DollarSign, color: 'amber' },
                    ] as const).map(opt => {
                      const Icon = opt.icon;
                      const isSelected = costType === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setCostType(opt.value)}
                          className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 transition-all ${
                            isSelected
                              ? `border-${opt.color}-500 bg-${opt.color}-50 dark:bg-${opt.color}-950/30`
                              : 'border-border hover:border-muted-foreground/30'
                          }`}
                        >
                          <Icon className={`h-5 w-5 ${isSelected ? `text-${opt.color}-600` : 'text-muted-foreground'}`} />
                          <span className={`text-xs font-medium ${isSelected ? `text-${opt.color}-700 dark:text-${opt.color}-400` : 'text-muted-foreground'}`}>
                            {opt.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Cost Preview */}
                <div className="rounded-xl border-2 border-dashed border-muted-foreground/20 p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-muted-foreground block">المساحة</span>
                      <span className="font-bold text-lg">{reprintArea.toFixed(2)} م²</span>
                      {faceType === 'both' && (
                        <span className="text-[10px] text-muted-foreground block">({(reprintArea / 2).toFixed(2)} × 2 وجه)</span>
                      )}
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">تكلفة المطبعة</span>
                      <span className="font-bold text-lg">{(reprintArea * printerPricePerMeter).toLocaleString()} د.ل</span>
                    </div>
                    {costType === 'customer' && (
                      <div className="col-span-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                        <span className="text-xs text-blue-600 dark:text-blue-400 block">سيتم تحميله على الزبون</span>
                        <span className="font-bold text-xl text-blue-700 dark:text-blue-300">{(reprintArea * customerPricePerMeter).toLocaleString()} د.ل</span>
                        <span className="text-[10px] text-blue-500 block">سيظهر في فاتورة الزبون كإعادة طباعة</span>
                      </div>
                    )}
                    {costType === 'loss' && (
                      <div className="col-span-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                        <span className="text-xs text-red-600 dark:text-red-400 block">خسارة على الشركة</span>
                        <span className="font-bold text-xl text-red-700 dark:text-red-300">{(reprintArea * printerPricePerMeter).toLocaleString()} د.ل</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات إضافية (اختياري)..."
                  rows={2}
                  className="text-sm"
                />

                {/* Defect Image Upload */}
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Camera className="h-4 w-4 text-red-500" />
                    5. صورة الخلل (اختياري)
                  </p>
                  <ImageUploadZone
                    value={defectImageUrl}
                    onChange={setDefectImageUrl}
                    imageName={`defect-reprint-${selectedBillboardId}`}
                    label="رفع صورة الخلل أو لصق رابط"
                    dropZoneHeight="h-20"
                    previewHeight="h-28"
                    showPreview={true}
                    showUrlInput={true}
                    urlPlaceholder="https://example.com/defect-image.jpg"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>إلغاء</Button>
            <Button
              onClick={() => addReprintMutation.mutate()}
              disabled={!selectedBillboardId || !reason || addReprintMutation.isPending}
              className="gap-1.5 bg-red-600 hover:bg-red-700 text-white"
            >
              <Plus className="h-4 w-4" />
              إضافة إعادة طباعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
