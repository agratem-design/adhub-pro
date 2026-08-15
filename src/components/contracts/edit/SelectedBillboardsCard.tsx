import React, { useEffect, useState, useMemo } from 'react';
import { formatAmount } from '@/lib/formatUtils';
import { calculateAllBillboardPrices } from '@/utils/contractBillboardPricing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, X, Wrench, Building2, Users, TrendingUp, Pencil, Search, Filter, Printer, Square, CheckSquare, ArrowLeftRight, MoveRight, Trash2, PauseCircle, Repeat2, History as HistoryIcon, RefreshCw, MoreVertical, MapPin, AlertCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import type { Billboard } from '@/types';
import { BillboardImage } from '@/components/BillboardImage';
import { BillboardImageZoom } from './BillboardImageZoom';
import { useActiveLoansByBillboard } from '@/hooks/useBillboardLoans';
import { BillboardLoanBadge } from '@/components/Billboard/BillboardLoanBadge';
import { PauseBillboardDialog } from './PauseBillboardDialog';
import { AddPausedBillboardDialog } from './AddPausedBillboardDialog';
import { BulkRegisterPausedDialog } from './BulkRegisterPausedDialog';
import { PausedBillboardsList } from './PausedBillboardsList';
import { InstantBillboardSwapDialog } from './InstantBillboardSwapDialog';
import { QuickPauseBillboardDialog } from './QuickPauseBillboardDialog';
import { toast } from 'sonner';
import { pauseBillboardFromContract } from '@/services/billboardPauseService';
import { listReplacementsByContract } from '@/services/pausedBillboardReplacementService';
import { useSystemDialog } from '@/contexts/SystemDialogContext';

// Component to show friend company name
function FriendCompanyBadge({ billboardId, billboard }: { billboardId: string; billboard: any }) {
  const friendCompanyId = billboard.friend_company_id;
  
  const { data: friendCompany } = useQuery({
    queryKey: ['friend-company', friendCompanyId],
    queryFn: async () => {
      if (!friendCompanyId) return null;
      const { data } = await supabase
        .from('friend_companies')
        .select('name')
        .eq('id', friendCompanyId)
        .single();
      return data;
    },
    enabled: !!friendCompanyId
  });

  return (
    <Badge className="bg-amber-500/90 text-white text-[10px] px-2 py-0.5 shadow-sm max-w-[150px] truncate">
      <Building2 className="h-2.5 w-2.5 ml-1" />
      {friendCompany?.name || 'شركة صديقة'}
    </Badge>
  );
}

interface FriendBillboardCost {
  billboardId: string;
  friendCompanyId: string;
  friendCompanyName: string;
  friendRentalCost: number;
}

interface PartnershipInfo {
  billboardId: string;
  isPartnership: boolean;
  partnerCompanies: string[];
  capital: number;
  capitalRemaining: number;
  phase: 'recovery' | 'profit_sharing';
  partnerShares: Array<{
    partnerId: string;
    partnerName: string;
    preSharePct: number;
    postSharePct: number;
    estimatedShare: number;
  }>;
  companySharePct: number;
  capitalDeductionPct: number;
}

interface SelectedBillboardsCardProps {
  selected: string[];
  billboards: Billboard[];
  onRemoveSelected: (id: string) => void;
  onBulkRemove?: (ids: string[]) => void;
  onSwapBillboard?: (billboardId: string, billboardName: string) => void;
  onMoveBillboard?: (billboardId: string, billboardName: string) => void;
  calculateBillboardPrice: (billboard: Billboard) => number;
  installationDetails: Array<{
    billboardId: string;
    billboardName: string;
    size: string;
    installationPrice: number;
    faces?: number;
    adjustedPrice?: number;
  }>;
  pricingMode: 'months' | 'days';
  durationMonths: number;
  durationDays: number;
  currencySymbol?: string;
  sizeNames?: Map<number, string>;
  totalDiscount?: number;
  discountType?: 'percent' | 'amount';
  discountValue?: number;
  friendBillboardCosts?: FriendBillboardCost[];
  onUpdateFriendCost?: (billboardId: string, friendCompanyId: string, friendCompanyName: string, cost: number) => void;
  friendCostsSaveState?: 'idle' | 'saving' | 'saved';
  startDate?: string;
  endDate?: string;
  partnershipOperatingFeeRate?: number;
  onPartnershipOperatingDataChange?: (data: any[]) => void;
  customerCategory?: string;
  // ✅ NEW: Level discounts
  levelDiscounts?: Record<string, number>;
  // ✅ NEW: Print cost props
  printCostDetails?: Array<{
    billboardId: string;
    printCost: number;
  }>;
  includePrintInPrice?: boolean;
  includeInstallationInPrice?: boolean;
  printCostEnabled?: boolean;
  installationEnabled?: boolean;
  // ✅ NEW: Single face billboards
  singleFaceBillboards?: Set<string>;
  onToggleSingleFace?: (billboardId: string) => void;
  // ✅ NEW: Pause billboard
  contractNumber?: number;
  onRefresh?: () => void;
  onAddPausedFromContractClick?: () => void;
  /** Optional override map for unified pricing (selected + paused) computed by parent */
  pricingByBillboardOverride?: Map<string, any>;
  /** Map of billboard_id -> actual installation date in current contract (from installation_task_items) */
  installDatesByBillboard?: Map<string, string>;
  previousContractNumber?: number | null;
  individualDiscounts?: Record<string, { value: number; type: 'amount' | 'percent' }>;
  onUpdateIndividualDiscount?: (billboardId: string, value: number, type: 'amount' | 'percent') => void;
  billboardCustomDates?: Record<string, { startDate: string; endDate: string; startDateReason: string }>;
  onUpdateBillboardCustomDates?: (billboardId: string, startDate: string, startDateReason: string) => void;
}

