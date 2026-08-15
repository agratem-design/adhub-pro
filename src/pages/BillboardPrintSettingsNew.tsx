import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Loader2, Settings, ZoomIn, ZoomOut, Eye, 
  Search, ChevronLeft, ChevronRight, FileText, Printer, CheckSquare
} from 'lucide-react';
import { toast } from 'sonner';

import { usePrintCustomization, PrintCustomizationSettings } from '@/hooks/usePrintCustomization';
import { PrintPreview } from '@/components/billboard-print/PrintPreview';
import { PrintCustomizationPanel } from '@/components/print-customization';
import { BackgroundSelector } from '@/components/billboard-print/BackgroundSelector';
import { supabase } from '@/integrations/supabase/client';

interface InstallationTask {
  id: string;
  contract_id: number | null;
  status: string;
  created_at: string;
  customer_name?: string;
  ad_type?: string;
  team_name?: string;
}

interface BillboardData {
  ID: number;
  Billboard_Name: string | null;
  Size: string | null;
  Faces_Count: number | null;
  Municipality: string | null;
  District: string | null;
  Nearest_Landmark: string | null;
  Image_URL: string | null;
  GPS_Coordinates: string | null;
  GPS_Link: string | null;
  has_cutout: boolean | null;
  design_face_a: string | null;
  design_face_b: string | null;
  cutout_image_url?: string | null;
  installed_image_url?: string | null;
  installed_image_face_a_url?: string | null;
  installed_image_face_b_url?: string | null;
  installation_date?: string | null;
  faces_to_install?: number | null;
}

const SAMPLE_BILLBOARD: BillboardData = {
  ID: 1,
  Billboard_Name: 'لوحة تجريبية - شارع الملك فهد',
  Size: '3x4',
  Faces_Count: 2,
  Municipality: 'أمانة جدة',
  District: 'حي الروضة',
  Nearest_Landmark: 'بجوار مركز الملك فهد',
  Image_URL: '/placeholder.svg',
  GPS_Coordinates: '21.5433,39.1728',
  GPS_Link: 'https://maps.google.com/?q=21.5433,39.1728',
  has_cutout: true,
  design_face_a: '/placeholder.svg',
  design_face_b: '/placeholder.svg',
  cutout_image_url: '/placeholder.svg',
  installed_image_url: '/placeholder.svg',
  installed_image_face_a_url: '/placeholder.svg',
  installed_image_face_b_url: '/placeholder.svg',
  installation_date: new Date().toISOString(),
};
(SAMPLE_BILLBOARD as any).maintenance_status = 'torn';

