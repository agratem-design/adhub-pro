import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { UnitSliderField } from '@/components/print/UnitSliderField';
import { toast } from 'sonner';
import { Save, Loader2, RotateCcw, Eye, Upload, Settings, Move, Type, Image, Image as ImageIcon, Printer, FileText, Search, Layers, ImageOff, LayoutGrid, Square, Users, Wrench, QrCode, FolderOpen, Plus, Trash2, Check, Copy, Edit } from 'lucide-react';
import QRCode from 'qrcode';
import { Checkbox } from '@/components/ui/checkbox';
import { normalizeGoogleImageUrl } from '@/utils/imageUtils';
import { formatFacesCountArabic } from '@/lib/utils';

interface ElementSettings {
  visible: boolean;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  fontSize?: string;
  fontWeight?: string;
  fontFamily?: string;
  color?: string;
  width?: string;
  height?: string;
  minWidth?: string;
  textAlign?: string;
  borderWidth?: string;
  borderColor?: string;
  borderRadius?: string;
  borderRadiusTopLeft?: string;
  borderRadiusTopRight?: string;
  borderRadiusBottomLeft?: string;
  borderRadiusBottomRight?: string;
  gap?: string;
  rotation?: string;
  label?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  objectPosition?: string;
}

// أنواع الحالات التي يمكن تخصيص العناصر لها
type StatusOverrideKey = 'no-design' | 'one-design' | 'one-install';

const STATUS_OVERRIDE_LABELS: Record<StatusOverrideKey, { label: string; icon: string; color: string }> = {
 'no-design': { label: 'بدون تصميم', icon: '', color: '#ef4444' },
  'one-design': { label: 'تصميم واحد', icon: '◐', color: '#f59e0b' },
  'one-install': { label: 'تركيب وجه واحد', icon: '①', color: '#3b82f6' },
};

interface PrintSettings {
  id: string;
  setting_key: string;
  background_url: string;
  background_width: string;
  background_height: string;
  elements: Record<string, ElementSettings>;
  statusOverrides?: Partial<Record<StatusOverrideKey, Record<string, Partial<ElementSettings>>>>;
  primary_font: string;
  secondary_font: string;
  custom_css: string | null;
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
  contract?: {
    Contract_Number: number;
    'Customer Name': string;
    'Ad Type': string;
  };
  billboards?: Array<{
    ID: number;
    Billboard_Name: string;
    Size: string;
    Faces_Count: number;
    Municipality: string;
    District: string;
    Nearest_Landmark: string;
    Image_URL: string;
    GPS_Coordinates: string | null;
    GPS_Link: string | null;
    has_cutout: boolean;
    design_face_a: string | null;
    design_face_b: string | null;
    cutout_image_url?: string | null;
    // صور التركيب (قد تكون صورة واحدة أو وجهين)
    installed_image_url?: string | null;
    installed_image_face_a_url?: string | null;
    installed_image_face_b_url?: string | null;
  }>;
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

const DEFAULT_ELEMENTS: Record<string, ElementSettings> = {
  contractNumber: { visible: true, top: '40mm', right: '12mm', fontSize: '14px', fontWeight: '700', color: '#000' },
  adType: { visible: true, top: '40mm', right: '35mm', fontSize: '14px', fontWeight: '700', color: '#000', label: 'نوع الإعلان:' },
  billboardName: { visible: true, top: '200px', left: '16%', fontSize: '20px', fontWeight: '700', color: '#111', width: '450px', textAlign: 'center' },
  size: { visible: true, top: '184px', left: '63%', fontSize: '35px', fontWeight: '900', color: '#000', width: '300px', textAlign: 'center' },
  facesCount: { visible: true, top: '220px', left: '63%', fontSize: '14px', color: '#000', width: '300px', textAlign: 'center' },
  image: { visible: true, top: '340px', left: '0', width: '650px', height: '350px', borderWidth: '4px', borderColor: '#000', borderRadius: '0 0 10px 10px', rotation: '0', objectFit: 'contain', objectPosition: 'center' },
  locationInfo: { visible: true, top: '229mm', left: '0', fontSize: '21px', fontWeight: '700', width: '150mm', color: '#000' },
  landmarkInfo: { visible: true, top: '239mm', left: '0', fontSize: '21px', fontWeight: '500', width: '150mm', color: '#000' },
  qrCode: { visible: true, top: '970px', left: '245px', width: '100px', height: '100px', rotation: '0' },
  designs: { visible: true, top: '700px', left: '75px', width: '640px', height: '200px', gap: '38px', rotation: '0', objectFit: 'contain', objectPosition: 'center' },
  installationDate: { visible: true, top: '42.869mm', right: '116mm', fontSize: '11px', fontWeight: '400', color: '#000' },
  printType: { visible: true, top: '170px', right: '83px', fontSize: '18px', color: '#d4af37', fontWeight: '900' },
  cutoutImage: { visible: true, top: '600px', left: '75px', width: '200px', height: '200px', borderWidth: '2px', borderColor: '#000', rotation: '0', objectFit: 'contain', objectPosition: 'center' },
  faceAImage: { visible: true, top: '700px', left: '75px', width: '260px', height: '159px', borderWidth: '3px', borderColor: '#ccc', rotation: '0', objectFit: 'contain', objectPosition: 'center' },
  faceBImage: { visible: true, top: '700px', left: '380px', width: '260px', height: '159px', borderWidth: '3px', borderColor: '#ccc', rotation: '0', objectFit: 'contain', objectPosition: 'center' },
  // صورة تركيب واحدة (للوحات ذات الوجه الواحد)
  singleInstallationImage: { visible: true, top: '340px', left: '50px', width: '600px', height: '280px', borderWidth: '3px', borderColor: '#000', borderRadius: '8px', rotation: '0', objectFit: 'contain', objectPosition: 'center' },
  // صور تركيب مربوطة (للوجهين)
  linkedInstallationImages: { visible: true, top: '700px', left: '50px', width: '680px', height: '200px', gap: '16px', borderWidth: '3px', borderColor: '#ccc', borderRadius: '8px', rotation: '0', objectFit: 'contain', objectPosition: 'center' },
  // إعدادات مشتركة للوجهين (لربط الحجم والموقع)
  twoFacesContainer: { visible: true, top: '700px', left: '75px', width: '640px', height: '200px', gap: '20px', rotation: '0', objectFit: 'contain', objectPosition: 'center' },
  // شارات الحالة
  statusBadges: { visible: true, top: '260px', left: '16%', fontSize: '11px', fontWeight: '600', color: '#fff', width: '450px', textAlign: 'center' },
};

const ELEMENT_LABELS: Record<string, string> = {
  contractNumber: 'رقم العقد',
  adType: 'نوع الإعلان',
  billboardName: 'اسم اللوحة',
  size: 'المقاس',
  facesCount: 'عدد الأوجه',
  image: 'صورة اللوحة',
  locationInfo: 'البلدية والمنطقة',
  landmarkInfo: 'أقرب معلم',
  qrCode: 'كود QR',
  designs: 'التصاميم',
  installationDate: 'تاريخ التركيب',
  printType: 'نوع الطباعة (فريق التركيب)',
  cutoutImage: 'صورة المجسم',
  singleInstallationImage: 'صورة التركيب (واحدة)',
  linkedInstallationImages: 'صور التركيب (وجهين مربوطين)',
  faceAImage: 'صورة الوجه الأمامي',
  faceBImage: 'صورة الوجه الخلفي',
  twoFacesContainer: 'حاوية الوجهين (مع التصاميم)',
  statusBadges: 'شارات الحالة',
};

export default function BillboardPrintSettings() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const taskIdFromUrl = searchParams.get('task');
  const contractIdFromUrl = searchParams.get('contract');
  const modeFromUrl = searchParams.get('mode'); // 'removal' أو 'installation'
  const sourceFromUrl = searchParams.get('source'); // 'offer' للعروض
  
  const [settings, setSettings] = useState<PrintSettings | null>(null);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [previewScale, setPreviewScale] = useState(0.4);
  const [currentMode, setCurrentMode] = useState<string>('default');
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [selectedTask, setSelectedTask] = useState<InstallationTask | null>(null);
  const [selectedBillboardIndex, setSelectedBillboardIndex] = useState(0);
  const [previewTarget, setPreviewTarget] = useState<'customer' | 'team'>('team'); // customer or installation team
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const previewRef = useRef<HTMLDivElement>(null);
  
