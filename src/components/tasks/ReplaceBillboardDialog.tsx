import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RefreshCw, Replace, Search, MapPin, Box, AlertTriangle, DollarSign, Layers, FolderPlus, Info } from 'lucide-react';

interface ReplaceBillboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: any;
  billboard: any;
  taskId: string;
  onSuccess: () => void;
}

const REPLACEMENT_REASONS = [
  { value: 'manufacturing_defect', label: 'عيب تصنيع', bearer: 'company' as const },
  { value: 'installation_error', label: 'خطأ تركيب', bearer: 'company' as const },
  { value: 'weather_damage', label: 'تلف بسبب الطقس', bearer: 'split' as const },
  { value: 'customer_request', label: 'طلب الزبون', bearer: 'customer' as const },
  { value: 'design_change', label: 'تغيير التصميم', bearer: 'customer' as const },
  { value: 'billboard_damage', label: 'تلف اللوحة', bearer: 'company' as const },
  { value: 'other', label: 'سبب آخر', bearer: 'split' as const },
];

export function ReplaceBillboardDialog({
  open,
  onOpenChange,
  item,
  billboard,
  taskId,
  onSuccess,
}: ReplaceBillboardDialogProps) {
  const [actionType, setActionType] = useState<'reinstall' | 'replace'>('reinstall');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [costBearer, setCostBearer] = useState<'customer' | 'company' | 'split'>('company');
  const [splitPercentage, setSplitPercentage] = useState(50);
  const [loading, setLoading] = useState(false);
  const [reinstalledFaces, setReinstalledFaces] = useState<'both' | 'face_a' | 'face_b'>('both');
  const [destinationType, setDestinationType] = useState<'new_task' | 'current_task'>('new_task');
  
  // للاستبدال
  const [searchQuery, setSearchQuery] = useState('');
  const [availableBillboards, setAvailableBillboards] = useState<any[]>([]);
  const [selectedReplacementId, setSelectedReplacementId] = useState<number | null>(null);
  const [searchingBillboards, setSearchingBillboards] = useState(false);

  const facesCount = billboard?.Faces_Count || 1;
  const hasMultipleFaces = facesCount > 1;

  const [manualCostBearer, setManualCostBearer] = useState(false);

  // تحديث تحمل التكلفة تلقائياً حسب السبب - فقط إذا لم يغيرها المستخدم يدوياً
  useEffect(() => {
    if (!manualCostBearer) {
      const reasonConfig = REPLACEMENT_REASONS.find(r => r.value === reason);
      if (reasonConfig && reason !== 'other') {
        setCostBearer(reasonConfig.bearer);
      }
    }
  }, [reason, manualCostBearer]);

  // إذا كانت اللوحة وجه واحد، اختر both تلقائياً
  useEffect(() => {
    if (!hasMultipleFaces) {
      setReinstalledFaces('both');
    }
  }, [hasMultipleFaces]);

  const searchBillboards = async (query: string) => {
    if (!query.trim()) {
      setAvailableBillboards([]);
      return;
    }
    setSearchingBillboards(true);
    try {
      const { data } = await supabase
        .from('billboards')
        .select('ID, Billboard_Name, Size, City, Municipality, Image_URL, Status')
        .or(`Billboard_Name.ilike.%${query}%,ID.eq.${isNaN(Number(query)) ? 0 : query},City.ilike.%${query}%`)
        .limit(10);
      setAvailableBillboards(data || []);
    } catch (error) {
      console.error('Error searching billboards:', error);
    } finally {
      setSearchingBillboards(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (actionType === 'replace' && searchQuery) {
        searchBillboards(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, actionType]);

  const handleSubmit = async () => {
    if (!reason) {
      toast.error('يرجى تحديد سبب العملية');
      return;
    }
    if (actionType === 'replace' && !selectedReplacementId) {
      toast.error('يرجى اختيار اللوحة البديلة');
      return;
    }

    setLoading(true);
    try {
      const finalReason = reason === 'other' ? customReason : REPLACEMENT_REASONS.find(r => r.value === reason)?.label || reason;

      if (actionType === 'reinstall') {
        // أرشفة صور التركيب السابقة قبل إعادة التعيين
        // أرشفة فقط الأوجه المحددة
        const archiveFaceA = reinstalledFaces === 'both' || reinstalledFaces === 'face_a';
        const archiveFaceB = reinstalledFaces === 'both' || reinstalledFaces === 'face_b';
        
        if ((archiveFaceA && item.installed_image_face_a_url) || (archiveFaceB && item.installed_image_face_b_url)) {
          await supabase.from('installation_photo_history').insert({
            task_item_id: item.id,
            billboard_id: item.billboard_id,
            task_id: taskId,
            reinstall_number: item.reinstall_count || 1,
            installed_image_face_a_url: archiveFaceA ? (item.installed_image_face_a_url || null) : null,
            installed_image_face_b_url: archiveFaceB ? (item.installed_image_face_b_url || null) : null,
            installation_date: item.installation_date || null,
            notes: `إعادة تركيب ${reinstalledFaces === 'face_a' ? '(الوجه الأمامي فقط)' : reinstalledFaces === 'face_b' ? '(الوجه الخلفي فقط)' : '(الوجهين)'} - السبب: ${finalReason}`,
          });
        }

        // إعادة تركيب - تصفير فقط الأوجه المحددة
        // تحديد عدد الأوجه المعاد تركيبها في هذه المرة
        const newFacesToInstall = reinstalledFaces === 'both' ? (facesCount || 2) : 1;
        // تراكمي: إجمالي الأوجه المُعاد تركيبها (كل وجه = 0.5 من السعر)
        // التغيير الأول (التركيب الأصلي) يُحسب أيضاً = عدد أوجه اللوحة
        const currentTotalReinstalled = item.total_reinstalled_faces || 0;
        const originalFaces = facesCount || 2;
        const newTotalReinstalled = currentTotalReinstalled === 0
          ? originalFaces + newFacesToInstall  // أول إعادة تركيب: نحسب التركيب الأصلي + الإعادة
          : currentTotalReinstalled + newFacesToInstall;  // إعادات لاحقة: نضيف فقط

        if (destinationType === 'new_task') {
          // جلب تفاصيل المهمة الحالية لنسخها
          const { data: currentTask, error: currentTaskError } = await supabase
            .from('installation_tasks')
            .select('*')
            .eq('id', taskId)
            .single();

          if (currentTaskError) throw currentTaskError;
          if (!currentTask) throw new Error('لم يتم العثور على المهمة الأصلية');

          // حساب الرقم التالي لإعادات تركيب العقد
          const { data: existingReinstalls, error: countError } = await supabase
            .from('installation_tasks')
            .select('reinstallation_number')
            .eq('contract_id', currentTask.contract_id)
            .eq('task_type', 'reinstallation')
            .order('reinstallation_number', { ascending: false })
            .limit(1);

          if (countError) throw countError;

          const nextNumber = ((existingReinstalls?.[0]?.reinstallation_number as number) || 0) + 1;

          // إنشاء مهمة جديدة
          const { data: newTask, error: taskError } = await supabase
            .from('installation_tasks')
            .insert({
              contract_id: currentTask.contract_id,
              team_id: null, // نترك فريق التركيب فارغاً ليقوم المستخدم باختياره يدوياً
              status: 'pending',
              task_type: 'reinstallation',
              reinstallation_number: nextNumber,
              contract_ids: currentTask.contract_ids,
              task_name: `إعادة تركيب لوحة #${billboard?.ID} (${finalReason})`
            })
            .select()
            .single();

          if (taskError) throw taskError;
          if (!newTask) throw new Error('فشل في إنشاء مهمة إعادة التركيب');

          // إدراج اللوحة في المهمة الجديدة
          const { error: itemError } = await supabase
            .from('installation_task_items')
            .insert({
              task_id: newTask.id,
              billboard_id: item.billboard_id,
              status: 'pending',
              faces_to_install: newFacesToInstall,
              reinstall_count: (item.reinstall_count || 0) + 1,
              total_reinstalled_faces: newTotalReinstalled,
              replacement_status: 'reinstalled',
              replacement_reason: finalReason,
              replacement_cost_bearer: costBearer,
              replacement_cost_percentage: costBearer === 'split' ? splitPercentage : (costBearer === 'customer' ? 100 : 0),
              reinstalled_faces: reinstalledFaces,
              customer_original_install_cost: item.customer_original_install_cost || item.customer_installation_cost || 0,
              customer_reinstall_cost: 0,
            });

          if (itemError) throw itemError;

          // تعديل حالة اللوحة في المهمة الحالية (تبقى مكتملة ولكن يتم تحديث وسم الاستبدال لربطها)
          await supabase
            .from('installation_task_items')
            .update({
              replacement_status: 'reinstalled',
              replacement_reason: finalReason,
              replacement_cost_bearer: costBearer,
              replacement_cost_percentage: costBearer === 'split' ? splitPercentage : (costBearer === 'customer' ? 100 : 0),
              reinstall_count: (item.reinstall_count || 0) + 1,
              reinstalled_faces: reinstalledFaces,
            } as any)
            .eq('id', item.id);

          toast.success('تم إنشاء مهمة إعادة تركيب مستقلة وجديدة بنجاح');
        } else {
          // إعادة تركيب في نفس المهمة الحالية (الآلية القديمة)
          const updateData: any = {
            reinstall_count: (item.reinstall_count || 0) + 1,
            total_reinstalled_faces: newTotalReinstalled,
            replacement_status: 'reinstalled',
            replacement_reason: finalReason,
            replacement_cost_bearer: costBearer,
            replacement_cost_percentage: costBearer === 'split' ? splitPercentage : (costBearer === 'customer' ? 100 : 0),
            status: 'pending',
            installation_date: null,
            reinstalled_faces: reinstalledFaces,
            faces_to_install: newFacesToInstall,
            customer_original_install_cost: item.customer_original_install_cost || item.customer_installation_cost || 0,
            customer_reinstall_cost: 0,
          };

          if (reinstalledFaces === 'both') {
            updateData.installed_image_face_a_url = null;
            updateData.installed_image_face_b_url = null;
          } else if (reinstalledFaces === 'face_a') {
            updateData.installed_image_face_a_url = null;
          } else if (reinstalledFaces === 'face_b') {
            updateData.installed_image_face_b_url = null;
          }

          await supabase
            .from('installation_task_items')
            .update(updateData)
            .eq('id', item.id);

          toast.success('تم تسجيل إعادة التركيب داخل المهمة الحالية بنجاح');
        }
      } else {
        // استبدال بلوحة أخرى
        await supabase
          .from('installation_task_items')
          .update({
            replacement_status: 'replaced',
            replacement_reason: finalReason,
            replacement_cost_bearer: costBearer,
            replacement_cost_percentage: costBearer === 'split' ? splitPercentage : (costBearer === 'customer' ? 100 : 0),
            reinstalled_faces: reinstalledFaces,
          } as any)
          .eq('id', item.id);

        const { data: newItem, error: insertError } = await supabase
          .from('installation_task_items')
          .insert({
            task_id: taskId,
            billboard_id: selectedReplacementId,
            status: 'pending',
            replacement_status: 'replacement',
            replaces_item_id: item.id,
            replacement_reason: finalReason,
            replacement_cost_bearer: costBearer,
            replacement_cost_percentage: costBearer === 'split' ? splitPercentage : (costBearer === 'customer' ? 100 : 0),
            faces_to_install: item.faces_to_install || 2,
            reinstalled_faces: reinstalledFaces,
          } as any)
          .select()
          .single();

        if (insertError) throw insertError;

        if (newItem) {
          await supabase
            .from('installation_task_items')
            .update({ replaced_by_item_id: newItem.id } as any)
            .eq('id', item.id);
        }

        toast.success('تم استبدال اللوحة بنجاح');
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error:', error);
      toast.error('فشل في العملية: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedReplacement = availableBillboards.find(b => b.ID === selectedReplacementId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <RefreshCw className="h-5 w-5 text-primary" />
            إعادة تركيب / استبدال لوحة
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* معلومات اللوحة الحالية */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl border">
            {billboard?.Image_URL && (
              <img src={billboard.Image_URL} alt="" className="w-14 h-14 rounded-lg object-cover border" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{billboard?.Billboard_Name || `لوحة #${billboard?.ID}`}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[10px]">#{billboard?.ID}</Badge>
                <Badge className="text-[10px] bg-primary/10 text-primary border-0">{billboard?.Size}</Badge>
                {hasMultipleFaces && (
                  <Badge className="text-[10px] bg-blue-500/10 text-blue-600 border-0">
                    {facesCount} أوجه
                  </Badge>
                )}
                {item.reinstall_count > 0 && (
                  <Badge className="text-[10px] bg-amber-500/10 text-amber-500 border-0">
                    أعيد تركيبها {item.reinstall_count} مرة
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* نوع العملية */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">نوع العملية</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setActionType('reinstall')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  actionType === 'reinstall'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <RefreshCw className={`h-6 w-6 ${actionType === 'reinstall' ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="text-sm font-medium">إعادة تركيب</span>
                <span className="text-[10px] text-muted-foreground text-center">نفس اللوحة يُعاد تركيبها</span>
              </button>
              <button
                type="button"
                onClick={() => setActionType('replace')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  actionType === 'replace'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <Replace className={`h-6 w-6 ${actionType === 'replace' ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="text-sm font-medium">استبدال</span>
                <span className="text-[10px] text-muted-foreground text-center">استبدال بلوحة أخرى</span>
              </button>
            </div>
          </div>

          {/* وجهة إعادة التركيب - تظهر فقط عند اختيار إعادة تركيب */}
          {actionType === 'reinstall' && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">طريقة تنفيذ إعادة التركيب</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDestinationType('new_task')}
                  className={`flex flex-col items-center gap-2 p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                    destinationType === 'new_task'
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <FolderPlus className={`h-5 w-5 ${destinationType === 'new_task' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="text-xs font-semibold">مهمة جديدة مستقلة (موصى به)</span>
                  <span className="text-[10px] text-muted-foreground text-center leading-normal">إنشاء مهمة منفصلة للوحة لمتابعة التركيب دون التأثير على اكتمال المهمة الحالية</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDestinationType('current_task')}
                  className={`flex flex-col items-center gap-2 p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                    destinationType === 'current_task'
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <RefreshCw className={`h-5 w-5 ${destinationType === 'current_task' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="text-xs font-semibold">إعادة تعيين في المهمة الحالية</span>
                  <span className="text-[10px] text-muted-foreground text-center leading-normal">يرجع حالة اللوحة قيد التنفيذ في نفس هذه المهمة ويقلل نسبة اكتمالها</span>
                </button>
              </div>
            </div>
          )}

          {/* اختيار الوجه - يظهر فقط للوحات متعددة الأوجه */}
          {hasMultipleFaces && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold">أي وجه يتم {actionType === 'reinstall' ? 'إعادة تركيبه' : 'استبداله'}؟</Label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setReinstalledFaces('both')}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                    reinstalledFaces === 'both'
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <div className="flex gap-0.5">
                    <div className={`w-4 h-6 rounded-sm ${reinstalledFaces === 'both' ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                    <div className={`w-4 h-6 rounded-sm ${reinstalledFaces === 'both' ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                  </div>
                  <span className="text-xs font-medium">الوجهين</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReinstalledFaces('face_a')}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                    reinstalledFaces === 'face_a'
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20 shadow-sm'
                      : 'border-border hover:border-amber-400'
                  }`}
                >
                  <div className="flex gap-0.5">
                    <div className={`w-4 h-6 rounded-sm ${reinstalledFaces === 'face_a' ? 'bg-amber-500' : 'bg-muted-foreground/30'}`} />
                    <div className="w-4 h-6 rounded-sm bg-muted-foreground/10 border border-dashed border-muted-foreground/30" />
                  </div>
                  <span className="text-xs font-medium">الأمامي فقط</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReinstalledFaces('face_b')}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                    reinstalledFaces === 'face_b'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 shadow-sm'
                      : 'border-border hover:border-blue-400'
                  }`}
                >
                  <div className="flex gap-0.5">
                    <div className="w-4 h-6 rounded-sm bg-muted-foreground/10 border border-dashed border-muted-foreground/30" />
                    <div className={`w-4 h-6 rounded-sm ${reinstalledFaces === 'face_b' ? 'bg-blue-500' : 'bg-muted-foreground/30'}`} />
                  </div>
                  <span className="text-xs font-medium">الخلفي فقط</span>
                </button>
              </div>
              {reinstalledFaces !== 'both' && (
                <div className="text-[11px] text-muted-foreground bg-muted/50 p-2.5 rounded-lg flex items-start gap-1.5 leading-normal">
                  <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>سيتم {actionType === 'reinstall' ? 'إعادة تركيب' : 'استبدال'} {reinstalledFaces === 'face_a' ? 'الوجه الأمامي' : 'الوجه الخلفي'} فقط، والوجه الآخر سيبقى كما هو.</span>
                </div>
              )}
            </div>
          )}

          {/* السبب */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">السبب</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="اختر السبب..." />
              </SelectTrigger>
              <SelectContent>
                {REPLACEMENT_REASONS.map(r => (
                  <SelectItem key={r.value} value={r.value}>
                    <div className="flex items-center gap-2">
                      <span>{r.label}</span>
                      <Badge variant="outline" className="text-[9px] px-1">
                        {r.bearer === 'company' ? 'الشركة' : r.bearer === 'customer' ? 'الزبون' : 'مشترك'}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {reason === 'other' && (
              <div className="space-y-2">
                <Input
                  value={customReason}
                  onChange={e => setCustomReason(e.target.value)}
                  placeholder="اكتب السبب هنا..."
                  className="text-sm"
                  autoFocus
                />
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Info className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>اختر من يتحمل التكلفة من الخيارات أدناه</span>
                </p>
              </div>
            )}
          </div>

          {/* اللوحة البديلة (عند الاستبدال) */}
          {actionType === 'replace' && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">اللوحة البديلة</Label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالرقم أو الاسم أو المدينة..."
                  className="pr-10"
                />
              </div>
              {availableBillboards.length > 0 && (
                <div className="max-h-40 overflow-y-auto border rounded-lg divide-y">
                  {availableBillboards.map(b => (
                    <button
                      key={b.ID}
                      type="button"
                      onClick={() => setSelectedReplacementId(b.ID)}
                      className={`w-full flex items-center gap-2 p-2 text-right transition-colors ${
                        selectedReplacementId === b.ID
                          ? 'bg-primary/10 border-r-2 border-r-primary'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      {b.Image_URL && (
                        <img src={b.Image_URL} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{b.Billboard_Name || `لوحة #${b.ID}`}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">#{b.ID}</span>
                          <Badge variant="outline" className="text-[9px] h-4">{b.Size}</Badge>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <MapPin className="h-2.5 w-2.5" />{b.City}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {selectedReplacement && (
                <div className="flex items-center gap-2 p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <Box className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    اللوحة البديلة: #{selectedReplacement.ID} - {selectedReplacement.Billboard_Name}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* تحمل التكلفة */}
          <div className="space-y-3 p-3 bg-muted/30 rounded-xl border">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <Label className="text-sm font-semibold">تحمّل التكلفة</Label>
            </div>
            <RadioGroup
              value={costBearer}
              onValueChange={(v) => { setCostBearer(v as any); setManualCostBearer(true); }}
              className="grid grid-cols-3 gap-2"
            >
              <div className={`flex items-center gap-2 p-2.5 rounded-lg border-2 cursor-pointer transition-all ${
                costBearer === 'customer' ? 'border-primary bg-primary/5' : 'border-border'
              }`}>
                <RadioGroupItem value="customer" id="customer" />
                <Label htmlFor="customer" className="text-xs cursor-pointer">على الزبون</Label>
              </div>
              <div className={`flex items-center gap-2 p-2.5 rounded-lg border-2 cursor-pointer transition-all ${
                costBearer === 'company' ? 'border-primary bg-primary/5' : 'border-border'
              }`}>
                <RadioGroupItem value="company" id="company" />
                <Label htmlFor="company" className="text-xs cursor-pointer">على الشركة</Label>
              </div>
              <div className={`flex items-center gap-2 p-2.5 rounded-lg border-2 cursor-pointer transition-all ${
                costBearer === 'split' ? 'border-primary bg-primary/5' : 'border-border'
              }`}>
                <RadioGroupItem value="split" id="split" />
                <Label htmlFor="split" className="text-xs cursor-pointer">نسبة</Label>
              </div>
            </RadioGroup>

            {costBearer === 'split' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">نسبة الزبون</span>
                  <span className="font-bold text-primary">{splitPercentage}%</span>
                </div>
                <Input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={splitPercentage}
                  onChange={e => setSplitPercentage(Number(e.target.value))}
                  className="w-full h-2 accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>الزبون: {splitPercentage}%</span>
                  <span>الشركة: {100 - splitPercentage}%</span>
                </div>
              </div>
            )}

            {reason && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span className="text-[11px] text-amber-700 dark:text-amber-300">
                  {costBearer === 'customer' && 'التكلفة كاملة على الزبون'}
                  {costBearer === 'company' && 'التكلفة كاملة على الشركة'}
                  {costBearer === 'split' && `الزبون يتحمل ${splitPercentage}% والشركة ${100 - splitPercentage}%`}
                </span>
              </div>
            )}
          </div>

          {/* أزرار التأكيد */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              إلغاء
            </Button>
            <Button onClick={handleSubmit} disabled={loading || !reason}>
              {loading ? 'جاري التنفيذ...' : actionType === 'reinstall' ? 'تأكيد إعادة التركيب' : 'تأكيد الاستبدال'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