export default function BillboardPrintSettingsNew() {
  const [searchParams] = useSearchParams();
  const taskIdFromUrl = searchParams.get('task');
  const contractIdFromUrl = searchParams.get('contract');

  // ✅ استخدام usePrintCustomization بدلاً من useBillboardPrintSettings
  const { 
    settings, 
    loading: isLoadingSettings, 
    saving: isSaving, 
    updateSetting, 
    updateStatusOverride,
    getSettingsForStatus,
    saveSettings, 
    resetToDefaults 
  } = usePrintCustomization();

  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [previewScale, setPreviewScale] = useState(0.4);
  const [previewTarget, setPreviewTarget] = useState<'customer' | 'team' | 'installation'>('team');
  const [hideBackground, setHideBackground] = useState(false);
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState('');
  const [previewStatusMode, setPreviewStatusMode] = useState<'normal' | 'no-design' | 'one-design' | 'one-face' | 'with-cutout'>('normal');
  
  // Contract/Task selection states
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [selectedTask, setSelectedTask] = useState<InstallationTask | null>(null);
  const [selectedBillboardIndex, setSelectedBillboardIndex] = useState(0);
  const [selectedBillboardIds, setSelectedBillboardIds] = useState<number[]>([]);
  const [searchMode, setSearchMode] = useState<'tasks' | 'contracts'>('tasks');

  // جلب لوحات عشوائية لكل حالة محاكاة
  const { data: statusSampleBillboards } = useQuery({
    queryKey: ['status-sample-billboards'],
    queryFn: async () => {
      // جلب لوحات بدون تصميم
      const { data: noDesign } = await supabase
        .from('installation_task_items')
        .select('*, billboard:billboards(*)')
        .is('design_face_a', null)
        .limit(5);
      
      // جلب لوحات بتصميم واحد فقط
      const { data: oneDesign } = await supabase
        .from('installation_task_items')
        .select('*, billboard:billboards(*)')
        .not('design_face_a', 'is', null)
        .is('design_face_b', null)
        .limit(5);
      
      // جلب لوحات بوجه واحد
      const { data: oneFace } = await supabase
        .from('billboards')
        .select('*')
        .eq('Faces_Count', 1)
        .limit(5);
      
      // جلب لوحات بمجسم
      const { data: withCutout } = await supabase
        .from('billboards')
        .select('*')
        .eq('has_cutout', true)
        .limit(5);
      
      // جلب لوحات بتصميمين (عادي)
      const { data: normal } = await supabase
        .from('installation_task_items')
        .select('*, billboard:billboards(*)')
        .not('design_face_a', 'is', null)
        .not('design_face_b', 'is', null)
        .limit(5);
      
      const pickRandom = (arr: any[] | null) => arr && arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : null;
      
      return {
        'no-design': pickRandom(noDesign),
        'one-design': pickRandom(oneDesign),
        'one-face': pickRandom(oneFace),
        'with-cutout': pickRandom(withCutout),
        'normal': pickRandom(normal),
      };
    },
    staleTime: 1000 * 60 * 10,
  });

  // جلب العقود
  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts-for-print-new'],
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

  // جلب مهام التركيب
  const { data: installationTasks = [] } = useQuery({
    queryKey: ['installation-tasks-for-print-new'],
    queryFn: async () => {
      const { data: tasks, error } = await supabase
        .from('installation_tasks')
        .select('id, contract_id, team_id, status, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      if (!tasks) return [];

      const contractIds = [...new Set(tasks.map(t => t.contract_id).filter(Boolean))];
      const { data: contractsData } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type"')
        .in('Contract_Number', contractIds);

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
      }) as InstallationTask[];
    },
  });

  // جلب تفاصيل المهمة المختارة
  const { data: taskDetails, isLoading: isLoadingTaskDetails } = useQuery({
    queryKey: ['task-details-new', selectedTask?.id, selectedTask?.contract_id],
    queryFn: async () => {
      if (!selectedTask?.contract_id) return null;
      
      const { data: contract } = await supabase
        .from('Contract')
        .select('*')
        .eq('Contract_Number', selectedTask.contract_id)
        .single();

      if (!contract) return null;

      let billboardIds: number[] = [];
      const rawIds = contract.billboard_ids || '';
      try {
        const parsed = JSON.parse(rawIds);
        billboardIds = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        // Handle comma-separated format like "746" or "746,747"
        billboardIds = rawIds.split(',').map((s: string) => parseInt(s.trim(), 10)).filter((n: number) => !isNaN(n));
      }
      if (billboardIds.length === 0) return null;

      const { data: billboards } = await supabase
        .from('billboards')
        .select('*')
        .in('ID', billboardIds);

      let taskBillboards: any[] = [];
      const isRealTask = selectedTask.id && !selectedTask.id.startsWith('contract-');
      if (isRealTask) {
        const { data } = await supabase
          .from('installation_task_items')
          .select('*')
          .eq('task_id', selectedTask.id);
        taskBillboards = (data as any[]) || [];
      }

      const mergedBillboards = (billboards || []).map(bb => {
        const taskBb = taskBillboards.find((tb: any) => tb.billboard_id === bb.ID);
        return {
          ...bb,
          design_face_a: taskBb?.design_face_a || bb.design_face_a,
          design_face_b: taskBb?.design_face_b || bb.design_face_b,
          installed_image_face_a_url: taskBb?.installed_image_face_a_url,
          installed_image_face_b_url: taskBb?.installed_image_face_b_url,
          installation_date: taskBb?.installation_date,
          faces_to_install: taskBb?.faces_to_install,
        } as BillboardData;
      });

      return {
        contract,
        billboards: mergedBillboards,
        customerName: contract['Customer Name'] || '',
        adType: contract['Ad Type'] || '',
      };
    },
    enabled: !!selectedTask?.contract_id,
  });

  // اختيار تلقائي من URL أو مهمة عشوائية
  useEffect(() => {
    if (installationTasks.length === 0) return;
    
    if (taskIdFromUrl) {
      const task = installationTasks.find(t => t.id === taskIdFromUrl);
      if (task) { setSelectedTask(task); setShowTaskDialog(false); }
    } else if (contractIdFromUrl) {
      const task = installationTasks.find(t => t.contract_id === parseInt(contractIdFromUrl));
      if (task) { setSelectedTask(task); setShowTaskDialog(false); }
    } else if (!selectedTask) {
      // اختيار مهمة عشوائية تلقائياً للمعاينة
      const tasksWithContract = installationTasks.filter(t => t.contract_id);
      if (tasksWithContract.length > 0) {
        const randomTask = tasksWithContract[Math.floor(Math.random() * tasksWithContract.length)];
        setSelectedTask(randomTask);
      }
    }
  }, [taskIdFromUrl, contractIdFromUrl, installationTasks]);

  useEffect(() => {
    if (taskDetails?.billboards) {
      setSelectedBillboardIds(taskDetails.billboards.map(b => b.ID));
      setSelectedBillboardIndex(0);
    }
  }, [taskDetails]);

  const filteredTasks = installationTasks.filter(task => {
    if (!taskSearchQuery) return true;
    const search = taskSearchQuery.toLowerCase();
    return task.customer_name?.toLowerCase().includes(search) || task.contract_id?.toString().includes(search) || task.team_name?.toLowerCase().includes(search);
  });

  const filteredContracts = contracts.filter(contract => {
    if (!taskSearchQuery) return true;
    const search = taskSearchQuery.toLowerCase();
    return contract['Customer Name']?.toLowerCase().includes(search) || contract.Contract_Number?.toString().includes(search);
  });

  const baseBillboard = taskDetails?.billboards?.[selectedBillboardIndex] || SAMPLE_BILLBOARD;
  
  // محاكاة الحالة: جلب لوحة حقيقية من قاعدة البيانات تطابق الحالة المختارة
  const currentBillboard = (() => {
    if (previewStatusMode === 'normal') return baseBillboard;
    
    const sample = statusSampleBillboards?.[previewStatusMode];
    if (!sample) {
      // fallback إذا لم توجد بيانات حقيقية
      const bb = { ...baseBillboard } as any;
      switch (previewStatusMode) {
        case 'no-design': bb.design_face_a = null; bb.design_face_b = null; return bb;
        case 'one-design': bb.design_face_b = null; return bb;
        case 'one-face': bb.Faces_Count = 1; bb.design_face_b = null; bb.installed_image_face_b_url = null; return bb;
        case 'with-cutout': bb.has_cutout = true; bb.cutout_image_url = bb.cutout_image_url || '/placeholder.svg'; return bb;
        default: return bb;
      }
    }
    
    // بناء بيانات اللوحة من البيانات الحقيقية
    if (previewStatusMode === 'one-face' || previewStatusMode === 'with-cutout') {
      // هذه من جدول billboards مباشرة
      return {
        ...baseBillboard,
        ...sample,
        Billboard_Name: sample.Billboard_Name || baseBillboard.Billboard_Name,
        Image_URL: sample.Image_URL || baseBillboard.Image_URL,
      } as BillboardData;
    } else {
      // هذه من installation_task_items مع billboard مضمنة
      const bb = sample.billboard as any;
      if (!bb) return baseBillboard;
      return {
        ...baseBillboard,
        ...bb,
        design_face_a: sample.design_face_a || bb.design_face_a,
        design_face_b: sample.design_face_b || bb.design_face_b,
        installed_image_face_a_url: sample.installed_image_face_a_url,
        installed_image_face_b_url: sample.installed_image_face_b_url,
        installation_date: sample.installation_date,
        faces_to_install: sample.faces_to_install,
      } as BillboardData;
    }
  })();
  const totalBillboards = taskDetails?.billboards?.length || 1;

  const toggleBillboardSelection = (id: number) => {
    setSelectedBillboardIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAllBillboards = () => {
    if (taskDetails?.billboards) setSelectedBillboardIds(taskDetails.billboards.map(b => b.ID));
  };

  const deselectAllBillboards = () => { setSelectedBillboardIds([]); };

  const handleSave = async () => {
    await saveSettings(settings);
  };

  if (isLoadingSettings) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">جاري تحميل الإعدادات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold">إعدادات طباعة الكل</h1>
                <p className="text-xs text-muted-foreground">
                  تحكم بمواقع العناصر والخطوط والألوان - مطابق للطباعة الفعلية
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewScale(Math.max(0.2, previewScale - 0.1))}>
                  <ZoomOut className="h-3 w-3" />
                </Button>
                <span className="text-xs w-12 text-center">{Math.round(previewScale * 100)}%</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewScale(Math.min(1, previewScale + 0.1))}>
                  <ZoomIn className="h-3 w-3" />
                </Button>
              </div>

              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                <Button variant={previewTarget === 'team' ? 'default' : 'ghost'} size="sm" className="h-7 text-xs" onClick={() => setPreviewTarget('team')}>
                  فريق
                </Button>
                <Button variant={previewTarget === 'customer' ? 'default' : 'ghost'} size="sm" className="h-7 text-xs" onClick={() => setPreviewTarget('customer')}>
                  عميل
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Sidebar - الإعدادات */}
          <div className="lg:col-span-1 space-y-4">
            {/* اختيار العقد/المهمة */}
            <Card>
              <CardHeader className="p-3 border-b">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  اختيار العقد للتجربة
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-right">
                      <Search className="h-4 w-4 ml-2" />
                      {selectedTask ? (
                        <span className="truncate">عقد #{selectedTask.contract_id} - {selectedTask.customer_name}</span>
                      ) : 'اختر عقد أو مهمة...'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg" dir="rtl">
                    <DialogHeader>
                      <DialogTitle>اختيار عقد للتجربة</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="flex gap-2 border-b pb-3">
                        <Button variant={searchMode === 'tasks' ? 'default' : 'outline'} size="sm" onClick={() => setSearchMode('tasks')}>مهام التركيب</Button>
                        <Button variant={searchMode === 'contracts' ? 'default' : 'outline'} size="sm" onClick={() => setSearchMode('contracts')}>العقود</Button>
                      </div>
                      <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="بحث بالعميل أو رقم العقد..." value={taskSearchQuery} onChange={(e) => setTaskSearchQuery(e.target.value)} className="pr-10" />
                      </div>
                      <ScrollArea className="h-[300px]">
                        <div className="space-y-2">
                          {searchMode === 'tasks' ? (
                            filteredTasks.length > 0 ? filteredTasks.map((task) => (
                              <button key={task.id} onClick={() => { setSelectedTask(task); setShowTaskDialog(false); setSelectedBillboardIndex(0); }}
                                className={`w-full text-right p-3 rounded-lg border transition-colors hover:bg-muted/50 ${selectedTask?.id === task.id ? 'border-primary bg-primary/5' : 'border-border'}`}>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs bg-muted px-2 py-0.5 rounded">{task.status}</span>
                                  <span className="font-medium">عقد #{task.contract_id}</span>
                                </div>
                                <p className="text-sm mt-1">{task.customer_name || 'بدون عميل'}</p>
                                {task.team_name && <p className="text-xs text-muted-foreground">{task.team_name}</p>}
                              </button>
                            )) : <p className="text-center text-muted-foreground py-8">لا توجد مهام تركيب</p>
                          ) : (
                            filteredContracts.length > 0 ? filteredContracts.map((contract) => (
                              <button key={contract.Contract_Number} onClick={() => {
                                setSelectedTask({ id: `contract-${contract.Contract_Number}`, contract_id: contract.Contract_Number, status: 'contract', created_at: contract['Contract Date'] || new Date().toISOString(), customer_name: contract['Customer Name'] || '', ad_type: contract['Ad Type'] || '', team_name: '' });
                                setShowTaskDialog(false); setSelectedBillboardIndex(0);
                              }}
                                className={`w-full text-right p-3 rounded-lg border transition-colors hover:bg-muted/50 ${selectedTask?.contract_id === contract.Contract_Number ? 'border-primary bg-primary/5' : 'border-border'}`}>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">عقد</span>
                                  <span className="font-medium">عقد #{contract.Contract_Number}</span>
                                </div>
                                <p className="text-sm mt-1">{contract['Customer Name'] || 'بدون عميل'}</p>
                              </button>
                            )) : <p className="text-center text-muted-foreground py-8">لا توجد عقود</p>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </DialogContent>
                </Dialog>

                {selectedTask && isLoadingTaskDetails && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="mr-2 text-sm text-muted-foreground">جاري تحميل اللوحات...</span>
                  </div>
                )}

                {taskDetails?.billboards && taskDetails.billboards.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSelectedBillboardIndex(Math.max(0, selectedBillboardIndex - 1))} disabled={selectedBillboardIndex === 0}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">لوحة {selectedBillboardIndex + 1} من {totalBillboards}</span>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSelectedBillboardIndex(Math.min(totalBillboards - 1, selectedBillboardIndex + 1))} disabled={selectedBillboardIndex === totalBillboards - 1}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAllBillboards}>
                          <CheckSquare className="h-3 w-3 ml-1" />الكل
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={deselectAllBillboards}>إلغاء</Button>
                        <span className="text-xs text-muted-foreground">({selectedBillboardIds.length} محدد)</span>
                      </div>
                    </div>

                    <ScrollArea className="h-[120px] border rounded-lg">
                      <div className="p-2 space-y-1">
                        {taskDetails.billboards.map((bb, idx) => (
                          <div key={bb.ID} className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted/50 ${selectedBillboardIndex === idx ? 'bg-primary/10' : ''}`}
                            onClick={() => setSelectedBillboardIndex(idx)}>
                            <Checkbox checked={selectedBillboardIds.includes(bb.ID)} onCheckedChange={() => toggleBillboardSelection(bb.ID)} onClick={(e) => e.stopPropagation()} />
                            <span className="text-xs truncate flex-1">{bb.Billboard_Name || `لوحة ${bb.ID}`}</span>
                            <span className="text-xs text-muted-foreground">{bb.Size}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* خلفية مخصصة */}
            <Card>
              <CardHeader className="p-3 border-b">
                <CardTitle className="text-sm font-medium">الخلفية</CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <BackgroundSelector
                  value={customBackgroundUrl || settings.preview_background || '/ipg.svg'}
                  onChange={setCustomBackgroundUrl}
                  compact
                />
              </CardContent>
            </Card>

 {/* لوحة التحكم الموحدة - نفس الإعدادات المستخدمة في الطباعة الفعلية */}
            <PrintCustomizationPanel
              settings={getSettingsForStatus(previewStatusMode)}
              onSettingChange={(key, value) => {
                const overridableKeys = ['main_image_top', 'main_image_left', 'main_image_width', 'main_image_height', 'installed_images_top', 'installed_images_left', 'installed_images_width', 'installed_images_gap', 'installed_image_height', 'designs_top', 'designs_left', 'designs_width', 'designs_gap', 'design_image_height', 'status_badges_top', 'status_badges_left', 'status_badges_font_size'];
                if (previewStatusMode !== 'normal' && overridableKeys.includes(key)) {
                  updateStatusOverride(previewStatusMode, key as any, value);
                } else {
                  updateSetting(key, value);
                }
              }}
              onSave={handleSave}
              onReset={resetToDefaults}
              saving={isSaving}
              previewStatusMode={previewStatusMode}
              onPreviewStatusModeChange={setPreviewStatusMode}
            />
          </div>

          {/* Preview Area */}
          <div className="lg:col-span-2">
            <Card className="sticky top-20">
              <CardHeader className="p-3 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Eye className="h-4 w-4 text-primary" />
                    معاينة الطباعة
                    {selectedTask && (
                      <span className="text-xs font-normal text-muted-foreground">- عقد #{selectedTask.contract_id}</span>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">إخفاء الخلفية</Label>
                    <input type="checkbox" checked={hideBackground} onChange={(e) => setHideBackground(e.target.checked)} className="h-4 w-4" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <PrintPreview
                  settings={getSettingsForStatus(previewStatusMode)}
                  billboard={currentBillboard}
                  contractNumber={selectedTask?.contract_id || 12345}
                  customerName={taskDetails?.customerName || 'شركة تجريبية'}
                  adType={taskDetails?.adType || 'عقد إعلان'}
                  previewTarget={previewTarget}
                  scale={previewScale}
                  selectedElement={selectedElement}
                  onElementClick={setSelectedElement}
                  hideBackground={hideBackground}
                  backgroundUrl={customBackgroundUrl || '/ipg.svg'}
                  teamName={selectedTask?.team_name}
                />

                <div className="mt-4 flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">التكبير:</span>
                  <Slider
                    value={[previewScale * 100]}
                    onValueChange={([val]) => setPreviewScale(val / 100)}
                    min={20} max={100} step={5}
                    className="flex-1"
                  />
                  <span className="text-xs w-12 text-left">{Math.round(previewScale * 100)}%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}