import React, { useState, useEffect, memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BillboardCardActions } from './billboards/BillboardCardActions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { MapPin, Calendar, Building, Building2, Eye, User, FileText, Clock, Camera, ChevronDown, ChevronUp, CheckCircle2, XCircle, History, EyeOff, Wrench, CalendarPlus, Pencil, ImageIcon, Check, ZoomIn, X, Copy, Layers, MapPinned, AlertTriangle, Wallet, Handshake, Zap } from 'lucide-react';
import { Billboard } from '@/types';
import { formatGregorianDate, formatLongArabicDate } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { BillboardImage } from './BillboardImage';
import { BillboardImageWithBlur } from './BillboardImageWithBlur';
import { DesignImageWithBlur } from './DesignImageWithBlur';
import { BillboardHistoryDialog } from './billboards/BillboardHistoryDialog';
import { BillboardExtendRentalDialog } from './billboards/BillboardExtendRentalDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { OwnerCompanyChanger } from './billboards/OwnerCompanyChanger';
import { BillboardStatusBadges } from './billboards/BillboardStatusBadges';
import type { BillboardStatus } from '@/hooks/useBillboardStatuses';

interface BillboardGridCardProps {
  billboard: Billboard & {
    contract?: {
      id: string;
      customer_name: string;
      ad_type: string;
      "Ad Type": string;
      start_date: string;
      end_date: string;
      rent_cost: number;
    };
  };
  onBooking?: (billboard: Billboard) => void;
  onViewDetails?: (billboard: Billboard) => void;
  showBookingActions?: boolean;
  onUpdate?: () => void;
  isSelectable?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  // ✅ Card action callbacks
  canEditBillboards?: boolean;
  onEdit?: (billboard: Billboard) => void;
  onContractAction?: (billboard: Billboard) => void;
  onDelete?: (id: number | string) => void;
  onMaintenance?: (billboard: Billboard) => void;
  hasActiveContractCheck?: (billboard: Billboard) => boolean;
  onVisibilityToggle?: (id: number | string, newValue: boolean) => void;
  onLocalUpdate?: (id: number | string, updates: Record<string, any>) => void;
  activeStatuses?: BillboardStatus[];
  onOpenOverlayEditor?: (billboard: Billboard) => void;
}

