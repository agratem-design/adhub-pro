// @ts-nocheck
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CardHeader, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Printer, FileText, Layers, Users, FolderOpen, Check, Image as ImageIcon } from 'lucide-react';
import QRCode from 'qrcode';
import { Checkbox } from '@/components/ui/checkbox';

interface BillboardPrintSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId?: string;
  contractId?: number;
  mode?: 'installation' | 'removal';
  children?: React.ReactNode;
}

interface InstallationTask {
  id: string;
  contract_id: number;
  team_id?: string;
  status: string;
  created_at: string;
  customer_name?: string;
  ad_type?: string;
  team_name?: string;
}

// Print modes with their Arabic labels
const PRINT_MODES = {
  default: 'الافتراضي',
  with_design: 'مع تصميم مرفق',
  without_design: 'بدون تصميم',
  two_faces: 'وجهين (أمامي وخلفي)',
  two_faces_with_designs: 'وجهين مع التصاميم',
  single_face: 'وجه واحد (صورة تركيب وتصميم)',
  single_installation_with_designs: 'صورة تركيب واحدة + التصاميم تحتها',
};

export default function BillboardPrintSettingsDialog({ 
  open, 
  onOpenChange, 
  taskId, 
  contractId,
  mode = 'installation',
  children 
}: BillboardPrintSettingsDialogProps) {
  const queryClient = useQueryClient();
  
  const [currentMode, setCurrentMode] = useState<string>('default');
  const [selectedTask, setSelectedTask] = useState<InstallationTask | null>(null);
  const [selectedBillboardsForPrint, setSelectedBillboardsForPrint] = useState<number[]>([]);
  const [bulkPrintMode, setBulkPrintMode] = useState<'customer' | 'team' | 'both'>('team');
  const [hideBackground, setHideBackground] = useState(false);
  const [useSmartMode, setUseSmartMode] = useState(true);
  const [showDesignsInPrint, setShowDesignsInPrint] = useState(true);
  const [showCutoutsInPrint, setShowCutoutsInPrint] = useState(true);
  const [selectedTeamForPrint, setSelectedTeamForPrint] = useState<string>('all');
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');

  // Fetch print profiles
  const { data: profiles } = useQuery({
    queryKey: ['billboard-print-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billboard_print_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch settings for current mode
  const { data: settings } = useQuery({
    queryKey: ['billboard-print-settings', currentMode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billboard_print_settings')
        .select('*')
        .eq('setting_key', currentMode)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  // Fetch installation tasks for selection
  const { data: installationTasks } = useQuery({
    queryKey: ['installation-tasks-for-print-dialog'],
    queryFn: async () => {
      const { data: tasks, error } = await supabase
        .from('installation_tasks')
        .select('id, contract_id, team_id, status, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      if (!tasks) return [];

      const contractIds = [...new Set(tasks.map(t => t.contract_id).filter(Boolean))];
      const { data: contracts } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type"')
        .in('Contract_Number', contractIds);

      const teamIds = [...new Set(tasks.map(t => t.team_id).filter(Boolean))];
      const { data: teams } = await supabase
        .from('installation_teams')
        .select('id, team_name')
        .in('id', teamIds);

      return tasks.map(task => {
        const contract = contracts?.find(c => c.Contract_Number === task.contract_id);
        const team = teams?.find(t => t.id === task.team_id);
        return {
          ...task,
          customer_name: contract?.['Customer Name'] || '',
          ad_type: contract?.['Ad Type'] || '',
          team_name: team?.team_name || '',
        };
      });
    },
  });

  // Auto-load task from props
  useEffect(() => {
    if (open && taskId && installationTasks) {
      const task = installationTasks.find(t => t.id === taskId);
      if (task) {
        setSelectedTask(task);
      }
    } else if (open && contractId && installationTasks) {
      const task = installationTasks.find(t => t.contract_id === contractId);
      if (task) {
        setSelectedTask(task);
      }
    }
  }, [open, taskId, contractId, installationTasks]);

  // Fetch contract and billboards for selected task
  const { data: taskDetails, isLoading: loadingTaskDetails } = useQuery({
    queryKey: ['task-details-dialog', selectedTask?.id],
    enabled: !!selectedTask,
    queryFn: async () => {
      if (!selectedTask) return null;
      
      const { data: contract } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type", design_data, billboards_data')
        .eq('Contract_Number', selectedTask.contract_id)
        .maybeSingle();
      
      const { data: contractTasks } = await supabase
        .from('installation_tasks')
        .select('id, team_id, status')
        .eq('contract_id', selectedTask.contract_id);
      
      const teamIds = [...new Set((contractTasks || []).map(t => t.team_id).filter(Boolean))];
      const { data: contractTeams } = await supabase
        .from('installation_teams')
        .select('id, team_name')
        .in('id', teamIds);
      
      const teamsWithTasks = (contractTeams || []).map(team => {
        const teamTasks = (contractTasks || []).filter(t => t.team_id === team.id);
        return {
          ...team,
          taskIds: teamTasks.map(t => t.id)
        };
      });
      
      const allTaskIds = (contractTasks || []).map(t => t.id);
      const { data: allInstallationItems } = await supabase
        .from('installation_task_items')
        .select('billboard_id, design_face_a, design_face_b, task_id, installed_image_url, installed_image_face_a_url, installed_image_face_b_url')
        .in('task_id', allTaskIds);
      
      let installationItems = allInstallationItems || [];
      
      const billboardIdsFromTask = installationItems?.map(item => item.billboard_id).filter(Boolean) || [];
      const useContractBillboards = billboardIdsFromTask.length === 0;
      
      let billboards: any[] = [];
      
      if (useContractBillboards) {
        const { data: contractBillboards } = await supabase
          .from('billboards')
          .select('ID, Billboard_Name, Size, Level, Faces_Count, Municipality, District, Nearest_Landmark, Image_URL, GPS_Coordinates, GPS_Link, has_cutout, design_face_a, design_face_b')
          .eq('Contract_Number', selectedTask.contract_id);
        billboards = contractBillboards || [];
      } else {
        const { data: taskBillboards } = await supabase
          .from('billboards')
          .select('ID, Billboard_Name, Size, Level, Faces_Count, Municipality, District, Nearest_Landmark, Image_URL, GPS_Coordinates, GPS_Link, has_cutout, design_face_a, design_face_b')
          .in('ID', billboardIdsFromTask);
        billboards = taskBillboards || [];
      }

      // Build billboard team map
      const billboardTeamMap: Record<string, string> = {};
      installationItems.forEach((item: any) => {
        if (item.billboard_id && item.task_id) {
          const team = teamsWithTasks.find(t => t.taskIds?.includes(item.task_id));
          if (team) {
            billboardTeamMap[item.billboard_id.toString()] = team.team_name;
          }
        }
      });

      // Create installation designs map
      const installationDesigns: Record<string, any> = {};
      installationItems.forEach((item: any) => {
        if (item.billboard_id) {
          installationDesigns[item.billboard_id.toString()] = item;
        }
      });

      // Enrich billboards
      const enrichedBillboards = billboards.map(bb => {
        const installDesign = installationDesigns[bb.ID.toString()];
        return {
          ...bb,
          design_face_a: installDesign?.design_face_a || bb.design_face_a,
          design_face_b: installDesign?.design_face_b || bb.design_face_b,
          installed_image_url: installDesign?.installed_image_url || null,
          installed_image_face_a_url: installDesign?.installed_image_face_a_url || null,
          installed_image_face_b_url: installDesign?.installed_image_face_b_url || null,
          team_name: billboardTeamMap[bb.ID.toString()] || '',
        };
      });

      return {
        contract,
        billboards: enrichedBillboards,
        teamsWithTasks,
        installationItems,
      };
    },
  });

  // Auto-select all billboards when task details load
  useEffect(() => {
    if (taskDetails?.billboards) {
      setSelectedBillboardsForPrint(taskDetails.billboards.map(bb => bb.ID));
    }
  }, [taskDetails?.billboards]);

  const selectAllBillboards = () => {
    if (taskDetails?.billboards) {
      setSelectedBillboardsForPrint(taskDetails.billboards.map(bb => bb.ID));
    }
  };

  const deselectAllBillboards = () => {
    setSelectedBillboardsForPrint([]);
  };

  const toggleBillboardSelection = (id: number) => {
    setSelectedBillboardsForPrint(prev => 
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    );
  };

  // Load profile settings
  const loadProfile = (profile: any) => {
    if (profile && profile.settings_data) {
      const profileSettings = typeof profile.settings_data === 'string' 
        ? JSON.parse(profile.settings_data) 
        : profile.settings_data;
      
      if (profileSettings.currentMode) setCurrentMode(profileSettings.currentMode);
      if (profileSettings.hideBackground !== undefined) setHideBackground(profileSettings.hideBackground);
      if (profileSettings.useSmartMode !== undefined) setUseSmartMode(profileSettings.useSmartMode);
      if (profileSettings.showDesignsInPrint !== undefined) setShowDesignsInPrint(profileSettings.showDesignsInPrint);
      if (profileSettings.showCutoutsInPrint !== undefined) setShowCutoutsInPrint(profileSettings.showCutoutsInPrint);
      
      toast.success(`تم تحميل البروفايل: ${profile.profile_name}`);
    }
  };

  // Determine print mode for a billboard
  const determineBillboardPrintMode = (billboard: any): string => {
    if (!useSmartMode) return currentMode;
    
    const hasTwoFaces = billboard.installed_image_face_a_url && billboard.installed_image_face_b_url;
    const hasDesigns = billboard.design_face_a || billboard.design_face_b;
    const hasSingleInstallation = billboard.installed_image_url && !hasTwoFaces;
    
    if (hasTwoFaces && hasDesigns) return 'two_faces_with_designs';
    if (hasTwoFaces) return 'two_faces';
    if (hasSingleInstallation && hasDesigns) return 'single_installation_with_designs';
    if (hasDesigns) return 'with_design';
    return 'default';
  };

  // Generate HTML for a single billboard page
  const generateBillboardPageHTML = async (billboard: any, printMode: string, printTarget: 'customer' | 'team'): Promise<string> => {
    const contract = taskDetails?.contract;
    
    // Generate QR code
    let qrCodeUrl = '';
    try {
      const mapLink = billboard.GPS_Link || (billboard.GPS_Coordinates 
        ? `https://www.google.com/maps?q=${encodeURIComponent(billboard.GPS_Coordinates)}` 
        : `https://fares.sa/billboard/${billboard.ID}`);
      qrCodeUrl = await QRCode.toDataURL(mapLink, { width: 260, margin: 1, errorCorrectionLevel: 'M' });
    } catch (e) {
      console.error('QR generation error:', e);
    }

    const backgroundUrl = !hideBackground ? (settings?.background_url || '/ipg.svg') : '';
    const teamName = billboard.team_name || selectedTask?.team_name || 'فريق التركيب';

    return `
      <div class="print-page" style="width: 210mm; height: 297mm; position: relative; overflow: hidden; page-break-after: always;">
        ${backgroundUrl ? `<img src="${backgroundUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;" />` : ''}
        
        <div style="position: absolute; top: 40mm; right: 12mm; font-size: 14px; font-weight: 700;">
          عقد رقم: ${contract?.Contract_Number || '---'}
        </div>
        
        <div style="position: absolute; top: 40mm; right: 55mm; font-size: 14px; font-weight: 700;">
          نوع الإعلان: ${contract?.['Ad Type'] || selectedTask?.ad_type || '---'}
        </div>
        
        ${printTarget === 'team' ? `
          <div style="position: absolute; top: 170px; right: 83px; font-size: 18px; color: #d4af37; font-weight: 900;">
            ${teamName}
          </div>
        ` : `
          <div style="position: absolute; top: 170px; right: 83px; font-size: 18px; color: #0066cc; font-weight: 900;">
            نسخة العميل
          </div>
        `}
        
        <div style="position: absolute; top: 200px; left: 16%; font-size: 20px; font-weight: 700; width: 450px; text-align: center;">
          ${billboard.Billboard_Name || '---'}
        </div>
        
        <div style="position: absolute; top: 184px; left: 63%; font-size: 35px; font-weight: 900; width: 300px; text-align: center;">
          ${billboard.Size || '---'}
        </div>
        
        <div style="position: absolute; top: 220px; left: 63%; font-size: 14px; width: 300px; text-align: center;">
          ${billboard.Faces_Count || 2} وجه
        </div>
        
        <div style="position: absolute; top: 340px; left: 0; width: 650px; height: 350px;">
          <img src="${billboard.installed_image_url || billboard.installed_image_face_a_url || billboard.Image_URL || '/placeholder.svg'}" 
               style="width: 100%; height: 100%; object-fit: cover; border: 4px solid #000; border-radius: 0 0 10px 10px;" />
        </div>
        
        <div style="position: absolute; top: 229mm; left: 0; font-size: 21px; font-weight: 700; width: 150mm;">
          ${billboard.Municipality || ''} - ${billboard.District || ''}
        </div>
        
        <div style="position: absolute; top: 239mm; left: 0; font-size: 21px; font-weight: 500; width: 150mm;">
          ${billboard.Nearest_Landmark || ''}
        </div>
        
        ${qrCodeUrl ? `
          <div style="position: absolute; top: 970px; left: 245px; width: 100px; height: 100px;">
            <img src="${qrCodeUrl}" style="width: 100%; height: 100%;" />
          </div>
        ` : ''}
        
        ${(showDesignsInPrint && billboard.design_face_a) ? `
          <div style="position: absolute; top: 700px; left: 75px; display: flex; gap: 38px;">
            <img src="${billboard.design_face_a}" style="width: 200px; height: 200px; object-fit: contain; border: 2px solid #ccc;" />
            ${billboard.design_face_b ? `<img src="${billboard.design_face_b}" style="width: 200px; height: 200px; object-fit: contain; border: 2px solid #ccc;" />` : ''}
          </div>
        ` : ''}
        
        ${(showCutoutsInPrint && billboard.has_cutout && billboard.cutout_image_url) ? `
          <div style="position: absolute; top: 600px; left: 75px; width: 200px; height: 200px;">
            <img src="${billboard.cutout_image_url}" style="width: 100%; height: 100%; object-fit: contain; border: 2px solid #000;" />
          </div>
        ` : ''}
        
        <div style="position: absolute; top: 42.869mm; right: 116mm; font-size: 11px; font-weight: 400;">
          تاريخ التركيب: ${new Date().toLocaleDateString('en-GB')}
        </div>
      </div>
    `;
  };

  // Handle bulk print
  const handleBulkPrint = async () => {
    if (selectedBillboardsForPrint.length === 0) {
      toast.error('يرجى تحديد لوحات للطباعة');
      return;
    }

    const selectedBillboards = taskDetails?.billboards?.filter(bb => 
      selectedBillboardsForPrint.includes(bb.ID)
    ) || [];

    if (selectedBillboards.length === 0) {
      toast.error('لا توجد لوحات محددة');
      return;
    }

    let pagesHTML = '';
    
    for (const billboard of selectedBillboards) {
      const printMode = determineBillboardPrintMode(billboard);
      
      if (bulkPrintMode === 'both') {
        // Generate both customer and team versions
        pagesHTML += await generateBillboardPageHTML(billboard, printMode, 'customer');
        pagesHTML += await generateBillboardPageHTML(billboard, printMode, 'team');
      } else {
        pagesHTML += await generateBillboardPageHTML(billboard, printMode, bulkPrintMode);
      }
    }

    // Build print window title
    const printWindowTitle = `${mode === 'removal' ? 'إزالة' : 'تركيب'} - عقد #${taskDetails?.contract?.Contract_Number || '---'} - ${selectedTask?.customer_name || ''} - ${selectedTask?.ad_type || ''} - ${selectedBillboardsForPrint.length} لوحة${bulkPrintMode === 'customer' ? ' - نسخة العميل' : ''}`;

    const content = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>${printWindowTitle}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@300;400;500;600;700&display=swap');
          @page {
            size: A4 portrait;
            margin: 0;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Doran', Arial, sans-serif;
            direction: rtl;
          }
          .print-page {
            width: 210mm;
            height: 297mm;
            position: relative;
            overflow: hidden;
            page-break-after: always;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .print-page { page-break-after: always; }
          }
        </style>
      </head>
      <body>
        ${pagesHTML}
      </body>
      </html>
    `;

    const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
    showPrintPreview(content, printWindowTitle);
  };

  // Generate dynamic print title
  const getPrintTitle = () => {
    const parts: string[] = [];
    
    // تركيب أو إزالة
    parts.push(mode === 'removal' ? 'إزالة' : 'تركيب');
    
    // رقم العقد
    if (taskDetails?.contract?.Contract_Number) {
      parts.push(`عقد #${taskDetails.contract.Contract_Number}`);
    }
    
    // اسم الزبون
    if (selectedTask?.customer_name) {
      parts.push(selectedTask.customer_name);
    }
    
    // نوع الإعلان
    if (selectedTask?.ad_type) {
      parts.push(selectedTask.ad_type);
    }
    
    // عدد اللوحات
    if (taskDetails?.billboards?.length) {
      parts.push(`${selectedBillboardsForPrint.length}/${taskDetails.billboards.length} لوحة`);
    }
    
    return parts.join(' - ');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-lg font-bold">
              <div className="p-1.5 bg-primary/20 rounded-lg">
                <Printer className="h-5 w-5 text-primary" />
              </div>
              <span className="text-base">{getPrintTitle()}</span>
            </div>
            {selectedTask && (
              <div className="flex flex-wrap items-center gap-2 text-sm font-normal text-muted-foreground mr-9">
                {bulkPrintMode === 'team' && (
                  <span className="bg-primary/20 text-primary text-xs px-2 py-1 rounded-full">نسخة الفريق</span>
                )}
                {bulkPrintMode === 'customer' && (
                  <span className="bg-blue-500/20 text-blue-600 text-xs px-2 py-1 rounded-full">نسخة العميل</span>
                )}
                {bulkPrintMode === 'both' && (
                  <span className="bg-green-500/20 text-green-600 text-xs px-2 py-1 rounded-full">كلا النسختين</span>
                )}
              </div>
            )}
          </DialogTitle>
        </DialogHeader>
        
        {loadingTaskDetails ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !selectedTask ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <p className="text-lg text-muted-foreground">لم يتم تحديد مهمة</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Smart Mode Toggle */}
            <div className="p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold flex items-center gap-2">
                  <svg className="h-5 w-5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  <span className="text-green-700 dark:text-green-400">الوضع الذكي التلقائي</span>
                </Label>
                <Switch checked={useSmartMode} onCheckedChange={setUseSmartMode} />
              </div>
            </div>

            {/* Print Options */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Version Type */}
              <div className="p-4 bg-muted/50 rounded-xl border space-y-3">
                <Label className="text-sm font-bold flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  نوع النسخة
                </Label>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant={bulkPrintMode === 'customer' ? 'default' : 'outline'}
                    onClick={() => setBulkPrintMode('customer')}
                    className="flex-1"
                    size="sm"
                  >
                    <FileText className="h-4 w-4 ml-1" />
                    عميل
                  </Button>
                  <Button 
                    variant={bulkPrintMode === 'team' ? 'default' : 'outline'}
                    onClick={() => setBulkPrintMode('team')}
                    className="flex-1"
                    size="sm"
                  >
                    <Users className="h-4 w-4 ml-1" />
                    فريق
                  </Button>
                  <Button 
                    variant={bulkPrintMode === 'both' ? 'default' : 'outline'}
                    onClick={() => setBulkPrintMode('both')}
                    className="flex-1"
                    size="sm"
                  >
                    <Layers className="h-4 w-4 ml-1" />
                    كلاهما
                  </Button>
                </div>
              </div>

              {/* Design Options */}
              <div className="p-4 bg-muted/50 rounded-xl border space-y-3">
                <Label className="text-sm font-bold flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  خيارات المحتوى
                </Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="showDesigns" 
                      checked={showDesignsInPrint}
                      onCheckedChange={(checked) => setShowDesignsInPrint(!!checked)}
                    />
                    <Label htmlFor="showDesigns" className="text-xs cursor-pointer">إظهار التصاميم</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="showCutouts" 
                      checked={showCutoutsInPrint}
                      onCheckedChange={(checked) => setShowCutoutsInPrint(!!checked)}
                    />
                    <Label htmlFor="showCutouts" className="text-xs cursor-pointer">إظهار المجسمات</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="hideBackground" 
                      checked={hideBackground}
                      onCheckedChange={(checked) => setHideBackground(!!checked)}
                    />
                    <Label htmlFor="hideBackground" className="text-xs cursor-pointer">إخفاء الخلفية</Label>
                  </div>
                </div>
              </div>

              {/* Profile Selector */}
              <div className="p-4 bg-muted/50 rounded-xl border space-y-3">
                <Label className="text-sm font-bold flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  البروفايل
                </Label>
                {profiles && profiles.length > 0 ? (
                  <Select
                    value={selectedProfileId}
                    onValueChange={(profileId) => {
                      setSelectedProfileId(profileId);
                      const profile = profiles.find(p => p.id === profileId);
                      if (profile) loadProfile(profile);
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="اختر بروفايل للتطبيق" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map(profile => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.profile_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-xs text-muted-foreground">لا توجد بروفايلات محفوظة</p>
                )}
              </div>
            </div>

            {/* Selection Tools */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllBillboards}>
                  <Check className="h-4 w-4 ml-1" />
                  تحديد الكل
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAllBillboards}>
                  إلغاء التحديد
                </Button>
              </div>
              <span className="text-sm font-medium">
                المحدد: <span className="text-primary font-bold">{selectedBillboardsForPrint.length}</span> من {taskDetails?.billboards?.length || 0}
              </span>
            </div>

            {/* Billboards Grid */}
            <ScrollArea className="h-[300px] border rounded-xl p-3 bg-card">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {taskDetails?.billboards?.map(bb => {
                  const isSelected = selectedBillboardsForPrint.includes(bb.ID);
                  const mainImage = bb.installed_image_face_a_url || bb.installed_image_url || bb.Image_URL;
                  
                  return (
                    <div 
                      key={bb.ID}
                      onClick={() => toggleBillboardSelection(bb.ID)}
                      className={`relative cursor-pointer rounded-xl border-2 overflow-hidden transition-all ${
                        isSelected 
                          ? 'border-primary shadow-lg shadow-primary/20 scale-[1.02]' 
                          : 'border-border hover:border-primary/50 hover:shadow-md'
                      }`}
                    >
                      <div className="aspect-[4/3] bg-muted/30 relative">
                        {mainImage ? (
                          <img 
                            src={mainImage} 
                            alt={bb.Billboard_Name || `لوحة ${bb.ID}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                          </div>
                        )}
                        
                        {isSelected && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <div className="bg-primary text-primary-foreground rounded-full p-2">
                              <Check className="h-5 w-5" />
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="p-2 bg-background/80 backdrop-blur-sm">
                        <p className="font-medium text-xs truncate">{bb.Billboard_Name || `لوحة ${bb.ID}`}</p>
                        <p className="text-xs text-muted-foreground truncate">{bb.Size}</p>
                        {bb.team_name && (
                          <p className="text-xs text-primary truncate mt-0.5">{bb.team_name}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                إلغاء
              </Button>
              <Button 
                onClick={handleBulkPrint}
                disabled={selectedBillboardsForPrint.length === 0}
                className="flex-1"
              >
                <Printer className="h-4 w-4 ml-2" />
                طباعة {selectedBillboardsForPrint.length} لوحة
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
