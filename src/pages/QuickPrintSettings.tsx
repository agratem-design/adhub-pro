import { useState, useEffect, useMemo } from 'react';
import { normalizeGoogleImageUrl } from '@/utils/imageUtils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Save, RotateCcw, Settings, Image, Type, Layout, 
  Move, Maximize2, AlignCenter, Loader2, CheckCircle2, Eye, RefreshCw, Search,
  ChevronLeft, ChevronRight, Printer, FileText, Users, User, ZoomIn, ZoomOut
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  useBillboardPrintSettings, 
  ELEMENT_LABELS, 
  DEFAULT_ELEMENTS,
  DEFAULT_SETTINGS,
  ElementSettings 
} from '@/hooks/useBillboardPrintSettings';
import { BackgroundSelector } from '@/components/billboard-print/BackgroundSelector';

// تصنيفات العناصر
const ELEMENT_CATEGORIES = {
  text: {
    label: 'النصوص',
    icon: Type,
    elements: ['contractNumber', 'adType', 'billboardName', 'size', 'facesCount', 'locationInfo', 'landmarkInfo', 'installationDate', 'printType']
  },
  images: {
    label: 'الصور',
    icon: Image,
    elements: ['image', 'cutoutImage', 'faceAImage', 'faceBImage', 'singleInstallationImage', 'linkedInstallationImages', 'twoFacesContainer', 'designs']
  },
  layout: {
    label: 'التخطيط',
    icon: Layout,
    elements: ['qrCode']
  }
};

// خيارات object-fit
const OBJECT_FIT_OPTIONS = [
  { value: 'contain', label: 'احتواء (contain)' },
  { value: 'cover', label: 'تغطية (cover)' },
  { value: 'fill', label: 'ملء (fill)' },
  { value: 'none', label: 'بدون (none)' },
  { value: 'scale-down', label: 'تصغير (scale-down)' },
];

// خيارات object-position
const OBJECT_POSITION_OPTIONS = [
  { value: 'center', label: 'وسط' },
  { value: 'top', label: 'أعلى' },
  { value: 'bottom', label: 'أسفل' },
  { value: 'left', label: 'يسار' },
  { value: 'right', label: 'يمين' },
  { value: 'top left', label: 'أعلى يسار' },
  { value: 'top right', label: 'أعلى يمين' },
  { value: 'bottom left', label: 'أسفل يسار' },
  { value: 'bottom right', label: 'أسفل يمين' },
];