const BillboardGridCardInner: React.FC<BillboardGridCardProps> = ({
  billboard,
  onBooking,
  onViewDetails,
  showBookingActions = true,
  onUpdate,
  isSelectable = false,
  isSelected = false,
  onToggleSelect,
  canEditBillboards = false,
  onEdit,
  onContractAction,
  onDelete,
  onMaintenance,
  hasActiveContractCheck,
  onVisibilityToggle,
  onLocalUpdate,
  activeStatuses,
  onOpenOverlayEditor,
}) => {
  const isTorn = !!activeStatuses?.some((s) => s.status_type === 'torn_ad');
  const { isAdmin } = useAuth();
  const [isHovered, setIsHovered] = useState(false);
  const [installationStatusOpen, setInstallationStatusOpen] = useState(false);
  const [latestTask, setLatestTask] = useState<any>(null);
  const [activeMediaView, setActiveMediaView] = useState<'real' | 'design' | 'installation'>('real');
  const [loadingTask, setLoadingTask] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [hasExtension, setHasExtension] = useState(false);
  const [extensionData, setExtensionData] = useState<{
    extension_days: number;
    old_end_date: string;
    new_end_date: string;
    reason: string;
    extension_type: string;
  } | null>(null);
  
  // ✅ NEW: حالة كود العقد السنوي
  const [yearlyContractCode, setYearlyContractCode] = useState<string>('');
  
  // ✅ NEW: حالة العقد الساري (من billboard_ids)
  const [activeContract, setActiveContract] = useState<any>(null);
  
  // ✅ NEW: تصميم مشترك من مهام التركيب لنفس العقد
  const [contractSharedDesign, setContractSharedDesign] = useState<string | null>(null);
  
  // حالة التعديل السريع - عرض الأسعار من جدول pricing
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [quickEditLevel, setQuickEditLevel] = useState(billboard.Level || '');
  const [pricingRows, setPricingRows] = useState<any[]>([]);
  const [savingQuickEdit, setSavingQuickEdit] = useState(false);
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [levels, setLevels] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingPrices, setEditingPrices] = useState<Record<string, any>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [categorySearch, setCategorySearch] = useState('');
  
  // ✅ NEW: حالة تكبير التصاميم والصور
  const [designPreviewOpen, setDesignPreviewOpen] = useState(false);
  const [designPreviewUrl, setDesignPreviewUrl] = useState<string>('');
  const [designPreviewTitle, setDesignPreviewTitle] = useState<string>('');
  
  // ✅ NEW: اللون الغالب من التصميم
  const [dominantColor, setDominantColor] = useState<string | null>(null);
  
  // Fetch corporate price from the pricing list for شركات
  const [corporatePrice, setCorporatePrice] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const fetchCorporatePrice = async () => {
      const sizeName = billboard.Size || billboard.size || '';
      const levelName = billboard.Level || billboard.level || 'A';
      if (!sizeName) return;
      try {
        const { data, error } = await supabase
          .from('pricing')
          .select('one_month, "2_months", "3_months", "6_months", full_year, one_day')
          .eq('size', sizeName)
          .eq('billboard_level', levelName)
          .eq('customer_category', 'شركات')
          .maybeSingle();

        if (active && !error && data) {
          const price = data.one_month || data['2_months'] || data['3_months'] || data['6_months'] || data.full_year || data.one_day || null;
          setCorporatePrice(price);
        }
      } catch (e) {
        console.error('Error fetching corporate price for card:', e);
      }
    };
    fetchCorporatePrice();
    return () => {
      active = false;
    };
  }, [billboard.Size, billboard.Level]);

  // ✅ استخراج اللون الغالب من تصميم الوجه الأمامي (من latestTask أو billboard)
  useEffect(() => {
    // جلب التصميم من أماكن متعددة بالأولوية
    const billboardAny = billboard as any;
    let designImage: string | null = null;
    
    // 1. من task_designs (selected_design)
    if (latestTask?.selected_design?.design_face_a_url) {
      designImage = latestTask.selected_design.design_face_a_url;
    }
    // 2. من installation_task_items
    else if (latestTask?.design_face_a) {
      designImage = latestTask.design_face_a;
    }
    // 3. من billboards مباشرة
    else if (billboardAny.design_face_a) {
      designImage = billboardAny.design_face_a;
    }
    // 4. من العقد (design_data) - fallback
    if (!designImage && activeContract?.design_data) {
      try {
        const raw = activeContract.design_data;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const dd = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
        if (Array.isArray(dd)) {
          const m = dd.find((d: any) => String(d.billboardId) === String(billboard.ID));
          if (m) {
            designImage = m.designFaceA || m.design_face_a_url || null;
          } else {
            // fallback: أي تصميم من نفس العقد
            const any = dd.find((d: any) => d.designFaceA || d.design_face_a_url);
            if (any) designImage = any.designFaceA || any.design_face_a_url || null;
          }
        }
      } catch {}
    }
    
    // 5. من تصميم مشترك من مهام التركيب لنفس العقد
    if (!designImage && contractSharedDesign) {
      designImage = contractSharedDesign;
    }
    
    if (!designImage) {
      setDominantColor(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        canvas.width = 50;
        canvas.height = 50;
        ctx.drawImage(img, 0, 0, 50, 50);
        
        const imageData = ctx.getImageData(0, 0, 50, 50).data;
        let r = 0, g = 0, b = 0, count = 0;
        
        for (let i = 0; i < imageData.length; i += 4) {
          const brightness = (imageData[i] + imageData[i + 1] + imageData[i + 2]) / 3;
          if (brightness > 30 && brightness < 225) {
            r += imageData[i];
            g += imageData[i + 1];
            b += imageData[i + 2];
            count++;
          }
        }
        
        if (count > 0) {
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);
          setDominantColor(`${r}, ${g}, ${b}`);
        } else {
          setDominantColor(null);
        }
      } catch (e) {
        // Could not extract color - CORS
        setDominantColor(null);
      }
    };
    img.onerror = () => {
      // Failed to load design image
      setDominantColor(null);
    };
    img.src = designImage;
  }, [latestTask, (billboard as any).design_face_a, activeContract, contractSharedDesign]);

  useEffect(() => {
    const loadTaskData = async () => {
      if (!billboard.ID) return;
      
      setLoadingTask(true);
      try {
        // Loading task for billboard
        
        // First get the task item
        const { data: taskItem, error: taskError } = await supabase
          .from('installation_task_items')
          .select('*')
          .eq('billboard_id', billboard.ID)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (taskError) {
          console.error('❌ Supabase error loading task:', taskError);
          return;
        }
        
        if (!taskItem) {
          // No task data found
          setLatestTask(null);
          return;
        }

        // Get the design if selected_design_id exists
        let designData = null;
        if (taskItem.selected_design_id) {
          const { data: design } = await supabase
            .from('task_designs')
            .select('*')
            .eq('id', taskItem.selected_design_id)
            .single();
          designData = design;
        }

        // Get the task details
        let taskDetails = null;
        if (taskItem.task_id) {
          const { data: task } = await supabase
            .from('installation_tasks')
            .select(`
              *,
              team:installation_teams(*)
            `)
            .eq('id', taskItem.task_id)
            .single();
          taskDetails = task;
        }

        const enrichedTask = {
          ...taskItem,
          selected_design: designData,
          task: taskDetails
        };

        // Task loaded
        setLatestTask(enrichedTask);
      } catch (error) {
        console.error('❌ Error loading task:', error);
      } finally {
        setLoadingTask(false);
      }
    };
    
    if (isAdmin && billboard.ID) {
      loadTaskData();
    }
  }, [billboard.ID, isAdmin]);

  // التحقق من وجود تمديد للوحة وجلب تفاصيله
  useEffect(() => {
    const checkExtension = async () => {
      if (!billboard.ID) return;
      
      const { data } = await supabase
        .from('billboard_extensions')
        .select('extension_days, old_end_date, new_end_date, reason, extension_type')
        .eq('billboard_id', billboard.ID)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (data && data.length > 0) {
        setHasExtension(true);
        setExtensionData(data[0]);
      } else {
        setHasExtension(false);
        setExtensionData(null);
      }
    };
    
    checkExtension();
  }, [billboard.ID]);

  // ✅ NEW: جلب كود العقد السنوي
  useEffect(() => {
    const loadYearlyCode = async () => {
      const contractNum = (billboard as any).Contract_Number || (billboard as any).contractNumber;
      const startDate = billboard.Rent_Start_Date || (billboard as any).contract?.start_date;
      
      if (!contractNum || !startDate) {
        setYearlyContractCode('');
        return;
      }
      
      try {
        const startDateObj = new Date(startDate);
        if (isNaN(startDateObj.getTime())) {
          setYearlyContractCode('');
          return;
        }
        
        const year = startDateObj.getFullYear();
        const yearShort = year.toString().slice(-2);
        
        // جلب كل العقود في نفس السنة لحساب الترتيب
        const { data: contracts } = await supabase
          .from('Contract')
          .select('Contract_Number, "Contract Date"')
          .gte('"Contract Date"', `${year}-01-01`)
          .lte('"Contract Date"', `${year}-12-31`)
          .order('"Contract Date"', { ascending: true });
        
        if (contracts && contracts.length > 0) {
          const index = contracts.findIndex((c: any) => c.Contract_Number === contractNum);
          if (index !== -1) {
            setYearlyContractCode(`${index + 1}/${yearShort}`);
            return;
          }
        }
        
        setYearlyContractCode(yearShort);
      } catch (error) {
        console.error('Error loading yearly code:', error);
        setYearlyContractCode('');
      }
    };
    
    loadYearlyCode();
  }, [billboard.Contract_Number, billboard.Rent_Start_Date]);

  // جلب المستويات المتاحة
  useEffect(() => {
    const loadLevels = async () => {
      const { data } = await supabase.from('billboard_levels').select('level_code').order('level_code');
      if (data) setLevels(data.map(l => l.level_code));
    };
    if (isAdmin) loadLevels();
  }, [isAdmin]);

  // ✅ NEW: جلب العقد الساري من جدول العقود عبر billboard_ids
  useEffect(() => {
    const loadActiveContract = async () => {
      if (!billboard.ID) return;
      
      const idStr = String(billboard.ID);
      const today = new Date().toISOString().split('T')[0];
      
      try {
        const { data: contractData } = await supabase
          .from('Contract')
          .select('Contract_Number, "Customer Name", "Ad Type", "Contract Date", "End Date", billboard_ids, Total, "Total Rent", Discount, billboard_prices, design_data')
          .or(`billboard_ids.ilike."%25,${idStr},%25",billboard_ids.ilike."${idStr},%25",billboard_ids.ilike."%25,${idStr}",billboard_ids.eq.${idStr}`)
          .gte('End Date', today)
          .order('"End Date"', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (contractData) {
          setActiveContract(contractData);
        } else {
          setActiveContract(null);
        }
      } catch (error) {
        console.error('Error loading active contract:', error);
        setActiveContract(null);
      }
    };
    
    loadActiveContract();
  }, [billboard.ID]);

  // ✅ NEW: جلب تصميم مشترك من مهام التركيب لنفس العقد عند عدم وجود تصميم محلي
  useEffect(() => {
    const loadSharedDesign = async () => {
      const contractNum = activeContract?.Contract_Number || billboard.Contract_Number;
      if (!contractNum) {
        setContractSharedDesign(null);
        return;
      }
      
      // إذا كان latestTask يحتوي على تصميم، لا حاجة
      if (latestTask?.design_face_a || latestTask?.selected_design?.design_face_a_url) return;
      // إذا كان contractDesigns يحتوي على تصميم
      if ((billboard as any).design_face_a) return;
      
      try {
        // أولاً: جلب مهام التركيب لنفس العقد
        const { data: tasks } = await supabase
          .from('installation_tasks')
          .select('id')
          .eq('contract_id', contractNum);
        
        if (!tasks || tasks.length === 0) return;
        
        const taskIds = tasks.map(t => t.id);
        
        // ثانياً: جلب أي تصميم من عناصر هذه المهام
        const { data: taskItems } = await supabase
          .from('installation_task_items')
          .select('design_face_a')
          .in('task_id', taskIds)
          .not('design_face_a', 'is', null)
          .not('design_face_a', 'eq', '')
          .limit(1);
        
        if (taskItems && taskItems.length > 0) {
          setContractSharedDesign(taskItems[0].design_face_a);
        }
      } catch (error) {
        console.error('Error loading shared design:', error);
      }
    };
    
    loadSharedDesign();
  }, [activeContract, billboard.Contract_Number, latestTask]);

  // تحميل أسعار جميع الفئات السعرية من جدول pricing للمقاس والمستوى المحدد
  const loadPricingForSizeLevel = async (sizeName: string, level: string) => {
    setLoadingPricing(true);
    try {
      const { data } = await supabase
        .from('pricing')
        .select('*')
        .eq('size', sizeName)
        .eq('billboard_level', level)
        .order('customer_category');
      
      if (data && data.length > 0) {
        setPricingRows(data);
        const categories = data.map(r => r.customer_category);
        setAvailableCategories(categories);
        // إذا لم يكن هناك فئة مختارة، اختر أول واحدة
        if (!selectedCategory || !categories.includes(selectedCategory)) {
          setSelectedCategory(categories[0]);
        }
        // تهيئة بيانات التعديل
        const edits: Record<string, any> = {};
        data.forEach(row => {
          edits[row.customer_category] = {
            id: row.id,
            one_day: row.one_day || 0,
            one_month: row.one_month || 0,
            '2_months': row['2_months'] || 0,
            '3_months': row['3_months'] || 0,
            '6_months': row['6_months'] || 0,
            full_year: row.full_year || 0,
          };
        });
        setEditingPrices(edits);
      } else {
        setPricingRows([]);
        setAvailableCategories([]);
        setSelectedCategory('');
        setEditingPrices({});
      }
    } catch (error) {
      console.error('Error loading pricing:', error);
    } finally {
      setLoadingPricing(false);
    }
  };

  // دالة حفظ التعديل السريع - تحديث الأسعار في جدول pricing ومستوى اللوحة
  const handleQuickEditSave = async () => {
    setSavingQuickEdit(true);
    try {
      // حفظ الأسعار إذا كان في وضع التعديل
      if (isEditMode) {
        for (const [category, prices] of Object.entries(editingPrices)) {
          if (prices.id) {
            const { error } = await supabase.from('pricing').update({
              one_day: prices.one_day,
              one_month: prices.one_month,
              '2_months': prices['2_months'],
              '3_months': prices['3_months'],
              '6_months': prices['6_months'],
              full_year: prices.full_year,
            }).eq('id', prices.id);
            if (error) throw error;
          }
        }
      }

      // تحديث مستوى اللوحة إذا تغير
      if (quickEditLevel !== billboard.Level) {
        await supabase.from('billboards').update({ Level: quickEditLevel }).eq('ID', billboard.ID);
      }

      toast.success(isEditMode ? 'تم تحديث الأسعار والمستوى بنجاح' : 'تم تحديث المستوى بنجاح');
      setQuickEditOpen(false);
      setIsEditMode(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('فشل في الحفظ');
    } finally {
      setSavingQuickEdit(false);
    }
  };

  // استخدام بيانات العقد المرتبط أو البيانات المباشرة في اللوحة
  const contractInfo = billboard.contract;
  const customerName = contractInfo?.customer_name || billboard.Customer_Name || (billboard as any).clientName || '';
  
  // ✅ FIXED: تحسين استدعاء نوع الإعلان مع جميع الاحتمالات الممكنة
  const getAdType = () => {
    // من بيانات العقد أولاً
    if (contractInfo) {
      const contractAdType = contractInfo["Ad Type"] || 
                           contractInfo.ad_type || '';
      if (contractAdType && contractAdType.trim()) {
        return contractAdType.trim();
      }
    }
    
    // من بيانات اللوحة مباشرة
    const billboardAdType = billboard.Ad_Type || 
                           (billboard as any).adType || 
                           (billboard as any).ad_type || '';
    
    if (billboardAdType && billboardAdType.trim()) {
      return billboardAdType.trim();
    }
    
    // من بيانات العقود المدمجة في اللوحة
    if ((billboard as any).contracts && Array.isArray((billboard as any).contracts) && (billboard as any).contracts.length > 0) {
      const contract = (billboard as any).contracts[0];
      const contractAdType = contract["Ad Type"] || 
                           contract.ad_type || '';
      if (contractAdType && contractAdType.trim()) {
        return contractAdType.trim();
      }
    }
    
    return '';
  };

  const adType = getAdType();
  
  // جلب التواريخ المخصصة للوحة إن وجدت
  let customStartDate = '';
  let customEndDate = '';
  if (activeContract?.billboard_prices) {
    try {
      const prices = typeof activeContract.billboard_prices === 'string'
        ? JSON.parse(activeContract.billboard_prices)
        : activeContract.billboard_prices;
      if (Array.isArray(prices)) {
        const match = prices.find((p: any) => String(p.billboardId || p.billboard_id || '') === String(billboard.ID));
        if (match) {
          if (match.startDate) customStartDate = match.startDate;
          if (match.endDate) customEndDate = match.endDate;
        }
      }
    } catch {}
  }

  const startDate = customStartDate || contractInfo?.start_date || billboard.Rent_Start_Date || '';
  // استخدام تاريخ انتهاء اللوحة أولاً (لأنه يتم تحديثه عند التمديد)
  // ✅ استخدام بيانات العقد الساري أولاً (من billboard_ids)
  const endDate = customEndDate || activeContract?.['End Date'] || billboard.Rent_End_Date || contractInfo?.end_date || '';
  const contractId = activeContract?.Contract_Number || (billboard as any).Contract_Number || (billboard as any).contractNumber || contractInfo?.id || '';


  // استخدام yearlyContractCode من الـ state

  // تحديد حالة اللوحة مع فحص تاريخ انتهاء العقد
  const isContractExpired = () => {
    // إذا وجد عقد ساري من activeContract فهو غير منتهي بالتأكيد
    if (activeContract) return false;
    if (!endDate) return true;
    try {
      const endDateObj = new Date(endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return endDateObj < today;
    } catch {
      return true;
    }
  };

  const contractExpired = isContractExpired();
  // ✅ إذا وجد عقد ساري من activeContract أو من بيانات اللوحة
  const hasActiveContract = !!activeContract || (!!(contractInfo || billboard.Contract_Number) && !contractExpired);
  const rawStatus = (billboard as any).Status ?? (billboard as any).status ?? '';
  const statusNorm = String(rawStatus).trim();
  const maintStatus = String(((billboard as any).maintenance_status ?? '')).trim().toLowerCase();

  // تحديد نوع الحالة بدقة - ✅ تحسين فحص حالة الصيانة
  const isNotInstalled = maintStatus === 'لم يتم التركيب';
  const needsRemoval = maintStatus === 'تحتاج ازالة لغرض التطوير';
  const isRemoved = statusNorm === 'إزالة' || statusNorm.toLowerCase() === 'ازالة' || maintStatus === 'removed';
  const isDamaged = maintStatus === 'متضررة اللوحة';
  
  // ✅ تحسين: الصيانة تشمل كل الحالات غير التشغيلية
  const isMaintenance = statusNorm === 'صيانة' || 
                        statusNorm.toLowerCase() === 'maintenance' || 
                        maintStatus === 'maintenance' || 
                        maintStatus === 'repair_needed' || 
                        maintStatus === 'out_of_service';
  
  // ✅ اللوحة متاحة فقط إذا لم يكن هناك عقد ساري ولا مشاكل صيانة
  const isAvailable = !hasActiveContract && !isRemoved && !isNotInstalled && !needsRemoval && !isMaintenance && !isDamaged;
  
  // ✅ تحديد نص الحالة مع أولوية للصيانة
  const getMaintenanceLabel = () => {
    if (maintStatus === 'repair_needed') return 'تحتاج إصلاح';
    if (maintStatus === 'out_of_service') return 'خارج الخدمة';
    if (maintStatus === 'maintenance') return 'قيد الصيانة';
    return 'صيانة';
  };
  
  let statusLabel = 'متاح';
  
  if (isNotInstalled) {
    statusLabel = 'لم يتم التركيب';
  } else if (needsRemoval) {
    statusLabel = 'تحتاج إزالة';
  } else if (isRemoved) {
    statusLabel = 'تمت الإزالة';
  } else if (isDamaged) {
    statusLabel = 'متضررة';
  } else if (isMaintenance) {
    statusLabel = getMaintenanceLabel();
  } else if (hasActiveContract) {
    statusLabel = 'محجوز';
  }
  // حساب الأيام المتبقية
  const getDaysRemaining = () => {
    if (!endDate || contractExpired) return null;

    try {
      const endDateObj = new Date(endDate);
      const today = new Date();
      const diffTime = endDateObj.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return diffDays > 0 ? diffDays : 0;
    } catch {
      return null;
    }
  };

  const daysRemaining = getDaysRemaining();
  const isNearExpiry = daysRemaining !== null && daysRemaining <= 20 && daysRemaining > 0;

  // حساب نسبة التقدم الزمني للعقد
  const timeProgress = React.useMemo(() => {
    if (!startDate || !endDate) return 0;
    try {
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();
      const now = Date.now();
      if (now >= end) return 100;
      if (now <= start) return 0;
      const total = end - start;
      const elapsed = now - start;
      return Math.round((elapsed / total) * 100);
    } catch {
      return 0;
    }
  }, [startDate, endDate]);

  const [previewOpen, setPreviewOpen] = React.useState(false);

  const [isVisibleInAvailable, setIsVisibleInAvailable] = React.useState(
    (billboard as any).is_visible_in_available !== false
  );

  // Sync with prop changes
  React.useEffect(() => {
    setIsVisibleInAvailable((billboard as any).is_visible_in_available !== false);
  }, [(billboard as any).is_visible_in_available]);

  // ✅ دالة لتبديل حالة الظهور في المتاح
  const handleToggleVisibility = async () => {
    try {
      const newStatus = !isVisibleInAvailable;
      
      const { error } = await supabase
        .from('billboards')
        .update({ is_visible_in_available: newStatus })
        .eq('ID', billboard.ID);

      if (error) throw error;

      toast.success(newStatus ? 'ستظهر اللوحة في قائمة المتاح' : 'لن تظهر اللوحة في قائمة المتاح');
      
      // ✅ تحديث الحالة المحلية للكرت فوراً
      setIsVisibleInAvailable(newStatus);
      (billboard as any).is_visible_in_available = newStatus;
      
      // ✅ تحديث حالة اللوحة في الـ parent state بدون إعادة جلب كل البيانات
      onVisibilityToggle?.(billboard.ID, newStatus);
    } catch (error) {
      console.error('Error updating visibility status:', error);
      toast.error('فشل في تحديث حالة الظهور');
    }
  };

  // Helper function to get face count display name
  const getFaceCountDisplay = () => {
    const facesCount = billboard.Faces_Count || (billboard as any).faces_count || (billboard as any).faces || (billboard as any).Number_of_Faces || (billboard as any).Faces || '';
    
    // If it's a number, convert to descriptive text
    switch (String(facesCount)) {
      case '1':
        return 'وجه واحد';
      case '2':
        return 'وجهين';
      case '3':
        return 'ثلاثة أوجه';
      case '4':
        return 'أربعة أوجه';
      default:
        return facesCount || 'غير محدد';
    }
  };

  // Helper function to get billboard type display
  const getBillboardTypeDisplay = () => {
    return (billboard as any).billboard_type || (billboard as any).Billboard_Type || 'غير محدد';
  };

  // Helper function to get level display
  const getLevelDisplay = () => {
    return billboard.Level || (billboard as any).level || 'غير محدد';
  };

  // Determine if billboard is shared (partnership)
  const isShared = Boolean(
    (billboard as any).is_partnership ||
    (billboard as any).Is_Partnership ||
    (billboard as any).shared ||
    (billboard as any).isShared
  );

  // استخراج التصاميم من بيانات العقد كـ fallback
  const getContractDesigns = () => {
    if (!activeContract?.design_data) return { faceA: null, faceB: null };
    try {
      const raw = activeContract.design_data;
      const designData = typeof raw === 'string' ? JSON.parse(raw) : raw;
      // إذا كانت النتيجة لا تزال string (double-encoded)
      const arr = typeof designData === 'string' ? JSON.parse(designData) : designData;
      if (Array.isArray(arr)) {
        // البحث عن تصميم اللوحة المحددة أولاً
        const match = arr.find((d: any) => String(d.billboardId) === String(billboard.ID));
        if (match) {
          return {
            faceA: match.designFaceA || match.design_face_a_url || null,
            faceB: match.designFaceB || match.design_face_b_url || null,
          };
        }
        // إذا لم يوجد تصميم لهذه اللوحة، نستخدم أول تصميم متاح من نفس العقد
        const anyWithDesign = arr.find((d: any) => d.designFaceA || d.design_face_a_url);
        if (anyWithDesign) {
          return {
            faceA: anyWithDesign.designFaceA || anyWithDesign.design_face_a_url || null,
            faceB: anyWithDesign.designFaceB || anyWithDesign.design_face_b_url || null,
          };
        }
      }
    } catch {}
    return { faceA: null, faceB: null };
  };
  const contractDesigns = getContractDesigns();

  // الحصول على صورة التصميم الأمامي
  const getFrontDesignUrl = () => {
    if (latestTask?.design_face_a || latestTask?.selected_design?.design_face_a_url) {
      return latestTask.design_face_a || latestTask.selected_design?.design_face_a_url;
    }
    // fallback من العقد
    if (contractDesigns.faceA) return contractDesigns.faceA;
    // fallback من البيانات الممررة عبر الهوك
    if ((billboard as any).design_face_a) return (billboard as any).design_face_a;
    // ✅ NEW: fallback من تصميم مشترك من مهام التركيب لنفس العقد
    if (contractSharedDesign) return contractSharedDesign;
    return null;
  };

  const frontDesignUrl = getFrontDesignUrl();

  // دالة فتح تكبير التصميم/الصورة
  const openDesignPreview = (url: string, title: string) => {
    setDesignPreviewUrl(url);
    setDesignPreviewTitle(title);
    setDesignPreviewOpen(true);
  };

  // حساب ستايل الكرت بناءً على اللون الغالب - متوافق مع الثيم
  const getCardStyle = (): React.CSSProperties => {
    if (dominantColor) {
      const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
      const rgb = dominantColor.split(',').map(num => parseInt(num.trim()));
      let [r, g, b] = rgb;
      
      // Calculate brightness
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      
      if (isDark) {
        // In dark mode: if dominant color is too bright, scale it down to prevent glare
        if (brightness > 180) {
          const factor = 180 / brightness;
          r = Math.round(r * factor);
          g = Math.round(g * factor);
          b = Math.round(b * factor);
        }
        // If too dark, scale it up to be visible
        else if (brightness < 60) {
          const factor = 60 / Math.max(brightness, 1);
          r = Math.min(255, Math.round(r * factor));
          g = Math.min(255, Math.round(g * factor));
          b = Math.min(255, Math.round(b * factor));
        }
      } else {
        // In light mode: if dominant color is too dark, scale it up
        if (brightness < 80) {
          const factor = 80 / Math.max(brightness, 1);
          r = Math.min(255, Math.round(r * factor));
          g = Math.min(255, Math.round(g * factor));
          b = Math.min(255, Math.round(b * factor));
        }
        // If too bright, scale down to keep borders clear
        else if (brightness > 220) {
          const factor = 220 / brightness;
          r = Math.round(r * factor);
          g = Math.round(g * factor);
          b = Math.round(b * factor);
        }
      }
      
      const safeColor = `${r}, ${g}, ${b}`;
      
      return {
        borderColor: isHovered
          ? `rgba(${safeColor}, 0.65)`
          : `rgba(${safeColor}, 0.3)`,
        background: isDark
          ? `linear-gradient(145deg, rgba(${safeColor}, ${isHovered ? 0.16 : 0.1}) 0%, rgba(${safeColor}, 0.03) 50%, hsl(var(--card)) 100%)`
          : `linear-gradient(145deg, rgba(${safeColor}, ${isHovered ? 0.12 : 0.06}) 0%, rgba(${safeColor}, 0.02) 50%, hsl(var(--card)) 100%)`,
        boxShadow: isHovered
          ? isDark
            ? `0 20px 50px -12px rgba(${safeColor}, 0.35), 0 0 24px -4px rgba(${safeColor}, 0.15)`
            : `0 20px 50px -12px rgba(${safeColor}, 0.22), 0 0 20px -4px rgba(${safeColor}, 0.08)`
          : isDark
            ? `0 8px 30px -12px rgba(${safeColor}, 0.2)`
            : `0 8px 30px -12px rgba(${safeColor}, 0.1)`,
        transform: isHovered ? 'scale(1.015) translateY(-4px)' : 'scale(1) translateY(0)',
      };
    }
    
    return {
      borderColor: isHovered ? 'hsl(var(--primary)/40%)' : 'hsl(var(--border))',
      transform: isHovered ? 'scale(1.015) translateY(-4px)' : 'scale(1) translateY(0)',
    };
  };

  // ستايلات الأقسام الداخلية بناءً على اللون الغالب
  const getSectionStyle = (opacity: number = 0.08): React.CSSProperties => {
    if (dominantColor) {
      return {
        background: `rgba(${dominantColor}, ${opacity})`,
        borderColor: `rgba(${dominantColor}, 0.2)`,
      };
    }
    return {};
  };

  const getAccentBorderStyle = (): React.CSSProperties => {
    if (dominantColor) {
      return { borderColor: `rgba(${dominantColor}, 0.3)` };
    }
    return {};
  };

  // 🎨 Status theme — drives colored header background
  const getStatusTheme = () => {
    if (isRemoved || isDamaged) {
      return { bg: 'bg-rose-500/20 border-rose-500/40', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500', icon: XCircle };
    }
    if (isMaintenance || needsRemoval) {
      return { bg: 'bg-amber-500/20 border-amber-500/40', text: 'text-amber-800 dark:text-amber-200', dot: 'bg-amber-500', icon: Wrench };
    }
    if (isNotInstalled) {
      return { bg: 'bg-slate-500/20 border-slate-500/40', text: 'text-slate-700 dark:text-slate-200', dot: 'bg-slate-500', icon: Clock };
    }
    if (hasActiveContract) {
      return { bg: 'bg-indigo-500/20 border-indigo-500/40', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500', icon: FileText };
    }
    return { bg: 'bg-emerald-500/20 border-emerald-500/40', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500', icon: CheckCircle2 };
  };
  const statusTheme = getStatusTheme();
  const StatusIcon = statusTheme.icon;



  return (
    <>
      <Card 
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`group relative overflow-hidden rounded-[1.75rem] border-2 bg-card flex flex-col h-full transition-all duration-500 ease-out ${
          isTorn
            ? 'border-destructive ring-2 ring-destructive/60 ring-offset-2 ring-offset-background shadow-[0_0_0_1px_hsl(var(--destructive)/0.4)]'
            : 'border-border'
        } ${isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background border-primary' : ''} ${
          !dominantColor && isHovered ? 'shadow-luxury border-primary/50' : ''
        }`}
        style={getCardStyle()}
      >
        {/* ═══ شريط الحالة — صف واحد نظيف ═══ */}
        <div className={`flex items-stretch border-b transition-all duration-500 ${statusTheme.bg}`} dir="rtl">

          {/* ── اليمين: بادج المقاس الذهبي ── */}
          <div
            title="مقاس اللوحة"
            className="relative flex flex-col items-center justify-center px-3 py-1.5 shrink-0 bg-gradient-to-b from-amber-400 to-amber-600 text-neutral-950 overflow-hidden transition-all duration-500 group-hover:from-amber-300 group-hover:to-amber-500 group-hover:shadow-[0_0_18px_rgba(251,191,36,0.6)] rounded-tr-[1.5rem]"
          >
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/25 to-transparent" />
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-l from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
            <span className="relative text-[8px] font-black uppercase tracking-widest opacity-70 leading-none">مقاس</span>
            <span className="relative font-black text-lg tabular-nums leading-tight tracking-tight mt-0.5">
              {(() => {
                const s = String(billboard.Size || '—');
                const m = s.match(/^(\d+)\s*[x×]\s*(\d+)$/i);
                if (m) return <>{m[1]}<span className="opacity-50 font-bold mx-[1px] text-sm">×</span>{m[2]}</>;
                return s;
              })()}
            </span>
          </div>

          {/* ── الوسط: الحالة + المستوى + الأوجه + تحذيرات ── */}
          <div className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 min-w-0 flex-wrap`}>

            {/* نقطة الحالة + أيقونة + نص */}
            <div className={`flex items-center gap-1.5 shrink-0 ${statusTheme.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusTheme.dot} shadow-[0_0_6px_currentColor] animate-pulse`} />
              <StatusIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="text-[11px] font-extrabold whitespace-nowrap">{statusLabel}</span>
            </div>

            {/* فاصل */}
            <span className="w-px h-3.5 bg-current opacity-20 shrink-0" />

            {/* شارة المستوى */}
            {getLevelDisplay() !== 'غير حدد' && getLevelDisplay() !== 'غير محدد' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isAdmin) return;
                  setIsEditMode(false);
                  setQuickEditLevel(billboard.Level || 'A');
                  loadPricingForSizeLevel(billboard.Size || '', billboard.Level || 'A');
                  setQuickEditOpen(true);
                }}
                title={`المستوى ${getLevelDisplay()}${isAdmin ? ' — تعديل' : ''}`}
                className={`inline-flex items-center justify-center h-5 w-5 rounded-[5px] border text-[10px] font-black shadow-sm shrink-0 ${
                  getLevelDisplay() === 'A'
                    ? 'bg-amber-400/25 border-amber-400/70 text-amber-700 dark:text-amber-300'
                    : getLevelDisplay() === 'B'
                    ? 'bg-sky-400/25 border-sky-400/70 text-sky-700 dark:text-sky-300'
                    : 'bg-white/10 border-white/30 text-foreground'
                } ${isAdmin ? 'hover:scale-110 cursor-pointer' : 'cursor-default'} transition-transform duration-200`}
              >
                {getLevelDisplay()}
              </button>
            )}

            {/* عدد الأوجه */}
            <span
              title="عدد الأوجه"
              className="inline-flex items-center gap-1 h-5 px-1.5 rounded-full bg-background/60 dark:bg-black/25 border border-border/40 text-foreground/75 text-[10px] font-bold shrink-0"
            >
              <Layers className="h-2.5 w-2.5 opacity-60 shrink-0" />
              {getFaceCountDisplay()}
            </span>

            {/* تحذير قرب الانتهاء */}
            {isNearExpiry && !contractExpired && (
              <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-full bg-amber-500 text-white text-[9px] font-black shadow-sm shrink-0">
                <span className="w-1 h-1 rounded-full bg-white/80 animate-pulse shrink-0" />
                {daysRemaining}ي
              </span>
            )}

            {/* تحذير الانتهاء */}
            {contractExpired && hasActiveContract === false && (contractId || endDate) && (
              <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-full bg-rose-600 text-white text-[9px] font-black shadow-sm shrink-0">
                <span className="w-1 h-1 rounded-full bg-white/80 animate-pulse shrink-0" />
                منتهي
              </span>
            )}

          </div>

          {/* ── اليسار: أيقونة الإعدادات ── */}
          <div className="flex items-center px-1 shrink-0">
            {(onEdit || onDelete || onContractAction || onMaintenance) ? (
              <BillboardCardActions
                billboard={billboard}
                hasContract={hasActiveContractCheck ? hasActiveContractCheck(billboard) : hasActiveContract}
                canEdit={canEditBillboards}
                onEdit={onEdit || (() => {})}
                onContractAction={onContractAction || (() => {})}
                onDelete={onDelete || (() => {})}
                onMaintenance={onMaintenance || (() => {})}
                onUpdate={onUpdate || (() => {})}
                onLocalUpdate={onLocalUpdate}
                onOpenOverlayEditor={onOpenOverlayEditor}
              />
            ) : (
              <div className="w-7 h-7" />
            )}
          </div>

        </div>





        
        <div className="relative flex flex-col flex-1">
          {/* Selection checkbox — over image only, never covers header */}
          {isSelectable && (
            <div
              className={`absolute top-2 right-2 z-30 ${
                isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 sm:opacity-0'
              } transition-opacity duration-200`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect?.();
              }}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shadow-lg backdrop-blur-md ring-1 ring-white/30 transition-colors ${
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-foreground/60 text-background hover:bg-primary hover:text-primary-foreground'
              }`}>
                <Check className="h-4 w-4" />
              </div>
            </div>
          )}

          <div 
            className="aspect-[16/10] bg-muted relative overflow-hidden cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewOpen(true);
            }}
          >
            <div className="absolute inset-0 z-0 transition-transform duration-700 ease-out group-hover:scale-105">
              {activeMediaView === 'design' && frontDesignUrl ? (
                <DesignImageWithBlur
                  src={frontDesignUrl}
                  alt="التصميم"
                  className="w-full h-full"
                />
              ) : activeMediaView === 'installation' && (latestTask?.installed_image_url || latestTask?.installed_image_face_a_url || latestTask?.installed_image_face_b_url) ? (
                <img 
                  src={latestTask.installed_image_url || latestTask.installed_image_face_a_url || latestTask.installed_image_face_b_url} 
                  alt="صورة التركيب" 
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <BillboardImageWithBlur
                  billboard={billboard}
                  alt={billboard.Billboard_Name}
                  className="w-full h-full"
                />
              )}
            </div>

            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent z-10 pointer-events-none transition-opacity duration-500 group-hover:opacity-80" />

            {/* Status badges over the image */}
            {activeStatuses && activeStatuses.filter((status) => status.status_type !== 'torn_ad').length > 0 && (
              <div className="absolute top-2 left-2 z-20 pointer-events-none">
                <BillboardStatusBadges
                  statuses={activeStatuses.filter((status) => status.status_type !== 'torn_ad')}
                  size="xs"
                />
              </div>
            )}

            {/* Maintenance status badge — based on billboards.maintenance_status */}
            {(() => {
              const map: Record<string, { label: string; cls: string }> = {
                torn: { label: 'إعلان ممزق', cls: 'bg-destructive text-destructive-foreground border-destructive' },
                maintenance: { label: 'قيد الصيانة', cls: 'bg-amber-500 text-white border-amber-600' },
                repair_needed: { label: 'تحتاج إصلاح', cls: 'bg-amber-500 text-white border-amber-600' },
                out_of_service: { label: 'خارج الخدمة', cls: 'bg-rose-600 text-white border-rose-700' },
                'متضررة اللوحة': { label: 'متضررة', cls: 'bg-rose-600 text-white border-rose-700' },
                removed: { label: 'تمت الإزالة', cls: 'bg-slate-600 text-white border-slate-700' },
                'لم يتم التركيب': { label: 'لم يتم التركيب', cls: 'bg-slate-500 text-white border-slate-600' },
                'تحتاج ازالة لغرض التطوير': { label: 'تحتاج إزالة', cls: 'bg-amber-600 text-white border-amber-700' },
              };
              const entry = map[maintStatus];
              if (!entry || maintStatus === 'operational' || maintStatus === '') return null;
              return (
                <div className="absolute bottom-2 right-2 z-20 pointer-events-none">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border shadow-md ${entry.cls}`}>
                    <Wrench className="h-3 w-3" />
                    {entry.label}
                  </span>
                </div>
              );
            })()}

            {/* Zoom icon on hover */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20">
              <div className="bg-black/40 rounded-full p-1.5 backdrop-blur-sm">
                <ZoomIn className="h-5 w-5 text-white" />
              </div>
            </div>

            {/* Media toggle tabs overlay */}
            {(!!frontDesignUrl || !!(latestTask?.installed_image_url || latestTask?.installed_image_face_a_url || latestTask?.installed_image_face_b_url)) && (
              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 p-0.5 bg-black/60 dark:bg-slate-900/80 backdrop-blur-md rounded-xl border border-white/10 shadow-lg select-none">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMediaView('real');
                  }}
                  className={`h-6 px-2.5 rounded-lg text-[10px] font-bold transition-all duration-200 ${
                    activeMediaView === 'real'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  الواقع
                </button>
                {frontDesignUrl && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMediaView('design');
                    }}
                    className={`h-6 px-2.5 rounded-lg text-[10px] font-bold transition-all duration-200 ${
                      activeMediaView === 'design'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    التصميم
                  </button>
                )}
                {(latestTask?.installed_image_url || latestTask?.installed_image_face_a_url || latestTask?.installed_image_face_b_url) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMediaView('installation');
                    }}
                    className={`h-6 px-2.5 rounded-lg text-[10px] font-bold transition-all duration-200 ${
                      activeMediaView === 'installation'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    التركيب
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Name + Location — prominent block */}
          <div className="px-3 py-2.5 border-b border-border/30 bg-muted/20 space-y-1.5">
            {/* Row 1: Name + Code chip + copy */}
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="font-bold text-[15px] text-foreground leading-tight truncate font-manrope flex-1 min-w-0">
                {billboard.Billboard_Name || `لوحة رقم ${billboard.ID}`}
              </h3>
              <span
                title="كود اللوحة"
                className="font-mono text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-md shrink-0 whitespace-nowrap tracking-tight"
              >
                {(billboard as any).Billboard_ID || billboard.ID}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 p-0 text-muted-foreground hover:text-primary shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(billboard.Billboard_Name || `لوحة رقم ${billboard.ID}`);
                  toast.success('تم نسخ اسم اللوحة');
                }}
                title="نسخ اسم اللوحة"
              >
                <Copy className="h-2.5 w-2.5" />
              </Button>
            </div>

            {/* Row 2: Landmark */}
            {billboard.Nearest_Landmark && (
              <p className="text-[12px] text-foreground/85 flex items-start gap-1 leading-snug">
                <MapPin className="h-3 w-3 text-primary flex-shrink-0 mt-0.5" />
                <span className="truncate">{billboard.Nearest_Landmark}</span>
              </p>
            )}

            {/* Row 3: Area chips */}
            <div className="flex items-center flex-wrap gap-1">
              {billboard.Municipality && (
                <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.5 rounded-full border border-primary/20">
                  <Building2 className="h-2.5 w-2.5" />
                  {billboard.Municipality}
                </span>
              )}
              {billboard.District && (
                <span className="inline-flex items-center gap-1 bg-muted text-foreground text-[10px] font-medium px-2 py-0.5 rounded-full border border-border/50">
                  <MapPinned className="h-2.5 w-2.5 opacity-70" />
                  {billboard.District}
                </span>
              )}
              {getBillboardTypeDisplay() !== 'غير محدد' && (
                <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                  <span className="opacity-40">·</span>
                  {getBillboardTypeDisplay()}
                </span>
              )}
            </div>
            {/* Price Row */}
            {!hasActiveContract && Number(corporatePrice !== null ? corporatePrice : (billboard.Price || 0)) > 0 && (
              <div className="flex items-center justify-between text-[11px] bg-primary/5 border border-primary/10 rounded-lg px-2 py-1 mt-1">
                <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                  <Wallet className="h-3 w-3 text-primary" /> سعر الإيجار شهرياً
                </span>
                <span className="flex items-baseline gap-0.5">
                  <span className="font-extrabold text-[12px] text-primary font-manrope">
                    {Number(corporatePrice !== null ? corporatePrice : (billboard.Price || 0)).toLocaleString()}
                  </span>
                  <span className="text-[9px] text-muted-foreground font-semibold">د.ل/شهرياً</span>
                </span>
              </div>
            )}
          </div>
            <CardContent className="flex flex-col flex-1 p-2.5 sm:p-3 space-y-3">
              {/* 1. معلومات العقد والتصميم النشط (تذكرة مثقوبة بأسلوب أوبن ديزاين رأسية) */}
              {hasActiveContract && !contractExpired && (
                <div 
                  className="relative rounded-2xl border border-dashed border-primary/30 bg-gradient-to-br from-primary/5 via-primary/5/80 to-transparent shadow-inner overflow-hidden select-none animate-fade-in flex flex-col"
                  style={dominantColor ? {
                    borderColor: `rgba(${dominantColor}, 0.25)`,
                    background: `linear-gradient(135deg, rgba(${dominantColor}, 0.08) 0%, rgba(${dominantColor}, 0.03) 50%, transparent 100%)`
                  } : undefined}
                >
                  {/* الجانب العلوي (تصميم الإعلان الممدد أفقياً لمنع التشوه) */}
                  {frontDesignUrl && (
                    <div 
                      className="relative w-full aspect-[21/9] bg-muted/15 border-b border-dashed border-primary/20 overflow-hidden cursor-pointer group/design shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDesignPreview(frontDesignUrl, 'التصميم الإعلاني');
                      }}
                      title="تكبير التصميم"
                    >
                      <DesignImageWithBlur 
                        src={frontDesignUrl} 
                        alt="التصميم الإعلاني" 
                        className="w-full h-full"
                      />
                      {/* تأثير التحويم للتكبير */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/design:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
                        <div className="bg-black/60 rounded-full p-2 backdrop-blur-sm shadow">
                          <ZoomIn className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-xs text-white font-extrabold">اضغط لتكبير التصميم</span>
                      </div>
                    </div>
                  )}

                  {/* خط التثقيب الأفقي مع قطع الدوائر الجانبية */}
                  {frontDesignUrl && (
                    <div className="relative h-px w-full shrink-0">
                      {/* الدائرة اليمنى */}
                      <div 
                        className="absolute -right-1.5 -top-1.5 w-3 h-3 rounded-full bg-background border border-border/40 shadow-[inset_1px_0_1px_rgba(0,0,0,0.05)]" 
                        style={dominantColor ? { borderColor: `rgba(${dominantColor}, 0.25)` } : undefined}
                      />
                      {/* الدائرة اليسرى */}
                      <div 
                        className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-background border border-border/40 shadow-[inset_-1px_0_1px_rgba(0,0,0,0.05)]" 
                        style={dominantColor ? { borderColor: `rgba(${dominantColor}, 0.25)` } : undefined}
                      />
                    </div>
                  )}

                  {/* الجانب السفلي (تفاصيل العقد المنظمة) */}
                  <div className="p-3 flex flex-col justify-between space-y-2.5 min-w-0">
                    {/* رأس العقد */}
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="flex items-center gap-1 text-[10px] font-extrabold text-primary uppercase tracking-wider">
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        عقد نشط
                      </span>
                      <div className="flex items-center gap-1 min-w-0">
                        {contractId && (
                          <Badge variant="outline" className="text-[9px] h-4.5 px-1.5 font-mono border-primary/20 truncate">
                            #{contractId}
                          </Badge>
                        )}
                        {yearlyContractCode && (
                          <Badge className="text-[9px] h-4.5 px-1.5 bg-primary/15 text-primary border-primary/30 font-bold shrink-0">
                            {yearlyContractCode}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* معلومات العميل في شبكة منسقة */}
                    <div className="grid grid-cols-2 gap-3 text-xs border-b border-primary/5 pb-2">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[9px] text-muted-foreground font-medium">العميل</span>
                        {customerName ? (
                          <span className="flex items-center gap-1 text-foreground font-semibold truncate leading-none mt-1">
                            <User className="h-3 w-3 text-muted-foreground/80 shrink-0" />
                            <span className="truncate">{customerName}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60 mt-1">-</span>
                        )}
                      </div>

                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[9px] text-muted-foreground font-medium">نوع الإعلان</span>
                        {adType ? (
                          <div className="mt-0.5">
                            <span className="inline-block text-[9px] font-extrabold bg-muted/80 text-foreground border border-border/50 px-1.5 py-0.5 rounded-md leading-none">
                              {adType}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60 mt-1">-</span>
                        )}
                      </div>
                    </div>

                    {/* تواريخ العقد والوقت المتبقي */}
                    <div className="space-y-1.5 border-b border-primary/5 pb-2">
                      <div className="flex flex-col gap-0.5 min-w-0 text-[10px]">
                        <span className="text-[9px] text-muted-foreground font-medium">فترة العقد</span>
                        <div className="flex items-center gap-1 text-muted-foreground font-medium mt-1">
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          <div className="truncate flex items-center gap-1 flex-wrap">
                            {startDate && <span>{formatLongArabicDate(startDate)}</span>}
                            {startDate && endDate && <span className="opacity-55">→</span>}
                            {endDate && <span className="font-semibold text-foreground">{formatLongArabicDate(endDate)}</span>}
                          </div>
                        </div>
                      </div>

                      {/* شريط التقدم */}
                      {startDate && endDate && (
                        <div className="space-y-1 pt-0.5">
                          <div className="flex justify-between items-center text-[9px] text-muted-foreground font-bold leading-none">
                            <span>المنقضي: {timeProgress}%</span>
                            <Badge 
                              variant={isNearExpiry ? 'destructive' : 'secondary'} 
                              className="text-[9px] h-4.5 px-1.5 font-extrabold leading-none shrink-0"
                            >
                              {daysRemaining} يوم متبقي
                            </Badge>
                          </div>
                          <div className="w-full h-1 bg-muted dark:bg-slate-800/80 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                isNearExpiry 
                                  ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' 
                                  : 'bg-primary shadow-[0_0_6px_rgba(var(--primary-rgb),0.3)]'
                              }`}
                              style={{ width: `${timeProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* سطر السعر المدمج */}
                    {(activeContract?.Total || activeContract?.['Total Rent'] || contractInfo?.rent_cost || activeContract?.billboard_prices) && (() => {
                      const rentCost = Number(contractInfo?.rent_cost || 0);
                      const rentCostGross = Number((contractInfo as any)?.rent_cost_gross || rentCost);
                      let perBillboardNet = 0;
                      let perBillboardGross = 0;
                      const rawPrices = activeContract?.billboard_prices;
                      if (rawPrices) {
                        try {
                          const prices = typeof rawPrices === 'string' ? JSON.parse(rawPrices) : rawPrices;
                          if (Array.isArray(prices)) {
                            const billboardIdStr = String(billboard.ID);
                            const match = prices.find((p: any) => String(p.billboardId) === billboardIdStr);
                            if (match) {
                              perBillboardNet = Number(match.finalPrice ?? match.priceAfterDiscount ?? match.totalBillboardPrice ?? 0);
                              perBillboardGross = Number(match.priceBeforeDiscount ?? match.contractPrice ?? match.basePriceBeforeDiscount ?? perBillboardNet);
                            }
                          }
                        } catch (e) {
                          console.error('Error parsing billboard_prices:', e);
                        }
                      }
                      const netAmount = perBillboardNet > 0 ? perBillboardNet : rentCost;
                      const grossAmount = perBillboardGross > 0 ? perBillboardGross : rentCostGross;
                      const discount = grossAmount > netAmount ? (grossAmount - netAmount) : 0;
                      const hasDiscount = discount > 0;
                      if (!netAmount && !grossAmount) return null;
                      return (
                        <div className="flex items-center justify-between gap-1.5 pt-0.5 tabular-nums">
                          <span className="text-[9px] text-muted-foreground font-medium">قيمة اللوحة</span>
                          <div className="flex items-center gap-1.5">
                            <span className="flex items-baseline gap-1">
                              {hasDiscount && (
                                <span className="text-[9px] text-muted-foreground/60 line-through leading-none">{grossAmount.toLocaleString()}</span>
                              )}
                              <span className="font-extrabold text-[13px] text-primary font-manrope leading-none">{netAmount.toLocaleString()}</span>
                              <span className="text-[9px] text-muted-foreground font-semibold leading-none">د.ل</span>
                            </span>
                            {hasDiscount && (
                              <Badge className="text-[9px] h-3.5 px-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 font-bold leading-none shrink-0">
                                خصم {discount.toLocaleString()}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* حالة التركيب للمدراء مدمجة بأسفل التذكرة كشريط نحيف */}
                  {isAdmin && latestTask && (
                    <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-primary/[0.03] border-t border-primary/10 text-[9px] font-bold">
                      <span className="text-muted-foreground/80">حالة تركيب الإعلان:</span>
                      {latestTask.status === 'completed' ? (
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3 shrink-0" /> مكتمل ومثبت
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-500">
                          <Clock className="h-3 w-3 shrink-0 animate-pulse" /> قيد المراجعة/التركيب
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 2. بطاقة ترويج للوحات المتاحة للحجز (Available State Card) */}
              {isAvailable && (
                <div className="p-3.5 rounded-2xl border border-dashed border-emerald-500/25 bg-emerald-500/5/40 relative overflow-hidden space-y-2 shadow-inner animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      متاحة للحجز الفوري
                    </span>
                    <Badge variant="outline" className="text-[9px] h-4.5 px-2 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold leading-none">
                      جاهز
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    هذه اللوحة شاغرة حالياً وممتازة لحملتكم القادمة. يمكنك حجزها فوراً أو تعديل أسعار المستويات.
                  </p>
                  
                  {Number(corporatePrice !== null ? corporatePrice : (billboard.Price || 0)) > 0 && (
                    <div className="flex items-center justify-between border-t border-emerald-500/10 pt-2 mt-2 tabular-nums">
                      <span className="text-[10px] text-muted-foreground">السعر الأساسي:</span>
                      <span className="flex items-baseline gap-0.5">
                        <span className="font-extrabold text-[13px] text-emerald-600 dark:text-emerald-400 font-manrope">
                          {Number(corporatePrice !== null ? corporatePrice : (billboard.Price || 0)).toLocaleString()}
                        </span>
                        <span className="text-[9px] text-muted-foreground font-semibold">د.ل/شهرياً</span>
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 2.5 بطاقات تنبيه لحالات الصيانة أو الأعطال (Maintenance/Incident Alert Card) */}
              {(isMaintenance || isDamaged || isRemoved || isNotInstalled || needsRemoval) && (
                <div className={`p-3 rounded-2xl border border-dashed relative overflow-hidden space-y-2 shadow-inner animate-fade-in ${
                  isRemoved || isDamaged 
                    ? 'border-rose-500/25 bg-rose-500/5/40 text-rose-700 dark:text-rose-400' 
                    : 'border-amber-500/25 bg-amber-500/5/40 text-amber-700 dark:text-amber-400'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold">
                      {isRemoved || isDamaged ? (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <Wrench className="h-3.5 w-3.5 shrink-0 animate-pulse" />
                      )}
                      حالة اللوحة: {statusLabel}
                    </span>
                    <Badge variant="outline" className={`text-[9px] h-4.5 px-2 border-0 font-bold leading-none ${
                      isRemoved || isDamaged
                        ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                    }`}>
                      غير نشط
                    </Badge>
                  </div>
                  
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {isNotInstalled && 'لم يتم تركيب هيكل اللوحة الفعلي في هذا الموقع بعد. اللوحة غير جاهزة لاستقبال تصاميم إعلانية.'}
                    {needsRemoval && 'مجدولة لغرض الإزالة أو النقل لأسباب تنظيمية وتطويرية في أقرب وقت.'}
                    {isRemoved && 'تمت إزالة هذه اللوحة نهائياً من هذا الموقع لأسباب إدارية أو إنشائية.'}
                    {isDamaged && 'تنبيه: اللوحة متضررة حالياً (تلف الهيكل أو الإضاءة) وتحتاج تدخل سريع.'}
                    {isMaintenance && ((billboard as any).maintenance_notes || 'اللوحة تخضع لأعمال الصيانة الدورية أو الطارئة حالياً لتأمين سلامة التركيب.')}
                  </p>

                  {/* سطر تكلفة وتاريخ الصيانة إذا توفرت للمدراء */}
                  {isAdmin && ((billboard as any).maintenance_date || (billboard as any).maintenance_cost) && (
                    <div className="flex items-center justify-between gap-2 border-t border-current/10 pt-2 mt-2 text-[9px] font-bold opacity-90">
                      {(billboard as any).maintenance_date && (
                        <span>التاريخ: {formatGregorianDate((billboard as any).maintenance_date, 'ar-LY')}</span>
                      )}
                      {(billboard as any).maintenance_cost && (
                        <span>التكلفة: {Number((billboard as any).maintenance_cost).toLocaleString()} د.ل</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 3. الشراكات وعلامة اللوحة المشتركة */}
              {isShared && (
                <div className="p-2.5 rounded-xl bg-gradient-to-r from-violet-500/8 via-purple-500/8 to-pink-500/8 border border-violet-500/15 shadow-sm animate-fade-in">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 flex items-center gap-1">
                      <Handshake className="w-3.5 h-3.5 text-violet-500" /> لوحة مشتركة
                    </span>
                    <Badge className="bg-gradient-to-r from-violet-500 to-pink-500 text-white text-[9px] h-4.5 border-0 font-bold">
                      شراكة
                    </Badge>
                  </div>
                  {((billboard as any).partner_companies && Array.isArray((billboard as any).partner_companies) && (billboard as any).partner_companies.length > 0) && (
                    <div className="flex flex-wrap gap-1">
                      {(billboard as any).partner_companies.map((company: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-[9px] h-4.5 border-violet-300/40 text-violet-600 dark:text-violet-400">
                          {company}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {/* 4. الشركة المالكة والصديقة — شريط أفقي */}
              {((billboard as any).own_company?.name || (billboard as any).friend_companies?.name) && (
                <div className="flex flex-col gap-1.5 mt-2">

                  {/* الشركة المالكة */}
                  {(billboard as any).own_company?.name && (() => {
                    const bgColor = (billboard as any).own_company?.brand_color || '#3b82f6';
                    const textColor = (() => {
                      try {
                        const hex = bgColor.replace('#', '');
                        const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
                        return (r * 0.299 + g * 0.587 + b * 0.114) > 160 ? '#09090b' : '#ffffff';
                      } catch { return '#ffffff'; }
                    })();
                    return (
                      <div
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all duration-300 hover:shadow-md relative overflow-hidden"
                        style={{
                          background: `linear-gradient(90deg, ${bgColor}20 0%, ${bgColor}08 100%)`,
                          borderColor: `${bgColor}45`,
                        }}
                      >
                        {/* شريط اللون الجانبي */}
                        <div className="absolute right-0 top-0 bottom-0 w-1 rounded-r-xl" style={{ backgroundColor: bgColor }} />

                        {/* الشعار */}
                        {(billboard as any).own_company?.logo_url ? (
                          <img
                            src={(billboard as any).own_company.logo_url}
                            alt={(billboard as any).own_company.name}
                            className="w-7 h-7 rounded-lg object-contain bg-white shadow-sm border shrink-0"
                            style={{ borderColor: `${bgColor}50` }}
                          />
                        ) : (
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm border shrink-0"
                            style={{ backgroundColor: bgColor, borderColor: `${bgColor}50` }}
                          >
                            <Building className="h-3.5 w-3.5" style={{ color: textColor }} />
                          </div>
                        )}

                        {/* الاسم + الدور */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-black truncate leading-tight" title={(billboard as any).own_company.name}>
                            {(billboard as any).own_company.name}
                          </p>
                          <p className="text-[9px] font-semibold opacity-60 leading-none mt-0.5">الشركة المالكة</p>
                        </div>

                        {/* زر التعديل */}
                        {onUpdate && (
                          <div className="shrink-0">
                            <OwnerCompanyChanger
                              billboardId={(billboard as any).ID || (billboard as any).id}
                              currentOwnCompanyId={(billboard as any).own_company_id}
                              onUpdate={onUpdate}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* الشركة الصديقة */}
                  {(billboard as any).friend_companies?.name && (() => {
                    const bgColor = (billboard as any).friend_companies?.brand_color || '#06b6d4';
                    const textColor = (() => {
                      try {
                        const hex = bgColor.replace('#', '');
                        const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
                        return (r * 0.299 + g * 0.587 + b * 0.114) > 160 ? '#09090b' : '#ffffff';
                      } catch { return '#ffffff'; }
                    })();
                    return (
                      <div
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all duration-300 hover:shadow-md relative overflow-hidden"
                        style={{
                          background: `linear-gradient(90deg, ${bgColor}20 0%, ${bgColor}08 100%)`,
                          borderColor: `${bgColor}45`,
                        }}
                      >
                        {/* شريط اللون الجانبي */}
                        <div className="absolute right-0 top-0 bottom-0 w-1 rounded-r-xl" style={{ backgroundColor: bgColor }} />

                        {/* الشعار */}
                        {(billboard as any).friend_companies?.logo_url ? (
                          <img
                            src={(billboard as any).friend_companies.logo_url}
                            alt={(billboard as any).friend_companies.name}
                            className="w-7 h-7 rounded-lg object-contain bg-white shadow-sm border shrink-0"
                            style={{ borderColor: `${bgColor}50` }}
                          />
                        ) : (
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm border shrink-0"
                            style={{ backgroundColor: bgColor, borderColor: `${bgColor}50` }}
                          >
                            <Building className="h-3.5 w-3.5" style={{ color: textColor }} />
                          </div>
                        )}

                        {/* الاسم + الدور */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-black truncate leading-tight" title={(billboard as any).friend_companies.name}>
                            {(billboard as any).friend_companies.name}
                          </p>
                          <p className="text-[9px] font-semibold opacity-60 leading-none mt-0.5">الشركة الصديقة</p>
                        </div>
                      </div>
                    );
                  })()}

                </div>
              )}

            {/* معلومات العقد المنتهي للمدير فقط */}
            {isAdmin && contractExpired && (contractId || endDate || customerName) && (
              <div className="p-3.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-900/40 space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-rose-200/40 dark:border-rose-900/20">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-rose-500 dark:text-rose-400" />
                    <span className="font-bold text-xs text-rose-700 dark:text-rose-300">تفاصيل العقد المنتهي</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100/80 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 font-extrabold shadow-xs border border-rose-200 dark:border-rose-900/50">
                    منتهي
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {contractId && (
                    <div className="flex flex-col p-2 rounded-lg bg-white/70 dark:bg-black/20 border border-rose-100/40 dark:border-rose-900/10 shadow-xs">
                      <span className="text-[10px] text-rose-600/90 dark:text-rose-400/90 font-semibold">رقم العقد</span>
                      <span className="font-extrabold text-rose-950 dark:text-rose-100 mt-0.5">{contractId}</span>
                    </div>
                  )}
                  {endDate && (
                    <div className="flex flex-col p-2 rounded-lg bg-white/70 dark:bg-black/20 border border-rose-100/40 dark:border-rose-900/10 shadow-xs">
                      <span className="text-[10px] text-rose-600/90 dark:text-rose-400/90 font-semibold">تاريخ الانتهاء</span>
                      <span className="font-extrabold text-rose-950 dark:text-rose-100 mt-0.5">{formatLongArabicDate(endDate)}</span>
                    </div>
                  )}
                  {customerName && (
                    <div className="flex flex-col p-2 rounded-lg bg-white/70 dark:bg-black/20 border border-rose-100/40 dark:border-rose-900/10 shadow-xs col-span-2">
                      <span className="text-[10px] text-rose-600/90 dark:text-rose-400/90 font-semibold">الزبون</span>
                      <span className="font-extrabold text-rose-950 dark:text-rose-100 mt-0.5">{customerName}</span>
                    </div>
                  )}
                  {adType && (
                    <div className="flex flex-col p-2 rounded-lg bg-white/70 dark:bg-black/20 border border-rose-100/40 dark:border-rose-900/10 shadow-xs col-span-2">
                      <span className="text-[10px] text-rose-600/90 dark:text-rose-400/90 font-semibold">نوع الإعلان</span>
                      <span className="font-extrabold text-rose-950 dark:text-rose-100 mt-0.5">{adType}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* قسم معلومات التمديد */}
            {hasExtension && extensionData && (
              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-sky-500/5 border border-blue-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarPlus className="h-4 w-4 text-blue-600" />
                  <span className="font-semibold text-sm text-blue-600 dark:text-blue-400">تمديد مفعّل</span>
                  <Badge className="bg-gradient-to-r from-blue-500 to-sky-500 text-white text-xs border-0">
                    +{extensionData.extension_days} يوم
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex flex-col p-2 rounded-lg bg-blue-500/10">
                    <span className="text-muted-foreground">من تاريخ:</span>
                    <span className="font-medium text-foreground">{formatGregorianDate(extensionData.old_end_date, 'ar-LY')}</span>
                  </div>
                  <div className="flex flex-col p-2 rounded-lg bg-blue-500/10">
                    <span className="text-muted-foreground">إلى تاريخ:</span>
                    <span className="font-medium text-blue-600 dark:text-blue-400">{formatGregorianDate(extensionData.new_end_date, 'ar-LY')}</span>
                  </div>
                </div>

                {extensionData.reason && (
                  <div className="mt-3 pt-3 border-t border-blue-500/20">
                    <span className="text-xs text-muted-foreground">السبب: </span>
                    <span className="text-xs text-foreground">{extensionData.reason}</span>
                  </div>
                )}
              </div>
            )}

            {/* قسم حالة التركيب في الواقع - محسّن */}
            {isAdmin && (
              <Collapsible open={installationStatusOpen} onOpenChange={setInstallationStatusOpen} className="mt-4">
                <CollapsibleTrigger className="group flex items-center justify-between w-full px-3 py-2 rounded-lg bg-violet-500/8 border border-violet-500/20 hover:bg-violet-500/12 transition-all">
                  <div className="flex items-center gap-2">
                    <Camera className="h-3.5 w-3.5 text-violet-600" />
                    <span className="font-semibold text-xs text-foreground">تفاصيل التركيب والتصاميم</span>
                  </div>
                  {installationStatusOpen ? <ChevronUp className="h-3.5 w-3.5 text-violet-600" /> : <ChevronDown className="h-3.5 w-3.5 text-violet-600" />}
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="mt-3 p-4 bg-gradient-to-br from-background to-muted/30 rounded-xl border border-border/50 shadow-inner">
                    {loadingTask ? (
                      <div className="flex flex-col items-center justify-center py-8">
                        <div className="w-10 h-10 border-3 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mb-3" />
                        <p className="text-sm text-muted-foreground">جاري التحميل...</p>
                      </div>
                    ) : latestTask ? (
                      <div className="space-y-4">
                        {/* حالة ومعلومات المهمة */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 rounded-xl bg-gradient-to-br from-slate-500/10 to-gray-500/5 border border-slate-500/20">
                            <span className="text-xs text-muted-foreground block mb-1">الحالة</span>
                            {latestTask.status === 'completed' ? (
                              <Badge className="bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0 shadow-lg shadow-emerald-500/25">
                                <CheckCircle2 className="h-3 w-3 ml-1" />
                                مكتمل
                              </Badge>
                            ) : (
                              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-lg shadow-amber-500/25">
                                <Clock className="h-3 w-3 ml-1" />
                                معلق
                              </Badge>
                            )}
                          </div>

                          {latestTask.installation_date && (
                            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-sky-500/5 border border-blue-500/20">
                              <span className="text-xs text-muted-foreground block mb-1">تاريخ التركيب</span>
                              <span className="font-bold text-sm text-blue-600 dark:text-blue-400">
                                {formatGregorianDate(latestTask.installation_date)}
                              </span>
                            </div>
                          )}
                        </div>

                        {latestTask.task?.team?.team_name && (
                          <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500/10 to-blue-500/5 border border-indigo-500/20">
                            <span className="text-xs text-muted-foreground block mb-1">فريق التركيب</span>
                            <Badge variant="secondary" className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-0">
                              {latestTask.task.team.team_name}
                            </Badge>
                          </div>
                        )}

                        {latestTask.notes && (
                          <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border border-amber-500/20">
                            <span className="text-xs text-muted-foreground block mb-2">ملاحظات</span>
                            <p className="text-sm text-foreground bg-white/50 dark:bg-black/20 p-2 rounded-lg">{latestTask.notes}</p>
                          </div>
                        )}

                        {/* التصاميم - الأمامي والخلفي */}
                        {(latestTask.selected_design || latestTask.design_face_a || latestTask.design_face_b) && (
                          <div className="space-y-3 pt-3 border-t border-border/50">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600">
                                <ImageIcon className="h-3 w-3 text-white" />
                              </div>
                              <h4 className="font-bold text-sm text-foreground">التصاميم</h4>
                              {latestTask.selected_design?.design_name && (
                                <Badge className="bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 border-0 text-xs">
                                  {latestTask.selected_design.design_name}
                                </Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              {/* التصميم الأمامي */}
                              {(latestTask.design_face_a || latestTask.selected_design?.design_face_a_url) && (
                                <div className="space-y-2">
                                  <p className="text-xs text-muted-foreground font-medium">الوجه الأمامي</p>
                                  <div 
                                    className="relative aspect-video rounded-xl overflow-hidden border-2 border-pink-500/30 shadow-lg shadow-pink-500/10 group/img cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDesignPreview(
                                        latestTask.design_face_a || latestTask.selected_design?.design_face_a_url,
                                        'التصميم الأمامي'
                                      );
                                    }}
                                  >
                                    <img 
                                      src={latestTask.design_face_a || latestTask.selected_design?.design_face_a_url} 
                                      alt="التصميم الأمامي" 
                                      className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = "/placeholder.svg";
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                      <ZoomIn className="h-6 w-6 text-white" />
                                    </div>
                                  </div>
                                </div>
                              )}
                              {/* التصميم الخلفي */}
                              {(latestTask.design_face_b || latestTask.selected_design?.design_face_b_url) && (
                                <div className="space-y-2">
                                  <p className="text-xs text-muted-foreground font-medium">الوجه الخلفي</p>
                                  <div 
                                    className="relative aspect-video rounded-xl overflow-hidden border-2 border-purple-500/30 shadow-lg shadow-purple-500/10 group/img cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDesignPreview(
                                        latestTask.design_face_b || latestTask.selected_design?.design_face_b_url,
                                        'التصميم الخلفي'
                                      );
                                    }}
                                  >
                                    <img 
                                      src={latestTask.design_face_b || latestTask.selected_design?.design_face_b_url} 
                                      alt="التصميم الخلفي" 
                                      className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = "/placeholder.svg";
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                      <ZoomIn className="h-6 w-6 text-white" />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* التصاميم من العقد (fallback عند عدم وجود مهمة تركيب بتصاميم) */}
                        {!latestTask?.design_face_a && !latestTask?.design_face_b && !latestTask?.selected_design?.design_face_a_url && activeContract?.design_data && (() => {
                          let contractDesignA: string | null = null;
                          let contractDesignB: string | null = null;
                          try {
                            const designData = typeof activeContract.design_data === 'string' 
                              ? JSON.parse(activeContract.design_data) : activeContract.design_data;
                            if (Array.isArray(designData)) {
                              const match = designData.find((d: any) => String(d.billboardId) === String(billboard.ID));
                              if (match) {
                                contractDesignA = match.design_face_a_url || match.designFaceA || null;
                                contractDesignB = match.design_face_b_url || match.designFaceB || null;
                              }
                            } else if (designData && typeof designData === 'object') {
                              contractDesignA = designData.design_face_a_url || designData.designFaceA || null;
                              contractDesignB = designData.design_face_b_url || designData.designFaceB || null;
                            }
                          } catch {}
                          
                          if (!contractDesignA && !contractDesignB) return null;
                          
                          return (
                            <div className="space-y-3 pt-3 border-t border-border/50">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600">
                                  <ImageIcon className="h-3 w-3 text-white" />
                                </div>
                                <h4 className="font-bold text-sm text-foreground">التصاميم (من العقد)</h4>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                {contractDesignA && (
                                  <div className="space-y-2">
                                    <p className="text-xs text-muted-foreground font-medium">الوجه الأمامي</p>
                                    <div 
                                      className="relative aspect-video rounded-xl overflow-hidden border-2 border-pink-500/30 shadow-lg shadow-pink-500/10 group/img cursor-pointer"
                                      onClick={(e) => { e.stopPropagation(); openDesignPreview(contractDesignA!, 'التصميم الأمامي'); }}
                                    >
                                      <img src={contractDesignA} alt="التصميم الأمامي" className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110" onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }} />
                                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                        <ZoomIn className="h-6 w-6 text-white" />
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {contractDesignB && (
                                  <div className="space-y-2">
                                    <p className="text-xs text-muted-foreground font-medium">الوجه الخلفي</p>
                                    <div 
                                      className="relative aspect-video rounded-xl overflow-hidden border-2 border-purple-500/30 shadow-lg shadow-purple-500/10 group/img cursor-pointer"
                                      onClick={(e) => { e.stopPropagation(); openDesignPreview(contractDesignB!, 'التصميم الخلفي'); }}
                                    >
                                      <img src={contractDesignB} alt="التصميم الخلفي" className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110" onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }} />
                                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                        <ZoomIn className="h-6 w-6 text-white" />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* صور التركيب الفعلي - الأمامي والخلفي */}
                        {(latestTask.installed_image_url || latestTask.installed_image_face_a_url || latestTask.installed_image_face_b_url) && (
                          <div className="space-y-3 pt-3 border-t border-border/50">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600">
                                <Camera className="h-3 w-3 text-white" />
                              </div>
                              <h4 className="font-bold text-sm text-foreground">صور التركيب الفعلي</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              {/* صورة التركيب الأمامي */}
                              {(latestTask.installed_image_url || latestTask.installed_image_face_a_url) && (
                                <div className="space-y-2">
                                  <p className="text-xs text-muted-foreground font-medium">الوجه الأمامي</p>
                                  <div 
                                    className="relative aspect-video rounded-xl overflow-hidden border-2 border-emerald-500/30 shadow-lg shadow-emerald-500/10 group/img cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDesignPreview(
                                        latestTask.installed_image_url || latestTask.installed_image_face_a_url,
                                        'صورة التركيب - الوجه الأمامي'
                                      );
                                    }}
                                  >
                                    <img 
                                      src={latestTask.installed_image_url || latestTask.installed_image_face_a_url} 
                                      alt="صورة التركيب الأمامي" 
                                      className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = "/placeholder.svg";
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                      <ZoomIn className="h-6 w-6 text-white" />
                                    </div>
                                  </div>
                                </div>
                              )}
                              {/* صورة التركيب الخلفي */}
                              {latestTask.installed_image_face_b_url && (
                                <div className="space-y-2">
                                  <p className="text-xs text-muted-foreground font-medium">الوجه الخلفي</p>
                                  <div 
                                    className="relative aspect-video rounded-xl overflow-hidden border-2 border-teal-500/30 shadow-lg shadow-teal-500/10 group/img cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDesignPreview(
                                        latestTask.installed_image_face_b_url,
                                        'صورة التركيب - الوجه الخلفي'
                                      );
                                    }}
                                  >
                                    <img 
                                      src={latestTask.installed_image_face_b_url} 
                                      alt="صورة التركيب الخلفي" 
                                      className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = "/placeholder.svg";
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                      <ZoomIn className="h-6 w-6 text-white" />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8">
                        <div className="p-4 rounded-full bg-muted/50 mb-3">
                          <XCircle className="h-10 w-10 text-muted-foreground/40" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">لا توجد بيانات تركيب</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">لم يتم إضافة هذه اللوحة إلى أي مهمة تركيب</p>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* CTA Dock — كل العناصر في صف أفقي واحد */}
            <div className="mt-auto pt-3 border-t border-primary/15">
              <div className="flex items-center gap-1.5 flex-wrap">

                {/* حجز سريع */}
                {showBookingActions && (
                  <Button
                    onClick={() => onBooking?.(billboard)}
                    className={`flex-1 h-9 font-bold text-sm rounded-xl shadow-md transition-all duration-300 border-0 min-w-[80px] ${
                      isAvailable
                        ? 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground hover:shadow-[0_8px_24px_-6px_hsl(var(--primary)/0.5)] hover:scale-[1.02]'
                        : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                    }`}
                  >
                    {isAvailable ? (
                      <span className="flex items-center justify-center gap-1">
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        حجز
                      </span>
                    ) : (
                      'تفريغ'
                    )}
                  </Button>
                )}

                {/* تمديد الإيجار */}
                {isAdmin && hasActiveContract && endDate && (
                  <Button
                    onClick={() => setExtendDialogOpen(true)}
                    aria-label={hasExtension ? 'تمديد إضافي' : 'تمديد الإيجار'}
                    title={hasExtension ? 'تمديد إضافي' : 'تمديد الإيجار'}
                    className={`h-9 w-9 p-0 rounded-xl shadow-sm border-0 shrink-0 ${
                      hasExtension
                        ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white hover:scale-105'
                        : 'bg-gradient-to-br from-emerald-500 to-green-600 text-white hover:scale-105'
                    } transition-all`}
                  >
                    <CalendarPlus className="h-4 w-4" />
                  </Button>
                )}

                {/* تاريخ اللوحة */}
                {isAdmin && (
                  <Button
                    onClick={() => setHistoryOpen(true)}
                    aria-label="تاريخ اللوحة"
                    title="تاريخ اللوحة"
                    variant="outline"
                    className="h-9 w-9 p-0 rounded-xl border border-primary/30 bg-primary/5 text-primary hover:bg-primary hover:text-primary-foreground shrink-0 transition-all"
                  >
                    <History className="h-4 w-4" />
                  </Button>
                )}

                {/* خريطة + تفاصيل */}
                {showBookingActions && (
                  <>
                    <Button
                      onClick={() => { if (billboard.GPS_Coordinates) window.open(`https://www.google.com/maps/@${billboard.GPS_Coordinates}`, '_blank'); }}
                      disabled={!billboard.GPS_Coordinates}
                      aria-label="فتح على الخريطة"
                      title="فتح على الخريطة"
                      variant="outline"
                      className="h-9 w-9 p-0 rounded-xl border border-border bg-background text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary disabled:opacity-40 shrink-0 transition-all"
                    >
                      <MapPin className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => onViewDetails?.(billboard)}
                      aria-label="عرض التفاصيل"
                      title="عرض التفاصيل"
                      variant="outline"
                      className="h-9 w-9 p-0 rounded-xl border border-border bg-background text-foreground hover:bg-primary hover:text-primary-foreground shrink-0 transition-all"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </>
                )}

                {/* إعلان ممزق + ظاهر/مخفي — في نفس الصف */}
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const billboardId = Number(billboard.ID);
                          const tornStatus = activeStatuses?.find((s) => s.status_type === 'torn_ad');
                          if (tornStatus) {
                            const { error } = await supabase.from('billboard_statuses' as any).update({ is_resolved: true, resolved_at: new Date().toISOString() }).eq('id', tornStatus.id);
                            if (error) throw error;
                            await supabase.from('billboards' as any).update({ maintenance_status: 'operational' }).eq('ID', billboardId);
                            onLocalUpdate?.(billboard.ID, { maintenance_status: 'operational' });
                            toast.success('تم إلغاء حالة الإعلان الممزق');
                          } else {
                            const { data: u } = await supabase.auth.getUser();
                            const { error } = await supabase.from('billboard_statuses' as any).insert({ billboard_id: billboardId, status_type: 'torn_ad', note: null, created_by: u.user?.id || null });
                            if (error) throw error;
                            await supabase.from('billboards' as any).update({ maintenance_status: 'torn' }).eq('ID', billboardId);
                            onLocalUpdate?.(billboard.ID, { maintenance_status: 'torn' });
                            toast.success('تم تسجيل اللوحة كإعلان ممزق');
                          }
                          window.dispatchEvent(new CustomEvent('billboard-statuses-changed'));
                        } catch (e: any) { toast.error(e?.message || 'فشل العملية'); }
                      }}
                      title={isTorn ? 'إلغاء حالة الممزق' : 'تسجيل كإعلان ممزق'}
                      className={`h-9 w-9 p-0 rounded-xl border flex items-center justify-center shrink-0 transition-all ${
                        isTorn
                          ? 'border-destructive bg-destructive/10 text-destructive hover:bg-destructive/20'
                          : 'border-border bg-muted/30 text-muted-foreground hover:bg-destructive/10 hover:border-destructive/40 hover:text-destructive'
                      }`}
                    >
                      <AlertTriangle className="h-4 w-4" />
                    </button>

                    <button
                      onClick={handleToggleVisibility}
                      title={isVisibleInAvailable ? 'إخفاء من المتاحة' : 'إظهار في المتاحة'}
                      className={`h-9 w-9 p-0 rounded-xl border flex items-center justify-center shrink-0 transition-all ${
                        isVisibleInAvailable
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                          : 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20'
                      }`}
                    >
                      {isVisibleInAvailable ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                  </>
                )}

              </div>
            </div>
        </CardContent>
      </div>
    </Card>

    {/* Image Preview Dialog - نافذة تكبير الصورة */}
    <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-0 [&>button]:hidden">
        <div className="relative w-full h-full flex items-center justify-center min-h-[60vh]">
          {/* زر الإغلاق */}
          <button
            onClick={() => setPreviewOpen(false)}
            aria-label="إغلاق"
            className="absolute top-4 right-4 z-50 h-11 w-11 flex items-center justify-center rounded-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-2xl border-2 border-white/30 transition-all hover:scale-110 cursor-pointer"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </button>
          
          {/* معلومات اللوحة */}
          <div className="absolute top-4 left-4 z-50 bg-black/50 rounded-lg px-4 py-2 backdrop-blur-sm">
            <h3 className="text-white font-bold text-lg">
              {billboard.Billboard_Name || `لوحة ${billboard.ID}`}
            </h3>
            <p className="text-white/70 text-sm">{billboard.Size} • {billboard.Municipality}</p>
          </div>
          
          {/* الصورة المكبرة */}
          {activeMediaView === 'design' && frontDesignUrl ? (
            <img 
              src={frontDesignUrl} 
              alt="التصميم" 
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" 
            />
          ) : activeMediaView === 'installation' && (latestTask?.installed_image_url || latestTask?.installed_image_face_a_url || latestTask?.installed_image_face_b_url) ? (
            <img 
              src={latestTask.installed_image_url || latestTask.installed_image_face_a_url || latestTask.installed_image_face_b_url} 
              alt="صورة التركيب" 
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" 
            />
          ) : (
            <BillboardImage 
              billboard={billboard} 
              alt={billboard.Billboard_Name} 
              className="max-w-full max-h-[85vh] object-contain" 
            />
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Dialog تاريخ اللوحة */}
    <BillboardHistoryDialog
      open={historyOpen}
      onOpenChange={setHistoryOpen}
      billboardId={billboard.ID}
      billboardName={billboard.Billboard_Name || `لوحة #${billboard.ID}`}
    />

    {/* Dialog تمديد الإيجار */}
    <BillboardExtendRentalDialog
      open={extendDialogOpen}
      onOpenChange={setExtendDialogOpen}
      billboard={{
        ID: billboard.ID,
        Billboard_Name: billboard.Billboard_Name,
        Rent_End_Date: endDate,
        Contract_Number: (billboard as any).Contract_Number
      }}
      onSuccess={onUpdate}
    />

    {/* Dialog عرض/تعديل الأسعار حسب الفئات السعرية */}
    <Dialog open={quickEditOpen} onOpenChange={setQuickEditOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">الأسعار والمستوى</DialogTitle>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <Badge variant="outline" className="text-xs font-mono">{billboard.Billboard_Name}</Badge>
            {billboard.Size && <Badge variant="secondary" className="text-xs font-bold">{billboard.Size}</Badge>}
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary">المستوى: {quickEditLevel}</Badge>
          </div>
        </DialogHeader>
        {loadingPricing ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">جاري تحميل الأسعار...</div>
        ) : (
          <div className="space-y-4 py-2">
            {/* تغيير المستوى */}
            <div>
              <Label className="text-foreground text-sm">مستوى اللوحة</Label>
              <Select 
                value={quickEditLevel} 
                onValueChange={(v) => {
                  setQuickEditLevel(v);
                  loadPricingForSizeLevel(billboard.Size || '', v);
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="اختر المستوى" />
                </SelectTrigger>
                <SelectContent>
                  {levels.map((lv) => (
                    <SelectItem key={lv} value={lv}>{lv}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* جدول الأسعار حسب الفئة السعرية */}
            {pricingRows.length > 0 ? (
              <div className="space-y-3">
                {/* اختيار الفئة السعرية مع بحث */}
                <div className="space-y-2">
                  <Label className="text-foreground text-sm font-semibold">الفئة السعرية</Label>
                  <Input
                    type="text"
                    placeholder="ابحث عن الفئة السعرية..."
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    className="h-9 text-sm"
                  />
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                    {availableCategories
                      .filter(cat => !categorySearch || cat.includes(categorySearch))
                      .map((cat) => (
                        <button
                          key={cat}
                          onClick={() => { setSelectedCategory(cat); setCategorySearch(''); }}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                            selectedCategory === cat
                              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                              : 'bg-muted/50 text-foreground border-border hover:bg-muted'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    {availableCategories.filter(cat => !categorySearch || cat.includes(categorySearch)).length === 0 && (
                      <span className="text-xs text-muted-foreground py-2">لا توجد نتائج</span>
                    )}
                  </div>
                </div>

                {/* عرض أسعار الفئة المختارة */}
                {selectedCategory && editingPrices[selectedCategory] && (() => {
                  const prices = editingPrices[selectedCategory];
                  const fields = [
                    { key: 'one_day', label: 'يوم واحد' },
                    { key: 'one_month', label: 'شهر' },
                    { key: '2_months', label: 'شهرين' },
                    { key: '3_months', label: '3 أشهر' },
                    { key: '6_months', label: '6 أشهر' },
                    { key: 'full_year', label: 'سنة' },
                  ];
                  return (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs">
                        أسعار المقاس {billboard.Size} - المستوى {quickEditLevel} - الفئة: {selectedCategory}
                      </Label>
                      <div className="grid grid-cols-3 gap-2">
                        {fields.map(({ key, label }) => (
                          <div key={key} className="p-3 rounded-lg border border-border bg-muted/30 text-center">
                            <span className="text-xs text-muted-foreground block mb-1">{label}</span>
                            {isEditMode ? (
                              <Input
                                type="number"
                                min="0"
                                value={prices[key] || ''}
                                onChange={(e) => {
                                  setEditingPrices(prev => ({
                                    ...prev,
                                    [selectedCategory]: { ...prev[selectedCategory], [key]: Number(e.target.value) || 0 }
                                  }));
                                }}
                                className="h-8 text-center text-sm font-mono"
                                placeholder="0"
                              />
                            ) : (
                              <span className="font-bold text-foreground text-sm font-mono">
                                {prices[key] ? Number(prices[key]).toLocaleString() : '-'}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground text-sm">
                لا توجد أسعار مسجلة لهذا المقاس والمستوى
              </div>
            )}
          </div>
        )}
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => setQuickEditOpen(false)}>إغلاق</Button>
          {quickEditLevel !== billboard.Level && !isEditMode && (
            <Button onClick={handleQuickEditSave} disabled={savingQuickEdit}>
              {savingQuickEdit ? 'جاري الحفظ...' : 'حفظ المستوى'}
            </Button>
          )}
          {!isEditMode && pricingRows.length > 0 ? (
            <Button variant="secondary" onClick={() => setIsEditMode(true)}>
              <Pencil className="h-4 w-4 ml-1" />
              تعديل الأسعار
            </Button>
          ) : isEditMode ? (
            <Button onClick={handleQuickEditSave} disabled={savingQuickEdit || loadingPricing}>
              {savingQuickEdit ? 'جاري الحفظ...' : 'حفظ الأسعار'}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Dialog تكبير التصاميم وصور التركيب */}
    <Dialog open={designPreviewOpen} onOpenChange={setDesignPreviewOpen}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-0 [&>button]:hidden">
        <div className="relative w-full h-full flex items-center justify-center min-h-[60vh]">
          {/* زر الإغلاق */}
          <button
            onClick={() => setDesignPreviewOpen(false)}
            aria-label="إغلاق"
            className="absolute top-4 right-4 z-50 h-11 w-11 flex items-center justify-center rounded-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-2xl border-2 border-white/30 transition-all hover:scale-110 cursor-pointer"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </button>
          
          {/* عنوان الصورة */}
          <div className="absolute top-4 left-4 z-50 bg-black/50 rounded-lg px-4 py-2 backdrop-blur-sm">
            <h3 className="text-white font-bold text-lg">{designPreviewTitle}</h3>
            <p className="text-white/70 text-sm">{billboard.Billboard_Name || `لوحة ${billboard.ID}`}</p>
          </div>
          
          {/* الصورة المكبرة */}
          <img 
            src={designPreviewUrl} 
            alt={designPreviewTitle}
            className="max-w-full max-h-[85vh] object-contain" 
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = "/placeholder.svg";
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  </>
  );
};

export const BillboardGridCard = memo(BillboardGridCardInner);