export function SelectedBillboardsCard({
  selected,
  billboards,
  onRemoveSelected,
  onBulkRemove,
  onSwapBillboard,
  onMoveBillboard,
  calculateBillboardPrice,
  installationDetails,
  pricingMode,
  durationMonths,
  durationDays,
  currencySymbol = 'د.ل',
  sizeNames = new Map(),
  totalDiscount = 0,
  discountType = 'percent',
  discountValue = 0,
  friendBillboardCosts = [],
  onUpdateFriendCost,
  friendCostsSaveState = 'idle',
  startDate,
  endDate,
  partnershipOperatingFeeRate = 3,
  onPartnershipOperatingDataChange,
  customerCategory = '',
  // ✅ NEW: Level discounts
  levelDiscounts = {},
  // ✅ NEW: Print cost props
  printCostDetails = [],
  includePrintInPrice = true,
  includeInstallationInPrice = true,
  printCostEnabled = false,
  installationEnabled = false,
  // ✅ NEW: Single face billboards
  singleFaceBillboards = new Set(),
  onToggleSingleFace,
  contractNumber,
  onRefresh,
  onAddPausedFromContractClick,
  pricingByBillboardOverride,
  installDatesByBillboard,
  previousContractNumber,
  previousContractBillboardIds = new Set(),
  individualDiscounts = {},
  onUpdateIndividualDiscount,
  billboardCustomDates = {},
  onUpdateBillboardCustomDates,
}: SelectedBillboardsCardProps) {
  const { map: activeLoansByBillboard } = useActiveLoansByBillboard();

  // ✅ Check if billboards have installation tasks in the current contract
  const { data: billboardsWithTasks = new Set<string>() } = useQuery({
    queryKey: ['contract-installation-tasks-billboards', contractNumber],
    queryFn: async () => {
      if (!contractNumber) return new Set<string>();
      
      const { data: tasks, error: tasksError } = await supabase
        .from('installation_tasks')
        .select('id')
        .eq('contract_id', contractNumber);
        
      if (tasksError) throw tasksError;
      const taskIds = (tasks || []).map((t: any) => t.id);
      if (taskIds.length === 0) return new Set<string>();
      
      const { data: items, error: itemsError } = await supabase
        .from('installation_task_items')
        .select('billboard_id')
        .in('task_id', taskIds);
        
      if (itemsError) throw itemsError;
      
      return new Set<string>((items || []).map((it: any) => String(it.billboard_id)));
    },
    enabled: !!contractNumber,
  });

  const computeCanDelete = (b: any): boolean => {
    if (!contractNumber) return true;
    
    const billboardId = String(b.ID || b.id);
    if (billboardsWithTasks.has(billboardId)) {
      return false;
    }

    if (!startDate || !endDate) return true;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

    const bStartStr = b.Rent_Start_Date || startDate;
    const rentStart = new Date(bStartStr);
    const today = new Date();

    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const rentStartDateOnly = new Date(rentStart.getFullYear(), rentStart.getMonth(), rentStart.getDate());

    const diffTime = todayDateOnly.getTime() - rentStartDateOnly.getTime();
    const elapsedDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    const limit = Math.min(30, totalDays / 3);

    if (elapsedDays > limit) {
      return false;
    }

    return true;
  };

  const { confirm } = useSystemDialog();
  const [partnershipInfoMap, setPartnershipInfoMap] = useState<Map<string, PartnershipInfo>>(new Map());
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [editingBillboard, setEditingBillboard] = useState<any>(null);
  
  // Pause & Instant Swap billboard state
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [swappingBillboard, setSwappingBillboard] = useState<any>(null);
  const [quickPauseOpen, setQuickPauseOpen] = useState(false);
  const [quickPausingBillboard, setQuickPausingBillboard] = useState<any>(null);
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [deleteChoiceOpen, setDeleteChoiceOpen] = useState(false);
  const [deletingBillboard, setDeletingBillboard] = useState<any>(null);
  const [pausingBillboard, setPausingBillboard] = useState<any>(null);
  const [pausingPrintCost, setPausingPrintCost] = useState(0);
  const [pausingInstallCost, setPausingInstallCost] = useState(0);
  const [addPausedOpen, setAddPausedOpen] = useState(false);
  const [bulkPausedOpen, setBulkPausedOpen] = useState(false);
  const [pausedRefreshKey, setPausedRefreshKey] = useState(0);
  const [editPrice, setEditPrice] = useState<string>('');
  const [editLevel, setEditLevel] = useState<string>('');
  
  // Multi-select for bulk removal
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSelectMode, setBulkSelectMode] = useState(false);

  const toggleBulkSelect = (id: string) => {
    setBulkSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    const allIds = new Set(filteredSelectedBillboards.map(b => String((b as any).ID)));
    setBulkSelectedIds(allIds);
  };

  const deselectAll = () => {
    setBulkSelectedIds(new Set());
  };

  const handleBulkRemove = async () => {
    const ids = Array.from(bulkSelectedIds);
    
    // Find billboards that cannot be deleted
    const nonDeletableBillboards = billboards.filter(b => ids.includes(String(b.ID)) && !computeCanDelete(b));
    const deletableIds = ids.filter(id => {
      const b = billboards.find(x => String(x.ID) === id);
      return !b || computeCanDelete(b);
    });

    if (nonDeletableBillboards.length > 0) {
      const ok = await confirm({
        title: 'حذف فوري بدون إيقاف',
        message: `بعض اللوحات المحددة (${nonDeletableBillboards.map(b => b.Billboard_Name || b.name || `لوحة ${b.ID}`).join(', ')}) لا يمكن حذفها مباشرة لوجود مهمة تركيب أو لتجاوز المدة. هل تريد حذف كافة اللوحات المحددة فورياً وبدون إيقاف؟`,
        confirmText: 'حذف فوري للكل',
        cancelText: 'إلغاء',
        variant: 'destructive',
      });
      if (ok) {
        if (onBulkRemove) {
          onBulkRemove(ids);
        } else {
          ids.forEach(id => onRemoveSelected(id));
        }
        setBulkSelectedIds(new Set());
        setBulkSelectMode(false);
        toast.success('تم الحذف الفوري لكافة اللوحات المحددة');
      }
      return;
    }

    if (deletableIds.length > 0) {
      if (onBulkRemove) {
        onBulkRemove(deletableIds);
      } else {
        deletableIds.forEach(id => onRemoveSelected(id));
      }
      toast.success('تم حذف اللوحات المحددة');
    }

    setBulkSelectedIds(new Set());
    setBulkSelectMode(false);
  };
  
  // حالة البحث والفلترة
  const [searchQuery, setSearchQuery] = useState('');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');

  // Replacement billboards map: replacement_billboard_id -> { pausedName, startDate, endDate, allocated }
  // pausedName comes from paused_billboards.billboard_name (the ORIGINAL board the replacement substitutes).
  const { data: replacementsList = [] } = useQuery({
    queryKey: ['paused-replacements-by-contract', contractNumber, pausedRefreshKey],
    queryFn: async () => {
      if (!contractNumber) return [];
      try {
        const repls = await listReplacementsByContract(Number(contractNumber));
        const pausedIds = Array.from(new Set((repls || []).map((r: any) => r.paused_billboard_id).filter(Boolean)));
        let pausedNameById = new Map<string, string>();
        if (pausedIds.length > 0) {
          const { data: paused } = await supabase
            .from('paused_billboards' as any)
            .select('id, billboard_name')
            .in('id', pausedIds as any);
          pausedNameById = new Map((paused || []).map((p: any) => [String(p.id), String(p.billboard_name || '')]));
        }
        return (repls || []).map((r: any) => ({
          ...r,
          _paused_billboard_name: pausedNameById.get(String(r.paused_billboard_id)) || '',
        }));
      } catch { return []; }
    },
    enabled: !!contractNumber,
  });
  const replacementsMap = useMemo(() => {
    const m = new Map<string, { pausedName: string; startDate: string; endDate: string; allocated: number }>();
    (replacementsList as any[]).forEach((r: any) => {
      m.set(String(r.replacement_billboard_id), {
        pausedName: String(r._paused_billboard_name || r.replacement_billboard_name || ''),
        startDate: String(r.start_date || ''),
        endDate: String(r.end_date || ''),
        allocated: Number(r.allocated_amount) || 0,
      });
    });
    return m;
  }, [replacementsList]);
  // جلب مستويات اللوحات
  const { data: levels = [] } = useQuery({
    queryKey: ['billboard-levels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billboard_levels')
        .select('level_code, level_name')
        .order('level_code');
      if (error) throw error;
      return data || [];
    }
  });

  // جلب الفئات السعرية من جدول pricing
  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ['pricing-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing')
        .select('customer_category')
        .not('customer_category', 'is', null);
      if (error) throw error;

      const uniqueCategories = Array.from(
        new Set(
          (data || [])
            .map((d: any) => String(d.customer_category || '').trim())
            .filter(Boolean)
        )
      );

      return uniqueCategories.sort((a, b) => a.localeCompare(b, 'ar'));
    }
  });

  // جلب ترتيب المقاسات
  const { data: sizesOrder = [] } = useQuery({
    queryKey: ['sizes-order'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sizes')
        .select('id, name, sort_order')
        .order('sort_order');
      if (error) throw error;
      return data || [];
    }
  });

  const [editCategory, setEditCategory] = useState<string>('');
  const [editPricingPrice, setEditPricingPrice] = useState<string>('');
  const [currentPricingId, setCurrentPricingId] = useState<number | null>(null);
  const [currentDurationLabel, setCurrentDurationLabel] = useState<string>('');
  const [allDurationPrices, setAllDurationPrices] = useState<Record<string, number>>({});
  const [isQuickEditMode, setIsQuickEditMode] = useState(false);
  const [loadingQuickPricing, setLoadingQuickPricing] = useState(false);

  // تحديد عمود السعر بناءً على المدة
  const getPriceColumnByDuration = (months: number): string => {
    if (months >= 12) return 'full_year';
    if (months >= 6) return '6_months';
    if (months >= 3) return '3_months';
    if (months >= 2) return '2_months';
    if (months >= 1) return 'one_month';
    return 'one_day';
  };

  const getDurationLabel = (months: number): string => {
    if (months >= 12) return 'سنوي';
    if (months >= 6) return '6 أشهر';
    if (months >= 3) return '3 أشهر';
    if (months >= 2) return 'شهرين';
    if (months >= 1) return 'شهر';
    return 'يومي';
  };

  const loadPricingData = async (size: string, level: string, category: string, sizeId?: number | null) => {
    setLoadingQuickPricing(true);
    try {
      let pricingResult: any = null;

      // 1) Try by size_id first (most reliable)
      if (sizeId) {
        let q = supabase
          .from('pricing')
          .select('id, full_year, one_month, 3_months, 6_months, 2_months, one_day')
          .eq('size_id', sizeId)
          .eq('customer_category', category);
        if (level) q = q.eq('billboard_level', level);
        const { data } = await q.maybeSingle();
        if (data) pricingResult = data;
      }

      // 2) Fallback: by size name
      if (!pricingResult) {
        let q = supabase
          .from('pricing')
          .select('id, full_year, one_month, 3_months, 6_months, 2_months, one_day')
          .eq('size', size)
          .eq('customer_category', category);
        if (level) q = q.eq('billboard_level', level);
        const { data } = await q.maybeSingle();
        if (data) pricingResult = data;
      }
      
      if (pricingResult) {
        setCurrentPricingId(pricingResult.id);
        setAllDurationPrices({
          one_day: pricingResult.one_day || 0,
          one_month: pricingResult.one_month || 0,
          '2_months': (pricingResult as any)['2_months'] || 0,
          '3_months': (pricingResult as any)['3_months'] || 0,
          '6_months': (pricingResult as any)['6_months'] || 0,
          full_year: pricingResult.full_year || 0,
        });
      } else {
        setCurrentPricingId(null);
        setAllDurationPrices({ one_day: 0, one_month: 0, '2_months': 0, '3_months': 0, '6_months': 0, full_year: 0 });
      }
    } catch (e) {
      console.error('Error loading pricing:', e);
    } finally {
      setLoadingQuickPricing(false);
    }
  };

  const handleQuickEdit = async (billboard: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingBillboard(billboard);
    setIsQuickEditMode(false);
    
    const level = String(billboard.Level || billboard.level || '').trim();
    const category = String(customerCategory || billboard.Category_Level || billboard.category_level || '').trim();
    const size = billboard.Size || billboard.size;
    
    setEditLevel(level);
    setEditCategory(category);
    setCurrentDurationLabel(getDurationLabel(durationMonths));
    
    if (size && category) {
      const sizeId = billboard.size_id || billboard.Size_ID || null;
      await loadPricingData(size, level, category, sizeId ? Number(sizeId) : null);
    } else {
      setCurrentPricingId(null);
      setAllDurationPrices({});
    }
    
    setQuickEditOpen(true);
  };

  const handleQuickEditSave = async () => {
    if (!editingBillboard) return;
    
    try {
      const size = editingBillboard.Size || editingBillboard.size;
      const sizeId = editingBillboard.size_id || editingBillboard.Size_ID || null;
      
      // تحديث اللوحة (Category_Level و Level فقط)
      const { error: billboardError } = await supabase
        .from('billboards')
        .update({
          Category_Level: editCategory || null,
          Level: editLevel || null
        })
        .eq('ID', editingBillboard.ID);

      if (billboardError) throw billboardError;
      
      // تحديث جميع الأسعار إذا كان في وضع التعديل
      if (isQuickEditMode && size && editLevel && editCategory) {
        // Try to find existing pricing by currentPricingId first, then by size_id, then by size name
        let existingId: number | null = currentPricingId;
        
        if (!existingId && sizeId) {
          const { data } = await supabase
            .from('pricing')
            .select('id')
            .eq('size_id', Number(sizeId))
            .eq('billboard_level', editLevel)
            .eq('customer_category', editCategory)
            .maybeSingle();
          if (data) existingId = data.id;
        }
        
        if (!existingId) {
          const { data } = await supabase
            .from('pricing')
            .select('id')
            .eq('size', size)
            .eq('billboard_level', editLevel)
            .eq('customer_category', editCategory)
            .maybeSingle();
          if (data) existingId = data.id;
        }
        
        if (existingId) {
          const { error } = await supabase.from('pricing').update(allDurationPrices as any).eq('id', existingId);
          if (error) console.error('Error updating pricing:', error);
        } else {
          const insertData: any = {
            size,
            billboard_level: editLevel,
            customer_category: editCategory,
            ...allDurationPrices,
          };
          if (sizeId) insertData.size_id = Number(sizeId);
          const { error } = await supabase.from('pricing').insert(insertData);
          if (error) console.error('Error inserting pricing:', error);
        }
        
        // Reload prices to reflect changes without full page reload
        await loadPricingData(size, editLevel, editCategory, sizeId ? Number(sizeId) : null);
        setIsQuickEditMode(false);
        return; // Stay in dialog to show updated prices
      }
      
      setQuickEditOpen(false);
      setEditingBillboard(null);
      setIsQuickEditMode(false);
      window.location.reload();
    } catch (error) {
      console.error('Error updating billboard:', error);
    }
  };

  // Load partnership info for selected billboards (Optimized dependency check)
  const selectedIdsKey = selected.slice().sort().join(',');

  useEffect(() => {
    const loadPartnershipInfo = async () => {
      if (selectedBillboards.length === 0) {
        setPartnershipInfoMap(new Map());
        return;
      }
      
      // Fetch partnership data directly from database for all selected billboards
      const billboardIds = selectedBillboards.map(b => (b as any).ID);
      
      const { data: dbBillboards } = await supabase
        .from('billboards')
        .select('"ID", is_partnership, partner_companies, capital, capital_remaining')
        .in('ID', billboardIds);
      
      // Create a map of partnership data from DB
      const dbPartnershipMap = new Map<number, any>();
      if (dbBillboards) {
        dbBillboards.forEach(db => {
          if (db.is_partnership) {
            dbPartnershipMap.set(db.ID, db);
          }
        });
      }
      
      if (dbPartnershipMap.size === 0) {
        setPartnershipInfoMap(new Map());
        return;
      }
      

      
      const newMap = new Map<string, PartnershipInfo>();
      
      // Process each partnership billboard from DB data
      for (const billboard of selectedBillboards) {
        const billboardIdNum = Number((billboard as any).ID);
        const dbPartnership = dbPartnershipMap.get(billboardIdNum);
        
        if (!dbPartnership) continue;
        
        const billboardIdStr = String((billboard as any).ID);
        const billboardPrice = calculateBillboardPrice(billboard);
        const capital = Number(dbPartnership.capital || 0);
        const capitalRemaining = Number(dbPartnership.capital_remaining ?? capital);
        const phase: 'recovery' | 'profit_sharing' = capitalRemaining > 0 ? 'recovery' : 'profit_sharing';
        
        const partnerCompanies = Array.isArray(dbPartnership.partner_companies) 
          ? dbPartnership.partner_companies 
          : [];
        
        const partnerShares: Array<{
          partnerId: string;
          partnerName: string;
          preSharePct: number;
          postSharePct: number;
          estimatedShare: number;
        }> = [];
        
        const { data: terms } = await supabase
          .from('shared_billboards')
          .select('partner_company_id, partner_pre_pct, partner_post_pct, partners(name)')
          .eq('billboard_id', billboardIdNum);
          
        if (terms && terms.length > 0) {
          for (const term of terms) {
            const sharePct = phase === 'recovery' 
              ? Number(term.partner_pre_pct || 35) 
              : Number(term.partner_post_pct || 50);
            const estimatedShare = billboardPrice * (sharePct / 100);
            
            partnerShares.push({
              partnerId: term.partner_company_id,
              partnerName: (term as any).partners?.name || 'شريك',
              preSharePct: Number(term.partner_pre_pct || 35),
              postSharePct: Number(term.partner_post_pct || 50),
              estimatedShare
            });
          }
        } else if (partnerCompanies.length > 0) {
          const defaultSharePct = phase === 'recovery' ? 35 : 50;
          const sharePerPartner = defaultSharePct / partnerCompanies.length;
          
          partnerCompanies.forEach((partnerName: string) => {
            const estimatedShare = billboardPrice * (sharePerPartner / 100);
            partnerShares.push({
              partnerId: partnerName,
              partnerName,
              preSharePct: defaultSharePct / partnerCompanies.length,
              postSharePct: 50 / partnerCompanies.length,
              estimatedShare
            });
          });
        }
        
        const companySharePct = phase === 'recovery' ? 65 : 50;
        const capitalDeductionPct = phase === 'recovery' ? 35 : 0;
        
        newMap.set(billboardIdStr, {
          billboardId: billboardIdStr,
          isPartnership: true,
          partnerCompanies,
          capital,
          capitalRemaining,
          phase,
          partnerShares,
          companySharePct,
          capitalDeductionPct
        });
      }
      
      setPartnershipInfoMap(newMap);
    };
    
    loadPartnershipInfo();
  }, [selectedIdsKey, pricingMode, durationMonths, durationDays]);
  
  // ✅ NEW: Helper to get display size name
  const getDisplaySize = (billboard: any): string => {
    const sizeId = billboard.size_id || billboard.Size_ID;
    if (sizeId && sizeNames.has(sizeId)) {
      return sizeNames.get(sizeId)!;
    }
    return billboard.size || billboard.Size || 'غير محدد';
  };
  
  // ترتيب اللوحات حسب sort_order من جدول sizes
  const getSortOrder = (billboard: any): number => {
    const size = billboard.Size || billboard.size;
    const sizeId = billboard.size_id;
    
    // أولاً نحاول البحث بالـ id
    if (sizeId) {
      const found = sizesOrder.find(s => s.id === sizeId);
      if (found) return found.sort_order || 999;
    }
    
    // ثم نحاول البحث بالاسم
    if (size) {
      const found = sizesOrder.find(s => s.name === size);
      if (found) return found.sort_order || 999;
    }
    
    return 999;
  };
  
  const selectedBillboards = billboards
    .filter((b) => selected.includes(String((b as any).ID)))
    .sort((a, b) => getSortOrder(a) - getSortOrder(b));

  const getOriginalFacesCount = (b: any): number => {
    const raw = (b as any)?.Faces_Count ?? (b as any)?.faces_count ?? (b as any)?.faces ?? (b as any)?.Number_of_Faces ?? (b as any)?.Faces ?? (b as any)?.face_count ?? (b as any)?.FacesCount;
    if (raw !== undefined && raw !== null && raw !== '') {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return 2;
  };

  const getFacesCount = (b: any): number => {
    const origFaces = getOriginalFacesCount(b);
    const billboardId = String((b as any)?.ID);
    if (origFaces === 1 || singleFaceBillboards.has(billboardId)) {
      return 1;
    }
    return origFaces;
  };

  // الحصول على المقاسات والمدن الفريدة للفلترة
  const uniqueSizesForFilter = useMemo(() => {
    const sizes = new Set<string>();
    selectedBillboards.forEach((b) => {
      const size = getDisplaySize(b);
      if (size && size !== 'غير محدد') sizes.add(size);
    });
    return Array.from(sizes);
  }, [selectedBillboards]);

  const uniqueCitiesForFilter = useMemo(() => {
    const cities = new Set<string>();
    selectedBillboards.forEach((b) => {
      const city = (b as any).city || (b as any).City;
      if (city) cities.add(city);
    });
    return Array.from(cities);
  }, [selectedBillboards]);

  // تطبيق البحث والفلترة على اللوحات
  const filteredSelectedBillboards = useMemo(() => {
    return selectedBillboards.filter((b) => {
      const name = String((b as any).name || (b as any).Billboard_Name || '').toLowerCase();
      const landmark = String((b as any).location || (b as any).Nearest_Landmark || '').toLowerCase();
      const city = (b as any).city || (b as any).City || '';
      const size = getDisplaySize(b);

      const matchesSearch = !searchQuery ||
        name.includes(searchQuery.toLowerCase()) ||
        landmark.includes(searchQuery.toLowerCase());
      const matchesSize = sizeFilter === 'all' || size === sizeFilter;
      const matchesCity = cityFilter === 'all' || city === cityFilter;

      return matchesSearch && matchesSize && matchesCity;
    });
  }, [selectedBillboards, searchQuery, sizeFilter, cityFilter]);

  // ✅ مصدر تسعير موحد للكروت: نفس منطق الحفظ تمامًا
  const pricingByBillboardId = useMemo(() => {
    if (pricingByBillboardOverride && pricingByBillboardOverride.size > 0) {
      return pricingByBillboardOverride;
    }
    const pricingResults = calculateAllBillboardPrices(
      selectedBillboards.map((bb) => {
        const id = String((bb as any).ID);
        const installRaw = installationDetails.find((d) => d.billboardId === id)?.installationPrice || 0;
        const printRaw = printCostDetails.find((d) => d.billboardId === id)?.printCost || 0;
        const indDiscount = individualDiscounts[id];
        const origFaces = getOriginalFacesCount(bb);

        return {
          billboardId: id,
          baseRentalPrice: calculateBillboardPrice(bb),
          installationPrice: installRaw,
          printCost: printRaw,
          isSingleFace: origFaces === 1 || singleFaceBillboards.has(id),
          individualDiscountValue: indDiscount?.value,
          individualDiscountType: indDiscount?.type,
        };
      }),
      {
        totalDiscount,
        printCostEnabled,
        includePrintInPrice,
        installationEnabled,
        includeInstallationInPrice,
      }
    );

    return new Map(pricingResults.map((r) => [r.billboardId, r]));
  }, [
    pricingByBillboardOverride,
    selectedBillboards,
    installationDetails,
    printCostDetails,
    calculateBillboardPrice,
    singleFaceBillboards,
    totalDiscount,
    printCostEnabled,
    includePrintInPrice,
    installationEnabled,
    includeInstallationInPrice,
    individualDiscounts,
  ]);

  // ملخص المقاسات والوجوه
  const sizeSummary = React.useMemo(() => {
    const sizeMap = new Map<string, { count: number; faces: number }>();
    let totalFaces = 0;

    selectedBillboards.forEach((b) => {
      const size = getDisplaySize(b);
      const faces = getFacesCount(b);
      totalFaces += faces;

      if (sizeMap.has(size)) {
        const current = sizeMap.get(size)!;
        sizeMap.set(size, { count: current.count + 1, faces: current.faces + faces });
      } else {
        sizeMap.set(size, { count: 1, faces });
      }
    });
    
    // ترتيب حسب sort_order
    const sortedSizes = Array.from(sizeMap.entries()).sort((a, b) => {
      const orderA = sizesOrder.find(s => s.name === a[0])?.sort_order || 999;
      const orderB = sizesOrder.find(s => s.name === b[0])?.sort_order || 999;
      return orderA - orderB;
    });
    
    return { sizes: sortedSizes, totalFaces, totalCount: selectedBillboards.length };
  }, [selectedBillboards, sizesOrder]);

  // ✅ Calculate total price of all billboards before discount
  const totalPriceBeforeDiscount = React.useMemo(() => {
    return selectedBillboards.reduce((sum, b) => sum + calculateBillboardPrice(b), 0);
  }, [selectedBillboards, calculateBillboardPrice, pricingMode, durationMonths, durationDays]);

  // ✅ NEW: Calculate installation cost summary with unique sizes display
  const installationCostSummary = React.useMemo(() => {
    if (installationDetails.length === 0) return null;

    const totalInstallationCost = installationDetails.reduce((sum, detail) => sum + detail.installationPrice, 0);
    
    // Group by size and show unique prices without repetition
    const uniqueSizes = Array.from(new Map(installationDetails.map(detail => [detail.size, detail])).values());
    
    return {
      totalInstallationCost,
      uniqueSizes: uniqueSizes.map(detail => {
        const sizeCount = installationDetails.filter(d => d.size === detail.size).length;
        const totalForSize = detail.installationPrice * sizeCount;
        return {
          size: detail.size,
          pricePerUnit: detail.installationPrice,
          count: sizeCount,
          totalForSize
        };
      })
    };
  }, [installationDetails]);

  // ✅ NEW: Calculate total costs summary
  const costsSummary = React.useMemo(() => {
    const totalBaseRental = selectedBillboards.reduce((sum, b) => sum + calculateBillboardPrice(b), 0);
    
    const totalPrintCost = printCostEnabled && !includePrintInPrice 
      ? printCostDetails.reduce((sum, d) => sum + d.printCost, 0)
      : 0;
    
    const totalInstallCost = installationEnabled && !includeInstallationInPrice
      ? installationDetails.reduce((sum, d) => sum + d.installationPrice, 0)
      : 0;
    
    const grandTotal = totalBaseRental + totalPrintCost + totalInstallCost;
    
    return {
      totalBaseRental,
      totalPrintCost,
      totalInstallCost,
      grandTotal,
      hasCosts: totalPrintCost > 0 || totalInstallCost > 0
    };
  }, [selectedBillboards, calculateBillboardPrice, printCostDetails, installationDetails, printCostEnabled, includePrintInPrice, installationEnabled, includeInstallationInPrice]);

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border shadow-sm overflow-hidden">
        {/* Header */}
        <CardHeader className="py-3 px-4 bg-muted/30 border-b border-border">
          <CardTitle className="flex items-center justify-between text-card-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">اللوحات المرتبطة ({selected.length})</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {contractNumber && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/10"
                  onClick={() => setBulkPausedOpen(true)}
                  title="إضافة اللوحات المحذوفة سابقاً وإيقافها"
                >
                  <HistoryIcon className="h-3.5 w-3.5" />
                  استرجاع لوحات محذوفة + إيقاف
                </Button>
              )}
              {selected.length > 1 && (
                <Button
                  variant={bulkSelectMode ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    setBulkSelectMode(!bulkSelectMode);
                    if (bulkSelectMode) deselectAll();
                  }}
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  {bulkSelectMode ? 'إلغاء التحديد' : 'تحديد متعدد'}
                </Button>
              )}
              {bulkSelectMode && bulkSelectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={handleBulkRemove}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  حذف المحدد ({bulkSelectedIds.size})
                </Button>
              )}
            </div>
          </CardTitle>
          {bulkSelectMode && (
            <div className="flex items-center gap-2 mt-2">
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={selectAllFiltered}>
                تحديد الكل
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={deselectAll}>
                إلغاء الكل
              </Button>
              <span className="text-xs text-muted-foreground">
                {bulkSelectedIds.size} محدد
              </span>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* ملخص المقاسات والوجوه */}
          {selected.length > 0 && (
            <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <h3 className="font-bold text-foreground">ملخص اللوحات</h3>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
                {/* إجمالي اللوحات */}
                <div className="bg-background/80 backdrop-blur rounded-lg p-3 border border-border text-center">
                  <div className="text-2xl font-bold text-primary font-manrope">{sizeSummary.totalCount}</div>
                  <div className="text-xs text-muted-foreground">إجمالي اللوحات</div>
                </div>
                {/* إجمالي الوجوه */}
                <div className="bg-background/80 backdrop-blur rounded-lg p-3 border border-border text-center">
                  <div className="text-2xl font-bold text-accent font-manrope">{sizeSummary.totalFaces}</div>
                  <div className="text-xs text-muted-foreground">إجمالي الوجوه</div>
                </div>
                {/* تفاصيل كل مقاس */}
                {sizeSummary.sizes.map(([size, data]) => (
                  <div key={size} className="bg-background/80 backdrop-blur rounded-lg p-3 border border-border text-center">
                    <div className="text-lg font-bold text-foreground font-manrope">{data.count}</div>
                    <div className="text-xs text-muted-foreground">{size}</div>
                    <div className="text-[10px] text-primary/70">{data.faces} وجه</div>
                  </div>
                ))}
              </div>

 {/* ملخص إجمالي التكاليف */}
              {costsSummary.hasCosts && (
                <div className="bg-background/80 backdrop-blur rounded-lg p-4 border border-border mt-4">
                  <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    تفاصيل الحساب الكاملة
                  </h4>
                  <div className="space-y-2">
                    {/* الإيجار الأساسي */}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">إجمالي الإيجار الأساسي</span>
                      <span className="font-bold text-foreground font-manrope">{costsSummary.totalBaseRental.toLocaleString('ar-LY')} {currencySymbol}</span>
                    </div>
                    
                    {/* تكلفة الطباعة */}
                    {costsSummary.totalPrintCost > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-blue-600 flex items-center gap-1">
                          <Printer className="h-3.5 w-3.5" />
                          إجمالي تكلفة الطباعة
                        </span>
                        <span className="font-bold text-blue-600 font-manrope">+ {costsSummary.totalPrintCost.toLocaleString('ar-LY')} {currencySymbol}</span>
                      </div>
                    )}
                    
                    {/* تكلفة التركيب */}
                    {costsSummary.totalInstallCost > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-accent flex items-center gap-1">
                          <Wrench className="h-3.5 w-3.5" />
                          إجمالي تكلفة التركيب
                        </span>
                        <span className="font-bold text-accent font-manrope">+ {costsSummary.totalInstallCost.toLocaleString('ar-LY')} {currencySymbol}</span>
                      </div>
                    )}
                    
                    {/* الإجمالي الكلي */}
                    <div className="flex justify-between items-center text-base pt-2 border-t border-border mt-2">
                      <span className="font-bold text-primary">الإجمالي الكلي للوحات</span>
                      <span className="font-bold text-xl text-primary font-manrope">{costsSummary.grandTotal.toLocaleString('ar-LY')} {currencySymbol}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* شريط البحث والفلترة */}
          {selected.length > 3 && (
            <div className="bg-muted/30 rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span>بحث وفلترة اللوحات</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="flex-1 min-w-[200px] relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث بالاسم أو الموقع..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-9 h-9 bg-background"
                  />
                </div>
                {uniqueSizesForFilter.length > 1 && (
                  <Select value={sizeFilter} onValueChange={setSizeFilter}>
                    <SelectTrigger className="w-[140px] h-9 bg-background">
                      <SelectValue placeholder="المقاس" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل المقاسات</SelectItem>
                      {uniqueSizesForFilter.map((size) => (
                        <SelectItem key={size} value={size}>{size}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {uniqueCitiesForFilter.length > 1 && (
                  <Select value={cityFilter} onValueChange={setCityFilter}>
                    <SelectTrigger className="w-[140px] h-9 bg-background">
                      <SelectValue placeholder="المدينة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل المدن</SelectItem>
                      {uniqueCitiesForFilter.map((city) => (
                        <SelectItem key={city} value={city}>{city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {/* عداد النتائج */}
              {(searchQuery || sizeFilter !== 'all' || cityFilter !== 'all') && (
                <div className="text-xs text-muted-foreground">
                  عرض {filteredSelectedBillboards.length} من {selectedBillboards.length} لوحة
                </div>
              )}
            </div>
          )}

          {selected.length === 0 ? (
            <p className="text-muted-foreground text-center py-8 text-sm">لا توجد لوحات</p>
          ) : filteredSelectedBillboards.length === 0 ? (
            <p className="text-muted-foreground text-center py-8 text-sm">لا توجد نتائج للبحث</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 auto-rows-fr gap-4 items-stretch">
              {filteredSelectedBillboards.map((b) => {
                const billboardId = String((b as any).ID);
                const originalFaces = getOriginalFacesCount(b);
                const isSingleFace = originalFaces === 1 || singleFaceBillboards.has(billboardId);
                const pricingData = pricingByBillboardId.get(billboardId);

                // Fallback بسيط في حال عدم وجود بيانات (لا يُفترض أن يحدث)
                const fallbackInstallRaw = installationDetails.find((d) => d.billboardId === billboardId)?.installationPrice || 0;
                const fallbackPrintRaw = printCostDetails.find((d) => d.billboardId === billboardId)?.printCost || 0;
                const fallbackInstall = isSingleFace ? Math.round(fallbackInstallRaw / 2) : fallbackInstallRaw;
                const fallbackPrint = isSingleFace ? Math.round(fallbackPrintRaw / 2) : fallbackPrintRaw;

                const baseTotalForBoard = pricingData?.baseRentalPrice ?? calculateBillboardPrice(b);
                  const installPrice = pricingData?.installationPrice ?? fallbackInstall;
                const printCostForBillboard = pricingData?.printCost ?? fallbackPrint;
                const includedPrintCost = pricingData?.includedPrintCost ?? ((printCostEnabled && includePrintInPrice) ? printCostForBillboard : 0);
                const includedInstallCost = pricingData?.includedInstallCost ?? ((installationEnabled && includeInstallationInPrice) ? installPrice : 0);
                const netRentalBeforeDiscount = pricingData?.netRentalBeforeDiscount ?? (baseTotalForBoard - includedPrintCost - includedInstallCost);
                const discountPerBillboard = pricingData?.discountPerBillboard ?? 0;
                const individualDiscountAmt = pricingData?.individualDiscountAmt ?? 0;
                const netRentalAfterDiscount = pricingData?.netRentalAfterDiscount ?? Math.max(0, netRentalBeforeDiscount - discountPerBillboard);
                const extraPrintCost = pricingData?.extraPrintCost ?? ((printCostEnabled && !includePrintInPrice) ? printCostForBillboard : 0);
                const extraInstallCost = pricingData?.extraInstallCost ?? ((installationEnabled && !includeInstallationInPrice) ? installPrice : 0);
                const totalForBoard = pricingData?.totalForBoard ?? (netRentalAfterDiscount + includedInstallCost + includedPrintCost + extraInstallCost + extraPrintCost);
                const hasIncludedCosts = includedPrintCost > 0 || includedInstallCost > 0;

                // للتوافق مع الكود القديم
                const priceAfterDiscount = totalForBoard;

                // Friend company check
                const isFriendBillboard = (b as any).friend_company_id;
                const friendCost = friendBillboardCosts.find(f => f.billboardId === billboardId);

                // Partnership check
                const partnershipInfo = partnershipInfoMap.get(billboardId);
                const isPartnership = !!partnershipInfo;

                // Renewal check
                const isRenewed = previousContractBillboardIds.has(billboardId);

                return (
                  <div 
                    key={(b as any).ID} 
                    className={`group relative h-full flex flex-col bg-card border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 ${
                      bulkSelectMode && bulkSelectedIds.has(billboardId) 
                        ? 'border-destructive ring-2 ring-destructive/30' 
                        : replacementsMap.has(billboardId)
                          ? 'border-blue-500 ring-2 ring-blue-500/50 bg-gradient-to-br from-blue-500/5 to-transparent'
                          : isRenewed
                            ? 'border-emerald-500/40 shadow-emerald-500/5 bg-gradient-to-br from-emerald-500/[0.02] to-transparent'
                            : 'border-border'
                    }`}
                    onClick={bulkSelectMode ? () => toggleBulkSelect(billboardId) : undefined}
                    style={bulkSelectMode ? { cursor: 'pointer' } : undefined}
                  >
                    {/* Header: Prominent Size Badge, Billboard Code & Actions */}
                    <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-border/50 bg-[#0d0d1a] shrink-0" dir="rtl">
                      <div className="flex items-center gap-2 overflow-hidden">
                        {/* Prominent Size Badge at Top Header */}
                        <Badge 
                          variant="outline"
                          className="font-extrabold text-[#f4c25a] bg-[#1a172e] border border-[#d6ac40]/50 px-3 py-1 text-xs sm:text-sm font-manrope shadow-md shrink-0"
                        >
                          {getDisplaySize(b)}
                        </Badge>

                        {/* Billboard Code Badge */}
                        <span className="font-extrabold text-foreground tracking-wide text-xs sm:text-sm font-manrope bg-muted/40 px-2.5 py-0.5 rounded-lg border border-border/40 shrink-0">
                          {(b as any).code || (b as any).Code || `TR-${String(billboardId).padStart(4, '0')}`}
                        </span>

                        {/* ID Pill */}
                        <span className="text-[10px] bg-amber-500/15 text-amber-400 font-manrope font-bold px-2 py-0.5 rounded-md border border-amber-500/20 shrink-0">
                          #{billboardId}
                        </span>

                        {isRenewed && (
                          <Badge className="bg-emerald-500/10 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-bold px-1.5 py-0.5 shrink-0 select-none flex items-center gap-1">
                            <RefreshCw className="h-2.5 w-2.5 ml-1" />
                            مجدد {previousContractNumber ? `#${previousContractNumber}` : ''}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Bulk Select Checkbox */}
                        {bulkSelectMode && (
                          <div className="flex items-center justify-center ml-1">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                              bulkSelectedIds.has(billboardId)
                                ? 'bg-destructive border-destructive text-destructive-foreground scale-105'
                                : 'bg-background border-muted-foreground/40 hover:border-destructive/50'
                            }`}>
                              {bulkSelectedIds.has(billboardId) && <CheckSquare className="h-3 w-3" />}
                            </div>
                          </div>
                        )}

                        {/* Instant Swap button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-primary hover:text-primary hover:bg-primary/10 rounded-full cursor-pointer flex items-center justify-center shrink-0 transition-all duration-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!b) return;
                            setSwappingBillboard(b);
                            setSwapDialogOpen(true);
                          }}
                          title="تبديل سريع للوحة (استبدال فوري)"
                        >
                          <Repeat2 className="h-4 w-4" />
                        </Button>

                        {/* Quick Pause button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 rounded-full cursor-pointer flex items-center justify-center shrink-0 transition-all duration-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!b) return;
                            setQuickPausingBillboard(b);
                            setQuickPauseOpen(true);
                          }}
                          title="إيقاف مؤقت للوحة (بدون بديل)"
                        >
                          <PauseCircle className="h-4 w-4" />
                        </Button>

                        {/* Remove button directly visible */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full cursor-pointer flex items-center justify-center shrink-0 transition-all duration-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!computeCanDelete(b)) {
                              setDeletingBillboard(b);
                              setDeleteChoiceOpen(true);
                              return;
                            }
                            onRemoveSelected(billboardId);
                          }}
                          title="إزالة من العقد"
                        >
                          <X className="h-4 w-4" />
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 w-7 p-0 hover:bg-muted/80 rounded-full cursor-pointer flex items-center justify-center shrink-0 transition-all duration-200"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem 
                              onClick={(e) => { e.stopPropagation(); handleQuickEdit(b, e as any); }}
                              className="cursor-pointer gap-2"
                            >
                              <Pencil className="h-4 w-4" />
                              <span>تعديل السعر والمستوى</span>
                            </DropdownMenuItem>

                            {onSwapBillboard && (
                              <DropdownMenuItem 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  onSwapBillboard(billboardId, (b as any).Billboard_Name || (b as any).name || `لوحة ${billboardId}`); 
                                }}
                                className="cursor-pointer gap-2 text-blue-600 focus:text-blue-600 focus:bg-blue-50/10"
                              >
                                <ArrowLeftRight className="h-4 w-4" />
                                <span>تبديل مع لوحة أخرى</span>
                              </DropdownMenuItem>
                            )}

                            {onMoveBillboard && (
                              <DropdownMenuItem 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  onMoveBillboard(billboardId, (b as any).Billboard_Name || (b as any).name || `لوحة ${billboardId}`); 
                                }}
                                className="cursor-pointer gap-2 text-green-600 focus:text-green-600 focus:bg-green-50/10"
                              >
                                <MoveRight className="h-4 w-4" />
                                <span>نقل إلى عقد آخر</span>
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

 {/* Strong replacement banner across the top of the card */}
                    {replacementsMap.has(billboardId) && (() => {
                      const info = replacementsMap.get(billboardId)!;
                      return (
                        <div className="relative z-10 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-3 py-2 border-b border-blue-700 shadow-inner">
                          <div className="flex items-center gap-2 text-[11px] font-bold">
                            <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
                            <span>بديلة عن:</span>
                            <span className="bg-white/20 px-1.5 py-0.5 rounded font-extrabold truncate">
                              {info.pausedName || '—'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1 text-[10px] opacity-95">
                            <span>{info.startDate || '—'} → {info.endDate || '—'}</span>
                            <span className="font-bold">
                              المخصص: {Number(info.allocated || 0).toLocaleString('ar-LY')} د.ل
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Image Section — click to zoom */}
                    <div className="relative h-44 bg-muted overflow-hidden shrink-0">
                      <BillboardImageZoom
                        billboard={b}
                        alt={(b as any).name || (b as any).Billboard_Name || 'لوحة'}
                      />
                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
                      
                      {/* Badges overlayed on top-right of image */}
                      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5 items-end max-w-[90%] pointer-events-none">
                        {isPartnership && (
                          <Badge className="bg-primary/90 text-primary-foreground text-[10px] font-bold px-2 py-0.5 shadow-md flex items-center gap-1 border border-primary/20 backdrop-blur-sm">
                            <Users className="h-3 w-3 ml-1" />
                            مشتركة
                          </Badge>
                        )}
                        {isPartnership && partnershipInfo && partnershipInfo.partnerShares.length > 0 && (
                          <Badge className="bg-purple-600/90 text-white text-[10px] font-bold px-2 py-0.5 shadow-md max-w-[150px] truncate border border-purple-500/20 backdrop-blur-sm">
                            {partnershipInfo.partnerShares.map(ps => ps.partnerName).join(' • ')}
                          </Badge>
                        )}
                        {isFriendBillboard && (
                          <FriendCompanyBadge billboardId={billboardId} billboard={b} />
                        )}
                        {isSingleFace && (
                          <Badge className="bg-amber-600/90 text-white text-[10px] font-bold px-2 py-0.5 shadow-md border border-amber-500/20 backdrop-blur-sm">
                            وجه واحد
                          </Badge>
                        )}
                        {activeLoansByBillboard.get(billboardId) && (
                          <BillboardLoanBadge loan={activeLoansByBillboard.get(billboardId)!} />
                        )}
                        {replacementsMap.has(billboardId) && (
                          <Badge className="bg-blue-600/90 text-white text-[10px] font-bold px-2 py-0.5 shadow-md flex items-center gap-1 border border-blue-500/20 backdrop-blur-sm">
                            <ArrowLeftRight className="h-3 w-3" />
                            لوحة بديلة
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-4" dir="rtl">
                      {/* Location / Nearest Landmark */}
                      <div className="flex items-start gap-2 bg-muted/30 p-2.5 rounded-xl border border-border/40 shrink-0 text-right" dir="rtl">
                        <MapPin className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <div className="space-y-0.5 text-right">
                          <span className="text-[10px] text-muted-foreground block font-medium">أقرب نقطة دالة</span>
                          <p className="text-sm font-extrabold text-foreground leading-snug text-right">
                            {(b as any).location || (b as any).Nearest_Landmark || (b as any).Nearest_landmark || 'غير محدد'}
                          </p>
                        </div>
                      </div>

                      {/* Details Row: Municipality, District, City & Level */}
                      {(() => {
                        const cityName = (b as any).city || (b as any).City || '-';
                        const muniName = (b as any).municipality || (b as any).Municipality || '-';
                        const districtName = (b as any).district || (b as any).District || (b as any).area || (b as any).Area || '-';
                        const levelVal = (b as any).level || (b as any).Level || '-';

                        return (
                          <div className="grid grid-cols-4 gap-1.5 shrink-0" dir="rtl">
                            <div className="text-center bg-amber-500/10 border border-amber-500/30 rounded-xl py-1.5 px-1">
                              <div className="text-[9px] text-amber-500/90 mb-0.5 font-bold">البلدية</div>
                              <div className="text-xs font-bold text-amber-400 truncate" title={muniName}>{muniName}</div>
                            </div>
                            <div className="text-center bg-muted/40 border border-border/40 rounded-xl py-1.5 px-1">
                              <div className="text-[9px] text-muted-foreground mb-0.5 font-medium">المنطقة</div>
                              <div className="text-xs font-bold text-foreground truncate" title={districtName}>{districtName}</div>
                            </div>
                            <div className="text-center bg-[#0d0d1a] border border-[#d6ac40]/40 rounded-xl py-1.5 px-1">
                              <div className="text-[9px] text-[#f4c25a]/70 mb-0.5 font-medium">المدينة</div>
                              <div className="text-xs font-extrabold text-[#f4c25a] truncate" title={cityName}>{cityName}</div>
                            </div>
                            <div className="text-center bg-amber-500/10 border border-amber-500/30 rounded-xl py-1.5 px-1">
                              <div className="text-[9px] text-amber-400/80 mb-0.5 font-medium">المستوى</div>
                              <div className="text-xs font-extrabold text-amber-400 font-manrope">{levelVal}</div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Interactive Segmented Selector for Face Count or Static Single-Face Display */}
                      {originalFaces > 1 ? (
                        onToggleSingleFace && (
                          <div className="flex items-center justify-between bg-muted/40 p-1 rounded-xl border border-border/50 text-xs shrink-0 select-none">
                            <span className="font-bold text-foreground/75 mr-2">عدد الوجوه</span>
                            <div className="flex bg-muted/80 rounded-lg p-0.5 border border-border/20">
                              <button
                                onClick={() => isSingleFace && onToggleSingleFace(billboardId)}
                                className={`px-3 py-1 rounded-md font-bold text-[11px] transition-all duration-200 cursor-pointer ${
                                  !isSingleFace
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                وجهين
                              </button>
                              <button
                                onClick={() => !isSingleFace && onToggleSingleFace(billboardId)}
                                className={`px-3 py-1 rounded-md font-bold text-[11px] transition-all duration-200 cursor-pointer ${
                                  isSingleFace
                                    ? 'bg-amber-500 text-white shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                وجه واحد
                              </button>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="flex items-center justify-between bg-muted/40 px-3 py-2 rounded-xl border border-border/50 text-xs shrink-0">
                          <span className="font-bold text-foreground/75">عدد الوجوه</span>
                          <span className="px-2.5 py-0.5 rounded-md font-bold text-[11px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            وجه واحد
                          </span>
                        </div>
                      )}

                      {/* عرض التواريخ المخصصة إذا تم تفعيلها */}
                      {billboardCustomDates[billboardId]?.startDate && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 flex items-center justify-between text-[11px] font-bold text-amber-800 dark:text-amber-300 shrink-0">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-amber-600" />
                            تاريخ الحجز المخصص:
                          </span>
                          <span className="font-manrope text-[10px]">
                            {billboardCustomDates[billboardId].startDate} ← {billboardCustomDates[billboardId].endDate}
                          </span>
                        </div>
                      )}

                      {/* Pricing Section */}
                      <div className="bg-muted/20 border border-border/60 rounded-xl p-3.5 space-y-2 shrink-0">
                        {/* Base Rental */}
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-muted-foreground">الإيجار الأساسي</span>
                          <span className="text-lg font-bold text-primary font-manrope">{baseTotalForBoard.toLocaleString('ar-LY')} {currencySymbol}</span>
                        </div>

                        {/* Print Cost - included in price */}
                        {printCostEnabled && includePrintInPrice && printCostForBillboard > 0 && (
                          <div className="flex justify-between items-center bg-orange-500/10 rounded-lg px-3 py-1.5 -mx-1">
                            <span className="text-xs font-medium text-orange-600 flex items-center gap-1.5">
                              <Printer className="h-3 w-3" />
                              طباعة مضمنة
                            </span>
                            <span className="text-sm font-bold text-orange-600 font-manrope">- {printCostForBillboard.toLocaleString('ar-LY')} {currencySymbol}</span>
                          </div>
                        )}

                        {/* Print Cost - NOT included in price */}
                        {printCostEnabled && !includePrintInPrice && printCostForBillboard > 0 && (
                          <div className="flex justify-between items-center bg-blue-500/10 rounded-lg px-3 py-1.5 -mx-1">
                            <span className="text-xs font-medium text-blue-600 flex items-center gap-1.5">
                              <Printer className="h-3 w-3" />
                              تكلفة الطباعة
                            </span>
                            <span className="text-sm font-bold text-blue-600 font-manrope">+ {printCostForBillboard.toLocaleString('ar-LY')} {currencySymbol}</span>
                          </div>
                        )}

                        {/* Installation Cost - included in price */}
                        {installationEnabled && includeInstallationInPrice && installPrice > 0 && (
                          <div className="flex justify-between items-center bg-amber-500/10 rounded-lg px-3 py-1.5 -mx-1">
                            <span className="text-xs font-medium text-amber-600 flex items-center gap-1.5">
                              <Wrench className="h-3 w-3" />
                              تركيب مضمن
                            </span>
                            <span className="text-sm font-bold text-amber-600 font-manrope">- {installPrice.toLocaleString('ar-LY')} {currencySymbol}</span>
                          </div>
                        )}

                        {/* Installation Cost - NOT included in price */}
                        {installationEnabled && !includeInstallationInPrice && installPrice > 0 && (
                          <div className="flex justify-between items-center bg-accent/10 rounded-lg px-3 py-1.5 -mx-1">
                            <span className="text-xs font-medium text-accent flex items-center gap-1.5">
                              <Wrench className="h-3 w-3" />
                              تكلفة التركيب
                            </span>
                            <span className="text-sm font-bold text-accent font-manrope">+ {installPrice.toLocaleString('ar-LY')} {currencySymbol}</span>
                          </div>
                        )}

                        {/* صافي الإيجار قبل الخصم */}
                        {hasIncludedCosts && (
                          <div className="flex justify-between items-center bg-emerald-500/10 rounded-lg px-3 py-2 -mx-1 border border-emerald-500/20">
                            <span className="text-xs font-bold text-emerald-600">صافي الإيجار</span>
                            <span className="text-base font-bold text-emerald-600 font-manrope">{netRentalBeforeDiscount.toLocaleString('ar-LY')} {currencySymbol}</span>
                          </div>
                        )}

                        {/* Individual Discount */}
                        {individualDiscountAmt > 0 && (
                          <div className="flex justify-between items-center bg-red-500/10 rounded-lg px-3 py-1.5 -mx-1 border border-red-500/20">
                            <span className="text-xs font-bold text-red-600">خصم اللوحة المحدد</span>
                            <span className="text-sm font-bold text-red-600 font-manrope">- {formatAmount(individualDiscountAmt)} {currencySymbol}</span>
                          </div>
                        )}

                        {/* Discount */}
                        {discountPerBillboard > 0 && (
                          <div className="flex justify-between items-center bg-destructive/10 rounded-lg px-3 py-1.5 -mx-1">
                            <span className="text-xs font-medium text-destructive">خصم العقد الموزع</span>
                            <span className="text-sm font-bold text-destructive font-manrope">- {formatAmount(discountPerBillboard)} {currencySymbol}</span>
                          </div>
                        )}

                        {/* Net after discount */}
                        {discountPerBillboard > 0 && (
                          <div className="flex justify-between items-center bg-green-500/10 rounded-lg px-3 py-2 -mx-1 border border-green-500/20">
                            <span className="text-xs font-bold text-green-600">بعد الخصم</span>
                            <span className="text-base font-bold text-green-600 font-manrope">{formatAmount(netRentalAfterDiscount)} {currencySymbol}</span>
                          </div>
                        )}

                        {/* Edit Individual Discount (خصم محدد على لوحة معينة) */}
                        {onUpdateIndividualDiscount && (
                          <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2 mt-1">
                            <span className="text-xs font-bold text-muted-foreground">تعديل خصم اللوحة</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <Input
                                type="number"
                                min="0"
                                value={individualDiscounts[billboardId]?.value ?? ''}
                                onChange={(e) => {
                                  const val = Math.max(0, Number(e.target.value) || 0);
                                  const currentType = individualDiscounts[billboardId]?.type || 'amount';
                                  onUpdateIndividualDiscount(billboardId, val, currentType);
                                }}
                                placeholder="0"
                                className="h-7 w-20 text-center text-xs font-bold font-manrope"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <Select
                                value={individualDiscounts[billboardId]?.type || 'amount'}
                                onValueChange={(v: 'amount' | 'percent') => {
                                  const currentVal = individualDiscounts[billboardId]?.value || 0;
                                  onUpdateIndividualDiscount(billboardId, currentVal, v);
                                }}
                              >
                                <SelectTrigger className="h-7 w-16 text-[10px] px-1.5 font-bold" onClick={(e) => e.stopPropagation()}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-popover z-[100]">
                                  <SelectItem value="amount" className="text-xs font-bold">د.ل</SelectItem>
                                  <SelectItem value="percent" className="text-xs font-bold">%</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}

                        {/* تخصيص تاريخ بدء اللوحة */}
                        {onUpdateBillboardCustomDates && (
                          <div className="pt-2 border-t border-border/40 space-y-2 mt-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-muted-foreground font-medium">تخصيص تاريخ بدء اللوحة</span>
                              <Switch
                                checked={!!billboardCustomDates[billboardId]?.startDate}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    onUpdateBillboardCustomDates(billboardId, startDate || '', '');
                                  } else {
                                    onUpdateBillboardCustomDates(billboardId, '', '');
                                  }
                                }}
                                className="data-[state=checked]:bg-primary"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                            
                            {billboardCustomDates[billboardId]?.startDate && (
                              <div className="space-y-2 pt-1 animate-in slide-in-from-top-2 duration-200">
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted-foreground block">تاريخ البدء المخصص</label>
                                    <Input
                                      type="date"
                                      value={billboardCustomDates[billboardId]?.startDate || ''}
                                      onChange={(e) => {
                                        onUpdateBillboardCustomDates(billboardId, e.target.value, billboardCustomDates[billboardId]?.startDateReason || '');
                                      }}
                                      className="h-8 text-xs font-bold font-manrope text-center"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted-foreground block">تاريخ الانتهاء (تلقائي)</label>
                                    <Input
                                      type="date"
                                      value={billboardCustomDates[billboardId]?.endDate || ''}
                                      disabled
                                      className="h-8 text-xs font-bold font-manrope text-center bg-muted/50 cursor-not-allowed opacity-80"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-muted-foreground block">سبب تعديل تاريخ بدء اللوحة</label>
                                  <Input
                                    type="text"
                                    placeholder="مثال: تأخير بسبب التركيب أو ظروف قهرية"
                                    value={billboardCustomDates[billboardId]?.startDateReason || ''}
                                    onChange={(e) => {
                                      onUpdateBillboardCustomDates(
                                        billboardId,
                                        billboardCustomDates[billboardId]?.startDate || '',
                                        e.target.value
                                      );
                                    }}
                                    className="h-8 text-xs font-bold text-right"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* الإجمالي النهائي - always show when there are extra costs or discount */}
                        {(discountPerBillboard > 0 || individualDiscountAmt > 0 || extraInstallCost > 0 || extraPrintCost > 0) && (
                          <div className="flex justify-between items-center bg-primary/10 rounded-lg px-3 py-2.5 -mx-1 border border-primary/30 mt-1">
                            <span className="text-sm font-bold text-primary">الإجمالي النهائي</span>
                            <div className="text-left">
                              <span className="text-lg font-bold text-primary font-manrope">
                                {formatAmount(totalForBoard)} {currencySymbol}
                              </span>
                              <span className="text-[10px] text-primary/60 font-normal mr-1">
                                /{pricingMode === 'months' ? `${durationMonths} شهر` : `${durationDays} يوم`}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Friend cost input - Using site identity colors */}
                      {isFriendBillboard && onUpdateFriendCost && (
                        <div className="bg-secondary border border-border rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-primary" />
                              <span className="text-sm font-bold text-foreground">لوحة صديقة</span>
                            </div>
                            <Badge variant="secondary" className="text-[10px]">
 {friendCostsSaveState === 'saving' ? 'جاري الحفظ...' : friendCostsSaveState === 'saved' ? ' محفوظ' : 'سعر مطبّق'}
                            </Badge>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                            <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">السعر المطبَّق للشركة الصديقة:</label>
                            <Input
                              type="number"
                              dir="ltr"
                              value={friendCost?.friendRentalCost || 0}
                              onChange={(e) => {
                                const cost = Number(e.target.value) || 0;
                                onUpdateFriendCost(billboardId, (b as any).friend_company_id, (b as any).friend_companies?.name || 'غير محدد', cost);
                              }}
                              className="h-11 w-full sm:w-32 text-base bg-background border-border font-bold font-manrope tabular-nums text-center"
                            />
                          </div>
                          {friendCost && friendCost.friendRentalCost > 0 && (
                            <div className="flex justify-between items-center bg-primary/20 rounded-lg px-4 py-3 border border-primary/30">
                              <span className="text-sm font-bold text-primary">الربح المتوقع</span>
                              <span className="text-xl font-bold text-primary">
                                {(priceAfterDiscount - friendCost.friendRentalCost).toLocaleString('ar-LY')} {currencySymbol}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Partnership Info - Using site identity colors */}
                      {isPartnership && partnershipInfo && (
                        <div className="bg-secondary border border-border rounded-xl p-4 space-y-3">
                          {/* Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-primary" />
                              <span className="text-sm font-bold text-foreground">لوحة مشتركة</span>
                            </div>
                            <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                              partnershipInfo.phase === 'profit_sharing' 
                                ? 'bg-primary/20 text-primary' 
                                : 'bg-accent/20 text-accent'
                            }`}>
                              {partnershipInfo.phase === 'profit_sharing' ? 'مرحلة الأرباح' : 'مرحلة الاسترداد'}
                            </span>
                          </div>
                          
                          {/* Capital Info */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-muted border border-border rounded-lg px-3 py-2.5">
                              <div className="text-[10px] text-muted-foreground mb-0.5">رأس المال</div>
                              <div className="text-base font-bold text-foreground">{partnershipInfo.capital.toLocaleString()} {currencySymbol}</div>
                            </div>
                            <div className={`rounded-lg px-3 py-2.5 ${
                              partnershipInfo.capitalRemaining <= 0 
                                ? 'bg-primary/10 border border-primary/20' 
                                : 'bg-accent/10 border border-accent/20'
                            }`}>
                              <div className={`text-[10px] mb-0.5 ${partnershipInfo.capitalRemaining <= 0 ? 'text-primary' : 'text-accent'}`}>المتبقي</div>
                              <div className={`text-base font-bold ${partnershipInfo.capitalRemaining <= 0 ? 'text-primary' : 'text-accent'}`}>
                                {partnershipInfo.capitalRemaining.toLocaleString()} {currencySymbol}
                              </div>
                            </div>
                          </div>
                          
                          {/* Partner Shares */}
                          {partnershipInfo.partnerShares.length > 0 && (
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-muted-foreground">حصص الشركاء:</div>
                              <div className="grid gap-2">
                                {partnershipInfo.partnerShares.map((ps, idx) => (
                                  <div key={idx} className="flex justify-between items-center bg-muted rounded-lg px-3 py-2 border border-border">
                                    <span className="text-sm text-foreground">{ps.partnerName}</span>
                                    <span className="text-base font-bold text-primary">{ps.estimatedShare.toLocaleString()} {currencySymbol}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Company Share */}
                          <div className="flex justify-between items-center bg-primary/20 rounded-lg px-4 py-3 border border-primary/30">
                            <span className="text-sm font-bold text-primary">حصة الشركة</span>
                            <span className="text-xl font-bold text-primary">
                              {(priceAfterDiscount * (partnershipInfo.companySharePct / 100)).toLocaleString()} {currencySymbol}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

 {/* NEW: Installation Cost Summary with unique sizes display */}
      {installationCostSummary && installationCostSummary.totalInstallationCost > 0 && (
        <Card className="bg-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <Wrench className="h-5 w-5 text-accent" />
              ملخص تكلفة التركيب
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-2">إجمالي تكلفة التركيب</label>
                <div className="px-4 py-3 rounded bg-accent/10 text-accent font-bold text-lg">
                  {installationCostSummary.totalInstallationCost.toLocaleString('ar-LY')} د.ل
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-2">عدد اللوحات</label>
                <div className="px-4 py-3 rounded bg-muted text-card-foreground font-bold text-lg">
                  {selected.length} لوحة
                </div>
              </div>
            </div>

 {/* NEW: Display unique installation costs by size without repetition */}
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded" dir="rtl">
              <div className="font-medium mb-2">تفاصيل تكلفة التركيب حسب المقاس:</div>
              <div className="space-y-1.5">
                {installationCostSummary.uniqueSizes.map((sizeInfo, index) => (
                  <div key={index} className="text-xs flex items-center justify-between gap-2">
                    <span>
                      <strong>مقاس {sizeInfo.size}:</strong>{' '}
                      <span dir="ltr" className="inline-block">{sizeInfo.pricePerUnit.toLocaleString('en-US')}</span> د.ل × {sizeInfo.count} لوحة
                    </span>
                    <span className="font-bold text-accent whitespace-nowrap" dir="ltr">
                      {sizeInfo.totalForSize.toLocaleString('en-US')} د.ل
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Paused Billboards List */}
      {contractNumber && (
        <PausedBillboardsList
          contractNumber={contractNumber}
          contractStartDate={startDate}
          contractEndDate={endDate}
          onAddClick={() => setAddPausedOpen(true)}
          onBulkClick={() => setBulkPausedOpen(true)}
          onAddFromContractClick={onAddPausedFromContractClick}
          refreshKey={pausedRefreshKey}
          onChanged={() => { setPausedRefreshKey(k => k + 1); onRefresh?.(); }}
          calculateBillboardPrice={calculateBillboardPrice}
          printCostDetails={printCostDetails}
          installationDetails={installationDetails}
          printCostEnabled={printCostEnabled}
          includePrintInPrice={includePrintInPrice}
          installationEnabled={installationEnabled}
          includeInstallationInPrice={includeInstallationInPrice}
          singleFaceBillboards={singleFaceBillboards}
          onToggleSingleFace={onToggleSingleFace}
          currencySymbol={currencySymbol}
          pricingByBillboard={pricingByBillboardId}
          pricingMode={pricingMode}
          durationMonths={durationMonths}
          durationDays={durationDays}
          previousContractNumber={previousContractNumber}
          previousContractBillboardIds={previousContractBillboardIds}
        />
      )}

      {/* Instant Billboard Swap Dialog */}
      {swappingBillboard && (
        <InstantBillboardSwapDialog
          open={swapDialogOpen}
          onOpenChange={setSwapDialogOpen}
          originalBillboard={swappingBillboard}
          contractNumber={Number(contractNumber)}
          contractStartDate={startDate || ''}
          contractEndDate={endDate || ''}
          customerName={customerName || undefined}
          adType={adType || undefined}
          contractedPrice={pricingByBillboardId.get(String(swappingBillboard.ID))?.totalForBoard}
          onSwapped={() => {
            setPausedRefreshKey((k) => k + 1);
            onRefresh?.();
          }}
        />
      )}

      {/* Quick Pause Billboard Dialog */}
      {quickPausingBillboard && (
        <QuickPauseBillboardDialog
          open={quickPauseOpen}
          onOpenChange={setQuickPauseOpen}
          billboard={quickPausingBillboard}
          contractNumber={Number(contractNumber)}
          contractStartDate={startDate || ''}
          contractEndDate={endDate || ''}
          contractedPrice={pricingByBillboardId.get(String(quickPausingBillboard.ID))?.totalForBoard}
          onPaused={() => {
            setPausedRefreshKey((k) => k + 1);
            onRefresh?.();
          }}
        />
      )}

      {/* Add Paused Billboard Dialog */}
      <AddPausedBillboardDialog
        open={addPausedOpen}
        onOpenChange={setAddPausedOpen}
        contractNumber={contractNumber || null}
        onAdded={() => {
          setPausedRefreshKey((k) => k + 1);
          onRefresh?.();
        }}
      />

      {/* Bulk Register Previously Paused Dialog */}
      <BulkRegisterPausedDialog
        open={bulkPausedOpen}
        onOpenChange={setBulkPausedOpen}
        contractNumber={contractNumber || null}
        contractStartDate={startDate || null}
        onAdded={() => {
          setPausedRefreshKey((k) => k + 1);
          onRefresh?.();
        }}
      />

      {/* Pause Billboard Dialog */}
      <PauseBillboardDialog
        open={pauseDialogOpen && !!pausingBillboard}
        onOpenChange={setPauseDialogOpen}
        billboard={pausingBillboard}
        contractNumber={contractNumber || null}
        rentStartDate={(() => {
          const pid = pausingBillboard ? String((pausingBillboard as any).ID) : '';
          return billboardCustomDates[pid]?.startDate || installDatesByBillboard?.get(pid) || pausingBillboard?.Rent_Start_Date || startDate;
        })()}
        contractEndDate={(() => {
          const pid = pausingBillboard ? String((pausingBillboard as any).ID) : '';
          return billboardCustomDates[pid]?.endDate || pausingBillboard?.Rent_End_Date || endDate;
        })()}
        billboardPrice={(() => {
          if (!pausingBillboard) return 0;
          const pid = String((pausingBillboard as any).ID);
          const pd = pricingByBillboardId.get(pid);
          // ✅ استخدم السعر بعد الخصم (totalForBoard) ليطابق ما يظهر في كرت اللوحة بالعقد
          return pd?.totalForBoard ?? calculateBillboardPrice(pausingBillboard);
        })()}
        printCost={pausingPrintCost}
        installCost={pausingInstallCost}
        includePrint={includePrintInPrice}
        includeInstall={includeInstallationInPrice}
        onConfirm={async (data) => {
          if (!contractNumber || !pausingBillboard) return;
          try {
            const pausedId = String(pausingBillboard.ID || pausingBillboard.id);
            await pauseBillboardFromContract(
              pausingBillboard.ID || pausingBillboard.id,
              contractNumber,
              data.pauseDate,
              data.notes,
              data.refundAmount,
              data.deductFromContract
            );
            toast.success('تم إيقاف اللوحة بنجاح');
            setPauseDialogOpen(false);
            // ✅ Immediately remove from selected list (don't wait for refetch)
            try { onRemoveSelected?.(pausedId); } catch {}
            setPausedRefreshKey((k) => k + 1);
            if (onRefresh) onRefresh();
          } catch (error: any) {
            console.error('Error pausing billboard:', error);
            toast.error('حدث خطأ أثناء إيقاف اللوحة: ' + error.message);
          }
        }}
      />

      {/* Choice Dialog for Non-Deletable Billboard Removal */}
      <Dialog open={deleteChoiceOpen} onOpenChange={setDeleteChoiceOpen}>
        <DialogContent dir="rtl" className="sm:max-w-[500px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
              <Trash2 className="w-5 h-5 text-destructive" />
              خيارات إزالة اللوحة النشطة
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-3 text-right">
            <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-foreground">
                  اللوحة <span className="text-primary font-bold">{deletingBillboard?.Billboard_Name || deletingBillboard?.name}</span> مرتبطة بمهام تركيب أو تجاوزت مدة الحذف التلقائي.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  الرجاء اختيار نوع الإزالة المناسب لمعالجة هذه اللوحة:
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-3 border border-border rounded-lg bg-muted/40 hover:bg-muted/60 transition-all">
                <h4 className="text-sm font-bold text-foreground mb-1">1. حذف فوري (بدون إيقاف)</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  حذف اللوحة فوراً من العقد وإلغاؤها مباشرة دون تسجيلها كلوحة موقوفة ودون تطبيق أي تسويات مالية أو خصومات إيقاف.
                </p>
              </div>

              <div className="p-3 border border-border rounded-lg bg-muted/40 hover:bg-muted/60 transition-all">
                <h4 className="text-sm font-bold text-foreground mb-1">2. إيقاف اللوحة (إجراء تسوية)</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  تسجيل اللوحة كـ "موقوفة" لحساب المدة المستهلكة وإرجاع القيمة المتبقية كخصم إيقاف في العقد، وإتاحة اللوحة للإيجار مجدداً.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 flex-row-reverse justify-start">
            <Button
              variant="outline"
              onClick={() => {
                if (deletingBillboard) {
                  onRemoveSelected(String(deletingBillboard.ID || deletingBillboard.id));
                }
                setDeleteChoiceOpen(false);
                setDeletingBillboard(null);
                toast.success('تم الحذف الفوري بنجاح');
              }}
              className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive hover:text-white"
            >
              حذف فوري (بدون إيقاف)
            </Button>
            <Button
              onClick={() => {
                if (deletingBillboard) {
                  setPausingBillboard(deletingBillboard);
                  const billboardId = String(deletingBillboard.ID || deletingBillboard.id);
                  const pCost = printCostDetails.find(p => p.billboardId === billboardId)?.printCost || 0;
                  setPausingPrintCost(pCost);
                  const iCost = installationDetails.find(i => i.billboardId === billboardId)?.adjustedPrice || 0;
                  setPausingInstallCost(iCost);
                  setPauseDialogOpen(true);
                }
                setDeleteChoiceOpen(false);
                setDeletingBillboard(null);
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/95"
            >
              إيقاف اللوحة (إجراء تسوية)
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setDeleteChoiceOpen(false);
                setDeletingBillboard(null);
              }}
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Edit Dialog - عرض جميع الأسعار */}
      <Dialog open={quickEditOpen} onOpenChange={(open) => { setQuickEditOpen(open); if (!open) setIsQuickEditMode(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>الأسعار والمستوى - {editingBillboard?.name || editingBillboard?.Billboard_Name}</DialogTitle>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              {editingBillboard?.Size && <Badge variant="secondary" className="text-xs font-bold">{editingBillboard.Size}</Badge>}
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary">الفئة: {editCategory || 'غير محددة'}</Badge>
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30 font-bold">المستوى: {editLevel}</Badge>
            </div>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* تغيير المستوى */}
            <div className="space-y-2">
              <Label className="text-sm">المستوى</Label>
              <Select value={editLevel} onValueChange={(v) => {
                setEditLevel(v);
                const size = editingBillboard?.Size || editingBillboard?.size;
                const sizeId = editingBillboard?.size_id || editingBillboard?.Size_ID || null;
                if (size && editCategory) loadPricingData(size, v, editCategory, sizeId ? Number(sizeId) : null);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر المستوى" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {levels.map((level: any) => (
                    <SelectItem key={level.level_code} value={level.level_code}>
                      {level.level_code} - {level.level_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* عرض أسعار جميع الفترات */}
            {loadingQuickPricing ? (
              <div className="text-center py-4 text-muted-foreground text-sm">جاري تحميل الأسعار...</div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  أسعار المقاس {editingBillboard?.Size} - المستوى {editLevel} - الفئة: {editCategory}
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'one_day', label: 'يوم واحد' },
                    { key: 'one_month', label: 'شهر' },
                    { key: '2_months', label: 'شهرين' },
                    { key: '3_months', label: '3 أشهر' },
                    { key: '6_months', label: '6 أشهر' },
                    { key: 'full_year', label: 'سنة' },
                  ].map(({ key, label }) => (
                    <div key={key} className="p-3 rounded-lg border border-border bg-muted/30 text-center">
                      <span className="text-xs text-muted-foreground block mb-1.5">{label}</span>
                      {isQuickEditMode ? (
                        <Input
                          type="number"
                          min="0"
                          value={allDurationPrices[key] || ''}
                          onChange={(e) => setAllDurationPrices(prev => ({ ...prev, [key]: Number(e.target.value) || 0 }))}
                          className="h-10 text-center text-base font-mono font-bold"
                          placeholder="0"
                        />
                      ) : (
                        <span className="font-bold text-foreground text-base font-mono">
                          {allDurationPrices[key] ? Number(allDurationPrices[key]).toLocaleString() : '-'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* أزرار الإجراءات */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setQuickEditOpen(false)} className="flex-1">إغلاق</Button>
              {!isQuickEditMode ? (
                <Button variant="secondary" onClick={() => setIsQuickEditMode(true)} className="flex-1">
                  تعديل الأسعار
                </Button>
              ) : (
                <Button onClick={handleQuickEditSave} className="flex-1">
                  حفظ التغييرات
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}