export default function QuickPrintSettings() {
  const queryClient = useQueryClient();
  const {
    profiles,
    activeProfile,
    settings,
    hasUnsavedChanges,
    isLoadingProfiles,
    loadProfile,
    updateElement,
    updateSetting,
    resetToDefault,
    saveProfile,
    isSaving,
  } = useBillboardPrintSettings();

  const [activeTab, setActiveTab] = useState('text');
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [taskSearchInput, setTaskSearchInput] = useState('');
  const [previewScale, setPreviewScale] = useState(40);
  const [previewTarget, setPreviewTarget] = useState<'customer' | 'team'>('team');
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [searchMode, setSearchMode] = useState<'tasks' | 'contracts'>('tasks');

  // جلب العقود
  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts-for-quick-print'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type", "Contract Date", billboard_ids')
        .order('Contract_Number', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // جلب مهام التركيب للمعاينة
  const { data: installationTasks = [], isLoading: isLoadingTasks, refetch: refetchTasks } = useQuery({
    queryKey: ['installation-tasks-preview', taskSearchQuery],
    queryFn: async () => {
      // جلب المهام
      const { data: tasks, error } = await supabase
        .from('installation_tasks')
        .select('id, contract_id, team_id, status, task_type, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      if (!tasks) return [];

      // جلب أسماء العملاء
      const contractIds = [...new Set(tasks.map(t => t.contract_id).filter(Boolean))];
      const { data: contractsData } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type"')
        .in('Contract_Number', contractIds);

      // جلب أسماء الفرق
      const teamIds = [...new Set(tasks.map(t => t.team_id).filter(Boolean))];
      const { data: teams } = await supabase
        .from('installation_teams')
        .select('id, team_name')
        .in('id', teamIds);

      return tasks.map(task => {
        const contract = contractsData?.find(c => c.Contract_Number === task.contract_id);
        const team = teams?.find(t => t.id === task.team_id);
        return {
          ...task,
          customer_name: contract?.['Customer Name'] || '',
          ad_type: contract?.['Ad Type'] || '',
          team_name: team?.team_name || '',
        };
      });
    }
  });

  const handleSearchTask = () => {
    setTaskSearchQuery(taskSearchInput);
  };

  // فلترة المهام والعقود
  const filteredTasks = installationTasks.filter((task: any) => {
    if (!taskSearchQuery) return true;
    const search = taskSearchQuery.toLowerCase();
    return (
      task.customer_name?.toLowerCase().includes(search) ||
      task.contract_id?.toString().includes(search) ||
      task.team_name?.toLowerCase().includes(search)
    );
  });

  const filteredContracts = contracts.filter((contract: any) => {
    if (!taskSearchQuery) return true;
    const search = taskSearchQuery.toLowerCase();
    return (
      contract['Customer Name']?.toLowerCase().includes(search) ||
      contract.Contract_Number?.toString().includes(search)
    );
  });

  // جلب تفاصيل المهمة/العقد المختار
  const { data: taskDetails, isLoading: isLoadingTaskDetails } = useQuery({
    queryKey: ['task-details-quick', selectedTaskId],
    queryFn: async () => {
      if (!selectedTaskId) return null;
      
      // تحديد ما إذا كان عقد أو مهمة
      const isContract = selectedTaskId.startsWith('contract-');
      const contractId = isContract 
        ? parseInt(selectedTaskId.replace('contract-', '')) 
        : (selectedTask as any)?.contract_id;
      
      if (!contractId) return null;

      // جلب بيانات العقد
      const { data: contract } = await supabase
        .from('Contract')
        .select('*')
        .eq('Contract_Number', contractId)
        .single();

      if (!contract) return null;

      // جلب اللوحات المرتبطة
      let billboardIdsList: number[] = [];
      if (contract.billboard_ids) {
        try {
          billboardIdsList = contract.billboard_ids.split(',').map((id: string) => parseInt(id.trim())).filter((id: number) => !isNaN(id));
        } catch { billboardIdsList = []; }
      }

      if (billboardIdsList.length === 0) return null;

      const { data: billboardsData } = await supabase
        .from('billboards')
        .select('*')
        .in('ID', billboardIdsList);

      // جلب تفاصيل عناصر المهمة للتصاميم
      let taskItems: any[] = [];
      if (!isContract && selectedTaskId) {
        const { data } = await supabase
          .from('installation_task_items')
          .select('*')
          .eq('task_id', selectedTaskId);
        taskItems = data || [];
      }

      // دمج البيانات
      const mergedBillboards = (billboardsData || []).map((bb: any) => {
        const taskItem = taskItems.find((ti: any) => ti.billboard_id === bb.ID);
        return {
          ...bb,
          design_face_a: taskItem?.design_face_a || bb.design_face_a,
          design_face_b: taskItem?.design_face_b || bb.design_face_b,
          installed_image_face_a_url: taskItem?.installed_image_face_a_url,
          installed_image_face_b_url: taskItem?.installed_image_face_b_url,
        };
      });

      return {
        contract,
        billboards: mergedBillboards,
        customerName: contract['Customer Name'] || '',
        adType: contract['Ad Type'] || '',
      };
    },
    enabled: !!selectedTaskId,
  });

  // إعادة تعيين العنصر المحدد عند تغيير التبويب
  useEffect(() => {
    const category = ELEMENT_CATEGORIES[activeTab as keyof typeof ELEMENT_CATEGORIES];
    if (category && category.elements.length > 0) {
      setSelectedElement(category.elements[0]);
    }
  }, [activeTab]);

  const selectedTaskIndex = filteredTasks.findIndex((t: any) => t.id === selectedTaskId);
  const selectedTask = selectedTaskIndex >= 0 ? filteredTasks[selectedTaskIndex] : null;

  // دالة طباعة المعاينة
  const handlePrintPreview = () => {
    if (!taskDetails?.billboards?.length) {
      toast.error('لا توجد لوحات للطباعة');
      return;
    }
    
    const taskBillboards = taskDetails.billboards;
    
    // فتح نافذة طباعة بسيطة
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('تم حظر النافذة المنبثقة');
      return;
    }
    
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>معاينة الطباعة - عقد ${selectedTask.contract_id}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .billboard { page-break-after: always; margin-bottom: 30px; border: 1px solid #ccc; padding: 20px; border-radius: 8px; }
          .billboard:last-child { page-break-after: auto; }
          .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          .info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px; }
          .images { display: flex; gap: 10px; flex-wrap: wrap; }
          .images img { max-width: 200px; max-height: 200px; object-fit: cover; border-radius: 8px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        ${taskBillboards.map((b: any) => `
          <div class="billboard">
            <div class="title">${b.Billboard_Name || 'لوحة'}</div>
            <div class="info">
              <div><strong>المقاس:</strong> ${b.Size || '-'}</div>
              <div><strong>الوجوه:</strong> ${b.Faces_Count || 1}</div>
              <div><strong>المدينة:</strong> ${b.City || '-'}</div>
              <div><strong>الحي:</strong> ${b.District || '-'}</div>
            </div>
            <div class="images">
              ${b.Image_URL ? `<img src="${normalizeGoogleImageUrl(b.Image_URL)}" alt="صورة اللوحة">` : ''}
              ${b.design_face_a ? `<img src="${normalizeGoogleImageUrl(b.design_face_a)}" alt="تصميم A">` : ''}
              ${b.design_face_b ? `<img src="${normalizeGoogleImageUrl(b.design_face_b)}" alt="تصميم B">` : ''}
            </div>
          </div>
        `).join('')}
        <script>window.onload = () => window.print();</script>
      </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
    toast.success('تم فتح نافذة الطباعة');
  };

  // دالة لاستخراج القيمة الرقمية من نص مثل "40mm" أو "100px"
  const parseNumericValue = (value: string | undefined): number => {
    if (!value) return 0;
    const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
    return isNaN(num) ? 0 : num;
  };

  // دالة لتحديث القيمة مع الحفاظ على الوحدة
  const updateWithUnit = (elementKey: string, prop: string, numValue: number, originalValue: string | undefined) => {
    const unit = originalValue?.match(/[a-z%]+$/i)?.[0] || 'px';
    updateElement(elementKey, { [prop]: `${numValue}${unit}` });
  };

  const handleSave = async () => {
    try {
      await saveProfile();
      toast.success('تم حفظ الإعدادات بنجاح');
    } catch (error) {
      toast.error('فشل في حفظ الإعدادات');
    }
  };

  const handleReset = () => {
    resetToDefault();
    toast.info('تم إعادة تعيين الإعدادات');
  };

  const getElementSettings = (elementKey: string): ElementSettings => {
    return settings.elements[elementKey] || DEFAULT_ELEMENTS[elementKey] || { visible: true };
  };

  const renderPositionControls = (elementKey: string) => {
    const element = getElementSettings(elementKey);
    
    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs">أعلى (top): {element.top || '0'}</Label>
          <div className="flex gap-2">
            <Slider
              value={[parseNumericValue(element.top)]}
              onValueChange={(v) => updateWithUnit(elementKey, 'top', v[0], element.top)}
              max={500}
              step={1}
              className="flex-1"
            />
            <Input
              value={element.top || ''}
              onChange={(e) => updateElement(elementKey, { top: e.target.value })}
              placeholder="40mm"
              className="h-8 w-20 text-xs"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">يسار (left): {element.left || '0'}</Label>
          <div className="flex gap-2">
            <Slider
              value={[parseNumericValue(element.left)]}
              onValueChange={(v) => updateWithUnit(elementKey, 'left', v[0], element.left)}
              max={500}
              step={1}
              className="flex-1"
            />
            <Input
              value={element.left || ''}
              onChange={(e) => updateElement(elementKey, { left: e.target.value })}
              placeholder="50px"
              className="h-8 w-20 text-xs"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">يمين (right): {element.right || '0'}</Label>
          <div className="flex gap-2">
            <Slider
              value={[parseNumericValue(element.right)]}
              onValueChange={(v) => updateWithUnit(elementKey, 'right', v[0], element.right)}
              max={500}
              step={1}
              className="flex-1"
            />
            <Input
              value={element.right || ''}
              onChange={(e) => updateElement(elementKey, { right: e.target.value })}
              placeholder="20mm"
              className="h-8 w-20 text-xs"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">أسفل (bottom): {element.bottom || '0'}</Label>
          <div className="flex gap-2">
            <Slider
              value={[parseNumericValue(element.bottom)]}
              onValueChange={(v) => updateWithUnit(elementKey, 'bottom', v[0], element.bottom)}
              max={500}
              step={1}
              className="flex-1"
            />
            <Input
              value={element.bottom || ''}
              onChange={(e) => updateElement(elementKey, { bottom: e.target.value })}
              placeholder="10mm"
              className="h-8 w-20 text-xs"
            />
          </div>
        </div>
      </div>
    );
  };

  const renderSizeControls = (elementKey: string) => {
    const element = getElementSettings(elementKey);
    
    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs">العرض (width): {element.width || '0'}</Label>
          <div className="flex gap-2">
            <Slider
              value={[parseNumericValue(element.width)]}
              onValueChange={(v) => updateWithUnit(elementKey, 'width', v[0], element.width)}
              max={800}
              step={1}
              className="flex-1"
            />
            <Input
              value={element.width || ''}
              onChange={(e) => updateElement(elementKey, { width: e.target.value })}
              placeholder="300px"
              className="h-8 w-20 text-xs"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">الارتفاع (height): {element.height || '0'}</Label>
          <div className="flex gap-2">
            <Slider
              value={[parseNumericValue(element.height)]}
              onValueChange={(v) => updateWithUnit(elementKey, 'height', v[0], element.height)}
              max={800}
              step={1}
              className="flex-1"
            />
            <Input
              value={element.height || ''}
              onChange={(e) => updateElement(elementKey, { height: e.target.value })}
              placeholder="200px"
              className="h-8 w-20 text-xs"
            />
          </div>
        </div>
      </div>
    );
  };

  const renderImageControls = (elementKey: string) => {
    const element = getElementSettings(elementKey);
    const isImageElement = ['image', 'cutoutImage', 'faceAImage', 'faceBImage', 'singleInstallationImage', 'linkedInstallationImages', 'twoFacesContainer', 'designs'].includes(elementKey);
    
    if (!isImageElement) return null;
    
    return (
      <div className="space-y-4">
        <Separator />
        <h4 className="font-semibold text-sm flex items-center gap-2">
          <Image className="h-4 w-4" />
          إعدادات الصورة
        </h4>
        
        {/* Object Fit */}
        <div className="space-y-2">
          <Label className="text-xs">طريقة عرض الصورة (object-fit)</Label>
          <Select
            value={element.objectFit || 'contain'}
            onValueChange={(value) => updateElement(elementKey, { objectFit: value as any })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OBJECT_FIT_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Object Position */}
        <div className="space-y-2">
          <Label className="text-xs">موضع الصورة (object-position)</Label>
          <Select
            value={element.objectPosition || 'center'}
            onValueChange={(value) => updateElement(elementKey, { objectPosition: value })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OBJECT_POSITION_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Border Controls */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">سمك الحدود</Label>
            <Input
              value={element.borderWidth || '0px'}
              onChange={(e) => updateElement(elementKey, { borderWidth: e.target.value })}
              placeholder="مثال: 2px"
              className="h-9"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">لون الحدود</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={element.borderColor || '#000000'}
                onChange={(e) => updateElement(elementKey, { borderColor: e.target.value })}
                className="h-9 w-12 p-1"
              />
              <Input
                value={element.borderColor || '#000000'}
                onChange={(e) => updateElement(elementKey, { borderColor: e.target.value })}
                className="h-9 flex-1"
              />
            </div>
          </div>
        </div>

        {/* Border Radius */}
        <div className="space-y-2">
          <Label className="text-xs">استدارة الحواف</Label>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">أعلى يمين</Label>
              <Input
                value={element.borderRadiusTopRight || element.borderRadius || '0px'}
                onChange={(e) => updateElement(elementKey, { borderRadiusTopRight: e.target.value })}
                className="h-8 text-xs"
                placeholder="0px"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">أعلى يسار</Label>
              <Input
                value={element.borderRadiusTopLeft || element.borderRadius || '0px'}
                onChange={(e) => updateElement(elementKey, { borderRadiusTopLeft: e.target.value })}
                className="h-8 text-xs"
                placeholder="0px"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">أسفل يمين</Label>
              <Input
                value={element.borderRadiusBottomRight || element.borderRadius || '0px'}
                onChange={(e) => updateElement(elementKey, { borderRadiusBottomRight: e.target.value })}
                className="h-8 text-xs"
                placeholder="0px"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">أسفل يسار</Label>
              <Input
                value={element.borderRadiusBottomLeft || element.borderRadius || '0px'}
                onChange={(e) => updateElement(elementKey, { borderRadiusBottomLeft: e.target.value })}
                className="h-8 text-xs"
                placeholder="0px"
              />
            </div>
          </div>
        </div>

        {/* Rotation */}
        <div className="space-y-2">
          <Label className="text-xs">الدوران (بالدرجات)</Label>
          <Input
            value={element.rotation || '0'}
            onChange={(e) => updateElement(elementKey, { rotation: e.target.value })}
            placeholder="مثال: 45"
            className="h-9"
          />
        </div>
      </div>
    );
  };

  const renderTextControls = (elementKey: string) => {
    const element = getElementSettings(elementKey);
    const isTextElement = ['contractNumber', 'adType', 'billboardName', 'size', 'facesCount', 'locationInfo', 'landmarkInfo', 'installationDate', 'printType'].includes(elementKey);
    
    if (!isTextElement) return null;
    
    return (
      <div className="space-y-4">
        <Separator />
        <h4 className="font-semibold text-sm flex items-center gap-2">
          <Type className="h-4 w-4" />
          إعدادات النص
        </h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">حجم الخط</Label>
            <Input
              value={element.fontSize || '14px'}
              onChange={(e) => updateElement(elementKey, { fontSize: e.target.value })}
              placeholder="مثال: 16px"
              className="h-9"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">وزن الخط</Label>
            <Select
              value={element.fontWeight || '400'}
              onValueChange={(value) => updateElement(elementKey, { fontWeight: value })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="300">خفيف (300)</SelectItem>
                <SelectItem value="400">عادي (400)</SelectItem>
                <SelectItem value="500">متوسط (500)</SelectItem>
                <SelectItem value="600">شبه سميك (600)</SelectItem>
                <SelectItem value="700">سميك (700)</SelectItem>
                <SelectItem value="800">سميك جداً (800)</SelectItem>
                <SelectItem value="900">أسود (900)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">لون النص</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={element.color || '#000000'}
                onChange={(e) => updateElement(elementKey, { color: e.target.value })}
                className="h-9 w-12 p-1"
              />
              <Input
                value={element.color || '#000000'}
                onChange={(e) => updateElement(elementKey, { color: e.target.value })}
                className="h-9 flex-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">محاذاة النص</Label>
            <Select
              value={element.textAlign || 'right'}
              onValueChange={(value) => updateElement(elementKey, { textAlign: value })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="right">يمين</SelectItem>
                <SelectItem value="center">وسط</SelectItem>
                <SelectItem value="left">يسار</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">نوع الخط</Label>
          <Select
            value={element.fontFamily || settings.primary_font}
            onValueChange={(value) => updateElement(elementKey, { fontFamily: value })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Doran">Doran</SelectItem>
              <SelectItem value="Manrope">Manrope</SelectItem>
              <SelectItem value="Arial">Arial</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  };

  if (isLoadingProfiles) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container-fluid mx-auto p-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Settings className="h-6 w-6 text-primary" />
            إعدادات الطباعة السريعة
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            تعديل مواقع العناصر وإعدادات الصور لجميع حالات الطباعة
          </p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          {hasUnsavedChanges && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
              تغييرات غير محفوظة
            </span>
          )}
          <Button variant="outline" onClick={handleReset} disabled={isSaving}>
            <RotateCcw className="h-4 w-4 ml-2" />
            إعادة تعيين
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !hasUnsavedChanges}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 ml-2" />
            )}
            حفظ الإعدادات
          </Button>
        </div>
      </div>

      {/* Main Layout - Two Columns */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left Column - Settings */}
        <div className="space-y-4">
          {/* Profile Selector */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">البروفايل النشط</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <Select
                value={activeProfile?.id || ''}
                onValueChange={(id) => {
                  const profile = profiles.find(p => p.id === id);
                  if (profile) loadProfile(profile);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر بروفايل" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map(profile => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.profile_name}
                      {profile.is_default && ' (افتراضي)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Background Selector */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">خلفية الطباعة</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <BackgroundSelector
                value={settings.background_url}
                onChange={(url) => updateSetting('background_url', url)}
              />
            </CardContent>
          </Card>

          {/* Elements Editor */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">تعديل العناصر</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-3 w-full mb-4">
                  {Object.entries(ELEMENT_CATEGORIES).map(([key, category]) => (
                    <TabsTrigger key={key} value={key} className="flex items-center gap-2 text-xs">
                      <category.icon className="h-3 w-3" />
                      {category.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {Object.entries(ELEMENT_CATEGORIES).map(([key, category]) => (
                  <TabsContent key={key} value={key} className="mt-0">
                    <div className="grid grid-cols-1 gap-4">
                      {/* Elements List */}
                      <div>
                        <ScrollArea className="h-[200px] rounded-lg border p-2">
                          <div className="grid grid-cols-2 gap-1">
                            {category.elements.map(elementKey => {
                              const element = getElementSettings(elementKey);
                              return (
                                <button
                                  key={elementKey}
                                  onClick={() => setSelectedElement(elementKey)}
                                  className={`flex items-center justify-between p-2 rounded-lg transition-all text-right text-xs ${
                                    selectedElement === elementKey
                                      ? 'bg-primary/10 border-2 border-primary'
                                      : 'bg-muted/50 hover:bg-muted border-2 border-transparent'
                                  }`}
                                >
                                  <span className="font-medium truncate">
                                    {ELEMENT_LABELS[elementKey] || elementKey}
                                  </span>
                                  {element.visible ? (
                                    <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground">مخفي</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      </div>

                      {/* Element Settings */}
                      {selectedElement && (
                        <ScrollArea className="h-[350px] rounded-lg border p-4">
                          <div className="space-y-4">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                              <h3 className="font-bold text-sm">
                                {ELEMENT_LABELS[selectedElement] || selectedElement}
                              </h3>
                              <div className="flex items-center gap-2">
                                <Label className="text-xs">إظهار</Label>
                                <Switch
                                  checked={getElementSettings(selectedElement).visible}
                                  onCheckedChange={(checked) => updateElement(selectedElement, { visible: checked })}
                                />
                              </div>
                            </div>

                            <Separator />

                            {/* Position Controls */}
                            <div className="space-y-3">
                              <h4 className="font-semibold text-xs flex items-center gap-2">
                                <Move className="h-3 w-3" />
                                الموقع
                              </h4>
                              {renderPositionControls(selectedElement)}
                            </div>

                            {/* Size Controls */}
                            <div className="space-y-3">
                              <Separator />
                              <h4 className="font-semibold text-xs flex items-center gap-2">
                                <Maximize2 className="h-3 w-3" />
                                الأبعاد
                              </h4>
                              {renderSizeControls(selectedElement)}
                            </div>

                            {/* Text Controls (for text elements) */}
                            {renderTextControls(selectedElement)}

                            {/* Image Controls (for image elements) */}
                            {renderImageControls(selectedElement)}
                          </div>
                        </ScrollArea>
                      )}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Preview */}
        <div className="space-y-4">
          {/* Header with Profile and Scale */}
          <Card>
            <CardContent className="p-4 space-y-4">
              {/* Profile Selector */}
              <div className="flex items-center gap-4">
                <Label className="text-sm font-medium whitespace-nowrap">البروفايل:</Label>
                <Select
                  value={activeProfile?.id || ''}
                  onValueChange={(id) => {
                    const profile = profiles.find(p => p.id === id);
                    if (profile) loadProfile(profile);
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="اختر بروفايل" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.profile_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Scale Slider */}
              <div className="flex items-center gap-4">
                <ZoomOut className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 space-y-1">
                  <Slider
                    value={[previewScale]}
                    onValueChange={(v) => setPreviewScale(v[0])}
                    min={20}
                    max={100}
                    step={5}
                  />
                </div>
                <ZoomIn className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium w-12 text-left">{previewScale}%</span>
              </div>

              {/* Target Tabs */}
              <div className="flex gap-2 border-b pb-2">
                <Button
                  variant={previewTarget === 'team' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPreviewTarget('team')}
                  className="gap-2"
                >
                  <Users className="h-4 w-4" />
                  فريق
                </Button>
                <Button
                  variant={previewTarget === 'customer' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPreviewTarget('customer')}
                  className="gap-2"
                >
                  <User className="h-4 w-4" />
                  عميل
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Contract/Task Selection */}
          <Card>
            <CardHeader className="py-3 border-b">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                اختيار العقد للتجربة
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-right">
                    <Search className="h-4 w-4 ml-2" />
                    {selectedTask ? (
                      <span className="truncate">
                        عقد #{(selectedTask as any).contract_id} - {(selectedTask as any).customer_name || taskDetails?.customerName}
                      </span>
                    ) : (
                      'اختر عقد أو مهمة...'
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg" dir="rtl">
                  <DialogHeader>
                    <DialogTitle>اختيار عقد للتجربة</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {/* Toggle between tasks and contracts */}
                    <div className="flex gap-2 border-b pb-3">
                      <Button
                        variant={searchMode === 'tasks' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSearchMode('tasks')}
                      >
                        مهام التركيب
                      </Button>
                      <Button
                        variant={searchMode === 'contracts' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSearchMode('contracts')}
                      >
                        العقود
                      </Button>
                    </div>

                    <div className="relative">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="بحث بالعميل أو رقم العقد..."
                        value={taskSearchQuery}
                        onChange={(e) => setTaskSearchQuery(e.target.value)}
                        className="pr-10"
                      />
                    </div>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-2">
                        {searchMode === 'tasks' ? (
                          <>
                            {filteredTasks.map((task: any) => (
                              <button
                                key={task.id}
                                onClick={() => {
                                  setSelectedTaskId(task.id);
                                  setShowTaskDialog(false);
                                }}
                                className={`w-full text-right p-3 rounded-lg border transition-colors hover:bg-muted/50 ${
                                  selectedTaskId === task.id ? 'border-primary bg-primary/5' : 'border-border'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs bg-muted px-2 py-0.5 rounded">
                                    {task.status}
                                  </span>
                                  <span className="font-medium">عقد #{task.contract_id}</span>
                                </div>
                                <p className="text-sm mt-1">{task.customer_name || 'بدون عميل'}</p>
                                {task.team_name && (
                                  <p className="text-xs text-muted-foreground">{task.team_name}</p>
                                )}
                              </button>
                            ))}
                            {filteredTasks.length === 0 && (
                              <p className="text-center text-muted-foreground py-8">
                                لا توجد مهام تركيب
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            {filteredContracts.map((contract: any) => (
                              <button
                                key={contract.Contract_Number}
                                onClick={() => {
                                  setSelectedTaskId(`contract-${contract.Contract_Number}`);
                                  setShowTaskDialog(false);
                                }}
                                className={`w-full text-right p-3 rounded-lg border transition-colors hover:bg-muted/50 ${
                                  selectedTaskId === `contract-${contract.Contract_Number}` ? 'border-primary bg-primary/5' : 'border-border'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                    عقد
                                  </span>
                                  <span className="font-medium">عقد #{contract.Contract_Number}</span>
                                </div>
                                <p className="text-sm mt-1">{contract['Customer Name'] || 'بدون عميل'}</p>
                                <p className="text-xs text-muted-foreground">{contract['Ad Type'] || ''}</p>
                              </button>
                            ))}
                            {filteredContracts.length === 0 && (
                              <p className="text-center text-muted-foreground py-8">
                                لا توجد عقود
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Loading State */}
              {selectedTaskId && isLoadingTaskDetails && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="mr-2 text-sm text-muted-foreground">جاري تحميل اللوحات...</span>
                </div>
              )}

              {/* Billboards Preview */}
              {taskDetails?.billboards && taskDetails.billboards.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      اللوحات ({taskDetails.billboards.length})
                    </span>
                    <Button 
                      onClick={handlePrintPreview}
                      size="sm"
                      className="gap-2"
                    >
                      <Printer className="h-4 w-4" />
                      طباعة المعاينة
                    </Button>
                  </div>

                  <ScrollArea className="h-[300px]">
                    <div className="grid grid-cols-1 gap-3">
                      {taskDetails.billboards.map((billboard: any, index: number) => (
                        <div key={billboard.ID} className="border rounded-lg p-3 bg-background">
                          <div className="text-sm font-bold mb-2 truncate">
                            {billboard.Billboard_Name || `لوحة ${billboard.ID}`}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <div>المقاس: {billboard.Size || '-'}</div>
                            <div>الوجوه: {billboard.Faces_Count || 1}</div>
                            <div>المدينة: {billboard.City || '-'}</div>
                            <div>الحي: {billboard.District || '-'}</div>
                          </div>
                          {/* Images Preview */}
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {billboard.Image_URL && (
                              <img 
                                src={billboard.Image_URL} 
                                alt="صورة اللوحة" 
                                className="w-12 h-12 object-cover rounded border"
                              />
                            )}
                            {billboard.design_face_a && (
                              <img 
                                src={billboard.design_face_a} 
                                alt="تصميم A" 
                                className="w-12 h-12 object-cover rounded border border-blue-500"
                              />
                            )}
                            {billboard.design_face_b && (
                              <img 
                                src={billboard.design_face_b} 
                                alt="تصميم B" 
                                className="w-12 h-12 object-cover rounded border border-purple-500"
                              />
                            )}
                            {billboard.installed_image_face_a_url && (
                              <img 
                                src={billboard.installed_image_face_a_url} 
                                alt="صورة التركيب A" 
                                className="w-12 h-12 object-cover rounded border-2 border-green-500"
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* No billboards message */}
              {selectedTaskId && !isLoadingTaskDetails && (!taskDetails?.billboards || taskDetails.billboards.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  لا توجد لوحات مرتبطة بهذا العقد
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
