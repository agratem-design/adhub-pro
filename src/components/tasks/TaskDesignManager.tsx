import { useState, useRef, useEffect, useCallback } from 'react';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { Plus, Pencil, Trash2, Eye, Image as ImageIcon, Upload, Link as LinkIcon, Loader2, CheckCircle2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { uploadToImgbb } from '@/services/imgbbService';
import { CustomDatePicker } from '@/components/ui/custom-date-picker';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface TaskDesign {
  id: string;
  task_id: string;
  design_name: string;
  design_face_a_url: string;
  design_face_b_url?: string;
  design_order: number;
  created_at?: string;
}

interface TaskDesignManagerProps {
  taskId: string;
  designs: TaskDesign[];
  onDesignsUpdate: () => void;
  contractNumber?: number | string;
  customerName?: string;
  adType?: string;
  /** When set, new designs will be inserted for the current taskId AND each of these task ids (group/team strip context). */
  replicateToTaskIds?: string[];
}

export function TaskDesignManager({ taskId, designs, onDesignsUpdate, contractNumber, customerName: propCustomerName, adType: propAdType, replicateToTaskIds }: TaskDesignManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { confirm: systemConfirm } = useSystemDialog();
  const [editingDesign, setEditingDesign] = useState<TaskDesign | null>(null);
  const [designName, setDesignName] = useState('');
  const [designFaceAUrl, setDesignFaceAUrl] = useState('');
  const [designFaceBUrl, setDesignFaceBUrl] = useState('');
  const [designDate, setDesignDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [previewDesign, setPreviewDesign] = useState<TaskDesign | null>(null);

  // Separate upload method and loading state per face
  const [uploadMethodA, setUploadMethodA] = useState<'url' | 'file'>('url');
  const [uploadMethodB, setUploadMethodB] = useState<'url' | 'file'>('url');
  const [uploadingA, setUploadingA] = useState(false);
  const [uploadingB, setUploadingB] = useState(false);
  const fileInputRefA = useRef<HTMLInputElement>(null);
  const fileInputRefB = useRef<HTMLInputElement>(null);
  
  // Fallback: fetch contract data if not provided via props
  const [resolvedCustomerName, setResolvedCustomerName] = useState(propCustomerName || '');
  const [resolvedAdType, setResolvedAdType] = useState(propAdType || '');

  useEffect(() => {
    setResolvedCustomerName(propCustomerName || '');
    setResolvedAdType(propAdType || '');
  }, [propCustomerName, propAdType]);

  useEffect(() => {
    if (resolvedCustomerName && resolvedAdType) return;
    if (!contractNumber) return;
    
    const fetchContractInfo = async () => {
      const { data } = await supabase
        .from('Contract')
        .select('"Customer Name", "Ad Type"')
        .eq('Contract_Number', Number(contractNumber))
        .single();
      
      if (data) {
        if (!resolvedCustomerName) setResolvedCustomerName(data['Customer Name'] || '');
        if (!resolvedAdType) setResolvedAdType(data['Ad Type'] || '');
      }
    };
    fetchContractInfo();
  }, [contractNumber, resolvedCustomerName, resolvedAdType]);

  const getDesignUploadContext = (face: 'A' | 'B') => {
    const dName = designName?.trim() || 'design';
    const cNum = contractNumber ? String(contractNumber).trim() : '';
    const aType = resolvedAdType?.trim() || '';
    const taskCode = `re${taskId.substring(0, 6)}`;

    const nameParts: string[] = [dName];
    if (cNum) nameParts.push(`C${cNum}`);
    nameParts.push(taskCode);
    if (aType) nameParts.push(aType);
    nameParts.push(`face-${face}`);
    const imageName = nameParts.join('_').replace(/\s+/g, '-').replace(/[^\w\u0600-\u06FF_-]/g, '-') + '.jpg';

    const folderParts = [cNum ? `C${cNum}` : '', taskCode, aType].filter(Boolean);
    const folderPath = `designs/${folderParts.join('_').replace(/\s+/g, '-').replace(/[^\w\u0600-\u06FF_-]/g, '-')}`;

    return { imageName, folderPath };
  };

  const handleFileUpload = async (file: File, face: 'A' | 'B') => {
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('يرجى اختيار ملف صورة صحيح (JPG, PNG, GIF, WEBP)');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error('حجم الملف يجب أن لا يتجاوز 25MB');
      return;
    }

    const setUploading = face === 'A' ? setUploadingA : setUploadingB;
    setUploading(true);
    const { createUploadProgressTracker } = await import('@/hooks/useUploadProgress');
    const progress = createUploadProgressTracker();
    const fileSizeKB = Math.round(file.size / 1024);

    const { imageName, folderPath } = getDesignUploadContext(face);
    progress.start(imageName, fileSizeKB);

    let pct = 5;
    const interval = setInterval(() => {
      if (pct < 30) pct += 5;
      else if (pct < 70) pct += 3;
      else if (pct < 90) pct += 1;
      progress.update(pct);
    }, 250);

    try {
      const { uploadImageWithFallback } = await import('@/services/imageUploadService');
      const imageUrl = await uploadImageWithFallback(file, imageName, folderPath);

      clearInterval(interval);
      progress.update(100);

      if (face === 'A') {
        setDesignFaceAUrl(imageUrl);
      } else {
        setDesignFaceBUrl(imageUrl);
      }
      progress.complete(true, `تم رفع تصميم الوجه ${face === 'A' ? 'الأمامي' : 'الخلفي'} بنجاح`);
    } catch (error: any) {
      clearInterval(interval);
      console.error('Upload error:', error);
      progress.complete(false, error.message || 'فشل رفع التصميم. يرجى إعادة المحاولة.');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveDesign = async () => {
    if (!designName.trim()) {
      toast.error('يرجى إدخال اسم التصميم');
      return;
    }

    if (!designFaceAUrl.trim()) {
      toast.error('يرجى إدخال رابط تصميم الوجه الأمامي على الأقل');
      return;
    }

    setSaving(true);
    try {
      if (editingDesign) {
        const { error } = await supabase
          .from('task_designs')
          .update({
            design_name: designName,
            design_face_a_url: designFaceAUrl,
            design_face_b_url: designFaceBUrl || null,
            created_at: new Date(designDate + 'T00:00:00').toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', editingDesign.id);

        if (error) throw error;
        toast.success('تم تحديث التصميم بنجاح');
      } else {
        const targetTaskIds = Array.from(new Set([taskId, ...((replicateToTaskIds || []).filter(Boolean))]));
        
        const { data: validTasks, error: checkError } = await supabase
          .from('installation_tasks')
          .select('id')
          .in('id', targetTaskIds);

        if (checkError) throw checkError;

        const validTaskIds = (validTasks || []).map(t => t.id);

        if (validTaskIds.length === 0) {
          throw new Error('المهمة المحددة (أو المهام التابعة لها) لم تعد موجودة في قاعدة البيانات. يرجى تحديث الصفحة.');
        }

        if (!validTaskIds.includes(taskId)) {
          throw new Error('المهمة الحالية التي تحاول إضافة تصميم لها تم حذفها، يرجى تحديث الصفحة.');
        }

        const rows = validTaskIds.map((tid) => ({
          task_id: tid,
          design_name: designName,
          design_face_a_url: designFaceAUrl,
          design_face_b_url: designFaceBUrl || null,
          design_order: designs.length,
          created_at: new Date(designDate + 'T00:00:00').toISOString(),
        }));

        const { error } = await supabase.from('task_designs').insert(rows).select();
        if (error) throw error;
        toast.success(validTaskIds.length > 1 ? `تم إضافة التصميم لـ ${validTaskIds.length} مهام` : 'تم إضافة التصميم بنجاح');
      }

      setDialogOpen(false);
      resetForm();
      // Immediate refresh
      onDesignsUpdate();
    } catch (error: any) {
      console.error('Error saving design:', error);
      toast.error('فشل في حفظ التصميم: ' + (error.message || 'خطأ غير معروف'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDesign = async (designId: string) => {
    if (!await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذا التصميم؟', variant: 'destructive', confirmText: 'حذف' })) return;

    try {
      const { error } = await supabase
        .from('task_designs')
        .delete()
        .eq('id', designId);

      if (error) throw error;
      toast.success('تم حذف التصميم بنجاح');
      // Immediate refresh
      onDesignsUpdate();
    } catch (error) {
      console.error('Error deleting design:', error);
      toast.error('فشل في حذف التصميم');
    }
  };

  const resetForm = () => {
    setDesignName('');
    setDesignFaceAUrl('');
    setDesignFaceBUrl('');
    setDesignDate(new Date().toISOString().slice(0, 10));
    setEditingDesign(null);
    setUploadMethodA('url');
    setUploadMethodB('url');
  };

  const openEditDialog = (design: TaskDesign) => {
    setEditingDesign(design);
    setDesignName(design.design_name);
    setDesignFaceAUrl(design.design_face_a_url);
    setDesignFaceBUrl(design.design_face_b_url || '');
    setDesignDate(design.created_at ? new Date(design.created_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    setDialogOpen(true);
  };

  const handlePasteFromClipboard = async (targetFace: 'A' | 'B') => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        toast.error('المتصفح لا يدعم الوصول للحافظة أو يتطلب اتصالاً آمناً (HTTPS)');
        return;
      }
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], `pasted.${imageType.split('/')[1]}`, { type: imageType });
          await handleFileUpload(file, targetFace);
          return;
        }
      }
      const text = await navigator.clipboard.readText();
      if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
        if (targetFace === 'A') setDesignFaceAUrl(text);
        else setDesignFaceBUrl(text);
        toast.success(`تم لصق رابط في الوجه ${targetFace === 'A' ? 'الأمامي' : 'الخلفي'}`);
      } else {
        toast.error('لا توجد صورة أو رابط في الحافظة');
      }
    } catch {
      try {
        const text = await navigator.clipboard.readText();
        if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
          if (targetFace === 'A') setDesignFaceAUrl(text);
          else setDesignFaceBUrl(text);
          toast.success(`تم لصق رابط في الوجه ${targetFace === 'A' ? 'الأمامي' : 'الخلفي'}`);
        } else {
          toast.error('لا توجد صورة أو رابط في الحافظة');
        }
      } catch {
        toast.error('لا يمكن الوصول إلى الحافظة');
      }
    }
  };

  /* ── Face Input (isolated per face – no shared uploadMethod state) ── */
  const renderFaceInput = (face: 'A' | 'B') => {
    const url = face === 'A' ? designFaceAUrl : designFaceBUrl;
    const setUrl = face === 'A' ? setDesignFaceAUrl : setDesignFaceBUrl;
    const uploading = face === 'A' ? uploadingA : uploadingB;
    const fileRef = face === 'A' ? fileInputRefA : fileInputRefB;
    const uploadMethod = face === 'A' ? uploadMethodA : uploadMethodB;
    const setUploadMethod = face === 'A' ? setUploadMethodA : setUploadMethodB;
    const label = face === 'A' ? 'الوجه الأمامي (A)' : 'الوجه الخلفي (B)';
    const isRequired = face === 'A';

    return (
      <div
        className="space-y-2.5 p-3.5 rounded-xl border border-border/60 bg-muted/20 transition-all hover:border-primary/30"
        onPaste={async (e) => {
          e.preventDefault();
          const items = e.clipboardData?.items;
          if (!items) return;
          for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
              const file = item.getAsFile();
              if (file) { await handleFileUpload(file, face); return; }
            }
          }
          const text = e.clipboardData?.getData('text');
          if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
            setUrl(text);
            toast.success(`تم لصق رابط في ${label}`);
          }
        }}
        tabIndex={0}
      >
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs font-bold">
              {label}
              {isRequired && <span className="text-red-500 mr-0.5">*</span>}
            </Label>
            {url && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
          </div>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handlePasteFromClipboard(face)}
              className="text-[10px] h-6 px-2 rounded-lg"
              title="لصق من الحافظة"
            >
              لصق
            </Button>
            <Button
              type="button"
              size="sm"
              variant={uploadMethod === 'file' ? 'default' : 'outline'}
              onClick={() => setUploadMethod('file')}
              className="text-[10px] h-6 px-2 rounded-lg"
            >
              <Upload className="h-3 w-3 ml-0.5" />
              رفع
            </Button>
            <Button
              type="button"
              size="sm"
              variant={uploadMethod === 'url' ? 'default' : 'outline'}
              onClick={() => setUploadMethod('url')}
              className="text-[10px] h-6 px-2 rounded-lg"
            >
              <LinkIcon className="h-3 w-3 ml-0.5" />
              رابط
            </Button>
          </div>
        </div>

        {/* Input area */}
        {uploadMethod === 'url' ? (
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            dir="ltr"
            className="h-9 text-xs rounded-lg"
          />
        ) : (
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file, face);
                // Reset so same file can be re-selected
                if (fileRef.current) fileRef.current.value = '';
              }}
            />
            <div
              onClick={() => !uploading && fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files?.[0];
                if (file && !uploading) handleFileUpload(file, face);
              }}
              className="flex flex-col items-center justify-center h-20 border-2 border-dashed border-border/50 rounded-xl cursor-pointer hover:bg-accent/30 hover:border-primary/30 transition-all"
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-1">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-[10px] text-muted-foreground font-medium">جاري الرفع...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <Upload className="h-5 w-5 text-muted-foreground/60" />
                  <span className="text-[10px] text-muted-foreground">اسحب أو انقر أو الصق (Ctrl+V)</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Preview thumbnail */}
        {url && (
          <div className="relative aspect-video rounded-xl overflow-hidden border border-primary/20 bg-background shadow-sm">
            <img
              src={url}
              alt={`معاينة ${label}`}
              className="w-full h-full object-contain"
              onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
            />
            <button
              type="button"
              onClick={() => window.open(url, '_blank')}
              className="absolute bottom-1.5 left-1.5 bg-black/60 hover:bg-black/80 text-white text-[9px] px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Eye className="h-3 w-3" />
              عرض
            </button>
            <button
              type="button"
              onClick={() => setUrl('')}
              className="absolute top-1.5 left-1.5 bg-red-500/80 hover:bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded-md transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <ImageIcon className="h-4.5 w-4.5 text-primary" />
          التصاميم المضافة
          {designs.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5 rounded-md font-bold">{designs.length}</Badge>
          )}
        </h3>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 rounded-xl h-8 text-xs font-bold">
              <Plus className="w-3.5 h-3.5" />
              إضافة تصميم
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-right">
                {editingDesign ? 'تعديل التصميم' : 'إضافة تصميم جديد'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Name + Date row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="designName" className="text-xs font-bold">اسم التصميم <span className="text-red-500">*</span></Label>
                  <Input
                    id="designName"
                    value={designName}
                    onChange={(e) => setDesignName(e.target.value)}
                    placeholder="مثال: تصميم شركة ABC"
                    className="h-9 text-xs rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="designDate" className="text-xs font-bold">تاريخ إدخال التصميم</Label>
                  <CustomDatePicker
                    value={designDate}
                    onChange={(val) => setDesignDate(val)}
                    placeholder="اختر تاريخ التصميم"
                  />
                </div>
              </div>

              {/* Face A */}
              {renderFaceInput('A')}

              {/* Face B */}
              {renderFaceInput('B')}

              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
                <Button
                  onClick={handleSaveDesign}
                  disabled={saving || uploadingA || uploadingB}
                  className="flex-1 h-10 rounded-xl font-bold"
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      جاري الحفظ...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      {editingDesign ? 'تحديث التصميم' : 'حفظ التصميم'}
                    </span>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setDialogOpen(false); resetForm(); }}
                  disabled={saving}
                  className="h-10 rounded-xl"
                >
                  إلغاء
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Designs List */}
      {designs.length === 0 ? (
        <Card className="p-8 text-center border-dashed border-2 border-border/40 bg-muted/10 rounded-xl">
          <ImageIcon className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground font-medium">لم يتم إضافة تصاميم بعد</p>
          <p className="text-xs text-muted-foreground/60 mt-1">أضف تصاميم لتسهيل عملية التركيب</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {designs.map((design, index) => (
            <Card
              key={design.id}
              className="p-3 rounded-xl border border-border/50 hover:border-primary/20 hover:shadow-md transition-all bg-card"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[9px] h-4.5 rounded-md font-mono shrink-0">
                      #{index + 1}
                    </Badge>
                    <h4 className="font-bold text-sm text-foreground truncate">{design.design_name}</h4>
                  </div>
                  {design.created_at && (
                    <div className="flex items-center gap-1 mt-1">
                      <Calendar className="h-3 w-3 text-muted-foreground/60" />
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(design.created_at), 'dd MMM yyyy', { locale: ar })}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex gap-0.5 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setPreviewDesign(design)}
                    className="h-7 w-7 rounded-lg hover:bg-primary/10"
                    title="معاينة"
                  >
                    <Eye className="w-3.5 h-3.5 text-primary" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEditDialog(design)}
                    className="h-7 w-7 rounded-lg hover:bg-amber-500/10"
                    title="تعديل"
                  >
                    <Pencil className="w-3.5 h-3.5 text-amber-600" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDeleteDesign(design.id)}
                    className="h-7 w-7 rounded-lg hover:bg-red-500/10"
                    title="حذف"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                </div>
              </div>

              {/* Design Faces Grid */}
              <div className={`grid gap-2.5 ${design.design_face_b_url ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {/* Face A */}
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground text-center font-bold">الوجه الأمامي (A)</p>
                  <div
                    className="aspect-video bg-muted/30 rounded-xl overflow-hidden border border-border/40 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
                    onClick={() => setPreviewDesign(design)}
                  >
                    <img
                      src={design.design_face_a_url}
                      alt="الوجه الأمامي"
                      className="w-full h-full object-contain"
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                    />
                  </div>
                </div>

                {/* Face B */}
                {design.design_face_b_url && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground text-center font-bold">الوجه الخلفي (B)</p>
                    <div
                      className="aspect-video bg-muted/30 rounded-xl overflow-hidden border border-border/40 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
                      onClick={() => setPreviewDesign(design)}
                    >
                      <img
                        src={design.design_face_b_url}
                        alt="الوجه الخلفي"
                        className="w-full h-full object-contain"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewDesign} onOpenChange={(open) => !open && setPreviewDesign(null)}>
        <DialogContent className="max-w-4xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">{previewDesign?.design_name}</DialogTitle>
          </DialogHeader>
          {previewDesign && (
            <div className={`grid gap-4 ${previewDesign.design_face_b_url ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
              <div className="space-y-2">
                <h4 className="font-bold text-sm">تصميم الوجه الأمامي (A)</h4>
                <div className="aspect-video bg-muted rounded-xl overflow-hidden border-2 border-border/40">
                  <img
                    src={previewDesign.design_face_a_url}
                    alt="الوجه الأمامي"
                    className="w-full h-full object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(previewDesign.design_face_a_url, '_blank')}
                  className="w-full gap-2 rounded-xl"
                >
                  <Eye className="w-4 h-4" />
                  فتح في نافذة جديدة
                </Button>
              </div>
              {previewDesign.design_face_b_url && (
                <div className="space-y-2">
                  <h4 className="font-bold text-sm">تصميم الوجه الخلفي (B)</h4>
                  <div className="aspect-video bg-muted rounded-xl overflow-hidden border-2 border-border/40">
                    <img
                      src={previewDesign.design_face_b_url}
                      alt="الوجه الخلفي"
                      className="w-full h-full object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(previewDesign.design_face_b_url!, '_blank')}
                    className="w-full gap-2 rounded-xl"
                  >
                    <Eye className="w-4 h-4" />
                    فتح في نافذة جديدة
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
