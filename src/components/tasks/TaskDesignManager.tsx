import { useState, useRef, useEffect } from 'react';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { Plus, Pencil, Trash2, Eye, Image as ImageIcon, Upload, Link as LinkIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { uploadToImgbb } from '@/services/imgbbService';
import { CustomDatePicker } from '@/components/ui/custom-date-picker';

interface TaskDesign {
  id: string;
  task_id: string;
  design_name: string;
  design_face_a_url: string;
  design_face_b_url?: string;
  design_order: number;
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDesign, setPreviewDesign] = useState<TaskDesign | null>(null);
  const [uploadMethod, setUploadMethod] = useState<'url' | 'file'>('url');
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

    // Image name: {designName}_{contractNum}_{taskCode}_{adType}_face-{A/B}
    const nameParts: string[] = [dName];
    if (cNum) nameParts.push(`C${cNum}`);
    nameParts.push(taskCode);
    if (aType) nameParts.push(aType);
    nameParts.push(`face-${face}`);
    const imageName = nameParts.join('_').replace(/\s+/g, '-').replace(/[^\w\u0600-\u06FF_-]/g, '-') + '.jpg';

    // Folder: designs/{contractNum}_{taskCode}_{adType}
    const folderParts = [cNum ? `C${cNum}` : '', taskCode, aType].filter(Boolean);
    const folderPath = `designs/${folderParts.join('_').replace(/\s+/g, '-').replace(/[^\w\u0600-\u06FF_-]/g, '-')}`;

    return { imageName, folderPath };
  };

  const buildImageName = (face: 'A' | 'B') => getDesignUploadContext(face).imageName;

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
        
        // التحقق من وجود المهام فعلياً في قاعدة البيانات لمنع أخطاء Constraint Foreign Key
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
      setTimeout(() => onDesignsUpdate(), 100);
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
      setTimeout(() => onDesignsUpdate(), 100);
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
    setUploadMethod('url');
  };

  const openEditDialog = (design: TaskDesign) => {
    setEditingDesign(design);
    setDesignName(design.design_name);
    setDesignFaceAUrl(design.design_face_a_url);
    setDesignFaceBUrl(design.design_face_b_url || '');
    setDesignDate((design as any).created_at ? new Date((design as any).created_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
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

  const renderFaceInput = (face: 'A' | 'B') => {
    const url = face === 'A' ? designFaceAUrl : designFaceBUrl;
    const setUrl = face === 'A' ? setDesignFaceAUrl : setDesignFaceBUrl;
    const uploading = face === 'A' ? uploadingA : uploadingB;
    const fileRef = face === 'A' ? fileInputRefA : fileInputRefB;
    const label = face === 'A' ? 'تصميم الوجه الأمامي (A) *' : 'تصميم الوجه الخلفي (B)';

    return (
      <div 
        className="space-y-2 p-3 rounded-lg border-2 border-dashed transition-all hover:border-primary/40"
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
        <div className="flex items-center justify-between">
          <Label>{label}</Label>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => handlePasteFromClipboard(face)} className="text-xs h-7 px-2" title="لصق من الحافظة">
 <span className="text-[10px]"></span>
              لصق
            </Button>
            <Button
              size="sm"
              variant={uploadMethod === 'file' ? 'default' : 'outline'}
              onClick={() => setUploadMethod('file')}
              className="text-xs h-7 px-2"
            >
              <Upload className="h-3 w-3 ml-1" />
              رفع
            </Button>
            <Button
              size="sm"
              variant={uploadMethod === 'url' ? 'default' : 'outline'}
              onClick={() => setUploadMethod('url')}
              className="text-xs h-7 px-2"
            >
              <LinkIcon className="h-3 w-3 ml-1" />
              رابط
            </Button>
          </div>
        </div>

        {uploadMethod === 'url' ? (
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            dir="ltr"
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
              className="flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin text-primary mb-1" />
                  <span className="text-xs text-muted-foreground">جاري الرفع...</span>
                </>
              ) : (
                <>
                  <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">اسحب أو انقر أو الصق (Ctrl+V)</span>
                </>
              )}
            </div>
          </div>
        )}

        {url && (
          <>
            <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-primary/20 bg-muted">
              <img
                src={url}
                alt={`معاينة الوجه ${face}`}
                className="w-full h-full object-contain"
                onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.open(url, '_blank')}
              className="w-full gap-2"
            >
              <Eye className="w-4 h-4" />
              فتح في نافذة جديدة
            </Button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">التصاميم المضافة</h3>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              إضافة تصميم
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingDesign ? 'تعديل التصميم' : 'إضافة تصميم جديد'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="designName">اسم التصميم</Label>
                  <Input
                    id="designName"
                    value={designName}
                    onChange={(e) => setDesignName(e.target.value)}
                    placeholder="مثال: تصميم شركة ABC"
                  />
                </div>
                <div>
                  <Label htmlFor="designDate">تاريخ إدخال التصميم</Label>
                  <CustomDatePicker
                    value={designDate}
                    onChange={(val) => setDesignDate(val)}
                    placeholder="اختر تاريخ التصميم"
                  />
                </div>
              </div>
              {renderFaceInput('A')}
              {renderFaceInput('B')}
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSaveDesign} disabled={saving} className="flex-1">
                  {saving ? 'جاري الحفظ...' : 'حفظ'}
                </Button>
                <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }} disabled={saving}>
                  إلغاء
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {designs.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <ImageIcon className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">لم يتم إضافة تصاميم بعد</p>
          <p className="text-sm text-muted-foreground mt-1">أضف تصاميم لتسهيل عملية التركيب</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {designs.map((design) => (
            <Card key={design.id} className="p-4 hover:shadow-lg transition-shadow">
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm truncate flex-1">{design.design_name}</h4>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setPreviewDesign(design)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEditDialog(design)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDeleteDesign(design.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground text-center">الوجه الأمامي (A)</p>
                    <div className="aspect-video bg-muted rounded-lg overflow-hidden border">
                      <img src={design.design_face_a_url} alt="الوجه الأمامي" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
                    </div>
                  </div>
                  {design.design_face_b_url && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground text-center">الوجه الخلفي (B)</p>
                      <div className="aspect-video bg-muted rounded-lg overflow-hidden border">
                        <img src={design.design_face_b_url} alt="الوجه الخلفي" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewDesign} onOpenChange={(open) => !open && setPreviewDesign(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewDesign?.design_name}</DialogTitle>
          </DialogHeader>
          {previewDesign && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">تصميم الوجه الأمامي (A)</h4>
                <div className="aspect-video bg-muted rounded-lg overflow-hidden border-2">
                  <img src={previewDesign.design_face_a_url} alt="الوجه الأمامي" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
                </div>
                <Button variant="outline" size="sm" onClick={() => window.open(previewDesign.design_face_a_url, '_blank')} className="w-full gap-2">
                  <Eye className="w-4 h-4" />
                  فتح في نافذة جديدة
                </Button>
              </div>
              {previewDesign.design_face_b_url && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">تصميم الوجه الخلفي (B)</h4>
                  <div className="aspect-video bg-muted rounded-lg overflow-hidden border-2">
                    <img src={previewDesign.design_face_b_url} alt="الوجه الخلفي" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => window.open(previewDesign.design_face_b_url!, '_blank')} className="w-full gap-2">
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
