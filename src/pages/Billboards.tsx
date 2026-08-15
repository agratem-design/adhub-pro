import { useState, useEffect, useMemo, useRef, lazy, Suspense, startTransition } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useAuth } from '@/contexts/AuthContext';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, ChevronDown, ChevronUp, BarChart3, Map as MapIcon, Zap, Loader2, Sparkles, Camera } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BillboardGridCard } from '@/components/BillboardGridCard';
import { useAllActiveBillboardStatuses } from '@/hooks/useBillboardStatuses';
import { BillboardFilters } from '@/components/BillboardFilters';
import { BillboardActions } from '@/components/BillboardActions';
import { BillboardAddDialog } from '@/components/billboards/BillboardAddDialog';
import { BillboardEditDialog } from '@/components/billboards/BillboardEditDialog';
import { BillboardSummaryCards } from '@/components/billboards/BillboardSummaryCards';
import { MaintenanceDialog } from '@/components/billboards/MaintenanceDialog';
import { BulkAddDialog, ExcelImportDialog, ExcelImageImportDialog, BatchPhotoAddBillboardsDialog } from '@/components/billboards/forms';
import { ContractManagementDialog } from '@/components/billboards/ContractManagementDialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PrintFiltersDialog } from '@/components/billboards/PrintFiltersDialog';
import { BillboardPrintWithSelection } from '@/components/billboards/BillboardPrintWithSelection';
import { BillboardSelectionBar } from '@/components/billboards/BillboardSelectionBar';
import BillboardPhotoOverlayEditor, { BillboardOverlayConfig, CollectionItemForOverlay, sanitizeOverlayConfig } from '@/components/municipality/BillboardPhotoOverlayEditor';
import { BillboardOverlaySelectorDialog } from '@/components/billboards/BillboardOverlaySelectorDialog';
import { useBillboardData } from '@/hooks/useBillboardData';
import { useBillboardForm } from '@/hooks/useBillboardForm';
import { sortBillboardsStandardSync } from '@/lib/billboardSorter';
import { useBillboardActions } from '@/hooks/useBillboardActions';
import { useBillboardExport } from '@/hooks/useBillboardExport';
import { useBillboardContract } from '@/hooks/useBillboardContract';
import { isBillboardAvailable } from '@/utils/contractUtils';
import { smartArabicMatch } from '@/lib/arabicSearch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MapSkeleton } from '@/components/Map/MapSkeleton';

// ✅ تحميل كسول للخريطة لتحسين الأداء + دعم التبديل بين Google / OSM
const AdminBillboardsMap = lazy(() => import('@/components/Map/AdminBillboardsMap'));