  // Profile states
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showSaveProfileDialog, setShowSaveProfileDialog] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDescription, setNewProfileDescription] = useState('');
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingProfileName, setEditingProfileName] = useState('');
  const [editingProfileDescription, setEditingProfileDescription] = useState('');
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [activeProfileName, setActiveProfileName] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Bulk print states
  const [showBulkPrintDialog, setShowBulkPrintDialog] = useState(false);
  const [bulkPrintMode, setBulkPrintMode] = useState<'customer' | 'team' | 'both'>('team');
  const [selectedTeamForPrint, setSelectedTeamForPrint] = useState<string>('all');
  const [selectedBillboardsForPrint, setSelectedBillboardsForPrint] = useState<number[]>([]);
  const [hideBackground, setHideBackground] = useState(false);
  const [useSmartMode, setUseSmartMode] = useState(true); // وضع الطباعة الذكي
  const [showDesignsInPrint, setShowDesignsInPrint] = useState(true);
  const [showCutoutsInPrint, setShowCutoutsInPrint] = useState(true);
  const [showInstallationImagesInPrint, setShowInstallationImagesInPrint] = useState(true);
  const [showStatusBadgesInPrint, setShowStatusBadgesInPrint] = useState(true);
  const [showBadgeNoDesign, setShowBadgeNoDesign] = useState(true);
  const [showBadgeOneDesign, setShowBadgeOneDesign] = useState(true);
  const [showBadgeOneInstall, setShowBadgeOneInstall] = useState(true);
  const [previewStatusMode, setPreviewStatusMode] = useState<'none' | 'no-design' | 'one-design' | 'one-install' | 'all-statuses'>('none');
  
  // Fetch settings for current mode (elements only)
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['billboard-print-settings', currentMode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billboard_print_settings')
        .select('*')
        .eq('setting_key', currentMode)
        .maybeSingle();
      
      if (error) {
        // If mode doesn't exist, create it from default
        if (error.code === 'PGRST116') {
          const { data: defaultData } = await supabase
            .from('billboard_print_settings')
            .select('*')
            .eq('setting_key', 'default')
            .maybeSingle();
          
          if (defaultData) {
            const { data: newData } = await supabase
              .from('billboard_print_settings')
              .insert({
                setting_key: currentMode,
                background_url: defaultData.background_url,
                background_width: defaultData.background_width,
                background_height: defaultData.background_height,
                elements: defaultData.elements,
                primary_font: defaultData.primary_font,
                secondary_font: defaultData.secondary_font,
              })
              .select()
              .maybeSingle();
            return newData;
          }
        }
        throw error;
      }
      return data;
    },
  });

  // Fetch global settings (background and fonts) - always from 'default' or 'global' record
  const { data: globalSettings, refetch: refetchGlobal } = useQuery({
    queryKey: ['billboard-print-settings-global'],
    queryFn: async () => {
      // Try to get global settings first, fallback to default
      let { data, error } = await supabase
        .from('billboard_print_settings')
        .select('background_url, background_width, background_height, primary_font, secondary_font')
        .eq('setting_key', 'global')
        .maybeSingle();
      
      if (error || !data) {
        // Fallback to default
        const { data: defaultData } = await supabase
          .from('billboard_print_settings')
          .select('background_url, background_width, background_height, primary_font, secondary_font')
          .eq('setting_key', 'default')
          .maybeSingle();
        return defaultData;
      }
      return data;
    },
  });

  // Fetch print profiles
  const { data: profiles } = useQuery({
    queryKey: ['billboard-print-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billboard_print_profiles')
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // تحميل البروفايل الافتراضي عند فتح الصفحة (بما في ذلك عند القدوم من العروض أو العقود)
  useEffect(() => {
    if (profiles && profiles.length > 0 && !activeProfileId) {
      const defaultProfile = profiles.find(p => p.is_default);
      if (defaultProfile) {
        loadProfileData(defaultProfile);
      }
    }
  }, [profiles]);

  // دالة تحميل بيانات البروفايل (منفصلة للاستخدام في useEffect)
  const loadProfileData = (profile: any) => {
    const data = profile.settings_data as any;
    if (data?.settings) {
      setSettings(prev => ({
        ...prev!,
        background_url: data.settings.background_url,
        background_width: data.settings.background_width,
        background_height: data.settings.background_height,
        elements: data.settings.elements || DEFAULT_ELEMENTS,
        primary_font: data.settings.primary_font,
        secondary_font: data.settings.secondary_font,
        custom_css: data.settings.custom_css,
      }));
      if (data.currentMode) {
        setCurrentMode(data.currentMode);
      }
      setActiveProfileId(profile.id);
      setActiveProfileName(profile.profile_name);
      setHasUnsavedChanges(false);
    }
  };

  // Fetch installation teams
  const { data: installationTeams } = useQuery({
    queryKey: ['installation-teams-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('installation_teams')
        .select('id, team_name')
        .order('team_name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch installation tasks for selection with contract details
  const { data: installationTasks } = useQuery({
    queryKey: ['installation-tasks-for-print'],
    queryFn: async () => {
      const { data: tasks, error } = await supabase
        .from('installation_tasks')
        .select('id, contract_id, team_id, status, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      if (!tasks) return [];

      // Fetch contract details for each task
      const contractIds = [...new Set(tasks.map(t => t.contract_id).filter(Boolean))];
      const { data: contracts } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type"')
        .in('Contract_Number', contractIds);

      // Fetch team names
      const teamIds = [...new Set(tasks.map(t => t.team_id).filter(Boolean))];
      const { data: teams } = await supabase
        .from('installation_teams')
        .select('id, team_name')
        .in('id', teamIds);

      // Merge contract and team data with tasks
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

  // تحميل المهمة من URL تلقائياً
  useEffect(() => {
    if (taskIdFromUrl && installationTasks) {
      const task = installationTasks.find(t => t.id === taskIdFromUrl);
      if (task) {
        setSelectedTask(task);
        setShowBulkPrintDialog(true);
        toast.info(`تم تحميل مهمة العقد #${task.contract_id}`);
      }
    }
  }, [taskIdFromUrl, installationTasks]);
  
  // تحميل العقد من URL تلقائياً
  useEffect(() => {
    if (contractIdFromUrl && installationTasks) {
      const contractNum = parseInt(contractIdFromUrl);
      const task = installationTasks.find(t => t.contract_id === contractNum);
      if (task) {
        setSelectedTask(task);
        setShowBulkPrintDialog(true);
        toast.info(`تم تحميل مهمة العقد #${contractNum}`);
      }
    }
  }, [contractIdFromUrl, installationTasks]);

  // State for offer data
  const [offerData, setOfferData] = useState<{
    billboardIds: number[];
    offerNumber: number;
    customerName: string;
    adType: string;
    startDate: string;
    billboardsData: any[];
  } | null>(null);

  // تحميل بيانات العرض من sessionStorage
  useEffect(() => {
    if (sourceFromUrl === 'offer') {
      try {
        const storedData = sessionStorage.getItem('offerPrintData');
        if (storedData) {
          const parsed = JSON.parse(storedData);
          setOfferData(parsed);
          
          // إنشاء مهمة وهمية للعرض
          const fakeTask: InstallationTask = {
            id: `offer-${parsed.offerNumber}`,
            contract_id: parsed.offerNumber,
            status: 'offer',
            created_at: new Date().toISOString(),
            customer_name: parsed.customerName,
            ad_type: parsed.adType,
            team_name: '',
          };
          setSelectedTask(fakeTask);
          setShowBulkPrintDialog(true);
          toast.info(`تم تحميل لوحات العرض #${parsed.offerNumber}`);
          
          // مسح البيانات من sessionStorage
          sessionStorage.removeItem('offerPrintData');
        }
      } catch (e) {
        console.error('Error loading offer data:', e);
      }
    }
  }, [sourceFromUrl]);

  // Fetch contract and billboards for selected task
  const { data: taskDetails } = useQuery({
    queryKey: ['task-details', selectedTask?.id, offerData?.offerNumber],
    queryFn: async () => {
      if (!selectedTask) return null;
      
      // التحقق من كون المهمة عرض
      const isOffer = selectedTask.id?.startsWith('offer-');
      
      if (isOffer && offerData) {
        // معالجة بيانات العرض
        const billboardIds = offerData.billboardIds || offerData.billboardsData?.map((b: any) => parseInt(b.ID || b.id)) || [];
        
        // تحويل IDs لأرقام وإزالة القيم غير الصالحة
        const validBillboardIds = billboardIds.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id) && id > 0);
        
        console.log('Offer Data:', offerData);
        console.log('Billboard IDs:', validBillboardIds);
        
        // جلب بيانات اللوحات من قاعدة البيانات
        const { data: dbBillboards, error: dbError } = await supabase
          .from('billboards')
          .select('ID, Billboard_Name, Size, Level, Faces_Count, Municipality, District, Nearest_Landmark, Image_URL, GPS_Coordinates, GPS_Link, has_cutout, design_face_a, design_face_b')
          .in('ID', validBillboardIds);
        
        console.log('DB Billboards:', dbBillboards, 'Error:', dbError);
        
        // إذا لم نجد بيانات من قاعدة البيانات، استخدم بيانات العرض مباشرة
        let billboards: any[] = [];
        
        if (dbBillboards && dbBillboards.length > 0) {
          // دمج بيانات اللوحات من العرض مع بيانات قاعدة البيانات
          billboards = dbBillboards.map((dbBb: any) => {
            const offerBb = offerData.billboardsData?.find((ob: any) => parseInt(ob.ID || ob.id) === dbBb.ID);
            return {
              ...dbBb,
              // استخدام التصاميم من العرض إذا وجدت
              design_face_a: offerBb?.design_face_a || offerBb?.designFaceA || dbBb.design_face_a,
              design_face_b: offerBb?.design_face_b || offerBb?.designFaceB || dbBb.design_face_b,
              installed_image_url: offerBb?.installed_image_url,
              installed_image_face_a_url: offerBb?.installed_image_face_a_url,
              installed_image_face_b_url: offerBb?.installed_image_face_b_url,
              installation_date: offerBb?.installation_date || offerBb?.start_date || offerData.startDate,
            };
          });
        } else {
          // استخدم بيانات العرض مباشرة مع تحويل أسماء الخصائص
          billboards = (offerData.billboardsData || []).map((bb: any) => ({
            ID: parseInt(bb.ID || bb.id),
            Billboard_Name: bb.Billboard_Name || bb.name || bb.billboardName || `لوحة ${bb.ID || bb.id}`,
            Size: bb.Size || bb.size || '',
            Level: bb.Level || bb.level || '',
            Faces_Count: bb.Faces_Count || bb.facesCount || 2,
            Municipality: bb.Municipality || bb.municipality || bb.city || bb.City || '',
            District: bb.District || bb.district || '',
            Nearest_Landmark: bb.Nearest_Landmark || bb.nearestLandmark || bb.nearest_landmark || '',
            Image_URL: normalizeGoogleImageUrl(bb.Image_URL || bb.imageUrl || bb.image_url || ''),
            GPS_Coordinates: bb.GPS_Coordinates || bb.gpsCoordinates || '',
            GPS_Link: bb.GPS_Link || bb.gpsLink || '',
            has_cutout: bb.has_cutout || bb.hasCutout || false,
            design_face_a: bb.design_face_a || bb.designFaceA || null,
            design_face_b: bb.design_face_b || bb.designFaceB || null,
            installed_image_url: bb.installed_image_url || null,
            installed_image_face_a_url: bb.installed_image_face_a_url || null,
            installed_image_face_b_url: bb.installed_image_face_b_url || null,
            installation_date: bb.installation_date || offerData.startDate,
          }));
        }
        
        console.log('Final Billboards:', billboards);
        
        return {
          contract: {
            Contract_Number: offerData.offerNumber,
            'Customer Name': offerData.customerName,
            'Ad Type': offerData.adType || 'عرض سعر',
          },
          billboards,
          teams: [],
          isOffer: true,
          offerStartDate: offerData.startDate,
        };
      }
      
      // جلب العقد مع billboards_data للحصول على الترتيب
      const { data: contract } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type", design_data, billboards_data')
        .eq('Contract_Number', selectedTask.contract_id)
        .single();
      
      // تحليل billboards_data للحصول على ترتيب اللوحات
      let billboardOrderMap: Map<number, number> = new Map();
      if (contract?.billboards_data) {
        try {
          const billboardsDataArray = typeof contract.billboards_data === 'string' 
            ? JSON.parse(contract.billboards_data) 
            : contract.billboards_data;
          if (Array.isArray(billboardsDataArray)) {
            billboardsDataArray.forEach((item: any, index: number) => {
              const id = parseInt(item.id || item.ID);
              if (!isNaN(id)) {
                billboardOrderMap.set(id, index);
              }
            });
          }
        } catch (e) {
          console.error('Error parsing billboards_data for ordering:', e);
        }
      }
      
      // جلب جميع مهام الفرق لهذا العقد
      const { data: contractTasks } = await supabase
        .from('installation_tasks')
        .select('id, team_id, status')
        .eq('contract_id', selectedTask.contract_id);
      
      // جلب أسماء الفرق لهذه المهام فقط
      const teamIds = [...new Set((contractTasks || []).map(t => t.team_id).filter(Boolean))];
      const { data: contractTeams } = await supabase
        .from('installation_teams')
        .select('id, team_name')
        .in('id', teamIds);
      
      // بناء خريطة الفرق مع مهامها
      const teamsWithTasks = (contractTeams || []).map(team => {
        const teamTasks = (contractTasks || []).filter(t => t.team_id === team.id);
        return {
          ...team,
          taskIds: teamTasks.map(t => t.id)
        };
      });
      
      // جلب جميع عناصر المهام لهذا العقد
      const allTaskIds = (contractTasks || []).map(t => t.id);
      const { data: allInstallationItems } = await supabase
        .from('installation_task_items')
        .select('billboard_id, design_face_a, design_face_b, task_id, installed_image_url, installed_image_face_a_url, installed_image_face_b_url, installation_date')
        .in('task_id', allTaskIds);
      
      let installationItems = allInstallationItems || [];
      
      // جلب IDs اللوحات من عناصر التركيب
      const billboardIdsFromTask = installationItems?.map(item => item.billboard_id).filter(Boolean) || [];
      
      // إذا لم توجد عناصر في المهمة، نجلب من العقد كـ fallback
      const useContractBillboards = billboardIdsFromTask.length === 0;
      
      let billboards: any[] = [];
      
      if (useContractBillboards) {
        // Fallback: جلب اللوحات من العقد مباشرة
        const { data: contractBillboards } = await supabase
          .from('billboards')
          .select('ID, Billboard_Name, Size, Level, Faces_Count, Municipality, District, Nearest_Landmark, Image_URL, GPS_Coordinates, GPS_Link, has_cutout, design_face_a, design_face_b')
          .eq('Contract_Number', selectedTask.contract_id);
        billboards = contractBillboards || [];
      } else {
        // جلب اللوحات المحددة في عناصر المهمة فقط
        const { data: taskBillboards } = await supabase
          .from('billboards')
          .select('ID, Billboard_Name, Size, Level, Faces_Count, Municipality, District, Nearest_Landmark, Image_URL, GPS_Coordinates, GPS_Link, has_cutout, design_face_a, design_face_b')
          .in('ID', billboardIdsFromTask);
        billboards = taskBillboards || [];
      }

      // بناء خريطة تصاميم وصور التركيب وتاريخ التركيب من عناصر التركيب
      let installationDesigns: Record<string, {
        design_face_a?: string;
        design_face_b?: string;
        installed_image_url?: string;
        installed_image_face_a_url?: string;
        installed_image_face_b_url?: string;
        installation_date?: string;
        has_cutout?: boolean;
      }> = {};
      if (installationItems) {
        installationItems.forEach((item: any) => {
          if (item.billboard_id) {
            const key = item.billboard_id.toString();
            if (!installationDesigns[key]) {
              installationDesigns[key] = {};
            }
            if (item.design_face_a) {
              installationDesigns[key].design_face_a = item.design_face_a;
            }
            if (item.design_face_b) {
              installationDesigns[key].design_face_b = item.design_face_b;
            }
            // صورة تركيب واحدة (للوجه الواحد)
            if (item.installed_image_url) {
              installationDesigns[key].installed_image_url = item.installed_image_url;
            }
            // صور تركيب الوجهين
            if (item.installed_image_face_a_url) {
              installationDesigns[key].installed_image_face_a_url = item.installed_image_face_a_url;
            }
            if (item.installed_image_face_b_url) {
              installationDesigns[key].installed_image_face_b_url = item.installed_image_face_b_url;
            }
            // تاريخ التركيب الخاص بكل لوحة
            if (item.installation_date) {
              installationDesigns[key].installation_date = item.installation_date;
            }
            // خيار المجسم للمهمة
            if (item.has_cutout !== undefined && item.has_cutout !== null) {
              installationDesigns[key].has_cutout = Boolean(item.has_cutout);
            }
          }
        });
      }

      // Fetch designs from print_task_items via print_tasks for this contract
      const { data: printTasks } = await supabase
        .from('print_tasks')
        .select('id')
        .eq('contract_id', selectedTask.contract_id);

      let printTaskDesigns: Record<string, { design_face_a?: string; design_face_b?: string; cutout_image_url?: string }> = {};
      
      if (printTasks && printTasks.length > 0) {
        const taskIds = printTasks.map(t => t.id);
        const { data: printItems } = await supabase
          .from('print_task_items')
          .select('billboard_id, design_face_a, design_face_b, cutout_image_url')
          .in('task_id', taskIds);
        
        if (printItems) {
          printItems.forEach((item: any) => {
            if (item.billboard_id) {
              const key = item.billboard_id.toString();
              if (!printTaskDesigns[key]) {
                printTaskDesigns[key] = {};
              }
              if (item.design_face_a) {
                printTaskDesigns[key].design_face_a = item.design_face_a;
              }
              if (item.design_face_b) {
                printTaskDesigns[key].design_face_b = item.design_face_b;
              }
              if (item.cutout_image_url) {
                printTaskDesigns[key].cutout_image_url = item.cutout_image_url;
              }
            }
          });
        }
      }

      // Parse design_data from contract as fallback
      let contractDesignMap: Record<string, { designFaceA?: string; designFaceB?: string }> = {};
      if (contract?.design_data) {
        try {
          const designData = typeof contract.design_data === 'string' 
            ? JSON.parse(contract.design_data) 
            : contract.design_data;
          if (Array.isArray(designData)) {
            designData.forEach((item: any) => {
              if (item.billboardId) {
                contractDesignMap[item.billboardId.toString()] = {
                  designFaceA: item.designFaceA || '',
                  designFaceB: item.designFaceB || '',
                };
              }
            });
          }
        } catch (e) {
          console.error('Error parsing design_data:', e);
        }
      }

      // بناء خريطة من billboard_id إلى team_name
      const billboardTeamMap: Record<string, string> = {};
      installationItems.forEach((item: any) => {
        if (item.billboard_id && item.task_id) {
          // البحث عن الفريق المرتبط بهذه المهمة
          const team = teamsWithTasks.find(t => t.taskIds?.includes(item.task_id));
          if (team) {
            billboardTeamMap[item.billboard_id.toString()] = team.team_name;
          }
        }
      });

      // Merge all design sources with billboards
      const enrichedBillboards = billboards.map(bb => {
        const installDesign = installationDesigns[bb.ID.toString()];
        const printDesign = printTaskDesigns[bb.ID.toString()];
        const contractDesign = contractDesignMap[bb.ID.toString()];
        return {
          ...bb,
          has_cutout: installDesign?.has_cutout !== undefined ? installDesign.has_cutout : Boolean(bb.has_cutout),
          design_face_a: installDesign?.design_face_a || printDesign?.design_face_a || contractDesign?.designFaceA || bb.design_face_a || null,
          design_face_b: installDesign?.design_face_b || printDesign?.design_face_b || contractDesign?.designFaceB || bb.design_face_b || null,
          cutout_image_url: printDesign?.cutout_image_url || null,
          // صور التركيب
          installed_image_url: installDesign?.installed_image_url || null,
          installed_image_face_a_url: installDesign?.installed_image_face_a_url || null,
          installed_image_face_b_url: installDesign?.installed_image_face_b_url || null,
          // تاريخ التركيب الخاص بكل لوحة
          installation_date: installDesign?.installation_date || null,
          // اسم الفريق المرتبط باللوحة
          team_name: billboardTeamMap[bb.ID.toString()] || '',
        };
      });

      // ترتيب اللوحات: المقاس أولًا، ثم البلدية، ثم المستوى
      const getSizeOrder = (size: string) => {
        // ترتيب المقاسات من الأكبر للأصغر
        const sizeMap: Record<string, number> = {
          '14x4': 1, '12x4': 2, '10x4': 3, '9x3': 4, '8x4': 5, '8x3': 6,
          '7x4': 7, '7x3': 8, '6x4': 9, '6x3': 10, '5x4': 11, '5x3': 12,
          '4x3': 13, '4x4': 14, '3x4': 15, '3x3': 16, '3x2': 17,
          '2x3': 18, '2x2': 19, '2x1': 20, '1x1': 21,
        };
        return sizeMap[size] || 50;
      };
      
      const sortedBillboards = enrichedBillboards.sort((a, b) => {
        // 1. ترتيب حسب المقاس
        const sizeOrderA = getSizeOrder(a.Size || '');
        const sizeOrderB = getSizeOrder(b.Size || '');
        if (sizeOrderA !== sizeOrderB) return sizeOrderA - sizeOrderB;
        
        // 2. ترتيب حسب البلدية
        const munA = (a.Municipality || '').localeCompare(b.Municipality || '', 'ar');
        if (munA !== 0) return munA;
        
        // 3. ترتيب حسب المستوى
        const levelOrder: Record<string, number> = { 'A': 1, 'B': 2, 'C': 3, 'D': 4 };
        const levelA = levelOrder[(a as any).Level] || 99;
        const levelB = levelOrder[(b as any).Level] || 99;
        return levelA - levelB;
      });

      return { contract, billboards: sortedBillboards, teamsWithTasks, installationItems };
    },
    enabled: !!selectedTask,
  });

  // Generate QR code when billboard changes
  useEffect(() => {
    const generateQR = async () => {
      const billboard = taskDetails?.billboards?.[selectedBillboardIndex];

      const mapLink = (() => {
        if (billboard?.GPS_Link) return billboard.GPS_Link;
        if (billboard?.GPS_Coordinates) {
          const coords = billboard.GPS_Coordinates.trim();
          return `https://www.google.com/maps?q=${encodeURIComponent(coords)}`;
        }
        if (billboard?.ID) return `https://fares.sa/billboard/${billboard.ID}`;
        return 'https://www.google.com/maps?q=24.7136,46.6753';
      })();

      try {
        const url = await QRCode.toDataURL(mapLink, {
          width: 260,
          margin: 1,
          errorCorrectionLevel: 'M',
        });
        setQrCodeUrl(url);
      } catch (err) {
        console.error('QR generation error:', err);
        setQrCodeUrl('');
      }
    };

    generateQR();
  }, [selectedBillboardIndex, taskDetails]);

  useEffect(() => {
    if (data) {
      const rawElements = typeof data.elements === 'string' 
        ? JSON.parse(data.elements) 
        : (data.elements || DEFAULT_ELEMENTS);
      
      // استخراج statusOverrides من البيانات المخزنة
      const { __statusOverrides, ...elementData } = rawElements;
      
      // Merge with default elements to ensure new elements exist
      const mergedElements = { ...DEFAULT_ELEMENTS, ...elementData };
      
      // إذا كان هناك بروفايل نشط، نحتفظ بالخلفية من البروفايل
      if (activeProfileId && settings?.background_url) {
        setSettings(prev => ({
          ...prev!,
          elements: mergedElements,
          statusOverrides: __statusOverrides || prev?.statusOverrides,
        }));
      } else {
        // Use global settings for background and fonts only when no profile is active
        setSettings({
          ...data,
          elements: mergedElements,
          statusOverrides: __statusOverrides || undefined,
          background_url: globalSettings?.background_url || data.background_url,
          background_width: globalSettings?.background_width || data.background_width,
          background_height: globalSettings?.background_height || data.background_height,
          primary_font: globalSettings?.primary_font || data.primary_font,
          secondary_font: globalSettings?.secondary_font || data.secondary_font,
        } as PrintSettings);
      }
    }
  }, [data, globalSettings]);

  // Save mutation (elements only for current mode)
  const saveMutation = useMutation({
    mutationFn: async (newSettings: Partial<PrintSettings>) => {
      // Save elements + statusOverrides to current mode (stored together in elements JSON)
      const elementsWithOverrides = {
        ...newSettings.elements,
        __statusOverrides: newSettings.statusOverrides || undefined,
      };
      const { error } = await supabase
        .from('billboard_print_settings')
        .update({
          elements: elementsWithOverrides as any,
          custom_css: newSettings.custom_css,
        })
        .eq('setting_key', currentMode);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم حفظ الإعدادات بنجاح');
      queryClient.invalidateQueries({ queryKey: ['billboard-print-settings'] });
    },
    onError: (error: any) => {
      toast.error(`فشل حفظ الإعدادات: ${error.message}`);
    },
  });

  // Save global settings (background and fonts) - applies to all modes
  const saveGlobalSettingsMutation = useMutation({
    mutationFn: async (newSettings: { background_url?: string; background_width?: string; background_height?: string; primary_font?: string; secondary_font?: string }) => {
      // First, try to update existing global record
      const { data: existing } = await supabase
        .from('billboard_print_settings')
        .select('id')
        .eq('setting_key', 'global')
        .single();

      if (existing) {
        // Update existing global record
        const { error } = await supabase
          .from('billboard_print_settings')
          .update({
            background_url: newSettings.background_url,
            background_width: newSettings.background_width,
            background_height: newSettings.background_height,
            primary_font: newSettings.primary_font,
            secondary_font: newSettings.secondary_font,
          })
          .eq('setting_key', 'global');
        if (error) throw error;
      } else {
        // Create global record
        const { error } = await supabase
          .from('billboard_print_settings')
          .insert({
            setting_key: 'global',
            background_url: newSettings.background_url,
            background_width: newSettings.background_width,
            background_height: newSettings.background_height,
            primary_font: newSettings.primary_font,
            secondary_font: newSettings.secondary_font,
            elements: DEFAULT_ELEMENTS as any,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('تم حفظ الإعدادات العامة (الخلفية والخطوط)');
      queryClient.invalidateQueries({ queryKey: ['billboard-print-settings-global'] });
      refetchGlobal();
    },
    onError: (error: any) => {
      toast.error(`فشل حفظ الإعدادات العامة: ${error.message}`);
    },
  });

  // Apply to all modes mutation (elements only)
  const applyToAllMutation = useMutation({
    mutationFn: async (newSettings: Partial<PrintSettings>) => {
      const modes = Object.keys(PRINT_MODES);
      const updates = modes.map(mode => 
        supabase
          .from('billboard_print_settings')
          .update({
            elements: newSettings.elements as any,
            custom_css: newSettings.custom_css,
          })
          .eq('setting_key', mode)
      );
      
      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw new Error(`فشل تحديث ${errors.length} من الأوضاع`);
      }
    },
    onSuccess: () => {
      toast.success('تم تطبيق الإعدادات على جميع الأوضاع بنجاح');
      queryClient.invalidateQueries({ queryKey: ['billboard-print-settings'] });
    },
    onError: (error: any) => {
      toast.error(`فشل تطبيق الإعدادات: ${error.message}`);
    },
  });

  const handleSave = () => {
    if (settings) {
      saveMutation.mutate(settings);
    }
  };

  const handleApplyToAll = () => {
    if (settings) {
      applyToAllMutation.mutate(settings);
    }
  };

  const handleReset = () => {
    setSettings(prev => prev ? { ...prev, elements: DEFAULT_ELEMENTS } : null);
    markAsChanged();
    toast.info('تم إعادة تعيين الإعدادات للقيم الافتراضية');
  };

  // الحقول المرتبطة بين الوجه الأمامي والخلفي (الموقع والحجم والإطار)
  const linkedFields: (keyof ElementSettings)[] = ['top', 'width', 'height', 'borderWidth', 'borderColor', 'borderRadius', 'borderRadiusTopLeft', 'borderRadiusTopRight', 'borderRadiusBottomLeft', 'borderRadiusBottomRight'];

  // دالة الحصول على إعدادات العنصر المدمجة مع تجاوزات الحالة
  const getEffectiveElement = (key: string, statusKey?: StatusOverrideKey): ElementSettings => {
    if (!settings) return DEFAULT_ELEMENTS[key] || { visible: true };
    const base = settings.elements[key] || DEFAULT_ELEMENTS[key] || { visible: true };
    if (!statusKey || !settings.statusOverrides?.[statusKey]?.[key]) return base;
    return { ...base, ...settings.statusOverrides[statusKey][key] };
  };

  // الحالة النشطة للتحرير (none = تحرير الإعدادات الأساسية)
  const activeEditingStatus = previewStatusMode !== 'none' && previewStatusMode !== 'all-statuses' 
    ? previewStatusMode as StatusOverrideKey 
    : undefined;

  const updateElement = (key: string, field: keyof ElementSettings, value: any) => {
    setSettings(prev => {
      if (!prev) return prev;
      
      // إذا كنا نحرر حالة معينة، نحفظ التجاوز
      if (activeEditingStatus) {
        const newOverrides = { ...(prev.statusOverrides || {}) };
        if (!newOverrides[activeEditingStatus]) newOverrides[activeEditingStatus] = {};
        newOverrides[activeEditingStatus] = {
          ...newOverrides[activeEditingStatus],
          [key]: {
            ...(newOverrides[activeEditingStatus][key] || {}),
            [field]: value,
          },
        };
        return { ...prev, statusOverrides: newOverrides };
      }

      // تحرير الإعدادات الأساسية
      const newElements = {
        ...prev.elements,
        [key]: {
          ...prev.elements[key],
          [field]: value,
        },
      };
      
      // ربط الوجه الأمامي والخلفي
      if (linkedFields.includes(field)) {
        if (key === 'faceAImage' && newElements.faceBImage) {
          newElements.faceBImage = { ...newElements.faceBImage, [field]: value };
        } else if (key === 'faceBImage' && newElements.faceAImage) {
          newElements.faceAImage = { ...newElements.faceAImage, [field]: value };
        }
      }
      
      return { ...prev, elements: newElements };
    });
    // تتبع التغييرات
    markAsChanged();
  };

  const handleModeChange = (mode: string) => {
    setCurrentMode(mode);
  };

  const handlePrintPreview = () => {
    if (!previewRef.current) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('تم حظر النافذة المنبثقة. يرجى السماح بها.');
      return;
    }

    const content = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>معاينة الطباعة</title>
        <style>
          @page {
            size: A4;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: ${settings?.primary_font || 'Doran'}, Arial, sans-serif;
          }
          .print-page {
            width: 210mm;
            height: 297mm;
            position: relative;
            overflow: hidden;
            page-break-after: always;
          }
          .print-page img.background {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="print-page">
          ${!hideBackground ? `<img class="background" src="${settings?.background_url || '/ipg.svg'}" />` : ''}
          ${generatePreviewContent()}
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const generatePreviewContent = () => {
    if (!settings) return '';
    
    let billboard = taskDetails?.billboards?.[selectedBillboardIndex];
    const contract = taskDetails?.contract;
    
    // محاكاة حالة اللوحة عند تحرير حالة معينة
    if (billboard && previewStatusMode !== 'none' && previewStatusMode !== 'all-statuses') {
      billboard = { ...billboard };
      if (previewStatusMode === 'no-design') {
        billboard.design_face_a = null;
        billboard.design_face_b = null;
        (billboard as any).installed_image_face_a_url = null;
        (billboard as any).installed_image_face_b_url = null;
        (billboard as any).installed_image_url = null;
      } else if (previewStatusMode === 'one-design') {
        billboard.design_face_a = billboard.design_face_a || '/placeholder.svg';
        billboard.design_face_b = null;
        (billboard as any).installed_image_face_a_url = null;
        (billboard as any).installed_image_face_b_url = null;
      } else if (previewStatusMode === 'one-install') {
        billboard.design_face_a = billboard.design_face_a || '/placeholder.svg';
        billboard.design_face_b = billboard.design_face_b || '/placeholder.svg';
        (billboard as any).installed_image_face_a_url = (billboard as any).installed_image_face_a_url || (billboard as any).installed_image_url || '/placeholder.svg';
        (billboard as any).installed_image_face_b_url = null;
      }
    }
    
    // Get visible elements for current/smart mode
    const allowedElements = getVisibleElements(effectiveMode);
    
    let html = '';
    
    Object.entries(settings.elements).forEach(([key, baseElement]) => {
      // Apply status overrides for preview
      const element = activeEditingStatus 
        ? getEffectiveElement(key, activeEditingStatus)
        : baseElement;
      // Skip if element is not visible OR not in allowed elements for current mode
      if (!element.visible || !allowedElements.includes(key)) return;
      
      // Helper to get border radius
      const getBorderRadius = () => {
        if (element.borderRadiusTopLeft || element.borderRadiusTopRight || 
            element.borderRadiusBottomLeft || element.borderRadiusBottomRight) {
          return `${element.borderRadiusTopRight || '0px'} ${element.borderRadiusTopLeft || '0px'} ${element.borderRadiusBottomLeft || '0px'} ${element.borderRadiusBottomRight || '0px'}`;
        }
        return element.borderRadius || '0';
      };
      
      let style = `position: absolute; font-size: ${element.fontSize || '14px'}; font-weight: ${element.fontWeight || '400'}; color: ${element.color || '#000'}; direction: rtl; unicode-bidi: embed;`;
      if (element.fontFamily && element.fontFamily !== 'inherit') style += ` font-family: ${element.fontFamily};`;
      if (element.width) style += ` width: ${element.width};`;
      if (element.height) style += ` height: ${element.height};`;
      if (element.textAlign) style += ` text-align: ${element.textAlign};`;
      if (element.top) style += ` top: ${element.top};`;
      if (element.left) style += ` left: ${element.left};`;
      if (element.right) style += ` right: ${element.right};`;
      if (element.bottom) style += ` bottom: ${element.bottom};`;
      
      // Handle transform (center + rotation)
      const transforms: string[] = [];
      if (element.left?.includes('%') && element.textAlign === 'center') {
        transforms.push('translateX(-50%)');
      }
      if (element.rotation && element.rotation !== '0') {
        transforms.push(`rotate(${element.rotation}deg)`);
      }
      if (transforms.length > 0) {
        style += ` transform: ${transforms.join(' ')};`;
      }
      
      let content = '';
      const borderRadius = getBorderRadius();
      const minWidthStyle = element.minWidth ? `min-width: ${element.minWidth};` : '';
      
      switch (key) {
        case 'contractNumber':
          content = billboard ? `عقد رقم: ${contract?.Contract_Number || '---'}` : 'عقد رقم: 1234';
          break;
        case 'adType':
          const adLabel = element.label || 'نوع الإعلان:';
          const adValue = taskDetails?.contract?.['Ad Type'] || 'إعلان تجاري';
          content = `${adLabel} ${adValue}`;
          break;
        case 'billboardName':
          content = billboard?.Billboard_Name || 'اسم اللوحة';
          break;
        case 'size':
          content = billboard?.Size || '3x4';
          break;
        case 'facesCount':
          content = billboard ? formatFacesCountArabic(billboard.Faces_Count || 1) : 'وجهين';
          break;
        case 'locationInfo':
          content = billboard ? `${billboard.Municipality || ''} - ${billboard.District || ''}` : 'البلدية - المنطقة';
          break;
        case 'landmarkInfo':
          content = billboard?.Nearest_Landmark || 'أقرب معلم';
          break;
        case 'installationDate':
          // استخدام تاريخ التركيب الخاص بكل لوحة إذا وجد
          const billboardInstallDate = billboard?.installation_date;
          content = billboardInstallDate 
            ? `تاريخ التركيب: ${new Date(billboardInstallDate).toLocaleDateString('en-GB')}`
            : 'لم يتم التركيب';
          break;
        case 'printType':
          content = previewTarget === 'team' 
            ? (selectedTask?.team_name || 'فريق التركيب') 
            : 'نسخة العميل';
          break;
        case 'image': {
          // أولوية العرض: صورة تركيب (وجه واحد) ثم صورة اللوحة
          const imgUrl = normalizeGoogleImageUrl(billboard?.installed_image_url || billboard?.Image_URL) || '/placeholder.svg';
          const borderStyle = `border: ${element.borderWidth || '2px'} solid ${element.borderColor || '#000'}; border-radius: ${borderRadius};`;
          content = `<img src="${imgUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain; ${borderStyle} ${minWidthStyle}" />`;
          break;
        }
        case 'qrCode':
          if (qrCodeUrl) {
            content = `<img src="${qrCodeUrl}" style="width: 100%; height: 100%; object-fit: contain; ${minWidthStyle}" />`;
          }
          break;
        case 'designs':
          const designA = billboard?.design_face_a;
          const designB = billboard?.design_face_b;
          const designBorderStyle = `border: ${element.borderWidth || '1px'} solid ${element.borderColor || '#ddd'}; border-radius: ${borderRadius};`;
          content = `
            <div style="display: flex; gap: ${element.gap || '12px'}; height: 100%; align-items: center; justify-content: center;">
              <div style="flex: 1; display: flex; align-items: center; justify-content: center; height: 100%;">
                ${designA ? `<img src="${designA}" style="max-width: 100%; max-height: 100%; object-fit: contain; ${designBorderStyle} ${minWidthStyle}" />` : '<span>تصميم A</span>'}
              </div>
              <div style="flex: 1; display: flex; align-items: center; justify-content: center; height: 100%;">
                ${designB ? `<img src="${designB}" style="max-width: 100%; max-height: 100%; object-fit: contain; ${designBorderStyle} ${minWidthStyle}" />` : '<span>تصميم B</span>'}
              </div>
            </div>
          `;
          break;
        case 'cutoutImage':
          const cutoutUrl = billboard?.cutout_image_url;
          if (cutoutUrl) {
            const cutoutBorderStyle = `border: ${element.borderWidth || '2px'} solid ${element.borderColor || '#000'}; border-radius: ${borderRadius};`;
            content = `<img src="${cutoutUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain; ${cutoutBorderStyle} ${minWidthStyle}" />`;
          }
          break;
        case 'singleInstallationImage': {
          // صورة تركيب واحدة
          const singleInstallUrl = billboard?.installed_image_face_a_url || billboard?.installed_image_url;
          if (singleInstallUrl) {
            const singleBorderStyle = `border: ${element.borderWidth || '3px'} solid ${element.borderColor || '#ccc'}; border-radius: ${borderRadius};`;
            content = `<img src="${singleInstallUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain; ${singleBorderStyle} ${minWidthStyle}" />`;
          } else {
            content = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; border: 2px dashed #ccc; border-radius: ${borderRadius}; color: #999; font-size: 12px;">صورة التركيب</div>`;
          }
          break;
        }
        case 'linkedInstallationImages': {
          // صور التركيب للوجهين (مربوطين)
          const linkedFaceAUrl = billboard?.installed_image_face_a_url || billboard?.installed_image_url;
          const linkedFaceBUrl = billboard?.installed_image_face_b_url;
          const linkedBorderStyle = `border: ${element.borderWidth || '3px'} solid ${element.borderColor || '#ccc'}; border-radius: ${borderRadius};`;
          const linkedGapValue = element.gap || '12px';
          
          content = `
            <div style="display: flex; gap: ${linkedGapValue}; height: 100%; align-items: center; justify-content: center;">
              <div style="flex: 1; display: flex; align-items: center; justify-content: center; height: 100%; max-width: 48%;">
                ${linkedFaceAUrl ? `<img src="${linkedFaceAUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain; ${linkedBorderStyle}" />` : '<div style="display: flex; align-items: center; justify-content: center; height: 100%; border: 2px dashed #ccc; border-radius: 8px; color: #999; font-size: 11px; padding: 8px;">الوجه الأمامي</div>'}
              </div>
              <div style="flex: 1; display: flex; align-items: center; justify-content: center; height: 100%; max-width: 48%;">
                ${linkedFaceBUrl ? `<img src="${linkedFaceBUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain; ${linkedBorderStyle}" />` : '<div style="display: flex; align-items: center; justify-content: center; height: 100%; border: 2px dashed #ccc; border-radius: 8px; color: #999; font-size: 11px; padding: 8px;">الوجه الخلفي</div>'}
              </div>
            </div>
          `;
          break;
        }
        case 'faceAImage': {
          // في وضع two_faces_with_designs نستخدم الحاوية المشتركة
          if (effectiveMode === 'two_faces_with_designs') break;
          // صور التركيب فقط (وجه واحد أو وجهين)
          const faceAUrl = billboard?.installed_image_face_a_url || billboard?.installed_image_url;
          if (faceAUrl) {
            const faceABorderStyle = `border: ${element.borderWidth || '3px'} solid ${element.borderColor || '#ccc'}; border-radius: ${borderRadius};`;
            content = `<img src="${faceAUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain; ${faceABorderStyle} ${minWidthStyle}" />`;
          }
          break;
        }
        case 'faceBImage': {
          // في وضع two_faces_with_designs نستخدم الحاوية المشتركة
          if (effectiveMode === 'two_faces_with_designs') break;
          const facesCount = billboard?.Faces_Count || 1;
          // إذا كانت اللوحة وجه واحد أو لا توجد صورة تركيب للوجه الثاني، لا نعرضه
          if (facesCount > 1 && billboard?.installed_image_face_b_url) {
            const faceBBorderStyle = `border: ${element.borderWidth || '3px'} solid ${element.borderColor || '#ccc'}; border-radius: ${borderRadius};`;
            content = `<img src="${billboard.installed_image_face_b_url}" style="max-width: 100%; max-height: 100%; object-fit: contain; ${faceBBorderStyle} ${minWidthStyle}" />`;
          }
          break;
        }
        case 'twoFacesContainer': {
          // حاوية الوجهين مع التصاميم - تجمع الوجه الأمامي والخلفي في حاوية واحدة
          if (effectiveMode !== 'two_faces_with_designs') break;
          const faceAUrl = billboard?.installed_image_face_a_url || billboard?.installed_image_url;
          const faceBUrl = billboard?.installed_image_face_b_url;
          const containerBorderStyle = `border: ${element.borderWidth || '3px'} solid ${element.borderColor || '#ccc'}; border-radius: ${borderRadius};`;
          const gapValue = element.gap || '20px';
          
          content = `
            <div style="display: flex; gap: ${gapValue}; height: 100%; align-items: center; justify-content: center;">
              <div style="flex: 1; display: flex; align-items: center; justify-content: center; height: 100%; max-width: 48%;">
                ${faceAUrl ? `<img src="${faceAUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain; ${containerBorderStyle}" />` : '<span style="color: #999;">الوجه الأمامي</span>'}
              </div>
              <div style="flex: 1; display: flex; align-items: center; justify-content: center; height: 100%; max-width: 48%;">
                ${faceBUrl ? `<img src="${faceBUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain; ${containerBorderStyle}" />` : '<span style="color: #999;">الوجه الخلفي</span>'}
              </div>
            </div>
          `;
          break;
        }
        default:
          content = ELEMENT_LABELS[key] || key;
      }
      
      if (content) html += `<div style="${style}">${content}</div>`;
    });
    
    return html;
  };

  const selectTask = (task: any) => {
    // تأكد من نقل team_name مع المهمة
    setSelectedTask({
      ...task,
      team_name: task.team_name || '',
    });
    setSelectedBillboardIndex(0);
    setShowTaskDialog(false);
    // Reset bulk print selection when task changes
    setSelectedBillboardsForPrint([]);
  };

  // Profile mutations
  const saveProfileMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string; description: string }) => {
      if (!settings) throw new Error('لا توجد إعدادات');
      
      const settingsData = {
        currentMode,
        settings: {
          background_url: settings.background_url,
          background_width: settings.background_width,
          background_height: settings.background_height,
          elements: settings.elements,
          primary_font: settings.primary_font,
          secondary_font: settings.secondary_font,
          custom_css: settings.custom_css,
        }
      };

      const { error } = await supabase
        .from('billboard_print_profiles')
        .insert([{
          profile_name: name,
          description,
          settings_data: settingsData as any,
        }]);

      if (error) throw error;
      
      // جلب البروفايل الجديد لتفعيله
      const { data: newProfile } = await supabase
        .from('billboard_print_profiles')
        .select('*')
        .eq('profile_name', name)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      return newProfile;
    },
    onSuccess: (newProfile) => {
      toast.success('تم حفظ البروفايل بنجاح');
      setShowSaveProfileDialog(false);
      setNewProfileName('');
      setNewProfileDescription('');
      queryClient.invalidateQueries({ queryKey: ['billboard-print-profiles'] });
      
      // تفعيل البروفايل الجديد
      if (newProfile) {
        setActiveProfileId(newProfile.id);
        setActiveProfileName(newProfile.profile_name);
        setHasUnsavedChanges(false);
      }
    },
    onError: (error: any) => {
      toast.error(`فشل حفظ البروفايل: ${error.message}`);
    },
  });

  const deleteProfileMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await supabase
        .from('billboard_print_profiles')
        .delete()
        .eq('id', profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم حذف البروفايل');
      queryClient.invalidateQueries({ queryKey: ['billboard-print-profiles'] });
    },
    onError: (error: any) => {
      toast.error(`فشل حذف البروفايل: ${error.message}`);
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async ({ id, name, description }: { id: string; name: string; description: string }) => {
      const { error } = await supabase
        .from('billboard_print_profiles')
        .update({ profile_name: name, description })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تحديث البروفايل');
      queryClient.invalidateQueries({ queryKey: ['billboard-print-profiles'] });
      setEditingProfileId(null);
      // تحديث اسم البروفايل النشط إذا كان هو نفسه
      if (editingProfileId === activeProfileId) {
        setActiveProfileName(editingProfileName);
      }
    },
    onError: (error: any) => {
      toast.error(`فشل تحديث البروفايل: ${error.message}`);
    },
  });

  // تعيين البروفايل كافتراضي
  const setDefaultProfileMutation = useMutation({
    mutationFn: async (profileId: string) => {
      // إزالة الافتراضي من جميع البروفايلات
      await supabase
        .from('billboard_print_profiles')
        .update({ is_default: false })
        .neq('id', 'placeholder');
      
      // تعيين البروفايل المحدد كافتراضي
      const { error } = await supabase
        .from('billboard_print_profiles')
        .update({ is_default: true })
        .eq('id', profileId);
      
      if (error) throw error;
      return profileId;
    },
    onSuccess: () => {
      toast.success('تم تعيين البروفايل كافتراضي');
      queryClient.invalidateQueries({ queryKey: ['billboard-print-profiles'] });
    },
    onError: (error: any) => {
      toast.error(`فشل تعيين البروفايل كافتراضي: ${error.message}`);
    },
  });

  const loadProfile = (profile: any) => {
    loadProfileData(profile);
    toast.success(`تم تحميل بروفايل: ${profile.profile_name}`);
    setShowProfileDialog(false);
  };

  // حفظ تعديلات البروفايل النشط
  const updateActiveProfileMutation = useMutation({
    mutationFn: async () => {
      if (!activeProfileId || !settings) throw new Error('لا يوجد بروفايل نشط');
      
      const settingsData = {
        currentMode,
        settings: {
          background_url: settings.background_url,
          background_width: settings.background_width,
          background_height: settings.background_height,
          elements: settings.elements,
          primary_font: settings.primary_font,
          secondary_font: settings.secondary_font,
          custom_css: settings.custom_css,
        }
      };

      const { error } = await supabase
        .from('billboard_print_profiles')
        .update({ settings_data: settingsData as any, updated_at: new Date().toISOString() })
        .eq('id', activeProfileId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`تم حفظ التعديلات على بروفايل: ${activeProfileName}`);
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ['billboard-print-profiles'] });
    },
    onError: (error: any) => {
      toast.error(`فشل حفظ التعديلات: ${error.message}`);
    },
  });

  // تتبع التغييرات
  const markAsChanged = () => {
    if (activeProfileId) {
      setHasUnsavedChanges(true);
    }
  };

  // دالة تحديد الوضع الذكي لكل لوحة
  const getSmartModeForBillboard = (billboard: any): string => {
    const hasTwoFaceInstallation = billboard?.installed_image_face_a_url && billboard?.installed_image_face_b_url;
    const hasSingleInstallation = billboard?.installed_image_face_a_url || billboard?.installed_image_url;
    const hasTwoDesigns = billboard?.design_face_a && billboard?.design_face_b;
    const hasSingleDesign = billboard?.design_face_a && !billboard?.design_face_b;
    const hasCutout = billboard?.has_cutout === true;
    
    // إذا كانت اللوحة بوجهين (تركيب وتصميم)
    if (hasTwoFaceInstallation && hasTwoDesigns) {
      return 'two_faces_with_designs';
    }
    // إذا كانت اللوحة بوجهين (تركيب فقط)
    if (hasTwoFaceInstallation) {
      return 'two_faces';
    }
    // إذا كانت اللوحة بوجه واحد مع تصميم
    if (hasSingleInstallation && (hasSingleDesign || hasTwoDesigns)) {
      return 'single_installation_with_designs';
    }
    // إذا كانت اللوحة بوجه واحد فقط
    if (hasSingleInstallation) {
      return 'single_face';
    }
    // الوضع الافتراضي مع التصاميم
    if (hasTwoDesigns || hasSingleDesign) {
      return 'with_design';
    }
    
    return 'default';
  };

  // Bulk print function
  const handleBulkPrint = async () => {
    if (!taskDetails?.billboards || selectedBillboardsForPrint.length === 0) {
      toast.error('يرجى اختيار لوحات للطباعة');
      return;
    }

    const billboardsToPrint = taskDetails.billboards.filter(bb => 
      selectedBillboardsForPrint.includes(bb.ID)
    );

    if (billboardsToPrint.length === 0) {
      toast.error('لا توجد لوحات مختارة');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('تم حظر النافذة المنبثقة. يرجى السماح بها.');
      return;
    }

    // رقم العقد + كود العقد السنوي (للظهور في عنوان نافذة الطباعة)
    const contractNumber = taskDetails?.contract?.Contract_Number;
    const contractDateStr = (taskDetails?.contract as any)?.['Contract Date'] as string | undefined;

    const yearlyCode = await (async () => {
      if (!contractNumber || !contractDateStr) return '';
      const d = new Date(contractDateStr);
      if (isNaN(d.getTime())) return '';

      const year = d.getFullYear();
      const yearShort = String(year).slice(-2);

      try {
        const { data } = await supabase
          .from('Contract')
          .select('Contract_Number,"Contract Date"')
          .order('Contract_Number', { ascending: true });

        const sameYear = (data || []).filter((c: any) => {
          const cd = new Date(c['Contract Date']);
          return !isNaN(cd.getTime()) && cd.getFullYear() === year;
        });

        const idx = sameYear.findIndex((c: any) => c.Contract_Number === contractNumber);
        if (idx !== -1) return `${idx + 1}/${yearShort}`;
        return yearShort;
      } catch {
        return yearShort;
      }
    })();

    // Generate QR codes for all billboards
    const qrCodes: Record<number, string> = {};
    for (const bb of billboardsToPrint) {
      const mapLink = bb.GPS_Link || (bb.GPS_Coordinates ? `https://www.google.com/maps?q=${encodeURIComponent(bb.GPS_Coordinates.trim())}` : `https://fares.sa/billboard/${bb.ID}`);
      try {
        qrCodes[bb.ID] = await QRCode.toDataURL(mapLink, { width: 260, margin: 1, errorCorrectionLevel: 'M' });
      } catch { qrCodes[bb.ID] = ''; }
    }

    // Generate pages - استخدام الوضع الذكي لكل لوحة
    let pages = '';
    if (bulkPrintMode === 'both') {
      // طباعة كلا النسختين: نسخة العميل أولاً ثم نسخة الفريق
      const customerPages = billboardsToPrint.map(bb => {
        const qrUrl = qrCodes[bb.ID];
        const smartMode = useSmartMode ? getSmartModeForBillboard(bb) : currentMode;
        return generateSmartBillboardPageHTML(bb, qrUrl, 'customer', smartMode);
      }).join('\n');
      
      const teamPages = billboardsToPrint.map(bb => {
        const qrUrl = qrCodes[bb.ID];
        const smartMode = useSmartMode ? getSmartModeForBillboard(bb) : currentMode;
        return generateSmartBillboardPageHTML(bb, qrUrl, 'team', smartMode);
      }).join('\n');
      
      pages = customerPages + teamPages;
    } else {
      pages = billboardsToPrint.map(bb => {
        const qrUrl = qrCodes[bb.ID];
        const smartMode = useSmartMode ? getSmartModeForBillboard(bb) : currentMode;
        return generateSmartBillboardPageHTML(bb, qrUrl, bulkPrintMode, smartMode);
      }).join('\n');
    }

    const selectedTeamNameForTitle = (() => {
      if (bulkPrintMode !== 'team') return '';
      if (selectedTeamForPrint === 'all') return 'جميع الفرق';
      const team = taskDetails?.teamsWithTasks?.find((t: any) => t.id === selectedTeamForPrint);
      return team?.team_name || selectedTask?.team_name || '';
    })();

    const printWindowTitle = [
      modeFromUrl === 'removal' ? 'إزالة' : 'تركيب',
      contractNumber ? `عقد #${contractNumber}` : 'عقد #---',
      yearlyCode ? `(${yearlyCode})` : '',
      selectedTask?.customer_name || '',
      selectedTask?.ad_type || '',
      `${billboardsToPrint.length} لوحة`,
      selectedTeamNameForTitle ? `[${selectedTeamNameForTitle}]` : '',
    ].filter(Boolean).join(' - ');

    const content = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>${printWindowTitle}</title>
        <style>
          @page { size: A4; margin: 0; }
          body { margin: 0; padding: 0; font-family: ${settings?.primary_font || 'Doran'}, Arial, sans-serif; }
          .print-page { width: 210mm; height: 297mm; position: relative; overflow: hidden; page-break-after: always; }
          .print-page img.background { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>${pages}</body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
    setShowBulkPrintDialog(false);
  };

  // دالة توليد شارات الحالة
  const generateStatusBadgesHTML = (billboard: any) => {
    if (!showStatusBadgesInPrint || !settings) return '';
    const badgeElement = settings.elements?.statusBadges || DEFAULT_ELEMENTS.statusBadges;
    if (!badgeElement.visible) return '';

    const badges: string[] = [];
    
    // إذا كان وضع المعاينة مفعل، نستخدم بيانات وهمية
    let hasDesignA: any, hasDesignB: any, hasTwoFaces: boolean, hasInstallA: any, hasInstallB: any;
    
    if (previewStatusMode !== 'none') {
      // محاكاة الحالات
      if (previewStatusMode === 'no-design') {
        hasDesignA = false; hasDesignB = false; hasTwoFaces = true; hasInstallA = false; hasInstallB = false;
      } else if (previewStatusMode === 'one-design') {
        hasDesignA = true; hasDesignB = false; hasTwoFaces = true; hasInstallA = false; hasInstallB = false;
      } else if (previewStatusMode === 'one-install') {
        hasDesignA = true; hasDesignB = true; hasTwoFaces = true; hasInstallA = true; hasInstallB = false;
      }
    } else {
      hasDesignA = billboard?.design_face_a;
      hasDesignB = billboard?.design_face_b;
      hasTwoFaces = (billboard?.Faces_Count || 1) >= 2;
      hasInstallA = billboard?.installed_image_face_a_url || billboard?.installed_image_url;
      hasInstallB = billboard?.installed_image_face_b_url;
    }

    // بدون تصميم
    if (showBadgeNoDesign && !hasDesignA && !hasDesignB) {
 badges.push(`<span style="background:#ef4444;color:#fff;padding:2px 8px;border-radius:12px;font-size:${badgeElement.fontSize || '11px'};font-weight:${badgeElement.fontWeight || '600'};"> بدون تصميم</span>`);
    }
    // تصميم واحد فقط (للوحة ذات وجهين)
    else if (showBadgeOneDesign && hasTwoFaces && hasDesignA && !hasDesignB) {
      badges.push(`<span style="background:#f59e0b;color:#fff;padding:2px 8px;border-radius:12px;font-size:${badgeElement.fontSize || '11px'};font-weight:${badgeElement.fontWeight || '600'};">◐ تصميم واحد</span>`);
    }
    // تركيب وجه واحد فقط (للوحة ذات وجهين)
    if (showBadgeOneInstall && hasTwoFaces && hasInstallA && !hasInstallB) {
      badges.push(`<span style="background:#3b82f6;color:#fff;padding:2px 8px;border-radius:12px;font-size:${badgeElement.fontSize || '11px'};font-weight:${badgeElement.fontWeight || '600'};">① تركيب وجه واحد</span>`);
    }

    if (badges.length === 0) return '';

    let style = `position:absolute;display:flex;gap:6px;flex-wrap:wrap;justify-content:center;direction:rtl;`;
    if (badgeElement.top) style += `top:${badgeElement.top};`;
    if (badgeElement.left) style += `left:${badgeElement.left};`;
    if (badgeElement.width) style += `width:${badgeElement.width};`;
    if (badgeElement.left?.includes('%')) style += `transform:translateX(-50%);`;

    return `<div style="${style}">${badges.join(' ')}</div>`;
  };

  // تحديد حالة اللوحة لتطبيق التجاوزات
  const getBillboardStatus = (billboard: any): StatusOverrideKey | null => {
    const hasDesignA = billboard?.design_face_a;
    const hasDesignB = billboard?.design_face_b;
    const hasTwoFaces = (billboard?.Faces_Count || 1) >= 2;
    const hasInstallA = billboard?.installed_image_face_a_url || billboard?.installed_image_url;
    const hasInstallB = billboard?.installed_image_face_b_url;
    
    if (!hasDesignA && !hasDesignB) return 'no-design';
    if (hasTwoFaces && hasDesignA && !hasDesignB) return 'one-design';
    if (hasTwoFaces && hasInstallA && !hasInstallB) return 'one-install';
    return null;
  };

  // الحصول على عنصر مع تطبيق تجاوزات الحالة للطباعة
  const getElementForPrint = (key: string, billboard: any): ElementSettings => {
    if (!settings) return DEFAULT_ELEMENTS[key] || { visible: true };
    const base = settings.elements[key] || DEFAULT_ELEMENTS[key] || { visible: true };
    const status = getBillboardStatus(billboard);
    if (!status || !settings.statusOverrides?.[status]?.[key]) return base;
    return { ...base, ...settings.statusOverrides[status][key] };
  };

  const generateBillboardPageHTML = (billboard: any, qrUrl: string, printMode: 'customer' | 'team') => {
    if (!settings) return '';
    
    const contract = taskDetails?.contract;
    // استخدم الوضع الذكي للوحة المحددة
    const billboardSmartMode = useSmartMode ? getSmartModeForBillboard(billboard) : currentMode;
    const allowedElements = getVisibleElements(billboardSmartMode);
    
    let html = '';
    
    Object.entries(settings.elements).forEach(([key, baseElement]) => {
      // تطبيق تجاوزات الحالة
      const element = getElementForPrint(key, billboard);
      // Skip team-only elements for customer print (printType فقط)
      if (printMode === 'customer' && key === 'printType') return;
      if (!element.visible || !allowedElements.includes(key)) return;
      
      // تخطي صور التركيب إذا كان الخيار معطل
      const installationImageElements = ['faceAImage', 'faceBImage', 'twoFacesContainer'];
      if (installationImageElements.includes(key) && !showInstallationImagesInPrint) {
        // في الوضع الذكي، نعرض صور التركيب تلقائياً إذا كانت موجودة
        if (useSmartMode) {
          const hasFaceA = billboard?.installed_image_face_a_url || billboard?.installed_image_url;
          const hasFaceB = billboard?.installed_image_face_b_url;
          if (!hasFaceA && !hasFaceB) return; // لا توجد صور تركيب
        } else {
          return; // خيار صور التركيب معطل يدوياً
        }
      }
      
      const getBorderRadius = () => {
        if (element.borderRadiusTopLeft || element.borderRadiusTopRight || 
            element.borderRadiusBottomLeft || element.borderRadiusBottomRight) {
          return `${element.borderRadiusTopRight || '0px'} ${element.borderRadiusTopLeft || '0px'} ${element.borderRadiusBottomLeft || '0px'} ${element.borderRadiusBottomRight || '0px'}`;
        }
        return element.borderRadius || '0';
      };
      
      let style = `position: absolute; font-size: ${element.fontSize || '14px'}; font-weight: ${element.fontWeight || '400'}; color: ${element.color || '#000'}; direction: rtl; unicode-bidi: embed;`;
      if (element.fontFamily && element.fontFamily !== 'inherit') style += ` font-family: ${element.fontFamily};`;
      if (element.width) style += ` width: ${element.width};`;
      if (element.height) style += ` height: ${element.height};`;
      if (element.textAlign) style += ` text-align: ${element.textAlign};`;
      if (element.top) style += ` top: ${element.top};`;
      if (element.left) style += ` left: ${element.left};`;
      if (element.right) style += ` right: ${element.right};`;
      if (element.bottom) style += ` bottom: ${element.bottom};`;
      
      const transforms: string[] = [];
      if (element.left?.includes('%') && element.textAlign === 'center') transforms.push('translateX(-50%)');
      if (element.rotation && element.rotation !== '0') transforms.push(`rotate(${element.rotation}deg)`);
      if (transforms.length > 0) style += ` transform: ${transforms.join(' ')};`;
      
      let content = '';
      const borderRadius = getBorderRadius();
      const minWidthStyle = element.minWidth ? `min-width: ${element.minWidth};` : '';
      
      switch (key) {
        case 'contractNumber':
          content = `عقد رقم: ${contract?.Contract_Number || '---'}`;
          break;
        case 'adType':
          content = `${element.label || 'نوع الإعلان:'} ${contract?.['Ad Type'] || ''}`;
          break;
        case 'billboardName':
          content = billboard?.Billboard_Name || '';
          break;
        case 'size':
          content = billboard?.Size || '';
          break;
        case 'facesCount':
          content = formatFacesCountArabic(billboard?.Faces_Count || 1);
          break;
        case 'locationInfo':
          content = `${billboard?.Municipality || ''} - ${billboard?.District || ''}`;
          break;
        case 'landmarkInfo':
          content = billboard?.Nearest_Landmark || '';
          break;
        case 'installationDate':
          // استخدام تاريخ التركيب الخاص بكل لوحة إذا وجد
          const billboardInstallDatePreview = billboard?.installation_date;
          content = billboardInstallDatePreview 
            ? `تاريخ التركيب: ${new Date(billboardInstallDatePreview).toLocaleDateString('en-GB')}`
            : 'لم يتم التركيب';
          break;
        case 'printType':
          content = printMode === 'team' ? (billboard?.team_name || selectedTask?.team_name || 'فريق التركيب') : 'نسخة العميل';
          break;
        case 'image': {
          const imgUrl = normalizeGoogleImageUrl(billboard?.installed_image_url || billboard?.Image_URL) || '/placeholder.svg';
          const borderStyle = `border: ${element.borderWidth || '2px'} solid ${element.borderColor || '#000'}; border-radius: ${borderRadius};`;
          const objectFit = element.objectFit || 'contain';
          const objectPosition = element.objectPosition || 'center';
          content = `<img src="${imgUrl}" style="max-width: 100%; max-height: 100%; object-fit: ${objectFit}; object-position: ${objectPosition}; ${borderStyle} ${minWidthStyle}" />`;
          break;
        }
        case 'qrCode':
          if (qrUrl) content = `<img src="${qrUrl}" style="width: 100%; height: 100%; object-fit: contain; ${minWidthStyle}" />`;
          break;
        case 'designs': {
          const designA = billboard?.design_face_a;
          const designB = billboard?.design_face_b;
          const designBorderStyle = `border: ${element.borderWidth || '1px'} solid ${element.borderColor || '#ddd'}; border-radius: ${borderRadius};`;
          const designObjectFit = element.objectFit || 'contain';
          const designObjectPosition = element.objectPosition || 'center';
          content = `
            <div style="display: flex; gap: ${element.gap || '12px'}; height: 100%; align-items: center; justify-content: center;">
              <div style="flex: 1; display: flex; align-items: center; justify-content: center; height: 100%;">
                ${designA ? `<img src="${designA}" style="max-width: 100%; max-height: 100%; object-fit: ${designObjectFit}; object-position: ${designObjectPosition}; ${designBorderStyle} ${minWidthStyle}" />` : ''}
              </div>
              <div style="flex: 1; display: flex; align-items: center; justify-content: center; height: 100%;">
                ${designB ? `<img src="${designB}" style="max-width: 100%; max-height: 100%; object-fit: ${designObjectFit}; object-position: ${designObjectPosition}; ${designBorderStyle} ${minWidthStyle}" />` : ''}
              </div>
            </div>
          `;
          break;
        }
        case 'cutoutImage':
          if (billboard?.cutout_image_url) {
            const cutoutBorderStyle = `border: ${element.borderWidth || '2px'} solid ${element.borderColor || '#000'}; border-radius: ${borderRadius};`;
            const cutoutObjectFit = element.objectFit || 'contain';
            const cutoutObjectPosition = element.objectPosition || 'center';
            content = `<img src="${billboard.cutout_image_url}" style="max-width: 100%; max-height: 100%; object-fit: ${cutoutObjectFit}; object-position: ${cutoutObjectPosition}; ${cutoutBorderStyle} ${minWidthStyle}" />`;
          }
          break;
        case 'singleInstallationImage': {
          const singleInstallUrl = billboard?.installed_image_face_a_url || billboard?.installed_image_url;
          if (singleInstallUrl) {
            const singleBorderStyle = `border: ${element.borderWidth || '3px'} solid ${element.borderColor || '#ccc'}; border-radius: ${borderRadius};`;
            const singleObjectFit = element.objectFit || 'contain';
            const singleObjectPosition = element.objectPosition || 'center';
            content = `<img src="${singleInstallUrl}" style="max-width: 100%; max-height: 100%; object-fit: ${singleObjectFit}; object-position: ${singleObjectPosition}; ${singleBorderStyle} ${minWidthStyle}" />`;
          }
          break;
        }
        case 'linkedInstallationImages': {
          const linkedFaceAUrl = billboard?.installed_image_face_a_url || billboard?.installed_image_url;
          const linkedFaceBUrl = billboard?.installed_image_face_b_url;
          const linkedBorderStyle = `border: ${element.borderWidth || '3px'} solid ${element.borderColor || '#ccc'}; border-radius: ${borderRadius};`;
          const linkedGapValue = element.gap || '12px';
          const linkedObjectFit = element.objectFit || 'contain';
          const linkedObjectPosition = element.objectPosition || 'center';
          
          content = `
            <div style="display: flex; gap: ${linkedGapValue}; height: 100%; align-items: center; justify-content: center;">
              <div style="flex: 1; display: flex; align-items: center; justify-content: center; height: 100%; max-width: 48%;">
                ${linkedFaceAUrl ? `<img src="${linkedFaceAUrl}" style="max-width: 100%; max-height: 100%; object-fit: ${linkedObjectFit}; object-position: ${linkedObjectPosition}; ${linkedBorderStyle}" />` : ''}
              </div>
              <div style="flex: 1; display: flex; align-items: center; justify-content: center; height: 100%; max-width: 48%;">
                ${linkedFaceBUrl ? `<img src="${linkedFaceBUrl}" style="max-width: 100%; max-height: 100%; object-fit: ${linkedObjectFit}; object-position: ${linkedObjectPosition}; ${linkedBorderStyle}" />` : ''}
              </div>
            </div>
          `;
          break;
        }
        case 'faceAImage': {
          // في وضع two_faces_with_designs نستخدم الحاوية المشتركة
          if (currentMode === 'two_faces_with_designs') break;
          const printFaceAUrl = billboard?.installed_image_face_a_url || billboard?.installed_image_url;
          if (printFaceAUrl) {
            const faceABorderStyle = `border: ${element.borderWidth || '3px'} solid ${element.borderColor || '#ccc'}; border-radius: ${borderRadius};`;
            const faceAObjectFit = element.objectFit || 'contain';
            const faceAObjectPosition = element.objectPosition || 'center';
            content = `<img src="${printFaceAUrl}" style="max-width: 100%; max-height: 100%; object-fit: ${faceAObjectFit}; object-position: ${faceAObjectPosition}; ${faceABorderStyle} ${minWidthStyle}" />`;
          }
          break;
        }
        case 'faceBImage': {
          // في وضع two_faces_with_designs نستخدم الحاوية المشتركة
          if (currentMode === 'two_faces_with_designs') break;
          const facesCount = billboard?.Faces_Count || 1;
          if (facesCount > 1 && billboard?.installed_image_face_b_url) {
            const faceBBorderStyle = `border: ${element.borderWidth || '3px'} solid ${element.borderColor || '#ccc'}; border-radius: ${borderRadius};`;
            const faceBObjectFit = element.objectFit || 'contain';
            const faceBObjectPosition = element.objectPosition || 'center';
            content = `<img src="${billboard.installed_image_face_b_url}" style="max-width: 100%; max-height: 100%; object-fit: ${faceBObjectFit}; object-position: ${faceBObjectPosition}; ${faceBBorderStyle} ${minWidthStyle}" />`;
          }
          break;
        }
        case 'twoFacesContainer': {
          // حاوية الوجهين مع التصاميم - تجمع الوجه الأمامي والخلفي في حاوية واحدة
          if (currentMode !== 'two_faces_with_designs') break;
          const faceAUrl = billboard?.installed_image_face_a_url || billboard?.installed_image_url;
          const faceBUrl = billboard?.installed_image_face_b_url;
          const containerBorderStyle = `border: ${element.borderWidth || '3px'} solid ${element.borderColor || '#ccc'}; border-radius: ${borderRadius};`;
          const gapValue = element.gap || '20px';
          const containerObjectFit = element.objectFit || 'contain';
          const containerObjectPosition = element.objectPosition || 'center';
          
          content = `
            <div style="display: flex; gap: ${gapValue}; height: 100%; align-items: center; justify-content: center;">
              <div style="flex: 1; display: flex; align-items: center; justify-content: center; height: 100%; max-width: 48%;">
                ${faceAUrl ? `<img src="${faceAUrl}" style="max-width: 100%; max-height: 100%; object-fit: ${containerObjectFit}; object-position: ${containerObjectPosition}; ${containerBorderStyle}" />` : ''}
              </div>
              <div style="flex: 1; display: flex; align-items: center; justify-content: center; height: 100%; max-width: 48%;">
                ${faceBUrl ? `<img src="${faceBUrl}" style="max-width: 100%; max-height: 100%; object-fit: ${containerObjectFit}; object-position: ${containerObjectPosition}; ${containerBorderStyle}" />` : ''}
              </div>
            </div>
          `;
          break;
        }
        default:
          content = '';
      }
      
      if (content) html += `<div style="${style}">${content}</div>`;
    });
    
    return `
      <div class="print-page">
        ${!hideBackground ? `<img class="background" src="${settings?.background_url || '/ipg.svg'}" />` : ''}
        ${html}
        ${generateStatusBadgesHTML(billboard)}
      </div>
    `;
  };

  // دالة الطباعة الذكية - تتعامل مع كل لوحة حسب خصائصها
  const generateSmartBillboardPageHTML = (billboard: any, qrUrl: string, printMode: 'customer' | 'team', smartMode: string) => {
    if (!settings) return '';
    
    const contract = taskDetails?.contract;
    const hasCutout = billboard?.has_cutout === true;
    const hasTwoFaceInstallation = billboard?.installed_image_face_a_url && billboard?.installed_image_face_b_url;
    const hasSingleInstallation = billboard?.installed_image_face_a_url || billboard?.installed_image_url;
    const hasDesignA = billboard?.design_face_a;
    const hasDesignB = billboard?.design_face_b;
    
    // تحديد العناصر المرئية حسب الوضع الذكي
    const getSmartVisibleElements = (): string[] => {
      const baseElements = ['contractNumber', 'adType', 'billboardName', 'size', 'facesCount', 'image', 'locationInfo', 'landmarkInfo', 'qrCode'];
      const teamOnlyElements = printMode === 'team' ? ['printType'] : [];
      const sharedElements = ['installationDate'];
      
      let elements = [...baseElements, ...sharedElements, ...teamOnlyElements];
      
      // إضافة المجسم إذا كان موجوداً (دائماً يظهر إذا كان موجوداً)
      if (hasCutout && showCutoutsInPrint) {
        elements.push('cutoutImage');
      }
      
      // معالجة حسب الوضع الذكي
      switch (smartMode) {
        case 'two_faces_with_designs':
          if (showDesignsInPrint) elements.push('designs');
          // إضافة صور التركيب للوجهين إذا كان الخيار مفعل أو في الوضع الذكي مع وجود صور
          if (showInstallationImagesInPrint || (useSmartMode && hasTwoFaceInstallation)) {
            elements.push('twoFacesContainer');
          }
          break;
        case 'two_faces':
          // إضافة صور التركيب للوجهين إذا كان الخيار مفعل أو في الوضع الذكي مع وجود صور
          if (showInstallationImagesInPrint || (useSmartMode && hasTwoFaceInstallation)) {
            elements.push('faceAImage', 'faceBImage');
          }
          break;
        case 'single_installation_with_designs':
          if (showDesignsInPrint && (hasDesignA || hasDesignB)) elements.push('designs');
          // إضافة صورة التركيب الواحدة إذا كان الخيار مفعل أو في الوضع الذكي مع وجود صورة
          if (showInstallationImagesInPrint || (useSmartMode && hasSingleInstallation)) {
            elements.push('singleInstallationImage');
          }
          break;
        case 'single_face':
          // إضافة صورة التركيب إذا كان الخيار مفعل أو في الوضع الذكي مع وجود صورة
          if (showInstallationImagesInPrint || (useSmartMode && hasSingleInstallation)) {
            elements.push('faceAImage');
          }
          break;
        case 'with_design':
          if (showDesignsInPrint) elements.push('designs');
          break;
        default:
          if (showDesignsInPrint && (hasDesignA || hasDesignB)) elements.push('designs');
      }
      
      return elements;
    };
    
    const allowedElements = getSmartVisibleElements();
    let html = '';
    
    Object.entries(settings.elements).forEach(([key, baseElement]) => {
      // تطبيق تجاوزات الحالة في الطباعة الذكية
      const element = getElementForPrint(key, billboard);
      if (printMode === 'customer' && key === 'printType') return;
      if (!element.visible || !allowedElements.includes(key)) return;
      
      const getBorderRadius = () => {
        if (element.borderRadiusTopLeft || element.borderRadiusTopRight || 
            element.borderRadiusBottomLeft || element.borderRadiusBottomRight) {
          return `${element.borderRadiusTopRight || '0px'} ${element.borderRadiusTopLeft || '0px'} ${element.borderRadiusBottomLeft || '0px'} ${element.borderRadiusBottomRight || '0px'}`;
        }
        return element.borderRadius || '0';
      };
      
      let style = `position: absolute; font-size: ${element.fontSize || '14px'}; font-weight: ${element.fontWeight || '400'}; color: ${element.color || '#000'}; direction: rtl; unicode-bidi: embed;`;
      if (element.fontFamily && element.fontFamily !== 'inherit') style += ` font-family: ${element.fontFamily};`;
      if (element.width) style += ` width: ${element.width};`;
      if (element.height) style += ` height: ${element.height};`;
      if (element.textAlign) style += ` text-align: ${element.textAlign};`;
      if (element.top) style += ` top: ${element.top};`;
      if (element.left) style += ` left: ${element.left};`;
      if (element.right) style += ` right: ${element.right};`;
      if (element.bottom) style += ` bottom: ${element.bottom};`;
      
      const transforms: string[] = [];
      if (element.left?.includes('%') && element.textAlign === 'center') transforms.push('translateX(-50%)');
      if (element.rotation && element.rotation !== '0') transforms.push(`rotate(${element.rotation}deg)`);
      if (transforms.length > 0) style += ` transform: ${transforms.join(' ')};`;
      
      let content = '';
      const borderRadius = getBorderRadius();
      const minWidthStyle = element.minWidth ? `min-width: ${element.minWidth};` : '';
      
      switch (key) {
        case 'contractNumber':
          content = `عقد رقم: ${contract?.Contract_Number || '---'}`;
          break;
        case 'adType':
          content = `${element.label || 'نوع الإعلان:'} ${contract?.['Ad Type'] || ''}`;
          break;
        case 'billboardName':
          content = billboard?.Billboard_Name || '';
          break;
        case 'size':
          content = billboard?.Size || '';
          break;
        case 'facesCount': {
          const cutoutLabel = hasCutout ? 'مجسم - ' : '';
          content = `${cutoutLabel}${formatFacesCountArabic(billboard?.Faces_Count || 1)}`;
          break;
        }
        case 'locationInfo':
          content = `${billboard?.Municipality || ''} - ${billboard?.District || ''}`;
          break;
        case 'landmarkInfo':
          content = billboard?.Nearest_Landmark || '';
          break;
        case 'installationDate':
          // استخدام تاريخ التركيب الخاص بكل لوحة إذا وجد
          const smartBillboardInstallDate = billboard?.installation_date;
          content = smartBillboardInstallDate 
            ? `تاريخ التركيب: ${new Date(smartBillboardInstallDate).toLocaleDateString('en-GB')}`
            : 'لم يتم التركيب';
          break;
        case 'printType':
          content = printMode === 'team' ? (billboard?.team_name || selectedTask?.team_name || 'فريق التركيب') : 'نسخة العميل';
          break;
        case 'image': {
          const imgUrl = normalizeGoogleImageUrl(billboard?.installed_image_url || billboard?.Image_URL) || '/placeholder.svg';
          const borderStyle = `border: ${element.borderWidth || '2px'} solid ${element.borderColor || '#000'}; border-radius: ${borderRadius};`;
          const objectFit = element.objectFit || 'cover';
          const objectPosition = element.objectPosition || 'center';
          content = `<img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: ${objectFit}; object-position: ${objectPosition}; ${borderStyle} ${minWidthStyle}" />`;
          break;
        }
        case 'qrCode':
          if (qrUrl) content = `<img src="${qrUrl}" style="width: 100%; height: 100%; object-fit: contain; ${minWidthStyle}" />`;
          break;
        case 'designs': {
          const designA = billboard?.design_face_a;
          const designB = billboard?.design_face_b;
          const designBorderStyle = `border: ${element.borderWidth || '1px'} solid ${element.borderColor || '#ddd'}; border-radius: ${borderRadius};`;
          const designObjectFit = element.objectFit || 'contain';
          const designObjectPosition = element.objectPosition || 'center';
          // إذا كان هناك تصميم واحد فقط، نعرضه بعرض كامل
          if (designA && !designB) {
            content = `
              <div style="display: flex; height: 100%; align-items: center; justify-content: center;">
                <img src="${designA}" style="max-width: 100%; max-height: 100%; object-fit: ${designObjectFit}; object-position: ${designObjectPosition}; ${designBorderStyle} ${minWidthStyle}" />
              </div>
            `;
          } else {
            content = `
              <div style="display: flex; gap: ${element.gap || '12px'}; height: 100%; align-items: center; justify-content: center;">
                <div style="flex: 1; display: flex; align-items: center; justify-content: center; height: 100%;">
                  ${designA ? `<img src="${designA}" style="max-width: 100%; max-height: 100%; object-fit: ${designObjectFit}; object-position: ${designObjectPosition}; ${designBorderStyle} ${minWidthStyle}" />` : ''}
                </div>
                <div style="flex: 1; display: flex; align-items: center; justify-content: center; height: 100%;">
                  ${designB ? `<img src="${designB}" style="max-width: 100%; max-height: 100%; object-fit: ${designObjectFit}; object-position: ${designObjectPosition}; ${designBorderStyle} ${minWidthStyle}" />` : ''}
                </div>
              </div>
            `;
          }
          break;
        }
        case 'cutoutImage':
          if (billboard?.cutout_image_url) {
            const cutoutBorderStyle = `border: ${element.borderWidth || '2px'} solid ${element.borderColor || '#000'}; border-radius: ${borderRadius};`;
            const cutoutObjectFit = element.objectFit || 'contain';
            const cutoutObjectPosition = element.objectPosition || 'center';
            content = `<img src="${billboard.cutout_image_url}" style="max-width: 100%; max-height: 100%; object-fit: ${cutoutObjectFit}; object-position: ${cutoutObjectPosition}; ${cutoutBorderStyle} ${minWidthStyle}" />`;
          }
          break;
        case 'singleInstallationImage': {
          const singleInstallUrl = billboard?.installed_image_face_a_url || billboard?.installed_image_url;
          if (singleInstallUrl) {
            const singleBorderStyle = `border: ${element.borderWidth || '3px'} solid ${element.borderColor || '#ccc'}; border-radius: ${borderRadius};`;
            const singleObjectFit = element.objectFit || 'cover';
            const singleObjectPosition = element.objectPosition || 'center';
            content = `<img src="${singleInstallUrl}" style="width: 100%; height: 100%; object-fit: ${singleObjectFit}; object-position: ${singleObjectPosition}; ${singleBorderStyle} ${minWidthStyle}" />`;
          }
          break;
        }
        case 'linkedInstallationImages': {
          const linkedFaceAUrl = billboard?.installed_image_face_a_url || billboard?.installed_image_url;
          const linkedFaceBUrl = billboard?.installed_image_face_b_url;
          const linkedBorderStyle = `border: ${element.borderWidth || '3px'} solid ${element.borderColor || '#ccc'}; border-radius: ${borderRadius};`;
          const linkedGapValue = element.gap || '12px';
          const linkedObjectFit = element.objectFit || 'cover';
          const linkedObjectPosition = element.objectPosition || 'center';
          
          content = `
            <div style="display: flex; gap: ${linkedGapValue}; height: 100%; align-items: center; justify-content: center;">
              <div style="flex: 1; display: flex; align-items: center; justify-content: center; height: 100%; max-width: 48%;">
                ${linkedFaceAUrl ? `<img src="${linkedFaceAUrl}" style="width: 100%; height: 100%; object-fit: ${linkedObjectFit}; object-position: ${linkedObjectPosition}; ${linkedBorderStyle}" />` : ''}
              </div>
              <div style="flex: 1; display: flex; align-items: center; justify-content: center; height: 100%; max-width: 48%;">
                ${linkedFaceBUrl ? `<img src="${linkedFaceBUrl}" style="width: 100%; height: 100%; object-fit: ${linkedObjectFit}; object-position: ${linkedObjectPosition}; ${linkedBorderStyle}" />` : ''}
              </div>
            </div>
          `;
          break;
        }
        case 'faceAImage': {
          if (smartMode === 'two_faces_with_designs') break;
          const printFaceAUrl = billboard?.installed_image_face_a_url || billboard?.installed_image_url;
          if (printFaceAUrl) {
            const faceABorderStyle = `border: ${element.borderWidth || '3px'} solid ${element.borderColor || '#ccc'}; border-radius: ${borderRadius};`;
            const faceAObjectFit = element.objectFit || 'cover';
            const faceAObjectPosition = element.objectPosition || 'center';
            content = `<img src="${printFaceAUrl}" style="width: 100%; height: 100%; object-fit: ${faceAObjectFit}; object-position: ${faceAObjectPosition}; ${faceABorderStyle} ${minWidthStyle}" />`;
          }
          break;
        }
        case 'faceBImage': {
          if (smartMode === 'two_faces_with_designs') break;
          if (billboard?.installed_image_face_b_url) {
            const faceBBorderStyle = `border: ${element.borderWidth || '3px'} solid ${element.borderColor || '#ccc'}; border-radius: ${borderRadius};`;
            const faceBObjectFit = element.objectFit || 'cover';
            const faceBObjectPosition = element.objectPosition || 'center';
            content = `<img src="${billboard.installed_image_face_b_url}" style="width: 100%; height: 100%; object-fit: ${faceBObjectFit}; object-position: ${faceBObjectPosition}; ${faceBBorderStyle} ${minWidthStyle}" />`;
          }
          break;
        }
        case 'twoFacesContainer': {
          if (smartMode !== 'two_faces_with_designs') break;
          const faceAUrl = billboard?.installed_image_face_a_url || billboard?.installed_image_url;
          const faceBUrl = billboard?.installed_image_face_b_url;
          const containerBorderStyle = `border: ${element.borderWidth || '3px'} solid ${element.borderColor || '#ccc'}; border-radius: ${borderRadius};`;
          const gapValue = element.gap || '20px';
          const containerObjectFit = element.objectFit || 'cover';
          const containerObjectPosition = element.objectPosition || 'center';
          
          content = `
            <div style="display: flex; gap: ${gapValue}; height: 100%; align-items: center; justify-content: center;">
              <div style="flex: 1; display: flex; align-items: center; justify-content: center; height: 100%; max-width: 48%;">
                ${faceAUrl ? `<img src="${faceAUrl}" style="width: 100%; height: 100%; object-fit: ${containerObjectFit}; object-position: ${containerObjectPosition}; ${containerBorderStyle}" />` : ''}
              </div>
              <div style="flex: 1; display: flex; align-items: center; justify-content: center; height: 100%; max-width: 48%;">
                ${faceBUrl ? `<img src="${faceBUrl}" style="width: 100%; height: 100%; object-fit: ${containerObjectFit}; object-position: ${containerObjectPosition}; ${containerBorderStyle}" />` : ''}
              </div>
            </div>
          `;
          break;
        }
        default:
          content = '';
      }
      
      if (content) html += `<div style="${style}">${content}</div>`;
    });
    
    return `
      <div class="print-page">
        ${!hideBackground ? `<img class="background" src="${settings?.background_url || '/ipg.svg'}" />` : ''}
        ${html}
        ${generateStatusBadgesHTML(billboard)}
      </div>
    `;
  };

  const toggleBillboardSelection = (billboardId: number) => {
    setSelectedBillboardsForPrint(prev => 
      prev.includes(billboardId) 
        ? prev.filter(id => id !== billboardId)
        : [...prev, billboardId]
    );
  };

  const selectAllBillboards = () => {
    if (!taskDetails?.billboards) return;
    let billboards = taskDetails.billboards;
    
    // Filter by team if specific team selected
    if (selectedTeamForPrint !== 'all' && selectedTask) {
      // For now, filter based on current task's team
      // In a full implementation, you'd fetch billboards by team
    }
    
    setSelectedBillboardsForPrint(billboards.map(bb => bb.ID));
  };

  const deselectAllBillboards = () => {
    setSelectedBillboardsForPrint([]);
  };

  // Get visible elements based on current mode and preview target
  const getVisibleElements = (overrideMode?: string) => {
    // Base elements that show for both customer and team
    const baseElements = ['contractNumber', 'adType', 'billboardName', 'size', 'facesCount', 'image', 'locationInfo', 'landmarkInfo', 'qrCode'];
    
    // Team-specific elements (printType فقط للفريق، installationDate للجميع)
    const teamOnlyElements = ['printType'];
    const sharedElements = ['installationDate'];
    
    // عناصر صور التركيب - متاحة دائماً للتحكم فيها
    const installationImageElements = ['singleInstallationImage', 'linkedInstallationImages'];
    
    // Start with base + shared elements, then add team-only if target is team
    let elements = previewTarget === 'team' 
      ? [...baseElements, ...sharedElements, ...teamOnlyElements, ...installationImageElements] 
      : [...baseElements, ...sharedElements, ...installationImageElements];
    
    // استخدم الوضع المُمَرَّر أو الوضع الحالي
    const modeToUse = overrideMode || currentMode;
    
    switch (modeToUse) {
      case 'with_cutout':
        return [...elements, 'cutoutImage'];
      case 'without_cutout':
        return elements;
      case 'with_design':
        return [...elements, 'designs'];
      case 'without_design':
        return elements.filter(e => e !== 'designs');
      case 'two_faces':
        return [...elements, 'faceAImage', 'faceBImage'];
      case 'two_faces_with_designs':
        // نستخدم حاوية الوجهين المشتركة بدلاً من العناصر المنفصلة
        return [...elements, 'designs', 'twoFacesContainer'];
      case 'single_face':
        // وجه واحد: صورة تركيب واحدة + تصميم واحد
        return [...elements, 'faceAImage'];
      case 'single_installation_with_designs':
        // صورة تركيب واحدة في مكان الصورة الرئيسية + التصاميم تحتها
        return [...elements, 'designs', 'singleInstallationImage'];
      default:
        return [...elements, 'designs'];
    }
  };
  
  // حساب الوضع الذكي للوحة المحددة في المعاينة
  const previewBillboard = taskDetails?.billboards?.[selectedBillboardIndex];
  const smartModeForPreview = useSmartMode && previewBillboard ? getSmartModeForBillboard(previewBillboard) : currentMode;
  
  // استخدم الوضع الذكي في المعاينة إذا كان مفعلاً
  const effectiveMode = useSmartMode ? smartModeForPreview : currentMode;

  const visibleElements = getVisibleElements(effectiveMode);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const rawBillboard = taskDetails?.billboards?.[selectedBillboardIndex];
  
  // محاكاة بيانات اللوحة حسب الحالة المختارة للمعاينة المباشرة
  const currentBillboard = (() => {
    if (!rawBillboard || previewStatusMode === 'none' || previewStatusMode === 'all-statuses') return rawBillboard;
    const sim = { ...rawBillboard } as any;
    if (previewStatusMode === 'no-design') {
      sim.design_face_a = null;
      sim.design_face_b = null;
      sim.installed_image_face_a_url = null;
      sim.installed_image_face_b_url = null;
      sim.installed_image_url = null;
    } else if (previewStatusMode === 'one-design') {
      sim.design_face_a = sim.design_face_a || '/placeholder.svg';
      sim.design_face_b = null;
      sim.installed_image_face_a_url = null;
      sim.installed_image_face_b_url = null;
    } else if (previewStatusMode === 'one-install') {
      sim.design_face_a = sim.design_face_a || '/placeholder.svg';
      sim.design_face_b = sim.design_face_b || '/placeholder.svg';
      sim.installed_image_face_a_url = sim.installed_image_face_a_url || sim.installed_image_url || '/placeholder.svg';
      sim.installed_image_face_b_url = null;
    }
    return sim;
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Printer className="h-8 w-8" />
            إعدادات طباعة اللوحات المنفصلة
          </h1>
          <p className="text-muted-foreground">تخصيص مواقع وأحجام عناصر طباعة اللوحات</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Active Profile Indicator & Selector */}
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg border">
            <FolderOpen className="h-4 w-4 text-primary" />
            <Select
              value={activeProfileId || ''}
              onValueChange={(value) => {
                if (value) {
                  const profile = profiles?.find((p: any) => p.id === value);
                  if (profile) {
                    loadProfile(profile);
                  }
                }
              }}
            >
              <SelectTrigger className="w-[200px] h-9 border-0 bg-transparent">
                <SelectValue placeholder="اختر بروفايل...">
                  {activeProfileId ? (
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{activeProfileName}</span>
                      {hasUnsavedChanges && <span className="text-orange-500 text-xs">(غير محفوظ)</span>}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">اختر بروفايل...</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {profiles?.map((profile: any) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    <span className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4" />
                      {profile.profile_name}
 {profile.is_default && <span className="text-amber-500"></span>}
                      {profile.id === activeProfileId && <Check className="h-3 w-3 text-green-500" />}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Save Changes to Active Profile */}
          {activeProfileId && (
            <Button
              variant={hasUnsavedChanges ? 'default' : 'outline'}
              onClick={() => updateActiveProfileMutation.mutate()}
              disabled={!hasUnsavedChanges || updateActiveProfileMutation.isPending}
              className={hasUnsavedChanges ? 'bg-orange-500 hover:bg-orange-600' : ''}
            >
              {updateActiveProfileMutation.isPending ? (
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 ml-2" />
              )}
              {hasUnsavedChanges ? 'حفظ التعديلات' : 'محفوظ'}
            </Button>
          )}

          {/* Profile Management Dialog */}
          <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" title="إدارة البروفايلات">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  إدارة البروفايلات
                </DialogTitle>
                <DialogDescription>اختر بروفايل لتحميله أو تعديل اسمه أو حذفه</DialogDescription>
              </DialogHeader>
              <ScrollArea className="h-[350px]">
                <div className="space-y-2 p-1">
                  {profiles?.length === 0 && (
                    <div className="text-center py-12">
                      <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                      <p className="text-muted-foreground">لا توجد بروفايلات محفوظة</p>
                      <p className="text-xs text-muted-foreground mt-1">أنشئ بروفايل جديد لحفظ إعداداتك</p>
                    </div>
                  )}
                  {profiles?.map((profile: any) => (
                    <Card 
                      key={profile.id} 
                      className={`cursor-pointer transition-all ${profile.id === activeProfileId ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                    >
                      <CardContent className="p-4">
                        {editingProfileId === profile.id ? (
                          <div className="space-y-3">
                            <div className="space-y-2">
                              <Label className="text-xs">اسم البروفايل</Label>
                              <Input
                                value={editingProfileName}
                                onChange={(e) => setEditingProfileName(e.target.value)}
                                placeholder="اسم البروفايل"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">الوصف</Label>
                              <Input
                                value={editingProfileDescription}
                                onChange={(e) => setEditingProfileDescription(e.target.value)}
                                placeholder="وصف البروفايل"
                              />
                            </div>
                            <div className="flex gap-2 justify-end">
                              <Button size="sm" variant="ghost" onClick={() => setEditingProfileId(null)}>
                                إلغاء
                              </Button>
                              <Button 
                                size="sm" 
                                onClick={() => updateProfileMutation.mutate({ 
                                  id: profile.id, 
                                  name: editingProfileName, 
                                  description: editingProfileDescription 
                                })}
                                disabled={!editingProfileName || updateProfileMutation.isPending}
                              >
                                {updateProfileMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1" onClick={() => loadProfile(profile)}>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{profile.profile_name}</p>
                                {profile.is_default && (
                                  <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded">افتراضي</span>
                                )}
                                {profile.id === activeProfileId && (
                                  <span className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded">نشط</span>
                                )}
                              </div>
                              {profile.description && (
                                <p className="text-sm text-muted-foreground">{profile.description}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(profile.created_at).toLocaleDateString('ar-SA')}
                              </p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button 
                                size="sm" 
                                variant={profile.id === activeProfileId ? 'default' : 'ghost'} 
                                onClick={() => loadProfile(profile)} 
                                title="تحميل البروفايل"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant={profile.is_default ? "default" : "ghost"}
                                className={profile.is_default ? "bg-amber-500 hover:bg-amber-600 text-white" : "text-amber-600 hover:text-amber-700 hover:bg-amber-50"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!profile.is_default) {
                                    setDefaultProfileMutation.mutate(profile.id);
                                  }
                                }}
                                disabled={setDefaultProfileMutation.isPending || profile.is_default}
                                title={profile.is_default ? "البروفايل الافتراضي" : "تعيين كافتراضي"}
                              >
 {profile.is_default ? '' : ''}
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingProfileId(profile.id);
                                  setEditingProfileName(profile.profile_name);
                                  setEditingProfileDescription(profile.description || '');
                                }}
                                title="تعديل الاسم والوصف"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (profile.id === activeProfileId) {
                                    setActiveProfileId(null);
                                    setActiveProfileName('');
                                  }
                                  deleteProfileMutation.mutate(profile.id);
                                }}
                                title="حذف البروفايل"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
              <DialogFooter className="border-t pt-4">
                <Button variant="outline" onClick={() => setShowProfileDialog(false)}>
                  إغلاق
                </Button>
                <Button onClick={() => { setShowProfileDialog(false); setShowSaveProfileDialog(true); }}>
                  <Plus className="h-4 w-4 ml-2" />
                  إنشاء بروفايل جديد
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showSaveProfileDialog} onOpenChange={setShowSaveProfileDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 ml-2" />
                بروفايل جديد
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>حفظ الإعدادات كبروفايل جديد</DialogTitle>
                <DialogDescription>سيتم حفظ جميع الإعدادات الحالية في البروفايل الجديد</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>اسم البروفايل *</Label>
                  <Input
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    placeholder="مثال: إعدادات التركيب الأساسية"
                  />
                </div>
                <div className="space-y-2">
                  <Label>الوصف (اختياري)</Label>
                  <Input
                    value={newProfileDescription}
                    onChange={(e) => setNewProfileDescription(e.target.value)}
                    placeholder="وصف مختصر للإعدادات"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowSaveProfileDialog(false)}>إلغاء</Button>
                <Button 
                  onClick={() => saveProfileMutation.mutate({ name: newProfileName, description: newProfileDescription })}
                  disabled={!newProfileName || saveProfileMutation.isPending}
                >
                  {saveProfileMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Save className="h-4 w-4 ml-2" />}
                  حفظ البروفايل
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FileText className="h-4 w-4 ml-2" />
                جلب مهمة تركيب
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>اختيار مهمة تركيب للمعاينة</DialogTitle>
                <DialogDescription>اختر عقد وفريق لجلب اللوحات</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث برقم العقد أو اسم العميل أو اسم الفريق..."
                    value={taskSearchQuery}
                    onChange={(e) => setTaskSearchQuery(e.target.value)}
                    className="pr-10"
                  />
                </div>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {/* Group tasks by contract */}
                    {(() => {
                      const filtered = installationTasks?.filter(t => {
                        if (!taskSearchQuery) return true;
                        const search = taskSearchQuery.toLowerCase();
                        return (
                          t.contract_id?.toString().includes(search) ||
                          t.customer_name?.toLowerCase().includes(search) ||
                          t.ad_type?.toLowerCase().includes(search) ||
                          t.team_name?.toLowerCase().includes(search)
                        );
                      }) || [];
                      
                      // Group by contract_id
                      const grouped = filtered.reduce((acc, task) => {
                        const key = task.contract_id;
                        if (!acc[key]) {
                          acc[key] = {
                            contract_id: task.contract_id,
                            customer_name: task.customer_name,
                            ad_type: task.ad_type,
                            tasks: []
                          };
                        }
                        acc[key].tasks.push(task);
                        return acc;
                      }, {} as Record<number, { contract_id: number; customer_name: string; ad_type: string; tasks: typeof filtered }>);
                      
                      return Object.values(grouped).map(group => (
                        <Card key={group.contract_id} className="overflow-hidden">
                          <CardHeader className="bg-muted/30 py-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-base">عقد رقم: {group.contract_id}</CardTitle>
                                <CardDescription>{group.customer_name}</CardDescription>
                              </div>
                              <div className="flex items-center gap-2">
                                {group.ad_type && (
                                  <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded">{group.ad_type}</span>
                                )}
                                <span className="text-xs text-muted-foreground">{group.tasks.length} فريق</span>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-2 space-y-2">
                            {/* Option to load all teams for this contract */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full justify-start gap-2 border-dashed"
                              onClick={() => {
                                // Select first task but mark it as "all teams"
                                const firstTask = group.tasks[0];
                                setSelectedTask({
                                  ...firstTask,
                                  team_name: 'جميع الفرق',
                                  _loadAllTeams: true,
                                  _allTaskIds: group.tasks.map(t => t.id)
                                } as any);
                                setSelectedBillboardIndex(0);
                                setSelectedBillboardsForPrint([]);
                                setShowTaskDialog(false);
                              }}
                            >
                              <Users className="h-4 w-4" />
                              جلب جميع اللوحات ({group.tasks.length} فريق)
                            </Button>
                            
                            {/* Individual teams */}
                            {group.tasks.map(task => (
                              <div
                                key={task.id}
                                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                                onClick={() => selectTask(task)}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Wrench className="h-4 w-4 text-primary" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm">{task.team_name || 'بدون فريق'}</p>
                                    <p className="text-xs text-muted-foreground">الحالة: {task.status}</p>
                                  </div>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(task.created_at).toLocaleDateString('ar-SA')}
                                </p>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      ));
                    })()}
                  </div>
                </ScrollArea>
              </div>
            </DialogContent>
          </Dialog>

          {/* Bulk Print Dialog */}
          <Dialog open={showBulkPrintDialog} onOpenChange={setShowBulkPrintDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={!selectedTask || !taskDetails?.billboards?.length}>
                <Printer className="h-4 w-4 ml-2" />
                طباعة اللوحات
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-lg font-bold">
                    <div className="p-1.5 bg-primary/20 rounded-lg">
                      <Printer className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-base">
                      {modeFromUrl === 'removal' ? 'إزالة' : 'تركيب'} - عقد #{taskDetails?.contract?.Contract_Number || '---'} - {selectedTask?.customer_name || ''} - {selectedTask?.ad_type || ''} - {selectedBillboardsForPrint.length}/{taskDetails?.billboards?.length || 0} لوحة
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm font-normal text-muted-foreground mr-9">
                    {bulkPrintMode === 'team' && (
                      <span className="bg-primary/20 text-primary text-xs px-2 py-1 rounded-full">نسخة الفريق</span>
                    )}
                    {bulkPrintMode === 'customer' && (
                      <span className="bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs px-2 py-1 rounded-full">نسخة العميل</span>
                    )}
                    {bulkPrintMode === 'both' && (
                      <span className="bg-green-500/20 text-green-600 dark:text-green-400 text-xs px-2 py-1 rounded-full">كلا النسختين</span>
                    )}
                  </div>
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* الوضع الذكي التلقائي */}
                <div className="p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold flex items-center gap-2">
                      <svg className="h-5 w-5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Z" />
                        <path d="m9 12 2 2 4-4" />
                      </svg>
                      <span className="text-green-700 dark:text-green-400">الوضع الذكي التلقائي</span>
                    </Label>
                    <Switch
                      id="smartMode"
                      checked={useSmartMode}
                      onCheckedChange={setUseSmartMode}
                    />
                  </div>
                  {useSmartMode && (
                    <p className="text-xs text-green-700 dark:text-green-400 bg-green-500/10 rounded-lg p-2">
                      سيتم تحديد وضع الطباعة المناسب لكل لوحة تلقائياً بناءً على:
                      <span className="block mt-1">• اللوحات ذات الوجهين ← وضع وجهين</span>
                      <span className="block">• اللوحات بوجه واحد ← وضع وجه واحد</span>
                      <span className="block">• المجسمات ← تظهر دائماً إذا كانت موجودة</span>
                      <span className="block">• صور التركيب ← تظهر تلقائياً إذا كانت موجودة (1 أو 2)</span>
                    </p>
                  )}
                </div>

                {/* خيارات الطباعة */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* نوع النسخة */}
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
                    
                    {/* اختيار الفريق وتحديد اللوحات حسب الفريق */}
                    {bulkPrintMode === 'team' && taskDetails?.teamsWithTasks && taskDetails.teamsWithTasks.length > 0 && (
                      <div className="pt-2 border-t space-y-2">
                        <Label className="text-xs text-muted-foreground">تحديد حسب الفريق ({taskDetails.teamsWithTasks.length} فرق)</Label>
                        <Select
                          value={selectedTeamForPrint}
                          onValueChange={(value) => {
                            setSelectedTeamForPrint(value);
                            // تحديد جميع اللوحات حسب الفريق المحدد
                            if (value === 'all') {
                              selectAllBillboards();
                            } else if (taskDetails?.billboards && taskDetails?.installationItems && taskDetails?.teamsWithTasks) {
                              // البحث عن الفريق المحدد
                              const selectedTeam = taskDetails.teamsWithTasks.find(t => t.id === value);
                              if (selectedTeam && selectedTeam.taskIds) {
                                // جلب اللوحات المرتبطة بمهام هذا الفريق
                                const teamBillboardIds = taskDetails.installationItems
                                  .filter(item => selectedTeam.taskIds.includes(item.task_id))
                                  .map(item => item.billboard_id);
                                
                                // تحديد جميع لوحات الفريق
                                const billboardsToSelect = taskDetails.billboards
                                  .filter(bb => teamBillboardIds.includes(bb.ID))
                                  .map(bb => bb.ID);
                                
                                setSelectedBillboardsForPrint(billboardsToSelect);
                                toast.success(`تم تحديد ${billboardsToSelect.length} لوحة للفريق ${selectedTeam.team_name}`);
                              }
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="اختر الفريق" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">جميع الفرق ({taskDetails?.billboards?.length || 0} لوحة)</SelectItem>
                            {taskDetails.teamsWithTasks.map(team => {
                              // حساب عدد لوحات كل فريق
                              const teamBillboardsCount = taskDetails.installationItems
                                ?.filter(item => team.taskIds?.includes(item.task_id))
                                .length || 0;
                              return (
                                <SelectItem key={team.id} value={team.id}>
                                  {team.team_name} ({teamBillboardsCount} لوحة)
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        {selectedTeamForPrint !== 'all' && (
                          <p className="text-[10px] text-green-600 font-medium">
 تم تحديد لوحات الفريق تلقائياً
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* خيارات العرض */}
                  <div className="p-4 bg-muted/50 rounded-xl border space-y-3">
                    <Label className="text-sm font-bold flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      إظهار العناصر
                    </Label>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="showDesigns"
                          checked={showDesignsInPrint}
                          onCheckedChange={(checked) => setShowDesignsInPrint(checked as boolean)}
                        />
                        <Label htmlFor="showDesigns" className="text-xs cursor-pointer">التصاميم</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="showCutouts"
                          checked={showCutoutsInPrint}
                          onCheckedChange={(checked) => setShowCutoutsInPrint(checked as boolean)}
                        />
                        <Label htmlFor="showCutouts" className="text-xs cursor-pointer">المجسمات</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="showInstallationImages"
                          checked={showInstallationImagesInPrint}
                          onCheckedChange={(checked) => setShowInstallationImagesInPrint(checked as boolean)}
                        />
                        <Label htmlFor="showInstallationImages" className="text-xs cursor-pointer">صور التركيب</Label>
                      </div>
                    </div>
                  </div>

                  {/* خيارات إضافية */}
                  <div className="p-4 bg-muted/50 rounded-xl border space-y-3">
                    <Label className="text-sm font-bold flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      إعدادات
                    </Label>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="hideBackgroundBulk"
                          checked={hideBackground}
                          onCheckedChange={(checked) => setHideBackground(checked as boolean)}
                        />
                        <Label htmlFor="hideBackgroundBulk" className="text-xs cursor-pointer">إخفاء الخلفية</Label>
                      </div>
                      
                      {/* اختيار البروفايل */}
                      {profiles && profiles.length > 0 && (
                        <div className="pt-2 border-t space-y-1">
                          <Label className="text-xs text-muted-foreground">البروفايل</Label>
                          <Select
                            value=""
                            onValueChange={(profileId) => {
                              const profile = profiles.find(p => p.id === profileId);
                              if (profile) loadProfile(profile);
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
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
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* اختيار وضع يدوي (عند إيقاف الوضع الذكي) */}
                {!useSmartMode && (
                  <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/30 space-y-3">
                    <Label className="text-sm font-bold flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <Layers className="h-4 w-4" />
                      وضع الطباعة اليدوي
                    </Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {Object.entries(PRINT_MODES).map(([key, label]) => (
                        <Button
                          key={key}
                          variant={currentMode === key ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentMode(key)}
                          className="text-xs"
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* أدوات التحديد */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAllBillboards}>
                      <Check className="h-4 w-4 ml-1" />
                      تحديد الكل
                    </Button>
                    <Button variant="outline" size="sm" onClick={deselectAllBillboards}>
                      إلغاء التحديد
                    </Button>
                    {/* تحديد حسب نوع اللوحة */}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        if (!taskDetails?.billboards) return;
                        const twoFacesBillboards = taskDetails.billboards
                          .filter(bb => bb.installed_image_face_a_url && bb.installed_image_face_b_url)
                          .map(bb => bb.ID);
                        setSelectedBillboardsForPrint(twoFacesBillboards);
                      }}
                    >
                      تحديد الوجهين فقط
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        if (!taskDetails?.billboards) return;
                        const withDesigns = taskDetails.billboards
                          .filter(bb => bb.design_face_a)
                          .map(bb => bb.ID);
                        setSelectedBillboardsForPrint(withDesigns);
                      }}
                    >
                      مع تصاميم فقط
                    </Button>
                  </div>
                  <span className="text-sm font-medium">
                    المحدد: <span className="text-primary font-bold">{selectedBillboardsForPrint.length}</span> من {taskDetails?.billboards?.length || 0}
                  </span>
                </div>

                {/* شبكة اللوحات مع الصور */}
                <ScrollArea className="h-[350px] border rounded-xl p-3 bg-card">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {taskDetails?.billboards?.map(bb => {
                      const isSelected = selectedBillboardsForPrint.includes(bb.ID);
                      const mainImage = bb.installed_image_face_a_url || bb.installed_image_url || bb.Image_URL;
                      const hasInstallation = bb.installed_image_face_a_url || bb.installed_image_url;
                      const hasTwoFaces = bb.installed_image_face_a_url && bb.installed_image_face_b_url;
                      const hasDesign = bb.design_face_a;
                      const hasCutout = bb.has_cutout === true;
                      
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
                          {/* صورة اللوحة */}
                          <div className="aspect-[4/3] bg-muted/30 relative">
                            {mainImage ? (
                              <img 
                                src={mainImage} 
                                alt={bb.Billboard_Name || `لوحة ${bb.ID}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Image className="h-8 w-8 text-muted-foreground/50" />
                              </div>
                            )}
                            
                            {/* شارات الحالة */}
                            <div className="absolute top-2 right-2 flex flex-col gap-1">
                              {hasTwoFaces && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/90 text-white font-medium">
                                  وجهين
                                </span>
                              )}
                              {!hasTwoFaces && hasInstallation && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/90 text-white font-medium">
                                  مركبة
                                </span>
                              )}
                              {hasCutout && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/90 text-white font-medium">
                                  مجسم
                                </span>
                              )}
                            </div>
                            
                            {/* مؤشر التحديد */}
                            <div className={`absolute top-2 left-2 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                              isSelected 
                                ? 'border-primary bg-primary' 
                                : 'border-white/80 bg-white/50'
                            }`}>
                              {isSelected && <Check className="h-4 w-4 text-primary-foreground" />}
                            </div>
                          </div>
                          
                          {/* معلومات اللوحة */}
                          <div className={`p-2 space-y-1 ${isSelected ? 'bg-primary/10' : 'bg-card'}`}>
                            <p className="font-medium text-xs truncate">{bb.Billboard_Name || `لوحة ${bb.ID}`}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-primary">{bb.Size}</span>
                              <span className="text-[10px] text-muted-foreground truncate max-w-[50%]">{bb.Municipality}</span>
                            </div>
                            {hasDesign && (
                              <div className="flex items-center gap-1 text-[10px] text-green-600">
                                <Check className="h-3 w-3" />
                                <span>تصميم مرفق</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>

                {/* ملخص الطباعة */}
                <div className="p-3 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/20">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-bold text-primary">ملخص الطباعة:</span>
                    {useSmartMode ? (
                      <span className="bg-green-500/20 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="m9 12 2 2 4-4" />
                        </svg>
                        وضع ذكي
                      </span>
                    ) : (
                      <span>الوضع: <span className="text-primary font-medium">{PRINT_MODES[currentMode as keyof typeof PRINT_MODES] || currentMode}</span></span>
                    )}
                    <span className="text-muted-foreground">•</span>
                    <span>النسخة: <span className="font-medium">{bulkPrintMode === 'customer' ? 'عميل' : bulkPrintMode === 'team' ? 'فريق' : 'كلاهما'}</span></span>
                    <span className="text-muted-foreground">•</span>
                    <span>اللوحات: <span className="text-primary font-bold">{selectedBillboardsForPrint.length}</span></span>
                    {showDesignsInPrint && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">+ تصاميم</span>
                      </>
                    )}
                    {showCutoutsInPrint && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">+ مجسمات</span>
                      </>
                    )}
                    {hideBackground && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-amber-600 text-xs">بدون خلفية</span>
                      </>
                    )}
                  </div>
                </div>

                {/* أزرار التحكم */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button variant="outline" onClick={() => setShowBulkPrintDialog(false)} className="flex-1">
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
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={handlePrintPreview}>
            <Eye className="h-4 w-4 ml-2" />
            طباعة المعاينة
          </Button>
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 ml-2" />
            إعادة تعيين
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Save className="h-4 w-4 ml-2" />}
            حفظ الإعدادات
          </Button>
          <Button 
            variant="secondary" 
            onClick={handleApplyToAll} 
            disabled={applyToAllMutation.isPending}
          >
            {applyToAllMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <LayoutGrid className="h-4 w-4 ml-2" />}
            تطبيق على جميع الأوضاع
          </Button>
        </div>
      </div>

      {/* Mode Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5" />
            وضع الطباعة
          </CardTitle>
          <CardDescription>كل وضع له إعدادات منفصلة محفوظة</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {Object.entries(PRINT_MODES).map(([key, label]) => (
              <Button
                key={key}
                variant={currentMode === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleModeChange(key)}
                className="gap-2"
              >
                {key === 'with_cutout' && <Layers className="h-4 w-4" />}
                {key === 'without_cutout' && <Square className="h-4 w-4" />}
                {key === 'with_design' && <Image className="h-4 w-4" />}
                {key === 'without_design' && <ImageOff className="h-4 w-4" />}
                {key === 'two_faces' && <LayoutGrid className="h-4 w-4" />}
                {key === 'two_faces_with_designs' && <Layers className="h-4 w-4" />}
                {key === 'default' && <Settings className="h-4 w-4" />}
                {label}
              </Button>
            ))}
          </div>
          
          {/* Preview Target Selector */}
          <div className="flex items-center gap-4 pt-2 border-t">
            <Label className="font-medium">نوع المعاينة:</Label>
            <div className="flex gap-2">
              <Button
                variant={previewTarget === 'customer' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreviewTarget('customer')}
                className="gap-2"
              >
                <Users className="h-4 w-4" />
                للزبون
              </Button>
              <Button
                variant={previewTarget === 'team' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreviewTarget('team')}
                className="gap-2"
              >
                <Wrench className="h-4 w-4" />
                لفريق التركيب
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Task Info */}
      {selectedTask && taskDetails && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="space-y-1">
                <p className="font-bold">عقد رقم: {taskDetails.contract?.Contract_Number}</p>
                <p className="text-sm text-muted-foreground">العميل: {taskDetails.contract?.['Customer Name']}</p>
                <div className="flex items-center gap-2">
                  <span className="bg-primary/20 text-primary text-xs px-2 py-1 rounded flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {selectedTask.team_name || 'بدون فريق'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {taskDetails.billboards?.length || 0} لوحة
                  </span>
                  {/* مؤشر الوضع الذكي المُكتشف للوحة المحددة */}
                  {useSmartMode && previewBillboard && (
                    <span className="bg-green-500/20 text-green-700 dark:text-green-400 text-xs px-2 py-1 rounded flex items-center gap-1">
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Z" />
                        <path d="m9 12 2 2 4-4" />
                      </svg>
                      {PRINT_MODES[effectiveMode as keyof typeof PRINT_MODES] || effectiveMode}
                    </span>
                  )}
                </div>
              </div>
              {taskDetails.billboards && taskDetails.billboards.length > 1 && (
                <div className="flex items-center gap-2">
                  <Label>اللوحة:</Label>
                  <Select
                    value={selectedBillboardIndex.toString()}
                    onValueChange={(v) => setSelectedBillboardIndex(parseInt(v))}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {taskDetails.billboards.map((bb, idx) => {
                        // أضف أيقونة تُظهر نوع اللوحة
                        const hasTwoFaces = bb.installed_image_face_a_url && bb.installed_image_face_b_url;
                        const hasSingleInstallation = bb.installed_image_face_a_url || bb.installed_image_url;
                        const hasDesign = bb.design_face_a || bb.design_face_b;
                        return (
                          <SelectItem key={bb.ID} value={idx.toString()}>
                            <span className="flex items-center gap-2">
                              {bb.Billboard_Name || `لوحة ${bb.ID}`}
                              {hasTwoFaces && <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded">وجهين</span>}
                              {!hasTwoFaces && hasSingleInstallation && <span className="text-[10px] bg-amber-100 text-amber-700 px-1 rounded">مركبة</span>}
                              {hasDesign && <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded">تصميم</span>}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={() => setSelectedTask(null)}>
                إلغاء التحديد
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings Panel */}
        <div className="space-y-4">
          <Tabs defaultValue="elements">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="elements">العناصر</TabsTrigger>
              <TabsTrigger value="status">الحالة</TabsTrigger>
              <TabsTrigger value="background">الخلفية</TabsTrigger>
              <TabsTrigger value="fonts">الخطوط</TabsTrigger>
            </TabsList>

            <TabsContent value="elements" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    عناصر الطباعة
                  </CardTitle>
                  <CardDescription>
                    {activeEditingStatus 
 ? `️ تحرير حالة: ${STATUS_OVERRIDE_LABELS[activeEditingStatus].icon} ${STATUS_OVERRIDE_LABELS[activeEditingStatus].label} — التغييرات تُحفظ كتجاوز`
                      : `اختر عنصراً لتعديل إعداداته - وضع: ${PRINT_MODES[currentMode as keyof typeof PRINT_MODES]}`
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-3">
                      {Object.entries(ELEMENT_LABELS)
                        .filter(([key]) => visibleElements.includes(key))
                        .map(([key, label]) => {
                        // الحصول على القيم الفعالة (مع تجاوزات الحالة إن وجدت)
                        const el = activeEditingStatus 
                          ? getEffectiveElement(key, activeEditingStatus)
                          : (settings?.elements[key] || DEFAULT_ELEMENTS[key]);
                        const hasStatusOverride = activeEditingStatus && settings?.statusOverrides?.[activeEditingStatus]?.[key];
                        return (
                        <Card
                          key={key}
                          className={`cursor-pointer transition-all ${selectedElement === key ? 'ring-2 ring-primary' : 'hover:bg-muted/50'}`}
                          onClick={() => setSelectedElement(key)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Switch
                                  checked={settings?.elements[key]?.visible ?? true}
                                  onCheckedChange={(checked) => updateElement(key, 'visible', checked)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span className="font-medium">{label}</span>
                                {/* مؤشر الربط بين الوجهين */}
                                {(key === 'faceAImage' || key === 'faceBImage' || key === 'linkedInstallationImages') && (
                                  <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                    </svg>
                                    {key === 'linkedInstallationImages' ? 'وجهين مربوطين' : 'مرتبط'}
                                  </span>
                                )}
                                {/* مؤشر صورة واحدة */}
                                {key === 'singleInstallationImage' && (
                                  <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                      <circle cx="8.5" cy="8.5" r="1.5" />
                                      <polyline points="21,15 16,10 5,21" />
                                    </svg>
                                    صورة واحدة
                                  </span>
                                )}
                              </div>
                              <Move className="h-4 w-4 text-muted-foreground" />
                            </div>

                            {selectedElement === key && el && (
                              <div className="mt-4 space-y-4 border-t pt-4">
                                {/* مؤشر تحرير الحالة */}
                                {hasStatusOverride && (
                                  <div className="text-xs text-center py-1 px-2 rounded" style={{ background: `${STATUS_OVERRIDE_LABELS[activeEditingStatus!].color}20`, color: STATUS_OVERRIDE_LABELS[activeEditingStatus!].color }}>
 ️ تعديل تجاوز لحالة: {STATUS_OVERRIDE_LABELS[activeEditingStatus!].label}
                                  </div>
                                )}
                                {/* Position with Sliders */}
                                <UnitSliderField
                                  label="من الأعلى (top)"
                                  value={el.top}
                                  defaultUnit="px"
                                  min={0}
                                  max={1200}
                                  step={1}
                                  onValueChange={(v) => updateElement(key, 'top', v)}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                  <UnitSliderField
                                    label="من اليسار (left)"
                                    value={el.left}
                                    defaultUnit="px"
                                    min={0}
                                    max={800}
                                    step={1}
                                    onValueChange={(v) => updateElement(key, 'left', v)}
                                  />
                                  <UnitSliderField
                                    label="من اليمين (right)"
                                    value={el.right}
                                    defaultUnit="px"
                                    min={0}
                                    max={800}
                                    step={1}
                                    onValueChange={(v) => updateElement(key, 'right', v)}
                                  />
                                </div>

                                {/* Size with Sliders */}
                                {(key === 'faceAImage' || key === 'faceBImage' || key === 'linkedInstallationImages') && (
                                  <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                                    <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                    </svg>
                                    <span>{key === 'linkedInstallationImages' ? 'الأبعاد والإطار تُطبق على الوجهين معاً' : 'العرض والارتفاع والإطار مرتبطين - التغييرات تُطبق على الوجهين معاً'}</span>
                                  </div>
                                )}
                                <div className="grid grid-cols-2 gap-4">
                                  <UnitSliderField
                                    label={`العرض${(key === 'faceAImage' || key === 'faceBImage') ? ' (مرتبط)' : ''}`}
                                    value={el.width}
                                    defaultUnit="px"
                                    min={0}
                                    max={800}
                                    step={1}
                                    onValueChange={(v) => updateElement(key, 'width', v)}
                                  />
                                  <UnitSliderField
                                    label={`الارتفاع${(key === 'faceAImage' || key === 'faceBImage') ? ' (مرتبط)' : ''}`}
                                    value={el.height}
                                    defaultUnit="px"
                                    min={0}
                                    max={600}
                                    step={1}
                                    onValueChange={(v) => updateElement(key, 'height', v)}
                                  />
                                </div>

                                {/* Min Width for images - only show for image elements */}
                                {['image', 'designs', 'cutoutImage', 'faceAImage', 'faceBImage', 'qrCode'].includes(key) && (
                                  <UnitSliderField
                                    label="أقل عرض للصورة"
                                    value={el.minWidth || '50px'}
                                    defaultUnit="px"
                                    min={20}
                                    max={400}
                                    step={5}
                                    onValueChange={(v) => updateElement(key, 'minWidth', v)}
                                  />
                                )}

                                {/* Typography with Slider for font size */}
                                <div className="grid grid-cols-2 gap-4">
                                  <UnitSliderField
                                    label="حجم الخط"
                                    value={el.fontSize}
                                    defaultUnit="px"
                                    min={8}
                                    max={60}
                                    step={1}
                                    onValueChange={(v) => updateElement(key, 'fontSize', v)}
                                  />
                                  <div className="space-y-2">
                                    <Label className="text-xs">وزن الخط</Label>
                                    <Select
                                      value={el.fontWeight || '400'}
                                      onValueChange={(v) => updateElement(key, 'fontWeight', v)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="300">خفيف</SelectItem>
                                        <SelectItem value="400">عادي</SelectItem>
                                        <SelectItem value="500">متوسط</SelectItem>
                                        <SelectItem value="600">سميك</SelectItem>
                                        <SelectItem value="700">عريض</SelectItem>
                                        <SelectItem value="bold">عريض جداً</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                {/* Font Family */}
                                <div className="space-y-2">
                                  <Label className="text-xs">نوع الخط</Label>
                                  <Select
                                    value={el.fontFamily || 'inherit'}
                                    onValueChange={(v) => updateElement(key, 'fontFamily', v)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="inherit">الافتراضي</SelectItem>
                                      <SelectItem value="Doran">Doran</SelectItem>
                                      <SelectItem value="Manrope">Manrope</SelectItem>
                                      <SelectItem value="Cairo">Cairo</SelectItem>
                                      <SelectItem value="Tajawal">Tajawal</SelectItem>
                                      <SelectItem value="Arial">Arial</SelectItem>
                                      <SelectItem value="Tahoma">Tahoma</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Label for adType element */}
                                {key === 'adType' && (
                                  <div className="space-y-2">
                                    <Label className="text-xs">عنوان العنصر (label)</Label>
                                    <Input
                                      value={el.label || 'نوع الإعلان:'}
                                      onChange={(e) => updateElement(key, 'label', e.target.value)}
                                      placeholder="نوع الإعلان:"
                                    />
                                  </div>
                                )}

                                {/* Color */}
                                <div className="space-y-2">
                                  <Label className="text-xs">اللون</Label>
                                  <div className="flex gap-2">
                                    <Input
                                      type="color"
                                      value={el.color || '#000000'}
                                      onChange={(e) => updateElement(key, 'color', e.target.value)}
                                      className="w-12 h-10 p-1"
                                    />
                                    <Input
                                      value={el.color || ''}
                                      onChange={(e) => updateElement(key, 'color', e.target.value)}
                                      placeholder="#000000"
                                      className="flex-1"
                                    />
                                  </div>
                                </div>

                                {/* Text Align */}
                                <div className="space-y-2">
                                  <Label className="text-xs">محاذاة النص</Label>
                                  <Select
                                    value={el.textAlign || 'center'}
                                    onValueChange={(v) => updateElement(key, 'textAlign', v)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="right">يمين</SelectItem>
                                      <SelectItem value="center">وسط</SelectItem>
                                      <SelectItem value="left">يسار</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Border (for image elements) */}
                                {['image', 'cutoutImage', 'faceAImage', 'faceBImage', 'designs'].includes(key) && (
                                  <>
                                    <div className="grid grid-cols-2 gap-4">
                                      <UnitSliderField
                                        label="عرض الإطار"
                                        value={el.borderWidth}
                                        defaultUnit="px"
                                        min={0}
                                        max={20}
                                        step={1}
                                        onValueChange={(v) => updateElement(key, 'borderWidth', v)}
                                      />
                                      <div className="space-y-2">
                                        <Label className="text-xs">لون الإطار</Label>
                                        <div className="flex gap-2">
                                          <Input
                                            type="color"
                                            value={el.borderColor || '#000000'}
                                            onChange={(e) => updateElement(key, 'borderColor', e.target.value)}
                                            className="w-12 h-10 p-1"
                                          />
                                          <Input
                                            value={el.borderColor || ''}
                                            onChange={(e) => updateElement(key, 'borderColor', e.target.value)}
                                            className="flex-1"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Border Radius Controls */}
                                    <div className="space-y-3 border-t pt-3">
                                      <Label className="text-xs font-medium">استدارة الحواف</Label>
                                      <UnitSliderField
                                        label="جميع الزوايا"
                                        value={el.borderRadius}
                                        defaultUnit="px"
                                        min={0}
                                        max={50}
                                        step={1}
                                        onValueChange={(v) => {
                                          updateElement(key, 'borderRadius', v);
                                          updateElement(key, 'borderRadiusTopLeft', v);
                                          updateElement(key, 'borderRadiusTopRight', v);
                                          updateElement(key, 'borderRadiusBottomLeft', v);
                                          updateElement(key, 'borderRadiusBottomRight', v);
                                        }}
                                      />
                                      <div className="grid grid-cols-2 gap-3">
                                        <UnitSliderField
                                          label="أعلى يمين"
                                          value={el.borderRadiusTopRight}
                                          defaultUnit="px"
                                          min={0}
                                          max={50}
                                          step={1}
                                          onValueChange={(v) => updateElement(key, 'borderRadiusTopRight', v)}
                                        />
                                        <UnitSliderField
                                          label="أعلى يسار"
                                          value={el.borderRadiusTopLeft}
                                          defaultUnit="px"
                                          min={0}
                                          max={50}
                                          step={1}
                                          onValueChange={(v) => updateElement(key, 'borderRadiusTopLeft', v)}
                                        />
                                        <UnitSliderField
                                          label="أسفل يمين"
                                          value={el.borderRadiusBottomRight}
                                          defaultUnit="px"
                                          min={0}
                                          max={50}
                                          step={1}
                                          onValueChange={(v) => updateElement(key, 'borderRadiusBottomRight', v)}
                                        />
                                        <UnitSliderField
                                          label="أسفل يسار"
                                          value={el.borderRadiusBottomLeft}
                                          defaultUnit="px"
                                          min={0}
                                          max={50}
                                          step={1}
                                          onValueChange={(v) => updateElement(key, 'borderRadiusBottomLeft', v)}
                                        />
                                      </div>
                                    </div>
                                  </>
                                )}

                                {/* Gap for designs element */}
                                {key === 'designs' && (
                                  <UnitSliderField
                                    label="المسافة بين التصاميم"
                                    value={el.gap}
                                    defaultUnit="px"
                                    min={0}
                                    max={100}
                                    step={1}
                                    onValueChange={(v) => updateElement(key, 'gap', v)}
                                  />
                                )}

                                {/* Rotation for image elements */}
                                {['image', 'cutoutImage', 'faceAImage', 'faceBImage', 'designs', 'qrCode'].includes(key) && (
                                  <div className="space-y-2">
                                    <Label className="text-xs">الدوران (درجة)</Label>
                                    <div className="flex items-center gap-4">
                                      <Slider
                                        value={[parseInt(settings.elements[key].rotation || '0')]}
                                        onValueChange={([v]) => updateElement(key, 'rotation', v.toString())}
                                        min={-180}
                                        max={180}
                                        step={1}
                                        className="flex-1"
                                      />
                                      <Input
                                        type="number"
                                        value={settings.elements[key].rotation || '0'}
                                        onChange={(e) => updateElement(key, 'rotation', e.target.value)}
                                        className="w-20"
                                      />
                                      <span className="text-xs text-muted-foreground">°</span>
                                    </div>
                                  </div>
                                )}

                                {/* Image Fit and Position for image elements */}
                                {['image', 'cutoutImage', 'faceAImage', 'faceBImage', 'designs', 'twoFacesContainer'].includes(key) && (
                                  <div className="space-y-4 border-t pt-4">
                                    <Label className="text-sm font-bold flex items-center gap-2">
                                      <ImageIcon className="h-4 w-4" />
                                      محاذاة الصورة
                                    </Label>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <Label className="text-xs">نوع الاحتواء (object-fit)</Label>
                                        <Select
                                          value={el.objectFit || 'cover'}
                                          onValueChange={(v) => updateElement(key, 'objectFit', v)}
                                        >
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="cover">تغطية (cover) - يملأ الإطار</SelectItem>
                                            <SelectItem value="contain">احتواء (contain) - يظهر كامل الصورة</SelectItem>
                                            <SelectItem value="fill">تمديد (fill) - يمدد الصورة</SelectItem>
                                            <SelectItem value="none">بلا تعديل (none)</SelectItem>
                                            <SelectItem value="scale-down">تصغير فقط (scale-down)</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      
                                      <div className="space-y-2">
                                        <Label className="text-xs">موضع الصورة (object-position)</Label>
                                        <Select
                                          value={el.objectPosition || 'center'}
                                          onValueChange={(v) => updateElement(key, 'objectPosition', v)}
                                        >
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="center">وسط (center)</SelectItem>
                                            <SelectItem value="center center">وسط وسط (50% 50%)</SelectItem>
                                            <SelectItem value="top">أعلى</SelectItem>
                                            <SelectItem value="top center">أعلى وسط</SelectItem>
                                            <SelectItem value="bottom">أسفل</SelectItem>
                                            <SelectItem value="bottom center">أسفل وسط</SelectItem>
                                            <SelectItem value="left">يسار</SelectItem>
                                            <SelectItem value="right">يمين</SelectItem>
                                            <SelectItem value="top left">أعلى يسار</SelectItem>
                                            <SelectItem value="top right">أعلى يمين</SelectItem>
                                            <SelectItem value="bottom left">أسفل يسار</SelectItem>
                                            <SelectItem value="bottom right">أسفل يمين</SelectItem>
                                            <SelectItem value="25% 25%">25% 25%</SelectItem>
                                            <SelectItem value="75% 75%">75% 75%</SelectItem>
                                            <SelectItem value="50% 25%">50% 25% (وسط أعلى قليلاً)</SelectItem>
                                            <SelectItem value="50% 75%">50% 75% (وسط أسفل قليلاً)</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                    
                                    <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                                      <strong>تغطية:</strong> يملأ الإطار بالكامل (قد يقص أجزاء) | 
                                      <strong> احتواء:</strong> يُظهر الصورة كاملة (قد يترك فراغات) |
                                      <strong> موضع الصورة:</strong> يحدد أي جزء من الصورة يظهر عند القص
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="status" className="space-y-4">
              {/* قسم تخصيص تصميم كل حالة */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Layers className="h-5 w-5" />
                    تخصيص التصميم حسب الحالة
                  </CardTitle>
                  <CardDescription>اختر حالة لتعديل مواضع العناصر (الصورة، التصاميم، إلخ) بشكل مختلف عند حدوثها</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* أزرار اختيار الحالة للتحرير */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">اختر حالة للتعديل:</p>
                    <div className="space-y-2">
                      {(Object.entries(STATUS_OVERRIDE_LABELS) as [StatusOverrideKey, typeof STATUS_OVERRIDE_LABELS[StatusOverrideKey]][]).map(([key, { label, icon, color }]) => {
                        const isActive = previewStatusMode === key;
                        const hasOverrides = settings?.statusOverrides?.[key] && Object.keys(settings.statusOverrides[key]).length > 0;
                        return (
                          <Button
                            key={key}
                            variant={isActive ? 'default' : 'outline'}
                            size="sm"
                            className="w-full justify-between h-10 text-sm"
                            onClick={() => setPreviewStatusMode(isActive ? 'none' : key)}
                          >
                            <span className="flex items-center gap-2">
                              <span style={{ 
                                background: color, color: '#fff', padding: '2px 8px', 
                                borderRadius: '12px', fontSize: '11px', fontWeight: '600' 
                              }}>{icon} {label}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              {hasOverrides && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">مُخصص</span>
                              )}
 {isActive ? '️ تحرير' : ' معاينة'}
                            </span>
                          </Button>
                        );
                      })}
                      
                      <Button
                        variant={previewStatusMode === 'all-statuses' ? 'default' : 'outline'}
                        size="sm"
                        className="w-full h-10 text-sm"
                        onClick={() => setPreviewStatusMode(previewStatusMode === 'all-statuses' ? 'none' : 'all-statuses')}
                      >
 عرض جميع الشارات معاً
                      </Button>
                    </div>
                    
                    {previewStatusMode !== 'none' && previewStatusMode !== 'all-statuses' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => setPreviewStatusMode('none')}
                      >
                        ◀ العودة للوضع الأساسي
                      </Button>
                    )}
                  </div>

                  {/* مؤشر وضع التحرير */}
                  {activeEditingStatus && (
                    <div className="p-3 rounded-lg border-2 border-dashed" style={{ borderColor: STATUS_OVERRIDE_LABELS[activeEditingStatus].color, background: `${STATUS_OVERRIDE_LABELS[activeEditingStatus].color}10` }}>
                      <p className="text-sm font-bold text-center mb-1" style={{ color: STATUS_OVERRIDE_LABELS[activeEditingStatus].color }}>
 ️ وضع التحرير: {STATUS_OVERRIDE_LABELS[activeEditingStatus].icon} {STATUS_OVERRIDE_LABELS[activeEditingStatus].label}
                      </p>
                      <p className="text-xs text-center text-muted-foreground">
                        أي تغيير تقوم به في تبويب "العناصر" سيُحفظ كتجاوز لهذه الحالة فقط
                      </p>
                      {settings?.statusOverrides?.[activeEditingStatus] && Object.keys(settings.statusOverrides[activeEditingStatus]).length > 0 && (
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            عناصر معدلة: {Object.keys(settings.statusOverrides[activeEditingStatus]).length}
                          </span>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs h-6 text-destructive"
                            onClick={() => {
                              setSettings(prev => {
                                if (!prev) return prev;
                                const newOverrides = { ...(prev.statusOverrides || {}) };
                                delete newOverrides[activeEditingStatus];
                                return { ...prev, statusOverrides: newOverrides };
                              });
                              markAsChanged();
                              toast.info('تم حذف تجاوزات هذه الحالة');
                            }}
                          >
                            حذف التجاوزات
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* قسم الشارات */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    شارات الحالة
                  </CardTitle>
                  <CardDescription>إظهار/إخفاء الشارات + تعديل موضعها وحجمها</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="showStatusBadges" className="text-sm font-medium">إظهار شارات الحالة</Label>
                    <Switch
                      id="showStatusBadges"
                      checked={showStatusBadgesInPrint}
                      onCheckedChange={setShowStatusBadgesInPrint}
                    />
                  </div>

                  {showStatusBadgesInPrint && (
                    <div className="space-y-3 border-t pt-3">
                      <p className="text-xs text-muted-foreground font-medium">تفعيل/تعطيل كل شارة:</p>
                      <div className="flex items-center justify-between">
 <span style={{background:'#ef4444',color:'#fff',padding:'2px 8px',borderRadius:'12px',fontSize:'11px',fontWeight:'600'}}> بدون تصميم</span>
                        <Switch checked={showBadgeNoDesign} onCheckedChange={setShowBadgeNoDesign} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span style={{background:'#f59e0b',color:'#fff',padding:'2px 8px',borderRadius:'12px',fontSize:'11px',fontWeight:'600'}}>◐ تصميم واحد</span>
                        <Switch checked={showBadgeOneDesign} onCheckedChange={setShowBadgeOneDesign} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span style={{background:'#3b82f6',color:'#fff',padding:'2px 8px',borderRadius:'12px',fontSize:'11px',fontWeight:'600'}}>① تركيب وجه واحد</span>
                        <Switch checked={showBadgeOneInstall} onCheckedChange={setShowBadgeOneInstall} />
                      </div>
                    </div>
                  )}

                  {showStatusBadgesInPrint && settings && (
                    <div className="space-y-4 border-t pt-4">
                      <div className="space-y-2">
                        <Label className="text-xs">الموضع العلوي (top)</Label>
                        <Input
                          value={settings.elements?.statusBadges?.top || '260px'}
                          onChange={(e) => updateElement('statusBadges', 'top', e.target.value)}
                          className="h-8 text-sm"
                          placeholder="260px"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">الموضع الأفقي (left)</Label>
                        <Input
                          value={settings.elements?.statusBadges?.left || '16%'}
                          onChange={(e) => updateElement('statusBadges', 'left', e.target.value)}
                          className="h-8 text-sm"
                          placeholder="16%"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">حجم الخط</Label>
                        <Input
                          value={settings.elements?.statusBadges?.fontSize || '11px'}
                          onChange={(e) => updateElement('statusBadges', 'fontSize', e.target.value)}
                          className="h-8 text-sm"
                          placeholder="11px"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">العرض</Label>
                        <Input
                          value={settings.elements?.statusBadges?.width || '450px'}
                          onChange={(e) => updateElement('statusBadges', 'width', e.target.value)}
                          className="h-8 text-sm"
                          placeholder="450px"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="background" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Image className="h-5 w-5" />
                    إعدادات الخلفية
                    <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
                      إعدادات عامة لجميع الأوضاع
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Hide Background Toggle */}
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                    <div className="space-y-0.5">
                      <Label className="font-medium">بدون خلفية</Label>
                      <p className="text-xs text-muted-foreground">إخفاء صورة الخلفية عند الطباعة</p>
                    </div>
                    <Switch
                      checked={hideBackground}
                      onCheckedChange={setHideBackground}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>رابط صورة الخلفية</Label>
                    <Input
                      value={settings?.background_url || ''}
                      onChange={(e) => { setSettings(prev => prev ? { ...prev, background_url: e.target.value } : prev); markAsChanged(); }}
                      placeholder="/ipg.svg"
                      disabled={hideBackground}
                    />
                    <p className="text-xs text-muted-foreground">
                      يمكنك استخدام رابط صورة SVG أو PNG. الخلفية الافتراضية: /ipg.svg
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>عرض الخلفية</Label>
                      <Input
                        value={settings?.background_width || '210mm'}
                        onChange={(e) => { setSettings(prev => prev ? { ...prev, background_width: e.target.value } : prev); markAsChanged(); }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>ارتفاع الخلفية</Label>
                      <Input
                        value={settings?.background_height || '297mm'}
                        onChange={(e) => { setSettings(prev => prev ? { ...prev, background_height: e.target.value } : prev); markAsChanged(); }}
                      />
                    </div>
                  </div>

                  {settings?.background_url && (
                    <div className="border rounded-lg p-4 bg-muted/30">
                      <Label className="mb-2 block">معاينة الخلفية</Label>
                      <div className="aspect-[210/297] max-h-[300px] bg-white rounded border overflow-hidden">
                        <img 
                          src={settings.background_url} 
                          alt="Background preview"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                  )}

                  {/* Save Global Background Settings Button */}
                  <Button 
                    onClick={() => saveGlobalSettingsMutation.mutate({
                      background_url: settings?.background_url,
                      background_width: settings?.background_width,
                      background_height: settings?.background_height,
                      primary_font: settings?.primary_font,
                      secondary_font: settings?.secondary_font,
                    })}
                    disabled={saveGlobalSettingsMutation.isPending}
                    className="w-full"
                  >
                    {saveGlobalSettingsMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin ml-2" />
                    ) : (
                      <Save className="h-4 w-4 ml-2" />
                    )}
                    حفظ إعدادات الخلفية والخطوط (لجميع الأوضاع)
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="fonts" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Type className="h-5 w-5" />
                    إعدادات الخطوط
                    <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
                      إعدادات عامة لجميع الأوضاع
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>الخط الرئيسي</Label>
                    <Select
                      value={settings?.primary_font || 'Doran'}
                      onValueChange={(v) => { setSettings(prev => prev ? { ...prev, primary_font: v } : prev); markAsChanged(); }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Doran">Doran</SelectItem>
                        <SelectItem value="Manrope">Manrope</SelectItem>
                        <SelectItem value="Cairo">Cairo</SelectItem>
                        <SelectItem value="Arial">Arial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>الخط الثانوي</Label>
                    <Select
                      value={settings?.secondary_font || 'Manrope'}
                      onValueChange={(v) => { setSettings(prev => prev ? { ...prev, secondary_font: v } : prev); markAsChanged(); }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Doran">Doran</SelectItem>
                        <SelectItem value="Manrope">Manrope</SelectItem>
                        <SelectItem value="Cairo">Cairo</SelectItem>
                        <SelectItem value="Arial">Arial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Save Global Font Settings Button */}
                  <Button 
                    onClick={() => saveGlobalSettingsMutation.mutate({
                      background_url: settings?.background_url,
                      background_width: settings?.background_width,
                      background_height: settings?.background_height,
                      primary_font: settings?.primary_font,
                      secondary_font: settings?.secondary_font,
                    })}
                    disabled={saveGlobalSettingsMutation.isPending}
                    className="w-full"
                  >
                    {saveGlobalSettingsMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin ml-2" />
                    ) : (
                      <Save className="h-4 w-4 ml-2" />
                    )}
                    حفظ إعدادات الخطوط والخلفية (لجميع الأوضاع)
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Preview Panel */}
        <Card className="sticky top-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="h-5 w-5" />
                المعاينة - {PRINT_MODES[currentMode as keyof typeof PRINT_MODES]}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Label className="text-xs">التكبير:</Label>
                <Slider
                  value={[previewScale * 100]}
                  onValueChange={([v]) => setPreviewScale(v / 100)}
                  min={20}
                  max={100}
                  step={5}
                  className="w-24"
                />
                <span className="text-xs text-muted-foreground w-10">{Math.round(previewScale * 100)}%</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <div 
                ref={previewRef}
                className="bg-white border rounded-lg overflow-hidden mx-auto"
                style={{
                  width: `${210 * previewScale}mm`,
                  height: `${297 * previewScale}mm`,
                  position: 'relative',
                }}
              >
                {/* Background */}
                {!hideBackground && (
                  <img
                    src={settings?.background_url || '/ipg.svg'}
                    alt="Background"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                )}

                {/* Elements Preview */}
                {settings && Object.entries(settings.elements)
                  .filter(([key]) => visibleElements.includes(key))
                  .map(([key, baseElement]) => {
                  // تطبيق تجاوزات الحالة في المعاينة
                  const element = activeEditingStatus 
                    ? getEffectiveElement(key, activeEditingStatus) 
                    : baseElement;
                  if (!element.visible) return null;
                  
                  // Helper to get border radius
                  const getBorderRadius = () => {
                    if (element.borderRadiusTopLeft || element.borderRadiusTopRight || 
                        element.borderRadiusBottomLeft || element.borderRadiusBottomRight) {
                      return `${element.borderRadiusTopRight || '0px'} ${element.borderRadiusTopLeft || '0px'} ${element.borderRadiusBottomLeft || '0px'} ${element.borderRadiusBottomRight || '0px'}`;
                    }
                    return element.borderRadius || '0';
                  };
                  
                  const style: React.CSSProperties = {
                    position: 'absolute',
                    fontSize: `calc(${element.fontSize || '14px'} * ${previewScale})`,
                    fontWeight: element.fontWeight || '400',
                    fontFamily: element.fontFamily && element.fontFamily !== 'inherit' ? element.fontFamily : undefined,
                    color: element.color || '#000',
                    width: element.width ? `calc(${element.width} * ${previewScale})` : undefined,
                    height: element.height ? `calc(${element.height} * ${previewScale})` : undefined,
                    textAlign: (element.textAlign as any) || 'right',
                    direction: 'rtl',
                    unicodeBidi: 'embed',
                    border: selectedElement === key ? '2px dashed #3b82f6' : undefined,
                    backgroundColor: selectedElement === key ? 'rgba(59, 130, 246, 0.1)' : undefined,
                    cursor: 'pointer',
                    zIndex: 10,
                  };

                  // Position
                  if (element.top) style.top = `calc(${element.top} * ${previewScale})`;
                  if (element.left) style.left = element.left.includes('%') ? element.left : `calc(${element.left} * ${previewScale})`;
                  if (element.right) style.right = element.right.includes('%') ? element.right : `calc(${element.right} * ${previewScale})`;
                  if (element.bottom) style.bottom = `calc(${element.bottom} * ${previewScale})`;

                  // Transform for centered elements and rotation
                  const transforms: string[] = [];
                  if (element.left?.includes('%') && element.textAlign === 'center') {
                    transforms.push('translateX(-50%)');
                  }
                  if (element.rotation && element.rotation !== '0') {
                    transforms.push(`rotate(${element.rotation}deg)`);
                  }
                  if (transforms.length > 0) {
                    style.transform = transforms.join(' ');
                  }

                  // Get display value based on selected task and preview target
                  const getDisplayValue = () => {
                    switch (key) {
                      case 'contractNumber':
                        return currentBillboard 
                          ? `عقد رقم: ${taskDetails?.contract?.Contract_Number || '---'}`
                          : 'عقد رقم: 1234';
                      case 'adType':
                        const adLabel = settings?.elements?.adType?.label || 'نوع الإعلان:';
                        const adValue = selectedTask?.ad_type || 'إعلان تجاري';
                        return `${adLabel} ${adValue}`;
                      case 'billboardName':
                        return currentBillboard?.Billboard_Name || 'اسم اللوحة الإعلانية';
                      case 'size':
                        return currentBillboard?.Size || '3x4';
                      case 'facesCount':
                        return formatFacesCountArabic(currentBillboard?.Faces_Count || 2);
                      case 'locationInfo':
                        return currentBillboard 
                          ? `${currentBillboard.Municipality || 'البلدية'} - ${currentBillboard.District || 'المنطقة'}`
                          : 'البلدية - المنطقة';
                      case 'landmarkInfo':
                        return currentBillboard?.Nearest_Landmark || 'أقرب معلم: بجوار المركز التجاري';
                      case 'installationDate':
                        // استخدام تاريخ التركيب الخاص بكل لوحة إذا وجد
                        const uiBillboardInstallDate = currentBillboard?.installation_date;
                        return uiBillboardInstallDate 
                          ? `تاريخ التركيب: ${new Date(uiBillboardInstallDate).toLocaleDateString('en-GB')}`
                          : 'لم يتم التركيب';
                      case 'printType':
                        return previewTarget === 'team' 
                          ? (selectedTask?.team_name || 'فريق التركيب') 
                          : 'نسخة العميل';
                      default:
                        return ELEMENT_LABELS[key] || key;
                    }
                  };

                  return (
                    <div
                      key={key}
                      style={style}
                      onClick={() => setSelectedElement(key)}
                      className="transition-all"
                    >
                      {key === 'image' ? (
                        <div 
                          className="flex items-center justify-center h-full overflow-hidden"
                          style={{
                            borderRadius: getBorderRadius(),
                          }}
                        >
                          {currentBillboard?.Image_URL ? (
                            <img 
                              src={currentBillboard.Image_URL} 
                              alt="Billboard" 
                              className="w-full h-full"
                              style={{
                                objectFit: element.objectFit || 'contain',
                                objectPosition: element.objectPosition || 'center',
                                border: `${element.borderWidth || '2px'} solid ${element.borderColor || '#000'}`,
                                borderRadius: getBorderRadius(),
                                minWidth: element.minWidth ? `calc(${element.minWidth} * ${previewScale})` : undefined,
                              }}
                            />
                          ) : (
                            <div 
                              className="bg-muted/30 flex items-center justify-center w-full h-full"
                              style={{
                                border: `${element.borderWidth || '2px'} solid ${element.borderColor || '#000'}`,
                                borderRadius: getBorderRadius(),
                              }}
                            >
                              <Image className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      ) : key === 'qrCode' ? (
                        <div className="bg-white flex items-center justify-center h-full rounded overflow-hidden p-1">
                          {qrCodeUrl ? (
                            <img 
                              src={qrCodeUrl} 
                              alt="QR Code" 
                              className="w-full h-full object-contain"
                              style={{
                                minWidth: element.minWidth ? `calc(${element.minWidth} * ${previewScale})` : undefined,
                              }}
                            />
                          ) : (
                            <QrCode className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                      ) : key === 'designs' ? (
                        <div 
                          className="flex h-full overflow-hidden items-center justify-center"
                          style={{
                            borderRadius: getBorderRadius(),
                            gap: `calc(12px * ${previewScale})`,
                          }}
                        >
                          <div className="flex-1 flex items-center justify-center h-full overflow-hidden">
                            {currentBillboard?.design_face_a ? (
                              <img 
                                src={currentBillboard.design_face_a} 
                                alt="Design A" 
                                className="w-full h-full"
                                style={{ 
                                  objectFit: element.objectFit || 'contain',
                                  objectPosition: element.objectPosition || 'center',
                                  borderRadius: getBorderRadius(),
                                  border: `${element.borderWidth || '1px'} solid ${element.borderColor || '#ddd'}`,
                                  minWidth: element.minWidth ? `calc(${element.minWidth} * ${previewScale})` : undefined,
                                }}
                              />
                            ) : (
                              <div 
                                className="bg-muted/30 flex items-center justify-center w-full h-full"
                                style={{ borderRadius: getBorderRadius() }}
                              >
                                <span style={{ fontSize: `calc(8px * ${previewScale})` }}>تصميم A</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 flex items-center justify-center h-full overflow-hidden">
                            {currentBillboard?.design_face_b ? (
                              <img 
                                src={currentBillboard.design_face_b} 
                                alt="Design B" 
                                className="w-full h-full"
                                style={{ 
                                  objectFit: element.objectFit || 'contain',
                                  objectPosition: element.objectPosition || 'center',
                                  borderRadius: getBorderRadius(),
                                  border: `${element.borderWidth || '1px'} solid ${element.borderColor || '#ddd'}`,
                                  minWidth: element.minWidth ? `calc(${element.minWidth} * ${previewScale})` : undefined,
                                }}
                              />
                            ) : (
                              <div 
                                className="bg-muted/30 flex items-center justify-center w-full h-full"
                                style={{ borderRadius: getBorderRadius() }}
                              >
                                <span style={{ fontSize: `calc(8px * ${previewScale})` }}>تصميم B</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : key === 'cutoutImage' ? (
                        <div 
                          className="bg-muted/50 flex items-center justify-center h-full overflow-hidden"
                          style={{
                            border: `${element.borderWidth || '2px'} solid ${element.borderColor || '#000'}`,
                            borderRadius: getBorderRadius(),
                          }}
                        >
                          {currentBillboard?.cutout_image_url ? (
                            <img src={currentBillboard.cutout_image_url} alt="Cutout" className="w-full h-full object-cover" />
                          ) : (
                            <>
                              <Layers className="h-6 w-6 text-muted-foreground" />
                              <span style={{ fontSize: `calc(8px * ${previewScale})` }} className="mr-1">مجسم</span>
                            </>
                          )}
                        </div>
                      ) : key === 'faceAImage' ? (
                        <div 
                          className="bg-muted/50 flex items-center justify-center h-full overflow-hidden"
                          style={{
                            border: `${element.borderWidth || '2px'} solid ${element.borderColor || '#000'}`,
                            borderRadius: getBorderRadius(),
                          }}
                        >
                          {currentBillboard?.design_face_a ? (
                            <img src={currentBillboard.design_face_a} alt="Face A" className="w-full h-full object-cover" />
                          ) : (
                            <span style={{ fontSize: `calc(8px * ${previewScale})` }}>الوجه الأمامي</span>
                          )}
                        </div>
                      ) : key === 'faceBImage' ? (
                        <div 
                          className="bg-muted/50 flex items-center justify-center h-full overflow-hidden"
                          style={{
                            border: `${element.borderWidth || '2px'} solid ${element.borderColor || '#000'}`,
                            borderRadius: getBorderRadius(),
                          }}
                        >
                          {currentBillboard?.design_face_b ? (
                            <img src={currentBillboard.design_face_b} alt="Face B" className="w-full h-full object-cover" />
                          ) : (
                            <span style={{ fontSize: `calc(8px * ${previewScale})` }}>الوجه الخلفي</span>
                          )}
                        </div>
                      ) : (
                        <span>{getDisplayValue()}</span>
                      )}
                    </div>
                  );
                })}

                {/* عرض شارات الحالة في المعاينة */}
                {showStatusBadgesInPrint && settings?.elements?.statusBadges?.visible !== false && (() => {
                  const badgeEl = settings?.elements?.statusBadges || DEFAULT_ELEMENTS.statusBadges;
                  const badges: { label: string; bg: string }[] = [];
                  
                  if (previewStatusMode === 'no-design' && showBadgeNoDesign) {
 badges.push({ label: ' بدون تصميم', bg: '#ef4444' });
                  } else if (previewStatusMode === 'one-design' && showBadgeOneDesign) {
                    badges.push({ label: '◐ تصميم واحد', bg: '#f59e0b' });
                  } else if (previewStatusMode === 'one-install' && showBadgeOneInstall) {
                    badges.push({ label: '① تركيب وجه واحد', bg: '#3b82f6' });
                  } else if (previewStatusMode === 'all-statuses') {
 if (showBadgeNoDesign) badges.push({ label: ' بدون تصميم', bg: '#ef4444' });
                    if (showBadgeOneDesign) badges.push({ label: '◐ تصميم واحد', bg: '#f59e0b' });
                    if (showBadgeOneInstall) badges.push({ label: '① تركيب وجه واحد', bg: '#3b82f6' });
                  } else if (previewStatusMode === 'none' && currentBillboard) {
                    // عرض حسب البيانات الفعلية
                    const hasA = currentBillboard.design_face_a;
                    const hasB = currentBillboard.design_face_b;
                    const two = (currentBillboard.Faces_Count || 1) >= 2;
                    const instA = currentBillboard.installed_image_face_a_url || currentBillboard.installed_image_url;
                    const instB = currentBillboard.installed_image_face_b_url;
 if (!hasA && !hasB && showBadgeNoDesign) badges.push({ label: ' بدون تصميم', bg: '#ef4444' });
                    else if (two && hasA && !hasB && showBadgeOneDesign) badges.push({ label: '◐ تصميم واحد', bg: '#f59e0b' });
                    if (two && instA && !instB && showBadgeOneInstall) badges.push({ label: '① تركيب وجه واحد', bg: '#3b82f6' });
                  }

                  if (badges.length === 0) return null;
                  
                  const badgeStyle: React.CSSProperties = {
                    position: 'absolute',
                    display: 'flex',
                    gap: '6px',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    direction: 'rtl',
                    zIndex: 20,
                  };
                  if (badgeEl.top) badgeStyle.top = `calc(${badgeEl.top} * ${previewScale})`;
                  if (badgeEl.left) {
                    badgeStyle.left = badgeEl.left.includes('%') ? badgeEl.left : `calc(${badgeEl.left} * ${previewScale})`;
                  }
                  if (badgeEl.width) badgeStyle.width = `calc(${badgeEl.width} * ${previewScale})`;
                  if (badgeEl.left?.includes('%')) badgeStyle.transform = 'translateX(-50%)';

                  return (
                    <div style={badgeStyle}>
                      {badges.map((b, i) => (
                        <span key={i} style={{
                          background: b.bg,
                          color: '#fff',
                          padding: `calc(2px * ${previewScale}) calc(8px * ${previewScale})`,
                          borderRadius: `calc(12px * ${previewScale})`,
                          fontSize: `calc(${badgeEl.fontSize || '11px'} * ${previewScale})`,
                          fontWeight: badgeEl.fontWeight || '600',
                        }}>{b.label}</span>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
