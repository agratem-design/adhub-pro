import React, { useState, useEffect, useMemo } from 'react';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Shuffle, Play, CheckCircle, ArrowLeftRight, Trash2, 
  Loader2, MapPin, BarChart3, Star, Image as ImageIcon, Printer,
  ChevronDown, ChevronUp, Layers, Search, Plus, X, Users
} from 'lucide-react';
import { useSmartDistribution } from '@/hooks/useSmartDistribution';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { BillboardPrintWithSelection } from '@/components/billboards/BillboardPrintWithSelection';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// Partner colors palette
const PARTNER_COLORS = [
  { bg: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-500/10 border-blue-200 dark:border-blue-800', badge: 'bg-blue-600' },
  { bg: 'bg-orange-500', text: 'text-orange-600', light: 'bg-orange-500/10 border-orange-200 dark:border-orange-800', badge: 'bg-orange-600' },
  { bg: 'bg-emerald-500', text: 'text-emerald-600', light: 'bg-emerald-500/10 border-emerald-200 dark:border-emerald-800', badge: 'bg-emerald-600' },
  { bg: 'bg-purple-500', text: 'text-purple-600', light: 'bg-purple-500/10 border-purple-200 dark:border-purple-800', badge: 'bg-purple-600' },
  { bg: 'bg-pink-500', text: 'text-pink-600', light: 'bg-pink-500/10 border-pink-200 dark:border-pink-800', badge: 'bg-pink-600' },
  { bg: 'bg-cyan-500', text: 'text-cyan-600', light: 'bg-cyan-500/10 border-cyan-200 dark:border-cyan-800', badge: 'bg-cyan-600' },
];

const getPartnerColor = (idx: number) => PARTNER_COLORS[idx % PARTNER_COLORS.length];

// Multi-select filter component with search
const MultiSelectFilter: React.FC<{
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}> = ({ label, options, selected, onChange, placeholder }) => {
  const [search, setSearch] = useState('');
  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
  const allSelected = selected.length === 0; // empty means all

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between h-10 text-sm font-normal">
            <span className="truncate">
              {allSelected ? placeholder || 'الكل' : `${selected.length} محدد`}
            </span>
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="بحث..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8 text-sm pr-8"
              />
            </div>
          </div>
          <div className="p-1 border-b flex gap-1">
            <button className="text-[10px] text-primary hover:underline px-2 py-1" onClick={() => onChange([])}>
              الكل
            </button>
            <button className="text-[10px] text-primary hover:underline px-2 py-1" onClick={() => onChange([...options])}>
              تحديد الكل
            </button>
            {selected.length > 0 && (
              <button className="text-[10px] text-destructive hover:underline px-2 py-1" onClick={() => onChange([])}>
                إلغاء
              </button>
            )}
          </div>
          <div className="max-h-48 overflow-y-auto overscroll-contain p-1 space-y-0.5">
              {filtered.map(opt => (
                <div
                  key={opt}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (selected.includes(opt)) {
                      onChange(selected.filter(s => s !== opt));
                    } else {
                      onChange([...selected, opt]);
                    }
                  }}
                >
                  <Checkbox checked={selected.length === 0 || selected.includes(opt)} className="h-3.5 w-3.5 pointer-events-none" />
                  <span className="truncate">{opt}</span>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">لا توجد نتائج</p>
              )}
          </div>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.slice(0, 3).map(s => (
            <Badge key={s} variant="secondary" className="text-[10px] gap-1 pl-1">
              {s}
              <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => onChange(selected.filter(x => x !== s))} />
            </Badge>
          ))}
          {selected.length > 3 && (
            <Badge variant="outline" className="text-[10px]">+{selected.length - 3}</Badge>
          )}
        </div>
      )}
    </div>
  );
};