export default function Billboards() {
  const navigate = useNavigate();
  const { user, canEdit } = useAuth();
  const canEditBillboards = canEdit('billboards');
  const isMarketer = user?.role === 'marketer';
  const marketerCustomerId = user?.linkedCustomerId;
  const [currentPage, setCurrentPage] = usePersistedState<number>('billboards.currentPage', 1);
  const [gridColumns, setGridColumns] = usePersistedState<number>('billboards.gridColumns', 260);
  const PAGE_SIZE = 24; // fixed page size

  // Filter states
  const [searchQuery, setSearchQuery] = usePersistedState<string>('billboards.search', '');
  const [selectedStatuses, setSelectedStatuses] = usePersistedState<string[]>('billboards.statuses', []);
  const [selectedCities, setSelectedCities] = usePersistedState<string[]>('billboards.cities', []);
  const [selectedSizes, setSelectedSizes] = usePersistedState<string[]>('billboards.sizes', []);
  const [selectedMunicipalities, setSelectedMunicipalities] = usePersistedState<string[]>('billboards.municipalities', []);
  const [showSociet, setShowSociet] = usePersistedState<boolean>('billboards.showSociet', false);
  const [selectedDistricts, setSelectedDistricts] = usePersistedState<string[]>('billboards.districts', []);
  const [selectedAdTypes, setSelectedAdTypes] = usePersistedState<string[]>('billboards.adTypes', []);
  const [selectedCustomers, setSelectedCustomers] = usePersistedState<string[]>('billboards.customers', []);
  const [selectedContractNumbers, setSelectedContractNumbers] = usePersistedState<string[]>('billboards.contractNumbers', []);
  const [selectedOwnerCompanies, setSelectedOwnerCompanies] = usePersistedState<string[]>('billboards.ownerCompanies', []);
  const [ownerCompanies, setOwnerCompanies] = useState<{id: string, name: string}[]>([]);

  // Load owner companies
  useEffect(() => {
    supabase.from('friend_companies').select('id, name').eq('company_type', 'own').order('name')
      .then(({ data }) => setOwnerCompanies(data || []));
  }, []);
  
  // ✅ Marketer: load billboard IDs from their customer's contracts
  const [marketerBillboardIds, setMarketerBillboardIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!isMarketer || !marketerCustomerId) return;
    const loadMarketerBillboards = async () => {
      const { data } = await supabase
        .from('Contract')
        .select('billboard_ids')
        .eq('customer_id', marketerCustomerId);
      const ids = new Set<string>();
      data?.forEach((c: any) => {
        if (c.billboard_ids) {
          String(c.billboard_ids).split(',').forEach((id: string) => ids.add(id.trim()));
        }
      });
      setMarketerBillboardIds(ids);
    };
    loadMarketerBillboards();
  }, [isMarketer, marketerCustomerId]);

  // Collapsible states
  const [summaryOpen, setSummaryOpen] = useState(false);
 const [mapOpen, setMapOpen] = useState(true); // مفتوحة افتراضياً لعرض الخريطة الجديدة فوراً

  // Print filters
  const [printFiltersOpen, setPrintFiltersOpen] = useState(false);
  const [advancedPrintOpen, setAdvancedPrintOpen] = useState(false);
  
  // ✅ Bulk add and Excel import dialogs
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [excelImportOpen, setExcelImportOpen] = useState(false);
  const [excelImageImportOpen, setExcelImageImportOpen] = useState(false);
  const [batchPhotoImportOpen, setBatchPhotoImportOpen] = useState(false);
  // ✅ Billboard selection state
  const [selectedBillboardIds, setSelectedBillboardIds] = useState<Set<number>>(new Set());
  const [excludeFriendlyAndHidden, setExcludeFriendlyAndHidden] = useState(true);
  const [selectAvailableOnly, setSelectAvailableOnly] = useState(false);
  const { data: activeStatusesMap = {} } = useAllActiveBillboardStatuses();
  const [printFilters, setPrintFilters] = useState({
    municipality: 'all',
    city: 'all',
    size: 'all',
    status: 'all',
    adType: 'all'
  });

  // Maintenance dialog state
  const [isMaintenanceDialogOpen, setIsMaintenanceDialogOpen] = useState(false);

  // Quick Add dialog state
  const [isQuickAddDialogOpen, setIsQuickAddDialogOpen] = useState(false);
  const [quickAddCoords, setQuickAddCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [quickAddLandmark, setQuickAddLandmark] = useState('');
  const [quickAdding, setQuickAdding] = useState(false);
  const [selectedBillboard, setSelectedBillboard] = useState<any>(null);
  const [maintenanceForm, setMaintenanceForm] = useState({
    status: '',
    type: '',
    description: '',
    priority: 'normal'
  });

  // Custom hooks
  const billboardData = useBillboardData();
  const billboardForm = useBillboardForm(billboardData.municipalities);
  const billboardActions = useBillboardActions();
  const billboardExport = useBillboardExport();
  const billboardContract = useBillboardContract();

  const { 
    billboards, 
    loading, 
    citiesList, 
    dbSizes, 
    dbMunicipalities, 
    dbAdTypes, 
    dbCustomers, 
    dbContractNumbers, 
    loadBillboards,
    updateBillboardVisibilityLocal,
    updateBillboardLocal,
    municipalities,
    sizes,
    levels,
    faces,
    billboardTypes,
    setMunicipalities,
    setSizes,
    setLevels,
    setBillboardTypes,
    setDbMunicipalities,
    setDbSizes,
    sortBillboardsBySize
  } = billboardData;

  const { isContractExpired, hasActiveContract } = billboardActions;
  // ✅ refs لتفادي إعادة ربط مستمعي الأحداث عند كل تغيير في billboards
  const billboardsRef = useRef(billboards);
  const updateBillboardLocalRef = useRef(updateBillboardLocal);
  const updateBillboardVisibilityLocalRef = useRef(updateBillboardVisibilityLocal);
  useEffect(() => { billboardsRef.current = billboards; }, [billboards]);
  useEffect(() => { updateBillboardLocalRef.current = updateBillboardLocal; }, [updateBillboardLocal]);
  useEffect(() => { updateBillboardVisibilityLocalRef.current = updateBillboardVisibilityLocal; }, [updateBillboardVisibilityLocal]);

  const handleMapRightClick = async (lat: number, lng: number, mode?: 'quick' | 'full') => {
    const coordsStr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

    if (mode === 'quick') {
      setQuickAddCoords({ lat, lng });
      setQuickAddLandmark('');
      setIsQuickAddDialogOpen(true);
    } else {
      // mode === 'full'
      try {
        const { data: lastBillboard } = await supabase
          .from('billboards')
          .select('Image_URL, image_name')
          .order('ID', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastBillboard) {
          billboardForm.initializeAddForm({ 
            GPS_Coordinates: coordsStr,
            Image_URL: lastBillboard.Image_URL || '',
            image_name: lastBillboard.image_name || '',
            hasCustomImage: !!lastBillboard.Image_URL
          });
        } else {
          billboardForm.initializeAddForm({ GPS_Coordinates: coordsStr });
        }
      } catch (err) {
        billboardForm.initializeAddForm({ GPS_Coordinates: coordsStr });
      }
      billboardForm.setAddOpen(true);
    }
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddCoords) return;

    setQuickAdding(true);
    const coordsStr = `${quickAddCoords.lat.toFixed(6)}, ${quickAddCoords.lng.toFixed(6)}`;

    try {
      const { data: lastBillboard, error: lastError } = await supabase
        .from('billboards')
        .select('*')
        .order('ID', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastError) throw lastError;

      if (!lastBillboard) {
        toast.error('لا توجد لوحات سابقة في النظام لجلب البيانات منها. يرجى استخدام الإضافة الكاملة.');
        setIsQuickAddDialogOpen(false);
        return;
      }

      const munName = lastBillboard.Municipality;
      if (!munName) {
        toast.error('اللوحة الأخيرة المضافة لا تحتوي على بلدية صالحة.');
        setIsQuickAddDialogOpen(false);
        return;
      }

      // Get municipality code
      const { data: municipalityData } = await supabase
        .from('municipalities')
        .select('code')
        .eq('name', munName)
        .maybeSingle();

      const municipalityCode = municipalityData?.code || 'XX';

      // Get highest billboard ID to generate next ID
      const { data: billboardsData, error: billboardsError } = await supabase
        .from('billboards')
        .select('ID')
        .order('ID', { ascending: false })
        .limit(1);

      let nextId = 1;
      if (!billboardsError && billboardsData && billboardsData.length > 0) {
        nextId = (billboardsData[0].ID || 0) + 1;
      }

      const paddedId = String(nextId).padStart(4, '0');
      const billboardName = `${municipalityCode}${paddedId}`;
      const imageName = `${billboardName}.jpg`;

      const payload = {
        ID: nextId,
        Billboard_Name: billboardName,
        City: lastBillboard.City || '',
        Municipality: munName,
        District: lastBillboard.District || '',
        Nearest_Landmark: quickAddLandmark.trim(), // القيمة التي أدخلها المستخدم
        GPS_Coordinates: coordsStr,
        Faces_Count: lastBillboard.Faces_Count || 1,
        Size: lastBillboard.Size || '',
        size_id: lastBillboard.size_id || null,
        Level: lastBillboard.Level || '',
        Image_URL: lastBillboard.Image_URL || `/image/${imageName}`,
        image_name: lastBillboard.image_name || imageName,
        billboard_type: lastBillboard.billboard_type || '',
        Status: 'متاح',
        is_partnership: !!lastBillboard.is_partnership,
        partner_companies: lastBillboard.partner_companies || [],
        capital: Number(lastBillboard.capital) || 0,
        capital_remaining: Number(lastBillboard.capital_remaining) || Number(lastBillboard.capital) || 0,
        own_company_id: lastBillboard.own_company_id || null,
        is_visible_in_available: lastBillboard.is_visible_in_available !== false
      };

      const { error: insertError } = await supabase
        .from('billboards')
        .insert(payload);

      if (insertError) throw insertError;

      toast.success(`تمت إضافة اللوحة الجديدة بنجاح! الاسم: ${billboardName}، البلدية: ${munName}، المقاس: ${lastBillboard.Size || 'غير محدد'}`);
      await loadBillboards({ silent: true });
      setIsQuickAddDialogOpen(false);
    } catch (err: any) {
      console.error('Error in Quick Add:', err);
      toast.error(`فشلت الإضافة السريعة: ${err.message || err}`);
    } finally {
      setQuickAdding(false);
    }
  };

  // Listen for edit-billboard events from map popups (no page reload)
  useEffect(() => {
    const handler = (e: Event) => {
      const editId = (e as CustomEvent).detail;
      const list = billboardsRef.current;
      if (editId && list.length > 0) {
        const billboard = list.find((b: any) => String(b.ID) === String(editId));
        if (billboard) {
          billboardForm.setEditing(billboard);
          billboardForm.setEditOpen(true);
        }
      }
    };
    
    const maintenanceHandler = (e: Event) => {
      const billboardId = (e as CustomEvent).detail;
      const list = billboardsRef.current;
      if (billboardId && list.length > 0) {
        const billboard = list.find((b: any) => String(b.ID) === String(billboardId));
        if (billboard) {
          setSelectedBillboard(billboard);
          setMaintenanceForm({
            status: billboard.maintenance_status || '',
            type: billboard.maintenance_type || '',
            description: billboard.maintenance_notes || '',
            priority: billboard.maintenance_priority || 'normal'
          });
          setIsMaintenanceDialogOpen(true);
        }
      }
    };
    
    const visibilityHandler = async (e: Event) => {
      const billboardId = (e as CustomEvent).detail;
      const list = billboardsRef.current;
      if (billboardId && list.length > 0) {
        const billboard = list.find((b: any) => String(b.ID) === String(billboardId)) as any;
        if (billboard) {
          const previousValue = billboard.is_visible_in_available !== false;
          const newValue = !previousValue;

          // ✅ Optimistic update: update popup/card state instantly
          updateBillboardVisibilityLocalRef.current(billboard.ID, newValue);

          try {
            const { error } = await supabase
              .from('billboards')
              .update({ is_visible_in_available: newValue })
              .eq('ID', billboard.ID);
            if (error) throw error;

            toast.success(newValue ? 'تم إظهار اللوحة في المتاح' : 'تم إخفاء اللوحة من المتاح');
          } catch (error) {
            // ✅ Rollback optimistic update on failure
            updateBillboardVisibilityLocalRef.current(billboard.ID, previousValue);
            toast.error('حدث خطأ أثناء تحديث الحالة');
          }
        }
      }
    };
    
    const ownerChangeHandler = async (e: Event) => {
      const { billboardId, currentOwnCompanyId } = (e as CustomEvent).detail || {};
      if (!billboardId) return;
      // Open a simple prompt-like flow: fetch companies and show selection
      const { data: companies } = await supabase.from('friend_companies').select('id, name').eq('company_type', 'own').order('name');
      if (!companies || companies.length === 0) { toast.error('لا توجد شركات مالكة'); return; }
      
      const companyNames = companies.map((c, i) => `${i + 1}. ${c.name}`).join('\n');
      const choice = window.prompt(`اختر الشركة المالكة (أدخل الرقم):\n0. بدون شركة\n${companyNames}`);
      if (choice === null) return;
      
      const idx = parseInt(choice);
      const newCompanyId = idx === 0 ? null : companies[idx - 1]?.id;
      if (idx !== 0 && !newCompanyId) { toast.error('اختيار غير صحيح'); return; }
      
      const { error } = await supabase.from('billboards').update({ own_company_id: newCompanyId } as any).eq('ID', Number(billboardId));
      if (error) { toast.error('فشل التحديث'); return; }
      toast.success('تم تغيير الشركة المالكة');
      const ownCompany = newCompanyId ? (companies.find((c: any) => c.id === newCompanyId) || null) : null;
      updateBillboardLocalRef.current(Number(billboardId), { own_company_id: newCompanyId, own_company: ownCompany });
    };
    
    window.addEventListener('edit-billboard', handler);
    window.addEventListener('billboard-maintenance', maintenanceHandler);
    window.addEventListener('billboard-toggle-visibility', visibilityHandler);
    window.addEventListener('changeOwnerCompany', ownerChangeHandler);
    return () => {
      window.removeEventListener('edit-billboard', handler);
      window.removeEventListener('billboard-maintenance', maintenanceHandler);
      window.removeEventListener('billboard-toggle-visibility', visibilityHandler);
      window.removeEventListener('changeOwnerCompany', ownerChangeHandler);
    };
  }, []);

  // ✅ ENHANCED: Better contract number extraction with multiple sources
  const getCurrentContractNumber = (billboard: any): string => {
    // Try multiple possible field names for contract numbers
    const contractNum = billboard.Contract_Number || 
                       billboard.contractNumber || 
                       billboard.contract_number ||
                       billboard.contract_id ||
                       (billboard.contracts && billboard.contracts[0]?.Contract_Number) ||
                       (billboard.contracts && billboard.contracts[0]?.contract_number) ||
                       (billboard.contracts && billboard.contracts[0]?.id) ||
                       '';
    
    const result = String(contractNum).trim();
    return result;
  };

  // Handle maintenance status update
  const handleMaintenanceSubmit = async () => {
    if (!selectedBillboard || !maintenanceForm.status) {
      toast.error('يرجى اختيار حالة الصيانة');
      return;
    }

    try {
      // تحديد القيم حسب حالة الصيانة
      const updateData: any = {
        maintenance_status: maintenanceForm.status,
        maintenance_date: new Date().toISOString(),
        maintenance_notes: maintenanceForm.description || null,
        maintenance_type: maintenanceForm.type || null,
        maintenance_priority: maintenanceForm.priority
      };

      // ✅ إذا كانت حالة الصيانة "تحتاج ازالة لغرض التطوير" أو "لم يتم التركيب" أو "تمت الإزالة"، تغيير Status إلى "إزالة"
      if (
        maintenanceForm.status === 'تحتاج ازالة لغرض التطوير' ||
        maintenanceForm.status === 'لم يتم التركيب' ||
        maintenanceForm.status === 'removed'
      ) {
        updateData.Status = 'إزالة';
      }

      const { error } = await supabase
        .from('billboards')
        .update(updateData)
        .eq('ID', selectedBillboard.ID);

      if (error) throw error;

      // Add maintenance history record if needed
      if (maintenanceForm.type && maintenanceForm.description) {
        await supabase
          .from('maintenance_history')
          .insert({
            billboard_id: selectedBillboard.ID,
            maintenance_type: maintenanceForm.type,
            description: maintenanceForm.description,
            priority: maintenanceForm.priority,
            maintenance_date: new Date().toISOString()
          });
      }

      toast.success(
        (maintenanceForm.status === 'تحتاج ازالة لغرض التطوير' || maintenanceForm.status === 'لم يتم التركيب')
          ? 'تم تغيير حالة اللوحة إلى "إزالة" ولن تظهر في اللوحات المتاحة'
          : 'تم تحديث حالة الصيانة بنجاح'
      );
      
      setIsMaintenanceDialogOpen(false);
      setMaintenanceForm({
        status: '',
        type: '',
        description: '',
        priority: 'normal'
      });
      // ✅ تأجيل + startTransition لمنع تجميد الواجهة بعد إغلاق النافذة
      const _billboardIdToUpdate = selectedBillboard?.ID;
      if (_billboardIdToUpdate !== undefined) {
        const _updateSnapshot = { ...updateData };
        setTimeout(() => {
          startTransition(() => {
            updateBillboardLocal(_billboardIdToUpdate, _updateSnapshot);
          });
        }, 250);
      }
    } catch (error) {
      console.error('Error updating maintenance status:', error);
      toast.error('فشل في تحديث حالة الصيانة');
    }
  };

  // حذف اللوحة باستخدام نافذة التأكيد من النظام
  const { confirm: systemConfirm } = useSystemDialog();

  const deleteBillboard = async (billboardId: number | string) => {
    try {
      const billboardName = billboards.find(b => (b.ID || b.id) == billboardId)?.Billboard_Name || `اللوحة رقم ${billboardId}`;
      
      const confirmed = await systemConfirm({
        title: 'تأكيد حذف اللوحة',
        message: `هل تريد حذف "${billboardName}"?\n\nتحذير: هذا الإجراء لا يمكن التراجع عنه!`,
        variant: 'destructive',
        confirmText: 'حذف'
      });
      
      if (!confirmed) {
        return;
      }
      
      // ✅ ENHANCED: Better ID validation and conversion
      const id = Number(billboardId);
      if (!id || isNaN(id) || id <= 0) {
        toast.error('معرف اللوحة غير صحيح');
        console.error('❌ Invalid billboard ID:', billboardId);
        return;
      }

      // Deleting billboard
      
      // ✅ FINAL FIX: Use ONLY the correct field name "ID" (uppercase) from database
      const { error } = await supabase
        .from('billboards')
        .delete()
        .eq('ID', id);
        
      if (error) {
        console.error('❌ Delete error:', error);
        // ✅ ENHANCED: Better error handling with specific error messages
        if (error.code === '23503') {
          toast.error('لا يمكن حذف هذه اللوحة لأنها مرتبطة بعقود أو بيانات أخرى');
        } else if (error.code === '42703') {
          toast.error('خطأ في بنية قاعدة البيانات - يرجى الاتصال بالدعم الفني');
        } else if (error.code === 'PGRST116') {
          toast.error('لا توجد لوحة بهذا المعرف');
        } else {
          toast.error(`فشل في حذف اللوحة: ${error.message}`);
        }
        return;
      }
      toast.success(`تم حذف "${billboardName}" بنجاح`);
      await loadBillboards();
    } catch (error: any) {
      console.error('❌ Delete billboard error:', error);
      toast.error(error?.message || 'فشل في حذف اللوحة');
    }
  };

  // ✅ ENHANCED: Universal Smart Arabic Search with all billboard metadata & codes
  const enhancedSearchBillboards = (billboardsList: Billboard[], query: string) => {
    if (!query || !query.trim()) return billboardsList;

    return billboardsList.filter((billboard: any) => {
      const contractNo = getCurrentContractNumber(billboard);
      const bId = String(billboard.ID || billboard.id || '');
      const code = billboard.code || billboard.Code || `TR-${bId.padStart(4, '0')}`;

      return smartArabicMatch(
        [
          code,
          billboard.Code,
          billboard.name,
          billboard.Billboard_Name,
          billboard.location,
          billboard.Nearest_Landmark,
          billboard.municipality,
          billboard.Municipality,
          billboard.city,
          billboard.City,
          billboard.District,
          billboard.district,
          billboard.Customer_Name,
          billboard.clientName,
          billboard.customer_name,
          billboard.contracts?.[0]?.['Customer Name'],
          billboard.contracts?.[0]?.customer_name,
          billboard.Size,
          billboard.size,
          billboard.Level,
          billboard.level,
          billboard.Ad_Type,
          billboard.adType,
          billboard.ad_type,
          billboard.contracts?.[0]?.['Ad Type'],
          billboard.contracts?.[0]?.ad_type,
          contractNo,
          billboard.Contract_Number,
          billboard.contractNumber,
          bId
        ],
        query
      );
    });
  };

  // ✅ ENHANCED: Enhanced filtering with "منتهي" status support
  const filteredBillboards = useMemo(() => {
    const searched = enhancedSearchBillboards(billboards, searchQuery);
    const afterFilters = searched.filter((billboard) => {
      const statusValue = String(((billboard as any).Status ?? (billboard as any).status ?? '')).trim();
      const statusLower = statusValue.toLowerCase();
      const maintRaw = (billboard as any).maintenance_status ?? '';
      const maintenanceStatus = String(maintRaw).trim();
      
      // ✅ استبعاد اللوحات التي حالتها "إزالة" أو حالات صيانة خاصة فقط إذا لم يُختَر فلتر حالة
      const isRemoved = statusValue === 'إزالة' || statusLower === 'ازالة' || maintenanceStatus === 'تحتاج ازالة لغرض التطوير' || maintenanceStatus === 'لم يتم التركيب';
      
      // إذا اختار المستخدم فلتر حالة معينة، لا نستبعد اللوحات - ندعهم يرونها حسب الفلتر
      if (isRemoved && selectedStatuses.length === 0) {
        return false;
      }

      // ✅ استبعاد اللوحات الصديقة المخفية من فلتر "متاحة" (إلا إذا اختار المستخدم فلتر "مخفية من المتاح")
      const isFriendHidden = !!(billboard as any).friend_company_id && (billboard as any).is_visible_in_available === false;
      if (isFriendHidden && selectedStatuses.length === 0) {
        return false;
      }
      
      const hasContract = !!(getCurrentContractNumber(billboard) && getCurrentContractNumber(billboard) !== '0');
      const contractExpired = isContractExpired((billboard as any).Rent_End_Date ?? (billboard as any).rent_end_date);
      
      const isAvailable = isBillboardAvailable(billboard as any);
      const isBooked = !isAvailable && (((statusLower === 'rented' || statusValue === 'مؤجر' || statusValue === 'محجوز') || hasContract) && !contractExpired);
      
      let isNearExpiry = false;
      const end = (billboard as any).Rent_End_Date ?? (billboard as any).rent_end_date;
      if (end && !contractExpired) {
        try {
          const endDate = new Date(end);
          const diffDays = Math.ceil((endDate.getTime() - Date.now()) / 86400000);
          isNearExpiry = diffDays > 0 && diffDays <= 20;
        } catch {}
      }

      // ✅ NEW: Check if contract is expired (منتهي status)
      const isExpired = contractExpired && hasContract;
      
      // ✅ Check maintenance statuses
      const isNotInstalled = maintenanceStatus === 'لم يتم التركيب';
      const needsRemoval = maintenanceStatus === 'تحتاج ازالة لغرض التطوير';
      const isUnderMaintenance = maintenanceStatus === 'maintenance' || maintenanceStatus === 'repair_needed' || maintenanceStatus === 'out_of_service';
      const isDamaged = maintenanceStatus === 'متضررة اللوحة';
      const isRemovalStatus = isRemoved; // إزالة status
      
      // ✅ NEW: Check if hidden from available
      const isHiddenFromAvailable = (billboard as any).is_visible_in_available === false;
      
      // ✅ NEW: Check if friend billboard
      const isFriendBillboard = !!(billboard as any).friend_company_id;
      
      const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.some(s => (
        (s === 'متاحة' && isAvailable) ||
        (s === 'محجوز' && isBooked) ||
        (s === 'قريبة الانتهاء' && isNearExpiry) ||
        (s === 'منتهي' && isExpired) ||
        (s === 'إزالة' && isRemovalStatus) ||
        (s === 'لم يتم التركيب' && isNotInstalled) ||
        (s === 'تحتاج ازالة لغرض التطوير' && needsRemoval) ||
        (s === 'قيد الصيانة' && isUnderMaintenance) ||
        (s === 'متضررة اللوحة' && isDamaged) ||
        (s === 'مخفية من المتاح' && isHiddenFromAvailable) ||
        (s === 'لوحات صديقة' && isFriendBillboard) ||
        (s === 'ممزقة' && !!(activeStatusesMap[Number((billboard as any).ID || (billboard as any).id)] || []).some((x: any) => x.status_type === 'torn_ad'))
      ));
      
      const matchesCity = selectedCities.length === 0 || selectedCities.includes((billboard as any).City || billboard.city || '');
      const sizeVal = String((billboard as any).Size || billboard.size || '').trim();
      const matchesSize = selectedSizes.length === 0 || selectedSizes.includes(sizeVal);
      const municipalityVal = String((billboard as any).Municipality || (billboard as any).municipality || '').trim();
      const matchesMunicipality = selectedMunicipalities.length === 0 || selectedMunicipalities.includes(municipalityVal);
      
      // ✅ NEW: District filter
      const districtVal = String((billboard as any).District || (billboard as any).district || '').trim();
      const matchesDistrict = selectedDistricts.length === 0 || selectedDistricts.includes(districtVal);
      
      // ✅ FIXED: Better ad type matching
      const adTypeVal = String(billboard.Ad_Type || billboard.adType || billboard.ad_type || billboard.AdType || 
                              (billboard.contracts && billboard.contracts[0]?.['Ad Type']) || '').trim();
      const matchesAdType = selectedAdTypes.length === 0 || selectedAdTypes.includes(adTypeVal);
      
      const customerVal = String((billboard as any).Customer_Name ?? (billboard as any).clientName ?? '');
      const matchesCustomer = selectedCustomers.length === 0 || selectedCustomers.includes(customerVal);
      
      // ✅ ENHANCED: Contract number filtering
      const contractNoVal = getCurrentContractNumber(billboard);
      let matchesContractNo = true;
      
      if (selectedContractNumbers.length > 0) {
        if (!contractNoVal || contractNoVal === '0') {
          matchesContractNo = false;
        } else {
          matchesContractNo = selectedContractNumbers.some(selectedContract => {
            const selected = String(selectedContract).trim();
            const current = String(contractNoVal).trim();
            
            // Exact match
            if (current === selected) return true;
            
            // Numeric comparison
            const selectedNum = parseInt(selected);
            const currentNum = parseInt(current);
            if (!isNaN(selectedNum) && !isNaN(currentNum) && selectedNum === currentNum) {
              return true;
            }
            
            return false;
          });
        }
      }
      
      const matchesOwnerCompany = selectedOwnerCompanies.length === 0 || selectedOwnerCompanies.includes((billboard as any).own_company_id || '');
      const result = matchesStatus && matchesCity && matchesSize && matchesMunicipality && matchesDistrict && matchesAdType && matchesCustomer && matchesContractNo && matchesOwnerCompany;
      
      return result;
    });

    // ✅ فلتر المسوّق: يرى فقط اللوحات المتاحة + اللوحات المحجوزة بعقوده (مع استبعاد الصديقة المخفية)
    if (isMarketer) {
      return afterFilters.filter((billboard: any) => {
        // استبعاد اللوحات الصديقة المخفية دائماً للمسوّق
        if (billboard.friend_company_id && billboard.is_visible_in_available === false) return false;

        const isAvailable = isBillboardAvailable(billboard);
        
        if (isAvailable) return true;
        
        if (marketerCustomerId) {
          const billboardId = String(billboard.ID || billboard.id);
          return marketerBillboardIds.has(billboardId);
        }
        
        return false;
      });
    }

    return afterFilters;
  }, [billboards, searchQuery, selectedStatuses, selectedCities, selectedSizes, selectedMunicipalities, selectedDistricts, selectedAdTypes, selectedCustomers, selectedContractNumbers, selectedOwnerCompanies, isContractExpired, isMarketer, marketerCustomerId, marketerBillboardIds, activeStatusesMap]);

  // ✅ Build size rank map from DB sizes (sort_order) — handles variants like "3x8-T"
  const sizeRankMap = useMemo(() => {
    const map = new Map<string, number>();
    (sizes || []).forEach((s: any, idx: number) => {
      const name = String(s?.name ?? '').trim();
      if (!name) return;
      const rank = typeof s?.sort_order === 'number' ? s.sort_order : idx + 1;
      map.set(name, rank);
      map.set(name.toLowerCase(), rank);
    });
    return map;
  }, [sizes]);

  const getSizeRank = (raw: string): number => {
    const s = String(raw || '').trim();
    if (!s) return 9999;
    if (sizeRankMap.has(s)) return sizeRankMap.get(s)!;
    const lower = s.toLowerCase();
    if (sizeRankMap.has(lower)) return sizeRankMap.get(lower)!;
    // Normalize separators (× * to x) and try again
    const norm = lower.replace(/[×*]/g, 'x');
    if (sizeRankMap.has(norm)) return sizeRankMap.get(norm)!;
    // Match by base dimensions ignoring suffix like -T
    const base = norm.split('-')[0];
    for (const [key, rank] of sizeRankMap.entries()) {
      const kNorm = key.toLowerCase().replace(/[×*]/g, 'x').split('-')[0];
      if (kNorm === base) return rank;
    }
    return 9999;
  };

  // ✅ Build municipality rank map from DB municipalities (sort_order)
  const municipalityRankMap = useMemo(() => {
    const map = new Map<string, number>();
    (municipalities || []).forEach((m: any, idx: number) => {
      const name = String(m?.name ?? '').trim();
      if (!name) return;
      const rank = typeof m?.sort_order === 'number' ? m.sort_order : idx + 1;
      map.set(name, rank);
      map.set(name.toLowerCase(), rank);
    });
    return map;
  }, [municipalities]);

  const getMunicipalityRank = (raw: string): number => {
    const m = String(raw || '').trim();
    if (!m) return 9999;
    if (municipalityRankMap.has(m)) return municipalityRankMap.get(m)!;
    const lower = m.toLowerCase();
    if (municipalityRankMap.has(lower)) return municipalityRankMap.get(lower)!;
    return 9999;
  };

  // ✅ FIXED: Strict Multi-Level Billboard Sorting matching everywhere
  const sortedFilteredBillboards = useMemo(() => {
    if (filteredBillboards.length === 0) return [];
    return sortBillboardsStandardSync(filteredBillboards, sizes, municipalities);
  }, [filteredBillboards, sizes, municipalities]);

  // Billboard Photo Overlay Editor state & helpers
  const [overlayEditorOpen, setOverlayEditorOpen] = useState(false);
  const [overlaySelectorOpen, setOverlaySelectorOpen] = useState(false);
  const [overlayInitialIndex, setOverlayInitialIndex] = useState(0);

  const sizeCutoutMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (sizes && Array.isArray(sizes)) {
      sizes.forEach((s: any) => {
        const url = s.cutout_image_url || s.image_url;
        if (s.name && url) {
          const rawName = s.name.trim();
          const normalized = rawName.replace(/×/g, 'x').replace(/X/g, 'x').replace(/\*/g, 'x');
          map[rawName] = url;
          map[normalized] = url;
          map[normalized.toLowerCase()] = url;
          map[normalized.toUpperCase()] = url;
          map[normalized.replace(/x/g, '×')] = url;
          map[normalized.replace(/x/g, '*')] = url;
        }
      });
    }
    return map;
  }, [sizes]);

  const overlayItems: CollectionItemForOverlay[] = useMemo(() => {
    return sortedFilteredBillboards.map(b => ({
      sequence_number: Number(b.ID || (b as any).sequence_number || 0),
      billboard_name: b.Name || (b as any).billboard_name || `لوحة #${b.ID}`,
      location_text: b.Location || (b as any).location_text || '',
      nearest_landmark: b.Nearest_Landmark || (b as any).nearest_landmark || '',
      size: b.Size || (b as any).size || '4x3',
      faces_count: String(b.Faces || (b as any).faces_count || '1'),
      image_url: b.Image_URL || (b as any).image_url || null,
      municipality: b.Municipality || (b as any).municipality || '',
      latitude: b.Latitude || (b.GPS_Coordinates ? parseFloat(String(b.GPS_Coordinates).split(',')[0]) : null),
      longitude: b.Longitude || (b.GPS_Coordinates ? parseFloat(String(b.GPS_Coordinates).split(',')[1]) : null),
      overlay_config: (b as any).overlay_config,
    }));
  }, [sortedFilteredBillboards]);

  const handleSaveOverlayConfigInBillboards = async (sequenceNumber: number, rawConfig: BillboardOverlayConfig) => {
    try {
      const target = billboards.find(b => Number(b.ID || (b as any).sequence_number) === sequenceNumber);
      if (!target) return;

      const cleanConfig = sanitizeOverlayConfig(rawConfig);
      const targetId = Number(target.ID);

      const { error } = await supabase
        .from('billboards')
        .update({ overlay_config: cleanConfig as any })
        .eq('ID', targetId);

      if (!error) {
        updateBillboardLocal(targetId, { overlay_config: cleanConfig });
 toast.success(`تم حفظ إعدادات التراكب البصري والتناسب الواقعي للوحة #${sequenceNumber} بنجاح! `);
      } else {
        console.error('[save-overlay-error]', error);
        toast.error(`حدث خطأ أثناء حفظ التراكب: ${error.message}`);
      }
    } catch (e: any) {
      console.error('Failed to save overlay config in Billboards:', e);
      toast.error('تعذر حفظ إعدادات التراكب');
    }
  };

  const handleSaveCoordinatesInBillboards = async (sequenceNumber: number, lat: number, lng: number) => {
    try {
      const target = billboards.find(b => Number(b.ID || (b as any).sequence_number) === sequenceNumber);
      if (!target) return;

      const targetId = Number(target.ID);
      const coordsStr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      const { error } = await supabase
        .from('billboards')
        .update({
          GPS_Coordinates: coordsStr,
          coordinates: coordsStr,
          GPS_Link: `https://www.google.com/maps?q=${coordsStr}`
        })
        .eq('ID', targetId);

      if (!error) {
        updateBillboardLocal(targetId, {
          GPS_Coordinates: coordsStr,
          coordinates: coordsStr,
          GPS_Link: `https://www.google.com/maps?q=${coordsStr}`
        });
      }
    } catch (e) {
      console.error('Error saving coordinates:', e);
    }
  };

  const handleUpdateItemDetailsInBillboards = async (sequenceNumber: number, details: Partial<CollectionItemForOverlay>) => {
    try {
      const target = billboards.find(b => Number(b.ID || (b as any).sequence_number) === sequenceNumber);
      if (!target) return;

      const targetId = Number(target.ID);
      const updates: any = {};
      if (details.size) updates.Size = details.size;
      if (details.location_text) updates.Location = details.location_text;
      if (details.nearest_landmark) updates.Nearest_Landmark = details.nearest_landmark;

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('billboards')
          .update(updates)
          .eq('ID', targetId);

        if (!error) {
          updateBillboardLocal(targetId, updates);
        }
      }
    } catch (e) {
      console.error('Error updating details:', e);
    }
  };

  const handleOpenOverlayForBillboard = (billboard: any) => {
    const seq = Number(billboard.ID || billboard.sequence_number);
    const foundIdx = overlayItems.findIndex(it => it.sequence_number === seq);
    setOverlayInitialIndex(foundIdx >= 0 ? foundIdx : 0);
    setOverlayEditorOpen(true);
  };

  // ✅ NEW: Map billboards memo - shows maintenance and removal by default unless filtered
  const mapBillboards = useMemo(() => {
    const searched = enhancedSearchBillboards(billboards, searchQuery);
    const afterFilters = searched.filter((billboard) => {
      const statusValue = String(((billboard as any).Status ?? (billboard as any).status ?? '')).trim();
      const statusLower = statusValue.toLowerCase();
      const maintRaw = (billboard as any).maintenance_status ?? '';
      const maintenanceStatus = String(maintRaw).trim();
      
      const hasContract = !!(getCurrentContractNumber(billboard) && getCurrentContractNumber(billboard) !== '0');
      const contractExpired = isContractExpired((billboard as any).Rent_End_Date ?? (billboard as any).rent_end_date);
      
      const isAvailable = isBillboardAvailable(billboard as any);
      const isBooked = !isAvailable && (((statusLower === 'rented' || statusValue === 'مؤجر' || statusValue === 'محجوز') || hasContract) && !contractExpired);
      
      let isNearExpiry = false;
      const end = (billboard as any).Rent_End_Date ?? (billboard as any).rent_end_date;
      if (end && !contractExpired) {
        try {
          const endDate = new Date(end);
          const diffDays = Math.ceil((endDate.getTime() - Date.now()) / 86400000);
          isNearExpiry = diffDays > 0 && diffDays <= 20;
        } catch {}
      }

      const isExpired = contractExpired && hasContract;
      
      const isNotInstalled = maintenanceStatus === 'لم يتم التركيب';
      const needsRemoval = maintenanceStatus === 'تحتاج ازالة لغرض التطوير';
      const isUnderMaintenance = maintenanceStatus === 'maintenance' || maintenanceStatus === 'repair_needed' || maintenanceStatus === 'out_of_service';
      const isDamaged = maintenanceStatus === 'متضررة اللوحة';
      
      const isRemoved = statusValue === 'إزالة' || statusLower === 'ازالة' || maintenanceStatus === 'removed' || maintenanceStatus === 'تمت الإزالة' || maintenanceStatus === 'تحتاج ازالة لغرض التطوير' || maintenanceStatus === 'لم يتم التركيب';
      const isRemovalStatus = isRemoved; // إزالة status
      
      const isHiddenFromAvailable = (billboard as any).is_visible_in_available === false;
      const isFriendBillboard = !!(billboard as any).friend_company_id;
      
      const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.some(s => (
        (s === 'متاحة' && isAvailable) ||
        (s === 'محجوز' && isBooked) ||
        (s === 'قريبة الانتهاء' && isNearExpiry) ||
        (s === 'منتهي' && isExpired) ||
        (s === 'إزالة' && isRemovalStatus) ||
        (s === 'لم يتم التركيب' && isNotInstalled) ||
        (s === 'تحتاج ازالة لغرض التطوير' && needsRemoval) ||
        (s === 'قيد الصيانة' && (isUnderMaintenance || statusValue === 'صيانة' || statusValue === 'تحتاج صيانة' || statusValue === 'قيد الصيانة' || maintenanceStatus === 'قيد الصيانة')) ||
        (s === 'متضررة اللوحة' && isDamaged) ||
        (s === 'مخفية من المتاح' && isHiddenFromAvailable) ||
        (s === 'لوحات صديقة' && isFriendBillboard) ||
        (s === 'ممزقة' && !!(activeStatusesMap[Number((billboard as any).ID || (billboard as any).id)] || []).some((x: any) => x.status_type === 'torn_ad'))
      ));
      
      const matchesCity = selectedCities.length === 0 || selectedCities.includes((billboard as any).City || billboard.city || '');
      const sizeVal = String((billboard as any).Size || billboard.size || '').trim();
      const matchesSize = selectedSizes.length === 0 || selectedSizes.includes(sizeVal);
      const municipalityVal = String((billboard as any).Municipality || (billboard as any).municipality || '').trim();
      const matchesMunicipality = selectedMunicipalities.length === 0 || selectedMunicipalities.includes(municipalityVal);
      
      const districtVal = String((billboard as any).District || (billboard as any).district || '').trim();
      const matchesDistrict = selectedDistricts.length === 0 || selectedDistricts.includes(districtVal);
      
      const adTypeVal = String(billboard.Ad_Type || billboard.adType || billboard.ad_type || billboard.AdType || 
                              (billboard.contracts && billboard.contracts[0]?.['Ad Type']) || '').trim();
      const matchesAdType = selectedAdTypes.length === 0 || selectedAdTypes.includes(adTypeVal);
      
      const customerVal = String((billboard as any).Customer_Name ?? (billboard as any).clientName ?? '');
      const matchesCustomer = selectedCustomers.length === 0 || selectedCustomers.includes(customerVal);
      
      const contractNoVal = getCurrentContractNumber(billboard);
      let matchesContractNo = true;
      
      if (selectedContractNumbers.length > 0) {
        if (!contractNoVal || contractNoVal === '0') {
          matchesContractNo = false;
        } else {
          matchesContractNo = selectedContractNumbers.some(selectedContract => {
            const selected = String(selectedContract).trim();
            const current = String(contractNoVal).trim();
            if (current === selected) return true;
            const selectedNum = parseInt(selected);
            const currentNum = parseInt(current);
            if (!isNaN(selectedNum) && !isNaN(currentNum) && selectedNum === currentNum) {
              return true;
            }
            return false;
          });
        }
      }
      
      const matchesOwnerCompany = selectedOwnerCompanies.length === 0 || selectedOwnerCompanies.includes((billboard as any).own_company_id || '');
      const result = matchesStatus && matchesCity && matchesSize && matchesMunicipality && matchesDistrict && matchesAdType && matchesCustomer && matchesContractNo && matchesOwnerCompany;
      
      return result;
    });

    if (isMarketer) {
      return afterFilters.filter((billboard: any) => {
        if (billboard.friend_company_id && billboard.is_visible_in_available === false) return false;
        const isAvailable = isBillboardAvailable(billboard);
        if (isAvailable) return true;
        if (marketerCustomerId) {
          const billboardId = String(billboard.ID || billboard.id);
          return marketerBillboardIds.has(billboardId);
        }
        return false;
      });
    }

    return afterFilters;
  }, [billboards, searchQuery, selectedStatuses, selectedCities, selectedSizes, selectedMunicipalities, selectedDistricts, selectedAdTypes, selectedCustomers, selectedContractNumbers, selectedOwnerCompanies, isContractExpired, isMarketer, marketerCustomerId, marketerBillboardIds, activeStatusesMap]);

  const sortedMapBillboards = useMemo(() => {
    if (mapBillboards.length === 0) return [];
    return [...mapBillboards].sort((a, b) => {
      const sizeA = (a as any).Size || a.size || '';
      const sizeB = (b as any).Size || b.size || '';
      const orderA = getSizeRank(sizeA);
      const orderB = getSizeRank(sizeB);
      if (orderA !== orderB) return orderA - orderB;

      const munA = (a as any).Municipality || a.municipality || '';
      const munB = (b as any).Municipality || b.municipality || '';

      const munOrderA = getMunicipalityRank(munA);
      const munOrderB = getMunicipalityRank(munB);

      if (munOrderA !== munOrderB) {
        return munOrderA - munOrderB;
      }

      const idA = (a as any).ID || a.id || 0;
      const idB = (b as any).ID || b.id || 0;
      return idA - idB;
    });
  }, [mapBillboards, sizeRankMap, municipalityRankMap]);


  const totalPages = Math.max(1, Math.ceil(sortedFilteredBillboards.length / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pagedBillboards = sortedFilteredBillboards.slice(startIndex, startIndex + PAGE_SIZE);

  // ✅ UPDATED: Calculate available billboards count (excluding friend company billboards and hidden ones)
  const availableBillboardsCount = useMemo(() => {
    return billboards.filter((billboard: any) => isBillboardAvailable(billboard)).length;
  }, [billboards]);

  // ✅ FIXED: Reset current page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatuses, selectedCities, selectedSizes, selectedMunicipalities, selectedDistricts, selectedAdTypes, selectedCustomers, selectedContractNumbers, selectedOwnerCompanies]);

  // ✅ FIXED: Stable pagination handlers
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  // ✅ Billboard selection handlers
  const toggleBillboardSelection = (billboardId: number) => {
    setSelectedBillboardIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(billboardId)) {
        newSet.delete(billboardId);
      } else {
        newSet.add(billboardId);
      }
      return newSet;
    });
  };

  // التحقق مما إذا كانت اللوحة قابلة للاختيار (ليست صديقة وليست مخفية، ومتاحة إذا تم تفعيل الفلتر)
  const isBillboardSelectable = (b: any, excludeFriendlyHidden = true, availableOnly = false) => {
    const isFriendly = !!b.friend_company_id;
    const isHidden = b.is_visible_in_available === false || b.is_visible === false;
    const isAvailable = isBillboardAvailable(b);

    if (excludeFriendlyHidden && (isFriendly || isHidden)) {
      return false;
    }
    if (availableOnly && !isAvailable) {
      return false;
    }
    return true;
  };

  const selectAllFilteredBillboards = (exclude = true, availableOnly = false) => {
    setSelectedBillboardIds(prev => {
      const next = new Set(prev);
      sortedFilteredBillboards.forEach((b: any) => {
        if (!isBillboardSelectable(b, exclude, availableOnly)) return;
        next.add(b.ID || b.id);
      });
      return next;
    });
  };

  const clearBillboardSelection = () => {
    setSelectedBillboardIds(new Set());
  };

  const selectedBillboards = useMemo(() => {
    return billboards.filter((b: any) => selectedBillboardIds.has(b.ID || b.id));
  }, [billboards, selectedBillboardIds]);

  const isAllSelected = useMemo(() => {
    const selectableFiltered = sortedFilteredBillboards.filter((b: any) => {
      return isBillboardSelectable(b, excludeFriendlyAndHidden, selectAvailableOnly);
    });
    return selectableFiltered.length > 0 && selectableFiltered.every((b: any) => selectedBillboardIds.has(b.ID || b.id));
  }, [sortedFilteredBillboards, selectedBillboardIds, excludeFriendlyAndHidden, selectAvailableOnly]);

  // استدعاء الطباعة الفورية لكامل اللوحات مع التحديد التلقائي
  const handleTopPrintClick = () => {
    // 1. تحديد كل اللوحات
    setSelectedBillboardIds(prev => {
      const next = new Set(prev);
      sortedFilteredBillboards.forEach((b: any) => {
        if (!isBillboardSelectable(b, excludeFriendlyAndHidden, selectAvailableOnly)) return;
        next.add(b.ID || b.id);
      });
      return next;
    });
    // 2. فتح نافذة الطباعة المتقدمة مباشرة
    setAdvancedPrintOpen(true);
  };

  // ✅ حذف اللوحات المحددة
  const deleteSelectedBillboards = async () => {
    if (selectedBillboards.length === 0) return;
    
    const confirmed = await systemConfirm({
      title: 'تأكيد حذف متعدد',
      message: `هل تريد حذف ${selectedBillboards.length} لوحة؟\n\nاللوحات المرتبطة بعقود سارية لن تُحذف.\nهذا الإجراء لا يمكن التراجع عنه!`,
      variant: 'destructive',
      confirmText: `حذف ${selectedBillboards.length} لوحة`
    });
    
    if (!confirmed) return;

    let successCount = 0;
    let failCount = 0;

    for (const billboard of selectedBillboards) {
      const id = Number(billboard.ID || billboard.id);
      if (!id || isNaN(id)) { failCount++; continue; }

      const { error } = await supabase.from('billboards').delete().eq('ID', id);
      if (error) {
        console.error(`❌ Failed to delete billboard ${id}:`, error.message);
        failCount++;
      } else {
        successCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`تم حذف ${successCount} لوحة بنجاح`);
      clearBillboardSelection();
      await loadBillboards();
    }
    if (failCount > 0) {
      toast.error(`فشل حذف ${failCount} لوحة (قد تكون مرتبطة بعقود)`);
    }
  };

  // ✅ تغيير حالة الإخفاء/الإظهار للوحات المحددة
  const toggleSelectedVisibility = async (billboardIds: number[], visible: boolean) => {
    if (billboardIds.length === 0) return;

    let successCount = 0;
    let failCount = 0;

    for (const id of billboardIds) {
      const { error } = await supabase
        .from('billboards')
        .update({ is_visible_in_available: visible })
        .eq('ID', id);
      if (error) {
        console.error(`❌ Failed to update billboard ${id}:`, error.message);
        failCount++;
      } else {
        successCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`تم ${visible ? 'إظهار' : 'إخفاء'} ${successCount} لوحة ${visible ? 'في' : 'من'} المتاح`);
      clearBillboardSelection();
      await loadBillboards();
    }
    if (failCount > 0) {
      toast.error(`فشل تحديث ${failCount} لوحة`);
    }
  };

  // ✅ FIXED: Simple pagination
  const PaginationControls = () => (
    <div className="flex items-center gap-1 bg-muted/40 rounded-full p-1 backdrop-blur-sm border border-border/50">
      <button
        onClick={handlePreviousPage}
        disabled={currentPage === 1}
        className="h-8 px-3 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
      >
        السابق
      </button>
      
      {(() => {
        const windowSize = 5;
        let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
        let end = start + windowSize - 1;
        if (end > totalPages) {
          end = totalPages;
          start = Math.max(1, end - windowSize + 1);
        }
        return Array.from({ length: end - start + 1 }, (_, idx) => start + idx).map((p) => (
          <button
            key={p}
            onClick={() => handlePageChange(p)}
            className={`w-8 h-8 rounded-full text-xs font-bold transition-all duration-200 ${
              currentPage === p 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground hover:bg-background'
            }`}
          >
            {p}
          </button>
        ));
      })()}

      <button
        onClick={handleNextPage}
        disabled={currentPage === totalPages}
        className="h-8 px-3 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
      >
        التالي
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
            <MapPin className="absolute inset-0 m-auto h-6 w-6 text-primary/60" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">جاري تحميل اللوحات</p>
            <p className="text-xs text-muted-foreground">يرجى الانتظار...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Editorial Header */}
      <div className="bg-gradient-to-b from-card/85 to-background border-b border-border/40 mb-4 sm:mb-6 shadow-sm backdrop-blur-md">
        <div className="px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
                اللوحات الإعلانية
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-2xl sm:text-3xl font-bold text-primary font-manrope">{billboards.length}</span>
                <span className="text-xs sm:text-sm text-muted-foreground">لوحة مسجلة</span>
                <div className="h-4 w-px bg-border mx-1" />
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 font-manrope">{availableBillboardsCount}</span>
                <span className="text-xs text-muted-foreground">متاح</span>
              </div>
              <div className="h-0.5 w-12 bg-primary rounded-full mt-2" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => setOverlaySelectorOpen(true)}
                size="sm"
                className="h-8 sm:h-9 rounded-xl sm:rounded-2xl gap-1.5 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-slate-950 font-extrabold shadow-md text-xs px-2.5 sm:px-4 transition-all"
              >
                <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">محرر التراكب</span>
              </Button>
              <BillboardActions
                billboards={billboards}
                isContractExpired={isContractExpired}
                exportToExcel={() => billboardExport.exportToExcel(billboards)}
                exportAvailableToExcel={() => billboardExport.exportAvailableToExcel(billboards, isContractExpired)}
                exportMunicipalityToExcel={(excludeHidden, selectedMunicipality) => billboardExport.exportMunicipalityToExcel(billboards, excludeHidden, selectedMunicipality)}
                municipalities={dbMunicipalities}
                copyAvailableToClipboard={() => billboardExport.copyAvailableToClipboard(billboards, isContractExpired)}
                copyAllToClipboard={() => billboardExport.copyAllToClipboard(billboards)}
                copyAvailableAndUpcomingToClipboard={(months) => billboardExport.copyAvailableAndUpcomingToClipboard(billboards, isContractExpired, months)}
                copyAllWithEndDateToClipboard={() => billboardExport.copyAllWithEndDateToClipboard(billboards)}
                copyFollowUpToClipboard={() => billboardExport.copyFollowUpToClipboard(billboards)}
                exportAllWithEndDate={() => billboardExport.exportAllWithEndDate(billboards)}
                exportAvailableAndUpcoming={(months) => billboardExport.exportAvailableAndUpcoming(billboards, isContractExpired, months)}
                exportFollowUpToExcel={() => billboardExport.exportFollowUpToExcel(billboards)}
                exportRePhotographyToExcel={() => billboardExport.exportRePhotographyToExcel(billboards)}
                exportAvailableWithContracts={(contractIds, hideEndDateIds) => billboardExport.exportAvailableWithContracts(billboards, isContractExpired, contractIds, hideEndDateIds)}
                exportAvailableAndUpcomingWithContracts={(contractIds, hideEndDateIds, months) => billboardExport.exportAvailableAndUpcomingWithContracts(billboards, isContractExpired, contractIds, hideEndDateIds, months)}
                uploadAvailableToSite={() => billboardExport.uploadAvailableToSite(billboards, isContractExpired)}
                uploadAvailableAndUpcomingToSite={(months) => billboardExport.uploadAvailableAndUpcomingToSite(billboards, isContractExpired, months)}
                uploadFollowUpToSite={() => billboardExport.uploadFollowUpToSite(billboards)}
                uploadAllToSite={() => billboardExport.uploadAllToSite(billboards)}
                syncToGoogleSheets={async () => {
                  try {
                    const { syncAvailableBillboardsToGoogleSheets } = await import('@/services/billboardService');
                    await syncAvailableBillboardsToGoogleSheets(billboards, isContractExpired);
                    toast.success('تمت مزامنة اللوحات المتاحة بنجاح مع Google Sheets');
                  } catch (error: any) {
                    console.error('Sync error:', error);
                    toast.error(error.message || 'فشلت عملية المزامنة');
                  }
                }}
                onAdvancedPrintClick={handleTopPrintClick}
                availableBillboardsCount={availableBillboardsCount}
                initializeAddForm={billboardForm.initializeAddForm}
                setAddOpen={billboardForm.setAddOpen}
                setBulkAddOpen={setBulkAddOpen}
                setExcelImportOpen={setExcelImportOpen}
                setExcelImageImportOpen={setExcelImageImportOpen}
                setBatchPhotoImportOpen={setBatchPhotoImportOpen}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 space-y-4 sm:space-y-6">
        {/* Stats Strip */}
        <div className="flex items-center justify-between py-1 sm:py-2">
          <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm">
            <span className="text-muted-foreground">
              <span className="font-bold text-foreground font-manrope">{sortedFilteredBillboards.length}</span> نتيجة
            </span>
            {sortedFilteredBillboards.length !== billboards.length && (
              <span className="text-muted-foreground/60">
                من أصل <span className="font-manrope">{billboards.length}</span>
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground font-manrope">
            {currentPage} / {totalPages}
          </span>
        </div>

      {/* Filters */}
      <BillboardFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedStatuses={selectedStatuses}
        setSelectedStatuses={setSelectedStatuses}
        selectedCities={selectedCities}
        setSelectedCities={setSelectedCities}
        selectedSizes={selectedSizes}
        setSelectedSizes={setSelectedSizes}
        selectedMunicipalities={selectedMunicipalities}
        setSelectedMunicipalities={setSelectedMunicipalities}
        selectedDistricts={selectedDistricts}
        setSelectedDistricts={setSelectedDistricts}
        selectedAdTypes={selectedAdTypes}
        setSelectedAdTypes={setSelectedAdTypes}
        selectedCustomers={selectedCustomers}
        setSelectedCustomers={setSelectedCustomers}
        selectedContractNumbers={selectedContractNumbers}
        setSelectedContractNumbers={setSelectedContractNumbers}
        cities={citiesList}
        billboardSizes={dbSizes}
        billboardMunicipalities={dbMunicipalities}
        billboardDistricts={[...new Set(billboards.map((b: any) => b.District || b.district).filter(Boolean).map((d: string) => d.trim()).filter(Boolean))].sort()}
        uniqueAdTypes={dbAdTypes}
        uniqueCustomers={dbCustomers}
        uniqueContractNumbers={dbContractNumbers}
        selectedOwnerCompanies={selectedOwnerCompanies}
        setSelectedOwnerCompanies={setSelectedOwnerCompanies}
        ownerCompanies={ownerCompanies}
        isMapOpen={mapOpen}
      />

      {/* Collapsible Summary Cards */}
      <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen} className="mb-4 sm:mb-6">
        <Card className="rounded-[1.5rem] border border-border/60 bg-card/60 backdrop-blur-md hover:border-primary/20 transition-all duration-300 shadow-sm overflow-hidden">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/40 transition-colors py-3 sm:py-4 px-4 sm:px-6">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2.5 text-sm sm:text-base font-bold text-foreground">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  ملخص الإحصائيات
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full p-0">
                  {summaryOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4 px-4 sm:px-6">
              <BillboardSummaryCards 
                billboards={billboards}
                isContractExpired={isContractExpired}
                sizes={sizes}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Collapsible Map */}
      <Collapsible open={mapOpen} onOpenChange={(open) => startTransition(() => setMapOpen(open))} className="mb-4 sm:mb-6">
        <Card className="rounded-[1.5rem] border border-border/60 bg-card/60 backdrop-blur-md hover:border-primary/20 transition-all duration-300 shadow-sm overflow-hidden">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/40 transition-colors py-3 sm:py-4 px-4 sm:px-6">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2.5 text-sm sm:text-base font-bold text-foreground">
                  <MapIcon className="h-5 w-5 text-primary" />
                  خريطة اللوحات
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full p-0">
                  {mapOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent className="pb-2">
            <Suspense fallback={<MapSkeleton className="h-[560px] sm:h-[640px] lg:h-[720px]" />}>
              <AdminBillboardsMap
                className="h-[560px] sm:h-[640px] lg:h-[720px]"
                billboards={sortedMapBillboards
                  .filter((b: any) => {
                    const coords = (b as any).GPS_Coordinates || '';
                    return !!coords;
                  })
                  .map(b => {
                    const statusRaw = String(b.Status ?? b.status ?? '').trim();
                    const maintStatusRaw = String((b as any).maintenance_status ?? '').trim().toLowerCase();
                    const maintTypeRaw = String((b as any).maintenance_type ?? '').trim().toLowerCase();
                    const contractNumRaw = String(b.Contract_Number ?? b.contractNumber ?? '').trim();
                    const hasContract = !!contractNumRaw && contractNumRaw !== '0';
                    const endDate = b.Rent_End_Date ?? b.rent_end_date ?? (b as any).expiryDate ?? null;
                    const isExpired = !!endDate && !isNaN(new Date(endDate).getTime()) && new Date(endDate) < new Date();
                    
                    let displayStatus: 'available' | 'maintenance' | 'rented' | 'removal' | 'out_of_service' = 'available';
                    
                    const isRemoved = statusRaw === 'إزالة' || statusRaw === 'ازالة' || statusRaw.toLowerCase() === 'removed' || 
                                      maintStatusRaw === 'removed' || maintStatusRaw === 'تمت الإزالة' ||
                                      maintStatusRaw === 'تحتاج ازالة لغرض التطوير' || maintStatusRaw === 'لم يتم التركيب' ||
                                      maintTypeRaw === 'تمت الإزالة' || maintTypeRaw === 'تحتاج إزالة' || maintTypeRaw === 'لم يتم التركيب';
                                      
                    const isMaint = statusRaw === 'صيانة' || statusRaw.toLowerCase() === 'maintenance' || 
                                    maintStatusRaw === 'maintenance' || maintStatusRaw === 'repair_needed' || 
                                    maintStatusRaw === 'out_of_service' || maintStatusRaw === 'قيد الصيانة' || 
                                    maintStatusRaw === 'متضررة اللوحة' || statusRaw === 'تحتاج صيانة' || statusRaw === 'قيد الصيانة';
                                    
                    const isOutOfService = maintStatusRaw === 'out_of_service' || maintStatusRaw === 'خارج الخدمة';
                    
                    if (isRemoved) {
                      displayStatus = 'removal';
                    } else if (isOutOfService) {
                      displayStatus = 'out_of_service';
                    } else if (isMaint) {
                      displayStatus = 'maintenance';
                    } else if (hasContract && !isExpired) {
                      displayStatus = 'rented';
                    }
                    
                    const arabicStatus = 
                      displayStatus === 'rented' ? 'مؤجر' : 
                      displayStatus === 'maintenance' ? 'صيانة' : 
                      displayStatus === 'removal' ? 'إزالة' : 
                      displayStatus === 'out_of_service' ? 'خارج الخدمة' : 
                      'متاح';
                    
                    return {
                      ...b,
                      ID: (b as any).ID || 0,
                      Billboard_Name: (b as any).Billboard_Name || '',
                      City: (b as any).City || '',
                      District: (b as any).District || '',
                      Size: (b as any).Size || '',
                      Status: arabicStatus,
                      Price: (b as any).Price || '0',
                      Level: (b as any).Level || '',
                      Image_URL: (b as any).Image_URL || '',
                      GPS_Coordinates: (b as any).GPS_Coordinates || '',
                      GPS_Link: (b as any).GPS_Link || '',
                      Nearest_Landmark: (b as any).Nearest_Landmark || '',
                      Faces_Count: (b as any).Faces_Count || '1',
                      Municipality: (b as any).Municipality || '',
                      Rent_End_Date: (b as any).Rent_End_Date || null,
                      Customer_Name: (b as any).Customer_Name || (b as any).clientName || (b as any).customer_name || (b as any).contract?.customer_name || (b as any).contract?.['Customer Name'] || ((b as any).contracts && ((b as any).contracts[0]?.customer_name || (b as any).contracts[0]?.['Customer Name'])) || '',
                      Ad_Type: (b as any).Ad_Type || (b as any).adType || (b as any).ad_type || (b as any).AdType || (b as any).contract?.ad_type || (b as any).contract?.['Ad Type'] || ((b as any).contracts && ((b as any).contracts[0]?.ad_type || (b as any).contracts[0]?.['Ad Type'])) || '',
                      Contract_Number: (b as any).Contract_Number || (b as any).contract_number || (b as any).contractNumber || ((b as any).contracts && ((b as any).contracts[0]?.Contract_Number || (b as any).contracts[0]?.contract_number || (b as any).contracts[0]?.['Contract Number'] || (b as any).contracts[0]?.id)) || null,
                      is_visible_in_available: (b as any).is_visible_in_available,
                      design_face_a: (b as any).design_face_a || '',
                      design_face_b: (b as any).design_face_b || '',
                      installed_image_face_a_url: (b as any).installed_image_face_a_url || '',
                      installed_image_face_b_url: (b as any).installed_image_face_b_url || '',
                      id: String((b as any).ID || ''),
                      name: (b as any).Billboard_Name || '',
                      location: (b as any).Nearest_Landmark || '',
                      size: (b as any).Size || '',
                      status: displayStatus as any,
                      coordinates: (b as any).GPS_Coordinates || '',
                      imageUrl: (b as any).Image_URL || '',
                      expiryDate: (b as any).Rent_End_Date || null,
                      area: (b as any).District || '',
                      municipality: (b as any).Municipality || '',
                    };
                  }) as any}
                onImageView={() => {}}
                externalShowSociet={showSociet}
                onShowSocietChange={setShowSociet}
                enableQuickAdd={true}
                onMapRightClick={handleMapRightClick}
                onLocationChange={(bId, lat, lng) => {
                  const coordsStr = `${lat}, ${lng}`;
                  updateBillboardLocal(bId, {
                    GPS_Coordinates: coordsStr,
                    coordinates: coordsStr,
                    GPS_Link: `https://www.google.com/maps?q=${coordsStr}`
                  });
                }}
              />
            </Suspense>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Top Pagination with Grid Control */}
      {sortedFilteredBillboards.length > 0 && (
        <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2 sm:gap-4">
          <div className="flex items-center gap-0.5 sm:gap-1 bg-muted/40 rounded-full p-0.5 border border-border/40 overflow-x-auto max-w-[200px] sm:max-w-none">
            {[
              { label: 'كبير', value: 320 },
              { label: 'متوسط', value: 260 },
              { label: 'صغير', value: 200 },
              { label: 'مصغر', value: 160 },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => {
                  setGridColumns(opt.value);
                  setCurrentPage(1);
                }}
                className={`h-6 sm:h-7 px-2 sm:px-3 rounded-full text-[10px] sm:text-[11px] font-medium whitespace-nowrap transition-all duration-200 ${
                  gridColumns === opt.value
                    ? 'bg-primary text-primary-foreground shadow-sm font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <PaginationControls />
          <div className="hidden sm:block w-[100px]" />
        </div>
      )}

      {/* Billboard Grid - Dynamic responsive */}
      <div className="grid gap-2 sm:gap-3 items-stretch" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${gridColumns}px), 1fr))` }}>
        {pagedBillboards.map((billboard, idx) => {
          const keyVal = String((billboard as any).id ?? (billboard as any).ID ?? `${(billboard as any).Billboard_Name ?? 'bb'}-${startIndex + idx}`);
          const hasContract = hasActiveContract(billboard);
          const billboardId = (billboard as any).ID || (billboard as any).id;
          const isSelected = selectedBillboardIds.has(billboardId);
          
          return (
            <div key={keyVal} className="h-full animate-fade-in" style={{ animationDelay: `${Math.min(idx * 40, 400)}ms`, animationFillMode: 'backwards' }}>
            <BillboardGridCard
              billboard={billboard as any} 
              showBookingActions={false} 
              onUpdate={loadBillboards}
              activeStatuses={activeStatusesMap[Number(billboardId)]}
              onVisibilityToggle={updateBillboardVisibilityLocal}
              onLocalUpdate={updateBillboardLocal}
              isSelectable={true}
              isSelected={isSelected}
              onToggleSelect={() => toggleBillboardSelection(billboardId)}
              canEditBillboards={canEditBillboards}
              onEdit={(b) => {
                billboardForm.setEditing(b);
                billboardForm.setEditOpen(true);
              }}
              onContractAction={(b) => billboardContract.openContractDialog(b)}
              onDelete={(id) => deleteBillboard(id)}
              onMaintenance={(b: any) => {
                setSelectedBillboard(b);
                setMaintenanceForm({
                  status: b.maintenance_status || '',
                  type: b.maintenance_type || '',
                  description: b.maintenance_notes || '',
                  priority: b.maintenance_priority || 'normal'
                });
                setIsMaintenanceDialogOpen(true);
              }}
              hasActiveContractCheck={hasActiveContract}
              onOpenOverlayEditor={handleOpenOverlayForBillboard}
            />
            </div>
          );
        })}
      </div>

      {/* Bottom Pagination */}
      {sortedFilteredBillboards.length > 0 && (
        <div className="flex justify-center mt-6">
          <PaginationControls />
        </div>
      )}

      {/* No Results */}
      {sortedFilteredBillboards.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
            <MapPin className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">لا توجد نتائج</h3>
          <p className="text-sm text-muted-foreground max-w-[300px]">حاول تغيير معايير البحث أو الفلاتر للعثور على اللوحات المطلوبة</p>
        </div>
      )}

      {/* Maintenance Dialog */}
      <MaintenanceDialog
        open={isMaintenanceDialogOpen}
        onOpenChange={setIsMaintenanceDialogOpen}
        selectedBillboard={selectedBillboard}
        setSelectedBillboard={setSelectedBillboard}
        maintenanceForm={maintenanceForm}
        setMaintenanceForm={setMaintenanceForm}
        onSubmit={handleMaintenanceSubmit}
        loadBillboards={loadBillboards}
        onLocalUpdate={updateBillboardLocal}
      />

      {/* Dialogs */}
      <BillboardAddDialog 
        {...billboardForm} 
        {...billboardData} 
        {...billboardActions}
        municipalities={municipalities}
        sizes={sizes}
        levels={levels}
        citiesList={citiesList}
        faces={faces}
        billboardTypes={billboardTypes}
        setMunicipalities={setMunicipalities}
        setSizes={setSizes}
        setLevels={setLevels}
        setBillboardTypes={setBillboardTypes}
        setDbMunicipalities={setDbMunicipalities}
        setDbSizes={setDbSizes}
        loadBillboards={loadBillboards}
      />
      
      <BillboardEditDialog 
        {...billboardForm} 
        {...billboardData} 
        {...billboardActions}
        municipalities={municipalities}
        sizes={sizes}
        levels={levels}
        citiesList={citiesList}
        faces={faces}
        billboardTypes={billboardTypes}
        setMunicipalities={setMunicipalities}
        setDbMunicipalities={setDbMunicipalities}
        loadBillboards={loadBillboards}
      />
      
      <ContractManagementDialog 
        {...billboardContract}
        loadBillboards={loadBillboards}
      />
      
      <PrintFiltersDialog 
        open={printFiltersOpen}
        onOpenChange={setPrintFiltersOpen}
        filters={printFilters}
        setFilters={setPrintFilters}
        billboards={billboards}
        isContractExpired={isContractExpired}
        billboardMunicipalities={dbMunicipalities}
        cities={citiesList}
        billboardSizes={dbSizes}
        uniqueAdTypes={dbAdTypes}
      />
      
      <BillboardPrintWithSelection
        open={advancedPrintOpen}
        onOpenChange={setAdvancedPrintOpen}
        billboards={sortedFilteredBillboards}
        isContractExpired={isContractExpired}
      />


      {/* Bulk Add Dialog */}
      <BulkAddDialog
        open={bulkAddOpen}
        onOpenChange={setBulkAddOpen}
        municipalities={municipalities}
        sizes={sizes}
        levels={levels}
        citiesList={citiesList}
        faces={faces}
        billboardTypes={billboardTypes}
        onSuccess={loadBillboards}
        generateBillboardName={(municipality, level, size, existingNames, billboardId) => {
          const code = municipalities.find(m => m.name === municipality)?.code || 'XX';
          if (billboardId) {
            return `${code}0${billboardId}`;
          }
          let counter = 1;
          let name = `${code}${String(counter).padStart(4, '0')}`;
          while (existingNames.includes(name)) {
            counter++;
            name = `${code}${String(counter).padStart(4, '0')}`;
          }
          return name;
        }}
        getNextBillboardId={async () => {
          const { data } = await supabase.from('billboards').select('ID').order('ID', { ascending: false }).limit(1);
          return (data?.[0]?.ID || 0) + 1;
        }}
      />
      
      {/* Excel Import Dialog */}
      <ExcelImportDialog
        open={excelImportOpen}
        onOpenChange={setExcelImportOpen}
        municipalities={municipalities}
        sizes={sizes}
        levels={levels}
        citiesList={citiesList}
        faces={faces}
        billboardTypes={billboardTypes}
        onSuccess={loadBillboards}
        generateBillboardName={(municipality, level, size, existingNames, billboardId) => {
          const code = municipalities.find(m => m.name === municipality)?.code || 'XX';
          if (billboardId) {
            return `${code}0${billboardId}`;
          }
          let counter = 1;
          let name = `${code}${String(counter).padStart(4, '0')}`;
          while (existingNames.includes(name)) {
            counter++;
            name = `${code}${String(counter).padStart(4, '0')}`;
          }
          return name;
        }}
        getNextBillboardId={async () => {
          const { data } = await supabase.from('billboards').select('ID').order('ID', { ascending: false }).limit(1);
          return (data?.[0]?.ID || 0) + 1;
        }}
      />

      {/* Excel Image Import Dialog */}
      <ExcelImageImportDialog
        open={excelImageImportOpen}
        onOpenChange={setExcelImageImportOpen}
        onSuccess={loadBillboards}
      />

      {/* Batch Photo Add Billboards Dialog */}
      <BatchPhotoAddBillboardsDialog
        open={batchPhotoImportOpen}
        onOpenChange={setBatchPhotoImportOpen}
        onSuccess={loadBillboards}
        municipalities={municipalities}
        sizes={sizes}
        citiesList={citiesList}
        billboardTypes={billboardTypes}
        levels={levels}
      />
      
      {/* Quick Add Dialog */}
      <Dialog open={isQuickAddDialogOpen} onOpenChange={setIsQuickAddDialogOpen}>
        <DialogContent className="max-w-md bg-card border-border text-right animate-in fade-in duration-200" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2 justify-start flex-row-reverse">
              <div className="p-2 rounded-lg bg-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <span style={{ fontFamily: 'Tajawal, sans-serif' }}>إضافة سريعة للوحة</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1" style={{ fontFamily: 'Tajawal, sans-serif' }}>
              سيتم جلب البلدية، المنطقة، المقاس، وبقية التفاصيل تلقائياً من آخر لوحة مضافة في النظام. يرجى كتابة أقرب نقطة دالة فقط.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleQuickAddSubmit} className="space-y-4 pt-3">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground" style={{ fontFamily: 'Tajawal, sans-serif' }}>أقرب معلم / نقطة دالة *</Label>
              <Input
                placeholder="مثال: بجانب مسجد التقوى / خلف المصرف"
                value={quickAddLandmark}
                onChange={(e) => setQuickAddLandmark(e.target.value)}
                required
                className="text-sm h-10 border-border bg-background focus-visible:ring-primary focus-visible:border-primary text-right"
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsQuickAddDialogOpen(false)}
                className="h-10 text-sm cursor-pointer"
                style={{ fontFamily: 'Tajawal, sans-serif' }}
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={quickAdding}
                className="h-10 text-sm bg-primary hover:bg-primary/80 text-white flex gap-1.5 cursor-pointer"
                style={{ fontFamily: 'Tajawal, sans-serif' }}
              >
                {quickAdding && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>إضافة اللوحة</span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* شريط الاختيار العائم */}
      <BillboardSelectionBar
        selectedBillboards={selectedBillboards}
        filteredBillboards={sortedFilteredBillboards}
        onClearSelection={clearBillboardSelection}
        onSelectAll={() => selectAllFilteredBillboards(excludeFriendlyAndHidden, selectAvailableOnly)}
        isAllSelected={isAllSelected}
        onDeleteSelected={canEditBillboards ? deleteSelectedBillboards : undefined}
        onToggleVisibility={canEditBillboards ? toggleSelectedVisibility : undefined}
        excludeFriendlyAndHidden={excludeFriendlyAndHidden}
        onSetExcludeFriendlyAndHidden={setExcludeFriendlyAndHidden}
        selectAvailableOnly={selectAvailableOnly}
        onSetSelectAvailableOnly={setSelectAvailableOnly}
      />

      {/* حوار اختيار اللوحة لمحرر التراكب والواقعية */}
      {overlaySelectorOpen && (
        <BillboardOverlaySelectorDialog
          open={overlaySelectorOpen}
          onOpenChange={setOverlaySelectorOpen}
          billboards={sortedFilteredBillboards}
          onSelectBillboard={handleOpenOverlayForBillboard}
        />
      )}

      {/* محرر تراكب اللوحة والتناسب الواقعي */}
      {overlayEditorOpen && (
        <BillboardPhotoOverlayEditor
          open={overlayEditorOpen}
          onOpenChange={setOverlayEditorOpen}
          items={overlayItems}
          initialIndex={overlayInitialIndex}
          onSaveItemOverlay={handleSaveOverlayConfigInBillboards}
          onSaveCoordinates={handleSaveCoordinatesInBillboards}
          onUpdateItemDetails={handleUpdateItemDetailsInBillboards}
          sizeCutoutMap={sizeCutoutMap}
          availableSizes={sizes}
        />
      )}
      </div>
    </div>
  );
}