const SmartDistribution = () => {
  const { confirm: systemConfirm } = useSystemDialog();
  const {
    loading,
    distributions,
    fetchDistributions,
    fetchDistributionItems,
    generateAndSave,
    setActive,
    swapBillboards,
    deleteDistribution,
    removeItemsBySize,
    removeItemsByMunicipality,
    redistributeExisting,
  } = useSmartDistribution();

  const [billboards, setBillboards] = useState<any[]>([]);
  const [loadingBillboards, setLoadingBillboards] = useState(true);
  const [activeTab, setActiveTab] = useState('generate');
  // Multi-select filters: empty array = all
  const [filterMunis, setFilterMunis] = useState<string[]>([]);
  const [filterCities, setFilterCities] = useState<string[]>([]);
  const [filterSizes, setFilterSizes] = useState<string[]>([]);
  const [filterAdTypes, setFilterAdTypes] = useState<string[]>([]);
  const [threshold, setThreshold] = useState(175);
  const [partnerNames, setPartnerNames] = useState<string[]>(['الشريك أ', 'الشريك ب']);
  const [selectedDistId, setSelectedDistId] = useState<string | null>(null);
  const [distItems, setDistItems] = useState<any[]>([]);
  const [swapMode, setSwapMode] = useState(false);
  const [swapSelection, setSwapSelection] = useState<number[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [printFiltersOpen, setPrintFiltersOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [printPartnerFilter, setPrintPartnerFilter] = useState<string>('all');
  const [printSizeFilter, setPrintSizeFilter] = useState<string[]>([]);
  const [printMuniFilter, setPrintMuniFilter] = useState<string[]>([]);

  // Sort orders from DB
  const [sizeOrder, setSizeOrder] = useState<Record<string, number>>({});
  const [municipalityOrder, setMunicipalityOrder] = useState<Record<string, number>>({});
  const [levelOrder, setLevelOrder] = useState<Record<string, number>>({});

  // Load billboards + sort orders
  useEffect(() => {
    const load = async () => {
      setLoadingBillboards(true);
      try {
        const [bbRes, sizeRes, muniRes, levelRes] = await Promise.all([
          supabase.from('billboards').select('*'),
          supabase.from('sizes').select('name, sort_order').order('sort_order'),
          supabase.from('municipalities').select('name, sort_order').order('sort_order'),
          supabase.from('billboard_levels').select('level_code, sort_order').order('sort_order'),
        ]);
        if (bbRes.error) throw bbRes.error;
        setBillboards(bbRes.data || []);

        const sOrd: Record<string, number> = {};
        (sizeRes.data || []).forEach((s: any) => { sOrd[s.name] = s.sort_order ?? 999; });
        setSizeOrder(sOrd);

        const mOrd: Record<string, number> = {};
        (muniRes.data || []).forEach((m: any) => { mOrd[m.name] = m.sort_order ?? 999; });
        setMunicipalityOrder(mOrd);

        const lOrd: Record<string, number> = {};
        (levelRes.data || []).forEach((l: any) => { lOrd[l.level_code] = l.sort_order ?? 999; });
        setLevelOrder(lOrd);
      } catch (err) {
        console.error('Error loading:', err);
        toast.error('فشل في تحميل البيانات');
      } finally {
        setLoadingBillboards(false);
      }
    };
    load();
    fetchDistributions();
  }, [fetchDistributions]);

  // Sorted filter values
  const municipalities = useMemo(() => 
    [...new Set(billboards.map(b => b.Municipality).filter(Boolean))]
      .sort((a, b) => (municipalityOrder[a] ?? 999) - (municipalityOrder[b] ?? 999)),
    [billboards, municipalityOrder]
  );
  const sizes = useMemo(() => 
    [...new Set(billboards.map(b => b.Size).filter(Boolean))]
      .sort((a, b) => (sizeOrder[a] ?? 999) - (sizeOrder[b] ?? 999)),
    [billboards, sizeOrder]
  );
  const cities = useMemo(() => [...new Set(billboards.map(b => b.City).filter(Boolean))].sort(), [billboards]);
  const adTypes = useMemo(() => [...new Set(billboards.map(b => b.Ad_Type).filter(Boolean))].sort(), [billboards]);

  // Filter billboards (multi-select: empty = all)
  const filteredBillboards = useMemo(() => {
    return billboards.filter((b: any) => {
      const statusValue = String(b.Status ?? '').trim();
      const maintenanceStatus = String(b.maintenance_status ?? '').trim();
      const maintenanceType = String(b.maintenance_type ?? '').trim();
      if (statusValue === 'إزالة' || statusValue === 'ازالة' || statusValue.toLowerCase() === 'removed' ||
          maintenanceStatus === 'removed' || maintenanceType === 'تمت الإزالة') {
        return false;
      }
      const matchesMuni = filterMunis.length === 0 || filterMunis.includes(b.Municipality || '');
      const matchesCity = filterCities.length === 0 || filterCities.includes(b.City || '');
      const matchesSize = filterSizes.length === 0 || filterSizes.includes(b.Size || '');
      const matchesAdType = filterAdTypes.length === 0 || filterAdTypes.includes(b.Ad_Type || '');
      return matchesMuni && matchesCity && matchesSize && matchesAdType;
    });
  }, [billboards, filterMunis, filterCities, filterSizes, filterAdTypes]);

  const isContractExpired = (endDate: string | null | undefined): boolean => {
    if (!endDate) return true;
    try { return new Date(endDate) < new Date(); } catch { return true; }
  };

  const handleGenerate = async () => {
    if (filteredBillboards.length === 0) {
      toast.error('لا توجد لوحات بالفلاتر المحددة');
      return;
    }
    // Convert multi-select to legacy filter format for storage
    const filters = {
      municipality: filterMunis.length === 1 ? filterMunis[0] : 'all',
      city: filterCities.length === 1 ? filterCities[0] : 'all',
      size: filterSizes.length === 1 ? filterSizes[0] : 'all',
      status: 'all',
      adType: filterAdTypes.length === 1 ? filterAdTypes[0] : 'all',
    };
    const result = await generateAndSave(filteredBillboards, filters, threshold, partnerNames);
    if (result) {
      setActiveTab('details');
      loadDistItems(result.id);
    }
  };

  const loadDistItems = async (distId: string) => {
    setLoadingItems(true);
    setSelectedDistId(distId);
    try {
      const items = await fetchDistributionItems(distId);
      setDistItems(items);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleSwap = async () => {
    if (!selectedDistId || swapSelection.length !== 2) return;
    const success = await swapBillboards(selectedDistId, swapSelection[0], swapSelection[1]);
    if (success) {
      setSwapSelection([]);
      setSwapMode(false);
      loadDistItems(selectedDistId);
    }
  };

  const toggleSwapSelect = (billboardId: number) => {
    setSwapSelection(prev => {
      if (prev.includes(billboardId)) return prev.filter(id => id !== billboardId);
      if (prev.length >= 2) return [billboardId];
      return [...prev, billboardId];
    });
  };

  const getBillboardInfo = (billboardId: number) => {
    return billboards.find((bb: any) => bb.ID === billboardId);
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const selectedDist = distributions.find(d => d.id === selectedDistId);
  const distPartnerNames = selectedDist?.partner_names || [selectedDist?.partner_a_name || 'أ', selectedDist?.partner_b_name || 'ب'];

  // Get partner name for an item
  const getPartnerName = (partner: string): string => {
    // Handle both new format ('0','1','2') and legacy ('A','B')
    if (partner === 'A') return distPartnerNames[0] || 'الشريك أ';
    if (partner === 'B') return distPartnerNames[1] || 'الشريك ب';
    const idx = parseInt(partner);
    return !isNaN(idx) ? (distPartnerNames[idx] || `شريك ${idx + 1}`) : partner;
  };

  const getPartnerIdx = (partner: string): number => {
    if (partner === 'A') return 0;
    if (partner === 'B') return 1;
    const idx = parseInt(partner);
    return !isNaN(idx) ? idx : 0;
  };

  // Group items by Municipality → Size
  const groupedByMuniSize = useMemo(() => {
    const result: { municipality: string; sizes: { size: string; items: any[] }[] }[] = [];
    const muniMap: Record<string, Record<string, any[]>> = {};

    for (const item of distItems) {
      const info = getBillboardInfo(item.billboard_id);
      const muni = info?.Municipality || 'غير محدد';
      const size = info?.Size || 'غير محدد';
      if (!muniMap[muni]) muniMap[muni] = {};
      if (!muniMap[muni][size]) muniMap[muni][size] = [];
      muniMap[muni][size].push(item);
    }

    const sortedMunis = Object.keys(muniMap).sort((a, b) => 
      (municipalityOrder[a] ?? 999) - (municipalityOrder[b] ?? 999)
    );

    for (const muni of sortedMunis) {
      const sizeEntries = Object.entries(muniMap[muni])
        .sort(([a], [b]) => (sizeOrder[a] ?? 999) - (sizeOrder[b] ?? 999))
        .map(([size, items]) => ({ size, items }));
      result.push({ municipality: muni, sizes: sizeEntries });
    }

    return result;
  }, [distItems, billboards, municipalityOrder, sizeOrder]);

  // Print billboards - filtered
  const printBillboards = useMemo(() => {
    let items = distItems;
    if (printPartnerFilter !== 'all') items = items.filter(i => i.partner === printPartnerFilter);
    
    const filtered = items.map(item => getBillboardInfo(item.billboard_id)).filter((b): b is any => {
      if (!b) return false;
      if (printSizeFilter.length > 0 && !printSizeFilter.includes(b.Size)) return false;
      if (printMuniFilter.length > 0 && !printMuniFilter.includes(b.Municipality)) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      const sizeDiff = (sizeOrder[a.Size] ?? 999) - (sizeOrder[b.Size] ?? 999);
      if (sizeDiff !== 0) return sizeDiff;
      const muniDiff = (municipalityOrder[a.Municipality] ?? 999) - (municipalityOrder[b.Municipality] ?? 999);
      if (muniDiff !== 0) return muniDiff;
      return (levelOrder[a.Level] ?? 999) - (levelOrder[b.Level] ?? 999);
    });
  }, [distItems, printPartnerFilter, printSizeFilter, printMuniFilter, billboards, sizeOrder, municipalityOrder, levelOrder]);

  const printSizeSummary = useMemo(() => {
    const map: Record<string, number> = {};
    printBillboards.forEach(b => { map[b.Size || 'غير محدد'] = (map[b.Size || 'غير محدد'] || 0) + 1; });
    return Object.entries(map).sort(([a], [b]) => (sizeOrder[a] ?? 999) - (sizeOrder[b] ?? 999));
  }, [printBillboards, sizeOrder]);

  const printPartnerName = useMemo(() => {
    if (!selectedDist) return '';
    if (printPartnerFilter === 'all') return 'جميع الشركاء';
    return getPartnerName(printPartnerFilter);
  }, [printPartnerFilter, selectedDist, distPartnerNames]);

  const distSizes = useMemo(() => {
    const s = new Set<string>();
    distItems.forEach(item => { const info = getBillboardInfo(item.billboard_id); if (info?.Size) s.add(info.Size); });
    return [...s].sort((a, b) => (sizeOrder[a] ?? 999) - (sizeOrder[b] ?? 999));
  }, [distItems, billboards, sizeOrder]);

  const distMunis = useMemo(() => {
    const m = new Set<string>();
    distItems.forEach(item => { const info = getBillboardInfo(item.billboard_id); if (info?.Municipality) m.add(info.Municipality); });
    return [...m].sort((a, b) => (municipalityOrder[a] ?? 999) - (municipalityOrder[b] ?? 999));
  }, [distItems, billboards, municipalityOrder]);

  // Per-size statistics for generate tab
  const sizeStats = useMemo(() => {
    const stats: { size: string; count: number; perPartner: number; remainder: number }[] = [];
    const bySize: Record<string, number> = {};
    filteredBillboards.forEach(b => { bySize[b.Size || 'غير محدد'] = (bySize[b.Size || 'غير محدد'] || 0) + 1; });
    Object.entries(bySize)
      .sort(([a], [b]) => (sizeOrder[a] ?? 999) - (sizeOrder[b] ?? 999))
      .forEach(([size, count]) => {
        stats.push({
          size,
          count,
          perPartner: Math.floor(count / partnerNames.length),
          remainder: count % partnerNames.length,
        });
      });
    return stats;
  }, [filteredBillboards, partnerNames.length, sizeOrder]);

  if (loadingBillboards) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">جاري تحميل اللوحات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-6 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE4YTYgNiAwIDEgMSAxMiAwIDYgNiAwIDAgMS0xMiAwek0xMiA0OGE2IDYgMCAxIDEgMTIgMCA2IDYgMCAwIDEtMTIgMHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-white/15 backdrop-blur-sm">
              <Shuffle className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">التوزيع الذكي للوحات</h1>
              <p className="text-white/80 text-sm mt-0.5">توزيع عادل وذكي لجميع اللوحات بين {partnerNames.length} شركاء</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center px-4 py-2 rounded-xl bg-white/10 backdrop-blur-sm">
              <div className="text-2xl font-bold">{filteredBillboards.length}</div>
              <div className="text-xs text-white/70">لوحة</div>
            </div>
            {selectedDist && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setPrintPartnerFilter('all');
                  setPrintSizeFilter([]);
                  setPrintMuniFilter([]);
                  setPrintFiltersOpen(true);
                }}
                className="gap-2"
              >
                <Printer className="h-4 w-4" />
                طباعة
              </Button>
            )}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full max-w-lg bg-muted/60 p-1 rounded-xl">
          <TabsTrigger value="generate" className="flex-1 rounded-lg data-[state=active]:shadow-md">
            <Play className="h-4 w-4 ml-1.5" />
            إنشاء توزيع
          </TabsTrigger>
          <TabsTrigger value="distributions" className="flex-1 rounded-lg data-[state=active]:shadow-md">
            <Layers className="h-4 w-4 ml-1.5" />
            التوزيعات ({distributions.length})
          </TabsTrigger>
          <TabsTrigger value="details" disabled={!selectedDistId} className="flex-1 rounded-lg data-[state=active]:shadow-md">
            <BarChart3 className="h-4 w-4 ml-1.5" />
            التفاصيل
          </TabsTrigger>
        </TabsList>

        {/* Generate Tab */}
        <TabsContent value="generate" className="mt-6">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6 space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <div className="h-1 w-4 rounded-full bg-primary" />
                  الفلاتر
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <MultiSelectFilter
                    label="البلدية"
                    options={municipalities}
                    selected={filterMunis}
                    onChange={setFilterMunis}
                    placeholder="جميع البلديات"
                  />
                  <MultiSelectFilter
                    label="المدينة"
                    options={cities}
                    selected={filterCities}
                    onChange={setFilterCities}
                    placeholder="جميع المدن"
                  />
                  <MultiSelectFilter
                    label="المقاس"
                    options={sizes}
                    selected={filterSizes}
                    onChange={setFilterSizes}
                    placeholder="جميع المقاسات"
                  />
                  <MultiSelectFilter
                    label="نوع الإعلان"
                    options={adTypes}
                    selected={filterAdTypes}
                    onChange={setFilterAdTypes}
                    placeholder="جميع الأنواع"
                  />
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <div className="h-1 w-4 rounded-full bg-primary" />
                  إعدادات التوزيع
                </h3>
                <div className="space-y-5">
                  <div className="space-y-3">
                    <Label className="text-xs font-medium text-muted-foreground">مسافة التقارب: <span className="text-foreground font-bold">{threshold}م</span></Label>
                    <Slider
                      value={[threshold]}
                      onValueChange={([v]) => setThreshold(v)}
                      min={50} max={500} step={25}
                      className="w-full max-w-sm"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground max-w-sm">
                      <span>50م</span><span>500م</span>
                    </div>
                  </div>

                  {/* Partners */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        الشركاء ({partnerNames.length})
                      </Label>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => setPartnerNames(prev => [...prev, `شريك ${prev.length + 1}`])}
                      >
                        <Plus className="h-3 w-3" />
                        إضافة شريك
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {partnerNames.map((name, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className={cn("w-3 h-3 rounded-full shrink-0", getPartnerColor(idx).bg)} />
                          <Input
                            value={name}
                            onChange={e => {
                              const next = [...partnerNames];
                              next[idx] = e.target.value;
                              setPartnerNames(next);
                            }}
                            className="h-9 text-sm"
                          />
                          {partnerNames.length > 2 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-destructive hover:bg-destructive/10"
                              onClick={() => setPartnerNames(prev => prev.filter((_, i) => i !== idx))}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Size preview stats */}
              {sizeStats.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">معاينة التوزيع حسب المقاس</Label>
                  <div className="flex flex-wrap gap-2">
                    {sizeStats.map(s => (
                      <Badge key={s.size} variant="outline" className="text-xs gap-1.5 py-1">
                        <span className="font-medium">{s.size}</span>
                        <span className="text-muted-foreground">{s.count}</span>
                        <span className="text-primary">({s.perPartner}/شريك{s.remainder > 0 ? ` +${s.remainder}` : ''})</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats + Generate */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span><strong className="text-foreground">{filteredBillboards.length}</strong> لوحة</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    <span>~<strong className="text-foreground">{Math.ceil(filteredBillboards.length / partnerNames.length)}</strong> لكل شريك</span>
                  </div>
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={loading || filteredBillboards.length === 0}
                  size="lg"
                  className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg hover:shadow-xl transition-all px-8"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
                  إنشاء التوزيع
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Distributions List */}
        <TabsContent value="distributions" className="mt-6 space-y-4">
          {distributions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center">
                <Shuffle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">لا توجد توزيعات بعد</p>
                <Button variant="outline" className="mt-4" onClick={() => setActiveTab('generate')}>
                  إنشاء أول توزيع
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {distributions.map(dist => {
                const names = dist.partner_names || [dist.partner_a_name, dist.partner_b_name];
                const counts = dist.partner_counts || { '0': dist.partner_a_count, '1': dist.partner_b_count };
                
                return (
                  <Card 
                    key={dist.id}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 group",
                      dist.is_active && "ring-2 ring-emerald-500 shadow-emerald-500/10 shadow-lg",
                    )}
                    onClick={() => { loadDistItems(dist.id); setActiveTab('details'); }}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {dist.is_active && (
                            <div className="p-1 rounded-full bg-emerald-500">
                              <CheckCircle className="h-3 w-3 text-white" />
                            </div>
                          )}
                          <span className="font-semibold">{dist.name}</span>
                        </div>
                        <Badge variant="secondary" className="font-mono">{dist.total_billboards}</Badge>
                      </div>
                      
                      {/* Partner bars */}
                      <div className="space-y-1.5 mb-3">
                        {names.map((name: string, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            <div className={cn("w-3 h-3 rounded-full", getPartnerColor(idx).bg)} />
                            <span className="text-muted-foreground">{name}</span>
                            <span className="font-bold mr-auto">{counts[String(idx)] || 0}</span>
                          </div>
                        ))}
                        <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                          {names.map((_: string, idx: number) => (
                            <div 
                              key={idx}
                              className={cn(getPartnerColor(idx).bg, "transition-all")}
                              style={{ width: `${((counts[String(idx)] || 0) / dist.total_billboards) * 100}%` }} 
                            />
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(dist.created_at).toLocaleDateString('ar-LY')} • {dist.distance_threshold}م • {names.length} شركاء
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!dist.is_active && (
                            <Button size="icon" variant="ghost" className="h-7 w-7"
                              onClick={(e) => { e.stopPropagation(); setActive(dist.id, dist.size_filter); }}>
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); deleteDistribution(dist.id); fetchDistributions(); }}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details" className="mt-6">
          {selectedDist && (
            <div className="space-y-6">
              {/* Controls bar */}
              <Card className="border-0 shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-bold">{selectedDist.name}</h2>
                      {selectedDist.is_active && (
                        <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white">نشط</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => {
                        setPrintPartnerFilter('all');
                        setPrintSizeFilter([]);
                        setPrintMuniFilter([]);
                        setPrintFiltersOpen(true);
                      }} className="gap-1.5">
                        <Printer className="h-4 w-4" />
                        طباعة
                      </Button>
                      {distPartnerNames.map((name: string, idx: number) => (
                        <Button key={idx} variant="outline" size="sm" onClick={() => {
                          setPrintPartnerFilter(String(idx));
                          setPrintSizeFilter([]);
                          setPrintMuniFilter([]);
                          setPrintFiltersOpen(true);
                        }} className={cn("gap-1.5", getPartnerColor(idx).text)}>
                          <Printer className="h-4 w-4" />
                          {name}
                        </Button>
                      ))}
                      <Button
                        size="sm"
                        variant={swapMode ? "destructive" : "outline"}
                        onClick={() => { setSwapMode(!swapMode); setSwapSelection([]); }}
                        className="gap-1.5"
                      >
                        <ArrowLeftRight className="h-4 w-4" />
                        {swapMode ? 'إلغاء' : 'تبديل'}
                      </Button>
                      {swapMode && swapSelection.length === 2 && (
                        <Button size="sm" onClick={handleSwap} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
                          <CheckCircle className="h-4 w-4" />
                          تنفيذ
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={async () => {
                          if (!selectedDistId) return;
                          const success = await redistributeExisting(selectedDistId, selectedDist?.distance_threshold || 175, distPartnerNames);
                          if (success) {
                            loadDistItems(selectedDistId);
                            fetchDistributions();
                          }
                        }}
                        className="gap-1.5"
                      >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}
                        إعادة التوزيع
                      </Button>
                    </div>
                  </div>

                  {/* Partner summary */}
                  <div className={cn("grid gap-3 mt-4", `grid-cols-${Math.min(distPartnerNames.length, 4)}`)}>
                    {distPartnerNames.map((name: string, idx: number) => {
                      const count = distItems.filter(i => i.partner === String(idx) || (idx === 0 && i.partner === 'A') || (idx === 1 && i.partner === 'B')).length;
                      return (
                        <div key={idx} className={cn("flex items-center gap-3 p-3 rounded-xl border", getPartnerColor(idx).light)}>
                          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg", getPartnerColor(idx).bg)}>
                            {count}
                          </div>
                          <div>
                            <div className="text-sm font-medium">{name}</div>
                            <div className="text-xs text-muted-foreground">{distItems.length > 0 ? ((count / distItems.length) * 100).toFixed(0) : 0}%</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Billboard cards grouped by Municipality → Size */}
              {loadingItems ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : (
                <div className="space-y-4">
                  {groupedByMuniSize.map(({ municipality, sizes: sizeGroups }) => {
                    const muniKey = `muni_${municipality}`;
                    const muniItemCount = sizeGroups.reduce((sum, sg) => sum + sg.items.length, 0);
                    const isCollapsed = collapsedGroups.has(muniKey);
                    
                    return (
                      <Card key={muniKey} className="overflow-hidden">
                        <Collapsible open={!isCollapsed} onOpenChange={() => toggleGroup(muniKey)}>
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/10">
                                  <MapPin className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                  <h3 className="font-bold text-base">{municipality}</h3>
                                  <span className="text-xs text-muted-foreground">{sizeGroups.length} مقاس • {muniItemCount} لوحة</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (!selectedDistId) return;
                                    if (!await systemConfirm({ title: 'تأكيد الحذف', message: `هل تريد حذف جميع لوحات بلدية "${municipality}" (${muniItemCount} لوحة)؟`, variant: 'destructive', confirmText: 'حذف' })) return;
                                    removeItemsByMunicipality(selectedDistId, municipality).then(ok => {
                                      if (ok) { loadDistItems(selectedDistId); fetchDistributions(); }
                                    });
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                                <Badge variant="outline">{muniItemCount}</Badge>
                                {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="px-4 pb-4 space-y-4">
                              {sizeGroups.map(({ size, items }) => (
                                <div key={`${municipality}_${size}`}>
                                  <div className="flex items-center gap-2 mb-3 py-1.5 px-3 rounded-lg bg-muted/50">
                                    <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-sm font-medium">{size}</span>
                                    <Badge variant="secondary" className="text-[10px] mr-auto">{items.length}</Badge>
                                    <div className="flex gap-1 text-[10px]">
                                      {distPartnerNames.map((pName: string, pIdx: number) => {
                                        const pCount = items.filter((i: any) => i.partner === String(pIdx) || (pIdx === 0 && i.partner === 'A') || (pIdx === 1 && i.partner === 'B')).length;
                                        return (
                                          <React.Fragment key={pIdx}>
                                            {pIdx > 0 && <span className="text-muted-foreground">|</span>}
                                            <span className={getPartnerColor(pIdx).text}>{pCount} {pName}</span>
                                          </React.Fragment>
                                        );
                                      })}
                                    </div>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6 text-destructive hover:bg-destructive/10"
                                      onClick={() => {
                                        if (!selectedDistId) return;
                                        if (!confirm(`هل تريد حذف جميع لوحات مقاس "${size}" (${items.length} لوحة)؟`)) return;
                                        removeItemsBySize(selectedDistId, size).then(ok => {
                                          if (ok) { loadDistItems(selectedDistId); fetchDistributions(); }
                                        });
                                      }}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
                                    {items.map((item: any) => {
                                      const info = getBillboardInfo(item.billboard_id);
                                      const isSelected = swapSelection.includes(item.billboard_id);
                                      const imageUrl = info?.Image_URL;
                                      const pIdx = getPartnerIdx(item.partner);
                                      return (
                                        <div
                                          key={item.id}
                                          onClick={() => swapMode && toggleSwapSelect(item.billboard_id)}
                                          className={cn(
                                            "rounded-xl overflow-hidden border transition-all bg-card",
                                            swapMode && "cursor-pointer hover:scale-[1.02]",
                                            isSelected && "ring-2 ring-primary shadow-lg scale-[1.02]",
                                          )}
                                        >
                                          <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                                            {imageUrl ? (
                                              <img src={imageUrl} alt="" className="w-full h-full object-cover" loading="lazy"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                            ) : (
                                              <div className="absolute inset-0 flex items-center justify-center">
                                                <ImageIcon className="h-6 w-6 text-muted-foreground/20" />
                                              </div>
                                            )}
                                            <div className={cn(
                                              "absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold text-white",
                                              getPartnerColor(pIdx).badge
                                            )}>
                                              {getPartnerName(item.partner)}
                                            </div>
                                            {item.is_random && (
                                              <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full text-[9px] bg-yellow-500 text-white font-medium">
                                                عشوائي
                                              </div>
                                            )}
                                          </div>
                                          <div className="p-2 space-y-0.5">
                                            <div className="font-semibold text-xs truncate">{info?.Billboard_Name || `#${item.billboard_id}`}</div>
                                            {info?.Nearest_Landmark && (
                                              <div className="text-[10px] text-muted-foreground line-clamp-1 flex items-center gap-1">
                                                <MapPin className="h-2.5 w-2.5 shrink-0" />
                                                {info.Nearest_Landmark}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Print Filters Dialog */}
      {printFiltersOpen && selectedDist && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPrintFiltersOpen(false)}>
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-xl animate-in fade-in-0 zoom-in-95 duration-200" 
               dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 pb-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Printer className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">تصفية الطباعة</h3>
                  <p className="text-xs text-muted-foreground">حدد ما تريد طباعته</p>
                </div>
              </div>
 <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setPrintFiltersOpen(false)}></Button>
            </div>

            <div className="p-5 space-y-5">
              {/* Partner quick select */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">الشريك</Label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setPrintPartnerFilter('all')}
                    className={cn(
                      "px-3 py-2 rounded-xl text-sm font-medium border transition-all bg-muted hover:bg-muted/80",
                      printPartnerFilter === 'all' && "ring-2 ring-primary ring-offset-1 shadow-sm"
                    )}
                  >
                    الجميع
                  </button>
                  {distPartnerNames.map((name: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setPrintPartnerFilter(String(idx))}
                      className={cn(
                        "px-3 py-2 rounded-xl text-sm font-medium border transition-all",
                        getPartnerColor(idx).light,
                        printPartnerFilter === String(idx) && "ring-2 ring-primary ring-offset-1 shadow-sm"
                      )}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Size filter */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-muted-foreground">المقاسات</Label>
                  <div className="flex gap-2">
                    <button className="text-[10px] text-primary hover:underline" 
                      onClick={() => setPrintSizeFilter([...distSizes])}>تحديد الكل</button>
                    {printSizeFilter.length > 0 && (
                      <button className="text-[10px] text-destructive hover:underline" onClick={() => setPrintSizeFilter([])}>إلغاء الكل</button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {distSizes.map(s => (
                    <Badge 
                      key={s}
                      variant={printSizeFilter.includes(s) ? "default" : "outline"}
                      className={cn("cursor-pointer text-xs transition-all gap-1", 
                        printSizeFilter.includes(s) && "shadow-sm")}
                      onClick={() => setPrintSizeFilter(prev => 
                        prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
                      )}
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Municipality filter */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-muted-foreground">البلديات</Label>
                  <div className="flex gap-2">
                    <button className="text-[10px] text-primary hover:underline" 
                      onClick={() => setPrintMuniFilter([...distMunis])}>تحديد الكل</button>
                    {printMuniFilter.length > 0 && (
                      <button className="text-[10px] text-destructive hover:underline" onClick={() => setPrintMuniFilter([])}>إلغاء الكل</button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {distMunis.map(m => (
                    <Badge 
                      key={m}
                      variant={printMuniFilter.includes(m) ? "default" : "outline"}
                      className={cn("cursor-pointer text-xs transition-all gap-1",
                        printMuniFilter.includes(m) && "shadow-sm")}
                      onClick={() => setPrintMuniFilter(prev => 
                        prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
                      )}
                    >
                      {m}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-5 pt-0 border-t mx-5 pt-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                  {printBillboards.length}
                </div>
                <span className="text-sm text-muted-foreground">لوحة</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPrintFiltersOpen(false)}>إلغاء</Button>
                <Button 
                  size="sm"
                  onClick={() => { setPrintFiltersOpen(false); setPrintOpen(true); }}
                  disabled={printBillboards.length === 0}
                  className="gap-2 px-6"
                >
                  <Printer className="h-4 w-4" />
                  طباعة
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Dialog */}
      <BillboardPrintWithSelection
        open={printOpen}
        onOpenChange={setPrintOpen}
        billboards={printBillboards}
        isContractExpired={isContractExpired}
        hidePrice
        partnerName={printPartnerName}
        sizeSummary={printSizeSummary}
      />
    </div>
  );
};

export default SmartDistribution;
